/**
 * Custom error classes for the AI Workflow Orchestrator
 */

/**
 * Base error class for all aiflow errors
 */
export abstract class AiflowError extends Error {
  public readonly timestamp: Date;

  constructor(message: string) {
    super(message);
    this.timestamp = new Date();
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown during workflow execution
 */
export class WorkflowError extends AiflowError {
  constructor(
    message: string,
    public readonly workflowId?: string,
    public readonly stepId?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

/**
 * Error thrown during validation of inputs or configurations
 */
export class ValidationError extends AiflowError {
  constructor(
    message: string,
    public readonly errors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when external integrations fail
 */
export class IntegrationError extends AiflowError {
  constructor(
    message: string,
    public readonly integration?: string,
    public readonly statusCode?: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

/**
 * Error thrown when a step execution fails
 */
export class StepExecutionError extends WorkflowError {
  constructor(
    message: string,
    workflowId: string,
    stepId: string,
    public readonly exitCode?: number,
    public readonly stderr?: string
  ) {
    super(message, workflowId, stepId);
    this.name = 'StepExecutionError';
  }
}

/**
 * Error thrown when workflow state cannot be loaded or saved
 */
export class StateError extends AiflowError {
  constructor(
    message: string,
    public readonly sessionId?: string,
    public readonly operation?: 'read' | 'write'
  ) {
    super(message);
    this.name = 'StateError';
  }
}

/**
 * Error thrown when a workflow configuration is invalid
 */
export class ConfigurationError extends AiflowError {
  constructor(
    message: string,
    public readonly configPath?: string,
    public readonly configKey?: string
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Error thrown when a template cannot be found or parsed
 */
export class TemplateError extends AiflowError {
  constructor(
    message: string,
    public readonly templatePath?: string,
    public readonly parseError?: Error
  ) {
    super(message);
    this.name = 'TemplateError';
  }
}

/**
 * Error thrown when an agent operation fails
 */
export class AgentError extends AiflowError {
  constructor(
    message: string,
    public readonly agentRole?: string,
    public readonly operation?: string
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

/**
 * Helper function to determine if an error is an aiflow error
 */
export function isAiflowError(error: unknown): error is AiflowError {
  return error instanceof AiflowError;
}

/**
 * Helper function to format error for display
 */
export function formatError(error: Error): string {
  if (error instanceof WorkflowError) {
    const parts = [`WorkflowError: ${error.message}`];
    if (error.workflowId) {
      parts.push(`  Workflow: ${error.workflowId}`);
    }
    if (error.stepId) {
      parts.push(`  Step: ${error.stepId}`);
    }
    return parts.join('\n');
  }

  if (error instanceof ValidationError && error.errors) {
    const parts = [`ValidationError: ${error.message}`];
    error.errors.forEach((err) => {
      parts.push(`  - ${err.field}: ${err.message}`);
    });
    return parts.join('\n');
  }

  if (error instanceof IntegrationError) {
    const parts = [`IntegrationError: ${error.message}`];
    if (error.integration) {
      parts.push(`  Integration: ${error.integration}`);
    }
    if (error.statusCode) {
      parts.push(`  Status Code: ${error.statusCode}`);
    }
    return parts.join('\n');
  }

  return `${error.name}: ${error.message}`;
}