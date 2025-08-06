# aiflow - AI Workflow Orchestrator

A CLI tool that manages AI agents to enforce software development processes. It addresses the challenge of AI tools losing focus on complex tasks by breaking work into structured, repeatable workflows with clear handoff points.

## Features

- **Workflow-driven development**: Break complex tasks into manageable, validated steps
- **Role-based AI agents**: Tech Lead, Developer, QA agents with specific capabilities
- **GitHub integration**: Issue management, task creation, PR workflows
- **State persistence**: Resume interrupted workflows
- **Manual → API transition**: Start with copy-paste, migrate to direct API integration

## Installation

```bash
npm install -g aiflow
```

## Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/aiflow.git
cd aiflow

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run in development mode
npm run dev
```

## Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Watch mode for development
- `npm test` - Run test suite
- `npm run lint` - Check code quality
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Run TypeScript type checking

## Project Structure

```
aiflow/
├── src/
│   ├── cli/          # CLI interface and commands
│   ├── core/         # Core workflow engine
│   ├── agents/       # AI agent implementations
│   ├── integrations/ # External service integrations
│   └── utils/        # Utility functions
├── tests/            # Test files
├── workflows/        # Workflow definitions
└── docs/             # Documentation
```

## Requirements

- Node.js >= 18.0.0
- TypeScript 5.0+

## License

MIT
