# PC-1101 `.chain` Importer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import an existing `.chain` file into an editable React Flow graph, client-side: map the cleanly-invertible commands to real nodes, placeholder the rest (raw XML preserved), synthesize a foreach + chain-output scaffold, lay out, and report honestly.

**Architecture:** Three pure-ish TS units — `chainCommandMap.ts` (the inverse map, one entry per clean command), `chainImport.ts` (`parseChainXml` via `DOMParser` + `chainToGraph`), and a `ChainImportReport` UI — wired into `page.tsx` by extending the existing template-import flow (`handleImportFile` → `applySnapshot`). Reuses `nodeSchemas` (defaults) and `autoLayout` (dagre). No backend change.

**Tech Stack:** TypeScript, React 19, `@xyflow/react`, `DOMParser` (jsdom in vitest), `dagre` (via existing `autoLayout`), vitest.

**Spec:** `docs/superpowers/specs/2026-06-03-pc1101-chain-importer-design.md`
**Forward-map reference (the extraction):** the Coverage table in the spec is the authoritative inverse map for the 6 v1 commands.

---

## Scope (v1) — recap

Map cleanly: `cleanModel` (`Clean_model`), `createView` (`Create_view`), `addModelToView` (`Add_model_to_view`),
`removeModelFromView` (`Remove_model_from_view`), `addComment` (`Comment`), and `addLabel` (`Label`,
standalone only). Everything else → `stickyNote` placeholder with raw XML + report. The `.chain` XML uses a
default namespace (`xmlns="http://www.12d.com/schema/xml12d-10.0"`), so **all element matching is by
`localName`**, never `tagName`/`querySelector('Name')`.

## Handle IDs / scaffold shapes (verified against `nodeSchemas.ts`)

- `foreachModel`: in `flow:input`, out `flow:output`; data `{ collection: '' }`.
- command nodes: in `flow:input`, out `flow:output`.
- `chainFileOutput`: in `flow:input`, out none; data `{ modelName: '', projectFolder: '', modelType: 'Model' }`.
- Edge shape: `{ id, source, target, sourceHandle, targetHandle }` (React Flow `Connection` fields).
- Node shape: `{ id, type, position: {x,y}, data }` (`autoLayout` reassigns `position`).

## File structure

- **Create** `frontend/lib/workflow/chainCommandMap.ts` — `CHAIN_COMMAND_MAP` keyed by root `localName`, each `{ nodeType, toData(el) }`; small parse helpers.
- **Create** `frontend/lib/workflow/__tests__/chainCommandMap.test.ts`.
- **Create** `frontend/lib/workflow/chainImport.ts` — `parseChainXml`, `chainToGraph`, the report/result types.
- **Create** `frontend/lib/workflow/__tests__/chainImport.test.ts`.
- **Create** `frontend/lib/workflow/__tests__/fixtures/` — committed `.chain` fixtures (generated + hand-authored-trimmed).
- **Create** `frontend/components/workflow/ChainImportReport.tsx` — the summary modal.
- **Modify** `frontend/app/page.tsx` — `handleImportChain`, sniff `.chain` in `handleImportFile`, extend the file input `accept`.
- **Modify** `frontend/e2e/golden-path.spec.ts` sibling — `frontend/e2e/chain-import.spec.ts` (optional browser check).

---

## Task 1: `chainCommandMap.ts` — parse helpers (TDD)

**Files:** Create `frontend/lib/workflow/chainCommandMap.ts`; Test `frontend/lib/workflow/__tests__/chainCommandMap.test.ts`.

- [ ] **Step 1: Write failing tests for the helpers**

