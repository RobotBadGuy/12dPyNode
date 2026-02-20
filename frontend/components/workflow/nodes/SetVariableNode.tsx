'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { Settings } from 'lucide-react';
import { SetVariableNodeData } from '@/lib/workflow/types';
import { nodeSchemas } from '@/lib/workflow/nodeSchemas';

export function SetVariableNode(props: NodeProps) {
  const { data, selected } = props as unknown as {
    data: SetVariableNodeData;
    selected?: boolean;
  };
  const schema = nodeSchemas.setVariable;

  // Generate value outputs from variables array
  // Use a stable handle ID based on index so renaming the variable doesn't break existing connections
  const valueItems = (data.variables || []).map((varBinding, index) => ({
    id: `value:var:${index}`, // stable per-variable index
    label: varBinding.name,
    type: 'output' as const,
  }));

  return (
    <BaseNode
      title="Set Variable"
      icon={<Settings className="w-4 h-4 text-white" />}
      color="from-yellow-500 to-amber-600"
      borderColor="rgb(251, 146, 60)"
      glowColor="rgba(251, 146, 60, 0.4)"
      nodeState={(data as any).nodeState}
      inputs={schema.flowInputs}
      outputs={schema.flowOutputs}
      selected={selected as boolean | undefined}
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


