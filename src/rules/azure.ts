/**
 * Azure-Specific Rules
 * Governance rules for Azure Functions, Cosmos DB, and Azure services
 */

import type { BusinessRule } from '../types/index.js';
import {
  createRateLimitRule
} from './shared-patterns.js';

export const azureRules: BusinessRule[] = [
  {
    id: 'azure-001',
    name: 'Require Azure Functions Timeout Configuration',
    description: 'Azure Functions must have explicit timeout configuration',
    type: 'architecture',
    enabled: true,
    priority: 880,
    conditions: [
      { field: 'platform', operator: 'equals', value: 'azure-functions' },
      { field: 'timeout', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Azure Functions should set explicit timeout (default 5min, max 10min for Consumption)' }
    ],
    riskWeight: 25,
    tags: ['azure', 'functions', 'timeout', 'configuration']
  },
  {
    id: 'azure-002',
    name: 'Monitor Cosmos DB RU Consumption',
    description: 'Cosmos DB RU consumption should be monitored',
    type: 'operational',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'database', operator: 'equals', value: 'cosmos-db' },
      { field: 'ruUsagePercent', operator: 'greater_than', value: 80 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Cosmos DB RU usage >80% - consider scaling or optimizing queries' }
    ],
    riskWeight: 35,
    tags: ['azure', 'cosmos-db', 'ru', 'performance', 'cost']
  },
  {
    id: 'azure-003',
    name: 'Enforce Managed Identities',
    description: 'Use managed identities instead of connection strings',
    type: 'security',
    enabled: true,
    priority: 940,
    conditions: [
      { field: 'platform', operator: 'contains', value: 'azure' },
      { field: 'environment', operator: 'equals', value: 'production' },
      { field: 'usesConnectionString', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use Azure Managed Identities instead of connection strings in production' }
    ],
    riskWeight: 45,
    tags: ['azure', 'security', 'managed-identity', 'authentication']
  },
  // Azure OpenAI Rate Limiting - uses shared rate limit pattern
  createRateLimitRule({
    id: 'azure-004',
    name: 'Validate Azure OpenAI Rate Limits',
    description: 'Azure OpenAI calls should respect rate limit headers',
    limitType: 'api',
    scope: {
      category: 'external_api',
      provider: 'azure-openai'
    },
    actionType: 'warn',
    message: 'Implement exponential backoff and respect Azure OpenAI rate limit headers',
    priority: 820,
    riskWeight: 30,
    tags: ['azure', 'openai', 'api']
  }),
  {
    id: 'azure-005',
    name: 'Require Application Insights',
    description: 'Production Azure Functions should use Application Insights',
    type: 'operational',
    enabled: true,
    priority: 860,
    conditions: [
      { field: 'platform', operator: 'equals', value: 'azure-functions' },
      { field: 'environment', operator: 'equals', value: 'production' },
      { field: 'appInsightsEnabled', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Enable Application Insights for production Azure Functions monitoring' }
    ],
    riskWeight: 25,
    tags: ['azure', 'monitoring', 'app-insights', 'observability']
  },
  {
    id: 'azure-006',
    name: 'Cosmos DB Partition Key Strategy',
    description: 'Cosmos DB containers should have optimized partition keys',
    type: 'architecture',
    enabled: true,
    priority: 800,
    conditions: [
      { field: 'database', operator: 'equals', value: 'cosmos-db' },
      { field: 'operation', operator: 'equals', value: 'create_container' },
      { field: 'partitionKeyOptimized', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Cosmos DB: Choose partition key with high cardinality and even distribution' }
    ],
    riskWeight: 30,
    tags: ['azure', 'cosmos-db', 'partition-key', 'performance']
  },
  {
    id: 'azure-007',
    name: 'Static Web App CORS Configuration',
    description: 'Azure SWA should have explicit CORS configuration',
    type: 'security',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'platform', operator: 'equals', value: 'azure-swa' },
      { field: 'environment', operator: 'equals', value: 'production' },
      { field: 'corsConfigured', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Configure CORS explicitly in staticwebapp.config.json' }
    ],
    riskWeight: 35,
    tags: ['azure', 'swa', 'cors', 'security']
  }
];
