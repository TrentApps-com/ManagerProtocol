/**
 * Browser Storage Rules
 * Governance rules for localStorage, sessionStorage, and IndexedDB
 */

import type { BusinessRule } from '../types/index.js';

export const storageRules: BusinessRule[] = [
  {
    id: 'storage-001',
    name: 'Monitor localStorage Quota Usage',
    description: 'localStorage usage must be monitored to prevent quota exceeded errors',
    type: 'operational',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
      { field: 'storageType', operator: 'equals', value: 'localStorage' },
      { field: 'estimatedSize', operator: 'greater_than', value: 4000000 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'localStorage usage >4MB - approaching quota limit (5-10MB)' }
    ],
    riskWeight: 30,
    tags: ['storage', 'localStorage', 'quota', 'browser']
  },
  {
    id: 'storage-002',
    name: 'Require Auto-Cleanup of Old Data',
    description: 'localStorage must have cleanup strategy for old data',
    type: 'architecture',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'storageType', operator: 'equals', value: 'localStorage' },
      { field: 'hasCleanupStrategy', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Implement localStorage cleanup (TTL, LRU, size-based eviction)' }
    ],
    riskWeight: 25,
    tags: ['storage', 'localStorage', 'cleanup', 'maintenance']
  },
  {
    id: 'storage-003',
    name: 'Prohibit Sensitive Data in localStorage',
    description: 'Sensitive data must not be stored in localStorage',
    type: 'security',
    enabled: true,
    priority: 960,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['localStorage', 'sessionStorage'] },
      { field: 'dataClassification', operator: 'in', value: ['confidential', 'restricted'] }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Sensitive data prohibited in localStorage (use secure HTTP-only cookies or encrypted storage)' }
    ],
    riskWeight: 55,
    tags: ['storage', 'security', 'localStorage', 'sensitive-data']
  },
  {
    id: 'storage-004',
    name: 'Deny Base64 Image Storage',
    description: 'Base64 images must not be stored in localStorage due to size',
    type: 'operational',
    enabled: true,
    priority: 920,
    conditions: [
      { field: 'storageType', operator: 'equals', value: 'localStorage' },
      { field: 'dataType', operator: 'equals', value: 'base64_image' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Base64 images prohibited in localStorage (use blob URLs, IndexedDB, or server storage)' }
    ],
    riskWeight: 40,
    tags: ['storage', 'localStorage', 'images', 'quota']
  },
  {
    id: 'storage-005',
    name: 'Validate localStorage Access Error Handling',
    description: 'localStorage operations must handle quota exceeded errors',
    type: 'architecture',
    enabled: true,
    priority: 880,
    conditions: [
      { field: 'storageType', operator: 'equals', value: 'localStorage' },
      { field: 'hasErrorHandling', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Wrap localStorage operations in try/catch for quota exceeded errors' }
    ],
    riskWeight: 20,
    tags: ['storage', 'localStorage', 'error-handling']
  },
  {
    id: 'storage-006',
    name: 'Use IndexedDB for Large Data',
    description: 'Large datasets should use IndexedDB instead of localStorage',
    type: 'architecture',
    enabled: true,
    priority: 800,
    conditions: [
      { field: 'storageType', operator: 'equals', value: 'localStorage' },
      { field: 'dataSize', operator: 'greater_than', value: 1000000 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Large data (>1MB) should use IndexedDB instead of localStorage' }
    ],
    riskWeight: 15,
    tags: ['storage', 'indexeddb', 'performance']
  },
  {
    id: 'storage-007',
    name: 'No Tokens in localStorage',
    description: 'Auth tokens and API keys must not be stored in localStorage',
    type: 'security',
    enabled: true,
    priority: 980,
    conditions: [
      { field: 'storageType', operator: 'in', value: ['localStorage', 'sessionStorage'] },
      { field: 'dataType', operator: 'in', value: ['auth_token', 'api_key', 'jwt'] }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Auth tokens/API keys prohibited in localStorage (use secure HTTP-only cookies)' }
    ],
    riskWeight: 70,
    tags: ['storage', 'security', 'localStorage', 'tokens', 'authentication']
  }
];
