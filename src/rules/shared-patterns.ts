/**
 * Enterprise Agent Supervisor - Shared Rule Patterns
 *
 * Reusable patterns and factory functions for common governance rules.
 * These patterns eliminate duplication across rule files and ensure consistency.
 */

import type { BusinessRule, RuleCondition, RuleAction } from '../types/index.js';

// ============================================================================
// PATTERN HELPERS
// ============================================================================

/**
 * Generate a unique rule ID with optional suffix
 */
export function generateRuleId(prefix: string, base: string, suffix?: string): string {
  return suffix ? `${prefix}-${base}-${suffix}` : `${prefix}-${base}`;
}

// ============================================================================
// AUDIT LOGGING PATTERNS (Task #26)
// ============================================================================

/**
 * Common conditions for audit logging
 */
export const AUDIT_CATEGORIES = ['data_modification', 'authorization', 'financial', 'pii_access'] as const;

/**
 * Base audit logging action - can be extended with additional actions
 */
export const AUDIT_LOG_ACTION: RuleAction = { type: 'log' };

/**
 * Create an audit logging rule with consistent structure
 */
export function createAuditLoggingRule(config: {
  id: string;
  name: string;
  description: string;
  categories?: readonly string[];
  additionalConditions?: RuleCondition[];
  additionalActions?: RuleAction[];
  priority?: number;
  riskWeight?: number;
  tags?: string[];
}): BusinessRule {
  const conditions: RuleCondition[] = [];

  if (config.categories && config.categories.length > 0) {
    conditions.push({
      field: 'actionCategory',
      operator: 'in',
      value: [...config.categories]
    });
  }

  if (config.additionalConditions) {
    conditions.push(...config.additionalConditions);
  }

  return {
    id: config.id,
    name: config.name,
    description: config.description,
    type: 'compliance',
    enabled: true,
    priority: config.priority ?? 800,
    conditions,
    conditionLogic: 'all',
    actions: [AUDIT_LOG_ACTION, ...(config.additionalActions ?? [])],
    riskWeight: config.riskWeight ?? 5,
    tags: ['audit', 'logging', ...(config.tags ?? [])]
  };
}

/**
 * Specialized audit rule for specific data types (PHI, PII, etc.)
 */
export function createDataTypeAuditRule(config: {
  id: string;
  name: string;
  dataType: string;
  framework?: string;
  priority?: number;
  riskWeight?: number;
}): BusinessRule {
  return createAuditLoggingRule({
    id: config.id,
    name: config.name,
    description: `Ensures all ${config.dataType.toUpperCase()} access is logged`,
    additionalConditions: [
      { field: 'dataType', operator: 'equals', value: config.dataType }
    ],
    additionalActions: [{ type: 'allow' }],
    priority: config.priority ?? 950,
    riskWeight: config.riskWeight ?? 10,
    tags: config.framework ? [config.framework, config.dataType, 'audit'] : [config.dataType, 'audit']
  });
}

// ============================================================================
// ENCRYPTION REQUIREMENT PATTERNS (Task #27)
// ============================================================================

/**
 * Common encryption check conditions
 */
export const ENCRYPTION_CONDITION: RuleCondition = {
  field: 'encryptionEnabled',
  operator: 'not_equals',
  value: true
};

export const HTTPS_PROTOCOL_CONDITION: RuleCondition = {
  field: 'protocol',
  operator: 'not_equals',
  value: 'https'
};

export const TLS_CONDITION: RuleCondition = {
  field: 'tlsEnabled',
  operator: 'not_equals',
  value: true
};

/**
 * Create an encryption requirement rule
 */
