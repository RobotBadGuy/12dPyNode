import { describe, it, expect } from 'vitest';
import { formatDuration, formatRelativeTime } from '../runFormat';

describe('formatDuration', () => {
  const start = '2020-01-01T00:00:00Z';
  const at = (sec: number) => new Date(Date.parse(start) + sec * 1000).toISOString();

  it('returns null when either timestamp is missing or invalid', () => {
    expect(formatDuration(null, start)).toBeNull();
    expect(formatDuration(start, undefined)).toBeNull();
    expect(formatDuration('nope', start)).toBeNull();
  });

  it('returns null when the end precedes the start', () => {
    expect(formatDuration(at(10), start)).toBeNull();
  });

  it('formats seconds, minutes, and hours', () => {
    expect(formatDuration(start, at(5))).toBe('5s');
    expect(formatDuration(start, at(65))).toBe('1m 5s');
    expect(formatDuration(start, at(120))).toBe('2m'); // exact minute, no trailing 0s
    expect(formatDuration(start, at(3720))).toBe('1h 2m');
    expect(formatDuration(start, at(3600))).toBe('1h'); // exact hour
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2020-06-01T12:00:00Z');
  const ago = (sec: number) => new Date(now - sec * 1000).toISOString();

  it('returns empty string for missing/invalid input', () => {
    expect(formatRelativeTime(null, now)).toBe('');
    expect(formatRelativeTime('nope', now)).toBe('');
  });

  it('buckets recent times', () => {
    expect(formatRelativeTime(ago(10), now)).toBe('just now');
    expect(formatRelativeTime(ago(5 * 60), now)).toBe('5m ago');
    expect(formatRelativeTime(ago(2 * 3600), now)).toBe('2h ago');
    expect(formatRelativeTime(ago(3 * 86400), now)).toBe('3d ago');
  });

  it('treats a slightly-future timestamp (clock skew) as just now', () => {
    expect(formatRelativeTime(new Date(now + 3000).toISOString(), now)).toBe('just now');
  });

  it('falls back to a locale date beyond a week', () => {
    // Don't assert the exact locale string (timezone-dependent); just that it's
    // not one of the relative buckets.
    const out = formatRelativeTime(ago(10 * 86400), now);
    expect(out).not.toMatch(/ago|just now/);
    expect(out.length).toBeGreaterThan(0);
  });
});
