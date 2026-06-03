# PC-705 — Dark/Light Theme Toggle — Design

**Status:** Approved (design) — 2026-06-03
**Roadmap:** EPIC-07 UX Polish, PC-705 `[P2] [Size: L] [Mode: feature-dev]`
**Mode note:** brainstormed via superpowers (brainstorming → spec → plan → TDD-where-applicable).

## Problem

The app is **dark-only**. The dark look is achieved by **hardcoding** Tailwind grayscale classes
(`bg-gray-900`, `text-gray-300`, `border-gray-700`, …) directly on every chrome component — `<html>`
carries no `dark` class at all. The repo already ships the scaffolding for theming but never wired it
into the hand-written components:

- `tailwind.config.js` already sets `darkMode: ['class']`.
- `app/globals.css` already defines a full shadcn-style CSS-variable token system with **both** `:root`
  (light) and `.dark` value blocks (`--background`, `--card`, `--muted`, `--border`, …).
- The shadcn `ui/` primitives (`button`, `card`, `input`, `badge`, `label`, `progress`) already consume
  those tokens — but the ~25 hand-written app components hardcode grays and ignore them.

We want a **Light theme alongside the existing Dark theme**, switchable from a TopBar toggle, **without
regressing the shipped dark look**.

## Locked decisions (from brainstorming)

1. **Conversion strategy — `dark:` variant pairs (not semantic-token refactor).** Today's hardcoded class
   becomes the **`dark:`** variant; a light counterpart is added as the base. Dark stays the default, so
   the current look is preserved byte-for-byte and Light is purely additive. Lower regression risk, fully
   parallelizable, matches the roadmap's "via `dark:` prefix" framing. The semantic-token alternative was
   rejected: it re-tunes the dark palette (regresses the polished look) and each swap needs an error-prone
   semantic judgment.
