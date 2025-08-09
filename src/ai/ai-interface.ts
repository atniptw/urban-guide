/**
 * AI Interface abstraction layer
 * Provides a clean interface for AI communication with support for different implementations
 */

/**
 * Usage statistics for AI operations
 */
export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number; // Optional cost in USD
}

/**
 * AI response with metadata
 */
export interface AIResponse {
  content: string;
  usage?: Usage;
  model?: string;
  timestamp: Date;
  agent: string;
}

/**
 * Configuration for AI interface
 */
export interface AIConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  [key: string]: unknown;
}

/**
 * Error types for AI operations
 */
export class AIError extends Error {
  constructor(
    message: string,
    public code: string = 'AI_ERROR',
    public cause?: Error
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export class AITimeoutError extends AIError {
  constructor(message: string = 'AI request timed out', cause?: Error) {
    super(message, 'AI_TIMEOUT', cause);
    this.name = 'AITimeoutError';
  }
}

export class AIValidationError extends AIError {
  constructor(message: string = 'AI response validation failed', cause?: Error) {
    super(message, 'AI_VALIDATION', cause);
    this.name = 'AIValidationError';
  }
}

/**
 * Main AI interface abstraction
 */
export interface AIInterface {
  /**
   * Send a prompt to the AI and get a response
   */
  sendPrompt(prompt: string, agent: string, config?: AIConfig): Promise<AIResponse>;

  /**
   * Check if the implementation supports streaming responses
   */
  supportsStreaming(): boolean;

  /**
   * Get cumulative usage statistics
   */
  getUsage(): Usage | null;

  /**
   * Reset usage statistics
   */
  resetUsage(): void;

  /**
   * Validate a response before returning it
   */
  validateResponse(response: string, prompt: string): boolean;

  /**
   * Get the display name of this AI interface implementation
   */
  getName(): string;
}