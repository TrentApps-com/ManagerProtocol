/**
 * HTTP Dashboard Server for Agent Supervisor
 *
 * Provides a web-based dashboard for monitoring agent activities,
 * managing approvals, viewing tasks, and checking audit logs.
 *
 * Configuration is externalized via environment variables:
 * - DASHBOARD_PORT: Port to listen on (default: 3100)
 * - DASHBOARD_HOST: Host to bind to (default: localhost)
 * - DASHBOARD_AUTH_TOKEN: Optional authentication token
 * - DASHBOARD_CORS_ORIGIN: CORS origin (default: *)
 * - DASHBOARD_CACHE_TTL: Cache TTL in ms (default: 5000)
 * - DASHBOARD_WS_INTERVAL: WebSocket update interval in ms (default: 2000)
 */

import * as http from 'http';
import * as crypto from 'crypto';
import { URL } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { supervisor } from '../supervisor/AgentSupervisor.js';
import { projectTracker } from '../supervisor/ProjectTracker.js';
import { taskManager } from '../engine/TaskManager.js';
import {
  type DashboardConfig,
  loadDashboardConfig,
  validateDashboardConfig
} from '../config/dashboard.js';

// ============================================================================
// RESPONSE CACHE - Server-side caching for API responses
// ============================================================================

interface CacheEntry {
  /** The cached response body */
  body: string;
  /** Content-Type header */
  contentType: string;
  /** ETag for conditional requests */
  etag: string;
  /** Timestamp when cached */
  cachedAt: number;
  /** TTL in milliseconds */
  ttlMs: number;
}

/**
 * Simple in-memory response cache for API endpoints.
 * Caches GET request responses with configurable TTL.
 */
export class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTtlMs: number;
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(defaultTtlMs: number = 5000) {
    this.defaultTtlMs = defaultTtlMs;
    // Cleanup expired entries every 30 seconds
    this.cleanupIntervalId = setInterval(() => this.cleanup(), 30000);
  }

  /**
   * Generate a cache key from request path and query parameters
   */
  generateKey(path: string, queryParams?: URLSearchParams): string {
    let key = path;
    if (queryParams && queryParams.toString()) {
      // Sort query params for consistent key generation
      const sortedParams = new URLSearchParams([...queryParams.entries()].sort());
      key += '?' + sortedParams.toString();
    }
    return key;
  }

  /**
   * Generate an ETag from response body
   */
  generateEtag(body: string): string {
    return crypto.createHash('md5').update(body).digest('hex');
  }

  /**
   * Get a cached response if available and not expired
   */
  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.cachedAt > entry.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Store a response in the cache
   */
  set(key: string, body: string, contentType: string = 'application/json', ttlMs?: number): CacheEntry {
    const entry: CacheEntry = {
      body,
      contentType,
      etag: this.generateEtag(body),
      cachedAt: Date.now(),
      ttlMs: ttlMs ?? this.defaultTtlMs
    };
    this.cache.set(key, entry);
    return entry;
  }

  /**
   * Invalidate cache entries matching a pattern
   * Used when mutations occur to ensure fresh data
   */
  invalidate(pattern: string | RegExp): number {
    let count = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.cachedAt > entry.ttlMs) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; defaultTtlMs: number } {
    return {
      size: this.cache.size,
      defaultTtlMs: this.defaultTtlMs
    };
  }

  /**
   * Stop the cleanup interval
   */
  destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    this.cache.clear();
  }
}

// Load configuration from environment
const dashboardConfig = loadDashboardConfig();

// Global response cache instance (using config TTL)
const responseCache = new ResponseCache(dashboardConfig.cacheTtl);

// ============================================================================
// HTTP UTILITIES
// ============================================================================

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS';

interface RouteHandler {
  (req: http.IncomingMessage, res: http.ServerResponse, params: Record<string, string>, body?: unknown): Promise<void>;
}

interface Route {
  method: HttpMethod;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
  cacheable?: boolean;  // Whether this route's responses can be cached
  cacheInvalidationPatterns?: (string | RegExp)[];  // Patterns to invalidate on mutation
}

const routes: Route[] = [];

/**
 * Register a route handler
 */
