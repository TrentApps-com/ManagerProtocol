import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ApprovalManager } from './ApprovalManager.js';

// Mock the audit logger to avoid side effects
vi.mock('./AuditLogger.js', () => ({
  auditLogger: {
    logApprovalRequested: vi.fn().mockResolvedValue({}),
    log: vi.fn().mockResolvedValue({})
  }
}));

describe('ApprovalManager', () => {
  let manager: ApprovalManager;

  beforeEach(() => {
    manager = new ApprovalManager();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Request Approval', () => {
    it('should create an approval request', async () => {
      const request = await manager.requestApproval({
        reason: 'High risk action',
        actionId: 'action-123'
      });

      expect(request.requestId).toBeDefined();
      expect(request.reason).toBe('High risk action');
      expect(request.actionId).toBe('action-123');
      expect(request.status).toBe('pending');
      expect(request.priority).toBe('normal');
    });

    it('should set custom priority', async () => {
      const request = await manager.requestApproval({
        reason: 'Urgent action',
        priority: 'urgent'
      });

      expect(request.priority).toBe('urgent');
    });

    it('should set default expiration', async () => {
      const request = await manager.requestApproval({
        reason: 'Test'
      });

      // Default expiration is 24 hours
      const expectedExpiration = new Date('2024-01-02T12:00:00Z');
      expect(new Date(request.expiresAt!)).toEqual(expectedExpiration);
    });

    it('should set custom expiration', async () => {
      const request = await manager.requestApproval({
        reason: 'Test',
        expiresInMs: 3600000 // 1 hour
      });

      const expectedExpiration = new Date('2024-01-01T13:00:00Z');
      expect(new Date(request.expiresAt!)).toEqual(expectedExpiration);
    });

    it('should include all optional fields', async () => {
      const request = await manager.requestApproval({
        reason: 'Complex action',
        actionId: 'action-456',
        details: 'Detailed description',
        priority: 'high',
        requiredApprovers: ['admin-1', 'admin-2'],
        context: { environment: 'production', agentId: 'agent-1' },
        riskScore: 85,
        violations: [
          { ruleId: 'rule-1', ruleName: 'Security Rule', severity: 'high', message: 'Violation' }
        ],
        metadata: { source: 'test' }
      });

      expect(request.details).toBe('Detailed description');
      expect(request.priority).toBe('high');
      expect(request.requiredApprovers).toEqual(['admin-1', 'admin-2']);
      expect(request.context?.environment).toBe('production');
      expect(request.riskScore).toBe(85);
      expect(request.violations).toHaveLength(1);
      expect(request.metadata?.source).toBe('test');
    });

    it('should call onApprovalRequested callback', async () => {
      const callback = vi.fn();
      const callbackManager = new ApprovalManager({ onApprovalRequested: callback });

      await callbackManager.requestApproval({ reason: 'Test' });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Approve Request', () => {
    it('should approve a pending request', async () => {
      const request = await manager.requestApproval({
        reason: 'Test',
        actionId: 'action-1'
      });

      const approved = await manager.approve(request.requestId, 'admin-1', 'Looks good');

      expect(approved).not.toBeNull();
      expect(approved?.status).toBe('approved');
      expect(approved?.metadata?.approvedBy).toBe('admin-1');
      expect(approved?.metadata?.approvalComments).toBe('Looks good');
    });

    it('should return null for non-existent request', async () => {
      const result = await manager.approve('non-existent', 'admin-1');
      expect(result).toBeNull();
    });

    it('should mark expired requests when approving', async () => {
      const request = await manager.requestApproval({
        reason: 'Test',
        expiresInMs: 3600000 // 1 hour
      });

      // Advance time past expiration
      vi.advanceTimersByTime(3700000);

      const result = await manager.approve(request.requestId, 'admin-1');

      expect(result?.status).toBe('expired');
    });

    it('should call onApprovalResolved callback', async () => {
      const callback = vi.fn();
      const callbackManager = new ApprovalManager({ onApprovalResolved: callback });

      const request = await callbackManager.requestApproval({ reason: 'Test' });
      await callbackManager.approve(request.requestId, 'admin-1');

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Deny Request', () => {
    it('should deny a pending request', async () => {
      const request = await manager.requestApproval({
        reason: 'Test',
        actionId: 'action-1'
      });

      const denied = await manager.deny(request.requestId, 'admin-1', 'Too risky');

      expect(denied).not.toBeNull();
      expect(denied?.status).toBe('denied');
      expect(denied?.metadata?.deniedBy).toBe('admin-1');
      expect(denied?.metadata?.denialReason).toBe('Too risky');
    });

    it('should return null for non-existent request', async () => {
      const result = await manager.deny('non-existent', 'admin-1');
      expect(result).toBeNull();
    });
  });

  describe('Cancel Request', () => {
    it('should cancel a pending request', async () => {
      const request = await manager.requestApproval({
        reason: 'Test'
      });

      const cancelled = await manager.cancel(request.requestId, 'No longer needed');

      expect(cancelled).not.toBeNull();
      expect(cancelled?.status).toBe('cancelled');
      expect(cancelled?.metadata?.cancellationReason).toBe('No longer needed');
    });

    it('should return null for non-existent request', async () => {
      const result = await manager.cancel('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('Get Request', () => {
    it('should get a pending request', async () => {
      const request = await manager.requestApproval({ reason: 'Test' });

      const found = manager.getRequest(request.requestId);
      expect(found?.requestId).toBe(request.requestId);
    });

    it('should get a resolved request', async () => {
      const request = await manager.requestApproval({ reason: 'Test' });
      await manager.approve(request.requestId, 'admin-1');

      const found = manager.getRequest(request.requestId);
      expect(found?.status).toBe('approved');
    });

    it('should return null for non-existent request', () => {
      const found = manager.getRequest('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('Get Pending Approvals', () => {
    beforeEach(async () => {
      await manager.requestApproval({
        reason: 'Low priority',
        priority: 'low',
        context: { agentId: 'agent-1' },
        riskScore: 30
      });
      await manager.requestApproval({
        reason: 'Urgent',
        priority: 'urgent',
        context: { agentId: 'agent-2' },
        riskScore: 90
      });
      await manager.requestApproval({
        reason: 'Normal',
        priority: 'normal',
        context: { agentId: 'agent-1' },
        riskScore: 50
      });
    });

    it('should get all pending approvals', () => {
      const pending = manager.getPendingApprovals();
      expect(pending).toHaveLength(3);
    });

    it('should sort by priority (urgent first)', () => {
      const pending = manager.getPendingApprovals();
      expect(pending[0].priority).toBe('urgent');
      expect(pending[1].priority).toBe('normal');
      expect(pending[2].priority).toBe('low');
    });

    it('should filter by priority', () => {
      const pending = manager.getPendingApprovals({ priority: 'urgent' });
      expect(pending).toHaveLength(1);
      expect(pending[0].reason).toBe('Urgent');
    });

    it('should filter by agent ID', () => {
      const pending = manager.getPendingApprovals({ agentId: 'agent-1' });
      expect(pending).toHaveLength(2);
    });

    it('should filter by minimum risk score', () => {
      const pending = manager.getPendingApprovals({ minRiskScore: 50 });
      expect(pending).toHaveLength(2);
    });

    it('should exclude expired requests', async () => {
      await manager.requestApproval({
        reason: 'Expires soon',
        expiresInMs: 1000
      });

      // Before expiration
      expect(manager.getPendingApprovals()).toHaveLength(4);

      // After expiration
      vi.advanceTimersByTime(2000);
      expect(manager.getPendingApprovals()).toHaveLength(3);
    });
  });

  describe('Get Resolved Approvals', () => {
    it('should get resolved approvals', async () => {
      const request1 = await manager.requestApproval({ reason: 'Test 1' });
      const request2 = await manager.requestApproval({ reason: 'Test 2' });

      await manager.approve(request1.requestId, 'admin');
      await manager.deny(request2.requestId, 'admin');

      const resolved = manager.getResolvedApprovals();
      expect(resolved).toHaveLength(2);
    });

    it('should limit results', async () => {
      for (let i = 0; i < 5; i++) {
        const request = await manager.requestApproval({ reason: `Test ${i}` });
        await manager.approve(request.requestId, 'admin');
      }

      const resolved = manager.getResolvedApprovals(3);
      expect(resolved).toHaveLength(3);
    });
  });

  describe('Status Checks', () => {
    it('should check if request is approved', async () => {
      const request = await manager.requestApproval({ reason: 'Test' });

      expect(manager.isApproved(request.requestId)).toBe(false);

      await manager.approve(request.requestId, 'admin');

      expect(manager.isApproved(request.requestId)).toBe(true);
    });

    it('should check if request is pending', async () => {
      const request = await manager.requestApproval({ reason: 'Test' });

      expect(manager.isPending(request.requestId)).toBe(true);

      await manager.approve(request.requestId, 'admin');

      expect(manager.isPending(request.requestId)).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should return correct statistics', async () => {
      // Create various requests
      const req1 = await manager.requestApproval({ reason: 'Approved', priority: 'high' });
      const req2 = await manager.requestApproval({ reason: 'Denied', priority: 'normal' });
      const req3 = await manager.requestApproval({ reason: 'Cancelled', priority: 'low' });
      await manager.requestApproval({ reason: 'Pending', priority: 'urgent' });

      // Resolve some
      await manager.approve(req1.requestId, 'admin');
      await manager.deny(req2.requestId, 'admin');
      await manager.cancel(req3.requestId);

      const stats = manager.getStats();

      expect(stats.pending).toBe(1);
      expect(stats.approved).toBe(1);
      expect(stats.denied).toBe(1);
      expect(stats.cancelled).toBe(1);
      expect(stats.byPriority.urgent).toBe(1);
    });
  });

  describe('Cleanup Expired', () => {
    it('should clean up expired approvals', async () => {
      await manager.requestApproval({
        reason: 'Expires soon',
        expiresInMs: 1000
      });
      await manager.requestApproval({
        reason: 'Does not expire soon',
        expiresInMs: 100000
      });

      // Before expiration
      expect(manager.getPendingApprovals()).toHaveLength(2);

      // After expiration
      vi.advanceTimersByTime(2000);
      const cleaned = manager.cleanupExpired();

      expect(cleaned).toBe(1);
      expect(manager.getPendingApprovals()).toHaveLength(1);

      // Check it was moved to resolved
      const resolved = manager.getResolvedApprovals();
      expect(resolved.some(r => r.status === 'expired')).toBe(true);
    });
  });

  describe('Custom Expiration', () => {
    it('should use custom default expiration', async () => {
      const customManager = new ApprovalManager({
        defaultExpirationMs: 3600000 // 1 hour
      });

      const request = await customManager.requestApproval({ reason: 'Test' });

      const expectedExpiration = new Date('2024-01-01T13:00:00Z');
      expect(new Date(request.expiresAt!)).toEqual(expectedExpiration);
    });
  });
});
