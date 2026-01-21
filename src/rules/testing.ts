/**
 * Testing & Quality Assurance Rules
 * Governance rules for Playwright and test automation
 */

import type { BusinessRule } from '../types/index.js';

export const testingRules: BusinessRule[] = [
  {
    id: 'test-001',
    name: 'Require Test Isolation',
    description: 'Tests must be isolated with no shared state',
    type: 'architecture',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'code_execution' },
      { field: 'isTest', operator: 'equals', value: true },
      { field: 'testIsolation', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Tests should be isolated (independent setup/teardown, no shared state)' }
    ],
    riskWeight: 35,
    tags: ['testing', 'playwright', 'isolation', 'quality']
  },
  {
    id: 'test-002',
    name: 'Limit Test Execution Time',
    description: 'Flag slow tests for optimization',
    type: 'operational',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'isTest', operator: 'equals', value: true },
      { field: 'executionTimeMs', operator: 'greater_than', value: 30000 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Test execution >30s - consider optimization or splitting into smaller tests' }
    ],
    riskWeight: 20,
    tags: ['testing', 'performance', 'optimization']
  },
  {
    id: 'test-003',
    name: 'Require Test Data Cleanup',
    description: 'Tests must clean up created data/artifacts',
    type: 'operational',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'isTest', operator: 'equals', value: true },
      { field: 'hasCleanup', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Tests should cleanup data/artifacts in afterEach/afterAll hooks' }
    ],
    riskWeight: 25,
    tags: ['testing', 'cleanup', 'maintenance']
  },
  {
    id: 'test-004',
    name: 'Enforce Deterministic Test Patterns',
    description: 'Avoid random waits and non-deterministic patterns',
    type: 'architecture',
    enabled: true,
    priority: 880,
    conditions: [
      { field: 'isTest', operator: 'equals', value: true },
      { field: 'usesRandomWait', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Avoid random waits in tests - use waitForSelector, waitForLoadState, etc.' }
    ],
    riskWeight: 30,
    tags: ['testing', 'playwright', 'determinism', 'flakiness']
  },
  {
    id: 'test-005',
    name: 'Screenshot Storage Limits',
    description: 'Limit screenshot retention to prevent disk usage',
    type: 'operational',
    enabled: true,
    priority: 700,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'screenshot' },
      { field: 'screenshotRetentionDays', operator: 'greater_than', value: 7 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Screenshot retention >7 days may consume excessive storage' }
    ],
    riskWeight: 15,
    tags: ['testing', 'storage', 'cleanup', 'playwright']
  },
  {
    id: 'test-006',
    name: 'Parallel Test Safety',
    description: 'Tests run in parallel must not conflict',
    type: 'architecture',
    enabled: true,
    priority: 860,
    conditions: [
      { field: 'isTest', operator: 'equals', value: true },
      { field: 'runsInParallel', operator: 'equals', value: true },
      { field: 'parallelSafe', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Parallel tests must not share resources (unique test data, ports, files)' }
    ],
    riskWeight: 30,
    tags: ['testing', 'parallel', 'concurrency', 'playwright']
  },
  {
    id: 'test-007',
    name: 'E2E Test Environment Isolation',
    description: 'E2E tests should run against isolated test environment',
    type: 'operational',
    enabled: true,
    priority: 920,
    conditions: [
      { field: 'testType', operator: 'equals', value: 'e2e' },
      { field: 'environment', operator: 'equals', value: 'production' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'E2E tests must not run against production environment' }
    ],
    riskWeight: 50,
    tags: ['testing', 'e2e', 'environment', 'safety']
  }
];
