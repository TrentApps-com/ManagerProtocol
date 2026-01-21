/**
 * Enterprise Agent Supervisor - Rules Engine Core
 *
 * The heart of the governance system that evaluates actions against business rules.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  AgentAction,
  BusinessRule,
  BusinessContext,
  RuleCondition,
  EvaluationResult,
  RuleViolation,
  RiskLevel,
  ActionStatus,
  BusinessRulesResult,
  RuleAction,
  DependencyValidationResult
} from '../types/index.js';
import { RuleDependencyAnalyzer } from './RuleDependencyAnalyzer.js';

/**
 * Task #34: Condition evaluation cost weights for optimization
 * Lower numbers = faster operations, should be evaluated first
 */
const CONDITION_COST_WEIGHTS: Record<string, number> = {
  exists: 1,
  not_exists: 1,
  equals: 2,
  not_equals: 2,
  in: 3,
  not_in: 3,
  greater_than: 4,
  less_than: 4,
  contains: 5,
  not_contains: 5,
  matches_regex: 10, // Expensive - evaluate last
  custom: 8 // Custom evaluators can be expensive
};

export class RulesEngine {
  private rules: Map<string, BusinessRule> = new Map();
  private customEvaluators: Map<string, (context: Record<string, unknown>, condition: RuleCondition) => boolean> = new Map();
  // Task #53: Cache for compiled evaluators - keyed by evaluator name/string representation
  private evaluatorCache: Map<string, (context: Record<string, unknown>, condition: RuleCondition) => boolean> = new Map();
  // Task #34: Cache for compiled RegExp objects - keyed by pattern string
  private regexCache: Map<string, RegExp> = new Map();
  // Task #34: Cache for optimized 'in' operator Sets - keyed by JSON.stringify of value array
  private inOperatorSetCache: Map<string, Set<unknown>> = new Map();
  // Task #37: Dependency analyzer for rule ordering
  private dependencyAnalyzer: RuleDependencyAnalyzer;
  // Task #37: Cache for dependency-sorted execution order
  private executionOrderCache: string[] | null = null;
  // Task #37: Whether to respect rule dependencies in evaluation order
  private respectDependencies: boolean = true;

  constructor(options?: { respectDependencies?: boolean }) {
    this.dependencyAnalyzer = new RuleDependencyAnalyzer();
    this.respectDependencies = options?.respectDependencies ?? true;
    this.registerDefaultEvaluators();
  }

  /**
   * Register a business rule
   * Task #53: Clear evaluator cache when rules change to ensure fresh compilation
   */
  registerRule(rule: BusinessRule): void {
    this.rules.set(rule.id, rule);
    this.clearEvaluatorCache();
  }

  /**
   * Register multiple business rules
   */
  registerRules(rules: BusinessRule[]): void {
    for (const rule of rules) {
      this.registerRule(rule);
    }
  }

  /**
   * Unregister a rule by ID
   * Task #53: Clear evaluator cache when rules change
   */
  unregisterRule(ruleId: string): boolean {
    const result = this.rules.delete(ruleId);
    if (result) {
      this.clearEvaluatorCache();
    }
    return result;
  }

  /**
   * Task #53: Clear the evaluator cache
   * Task #34: Also clear regex and 'in' operator caches
   * Task #37: Also clear execution order cache
   * Called when rules are modified to ensure fresh compilation
   */
  private clearEvaluatorCache(): void {
    this.evaluatorCache.clear();
    this.regexCache.clear();
    this.inOperatorSetCache.clear();
    this.executionOrderCache = null;
  }

