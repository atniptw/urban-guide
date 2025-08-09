/**
 * Tests for AI module exports
 */

import * as AIExports from '../src/ai';

describe('AI exports', () => {
  it('should export AIInterface types', () => {
    expect(AIExports.AIError).toBeDefined();
    expect(AIExports.AITimeoutError).toBeDefined();
    expect(AIExports.AIValidationError).toBeDefined();
  });

  it('should export ManualInterface class', () => {
    expect(AIExports.ManualInterface).toBeDefined();
    expect(typeof AIExports.ManualInterface).toBe('function');
  });

  it('should create ManualInterface instance', () => {
    const manualInterface = new AIExports.ManualInterface();
    expect(manualInterface.getName()).toBe('Manual Copy-Paste Interface');
    expect(manualInterface.supportsStreaming()).toBe(false);
    manualInterface.close();
  });
});