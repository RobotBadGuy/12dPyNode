'use client';

import React, { useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LeftSidebarProps {
  onAddNode: (type: string, position: { x: number; y: number }) => void;
  onFileUpload: (type: 'excel' | 'model', files: File[]) => void;
  excelNodes: Array<{ id: string; fileName: string }>;
  modelFiles: File[];
}

export function LeftSidebar({
  onAddNode,
  onFileUpload,
  excelNodes,
  modelFiles,
}: LeftSidebarProps) {
  const [dragOver, setDragOver] = useState<'excel' | 'model' | null>(null);
  const [sectionsOpen, setSectionsOpen] = useState({
    core: false,
    functions: false,
    models: false,
    views: false,
    tin: false,
    design: false,
    quantities: false,
    strings: false,
    conditionals: false,
    output: false,
  });

  const toggleSection = (key: keyof typeof sectionsOpen) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Section Header Component
  const SectionHeader = ({
    title,
    sectionKey,
  }: {
    title: string;
    sectionKey: keyof typeof sectionsOpen;
  }) => {
    return (
      <button
        type="button"
        onClick={() => toggleSection(sectionKey)}
        className="w-full flex items-center justify-between text-xs font-semibold text-gray-300 mt-4 mb-2 hover:text-gray-200 transition-colors"
      >
        <span>{title}</span>
        <span className="text-gray-500 text-lg">
          {sectionsOpen[sectionKey] ? '−' : '+'}
        </span>
      </button>
    );
  };

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
      const excelFiles = files.filter((f) => f.name.endsWith('.xlsx'));
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
        <div className="border-t border-gray-700/50 pt-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Add Nodes</h3>
          <div className="space-y-2">
            {/* Core Section */}
            <SectionHeader title="Core" sectionKey="core" />
            {sectionsOpen.core && (
              <>
                <Button
                  onClick={() => onAddNode('excelModels', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Excel Models
                </Button>
                <Button
                  onClick={() => onAddNode('foreachModel', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Foreach Model
                </Button>
                <Button
                  onClick={() => onAddNode('setVariable', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Set Variable
                </Button>
              </>
            )}

            {/* Models Section */}
            <SectionHeader title="Models" sectionKey="models" />
            {sectionsOpen.models && (
              <>
                <Button
                  onClick={() => onAddNode('import', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Import
                </Button>
                <Button
                  onClick={() => onAddNode('cleanModel', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Clean Model
                </Button>
                <Button
                  onClick={() => onAddNode('renameModel', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Rename Model
                </Button>
                <Button
                  onClick={() => onAddNode('createSharedModel', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Create Shared Model
                </Button>
              </>
            )}

            {/* Views Section */}
            <SectionHeader title="Views" sectionKey="views" />
            {sectionsOpen.views && (
              <>
                <Button
                  onClick={() => onAddNode('createView', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Create View
                </Button>
                <Button
                  onClick={() => onAddNode('addModelToView', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Add Model to View
                </Button>
                <Button
                  onClick={() => onAddNode('removeModelFromView', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Remove Model from View
                </Button>
                <Button
                  onClick={() => onAddNode('deleteModelsFromView', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Delete Models from View
                </Button>
              </>
            )}

            {/* TIN & Surface Section */}
            <SectionHeader title="TIN & Surface" sectionKey="tin" />
            {sectionsOpen.tin && (
              <>
                <Button
                  onClick={() => onAddNode('triangulateManualOption', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Triangulate Manual
                </Button>
                <Button
                  onClick={() => onAddNode('tinFunction', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  TIN Function
                </Button>
                <Button
                  onClick={() => onAddNode('createContourSmoothLabel', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Create Contour Smooth Label
                </Button>
                <Button
                  onClick={() => onAddNode('drapeToTin', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Drape to TIN
                </Button>
                <Button
                  onClick={() => onAddNode('runOrCreateContours', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Run or Create Contours
                </Button>
                <Button
                  onClick={() => onAddNode('createTrimeshFromTin', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Create Trimesh from TIN
                </Button>
              </>
            )}

            {/* Design Section */}
            <SectionHeader title="Design" sectionKey="design" />
            {sectionsOpen.design && (
              <>
                <Button
                  onClick={() => onAddNode('runOrCreateMtf', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Run or Create MTF
                </Button>
                <Button
                  onClick={() => onAddNode('applyMtf', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Run Apply MTF
                </Button>
                <Button
                  onClick={() => onAddNode('createApplyMtf', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Create Apply MTF File
                </Button>
                <Button
                  onClick={() => onAddNode('createMtfFile', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Create .MTF File
                </Button>
              </>
            )}

            {/* Quantities Section */}
            <SectionHeader title="Quantities" sectionKey="quantities" />
            {sectionsOpen.quantities && (
              <>
                <Button
                  onClick={() => onAddNode('getTotalSurfaceArea', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Get Total Surface Area
                </Button>
                <Button
                  onClick={() => onAddNode('trimeshVolumeReport', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Trimesh Volume Report
                </Button>
                <Button
                  onClick={() => onAddNode('volumeTinToTin', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Volume TIN to TIN
                </Button>
              </>
            )}

            {/* Strings Section */}
            <SectionHeader title="Strings" sectionKey="strings" />
            {sectionsOpen.strings && (
              <>
                <Button
                  onClick={() => onAddNode('convertLinesToVariable', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Convert Lines to Variable
                </Button>
              </>
            )}

            {/* Functions Section */}
            <SectionHeader title="Functions" sectionKey="functions" />
            {sectionsOpen.functions && (
              <>
                <Button
                  onClick={() => onAddNode('runFunction', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Run Function
                </Button>
              </>
            )}

            {/* Conditionals Section */}
            <SectionHeader title="Conditionals" sectionKey="conditionals" />
            {sectionsOpen.conditionals && (
              <>
                <Button
                  onClick={() => onAddNode('addComment', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Add Comment
                </Button>
                <Button
                  onClick={() => onAddNode('addLabel', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Add Label
                </Button>
                <Button
                  onClick={() => onAddNode('ifFunctionExists', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  If Function Exists
                </Button>
              </>
            )}

            {/* Output Section */}
            <SectionHeader title="Output" sectionKey="output" />
            {sectionsOpen.output && (
              <>
                <Button
                  onClick={() => onAddNode('chainFileOutput', { x: 0, y: 0 })}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Chain Output
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

