/**
 * Enterprise Agent Supervisor - Operational Rules
 *
 * Built-in rules for operational excellence, resource management, and cost control.
 */

import type { BusinessRule } from '../types/index.js';

export const operationalRules: BusinessRule[] = [
  // ============================================================================
  // RESOURCE MANAGEMENT RULES
  // ============================================================================
  {
    id: 'ops-001',
    name: 'Resource Allocation Limit',
    description: 'Prevents excessive resource allocation',
    type: 'operational',
    enabled: true,
    priority: 880,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'resource_allocation' },
      { field: 'resourceCost', operator: 'greater_than', value: 1000 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'Resource allocation exceeds $1000 - requires approval' }
    ],
    riskWeight: 30,
    tags: ['operational', 'cost', 'resources']
  },
  {
    id: 'ops-002',
    name: 'Concurrent Operation Limit',
    description: 'Limits concurrent expensive operations',
    type: 'operational',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'operationType', operator: 'equals', value: 'expensive' },
      { field: 'concurrentCount', operator: 'greater_than', value: 5 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'rate_limit', message: 'Too many concurrent expensive operations' }
    ],
    riskWeight: 25,
    tags: ['operational', 'concurrency', 'limits']
  },
  {
    id: 'ops-003',
    name: 'Memory Usage Warning',
    description: 'Warns when operations may consume excessive memory',
    type: 'operational',
    enabled: true,
    priority: 800,
    conditions: [
      { field: 'estimatedMemoryMb', operator: 'greater_than', value: 512 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Operation may consume >512MB memory - consider streaming' }
    ],
    riskWeight: 15,
    tags: ['operational', 'memory', 'performance']
  },

  // ============================================================================
  // PRODUCTION SAFETY RULES
  // ============================================================================
  {
    id: 'ops-010',
    name: 'Production Deployment Window',
    description: 'Restricts deployments to approved windows',
    type: 'operational',
    enabled: true,
    priority: 920,
    conditions: [
      { field: 'actionName', operator: 'equals', value: 'deploy' },
      { field: 'environment', operator: 'equals', value: 'production' },
      { field: 'deploymentWindowOpen', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'Production deployment outside approved window requires approval' }
    ],
    riskWeight: 40,
    tags: ['operational', 'deployment', 'change-management']
  },
  {
    id: 'ops-011',
    name: 'Rollback Plan Required',
    description: 'Requires rollback plan for production changes',
    type: 'operational',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'environment', operator: 'equals', value: 'production' },
      { field: 'actionCategory', operator: 'in', value: ['system_config', 'data_modification'] },
      { field: 'rollbackPlanDefined', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Production changes should have a rollback plan defined' }
    ],
    riskWeight: 30,
    tags: ['operational', 'rollback', 'safety']
  },
  {
    id: 'ops-012',
    name: 'Feature Flag for New Features',
    description: 'Requires feature flags for new functionality in production',
    type: 'operational',
    enabled: true,
    priority: 780,
    conditions: [
      { field: 'environment', operator: 'equals', value: 'production' },
      { field: 'isNewFeature', operator: 'equals', value: true },
      { field: 'featureFlagEnabled', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'New features in production should use feature flags' }
    ],
    riskWeight: 20,
    tags: ['operational', 'feature-flags', 'deployment']
  },

  // ============================================================================
  // INCIDENT MANAGEMENT RULES
  // ============================================================================
  {
    id: 'ops-020',
    name: 'Incident Response Escalation',
    description: 'Escalates critical issues for immediate attention',
    type: 'operational',
    enabled: true,
    priority: 980,
    conditions: [
      { field: 'incidentSeverity', operator: 'in', value: ['critical', 'high'] },
      { field: 'environment', operator: 'equals', value: 'production' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'escalate', message: 'Critical production incident - immediate escalation required' },
      { type: 'notify', message: 'ALERT: Critical production incident detected' }
    ],
    riskWeight: 50,
    tags: ['operational', 'incident', 'escalation']
  },
  {
    id: 'ops-021',
    name: 'Change Freeze Enforcement',
    description: 'Blocks changes during declared change freeze',
    type: 'operational',
    enabled: true,
    priority: 990,
    conditions: [
      { field: 'changeFreezeActive', operator: 'equals', value: true },
      { field: 'actionCategory', operator: 'in', value: ['system_config', 'data_modification', 'code_execution'] }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Changes blocked during change freeze period' }
    ],
    riskWeight: 60,
    tags: ['operational', 'change-freeze', 'stability']
  },

  // ============================================================================
  // COST CONTROL RULES
  // ============================================================================
  {
    id: 'ops-030',
    name: 'API Cost Threshold',
    description: 'Requires approval for high-cost API operations',
    type: 'operational',
    enabled: true,
    priority: 860,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'external_api' },
      { field: 'estimatedCost', operator: 'greater_than', value: 10 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'API call cost exceeds $10 - requires approval' },
      { type: 'log' }
    ],
    riskWeight: 25,
    tags: ['operational', 'cost', 'api']
  },
  {
    id: 'ops-031',
    name: 'Token Usage Limit',
    description: 'Limits AI/LLM token consumption',
    type: 'operational',
    enabled: true,
    priority: 830,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'llm' },
      { field: 'tokenCount', operator: 'greater_than', value: 100000 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'LLM call exceeds 100K tokens - requires approval' }
    ],
    riskWeight: 20,
    tags: ['operational', 'cost', 'llm', 'tokens']
  },
  {
    id: 'ops-032',
    name: 'Daily Budget Enforcement',
    description: 'Enforces daily spending limits',
    type: 'operational',
    enabled: true,
    priority: 870,
    conditions: [
      { field: 'dailySpend', operator: 'greater_than', value: 500 },
      { field: 'budgetOverrideApproved', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Daily budget limit ($500) exceeded - operation blocked' }
    ],
    riskWeight: 35,
    tags: ['operational', 'budget', 'cost']
  },

  // ============================================================================
  // MAINTENANCE WINDOW RULES
  // ============================================================================
  {
    id: 'ops-040',
    name: 'Maintenance Window Check',
    description: 'Flags operations during maintenance windows',
    type: 'operational',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'maintenanceWindowActive', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'System is in maintenance window - operations may be affected' }
    ],
    riskWeight: 10,
    tags: ['operational', 'maintenance', 'awareness']
  },
  {
    id: 'ops-041',
    name: 'Backup Verification Required',
    description: 'Requires backup verification before destructive operations',
    type: 'operational',
    enabled: true,
    priority: 890,
    conditions: [
      { field: 'operation', operator: 'in', value: ['delete', 'truncate', 'drop', 'purge'] },
      { field: 'environment', operator: 'equals', value: 'production' },
      { field: 'backupVerified', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'Destructive operation requires backup verification' }
    ],
    riskWeight: 45,
    tags: ['operational', 'backup', 'destructive']
  },

  // ============================================================================
  // AGENT OPERATION LIMITS
  // ============================================================================
  {
    id: 'ops-050',
    name: 'Agent Action Per-Session Limit',
    description: 'Limits total actions an agent can take per session',
    type: 'operational',
    enabled: true,
    priority: 840,
    conditions: [
      { field: 'sessionActionCount', operator: 'greater_than', value: 1000 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Session action count exceeds 1000 - consider session rotation' }
    ],
    riskWeight: 15,
    tags: ['operational', 'limits', 'session']
  },
  {
    id: 'ops-051',
    name: 'Agent Retry Limit',
    description: 'Limits retry attempts for failed operations',
    type: 'operational',
    enabled: true,
    priority: 820,
    conditions: [
      { field: 'retryCount', operator: 'greater_than', value: 5 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Maximum retry attempts (5) exceeded - operation blocked' },
      { type: 'escalate', message: 'Operation repeatedly failing - escalation required' }
    ],
    riskWeight: 25,
    tags: ['operational', 'retry', 'limits']
  },
  {
    id: 'ops-052',
    name: 'Agent Loop Detection',
    description: 'Detects and prevents agent operation loops',
    type: 'operational',
    enabled: true,
    priority: 950,
    conditions: [
      { field: 'actionPattern', operator: 'equals', value: 'loop_detected' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Operational loop detected - breaking cycle' },
      { type: 'notify', message: 'Alert: Agent operation loop detected and broken' }
    ],
    riskWeight: 40,
    tags: ['operational', 'loop', 'safety']
  }
];

export default operationalRules;
