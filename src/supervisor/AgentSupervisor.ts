/**
 * Enterprise Agent Supervisor - Main Supervisor Class
 *
 * Orchestrates all governance components for agent supervision.
 *
 * Note: GitHub-based approval and task management has been removed.
 * Use the GitHub MCP server separately for GitHub functionality.
 */

import { v4 as uuidv4 } from 'uuid';
import { RulesEngine } from '../engine/RulesEngine.js';
import { RateLimiter } from '../engine/RateLimiter.js';
import { AuditLogger, type AuditLoggerOptions } from '../engine/AuditLogger.js';
import { ArchitectureDetector } from '../analyzers/ArchitectureDetector.js';
import { allBuiltInRules, defaultRateLimits, rulePresets } from '../rules/index.js';
import type {
  SupervisorConfig,
  AgentAction,
  BusinessContext,
  EvaluationResult,
  BusinessRulesResult,
  ApprovalRequest,
  AuditEvent,
  BusinessRule,
  RateLimitConfig
} from '../types/index.js';

export interface AgentSupervisorOptions {
  config?: Partial<SupervisorConfig>;
  auditOptions?: AuditLoggerOptions;
}

/**
 * Cached evaluation entry with timestamp for TTL management
 */
interface CachedEvaluation {
  result: EvaluationResult;
  cachedAt: number;
}

/**
 * Default cache TTL in milliseconds (30 seconds)
 */
const DEFAULT_CACHE_TTL_MS = 30_000;

export class AgentSupervisor {
  private config: SupervisorConfig;
  private rulesEngine: RulesEngine;
  private rateLimiter: RateLimiter;
  private auditLogger: AuditLogger;
  private initialized: boolean = false;

  /** In-memory storage for approval requests (GitHub integration removed) */
  private approvalRequests: Map<string, ApprovalRequest> = new Map();

  /**
   * Cache for evaluation results
   * Key: cache key derived from action name, category, and parameters
   * Value: cached evaluation result with timestamp
   */
  private evaluationCache: Map<string, CachedEvaluation> = new Map();

  /**
   * Cache TTL in milliseconds
   */
  private cacheTtlMs: number = DEFAULT_CACHE_TTL_MS;

  constructor(options: AgentSupervisorOptions = {}) {
    // Initialize with defaults
    this.config = this.buildConfig(options.config);
    this.rulesEngine = new RulesEngine();
    this.rateLimiter = new RateLimiter();
    this.auditLogger = new AuditLogger(options.auditOptions);
  }

  /**
   * Initialize the supervisor with configuration
   */
  async initialize(preset?: keyof typeof rulePresets): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize audit logger (loads from file if configured)
    await this.auditLogger.initialize();

    // Load preset if specified
    if (preset && rulePresets[preset]) {
      const presetConfig = rulePresets[preset];
      this.rulesEngine.registerRules(presetConfig.rules);
      this.rateLimiter.registerLimits(presetConfig.rateLimits);
    } else {
      // Load from config
      this.rulesEngine.registerRules(this.config.rules);
      this.rateLimiter.registerLimits(this.config.rateLimits);
    }

    // Log initialization
    await this.auditLogger.log({
      eventType: 'system_event',
      action: 'supervisor_initialized',
      outcome: 'success',
      details: {
        environment: this.config.environment,
        rulesLoaded: this.rulesEngine.getRules().length,
        rateLimitsLoaded: this.rateLimiter.getConfigs().length,
        preset
      }
    });

