/**
 * Enterprise Agent Supervisor - Rule Testing Framework
 *
 * Provides utilities for testing individual business rules and verifying their behavior.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  AgentAction,
  BusinessRule,
  BusinessContext,
  EvaluationResult,
  RiskLevel
} from '../types/index.js';
import { RulesEngine } from '../engine/RulesEngine.js';

// ============================================================================
// TEST CASE TYPES
// ============================================================================

/**
 * Test case for rule evaluation
 */
export interface RuleTestCase {
  /** Unique test case identifier */
  id?: string;
  /** Human-readable description of what this test verifies */
  description: string;
  /** Input action to evaluate */
  input: TestInput;
  /** Expected evaluation result */
  expectedResult: ExpectedResult;
  /** Whether this test should be skipped */
  skip?: boolean;
  /** Whether this is the only test to run (for debugging) */
  only?: boolean;
}

/**
 * Input for a rule test case
 */
export interface TestInput {
  /** Agent action to evaluate */
  action: Partial<AgentAction> & { name: string; category: AgentAction['category'] };
  /** Optional business context */
  context?: Partial<BusinessContext>;
}

/**
 * Expected result for a rule test case
 */
export interface ExpectedResult {
  /** Whether the rule should match */
  shouldMatch: boolean;
  /** Expected status (if rule matches) */
  status?: EvaluationResult['status'];
  /** Whether action should be allowed */
  allowed?: boolean;
  /** Expected risk level */
  riskLevel?: RiskLevel;
  /** Minimum risk score */
  minRiskScore?: number;
  /** Maximum risk score */
  maxRiskScore?: number;
  /** Whether human approval should be required */
  requiresHumanApproval?: boolean;
  /** Expected violation count */
  violationCount?: number;
  /** Expected warning count */
  warningCount?: number;
  /** Specific violation messages to check for */
  violationMessages?: string[];
  /** Specific warning messages to check for */
  warningMessages?: string[];
}

/**
 * Result of running a single test case
 */
export interface TestCaseResult {
  /** Test case ID */
  testCaseId: string;
  /** Test case description */
  description: string;
  /** Whether the test passed */
  passed: boolean;
  /** Test was skipped */
  skipped: boolean;
  /** Actual evaluation result */
  actualResult?: EvaluationResult;
  /** List of assertion failures */
  failures: AssertionFailure[];
  /** Execution time in ms */
  durationMs: number;
}

/**
 * Assertion failure details
 */
export interface AssertionFailure {
  /** What was being checked */
  assertion: string;
  /** Expected value */
  expected: unknown;
  /** Actual value */
  actual: unknown;
  /** Error message */
  message: string;
}

/**
 * Result of running all tests for a rule
 */
export interface RuleTestResult {
  /** Rule being tested */
  ruleId: string;
  /** Rule name */
  ruleName: string;
  /** Total test cases */
  totalTests: number;
  /** Passed test cases */
  passedTests: number;
  /** Failed test cases */
  failedTests: number;
  /** Skipped test cases */
  skippedTests: number;
  /** Individual test case results */
  testCaseResults: TestCaseResult[];
  /** Total execution time */
  totalDurationMs: number;
}

// ============================================================================
// RULE TESTER CLASS
// ============================================================================

/**
 * RuleTester class for testing individual business rules
 */
export class RuleTester {
  private engine: RulesEngine;
  private verbose: boolean;

  constructor(options: { verbose?: boolean } = {}) {
    this.engine = new RulesEngine();
    this.verbose = options.verbose ?? false;
  }

