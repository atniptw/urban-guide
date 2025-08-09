#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { EXIT_CODES } from '../core/constants';

// Define types for command options
interface RunOptions {
  featureUrl?: string;
  input?: string;
  config?: string;
  verbose?: boolean;
}

interface ContinueOptions {
  sessionId?: string;
  verbose?: boolean;
}

interface StatusOptions {
  sessionId?: string;
  format?: string;
}

interface ListOptions {
  format?: string;
}

interface ShowOptions {
  format?: string;
}

interface ExportOptions {
  sessionId?: string;
  format?: string;
  output?: string;
}

const program = new Command();

// Custom validation error class
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Shared validation functions
function validateNonEmptyString(value: string | undefined, fieldName: string): void {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required and must be a non-empty string`);
  }
}

function validateFormat(format: string | undefined, allowedFormats: string[]): void {
  if (format && !allowedFormats.includes(format)) {
    throw new ValidationError(`Format must be one of: ${allowedFormats.join(', ')}`);
  }
}

function handleCommandError(operation: string, error: unknown): void {
  if (error instanceof ValidationError) {
    console.error(chalk.red(`❌ Error: ${error.message}`));
    process.exit(EXIT_CODES.validationError);
  } else {
    console.error(
      chalk.red(`❌ Failed to ${operation}:`),
      error instanceof Error ? error.message : 'Unknown error'
    );
    process.exit(EXIT_CODES.generalError);
  }
}

// Supported format constants
const TABLE_JSON_FORMATS = ['table', 'json'];
const YAML_JSON_FORMATS = ['yaml', 'json'];
const EXPORT_FORMATS = ['json', 'markdown'];

program
  .name('aiflow')
  .description('AI Workflow Orchestrator - Manage AI agents for development tasks')
  .version('0.1.0');

// Run command - Start new workflow
program
  .command('run <workflow-id>')
  .description('Start a new workflow execution')
  .option('--feature-url <url>', 'GitHub issue URL for feature analysis')
  .option('--input <json>', 'JSON string with workflow inputs')
  .option('--config <path>', 'Path to custom configuration file')
  .option('--verbose', 'Enable verbose output')
  .action((workflowId: string, options: RunOptions) => {
    try {
      console.log(chalk.blue(`🚀 Starting workflow: ${workflowId}`));

      // Validate workflow ID
      validateNonEmptyString(workflowId, 'Workflow ID');

      // Parse JSON input if provided
      let inputs: Record<string, unknown> = {};
      if (options.input) {
        try {
          inputs = JSON.parse(options.input) as Record<string, unknown>;
        } catch (error) {
          throw new ValidationError('Invalid JSON format in --input option');
        }
      }

      // Add feature URL to inputs if provided
      if (options.featureUrl) {
        inputs = { ...inputs, feature_url: options.featureUrl };
      }

      if (options.verbose) {
        console.log(chalk.gray('Workflow ID:'), workflowId);
        console.log(chalk.gray('Inputs:'), JSON.stringify(inputs, null, 2));
        console.log(chalk.gray('Config:'), options.config || 'default');
      }

      // TODO: Integrate with workflow engine when available
      console.log(chalk.yellow('⚠️  Workflow engine not yet implemented'));
      console.log(chalk.gray('This command will execute the workflow when the engine is ready'));
    } catch (error) {
      handleCommandError('start workflow', error);
    }
  });

// Continue command - Resume paused workflow
program
  .command('continue')
  .description('Continue a paused workflow execution')
  .option('--session-id <id>', 'Specific session ID to resume')
  .option('--verbose', 'Enable verbose output')
  .action((options: ContinueOptions) => {
    try {
      console.log(chalk.blue('🔄 Resuming workflow execution'));

      if (options.sessionId) {
        // Validate session ID format
        validateNonEmptyString(options.sessionId, 'Session ID');

        if (options.verbose) {
          console.log(chalk.gray('Session ID:'), options.sessionId);
        }
        console.log(chalk.blue(`Resuming session: ${options.sessionId}`));
      } else {
        console.log(chalk.blue('Resuming most recent paused workflow'));
      }

      // TODO: Integrate with state manager and workflow engine when available
      console.log(chalk.yellow('⚠️  State manager not yet implemented'));
      console.log(chalk.gray('This command will resume workflows when the state manager is ready'));
    } catch (error) {
      handleCommandError('continue workflow', error);
    }
  });

// Status command - Show current workflow status
program
  .command('status')
  .description('Show status of current and recent workflows')
  .option('--session-id <id>', 'Show status for specific session')
  .option('--format <format>', 'Output format (table|json)', 'table')
  .action((options: StatusOptions) => {
    try {
      console.log(chalk.blue('📊 Workflow Status'));

      // Validate format option
      validateFormat(options.format, TABLE_JSON_FORMATS);

      if (options.sessionId) {
        // Validate session ID
        validateNonEmptyString(options.sessionId, 'Session ID');
        console.log(chalk.blue(`Status for session: ${options.sessionId}`));
      } else {
        console.log(chalk.blue('Status for all active sessions'));
      }

      // TODO: Integrate with state manager when available
      console.log(chalk.yellow('⚠️  No active workflows found'));
      console.log(chalk.gray('Workflow status will be displayed when sessions exist'));
    } catch (error) {
      handleCommandError('get status', error);
    }
  });

// List command - List available workflows
program
  .command('list')
  .argument('<type>', 'Type to list (workflows)')
  .description('List available workflows')
  .option('--format <format>', 'Output format (table|json)', 'table')
  .action((type: string, options: ListOptions) => {
    try {
      // Validate type argument
      if (type !== 'workflows') {
        console.log(chalk.gray('Usage: aiflow list workflows'));
        throw new ValidationError('Only "workflows" type is currently supported');
      }

      // Validate format option
      validateFormat(options.format, TABLE_JSON_FORMATS);

      console.log(chalk.blue('📋 Available Workflows'));

      // TODO: Integrate with workflow loader when available
      console.log(chalk.yellow('⚠️  No workflows found'));
      console.log(chalk.gray('Workflows will be listed when workflow files are available'));
    } catch (error) {
      handleCommandError('list workflows', error);
    }
  });

// Show command - Show workflow details
program
  .command('show <workflow-id>')
  .description('Show details of a specific workflow')
  .option('--format <format>', 'Output format (yaml|json)', 'yaml')
  .action((workflowId: string, options: ShowOptions) => {
    try {
      // Validate workflow ID
      validateNonEmptyString(workflowId, 'Workflow ID');

      // Validate format option
      validateFormat(options.format, YAML_JSON_FORMATS);

      console.log(chalk.blue(`📄 Workflow Details: ${workflowId}`));
      console.log(chalk.gray(`Format: ${options.format}`));

      // TODO: Integrate with workflow loader when available
      console.log(chalk.yellow('⚠️  Workflow loader not yet implemented'));
      console.log(chalk.gray('Workflow details will be displayed when the loader is ready'));
    } catch (error) {
      handleCommandError('show workflow', error);
    }
  });

// Export command - Export session outputs
program
  .command('export')
  .description('Export session outputs and results')
  .option('--session-id <id>', 'Export specific session (defaults to most recent)')
  .option('--format <format>', 'Export format (json|markdown)', 'json')
  .option('--output <path>', 'Output file path (defaults to stdout)')
  .action((options: ExportOptions) => {
    try {
      // Validate format option
      validateFormat(options.format, EXPORT_FORMATS);

      // Validate session ID if provided
      if (options.sessionId) {
        validateNonEmptyString(options.sessionId, 'Session ID');
      }

      console.log(chalk.blue('📤 Exporting session data'));

      const sessionInfo = options.sessionId || 'most recent session';
      const format = options.format || 'json';
      console.log(chalk.gray(`Session: ${sessionInfo}`));
      console.log(chalk.gray(`Format: ${format}`));
      console.log(chalk.gray(`Output: ${options.output || 'stdout'}`));

      // TODO: Integrate with state manager when available
      console.log(chalk.yellow('⚠️  State manager not yet implemented'));
      console.log(
        chalk.gray('Export functionality will be available when the state manager is ready')
      );
    } catch (error) {
      handleCommandError('export data', error);
    }
  });

// Parse command line arguments
program.parse();

// Show version info when no arguments provided
if (!process.argv.slice(2).length) {
  console.log(chalk.blue('aiflow v0.1.0'));
  console.log(chalk.gray('AI Workflow Orchestrator - Manage AI agents for development tasks'));
  console.log(chalk.gray(''));
  console.log(chalk.gray('Usage: aiflow <command> [options]'));
  console.log(chalk.gray(''));
  console.log(chalk.gray('Commands:'));
  console.log(chalk.gray('  run <workflow-id>     Start a new workflow'));
  console.log(chalk.gray('  continue              Resume a paused workflow'));
  console.log(chalk.gray('  status                Show workflow status'));
  console.log(chalk.gray('  list workflows        List available workflows'));
  console.log(chalk.gray('  show <workflow-id>    Show workflow details'));
  console.log(chalk.gray('  export                Export session outputs'));
  console.log(chalk.gray(''));
  console.log(chalk.gray('Use "aiflow <command> --help" for command-specific options'));
}