```ts
// chainCommandMap.test.ts
import { describe, it, expect } from 'vitest';
import { childTextByLocalName, parseChainBool } from '../chainCommandMap';

function el(xml: string): Element {
  // jsdom DOMParser. Namespace mirrors a real .chain so localName matching is exercised.
  const doc = new DOMParser().parseFromString(
    `<root xmlns="http://www.12d.com/schema/xml12d-10.0">${xml}</root>`,
    'application/xml',
  );
  return doc.documentElement;
}

describe('childTextByLocalName', () => {
  it('returns the trimmed text of the first direct child with that localName', () => {
    expect(childTextByLocalName(el('<Name>  hi  </Name>'), 'Name')).toBe('hi');
  });
  it('ignores nested (non-direct) descendants of the same name', () => {
    const e = el('<Panel><Name>inner</Name></Panel><Name>outer</Name>');
    expect(childTextByLocalName(e, 'Name')).toBe('outer'); // only direct children
  });
  it('returns undefined when absent', () => {
    expect(childTextByLocalName(el('<Other>x</Other>'), 'Name')).toBeUndefined();
  });
});

describe('parseChainBool', () => {
  it("'true' -> true", () => expect(parseChainBool('true')).toBe(true));
  it("'false' -> false", () => expect(parseChainBool('false')).toBe(false));
  it('defaults missing/odd to true', () => {
    expect(parseChainBool(undefined)).toBe(true);
    expect(parseChainBool('')).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd frontend && npx vitest run lib/workflow/__tests__/chainCommandMap.test.ts`
Expected: FAIL — module/exports not found.

- [ ] **Step 3: Implement the helpers**

```ts
// chainCommandMap.ts (top)
/** First DIRECT child element matching localName (namespace-agnostic), trimmed text. */
export function childTextByLocalName(el: Element, localName: string): string | undefined {
  for (const child of Array.from(el.children)) {
    if (child.localName === localName) return (child.textContent ?? '').trim();
  }
  return undefined;
}

/** 12d emits booleans as the strings 'true'/'false'. Anything else defaults to true (the node default). */
export function parseChainBool(s: string | undefined): boolean {
  const v = (s ?? '').trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return true;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd frontend && npx vitest run lib/workflow/__tests__/chainCommandMap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/workflow/chainCommandMap.ts frontend/lib/workflow/__tests__/chainCommandMap.test.ts
git commit -m "feat(PC-1101): chain command-map parse helpers"
```

---

## Task 2: `chainCommandMap.ts` — the inverse map (TDD)

**Files:** Modify `frontend/lib/workflow/chainCommandMap.ts`; extend the test.

- [ ] **Step 1: Write failing tests (one per clean command)**

```ts
// append to chainCommandMap.test.ts
import { CHAIN_COMMAND_MAP } from '../chainCommandMap';

function cmd(xml: string): Element {
  const doc = new DOMParser().parseFromString(
    `<root xmlns="http://www.12d.com/schema/xml12d-10.0">${xml}</root>`, 'application/xml');
  return doc.documentElement.children[0];
}

describe('CHAIN_COMMAND_MAP', () => {
  it('Clean_model -> cleanModel with params', () => {
    const m = CHAIN_COMMAND_MAP['Clean_model'];
    expect(m.nodeType).toBe('cleanModel');
    expect(m.toData(cmd(
      '<Clean_model><Name>Clean model X</Name><Continue_on_failure>false</Continue_on_failure>' +
      '<Comments>c</Comments><Model_Name>RoadA</Model_Name></Clean_model>'))).toEqual({
        commandName: 'Clean model X', modelName: 'RoadA', comments: 'c', continueOnFailure: false });
  });

  it('Create_view -> createView reassembles the coordinate 4-tuple', () => {
    const m = CHAIN_COMMAND_MAP['Create_view'];
    expect(m.nodeType).toBe('createView');
    expect(m.toData(cmd(
      '<Create_view><View>Plan</View><Continue_on_failure>true</Continue_on_failure><Comments></Comments>' +
      '<Top>40</Top><Left>30</Left><Bot>565</Bot><Right>715</Right></Create_view>'))).toEqual({
        modifiedVariable: 'Plan', coordinates: [40, 30, 565, 715], comments: '', continueOnFailure: true });
  });

  it('Add_model_to_view -> addModelToView', () => {
    expect(CHAIN_COMMAND_MAP['Add_model_to_view'].toData(cmd(
      '<Add_model_to_view><Model>RoadA</Model><View>Plan</View>' +
      '<Continue_on_failure>true</Continue_on_failure><Comments></Comments></Add_model_to_view>'))).toEqual({
        modelName: 'RoadA', viewName: 'Plan', comments: '', continueOnFailure: true });
  });

  it('Remove_model_from_view -> removeModelFromView (Model is the pattern)', () => {
    expect(CHAIN_COMMAND_MAP['Remove_model_from_view'].toData(cmd(
      '<Remove_model_from_view><Model>*tin</Model><View>Plan</View>' +
      '<Continue_on_failure>true</Continue_on_failure><Comments></Comments></Remove_model_from_view>'))).toEqual({
        pattern: '*tin', modifiedVariable: 'Plan', comments: '', continueOnFailure: true });
  });

  it('Comment -> addComment', () => {
    expect(CHAIN_COMMAND_MAP['Comment'].toData(cmd(
      '<Comment><Name>note</Name><Continue_on_failure>true</Continue_on_failure><Comments>hi</Comments></Comment>'))).toEqual({
        commentName: 'note', comments: 'hi', continueOnFailure: true });
  });

  it('Label -> addLabel', () => {
    expect(CHAIN_COMMAND_MAP['Label'].toData(cmd(
      '<Label><Name>L1</Name><Continue_on_failure>true</Continue_on_failure><Comments></Comments></Label>'))).toEqual({
        labelName: 'L1', comments: '', continueOnFailure: true });
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd frontend && npx vitest run lib/workflow/__tests__/chainCommandMap.test.ts`
Expected: FAIL — `CHAIN_COMMAND_MAP` undefined.

