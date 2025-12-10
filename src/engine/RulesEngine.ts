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
  RuleConditionOperator,
  EvaluationResult,
  RuleViolation,
  RiskLevel,
  ActionStatus,
  BusinessRulesResult,
  RuleAction
} from '../types/index.js';

export class RulesEngine {
  private rules: Map<string, BusinessRule> = new Map();
  private customEvaluators: Map<string, (context: Record<string, unknown>, condition: RuleCondition) => boolean> = new Map();

  constructor() {
    this.registerDefaultEvaluators();
  }

  /**
   * Register a business rule
   */
  registerRule(rule: BusinessRule): void {
    this.rules.set(rule.id, rule);
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
   */
  unregisterRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Get all registered rules
   */
  getRules(): BusinessRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get enabled rules sorted by priority (higher priority first)
   */
  getActiveRules(): BusinessRule[] {
    return this.getRules()
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Register a custom condition evaluator
   */
  registerCustomEvaluator(
    name: string,
    evaluator: (context: Record<string, unknown>, condition: RuleCondition) => boolean
  ): void {
    this.customEvaluators.set(name, evaluator);
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

    for (const rule of activeRules) {
      const ruleMatches = this.evaluateRuleConditions(rule, evalContext);

      if (ruleMatches) {
        appliedRules.push(rule.id);
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

    // Calculate risk score (0-100)
    const riskScore = Math.min(100, totalRiskWeight);
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
   * Evaluate if all/any conditions of a rule match
   */
  private evaluateRuleConditions(
    rule: BusinessRule,
    context: Record<string, unknown>
  ): boolean {
    if (rule.conditions.length === 0) {
      return true; // No conditions means always match
    }

    const results = rule.conditions.map(condition =>
      this.evaluateCondition(condition, context)
    );

    if (rule.conditionLogic === 'any') {
      return results.some(r => r);
    }
    return results.every(r => r);
  }

  /**
   * Evaluate a single condition
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
        if (Array.isArray(condition.value)) {
          return condition.value.includes(fieldValue);
        }
        return false;

      case 'not_in':
        if (Array.isArray(condition.value)) {
          return !condition.value.includes(fieldValue);
        }
        return true;

      case 'matches_regex':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          try {
            const regex = new RegExp(condition.value);
            return regex.test(fieldValue);
          } catch {
            return false;
          }
        }
        return false;

      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;

      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;

      case 'custom':
        if (condition.customEvaluator) {
          const evaluator = this.customEvaluators.get(condition.customEvaluator);
          if (evaluator) {
            return evaluator(context, condition);
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
    this.registerCustomEvaluator('businessHours', (context) => {
      const hour = new Date().getHours();
      return hour >= 9 && hour < 17;
    });

    // Weekday evaluator
    this.registerCustomEvaluator('weekday', (context) => {
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
