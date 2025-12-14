import { describe, it, expect, beforeEach } from 'vitest';
import { RulesEngine } from './RulesEngine.js';
import type { AgentAction, BusinessRule } from '../types/index.js';

describe('RulesEngine', () => {
  let engine: RulesEngine;

  beforeEach(() => {
    engine = new RulesEngine();
  });

  describe('Rule Registration', () => {
    it('should register a single rule', () => {
      const rule: BusinessRule = {
        id: 'test-rule-1',
        name: 'Test Rule',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [],
        conditionLogic: 'all',
        actions: [{ type: 'allow' }],
        riskWeight: 10
      };

      engine.registerRule(rule);
      expect(engine.getRules()).toHaveLength(1);
      expect(engine.getRules()[0].id).toBe('test-rule-1');
    });

    it('should register multiple rules', () => {
      const rules: BusinessRule[] = [
        {
          id: 'rule-1',
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
          id: 'rule-2',
          name: 'Rule 2',
          type: 'compliance',
          enabled: true,
          priority: 600,
          conditions: [],
          conditionLogic: 'all',
          actions: [{ type: 'warn' }],
          riskWeight: 20
        }
      ];

      engine.registerRules(rules);
      expect(engine.getRules()).toHaveLength(2);
    });

    it('should unregister a rule by ID', () => {
      const rule: BusinessRule = {
        id: 'test-rule',
        name: 'Test Rule',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [],
        conditionLogic: 'all',
        actions: [{ type: 'allow' }],
        riskWeight: 10
      };

      engine.registerRule(rule);
      expect(engine.getRules()).toHaveLength(1);

      const result = engine.unregisterRule('test-rule');
      expect(result).toBe(true);
      expect(engine.getRules()).toHaveLength(0);
    });

    it('should return false when unregistering non-existent rule', () => {
      const result = engine.unregisterRule('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Active Rules', () => {
    it('should only return enabled rules', () => {
      engine.registerRules([
        {
          id: 'enabled-rule',
          name: 'Enabled',
          type: 'security',
          enabled: true,
          priority: 500,
          conditions: [],
          conditionLogic: 'all',
          actions: [{ type: 'allow' }],
          riskWeight: 10
        },
        {
          id: 'disabled-rule',
          name: 'Disabled',
          type: 'security',
          enabled: false,
          priority: 500,
          conditions: [],
          conditionLogic: 'all',
          actions: [{ type: 'allow' }],
          riskWeight: 10
        }
      ]);

      const activeRules = engine.getActiveRules();
      expect(activeRules).toHaveLength(1);
      expect(activeRules[0].id).toBe('enabled-rule');
    });

    it('should sort active rules by priority (descending)', () => {
      engine.registerRules([
        {
          id: 'low-priority',
          name: 'Low Priority',
          type: 'security',
          enabled: true,
          priority: 100,
          conditions: [],
          conditionLogic: 'all',
          actions: [{ type: 'allow' }],
          riskWeight: 10
        },
        {
          id: 'high-priority',
          name: 'High Priority',
          type: 'security',
          enabled: true,
          priority: 900,
          conditions: [],
          conditionLogic: 'all',
          actions: [{ type: 'allow' }],
          riskWeight: 10
        },
        {
          id: 'medium-priority',
          name: 'Medium Priority',
          type: 'security',
          enabled: true,
          priority: 500,
          conditions: [],
          conditionLogic: 'all',
          actions: [{ type: 'allow' }],
          riskWeight: 10
        }
      ]);

      const activeRules = engine.getActiveRules();
      expect(activeRules[0].id).toBe('high-priority');
      expect(activeRules[1].id).toBe('medium-priority');
      expect(activeRules[2].id).toBe('low-priority');
    });
  });

  describe('Action Evaluation', () => {
    it('should approve actions with no rules', () => {
      const action: AgentAction = {
        name: 'test-action',
        category: 'data_access'
      };

      const result = engine.evaluateAction(action);
      expect(result.status).toBe('approved');
      expect(result.allowed).toBe(true);
      expect(result.riskScore).toBe(0);
    });

    it('should deny actions matching deny rules', () => {
      engine.registerRule({
        id: 'deny-data-access',
        name: 'Deny Data Access',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [
          { field: 'actionCategory', operator: 'equals', value: 'data_access' }
        ],
        conditionLogic: 'all',
        actions: [{ type: 'deny', message: 'Data access not allowed' }],
        riskWeight: 50
      });

      const action: AgentAction = {
        name: 'read-data',
        category: 'data_access'
      };

      const result = engine.evaluateAction(action);
      expect(result.status).toBe('denied');
      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].message).toBe('Data access not allowed');
    });

    it('should require approval for high-risk actions', () => {
      engine.registerRule({
        id: 'approval-rule',
        name: 'Require Approval',
        type: 'compliance',
        enabled: true,
        priority: 500,
        conditions: [
          { field: 'actionCategory', operator: 'equals', value: 'financial' }
        ],
        conditionLogic: 'all',
        actions: [{ type: 'require_approval', message: 'Financial actions require approval' }],
        riskWeight: 40
      });

      const action: AgentAction = {
        name: 'transfer-funds',
        category: 'financial'
      };

      const result = engine.evaluateAction(action);
      expect(result.status).toBe('pending_approval');
      expect(result.requiresHumanApproval).toBe(true);
      expect(result.approvalReason).toBe('Financial actions require approval');
    });

    it('should add warnings from warn rules', () => {
      engine.registerRule({
        id: 'warn-rule',
        name: 'Warning Rule',
        type: 'operational',
        enabled: true,
        priority: 500,
        conditions: [
          { field: 'actionCategory', operator: 'equals', value: 'network' }
        ],
        conditionLogic: 'all',
        actions: [{ type: 'warn', message: 'Network operations should be monitored' }],
        riskWeight: 15
      });

      const action: AgentAction = {
        name: 'make-request',
        category: 'network'
      };

      const result = engine.evaluateAction(action);
      expect(result.status).toBe('requires_review');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toBe('Network operations should be monitored');
    });

    it('should accumulate risk scores from multiple rules', () => {
      engine.registerRules([
        {
          id: 'rule-1',
          name: 'Rule 1',
          type: 'security',
          enabled: true,
          priority: 500,
          conditions: [],
          conditionLogic: 'all',
          actions: [{ type: 'warn' }],
          riskWeight: 30
        },
        {
          id: 'rule-2',
          name: 'Rule 2',
          type: 'security',
          enabled: true,
          priority: 500,
          conditions: [],
          conditionLogic: 'all',
          actions: [{ type: 'warn' }],
          riskWeight: 40
        }
      ]);

      const action: AgentAction = {
        name: 'test-action',
        category: 'data_access'
      };

      const result = engine.evaluateAction(action);
      expect(result.riskScore).toBe(70);
    });

    it('should cap risk score at 100', () => {
      engine.registerRules([
        {
          id: 'rule-1',
          name: 'Rule 1',
          type: 'security',
          enabled: true,
          priority: 500,
          conditions: [],
          conditionLogic: 'all',
          actions: [{ type: 'warn' }],
          riskWeight: 60
        },
        {
          id: 'rule-2',
          name: 'Rule 2',
          type: 'security',
          enabled: true,
          priority: 500,
          conditions: [],
          conditionLogic: 'all',
          actions: [{ type: 'warn' }],
          riskWeight: 60
        }
      ]);

      const action: AgentAction = {
        name: 'test-action',
        category: 'data_access'
      };

      const result = engine.evaluateAction(action);
      expect(result.riskScore).toBe(100);
    });
  });

  describe('Condition Evaluation', () => {
    it('should evaluate equals condition', () => {
      engine.registerRule({
        id: 'equals-rule',
        name: 'Equals Rule',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [
          { field: 'actionName', operator: 'equals', value: 'specific-action' }
        ],
        conditionLogic: 'all',
        actions: [{ type: 'deny' }],
        riskWeight: 10
      });

      const matchingAction: AgentAction = {
        name: 'specific-action',
        category: 'data_access'
      };

      const nonMatchingAction: AgentAction = {
        name: 'other-action',
        category: 'data_access'
      };

      expect(engine.evaluateAction(matchingAction).status).toBe('denied');
      expect(engine.evaluateAction(nonMatchingAction).status).toBe('approved');
    });

    it('should evaluate contains condition', () => {
      engine.registerRule({
        id: 'contains-rule',
        name: 'Contains Rule',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [
          { field: 'actionName', operator: 'contains', value: 'delete' }
        ],
        conditionLogic: 'all',
        actions: [{ type: 'deny' }],
        riskWeight: 10
      });

      const matchingAction: AgentAction = {
        name: 'delete-user-data',
        category: 'data_modification'
      };

      const nonMatchingAction: AgentAction = {
        name: 'read-user-data',
        category: 'data_access'
      };

      expect(engine.evaluateAction(matchingAction).status).toBe('denied');
      expect(engine.evaluateAction(nonMatchingAction).status).toBe('approved');
    });

    it('should evaluate in condition', () => {
      engine.registerRule({
        id: 'in-rule',
        name: 'In Rule',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [
          { field: 'actionCategory', operator: 'in', value: ['financial', 'pii_access'] }
        ],
        conditionLogic: 'all',
        actions: [{ type: 'require_approval' }],
        riskWeight: 30
      });

      const financialAction: AgentAction = {
        name: 'transfer',
        category: 'financial'
      };

      const piiAction: AgentAction = {
        name: 'read-ssn',
        category: 'pii_access'
      };

      const otherAction: AgentAction = {
        name: 'read-logs',
        category: 'data_access'
      };

      expect(engine.evaluateAction(financialAction).requiresHumanApproval).toBe(true);
      expect(engine.evaluateAction(piiAction).requiresHumanApproval).toBe(true);
      expect(engine.evaluateAction(otherAction).requiresHumanApproval).toBe(false);
    });

    it('should evaluate regex condition', () => {
      engine.registerRule({
        id: 'regex-rule',
        name: 'Regex Rule',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [
          { field: 'actionName', operator: 'matches_regex', value: '^admin_.*' }
        ],
        conditionLogic: 'all',
        actions: [{ type: 'require_approval' }],
        riskWeight: 25
      });

      const matchingAction: AgentAction = {
        name: 'admin_delete_user',
        category: 'data_modification'
      };

      const nonMatchingAction: AgentAction = {
        name: 'user_delete_own_account',
        category: 'data_modification'
      };

      expect(engine.evaluateAction(matchingAction).requiresHumanApproval).toBe(true);
      expect(engine.evaluateAction(nonMatchingAction).requiresHumanApproval).toBe(false);
    });

    it('should handle any condition logic', () => {
      engine.registerRule({
        id: 'any-rule',
        name: 'Any Condition Rule',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [
          { field: 'actionCategory', operator: 'equals', value: 'financial' },
          { field: 'actionCategory', operator: 'equals', value: 'pii_access' }
        ],
        conditionLogic: 'any',
        actions: [{ type: 'require_approval' }],
        riskWeight: 30
      });

      const financialAction: AgentAction = {
        name: 'transfer',
        category: 'financial'
      };

      expect(engine.evaluateAction(financialAction).requiresHumanApproval).toBe(true);
    });

    it('should handle all condition logic', () => {
      engine.registerRule({
        id: 'all-rule',
        name: 'All Condition Rule',
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [
          { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
          { field: 'actionName', operator: 'contains', value: 'delete' }
        ],
        conditionLogic: 'all',
        actions: [{ type: 'require_approval' }],
        riskWeight: 40
      });

      const bothMatch: AgentAction = {
        name: 'delete-record',
        category: 'data_modification'
      };

      const onlyOneMatch: AgentAction = {
        name: 'update-record',
        category: 'data_modification'
      };

      expect(engine.evaluateAction(bothMatch).requiresHumanApproval).toBe(true);
      expect(engine.evaluateAction(onlyOneMatch).requiresHumanApproval).toBe(false);
    });
  });

  describe('Risk Level Calculation', () => {
    it('should calculate correct risk levels', () => {
      const createRuleWithWeight = (weight: number): BusinessRule => ({
        id: `rule-${weight}`,
        name: `Rule ${weight}`,
        type: 'security',
        enabled: true,
        priority: 500,
        conditions: [],
        conditionLogic: 'all',
        actions: [{ type: 'allow' }],
        riskWeight: weight
      });

      const action: AgentAction = {
        name: 'test',
        category: 'data_access'
      };

      // Test minimal (< 20)
      engine = new RulesEngine();
      engine.registerRule(createRuleWithWeight(10));
      expect(engine.evaluateAction(action).riskLevel).toBe('minimal');

      // Test low (20-39)
      engine = new RulesEngine();
      engine.registerRule(createRuleWithWeight(25));
      expect(engine.evaluateAction(action).riskLevel).toBe('low');

      // Test medium (40-59)
      engine = new RulesEngine();
      engine.registerRule(createRuleWithWeight(45));
      expect(engine.evaluateAction(action).riskLevel).toBe('medium');

      // Test high (60-79)
      engine = new RulesEngine();
      engine.registerRule(createRuleWithWeight(70));
      expect(engine.evaluateAction(action).riskLevel).toBe('high');

      // Test critical (>= 80)
      engine = new RulesEngine();
      engine.registerRule(createRuleWithWeight(85));
      expect(engine.evaluateAction(action).riskLevel).toBe('critical');
    });
  });

  describe('Custom Evaluators', () => {
    it('should use registered custom evaluators', () => {
      engine.registerCustomEvaluator('alwaysTrue', () => true);

      engine.registerRule({
        id: 'custom-rule',
        name: 'Custom Rule',
        type: 'custom',
        enabled: true,
        priority: 500,
        conditions: [
          { field: 'any', operator: 'custom', value: null, customEvaluator: 'alwaysTrue' }
        ],
        conditionLogic: 'all',
        actions: [{ type: 'warn' }],
        riskWeight: 10
      });

      const action: AgentAction = {
        name: 'test',
        category: 'data_access'
      };

      const result = engine.evaluateAction(action);
      expect(result.warnings).toHaveLength(1);
    });

    it('should use built-in businessHours evaluator', () => {
      engine.registerRule({
        id: 'business-hours-rule',
        name: 'Business Hours Rule',
        type: 'operational',
        enabled: true,
        priority: 500,
        conditions: [
          { field: 'any', operator: 'custom', value: null, customEvaluator: 'businessHours' }
        ],
        conditionLogic: 'all',
        actions: [{ type: 'warn', message: 'During business hours' }],
        riskWeight: 5
      });

      const action: AgentAction = {
        name: 'test',
        category: 'data_access'
      };

      // This will vary based on time of execution
      const result = engine.evaluateAction(action);
      // Just verify it doesn't throw
      expect(result.status).toBeDefined();
    });
  });
});
