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
import type { BusinessRule, RateLimitConfig } from '../types/index.js';

// Re-export individual rule sets
export { securityRules } from './security.js';
export { complianceRules } from './compliance.js';
export { uxRules } from './ux.js';
export { architectureRules } from './architecture.js';
export { operationalRules } from './operational.js';

/**
 * All built-in rules combined
 */
export const allBuiltInRules: BusinessRule[] = [
  ...securityRules,
  ...complianceRules,
  ...uxRules,
  ...architectureRules,
  ...operationalRules
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
  }
};
