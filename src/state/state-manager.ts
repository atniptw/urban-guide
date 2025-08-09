/**
 * State Manager for workflow session persistence
 * Handles saving/loading workflow state to enable pause/resume functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowStatus, StepExecution, Context } from '../core/types';
import { StateError } from '../core/errors';
import { logger } from '../utils/logger';

/**
 * Extended workflow state for session persistence
 */
export interface WorkflowSessionState {
  sessionId: string;
  workflowId: string;
  status: WorkflowStatus;
  inputs: Record<string, unknown>;
  context: Context;
  outputs: Record<string, unknown>;
  stepExecutions: StepExecution[];
  currentStepIndex: number;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Session metadata for listing and management
 */
export interface SessionInfo {
  sessionId: string;
  workflowId: string;
  status: WorkflowStatus;
  createdAt: Date;
  updatedAt: Date;
  currentStepIndex: number;
  totalSteps: number;
}

/**
 * Options for session cleanup
 */
export interface CleanupOptions {
  maxAge?: number; // Max age in milliseconds
  statuses?: WorkflowStatus[]; // Statuses to clean up
  dryRun?: boolean; // Preview what would be deleted
}

/**
 * State Manager implementation
 */
export class StateManager {
  private readonly stateDir: string;
  private readonly statusDirs: Record<WorkflowStatus, string>;

  constructor(baseDir?: string) {
    this.stateDir = baseDir || path.join(process.cwd(), '.aiflow', 'state');

    // Create status-specific directories
    this.statusDirs = {
      running: path.join(this.stateDir, 'running'),
      paused: path.join(this.stateDir, 'paused'),
      completed: path.join(this.stateDir, 'completed'),
      failed: path.join(this.stateDir, 'failed'),
    };
  }

  /**
   * Initialize state directories
   */
  async initialize(): Promise<void> {
    try {
      // Ensure base state directory exists
      await fs.mkdir(this.stateDir, { recursive: true });

      // Create status directories
      for (const dir of Object.values(this.statusDirs)) {
        await fs.mkdir(dir, { recursive: true });
      }
    } catch (error) {
      throw new StateError(
        `Failed to initialize state directories: ${this.getErrorMessage(error)}`,
        undefined,
        'write'
      );
    }
  }

  /**
   * Create a new workflow session
   */
  async createSession(workflowId: string, inputs: Record<string, unknown>): Promise<string> {
    const sessionId = uuidv4();
    const now = new Date();

    const context: Context = {
      inputs,
      variables: {},
      outputs: {},
    };

    const workflowState: WorkflowSessionState = {
      sessionId,
      workflowId,
      status: 'running',
      inputs,
      context,
      outputs: {},
      stepExecutions: [],
      currentStepIndex: 0,
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    await this.saveSession(workflowState);
    return sessionId;
  }

  /**
   * Save session state to disk atomically
   */
  async saveSession(state: WorkflowSessionState): Promise<void> {
    await this.initialize(); // Ensure directories exist

    const sessionFile = this.getSessionFilePath(state.sessionId, state.status);
    const tempFile = `${sessionFile}.tmp`;

    try {
      // Update the updatedAt timestamp
      const stateToSave = {
        ...state,
        updatedAt: new Date(),
      };

      // Write to temporary file first (atomic operation)
      await fs.writeFile(tempFile, JSON.stringify(stateToSave, null, 2), 'utf-8');

      // Move to final location
      await fs.rename(tempFile, sessionFile);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }

      throw new StateError(
        `Failed to save session ${state.sessionId}: ${this.getErrorMessage(error)}`,
        state.sessionId,
        'write'
      );
    }
  }

  /**
   * Load session from disk
   */
  async loadSession(
    sessionId: string,
    expectedStatus?: WorkflowStatus
  ): Promise<WorkflowSessionState> {
    let sessionFile: string;

    if (expectedStatus) {
      // Look in specific status directory
      sessionFile = this.getSessionFilePath(sessionId, expectedStatus);
    } else {
      // Search all directories
      sessionFile = await this.findSessionFile(sessionId);
    }

    try {
      const content = await fs.readFile(sessionFile, 'utf-8');
      const state = JSON.parse(content) as Record<string, unknown>;

      // Convert date strings back to Date objects
      return this.deserializeState(state);
    } catch (error) {
      if (this.isFileNotFoundError(error)) {
        throw new StateError(`Session ${sessionId} not found`, sessionId, 'read');
      }

      throw new StateError(
        `Failed to load session ${sessionId}: ${this.getErrorMessage(error)}`,
        sessionId,
        'read'
      );
    }
  }

  /**
   * Update session status and move file to appropriate directory
   */
  async updateSessionStatus(sessionId: string, newStatus: WorkflowStatus): Promise<void> {
    // First, find and load the current session
    const currentState = await this.loadSession(sessionId);
    const currentFile = this.getSessionFilePath(sessionId, currentState.status);

    // Update the state
    const updatedState: WorkflowSessionState = {
      ...currentState,
      status: newStatus,
      updatedAt: new Date(),
    };

    // Save to new location
    await this.saveSession(updatedState);

    // Remove from old location if different
    if (currentState.status !== newStatus) {
      try {
        await fs.unlink(currentFile);
      } catch (error) {
        // If we can't delete the old file, log but don't fail
        logger.warn(
          `Could not remove old session file ${currentFile}: ${this.getErrorMessage(error)}`
        );
      }
    }
  }