export function createEncryptionRule(config: {
  id: string;
  name: string;
  description: string;
  encryptionType: 'data' | 'transport' | 'tls';
  scope: {
    category?: string;
    dataType?: string;
    protocol?: string | string[];
    environment?: 'production' | 'all';
    framework?: string;
  };
  actionType?: 'deny' | 'warn';
  message: string;
  priority?: number;
  riskWeight?: number;
  tags?: string[];
}): BusinessRule {
  const conditions: RuleCondition[] = [];

  // Add scope conditions
  if (config.scope.category) {
    conditions.push({
      field: 'actionCategory',
      operator: config.scope.category.includes(',') ? 'in' : 'equals',
      value: config.scope.category.includes(',') ? config.scope.category.split(',') : config.scope.category
    });
  }

  if (config.scope.dataType) {
    conditions.push({
      field: 'dataType',
      operator: 'equals',
      value: config.scope.dataType
    });
  }

  if (config.scope.protocol) {
    conditions.push({
      field: 'protocol',
      operator: Array.isArray(config.scope.protocol) ? 'in' : 'equals',
      value: config.scope.protocol
    });
  }

  if (config.scope.environment === 'production') {
    conditions.push({
      field: 'environment',
      operator: 'equals',
      value: 'production'
    });
  }

  if (config.scope.framework) {
    conditions.push({
      field: 'framework',
      operator: 'equals',
      value: config.scope.framework
    });
  }

  // Add encryption check based on type
  switch (config.encryptionType) {
    case 'data':
      conditions.push(ENCRYPTION_CONDITION);
      break;
    case 'transport':
      conditions.push(HTTPS_PROTOCOL_CONDITION);
      break;
    case 'tls':
      conditions.push(TLS_CONDITION);
      break;
  }

  return {
    id: config.id,
    name: config.name,
    description: config.description,
    type: 'security',
    enabled: true,
    priority: config.priority ?? 940,
    conditions,
    conditionLogic: 'all',
    actions: [{ type: config.actionType ?? 'deny', message: config.message }],
    riskWeight: config.riskWeight ?? 45,
    tags: ['encryption', 'security', ...(config.tags ?? [])]
  };
}

// ============================================================================
// INPUT VALIDATION PATTERNS (Task #28)
// ============================================================================

/**
 * Common validation check condition
 */
export const VALIDATION_REQUIRED_CONDITION: RuleCondition = {
  field: 'inputValidation',
  operator: 'not_equals',
  value: true
};

export const FILE_VALIDATION_CONDITION: RuleCondition = {
  field: 'fileValidation',
  operator: 'not_equals',
  value: true
};

export const MESSAGE_VALIDATION_CONDITION: RuleCondition = {
  field: 'messageValidation',
  operator: 'not_equals',
  value: true
};

export const SIGNATURE_VALIDATION_CONDITION: RuleCondition = {
  field: 'signatureValidated',
  operator: 'not_equals',
  value: true
};

/**
 * Create an input validation rule
 */
export function createValidationRule(config: {
  id: string;
  name: string;
  description: string;
  validationType: 'input' | 'file' | 'message' | 'signature' | 'schema';
  scope: {
    category?: string;
    actionName?: string;
    protocol?: string | string[];
    provider?: string;
    operation?: string;
  };
  actionType?: 'deny' | 'warn';
  message: string;
  priority?: number;
  riskWeight?: number;
  tags?: string[];
}): BusinessRule {
  const conditions: RuleCondition[] = [];

  // Add scope conditions
  if (config.scope.category) {
    conditions.push({
      field: 'actionCategory',
      operator: 'equals',
      value: config.scope.category
    });
  }

  if (config.scope.actionName) {
    conditions.push({
      field: 'actionName',
      operator: 'contains',
      value: config.scope.actionName
    });
  }

  if (config.scope.protocol) {
    conditions.push({
      field: 'protocol',
      operator: Array.isArray(config.scope.protocol) ? 'in' : 'equals',
      value: config.scope.protocol
    });
  }

  if (config.scope.provider) {
    conditions.push({
      field: 'provider',
      operator: 'equals',
      value: config.scope.provider
    });
  }

  if (config.scope.operation) {
    conditions.push({
      field: 'operation',
      operator: 'equals',
      value: config.scope.operation
    });
  }

  // Add validation check based on type
  switch (config.validationType) {
    case 'input':
      conditions.push(VALIDATION_REQUIRED_CONDITION);
      break;
    case 'file':
      conditions.push(FILE_VALIDATION_CONDITION);
      break;
    case 'message':
      conditions.push(MESSAGE_VALIDATION_CONDITION);
      break;
    case 'signature':
      conditions.push(SIGNATURE_VALIDATION_CONDITION);
      break;
    case 'schema':
      conditions.push({
        field: 'schemaValidation',
        operator: 'not_equals',
        value: true
      });
      break;
  }

  return {
    id: config.id,
    name: config.name,
    description: config.description,
    type: 'security',
    enabled: true,
    priority: config.priority ?? 920,
    conditions,
    conditionLogic: 'all',
    actions: [{ type: config.actionType ?? 'deny', message: config.message }],
    riskWeight: config.riskWeight ?? 40,
    tags: ['validation', 'security', ...(config.tags ?? [])]
  };
}

// ============================================================================
// RATE LIMITING PATTERNS (Task #29)
// ============================================================================

/**
 * Common rate limiting check condition
 */
export const RATE_LIMIT_ENABLED_CONDITION: RuleCondition = {
  field: 'rateLimitEnabled',
  operator: 'not_equals',
  value: true
};

export const MESSAGE_RATE_LIMIT_CONDITION: RuleCondition = {
  field: 'messageRateLimitEnabled',
  operator: 'not_equals',
  value: true
};

