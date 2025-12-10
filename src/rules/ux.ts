/**
 * Enterprise Agent Supervisor - UX Rules
 *
 * Built-in rules for ensuring good user experience and interaction patterns.
 */

import type { BusinessRule } from '../types/index.js';

export const uxRules: BusinessRule[] = [
  // ============================================================================
  // USER COMMUNICATION RULES
  // ============================================================================
  {
    id: 'ux-001',
    name: 'Response Length Limit',
    description: 'Prevents excessively long responses that overwhelm users',
    type: 'ux',
    enabled: true,
    priority: 700,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'user_communication' },
      { field: 'responseLength', operator: 'greater_than', value: 10000 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'UX: Response exceeds 10,000 characters - consider summarizing' }
    ],
    riskWeight: 10,
    tags: ['ux', 'response-length']
  },
  {
    id: 'ux-002',
    name: 'Jargon Detection',
    description: 'Warns when technical jargon may confuse non-technical users',
    type: 'ux',
    enabled: true,
    priority: 650,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'user_communication' },
      { field: 'userType', operator: 'equals', value: 'non_technical' },
      { field: 'technicalTermCount', operator: 'greater_than', value: 5 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'UX: High technical term count for non-technical user - consider simplifying' }
    ],
    riskWeight: 8,
    tags: ['ux', 'accessibility', 'clarity']
  },
  {
    id: 'ux-003',
    name: 'Error Message Clarity',
    description: 'Ensures error messages are user-friendly',
    type: 'ux',
    enabled: true,
    priority: 720,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'error' },
      { field: 'includesRecoverySteps', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'UX: Error messages should include recovery steps for users' }
    ],
    riskWeight: 12,
    tags: ['ux', 'error-handling']
  },

  // ============================================================================
  // INTERACTION PATTERN RULES
  // ============================================================================
  {
    id: 'ux-010',
    name: 'Confirmation for Destructive Actions',
    description: 'Requires confirmation before destructive operations',
    type: 'ux',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'operation', operator: 'in', value: ['delete', 'remove', 'purge', 'destroy'] },
      { field: 'confirmationRequired', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'UX: Destructive actions require user confirmation' }
    ],
    riskWeight: 25,
    tags: ['ux', 'confirmation', 'destructive']
  },
  {
    id: 'ux-011',
    name: 'Progress Feedback for Long Operations',
    description: 'Ensures long operations provide progress feedback',
    type: 'ux',
    enabled: true,
    priority: 680,
    conditions: [
      { field: 'estimatedDurationMs', operator: 'greater_than', value: 5000 },
      { field: 'progressCallbackEnabled', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'UX: Long operations (>5s) should provide progress feedback' }
    ],
    riskWeight: 8,
    tags: ['ux', 'progress', 'feedback']
  },
  {
    id: 'ux-012',
    name: 'Undo Support for Modifications',
    description: 'Recommends undo capability for user modifications',
    type: 'ux',
    enabled: true,
    priority: 660,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
      { field: 'undoSupported', operator: 'not_equals', value: true },
      { field: 'userInitiated', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'UX: User-initiated modifications should support undo' }
    ],
    riskWeight: 10,
    tags: ['ux', 'undo', 'reversibility']
  },

  // ============================================================================
  // RATE AND FREQUENCY RULES
  // ============================================================================
  {
    id: 'ux-020',
    name: 'Notification Frequency Limit',
    description: 'Prevents notification fatigue',
    type: 'ux',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'notify' },
      { field: 'notificationsLastHour', operator: 'greater_than', value: 10 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'rate_limit', message: 'UX: Notification frequency exceeds limit - batching recommended' }
    ],
    riskWeight: 15,
    tags: ['ux', 'notifications', 'rate-limit']
  },
  {
    id: 'ux-021',
    name: 'Prompt Frequency Control',
    description: 'Limits how often users are interrupted with prompts',
    type: 'ux',
    enabled: true,
    priority: 730,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'prompt' },
      { field: 'promptsLastMinute', operator: 'greater_than', value: 3 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'UX: Too many prompts - consider consolidating interactions' }
    ],
    riskWeight: 12,
    tags: ['ux', 'prompts', 'interruption']
  },

  // ============================================================================
  // ACCESSIBILITY RULES
  // ============================================================================
  {
    id: 'ux-030',
    name: 'Alt Text for Images',
    description: 'Ensures images have accessibility text',
    type: 'ux',
    enabled: true,
    priority: 780,
    conditions: [
      { field: 'contentType', operator: 'contains', value: 'image' },
      { field: 'altText', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'UX: Images should include alt text for accessibility' }
    ],
    riskWeight: 10,
    tags: ['ux', 'accessibility', 'wcag']
  },
  {
    id: 'ux-031',
    name: 'Color Contrast Check',
    description: 'Warns about potential color contrast issues',
    type: 'ux',
    enabled: true,
    priority: 760,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'user_communication' },
      { field: 'hasColorContent', operator: 'equals', value: true },
      { field: 'contrastRatioMet', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'UX: Color content may not meet WCAG contrast requirements' }
    ],
    riskWeight: 8,
    tags: ['ux', 'accessibility', 'wcag', 'contrast']
  },
  {
    id: 'ux-032',
    name: 'Keyboard Navigation Support',
    description: 'Ensures interactive elements support keyboard navigation',
    type: 'ux',
    enabled: true,
    priority: 770,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'interactive' },
      { field: 'keyboardAccessible', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'UX: Interactive elements should support keyboard navigation' }
    ],
    riskWeight: 12,
    tags: ['ux', 'accessibility', 'keyboard']
  },

  // ============================================================================
  // CONTENT QUALITY RULES
  // ============================================================================
  {
    id: 'ux-040',
    name: 'Empty State Handling',
    description: 'Ensures empty states have helpful content',
    type: 'ux',
    enabled: true,
    priority: 690,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'display' },
      { field: 'resultCount', operator: 'equals', value: 0 },
      { field: 'emptyStateMessage', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'UX: Empty states should include helpful guidance for users' }
    ],
    riskWeight: 6,
    tags: ['ux', 'empty-state', 'guidance']
  },
  {
    id: 'ux-041',
    name: 'Loading State Communication',
    description: 'Ensures async operations communicate loading state',
    type: 'ux',
    enabled: true,
    priority: 700,
    conditions: [
      { field: 'isAsync', operator: 'equals', value: true },
      { field: 'loadingIndicatorEnabled', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'UX: Async operations should display loading state to users' }
    ],
    riskWeight: 8,
    tags: ['ux', 'loading', 'feedback']
  },
  {
    id: 'ux-042',
    name: 'Timeout Communication',
    description: 'Ensures timeouts are communicated clearly to users',
    type: 'ux',
    enabled: true,
    priority: 710,
    conditions: [
      { field: 'hasTimeout', operator: 'equals', value: true },
      { field: 'timeoutWarningEnabled', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'UX: Sessions with timeouts should warn users before expiry' }
    ],
    riskWeight: 10,
    tags: ['ux', 'timeout', 'session']
  }
];

export default uxRules;
