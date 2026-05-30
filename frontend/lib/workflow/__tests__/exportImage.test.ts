// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the rasteriser so the orchestrator tests run without a real canvas.
vi.mock('html-to-image', () => ({
  toPng: vi.fn(async () => 'data:image/png;base64,PNGDATA'),
  toSvg: vi.fn(async () => 'data:image/svg+xml;base64,SVGDATA'),
}));

import { toPng, toSvg } from 'html-to-image';
import {
  buildExportFileName,
  computeExportViewport,
  computeNodesBounds,
  exportCanvasImage,
  type Rect,
} from '../exportImage';
import type { WorkflowNode } from '../types';

function makeNode(
  id: string,
  x: number,
  y: number,
  overrides: Partial<WorkflowNode> = {},
): WorkflowNode {
  return {
    id,
    type: 'cleanModel',
    position: { x, y },
    data: { label: id },
    ...overrides,
  } as WorkflowNode;
}

describe('computeNodesBounds', () => {
  it('returns a zero rect for an empty graph', () => {
    expect(computeNodesBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('uses measured dimensions when present', () => {
    const node = makeNode('a', 100, 50, {
      measured: { width: 200, height: 80 },
    } as Partial<WorkflowNode>);
    expect(computeNodesBounds([node])).toEqual({ x: 100, y: 50, width: 200, height: 80 });
  });

  it('falls back to explicit width/height, then defaults', () => {
    const explicit = makeNode('a', 0, 0, { width: 120, height: 60 } as Partial<WorkflowNode>);
    expect(computeNodesBounds([explicit])).toEqual({ x: 0, y: 0, width: 120, height: 60 });

    const bare = makeNode('b', 0, 0);
    // Falls back to the layout defaults (288 x 140).
    expect(computeNodesBounds([bare])).toEqual({ x: 0, y: 0, width: 288, height: 140 });
  });

  it('spans the union of multiple nodes', () => {
    const nodes = [
      makeNode('a', 0, 0, { measured: { width: 100, height: 100 } } as Partial<WorkflowNode>),
      makeNode('b', 300, 200, { measured: { width: 100, height: 100 } } as Partial<WorkflowNode>),
    ];
    expect(computeNodesBounds(nodes)).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });

  it('respects custom default dimensions', () => {
    const bare = makeNode('a', 10, 20);
    expect(computeNodesBounds([bare], { width: 50, height: 30 })).toEqual({
      x: 10,
      y: 20,
      width: 50,
      height: 30,
    });
  });
});

describe('computeExportViewport', () => {
  it('renders at native scale (zoom 1) for a small graph and adds margins on both sides', () => {
    const bounds: Rect = { x: 0, y: 0, width: 400, height: 300 };
    const vp = computeExportViewport(bounds, { margin: 50 });
    expect(vp.transform.zoom).toBe(1);
    expect(vp.width).toBe(500); // 400 + 50*2
    expect(vp.height).toBe(400); // 300 + 50*2
    // Top-left node corner lands exactly `margin` px in from the frame edge.
    expect(vp.transform.x).toBe(50);
    expect(vp.transform.y).toBe(50);
  });

  it('offsets the transform by the bounds origin so nodes are framed regardless of position', () => {
    const bounds: Rect = { x: 1000, y: -500, width: 200, height: 200 };
    const vp = computeExportViewport(bounds, { margin: 20 });
    expect(vp.transform.zoom).toBe(1);
    expect(vp.transform.x).toBe(20 - 1000);
    expect(vp.transform.y).toBe(20 - -500);
  });

  it('scales down to fit within maxDimension for a large (landscape) graph', () => {
    const bounds: Rect = { x: 0, y: 0, width: 10000, height: 5000 };
    const vp = computeExportViewport(bounds, { margin: 0, maxDimension: 4096 });
    expect(vp.transform.zoom).toBeLessThan(1);
    // Longest edge must not exceed the cap.
    expect(Math.max(vp.width, vp.height)).toBeLessThanOrEqual(4096);
    // Scale is driven by the wider dimension here.
    expect(vp.transform.zoom).toBeCloseTo(4096 / 10000, 5);
  });

  it('scales down on the HEIGHT term for a tall graph, accounting for the margin', () => {
    // Portrait graph: contentH is the binding constraint, so the height term of
    // Math.min drives the zoom. Non-zero margin must be subtracted from the cap
    // budget (zoom = (maxDimension - margin*2) / contentH), so the framed image
    // — content + both margins — still lands at the cap, not over it.
    const bounds: Rect = { x: 0, y: 0, width: 5000, height: 10000 };
    const vp = computeExportViewport(bounds, { margin: 48, maxDimension: 4096 });
    const budget = 4096 - 48 * 2; // 4000
    expect(vp.transform.zoom).toBeCloseTo(budget / 10000, 5); // 0.4, height-driven
    expect(vp.height).toBe(4096); // content*zoom + margins hits exactly the cap
    expect(vp.width).toBeLessThan(4096); // narrow dimension stays under
    expect(Math.max(vp.width, vp.height)).toBeLessThanOrEqual(4096);
  });

  it('produces finite, non-NaN output for a degenerate (single-point) bounds', () => {
    const bounds: Rect = { x: 5, y: 5, width: 0, height: 0 };
    const vp = computeExportViewport(bounds, { margin: 10 });
    expect(Number.isFinite(vp.width)).toBe(true);
    expect(Number.isFinite(vp.height)).toBe(true);
    expect(Number.isFinite(vp.transform.zoom)).toBe(true);
    expect(vp.transform.zoom).toBe(1);
  });
});

describe('buildExportFileName', () => {
  it('defaults to pychain-workflow with the right extension', () => {
    expect(buildExportFileName(undefined, 'png')).toBe('pychain-workflow.png');
    expect(buildExportFileName('', 'svg')).toBe('pychain-workflow.svg');
    expect(buildExportFileName('   ', 'png')).toBe('pychain-workflow.png');
  });

  it('sanitises spaces and special characters into dashes', () => {
    expect(buildExportFileName('My Bridge Workflow!', 'png')).toBe('My-Bridge-Workflow.png');
  });

  it('trims leading/trailing dashes produced by sanitisation', () => {
    expect(buildExportFileName('***weird***', 'svg')).toBe('weird.svg');
  });

  it('keeps already-safe names intact', () => {
    expect(buildExportFileName('road_01-align', 'png')).toBe('road_01-align.png');
  });
});

describe('exportCanvasImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects when there are no nodes', async () => {
    await expect(exportCanvasImage([], { viewportElement: document.createElement('div') })).rejects.toThrow(
      /at least one node/i,
    );
    expect(toPng).not.toHaveBeenCalled();
  });

  it('rejects when the viewport element is missing', async () => {
    // No `.react-flow__viewport` exists in this bare jsdom document.
    await expect(exportCanvasImage([makeNode('a', 0, 0)])).rejects.toThrow(/not ready/i);
  });

  it('renders a PNG and triggers a download with a .png filename', async () => {
    const el = document.createElement('div');
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    await exportCanvasImage([makeNode('a', 0, 0, { measured: { width: 100, height: 60 } } as Partial<WorkflowNode>)], {
      viewportElement: el,
      fileName: 'My Graph',
    });

    expect(toPng).toHaveBeenCalledTimes(1);
    expect(toSvg).not.toHaveBeenCalled();
    const [target, opts] = (toPng as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(target).toBe(el);
    expect(opts.width).toBeGreaterThan(0);
    expect(opts.height).toBeGreaterThan(0);
    expect(opts.style.transform).toMatch(/^translate\(.*\) scale\(1\)$/);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('renders an SVG when format is svg', async () => {
    const el = document.createElement('div');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await exportCanvasImage([makeNode('a', 0, 0)], { viewportElement: el, format: 'svg' });

    expect(toSvg).toHaveBeenCalledTimes(1);
    expect(toPng).not.toHaveBeenCalled();
  });
});
