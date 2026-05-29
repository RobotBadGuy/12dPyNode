import { WorkflowNode, WorkflowEdge, CompiledWorkflow, VariableBinding } from './types';
import { nodeSchemas, getParamHandleId } from './nodeSchemas';
import { ActionableError, nodeLabel } from './errors';
import { SOURCE_NODE_TYPES, getModelSource, firstModelForTestRun } from './modelSources';

export function compileWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  sourceNodeId?: string,
  options?: { testRun?: boolean; modelSubset?: string[] },
): CompiledWorkflow | { error: ActionableError } {
  const sourceNodes = nodes.filter((n) => SOURCE_NODE_TYPES.has(n.type));
  const sourceNode = sourceNodeId
    ? sourceNodes.find((n) => n.id === sourceNodeId)
    : sourceNodes[0];

  if (!sourceNode) {
    return {
      error: {
        title: 'Add a model source',
        message: 'No Excel Models or Model List node is on the canvas yet.',
        fix: "Drag 'Excel Models' or 'Model List' from the left palette onto the canvas.",
      },
    };
  }

  const source = getModelSource(sourceNode)!; // sourceNode is a source type

  if (source.kind === 'excel' && !source.file) {
    return {
      error: {
        title: 'Load an Excel file',
        message: `'${nodeLabel(sourceNode)}' doesn't have an Excel file loaded yet.`,
        fix: 'Click the upload area inside the Excel Models node, or drag a .xlsx file onto it.',
        focusNodeId: sourceNode.id,
      },
    };
  }

  if (!source.modelNames || source.modelNames.length === 0) {
    return {
      error:
        source.kind === 'excel'
          ? {
              title: 'Excel file has no model column',
              message: `'${nodeLabel(sourceNode)}' loaded a file but no model column was selected.`,
              fix: 'Open this node and pick the column that contains model names. (PC-704 will improve this.)',
              focusNodeId: sourceNode.id,
            }
          : {
              title: 'Model List is empty',
              message: `'${nodeLabel(sourceNode)}' has no model names yet.`,
              fix: 'Select the node and type one model name per line in the Properties panel.',
              focusNodeId: sourceNode.id,
            },
    };
  }

  const foreachNode = nodes.find((n) => n.type === 'foreachModel');
  if (!foreachNode) {
    return {
      error: {
        title: 'Add a Foreach Model node',
        message: 'No Foreach Model node is on the canvas yet.',
        fix: "Drag 'Foreach Model' from the left palette and connect the source node's right handle to its left handle.",
      },
    };
  }

  const chainOutputNodes = nodes.filter((n) => n.type === 'chainFileOutput');
  if (chainOutputNodes.length === 0) {
    return {
      error: {
        title: 'Add a Chain File Output node',
        message: 'No Chain File Output node is on the canvas yet.',
        fix: "Drag 'Chain Output' from the left palette and connect a Foreach output to it.",
      },
    };
  }

  const variables: VariableBinding[] = [];
  nodes
    .filter((n) => n.type === 'setVariable')
    .forEach((node) => {
      const data = node.data as { variables: VariableBinding[] };
      if (data.variables) {
        variables.push(...data.variables);
      }
    });

  // PC-1004/PC-1005: narrow the batch to a subset via the existing
  // selectedModelNames filter. PC-1005 passes an explicit modelSubset (e.g. the
  // failed models to re-run) and it wins; otherwise PC-1004's "Test run" derives
  // the first model — header-aware for Excel (mirroring run_workflow's header
  // skip), verbatim for a manual list. source.modelNames is non-empty here, so a
  // test-run subset is always one concrete name (never silently a full run).
  const selectedSubset =
    options?.modelSubset && options.modelSubset.length > 0
      ? options.modelSubset
      : options?.testRun
        ? [
            (source.kind === 'excel'
              ? firstModelForTestRun(source.modelNames)
              : undefined) ?? source.modelNames[0],
          ]
        : undefined;

  if (source.kind === 'excel') {
    const graph: CompiledWorkflow['graph'] = { nodes, edges };
    if (selectedSubset) graph.selectedModelNames = selectedSubset;
    return {
      excelFile: source.file,
      modelNames: source.modelNames,
      selectedColumnIndex: source.selectedColumnIndex ?? 0,
      graph,
      variables,
    };
  }

  const graph: CompiledWorkflow['graph'] = { nodes, edges, modelNames: source.modelNames };
  if (selectedSubset) graph.selectedModelNames = selectedSubset;
  return {
    modelNames: source.modelNames,
    graph,
    variables,
  };
}

