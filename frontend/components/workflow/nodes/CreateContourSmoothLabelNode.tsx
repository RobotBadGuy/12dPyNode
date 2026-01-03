'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { Waves } from 'lucide-react';
import { CreateContourSmoothLabelNodeData } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId } from '@/lib/workflow/nodeSchemas';

export function CreateContourSmoothLabelNode(props: NodeProps) {
  const { data, selected } = props as unknown as {
    data: CreateContourSmoothLabelNodeData;
    selected?: boolean;
  };
  const schema = nodeSchemas.createContourSmoothLabel;
  
  const paramItems = schema.parameters.map((param) => ({
    id: getParamHandleId(param.key),
    label: param.label,
    type: 'input' as const,
  }));

  return (
    <BaseNode
      title="Create Contour Smooth Label"
      icon={<Waves className="w-4 h-4 text-white" />}
      color="from-teal-500 to-cyan-600"
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