function route(
  method: HttpMethod,
  path: string,
  handler: RouteHandler,
  options?: { cacheable?: boolean; cacheInvalidationPatterns?: (string | RegExp)[] }
): void {
  // Convert path params like :id to named capture groups
  const paramNames: string[] = [];
  const patternStr = path.replace(/:(\w+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });

  routes.push({
    method,
    pattern: new RegExp(`^${patternStr}$`),
    paramNames,
    handler,
    cacheable: options?.cacheable ?? (method === 'GET'),
    cacheInvalidationPatterns: options?.cacheInvalidationPatterns
  });
}

/**
 * Send JSON response with caching headers
 */
function sendJson(
  res: http.ServerResponse,
  data: unknown,
  statusCode: number = 200,
  cacheEntry?: CacheEntry
): void {
  const body = JSON.stringify(data);

  res.setHeader('Content-Type', 'application/json');

  if (cacheEntry) {
    // Add caching headers
    res.setHeader('ETag', `"${cacheEntry.etag}"`);
    res.setHeader('Cache-Control', `private, max-age=${Math.floor(cacheEntry.ttlMs / 1000)}`);
    res.setHeader('X-Cache', 'HIT');
  } else {
    // Generate ETag for new responses
    const etag = crypto.createHash('md5').update(body).digest('hex');
    res.setHeader('ETag', `"${etag}"`);
    res.setHeader('Cache-Control', 'private, max-age=5');
    res.setHeader('X-Cache', 'MISS');
  }

  res.statusCode = statusCode;
  res.end(body);
}

/**
 * Send 304 Not Modified response
 */
function sendNotModified(res: http.ServerResponse, etag: string): void {
  res.setHeader('ETag', `"${etag}"`);
  res.setHeader('Cache-Control', 'private, max-age=5');
  res.statusCode = 304;
  res.end();
}

/**
 * Send error response
 */
function sendError(res: http.ServerResponse, message: string, statusCode: number = 500): void {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = statusCode;
  res.end(JSON.stringify({ error: message }));
}

/**
 * Parse request body as JSON
 */
async function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      if (!body) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Check If-None-Match header for conditional request
 */
