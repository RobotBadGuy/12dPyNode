import { describe, it, expect } from 'vitest';
import { isControlFlowNode, CONTROL_FLOW_NODE_TYPES } from '../nodeKinds';

describe('isControlFlowNode', () => {
  it('is true for the four control-flow types', () => {
    expect(isControlFlowNode('excelModels')).toBe(true);
    expect(isControlFlowNode('foreachModel')).toBe(true);
    expect(isControlFlowNode('chainFileOutput')).toBe(true);
    expect(isControlFlowNode('setVariable')).toBe(true);
  });

  it('is false for command nodes and undefined', () => {
    expect(isControlFlowNode('import')).toBe(false);
    expect(isControlFlowNode('createView')).toBe(false);
    expect(isControlFlowNode(undefined)).toBe(false);
  });

  it('exposes the set with exactly five members', () => {
    expect(CONTROL_FLOW_NODE_TYPES.size).toBe(5);
  });

  it('classifies manualModels as a control-flow node', () => {
    expect(CONTROL_FLOW_NODE_TYPES.has('manualModels')).toBe(true);
    expect(isControlFlowNode('manualModels')).toBe(true);
  });
});
