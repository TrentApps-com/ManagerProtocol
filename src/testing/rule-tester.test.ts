/**
 * Enterprise Agent Supervisor - Rule Tester Tests
 *
 * Tests for the RuleTester class and helper functions (Task #38)
 */

import { describe, it, expect } from 'vitest';
import {
  RuleTester,
  testRule,
  createTestCase,
  expectDeny,
  expectApproval,
  expectWarn,
  expectNoMatch,
  expectAllow,
  assertions
} from './rule-tester.js';
import type { BusinessRule, AgentAction } from '../types/index.js';

describe('RuleTester', () => {
  // Helper to create a simple test rule
  const createRule = (
    id: string,
    name: string,
    conditions: BusinessRule['conditions'],
    actions: BusinessRule['actions']
  ): BusinessRule => ({
    id,
    name,
    type: 'security',
    enabled: true,
    priority: 500,
    conditions,
    conditionLogic: 'all',
    actions,
    riskWeight: 25
  });

  describe('testRule', () => {
    it('should pass when rule matches as expected', () => {
      const rule = createRule(
        'deny-rule',
        'Deny PII Access',
        [{ field: 'actionCategory', operator: 'equals', value: 'pii_access' }],
        [{ type: 'deny', message: 'Access denied' }]
      );

      const result = testRule(rule, [
        {
          description: 'Should deny PII access',
          input: {
            action: { name: 'read_data', category: 'pii_access' }
          },
          expectedResult: {
            shouldMatch: true,
            status: 'denied',
            allowed: false
          }
        }
      ]);

      expect(result.passedTests).toBe(1);
      expect(result.failedTests).toBe(0);
    });

    it('should fail when rule does not match as expected', () => {
      const rule = createRule(
        'deny-rule',
        'Deny PII Access',
        [{ field: 'actionCategory', operator: 'equals', value: 'pii_access' }],
        [{ type: 'deny', message: 'Access denied' }]
      );

      const result = testRule(rule, [
        {
          description: 'Should match non-PII access (incorrect expectation)',
          input: {
            action: { name: 'read_data', category: 'data_access' }
          },
          expectedResult: {
            shouldMatch: true // This is wrong - should be false
          }
        }
      ]);

      expect(result.failedTests).toBe(1);
      expect(result.testCaseResults[0].failures.length).toBeGreaterThan(0);
    });

    it('should handle skipped tests', () => {
      const rule = createRule(
        'test-rule',
        'Test Rule',
        [],
        [{ type: 'allow' }]
      );

      const result = testRule(rule, [
        {
          description: 'Normal test',
          input: { action: { name: 'test', category: 'data_access' } },
          expectedResult: { shouldMatch: true }
        },
        {
          description: 'Skipped test',
          skip: true,
          input: { action: { name: 'test', category: 'data_access' } },
          expectedResult: { shouldMatch: true }
        }
      ]);

      expect(result.totalTests).toBe(2);
      expect(result.skippedTests).toBe(1);
    });

    it('should handle only flag', () => {
      const rule = createRule(
        'test-rule',
        'Test Rule',
        [],
        [{ type: 'allow' }]
      );

      const result = testRule(rule, [
        {
          description: 'Should be skipped',
          input: { action: { name: 'test', category: 'data_access' } },
          expectedResult: { shouldMatch: true }
        },
        {
          description: 'Only this should run',
          only: true,
          input: { action: { name: 'test', category: 'data_access' } },
          expectedResult: { shouldMatch: true }
        }
      ]);

      expect(result.passedTests).toBe(1);
      expect(result.skippedTests).toBe(1);
    });

    it('should validate risk level', () => {
      const rule = createRule(
        'high-risk-rule',
        'High Risk Rule',
        [],
        [{ type: 'warn', message: 'Warning' }]
      );
      rule.riskWeight = 45;

      const result = testRule(rule, [
        {
          description: 'Should have medium risk level',
          input: { action: { name: 'test', category: 'data_access' } },
          expectedResult: {
            shouldMatch: true,
            riskLevel: 'medium',
            minRiskScore: 30,
            maxRiskScore: 50
          }
        }
      ]);

      expect(result.passedTests).toBe(1);
    });

    it('should validate violation count', () => {
      const rule = createRule(
        'deny-rule',
        'Deny Rule',
        [],
        [{ type: 'deny', message: 'Denied' }]
      );

      const result = testRule(rule, [
        {
          description: 'Should have one violation',
          input: { action: { name: 'test', category: 'data_access' } },
          expectedResult: {
            shouldMatch: true,
            violationCount: 1
          }
        }
      ]);

      expect(result.passedTests).toBe(1);
    });

    it('should validate warning count', () => {
      const rule = createRule(
        'warn-rule',
        'Warning Rule',
        [],
        [{ type: 'warn', message: 'This is a warning' }]
      );

      const result = testRule(rule, [
        {
          description: 'Should have one warning',
          input: { action: { name: 'test', category: 'data_access' } },
          expectedResult: {
            shouldMatch: true,
            warningCount: 1,
            warningMessages: ['warning']
          }
        }
      ]);

      expect(result.passedTests).toBe(1);
    });
  });

  describe('Test Case Helpers', () => {
    describe('createTestCase', () => {
      it('should create a basic test case', () => {
        const testCase = createTestCase(
          'Test description',
          { name: 'test_action', category: 'data_access' },
          { shouldMatch: true },
          { environment: 'production' }
        );

        expect(testCase.description).toBe('Test description');
        expect(testCase.input.action.name).toBe('test_action');
        expect(testCase.input.context?.environment).toBe('production');
        expect(testCase.expectedResult.shouldMatch).toBe(true);
      });
    });

    describe('expectDeny', () => {
      it('should create a deny test case', () => {
        const testCase = expectDeny(
          'Should deny this action',
          { name: 'dangerous_action', category: 'code_execution' }
        );

        expect(testCase.expectedResult.shouldMatch).toBe(true);
        expect(testCase.expectedResult.status).toBe('denied');
        expect(testCase.expectedResult.allowed).toBe(false);
        expect(testCase.expectedResult.violationCount).toBe(1);
      });
    });

    describe('expectApproval', () => {
      it('should create an approval test case', () => {
        const testCase = expectApproval(
          'Should require approval',
          { name: 'deploy', category: 'code_execution' },
          { context: { environment: 'production' } }
        );

        expect(testCase.expectedResult.shouldMatch).toBe(true);
        expect(testCase.expectedResult.status).toBe('pending_approval');
        expect(testCase.expectedResult.allowed).toBe(true);
        expect(testCase.expectedResult.requiresHumanApproval).toBe(true);
      });
    });

    describe('expectWarn', () => {
      it('should create a warning test case', () => {
        const testCase = expectWarn(
          'Should warn about this',
          { name: 'risky_action', category: 'data_modification' }
        );

        expect(testCase.expectedResult.shouldMatch).toBe(true);
        expect(testCase.expectedResult.status).toBe('requires_review');
        expect(testCase.expectedResult.allowed).toBe(true);
        expect(testCase.expectedResult.warningCount).toBe(1);
      });
    });

    describe('expectNoMatch', () => {
      it('should create a no-match test case', () => {
        const testCase = expectNoMatch(
          'Should not match',
          { name: 'safe_action', category: 'data_access' }
        );

        expect(testCase.expectedResult.shouldMatch).toBe(false);
      });
    });

    describe('expectAllow', () => {
      it('should create an allow test case', () => {
        const testCase = expectAllow(
          'Should allow this action',
          { name: 'read_data', category: 'data_access' }
        );

        expect(testCase.expectedResult.shouldMatch).toBe(true);
        expect(testCase.expectedResult.status).toBe('approved');
        expect(testCase.expectedResult.allowed).toBe(true);
      });
    });
  });

  describe('assertions', () => {
    const denyRule = createRule(
      'deny-rule',
      'Deny PII Access',
      [{ field: 'actionCategory', operator: 'equals', value: 'pii_access' }],
      [{ type: 'deny', message: 'Access denied' }]
    );

    const approvalRule = createRule(
      'approval-rule',
      'Require Approval',
      [{ field: 'actionCategory', operator: 'equals', value: 'financial' }],
      [{ type: 'require_approval', message: 'Approval needed' }]
    );

    const warnRule = createRule(
      'warn-rule',
      'Warning Rule',
      [{ field: 'actionCategory', operator: 'equals', value: 'data_modification' }],
      [{ type: 'warn', message: 'Warning' }]
    );

    const allowRule = createRule(
      'allow-rule',
      'Allow Rule',
      [{ field: 'actionCategory', operator: 'equals', value: 'data_access' }],
      [{ type: 'allow' }]
    );

    describe('ruleMatches', () => {
      it('should return true when rule conditions are met', () => {
        const action: AgentAction = { name: 'test', category: 'pii_access' };
        expect(assertions.ruleMatches(denyRule, action)).toBe(true);
      });

      it('should return false when rule conditions are not met', () => {
        const action: AgentAction = { name: 'test', category: 'data_access' };
        expect(assertions.ruleMatches(denyRule, action)).toBe(false);
      });
    });

    describe('ruleDenies', () => {
      it('should return true when rule denies action', () => {
        const action: AgentAction = { name: 'test', category: 'pii_access' };
        expect(assertions.ruleDenies(denyRule, action)).toBe(true);
      });

      it('should return false when rule does not deny', () => {
        const action: AgentAction = { name: 'test', category: 'data_access' };
        expect(assertions.ruleDenies(allowRule, action)).toBe(false);
      });
    });

    describe('ruleRequiresApproval', () => {
      it('should return true when rule requires approval', () => {
        const action: AgentAction = { name: 'test', category: 'financial' };
        expect(assertions.ruleRequiresApproval(approvalRule, action)).toBe(true);
      });

      it('should return false when rule does not require approval', () => {
        const action: AgentAction = { name: 'test', category: 'data_access' };
        expect(assertions.ruleRequiresApproval(allowRule, action)).toBe(false);
      });
    });

    describe('ruleWarns', () => {
      it('should return true when rule produces warnings', () => {
        const action: AgentAction = { name: 'test', category: 'data_modification' };
        expect(assertions.ruleWarns(warnRule, action)).toBe(true);
      });

      it('should return false when rule does not warn', () => {
        const action: AgentAction = { name: 'test', category: 'data_access' };
        expect(assertions.ruleWarns(allowRule, action)).toBe(false);
      });
    });

    describe('ruleAllows', () => {
      it('should return true when rule allows action', () => {
        const action: AgentAction = { name: 'test', category: 'data_access' };
        expect(assertions.ruleAllows(allowRule, action)).toBe(true);
      });

      it('should return false when rule denies action', () => {
        const action: AgentAction = { name: 'test', category: 'pii_access' };
        expect(assertions.ruleAllows(denyRule, action)).toBe(false);
      });
    });
  });
});
