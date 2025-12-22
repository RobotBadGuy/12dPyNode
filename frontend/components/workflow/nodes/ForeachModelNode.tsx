'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { Repeat } from 'lucide-react';
import { ForeachModelNodeData } from '@/lib/workflow/types';
import { nodeSchemas } from '@/lib/workflow/nodeSchemas';

export function ForeachModelNode(props: NodeProps) {
  const { data, selected } = props as unknown as {
    data: ForeachModelNodeData;
    selected?: boolean;
  };
  const schema = nodeSchemas.foreachModel;
  
  const valueItems = (schema.valueOutputs || []).map((output) => ({
    id: output.id,
    label: output.label,
    type: 'output' as const,
  }));

  return (
    <BaseNode
      title="Foreach Model"
      icon={<Repeat className="w-4 h-4 text-white" />}
      color="from-blue-500 to-indigo-600"
      inputs={schema.flowInputs}
      outputs={schema.flowOutputs}
      selected={selected as boolean | undefined}
    >
      <div className="text-xs text-white/80">
        {data.currentModel ? (
          <p className="font-semibold truncate">{data.currentModel}</p>
        ) : (
          <p className="text-white/60">Ready</p>
        )}
        <NodePortSection title="Variables" items={valueItems} />
      </div>
    </BaseNode>
  );
}