- [ ] **Step 3: Implement the map**

```ts
// chainCommandMap.ts (append)
export interface CommandMapping {
  nodeType: string;
  toData: (el: Element) => Record<string, unknown>;
}

const t = childTextByLocalName;
const b = (el: Element) => parseChainBool(t(el, 'Continue_on_failure'));
const comments = (el: Element) => t(el, 'Comments') ?? '';

/** Keyed by the command element's localName. Only cleanly-invertible commands (PC-1101 v1). */
export const CHAIN_COMMAND_MAP: Record<string, CommandMapping> = {
  Clean_model: {
    nodeType: 'cleanModel',
    toData: (el) => ({
      commandName: t(el, 'Name'), modelName: t(el, 'Model_Name'),
      comments: comments(el), continueOnFailure: b(el),
    }),
  },
  Create_view: {
    nodeType: 'createView',
    toData: (el) => ({
      modifiedVariable: t(el, 'View'),
      coordinates: ['Top', 'Left', 'Bot', 'Right'].map((k) => Number(t(el, k))),
      comments: comments(el), continueOnFailure: b(el),
    }),
  },
  Add_model_to_view: {
    nodeType: 'addModelToView',
    toData: (el) => ({
      modelName: t(el, 'Model'), viewName: t(el, 'View'),
      comments: comments(el), continueOnFailure: b(el),
    }),
  },
  Remove_model_from_view: {
    nodeType: 'removeModelFromView',
    toData: (el) => ({
      pattern: t(el, 'Model'), modifiedVariable: t(el, 'View'),
      comments: comments(el), continueOnFailure: b(el),
    }),
  },
  Comment: {
    nodeType: 'addComment',
    toData: (el) => ({ commentName: t(el, 'Name'), comments: comments(el), continueOnFailure: b(el) }),
  },
  Label: {
    nodeType: 'addLabel',
    toData: (el) => ({ labelName: t(el, 'Name'), comments: comments(el), continueOnFailure: b(el) }),
  },
};
```

- [ ] **Step 4: Run, verify pass**

Run: `cd frontend && npx vitest run lib/workflow/__tests__/chainCommandMap.test.ts`
Expected: PASS (all command cases).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/workflow/chainCommandMap.ts frontend/lib/workflow/__tests__/chainCommandMap.test.ts
git commit -m "feat(PC-1101): inverse map for the 6 cleanly-invertible commands"
```

---

## Task 3: `parseChainXml` (TDD)

**Files:** Create `frontend/lib/workflow/chainImport.ts`; Test `frontend/lib/workflow/__tests__/chainImport.test.ts`.

- [ ] **Step 1: Write failing tests**

```ts
// chainImport.test.ts
import { describe, it, expect } from 'vitest';
import { parseChainXml } from '../chainImport';

const wrap = (commands: string) =>
  `<?xml version="1.0"?><xml12d xmlns="http://www.12d.com/schema/xml12d-10.0">` +
  `<meta_data></meta_data><Chain><version>1</version><Settings></Settings>` +
  `<Commands>${commands}</Commands></Chain></xml12d>`;

