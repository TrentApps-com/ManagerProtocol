/**
 * Enterprise Agent Supervisor - Rule Pattern Builders
 *
 * Reusable pattern builders for creating common governance rules.
 * These builders provide sensible defaults while allowing full customization.
 *
 * Task #31: Create Shared Library for Common Rule Patterns
 */

import type { BusinessRule, RuleCondition, RuleAction, BusinessRuleType, ActionCategory } from '../types/index.js';

// ============================================================================
// TYPE DEFINITIONS FOR PATTERN OPTIONS
// ============================================================================

/**
 * Base options shared by all rule pattern builders
 */
export interface BaseRuleOptions {
  /** Unique rule ID (required) */
  id: string;
  /** Human-readable rule name (required) */
  name: string;
  /** Rule description */
  description?: string;
  /** Whether rule is enabled (default: true) */
  enabled?: boolean;
  /** Rule priority 0-1000 (higher = evaluated first) */
  priority?: number;
  /** Risk weight 0-100 for risk score calculation */
  riskWeight?: number;
  /** Tags for categorization and filtering */
  tags?: string[];
  /** Additional conditions to add */
  additionalConditions?: RuleCondition[];
  /** Override default actions */
  overrideActions?: RuleAction[];
  /** Additional actions to append */
  additionalActions?: RuleAction[];
  /** Condition logic: 'all' (AND) or 'any' (OR) */
  conditionLogic?: 'all' | 'any';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for authentication rules
 */
export interface AuthenticationRuleOptions extends BaseRuleOptions {
  /** Action categories requiring authentication (default: ['external_api']) */
  categories?: ActionCategory[];
  /** Field to check for auth token (default: 'authToken') */
  authTokenField?: string;
  /** Require specific auth types (e.g., 'bearer', 'api_key', 'oauth') */
  requiredAuthTypes?: string[];
  /** Allow unauthenticated in specific environments */
  allowUnauthenticatedIn?: ('development' | 'staging' | 'production')[];
  /** Action on failure: 'deny' | 'require_approval' | 'warn' */
  failureAction?: 'deny' | 'require_approval' | 'warn';
  /** Custom failure message */
  failureMessage?: string;
}

/**
 * Options for data access rules
 */
export interface DataAccessRuleOptions extends BaseRuleOptions {
  /** Data classification levels that trigger the rule */
  dataClassifications?: ('public' | 'internal' | 'confidential' | 'restricted')[];
  /** Data types that trigger the rule (e.g., 'pii', 'phi', 'cardholder') */
  dataTypes?: string[];
  /** Roles allowed to access (if empty, all roles blocked) */
  allowedRoles?: string[];
  /** Require justification for access */
  requireJustification?: boolean;
  /** Maximum record count before approval required */
  bulkThreshold?: number;
  /** Require encryption for access */
  requireEncryption?: boolean;
  /** Action on unauthorized access: 'deny' | 'require_approval' | 'warn' */
  unauthorizedAction?: 'deny' | 'require_approval' | 'warn';
  /** Custom message for unauthorized access */
  unauthorizedMessage?: string;
}

/**
 * Options for rate limit rules
 */
export interface RateLimitRuleOptions extends BaseRuleOptions {
  /** Action categories to rate limit */
  categories?: ActionCategory[];
  /** Action names to rate limit (partial match) */
  actionNames?: string[];
  /** Maximum requests in window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Burst limit (temporary spike allowance) */
  burstLimit?: number;
  /** Scope: 'global' | 'agent' | 'session' | 'user' */
  scope?: 'global' | 'agent' | 'session' | 'user';
  /** Custom rate limit exceeded message */
  rateLimitMessage?: string;
}

/**
 * Options for compliance rules
 */
export interface ComplianceRuleOptions extends BaseRuleOptions {
  /** Require data retention check */
  checkRetention?: boolean;
  /** Require consent verification */
  checkConsent?: boolean;
  /** Require geographic restrictions */
  allowedRegions?: string[];
  /** Require audit logging */
  requireAuditLog?: boolean;
  /** Require encryption */
  requireEncryption?: boolean;
  /** Data types covered */
  dataTypes?: string[];
  /** Specific compliance requirements */
  requirements?: {
    /** Require identity verification */
    identityVerification?: boolean;
    /** Require business justification */
    businessJustification?: boolean;
    /** Require dual approval */
    dualApproval?: boolean;
    /** Minimum data fields allowed */
    minimumNecessary?: number;
  };
}

/**
 * Options for environment-specific rules
 */
export interface EnvironmentRuleOptions extends BaseRuleOptions {
  /** Target environments */
  environments: ('development' | 'staging' | 'production')[];
  /** Action categories affected */
  categories?: ActionCategory[];
  /** Action names affected (partial match) */
  actionNames?: string[];
  /** Require approval in target environments */
  requireApproval?: boolean;
  /** Block entirely in target environments */
  blockInEnvironments?: boolean;
  /** Require feature flag */
  requireFeatureFlag?: boolean;
  /** Require rollback plan */
  requireRollbackPlan?: boolean;
  /** Custom message */
  message?: string;
}

/**
 * Options for security rules
 */
export interface SecurityRuleOptions extends BaseRuleOptions {
  /** Pattern type to detect */
  patternType?: 'sql_injection' | 'command_injection' | 'xss' | 'path_traversal' | 'custom';
  /** Custom regex pattern for detection */
  customPattern?: string;
  /** Field to check for pattern */
  patternField?: string;
  /** Require sandboxing */
  requireSandbox?: boolean;
  /** Require code validation */
  requireCodeValidation?: boolean;
  /** Block system file access */
  blockSystemFiles?: boolean;
  /** System file paths pattern */
  systemFilesPattern?: string;
  /** Action on detection: 'deny' | 'require_approval' | 'warn' */
  detectionAction?: 'deny' | 'require_approval' | 'warn';
  /** Send security notification */
  sendNotification?: boolean;
}

/**
 * Options for operational rules
 */
export interface OperationalRuleOptions extends BaseRuleOptions {
  /** Cost threshold for approval */
  costThreshold?: number;
  /** Memory threshold (MB) for warning */
  memoryThreshold?: number;
  /** Token count threshold for LLM operations */
  tokenThreshold?: number;
  /** Daily budget limit */
  dailyBudget?: number;
  /** Retry limit */
  maxRetries?: number;
  /** Session action limit */
  sessionActionLimit?: number;
  /** Require backup verification for destructive ops */
  requireBackupVerification?: boolean;
  /** Enforce deployment windows */
  enforceDeploymentWindow?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique rule ID with prefix
 */
export function generateRuleId(prefix: string, suffix?: string): string {
  const timestamp = Date.now().toString(36);
  return suffix ? `${prefix}-${suffix}` : `${prefix}-${timestamp}`;
}

/**
 * Merge actions, with override taking precedence
 */
function mergeActions(
  defaultActions: RuleAction[],
  overrideActions?: RuleAction[],
  additionalActions?: RuleAction[]
): RuleAction[] {
  if (overrideActions && overrideActions.length > 0) {
    return [...overrideActions, ...(additionalActions || [])];
  }
  return [...defaultActions, ...(additionalActions || [])];
}

/**
 * Merge conditions
 */
function mergeConditions(
  defaultConditions: RuleCondition[],
  additionalConditions?: RuleCondition[]
): RuleCondition[] {
  return [...defaultConditions, ...(additionalConditions || [])];
}

// ============================================================================
// AUTHENTICATION RULE BUILDER
// ============================================================================

/**
 * Create an authentication rule
 *
 * @example
 * ```typescript
 * const apiAuthRule = createAuthenticationRule({
 *   id: 'auth-api-001',
 *   name: 'Require API Authentication',
 *   categories: ['external_api', 'data_access'],
 *   requiredAuthTypes: ['bearer', 'api_key'],
 *   failureAction: 'deny'
 * });
 * ```
 */
export function createAuthenticationRule(options: AuthenticationRuleOptions): BusinessRule {
  const {
    id,
    name,
    description = 'Enforces authentication requirements',
    enabled = true,
    priority = 950,
    riskWeight = 45,
    tags = ['authentication', 'security'],
    categories = ['external_api'],
    authTokenField = 'authToken',
    requiredAuthTypes,
    allowUnauthenticatedIn,
    failureAction = 'deny',
    failureMessage = 'Authentication required for this operation',
    additionalConditions,
    overrideActions,
    additionalActions,
    conditionLogic = 'all',
    metadata
  } = options;

  // Build conditions
  const conditions: RuleCondition[] = [];

  // Category condition
  if (categories.length === 1) {
    conditions.push({
      field: 'actionCategory',
      operator: 'equals',
      value: categories[0]
    });
  } else if (categories.length > 1) {
    conditions.push({
      field: 'actionCategory',
      operator: 'in',
      value: categories
    });
  }

  // Auth token existence check
  conditions.push({
    field: authTokenField,
    operator: 'not_exists',
    value: null
  });

  // Environment allowance
  if (allowUnauthenticatedIn && allowUnauthenticatedIn.length > 0) {
    conditions.push({
      field: 'environment',
      operator: 'not_in',
      value: allowUnauthenticatedIn
    });
  }

  // Build actions
  const defaultActions: RuleAction[] = [
    { type: failureAction, message: failureMessage }
  ];

  if (failureAction === 'deny') {
    defaultActions.push({ type: 'log' });
  }

  return {
    id,
    name,
    description,
    type: 'security',
    enabled,
    priority,
    conditions: mergeConditions(conditions, additionalConditions),
    conditionLogic,
    actions: mergeActions(defaultActions, overrideActions, additionalActions),
    riskWeight,
    tags: [...new Set([...tags, 'authentication'])],
    metadata: {
      ...metadata,
      patternBuilder: 'createAuthenticationRule',
      requiredAuthTypes
    }
  };
}

// ============================================================================
// DATA ACCESS RULE BUILDER
// ============================================================================

/**
 * Create a data access rule
 *
 * @example
 * ```typescript
 * const piiAccessRule = createDataAccessRule({
 *   id: 'data-pii-001',
 *   name: 'Restrict PII Access',
 *   dataTypes: ['pii', 'ssn', 'email'],
 *   allowedRoles: ['admin', 'data_officer'],
 *   requireJustification: true,
 *   bulkThreshold: 100
 * });
 * ```
 */
export function createDataAccessRule(options: DataAccessRuleOptions): BusinessRule {
  const {
    id,
    name,
    description = 'Enforces data access controls',
    enabled = true,
    priority = 920,
    riskWeight = 40,
    tags = ['data-access', 'security'],
    dataClassifications,
    dataTypes,
    allowedRoles,
    requireJustification = false,
    bulkThreshold: _bulkThreshold,
    requireEncryption = false,
    unauthorizedAction = 'deny',
    unauthorizedMessage = 'Unauthorized data access attempt',
    additionalConditions,
    overrideActions,
    additionalActions,
    conditionLogic = 'all',
    metadata
  } = options;

  const conditions: RuleCondition[] = [];

  // Category condition
  conditions.push({
    field: 'actionCategory',
    operator: 'in',
    value: ['data_access', 'pii_access']
  });

  // Data classification condition
  if (dataClassifications && dataClassifications.length > 0) {
    conditions.push({
      field: 'dataClassification',
      operator: 'in',
      value: dataClassifications
    });
  }

  // Data type condition
  if (dataTypes && dataTypes.length > 0) {
    if (dataTypes.length === 1) {
      conditions.push({
        field: 'dataType',
        operator: 'equals',
        value: dataTypes[0]
      });
    } else {
      conditions.push({
        field: 'dataType',
        operator: 'in',
        value: dataTypes
      });
    }
  }

  // Role restriction
  if (allowedRoles && allowedRoles.length > 0) {
    conditions.push({
      field: 'userRole',
      operator: 'not_in',
      value: allowedRoles
    });
  }

  // Justification requirement
  if (requireJustification) {
    conditions.push({
      field: 'businessJustification',
      operator: 'not_exists',
      value: null
    });
  }

  // Encryption requirement
  if (requireEncryption) {
    conditions.push({
      field: 'encryptionEnabled',
      operator: 'not_equals',
      value: true
    });
  }

  // Build actions
  const defaultActions: RuleAction[] = [
    { type: unauthorizedAction, message: unauthorizedMessage },
    { type: 'log' }
  ];

  const baseRule: BusinessRule = {
    id,
    name,
    description,
    type: 'security',
    enabled,
    priority,
    conditions: mergeConditions(conditions, additionalConditions),
    conditionLogic,
    actions: mergeActions(defaultActions, overrideActions, additionalActions),
    riskWeight,
    tags: [...new Set([...tags, 'data-access'])],
    metadata: {
      ...metadata,
      patternBuilder: 'createDataAccessRule',
      dataClassifications,
      dataTypes,
      allowedRoles
    }
  };

  return baseRule;
}

/**
 * Create a bulk data access rule (separate from basic data access)
 *
 * @example
 * ```typescript
 * const bulkExportRule = createBulkDataAccessRule({
 *   id: 'data-bulk-001',
 *   name: 'Bulk Export Approval',
 *   bulkThreshold: 1000,
 *   requireApproval: true
 * });
 * ```
 */
export function createBulkDataAccessRule(options: DataAccessRuleOptions & { bulkThreshold: number }): BusinessRule {
  const {
    id,
    name,
    description = 'Requires approval for bulk data operations',
    enabled = true,
    priority = 880,
    riskWeight = 35,
    tags = ['bulk-operations', 'data-export'],
    bulkThreshold,
    additionalConditions,
    overrideActions,
    additionalActions,
    conditionLogic = 'all',
    metadata
  } = options;

  const conditions: RuleCondition[] = [
    {
      field: 'actionName',
      operator: 'matches_regex',
      value: '(export|download|extract|dump)'
    },
    {
      field: 'recordCount',
      operator: 'greater_than',
      value: bulkThreshold
    }
  ];

  const defaultActions: RuleAction[] = [
    { type: 'require_approval', message: `Bulk data operation (>${bulkThreshold} records) requires approval` },
    { type: 'log' }
  ];

  return {
    id,
    name,
    description,
    type: 'security',
    enabled,
    priority,
    conditions: mergeConditions(conditions, additionalConditions),
    conditionLogic,
    actions: mergeActions(defaultActions, overrideActions, additionalActions),
    riskWeight,
    tags: [...new Set([...tags, 'bulk-operations'])],
    metadata: {
      ...metadata,
      patternBuilder: 'createBulkDataAccessRule',
      bulkThreshold
    }
  };
}

// ============================================================================
// RATE LIMIT RULE BUILDER
// ============================================================================

/**
 * Create a rate limit rule
 *
 * @example
 * ```typescript
 * const apiRateLimitRule = createRateLimitRule({
 *   id: 'rate-api-001',
 *   name: 'API Rate Limit',
 *   categories: ['external_api'],
 *   maxRequests: 100,
 *   windowMs: 60000,
 *   scope: 'agent'
 * });
 * ```
 */
export function createRateLimitRule(options: RateLimitRuleOptions): BusinessRule {
  const {
    id,
    name,
    description = 'Enforces rate limiting',
    enabled = true,
    priority = 850,
    riskWeight = 20,
    tags = ['rate-limit', 'operational'],
    categories,
    actionNames,
    maxRequests,
    windowMs,
    burstLimit,
    scope = 'agent',
    rateLimitMessage = `Rate limit exceeded (${maxRequests} requests per ${windowMs / 1000}s)`,
    additionalConditions,
    overrideActions,
    additionalActions,
    conditionLogic = 'all',
    metadata
  } = options;

  const conditions: RuleCondition[] = [];

  // Category condition
  if (categories && categories.length > 0) {
    if (categories.length === 1) {
      conditions.push({
        field: 'actionCategory',
        operator: 'equals',
        value: categories[0]
      });
    } else {
      conditions.push({
        field: 'actionCategory',
        operator: 'in',
        value: categories
      });
    }
  }

  // Action name condition
  if (actionNames && actionNames.length > 0) {
    const pattern = actionNames.join('|');
    conditions.push({
      field: 'actionName',
      operator: 'matches_regex',
      value: `(${pattern})`
    });
  }

  // Rate limit exceeded condition (checked by rate limiter)
  conditions.push({
    field: 'rateLimitExceeded',
    operator: 'equals',
    value: true
  });

  const defaultActions: RuleAction[] = [
    { type: 'rate_limit', message: rateLimitMessage }
  ];

  return {
    id,
    name,
    description,
    type: 'rate_limit',
    enabled,
    priority,
    conditions: mergeConditions(conditions, additionalConditions),
    conditionLogic,
    actions: mergeActions(defaultActions, overrideActions, additionalActions),
    riskWeight,
    tags: [...new Set([...tags, 'rate-limit'])],
    metadata: {
      ...metadata,
      patternBuilder: 'createRateLimitRule',
      maxRequests,
      windowMs,
      burstLimit,
      scope
    }
  };
}

// ============================================================================
// COMPLIANCE RULE BUILDER
// ============================================================================

/**
 * Compliance framework definitions
 */
export const COMPLIANCE_FRAMEWORKS = {
  gdpr: {
    name: 'GDPR',
    fullName: 'General Data Protection Regulation',
    tags: ['gdpr', 'privacy', 'eu'],
    defaultPriority: 920,
    defaultRiskWeight: 45
  },
  hipaa: {
    name: 'HIPAA',
    fullName: 'Health Insurance Portability and Accountability Act',
    tags: ['hipaa', 'phi', 'healthcare'],
    defaultPriority: 950,
    defaultRiskWeight: 55
  },
  'pci-dss': {
    name: 'PCI-DSS',
    fullName: 'Payment Card Industry Data Security Standard',
    tags: ['pci-dss', 'cardholder-data', 'financial'],
    defaultPriority: 970,
    defaultRiskWeight: 60
  },
  sox: {
    name: 'SOX',
    fullName: 'Sarbanes-Oxley Act',
    tags: ['sox', 'financial', 'audit'],
    defaultPriority: 940,
    defaultRiskWeight: 50
  },
  soc2: {
    name: 'SOC2',
    fullName: 'Service Organization Control 2',
    tags: ['soc2', 'security', 'trust'],
    defaultPriority: 900,
    defaultRiskWeight: 40
  },
  ccpa: {
    name: 'CCPA',
    fullName: 'California Consumer Privacy Act',
    tags: ['ccpa', 'privacy', 'california'],
    defaultPriority: 910,
    defaultRiskWeight: 40
  }
} as const;

export type ComplianceFramework = keyof typeof COMPLIANCE_FRAMEWORKS;

/**
 * Create a compliance rule for a specific framework
 *
 * @example
 * ```typescript
 * const gdprConsentRule = createComplianceRule('gdpr', {
 *   id: 'gdpr-consent-001',
 *   name: 'GDPR Consent Verification',
 *   checkConsent: true,
 *   dataTypes: ['pii', 'email', 'name']
 * });
 *
 * const hipaaPhiRule = createComplianceRule('hipaa', {
 *   id: 'hipaa-phi-001',
 *   name: 'HIPAA PHI Protection',
 *   dataTypes: ['phi'],
 *   requireEncryption: true,
 *   requirements: { minimumNecessary: 10 }
 * });
 * ```
 */
export function createComplianceRule(
  framework: ComplianceFramework,
  options: ComplianceRuleOptions
): BusinessRule {
  const frameworkConfig = COMPLIANCE_FRAMEWORKS[framework];

  const {
    id,
    name,
    description = `${frameworkConfig.fullName} compliance rule`,
    enabled = true,
    priority = frameworkConfig.defaultPriority,
    riskWeight = frameworkConfig.defaultRiskWeight,
    tags = [],
    checkRetention = false,
    checkConsent = false,
    allowedRegions,
    requireAuditLog = true,
    requireEncryption = false,
    dataTypes,
    requirements,
    additionalConditions,
    overrideActions,
    additionalActions,
    conditionLogic = 'all',
    metadata
  } = options;

  const conditions: RuleCondition[] = [];
  const actions: RuleAction[] = [];

  // Base data access condition
  conditions.push({
    field: 'actionCategory',
    operator: 'in',
    value: ['data_access', 'data_modification', 'pii_access']
  });

  // Data type conditions
  if (dataTypes && dataTypes.length > 0) {
    conditions.push({
      field: 'dataType',
      operator: 'in',
      value: dataTypes
    });
  }

  // Framework-specific conditions
  switch (framework) {
    case 'gdpr':
      if (checkConsent) {
        conditions.push({
          field: 'processingBasis',
          operator: 'equals',
          value: 'consent'
        });
        conditions.push({
          field: 'consentValid',
          operator: 'not_equals',
          value: true
        });
        actions.push({
          type: 'deny',
          message: 'GDPR: Valid consent required for this data processing'
        });
      }

      if (checkRetention) {
        conditions.push({
          field: 'dataRetentionExceeded',
          operator: 'equals',
          value: true
        });
        actions.push({
          type: 'deny',
          message: 'GDPR: Data has exceeded retention period'
        });
      }

      if (allowedRegions && allowedRegions.length > 0) {
        conditions.push({
          field: 'destinationRegion',
          operator: 'not_in',
          value: allowedRegions
        });
        actions.push({
          type: 'require_approval',
          message: 'GDPR: Cross-border data transfer requires DPO approval'
        });
      }
      break;

    case 'hipaa':
      if (requireEncryption) {
        conditions.push({
          field: 'encryptionEnabled',
          operator: 'not_equals',
          value: true
        });
        actions.push({
          type: 'deny',
          message: 'HIPAA: PHI must be encrypted in transit and at rest'
        });
      }

      if (requirements?.minimumNecessary) {
        conditions.push({
          field: 'fieldsRequested',
          operator: 'greater_than',
          value: requirements.minimumNecessary
        });
        actions.push({
          type: 'require_approval',
          message: 'HIPAA: Broad PHI access requires business justification'
        });
      }

      if (requirements?.identityVerification) {
        conditions.push({
          field: 'verificationCompleted',
          operator: 'not_equals',
          value: true
        });
        actions.push({
          type: 'deny',
          message: 'HIPAA: Identity verification required'
        });
      }
      break;

    case 'pci-dss':
      if (requireEncryption) {
        conditions.push({
          field: 'encryptionEnabled',
          operator: 'not_equals',
          value: true
        });
        actions.push({
          type: 'deny',
          message: 'PCI-DSS: Cardholder data must be encrypted'
        });
      }
      break;

    case 'sox':
      if (requirements?.dualApproval) {
        actions.push({
          type: 'require_approval',
          message: 'SOX: Financial data modification requires dual approval'
        });
      }

      // Segregation of duties
      conditions.push({
        field: 'actionCategory',
        operator: 'equals',
        value: 'financial'
      });
      break;
  }

  // Add audit logging if required
  if (requireAuditLog) {
    actions.push({ type: 'log' });
  }

  // If no specific actions defined, add a default warning
  if (actions.length === 0 || (actions.length === 1 && actions[0].type === 'log')) {
    actions.unshift({
      type: 'warn',
      message: `${frameworkConfig.name}: Compliance check triggered - review required`
    });
  }

  return {
    id,
    name,
    description,
    type: 'compliance',
    enabled,
    priority,
    conditions: mergeConditions(conditions, additionalConditions),
    conditionLogic,
    actions: mergeActions(actions, overrideActions, additionalActions),
    riskWeight,
    tags: [...new Set([...frameworkConfig.tags, ...tags])],
    metadata: {
      ...metadata,
      patternBuilder: 'createComplianceRule',
      framework,
      frameworkFullName: frameworkConfig.fullName,
      requirements
    }
  };
}

// ============================================================================
// ENVIRONMENT RULE BUILDER
// ============================================================================

/**
 * Create an environment-specific rule
 *
 * @example
 * ```typescript
 * const prodDeployRule = createEnvironmentRule('production', {
 *   id: 'env-prod-001',
 *   name: 'Production Deployment Control',
 *   environments: ['production'],
 *   actionNames: ['deploy', 'release'],
 *   requireApproval: true,
 *   requireRollbackPlan: true
 * });
 *
 * const devRelaxedRule = createEnvironmentRule('development', {
 *   id: 'env-dev-001',
 *   name: 'Development Mode - Relaxed',
 *   environments: ['development'],
 *   categories: ['code_execution'],
 *   blockInEnvironments: false,
 *   message: 'Development mode - operation allowed'
 * });
 * ```
 */
export function createEnvironmentRule(
  targetEnv: 'development' | 'staging' | 'production' | 'all',
  options: EnvironmentRuleOptions
): BusinessRule {
  const {
    id,
    name,
    description = `Environment-specific rule for ${targetEnv}`,
    enabled = true,
    priority = targetEnv === 'production' ? 920 : 800,
    riskWeight = targetEnv === 'production' ? 40 : 20,
    tags = ['environment', targetEnv],
    environments,
    categories,
    actionNames,
    requireApproval = false,
    blockInEnvironments = false,
    requireFeatureFlag = false,
    requireRollbackPlan = false,
    message,
    additionalConditions,
    overrideActions,
    additionalActions,
    conditionLogic = 'all',
    metadata
  } = options;

  const conditions: RuleCondition[] = [];
  const actions: RuleAction[] = [];

  // Environment condition
  if (environments.length === 1) {
    conditions.push({
      field: 'environment',
      operator: 'equals',
      value: environments[0]
    });
  } else if (environments.length > 1) {
    conditions.push({
      field: 'environment',
      operator: 'in',
      value: environments
    });
  }

  // Category condition
  if (categories && categories.length > 0) {
    if (categories.length === 1) {
      conditions.push({
        field: 'actionCategory',
        operator: 'equals',
        value: categories[0]
      });
    } else {
      conditions.push({
        field: 'actionCategory',
        operator: 'in',
        value: categories
      });
    }
  }

  // Action name condition
  if (actionNames && actionNames.length > 0) {
    const pattern = actionNames.join('|');
    conditions.push({
      field: 'actionName',
      operator: 'matches_regex',
      value: `(${pattern})`
    });
  }

  // Rollback plan requirement
  if (requireRollbackPlan) {
    conditions.push({
      field: 'rollbackPlanDefined',
      operator: 'not_equals',
      value: true
    });
    actions.push({
      type: 'warn',
      message: message || `${environments.join('/')} changes should have a rollback plan`
    });
  }

  // Feature flag requirement
  if (requireFeatureFlag) {
    conditions.push({
      field: 'isNewFeature',
      operator: 'equals',
      value: true
    });
    conditions.push({
      field: 'featureFlagEnabled',
      operator: 'not_equals',
      value: true
    });
    actions.push({
      type: 'warn',
      message: message || 'New features should use feature flags'
    });
  }

  // Block or require approval
  if (blockInEnvironments) {
    actions.push({
      type: 'deny',
      message: message || `Operation blocked in ${environments.join('/')} environment`
    });
  } else if (requireApproval) {
    actions.push({
      type: 'require_approval',
      message: message || `Operation requires approval in ${environments.join('/')} environment`
    });
  }

  // Add logging for production
  if (environments.includes('production')) {
    actions.push({ type: 'log' });
  }

  // Default action if none specified
  if (actions.length === 0) {
    actions.push({
      type: 'warn',
      message: message || `Environment rule triggered for ${environments.join('/')}`
    });
  }

  return {
    id,
    name,
    description,
    type: 'operational',
    enabled,
    priority,
    conditions: mergeConditions(conditions, additionalConditions),
    conditionLogic,
    actions: mergeActions(actions, overrideActions, additionalActions),
    riskWeight,
    tags: [...new Set([...tags, ...environments])],
    metadata: {
      ...metadata,
      patternBuilder: 'createEnvironmentRule',
      targetEnvironments: environments,
      requireApproval,
      blockInEnvironments,
      requireFeatureFlag,
      requireRollbackPlan
    }
  };
}

// ============================================================================
// SECURITY RULE BUILDER
// ============================================================================

/**
 * Injection pattern definitions
 */
export const INJECTION_PATTERNS = {
  sql_injection: {
    pattern: '(\\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|OR|AND)\\b.*[\'";])|(--)|(\\*/)|(/\\*)',
    description: 'SQL injection detection',
    tags: ['sql-injection', 'owasp']
  },
  command_injection: {
    pattern: '([;&|`$]|\\$\\(|\\{\\{)',
    description: 'Command injection detection',
    tags: ['command-injection', 'owasp']
  },
  xss: {
    pattern: '(<script|javascript:|on\\w+\\s*=|<img.*onerror)',
    description: 'Cross-site scripting detection',
    tags: ['xss', 'owasp']
  },
  path_traversal: {
    pattern: '(\\.\\./|\\.\\.\\\\|%2e%2e%2f|%252e%252e%252f)',
    description: 'Path traversal detection',
    tags: ['path-traversal', 'owasp']
  }
} as const;

/**
 * Create a security rule
 *
 * @example
 * ```typescript
 * const sqlInjectionRule = createSecurityRule({
 *   id: 'sec-sql-001',
 *   name: 'SQL Injection Prevention',
 *   patternType: 'sql_injection',
 *   patternField: 'query',
 *   detectionAction: 'deny',
 *   sendNotification: true
 * });
 *
 * const sandboxRule = createSecurityRule({
 *   id: 'sec-sandbox-001',
 *   name: 'Require Sandbox for Code',
 *   requireSandbox: true,
 *   detectionAction: 'deny'
 * });
 * ```
 */
export function createSecurityRule(options: SecurityRuleOptions): BusinessRule {
  const {
    id,
    name,
    description,
    enabled = true,
    priority = 980,
    riskWeight = 60,
    tags = ['security'],
    patternType,
    customPattern,
    patternField,
    requireSandbox = false,
    requireCodeValidation = false,
    blockSystemFiles = false,
    systemFilesPattern = '^(/etc|/sys|/proc|/boot|C:\\\\Windows|C:\\\\System)',
    detectionAction = 'deny',
    sendNotification = false,
    additionalConditions,
    overrideActions,
    additionalActions,
    conditionLogic = 'all',
    metadata
  } = options;

  const conditions: RuleCondition[] = [];
  const actions: RuleAction[] = [];
  let derivedTags = [...tags];
  let ruleDescription = description;

  // Pattern-based detection
  if (patternType && patternType !== 'custom') {
    const patternConfig = INJECTION_PATTERNS[patternType];
    const field = patternField || (patternType === 'sql_injection' ? 'query' : 'command');

    conditions.push({
      field: 'actionCategory',
      operator: 'equals',
      value: patternType === 'sql_injection' ? 'data_access' : 'code_execution'
    });

    conditions.push({
      field,
      operator: 'matches_regex',
      value: patternConfig.pattern
    });

    ruleDescription = ruleDescription || patternConfig.description;
    derivedTags = [...derivedTags, ...patternConfig.tags];

    actions.push({
      type: detectionAction,
      message: `${patternConfig.description} - action blocked`
    });
  } else if (customPattern && patternField) {
    // Custom pattern detection
    conditions.push({
      field: patternField,
      operator: 'matches_regex',
      value: customPattern
    });

    actions.push({
      type: detectionAction,
      message: 'Security pattern detected - action blocked'
    });
  }

  // Sandbox requirement
  if (requireSandbox) {
    conditions.push({
      field: 'actionCategory',
      operator: 'equals',
      value: 'code_execution'
    });
    conditions.push({
      field: 'sandboxed',
      operator: 'not_equals',
      value: true
    });
    conditions.push({
      field: 'environment',
      operator: 'equals',
      value: 'production'
    });

    actions.push({
      type: detectionAction,
      message: 'Code execution in production requires sandboxing'
    });

    derivedTags.push('sandbox');
    ruleDescription = ruleDescription || 'Requires sandbox for code execution';
  }

  // Code validation requirement
  if (requireCodeValidation) {
    conditions.push({
      field: 'actionCategory',
      operator: 'equals',
      value: 'code_execution'
    });
    conditions.push({
      field: 'codeValidated',
      operator: 'not_equals',
      value: true
    });

    actions.push({
      type: detectionAction,
      message: 'Code execution requires validation'
    });

    derivedTags.push('code-validation');
    ruleDescription = ruleDescription || 'Requires code validation before execution';
  }

  // System file protection
  if (blockSystemFiles) {
    conditions.push({
      field: 'actionCategory',
      operator: 'equals',
      value: 'file_system'
    });
    conditions.push({
      field: 'filePath',
      operator: 'matches_regex',
      value: systemFilesPattern
    });

    actions.push({
      type: 'deny',
      message: 'Access to system files is prohibited'
    });

    derivedTags.push('file-system');
    ruleDescription = ruleDescription || 'Blocks access to system files';
  }

  // Notification
  if (sendNotification) {
    actions.push({
      type: 'notify',
      message: `Security alert: ${name}`
    });
  }

  // Always log security events
  actions.push({ type: 'log' });

  return {
    id,
    name,
    description: ruleDescription || 'Security enforcement rule',
    type: 'security',
    enabled,
    priority,
    conditions: mergeConditions(conditions, additionalConditions),
    conditionLogic,
    actions: mergeActions(actions, overrideActions, additionalActions),
    riskWeight,
    tags: [...new Set(derivedTags)],
    metadata: {
      ...metadata,
      patternBuilder: 'createSecurityRule',
      patternType,
      requireSandbox,
      requireCodeValidation,
      blockSystemFiles
    }
  };
}

// ============================================================================
// OPERATIONAL RULE BUILDER
// ============================================================================

/**
 * Create an operational rule
 *
 * @example
 * ```typescript
 * const costControlRule = createOperationalRule({
 *   id: 'ops-cost-001',
 *   name: 'API Cost Control',
 *   costThreshold: 50,
 *   categories: ['external_api']
 * });
 *
 * const resourceLimitRule = createOperationalRule({
 *   id: 'ops-resource-001',
 *   name: 'Memory Usage Warning',
 *   memoryThreshold: 1024,
 *   tokenThreshold: 100000
 * });
 * ```
 */
export function createOperationalRule(options: OperationalRuleOptions): BusinessRule {
  const {
    id,
    name,
    description = 'Operational governance rule',
    enabled = true,
    priority = 850,
    riskWeight = 25,
    tags = ['operational'],
    costThreshold,
    memoryThreshold,
    tokenThreshold,
    dailyBudget,
    maxRetries,
    sessionActionLimit,
    requireBackupVerification = false,
    enforceDeploymentWindow = false,
    additionalConditions,
    overrideActions,
    additionalActions,
    conditionLogic = 'all',
    metadata
  } = options;

  const conditions: RuleCondition[] = [];
  const actions: RuleAction[] = [];
  const derivedTags = [...tags];

  // Cost threshold
  if (costThreshold !== undefined) {
    conditions.push({
      field: 'estimatedCost',
      operator: 'greater_than',
      value: costThreshold
    });
    actions.push({
      type: 'require_approval',
      message: `Operation cost exceeds $${costThreshold} - requires approval`
    });
    derivedTags.push('cost');
  }

  // Memory threshold
  if (memoryThreshold !== undefined) {
    conditions.push({
      field: 'estimatedMemoryMb',
      operator: 'greater_than',
      value: memoryThreshold
    });
    actions.push({
      type: 'warn',
      message: `Operation may consume >${memoryThreshold}MB memory`
    });
    derivedTags.push('memory');
  }

  // Token threshold for LLM
  if (tokenThreshold !== undefined) {
    conditions.push({
      field: 'actionName',
      operator: 'contains',
      value: 'llm'
    });
    conditions.push({
      field: 'tokenCount',
      operator: 'greater_than',
      value: tokenThreshold
    });
    actions.push({
      type: 'require_approval',
      message: `LLM call exceeds ${tokenThreshold} tokens - requires approval`
    });
    derivedTags.push('llm', 'tokens');
  }

  // Daily budget
  if (dailyBudget !== undefined) {
    conditions.push({
      field: 'dailySpend',
      operator: 'greater_than',
      value: dailyBudget
    });
    conditions.push({
      field: 'budgetOverrideApproved',
      operator: 'not_equals',
      value: true
    });
    actions.push({
      type: 'deny',
      message: `Daily budget limit ($${dailyBudget}) exceeded`
    });
    derivedTags.push('budget');
  }

  // Retry limit
  if (maxRetries !== undefined) {
    conditions.push({
      field: 'retryCount',
      operator: 'greater_than',
      value: maxRetries
    });
    actions.push({
      type: 'deny',
      message: `Maximum retry attempts (${maxRetries}) exceeded`
    });
    actions.push({
      type: 'escalate',
      message: 'Operation repeatedly failing - escalation required'
    });
    derivedTags.push('retry');
  }

  // Session action limit
  if (sessionActionLimit !== undefined) {
    conditions.push({
      field: 'sessionActionCount',
      operator: 'greater_than',
      value: sessionActionLimit
    });
    actions.push({
      type: 'warn',
      message: `Session action count exceeds ${sessionActionLimit} - consider session rotation`
    });
    derivedTags.push('session');
  }

  // Backup verification
  if (requireBackupVerification) {
    conditions.push({
      field: 'operation',
      operator: 'in',
      value: ['delete', 'truncate', 'drop', 'purge']
    });
    conditions.push({
      field: 'environment',
      operator: 'equals',
      value: 'production'
    });
    conditions.push({
      field: 'backupVerified',
      operator: 'not_equals',
      value: true
    });
    actions.push({
      type: 'require_approval',
      message: 'Destructive operation requires backup verification'
    });
    derivedTags.push('backup', 'destructive');
  }

  // Deployment window
  if (enforceDeploymentWindow) {
    conditions.push({
      field: 'actionName',
      operator: 'equals',
      value: 'deploy'
    });
    conditions.push({
      field: 'environment',
      operator: 'equals',
      value: 'production'
    });
    conditions.push({
      field: 'deploymentWindowOpen',
      operator: 'not_equals',
      value: true
    });
    actions.push({
      type: 'require_approval',
      message: 'Production deployment outside approved window requires approval'
    });
    derivedTags.push('deployment');
  }

  // Always log operational events
  actions.push({ type: 'log' });

  return {
    id,
    name,
    description,
    type: 'operational',
    enabled,
    priority,
    conditions: mergeConditions(conditions, additionalConditions),
    conditionLogic,
    actions: mergeActions(actions, overrideActions, additionalActions),
    riskWeight,
    tags: [...new Set(derivedTags)],
    metadata: {
      ...metadata,
      patternBuilder: 'createOperationalRule',
      costThreshold,
      memoryThreshold,
      tokenThreshold,
      dailyBudget,
      maxRetries,
      sessionActionLimit
    }
  };
}

// ============================================================================
// CONVENIENCE BUILDERS
// ============================================================================

/**
 * Create a simple deny rule
 */
export function createDenyRule(options: {
  id: string;
  name: string;
  conditions: RuleCondition[];
  message: string;
  priority?: number;
  riskWeight?: number;
  tags?: string[];
  type?: BusinessRuleType;
}): BusinessRule {
  const { id, name, conditions, message, priority = 900, riskWeight = 50, tags = [], type = 'security' } = options;

  return {
    id,
    name,
    type,
    enabled: true,
    priority,
    conditions,
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message },
      { type: 'log' }
    ],
    riskWeight,
    tags
  };
}

