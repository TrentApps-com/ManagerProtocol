/**
 * Enterprise Agent Supervisor - Rule Validation Framework
 *
 * Provides utilities for validating rule structure, syntax, and detecting conflicts.
 */

import type {
  BusinessRule,
  RuleCondition,
  RuleConditionOperator,
  RuleAction,
  BusinessRuleType,
  RuleActionType
} from '../types/index.js';

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

/**
 * Result of validating a single rule
 */
export interface RuleValidationResult {
  /** Rule being validated */
  ruleId: string;
  /** Whether the rule is valid */
  isValid: boolean;
  /** List of validation errors */
  errors: ValidationError[];
  /** List of validation warnings */
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Path to the problematic field */
  path?: string;
  /** Severity */
  severity: 'error';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Path to the problematic field */
  path?: string;
  /** Severity */
  severity: 'warning';
}

/**
 * Result of checking for rule conflicts
 */
export interface ConflictCheckResult {
  /** Whether conflicts were found */
  hasConflicts: boolean;
  /** List of detected conflicts */
  conflicts: RuleConflict[];
}

/**
 * A conflict between two rules
 */
export interface RuleConflict {
  /** First rule in the conflict */
  rule1: { id: string; name: string };
  /** Second rule in the conflict */
  rule2: { id: string; name: string };
  /** Type of conflict */
  conflictType: ConflictType;
  /** Description of the conflict */
  description: string;
  /** Suggested resolution */
  suggestion?: string;
}

/**
 * Types of rule conflicts
 */
export type ConflictType =
  | 'contradicting_actions'   // Rules with same conditions but opposite actions
  | 'duplicate_conditions'    // Rules with identical conditions
  | 'shadowed_rule'          // Lower priority rule never fires due to higher priority
  | 'redundant_rule'         // Rule that duplicates another rule's functionality
  | 'circular_dependency';   // Rules that create a circular dependency

/**
 * Result of linting rules
 */
export interface LintResult {
  /** Total issues found */
  totalIssues: number;
  /** Critical issues that should be fixed */
  errors: LintIssue[];
  /** Non-critical issues that should be reviewed */
  warnings: LintIssue[];
  /** Suggestions for improvement */
  suggestions: LintIssue[];
}

/**
 * A lint issue
 */
export interface LintIssue {
  /** Issue code */
  code: string;
  /** Rule ID with the issue */
  ruleId: string;
  /** Issue message */
  message: string;
  /** Severity */
  severity: 'error' | 'warning' | 'suggestion';
  /** How to fix the issue */
  fix?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const VALID_OPERATORS: RuleConditionOperator[] = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'greater_than',
  'less_than',
  'in',
  'not_in',
  'matches_regex',
  'exists',
  'not_exists',
  'custom'
];

const VALID_ACTION_TYPES: RuleActionType[] = [
  'allow',
  'deny',
  'require_approval',
  'warn',
  'log',
  'rate_limit',
  'transform',
  'escalate',
  'notify'
];

const VALID_RULE_TYPES: BusinessRuleType[] = [
  'compliance',
  'security',
  'operational',
  'financial',
  'ux',
  'architecture',
  'data_governance',
  'rate_limit',
  'custom'
];

// ============================================================================
// RULE VALIDATION
// ============================================================================

/**
 * Validate a single business rule
 */
