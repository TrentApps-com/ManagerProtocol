/**
 * Enterprise Agent Supervisor - Condition Optimizer
 * Task #34: Optimize Inefficient Condition Logic
 *
 * Provides utilities for optimizing rule conditions:
 * - Use `in` operator instead of multiple `equals`
 * - Order conditions for short-circuit optimization
 * - Identify and consolidate redundant conditions
 */

import type { RuleCondition, BusinessRule } from '../types/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of condition optimization analysis
 */
export interface OptimizationResult {
  /** Original conditions */
  original: RuleCondition[];
  /** Optimized conditions */
  optimized: RuleCondition[];
  /** Changes made */
  changes: OptimizationChange[];
  /** Whether any optimizations were made */
  wasOptimized: boolean;
  /** Estimated performance improvement (0-1) */
  estimatedImprovement: number;
}

/**
 * Describes a single optimization change
 */
export interface OptimizationChange {
  type: 'combined_to_in' | 'reordered' | 'removed_redundant' | 'simplified';
  description: string;
  originalConditions: RuleCondition[];
  newCondition?: RuleCondition;
}

/**
 * Field cost for short-circuit ordering
 * Lower cost fields should be evaluated first
 */
export interface FieldCost {
  field: string;
  cost: number;
  reason: string;
}

// ============================================================================
// FIELD COST DEFINITIONS
// ============================================================================

/**
 * Default field costs for short-circuit optimization
 * Lower cost = faster to evaluate = should be first
 */
export const DEFAULT_FIELD_COSTS: FieldCost[] = [
  // Lowest cost - simple string/boolean comparisons on common fields
  { field: 'actionCategory', cost: 1, reason: 'Always present, simple enum comparison' },
  { field: 'environment', cost: 1, reason: 'Always present, simple string comparison' },
  { field: 'actionName', cost: 2, reason: 'Always present, string comparison' },
  { field: 'protocol', cost: 2, reason: 'Usually present, simple string comparison' },

  // Low cost - boolean checks
  { field: 'authenticated', cost: 3, reason: 'Boolean flag check' },
  { field: 'sandboxed', cost: 3, reason: 'Boolean flag check' },
  { field: 'encryptionEnabled', cost: 3, reason: 'Boolean flag check' },

  // Medium cost - may require lookup
  { field: 'userRole', cost: 5, reason: 'May require role lookup' },
  { field: 'dataClassification', cost: 5, reason: 'May require data inspection' },
  { field: 'dataType', cost: 6, reason: 'May require type inference' },

  // Higher cost - numeric comparisons that may involve computation
  { field: 'recordCount', cost: 7, reason: 'May require counting' },
  { field: 'estimatedCost', cost: 8, reason: 'May require calculation' },
  { field: 'tokenCount', cost: 8, reason: 'May require counting' },
  { field: 'sessionActionCount', cost: 7, reason: 'May require lookup' },

  // Highest cost - regex matching
  { field: 'query', cost: 10, reason: 'Regex pattern matching' },
  { field: 'command', cost: 10, reason: 'Regex pattern matching' },
  { field: 'filePath', cost: 10, reason: 'Regex pattern matching' },
];

/**
 * Get the cost for a field (default cost for unknown fields)
 */
function getFieldCost(field: string): number {
  const knownField = DEFAULT_FIELD_COSTS.find(f => f.field === field);
  if (knownField) return knownField.cost;

  // Default costs based on field name patterns
  if (field.includes('regex') || field.includes('pattern')) return 10;
  if (field.includes('count') || field.includes('size')) return 7;
  if (field.startsWith('is') || field.startsWith('has') || field.endsWith('Enabled')) return 3;

  return 5; // Default middle cost
}

/**
 * Get the cost for an operator
 */
function getOperatorCost(operator: string): number {
  switch (operator) {
    case 'equals':
    case 'not_equals':
      return 1;
    case 'exists':
    case 'not_exists':
      return 1;
    case 'in':
    case 'not_in':
      return 2;
    case 'contains':
    case 'not_contains':
      return 3;
    case 'greater_than':
    case 'less_than':
      return 2;
    case 'matches_regex':
      return 8;
    case 'custom':
      return 10;
    default:
      return 5;
  }
}

// ============================================================================
// OPTIMIZATION FUNCTIONS
// ============================================================================

