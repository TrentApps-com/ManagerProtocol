/**
 * Flask Security Rules
 * Governance rules specific to Flask web applications
 */

import type { BusinessRule } from '../types/index.js';
import {
  createValidationRule,
  createProductionHttpsRule
} from './shared-patterns.js';

export const flaskRules: BusinessRule[] = [
  {
    id: 'flask-001',
    name: 'Prohibit Flask Debug Mode in Production',
    description: 'Flask debug mode must be disabled in production environments',
    type: 'security',
    enabled: true,
    priority: 990,
    conditions: [
      { field: 'environment', operator: 'equals', value: 'production' },
      { field: 'flaskDebugEnabled', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Flask debug mode is prohibited in production (security risk)' },
      { type: 'notify', message: 'SECURITY: Flask debug mode detected in production' }
    ],
    riskWeight: 70,
    tags: ['flask', 'security', 'debug', 'production']
  },
  {
    id: 'flask-002',
    name: 'Require CORS Whitelist',
    description: 'CORS must use whitelist, not wildcard in production',
    type: 'security',
    enabled: true,
    priority: 950,
    conditions: [
      { field: 'environment', operator: 'equals', value: 'production' },
      { field: 'corsOrigins', operator: 'equals', value: '*' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'CORS wildcard (*) prohibited in production - use explicit whitelist' }
    ],
    riskWeight: 55,
    tags: ['flask', 'security', 'cors', 'production']
  },
  {
    id: 'flask-003',
    name: 'Enforce Request Size Limits',
    description: 'Flask must have request size limits to prevent DoS',
    type: 'security',
    enabled: true,
    priority: 880,
    conditions: [
      { field: 'framework', operator: 'equals', value: 'flask' },
      { field: 'maxContentLength', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Flask app should set MAX_CONTENT_LENGTH to prevent DoS (default: 10MB)' }
    ],
    riskWeight: 35,
    tags: ['flask', 'security', 'dos', 'limits']
  },
  // File Upload Validation - uses shared validation pattern
  createValidationRule({
    id: 'flask-004',
    name: 'Require File Upload Validation',
    description: 'File uploads must validate type, size, and content',
    validationType: 'file',
    scope: {
      category: 'file_system',
      operation: 'upload'
    },
    actionType: 'deny',
    message: 'File uploads require validation: type whitelist, size limit, content scan',
    priority: 920,
    riskWeight: 50,
    tags: ['flask', 'file-upload']
  }),
  {
    id: 'flask-005',
    name: 'Validate Flask Secret Key Strength',
    description: 'Flask SECRET_KEY must be cryptographically strong',
    type: 'security',
    enabled: true,
    priority: 960,
    conditions: [
      { field: 'framework', operator: 'equals', value: 'flask' },
      { field: 'secretKeyStrength', operator: 'less_than', value: 32 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Flask SECRET_KEY must be ≥32 random bytes (use secrets.token_hex(32))' }
    ],
    riskWeight: 60,
    tags: ['flask', 'security', 'secrets', 'session']
  },
  {
    id: 'flask-006',
    name: 'Prevent Jinja2 Template Injection',
    description: 'Jinja2 auto-escaping must be enabled',
    type: 'security',
    enabled: true,
    priority: 970,
    conditions: [
      { field: 'framework', operator: 'equals', value: 'flask' },
      { field: 'jinjaAutoEscape', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Jinja2 auto-escaping must be enabled to prevent template injection' }
    ],
    riskWeight: 65,
    tags: ['flask', 'security', 'jinja2', 'template-injection', 'xss']
  },
  // HTTPS in Production - uses shared production HTTPS pattern
  createProductionHttpsRule({
    id: 'flask-007',
    framework: 'flask',
    actionType: 'warn',
    priority: 940,
    riskWeight: 45
  }),
  {
    id: 'flask-008',
    name: 'Session Cookie Security',
    description: 'Session cookies must have secure flags',
    type: 'security',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'framework', operator: 'equals', value: 'flask' },
      { field: 'environment', operator: 'equals', value: 'production' },
      { field: 'sessionCookieSecure', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Set SESSION_COOKIE_SECURE=True, SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE=Lax' }
    ],
    riskWeight: 40,
    tags: ['flask', 'security', 'cookies', 'session']
  }
];
