/**
 * Global constants for the AI Workflow Orchestrator
 */

import * as path from 'path';
import * as os from 'os';

/**
 * Configuration directory names
 */
export const CONFIG_DIR = '.aiflow';
export const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.aiflow');
export const DEFAULT_WORKFLOW_DIR = 'workflows';
export const SESSION_DIR = 'sessions';
export const STATE_FILE = 'state.json';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  maxConcurrentWorkflows: 5,
  defaultTimeout: 300000, // 5 minutes in milliseconds
  retryAttempts: 3,
  retryBackoff: 1000, // 1 second
} as const;

/**
 * File extensions
 */
export const FILE_EXTENSIONS = {
  workflow: '.workflow.yaml',
  template: '.template.yaml',
  config: '.config.json',
} as const;

/**
 * Environment variable names
 */
export const ENV_VARS = {
  aiflowHome: 'AIFLOW_HOME',
  aiflowConfig: 'AIFLOW_CONFIG',
  aiflowDebug: 'AIFLOW_DEBUG',
  githubToken: 'GITHUB_TOKEN',
} as const;

/**
 * Exit codes for CLI operations
 */
export const EXIT_CODES = {
  success: 0,
  generalError: 1,
  validationError: 2,
  workflowError: 3,
  integrationError: 4,
} as const;

/**
 * Agent role identifiers
 */
export const AGENT_ROLES = {
  techLead: 'tech-lead',
  developer: 'developer',
  qaEngineer: 'qa-engineer',
  reviewer: 'reviewer',
} as const;

/**
 * Workflow status values
 */
export const WORKFLOW_STATUS = {
  running: 'running',
  paused: 'paused',
  completed: 'completed',
  failed: 'failed',
} as const;

/**
 * Step status values
 */
export const STEP_STATUS = {
  success: 'success',
  failed: 'failed',
  skipped: 'skipped',
  pending: 'pending',
} as const;