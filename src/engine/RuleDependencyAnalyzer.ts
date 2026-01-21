/**
 * Enterprise Agent Supervisor - Rule Dependency Analyzer (Task #37)
 *
 * Analyzes and validates rule interdependencies, detects circular dependencies,
 * and provides topologically sorted execution order.
 */

import type {
  BusinessRule,
  RuleDependencyGraph,
  RuleDependencyNode,
  DependencyValidationResult
} from '../types/index.js';

export interface DependencyAnalyzerOptions {
  /**
   * Maximum allowed depth for dependency chains before warning
   */
  maxDepthWarning?: number;
  /**
   * Whether to include disabled rules in analysis
   */
  includeDisabled?: boolean;
}

const DEFAULT_OPTIONS: DependencyAnalyzerOptions = {
  maxDepthWarning: 5,
  includeDisabled: true
};

export class RuleDependencyAnalyzer {
  private options: DependencyAnalyzerOptions;

  constructor(options: DependencyAnalyzerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Build a complete dependency graph from a set of rules
   */
  analyzeDependencies(rules: BusinessRule[]): RuleDependencyGraph {
    const ruleMap = new Map<string, BusinessRule>();
    const nodes: Record<string, RuleDependencyNode> = {};

    // First pass: create rule map and initialize nodes
    for (const rule of rules) {
      ruleMap.set(rule.id, rule);
      nodes[rule.id] = {
        ruleId: rule.id,
        ruleName: rule.name,
        dependencies: rule.dependsOn || [],
        dependents: [],
        conflicts: rule.conflictsWith || [],
        related: rule.relatedRules || [],
        depth: 0
      };
    }

    // Second pass: build reverse dependency map (dependents)
    for (const rule of rules) {
      if (rule.dependsOn) {
        for (const depId of rule.dependsOn) {
          if (nodes[depId]) {
            nodes[depId].dependents.push(rule.id);
          }
        }
      }
    }

    // Calculate depths
    this.calculateDepths(nodes, ruleMap);

    // Find circular dependencies
    const circularPaths = this.findCircularDependencies(rules);

    // Detect conflicts between active rules
    const conflicts = this.detectActiveConflicts(rules);

    // Find orphaned dependencies (dependencies that don't exist)
    const orphanedDependencies = this.findOrphanedDependencies(rules, ruleMap);

    // Get execution order via topological sort
    const executionOrder = circularPaths.length === 0
      ? this.getExecutionOrder(rules)
      : []; // Can't provide execution order with circular deps

    return {
      nodes,
      executionOrder,
      hasCircularDependencies: circularPaths.length > 0,
      circularPaths,
      conflicts,
      orphanedDependencies,
      analyzedAt: new Date().toISOString()
    };
  }

  /**
   * Find all circular dependencies in the rule set
   */
  findCircularDependencies(rules: BusinessRule[]): string[][] {
    const ruleMap = new Map<string, BusinessRule>();
    for (const rule of rules) {
      ruleMap.set(rule.id, rule);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circularPaths: string[][] = [];

    const dfs = (ruleId: string, path: string[]): void => {
      if (recursionStack.has(ruleId)) {
        // Found a cycle - extract it from the path
        const cycleStart = path.indexOf(ruleId);
        const cycle = path.slice(cycleStart);
        cycle.push(ruleId); // Complete the cycle
        circularPaths.push(cycle);
        return;
      }

      if (visited.has(ruleId)) {
        return;
      }

      visited.add(ruleId);
      recursionStack.add(ruleId);
      path.push(ruleId);

      const rule = ruleMap.get(ruleId);
      if (rule?.dependsOn) {
        for (const depId of rule.dependsOn) {
          dfs(depId, [...path]);
        }
      }

      recursionStack.delete(ruleId);
    };

    for (const rule of rules) {
      if (!visited.has(rule.id)) {
        dfs(rule.id, []);
      }
    }

    return circularPaths;
  }

  /**
   * Get topologically sorted execution order for rules
   * Rules with dependencies come after their dependencies
   */
  getExecutionOrder(rules: BusinessRule[]): string[] {
    const ruleMap = new Map<string, BusinessRule>();
    for (const rule of rules) {
      ruleMap.set(rule.id, rule);
    }

    // Filter to enabled rules only (unless includeDisabled is true)
    const activeRules = this.options.includeDisabled
      ? rules
      : rules.filter(r => r.enabled);

    // Kahn's algorithm for topological sort
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const rule of activeRules) {
      inDegree.set(rule.id, 0);
      adjacency.set(rule.id, []);
    }

    // Build adjacency and in-degree
    for (const rule of activeRules) {
      if (rule.dependsOn) {
        for (const depId of rule.dependsOn) {
          // Only count dependencies that exist in the rule set
          if (ruleMap.has(depId)) {
            const adj = adjacency.get(depId) || [];
            adj.push(rule.id);
            adjacency.set(depId, adj);
            inDegree.set(rule.id, (inDegree.get(rule.id) || 0) + 1);
          }
        }
      }
    }

    // Queue rules with no dependencies (in-degree 0)
    const queue: string[] = [];
    for (const [ruleId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(ruleId);
      }
    }

    // Sort by priority within the same dependency level
    queue.sort((a, b) => {
      const ruleA = ruleMap.get(a);
      const ruleB = ruleMap.get(b);
      return (ruleB?.priority || 500) - (ruleA?.priority || 500);
    });

    const result: string[] = [];

    while (queue.length > 0) {
      const ruleId = queue.shift()!;
      result.push(ruleId);

      const dependents = adjacency.get(ruleId) || [];
      const nextLevel: string[] = [];

      for (const depId of dependents) {
        const newDegree = (inDegree.get(depId) || 0) - 1;
        inDegree.set(depId, newDegree);

        if (newDegree === 0) {
          nextLevel.push(depId);
        }
      }

      // Sort next level by priority
      nextLevel.sort((a, b) => {
        const ruleA = ruleMap.get(a);
        const ruleB = ruleMap.get(b);
        return (ruleB?.priority || 500) - (ruleA?.priority || 500);
      });

      queue.push(...nextLevel);
    }

    return result;
  }

  /**
   * Validate all dependencies in the rule set
   */
  validateDependencies(rules: BusinessRule[]): DependencyValidationResult {
    const ruleMap = new Map<string, BusinessRule>();
    for (const rule of rules) {
      ruleMap.set(rule.id, rule);
    }

    const errors: DependencyValidationResult['errors'] = [];
    const warnings: DependencyValidationResult['warnings'] = [];

    // Check for missing dependencies
    for (const rule of rules) {
      if (rule.dependsOn) {
        for (const depId of rule.dependsOn) {
          // Self-dependency check
          if (depId === rule.id) {
            errors.push({
              type: 'self_dependency',
              ruleId: rule.id,
              message: `Rule '${rule.name}' depends on itself`,
              details: { dependencyId: depId }
            });
          }
          // Missing dependency check
          else if (!ruleMap.has(depId)) {
            errors.push({
              type: 'missing_dependency',
              ruleId: rule.id,
              message: `Rule '${rule.name}' depends on non-existent rule '${depId}'`,
              details: { missingDependency: depId }
            });
          }
          // Disabled dependency warning
          else {
            const depRule = ruleMap.get(depId)!;
            if (!depRule.enabled && rule.enabled) {
              warnings.push({
                type: 'disabled_dependency',
                ruleId: rule.id,
                message: `Enabled rule '${rule.name}' depends on disabled rule '${depRule.name}'`,
                details: { disabledDependency: depId }
              });
            }
          }
        }
      }

      // Check for conflicts with active rules
      if (rule.conflictsWith && rule.enabled) {
        for (const conflictId of rule.conflictsWith) {
          const conflictRule = ruleMap.get(conflictId);
          if (conflictRule?.enabled) {
            errors.push({
              type: 'conflict',
              ruleId: rule.id,
              message: `Rule '${rule.name}' conflicts with active rule '${conflictRule.name}'`,
              details: { conflictingRule: conflictId }
            });
          }
        }
      }
    }

    // Check for circular dependencies
    const circularPaths = this.findCircularDependencies(rules);
    for (const path of circularPaths) {
      errors.push({
        type: 'circular_dependency',
        ruleId: path[0],
        message: `Circular dependency detected: ${path.join(' -> ')}`,
        details: { path }
      });
    }

    // Check for deep dependency chains
    const graph = this.analyzeDependencies(rules);
    for (const [ruleId, node] of Object.entries(graph.nodes)) {
      if (node.depth > (this.options.maxDepthWarning || 5)) {
        const rule = ruleMap.get(ruleId);
        warnings.push({
          type: 'deep_dependency_chain',
          ruleId,
          message: `Rule '${rule?.name}' has a deep dependency chain (depth: ${node.depth})`,
          details: { depth: node.depth }
        });
      }
    }

    // Check for unused dependencies (rules that nothing depends on)
    // This is informational, not necessarily a problem
    const dependedOn = new Set<string>();
    for (const rule of rules) {
      if (rule.dependsOn) {
        for (const depId of rule.dependsOn) {
          dependedOn.add(depId);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      validatedAt: new Date().toISOString()
    };
  }

  /**
   * Get rules that depend on a specific rule (direct dependents)
   */
  getDependents(ruleId: string, rules: BusinessRule[]): BusinessRule[] {
    return rules.filter(rule =>
      rule.dependsOn?.includes(ruleId)
    );
  }

  /**
   * Get all rules that a specific rule depends on (direct dependencies)
   */
  getDependencies(ruleId: string, rules: BusinessRule[]): BusinessRule[] {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule?.dependsOn) {
      return [];
    }

    const ruleMap = new Map<string, BusinessRule>();
    for (const r of rules) {
      ruleMap.set(r.id, r);
    }

    return rule.dependsOn
      .map(depId => ruleMap.get(depId))
      .filter((r): r is BusinessRule => r !== undefined);
  }

  /**
   * Get all transitive dependencies for a rule
   */
  getTransitiveDependencies(ruleId: string, rules: BusinessRule[]): BusinessRule[] {
    const ruleMap = new Map<string, BusinessRule>();
    for (const rule of rules) {
      ruleMap.set(rule.id, rule);
    }

    const result = new Set<string>();
    const queue = [ruleId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const currentRule = ruleMap.get(currentId);
      if (currentRule?.dependsOn) {
        for (const depId of currentRule.dependsOn) {
          if (depId !== ruleId) { // Don't include the original rule
            result.add(depId);
            queue.push(depId);
          }
        }
      }
    }

    return Array.from(result)
      .map(id => ruleMap.get(id))
      .filter((r): r is BusinessRule => r !== undefined);
  }

  /**
   * Get all rules that would be affected if a rule is disabled
   */
  getAffectedByDisabling(ruleId: string, rules: BusinessRule[]): BusinessRule[] {
    const ruleMap = new Map<string, BusinessRule>();
    for (const rule of rules) {
      ruleMap.set(rule.id, rule);
    }

    const result = new Set<string>();
    const queue = [ruleId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      // Find rules that depend on this rule
      for (const rule of rules) {
        if (rule.dependsOn?.includes(currentId) && rule.id !== ruleId) {
          result.add(rule.id);
          queue.push(rule.id);
        }
      }
    }

    return Array.from(result)
      .map(id => ruleMap.get(id))
      .filter((r): r is BusinessRule => r !== undefined);
  }

  /**
   * Get rules sorted by execution order respecting dependencies
   * This integrates with the RulesEngine for proper evaluation order
   */
  getSortedRulesForExecution(rules: BusinessRule[]): BusinessRule[] {
    // First validate - if there are circular deps, fall back to priority sort
    const validation = this.validateDependencies(rules);
    const hasCircular = validation.errors.some(e => e.type === 'circular_dependency');

    if (hasCircular) {
      console.warn('Circular dependencies detected, falling back to priority-based ordering');
      return [...rules].sort((a, b) => (b.priority || 500) - (a.priority || 500));
    }

    const executionOrder = this.getExecutionOrder(rules);
    const ruleMap = new Map<string, BusinessRule>();
    for (const rule of rules) {
      ruleMap.set(rule.id, rule);
    }

    // Get rules in execution order
    const orderedRules = executionOrder
      .map(id => ruleMap.get(id))
      .filter((r): r is BusinessRule => r !== undefined);

    // Add any rules not in execution order (shouldn't happen, but safety)
    const orderedIds = new Set(executionOrder);
    const remainingRules = rules.filter(r => !orderedIds.has(r.id));

    return [...orderedRules, ...remainingRules];
  }

  /**
   * Calculate depth for each node in the dependency graph
   */
  private calculateDepths(nodes: Record<string, RuleDependencyNode>, ruleMap: Map<string, BusinessRule>): void {
    const visited = new Set<string>();
    const calculated = new Set<string>();

    const calculateDepth = (ruleId: string): number => {
      if (calculated.has(ruleId)) {
        return nodes[ruleId]?.depth || 0;
      }

      if (visited.has(ruleId)) {
        // Circular dependency - return 0 to avoid infinite recursion
        return 0;
      }

      visited.add(ruleId);

      const node = nodes[ruleId];
      if (!node || node.dependencies.length === 0) {
        if (node) {
          node.depth = 0;
          calculated.add(ruleId);
        }
        return 0;
      }

      let maxDepth = 0;
      for (const depId of node.dependencies) {
        if (ruleMap.has(depId)) {
          const depDepth = calculateDepth(depId);
          maxDepth = Math.max(maxDepth, depDepth + 1);
        }
      }

      node.depth = maxDepth;
      calculated.add(ruleId);
      return maxDepth;
    };

    for (const ruleId of Object.keys(nodes)) {
      calculateDepth(ruleId);
    }
  }

  /**
   * Detect conflicts between currently active rules
   */
  private detectActiveConflicts(rules: BusinessRule[]): RuleDependencyGraph['conflicts'] {
    const conflicts: RuleDependencyGraph['conflicts'] = [];
    const activeRules = rules.filter(r => r.enabled);

    for (const rule of activeRules) {
      if (rule.conflictsWith) {
        for (const conflictId of rule.conflictsWith) {
          const conflictRule = activeRules.find(r => r.id === conflictId);
          if (conflictRule) {
            // Avoid duplicate conflict entries (A conflicts B = B conflicts A)
            const exists = conflicts.some(c =>
              (c.ruleA === rule.id && c.ruleB === conflictId) ||
              (c.ruleA === conflictId && c.ruleB === rule.id)
            );
            if (!exists) {
              conflicts.push({
                ruleA: rule.id,
                ruleB: conflictId,
                reason: `Rule '${rule.name}' explicitly conflicts with '${conflictRule.name}'`
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Find dependencies that reference non-existent rules
   */
  private findOrphanedDependencies(
    rules: BusinessRule[],
    ruleMap: Map<string, BusinessRule>
  ): RuleDependencyGraph['orphanedDependencies'] {
    const orphaned: RuleDependencyGraph['orphanedDependencies'] = [];

    for (const rule of rules) {
      if (rule.dependsOn) {
        for (const depId of rule.dependsOn) {
          if (!ruleMap.has(depId)) {
            orphaned.push({
              ruleId: rule.id,
              missingDependency: depId
            });
          }
        }
      }
    }

    return orphaned;
  }
}

// Export singleton instance with default options
export const ruleDependencyAnalyzer = new RuleDependencyAnalyzer();
