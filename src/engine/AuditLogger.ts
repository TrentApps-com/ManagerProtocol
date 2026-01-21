/**
 * Enterprise Agent Supervisor - Audit Logger
 *
 * Comprehensive audit logging for compliance, security, and operational visibility.
 *
 * Storage Strategy:
 * - Uses write-through caching: events are only added to memory after successful DB write
 * - Failed writes are queued for retry
 * - Periodic sync checks ensure memory/DB consistency
 *
 * Query System (Task #49):
 * - QueryBuilder provides fluent API for complex queries
 * - Supports cursor-based pagination for large result sets
 * - Aggregation queries for analytics and dashboards
 * - Full-text search in metadata and details JSON fields
 */

import { v4 as uuidv4 } from 'uuid';
import { mkdirSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import type { AuditEvent, AuditEventType, RiskLevel } from '../types/index.js';
import { withRetry, WebhookDeliveryError, formatError } from '../utils/errors.js';
import { calculateGroupedCounts } from '../utils/shared.js';

// ============================================================================
// QUERY BUILDER TYPES (Task #49)
// ============================================================================

/**
 * Filter options for audit event queries
 */
export interface QueryFilter {
  eventType?: AuditEventType | AuditEventType[];
  agentId?: string | string[];
  sessionId?: string | string[];
  userId?: string | string[];
  outcome?: ('success' | 'failure' | 'pending') | ('success' | 'failure' | 'pending')[];
  riskLevel?: RiskLevel | RiskLevel[];
  since?: string | Date;
  until?: string | Date;
  correlationId?: string;
  action?: string; // Partial match on action field
  metadataSearch?: string; // Full-text search in metadata JSON
  detailsSearch?: string; // Full-text search in details JSON
}

/**
 * Pagination options for query results
 */
export interface PaginationOptions {
  limit?: number;
  cursor?: string; // Base64-encoded cursor for pagination
  offset?: number; // Alternative: offset-based pagination
}

/**
 * Paginated query result with metadata
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    totalCount: number;
    hasMore: boolean;
    nextCursor?: string;
    previousCursor?: string;
    limit: number;
    offset?: number;
  };
}

/**
 * Aggregation result for analytics
 */
export interface AggregationResult {
  byEventType: Record<string, number>;
  byOutcome: Record<string, number>;
  byRiskLevel: Record<string, number>;
  byAgent: Record<string, number>;
  byUser: Record<string, number>;
  timeSeries: TimeSeriesDataPoint[];
  total: number;
}

/**
 * Time series data point for charts
 */
export interface TimeSeriesDataPoint {
  timestamp: string; // ISO date string (truncated to interval)
  count: number;
  byOutcome?: Record<string, number>;
}

/**
 * Supported time series intervals
 */
export type TimeSeriesInterval = 'minute' | 'hour' | 'day' | 'week' | 'month';

/**
 * Internal cursor structure for pagination
 */
interface PaginationCursor {
  timestamp: string;
  eventId: string;
  direction: 'forward' | 'backward';
}

/**
 * QueryBuilder - Fluent API for building audit event queries
 *
 * Usage:
 * ```typescript
 * const results = await logger.query()
 *   .where('eventType', 'action_executed')
 *   .where('outcome', 'success')
 *   .since(new Date('2024-01-01'))
 *   .until(new Date('2024-12-31'))
 *   .orderBy('timestamp', 'desc')
 *   .limit(100)
 *   .execute();
 *
 * // With pagination
 * const page1 = await logger.query()
 *   .eventType('action_evaluated')
 *   .limit(50)
 *   .executePaginated();
 *
 * // Get next page
 * const page2 = await logger.query()
 *   .eventType('action_evaluated')
 *   .cursor(page1.pagination.nextCursor!)
 *   .limit(50)
 *   .executePaginated();
 *
 * // Aggregation
 * const stats = await logger.query()
 *   .since(new Date('2024-01-01'))
 *   .aggregate('day');
 * ```
 */
export class QueryBuilder {
  private filters: QueryFilter = {};
  private paginationOpts: PaginationOptions = {};
  private orderByField: string = 'timestamp';
  private orderDirection: 'asc' | 'desc' = 'desc';
  private logger: AuditLogger;

  constructor(logger: AuditLogger) {
    this.logger = logger;
  }

  /**
   * Add a filter condition
   */
  where<K extends keyof QueryFilter>(field: K, value: QueryFilter[K]): this {
    this.filters[field] = value;
    return this;
  }

  /**
   * Filter by event type(s)
   */
  eventType(type: AuditEventType | AuditEventType[]): this {
    this.filters.eventType = type;
    return this;
  }

  /**
   * Filter by agent ID(s)
   */
  agentId(id: string | string[]): this {
    this.filters.agentId = id;
    return this;
  }

  /**
   * Filter by session ID(s)
   */
  sessionId(id: string | string[]): this {
    this.filters.sessionId = id;
    return this;
  }

  /**
   * Filter by user ID(s)
   */
  userId(id: string | string[]): this {
    this.filters.userId = id;
    return this;
  }

  /**
   * Filter by outcome(s)
   */
  outcome(outcome: ('success' | 'failure' | 'pending') | ('success' | 'failure' | 'pending')[]): this {
    this.filters.outcome = outcome;
    return this;
  }

  /**
   * Filter by risk level(s)
   */
  riskLevel(level: RiskLevel | RiskLevel[]): this {
    this.filters.riskLevel = level;
    return this;
  }

  /**
   * Filter events after this date (inclusive)
   */
  since(date: string | Date): this {
    this.filters.since = date instanceof Date ? date.toISOString() : date;
    return this;
  }

  /**
   * Filter events before this date (inclusive)
   */
  until(date: string | Date): this {
    this.filters.until = date instanceof Date ? date.toISOString() : date;
    return this;
  }

  /**
   * Filter by correlation ID
   */
  correlatedWith(correlationId: string): this {
    this.filters.correlationId = correlationId;
    return this;
  }

  /**
   * Filter by action (partial match, case-insensitive)
   */
  action(actionPattern: string): this {
    this.filters.action = actionPattern;
    return this;
  }

  /**
   * Full-text search in metadata JSON
   */
  searchMetadata(searchTerm: string): this {
    this.filters.metadataSearch = searchTerm;
    return this;
  }

  /**
   * Full-text search in details JSON
   */
  searchDetails(searchTerm: string): this {
    this.filters.detailsSearch = searchTerm;
    return this;
  }

  /**
   * Set ordering
   */
  orderBy(field: string, direction: 'asc' | 'desc' = 'desc'): this {
    this.orderByField = field;
    this.orderDirection = direction;
    return this;
  }

  /**
   * Set result limit
   */
  limit(count: number): this {
    this.paginationOpts.limit = count;
    return this;
  }

  /**
   * Set offset for offset-based pagination
   */
  offset(count: number): this {
    this.paginationOpts.offset = count;
    return this;
  }

  /**
   * Set cursor for cursor-based pagination
   */
  cursor(cursorString: string): this {
    this.paginationOpts.cursor = cursorString;
    return this;
  }

  /**
   * Execute the query and return results
   */
  async execute(): Promise<AuditEvent[]> {
    return this.logger.executeQuery(this.filters, this.paginationOpts, this.orderByField, this.orderDirection);
  }

  /**
   * Execute query with pagination metadata
   */
  async executePaginated(): Promise<PaginatedResult<AuditEvent>> {
    return this.logger.executeQueryPaginated(this.filters, this.paginationOpts, this.orderByField, this.orderDirection);
  }

  /**
   * Get aggregated statistics for the filtered events
   */
  async aggregate(interval?: TimeSeriesInterval): Promise<AggregationResult> {
    return this.logger.aggregateQuery(this.filters, interval);
  }

  /**
   * Get count of matching events
   */
  async count(): Promise<number> {
    return this.logger.countQuery(this.filters);
  }

  /**
   * Get the first matching event
   */
  async first(): Promise<AuditEvent | undefined> {
    const results = await this.limit(1).execute();
    return results[0];
  }

  /**
   * Check if any events match
   */
  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  /**
   * Get filters for inspection/debugging
   */
  getFilters(): QueryFilter {
    return { ...this.filters };
  }

  /**
   * Get pagination options for inspection/debugging
   */
  getPaginationOptions(): PaginationOptions {
    return { ...this.paginationOpts };
  }

  /**
   * Clone the query builder for branching queries
   */
  clone(): QueryBuilder {
    const cloned = new QueryBuilder(this.logger);
    cloned.filters = { ...this.filters };
    cloned.paginationOpts = { ...this.paginationOpts };
    cloned.orderByField = this.orderByField;
    cloned.orderDirection = this.orderDirection;
    return cloned;
  }
}

export interface AuditLoggerOptions {
  maxEvents?: number;
  enableConsoleLog?: boolean;
  webhookUrl?: string;
  webhookRetries?: number;
  webhookTimeoutMs?: number;
  onEvent?: (event: AuditEvent) => void | Promise<void>;
  onWebhookError?: (error: Error, event: AuditEvent) => void;
  logFile?: string; // Deprecated: use dbPath instead
  dbPath?: string; // Path to SQLite database file
  retryIntervalMs?: number; // Interval for retrying failed writes (default: 5000ms)
  maxRetryAttempts?: number; // Max retry attempts for failed writes (default: 5)
  syncIntervalMs?: number; // Interval for sync checks (default: 60000ms, 0 to disable)
}

interface FailedWrite {
  event: AuditEvent;
  attempts: number;
  lastError: string;
  firstAttempt: string;
}

export class AuditLogger {
  private events: AuditEvent[] = [];
  private maxEvents: number;
  private enableConsoleLog: boolean;
  private webhookUrl?: string;
  private webhookRetries: number;
  private webhookTimeoutMs: number;
  private onEvent?: (event: AuditEvent) => void | Promise<void>;
  private onWebhookError?: (error: Error, event: AuditEvent) => void;
  private dbPath?: string;
  private db?: Database.Database;
  private initialized: boolean = false;
  private initPromise?: Promise<void>;

  // Retry queue for failed database writes
  private failedWrites: FailedWrite[] = [];
  private retryIntervalMs: number;
  private maxRetryAttempts: number;
  private retryTimer?: ReturnType<typeof setInterval>;

  // Sync mechanism
  private syncIntervalMs: number;
  private syncTimer?: ReturnType<typeof setInterval>;
  private lastSyncTime?: string;

  constructor(options: AuditLoggerOptions = {}) {
    this.maxEvents = options.maxEvents || 10000;
    this.enableConsoleLog = options.enableConsoleLog || false;
    this.webhookUrl = options.webhookUrl;
    this.webhookRetries = options.webhookRetries ?? 3;
    this.webhookTimeoutMs = options.webhookTimeoutMs ?? 5000;
    this.onEvent = options.onEvent;
    this.onWebhookError = options.onWebhookError;
    this.dbPath = options.dbPath || options.logFile; // Support legacy logFile option
    this.retryIntervalMs = options.retryIntervalMs ?? 5000;
    this.maxRetryAttempts = options.maxRetryAttempts ?? 5;
    this.syncIntervalMs = options.syncIntervalMs ?? 60000; // Default: check every minute
  }

  /**
   * Initialize and setup SQLite database if configured
   * Uses Promise-based locking to prevent race conditions in concurrent scenarios
   */
  async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.initialized) return;

    // If initialization is in progress, wait for it to complete
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start initialization and store the promise
    this.initPromise = this.doInitialize();

    try {
      await this.initPromise;
    } finally {
      // Clear the promise reference once done (success or failure)
      this.initPromise = undefined;
    }
  }

  /**
   * Internal initialization implementation
   */
  private async doInitialize(): Promise<void> {
    if (this.dbPath) {
      await this.initDatabase();

      // Start retry timer for failed writes
      this.startRetryTimer();

      // Start sync timer if enabled
      if (this.syncIntervalMs > 0) {
        this.startSyncTimer();
      }
    }

    this.initialized = true;
  }

  /**
   * Start the retry timer for failed database writes
   */
  private startRetryTimer(): void {
    if (this.retryTimer) return;

    this.retryTimer = setInterval(() => {
      this.processRetryQueue();
    }, this.retryIntervalMs);

    // Don't prevent Node from exiting
    if (this.retryTimer.unref) {
      this.retryTimer.unref();
    }
  }

  /**
   * Start the periodic sync timer
   */
  private startSyncTimer(): void {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(() => {
      this.checkSync().catch(err => {
        console.error('[AuditLogger] Sync check failed:', err);
      });
    }, this.syncIntervalMs);

    // Don't prevent Node from exiting
    if (this.syncTimer.unref) {
      this.syncTimer.unref();
    }
  }

  /**
   * Stop all timers (for cleanup/shutdown)
   */
  stopTimers(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = undefined;
    }
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * Process the retry queue for failed database writes
   */
  private processRetryQueue(): void {
    if (this.failedWrites.length === 0 || !this.db) return;

    const toRetry = [...this.failedWrites];
    this.failedWrites = [];

    for (const item of toRetry) {
      const success = this.saveToDatabase(item.event);

      if (success) {
        // Successfully written - add to memory cache
        this.addToMemoryCache(item.event);
        console.log(`[AuditLogger] Retry succeeded for event ${item.event.eventId} after ${item.attempts + 1} attempts`);
      } else {
        // Still failing
        item.attempts++;
        item.lastError = 'Database write failed';

        if (item.attempts < this.maxRetryAttempts) {
          this.failedWrites.push(item);
        } else {
          console.error(
            `[AuditLogger] Giving up on event ${item.event.eventId} after ${item.attempts} attempts. ` +
            `First attempt: ${item.firstAttempt}, Last error: ${item.lastError}`
          );
          // Still add to memory cache so event isn't completely lost
          // but mark it as potentially inconsistent
          this.addToMemoryCache(item.event);
        }
      }
    }
  }

  /**
   * Check consistency between memory cache and database
   * Returns sync status information
   */
  async checkSync(): Promise<{
    inSync: boolean;
    memoryCount: number;
    dbCount: number;
    missingInDb: string[];
    missingInMemory: string[];
    pendingRetries: number;
  }> {
    const result = {
      inSync: true,
      memoryCount: this.events.length,
      dbCount: 0,
      missingInDb: [] as string[],
      missingInMemory: [] as string[],
      pendingRetries: this.failedWrites.length
    };

    if (!this.db) {
      // No database, memory is source of truth
      return result;
    }

    try {
      // Get count from database
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM audit_events');
      const countResult = countStmt.get() as { count: number };
      result.dbCount = countResult.count;

      // Check recent events for consistency (last 100)
      const recentMemory = this.events.slice(-100);
      const recentMemoryIds = new Set(recentMemory.map(e => e.eventId));

      const recentDbStmt = this.db.prepare(`
        SELECT eventId FROM audit_events
        ORDER BY timestamp DESC
        LIMIT 100
      `);
      const recentDbRows = recentDbStmt.all() as { eventId: string }[];
      const recentDbIds = new Set(recentDbRows.map(r => r.eventId));

      // Find events in memory but not in DB
      for (const event of recentMemory) {
        if (!recentDbIds.has(event.eventId)) {
          result.missingInDb.push(event.eventId);
        }
      }

      // Find events in DB but not in memory
      for (const row of recentDbRows) {
        if (!recentMemoryIds.has(row.eventId)) {
          result.missingInMemory.push(row.eventId);
        }
      }

      result.inSync = result.missingInDb.length === 0 &&
                      result.missingInMemory.length === 0 &&
                      result.pendingRetries === 0;

      this.lastSyncTime = new Date().toISOString();

      if (!result.inSync) {
        console.warn('[AuditLogger] Sync check found inconsistencies:', {
          missingInDb: result.missingInDb.length,
          missingInMemory: result.missingInMemory.length,
          pendingRetries: result.pendingRetries
        });
      }

      return result;
    } catch (error) {
      console.error('[AuditLogger] Sync check error:', error);
      result.inSync = false;
      return result;
    }
  }

  /**
   * Force synchronization between memory and database
   * Reconciles any differences by:
   * 1. Writing memory-only events to database
   * 2. Loading database-only events to memory
   * 3. Processing any pending retries
   */
  async sync(): Promise<{
    eventsSyncedToDb: number;
    eventsSyncedToMemory: number;
    retriesProcessed: number;
    errors: string[];
  }> {
    const result = {
      eventsSyncedToDb: 0,
      eventsSyncedToMemory: 0,
      retriesProcessed: 0,
      errors: [] as string[]
    };

    if (!this.db) {
      return result;
    }

    try {
      // First, process any pending retries
      const pendingCount = this.failedWrites.length;
      this.processRetryQueue();
      result.retriesProcessed = pendingCount - this.failedWrites.length;

      // Check current sync status
      const status = await this.checkSync();

      // Write memory-only events to database
      for (const eventId of status.missingInDb) {
        const event = this.events.find(e => e.eventId === eventId);
        if (event) {
          const success = this.saveToDatabase(event);
          if (success) {
            result.eventsSyncedToDb++;
          } else {
            result.errors.push(`Failed to sync event ${eventId} to database`);
          }
        }
      }

      // Load database-only events to memory
      if (status.missingInMemory.length > 0) {
        const placeholders = status.missingInMemory.map(() => '?').join(',');
        const stmt = this.db.prepare(`
          SELECT * FROM audit_events
          WHERE eventId IN (${placeholders})
        `);
        const rows = stmt.all(...status.missingInMemory) as any[];

        for (const row of rows) {
          const event: AuditEvent = {
            eventId: row.eventId,
            eventType: row.eventType,
            action: row.action,
            timestamp: row.timestamp,
            outcome: row.outcome,
            agentId: row.agentId,
            sessionId: row.sessionId,
            userId: row.userId,
            riskLevel: row.riskLevel,
            details: row.details ? JSON.parse(row.details) : undefined,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            correlationId: row.correlationId,
            parentEventId: row.parentEventId
          };

          // Insert in correct position based on timestamp
          this.insertEventSorted(event);
          result.eventsSyncedToMemory++;
        }
      }

      console.log('[AuditLogger] Sync completed:', result);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Sync error: ${errorMsg}`);
      console.error('[AuditLogger] Sync failed:', error);
      return result;
    }
  }

  /**
   * Insert event into memory cache in sorted order by timestamp
   */
  private insertEventSorted(event: AuditEvent): void {
    // Find insertion point
    let insertIdx = this.events.length;
    for (let i = this.events.length - 1; i >= 0; i--) {
      if (this.events[i].timestamp <= event.timestamp) {
        insertIdx = i + 1;
        break;
      }
      if (i === 0) {
        insertIdx = 0;
      }
    }

    this.events.splice(insertIdx, 0, event);

    // Trim if exceeds max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  /**
   * Add event to memory cache (internal helper)
   */
  private addToMemoryCache(event: AuditEvent): void {
    // Check if already in cache (to avoid duplicates from retries)
    if (this.events.some(e => e.eventId === event.eventId)) {
      return;
    }

    this.events.push(event);

    // Trim if exceeds max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  /**
   * Get retry queue status
   */
  getRetryQueueStatus(): {
    pendingCount: number;
    oldestAttempt: string | null;
    events: { eventId: string; attempts: number; lastError: string }[];
  } {
    return {
      pendingCount: this.failedWrites.length,
      oldestAttempt: this.failedWrites.length > 0 ? this.failedWrites[0].firstAttempt : null,
      events: this.failedWrites.map(fw => ({
        eventId: fw.event.eventId,
        attempts: fw.attempts,
        lastError: fw.lastError
      }))
    };
  }

  /**
   * Initialize SQLite database
   */
  private async initDatabase(): Promise<void> {
    if (!this.dbPath) return;

    try {
      // Ensure directory exists with secure permissions (owner-only: 0o700)
      const dir = path.dirname(this.dbPath);
      mkdirSync(dir, { recursive: true, mode: 0o700 });

      // Open database
      this.db = new Database(this.dbPath);

      // Create table if not exists
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS audit_events (
          eventId TEXT PRIMARY KEY,
          eventType TEXT NOT NULL,
          action TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          outcome TEXT NOT NULL,
          agentId TEXT,
          sessionId TEXT,
          userId TEXT,
          riskLevel TEXT,
          details TEXT,
          metadata TEXT,
          correlationId TEXT,
          parentEventId TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_timestamp ON audit_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_eventType ON audit_events(eventType);
        CREATE INDEX IF NOT EXISTS idx_outcome ON audit_events(outcome);
        CREATE INDEX IF NOT EXISTS idx_correlationId ON audit_events(correlationId);
        CREATE INDEX IF NOT EXISTS idx_agentId ON audit_events(agentId);
        CREATE INDEX IF NOT EXISTS idx_sessionId ON audit_events(sessionId);
      `);

      console.log('[AuditLogger] SQLite database initialized at', this.dbPath);
    } catch (error) {
      console.error('[AuditLogger] Failed to initialize database:', error);
    }
  }

  /**
   * Reload events from database (for dashboard refresh)
   */
  async reload(): Promise<void> {
    if (this.db) {
      this.events = this.loadFromDatabase(this.maxEvents);
    }
  }

  /**
   * Log an audit event
   *
   * Storage Strategy (Write-Through Caching):
   * - If database is available: write to DB first, then add to memory on success
   * - If DB write fails: queue for retry, do NOT add to memory (prevents drift)
   * - If no database: add directly to memory (memory-only mode)
   */
  async log(params: {
    eventType: AuditEventType;
    action: string;
    outcome: 'success' | 'failure' | 'pending';
    agentId?: string;
    sessionId?: string;
    userId?: string;
    riskLevel?: RiskLevel;
    details?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    correlationId?: string;
    parentEventId?: string;
  }): Promise<AuditEvent> {
    const event: AuditEvent = {
      eventId: uuidv4(),
      eventType: params.eventType,
      action: params.action,
      timestamp: new Date().toISOString(),
      outcome: params.outcome,
      agentId: params.agentId,
      sessionId: params.sessionId,
      userId: params.userId,
      riskLevel: params.riskLevel,
      details: params.details,
      metadata: params.metadata,
      correlationId: params.correlationId,
      parentEventId: params.parentEventId
    };

    // Write-through caching: DB first, then memory
    if (this.db) {
      const dbWriteSuccess = this.saveToDatabase(event);

      if (dbWriteSuccess) {
        // DB write succeeded - safe to add to memory
        this.addToMemoryCache(event);
      } else {
        // DB write failed - queue for retry, don't add to memory yet
        this.failedWrites.push({
          event,
          attempts: 1,
          lastError: 'Initial database write failed',
          firstAttempt: new Date().toISOString()
        });
        console.warn(`[AuditLogger] Event ${event.eventId} queued for retry after initial DB write failure`);
      }
    } else {
      // No database - memory only mode
      this.addToMemoryCache(event);
    }

    // Console logging (always happens regardless of DB status)
    if (this.enableConsoleLog) {
      this.logToConsole(event);
    }

    // Webhook notification
    if (this.webhookUrl) {
      await this.sendWebhook(event);
    }

    // Custom callback
    if (this.onEvent) {
      await this.onEvent(event);
    }

    return event;
  }

  /**
   * Quick log helpers
   */
  async logActionEvaluated(
    action: string,
    outcome: 'success' | 'failure',
    details?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.log({
      eventType: 'action_evaluated',
      action,
      outcome,
      details
    });
  }

  async logActionApproved(
    action: string,
    details?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.log({
      eventType: 'action_approved',
      action,
      outcome: 'success',
      details
    });
  }

  async logActionDenied(
    action: string,
    reason: string,
    riskLevel?: RiskLevel
  ): Promise<AuditEvent> {
    return this.log({
      eventType: 'action_denied',
      action,
      outcome: 'failure',
      riskLevel,
      details: { reason }
    });
  }

  async logApprovalRequested(
    action: string,
    requestId: string,
    reason: string
  ): Promise<AuditEvent> {
    return this.log({
      eventType: 'approval_requested',
      action,
      outcome: 'pending',
      details: { requestId, reason }
    });
  }

  async logRateLimitHit(
    action: string,
    limitId: string,
    agentId?: string
  ): Promise<AuditEvent> {
    return this.log({
      eventType: 'rate_limit_hit',
      action,
      outcome: 'failure',
      agentId,
      details: { limitId }
    });
  }

  async logSecurityAlert(
    action: string,
    alertType: string,
    severity: RiskLevel,
    details?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.log({
      eventType: 'security_alert',
      action,
      outcome: 'failure',
      riskLevel: severity,
      details: { alertType, ...details }
    });
  }

  async logComplianceViolation(
    action: string,
    violation: string,
    framework?: string
  ): Promise<AuditEvent> {
    return this.log({
      eventType: 'compliance_violation',
      action,
      outcome: 'failure',
      riskLevel: 'high',
      details: { violation, framework }
    });
  }

  async logRuleTriggered(
    action: string,
    ruleId: string,
    ruleName: string,
    outcome: 'success' | 'failure'
  ): Promise<AuditEvent> {
    return this.log({
      eventType: 'rule_triggered',
      action,
      outcome,
      details: { ruleId, ruleName }
    });
  }

  async logConfigChanged(
    action: string,
    changeType: string,
    details?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.log({
      eventType: 'config_changed',
      action,
      outcome: 'success',
      details: { changeType, ...details }
    });
  }

  /**
   * Save event to database
   * @returns true if save was successful, false otherwise
   */
  private saveToDatabase(event: AuditEvent): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO audit_events (
          eventId, eventType, action, timestamp, outcome,
          agentId, sessionId, userId, riskLevel,
          details, metadata, correlationId, parentEventId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        event.eventId,
        event.eventType,
        event.action,
        event.timestamp,
        event.outcome,
        event.agentId || null,
        event.sessionId || null,
        event.userId || null,
        event.riskLevel || null,
        event.details ? JSON.stringify(event.details) : null,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.correlationId || null,
        event.parentEventId || null
      );
      return true;
    } catch (error) {
      console.error('[AuditLogger] Failed to save to database:', error);
      return false;
    }
  }

  /**
   * Load events from database
   */
  private loadFromDatabase(limit: number): AuditEvent[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM audit_events
        ORDER BY timestamp DESC
        LIMIT ?
      `);

      const rows = stmt.all(limit) as any[];

      return rows.map(row => ({
        eventId: row.eventId,
        eventType: row.eventType,
        action: row.action,
        timestamp: row.timestamp,
        outcome: row.outcome,
        agentId: row.agentId,
        sessionId: row.sessionId,
        userId: row.userId,
        riskLevel: row.riskLevel,
        details: row.details ? JSON.parse(row.details) : undefined,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        correlationId: row.correlationId,
        parentEventId: row.parentEventId
      })).reverse(); // Reverse to get chronological order
    } catch (error) {
      console.error('[AuditLogger] Failed to load from database:', error);
      return [];
    }
  }

  // ============================================================================
  // QUERY BUILDER METHODS (Task #49)
  // ============================================================================

  /**
   * Create a new QueryBuilder for fluent query construction
   *
   * Usage:
   * ```typescript
   * const events = await logger.query()
   *   .eventType('action_executed')
   *   .since(new Date('2024-01-01'))
   *   .limit(100)
   *   .execute();
   * ```
   */
  query(): QueryBuilder {
    return new QueryBuilder(this);
  }

  /**
   * Execute a query with filters (called by QueryBuilder)
   */
  executeQuery(
    filters: QueryFilter,
    pagination: PaginationOptions,
    orderByField: string,
    orderDirection: 'asc' | 'desc'
  ): AuditEvent[] {
    // Use database if available for better performance
    if (this.db) {
      return this.executeDbQuery(filters, pagination, orderByField, orderDirection);
    }

    // Fall back to memory-based filtering
    return this.executeMemoryQuery(filters, pagination, orderByField, orderDirection);
  }

  /**
   * Execute query with pagination metadata (called by QueryBuilder)
   */
  async executeQueryPaginated(
    filters: QueryFilter,
    pagination: PaginationOptions,
    orderByField: string,
    orderDirection: 'asc' | 'desc'
  ): Promise<PaginatedResult<AuditEvent>> {
    const totalCount = this.countQuery(filters);
    const limit = pagination.limit || 100;

    // If cursor is provided, decode it
    let decodedCursor: PaginationCursor | undefined;
    if (pagination.cursor) {
      try {
        decodedCursor = JSON.parse(Buffer.from(pagination.cursor, 'base64').toString('utf-8'));
      } catch {
        // Invalid cursor, ignore it
      }
    }

    // Adjust filters for cursor-based pagination
    const adjustedFilters = { ...filters };
    if (decodedCursor) {
      if (decodedCursor.direction === 'forward') {
        if (orderDirection === 'desc') {
          adjustedFilters.until = decodedCursor.timestamp;
        } else {
          adjustedFilters.since = decodedCursor.timestamp;
        }
      }
    }

    const data = this.executeQuery(adjustedFilters, { ...pagination, limit: limit + 1 }, orderByField, orderDirection);

    // Check if there are more results
    const hasMore = data.length > limit;
    if (hasMore) {
      data.pop(); // Remove the extra item
    }

    // Generate cursors
    let nextCursor: string | undefined;
    let previousCursor: string | undefined;

    if (data.length > 0) {
      const lastEvent = data[data.length - 1];
      if (hasMore) {
        const cursor: PaginationCursor = {
          timestamp: lastEvent.timestamp,
          eventId: lastEvent.eventId,
          direction: 'forward'
        };
        nextCursor = Buffer.from(JSON.stringify(cursor)).toString('base64');
      }

      if (decodedCursor) {
        const firstEvent = data[0];
        const cursor: PaginationCursor = {
          timestamp: firstEvent.timestamp,
          eventId: firstEvent.eventId,
          direction: 'backward'
        };
        previousCursor = Buffer.from(JSON.stringify(cursor)).toString('base64');
      }
    }

    return {
      data,
      pagination: {
        totalCount,
        hasMore,
        nextCursor,
        previousCursor,
        limit,
        offset: pagination.offset
      }
    };
  }

  /**
   * Get count of events matching filters (called by QueryBuilder)
   */
  countQuery(filters: QueryFilter): number {
    if (this.db) {
      const { whereClause, params } = this.buildWhereClause(filters);
      const sql = `SELECT COUNT(*) as count FROM audit_events ${whereClause}`;

      try {
        const stmt = this.db.prepare(sql);
        const result = stmt.get(...params) as { count: number };
        return result.count;
      } catch (error) {
        console.error('[AuditLogger] Count query failed:', error);
        return 0;
      }
    }

    // Memory-based count
    return this.filterMemoryEvents(filters).length;
  }

  /**
   * Execute aggregation query (called by QueryBuilder)
   */
  aggregateQuery(filters: QueryFilter, interval?: TimeSeriesInterval): AggregationResult {
    const events = this.db
      ? this.executeDbQuery(filters, {}, 'timestamp', 'asc')
      : this.filterMemoryEvents(filters);

    const result: AggregationResult = {
      byEventType: {},
      byOutcome: {},
      byRiskLevel: {},
      byAgent: {},
      byUser: {},
      timeSeries: [],
      total: events.length
    };

    // Build aggregations
    const timeSeriesMap = new Map<string, { count: number; byOutcome: Record<string, number> }>();

    for (const event of events) {
      // By event type
      result.byEventType[event.eventType] = (result.byEventType[event.eventType] || 0) + 1;

      // By outcome
      result.byOutcome[event.outcome] = (result.byOutcome[event.outcome] || 0) + 1;

      // By risk level
      if (event.riskLevel) {
        result.byRiskLevel[event.riskLevel] = (result.byRiskLevel[event.riskLevel] || 0) + 1;
      }

      // By agent
      if (event.agentId) {
        result.byAgent[event.agentId] = (result.byAgent[event.agentId] || 0) + 1;
      }

      // By user
      if (event.userId) {
        result.byUser[event.userId] = (result.byUser[event.userId] || 0) + 1;
      }

      // Time series
      if (interval) {
        const bucket = this.truncateTimestamp(event.timestamp, interval);
        let entry = timeSeriesMap.get(bucket);
        if (!entry) {
          entry = { count: 0, byOutcome: {} };
          timeSeriesMap.set(bucket, entry);
        }
        entry.count++;
        entry.byOutcome[event.outcome] = (entry.byOutcome[event.outcome] || 0) + 1;
      }
    }

    // Convert time series map to array
    if (interval) {
      result.timeSeries = Array.from(timeSeriesMap.entries())
        .map(([timestamp, data]) => ({
          timestamp,
          count: data.count,
          byOutcome: data.byOutcome
        }))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }

    return result;
  }

  /**
   * Truncate timestamp to the specified interval for time series grouping
   */
  private truncateTimestamp(timestamp: string, interval: TimeSeriesInterval): string {
    const date = new Date(timestamp);

    switch (interval) {
      case 'minute':
        date.setSeconds(0, 0);
        break;
      case 'hour':
        date.setMinutes(0, 0, 0);
        break;
      case 'day':
        date.setHours(0, 0, 0, 0);
        break;
      case 'week': {
        const day = date.getDay();
        date.setDate(date.getDate() - day);
        date.setHours(0, 0, 0, 0);
        break;
      }
      case 'month':
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        break;
    }

    return date.toISOString();
  }

  /**
   * Execute query against database
   */
  private executeDbQuery(
    filters: QueryFilter,
    pagination: PaginationOptions,
    orderByField: string,
    orderDirection: 'asc' | 'desc'
  ): AuditEvent[] {
    if (!this.db) return [];

    const { whereClause, params } = this.buildWhereClause(filters);

    // Validate order field to prevent SQL injection
    const allowedOrderFields = ['timestamp', 'eventType', 'action', 'outcome', 'riskLevel', 'agentId', 'userId'];
    const safeOrderField = allowedOrderFields.includes(orderByField) ? orderByField : 'timestamp';
    const safeDirection = orderDirection === 'asc' ? 'ASC' : 'DESC';

    let sql = `SELECT * FROM audit_events ${whereClause} ORDER BY ${safeOrderField} ${safeDirection}`;

    // Add pagination
    if (pagination.limit) {
      sql += ` LIMIT ?`;
      params.push(pagination.limit);
    }
    if (pagination.offset) {
      sql += ` OFFSET ?`;
      params.push(pagination.offset);
    }

    try {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as any[];

      return rows.map(row => this.rowToEvent(row));
    } catch (error) {
      console.error('[AuditLogger] Database query failed:', error);
      return [];
    }
  }

  /**
   * Build WHERE clause from filters with parameterized queries (SQL injection safe)
   */
  private buildWhereClause(filters: QueryFilter): { whereClause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    // Event type filter
    if (filters.eventType) {
      if (Array.isArray(filters.eventType)) {
        const placeholders = filters.eventType.map(() => '?').join(', ');
        conditions.push(`eventType IN (${placeholders})`);
        params.push(...filters.eventType);
      } else {
        conditions.push('eventType = ?');
        params.push(filters.eventType);
      }
    }

    // Agent ID filter
    if (filters.agentId) {
      if (Array.isArray(filters.agentId)) {
        const placeholders = filters.agentId.map(() => '?').join(', ');
        conditions.push(`agentId IN (${placeholders})`);
        params.push(...filters.agentId);
      } else {
        conditions.push('agentId = ?');
        params.push(filters.agentId);
      }
    }

    // Session ID filter
    if (filters.sessionId) {
      if (Array.isArray(filters.sessionId)) {
        const placeholders = filters.sessionId.map(() => '?').join(', ');
        conditions.push(`sessionId IN (${placeholders})`);
        params.push(...filters.sessionId);
      } else {
        conditions.push('sessionId = ?');
        params.push(filters.sessionId);
      }
    }

    // User ID filter
    if (filters.userId) {
      if (Array.isArray(filters.userId)) {
        const placeholders = filters.userId.map(() => '?').join(', ');
        conditions.push(`userId IN (${placeholders})`);
        params.push(...filters.userId);
      } else {
        conditions.push('userId = ?');
        params.push(filters.userId);
      }
    }

    // Outcome filter
    if (filters.outcome) {
      if (Array.isArray(filters.outcome)) {
        const placeholders = filters.outcome.map(() => '?').join(', ');
        conditions.push(`outcome IN (${placeholders})`);
        params.push(...filters.outcome);
      } else {
        conditions.push('outcome = ?');
        params.push(filters.outcome);
      }
    }

    // Risk level filter
    if (filters.riskLevel) {
      if (Array.isArray(filters.riskLevel)) {
        const placeholders = filters.riskLevel.map(() => '?').join(', ');
        conditions.push(`riskLevel IN (${placeholders})`);
        params.push(...filters.riskLevel);
      } else {
        conditions.push('riskLevel = ?');
        params.push(filters.riskLevel);
      }
    }

    // Date range filters
    if (filters.since) {
      const sinceStr = filters.since instanceof Date ? filters.since.toISOString() : filters.since;
      conditions.push('timestamp >= ?');
      params.push(sinceStr);
    }

    if (filters.until) {
      const untilStr = filters.until instanceof Date ? filters.until.toISOString() : filters.until;
      conditions.push('timestamp <= ?');
      params.push(untilStr);
    }

    // Correlation ID filter
    if (filters.correlationId) {
      conditions.push('correlationId = ?');
      params.push(filters.correlationId);
    }

    // Action partial match (case-insensitive)
    if (filters.action) {
      conditions.push('LOWER(action) LIKE ?');
      params.push(`%${filters.action.toLowerCase()}%`);
    }

    // Full-text search in metadata
    if (filters.metadataSearch) {
      conditions.push('LOWER(metadata) LIKE ?');
      params.push(`%${filters.metadataSearch.toLowerCase()}%`);
    }

    // Full-text search in details
    if (filters.detailsSearch) {
      conditions.push('LOWER(details) LIKE ?');
      params.push(`%${filters.detailsSearch.toLowerCase()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return { whereClause, params };
  }

  /**
   * Convert database row to AuditEvent
   */
  private rowToEvent(row: any): AuditEvent {
    return {
      eventId: row.eventId,
      eventType: row.eventType,
      action: row.action,
      timestamp: row.timestamp,
      outcome: row.outcome,
      agentId: row.agentId || undefined,
      sessionId: row.sessionId || undefined,
      userId: row.userId || undefined,
      riskLevel: row.riskLevel || undefined,
      details: row.details ? JSON.parse(row.details) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      correlationId: row.correlationId || undefined,
      parentEventId: row.parentEventId || undefined
    };
  }

  /**
   * Execute query against memory cache
   */
  private executeMemoryQuery(
    filters: QueryFilter,
    pagination: PaginationOptions,
    orderByField: string,
    orderDirection: 'asc' | 'desc'
  ): AuditEvent[] {
    let results = this.filterMemoryEvents(filters);

    // Sort
    results.sort((a, b) => {
      const aVal = (a as any)[orderByField] || '';
      const bVal = (b as any)[orderByField] || '';
      const comparison = String(aVal).localeCompare(String(bVal));
      return orderDirection === 'asc' ? comparison : -comparison;
    });

    // Pagination
    if (pagination.offset) {
      results = results.slice(pagination.offset);
    }
    if (pagination.limit) {
      results = results.slice(0, pagination.limit);
    }

    return results;
  }

  /**
   * Filter events from memory cache
   */
  private filterMemoryEvents(filters: QueryFilter): AuditEvent[] {
    return this.events.filter(event => {
      // Event type filter
      if (filters.eventType) {
        const types = Array.isArray(filters.eventType) ? filters.eventType : [filters.eventType];
        if (!types.includes(event.eventType)) return false;
      }

      // Agent ID filter
      if (filters.agentId) {
        const ids = Array.isArray(filters.agentId) ? filters.agentId : [filters.agentId];
        if (!event.agentId || !ids.includes(event.agentId)) return false;
      }

      // Session ID filter
      if (filters.sessionId) {
        const ids = Array.isArray(filters.sessionId) ? filters.sessionId : [filters.sessionId];
        if (!event.sessionId || !ids.includes(event.sessionId)) return false;
      }

      // User ID filter
      if (filters.userId) {
        const ids = Array.isArray(filters.userId) ? filters.userId : [filters.userId];
        if (!event.userId || !ids.includes(event.userId)) return false;
      }

      // Outcome filter
      if (filters.outcome) {
        const outcomes = Array.isArray(filters.outcome) ? filters.outcome : [filters.outcome];
        if (!outcomes.includes(event.outcome)) return false;
      }

      // Risk level filter
      if (filters.riskLevel) {
        const levels = Array.isArray(filters.riskLevel) ? filters.riskLevel : [filters.riskLevel];
        if (!event.riskLevel || !levels.includes(event.riskLevel)) return false;
      }

      // Date range filters
      if (filters.since) {
        const sinceStr = filters.since instanceof Date ? filters.since.toISOString() : filters.since;
        if (event.timestamp < sinceStr) return false;
      }

      if (filters.until) {
        const untilStr = filters.until instanceof Date ? filters.until.toISOString() : filters.until;
        if (event.timestamp > untilStr) return false;
      }

      // Correlation ID filter
      if (filters.correlationId) {
        if (event.correlationId !== filters.correlationId) return false;
      }

      // Action partial match
      if (filters.action) {
        if (!event.action.toLowerCase().includes(filters.action.toLowerCase())) return false;
      }

      // Full-text search in metadata
      if (filters.metadataSearch && event.metadata) {
        const metadataStr = JSON.stringify(event.metadata).toLowerCase();
        if (!metadataStr.includes(filters.metadataSearch.toLowerCase())) return false;
      } else if (filters.metadataSearch && !event.metadata) {
        return false;
      }

      // Full-text search in details
      if (filters.detailsSearch && event.details) {
        const detailsStr = JSON.stringify(event.details).toLowerCase();
        if (!detailsStr.includes(filters.detailsSearch.toLowerCase())) return false;
      } else if (filters.detailsSearch && !event.details) {
        return false;
      }

      return true;
    });
  }

  // ============================================================================
  // LEGACY QUERY METHODS (preserved for backward compatibility)
  // ============================================================================

  /**
   * Query events (legacy method - consider using query() instead)
   * @deprecated Use query() for more powerful filtering options
   */
  getEvents(filter?: {
    eventType?: AuditEventType;
    agentId?: string;
    sessionId?: string;
    userId?: string;
    outcome?: 'success' | 'failure' | 'pending';
    riskLevel?: RiskLevel;
    since?: string;
    until?: string;
    limit?: number;
  }): AuditEvent[] {
    // If database is available, query from it
    if (this.db && filter?.limit) {
      return this.loadFromDatabase(filter.limit);
    }

    // Otherwise use in-memory events
    let result = [...this.events];

    if (filter) {
      if (filter.eventType) {
        result = result.filter(e => e.eventType === filter.eventType);
      }
      if (filter.agentId) {
        result = result.filter(e => e.agentId === filter.agentId);
      }
      if (filter.sessionId) {
        result = result.filter(e => e.sessionId === filter.sessionId);
      }
      if (filter.userId) {
        result = result.filter(e => e.userId === filter.userId);
      }
      if (filter.outcome) {
        result = result.filter(e => e.outcome === filter.outcome);
      }
      if (filter.riskLevel) {
        result = result.filter(e => e.riskLevel === filter.riskLevel);
      }
      if (filter.since) {
        result = result.filter(e => e.timestamp >= filter.since!);
      }
      if (filter.until) {
        result = result.filter(e => e.timestamp <= filter.until!);
      }
      if (filter.limit) {
        result = result.slice(-filter.limit);
      }
    }

    return result;
  }

  /**
   * Get event by ID
   */
  getEvent(eventId: string): AuditEvent | undefined {
    return this.events.find(e => e.eventId === eventId);
  }

  /**
   * Get events by correlation ID
   */
  getCorrelatedEvents(correlationId: string): AuditEvent[] {
    return this.events.filter(e => e.correlationId === correlationId);
  }

  /**
   * Get event count
   */
  getEventCount(): number {
    return this.events.length;
  }

  /**
   * Get summary statistics
   * Uses shared calculateGroupedCounts utility for consistency
   */
  getStats(since?: string): {
    total: number;
    byType: Record<string, number>;
    byOutcome: Record<string, number>;
    byRiskLevel: Record<string, number>;
  } {
    let events = this.events;
    if (since) {
      // Use time window for filtering if a time-based since is provided
      const sinceTime = new Date(since).getTime();
      events = events.filter(e => new Date(e.timestamp).getTime() >= sinceTime);
    }

    // Use shared utility for grouped counts
    const byType = calculateGroupedCounts(events, e => e.eventType);
    const byOutcome = calculateGroupedCounts(events, e => e.outcome);
    const byRiskLevel = calculateGroupedCounts(events, e => e.riskLevel);

    return {
      total: events.length,
      byType,
      byOutcome,
      byRiskLevel
    };
  }

  /**
   * Export events as JSON
   */
  exportEvents(filter?: Parameters<typeof this.getEvents>[0]): string {
    const events = this.getEvents(filter);
    return JSON.stringify(events, null, 2);
  }

  /**
   * Clear all events from memory cache
   * Note: This does NOT clear the database - use clearAll() for that
   */
  clear(): void {
    this.events = [];
    this.failedWrites = [];
  }

  /**
   * Clear all events from both memory and database
   */
  clearAll(): void {
    this.events = [];
    this.failedWrites = [];

    if (this.db) {
      try {
        this.db.exec('DELETE FROM audit_events');
        console.log('[AuditLogger] Cleared all events from database');
      } catch (error) {
        console.error('[AuditLogger] Failed to clear database:', error);
      }
    }
  }

  /**
   * Get extended statistics including sync status
   */
  getExtendedStats(): {
    total: number;
    memoryCount: number;
    pendingRetries: number;
    lastSyncTime: string | null;
    byType: Record<string, number>;
    byOutcome: Record<string, number>;
    byRiskLevel: Record<string, number>;
  } {
    const basicStats = this.getStats();

    return {
      ...basicStats,
      memoryCount: this.events.length,
      pendingRetries: this.failedWrites.length,
      lastSyncTime: this.lastSyncTime || null
    };
  }

  /**
   * Log to console with formatting
   */
  private logToConsole(event: AuditEvent): void {
    const levelColors: Record<string, string> = {
      critical: '\x1b[31m',  // Red
      high: '\x1b[33m',      // Yellow
      medium: '\x1b[36m',    // Cyan
      low: '\x1b[32m',       // Green
      minimal: '\x1b[37m'    // White
    };

    const reset = '\x1b[0m';
    const color = event.riskLevel ? levelColors[event.riskLevel] : '\x1b[37m';

    console.log(
      `${color}[${event.timestamp}] ${event.eventType.toUpperCase()} | ` +
      `${event.action} | ${event.outcome}${reset}`,
      event.details ? JSON.stringify(event.details) : ''
    );
  }

  /**
   * Send event to webhook with retry logic
   */
  private async sendWebhook(event: AuditEvent): Promise<void> {
    if (!this.webhookUrl) {
      return;
    }

    const url = this.webhookUrl;
    const timeoutMs = this.webhookTimeoutMs;

    try {
      await withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          try {
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Event-Id': event.eventId,
                'X-Event-Type': event.eventType
              },
              body: JSON.stringify(event),
              signal: controller.signal
            });

            if (!response.ok) {
              throw new WebhookDeliveryError(
                url,
                `HTTP ${response.status}: ${response.statusText}`,
                response.status
              );
            }
          } finally {
            clearTimeout(timeoutId);
          }
        },
        { maxRetries: this.webhookRetries }
      );
    } catch (error) {
      const webhookError = error instanceof Error ? error : new Error(String(error));

      // Call error callback if provided
      if (this.onWebhookError) {
        this.onWebhookError(webhookError, event);
      }

      // Log to console with formatted error
      console.error(`Failed to send audit event to webhook: ${formatError(error)}`);
    }
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();
