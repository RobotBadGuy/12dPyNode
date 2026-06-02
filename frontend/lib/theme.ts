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