export function validateWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  sourceNodeId?: string,
): { valid: boolean; errors: ActionableError[] } {
  // PC-903: disabled nodes are treated as absent — so e.g. disabling the only
  // Chain File Output still correctly raises "Add a Chain File Output node".
  nodes = nodes.filter((n) => !n.data?.disabled);

  const errors: ActionableError[] = [];

  const sourceNodes = nodes.filter((n) => SOURCE_NODE_TYPES.has(n.type));
  const sourceNode = sourceNodeId
    ? sourceNodes.find((n) => n.id === sourceNodeId)
    : sourceNodes[0];
  if (!sourceNode) {
    errors.push({
      title: 'Add a model source',
      message: 'No Excel Models or Model List node is on the canvas yet.',
      fix: "Drag 'Excel Models' or 'Model List' from the left palette onto the canvas.",
    });
  }

  const foreachNode = nodes.find((n) => n.type === 'foreachModel');
  if (!foreachNode) {
    errors.push({
      title: 'Add a Foreach Model node',
      message: 'No Foreach Model node is on the canvas yet.',
      fix: "Drag 'Foreach Model' from the left palette and connect the source node's right handle to its left handle.",
    });
  }

  const chainOutputNodes = nodes.filter((n) => n.type === 'chainFileOutput');
  if (chainOutputNodes.length === 0) {
    errors.push({
      title: 'Add a Chain File Output node',
      message: 'No Chain File Output node is on the canvas yet.',
      fix: "Drag 'Chain Output' from the left palette and connect a Foreach output to it.",
    });
  }

  if (sourceNode && foreachNode) {
    const sourceToForeach = edges.find(
      (e) => e.source === sourceNode.id && e.target === foreachNode.id,
    );
    if (!sourceToForeach) {
      errors.push({
        title: "Source isn't wired to Foreach",
        message: `'${nodeLabel(sourceNode)}' isn't connected to '${nodeLabel(foreachNode)}'.`,
        fix: "Drag an edge from the source node's right handle to the Foreach node's left handle.",
        focusNodeId: foreachNode.id,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Returns an array of human-readable warning messages for a single node, based
 * on the node's data and the surrounding graph (so we can tell whether a
 * required parameter is satisfied by an incoming param edge).
 *
 * Empty array means "no warnings". Used by the canvas to surface incomplete
 * configuration before the user hits Run. NOTE: intentionally string[] not
 * ActionableError[] — the warning badge surface doesn't need actions, the
 * badge is already attached to the offending node.
 */
export function validateNode(
  node: WorkflowNode,
  _allNodes: WorkflowNode[],
  allEdges: WorkflowEdge[],
): string[] {
  // PC-903: a disabled node won't run, so it shouldn't nag with warnings.
  if (node.data?.disabled) return [];

  const warnings: string[] = [];
  const data = (node.data ?? {}) as Record<string, unknown>;

  if (node.type === 'excelModels' && !data.file) {
    warnings.push('No Excel file loaded');
  }

  if (
    node.type === 'manualModels' &&
    (!Array.isArray(data.modelNames) || (data.modelNames as string[]).length === 0)
  ) {
    warnings.push('No model names');
  }

  if (node.type === 'chainFileOutput') {
    if (!isNonEmptyString(data.modelName)) {
      warnings.push('Model name is required');
    }
    if (!isNonEmptyString(data.projectFolder)) {
      warnings.push('Project folder is required');
    }
  }

  const schema = node.type ? nodeSchemas[node.type] : undefined;
  if (schema) {
    for (const param of schema.parameters) {
      if (param.kind === 'variable-list') continue;
      const value = data[param.key];
      if (isEmptyValue(value)) {
        const handleId = getParamHandleId(param.key);
        const hasIncomingEdge = allEdges.some(
          (e) => e.target === node.id && e.targetHandle === handleId,
        );
        if (!hasIncomingEdge) {
          warnings.push(`Missing parameter: ${param.label}`);
        }
      }
    }
  }

  return warnings;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
