/**
 * Agent Manager for handling multiple role-based AI agents
 * Manages agent loading, routing, and lifecycle
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Agent, AgentConfig, MemoryScope } from './agent';
import { Step, Context } from '../core/types';
import { AIInterface } from '../ai/ai-interface';
import { Logger, ConsoleLogger } from '../utils/logger';

/**
 * Agent manager configuration
 */
export interface AgentManagerConfig {
  configPath?: string;
  aiInterface: AIInterface;
  logger?: Logger;
}

/**
 * Agent definitions from configuration
 */
export interface AgentDefinitions {
  [role: string]: AgentConfig;
}

/**
 * Agent Manager class
 */
export class AgentManager {
  private agents: Map<string, Agent> = new Map();
  private agentConfigs: Map<string, AgentConfig> = new Map();
  private logger: Logger;
  private aiInterface: AIInterface;
  private configPath: string;

  constructor(config: AgentManagerConfig) {
    this.aiInterface = config.aiInterface;
    this.logger = config.logger || new ConsoleLogger();
    this.configPath = config.configPath || path.join(__dirname, 'default-agents.yaml');

    // Load default agents on initialization
    this.loadDefaultAgents();
  }

  /**
   * Load default agents from configuration file
   */
  private loadDefaultAgents(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const configContent = fs.readFileSync(this.configPath, 'utf8');
        const definitions = yaml.load(configContent) as AgentDefinitions;

        Object.entries(definitions).forEach(([role, config]) => {
          this.agentConfigs.set(role, config);
          this.logger.info(`Loaded agent configuration for role: ${role}`);
        });
      } else {
        this.logger.warn(`Agent configuration file not found: ${this.configPath}`);
        // Load built-in defaults
        this.loadBuiltInDefaults();
      }
    } catch (error) {
      this.logger.error(`Failed to load agent configurations: ${String(error)}`);
      // Fall back to built-in defaults
      this.loadBuiltInDefaults();
    }
  }

  /**
   * Load built-in default agent configurations
   */
  private loadBuiltInDefaults(): void {
    const defaults: AgentDefinitions = {
      'tech-lead': {
        role: 'tech-lead',
        capabilities: ['analysis', 'architecture', 'task-breakdown', 'review'],
        systemPrompt: `You are a senior technical lead responsible for analyzing requirements, 
designing system architecture, breaking down complex features into manageable tasks, 
and reviewing technical decisions. Focus on best practices, scalability, and maintainability.`,
        memory: {
          type: 'persistent',
          scope: MemoryScope.SESSION,
          retention: '24h',
          maxEntries: 100,
        },
        model: 'gpt-4',
        temperature: 0.7,
      },
      developer: {
        role: 'developer',
        capabilities: ['implementation', 'debugging', 'refactoring', 'testing'],
        systemPrompt: `You are an experienced software developer responsible for implementing features, 
writing clean code, debugging issues, and ensuring code quality. Follow coding standards and 
write maintainable, well-documented code.`,
        memory: {
          type: 'persistent',
          scope: MemoryScope.SESSION,
          retention: '12h',
          maxEntries: 50,
        },
        model: 'gpt-4',
        temperature: 0.5,
      },
      'qa-tester': {
        role: 'qa-tester',
        capabilities: ['testing', 'validation', 'test-planning', 'bug-reporting'],
        systemPrompt: `You are a QA engineer responsible for testing software, validating requirements, 
creating test plans, and reporting bugs. Focus on edge cases, user experience, and ensuring 
the software meets quality standards.`,
        memory: {
          type: 'transient',
          scope: MemoryScope.STEP,
          maxEntries: 20,
        },
        model: 'gpt-4',
        temperature: 0.3,
      },
    };

    Object.entries(defaults).forEach(([role, config]) => {
      this.agentConfigs.set(role, config);
      this.logger.info(`Loaded built-in agent configuration for role: ${role}`);
    });
  }

  /**
   * Load an agent by role
   */
  loadAgent(role: string): Agent {
    // Check if agent is already loaded
    const existingAgent = this.agents.get(role);
    if (existingAgent) {
      return existingAgent;
    }

    // Check if configuration exists
    const config = this.agentConfigs.get(role);
    if (!config) {
      throw new Error(`No configuration found for agent role: ${role}`);
    }

    // Create and cache the agent
    const agent = new Agent(config, this.aiInterface, this.logger);
    this.agents.set(role, agent);
    this.logger.info(`Loaded agent: ${role}`);

    return agent;
  }

  /**
   * Load a custom agent configuration
   */
  loadCustomAgent(config: AgentConfig): Agent {
    // Validate configuration
    if (!config.role) {
      throw new Error('Agent configuration must include a role');
    }

    // Store configuration
    this.agentConfigs.set(config.role, config);

    // Create and cache the agent
    const agent = new Agent(config, this.aiInterface, this.logger);
    this.agents.set(config.role, agent);
    this.logger.info(`Loaded custom agent: ${config.role}`);

    return agent;
  }

  /**
   * Route a task to the appropriate agent
   */
  routeTask(step: Step): Agent {
    // If step specifies an agent, use that
    if (step.agent) {
      return this.loadAgent(step.agent);
    }

    // If step specifies required capabilities, find matching agent
    if (step.requiredCapabilities && step.requiredCapabilities.length > 0) {
      for (const [role, config] of this.agentConfigs.entries()) {
        const hasAllCapabilities = step.requiredCapabilities.every((cap) =>
          config.capabilities.includes(cap)
        );

        if (hasAllCapabilities) {
          this.logger.info(`Routing step ${step.id} to agent ${role} based on capabilities`);
          return this.loadAgent(role);
        }
      }

      throw new Error(
        `No agent found with required capabilities: ${step.requiredCapabilities.join(', ')}`
      );
    }

    // Default routing based on step type
    const defaultRouting: Record<string, string> = {
      analysis: 'tech-lead',
      architecture: 'tech-lead',
      implementation: 'developer',
      testing: 'qa-tester',
      validation: 'qa-tester',
    };

    const defaultRole = defaultRouting[step.type] || 'developer';
    this.logger.info(`Routing step ${step.id} to default agent ${defaultRole}`);
    return this.loadAgent(defaultRole);
  }

  /**
   * Get agent context for a specific scope
   */
  getAgentContext(role: string, scope: MemoryScope, stepId?: string): Context {
    const agent = this.agents.get(role);
    if (!agent) {
      this.logger.warn(`Agent ${role} not loaded, returning empty context`);
      return {
        inputs: {},
        outputs: {},
        variables: {},
      };
    }

    return agent.getContext(scope, stepId);
  }

  /**
   * Update agent memory with new context
   */
  updateAgentMemory(role: string, context: Context, stepId?: string): void {
    const agent = this.loadAgent(role);
    agent.updateMemory(context, stepId);
    this.logger.debug(`Updated memory for agent ${role}`);
  }

  /**
   * Clear agent memory by scope
   */
  clearAgentMemory(role: string, scope: MemoryScope, stepId?: string): void {
    const agent = this.agents.get(role);
    if (agent) {
      agent.clearMemory(scope, stepId);
      this.logger.info(`Cleared ${scope} memory for agent ${role}`);
    }
  }

  /**
   * Get all loaded agents
   */
  getLoadedAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get all available agent roles
   */
  getAvailableRoles(): string[] {
    return Array.from(this.agentConfigs.keys());
  }

  /**
   * Get agent configuration
   */
  getAgentConfig(role: string): AgentConfig | undefined {
    return this.agentConfigs.get(role);
  }

  /**
   * Check if an agent can handle a step
   */
  canAgentHandle(role: string, step: Step): boolean {
    try {
      const agent = this.loadAgent(role);
      return agent.canHandle(step);
    } catch {
      return false;
    }
  }

  /**
   * Execute a step with the appropriate agent
   */
  async executeStep(step: Step, context: Context): Promise<unknown> {
    const agent = this.routeTask(step);
    return agent.executeTask(step, context);
  }

  /**
   * Reset all agents (clear all memory)
   */
  resetAllAgents(): void {
    this.agents.forEach((agent, role) => {
      agent.clearMemory(MemoryScope.PERSISTENT);
      this.logger.info(`Reset agent: ${role}`);
    });
  }
}
