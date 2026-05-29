import { Node, Edge } from '@xyflow/react';

// Node execution state for visual styling
export type NodeExecutionState = 'idle' | 'running' | 'success' | 'error';

// Variable system
export interface VariableBinding {
  name: string;
  value: string | number | boolean;
  scope: 'per-run' | 'per-model';
  source?: 'excel' | 'manual' | 'computed';
}

// Node data types
export interface ExcelModelsNodeData {
  file: File | null;
  columnName: string;
  modelNames: string[];
  availableColumns: string[];
  selectedColumnIndex: number;
  [key: string]: unknown;
}

export interface ManualModelsNodeData {
  rawText: string;
  modelNames: string[];
  [key: string]: unknown;
}

export interface ForeachModelNodeData {
  currentModel: string | null;
  [key: string]: unknown;
}

export interface SetVariableNodeData {
  variables: VariableBinding[];
  [key: string]: unknown;
}

export interface ImportNodeData {
  fileType: 'ifc' | 'dwg' | 'dgn';
  filePath: string; // variable reference
  PrePostfixForModels: string;
  [key: string]: unknown;
}

export interface CleanModelNodeData {
  modelName: string; // variable reference
  comments: string; // variable reference
  continueOnFailure: boolean;
  [key: string]: unknown;
}

