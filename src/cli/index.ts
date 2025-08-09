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
      if (!workflowId || typeof workflowId !== 'string' || workflowId.trim().length === 0) {
        console.error(chalk.red('❌ Error: Workflow ID is required and must be a non-empty string'));
        process.exit(EXIT_CODES.validationError);
      }

      // Parse JSON input if provided
      let inputs = {};
      if (options.input) {
        try {
          inputs = JSON.parse(options.input);
        } catch (error) {
          console.error(chalk.red('❌ Error: Invalid JSON format in --input option'));
          process.exit(EXIT_CODES.validationError);
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
      console.error(chalk.red('❌ Failed to start workflow:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(EXIT_CODES.generalError);
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
        if (typeof options.sessionId !== 'string' || options.sessionId.trim().length === 0) {
          console.error(chalk.red('❌ Error: Session ID must be a non-empty string'));
          process.exit(EXIT_CODES.validationError);
        }
        
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
      console.error(chalk.red('❌ Failed to continue workflow:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(EXIT_CODES.generalError);
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
      if (options.format && !['table', 'json'].includes(options.format)) {
        console.error(chalk.red('❌ Error: Format must be either "table" or "json"'));
        process.exit(EXIT_CODES.validationError);
      }

      if (options.sessionId) {
        // Validate session ID
        if (typeof options.sessionId !== 'string' || options.sessionId.trim().length === 0) {
          console.error(chalk.red('❌ Error: Session ID must be a non-empty string'));
          process.exit(EXIT_CODES.validationError);
        }
        console.log(chalk.blue(`Status for session: ${options.sessionId}`));
      } else {
        console.log(chalk.blue('Status for all active sessions'));
      }

      // TODO: Integrate with state manager when available
      console.log(chalk.yellow('⚠️  No active workflows found'));
      console.log(chalk.gray('Workflow status will be displayed when sessions exist'));

    } catch (error) {
      console.error(chalk.red('❌ Failed to get status:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(EXIT_CODES.generalError);
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
        console.error(chalk.red('❌ Error: Only "workflows" type is currently supported'));
        console.log(chalk.gray('Usage: aiflow list workflows'));
        process.exit(EXIT_CODES.validationError);
      }

      // Validate format option
      if (options.format && !['table', 'json'].includes(options.format)) {
        console.error(chalk.red('❌ Error: Format must be either "table" or "json"'));
        process.exit(EXIT_CODES.validationError);
      }

      console.log(chalk.blue('📋 Available Workflows'));

      // TODO: Integrate with workflow loader when available
      console.log(chalk.yellow('⚠️  No workflows found'));
      console.log(chalk.gray('Workflows will be listed when workflow files are available'));

    } catch (error) {
      console.error(chalk.red('❌ Failed to list workflows:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(EXIT_CODES.generalError);
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
      if (!workflowId || typeof workflowId !== 'string' || workflowId.trim().length === 0) {
        console.error(chalk.red('❌ Error: Workflow ID is required and must be a non-empty string'));
        process.exit(EXIT_CODES.validationError);
      }

      // Validate format option
      if (options.format && !['yaml', 'json'].includes(options.format)) {
        console.error(chalk.red('❌ Error: Format must be either "yaml" or "json"'));
        process.exit(EXIT_CODES.validationError);
      }

      console.log(chalk.blue(`📄 Workflow Details: ${workflowId}`));
      console.log(chalk.gray(`Format: ${options.format}`));

      // TODO: Integrate with workflow loader when available
      console.log(chalk.yellow('⚠️  Workflow loader not yet implemented'));
      console.log(chalk.gray('Workflow details will be displayed when the loader is ready'));

    } catch (error) {
      console.error(chalk.red('❌ Failed to show workflow:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(EXIT_CODES.generalError);
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
      if (options.format && !['json', 'markdown'].includes(options.format)) {
        console.error(chalk.red('❌ Error: Format must be either "json" or "markdown"'));
        process.exit(EXIT_CODES.validationError);
      }

      // Validate session ID if provided
      if (options.sessionId && (typeof options.sessionId !== 'string' || options.sessionId.trim().length === 0)) {
        console.error(chalk.red('❌ Error: Session ID must be a non-empty string'));
        process.exit(EXIT_CODES.validationError);
      }

      console.log(chalk.blue('📤 Exporting session data'));
      
      const sessionInfo = options.sessionId || 'most recent session';
      const format = options.format || 'json';
      console.log(chalk.gray(`Session: ${sessionInfo}`));
      console.log(chalk.gray(`Format: ${format}`));
      console.log(chalk.gray(`Output: ${options.output || 'stdout'}`));

      // TODO: Integrate with state manager when available
      console.log(chalk.yellow('⚠️  State manager not yet implemented'));
      console.log(chalk.gray('Export functionality will be available when the state manager is ready'));

    } catch (error) {
      console.error(chalk.red('❌ Failed to export data:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(EXIT_CODES.generalError);
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
