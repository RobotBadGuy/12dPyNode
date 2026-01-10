'use client';

import React, { useState, useEffect } from 'react';
import { Save, X, FileText, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  existingTemplateNames?: string[];
}

export function SaveTemplateModal({
  isOpen,
  onClose,
  onSave,
  existingTemplateNames = [],
}: SaveTemplateModalProps) {
  const [templateName, setTemplateName] = useState('');
  const [error, setError] = useState('');
  const [showSparkles, setShowSparkles] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTemplateName('');
      setError('');
      setShowSparkles(true);
      const timer = setTimeout(() => setShowSparkles(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSave = () => {
    const trimmedName = templateName.trim();
    
    if (!trimmedName) {
      setError('Template name is required');
      return;
    }

    if (existingTemplateNames.includes(trimmedName)) {
      setError('A template with this name already exists');
      return;
    }

    onSave(trimmedName);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border-2 border-blue-500/50 p-8 max-w-md w-full animate-in fade-in zoom-in duration-300">
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
            Give your workflow template a memorable name
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

          {/* Stats */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6">
            <div className="flex items-center justify-center gap-4 text-xs text-blue-300">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {existingTemplateNames.length} saved template{existingTemplateNames.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}


















