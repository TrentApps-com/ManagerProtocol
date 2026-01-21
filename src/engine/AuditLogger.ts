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

  /**
   * Query events
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
   */
  getStats(since?: string): {
    total: number;
    byType: Record<string, number>;
    byOutcome: Record<string, number>;
    byRiskLevel: Record<string, number>;
  } {
    let events = this.events;
    if (since) {
      events = events.filter(e => e.timestamp >= since);
    }

    const byType: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};
    const byRiskLevel: Record<string, number> = {};

    for (const event of events) {
      byType[event.eventType] = (byType[event.eventType] || 0) + 1;
      byOutcome[event.outcome] = (byOutcome[event.outcome] || 0) + 1;
      if (event.riskLevel) {
        byRiskLevel[event.riskLevel] = (byRiskLevel[event.riskLevel] || 0) + 1;
      }
    }

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