describe('parseChainXml', () => {
  it('returns the ordered command elements (by localName) under <Commands>', () => {
    const r = parseChainXml(wrap('<Clean_model></Clean_model><Create_view></Create_view>'));
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.commands.map((c) => c.localName)).toEqual(['Clean_model', 'Create_view']);
  });
  it('flags malformed XML', () => {
    const r = parseChainXml('<xml12d><Commands><broken></Commands>');
    expect('error' in r).toBe(true);
  });
  it('flags non-chain XML (no <Commands>)', () => {
    const r = parseChainXml('<?xml version="1.0"?><notachain><x/></notachain>');
    expect('error' in r && /chain/i.test(r.error)).toBe(true);
  });
  it('empty <Commands> yields zero commands (not an error)', () => {
    const r = parseChainXml(wrap(''));
    expect('error' in r).toBe(false);
    if (!('error' in r)) expect(r.commands).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run, verify fail.** Run: `cd frontend && npx vitest run lib/workflow/__tests__/chainImport.test.ts` → FAIL.

- [ ] **Step 3: Implement `parseChainXml`**

```ts
// chainImport.ts
export interface ParsedChain { commands: Element[]; }
export interface ParseError { error: string; }

function firstByLocalName(root: ParentNode, localName: string): Element | null {
  const all = (root as Element | Document).getElementsByTagName('*');
  for (const e of Array.from(all)) if (e.localName === localName) return e;
  return null;
}

export function parseChainXml(text: string): ParsedChain | ParseError {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  // Browsers + jsdom signal a parse failure with a <parsererror> element in the result.
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return { error: "Couldn't parse the file as XML. Is it a valid .chain file?" };
  }
  const commandsEl = firstByLocalName(doc, 'Commands');
  if (!commandsEl) {
    return { error: "This doesn't look like a 12d .chain file (no <Commands> section)." };
  }
  // Direct element children, in document order.
  const commands = Array.from(commandsEl.children);
  return { commands };
}
```

- [ ] **Step 4: Run, verify pass.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/workflow/chainImport.ts frontend/lib/workflow/__tests__/chainImport.test.ts
git commit -m "feat(PC-1101): parseChainXml (DOMParser, namespace-agnostic, error paths)"
```

---

## Task 4: `chainToGraph` (TDD)

**Files:** Modify `frontend/lib/workflow/chainImport.ts`; extend the test.

Behavior:
- Each command → a node: if its `localName` is in `CHAIN_COMMAND_MAP` → real node (`addLabel` only if the
  `Label` is **standalone**, see `isGroupLeaderLabel`); else → `stickyNote` placeholder holding the raw XML.
- Synthesize `foreachModel` (`imported-foreach`) and `chainFileOutput` (`imported-output`).
- Flow edges: `foreach.flow:output → cmd0.flow:input`, `cmd_i.flow:output → cmd_{i+1}.flow:input`,
  `cmd_last.flow:output → output.flow:input`. (If zero commands: `foreach → output` directly.)
- Lay out with `autoLayout`.
- Report `{ total, mapped, placeholders: [{element,count}], modelSourceMissing: true }`.

- [ ] **Step 1: Write failing tests**

```ts
// append to chainImport.test.ts
import { chainToGraph } from '../chainImport';

function graphFor(commands: string) {
  const parsed = parseChainXml(wrap(commands));
  if ('error' in parsed) throw new Error(parsed.error);
  return chainToGraph(parsed);
}

describe('chainToGraph', () => {
  it('maps known commands to real nodes and synthesizes the foreach+output scaffold', () => {
    const g = graphFor(
      '<Clean_model><Name>n</Name><Model_Name>m</Model_Name><Comments></Comments>' +
      '<Continue_on_failure>true</Continue_on_failure></Clean_model>');
    const types = g.nodes.map((n) => n.type).sort();
    expect(types).toEqual(['chainFileOutput', 'cleanModel', 'foreachModel'].sort());
    expect(g.report).toMatchObject({ total: 1, mapped: 1, placeholders: [], modelSourceMissing: true });
  });

  it('wires flow edges in document order: foreach -> cmd0 -> cmd1 -> output', () => {
    const g = graphFor(
      '<Clean_model></Clean_model><Add_model_to_view></Add_model_to_view>');
    const ids = g.nodes.filter((n) => n.type !== 'foreachModel' && n.type !== 'chainFileOutput').map((n) => n.id);
    // 4 edges for 2 commands: foreach->c0, c0->c1, c1->output
    expect(g.edges).toHaveLength(3);
    expect(g.edges.every((e) => e.sourceHandle === 'flow:output' && e.targetHandle === 'flow:input')).toBe(true);
    expect(g.edges[0].source).toBe('imported-foreach');
    expect(g.edges[g.edges.length - 1].target).toBe('imported-output');
  });

  it('unknown command -> stickyNote placeholder preserving raw XML; counted in report', () => {
    const g = graphFor('<Manual_option><Name>panel thing</Name></Manual_option>');
    const sticky = g.nodes.find((n) => n.type === 'stickyNote');
    expect(sticky).toBeTruthy();
    expect(String((sticky!.data as any).text)).toContain('Manual_option');
    expect(g.report).toMatchObject({ total: 1, mapped: 0, placeholders: [{ element: 'Manual_option', count: 1 }] });
  });

  it('a group-leader <Label> (followed by <Function>) is a placeholder, not addLabel', () => {
    const g = graphFor('<Label><Name>run tin function</Name></Label><Function></Function>');
    expect(g.nodes.some((n) => n.type === 'addLabel')).toBe(false);
    expect(g.nodes.filter((n) => n.type === 'stickyNote')).toHaveLength(2);
  });

  it('a standalone <Label> maps to addLabel', () => {
    const g = graphFor('<Label><Name>L1</Name><Comments></Comments><Continue_on_failure>true</Continue_on_failure></Label>');
    expect(g.nodes.some((n) => n.type === 'addLabel')).toBe(true);
  });

  it('zero commands -> foreach wired straight to output, mapped 0', () => {
    const g = graphFor('');
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]).toMatchObject({ source: 'imported-foreach', target: 'imported-output' });
    expect(g.report).toMatchObject({ total: 0, mapped: 0 });
  });
});
```

- [ ] **Step 2: Run, verify fail.** → FAIL (`chainToGraph` undefined).

- [ ] **Step 3: Implement `chainToGraph`**

```ts
// chainImport.ts (append)
import type { WorkflowNode, WorkflowEdge } from './types';
import { CHAIN_COMMAND_MAP } from './chainCommandMap';
import { nodeSchemas } from './nodeSchemas';
import { autoLayout } from './autoLayout';

export interface ChainImportReport {
  total: number;
  mapped: number;
  placeholders: { element: string; count: number }[];
  modelSourceMissing: boolean;
}
export interface ImportedGraph { nodes: WorkflowNode[]; edges: WorkflowEdge[]; report: ChainImportReport; }

const FOREACH_ID = 'imported-foreach';
const OUTPUT_ID = 'imported-output';
const GROUP_FOLLOWERS = new Set(['Function', 'Manual_option']); // a <Label> before one of these leads a group

function schemaDefaults(nodeType: string): Record<string, unknown> {
  const schema = (nodeSchemas as Record<string, { parameters: { key: string; defaultValue: unknown }[] }>)[nodeType];
  const out: Record<string, unknown> = {};
  for (const p of schema?.parameters ?? []) out[p.key] = p.defaultValue;
  return out;
}

function newNode(id: string, type: string, data: Record<string, unknown>): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data } as WorkflowNode;
}

