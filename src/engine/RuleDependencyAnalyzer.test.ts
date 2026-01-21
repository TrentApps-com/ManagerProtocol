/**
 * Enterprise Agent Supervisor - Rule Dependency Analyzer Tests
 *
 * Tests for the RuleDependencyAnalyzer class (Task #37)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RuleDependencyAnalyzer } from './RuleDependencyAnalyzer.js';
import type { BusinessRule } from '../types/index.js';

describe('RuleDependencyAnalyzer', () => {
  let analyzer: RuleDependencyAnalyzer;

  beforeEach(() => {
    analyzer = new RuleDependencyAnalyzer();
  });

  // Helper to create a simple test rule
  const createRule = (
    id: string,
    name: string,
    options: {
      dependsOn?: string[];
      conflictsWith?: string[];
      relatedRules?: string[];
      enabled?: boolean;
      priority?: number;
    } = {}
  ): BusinessRule => ({
    id,
    name,
    type: 'security',
    enabled: options.enabled ?? true,
    priority: options.priority ?? 500,
    conditions: [],
    conditionLogic: 'all',
    actions: [{ type: 'allow' }],
    riskWeight: 10,
    dependsOn: options.dependsOn,
    conflictsWith: options.conflictsWith,
    relatedRules: options.relatedRules
  });

  describe('analyzeDependencies', () => {
    it('should analyze rules without dependencies', () => {
      const rules = [
        createRule('rule-1', 'Rule 1'),
        createRule('rule-2', 'Rule 2'),
        createRule('rule-3', 'Rule 3')
      ];

      const graph = analyzer.analyzeDependencies(rules);

      expect(graph.hasCircularDependencies).toBe(false);
      expect(graph.circularPaths).toHaveLength(0);
      expect(graph.conflicts).toHaveLength(0);
      expect(graph.orphanedDependencies).toHaveLength(0);
      expect(Object.keys(graph.nodes)).toHaveLength(3);
    });

    it('should build correct dependency graph', () => {
      const rules = [
        createRule('auth-check', 'Auth Check'),
        createRule('api-call', 'API Call', { dependsOn: ['auth-check'] }),
        createRule('data-access', 'Data Access', { dependsOn: ['auth-check', 'api-call'] })
      ];

      const graph = analyzer.analyzeDependencies(rules);

      expect(graph.nodes['auth-check'].dependents).toContain('api-call');
      expect(graph.nodes['auth-check'].dependents).toContain('data-access');
      expect(graph.nodes['api-call'].dependencies).toContain('auth-check');
      expect(graph.nodes['api-call'].dependents).toContain('data-access');
      expect(graph.nodes['data-access'].dependencies).toContain('auth-check');
      expect(graph.nodes['data-access'].dependencies).toContain('api-call');
    });

    it('should calculate correct depths', () => {
      const rules = [
        createRule('rule-a', 'Rule A'),  // depth 0
        createRule('rule-b', 'Rule B', { dependsOn: ['rule-a'] }),  // depth 1
        createRule('rule-c', 'Rule C', { dependsOn: ['rule-b'] }),  // depth 2
        createRule('rule-d', 'Rule D', { dependsOn: ['rule-c'] })   // depth 3
      ];

      const graph = analyzer.analyzeDependencies(rules);

      expect(graph.nodes['rule-a'].depth).toBe(0);
      expect(graph.nodes['rule-b'].depth).toBe(1);
      expect(graph.nodes['rule-c'].depth).toBe(2);
      expect(graph.nodes['rule-d'].depth).toBe(3);
    });

    it('should detect orphaned dependencies', () => {
      const rules = [
        createRule('rule-1', 'Rule 1', { dependsOn: ['non-existent'] })
      ];

      const graph = analyzer.analyzeDependencies(rules);

      expect(graph.orphanedDependencies).toHaveLength(1);
      expect(graph.orphanedDependencies[0].ruleId).toBe('rule-1');
      expect(graph.orphanedDependencies[0].missingDependency).toBe('non-existent');
    });

    it('should detect conflicts between active rules', () => {
      const rules = [
        createRule('rule-1', 'Rule 1', { conflictsWith: ['rule-2'] }),
        createRule('rule-2', 'Rule 2')
      ];

      const graph = analyzer.analyzeDependencies(rules);

      expect(graph.conflicts).toHaveLength(1);
      expect(graph.conflicts[0].ruleA).toBe('rule-1');
      expect(graph.conflicts[0].ruleB).toBe('rule-2');
    });

    it('should not detect conflicts with disabled rules', () => {
      const rules = [
        createRule('rule-1', 'Rule 1', { conflictsWith: ['rule-2'] }),
        createRule('rule-2', 'Rule 2', { enabled: false })
      ];

      const graph = analyzer.analyzeDependencies(rules);

      expect(graph.conflicts).toHaveLength(0);
    });
  });

  describe('findCircularDependencies', () => {
    it('should detect direct circular dependencies', () => {
      const rules = [
        createRule('rule-a', 'Rule A', { dependsOn: ['rule-b'] }),
        createRule('rule-b', 'Rule B', { dependsOn: ['rule-a'] })
      ];

      const circularPaths = analyzer.findCircularDependencies(rules);

      expect(circularPaths.length).toBeGreaterThan(0);
    });

    it('should detect indirect circular dependencies', () => {
      const rules = [
        createRule('rule-a', 'Rule A', { dependsOn: ['rule-c'] }),
        createRule('rule-b', 'Rule B', { dependsOn: ['rule-a'] }),
        createRule('rule-c', 'Rule C', { dependsOn: ['rule-b'] })
      ];

      const circularPaths = analyzer.findCircularDependencies(rules);

      expect(circularPaths.length).toBeGreaterThan(0);
    });

    it('should not detect cycles when there are none', () => {
      const rules = [
        createRule('rule-a', 'Rule A'),
        createRule('rule-b', 'Rule B', { dependsOn: ['rule-a'] }),
        createRule('rule-c', 'Rule C', { dependsOn: ['rule-a', 'rule-b'] })
      ];

      const circularPaths = analyzer.findCircularDependencies(rules);

      expect(circularPaths).toHaveLength(0);
    });
  });

  describe('getExecutionOrder', () => {
    it('should return topologically sorted rule IDs', () => {
      const rules = [
        createRule('rule-c', 'Rule C', { dependsOn: ['rule-b'], priority: 100 }),
        createRule('rule-a', 'Rule A', { priority: 300 }),
        createRule('rule-b', 'Rule B', { dependsOn: ['rule-a'], priority: 200 })
      ];

      const order = analyzer.getExecutionOrder(rules);

      // rule-a should come before rule-b (dependency)
      expect(order.indexOf('rule-a')).toBeLessThan(order.indexOf('rule-b'));
      // rule-b should come before rule-c (dependency)
      expect(order.indexOf('rule-b')).toBeLessThan(order.indexOf('rule-c'));
    });

    it('should sort by priority within the same dependency level', () => {
      const rules = [
        createRule('rule-1', 'Rule 1', { priority: 100 }),
        createRule('rule-2', 'Rule 2', { priority: 300 }),
        createRule('rule-3', 'Rule 3', { priority: 200 })
      ];

      const order = analyzer.getExecutionOrder(rules);

      // Higher priority should come first
      expect(order.indexOf('rule-2')).toBeLessThan(order.indexOf('rule-3'));
      expect(order.indexOf('rule-3')).toBeLessThan(order.indexOf('rule-1'));
    });

    it('should handle empty rules array', () => {
      const order = analyzer.getExecutionOrder([]);
      expect(order).toHaveLength(0);
    });
  });

  describe('validateDependencies', () => {
    it('should return valid result for rules without issues', () => {
      const rules = [
        createRule('rule-a', 'Rule A'),
        createRule('rule-b', 'Rule B', { dependsOn: ['rule-a'] })
      ];

      const result = analyzer.validateDependencies(rules);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect self-dependency', () => {
      const rules = [
        createRule('rule-a', 'Rule A', { dependsOn: ['rule-a'] })
      ];

      const result = analyzer.validateDependencies(rules);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'self_dependency')).toBe(true);
    });

    it('should detect missing dependencies', () => {
      const rules = [
        createRule('rule-a', 'Rule A', { dependsOn: ['non-existent'] })
      ];

      const result = analyzer.validateDependencies(rules);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'missing_dependency')).toBe(true);
    });

    it('should detect circular dependencies as errors', () => {
      const rules = [
        createRule('rule-a', 'Rule A', { dependsOn: ['rule-b'] }),
        createRule('rule-b', 'Rule B', { dependsOn: ['rule-a'] })
      ];

      const result = analyzer.validateDependencies(rules);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'circular_dependency')).toBe(true);
    });

    it('should detect conflicts between active rules', () => {
      const rules = [
        createRule('rule-a', 'Rule A', { conflictsWith: ['rule-b'] }),
        createRule('rule-b', 'Rule B')
      ];

      const result = analyzer.validateDependencies(rules);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'conflict')).toBe(true);
    });

    it('should warn about disabled dependencies', () => {
      const rules = [
        createRule('rule-a', 'Rule A', { enabled: false }),
        createRule('rule-b', 'Rule B', { dependsOn: ['rule-a'] })
      ];

      const result = analyzer.validateDependencies(rules);

      expect(result.warnings.some(w => w.type === 'disabled_dependency')).toBe(true);
    });

    it('should warn about deep dependency chains', () => {
      const analyzer = new RuleDependencyAnalyzer({ maxDepthWarning: 2 });
      const rules = [
        createRule('rule-1', 'Rule 1'),
        createRule('rule-2', 'Rule 2', { dependsOn: ['rule-1'] }),
        createRule('rule-3', 'Rule 3', { dependsOn: ['rule-2'] }),
        createRule('rule-4', 'Rule 4', { dependsOn: ['rule-3'] })
      ];

      const result = analyzer.validateDependencies(rules);

      expect(result.warnings.some(w => w.type === 'deep_dependency_chain')).toBe(true);
    });
  });

  describe('getDependents', () => {
    it('should return rules that depend on a given rule', () => {
      const rules = [
        createRule('rule-a', 'Rule A'),
        createRule('rule-b', 'Rule B', { dependsOn: ['rule-a'] }),
        createRule('rule-c', 'Rule C', { dependsOn: ['rule-a'] }),
        createRule('rule-d', 'Rule D')
      ];

      const dependents = analyzer.getDependents('rule-a', rules);

      expect(dependents).toHaveLength(2);
      expect(dependents.map(r => r.id)).toContain('rule-b');
      expect(dependents.map(r => r.id)).toContain('rule-c');
    });

    it('should return empty array for rules with no dependents', () => {
      const rules = [
        createRule('rule-a', 'Rule A'),
        createRule('rule-b', 'Rule B')
      ];

      const dependents = analyzer.getDependents('rule-a', rules);

      expect(dependents).toHaveLength(0);
    });
  });

  describe('getDependencies', () => {
    it('should return rules that a given rule depends on', () => {
      const rules = [
        createRule('rule-a', 'Rule A'),
        createRule('rule-b', 'Rule B'),
        createRule('rule-c', 'Rule C', { dependsOn: ['rule-a', 'rule-b'] })
      ];

      const dependencies = analyzer.getDependencies('rule-c', rules);

      expect(dependencies).toHaveLength(2);
      expect(dependencies.map(r => r.id)).toContain('rule-a');
      expect(dependencies.map(r => r.id)).toContain('rule-b');
    });

    it('should return empty array for rules with no dependencies', () => {
      const rules = [
        createRule('rule-a', 'Rule A')
      ];

      const dependencies = analyzer.getDependencies('rule-a', rules);

      expect(dependencies).toHaveLength(0);
    });
  });

  describe('getTransitiveDependencies', () => {
    it('should return all transitive dependencies', () => {
      const rules = [
        createRule('rule-a', 'Rule A'),
        createRule('rule-b', 'Rule B', { dependsOn: ['rule-a'] }),
        createRule('rule-c', 'Rule C', { dependsOn: ['rule-b'] })
      ];

      const transitive = analyzer.getTransitiveDependencies('rule-c', rules);

      expect(transitive).toHaveLength(2);
      expect(transitive.map(r => r.id)).toContain('rule-a');
      expect(transitive.map(r => r.id)).toContain('rule-b');
    });
  });

  describe('getAffectedByDisabling', () => {
    it('should return all rules affected by disabling a given rule', () => {
      const rules = [
        createRule('rule-a', 'Rule A'),
        createRule('rule-b', 'Rule B', { dependsOn: ['rule-a'] }),
        createRule('rule-c', 'Rule C', { dependsOn: ['rule-b'] }),
        createRule('rule-d', 'Rule D')
      ];

      const affected = analyzer.getAffectedByDisabling('rule-a', rules);

      expect(affected).toHaveLength(2);
      expect(affected.map(r => r.id)).toContain('rule-b');
      expect(affected.map(r => r.id)).toContain('rule-c');
      expect(affected.map(r => r.id)).not.toContain('rule-d');
    });
  });

  describe('getSortedRulesForExecution', () => {
    it('should return rules sorted by execution order', () => {
      const rules = [
        createRule('rule-c', 'Rule C', { dependsOn: ['rule-b'] }),
        createRule('rule-a', 'Rule A'),
        createRule('rule-b', 'Rule B', { dependsOn: ['rule-a'] })
      ];

      const sorted = analyzer.getSortedRulesForExecution(rules);

      // Should be in dependency order
      expect(sorted[0].id).toBe('rule-a');
      expect(sorted[1].id).toBe('rule-b');
      expect(sorted[2].id).toBe('rule-c');
    });

    it('should fall back to priority sort with circular dependencies', () => {
      const rules = [
        createRule('rule-a', 'Rule A', { dependsOn: ['rule-b'], priority: 100 }),
        createRule('rule-b', 'Rule B', { dependsOn: ['rule-a'], priority: 200 })
      ];

      const sorted = analyzer.getSortedRulesForExecution(rules);

      // Should be sorted by priority (higher first) since circular deps detected
      expect(sorted[0].id).toBe('rule-b');
      expect(sorted[1].id).toBe('rule-a');
    });
  });
});