2. **Default + toggle — Dark default, simple Light/Dark 2-state.** App opens in dark (today's look) for
   everyone; no surprise for existing users. `enableSystem={false}` for v1 (system support is a trivial
   later flip if wanted).
3. **Plumbing — `next-themes`** (~3 kB, the Next.js App-Router standard). It injects a pre-hydration
   `<head>` script that sets the `.dark` class before paint, killing the flash-of-wrong-theme that a
   hand-rolled solution (à la `draftStorage`) would suffer with SSR. Repo precedent for small, well-scoped
   deps: `driver.js`, `dagre`, `html-to-image`, `sonner`.
4. **Nodes stay dark in both themes (scope decision).** `BaseNode` renders self-contained dark "chips"
   (slate gradient body, JS-computed shadows, `text-white`). Dark nodes on a light canvas is a deliberate,
   attractive pattern (n8n / draw.io). This removes ~33 near-identical node files + `BaseNode` from the
   churn. Only **chrome** flips.

## Architecture

### Foundation modules (built carefully, sequential — NOT fanned out)

- **`frontend/components/ThemeProvider.tsx`** (client) — thin wrapper over `next-themes`' provider:
  `attribute="class"`, `defaultTheme="dark"`, `enableSystem={false}`, `storageKey="pychain-theme"`,
  `disableTransitionOnChange`.
- **`frontend/app/layout.tsx`** — add `suppressHydrationWarning` to `<html>`; wrap `{children}` **and** the
  Toaster in `<ThemeProvider>`. (`layout` stays a server component; the provider is the client boundary.)
- **`frontend/components/ThemeToggle.tsx`** (client) — ghost Sun/Moon `lucide-react` icon button. Mounted in
  the **always-visible** left cluster of `TopBar` (beside Home/Runs/Profile) so it works on all four pages
  (`landing`/`editor`/`profile`/`runs`), which all render under the always-present TopBar. Uses the standard
  next-themes **mounted guard** (render a neutral placeholder until `mounted` is true) to avoid hydration
  mismatch. `aria-label` reflects the action ("Switch to light theme" / "Switch to dark theme").
- **`frontend/components/ThemedToaster.tsx`** (client) — wraps Sonner's `<Toaster>` so its `theme` follows
  **our** toggle via `useTheme().resolvedTheme`, replacing the hardcoded `theme="dark"`. Keeps `richColors`,
  `position="bottom-right"`, `closeButton`.
- **`frontend/lib/theme.ts`** — the only unit-testable logic: `THEME_STORAGE_KEY`, `nextTheme(resolved)`
  (returns the toggled value), and an icon/label picker. Pure functions.

### React Flow canvas (`WorkspaceCanvas.tsx`)

- Pass **`colorMode={resolvedTheme}`** to `<ReactFlow>` (React Flow v12 native — themes Controls, MiniMap,
  edges, handles, attribution, selection box automatically via its own CSS variables). `WorkspaceCanvas`
  becomes theme-aware via `useTheme()`.
- Make our explicit overrides theme-aware:
  - `className="bg-gray-800"` on `<ReactFlow>` → `bg-gray-100 dark:bg-gray-800`.
  - `<Background color=…>`: drive the grid line color from `resolvedTheme` (dark lines on light canvas,
    today's `rgba(255,255,255,0.1)` on dark).
  - `<Controls>` / `<MiniMap>` `className` and the Auto-layout button → `dark:` pairs per the table.
  - `.workspace-grid` CSS gets an `html:not(.dark)` light variant (dark-on-light isometric lines).
- The `MiniMap` `nodeColor` switch (emerald/blue/violet/amber) is semantic accent — unchanged.
- HSL-generated edge colors are theme-independent — unchanged.

### `globals.css`

- Add `html:not(.dark)` light variants for the hardcoded-dark custom classes: `.workspace-grid`,
  `.gradient-bg`, `.floating-card`, `.glass-effect`, `.grid-pattern`, and the **driver.js `.pychain-tour`**
  popover block (currently `#111827` etc.).
- The shadcn token `:root` (light) / `.dark` blocks already exist; the `ui/` primitives flip for free.
  Verify (not edit) their rendering in both themes.
- Reconcile the two `body { … }` rules so light mode isn't fighting a dark-tuned `background`/`color`.

## The `dark:` parity table (applied uniformly across all chrome files)

Existing hardcoded class → becomes the `dark:` variant; light counterpart added as the base:

| Existing (→ `dark:…`) | Light base added |
|---|---|
| `bg-gray-900` / `bg-gray-900/95` | `bg-white` / `bg-white/95` |
| `bg-gray-800` / `bg-gray-800/50` | `bg-gray-100` / `bg-gray-200/60` |
| `bg-gray-700` | `bg-gray-200` |
| `bg-slate-800/50` | `bg-slate-200/60` |
| `text-white` *(chrome only, never nodes)* | `text-gray-900` |
| `text-gray-300` / `-400` / `-200` | `text-gray-700` / `-600` / `-800` |
| `text-slate-400` | `text-slate-600` |
| `border-gray-700` / `-600/50` | `border-gray-200` / `-300` |
| `border-slate-700` | `border-slate-300` |
| `hover:bg-gray-800` / `hover:bg-gray-800/50` | `hover:bg-gray-100` / `hover:bg-gray-200/60` |
| **Accent** gradients & status colors (indigo/purple/blue/green/amber/red, `bg-clip-text` gradients, success/error/warning badges) | **kept as-is**; bumped to `xxx-600 dark:xxx-400` **only** where the accent is body text on a light surface and fails contrast |

Rules of application:
- **Additive only.** Never delete an existing class — the existing class must survive as the `dark:` variant
  so dark cannot regress.
- **Modal scrims stay dark** (`bg-black/50`) in both themes; only the modal **card** flips.
- When unsure whether something is "chrome" vs an "accent", default to leaving accents untouched.

## Chrome files in scope (~25)

`app/page.tsx` (root `bg-gray-900` wrapper), `TopBar`, `LeftSidebar`, `RightSidebar`, `LandingPage`,
`ProfilePage`, `RunsPage`; modals `DataMappingModal`, `ExcelColumnPickerModal`, `LoadTemplateModal`,
`SaveTemplateModal`, `ChainPreviewModal`, `ErrorModal`, `ShortcutsModal`, `RestoreDraftModal`; floating
panels `NodeRunDetails`, `RunProgressPanel`, `SuccessCelebration`, `TemplateNotification`,
`NodeContextMenu`, `ExportMenu`; and `WorkspaceCanvas` (handled in the foundation phase).

**Out of scope (unchanged):** all `nodes/*` files + `BaseNode` (nodes stay dark), the `ui/` primitives
(token-driven, flip for free).

## Testing & verification

- **Unit (vitest):** `frontend/lib/__tests__/theme.test.ts` covering `nextTheme()` round-trip and the
  icon/label picker. (No React Testing Library in the repo, so the toggle component itself is not
  unit-tested — verified via e2e instead.)
- **E2E (Playwright — the real verification for visual work):** extend the PC-505 harness with a theme test:
  load the editor, assert default `<html class="… dark">`, click the toggle, assert `.dark` is removed and a
  sampled chrome background color actually changes, reload, assert the choice persisted (light), toggle back.
- **Gates:** `tsc --noEmit`, `next lint`, `vitest`, `next build`, `npm run e2e`. Backend untouched
  (no pytest impact).

Honesty note (per prior tickets): the rendered light palette's *aesthetic quality* across every screen is
not exhaustively human-reviewed; the e2e proves the mechanism and persistence, and the adversarial review
pass checks contrast/readability heuristically.

## Implementation flow

1. **Foundation phase (sequential, single-author):** add `next-themes`; `ThemeProvider`; `layout.tsx` wiring
   + `suppressHydrationWarning`; `ThemeToggle` in `TopBar`; `ThemedToaster`; `lib/theme.ts` + its test;
   `globals.css` light variants; `WorkspaceCanvas` `colorMode` + theme-aware overrides. **Verify dark is
   visually unchanged and light boots** before fanning out.
2. **Fan-out phase (workflow):** one agent per chrome file applying the parity table (additive only), then an
   **adversarial review pass** (light-mode contrast/readability + a dark-unchanged regression check that no
   existing class was dropped), then the full gate run including e2e.

## Risk posture

Dark = default and every existing class becomes its own `dark:` variant, so the shipped dark experience
cannot change unless an edit **drops** an existing class. The review pass explicitly checks for dropped
classes, making regression detectable and mechanical to catch.

## Explicitly deferred (YAGNI)

- System-preference / 3-way toggle (`enableSystem` flip) — trivial to add later if requested.
- Per-theme node styling (nodes stay dark in both).
- Re-skinning to semantic tokens — separate refactor, not needed for the feature.
