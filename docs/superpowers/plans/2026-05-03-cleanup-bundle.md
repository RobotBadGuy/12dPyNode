# Cleanup Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship five small roadmap items as one PR — TTL scheduled GC (PC-204), edge-type validation at draw time (PC-305), CORS tightening (PC-805), README rot fixes (PC-602), and start-script removal (PC-604).

**Architecture:** Five independent slices: a backend asyncio periodic task that wraps the existing one-shot startup sweep; a pure-function frontend validator wired into React Flow's `isValidConnection` prop; explicit CORS allowlists replacing wildcards; targeted README edits; a verification that legacy start scripts are gone.

**Tech Stack:** FastAPI (Python 3.11/3.12), pytest, Next.js 15 / React Flow (`@xyflow/react`), TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-05-03-cleanup-bundle-design.md`

**Pre-flight verification (already confirmed by spec author, but run again if uncertain):**
- `backend/main.py` lifespan sweep block lives at lines 65–100 (you'll move this).
- `backend/main.py` CORSMiddleware lives at lines 119–126.
- `frontend/components/workflow/WorkspaceCanvas.tsx` `<ReactFlow>` element starts at line 132.
- Test pattern: `frontend/lib/workflow/__tests__/compile.test.ts` uses `describe`/`it`/`expect` from vitest with helper `makeNode`/`makeEdge` factories. Match this style.
- Frontend test command: `npm run test` from `frontend/`. Backend: `python -m pytest tests/ -v` from `backend/`.

---

## Task 1: PC-604 — Verify start scripts are gone

**Files:**
- Inspect: `start.sh`, `start.bat` at repo root

The spec called for deleting `start.sh` and `start.bat`. They don't exist anymore — confirm and move on. Nothing to commit for this task.

- [ ] **Step 1: Verify both files are absent**

Run from repo root:

```bash
ls start.sh start.bat 2>&1
```

Expected output: two "No such file or directory" lines. If either file exists, delete it with `git rm start.sh start.bat 2>/dev/null || rm -f start.sh start.bat` and commit with message `chore(PC-604): remove redundant start scripts` then continue.

- [ ] **Step 2: Note in commit message of next task**

If both were already absent, no commit is needed for PC-604. The completion will be noted in the umbrella PR description.

---

## Task 2: PC-602 — Fix README rot

**Files:**
- Modify: `README.md` (path strings, legacy API section, templates-storage claim, cleanup wording)

The spec scopes this tightly: "any specifically-broken command snippet gets a one-line fix." Four broken snippets to fix. Do not rewrite layout, expand coverage, or change tone.

- [ ] **Step 1: Fix wrong directory path (two occurrences)**

Edit `README.md`:

Change line 71:
```
cd "G:\WebDev\Python Scripts\12dPynode\backend"
```
to:
```
cd "G:\WebDev\Python Projects\12dPynode\backend"
```

Change line 109:
```
cd "G:\WebDev\Python Scripts\12dPynode\frontend"
```
to:
```
cd "G:\WebDev\Python Projects\12dPynode\frontend"
```

- [ ] **Step 2: Remove the Legacy API section**

The endpoints listed there were removed in PC-101. Delete the entire "Legacy API (Still Available)" subsection (lines 213–217 of README.md as currently committed):

```markdown
### Legacy API (Still Available)
- `POST /api/upload` - Upload Excel and DWG/DGN/IFC files
- `POST /api/process` - Start processing with model type mappings
- `GET /api/status/{session_id}` - Get processing status
- `GET /api/download/{session_id}` - Download results as ZIP
```

Replace with: nothing. Just delete those five lines (and the blank line above the header if it leaves a double-blank).

Also rename the heading just above (`### Workflow API (New)`) to `### Workflow API` — the "(New)" qualifier is no longer informative now that there is no "Legacy" sibling.

- [ ] **Step 3: Correct the templates-storage claim**

Templates moved to Supabase in PC-202; the README still says they live in localStorage (lines 178–181 and 298–301 and 308 of the current file).

In the "Saving and Loading Templates" subsection (around line 178), change:
```
- **Save Template**: Click "Save Template" → Enter a name → Template saved to browser localStorage
```
to:
```
- **Save Template**: Click "Save Template" → Enter a name → Template saved to the server
```

