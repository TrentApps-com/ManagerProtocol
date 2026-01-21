/**
 * Enterprise Agent Supervisor - Rule Testing Framework Examples
 *
 * This file demonstrates how to use the RuleTester class to test business rules.
 * These examples can be run with vitest or used as reference for writing your own tests.
 */

import type { BusinessRule, AgentAction } from '../types/index.js';
import {
  RuleTester,
  testRule,
  createTestCase,
  expectApproval,
  expectWarn,
  expectNoMatch,
  assertions
} from './rule-tester.js';
import { validateRule, checkForConflicts, lintRules } from './rule-validator.js';

// ============================================================================
// EXAMPLE RULE DEFINITIONS
// ============================================================================

/**
 * Example security rule that blocks PII access without authorization
 */
export const examplePiiAccessRule: BusinessRule = {
  id: 'example-pii-access',
  name: 'Block PII Access Without Authorization',
  description: 'Prevents unauthorized access to personally identifiable information',
  type: 'security',
  enabled: true,
  priority: 950,
  conditions: [
    { field: 'actionCategory', operator: 'equals', value: 'pii_access' },
    { field: 'userRole', operator: 'not_in', value: ['admin', 'data_officer', 'compliance'] }
  ],
  conditionLogic: 'all',
  actions: [
    { type: 'deny', message: 'PII access requires authorized role' }
  ],
  riskWeight: 45,
  tags: ['pii', 'gdpr', 'privacy']
};

/**
 * Example rule that requires approval for production deployments
 */
export const exampleProductionDeployRule: BusinessRule = {
  id: 'example-prod-deploy',
  name: 'Require Approval for Production Deployment',
  description: 'Requires human approval for deploying to production',
  type: 'operational',
  enabled: true,
  priority: 900,
  conditions: [
    { field: 'actionName', operator: 'contains', value: 'deploy' },
    { field: 'environment', operator: 'equals', value: 'production' }
  ],
  conditionLogic: 'all',
  actions: [
    { type: 'require_approval', message: 'Production deployments require approval' }
  ],
  riskWeight: 35,
  tags: ['deployment', 'production']
};

/**
 * Example rule that warns about large data operations
 */
export const exampleLargeDataWarningRule: BusinessRule = {
  id: 'example-large-data-warning',
  name: 'Warn on Large Data Operations',
  description: 'Warns when operating on more than 10,000 records',
  type: 'data_governance',
  enabled: true,
  priority: 700,
  conditions: [
    { field: 'recordCount', operator: 'greater_than', value: 10000 }
  ],
  conditionLogic: 'all',
  actions: [
    { type: 'warn', message: 'Large data operation detected (>10,000 records)' }
  ],
  riskWeight: 15,
  tags: ['data', 'performance']
};

/**
 * Example rule with dependencies
 */
export const exampleAuthCheckRule: BusinessRule = {
  id: 'example-auth-check',
  name: 'Check Authentication First',
  description: 'Base authentication check that other rules depend on',
  type: 'security',
  enabled: true,
  priority: 1000,
  conditions: [
    { field: 'authToken', operator: 'not_exists', value: null }
  ],
  conditionLogic: 'all',
  actions: [
    { type: 'deny', message: 'Authentication required' }
  ],
  riskWeight: 50,
  tags: ['authentication']
};

export const exampleApiCallRule: BusinessRule = {
  id: 'example-api-call',
  name: 'API Call Logging',
  description: 'Logs all external API calls',
  type: 'operational',
  enabled: true,
  priority: 800,
  conditions: [
    { field: 'actionCategory', operator: 'equals', value: 'external_api' }
  ],
  conditionLogic: 'all',
  actions: [
    { type: 'log', message: 'External API call detected' },
    { type: 'allow' }
  ],
  riskWeight: 10,
  tags: ['api', 'logging'],
  dependsOn: ['example-auth-check'], // Must check auth first
  relatedRules: ['example-pii-access']
};

// ============================================================================
// EXAMPLE TEST CASES USING RuleTester
// ============================================================================

/**
 * Example: Testing PII access rule with RuleTester class
 */