  /**
   * Test a single rule against multiple test cases
   */
  testRule(rule: BusinessRule, testCases: RuleTestCase[]): RuleTestResult {
    const startTime = Date.now();
    const testCaseResults: TestCaseResult[] = [];
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;

    // Register only this rule
    this.engine = new RulesEngine();
    this.engine.registerRule(rule);

    // Check if any test has 'only' flag
    const hasOnlyTests = testCases.some(tc => tc.only);

    for (const testCase of testCases) {
      // Skip tests not in the run list (when 'only' is used)
      if (hasOnlyTests && !testCase.only) {
        skippedTests++;
        testCaseResults.push({
          testCaseId: testCase.id || uuidv4(),
          description: testCase.description,
          passed: false,
          skipped: true,
          failures: [],
          durationMs: 0
        });
        continue;
      }

      if (testCase.skip) {
        skippedTests++;
        testCaseResults.push({
          testCaseId: testCase.id || uuidv4(),
          description: testCase.description,
          passed: false,
          skipped: true,
          failures: [],
          durationMs: 0
        });
        continue;
      }

      const result = this.runTestCase(rule, testCase);
      testCaseResults.push(result);

      if (result.passed) {
        passedTests++;
      } else {
        failedTests++;
        if (this.verbose) {
          this.logFailure(rule, testCase, result);
        }
      }
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      totalTests: testCases.length,
      passedTests,
      failedTests,
      skippedTests,
      testCaseResults,
      totalDurationMs: Date.now() - startTime
    };
  }

  /**
   * Run a single test case
   */
  private runTestCase(rule: BusinessRule, testCase: RuleTestCase): TestCaseResult {
    const startTime = Date.now();
    const testCaseId = testCase.id || uuidv4();
    const failures: AssertionFailure[] = [];

    // Build full action
    const action: AgentAction = {
      id: uuidv4(),
      ...testCase.input.action
    };

    // Build context
    const context: BusinessContext | undefined = testCase.input.context
      ? { ...testCase.input.context }
      : undefined;

    // Evaluate
    const result = this.engine.evaluateAction(action, context);

    // Check if rule matched
    const ruleMatched = result.appliedRules.includes(rule.id);

    // Assertion: shouldMatch
    if (testCase.expectedResult.shouldMatch !== ruleMatched) {
      failures.push({
        assertion: 'shouldMatch',
        expected: testCase.expectedResult.shouldMatch,
        actual: ruleMatched,
        message: testCase.expectedResult.shouldMatch
          ? `Expected rule '${rule.name}' to match, but it did not`
          : `Expected rule '${rule.name}' NOT to match, but it did`
      });
    }

    // Only check other assertions if shouldMatch is correct
    if (testCase.expectedResult.shouldMatch && ruleMatched) {
      // Check status
      if (testCase.expectedResult.status !== undefined) {
        if (result.status !== testCase.expectedResult.status) {
          failures.push({
            assertion: 'status',
            expected: testCase.expectedResult.status,
            actual: result.status,
            message: `Expected status '${testCase.expectedResult.status}', got '${result.status}'`
          });
        }
      }

      // Check allowed
      if (testCase.expectedResult.allowed !== undefined) {
        if (result.allowed !== testCase.expectedResult.allowed) {
          failures.push({
            assertion: 'allowed',
            expected: testCase.expectedResult.allowed,
            actual: result.allowed,
            message: `Expected allowed=${testCase.expectedResult.allowed}, got ${result.allowed}`
          });
        }
      }

      // Check risk level
      if (testCase.expectedResult.riskLevel !== undefined) {
        if (result.riskLevel !== testCase.expectedResult.riskLevel) {
          failures.push({
            assertion: 'riskLevel',
            expected: testCase.expectedResult.riskLevel,
            actual: result.riskLevel,
            message: `Expected risk level '${testCase.expectedResult.riskLevel}', got '${result.riskLevel}'`
          });
        }
      }

      // Check risk score range
      if (testCase.expectedResult.minRiskScore !== undefined) {
        if (result.riskScore < testCase.expectedResult.minRiskScore) {
          failures.push({
            assertion: 'minRiskScore',
            expected: `>= ${testCase.expectedResult.minRiskScore}`,
            actual: result.riskScore,
            message: `Expected risk score >= ${testCase.expectedResult.minRiskScore}, got ${result.riskScore}`
          });
        }
      }

      if (testCase.expectedResult.maxRiskScore !== undefined) {
        if (result.riskScore > testCase.expectedResult.maxRiskScore) {
          failures.push({
            assertion: 'maxRiskScore',
            expected: `<= ${testCase.expectedResult.maxRiskScore}`,
            actual: result.riskScore,
            message: `Expected risk score <= ${testCase.expectedResult.maxRiskScore}, got ${result.riskScore}`
          });
        }
      }

      // Check human approval
      if (testCase.expectedResult.requiresHumanApproval !== undefined) {
        if (result.requiresHumanApproval !== testCase.expectedResult.requiresHumanApproval) {
          failures.push({
            assertion: 'requiresHumanApproval',
            expected: testCase.expectedResult.requiresHumanApproval,
            actual: result.requiresHumanApproval,
            message: `Expected requiresHumanApproval=${testCase.expectedResult.requiresHumanApproval}, got ${result.requiresHumanApproval}`
          });
        }
      }

      // Check violation count
      if (testCase.expectedResult.violationCount !== undefined) {
        if (result.violations.length !== testCase.expectedResult.violationCount) {
          failures.push({
            assertion: 'violationCount',
            expected: testCase.expectedResult.violationCount,
            actual: result.violations.length,
            message: `Expected ${testCase.expectedResult.violationCount} violations, got ${result.violations.length}`
          });
        }
      }

      // Check warning count
      if (testCase.expectedResult.warningCount !== undefined) {
        if (result.warnings.length !== testCase.expectedResult.warningCount) {
          failures.push({
            assertion: 'warningCount',
            expected: testCase.expectedResult.warningCount,
            actual: result.warnings.length,
            message: `Expected ${testCase.expectedResult.warningCount} warnings, got ${result.warnings.length}`
          });
        }
      }

      // Check violation messages
      if (testCase.expectedResult.violationMessages) {
        for (const expectedMsg of testCase.expectedResult.violationMessages) {
          const found = result.violations.some(v => v.message.includes(expectedMsg));
          if (!found) {
            failures.push({
              assertion: 'violationMessage',
              expected: expectedMsg,
              actual: result.violations.map(v => v.message),
              message: `Expected violation message containing '${expectedMsg}' not found`
            });
          }
        }
      }

      // Check warning messages
      if (testCase.expectedResult.warningMessages) {
        for (const expectedMsg of testCase.expectedResult.warningMessages) {
          const found = result.warnings.some(w => w.includes(expectedMsg));
          if (!found) {
            failures.push({
              assertion: 'warningMessage',
              expected: expectedMsg,
              actual: result.warnings,
              message: `Expected warning message containing '${expectedMsg}' not found`
            });
          }
        }
      }
    }

    return {
      testCaseId,
      description: testCase.description,
      passed: failures.length === 0,
      skipped: false,
      actualResult: result,
      failures,
      durationMs: Date.now() - startTime
    };
  }

