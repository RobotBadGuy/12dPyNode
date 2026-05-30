'use client';

import React, { useEffect, useRef } from 'react';
import { Copy, CopyPlus, Trash2, EyeOff, Eye, FileCode2 } from 'lucide-react';
import type { WorkflowNode } from '@/lib/workflow/types';
import { isControlFlowNode } from '@/lib/workflow/nodeKinds';

const MENU_WIDTH = 180;
const MENU_EST_HEIGHT = 168; // generous; only used to keep the menu on-screen

interface NodeContextMenuProps {
  x: number;
  y: number;
  node: WorkflowNode;
  onClose: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onToggleDisable: () => void;
  // PC-304: present only when a run's per-node XML is available for this node.
  onShowXml?: () => void;
}

export function NodeContextMenu({
  x,
  y,
  node,
  onClose,
  onDuplicate,
  onCopy,
  onDelete,
  onToggleDisable,
  onShowXml,
}: NodeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on outside-click, Escape, or scroll/zoom. Listeners are scoped to
  // the menu's open lifetime (this component is only mounted while open).
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onClose, { passive: true });
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onClose);
    };
  }, [onClose]);

  // Clamp to the viewport so the menu never renders off the right/bottom edge.
  const left = Math.min(x, window.innerWidth - MENU_WIDTH - 8);
  const top = Math.min(y, window.innerHeight - MENU_EST_HEIGHT - 8);

  const isDisabled = !!node.data?.disabled;
  const canDisable = !isControlFlowNode(node.type);

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const itemClass =
    'w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-800 transition-colors';

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 py-1 rounded-md border border-gray-700/50 bg-gray-900/95 backdrop-blur-xl shadow-xl"
      style={{ left, top, width: MENU_WIDTH }}
    >
      <button type="button" role="menuitem" className={itemClass} onClick={run(onDuplicate)}>
        <CopyPlus className="w-4 h-4" /> Duplicate
      </button>
      <button type="button" role="menuitem" className={itemClass} onClick={run(onCopy)}>
        <Copy className="w-4 h-4" /> Copy
      </button>
      {canDisable && (
        <button type="button" role="menuitem" className={itemClass} onClick={run(onToggleDisable)}>
          {isDisabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {isDisabled ? 'Enable' : 'Disable'}
        </button>
      )}
      {onShowXml && (
        <button type="button" role="menuitem" className={itemClass} onClick={run(onShowXml)}>
          <FileCode2 className="w-4 h-4" /> Show generated XML
        </button>
      )}
      <div className="my-1 border-t border-gray-700/50" />
      <button
        type="button"
        role="menuitem"
        className={`${itemClass} text-rose-300 hover:bg-rose-500/10`}
        onClick={run(onDelete)}
      >
        <Trash2 className="w-4 h-4" /> Delete
      </button>
    </div>
  );
}
