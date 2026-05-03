'use client';

import React, { useState, useEffect } from 'react';
import { Save, X, FileText, Sparkles, AlertCircle, GitBranch, FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type SaveMode = 'new' | 'update';

export interface SaveTemplateOptions {
  mode: SaveMode;
  message?: string;
}

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, options: SaveTemplateOptions) => void;
  savedTemplateCount?: number;
  // PC-203: when a template is currently loaded on the canvas, the modal
  // offers a second action — "Save Changes" — which writes a new version of
  // that template instead of creating a brand-new one.
  loadedTemplate?: { id: string; name: string } | null;
}

export function SaveTemplateModal({
  isOpen,
  onClose,
  onSave,
  savedTemplateCount = 0,
  loadedTemplate = null,
}: SaveTemplateModalProps) {
  const [templateName, setTemplateName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showSparkles, setShowSparkles] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTemplateName(loadedTemplate?.name ?? '');
      setMessage('');
      setError('');
      setShowSparkles(true);
      const timer = setTimeout(() => setShowSparkles(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, loadedTemplate]);

  const submit = (mode: SaveMode) => {
    const trimmedName = templateName.trim();

    if (!trimmedName) {
      setError('Template name is required');
      return;
    }

    onSave(trimmedName, {
      mode,
      message: message.trim() || undefined,
    });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Default action: update if a template is loaded, otherwise new.
      submit(loadedTemplate ? 'update' : 'new');
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Sparkle Animation */}
      {showSparkles && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full animate-confetti-fall"
              style={{
                left: `${30 + Math.random() * 40}%`,
                top: '15%',
                backgroundColor: [
                  '#3b82f6', // blue
                  '#8b5cf6', // purple
                  '#10b981', // emerald
                  '#f59e0b', // amber
                ][Math.floor(Math.random() * 4)],
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1.5 + Math.random() * 1}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border-2 border-blue-500/50 p-8 max-w-md w-full animate-in fade-in zoom-in duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
              <div className="relative bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full p-4">
                <Save className="w-16 h-16 text-white" />
              </div>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-center text-white mb-2">
            💾 Save Template
          </h2>

          {/* Description */}
          <p className="text-center text-gray-300 mb-6">
            {loadedTemplate
              ? <>Save changes to <span className="text-blue-300 font-semibold">{loadedTemplate.name}</span> or fork it as a new template.</>
              : 'Give your workflow template a memorable name'}
          </p>

          {/* Input */}
          <div className="space-y-2 mb-4">
            <Label htmlFor="template-name" className="text-sm font-semibold text-gray-300">
              Template Name
            </Label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => {
                  setTemplateName(e.target.value);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder="My Awesome Workflow"
                className="bg-gray-800 border-gray-700 text-white text-base h-12 pl-10 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                autoFocus
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Optional commit message — surfaces as the version's note in history */}
          <div className="space-y-2 mb-4">
            <Label htmlFor="template-note" className="text-sm font-semibold text-gray-300">
              Note <span className="text-gray-500 font-normal">(optional)</span>
            </Label>
            <textarea
              id="template-note"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What changed in this version?"
              rows={2}
              className="w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-700 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>

          {/* Stats */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6">
            <div className="flex items-center justify-center gap-4 text-xs text-blue-300">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {savedTemplateCount} saved template{savedTemplateCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            {loadedTemplate ? (
              <>
                <Button
                  onClick={() => submit('new')}
                  variant="outline"
                  className="flex-1 border-blue-500/40 text-blue-300 hover:bg-blue-500/10 hover:text-blue-200"
                  title="Save as a brand-new template, starting at v1"
                >
                  <FilePlus2 className="w-4 h-4 mr-2" />
                  Save as New
                </Button>
                <Button
                  onClick={() => submit('update')}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold"
                  title="Append a new version to this template"
                >
                  <GitBranch className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button
                onClick={() => submit('new')}
                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
