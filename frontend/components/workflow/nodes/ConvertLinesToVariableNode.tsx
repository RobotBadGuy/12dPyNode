'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { ArrowRight } from 'lucide-react';
import { ConvertLinesToVariableNodeData } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId } from '@/lib/workflow/nodeSchemas';

export function ConvertLinesToVariableNode(props: NodeProps) {
  const { data, selected } = props as unknown as {
    data: ConvertLinesToVariableNodeData;
    selected?: boolean;
  };
  const schema = nodeSchemas.convertLinesToVariable;
  
  const paramItems = schema.parameters.map((param) => ({
    id: getParamHandleId(param.key),
    label: param.label,
    type: 'input' as const,
  }));

  return (
    <BaseNode
      title="Convert Lines to Variable"
      icon={<ArrowRight className="w-4 h-4 text-white" />}
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

