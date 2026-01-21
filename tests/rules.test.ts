/**
 * Enterprise Agent Supervisor - Rule Testing Examples
 *
 * Demonstrates how to use the rule testing framework to test business rules.
 */

import { describe, it, expect } from 'vitest';
import {
  RuleTester,
  testRule,
  expectDeny,
  expectApproval,
  expectWarn,
  expectNoMatch,
  assertions,
  validateRule,
  validateConditions,
  checkForConflicts,
  lintRules,
  validateRules
} from '../src/testing/index.js';
import type { BusinessRule, AgentAction, RuleTestCase } from '../src/types/index.js';
import { securityRules } from '../src/rules/security.js';

// ============================================================================
// RULE TESTER CLASS TESTS
// ============================================================================

describe('RuleTester', () => {
  describe('testRule()', () => {
    it('should pass when rule matches as expected', () => {
      const rule: BusinessRule = {
        id: 'test-deny-rule',
        name: 'Block PII Access',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [
          { field: 'actionCategory', operator: 'equals', value: 'pii_access' }
        ],
        conditionLogic: 'all',
        actions: [{ type: 'deny', message: 'PII access blocked' }],
        riskWeight: 50
      };

      const testCases: RuleTestCase[] = [
        expectDeny('should block PII access', {
          name: 'read-ssn',
          category: 'pii_access'
        }),
        expectNoMatch('should not match non-PII access', {
          name: 'read-logs',
          category: 'data_access'
        })
      ];

      const result = testRule(rule, testCases);

      expect(result.passedTests).toBe(2);
      expect(result.failedTests).toBe(0);
    });

    it('should fail when rule does not match as expected', () => {
      const rule: BusinessRule = {
        id: 'test-rule',
        name: 'Test Rule',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [
          { field: 'actionCategory', operator: 'equals', value: 'financial' }
        ],
        conditionLogic: 'all',
        actions: [{ type: 'deny' }],
        riskWeight: 30
      };

      const testCases: RuleTestCase[] = [
        expectDeny('should block financial actions', {
          name: 'transfer',
          category: 'data_access' // Wrong category - won't match
        })
      ];

      const result = testRule(rule, testCases);

      expect(result.failedTests).toBe(1);
      expect(result.testCaseResults[0].failures).toHaveLength(1);
      expect(result.testCaseResults[0].failures[0].assertion).toBe('shouldMatch');
    });

    it('should handle approval requirement tests', () => {
      const rule: BusinessRule = {
        id: 'approval-rule',
        name: 'Require Approval',
        type: 'compliance',
        enabled: true,
        priority: 500,
        conditions: [
          { field: 'amount', operator: 'greater_than', value: 10000 }
        ],
        conditionLogic: 'all',
        actions: [{ type: 'require_approval', message: 'Large transaction' }],
        riskWeight: 40
      };

      const testCases: RuleTestCase[] = [
        expectApproval('should require approval for large amounts', {
          name: 'transfer',
          category: 'financial',
          parameters: { amount: 15000 }
        }),
        expectNoMatch('should not require approval for small amounts', {
          name: 'transfer',
          category: 'financial',
          parameters: { amount: 5000 }
        })
      ];

      const result = testRule(rule, testCases);

      expect(result.passedTests).toBe(2);
      expect(result.failedTests).toBe(0);
    });

    it('should handle warning tests', () => {
      const rule: BusinessRule = {
        id: 'warn-rule',
        name: 'Network Warning',
        type: 'operational',
        enabled: true,
        priority: 500,
        conditions: [
          { field: 'actionCategory', operator: 'equals', value: 'network' }
        ],
        conditionLogic: 'all',
        actions: [{ type: 'warn', message: 'Network operation detected' }],
        riskWeight: 15
      };

      const testCases: RuleTestCase[] = [
        expectWarn('should warn on network operations', {
          name: 'http-request',
          category: 'network'
        }, {
          warningMessages: ['Network operation']
        })
      ];

      const result = testRule(rule, testCases);

      expect(result.passedTests).toBe(1);
    });

    it('should skip tests marked with skip flag', () => {
      const rule: BusinessRule = {
        id: 'test-rule',
        name: 'Test',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [],
        conditionLogic: 'all',
        actions: [{ type: 'allow' }],
        riskWeight: 0
      };

      const testCases: RuleTestCase[] = [
        {
          description: 'skipped test',
          input: { action: { name: 'test', category: 'data_access' } },
          expectedResult: { shouldMatch: true },
          skip: true
        }
      ];

      const result = testRule(rule, testCases);

      expect(result.skippedTests).toBe(1);
      expect(result.testCaseResults[0].skipped).toBe(true);
    });

    it('should verify risk score ranges', () => {
      const rule: BusinessRule = {
        id: 'risk-rule',
        name: 'Risk Rule',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [],
        conditionLogic: 'all',
        actions: [{ type: 'warn' }],
        riskWeight: 35
      };

      const testCases: RuleTestCase[] = [
        {
          description: 'should have risk score in expected range',
          input: { action: { name: 'test', category: 'data_access' } },
          expectedResult: {
            shouldMatch: true,
            minRiskScore: 30,
            maxRiskScore: 40
          }
        }
      ];

      const result = testRule(rule, testCases);

      expect(result.passedTests).toBe(1);
    });
  });
});