In the "Templates not saving/loading" troubleshooting block (around line 298), change:
```
### Templates not saving/loading
- Templates are stored in browser localStorage
- Clear browser data will delete templates
- Use Export/Import to backup templates
```
to:
```
### Templates not saving/loading
- Templates are stored server-side (Supabase) and shared across users
- The backend falls back to in-memory storage if `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are unset — those templates are lost on restart
- Use Export/Import to share templates as JSON files
```

In the trailing "Notes" block (around line 308), change:
```
- Templates are stored in browser localStorage (temporary - DB integration planned)
```
to:
```
- Templates are stored in the `pynode_templates` Supabase table (see `backend/migrations/002_init_templates.sql`)
```

- [ ] **Step 4: Update the cleanup-on-startup line**

This anticipates Task 5 (PC-204) — once that ships, cleanup is periodic, not just at startup. The README mentions this around line 305. Change:
```
- Old files are cleaned up on server startup
```
to:
```
- Old files are cleaned up periodically (see `CLEANUP_TTL_SECONDS` and `CLEANUP_INTERVAL_SECONDS`)
```

- [ ] **Step 5: Verify the README still renders cleanly**

Run from repo root:

```bash
git diff --stat README.md
```

Expected: 1 file changed, roughly 5–9 insertions, 8–12 deletions. No new sections added.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs(PC-602): fix README path, drop legacy API section, correct templates storage"
```

---

## Task 3: PC-805 — Tighten CORS

**Files:**
- Modify: `backend/main.py` lines 119–126 (CORSMiddleware kwargs)

Replace wildcard `allow_methods` and `allow_headers` with explicit lists matching the actual API surface.

- [ ] **Step 1: Apply the edit**

In `backend/main.py`, replace:

```python
# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

with:

```python
# Add CORS middleware. Methods/headers are explicit so the API surface is
# documented in code; tighten further with PC-801 when auth lands.
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)
```

- [ ] **Step 2: Smoke-check that the server still imports**

Run from `backend/`:

```bash
python -c "import main; print('OK')"
```

Expected: `OK`. If it errors, re-check the diff — the CORSMiddleware kwargs are the only thing that changed.

- [ ] **Step 3: Run existing backend tests to confirm no regression**

Run from `backend/`:

```bash
python -m pytest tests/ -q --tb=short
```

Expected: all tests pass (177 currently). No new tests for this task — CORS config is correctness-checked at runtime.

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "chore(PC-805): replace wildcard CORS allow_methods/headers with explicit lists"
```

---

## Task 4: PC-305 — Edge-type validation at draw time (TDD)

This is the only feature task with new logic. We follow TDD — write the failing test first, then the implementation.

### Task 4a: Write the failing test

**Files:**
- Create: `frontend/lib/workflow/__tests__/edgeRules.test.ts`

- [ ] **Step 1: Create the test file with a full prefix-matrix table**

Create `frontend/lib/workflow/__tests__/edgeRules.test.ts` with this content (matches the `compile.test.ts` style — vitest `describe`/`it`/`expect`, no setup):

```typescript
import { describe, it, expect } from 'vitest';
import type { Connection } from '@xyflow/react';
import { parseHandlePrefix, validateConnection } from '../edgeRules';

function makeConnection(
  sourceHandle: string | null,
  targetHandle: string | null,
): Connection {
  return {
    source: 'src',
    target: 'tgt',
    sourceHandle,
    targetHandle,
  };
}

describe('parseHandlePrefix', () => {
  it.each([
    ['flow:input', 'flow'],
    ['flow:output', 'flow'],
    ['value:model_name', 'value'],
    ['param:tinName', 'param'],
  ] as const)('extracts %s -> %s', (handle, expected) => {
    expect(parseHandlePrefix(handle)).toBe(expected);
  });

  it.each([
    ['no-prefix', null],
    ['', null],
    [null, null],
    [undefined, null],
  ] as const)('returns null for %s', (handle, expected) => {
    expect(parseHandlePrefix(handle)).toBe(expected);
  });
});

describe('validateConnection', () => {
  // Valid combinations
  it.each([
    ['flow:output', 'flow:input'],
    ['value:model_name', 'param:tinName'],
  ])('allows %s -> %s', (source, target) => {
    expect(validateConnection(makeConnection(source, target))).toBe(true);
  });

  // Invalid combinations
  it.each([
    ['flow:output', 'param:tinName'],
    ['flow:output', 'value:something'],
    ['value:model_name', 'flow:input'],
    ['value:a', 'value:b'],
    ['param:a', 'flow:input'],
    ['param:a', 'param:b'],
    ['param:a', 'value:b'],
  ])('rejects %s -> %s', (source, target) => {
    expect(validateConnection(makeConnection(source, target))).toBe(false);
  });

  // Legacy escape hatch — one or both handles unprefixed
  it('allows when source handle has no prefix', () => {
    expect(validateConnection(makeConnection('legacy', 'flow:input'))).toBe(true);
  });

  it('allows when target handle has no prefix', () => {
    expect(validateConnection(makeConnection('flow:output', 'legacy'))).toBe(true);
  });

  it('allows when both handles are null (legacy graphs)', () => {
    expect(validateConnection(makeConnection(null, null))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run from `frontend/`:

```bash
npm run test
```

Expected: vitest reports `Cannot find module '../edgeRules'` or similar — the implementation file doesn't exist yet. Other test files (`compile.test.ts`) still pass.

### Task 4b: Implement the rules module

**Files:**
- Create: `frontend/lib/workflow/edgeRules.ts`

- [ ] **Step 3: Create the implementation**

Create `frontend/lib/workflow/edgeRules.ts` with this content:

```typescript
import type { Connection } from '@xyflow/react';