export function validateRule(rule: unknown): RuleValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check if rule is an object
  if (!rule || typeof rule !== 'object') {
    return {
      ruleId: 'unknown',
      isValid: false,
      errors: [{
        code: 'INVALID_TYPE',
        message: 'Rule must be an object',
        severity: 'error'
      }],
      warnings: []
    };
  }

  const r = rule as Record<string, unknown>;
  const ruleId = typeof r.id === 'string' ? r.id : 'unknown';

  // Required fields
  if (!r.id || typeof r.id !== 'string') {
    errors.push({
      code: 'MISSING_ID',
      message: 'Rule must have a string id',
      path: 'id',
      severity: 'error'
    });
  } else if (!/^[a-z0-9-_]+$/i.test(r.id)) {
    warnings.push({
      code: 'INVALID_ID_FORMAT',
      message: 'Rule id should only contain alphanumeric characters, hyphens, and underscores',
      path: 'id',
      severity: 'warning'
    });
  }

  if (!r.name || typeof r.name !== 'string') {
    errors.push({
      code: 'MISSING_NAME',
      message: 'Rule must have a string name',
      path: 'name',
      severity: 'error'
    });
  } else if (r.name.length < 3) {
    warnings.push({
      code: 'SHORT_NAME',
      message: 'Rule name should be at least 3 characters',
      path: 'name',
      severity: 'warning'
    });
  }

  if (!r.type || !VALID_RULE_TYPES.includes(r.type as BusinessRuleType)) {
    errors.push({
      code: 'INVALID_TYPE',
      message: `Rule type must be one of: ${VALID_RULE_TYPES.join(', ')}`,
      path: 'type',
      severity: 'error'
    });
  }

  // Priority validation
  if (r.priority !== undefined) {
    if (typeof r.priority !== 'number') {
      errors.push({
        code: 'INVALID_PRIORITY',
        message: 'Priority must be a number',
        path: 'priority',
        severity: 'error'
      });
    } else if (r.priority < 0 || r.priority > 1000) {
      warnings.push({
        code: 'PRIORITY_OUT_OF_RANGE',
        message: 'Priority should be between 0 and 1000',
        path: 'priority',
        severity: 'warning'
      });
    }
  }

  // Risk weight validation
  if (r.riskWeight !== undefined) {
    if (typeof r.riskWeight !== 'number') {
      errors.push({
        code: 'INVALID_RISK_WEIGHT',
        message: 'Risk weight must be a number',
        path: 'riskWeight',
        severity: 'error'
      });
    } else if (r.riskWeight < 0 || r.riskWeight > 100) {
      errors.push({
        code: 'RISK_WEIGHT_OUT_OF_RANGE',
        message: 'Risk weight must be between 0 and 100',
        path: 'riskWeight',
        severity: 'error'
      });
    }
  }

  // Conditions validation
  if (!Array.isArray(r.conditions)) {
    errors.push({
      code: 'INVALID_CONDITIONS',
      message: 'Conditions must be an array',
      path: 'conditions',
      severity: 'error'
    });
  } else {
    const conditionErrors = validateConditions(r.conditions);
    errors.push(...conditionErrors.errors);
    warnings.push(...conditionErrors.warnings);
  }

  // Condition logic validation
  if (r.conditionLogic !== undefined && !['all', 'any'].includes(r.conditionLogic as string)) {
    errors.push({
      code: 'INVALID_CONDITION_LOGIC',
      message: 'Condition logic must be "all" or "any"',
      path: 'conditionLogic',
      severity: 'error'
    });
  }

  // Actions validation
  if (!Array.isArray(r.actions)) {
    errors.push({
      code: 'INVALID_ACTIONS',
      message: 'Actions must be an array',
      path: 'actions',
      severity: 'error'
    });
  } else if (r.actions.length === 0) {
    warnings.push({
      code: 'EMPTY_ACTIONS',
      message: 'Rule has no actions defined',
      path: 'actions',
      severity: 'warning'
    });
  } else {
    const actionErrors = validateActions(r.actions as RuleAction[]);
    errors.push(...actionErrors.errors);
    warnings.push(...actionErrors.warnings);
  }

  // Tags validation
  if (r.tags !== undefined) {
    if (!Array.isArray(r.tags)) {
      errors.push({
        code: 'INVALID_TAGS',
        message: 'Tags must be an array',
        path: 'tags',
        severity: 'error'
      });
    } else {
      for (let i = 0; i < r.tags.length; i++) {
        if (typeof r.tags[i] !== 'string') {
          errors.push({
            code: 'INVALID_TAG',
            message: `Tag at index ${i} must be a string`,
            path: `tags[${i}]`,
            severity: 'error'
          });
        }
      }
    }
  }

  return {
    ruleId,
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate an array of conditions
 */
export function validateConditions(conditions: unknown[]): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i] as Record<string, unknown>;
    const path = `conditions[${i}]`;

    if (!condition || typeof condition !== 'object') {
      errors.push({
        code: 'INVALID_CONDITION',
        message: `Condition at index ${i} must be an object`,
        path,
        severity: 'error'
      });
      continue;
    }

    // Field validation
    if (!condition.field || typeof condition.field !== 'string') {
      errors.push({
        code: 'MISSING_FIELD',
        message: 'Condition must have a string field',
        path: `${path}.field`,
        severity: 'error'
      });
    }

    // Operator validation
    if (!condition.operator || !VALID_OPERATORS.includes(condition.operator as RuleConditionOperator)) {
      errors.push({
        code: 'INVALID_OPERATOR',
        message: `Operator must be one of: ${VALID_OPERATORS.join(', ')}`,
        path: `${path}.operator`,
        severity: 'error'
      });
    }

    // Value validation based on operator
    const op = condition.operator as RuleConditionOperator;
    if (op === 'in' || op === 'not_in') {
      if (!Array.isArray(condition.value)) {
        errors.push({
          code: 'INVALID_VALUE_TYPE',
          message: `Value for '${op}' operator must be an array`,
          path: `${path}.value`,
          severity: 'error'
        });
      }
    }

    if (op === 'greater_than' || op === 'less_than') {
      if (typeof condition.value !== 'number') {
        errors.push({
          code: 'INVALID_VALUE_TYPE',
          message: `Value for '${op}' operator must be a number`,
          path: `${path}.value`,
          severity: 'error'
        });
      }
    }

    if (op === 'matches_regex') {
      if (typeof condition.value !== 'string') {
        errors.push({
          code: 'INVALID_VALUE_TYPE',
          message: 'Value for matches_regex operator must be a string',
          path: `${path}.value`,
          severity: 'error'
        });
      } else {
        // Validate regex syntax
        try {
          new RegExp(condition.value);
        } catch (e) {
          errors.push({
            code: 'INVALID_REGEX',
            message: `Invalid regex pattern: ${(e as Error).message}`,
            path: `${path}.value`,
            severity: 'error'
          });
        }
      }
    }

    if (op === 'custom' && !condition.customEvaluator) {
      errors.push({
        code: 'MISSING_CUSTOM_EVALUATOR',
        message: 'Custom operator requires customEvaluator field',
        path: `${path}.customEvaluator`,
        severity: 'error'
      });
    }
  }

  return { errors, warnings };
}

