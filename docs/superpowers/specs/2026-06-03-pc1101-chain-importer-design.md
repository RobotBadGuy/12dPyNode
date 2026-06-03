# PC-1101 — Import an existing `.chain` file into the graph — Design

**Status:** Approved (design) — 2026-06-03
**Roadmap:** EPIC-11 Interop & Authoring Confidence, PC-1101 `[P1] [Size: L] [Mode: superpowers]`

## Problem

PyChain only goes one way: graph → `.chain`. Users already have libraries of hand-authored `.chain`
files (the repo root alone shipped several). There is no way to bring an existing chain *back in* to edit
it — the single biggest "do I have to rebuild everything by hand?" adoption barrier. PC-1101 adds an
importer that reconstructs an editable React Flow graph from a `.chain`.

## Locked decisions (from brainstorming)

1. **Client-side.** Parse the `.chain` in the browser (`DOMParser`) and build the graph directly, mirroring
   the existing client-side template-import flow. Imported nodes are constructed from the **real**
   `nodeSchemas` defaults + parsed params, so they render and run identically to palette-created nodes. No
   upload, no new backend endpoint, no runner/compile-seam change. The inverse XML→node map is hand-ported
   to TS and parity-tested against committed, Python-generated chain fixtures.
2. **Broad coverage.** Map every structurally-simple known command (~20 of the 25 node types). Defer the
   side-effect-file commands and all unknown 12d commands to sticky-note placeholders.
3. **Best-effort, explicitly lossy.** v1 reconstructs a concrete, single-model graph; it does not recover
   templates/variables. The importer surfaces this in a report rather than hiding it.

## The `.chain` format (what we parse)

```
<?xml?>
<xml12d …>
  <meta_data> … <project_folder>…</project_folder> … </meta_data>   ← scaffolding (skip; read project_folder + Model/TIN hint)
  <Chain>
    <version>…</version>
    <Settings> … </Settings>                                          ← scaffolding (skip)
    <Commands>
      <Clean_model> … </Clean_model>                                  ← a flat, ORDERED list of command elements
      <Create_view> … </Create_view>
      <Manual_option> … </Manual_option>                              ← unknown 12d command → placeholder
      …
    </Commands>
  </Chain>
</xml12d>
```

Each command is a flat element whose named sub-elements map straight back to node-data fields, e.g.
`<Create_view>` carries `<View>` (view name), `<Top>/<Left>/<Bot>/<Right>` (coordinates),
`<Continue_on_failure>`. The auto-scaffolding (`xml12d`/`meta_data`/`Chain`/`Settings` + the closing tags)
is what PyChain re-emits on generation, so the importer skips it and only walks the children of `<Commands>`.

## The lossiness truth (surfaced, not hidden)

A generated chain stores **resolved literals**, not templates: `Alpha.chain` has `"Alpha"` baked into every
command (the per-model `{model_name}` substitution already ran). So importing reconstructs a **concrete,
single-model graph with literal values**, not the original templated workflow — still a large head start,
but the report says so. Hand-authored chains aren't per-model-templated, so their literals *are* the
intended values and import faithfully.

## Architecture (three focused units + reuse)

- **`frontend/lib/workflow/chainImport.ts`** — orchestration.
  - `parseChainXml(text: string): ParsedChain | ImportError` — `DOMParser`; detect `<parsererror>` and
    non-chain XML (no `xml12d`/`Commands`); extract the ordered `<Commands>` children and the `meta_data`
    bits we use (`project_folder`, Model-vs-TIN from the metadata variant).
  - `chainToGraph(parsed): { nodes, edges, report }` — walk commands in order, map each via the inverse map
    (or placeholder), synthesize the foreach + chainOutput scaffold, wire flow edges in document order, lay
    out with dagre.
- **`frontend/lib/workflow/chainCommandMap.ts`** — the **inverse map**: one entry per supported command,
  `{ '<XmlElement>': { nodeType, toData(el: Element) => Partial<NodeData> } }`. Pure, unit-tested per
  command. The single source of inversion truth.
