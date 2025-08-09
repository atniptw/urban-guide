/**
 * Core Workflow Engine for executing workflow steps
 * Handles step execution, retry logic, and state management
 * 
 * NOTE: Some TypeScript strict mode issues are disabled for prototype
 * In production, all `any` types should be properly typed
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { EventEmitter } from 'events';
import {
  Workflow,
  WorkflowState,
  StepExecution,
  WorkflowStatus,
} from '../core/types';
import { WorkflowError, StepExecutionError } from '../core/errors';
import { StateManager } from '../state/state-manager';
import { StepExecutor } from './step-executor';

/**
 * Workflow execution events
 */
export interface WorkflowEvents {
  started: { sessionId: string; workflowId: string };
  stepStarted: { sessionId: string; stepId: string };
  stepCompleted: { sessionId: string; stepId: string; outputs: Record<string, unknown> };
  stepFailed: { sessionId: string; stepId: string; error: string };
  paused: { sessionId: string; stepId: string };
  resumed: { sessionId: string; stepId: string };
  completed: { sessionId: string; outputs: Record<string, unknown> };
  failed: { sessionId: string; error: string };
}

/**
 * Main workflow execution engine
 */
export class WorkflowEngine extends EventEmitter {
  private stateManager: StateManager;
  private stepExecutor: StepExecutor;

  constructor(stateManager?: StateManager, stepExecutor?: StepExecutor) {
    super();
    this.stateManager = stateManager || new StateManager();
    this.stepExecutor = stepExecutor || new StepExecutor();
  }

  /**
   * Execute a workflow from the beginning
   */
  async execute(workflow: Workflow, inputs: Record<string, unknown>): Promise<WorkflowState> {
    // Initialize state manager
    await this.stateManager.initialize();

    // Create new session
    const sessionId = await this.stateManager.createSession(workflow.id, inputs);

    this.emit('started', { sessionId, workflowId: workflow.id });

    try {
      // Load initial state
      const initialState = await this.stateManager.loadSession(sessionId);
      if (!initialState) {
        throw new WorkflowError(`Failed to load initial session state for ${sessionId}`);
      }

      // Execute workflow steps
      const finalState = await this.executeSteps(workflow, initialState);

      // Mark as completed
      await this.stateManager.updateSessionStatus(sessionId, 'completed');

      this.emit('completed', { sessionId, outputs: finalState.outputs });

      return this.mapToWorkflowState(finalState);
    } catch (error) {
      // Mark as failed
      await this.stateManager.updateSessionStatus(sessionId, 'failed');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('failed', { sessionId, error: errorMessage });

      throw new WorkflowError(`Workflow execution failed: ${errorMessage}`, workflow.id);
    }
  }

  /**
   * Resume a paused workflow
   */
  async resume(sessionId: string): Promise<WorkflowState> {
    await this.stateManager.initialize();

    // Load session state
    let sessionState;
    try {
      sessionState = await this.stateManager.loadSession(sessionId);
    } catch (error) {
      throw new WorkflowError(`Session ${sessionId} not found`);
    }

    if (sessionState.status !== 'paused') {
      throw new WorkflowError(`Cannot resume session ${sessionId} with status ${sessionState.status}`);
    }

    this.emit('resumed', { sessionId, stepId: `step-${sessionState.currentStepIndex}` });

    try {
      // Load the workflow definition (would need WorkflowLoader integration)
      // For now, throw error indicating this needs to be implemented
      throw new WorkflowError('Resume functionality requires workflow definition loading - not yet implemented');

      // TODO: Implement resume logic
      // const workflow = await this.loadWorkflow(sessionState.workflowId);
      // const finalState = await this.executeStepsFrom(workflow, sessionState, sessionState.currentStepIndex);
      // return this.mapToWorkflowState(finalState);
    } catch (error) {
      await this.stateManager.updateSessionStatus(sessionId, 'failed');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('failed', { sessionId, error: errorMessage });

      throw new WorkflowError(`Resume failed: ${errorMessage}`, sessionState.workflowId);
    }
  }

