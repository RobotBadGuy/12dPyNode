'use client';

import React from 'react';
import { AlertCircle, Upload, X, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  isExcelError?: boolean;
}

export function ErrorModal({ isOpen, onClose, title, message, isExcelError }: ErrorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border-2 border-red-500/50 p-8 max-w-md w-full animate-in fade-in zoom-in duration-300">
        {/* Error Icon with Animation */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
            <div className="relative bg-gradient-to-br from-red-500 to-orange-600 rounded-full p-4">
              <AlertCircle className="w-16 h-16 text-white" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-center text-white mb-2">
          {isExcelError ? '📊 Oops!' : '⚠️ Error'}
        </h2>

        {/* Message */}
        <p className="text-center text-gray-300 mb-6 leading-relaxed">
          {message}
        </p>

        {/* Excel-specific helpful info */}
        {isExcelError && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-300 font-semibold mb-2">
                  Quick Fix:
                </p>
                <ol className="text-xs text-amber-200/90 space-y-1 list-decimal list-inside">
                  <li>Go to the Excel Models node in your workflow</li>
                  <li>Click the upload area or drag & drop your .xlsx file</li>
                  <li>Wait for the file to load, then try running again</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Icon Animation */}
        {isExcelError && (
          <div className="flex justify-center mb-6">
            <div className="animate-bounce">
              <Upload className="w-8 h-8 text-amber-400" />
            </div>
          </div>
        )}

        {/* Close Button */}
        <div className="flex gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          {isExcelError && (
            <Button
              onClick={() => {
                onClose();
                // Scroll to Excel Models node or highlight it
                const excelNode = document.querySelector('[data-node-type="excelModels"]');
                if (excelNode) {
                  excelNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  // Add a temporary highlight
                  excelNode.classList.add('ring-4', 'ring-amber-500', 'ring-opacity-75');
                  setTimeout(() => {
                    excelNode.classList.remove('ring-4', 'ring-amber-500', 'ring-opacity-75');
                  }, 2000);
                }
              }}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold"
            >
              <Upload className="w-4 h-4 mr-2" />
              Find Upload
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}












