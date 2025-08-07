import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { Workflow, Step } from './types';
import { ValidationError } from './errors';
import { CONFIG_DIR, GLOBAL_CONFIG_DIR, DEFAULT_WORKFLOW_DIR } from './constants';

/**
 * Zod schemas for validating workflow definitions
 */

const InputDefinitionSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  description: z.string().optional(),
  required: z.boolean().optional(),
  default: z
    .union([z.string(), z.number(), z.boolean(), z.record(z.unknown()), z.array(z.unknown())])
    .optional(),
});

const OutputDefinitionSchema = z.object({
  name: z.string(),
  type: z.enum([
    'string',
    'number',
    'boolean',
    'object',
    'array',
    'structured',
    'markdown',
    'json',
  ]),
  description: z.string().optional(),
});

const OutputMappingSchema = z.object({
  name: z.string(),
  type: z.string(),
});

const RetryErrorPatternSchema = z.enum([
  'timeout',
  'api_error',
  'network_error',
  'rate_limit',
  'server_error',
  'authentication_error',
  'validation_error',
  'resource_unavailable',
  'temporary_failure',
]);

const RetryPolicySchema = z.object({
  maxAttempts: z.number().min(1).max(10),
  backoffMs: z.number().min(100),
  retryOn: z.array(RetryErrorPatternSchema).optional(),
});

const StepSchema: z.ZodType<Step> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.enum(['ai-prompt', 'script', 'validation', 'loop', 'conditional']),
    agent: z.string().optional(),
    template: z.string().optional(),
    command: z.string().optional(),
    condition: z.string().optional(),
    steps: z.array(StepSchema).optional(),
    items: z.string().optional(),
    retryPolicy: RetryPolicySchema.optional(),
    outputs: z.array(OutputMappingSchema).optional(),
    expectedExitCode: z.number().optional(),
  })
);

const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  inputs: z.array(InputDefinitionSchema),
  steps: z.array(StepSchema),
  outputs: z.array(OutputDefinitionSchema),
});

/**
 * WorkflowLoader handles loading and validating YAML workflow definitions
 */
export class WorkflowLoader {
  private workflowDirs: string[];

  constructor(projectRoot?: string) {
    this.workflowDirs = this.getWorkflowDirectories(projectRoot);
  }

  /**
   * Get list of directories to search for workflows (in order of priority)
   */
  private getWorkflowDirectories(projectRoot?: string): string[] {
    const dirs: string[] = [];

    // Project workflows (highest priority)
    if (projectRoot) {
      dirs.push(path.join(projectRoot, CONFIG_DIR, DEFAULT_WORKFLOW_DIR));
      dirs.push(path.join(projectRoot, DEFAULT_WORKFLOW_DIR));
    }

    // Current directory workflows
    dirs.push(path.join(process.cwd(), CONFIG_DIR, DEFAULT_WORKFLOW_DIR));
    dirs.push(path.join(process.cwd(), DEFAULT_WORKFLOW_DIR));

    // Global workflows (lowest priority)
    dirs.push(path.join(GLOBAL_CONFIG_DIR, DEFAULT_WORKFLOW_DIR));

    return dirs;
  }

  /**
   * Load a workflow by ID from the first available location
   */
  async loadWorkflow(workflowId: string): Promise<Workflow> {
    const filename = `${workflowId}.yaml`;

    for (const dir of this.workflowDirs) {
      const filepath = path.join(dir, filename);
      try {
        const content = await fs.readFile(filepath, 'utf-8');
        return this.parseAndValidateWorkflow(content, filepath);
      } catch (error: unknown) {
        if (this.isFileNotFoundError(error)) {
          // File not found, try next directory
          continue;
        }
        // Re-throw non-file-not-found errors immediately
        throw error;
      }
    }

    throw new ValidationError(
      `Workflow '${workflowId}' not found in any workflow directory`,
      this.workflowDirs.map((dir) => ({ field: 'directory', message: dir }))
    );
  }

  /**
   * List all available workflows from all directories
   */
  async listWorkflows(): Promise<Array<{ id: string; path: string }>> {
    const workflows: Array<{ id: string; path: string }> = [];
    const seen = new Set<string>();

    for (const dir of this.workflowDirs) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (file.endsWith('.yaml') || file.endsWith('.yml')) {
            const id = path.basename(file, path.extname(file));
            if (!seen.has(id)) {
              seen.add(id);
              workflows.push({ id, path: path.join(dir, file) });
            }
          }
        }
      } catch (error: unknown) {
        if (!this.isFileNotFoundError(error)) {
          console.warn(`Error reading directory ${dir}:`, this.getErrorMessage(error));
        }
        // Directory doesn't exist, continue to next one
      }
    }

    return workflows;
  }

  /**
   * Parse YAML content and validate against workflow schema
   */
  private parseAndValidateWorkflow(content: string, filepath: string): Workflow {
    let data: unknown;

    try {
      data = yaml.load(content);
    } catch (error: unknown) {
      throw new ValidationError(
        `Failed to parse YAML in ${filepath}: ${this.getErrorMessage(error)}`
      );
    }

    try {
      const validated = WorkflowSchema.parse(data);
      return validated as Workflow;
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        throw new ValidationError(`Workflow validation failed in ${filepath}`, errors);
      }
      throw error;
    }
  }

  /**
   * Validate a workflow file without loading it into memory
   */
  async validateWorkflowFile(
    filepath: string
  ): Promise<{ valid: boolean; errors?: Array<{ field: string; message: string }> }> {
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      this.parseAndValidateWorkflow(content, filepath);
      return { valid: true };
    } catch (error: unknown) {
      if (error instanceof ValidationError) {
        return { valid: false, errors: error.errors };
      }
      return { valid: false, errors: [{ field: 'general', message: this.getErrorMessage(error) }] };
    }
  }

  /**
   * Get the list of directories being searched for workflows
   */
  getSearchDirectories(): string[] {
    return [...this.workflowDirs];
  }

  /**
   * Helper method to check if error is a file not found error
   */
  private isFileNotFoundError(error: unknown): boolean {
    return (
      error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
    );
  }

  /**
   * Helper method to safely extract error message
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (error !== null && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }
    return String(error);
  }
}
