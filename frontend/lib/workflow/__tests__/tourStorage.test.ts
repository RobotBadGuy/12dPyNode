// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  TOUR_STORAGE_KEY,
  isTourCompleted,
  markTourCompleted,
  resetTourCompleted,
} from '../tourStorage';

afterEach(() => {
  window.localStorage.clear();
});

describe('tour completion flag', () => {
  it('is false when nothing is stored', () => {
    expect(isTourCompleted()).toBe(false);
  });

  it('markTourCompleted persists a flag that isTourCompleted reads back', () => {
    markTourCompleted();
    expect(window.localStorage.getItem(TOUR_STORAGE_KEY)).toBe('1');
    expect(isTourCompleted()).toBe(true);
  });

  it('resetTourCompleted clears the flag', () => {
    markTourCompleted();
    resetTourCompleted();
    expect(window.localStorage.getItem(TOUR_STORAGE_KEY)).toBeNull();
    expect(isTourCompleted()).toBe(false);
  });

  it('treats any value other than "1" as not completed', () => {
    window.localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    expect(isTourCompleted()).toBe(false);
  });
});