/**
 * Create a simple approval rule
 */
export function createApprovalRule(options: {
  id: string;
  name: string;
  conditions: RuleCondition[];
  message: string;
  priority?: number;
  riskWeight?: number;
  tags?: string[];
  type?: BusinessRuleType;
}): BusinessRule {
  const { id, name, conditions, message, priority = 850, riskWeight = 35, tags = [], type = 'operational' } = options;

  return {
    id,
    name,
    type,
    enabled: true,
    priority,
    conditions,
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message },
      { type: 'log' }
    ],
    riskWeight,
    tags
  };
}

/**
 * Create a simple warning rule
 */
export function createWarningRule(options: {
  id: string;
  name: string;
  conditions: RuleCondition[];
  message: string;
  priority?: number;
  riskWeight?: number;
  tags?: string[];
  type?: BusinessRuleType;
}): BusinessRule {
  const { id, name, conditions, message, priority = 700, riskWeight = 15, tags = [], type = 'operational' } = options;

  return {
    id,
    name,
    type,
    enabled: true,
    priority,
    conditions,
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message }
    ],
    riskWeight,
    tags
  };
}

/**
 * Create an audit-only rule (logs without blocking)
 */
export function createAuditRule(options: {
  id: string;
  name: string;
  conditions: RuleCondition[];
  priority?: number;
  tags?: string[];
}): BusinessRule {
  const { id, name, conditions, priority = 500, tags = ['audit'] } = options;

  return {
    id,
    name,
    type: 'compliance',
    enabled: true,
    priority,
    conditions,
    conditionLogic: 'all',
    actions: [
      { type: 'log' },
      { type: 'allow' }
    ],
    riskWeight: 5,
    tags
  };
}

