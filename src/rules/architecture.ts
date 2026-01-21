/**
 * Enterprise Agent Supervisor - Architecture Rules
 *
 * Built-in rules for enforcing architectural best practices and patterns.
 */

import type { BusinessRule } from '../types/index.js';

export const architectureRules: BusinessRule[] = [
  // ============================================================================
  // API DESIGN RULES
  // ============================================================================
  {
    id: 'arch-001',
    name: 'API Version Requirement',
    description: 'Ensures API calls include version specification',
    type: 'architecture',
    enabled: true,
    priority: 800,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'external_api' },
      { field: 'apiVersion', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Architecture: API calls should specify version for stability' }
    ],
    riskWeight: 15,
    tags: ['architecture', 'api', 'versioning']
  },
  {
    id: 'arch-002',
    name: 'Rate Limit Headers Required',
    description: 'Ensures API responses include rate limit information',
    type: 'architecture',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'external_api' },
      { field: 'rateLimitHeadersIncluded', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Architecture: API responses should include rate limit headers' }
    ],
    riskWeight: 10,
    tags: ['architecture', 'api', 'rate-limiting']
  },
  {
    id: 'arch-003',
    name: 'Idempotency for Mutations',
    description: 'Requires idempotency keys for mutating operations',
    type: 'architecture',
    enabled: true,
    priority: 820,
    conditions: [
      { field: 'actionCategory', operator: 'in', value: ['data_modification', 'external_api'] },
      { field: 'httpMethod', operator: 'in', value: ['POST', 'PUT', 'PATCH'] },
      { field: 'idempotencyKey', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Architecture: Mutating operations should include idempotency keys' }
    ],
    riskWeight: 20,
    tags: ['architecture', 'idempotency', 'reliability']
  },

  // ============================================================================
  // SERVICE ARCHITECTURE RULES
  // ============================================================================
  {
    id: 'arch-010',
    name: 'Circuit Breaker Requirement',
    description: 'Requires circuit breaker for external service calls',
    type: 'architecture',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'external_api' },
      { field: 'circuitBreakerEnabled', operator: 'not_equals', value: true },
      { field: 'environment', operator: 'equals', value: 'production' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Architecture: Production external calls should use circuit breaker' }
    ],
    riskWeight: 25,
    tags: ['architecture', 'resilience', 'circuit-breaker']
  },
  {
    id: 'arch-011',
    name: 'Timeout Configuration Required',
    description: 'Ensures external calls have timeout configured',
    type: 'architecture',
    enabled: true,
    priority: 860,
    conditions: [
      { field: 'actionCategory', operator: 'in', value: ['external_api', 'network'] },
      { field: 'timeout', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Architecture: External calls must have timeout configured' }
    ],
    riskWeight: 20,
    tags: ['architecture', 'timeout', 'reliability']
  },
  {
    id: 'arch-012',
    name: 'Retry Policy Configuration',
    description: 'Requires retry policy for transient failures',
    type: 'architecture',
    enabled: true,
    priority: 780,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'external_api' },
      { field: 'retryPolicy', operator: 'not_exists', value: null },
      { field: 'isIdempotent', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Architecture: Idempotent operations should have retry policy' }
    ],
    riskWeight: 15,
    tags: ['architecture', 'retry', 'resilience']
  },

  // ============================================================================
  // DATA ARCHITECTURE RULES
  // ============================================================================
  {
    id: 'arch-020',
    name: 'Transaction Boundary Check',
    description: 'Ensures database operations have proper transaction boundaries',
    type: 'architecture',
    enabled: true,
    priority: 880,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
      { field: 'multiTableOperation', operator: 'equals', value: true },
      { field: 'transactionBoundary', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Architecture: Multi-table operations should define transaction boundaries' }
    ],
    riskWeight: 30,
    tags: ['architecture', 'database', 'transactions']
  },
  {
    id: 'arch-021',
    name: 'Cache Strategy Required',
    description: 'Requires caching strategy for frequently accessed data',
    type: 'architecture',
    enabled: true,
    priority: 720,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_access' },
      { field: 'accessFrequency', operator: 'equals', value: 'high' },
      { field: 'cacheStrategy', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Architecture: High-frequency data access should implement caching' }
    ],
    riskWeight: 12,
    tags: ['architecture', 'caching', 'performance']
  },
  {
    id: 'arch-022',
    name: 'Pagination Required for Collections',
    description: 'Requires pagination for collection endpoints',
    type: 'architecture',
    enabled: true,
    priority: 770,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_access' },
      { field: 'returnsCollection', operator: 'equals', value: true },
      { field: 'paginationEnabled', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Architecture: Collection endpoints should implement pagination' }
    ],
    riskWeight: 18,
    tags: ['architecture', 'pagination', 'performance']
  },

  // ============================================================================
  // EVENT ARCHITECTURE RULES
  // ============================================================================
  {
    id: 'arch-030',
    name: 'Event Schema Versioning',
    description: 'Requires version in event schemas',
    type: 'architecture',
    enabled: true,
    priority: 790,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'publish' },
      { field: 'eventSchemaVersion', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Architecture: Events should include schema version' }
    ],
    riskWeight: 15,
    tags: ['architecture', 'events', 'versioning']
  },
  {
    id: 'arch-031',
    name: 'Dead Letter Queue Configuration',
    description: 'Requires DLQ for async message processing',
    type: 'architecture',
    enabled: true,
    priority: 810,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'queue' },
      { field: 'deadLetterQueueConfigured', operator: 'not_equals', value: true },
      { field: 'environment', operator: 'equals', value: 'production' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Architecture: Production queues should have DLQ configured' }
    ],
    riskWeight: 22,
    tags: ['architecture', 'messaging', 'dlq']
  },

  // ============================================================================
  // DEPLOYMENT ARCHITECTURE RULES
  // ============================================================================
  {
    id: 'arch-040',
    name: 'Health Check Endpoint',
    description: 'Requires health check endpoint for services',
    type: 'architecture',
    enabled: true,
    priority: 840,
    conditions: [
      { field: 'actionName', operator: 'equals', value: 'deploy_service' },
      { field: 'healthCheckEndpoint', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Architecture: Services should expose health check endpoint' }
    ],
    riskWeight: 20,
    tags: ['architecture', 'deployment', 'observability']
  },
  {
    id: 'arch-041',
    name: 'Graceful Shutdown Support',
    description: 'Requires graceful shutdown handling',
    type: 'architecture',
    enabled: true,
    priority: 830,
    conditions: [
      { field: 'actionName', operator: 'equals', value: 'deploy_service' },
      { field: 'gracefulShutdownEnabled', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Architecture: Services should implement graceful shutdown' }
    ],
    riskWeight: 18,
    tags: ['architecture', 'deployment', 'reliability']
  },

  // ============================================================================
  // OBSERVABILITY RULES
  // ============================================================================
  {
    id: 'arch-050',
    name: 'Distributed Tracing',
    description: 'Requires trace context propagation',
    type: 'architecture',
    enabled: true,
    priority: 760,
    conditions: [
      { field: 'actionCategory', operator: 'in', value: ['external_api', 'network'] },
      { field: 'traceContextPropagated', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Architecture: Cross-service calls should propagate trace context' }
    ],
    riskWeight: 12,
    tags: ['architecture', 'observability', 'tracing']
  },
  {
    id: 'arch-051',
    name: 'Metrics Collection',
    description: 'Requires metrics for critical operations',
    type: 'architecture',
    enabled: true,
    priority: 740,
    conditions: [
      { field: 'isCriticalPath', operator: 'equals', value: true },
      { field: 'metricsEnabled', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Architecture: Critical path operations should collect metrics' }
    ],
    riskWeight: 15,
    tags: ['architecture', 'observability', 'metrics']
  },
  {
    id: 'arch-052',
    name: 'Structured Logging',
    description: 'Requires structured log format',
    type: 'architecture',
    enabled: true,
    priority: 700,
    conditions: [
      { field: 'logFormat', operator: 'not_equals', value: 'json' },
      { field: 'environment', operator: 'equals', value: 'production' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Architecture: Production logs should use structured format (JSON)' }
    ],
    riskWeight: 10,
    tags: ['architecture', 'observability', 'logging']
  }
];

export default architectureRules;
