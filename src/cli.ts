#!/usr/bin/env node
/**
 * Enterprise Agent Supervisor - CLI Entry Point
 *
 * Provides command-line interface for the agent governance MCP server.
 */

import { startServer } from './server.js';

// Package version from package.json
const VERSION = '1.0.0';
const PROGRAM_NAME = 'agent-supervisor';

interface CLIOptions {
  help: boolean;
  version: boolean;
  verbose: boolean;
  preset?: string;
  environment?: 'development' | 'staging' | 'production';
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    help: false,
    version: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;

      case '-v':
      case '--version':
        options.version = true;
        break;

      case '--verbose':
        options.verbose = true;
        break;

      case '-p':
      case '--preset':
        options.preset = args[++i];
        break;

      case '-e':
      case '--environment':
        const env = args[++i];
        if (env === 'development' || env === 'staging' || env === 'production') {
          options.environment = env;
        } else {
          console.error(`Invalid environment: ${env}`);
          console.error('Valid options: development, staging, production');
          process.exit(1);
        }
        break;

      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          console.error(`Run '${PROGRAM_NAME} --help' for usage information.`);
          process.exit(1);
        }
    }
  }

  return options;
}

/**
 * Display help message
 */
function showHelp(): void {
  console.log(`
${PROGRAM_NAME} v${VERSION}
Enterprise Agent Supervisor - AI Agent Governance MCP Server

USAGE:
  ${PROGRAM_NAME} [OPTIONS]

OPTIONS:
  -h, --help              Show this help message
  -v, --version           Show version information
  --verbose               Enable verbose logging
  -p, --preset <name>     Use a preset configuration
                          Options: minimal, standard, strict, financial, healthcare, development
  -e, --environment <env> Set the environment
                          Options: development, staging, production

EXAMPLES:
  # Start with default settings
  ${PROGRAM_NAME}

  # Start with strict preset in production
  ${PROGRAM_NAME} --preset strict --environment production

  # Start with verbose logging
  ${PROGRAM_NAME} --verbose

PRESETS:
  minimal      - Basic governance with minimal rules
  standard     - Recommended for most use cases (default)
  strict       - Maximum security and compliance
  financial    - Optimized for financial services (PCI-DSS, SOX)
  healthcare   - Optimized for healthcare (HIPAA)
  development  - Relaxed rules for development environments

MCP TOOLS:
  When connected via MCP, the following tools are available:

  Rule Management:
    - evaluate_action        Evaluate an agent action against rules
    - register_rule          Register a new business rule
    - list_rules             List all registered rules
    - apply_business_rules   Apply rules to a business context

  Approval Workflows:
    - request_approval       Request human approval for an action
    - approve_request        Approve a pending request
    - deny_request           Deny a pending request
    - list_pending_approvals List all pending approval requests

  Monitoring:
    - get_audit_log          Get audit log entries
    - get_rate_limit_status  Get current rate limit status
    - get_supervisor_status  Get overall supervisor status

  CSS Governance:
    - analyze_css            Analyze CSS for issues
    - get_design_tokens      Get available design tokens

For more information, visit: https://github.com/TrentApps-com/ManagerProtocol
`);
}

/**
 * Display version information
 */
function showVersion(): void {
  console.log(`${PROGRAM_NAME} v${VERSION}`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (options.version) {
    showVersion();
    process.exit(0);
  }

  // Set environment variables based on options
  if (options.verbose) {
    process.env.AGENT_SUPERVISOR_VERBOSE = 'true';
  }

  if (options.preset) {
    process.env.AGENT_SUPERVISOR_PRESET = options.preset;
  }

  if (options.environment) {
    process.env.AGENT_SUPERVISOR_ENV = options.environment;
  }

  // Log startup info
  if (options.verbose) {
    console.error(`Starting ${PROGRAM_NAME} v${VERSION}`);
    if (options.preset) {
      console.error(`Using preset: ${options.preset}`);
    }
    if (options.environment) {
      console.error(`Environment: ${options.environment}`);
    }
  }

  try {
    await startServer();
  } catch (error) {
    console.error('Failed to start Agent Supervisor:', error);
    process.exit(1);
  }
}

main();
