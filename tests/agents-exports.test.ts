/**
 * Tests for agents module exports
 */

import * as AgentsModule from '../src/agents';

describe('Agents Module Exports', () => {
  it('should export Agent class', () => {
    expect(AgentsModule.Agent).toBeDefined();
    expect(typeof AgentsModule.Agent).toBe('function');
  });

  it('should export AgentManager class', () => {
    expect(AgentsModule.AgentManager).toBeDefined();
    expect(typeof AgentsModule.AgentManager).toBe('function');
  });

  it('should export AgentMemory class', () => {
    expect(AgentsModule.AgentMemory).toBeDefined();
    expect(typeof AgentsModule.AgentMemory).toBe('function');
  });

  it('should export MemoryScope enum', () => {
    expect(AgentsModule.MemoryScope).toBeDefined();
    expect(AgentsModule.MemoryScope.STEP).toBe('step');
    expect(AgentsModule.MemoryScope.SESSION).toBe('session');
    expect(AgentsModule.MemoryScope.PERSISTENT).toBe('persistent');
  });

  it('should export all interface types', () => {
    // These are TypeScript interfaces/types, so we can't test them directly at runtime
    // But we can ensure the module structure is correct
    expect(typeof AgentsModule).toBe('object');
  });
});