/**
 * Combine multiple `equals` conditions on the same field into a single `in` condition
 *
 * @example
 * Before:
 *   { field: 'env', operator: 'equals', value: 'dev' }
 *   { field: 'env', operator: 'equals', value: 'staging' }
 *
 * After:
 *   { field: 'env', operator: 'in', value: ['dev', 'staging'] }
 */
export function combineEqualsToIn(conditions: RuleCondition[]): {
  conditions: RuleCondition[];
  changes: OptimizationChange[];
} {
  const changes: OptimizationChange[] = [];
  const fieldEqualsMap = new Map<string, RuleCondition[]>();
  const nonEqualsConditions: RuleCondition[] = [];

  // Group equals conditions by field
  for (const condition of conditions) {
    if (condition.operator === 'equals' && condition.value !== null && typeof condition.value !== 'boolean') {
      const existing = fieldEqualsMap.get(condition.field) || [];
      existing.push(condition);
      fieldEqualsMap.set(condition.field, existing);
    } else {
      nonEqualsConditions.push(condition);
    }
  }

  // Convert fields with multiple equals to in
  const optimizedConditions: RuleCondition[] = [...nonEqualsConditions];

  for (const [field, equalsConditions] of Array.from(fieldEqualsMap.entries())) {
    if (equalsConditions.length > 1) {
      // Combine into single `in` condition
      const values = equalsConditions.map(c => c.value);
      const newCondition: RuleCondition = {
        field,
        operator: 'in',
        value: values
      };
      optimizedConditions.push(newCondition);

      changes.push({
        type: 'combined_to_in',
        description: `Combined ${equalsConditions.length} 'equals' conditions on '${field}' into single 'in' condition`,
        originalConditions: equalsConditions,
        newCondition
      });
    } else {
      // Keep single equals as-is
      optimizedConditions.push(equalsConditions[0]);
    }
  }

  return { conditions: optimizedConditions, changes };
}

/**
 * Reorder conditions for optimal short-circuit evaluation
 * Cheaper conditions first, more likely to fail conditions first
 */
export function reorderForShortCircuit(conditions: RuleCondition[]): {
  conditions: RuleCondition[];
  changes: OptimizationChange[];
} {
  const changes: OptimizationChange[] = [];

  // Calculate total cost for each condition
  const conditionsWithCost = conditions.map((condition, originalIndex) => ({
    condition,
    originalIndex,
    cost: getFieldCost(condition.field) + getOperatorCost(condition.operator)
  }));

  // Sort by cost (ascending - cheapest first)
  conditionsWithCost.sort((a, b) => a.cost - b.cost);

  // Check if reordering changed anything
  const wasReordered = conditionsWithCost.some((item, index) => item.originalIndex !== index);

  if (wasReordered) {
    changes.push({
      type: 'reordered',
      description: 'Reordered conditions for optimal short-circuit evaluation (cheapest first)',
      originalConditions: conditions
    });
  }

  return {
    conditions: conditionsWithCost.map(item => item.condition),
    changes
  };
}

/**
 * Remove redundant conditions
 * - Duplicate conditions
 * - Conditions that are subsets of others
 */
export function removeRedundant(conditions: RuleCondition[]): {
  conditions: RuleCondition[];
  changes: OptimizationChange[];
} {
  const changes: OptimizationChange[] = [];
  const seen = new Set<string>();
  const unique: RuleCondition[] = [];

  for (const condition of conditions) {
    // Create a canonical key for the condition
    const key = JSON.stringify({
      field: condition.field,
      operator: condition.operator,
      value: condition.value
    });

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(condition);
    } else {
      changes.push({
        type: 'removed_redundant',
        description: `Removed duplicate condition on '${condition.field}'`,
        originalConditions: [condition]
      });
    }
  }

  // Check for subset conditions (e.g., equals inside in)
  const result: RuleCondition[] = [];

  for (const condition of unique) {
    let isSubset = false;

    if (condition.operator === 'equals') {
      // Check if there's an `in` condition on the same field that contains this value
      const inCondition = unique.find(c =>
        c.field === condition.field &&
        c.operator === 'in' &&
        Array.isArray(c.value) &&
        c.value.includes(condition.value)
      );

      if (inCondition) {
        isSubset = true;
        changes.push({
          type: 'removed_redundant',
          description: `Removed '${condition.field} equals ${condition.value}' as it's covered by 'in' condition`,
          originalConditions: [condition]
        });
      }
    }

    if (!isSubset) {
      result.push(condition);
    }
  }

  return { conditions: result, changes };
}

