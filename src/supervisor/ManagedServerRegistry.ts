/**
 * Managed Server Registry
 *
 * Allows registering servers (ip + sourceDir) and checking online status.
 * Features:
 * - Connection pooling for TCP checks (reuse connections, timeout limits)
 * - Caching for health check results (short TTL for success, no cache for failures)
 * - Rate limiting with exponential backoff for repeated failures
 */

import { promises as fsp } from 'fs';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { v4 as uuidv4 } from 'uuid';

export interface ManagedServer {
  id: string;
  ip: string;
  sourceDir: string;
  name?: string;
  port?: number;
  createdAt: string;
}

export interface ServerStatus {
  id?: string;
  ip: string;
  online: boolean;
  ports: Record<number, boolean>;
  sourceDir: string;
  sourceDirExists: boolean;
  checkedAt: string;
  /** Whether result came from cache */
  cached?: boolean;
  /** Cache age in milliseconds if cached */
  cacheAgeMs?: number;
}

/**
 * Configuration for connection pooling
 */
export interface ConnectionPoolConfig {
  /** Maximum connections per host:port combination (default: 5) */
  maxConnectionsPerEndpoint?: number;
  /** Connection idle timeout in ms before cleanup (default: 30000) */
  connectionIdleTimeoutMs?: number;
  /** Maximum connection age in ms before forced cleanup (default: 60000) */
  maxConnectionAgeMs?: number;
  /** Interval to run cleanup of stale connections (default: 10000) */
  cleanupIntervalMs?: number;
}

/**
 * Configuration for health check caching
 */
export interface CacheConfig {
  /** TTL for successful checks in ms (default: 5000) */
  successTtlMs?: number;
  /** Whether to cache failures - generally should be false (default: false) */
  cacheFailures?: boolean;
  /** TTL for failed checks if cacheFailures is true (default: 1000) */
  failureTtlMs?: number;
  /** Maximum cache entries before LRU eviction (default: 1000) */
  maxEntries?: number;
}

/**
 * Configuration for rate limiting
 */
export interface RateLimitConfig {
  /** Initial delay after first failure in ms (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay between retries in ms (default: 60000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Number of consecutive failures before rate limiting kicks in (default: 3) */
  failureThreshold?: number;
  /** Time window to track failures in ms (default: 60000) */
  failureWindowMs?: number;
}

/**
 * Pooled connection wrapper
 */
interface PooledConnection {
  socket: net.Socket;
  host: string;
  port: number;
  createdAt: number;
  lastUsedAt: number;
  inUse: boolean;
}

/**
 * Cache entry for health check results
 */
interface CacheEntry {
  result: boolean;
  timestamp: number;
  accessCount: number;
  lastAccessedAt: number;
}

/**
 * Rate limit state for an endpoint
 */
interface RateLimitState {
  consecutiveFailures: number;
  lastFailureAt: number;
  currentDelayMs: number;
  blockedUntil: number;
}

/**
 * TCP Connection Pool
 * Manages reusable TCP connections with automatic cleanup
 */
