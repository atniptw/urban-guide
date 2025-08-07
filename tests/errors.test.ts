/**
 * Tests for custom error classes
 */

import {
  AiflowError,
  WorkflowError,
  ValidationError,
  IntegrationError,
  StepExecutionError,
  StateError,
  ConfigurationError,
  TemplateError,
  AgentError,
  isAiflowError,
  formatError
} from '../src/core/errors';

describe('Error Classes', () => {
  describe('WorkflowError', () => {
    it('should create a WorkflowError with all parameters', () => {
      const cause = new Error('Root cause');
      const error = new WorkflowError('Test workflow error', 'workflow-1', 'step-1', cause);

      expect(error).toBeInstanceOf(WorkflowError);
      expect(error).toBeInstanceOf(AiflowError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('WorkflowError');
      expect(error.message).toBe('Test workflow error');
      expect(error.workflowId).toBe('workflow-1');
      expect(error.stepId).toBe('step-1');
      expect(error.cause).toBe(cause);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should create a WorkflowError with minimal parameters', () => {
      const error = new WorkflowError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.workflowId).toBeUndefined();
      expect(error.stepId).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });
  });

  describe('ValidationError', () => {
    it('should create a ValidationError with validation errors', () => {
      const validationErrors = [
        { field: 'name', message: 'Name is required' },
        { field: 'version', message: 'Version must be valid semver' }
      ];
      const error = new ValidationError('Validation failed', validationErrors);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(AiflowError);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Validation failed');
      expect(error.errors).toEqual(validationErrors);
    });

    it('should create a ValidationError without validation errors', () => {
      const error = new ValidationError('Validation failed');

      expect(error.message).toBe('Validation failed');
      expect(error.errors).toBeUndefined();
    });
  });

  describe('IntegrationError', () => {
    it('should create an IntegrationError with all parameters', () => {
      const response = { error: 'API rate limit exceeded' };
      const error = new IntegrationError('GitHub API failed', 'github', 429, response);

      expect(error).toBeInstanceOf(IntegrationError);
      expect(error).toBeInstanceOf(AiflowError);
      expect(error.name).toBe('IntegrationError');
      expect(error.message).toBe('GitHub API failed');
      expect(error.integration).toBe('github');
      expect(error.statusCode).toBe(429);
      expect(error.response).toBe(response);
    });

    it('should create an IntegrationError with minimal parameters', () => {
      const error = new IntegrationError('API failed');

      expect(error.message).toBe('API failed');
      expect(error.integration).toBeUndefined();
      expect(error.statusCode).toBeUndefined();
      expect(error.response).toBeUndefined();
    });
  });

  describe('StepExecutionError', () => {
    it('should create a StepExecutionError with all parameters', () => {
      const error = new StepExecutionError(
        'Script failed',
        'workflow-1',
        'step-1',
        1,
        'Command not found'
      );

      expect(error).toBeInstanceOf(StepExecutionError);
      expect(error).toBeInstanceOf(WorkflowError);
      expect(error).toBeInstanceOf(AiflowError);
      expect(error.name).toBe('StepExecutionError');
      expect(error.message).toBe('Script failed');
      expect(error.workflowId).toBe('workflow-1');
      expect(error.stepId).toBe('step-1');
      expect(error.exitCode).toBe(1);
      expect(error.stderr).toBe('Command not found');
    });

    it('should create a StepExecutionError with minimal parameters', () => {
      const error = new StepExecutionError('Script failed', 'workflow-1', 'step-1');

      expect(error.exitCode).toBeUndefined();
      expect(error.stderr).toBeUndefined();
    });
  });

  describe('StateError', () => {
    it('should create a StateError with all parameters', () => {
      const error = new StateError('State save failed', 'session-123', 'write');

      expect(error).toBeInstanceOf(StateError);
      expect(error).toBeInstanceOf(AiflowError);
      expect(error.name).toBe('StateError');
      expect(error.message).toBe('State save failed');
      expect(error.sessionId).toBe('session-123');
      expect(error.operation).toBe('write');
    });

    it('should create a StateError with minimal parameters', () => {
      const error = new StateError('State error');

      expect(error.message).toBe('State error');
      expect(error.sessionId).toBeUndefined();
      expect(error.operation).toBeUndefined();
    });
  });

  describe('ConfigurationError', () => {
    it('should create a ConfigurationError with all parameters', () => {
      const error = new ConfigurationError('Invalid config', '/path/to/config.yaml', 'agents.techLead');

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error).toBeInstanceOf(AiflowError);
      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Invalid config');
      expect(error.configPath).toBe('/path/to/config.yaml');
      expect(error.configKey).toBe('agents.techLead');
    });

    it('should create a ConfigurationError with minimal parameters', () => {
      const error = new ConfigurationError('Config error');

      expect(error.message).toBe('Config error');
      expect(error.configPath).toBeUndefined();
      expect(error.configKey).toBeUndefined();
    });
  });

  describe('TemplateError', () => {
    it('should create a TemplateError with all parameters', () => {
      const parseError = new Error('Invalid template syntax');
      const error = new TemplateError('Template parsing failed', '/path/to/template.yaml', parseError);

      expect(error).toBeInstanceOf(TemplateError);
      expect(error).toBeInstanceOf(AiflowError);
      expect(error.name).toBe('TemplateError');
      expect(error.message).toBe('Template parsing failed');
      expect(error.templatePath).toBe('/path/to/template.yaml');
      expect(error.parseError).toBe(parseError);
    });

    it('should create a TemplateError with minimal parameters', () => {
      const error = new TemplateError('Template error');

      expect(error.message).toBe('Template error');
      expect(error.templatePath).toBeUndefined();
      expect(error.parseError).toBeUndefined();
    });
  });

  describe('AgentError', () => {
    it('should create an AgentError with all parameters', () => {
      const error = new AgentError('Agent operation failed', 'tech-lead', 'analyze');

      expect(error).toBeInstanceOf(AgentError);
      expect(error).toBeInstanceOf(AiflowError);
      expect(error.name).toBe('AgentError');
      expect(error.message).toBe('Agent operation failed');
      expect(error.agentRole).toBe('tech-lead');
      expect(error.operation).toBe('analyze');
    });

    it('should create an AgentError with minimal parameters', () => {
      const error = new AgentError('Agent error');

      expect(error.message).toBe('Agent error');
      expect(error.agentRole).toBeUndefined();
      expect(error.operation).toBeUndefined();
    });
  });

  describe('isAiflowError', () => {
    it('should return true for AiflowError instances', () => {
      const workflowError = new WorkflowError('Test error');
      const validationError = new ValidationError('Test error');
      const integrationError = new IntegrationError('Test error');

      expect(isAiflowError(workflowError)).toBe(true);
      expect(isAiflowError(validationError)).toBe(true);
      expect(isAiflowError(integrationError)).toBe(true);
    });

    it('should return false for non-AiflowError instances', () => {
      const regularError = new Error('Regular error');
      const typeError = new TypeError('Type error');
      const string = 'not an error';
      const number = 42;

      expect(isAiflowError(regularError)).toBe(false);
      expect(isAiflowError(typeError)).toBe(false);
      expect(isAiflowError(string)).toBe(false);
      expect(isAiflowError(number)).toBe(false);
      expect(isAiflowError(null)).toBe(false);
      expect(isAiflowError(undefined)).toBe(false);
    });
  });

  describe('formatError', () => {
    it('should format WorkflowError with all details', () => {
      const error = new WorkflowError('Workflow failed', 'test-workflow', 'step-1');
      const formatted = formatError(error);

      expect(formatted).toBe(
        'WorkflowError: Workflow failed\n  Workflow: test-workflow\n  Step: step-1'
      );
    });

    it('should format WorkflowError with minimal details', () => {
      const error = new WorkflowError('Workflow failed');
      const formatted = formatError(error);

      expect(formatted).toBe('WorkflowError: Workflow failed');
    });

    it('should format WorkflowError with only workflow ID', () => {
      const error = new WorkflowError('Workflow failed', 'test-workflow');
      const formatted = formatError(error);

      expect(formatted).toBe('WorkflowError: Workflow failed\n  Workflow: test-workflow');
    });

    it('should format ValidationError with errors', () => {
      const validationErrors = [
        { field: 'name', message: 'Name is required' },
        { field: 'version', message: 'Version must be valid' }
      ];
      const error = new ValidationError('Validation failed', validationErrors);
      const formatted = formatError(error);

      expect(formatted).toBe(
        'ValidationError: Validation failed\n  - name: Name is required\n  - version: Version must be valid'
      );
    });

    it('should format ValidationError without errors', () => {
      const error = new ValidationError('Validation failed');
      const formatted = formatError(error);

      expect(formatted).toBe('ValidationError: Validation failed');
    });

    it('should format IntegrationError with all details', () => {
      const error = new IntegrationError('API failed', 'github', 429);
      const formatted = formatError(error);

      expect(formatted).toBe(
        'IntegrationError: API failed\n  Integration: github\n  Status Code: 429'
      );
    });

    it('should format IntegrationError with minimal details', () => {
      const error = new IntegrationError('API failed');
      const formatted = formatError(error);

      expect(formatted).toBe('IntegrationError: API failed');
    });

    it('should format IntegrationError with only integration', () => {
      const error = new IntegrationError('API failed', 'github');
      const formatted = formatError(error);

      expect(formatted).toBe('IntegrationError: API failed\n  Integration: github');
    });

    it('should format generic Error', () => {
      const error = new Error('Generic error');
      const formatted = formatError(error);

      expect(formatted).toBe('Error: Generic error');
    });

    it('should format custom Error with custom name', () => {
      const error = new Error('Custom error');
      error.name = 'CustomError';
      const formatted = formatError(error);

      expect(formatted).toBe('CustomError: Custom error');
    });
  });
});