/**
 * ML/AI Model Safety Rules
 * Governance rules for machine learning and AI model operations
 */

import type { BusinessRule } from '../types/index.js';
import { createValidationRule } from './shared-patterns.js';

export const mlAiRules: BusinessRule[] = [
  {
    id: 'ml-001',
    name: 'Require Graceful OOM Handling',
    description: 'Model loading must handle out-of-memory errors gracefully',
    type: 'operational',
    enabled: true,
    priority: 950,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'load_model' },
      { field: 'oomHandling', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'ML: Model loading should handle OOM errors (try/except, fallback to CPU)' }
    ],
    riskWeight: 45,
    tags: ['ml', 'ai', 'gpu', 'oom', 'error-handling']
  },
  {
    id: 'ml-002',
    name: 'Enforce Model Unloading Strategy',
    description: 'Models must be unloaded after idle period to prevent memory leaks',
    type: 'operational',
    enabled: true,
    priority: 880,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'load_model' },
      { field: 'unloadStrategy', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'ML: Define model unload strategy (timeout, LRU cache, manual unload)' }
    ],
    riskWeight: 35,
    tags: ['ml', 'ai', 'memory', 'cleanup', 'gpu']
  },
  {
    id: 'ml-003',
    name: 'Limit Inference Batch Size',
    description: 'Batch inference must have size limits to prevent GPU exhaustion',
    type: 'operational',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'inference' },
      { field: 'batchSize', operator: 'greater_than', value: 32 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'ML: Large batch sizes (>32) may exhaust GPU memory - consider chunking' }
    ],
    riskWeight: 30,
    tags: ['ml', 'ai', 'inference', 'batch', 'gpu']
  },
  // Model Input Validation - uses shared validation pattern
  createValidationRule({
    id: 'ml-004',
    name: 'Validate Model Inputs',
    description: 'Model inputs must be validated to prevent prompt injection',
    validationType: 'input',
    scope: {
      actionName: 'inference'
    },
    actionType: 'warn',
    message: 'ML: Validate model inputs (length limits, content filtering, injection prevention)',
    priority: 940,
    riskWeight: 40,
    tags: ['ml', 'ai', 'prompt-injection']
  }),
  {
    id: 'ml-005',
    name: 'Require Content Safety Filtering',
    description: 'Generated content must be filtered for safety',
    type: 'security',
    enabled: true,
    priority: 920,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'generate' },
      { field: 'contentSafetyFilter', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'ML: Generated content should be filtered for safety/appropriateness' }
    ],
    riskWeight: 35,
    tags: ['ml', 'ai', 'content-safety', 'moderation']
  },
  {
    id: 'ml-006',
    name: 'Monitor GPU Memory Usage',
    description: 'GPU memory usage should be monitored and alerted',
    type: 'operational',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'gpuMemoryUsage', operator: 'greater_than', value: 0.9 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'ML: GPU memory usage >90% - consider unloading models or reducing batch size' }
    ],
    riskWeight: 25,
    tags: ['ml', 'ai', 'gpu', 'memory', 'monitoring']
  },
  {
    id: 'ml-007',
    name: 'Inference Timeout Limits',
    description: 'Model inference must have timeout limits',
    type: 'operational',
    enabled: true,
    priority: 870,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'inference' },
      { field: 'timeout', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'ML: Set inference timeout to prevent hanging operations' }
    ],
    riskWeight: 20,
    tags: ['ml', 'ai', 'timeout', 'inference']
  },
  {
    id: 'ml-008',
    name: 'Model Version Tracking',
    description: 'Loaded models should track version for reproducibility',
    type: 'operational',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'load_model' },
      { field: 'modelVersion', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'ML: Track model versions for reproducibility and debugging' }
    ],
    riskWeight: 15,
    tags: ['ml', 'ai', 'versioning', 'reproducibility']
  }
];
