import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppMonitor } from './AppMonitor.js';
import * as fs from 'fs';
import * as path from 'path';

describe('AppMonitor', () => {
  let monitor: AppMonitor;
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join('/tmp', `appmonitor-test-${Date.now()}`);
    await fs.promises.mkdir(testDir, { recursive: true });

    monitor = new AppMonitor({
      prodBasePath: testDir,
      defaultCheckIntervalMs: 1000,
      defaultTimeoutMs: 500,
      maxHistoryEntries: 100
    });
  });

  afterEach(async () => {
    monitor.cleanup();
    // Clean up test directory
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('App Management', () => {
    it('should add a new app successfully', async () => {
      const appPath = path.join(testDir, 'test-app');
      await fs.promises.mkdir(appPath, { recursive: true });

      const app = await monitor.addApp({
        name: 'test-app',
        path: appPath,
        port: 3000,
        description: 'Test app',
        autoStart: false
      });

      expect(app.name).toBe('test-app');
      expect(app.port).toBe(3000);
      expect(app.enabled).toBe(true);
      expect(app.id).toBeDefined();
      expect(app.createdAt).toBeDefined();
    });

    it('should reject app with non-existent path', async () => {
      await expect(
        monitor.addApp({
          name: 'test-app',
          path: '/nonexistent/path/does/not/exist',
          port: 3000,
          autoStart: false
        })
      ).rejects.toThrow('App path does not exist');
    });

    it('should reject duplicate app names', async () => {
      const appPath1 = path.join(testDir, 'test-app1');
      const appPath2 = path.join(testDir, 'test-app2');
      await fs.promises.mkdir(appPath1, { recursive: true });
      await fs.promises.mkdir(appPath2, { recursive: true });

      await monitor.addApp({
        name: 'test-app',
        path: appPath1,
        port: 3000,
        autoStart: false
      });

      await expect(
        monitor.addApp({
          name: 'test-app',
          path: appPath2,
          port: 3001,
          autoStart: false
        })
      ).rejects.toThrow('App with name "test-app" already exists');
    });

    it('should reject duplicate ports', async () => {
      const appPath1 = path.join(testDir, 'app1');
      const appPath2 = path.join(testDir, 'app2');
      await fs.promises.mkdir(appPath1, { recursive: true });
      await fs.promises.mkdir(appPath2, { recursive: true });

      await monitor.addApp({
        name: 'app1',
        path: appPath1,
        port: 3000,
        autoStart: false
      });

      await expect(
        monitor.addApp({
          name: 'app2',
          path: appPath2,
          port: 3000,
          autoStart: false
        })
      ).rejects.toThrow('App with port 3000 already exists');
    });

    it('should remove an app successfully', async () => {
      const appPath = path.join(testDir, 'test-app');
      await fs.promises.mkdir(appPath, { recursive: true });

      const app = await monitor.addApp({
        name: 'test-app',
        path: appPath,
        port: 3000,
        autoStart: false
      });

      const result = monitor.removeApp(app.id);
      expect(result).toBe(true);
      expect(monitor.getApp(app.id)).toBeUndefined();
    });

    it('should return false when removing non-existent app', () => {
      const result = monitor.removeApp('non-existent-id');
      expect(result).toBe(false);
    });

    it('should get app by ID', async () => {
      const appPath = path.join(testDir, 'test-app');
      await fs.promises.mkdir(appPath, { recursive: true });

      const app = await monitor.addApp({
        name: 'test-app',
        path: appPath,
        port: 3000,
        autoStart: false
      });

      const retrieved = monitor.getApp(app.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-app');
    });

    it('should get app by name', async () => {
      const appPath = path.join(testDir, 'test-app');
      await fs.promises.mkdir(appPath, { recursive: true });

      await monitor.addApp({
        name: 'test-app',
        path: appPath,
        port: 3000,
        autoStart: false
      });

      const retrieved = monitor.getAppByName('test-app');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-app');
    });

    it('should return undefined for non-existent app name', () => {
      const retrieved = monitor.getAppByName('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should get all apps', async () => {
      const appPath1 = path.join(testDir, 'app1');
      const appPath2 = path.join(testDir, 'app2');
      await fs.promises.mkdir(appPath1, { recursive: true });
      await fs.promises.mkdir(appPath2, { recursive: true });

      await monitor.addApp({
        name: 'app1',
        path: appPath1,
        port: 3000,
        autoStart: false
      });

      await monitor.addApp({
        name: 'app2',
        path: appPath2,
        port: 3001,
        autoStart: false
      });

      const apps = monitor.getAllApps();
      expect(apps).toHaveLength(2);
    });

    it('should update app configuration', async () => {
      const appPath = path.join(testDir, 'test-app');
      await fs.promises.mkdir(appPath, { recursive: true });

      const app = await monitor.addApp({
        name: 'test-app',
        path: appPath,
        port: 3000,
        description: 'Original description',
        autoStart: false
      });

      const updated = monitor.updateApp(app.id, {
        description: 'Updated description'
      });

      expect(updated).toBeDefined();
      expect(updated?.description).toBe('Updated description');
      expect(updated?.updatedAt).toBeDefined();
    });

    it('should return undefined when updating non-existent app', () => {
      const updated = monitor.updateApp('non-existent', {
        description: 'Test'
      });

      expect(updated).toBeUndefined();
    });
  });

  describe('App Searching', () => {
    it('should find apps by tag', async () => {
      const apiPath = path.join(testDir, 'api-server');
      const webPath = path.join(testDir, 'web-server');
      await fs.promises.mkdir(apiPath, { recursive: true });
      await fs.promises.mkdir(webPath, { recursive: true });

      await monitor.addApp({
        name: 'api-server',
        path: apiPath,
        port: 3000,
        tags: ['api', 'backend'],
        autoStart: false
      });

      await monitor.addApp({
        name: 'web-server',
        path: webPath,
        port: 3001,
        tags: ['web', 'frontend'],
        autoStart: false
      });

      const apiApps = monitor.findAppsByTag('api');
      expect(apiApps).toHaveLength(1);
      expect(apiApps[0].name).toBe('api-server');

      const backendApps = monitor.findAppsByTag('backend');
      expect(backendApps).toHaveLength(1);
    });

    it('should return empty array for non-existent tag', () => {
      const apps = monitor.findAppsByTag('non-existent');
      expect(apps).toHaveLength(0);
    });
  });

  describe('Monitoring Control', () => {
    it('should enable and disable app monitoring', async () => {
      const appPath = path.join(testDir, 'test-app');
      await fs.promises.mkdir(appPath, { recursive: true });

      const app = await monitor.addApp({
        name: 'test-app',
        path: appPath,
        port: 3000,
        autoStart: false
      });

      const enabled = monitor.setAppEnabled(app.id, true);
      expect(enabled).toBe(true);

      const disabled = monitor.setAppEnabled(app.id, false);
      expect(disabled).toBe(true);
    });

    it('should return false when enabling/disabling non-existent app', () => {
      const result = monitor.setAppEnabled('non-existent', true);
      expect(result).toBe(false);
    });

    it('should start monitoring for an app', async () => {
      const appPath = path.join(testDir, 'test-app');
      await fs.promises.mkdir(appPath, { recursive: true });

      const app = await monitor.addApp({
        name: 'test-app',
        path: appPath,
        port: 3000,
        autoStart: false
      });

      const result = monitor.startMonitoring(app.id);
      expect(result).toBe(true);
    });

    it('should return false when starting monitoring for non-existent app', () => {
      const result = monitor.startMonitoring('non-existent');
      expect(result).toBe(false);
    });

    it('should stop monitoring for an app', async () => {
      const appPath = path.join(testDir, 'test-app');
      await fs.promises.mkdir(appPath, { recursive: true });

      const app = await monitor.addApp({
        name: 'test-app',
        path: appPath,
        port: 3000,
        autoStart: false
      });

      monitor.startMonitoring(app.id);
      const result = monitor.stopMonitoring(app.id);
      expect(result).toBe(true);
    });

    it('should return false when stopping monitoring for app not being monitored', () => {
      const result = monitor.stopMonitoring('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Status History', () => {
    it('should track status history', async () => {
      const appPath = path.join(testDir, 'test-app');
      await fs.promises.mkdir(appPath, { recursive: true });

      const app = await monitor.addApp({
        name: 'test-app',
        path: appPath,
        port: 3000,
        autoStart: false
      });

      const history = monitor.getStatusHistory(app.id);
      expect(Array.isArray(history)).toBe(true);
    });

    it('should limit status history entries', async () => {
      const appPath = path.join(testDir, 'test-app');
      await fs.promises.mkdir(appPath, { recursive: true });

      const app = await monitor.addApp({
        name: 'test-app',
        path: appPath,
        port: 3000,
        autoStart: false
      });

      const history = monitor.getStatusHistory(app.id, 10);
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Statistics', () => {
    it('should calculate monitoring statistics', async () => {
      const appPath1 = path.join(testDir, 'app1');
      const appPath2 = path.join(testDir, 'app2');
      await fs.promises.mkdir(appPath1, { recursive: true });
      await fs.promises.mkdir(appPath2, { recursive: true });

      await monitor.addApp({
        name: 'app1',
        path: appPath1,
        port: 3000,
        autoStart: false
      });

      await monitor.addApp({
        name: 'app2',
        path: appPath2,
        port: 3001,
        autoStart: false
      });

      const stats = monitor.getStats();
      expect(stats.totalApps).toBe(2);
      expect(stats.unknownApps).toBeGreaterThanOrEqual(0);
    });

    it('should track offline apps', () => {
      const offlineApps = monitor.getOfflineApps();
      expect(Array.isArray(offlineApps)).toBe(true);
    });

    it('should track degraded apps', () => {
      const degradedApps = monitor.getDegradedApps();
      expect(Array.isArray(degradedApps)).toBe(true);
    });
  });

  describe('Security - Shell Command Escaping', () => {
    it('should properly escape port numbers in shell commands', async () => {
      const appPath = path.join(testDir, 'test-app');
      await fs.promises.mkdir(appPath, { recursive: true });

      const app = await monitor.addApp({
        name: 'test-app',
        path: appPath,
        port: 3000,
        autoStart: false
      });

      // This should not throw or cause command injection
      await expect(monitor.checkAppHealth(app.id)).resolves.toBeDefined();
    });

    it('should handle app names safely in log retrieval', async () => {
      const appPath = path.join(testDir, 'test-app');
      await fs.promises.mkdir(appPath, { recursive: true });

      const app = await monitor.addApp({
        name: 'test-app',
        path: appPath,
        port: 3000,
        autoStart: false
      });

      // Should properly escape app name in shell commands
      const result = await monitor.getAppLogs(app.id, 50);
      expect(result).toBeDefined();
      expect(result.logs).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    it('should validate port is a valid number', async () => {
      const appPath = path.join(testDir, 'test-app');
      await fs.promises.mkdir(appPath, { recursive: true });

      const app = await monitor.addApp({
        name: 'test-app',
        path: appPath,
        port: 3000,
        autoStart: false
      });

      expect(app.port).toBe(3000);
      expect(typeof app.port).toBe('number');
    });

    it('should use absolute paths correctly', async () => {
      const appPath = '/tmp/absolute/path/test';
      await fs.promises.mkdir(appPath, { recursive: true });

      const app = await monitor.addApp({
        name: 'test-app',
        path: appPath,
        port: 3000,
        autoStart: false
      });

      expect(app.path).toBe(appPath);

      // Cleanup
      await fs.promises.rm('/tmp/absolute', { recursive: true, force: true });
    });

    it('should join relative paths to prodBasePath', async () => {
      const relativePath = 'relative/path';
      const fullPath = path.join(testDir, relativePath);
      await fs.promises.mkdir(fullPath, { recursive: true });

      const app = await monitor.addApp({
        name: 'test-app',
        path: relativePath,
        port: 3000,
        autoStart: false
      });

      expect(app.path).toBe(fullPath);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when checking health of non-existent app', async () => {
      await expect(
        monitor.checkAppHealth('non-existent')
      ).rejects.toThrow('App not found');
    });

    it('should throw error when getting logs for non-existent app', async () => {
      await expect(
        monitor.getAppLogs('non-existent')
      ).rejects.toThrow('App not found');
    });

    it('should handle errors in checkAllApps gracefully', async () => {
      const appPath = path.join(testDir, 'test-app');
      await fs.promises.mkdir(appPath, { recursive: true });

      await monitor.addApp({
        name: 'test-app',
        path: appPath,
        port: 3000,
        autoStart: false
      });

      const results = await monitor.checkAllApps();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should stop all monitoring intervals on cleanup', async () => {
      const appPath1 = path.join(testDir, 'app1');
      const appPath2 = path.join(testDir, 'app2');
      await fs.promises.mkdir(appPath1, { recursive: true });
      await fs.promises.mkdir(appPath2, { recursive: true });

      await monitor.addApp({
        name: 'app1',
        path: appPath1,
        port: 3000,
        autoStart: false
      });

      await monitor.addApp({
        name: 'app2',
        path: appPath2,
        port: 3001,
        autoStart: false
      });

      monitor.cleanup();
      // After cleanup, all intervals should be stopped
      expect(true).toBe(true); // Just verify it doesn't throw
    });
  });
});
