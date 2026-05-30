'use client';

import { driver, type DriveStep } from 'driver.js';
import { markTourCompleted } from './tourStorage';

// PC-909 — first-time onboarding tour.
//
// A driver.js spotlight tour that walks a new user through the core loop:
// add a model source -> build with the palette -> connect the steps on the
// canvas -> run the chain. Steps anchor to stable `data-tour-id` hooks on the
// real UI chrome (added in LeftSidebar / WorkspaceCanvas / TopBar) rather than
// to transient graph nodes, so the tour is robust on an empty canvas and never
// mutates the user's work.
//
// The step list is exported as plain data so it can be unit-tested without a
// DOM; startTour() is the thin impure wrapper that drives driver.js.

export interface TourCallbacks {
  // Fired once when the tour ends (finished OR dismissed). `completed` is true
  // only when the user reached the final step. Either way the completion flag is
  // persisted so the tour won't auto-launch again.
  onFinish?: (completed: boolean) => void;
}

export const TOUR_POPOVER_CLASS = 'pychain-tour';

/** The ordered onboarding steps. Pure data → unit-testable. */
export const tourSteps: DriveStep[] = [
  {
    popover: {
      title: '👋 Welcome to PyChain',
      description:
        'Build a 12d Model chain visually: pick your models, drop in steps, wire them together, and generate one .chain file per model. This 30-second tour shows the core loop.',
    },
  },
  {
    element: '[data-tour-id="excel-drop-zone"]',
    popover: {
      title: '1. Add your models',
      description:
        'Start here. Drop an Excel file (or drag it onto the canvas) to create a Model Source — one chain file is generated per model name. Prefer typing names? Add a “Model List” node from the palette instead.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="node-palette"]',
    popover: {
      title: '2. Build your workflow',
      description:
        'Drag nodes from the palette onto the canvas — clean models, create views, triangulate, and more. Use the search box to find a step fast.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="workflow-canvas"]',
    popover: {
      title: '3. Connect the steps',
      description:
        'Drag from a node’s right-hand handle to the next node’s left handle to set the order. A Foreach Model → … → Chain File Output path defines what each model runs.',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '[data-tour-id="run-chain-btn"]',
    popover: {
      title: '4. Generate your chains',
      description:
        'When the graph is ready, hit Run Chain to generate and download your .chain files. You can also run straight from a source node’s ▶ button, or test a single model first.',
      side: 'bottom',
      align: 'end',
    },
  },
  {
    popover: {
      title: 'You’re all set 🎉',
      description:
        'That’s the loop: models → steps → connect → run. Replay this tour anytime from the graduation-cap button in the toolbar. Happy building!',
    },
  },
];

/**
 * Launch the onboarding tour. Safe to call from a click handler or a mount
 * effect (it touches the DOM, so it is browser-only). Marks the tour completed
 * when it ends — whether the user finished or skipped — and forwards the
 * outcome to the optional callback.
 */
export function startTour(callbacks: TourCallbacks = {}): void {
  if (typeof window === 'undefined') return;

  const driverObj = driver({
    showProgress: true,
    allowClose: true,
    overlayOpacity: 0.6,
    stagePadding: 6,
    popoverClass: TOUR_POPOVER_CLASS,
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    steps: tourSteps,
    onDestroyStarted: () => {
      // Defining this hook means driver.js no longer auto-destroys, so we must
      // call destroy() ourselves. We're "completed" only when there is no next
      // step left (i.e. the user is on the final step), not when they bail out
      // early via the close button / overlay / Escape.
      const completed = !driverObj.hasNextStep();
      markTourCompleted();
      driverObj.destroy();
      callbacks.onFinish?.(completed);
    },
  });

  driverObj.drive();
}
