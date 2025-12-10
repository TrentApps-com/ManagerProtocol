/**
 * Enterprise Agent Supervisor
 *
 * A comprehensive governance framework for AI agents providing:
 * - Action evaluation and risk scoring
 * - Business rule enforcement
 * - Human-in-the-loop approval workflows
 * - Comprehensive audit logging
 * - Rate limiting and abuse prevention
 *
 * @module @managerprotocol/agent-supervisor
 */

// Core types
export * from './types/index.js';

// Engine components
export {
  RulesEngine,
  rulesEngine,
  RateLimiter,
  rateLimiter,
  AuditLogger,
  auditLogger,
  type AuditLoggerOptions,
  ApprovalManager,
  approvalManager,
  type ApprovalManagerOptions
} from './engine/index.js';

// Built-in rules
export {
  securityRules,
  complianceRules,
  uxRules,
  architectureRules,
  operationalRules,
  allBuiltInRules,
  defaultRateLimits,
  rulePresets,
  getRulesByType,
  getRulesByTags,
  getRulesForCompliance
} from './rules/index.js';

// Main supervisor
export {
  AgentSupervisor,
  supervisor,
  type AgentSupervisorOptions
} from './supervisor/AgentSupervisor.js';

// MCP Server
export { server, startServer } from './server.js';
