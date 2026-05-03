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

// Structural shape shared by React Flow's `Connection` and `Edge`. Using this
// instead of `Connection` keeps the function compatible with React Flow's
// `IsValidConnection` callback which is generic over the edge type and may
// receive either shape.
interface HandlePair {
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

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

export function validateConnection(connection: HandlePair): boolean {
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
