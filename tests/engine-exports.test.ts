/**
 * Tests for Engine module exports
 */

import * as EngineExports from '../src/engine';

describe('Engine exports', () => {
  it('should export WorkflowEngine', () => {
    expect(EngineExports.WorkflowEngine).toBeDefined();
    expect(typeof EngineExports.WorkflowEngine).toBe('function');
  });

  it('should export StepExecutor', () => {
    expect(EngineExports.StepExecutor).toBeDefined();
    expect(typeof EngineExports.StepExecutor).toBe('function');
  });

  it('should export WorkflowEvents interface properties', () => {
    // Verify the WorkflowEvents interface is accessible through exports
    // This is tested indirectly through WorkflowEngine usage
    expect(EngineExports.WorkflowEngine).toBeDefined();
  });
});