/**
 * Enterprise Agent Supervisor - Main Supervisor Class
 *
 * Orchestrates all governance components for agent supervision.
 */

import { v4 as uuidv4 } from 'uuid';
import { RulesEngine } from '../engine/RulesEngine.js';
import { RateLimiter } from '../engine/RateLimiter.js';
import { AuditLogger, type AuditLoggerOptions } from '../engine/AuditLogger.js';
import { ApprovalManager, type ApprovalManagerOptions } from '../engine/ApprovalManager.js';
import { AppMonitor, type AppMonitorOptions } from '../engine/AppMonitor.js';
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
  RateLimitConfig,
  MonitoredApp,
  AppHealthCheckResult,
  AppStatusHistoryEntry,
  AppMonitorStats
} from '../types/index.js';

export interface AgentSupervisorOptions {
  config?: Partial<SupervisorConfig>;
  auditOptions?: AuditLoggerOptions;
  approvalOptions?: ApprovalManagerOptions;
  appMonitorOptions?: AppMonitorOptions;
}

export class AgentSupervisor {
  private config: SupervisorConfig;
  private rulesEngine: RulesEngine;
  private rateLimiter: RateLimiter;
  private auditLogger: AuditLogger;
  private approvalManager: ApprovalManager;
  private appMonitor: AppMonitor;
  private initialized: boolean = false;

  constructor(options: AgentSupervisorOptions = {}) {
    // Initialize with defaults
    this.config = this.buildConfig(options.config);
    this.rulesEngine = new RulesEngine();
    this.rateLimiter = new RateLimiter();
    this.auditLogger = new AuditLogger(options.auditOptions);
    this.approvalManager = new ApprovalManager(options.approvalOptions);
    this.appMonitor = new AppMonitor(options.appMonitorOptions);
  }

