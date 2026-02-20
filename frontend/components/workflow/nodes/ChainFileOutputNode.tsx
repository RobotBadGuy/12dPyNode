'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { FileCode } from 'lucide-react';
import { ChainFileOutputNodeData } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId } from '@/lib/workflow/nodeSchemas';

export function ChainFileOutputNode(props: NodeProps) {
  const { data, selected } = props as unknown as {
    data: ChainFileOutputNodeData;
    selected?: boolean;
  };
  const schema = nodeSchemas.chainFileOutput;

  const paramItems = schema.parameters.map((param) => ({
    id: getParamHandleId(param.key),
    label: param.label,
    type: 'input' as const,
  }));

  return (
    <BaseNode
      title="Chain Output"
      icon={<FileCode className="w-4 h-4 text-white" />}
      color="from-purple-500 to-pink-600"
      borderColor="rgb(168, 85, 247)"
      glowColor="rgba(168, 85, 247, 0.4)"
      nodeState={(data as any).nodeState}
      inputs={schema.flowInputs}
      outputs={schema.flowOutputs}
      selected={selected as boolean | undefined}
    >
      <div className="text-xs text-white/80">
        <p className="text-white/60">Type: {data.modelType || 'Model'}</p>
        <NodePortSection title="Parameters" items={paramItems} />
      </div>
    </BaseNode>
  );
}