class TCPConnectionPool {
  private pools: Map<string, PooledConnection[]> = new Map();
  private config: Required<ConnectionPoolConfig>;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: ConnectionPoolConfig = {}) {
    this.config = {
      maxConnectionsPerEndpoint: config.maxConnectionsPerEndpoint ?? 5,
      connectionIdleTimeoutMs: config.connectionIdleTimeoutMs ?? 30000,
      maxConnectionAgeMs: config.maxConnectionAgeMs ?? 60000,
      cleanupIntervalMs: config.cleanupIntervalMs ?? 10000
    };
    this.startCleanupTimer();
  }

  private getKey(host: string, port: number): string {
    return `${host}:${port}`;
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleConnections();
    }, this.config.cleanupIntervalMs);
    // Don't block process exit
    this.cleanupTimer.unref();
  }

  /**
   * Clean up stale and idle connections
   */
  cleanupStaleConnections(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, connections] of this.pools.entries()) {
      const validConnections: PooledConnection[] = [];

      for (const conn of connections) {
        const age = now - conn.createdAt;
        const idle = now - conn.lastUsedAt;

        // Remove if too old, too idle, or in error state
        if (
          age > this.config.maxConnectionAgeMs ||
          idle > this.config.connectionIdleTimeoutMs ||
          conn.socket.destroyed
        ) {
          this.destroyConnection(conn);
          cleaned++;
        } else if (!conn.inUse) {
          validConnections.push(conn);
        } else {
          validConnections.push(conn);
        }
      }

      if (validConnections.length === 0) {
        this.pools.delete(key);
      } else {
        this.pools.set(key, validConnections);
      }
    }

    return cleaned;
  }

  private destroyConnection(conn: PooledConnection): void {
    try {
      if (!conn.socket.destroyed) {
        conn.socket.destroy();
      }
    } catch {
      // Ignore destruction errors
    }
  }

  /**
   * Get or create a connection to the specified endpoint
   */
  async getConnection(host: string, port: number, timeoutMs: number): Promise<{ socket: net.Socket; reused: boolean }> {
    const key = this.getKey(host, port);
    const pool = this.pools.get(key) || [];

    // Try to find an available connection
    for (const conn of pool) {
      if (!conn.inUse && !conn.socket.destroyed) {
        conn.inUse = true;
        conn.lastUsedAt = Date.now();
        return { socket: conn.socket, reused: true };
      }
    }

    // Create new connection if under limit
    if (pool.length < this.config.maxConnectionsPerEndpoint) {
      const socket = await this.createConnection(host, port, timeoutMs);
      const conn: PooledConnection = {
        socket,
        host,
        port,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        inUse: true
      };
      pool.push(conn);
      this.pools.set(key, pool);
      return { socket, reused: false };
    }

    // All connections in use, create a temporary one (won't be pooled)
    const socket = await this.createConnection(host, port, timeoutMs);
    return { socket, reused: false };
  }

  private createConnection(host: string, port: number, timeoutMs: number): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let settled = false;

      const settle = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (error) {
          try { socket.destroy(); } catch { /* noop */ }
          reject(error);
        } else {
          resolve(socket);
        }
      };

      socket.setTimeout(timeoutMs);
      socket.once('connect', () => settle());
      socket.once('timeout', () => settle(new Error('Connection timeout')));
      socket.once('error', (err) => settle(err));

      try {
        socket.connect(port, host);
      } catch (err) {
        settle(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(host: string, port: number, socket: net.Socket, keepAlive: boolean = true): void {
    const key = this.getKey(host, port);
    const pool = this.pools.get(key);

    if (!pool) {
      // Connection wasn't pooled, destroy it
      try { socket.destroy(); } catch { /* noop */ }
      return;
    }

    const conn = pool.find(c => c.socket === socket);
    if (conn) {
      conn.inUse = false;
      conn.lastUsedAt = Date.now();

      if (!keepAlive || socket.destroyed) {
        // Remove from pool and destroy
        const idx = pool.indexOf(conn);
        if (idx !== -1) pool.splice(idx, 1);
        this.destroyConnection(conn);
      }
    } else {
      // Not a pooled connection, destroy it
      try { socket.destroy(); } catch { /* noop */ }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): { totalConnections: number; activeConnections: number; endpoints: number } {
    let total = 0;
    let active = 0;

    for (const pool of this.pools.values()) {
      total += pool.length;
      active += pool.filter(c => c.inUse).length;
    }

    return {
      totalConnections: total,
      activeConnections: active,
      endpoints: this.pools.size
    };
  }

  /**
   * Destroy all connections and stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    for (const pool of this.pools.values()) {
      for (const conn of pool) {
        this.destroyConnection(conn);
      }
    }
    this.pools.clear();
  }
}

/**
 * Health Check Cache
 * Caches successful TCP check results with LRU eviction
 */
class HealthCheckCache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: Required<CacheConfig>;

  constructor(config: CacheConfig = {}) {
    this.config = {
      successTtlMs: config.successTtlMs ?? 5000,
      cacheFailures: config.cacheFailures ?? false,
      failureTtlMs: config.failureTtlMs ?? 1000,
      maxEntries: config.maxEntries ?? 1000
    };
  }

  private getKey(host: string, port: number): string {
    return `${host}:${port}`;
  }

  /**
   * Get cached result if valid
   */
  get(host: string, port: number): { result: boolean; ageMs: number } | null {
    const key = this.getKey(host, port);
    const entry = this.cache.get(key);

    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;
    const ttl = entry.result ? this.config.successTtlMs : this.config.failureTtlMs;

    if (age > ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update access tracking for LRU
    entry.accessCount++;
    entry.lastAccessedAt = now;

    return { result: entry.result, ageMs: age };
  }

  /**
   * Store a result in cache
   */
  set(host: string, port: number, result: boolean): void {
    // Don't cache failures unless configured to
    if (!result && !this.config.cacheFailures) {
      return;
    }

    // Enforce max entries with LRU eviction
    if (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    const key = this.getKey(host, port);
    const now = Date.now();

    this.cache.set(key, {
      result,
      timestamp: now,
      accessCount: 1,
      lastAccessedAt: now
    });
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    // Evict 10% of entries
    const toEvict = Math.ceil(this.config.maxEntries * 0.1);
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);

    for (let i = 0; i < toEvict && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Invalidate cache for a specific endpoint
   */
  invalidate(host: string, port: number): boolean {
    return this.cache.delete(this.getKey(host, port));
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { entries: number; hitRate?: number } {
    let totalAccesses = 0;
    for (const entry of this.cache.values()) {
      totalAccesses += entry.accessCount;
    }

    return {
      entries: this.cache.size,
      hitRate: this.cache.size > 0 ? totalAccesses / this.cache.size : undefined
    };
  }
}

/**
 * Rate Limiter with Exponential Backoff
 * Prevents hammering unhealthy servers
 */
class TCPRateLimiter {
  private states: Map<string, RateLimitState> = new Map();
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig = {}) {
    this.config = {
      initialDelayMs: config.initialDelayMs ?? 1000,
      maxDelayMs: config.maxDelayMs ?? 60000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      failureThreshold: config.failureThreshold ?? 3,
      failureWindowMs: config.failureWindowMs ?? 60000
    };
  }

  private getKey(host: string, port: number): string {
    return `${host}:${port}`;
  }

  /**
   * Check if an endpoint is currently rate limited
   * Returns remaining wait time in ms, or 0 if not limited
   */
  isRateLimited(host: string, port: number): number {
    const key = this.getKey(host, port);
    const state = this.states.get(key);

    if (!state) return 0;

    const now = Date.now();

    // Reset if outside failure window
    if (now - state.lastFailureAt > this.config.failureWindowMs) {
      this.states.delete(key);
      return 0;
    }

    // Check if still blocked
    if (now < state.blockedUntil) {
      return state.blockedUntil - now;
    }

    return 0;
  }

  /**
   * Record a successful check - resets failure tracking
   */
  recordSuccess(host: string, port: number): void {
    const key = this.getKey(host, port);
    this.states.delete(key);
  }

  /**
   * Record a failed check - may trigger rate limiting
   */
  recordFailure(host: string, port: number): void {
    const key = this.getKey(host, port);
    const now = Date.now();

    let state = this.states.get(key);

    if (!state) {
      state = {
        consecutiveFailures: 0,
        lastFailureAt: now,
        currentDelayMs: this.config.initialDelayMs,
        blockedUntil: 0
      };
      this.states.set(key, state);
    }

    // Reset if outside failure window
    if (now - state.lastFailureAt > this.config.failureWindowMs) {
      state.consecutiveFailures = 0;
      state.currentDelayMs = this.config.initialDelayMs;
    }

    state.consecutiveFailures++;
    state.lastFailureAt = now;

    // Apply rate limiting after threshold
    if (state.consecutiveFailures >= this.config.failureThreshold) {
      state.blockedUntil = now + state.currentDelayMs;

      // Exponential backoff for next failure
      state.currentDelayMs = Math.min(
        state.currentDelayMs * this.config.backoffMultiplier,
        this.config.maxDelayMs
      );
    }
  }

  /**
   * Get rate limit state for an endpoint
   */
  getState(host: string, port: number): RateLimitState | undefined {
    return this.states.get(this.getKey(host, port));
  }

  /**
   * Clear rate limiting for an endpoint
   */
  clear(host: string, port: number): boolean {
    return this.states.delete(this.getKey(host, port));
  }

  /**
   * Clear all rate limiting states
   */
  clearAll(): void {
    this.states.clear();
  }

  /**
   * Get statistics
   */
  getStats(): { trackedEndpoints: number; rateLimitedEndpoints: number } {
    const now = Date.now();
    let rateLimited = 0;

    for (const state of this.states.values()) {
      if (now < state.blockedUntil) {
        rateLimited++;
      }
    }

    return {
      trackedEndpoints: this.states.size,
      rateLimitedEndpoints: rateLimited
    };
  }
}

/**
 * Configuration for ManagedServerRegistry
 */
export interface ManagedServerRegistryConfig {
  /** Path to persist server list (default: ./managed-servers.json) */
  filePath?: string;
  /** Connection pool configuration */
  connectionPool?: ConnectionPoolConfig;
  /** Health check cache configuration */
  cache?: CacheConfig;
  /** Rate limiting configuration */
  rateLimit?: RateLimitConfig;
  /** Whether to use connection pooling (default: true) */
  enablePooling?: boolean;
  /** Whether to use caching (default: true) */
  enableCaching?: boolean;
  /** Whether to use rate limiting (default: true) */
  enableRateLimiting?: boolean;
}

export class ManagedServerRegistry {
  private filePath: string;
  private servers: Map<string, ManagedServer> = new Map();
  private loaded = false;

  // Connection pooling, caching, and rate limiting
  private connectionPool: TCPConnectionPool;
  private healthCache: HealthCheckCache;
  private rateLimiter: TCPRateLimiter;
  private enablePooling: boolean;
  private enableCaching: boolean;
  private enableRateLimiting: boolean;

  // Statistics tracking
  private stats = {
    totalChecks: 0,
    cacheHits: 0,
    cacheMisses: 0,
    pooledConnections: 0,
    newConnections: 0,
    rateLimitedChecks: 0
  };

  constructor(config: ManagedServerRegistryConfig = {}) {
    this.filePath = config.filePath || path.join(process.cwd(), 'managed-servers.json');

    // Initialize components with provided config or defaults
    this.connectionPool = new TCPConnectionPool(config.connectionPool);
    this.healthCache = new HealthCheckCache(config.cache);
    this.rateLimiter = new TCPRateLimiter(config.rateLimit);

    // Feature flags
    this.enablePooling = config.enablePooling ?? true;
    this.enableCaching = config.enableCaching ?? true;
    this.enableRateLimiting = config.enableRateLimiting ?? true;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const data = await fsp.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(data) as ManagedServer[];
      for (const s of parsed) this.servers.set(s.id, s);
    } catch (err) {
      // If file doesn't exist, start empty
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        // eslint-disable-next-line no-console
        console.error('Failed to load managed servers:', err);
      }
    } finally {
      this.loaded = true;
    }
  }

  private async persist(): Promise<void> {
    const list = Array.from(this.servers.values());
    await fsp.writeFile(this.filePath, JSON.stringify(list, null, 2), 'utf8');
  }

  async addServer(params: { ip: string; sourceDir: string; name?: string; port?: number }): Promise<ManagedServer> {
    await this.ensureLoaded();
    const server: ManagedServer = {
      id: uuidv4(),
      ip: params.ip,
      sourceDir: params.sourceDir,
      name: params.name,
      port: params.port,
      createdAt: new Date().toISOString()
    };
    this.servers.set(server.id, server);
    await this.persist();
    return server;
  }

  async removeServer(id: string): Promise<boolean> {
    await this.ensureLoaded();
    const removed = this.servers.delete(id);
    if (removed) await this.persist();
    return removed;
  }

  async listServers(): Promise<ManagedServer[]> {
    await this.ensureLoaded();
    return Array.from(this.servers.values());
  }

  async getServer(id: string): Promise<ManagedServer | undefined> {
    await this.ensureLoaded();
    return this.servers.get(id);
  }

  async checkStatus(input: { id?: string; ip?: string; sourceDir?: string; ports?: number[]; skipCache?: boolean }): Promise<ServerStatus> {
    await this.ensureLoaded();

    let ip = input.ip;
    let sourceDir = input.sourceDir;
    let id: string | undefined = input.id;

    if (input.id) {
      const found = this.servers.get(input.id);
      if (!found) {
        throw new Error(`Unknown managed server: ${input.id}`);
      }
      ip = found.ip;
      sourceDir = found.sourceDir;
      id = found.id;
    }

    if (!ip || !sourceDir) {
      throw new Error('Must provide either id or both ip and sourceDir');
    }

    // Use custom port if available, otherwise default to common ports
    let defaultPorts = [22, 80, 443];
    if (input.id) {
      const found = this.servers.get(input.id);
      if (found?.port) {
        defaultPorts = [found.port];
      }
    }
    const ports = input.ports && input.ports.length > 0 ? input.ports : defaultPorts;
    const byPort: Record<number, boolean> = {};
    let usedCache = false;
    let maxCacheAge = 0;

    // Try TCP connect to each port with short timeout
    await Promise.all(
      ports.map(async (port) => {
        const { result, cached, cacheAgeMs } = await this.tcpCheckWithFeatures(ip!, port, 1000, input.skipCache);
        byPort[port] = result;
        if (cached) {
          usedCache = true;
          maxCacheAge = Math.max(maxCacheAge, cacheAgeMs || 0);
        }
      })
    );

    const online = Object.values(byPort).some(Boolean);
    const sourceDirExists = fs.existsSync(sourceDir);

    return {
      id,
      ip,
      online,
      ports: byPort,
      sourceDir,
      sourceDirExists,
      checkedAt: new Date().toISOString(),
      cached: usedCache ? true : undefined,
      cacheAgeMs: usedCache ? maxCacheAge : undefined
    };
  }

  /**
   * TCP check with connection pooling, caching, and rate limiting
   */
  private async tcpCheckWithFeatures(
    host: string,
    port: number,
    timeoutMs: number,
    skipCache?: boolean
  ): Promise<{ result: boolean; cached: boolean; cacheAgeMs?: number }> {
    this.stats.totalChecks++;

    // Check cache first (unless skipped)
    if (this.enableCaching && !skipCache) {
      const cached = this.healthCache.get(host, port);
      if (cached !== null) {
        this.stats.cacheHits++;
        return { result: cached.result, cached: true, cacheAgeMs: cached.ageMs };
      }
      this.stats.cacheMisses++;
    }

    // Check rate limiting
    if (this.enableRateLimiting) {
      const waitTime = this.rateLimiter.isRateLimited(host, port);
      if (waitTime > 0) {
        this.stats.rateLimitedChecks++;
        // Return false immediately for rate-limited endpoints
        // Don't cache this - it's not a real check result
        return { result: false, cached: false };
      }
    }

    // Perform actual TCP check
    let result: boolean;

    if (this.enablePooling) {
      result = await this.tcpCheckPooled(host, port, timeoutMs);
    } else {
      result = await this.tcpCheckDirect(host, port, timeoutMs);
    }

    // Update rate limiter
    if (this.enableRateLimiting) {
      if (result) {
        this.rateLimiter.recordSuccess(host, port);
      } else {
        this.rateLimiter.recordFailure(host, port);
      }
    }

    // Cache the result
    if (this.enableCaching) {
      this.healthCache.set(host, port, result);
    }

    return { result, cached: false };
  }

  /**
   * TCP check using connection pool
   */
  private async tcpCheckPooled(host: string, port: number, timeoutMs: number): Promise<boolean> {
    try {
      const { socket, reused } = await this.connectionPool.getConnection(host, port, timeoutMs);

      if (reused) {
        this.stats.pooledConnections++;
      } else {
        this.stats.newConnections++;
      }

      // For health check, we just need to verify connection works
      // Release connection back to pool (keep alive for reuse)
      this.connectionPool.releaseConnection(host, port, socket, true);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Direct TCP check without pooling (original implementation)
   */
  private tcpCheckDirect(host: string, port: number, timeoutMs: number): Promise<boolean> {
    this.stats.newConnections++;
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let done = false;

      const finalize = (result: boolean) => {
        if (done) return;
        done = true;
        try { socket.destroy(); } catch { /* noop */ }
        resolve(result);
      };

      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finalize(true));
      socket.once('timeout', () => finalize(false));
      socket.once('error', () => finalize(false));
      // Some hosts may refuse connection quickly - still indicates reachability
      socket.once('close', (hadError) => finalize(!hadError));

      try {
        socket.connect(port, host);
      } catch {
        finalize(false);
      }
    });
  }

  /**
   * Get comprehensive statistics about TCP checks
   */
  getCheckStats(): {
    totalChecks: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    pooledConnections: number;
    newConnections: number;
    poolReuseRate: number;
    rateLimitedChecks: number;
    pool: { totalConnections: number; activeConnections: number; endpoints: number };
    cache: { entries: number; hitRate?: number };
    rateLimit: { trackedEndpoints: number; rateLimitedEndpoints: number };
  } {
    const totalConnections = this.stats.pooledConnections + this.stats.newConnections;

    return {
      ...this.stats,
      cacheHitRate: this.stats.totalChecks > 0
        ? this.stats.cacheHits / this.stats.totalChecks
        : 0,
      poolReuseRate: totalConnections > 0
        ? this.stats.pooledConnections / totalConnections
        : 0,
      pool: this.connectionPool.getStats(),
      cache: this.healthCache.getStats(),
      rateLimit: this.rateLimiter.getStats()
    };
  }

  /**
   * Invalidate cache for a specific endpoint
   */
  invalidateCache(host: string, port: number): boolean {
    return this.healthCache.invalidate(host, port);
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.healthCache.clear();
  }

  /**
   * Clear rate limiting for an endpoint
   */
  clearRateLimit(host: string, port: number): boolean {
    return this.rateLimiter.clear(host, port);
  }

  /**
   * Clear all rate limiting
   */
  clearAllRateLimits(): void {
    this.rateLimiter.clearAll();
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.stats = {
      totalChecks: 0,
      cacheHits: 0,
      cacheMisses: 0,
      pooledConnections: 0,
      newConnections: 0,
      rateLimitedChecks: 0
    };
  }

  /**
   * Clean up resources (connection pool, timers)
   */
  destroy(): void {
    this.connectionPool.destroy();
    this.healthCache.clear();
    this.rateLimiter.clearAll();
  }
}

// Singleton default registry
export const managedServerRegistry = new ManagedServerRegistry();

