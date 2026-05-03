import { WorkflowNode, WorkflowEdge, CompiledWorkflow, VariableBinding } from './types';
import { ExcelModelsNodeData } from './types';

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


