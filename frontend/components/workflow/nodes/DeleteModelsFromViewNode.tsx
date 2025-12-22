'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { Trash2 } from 'lucide-react';
import { DeleteModelsFromViewNodeData } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId } from '@/lib/workflow/nodeSchemas';

export function DeleteModelsFromViewNode({ data, selected }: NodeProps<{ data: DeleteModelsFromViewNodeData }>) {
  const schema = nodeSchemas.deleteModelsFromView;
  
  const paramItems = schema.parameters.map((param) => ({
    id: getParamHandleId(param.key),
    label: param.label,
    type: 'input' as const,
  }));

  return (
    <BaseNode
      title="Delete Models from View"
      icon={<Trash2 className="w-4 h-4 text-white" />}
      color="from-red-500 to-pink-600"
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