export function runPiiAccessRuleTests(): void {
  const tester = new RuleTester({ verbose: true });

  const result = tester.testRule(examplePiiAccessRule, [
    // Test 1: Should deny unauthorized user accessing PII
    {
      description: 'Should deny regular user accessing PII',
      input: {
        action: {
          name: 'read_customer_data',
          category: 'pii_access'
        },
        context: {
          userRole: 'developer'
        }
      },
      expectedResult: {
        shouldMatch: true,
        status: 'denied',
        allowed: false,
        violationCount: 1
      }
    },

    // Test 2: Should allow admin to access PII
    {
      description: 'Should allow admin to access PII',
      input: {
        action: {
          name: 'read_customer_data',
          category: 'pii_access'
        },
        context: {
          userRole: 'admin'
        }
      },
      expectedResult: {
        shouldMatch: false // Rule should not match for authorized users
      }
    },

    // Test 3: Should allow data_officer to access PII
    {
      description: 'Should allow data_officer to access PII',
      input: {
        action: {
          name: 'export_user_emails',
          category: 'pii_access'
        },
        context: {
          userRole: 'data_officer'
        }
      },
      expectedResult: {
        shouldMatch: false
      }
    },

    // Test 4: Should not match non-PII access
    {
      description: 'Should not match non-PII data access',
      input: {
        action: {
          name: 'read_public_stats',
          category: 'data_access'
        },
        context: {
          userRole: 'developer'
        }
      },
      expectedResult: {
        shouldMatch: false
      }
    }
  ]);

  console.log('\nPII Access Rule Test Results:');
  console.log(`  Total: ${result.totalTests}`);
  console.log(`  Passed: ${result.passedTests}`);
  console.log(`  Failed: ${result.failedTests}`);
}

/**
 * Example: Using convenience functions for test cases
 */
export function runProductionDeployTests(): void {
  const result = testRule(exampleProductionDeployRule, [
    // Using expectApproval helper
    expectApproval(
      'Should require approval for production deployment',
      {
        name: 'deploy_service',
        category: 'code_execution'
      },
      { context: { environment: 'production' } }
    ),

    // Using expectNoMatch helper
    expectNoMatch(
      'Should not require approval for staging deployment',
      {
        name: 'deploy_service',
        category: 'code_execution'
      },
      { environment: 'staging' }
    ),

    // Using createTestCase for custom expectations
    createTestCase(
      'Should require approval only when deploying to production',
      {
        name: 'deploy_application',
        category: 'code_execution'
      },
      {
        shouldMatch: true,
        status: 'pending_approval',
        requiresHumanApproval: true
      },
      { environment: 'production' }
    )
  ]);

  console.log('\nProduction Deploy Rule Test Results:');
  console.log(`  Total: ${result.totalTests}`);
  console.log(`  Passed: ${result.passedTests}`);
  console.log(`  Failed: ${result.failedTests}`);
}

/**
 * Example: Testing warning rules
 */
export function runLargeDataWarningTests(): void {
  const result = testRule(exampleLargeDataWarningRule, [
    // Using expectWarn helper
    expectWarn(
      'Should warn for large data operations',
      {
        name: 'bulk_update',
        category: 'data_modification',
        parameters: { recordCount: 50000 }
      }
    ),

    // Should not warn for small operations
    expectNoMatch(
      'Should not warn for small data operations',
      {
        name: 'update_record',
        category: 'data_modification',
        parameters: { recordCount: 100 }
      }
    )
  ]);

  console.log('\nLarge Data Warning Rule Test Results:');
  console.log(`  Total: ${result.totalTests}`);
  console.log(`  Passed: ${result.passedTests}`);
  console.log(`  Failed: ${result.failedTests}`);
}

// ============================================================================
// EXAMPLE: USING ASSERTION HELPERS
// ============================================================================

/**
 * Example: Using assertion helpers for vitest/jest integration
 */
