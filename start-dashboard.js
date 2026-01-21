#!/usr/bin/env node
/**
 * Start the Agent Supervisor Dashboard
 */

import { startDashboardServer } from './dist/dashboard/httpDashboard.js';

const port = process.env.DASHBOARD_PORT || 8787;

console.log(`Starting Agent Supervisor Dashboard on port ${port}...`);

startDashboardServer(port)
  .then(() => {
    console.log(`Dashboard server running at http://localhost:${port}`);
    console.log('Press Ctrl+C to stop');
  })
  .catch(err => {
    console.error('Failed to start dashboard:', err);
    process.exit(1);
  });