/**
 * Create a rate limit check rule
 */
export function createRateLimitRule(config: {
  id: string;
  name: string;
  description: string;
  limitType: 'message' | 'api' | 'notification' | 'general';
  scope: {
    category?: string;
    actionName?: string;
    protocol?: string | string[];
    provider?: string;
  };
  threshold?: {
    field: string;
    value: number;
  };
  actionType?: 'rate_limit' | 'warn';
  message: string;
  priority?: number;
  riskWeight?: number;
  tags?: string[];
}): BusinessRule {
  const conditions: RuleCondition[] = [];

  // Add scope conditions
  if (config.scope.category) {
    conditions.push({
      field: 'actionCategory',
      operator: 'equals',
      value: config.scope.category
    });
  }

  if (config.scope.actionName) {
    conditions.push({
      field: 'actionName',
      operator: 'contains',
      value: config.scope.actionName
    });
  }

  if (config.scope.protocol) {
    conditions.push({
      field: 'protocol',
      operator: Array.isArray(config.scope.protocol) ? 'in' : 'equals',
      value: config.scope.protocol
    });
  }

  if (config.scope.provider) {
    conditions.push({
      field: 'provider',
      operator: 'equals',
      value: config.scope.provider
    });
  }

  // Add rate limit condition or threshold
  if (config.threshold) {
    conditions.push({
      field: config.threshold.field,
      operator: 'greater_than',
      value: config.threshold.value
    });
  } else {
    // Add default rate limit check based on type
    switch (config.limitType) {
      case 'message':
        conditions.push(MESSAGE_RATE_LIMIT_CONDITION);
        break;
      case 'api':
        conditions.push({
          field: 'respectsRateLimits',
          operator: 'not_equals',
          value: true
        });
        break;
      case 'notification':
        conditions.push({
          field: 'notificationsLastHour',
          operator: 'greater_than',
          value: 10
        });
        break;
      default:
        conditions.push(RATE_LIMIT_ENABLED_CONDITION);
    }
  }

  return {
    id: config.id,
    name: config.name,
    description: config.description,
    type: config.limitType === 'notification' ? 'ux' : 'security',
    enabled: true,
    priority: config.priority ?? 850,
    conditions,
    conditionLogic: 'all',
    actions: [{ type: config.actionType ?? 'warn', message: config.message }],
    riskWeight: config.riskWeight ?? 30,
    tags: ['rate-limiting', ...(config.tags ?? [])]
  };
}

// ============================================================================
// PRODUCTION ENVIRONMENT PATTERNS (Task #30)
// ============================================================================

/**
 * Production environment condition - reusable across rules
 */
export const PRODUCTION_ENV_CONDITION: RuleCondition = {
  field: 'environment',
  operator: 'equals',
  value: 'production'
};

/**
 * Create a production environment check rule
 */
export function createProductionRule(config: {
  id: string;
  name: string;
  description: string;
  checkType: 'config' | 'security' | 'monitoring' | 'deployment';
  configField: string;
  expectedValue?: unknown;
  negated?: boolean; // true means field should NOT equal expectedValue
  additionalConditions?: RuleCondition[];
  actionType?: 'deny' | 'warn' | 'require_approval';
  message: string;
  priority?: number;
  riskWeight?: number;
  tags?: string[];
}): BusinessRule {
  const conditions: RuleCondition[] = [PRODUCTION_ENV_CONDITION];

  // Add the config field check
  if (config.negated) {
    conditions.push({
      field: config.configField,
      operator: 'not_equals',
      value: config.expectedValue ?? true
    });
  } else if (config.expectedValue !== undefined) {
    conditions.push({
      field: config.configField,
      operator: 'equals',
      value: config.expectedValue
    });
  } else {
    conditions.push({
      field: config.configField,
      operator: 'not_exists',
      value: null
    });
  }

  if (config.additionalConditions) {
    conditions.push(...config.additionalConditions);
  }

  // Determine rule type based on check type
  const ruleTypeMap: Record<string, BusinessRule['type']> = {
    config: 'security',
    security: 'security',
    monitoring: 'operational',
    deployment: 'operational'
  };

  return {
    id: config.id,
    name: config.name,
    description: config.description,
    type: ruleTypeMap[config.checkType] ?? 'security',
    enabled: true,
    priority: config.priority ?? 900,
    conditions,
    conditionLogic: 'all',
    actions: [{ type: config.actionType ?? 'warn', message: config.message }],
    riskWeight: config.riskWeight ?? 35,
    tags: ['production', config.checkType, ...(config.tags ?? [])]
  };
}

/**
 * Create a production debug mode check (common pattern)
 */
