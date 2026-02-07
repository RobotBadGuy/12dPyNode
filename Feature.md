Here is the complete, consolidated prompt. You can copy and paste this directly into your AI coding agent (Cursor, Windsurf, Copilot, etc.).

It covers the UI, the logic, the specific "Foreach" edge case, and the technical implementation details.

---

# **LLM Agent Prompt: Feature Implementation**

**Role:** Senior Frontend Engineer (React/Next.js)
**Context:** I have an existing node-based web application (React/Next.js) where users create workflows by connecting nodes.
**Task:** Implement a **"Data Mapping & Inspector"** feature similar to n8n or Make.com.

**Reference Material:**

* **Screenshot Context:**
* **Node A (Source):** "Excel Models" (Outputs a list of items, e.g., `road 01 align`).
* **Node B (Processor):** "Foreach Model" (Takes an array input to loop over).
* **Node C (Target):** "Create View" (Takes single item inputs from the loop).



---

### **Feature Requirements**

#### **1. Interaction & UI (The Modal)**

* **Trigger:** When a user double-clicks a node (e.g., "Foreach Model"), open a configuration modal.
* **Layout:** The modal must have a **Two-Column Layout**:
* **Left Column (Incoming Data / Context):**
* Traverse the graph to find the **Source Node** connected to the current node.
* Display the JSON Output schema of that Source Node.
* *Visuals:* Render these keys as **draggable items**. Distinguish between Arrays (lists) and Primitives (text/numbers) using icons.


* **Right Column (Current Node Inputs):**
* Render the input fields for the current node (e.g., `model_name`, `modified_variable`).
* *Visuals:* These are **droppable targets**.





#### **2. The Mapping Logic (Drag-and-Drop)**

* **Library:** Use a modern React DnD library.
* **Action:** The user drags an item from the Left Column and drops it into an input in the Right Column.
* **Result (The "Token"):**
* Do not just paste the text value.
* Create a UI **"Token" or "Pill"** inside the input field (e.g., a green chip that says `road 01 align`).
* **Underlying Data:** Save this as a reference syntax, e.g., `{{ ExcelModels.data.models }}`.



#### **3. Critical Logic: Handling "Foreach" Nodes**

You must implement specific logic for "List" vs. "Item" contexts:

* **Case A: Mapping INTO a Foreach Node**
* The "Foreach Model" node requires an **Array** input to know what to iterate over.
* *Validation:* In the Left Column, identify which output keys are Arrays (e.g., `models: [...]`). Only allow these to be dropped into the "Collection/List" input of the Foreach node.
* *Visual:* Highlight Array items in the source list to make them obvious.


* **Case B: Mapping OUT OF a Foreach Node (e.g., into "Create View")**
* When the user opens the *next* node ("Create View"), the context changes.
* The source is now the **Iterator**, not the full list.
* *Transformation:* The Left Column should not show the full array `[A, B, C]`. It should show the schema of a **single item** (e.g., properties of `A`).
* *Labeling:* Label the source data as "Current Item" or "Iterator Context".
* *Mapping:* When the user drags `name` to the "View Name" input, the syntax should resolve to `{{ item.name }}` (relative to the loop), not an absolute path.



#### **4. Technical Implementation Plan**

1. **State Analysis:** Identify how `nodes` and `edges` are currently stored in the app state.
2. **Graph Traversal Helper:** Create a utility function `getIncomingData(nodeId)` that finds the connected parent node and retrieves its output schema.
3. **Component Construction:**
* `MappingModal`: The container.
* `SourceDataList`: Renders the draggable schema (handling both Array and Object views).
* `DroppableInput`: A complex input component that handles text AND dragged tokens.


4. **Persistence:** Define how the "Mapping" is saved inside the Node's data structure (e.g., separate `inputs` object from `settings`).

**Constraint:**

* Ensure the UI distinguishes between "Static Text" (user typed "Hello") and "Dynamic Mapped Data" (user dropped a token).

---

### **Immediate Next Step**

Please analyze the existing `Node` component structure in the codebase and propose the JSON schema change required to store these new "Variable Mappings."