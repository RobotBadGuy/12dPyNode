'use client';

import React from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { NodePortSection } from './NodePortSection';
import { Calculator } from 'lucide-react';
import { TrimeshVolumeReportNodeData } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId } from '@/lib/workflow/nodeSchemas';

export function TrimeshVolumeReportNode(props: NodeProps) {
  const { data, selected } = props as unknown as {
    data: TrimeshVolumeReportNodeData;
    selected?: boolean;
  };
  const schema = nodeSchemas.trimeshVolumeReport;
  
  const paramItems = schema.parameters.map((param) => ({
    id: getParamHandleId(param.key),
    label: param.label,
    type: 'input' as const,
  }));

  return (
    <BaseNode
      title="Trimesh Volume Report"
      icon={<Calculator className="w-4 h-4 text-white" />}
      color="from-blue-500 to-cyan-600"
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




