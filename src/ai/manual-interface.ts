/**
 * Manual AI Interface implementation
 * Provides interactive copy-paste workflow for AI communication
 */
/* eslint-disable no-console */

import * as readline from 'readline';
import {
  AIInterface,
  AIResponse,
  AIConfig,
  Usage,
  AIValidationError,
  AITimeoutError,
} from './ai-interface';

/**
 * Colors for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

/**
 * Manual interface for copy-paste AI workflow
 */
export class ManualInterface implements AIInterface {
  private cumulativeUsage: Usage | null = null;
  private rl: readline.Interface;

  constructor(private timeout: number = 300000) {
    // 5 minute default timeout
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Get the display name
   */
  getName(): string {
    return 'Manual Copy-Paste Interface';
  }

  /**
   * Send prompt via interactive copy-paste workflow
   */
  async sendPrompt(prompt: string, agent: string, config?: AIConfig): Promise<AIResponse> {

    // Display the formatted prompt for copying
    this.displayPromptForCopy(prompt, agent, config);

    // Collect the AI response from user
    const response = await this.collectUserResponse();

    // Validate the response
    if (!this.validateResponse(response, prompt)) {
      throw new AIValidationError(`Response validation failed for agent ${agent}`);
    }

    // Create AI response object
    const aiResponse: AIResponse = {
      content: response,
      agent,
      timestamp: new Date(),
      model: config?.model || 'manual-input',
    };

    // Display success message
    this.displaySuccess(response.length);

    return aiResponse;
  }

  /**
   * Check if streaming is supported (not for manual interface)
   */
  supportsStreaming(): boolean {
    return false;
  }

  /**
   * Get cumulative usage statistics
   */
  getUsage(): Usage | null {
    return this.cumulativeUsage;
  }

  /**
   * Reset usage statistics
   */
  resetUsage(): void {
    this.cumulativeUsage = null;
  }

  /**
   * Validate response content
   */
  validateResponse(response: string, _prompt: string): boolean {
    // Basic validation rules
    if (!response || response.trim().length === 0) {
      return false;
    }

    // Response should be reasonable length (at least 10 characters)
    if (response.trim().length < 10) {
      return false;
    }

    // Check for placeholder text that indicates incomplete response
    const placeholders = [
      '[insert',
      '[placeholder',
      '[your response',
      '...',
      'lorem ipsum',
      'todo:',
      'fixme:',
    ];

    const lowerResponse = response.toLowerCase();
    for (const placeholder of placeholders) {
      if (lowerResponse.includes(placeholder)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Display formatted prompt for user to copy
   */
  private displayPromptForCopy(prompt: string, agent: string, config?: AIConfig): void {
    const border = '━'.repeat(60);

    console.log(`\n${colors.cyan}${colors.bright}🤖 AI Agent: ${agent}${colors.reset}`);
    
    if (config?.model) {
      console.log(`${colors.dim}Model: ${config.model}${colors.reset}`);
    }
    
    if (config?.temperature !== undefined) {
      console.log(`${colors.dim}Temperature: ${config.temperature}${colors.reset}`);
    }

    console.log(`\n${colors.yellow}${colors.bright}📋 Copy this prompt to your AI tool:${colors.reset}`);
    console.log(`${colors.yellow}${border}${colors.reset}`);
    console.log(prompt);
    console.log(`${colors.yellow}${border}${colors.reset}`);
  }

  /**
   * Collect AI response from user input
   */
  private async collectUserResponse(): Promise<string> {
    return new Promise((resolve, reject) => {
      const lines: string[] = [];
      let emptyLineCount = 0;
      const timeoutId = setTimeout(() => {
        this.rl.close();
        reject(new AITimeoutError('Response input timed out'));
      }, this.timeout);

      console.log(`\n${colors.green}${colors.bright}📝 Paste AI response and press Enter twice when done:${colors.reset}`);
      console.log(`${colors.dim}(Press Ctrl+C to cancel)${colors.reset}\n`);

      this.rl.on('line', (line) => {
        if (line.trim() === '') {
          emptyLineCount++;
          if (emptyLineCount >= 2 && lines.length > 0) {
            // User pressed Enter twice, finish input
            clearTimeout(timeoutId);
            this.rl.removeAllListeners('line');
            resolve(lines.join('\n').trim());
            return;
          }
        } else {
          emptyLineCount = 0;
          lines.push(line);
        }
      });

      this.rl.on('SIGINT', () => {
        clearTimeout(timeoutId);
        console.log(`\n${colors.red}Input cancelled by user${colors.reset}`);
        reject(new AIValidationError('User cancelled input'));
      });
    });
  }

  /**
   * Display success message
   */
  private displaySuccess(responseLength: number): void {
    console.log(
      `\n${colors.green}${colors.bright}✅ Response received successfully!${colors.reset}`
    );
    console.log(`${colors.dim}Response length: ${responseLength} characters${colors.reset}\n`);
  }

  /**
   * Close the readline interface
   */
  close(): void {
    if (this.rl) {
      this.rl.close();
    }
  }
}