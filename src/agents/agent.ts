/**
 * Agent implementation for role-based AI agents
 * Manages agent capabilities, memory, and task execution
 */

import { Step, Context } from '../core/types';
import { AIInterface, AIResponse } from '../ai/ai-interface';
import { Logger, ConsoleLogger } from '../utils/logger';

/**
 * Memory scope types for agent context retention
 */
export enum MemoryScope {
  STEP = 'step', // Memory retained only for current step
  SESSION = 'session', // Memory retained for workflow session
  PERSISTENT = 'persistent', // Memory retained across sessions
}

/**
 * Agent memory configuration
 */
export interface AgentMemoryConfig {
  type: 'transient' | 'persistent';
  scope: MemoryScope;
  retention?: string; // e.g., "24h", "7d"
  maxEntries?: number;
}

/**
 * Agent memory entry
 */
export interface MemoryEntry {
  id: string;
  timestamp: Date;
  step?: string;
  context: Context;
  response?: AIResponse;
  metadata?: Record<string, unknown>;
}

/**
 * Agent memory management
 */
export class AgentMemory {
  private entries: Map<string, MemoryEntry> = new Map();
  private entriesByStep: Map<string, string[]> = new Map();

  constructor(private config: AgentMemoryConfig) {}

  /**
   * Add a memory entry
   */
  addEntry(entry: MemoryEntry): void {
    // Enforce max entries limit if configured
    if (this.config.maxEntries && this.entries.size >= this.config.maxEntries) {
      // Remove oldest entry
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) {
        this.removeEntry(oldestKey);
      }
    }

    this.entries.set(entry.id, entry);

    // Track by step if provided
    if (entry.step) {
      const stepEntries = this.entriesByStep.get(entry.step) || [];
      stepEntries.push(entry.id);
      this.entriesByStep.set(entry.step, stepEntries);
    }

