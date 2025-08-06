/**
 * Test to verify core module exports
 */

import {
  // Types
  Workflow,
  Step,
  Agent,
  // Constants
  DEFAULT_CONFIG,
  AGENT_ROLES,
  EXIT_CODES,
  // Errors
  WorkflowError,
  ValidationError,
  IntegrationError,
  isAiflowError,
} from '../src/core';

describe('Core Module Exports', () => {
  it('should export all types correctly', () => {
    // This test verifies that all exports are available and properly typed
    expect(typeof DEFAULT_CONFIG).toBe('object');
    expect(typeof AGENT_ROLES).toBe('object');
    expect(typeof EXIT_CODES).toBe('object');
    expect(typeof WorkflowError).toBe('function');
    expect(typeof ValidationError).toBe('function');
    expect(typeof IntegrationError).toBe('function');
    expect(typeof isAiflowError).toBe('function');
  });

  it('should create instances with correct types', () => {
    const workflow: Workflow = {
      id: 'test',
      name: 'Test',
      description: 'Test workflow',
      version: '1.0.0',
      inputs: [],
      steps: [],
      outputs: [],
    };

    const step: Step = {
      id: 'test-step',
      type: 'ai-prompt',
      agent: 'tech-lead',
    };

    const agent: Agent = {
      role: 'tech-lead',
      capabilities: ['planning'],
      systemPrompt: 'You are a tech lead',
      workflows: ['test'],
      memory: {
        type: 'ephemeral',
        scope: 'task',
      },
    };

    expect(workflow.id).toBe('test');
    expect(step.type).toBe('ai-prompt');
    expect(agent.role).toBe('tech-lead');
  });

  it('should create error instances correctly', () => {
    const workflowError = new WorkflowError('Test error', 'workflow-1');
    const validationError = new ValidationError('Validation failed');
    const integrationError = new IntegrationError('API failed', 'github');

    expect(isAiflowError(workflowError)).toBe(true);
    expect(isAiflowError(validationError)).toBe(true);
    expect(isAiflowError(integrationError)).toBe(true);
    expect(isAiflowError(new Error('Regular error'))).toBe(false);
  });
});