export interface CreateViewNodeData {
  modifiedVariable: string; // variable reference
  coordinates: [number, number, number, number];
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface AddModelToViewNodeData {
  modelName: string; // variable reference
  viewName: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface RemoveModelFromViewNodeData {
  pattern: string;
  modifiedVariable: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface DeleteModelsFromViewNodeData {
  modifiedVariable: string; // variable reference
  coordinates: [number, number];
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface CreateSharedModelNodeData {
  discipline: string; // variable reference
  prefix: string; // variable reference
  description: string; // variable reference
  objectDimension: string; // variable reference
  fileExt: string; // variable reference
  variable: string; // variable reference
  modifiedVariable: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface TriangulateManualOptionNodeData {
  modifiedVariable: string; // variable reference
  prefix: string; // variable reference
  surfaceValue: string; // variable reference
  fileExt: string; // variable reference
  optionsExt: string; // variable reference
  discipline: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface TinFunctionNodeData {
  modifiedVariable: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface IfFunctionExistsNodeData {
  functionName: string; // variable reference
  passActionGoToLabel: string; // variable reference
  failActionGoToLabel: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface RunFunctionNodeData {
  commandName: string; // variable reference
  functionName: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface LabelNodeData {
  labelName: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface RenameModelNodeData {
  patternReplace: string; // variable reference
  patternSearch: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface GetTotalSurfaceAreaNodeData {
  exportLocation: string; // variable reference
  tinName: string; // variable reference
  polygonName: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface TrimeshVolumeReportNodeData {
  trimeshName: string; // variable reference
  outputLocation: string; // variable reference
  filename: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface VolumeTinToTinNodeData {
  originalTinName: string; // variable reference
  newTinName: string; // variable reference
  outputLocation: string; // variable reference
  filename: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface ConvertLinesToVariableNodeData {
  modelName: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface CreateContourSmoothLabelNodeData {
  prefix: string; // variable reference
  cellValue: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface DrapeToTinNodeData {
  dataToDrape: string; // variable reference
  zOffset: string; // variable reference
  tinName: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface RunOrCreateContoursNodeData {
  prefix: string; // variable reference
  cellValue: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface RunOrCreateMtfNodeData {
  prefix: string; // variable reference
  cellValue: string; // variable reference
  functionName: string; // variable reference
  mtfFileName: string; // variable reference
  referenceModelName: string; // variable reference
  volumesReportName: string; // variable reference
  stringModelName: string; // variable reference
  sectionModelName: string; // variable reference
  roadTinModelName: string; // variable reference
  modelForTinName: string; // variable reference
  tadpoleModelName: string; // variable reference
  polygonModelName?: string; // variable reference (optional)
  boundaryModelName?: string; // variable reference (optional)
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface ApplyMtfNodeData {
  functionName: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface CreateApplyMtfNodeData {
  prefix: string; // variable reference
  cellValue: string; // variable reference
  functionName: string; // variable reference
  mtfFileName: string; // variable reference
  referenceModelName: string; // variable reference
  volumesReportName: string; // variable reference
  stringModelName: string; // variable reference
  sectionModelName: string; // variable reference
  roadTinModelName: string; // variable reference
  modelForTinName: string; // variable reference
  tadpoleModelName: string; // variable reference
  polygonModelName?: string; // variable reference (optional)
  boundaryModelName?: string; // variable reference (optional)
  actualFilePath: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface CreateMtfFileNodeData {
  mtfName: string; // variable or literal
  templateLeftName: string; // variable or literal
  templateRightName: string; // variable or literal
  [key: string]: unknown;
}

export interface CreateTemplateFileNodeData {
  templateName: string; // variable or literal
  finalCutSlope: string; // variable or literal
  finalFillSlope: string; // variable or literal
  finalSearchDistance: string; // variable or literal
  [key: string]: unknown;
}

export interface CreateTrimeshFromTinNodeData {
  prefix: string; // variable reference
  cellValue: string; // variable reference
  trimeshName: string; // variable reference
  tinName: string; // variable reference
  zOffset: string; // variable reference
  depth: string; // variable reference
  colour: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface AddCommentNodeData {
  commentName: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface AddLabelNodeData {
  labelName: string; // variable reference
  continueOnFailure: boolean;
  comments: string;
  [key: string]: unknown;
}

export interface ChainFileOutputNodeData {
  modelName: string; // variable reference
  projectFolder: string; // variable reference
  modelType: 'Model' | 'TIN';
  [key: string]: unknown;
}

export interface ValidationOutputNodeData {
  status: 'idle' | 'running' | 'success' | 'error';
  message: string;
  downloadUrl: string | null;
  [key: string]: unknown;
}

// Union type for all node data
export type WorkflowNodeData =
  | ExcelModelsNodeData
  | ManualModelsNodeData
  | ForeachModelNodeData
  | SetVariableNodeData
  | ImportNodeData
  | CleanModelNodeData
  | CreateViewNodeData
  | AddModelToViewNodeData
  | RemoveModelFromViewNodeData
  | DeleteModelsFromViewNodeData
  | CreateSharedModelNodeData
  | TriangulateManualOptionNodeData
  | TinFunctionNodeData
  | IfFunctionExistsNodeData
  | RenameModelNodeData
  | GetTotalSurfaceAreaNodeData
  | TrimeshVolumeReportNodeData
  | VolumeTinToTinNodeData
  | ConvertLinesToVariableNodeData
  | CreateContourSmoothLabelNodeData
  | DrapeToTinNodeData
  | RunOrCreateContoursNodeData
  | RunOrCreateMtfNodeData
  | ApplyMtfNodeData
  | CreateApplyMtfNodeData
  | CreateMtfFileNodeData
  | CreateTemplateFileNodeData
  | CreateTrimeshFromTinNodeData
  | AddCommentNodeData
  | AddLabelNodeData
  | ChainFileOutputNodeData
  | ValidationOutputNodeData
  | { mappings?: Record<string, string> };

// Node type identifiers
export type NodeType =
  | 'excelModels'
  | 'manualModels'
  | 'foreachModel'
  | 'setVariable'
  | 'import'
  | 'cleanModel'
  | 'createView'
  | 'addModelToView'
  | 'removeModelFromView'
  | 'deleteModelsFromView'
  | 'createSharedModel'
  | 'triangulateManualOption'
  | 'tinFunction'
  | 'ifFunctionExists'
  | 'renameModel'
  | 'getTotalSurfaceArea'
  | 'trimeshVolumeReport'
  | 'volumeTinToTin'
  | 'convertLinesToVariable'
  | 'createContourSmoothLabel'
  | 'drapeToTin'
  | 'runOrCreateContours'
  | 'runOrCreateMtf'
  | 'applyMtf'
  | 'createApplyMtf'
  | 'createMtfFile'
  | 'createTemplateFile'
  | 'createTrimeshFromTin'
  | 'addComment'
  | 'addLabel'
  | 'chainFileOutput'
  | 'runFunction';

// Optional fields that can ride on ANY node's data regardless of node type.
// PC-903: `disabled` excludes the node from generation while keeping it on the
// canvas. (Transient UI fields like warnings/nodeState are still read via casts.)
export interface NodeDataExtras {
  disabled?: boolean;
  // Keep an index signature so `WorkflowNodeData & NodeDataExtras` stays
  // assignable to React Flow's `Node['data']` (Record<string, unknown>) — some
  // union members (e.g. `{ mappings? }`) have no index signature on their own.
  [key: string]: unknown;
}

export interface WorkflowNode extends Node {
  type: NodeType;
  data: WorkflowNodeData & NodeDataExtras;
}

export interface WorkflowEdge extends Edge { }

// Template schema
export interface WorkflowTemplate {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: { x: number; y: number; zoom: number };
}

// PC-203: history list item — metadata only, no nodes/edges.
export interface WorkflowTemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  name: string;
  message: string | null;
  author: string | null;
  createdAt: string;
}

// PC-203: full snapshot returned when a user picks a specific version to restore.
export interface WorkflowTemplateVersionSnapshot extends WorkflowTemplateVersion {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: { x: number; y: number; zoom: number };
}

// Graph compilation result. PC-1001: excelFile/selectedColumnIndex are optional
// because a manual Model List source produces names without an Excel file;
// graph.modelNames is the wire field the backend reads in that case.
export interface CompiledWorkflow {
  excelFile?: File;
  modelNames: string[];
  selectedColumnIndex?: number;
  graph: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    selectedModelNames?: string[];
    modelNames?: string[];
  };
  variables: VariableBinding[];
}


