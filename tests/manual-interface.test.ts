/**
 * Tests for ManualInterface implementation
 */

import { ManualInterface } from '../src/ai/manual-interface';
import { AIValidationError, AITimeoutError } from '../src/ai/ai-interface';
import * as readline from 'readline';

// Mock readline
jest.mock('readline');

describe('ManualInterface', () => {
  let manualInterface: ManualInterface;
  let mockReadline: {
    createInterface: jest.Mock;
    close: jest.Mock;
    on: jest.Mock;
    removeAllListeners: jest.Mock;
  };

  beforeEach(() => {
    // Reset console mocks
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Mock readline interface
    mockReadline = {
      createInterface: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
    };

    (readline.createInterface as jest.Mock).mockReturnValue(mockReadline);

    manualInterface = new ManualInterface();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (manualInterface) {
      manualInterface.close();
    }
  });

  describe('constructor', () => {
    it('should create interface with default timeout', () => {
      const instance = new ManualInterface();
      expect(instance.getName()).toBe('Manual Copy-Paste Interface');
    });

    it('should create interface with custom timeout', () => {
      const instance = new ManualInterface(60000);
      expect(instance.getName()).toBe('Manual Copy-Paste Interface');
      instance.close();
    });

    it('should initialize readline interface', () => {
      expect(readline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
      });
    });
  });

  describe('getName', () => {
    it('should return correct interface name', () => {
      expect(manualInterface.getName()).toBe('Manual Copy-Paste Interface');
    });
  });

  describe('supportsStreaming', () => {
    it('should return false for manual interface', () => {
      expect(manualInterface.supportsStreaming()).toBe(false);
    });
  });

  describe('usage management', () => {
    it('should start with null usage', () => {
      expect(manualInterface.getUsage()).toBe(null);
    });

    it('should reset usage to null', () => {
      manualInterface.resetUsage();
      expect(manualInterface.getUsage()).toBe(null);
    });
  });

  describe('validateResponse', () => {
    it('should validate good responses', () => {
      const validResponse = 'This is a valid AI response with sufficient content.';
      expect(manualInterface.validateResponse(validResponse, 'test prompt')).toBe(true);
    });

    it('should reject empty responses', () => {
      expect(manualInterface.validateResponse('', 'test prompt')).toBe(false);
      expect(manualInterface.validateResponse('   ', 'test prompt')).toBe(false);
    });

    it('should reject too short responses', () => {
      expect(manualInterface.validateResponse('short', 'test prompt')).toBe(false);
    });

    it('should reject placeholder text', () => {
      const placeholders = [
        'This is [insert your response here]',
        'Please add [placeholder text]',
        'Lorem ipsum dolor sit amet...',
        'TODO: write the actual response',
        'FIXME: this needs to be completed',
        '[Your response here]',
      ];

      placeholders.forEach((placeholder) => {
        expect(manualInterface.validateResponse(placeholder, 'test')).toBe(false);
      });
    });

    it('should handle case insensitive placeholder detection', () => {
      expect(manualInterface.validateResponse('This contains TODO: finish this', 'test')).toBe(
        false
      );
      expect(manualInterface.validateResponse('This contains todo: finish this', 'test')).toBe(
        false
      );
    });
  });

  describe('sendPrompt', () => {
    beforeEach(() => {
      // Mock successful user input
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should display formatted prompt for copying', async () => {
      // Mock readline to immediately resolve with valid input
      mockReadline.on.mockImplementation((event, callback) => {
        if (event === 'line') {
          // Simulate user input
          setTimeout(() => {
            callback('Valid AI response with sufficient content');
            callback(''); // First empty line
            callback(''); // Second empty line to finish
          }, 0);
        }
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const prompt = 'Test prompt for AI';
      const agent = 'test-agent';

      // Start the sendPrompt call but don't await yet
      const responsePromise = manualInterface.sendPrompt(prompt, agent, {
        model: 'gpt-4',
        temperature: 0.7,
      });

      // Advance timers to trigger the input simulation
      jest.advanceTimersByTime(100);

      await responsePromise;

      // Verify prompt display
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🤖 AI Agent: test-agent')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Model: gpt-4'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Temperature: 0.7'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📋 Copy this prompt to your AI tool:')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(prompt));
    });

    it('should collect and validate user response', async () => {
      const validResponse = 'This is a comprehensive AI response with detailed information.';

      // Mock successful readline interaction
      mockReadline.on.mockImplementation((event, callback) => {
        if (event === 'line') {
          setTimeout(() => {
            callback(validResponse);
            callback(''); // First empty line
            callback(''); // Second empty line to finish
          }, 0);
        }
      });

      const responsePromise = manualInterface.sendPrompt('Test prompt', 'agent');
      jest.advanceTimersByTime(100);

      const result = await responsePromise;

      expect(result.content).toBe(validResponse);
      expect(result.agent).toBe('agent');
      expect(result.model).toBe('manual-input');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle custom model in config', async () => {
      const validResponse = 'Valid response content here.';

      mockReadline.on.mockImplementation((event, callback) => {
        if (event === 'line') {
          setTimeout(() => {
            callback(validResponse);
            callback('');
            callback('');
          }, 0);
        }
      });

      const responsePromise = manualInterface.sendPrompt('Test', 'agent', {
        model: 'custom-model',
      });
      jest.advanceTimersByTime(100);

      const result = await responsePromise;

      expect(result.model).toBe('custom-model');
    });

    it('should reject invalid responses', async () => {
      const invalidResponse = 'short'; // Too short

      mockReadline.on.mockImplementation((event, callback) => {
        if (event === 'line') {
          setTimeout(() => {
            callback(invalidResponse);
            callback('');
            callback('');
          }, 0);
        }
      });

      const responsePromise = manualInterface.sendPrompt('Test', 'agent');
      jest.advanceTimersByTime(100);

      await expect(responsePromise).rejects.toThrow(AIValidationError);
    });

    it('should handle timeout', async () => {
      const shortTimeout = 1000;
      const timeoutInterface = new ManualInterface(shortTimeout);

      // Don't provide any input, let it timeout
      mockReadline.on.mockImplementation((_event, _callback) => {
        // Don't call the callback, simulating no user input
      });

      const responsePromise = timeoutInterface.sendPrompt('Test', 'agent');

      // Advance timer past timeout
      jest.advanceTimersByTime(shortTimeout + 100);

      await expect(responsePromise).rejects.toThrow(AITimeoutError);

      timeoutInterface.close();
    });

    it('should handle SIGINT (Ctrl+C)', async () => {
      mockReadline.on.mockImplementation((event, callback) => {
        if (event === 'SIGINT') {
          setTimeout(() => callback(), 0);
        }
      });

      const responsePromise = manualInterface.sendPrompt('Test', 'agent');
      jest.advanceTimersByTime(100);

      await expect(responsePromise).rejects.toThrow(AIValidationError);
      await expect(responsePromise).rejects.toThrow('User cancelled input');
    });

    it('should handle multi-line responses correctly', async () => {
      const multiLineResponse = [
        'First line of response',
        'Second line with more content',
        'Third line completing the thought',
      ];

      mockReadline.on.mockImplementation((event, callback) => {
        if (event === 'line') {
          setTimeout(() => {
            multiLineResponse.forEach((line) => callback(line));
            callback(''); // First empty line
            callback(''); // Second empty line to finish
          }, 0);
        }
      });

      const responsePromise = manualInterface.sendPrompt('Test', 'agent');
      jest.advanceTimersByTime(100);

      const result = await responsePromise;

      expect(result.content).toBe(multiLineResponse.join('\n'));
    });
  });

  describe('close', () => {
    it('should close readline interface', () => {
      manualInterface.close();
      expect(mockReadline.close).toHaveBeenCalled();
    });

    it('should handle close when readline is not available', () => {
      const interfaceWithoutRL = new ManualInterface();
      (interfaceWithoutRL as any).rl = null;

      // Should not throw
      expect(() => interfaceWithoutRL.close()).not.toThrow();
    });
  });
});