'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ImageDown, FileImage, FileCode2, ChevronDown } from 'lucide-react';
import type { ExportImageFormat } from '@/lib/workflow/exportImage';

interface ExportMenuProps {
  onExport: (format: ExportImageFormat) => void;
  disabled?: boolean;
}

// PC-910 — canvas Panel control: an "Export" button that drops down to PNG/SVG.
// Dismissal mirrors NodeContextMenu (outside-click + Escape); listeners are
// only attached while the menu is open.
export function ExportMenu({ onExport, disabled }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (format: ExportImageFormat) => {
    setOpen(false);
    onExport(format);
  };

  const itemClass =
    'w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-800 transition-colors';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-2 bg-gray-900/80 border border-gray-700 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 text-sm font-medium px-3 py-2 rounded-md shadow"
        title="Export the canvas as an image"
        aria-label="Export canvas as image"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ImageDown className="w-4 h-4" />
        Export
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-44 py-1 rounded-md border border-gray-700/50 bg-gray-900/95 backdrop-blur-xl shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => choose('png')}
          >
            <FileImage className="w-4 h-4" /> PNG image
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => choose('svg')}
          >
            <FileCode2 className="w-4 h-4" /> SVG vector
          </button>
        </div>
      )}
    </div>
  );
}