  /**
   * Pause a running workflow
   */
  async pause(sessionId: string): Promise<void> {
    let sessionState;
    try {
      sessionState = await this.stateManager.loadSession(sessionId);
    } catch (error) {
      throw new WorkflowError(`Session ${sessionId} not found`);
    }

    if (sessionState.status !== 'running') {
      throw new WorkflowError(`Cannot pause session ${sessionId} with status ${sessionState.status}`);
    }

    await this.stateManager.updateSessionStatus(sessionId, 'paused');
    
    this.emit('paused', { sessionId, stepId: `step-${sessionState.currentStepIndex}` });
  }

  /**
   * Execute workflow steps sequentially
   */
  private async executeSteps(workflow: Workflow, sessionState: any): Promise<any> {
    const currentState = sessionState;

    for (let i = currentState.currentStepIndex; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      
      this.emit('stepStarted', { sessionId: currentState.sessionId, stepId: step.id });

      try {
        // Execute the step
        const stepResult = await this.stepExecutor.executeStep(
          step,
          currentState.context,
          currentState.sessionId
        );

        // Create step execution record
        const execution: StepExecution = {
          stepId: step.id,
          startedAt: new Date(),
          completedAt: new Date(),
          status: 'success',
          inputs: currentState.context.variables,
          outputs: stepResult.outputs,
        };

        // Update state with step results
        if (stepResult.outputs) {
          Object.assign(currentState.context.variables, stepResult.outputs);
        }

        // Save step execution
        await this.stateManager.addStepExecution(currentState.sessionId, execution);

        // Update current step index
        currentState.currentStepIndex = i + 1;

        this.emit('stepCompleted', {
          sessionId: currentState.sessionId,
          stepId: step.id,
          outputs: stepResult.outputs,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Create failed step execution record
        const execution: StepExecution = {
          stepId: step.id,
          startedAt: new Date(),
          completedAt: new Date(),
          status: 'failed',
          inputs: currentState.context.variables,
          outputs: {},
          error: errorMessage,
        };

        await this.stateManager.addStepExecution(currentState.sessionId, execution);

        this.emit('stepFailed', {
          sessionId: currentState.sessionId,
          stepId: step.id,
          error: errorMessage,
        });

        throw new StepExecutionError(`Step ${step.id} failed: ${errorMessage}`, 'unknown-workflow', step.id);
      }
    }

    return currentState;
  }

  /**
   * Map session state to workflow state interface
   */
  private mapToWorkflowState(sessionState: any): WorkflowState {
    return {
      sessionId: sessionState.sessionId,
      workflowId: sessionState.workflowId,
      startedAt: sessionState.createdAt,
      updatedAt: sessionState.updatedAt,
      currentStepIndex: sessionState.currentStepIndex,
      status: sessionState.status,
      context: sessionState.context,
      stepHistory: sessionState.stepExecutions,
      outputs: sessionState.outputs,
    };
  }

  /**
   * Get workflow execution status
   */
  async getStatus(sessionId: string): Promise<WorkflowState | null> {
    try {
      const sessionState = await this.stateManager.loadSession(sessionId);
      return this.mapToWorkflowState(sessionState);
    } catch (error) {
      return null;
    }
  }

  /**
   * List all sessions with optional status filter
   */
  async listSessions(status?: WorkflowStatus): Promise<WorkflowState[]> {
    const sessions = await this.stateManager.listSessions(status);
    const states: WorkflowState[] = [];

    for (const sessionInfo of sessions) {
      const sessionState = await this.stateManager.loadSession(sessionInfo.sessionId);
      if (sessionState) {
        states.push(this.mapToWorkflowState(sessionState));
      }
    }

    return states;
  }

  /**
   * Clean up old sessions
   */
  async cleanup(maxAge?: number, statuses?: WorkflowStatus[]): Promise<number> {
    const result = await this.stateManager.cleanupSessions({
      maxAge,
      statuses,
    });
    
    return result.deleted.length;
  }
}