/**
 * Configuration Module
 *
 * Centralized configuration management for the Agent Supervisor.
 */

export {
  type DashboardConfig,
  loadDashboardConfig,
  validateDashboardConfig,
  getDefaultConfig,
  createDashboardConfig,
  dashboardConfig
} from './dashboard.js';
