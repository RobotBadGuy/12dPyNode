export type PaletteCategory =
  | 'core'
  | 'models'
  | 'views'
  | 'tin'
  | 'design'
  | 'quantities'
  | 'strings'
  | 'functions'
  | 'conditionals'
  | 'output';

export interface PaletteItem {
  type: string;
  label: string;
  category: PaletteCategory;
  keywords?: string[];
}

export const CATEGORY_ORDER: PaletteCategory[] = [
  'core',
  'models',
  'views',
  'tin',
  'design',
  'quantities',
  'strings',
  'functions',
  'conditionals',
  'output',
];

export const CATEGORY_LABELS: Record<PaletteCategory, string> = {
  core: 'Core',
  models: 'Models',
  views: 'Views',
  tin: 'TIN & Surface',
  design: 'Design',
  quantities: 'Quantities',
  strings: 'Strings',
  functions: 'Functions',
  conditionals: 'Conditionals',
  output: 'Output',
};

export const PALETTE_ITEMS: PaletteItem[] = [
  // Core
  { type: 'excelModels', label: 'Excel Models', category: 'core', keywords: ['xlsx', 'spreadsheet', 'input'] },
  { type: 'foreachModel', label: 'Foreach Model', category: 'core', keywords: ['loop', 'iterate'] },
  { type: 'setVariable', label: 'Set Variable', category: 'core', keywords: ['var'] },

  // Models
  { type: 'import', label: 'Import', category: 'models', keywords: ['dwg', 'dgn', 'ifc'] },
  { type: 'cleanModel', label: 'Clean Model', category: 'models' },
  { type: 'renameModel', label: 'Rename Model', category: 'models' },
  { type: 'createSharedModel', label: 'Create Shared Model', category: 'models' },

  // Views
  { type: 'createView', label: 'Create View', category: 'views' },
  { type: 'addModelToView', label: 'Add Model to View', category: 'views' },
  { type: 'removeModelFromView', label: 'Remove Model from View', category: 'views' },
  { type: 'deleteModelsFromView', label: 'Delete Models from View', category: 'views' },

  // TIN & Surface
  { type: 'triangulateManualOption', label: 'Triangulate Manual', category: 'tin', keywords: ['surface', 'tin'] },
  { type: 'tinFunction', label: 'TIN Function', category: 'tin', keywords: ['surface'] },
  { type: 'createContourSmoothLabel', label: 'Create Contour Smooth Label', category: 'tin', keywords: ['contour'] },
  { type: 'drapeToTin', label: 'Drape to TIN', category: 'tin', keywords: ['surface'] },
  { type: 'runOrCreateContours', label: 'Run or Create Contours', category: 'tin', keywords: ['contour'] },
  { type: 'createTrimeshFromTin', label: 'Create Trimesh from TIN', category: 'tin', keywords: ['mesh', 'surface'] },

  // Design
  { type: 'runOrCreateMtf', label: 'Run or Create MTF', category: 'design', keywords: ['mtf'] },
  { type: 'applyMtf', label: 'Run Apply MTF', category: 'design', keywords: ['mtf'] },
  { type: 'createApplyMtf', label: 'Create Apply MTF File', category: 'design', keywords: ['mtf'] },
  { type: 'createMtfFile', label: 'Create .MTF File', category: 'design', keywords: ['mtf'] },
  { type: 'createTemplateFile', label: 'Create Template File', category: 'design', keywords: ['template'] },

  // Quantities
  { type: 'getTotalSurfaceArea', label: 'Get Total Surface Area', category: 'quantities', keywords: ['area'] },
  { type: 'trimeshVolumeReport', label: 'Trimesh Volume Report', category: 'quantities', keywords: ['volume', 'mesh'] },
  { type: 'volumeTinToTin', label: 'Volume TIN to TIN', category: 'quantities', keywords: ['volume', 'surface'] },

  // Strings
  { type: 'convertLinesToVariable', label: 'Convert Lines to Variable', category: 'strings', keywords: ['var'] },

  // Functions
  { type: 'runFunction', label: 'Run Function', category: 'functions' },

  // Conditionals
  { type: 'addComment', label: 'Add Comment', category: 'conditionals', keywords: ['note'] },
  { type: 'addLabel', label: 'Add Label', category: 'conditionals', keywords: ['marker'] },
  { type: 'ifFunctionExists', label: 'If Function Exists', category: 'conditionals', keywords: ['conditional', 'branch'] },

  // Output
  { type: 'chainFileOutput', label: 'Chain Output', category: 'output', keywords: ['export', 'save', 'chain'] },
];

export function filterPaletteItems(items: PaletteItem[], query: string): PaletteItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;
  return items.filter((item) => {
    if (item.label.toLowerCase().includes(trimmed)) return true;
    if (item.keywords?.some((kw) => kw.toLowerCase().includes(trimmed))) return true;
    return false;
  });
}
