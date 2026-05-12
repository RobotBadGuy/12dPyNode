/**
 * Escape special CSS selector characters.
 * Matches the behavior of CSS.escape() from the CSS standard.
 */
function escapeCssIdentifier(str: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(str);
  }
  // Fallback for environments without CSS.escape (e.g., jsdom in tests)
  // Escape special characters that have meaning in CSS selectors
  return str.replace(/([!"#$%&'()*+,./:;?@[\\\]^`{|}~])/g, '\\$1');
}

/**
 * Scroll the React Flow node with the given id into view and briefly pulse
 * an amber ring around it. React Flow already emits data-id on its node
 * wrappers, so no DOM changes are needed on our side.
 *
 * Safe to call on the server (no-ops when document is undefined) and safe to
 * call with an id that isn't currently mounted.
 */
export function focusNode(nodeId: string, highlightMs = 2000): void {
  if (typeof document === 'undefined') return;
  const selector = `[data-id="${escapeCssIdentifier(nodeId)}"]`;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('ring-4', 'ring-amber-500', 'ring-opacity-75');
  window.setTimeout(() => {
    el.classList.remove('ring-4', 'ring-amber-500', 'ring-opacity-75');
  }, highlightMs);
}
