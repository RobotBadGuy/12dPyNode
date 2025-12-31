'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuccessCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  fileCount?: number;
}

export function SuccessCelebration({ isOpen, onClose, fileCount }: SuccessCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      // Hide confetti after animation
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-confetti-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                backgroundColor: [
                  '#10b981', // emerald
                  '#3b82f6', // blue
                  '#8b5cf6', // purple
                  '#f59e0b', // amber
                  '#ef4444', // red
                  '#ec4899', // pink
                  '#06b6d4', // cyan
                ][Math.floor(Math.random() * 7)],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Success Modal */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border-2 border-emerald-500/50 p-8 max-w-md w-full animate-in fade-in zoom-in duration-300">
          {/* Success Icon with Animation */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
              <div className="relative bg-gradient-to-br from-emerald-500 to-green-600 rounded-full p-4">
                <CheckCircle2 className="w-16 h-16 text-white" />
              </div>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-center text-white mb-2">
            🎉 Success! 🎉
          </h2>

          {/* Message */}
          <p className="text-center text-gray-300 mb-4">
            Your workflow has completed successfully!
          </p>

          {fileCount !== undefined && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-6">
              <p className="text-center text-emerald-400 font-semibold">
                <Sparkles className="w-4 h-4 inline mr-2" />
                {fileCount} chain file{fileCount !== 1 ? 's' : ''} generated
              </p>
            </div>
          )}

          {/* Download Icon Animation */}
          <div className="flex justify-center mb-6">
            <div className="animate-bounce">
              <Download className="w-8 h-8 text-emerald-400" />
            </div>
          </div>

          {/* Close Button */}
          <Button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold py-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-emerald-500/50"
          >
            Awesome!
          </Button>
        </div>
      </div>

    </>
  );
}

