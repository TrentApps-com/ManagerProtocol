/**
 * Enterprise Agent Supervisor - Audit Logger
 *
 * Comprehensive audit logging for compliance, security, and operational visibility.
 */

import { v4 as uuidv4 } from 'uuid';
import type { AuditEvent, AuditEventType, RiskLevel } from '../types/index.js';

export interface AuditLoggerOptions {
  maxEvents?: number;
  enableConsoleLog?: boolean;
  webhookUrl?: string;
  onEvent?: (event: AuditEvent) => void | Promise<void>;
}

export class AuditLogger {
  private events: AuditEvent[] = [];
  private maxEvents: number;
  private enableConsoleLog: boolean;
  private webhookUrl?: string;
  private onEvent?: (event: AuditEvent) => void | Promise<void>;

  constructor(options: AuditLoggerOptions = {}) {
    this.maxEvents = options.maxEvents || 10000;
    this.enableConsoleLog = options.enableConsoleLog || false;
    this.webhookUrl = options.webhookUrl;
    this.onEvent = options.onEvent;
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
   * Send event to webhook
   */
  private async sendWebhook(event: AuditEvent): Promise<void> {
    if (!this.webhookUrl) return;

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });
    } catch (error) {
      console.error('Failed to send audit event to webhook:', error);
    }
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();
