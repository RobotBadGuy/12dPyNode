import { useState } from 'react';
import { WorkflowNode } from './WorkflowNode';

type NodeState = 'idle' | 'running' | 'success' | 'error' | 'selected';

export function WorkflowExample() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const getNodeState = (nodeId: string): NodeState => {
    if (selectedNode === nodeId) return 'selected';
    return 'idle';
  };

  return (
    <div className="relative flex items-center justify-center gap-12 p-8">
      {/* SVG for connectors */}
      <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <defs>
          <linearGradient id="connector-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.4" />
            <stop offset="50%" stopColor="rgb(16, 185, 129)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="connector-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.4" />
            <stop offset="50%" stopColor="rgb(59, 130, 246)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="rgb(251, 146, 60)" stopOpacity="0.4" />
          </linearGradient>
          <filter id="connector-glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connector 1: Input to Process */}
        <path
          d="M 280 200 C 340 200, 340 200, 400 200"
          stroke="url(#connector-gradient-1)"
          strokeWidth="2"
          fill="none"
          filter="url(#connector-glow)"
        />

        {/* Connector 2: Process to Variable */}
        <path
          d="M 640 200 C 700 200, 700 200, 760 200"
          stroke="url(#connector-gradient-2)"
          strokeWidth="2"
          fill="none"
          filter="url(#connector-glow)"
        />
      </svg>

      {/* Nodes */}
      <div style={{ zIndex: 1 }}>
        <WorkflowNode
          type="input"
          state={getNodeState('input')}
          title="Excel Models"
          subtitle="No file uploaded"
          hasInputPort={false}
          hasOutputPort={true}
          onSelect={() => setSelectedNode('input')}
        />
      </div>

      <div style={{ zIndex: 1 }}>
        <WorkflowNode
          type="process"
          state={getNodeState('process')}
          title="Foreach Model"
          subtitle="Input: MODELS"
          metadata={['model_name', 'model_variable']}
          hasInputPort={true}
          hasOutputPort={true}
          onSelect={() => setSelectedNode('process')}
        />
      </div>

      <div style={{ zIndex: 1 }}>
        <WorkflowNode
          type="variable"
          state={getNodeState('variable')}
          title="Set Variable"
          subtitle="Variable: parameter1"
          hasInputPort={true}
          hasOutputPort={false}
          onSelect={() => setSelectedNode('variable')}
        />
      </div>
    </div>
  );
}
