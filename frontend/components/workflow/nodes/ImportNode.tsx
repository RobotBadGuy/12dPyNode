'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { Upload } from 'lucide-react';
import { ImportNodeData } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId } from '@/lib/workflow/nodeSchemas';

export function ImportNode({ data, selected }: NodeProps<{ data: ImportNodeData }>) {
  const schema = nodeSchemas.import;
  
  const paramItems = schema.parameters.map((param) => ({
    id: getParamHandleId(param.key),
    label: param.label,
    type: 'input' as const,
  }));

  return (
    <BaseNode
      title="Import"
      icon={<Upload className="w-4 h-4 text-white" />}
      color="from-cyan-500 to-blue-600"
      inputs={schema.flowInputs}
      outputs={schema.flowOutputs}
      selected={selected}
    >
      <div className="text-xs text-white/80">
        <p className="text-white/60">Type: {data.fileType || 'dwg'}</p>
        {data.actualFilePath && (
          <p className="text-white/60 truncate">Path: {data.actualFilePath}</p>
        )}
        <NodePortSection title="Parameters" items={paramItems} />
      </div>
    </BaseNode>
  );
}


