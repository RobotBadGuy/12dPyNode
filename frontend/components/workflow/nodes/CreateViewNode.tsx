'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { Eye } from 'lucide-react';
import { CreateViewNodeData } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId } from '@/lib/workflow/nodeSchemas';

export function CreateViewNode({ data, selected }: NodeProps<{ data: CreateViewNodeData }>) {
  const schema = nodeSchemas.createView;
  
  const paramItems = schema.parameters.map((param) => ({
    id: getParamHandleId(param.key),
    label: param.label,
    type: 'input' as const,
  }));

  return (
    <BaseNode
      title="Create View"
      icon={<Eye className="w-4 h-4 text-white" />}
      color="from-violet-500 to-purple-600"
      inputs={schema.flowInputs}
      outputs={schema.flowOutputs}
      selected={selected}
    >
      <div className="text-xs text-white/80">
        <p className="text-white/60">Ready</p>
        <NodePortSection title="Parameters" items={paramItems} />
      </div>
    </BaseNode>
  );
}