  /**
   * Update session context
   */
  async updateContext(sessionId: string, contextUpdates: Record<string, unknown>): Promise<void> {
    const state = await this.loadSession(sessionId);

    // Merge context updates
    const updatedState: WorkflowSessionState = {
      ...state,
      context: { ...state.context, ...contextUpdates },
      updatedAt: new Date(),
    };

    await this.saveSession(updatedState);
  }

  /**
   * Add step execution record
   */
  async addStepExecution(sessionId: string, execution: StepExecution): Promise<void> {
    const state = await this.loadSession(sessionId);

    const updatedState: WorkflowSessionState = {
      ...state,
      stepExecutions: [...state.stepExecutions, execution],
      currentStepIndex: state.currentStepIndex + 1,
      updatedAt: new Date(),
    };

    await this.saveSession(updatedState);
  }

  /**
   * List sessions with optional filtering
   */
  async listSessions(status?: WorkflowStatus): Promise<SessionInfo[]> {
    await this.initialize();

    const sessions: SessionInfo[] = [];
    const statusesToCheck = status ? [status] : (Object.keys(this.statusDirs) as WorkflowStatus[]);

    for (const statusKey of statusesToCheck) {
      const statusDir = this.statusDirs[statusKey];

      try {
        const files = await fs.readdir(statusDir);

        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const sessionFile = path.join(statusDir, file);
              const content = await fs.readFile(sessionFile, 'utf-8');
              const state = JSON.parse(content) as Record<string, unknown>;

              sessions.push({
                sessionId: state.sessionId as string,
                workflowId: state.workflowId as string,
                status: state.status as WorkflowStatus,
                createdAt: new Date(state.createdAt as string),
                updatedAt: new Date(state.updatedAt as string),
                currentStepIndex: (state.currentStepIndex as number) || 0,
                totalSteps: (state.stepExecutions as unknown[])?.length || 0,
              });
            } catch (error) {
              // Skip files that can't be parsed
              logger.warn(`Could not parse session file ${file}: ${this.getErrorMessage(error)}`);
            }
          }
        }
      } catch (error) {
        if (!this.isFileNotFoundError(error)) {
          throw new StateError(
            `Failed to list sessions in ${statusDir}: ${this.getErrorMessage(error)}`
          );
        }
        // Directory doesn't exist, skip
      }
    }

    // Sort by updatedAt descending (most recent first)
    return sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessionFile = await this.findSessionFile(sessionId);
      await fs.unlink(sessionFile);
    } catch (error) {
      if (this.isFileNotFoundError(error)) {
        throw new StateError(`Session ${sessionId} not found`, sessionId, 'read');
      }
      throw new StateError(
        `Failed to delete session ${sessionId}: ${this.getErrorMessage(error)}`,
        sessionId,
        'write'
      );
    }
  }

  /**
   * Clean up old sessions
   */
  async cleanupSessions(options: CleanupOptions = {}): Promise<{
    deleted: string[];
    errors: Array<{ sessionId: string; error: string }>;
  }> {
    const {
      maxAge = 30 * 24 * 60 * 60 * 1000, // 30 days default
      statuses = ['completed', 'failed'], // Only clean completed/failed by default
      dryRun = false,
    } = options;

    const cutoffTime = Date.now() - maxAge;
    const deleted: string[] = [];
    const errors: Array<{ sessionId: string; error: string }> = [];

    for (const status of statuses) {
      try {
        const sessions = await this.listSessions(status);

        for (const session of sessions) {
          if (session.updatedAt.getTime() < cutoffTime) {
            if (!dryRun) {
              try {
                await this.deleteSession(session.sessionId);
                deleted.push(session.sessionId);
              } catch (error) {
                errors.push({
                  sessionId: session.sessionId,
                  error: this.getErrorMessage(error),
                });
              }
            } else {
              deleted.push(session.sessionId); // For preview
            }
          }
        }
      } catch (error) {
        errors.push({
          sessionId: `status:${status}`,
          error: this.getErrorMessage(error),
        });
      }
    }

    return { deleted, errors };
  }

  /**
   * Get the file path for a session
   */
  private getSessionFilePath(sessionId: string, status: WorkflowStatus): string {
    return path.join(this.statusDirs[status], `${sessionId}.json`);
  }

  /**
   * Find session file across all status directories
   */
  private async findSessionFile(sessionId: string): Promise<string> {
    for (const status of Object.keys(this.statusDirs) as WorkflowStatus[]) {
      const filePath = this.getSessionFilePath(sessionId, status);
      try {
        await fs.access(filePath);
        return filePath;
      } catch {
        // File doesn't exist in this directory, try next
      }
    }

    throw new StateError(`Session ${sessionId} not found in any directory`, sessionId, 'read');
  }

  /**
   * Convert date strings back to Date objects after JSON parsing
   */
  private deserializeState(state: Record<string, unknown>): WorkflowSessionState {
    return {
      ...state,
      createdAt: new Date(state.createdAt as string),
      updatedAt: new Date(state.updatedAt as string),
      stepExecutions:
        (state.stepExecutions as Record<string, unknown>[])?.map(
          (execution: Record<string, unknown>) => ({
            ...execution,
            startedAt: new Date(execution.startedAt as string),
            completedAt: execution.completedAt
              ? new Date(execution.completedAt as string)
              : undefined,
          })
        ) || [],
    } as WorkflowSessionState;
  }

  /**
   * Check if error is a file not found error
   */
  private isFileNotFoundError(error: unknown): boolean {
    return (
      error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
    );
  }

  /**
   * Safely extract error message
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (error !== null && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }
    return String(error);
  }
}