function flowEdge(source: string, target: string): WorkflowEdge {
  return {
    id: `e-${source}-${target}`, source, target,
    sourceHandle: 'flow:output', targetHandle: 'flow:input',
  } as WorkflowEdge;
}

export function chainToGraph(parsed: ParsedChain): ImportedGraph {
  const cmdNodes: WorkflowNode[] = [];
  const placeholderCounts = new Map<string, number>();
  let mapped = 0;

  parsed.commands.forEach((el, i) => {
    const name = el.localName;
    const mapping = CHAIN_COMMAND_MAP[name];
    const isStandaloneLabel =
      name === 'Label' && !GROUP_FOLLOWERS.has(parsed.commands[i + 1]?.localName ?? '');
    const id = `imported-${i}`;

    if (mapping && (name !== 'Label' || isStandaloneLabel)) {
      const data = { ...schemaDefaults(mapping.nodeType), ...mapping.toData(el) };
      // Use the command's <Name> as a readable node label when present.
      const label = (data as Record<string, unknown>).commandName ?? (data as Record<string, unknown>).labelName;
      cmdNodes.push(newNode(id, mapping.nodeType, { ...data, ...(label ? { label } : {}) }));
      mapped += 1;
    } else {
      placeholderCounts.set(name, (placeholderCounts.get(name) ?? 0) + 1);
      const raw = new XMLSerializer().serializeToString(el);
      cmdNodes.push(newNode(id, 'stickyNote', {
        text: `[Unmapped 12d command: ${name}]\n\n${raw.slice(0, 1200)}`,
      }));
    }
  });

  const foreach = newNode(FOREACH_ID, 'foreachModel', { collection: '' });
  const output = newNode(OUTPUT_ID, 'chainFileOutput', { modelName: '', projectFolder: '', modelType: 'Model' });

  const ordered = [foreach, ...cmdNodes, output];
  const edges: WorkflowEdge[] = [];
  for (let i = 0; i < ordered.length - 1; i++) edges.push(flowEdge(ordered[i].id, ordered[i + 1].id));

  const laidOut = autoLayout(ordered, edges);

  return {
    nodes: laidOut,
    edges,
    report: {
      total: parsed.commands.length,
      mapped,
      placeholders: [...placeholderCounts.entries()].map(([element, count]) => ({ element, count })),
      modelSourceMissing: true,
    },
  };
}
```

- [ ] **Step 4: Run, verify pass.** Expected: PASS. If `stickyNote` placeholders are routed through the flow
  chain (they are), the group-leader-Label test sees 2 stickyNotes (Label + Function). Confirm.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/workflow/chainImport.ts frontend/lib/workflow/__tests__/chainImport.test.ts
git commit -m "feat(PC-1101): chainToGraph (map/placeholder, scaffold, flow edges, layout, report)"
```

