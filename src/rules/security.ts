/**
 * Enterprise Agent Supervisor - Security Rules
 *
 * Built-in security rules for protecting against common vulnerabilities and threats.
 */

import type { BusinessRule } from '../types/index.js';

export const securityRules: BusinessRule[] = [
  // ============================================================================
  // DATA PROTECTION RULES
  // ============================================================================
  {
    id: 'sec-001',
    name: 'Block PII Access Without Authorization',
    description: 'Prevents unauthorized access to personally identifiable information',
    type: 'security',
    enabled: true,
    priority: 950,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'pii_access' },
      { field: 'userRole', operator: 'not_in', value: ['admin', 'data_officer', 'compliance'] }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'PII access requires authorized role (admin, data_officer, compliance)' },
      { type: 'log' }
    ],
    riskWeight: 45,
    tags: ['pii', 'gdpr', 'privacy']
  },
  {
    id: 'sec-002',
    name: 'Require Approval for Bulk Data Export',
    description: 'Requires human approval for exporting large datasets',
    type: 'security',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'export' },
      { field: 'recordCount', operator: 'greater_than', value: 1000 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'Bulk data export (>1000 records) requires human approval' }
    ],
    riskWeight: 35,
    tags: ['data-export', 'bulk-operations']
  },
  {
    id: 'sec-003',
    name: 'Block Sensitive Data in Logs',
    description: 'Prevents logging of sensitive information',
    type: 'security',
    enabled: true,
    priority: 920,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_access' },
      { field: 'dataClassification', operator: 'in', value: ['confidential', 'restricted'] },
      { field: 'logEnabled', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Sensitive data should not be logged - ensure data masking is enabled' }
    ],
    riskWeight: 25,
    tags: ['logging', 'data-masking']
  },

  // ============================================================================
  // AUTHENTICATION & AUTHORIZATION RULES
  // ============================================================================
  {
    id: 'sec-010',
    name: 'Block Unauthenticated API Calls',
    description: 'Prevents API calls without proper authentication',
    type: 'security',
    enabled: true,
    priority: 990,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'external_api' },
      { field: 'authToken', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'External API calls require authentication token' }
    ],
    riskWeight: 50,
    tags: ['authentication', 'api']
  },
  {
    id: 'sec-011',
    name: 'Privilege Escalation Detection',
    description: 'Detects and blocks privilege escalation attempts',
    type: 'security',
    enabled: true,
    priority: 980,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'authorization' },
      { field: 'targetRole', operator: 'in', value: ['admin', 'superuser', 'root'] },
      { field: 'userRole', operator: 'not_in', value: ['admin', 'superuser'] }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Privilege escalation attempt blocked' },
      { type: 'notify', message: 'Security alert: Privilege escalation attempt detected' }
    ],
    riskWeight: 60,
    tags: ['privilege-escalation', 'authorization']
  },
  {
    id: 'sec-012',
    name: 'Session Hijacking Prevention',
    description: 'Blocks actions from suspicious session patterns',
    type: 'security',
    enabled: true,
    priority: 970,
    conditions: [
      { field: 'sessionAnomalyScore', operator: 'greater_than', value: 0.8 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Session anomaly detected - action blocked for security' },
      { type: 'notify', message: 'Security alert: Possible session hijacking detected' }
    ],
    riskWeight: 55,
    tags: ['session-security', 'anomaly-detection']
  },

  // ============================================================================
  // CODE EXECUTION RULES
  // ============================================================================
  {
    id: 'sec-020',
    name: 'Block Arbitrary Code Execution',
    description: 'Prevents execution of unvalidated code',
    type: 'security',
    enabled: true,
    priority: 1000,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'code_execution' },
      { field: 'codeValidated', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Code execution requires validation before execution' }
    ],
    riskWeight: 70,
    tags: ['code-execution', 'validation']
  },
  {
    id: 'sec-021',
    name: 'Sandbox Requirement for Scripts',
    description: 'Requires sandbox for script execution',
    type: 'security',
    enabled: true,
    priority: 960,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'code_execution' },
      { field: 'sandboxed', operator: 'not_equals', value: true },
      { field: 'environment', operator: 'equals', value: 'production' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Script execution in production requires sandboxing' }
    ],
    riskWeight: 50,
    tags: ['sandbox', 'code-execution', 'production']
  },

  // ============================================================================
  // NETWORK SECURITY RULES
  // ============================================================================
  {
    id: 'sec-030',
    name: 'Block Unauthorized External Connections',
    description: 'Prevents connections to non-whitelisted external hosts',
    type: 'security',
    enabled: true,
    priority: 940,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'network' },
      { field: 'hostWhitelisted', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'Connection to non-whitelisted host requires approval' }
    ],
    riskWeight: 35,
    tags: ['network', 'whitelist']
  },
  {
    id: 'sec-031',
    name: 'Enforce HTTPS for External APIs',
    description: 'Requires HTTPS for all external API communications',
    type: 'security',
    enabled: true,
    priority: 930,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'external_api' },
      { field: 'protocol', operator: 'not_equals', value: 'https' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'External API calls must use HTTPS' }
    ],
    riskWeight: 40,
    tags: ['https', 'encryption', 'api']
  },

  // ============================================================================
  // FILE SYSTEM SECURITY RULES
  // ============================================================================
  {
    id: 'sec-040',
    name: 'Block Access to System Files',
    description: 'Prevents access to critical system files',
    type: 'security',
    enabled: true,
    priority: 990,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'file_system' },
      { field: 'filePath', operator: 'matches_regex', value: '^(/etc|/sys|/proc|C:\\\\Windows)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Access to system files is prohibited' }
    ],
    riskWeight: 60,
    tags: ['file-system', 'system-files']
  },
  {
    id: 'sec-041',
    name: 'Require Approval for Config File Changes',
    description: 'Requires approval for modifying configuration files',
    type: 'security',
    enabled: true,
    priority: 880,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'file_system' },
      { field: 'operation', operator: 'in', value: ['write', 'delete', 'modify'] },
      { field: 'filePath', operator: 'matches_regex', value: '\\.(conf|config|yml|yaml|json|env)$' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'Configuration file changes require approval' }
    ],
    riskWeight: 30,
    tags: ['configuration', 'file-system']
  },

  // ============================================================================
  // INJECTION PREVENTION RULES
  // ============================================================================
  {
    id: 'sec-050',
    name: 'SQL Injection Prevention',
    description: 'Detects and blocks SQL injection patterns',
    type: 'security',
    enabled: true,
    priority: 1000,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_access' },
      { field: 'query', operator: 'matches_regex', value: '(\\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|OR|AND)\\b.*[\'";])|(--)|(\\*/)|(/\\*)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'SQL injection pattern detected - action blocked' },
      { type: 'notify', message: 'Security alert: SQL injection attempt detected' }
    ],
    riskWeight: 80,
    tags: ['sql-injection', 'owasp']
  },
  {
    id: 'sec-051',
    name: 'Command Injection Prevention',
    description: 'Detects and blocks command injection patterns',
    type: 'security',
    enabled: true,
    priority: 1000,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'code_execution' },
      { field: 'command', operator: 'matches_regex', value: '([;&|`$]|\\$\\(|\\{\\{)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Command injection pattern detected - action blocked' },
      { type: 'notify', message: 'Security alert: Command injection attempt detected' }
    ],
    riskWeight: 80,
    tags: ['command-injection', 'owasp']
  }
];

export default securityRules;
