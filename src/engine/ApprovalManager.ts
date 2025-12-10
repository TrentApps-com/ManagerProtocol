/**
 * Enterprise Agent Supervisor - Approval Manager
 *
 * Manages human-in-the-loop approval workflows for high-risk actions.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ApprovalRequest,
  ApprovalPriority,
  BusinessContext,
  RuleViolation
} from '../types/index.js';
import { auditLogger } from './AuditLogger.js';

export interface ApprovalManagerOptions {
  defaultExpirationMs?: number;
  onApprovalRequested?: (request: ApprovalRequest) => void | Promise<void>;
  onApprovalResolved?: (request: ApprovalRequest) => void | Promise<void>;
}

export class ApprovalManager {
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  private resolvedApprovals: Map<string, ApprovalRequest> = new Map();
  private defaultExpirationMs: number;
  private onApprovalRequested?: (request: ApprovalRequest) => void | Promise<void>;
  private onApprovalResolved?: (request: ApprovalRequest) => void | Promise<void>;

  constructor(options: ApprovalManagerOptions = {}) {
    this.defaultExpirationMs = options.defaultExpirationMs || 24 * 60 * 60 * 1000; // 24 hours
    this.onApprovalRequested = options.onApprovalRequested;
    this.onApprovalResolved = options.onApprovalResolved;
  }

  /**
   * Request human approval for an action
   */
  async requestApproval(params: {
    reason: string;
    actionId?: string;
    details?: string;
    priority?: ApprovalPriority;
    requiredApprovers?: string[];
    expiresInMs?: number;
    context?: BusinessContext;
    riskScore?: number;
    violations?: RuleViolation[];
    metadata?: Record<string, unknown>;
  }): Promise<ApprovalRequest> {
    const requestId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (params.expiresInMs || this.defaultExpirationMs)
    );

    const request: ApprovalRequest = {
      requestId,
      actionId: params.actionId,
      reason: params.reason,
      details: params.details,
      priority: params.priority || 'normal',
      requiredApprovers: params.requiredApprovers,
      expiresAt: expiresAt.toISOString(),
      context: params.context,
      riskScore: params.riskScore,
      violations: params.violations,
      metadata: params.metadata,
      createdAt: now.toISOString(),
      status: 'pending'
    };

    this.pendingApprovals.set(requestId, request);

    // Log the approval request
    await auditLogger.logApprovalRequested(
      params.actionId || 'unknown_action',
      requestId,
      params.reason
    );

    // Callback
    if (this.onApprovalRequested) {
      await this.onApprovalRequested(request);
    }

    return request;
  }

  /**
   * Approve a pending request
   */
  async approve(
    requestId: string,
    approverId: string,
    comments?: string
  ): Promise<ApprovalRequest | null> {
    const request = this.pendingApprovals.get(requestId);
    if (!request) return null;

    // Check if expired
    if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
      request.status = 'expired';
      this.moveToResolved(requestId, request);
      return request;
    }

    request.status = 'approved';
    request.metadata = {
      ...request.metadata,
      approvedBy: approverId,
      approvedAt: new Date().toISOString(),
      approvalComments: comments
    };

    this.moveToResolved(requestId, request);

    // Log
    await auditLogger.log({
      eventType: 'approval_granted',
      action: request.actionId || 'unknown_action',
      outcome: 'success',
      details: {
        requestId,
        approverId,
        reason: request.reason,
        comments
      }
    });

    if (this.onApprovalResolved) {
      await this.onApprovalResolved(request);
    }

    return request;
  }

  /**
   * Deny a pending request
   */
  async deny(
    requestId: string,
    denierId: string,
    reason?: string
  ): Promise<ApprovalRequest | null> {
    const request = this.pendingApprovals.get(requestId);
    if (!request) return null;

    request.status = 'denied';
    request.metadata = {
      ...request.metadata,
      deniedBy: denierId,
      deniedAt: new Date().toISOString(),
      denialReason: reason
    };

    this.moveToResolved(requestId, request);

    // Log
    await auditLogger.log({
      eventType: 'approval_denied',
      action: request.actionId || 'unknown_action',
      outcome: 'failure',
      details: {
        requestId,
        denierId,
        originalReason: request.reason,
        denialReason: reason
      }
    });

    if (this.onApprovalResolved) {
      await this.onApprovalResolved(request);
    }

    return request;
  }

  /**
   * Cancel a pending request
   */
  async cancel(requestId: string, reason?: string): Promise<ApprovalRequest | null> {
    const request = this.pendingApprovals.get(requestId);
    if (!request) return null;

    request.status = 'cancelled';
    request.metadata = {
      ...request.metadata,
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason
    };

    this.moveToResolved(requestId, request);

    return request;
  }

  /**
   * Get a specific approval request
   */
  getRequest(requestId: string): ApprovalRequest | null {
    return this.pendingApprovals.get(requestId)
      || this.resolvedApprovals.get(requestId)
      || null;
  }

  /**
   * Get all pending approvals
   */
  getPendingApprovals(filter?: {
    priority?: ApprovalPriority;
    agentId?: string;
    minRiskScore?: number;
  }): ApprovalRequest[] {
    let result = Array.from(this.pendingApprovals.values());

    // Check for expired and update status
    const now = new Date();
    result = result.filter(r => {
      if (r.expiresAt && new Date(r.expiresAt) < now) {
        r.status = 'expired';
        this.moveToResolved(r.requestId, r);
        return false;
      }
      return true;
    });

    if (filter) {
      if (filter.priority) {
        result = result.filter(r => r.priority === filter.priority);
      }
      if (filter.agentId) {
        result = result.filter(r => r.context?.agentId === filter.agentId);
      }
      if (filter.minRiskScore !== undefined) {
        result = result.filter(r => (r.riskScore || 0) >= filter.minRiskScore!);
      }
    }

    // Sort by priority (urgent first) then by creation time
    const priorityOrder: Record<ApprovalPriority, number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3
    };

    return result.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  /**
   * Get resolved approvals
   */
  getResolvedApprovals(limit?: number): ApprovalRequest[] {
    const result = Array.from(this.resolvedApprovals.values());
    return limit ? result.slice(-limit) : result;
  }

  /**
   * Check if a request is approved
   */
  isApproved(requestId: string): boolean {
    const request = this.getRequest(requestId);
    return request?.status === 'approved';
  }

  /**
   * Check if a request is pending
   */
  isPending(requestId: string): boolean {
    return this.pendingApprovals.has(requestId);
  }

  /**
   * Get approval statistics
   */
  getStats(): {
    pending: number;
    approved: number;
    denied: number;
    expired: number;
    cancelled: number;
    byPriority: Record<string, number>;
    averageResolutionTimeMs: number;
  } {
    const resolved = Array.from(this.resolvedApprovals.values());

    let approved = 0;
    let denied = 0;
    let expired = 0;
    let cancelled = 0;
    let totalResolutionTime = 0;
    let resolutionCount = 0;

    for (const r of resolved) {
      switch (r.status) {
        case 'approved':
          approved++;
          break;
        case 'denied':
          denied++;
          break;
        case 'expired':
          expired++;
          break;
        case 'cancelled':
          cancelled++;
          break;
      }

      // Calculate resolution time
      const resolvedAt = r.metadata?.approvedAt || r.metadata?.deniedAt;
      if (resolvedAt && typeof resolvedAt === 'string') {
        const resolutionTime = new Date(resolvedAt).getTime() - new Date(r.createdAt).getTime();
        totalResolutionTime += resolutionTime;
        resolutionCount++;
      }
    }

    const pending = Array.from(this.pendingApprovals.values());
    const byPriority: Record<string, number> = {};
    for (const p of pending) {
      byPriority[p.priority] = (byPriority[p.priority] || 0) + 1;
    }

    return {
      pending: pending.length,
      approved,
      denied,
      expired,
      cancelled,
      byPriority,
      averageResolutionTimeMs: resolutionCount > 0
        ? Math.round(totalResolutionTime / resolutionCount)
        : 0
    };
  }

  /**
   * Clean up expired approvals
   */
  cleanupExpired(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [id, request] of this.pendingApprovals) {
      if (request.expiresAt && new Date(request.expiresAt) < now) {
        request.status = 'expired';
        this.moveToResolved(id, request);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Move request from pending to resolved
   */
  private moveToResolved(requestId: string, request: ApprovalRequest): void {
    this.pendingApprovals.delete(requestId);
    this.resolvedApprovals.set(requestId, request);
  }
}

// Export singleton instance
export const approvalManager = new ApprovalManager();
