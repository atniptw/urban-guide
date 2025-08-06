#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';

const program = new Command();

program
  .name('aiflow')
  .description('AI Workflow Orchestrator - Manage AI agents for development tasks')
  .version('0.1.0');

program.parse();

if (!process.argv.slice(2).length) {
  console.log(chalk.blue('aiflow v0.1.0'));
}
