/**
 * Type definition tests to verify TypeScript compilation and type correctness
 */

import {
  Workflow,
  Step,
  WorkflowState,
  Agent,
  SessionSummary,
  GitHubIssue,
  InputDefinition,
  OutputDefinition,
  Context,
  StepExecution,
  WorkflowStatus,
  StepStatus,
  RetryErrorPattern,
  RetryPolicy,
} from '../src/core/types';
import {
  WorkflowError,
  ValidationError,
  IntegrationError,
  isAiflowError,
  formatError,
} from '../src/core/errors';
import { DEFAULT_CONFIG, AGENT_ROLES, EXIT_CODES } from '../src/core/constants';

describe('Core Type Definitions', () => {
  describe('Workflow types', () => {
    it('should compile workflow types correctly', () => {
      const inputDef: InputDefinition = {
        name: 'feature_name',
        type: 'string',
        description: 'Name of the feature to implement',
        required: true,
        default: 'new-feature',
      };

      const outputDef: OutputDefinition = {
        name: 'implementation_plan',
        type: 'structured',
        description: 'Detailed implementation plan',
      };

      const step: Step = {
        id: 'analyze-requirements',
        type: 'ai-prompt',
        agent: 'tech-lead',
        template: 'analyze-feature',
        outputs: [
          {
            name: 'analysis',
            type: 'json',
          },
        ],
        retryPolicy: {
          maxAttempts: 3,
          backoffMs: 1000,
          retryOn: ['timeout', 'api_error'],
        },
      };

      const workflow: Workflow = {
        id: 'feature-implementation',
        name: 'Feature Implementation Workflow',
        description: 'Complete workflow for implementing new features',
        version: '1.0.0',
        inputs: [inputDef],
        steps: [step],
        outputs: [outputDef],
      };

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('feature-implementation');
      expect(workflow.inputs).toHaveLength(1);
      expect(workflow.steps).toHaveLength(1);
      expect(workflow.outputs).toHaveLength(1);
    });

    it('should support conditional steps', () => {
      const conditionalStep: Step = {
        id: 'conditional-test',
        type: 'conditional',
        condition: 'context.requiresQA === true',
        steps: [
          {
            id: 'qa-review',
            type: 'ai-prompt',
            agent: 'qa-engineer',
          },
        ],
      };

      expect(conditionalStep.type).toBe('conditional');
      expect(conditionalStep.steps).toHaveLength(1);
    });

    it('should support loop steps', () => {
      const loopStep: Step = {
        id: 'test-loop',
        type: 'loop',
        items: 'context.testFiles',
        steps: [
          {
            id: 'run-test',
            type: 'script',
            command: 'npm test',
            expectedExitCode: 0,
          },
        ],
      };

      expect(loopStep.type).toBe('loop');
      expect(loopStep.items).toBe('context.testFiles');
    });

    it('should enforce type safety for retry error patterns', () => {
      // Valid retry patterns
      const validPatterns: RetryErrorPattern[] = [
        'timeout',
        'api_error',
        'network_error',
        'rate_limit',
        'server_error',
        'authentication_error',
        'validation_error',
        'resource_unavailable',
        'temporary_failure',
      ];

      const retryPolicy: RetryPolicy = {
        maxAttempts: 3,
        backoffMs: 1000,
        retryOn: validPatterns,
      };

      expect(retryPolicy.retryOn).toEqual(validPatterns);
      expect(retryPolicy.retryOn).toHaveLength(9);

      // Test individual pattern assignment
      const singlePattern: RetryErrorPattern = 'timeout';
      expect(singlePattern).toBe('timeout');
    });
  });

  describe('State management types', () => {
    it('should compile state types correctly', () => {
      const context: Context = {
        inputs: { feature_name: 'auth-system' },
        variables: { current_step: 1 },
        outputs: { analysis: { complexity: 'high' } },
      };

      const stepExecution: StepExecution = {
        stepId: 'analyze-requirements',
        startedAt: new Date('2023-01-01T10:00:00Z'),
        completedAt: new Date('2023-01-01T10:05:00Z'),
        status: 'success',
        inputs: { feature_name: 'auth-system' },
        outputs: { analysis: { complexity: 'high' } },
        retryCount: 0,
      };

      const workflowState: WorkflowState = {
        sessionId: 'session-123',
        workflowId: 'feature-implementation',
        startedAt: new Date('2023-01-01T10:00:00Z'),
        updatedAt: new Date('2023-01-01T10:05:00Z'),
        currentStepIndex: 0,
        status: 'completed',
        context,
        stepHistory: [stepExecution],
        outputs: { implementation_plan: 'Complete plan...' },
      };

      expect(workflowState).toBeDefined();
      expect(workflowState.status).toBe('completed');
      expect(workflowState.stepHistory).toHaveLength(1);
    });

    it('should support all workflow statuses', () => {
      const statuses: WorkflowStatus[] = ['running', 'paused', 'completed', 'failed'];
      
      statuses.forEach((status) => {
        const state: WorkflowState = {
          sessionId: 'test',
          workflowId: 'test',
          startedAt: new Date(),
          updatedAt: new Date(),
          currentStepIndex: 0,
          status,
          context: { inputs: {}, variables: {}, outputs: {} },
          stepHistory: [],
          outputs: {},
        };
        expect(state.status).toBe(status);
      });
    });

    it('should support all step statuses', () => {
      const statuses: StepStatus[] = ['success', 'failed', 'skipped', 'pending'];
      
      statuses.forEach((status) => {
        const execution: StepExecution = {
          stepId: 'test-step',
          startedAt: new Date(),
          status,
          inputs: {},
          outputs: {},
        };
        expect(execution.status).toBe(status);
      });
    });
  });

  describe('Agent types', () => {
    it('should compile agent types correctly', () => {
      const agent: Agent = {
        role: 'tech-lead',
        capabilities: ['analysis', 'planning', 'architecture'],
        systemPrompt: 'You are a technical lead responsible for...',
        workflows: ['feature-implementation', 'bug-fix'],
        memory: {
          type: 'persistent',
          scope: 'session',
          retention: '7d',
        },
      };

      expect(agent).toBeDefined();
      expect(agent.role).toBe('tech-lead');
      expect(agent.capabilities).toHaveLength(3);
      expect(agent.memory.type).toBe('persistent');
    });
  });

  describe('CLI types', () => {
    it('should compile session summary correctly', () => {
      const summary: SessionSummary = {
        sessionId: 'session-456',
        workflowId: 'feature-implementation',
        workflowName: 'Feature Implementation Workflow',
        status: 'running',
        startedAt: new Date('2023-01-01T10:00:00Z'),
        updatedAt: new Date('2023-01-01T10:30:00Z'),
        currentStep: 'analyze-requirements',
      };

      expect(summary).toBeDefined();
      expect(summary.status).toBe('running');
      expect(summary.currentStep).toBe('analyze-requirements');
    });
  });

  describe('Integration types', () => {
    it('should compile GitHub issue types correctly', () => {
      const issue: GitHubIssue = {
        url: 'https://github.com/user/repo/issues/123',
        number: 123,
        title: 'Implement new authentication system',
        body: 'We need to implement a new authentication system...',
        comments: [
          {
            author: 'developer1',
            body: 'I can work on this',
            createdAt: new Date('2023-01-01T09:00:00Z'),
          },
        ],
        labels: ['feature', 'high-priority'],
        assignees: ['developer1'],
      };

      expect(issue).toBeDefined();
      expect(issue.number).toBe(123);
      expect(issue.comments).toHaveLength(1);
      expect(issue.labels).toContain('feature');
    });
  });
});