function checkConditionalRequest(req: http.IncomingMessage, etag: string): boolean {
  const ifNoneMatch = req.headers['if-none-match'];
  if (!ifNoneMatch) return false;

  // Handle multiple ETags and weak ETags
  const etags = ifNoneMatch.split(',').map(e => e.trim().replace(/^W\//, '').replace(/"/g, ''));
  return etags.includes(etag) || etags.includes('*');
}

// ============================================================================
// CACHE MIDDLEWARE
// ============================================================================

/**
 * Wraps a route handler with caching logic
 */
function withCache(
  handler: RouteHandler,
  cacheable: boolean = true
): RouteHandler {
  return async (req, res, params, body) => {
    // Only cache GET requests
    if (req.method !== 'GET' || !cacheable) {
      return handler(req, res, params, body);
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const cacheKey = responseCache.generateKey(url.pathname, url.searchParams);

    // Check cache
    const cached = responseCache.get(cacheKey);
    if (cached) {
      // Check conditional request
      if (checkConditionalRequest(req, cached.etag)) {
        sendNotModified(res, cached.etag);
        return;
      }

      // Return cached response
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('ETag', `"${cached.etag}"`);
      res.setHeader('Cache-Control', `private, max-age=${Math.floor(cached.ttlMs / 1000)}`);
      res.setHeader('X-Cache', 'HIT');
      res.statusCode = 200;
      res.end(cached.body);
      return;
    }

    // Intercept the response to cache it
    const originalEnd = res.end.bind(res);
    let responseBody = '';

    res.end = function(chunk?: unknown, ...args: unknown[]) {
      if (chunk) {
        responseBody = typeof chunk === 'string' ? chunk : chunk.toString();
      }

      // Only cache successful responses
      if (res.statusCode === 200 && responseBody) {
        const contentType = res.getHeader('Content-Type') as string || 'application/json';
        const entry = responseCache.set(cacheKey, responseBody, contentType);
        res.setHeader('ETag', `"${entry.etag}"`);
        res.setHeader('X-Cache', 'MISS');
      }

      return originalEnd.apply(res, [chunk, ...args] as Parameters<typeof res.end>);
    } as typeof res.end;

    return handler(req, res, params, body);
  };
}

/**
 * Invalidate cache entries after mutation operations
 */
function invalidateCacheForMutation(patterns: (string | RegExp)[]): void {
  for (const pattern of patterns) {
    responseCache.invalidate(pattern);
  }
}

// ============================================================================
// API ROUTES
// ============================================================================

// Health check
route('GET', '/api/health', async (_req, res) => {
  sendJson(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cache: responseCache.getStats()
  });
}, { cacheable: false });

// Get all tasks
route('GET', '/api/tasks', async (_req, res) => {
  try {
    const tasks = await taskManager.getTasksByProject();
    sendJson(res, { tasks, count: tasks.length });
  } catch (error: any) {
    sendError(res, error.message);
  }
}, { cacheable: true, cacheInvalidationPatterns: [/^\/api\/tasks/] });

// Create task
route('POST', '/api/tasks', async (_req, res, _params, body) => {
  try {
    const task = await taskManager.createTask(body as any);
    // Invalidate task-related caches
    invalidateCacheForMutation([/^\/api\/tasks/]);
    sendJson(res, task, 201);
  } catch (error: any) {
    sendError(res, error.message);
  }
}, { cacheable: false });

// Get single task
route('GET', '/api/tasks/:id', async (_req, res, params) => {
  try {
    const task = await taskManager.getTask(undefined, params.id);
    if (!task) {
      sendError(res, 'Task not found', 404);
      return;
    }
    sendJson(res, task);
  } catch (error: any) {
    sendError(res, error.message);
  }
}, { cacheable: true });

// Update task
route('PATCH', '/api/tasks/:id', async (_req, res, params, body) => {
  try {
    const task = await taskManager.updateTask(undefined, params.id, body as any);
    // Invalidate task-related caches
    invalidateCacheForMutation([/^\/api\/tasks/]);
    sendJson(res, task);
  } catch (error: any) {
    sendError(res, error.message);
  }
}, { cacheable: false });

// Delete task
route('DELETE', '/api/tasks/:id', async (_req, res, params) => {
  try {
    await taskManager.deleteTask(undefined, params.id);
    // Invalidate task-related caches
    invalidateCacheForMutation([/^\/api\/tasks/]);
    sendJson(res, { deleted: true });
  } catch (error: any) {
    sendError(res, error.message);
  }
}, { cacheable: false });

// Get agents
route('GET', '/api/agents', async (_req, res) => {
  try {
    const agents = projectTracker.getAgents();
    sendJson(res, { agents, count: agents.length });
  } catch (error: any) {
    sendError(res, error.message);
  }
}, { cacheable: true, cacheInvalidationPatterns: [/^\/api\/agents/] });

// Get pending approvals
route('GET', '/api/approvals', async (_req, res) => {
  try {
    const approvals = await supervisor.getPendingApprovals();
    sendJson(res, { approvals, count: approvals.length });
  } catch (error: any) {
    sendError(res, error.message);
  }
}, { cacheable: true, cacheInvalidationPatterns: [/^\/api\/approvals/] });

// Get audit events
route('GET', '/api/audit', async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const events = supervisor.getAuditEvents({ limit });
    sendJson(res, { events, count: events.length });
  } catch (error: any) {
    sendError(res, error.message);
  }
}, { cacheable: true });

// Get monitored apps
route('GET', '/api/apps', async (_req, res) => {
  try {
    const apps = supervisor.getAllMonitoredApps();
    sendJson(res, { apps, count: apps.length });
  } catch (error: any) {
    sendError(res, error.message);
  }
}, { cacheable: true, cacheInvalidationPatterns: [/^\/api\/apps/] });

// Get app health
route('GET', '/api/apps/:id/health', async (_req, res, params) => {
  try {
    const health = await supervisor.checkAppHealth(params.id);
    sendJson(res, health);
  } catch (error: any) {
    sendError(res, error.message);
  }
}, { cacheable: true });

// Get cache stats
route('GET', '/api/cache/stats', async (_req, res) => {
  sendJson(res, responseCache.getStats());
}, { cacheable: false });

