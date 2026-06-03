Adding New Parameters to an Existing Node
A complete guide covering every file you need to touch, in order, with concrete examples.

Architecture Overview
A node parameter flows through 5 layers. You must update each one for the parameter to be fully operational.

1. TypeScript Typetypes.ts
2. Node SchemanodeSchemas.ts
3. Visual Node Componentnodes/XxxNode.tsx
4. Right Sidebar EditorRightSidebar.tsx
5. Backend Executionworkflow_runner.py + command .py
TIP

Throughout this guide, we'll use a running example: adding a continueOnFailure boolean to the cleanModel node.

Step 1 — Add the field to the TypeScript interface
File: 
types.ts

Find the node's data interface and add your new property:

diff
export interface CleanModelNodeData {
   discipline: string;
   prefix: string;
   description: string;
   objectDimension: string;
   fileExt: string;
   variable: string;
+  continueOnFailure: boolean; // NEW
   [key: string]: unknown;
 }
Rules for this file
Type	Example
string	Text input or variable reference
boolean	Checkbox
number	Numeric input
[number, number]	Coordinate tuple
'optA' | 'optB'	Dropdown (union of literals)
NOTE

Every node data interface must end with [key: string]: unknown; — this is required by the generic parameter system.

Step 2 — Register the parameter in the node schema
File: 
nodeSchemas.ts

Find the node's entry in nodeSchemas and add a 
ParameterDefinition
:

diff
cleanModel: {
   parameters: [
     { key: 'discipline', label: 'Discipline', kind: 'string', defaultValue: '' },
     { key: 'prefix', label: 'Prefix', kind: 'string', defaultValue: '' },
     { key: 'description', label: 'Description', kind: 'string', defaultValue: '' },
     { key: 'objectDimension', label: 'Object Dimension', kind: 'string', defaultValue: '' },
     { key: 'fileExt', label: 'File Extension', kind: 'string', defaultValue: '' },
     { key: 'variable', label: 'Variable', kind: 'string', defaultValue: '' },
+    { key: 'continueOnFailure', label: 'Continue on Failure', kind: 'boolean', defaultValue: true },
   ],
   flowInputs: [{ id: 'flow:input', label: 'input' }],
   flowOutputs: [{ id: 'flow:output', label: 'output' }],
   valueOutputs: [],
 },
ParameterDefinition
 fields
Field	Required	Description
key	✅	Must match the 
types.ts
 field name exactly (camelCase)
label	✅	Human-readable label shown in sidebar
kind	✅	'string' · 'number' · 'boolean' · 'tuple' · 'select'
defaultValue	✅	Initial value when node is created
options	Only for select	Array of string options, e.g. ['Model', 'TIN']
IMPORTANT

The key you set here controls two things automatically:

The parameter handle on the node (port ID param:continueOnFailure)
The property editor input in the Right Sidebar
Step 3 — Visual node component (usually no changes needed)
File: 
CleanModelNode.tsx

Most node components use a generic schema-driven pattern — they read schema.parameters and render handles automatically via NodePortSection. If your node uses this pattern, no changes are needed:

tsx
const schema = nodeSchemas.cleanModel;
const paramItems = schema.parameters.map((param) => ({
  id: getParamHandleId(param.key),
  label: param.label,
  type: 'input' as const,
}));
The new parameter handle will appear automatically.

When you DO need to edit the node component
Custom rendering: If the node displays the parameter value inline (e.g. 
ExcelModelsNode
 shows file info)
Custom handles: If you need non-standard handle behavior
Conditional visibility: If a parameter should only show under certain conditions
Step 4 — Right Sidebar property editor
File: 
RightSidebar.tsx

Generic editor (most nodes — no changes needed)
The generic editor at the bottom of the file (starting ~line 264) automatically renders inputs for all parameters defined in the schema. It handles each kind type:

kind	Rendered as
string	Text input + variable dropdown
number	Number input
boolean	Checkbox
select	Dropdown with options
tuple	Text input (comma-separated)
If your node uses the generic editor, you don't need to change anything.

