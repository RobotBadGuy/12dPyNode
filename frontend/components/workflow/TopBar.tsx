'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Save, FolderOpen, Download, Upload, Loader2, RotateCcw, RotateCw, Home, User } from 'lucide-react';

interface TopBarProps {
  onRunChain?: () => void;
  onSaveTemplate?: () => void;
  onLoadTemplate?: () => void;
  onExportTemplate?: () => void;
  onImportTemplate?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isRunning?: boolean;
  canRun?: boolean;
  onNavigate?: (page: string) => void;
  currentPage?: string;
}

export function TopBar({
  onRunChain,
  onSaveTemplate,
  onLoadTemplate,
  onExportTemplate,
  onImportTemplate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isRunning,
  canRun,
  onNavigate,
  currentPage = 'editor',
}: TopBarProps) {
  return (
    <div className="h-16 bg-gray-900/95 backdrop-blur-xl border-b border-gray-700/50 flex items-center justify-between px-6 shadow-lg">
      <div className="flex items-center gap-4">
        <h1
          className="text-xl font-bold text-white cursor-pointer"
          onClick={() => onNavigate?.('landing')}
        >
          12d Pynode.{' '}
          <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
            Connect nodes. Create chains.
          </span>
        </h1>

        <div className="flex items-center gap-1 ml-4">
          <Button
            onClick={() => onNavigate?.('landing')}
            variant="ghost"
            size="sm"
            className={`text-gray-300 hover:bg-gray-800/50 ${currentPage === 'landing' ? 'bg-gray-800/70 text-white' : ''}`}
            title="Home"
          >
            <Home className="w-4 h-4 mr-1.5" />
            Home
          </Button>
          <Button
            onClick={() => onNavigate?.('profile')}
            variant="ghost"
            size="sm"
            className={`text-gray-300 hover:bg-gray-800/50 ${currentPage === 'profile' ? 'bg-gray-800/70 text-white' : ''}`}
            title="Profile"
          >
            <User className="w-4 h-4 mr-1.5" />
            Profile
          </Button>
        </div>
      </div>

      {currentPage === 'editor' && (
        <div className="flex items-center gap-3">
          <Button
            onClick={onUndo}
            disabled={!canUndo}
            variant="outline"
            size="sm"
            className="border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Undo
          </Button>
          <Button
            onClick={onRedo}
            disabled={!canRedo}
            variant="outline"
            size="sm"
            className="border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
            title="Redo (Ctrl+Y)"
          >
            <RotateCw className="w-4 h-4 mr-2" />
            Redo
          </Button>
          <Button
            onClick={onImportTemplate}
            variant="outline"
            size="sm"
            className="border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button
            onClick={onExportTemplate}
            variant="outline"
            size="sm"
            className="border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={onLoadTemplate}
            variant="outline"
            size="sm"
            className="border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Load
          </Button>
          <Button
            onClick={onSaveTemplate}
            variant="outline"
            size="sm"
            className="border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Template
          </Button>
          <Button
            onClick={onRunChain}
            disabled={!canRun || isRunning}
            size="lg"
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold px-8 disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Run Chain
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}


