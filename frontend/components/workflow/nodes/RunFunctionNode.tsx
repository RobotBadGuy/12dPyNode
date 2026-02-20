'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { Play } from 'lucide-react';
import { RunFunctionNodeData } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId } from '@/lib/workflow/nodeSchemas';

export function RunFunctionNode(props: NodeProps) {
  const { data, selected } = props as unknown as {
    data: RunFunctionNodeData;
    selected?: boolean;
  };
  const schema = nodeSchemas.runFunction;

  const paramItems = schema.parameters.map((param) => ({
    id: getParamHandleId(param.key),
    label: param.label,
    type: 'input' as const,
  }));

  return (
    <BaseNode
      title="Run Function"
      icon={<Play className="w-4 h-4 text-white" />}
      color="from-violet-500 to-purple-600"
      borderColor="rgb(236, 72, 153)"
      glowColor="rgba(236, 72, 153, 0.4)"
      nodeState={(data as any).nodeState}
      inputs={schema.flowInputs}
      outputs={schema.flowOutputs}
      selected={selected as boolean | undefined}
    >
      <div className="text-xs text-white/80">
        <p className="text-white/60">Ready</p>
        <NodePortSection title="Parameters" items={paramItems} />
      </div>
    </BaseNode>
  );
}