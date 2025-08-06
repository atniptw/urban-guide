# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**urban-guide** (aiflow) is an AI Workflow Orchestrator CLI tool designed to manage AI agents in software development workflows. The project enforces development methodologies like TDD and creates structured, repeatable workflows with clear handoff points between AI and human tasks.

**Current Status**: Initial TypeScript project setup complete. Core implementation pending.

## Development Commands

```bash
# Initial setup
npm install

# Build TypeScript to JavaScript
npm run build

# Run tests
npm test

# Run a single test file
npm test -- path/to/test.spec.ts

# Development mode with watch
npm run dev

# Lint code
npm run lint

# Type checking
npm run typecheck
```

## Architecture Overview

The system consists of six core components that work together to orchestrate AI-driven development workflows:

1. **CLI Interface** (`src/cli/`) - Command parsing and user interaction using Commander.js
2. **Core Types** (`src/core/`) - TypeScript interfaces and types for workflows, agents, and state
3. **Workflow Engine** (`src/engine/`) - Executes workflow steps, handles conditionals/loops, manages retry logic
4. **Agent Manager** (`src/agents/`) - Manages role-based AI agents (Tech Lead, Developer, QA)
5. **State Manager** (`src/state/`) - Persists workflow state to enable resume functionality
6. **Template Engine** (`src/templates/`) - Generates prompts from YAML templates with context injection
7. **AI Interface** (`src/ai/`) - Abstraction layer for AI communication (manual copy-paste initially, API integration later)

## Core Types

The `src/core/` module contains all TypeScript definitions:

### Key Interfaces
- `Workflow` - Main workflow definition with steps, inputs, and outputs
- `Step` - Individual workflow step (ai-prompt, script, validation, loop, conditional)
- `Agent` - Role-based AI agent configuration with capabilities and memory
- `WorkflowState` - Complete execution state for resumable workflows
- `Context` - Execution context with inputs, variables, and outputs

### Error Classes
- `WorkflowError` - Workflow execution failures
- `ValidationError` - Input/configuration validation failures
- `IntegrationError` - External service integration failures
- `StepExecutionError` - Individual step execution failures

### Constants
- Configuration directory paths
- Default values and limits
- Agent roles and workflow statuses
- Exit codes for CLI operations

Import core types: `import { Workflow, WorkflowError, DEFAULT_CONFIG } from './src/core'`

## Technology Stack

- **Language**: TypeScript
- **Runtime**: Node.js  
- **CLI Framework**: Commander.js
- **Configuration**: YAML (js-yaml)
- **State Storage**: JSON files (MVP), SQLite (future)
- **Testing**: Jest
- **Build Tool**: esbuild

## Workflow System

Workflows are defined in YAML files and consist of steps that can be:
- `ai-prompt`: Tasks sent to AI agents
- `script`: Automated script execution
- `validation`: Checkpoint validations
- `loop`: Iterative operations
- `conditional`: Branching logic

Example workflow structure:
```yaml
id: tech-lead-breakdown
name: Tech Lead Feature Breakdown
steps:
  - id: analyze
    type: ai-prompt
    agent: tech-lead
    template: analyze-feature
```

## Key Design Principles

- **Plugin-based architecture** for extensibility
- **Stateless step execution** for reliability
- **Immutable state transitions**
- **Clear separation of concerns** between components
- **Fail-safe defaults** throughout the system

## GitHub Integration

The system integrates with GitHub for:
- Creating and updating issues
- Managing pull requests
- Running GitHub Actions workflows
- Tracking task progress

## Development Focus Areas

When implementing features, prioritize:
1. Breaking complex tasks into small, well-defined steps
2. Maintaining clear context boundaries for AI agents
3. Enforcing validation checkpoints between workflow steps
4. Enabling state persistence for workflow resumption
5. Creating reusable workflow templates