// PC-401 — frontend mirror of backend services/type_coercion.coerce_value.
// Pure, no DOM. Used by validateNode for a pre-run warning. The accept-lists
// MUST stay in parity with the backend (tested against the same table).

export type VariableType = 'string' | 'number' | 'boolean';

const BOOL_TRUE = new Set(['true', '1', 'yes', 'on']);
const BOOL_FALSE = new Set(['false', '0', 'no', 'off']);

/** Returns true if `value` can be coerced to `type`. `string` always succeeds. */
export function coerceCheck(value: unknown, type: VariableType): boolean {
  if (type === 'string') return true;
  if (type === 'boolean') return canCoerceBool(value);
  if (type === 'number') return canCoerceNumber(value);
  return true; // unknown type treated as string
}

function canCoerceBool(value: unknown): boolean {
  if (typeof value === 'boolean') return true;
  const text = String(value).trim().toLowerCase();
  return BOOL_TRUE.has(text) || BOOL_FALSE.has(text);
}

function canCoerceNumber(value: unknown): boolean {
  if (typeof value === 'boolean') return false; // mirror: bool is not a number
  if (typeof value === 'number') return Number.isFinite(value);
  const text = String(value).trim();
  if (text === '') return false;
  // Number() rejects '1,000' and 'abc' (-> NaN); 'inf'/'nan' -> NaN too (only
  // 'Infinity' parses, which isFinite then excludes). Whitespace already trimmed.
  const n = Number(text);
  return Number.isFinite(n);
}

/** Human-readable parity with the backend VariableCoercionError message. */
export function coerceErrorMessage(varName: string, type: VariableType, value: unknown): string {
  const name = varName ? ` '${varName}'` : '';
  return `variable${name} (${type}): can't parse ${JSON.stringify(value)}`;
}