/**
 * Handle naming convention: every handle id is `<prefix>:<name>` where prefix is
 * one of `flow` (control-flow edges that drive execution order), `value` (data
 * outputs that feed parameters), or `param` (data inputs on a node). Edges are
 * only valid between matching prefixes — see `validateConnection`.
 *
 * Older graphs may have handles with no prefix; those are accepted unconditionally
 * so we don't break loaded templates.
 */
export type HandlePrefix = 'flow' | 'value' | 'param';

export function parseHandlePrefix(
  handle: string | null | undefined,
): HandlePrefix | null {
  if (!handle) return null;
  const colon = handle.indexOf(':');
  if (colon <= 0) return null;
  const prefix = handle.slice(0, colon);
  if (prefix === 'flow' || prefix === 'value' || prefix === 'param') {
    return prefix;
  }
  return null;
}

export function validateConnection(connection: Connection): boolean {
  const source = parseHandlePrefix(connection.sourceHandle);
  const target = parseHandlePrefix(connection.targetHandle);

  // Legacy escape hatch: if either side is unprefixed, allow it.
  if (source === null || target === null) return true;

  // Param outputs are never legal — params are inputs only.
  if (source === 'param') return false;

  // The two valid pairings:
  if (source === 'flow' && target === 'flow') return true;
  if (source === 'value' && target === 'param') return true;

  console.warn(
    `[edgeRules] rejected connection: ${connection.sourceHandle} -> ${connection.targetHandle}`,
  );
  return false;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run from `frontend/`:

```bash
npm run test
```

Expected: all tests pass. The new `edgeRules.test.ts` should report ~14 cases (4 valid prefixes + 4 null cases + 2 valid + 7 invalid + 3 escape hatch).

### Task 4c: Wire the validator into the canvas

**Files:**
- Modify: `frontend/components/workflow/WorkspaceCanvas.tsx`

- [ ] **Step 5: Import the validator and add the prop**

In `frontend/components/workflow/WorkspaceCanvas.tsx`:

a) Add the import below the existing `WorkflowNode, WorkflowEdge` import (around line 15):

```typescript
import { validateConnection } from '@/lib/workflow/edgeRules';
```

b) Add `isValidConnection={validateConnection}` to the `<ReactFlow ...>` element. The element starts around line 132. Insert the prop right after `onConnect={onConnect}`. The relevant span before:

```tsx
<ReactFlow
  nodes={nodes as Node[]}
  edges={coloredEdges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  onNodeClick={onNodeClick}
```

After:

```tsx
<ReactFlow
  nodes={nodes as Node[]}
  edges={coloredEdges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  isValidConnection={validateConnection}
  onNodeClick={onNodeClick}
```

- [ ] **Step 6: Type-check and re-run tests**

Run from `frontend/`:

```bash
npx tsc --noEmit && npm run test
```

Expected: tsc clean, vitest all green.

- [ ] **Step 7: Run the production build to catch any latent issue**

Run from `frontend/`:

```bash
npm run build
```

Expected: `✓ Compiled successfully` and static-page generation succeeds. (Will take ~20s.)

- [ ] **Step 8: Commit**

```bash
git add frontend/lib/workflow/edgeRules.ts frontend/lib/workflow/__tests__/edgeRules.test.ts frontend/components/workflow/WorkspaceCanvas.tsx
git commit -m "feat(PC-305): reject mismatched edge types at draw time"
```

---

## Task 5: PC-204 — TTL scheduled GC (TDD)

