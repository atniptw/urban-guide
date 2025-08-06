# AI Workflow Orchestrator - Design Specifications

## 1. Executive Summary

The AI Workflow Orchestrator (aiflow) is a CLI tool that manages AI agents to enforce software development processes. It addresses the challenge of AI tools losing focus on complex tasks by breaking work into structured, repeatable workflows with clear handoff points.

### Key Goals
- Maintain AI focus through small, well-defined tasks
- Enforce development methodologies (TDD, code review processes)
- Create reusable workflows for common development patterns
- Enable gradual migration from manual copy-paste to API integration

## 2. Problem Statement

### Current Challenges
1. **Context Drift**: AI tools "forget" instructions as context grows
2. **Process Inconsistency**: AI skips important steps (tests, documentation)
3. **Manual Overhead**: Constant supervision required to keep AI on track
4. **Task Scoping**: Difficulty in breaking down features into AI-manageable chunks

### Solution Approach
Create an orchestration layer that:
- Defines strict workflows with validation checkpoints
- Routes tasks to appropriate handlers (scripts vs AI)
- Maintains process state between steps
- Provides clear interfaces for human intervention

## 3. System Architecture

### 3.1 Core Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   CLI Interface │────▶│ Workflow Engine │────▶│  Agent Manager  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ State Manager   │     │ Template Engine │     │   AI Interface  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 3.2 Component Responsibilities

**CLI Interface**
- Parse commands and options
- Display prompts and collect responses
- Show workflow progress
- Handle user interruptions

**Workflow Engine**
- Load and validate workflow definitions
- Execute steps in sequence
- Handle conditionals and loops
- Manage retry logic

**Agent Manager**
- Instantiate role-based agents
- Route tasks to appropriate agent
- Maintain agent context
- Handle inter-agent communication

**State Manager**
- Persist workflow state
- Track completed steps
- Store intermediate outputs
- Enable resume functionality

**Template Engine**
- Generate prompts from templates
- Inject context variables
- Format outputs for consistency

**AI Interface**
- Abstract AI communication (manual vs API)
- Handle response parsing
- Manage rate limits (future)
- Track token usage (future)

## 4. Data Models

### 4.1 Workflow Definition

```typescript
interface Workflow {
  id: string;
  name: string;
  description: string;
  version: string;
  inputs: InputDefinition[];
  steps: Step[];
  outputs: OutputDefinition[];
}

interface Step {
  id: string;
  type: 'ai-prompt' | 'script' | 'validation' | 'loop' | 'conditional';
  agent?: string;
  template?: string;
  command?: string;
  condition?: string;
  retryPolicy?: RetryPolicy;
  outputs?: OutputMapping[];
}

interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  retryOn: string[]; // error patterns
}
```

### 4.2 Agent Definition

```typescript
interface Agent {
  role: string;
  capabilities: string[];
  systemPrompt: string;
  workflows: string[]; // workflow IDs this agent can execute
  memory: MemoryConfig;
}

interface MemoryConfig {
  type: 'ephemeral' | 'persistent';
  scope: 'task' | 'session' | 'global';
  retention: string; // duration
}
```

### 4.3 State Model

```typescript
interface WorkflowState {
  sessionId: string;
  workflowId: string;
  startedAt: Date;
  currentStep: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  context: Map<string, any>;
  stepHistory: StepExecution[];
}

interface StepExecution {
  stepId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'success' | 'failed' | 'skipped';
  inputs: any;
  outputs: any;
  error?: string;
}
```

## 5. Workflow Specifications

### 5.1 Tech Lead Workflow Example

```yaml
id: tech-lead-feature-analysis
name: Tech Lead Feature Analysis
version: 1.0.0

inputs:
  - name: feature_url
    type: string
    description: GitHub issue URL
    required: true

steps:
  - id: fetch-issue
    type: script
    command: gh issue view ${feature_url} --json title,body,comments
    outputs:
      - name: issue_data
        type: json

  - id: analyze-requirements
    type: ai-prompt
    agent: tech-lead
    template: |
      Review this feature request for completeness:
      
      Title: ${issue_data.title}
      Description: ${issue_data.body}
      
      Check for:
      1. Clear acceptance criteria
      2. INVEST principles compliance
      3. Technical constraints
      4. Missing requirements
      
      Provide structured analysis.
    outputs:
      - name: analysis
        type: structured

  - id: identify-gaps
    type: conditional
    condition: analysis.has_gaps
    steps:
      - id: request-clarification
        type: ai-prompt
        template: |
          Draft clarifying questions for these gaps:
          ${analysis.gaps}

  - id: update-documentation
    type: ai-prompt
    agent: tech-lead
    template: |
      Update architecture documentation based on:
      ${analysis.summary}
      
      Include:
      - Design decisions
      - Component interactions
      - API changes
    outputs:
      - name: doc_updates
        type: markdown

  - id: create-tasks
    type: ai-prompt
    agent: tech-lead
    template: |
      Break down into development tasks:
      ${analysis.summary}
      
      Each task must have:
      - Clear scope
      - Acceptance criteria
      - Test requirements
    outputs:
      - name: tasks
        type: array

  - id: write-tasks-to-github
    type: loop
    items: tasks
    steps:
      - id: create-issue
        type: script
        command: |
          gh issue create \
            --title "${item.title}" \
            --body "${item.description}"
```

### 5.2 Developer Workflow (Future)

