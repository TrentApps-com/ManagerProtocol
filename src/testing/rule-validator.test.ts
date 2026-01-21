/**
 * Enterprise Agent Supervisor - Rule Validator Tests
 *
 * Tests for the rule validation and conflict detection (Task #38)
 */

import { describe, it, expect } from 'vitest';
import {
  validateRule,
  validateConditions,
  checkForConflicts,
  lintRules,
  validateRules
} from './rule-validator.js';
import type { BusinessRule, RuleCondition } from '../types/index.js';

describe('Rule Validator', () => {
  // Helper to create a valid rule
  const createValidRule = (overrides?: Partial<BusinessRule>): BusinessRule => ({
    id: 'test-rule',
    name: 'Test Rule',
    type: 'security',
    enabled: true,
    priority: 500,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_access' }
    ],
    conditionLogic: 'all',
    actions: [{ type: 'allow' }],
    riskWeight: 10,
    ...overrides
  });

  describe('validateRule', () => {
    it('should validate a correct rule', () => {
      const rule = createValidRule();
      const result = validateRule(rule);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object input', () => {
      const result = validateRule(null);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    it('should reject missing id', () => {
      const result = validateRule({
        name: 'Test',
        type: 'security',
        conditions: [],
        actions: []
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_ID')).toBe(true);
    });

    it('should reject missing name', () => {
      const result = validateRule({
        id: 'test',
        type: 'security',
        conditions: [],
        actions: []
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_NAME')).toBe(true);
    });

    it('should reject invalid type', () => {
      const result = validateRule({
        id: 'test',
        name: 'Test',
        type: 'invalid_type',
        conditions: [],
        actions: []
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_TYPE')).toBe(true);
    });

    it('should warn on invalid id format', () => {
      const result = validateRule({
        id: 'test rule with spaces!',
        name: 'Test Rule',
        type: 'security',
        conditions: [],
        actions: []
      });

      expect(result.warnings.some(w => w.code === 'INVALID_ID_FORMAT')).toBe(true);
    });

    it('should warn on short name', () => {
      const result = validateRule({
        id: 'test',
        name: 'Te',
        type: 'security',
        conditions: [],
        actions: []
      });

      expect(result.warnings.some(w => w.code === 'SHORT_NAME')).toBe(true);
    });

    it('should reject invalid priority', () => {
      const rule = createValidRule({ priority: 'high' as unknown as number });
      const result = validateRule(rule);

      expect(result.errors.some(e => e.code === 'INVALID_PRIORITY')).toBe(true);
    });

    it('should warn on priority out of range', () => {
      const rule = createValidRule({ priority: 5000 });
      const result = validateRule(rule);

      expect(result.warnings.some(w => w.code === 'PRIORITY_OUT_OF_RANGE')).toBe(true);
    });

    it('should reject invalid risk weight', () => {
      const rule = createValidRule({ riskWeight: 150 });
      const result = validateRule(rule);

      expect(result.errors.some(e => e.code === 'RISK_WEIGHT_OUT_OF_RANGE')).toBe(true);
    });

    it('should reject non-array conditions', () => {
      const result = validateRule({
        id: 'test',
        name: 'Test',
        type: 'security',
        conditions: 'not an array',
        actions: []
      });

      expect(result.errors.some(e => e.code === 'INVALID_CONDITIONS')).toBe(true);
    });

    it('should reject non-array actions', () => {
      const result = validateRule({
        id: 'test',
        name: 'Test',
        type: 'security',
        conditions: [],
        actions: 'not an array'
      });

      expect(result.errors.some(e => e.code === 'INVALID_ACTIONS')).toBe(true);
    });

    it('should warn on empty actions', () => {
      const result = validateRule({
        id: 'test',
        name: 'Test',
        type: 'security',
        conditions: [],
        actions: []
      });

      expect(result.warnings.some(w => w.code === 'EMPTY_ACTIONS')).toBe(true);
    });

    it('should reject invalid condition logic', () => {
      const rule = createValidRule({ conditionLogic: 'some' as 'all' | 'any' });
      const result = validateRule(rule);

      expect(result.errors.some(e => e.code === 'INVALID_CONDITION_LOGIC')).toBe(true);
    });
  });

  describe('validateConditions', () => {
    it('should validate correct conditions', () => {
      const conditions: RuleCondition[] = [
        { field: 'actionCategory', operator: 'equals', value: 'data_access' },
        { field: 'userRole', operator: 'in', value: ['admin', 'user'] }
      ];

      const result = validateConditions(conditions);

      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object conditions', () => {
      const result = validateConditions(['not an object']);

      expect(result.errors.some(e => e.code === 'INVALID_CONDITION')).toBe(true);
    });

    it('should reject missing field', () => {
      const result = validateConditions([
        { operator: 'equals', value: 'test' }
      ]);

      expect(result.errors.some(e => e.code === 'MISSING_FIELD')).toBe(true);
    });

    it('should reject invalid operator', () => {
      const result = validateConditions([
        { field: 'test', operator: 'invalid_op', value: 'test' }
      ]);

      expect(result.errors.some(e => e.code === 'INVALID_OPERATOR')).toBe(true);
    });

    it('should reject non-array value for in operator', () => {
      const result = validateConditions([
        { field: 'test', operator: 'in', value: 'not an array' }
      ]);

      expect(result.errors.some(e => e.code === 'INVALID_VALUE_TYPE')).toBe(true);
    });

    it('should reject non-number value for greater_than', () => {
      const result = validateConditions([
        { field: 'test', operator: 'greater_than', value: 'not a number' }
      ]);

      expect(result.errors.some(e => e.code === 'INVALID_VALUE_TYPE')).toBe(true);
    });

    it('should reject invalid regex pattern', () => {
      const result = validateConditions([
        { field: 'test', operator: 'matches_regex', value: '[invalid(' }
      ]);

      expect(result.errors.some(e => e.code === 'INVALID_REGEX')).toBe(true);
    });

    it('should require customEvaluator for custom operator', () => {
      const result = validateConditions([
        { field: 'test', operator: 'custom', value: null }
      ]);

      expect(result.errors.some(e => e.code === 'MISSING_CUSTOM_EVALUATOR')).toBe(true);
    });
  });

  describe('checkForConflicts', () => {
    it('should detect duplicate IDs', () => {
      const rules = [
        createValidRule({ id: 'same-id', name: 'Rule 1' }),
        createValidRule({ id: 'same-id', name: 'Rule 2' })
      ];

      const result = checkForConflicts(rules);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some(c => c.conflictType === 'duplicate_conditions')).toBe(true);
    });

    it('should detect contradicting actions', () => {
      const rules = [
        createValidRule({
          id: 'allow-rule',
          name: 'Allow Rule',
          conditions: [{ field: 'category', operator: 'equals', value: 'test' }],
          actions: [{ type: 'allow' }]
        }),
        createValidRule({
          id: 'deny-rule',
          name: 'Deny Rule',
          conditions: [{ field: 'category', operator: 'equals', value: 'test' }],
          actions: [{ type: 'deny' }]
        })
      ];

      const result = checkForConflicts(rules);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some(c => c.conflictType === 'contradicting_actions')).toBe(true);
    });

    it('should detect duplicate conditions', () => {
      const rules = [
        createValidRule({
          id: 'rule-1',
          name: 'Rule 1',
          conditions: [{ field: 'category', operator: 'equals', value: 'test' }],
          actions: [{ type: 'warn', message: 'Warning 1' }]
        }),
        createValidRule({
          id: 'rule-2',
          name: 'Rule 2',
          conditions: [{ field: 'category', operator: 'equals', value: 'test' }],
          actions: [{ type: 'warn', message: 'Warning 2' }]
        })
      ];

      const result = checkForConflicts(rules);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some(c => c.conflictType === 'duplicate_conditions')).toBe(true);
    });

    it('should detect shadowed rules', () => {
      const rules = [
        createValidRule({
          id: 'broad-rule',
          name: 'Broad Rule',
          priority: 900,
          conditions: [], // Matches everything
          actions: [{ type: 'deny' }]
        }),
        createValidRule({
          id: 'specific-rule',
          name: 'Specific Rule',
          priority: 500,
          conditions: [{ field: 'category', operator: 'equals', value: 'test' }],
          actions: [{ type: 'allow' }]
        })
      ];

      const result = checkForConflicts(rules);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some(c => c.conflictType === 'shadowed_rule')).toBe(true);
    });

    it('should not report conflicts for independent rules', () => {
      const rules = [
        createValidRule({
          id: 'rule-1',
          name: 'Rule 1',
          conditions: [{ field: 'category', operator: 'equals', value: 'type-a' }]
        }),
        createValidRule({
          id: 'rule-2',
          name: 'Rule 2',
          conditions: [{ field: 'category', operator: 'equals', value: 'type-b' }]
        })
      ];

      const result = checkForConflicts(rules);

      expect(result.hasConflicts).toBe(false);
    });
  });

  describe('lintRules', () => {
    it('should report missing description', () => {
      const rules = [createValidRule({ description: undefined })];
      const result = lintRules(rules);

      expect(result.suggestions.some(s => s.code === 'MISSING_DESCRIPTION')).toBe(true);
    });

    it('should report missing tags', () => {
      const rules = [createValidRule({ tags: undefined })];
      const result = lintRules(rules);

      expect(result.suggestions.some(s => s.code === 'MISSING_TAGS')).toBe(true);
    });

    it('should warn about high risk weight without control', () => {
      const rules = [
        createValidRule({
          riskWeight: 60,
          actions: [{ type: 'log' }] // No deny or require_approval
        })
      ];
      const result = lintRules(rules);

      expect(result.warnings.some(w => w.code === 'HIGH_RISK_NO_CONTROL')).toBe(true);
    });

    it('should error on unconditional deny', () => {
      const rules = [
        createValidRule({
          conditions: [],
          actions: [{ type: 'deny' }]
        })
      ];
      const result = lintRules(rules);

      expect(result.errors.some(e => e.code === 'UNCONDITIONAL_DENY')).toBe(true);
    });

    it('should warn about low priority deny rules', () => {
      const rules = [
        createValidRule({
          priority: 50,
          conditions: [{ field: 'test', operator: 'equals', value: 'x' }],
          actions: [{ type: 'deny' }]
        })
      ];
      const result = lintRules(rules);

      expect(result.warnings.some(w => w.code === 'LOW_PRIORITY_DENY')).toBe(true);
    });

    it('should suggest adding messages to actions', () => {
      const rules = [
        createValidRule({
          actions: [{ type: 'deny' }] // No message
        })
      ];
      const result = lintRules(rules);

      expect(result.suggestions.some(s => s.code === 'ACTION_MISSING_MESSAGE')).toBe(true);
    });

    it('should warn about overly broad regex', () => {
      const rules = [
        createValidRule({
          conditions: [{ field: 'test', operator: 'matches_regex', value: '.*' }]
        })
      ];
      const result = lintRules(rules);

      expect(result.warnings.some(w => w.code === 'OVERLY_BROAD_REGEX')).toBe(true);
    });

    it('should include conflict issues', () => {
      const rules = [
        createValidRule({
          id: 'rule-1',
          conditions: [{ field: 'x', operator: 'equals', value: 'y' }],
          actions: [{ type: 'allow' }]
        }),
        createValidRule({
          id: 'rule-2',
          conditions: [{ field: 'x', operator: 'equals', value: 'y' }],
          actions: [{ type: 'deny' }]
        })
      ];
      const result = lintRules(rules);

      expect(result.errors.some(e =>
        e.code === 'CONFLICT_CONTRADICTING_ACTIONS'
      )).toBe(true);
    });
  });

  describe('validateRules', () => {
    it('should validate multiple rules', () => {
      const rules = [
        createValidRule({ id: 'rule-1', name: 'Rule 1' }),
        createValidRule({ id: 'rule-2', name: 'Rule 2' }),
        { id: 'invalid', type: 'security' } // Invalid - missing name
      ];

      const result = validateRules(rules);

      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(1);
      expect(result.summary.total).toBe(3);
      expect(result.summary.valid).toBe(2);
      expect(result.summary.invalid).toBe(1);
    });

    it('should count errors and warnings', () => {
      const rules = [
        createValidRule({ priority: 5000 }), // Warning
        { id: 'no-name', type: 'security', conditions: [], actions: [] } // Error
      ];

      const result = validateRules(rules);

      expect(result.summary.warningCount).toBeGreaterThan(0);
      expect(result.summary.errorCount).toBeGreaterThan(0);
    });
  });
});