The startup sweep already exists in `lifespan()` at `backend/main.py:65-100`. We extract it to a reusable async function, add a periodic asyncio task, and write a unit test that drives the function directly (the loop itself is not tested).

### Task 5a: Write the failing test

**Files:**
- Create: `backend/tests/test_lifespan_sweep.py`

- [ ] **Step 1: Sketch the function shape we'll implement**

We will export `_sweep_stale_files_and_sessions(now: float | None = None) -> int` from `main.py`. It returns the number of items deleted (files + dirs + session rows) so tests can assert on it. `now` is injectable for deterministic time control.

- [ ] **Step 2: Create the test file**

Create `backend/tests/test_lifespan_sweep.py` with this content:

```python
"""Tests for the PC-204 periodic sweep function."""

from __future__ import annotations

import asyncio
import os
import time
from pathlib import Path
from typing import Any, Dict

import pytest

import main  # imported once at module scope; UPLOAD_DIR/OUTPUT_DIR are
            # monkeypatched per-test to point at tmp_path so we never touch
            # real disk locations.


def _touch(path: Path, age_seconds: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("x")
    mtime = time.time() - age_seconds
    os.utime(path, (mtime, mtime))


@pytest.fixture
def sandbox(monkeypatch, tmp_path):
    """Redirect main's upload/output dirs and TTL into a clean per-test sandbox."""
    upload = tmp_path / "uploads"
    output = tmp_path / "output"
    upload.mkdir()
    output.mkdir()
    monkeypatch.setattr(main, "UPLOAD_DIR", upload)
    monkeypatch.setattr(main, "OUTPUT_DIR", output)
    monkeypatch.setattr(main, "CLEANUP_TTL_SECONDS", 100)
    return upload, output


def test_sweep_deletes_files_older_than_ttl(sandbox):
    upload, _ = sandbox
    old = upload / "old.xlsx"
    fresh = upload / "fresh.xlsx"
    _touch(old, age_seconds=200)   # past TTL
    _touch(fresh, age_seconds=10)  # within TTL

    deleted = asyncio.run(main._sweep_stale_files_and_sessions())

    assert not old.exists()
    assert fresh.exists()
    assert deleted >= 1


def test_sweep_calls_session_store_delete_older_than(sandbox, monkeypatch):
    captured: Dict[str, Any] = {}

    class _StubStore:
        def delete_older_than(self, ttl_seconds: int) -> int:
            captured["ttl"] = ttl_seconds
            return 3

    monkeypatch.setattr(main, "session_store", _StubStore())

    deleted = asyncio.run(main._sweep_stale_files_and_sessions())

    assert captured["ttl"] == 100
    # 3 session rows + however many files (none, in this test) = 3.
    assert deleted == 3


def test_sweep_continues_when_session_store_raises(sandbox, monkeypatch):
    """A flaky session store must not stop the file half from running."""
    upload, _ = sandbox
    old = upload / "old.xlsx"
    _touch(old, age_seconds=200)

    class _BrokenStore:
        def delete_older_than(self, _ttl: int) -> int:
            raise RuntimeError("DB unavailable")

    monkeypatch.setattr(main, "session_store", _BrokenStore())

    deleted = asyncio.run(main._sweep_stale_files_and_sessions())

    assert not old.exists()  # file half still ran
    assert deleted >= 1
```

- [ ] **Step 3: Run the test and confirm it fails**

Run from `backend/`:

```bash
python -m pytest tests/test_lifespan_sweep.py -v --tb=short
```

Expected: tests fail with `AttributeError: module 'main' has no attribute '_sweep_stale_files_and_sessions'`.

### Task 5b: Extract and implement the sweep

**Files:**
- Modify: `backend/main.py` lines 59–105 (lifespan refactor) plus a new env var near line 43

- [ ] **Step 4: Add the new env var constant**

Locate this block in `backend/main.py` (around line 38–43):

```python
import time as _time

# Maximum age (in seconds) for files in uploads/ and output/ before they are
# cleaned up on startup.  Defaults to 1 hour; override via the environment
# variable CLEANUP_TTL_SECONDS.
CLEANUP_TTL_SECONDS = int(os.getenv("CLEANUP_TTL_SECONDS", "3600"))
```

Replace the comment on cleanup behaviour and add the new interval var so the block reads:

