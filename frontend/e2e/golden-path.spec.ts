import { test, expect, type Locator, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// PC-505 — the one golden-path E2E. It exercises the integration seams unit
// tests can't: a real Chromium uploads an .xlsx, builds an Excel -> Foreach ->
// Chain Output graph by clicking the real palette and dragging real React Flow
// handles, runs it against the real FastAPI backend, and asserts the ZIP the
// browser downloads contains one `.chain` per model plus the summary.

const FIXTURE = path.join(__dirname, 'fixtures', 'e2e-models.xlsx');
const EXPECTED_MODELS = ['E2E-Alpha', 'E2E-Bravo'];

const nodeByPrefix = (page: Page, prefix: string): Locator =>
  page.locator(`.react-flow__node[data-id^="${prefix}"]`);

const handle = (node: Locator, handleId: string): Locator =>
  node.locator(`.react-flow__handle[data-handleid="${handleId}"]`);

async function centerOf(loc: Locator): Promise<{ x: number; y: number }> {
  const box = await loc.boundingBox();
  if (!box) throw new Error('element has no bounding box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Add a node from the left palette. Sections are collapsed by default, so we
// drive the search box (which renders a flat, filtered list) and click the
// matching button by its exact label.
async function addPaletteNode(page: Page, label: string): Promise<void> {
  const palette = page.locator('[data-tour-id="node-palette"]');
  const search = palette.locator('input[type="text"]');
  await search.fill(label);
  await palette.getByRole('button', { name: label, exact: true }).click();
  await search.fill('');
}

// Drag a connection from one handle to another the way a user would.
async function connect(page: Page, from: Locator, to: Locator): Promise<void> {
  const s = await centerOf(from);
  const d = await centerOf(to);
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move((s.x + d.x) / 2, (s.y + d.y) / 2, { steps: 8 });
  await page.mouse.move(d.x, d.y, { steps: 8 });
  await page.mouse.up();
}

test('golden path: upload Excel, build graph, run, download ZIP', async ({ page }) => {
  // Suppress the PC-909 first-visit onboarding tour, which would otherwise
  // auto-launch a spotlight overlay and intercept clicks.
  await page.addInitScript(() => {
    window.localStorage.setItem('pychain_tour_completed', '1');
  });

  // Capture the backend session id as a sanity check that the run hit the API.
  let runSessionId: string | undefined;
  page.on('response', async (res) => {
    const req = res.request();
    if (req.method() === 'POST' && res.url().includes('/api/workflow/run')) {
      try {
        runSessionId = ((await res.json()) as { session_id?: string })?.session_id;
      } catch {
        /* non-JSON / error response — leave undefined */
      }
    }
  });

  // 1. Landing -> editor.
  await page.goto('/');
  await page.getByRole('button', { name: /get started/i }).click();
  await expect(page.locator('[data-tour-id="workflow-canvas"]')).toBeVisible();

  // 2. Upload the Excel file -> creates an Excel Models node. Wait for the
  //    per-model handle, which only renders once parsing has populated the
  //    model list (so the node is run-ready).
  await page.locator('#excel-upload').setInputFiles(FIXTURE);
  const excel = nodeByPrefix(page, 'excelModels_');
  await expect(excel).toBeVisible();
  await expect(handle(excel, 'value:model:0')).toBeVisible();

  // 3. Add Foreach Model and wire Excel -> Foreach while only those two nodes
  //    exist (palette nodes spawn stacked at the viewport centre, so connect
  //    before a third node lands on top of this one).
  await addPaletteNode(page, 'Foreach Model');
  const foreach = nodeByPrefix(page, 'foreachModel_');
  await expect(foreach).toBeVisible();
  await connect(page, handle(excel, 'flow:models'), handle(foreach, 'flow:input'));
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  // 4. Add Chain Output (spawns stacked on Foreach), then un-stack every node
  //    via the Auto-layout button. Mouse-dragging a React Flow node body isn't
  //    reliably automatable, but dagre lays the graph out non-overlapping so the
  //    remaining handles become individually targetable.
  await addPaletteNode(page, 'Chain Output');
  const chainOut = nodeByPrefix(page, 'chainFileOutput_');
  await expect(chainOut).toBeVisible();
  await page.getByRole('button', { name: /auto-?layout/i }).click();
  await page.waitForTimeout(800); // fitView tween + position settle

  // 5. Wire Foreach -> Chain Output (now separated).
  await connect(page, handle(foreach, 'flow:output'), handle(chainOut, 'flow:input'));
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);

  // 6. Run the chain and capture the auto-triggered download.
  const runBtn = page.locator('[data-tour-id="run-chain-btn"]');
  await expect(runBtn).toBeEnabled();
  const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
  await runBtn.click();

  // 7. The full-success modal shows "Awesome!" only when every model succeeded.
  await expect(page.getByRole('button', { name: 'Awesome!' })).toBeVisible({ timeout: 90_000 });

  // 8. Assert the downloaded ZIP: one `.chain` per model, the summary, and no
  //    stray `Model.chain` (proves the header row was skipped end-to-end).
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^workflow_chain_files_.*\.zip$/);
  const zipPath = await download.path();
  if (!zipPath) throw new Error('download did not produce a file on disk');

  const zip = await JSZip.loadAsync(readFileSync(zipPath));
  const names = Object.keys(zip.files).filter((n) => !n.endsWith('/'));

  for (const model of EXPECTED_MODELS) expect(names).toContain(`${model}.chain`);
  expect(names.filter((n) => n.endsWith('.chain'))).toHaveLength(EXPECTED_MODELS.length);
  expect(names).toContain('_summary.txt');
  expect(names).not.toContain('Model.chain');

  const summary = await zip.file('_summary.txt')!.async('string');
  expect(summary).toContain('2 total · 2 succeeded · 0 failed');
  for (const model of EXPECTED_MODELS) expect(summary).toContain(`${model}.chain`);

  expect(runSessionId, 'backend should have returned a session id').toBeTruthy();
});
