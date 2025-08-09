/**
 * Tests for WorkflowEngine
 */

import { WorkflowEngine } from '../src/engine/workflow-engine';
import { StepExecutor } from '../src/engine/step-executor';
import { StateManager } from '../src/state/state-manager';
import { Workflow, WorkflowStatus } from '../src/core/types';
import { WorkflowError } from '../src/core/errors';

// Mock dependencies
jest.mock('../src/state/state-manager');
jest.mock('../src/engine/step-executor');

describe('WorkflowEngine', () => {
  let workflowEngine: WorkflowEngine;
  let mockStateManager: jest.Mocked<StateManager>;
  let mockStepExecutor: jest.Mocked<StepExecutor>;

  const sampleWorkflow: Workflow = {
    id: 'test-workflow',
    name: 'Test Workflow',
    description: 'A test workflow',
    version: '1.0.0',
    inputs: [
      {
        name: 'input1',
        type: 'string',
        description: 'Test input',
        required: true,
      },
    ],
    steps: [
      {
        id: 'step1',
        type: 'ai-prompt',
        agent: 'test-agent',
        template: 'Test template: {{input1}}',
      },
      {
        id: 'step2',
        type: 'script',
        command: 'echo "Hello {{input1}}"',
        expectedExitCode: 0,
      },
    ],
    outputs: [
      {
        name: 'result',
        type: 'string',
        description: 'Test result',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockStateManager = new StateManager() as jest.Mocked<StateManager>;
    mockStepExecutor = new StepExecutor() as jest.Mocked<StepExecutor>;

    workflowEngine = new WorkflowEngine(mockStateManager, mockStepExecutor);

    // Setup default mocks
    mockStateManager.initialize.mockResolvedValue();
    mockStateManager.createSession.mockResolvedValue('session-123');
    mockStateManager.loadSession.mockResolvedValue({
      sessionId: 'session-123',
      workflowId: 'test-workflow',
      status: 'running' as WorkflowStatus,
      inputs: { input1: 'test-value' },
      context: {
        inputs: { input1: 'test-value' },
        variables: {},
        outputs: {},
      },
      outputs: {},
      stepExecutions: [],
      currentStepIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    });
    mockStateManager.updateSessionStatus.mockResolvedValue();
    mockStateManager.addStepExecution.mockResolvedValue();

    mockStepExecutor.executeStep.mockResolvedValue({
      outputs: { result: 'test-output' },
      shouldContinue: true,
    });
  });

  describe('execute', () => {
    it('should execute a workflow successfully', async () => {
      const inputs = { input1: 'test-value' };
      const result = await workflowEngine.execute(sampleWorkflow, inputs);

      expect(mockStateManager.initialize).toHaveBeenCalled();
      expect(mockStateManager.createSession).toHaveBeenCalledWith('test-workflow', inputs);
      expect(mockStateManager.loadSession).toHaveBeenCalledWith('session-123');
      expect(mockStepExecutor.executeStep).toHaveBeenCalledTimes(2);
      expect(mockStateManager.updateSessionStatus).toHaveBeenCalledWith('session-123', 'completed');

      expect(result.sessionId).toBe('session-123');
      expect(result.workflowId).toBe('test-workflow');
      expect(result.status).toBe('running'); // Based on mocked loadSession
    });

    it('should handle step execution failures', async () => {
      const error = new Error('Step failed');
      mockStepExecutor.executeStep.mockRejectedValueOnce(error);

      const inputs = { input1: 'test-value' };

      await expect(workflowEngine.execute(sampleWorkflow, inputs)).rejects.toThrow(WorkflowError);
      expect(mockStateManager.updateSessionStatus).toHaveBeenCalledWith('session-123', 'failed');
    });

    it('should handle session creation failure', async () => {
      mockStateManager.loadSession.mockRejectedValueOnce(new Error('Session not found'));

      const inputs = { input1: 'test-value' };

      await expect(workflowEngine.execute(sampleWorkflow, inputs)).rejects.toThrow(WorkflowError);
    });

    it('should emit workflow events during execution', async () => {
      const startedSpy = jest.fn();
      const stepStartedSpy = jest.fn();
      const stepCompletedSpy = jest.fn();
      const completedSpy = jest.fn();

      workflowEngine.on('started', startedSpy);
      workflowEngine.on('stepStarted', stepStartedSpy);
      workflowEngine.on('stepCompleted', stepCompletedSpy);
      workflowEngine.on('completed', completedSpy);

      const inputs = { input1: 'test-value' };
      await workflowEngine.execute(sampleWorkflow, inputs);

      expect(startedSpy).toHaveBeenCalledWith({ sessionId: 'session-123', workflowId: 'test-workflow' });
      expect(stepStartedSpy).toHaveBeenCalledTimes(2);
      expect(stepCompletedSpy).toHaveBeenCalledTimes(2);
      expect(completedSpy).toHaveBeenCalled();
    });
  });

  describe('resume', () => {
    it('should reject resume for non-existent session', async () => {
      mockStateManager.loadSession.mockRejectedValue(new Error('Session not found'));

      await expect(workflowEngine.resume('invalid-session')).rejects.toThrow(WorkflowError);
    });

    it('should reject resume for non-paused session', async () => {
      mockStateManager.loadSession.mockResolvedValue({
        sessionId: 'session-123',
        workflowId: 'test-workflow',
        status: 'completed' as WorkflowStatus,
        inputs: {},
        context: { inputs: {}, variables: {}, outputs: {} },
        outputs: {},
        stepExecutions: [],
        currentStepIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      });

      await expect(workflowEngine.resume('session-123')).rejects.toThrow(WorkflowError);
    });

    it('should emit resumed event', async () => {
      mockStateManager.loadSession.mockResolvedValue({
        sessionId: 'session-123',
        workflowId: 'test-workflow',
        status: 'paused' as WorkflowStatus,
        inputs: {},
        context: { inputs: {}, variables: {}, outputs: {} },
        outputs: {},
        stepExecutions: [],
        currentStepIndex: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      });

      const resumedSpy = jest.fn();
      workflowEngine.on('resumed', resumedSpy);

      try {
        await workflowEngine.resume('session-123');
      } catch (error) {
        // Expected to fail due to unimplemented workflow loading
      }

      expect(resumedSpy).toHaveBeenCalledWith({ sessionId: 'session-123', stepId: 'step-1' });
    });
  });

  describe('pause', () => {
    it('should pause a running workflow', async () => {
      const pausedSpy = jest.fn();
      workflowEngine.on('paused', pausedSpy);

      await workflowEngine.pause('session-123');

      expect(mockStateManager.updateSessionStatus).toHaveBeenCalledWith('session-123', 'paused');
      expect(pausedSpy).toHaveBeenCalledWith({ sessionId: 'session-123', stepId: 'step-0' });
    });

    it('should reject pause for non-existent session', async () => {
      mockStateManager.loadSession.mockRejectedValue(new Error('Session not found'));

      await expect(workflowEngine.pause('invalid-session')).rejects.toThrow(WorkflowError);
    });

    it('should reject pause for non-running session', async () => {
      mockStateManager.loadSession.mockResolvedValue({
        sessionId: 'session-123',
        workflowId: 'test-workflow',
        status: 'completed' as WorkflowStatus,
        inputs: {},
        context: { inputs: {}, variables: {}, outputs: {} },
        outputs: {},
        stepExecutions: [],
        currentStepIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      });

      await expect(workflowEngine.pause('session-123')).rejects.toThrow(WorkflowError);
    });
  });

  describe('getStatus', () => {
    it('should return workflow status', async () => {
      const status = await workflowEngine.getStatus('session-123');

      expect(status).toBeDefined();
      expect(status?.sessionId).toBe('session-123');
      expect(status?.workflowId).toBe('test-workflow');
    });

    it('should return null for non-existent session', async () => {
      mockStateManager.loadSession.mockRejectedValue(new Error('Session not found'));

      const status = await workflowEngine.getStatus('invalid-session');

      expect(status).toBeNull();
    });
  });

  describe('listSessions', () => {
    it('should list all sessions', async () => {
      mockStateManager.listSessions.mockResolvedValue([
        {
          sessionId: 'session-1',
          workflowId: 'workflow-1',
          status: 'running' as WorkflowStatus,
          createdAt: new Date(),
          updatedAt: new Date(),
          currentStepIndex: 0,
          totalSteps: 2,
        },
      ]);

      mockStateManager.loadSession.mockResolvedValue({
        sessionId: 'session-1',
        workflowId: 'workflow-1',
        status: 'running' as WorkflowStatus,
        inputs: {},
        context: { inputs: {}, variables: {}, outputs: {} },
        outputs: {},
        stepExecutions: [],
        currentStepIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      });

      const sessions = await workflowEngine.listSessions();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe('session-1');
      expect(mockStateManager.listSessions).toHaveBeenCalledWith(undefined);
    });

    it('should filter sessions by status', async () => {
      mockStateManager.listSessions.mockResolvedValue([]);

      await workflowEngine.listSessions('completed');

      expect(mockStateManager.listSessions).toHaveBeenCalledWith('completed');
    });
  });

  describe('cleanup', () => {
    it('should clean up old sessions', async () => {
      mockStateManager.cleanupSessions.mockResolvedValue({
        deleted: ['session1', 'session2', 'session3', 'session4', 'session5'],
        errors: [],
      });

      const result = await workflowEngine.cleanup(86400000, ['completed', 'failed']);

      expect(result).toBe(5);
      expect(mockStateManager.cleanupSessions).toHaveBeenCalledWith({
        maxAge: 86400000,
        statuses: ['completed', 'failed'],
      });
    });
  });
});