// ============================================================================
// RULE SET BUILDERS
// ============================================================================

/**
 * Create a complete rule set for a compliance framework
 */
export function createComplianceRuleSet(
  framework: ComplianceFramework,
  baseId: string,
  options?: {
    enabled?: boolean;
    priorityOffset?: number;
  }
): BusinessRule[] {
  const { enabled = true, priorityOffset = 0 } = options || {};
  const rules: BusinessRule[] = [];

  switch (framework) {
    case 'gdpr':
      rules.push(
        createComplianceRule('gdpr', {
          id: `${baseId}-consent`,
          name: 'GDPR - Consent Verification',
          checkConsent: true,
          enabled,
          priority: 910 + priorityOffset
        }),
        createComplianceRule('gdpr', {
          id: `${baseId}-retention`,
          name: 'GDPR - Data Retention',
          checkRetention: true,
          enabled,
          priority: 850 + priorityOffset
        }),
        createComplianceRule('gdpr', {
          id: `${baseId}-transfer`,
          name: 'GDPR - Cross-Border Transfer',
          allowedRegions: ['EU', 'EEA', 'adequacy_decision'],
          enabled,
          priority: 920 + priorityOffset
        })
      );
      break;

    case 'hipaa':
      rules.push(
        createComplianceRule('hipaa', {
          id: `${baseId}-encryption`,
          name: 'HIPAA - PHI Encryption',
          dataTypes: ['phi'],
          requireEncryption: true,
          enabled,
          priority: 960 + priorityOffset
        }),
        createComplianceRule('hipaa', {
          id: `${baseId}-minimum`,
          name: 'HIPAA - Minimum Necessary',
          dataTypes: ['phi'],
          requirements: { minimumNecessary: 10 },
          enabled,
          priority: 920 + priorityOffset
        }),
        createAuditRule({
          id: `${baseId}-audit`,
          name: 'HIPAA - PHI Access Audit',
          conditions: [{ field: 'dataType', operator: 'equals', value: 'phi' }],
          priority: 950 + priorityOffset,
          tags: ['hipaa', 'phi', 'audit']
        })
      );
      break;

    case 'pci-dss':
      rules.push(
        createDataAccessRule({
          id: `${baseId}-cardholder`,
          name: 'PCI-DSS - Cardholder Data Access',
          dataTypes: ['cardholder', 'pan'],
          allowedRoles: ['payment_processor', 'fraud_analyst', 'security_admin'],
          enabled,
          priority: 980 + priorityOffset,
          tags: ['pci-dss', 'cardholder-data']
        }),
        createDenyRule({
          id: `${baseId}-cvv`,
          name: 'PCI-DSS - CVV Storage Prohibition',
          conditions: [
            { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
            { field: 'operation', operator: 'in', value: ['write', 'store', 'save'] },
            { field: 'dataType', operator: 'equals', value: 'cvv' }
          ],
          message: 'PCI-DSS: CVV/CVC storage is strictly prohibited',
          priority: 990 + priorityOffset,
          riskWeight: 70,
          tags: ['pci-dss', 'cvv'],
          type: 'compliance'
        })
      );
      break;

    case 'sox':
      rules.push(
        createApprovalRule({
          id: `${baseId}-financial`,
          name: 'SOX - Financial Data Audit',
          conditions: [
            { field: 'actionCategory', operator: 'equals', value: 'financial' },
            { field: 'operation', operator: 'in', value: ['write', 'update', 'delete'] }
          ],
          message: 'SOX: Financial data modification requires dual approval',
          priority: 940 + priorityOffset,
          tags: ['sox', 'financial', 'audit'],
          type: 'compliance'
        }),
        createDenyRule({
          id: `${baseId}-sod`,
          name: 'SOX - Segregation of Duties',
          conditions: [
            { field: 'actionCategory', operator: 'equals', value: 'financial' },
            { field: 'operation', operator: 'equals', value: 'approve' },
            { field: 'initiatorId', operator: 'equals', value: '$userId' }
          ],
          message: 'SOX: Cannot approve own financial transactions',
          priority: 930 + priorityOffset,
          riskWeight: 50,
          tags: ['sox', 'segregation-of-duties'],
          type: 'compliance'
        })
      );
      break;
  }

  return rules;
}

/**
 * Create a complete security rule set
 */
export function createSecurityRuleSet(baseId: string, options?: {
  enabled?: boolean;
  includeInjectionPrevention?: boolean;
  includeSandboxing?: boolean;
  includeSystemFileProtection?: boolean;
}): BusinessRule[] {
  const {
    enabled = true,
    includeInjectionPrevention = true,
    includeSandboxing = true,
    includeSystemFileProtection = true
  } = options || {};

  const rules: BusinessRule[] = [];

  if (includeInjectionPrevention) {
    rules.push(
      createSecurityRule({
        id: `${baseId}-sql`,
        name: 'SQL Injection Prevention',
        patternType: 'sql_injection',
        patternField: 'query',
        sendNotification: true,
        enabled
      }),
      createSecurityRule({
        id: `${baseId}-cmd`,
        name: 'Command Injection Prevention',
        patternType: 'command_injection',
        patternField: 'command',
        sendNotification: true,
        enabled
      }),
      createSecurityRule({
        id: `${baseId}-xss`,
        name: 'XSS Prevention',
        patternType: 'xss',
        patternField: 'input',
        sendNotification: true,
        enabled
      })
    );
  }

  if (includeSandboxing) {
    rules.push(
      createSecurityRule({
        id: `${baseId}-sandbox`,
        name: 'Production Sandboxing Required',
        requireSandbox: true,
        enabled
      }),
      createSecurityRule({
        id: `${baseId}-validation`,
        name: 'Code Validation Required',
        requireCodeValidation: true,
        enabled
      })
    );
  }

  if (includeSystemFileProtection) {
    rules.push(
      createSecurityRule({
        id: `${baseId}-sysfiles`,
        name: 'System File Protection',
        blockSystemFiles: true,
        enabled
      })
    );
  }

  return rules;
}

export default {
  // Main builders
  createAuthenticationRule,
  createDataAccessRule,
  createBulkDataAccessRule,
  createRateLimitRule,
  createComplianceRule,
  createEnvironmentRule,
  createSecurityRule,
  createOperationalRule,

  // Convenience builders
  createDenyRule,
  createApprovalRule,
  createWarningRule,
  createAuditRule,

  // Rule set builders
  createComplianceRuleSet,
  createSecurityRuleSet,

  // Constants
  COMPLIANCE_FRAMEWORKS,
  INJECTION_PATTERNS
};
