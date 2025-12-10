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
  evaluatedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional()
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
  metadata: z.record(z.unknown()).optional()
});

export type BusinessRule = z.infer<typeof BusinessRuleSchema>;

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
  version: z.string().default('1.0.0'),
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