describe('Error Classes', () => {
  it('should create workflow errors correctly', () => {
    const error = new WorkflowError('Step failed', 'workflow-1', 'step-2');
    
    expect(error).toBeInstanceOf(WorkflowError);
    expect(error.message).toBe('Step failed');
    expect(error.workflowId).toBe('workflow-1');
    expect(error.stepId).toBe('step-2');
    expect(error.name).toBe('WorkflowError');
    expect(error.timestamp).toBeInstanceOf(Date);
  });

  it('should create validation errors correctly', () => {
    const error = new ValidationError('Invalid input', [
      { field: 'name', message: 'Required field missing' },
      { field: 'type', message: 'Invalid type specified' },
    ]);
    
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.errors).toHaveLength(2);
    expect(error.errors![0].field).toBe('name');
  });

  it('should create integration errors correctly', () => {
    const error = new IntegrationError('GitHub API failed', 'github', 404);
    
    expect(error).toBeInstanceOf(IntegrationError);
    expect(error.integration).toBe('github');
    expect(error.statusCode).toBe(404);
  });

  it('should identify aiflow errors correctly', () => {
    const aiflowError = new WorkflowError('Test');
    const regularError = new Error('Regular error');
    
    expect(isAiflowError(aiflowError)).toBe(true);
    expect(isAiflowError(regularError)).toBe(false);
  });

  it('should format errors correctly', () => {
    const workflowError = new WorkflowError('Step failed', 'workflow-1', 'step-2');
    const formatted = formatError(workflowError);
    
    expect(formatted).toContain('WorkflowError: Step failed');
    expect(formatted).toContain('Workflow: workflow-1');
    expect(formatted).toContain('Step: step-2');
  });
});

describe('Constants', () => {
  it('should export default configuration', () => {
    expect(DEFAULT_CONFIG.maxConcurrentWorkflows).toBe(5);
    expect(DEFAULT_CONFIG.defaultTimeout).toBe(300000);
    expect(typeof DEFAULT_CONFIG.retryAttempts).toBe('number');
  });

  it('should export agent roles', () => {
    expect(AGENT_ROLES.techLead).toBe('tech-lead');
    expect(AGENT_ROLES.developer).toBe('developer');
    expect(AGENT_ROLES.qaEngineer).toBe('qa-engineer');
  });

  it('should export exit codes', () => {
    expect(EXIT_CODES.success).toBe(0);
    expect(EXIT_CODES.generalError).toBe(1);
    expect(EXIT_CODES.validationError).toBe(2);
  });
});