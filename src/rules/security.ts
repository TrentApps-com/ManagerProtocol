/**
 * Enterprise Agent Supervisor - Security Rules
 *
 * Built-in security rules for protecting against common vulnerabilities and threats.
 */

import type { BusinessRule } from '../types/index.js';
import { createEncryptionRule } from './shared-patterns.js';

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
    tags: ['pii', 'gdpr', 'privacy'],
    // Task #37: Rule interdependencies
    relatedRules: ['sec-002', 'sec-003'] // Related to data export and logging rules
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
    tags: ['data-export', 'bulk-operations'],
    // Task #37: Rule interdependencies
    dependsOn: ['sec-001'], // Check PII access authorization first
    relatedRules: ['sec-003'] // Related to logging sensitive data
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
    tags: ['logging', 'data-masking'],
    // Task #37: Rule interdependencies
    dependsOn: ['sec-001'], // PII access check should happen first
    relatedRules: ['sec-002'] // Related to bulk export
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
    tags: ['authentication', 'api'],
    // Task #37: Rule interdependencies
    relatedRules: ['sec-011', 'sec-012', 'sec-031'] // Related auth and API rules
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
    tags: ['privilege-escalation', 'authorization'],
    // Task #37: Rule interdependencies
    dependsOn: ['sec-010'], // Check authentication before authorization
    relatedRules: ['sec-012'] // Related session security
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
    tags: ['session-security', 'anomaly-detection'],
    // Task #37: Rule interdependencies
    dependsOn: ['sec-010'], // Check authentication first
    relatedRules: ['sec-011'] // Related to privilege escalation
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
  // HTTPS for External APIs - uses shared encryption pattern
  createEncryptionRule({
    id: 'sec-031',
    name: 'Enforce HTTPS for External APIs',
    description: 'Requires HTTPS for all external API communications',
    encryptionType: 'transport',
    scope: {
      category: 'external_api'
    },
    actionType: 'deny',
    message: 'External API calls must use HTTPS',
    priority: 930,
    riskWeight: 40,
    tags: ['https', 'api']
  }),

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
  },

  // ============================================================================
  // OWASP TOP 10 - PATH TRAVERSAL (A01:2021 - Broken Access Control)
  // ============================================================================
  {
    id: 'sec-060',
    name: 'Path Traversal Prevention',
    description: 'Detects and blocks path traversal attacks (directory traversal)',
    type: 'security',
    enabled: true,
    priority: 1000,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'file_system' },
      { field: 'filePath', operator: 'matches_regex', value: '(\\.\\./|\\.\\.\\\\|%2e%2e%2f|%2e%2e/|\\.\\.%2f|%2e%2e%5c)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Path traversal attack detected - action blocked' },
      { type: 'notify', message: 'Security alert: Path traversal attempt detected' }
    ],
    riskWeight: 85,
    tags: ['path-traversal', 'owasp', 'a01-broken-access-control']
  },
  {
    id: 'sec-061',
    name: 'Null Byte Injection Prevention',
    description: 'Blocks null byte injection in file paths',
    type: 'security',
    enabled: true,
    priority: 995,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'file_system' },
      { field: 'filePath', operator: 'matches_regex', value: '(%00|\\x00|\\0)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Null byte injection detected in file path' },
      { type: 'notify', message: 'Security alert: Null byte injection attempt detected' }
    ],
    riskWeight: 80,
    tags: ['null-byte', 'owasp', 'file-system']
  },

  // ============================================================================
  // OWASP TOP 10 - SSRF (A10:2021 - Server-Side Request Forgery)
  // ============================================================================
  {
    id: 'sec-070',
    name: 'SSRF Prevention - Internal Network',
    description: 'Blocks server-side requests to internal network addresses',
    type: 'security',
    enabled: true,
    priority: 990,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'network' },
      { field: 'targetUrl', operator: 'matches_regex', value: '(localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|192\\.168\\.|\\[::1\\]|\\[::\\])' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'SSRF attempt blocked - internal network address detected' },
      { type: 'notify', message: 'Security alert: SSRF attempt to internal network' }
    ],
    riskWeight: 75,
    tags: ['ssrf', 'owasp', 'a10-ssrf', 'network']
  },
  {
    id: 'sec-071',
    name: 'SSRF Prevention - Cloud Metadata',
    description: 'Blocks server-side requests to cloud metadata endpoints',
    type: 'security',
    enabled: true,
    priority: 995,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'network' },
      { field: 'targetUrl', operator: 'matches_regex', value: '(169\\.254\\.169\\.254|metadata\\.google|metadata\\.azure)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'SSRF attempt blocked - cloud metadata endpoint detected' },
      { type: 'notify', message: 'Security alert: SSRF attempt to cloud metadata' }
    ],
    riskWeight: 90,
    tags: ['ssrf', 'owasp', 'a10-ssrf', 'cloud-metadata']
  },
  {
    id: 'sec-072',
    name: 'SSRF Prevention - File Protocol',
    description: 'Blocks server-side requests using file:// protocol',
    type: 'security',
    enabled: true,
    priority: 990,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'network' },
      { field: 'targetUrl', operator: 'matches_regex', value: '^(file|gopher|dict|ldap|tftp)://' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'SSRF attempt blocked - dangerous protocol detected' },
      { type: 'notify', message: 'Security alert: SSRF attempt with dangerous protocol' }
    ],
    riskWeight: 85,
    tags: ['ssrf', 'owasp', 'a10-ssrf', 'protocol']
  },

  // ============================================================================
  // OWASP TOP 10 - INSECURE DESERIALIZATION (A08:2021 - Software and Data Integrity Failures)
  // ============================================================================
  {
    id: 'sec-080',
    name: 'Insecure Deserialization Prevention - Java',
    description: 'Detects Java deserialization attacks',
    type: 'security',
    enabled: true,
    priority: 985,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
      { field: 'payload', operator: 'matches_regex', value: '(rO0AB|ac ed 00 05|java\\.lang\\.(Runtime|ProcessBuilder)|ysoserial)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Java deserialization attack detected - action blocked' },
      { type: 'notify', message: 'Security alert: Java deserialization attack attempt' }
    ],
    riskWeight: 90,
    tags: ['deserialization', 'owasp', 'a08-integrity', 'java']
  },
  {
    id: 'sec-081',
    name: 'Insecure Deserialization Prevention - PHP',
    description: 'Detects PHP object injection attacks',
    type: 'security',
    enabled: true,
    priority: 985,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
      { field: 'payload', operator: 'matches_regex', value: '(O:\\d+:"|a:\\d+:\\{|s:\\d+:|__wakeup|__destruct|__toString)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'PHP object injection detected - action blocked' },
      { type: 'notify', message: 'Security alert: PHP object injection attempt' }
    ],
    riskWeight: 85,
    tags: ['deserialization', 'owasp', 'a08-integrity', 'php']
  },
  {
    id: 'sec-082',
    name: 'Insecure Deserialization Prevention - Python Pickle',
    description: 'Detects Python pickle deserialization attacks',
    type: 'security',
    enabled: true,
    priority: 985,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
      { field: 'payload', operator: 'matches_regex', value: '(cos\\nsystem|posix\\nsystem|__reduce__|\\x80\\x04)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Python deserialization attack detected - action blocked' },
      { type: 'notify', message: 'Security alert: Python deserialization attempt' }
    ],
    riskWeight: 85,
    tags: ['deserialization', 'owasp', 'a08-integrity', 'python']
  },
  {
    id: 'sec-083',
    name: 'Insecure Deserialization Prevention - .NET',
    description: 'Detects .NET deserialization attacks',
    type: 'security',
    enabled: true,
    priority: 985,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
      { field: 'payload', operator: 'matches_regex', value: '(BinaryFormatter|ObjectStateFormatter|SoapFormatter|NetDataContractSerializer|LosFormatter)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: '.NET deserialization attack detected - action blocked' },
      { type: 'notify', message: 'Security alert: .NET deserialization attack attempt' }
    ],
    riskWeight: 85,
    tags: ['deserialization', 'owasp', 'a08-integrity', 'dotnet']
  },

  // ============================================================================
  // OWASP TOP 10 - XXE (A05:2021 - Security Misconfiguration)
  // ============================================================================
  {
    id: 'sec-090',
    name: 'XXE Prevention - External Entity',
    description: 'Detects XML External Entity injection attacks',
    type: 'security',
    enabled: true,
    priority: 995,
    conditions: [
      { field: 'actionCategory', operator: 'in', value: ['data_access', 'data_modification'] },
      { field: 'payload', operator: 'matches_regex', value: '(<!ENTITY|<!DOCTYPE.*\\[|SYSTEM\\s+["\']|PUBLIC\\s+["\'])' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'XXE attack detected - external entity declaration blocked' },
      { type: 'notify', message: 'Security alert: XXE injection attempt detected' }
    ],
    riskWeight: 85,
    tags: ['xxe', 'owasp', 'a05-misconfiguration', 'xml']
  },
  {
    id: 'sec-091',
    name: 'XXE Prevention - Parameter Entity',
    description: 'Detects XXE parameter entity attacks',
    type: 'security',
    enabled: true,
    priority: 990,
    conditions: [
      { field: 'actionCategory', operator: 'in', value: ['data_access', 'data_modification'] },
      { field: 'payload', operator: 'matches_regex', value: '(%[a-zA-Z0-9]+;|<!ENTITY\\s+%\\s+)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'XXE parameter entity attack detected - action blocked' },
      { type: 'notify', message: 'Security alert: XXE parameter entity attempt' }
    ],
    riskWeight: 80,
    tags: ['xxe', 'owasp', 'a05-misconfiguration', 'xml']
  },

  // ============================================================================
  // OWASP TOP 10 - OPEN REDIRECTS (A01:2021 - Broken Access Control)
  // ============================================================================
  {
    id: 'sec-100',
    name: 'Open Redirect Prevention',
    description: 'Detects and blocks open redirect vulnerabilities',
    type: 'security',
    enabled: true,
    priority: 920,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'network' },
      { field: 'redirectUrl', operator: 'matches_regex', value: '^(https?://|//|\\\\\\\\)(?!localhost|127\\.0\\.0\\.1)' },
      { field: 'redirectValidated', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Open redirect detected - external redirect not allowed' },
      { type: 'notify', message: 'Security alert: Open redirect attempt detected' }
    ],
    riskWeight: 60,
    tags: ['open-redirect', 'owasp', 'a01-broken-access-control']
  },
  {
    id: 'sec-101',
    name: 'Open Redirect Prevention - JavaScript Protocol',
    description: 'Blocks javascript: protocol in redirects',
    type: 'security',
    enabled: true,
    priority: 950,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'network' },
      { field: 'redirectUrl', operator: 'matches_regex', value: '(javascript:|data:|vbscript:)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Dangerous protocol in redirect URL blocked' },
      { type: 'notify', message: 'Security alert: JavaScript protocol redirect attempt' }
    ],
    riskWeight: 75,
    tags: ['open-redirect', 'owasp', 'xss', 'a01-broken-access-control']
  },

  // ============================================================================
  // OWASP TOP 10 - MASS ASSIGNMENT (A01:2021 - Broken Access Control)
  // ============================================================================
  {
    id: 'sec-110',
    name: 'Mass Assignment Prevention - Admin Fields',
    description: 'Blocks mass assignment of admin/privileged fields',
    type: 'security',
    enabled: true,
    priority: 960,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
      { field: 'assignedFields', operator: 'contains', value: 'isAdmin' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Mass assignment blocked - cannot assign admin fields directly' },
      { type: 'notify', message: 'Security alert: Mass assignment attempt on admin field' }
    ],
    riskWeight: 70,
    tags: ['mass-assignment', 'owasp', 'a01-broken-access-control']
  },
  {
    id: 'sec-111',
    name: 'Mass Assignment Prevention - Role Fields',
    description: 'Blocks mass assignment of role/permission fields',
    type: 'security',
    enabled: true,
    priority: 955,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
      { field: 'assignedFields', operator: 'matches_regex', value: '(role|permission|privilege|access_level|is_superuser|is_staff)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Mass assignment blocked - cannot assign role/permission fields directly' },
      { type: 'notify', message: 'Security alert: Mass assignment attempt on role field' }
    ],
    riskWeight: 70,
    tags: ['mass-assignment', 'owasp', 'a01-broken-access-control']
  },
  {
    id: 'sec-112',
    name: 'Mass Assignment Prevention - Sensitive Fields',
    description: 'Blocks mass assignment of password and sensitive fields',
    type: 'security',
    enabled: true,
    priority: 965,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
      { field: 'assignedFields', operator: 'matches_regex', value: '(password|password_hash|secret|api_key|token|credit_card|ssn|account_number)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Mass assignment blocked - cannot assign sensitive fields directly' },
      { type: 'notify', message: 'Security alert: Mass assignment attempt on sensitive field' }
    ],
    riskWeight: 80,
    tags: ['mass-assignment', 'owasp', 'a01-broken-access-control', 'pii']
  },

  // ============================================================================
  // OWASP TOP 10 - BROKEN ACCESS CONTROL (A01:2021)
  // ============================================================================
  {
    id: 'sec-120',
    name: 'IDOR Prevention - Direct Object Reference',
    description: 'Detects insecure direct object reference patterns',
    type: 'security',
    enabled: true,
    priority: 940,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_access' },
      { field: 'objectId', operator: 'exists', value: null },
      { field: 'ownershipVerified', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'Direct object access requires ownership verification' },
      { type: 'warn', message: 'IDOR risk: Ensure object ownership is verified' }
    ],
    riskWeight: 55,
    tags: ['idor', 'owasp', 'a01-broken-access-control']
  },
  {
    id: 'sec-121',
    name: 'Horizontal Privilege Escalation Prevention',
    description: 'Blocks access to resources owned by other users',
    type: 'security',
    enabled: true,
    priority: 970,
    conditions: [
      { field: 'actionCategory', operator: 'in', value: ['data_access', 'data_modification'] },
      { field: 'resourceOwnerId', operator: 'not_equals', value: '@userId' },
      { field: 'userRole', operator: 'not_in', value: ['admin', 'superuser'] }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Access denied - resource belongs to another user' },
      { type: 'notify', message: 'Security alert: Horizontal privilege escalation attempt' }
    ],
    riskWeight: 65,
    tags: ['privilege-escalation', 'owasp', 'a01-broken-access-control']
  },
  {
    id: 'sec-122',
    name: 'Force Browsing Prevention',
    description: 'Blocks access to unauthorized admin/system endpoints',
    type: 'security',
    enabled: true,
    priority: 950,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'network' },
      { field: 'targetUrl', operator: 'matches_regex', value: '(/admin|/management|/console|/debug|/actuator|/swagger|/api-docs)' },
      { field: 'userRole', operator: 'not_in', value: ['admin', 'developer'] }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Access to admin endpoints denied - insufficient privileges' },
      { type: 'notify', message: 'Security alert: Unauthorized admin endpoint access attempt' }
    ],
    riskWeight: 60,
    tags: ['force-browsing', 'owasp', 'a01-broken-access-control']
  },

  // ============================================================================
  // OWASP TOP 10 - CRYPTOGRAPHIC FAILURES (A02:2021)
  // ============================================================================
  {
    id: 'sec-130',
    name: 'Weak Cryptography Detection - MD5/SHA1',
    description: 'Detects use of weak cryptographic algorithms',
    type: 'security',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'actionCategory', operator: 'in', value: ['data_access', 'data_modification', 'authentication'] },
      { field: 'algorithm', operator: 'in', value: ['md5', 'sha1', 'des', '3des', 'rc4', 'rc2'] }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Weak cryptographic algorithm detected - use SHA-256 or stronger' },
      { type: 'log' }
    ],
    riskWeight: 45,
    tags: ['cryptography', 'owasp', 'a02-crypto-failures']
  },
  {
    id: 'sec-131',
    name: 'Hardcoded Secrets Detection',
    description: 'Detects hardcoded secrets, passwords, and API keys',
    type: 'security',
    enabled: true,
    priority: 980,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'code_execution' },
      { field: 'code', operator: 'matches_regex', value: '(password\\s*=\\s*["\'][^"\']+["\']|api[_-]?key\\s*=\\s*["\'][^"\']+["\']|secret\\s*=\\s*["\'][^"\']+["\']|-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Hardcoded secret detected - use environment variables or secret management' },
      { type: 'notify', message: 'Security alert: Hardcoded secret detected in code' }
    ],
    riskWeight: 75,
    tags: ['secrets', 'owasp', 'a02-crypto-failures']
  },
  {
    id: 'sec-132',
    name: 'Insufficient Key Length Detection',
    description: 'Detects cryptographic keys that are too short',
    type: 'security',
    enabled: true,
    priority: 890,
    conditions: [
      { field: 'actionCategory', operator: 'in', value: ['authentication', 'data_modification'] },
      { field: 'keyLength', operator: 'less_than', value: 2048 },
      { field: 'algorithm', operator: 'in', value: ['rsa', 'dsa'] }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Cryptographic key length too short - use at least 2048 bits for RSA/DSA' },
      { type: 'log' }
    ],
    riskWeight: 40,
    tags: ['cryptography', 'owasp', 'a02-crypto-failures']
  },
  {
    id: 'sec-133',
    name: 'Insecure Random Number Generation',
    description: 'Detects use of weak random number generators for security purposes',
    type: 'security',
    enabled: true,
    priority: 910,
    conditions: [
      { field: 'actionCategory', operator: 'in', value: ['authentication', 'code_execution'] },
      { field: 'randomGenerator', operator: 'in', value: ['Math.random', 'random.random', 'rand', 'srand'] },
      { field: 'securityContext', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Weak random number generator used in security context - use cryptographically secure RNG' },
      { type: 'log' }
    ],
    riskWeight: 50,
    tags: ['cryptography', 'owasp', 'a02-crypto-failures']
  },
  {
    id: 'sec-134',
    name: 'Unencrypted Sensitive Data Storage',
    description: 'Detects storage of sensitive data without encryption',
    type: 'security',
    enabled: true,
    priority: 920,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
      { field: 'dataClassification', operator: 'in', value: ['confidential', 'restricted'] },
      { field: 'encrypted', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'Storing sensitive data without encryption requires approval' },
      { type: 'warn', message: 'Sensitive data should be encrypted at rest' }
    ],
    riskWeight: 55,
    tags: ['encryption', 'owasp', 'a02-crypto-failures', 'data-protection']
  },

  // ============================================================================
  // OWASP TOP 10 - XSS (A03:2021 - Injection)
  // ============================================================================
  {
    id: 'sec-140',
    name: 'XSS Prevention - Script Tags',
    description: 'Detects script tag injection attempts',
    type: 'security',
    enabled: true,
    priority: 990,
    conditions: [
      { field: 'actionCategory', operator: 'in', value: ['data_modification', 'user_communication'] },
      { field: 'payload', operator: 'matches_regex', value: '(<script|<\\/script|javascript:|on\\w+\\s*=)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'XSS attack detected - script injection blocked' },
      { type: 'notify', message: 'Security alert: XSS injection attempt detected' }
    ],
    riskWeight: 80,
    tags: ['xss', 'owasp', 'a03-injection']
  },
  {
    id: 'sec-141',
    name: 'XSS Prevention - Event Handlers',
    description: 'Detects event handler injection attempts',
    type: 'security',
    enabled: true,
    priority: 985,
    conditions: [
      { field: 'actionCategory', operator: 'in', value: ['data_modification', 'user_communication'] },
      { field: 'payload', operator: 'matches_regex', value: '(onerror|onload|onclick|onmouseover|onfocus|onblur|onchange|onsubmit)\\s*=' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'XSS attack detected - event handler injection blocked' },
      { type: 'notify', message: 'Security alert: XSS event handler injection attempt' }
    ],
    riskWeight: 75,
    tags: ['xss', 'owasp', 'a03-injection']
  },
  {
    id: 'sec-142',
    name: 'XSS Prevention - Data URI',
    description: 'Detects data URI XSS injection attempts',
    type: 'security',
    enabled: true,
    priority: 980,
    conditions: [
      { field: 'actionCategory', operator: 'in', value: ['data_modification', 'user_communication'] },
      { field: 'payload', operator: 'matches_regex', value: 'data:\\s*(text\\/html|application\\/javascript|text\\/javascript)' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'XSS attack detected - data URI injection blocked' },
      { type: 'notify', message: 'Security alert: XSS data URI injection attempt' }
    ],
    riskWeight: 70,
    tags: ['xss', 'owasp', 'a03-injection']
  }
];

export default securityRules;