/**
 * Validate an array of actions
 */
function validateActions(actions: RuleAction[]): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  let hasDeny = false;
  let hasAllow = false;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const path = `actions[${i}]`;

    if (!action || typeof action !== 'object') {
      errors.push({
        code: 'INVALID_ACTION',
        message: `Action at index ${i} must be an object`,
        path,
        severity: 'error'
      });
      continue;
    }

    if (!action.type || !VALID_ACTION_TYPES.includes(action.type)) {
      errors.push({
        code: 'INVALID_ACTION_TYPE',
        message: `Action type must be one of: ${VALID_ACTION_TYPES.join(', ')}`,
        path: `${path}.type`,
        severity: 'error'
      });
    }

    if (action.type === 'deny') hasDeny = true;
    if (action.type === 'allow') hasAllow = true;
  }

  // Check for conflicting actions
  if (hasDeny && hasAllow) {
    warnings.push({
      code: 'CONFLICTING_ACTIONS',
      message: 'Rule has both deny and allow actions, deny will take precedence',
      path: 'actions',
      severity: 'warning'
    });
  }

  return { errors, warnings };
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

/**
 * Check for conflicts between rules
 */
export function checkForConflicts(rules: BusinessRule[]): ConflictCheckResult {
  const conflicts: RuleConflict[] = [];

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const rule1 = rules[i];
      const rule2 = rules[j];

      // Check for duplicate IDs
      if (rule1.id === rule2.id) {
        conflicts.push({
          rule1: { id: rule1.id, name: rule1.name },
          rule2: { id: rule2.id, name: rule2.name },
          conflictType: 'duplicate_conditions',
          description: 'Two rules have the same ID',
          suggestion: 'Ensure each rule has a unique ID'
        });
      }

      // Check for duplicate conditions
      if (conditionsAreEqual(rule1.conditions, rule2.conditions)) {
        // Check if actions contradict
        const actions1 = new Set(rule1.actions.map(a => a.type));
        const actions2 = new Set(rule2.actions.map(a => a.type));

        if ((actions1.has('deny') && actions2.has('allow')) ||
            (actions1.has('allow') && actions2.has('deny'))) {
          conflicts.push({
            rule1: { id: rule1.id, name: rule1.name },
            rule2: { id: rule2.id, name: rule2.name },
            conflictType: 'contradicting_actions',
            description: 'Rules have identical conditions but contradicting actions (allow vs deny)',
            suggestion: 'Review and consolidate these rules, or add distinguishing conditions'
          });
        } else {
          conflicts.push({
            rule1: { id: rule1.id, name: rule1.name },
            rule2: { id: rule2.id, name: rule2.name },
            conflictType: 'duplicate_conditions',
            description: 'Rules have identical conditions',
            suggestion: 'Consider merging these rules or adding distinguishing conditions'
          });
        }
      }

      // Check for shadowed rules
      if (rulesShadow(rule1, rule2)) {
        const shadowedRule = rule1.priority > rule2.priority ? rule2 : rule1;
        const shadowingRule = rule1.priority > rule2.priority ? rule1 : rule2;
        conflicts.push({
          rule1: { id: shadowingRule.id, name: shadowingRule.name },
          rule2: { id: shadowedRule.id, name: shadowedRule.name },
          conflictType: 'shadowed_rule',
          description: `Rule '${shadowedRule.name}' may never fire because '${shadowingRule.name}' has higher priority and broader conditions`,
          suggestion: 'Review rule priorities or make conditions more specific'
        });
      }
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts
  };
}

