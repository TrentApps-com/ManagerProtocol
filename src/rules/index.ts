/**
 * Enterprise Agent Supervisor - Built-in Rules
 *
 * Collection of pre-defined rules for common governance scenarios.
 */

import { securityRules } from './security.js';
import { complianceRules } from './compliance.js';
import { uxRules } from './ux.js';
import { architectureRules } from './architecture.js';
import { operationalRules } from './operational.js';
import { cssRules } from './css.js';
import { flaskRules } from './flask.js';
import { mlAiRules } from './ml-ai.js';
import { storageRules } from './storage.js';
import { stripeRules } from './stripe.js';
import { testingRules } from './testing.js';
import { azureRules } from './azure.js';
import { websocketRules } from './websocket.js';
import type { BusinessRule, RateLimitConfig } from '../types/index.js';

// Re-export individual rule sets
export { securityRules } from './security.js';
export { complianceRules } from './compliance.js';
export { uxRules } from './ux.js';
export { architectureRules } from './architecture.js';
export { operationalRules } from './operational.js';
export { cssRules } from './css.js';
export { flaskRules } from './flask.js';
export { mlAiRules } from './ml-ai.js';
export { storageRules } from './storage.js';
export { stripeRules } from './stripe.js';
export { testingRules } from './testing.js';
export { azureRules } from './azure.js';
export { websocketRules } from './websocket.js';

/**
 * All built-in rules combined
 */
export const allBuiltInRules: BusinessRule[] = [
  ...securityRules,
  ...complianceRules,
  ...uxRules,
  ...architectureRules,
  ...operationalRules,
  ...cssRules,
  ...flaskRules,
  ...mlAiRules,
  ...storageRules,
  ...stripeRules,
  ...testingRules,
  ...azureRules,
  ...websocketRules
];

/**
 * Get rules by type
 */
export function getRulesByType(type: BusinessRule['type']): BusinessRule[] {
  return allBuiltInRules.filter(rule => rule.type === type);
}

/**
 * Get rules by tags
 */
export function getRulesByTags(tags: string[]): BusinessRule[] {
  return allBuiltInRules.filter(rule =>
    rule.tags?.some(tag => tags.includes(tag))
  );
}

/**
 * Get rules for specific compliance frameworks
 */
export function getRulesForCompliance(framework: string): BusinessRule[] {
  const frameworkTags: Record<string, string[]> = {
    'gdpr': ['gdpr', 'privacy', 'pii', 'consent', 'data-transfer'],
    'hipaa': ['hipaa', 'phi', 'encryption', 'minimum-necessary'],
    'pci-dss': ['pci-dss', 'cardholder-data', 'pan', 'cvv'],
    'sox': ['sox', 'financial', 'segregation-of-duties', 'audit'],
    'soc2': ['security', 'audit', 'access-control', 'encryption'],
    'iso27001': ['security', 'access-control', 'data-classification']
  };

  const tags = frameworkTags[framework.toLowerCase()] || [];
  return getRulesByTags(tags);
}

/**
 * Default rate limit configurations
 */
export const defaultRateLimits: RateLimitConfig[] = [
  {
    id: 'global-actions',
    name: 'Global Action Rate Limit',
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    scope: 'global',
    enabled: true
  },
  {
    id: 'agent-actions',
    name: 'Per-Agent Action Rate Limit',
    windowMs: 60000,
    maxRequests: 50,
    scope: 'agent',
    enabled: true
  },
  {
    id: 'session-actions',
    name: 'Per-Session Action Rate Limit',
    windowMs: 60000,
    maxRequests: 30,
    scope: 'session',
    enabled: true
  },
  {
    id: 'data-access',
    name: 'Data Access Rate Limit',
    windowMs: 60000,
    maxRequests: 100,
    scope: 'agent',
    actionCategories: ['data_access'],
    enabled: true
  },
  {
    id: 'external-api',
    name: 'External API Rate Limit',
    windowMs: 60000,
    maxRequests: 20,
    scope: 'agent',
    actionCategories: ['external_api'],
    enabled: true
  },
  {
    id: 'code-execution',
    name: 'Code Execution Rate Limit',
    windowMs: 60000,
    maxRequests: 10,
    scope: 'session',
    actionCategories: ['code_execution'],
    burstLimit: 3,
    enabled: true
  },
  {
    id: 'financial-ops',
    name: 'Financial Operations Rate Limit',
    windowMs: 300000, // 5 minutes
    maxRequests: 10,
    scope: 'user',
    actionCategories: ['financial'],
    enabled: true
  },
  {
    id: 'pii-access',
    name: 'PII Access Rate Limit',
    windowMs: 60000,
    maxRequests: 5,
    scope: 'session',
    actionCategories: ['pii_access'],
    enabled: true
  }
];