// Clear cache (for admin)
route('POST', '/api/cache/clear', async (_req, res) => {
  responseCache.invalidateAll();
  sendJson(res, { cleared: true, timestamp: new Date().toISOString() });
}, { cacheable: false });

// ============================================================================
// REQUEST HANDLER
// ============================================================================

/**
 * Check authentication if token is configured
 */
function checkAuth(req: http.IncomingMessage): boolean {
  if (!dashboardConfig.authToken) {
    return true; // No auth required if token not configured
  }
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return false;
  }
  const [type, token] = authHeader.split(' ');
  return type === 'Bearer' && token === dashboardConfig.authToken;
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  // CORS headers (using config)
  res.setHeader('Access-Control-Allow-Origin', dashboardConfig.corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, If-None-Match');
  res.setHeader('Access-Control-Expose-Headers', 'ETag, X-Cache');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // Authentication check (skip for health endpoint and dashboard HTML)
  const isPublicPath = url.pathname === '/api/health' || url.pathname === '/' || url.pathname === '/index.html';
  if (!isPublicPath && !checkAuth(req)) {
    sendError(res, 'Unauthorized', 401);
    return;
  }
  const method = req.method as HttpMethod;

  // Find matching route
  for (const r of routes) {
    if (r.method !== method) continue;

    const match = url.pathname.match(r.pattern);
    if (!match) continue;

    // Extract params
    const params: Record<string, string> = {};
    r.paramNames.forEach((name, i) => {
      params[name] = match[i + 1];
    });

    // Parse body for mutation methods
    let body: unknown;
    if (['POST', 'PATCH', 'PUT'].includes(method)) {
      try {
        body = await parseBody(req);
      } catch (error) {
        sendError(res, 'Invalid JSON body', 400);
        return;
      }
    }

    // Execute handler with cache wrapper
    const wrappedHandler = withCache(r.handler, r.cacheable);
    await wrappedHandler(req, res, params, body);
    return;
  }

  // Serve dashboard HTML for root
  if (url.pathname === '/' || url.pathname === '/index.html') {
    serveDashboardHtml(res);
    return;
  }

  // 404 for unknown routes
  sendError(res, 'Not found', 404);
}

// ============================================================================
// DASHBOARD HTML
// ============================================================================