    this.initialized = true;
  }

  /**
   * Generate a cache key from action and context
   * Key includes action name, category, and serialized parameters for uniqueness
   */
  private generateCacheKey(action: AgentAction, context?: BusinessContext): string {
    const keyParts = [
      action.name,
      action.category,
      action.agentId || '',
      context?.agentId || '',
      context?.environment || '',
      context?.dataClassification || ''
    ];

    // Include sorted parameters for consistent key generation
    if (action.parameters) {
      const sortedParams = Object.keys(action.parameters)
        .sort()
        .map(k => `${k}:${JSON.stringify(action.parameters![k])}`)
        .join('|');
      keyParts.push(sortedParams);
    }

    return keyParts.join('::');
  }

  /**
   * Check if a cached evaluation is still valid (within TTL)
   */
  private isCacheValid(cached: CachedEvaluation): boolean {
    return Date.now() - cached.cachedAt < this.cacheTtlMs;
  }

  /**
   * Get cached evaluation if available and valid
   */
  private getCachedEvaluation(cacheKey: string): EvaluationResult | null {
    const cached = this.evaluationCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return cached.result;
    }
    // Remove expired entry
    if (cached) {
      this.evaluationCache.delete(cacheKey);
    }
    return null;
  }

  /**
   * Store evaluation result in cache
   */
  private cacheEvaluation(cacheKey: string, result: EvaluationResult): void {
    this.evaluationCache.set(cacheKey, {
      result,
      cachedAt: Date.now()
    });
  }

  /**
   * Clear the evaluation cache
   * Call this when rules are modified or when cache should be invalidated
   */
  clearCache(): void {
    this.evaluationCache.clear();
  }

  /**
   * Set the cache TTL in milliseconds
   * @param ttlMs - Time to live in milliseconds (minimum 1000ms)
   */
  setCacheTtl(ttlMs: number): void {
    this.cacheTtlMs = Math.max(1000, ttlMs);
  }

  /**
   * Get current cache TTL in milliseconds
   */
  getCacheTtl(): number {
    return this.cacheTtlMs;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; ttlMs: number } {
    return {
      size: this.evaluationCache.size,
      ttlMs: this.cacheTtlMs
    };
  }

  /**
   * Evaluate an agent action
   * Main entry point for action governance
   * Results are cached for identical actions within the TTL period
   */
  async evaluateAction(
    action: AgentAction,
    context?: BusinessContext
  ): Promise<EvaluationResult> {
    await this.ensureInitialized();

    const actionId = action.id || uuidv4();
    const enrichedAction = { ...action, id: actionId };

    // Generate cache key and check for cached result
    const cacheKey = this.generateCacheKey(enrichedAction, context);
    const cachedResult = this.getCachedEvaluation(cacheKey);
    if (cachedResult) {
      // Return cached result with updated actionId and timestamp
      return {
        ...cachedResult,
        actionId,
        evaluatedAt: new Date().toISOString(),
        cached: true
      };
    }

    // Check rate limits first
    if (this.config.features.rateLimiting) {
      const rateLimitCheck = this.rateLimiter.checkLimit({
        agentId: context?.agentId || action.agentId,
        sessionId: context?.sessionId || action.sessionId,
        userId: context?.userId,
        actionCategory: action.category,
        actionType: action.name
      });

      if (!rateLimitCheck.allowed) {
        await this.auditLogger.logRateLimitHit(
          action.name,
          rateLimitCheck.limitId!,
          action.agentId
        );

        return {
          actionId,
          status: 'rate_limited',
          riskScore: 0,
          riskLevel: 'minimal',
          allowed: false,
          violations: [],
          warnings: [`Rate limit exceeded: ${rateLimitCheck.limitId}`],
          appliedRules: [],
          requiresHumanApproval: false,
          rateLimitInfo: rateLimitCheck.state ? {
            limited: true,
            remaining: rateLimitCheck.state.remaining,
            resetAt: rateLimitCheck.state.resetAt
          } : undefined,
          evaluatedAt: new Date().toISOString()
        };
      }
    }

    // Evaluate rules
    const evaluation = this.rulesEngine.evaluateAction(enrichedAction, context);

    // Check risk threshold for auto-approval requirement
    if (
      this.config.features.humanApproval &&
      evaluation.riskScore >= this.config.requireApprovalAboveRisk &&
      !evaluation.requiresHumanApproval
    ) {
      evaluation.requiresHumanApproval = true;
      evaluation.approvalReason = `Risk score (${evaluation.riskScore}) exceeds threshold (${this.config.requireApprovalAboveRisk})`;
      evaluation.status = 'pending_approval';
    }

    // Strict mode enforcement
    if (this.config.strictMode && evaluation.riskScore >= this.config.defaultRiskThreshold) {
      evaluation.allowed = false;
      evaluation.status = 'denied';
    }

    // Architecture change detection
    if (this.config.features.architectureValidation) {
      const archUpdate = ArchitectureDetector.detectChanges(enrichedAction, context);
      if (archUpdate) {
        evaluation.claudeMdUpdate = archUpdate;
      }
    }

    // Record the request for rate limiting
    if (this.config.features.rateLimiting) {
      this.rateLimiter.recordRequest({
        agentId: context?.agentId || action.agentId,
        sessionId: context?.sessionId || action.sessionId,
        userId: context?.userId,
        actionCategory: action.category,
        actionType: action.name
      });
    }

    // Audit logging
    if (this.config.features.auditLogging) {
      await this.auditLogger.logActionEvaluated(
        action.name,
        evaluation.allowed ? 'success' : 'failure',
        {
          actionId,
          category: action.category,
          riskScore: evaluation.riskScore,
          riskLevel: evaluation.riskLevel,
          status: evaluation.status,
          violationCount: evaluation.violations.length,
          rulesApplied: evaluation.appliedRules.length
        }
      );
    }

    // Cache the evaluation result for future identical actions
    this.cacheEvaluation(cacheKey, evaluation);

    return evaluation;
  }

  /**
   * Apply business rules to a context
   */
  async applyBusinessRules(context: BusinessContext): Promise<BusinessRulesResult> {
    await this.ensureInitialized();

    const result = this.rulesEngine.applyBusinessRules(context);

    if (this.config.features.auditLogging) {
      await this.auditLogger.log({
        eventType: 'action_evaluated',
        action: 'apply_business_rules',
        outcome: 'success',
        agentId: context.agentId,
        sessionId: context.sessionId,
        userId: context.userId,
        details: {
          contextId: result.contextId,
          rulesApplied: result.rulesApplied.length,
          constraintsFound: result.constraints.length,
          riskScore: result.aggregateRiskScore
        }
      });
    }

    return result;
  }

  /**
   * Request human approval for an action (in-memory storage)
   *
   * Note: GitHub-based approvals have been removed. Use GitHub MCP separately.
   * This method now uses in-memory storage for approval requests.
   */
  async requireHumanApproval(params: {
    reason: string;
    actionId?: string;
    action?: string;
    details?: string | Record<string, unknown>;
    priority?: 'urgent' | 'high' | 'normal' | 'low';
    context?: BusinessContext;
    riskScore?: number;
    violations?: string[];
    warnings?: string[];
  }): Promise<ApprovalRequest> {
    await this.ensureInitialized();

    const requestId = `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const actionId = params.actionId || `action-${Date.now()}`;

    const approval: ApprovalRequest = {
      requestId,
      actionId,
      reason: params.reason,
      status: 'pending',
      priority: params.priority || 'normal',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      context: params.context,
      riskScore: params.riskScore,
      metadata: {
        action: params.action || 'Unspecified action',
        warnings: params.warnings
      }
    };

    // Store in memory
    this.approvalRequests.set(requestId, approval);

    // Log the approval request
    await this.auditLogger.log({
      eventType: 'approval_requested',
      action: params.action || 'approval_requested',
      outcome: 'pending',
      details: {
        requestId: approval.requestId,
        reason: params.reason,
        riskScore: params.riskScore
      }
    });

    return approval;
  }

  /**
   * Log an event
   */
  async logEvent(params: {
    action: string;
    metadata?: Record<string, unknown>;
    eventType?: AuditEvent['eventType'];
    outcome?: 'success' | 'failure' | 'pending';
    agentId?: string;
    sessionId?: string;
    userId?: string;
  }): Promise<AuditEvent> {
    return this.auditLogger.log({
      eventType: params.eventType || 'custom',
      action: params.action,
      outcome: params.outcome || 'success',
      agentId: params.agentId,
      sessionId: params.sessionId,
      userId: params.userId,
      metadata: params.metadata
    });
  }

  // ============================================================================
  // RULE MANAGEMENT
  // ============================================================================

  /**
   * Add a custom rule
   * Invalidates the evaluation cache since rules have changed
   */
  addRule(rule: BusinessRule): void {
    this.rulesEngine.registerRule(rule);
    this.clearCache();
  }

  /**
   * Remove a rule
   * Invalidates the evaluation cache since rules have changed
   */
  removeRule(ruleId: string): boolean {
    const result = this.rulesEngine.unregisterRule(ruleId);
    if (result) {
      this.clearCache();
    }
    return result;
  }

  /**
   * Get all rules
   */
  getRules(): BusinessRule[] {
    return this.rulesEngine.getRules();
  }

  /**
   * Add rate limit configuration
   */
  addRateLimit(config: RateLimitConfig): void {
    this.rateLimiter.registerLimit(config);
  }

  /**
   * Remove rate limit
   */
  removeRateLimit(configId: string): boolean {
    return this.rateLimiter.removeLimit(configId);
  }

  // ============================================================================
  // APPROVAL MANAGEMENT (In-memory - GitHub integration removed)
  // ============================================================================

  /**
   * Approve a pending request (in-memory)
   */
  async approveRequest(
    requestId: string,
    approverId: string,
    comments?: string
  ): Promise<void> {
    const approval = this.approvalRequests.get(requestId);
    if (!approval) {
      throw new Error(`Approval request not found: ${requestId}`);
    }

    approval.status = 'approved';
    approval.metadata = {
      ...approval.metadata,
      reviewedAt: new Date().toISOString(),
      reviewedBy: approverId,
      comments
    };
    this.approvalRequests.set(requestId, approval);

    await this.auditLogger.log({
      eventType: 'approval_granted',
      action: `Approval granted for ${requestId}`,
      outcome: 'success',
      userId: approverId,
      details: { requestId, comments }
    });
  }

  /**
   * Deny a pending request (in-memory)
   */
  async denyRequest(
    requestId: string,
    denierId: string,
    reason?: string
  ): Promise<void> {
    const approval = this.approvalRequests.get(requestId);
    if (!approval) {
      throw new Error(`Approval request not found: ${requestId}`);
    }

    approval.status = 'denied';
    approval.metadata = {
      ...approval.metadata,
      reviewedAt: new Date().toISOString(),
      reviewedBy: denierId,
      denialReason: reason
    };
    this.approvalRequests.set(requestId, approval);

    await this.auditLogger.log({
      eventType: 'approval_denied',
      action: `Approval denied for ${requestId}`,
      outcome: 'success',
      userId: denierId,
      details: { requestId, reason }
    });
  }

  /**
   * Get pending approvals (in-memory)
   */
  async getPendingApprovals(): Promise<ApprovalRequest[]> {
    const now = Date.now();
    const pending: ApprovalRequest[] = [];

    for (const approval of this.approvalRequests.values()) {
      // Check if expired
      if (approval.expiresAt && new Date(approval.expiresAt).getTime() < now) {
        approval.status = 'expired';
        continue;
      }
      if (approval.status === 'pending') {
        pending.push(approval);
      }
    }

    return pending;
  }

  /**
   * Check if request is approved (in-memory)
   */
  async isApproved(requestId: string): Promise<boolean> {
    const approval = this.approvalRequests.get(requestId);
    return approval?.status === 'approved';
  }

  // ============================================================================
  // AUDIT & REPORTING
  // ============================================================================

  /**
   * Get audit events
   */
  getAuditEvents(filter?: Parameters<AuditLogger['getEvents']>[0]): AuditEvent[] {
    return this.auditLogger.getEvents(filter);
  }

  /**
   * Get audit statistics
   */
  getAuditStats(since?: string): ReturnType<AuditLogger['getStats']> {
    return this.auditLogger.getStats(since);
  }

  /**
   * Export audit log
   */
  exportAuditLog(filter?: Parameters<AuditLogger['getEvents']>[0]): string {
    return this.auditLogger.exportEvents(filter);
  }

  /**
   * Get approval statistics (in-memory)
   */
  async getApprovalStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    denied: number;
    expired: number;
    byPriority: Record<string, number>;
  }> {
    let total = 0;
    let pending = 0;
    let approved = 0;
    let denied = 0;
    let expired = 0;
    const byPriority: Record<string, number> = {};

    for (const approval of this.approvalRequests.values()) {
      total++;
      switch (approval.status) {
        case 'pending': pending++; break;
        case 'approved': approved++; break;
        case 'denied': denied++; break;
        case 'expired': expired++; break;
      }
      if (approval.status === 'pending') {
        byPriority[approval.priority] = (byPriority[approval.priority] || 0) + 1;
      }
    }

    return { total, pending, approved, denied, expired, byPriority };
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  /**
   * Get current configuration
   */
  getConfig(): SupervisorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<SupervisorConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };

    await this.auditLogger.logConfigChanged(
      'update_supervisor_config',
      'config_update',
      {
        changes: Object.keys(updates),
        oldValues: oldConfig,
        newValues: this.config
      }
    );
  }

  /**
   * Load preset configuration
   * Invalidates the evaluation cache since rules have changed
   */
  async loadPreset(preset: keyof typeof rulePresets): Promise<void> {
    const presetConfig = rulePresets[preset];
    if (!presetConfig) {
      throw new Error(`Unknown preset: ${preset}`);
    }

    // Clear existing and load preset
    this.rulesEngine = new RulesEngine();
    this.rateLimiter.clearBuckets();
    this.clearCache();

    this.rulesEngine.registerRules(presetConfig.rules);
    this.rateLimiter.registerLimits(presetConfig.rateLimits);

    await this.auditLogger.logConfigChanged(
      'load_preset',
      'preset_loaded',
      { preset }
    );
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private buildConfig(partial?: Partial<SupervisorConfig>): SupervisorConfig {
    return {
      version: partial?.version || '1.3.1',
      name: partial?.name || 'Agent Supervisor',
      environment: partial?.environment || 'development',
      strictMode: partial?.strictMode ?? false,
      defaultRiskThreshold: partial?.defaultRiskThreshold ?? 70,
      requireApprovalAboveRisk: partial?.requireApprovalAboveRisk ?? 80,
      features: {
        riskScoring: partial?.features?.riskScoring ?? true,
        rateLimiting: partial?.features?.rateLimiting ?? true,
        auditLogging: partial?.features?.auditLogging ?? true,
        humanApproval: partial?.features?.humanApproval ?? true,
        complianceChecks: partial?.features?.complianceChecks ?? true,
        uxValidation: partial?.features?.uxValidation ?? true,
        architectureValidation: partial?.features?.architectureValidation ?? true
      },
      rateLimits: partial?.rateLimits ?? defaultRateLimits,
      rules: partial?.rules ?? allBuiltInRules,
      complianceFrameworks: partial?.complianceFrameworks ?? [],
      notifications: {
        enabled: partial?.notifications?.enabled ?? false,
        webhookUrl: partial?.notifications?.webhookUrl,
        alertOnRiskLevel: partial?.notifications?.alertOnRiskLevel ?? 'high'
      }
    };
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Reload audit log from database
   */
  async reloadAuditLog(): Promise<void> {
    await this.auditLogger.reload();
  }
}

// Export singleton for convenience with shared audit database
export const supervisor = new AgentSupervisor({
  auditOptions: {
    dbPath: process.env.AUDIT_DB_PATH || '/tmp/agent-supervisor/audit.db'
  }
});