/**
 * Rule presets for quick configuration
 */
export const rulePresets = {
  /**
   * Minimal - Basic security and logging
   */
  minimal: {
    rules: allBuiltInRules.filter(r =>
      r.id.startsWith('sec-050') || // Injection prevention
      r.id === 'comp-001' // Audit trail
    ),
    rateLimits: [defaultRateLimits[0]]
  },

  /**
   * Standard - Balanced security and operations
   */
  standard: {
    rules: allBuiltInRules.filter(r =>
      r.type === 'security' ||
      r.id === 'comp-001' ||
      r.id.startsWith('ops-05') // Agent limits
    ),
    rateLimits: defaultRateLimits.slice(0, 4)
  },

  /**
   * Strict - Full compliance and governance
   */
  strict: {
    rules: allBuiltInRules,
    rateLimits: defaultRateLimits
  },

  /**
   * Financial - For financial services
   */
  financial: {
    rules: [
      ...securityRules,
      ...complianceRules.filter(r =>
        r.tags?.some(t => ['sox', 'pci-dss', 'financial'].includes(t))
      ),
      ...operationalRules
    ],
    rateLimits: defaultRateLimits
  },

  /**
   * Healthcare - For healthcare applications
   */
  healthcare: {
    rules: [
      ...securityRules,
      ...complianceRules.filter(r =>
        r.tags?.some(t => ['hipaa', 'phi'].includes(t))
      ),
      ...operationalRules
    ],
    rateLimits: defaultRateLimits
  },

  /**
   * Development - Relaxed rules for dev environment
   */
  development: {
    rules: allBuiltInRules.filter(r =>
      r.priority >= 900 // Only critical rules
    ).map(r => ({
      ...r,
      actions: r.actions.map(a =>
        a.type === 'deny' ? { ...a, type: 'warn' as const } : a
      )
    })),
    rateLimits: []
  },

  /**
   * Frontend - Optimized for frontend development with CSS governance
   */
  frontend: {
    rules: [
      ...securityRules.filter(r =>
        r.tags?.some(t => ['xss', 'injection', 'authentication'].includes(t)) ||
        r.id.startsWith('sec-05') // Injection prevention
      ),
      ...uxRules,
      ...architectureRules.filter(r =>
        r.tags?.some(t => ['api', 'performance', 'caching'].includes(t))
      ),
      ...cssRules
    ],
    rateLimits: defaultRateLimits.slice(0, 3)
  }
};

/**
 * Get CSS-specific rules
 */
export function getCSSRules(): BusinessRule[] {
  return cssRules;
}

/**
 * Get rules for frontend development
 */
export function getFrontendRules(): BusinessRule[] {
  return [...uxRules, ...cssRules, ...storageRules, ...architectureRules.filter(r =>
    r.tags?.some(t => ['performance', 'caching'].includes(t))
  )];
}

// ============================================================================
// STORAGE-SPECIFIC HELPERS (Task #35)
// ============================================================================

/**
 * Get all storage-related rules
 */
export function getStorageRules(): BusinessRule[] {
  return storageRules;
}

/**
 * Get storage rules by storage type
 */
export function getStorageRulesByType(
  storageType: 'browser' | 'database' | 'filesystem' | 'cache' | 'blob'
): BusinessRule[] {
  const typeTagMap: Record<string, string[]> = {
    'browser': ['localStorage', 'sessionStorage', 'indexeddb', 'browser'],
    'database': ['database', 'sql-injection', 'transactions'],
    'filesystem': ['filesystem', 'system-files', 'path-traversal'],
    'cache': ['cache', 'redis', 'memcached', 'cdn'],
    'blob': ['blob', 's3', 'azure-blob', 'gcs']
  };

  const tags = typeTagMap[storageType] || [];
  return storageRules.filter(rule =>
    rule.tags?.some(tag => tags.includes(tag))
  );
}

/**
 * Get database-specific rules
 */
