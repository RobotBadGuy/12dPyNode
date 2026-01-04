'use client';

import React, { useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { ExcelModelsNodeData } from '@/lib/workflow/types';
import { nodeSchemas } from '@/lib/workflow/nodeSchemas';

export function ExcelModelsNode(props: NodeProps) {
  const { data, selected } = props as unknown as {
    data: ExcelModelsNodeData;
    selected?: boolean;
  };
  const schema = nodeSchemas.excelModels;
  const excelData = data as unknown as ExcelModelsNodeData;
  const modelNames = excelData.modelNames || [];

  const [expanded, setExpanded] = useState(false);

  return (
    <BaseNode
      title="Excel Models"
      icon={<FileText className="w-4 h-4 text-white" />}
      color="from-emerald-500 to-teal-600"
      inputs={schema.flowInputs}
      outputs={schema.flowOutputs}
      selected={selected}
    >
      <div className="text-xs text-white/80 space-y-2">
        {excelData.file ? (
          <>
            <div>
              <p className="font-semibold truncate">{excelData.file.name}</p>
              <p className="text-white/60">{modelNames.length} models</p>
            </div>
            {modelNames.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="flex items-center gap-1 text-[11px] text-emerald-200/90 hover:text-emerald-100"
                >
                  {expanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  <span>
                    {expanded ? 'Hide models' : 'Show models'} ({modelNames.length})
                  </span>
                </button>
                {/* Always render per-model handles so imported edges remain valid,
                    but visually collapse the list when not expanded */}
                <div
                  className={
                    expanded
                      ? 'mt-1 max-h-24 overflow-y-auto space-y-0.5 pr-1'
                      : 'mt-1 max-h-0 overflow-hidden space-y-0.5 pr-1'
                  }
                >
                  {modelNames.map((name: string, index: number) => (
                    <div
                      key={index}
                      className="relative flex items-center text-[11px] text-white/80 truncate pr-4"
                      title={name}
                    >
                      {index + 1}. {name}
                      {/* Per-model output handle for each model */}
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={`value:model:${index}`}
                        className="w-3 h-3 bg-white border-2 border-green-600 absolute -right-1 top-1/2 -translate-y-1/2"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-white/60">No file uploaded</p>
        )}
      </div>
    </BaseNode>
  );
}