function serveDashboardHtml(res: http.ServerResponse): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Supervisor Dashboard</title>
  <style>
    /* ============================================
       CSS VARIABLES FOR THEMING (#21, #75)
       ============================================ */
    :root {
      /* Light theme (default) */
      --bg-color: #f5f5f5;
      --bg-color-secondary: #ffffff;
      --text-color: #333333;
      --text-color-secondary: #666666;
      --text-color-muted: #888888;
      --border-color: #eeeeee;
      --shadow-color: rgba(0, 0, 0, 0.1);
      --focus-ring-color: #3b82f6;
      --link-color: #2563eb;
      --link-hover-color: #1d4ed8;

      /* Status colors */
      --color-success: #22c55e;
      --color-success-bg: #dcfce7;
      --color-success-text: #166534;
      --color-warning: #f59e0b;
      --color-warning-bg: #fef3c7;
      --color-warning-text: #92400e;
      --color-danger: #ef4444;
      --color-danger-bg: #fee2e2;
      --color-danger-text: #991b1b;
      --color-info: #3b82f6;
      --color-info-bg: #dbeafe;
      --color-info-text: #1e40af;

      /* Spacing */
      --spacing-xs: 4px;
      --spacing-sm: 8px;
      --spacing-md: 12px;
      --spacing-lg: 20px;
      --spacing-xl: 32px;

      /* Border radius */
      --radius-sm: 4px;
      --radius-md: 8px;
      --radius-lg: 12px;

      /* Typography */
      --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      --font-size-sm: 12px;
      --font-size-base: 14px;
      --font-size-lg: 16px;
      --font-size-xl: 20px;
      --font-size-2xl: 32px;

      /* Transitions */
      --transition-fast: 150ms ease;
      --transition-normal: 250ms ease;
    }

    /* Dark theme */
    [data-theme="dark"] {
      --bg-color: #1a1a2e;
      --bg-color-secondary: #16213e;
      --text-color: #eaeaea;
      --text-color-secondary: #b0b0b0;
      --text-color-muted: #888888;
      --border-color: #2d2d44;
      --shadow-color: rgba(0, 0, 0, 0.3);
      --focus-ring-color: #60a5fa;
      --link-color: #60a5fa;
      --link-hover-color: #93c5fd;

      /* Dark theme status colors with better contrast */
      --color-success-bg: #166534;
      --color-success-text: #dcfce7;
      --color-warning-bg: #92400e;
      --color-warning-text: #fef3c7;
      --color-danger-bg: #991b1b;
      --color-danger-text: #fee2e2;
      --color-info-bg: #1e40af;
      --color-info-text: #dbeafe;
    }

    /* ============================================
       BASE STYLES
       ============================================ */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      font-family: var(--font-family);
      font-size: var(--font-size-base);
      line-height: 1.5;
      background: var(--bg-color);
      color: var(--text-color);
      transition: background-color var(--transition-normal), color var(--transition-normal);
    }

    /* ============================================
       ACCESSIBILITY: Skip to Content Link (#75)
       ============================================ */
    .skip-to-content {
      position: absolute;
      top: -40px;
      left: 0;
      background: var(--focus-ring-color);
      color: white;
      padding: var(--spacing-sm) var(--spacing-md);
      z-index: 1000;
      text-decoration: none;
      font-weight: 500;
      border-radius: 0 0 var(--radius-sm) 0;
      transition: top var(--transition-fast);
    }

    .skip-to-content:focus {
      top: 0;
      outline: none;
    }

    /* ============================================
       ACCESSIBILITY: Focus Indicators (#75)
       ============================================ */
    *:focus {
      outline: 2px solid var(--focus-ring-color);
      outline-offset: 2px;
    }

    *:focus:not(:focus-visible) {
      outline: none;
    }

    *:focus-visible {
      outline: 2px solid var(--focus-ring-color);
      outline-offset: 2px;
    }

    /* ============================================
       LAYOUT
       ============================================ */
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: var(--spacing-lg);
    }

    /* ============================================
       HEADER
       ============================================ */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-lg);
    }

    h1 {
      color: var(--text-color);
      font-size: var(--font-size-xl);
      font-weight: 600;
    }

    /* ============================================
       THEME TOGGLE (#21)
       ============================================ */
    .theme-toggle {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .theme-toggle-btn {
      background: var(--bg-color-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: var(--spacing-sm) var(--spacing-md);
      color: var(--text-color);
      font-family: inherit;
      font-size: var(--font-size-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      transition: background-color var(--transition-fast), border-color var(--transition-fast);
    }

    .theme-toggle-btn:hover {
      background: var(--border-color);
    }

    .theme-icon {
      width: 16px;
      height: 16px;
    }

    /* ============================================
       CARDS
       ============================================ */
    .card {
      background: var(--bg-color-secondary);
      border-radius: var(--radius-md);
      padding: var(--spacing-lg);
      margin-bottom: var(--spacing-lg);
      box-shadow: 0 2px 4px var(--shadow-color);
      transition: background-color var(--transition-normal), box-shadow var(--transition-normal);
    }

    .card h2 {
      color: var(--text-color-secondary);
      font-size: var(--font-size-sm);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: var(--spacing-sm);
      font-weight: 500;
    }

    .stat {
      font-size: var(--font-size-2xl);
      font-weight: bold;
      color: var(--text-color);
    }

    /* ============================================
       GRID LAYOUT (Responsive) (#75)
       ============================================ */
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--spacing-lg);
    }

    /* Tablet breakpoint */
    @media (max-width: 992px) {
      .grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    /* Mobile breakpoint */
    @media (max-width: 576px) {
      .container {
        padding: var(--spacing-md);
      }

      .grid {
        grid-template-columns: 1fr;
      }

      h1 {
        font-size: var(--font-size-lg);
      }

      .header {
        flex-direction: column;
        align-items: flex-start;
      }

      .stat {
        font-size: 24px;
      }

      .card {
        padding: var(--spacing-md);
      }
    }

    /* ============================================
       STATUS COLORS
       ============================================ */
    .status-healthy { color: var(--color-success); }
    .status-warning { color: var(--color-warning); }
    .status-error { color: var(--color-danger); }

    /* ============================================
       TABLES (Responsive) (#75)
       ============================================ */
    .table-container {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 500px;
    }

    th, td {
      text-align: left;
      padding: var(--spacing-md);
      border-bottom: 1px solid var(--border-color);
    }

    th {
      color: var(--text-color-secondary);
      font-weight: 500;
      font-size: var(--font-size-sm);
    }

    td {
      color: var(--text-color);
    }

    tr:hover td {
      background: var(--bg-color);
    }

    /* Mobile table adjustments */
    @media (max-width: 576px) {
      th, td {
        padding: var(--spacing-sm);
        font-size: var(--font-size-sm);
      }

      table {
        min-width: 400px;
      }
    }

    /* ============================================
       BADGES
       ============================================ */
    .badge {
      display: inline-block;
      padding: var(--spacing-xs) var(--spacing-sm);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-sm);
      font-weight: 500;
      white-space: nowrap;
    }

    .badge-success {
      background: var(--color-success-bg);
      color: var(--color-success-text);
    }

    .badge-warning {
      background: var(--color-warning-bg);
      color: var(--color-warning-text);
    }

    .badge-danger {
      background: var(--color-danger-bg);
      color: var(--color-danger-text);
    }

    .badge-info {
      background: var(--color-info-bg);
      color: var(--color-info-text);
    }

    /* ============================================
       LOADING STATE
       ============================================ */
    .loading {
      color: var(--text-color-muted);
      font-style: italic;
    }

    /* ============================================
       SCREEN READER ONLY (#75)
       ============================================ */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* ============================================
       REDUCED MOTION (#75)
       ============================================ */
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  </style>
</head>
<body>
  <!-- Skip to content link for accessibility (#75) -->
  <a href="#main-content" class="skip-to-content">Skip to main content</a>

  <div class="container">
    <header class="header" role="banner">
      <h1>Agent Supervisor Dashboard</h1>
      <div class="theme-toggle">
        <button
          type="button"
          class="theme-toggle-btn"
          id="theme-toggle"
          aria-label="Toggle dark mode"
          title="Toggle dark/light theme"
        >
          <svg class="theme-icon" id="theme-icon-light" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
          </svg>
          <svg class="theme-icon" id="theme-icon-dark" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="display: none;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
          </svg>
          <span id="theme-label">Dark</span>
        </button>
      </div>
    </header>

    <main id="main-content" role="main">
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" class="sr-only">Dashboard Statistics</h2>
        <div class="grid" role="list">
          <article class="card" role="listitem" aria-labelledby="agents-label">
            <h2 id="agents-label">Active Agents</h2>
            <div class="stat" id="agent-count" aria-live="polite">-</div>
          </article>
          <article class="card" role="listitem" aria-labelledby="approvals-label">
            <h2 id="approvals-label">Pending Approvals</h2>
            <div class="stat" id="approval-count" aria-live="polite">-</div>
          </article>
          <article class="card" role="listitem" aria-labelledby="tasks-label">
            <h2 id="tasks-label">Open Tasks</h2>
            <div class="stat" id="task-count" aria-live="polite">-</div>
          </article>
          <article class="card" role="listitem" aria-labelledby="apps-label">
            <h2 id="apps-label">Monitored Apps</h2>
            <div class="stat" id="app-count" aria-live="polite">-</div>
          </article>
        </div>
      </section>

      <section class="card" aria-labelledby="recent-tasks-heading">
        <h2 id="recent-tasks-heading">Recent Tasks</h2>
        <div class="table-container">
          <table role="table" aria-labelledby="recent-tasks-heading">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Priority</th>
              </tr>
            </thead>
            <tbody id="tasks-table">
              <tr><td colspan="4" class="loading">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card" aria-labelledby="audit-events-heading">
        <h2 id="audit-events-heading">Recent Audit Events</h2>
        <div class="table-container">
          <table role="table" aria-labelledby="audit-events-heading">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Action</th>
                <th scope="col">Type</th>
                <th scope="col">Outcome</th>
              </tr>
            </thead>
            <tbody id="audit-table">
              <tr><td colspan="4" class="loading">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>

  <script>
    // =============================================
    // Theme Management (#21)
    // =============================================
    const ThemeManager = {
      STORAGE_KEY: 'agent-supervisor-theme',
      THEMES: { LIGHT: 'light', DARK: 'dark' },

      init() {
        // Check localStorage first, then system preference
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          this.setTheme(stored);
        } else {
          // Respect prefers-color-scheme
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          this.setTheme(prefersDark ? this.THEMES.DARK : this.THEMES.LIGHT);
        }

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          // Only auto-switch if user hasn't set a preference
          if (!localStorage.getItem(this.STORAGE_KEY)) {
            this.setTheme(e.matches ? this.THEMES.DARK : this.THEMES.LIGHT);
          }
        });

        // Set up toggle button
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn) {
          toggleBtn.addEventListener('click', () => this.toggle());
        }
      },

      setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.updateToggleUI(theme);
      },

      updateToggleUI(theme) {
        const lightIcon = document.getElementById('theme-icon-light');
        const darkIcon = document.getElementById('theme-icon-dark');
        const label = document.getElementById('theme-label');
        const btn = document.getElementById('theme-toggle');

        if (theme === this.THEMES.DARK) {
          if (lightIcon) lightIcon.style.display = 'none';
          if (darkIcon) darkIcon.style.display = 'block';
          if (label) label.textContent = 'Light';
          if (btn) btn.setAttribute('aria-pressed', 'true');
        } else {
          if (lightIcon) lightIcon.style.display = 'block';
          if (darkIcon) darkIcon.style.display = 'none';
          if (label) label.textContent = 'Dark';
          if (btn) btn.setAttribute('aria-pressed', 'false');
        }
      },

      toggle() {
        const current = document.documentElement.getAttribute('data-theme') || this.THEMES.LIGHT;
        const next = current === this.THEMES.DARK ? this.THEMES.LIGHT : this.THEMES.DARK;
        this.setTheme(next);
        localStorage.setItem(this.STORAGE_KEY, next);
      },

      getTheme() {
        return document.documentElement.getAttribute('data-theme') || this.THEMES.LIGHT;
      }
    };

    // Initialize theme on page load
    ThemeManager.init();

    // =============================================
    // Data Fetching
    // =============================================
    async function fetchData() {
      try {
        const [agents, approvals, tasks, apps, audit] = await Promise.all([
          fetch('/api/agents').then(r => r.json()),
          fetch('/api/approvals').then(r => r.json()),
          fetch('/api/tasks').then(r => r.json()),
          fetch('/api/apps').then(r => r.json()),
          fetch('/api/audit?limit=10').then(r => r.json())
        ]);

        document.getElementById('agent-count').textContent = agents.count || 0;
        document.getElementById('approval-count').textContent = approvals.count || 0;
        document.getElementById('task-count').textContent = tasks.count || 0;
        document.getElementById('app-count').textContent = apps.count || 0;

        // Render tasks
        const tasksTbody = document.getElementById('tasks-table');
        if (tasks.tasks && tasks.tasks.length > 0) {
          tasksTbody.innerHTML = tasks.tasks.slice(0, 10).map(t => \`
            <tr>
              <td>#\${escapeHtml(String(t.id))}</td>
              <td>\${escapeHtml(t.title)}</td>
              <td><span class="badge badge-\${getStatusBadge(t.status)}" role="status">\${escapeHtml(t.status)}</span></td>
              <td><span class="badge badge-\${getPriorityBadge(t.priority)}">\${escapeHtml(t.priority)}</span></td>
            </tr>
          \`).join('');
        } else {
          tasksTbody.innerHTML = '<tr><td colspan="4">No tasks found</td></tr>';
        }

        // Render audit events
        const auditTbody = document.getElementById('audit-table');
        if (audit.events && audit.events.length > 0) {
          auditTbody.innerHTML = audit.events.map(e => \`
            <tr>
              <td>\${escapeHtml(new Date(e.timestamp).toLocaleString())}</td>
              <td>\${escapeHtml(e.action)}</td>
              <td>\${escapeHtml(e.eventType)}</td>
              <td><span class="badge badge-\${getOutcomeBadge(e.outcome)}" role="status">\${escapeHtml(e.outcome)}</span></td>
            </tr>
          \`).join('');
        } else {
          auditTbody.innerHTML = '<tr><td colspan="4">No events found</td></tr>';
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    }

    // =============================================
    // Utility Functions
    // =============================================
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function getStatusBadge(status) {
      const map = { completed: 'success', pending: 'info', in_progress: 'warning', blocked: 'danger' };
      return map[status] || 'info';
    }

    function getPriorityBadge(priority) {
      const map = { critical: 'danger', high: 'warning', medium: 'info', low: 'success' };
      return map[priority] || 'info';
    }

    function getOutcomeBadge(outcome) {
      const map = { success: 'success', failure: 'danger', pending: 'warning' };
      return map[outcome] || 'info';
    }

    // =============================================
    // Initialization
    // =============================================
    // Initial fetch
    fetchData();

    // Refresh every 10 seconds
    setInterval(fetchData, 10000);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-cache');
  res.statusCode = 200;
  res.end(html);
}

// ============================================================================
// WEBSOCKET SERVER
// ============================================================================

let wss: WebSocketServer | null = null;

function broadcastUpdate(data: unknown): void {
  if (!wss) return;

  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// ============================================================================
// SERVER LIFECYCLE
// ============================================================================

let server: http.Server | null = null;
let wsUpdateInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the dashboard server with optional port override.
 *
 * Uses externalized configuration from environment variables:
 * - DASHBOARD_PORT: Port (default: 3100)
 * - DASHBOARD_HOST: Host (default: localhost)
 * - DASHBOARD_AUTH_TOKEN: Optional auth token
 * - DASHBOARD_CORS_ORIGIN: CORS origin (default: *)
 * - DASHBOARD_CACHE_TTL: Cache TTL in ms (default: 5000)
 * - DASHBOARD_WS_INTERVAL: WebSocket interval in ms (default: 2000)
 *
 * @param port Optional port override (takes precedence over env var)
 */
export async function startDashboardServer(port?: number | string): Promise<http.Server> {
  // Validate configuration
  const validationErrors = validateDashboardConfig(dashboardConfig);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid dashboard configuration: ${validationErrors.join(', ')}`);
  }

  // Use provided port or fall back to config
  const portNum = port !== undefined
    ? (typeof port === 'string' ? parseInt(port) : port)
    : dashboardConfig.port;

  server = http.createServer(handleRequest);

  // Setup WebSocket server
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    // Send initial config to client
    ws.send(JSON.stringify({
      type: 'config',
      wsInterval: dashboardConfig.wsInterval
    }));

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  // Periodic broadcasts (using config interval)
  wsUpdateInterval = setInterval(async () => {
    try {
      const agents = projectTracker.getAgents();
      const approvals = await supervisor.getPendingApprovals();

      broadcastUpdate({
        type: 'update',
        timestamp: new Date().toISOString(),
        agents: agents.length,
        pendingApprovals: approvals.length
      });
    } catch {
      // Ignore broadcast errors
    }
  }, dashboardConfig.wsInterval);

  return new Promise((resolve, reject) => {
    server!.on('error', reject);
    server!.listen(portNum, dashboardConfig.host, () => {
      console.log(`Dashboard server listening on http://${dashboardConfig.host}:${portNum}`);
      console.log(`WebSocket endpoint: ws://${dashboardConfig.host}:${portNum}`);
      console.log(`Configuration: cacheTtl=${dashboardConfig.cacheTtl}ms, wsInterval=${dashboardConfig.wsInterval}ms`);
      if (dashboardConfig.authToken) {
        console.log('Authentication: enabled (Bearer token required)');
      } else {
        console.log('Authentication: disabled');
      }
      resolve(server!);
    });
  });
}

export function stopDashboardServer(): Promise<void> {
  return new Promise((resolve) => {
    // Clear WebSocket update interval
    if (wsUpdateInterval) {
      clearInterval(wsUpdateInterval);
      wsUpdateInterval = null;
    }

    responseCache.destroy();

    if (wss) {
      wss.close();
      wss = null;
    }

    if (server) {
      server.close(() => {
        server = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * Get current dashboard configuration
 */
export function getDashboardConfig(): DashboardConfig {
  return { ...dashboardConfig };
}

// Export cache for testing
export { responseCache };
