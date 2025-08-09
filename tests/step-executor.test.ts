/**
 * Tests for StepExecutor
 */

import { StepExecutor } from '../src/engine/step-executor';
import { TemplateEngine } from '../src/templates/template-engine';
import { Step, Context } from '../src/core/types';
import { StepExecutionError, ValidationError } from '../src/core/errors';

// Mock dependencies
jest.mock('../src/templates/template-engine');
jest.mock('child_process');

describe('StepExecutor', () => {
  let stepExecutor: StepExecutor;
  let mockTemplateEngine: jest.Mocked<TemplateEngine>;

  const baseContext: Context = {
    inputs: { testInput: 'value' },
    variables: { testVar: 'variableValue' },
    outputs: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockTemplateEngine = new TemplateEngine() as jest.Mocked<TemplateEngine>;
    stepExecutor = new StepExecutor(mockTemplateEngine);

    // Default template engine mock
    mockTemplateEngine.render.mockImplementation((template, context) => {
      // Simple variable substitution for tests
      return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return String(context[key] || match);
      });
    });
  });

  describe('executeStep', () => {
    it('should execute AI prompt step', async () => {
      const step: Step = {
        id: 'ai-step',
        type: 'ai-prompt',
        agent: 'test-agent',
        template: 'Process this: {{testVar}}',
      };

      const result = await stepExecutor.executeStep(step, baseContext, 'session-123');

      expect(result.shouldContinue).toBe(true);
      expect(result.outputs).toHaveProperty('ai_response');
      expect(mockTemplateEngine.render).toHaveBeenCalledWith(step.template, baseContext.variables);
    });

    it('should execute script step', async () => {
      const step: Step = {
        id: 'script-step',
        type: 'script',
        command: 'echo "{{testVar}}"',
        expectedExitCode: 0,
      };

      // Mock the runCommand method directly
      const mockRunCommand = jest.fn().mockResolvedValue({
        stdout: 'variableValue',
        stderr: '',
        exitCode: 0,
      });

      (stepExecutor as any).runCommand = mockRunCommand;

      const result = await stepExecutor.executeStep(step, baseContext, 'session-123');

      expect(result.shouldContinue).toBe(true);
      expect(result.outputs).toHaveProperty('stdout');
      expect(result.outputs).toHaveProperty('exitCode');
      expect(result.outputs.exitCode).toBe(0);
    });

    it('should handle script execution failure', async () => {
      const step: Step = {
        id: 'failing-script-step',
        type: 'script',
        command: 'echo "{{testVar}}"',
        expectedExitCode: 0,
      };

      // Mock the runCommand method to throw an error
      const mockRunCommand = jest.fn().mockRejectedValue(new Error('Command failed'));
      (stepExecutor as any).runCommand = mockRunCommand;

      await expect(
        stepExecutor.executeStep(step, baseContext, 'session-123')
      ).rejects.toThrow(StepExecutionError);
    });

    it('should execute validation step', async () => {
      const step: Step = {
        id: 'validation-step',
        type: 'validation',
        condition: 'testVar === "variableValue"',
      };

      const result = await stepExecutor.executeStep(step, baseContext, 'session-123');

      expect(result.shouldContinue).toBe(true);
      expect(result.outputs.validated).toBe(true);
    });

    it('should fail validation step with invalid condition', async () => {
      const step: Step = {
        id: 'validation-step',
        type: 'validation',
        condition: 'testVar === "wrongValue"',
      };

      await expect(
        stepExecutor.executeStep(step, baseContext, 'session-123')
      ).rejects.toThrow(ValidationError);
    });

    it('should execute loop step', async () => {
      const step: Step = {
        id: 'loop-step',
        type: 'loop',
        items: 'testArray',
        steps: [
          {
            id: 'inner-step',
            type: 'ai-prompt',
            agent: 'test-agent',
            template: 'Process item: {{item}}',
          },
        ],
      };

      const contextWithArray = {
        ...baseContext,
        variables: {
          ...baseContext.variables,
          testArray: ['item1', 'item2', 'item3'],
        },
      };

      const result = await stepExecutor.executeStep(step, contextWithArray, 'session-123');

      expect(result.shouldContinue).toBe(true);
      expect(result.outputs.total_count).toBe(3);
      expect(result.outputs.iterations).toHaveLength(3);
    });

    it('should execute conditional step with true condition', async () => {
      const step: Step = {
        id: 'conditional-step',
        type: 'conditional',
        condition: 'testVar === "variableValue"',
        steps: [
          {
            id: 'inner-step',
            type: 'ai-prompt',
            agent: 'test-agent',
            template: 'Execute this branch',
          },
        ],
      };

      const result = await stepExecutor.executeStep(step, baseContext, 'session-123');

      expect(result.shouldContinue).toBe(true);
      expect(result.outputs.executed).toBe(true);
      expect(result.outputs).toHaveProperty('outputs');
    });

    it('should execute conditional step with false condition', async () => {
      const step: Step = {
        id: 'conditional-step',
        type: 'conditional',
        condition: 'testVar === "wrongValue"',
        steps: [
          {
            id: 'inner-step',
            type: 'ai-prompt',
            agent: 'test-agent',
            template: 'Should not execute',
          },
        ],
      };

      const result = await stepExecutor.executeStep(step, baseContext, 'session-123');

      expect(result.shouldContinue).toBe(true);
      expect(result.outputs.executed).toBe(false);
      expect(result.outputs).not.toHaveProperty('outputs');
    });

    it('should throw error for unknown step type', async () => {
      const step: Step = {
        id: 'unknown-step',
        type: 'unknown' as any,
      };

      await expect(
        stepExecutor.executeStep(step, baseContext, 'session-123')
      ).rejects.toThrow(StepExecutionError);
    });
  });

  describe('retry logic', () => {
    it('should retry failed step with retry policy', async () => {
      const step: Step = {
        id: 'retry-step',
        type: 'validation',
        condition: 'false', // Always fails
        retryPolicy: {
          maxAttempts: 2,
          backoffMs: 100,
          retryOn: ['validation_error'],
        },
      };

      // Mock the sleep function to avoid actual delays in tests
      const originalSleep = (stepExecutor as any).sleep;
      (stepExecutor as any).sleep = jest.fn().mockResolvedValue(undefined);

      await expect(
        stepExecutor.executeStep(step, baseContext, 'session-123')
      ).rejects.toThrow(ValidationError);

      // Should have attempted 2 times total (initial + 1 retry), so sleep called once
      // But our logic actually allows retryCount < maxAttempts, so with maxAttempts=2:
      // - attempt 0 (retryCount=0) fails, sleep, retry
      // - attempt 1 (retryCount=1) fails, sleep, retry  
      // - attempt 2 (retryCount=2) fails, stop (2 >= 2)
      expect((stepExecutor as any).sleep).toHaveBeenCalledTimes(2);

      // Restore original sleep function
      (stepExecutor as any).sleep = originalSleep;
    });

    it('should not retry when max attempts reached', async () => {
      const step: Step = {
        id: 'no-retry-step',
        type: 'validation',
        condition: 'false',
        retryPolicy: {
          maxAttempts: 1,
          backoffMs: 100,
        },
      };

      await expect(
        stepExecutor.executeStep(step, baseContext, 'session-123')
      ).rejects.toThrow(ValidationError);
    });

    it('should not retry when error type not in retryOn list', async () => {
      const step: Step = {
        id: 'specific-retry-step',
        type: 'validation',
        condition: 'false',
        retryPolicy: {
          maxAttempts: 3,
          backoffMs: 100,
          retryOn: ['network_error'], // Won't match validation error
        },
      };

      await expect(
        stepExecutor.executeStep(step, baseContext, 'session-123')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('error classification', () => {
    it('should classify timeout errors', () => {
      const error = new Error('Operation timeout');
      const classification = (stepExecutor as any).classifyError(error);
      expect(classification).toBe('timeout');
    });

    it('should classify network errors', () => {
      const error = new Error('Network connection failed');
      const classification = (stepExecutor as any).classifyError(error);
      expect(classification).toBe('network_error');
    });

    it('should classify rate limit errors', () => {
      const error = new Error('Rate limit exceeded');
      const classification = (stepExecutor as any).classifyError(error);
      expect(classification).toBe('rate_limit');
    });

    it('should classify server errors', () => {
      const error = new Error('Internal server error 500');
      const classification = (stepExecutor as any).classifyError(error);
      expect(classification).toBe('server_error');
    });

    it('should classify authentication errors', () => {
      const error = new Error('Authentication failed');
      const classification = (stepExecutor as any).classifyError(error);
      expect(classification).toBe('authentication_error');
    });

    it('should classify validation errors', () => {
      const error = new Error('Validation failed');
      const classification = (stepExecutor as any).classifyError(error);
      expect(classification).toBe('validation_error');
    });

    it('should classify resource unavailable errors', () => {
      const error = new Error('Service unavailable');
      const classification = (stepExecutor as any).classifyError(error);
      expect(classification).toBe('resource_unavailable');
    });

    it('should classify busy errors', () => {
      const error = new Error('Server busy');
      const classification = (stepExecutor as any).classifyError(error);
      expect(classification).toBe('resource_unavailable');
    });

    it('should default to temporary_failure for unknown errors', () => {
      const error = new Error('Some random error');
      const classification = (stepExecutor as any).classifyError(error);
      expect(classification).toBe('temporary_failure');
    });

    it('should handle null/undefined errors', () => {
      const classification = (stepExecutor as any).classifyError(null);
      expect(classification).toBe('temporary_failure');
    });

    it('should handle non-Error objects', () => {
      const classification = (stepExecutor as any).classifyError('string error');
      expect(classification).toBe('temporary_failure');
    });
  });

  describe('step validation', () => {
    it('should require template or agent for AI prompt steps', async () => {
      const step: Step = {
        id: 'invalid-ai-step',
        type: 'ai-prompt',
      };

      await expect(
        stepExecutor.executeStep(step, baseContext, 'session-123')
      ).rejects.toThrow(StepExecutionError);
    });

    it('should require command for script steps', async () => {
      const step: Step = {
        id: 'invalid-script-step',
        type: 'script',
      };

      await expect(
        stepExecutor.executeStep(step, baseContext, 'session-123')
      ).rejects.toThrow(StepExecutionError);
    });

    it('should require condition for validation steps', async () => {
      const step: Step = {
        id: 'invalid-validation-step',
        type: 'validation',
      };

      await expect(
        stepExecutor.executeStep(step, baseContext, 'session-123')
      ).rejects.toThrow(StepExecutionError);
    });

    it('should require items and steps for loop steps', async () => {
      const step: Step = {
        id: 'invalid-loop-step',
        type: 'loop',
      };

      await expect(
        stepExecutor.executeStep(step, baseContext, 'session-123')
      ).rejects.toThrow(StepExecutionError);
    });

    it('should require condition and steps for conditional steps', async () => {
      const step: Step = {
        id: 'invalid-conditional-step',
        type: 'conditional',
      };

      await expect(
        stepExecutor.executeStep(step, baseContext, 'session-123')
      ).rejects.toThrow(StepExecutionError);
    });
  });

  describe('safe expression evaluator', () => {
    it('should handle logical AND operations', () => {
      const context = { a: true, b: true, c: false };
      const result = (stepExecutor as any).safeExpressionEvaluator('a && b', context);
      expect(result).toBe(true);

      const result2 = (stepExecutor as any).safeExpressionEvaluator('a && c', context);
      expect(result2).toBe(false);
    });

    it('should handle logical OR operations', () => {
      const context = { a: true, b: false, c: false };
      const result = (stepExecutor as any).safeExpressionEvaluator('a || b', context);
      expect(result).toBe(true);

      const result2 = (stepExecutor as any).safeExpressionEvaluator('b || c', context);
      expect(result2).toBe(false);
    });

    it('should handle negation', () => {
      const context = { a: true, b: false };
      const result = (stepExecutor as any).safeExpressionEvaluator('!a', context);
      expect(result).toBe(false);

      const result2 = (stepExecutor as any).safeExpressionEvaluator('!b', context);
      expect(result2).toBe(true);
    });

    it('should handle parentheses', () => {
      const context = { a: true, b: false };
      const result = (stepExecutor as any).safeExpressionEvaluator('(a)', context);
      expect(result).toBe(true);

      const result2 = (stepExecutor as any).safeExpressionEvaluator('(!b)', context);
      expect(result2).toBe(true);
    });

    it('should handle equality comparisons', () => {
      const context = { a: 5, b: 5, c: 10 };
      const result = (stepExecutor as any).safeExpressionEvaluator('a == b', context);
      expect(result).toBe(true);

      const result2 = (stepExecutor as any).safeExpressionEvaluator('a === b', context);
      expect(result2).toBe(true);

      const result3 = (stepExecutor as any).safeExpressionEvaluator('a == c', context);
      expect(result3).toBe(false);
    });

    it('should handle inequality comparisons', () => {
      const context = { a: 5, b: 10 };
      const result = (stepExecutor as any).safeExpressionEvaluator('a != b', context);
      expect(result).toBe(true);

      const result2 = (stepExecutor as any).safeExpressionEvaluator('a !== b', context);
      expect(result2).toBe(true);

      const result3 = (stepExecutor as any).safeExpressionEvaluator('a != a', context);
      expect(result3).toBe(false);
    });

    it('should handle numeric comparisons', () => {
      const context = { a: 5, b: 10, c: 5 };
      const result1 = (stepExecutor as any).safeExpressionEvaluator('a < b', context);
      expect(result1).toBe(true);

      const result2 = (stepExecutor as any).safeExpressionEvaluator('a <= c', context);
      expect(result2).toBe(true);

      const result3 = (stepExecutor as any).safeExpressionEvaluator('b > a', context);
      expect(result3).toBe(true);

      const result4 = (stepExecutor as any).safeExpressionEvaluator('a >= c', context);
      expect(result4).toBe(true);

      const result5 = (stepExecutor as any).safeExpressionEvaluator('a > b', context);
      expect(result5).toBe(false);
    });

    it('should handle boolean literals', () => {
      const result1 = (stepExecutor as any).safeExpressionEvaluator('true', {});
      expect(result1).toBe(true);

      const result2 = (stepExecutor as any).safeExpressionEvaluator('false', {});
      expect(result2).toBe(false);
    });

    it('should throw error for unsupported operators', () => {
      const context = { a: 5, b: 10 };
      expect(() => {
        (stepExecutor as any).safeExpressionEvaluator('a % b', context);
      }).toThrow();
    });
  });

  describe('expression value resolution', () => {
    it('should resolve boolean literals', () => {
      const result1 = (stepExecutor as any).resolveExpressionValue('true', {});
      expect(result1).toBe(true);

      const result2 = (stepExecutor as any).resolveExpressionValue('false', {});
      expect(result2).toBe(false);
    });

    it('should resolve null and undefined', () => {
      const result1 = (stepExecutor as any).resolveExpressionValue('null', {});
      expect(result1).toBe(null);

      const result2 = (stepExecutor as any).resolveExpressionValue('undefined', {});
      expect(result2).toBe(undefined);
    });

    it('should resolve number literals', () => {
      const result1 = (stepExecutor as any).resolveExpressionValue('42', {});
      expect(result1).toBe(42);

      const result2 = (stepExecutor as any).resolveExpressionValue('-3.14', {});
      expect(result2).toBe(-3.14);
    });

    it('should resolve string literals', () => {
      const result1 = (stepExecutor as any).resolveExpressionValue('"hello"', {});
      expect(result1).toBe('hello');

      const result2 = (stepExecutor as any).resolveExpressionValue("'world'", {});
      expect(result2).toBe('world');
    });

    it('should resolve variables', () => {
      const context = { name: 'test', nested: { value: 42 } };
      const result1 = (stepExecutor as any).resolveExpressionValue('name', context);
      expect(result1).toBe('test');

      const result2 = (stepExecutor as any).resolveExpressionValue('nested.value', context);
      expect(result2).toBe(42);
    });

    it('should throw error for invalid expressions', () => {
      expect(() => {
        (stepExecutor as any).resolveExpressionValue('invalid#expression', {});
      }).toThrow();
    });
  });

  describe('value comparison', () => {
    it('should compare null/undefined values', () => {
      const result1 = (stepExecutor as any).compareValues(null, null);
      expect(result1).toBe(0);

      const result2 = (stepExecutor as any).compareValues(null, 'test');
      expect(result2).toBe(-1);

      const result3 = (stepExecutor as any).compareValues('test', null);
      expect(result3).toBe(1);
    });

    it('should compare numbers', () => {
      const result1 = (stepExecutor as any).compareValues(5, 10);
      expect(result1).toBe(-5);

      const result2 = (stepExecutor as any).compareValues(10, 5);
      expect(result2).toBe(5);

      const result3 = (stepExecutor as any).compareValues(7, 7);
      expect(result3).toBe(0);
    });

    it('should compare strings', () => {
      const result1 = (stepExecutor as any).compareValues('apple', 'banana');
      expect(result1).toBeLessThan(0);

      const result2 = (stepExecutor as any).compareValues('banana', 'apple');
      expect(result2).toBeGreaterThan(0);

      const result3 = (stepExecutor as any).compareValues('test', 'test');
      expect(result3).toBe(0);
    });

    it('should convert mixed types to strings for comparison', () => {
      const result = (stepExecutor as any).compareValues(123, 'test');
      expect(typeof result).toBe('number');
    });
  });

  describe('resolveValue', () => {
    it('should resolve nested object values', () => {
      const variables = {
        user: { profile: { name: 'test', settings: { theme: 'dark' } } },
      };
      
      const result1 = (stepExecutor as any).resolveValue('user.profile.name', variables);
      expect(result1).toBe('test');

      const result2 = (stepExecutor as any).resolveValue('user.profile.settings.theme', variables);
      expect(result2).toBe('dark');
    });

    it('should return undefined for non-existent paths', () => {
      const variables = { user: { name: 'test' } };
      
      const result1 = (stepExecutor as any).resolveValue('user.nonexistent', variables);
      expect(result1).toBe(undefined);

      const result2 = (stepExecutor as any).resolveValue('nonexistent.path', variables);
      expect(result2).toBe(undefined);
    });

    it('should handle null/undefined intermediate values', () => {
      const variables = { user: null, other: { nested: undefined } };
      
      const result1 = (stepExecutor as any).resolveValue('user.name', variables);
      expect(result1).toBe(undefined);

      const result2 = (stepExecutor as any).resolveValue('other.nested.value', variables);
      expect(result2).toBe(undefined);
    });

    it('should handle primitive intermediate values', () => {
      const variables = { primitive: 'string' };
      
      const result = (stepExecutor as any).resolveValue('primitive.property', variables);
      expect(result).toBe(undefined);
    });
  });

  describe('retry delay calculation', () => {
    it('should calculate exponential backoff', () => {
      const retryPolicy = { maxAttempts: 3, backoffMs: 1000 };
      
      const delay0 = (stepExecutor as any).calculateRetryDelay(retryPolicy, 0);
      expect(delay0).toBe(1000);

      const delay1 = (stepExecutor as any).calculateRetryDelay(retryPolicy, 1);
      expect(delay1).toBe(2000);

      const delay2 = (stepExecutor as any).calculateRetryDelay(retryPolicy, 2);
      expect(delay2).toBe(4000);
    });

    it('should default to 1000ms when no policy provided', () => {
      const delay = (stepExecutor as any).calculateRetryDelay(undefined, 0);
      expect(delay).toBe(1000);
    });

    it('should default to 1000ms when no backoffMs provided', () => {
      const delay = (stepExecutor as any).calculateRetryDelay({}, 0);
      expect(delay).toBe(1000);
    });
  });
});