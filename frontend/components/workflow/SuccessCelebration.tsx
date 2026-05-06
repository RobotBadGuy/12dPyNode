'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Download, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface FailedModel {
  model: string;
  error: string | null;
}

interface SuccessCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  fileCount?: number;
  totalModels?: number;
  failedModels?: FailedModel[];
}

export function SuccessCelebration({
  isOpen,
  onClose,
  fileCount,
  totalModels,
  failedModels,
}: SuccessCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [failuresExpanded, setFailuresExpanded] = useState(false);

  const failed = failedModels ?? [];
  const succeeded = fileCount ?? 0;
  const total = totalModels ?? succeeded + failed.length;

  const allFailed = failed.length > 0 && succeeded === 0;
  const partial = failed.length > 0 && succeeded > 0;
  const fullSuccess = failed.length === 0;

  useEffect(() => {
    if (!isOpen || !fullSuccess) {
      setShowConfetti(false);
      return;
    }
    setShowConfetti(true);
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, [isOpen, fullSuccess]);

  useEffect(() => {
    if (!isOpen) setFailuresExpanded(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const tone = allFailed ? 'error' : partial ? 'warning' : 'success';
  const borderClass =
    tone === 'success' ? 'border-emerald-500/50'
      : tone === 'warning' ? 'border-amber-500/50'
        : 'border-rose-500/50';
  const iconBgClass =
    tone === 'success' ? 'from-emerald-500 to-green-600'
      : tone === 'warning' ? 'from-amber-500 to-orange-600'
        : 'from-rose-500 to-red-600';
  const ringPulseClass =
    tone === 'success' ? 'bg-emerald-500/20'
      : tone === 'warning' ? 'bg-amber-500/20'
        : 'bg-rose-500/20';
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' ? AlertTriangle : XCircle;

  const title =
    tone === 'success' ? '🎉 Success! 🎉'
      : tone === 'warning' ? 'Workflow completed with errors'
        : 'Workflow failed';

  const message =
    tone === 'success' ? 'Your workflow has completed successfully!'
      : tone === 'warning' ? `${succeeded} of ${total} models succeeded.`
        : `All ${total} models failed. The ZIP contains _summary.txt for diagnosis.`;

  return (
    <>
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
                  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b',
                  '#ef4444', '#ec4899', '#06b6d4',
                ][Math.floor(Math.random() * 7)],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
        <div
          className={`bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border-2 ${borderClass} p-8 max-w-md w-full animate-in fade-in zoom-in duration-300`}
        >
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className={`absolute inset-0 ${ringPulseClass} rounded-full animate-ping`} />
              <div className={`relative bg-gradient-to-br ${iconBgClass} rounded-full p-4`}>
                <Icon className="w-16 h-16 text-white" />
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-center text-white mb-2">{title}</h2>

          <p className="text-center text-gray-300 mb-4">{message}</p>

          {fileCount !== undefined && fileCount > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-4">
              <p className="text-center text-emerald-400 font-semibold">
                <Sparkles className="w-4 h-4 inline mr-2" />
                {fileCount} chain file{fileCount !== 1 ? 's' : ''} generated
              </p>
            </div>
          )}

          {failed.length > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 mb-6">
              <button
                type="button"
                onClick={() => setFailuresExpanded((v) => !v)}
                className="w-full text-left text-sm text-rose-300 font-semibold flex items-center justify-between"
              >
                <span>
                  {failed.length} model{failed.length !== 1 ? 's' : ''} failed
                </span>
                <span aria-hidden>{failuresExpanded ? '▾' : '▸'}</span>
              </button>
              {failuresExpanded && (
                <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {failed.map((f) => (
                    <li key={f.model} className="text-xs text-gray-200">
                      <div className="font-semibold text-white">{f.model}</div>
                      <div className="font-mono text-rose-300 break-all">{f.error ?? '(no error message)'}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {fullSuccess && (
            <div className="flex justify-center mb-6">
              <div className="animate-bounce">
                <Download className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
          )}

          <Button
            onClick={onClose}
            className={
              tone === 'success'
                ? 'w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold py-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-emerald-500/50'
                : tone === 'warning'
                  ? 'w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold py-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-amber-500/50'
                  : 'w-full bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-semibold py-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-rose-500/50'
            }
          >
            {tone === 'success' ? 'Awesome!' : 'Close'}
          </Button>
        </div>
      </div>
    </>
  );
}
