/**
 * Stripe Payment Security Rules
 * Governance rules for Stripe payment processing
 */

import type { BusinessRule } from '../types/index.js';
import { createAuditLoggingRule, createValidationRule } from './shared-patterns.js';

export const stripeRules: BusinessRule[] = [
  // Webhook Signature Validation - uses shared validation pattern
  createValidationRule({
    id: 'stripe-001',
    name: 'Require Webhook Signature Validation',
    description: 'Stripe webhooks must validate signatures to prevent replay attacks',
    validationType: 'signature',
    scope: {
      actionName: 'webhook',
      provider: 'stripe'
    },
    actionType: 'deny',
    message: 'Stripe webhook signature validation is required (use stripe.webhooks.constructEvent)',
    priority: 980,
    riskWeight: 65,
    tags: ['stripe', 'webhook']
  }),
  {
    id: 'stripe-002',
    name: 'Enforce Idempotency Keys',
    description: 'Payment operations must use idempotency keys',
    type: 'architecture',
    enabled: true,
    priority: 920,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'financial' },
      { field: 'provider', operator: 'equals', value: 'stripe' },
      { field: 'operation', operator: 'in', value: ['charge', 'payment', 'transfer'] },
      { field: 'idempotencyKey', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'Stripe payment operations should use idempotency keys to prevent duplicate charges' }
    ],
    riskWeight: 50,
    tags: ['stripe', 'idempotency', 'payments', 'reliability']
  },
  {
    id: 'stripe-003',
    name: 'Minimize Customer Data Storage',
    description: 'Store minimal customer data, use Stripe Customer objects',
    type: 'compliance',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
      { field: 'dataType', operator: 'equals', value: 'payment_method' },
      { field: 'storedLocally', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'PCI-DSS: Store customer data in Stripe, not locally (use Customer and PaymentMethod objects)' }
    ],
    riskWeight: 45,
    tags: ['stripe', 'pci-dss', 'data-minimization', 'compliance']
  },
  {
    id: 'stripe-004',
    name: 'Validate Connect Platform Requirements',
    description: 'Stripe Connect platforms must validate account requirements',
    type: 'compliance',
    enabled: true,
    priority: 880,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'connect' },
      { field: 'provider', operator: 'equals', value: 'stripe' },
      { field: 'accountRequirementsValidated', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Stripe Connect: Validate account requirements before accepting payments' }
    ],
    riskWeight: 40,
    tags: ['stripe', 'connect', 'compliance', 'validation']
  },
  {
    id: 'stripe-005',
    name: 'Require SCA for EU Payments',
    description: 'EU payments must use Strong Customer Authentication',
    type: 'compliance',
    enabled: true,
    priority: 950,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'financial' },
      { field: 'provider', operator: 'equals', value: 'stripe' },
      { field: 'customerRegion', operator: 'in', value: ['EU', 'EEA', 'UK'] },
      { field: 'scaEnabled', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'EU/EEA payments require SCA (use Payment Intents with automatic payment methods)' }
    ],
    riskWeight: 55,
    tags: ['stripe', 'sca', 'psd2', 'compliance', 'eu']
  },
  // Payment Event Logging - uses shared audit pattern
  createAuditLoggingRule({
    id: 'stripe-006',
    name: 'Log All Payment Events',
    description: 'All payment events must be logged for audit',
    categories: ['financial'],
    additionalConditions: [
      { field: 'provider', operator: 'equals', value: 'stripe' }
    ],
    priority: 940,
    riskWeight: 10,
    tags: ['stripe', 'compliance']
  }),
  {
    id: 'stripe-007',
    name: 'Use Latest API Version',
    description: 'Use recent Stripe API version for security and features',
    type: 'security',
    enabled: true,
    priority: 800,
    conditions: [
      { field: 'provider', operator: 'equals', value: 'stripe' },
      { field: 'apiVersion', operator: 'less_than', value: '2023-01-01' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Stripe API version is outdated - update for security fixes and new features' }
    ],
    riskWeight: 25,
    tags: ['stripe', 'api-version', 'security', 'maintenance']
  }
];
