/**
 * Simple script to test the new dashboard
 */
import { startDashboardServer } from './dist/dashboard/httpDashboard.js';

const port = process.env.DASHBOARD_PORT || 8788;
console.log(`Starting Agent Supervisor Dashboard on port ${port}...`);
startDashboardServer(parseInt(port)).catch(err => {
  console.error('Failed to start dashboard:', err);
  process.exit(1);
});