```python
import time as _time
import asyncio

# Maximum age (in seconds) for files in uploads/ and output/ and session rows
# before they are cleaned up. Default 1 hour; override via CLEANUP_TTL_SECONDS.
CLEANUP_TTL_SECONDS = int(os.getenv("CLEANUP_TTL_SECONDS", "3600"))

# How often the periodic sweep runs (seconds). Defaults to a quarter of the
# TTL with a 60-second floor — frequent enough to keep the working set bounded
# without thrashing the disk. Override via CLEANUP_INTERVAL_SECONDS.
CLEANUP_INTERVAL_SECONDS = int(
    os.getenv("CLEANUP_INTERVAL_SECONDS", str(max(60, CLEANUP_TTL_SECONDS // 4)))
)
```

(If `import asyncio` already exists at the top of the file, skip the duplicate.)

- [ ] **Step 5: Extract the sweep function**

Above the `lifespan` definition (around line 59), insert this new function:

```python
async def _sweep_stale_files_and_sessions(now: float | None = None) -> int:
    """Delete files/dirs in UPLOAD_DIR + OUTPUT_DIR older than CLEANUP_TTL_SECONDS,
    plus session rows older than the same TTL. Returns the total number of items
    removed. Each half is independently try/except'd so a flaky DB doesn't block
    the disk sweep and vice versa.

    `now` is injectable for tests. Production calls leave it None.
    """
    current = now if now is not None else _time.time()
    removed = 0

    for directory in (UPLOAD_DIR, OUTPUT_DIR):
        for entry in directory.glob("*"):
            try:
                age = current - entry.stat().st_mtime
                if age <= CLEANUP_TTL_SECONDS:
                    continue
                if entry.is_file():
                    entry.unlink()
                    removed += 1
                elif entry.is_dir() and directory == OUTPUT_DIR:
                    import shutil
                    shutil.rmtree(entry, ignore_errors=True)
                    removed += 1
            except Exception as exc:
                logger.warning("Failed to clean up %s: %s", entry, exc)

    try:
        purged = session_store.delete_older_than(CLEANUP_TTL_SECONDS)
        if purged:
            logger.info("Purged %d stale session row(s)", purged)
        removed += purged
    except Exception as exc:
        logger.warning("Failed to purge stale session rows: %s", exc)

    if removed:
        logger.info("Sweep removed %d stale item(s)", removed)
    return removed


async def _periodic_sweep() -> None:
    """Background loop that runs the sweep every CLEANUP_INTERVAL_SECONDS.

    Cancelled by lifespan teardown; CancelledError is swallowed so the task
    exits cleanly during shutdown.
    """
    try:
        while True:
            await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
            try:
                await _sweep_stale_files_and_sessions()
            except Exception:
                logger.exception("Periodic sweep raised — continuing")
    except asyncio.CancelledError:
        logger.info("Periodic sweep stopped")
```

- [ ] **Step 6: Replace the inline sweep in `lifespan` with the function call + scheduler start**

Replace the existing lifespan body (the block from line 60 to roughly line 105 — everything between `async def lifespan(app: FastAPI):` and the trailing `# logger.info("Shutting down PyChain API")` comment):

Old body:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    # Startup
    logger.info("Starting PyChain API")

    # Clean up stale files older than CLEANUP_TTL_SECONDS.
    # ... (the long inline block) ...

    yield

    # Shutdown (if needed in the future)
    # logger.info("Shutting down PyChain API")
```

New body:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    logger.info("Starting PyChain API")

    # One sweep on boot, then keep sweeping every CLEANUP_INTERVAL_SECONDS so
    # long-running deployments don't accumulate orphaned files and rows.
    await _sweep_stale_files_and_sessions()
    sweep_task = asyncio.create_task(_periodic_sweep())

    try:
        yield
    finally:
        sweep_task.cancel()
        try:
            await sweep_task
        except asyncio.CancelledError:
            pass
        logger.info("PyChain API shutdown complete")
```

- [ ] **Step 7: Run the new test and confirm it passes**

Run from `backend/`:

```bash
python -m pytest tests/test_lifespan_sweep.py -v --tb=short
```

Expected: 3 tests pass.

- [ ] **Step 8: Run the full backend suite to confirm no regression**

Run from `backend/`:

```bash
python -m pytest tests/ -q --tb=short
```

Expected: 180 tests pass (177 existing + 3 new).

- [ ] **Step 9: Smoke-test the server boots and the periodic task starts**

Run from `backend/`:

```bash
python -c "
import asyncio, main
async def smoke():
    async with main.lifespan(main.app):
        await asyncio.sleep(0.1)
asyncio.run(smoke())
print('OK')
"
```

Expected: log lines for startup sweep and shutdown, then `OK`. Confirms the lifespan does not raise.

