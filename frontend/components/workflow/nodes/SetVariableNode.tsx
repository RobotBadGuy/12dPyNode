'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { Settings } from 'lucide-react';
import { SetVariableNodeData } from '@/lib/workflow/types';
import { nodeSchemas } from '@/lib/workflow/nodeSchemas';

export function SetVariableNode({ data, selected }: NodeProps<{ data: SetVariableNodeData }>) {
  const schema = nodeSchemas.setVariable;
  
  // Generate value outputs from variables array
  const valueItems = (data.variables || []).map((varBinding) => ({
    id: `value:${varBinding.name}`,
    label: varBinding.name,
    type: 'output' as const,
  }));

  return (
    <BaseNode
      title="Set Variable"
      icon={<Settings className="w-4 h-4 text-white" />}
      color="from-yellow-500 to-amber-600"
      inputs={schema.flowInputs}
      outputs={schema.flowOutputs}
      selected={selected}
    >
      <div className="text-xs text-white/80">
        <p className="text-white/60">
          {data.variables?.length || 0} variable(s)
        </p>
        <NodePortSection title="Variables" items={valueItems} />
      </div>
    </BaseNode>
  );
}


