# PC-705 Dark/Light Theme Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Light theme alongside the existing Dark theme with a TopBar toggle, preserving the shipped dark look byte-for-byte.

**Architecture:** `next-themes` toggles a `.dark` class on `<html>` (default dark). Existing hardcoded grayscale classes become the `dark:` variant; a light counterpart is added as the base (additive only). Nodes stay dark in both themes; only chrome flips. React Flow uses its native `colorMode` prop.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 3.4 (`darkMode: ['class']`), `next-themes`, `@xyflow/react` v12, `sonner`, `driver.js`, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-03-pc705-theme-toggle-design.md`

---

## Shared reference — the `dark:` parity table

Used by every Phase 2 task. **Rule: additive only — never delete an existing class.** The existing class
must survive as the `dark:` variant so dark cannot regress. Accent colors and anything inside `nodes/*` /
`BaseNode` are **left untouched**.

| Existing class (→ becomes `dark:…`) | Light base added in front |
|---|---|
| `bg-gray-900` | `bg-white dark:bg-gray-900` |
| `bg-gray-900/95` | `bg-white/95 dark:bg-gray-900/95` |
| `bg-gray-900/80` | `bg-white/80 dark:bg-gray-900/80` |
| `bg-gray-800` | `bg-gray-100 dark:bg-gray-800` |
| `bg-gray-800/50` | `bg-gray-200/60 dark:bg-gray-800/50` |
| `bg-gray-800/70` | `bg-gray-200/70 dark:bg-gray-800/70` |
| `bg-gray-700` | `bg-gray-200 dark:bg-gray-700` |
| `bg-slate-800/50` | `bg-slate-200/60 dark:bg-slate-800/50` |
| `bg-slate-700/50` | `bg-slate-200/60 dark:bg-slate-700/50` |
| `text-white` *(chrome only — NOT nodes)* | `text-gray-900 dark:text-white` |
| `text-gray-300` | `text-gray-700 dark:text-gray-300` |
| `text-gray-400` | `text-gray-600 dark:text-gray-400` |
| `text-gray-200` | `text-gray-800 dark:text-gray-200` |
| `text-gray-500` | `text-gray-500 dark:text-gray-500` *(mid-gray reads on both — leave)* |
| `text-slate-400` | `text-slate-600 dark:text-slate-400` |
| `border-gray-700` | `border-gray-200 dark:border-gray-700` |
| `border-gray-700/50` | `border-gray-200 dark:border-gray-700/50` |
| `border-gray-600/50` | `border-gray-300 dark:border-gray-600/50` |
| `border-slate-700` | `border-slate-300 dark:border-slate-700` |
| `hover:bg-gray-800` | `hover:bg-gray-100 dark:hover:bg-gray-800` |
| `hover:bg-gray-800/50` | `hover:bg-gray-200/60 dark:hover:bg-gray-800/50` |
| `hover:bg-slate-700/50` | `hover:bg-slate-200/60 dark:hover:bg-slate-700/50` |

**Left untouched (accents — read on both themes):** any `indigo/purple/violet/blue/green/emerald/amber/yellow/red/pink/orange`
class, `bg-clip-text` gradients, status badges, and the `from-…/to-…` gradient buttons. **Exception:** if an
accent is *body text on a light surface* and is too light (e.g. `text-blue-400` as a paragraph on white), bump
to `text-blue-600 dark:text-blue-400`. When unsure, leave it.

**Modal scrims** (`bg-black/40`, `bg-black/50`, `bg-black/60`) stay as-is in both themes — only the modal **card** flips.

**Regression check after editing any file:** `git diff <file>` must show **no removed (`-`) line that drops a
`gray-`/`slate-` color token without re-adding it under `dark:`**. Every original color token still appears.

---

## File structure

**New files**
- `frontend/lib/theme.ts` — pure helpers (`THEME_STORAGE_KEY`, `nextTheme`, `toggleLabel`).
- `frontend/lib/__tests__/theme.test.ts` — vitest for the above.
- `frontend/components/ThemeProvider.tsx` — client wrapper over next-themes provider.
- `frontend/components/ThemedToaster.tsx` — client Sonner Toaster that follows the toggle.
- `frontend/components/ThemeToggle.tsx` — client Sun/Moon TopBar button.
- `frontend/e2e/theme-toggle.spec.ts` — Playwright toggle + persistence test.

**Modified (foundation)**
- `frontend/package.json` — add `next-themes`.
- `frontend/app/layout.tsx` — `suppressHydrationWarning`, wrap in `ThemeProvider`, swap Toaster → ThemedToaster.
- `frontend/components/workflow/TopBar.tsx` — mount `<ThemeToggle />` (also gets parity-table pass in Phase 2).
- `frontend/app/globals.css` — `html:not(.dark)` light variants for custom CSS + driver.js tour.
- `frontend/components/workflow/WorkspaceCanvas.tsx` — `colorMode` + theme-aware Background/overrides.

**Modified (Phase 2 chrome — parity table only)**
`frontend/app/page.tsx` (root wrapper line only), `LeftSidebar`, `RightSidebar`, `LandingPage`, `ProfilePage`,
`RunsPage`, `DataMappingModal`, `ExcelColumnPickerModal`, `LoadTemplateModal`, `SaveTemplateModal`,
`ChainPreviewModal`, `ErrorModal`, `ShortcutsModal`, `RestoreDraftModal`, `NodeRunDetails`, `RunProgressPanel`,
`SuccessCelebration`, `TemplateNotification`, `NodeContextMenu`, `ExportMenu`.

**Untouched:** everything under `components/workflow/nodes/`, `components/ui/*`.

---

## Phase 1 — Foundation

### Task 1: `lib/theme.ts` pure helpers (TDD)

**Files:**
- Create: `frontend/lib/theme.ts`
- Test: `frontend/lib/__tests__/theme.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/lib/__tests__/theme.test.ts
import { describe, it, expect } from 'vitest';
import { THEME_STORAGE_KEY, nextTheme, toggleLabel } from '../theme';

describe('THEME_STORAGE_KEY', () => {
  it('is the stable localStorage key', () => {
    expect(THEME_STORAGE_KEY).toBe('pychain-theme');
  });
});

describe('nextTheme', () => {
  it('toggles dark -> light', () => expect(nextTheme('dark')).toBe('light'));
  it('toggles light -> dark', () => expect(nextTheme('light')).toBe('dark'));
  it('treats undefined as not-dark and targets dark', () =>
    expect(nextTheme(undefined)).toBe('dark'));
  it('treats any unknown value as targeting dark', () =>
    expect(nextTheme('system')).toBe('dark'));
});

describe('toggleLabel', () => {
  it('in dark, offers to switch to light', () =>
    expect(toggleLabel('dark')).toBe('Switch to light theme'));
  it('in light, offers to switch to dark', () =>
    expect(toggleLabel('light')).toBe('Switch to dark theme'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/__tests__/theme.test.ts`
Expected: FAIL — `Cannot find module '../theme'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/lib/theme.ts
// PC-705 — pure theme helpers. The only unit-testable slice of the theme
// feature; the React wiring is verified by Playwright instead.

export const THEME_STORAGE_KEY = 'pychain-theme';

export type ThemeChoice = 'light' | 'dark';

/** The theme to switch TO given the currently-resolved theme. Anything that
 *  isn't 'dark' (including undefined pre-mount) targets 'dark'. */
