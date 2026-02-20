'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { Eye } from 'lucide-react';
import { AddModelToViewNodeData } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId } from '@/lib/workflow/nodeSchemas';

export function AddModelToViewNode(props: NodeProps) {
  const { data, selected } = props as unknown as {
    data: AddModelToViewNodeData;
    selected?: boolean;
  };
  const schema = nodeSchemas.addModelToView;

  const paramItems = schema.parameters.map((param) => ({
    id: getParamHandleId(param.key),
    label: param.label,
    type: 'input' as const,
  }));

  return (
    <BaseNode
      title="Add Model to View"
      icon={<Eye className="w-4 h-4 text-white" />}
      color="from-violet-500 to-purple-600"
      borderColor="rgb(139, 92, 246)"
      glowColor="rgba(139, 92, 246, 0.4)"
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


