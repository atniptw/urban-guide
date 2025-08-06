import { Command } from 'commander';
import chalk from 'chalk';

// Mock commander and chalk
jest.mock('commander');
jest.mock('chalk', () => ({
  blue: jest.fn((text: string) => text),
}));

describe('CLI Entry Point', () => {
  let mockProgram: jest.Mocked<Command>;
  let originalArgv: string[];
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    // Save original argv
    originalArgv = process.argv;

    // Setup mocks
    mockProgram = {
      name: jest.fn().mockReturnThis(),
      description: jest.fn().mockReturnThis(),
      version: jest.fn().mockReturnThis(),
      parse: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<Command>;

    (Command as jest.MockedClass<typeof Command>).mockImplementation(() => mockProgram);

    // Spy on console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    // Restore original argv
    process.argv = originalArgv;

    // Clear all mocks
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
  });

  it('should setup commander with correct configuration', () => {
    // Set argv to simulate running with no arguments
    process.argv = ['node', 'index.js'];

    // Import the CLI module (this executes the code)
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

  it('should display version when no arguments provided', () => {
    // Set argv to simulate running with no arguments
    process.argv = ['node', 'index.js'];

    // Import the CLI module
    jest.isolateModules(() => {
      require('./index');
    });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(chalk.blue).toHaveBeenCalledWith('aiflow v0.1.0');
    expect(consoleLogSpy).toHaveBeenCalledWith('aiflow v0.1.0');
  });

  it('should not display version when arguments are provided', () => {
    // Set argv to simulate running with arguments
    process.argv = ['node', 'index.js', '--help'];

    // Import the CLI module
    jest.isolateModules(() => {
      require('./index');
    });

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});