  /**
   * Log a test failure in verbose mode
   */
  private logFailure(rule: BusinessRule, testCase: RuleTestCase, result: TestCaseResult): void {
    console.log(`\n[FAIL] Rule: ${rule.name}`);
    console.log(`       Test: ${testCase.description}`);
    for (const failure of result.failures) {
      console.log(`       - ${failure.message}`);
      console.log(`         Expected: ${JSON.stringify(failure.expected)}`);
      console.log(`         Actual:   ${JSON.stringify(failure.actual)}`);
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Test a single rule against multiple test cases (convenience function)
 */
export function testRule(rule: BusinessRule, testCases: RuleTestCase[]): RuleTestResult {
  const tester = new RuleTester();
  return tester.testRule(rule, testCases);
}

/**
 * Create a test case with defaults
 */
export function createTestCase(
  description: string,
  action: Partial<AgentAction> & { name: string; category: AgentAction['category'] },
  expectedResult: ExpectedResult,
  context?: Partial<BusinessContext>
): RuleTestCase {
  return {
    description,
    input: { action, context },
    expectedResult
  };
}

/**
 * Create a test case that expects the rule to match and deny
 */
export function expectDeny(
  description: string,
  action: Partial<AgentAction> & { name: string; category: AgentAction['category'] },
  options?: {
    context?: Partial<BusinessContext>;
    violationMessages?: string[];
  }
): RuleTestCase {
  return createTestCase(
    description,
    action,
    {
      shouldMatch: true,
      status: 'denied',
      allowed: false,
      violationCount: 1,
      ...options
    },
    options?.context
  );
}

/**
 * Create a test case that expects the rule to match and require approval
 */
export function expectApproval(
  description: string,
  action: Partial<AgentAction> & { name: string; category: AgentAction['category'] },
  options?: {
    context?: Partial<BusinessContext>;
  }
): RuleTestCase {
  return createTestCase(
    description,
    action,
    {
      shouldMatch: true,
      status: 'pending_approval',
      allowed: true,
      requiresHumanApproval: true,
      ...options
    },
    options?.context
  );
}

/**
 * Create a test case that expects the rule to match and warn
 */
export function expectWarn(
  description: string,
  action: Partial<AgentAction> & { name: string; category: AgentAction['category'] },
  options?: {
    context?: Partial<BusinessContext>;
    warningMessages?: string[];
  }
): RuleTestCase {
  return createTestCase(
    description,
    action,
    {
      shouldMatch: true,
      status: 'requires_review',
      allowed: true,
      warningCount: 1,
      ...options
    },
    options?.context
  );
}

/**
 * Create a test case that expects the rule NOT to match
 */
export function expectNoMatch(
  description: string,
  action: Partial<AgentAction> & { name: string; category: AgentAction['category'] },
  context?: Partial<BusinessContext>
): RuleTestCase {
  return createTestCase(
    description,
    action,
    { shouldMatch: false },
    context
  );
}

/**
 * Create a test case that expects the rule to match and allow
 */
export function expectAllow(
  description: string,
  action: Partial<AgentAction> & { name: string; category: AgentAction['category'] },
  context?: Partial<BusinessContext>
): RuleTestCase {
  return createTestCase(
    description,
    action,
    {
      shouldMatch: true,
      status: 'approved',
      allowed: true
    },
    context
  );
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assertion helpers for use with testing frameworks like vitest
 */
export const assertions = {
  /**
   * Assert that a rule matches the given action
   */
  ruleMatches(
    rule: BusinessRule,
    action: AgentAction,
    context?: BusinessContext
  ): boolean {
    const engine = new RulesEngine();
    engine.registerRule(rule);
    const result = engine.evaluateAction(action, context);
    return result.appliedRules.includes(rule.id);
  },

  /**
   * Assert that a rule denies the given action
   */
  ruleDenies(
    rule: BusinessRule,
    action: AgentAction,
    context?: BusinessContext
  ): boolean {
    const engine = new RulesEngine();
    engine.registerRule(rule);
    const result = engine.evaluateAction(action, context);
    return result.appliedRules.includes(rule.id) && result.status === 'denied';
  },

  /**
   * Assert that a rule requires approval for the given action
   */
  ruleRequiresApproval(
    rule: BusinessRule,
    action: AgentAction,
    context?: BusinessContext
  ): boolean {
    const engine = new RulesEngine();
    engine.registerRule(rule);
    const result = engine.evaluateAction(action, context);
    return result.appliedRules.includes(rule.id) && result.requiresHumanApproval;
  },

  /**
   * Assert that a rule produces a warning for the given action
   */
  ruleWarns(
    rule: BusinessRule,
    action: AgentAction,
    context?: BusinessContext
  ): boolean {
    const engine = new RulesEngine();
    engine.registerRule(rule);
    const result = engine.evaluateAction(action, context);
    return result.appliedRules.includes(rule.id) && result.warnings.length > 0;
  },

  /**
   * Assert that a rule allows the given action
   */
  ruleAllows(
    rule: BusinessRule,
    action: AgentAction,
    context?: BusinessContext
  ): boolean {
    const engine = new RulesEngine();
    engine.registerRule(rule);
    const result = engine.evaluateAction(action, context);
    return result.appliedRules.includes(rule.id) && result.allowed;
  }
};
