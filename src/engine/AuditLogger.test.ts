import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogger } from './AuditLogger.js';

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger();
  });

  describe('Event Logging', () => {
    it('should log an audit event', async () => {
      const event = await logger.log({
        eventType: 'action_evaluated',
        action: 'test-action',
        outcome: 'success'
      });

      expect(event.eventId).toBeDefined();
      expect(event.eventType).toBe('action_evaluated');
      expect(event.action).toBe('test-action');
      expect(event.outcome).toBe('success');
      expect(event.timestamp).toBeDefined();
    });

    it('should include optional fields when provided', async () => {
      const event = await logger.log({
        eventType: 'action_denied',
        action: 'forbidden-action',
        outcome: 'failure',
        agentId: 'agent-1',
        sessionId: 'session-1',
        userId: 'user-1',
        riskLevel: 'high',
        details: { reason: 'Policy violation' },
        metadata: { source: 'test' },
        correlationId: 'corr-123',
        parentEventId: 'parent-456'
      });

      expect(event.agentId).toBe('agent-1');
      expect(event.sessionId).toBe('session-1');
      expect(event.userId).toBe('user-1');
      expect(event.riskLevel).toBe('high');
      expect(event.details).toEqual({ reason: 'Policy violation' });
      expect(event.metadata).toEqual({ source: 'test' });
      expect(event.correlationId).toBe('corr-123');
      expect(event.parentEventId).toBe('parent-456');
    });

    it('should respect max events limit', async () => {
      const maxLogger = new AuditLogger({ maxEvents: 5 });

      // Log more than max events
      for (let i = 0; i < 10; i++) {
        await maxLogger.log({
          eventType: 'action_evaluated',
          action: `action-${i}`,
          outcome: 'success'
        });
      }

      const events = maxLogger.getEvents();
      expect(events).toHaveLength(5);
      // Should keep the most recent events
      expect(events[0].action).toBe('action-5');
      expect(events[4].action).toBe('action-9');
    });
  });

  describe('Quick Log Helpers', () => {
    it('should log action evaluated', async () => {
      const event = await logger.logActionEvaluated('test', 'success', { detail: 'value' });
      expect(event.eventType).toBe('action_evaluated');
      expect(event.outcome).toBe('success');
      expect(event.details).toEqual({ detail: 'value' });
    });

    it('should log action approved', async () => {
      const event = await logger.logActionApproved('test', { approver: 'admin' });
      expect(event.eventType).toBe('action_approved');
      expect(event.outcome).toBe('success');
    });

    it('should log action denied', async () => {
      const event = await logger.logActionDenied('test', 'Policy violation', 'high');
      expect(event.eventType).toBe('action_denied');
      expect(event.outcome).toBe('failure');
      expect(event.riskLevel).toBe('high');
      expect(event.details).toEqual({ reason: 'Policy violation' });
    });

    it('should log approval requested', async () => {
      const event = await logger.logApprovalRequested('test', 'req-123', 'High risk action');
      expect(event.eventType).toBe('approval_requested');
      expect(event.outcome).toBe('pending');
      expect(event.details).toEqual({ requestId: 'req-123', reason: 'High risk action' });
    });

    it('should log rate limit hit', async () => {
      const event = await logger.logRateLimitHit('test', 'limit-1', 'agent-1');
      expect(event.eventType).toBe('rate_limit_hit');
      expect(event.outcome).toBe('failure');
      expect(event.agentId).toBe('agent-1');
    });

    it('should log security alert', async () => {
      const event = await logger.logSecurityAlert('test', 'SQL Injection', 'critical', {
        payload: 'malicious'
      });
      expect(event.eventType).toBe('security_alert');
      expect(event.riskLevel).toBe('critical');
      expect(event.details?.alertType).toBe('SQL Injection');
    });

    it('should log compliance violation', async () => {
      const event = await logger.logComplianceViolation('test', 'Missing consent', 'GDPR');
      expect(event.eventType).toBe('compliance_violation');
      expect(event.riskLevel).toBe('high');
      expect(event.details).toEqual({ violation: 'Missing consent', framework: 'GDPR' });
    });

    it('should log rule triggered', async () => {
      const event = await logger.logRuleTriggered('test', 'rule-1', 'PII Protection', 'success');
      expect(event.eventType).toBe('rule_triggered');
      expect(event.details).toEqual({ ruleId: 'rule-1', ruleName: 'PII Protection' });
    });

    it('should log config changed', async () => {
      const event = await logger.logConfigChanged('update-settings', 'rule_added', {
        ruleId: 'new-rule'
      });
      expect(event.eventType).toBe('config_changed');
      expect(event.details?.changeType).toBe('rule_added');
    });
  });

  describe('Event Querying', () => {
    beforeEach(async () => {
      // Set up some test events
      await logger.log({
        eventType: 'action_evaluated',
        action: 'action-1',
        outcome: 'success',
        agentId: 'agent-1',
        sessionId: 'session-1',
        riskLevel: 'low'
      });
      await logger.log({
        eventType: 'action_denied',
        action: 'action-2',
        outcome: 'failure',
        agentId: 'agent-2',
        sessionId: 'session-1',
        riskLevel: 'high'
      });
      await logger.log({
        eventType: 'security_alert',
        action: 'action-3',
        outcome: 'failure',
        agentId: 'agent-1',
        sessionId: 'session-2',
        riskLevel: 'critical'
      });
    });

    it('should get all events', () => {
      const events = logger.getEvents();
      expect(events).toHaveLength(3);
    });

    it('should filter by event type', () => {
      const events = logger.getEvents({ eventType: 'action_denied' });
      expect(events).toHaveLength(1);
      expect(events[0].action).toBe('action-2');
    });

    it('should filter by agent ID', () => {
      const events = logger.getEvents({ agentId: 'agent-1' });
      expect(events).toHaveLength(2);
    });

    it('should filter by session ID', () => {
      const events = logger.getEvents({ sessionId: 'session-1' });
      expect(events).toHaveLength(2);
    });

    it('should filter by outcome', () => {
      const events = logger.getEvents({ outcome: 'failure' });
      expect(events).toHaveLength(2);
    });

    it('should filter by risk level', () => {
      const events = logger.getEvents({ riskLevel: 'critical' });
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('security_alert');
    });

    it('should limit results', () => {
      const events = logger.getEvents({ limit: 2 });
      expect(events).toHaveLength(2);
    });

    it('should get event by ID', async () => {
      const logged = await logger.log({
        eventType: 'action_evaluated',
        action: 'findme',
        outcome: 'success'
      });

      const found = logger.getEvent(logged.eventId);
      expect(found).toBeDefined();
      expect(found?.action).toBe('findme');
    });

    it('should return undefined for non-existent event', () => {
      const found = logger.getEvent('non-existent-id');
      expect(found).toBeUndefined();
    });

    it('should get events by correlation ID', async () => {
      await logger.log({
        eventType: 'action_evaluated',
        action: 'correlated-1',
        outcome: 'success',
        correlationId: 'corr-456'
      });
      await logger.log({
        eventType: 'action_approved',
        action: 'correlated-2',
        outcome: 'success',
        correlationId: 'corr-456'
      });
      await logger.log({
        eventType: 'action_executed',
        action: 'correlated-3',
        outcome: 'success',
        correlationId: 'corr-789'
      });

      const events = logger.getCorrelatedEvents('corr-456');
      expect(events).toHaveLength(2);
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await logger.log({
        eventType: 'action_evaluated',
        action: 'action-1',
        outcome: 'success',
        riskLevel: 'low'
      });
      await logger.log({
        eventType: 'action_evaluated',
        action: 'action-2',
        outcome: 'success',
        riskLevel: 'medium'
      });
      await logger.log({
        eventType: 'action_denied',
        action: 'action-3',
        outcome: 'failure',
        riskLevel: 'high'
      });
    });

    it('should return correct statistics', () => {
      const stats = logger.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byType.action_evaluated).toBe(2);
      expect(stats.byType.action_denied).toBe(1);
      expect(stats.byOutcome.success).toBe(2);
      expect(stats.byOutcome.failure).toBe(1);
      expect(stats.byRiskLevel.low).toBe(1);
      expect(stats.byRiskLevel.medium).toBe(1);
      expect(stats.byRiskLevel.high).toBe(1);
    });

    it('should return event count', () => {
      expect(logger.getEventCount()).toBe(3);
    });
  });

  describe('Export and Clear', () => {
    it('should export events as JSON', async () => {
      await logger.log({
        eventType: 'action_evaluated',
        action: 'test',
        outcome: 'success'
      });

      const exported = logger.exportEvents();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].action).toBe('test');
    });

    it('should clear all events', async () => {
      await logger.log({
        eventType: 'action_evaluated',
        action: 'test',
        outcome: 'success'
      });

      expect(logger.getEventCount()).toBe(1);

      logger.clear();

      expect(logger.getEventCount()).toBe(0);
    });
  });

  describe('Callbacks', () => {
    it('should call onEvent callback when logging', async () => {
      const onEvent = vi.fn();
      const callbackLogger = new AuditLogger({ onEvent });

      await callbackLogger.log({
        eventType: 'action_evaluated',
        action: 'test',
        outcome: 'success'
      });

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'action_evaluated',
          action: 'test'
        })
      );
    });

    it('should handle async onEvent callback', async () => {
      const onEvent = vi.fn().mockResolvedValue(undefined);
      const callbackLogger = new AuditLogger({ onEvent });

      await callbackLogger.log({
        eventType: 'action_evaluated',
        action: 'test',
        outcome: 'success'
      });

      expect(onEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('Console Logging', () => {
    it('should log to console when enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleLogger = new AuditLogger({ enableConsoleLog: true });

      await consoleLogger.log({
        eventType: 'action_evaluated',
        action: 'test',
        outcome: 'success'
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
