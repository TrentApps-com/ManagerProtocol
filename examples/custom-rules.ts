/**
 * Custom Rules Example
 *
 * Demonstrates how to create and register custom governance rules.
 */

import {
  AgentSupervisor,
  type BusinessRule,
  type AgentAction
} from '../src/index.js';

async function main() {
  const supervisor = new AgentSupervisor();
  await supervisor.initialize('minimal'); // Start with minimal rules

  console.log('=== Custom Rules Demo ===\n');

  // Define custom rules for your organization
  const customRules: BusinessRule[] = [
    // Rule 1: Limit AI model calls during peak hours
    {
      id: 'custom-001',
      name: 'Peak Hours LLM Rate Limit',
      description: 'Reduces LLM calls during business peak hours to manage costs',
      type: 'operational',
      enabled: true,
      priority: 800,
      conditions: [
        { field: 'actionName', operator: 'contains', value: 'llm' },
        { field: 'isPeakHours', operator: 'equals', value: true }
      ],
      conditionLogic: 'all',
      actions: [
        { type: 'rate_limit', message: 'LLM calls limited during peak hours (9AM-5PM)' }
      ],
      riskWeight: 15,
      tags: ['cost-control', 'llm', 'peak-hours']
    },

    // Rule 2: Require approval for customer data access
    {
      id: 'custom-002',
      name: 'Customer Data Access Control',
      description: 'Requires approval for accessing customer data outside support context',
      type: 'security',
      enabled: true,
      priority: 900,
      conditions: [
        { field: 'dataType', operator: 'equals', value: 'customer' },
        { field: 'contextType', operator: 'not_equals', value: 'support_ticket' }
      ],
      conditionLogic: 'all',
      actions: [
        { type: 'require_approval', message: 'Customer data access outside support context requires approval' },
        { type: 'log' }
      ],
      riskWeight: 35,
      tags: ['customer-data', 'privacy', 'access-control']
    },

    // Rule 3: Block email sending in development
    {
      id: 'custom-003',
      name: 'Development Email Block',
      description: 'Prevents sending actual emails in development environment',
      type: 'operational',
      enabled: true,
      priority: 950,
      conditions: [
        { field: 'actionName', operator: 'contains', value: 'send_email' },
        { field: 'environment', operator: 'equals', value: 'development' }
      ],
      conditionLogic: 'all',
      actions: [
        { type: 'deny', message: 'Email sending is blocked in development. Use mock service.' }
      ],
      riskWeight: 20,
      tags: ['email', 'development', 'safety']
    },

    // Rule 4: Cost limit per agent session
    {
      id: 'custom-004',
      name: 'Session Cost Limit',
      description: 'Limits total cost per agent session',
      type: 'financial',
      enabled: true,
      priority: 850,
      conditions: [
        { field: 'sessionTotalCost', operator: 'greater_than', value: 50 }
      ],
      conditionLogic: 'all',
      actions: [
        { type: 'deny', message: 'Session cost limit ($50) exceeded' },
        { type: 'notify', message: 'Alert: Agent session exceeded cost limit' }
      ],
      riskWeight: 40,
      tags: ['cost-control', 'session', 'limits']
    },

    // Rule 5: Database write validation
    {
      id: 'custom-005',
      name: 'Database Write Validation',
      description: 'Requires schema validation for database writes',
      type: 'architecture',
      enabled: true,
      priority: 880,
      conditions: [
        { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
        { field: 'schemaValidated', operator: 'not_equals', value: true }
      ],
      conditionLogic: 'all',
      actions: [
        { type: 'warn', message: 'Database writes should be schema-validated' }
      ],
      riskWeight: 25,
      tags: ['database', 'validation', 'data-integrity']
    }
  ];

  // Register custom rules
  console.log('Registering custom rules...');
  customRules.forEach(rule => {
    supervisor.addRule(rule);
    console.log(`  ✓ ${rule.name} (${rule.id})`);
  });
  console.log();

  // Test the custom rules
  console.log('Testing custom rules:\n');

  // Test 1: LLM call during peak hours
  console.log('1. LLM call during peak hours:');
  const llmAction: AgentAction = {
    name: 'call_llm_api',
    category: 'external_api',
    parameters: {
      model: 'gpt-4',
      isPeakHours: true
    }
  };
  const llmResult = await supervisor.evaluateAction(llmAction);
  console.log(`   Status: ${llmResult.status}`);
  console.log(`   Warnings: ${llmResult.warnings.join(', ') || 'None'}\n`);

  // Test 2: Customer data access outside support
  console.log('2. Customer data access (non-support context):');
  const customerAction: AgentAction = {
    name: 'query_customer_profile',
    category: 'data_access',
    parameters: {
      dataType: 'customer',
      contextType: 'analytics'
    }
  };
  const customerResult = await supervisor.evaluateAction(customerAction);
  console.log(`   Status: ${customerResult.status}`);
  console.log(`   Requires Approval: ${customerResult.requiresHumanApproval}\n`);

  // Test 3: Email in development
  console.log('3. Send email in development:');
  const emailAction: AgentAction = {
    name: 'send_email_notification',
    category: 'user_communication',
    parameters: {
      to: 'user@example.com',
      subject: 'Test'
    }
  };
  const emailResult = await supervisor.evaluateAction(emailAction, {
    environment: 'development'
  });
  console.log(`   Status: ${emailResult.status}`);
  console.log(`   Allowed: ${emailResult.allowed}`);
  if (emailResult.violations.length > 0) {
    console.log(`   Reason: ${emailResult.violations[0].message}`);
  }
  console.log();

  // Test 4: High session cost
  console.log('4. Action after session cost exceeded:');
  const costAction: AgentAction = {
    name: 'process_data',
    category: 'data_modification',
    parameters: {
      sessionTotalCost: 75
    }
  };
  const costResult = await supervisor.evaluateAction(costAction);
  console.log(`   Status: ${costResult.status}`);
  console.log(`   Allowed: ${costResult.allowed}\n`);

  // List all rules
  console.log('All active rules:');
  const rules = supervisor.getRules();
  console.log(`   Total: ${rules.length} rules`);
  console.log(`   By type:`);
  const byType: Record<string, number> = {};
  rules.forEach(r => {
    byType[r.type] = (byType[r.type] || 0) + 1;
  });
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`     - ${type}: ${count}`);
  });

  console.log('\n=== Demo Complete ===');
}

main().catch(console.error);
