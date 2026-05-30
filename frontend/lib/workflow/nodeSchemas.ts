/**
 * Node schema definitions for workflow nodes
 * Describes parameters, handles, and value outputs for each node type
 */

export type ParameterKind = 'string' | 'number' | 'boolean' | 'tuple' | 'select' | 'variable-list';

export interface ParameterDefinition {
  key: string;
  label: string;
  kind: ParameterKind;
  defaultValue?: any;
  options?: string[]; // For select type
}

export interface NodeSchema {
  parameters: ParameterDefinition[];
  flowInputs: Array<{ id: string; label: string }>;
  flowOutputs: Array<{ id: string; label: string }>;
  valueOutputs?: Array<{ id: string; label: string; token: string }>; // value:<token> handles
}

export const nodeSchemas: Record<string, NodeSchema> = {
  // PC-908: sticky note — a pure annotation, no parameters and no handles.
  stickyNote: {
    parameters: [],
    flowInputs: [],
    flowOutputs: [],
    valueOutputs: [],
  },
  excelModels: {
    parameters: [],
    flowInputs: [],
    flowOutputs: [{ id: 'flow:models', label: 'models' }],
    valueOutputs: [],
  },
  manualModels: {
    parameters: [],
    flowInputs: [],
    flowOutputs: [{ id: 'flow:models', label: 'models' }],
    valueOutputs: [],
  },
  foreachModel: {
    parameters: [
      {
        key: 'collection',
        label: 'Collection',
        kind: 'string', // Using string for now, but semantically it's an array reference
        defaultValue: '',
      },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [
      { id: 'value:model_name', label: 'model_name', token: 'model_name' },
      { id: 'value:modified_variable', label: 'modified_variable', token: 'modified_variable' },
    ],
  },
  setVariable: {
    parameters: [
      {
        key: 'variables',
        label: 'Variables',
        kind: 'variable-list', // Special: array of VariableBinding objects
        defaultValue: [],
      },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    // Value outputs are dynamic based on variables array
    valueOutputs: [], // Will be computed from variables
  },
  import: {
    parameters: [
      {
        key: 'fileType',
        label: 'File Type',
        kind: 'select',
        defaultValue: 'dwg',
        options: ['ifc', 'dwg', 'dgn'],
      },
      {
        key: 'filePath',
        label: 'File Path',
        kind: 'string',
        defaultValue: '',
      },
      { key: 'PrePostfixForModels', label: 'Pre*postfix for model', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  cleanModel: {
    parameters: [
      { key: 'modelName', label: 'Model Name', kind: 'string', defaultValue: '' },
      { key: 'commandName', label: 'Command Name', kind: 'string', defaultValue: 'Clean model' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: true },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  createView: {
    parameters: [
      { key: 'modifiedVariable', label: 'View Name', kind: 'string', defaultValue: '' },
      {
        key: 'coordinates',
        label: 'View Coordinates',
        kind: 'tuple',
        defaultValue: [40, 30, 565, 715],
      },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  addModelToView: {
    parameters: [
      { key: 'modelName', label: 'Model Name', kind: 'string', defaultValue: '' },
      { key: 'viewName', label: 'View Name', kind: 'string', defaultValue: '' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: 'true' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  removeModelFromView: {
    parameters: [
      { key: 'pattern', label: 'Pattern', kind: 'string', defaultValue: '*' },
      { key: 'modifiedVariable', label: 'Model Name', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  deleteModelsFromView: {
    parameters: [
      { key: 'modifiedVariable', label: 'View Name', kind: 'string', defaultValue: '' },
      { key: 'coordinates', label: 'Coordinates (Box)', kind: 'string', defaultValue: '40, 30, 565, 715' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: 'true' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  createSharedModel: {
    parameters: [
      { key: 'discipline', label: 'Discipline', kind: 'string', defaultValue: '' },
      { key: 'prefix', label: 'Prefix', kind: 'string', defaultValue: '' },
      { key: 'description', label: 'Description', kind: 'string', defaultValue: '' },
      { key: 'objectDimension', label: 'Object Dimension', kind: 'string', defaultValue: '' },
      { key: 'fileExt', label: 'File Extension', kind: 'string', defaultValue: '' },
      { key: 'variable', label: 'Variable', kind: 'string', defaultValue: '' },
      { key: 'modifiedVariable', label: 'View Name', kind: 'string', defaultValue: '' },
      { key: 'commandName', label: 'Command Name', kind: 'string', defaultValue: 'Create Shared Model' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: 'true' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  triangulateManualOption: {
    parameters: [
      { key: 'modifiedVariable', label: 'Modified Variable', kind: 'string', defaultValue: '' },
      { key: 'prefix', label: 'Prefix', kind: 'string', defaultValue: '' },
      { key: 'surfaceValue', label: 'Surface Value', kind: 'string', defaultValue: '' },
      { key: 'fileExt', label: 'File Extension', kind: 'string', defaultValue: '' },
      { key: 'optionsExt', label: 'Options Extension', kind: 'string', defaultValue: '' },
      { key: 'discipline', label: 'Discipline', kind: 'string', defaultValue: '' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: 'true' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  tinFunction: {
    parameters: [{ key: 'modifiedVariable', label: 'Modified Variable', kind: 'string', defaultValue: '' }],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  chainFileOutput: {
    parameters: [
      { key: 'modelName', label: 'Model Name', kind: 'string', defaultValue: '' },
      { key: 'projectFolder', label: 'Project Folder', kind: 'string', defaultValue: '' },
      {
        key: 'modelType',
        label: 'Model Type',
        kind: 'select',
        defaultValue: 'Model',
        options: ['Model', 'TIN'],
      },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [],
    valueOutputs: [],
  },
  renameModel: {
    parameters: [
      { key: 'patternSearch', label: 'Pattern Search', kind: 'string', defaultValue: '' },
      { key: 'patternReplace', label: 'Pattern Replace', kind: 'string', defaultValue: '' },
      { key: 'commandName', label: 'Command Name', kind: 'string', defaultValue: 'Rename model' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: true },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  getTotalSurfaceArea: {
    parameters: [
      { key: 'exportLocation', label: 'Export Location', kind: 'string', defaultValue: '' },
      { key: 'tinName', label: 'TIN Name', kind: 'string', defaultValue: '' },
      { key: 'polygonName', label: 'Polygon Name', kind: 'string', defaultValue: '' },
      { key: 'commandName', label: 'Command Name', kind: 'string', defaultValue: 'Get Total Surface Area' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: 'true' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  trimeshVolumeReport: {
    parameters: [
      { key: 'trimeshName', label: 'Trimesh Name', kind: 'string', defaultValue: '' },
      { key: 'outputLocation', label: 'Output Location', kind: 'string', defaultValue: '' },
      { key: 'filename', label: 'Filename', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  volumeTinToTin: {
    parameters: [
      { key: 'originalTinName', label: 'Original TIN Name', kind: 'string', defaultValue: '' },
      { key: 'newTinName', label: 'New TIN Name', kind: 'string', defaultValue: '' },
      { key: 'outputLocation', label: 'Output Location', kind: 'string', defaultValue: '' },
      { key: 'filename', label: 'Filename', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  convertLinesToVariable: {
    parameters: [
      { key: 'modelName', label: 'Model Name', kind: 'string', defaultValue: '' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: 'true' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  createContourSmoothLabel: {
    parameters: [
      { key: 'prefix', label: 'Prefix', kind: 'string', defaultValue: '' },
      { key: 'cellValue', label: 'Cell Value', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  drapeToTin: {
    parameters: [
      { key: 'dataToDrape', label: 'Data to Drape', kind: 'string', defaultValue: '' },
      { key: 'zOffset', label: 'Z Offset', kind: 'string', defaultValue: '0' },
      { key: 'tinName', label: 'TIN Name', kind: 'string', defaultValue: '' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: 'true' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  runFunction: {
    parameters: [
      { key: 'commandName', label: 'Command Name', kind: 'string', defaultValue: '' },
      { key: 'functionName', label: 'Function Name', kind: 'string', defaultValue: '' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: 'true' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  runOrCreateContours: {
    parameters: [
      { key: 'prefix', label: 'Prefix', kind: 'string', defaultValue: '' },
      { key: 'cellValue', label: 'Cell Value', kind: 'string', defaultValue: '' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: 'true' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  runOrCreateMtf: {
    parameters: [
      { key: 'prefix', label: 'Prefix', kind: 'string', defaultValue: '' },
      { key: 'cellValue', label: 'Cell Value', kind: 'string', defaultValue: '' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: 'true' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  applyMtf: {
    parameters: [
      { key: 'functionName', label: 'Function Name', kind: 'string', defaultValue: 'function_name' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: 'true' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  createApplyMtf: {
    parameters: [
      { key: 'prefix', label: 'Prefix', kind: 'string', defaultValue: '' },
      { key: 'cellValue', label: 'Cell Value', kind: 'string', defaultValue: '' },
      { key: 'functionName', label: 'Function Name', kind: 'string', defaultValue: 'function_name' },
      { key: 'mtfFileName', label: 'MTF File Name', kind: 'string', defaultValue: 'mtf_file_name' },
      {
        key: 'referenceModelName',
        label: 'Reference Model Name',
        kind: 'string',
        defaultValue: 'reference_model_name',
      },
      {
        key: 'volumesReportName',
        label: 'Volumes Report Name',
        kind: 'string',
        defaultValue: 'volumes_report_name',
      },
      {
        key: 'stringModelName',
        label: 'String Model Name',
        kind: 'string',
        defaultValue: 'string_model_name',
      },
      {
        key: 'sectionModelName',
        label: 'Section Model Name',
        kind: 'string',
        defaultValue: 'section_model_name',
      },
      {
        key: 'roadTinModelName',
        label: 'Road TIN Model Name',
        kind: 'string',
        defaultValue: 'road_tin_model_name',
      },
      {
        key: 'modelForTinName',
        label: 'Model for TIN Name',
        kind: 'string',
        defaultValue: 'model_for_tin_name',
      },
      {
        key: 'tadpoleModelName',
        label: 'Tadpole Model Name',
        kind: 'string',
        defaultValue: 'tadpole_model_name',
      },
      {
        key: 'polygonModelName',
        label: 'Polygon Model Name',
        kind: 'string',
        defaultValue: '',
      },
      {
        key: 'boundaryModelName',
        label: 'Boundary Model Name',
        kind: 'string',
        defaultValue: '',
      },
      { key: 'actualFilePath', label: 'Actual File Path', kind: 'string', defaultValue: '' },
      { key: 'commandName', label: 'Command Name', kind: 'string', defaultValue: 'Create MTF file' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: 'true' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  createMtfFile: {
    parameters: [
      { key: 'mtfName', label: 'MTF Name', kind: 'string', defaultValue: '' },
      { key: 'templateLeftName', label: 'Template Left Name', kind: 'string', defaultValue: '' },
      { key: 'templateRightName', label: 'Template Right Name', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  createTemplateFile: {
    parameters: [
      { key: 'templateName', label: 'Template Name', kind: 'string', defaultValue: '' },
      { key: 'finalCutSlope', label: 'Final Cut Slope', kind: 'string', defaultValue: '2' },
      { key: 'finalFillSlope', label: 'Final Fill Slope', kind: 'string', defaultValue: '2' },
      { key: 'finalSearchDistance', label: 'Final Search Distance', kind: 'string', defaultValue: '100' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  createTrimeshFromTin: {
    parameters: [
      { key: 'prefix', label: 'Prefix', kind: 'string', defaultValue: '' },
      { key: 'cellValue', label: 'Cell Value', kind: 'string', defaultValue: '' },
      { key: 'trimeshName', label: 'Trimesh Name', kind: 'string', defaultValue: '' },
      { key: 'tinName', label: 'TIN Name', kind: 'string', defaultValue: '' },
      { key: 'zOffset', label: 'Z Offset', kind: 'string', defaultValue: '0' },
      { key: 'depth', label: 'Depth', kind: 'string', defaultValue: '1' },
      { key: 'colour', label: 'Colour', kind: 'string', defaultValue: '' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: 'true' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  addComment: {
    parameters: [
      { key: 'commentName', label: 'Comment Name', kind: 'string', defaultValue: '' },
      { key: 'volumesReportName', label: 'Volumes Report Name', kind: 'string', defaultValue: '' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: 'true' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  addLabel: {
    parameters: [
      { key: 'labelName', label: 'Label', kind: 'string', defaultValue: '' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: 'true' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
  ifFunctionExists: {
    parameters: [
      { key: 'functionName', label: 'Function Name', kind: 'string', defaultValue: '' },
      { key: 'passActionGoToLabel', label: 'Pass Action Go To Label', kind: 'string', defaultValue: '' },
      { key: 'failActionGoToLabel', label: 'Fail Action Label', kind: 'string', defaultValue: '' },
      { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: 'true' },
      { key: 'comments', label: 'Comments', kind: 'string', defaultValue: '' },
    ],
    flowInputs: [{ id: 'flow:input', label: 'input' }],
    flowOutputs: [{ id: 'flow:output', label: 'output' }],
    valueOutputs: [],
  },
};

/**
 * Get parameter input handle ID for a given parameter key
 */
export function getParamHandleId(paramKey: string): string {
  return `param:${paramKey}`;
}

/**
 * Extract parameter key from a parameter handle ID
 */
export function getParamKeyFromHandle(handleId: string): string | null {
  if (handleId.startsWith('param:')) {
    return handleId.substring(6);
  }
  return null;
}

/**
 * Check if a handle ID is a flow handle
 */
export function isFlowHandle(handleId: string | null | undefined): boolean {
  if (!handleId) return true; // Default to flow if no handle specified
  return handleId.startsWith('flow:') || !handleId.includes(':');
}

/**
 * Check if a handle ID is a parameter handle
 */
export function isParamHandle(handleId: string | null | undefined): boolean {
  return handleId?.startsWith('param:') ?? false;
}

/**
 * Check if a handle ID is a value output handle
 */
export function isValueHandle(handleId: string | null | undefined): boolean {
  return handleId?.startsWith('value:') ?? false;
}

/**
 * Extract token from a value output handle ID
 */
export function getTokenFromValueHandle(handleId: string): string | null {
  if (handleId.startsWith('value:')) {
    return handleId.substring(6);
  }
  return null;
}

/**
 * Validate if an edge is valid given the nodes
 * Checks if source/target nodes exist and handles are valid
 */
export function validateEdge(
  edge: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null },
  nodes: Array<{ id: string; type: string; data?: any }>
): boolean {
  // Find source and target nodes
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  if (!sourceNode || !targetNode) {
    return false;
  }

  // Validate source handle
  if (edge.sourceHandle) {
    // Check flow handles
    if (edge.sourceHandle.startsWith('flow:')) {
      const schema = nodeSchemas[sourceNode.type];
      if (schema && !schema.flowOutputs.some((h) => h.id === edge.sourceHandle)) {
        return false;
      }
    }
    // Check value:var handles (SetVariable nodes)
    else if (edge.sourceHandle.startsWith('value:var:')) {
      if (sourceNode.type === 'setVariable') {
        const index = parseInt(edge.sourceHandle.replace('value:var:', ''));
        const variables = sourceNode.data?.variables || [];
        if (isNaN(index) || index < 0 || index >= variables.length) {
          return false;
        }
      } else {
        return false;
      }
    }
    // Check value:model handles (ExcelModels nodes)
    else if (edge.sourceHandle.startsWith('value:model:')) {
      if (sourceNode.type === 'excelModels') {
        const index = parseInt(edge.sourceHandle.replace('value:model:', ''));
        const modelNames = sourceNode.data?.modelNames || [];
        if (isNaN(index) || index < 0 || index >= modelNames.length) {
          return false;
        }
      } else {
        return false;
      }
    }
    // Check value:model_name and other value outputs
    else if (edge.sourceHandle.startsWith('value:')) {
      const schema = nodeSchemas[sourceNode.type];
      if (schema && schema.valueOutputs) {
        if (!schema.valueOutputs.some((h) => h.id === edge.sourceHandle)) {
          return false;
        }
      }
    }
  }

  // Validate target handle
  if (edge.targetHandle) {
    // Check flow handles
    if (edge.targetHandle.startsWith('flow:')) {
      const schema = nodeSchemas[targetNode.type];
      if (schema && !schema.flowInputs.some((h) => h.id === edge.targetHandle)) {
        return false;
      }
    }
    // Check parameter handles
    else if (edge.targetHandle.startsWith('param:')) {
      const paramKey = edge.targetHandle.replace('param:', '');
      const schema = nodeSchemas[targetNode.type];
      if (schema && !schema.parameters.some((p) => p.key === paramKey)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Filter out invalid edges from a list
 */
export function filterValidEdges(
  edges: Array<{ source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }>,
  nodes: Array<{ id: string; type: string; data?: any }>
): Array<{ source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }> {
  return edges.filter((edge) => validateEdge(edge, nodes));
}


