'use client';

import React, { useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LeftSidebarProps {
  onAddNode: (type: string, position: { x: number; y: number }) => void;
  onFileUpload: (type: 'excel' | 'model', files: File[]) => void;
  excelFile: File | null;
  modelFiles: File[];
}

export function LeftSidebar({
  onAddNode,
  onFileUpload,
  excelFile,
  modelFiles,
}: LeftSidebarProps) {
  const [dragOver, setDragOver] = useState<'excel' | 'model' | null>(null);

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
        onFileUpload('excel', [excelFiles[0]]);
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
      onFileUpload(type, type === 'excel' ? [files[0]] : files);
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
          {excelFile && (
            <div className="mt-2 flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg">
              <FileText className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-300 truncate flex-1">
                {excelFile.name}
              </span>
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
            <Button
              onClick={() => onAddNode('excelModels', { x: 100, y: 100 })}
              variant="outline"
              size="sm"
              className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Excel Models
            </Button>
            <Button
              onClick={() => onAddNode('foreachModel', { x: 300, y: 100 })}
              variant="outline"
              size="sm"
              className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Foreach Model
            </Button>
            <Button
              onClick={() => onAddNode('setVariable', { x: 500, y: 100 })}
              variant="outline"
              size="sm"
              className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Set Variable
            </Button>
            <Button
              onClick={() => onAddNode('import', { x: 700, y: 100 })}
              variant="outline"
              size="sm"
              className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button
              onClick={() => onAddNode('cleanModel', { x: 900, y: 100 })}
              variant="outline"
              size="sm"
              className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Clean Model
            </Button>
            <Button
              onClick={() => onAddNode('createView', { x: 1100, y: 100 })}
              variant="outline"
              size="sm"
              className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Create View
            </Button>
            <Button
              onClick={() => onAddNode('addModelToView', { x: 1300, y: 100 })}
              variant="outline"
              size="sm"
              className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Add Model to View
            </Button>
            <Button
              onClick={() => onAddNode('removeModelFromView', { x: 1500, y: 100 })}
              variant="outline"
              size="sm"
              className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Remove Model from View
            </Button>
            <Button
              onClick={() => onAddNode('deleteModelsFromView', { x: 1700, y: 100 })}
              variant="outline"
              size="sm"
              className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Delete Models from View
            </Button>
            <Button
              onClick={() => onAddNode('createSharedModel', { x: 1900, y: 100 })}
              variant="outline"
              size="sm"
              className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Create Shared Model
            </Button>
            <Button
              onClick={() => onAddNode('triangulateManualOption', { x: 2100, y: 100 })}
              variant="outline"
              size="sm"
              className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Triangulate Manual
            </Button>
            <Button
              onClick={() => onAddNode('tinFunction', { x: 2300, y: 100 })}
              variant="outline"
              size="sm"
              className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              TIN Function
            </Button>
            <Button
              onClick={() => onAddNode('chainFileOutput', { x: 2500, y: 100 })}
              variant="outline"
              size="sm"
              className="w-full justify-start border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Chain Output
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

