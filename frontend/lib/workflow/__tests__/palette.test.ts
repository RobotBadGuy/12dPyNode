import { describe, it, expect } from 'vitest';
import { PALETTE_ITEMS, filterPaletteItems } from '../palette';

describe('PALETTE_ITEMS', () => {
  it('has unique node types', () => {
    const types = PALETTE_ITEMS.map((i) => i.type);
    expect(new Set(types).size).toBe(types.length);
  });
});

describe('filterPaletteItems', () => {
  it('returns all items for an empty query', () => {
    expect(filterPaletteItems(PALETTE_ITEMS, '')).toEqual(PALETTE_ITEMS);
  });

  it('returns all items for a whitespace-only query', () => {
    expect(filterPaletteItems(PALETTE_ITEMS, '   ')).toEqual(PALETTE_ITEMS);
  });

  it('matches case-insensitively against label substrings', () => {
    const result = filterPaletteItems(PALETTE_ITEMS, 'foreach');
    expect(result.some((i) => i.type === 'foreachModel')).toBe(true);
    const upper = filterPaletteItems(PALETTE_ITEMS, 'FOREACH');
    expect(upper).toEqual(result);
  });

  it('matches against keywords when label does not include query', () => {
    const result = filterPaletteItems(PALETTE_ITEMS, 'mesh');
    expect(result.some((i) => i.type === 'trimeshVolumeReport')).toBe(true);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterPaletteItems(PALETTE_ITEMS, 'xyzqq')).toEqual([]);
  });

  it('matches a query that hits multiple categories', () => {
    const result = filterPaletteItems(PALETTE_ITEMS, 'tin');
    const categories = new Set(result.map((i) => i.category));
    expect(categories.size).toBeGreaterThan(1);
  });
});
