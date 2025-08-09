/**
 * Tests for StateManager
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { StateManager, WorkflowSessionState } from '../src/state/state-manager';
import { StepExecution, Context } from '../src/core/types';
import { StateError } from '../src/core/errors';

// Mock the fs module
jest.mock('fs/promises');

describe('StateManager', () => {
  let stateManager: StateManager;
  let mockFs: jest.Mocked<typeof fs>;
  const testStateDir = '/test/state';

  beforeEach(() => {
    mockFs = fs as jest.Mocked<typeof fs>;
    stateManager = new StateManager(testStateDir);
    jest.clearAllMocks();

    // Default successful mocks
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue();
    mockFs.rename.mockResolvedValue();
    mockFs.unlink.mockResolvedValue();
    mockFs.access.mockResolvedValue();
  });

  describe('initialization', () => {
    it('should create state directories on initialize', async () => {
      await stateManager.initialize();

      expect(mockFs.mkdir).toHaveBeenCalledWith(testStateDir, { recursive: true });
      expect(mockFs.mkdir).toHaveBeenCalledWith(path.join(testStateDir, 'running'), { recursive: true });
      expect(mockFs.mkdir).toHaveBeenCalledWith(path.join(testStateDir, 'paused'), { recursive: true });
      expect(mockFs.mkdir).toHaveBeenCalledWith(path.join(testStateDir, 'completed'), { recursive: true });
      expect(mockFs.mkdir).toHaveBeenCalledWith(path.join(testStateDir, 'failed'), { recursive: true });
    });

    it('should throw StateError if directory creation fails', async () => {
      mockFs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(stateManager.initialize()).rejects.toThrow(StateError);
    });
  });

  describe('createSession', () => {
    it('should create a new session with unique ID', async () => {
      const workflowId = 'test-workflow';
      const inputs = { name: 'Alice', count: 5 };

      const sessionId = await stateManager.createSession(workflowId, inputs);

      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      
      // Verify saveSession was called with correct state
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${sessionId}.json.tmp`),
        expect.stringContaining(workflowId),
        'utf-8'
      );
    });

    it('should initialize context with inputs', async () => {
      const inputs = { name: 'Bob', age: 30 };
      await stateManager.createSession('test-workflow', inputs);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const stateJson = writeCall[1] as string;
      const state = JSON.parse(stateJson);

      expect(state.inputs).toEqual(inputs);
      expect(state.context.inputs).toEqual(inputs);
    });
  });

  describe('saveSession', () => {
    it('should save session atomically using temp file', async () => {
      const context: Context = {
        inputs: { name: 'Alice' },
        variables: {},
        outputs: {},
      };

      const state: WorkflowSessionState = {
        sessionId: 'test-session',
        workflowId: 'test-workflow',
        status: 'running',
        inputs: { name: 'Alice' },
        context,
        outputs: {},
        stepExecutions: [],
        currentStepIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };

      await stateManager.saveSession(state);

      const expectedPath = path.join(testStateDir, 'running', 'test-session.json');
      const expectedTempPath = `${expectedPath}.tmp`;

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expectedTempPath,
        expect.any(String),
        'utf-8'
      );
      expect(mockFs.rename).toHaveBeenCalledWith(expectedTempPath, expectedPath);
    });

    it('should update updatedAt timestamp when saving', async () => {
      const originalDate = new Date('2023-01-01T00:00:00Z');
      const context: Context = {
        inputs: {},
        variables: {},
        outputs: {},
      };

      const state: WorkflowSessionState = {
        sessionId: 'test-session',
        workflowId: 'test-workflow',
        status: 'running',
        inputs: {},
        context,
        outputs: {},
        stepExecutions: [],
        currentStepIndex: 0,
        createdAt: originalDate,
        updatedAt: originalDate,
        metadata: {},
      };

      await stateManager.saveSession(state);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const savedState = JSON.parse(writeCall[1] as string);
      
      expect(new Date(savedState.updatedAt).getTime()).toBeGreaterThan(originalDate.getTime());
    });

    it('should clean up temp file on write failure', async () => {
      mockFs.writeFile.mockRejectedValueOnce(new Error('Disk full'));

      const context: Context = {
        inputs: {},
        variables: {},
        outputs: {},
      };

      const state: WorkflowSessionState = {
        sessionId: 'test-session',
        workflowId: 'test-workflow',
        status: 'running',
        inputs: {},
        context,
        outputs: {},
        stepExecutions: [],
        currentStepIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };

      await expect(stateManager.saveSession(state)).rejects.toThrow(StateError);
      expect(mockFs.unlink).toHaveBeenCalled();
    });
  });

  describe('loadSession', () => {
    const mockState = {
      sessionId: 'test-session',
      workflowId: 'test-workflow',
      status: 'running',
      inputs: { name: 'Alice' },
      context: {
        inputs: { name: 'Alice' },
        variables: {},
        outputs: {},
      },
      outputs: {},
      stepExecutions: [],
      currentStepIndex: 0,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      metadata: {},
    };

    it('should load session from specified status directory', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockState));

      const state = await stateManager.loadSession('test-session', 'running');

      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.join(testStateDir, 'running', 'test-session.json'),
        'utf-8'
      );
      expect(state.sessionId).toBe('test-session');
      expect(state.createdAt).toBeInstanceOf(Date);
      expect(state.updatedAt).toBeInstanceOf(Date);
    });

    it('should search all directories if no status specified', async () => {
      // Mock access to fail for running, succeed for paused
      mockFs.access
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce(undefined);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({ ...mockState, status: 'paused' }));

      const state = await stateManager.loadSession('test-session');

      expect(mockFs.access).toHaveBeenCalledWith(path.join(testStateDir, 'running', 'test-session.json'));
      expect(mockFs.access).toHaveBeenCalledWith(path.join(testStateDir, 'paused', 'test-session.json'));
      expect(state.status).toBe('paused');
    });

    it('should throw StateError if session not found', async () => {
      mockFs.readFile.mockRejectedValueOnce({ code: 'ENOENT' });

      await expect(stateManager.loadSession('nonexistent', 'running')).rejects.toThrow(StateError);
    });

    it('should deserialize dates and step executions', async () => {
      const mockStateWithExecution = {
        ...mockState,
        stepExecutions: [{
          stepId: 'step1',
          status: 'success',
          inputs: {},
          outputs: { result: 'success' },
          startedAt: '2023-01-01T10:00:00.000Z',
          completedAt: '2023-01-01T10:05:00.000Z',
        }],
      };
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockStateWithExecution));

      const state = await stateManager.loadSession('test-session', 'running');

      expect(state.stepExecutions[0].startedAt).toBeInstanceOf(Date);
      expect(state.stepExecutions[0].completedAt).toBeInstanceOf(Date);
    });
  });

  describe('updateSessionStatus', () => {
    it('should move session to new status directory', async () => {
      const mockState = {
        sessionId: 'test-session',
        workflowId: 'test-workflow',
        status: 'running',
        inputs: {},
        context: {},
        outputs: {},
        stepExecutions: [],
        currentStepIndex: 0,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        metadata: {},
      };

      // Mock finding the session in running directory
      mockFs.access.mockResolvedValueOnce(undefined);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockState));

      await stateManager.updateSessionStatus('test-session', 'completed');

      // Should save to new location
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('completed/test-session.json.tmp'),
        expect.any(String),
        'utf-8'
      );

      // Should delete old location
      expect(mockFs.unlink).toHaveBeenCalledWith(
        path.join(testStateDir, 'running', 'test-session.json')
      );
    });

    it('should not delete old file if status unchanged', async () => {
      const mockState = {
        sessionId: 'test-session',
        status: 'running',
        workflowId: 'test-workflow',
        inputs: {},
        context: {},
        outputs: {},
        stepExecutions: [],
        currentStepIndex: 0,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        metadata: {},
      };

      mockFs.access.mockResolvedValueOnce(undefined);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockState));

      await stateManager.updateSessionStatus('test-session', 'running');

      // Should not call unlink since status didn't change
      expect(mockFs.unlink).not.toHaveBeenCalled();
    });
  });

  describe('updateContext', () => {
    it('should merge context updates', async () => {
      const mockState = {
        sessionId: 'test-session',
        workflowId: 'test-workflow',
        status: 'running',
        inputs: { name: 'Alice' },
        context: { name: 'Alice', step: 1 },
        outputs: {},
        stepExecutions: [],
        currentStepIndex: 0,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        metadata: {},
      };

      mockFs.access.mockResolvedValueOnce(undefined);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockState));

      await stateManager.updateContext('test-session', { step: 2, newVar: 'test' });

      const writeCall = mockFs.writeFile.mock.calls[0];
      const savedState = JSON.parse(writeCall[1] as string);

      expect(savedState.context).toEqual({
        name: 'Alice',
        step: 2,
        newVar: 'test',
      });
    });
  });

  describe('addStepExecution', () => {
    it('should add step execution and update currentStepIndex', async () => {
      const mockState = {
        sessionId: 'test-session',
        workflowId: 'test-workflow',
        status: 'running',
        inputs: {},
        context: {},
        outputs: {},
        stepExecutions: [],
        currentStepIndex: 0,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        metadata: {},
      };

      mockFs.access.mockResolvedValueOnce(undefined);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockState));

      const execution: StepExecution = {
        stepId: 'step1',
        status: 'success',
        inputs: {},
        outputs: { result: 'success' },
        startedAt: new Date(),
        completedAt: new Date(),
      };

      await stateManager.addStepExecution('test-session', execution);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const savedState = JSON.parse(writeCall[1] as string);

      expect(savedState.stepExecutions).toHaveLength(1);
      expect(savedState.currentStepIndex).toBe(1);
    });
  });

  describe('listSessions', () => {
    it('should list sessions from all directories', async () => {
      const mockSessions = [
        {
          sessionId: 'session1',
          workflowId: 'workflow1',
          status: 'running',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T01:00:00.000Z',
          currentStepIndex: 0,
          stepExecutions: [],
        },
        {
          sessionId: 'session2',
          workflowId: 'workflow2',
          status: 'completed',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T02:00:00.000Z',
          currentStepIndex: 2,
          stepExecutions: [{}, {}],
        },
      ];

      mockFs.readdir
        .mockResolvedValueOnce(['session1.json'] as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['session2.json'] as any)
        .mockResolvedValueOnce([]);

      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockSessions[0]))
        .mockResolvedValueOnce(JSON.stringify(mockSessions[1]));

      const sessions = await stateManager.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0].sessionId).toBe('session2'); // Should be sorted by updatedAt desc
      expect(sessions[1].sessionId).toBe('session1');
      expect(sessions[0].totalSteps).toBe(2);
    });

    it('should filter by status if specified', async () => {
      mockFs.readdir.mockResolvedValueOnce(['session1.json'] as any);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        sessionId: 'session1',
        workflowId: 'workflow1',
        status: 'running',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T01:00:00.000Z',
      }));

      const sessions = await stateManager.listSessions('running');

      expect(sessions).toHaveLength(1);
      expect(mockFs.readdir).toHaveBeenCalledTimes(1);
    });

    it('should skip invalid session files', async () => {
      mockFs.readdir.mockResolvedValueOnce(['session1.json', 'invalid.json'] as any);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify({
          sessionId: 'session1',
          workflowId: 'workflow1',
          status: 'running',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T01:00:00.000Z',
        }))
        .mockResolvedValueOnce('invalid json');

      // Mock console.warn to avoid test output
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const sessions = await stateManager.listSessions('running');

      expect(sessions).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not parse session file invalid.json: Unexpected token'));
      
      warnSpy.mockRestore();
    });
  });

  describe('deleteSession', () => {
    it('should delete session file', async () => {
      mockFs.access.mockResolvedValueOnce(undefined);

      await stateManager.deleteSession('test-session');

      expect(mockFs.unlink).toHaveBeenCalledWith(
        path.join(testStateDir, 'running', 'test-session.json')
      );
    });

    it('should throw StateError if session not found', async () => {
      mockFs.access.mockRejectedValue({ code: 'ENOENT' });

      await expect(stateManager.deleteSession('nonexistent')).rejects.toThrow(StateError);
    });
  });

  describe('cleanupSessions', () => {
    it('should clean up old sessions', async () => {
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
      const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      // Mock listSessions calls - cleanupSessions calls listSessions for 'completed' and 'failed' statuses
      // First call: listSessions('completed')
      mockFs.readdir.mockResolvedValueOnce(['old-session.json', 'recent-session.json'] as any);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify({
          sessionId: 'old-session',
          workflowId: 'test-workflow',
          status: 'completed',
          createdAt: oldDate.toISOString(),
          updatedAt: oldDate.toISOString(),
          currentStepIndex: 0,
          stepExecutions: [],
        }))
        .mockResolvedValueOnce(JSON.stringify({
          sessionId: 'recent-session',
          workflowId: 'test-workflow',
          status: 'completed',
          createdAt: recentDate.toISOString(),
          updatedAt: recentDate.toISOString(),
          currentStepIndex: 0,
          stepExecutions: [],
        }));

      // Second call: listSessions('failed') - return empty
      mockFs.readdir.mockResolvedValueOnce([]);

      // Mock findSessionFile for deleteSession - should find session in 'completed' directory
      mockFs.access
        .mockRejectedValueOnce(new Error('ENOENT')) // running directory
        .mockRejectedValueOnce(new Error('ENOENT')) // paused directory
        .mockResolvedValueOnce(undefined); // completed directory - found here

      const result = await stateManager.cleanupSessions({
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      expect(result.deleted).toEqual(['old-session']);
      expect(result.errors).toHaveLength(0);
      expect(mockFs.unlink).toHaveBeenCalledWith(
        path.join(testStateDir, 'completed', 'old-session.json')
      );
    });

    it('should support dry run mode', async () => {
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);

      // Mock listSessions('completed')
      mockFs.readdir.mockResolvedValueOnce(['old-session.json'] as any);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        sessionId: 'old-session',
        workflowId: 'test-workflow',
        status: 'completed',
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
        currentStepIndex: 0,
        stepExecutions: [],
      }));

      // Mock listSessions('failed') - return empty
      mockFs.readdir.mockResolvedValueOnce([]);

      const result = await stateManager.cleanupSessions({
        maxAge: 30 * 24 * 60 * 60 * 1000,
        dryRun: true,
      });

      expect(result.deleted).toEqual(['old-session']);
      expect(mockFs.unlink).not.toHaveBeenCalled();
    });

    it('should handle deletion errors gracefully', async () => {
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);

      // Mock listSessions('completed')
      mockFs.readdir.mockResolvedValueOnce(['old-session.json'] as any);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        sessionId: 'old-session',
        workflowId: 'test-workflow',
        status: 'completed',
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
        currentStepIndex: 0,
        stepExecutions: [],
      }));

      // Mock listSessions('failed') - return empty
      mockFs.readdir.mockResolvedValueOnce([]);

      // Mock findSessionFile for deleteSession - should find session in 'completed' directory
      mockFs.access
        .mockRejectedValueOnce(new Error('ENOENT')) // running directory
        .mockRejectedValueOnce(new Error('ENOENT')) // paused directory
        .mockResolvedValueOnce(undefined); // completed directory - found here
      
      // Mock unlink to fail
      mockFs.unlink.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await stateManager.cleanupSessions({
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      expect(result.deleted).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        sessionId: 'old-session',
        error: 'Failed to delete session old-session: Permission denied',
      });
    });
  });

  describe('error handling', () => {
    it('should handle various error types in getErrorMessage', async () => {
      // This is tested indirectly through other tests, but let's ensure coverage
      const state: WorkflowSessionState = {
        sessionId: 'test-session',
        workflowId: 'test-workflow',
        status: 'running',
        inputs: {},
        context: { inputs: {}, variables: {}, outputs: {} },
        outputs: {},
        stepExecutions: [],
        currentStepIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };

      // Test with string error
      mockFs.writeFile.mockRejectedValueOnce('String error');
      await expect(stateManager.saveSession(state)).rejects.toThrow(StateError);

      // Test with object error
      mockFs.writeFile.mockRejectedValueOnce({ message: 'Object error' });
      await expect(stateManager.saveSession(state)).rejects.toThrow(StateError);
    });
  });
});