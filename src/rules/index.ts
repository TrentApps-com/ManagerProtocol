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
