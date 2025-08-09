/**
 * Step Executor for handling individual workflow step execution
 * Supports different step types: ai-prompt, script, validation, loop, conditional
 * 
 * NOTE: Some TypeScript strict mode issues are disabled for prototype
 * In production, all `any` types should be properly typed and console.log replaced with proper logging
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable no-console */
/* eslint-disable eqeqeq */
/* eslint-disable curly */

import { spawn } from 'child_process';
import {
  Step,
  Context,
  RetryPolicy,
  RetryErrorPattern,
} from '../core/types';
import { StepExecutionError, ValidationError } from '../core/errors';
import { TemplateEngine } from '../templates/template-engine';

/**
 * Result of step execution
 */
export interface StepResult {
  outputs: Record<string, unknown>;
  shouldContinue: boolean;
  nextStepIndex?: number; // For conditional jumps
}

/**
 * Execution context for a single step
 */
interface StepContext extends Context {
  sessionId: string;
  stepId: string;
  retryCount?: number;
}

/**
 * Step executor handles different types of workflow steps
 */
export class StepExecutor {
  private templateEngine: TemplateEngine;

  constructor(templateEngine?: TemplateEngine) {
    this.templateEngine = templateEngine || new TemplateEngine();
  }

  /**
   * Execute a workflow step with retry logic
   */
  async executeStep(
    step: Step,
    context: Context,
    sessionId: string,
    retryCount = 0
  ): Promise<StepResult> {
    const stepContext: StepContext = {
      ...context,
      sessionId,
      stepId: step.id,
      retryCount,
    };

    try {
      return await this.executeStepByType(step, stepContext);
    } catch (error) {
      // Check if we should retry
      if (this.shouldRetry(step, error, retryCount)) {
        const delay = this.calculateRetryDelay(step.retryPolicy, retryCount);
        await this.sleep(delay);
        
        return this.executeStep(step, context, sessionId, retryCount + 1);
      }

      // Re-throw the error if no more retries
      throw error;
    }
  }

  /**
   * Execute step based on its type
   */
  private async executeStepByType(step: Step, context: StepContext): Promise<StepResult> {
    switch (step.type) {
      case 'ai-prompt':
        return this.executeAIPrompt(step, context);
      
      case 'script':
        return this.executeScript(step, context);
      
      case 'validation':
        return this.executeValidation(step, context);
      
      case 'loop':
        return this.executeLoop(step, context);
      
      case 'conditional':
        return this.executeConditional(step, context);
      
      default:
        throw new StepExecutionError(
          `Unknown step type: ${(step as any).type}`,
          'unknown-workflow',
          step.id
        );
    }
  }

  /**
   * Execute AI prompt step
   */
  private async executeAIPrompt(step: Step, context: StepContext): Promise<StepResult> {
    if (!step.template && !step.agent) {
      throw new StepExecutionError(
        'AI prompt step requires either template or agent configuration',
        'unknown-workflow',
        step.id
      );
    }

    // For now, this is a placeholder - would need AI Interface integration
    // TODO: Integrate with AI Interface when it's implemented
    console.log(`[AI PROMPT] Step ${step.id}: Would execute AI prompt with agent ${step.agent}`);
    
    if (step.template) {
      const prompt = this.templateEngine.render(step.template, context.variables);
      console.log(`[AI PROMPT] Generated prompt:\n${prompt}`);
    }

    // Placeholder return - would normally contain AI response
    return {
      outputs: {
        ai_response: 'Placeholder AI response - AI Interface not yet implemented',
        prompt_used: step.template || 'Agent-specific prompt',
      },
      shouldContinue: true,
    };
  }

