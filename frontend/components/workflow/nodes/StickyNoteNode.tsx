'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { StickyNoteNodeData } from '@/lib/workflow/types';
import { useWorkflowRun } from '@/components/workflow/WorkflowRunContext';

// PC-908: a yellow annotation note. No handles, no execution — just inline-editable
// text the compiler ignores. Editing goes through the page via onUpdateNodeData
// (React Flow is controlled, so the node can't own its own state).
export function StickyNoteNode(props: NodeProps) {
  const { id, data, selected } = props as unknown as {
    id: string;
    data: StickyNoteNodeData;
    selected?: boolean;
  };
  const { onUpdateNodeData } = useWorkflowRun();
  const text = (data?.text as string) ?? '';

  return (
    <div
      className={`rounded-md shadow-md w-56 min-h-[88px] p-2 bg-amber-100 border ${
        selected ? 'border-amber-500 ring-1 ring-amber-400/50' : 'border-amber-300/70'
      }`}
    >
      <textarea
        value={text}
        onChange={(e) => onUpdateNodeData(id, { text: e.target.value })}
        // nodrag: typing/selecting text must not drag the node. stopPropagation
        // on keydown keeps Backspace/Delete in the textarea from bubbling to any
        // canvas-level delete handler.
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Add a note…"
        className="nodrag w-full h-full min-h-[72px] bg-transparent text-amber-900 text-xs leading-snug resize-none focus:outline-none placeholder-amber-700/50"
      />
    </div>
  );
}
