// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

// driver.js touches the DOM and ships CSS; mock it so we can unit-test the tour
// wiring (step data + completion callback) without a real overlay.
const driveMock = vi.fn();
const destroyMock = vi.fn();
const hasNextStep = vi.fn(() => false);
let capturedConfig: Record<string, unknown> | null = null;

vi.mock('driver.js', () => ({
  driver: (config: Record<string, unknown>) => {
    capturedConfig = config;
    return { drive: driveMock, destroy: destroyMock, hasNextStep };
  },
}));

import { tourSteps, startTour, TOUR_POPOVER_CLASS } from '../tour';
import { TOUR_STORAGE_KEY } from '../tourStorage';

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  capturedConfig = null;
});

describe('tourSteps', () => {
  it('opens and closes with a centered (element-less) step', () => {
    expect(tourSteps.length).toBeGreaterThanOrEqual(4);
    expect(tourSteps[0].element).toBeUndefined();
    expect(tourSteps[tourSteps.length - 1].element).toBeUndefined();
  });

  it('anchors the middle steps to the stable data-tour-id hooks in order', () => {
    const anchors = tourSteps.map((s) => s.element).filter(Boolean);
    expect(anchors).toEqual([
      '[data-tour-id="excel-drop-zone"]',
      '[data-tour-id="node-palette"]',
      '[data-tour-id="workflow-canvas"]',
      '[data-tour-id="run-chain-btn"]',
    ]);
  });

  it('gives every step a title and description', () => {
    for (const step of tourSteps) {
      expect(step.popover?.title).toBeTruthy();
      expect(step.popover?.description).toBeTruthy();
    }
  });
});

describe('startTour', () => {
  it('drives driver.js with our steps and popover class', () => {
    startTour();
    expect(driveMock).toHaveBeenCalledTimes(1);
    expect(capturedConfig?.steps).toBe(tourSteps);
    expect(capturedConfig?.popoverClass).toBe(TOUR_POPOVER_CLASS);
  });

  it('marks completed and reports completed=true when finished on the last step', () => {
    hasNextStep.mockReturnValue(false);
    const onFinish = vi.fn();
    startTour({ onFinish });
    (capturedConfig?.onDestroyStarted as () => void)();
    expect(window.localStorage.getItem(TOUR_STORAGE_KEY)).toBe('1');
    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(true);
  });

  it('marks completed but reports completed=false when dismissed early', () => {
    hasNextStep.mockReturnValue(true);
    const onFinish = vi.fn();
    startTour({ onFinish });
    (capturedConfig?.onDestroyStarted as () => void)();
    expect(window.localStorage.getItem(TOUR_STORAGE_KEY)).toBe('1');
    expect(onFinish).toHaveBeenCalledWith(false);
  });
});
