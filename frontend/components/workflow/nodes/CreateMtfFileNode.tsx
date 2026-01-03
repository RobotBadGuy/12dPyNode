'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { FileCode } from 'lucide-react';
import { CreateMtfFileNodeData } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId } from '@/lib/workflow/nodeSchemas';

export function CreateMtfFileNode(props: NodeProps) {
  const { data, selected } = props as unknown as {
    data: CreateMtfFileNodeData;
    selected?: boolean;
  };
  const schema = nodeSchemas.createMtfFile;
  
  const paramInputs = schema.parameters.map((param) => ({
    id: getParamHandleId(param.key),
    label: param.label,
  }));

  return (
    <BaseNode
      title="Create MTF File"
      icon={<FileCode className="w-4 h-4 text-white" />}
      color="from-blue-500 to-cyan-600"
      inputs={schema.flowInputs}
      outputs={schema.flowOutputs}
      paramInputs={paramInputs}
      selected={selected as boolean | undefined}
    >
      <div className="text-xs text-white/80">
        <p className="text-white/60">
          MTF: {data.mtfName ? `${data.mtfName}.mtf` : 'No name set'}
        </p>
      </div>
    </BaseNode>
  );
}