/**
 * Check if two condition arrays are equal
 */
function conditionsAreEqual(conds1: RuleCondition[], conds2: RuleCondition[]): boolean {
  if (conds1.length !== conds2.length) return false;

  const sorted1 = [...conds1].sort((a, b) => `${a.field}${a.operator}`.localeCompare(`${b.field}${b.operator}`));
  const sorted2 = [...conds2].sort((a, b) => `${a.field}${a.operator}`.localeCompare(`${b.field}${b.operator}`));

  for (let i = 0; i < sorted1.length; i++) {
    if (sorted1[i].field !== sorted2[i].field) return false;
    if (sorted1[i].operator !== sorted2[i].operator) return false;
    if (JSON.stringify(sorted1[i].value) !== JSON.stringify(sorted2[i].value)) return false;
  }

  return true;
}

/**
 * Check if one rule shadows another (more general conditions with higher priority)
 */
function rulesShadow(rule1: BusinessRule, rule2: BusinessRule): boolean {
  // A rule shadows another if it has higher priority and
  // its conditions are a subset of (more general than) the other rule's conditions

  if (rule1.priority <= rule2.priority) return false;

  // If rule1 has no conditions, it matches everything
  if (rule1.conditions.length === 0) return true;

  // Check if rule1's conditions are a subset of rule2's
  return conditionsAreSubset(rule1.conditions, rule2.conditions);
}

/**
 * Check if conds1 is a subset of conds2 (conds1 is more general)
 */
function conditionsAreSubset(conds1: RuleCondition[], conds2: RuleCondition[]): boolean {
  // Every condition in conds1 must be satisfied by some condition in conds2
  for (const c1 of conds1) {
    const found = conds2.some(c2 =>
      c1.field === c2.field &&
      c1.operator === c2.operator &&
      JSON.stringify(c1.value) === JSON.stringify(c2.value)
    );
    if (!found) return false;
  }
  return true;
}

// ============================================================================
// RULE LINTING
// ============================================================================

/**
 * Lint rules for potential issues and best practices
 */