---

## Task 5: Round-trip golden fixtures (TDD)

**Files:** Create `frontend/lib/workflow/__tests__/fixtures/clean-view.chain` (+ 1 hand-authored trimmed fixture); extend `chainImport.test.ts`.

- [ ] **Step 1: Generate a real chain fixture from the Python generators**

Run (from `backend/`, system python):
```bash
python -c "from commands.models import clean_model_command; from commands.views import create_view_command, add_model_to_view_command; lines=['<?xml version=\"1.0\"?>','<xml12d xmlns=\"http://www.12d.com/schema/xml12d-10.0\">','<meta_data></meta_data>','<Chain><version>1</version><Settings></Settings><Commands>']; lines+=clean_model_command('Clean model Alpha','Alpha','',True); lines+=create_view_command('Alpha View',(40,30,565,715),True,''); lines+=add_model_to_view_command('Alpha','Alpha View',True,''); lines+=['</Commands></Chain></xml12d>']; open(r'../frontend/lib/workflow/__tests__/fixtures/clean-view.chain','w').write('\n'.join(lines))"
```
This writes a real chain built by the actual generators (3 clean commands). Verify the file exists and
contains `<Clean_model>`, `<Create_view>`, `<Add_model_to_view>`.

- [ ] **Step 2: Write the failing round-trip test**

```ts
// append to chainImport.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8');

describe('round-trip golden fixture', () => {
  it('imports a generator-produced chain into the expected clean nodes', () => {
    const parsed = parseChainXml(fixture('clean-view.chain'));
    if ('error' in parsed) throw new Error(parsed.error);
    const g = chainToGraph(parsed);
    const real = g.nodes.filter((n) => !['foreachModel', 'chainFileOutput'].includes(n.type as string));
    expect(real.map((n) => n.type)).toEqual(['cleanModel', 'createView', 'addModelToView']);
    expect(g.report).toMatchObject({ total: 3, mapped: 3, placeholders: [] });
    const clean = real[0].data as Record<string, unknown>;
    expect(clean.modelName).toBe('Alpha');
    const view = real[1].data as Record<string, unknown>;
    expect(view.modifiedVariable).toBe('Alpha View');
    expect(view.coordinates).toEqual([40, 30, 565, 715]);
  });
});
```

