'use client';

import React, { useState, useMemo } from 'react';
import { FileText, Upload, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PALETTE_ITEMS,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  filterPaletteItems,
  PaletteCategory,
  PaletteItem,
} from '@/lib/workflow/palette';

interface LeftSidebarProps {
  onAddNode: (type: string, position: { x: number; y: number }) => void;
  onFileUpload: (type: 'excel' | 'model', files: File[]) => void;
  excelNodes: Array<{ id: string; fileName: string }>;
  modelFiles: File[];
}

type SectionsOpen = Record<PaletteCategory, boolean>;

const INITIAL_SECTIONS_OPEN: SectionsOpen = {
  core: false,
  models: false,
  views: false,
  tin: false,
  design: false,
  quantities: false,
  strings: false,
  functions: false,
  conditionals: false,
  output: false,
};

export function LeftSidebar({
  onAddNode,
  onFileUpload,
  excelNodes,
  modelFiles,
}: LeftSidebarProps) {
  const [dragOver, setDragOver] = useState<'excel' | 'model' | null>(null);
  const [sectionsOpen, setSectionsOpen] = useState<SectionsOpen>(INITIAL_SECTIONS_OPEN);
  const [searchQuery, setSearchQuery] = useState('');

  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;

  const filteredItems = useMemo(
    () => filterPaletteItems(PALETTE_ITEMS, searchQuery),
    [searchQuery],
  );

  const itemsByCategory = useMemo(() => {
    const map = new Map<PaletteCategory, PaletteItem[]>();
    for (const item of filteredItems) {
      const existing = map.get(item.category);
      if (existing) {
        existing.push(item);
      } else {
        map.set(item.category, [item]);
      }
    }
    return map;
  }, [filteredItems]);

  const toggleSection = (key: PaletteCategory) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderNodeButton = (item: PaletteItem) => (
    <Button
      key={item.type}
      onClick={() => onAddNode(item.type, { x: 0, y: 0 })}
      variant="outline"
      size="sm"
      className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
    >
      <FileText className="w-4 h-4 mr-2" />
      {item.label}
    </Button>
  );

  const handleDragOver = (e: React.DragEvent, type: 'excel' | 'model') => {
    e.preventDefault();
    setDragOver(type);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, type: 'excel' | 'model') => {
    e.preventDefault();
    setDragOver(null);
    const files = Array.from(e.dataTransfer.files);
    if (type === 'excel') {
      const excelFiles = files.filter((f) => f.name.toLowerCase().endsWith('.xlsx'));
      if (excelFiles.length > 0) {
        onFileUpload('excel', excelFiles);
      }
    } else {
      const modelFiles = files.filter((f) =>
        ['.dwg', '.dgn', '.ifc'].some((ext) => f.name.toLowerCase().endsWith(ext))
      );
      if (modelFiles.length > 0) {
        onFileUpload('model', modelFiles);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, type: 'excel' | 'model') => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFileUpload(type, files);
    }
  };

  return (
    <div className="w-80 bg-gray-900/95 backdrop-blur-xl border-r border-gray-700/50 h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-bold text-white mb-4">File Tray</h2>

        {/* Excel Upload */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Excel Models
          </label>
          <div
            className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
              dragOver === 'excel'
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-gray-600/50 hover:border-emerald-500/70'
            }`}
            data-tour-id="excel-drop-zone"
            onDragOver={(e) => handleDragOver(e, 'excel')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'excel')}
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-400 mb-2">Drop Excel file here</p>
            <input
              type="file"
              accept=".xlsx"
              multiple
              onChange={(e) => handleFileInput(e, 'excel')}
              className="hidden"
              id="excel-upload"
            />
            <label htmlFor="excel-upload">
              <Button
                variant="outline"
                size="sm"
                className="border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                asChild
              >
                <span>Choose File</span>
              </Button>
            </label>
          </div>
          {excelNodes.length > 0 && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              <div className="text-xs text-gray-400 mb-1">
                {excelNodes.length} Excel workflow{excelNodes.length !== 1 ? 's' : ''} loaded
              </div>
              {excelNodes.map((node) => (
                <div
                  key={node.id}
                  className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg"
                >
                  <FileText className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-gray-300 truncate flex-1">
                    {node.fileName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Model Files Upload */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Model Files (DWG/DGN/IFC)
          </label>
          <div
            className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
              dragOver === 'model'
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-gray-600/50 hover:border-indigo-500/70'
            }`}
            onDragOver={(e) => handleDragOver(e, 'model')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'model')}
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-400 mb-2">Drop files here</p>
            <input
              type="file"
              accept=".dwg,.dgn,.ifc"
              multiple
              onChange={(e) => handleFileInput(e, 'model')}
              className="hidden"
              id="model-upload"
            />
            <label htmlFor="model-upload">
              <Button
                variant="outline"
                size="sm"
                className="border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                asChild
              >
                <span>Choose Files</span>
              </Button>
            </label>
          </div>
          {modelFiles.length > 0 && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {modelFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg"
                >
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs text-gray-300 truncate flex-1">
                    {file.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Node Palette */}
        <div data-tour-id="node-palette" className="border-t border-gray-700/50 pt-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Add Nodes</h3>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes…"
              className="w-full pl-8 pr-8 py-1.5 text-sm bg-gray-800/50 border border-gray-700/50 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {isSearching ? (
            // Search results: flat list grouped by category, no collapsibles
            filteredItems.length === 0 ? (
              <p className="text-xs text-gray-500 italic px-1">
                No matches for &ldquo;{trimmedQuery}&rdquo;
              </p>
            ) : (
              <div className="space-y-3">
                {CATEGORY_ORDER.map((cat) => {
                  const items = itemsByCategory.get(cat);
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={cat}>
                      <div className="text-xs font-semibold text-gray-400 mb-1">
                        {CATEGORY_LABELS[cat]}
                      </div>
                      <div className="space-y-2">{items.map(renderNodeButton)}</div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            // Default view: collapsible sections
            <div className="space-y-2">
              {CATEGORY_ORDER.map((cat) => {
                const items = itemsByCategory.get(cat) ?? [];
                if (items.length === 0) return null;
                const isOpen = sectionsOpen[cat];
                return (
                  <React.Fragment key={cat}>
                    <button
                      type="button"
                      onClick={() => toggleSection(cat)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-gray-300 mt-4 mb-2 hover:text-gray-200 transition-colors"
                    >
                      <span>{CATEGORY_LABELS[cat]}</span>
                      <span className="text-gray-500 text-lg">{isOpen ? '−' : '+'}</span>
                    </button>
                    {isOpen && <>{items.map(renderNodeButton)}</>}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
