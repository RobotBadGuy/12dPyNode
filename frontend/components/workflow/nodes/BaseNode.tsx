'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { NodeExecutionState } from '@/lib/workflow/types';

interface BaseNodeProps {
  title: string;
  icon?: React.ReactNode;
  color: string;
  borderColor?: string;
  glowColor?: string;
  nodeState?: NodeExecutionState;
  inputs?: Array<{ id: string; label: string }>;
  outputs?: Array<{ id: string; label: string }>;
  paramInputs?: Array<{ id: string; label: string }>;
  valueOutputs?: Array<{ id: string; label: string }>;
  children?: React.ReactNode;
  selected?: boolean;
}

// Default fallback colors if borderColor/glowColor not provided
const DEFAULT_BORDER = 'rgb(100, 116, 139)';
const DEFAULT_GLOW = 'rgba(100, 116, 139, 0.4)';

function getStateStyles(
  state: NodeExecutionState,
  borderColor: string,
  glowColor: string
) {
  switch (state) {
    case 'running':
      return {
        shadow: `0 0 20px ${glowColor}, 0 8px 32px rgba(0, 0, 0, 0.3)`,
        border: borderColor,
      };
    case 'success':
      return {
        shadow: `0 0 15px rgba(16, 185, 129, 0.3), 0 8px 32px rgba(0, 0, 0, 0.3)`,
        border: 'rgb(16, 185, 129)',
      };
    case 'error':
      return {
        shadow: `0 0 20px rgba(239, 68, 68, 0.4), 0 8px 32px rgba(0, 0, 0, 0.3)`,
        border: 'rgb(239, 68, 68)',
      };
    default: // idle
      return {
        shadow: `0 0 8px ${glowColor}, 0 4px 20px rgba(0, 0, 0, 0.3)`,
        border: borderColor,
      };
  }
}

export function BaseNode({
  title,
  icon,
  color,
  borderColor = DEFAULT_BORDER,
  glowColor = DEFAULT_GLOW,
  nodeState = 'idle',
  inputs = [],
  outputs = [],
  paramInputs = [],
  valueOutputs = [],
  children,
  selected,
}: BaseNodeProps) {
  const allInputs = [...inputs, ...paramInputs];
  const allOutputs = [...outputs, ...valueOutputs];
  const inputCount = allInputs.length;
  const outputCount = allOutputs.length;

  const stateStyles = getStateStyles(nodeState, borderColor, glowColor);

  // Selected state amplifies the glow
  const finalShadow = selected
    ? `0 0 25px ${glowColor}, 0 12px 40px rgba(0, 0, 0, 0.4)`
    : stateStyles.shadow;
  const finalBorder = selected ? borderColor : stateStyles.border;

  return (
    <div
      className="relative inline-block transition-transform duration-200 hover:scale-[1.02]"
    >
      {/* Input Handles */}
      {allInputs.map((input, idx) => {
        const topPercent = inputCount > 1 ? (idx / (inputCount - 1)) * 100 : 50;
        return (
          <div key={input.id}>
            <Handle
              type="target"
              position={Position.Left}
              id={input.id}
              className={cn(
                'w-3 h-3 rounded-full border-2 transition-all duration-200',
                input.id.startsWith('param:') ? '!bg-blue-400 !border-blue-600' : '!bg-slate-800 !border-slate-500'
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

      {/* Node Container */}
      <div
        className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl min-w-[200px] cursor-pointer overflow-hidden"
        style={{
          boxShadow: finalShadow,
          border: `1px solid ${finalBorder}`,
        }}
      >
        {/* Running Animation - Orbiting Border */}
        {nodeState === 'running' && (
          <>
            <div
              className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none node-spin"
              style={{
                background: `conic-gradient(from 0deg, transparent 0%, ${borderColor} 5%, transparent 10%)`,
              }}
            />
            <div
              className="absolute inset-[1px] bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl"
              style={{ zIndex: 1 }}
            />
          </>
        )}

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              {icon && (
                <div
                  className="p-2 rounded-lg"
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: `1px solid ${borderColor}`,
                    boxShadow: `0 0 12px ${glowColor}`,
                  }}
                >
                  {icon}
                </div>
              )}
              <h3 className="font-bold text-white text-sm">{title}</h3>
            </div>
          </div>

          {/* Node Content */}
          {children && <div className="px-4 py-3">{children}</div>}
        </div>

        {/* Success Badge */}
        {nodeState === 'success' && (
          <div
            className="absolute -top-2 -right-2 bg-emerald-500 rounded-full p-1.5 shadow-lg node-badge-enter z-20"
            style={{ boxShadow: '0 0 20px rgba(16, 185, 129, 0.6)' }}
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
        )}

        {/* Error Badge */}
        {nodeState === 'error' && (
          <div
            className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1.5 shadow-lg node-badge-enter z-20"
            style={{ boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)' }}
          >
            <AlertCircle className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Output Handles */}
      {allOutputs.map((output, idx) => {
        const topPercent = outputCount > 1 ? (idx / (outputCount - 1)) * 100 : 50;
        return (
          <div key={output.id}>
            <Handle
              type="source"
              position={Position.Right}
              id={output.id}
              className={cn(
                'w-3 h-3 rounded-full border-2 transition-all duration-200',
                output.id.startsWith('value:') ? '!bg-green-400 !border-green-600' : '!bg-slate-800 !border-slate-500'
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
