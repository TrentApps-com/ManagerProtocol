/**
 * Enterprise Agent Supervisor - Testing Framework
 *
 * Export testing utilities for rules validation and testing.
 */

// Rule Tester exports
export {
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

export type {
  RuleTestCase,
  TestInput,
  ExpectedResult,
  TestCaseResult,
  AssertionFailure,
  RuleTestResult
} from './rule-tester.js';

// Rule Validator exports
export {
  validateRule,
  validateConditions,
  checkForConflicts,
  lintRules,
  validateRules
} from './rule-validator.js';

export type {
  RuleValidationResult,
  ValidationError,
  ValidationWarning,
  ConflictCheckResult,
  RuleConflict,
  ConflictType,
  LintResult,
  LintIssue
} from './rule-validator.js';

// Example rules and test functions for reference
export {
  examplePiiAccessRule,
  exampleProductionDeployRule,
  exampleLargeDataWarningRule,
  exampleAuthCheckRule,
  exampleApiCallRule,
  runPiiAccessRuleTests,
  runProductionDeployTests,
  runLargeDataWarningTests,
  demonstrateAssertions,
  demonstrateValidation,
  demonstrateConflictDetection,
  demonstrateLinting,
  runAllExamples
} from './rule-tester.examples.js';
