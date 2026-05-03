import { describe, it, expect } from 'vitest';
import type { Connection } from '@xyflow/react';
import { parseHandlePrefix, validateConnection } from '../edgeRules';

function makeConnection(
  sourceHandle: string | null,
  targetHandle: string | null,
): Connection {
  return {
    source: 'src',
    target: 'tgt',
    sourceHandle,
    targetHandle,
  };
}

describe('parseHandlePrefix', () => {
  it.each([
    ['flow:input', 'flow'],
    ['flow:output', 'flow'],
    ['value:model_name', 'value'],
    ['param:tinName', 'param'],
  ] as const)('extracts %s -> %s', (handle, expected) => {
    expect(parseHandlePrefix(handle)).toBe(expected);
  });

  it.each([
    ['no-prefix', null],
    ['', null],
    [null, null],
    [undefined, null],
  ] as const)('returns null for %s', (handle, expected) => {
    expect(parseHandlePrefix(handle)).toBe(expected);
  });
});

describe('validateConnection', () => {
  // Valid combinations
  it.each([
    ['flow:output', 'flow:input'],
    ['value:model_name', 'param:tinName'],
  ])('allows %s -> %s', (source, target) => {
    expect(validateConnection(makeConnection(source, target))).toBe(true);
  });

  // Invalid combinations
  it.each([
    ['flow:output', 'param:tinName'],
    ['flow:output', 'value:something'],
    ['value:model_name', 'flow:input'],
    ['value:a', 'value:b'],
    ['param:a', 'flow:input'],
    ['param:a', 'param:b'],
    ['param:a', 'value:b'],
  ])('rejects %s -> %s', (source, target) => {
    expect(validateConnection(makeConnection(source, target))).toBe(false);
  });

  // Legacy escape hatch — one or both handles unprefixed
  it('allows when source handle has no prefix', () => {
    expect(validateConnection(makeConnection('legacy', 'flow:input'))).toBe(true);
  });

  it('allows when target handle has no prefix', () => {
    expect(validateConnection(makeConnection('flow:output', 'legacy'))).toBe(true);
  });

  it('allows when both handles are null (legacy graphs)', () => {
    expect(validateConnection(makeConnection(null, null))).toBe(true);
  });
});
