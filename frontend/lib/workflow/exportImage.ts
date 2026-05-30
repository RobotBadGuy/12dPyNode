import { toPng, toSvg } from 'html-to-image';
import type { WorkflowNode } from './types';

// PC-910 — export the React Flow canvas as a PNG/SVG image.
//
// React Flow v12 does not ship an image helper; the documented recipe captures
// the `.react-flow__viewport` element with `html-to-image` after overriding its
// transform so the whole graph (not just the on-screen slice) is rendered into
// a fixed-size frame. The geometry is split into small pure functions so the
// fiddly parts (bounds, fit-to-frame zoom, filename) are unit-testable without
// a DOM.

export type ExportImageFormat = 'png' | 'svg';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExportViewport {
  width: number;
  height: number;
  transform: { x: number; y: number; zoom: number };
}

// Matches the auto-layout defaults so an un-measured node still contributes a
// sensible footprint to the bounds (React Flow populates `measured` only after
// the node has rendered at least once).
const DEFAULT_NODE_WIDTH = 288;
const DEFAULT_NODE_HEIGHT = 140;
const DEFAULT_MARGIN = 48;
// html-to-image rasterises into a real canvas; cap the longest edge so a sprawl
// of nodes can't ask the browser for a multi-thousand-megapixel bitmap.
const DEFAULT_MAX_DIMENSION = 4096;
// gray-800 — the canvas background, so the export blends with what users see.
const DEFAULT_BACKGROUND = '#1f2937';

interface BoundsNode {
  position: { x: number; y: number };
  measured?: { width?: number; height?: number } | null;
  width?: number | null;
  height?: number | null;
}

/**
 * Axis-aligned bounding box around every node, in graph coordinates. Prefers
 * each node's measured size, then its explicit width/height, then the layout
 * defaults. Returns a zero rect for an empty graph.
 */
export function computeNodesBounds(
  nodes: BoundsNode[],
  defaults: { width?: number; height?: number } = {},
): Rect {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  const dw = defaults.width ?? DEFAULT_NODE_WIDTH;
  const dh = defaults.height ?? DEFAULT_NODE_HEIGHT;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;
    const w = node.measured?.width ?? node.width ?? dw;
    const h = node.measured?.height ?? node.height ?? dh;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Given node bounds, compute the output frame size and the viewport transform
 * that centres the graph inside it with a uniform margin. Renders at native
 * scale (zoom 1) unless the graph is larger than `maxDimension`, in which case
 * it scales down uniformly to fit.
 */
export function computeExportViewport(
  bounds: Rect,
  options: { margin?: number; maxDimension?: number } = {},
): ExportViewport {
  const margin = options.margin ?? DEFAULT_MARGIN;
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;

  // Guard degenerate (single-node / empty) bounds so we never divide by zero.
  const contentW = Math.max(bounds.width, 1);
  const contentH = Math.max(bounds.height, 1);

  // Largest zoom that keeps both edges (content + margins) within the cap.
  const budget = Math.max(maxDimension - margin * 2, 1);
  const zoom = Math.min(1, budget / contentW, budget / contentH);

  const width = Math.ceil(contentW * zoom + margin * 2);
  const height = Math.ceil(contentH * zoom + margin * 2);

  return {
    width,
    height,
    transform: {
      x: margin - bounds.x * zoom,
      y: margin - bounds.y * zoom,
      zoom,
    },
  };
}

/**
 * Turn an optional user-supplied base name into a safe download filename with
 * the right extension. Falls back to `pychain-workflow` when empty/blank.
 */
export function buildExportFileName(
  base: string | undefined,
  format: ExportImageFormat,
): string {
  const cleaned = (base ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${cleaned || 'pychain-workflow'}.${format}`;
}

function triggerDownload(dataUrl: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export interface ExportImageOptions {
  format?: ExportImageFormat;
  fileName?: string;
  backgroundColor?: string;
  margin?: number;
  maxDimension?: number;
  // Injectable for tests; defaults to the live React Flow viewport element.
  viewportElement?: HTMLElement | null;
}

/**
 * Capture the current canvas and trigger a browser download. Throws (with a
 * user-facing message) when there is nothing to export or the canvas DOM is not
 * ready, so callers can surface a toast.
 */
export async function exportCanvasImage(
  nodes: WorkflowNode[],
  options: ExportImageOptions = {},
): Promise<void> {
  if (!nodes || nodes.length === 0) {
    throw new Error('Add at least one node before exporting.');
  }

  const viewportElement =
    options.viewportElement ??
    (typeof document !== 'undefined'
      ? document.querySelector<HTMLElement>('.react-flow__viewport')
      : null);
  if (!viewportElement) {
    throw new Error('Canvas is not ready to export yet.');
  }

  const format: ExportImageFormat = options.format ?? 'png';
  const bounds = computeNodesBounds(nodes);
  const { width, height, transform } = computeExportViewport(bounds, {
    margin: options.margin,
    maxDimension: options.maxDimension,
  });

  const renderOptions = {
    backgroundColor: options.backgroundColor ?? DEFAULT_BACKGROUND,
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
    } as Partial<CSSStyleDeclaration>,
  };

  const dataUrl =
    format === 'svg'
      ? await toSvg(viewportElement, renderOptions)
      : await toPng(viewportElement, renderOptions);

  triggerDownload(dataUrl, buildExportFileName(options.fileName, format));
}