export function demonstrateAssertions(): void {
  const action: AgentAction = {
    name: 'read_customer_data',
    category: 'pii_access'
  };

  const unauthorizedContext = { userRole: 'developer' };
  const authorizedContext = { userRole: 'admin' };

  // Using assertion helpers
  const matchesUnauthorized = assertions.ruleMatches(
    examplePiiAccessRule,
    action,
    unauthorizedContext
  );
  console.log(`Rule matches unauthorized access: ${matchesUnauthorized}`); // true

  const matchesAuthorized = assertions.ruleMatches(
    examplePiiAccessRule,
    action,
    authorizedContext
  );
  console.log(`Rule matches authorized access: ${matchesAuthorized}`); // false

  const deniesUnauthorized = assertions.ruleDenies(
    examplePiiAccessRule,
    action,
    unauthorizedContext
  );
  console.log(`Rule denies unauthorized access: ${deniesUnauthorized}`); // true
}

// ============================================================================
// EXAMPLE: RULE VALIDATION
// ============================================================================

/**
 * Example: Validating rule structure
 */
export function demonstrateValidation(): void {
  // Valid rule
  const validResult = validateRule(examplePiiAccessRule);
  console.log('\nValid rule validation:');
  console.log(`  Is valid: ${validResult.isValid}`);
  console.log(`  Errors: ${validResult.errors.length}`);
  console.log(`  Warnings: ${validResult.warnings.length}`);

  // Invalid rule (missing required fields)
  const invalidRule = {
    id: 'invalid-rule',
    // Missing name, type, conditions, actions
  };
  const invalidResult = validateRule(invalidRule);
  console.log('\nInvalid rule validation:');
  console.log(`  Is valid: ${invalidResult.isValid}`);
  console.log(`  Errors: ${invalidResult.errors.map(e => e.message).join(', ')}`);
}

/**
 * Example: Checking for rule conflicts
 */
export function demonstrateConflictDetection(): void {
  // Create two rules with conflicting actions
  const rule1: BusinessRule = {
    id: 'conflict-allow',
    name: 'Allow API Calls',
    type: 'operational',
    enabled: true,
    priority: 500,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'external_api' }
    ],
    conditionLogic: 'all',
    actions: [{ type: 'allow' }],
    riskWeight: 0
  };

  const rule2: BusinessRule = {
    id: 'conflict-deny',
    name: 'Deny API Calls',
    type: 'security',
    enabled: true,
    priority: 500,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'external_api' }
    ],
    conditionLogic: 'all',
    actions: [{ type: 'deny' }],
    riskWeight: 50
  };

  const conflictResult = checkForConflicts([rule1, rule2]);
  console.log('\nConflict detection:');
  console.log(`  Has conflicts: ${conflictResult.hasConflicts}`);
  for (const conflict of conflictResult.conflicts) {
    console.log(`  - ${conflict.conflictType}: ${conflict.description}`);
  }
}

/**
 * Example: Linting rules for best practices
 */
export function demonstrateLinting(): void {
  const rules = [
    examplePiiAccessRule,
    exampleProductionDeployRule,
    exampleLargeDataWarningRule,
    exampleAuthCheckRule,
    exampleApiCallRule
  ];

  const lintResult = lintRules(rules);
  console.log('\nLint results:');
  console.log(`  Total issues: ${lintResult.totalIssues}`);
  console.log(`  Errors: ${lintResult.errors.length}`);
  console.log(`  Warnings: ${lintResult.warnings.length}`);
  console.log(`  Suggestions: ${lintResult.suggestions.length}`);

  for (const error of lintResult.errors) {
    console.log(`  [ERROR] ${error.ruleId}: ${error.message}`);
  }
  for (const warning of lintResult.warnings) {
    console.log(`  [WARN] ${warning.ruleId}: ${warning.message}`);
  }
}

// ============================================================================
// RUN ALL EXAMPLES
// ============================================================================

/**
 * Run all examples to demonstrate the testing framework
 */
export function runAllExamples(): void {
  console.log('=== Rule Testing Framework Examples ===\n');

  console.log('--- Test Case Examples ---');
  runPiiAccessRuleTests();
  runProductionDeployTests();
  runLargeDataWarningTests();

  console.log('\n--- Assertion Helpers ---');
  demonstrateAssertions();

  console.log('\n--- Validation Examples ---');
  demonstrateValidation();
  demonstrateConflictDetection();
  demonstrateLinting();

  console.log('\n=== Examples Complete ===');
}