export function lintRules(rules: BusinessRule[]): LintResult {
  const errors: LintIssue[] = [];
  const warnings: LintIssue[] = [];
  const suggestions: LintIssue[] = [];

  // Check individual rules
  for (const rule of rules) {
    // Validate each rule first
    const validation = validateRule(rule);
    for (const error of validation.errors) {
      errors.push({
        code: error.code,
        ruleId: rule.id,
        message: error.message,
        severity: 'error',
        fix: error.path ? `Fix the value at ${error.path}` : undefined
      });
    }
    for (const warning of validation.warnings) {
      warnings.push({
        code: warning.code,
        ruleId: rule.id,
        message: warning.message,
        severity: 'warning'
      });
    }

    // Check for missing description
    if (!rule.description) {
      suggestions.push({
        code: 'MISSING_DESCRIPTION',
        ruleId: rule.id,
        message: 'Rule has no description',
        severity: 'suggestion',
        fix: 'Add a description explaining what this rule does and why'
      });
    }

    // Check for missing tags
    if (!rule.tags || rule.tags.length === 0) {
      suggestions.push({
        code: 'MISSING_TAGS',
        ruleId: rule.id,
        message: 'Rule has no tags',
        severity: 'suggestion',
        fix: 'Add tags to categorize the rule (e.g., security, compliance, pii)'
      });
    }

    // Check for very high risk weight without approval
    if (rule.riskWeight >= 50) {
      const requiresApproval = rule.actions.some(a =>
        a.type === 'require_approval' || a.type === 'deny'
      );
      if (!requiresApproval) {
        warnings.push({
          code: 'HIGH_RISK_NO_CONTROL',
          ruleId: rule.id,
          message: `Rule has high risk weight (${rule.riskWeight}) but no deny or require_approval action`,
          severity: 'warning',
          fix: 'Consider adding require_approval or deny action for high-risk rules'
        });
      }
    }

    // Check for empty conditions with deny action
    if (rule.conditions.length === 0 && rule.actions.some(a => a.type === 'deny')) {
      errors.push({
        code: 'UNCONDITIONAL_DENY',
        ruleId: rule.id,
        message: 'Rule denies all actions unconditionally (no conditions)',
        severity: 'error',
        fix: 'Add conditions to restrict when the deny action applies'
      });
    }

    // Check for very low priority with critical actions
    if (rule.priority < 100 && rule.actions.some(a => a.type === 'deny')) {
      warnings.push({
        code: 'LOW_PRIORITY_DENY',
        ruleId: rule.id,
        message: 'Deny rule has very low priority and may be overridden',
        severity: 'warning',
        fix: 'Consider increasing priority for deny rules'
      });
    }

    // Check for action without message
    for (const action of rule.actions) {
      if (['deny', 'warn', 'require_approval'].includes(action.type) && !action.message) {
        suggestions.push({
          code: 'ACTION_MISSING_MESSAGE',
          ruleId: rule.id,
          message: `${action.type} action has no message`,
          severity: 'suggestion',
          fix: 'Add a descriptive message to help users understand why this action was taken'
        });
      }
    }

    // Check for overly broad regex patterns
    for (const condition of rule.conditions) {
      if (condition.operator === 'matches_regex' && typeof condition.value === 'string') {
        if (condition.value === '.*' || condition.value === '.+' || condition.value === '^.*$') {
          warnings.push({
            code: 'OVERLY_BROAD_REGEX',
            ruleId: rule.id,
            message: `Regex pattern '${condition.value}' matches almost everything`,
            severity: 'warning',
            fix: 'Use a more specific regex pattern'
          });
        }
      }
    }
  }

  // Check for conflicts
  const conflictResult = checkForConflicts(rules);
  for (const conflict of conflictResult.conflicts) {
    const issue: LintIssue = {
      code: `CONFLICT_${conflict.conflictType.toUpperCase()}`,
      ruleId: `${conflict.rule1.id} <-> ${conflict.rule2.id}`,
      message: conflict.description,
      severity: conflict.conflictType === 'contradicting_actions' ? 'error' : 'warning',
      fix: conflict.suggestion
    };

    if (conflict.conflictType === 'contradicting_actions') {
      errors.push(issue);
    } else {
      warnings.push(issue);
    }
  }

  // Check for unused rule types
  const usedTypes = new Set(rules.map(r => r.type));
  const unusedTypes = VALID_RULE_TYPES.filter(t => !usedTypes.has(t));
  if (unusedTypes.length > 0 && rules.length > 10) {
    suggestions.push({
      code: 'UNUSED_RULE_TYPES',
      ruleId: 'global',
      message: `No rules defined for types: ${unusedTypes.join(', ')}`,
      severity: 'suggestion'
    });
  }

  return {
    totalIssues: errors.length + warnings.length + suggestions.length,
    errors,
    warnings,
    suggestions
  };
}

// ============================================================================
// BATCH VALIDATION
// ============================================================================

/**
 * Validate multiple rules at once
 */
export function validateRules(rules: unknown[]): {
  valid: RuleValidationResult[];
  invalid: RuleValidationResult[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    errorCount: number;
    warningCount: number;
  };
} {
  const results = rules.map(rule => validateRule(rule));
  const valid = results.filter(r => r.isValid);
  const invalid = results.filter(r => !r.isValid);

  return {
    valid,
    invalid,
    summary: {
      total: rules.length,
      valid: valid.length,
      invalid: invalid.length,
      errorCount: results.reduce((sum, r) => sum + r.errors.length, 0),
      warningCount: results.reduce((sum, r) => sum + r.warnings.length, 0)
    }
  };
}
