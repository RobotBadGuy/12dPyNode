'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';

interface BaseNodeProps {
  title: string;
  icon?: React.ReactNode;
  color: string;
  inputs?: Array<{ id: string; label: string }>;
  outputs?: Array<{ id: string; label: string }>;
  paramInputs?: Array<{ id: string; label: string }>; // Parameter input handles
  valueOutputs?: Array<{ id: string; label: string }>; // Value output handles
  children?: React.ReactNode;
  selected?: boolean;
}

export function BaseNode({
  title,
  icon,
  color,
  inputs = [],
  outputs = [],
  paramInputs = [],
  valueOutputs = [],
  children,
  selected,
}: BaseNodeProps) {
  // Combine all inputs for vertical spacing
  const allInputs = [...inputs, ...paramInputs];
  const allOutputs = [...outputs, ...valueOutputs];

  // Calculate handle positions for vertical spacing
  const inputCount = allInputs.length;
  const outputCount = allOutputs.length;
  const maxHandles = Math.max(inputCount, outputCount, 1);

  return (
    <div
      className={cn(
        'rounded-xl shadow-lg border-2 min-w-[200px] relative',
        selected ? 'ring-2 ring-blue-500' : '',
        `bg-gradient-to-br ${color}`
      )}
    >
      {/* Input Handles - positioned on left edge with vertical spacing */}
      {allInputs.map((input, idx) => {
        const topPercent = inputCount > 1 ? (idx / (inputCount - 1)) * 100 : 50;
        return (
          <div key={input.id}>
            <Handle
              type="target"
              position={Position.Left}
              id={input.id}
              className={cn(
                'w-3 h-3 bg-white border-2 border-gray-800',
                input.id.startsWith('param:') ? 'bg-blue-400 border-blue-600' : ''
              )}
              style={{ top: `${topPercent}%` }}
            />
            {input.label && (
              <div
                className="absolute left-4 text-xs text-white/80 whitespace-nowrap pointer-events-none"
                style={{ top: `${topPercent}%`, transform: 'translateY(-50%)' }}
              >
                {input.label}
              </div>
            )}
          </div>
        );
      })}

      {/* Node Header */}
      <div className="px-4 py-3 border-b border-white/20">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-bold text-white text-sm">{title}</h3>
        </div>
      </div>

      {/* Node Content */}
      {children && <div className="px-4 py-3">{children}</div>}

      {/* Output Handles - positioned on right edge with vertical spacing */}
      {allOutputs.map((output, idx) => {
        const topPercent = outputCount > 1 ? (idx / (outputCount - 1)) * 100 : 50;
        return (
          <div key={output.id}>
            <Handle
              type="source"
              position={Position.Right}
              id={output.id}
              className={cn(
                'w-3 h-3 bg-white border-2 border-gray-800',
                output.id.startsWith('value:') ? 'bg-green-400 border-green-600' : ''
              )}
              style={{ top: `${topPercent}%` }}
            />
            {output.label && (
              <div
                className="absolute right-4 text-xs text-white/80 whitespace-nowrap pointer-events-none text-right"
                style={{ top: `${topPercent}%`, transform: 'translateY(-50%)' }}
              >
                {output.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


