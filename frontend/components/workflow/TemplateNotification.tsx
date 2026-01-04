'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TemplateNotificationProps {
  isOpen: boolean;
  onClose: () => void;
  templateName?: string;
  nodeCount?: number;
  edgeCount?: number;
}

export function TemplateNotification({
  isOpen,
  onClose,
  templateName,
  nodeCount,
  edgeCount,
}: TemplateNotificationProps) {
  const [showSparkles, setShowSparkles] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowSparkles(true);
      const timer = setTimeout(() => setShowSparkles(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Auto-close after 4 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Sparkle Animation */}
      {showSparkles && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full animate-confetti-fall"
              style={{
                left: `${20 + Math.random() * 60}%`,
                top: '10%',
                backgroundColor: [
                  '#3b82f6', // blue
                  '#8b5cf6', // purple
                  '#10b981', // emerald
                  '#f59e0b', // amber
                  '#ec4899', // pink
                ][Math.floor(Math.random() * 5)],
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1.5 + Math.random() * 1}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Notification Toast */}
      <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl shadow-2xl border-2 border-blue-500/50 p-6 max-w-sm w-full backdrop-blur-sm">
          {/* Success Icon */}
          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
              <div className="relative bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full p-2">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {/* Title */}
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-blue-400" />
                <h3 className="text-lg font-bold text-white">
                  Template Loaded!
                </h3>
              </div>

              {/* Template Name */}
              {templateName && (
                <p className="text-sm font-semibold text-blue-300 mb-2 truncate">
                  {templateName}
                </p>
              )}

              {/* Stats */}
              {(nodeCount !== undefined || edgeCount !== undefined) && (
                <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                  {nodeCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-blue-400" />
                      {nodeCount} node{nodeCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {edgeCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      {edgeCount} connection{edgeCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}

              {/* Message */}
              <p className="text-sm text-gray-300">
                Your workflow is ready to use!
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full animate-progress"
              style={{
                animation: 'progress 4s linear forwards',
              }}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .animate-progress {
          animation: progress 4s linear forwards;
        }
      `}</style>
    </>
  );
}














