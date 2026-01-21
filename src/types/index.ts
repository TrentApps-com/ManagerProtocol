/**
 * Enterprise Agent Supervisor - Core Types
 *
 * Comprehensive type definitions for the rules engine and governance system.
 */

import { z } from 'zod';

// ============================================================================
// AGENT ACTION TYPES
// ============================================================================

export const ActionCategorySchema = z.enum([
  'data_access',
  'data_modification',
  'external_api',
  'file_system',
  'code_execution',
  'network',
  'authentication',
  'authorization',
  'financial',
  'pii_access',
  'system_config',
  'user_communication',
  'resource_allocation',
  'custom'
]);

export type ActionCategory = z.infer<typeof ActionCategorySchema>;

export const RiskLevelSchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
  'minimal'
]);

export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const ActionStatusSchema = z.enum([
  'approved',
  'denied',
  'pending_approval',
  'requires_review',
  'rate_limited',
  'escalated'
]);

export type ActionStatus = z.infer<typeof ActionStatusSchema>;

export const AgentActionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  category: ActionCategorySchema,
  description: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional()
});

export type AgentAction = z.infer<typeof AgentActionSchema>;

// ============================================================================
// EVALUATION RESULT TYPES
// ============================================================================

export const RuleViolationSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  severity: RiskLevelSchema,
  message: z.string(),
  recommendation: z.string().optional(),
  context: z.record(z.unknown()).optional()
});

export type RuleViolation = z.infer<typeof RuleViolationSchema>;

export const EvaluationResultSchema = z.object({
  actionId: z.string(),
  status: ActionStatusSchema,
  riskScore: z.number().min(0).max(100),
  riskLevel: RiskLevelSchema,
  allowed: z.boolean(),
  violations: z.array(RuleViolationSchema),
  warnings: z.array(z.string()),
  appliedRules: z.array(z.string()),
  requiresHumanApproval: z.boolean(),
  approvalReason: z.string().optional(),
  rateLimitInfo: z.object({
    limited: z.boolean(),
    remaining: z.number().optional(),
    resetAt: z.string().datetime().optional()
  }).optional(),
  claudeMdUpdate: z.object({
    needed: z.boolean(),
    reason: z.string(),
    suggestedContent: z.string(),
    section: z.string()
  }).optional(),
  evaluatedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
  cached: z.boolean().optional()
});

export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

// ============================================================================
// BUSINESS RULES TYPES
// ============================================================================

export const BusinessRuleTypeSchema = z.enum([
  'compliance',
  'security',
  'operational',
  'financial',
  'ux',
  'architecture',
  'data_governance',
  'rate_limit',
  'custom'
]);

export type BusinessRuleType = z.infer<typeof BusinessRuleTypeSchema>;

export const RuleConditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'greater_than',
  'less_than',
  'in',
  'not_in',
  'matches_regex',
  'exists',
  'not_exists',
  'custom'
]);

export type RuleConditionOperator = z.infer<typeof RuleConditionOperatorSchema>;

export const RuleConditionSchema = z.object({
  field: z.string(),
  operator: RuleConditionOperatorSchema,
  value: z.unknown(),
  customEvaluator: z.string().optional()
});

export type RuleCondition = z.infer<typeof RuleConditionSchema>;

export const RuleActionTypeSchema = z.enum([
  'allow',
  'deny',
  'require_approval',
  'warn',
  'log',
  'rate_limit',
  'transform',
  'escalate',
  'notify'
]);

export type RuleActionType = z.infer<typeof RuleActionTypeSchema>;

export const RuleActionSchema = z.object({
  type: RuleActionTypeSchema,
  message: z.string().optional(),
  params: z.record(z.unknown()).optional()
});

export type RuleAction = z.infer<typeof RuleActionSchema>;

export const BusinessRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: BusinessRuleTypeSchema,
  enabled: z.boolean().default(true),
  priority: z.number().min(0).max(1000).default(500),
  conditions: z.array(RuleConditionSchema),
  conditionLogic: z.enum(['all', 'any']).default('all'),
  actions: z.array(RuleActionSchema),
  riskWeight: z.number().min(0).max(100).default(10),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  // Task #39: Versioning and deprecation support
  version: z.string().optional(), // Semantic version of the rule (e.g., "1.0.0")
  deprecated: z.boolean().optional(), // Whether rule is deprecated
  deprecatedMessage: z.string().optional(), // Migration guidance for deprecated rules
  replacedBy: z.string().optional(), // ID of replacement rule
  minVersion: z.string().optional(), // Minimum supervisor version required
  // Task #37: Rule interdependency support
  dependsOn: z.array(z.string()).optional(), // Rule IDs this rule depends on (must be evaluated first)
  conflictsWith: z.array(z.string()).optional(), // Rule IDs that conflict (cannot both be active)
  relatedRules: z.array(z.string()).optional() // Related rule IDs for reference/documentation
});

