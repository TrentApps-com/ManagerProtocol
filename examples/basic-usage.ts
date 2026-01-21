/**
 * Basic Usage Example
 *
 * Demonstrates core functionality of the Agent Supervisor.
 */

import {
  AgentSupervisor,
  type AgentAction,
  type BusinessContext
} from '../src/index.js';

async function main() {
  // Create supervisor with custom configuration
  const supervisor = new AgentSupervisor({
    config: {
      environment: 'production',
      strictMode: false,
      defaultRiskThreshold: 70,
      requireApprovalAboveRisk: 80
    }
  });

  // Initialize with standard preset
  await supervisor.initialize('standard');

  console.log('=== Agent Supervisor Demo ===\n');

  // Example 1: Evaluate a low-risk action
  console.log('1. Evaluating low-risk action (read file):');
  const readAction: AgentAction = {
    name: 'read_config_file',
    category: 'file_system',
    description: 'Reading application configuration',
    parameters: {
      filePath: '/app/config.json',
      operation: 'read'
    }
  };

  const readResult = await supervisor.evaluateAction(readAction);
  console.log(`   Status: ${readResult.status}`);
  console.log(`   Risk Score: ${readResult.riskScore}`);
  console.log(`   Allowed: ${readResult.allowed}\n`);

  // Example 2: Evaluate a high-risk action
  console.log('2. Evaluating high-risk action (delete database):');
  const deleteAction: AgentAction = {
    name: 'delete_records',
    category: 'data_modification',
    description: 'Bulk delete user records',
    parameters: {
      table: 'users',
      operation: 'delete',
      recordCount: 5000
    }
  };

  const context: BusinessContext = {
    environment: 'production',
    userRole: 'operator',
    dataClassification: 'confidential'
  };

  const deleteResult = await supervisor.evaluateAction(deleteAction, context);
  console.log(`   Status: ${deleteResult.status}`);
  console.log(`   Risk Score: ${deleteResult.riskScore}`);
  console.log(`   Risk Level: ${deleteResult.riskLevel}`);
  console.log(`   Allowed: ${deleteResult.allowed}`);
  console.log(`   Requires Approval: ${deleteResult.requiresHumanApproval}`);
  if (deleteResult.violations.length > 0) {
    console.log(`   Violations:`);
    deleteResult.violations.forEach(v => {
      console.log(`     - ${v.ruleName}: ${v.message}`);
    });
  }
  console.log();

  // Example 3: Request human approval
  console.log('3. Requesting human approval:');
  const approval = await supervisor.requireHumanApproval({
    reason: 'Bulk delete operation in production',
    details: 'Agent wants to delete 5000 user records',
    priority: 'high',
    riskScore: deleteResult.riskScore,
    context
  });
  console.log(`   Request ID: ${approval.requestId}`);
  console.log(`   Status: ${approval.status}`);
  console.log(`   Priority: ${approval.priority}\n`);

  // Example 4: Log custom event
  console.log('4. Logging custom event:');
  const event = await supervisor.logEvent({
    action: 'user_data_export_requested',
    eventType: 'custom',
    outcome: 'pending',
    metadata: {
      requestedBy: 'agent-123',
      recordCount: 1000,
      format: 'csv'
    }
  });
  console.log(`   Event ID: ${event.eventId}`);
  console.log(`   Timestamp: ${event.timestamp}\n`);

  // Example 5: Apply business rules to context
  console.log('5. Applying business rules to context:');
  const rulesResult = await supervisor.applyBusinessRules({
    environment: 'production',
    userRole: 'developer',
    dataClassification: 'restricted',
    complianceFrameworks: ['gdpr', 'hipaa']
  });
  console.log(`   Rules Applied: ${rulesResult.rulesApplied.length}`);
  console.log(`   Aggregate Risk Score: ${rulesResult.aggregateRiskScore}`);
  console.log(`   Constraints: ${rulesResult.constraints.length}`);
  if (rulesResult.recommendations.length > 0) {
    console.log(`   Recommendations:`);
    rulesResult.recommendations.forEach(r => {
      console.log(`     - ${r}`);
    });
  }
  console.log();

  // Example 6: Get audit statistics
  console.log('6. Audit Statistics:');
  const stats = supervisor.getAuditStats();
  console.log(`   Total Events: ${stats.total}`);
  console.log(`   By Outcome:`, stats.byOutcome);
  console.log();

  // Example 7: Get approval statistics
  console.log('7. Approval Statistics:');
  const approvalStats = supervisor.getApprovalStats();
  console.log(`   Pending: ${approvalStats.pending}`);
  console.log(`   By Priority:`, approvalStats.byPriority);

  console.log('\n=== Demo Complete ===');
}

main().catch(console.error);
