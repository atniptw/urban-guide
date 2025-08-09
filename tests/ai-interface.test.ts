/**
 * Tests for AI Interface core abstractions
 */

import {
  AIInterface,
  AIResponse,
  AIConfig,
  Usage,
  AIError,
  AITimeoutError,
  AIValidationError,
} from '../src/ai/ai-interface';

describe('AI Interface Types', () => {
  describe('Usage', () => {
    it('should have correct structure', () => {
      const usage: Usage = {
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
        cost: 0.01,
      };

      expect(usage.promptTokens).toBe(100);
      expect(usage.completionTokens).toBe(200);
      expect(usage.totalTokens).toBe(300);
      expect(usage.cost).toBe(0.01);
    });

    it('should work without optional cost', () => {
      const usage: Usage = {
        promptTokens: 50,
        completionTokens: 100,
        totalTokens: 150,
      };

      expect(usage.cost).toBeUndefined();
    });
  });

  describe('AIResponse', () => {
    it('should have correct structure', () => {
      const timestamp = new Date();
      const response: AIResponse = {
        content: 'Test response content',
        agent: 'test-agent',
        timestamp,
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        model: 'gpt-4',
      };

      expect(response.content).toBe('Test response content');
      expect(response.agent).toBe('test-agent');
      expect(response.timestamp).toBe(timestamp);
      expect(response.model).toBe('gpt-4');
      expect(response.usage?.totalTokens).toBe(30);
    });
  });

  describe('AIConfig', () => {
    it('should allow various configuration options', () => {
      const config: AIConfig = {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        timeout: 30000,
        customParam: 'custom-value',
      };

      expect(config.model).toBe('gpt-4');
      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(1000);
      expect(config.timeout).toBe(30000);
      expect(config.customParam).toBe('custom-value');
    });
  });
});

describe('AI Error Classes', () => {
  describe('AIError', () => {
    it('should create basic error', () => {
      const error = new AIError('Test error message');

      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('AIError');
      expect(error.code).toBe('AI_ERROR');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with custom code and cause', () => {
      const originalError = new Error('Original error');
      const error = new AIError('Test error', 'CUSTOM_CODE', originalError);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.cause).toBe(originalError);
    });
  });

  describe('AITimeoutError', () => {
    it('should create timeout error with default message', () => {
      const error = new AITimeoutError();

      expect(error.message).toBe('AI request timed out');
      expect(error.name).toBe('AITimeoutError');
      expect(error.code).toBe('AI_TIMEOUT');
    });

    it('should create timeout error with custom message and cause', () => {
      const cause = new Error('Network timeout');
      const error = new AITimeoutError('Custom timeout message', cause);

      expect(error.message).toBe('Custom timeout message');
      expect(error.cause).toBe(cause);
    });
  });

  describe('AIValidationError', () => {
    it('should create validation error with default message', () => {
      const error = new AIValidationError();

      expect(error.message).toBe('AI response validation failed');
      expect(error.name).toBe('AIValidationError');
      expect(error.code).toBe('AI_VALIDATION');
    });

    it('should create validation error with custom message', () => {
      const error = new AIValidationError('Response too short');

      expect(error.message).toBe('Response too short');
    });
  });
});

describe('AIInterface', () => {
  // Mock implementation for testing
  class MockAIInterface implements AIInterface {
    private usage: Usage | null = null;

    async sendPrompt(prompt: string, agent: string, config?: AIConfig): Promise<AIResponse> {
      return {
        content: `Mock response to: ${prompt.substring(0, 50)}...`,
        agent,
        timestamp: new Date(),
        model: config?.model || 'mock-model',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };
    }

    supportsStreaming(): boolean {
      return false;
    }

    getUsage(): Usage | null {
      return this.usage;
    }

    resetUsage(): void {
      this.usage = null;
    }

    validateResponse(response: string, _prompt: string): boolean {
      return response.length > 0;
    }

    getName(): string {
      return 'Mock AI Interface';
    }
  }

  let mockInterface: MockAIInterface;

  beforeEach(() => {
    mockInterface = new MockAIInterface();
  });

  it('should implement all required methods', () => {
    expect(typeof mockInterface.sendPrompt).toBe('function');
    expect(typeof mockInterface.supportsStreaming).toBe('function');
    expect(typeof mockInterface.getUsage).toBe('function');
    expect(typeof mockInterface.resetUsage).toBe('function');
    expect(typeof mockInterface.validateResponse).toBe('function');
    expect(typeof mockInterface.getName).toBe('function');
  });

  it('should send prompts and return responses', async () => {
    const response = await mockInterface.sendPrompt('Test prompt', 'test-agent');

    expect(response.content).toContain('Mock response to: Test prompt');
    expect(response.agent).toBe('test-agent');
    expect(response.model).toBe('mock-model');
    expect(response.usage?.totalTokens).toBe(30);
  });

  it('should handle configuration', async () => {
    const config: AIConfig = {
      model: 'custom-model',
      temperature: 0.5,
      maxTokens: 500,
    };

    const response = await mockInterface.sendPrompt('Test prompt', 'agent', config);

    expect(response.model).toBe('custom-model');
  });

  it('should validate responses', () => {
    expect(mockInterface.validateResponse('Valid response', 'prompt')).toBe(true);
    expect(mockInterface.validateResponse('', 'prompt')).toBe(false);
  });

  it('should manage usage statistics', () => {
    expect(mockInterface.getUsage()).toBe(null);
    mockInterface.resetUsage();
    expect(mockInterface.getUsage()).toBe(null);
  });

  it('should return interface name', () => {
    expect(mockInterface.getName()).toBe('Mock AI Interface');
  });
});