export type BusinessRule = z.infer<typeof BusinessRuleSchema>;

// ============================================================================
// RULE DEPENDENCY TYPES (Task #37)
// ============================================================================

export const RuleDependencyNodeSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  dependencies: z.array(z.string()), // Rule IDs this rule depends on
  dependents: z.array(z.string()), // Rule IDs that depend on this rule
  conflicts: z.array(z.string()), // Rule IDs that conflict with this rule
  related: z.array(z.string()), // Related rule IDs for documentation
  depth: z.number() // Depth in dependency tree (0 = no dependencies)
});

export type RuleDependencyNode = z.infer<typeof RuleDependencyNodeSchema>;

export const RuleDependencyGraphSchema = z.object({
  nodes: z.record(RuleDependencyNodeSchema),
  executionOrder: z.array(z.string()), // Topologically sorted rule IDs
  hasCircularDependencies: z.boolean(),
  circularPaths: z.array(z.array(z.string())), // Paths that form cycles
  conflicts: z.array(z.object({
    ruleA: z.string(),
    ruleB: z.string(),
    reason: z.string().optional()
  })),
  orphanedDependencies: z.array(z.object({
    ruleId: z.string(),
    missingDependency: z.string()
  })),
  analyzedAt: z.string().datetime()
});

export type RuleDependencyGraph = z.infer<typeof RuleDependencyGraphSchema>;

export const DependencyValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.object({
    type: z.enum(['missing_dependency', 'circular_dependency', 'self_dependency', 'conflict']),
    ruleId: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional()
  })),
  warnings: z.array(z.object({
    type: z.enum(['unused_dependency', 'disabled_dependency', 'deep_dependency_chain']),
    ruleId: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional()
  })),
  validatedAt: z.string().datetime()
});

export type DependencyValidationResult = z.infer<typeof DependencyValidationResultSchema>;

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export const BusinessContextSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']).optional(),
  agentId: z.string().optional(),
  agentType: z.string().optional(),
  userId: z.string().optional(),
  userRole: z.string().optional(),
  sessionId: z.string().optional(),
  organizationId: z.string().optional(),
  department: z.string().optional(),
  costCenter: z.string().optional(),
  dataClassification: z.enum(['public', 'internal', 'confidential', 'restricted']).optional(),
  complianceFrameworks: z.array(z.string()).optional(),
  customAttributes: z.record(z.unknown()).optional()
});

export type BusinessContext = z.infer<typeof BusinessContextSchema>;

export const BusinessRulesResultSchema = z.object({
  contextId: z.string(),
  rulesApplied: z.array(z.object({
    ruleId: z.string(),
    ruleName: z.string(),
    matched: z.boolean(),
    actions: z.array(RuleActionSchema)
  })),
  aggregateRiskScore: z.number().min(0).max(100),
  recommendations: z.array(z.string()),
  constraints: z.array(z.object({
    type: z.string(),
    description: z.string(),
    enforced: z.boolean()
  })),
  processedAt: z.string().datetime()
});

export type BusinessRulesResult = z.infer<typeof BusinessRulesResultSchema>;

// ============================================================================
// APPROVAL TYPES
// ============================================================================

export const ApprovalPrioritySchema = z.enum([
  'urgent',
  'high',
  'normal',
  'low'
]);

export type ApprovalPriority = z.infer<typeof ApprovalPrioritySchema>;

