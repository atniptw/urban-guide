/**
 * Tests for WorkflowLoader class
 */

import { WorkflowLoader } from '../src/core/workflow-loader';
import { ValidationError } from '../src/core/errors';
import * as fs from 'fs/promises';

// Mock the fs module
jest.mock('fs/promises');

describe('WorkflowLoader', () => {
  let loader: WorkflowLoader;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    loader = new WorkflowLoader();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create WorkflowLoader with default directories', () => {
      const directories = loader.getSearchDirectories();
      expect(directories.length).toBeGreaterThan(0);
      expect(directories.some((dir) => dir.includes('.aiflow'))).toBe(true);
    });

    it('should create WorkflowLoader with custom project root', () => {
      const customLoader = new WorkflowLoader('/custom/project');
      const directories = customLoader.getSearchDirectories();
      expect(directories.some((dir) => dir.includes('/custom/project'))).toBe(true);
    });
  });

  describe('loadWorkflow', () => {
    it('should load and validate a valid workflow', async () => {
      const validWorkflow = `
id: test-workflow
name: Test Workflow
description: A test workflow for testing purposes
version: 1.0.0
inputs:
  - name: feature_url
    type: string
    description: URL of the feature to implement
    required: true
steps:
  - id: step1
    type: script
    command: echo "test"
    expectedExitCode: 0
outputs:
  - name: result
    type: string
    description: The result of the workflow
`;

      mockFs.readFile.mockResolvedValueOnce(validWorkflow);

      const workflow = await loader.loadWorkflow('test-workflow');

      expect(workflow.id).toBe('test-workflow');
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.description).toBe('A test workflow for testing purposes');
      expect(workflow.version).toBe('1.0.0');
      expect(workflow.inputs).toHaveLength(1);
      expect(workflow.steps).toHaveLength(1);
      expect(workflow.outputs).toHaveLength(1);
      expect(workflow.steps[0].type).toBe('script');
      expect(workflow.steps[0].command).toBe('echo "test"');
    });

    it('should load workflow with complex steps and retry policies', async () => {
      const complexWorkflow = `
id: complex-workflow
name: Complex Test Workflow
description: A complex workflow with retry policies
version: 2.0.0
inputs:
  - name: input_data
    type: object
    required: true
  - name: max_retries
    type: number
    default: 3
steps:
  - id: ai-analysis
    type: ai-prompt
    agent: tech-lead
    template: analyze-requirements
    retryPolicy:
      maxAttempts: 3
      backoffMs: 1000
      retryOn:
        - timeout
        - api_error
    outputs:
      - name: analysis_result
        type: json
  - id: conditional-step
    type: conditional
    condition: "context.analysis_result.complexity === 'high'"
    steps:
      - id: detailed-analysis
        type: ai-prompt
        agent: tech-lead
        template: detailed-analysis
  - id: loop-step
    type: loop
    items: context.files
    steps:
      - id: process-file
        type: script
        command: "process-file {{item}}"
outputs:
  - name: final_result
    type: structured
`;

      mockFs.readFile.mockResolvedValueOnce(complexWorkflow);

      const workflow = await loader.loadWorkflow('complex-workflow');

      expect(workflow.steps).toHaveLength(3);
      expect(workflow.steps[0].retryPolicy).toBeDefined();
      expect(workflow.steps[0].retryPolicy!.maxAttempts).toBe(3);
      expect(workflow.steps[0].retryPolicy!.retryOn).toEqual(['timeout', 'api_error']);
      expect(workflow.steps[1].type).toBe('conditional');
      expect(workflow.steps[1].steps).toHaveLength(1);
      expect(workflow.steps[2].type).toBe('loop');
    });

    it('should throw ValidationError for invalid workflow structure', async () => {
      const invalidWorkflow = `
id: test-workflow
name: Test Workflow
# missing required fields: description, version, inputs, steps, outputs
`;

      mockFs.readFile.mockResolvedValueOnce(invalidWorkflow);

      await expect(loader.loadWorkflow('test-workflow')).rejects.toThrow(ValidationError);

      try {
        await loader.loadWorkflow('test-workflow');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.errors).toBeDefined();
        expect(validationError.errors!.length).toBeGreaterThan(0);
      }
    });

    it('should throw ValidationError for invalid YAML syntax', async () => {
      const invalidYaml = `
id: test-workflow
name: Test Workflow
description: [invalid yaml structure
`;

      mockFs.readFile.mockResolvedValueOnce(invalidYaml);

      await expect(loader.loadWorkflow('test-workflow')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid step types', async () => {
      const invalidStepWorkflow = `
id: test-workflow
name: Test Workflow
description: Test workflow with invalid step
version: 1.0.0
inputs: []
steps:
  - id: invalid-step
    type: invalid-type
    command: echo "test"
outputs: []
`;

      mockFs.readFile.mockResolvedValueOnce(invalidStepWorkflow);

      await expect(loader.loadWorkflow('test-workflow')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid retry error patterns', async () => {
      const invalidRetryWorkflow = `
id: test-workflow
name: Test Workflow
description: Test workflow with invalid retry patterns
version: 1.0.0
inputs: []
steps:
  - id: step-with-invalid-retry
    type: script
    command: echo "test"
    retryPolicy:
      maxAttempts: 3
      backoffMs: 1000
      retryOn:
        - invalid_pattern
        - another_invalid
outputs: []
`;

      mockFs.readFile.mockResolvedValueOnce(invalidRetryWorkflow);

      await expect(loader.loadWorkflow('test-workflow')).rejects.toThrow(ValidationError);
    });

    it('should throw error when workflow not found in any directory', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      await expect(loader.loadWorkflow('nonexistent')).rejects.toThrow(ValidationError);

      try {
        await loader.loadWorkflow('nonexistent');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.message).toContain("Workflow 'nonexistent' not found");
      }
    });

    it('should propagate non-ENOENT file system errors', async () => {
      const permissionError = { code: 'EACCES', message: 'Permission denied' };
      mockFs.readFile.mockRejectedValueOnce(permissionError);

      await expect(loader.loadWorkflow('test-workflow')).rejects.toEqual(permissionError);
    });
  });

  describe('listWorkflows', () => {
    it('should list all workflow files from multiple directories', async () => {
      mockFs.readdir
        .mockResolvedValueOnce(['workflow1.yaml', 'workflow2.yml', 'other.txt'] as any)
        .mockResolvedValueOnce(['workflow3.yaml', 'workflow1.yaml'] as any) // duplicate should be ignored
        .mockRejectedValueOnce({ code: 'ENOENT' }); // some directories might not exist

      const workflows = await loader.listWorkflows();

      expect(workflows).toHaveLength(3);
      expect(workflows.map((w) => w.id)).toEqual(['workflow1', 'workflow2', 'workflow3']);
      expect(workflows[0].id).toBe('workflow1');
      expect(workflows[1].id).toBe('workflow2');
      expect(workflows[2].id).toBe('workflow3');
      expect(workflows[0].path).toContain('workflow1.yaml');
    });

    it('should handle directories that do not exist', async () => {
      mockFs.readdir.mockRejectedValue({ code: 'ENOENT' });

      const workflows = await loader.listWorkflows();

      expect(workflows).toHaveLength(0);
    });

    it('should warn about other directory access errors but continue', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockFs.readdir
        .mockResolvedValueOnce(['workflow1.yaml'] as any)
        .mockRejectedValueOnce({ code: 'EACCES', message: 'Permission denied' });

      const workflows = await loader.listWorkflows();

      expect(workflows).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error reading directory'),
        'Permission denied'
      );

      consoleSpy.mockRestore();
    });

    it('should handle both .yaml and .yml extensions', async () => {
      mockFs.readdir.mockResolvedValueOnce([
        'workflow1.yaml',
        'workflow2.yml',
        'workflow3.YAML', // should be ignored (case sensitive)
        'not-a-workflow.txt',
      ] as any);

      const workflows = await loader.listWorkflows();

      expect(workflows).toHaveLength(2);
      expect(workflows.map((w) => w.id)).toEqual(['workflow1', 'workflow2']);
    });
  });

  describe('validateWorkflowFile', () => {
    it('should return valid=true for a valid workflow file', async () => {
      const validWorkflow = `
id: test-workflow
name: Test Workflow
description: A valid test workflow
version: 1.0.0
inputs: []
steps:
  - id: step1
    type: script
    command: echo "test"
outputs: []
`;

      mockFs.readFile.mockResolvedValueOnce(validWorkflow);

      const result = await loader.validateWorkflowFile('/path/to/workflow.yaml');

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return validation errors for invalid workflow file', async () => {
      const invalidWorkflow = `
id: test-workflow
# missing required fields
`;

      mockFs.readFile.mockResolvedValueOnce(invalidWorkflow);

      const result = await loader.validateWorkflowFile('/path/to/invalid.yaml');

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should handle file read errors gracefully', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('File not found'));

      const result = await loader.validateWorkflowFile('/path/to/missing.yaml');

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([{ field: 'general', message: 'File not found' }]);
    });
  });

  describe('getSearchDirectories', () => {
    it('should return the list of workflow directories', () => {
      const directories = loader.getSearchDirectories();

      expect(Array.isArray(directories)).toBe(true);
      expect(directories.length).toBeGreaterThan(0);
      expect(directories.every((dir) => typeof dir === 'string')).toBe(true);
    });
  });
});