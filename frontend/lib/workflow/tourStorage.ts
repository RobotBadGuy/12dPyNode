// PC-909 — onboarding tour completion flag.
//
// A single guarded localStorage boolean: "has the user already seen the
// onboarding tour?". Mirrors draftStorage.ts — an SSR guard plus try/catch so a
// private-mode or quota failure is a silent no-op (the worst case is the tour
// offering again next time, which is harmless). Kept separate from draftStorage
// so the two unrelated concerns don't share a module.

export const TOUR_STORAGE_KEY = 'pychain_tour_completed';

/** True once the user has finished or dismissed the onboarding tour. */
export function isTourCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Record that the tour has been seen, so it won't auto-launch again. */
export function markTourCompleted(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, '1');
  } catch {
    // Private mode / quota exceeded — best-effort, never interrupt.
  }
}

/** Clear the flag (e.g. so a future visit re-offers the first-visit tour). */
export function resetTourCompleted(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    // ignore
  }
}
