#!/usr/bin/env node
/**
 * Enterprise Agent Supervisor - CLI Entry Point
 *
 * Starts the MCP server for agent governance.
 */

import { startServer } from './server.js';

startServer().catch((error) => {
  console.error('Failed to start Agent Supervisor:', error);
  process.exit(1);
});