// ============================================================================
// ASSERTION HELPERS TESTS
// ============================================================================

describe('assertions', () => {
  const denyRule: BusinessRule = {
    id: 'deny-rule',
    name: 'Deny Rule',
    type: 'security',
    enabled: true,
    priority: 500,
    conditions: [{ field: 'actionCategory', operator: 'equals', value: 'financial' }],
    conditionLogic: 'all',
    actions: [{ type: 'deny' }],
    riskWeight: 50
  };

  it('ruleMatches() should return true when rule matches', () => {
    const action: AgentAction = { name: 'transfer', category: 'financial' };
    expect(assertions.ruleMatches(denyRule, action)).toBe(true);
  });

  it('ruleMatches() should return false when rule does not match', () => {
    const action: AgentAction = { name: 'read', category: 'data_access' };
    expect(assertions.ruleMatches(denyRule, action)).toBe(false);
  });

  it('ruleDenies() should return true when rule denies action', () => {
    const action: AgentAction = { name: 'transfer', category: 'financial' };
    expect(assertions.ruleDenies(denyRule, action)).toBe(true);
  });

  it('ruleAllows() should return true when rule allows action', () => {
    const allowRule: BusinessRule = {
      ...denyRule,
      actions: [{ type: 'allow' }]
    };
    const action: AgentAction = { name: 'transfer', category: 'financial' };
    expect(assertions.ruleAllows(allowRule, action)).toBe(true);
  });

  it('ruleRequiresApproval() should return true when approval required', () => {
    const approvalRule: BusinessRule = {
      ...denyRule,
      actions: [{ type: 'require_approval' }]
    };
    const action: AgentAction = { name: 'transfer', category: 'financial' };
    expect(assertions.ruleRequiresApproval(approvalRule, action)).toBe(true);
  });

  it('ruleWarns() should return true when rule produces warning', () => {
    const warnRule: BusinessRule = {
      ...denyRule,
      actions: [{ type: 'warn', message: 'Warning!' }]
    };
    const action: AgentAction = { name: 'transfer', category: 'financial' };
    expect(assertions.ruleWarns(warnRule, action)).toBe(true);
  });
});

// ============================================================================
// RULE VALIDATION TESTS
// ============================================================================