```yaml
id: developer-tdd-cycle
name: Developer TDD Implementation
version: 1.0.0

steps:
  - id: understand-task
    type: ai-prompt
    agent: developer
    template: Review task and identify implementation approach

  - id: write-test
    type: ai-prompt
    agent: developer
    template: Write failing test for requirement

  - id: run-test
    type: script
    command: npm test ${test_file}
    expectedExitCode: 1

  - id: implement
    type: ai-prompt
    agent: developer
    template: Implement minimum code to pass test

  - id: verify-test-passes
    type: script
    command: npm test ${test_file}
    expectedExitCode: 0

  - id: refactor
    type: ai-prompt
    agent: developer
    template: Refactor implementation for clarity
```

## 6. User Interface Design

### 6.1 CLI Commands

```bash
# Start new workflow
aiflow run <workflow-id> [options]
aiflow run tech-lead --feature-url https://github.com/user/repo/issues/123

# Continue paused workflow
aiflow continue [--session-id <id>]

# Show current status
aiflow status

# List available workflows
aiflow list workflows

# Show workflow details
aiflow show <workflow-id>

# Export session outputs
aiflow export [--format json|markdown]
```

### 6.2 Interactive Flow

```
$ aiflow run tech-lead --feature-url github.com/user/repo/issues/123

🚀 Starting Tech Lead Feature Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Step 1/6] Fetching GitHub Issue
✓ Issue data retrieved

[Step 2/6] Analyzing Requirements
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Copy this prompt to your AI tool:

Review this feature request for completeness:

Title: Add user authentication
Description: We need users to be able to log in...

Check for:
1. Clear acceptance criteria
2. INVEST principles compliance
3. Technical constraints
4. Missing requirements

Provide structured analysis.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Paste AI response and press Enter twice:
> [User pastes response]

✓ Requirements analyzed
⚠️  3 gaps identified

[Step 3/6] Requesting Clarifications
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 7. Integration Points

### 7.1 GitHub Integration
- Read issues and PRs via GitHub CLI (`gh`)
- Create issues for tasks
- Update issue comments
- Future: GitHub Actions integration

### 7.2 AI Provider Integration
- MVP: Manual copy-paste interface
- Phase 2: Direct API integration
  - OpenAI API
  - Anthropic Claude API
  - Local LLM support

### 7.3 Development Tool Integration
- Test runners (npm, pytest, etc.)
- Linters and formatters
- Build systems
- Git operations

## 8. Configuration

### 8.1 Global Configuration
```yaml
# ~/.aiflow/config.yaml
defaultWorkflowDir: ~/.aiflow/workflows
stateDir: ~/.aiflow/state
templateDir: ~/.aiflow/templates

agents:
  tech-lead:
    systemPrompt: You are a senior technical lead...
    
  developer:
    systemPrompt: You are a software developer...

integrations:
  github:
    cli: gh
    
  ai:
    mode: manual # or 'api'
    provider: openai
    apiKey: ${OPENAI_API_KEY}
```

### 8.2 Project Configuration
```yaml
# .aiflow/project.yaml
workflows:
  - ./workflows/tech-lead.yaml
  - ./workflows/developer.yaml

templates:
  - ./templates/

hooks:
  pre-step: ./scripts/pre-step.sh
  post-step: ./scripts/post-step.sh
```

## 9. Security Considerations

### 9.1 Secrets Management
- Never store API keys in workflow definitions
- Use environment variables or secure credential stores
- Mask sensitive data in logs

### 9.2 Command Execution
- Validate and sanitize all command inputs
- Run scripts in sandboxed environment
- Limit file system access

### 9.3 AI Content
- Filter AI responses for sensitive data
- Validate generated code before execution
- Log all AI interactions for audit

## 10. Future Enhancements

- Direct API integration for AI services
- Support for multiple AI providers (OpenAI, Anthropic, etc.)
- Additional role-based agents (QA, Reviewer, etc.)
- Enhanced GitHub integration capabilities

## 11. Success Metrics

### 11.1 MVP Success Criteria
- Successfully break down 5 features using Tech Lead workflow
- Reduce context drift incidents by 80%
- Maintain TDD compliance across 10 development tasks
- Complete workflows without manual intervention 70% of time

### 11.2 Long-term Goals
- 90% reduction in AI supervision time
- Support 10+ different role-based agents
- Community-contributed workflow library
- Integration with major development platforms

## 12. Technical Decisions

### 12.1 Technology Stack
- **Language**: TypeScript
- **Runtime**: Node.js
- **CLI Framework**: Commander.js
- **Configuration**: YAML (js-yaml)
- **State Storage**: JSON files (MVP), SQLite (future)
- **Testing**: Jest
- **Build Tool**: esbuild

### 12.2 Architecture Principles
- Plugin-based architecture for extensibility
- Stateless step execution for reliability
- Immutable state transitions
- Clear separation of concerns
- Fail-safe defaults

## 13. Development Roadmap

### 13.1 MVP (4-6 weeks)
- Week 1-2: Core framework (CLI, workflow engine)
- Week 3-4: Tech Lead agent implementation
- Week 5: GitHub integration
- Week 6: Testing and documentation

### 13.2 Post-MVP
- Month 2: API integration
- Month 3: Developer agent
- Month 4: Web UI
- Month 5+: Community features

---

This design document represents the current understanding of the AI Workflow Orchestrator system. It will evolve as implementation progresses and new requirements are discovered.