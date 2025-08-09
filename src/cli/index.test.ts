import { Command } from 'commander';
import { EXIT_CODES } from '../core/constants';

// Mock external dependencies
jest.mock('commander');
jest.mock('chalk', () => ({
  blue: jest.fn((text: string) => `blue:${text}`),
  red: jest.fn((text: string) => `red:${text}`),
  yellow: jest.fn((text: string) => `yellow:${text}`),
  gray: jest.fn((text: string) => `gray:${text}`),
}));

// Mock process.exit to prevent tests from terminating
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null): never => {
  throw new Error(`Process exit called with code: ${code}`);
});

describe('CLI Enhanced Commands', () => {
  let mockProgram: jest.Mocked<Command>;
  let mockCommand: jest.Mocked<Command>;
  let originalArgv: string[];
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Save original argv
    originalArgv = process.argv;

    // Setup command mock
    mockCommand = {
      command: jest.fn().mockReturnThis(),
      description: jest.fn().mockReturnThis(),
      option: jest.fn().mockReturnThis(),
      argument: jest.fn().mockReturnThis(),
      action: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<Command>;

    // Setup program mock
    mockProgram = {
      name: jest.fn().mockReturnThis(),
      description: jest.fn().mockReturnThis(),
      version: jest.fn().mockReturnThis(),
      command: jest.fn().mockReturnValue(mockCommand),
      parse: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<Command>;

    (Command as jest.MockedClass<typeof Command>).mockImplementation(() => mockProgram);

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    // Restore original argv
    process.argv = originalArgv;

    // Clear all mocks
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    mockExit.mockClear();
  });

  describe('Basic CLI Setup', () => {
    it('should setup commander with correct configuration', () => {
      process.argv = ['node', 'index.js'];

      jest.isolateModules(() => {
        require('./index');
      });

      expect(Command).toHaveBeenCalledTimes(1);
      expect(mockProgram.name).toHaveBeenCalledWith('aiflow');
      expect(mockProgram.description).toHaveBeenCalledWith(
        'AI Workflow Orchestrator - Manage AI agents for development tasks'
      );
      expect(mockProgram.version).toHaveBeenCalledWith('0.1.0');
      expect(mockProgram.parse).toHaveBeenCalledTimes(1);
    });

    it('should display enhanced version info when no arguments provided', () => {
      process.argv = ['node', 'index.js'];

      jest.isolateModules(() => {
        require('./index');
      });

      expect(consoleLogSpy).toHaveBeenCalledWith('blue:aiflow v0.1.0');
      expect(consoleLogSpy).toHaveBeenCalledWith('gray:AI Workflow Orchestrator - Manage AI agents for development tasks');
      expect(consoleLogSpy).toHaveBeenCalledWith('gray:Usage: aiflow <command> [options]');
    });

    it('should register all 6 commands', () => {
      process.argv = ['node', 'index.js'];

      jest.isolateModules(() => {
        require('./index');
      });

      // Verify all commands are registered
      expect(mockProgram.command).toHaveBeenCalledWith('run <workflow-id>');
      expect(mockProgram.command).toHaveBeenCalledWith('continue');
      expect(mockProgram.command).toHaveBeenCalledWith('status');
      expect(mockProgram.command).toHaveBeenCalledWith('list');
      expect(mockProgram.command).toHaveBeenCalledWith('show <workflow-id>');
      expect(mockProgram.command).toHaveBeenCalledWith('export');
      
      expect(mockProgram.command).toHaveBeenCalledTimes(6);
    });
  });

  describe('Command Action Functions', () => {
    let runAction: (workflowId: string, options: any) => void;
    let continueAction: (options: any) => void;
    let statusAction: (options: any) => void;
    let listAction: (type: string, options: any) => void;
    let showAction: (workflowId: string, options: any) => void;
    let exportAction: (options: any) => void;

    beforeEach(() => {
      // Capture action functions for testing
      process.argv = ['node', 'index.js'];
      
      jest.isolateModules(() => {
        require('./index');
      });

      // Extract action functions from the mock calls
      const actionCalls = mockCommand.action.mock.calls;
      runAction = actionCalls[0][0];
      continueAction = actionCalls[1][0];
      statusAction = actionCalls[2][0];
      listAction = actionCalls[3][0];
      showAction = actionCalls[4][0];
      exportAction = actionCalls[5][0];
    });

    describe('Run Command', () => {
      it('should validate workflow ID is provided', async () => {
        await expect(runAction('', {})).rejects.toThrow('Process exit called with code: 2');
        expect(consoleErrorSpy).toHaveBeenCalledWith('red:❌ Error: Workflow ID is required and must be a non-empty string');
      });

      it('should validate workflow ID is non-empty string', async () => {
        await expect(runAction('   ', {})).rejects.toThrow('Process exit called with code: 2');
        expect(consoleErrorSpy).toHaveBeenCalledWith('red:❌ Error: Workflow ID is required and must be a non-empty string');
      });

      it('should handle valid workflow ID', async () => {
        await runAction('tech-lead', {});
        expect(consoleLogSpy).toHaveBeenCalledWith('blue:🚀 Starting workflow: tech-lead');
        expect(consoleLogSpy).toHaveBeenCalledWith('yellow:⚠️  Workflow engine not yet implemented');
      });

      it('should parse JSON input correctly', async () => {
        const options = { input: '{"key": "value"}', verbose: true };
        await runAction('test-workflow', options);
        
        expect(consoleLogSpy).toHaveBeenCalledWith('gray:Inputs:', JSON.stringify({ key: 'value' }, null, 2));
      });

      it('should handle invalid JSON input', async () => {
        const options = { input: '{invalid json}' };
        await expect(runAction('test-workflow', options)).rejects.toThrow('Process exit called with code: 2');
        expect(consoleErrorSpy).toHaveBeenCalledWith('red:❌ Error: Invalid JSON format in --input option');
      });

      it('should add feature URL to inputs', async () => {
        const options = { featureUrl: 'https://github.com/user/repo/issues/123', verbose: true };
        await runAction('tech-lead', options);
        
        expect(consoleLogSpy).toHaveBeenCalledWith('gray:Inputs:', JSON.stringify({ feature_url: 'https://github.com/user/repo/issues/123' }, null, 2));
      });
    });

    describe('Continue Command', () => {
      it('should handle continue without session ID', async () => {
        await continueAction({});
        expect(consoleLogSpy).toHaveBeenCalledWith('blue:🔄 Resuming workflow execution');
        expect(consoleLogSpy).toHaveBeenCalledWith('blue:Resuming most recent paused workflow');
      });

      it('should handle continue with valid session ID', async () => {
        const options = { sessionId: 'session-123' };
        await continueAction(options);
        expect(consoleLogSpy).toHaveBeenCalledWith('blue:Resuming session: session-123');
      });

      it('should validate session ID is non-empty', async () => {
        const options = { sessionId: '   ' };
        await expect(continueAction(options)).rejects.toThrow('Process exit called with code: 2');
        expect(consoleErrorSpy).toHaveBeenCalledWith('red:❌ Error: Session ID is required and must be a non-empty string');
      });
    });

    describe('Status Command', () => {
      it('should show general status', async () => {
        await statusAction({});
        expect(consoleLogSpy).toHaveBeenCalledWith('blue:📊 Workflow Status');
        expect(consoleLogSpy).toHaveBeenCalledWith('blue:Status for all active sessions');
      });

      it('should show status for specific session', async () => {
        const options = { sessionId: 'session-456' };
        await statusAction(options);
        expect(consoleLogSpy).toHaveBeenCalledWith('blue:Status for session: session-456');
      });

      it('should validate format option', async () => {
        const options = { format: 'invalid' };
        await expect(statusAction(options)).rejects.toThrow('Process exit called with code: 2');
        expect(consoleErrorSpy).toHaveBeenCalledWith('red:❌ Error: Format must be one of: table, json');
      });

      it('should accept valid format options', async () => {
        await statusAction({ format: 'json' });
        await statusAction({ format: 'table' });
        // Should not throw errors
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });
    });

    describe('List Command', () => {
      it('should validate type argument', async () => {
        await expect(listAction('invalid', {})).rejects.toThrow('Process exit called with code: 2');
        expect(consoleErrorSpy).toHaveBeenCalledWith('red:❌ Error: Only "workflows" type is currently supported');
      });

      it('should handle valid workflows type', async () => {
        await listAction('workflows', {});
        expect(consoleLogSpy).toHaveBeenCalledWith('blue:📋 Available Workflows');
      });

      it('should validate format option', async () => {
        await expect(listAction('workflows', { format: 'xml' })).rejects.toThrow('Process exit called with code: 2');
        expect(consoleErrorSpy).toHaveBeenCalledWith('red:❌ Error: Format must be one of: table, json');
      });
    });

    describe('Show Command', () => {
      it('should validate workflow ID is provided', async () => {
        await expect(showAction('', {})).rejects.toThrow('Process exit called with code: 2');
        expect(consoleErrorSpy).toHaveBeenCalledWith('red:❌ Error: Workflow ID is required and must be a non-empty string');
      });

      it('should handle valid workflow ID', async () => {
        await showAction('tech-lead', {});
        expect(consoleLogSpy).toHaveBeenCalledWith('blue:📄 Workflow Details: tech-lead');
      });

      it('should validate format option', async () => {
        await expect(showAction('tech-lead', { format: 'xml' })).rejects.toThrow('Process exit called with code: 2');
        expect(consoleErrorSpy).toHaveBeenCalledWith('red:❌ Error: Format must be one of: yaml, json');
      });

      it('should accept valid format options', async () => {
        await showAction('tech-lead', { format: 'yaml' });
        await showAction('tech-lead', { format: 'json' });
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });
    });

    describe('Export Command', () => {
      it('should handle export with default options', async () => {
        await exportAction({});
        expect(consoleLogSpy).toHaveBeenCalledWith('blue:📤 Exporting session data');
        expect(consoleLogSpy).toHaveBeenCalledWith('gray:Session: most recent session');
        expect(consoleLogSpy).toHaveBeenCalledWith('gray:Format: json');
      });

      it('should validate format option', async () => {
        await expect(exportAction({ format: 'xml' })).rejects.toThrow('Process exit called with code: 2');
        expect(consoleErrorSpy).toHaveBeenCalledWith('red:❌ Error: Format must be one of: json, markdown');
      });

      it('should validate session ID', async () => {
        await expect(exportAction({ sessionId: '  ' })).rejects.toThrow('Process exit called with code: 2');
        expect(consoleErrorSpy).toHaveBeenCalledWith('red:❌ Error: Session ID is required and must be a non-empty string');
      });

      it('should handle valid options', async () => {
        const options = {
          sessionId: 'session-789',
          format: 'markdown',
          output: './export.md'
        };
        await exportAction(options);
        
        expect(consoleLogSpy).toHaveBeenCalledWith('gray:Session: session-789');
        expect(consoleLogSpy).toHaveBeenCalledWith('gray:Format: markdown');
        expect(consoleLogSpy).toHaveBeenCalledWith('gray:Output: ./export.md');
      });
    });
  });

  describe('Error Handling', () => {
    let runAction: (workflowId: string, options: any) => void;

    beforeEach(() => {
      process.argv = ['node', 'index.js'];
      jest.isolateModules(() => {
        require('./index');
      });
      runAction = mockCommand.action.mock.calls[0][0];
    });

    it('should handle unexpected errors in commands', async () => {
      // Mock JSON.parse to throw an unexpected error
      const originalParse = JSON.parse;
      JSON.parse = jest.fn(() => {
        throw new Error('Unexpected error');
      });

      const options = { input: '{"valid": "json"}' };
      await expect(runAction('test-workflow', options)).rejects.toThrow('Process exit called with code: 3');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('red:❌ Failed to start workflow:', 'Unexpected error');

      // Restore JSON.parse
      JSON.parse = originalParse;
    });
  });

  describe('Exit Codes', () => {
    it('should use correct exit codes from constants', () => {
      expect(EXIT_CODES.validationError).toBe(2);
      expect(EXIT_CODES.workflowError).toBe(3);
      expect(EXIT_CODES.generalError).toBe(1);
    });
  });
});
