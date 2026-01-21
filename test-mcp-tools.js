#!/usr/bin/env node
/**
 * Test MCP Tools
 *
 * Tests the main MCP tools to ensure they work correctly after the refactoring.
 */

import { supervisor } from './dist/supervisor/AgentSupervisor.js';
import { taskManager } from './dist/engine/TaskManager.js';

async function testHealthCheck() {
  console.log('\n🧪 Testing health_check...');
  try {
    await supervisor.initialize();
    const config = supervisor.getConfig();
    const stats = supervisor.getAuditStats();

    // Test without repo (should work now)
    const pendingApprovals = await supervisor.getPendingApprovals();

    console.log('✅ health_check works without repo');
    console.log(`   - Version: ${config.version}`);
    console.log(`   - Environment: ${config.environment}`);
    console.log(`   - Rules: ${supervisor.getRules().length}`);
    console.log(`   - Pending Approvals: ${pendingApprovals.length}`);
    return true;
  } catch (error) {
    console.error('❌ health_check failed:', error.message);
    return false;
  }
}

async function testEvaluateAction() {
  console.log('\n🧪 Testing evaluate_action...');
  try {
    const result = await supervisor.evaluateAction({
      name: 'test_action',
      category: 'file_system',
      description: 'Test file operation'
    });

    console.log('✅ evaluate_action works');
    console.log(`   - Status: ${result.status}`);
    console.log(`   - Risk Score: ${result.riskScore}`);
    console.log(`   - Risk Level: ${result.riskLevel}`);
    return true;
  } catch (error) {
    console.error('❌ evaluate_action failed:', error.message);
    return false;
  }
}

async function testTaskManager() {
  console.log('\n🧪 Testing TaskManager...');
  try {
    const ghStatus = await taskManager.verifyGh();
    if (!ghStatus.ok) {
      console.log('⚠️  gh CLI not authenticated, skipping task tests');
      return true;
    }

    const currentRepo = await taskManager.getCurrentRepo();
    if (!currentRepo) {
      console.log('⚠️  Not in a git repo, skipping task tests');
      return true;
    }

    console.log(`   Current repo: ${currentRepo}`);

    // Try to get tasks
    const tasks = await taskManager.getTasksByProject(currentRepo);
    console.log(`✅ TaskManager works - found ${tasks.length} tasks`);

    // Try to get pending tasks
    const pendingTasks = await taskManager.getPendingTasks(currentRepo);
    console.log(`   - Pending tasks: ${pendingTasks.length}`);

    // Try to get project stats
    const stats = await taskManager.getProjectStats(currentRepo);
    if (stats) {
      console.log(`   - Total tasks: ${stats.total}`);
      console.log(`   - By status:`, stats.byStatus);
    }

    return true;
  } catch (error) {
    console.error('❌ TaskManager failed:', error.message);
    return false;
  }
}

async function testApprovalManager() {
  console.log('\n🧪 Testing ApprovalManager...');
  try {
    // Test getting pending approvals without repo (should return empty array)
    const approvals = await supervisor.getPendingApprovals();
    console.log('✅ getPendingApprovals works without repo');
    console.log(`   - Pending approvals: ${approvals.length}`);

    // Test with a repo if we have one
    const currentRepo = await taskManager.getCurrentRepo();
    if (currentRepo) {
      const repoApprovals = await supervisor.getPendingApprovals(currentRepo);
      console.log(`   - Pending approvals for ${currentRepo}: ${repoApprovals.length}`);
    }

    return true;
  } catch (error) {
    console.error('❌ ApprovalManager failed:', error.message);
    return false;
  }
}

async function testAuditLogger() {
  console.log('\n🧪 Testing AuditLogger...');
  try {
    await supervisor.logEvent({
      action: 'test_event',
      eventType: 'custom',
      outcome: 'success',
      metadata: { test: true }
    });

    const events = supervisor.getAuditEvents({ eventType: 'custom' });
    console.log('✅ AuditLogger works');
    console.log(`   - Custom events logged: ${events.length}`);

    const stats = supervisor.getAuditStats();
    console.log(`   - Total events: ${stats.total}`);

    return true;
  } catch (error) {
    console.error('❌ AuditLogger failed:', error.message);
    return false;
  }
}

async function testRulesEngine() {
  console.log('\n🧪 Testing RulesEngine...');
  try {
    const rules = supervisor.getRules();
    console.log('✅ RulesEngine works');
    console.log(`   - Total rules loaded: ${rules.length}`);

    // Test applying business rules
    const result = await supervisor.applyBusinessRules({
      environment: 'development',
      agentId: 'test-agent'
    });

    console.log(`   - Rules applied: ${result.rulesApplied.length}`);
    console.log(`   - Constraints: ${result.constraints.length}`);

    return true;
  } catch (error) {
    console.error('❌ RulesEngine failed:', error.message);
    return false;
  }
}

// Run all tests
(async () => {
  console.log('🚀 Starting MCP Tools Test Suite\n');
  console.log('=' .repeat(60));

  const results = [];

  results.push(await testHealthCheck());
  results.push(await testEvaluateAction());
  results.push(await testTaskManager());
  results.push(await testApprovalManager());
  results.push(await testAuditLogger());
  results.push(await testRulesEngine());

  console.log('\n' + '='.repeat(60));
  const passed = results.filter(r => r).length;
  const failed = results.length - passed;

  console.log(`\n📊 Test Results: ${passed}/${results.length} passed`);

  if (failed > 0) {
    console.log(`\n❌ ${failed} test(s) failed\n`);
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  }
})();
