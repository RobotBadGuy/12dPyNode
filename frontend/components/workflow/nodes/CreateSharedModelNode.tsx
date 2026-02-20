'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { Share2 } from 'lucide-react';
import { CreateSharedModelNodeData } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId } from '@/lib/workflow/nodeSchemas';

export function CreateSharedModelNode(props: NodeProps) {
  const { data, selected } = props as unknown as {
    data: CreateSharedModelNodeData;
    selected?: boolean;
  };
  const schema = nodeSchemas.createSharedModel;

  const paramItems = schema.parameters.map((param) => ({
    id: getParamHandleId(param.key),
    label: param.label,
    type: 'input' as const,
  }));

  return (
    <BaseNode
      title="Create Shared Model"
      icon={<Share2 className="w-4 h-4 text-white" />}
      color="from-indigo-500 to-blue-600"
      borderColor="rgb(99, 102, 241)"
      glowColor="rgba(99, 102, 241, 0.4)"
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


