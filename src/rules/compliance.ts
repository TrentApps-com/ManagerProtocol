/**
 * Enterprise Agent Supervisor - Compliance Rules
 *
 * Built-in rules for regulatory compliance (GDPR, SOX, HIPAA, PCI-DSS, etc.)
 */

import type { BusinessRule } from '../types/index.js';
import {
  createAuditLoggingRule,
  createDataTypeAuditRule,
  createEncryptionRule,
  AUDIT_CATEGORIES
} from './shared-patterns.js';

export const complianceRules: BusinessRule[] = [
  // ============================================================================
  // GDPR COMPLIANCE RULES
  // ============================================================================
  {
    id: 'gdpr-001',
    name: 'GDPR - Data Subject Access Request',
    description: 'Ensures proper handling of data subject access requests',
    type: 'compliance',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'personal_data' },
      { field: 'requestType', operator: 'equals', value: 'subject_access' },
      { field: 'verificationCompleted', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'GDPR: Identity verification required before processing DSAR' }
    ],
    riskWeight: 40,
    tags: ['gdpr', 'dsar', 'privacy']
  },
  {
    id: 'gdpr-002',
    name: 'GDPR - Cross-Border Data Transfer',
    description: 'Requires approval for transferring data outside approved regions',
    type: 'compliance',
    enabled: true,
    priority: 920,
    conditions: [
      { field: 'actionCategory', operator: 'in', value: ['data_access', 'data_modification'] },
      { field: 'destinationRegion', operator: 'not_in', value: ['EU', 'EEA', 'adequacy_decision'] },
      { field: 'dataContainsPII', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'GDPR: Cross-border PII transfer requires DPO approval' },
      { type: 'log' }
    ],
    riskWeight: 50,
    tags: ['gdpr', 'cross-border', 'data-transfer']
  },
  {
    id: 'gdpr-003',
    name: 'GDPR - Data Retention Limit',
    description: 'Prevents access to data beyond retention period',
    type: 'compliance',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_access' },
      { field: 'dataRetentionExceeded', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'GDPR: Data has exceeded retention period and should be deleted' },
      { type: 'notify', message: 'GDPR violation: Attempt to access expired data' }
    ],
    riskWeight: 45,
    tags: ['gdpr', 'retention', 'data-lifecycle']
  },
  {
    id: 'gdpr-004',
    name: 'GDPR - Consent Verification',
    description: 'Ensures data processing has valid consent',
    type: 'compliance',
    enabled: true,
    priority: 910,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
      { field: 'processingBasis', operator: 'equals', value: 'consent' },
      { field: 'consentValid', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'GDPR: Valid consent required for this data processing activity' }
    ],
    riskWeight: 45,
    tags: ['gdpr', 'consent']
  },

  // ============================================================================
  // HIPAA COMPLIANCE RULES
  // ============================================================================
  // PHI Access Logging - uses shared audit pattern
  createDataTypeAuditRule({
    id: 'hipaa-001',
    name: 'HIPAA - PHI Access Logging',
    dataType: 'phi',
    framework: 'hipaa',
    priority: 950,
    riskWeight: 10
  }),
  {
    id: 'hipaa-002',
    name: 'HIPAA - Minimum Necessary Standard',
    description: 'Enforces minimum necessary access to PHI',
    type: 'compliance',
    enabled: true,
    priority: 920,
    conditions: [
      { field: 'dataType', operator: 'equals', value: 'phi' },
      { field: 'fieldsRequested', operator: 'greater_than', value: 10 },
      { field: 'businessJustification', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'require_approval', message: 'HIPAA: Broad PHI access requires business justification' }
    ],
    riskWeight: 35,
    tags: ['hipaa', 'minimum-necessary']
  },
  // PHI Encryption - uses shared encryption pattern
  createEncryptionRule({
    id: 'hipaa-003',
    name: 'HIPAA - PHI Encryption Requirement',
    description: 'Requires encryption for PHI in transit and at rest',
    encryptionType: 'data',
    scope: {
      category: 'data_access,data_modification,external_api',
      dataType: 'phi'
    },
    actionType: 'deny',
    message: 'HIPAA: PHI must be encrypted in transit and at rest',
    priority: 960,
    riskWeight: 55,
    tags: ['hipaa']
  }),

  // ============================================================================
  // PCI-DSS COMPLIANCE RULES
  // ============================================================================
  {
    id: 'pci-001',
    name: 'PCI-DSS - Cardholder Data Access',
    description: 'Restricts access to cardholder data',
    type: 'compliance',
    enabled: true,
    priority: 980,
    conditions: [
      { field: 'dataType', operator: 'equals', value: 'cardholder' },
      { field: 'userRole', operator: 'not_in', value: ['payment_processor', 'fraud_analyst', 'security_admin'] }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'PCI-DSS: Cardholder data access restricted to authorized roles' }
    ],
    riskWeight: 60,
    tags: ['pci-dss', 'cardholder-data']
  },
  {
    id: 'pci-002',
    name: 'PCI-DSS - Full PAN Display Prohibition',
    description: 'Prevents display of full Primary Account Number',
    type: 'compliance',
    enabled: true,
    priority: 970,
    conditions: [
      { field: 'actionName', operator: 'contains', value: 'display' },
      { field: 'dataType', operator: 'equals', value: 'pan' },
      { field: 'masked', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'PCI-DSS: Full PAN cannot be displayed - must be masked' }
    ],
    riskWeight: 55,
    tags: ['pci-dss', 'pan', 'masking']
  },
  {
    id: 'pci-003',
    name: 'PCI-DSS - CVV Storage Prohibition',
    description: 'Prevents storage of CVV/CVC codes',
    type: 'compliance',
    enabled: true,
    priority: 990,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'data_modification' },
      { field: 'operation', operator: 'in', value: ['write', 'store', 'save'] },
      { field: 'dataType', operator: 'equals', value: 'cvv' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'PCI-DSS: CVV/CVC storage is strictly prohibited' }
    ],
    riskWeight: 70,
    tags: ['pci-dss', 'cvv']
  },

  // ============================================================================
  // SOX COMPLIANCE RULES
  // ============================================================================
  {
    id: 'sox-001',
    name: 'SOX - Financial Data Modification Audit',
    description: 'Ensures all financial data changes are audited',
    type: 'compliance',
    enabled: true,
    priority: 940,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'financial' },
      { field: 'operation', operator: 'in', value: ['write', 'update', 'delete'] }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'log' },
      { type: 'require_approval', message: 'SOX: Financial data modification requires dual approval' }
    ],
    riskWeight: 45,
    tags: ['sox', 'financial', 'audit']
  },
  {
    id: 'sox-002',
    name: 'SOX - Segregation of Duties',
    description: 'Enforces segregation of duties for financial operations',
    type: 'compliance',
    enabled: true,
    priority: 930,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'financial' },
      { field: 'operation', operator: 'equals', value: 'approve' },
      { field: 'initiatorId', operator: 'equals', value: '$userId' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'SOX: Cannot approve own financial transactions (segregation of duties)' }
    ],
    riskWeight: 50,
    tags: ['sox', 'segregation-of-duties']
  },

  // ============================================================================
  // GENERAL COMPLIANCE RULES
  // ============================================================================
  // Audit Trail - uses shared audit pattern with standard categories
  createAuditLoggingRule({
    id: 'comp-001',
    name: 'Audit Trail Requirement',
    description: 'Ensures all significant actions are logged',
    categories: AUDIT_CATEGORIES,
    priority: 800,
    riskWeight: 5,
    tags: []
  }),
  {
    id: 'comp-002',
    name: 'Data Classification Requirement',
    description: 'Requires data classification before processing',
    type: 'compliance',
    enabled: true,
    priority: 820,
    conditions: [
      { field: 'actionCategory', operator: 'in', value: ['data_access', 'data_modification'] },
      { field: 'dataClassification', operator: 'not_exists', value: null }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Data classification should be specified for audit purposes' }
    ],
    riskWeight: 15,
    tags: ['classification', 'governance']
  },
  {
    id: 'comp-003',
    name: 'Business Hours Processing',
    description: 'Flags after-hours processing for review',
    type: 'compliance',
    enabled: true,
    priority: 700,
    conditions: [
      { field: 'actionCategory', operator: 'equals', value: 'financial' },
      { field: '', operator: 'custom', value: null, customEvaluator: 'businessHours' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'After-hours financial processing - flagged for review' }
    ],
    riskWeight: 20,
    tags: ['business-hours', 'review']
  }
];

export default complianceRules;