export function nextTheme(resolved: string | undefined): ThemeChoice {
  return resolved === 'dark' ? 'light' : 'dark';
}

/** aria-label / tooltip describing the toggle action. */
export function toggleLabel(resolved: string | undefined): string {
  return resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/__tests__/theme.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/theme.ts frontend/lib/__tests__/theme.test.ts
git commit -m "feat(PC-705): pure theme helpers (nextTheme/toggleLabel)"
```

---

### Task 2: Add `next-themes` and the ThemeProvider/ThemedToaster wrappers

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/components/ThemeProvider.tsx`
- Create: `frontend/components/ThemedToaster.tsx`

- [ ] **Step 1: Install the dependency**

Run: `cd frontend && npm install next-themes@^0.4.6`
Expected: `package.json` gains `"next-themes": "^0.4.6"` under dependencies; `package-lock.json`/`node_modules` updated. (CI uses `npm install`, not `npm ci` — see memory `ci-lockfile-cross-platform`.)

- [ ] **Step 2: Create the ThemeProvider**

```tsx
// frontend/components/ThemeProvider.tsx
'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { THEME_STORAGE_KEY } from '@/lib/theme';

// PC-705 — app-wide theme context. Dark is the default so existing users see
// no change; light is opt-in via the TopBar toggle. `attribute="class"` drives
// Tailwind's `dark:` variant (darkMode: ['class']). next-themes injects a
// pre-hydration <head> script that sets the class before paint -> no FOUC.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 3: Create the ThemedToaster**

```tsx
// frontend/components/ThemedToaster.tsx
'use client';

import { Toaster } from 'sonner';
import { useTheme } from 'next-themes';

// PC-705 — Sonner toasts follow OUR toggle (not the OS). Before mount
// resolvedTheme is undefined; default to 'dark' to match the default theme.
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      richColors
      position="bottom-right"
      closeButton
    />
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (no errors). If `next-themes` types are missing, confirm the install in Step 1 succeeded.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/components/ThemeProvider.tsx frontend/components/ThemedToaster.tsx
git commit -m "feat(PC-705): add next-themes + ThemeProvider/ThemedToaster wrappers"
```

---

### Task 3: Wire the provider into the root layout

**Files:**
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Replace the Sonner import and add wrapper imports**

Change the top imports. Remove `import { Toaster } from 'sonner';` and add:

```tsx
import { ThemeProvider } from '@/components/ThemeProvider';
import { ThemedToaster } from '@/components/ThemedToaster';
```

(Keep `import 'driver.js/dist/driver.css';` and `import './globals.css';`.)

- [ ] **Step 2: Add `suppressHydrationWarning` to `<html>`**

next-themes mutates the `<html>` class before React hydrates, so React would warn about a class mismatch without this flag.

```tsx
<html lang='en' suppressHydrationWarning className={`${inter.variable} ${poppins.variable}`}>
```

- [ ] **Step 3: Wrap children + toaster in the provider**

Replace the body content:

```tsx
<body className={`${inter.className} antialiased`}>
  <ThemeProvider>
    {children}
    <ThemedToaster />
  </ThemeProvider>
</body>
```

- [ ] **Step 4: Typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: PASS. Build output should not error on the new client components.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/layout.tsx
git commit -m "feat(PC-705): wrap app in ThemeProvider (dark default) + themed Toaster"
```

---

### Task 4: ThemeToggle button + mount in TopBar

**Files:**
- Create: `frontend/components/ThemeToggle.tsx`
- Modify: `frontend/components/workflow/TopBar.tsx`

- [ ] **Step 1: Create the toggle**

```tsx
// frontend/components/ThemeToggle.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { nextTheme, toggleLabel } from '@/lib/theme';

// PC-705 — Sun/Moon toggle for the always-visible TopBar cluster. Mounted-guard
// avoids a hydration mismatch: resolvedTheme is unknown on the server and on the
// first client render, so render a stable, inert placeholder until mounted.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="px-2 text-gray-700 dark:text-gray-300"
        disabled
        aria-hidden
      >
        <Sun className="w-4 h-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === 'dark';
  const label = toggleLabel(resolvedTheme);
  return (
    <Button
      onClick={() => setTheme(nextTheme(resolvedTheme))}
      variant="ghost"
      size="sm"
      className="px-2 text-gray-700 hover:bg-gray-200/60 dark:text-gray-300 dark:hover:bg-gray-800/50"
      title={label}
      aria-label={label}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}
```

- [ ] **Step 2: Import it in TopBar**

In `frontend/components/workflow/TopBar.tsx`, add after the existing imports:

```tsx
import { ThemeToggle } from '@/components/ThemeToggle';
```

- [ ] **Step 3: Mount it in the always-visible left cluster**

In TopBar, the nav buttons live in a `<div className="flex items-center gap-1 ml-4">…Home/Runs/Profile…</div>`
inside the always-rendered left `<div className="flex items-center gap-4">`. Add the toggle right after that
nav-buttons `</div>` (still inside the left cluster, so it shows on all four pages):

```tsx
        </div>{/* end nav buttons */}

        <ThemeToggle />
      </div>{/* end left cluster */}
```

(Place `<ThemeToggle />` as the last child of the left `flex items-center gap-4` container.)

- [ ] **Step 4: Typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 5: Manual smoke (optional but recommended)**

Run `npm run dev`, open `http://localhost:3000`. The TopBar shows a Sun icon (dark default). Click it →
`<html>` class loses `dark`, gains `light`; icon becomes Moon. Reload → stays light. Toggle back → dark.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/ThemeToggle.tsx frontend/components/workflow/TopBar.tsx
git commit -m "feat(PC-705): Sun/Moon theme toggle in TopBar"
```

---

### Task 5: Light variants for custom CSS + driver.js tour (`globals.css`)

**Files:**
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Append the light-variant block**

Append at the end of `frontend/app/globals.css`:

```css
/* ============================================================
   PC-705 — Light-theme variants for the hardcoded-dark custom
   classes. Dark stays the default; these apply only when <html>
   lacks the `.dark` class (i.e. light mode).
   ============================================================ */

html:not(.dark) .gradient-bg {
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 25%, #ede9fe 50%, #dbeafe 75%, #eff6ff 100%);
  background-size: 400% 400%;
  animation: gradientShift 20s ease infinite;
}

html:not(.dark) .floating-card {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.6);
}
html:not(.dark) .floating-card:hover {
  box-shadow: 0 32px 64px -12px rgba(0, 0, 0, 0.2),
    0 0 0 1px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

html:not(.dark) .grid-pattern {
  background-image: linear-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.08) 1px, transparent 1px);
}