  /**
   * Execute script step
   */
  private async executeScript(step: Step, context: StepContext): Promise<StepResult> {
    if (!step.command) {
      throw new StepExecutionError('Script step requires command configuration', 'unknown-workflow', step.id);
    }

    // Render command template with context variables
    const command = this.templateEngine.render(step.command, context.variables);
    
    try {
      const result = await this.runCommand(command, step.expectedExitCode || 0);
      
      return {
        outputs: {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          command: command,
        },
        shouldContinue: true,
      };
    } catch (error) {
      throw new StepExecutionError(
        `Script execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'unknown-workflow',
        step.id
      );
    }
  }

  /**
   * Execute validation step
   */
  private async executeValidation(step: Step, context: StepContext): Promise<StepResult> {
    if (!step.condition) {
      throw new StepExecutionError('Validation step requires condition configuration', 'unknown-workflow', step.id);
    }

    // Render condition template with context variables
    const condition = this.templateEngine.render(step.condition, context.variables);
    
    // Simple validation - check if condition evaluates to truthy
    // TODO: Implement proper expression evaluation
    const isValid = this.evaluateCondition(condition, context.variables);
    
    if (!isValid) {
      throw new ValidationError(`Validation failed: ${condition}`);
    }

    return {
      outputs: {
        validated: true,
        condition: condition,
      },
      shouldContinue: true,
    };
  }

  /**
   * Execute loop step
   */
  private async executeLoop(step: Step, context: StepContext): Promise<StepResult> {
    if (!step.items || !step.steps) {
      throw new StepExecutionError('Loop step requires items and steps configuration', 'unknown-workflow', step.id);
    }

    // Resolve items from context
    const items = this.resolveValue(step.items, context.variables);
    if (!Array.isArray(items)) {
      throw new StepExecutionError(`Loop items must be an array, got ${typeof items}`, 'unknown-workflow', step.id);
    }

    const outputs: Record<string, unknown> = {
      iterations: [],
      total_count: items.length,
    };

    // Execute steps for each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Create iteration context
      const iterationContext = {
        ...context,
        variables: {
          ...context.variables,
          item: item,
          index: i,
          first: i === 0,
          last: i === items.length - 1,
        },
      };

      const iterationOutputs: Record<string, unknown> = {};

      // Execute all steps in the loop
      for (const subStep of step.steps) {
        const stepResult = await this.executeStepByType(subStep, iterationContext);
        Object.assign(iterationOutputs, stepResult.outputs);
        
        if (!stepResult.shouldContinue) {
          break;
        }
      }

      (outputs.iterations as any[]).push({
        index: i,
        item: item,
        outputs: iterationOutputs,
      });
    }

    return {
      outputs,
      shouldContinue: true,
    };
  }

  /**
   * Execute conditional step
   */
  private async executeConditional(step: Step, context: StepContext): Promise<StepResult> {
    if (!step.condition || !step.steps) {
      throw new StepExecutionError('Conditional step requires condition and steps configuration', 'unknown-workflow', step.id);
    }

    // Render and evaluate condition
    const condition = this.templateEngine.render(step.condition, context.variables);
    const shouldExecute = this.evaluateCondition(condition, context.variables);

    const outputs: Record<string, unknown> = {
      condition: condition,
      executed: shouldExecute,
    };

    if (shouldExecute) {
      const stepOutputs: Record<string, unknown> = {};

      // Execute steps in the true branch
      for (const subStep of step.steps) {
        const stepResult = await this.executeStepByType(subStep, context);
        Object.assign(stepOutputs, stepResult.outputs);
        
        if (!stepResult.shouldContinue) {
          break;
        }
      }

      outputs.outputs = stepOutputs;
    }

    return {
      outputs,
      shouldContinue: true,
    };
  }

  /**
   * Run shell command
   */
  private runCommand(command: string, expectedExitCode = 0): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const process = spawn(cmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        const exitCode = code ?? -1;
        
        if (exitCode === expectedExitCode) {
          resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode });
        } else {
          reject(new Error(`Command failed with exit code ${exitCode}. stderr: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to execute command: ${error.message}`));
      });
    });
  }

  /**
   * Evaluate a condition string (simple implementation)
   */
  private evaluateCondition(condition: string, variables: Record<string, unknown>): boolean {
    // TODO: Implement proper expression evaluation
    // For now, just check if the condition string evaluates to a truthy value
    try {
      // Simple variable substitution
      let expr = condition;
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        expr = expr.replace(regex, JSON.stringify(value));
      }
      
      // WARNING: Using eval is dangerous - this is just for prototype
      // In production, use a proper expression evaluator
      return Boolean(eval(expr));
    } catch (error) {
      throw new ValidationError(`Invalid condition: ${condition}`);
    }
  }

  /**
   * Resolve a value from context variables
   */
  private resolveValue(path: string, variables: Record<string, unknown>): unknown {
    const keys = path.split('.');
    let current = variables;
    
    for (const key of keys) {
      if (current == null || typeof current !== 'object') {
        return undefined;
      }
      current = (current as any)[key];
    }
    
    return current;
  }

  /**
   * Check if step should be retried based on error and policy
   */
  private shouldRetry(step: Step, error: unknown, retryCount: number): boolean {
    if (!step.retryPolicy) {
      return false;
    }

    if (retryCount >= step.retryPolicy.maxAttempts) {
      return false;
    }

    // Check if error matches retry patterns
    if (step.retryPolicy.retryOn) {
      const errorType = this.classifyError(error);
      return step.retryPolicy.retryOn.includes(errorType);
    }

    return true; // Retry by default if policy exists but no specific patterns
  }

  /**
   * Classify error to determine retry eligibility
   */
  private classifyError(error: unknown): RetryErrorPattern {
    if (!error) return 'temporary_failure';

    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network') || message.includes('connection')) return 'network_error';
    if (message.includes('rate limit')) return 'rate_limit';
    if (message.includes('server error') || message.includes('500')) return 'server_error';
    if (message.includes('auth')) return 'authentication_error';
    if (message.includes('validation')) return 'validation_error';
    if (message.includes('unavailable') || message.includes('busy')) return 'resource_unavailable';

    return 'temporary_failure';
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryPolicy?: RetryPolicy, retryCount = 0): number {
    if (!retryPolicy) return 1000;

    const baseDelay = retryPolicy.backoffMs || 1000;
    return baseDelay * Math.pow(2, retryCount);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}