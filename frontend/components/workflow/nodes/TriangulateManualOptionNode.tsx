'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { Triangle } from 'lucide-react';
import { TriangulateManualOptionNodeData } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId } from '@/lib/workflow/nodeSchemas';

export function TriangulateManualOptionNode({ data, selected }: NodeProps<{ data: TriangulateManualOptionNodeData }>) {
  const schema = nodeSchemas.triangulateManualOption;
  
  const paramItems = schema.parameters.map((param) => ({
    id: getParamHandleId(param.key),
    label: param.label,
    type: 'input' as const,
  }));

  return (
    <BaseNode
      title="Triangulate Manual"
      icon={<Triangle className="w-4 h-4 text-white" />}
      color="from-teal-500 to-cyan-600"
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


