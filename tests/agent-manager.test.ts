/**
 * Tests for AgentManager class
 */

import * as fs from 'fs';
import { AgentManager, AgentManagerConfig } from '../src/agents/agent-manager';
import { Agent, AgentConfig, MemoryScope } from '../src/agents/agent';
import { AIInterface, AIResponse } from '../src/ai/ai-interface';
import { Step, Context } from '../src/core/types';
import { SilentLogger } from '../src/utils/logger';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock AI Interface
class MockAIInterface implements AIInterface {
  async sendPrompt(prompt: string, agent: string): Promise<AIResponse> {
    return {
      content: `Mock response from ${agent}: ${prompt.substring(0, 50)}...`,
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

describe('AgentManager', () => {
  let agentManager: AgentManager;
  let mockAI: MockAIInterface;
  let silentLogger: SilentLogger;
  let config: AgentManagerConfig;

  beforeEach(() => {
    mockAI = new MockAIInterface();
    silentLogger = new SilentLogger();
    config = {
      aiInterface: mockAI,
      logger: silentLogger,
    };

    // Mock file system
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('');

    agentManager = new AgentManager(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with built-in defaults when config file not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      const manager = new AgentManager(config);
      const availableRoles = manager.getAvailableRoles();

      expect(availableRoles).toContain('tech-lead');
      expect(availableRoles).toContain('developer');
      expect(availableRoles).toContain('qa-tester');
    });

    it('should load agents from configuration file when it exists', () => {
      const mockConfig = `
tech-lead:
  role: tech-lead
  capabilities: [analysis, architecture]
  systemPrompt: Test prompt
  memory:
    type: persistent
    scope: session
    maxEntries: 50
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockConfig);

      const manager = new AgentManager(config);
      const techLeadConfig = manager.getAgentConfig('tech-lead');

      expect(techLeadConfig).toBeDefined();
      expect(techLeadConfig?.capabilities).toEqual(['analysis', 'architecture']);
      expect(techLeadConfig?.systemPrompt).toBe('Test prompt');
    });

    it('should fall back to built-in defaults on config file error', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const manager = new AgentManager(config);
      const availableRoles = manager.getAvailableRoles();

      // Should still have built-in defaults
      expect(availableRoles).toContain('tech-lead');
      expect(availableRoles).toContain('developer');
    });
  });

  describe('agent loading', () => {
    it('should load and cache agents', () => {
      const agent = agentManager.loadAgent('tech-lead');
      
      expect(agent).toBeInstanceOf(Agent);
      expect(agent.role).toBe('tech-lead');

      // Second call should return cached agent
      const cachedAgent = agentManager.loadAgent('tech-lead');
      expect(cachedAgent).toBe(agent);
    });

    it('should throw error for unknown agent role', () => {
      expect(() => {
        agentManager.loadAgent('unknown-role');
      }).toThrow('No configuration found for agent role: unknown-role');
    });

    it('should load custom agent configuration', () => {
      const customConfig: AgentConfig = {
        role: 'custom-agent',
        capabilities: ['custom-task'],
        systemPrompt: 'Custom agent prompt',
        memory: {
          type: 'transient',
          scope: MemoryScope.STEP,
          maxEntries: 10,
        },
      };

      const agent = agentManager.loadCustomAgent(customConfig);
      
      expect(agent.role).toBe('custom-agent');
      expect(agent.capabilities).toEqual(['custom-task']);
      
      // Should be available for subsequent loads
      const loadedAgent = agentManager.loadAgent('custom-agent');
      expect(loadedAgent).toBe(agent);
    });

    it('should throw error for custom agent without role', () => {
      const invalidConfig = {
        capabilities: ['task'],
        systemPrompt: 'No role',
        memory: {
          type: 'transient' as const,
          scope: MemoryScope.STEP,
        },
      } as AgentConfig;

      expect(() => {
        agentManager.loadCustomAgent(invalidConfig);
      }).toThrow('Agent configuration must include a role');
    });
  });

  describe('task routing', () => {
    it('should route to agent specified in step', () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        agent: 'developer',
      };

      const agent = agentManager.routeTask(step);
      expect(agent.role).toBe('developer');
    });

    it('should route based on required capabilities', () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        requiredCapabilities: ['testing', 'validation'],
      };

      const agent = agentManager.routeTask(step);
      expect(agent.role).toBe('qa-tester');
    });

    it('should throw error when no agent has required capabilities', () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        requiredCapabilities: ['nonexistent-capability'],
      };

      expect(() => {
        agentManager.routeTask(step);
      }).toThrow('No agent found with required capabilities: nonexistent-capability');
    });

    it('should use default routing based on step type', () => {
      const analysisStep: Step = {
        id: 'analysis-step',
        type: 'analysis' as any,
      };

      const agent = agentManager.routeTask(analysisStep);
      expect(agent.role).toBe('tech-lead');
    });

    it('should default to developer for unknown step types', () => {
      const unknownStep: Step = {
        id: 'unknown-step',
        type: 'unknown' as any,
      };

      const agent = agentManager.routeTask(unknownStep);
      expect(agent.role).toBe('developer');
    });
  });

  describe('context and memory management', () => {
    it('should get agent context', () => {
      const agent = agentManager.loadAgent('tech-lead');
      
      // Add some context to the agent's memory
      agent.updateMemory({
        inputs: { test: 'value' },
        outputs: {},
        variables: {},
      });

      const context = agentManager.getAgentContext('tech-lead', MemoryScope.SESSION);
      expect(context.inputs.test).toBe('value');
    });

    it('should return empty context for unloaded agent', () => {
      const context = agentManager.getAgentContext('unloaded-agent', MemoryScope.SESSION);
      
      expect(context).toEqual({
        inputs: {},
        outputs: {},
        variables: {},
      });
    });

    it('should update agent memory', () => {
      agentManager.loadAgent('developer');
      
      const context: Context = {
        inputs: { code: 'function test() {}' },
        outputs: { result: 'success' },
        variables: { lang: 'typescript' },
      };

      agentManager.updateAgentMemory('developer', context, 'test-step');

      const retrievedContext = agentManager.getAgentContext('developer', MemoryScope.SESSION);
      expect(retrievedContext.inputs.code).toBe('function test() {}');
      expect(retrievedContext.outputs.result).toBe('success');
      expect(retrievedContext.variables.lang).toBe('typescript');
    });

    it('should clear agent memory by scope', () => {
      const agent = agentManager.loadAgent('qa-tester');
      
      // Add memory
      agent.updateMemory({
        inputs: { test: 'data' },
        outputs: {},
        variables: {},
      }, 'test-step');

      // Verify memory exists
      let context = agentManager.getAgentContext('qa-tester', MemoryScope.STEP, 'test-step');
      expect(context.inputs.test).toBe('data');

      // Clear memory
      agentManager.clearAgentMemory('qa-tester', MemoryScope.STEP, 'test-step');

      // Verify memory is cleared
      context = agentManager.getAgentContext('qa-tester', MemoryScope.STEP, 'test-step');
      expect(Object.keys(context.inputs)).toHaveLength(0);
    });
  });

  describe('agent capability checking', () => {
    it('should check if agent can handle step', () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        requiredCapabilities: ['analysis'],
      };

      expect(agentManager.canAgentHandle('tech-lead', step)).toBe(true);
      expect(agentManager.canAgentHandle('qa-tester', step)).toBe(false);
    });

    it('should return false for unknown agent', () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        agent: 'unknown-agent',
      };

      expect(agentManager.canAgentHandle('unknown-agent', step)).toBe(false);
    });
  });

  describe('step execution', () => {
    it('should execute step with appropriate agent', async () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        agent: 'tech-lead',
        prompt: 'Analyze this requirement',
      };

      const context: Context = {
        inputs: { requirement: 'Build a login system' },
        outputs: {},
        variables: {},
      };

      const result = await agentManager.executeStep(step, context) as AIResponse;
      
      expect(result.agent).toBe('tech-lead');
      expect(result.content).toContain('Mock response from tech-lead');
    });

    it('should route and execute step based on capabilities', async () => {
      const step: Step = {
        id: 'test-step',
        type: 'ai-prompt',
        requiredCapabilities: ['validation'],
        prompt: 'Validate requirements',
      };

      const context: Context = {
        inputs: { feature: 'user authentication' },
        outputs: {},
        variables: {},
      };

      const result = await agentManager.executeStep(step, context) as AIResponse;
      
      expect(result.agent).toBe('qa-tester');
      expect(result.content).toContain('Mock response from qa-tester');
    });
  });

  describe('agent information', () => {
    it('should return list of loaded agents', () => {
      expect(agentManager.getLoadedAgents()).toEqual([]);

      agentManager.loadAgent('tech-lead');
      agentManager.loadAgent('developer');

      const loadedAgents = agentManager.getLoadedAgents();
      expect(loadedAgents).toContain('tech-lead');
      expect(loadedAgents).toContain('developer');
      expect(loadedAgents).toHaveLength(2);
    });

    it('should return list of available roles', () => {
      const availableRoles = agentManager.getAvailableRoles();
      
      expect(availableRoles).toContain('tech-lead');
      expect(availableRoles).toContain('developer');
      expect(availableRoles).toContain('qa-tester');
      expect(availableRoles.length).toBeGreaterThan(0);
    });

    it('should return agent configuration', () => {
      const config = agentManager.getAgentConfig('tech-lead');
      
      expect(config).toBeDefined();
      expect(config?.role).toBe('tech-lead');
      expect(config?.capabilities).toContain('analysis');
      expect(config?.systemPrompt).toContain('technical lead');
    });

    it('should return undefined for unknown agent config', () => {
      const config = agentManager.getAgentConfig('unknown-agent');
      expect(config).toBeUndefined();
    });
  });

  describe('reset functionality', () => {
    it('should reset all agents', () => {
      // Load some agents and add memory
      const techLead = agentManager.loadAgent('tech-lead');
      const developer = agentManager.loadAgent('developer');

      techLead.updateMemory({
        inputs: { task: 'analysis' },
        outputs: {},
        variables: {},
      });

      developer.updateMemory({
        inputs: { code: 'implementation' },
        outputs: {},
        variables: {},
      });

      // Reset all agents
      agentManager.resetAllAgents();

      // Verify memory is cleared
      const techLeadContext = techLead.getContext(MemoryScope.PERSISTENT);
      const developerContext = developer.getContext(MemoryScope.PERSISTENT);

      expect(Object.keys(techLeadContext.inputs)).toHaveLength(0);
      expect(Object.keys(developerContext.inputs)).toHaveLength(0);
    });
  });
});