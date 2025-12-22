'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';

interface PortItem {
  id: string;
  label: string;
  type: 'input' | 'output';
}

interface NodePortSectionProps {
  title: string;
  items: PortItem[];
}

export function NodePortSection({ title, items }: NodePortSectionProps) {
  if (items.length === 0) return null;

  return (
    <div className="mt-2 border-t border-white/20 pt-2">
      <div className="text-[10px] font-semibold text-white/60 uppercase tracking-wide mb-1 px-1">
        {title}
      </div>
      <div className="space-y-0">
        {items.map((item, index) => (
          <div key={item.id} className="relative">
            {index > 0 && (
              <div className="absolute left-0 right-0 top-0 h-px bg-white/10" />
            )}
            <div className="relative flex items-center py-1.5 px-1">
              {item.type === 'input' && (
                <Handle
                  type="target"
                  position={Position.Left}
                  id={item.id}
                  className="w-3 h-3 bg-blue-400 border-2 border-blue-600 absolute -left-1 top-1/2 -translate-y-1/2"
                />
              )}
              <span className="text-[11px] text-white/80 flex-1 pl-2">{item.label}</span>
              {item.type === 'output' && (
                <Handle
                  type="source"
                  position={Position.Right}
                  id={item.id}
                  className="w-3 h-3 bg-green-400 border-2 border-green-600 absolute -right-1 top-1/2 -translate-y-1/2"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