/**
 * Simplify conditions where possible
 * - Convert single-element `in` to `equals`
 * - Convert `not_in` with single element to `not_equals`
 */
export function simplifyConditions(conditions: RuleCondition[]): {
  conditions: RuleCondition[];
  changes: OptimizationChange[];
} {
  const changes: OptimizationChange[] = [];
  const simplified: RuleCondition[] = [];

  for (const condition of conditions) {
    if (condition.operator === 'in' && Array.isArray(condition.value) && condition.value.length === 1) {
      const newCondition: RuleCondition = {
        field: condition.field,
        operator: 'equals',
        value: condition.value[0]
      };
      simplified.push(newCondition);
      changes.push({
        type: 'simplified',
        description: `Simplified single-element 'in' to 'equals' on '${condition.field}'`,
        originalConditions: [condition],
        newCondition
      });
    } else if (condition.operator === 'not_in' && Array.isArray(condition.value) && condition.value.length === 1) {
      const newCondition: RuleCondition = {
        field: condition.field,
        operator: 'not_equals',
        value: condition.value[0]
      };
      simplified.push(newCondition);
      changes.push({
        type: 'simplified',
        description: `Simplified single-element 'not_in' to 'not_equals' on '${condition.field}'`,
        originalConditions: [condition],
        newCondition
      });
    } else {
      simplified.push(condition);
    }
  }

  return { conditions: simplified, changes };
}

// ============================================================================
// MAIN OPTIMIZATION FUNCTION
// ============================================================================

/**
 * Optimize rule conditions using all available strategies
 */
export function optimizeConditions(conditions: RuleCondition[]): OptimizationResult {
  if (!conditions || conditions.length === 0) {
    return {
      original: conditions,
      optimized: conditions,
      changes: [],
      wasOptimized: false,
      estimatedImprovement: 0
    };
  }

  const allChanges: OptimizationChange[] = [];
  let currentConditions = [...conditions];

  // Step 1: Remove redundant conditions first
  const redundantResult = removeRedundant(currentConditions);
  currentConditions = redundantResult.conditions;
  allChanges.push(...redundantResult.changes);

  // Step 2: Combine equals to in
  const combineResult = combineEqualsToIn(currentConditions);
  currentConditions = combineResult.conditions;
  allChanges.push(...combineResult.changes);

  // Step 3: Simplify conditions
  const simplifyResult = simplifyConditions(currentConditions);
  currentConditions = simplifyResult.conditions;
  allChanges.push(...simplifyResult.changes);

  // Step 4: Reorder for short-circuit optimization
  const reorderResult = reorderForShortCircuit(currentConditions);
  currentConditions = reorderResult.conditions;
  allChanges.push(...reorderResult.changes);

  // Calculate estimated improvement
  let improvement = 0;
  if (allChanges.length > 0) {
    // Each change type contributes to improvement
    for (const change of allChanges) {
      switch (change.type) {
        case 'combined_to_in':
          improvement += 0.1; // 10% per combination
          break;
        case 'removed_redundant':
          improvement += 0.15; // 15% per redundant removal
          break;
        case 'reordered':
          improvement += 0.05; // 5% for reordering
          break;
        case 'simplified':
          improvement += 0.05; // 5% per simplification
          break;
      }
    }
    improvement = Math.min(improvement, 1); // Cap at 100%
  }

  return {
    original: conditions,
    optimized: currentConditions,
    changes: allChanges,
    wasOptimized: allChanges.length > 0,
    estimatedImprovement: improvement
  };
}

/**
 * Optimize all conditions in a rule
 */
export function optimizeRule(rule: BusinessRule): {
  rule: BusinessRule;
  result: OptimizationResult;
} {
  const result = optimizeConditions(rule.conditions);

  return {
    rule: {
      ...rule,
      conditions: result.optimized
    },
    result
  };
}

/**
 * Optimize all rules and return summary
 */
