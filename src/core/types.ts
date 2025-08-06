/**
 * Core type definitions for the AI Workflow Orchestrator
 */

// ============================================================================
// Workflow Definition Types
// ============================================================================

/**
 * Main workflow definition structure
 */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: string;
  inputs: InputDefinition[];
  steps: Step[];
  outputs: OutputDefinition[];
}

/**
 * Input parameter definition for workflows
 */
export interface InputDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
  default?: unknown;
}

/**
 * Output definition for workflow results
 */
export interface OutputDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'structured' | 'markdown' | 'json';
  description?: string;
}

/**
 * Available step types in a workflow
 */
export type StepType = 'ai-prompt' | 'script' | 'validation' | 'loop' | 'conditional';

/**
 * Individual workflow step configuration
 */
export interface Step {
  id: string;
  type: StepType;
  agent?: string;
  template?: string;
  command?: string;
  condition?: string;
  steps?: Step[]; // for conditional and loop steps
  items?: string; // for loop steps
  retryPolicy?: RetryPolicy;
  outputs?: OutputMapping[];
  expectedExitCode?: number; // for script steps
}

/**
 * Maps step outputs to context variables
 */
export interface OutputMapping {
  name: string;
  type: string;
}

/**
 * Retry configuration for steps
 */
export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  retryOn?: string[]; // error patterns
}

// ============================================================================
// Agent Types
// ============================================================================

/**
 * Agent configuration for role-based task execution
 */
export interface Agent {
  role: string;
  capabilities: string[];
  systemPrompt: string;
  workflows: string[]; // workflow IDs this agent can execute
  memory: MemoryConfig;
}

/**
 * Memory configuration for agent context retention
 */
export interface MemoryConfig {
  type: 'ephemeral' | 'persistent';
  scope: 'task' | 'session' | 'global';
  retention?: string; // duration like "7d" or "30d"
}

// ============================================================================
// State Management Types
// ============================================================================

/**
 * Complete workflow execution state
 */
export interface WorkflowState {
  sessionId: string;
  workflowId: string;
  startedAt: Date;
  updatedAt: Date;
  currentStepIndex: number;
  status: WorkflowStatus;
  context: Context;
  stepHistory: StepExecution[];
  outputs: Record<string, unknown>;
}

/**
 * Workflow execution status
 */
export type WorkflowStatus = 'running' | 'paused' | 'completed' | 'failed';

/**
 * Execution context containing variables and data
 */
export interface Context {
  inputs: Record<string, unknown>;
  variables: Record<string, unknown>;
  outputs: Record<string, unknown>;
}

/**
 * Record of a single step execution
 */
export interface StepExecution {
  stepId: string;
  startedAt: Date;
  completedAt?: Date;
  status: StepStatus;
  inputs: unknown;
  outputs: unknown;
  error?: string;
  retryCount?: number;
}

/**
 * Status of an individual step execution
 */
export type StepStatus = 'success' | 'failed' | 'skipped' | 'pending';

// ============================================================================
// CLI Types
// ============================================================================

/**
 * Summary of a workflow session for CLI display
 */
export interface SessionSummary {
  sessionId: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowStatus;
  startedAt: Date;
  updatedAt: Date;
  currentStep?: string;
}

// ============================================================================
// Integration Types
// ============================================================================

/**
 * GitHub issue representation
 */
export interface GitHubIssue {
  url: string;
  number: number;
  title: string;
  body: string;
  comments?: Comment[];
  labels?: string[];
  assignees?: string[];
}

/**
 * Comment on a GitHub issue or PR
 */
export interface Comment {
  author: string;
  body: string;
  createdAt: Date;
}