Custom editors (special nodes)
Some nodes have custom editors with hardcoded UI (e.g. setVariable, import). If your node has a custom section in 
RightSidebar.tsx
, you'll need to add the new field manually:

tsx
// Inside the custom editor block for your node type:
<div>
  <Label className="text-sm font-semibold text-gray-300 mb-1 block">
    Continue on Failure
  </Label>
  <input
    type="checkbox"
    checked={nodeData.continueOnFailure ?? true}
    onChange={(e) =>
      onUpdateNode(selectedNode.id, {
        continueOnFailure: e.target.checked,
      } as Partial<WorkflowNodeData>)
    }
    className="w-4 h-4"
  />
</div>
Step 5 — Backend: workflow runner + command generator
Two files need updating on the backend.

5a. Workflow Runner — read the parameter from node data
File: 
workflow_runner.py

Find the 
execute_node
 function and locate the elif block for your node type. Add a line to extract and resolve the new parameter:

diff
elif node_type == 'cleanModel':
     discipline = resolve_variable(data.get('discipline', 'discipline'), ...)
     prefix = resolve_variable(data.get('prefix', 'prefix'), ...)
     description = resolve_variable(data.get('description', 'description'), ...)
     object_dimension = resolve_variable(data.get('objectDimension', 'object_dimension'), ...)
     file_ext = resolve_variable(data.get('fileExt', 'file_ext'), ...)
     variable = resolve_variable(data.get('variable', 'variable'), ...)
+    continue_on_failure = data.get('continueOnFailure', True)  # boolean, no resolve needed
     
-    xml_content.extend(clean_model_command(discipline, prefix, description, object_dimension, file_ext, variable))
+    xml_content.extend(clean_model_command(discipline, prefix, description, object_dimension, file_ext, variable, continue_on_failure))
Variable resolution rules
Parameter type	How to extract
String (may contain {var} references)	
resolve_variable(data.get('key', 'default'), model_name, variables, per_run_vars)
Boolean	data.get('key', default_value) — no 
resolve_variable
 needed
Number	data.get('key', default_value) or 
resolve_variable(...)
 if it may be a variable
Tuple	data.get('key', [default_values])
5b. Command Generator — use the parameter in XML output
File: The command module in 
backend/commands/
 — find your node's 
.py
 file.

For cleanModel, the file is 
clean_model.py
:

diff
def clean_model_command(
     discipline: str,
     prefix: str,
     description: str,
     object_dimension: str,
     file_ext: str,
-    variable: str
+    variable: str,
+    continue_on_failure: bool = True
 ) -> List[str]:
     model_name = f'{discipline}/{prefix} {description} {object_dimension} {file_ext}'
+    failure_str = 'true' if continue_on_failure else 'false'
     
     clean_model_line = (
         f'      <Clean_model>        <Name>Clean model {model_name}</Name>        '
-        f'<Active>true</Active>        <Continue_on_failure>true</Continue_on_failure>        '
+        f'<Active>true</Active>        <Continue_on_failure>{failure_str}</Continue_on_failure>        '
         ...
     )
Quick Reference Checklist
#	File	Action	Required?
1	
types.ts
Add field to data interface	✅ Always
2	
nodeSchemas.ts
Add 
ParameterDefinition
 entry	✅ Always
3	nodes/XxxNode.tsx	Update visual rendering	⚠️ Only if custom UI
4	
RightSidebar.tsx
Add editor for new field	⚠️ Only if custom editor
5a	
workflow_runner.py
Extract param in 
execute_node
✅ Always
5b	commands/.../*.py	Use param in XML generation	✅ Always
CAUTION

The key in 
nodeSchemas.ts
 must exactly match the property name in 
types.ts
 (both camelCase). Mismatches will silently break the parameter — it won't save or wire correctly.

LeftSidebar — No Changes Needed
The 
LeftSidebar.tsx
 only contains node palette buttons. Adding a parameter to an existing node never requires changes here. (You only modify it when adding an entirely new node type.)