import { WorkflowNode, WorkflowEdge, CompiledWorkflow, VariableBinding } from './types';
import { ExcelModelsNodeData } from './types';
import { nodeSchemas, getParamHandleId } from './nodeSchemas';
import { ActionableError, nodeLabel } from './errors';

export function compileWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  excelNodeId?: string,
): CompiledWorkflow | { error: ActionableError } {
  const excelNodes = nodes.filter((n) => n.type === 'excelModels') as Array<
    WorkflowNode & { data: ExcelModelsNodeData }
  >;

  const excelNode = excelNodeId
    ? (excelNodes.find((n) => n.id === excelNodeId) as
        | (WorkflowNode & { data: ExcelModelsNodeData })
        | undefined)
    : excelNodes[0];

  if (!excelNode || !excelNode.data.file) {
    return {
      error: {
        title: 'Load an Excel file',
        message: excelNode
          ? `'${nodeLabel(excelNode)}' doesn't have an Excel file loaded yet.`
          : 'No Excel Models node has a file loaded.',
        fix: "Click the upload area inside the Excel Models node, or drag a .xlsx file onto it.",
        focusNodeId: excelNode?.id,
      },
    };
  }

  if (!excelNode.data.modelNames || excelNode.data.modelNames.length === 0) {
    return {
      error: {
        title: 'Excel file has no model column',
        message: `'${nodeLabel(excelNode)}' loaded a file but no model column was selected.`,
        fix: 'Open this node and pick the column that contains model names. (PC-704 will improve this.)',
        focusNodeId: excelNode.id,
      },
    };
  }

  const foreachNode = nodes.find((n) => n.type === 'foreachModel');
  if (!foreachNode) {
    return {
      error: {
        title: 'Add a Foreach Model node',
        message: 'No Foreach Model node is on the canvas yet.',
        fix: "Drag 'Foreach Model' from the left palette and connect the Excel node's right handle to its left handle.",
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

  return {
    excelFile: excelNode.data.file,
    modelNames: excelNode.data.modelNames,
    selectedColumnIndex: excelNode.data.selectedColumnIndex ?? 0,
    graph: { nodes, edges },
    variables,
  };
}

export function validateWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  excelNodeId?: string,
): { valid: boolean; errors: ActionableError[] } {
  // PC-903: disabled nodes are treated as absent — so e.g. disabling the only
  // Chain File Output still correctly raises "Add a Chain File Output node".
  nodes = nodes.filter((n) => !n.data?.disabled);

  const errors: ActionableError[] = [];

  const excelNodes = nodes.filter((n) => n.type === 'excelModels');
  const excelNode = excelNodeId
    ? excelNodes.find((n) => n.id === excelNodeId)
    : excelNodes[0];
  if (!excelNode) {
    errors.push({
      title: 'Add an Excel Models node',
      message: 'No Excel Models node is on the canvas yet.',
      fix: "Drag 'Excel Models' from the left palette onto the canvas, then load an .xlsx file.",
    });
  }

  const foreachNode = nodes.find((n) => n.type === 'foreachModel');
  if (!foreachNode) {
    errors.push({
      title: 'Add a Foreach Model node',
      message: 'No Foreach Model node is on the canvas yet.',
      fix: "Drag 'Foreach Model' from the left palette and connect the Excel node's right handle to its left handle.",
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

  if (excelNode && foreachNode) {
    const excelToForeach = edges.find(
      (e) => e.source === excelNode.id && e.target === foreachNode.id,
    );
    if (!excelToForeach) {
      errors.push({
        title: "Excel isn't wired to Foreach",
        message: `'${nodeLabel(excelNode)}' isn't connected to '${nodeLabel(foreachNode)}'.`,
        fix: "Drag an edge from the Excel node's right handle to the Foreach node's left handle.",
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