export function optimizeRules(rules: BusinessRule[]): {
  rules: BusinessRule[];
  summary: {
    totalRules: number;
    optimizedRules: number;
    totalChanges: number;
    changesByType: Record<string, number>;
    averageImprovement: number;
  };
  details: Array<{
    ruleId: string;
    ruleName: string;
    result: OptimizationResult;
  }>;
} {
  const optimizedRules: BusinessRule[] = [];
  const details: Array<{
    ruleId: string;
    ruleName: string;
    result: OptimizationResult;
  }> = [];

  let totalChanges = 0;
  let optimizedCount = 0;
  let totalImprovement = 0;
  const changesByType: Record<string, number> = {
    combined_to_in: 0,
    reordered: 0,
    removed_redundant: 0,
    simplified: 0
  };

  for (const rule of rules) {
    const { rule: optimizedRule, result } = optimizeRule(rule);
    optimizedRules.push(optimizedRule);

    if (result.wasOptimized) {
      optimizedCount++;
      totalImprovement += result.estimatedImprovement;

      details.push({
        ruleId: rule.id,
        ruleName: rule.name,
        result
      });

      for (const change of result.changes) {
        totalChanges++;
        changesByType[change.type] = (changesByType[change.type] || 0) + 1;
      }
    }
  }

  return {
    rules: optimizedRules,
    summary: {
      totalRules: rules.length,
      optimizedRules: optimizedCount,
      totalChanges,
      changesByType,
      averageImprovement: optimizedCount > 0 ? totalImprovement / optimizedCount : 0
    },
    details
  };
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyze rules for optimization opportunities without modifying them
 */
export function analyzeRulesForOptimization(rules: BusinessRule[]): {
  opportunities: Array<{
    ruleId: string;
    ruleName: string;
    issues: string[];
    potentialImprovement: number;
  }>;
  summary: {
    totalOpportunities: number;
    rulesWithIssues: number;
  };
} {
  const opportunities: Array<{
    ruleId: string;
    ruleName: string;
    issues: string[];
    potentialImprovement: number;
  }> = [];

  for (const rule of rules) {
    const issues: string[] = [];
    let potentialImprovement = 0;

    // Check for multiple equals on same field
    const fieldEqualsCount = new Map<string, number>();
    for (const condition of rule.conditions) {
      if (condition.operator === 'equals') {
        fieldEqualsCount.set(
          condition.field,
          (fieldEqualsCount.get(condition.field) || 0) + 1
        );
      }
    }
    for (const [field, count] of Array.from(fieldEqualsCount.entries())) {
      if (count > 1) {
        issues.push(`${count} 'equals' conditions on '${field}' could be combined into single 'in'`);
        potentialImprovement += 0.1;
      }
    }

    // Check for single-element in conditions
    for (const condition of rule.conditions) {
      if (condition.operator === 'in' && Array.isArray(condition.value) && condition.value.length === 1) {
        issues.push(`Single-element 'in' on '${condition.field}' could be simplified to 'equals'`);
        potentialImprovement += 0.05;
      }
    }

    // Check for suboptimal ordering (regex conditions before simple comparisons)
    let hasRegexBeforeSimple = false;
    let foundSimple = false;
    for (let i = rule.conditions.length - 1; i >= 0; i--) {
      const cond = rule.conditions[i];
      if (cond.operator === 'equals' || cond.operator === 'in') {
        foundSimple = true;
      } else if (cond.operator === 'matches_regex' && foundSimple) {
        hasRegexBeforeSimple = true;
        break;
      }
    }
    if (hasRegexBeforeSimple) {
      issues.push('Regex conditions before simple comparisons - reorder for short-circuit optimization');
      potentialImprovement += 0.05;
    }

    // Check for duplicate conditions
    const seen = new Set<string>();
    for (const condition of rule.conditions) {
      const key = JSON.stringify({ field: condition.field, operator: condition.operator, value: condition.value });
      if (seen.has(key)) {
        issues.push(`Duplicate condition on '${condition.field}'`);
        potentialImprovement += 0.15;
      }
      seen.add(key);
    }

    if (issues.length > 0) {
      opportunities.push({
        ruleId: rule.id,
        ruleName: rule.name,
        issues,
        potentialImprovement: Math.min(potentialImprovement, 1)
      });
    }
  }

  return {
    opportunities,
    summary: {
      totalOpportunities: opportunities.reduce((sum, o) => sum + o.issues.length, 0),
      rulesWithIssues: opportunities.length
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Main optimization functions
  optimizeConditions,
  optimizeRule,
  optimizeRules,

  // Individual optimization strategies
  combineEqualsToIn,
  reorderForShortCircuit,
  removeRedundant,
  simplifyConditions,

  // Analysis
  analyzeRulesForOptimization,

  // Cost definitions
  DEFAULT_FIELD_COSTS,
  getFieldCost
};
