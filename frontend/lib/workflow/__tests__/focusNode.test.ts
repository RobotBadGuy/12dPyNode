// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { focusNode } from '../focusNode';

describe('focusNode', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is a no-op when the target node is not in the DOM', () => {
    expect(() => focusNode('missing-id')).not.toThrow();
  });

  it('scrolls the matching node into view', () => {
    const el = document.createElement('div');
    el.setAttribute('data-id', 'n1');
    const scrollIntoView = vi.fn();
    el.scrollIntoView = scrollIntoView;
    document.body.appendChild(el);

    focusNode('n1');

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
  });

  it('adds ring classes immediately and removes them after the highlight duration', () => {
    const el = document.createElement('div');
    el.setAttribute('data-id', 'n2');
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);

    focusNode('n2', 500);

    expect(el.classList.contains('ring-4')).toBe(true);
    expect(el.classList.contains('ring-amber-500')).toBe(true);
    expect(el.classList.contains('ring-opacity-75')).toBe(true);

    vi.advanceTimersByTime(500);

    expect(el.classList.contains('ring-4')).toBe(false);
    expect(el.classList.contains('ring-amber-500')).toBe(false);
    expect(el.classList.contains('ring-opacity-75')).toBe(false);
  });

  it('escapes ids that contain CSS-sensitive characters', () => {
    const el = document.createElement('div');
    el.setAttribute('data-id', 'node.with:weird-id');
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);

    expect(() => focusNode('node.with:weird-id')).not.toThrow();
    expect(el.classList.contains('ring-4')).toBe(true);
  });
});
