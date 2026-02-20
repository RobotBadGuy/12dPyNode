import { WorkflowNode } from './WorkflowNode';

export function NodeStatesShowcase() {
  return (
    <div className="space-y-12 p-8">
      {/* Idle State */}
      <div>
        <h2 className="text-xl font-medium text-white mb-4">Idle State</h2>
        <div className="flex flex-wrap gap-6">
          <WorkflowNode
            type="input"
            state="idle"
            title="Excel Models"
            subtitle="No file uploaded"
            hasInputPort={false}
            hasOutputPort={true}
          />
          <WorkflowNode
            type="process"
            state="idle"
            title="Foreach Model"
            subtitle="Input: MODELS"
            metadata={['model_name', 'model_variable']}
          />
          <WorkflowNode
            type="variable"
            state="idle"
            title="Set Variable"
            subtitle="Variable: parameter1"
            hasInputPort={true}
            hasOutputPort={false}
          />
          <WorkflowNode
            type="output"
            state="idle"
            title="Export Results"
            subtitle="Format: JSON"
            hasInputPort={true}
            hasOutputPort={false}
          />
        </div>
      </div>

      {/* Running State */}
      <div>
        <h2 className="text-xl font-medium text-white mb-4">Running State</h2>
        <div className="flex flex-wrap gap-6">
          <WorkflowNode
            type="input"
            state="running"
            title="Loading Data"
            subtitle="Processing..."
            hasInputPort={false}
            hasOutputPort={true}
          />
          <WorkflowNode
            type="process"
            state="running"
            title="Computing Model"
            subtitle="43% complete"
            metadata={['iteration: 12/28', 'elapsed: 2.3s']}
          />
        </div>
      </div>

      {/* Success State */}
      <div>
        <h2 className="text-xl font-medium text-white mb-4">Success State</h2>
        <div className="flex flex-wrap gap-6">
          <WorkflowNode
            type="input"
            state="success"
            title="Data Loaded"
            subtitle="1,234 records"
            hasInputPort={false}
            hasOutputPort={true}
          />
          <WorkflowNode
            type="process"
            state="success"
            title="Model Complete"
            subtitle="100% complete"
            metadata={['total: 28 iterations', 'duration: 5.4s']}
          />
        </div>
      </div>

      {/* Error State */}
      <div>
        <h2 className="text-xl font-medium text-white mb-4">Error State</h2>
        <div className="flex flex-wrap gap-6">
          <WorkflowNode
            type="input"
            state="error"
            title="File Not Found"
            subtitle="Error loading data"
            hasInputPort={false}
            hasOutputPort={true}
          />
          <WorkflowNode
            type="process"
            state="error"
            title="Model Failed"
            subtitle="Division by zero"
            metadata={['line: 42', 'model: forecast.xlsx']}
          />
        </div>
      </div>

      {/* Selected State */}
      <div>
        <h2 className="text-xl font-medium text-white mb-4">Selected State</h2>
        <div className="flex flex-wrap gap-6">
          <WorkflowNode
            type="variable"
            state="selected"
            title="Active Variable"
            subtitle="Currently editing"
            metadata={['type: number', 'value: 42']}
            hasInputPort={true}
            hasOutputPort={false}
          />
          <WorkflowNode
            type="output"
            state="selected"
            title="Selected Output"
            subtitle="Ready to configure"
            hasInputPort={true}
            hasOutputPort={false}
          />
        </div>
      </div>
    </div>
  );
}