- [ ] **Step 10: Document the new env var in CLAUDE.md**

Open `CLAUDE.md` and find the "Conventions" section. The bullet that mentions `CLEANUP_TTL_SECONDS` reads:

```
- Generated `.chain` files and `backend/uploads/`, `backend/output/` are gitignored; the server performs TTL-based cleanup on startup (`lifespan` in `main.py`), deleting only files older than `CLEANUP_TTL_SECONDS` (default 3600). The same TTL purges old rows in `pynode_workflow_sessions`.
```

Replace with:

```
- Generated `.chain` files and `backend/uploads/`, `backend/output/` are gitignored; the server performs TTL-based cleanup both at startup and every `CLEANUP_INTERVAL_SECONDS` (default = `max(60, CLEANUP_TTL_SECONDS // 4)`) thereafter, deleting items older than `CLEANUP_TTL_SECONDS` (default 3600) from disk and from `pynode_workflow_sessions`.
```

- [ ] **Step 11: Commit**

```bash
git add backend/main.py backend/tests/test_lifespan_sweep.py CLAUDE.md
git commit -m "feat(PC-204): periodic TTL sweep replaces startup-only cleanup"
```

---

## Task 6: Mark roadmap items done

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 1: Tick the five items**

In `ROADMAP.md`, prefix each of these bullets with `✅ ` (the existing convention):
- PC-204
- PC-305
- PC-602
- PC-604
- PC-805

Then expand each rationale paragraph in place to one or two sentences describing how it landed (mirror the format used for PC-201/PC-202/PC-203). Examples:

PC-204:
```
- ✅ **PC-204** `[P2]` — Session TTL and garbage collection.
  *Rationale:* The startup-only sweep is now augmented by an asyncio task in `lifespan()` that runs every `CLEANUP_INTERVAL_SECONDS` (default = `max(60, CLEANUP_TTL_SECONDS // 4)`). Both halves (file glob + `session_store.delete_older_than`) are independently try/except'd so a flaky DB does not block the disk sweep. Tested in `backend/tests/test_lifespan_sweep.py`.
```

PC-305:
```
- ✅ **PC-305** `[P2]` — Edge type validation at compile time.
  *Rationale:* `WorkspaceCanvas.tsx` now passes `isValidConnection={validateConnection}` to React Flow. The validator (in `frontend/lib/workflow/edgeRules.ts`) only allows `flow→flow` and `value→param` connections; legacy unprefixed handles still pass for backward compatibility. Tested in `frontend/lib/workflow/__tests__/edgeRules.test.ts`.
```

PC-602:
```
- ✅ **PC-602** `[P2]` — Fix README paths and remove stale instructions.
  *Rationale:* Replaced "Python Scripts" with the correct "Python Projects" path, removed the Legacy API section (those endpoints were killed in PC-101), corrected the templates-storage description to match PC-202, and updated the cleanup-on-startup wording to match PC-204.
```

PC-604:
```
- ✅ **PC-604** `[P2]` — Consolidate `start.sh` and `start.bat`, or delete both.
  *Rationale:* Both scripts have been removed. The README and CLAUDE.md document the commands directly.
```

PC-805:
```
- ✅ **PC-805** `[P2]` — Tighten CORS + CSP headers.
  *Rationale:* Replaced wildcard `allow_methods` and `allow_headers` with explicit allowlists (`GET`/`POST`/`PUT`/`DELETE`/`OPTIONS` and `Content-Type`/`Accept`). `allow_origins` and `allow_credentials` were already correct. Will be revisited when PC-801 introduces the `Authorization` header.
```

- [ ] **Step 2: Commit**

```bash
git add ROADMAP.md
git commit -m "docs: mark PC-204, PC-305, PC-602, PC-604, PC-805 done"
```

---

## Final verification

- [ ] **Step 1: Re-run the full test matrix**

```bash
cd backend && python -m pytest tests/ -q --tb=short
cd ../frontend && npx tsc --noEmit && npm run test && npm run build
```

Expected: backend 180/180 pass; frontend tsc clean, vitest all green, build successful.

- [ ] **Step 2: Sanity-check the diff**

```bash
git log --oneline @{u}..HEAD
git diff --stat @{u}..HEAD
```

Expected: 5 commits (PC-602, PC-805, PC-305, PC-204, ROADMAP), ~250 lines total across ~9 files.

- [ ] **Step 3: Hand off to user**

Summarize the bundle (files touched, tests added, commits) and stop. Do not push.
