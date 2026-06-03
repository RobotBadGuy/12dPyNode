// PC-1101 — client-side `.chain` importer. Parses a 12d chain (DOMParser) and
// reconstructs an editable React Flow graph: cleanly-invertible commands become
// real nodes, everything else becomes a stickyNote placeholder (raw XML kept), and
// a foreachModel + chainFileOutput scaffold is synthesized. Element matching is by
// `localName` because the .chain XML uses a default namespace.

import type { WorkflowNode, WorkflowEdge } from './types';
import { CHAIN_COMMAND_MAP } from './chainCommandMap';
import { nodeSchemas } from './nodeSchemas';
import { autoLayout } from './autoLayout';

export interface ParsedChain {
  commands: Element[];
}
export interface ParseError {
  error: string;
}

export interface ChainImportReport {
  total: number;
  mapped: number;
  placeholders: { element: string; count: number }[];
  modelSourceMissing: boolean;
}
export interface ImportedGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  report: ChainImportReport;
}

const FOREACH_ID = 'imported-foreach';
const OUTPUT_ID = 'imported-output';
// A <Label> immediately before one of these leads a multi-element command group
// (tinFunction / triangulate / runOrCreateContours) rather than being a standalone addLabel.
const GROUP_FOLLOWERS = new Set(['Function', 'Manual_option']);

function firstByLocalName(root: Document, localName: string): Element | null {
  const all = root.getElementsByTagName('*');
  for (const e of Array.from(all)) if (e.localName === localName) return e;
  return null;
}

export function parseChainXml(text: string): ParsedChain | ParseError {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  // Browsers + jsdom signal a parse failure with a <parsererror> element in the result.
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return { error: "Couldn't parse the file as XML. Is it a valid .chain file?" };
  }
  const commandsEl = firstByLocalName(doc, 'Commands');
  if (!commandsEl) {
    return { error: "This doesn't look like a 12d .chain file (no <Commands> section)." };
  }
  return { commands: Array.from(commandsEl.children) };
}

function schemaDefaults(nodeType: string): Record<string, unknown> {
  const schema = (nodeSchemas as Record<string, { parameters: { key: string; defaultValue: unknown }[] }>)[nodeType];
  const out: Record<string, unknown> = {};
  for (const p of schema?.parameters ?? []) out[p.key] = p.defaultValue;
  return out;
}

function newNode(id: string, type: string, data: Record<string, unknown>): WorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, data } as unknown as WorkflowNode;
}

function flowEdge(source: string, target: string): WorkflowEdge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    sourceHandle: 'flow:output',
    targetHandle: 'flow:input',
  } as unknown as WorkflowEdge;
}

export function chainToGraph(parsed: ParsedChain): ImportedGraph {
  const cmdNodes: WorkflowNode[] = [];
  const placeholderCounts = new Map<string, number>();
  let mapped = 0;

  parsed.commands.forEach((el, i) => {
    const name = el.localName;
    const mapping = CHAIN_COMMAND_MAP[name];
    const isStandaloneLabel =
      name === 'Label' && !GROUP_FOLLOWERS.has(parsed.commands[i + 1]?.localName ?? '');
    const id = `imported-${i}`;

    if (mapping && (name !== 'Label' || isStandaloneLabel)) {
      const data = { ...schemaDefaults(mapping.nodeType), ...mapping.toData(el) };
      const label = (data as Record<string, unknown>).commandName ?? (data as Record<string, unknown>).labelName;
      cmdNodes.push(newNode(id, mapping.nodeType, { ...data, ...(label ? { label } : {}) }));
      mapped += 1;
    } else {
      placeholderCounts.set(name, (placeholderCounts.get(name) ?? 0) + 1);
      const raw = new XMLSerializer().serializeToString(el);
      cmdNodes.push(
        newNode(id, 'stickyNote', { text: `[Unmapped 12d command: ${name}]\n\n${raw.slice(0, 1200)}` }),
      );
    }
  });

  const foreach = newNode(FOREACH_ID, 'foreachModel', { collection: '' });
  const output = newNode(OUTPUT_ID, 'chainFileOutput', { modelName: '', projectFolder: '', modelType: 'Model' });

  const ordered = [foreach, ...cmdNodes, output];
  const edges: WorkflowEdge[] = [];
  for (let i = 0; i < ordered.length - 1; i++) edges.push(flowEdge(ordered[i].id, ordered[i + 1].id));

  const laidOut = autoLayout(ordered, edges);

  return {
    nodes: laidOut,
    edges,
    report: {
      total: parsed.commands.length,
      mapped,
      placeholders: [...placeholderCounts.entries()].map(([element, count]) => ({ element, count })),
      modelSourceMissing: true,
    },
  };
}