export function getDatabaseRules(): BusinessRule[] {
  return storageRules.filter(rule =>
    rule.id.startsWith('storage-db-') ||
    rule.tags?.some(tag => ['database', 'sql', 'postgresql', 'mysql', 'mongodb', 'cosmos-db'].includes(tag))
  );
}

/**
 * Get file system rules
 */
export function getFileSystemRules(): BusinessRule[] {
  return storageRules.filter(rule =>
    rule.id.startsWith('storage-fs-') ||
    rule.tags?.some(tag => ['filesystem', 'file-system'].includes(tag))
  );
}

/**
 * Get cache rules (Redis, Memcached, CDN)
 */
export function getCacheRules(): BusinessRule[] {
  return storageRules.filter(rule =>
    rule.id.startsWith('storage-cache-') ||
    rule.tags?.some(tag => ['cache', 'redis', 'memcached', 'cdn'].includes(tag))
  );
}

/**
 * Get blob/object storage rules (S3, Azure Blob, GCS)
 */
export function getBlobStorageRules(): BusinessRule[] {
  return storageRules.filter(rule =>
    rule.id.startsWith('storage-blob-') ||
    rule.tags?.some(tag => ['blob', 's3', 'azure-blob', 'gcs'].includes(tag))
  );
}

/**
 * Get browser storage rules (localStorage, sessionStorage, IndexedDB)
 */
export function getBrowserStorageRules(): BusinessRule[] {
  return storageRules.filter(rule =>
    (rule.id.startsWith('storage-00') && !rule.id.startsWith('storage-db-')) ||
    rule.tags?.some(tag => ['localStorage', 'sessionStorage', 'indexeddb', 'browser'].includes(tag))
  );
}

/**
 * Project Profiles - Technology-specific rule collections
 * Use these to filter rules by project tech stack
 */
export const projectProfiles = {
  /**
   * Flask - Python Flask web applications
   */
  flask: {
    name: 'Flask (Python Web)',
    rules: [
      ...flaskRules,
      ...securityRules.filter(r =>
        r.tags?.some(t => ['sql-injection', 'xss', 'authentication', 'session'].includes(t))
      ),
      ...websocketRules, // Flask-SocketIO
      ...operationalRules.filter(r => r.tags?.includes('api'))
    ],
    description: 'Flask web applications with security, CORS, and session handling'
  },

  /**
   * Azure .NET - Azure Functions + Cosmos DB
   */
  'dotnet-azure': {
    name: '.NET + Azure Functions',
    rules: [
      ...azureRules,
      ...securityRules.filter(r =>
        r.tags?.some(t => ['authentication', 'encryption'].includes(t))
      ),
      ...architectureRules.filter(r =>
        r.tags?.some(t => ['api', 'timeout', 'idempotency'].includes(t))
      ),
      ...operationalRules.filter(r => r.tags?.includes('deployment'))
    ],
    description: 'Azure Functions, Cosmos DB, and Azure services'
  },

  /**
   * React/Frontend - Browser-based applications
   */
  react: {
    name: 'React/Frontend',
    rules: [
      ...uxRules,
      ...cssRules,
      ...storageRules,
      ...securityRules.filter(r =>
        r.tags?.some(t => ['xss', 'authentication'].includes(t))
      ),
      ...architectureRules.filter(r =>
        r.tags?.some(t => ['performance', 'caching'].includes(t))
      )
    ],
    description: 'Frontend development with React, CSS, and browser storage'
  },

  /**
   * Playwright - E2E testing
   */
  playwright: {
    name: 'Playwright Testing',
    rules: [
      ...testingRules,
      ...operationalRules.filter(r =>
        r.tags?.some(t => ['limits', 'cleanup'].includes(t))
      )
    ],
    description: 'Playwright E2E testing and quality assurance'
  },

  /**
   * ML/AI - Machine learning applications
   */
  'ml-ai': {
    name: 'ML/AI Applications',
    rules: [
      ...mlAiRules,
      ...securityRules.filter(r =>
        r.tags?.some(t => ['validation', 'injection'].includes(t))
      ),
      ...operationalRules.filter(r =>
        r.tags?.some(t => ['memory', 'timeout', 'cost'].includes(t))
      )
    ],
    description: 'PyTorch, Transformers, Diffusers, and AI model operations'
  },

  /**
   * Stripe - Payment processing
   */
  stripe: {
    name: 'Stripe Payments',
    rules: [
      ...stripeRules,
      ...complianceRules.filter(r =>
        r.tags?.some(t => ['pci-dss', 'financial'].includes(t))
      ),
      ...securityRules.filter(r =>
        r.tags?.some(t => ['webhook', 'validation'].includes(t))
      )
    ],
    description: 'Stripe payment processing and compliance'
  },

  /**
   * WebSocket - Real-time applications
   */
  websocket: {
    name: 'WebSocket/Socket.IO',
    rules: [
      ...websocketRules,
      ...securityRules.filter(r =>
        r.tags?.some(t => ['authentication', 'rate-limiting'].includes(t))
      ),
      ...architectureRules.filter(r =>
        r.tags?.some(t => ['timeout', 'connection'].includes(t))
      )
    ],
    description: 'WebSocket and Socket.IO real-time communication'
  },

  /**
   * Full Stack - Complete web application
   */
  fullstack: {
    name: 'Full Stack Application',
    rules: [
      ...securityRules,
      ...architectureRules,
      ...operationalRules,
      ...uxRules,
      ...cssRules
    ],
    description: 'Complete web application with backend and frontend'
  },

  /**
   * API Only - Backend API services
   */
  api: {
    name: 'Backend API',
    rules: [
      ...securityRules.filter(r =>
        r.tags?.some(t => ['api', 'authentication', 'authorization'].includes(t))
      ),
      ...architectureRules.filter(r =>
        r.tags?.some(t => ['api', 'idempotency', 'timeout', 'retry'].includes(t))
      ),
      ...operationalRules.filter(r =>
        r.tags?.some(t => ['rate-limiting', 'monitoring'].includes(t))
      )
    ],
    description: 'RESTful API services with authentication and rate limiting'
  },

  /**
   * Storage - Database, file system, cache, and blob storage (Task #35)
   */
  storage: {
    name: 'Storage Systems',
    rules: [
      ...storageRules,
      ...securityRules.filter(r =>
        r.tags?.some(t => ['encryption', 'authentication', 'sql-injection'].includes(t))
      ),
      ...operationalRules.filter(r =>
        r.tags?.some(t => ['backup', 'cost', 'limits'].includes(t))
      )
    ],
    description: 'Database, file system, cache (Redis/Memcached), and blob storage (S3/Azure/GCS)'
  }
};

