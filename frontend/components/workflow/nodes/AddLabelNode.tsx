'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { Tag } from 'lucide-react';
import { AddLabelNodeData } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId } from '@/lib/workflow/nodeSchemas';

export function AddLabelNode(props: NodeProps) {
  const { data, selected } = props as unknown as {
    data: AddLabelNodeData;
    selected?: boolean;
  };
  const schema = nodeSchemas.addLabel;
  
  const paramItems = schema.parameters.map((param) => ({
    id: getParamHandleId(param.key),
    label: param.label,
    type: 'input' as const,
  }));
  const labelName = data.labelName;

  return (
    <BaseNode
      title="Add Label"
      icon={<Tag className="w-4 h-4 text-white" />}
      color="from-green-500 to-emerald-600"
      inputs={schema.flowInputs}
      outputs={schema.flowOutputs}
      selected={selected as boolean | undefined}
    >
      <div className="text-xs text-white/80">
        <p className="text-white/60">{labelName}</p>
        <NodePortSection title="Parameters" items={paramItems} />
      </div>
    </BaseNode>
  );
}