- [ ] **Step 3: Run.** Expected: PASS (proves the TS inverse map matches the Python forward map). If it fails,
  the mismatch is a real parity bug — fix `chainCommandMap.ts`, not the test.

- [ ] **Step 4: Add a hand-authored placeholder fixture**

Create `frontend/lib/workflow/__tests__/fixtures/handauthored.chain` containing a `<Commands>` with one
`<Remove_model_from_view>` (mapped) and one `<Manual_option><Name>Global Model Rename</Name></Manual_option>`
(placeholder). Add a test asserting `mapped: 1` and `placeholders: [{ element: 'Manual_option', count: 1 }]`.

```ts
it('hand-authored chain: maps the known command, placeholders the panel command', () => {
  const parsed = parseChainXml(fixture('handauthored.chain'));
  if ('error' in parsed) throw new Error(parsed.error);
  const g = chainToGraph(parsed);
  expect(g.report).toMatchObject({ total: 2, mapped: 1, placeholders: [{ element: 'Manual_option', count: 1 }] });
});
```

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/workflow/__tests__/fixtures frontend/lib/workflow/__tests__/chainImport.test.ts
git commit -m "test(PC-1101): round-trip golden fixture + hand-authored placeholder fixture"
```

---

## Task 6: `ChainImportReport` component

**Files:** Create `frontend/components/workflow/ChainImportReport.tsx`.

- [ ] **Step 1: Implement (no unit test — RTL absent; verified via build + e2e)**

```tsx
'use client';
import React from 'react';
import { FileInput, X } from 'lucide-react';
import type { ChainImportReport as Report } from '@/lib/workflow/chainImport';

interface Props { report: Report; fileName: string; onClose: () => void; }

