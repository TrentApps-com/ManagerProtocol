/**
 * Dashboard Configuration
 *
 * Externalized configuration for the HTTP dashboard server.
 * All settings can be overridden via environment variables.
 */

/**
 * Dashboard configuration interface
 */
export interface DashboardConfig {
  /** Port to listen on (default: 3100) */
  port: number;
  /** Host to bind to (default: localhost) */
  host: string;
  /** Optional authentication token for API access */
  authToken?: string;
  /** CORS origin (default: * for development, should be restricted in production) */
  corsOrigin: string;
  /** Cache TTL in milliseconds for dashboard data (default: 5000) */
  cacheTtl: number;
  /** WebSocket update interval in milliseconds (default: 2000) */
  wsInterval: number;
}

/**
 * Default dashboard configuration values
 */
const defaults: DashboardConfig = {
  port: 3100,
  host: 'localhost',
  authToken: undefined,
  corsOrigin: '*',
  cacheTtl: 5000,
  wsInterval: 2000
};

/**
 * Parse an integer from environment variable with fallback
 */
function parseIntEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Parse a string from environment variable with fallback
 */
function parseStringEnv(value: string | undefined, fallback: string): string {
  return value !== undefined && value !== '' ? value : fallback;
}

/**
 * Parse an optional string from environment variable
 */
function parseOptionalStringEnv(value: string | undefined): string | undefined {
  return value !== undefined && value !== '' ? value : undefined;
}

/**
 * Load dashboard configuration from environment variables
 *
 * Environment Variables:
 * - DASHBOARD_PORT: Port to listen on (default: 3100)
 * - DASHBOARD_HOST: Host to bind to (default: localhost)
 * - DASHBOARD_AUTH_TOKEN: Optional authentication token for API access
 * - DASHBOARD_CORS_ORIGIN: CORS origin (default: *)
 * - DASHBOARD_CACHE_TTL: Cache TTL in milliseconds (default: 5000)
 * - DASHBOARD_WS_INTERVAL: WebSocket update interval in milliseconds (default: 2000)
 */
export function loadDashboardConfig(): DashboardConfig {
  return {
    port: parseIntEnv(process.env.DASHBOARD_PORT, defaults.port),
    host: parseStringEnv(process.env.DASHBOARD_HOST, defaults.host),
    authToken: parseOptionalStringEnv(process.env.DASHBOARD_AUTH_TOKEN),
    corsOrigin: parseStringEnv(process.env.DASHBOARD_CORS_ORIGIN, defaults.corsOrigin),
    cacheTtl: parseIntEnv(process.env.DASHBOARD_CACHE_TTL, defaults.cacheTtl),
    wsInterval: parseIntEnv(process.env.DASHBOARD_WS_INTERVAL, defaults.wsInterval)
  };
}

/**
 * Validate dashboard configuration
 * @returns Array of validation error messages, empty if valid
 */
export function validateDashboardConfig(config: DashboardConfig): string[] {
  const errors: string[] = [];

  // Validate port
  if (config.port < 1 || config.port > 65535) {
    errors.push(`Invalid port: ${config.port}. Must be between 1 and 65535.`);
  }

  // Validate cache TTL
  if (config.cacheTtl < 0) {
    errors.push(`Invalid cacheTtl: ${config.cacheTtl}. Must be non-negative.`);
  }

  // Validate WebSocket interval
  if (config.wsInterval < 100) {
    errors.push(`Invalid wsInterval: ${config.wsInterval}. Must be at least 100ms.`);
  }

  return errors;
}

/**
 * Get the default dashboard configuration
 */
export function getDefaultConfig(): DashboardConfig {
  return { ...defaults };
}

/**
 * Create a dashboard configuration with custom overrides
 */
export function createDashboardConfig(overrides: Partial<DashboardConfig> = {}): DashboardConfig {
  const envConfig = loadDashboardConfig();
  return {
    ...envConfig,
    ...overrides
  };
}

/**
 * Singleton dashboard configuration instance
 * Loaded once from environment variables
 */
export const dashboardConfig = loadDashboardConfig();

export default dashboardConfig;
