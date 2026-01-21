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
  GitHubApprovalManager,
  type GitHubApprovalOptions,
  AppMonitor,
  appMonitor,
  type AppMonitorOptions
} from './engine/index.js';

// Built-in rules
export {
  securityRules,
  complianceRules,
  uxRules,
  architectureRules,
  operationalRules,
  cssRules,
  flaskRules,
  mlAiRules,
  storageRules,
  stripeRules,
  testingRules,
  azureRules,
  websocketRules,
  allBuiltInRules,
  defaultRateLimits,
  rulePresets,
  projectProfiles,
  getRulesByType,
  getRulesByTags,
  getRulesForCompliance,
  getCSSRules,
  getFrontendRules,
  getRulesByProfile,
  getRulesByPriority,
  getRuleSummary,
  listProjectProfiles
} from './rules/index.js';

// Analyzers
export {
  CSSAnalyzer,
  cssAnalyzer,
  type CSSRule,
  type CSSAnalysisContext,
  type CSSSuggestion,
  type CSSAnalysisResult
} from './analyzers/index.js';

// Design System
export {
  type DesignToken,
  colorTokens,
  spacingTokens,
  fontSizeTokens,
  lineHeightTokens,
  radiusTokens,
  borderWidthTokens,
  shadowTokens,
  typographyTokens,
  zIndexTokens,
  transitionTokens,
  easingTokens,
  breakpointTokens,
  allTokens,
  valueToTokenMap,
  findMatchingToken,
  suggestToken,
  getRecommendedTokens,
  designSystem
} from './design-system/index.js';

// Main supervisor
export {
  AgentSupervisor,
  supervisor,
  type AgentSupervisorOptions
} from './supervisor/AgentSupervisor.js';

// Utilities
export {
  AgentSupervisorError,
  RuleValidationError,
  RuleNotFoundError,
  RateLimitExceededError,
  ApprovalNotFoundError,
  ApprovalExpiredError,
  ConfigurationError,
  WebhookDeliveryError,
  withRetry,
  isAgentSupervisorError,
  formatError,
  safeStringify,
  type RetryOptions
} from './utils/index.js';

// MCP Server
export { server, startServer } from './server.js';