export function ChainImportReport({ report, fileName, onClose }: Props) {
  const placeholderTotal = report.placeholders.reduce((s, p) => s + p.count, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <FileInput className="w-5 h-5 text-emerald-500" /> Imported {fileName}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Reconstructed <strong>{report.mapped}</strong> of <strong>{report.total}</strong> commands as nodes.
        </p>
        {placeholderTotal > 0 && (
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            <p>{placeholderTotal} command{placeholderTotal === 1 ? '' : 's'} couldn’t be mapped and were kept as
              sticky-note placeholders (raw XML preserved):</p>
            <ul className="mt-1 list-disc pl-5">
              {report.placeholders.map((p) => (
                <li key={p.element}><code>{p.element}</code> ×{p.count}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          Values are this chain’s resolved literals. Attach a model source (Excel/Model&nbsp;List) and
          re-introduce variables to re-template.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck.** Run: `cd frontend && npx tsc --noEmit` → PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/workflow/ChainImportReport.tsx
git commit -m "feat(PC-1101): ChainImportReport summary modal"
```

---

## Task 7: Wire into `page.tsx`

**Files:** Modify `frontend/app/page.tsx`.

- [ ] **Step 1: Imports + state**

Add imports:
```tsx
import { parseChainXml, chainToGraph, type ChainImportReport as ChainReport } from '@/lib/workflow/chainImport';
import { ChainImportReport } from '@/components/workflow/ChainImportReport';
```
Add state (near the other modal states):
```tsx
const [chainReport, setChainReport] = useState<{ report: ChainReport; fileName: string } | null>(null);
```

- [ ] **Step 2: Add `handleImportChain`** (place next to `handleImportFile`)

```tsx
const handleImportChain = useCallback(
  (text: string, fileName: string) => {
    const parsed = parseChainXml(text);
    if ('error' in parsed) {
      notify.error("Couldn't import chain", { description: parsed.error });
      return;
    }
    const { nodes: importedNodes, edges: importedEdges, report } = chainToGraph(parsed);
    applySnapshot({ nodes: importedNodes, edges: importedEdges });
    setLoadedTemplate(null);
    setChainReport({ report, fileName });
  },
  [applySnapshot],
);
```

- [ ] **Step 3: Sniff `.chain` in `handleImportFile`**

In `handleImportFile`'s `reader.onload`, before `importTemplate(json)`, branch:
```tsx
const text = event.target?.result as string;
const isChain = file.name.toLowerCase().endsWith('.chain') || /<xml12d[\s>]/.test(text.slice(0, 500));
if (isChain) { handleImportChain(text, file.name); return; }
const json = text; // existing template path continues unchanged
```
Add `handleImportChain` to the `useCallback` dependency array.

- [ ] **Step 4: Extend the file input `accept`**

Change the hidden import input from `accept=".json"` to `accept=".json,.chain"`.

- [ ] **Step 5: Render the report modal** (near the other modals in the JSX)

```tsx
{chainReport && (
  <ChainImportReport
    report={chainReport.report}
    fileName={chainReport.fileName}
    onClose={() => setChainReport(null)}
  />
)}
```

- [ ] **Step 6: Verify**

Run: `cd frontend && npx tsc --noEmit && npx vitest run && npm run lint && npm run build`
Expected: all PASS; vitest = prior + new chain tests.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat(PC-1101): wire .chain import into the Import flow + report modal"
```

---

## Task 8: E2E (optional but recommended — browser-level confidence)

**Files:** Create `frontend/e2e/chain-import.spec.ts`; commit a small `frontend/e2e/fixtures/sample.chain`.

- [ ] **Step 1: Spec** — seed `pychain_tour_completed`, go to editor, set the hidden `#…` import input to
  `sample.chain` (a 2-command clean chain), assert the canvas shows the reconstructed nodes (e.g. a
  `cleanModel` node label is visible) and the report modal text "Reconstructed 2 of 2".

```ts
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __dir = dirname(fileURLToPath(import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('pychain_tour_completed', '1'));
});

test('import a .chain reconstructs nodes + shows the report', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get Started' }).click();
  // The Import button triggers a hidden file input (accept=".json,.chain").
  await page.setInputFiles('input[type="file"][accept*=".chain"]', join(__dir, 'fixtures', 'sample.chain'));
  await expect(page.getByText(/Reconstructed\s+2\s+of\s+2/)).toBeVisible();
});
```

- [ ] **Step 2: Run.** Run: `cd frontend && npm run e2e -- chain-import.spec.ts` → PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/chain-import.spec.ts frontend/e2e/fixtures/sample.chain
git commit -m "test(PC-1101): Playwright .chain import e2e"
```

---

## Task 9: Final verification + roadmap

- [ ] **Step 1: Full gate** (from `frontend/`): `npx tsc --noEmit && npm run lint && npx vitest run && npm run build && npm run e2e`. All PASS.
- [ ] **Step 2: Backend sanity** (from repo root): `python -m pytest backend/tests/ -q` — unchanged baseline (no backend files touched).
- [ ] **Step 3: Mark PC-1101 ✅** in `ROADMAP.md` with a rationale (client-side importer, 6 clean commands mapped, placeholders for the rest, honest report, round-trip golden fixtures; note the narrowed scope finding and the fast-follow).
- [ ] **Step 4: Commit** `docs(PC-1101): mark complete`.
- [ ] **Step 5: Merge + push**: `git checkout main && git merge --no-ff feat/pc-1101-chain-importer -m "merge(PC-1101): .chain importer" && git push origin main`.

---

## Self-review notes

- **Spec coverage:** parse (Task 3) / map (Tasks 1-2) / graph reconstruct + placeholders + scaffold + layout +
  report (Task 4) / round-trip + hand-authored fixtures (Task 5) / report UI (Task 6) / wire-up + sniff +
  accept (Task 7) / e2e (Task 8). The lossiness + "no fragile guessing" scope is enforced by `CHAIN_COMMAND_MAP`
  containing only the 6 clean commands + the standalone-`Label` guard.
- **Type consistency:** `ParsedChain`/`ParseError` (Task 3) consumed by `chainToGraph` (Task 4) and `page.tsx`
  (Task 7); `ChainImportReport` type (Task 4) consumed by the component (Task 6) and page state (Task 7);
  handle ids (`flow:input`/`flow:output`) and node ids (`imported-foreach`/`imported-output`/`imported-${i}`)
  consistent across Task 4 and its tests.
- **Placeholder scan:** none — every step has concrete code or an exact command.
- **Namespace gotcha** (matching by `localName`, not `querySelector`) is encoded in Task 1's helper and Task 3's
  `firstByLocalName`, and exercised by the namespaced test fixtures.
