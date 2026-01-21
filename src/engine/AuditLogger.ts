/**
 * Enterprise Agent Supervisor - Audit Logger
 *
 * Comprehensive audit logging for compliance, security, and operational visibility.
 */

import { v4 as uuidv4 } from 'uuid';
import { mkdirSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import type { AuditEvent, AuditEventType, RiskLevel } from '../types/index.js';
import { withRetry, WebhookDeliveryError, formatError } from '../utils/errors.js';

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

  constructor(options: AuditLoggerOptions = {}) {
    this.maxEvents = options.maxEvents || 10000;
    this.enableConsoleLog = options.enableConsoleLog || false;
    this.webhookUrl = options.webhookUrl;
    this.webhookRetries = options.webhookRetries ?? 3;
    this.webhookTimeoutMs = options.webhookTimeoutMs ?? 5000;
    this.onEvent = options.onEvent;
    this.onWebhookError = options.onWebhookError;
    this.dbPath = options.dbPath || options.logFile; // Support legacy logFile option
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
    }

    this.initialized = true;
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

    // Add to in-memory store
    this.events.push(event);

    // Trim if exceeds max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Console logging
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

    // Database logging
    if (this.db) {
      this.saveToDatabase(event);
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
   */
  private saveToDatabase(event: AuditEvent): void {
    if (!this.db) return;

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
    } catch (error) {
      console.error('[AuditLogger] Failed to save to database:', error);
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
   * Clear all events
   */
  clear(): void {
    this.events = [];
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