- **Reuse:** `nodeSchemas` (defaults for fields the chain doesn't carry), `autoLayout` (PC-902 dagre),
  `nodeKinds`/types for node construction, and the PC-911 `nodeLabel` convention for the synthesized labels.
- **`app/page.tsx`** — `handleImportChain(file)`: read text → `chainToGraph` → `applySnapshot` (one
  undoable history entry, mirroring template load) → show the report.
- **UI:** extend the existing TopBar **Import** to accept `.json` (template, unchanged) **and** `.chain`,
  routing by extension/content. A small **`ChainImportReport`** modal/toast shows the mapped/placeholder
  summary.

## Graph reconstruction rules

1. Skip scaffolding; only the children of `<Commands>` become nodes.
2. Each command → one node: `nodeType` from the map, `data` = `{ ...schemaDefaults, ...toData(el) }`; the
   command's `<Name>` becomes the node's `data.label` for readability.
3. Unknown command (not in the map) **or** a deferred side-effect command → a **`stickyNote`** node holding
   `<Name>` + a short raw-XML snippet, wired into the flow in place. Nothing is dropped.
4. Synthesize a `foreachModel` source and a `chainFileOutput` sink (the sink uses `meta_data`'s
   `project_folder` and the Model/TIN metadata variant); wire `foreach → cmd₁ → … → cmdₙ → chainOutput`
   with `flow:` edges in document order.
5. `dagre` layout (left-to-right), then `fitView`.
6. The model source (Excel/manual) is **not** synthesized — the `.chain` doesn't carry one; the user
   attaches it. The report notes this.

## Coverage for v1

**Mapped (structurally-simple, single-element commands):** `cleanModel`, `renameModel`, `createView`,
`addModelToView`, `removeModelFromView`, `deleteModelsFromView`, `createSharedModel`, `import` (common
DWG/DGN/IFC case), `triangulateManualOption`, `tinFunction`, `runFunction`, `ifFunctionExists`,
`getTotalSurfaceArea`, `trimeshVolumeReport`, `volumeTinToTin`, `convertLinesToVariable`,
`createContourSmoothLabel`, `drapeToTin`, `runOrCreateContours`, `createTrimeshFromTin`, `addComment`,
`addLabel`, `applyMtf`. The exact element name + param sub-elements for each are produced by the plan's
first task (a workflow fan-out over `backend/commands/`), yielding the inverse-map table.

**Deferred to placeholders:** `createMtfFile`, `createTemplateFile` (emit external files — can't round-trip
from one `.chain`); and every unknown 12d command (`Manual_option`, `Run_option`, …). Ambiguous `import`
variants placeholder rather than guess.

**Not importable by nature:** the control-flow nodes (`setVariable`, `foreachModel`, `chainFileOutput`,
`excelModels`/`manualModels`, `stickyNote`) are never emitted as `<Commands>` children — they shape the
graph but generate no command — so a `.chain` contains nothing to reconstruct them from. The importer
*synthesizes* `foreachModel` + `chainFileOutput`; variables and the model source are the user's to re-add
(noted in the report).

## Import report

`chainToGraph` returns `{ mapped: number, total: number, placeholders: Array<{ element, count }>,
modelSourceMissing: true }`. The `ChainImportReport` renders: "Imported N of M commands. K became
placeholders (Manual_option ×6, Run_option ×9). Values are this chain's resolved literals — re-introduce
variables and attach a model source to re-template."

## Error handling

- Malformed XML → `DOMParser` emits `<parsererror>` → `notify.error("Couldn't parse — is this a valid
  .chain / XML file?")`, no canvas change.
- Non-chain XML (no `xml12d`/`Commands`) → clear error, no change.
- Empty `<Commands>` → import the scaffold only + report "0 commands found."

## Testing (TDD)

- **`chainCommandMap.test.ts`** — per command: element → correct node type + parsed params (incl. boolean
  `Continue_on_failure` and the createView coordinate tuple).
- **`chainImport.test.ts`** — structure parse, scaffolding skip, document-order flow edges, unknown →
  placeholder, report counts, and the three error paths. `jsdom` provides `DOMParser`.
- **Round-trip golden fixtures** — commit a handful of chains generated by the real Python generators from
  known graphs (`frontend/lib/workflow/__tests__/fixtures/*.chain`); assert `import(fixture)` reconstructs
  the expected node types/params. This pins the TS inverse map to the Python forward map; a generator change
  that isn't mirrored fails here.
- **Hand-authored fixture** — a trimmed real chain (e.g. from `bench align.chain`): the known commands map,
  `Manual_option`/`Run_option` become placeholders, report counts are correct.

## Implementation flow

1. **Inverse-map extraction (workflow fan-out):** one agent per `backend/commands/` generator extracts
   `(node_type, root XML element, [sub-element → node-data field], param types)`. Produces the inverse-map
   table that seeds `chainCommandMap.ts`. Cross-checked against `execute_node` (the forward data→param map).
2. **TDD core:** `chainCommandMap.ts` + `chainImport.ts` against the per-command and round-trip tests.
3. **Wire-up:** `handleImportChain` in `page.tsx`, the Import affordance routing, `ChainImportReport`.
4. **Verify:** vitest, tsc, lint, build; optionally extend the PC-505 e2e to import a fixture and assert the
   reconstructed node count (browser-level confidence).

## Explicitly out of scope (v1)

- Recovering variables/templates from resolved literals (re-templating is the user's job post-import).
- Side-effect-file commands (`createMtfFile`/`createTemplateFile`).
- Synthesizing a model source.
- Drag-drop `.chain` onto the canvas (cheap later add via the PC-904 pattern).
- A backend importer / round-trip endpoint.
