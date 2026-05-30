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

// Decimal int/float, optional sign, optional scientific exponent — exactly what
// Python's float() accepts (minus nan/inf, excluded below). Plain Number() also
// parses hex/binary/octal literals ('0x10','0b1','0o7') that float() rejects, so
// gating on this regex keeps the frontend check in parity with the backend.
const NUMERIC_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

function canCoerceNumber(value: unknown): boolean {
  if (typeof value === 'boolean') return false; // mirror: bool is not a number
  if (typeof value === 'number') return Number.isFinite(value);
  const text = String(value).trim();
  if (text === '') return false;
  if (!NUMERIC_RE.test(text)) return false; // rejects 'abc', '1,000', '0x10', 'nan', 'Infinity'
  // Belt-and-suspenders: an enormous literal like '1e400' matches the regex but
  // overflows to Infinity — Python float() yields inf there too and is rejected.
  return Number.isFinite(Number(text));
}

/** Human-readable parity with the backend VariableCoercionError message. */
export function coerceErrorMessage(varName: string, type: VariableType, value: unknown): string {
  const name = varName ? ` '${varName}'` : '';
  return `variable${name} (${type}): can't parse ${JSON.stringify(value)}`;
}
