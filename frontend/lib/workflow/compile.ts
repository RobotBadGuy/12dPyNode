import { WorkflowNode, WorkflowEdge, CompiledWorkflow, VariableBinding } from './types';
import { ExcelModelsNodeData } from './types';
import { nodeSchemas, getParamHandleId } from './nodeSchemas';

export function compileWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  excelNodeId?: string
): CompiledWorkflow | { error: string } {
  // Find Excel node (optionally scoped to a specific Excel node ID)
  const excelNodes = nodes.filter((n) => n.type === 'excelModels') as Array<
    WorkflowNode & { data: ExcelModelsNodeData }
  >;

  const excelNode = excelNodeId
    ? (excelNodes.find((n) => n.id === excelNodeId) as
      | (WorkflowNode & { data: ExcelModelsNodeData })
      | undefined)
    : excelNodes[0];

  if (!excelNode || !excelNode.data.file) {
    return { error: 'Excel file node is required' };
  }

  if (!excelNode.data.modelNames || excelNode.data.modelNames.length === 0) {
    return { error: 'No model names found in Excel file' };
  }

  // Find Foreach node
  const foreachNode = nodes.find((n) => n.type === 'foreachModel');
  if (!foreachNode) {
    return { error: 'Foreach Model node is required' };
  }

  // Find ChainFileOutput nodes
  const chainOutputNodes = nodes.filter((n) => n.type === 'chainFileOutput');
  if (chainOutputNodes.length === 0) {
    return { error: 'At least one Chain File Output node is required' };
  }

  // Extract variables from SetVariable nodes
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
    graph: {
      nodes,
      edges,
    },
    variables,
  };
}

export function validateWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  excelNodeId?: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for Excel node
  const excelNodes = nodes.filter((n) => n.type === 'excelModels');
  const excelNode = excelNodeId
    ? excelNodes.find((n) => n.id === excelNodeId)
    : excelNodes[0];
  if (!excelNode) {
    errors.push('Excel Models node is required');
  }

  // Check for Foreach node
  const foreachNode = nodes.find((n) => n.type === 'foreachModel');
  if (!foreachNode) {
    errors.push('Foreach Model node is required');
  }

  // Check for ChainFileOutput
  const chainOutputNodes = nodes.filter((n) => n.type === 'chainFileOutput');
  if (chainOutputNodes.length === 0) {
    errors.push('At least one Chain File Output node is required');
  }

  // Check connectivity: Excel -> Foreach
  if (excelNode && foreachNode) {
    const excelToForeach = edges.find(
      (e) => e.source === excelNode.id && e.target === foreachNode.id
    );
    if (!excelToForeach) {
      errors.push('Excel Models node must connect to Foreach Model node');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Returns an array of human-readable warning messages for a single node, based
 * on the node's data and the surrounding graph (so we can tell whether a
 * required parameter is satisfied by an incoming param edge).
 *
 * Empty array means "no warnings". Used by the canvas to surface incomplete
 * configuration before the user hits Run.
 */
export function validateNode(
  node: WorkflowNode,
  _allNodes: WorkflowNode[],
  allEdges: WorkflowEdge[],
): string[] {
  const warnings: string[] = [];
  const data = (node.data ?? {}) as Record<string, unknown>;

  // Rule 1: excelModels must have a file loaded.
  if (node.type === 'excelModels' && !data.file) {
    warnings.push('No Excel file loaded');
  }

  // Rules 2-3: chainFileOutput needs both modelName and projectFolder. These
  // get embedded into the chain XML metadata; an empty value yields a broken
  // chain file.
  if (node.type === 'chainFileOutput') {
    if (!isNonEmptyString(data.modelName)) {
      warnings.push('Model name is required');
    }
    if (!isNonEmptyString(data.projectFolder)) {
      warnings.push('Project folder is required');
    }
  }

  // Rule 4: any param handle whose data field is empty AND has no incoming
  // param edge satisfies it. Generic so it adapts as schemas evolve.
  const schema = node.type ? nodeSchemas[node.type] : undefined;
  if (schema) {
    for (const param of schema.parameters) {
      // The variable-list param is a UI surface, not a wired-in parameter; skip.
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

