'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { EyeOff } from 'lucide-react';
import { RemoveModelFromViewNodeData } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId } from '@/lib/workflow/nodeSchemas';

export function RemoveModelFromViewNode(props: NodeProps) {
  const { data, selected } = props as unknown as {
    data: RemoveModelFromViewNodeData;
    selected?: boolean;
  };
  const schema = nodeSchemas.removeModelFromView;

  const paramItems = schema.parameters.map((param) => ({
    id: getParamHandleId(param.key),
    label: param.label,
    type: 'input' as const,
  }));

  return (
    <BaseNode
      title="Remove Model from View"
      icon={<EyeOff className="w-4 h-4 text-white" />}
      color="from-violet-500 to-purple-600"
      borderColor="rgb(139, 92, 246)"
      glowColor="rgba(139, 92, 246, 0.4)"
      nodeState={(data as any).nodeState}
      inputs={schema.flowInputs}
      outputs={schema.flowOutputs}
      selected={selected as boolean | undefined}
    >
      <div className="text-xs text-white/80">
        <p className="text-white/60">Pattern: {data.pattern || '*'}</p>
        <NodePortSection title="Parameters" items={paramItems} />
      </div>
    </BaseNode>
  );
}


