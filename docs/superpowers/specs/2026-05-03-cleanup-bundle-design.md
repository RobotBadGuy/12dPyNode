# Cleanup Bundle — PC-204 + PC-305 + PC-805 + PC-602 + PC-604

**Date:** 2026-05-03
**Roadmap items:** [PC-204], [PC-305], [PC-805], [PC-602], [PC-604] (all `[P2]`)
**Scope guarantee:** all five items are independent, each touchable in isolation, and ship together as one PR. Total expected change: ~150 lines of code + ~20 lines of doc edits + 2 file deletions.

---

## Goals

- Stop sessions and orphan files from accumulating between server restarts on long-running deployments.
- Catch invalid graph connections at draw time instead of letting them silently no-op at run time.
- Remove the wildcard CORS posture before the API surface stabilizes.
- Fix the README so onboarding stops referencing the wrong directory and a deleted endpoint.
- Delete redundant start scripts so they can't drift out of sync with the documented commands.

## Non-goals

- Replacing FastAPI's `BackgroundTasks` with a real job queue (PC-803).
- Adding APScheduler or any new scheduling dependency — the asyncio task loop in `lifespan()` is enough for this scale.
- Adding node-type compatibility validation to onConnect (e.g. only `excelModels` may feed `foreachModel`) — that semantic check is PC-703's territory.
- Rewriting the README beyond fixing rotted statements.
- Authentication-related CORS changes (`Authorization` header etc.) — PC-801 will revisit when auth lands.

---

## PC-204 — Promote startup TTL sweep to a scheduled background task

### Current state

`backend/main.py::lifespan()` runs a one-shot sweep on startup that deletes files in `uploads/` and `output/` older than `CLEANUP_TTL_SECONDS` (default 3600s) and removes session rows older than the same TTL via `session_store.delete_older_than(...)`. After startup, nothing else cleans anything; a server that runs for days accumulates orphans until the next restart.

### Approach

Refactor the inline sweep into a reusable function and run it on a periodic asyncio task during the lifespan.

- Extract the sweep block from `lifespan()` into `async def _sweep_stale_files_and_sessions()` at module scope. Same logic, same logging, same TTL source.
- After the existing startup sweep call, spawn `_sweep_task = asyncio.create_task(_periodic_sweep())`.
- `_periodic_sweep()` is a `while True: await asyncio.sleep(CLEANUP_INTERVAL_SECONDS); try: await _sweep_stale_files_and_sessions(); except Exception: logger.exception(...)`.
- New env var: `CLEANUP_INTERVAL_SECONDS`. If unset, defaults to `max(60, CLEANUP_TTL_SECONDS // 4)`. If set explicitly, used as-is (operator's responsibility). Documented next to `CLEANUP_TTL_SECONDS` in `.env.example` and CLAUDE.md.
- On shutdown (after `yield` in lifespan): `_sweep_task.cancel()`; `await _sweep_task` swallowing `CancelledError`. Prevents lingering asyncio task warnings.

### Why not APScheduler

The roadmap mentions APScheduler "(e.g.)". For a single instance that just needs a periodic call, asyncio + `asyncio.sleep` is ~10 lines, no new dep, integrates with the existing `lifespan` shutdown discipline. APScheduler would be overkill until/unless we need cron-style schedules or job persistence — neither is in scope.

### Tests

- New `backend/tests/test_lifespan_sweep.py` (or extend an existing test file): unit-tests `_sweep_stale_files_and_sessions()` with a fake `SessionStore` and a `tmp_path` for the file-deletion side. Asserts:
  - Files older than TTL are deleted, fresh files are not.
  - `delete_older_than` is called with a cutoff equal to `now - TTL`.
  - Exceptions in either half don't kill the function (each half is independently try/except'd).
- The asyncio loop itself (`_periodic_sweep`) is not unit tested — testing `await asyncio.sleep` integration is more brittle than valuable.

### Risk

Low. The sweep logic already exists and runs on every restart; we're just running it more often. If it has a bug, the bug fires more often instead of once a day.

---

## PC-305 — Reject mismatched edge types at draw time

### Current state

`WorkspaceCanvas.tsx::onConnect` calls `addEdge(connection, ...)` unconditionally. Handle prefixes (`flow:` / `value:` / `param:`) exist as a convention but are not enforced — a `value:` source can be wired to a `flow:` target and the runner silently ignores it at execution time, leaving the user confused about why their graph "ran but did nothing."

### Approach

Add `isValidConnection={validateConnection}` to the `<ReactFlow>` element. React Flow calls this during the drag, so invalid drops never produce an edge.

- New file `frontend/lib/workflow/edgeRules.ts` exporting:
  - `parseHandlePrefix(handle: string | null | undefined): 'flow' | 'value' | 'param' | null`
  - `validateConnection(connection: Connection): boolean`