  /**
   * Initialize the supervisor with configuration
   */
  async initialize(preset?: keyof typeof rulePresets): Promise<void> {
    if (this.initialized) {
      return;
    }

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
   * Evaluate an agent action
   * Main entry point for action governance
   */
  async evaluateAction(
    action: AgentAction,
    context?: BusinessContext
  ): Promise<EvaluationResult> {
    await this.ensureInitialized();

    const actionId = action.id || uuidv4();
    const enrichedAction = { ...action, id: actionId };

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
   * Request human approval for an action
   */
  async requireHumanApproval(params: {
    reason: string;
    actionId?: string;
    details?: string;
    priority?: 'urgent' | 'high' | 'normal' | 'low';
    context?: BusinessContext;
    riskScore?: number;
    metadata?: Record<string, unknown>;
  }): Promise<ApprovalRequest> {
    await this.ensureInitialized();

    return this.approvalManager.requestApproval(params);
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
   */
  addRule(rule: BusinessRule): void {
    this.rulesEngine.registerRule(rule);
  }

  /**
   * Remove a rule
   */
  removeRule(ruleId: string): boolean {
    return this.rulesEngine.unregisterRule(ruleId);
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
  // APPROVAL MANAGEMENT
  // ============================================================================

  /**
   * Approve a pending request
   */
  async approveRequest(
    requestId: string,
    approverId: string,
    comments?: string
  ): Promise<ApprovalRequest | null> {
    return this.approvalManager.approve(requestId, approverId, comments);
  }

  /**
   * Deny a pending request
   */
  async denyRequest(
    requestId: string,
    denierId: string,
    reason?: string
  ): Promise<ApprovalRequest | null> {
    return this.approvalManager.deny(requestId, denierId, reason);
  }

  /**
   * Get pending approvals
   */
  getPendingApprovals(): ApprovalRequest[] {
    return this.approvalManager.getPendingApprovals();
  }

  /**
   * Check if request is approved
   */
  isApproved(requestId: string): boolean {
    return this.approvalManager.isApproved(requestId);
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
   * Get approval statistics
   */
  getApprovalStats(): ReturnType<ApprovalManager['getStats']> {
    return this.approvalManager.getStats();
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
   */
  async loadPreset(preset: keyof typeof rulePresets): Promise<void> {
    const presetConfig = rulePresets[preset];
    if (!presetConfig) {
      throw new Error(`Unknown preset: ${preset}`);
    }

    // Clear existing and load preset
    this.rulesEngine = new RulesEngine();
    this.rateLimiter.clearBuckets();

    this.rulesEngine.registerRules(presetConfig.rules);
    this.rateLimiter.registerLimits(presetConfig.rateLimits);

    await this.auditLogger.logConfigChanged(
      'load_preset',
      'preset_loaded',
      { preset }
    );
  }

  // ============================================================================
  // APP MONITORING
  // ============================================================================

  /**
   * Add a production app to monitor
   */
  async addMonitoredApp(config: {
    name: string;
    path: string;
    port: number;
    description?: string;
    healthEndpoint?: string;
    expectedResponseCode?: number;
    checkIntervalMs?: number;
    timeoutMs?: number;
    tags?: string[];
    metadata?: Record<string, unknown>;
    autoStart?: boolean;
  }): Promise<MonitoredApp> {
    const app = await this.appMonitor.addApp(config);

    await this.auditLogger.log({
      eventType: 'system_event',
      action: 'app_added',
      outcome: 'success',
      details: {
        appId: app.id,
        appName: app.name,
        port: app.port,
        path: app.path
      }
    });

    return app;
  }

  /**
   * Remove a monitored app
   */
  async removeMonitoredApp(appId: string): Promise<boolean> {
    const app = this.appMonitor.getApp(appId);
    const result = this.appMonitor.removeApp(appId);

    if (result && app) {
      await this.auditLogger.log({
        eventType: 'system_event',
        action: 'app_removed',
        outcome: 'success',
        details: {
          appId,
          appName: app.name
        }
      });
    }

    return result;
  }

  /**
   * Get a monitored app by ID
   */
  getMonitoredApp(appId: string): MonitoredApp | undefined {
    return this.appMonitor.getApp(appId);
  }

  /**
   * Get a monitored app by name
   */
  getMonitoredAppByName(name: string): MonitoredApp | undefined {
    return this.appMonitor.getAppByName(name);
  }

  /**
   * Get all monitored apps
   */
  getAllMonitoredApps(): MonitoredApp[] {
    return this.appMonitor.getAllApps();
  }

  /**
   * Update a monitored app configuration
   */
  async updateMonitoredApp(
    appId: string,
    updates: Partial<Omit<MonitoredApp, 'id' | 'createdAt'>>
  ): Promise<MonitoredApp | undefined> {
    const result = this.appMonitor.updateApp(appId, updates);

    if (result) {
      await this.auditLogger.log({
        eventType: 'config_changed',
        action: 'app_updated',
        outcome: 'success',
        details: {
          appId,
          appName: result.name,
          updates: Object.keys(updates)
        }
      });
    }

    return result;
  }

  /**
   * Check health of a specific app
   */
  async checkAppHealth(appId: string): Promise<AppHealthCheckResult> {
    return this.appMonitor.checkAppHealth(appId);
  }

  /**
   * Check health of all monitored apps
   */
  async checkAllAppsHealth(): Promise<AppHealthCheckResult[]> {
    return this.appMonitor.checkAllApps();
  }

  /**
   * Get last health check result for an app
   */
  getLastAppHealthCheck(appId: string): AppHealthCheckResult | undefined {
    return this.appMonitor.getLastCheckResult(appId);
  }

  /**
   * Get status history for an app
   */
  getAppStatusHistory(appId: string, limit?: number): AppStatusHistoryEntry[] {
    return this.appMonitor.getStatusHistory(appId, limit);
  }

  /**
   * Enable/disable app monitoring
   */
  setAppMonitoringEnabled(appId: string, enabled: boolean): boolean {
    return this.appMonitor.setAppEnabled(appId, enabled);
  }

  /**
   * Get app monitoring statistics
   */
  getAppMonitorStats(): AppMonitorStats {
    return this.appMonitor.getStats();
  }

  /**
   * Find apps by tag
   */
  findAppsByTag(tag: string): MonitoredApp[] {
    return this.appMonitor.findAppsByTag(tag);
  }

  /**
   * Get apps that are currently offline
   */
  getOfflineApps(): MonitoredApp[] {
    return this.appMonitor.getOfflineApps();
  }

  /**
   * Get apps that are in degraded state
   */
  getDegradedApps(): MonitoredApp[] {
    return this.appMonitor.getDegradedApps();
  }

  /**
   * Scan production directory for potential apps
   */
  async scanForApps(): Promise<Array<{
    name: string;
    path: string;
    type: string;
    hasPackageJson: boolean;
    potentialPorts: number[];
  }>> {
    return this.appMonitor.scanForApps();
  }

  /**
   * Get logs for a monitored app
   */
  async getAppLogs(appId: string, lines?: number): Promise<{
    logs: string;
    source: string;
  }> {
    return this.appMonitor.getAppLogs(appId, lines);
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private buildConfig(partial?: Partial<SupervisorConfig>): SupervisorConfig {
    return {
      version: partial?.version || '1.0.0',
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
}

// Export singleton for convenience
export const supervisor = new AgentSupervisor();