describe('validateRule', () => {
  it('should validate a well-formed rule', () => {
    const rule: BusinessRule = {
      id: 'valid-rule',
      name: 'Valid Rule',
      type: 'security',
      enabled: true,
      priority: 500,
      conditions: [
        { field: 'actionCategory', operator: 'equals', value: 'financial' }
      ],
      conditionLogic: 'all',
      actions: [{ type: 'deny', message: 'Blocked' }],
      riskWeight: 30,
      tags: ['security', 'financial']
    };

    const result = validateRule(rule);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing required fields', () => {
    const rule = {
      name: 'Missing ID'
    };

    const result = validateRule(rule);

    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.code === 'MISSING_ID')).toBe(true);
    expect(result.errors.some(e => e.code === 'INVALID_TYPE')).toBe(true);
    expect(result.errors.some(e => e.code === 'INVALID_CONDITIONS')).toBe(true);
    expect(result.errors.some(e => e.code === 'INVALID_ACTIONS')).toBe(true);
  });

  it('should detect invalid risk weight', () => {
    const rule: BusinessRule = {
      id: 'test',
      name: 'Test',
      type: 'security',
      enabled: true,
      priority: 500,
      conditions: [],
      conditionLogic: 'all',
      actions: [{ type: 'allow' }],
      riskWeight: 150 // Invalid - should be 0-100
    };

    const result = validateRule(rule);

    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.code === 'RISK_WEIGHT_OUT_OF_RANGE')).toBe(true);
  });

  it('should warn about conflicting actions', () => {
    const rule: BusinessRule = {
      id: 'test',
      name: 'Test',
      type: 'security',
      enabled: true,
      priority: 500,
      conditions: [],
      conditionLogic: 'all',
      actions: [{ type: 'deny' }, { type: 'allow' }],
      riskWeight: 30
    };

    const result = validateRule(rule);

    expect(result.warnings.some(w => w.code === 'CONFLICTING_ACTIONS')).toBe(true);
  });
});

// ============================================================================
// CONDITION VALIDATION TESTS
// ============================================================================

describe('validateConditions', () => {
  it('should validate valid conditions', () => {
    const conditions = [
      { field: 'actionCategory', operator: 'equals', value: 'financial' },
      { field: 'amount', operator: 'greater_than', value: 1000 },
      { field: 'category', operator: 'in', value: ['a', 'b', 'c'] }
    ];

    const result = validateConditions(conditions);

    expect(result.errors).toHaveLength(0);
  });

  it('should detect invalid operator', () => {
    const conditions = [
      { field: 'test', operator: 'invalid_op', value: 'x' }
    ];

    const result = validateConditions(conditions);

    expect(result.errors.some(e => e.code === 'INVALID_OPERATOR')).toBe(true);
  });

  it('should detect invalid regex pattern', () => {
    const conditions = [
      { field: 'name', operator: 'matches_regex', value: '(invalid[regex' }
    ];

    const result = validateConditions(conditions);

    expect(result.errors.some(e => e.code === 'INVALID_REGEX')).toBe(true);
  });

  it('should detect wrong value type for in operator', () => {
    const conditions = [
      { field: 'category', operator: 'in', value: 'not-an-array' }
    ];

    const result = validateConditions(conditions);

    expect(result.errors.some(e => e.code === 'INVALID_VALUE_TYPE')).toBe(true);
  });

  it('should detect missing customEvaluator for custom operator', () => {
    const conditions = [
      { field: 'any', operator: 'custom', value: null }
    ];

    const result = validateConditions(conditions);

    expect(result.errors.some(e => e.code === 'MISSING_CUSTOM_EVALUATOR')).toBe(true);
  });
});

// ============================================================================
// CONFLICT DETECTION TESTS
// ============================================================================

