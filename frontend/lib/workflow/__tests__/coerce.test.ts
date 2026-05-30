import { describe, it, expect } from 'vitest';
import { coerceCheck, coerceErrorMessage } from '../coerce';

describe('coerceCheck', () => {
  it('string always coerces', () => {
    expect(coerceCheck('anything', 'string')).toBe(true);
    expect(coerceCheck(13, 'string')).toBe(true);
  });

  it.each(['true', 'True', ' true ', '1', 'yes', 'on', true])(
    'boolean accepts %s',
    (raw) => expect(coerceCheck(raw as unknown, 'boolean')).toBe(true),
  );

  it.each(['false', 'False', '0', 'no', 'off', false])(
    'boolean accepts falsy %s',
    (raw) => expect(coerceCheck(raw as unknown, 'boolean')).toBe(true),
  );

  it.each(['maybe', '', '2'])(
    'boolean rejects %s',
    (raw) => expect(coerceCheck(raw as unknown, 'boolean')).toBe(false),
  );

  it('number accepts ints, floats, 13.0, whitespace, negatives, scientific, partial decimals', () => {
    // Keep this list in parity with backend test_type_coercion.py TestNumber.
    for (const ok of ['13', '13.0', '1.5', '-4', ' 7 ', '1e3', '1E-2', '.5', '5.', '-0', 13, 1.5]) {
      expect(coerceCheck(ok as unknown, 'number')).toBe(true);
    }
  });

  // Parity guard: JS Number() would accept hex/binary/octal/Infinity, but Python
  // float() rejects them — these MUST be rejected on both sides (see backend mirror).
  it.each(['abc', '', '1,000', 'nan', 'inf', 'Infinity', '0x10', '0b1', '0o10'])(
    'number rejects %s',
    (raw) => expect(coerceCheck(raw as unknown, 'number')).toBe(false),
  );

  it('number rejects a boolean', () => {
    expect(coerceCheck(true, 'number')).toBe(false);
  });

  it('coerceErrorMessage names the variable, type, and value', () => {
    const msg = coerceErrorMessage('depth', 'number', 'abc');
    expect(msg).toContain('depth');
    expect(msg).toContain('number');
    expect(msg).toContain('abc');
  });
});
