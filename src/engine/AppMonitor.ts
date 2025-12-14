/**
 * Enterprise Agent Supervisor - App Monitor
 *
 * Monitors production applications running on the server.
 * Tracks online status, health checks, and process information.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import {
  MonitoredApp,
  AppStatus,
  AppHealthCheckResult,
  AppStatusHistoryEntry,
  AppMonitorStats
} from '../types/index.js';

const execAsync = promisify(exec);

export interface AppMonitorOptions {
  prodBasePath?: string;
  maxHistoryEntries?: number;
  defaultCheckIntervalMs?: number;
  defaultTimeoutMs?: number;
}

export class AppMonitor {
  private apps: Map<string, MonitoredApp> = new Map();
  private statusHistory: Map<string, AppStatusHistoryEntry[]> = new Map();
  private lastCheckResults: Map<string, AppHealthCheckResult> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();

  private prodBasePath: string;
  private maxHistoryEntries: number;
  private defaultCheckIntervalMs: number;
  private defaultTimeoutMs: number;

  constructor(options: AppMonitorOptions = {}) {
    this.prodBasePath = options.prodBasePath ?? '/mnt/prod';
    this.maxHistoryEntries = options.maxHistoryEntries ?? 1000;
    this.defaultCheckIntervalMs = options.defaultCheckIntervalMs ?? 30000;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 5000;
  }

  /**
   * Generate a unique app ID
   */
  private generateAppId(): string {
    return `app_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Add a new app to monitor
   */
  async addApp(config: {
    name: string;
    path: string;
    port: number;
    description?: string;
    healthEndpoint?: string;
    expectedResponseCode?: number;
    checkIntervalMs?: number;
    timeoutMs?: number;
    tags?: string[];
    metadata?: Record<string, unknown>;
    autoStart?: boolean;
  }): Promise<MonitoredApp> {
    // Validate path exists
    const fullPath = config.path.startsWith('/')
      ? config.path
      : path.join(this.prodBasePath, config.path);

    const pathExists = await this.checkPathExists(fullPath);
    if (!pathExists) {
      throw new Error(`App path does not exist: ${fullPath}`);
    }

    // Check if app with same name or port already exists
    for (const [, app] of this.apps) {
      if (app.name === config.name) {
        throw new Error(`App with name "${config.name}" already exists`);
      }
      if (app.port === config.port) {
        throw new Error(`App with port ${config.port} already exists (${app.name})`);
      }
    }

    const now = new Date().toISOString();
    const app: MonitoredApp = {
      id: this.generateAppId(),
      name: config.name,
      path: fullPath,
      port: config.port,
      description: config.description,
      healthEndpoint: config.healthEndpoint,
      expectedResponseCode: config.expectedResponseCode ?? 200,
      checkIntervalMs: config.checkIntervalMs ?? this.defaultCheckIntervalMs,
      timeoutMs: config.timeoutMs ?? this.defaultTimeoutMs,
      enabled: true,
      tags: config.tags,
      metadata: config.metadata,
      createdAt: now
    };

    this.apps.set(app.id, app);
    this.statusHistory.set(app.id, []);

    // Start monitoring if autoStart is true (default)
    if (config.autoStart !== false) {
      this.startMonitoring(app.id);
    }

    // Do an initial check
    await this.checkAppHealth(app.id);

    return app;
  }

  /**
   * Remove an app from monitoring
   */
  removeApp(appId: string): boolean {
    const app = this.apps.get(appId);
    if (!app) {
      return false;
    }

    // Stop monitoring interval
    this.stopMonitoring(appId);

    // Remove from all maps
    this.apps.delete(appId);
    this.statusHistory.delete(appId);
    this.lastCheckResults.delete(appId);

    return true;
  }

  /**
   * Get an app by ID
   */
  getApp(appId: string): MonitoredApp | undefined {
    return this.apps.get(appId);
  }

  /**
   * Get app by name
   */
  getAppByName(name: string): MonitoredApp | undefined {
    for (const [, app] of this.apps) {
      if (app.name === name) {
        return app;
      }
    }
    return undefined;
  }

  /**
   * Get all apps
   */
  getAllApps(): MonitoredApp[] {
    return Array.from(this.apps.values());
  }

  /**
   * Update an app configuration
   */
  updateApp(appId: string, updates: Partial<Omit<MonitoredApp, 'id' | 'createdAt'>>): MonitoredApp | undefined {
    const app = this.apps.get(appId);
    if (!app) {
      return undefined;
    }

    const updatedApp: MonitoredApp = {
      ...app,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.apps.set(appId, updatedApp);

    // Restart monitoring if interval changed
    if (updates.checkIntervalMs !== undefined && updates.checkIntervalMs !== app.checkIntervalMs) {
      this.stopMonitoring(appId);
      if (updatedApp.enabled) {
        this.startMonitoring(appId);
      }
    }

    return updatedApp;
  }

  /**
   * Check if a path exists
   */
  private async checkPathExists(pathToCheck: string): Promise<boolean> {
    try {
      await fs.promises.access(pathToCheck, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a port is in use
   */
  private async isPortInUse(port: number): Promise<{ inUse: boolean; pid?: number }> {
    try {
      const { stdout } = await execAsync(`lsof -i :${port} -t 2>/dev/null || true`);
      const pid = stdout.trim();
      if (pid) {
        return { inUse: true, pid: parseInt(pid.split('\n')[0], 10) };
      }
      return { inUse: false };
    } catch {
      return { inUse: false };
    }
  }

  /**
   * Get process info by PID
   */
  private async getProcessInfo(pid: number): Promise<{
    memoryUsageMb?: number;
    cpuPercent?: number;
    uptime?: string;
  }> {
    try {
      // Get memory and CPU using ps
      const { stdout } = await execAsync(`ps -p ${pid} -o %mem,%cpu,etime --no-headers 2>/dev/null || true`);
      const parts = stdout.trim().split(/\s+/);

      if (parts.length >= 3) {
        // Get total memory to calculate MB
        const { stdout: memTotal } = await execAsync(`free -m | awk '/Mem:/ {print $2}'`);
        const totalMemMb = parseInt(memTotal.trim(), 10);
        const memPercent = parseFloat(parts[0]);

        return {
          memoryUsageMb: Math.round((memPercent / 100) * totalMemMb),
          cpuPercent: parseFloat(parts[1]),
          uptime: parts[2]
        };
      }
    } catch {
      // Ignore errors
    }
    return {};
  }

  /**
   * Make an HTTP health check request
   */
  private async httpHealthCheck(
    port: number,
    endpoint: string,
    timeoutMs: number,
    expectedStatusCode: number
  ): Promise<{ success: boolean; statusCode?: number; responseTimeMs: number; error?: string }> {
    const startTime = Date.now();
    const url = `http://localhost:${port}${endpoint}`;

    return new Promise((resolve) => {
      const request = http.get(url, { timeout: timeoutMs }, (res) => {
        const responseTimeMs = Date.now() - startTime;
        const success = res.statusCode === expectedStatusCode;
        resolve({
          success,
          statusCode: res.statusCode,
          responseTimeMs,
          error: success ? undefined : `Expected ${expectedStatusCode}, got ${res.statusCode}`
        });
      });

      request.on('error', (err) => {
        resolve({
          success: false,
          responseTimeMs: Date.now() - startTime,
          error: err.message
        });
      });

      request.on('timeout', () => {
        request.destroy();
        resolve({
          success: false,
          responseTimeMs: timeoutMs,
          error: 'Request timed out'
        });
      });
    });
  }

  /**
   * Check health of a specific app
   */
  async checkAppHealth(appId: string): Promise<AppHealthCheckResult> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App not found: ${appId}`);
    }

    const now = new Date().toISOString();
    const portCheck = await this.isPortInUse(app.port);

    let status: AppStatus = 'unknown';
    let responseTimeMs: number | undefined;
    let httpStatusCode: number | undefined;
    let errorMessage: string | undefined;
    let processInfo: AppHealthCheckResult['processInfo'];

    if (!portCheck.inUse) {
      status = 'offline';
      errorMessage = `Port ${app.port} is not listening`;
    } else {
      // Get process info
      if (portCheck.pid) {
        processInfo = {
          pid: portCheck.pid,
          ...(await this.getProcessInfo(portCheck.pid))
        };
      }

      // If health endpoint is configured, do HTTP check
      if (app.healthEndpoint) {
        const healthResult = await this.httpHealthCheck(
          app.port,
          app.healthEndpoint,
          app.timeoutMs,
          app.expectedResponseCode
        );

        responseTimeMs = healthResult.responseTimeMs;
        httpStatusCode = healthResult.statusCode;

        if (healthResult.success) {
          // Check if response time is degraded (> 2 seconds)
          status = responseTimeMs > 2000 ? 'degraded' : 'online';
        } else {
          status = 'degraded';
          errorMessage = healthResult.error;
        }
      } else {
        // No health endpoint, just check port
        status = 'online';
      }
    }

    const result: AppHealthCheckResult = {
      appId: app.id,
      appName: app.name,
      status,
      port: app.port,
      path: app.path,
      responseTimeMs,
      httpStatusCode,
      errorMessage,
      checkedAt: now,
      processInfo
    };

    // Store result
    this.lastCheckResults.set(appId, result);

    // Add to history
    this.addToHistory(appId, {
      appId,
      status,
      timestamp: now,
      responseTimeMs,
      errorMessage
    });

    return result;
  }

  /**
   * Check health of all apps
   */
  async checkAllApps(): Promise<AppHealthCheckResult[]> {
    const results: AppHealthCheckResult[] = [];

    for (const [appId, app] of this.apps) {
      if (app.enabled) {
        try {
          const result = await this.checkAppHealth(appId);
          results.push(result);
        } catch (error) {
          results.push({
            appId,
            appName: app.name,
            status: 'unknown',
            port: app.port,
            path: app.path,
            errorMessage: error instanceof Error ? error.message : String(error),
            checkedAt: new Date().toISOString()
          });
        }
      }
    }

    return results;
  }

  /**
   * Get the last check result for an app
   */
  getLastCheckResult(appId: string): AppHealthCheckResult | undefined {
    return this.lastCheckResults.get(appId);
  }

  /**
   * Get status history for an app
   */
  getStatusHistory(appId: string, limit?: number): AppStatusHistoryEntry[] {
    const history = this.statusHistory.get(appId) ?? [];
    if (limit) {
      return history.slice(-limit);
    }
    return history;
  }

  /**
   * Add entry to status history
   */
  private addToHistory(appId: string, entry: AppStatusHistoryEntry): void {
    let history = this.statusHistory.get(appId);
    if (!history) {
      history = [];
      this.statusHistory.set(appId, history);
    }

    history.push(entry);

    // Trim history if too long
    if (history.length > this.maxHistoryEntries) {
      history.splice(0, history.length - this.maxHistoryEntries);
    }
  }

  /**
   * Start monitoring an app
   */
  startMonitoring(appId: string): boolean {
    const app = this.apps.get(appId);
    if (!app) {
      return false;
    }

    // Clear any existing interval
    this.stopMonitoring(appId);

    // Set up new interval
    const interval = setInterval(async () => {
      try {
        await this.checkAppHealth(appId);
      } catch {
        // Ignore errors during automatic checks
      }
    }, app.checkIntervalMs);

    this.checkIntervals.set(appId, interval);
    return true;
  }

  /**
   * Stop monitoring an app
   */
  stopMonitoring(appId: string): boolean {
    const interval = this.checkIntervals.get(appId);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(appId);
      return true;
    }
    return false;
  }

  /**
   * Enable/disable an app
   */
  setAppEnabled(appId: string, enabled: boolean): boolean {
    const app = this.apps.get(appId);
    if (!app) {
      return false;
    }

    app.enabled = enabled;
    app.updatedAt = new Date().toISOString();

    if (enabled) {
      this.startMonitoring(appId);
    } else {
      this.stopMonitoring(appId);
    }

    return true;
  }

  /**
   * Get monitoring statistics
   */
  getStats(): AppMonitorStats {
    let onlineApps = 0;
    let offlineApps = 0;
    let degradedApps = 0;
    let unknownApps = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    let lastFullCheckAt: string | undefined;

    for (const [appId] of this.apps) {
      const result = this.lastCheckResults.get(appId);
      if (result) {
        if (!lastFullCheckAt || result.checkedAt > lastFullCheckAt) {
          lastFullCheckAt = result.checkedAt;
        }

        switch (result.status) {
          case 'online':
            onlineApps++;
            break;
          case 'offline':
            offlineApps++;
            break;
          case 'degraded':
            degradedApps++;
            break;
          default:
            unknownApps++;
        }

        if (result.responseTimeMs !== undefined) {
          totalResponseTime += result.responseTimeMs;
          responseTimeCount++;
        }
      } else {
        unknownApps++;
      }
    }

    return {
      totalApps: this.apps.size,
      onlineApps,
      offlineApps,
      degradedApps,
      unknownApps,
      averageResponseTimeMs: responseTimeCount > 0
        ? Math.round(totalResponseTime / responseTimeCount)
        : undefined,
      lastFullCheckAt
    };
  }

  /**
   * Find apps by tag
   */
  findAppsByTag(tag: string): MonitoredApp[] {
    return Array.from(this.apps.values()).filter(
      app => app.tags?.includes(tag)
    );
  }

  /**
   * Find apps by status
   */
  findAppsByStatus(status: AppStatus): MonitoredApp[] {
    const results: MonitoredApp[] = [];
    for (const [appId, app] of this.apps) {
      const lastResult = this.lastCheckResults.get(appId);
      if (lastResult?.status === status) {
        results.push(app);
      }
    }
    return results;
  }

  /**
   * Get apps that are currently offline
   */
  getOfflineApps(): MonitoredApp[] {
    return this.findAppsByStatus('offline');
  }

  /**
   * Get apps that are degraded
   */
  getDegradedApps(): MonitoredApp[] {
    return this.findAppsByStatus('degraded');
  }

  /**
   * Scan /mnt/prod for potential apps (directories with package.json or similar)
   */
  async scanForApps(): Promise<Array<{
    name: string;
    path: string;
    type: string;
    hasPackageJson: boolean;
    potentialPorts: number[];
  }>> {
    const results: Array<{
      name: string;
      path: string;
      type: string;
      hasPackageJson: boolean;
      potentialPorts: number[];
    }> = [];

    try {
      const entries = await fs.promises.readdir(this.prodBasePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const appPath = path.join(this.prodBasePath, entry.name);
          const packageJsonPath = path.join(appPath, 'package.json');
          let hasPackageJson = false;
          let appType = 'unknown';
          const potentialPorts: number[] = [];

          try {
            await fs.promises.access(packageJsonPath, fs.constants.F_OK);
            hasPackageJson = true;

            // Try to read package.json for port info
            const packageJson = JSON.parse(
              await fs.promises.readFile(packageJsonPath, 'utf-8')
            );

            // Detect app type
            if (packageJson.dependencies?.next) {
              appType = 'nextjs';
              potentialPorts.push(3000);
            } else if (packageJson.dependencies?.express) {
              appType = 'express';
              potentialPorts.push(3000);
            } else if (packageJson.dependencies?.fastify) {
              appType = 'fastify';
              potentialPorts.push(3000);
            } else if (packageJson.dependencies?.['@nestjs/core']) {
              appType = 'nestjs';
              potentialPorts.push(3000);
            } else {
              appType = 'node';
            }

            // Check scripts for port mentions
            if (packageJson.scripts) {
              const scriptStr = JSON.stringify(packageJson.scripts);
              const portMatches = scriptStr.match(/PORT[=:]\s*(\d+)/gi);
              if (portMatches) {
                for (const match of portMatches) {
                  const port = parseInt(match.replace(/PORT[=:]\s*/i, ''), 10);
                  if (!potentialPorts.includes(port)) {
                    potentialPorts.push(port);
                  }
                }
              }
            }
          } catch {
            // Check for other app types
            const dockerfilePath = path.join(appPath, 'Dockerfile');
            const composePath = path.join(appPath, 'docker-compose.yml');

            try {
              await fs.promises.access(dockerfilePath, fs.constants.F_OK);
              appType = 'docker';
            } catch {
              try {
                await fs.promises.access(composePath, fs.constants.F_OK);
                appType = 'docker-compose';
              } catch {
                // Unknown type
              }
            }
          }

          results.push({
            name: entry.name,
            path: appPath,
            type: appType,
            hasPackageJson,
            potentialPorts
          });
        }
      }
    } catch (error) {
      // Directory might not exist
      console.error(`Error scanning ${this.prodBasePath}:`, error);
    }

    return results;
  }

  /**
   * Get logs for an app (tail of stdout/stderr or PM2 logs)
   */
  async getAppLogs(appId: string, lines: number = 50): Promise<{
    logs: string;
    source: string;
  }> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App not found: ${appId}`);
    }

    // Try to get logs from PM2 first
    try {
      const { stdout } = await execAsync(`pm2 logs "${app.name}" --lines ${lines} --nostream 2>/dev/null`);
      return { logs: stdout, source: 'pm2' };
    } catch {
      // PM2 not available or app not managed by PM2
    }

    // Try to find log files in app directory
    const possibleLogPaths = [
      path.join(app.path, 'logs', 'app.log'),
      path.join(app.path, 'logs', 'error.log'),
      path.join(app.path, 'log', 'app.log'),
      path.join(app.path, 'app.log'),
      path.join(app.path, '.log'),
      `/var/log/${app.name}.log`
    ];

    for (const logPath of possibleLogPaths) {
      try {
        const { stdout } = await execAsync(`tail -n ${lines} "${logPath}" 2>/dev/null`);
        return { logs: stdout, source: logPath };
      } catch {
        // Try next path
      }
    }

    // Try journalctl if it's a systemd service
    try {
      const { stdout } = await execAsync(`journalctl -u "${app.name}" -n ${lines} --no-pager 2>/dev/null`);
      if (stdout.trim()) {
        return { logs: stdout, source: 'journalctl' };
      }
    } catch {
      // Not a systemd service
    }

    return { logs: 'No logs found', source: 'none' };
  }

  /**
   * Cleanup - stop all monitoring intervals
   */
  cleanup(): void {
    for (const [appId] of this.checkIntervals) {
      this.stopMonitoring(appId);
    }
  }
}

// Default instance
export const appMonitor = new AppMonitor();