  /**
   * Get all registered rules
   */
  getRules(): BusinessRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get enabled rules sorted by priority (higher priority first)
   * Task #39: In strict mode, filters out deprecated rules
   * Task #37: When respectDependencies is true, returns rules in dependency-aware order
   */
  getActiveRules(strictMode: boolean = false): BusinessRule[] {
    const enabledRules = this.getRules()
      .filter(rule => rule.enabled)
      .filter(rule => !strictMode || !rule.deprecated);

    // Task #37: Return rules in dependency order if enabled
    if (this.respectDependencies) {
      return this.getDependencySortedRules(enabledRules);
    }

    // Default: sort by priority (higher priority first)
    return enabledRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Task #37: Get rules sorted by dependency order (dependencies first, then by priority)
   */
  private getDependencySortedRules(rules: BusinessRule[]): BusinessRule[] {
    // Use cached execution order if available
    if (this.executionOrderCache) {
      const ruleMap = new Map<string, BusinessRule>();
      for (const rule of rules) {
        ruleMap.set(rule.id, rule);
      }

      const orderedRules: BusinessRule[] = [];
      for (const ruleId of this.executionOrderCache) {
        const rule = ruleMap.get(ruleId);
        if (rule) {
          orderedRules.push(rule);
        }
      }

      // Add any rules not in cache (shouldn't happen, but safety)
      const cachedIds = new Set(this.executionOrderCache);
      for (const rule of rules) {
        if (!cachedIds.has(rule.id)) {
          orderedRules.push(rule);
        }
      }

      return orderedRules;
    }

    // Calculate and cache execution order
    const sortedRules = this.dependencyAnalyzer.getSortedRulesForExecution(rules);
    this.executionOrderCache = sortedRules.map(r => r.id);

    return sortedRules;
  }

  /**
   * Task #39: Get all deprecated rules
   */
  getDeprecatedRules(): BusinessRule[] {
    return this.getRules().filter(rule => rule.deprecated === true);
  }

  /**
   * Task #39: Analyze rules and suggest migrations for deprecated rules
   * Returns migration suggestions with replacement rule information
   */
  migrateRules(rules: BusinessRule[]): Array<{
    ruleId: string;
    ruleName: string;
    deprecatedMessage?: string;
    replacedBy?: string;
    replacementRule?: BusinessRule;
    suggestion: string;
  }> {
    const migrations: Array<{
      ruleId: string;
      ruleName: string;
      deprecatedMessage?: string;
      replacedBy?: string;
      replacementRule?: BusinessRule;
      suggestion: string;
    }> = [];

    for (const rule of rules) {
      if (rule.deprecated) {
        const replacementRule = rule.replacedBy ? this.rules.get(rule.replacedBy) : undefined;

        let suggestion = `Rule '${rule.name}' (${rule.id}) is deprecated.`;

        if (rule.deprecatedMessage) {
          suggestion += ` ${rule.deprecatedMessage}`;
        }

        if (rule.replacedBy) {
          if (replacementRule) {
            suggestion += ` Migrate to '${replacementRule.name}' (${rule.replacedBy}).`;
          } else {
            suggestion += ` Recommended replacement: ${rule.replacedBy} (not found in current rules).`;
          }
        }

        migrations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          deprecatedMessage: rule.deprecatedMessage,
          replacedBy: rule.replacedBy,
          replacementRule,
          suggestion
        });
      }
    }

