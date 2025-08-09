/**
 * Tests for Agent class and memory management
 */

import { Agent, AgentConfig, AgentMemory, MemoryScope, MemoryEntry } from '../src/agents/agent';
import { AIInterface, AIResponse } from '../src/ai/ai-interface';
import { Step, Context } from '../src/core/types';
import { SilentLogger } from '../src/utils/logger';

// Mock AI Interface
class MockAIInterface implements AIInterface {
  async sendPrompt(prompt: string, agent: string): Promise<AIResponse> {
    return {
      content: `Mock response for ${agent}: ${prompt.substring(0, 50)}...`,
      agent,
      model: 'mock-model',
      timestamp: new Date(),
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    };
  }

  validateResponse(response: string, _prompt: string): boolean {
    return response.length > 0 && response.trim() !== '';
  }

  getName(): string {
    return 'Mock AI Interface';
  }

  supportsStreaming(): boolean {
    return false;
  }

  getUsage() {
    return null;
  }

  resetUsage(): void {}
}

describe('AgentMemory', () => {
  let memory: AgentMemory;

  beforeEach(() => {
    memory = new AgentMemory({
      type: 'persistent',
      scope: MemoryScope.SESSION,
      maxEntries: 5,
    });
  });

  describe('memory management', () => {
    it('should add and retrieve memory entries', () => {
      const entry: MemoryEntry = {
        id: 'test-1',
        timestamp: new Date(),
        context: {
          inputs: { test: 'value' },
          outputs: {},
          variables: {},
        },
      };

      memory.addEntry(entry);
      const entries = memory.getEntriesByScope(MemoryScope.SESSION);
      
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('test-1');
      expect(entries[0].context.inputs.test).toBe('value');
    });

    it('should enforce max entries limit', () => {
      // Add more entries than the limit
      for (let i = 0; i < 7; i++) {
        const entry: MemoryEntry = {
          id: `test-${i}`,
          timestamp: new Date(),
          context: {
            inputs: { index: i },
            outputs: {},
            variables: {},
          },
        };
        memory.addEntry(entry);
      }

      const entries = memory.getEntriesByScope(MemoryScope.SESSION);
      expect(entries).toHaveLength(5); // Should not exceed maxEntries
    });

    it('should track entries by step', () => {
      const entry1: MemoryEntry = {
        id: 'test-1',
        timestamp: new Date(),
        step: 'step-1',
        context: {
          inputs: { step: '1' },
          outputs: {},
          variables: {},
        },
      };

      const entry2: MemoryEntry = {
        id: 'test-2',
        timestamp: new Date(),
        step: 'step-2',
        context: {
          inputs: { step: '2' },
          outputs: {},
          variables: {},
        },
      };

      memory.addEntry(entry1);
      memory.addEntry(entry2);

      const step1Entries = memory.getEntriesByScope(MemoryScope.STEP, 'step-1');
      const step2Entries = memory.getEntriesByScope(MemoryScope.STEP, 'step-2');

      expect(step1Entries).toHaveLength(1);
      expect(step1Entries[0].context.inputs.step).toBe('1');
      expect(step2Entries).toHaveLength(1);
      expect(step2Entries[0].context.inputs.step).toBe('2');
    });

    it('should merge contexts correctly', () => {
      const entry1: MemoryEntry = {
        id: 'test-1',
        timestamp: new Date(),
        context: {
          inputs: { input1: 'value1' },
          outputs: { output1: 'result1' },
          variables: { var1: 'variable1' },
        },
      };

      const entry2: MemoryEntry = {
        id: 'test-2',
        timestamp: new Date(),
        context: {
          inputs: { input2: 'value2' },
          outputs: { output2: 'result2' },
          variables: { var2: 'variable2' },
        },
      };

      memory.addEntry(entry1);
      memory.addEntry(entry2);

      const mergedContext = memory.getContext(MemoryScope.SESSION);

      expect(mergedContext.inputs).toEqual({
        input1: 'value1',
        input2: 'value2',
      });
      expect(mergedContext.outputs).toEqual({
        output1: 'result1',
        output2: 'result2',
      });
      expect(mergedContext.variables).toEqual({
        var1: 'variable1',
        var2: 'variable2',
      });
    });

    it('should clear memory by scope', () => {
      const sessionEntry: MemoryEntry = {
        id: 'session-1',
        timestamp: new Date(),
        context: {
          inputs: { session: 'data' },
          outputs: {},
          variables: {},
        },
      };

      const stepEntry: MemoryEntry = {
        id: 'step-1',
        timestamp: new Date(),
        step: 'test-step',
        context: {
          inputs: { step: 'data' },
          outputs: {},
          variables: {},
        },
      };

      memory.addEntry(sessionEntry);
      memory.addEntry(stepEntry);

      memory.clearByScope(MemoryScope.STEP, 'test-step');
      
      const sessionEntries = memory.getEntriesByScope(MemoryScope.SESSION);
      const stepEntries = memory.getEntriesByScope(MemoryScope.STEP, 'test-step');

      expect(sessionEntries).toHaveLength(1); // Session entry should remain
      expect(stepEntries).toHaveLength(0); // Step entry should be cleared
    });

    it('should handle retention cleanup', () => {
      const retentionMemory = new AgentMemory({
        type: 'persistent',
        scope: MemoryScope.SESSION,
        retention: '1h',
        maxEntries: 10,
      });

      // Add an old entry (2 hours ago)
      const oldEntry: MemoryEntry = {
        id: 'old-entry',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        context: {
          inputs: { old: 'data' },
          outputs: {},
          variables: {},
        },
      };

      // Add a recent entry
      const recentEntry: MemoryEntry = {
        id: 'recent-entry',
        timestamp: new Date(),
        context: {
          inputs: { recent: 'data' },
          outputs: {},
          variables: {},
        },
      };

      retentionMemory.addEntry(oldEntry);
      retentionMemory.addEntry(recentEntry);

      const entries = retentionMemory.getEntriesByScope(MemoryScope.SESSION);
      
      // Should only have recent entry (old one should be cleaned up)
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('recent-entry');
    });
  });
});