    // Clean up expired entries if retention is configured
    if (this.config.retention) {
      this.cleanExpiredEntries();
    }
  }

  /**
   * Get memory entries by scope
   */
  getEntriesByScope(scope: MemoryScope, stepId?: string): MemoryEntry[] {
    switch (scope) {
      case MemoryScope.STEP: {
        if (!stepId) {
          return [];
        }
        const stepEntryIds = this.entriesByStep.get(stepId) || [];
        return stepEntryIds
          .map((id) => this.entries.get(id))
          .filter((entry): entry is MemoryEntry => entry !== undefined);
      }
      case MemoryScope.SESSION:
      case MemoryScope.PERSISTENT:
        return Array.from(this.entries.values());

      default:
        return [];
    }
  }

  /**
   * Get context for a specific scope
   */
  getContext(scope: MemoryScope, stepId?: string): Context {
    const entries = this.getEntriesByScope(scope, stepId);

    // Merge contexts from all relevant entries
    const mergedContext: Context = {
      inputs: {},
      outputs: {},
      variables: {},
    };

    entries.forEach((entry) => {
      Object.assign(mergedContext.inputs, entry.context.inputs);
      Object.assign(mergedContext.outputs, entry.context.outputs);
      Object.assign(mergedContext.variables, entry.context.variables);
    });

    return mergedContext;
  }

  /**
   * Clear memory by scope
   */
  clearByScope(scope: MemoryScope, stepId?: string): void {
    switch (scope) {
      case MemoryScope.STEP:
        if (stepId) {
          const stepEntryIds = this.entriesByStep.get(stepId) || [];
          stepEntryIds.forEach((id) => this.entries.delete(id));
          this.entriesByStep.delete(stepId);
        }
        break;

      case MemoryScope.SESSION:
      case MemoryScope.PERSISTENT:
        this.entries.clear();
        this.entriesByStep.clear();
        break;
    }
  }

  /**
   * Remove a specific entry
   */
  private removeEntry(id: string): void {
    const entry = this.entries.get(id);
    if (entry) {
      this.entries.delete(id);

      // Remove from step tracking
      if (entry.step) {
        const stepEntries = this.entriesByStep.get(entry.step) || [];
        const filtered = stepEntries.filter((entryId) => entryId !== id);
        if (filtered.length > 0) {
          this.entriesByStep.set(entry.step, filtered);
        } else {
          this.entriesByStep.delete(entry.step);
        }
      }
    }
  }

  /**
   * Clean expired entries based on retention config
   */
  private cleanExpiredEntries(): void {
    if (!this.config.retention) {
      return;
    }

    const retentionMs = this.parseRetention(this.config.retention);
    const now = Date.now();

    const expiredIds: string[] = [];
    this.entries.forEach((entry, id) => {
      if (now - entry.timestamp.getTime() > retentionMs) {
        expiredIds.push(id);
      }
    });

    expiredIds.forEach((id) => this.removeEntry(id));
  }

  /**
   * Parse retention string to milliseconds
   */
  private parseRetention(retention: string): number {
    const match = retention.match(/^(\d+)([hdm])$/);
    if (!match) {
      throw new Error(`Invalid retention format: ${retention}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'm':
        return value * 60 * 1000;
      default:
        throw new Error(`Invalid retention unit: ${unit}`);
    }
  }
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  role: string;
  capabilities: string[];
  systemPrompt: string;
  memory: AgentMemoryConfig;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Role-based AI agent
 */
export class Agent {
  public readonly role: string;
  public readonly capabilities: string[];
  public readonly systemPrompt: string;
  public readonly memory: AgentMemory;
  private readonly config: AgentConfig;
  private logger: Logger;

  constructor(
    config: AgentConfig,
    private aiInterface: AIInterface,
    logger?: Logger
  ) {
    this.role = config.role;
    this.capabilities = config.capabilities;
    this.systemPrompt = config.systemPrompt;
    this.memory = new AgentMemory(config.memory);
    this.config = config;
    this.logger = logger || new ConsoleLogger();
  }

  /**
   * Check if agent can handle a step
   */
  canHandle(step: Step): boolean {
    // Check if step explicitly specifies this agent
    if (step.agent === this.role) {
      return true;
    }

    // Check if step requires capabilities this agent has
    if (step.requiredCapabilities) {
      return step.requiredCapabilities.every((cap) => this.capabilities.includes(cap));
    }

    return false;
  }

  /**
   * Execute a task for a step
   */
  async executeTask(step: Step, context: Context): Promise<AIResponse> {
    if (!this.canHandle(step)) {
      throw new Error(`Agent ${this.role} cannot handle step ${step.id}`);
    }

    // Get relevant memory context
    const memoryContext = this.memory.getContext(this.config.memory.scope, step.id);

    // Merge contexts
    const fullContext: Context = {
      inputs: { ...memoryContext.inputs, ...context.inputs },
      outputs: { ...memoryContext.outputs, ...context.outputs },
      variables: { ...memoryContext.variables, ...context.variables },
    };

    // Build prompt with system prompt and context
    const prompt = this.buildPrompt(step, fullContext);

    // Send to AI interface
    this.logger.info(`Agent ${this.role} executing step ${step.id}`);

    const response = await this.aiInterface.sendPrompt(prompt, this.role, {
      model: step.model || this.config.model,
      temperature: step.temperature || this.config.temperature,
      maxTokens: step.maxTokens || this.config.maxTokens,
    });

    // Store in memory
    const memoryEntry: MemoryEntry = {
      id: `${step.id}-${Date.now()}`,
      timestamp: new Date(),
      step: step.id,
      context: fullContext,
      response,
      metadata: {
        model: response.model,
        usage: response.usage,
      },
    };
    this.memory.addEntry(memoryEntry);

    return response;
  }

  /**
   * Build prompt with system prompt and context
   */
  private buildPrompt(step: Step, context: Context): string {
    const contextInfo = this.formatContext(context);

    let prompt = this.systemPrompt;

    if (contextInfo) {
      prompt += `\n\nContext:\n${contextInfo}`;
    }

    if (step.prompt) {
      prompt += `\n\nTask:\n${step.prompt}`;
    } else if (step.template) {
      prompt += `\n\nTask:\n${step.template}`;
    }

    return prompt;
  }

  /**
   * Format context for prompt
   */
  private formatContext(context: Context): string {
    const parts: string[] = [];

    if (Object.keys(context.inputs).length > 0) {
      parts.push(`Inputs: ${JSON.stringify(context.inputs, null, 2)}`);
    }

    if (Object.keys(context.variables).length > 0) {
      parts.push(`Variables: ${JSON.stringify(context.variables, null, 2)}`);
    }

    if (Object.keys(context.outputs).length > 0) {
      parts.push(`Previous Outputs: ${JSON.stringify(context.outputs, null, 2)}`);
    }

    return parts.join('\n');
  }

  /**
   * Update agent memory with new context
   */
  updateMemory(context: Context, stepId?: string): void {
    const memoryEntry: MemoryEntry = {
      id: `update-${Date.now()}`,
      timestamp: new Date(),
      step: stepId,
      context,
    };
    this.memory.addEntry(memoryEntry);
  }

  /**
   * Get agent context for a specific scope
   */
  getContext(scope: MemoryScope, stepId?: string): Context {
    return this.memory.getContext(scope, stepId);
  }

  /**
   * Clear agent memory by scope
   */
  clearMemory(scope: MemoryScope, stepId?: string): void {
    this.memory.clearByScope(scope, stepId);
  }
}