- Rules:

  | Source prefix | Target prefix | Valid? |
  |---|---|---|
  | `flow` | `flow` | ✅ |
  | `value` | `param` | ✅ |
  | `flow` | `param` | ❌ |
  | `flow` | `value` | ❌ |
  | `value` | `flow` | ❌ |
  | `value` | `value` | ❌ |
  | `param` | anything | ❌ (param is input-only) |
  | either side has no prefix | — | ✅ (legacy escape hatch — see below) |

- **Legacy escape hatch:** if either `sourceHandle` or `targetHandle` is null/undefined or has no `prefix:` form, the validator returns `true`. Older graphs and any future custom handle naming continue to work. We can tighten this later when we know we've migrated everything.
- On rejected drops, log a single `console.warn` with the source/target prefixes so devs can see why a drop bounced.

### Tests

- `frontend/lib/workflow/__tests__/edgeRules.test.ts` — exhaustive table-driven cases for the matrix above plus null/undefined/missing-colon cases.

### Risk

Medium. False positives would block legitimate connections. Mitigation: the legacy escape hatch is generous, and the rules are derived directly from the handle prefix system documented in CLAUDE.md. The unit tests cover every cell.

---

## PC-805 — Tighten CORS

### Current state

`main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "...").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

The wildcard methods + headers + credentials posture is permissive. With `allow_credentials=True` set, the wildcards are almost useless anyway (modern browsers ignore `*` when credentials are set), but they hide what the API actually accepts.

### Approach

Replace wildcards with explicit lists derived from the actual route surface:

- `allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]`
- `allow_headers=["Content-Type", "Accept"]`
- `allow_credentials=True` stays (unchanged; correct).
- `allow_origins` stays env-driven (unchanged; correct).

### Why these headers

Routes accept JSON bodies (`Content-Type`), occasionally multipart for `/api/workflow/run` (which uses `multipart/form-data` — also covered by `Content-Type`), and the browser sends `Accept`. There's no `Authorization` header today (PC-801 adds it). No custom `X-*` headers in use.

### Tests

None. CORS configuration changes are correctness-checked at runtime. Adding a route test that exercises CORS would be testing FastAPI's middleware, not our code.

### Risk

Low. If a frontend caller does send a header we forgot, the dev sees a clear CORS error in the browser console. The fix is one-line.

---

## PC-602 — README rot fixes

### Current state

README references `G:\WebDev\Python Scripts\12dPynode` (wrong — actual root is `Python Projects`). May reference the legacy `/api/upload` endpoint, which was removed in PC-101.

### Approach

Read the README and:

1. Replace `Python Scripts` with `Python Projects` everywhere it appears.
2. Remove any `/api/upload` references (or update them to point to `/api/workflow/run`).
3. Spot-check the documented commands against current `package.json` scripts and `backend/main.py` startup; any specifically-broken command snippet gets a one-line fix.

Out of scope: rewriting layout, adding new sections, changing tone, expanding coverage.

### Tests

None.

### Risk

None.

---

## PC-604 — Delete `start.sh` and `start.bat`

### Current state

Two start scripts that wrap `python main.py` with some echoes. CLAUDE.md and README both document the commands directly.

### Approach

Delete both files. No replacement. Reduces the number of places someone could update a startup command and forget to update the others.

### Tests

None.

### Risk

None — anyone running them gets a "file not found" and reads the README.

---

## Test summary

| Item | Test file | What's covered |
|---|---|---|
| PC-204 | `backend/tests/test_lifespan_sweep.py` (new) | Sweep deletes old files, keeps fresh ones, calls `delete_older_than` correctly, half-failure isolation |
| PC-305 | `frontend/lib/workflow/__tests__/edgeRules.test.ts` (new) | All cells of the prefix matrix + legacy escape hatch |
| PC-805 | — | None |
| PC-602 | — | None |
| PC-604 | — | None |

Existing test suites must stay green: `python -m pytest backend/tests/ -q` and `npm run test` in `frontend/`.

## Build/lint gates

`npx tsc --noEmit` and `npm run build` in `frontend/` continue to pass. No new TypeScript types added beyond what `edgeRules.ts` exports.

---

## Implementation order

1. PC-602 + PC-604 first — pure docs/cleanup, zero blast radius.
2. PC-805 — one-line config change.
3. PC-305 — frontend module + tests + WorkspaceCanvas wire-up.
4. PC-204 — backend lifespan refactor + new function + test.

Each step independently committable. The bundle ships as one PR.

## Rollback

- PC-204: revert the lifespan change; sweep returns to startup-only behavior.
- PC-305: remove `isValidConnection` prop and the new file; existing graphs unaffected.
- PC-805: revert middleware kwargs to wildcards.
- PC-602 / PC-604: trivially reversible from git.