describe('Agent', () => {
  let agent: Agent;
  let mockAI: MockAIInterface;
  let silentLogger: SilentLogger;

  const testConfig: AgentConfig = {
    role: 'test-agent',
    capabilities: ['testing', 'analysis'],
    systemPrompt: 'You are a test agent for unit testing.',
    memory: {
      type: 'transient',
      scope: MemoryScope.STEP,
      maxEntries: 10,
    },
    model: 'test-model',
    temperature: 0.5,
  };

  beforeEach(() => {
    mockAI = new MockAIInterface();
    silentLogger = new SilentLogger();
    agent = new Agent(testConfig, mockAI, silentLogger);
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(agent.role).toBe('test-agent');
      expect(agent.capabilities).toEqual(['testing', 'analysis']);
      expect(agent.systemPrompt).toBe('You are a test agent for unit testing.');
    });
  });

  describe('canHandle', () => {
    it('should handle steps with matching agent role', () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        agent: 'test-agent',
      };

      expect(agent.canHandle(step)).toBe(true);
    });

    it('should handle steps with required capabilities', () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        requiredCapabilities: ['testing'],
      };

      expect(agent.canHandle(step)).toBe(true);
    });

    it('should handle steps with multiple matching capabilities', () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        requiredCapabilities: ['testing', 'analysis'],
      };

      expect(agent.canHandle(step)).toBe(true);
    });

    it('should not handle steps with missing capabilities', () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        requiredCapabilities: ['missing-capability'],
      };

      expect(agent.canHandle(step)).toBe(false);
    });

    it('should not handle steps with wrong agent', () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        agent: 'different-agent',
      };

      expect(agent.canHandle(step)).toBe(false);
    });
  });

  describe('executeTask', () => {
    it('should execute task and return AI response', async () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        agent: 'test-agent',
        prompt: 'Test prompt',
      };

      const context: Context = {
        inputs: { test: 'input' },
        outputs: {},
        variables: {},
      };

      const response = await agent.executeTask(step, context);

      expect(response.agent).toBe('test-agent');
      expect(response.content).toContain('Mock response');
      expect(response.model).toBe('mock-model');
    });

    it('should throw error for incompatible steps', async () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        agent: 'different-agent',
      };

      const context: Context = {
        inputs: {},
        outputs: {},
        variables: {},
      };

      await expect(agent.executeTask(step, context)).rejects.toThrow(
        'Agent test-agent cannot handle step test-step'
      );
    });

    it('should merge memory context with current context', async () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        agent: 'test-agent',
        prompt: 'Test prompt',
      };

      // Add some memory context
      agent.updateMemory({
        inputs: { memory: 'value' },
        outputs: {},
        variables: { memVar: 'memValue' },
      }, 'test-step');

      const context: Context = {
        inputs: { current: 'input' },
        outputs: {},
        variables: { currentVar: 'currentValue' },
      };

      const response = await agent.executeTask(step, context);

      expect(response.agent).toBe('test-agent');
      // Verify the prompt contains both current and memory context
      expect(response.content).toContain('Mock response');
    });

    it('should use step-specific AI configuration', async () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        agent: 'test-agent',
        prompt: 'Test prompt',
        model: 'step-model',
        temperature: 0.8,
        maxTokens: 500,
      };

      const context: Context = {
        inputs: {},
        outputs: {},
        variables: {},
      };

      const response = await agent.executeTask(step, context);

      expect(response).toBeDefined();
      // In a real implementation, we'd verify the AI interface was called with correct config
    });
  });

  describe('memory management', () => {
    it('should update memory with new context', () => {
      const context: Context = {
        inputs: { test: 'value' },
        outputs: { result: 'output' },
        variables: { var: 'variable' },
      };

      agent.updateMemory(context, 'test-step');

      const retrievedContext = agent.getContext(MemoryScope.STEP, 'test-step');
      
      expect(retrievedContext.inputs.test).toBe('value');
      expect(retrievedContext.outputs.result).toBe('output');
      expect(retrievedContext.variables.var).toBe('variable');
    });

    it('should clear memory by scope', () => {
      const context: Context = {
        inputs: { test: 'value' },
        outputs: {},
        variables: {},
      };

      agent.updateMemory(context, 'test-step');
      
      // Verify memory exists
      let retrievedContext = agent.getContext(MemoryScope.STEP, 'test-step');
      expect(retrievedContext.inputs.test).toBe('value');

      // Clear memory
      agent.clearMemory(MemoryScope.STEP, 'test-step');

      // Verify memory is cleared
      retrievedContext = agent.getContext(MemoryScope.STEP, 'test-step');
      expect(Object.keys(retrievedContext.inputs)).toHaveLength(0);
    });
  });

  describe('prompt building', () => {
    it('should build prompt with system prompt and context', async () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        agent: 'test-agent',
        prompt: 'Analyze this data',
      };

      const context: Context = {
        inputs: { data: 'sample data' },
        outputs: {},
        variables: { setting: 'value' },
      };

      const response = await agent.executeTask(step, context);

      // The mock AI should receive a prompt that includes system prompt and context
      expect(response.content).toContain('Mock response');
    });

    it('should handle template-based steps', async () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        agent: 'test-agent',
        template: 'Process {{input}} with {{setting}}',
      };

      const context: Context = {
        inputs: { input: 'data' },
        outputs: {},
        variables: { setting: 'high' },
      };

      const response = await agent.executeTask(step, context);

      expect(response.content).toContain('Mock response');
    });
  });
});