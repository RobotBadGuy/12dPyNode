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