html:not(.dark) .workspace-grid {
  background-image:
    linear-gradient(30deg, rgba(0, 0, 0, 0.05) 12%, transparent 12.5%, transparent 87%, rgba(0, 0, 0, 0.05) 87.5%, rgba(0, 0, 0, 0.05) 100%),
    linear-gradient(150deg, rgba(0, 0, 0, 0.05) 12%, transparent 12.5%, transparent 87%, rgba(0, 0, 0, 0.05) 87.5%, rgba(0, 0, 0, 0.05) 100%),
    linear-gradient(30deg, rgba(0, 0, 0, 0.05) 12%, transparent 12.5%, transparent 87%, rgba(0, 0, 0, 0.05) 87.5%, rgba(0, 0, 0, 0.05) 100%),
    linear-gradient(150deg, rgba(0, 0, 0, 0.05) 12%, transparent 12.5%, transparent 87%, rgba(0, 0, 0, 0.05) 87.5%, rgba(0, 0, 0, 0.05) 100%);
}

/* driver.js onboarding tour — light popover (mirrors the dark .pychain-tour) */
html:not(.dark) .driver-popover.pychain-tour {
  background-color: #ffffff;
  color: #374151;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}
html:not(.dark) .driver-popover.pychain-tour .driver-popover-title { color: #111827; }
html:not(.dark) .driver-popover.pychain-tour .driver-popover-description { color: #4b5563; }
html:not(.dark) .driver-popover.pychain-tour .driver-popover-progress-text { color: #6b7280; }
html:not(.dark) .driver-popover.pychain-tour .driver-popover-close-btn { color: #6b7280; }
html:not(.dark) .driver-popover.pychain-tour .driver-popover-close-btn:hover { color: #111827; }
html:not(.dark) .driver-popover.pychain-tour button.driver-popover-prev-btn {
  background: rgba(229, 231, 235, 0.9);
  color: #374151;
}
html:not(.dark) .driver-popover.pychain-tour .driver-popover-arrow-side-left.driver-popover-arrow { border-left-color: #ffffff; }
html:not(.dark) .driver-popover.pychain-tour .driver-popover-arrow-side-right.driver-popover-arrow { border-right-color: #ffffff; }
html:not(.dark) .driver-popover.pychain-tour .driver-popover-arrow-side-top.driver-popover-arrow { border-top-color: #ffffff; }
html:not(.dark) .driver-popover.pychain-tour .driver-popover-arrow-side-bottom.driver-popover-arrow { border-bottom-color: #ffffff; }
```

(The `.pychain-tour` Next button keeps its purple→pink gradient in light too — it reads fine. `.glass-effect`
is already light-friendly and needs no variant.)

- [ ] **Step 2: Build to confirm CSS compiles**

Run: `cd frontend && npm run build`
Expected: PASS (no CSS/postcss errors).

- [ ] **Step 3: Commit**

```bash
git add frontend/app/globals.css
git commit -m "feat(PC-705): light-mode variants for custom CSS + driver.js tour"
```

---

### Task 6: Theme-aware React Flow canvas

**Files:**
- Modify: `frontend/components/workflow/WorkspaceCanvas.tsx`

- [ ] **Step 1: Import `useTheme` and read the resolved theme**

Add to the imports:

```tsx
import { useTheme } from 'next-themes';
```

Inside `WorkspaceCanvas(...)`, near the top of the component body (after `const reactFlow = useReactFlow();`):

```tsx
  const { resolvedTheme } = useTheme();
  // Before mount resolvedTheme is undefined; default to dark to match the
  // default theme and avoid a light flash on first paint.
  const isLight = resolvedTheme === 'light';
  const flowColorMode = isLight ? 'light' : 'dark';
```

- [ ] **Step 2: Pass `colorMode` and a theme-aware canvas background to `<ReactFlow>`**

Change the `<ReactFlow … className="bg-gray-800">` opening tag to add `colorMode` and flip the class:

```tsx
      <ReactFlow
        nodes={nodes as Node[]}
        edges={coloredEdges}
        /* …unchanged props… */
        deleteKeyCode={['Backspace', 'Delete']}
        nodeTypes={nodeTypes}
        fitView
        colorMode={flowColorMode}
        className="bg-gray-100 dark:bg-gray-800"
      >
```

- [ ] **Step 3: Make the Background grid color theme-aware**

```tsx
        <Background
          gap={20}
          size={1}
          lineWidth={0.5}
          color={isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.1)'}
          className="workspace-grid"
        />
```

- [ ] **Step 4: Flip the Controls, MiniMap, and Auto-layout button chrome**

```tsx
        <Controls className="bg-white/80 border-gray-200 dark:bg-gray-900/80 dark:border-gray-700" />
        <MiniMap
          className="bg-white/80 border-gray-200 dark:bg-gray-900/80 dark:border-gray-700"
          nodeColor={(node) => {
            /* …unchanged switch… */
          }}
        />
```

And the Auto-layout button className:

```tsx
                  className="flex items-center gap-2 bg-white/80 border border-gray-200 hover:bg-gray-100 text-gray-700 dark:bg-gray-900/80 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-200 text-sm font-medium px-3 py-2 rounded-md shadow"
```

(The drop overlay's emerald styling and the MiniMap `nodeColor` switch are accents — leave them.)

- [ ] **Step 5: Typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: PASS. (`colorMode` is a valid `@xyflow/react` v12 prop.)

- [ ] **Step 6: Commit**

```bash
git add frontend/components/workflow/WorkspaceCanvas.tsx
git commit -m "feat(PC-705): theme-aware React Flow canvas (colorMode + chrome)"
```

---

### Task 7: Foundation verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full gate**

Run, from `frontend/`:
```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
```
Expected: all PASS. vitest count = prior baseline (228) + 6 new theme tests = **234**.

- [ ] **Step 2: Manual dark-unchanged check**

`npm run dev`, open the editor (default dark). Confirm: TopBar, sidebars, canvas, a couple of modals, and the
RightSidebar `Input` fields look identical to before (the only acceptable change is a slightly more defined
input border/placeholder — that's the intended shadcn dark token now applying). Toggle to light: chrome on
the *foundation-touched* surfaces (canvas, TopBar toggle area) flips; **un-converted chrome will still look
dark in light mode — that is expected until Phase 2 lands.**

- [ ] **Step 3: Commit (if any lint autofixes)**

```bash
git add -A && git commit -m "chore(PC-705): foundation gate green" --allow-empty
```

---

## Phase 2 — Chrome conversion (parity table)

> **Execution note:** This phase is a mechanical, per-file application of the **Shared reference parity table**.
> It is ideal for a Workflow fan-out (one agent per file) followed by an adversarial review. Each file is an
> independent, additive edit. The worked example below (TopBar) is the template for every file.

### Conversion procedure (apply to each file in scope)

For the target file:
1. Find every grayscale color utility (`bg-/text-/border-/hover:bg-/ring-/divide-` with `gray-`/`slate-`/`white`/`black`).
2. For each, **prepend** the light counterpart from the parity table and convert the original to its `dark:`
   form (additive — original token stays, now as `dark:`). Skip accents and `bg-black/NN` scrims.
3. Do **not** touch `nodes/*` colors, icon accent colors, or gradient buttons.
4. Verify: `git diff <file>` shows only additions of light/`dark:` classes — no dropped color token.
5. Commit `feat(PC-705): light-theme pass on <file>`.

### Worked example — `TopBar.tsx` (the template)

- [ ] Representative before → after edits:

```tsx
// container
- <div className="h-16 bg-gray-900/95 backdrop-blur-xl border-b border-gray-700/50 …">
+ <div className="h-16 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700/50 …">

// title
- className="text-xl font-bold text-white cursor-pointer"
+ className="text-xl font-bold text-gray-900 dark:text-white cursor-pointer"

// nav ghost button (note the active-state segment also flips)
- className={`text-gray-300 hover:bg-gray-800/50 ${currentPage === 'landing' ? 'bg-gray-800/70 text-white' : ''}`}
+ className={`text-gray-700 hover:bg-gray-200/60 dark:text-gray-300 dark:hover:bg-gray-800/50 ${currentPage === 'landing' ? 'bg-gray-200/70 text-gray-900 dark:bg-gray-800/70 dark:text-white' : ''}`}

// outline button
- className="border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
+ className="border-gray-300 dark:border-gray-600/50 text-gray-700 hover:bg-gray-200/60 dark:text-gray-300 dark:hover:bg-gray-800/50"
```

The gradient "Run Chain" button (`from-purple-500 to-pink-500`) and the green→blue `bg-clip-text` span are
accents — **left untouched**.

- [ ] Commit `feat(PC-705): light-theme pass on TopBar.tsx`.

### Task list — one task per file (apply the procedure)

Each is the same shape: apply procedure → `git diff` regression check → `npx tsc --noEmit` (cheap, per file) → commit.

- [ ] **Task 8:** `frontend/app/page.tsx` — **only** the root wrapper at line ~1687:
  `bg-gray-900` → `bg-white dark:bg-gray-900`. (Do not touch anything else in this large file.)
- [ ] **Task 9:** `components/workflow/TopBar.tsx` (full pass — see worked example).
- [ ] **Task 10:** `components/workflow/LeftSidebar.tsx`.
- [ ] **Task 11:** `components/workflow/RightSidebar.tsx` (largest; the raw `<Input>`/`<Label>` keep their
  explicit `text-gray-300` → flip per table).
- [ ] **Task 12:** `components/LandingPage.tsx` (hero `text-white` → `text-gray-900 dark:text-white`;
  `text-slate-400` → `text-slate-600 dark:text-slate-400`; keep gradient/accent buttons).
- [ ] **Task 13:** `components/ProfilePage.tsx` (largest count — 104).
- [ ] **Task 14:** `components/RunsPage.tsx`.
- [ ] **Task 15:** `components/workflow/DataMappingModal.tsx` (scrim stays dark; card flips).
- [ ] **Task 16:** `components/workflow/ExcelColumnPickerModal.tsx`.
- [ ] **Task 17:** `components/workflow/LoadTemplateModal.tsx`.
- [ ] **Task 18:** `components/workflow/SaveTemplateModal.tsx`.
- [ ] **Task 19:** `components/workflow/ChainPreviewModal.tsx`.
- [ ] **Task 20:** `components/workflow/ErrorModal.tsx`.
- [ ] **Task 21:** `components/workflow/ShortcutsModal.tsx`.
- [ ] **Task 22:** `components/workflow/RestoreDraftModal.tsx`.
- [ ] **Task 23:** `components/workflow/NodeRunDetails.tsx`.
- [ ] **Task 24:** `components/workflow/RunProgressPanel.tsx`.
- [ ] **Task 25:** `components/workflow/SuccessCelebration.tsx` (confetti/gradient accents stay).
- [ ] **Task 26:** `components/workflow/TemplateNotification.tsx`.
- [ ] **Task 27:** `components/workflow/NodeContextMenu.tsx` (floating menu card flips).
- [ ] **Task 28:** `components/workflow/ExportMenu.tsx` (dropdown card flips).

### Task 29: Phase 2 gate

- [ ] Run from `frontend/`: `npx tsc --noEmit && npm run lint && npx vitest run && npm run build` — all PASS.
- [ ] Commit any lint autofixes.

---

## Phase 3 — E2E + final verification

### Task 30: Playwright theme-toggle E2E

**Files:**
- Create: `frontend/e2e/theme-toggle.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// frontend/e2e/theme-toggle.spec.ts
import { test, expect } from '@playwright/test';

// Suppress the PC-909 onboarding tour so its overlay can't intercept clicks
// (same trick as golden-path.spec.ts).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('pychain_tour_completed', '1');
  });
});

test('theme toggle flips dark<->light and persists across reload', async ({ page }) => {
  await page.goto('/');

  const html = page.locator('html');
  // Default theme is dark.
  await expect(html).toHaveClass(/dark/);

  // The toggle lives in the always-visible TopBar; in dark it offers light.
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(html).not.toHaveClass(/dark/);

  // Choice persists across a reload.
  await page.reload();
  await expect(html).not.toHaveClass(/dark/);

  // And toggles back to dark.
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(html).toHaveClass(/dark/);
});
```

- [ ] **Step 2: Run it**

Run: `cd frontend && npm run e2e -- theme-toggle.spec.ts`
Expected: PASS (1 test). The Playwright config boots both servers on port 3100 (see `playwright.config.ts`).

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/theme-toggle.spec.ts
git commit -m "test(PC-705): Playwright theme-toggle + persistence E2E"
```

---

### Task 31: Adversarial review pass

**Files:** none (review only). Best run as a Workflow with diverse lenses.

- [ ] **Regression lens:** scan the full `git diff main...HEAD` for any removed (`-`) line that dropped a
  `gray-`/`slate-`/`white` color token **without** re-adding it under `dark:`. Any such line is a dark-mode
  regression — fix it.
- [ ] **Contrast lens:** for each converted file, check the light-base text-on-bg pairs in the parity table
  give ≥ WCAG-AA-ish contrast (e.g. `text-gray-600` on `bg-white` ok; flag any `text-gray-400` left as a light
  base on white — should be `-600`). Fix violations.
- [ ] **Accent lens:** find accent body-text on light surfaces (`text-blue-400`/`text-green-400` as paragraphs
  on `bg-white`) that now look washed out; bump to `-600 dark:-400`.
- [ ] Apply fixes, re-run the Task 29 gate + Task 30 e2e.

---

### Task 32: Final verification + roadmap update

- [ ] **Step 1: Full gate (from `frontend/`)**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build && npm run e2e
```
Expected: all PASS; vitest 234; e2e golden-path + theme-toggle both green.

- [ ] **Step 2: Backend untouched sanity (from repo root)**

Run: `python -m pytest backend/tests/ -q` (use system `python`, not backend/venv — memory `backend-venv-dead`).
Expected: unchanged baseline (295) PASS — no backend files were modified.

- [ ] **Step 3: Mark PC-705 done in `ROADMAP.md`**

Change the PC-705 bullet to `✅ **PC-705**` and append a one-paragraph rationale summarizing the approach
(dark: pairs, dark default, next-themes, nodes-stay-dark, colorMode, e2e), matching the style of other ✅ items.

- [ ] **Step 4: Commit**

```bash
git add ROADMAP.md
git commit -m "docs(PC-705): mark complete"
```

- [ ] **Step 5: Merge to main + push** (per the autonomous working style — no PR gate)

```bash
git checkout main && git merge --no-ff feat/pc-705-theme-toggle -m "merge(PC-705): dark/light theme toggle" && git push origin main
```

---

## Self-review notes

- **Spec coverage:** every spec section maps to a task — plumbing (T1–T4), canvas `colorMode` (T6), custom-CSS
  + driver.js light variants (T5), parity-table chrome conversion (T8–T28), nodes-stay-dark (scope: nodes
  excluded from the file list), unit test (T1), e2e (T30), adversarial review (T31).
- **Type consistency:** `nextTheme`/`toggleLabel`/`THEME_STORAGE_KEY` defined in T1 are the exact names used in
  T2 (ThemedToaster uses `resolvedTheme` only) and T4 (ThemeToggle). `flowColorMode` is local to T6.
- **No placeholders:** all code blocks are concrete; the only non-enumerated work is the per-file class swaps,
  which are fully specified by the parity table + worked TopBar example + per-file regression check.