describe('checkForConflicts', () => {
  it('should detect duplicate rule IDs', () => {
    const rules: BusinessRule[] = [
      {
        id: 'same-id',
        name: 'Rule 1',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [],
        conditionLogic: 'all',
        actions: [{ type: 'allow' }],
        riskWeight: 10
      },
      {
        id: 'same-id',
        name: 'Rule 2',
        type: 'security',
        enabled: true,
        priority: 600,
        conditions: [],
        conditionLogic: 'all',
        actions: [{ type: 'deny' }],
        riskWeight: 20
      }
    ];

    const result = checkForConflicts(rules);

    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts.some(c => c.conflictType === 'duplicate_conditions')).toBe(true);
  });

  it('should detect contradicting actions', () => {
    const rules: BusinessRule[] = [
      {
        id: 'rule-1',
        name: 'Allow Rule',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [{ field: 'category', operator: 'equals', value: 'test' }],
        conditionLogic: 'all',
        actions: [{ type: 'allow' }],
        riskWeight: 10
      },
      {
        id: 'rule-2',
        name: 'Deny Rule',
        type: 'security',
        enabled: true,
        priority: 600,
        conditions: [{ field: 'category', operator: 'equals', value: 'test' }],
        conditionLogic: 'all',
        actions: [{ type: 'deny' }],
        riskWeight: 20
      }
    ];

    const result = checkForConflicts(rules);

    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts.some(c => c.conflictType === 'contradicting_actions')).toBe(true);
  });

  it('should not flag non-conflicting rules', () => {
    const rules: BusinessRule[] = [
      {
        id: 'rule-1',
        name: 'Rule 1',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [{ field: 'category', operator: 'equals', value: 'a' }],
        conditionLogic: 'all',
        actions: [{ type: 'deny' }],
        riskWeight: 10
      },
      {
        id: 'rule-2',
        name: 'Rule 2',
        type: 'security',
        enabled: true,
        priority: 600,
        conditions: [{ field: 'category', operator: 'equals', value: 'b' }],
        conditionLogic: 'all',
        actions: [{ type: 'deny' }],
        riskWeight: 20
      }
    ];

    const result = checkForConflicts(rules);

    expect(result.hasConflicts).toBe(false);
  });
});

// ============================================================================
// RULE LINTING TESTS
// ============================================================================

describe('lintRules', () => {
  it('should suggest adding description', () => {
    const rules: BusinessRule[] = [{
      id: 'test',
      name: 'Test Rule',
      type: 'security',
      enabled: true,
      priority: 500,
      conditions: [{ field: 'x', operator: 'equals', value: 'y' }],
      conditionLogic: 'all',
      actions: [{ type: 'allow' }],
      riskWeight: 10
      // No description
    }];

    const result = lintRules(rules);

    expect(result.suggestions.some(s => s.code === 'MISSING_DESCRIPTION')).toBe(true);
  });

  it('should warn about high risk without controls', () => {
    const rules: BusinessRule[] = [{
      id: 'test',
      name: 'High Risk Rule',
      description: 'Test',
      type: 'security',
      enabled: true,
      priority: 500,
      conditions: [{ field: 'x', operator: 'equals', value: 'y' }],
      conditionLogic: 'all',
      actions: [{ type: 'warn' }], // No deny or require_approval
      riskWeight: 60, // High risk
      tags: ['test']
    }];

    const result = lintRules(rules);

    expect(result.warnings.some(w => w.code === 'HIGH_RISK_NO_CONTROL')).toBe(true);
  });

  it('should error on unconditional deny', () => {
    const rules: BusinessRule[] = [{
      id: 'test',
      name: 'Unconditional Deny',
      description: 'Test',
      type: 'security',
      enabled: true,
      priority: 500,
      conditions: [], // No conditions
      conditionLogic: 'all',
      actions: [{ type: 'deny' }],
      riskWeight: 50,
      tags: ['test']
    }];

    const result = lintRules(rules);

    expect(result.errors.some(e => e.code === 'UNCONDITIONAL_DENY')).toBe(true);
  });

  it('should warn about overly broad regex', () => {
    const rules: BusinessRule[] = [{
      id: 'test',
      name: 'Broad Regex',
      description: 'Test',
      type: 'security',
      enabled: true,
      priority: 500,
      conditions: [{ field: 'name', operator: 'matches_regex', value: '.*' }],
      conditionLogic: 'all',
      actions: [{ type: 'warn' }],
      riskWeight: 10,
      tags: ['test']
    }];

    const result = lintRules(rules);

    expect(result.warnings.some(w => w.code === 'OVERLY_BROAD_REGEX')).toBe(true);
  });
});