    return migrations;
  }

  /**
   * Task #39: Check if a rule is compatible with the current supervisor version
   */
  isRuleCompatible(rule: BusinessRule, currentVersion: string): boolean {
    if (!rule.minVersion) {
      return true; // No version requirement
    }
    return this.compareVersions(currentVersion, rule.minVersion) >= 0;
  }

  /**
   * Task #37: Validate all rule dependencies
   * Returns validation result with errors and warnings
   */
  validateDependencies(): DependencyValidationResult {
    return this.dependencyAnalyzer.validateDependencies(this.getRules());
  }

  /**
   * Task #37: Get the dependency analyzer for advanced analysis
   */
  getDependencyAnalyzer(): RuleDependencyAnalyzer {
    return this.dependencyAnalyzer;
  }

  /**
   * Task #37: Enable or disable dependency-aware rule ordering
   */
  setRespectDependencies(enabled: boolean): void {
    if (this.respectDependencies !== enabled) {
      this.respectDependencies = enabled;
      this.executionOrderCache = null; // Clear cache when toggling
    }
  }

  /**
   * Task #37: Check if dependency-aware ordering is enabled
   */
  isRespectingDependencies(): boolean {
    return this.respectDependencies;
  }

  /**
   * Task #37: Get rules that depend on a specific rule
   */
  getRuleDependents(ruleId: string): BusinessRule[] {
    return this.dependencyAnalyzer.getDependents(ruleId, this.getRules());
  }

  /**
   * Task #37: Get rules that a specific rule depends on
   */
  getRuleDependencies(ruleId: string): BusinessRule[] {
    return this.dependencyAnalyzer.getDependencies(ruleId, this.getRules());
  }

  /**
   * Task #37: Get all rules that would be affected if a rule is disabled
   */
  getRulesAffectedByDisabling(ruleId: string): BusinessRule[] {
    return this.dependencyAnalyzer.getAffectedByDisabling(ruleId, this.getRules());
  }

  /**
   * Task #39: Compare semantic versions
   * Returns: 1 if a > b, -1 if a < b, 0 if equal
   */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;

      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }

    return 0;
  }

  /**
   * Task #39: Warn about deprecated rule usage
   */
  private warnDeprecatedRule(rule: BusinessRule): void {
    let message = `[DEPRECATED] Rule '${rule.name}' (${rule.id}) is deprecated.`;

    if (rule.deprecatedMessage) {
      message += ` ${rule.deprecatedMessage}`;
    }

    if (rule.replacedBy) {
      message += ` Consider migrating to: ${rule.replacedBy}`;
    }

    console.warn(message);
  }

  /**
   * Register a custom condition evaluator
   * Task #53: Clear evaluator cache when custom evaluators change
   */
  registerCustomEvaluator(
    name: string,
    evaluator: (context: Record<string, unknown>, condition: RuleCondition) => boolean
  ): void {
    this.customEvaluators.set(name, evaluator);
    this.clearEvaluatorCache();
  }

  /**
   * Evaluate an agent action against all active rules
   */
  evaluateAction(action: AgentAction, context?: BusinessContext): EvaluationResult {
    const actionId = action.id || uuidv4();
    const violations: RuleViolation[] = [];
    const warnings: string[] = [];
    const appliedRules: string[] = [];
    let totalRiskWeight = 0;
    let requiresHumanApproval = false;
    let approvalReason: string | undefined;
    let isDenied = false;
    let isRateLimited = false;

    // Build evaluation context
    const evalContext = this.buildEvaluationContext(action, context);

    // Get active rules and evaluate
    const activeRules = this.getActiveRules();

    // Task #57: Track total priority weight for normalization
    let totalPriorityWeight = 0;
    let weightedRiskSum = 0;

    for (const rule of activeRules) {
      const ruleMatches = this.evaluateRuleConditions(rule, evalContext);

      if (ruleMatches) {
        appliedRules.push(rule.id);

        // Task #39: Warn when deprecated rules are triggered
        if (rule.deprecated) {
          this.warnDeprecatedRule(rule);
        }

        // Task #57: Weight risk by rule priority (0-1000 scale)
        // Higher priority rules have more impact on final score
        const priorityMultiplier = (rule.priority + 100) / 100; // Ensure minimum weight of 1
        const weightedRisk = rule.riskWeight * priorityMultiplier;
        weightedRiskSum += weightedRisk;
        totalPriorityWeight += priorityMultiplier;
        totalRiskWeight += rule.riskWeight;

        // Process rule actions
        for (const ruleAction of rule.actions) {
          switch (ruleAction.type) {
            case 'deny':
              isDenied = true;
              violations.push({
                ruleId: rule.id,
                ruleName: rule.name,
                severity: this.getRuleSeverity(rule),
                message: ruleAction.message || `Action denied by rule: ${rule.name}`,
                recommendation: this.getRecommendation(rule, ruleAction)
              });
              break;

            case 'require_approval':
              requiresHumanApproval = true;
              approvalReason = ruleAction.message || `Requires approval due to rule: ${rule.name}`;
              break;

            case 'warn':
              warnings.push(ruleAction.message || `Warning from rule: ${rule.name}`);
              break;

            case 'rate_limit':
              isRateLimited = true;
              break;

            case 'escalate':
              requiresHumanApproval = true;
              approvalReason = `Escalated: ${ruleAction.message || rule.name}`;
              break;

            default:
              // Allow, log, transform, notify - don't affect approval status
              break;
          }
        }
      }
    }

    // Task #57: Calculate risk score using priority-weighted average (0-100)
    // If no rules matched, use raw total; otherwise use weighted calculation
    const riskScore = totalPriorityWeight > 0
      ? Math.min(100, weightedRiskSum / totalPriorityWeight)
      : Math.min(100, totalRiskWeight);
    const riskLevel = this.calculateRiskLevel(riskScore);

    // Determine final status
    let status: ActionStatus;
    if (isDenied) {
      status = 'denied';
    } else if (isRateLimited) {
      status = 'rate_limited';
    } else if (requiresHumanApproval) {
      status = 'pending_approval';
    } else if (warnings.length > 0) {
      status = 'requires_review';
    } else {
      status = 'approved';
    }

    return {
      actionId,
      status,
      riskScore,
      riskLevel,
      allowed: !isDenied && !isRateLimited,
      violations,
      warnings,
      appliedRules,
      requiresHumanApproval,
      approvalReason,
      rateLimitInfo: isRateLimited ? { limited: true } : undefined,
      evaluatedAt: new Date().toISOString(),
      metadata: {
        action: action.name,
        category: action.category,
        rulesEvaluated: activeRules.length
      }
    };
  }

  /**
   * Apply business rules to a context and return recommendations
   */
  applyBusinessRules(context: BusinessContext): BusinessRulesResult {
    const contextId = uuidv4();
    const rulesApplied: BusinessRulesResult['rulesApplied'] = [];
    const recommendations: string[] = [];
    const constraints: BusinessRulesResult['constraints'] = [];
    let totalRiskScore = 0;

    const evalContext = context.customAttributes || {};
    const activeRules = this.getActiveRules();

    for (const rule of activeRules) {
      const matched = this.evaluateRuleConditions(rule, {
        ...evalContext,
        environment: context.environment,
        userRole: context.userRole,
        dataClassification: context.dataClassification,
        department: context.department
      });

      rulesApplied.push({
        ruleId: rule.id,
        ruleName: rule.name,
        matched,
        actions: matched ? rule.actions : []
      });

      if (matched) {
        totalRiskScore += rule.riskWeight;

        // Generate recommendations and constraints
        for (const action of rule.actions) {
          if (action.type === 'deny') {
            constraints.push({
              type: 'prohibition',
              description: action.message || `Prohibited by ${rule.name}`,
              enforced: true
            });
          } else if (action.type === 'require_approval') {
            constraints.push({
              type: 'approval_required',
              description: action.message || `Requires approval per ${rule.name}`,
              enforced: true
            });
          } else if (action.type === 'warn') {
            recommendations.push(action.message || `Consider: ${rule.name}`);
          }
        }
      }
    }

    return {
      contextId,
      rulesApplied,
      aggregateRiskScore: Math.min(100, totalRiskScore),
      recommendations,
      constraints,
      processedAt: new Date().toISOString()
    };
  }

  /**
   * Build evaluation context from action and business context
   */
  private buildEvaluationContext(
    action: AgentAction,
    context?: BusinessContext
  ): Record<string, unknown> {
    return {
      // Action fields
      actionName: action.name,
      actionCategory: action.category,
      actionDescription: action.description,
      ...action.parameters,
      ...action.metadata,

      // Context fields
      environment: context?.environment,
      agentId: context?.agentId || action.agentId,
      agentType: context?.agentType,
      userId: context?.userId,
      userRole: context?.userRole,
      sessionId: context?.sessionId || action.sessionId,
      organizationId: context?.organizationId,
      department: context?.department,
      costCenter: context?.costCenter,
      dataClassification: context?.dataClassification,
      complianceFrameworks: context?.complianceFrameworks,
      ...context?.customAttributes
    };
  }

  /**
   * Task #34: Sort conditions by evaluation cost for optimal short-circuit evaluation
   * Cheaper operations (exists, equals) go first, expensive ones (regex, custom) last
   */
  private sortConditionsByEvaluationCost(conditions: RuleCondition[]): RuleCondition[] {
    return [...conditions].sort((a, b) => {
      const costA = CONDITION_COST_WEIGHTS[a.operator] ?? 5;
      const costB = CONDITION_COST_WEIGHTS[b.operator] ?? 5;
      return costA - costB;
    });
  }

  /**
   * Evaluate if all/any conditions of a rule match
   * Task #34: Optimized with condition sorting for short-circuit evaluation
   */
  private evaluateRuleConditions(
    rule: BusinessRule,
    context: Record<string, unknown>
  ): boolean {
    if (rule.conditions.length === 0) {
      return true; // No conditions means always match
    }

    // Task #34: Sort conditions by evaluation cost for optimal short-circuit behavior
    const sortedConditions = this.sortConditionsByEvaluationCost(rule.conditions);

    if (rule.conditionLogic === 'any') {
      // For 'any' logic, evaluate until first true (cheaper conditions first)
      for (const condition of sortedConditions) {
        if (this.evaluateCondition(condition, context)) {
          return true; // Short-circuit: found a match
        }
      }
      return false;
    }

    // For 'all' logic (default), evaluate until first false (cheaper conditions first)
    for (const condition of sortedConditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false; // Short-circuit: found a non-match
      }
    }
    return true;
  }

  /**
   * Task #34: Get cached RegExp or compile and cache it
   */
  private getCachedRegex(pattern: string): RegExp | null {
    let regex = this.regexCache.get(pattern);
    if (!regex) {
      try {
        regex = new RegExp(pattern);
        this.regexCache.set(pattern, regex);
      } catch {
        return null;
      }
    }
    return regex;
  }

  /**
   * Task #34: Get cached Set for 'in' operator or create and cache it
   * Using Set provides O(1) lookup instead of O(n) array.includes()
   */
  private getCachedInOperatorSet(values: unknown[]): Set<unknown> {
    const cacheKey = JSON.stringify(values);
    let valueSet = this.inOperatorSetCache.get(cacheKey);
    if (!valueSet) {
      valueSet = new Set(values);
      this.inOperatorSetCache.set(cacheKey, valueSet);
    }
    return valueSet;
  }

  /**
   * Evaluate a single condition
   * Task #34: Optimized with regex caching and Set-based 'in' operator
   */
  private evaluateCondition(
    condition: RuleCondition,
    context: Record<string, unknown>
  ): boolean {
    const fieldValue = this.getNestedValue(context, condition.field);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;

      case 'not_equals':
        return fieldValue !== condition.value;

      case 'contains':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          return fieldValue.includes(condition.value);
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(condition.value);
        }
        return false;

      case 'not_contains':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          return !fieldValue.includes(condition.value);
        }
        if (Array.isArray(fieldValue)) {
          return !fieldValue.includes(condition.value);
        }
        return true;

      case 'greater_than':
        return typeof fieldValue === 'number' && typeof condition.value === 'number'
          && fieldValue > condition.value;

      case 'less_than':
        return typeof fieldValue === 'number' && typeof condition.value === 'number'
          && fieldValue < condition.value;

      case 'in':
        // Task #34: Use Set-based lookup for O(1) performance on large value arrays
        if (Array.isArray(condition.value)) {
          const valueSet = this.getCachedInOperatorSet(condition.value);
          return valueSet.has(fieldValue);
        }
        return false;

      case 'not_in':
        // Task #34: Use Set-based lookup for O(1) performance on large value arrays
        if (Array.isArray(condition.value)) {
          const valueSet = this.getCachedInOperatorSet(condition.value);
          return !valueSet.has(fieldValue);
        }
        return true;

      case 'matches_regex':
        // Task #34: Use cached regex compilation to avoid repeated new RegExp() calls
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          const regex = this.getCachedRegex(condition.value);
          return regex ? regex.test(fieldValue) : false;
        }
        return false;

      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;

      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;

      case 'custom':
        if (condition.customEvaluator) {
          // Task #53: Check cache first for compiled evaluator
          const cacheKey = condition.customEvaluator;
          let evaluator = this.evaluatorCache.get(cacheKey);

          if (!evaluator) {
            evaluator = this.customEvaluators.get(condition.customEvaluator);
            if (evaluator) {
              // Cache the evaluator for future use
              this.evaluatorCache.set(cacheKey, evaluator);
            }
          }

          if (evaluator) {
            // Task #56: Add try-catch around custom evaluator execution
            try {
              return evaluator(context, condition);
            } catch (error) {
              // Log error and treat failed evaluator as non-matching condition
              console.error(
                `Custom evaluator '${condition.customEvaluator}' threw an exception:`,
                error instanceof Error ? error.message : String(error)
              );
              return false;
            }
          }
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Calculate risk level from score
   */
  private calculateRiskLevel(score: number): RiskLevel {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }

  /**
   * Get severity level from a rule
   */
  private getRuleSeverity(rule: BusinessRule): RiskLevel {
    if (rule.riskWeight >= 40) return 'critical';
    if (rule.riskWeight >= 30) return 'high';
    if (rule.riskWeight >= 20) return 'medium';
    if (rule.riskWeight >= 10) return 'low';
    return 'minimal';
  }

  /**
   * Generate recommendation based on rule and action
   */
  private getRecommendation(rule: BusinessRule, action: RuleAction): string {
    const baseRecs: Record<string, string> = {
      compliance: 'Review compliance requirements and ensure proper authorization',
      security: 'Consult with security team before proceeding',
      operational: 'Follow standard operating procedures',
      financial: 'Obtain financial approval before proceeding',
      ux: 'Review UX guidelines and user impact',
      architecture: 'Consult architecture review board',
      data_governance: 'Ensure data handling complies with policies',
      rate_limit: 'Reduce request frequency or request limit increase',
      custom: 'Review custom policy requirements'
    };

    return action.params?.recommendation as string
      || baseRecs[rule.type]
      || 'Review policy and obtain necessary approvals';
  }

  /**
   * Register default custom evaluators
   */
  private registerDefaultEvaluators(): void {
    // Time-based evaluator
    this.registerCustomEvaluator('businessHours', (_context) => {
      const hour = new Date().getHours();
      return hour >= 9 && hour < 17;
    });

    // Weekday evaluator
    this.registerCustomEvaluator('weekday', (_context) => {
      const day = new Date().getDay();
      return day >= 1 && day <= 5;
    });

    // Production environment evaluator
    this.registerCustomEvaluator('isProduction', (context) => {
      return context.environment === 'production';
    });

    // High privilege evaluator
    this.registerCustomEvaluator('isHighPrivilege', (context) => {
      const highPrivRoles = ['admin', 'superuser', 'root', 'system'];
      return highPrivRoles.includes(context.userRole as string);
    });
  }
}

// Export singleton instance
export const rulesEngine = new RulesEngine();
