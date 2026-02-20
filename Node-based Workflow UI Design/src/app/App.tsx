import { useState } from 'react';
import { WorkflowExample } from './components/WorkflowExample';
import { NodeStatesShowcase } from './components/NodeStatesShowcase';

export default function App() {
  const [view, setView] = useState<'example' | 'showcase'>('example');

  return (
    <div className="min-h-screen bg-slate-950 overflow-auto">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-medium text-white">Node-Based Workflow UI</h1>
              <p className="text-sm text-slate-400 mt-1">
                Matte dark surfaces with subtle neon accents
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setView('example')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  view === 'example'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                    : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
                }`}
              >
                Workflow Example
              </button>
              <button
                onClick={() => setView('showcase')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  view === 'showcase'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                    : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
                }`}
              >
                All States
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto py-12">
        {view === 'example' ? (
          <div>
            <div className="mb-8 px-8">
              <h2 className="text-lg text-white mb-2">Interactive Workflow</h2>
              <p className="text-sm text-slate-400">
                Click on nodes to select them. Hover to see interactive effects.
              </p>
            </div>
            <WorkflowExample />
          </div>
        ) : (
          <NodeStatesShowcase />
        )}
      </div>

      {/* Background Pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
          zIndex: -1,
        }}
      />
    </div>
  );
}