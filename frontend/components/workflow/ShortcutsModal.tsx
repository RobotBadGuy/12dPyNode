'use client';

import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  category: string;
  items: Shortcut[];
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

const mod = isMac ? '⌘' : 'Ctrl';

const SHORTCUTS: ShortcutGroup[] = [
  {
    category: 'Editing',
    items: [
      { keys: [mod, 'Z'], description: 'Undo' },
      { keys: [mod, 'Y'], description: 'Redo' },
      { keys: [mod, 'C'], description: 'Copy selection' },
      { keys: [mod, 'V'], description: 'Paste' },
    ],
  },
  {
    category: 'Canvas',
    items: [
      { keys: ['Delete'], description: 'Remove selected nodes/edges' },
      { keys: ['Space', 'Drag'], description: 'Pan the canvas' },
      { keys: ['Scroll'], description: 'Zoom in/out' },
    ],
  },
  {
    category: 'Help',
    items: [
      { keys: ['?'], description: 'Open this shortcuts dialog' },
    ],
  },
];

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts"
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {SHORTCUTS.map((group) => (
            <div key={group.category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                {group.category}
              </h3>
              <ul className="space-y-2">
                {group.items.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-300">{item.description}</span>
                    <span className="flex items-center gap-1">
                      {item.keys.map((key, kidx) => (
                        <React.Fragment key={kidx}>
                          {kidx > 0 && (
                            <span className="text-gray-500 text-xs">+</span>
                          )}
                          <kbd className="px-2 py-0.5 text-xs font-mono bg-gray-800 border border-gray-700 rounded text-gray-200 shadow-sm">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