// ============================================================================
// BATCH VALIDATION TESTS
// ============================================================================

describe('validateRules', () => {
  it('should validate multiple rules and return summary', () => {
    const rules = [
      {
        id: 'valid-1',
        name: 'Valid Rule 1',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [],
        conditionLogic: 'all',
        actions: [{ type: 'allow' }],
        riskWeight: 10
      },
      {
        id: 'valid-2',
        name: 'Valid Rule 2',
        type: 'compliance',
        enabled: true,
        priority: 600,
        conditions: [{ field: 'x', operator: 'equals', value: 'y' }],
        conditionLogic: 'all',
        actions: [{ type: 'warn' }],
        riskWeight: 20
      },
      {
        // Invalid - missing fields
        name: 'Invalid Rule'
      }
    ];

    const result = validateRules(rules);

    expect(result.summary.total).toBe(3);
    expect(result.summary.valid).toBe(2);
    expect(result.summary.invalid).toBe(1);
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(1);
  });
});

// ============================================================================
// TESTING BUILT-IN SECURITY RULES
// ============================================================================

describe('Built-in Security Rules', () => {
  it('sec-001: should block PII access without authorization', () => {
    const rule = securityRules.find(r => r.id === 'sec-001');
    if (!rule) throw new Error('Rule sec-001 not found');

    const testCases: RuleTestCase[] = [
      expectDeny('should block unauthorized PII access', {
        name: 'read-ssn',
        category: 'pii_access'
      }, {
        context: { userRole: 'user' },
        violationMessages: ['PII access requires authorized role']
      }),
      expectNoMatch('should allow admin PII access', {
        name: 'read-ssn',
        category: 'pii_access'
      }, {
        context: { userRole: 'admin' }
      }),
      expectNoMatch('should not match non-PII actions', {
        name: 'read-logs',
        category: 'data_access'
      })
    ];

    const result = testRule(rule, testCases);

    expect(result.failedTests).toBe(0);
  });

  it('sec-010: should block unauthenticated API calls', () => {
    const rule = securityRules.find(r => r.id === 'sec-010');
    if (!rule) throw new Error('Rule sec-010 not found');

    const testCases: RuleTestCase[] = [
      expectDeny('should block API call without auth token', {
        name: 'fetch-data',
        category: 'external_api'
        // No authToken in parameters
      }),
      expectNoMatch('should allow API call with auth token', {
        name: 'fetch-data',
        category: 'external_api',
        parameters: { authToken: 'valid-token' }
      })
    ];

    const result = testRule(rule, testCases);

    expect(result.failedTests).toBe(0);
  });

  it('sec-050: should detect SQL injection patterns', () => {
    const rule = securityRules.find(r => r.id === 'sec-050');
    if (!rule) throw new Error('Rule sec-050 not found');

    const testCases: RuleTestCase[] = [
      expectDeny('should block SQL injection with OR', {
        name: 'query',
        category: 'data_access',
        parameters: { query: "SELECT * FROM users WHERE id='1' OR '1'='1'" }
      }),
      expectDeny('should block SQL injection with UNION', {
        name: 'query',
        category: 'data_access',
        parameters: { query: "SELECT name FROM users UNION SELECT password FROM admin--" }
      }),
      expectNoMatch('should allow safe queries', {
        name: 'query',
        category: 'data_access',
        parameters: { query: "getUserById(123)" }
      })
    ];

    const result = testRule(rule, testCases);

    expect(result.failedTests).toBe(0);
  });
});