/**
 * Get rules by project profile
 */
export function getRulesByProfile(profile: keyof typeof projectProfiles): BusinessRule[] {
  const profileConfig = projectProfiles[profile];
  return profileConfig ? profileConfig.rules : [];
}

/**
 * Get rules by priority threshold
 */
export function getRulesByPriority(minPriority: number, maxPriority?: number): BusinessRule[] {
  return allBuiltInRules.filter(r => {
    if (maxPriority !== undefined) {
      return r.priority >= minPriority && r.priority <= maxPriority;
    }
    return r.priority >= minPriority;
  });
}

/**
 * Get a summary of rules by type
 */
export function getRuleSummary(): Record<string, number> {
  const summary: Record<string, number> = {};
  allBuiltInRules.forEach(rule => {
    summary[rule.type] = (summary[rule.type] || 0) + 1;
  });
  return summary;
}

/**
 * List available project profiles
 */
export function listProjectProfiles(): Array<{key: string, name: string, description: string, ruleCount: number}> {
  return Object.entries(projectProfiles).map(([key, config]) => ({
    key,
    name: config.name,
    description: config.description,
    ruleCount: config.rules.length
  }));
}

// ============================================================================
// Task #39: VERSIONING AND DEPRECATION HELPERS
// ============================================================================

/**
 * Task #39: Get all deprecated rules
 */
export function getDeprecatedRules(): BusinessRule[] {
  return allBuiltInRules.filter(rule => rule.deprecated === true);
}

/**
 * Task #39: Get rules that are compatible with a specific supervisor version
 */
export function getRulesCompatibleWithVersion(version: string): BusinessRule[] {
  return allBuiltInRules.filter(rule => {
    if (!rule.minVersion) return true;
    return compareVersions(version, rule.minVersion) >= 0;
  });
}

/**
 * Task #39: Get rules that are NOT deprecated (active rules)
 */
export function getActiveBuiltInRules(): BusinessRule[] {
  return allBuiltInRules.filter(rule => !rule.deprecated);
}

/**
 * Task #39: Compare semantic versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;

    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }

  return 0;
}

/**
 * Task #39: Get migration suggestions for deprecated rules in use
 */