export function createDebugModeRule(config: {
  id: string;
  framework: string;
  debugField?: string;
  priority?: number;
  riskWeight?: number;
}): BusinessRule {
  return createProductionRule({
    id: config.id,
    name: `Prohibit ${config.framework} Debug Mode in Production`,
    description: `${config.framework} debug mode must be disabled in production environments`,
    checkType: 'security',
    configField: config.debugField ?? `${config.framework.toLowerCase()}DebugEnabled`,
    expectedValue: true,
    negated: false, // We want to match when debug IS enabled
    additionalConditions: [
      { field: config.debugField ?? `${config.framework.toLowerCase()}DebugEnabled`, operator: 'equals' as const, value: true }
    ].filter(() => false), // Already handled above
    actionType: 'deny',
    message: `${config.framework} debug mode is prohibited in production (security risk)`,
    priority: config.priority ?? 990,
    riskWeight: config.riskWeight ?? 70,
    tags: [config.framework.toLowerCase(), 'debug']
  });
}

/**
 * Create a production HTTPS requirement rule
 */
export function createProductionHttpsRule(config: {
  id: string;
  framework?: string;
  protocol?: string;
  httpsField?: string;
  actionType?: 'deny' | 'warn';
  priority?: number;
  riskWeight?: number;
}): BusinessRule {
  const conditions: RuleCondition[] = [PRODUCTION_ENV_CONDITION];

  if (config.framework) {
    conditions.push({
      field: 'framework',
      operator: 'equals',
      value: config.framework
    });
  }

  if (config.protocol) {
    conditions.push({
      field: 'protocol',
      operator: 'in',
      value: [config.protocol]
    });
  }

  conditions.push({
    field: config.httpsField ?? 'httpsEnforced',
    operator: 'not_equals',
    value: true
  });

  const name = config.protocol
    ? `${config.protocol} TLS Requirement`
    : config.framework
      ? `Require HTTPS for ${config.framework} in Production`
      : 'Require HTTPS in Production';

  return {
    id: config.id,
    name,
    description: 'Production connections must use encrypted transport',
    type: 'security',
    enabled: true,
    priority: config.priority ?? 940,
    conditions,
    conditionLogic: 'all',
    actions: [{
      type: config.actionType ?? 'warn',
      message: 'Production connections must use HTTPS/TLS encrypted transport'
    }],
    riskWeight: config.riskWeight ?? 45,
    tags: ['https', 'tls', 'encryption', 'production', ...(config.framework ? [config.framework.toLowerCase()] : [])]
  };
}

/**
 * Create a production monitoring requirement rule
 */
export function createProductionMonitoringRule(config: {
  id: string;
  name: string;
  description: string;
  monitoringField: string;
  platform?: string;
  message: string;
  priority?: number;
  riskWeight?: number;
  tags?: string[];
}): BusinessRule {
  const conditions: RuleCondition[] = [PRODUCTION_ENV_CONDITION];

  if (config.platform) {
    conditions.push({
      field: 'platform',
      operator: 'equals',
      value: config.platform
    });
  }

  conditions.push({
    field: config.monitoringField,
    operator: 'not_equals',
    value: true
  });

  return {
    id: config.id,
    name: config.name,
    description: config.description,
    type: 'operational',
    enabled: true,
    priority: config.priority ?? 860,
    conditions,
    conditionLogic: 'all',
    actions: [{ type: 'warn', message: config.message }],
    riskWeight: config.riskWeight ?? 25,
    tags: ['monitoring', 'production', 'observability', ...(config.tags ?? [])]
  };
}

// ============================================================================
// EXPORTED PATTERN COLLECTIONS
// ============================================================================

/**
 * All shared pattern factory functions
 */
export const sharedPatterns = {
  // Audit logging
  createAuditLoggingRule,
  createDataTypeAuditRule,
  AUDIT_CATEGORIES,
  AUDIT_LOG_ACTION,

  // Encryption
  createEncryptionRule,
  ENCRYPTION_CONDITION,
  HTTPS_PROTOCOL_CONDITION,
  TLS_CONDITION,

  // Validation
  createValidationRule,
  VALIDATION_REQUIRED_CONDITION,
  FILE_VALIDATION_CONDITION,
  MESSAGE_VALIDATION_CONDITION,
  SIGNATURE_VALIDATION_CONDITION,

  // Rate limiting
  createRateLimitRule,
  RATE_LIMIT_ENABLED_CONDITION,
  MESSAGE_RATE_LIMIT_CONDITION,

  // Production environment
  createProductionRule,
  createDebugModeRule,
  createProductionHttpsRule,
  createProductionMonitoringRule,
  PRODUCTION_ENV_CONDITION
};

export default sharedPatterns;
