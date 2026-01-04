'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { FileCog } from 'lucide-react';
import { CreateMtfFileNodeData } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId } from '@/lib/workflow/nodeSchemas';

export function CreateMtfFileNode(props: NodeProps) {
  const { data, selected } = props as unknown as {
    data: CreateMtfFileNodeData;
    selected?: boolean;
  };

  const schema = nodeSchemas.createMtfFile;

  const paramItems = schema.parameters.map((param) => ({
    id: getParamHandleId(param.key),
    label: param.label,
    type: 'input' as const,
  }));

  return (
    <BaseNode
      title="Create MTF File"
      icon={<FileCog className="w-4 h-4 text-white" />}
      color="from-violet-500 to-purple-600"
      inputs={schema.flowInputs}
      outputs={schema.flowOutputs}
      selected={selected as boolean | undefined}
    >
      <div className="text-xs text-white/80">
        <p className="text-white/60">Generates an .mtf template file</p>
        <NodePortSection title="Parameters" items={paramItems} />
      </div>
    </BaseNode>
  );
}


