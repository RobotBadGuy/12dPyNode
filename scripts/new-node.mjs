#!/usr/bin/env node
/**
 * PyChain node scaffolder (PC-603).
 *
 * Generates the two NEW files a new node needs (the React component and the
 * backend command module) and prints exact copy-paste snippets for the five
 * shared files you must edit by hand. It deliberately does NOT auto-edit the
 * shared files — injecting into types.ts / nodeSchemas.ts / palette.ts /
 * WorkspaceCanvas.tsx / workflow_runner.py is error-prone, so we hand you the
 * snippet and the exact location instead.
 *
 * Usage:
 *   node scripts/new-node.mjs                         # interactive
 *   node scripts/new-node.mjs --type cleanModel --label "Clean Model" \
 *        --category models --backend-category models --yes
 *
 * Flags:
 *   --type              camelCase node type id, NO "Node" suffix
 *                       (e.g. cleanModel -> component CleanModelNode)   [required]
 *   --label             Human label shown in the palette                [required]
 *   --category          Palette category (core|models|views|tin|design|
 *                       quantities|strings|functions|conditionals|output)
 *   --backend-category  backend/commands/<dir> for the generator        [default: category or "other"]
 *   --icon              lucide-react icon name (e.g. Box, Sparkles)      [default: Box]
 *   --yes               non-interactive; use flags/defaults, no prompts
 *   --force             overwrite the generated files if they exist
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

const PALETTE_CATEGORIES = [
  'core', 'models', 'views', 'tin', 'design',
  'quantities', 'strings', 'functions', 'conditionals', 'output',
];

// ---------- arg parsing ----------
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'yes' || key === 'force') {
      out[key] = true;
    } else {
      out[key] = argv[++i];
    }
  }
  return out;
}

// ---------- case helpers ----------
const toPascal = (camel) => camel.charAt(0).toUpperCase() + camel.slice(1);
const toSnake = (camel) => camel.replace(/([A-Z])/g, '_$1').replace(/^_/, '').toLowerCase();
const isCamel = (s) => /^[a-z][a-zA-Z0-9]*$/.test(s);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const interactive = !args.yes;
  let rl;
  const ask = async (q, def) => {
    if (!interactive) return def ?? '';
    if (!rl) rl = createInterface({ input: stdin, output: stdout });
    const ans = (await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim();
    return ans || def || '';
  };

  const type = args.type || (await ask('Node type id (camelCase, no "Node" suffix, e.g. cleanModel)'));
  if (!isCamel(type)) {
    console.error(`\n✖ Node type "${type}" must be camelCase (start lowercase, letters/digits only).`);
    rl?.close();
    process.exit(1);
  }
  const label = args.label || (await ask('Human label (e.g. "My New Node")', toPascal(type)));
  let category = args.category || (await ask(`Palette category (${PALETTE_CATEGORIES.join('|')})`, 'models'));
  if (!PALETTE_CATEGORIES.includes(category)) {
    console.error(`\n✖ Category "${category}" is not one of: ${PALETTE_CATEGORIES.join(', ')}`);
    rl?.close();
    process.exit(1);
  }
  const backendCategory =
    args['backend-category'] || (await ask('Backend command category (backend/commands/<dir>)', category));
  const icon = args.icon || (await ask('lucide-react icon name', 'Box'));
  rl?.close();

  const Pascal = toPascal(type);
  const snake = toSnake(type);

  // ---------- target paths ----------
  const componentPath = join(REPO_ROOT, 'frontend', 'components', 'workflow', 'nodes', `${Pascal}Node.tsx`);
  const backendDir = join(REPO_ROOT, 'backend', 'commands', backendCategory);
  const backendPath = join(backendDir, `${snake}.py`);

  // ---------- guard against clobbering ----------
  for (const p of [componentPath, backendPath]) {
    if (existsSync(p) && !args.force) {
      console.error(`\n✖ ${p} already exists. Re-run with --force to overwrite.`);
      process.exit(1);
    }
  }

  // ---------- generate: React component ----------
  const componentSrc = `'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { ${icon} } from 'lucide-react';
import { ${Pascal}NodeData } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId } from '@/lib/workflow/nodeSchemas';

export function ${Pascal}Node(props: NodeProps) {
  const { data, selected } = props as unknown as {
    data: ${Pascal}NodeData;
    selected?: boolean;
  };
  const schema = nodeSchemas.${type};

  const paramItems = schema.parameters.map((param) => ({
    id: getParamHandleId(param.key),
    label: param.label,
    type: 'input' as const,
  }));

  return (
    <BaseNode
      title="${label}"
      icon={<${icon} className="w-4 h-4 text-white" />}
      color="from-slate-500 to-slate-700"
      borderColor="rgb(100, 116, 139)"
      glowColor="rgba(100, 116, 139, 0.4)"
      nodeState={(data as any).nodeState}
      warnings={(data as any).warnings}
      inputs={schema.flowInputs}
      outputs={schema.flowOutputs}
      selected={selected as boolean | undefined}
    >
      <div className="text-xs text-white/80">
        <p className="text-white/60">Ready</p>
        <NodePortSection title="Parameters" items={paramItems} />
      </div>
    </BaseNode>
  );
}
`;

  // ---------- generate: backend command module ----------
  const backendSrc = `"""
Generate ${label} command
"""
from typing import List


def ${snake}_command(
    command_name: str,
    # TODO: add your parameters here. In workflow_runner.execute_node, strings
    # are resolved via resolve_variable(...); booleans/numbers/tuples are read
    # straight from node data (coerce booleans/numbers with coerce_value).
) -> List[str]:
    """
    Generate the ${label} XML command line(s).

    Args:
        command_name: name of the command

    Returns:
        List of XML lines appended to the chain output (single-line format,
        as 12d Model expects).
    """
    # TODO: build the real 12d Model XML for this command.
    line = (
        '<Your_Command>'
            f'<Name>{command_name}</Name>'
            '<Active>true</Active>'
        '</Your_Command>'
    )
    return [line]
`;

  mkdirSync(dirname(componentPath), { recursive: true });
  mkdirSync(backendDir, { recursive: true });
  writeFileSync(componentPath, componentSrc, 'utf8');
  writeFileSync(backendPath, backendSrc, 'utf8');

  // ---------- report ----------
  const rel = (p) => p.replace(REPO_ROOT + '\\', '').replace(REPO_ROOT + '/', '').replace(/\\/g, '/');
  console.log(`\n✅ Generated:`);
  console.log(`   • ${rel(componentPath)}`);
  console.log(`   • ${rel(backendPath)}`);
  console.log(`\nNow apply these 5 edits by hand (see docs/adding-node-params.md for the full walkthrough):\n`);

  console.log(`── 1. frontend/lib/workflow/types.ts ──────────────────────────────`);
  console.log(`Add the interface, and add "| ${Pascal}NodeData" to the WorkflowNodeData union:\n`);
  console.log(`export interface ${Pascal}NodeData {`);
  console.log(`  commandName: string; // TODO: your fields (camelCase)`);
  console.log(`  [key: string]: unknown;`);
  console.log(`}\n`);

  console.log(`── 2. frontend/lib/workflow/nodeSchemas.ts ────────────────────────`);
  console.log(`Add an entry to nodeSchemas (key must match types.ts exactly):\n`);
  console.log(`  ${type}: {`);
  console.log(`    parameters: [`);
  console.log(`      { key: 'commandName', label: 'Command Name', kind: 'string', defaultValue: '${label}' },`);
  console.log(`    ],`);
  console.log(`    flowInputs: [{ id: 'flow:input', label: 'input' }],`);
  console.log(`    flowOutputs: [{ id: 'flow:output', label: 'output' }],`);
  console.log(`    valueOutputs: [],`);
  console.log(`  },\n`);

  console.log(`── 3. frontend/lib/workflow/palette.ts ────────────────────────────`);
  console.log(`Add to PALETTE_ITEMS:\n`);
  console.log(`  { type: '${type}', label: '${label}', category: '${category}', keywords: [] },\n`);

  console.log(`── 4. frontend/components/workflow/WorkspaceCanvas.tsx ─────────────`);
  console.log(`Import the component and register it in nodeTypes:\n`);
  console.log(`  import { ${Pascal}Node } from './nodes/${Pascal}Node';`);
  console.log(`  // ...inside the nodeTypes object:`);
  console.log(`  ${type}: ${Pascal}Node,\n`);

  console.log(`── 5. backend wiring ──────────────────────────────────────────────`);
  console.log(`a) backend/commands/${backendCategory}/__init__.py — re-export:\n`);
  console.log(`   from .${snake} import ${snake}_command   # and add '${snake}_command' to __all__\n`);
  console.log(`b) backend/services/workflow_runner.py — import + execute_node branch:\n`);
  console.log(`   from commands.${backendCategory} import ${snake}_command`);
  console.log(`   # ...inside execute_node():`);
  console.log(`   elif node_type == '${type}':`);
  console.log(`       command_name = resolve_variable(data.get('commandName', '${label}'), model_name, variables, per_run_vars)`);
  console.log(`       xml_content.extend(${snake}_command(command_name))\n`);

  console.log(`Then verify: cd frontend && npx tsc --noEmit && npm run build  |  cd backend && python -m pytest tests/ -q\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