export function getMigrationSuggestions(ruleIds: string[]): Array<{
  ruleId: string;
  ruleName: string;
  deprecatedMessage?: string;
  replacedBy?: string;
  suggestion: string;
}> {
  const suggestions: Array<{
    ruleId: string;
    ruleName: string;
    deprecatedMessage?: string;
    replacedBy?: string;
    suggestion: string;
  }> = [];

  for (const ruleId of ruleIds) {
    const rule = allBuiltInRules.find(r => r.id === ruleId);
    if (rule?.deprecated) {
      let suggestion = `Rule '${rule.name}' (${rule.id}) is deprecated.`;

      if (rule.deprecatedMessage) {
        suggestion += ` ${rule.deprecatedMessage}`;
      }

      if (rule.replacedBy) {
        const replacement = allBuiltInRules.find(r => r.id === rule.replacedBy);
        if (replacement) {
          suggestion += ` Migrate to '${replacement.name}' (${rule.replacedBy}).`;
        } else {
          suggestion += ` Recommended replacement: ${rule.replacedBy}.`;
        }
      }

      suggestions.push({
        ruleId: rule.id,
        ruleName: rule.name,
        deprecatedMessage: rule.deprecatedMessage,
        replacedBy: rule.replacedBy,
        suggestion
      });
    }
  }

  return suggestions;
}

// ============================================================================
// Task #31, #33, #34: RULE PATTERNS, FIELD STANDARDS, CONDITION OPTIMIZATION
// ============================================================================

// Re-export pattern builders (Task #31)
export {
  createAuthenticationRule,
  createDataAccessRule,
  createBulkDataAccessRule,
  createRateLimitRule,
  createComplianceRule,
  createEnvironmentRule,
  createSecurityRule,
  createOperationalRule,
  createDenyRule,
  createApprovalRule,
  createWarningRule,
  createAuditRule,
  createComplianceRuleSet,
  createSecurityRuleSet,
  COMPLIANCE_FRAMEWORKS,
  INJECTION_PATTERNS,
  type AuthenticationRuleOptions,
  type DataAccessRuleOptions,
  type RateLimitRuleOptions,
  type ComplianceRuleOptions,
  type EnvironmentRuleOptions,
  type SecurityRuleOptions,
  type OperationalRuleOptions,
  type ComplianceFramework,
  type BaseRuleOptions
} from './patterns.js';

// Re-export field standards (Task #33)
export {
  ActionFields,
  EnvironmentFields,
  UserFields,
  DataFields,
  OperationFields,
  SecurityFields,
  ComplianceFields,
  OperationalFields,
  TestingFields,
  ApiFields,
  UxFields,
  WebSocketFields,
  MlAiFields,
  FrameworkFields,
  Fields,
  LegacyFieldMappings,
  validateFieldName,
  validateRuleConditions,
  getLegacyFieldWarnings,
  toStandardFieldPath,
  type StandardFieldPath,
  type FieldCategory,
  type FieldValidationResult
} from './field-standards.js';

// Re-export condition optimizer (Task #34)
export {
  optimizeConditions,
  optimizeRule,
  optimizeRules,
  combineEqualsToIn,
  reorderForShortCircuit,
  removeRedundant,
  simplifyConditions,
  analyzeRulesForOptimization,
  DEFAULT_FIELD_COSTS,
  type OptimizationResult,
  type OptimizationChange,
  type FieldCost
} from './condition-optimizer.js';

// Re-export shared patterns (avoid duplicates with patterns.js)
export {
  createAuditLoggingRule,
  createDataTypeAuditRule,
  createEncryptionRule,
  createValidationRule,
  createProductionRule,
  createDebugModeRule,
  createProductionHttpsRule,
  createProductionMonitoringRule,
  AUDIT_CATEGORIES,
  AUDIT_LOG_ACTION,
  ENCRYPTION_CONDITION,
  HTTPS_PROTOCOL_CONDITION,
  TLS_CONDITION,
  VALIDATION_REQUIRED_CONDITION,
  FILE_VALIDATION_CONDITION,
  MESSAGE_VALIDATION_CONDITION,
  SIGNATURE_VALIDATION_CONDITION,
  RATE_LIMIT_ENABLED_CONDITION,
  MESSAGE_RATE_LIMIT_CONDITION,
  PRODUCTION_ENV_CONDITION,
  sharedPatterns
} from './shared-patterns.js';