export const ApprovalRequestSchema = z.object({
  requestId: z.string(),
  actionId: z.string().optional(),
  reason: z.string(),
  details: z.string().optional(),
  priority: ApprovalPrioritySchema.default('normal'),
  requiredApprovers: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
  context: BusinessContextSchema.optional(),
  riskScore: z.number().min(0).max(100).optional(),
  violations: z.array(RuleViolationSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  status: z.enum(['pending', 'approved', 'denied', 'expired', 'cancelled']).default('pending')
});

export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export const AuditEventTypeSchema = z.enum([
  'action_evaluated',
  'action_approved',
  'action_denied',
  'action_executed',
  'rule_triggered',
  'approval_requested',
  'approval_granted',
  'approval_denied',
  'rate_limit_hit',
  'security_alert',
  'compliance_violation',
  'config_changed',
  'system_event',
  'custom'
]);

export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

export const AuditEventSchema = z.object({
  eventId: z.string(),
  eventType: AuditEventTypeSchema,
  action: z.string(),
  timestamp: z.string().datetime(),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  outcome: z.enum(['success', 'failure', 'pending']),
  riskLevel: RiskLevelSchema.optional(),
  details: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  correlationId: z.string().optional(),
  parentEventId: z.string().optional()
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ============================================================================
// RATE LIMITING TYPES
// ============================================================================

export const RateLimitConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  windowMs: z.number().min(1000),
  maxRequests: z.number().min(1),
  scope: z.enum(['global', 'agent', 'session', 'user', 'action_type']),
  actionCategories: z.array(ActionCategorySchema).optional(),
  burstLimit: z.number().optional(),
  enabled: z.boolean().default(true)
});

export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

export const RateLimitStateSchema = z.object({
  key: z.string(),
  count: z.number(),
  windowStart: z.number(),
  remaining: z.number(),
  resetAt: z.string().datetime()
});

export type RateLimitState = z.infer<typeof RateLimitStateSchema>;

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export const SupervisorConfigSchema = z.object({
  version: z.string().default('1.1.1'),
  name: z.string().default('Agent Supervisor'),
  environment: z.enum(['development', 'staging', 'production']).default('development'),

  // Core settings
  strictMode: z.boolean().default(false),
  defaultRiskThreshold: z.number().min(0).max(100).default(70),
  requireApprovalAboveRisk: z.number().min(0).max(100).default(80),

  // Feature flags
  features: z.object({
    riskScoring: z.boolean().default(true),
    rateLimiting: z.boolean().default(true),
    auditLogging: z.boolean().default(true),
    humanApproval: z.boolean().default(true),
    complianceChecks: z.boolean().default(true),
    uxValidation: z.boolean().default(true),
    architectureValidation: z.boolean().default(true)
  }).default({}),

  // Rate limiting defaults
  rateLimits: z.array(RateLimitConfigSchema).default([]),

  // Business rules
  rules: z.array(BusinessRuleSchema).default([]),

  // Compliance frameworks to enforce
  complianceFrameworks: z.array(z.string()).default([]),

  // Notification settings
  notifications: z.object({
    enabled: z.boolean().default(false),
    webhookUrl: z.string().url().optional(),
    alertOnRiskLevel: RiskLevelSchema.default('high')
  }).default({})
});

export type SupervisorConfig = z.infer<typeof SupervisorConfigSchema>;

// ============================================================================
// APP MONITORING TYPES
// ============================================================================

export const AppStatusSchema = z.enum([
  'online',
  'offline',
  'degraded',
  'unknown',
  'starting',
  'stopping'
]);

export type AppStatus = z.infer<typeof AppStatusSchema>;

export const MonitoredAppSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  path: z.string().min(1), // Path in /mnt/prod/
  port: z.number().min(1).max(65535),
  description: z.string().optional(),
  healthEndpoint: z.string().optional(), // e.g., '/health' or '/api/health'
  expectedResponseCode: z.number().default(200),
  checkIntervalMs: z.number().min(5000).default(30000), // Default 30 seconds
  timeoutMs: z.number().min(1000).default(5000), // Default 5 seconds
  enabled: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional()
});

export type MonitoredApp = z.infer<typeof MonitoredAppSchema>;

export const AppHealthCheckResultSchema = z.object({
  appId: z.string(),
  appName: z.string(),
  status: AppStatusSchema,
  port: z.number(),
  path: z.string(),
  responseTimeMs: z.number().optional(),
  httpStatusCode: z.number().optional(),
  errorMessage: z.string().optional(),
  checkedAt: z.string().datetime(),
  processInfo: z.object({
    pid: z.number().optional(),
    memoryUsageMb: z.number().optional(),
    cpuPercent: z.number().optional(),
    uptime: z.string().optional()
  }).optional()
});

export type AppHealthCheckResult = z.infer<typeof AppHealthCheckResultSchema>;

export const AppStatusHistoryEntrySchema = z.object({
  appId: z.string(),
  status: AppStatusSchema,
  timestamp: z.string().datetime(),
  responseTimeMs: z.number().optional(),
  errorMessage: z.string().optional()
});

export type AppStatusHistoryEntry = z.infer<typeof AppStatusHistoryEntrySchema>;

export const AppMonitorStatsSchema = z.object({
  totalApps: z.number(),
  onlineApps: z.number(),
  offlineApps: z.number(),
  degradedApps: z.number(),
  unknownApps: z.number(),
  averageResponseTimeMs: z.number().optional(),
  lastFullCheckAt: z.string().datetime().optional()
});

export type AppMonitorStats = z.infer<typeof AppMonitorStatsSchema>;

// ============================================================================
// PROJECT TASK TYPES
// ============================================================================

export const TaskPrioritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low'
]);

export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'blocked',
  'cancelled'
]);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const ProjectTaskSchema = z.object({
  id: z.string(),
  projectName: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  labels: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().optional(),
  url: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export type ProjectTask = z.infer<typeof ProjectTaskSchema>;
