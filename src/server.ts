/**
 * Enterprise Agent Supervisor - MCP Server
 *
 * Model Context Protocol server exposing agent governance tools.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type Tool
} from '@modelcontextprotocol/sdk/types.js';
import { AgentSupervisor } from './supervisor/AgentSupervisor.js';
import { projectTracker } from './supervisor/ProjectTracker.js';
import { rulePresets } from './rules/index.js';
import { taskManager } from './engine/TaskManager.js';
import { cssAnalyzer, type CSSAnalysisContext, type CSSRule } from './analyzers/index.js';
import { z } from 'zod';
import {
  AgentActionSchema,
  BusinessContextSchema,
  BusinessRuleSchema,
  RateLimitConfigSchema,
  AuditEventTypeSchema,
  type SupervisorConfig
} from './types/index.js';

// Initialize supervisor
const supervisor = new AgentSupervisor({
  config: {
    environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development'
  },
  auditOptions: {
    enableConsoleLog: process.env.DEBUG === 'true',
    dbPath: process.env.AUDIT_DB_PATH || './data/audit.db'
  }
});

// ============================================================================
// COMPACT RESPONSE HELPERS - Keep MCP responses concise
// ============================================================================

/** Compact JSON (no pretty printing) */
const json = (obj: unknown) => JSON.stringify(obj);

/** MCP text response wrapper */
const resp = (obj: unknown) => ({ content: [{ type: 'text' as const, text: json(obj) }] });

/** Slim task: only essential fields */
const slimTask = (t: any) => ({
  id: t.id,
  title: t.title,
  status: t.status,
  priority: t.priority,
  labels: t.labels,
  url: t.metadata?.url
});

/** Slim evaluation result */
const slimEval = (r: any) => ({
  status: r.status,
  riskScore: r.riskScore,
  riskLevel: r.riskLevel,
  allowed: r.allowed,
  requiresHumanApproval: r.requiresHumanApproval,
  violations: r.violations?.map((v: any) => ({ rule: v.ruleId, msg: v.message })),
  warnings: r.warnings
});

// ============================================================================
// MCP TOOL ARGUMENT VALIDATION SCHEMAS
// ============================================================================

const EvaluateActionArgsSchema = z.object({
  action: AgentActionSchema,
  context: BusinessContextSchema.optional()
});

const ApplyBusinessRulesArgsSchema = z.object({
  context: BusinessContextSchema
});

const RequireHumanApprovalArgsSchema = z.object({
  reason: z.string(),
  actionId: z.string().optional(),
  details: z.string().optional(),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).optional(),
  riskScore: z.number().min(0).max(100).optional(),
  context: BusinessContextSchema.optional(),
  metadata: z.record(z.unknown()).optional()
});

const LogEventArgsSchema = z.object({
  action: z.string(),
  eventType: AuditEventTypeSchema.optional(),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  outcome: z.enum(['success', 'failure', 'pending']).optional(),
  metadata: z.record(z.unknown()).optional()
});

const AddRuleArgsSchema = z.object({
  rule: BusinessRuleSchema
});

const LoadPresetArgsSchema = z.object({
  preset: z.enum(['minimal', 'standard', 'strict', 'financial', 'healthcare', 'development'])
});

const GetAuditEventsArgsSchema = z.object({
  eventType: AuditEventTypeSchema.optional(),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  outcome: z.enum(['success', 'failure', 'pending']).optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  limit: z.number().min(1).max(1000).optional()
});

const UpdateConfigArgsSchema = z.object({
  strictMode: z.boolean().optional(),
  defaultRiskThreshold: z.number().min(0).max(100).optional(),
  requireApprovalAboveRisk: z.number().min(0).max(100).optional(),
  features: z.object({
    riskScoring: z.boolean(),
    rateLimiting: z.boolean(),
    auditLogging: z.boolean(),
    humanApproval: z.boolean(),
    complianceChecks: z.boolean(),
    uxValidation: z.boolean(),
    architectureValidation: z.boolean()
  }).partial().optional()
});

const AddRateLimitArgsSchema = z.object({
  config: RateLimitConfigSchema
});

const AddMonitoredAppArgsSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  port: z.number().min(1).max(65535),
  description: z.string().optional(),
  healthEndpoint: z.string().optional(),
  expectedResponseCode: z.number().optional(),
  checkIntervalMs: z.number().min(5000).optional(),
  timeoutMs: z.number().min(1000).optional(),
  autoStart: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});

const UpdateMonitoredAppArgsSchema = z.object({
  appId: z.string(),
  updates: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    healthEndpoint: z.string().optional(),
    expectedResponseCode: z.number().optional(),
    checkIntervalMs: z.number().min(5000).optional(),
    timeoutMs: z.number().min(1000).optional(),
    enabled: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional()
  })
});

const ExportAuditLogArgsSchema = z.object({
  since: z.string().optional(),
  until: z.string().optional(),
  eventType: AuditEventTypeSchema.optional()
});

const GetAppStatusArgsSchema = z.object({
  appId: z.string().optional(),
  appName: z.string().optional(),
  historyLimit: z.number().optional()
}).refine(data => data.appId || data.appName, {
  message: "Either appId or appName must be provided"
});

const CheckAppHealthArgsSchema = z.object({
  appId: z.string().optional(),
  appName: z.string().optional()
}).refine(data => data.appId || data.appName, {
  message: "Either appId or appName must be provided"
});

const ApproveRequestArgsSchema = z.object({
  requestId: z.string(),
  approverId: z.string(),
  comments: z.string().optional(),
  repo: z.string().optional()
});

const DenyRequestArgsSchema = z.object({
  requestId: z.string(),
  denierId: z.string(),
  reason: z.string().optional(),
  repo: z.string().optional()
});

const RemoveRuleArgsSchema = z.object({
  ruleId: z.string()
});

const GetAuditStatsArgsSchema = z.object({
  since: z.string().optional()
});

const RemoveMonitoredAppArgsSchema = z.object({
  appId: z.string()
});

const SetAppMonitoringEnabledArgsSchema = z.object({
  appId: z.string(),
  enabled: z.boolean()
});

const GetAppLogsArgsSchema = z.object({
  appId: z.string().optional(),
  appName: z.string().optional(),
  lines: z.number().optional()
}).refine(data => data.appId || data.appName, {
  message: "Either appId or appName must be provided"
});

const GetAppStatusHistoryArgsSchema = z.object({
  appId: z.string().optional(),
  appName: z.string().optional(),
  limit: z.number().optional()
}).refine(data => data.appId || data.appName, {
  message: "Either appId or appName must be provided"
});

// Task management schemas
const CreateTaskArgsSchema = z.object({
  projectName: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  assignee: z.string().optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.number().optional(),
  parentTaskId: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  needsApproval: z.boolean().optional()
});

const GetTasksArgsSchema = z.object({
  projectName: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  assignee: z.string().optional(),
  labels: z.array(z.string()).optional()
});

const GetTaskArgsSchema = z.object({
  projectName: z.string().optional(),
  taskId: z.string()
});

const UpdateTaskArgsSchema = z.object({
  projectName: z.string().optional(),
  taskId: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled']).optional(),
  assignee: z.string().optional(),
  labels: z.array(z.string()).optional(),
  comment: z.string().optional(),
  commits: z.array(z.string()).optional()
});

const UpdateTaskStatusArgsSchema = z.object({
  projectName: z.string().optional(),
  taskId: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled'])
});

const AddTaskCommentArgsSchema = z.object({
  projectName: z.string().optional(),
  taskId: z.string(),
  comment: z.string().optional(),
  commits: z.array(z.string()).optional()
});

const LinkCommitsArgsSchema = z.object({
  projectName: z.string().optional(),
  taskId: z.string(),
  commits: z.array(z.string()),
  message: z.string().optional()
});

const CloseTaskWithCommentArgsSchema = z.object({
  projectName: z.string().optional(),
  taskId: z.string(),
  resolution: z.string(),
  commits: z.array(z.string()).optional()
});

const SearchTasksArgsSchema = z.object({
  query: z.string(),
  projectName: z.string().optional()
});

// Define MCP tools
const tools: Tool[] = [
  // ============================================================================
  // CORE GOVERNANCE TOOLS
  // ============================================================================
  {
    name: 'evaluate_action',
    description: `Evaluate an agent action against governance rules. Returns risk score, approval status, violations, and recommendations.

Use this BEFORE executing any significant agent action to ensure compliance and safety.

Returns:
- status: approved | denied | pending_approval | rate_limited | requires_review
- riskScore: 0-100 numeric score
- riskLevel: critical | high | medium | low | minimal
- violations: Array of rule violations
- warnings: Array of warnings
- requiresHumanApproval: Whether human approval is needed`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'object',
          description: 'The agent action to evaluate',
          properties: {
            name: { type: 'string', description: 'Name of the action (e.g., "read_file", "call_api")' },
            category: {
              type: 'string',
              enum: ['data_access', 'data_modification', 'external_api', 'file_system', 'code_execution', 'network', 'authentication', 'authorization', 'financial', 'pii_access', 'system_config', 'user_communication', 'resource_allocation', 'custom'],
              description: 'Category of the action'
            },
            description: { type: 'string', description: 'Human-readable description' },
            parameters: { type: 'object', description: 'Action parameters/arguments' },
            agentId: { type: 'string', description: 'ID of the agent performing action' },
            sessionId: { type: 'string', description: 'Current session ID' },
            metadata: { type: 'object', description: 'Additional metadata' }
          },
          required: ['name', 'category']
        },
        context: {
          type: 'object',
          description: 'Business context for evaluation',
          properties: {
            environment: { type: 'string', enum: ['development', 'staging', 'production'] },
            agentId: { type: 'string' },
            agentType: { type: 'string' },
            userId: { type: 'string' },
            userRole: { type: 'string' },
            sessionId: { type: 'string' },
            organizationId: { type: 'string' },
            department: { type: 'string' },
            dataClassification: { type: 'string', enum: ['public', 'internal', 'confidential', 'restricted'] },
            complianceFrameworks: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      required: ['action']
    }
  },
  {
    name: 'apply_business_rules',
    description: `Apply business rules to a context to determine constraints and recommendations.

Use this to understand what rules apply to a given operational context before taking actions.

Returns:
- rulesApplied: Which rules matched
- constraints: Active constraints (prohibitions, requirements)
- recommendations: Suggested best practices
- aggregateRiskScore: Overall risk assessment`,
    inputSchema: {
      type: 'object',
      properties: {
        context: {
          type: 'object',
          description: 'Business context to evaluate',
          properties: {
            environment: { type: 'string', enum: ['development', 'staging', 'production'] },
            agentId: { type: 'string' },
            agentType: { type: 'string' },
            userId: { type: 'string' },
            userRole: { type: 'string' },
            sessionId: { type: 'string' },
            organizationId: { type: 'string' },
            department: { type: 'string' },
            costCenter: { type: 'string' },
            dataClassification: { type: 'string', enum: ['public', 'internal', 'confidential', 'restricted'] },
            complianceFrameworks: { type: 'array', items: { type: 'string' } },
            customAttributes: { type: 'object' }
          }
        }
      },
      required: ['context']
    }
  },
  {
    name: 'require_human_approval',
    description: `Request human approval for an action that requires oversight.

Use when an action is high-risk, outside normal parameters, or governance rules require human-in-the-loop.

Returns approval request ID that can be checked later.`,
    inputSchema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why human approval is needed' },
        actionId: { type: 'string', description: 'ID of the action requiring approval' },
        details: { type: 'string', description: 'Detailed explanation for approver' },
        priority: {
          type: 'string',
          enum: ['urgent', 'high', 'normal', 'low'],
          description: 'Priority of approval request'
        },
        context: {
          type: 'object',
          description: 'Business context'
        },
        riskScore: { type: 'number', minimum: 0, maximum: 100, description: 'Risk score if known' },
        metadata: { type: 'object', description: 'Additional metadata' }
      },
      required: ['reason']
    }
  },
  {
    name: 'log_event',
    description: `Log an audit event for compliance and observability.

Use to record significant actions, decisions, and outcomes for audit trail.

All logged events are queryable and exportable.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Name/description of the action being logged' },
        eventType: {
          type: 'string',
          enum: ['action_evaluated', 'action_approved', 'action_denied', 'action_executed', 'rule_triggered', 'approval_requested', 'approval_granted', 'approval_denied', 'rate_limit_hit', 'security_alert', 'compliance_violation', 'config_changed', 'system_event', 'custom'],
          description: 'Type of event'
        },
        outcome: {
          type: 'string',
          enum: ['success', 'failure', 'pending'],
          description: 'Outcome of the action'
        },
        agentId: { type: 'string' },
        sessionId: { type: 'string' },
        userId: { type: 'string' },
        metadata: { type: 'object', description: 'Additional metadata to log' }
      },
      required: ['action']
    }
  },

  // ============================================================================
  // APPROVAL MANAGEMENT TOOLS
  // ============================================================================
  {
    name: 'check_approval_status',
    description: 'Check the status of a pending approval request',
    inputSchema: {
      type: 'object',
      properties: {
        requestId: { type: 'string', description: 'ID of the approval request' },
        issueNumber: { type: 'number', description: 'GitHub issue number (alternative to requestId)' },
        repo: { type: 'string', description: 'Repository in owner/repo format (required for GitHub-based approvals)' }
      }
    }
  },
  {
    name: 'list_pending_approvals',
    description: 'List all pending approval requests',
    inputSchema: {
      type: 'object',
      properties: {
        priority: { type: 'string', enum: ['urgent', 'high', 'normal', 'low'] },
        agentId: { type: 'string' },
        minRiskScore: { type: 'number', minimum: 0, maximum: 100 },
        repo: { type: 'string', description: 'Repository in owner/repo format (required for GitHub-based approvals)' }
      }
    }
  },
  {
    name: 'approve_request',
    description: 'Approve a pending approval request (requires approver privileges)',
    inputSchema: {
      type: 'object',
      properties: {
        requestId: { type: 'string', description: 'ID of the request to approve (or issue number)' },
        approverId: { type: 'string', description: 'ID of the approver' },
        comments: { type: 'string', description: 'Approval comments' },
        repo: { type: 'string', description: 'Repository in owner/repo format (required for GitHub-based approvals)' }
      },
      required: ['requestId', 'approverId']
    }
  },
  {
    name: 'deny_request',
    description: 'Deny a pending approval request',
    inputSchema: {
      type: 'object',
      properties: {
        requestId: { type: 'string', description: 'ID of the request to deny (or issue number)' },
        denierId: { type: 'string', description: 'ID of the denier' },
        reason: { type: 'string', description: 'Reason for denial' },
        repo: { type: 'string', description: 'Repository in owner/repo format (required for GitHub-based approvals)' }
      },
      required: ['requestId', 'denierId']
    }
  },

  // ============================================================================
  // RULE MANAGEMENT TOOLS
  // ============================================================================
  {
    name: 'list_rules',
    description: `List configured governance rules with advanced filtering.

IMPORTANT: Use filtering to reduce result size. Without filters, returns 190+ rules!

Filters:
- profile: Get rules for specific tech stack (flask, dotnet-azure, react, playwright, ml-ai, stripe, websocket, fullstack, api)
- preset: Use predefined rule sets (minimal, standard, strict, financial, healthcare, development, frontend)
- type: Filter by rule category
- enabled: Filter by enabled status
- tags: Filter by tags array
- minPriority: Minimum priority threshold (0-1000)
- maxPriority: Maximum priority threshold
- limit: Limit number of results (default: 50, max: 200)
- summary: Return summary only (rule counts by type)`,
    inputSchema: {
      type: 'object',
      properties: {
        profile: {
          type: 'string',
          enum: ['flask', 'dotnet-azure', 'react', 'playwright', 'ml-ai', 'stripe', 'websocket', 'fullstack', 'api'],
          description: 'Filter by project profile/tech stack'
        },
        preset: {
          type: 'string',
          enum: ['minimal', 'standard', 'strict', 'financial', 'healthcare', 'development', 'frontend'],
          description: 'Use predefined rule preset'
        },
        type: {
          type: 'string',
          enum: ['compliance', 'security', 'operational', 'financial', 'ux', 'architecture', 'data_governance', 'rate_limit', 'custom'],
          description: 'Filter by rule type'
        },
        enabled: { type: 'boolean', description: 'Filter by enabled status' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
        minPriority: { type: 'number', minimum: 0, maximum: 1000, description: 'Minimum priority threshold' },
        maxPriority: { type: 'number', minimum: 0, maximum: 1000, description: 'Maximum priority threshold' },
        limit: { type: 'number', minimum: 1, maximum: 200, description: 'Limit number of results (default: 50)' },
        summary: { type: 'boolean', description: 'Return summary only (counts by type)' }
      }
    }
  },
  {
    name: 'list_project_profiles',
    description: `List available project profiles with tech stack information.

Returns available profiles you can use with list_rules(profile=...) to get relevant rules for your project.

Profiles include: flask, dotnet-azure, react, playwright, ml-ai, stripe, websocket, fullstack, api`,
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'discover_relevant_rules',
    description: `Analyze a project directory and suggest relevant rule profiles based on detected technologies.

Scans package.json, *.csproj, requirements.txt, and other config files to detect tech stack.

Returns:
- detectedTechnologies: Array of detected technologies
- recommendedProfiles: Array of suggested project profiles
- ruleCount: Total number of relevant rules
- priorities: Suggested priority order for implementation`,
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to project directory (e.g., /path/to/my-project)'
        },
        autoDetect: {
          type: 'boolean',
          description: 'Auto-detect technologies from project files (default: true)'
        }
      },
      required: ['projectPath']
    }
  },
  {
    name: 'add_rule',
    description: 'Add a custom governance rule',
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string', enum: ['compliance', 'security', 'operational', 'financial', 'ux', 'architecture', 'data_governance', 'rate_limit', 'custom'] },
            enabled: { type: 'boolean' },
            priority: { type: 'number', minimum: 0, maximum: 1000 },
            conditions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  operator: { type: 'string', enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'in', 'not_in', 'matches_regex', 'exists', 'not_exists', 'custom'] },
                  value: {}
                }
              }
            },
            conditionLogic: { type: 'string', enum: ['all', 'any'] },
            actions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['allow', 'deny', 'require_approval', 'warn', 'log', 'rate_limit', 'transform', 'escalate', 'notify'] },
                  message: { type: 'string' }
                }
              }
            },
            riskWeight: { type: 'number', minimum: 0, maximum: 100 },
            tags: { type: 'array', items: { type: 'string' } }
          },
          required: ['id', 'name', 'type', 'conditions', 'actions']
        }
      },
      required: ['rule']
    }
  },
  {
    name: 'remove_rule',
    description: 'Remove a governance rule',
    inputSchema: {
      type: 'object',
      properties: {
        ruleId: { type: 'string', description: 'ID of the rule to remove' }
      },
      required: ['ruleId']
    }
  },
  {
    name: 'load_preset',
    description: 'Load a predefined rule preset (minimal, standard, strict, financial, healthcare, development)',
    inputSchema: {
      type: 'object',
      properties: {
        preset: {
          type: 'string',
          enum: ['minimal', 'standard', 'strict', 'financial', 'healthcare', 'development'],
          description: 'Preset to load'
        }
      },
      required: ['preset']
    }
  },

  // ============================================================================
  // AUDIT & REPORTING TOOLS
  // ============================================================================
  {
    name: 'get_audit_events',
    description: 'Query audit events with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        eventType: { type: 'string' },
        agentId: { type: 'string' },
        sessionId: { type: 'string' },
        userId: { type: 'string' },
        outcome: { type: 'string', enum: ['success', 'failure', 'pending'] },
        since: { type: 'string', format: 'date-time' },
        until: { type: 'string', format: 'date-time' },
        limit: { type: 'number', minimum: 1, maximum: 1000 }
      }
    }
  },
  {
    name: 'get_audit_stats',
    description: 'Get audit statistics summary',
    inputSchema: {
      type: 'object',
      properties: {
        since: { type: 'string', format: 'date-time', description: 'Start time for stats' }
      }
    }
  },
  {
    name: 'get_approval_stats',
    description: 'Get approval workflow statistics',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'export_audit_log',
    description: 'Export audit log as JSON',
    inputSchema: {
      type: 'object',
      properties: {
        since: { type: 'string', format: 'date-time' },
        until: { type: 'string', format: 'date-time' },
        eventType: { type: 'string' }
      }
    }
  },

  // ============================================================================
  // CONFIGURATION TOOLS
  // ============================================================================
  {
    name: 'get_config',
    description: 'Get current supervisor configuration',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'update_config',
    description: 'Update supervisor configuration',
    inputSchema: {
      type: 'object',
      properties: {
        strictMode: { type: 'boolean' },
        defaultRiskThreshold: { type: 'number', minimum: 0, maximum: 100 },
        requireApprovalAboveRisk: { type: 'number', minimum: 0, maximum: 100 },
        features: {
          type: 'object',
          properties: {
            riskScoring: { type: 'boolean' },
            rateLimiting: { type: 'boolean' },
            auditLogging: { type: 'boolean' },
            humanApproval: { type: 'boolean' },
            complianceChecks: { type: 'boolean' },
            uxValidation: { type: 'boolean' },
            architectureValidation: { type: 'boolean' }
          }
        }
      }
    }
  },

  // ============================================================================
  // RATE LIMITING TOOLS
  // ============================================================================
  {
    name: 'check_rate_limit',
    description: 'Check rate limit status for an action',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        sessionId: { type: 'string' },
        userId: { type: 'string' },
        actionCategory: { type: 'string' }
      }
    }
  },
  {
    name: 'add_rate_limit',
    description: 'Add a rate limit configuration',
    inputSchema: {
      type: 'object',
      properties: {
        config: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            windowMs: { type: 'number', minimum: 1000 },
            maxRequests: { type: 'number', minimum: 1 },
            scope: { type: 'string', enum: ['global', 'agent', 'session', 'user', 'action_type'] },
            actionCategories: { type: 'array', items: { type: 'string' } },
            burstLimit: { type: 'number' },
            enabled: { type: 'boolean' }
          },
          required: ['id', 'name', 'windowMs', 'maxRequests', 'scope']
        }
      },
      required: ['config']
    }
  },

  // ============================================================================
  // RISK ASSESSMENT TOOLS
  // ============================================================================
  {
    name: 'calculate_risk_score',
    description: 'Calculate risk score for a hypothetical action without recording it',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            category: { type: 'string' },
            parameters: { type: 'object' }
          },
          required: ['name', 'category']
        },
        context: { type: 'object' }
      },
      required: ['action']
    }
  },

  // ============================================================================
  // HEALTH & STATUS TOOLS
  // ============================================================================
  {
    name: 'health_check',
    description: 'Check supervisor health and status',
    inputSchema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Optional repository to check pending approvals for (format: owner/repo)'
        }
      }
    }
  },

  // ============================================================================
  // CSS EVALUATION TOOLS
  // ============================================================================
  {
    name: 'css_eval',
    description: `Evaluate a new CSS rule before adding it. Checks for:

- **Duplicates**: Finds existing rules that could be reused instead
- **Externalization**: Recommends moving inline/style-tag CSS to external files
- **Globalization**: Identifies patterns that should be global styles
- **Removables**: Finds existing CSS that can be safely removed
- **Variables**: Suggests CSS custom properties for colors, spacing, typography
- **Utilities**: Recommends utility classes when a utility framework is available
- **Specificity**: Warns about ID selectors, deep nesting, !important
- **Naming**: Suggests BEM naming and semantic class names
- **Accessibility**: Checks focus styles, outline removal, motion preferences

Use this BEFORE creating any new CSS rule (inline styles, style tags, or stylesheets).

Returns:
- shouldExternalize: Whether to move to external file
- shouldMakeGlobal: Whether to add to global styles
- duplicates: Existing rules that match
- suggestions: Prioritized list of improvements
- removableCandidates: CSS rules that can be removed
- riskScore: 0-100 based on violations
- summary: Human-readable summary`,
    inputSchema: {
      type: 'object',
      properties: {
        newRule: {
          type: 'object',
          description: 'The CSS rule being added',
          properties: {
            selector: { type: 'string', description: 'CSS selector (e.g., ".my-class", "#my-id")' },
            properties: {
              type: 'object',
              description: 'CSS properties as key-value pairs',
              additionalProperties: { type: 'string' }
            },
            source: {
              type: 'string',
              enum: ['inline', 'style_tag', 'external', 'unknown'],
              description: 'Where this CSS is being added'
            },
            file: { type: 'string', description: 'File path if known' },
            line: { type: 'number', description: 'Line number if known' }
          },
          required: ['selector', 'properties', 'source']
        },
        existingRules: {
          type: 'array',
          description: 'Existing CSS rules to check for duplicates',
          items: {
            type: 'object',
            properties: {
              selector: { type: 'string' },
              properties: { type: 'object', additionalProperties: { type: 'string' } },
              source: { type: 'string', enum: ['inline', 'style_tag', 'external', 'unknown'] },
              file: { type: 'string' },
              line: { type: 'number' }
            }
          }
        },
        context: {
          type: 'object',
          description: 'Project context for better analysis',
          properties: {
            projectType: {
              type: 'string',
              enum: ['spa', 'mpa', 'component_library', 'website'],
              description: 'Type of project'
            },
            framework: {
              type: 'string',
              enum: ['react', 'vue', 'angular', 'svelte', 'vanilla', 'other'],
              description: 'Frontend framework in use'
            },
            hasStyleSystem: {
              type: 'boolean',
              description: 'Whether a utility CSS framework (Tailwind, etc.) is available'
            },
            styleSystemName: {
              type: 'string',
              description: 'Name of the style system (e.g., "tailwind", "bootstrap")'
            },
            globalStylesFile: {
              type: 'string',
              description: 'Path to global styles file'
            },
            componentName: {
              type: 'string',
              description: 'Name of component this CSS belongs to'
            }
          }
        }
      },
      required: ['newRule']
    }
  },
  {
    name: 'analyze_css_cleanup',
    description: `Analyze existing CSS for cleanup opportunities.

Finds:
- Duplicate/redundant rules
- Unused CSS candidates
- Rules that should be consolidated
- Opportunities to use CSS variables
- Specificity issues

Provide existing rules and get a cleanup report.`,
    inputSchema: {
      type: 'object',
      properties: {
        rules: {
          type: 'array',
          description: 'Existing CSS rules to analyze',
          items: {
            type: 'object',
            properties: {
              selector: { type: 'string' },
              properties: { type: 'object', additionalProperties: { type: 'string' } },
              source: { type: 'string', enum: ['inline', 'style_tag', 'external', 'unknown'] },
              file: { type: 'string' },
              line: { type: 'number' }
            },
            required: ['selector', 'properties']
          }
        },
        context: {
          type: 'object',
          properties: {
            framework: { type: 'string' },
            hasStyleSystem: { type: 'boolean' }
          }
        }
      },
      required: ['rules']
    }
  },
  {
    name: 'suggest_css_variables',
    description: `Analyze CSS for values that should be CSS custom properties.

Identifies:
- Color values that should be variables
- Spacing values that should be tokenized
- Typography values for consistency
- Animation durations and easings

Returns variable suggestions with recommended names.`,
    inputSchema: {
      type: 'object',
      properties: {
        rules: {
          type: 'array',
          description: 'CSS rules to analyze for variable opportunities',
          items: {
            type: 'object',
            properties: {
              selector: { type: 'string' },
              properties: { type: 'object', additionalProperties: { type: 'string' } }
            },
            required: ['selector', 'properties']
          }
        }
      },
      required: ['rules']
    }
  },

  // ============================================================================
  // APP MONITORING TOOLS
  // ============================================================================
  {
    name: 'add_monitored_app',
    description: `Add a production application to monitor. The app must exist in /mnt/prod/ or at the specified absolute path.

Monitors:
- Port availability (is the app listening?)
- HTTP health endpoint (optional)
- Process info (PID, memory, CPU, uptime)
- Response times

Returns the created app configuration with initial health check.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Unique name for the app (e.g., "api-server", "web-app")' },
        path: { type: 'string', description: 'Path to app directory (relative to /mnt/prod/ or absolute)' },
        port: { type: 'number', minimum: 1, maximum: 65535, description: 'Port the app listens on' },
        description: { type: 'string', description: 'Description of what the app does' },
        healthEndpoint: { type: 'string', description: 'HTTP endpoint to check (e.g., "/health", "/api/health")' },
        expectedResponseCode: { type: 'number', description: 'Expected HTTP status code (default: 200)' },
        checkIntervalMs: { type: 'number', minimum: 5000, description: 'How often to check health in ms (default: 30000)' },
        timeoutMs: { type: 'number', minimum: 1000, description: 'Health check timeout in ms (default: 5000)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for grouping/filtering apps' },
        metadata: { type: 'object', description: 'Additional metadata' },
        autoStart: { type: 'boolean', description: 'Start monitoring immediately (default: true)' }
      },
      required: ['name', 'path', 'port']
    }
  },
  {
    name: 'remove_monitored_app',
    description: 'Remove an app from monitoring',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'ID of the app to remove' }
      },
      required: ['appId']
    }
  },
  {
    name: 'list_monitored_apps',
    description: 'List all monitored applications with their current status',
    inputSchema: {
      type: 'object',
      properties: {
        includeHealth: { type: 'boolean', description: 'Include last health check results (default: true)' },
        tag: { type: 'string', description: 'Filter by tag' }
      }
    }
  },
  {
    name: 'get_app_status',
    description: 'Get detailed status for a specific app including process info and health history',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'ID of the app' },
        appName: { type: 'string', description: 'Name of the app (alternative to appId)' },
        historyLimit: { type: 'number', description: 'Number of history entries to include (default: 10)' }
      }
    }
  },
  {
    name: 'check_app_health',
    description: 'Perform an immediate health check on a specific app',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'ID of the app' },
        appName: { type: 'string', description: 'Name of the app (alternative to appId)' }
      }
    }
  },
  {
    name: 'check_all_apps_health',
    description: 'Perform health checks on all monitored apps and return summary',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_app_monitor_stats',
    description: 'Get overall app monitoring statistics',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'update_monitored_app',
    description: 'Update configuration for a monitored app',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'ID of the app to update' },
        updates: {
          type: 'object',
          description: 'Fields to update',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            healthEndpoint: { type: 'string' },
            expectedResponseCode: { type: 'number' },
            checkIntervalMs: { type: 'number', minimum: 5000 },
            timeoutMs: { type: 'number', minimum: 1000 },
            enabled: { type: 'boolean' },
            tags: { type: 'array', items: { type: 'string' } },
            metadata: { type: 'object' }
          }
        }
      },
      required: ['appId', 'updates']
    }
  },
  {
    name: 'set_app_monitoring_enabled',
    description: 'Enable or disable monitoring for an app',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'ID of the app' },
        enabled: { type: 'boolean', description: 'Whether to enable monitoring' }
      },
      required: ['appId', 'enabled']
    }
  },
  {
    name: 'get_offline_apps',
    description: 'Get list of apps that are currently offline',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_degraded_apps',
    description: 'Get list of apps that are in degraded state (slow response or partial failure)',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'scan_prod_apps',
    description: 'Scan /mnt/prod/ directory for potential apps that can be monitored',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_app_logs',
    description: 'Get recent logs for a monitored app (from PM2, journalctl, or log files)',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'ID of the app' },
        appName: { type: 'string', description: 'Name of the app (alternative to appId)' },
        lines: { type: 'number', minimum: 1, maximum: 500, description: 'Number of log lines to retrieve (default: 50)' }
      }
    }
  },
  {
    name: 'get_app_status_history',
    description: 'Get status history for an app to see uptime patterns',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'ID of the app' },
        appName: { type: 'string', description: 'Name of the app (alternative to appId)' },
        limit: { type: 'number', minimum: 1, maximum: 1000, description: 'Number of history entries (default: 100)' }
      }
    }
  },

  // ============================================================================
  // SESSION MANAGEMENT TOOLS
  // ============================================================================
  {
    name: 'register_session',
    description: `Register a Claude session working on a project.

IMPORTANT: Call this at the START of working on a project to appear in the supervisor dashboard.

This explicitly registers your session for tracking. Without calling this, you won't show up in the agents list.

Use cases:
- Start of a Claude session: Register with project path and session info
- Scheduler spawning Claude: Register the spawned instance
- Service check-ins: Report that a service is active

Returns the registered agent info.`,
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Unique agent ID (e.g., "claude-{pid}", "scheduler", or generate one)'
        },
        sessionId: {
          type: 'string',
          description: 'Session ID for this work session'
        },
        projectPath: {
          type: 'string',
          description: 'Absolute path to the project directory'
        },
        agentType: {
          type: 'string',
          enum: ['claude', 'scheduler', 'service', 'manual'],
          description: 'Type of agent (claude=Claude instance, scheduler=Automated scheduler, service=Background service, manual=Human-initiated)'
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata (e.g., {task: "implement feature X", mode: "scan"})'
        }
      },
      required: ['agentId', 'sessionId', 'projectPath']
    }
  },
  {
    name: 'complete_session',
    description: `Mark a session as complete.

Call this at the END of your work session to properly close out tracking.

This marks your session as disconnected and will be cleaned up after retention period.`,
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Agent ID used in register_session'
        },
        outcome: {
          type: 'string',
          enum: ['success', 'failure', 'cancelled'],
          description: 'Outcome of the session'
        }
      },
      required: ['agentId']
    }
  },

  // ============================================================================
  // TASK MANAGEMENT TOOLS
  // ============================================================================
  {
    name: 'create_task',
    description: `Create a new task (GitHub Issue) for a project.

Use needsApproval: true for significant changes that require human approval before implementation.

Returns the created task with its GitHub issue number and URL.`,
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Repository in "owner/repo" format. Auto-detects if not provided.' },
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Detailed task description' },
        priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'], description: 'Task priority (default: medium)' },
        assignee: { type: 'string', description: 'GitHub username to assign (use "@me" for yourself)' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Additional labels (e.g., ["bug", "security"])' },
        dueDate: { type: 'string', description: 'Due date or milestone' },
        estimatedHours: { type: 'number', description: 'Estimated hours to complete' },
        parentTaskId: { type: 'string', description: 'Parent task ID for subtasks' },
        dependencies: { type: 'array', items: { type: 'string' }, description: 'Task IDs this task depends on' },
        metadata: { type: 'object', description: 'Additional metadata' },
        needsApproval: { type: 'boolean', description: 'Flag for significant changes requiring approval (adds needs-approval label)' }
      },
      required: ['title']
    }
  },
  {
    name: 'get_tasks',
    description: `Get all tasks for a project with optional filtering.

Filter by status, priority, assignee, or labels.`,
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Repository in "owner/repo" format. Auto-detects if not provided.' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'blocked', 'cancelled'], description: 'Filter by status' },
        priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'], description: 'Filter by priority' },
        assignee: { type: 'string', description: 'Filter by assignee' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Filter by labels' }
      }
    }
  },
  {
    name: 'get_pending_tasks',
    description: `Get all pending tasks for a project (excludes tasks with needs-approval label).

These are tasks ready to work on.`,
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Repository in "owner/repo" format. Auto-detects if not provided.' }
      }
    }
  },
  {
    name: 'get_approved_tasks',
    description: `Get all approved tasks ready to work on for a project.

Returns open tasks that do NOT have the 'needs-approval' label.
These are tasks that either never needed approval or have been approved.

Perfect for automated agents to find work to do.`,
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Repository in "owner/repo" format. Auto-detects if not provided.' }
      }
    }
  },
  {
    name: 'get_task',
    description: 'Get a specific task by ID (issue number)',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Repository in "owner/repo" format. Auto-detects if not provided.' },
        taskId: { type: 'string', description: 'Task ID (GitHub issue number)' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'update_task',
    description: `Update a task with new information.

Can update title, description, priority, status, assignee, labels, and add comments/commits.`,
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Repository in "owner/repo" format. Auto-detects if not provided.' },
        taskId: { type: 'string', description: 'Task ID (GitHub issue number)' },
        title: { type: 'string', description: 'New title' },
        description: { type: 'string', description: 'New description' },
        priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'], description: 'New priority' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'blocked', 'cancelled'], description: 'New status' },
        assignee: { type: 'string', description: 'New assignee' },
        labels: { type: 'array', items: { type: 'string' }, description: 'New labels' },
        comment: { type: 'string', description: 'Comment to add' },
        commits: { type: 'array', items: { type: 'string' }, description: 'Commit SHAs to link' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'update_task_status',
    description: 'Update the status of a task',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Repository in "owner/repo" format. Auto-detects if not provided.' },
        taskId: { type: 'string', description: 'Task ID (GitHub issue number)' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'blocked', 'cancelled'], description: 'New status' }
      },
      required: ['taskId', 'status']
    }
  },
  {
    name: 'add_task_comment',
    description: `Add a comment to a task with optional commit links.

Useful for documenting progress or linking related commits.`,
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Repository in "owner/repo" format. Auto-detects if not provided.' },
        taskId: { type: 'string', description: 'Task ID (GitHub issue number)' },
        comment: { type: 'string', description: 'Comment text' },
        commits: { type: 'array', items: { type: 'string' }, description: 'Commit SHAs to link' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'link_commits',
    description: `Link commits to a task by adding a comment with commit references.

Helps track which commits are related to a task.`,
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Repository in "owner/repo" format. Auto-detects if not provided.' },
        taskId: { type: 'string', description: 'Task ID (GitHub issue number)' },
        commits: { type: 'array', items: { type: 'string' }, description: 'Commit SHAs to link' },
        message: { type: 'string', description: 'Optional message to include' }
      },
      required: ['taskId', 'commits']
    }
  },
  {
    name: 'close_task_with_comment',
    description: `Close a task with a resolution comment and optional commit links.

IMPORTANT: Use this after completing work on a task to document what was done.`,
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Repository in "owner/repo" format. Auto-detects if not provided.' },
        taskId: { type: 'string', description: 'Task ID (GitHub issue number)' },
        resolution: { type: 'string', description: 'Resolution description (what was done to complete the task)' },
        commits: { type: 'array', items: { type: 'string' }, description: 'Commit SHAs related to this task' }
      },
      required: ['taskId', 'resolution']
    }
  },
  {
    name: 'delete_task',
    description: 'Delete a task (closes as "not planned")',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Repository in "owner/repo" format. Auto-detects if not provided.' },
        taskId: { type: 'string', description: 'Task ID (GitHub issue number)' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'list_projects',
    description: 'List all projects (repositories) with task counts',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_project_stats',
    description: 'Get task statistics for a project (total, by status, by priority, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Repository in "owner/repo" format. Auto-detects if not provided.' }
      }
    }
  },
  {
    name: 'search_tasks',
    description: 'Search tasks across projects using GitHub search syntax',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        projectName: { type: 'string', description: 'Optional: limit search to specific repository' }
      },
      required: ['query']
    }
  }
];

// Create and configure MCP server
const server = new Server(
  {
    name: 'agent-supervisor',
    version: '1.1.1'
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools
}));

// List resources handler
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'supervisor://rules/all',
      name: 'All Governance Rules',
      description: 'Complete list of all configured governance rules',
      mimeType: 'application/json'
    },
    {
      uri: 'supervisor://rules/presets',
      name: 'Rule Presets',
      description: 'Available rule presets and their configurations',
      mimeType: 'application/json'
    },
    {
      uri: 'supervisor://config',
      name: 'Supervisor Configuration',
      description: 'Current supervisor configuration',
      mimeType: 'application/json'
    },
    {
      uri: 'supervisor://stats',
      name: 'Supervisor Statistics',
      description: 'Current audit and approval statistics',
      mimeType: 'application/json'
    },
    {
      uri: 'supervisor://apps',
      name: 'Monitored Applications',
      description: 'All monitored production applications with their current status',
      mimeType: 'application/json'
    },
    {
      uri: 'supervisor://apps/stats',
      name: 'App Monitor Statistics',
      description: 'Overall app monitoring statistics',
      mimeType: 'application/json'
    }
  ]
}));

// Read resource handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'supervisor://rules/all':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(supervisor.getRules(), null, 2)
        }]
      };

    case 'supervisor://rules/presets':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            available: Object.keys(rulePresets),
            descriptions: {
              minimal: 'Basic security and logging only',
              standard: 'Balanced security and operations',
              strict: 'Full compliance and governance',
              financial: 'Optimized for financial services',
              healthcare: 'Optimized for healthcare (HIPAA)',
              development: 'Relaxed rules for development'
            }
          }, null, 2)
        }]
      };

    case 'supervisor://config':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(supervisor.getConfig(), null, 2)
        }]
      };

    case 'supervisor://stats':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            audit: supervisor.getAuditStats(),
            approvals: supervisor.getApprovalStats()
          }, null, 2)
        }]
      };

    case 'supervisor://apps': {
      const apps = supervisor.getAllMonitoredApps();
      const appsWithHealth = apps.map(app => ({
        ...app,
        currentStatus: supervisor.getLastAppHealthCheck(app.id)
      }));
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(appsWithHealth, null, 2)
        }]
      };
    }

    case 'supervisor://apps/stats':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(supervisor.getAppMonitorStats(), null, 2)
        }]
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  try {
    await supervisor.initialize();

    switch (name) {
      // Core governance tools
      case 'evaluate_action': {
        const validated = EvaluateActionArgsSchema.parse(args);
        const result = await supervisor.evaluateAction(validated.action, validated.context);
        return resp(slimEval(result));
      }

      case 'apply_business_rules': {
        const validated = ApplyBusinessRulesArgsSchema.parse(args);
        const result = await supervisor.applyBusinessRules(validated.context);
        // Slim: only return key constraints
        return resp({
          riskScore: result.aggregateRiskScore,
          rulesApplied: result.rulesApplied?.length || 0,
          constraints: result.constraints?.slice(0, 5),
          recommendations: result.recommendations?.slice(0, 3)
        });
      }

      case 'require_human_approval': {
        const validated = RequireHumanApprovalArgsSchema.parse(args);
        const result = await supervisor.requireHumanApproval(validated);
        return resp({ requestId: result.requestId, status: result.status, priority: result.priority });
      }

      case 'log_event': {
        const validated = LogEventArgsSchema.parse(args);
        const result = await supervisor.logEvent(validated);
        return resp({ eventId: result.eventId, logged: true });
      }

      // Approval management
      case 'check_approval_status': {
        const repo = typeof args?.repo === 'string' ? args.repo : undefined;
        const pending = await supervisor.getPendingApprovals(repo);
        const request = pending.find((r: any) => r.requestId === args?.requestId || r.issueNumber === args?.issueNumber);
        if (!request) return resp({ status: 'not_found' });
        return resp({ status: request.status, reason: request.reason, priority: request.priority });
      }

      case 'list_pending_approvals': {
        const repo = typeof args?.repo === 'string' ? args.repo : undefined;
        const approvals = await supervisor.getPendingApprovals(repo);
        return resp({ count: approvals.length, approvals: approvals.map((a: any) => ({ id: a.requestId, reason: a.reason, priority: a.priority })) });
      }

      case 'approve_request': {
        const validated = ApproveRequestArgsSchema.parse(args);
        const repo = typeof args?.repo === 'string' ? args.repo : undefined;
        await supervisor.approveRequest(validated.requestId, validated.approverId, validated.comments, repo);
        return resp({ approved: true, requestId: validated.requestId });
      }

      case 'deny_request': {
        const validated = DenyRequestArgsSchema.parse(args);
        const repo = typeof args?.repo === 'string' ? args.repo : undefined;
        await supervisor.denyRequest(validated.requestId, validated.denierId, validated.reason, repo);
        return resp({ denied: true, requestId: validated.requestId });
      }

      // Rule management
      case 'list_rules': {
        const { getRulesByProfile, getRuleSummary } = await import('./rules/index.js');
        let rules = supervisor.getRules();

        if (args?.profile) rules = getRulesByProfile(args.profile as any);
        else if (args?.preset) {
          const { rulePresets } = await import('./rules/index.js');
          const preset = rulePresets[args.preset as keyof typeof rulePresets];
          rules = preset ? preset.rules : rules;
        }
        if (args?.type) rules = rules.filter(r => r.type === args.type);
        if (args?.enabled !== undefined) rules = rules.filter(r => r.enabled === args.enabled);
        if (args?.tags && Array.isArray(args.tags)) {
          const tags = args.tags.filter((t): t is string => typeof t === 'string');
          rules = rules.filter(r => r.tags?.some(t => tags.includes(t)));
        }
        if (args?.minPriority !== undefined && typeof args.minPriority === 'number') {
          const min = args.minPriority;
          const max = args?.maxPriority;
          rules = rules.filter(r => max !== undefined && typeof max === 'number' ? r.priority >= min && r.priority <= max : r.priority >= min);
        }

        if (args?.summary) {
          const summary = getRuleSummary();
          return resp({ total: Object.values(summary).reduce((a, b) => a + b, 0), byType: summary });
        }

        const limit = Math.min(typeof args?.limit === 'number' ? args.limit : 50, 200);
        const slimRules = rules.slice(0, limit).map(r => ({ id: r.id, name: r.name, type: r.type, priority: r.priority }));
        return resp({ count: rules.length, showing: slimRules.length, rules: slimRules });
      }

      case 'list_project_profiles': {
        const { listProjectProfiles } = await import('./rules/index.js');
        const profiles = listProjectProfiles();
        return resp(profiles.map(p => ({ key: p.key, name: p.name, ruleCount: p.ruleCount })));
      }

      case 'discover_relevant_rules': {
        const fs = await import('fs/promises');
        const path = await import('path');
        const { projectProfiles } = await import('./rules/index.js');

        const projectPath = args?.projectPath as string;
        const autoDetect = args?.autoDetect !== false;

        if (!autoDetect) {
          return { content: [{ type: 'text', text: JSON.stringify({
            error: 'Manual detection not yet supported. Use autoDetect: true'
          }) }] };
        }

        const detectedTechnologies: string[] = [];
        const recommendedProfiles: string[] = [];

        try {
          // Check for package.json (Node.js/TypeScript)
          try {
            const packageJson = await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
            const pkg = JSON.parse(packageJson);
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

            if (allDeps['@playwright/test']) {
              detectedTechnologies.push('Playwright');
              recommendedProfiles.push('playwright');
            }
            if (allDeps['react'] || allDeps['next'] || allDeps['vue'] || allDeps['svelte']) {
              detectedTechnologies.push('React/Frontend');
              recommendedProfiles.push('react');
            }
            if (allDeps['express'] || allDeps['fastify'] || allDeps['koa']) {
              detectedTechnologies.push('Node.js API');
              recommendedProfiles.push('api');
            }
            if (allDeps['socket.io'] || allDeps['ws']) {
              detectedTechnologies.push('WebSocket');
              recommendedProfiles.push('websocket');
            }
          } catch {}

          // Check for requirements.txt (Python)
          try {
            const requirements = await fs.readFile(path.join(projectPath, 'requirements.txt'), 'utf-8');
            if (requirements.includes('flask')) {
              detectedTechnologies.push('Flask');
              recommendedProfiles.push('flask');
            }
            if (requirements.includes('torch') || requirements.includes('transformers') || requirements.includes('diffusers')) {
              detectedTechnologies.push('ML/AI (PyTorch)');
              recommendedProfiles.push('ml-ai');
            }
            if (requirements.includes('stripe')) {
              detectedTechnologies.push('Stripe');
              recommendedProfiles.push('stripe');
            }
            if (requirements.includes('flask-socketio') || requirements.includes('python-socketio')) {
              detectedTechnologies.push('WebSocket (Python)');
              recommendedProfiles.push('websocket');
            }
          } catch {}

          // Check for .csproj files (.NET/Azure)
          try {
            const files = await fs.readdir(projectPath);
            const csprojFiles = files.filter(f => f.endsWith('.csproj'));
            if (csprojFiles.length > 0) {
              detectedTechnologies.push('.NET/C#');

              // Check for Azure Functions
              for (const file of csprojFiles) {
                const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
                if (content.includes('Microsoft.Azure.Functions') || content.includes('Microsoft.NET.Sdk.Functions')) {
                  detectedTechnologies.push('Azure Functions');
                  recommendedProfiles.push('dotnet-azure');
                  break;
                }
              }
            }
          } catch {}

          // Deduplicate profiles
          const uniqueProfiles = [...new Set(recommendedProfiles)];

          // Calculate total rule count
          let totalRules = 0;
          uniqueProfiles.forEach(profile => {
            const profileConfig = projectProfiles[profile as keyof typeof projectProfiles];
            if (profileConfig) {
              totalRules += profileConfig.rules.length;
            }
          });

          return { content: [{ type: 'text', text: JSON.stringify({
            projectPath,
            detectedTechnologies,
            recommendedProfiles: uniqueProfiles,
            ruleCount: totalRules,
            priorities: {
              critical: uniqueProfiles.filter(p => ['stripe', 'ml-ai', 'flask'].includes(p)),
              high: uniqueProfiles.filter(p => ['dotnet-azure', 'websocket'].includes(p)),
              medium: uniqueProfiles.filter(p => ['playwright', 'react'].includes(p))
            },
            usage: `Use: list_rules(profile="${uniqueProfiles[0]}") to see relevant rules`
          }, null, 2) }] };

        } catch (error: any) {
          return { content: [{ type: 'text', text: JSON.stringify({
            error: 'Failed to analyze project',
            message: error.message,
            projectPath
          }) }] };
        }
      }

      case 'add_rule': {
        const validated = AddRuleArgsSchema.parse(args);
        supervisor.addRule(validated.rule);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, ruleId: validated.rule.id }) }] };
      }

      case 'remove_rule': {
        const validated = RemoveRuleArgsSchema.parse(args);
        const removed = supervisor.removeRule(validated.ruleId);
        return { content: [{ type: 'text', text: JSON.stringify({ success: removed }) }] };
      }

      case 'load_preset': {
        const validated = LoadPresetArgsSchema.parse(args);
        await supervisor.loadPreset(validated.preset);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, preset: validated.preset }) }] };
      }

      // Audit & reporting
      case 'get_audit_events': {
        const validated = GetAuditEventsArgsSchema.parse(args);
        const events = supervisor.getAuditEvents(validated);
        return { content: [{ type: 'text', text: JSON.stringify(events, null, 2) }] };
      }

      case 'get_audit_stats': {
        const validated = GetAuditStatsArgsSchema.parse(args || {});
        const stats = supervisor.getAuditStats(validated.since);
        return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
      }

      case 'get_approval_stats': {
        const stats = supervisor.getApprovalStats();
        return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
      }

      case 'export_audit_log': {
        const validated = ExportAuditLogArgsSchema.parse(args || {});
        const exported = supervisor.exportAuditLog(validated);
        return { content: [{ type: 'text', text: exported }] };
      }

      // Configuration
      case 'get_config': {
        const config = supervisor.getConfig();
        return { content: [{ type: 'text', text: JSON.stringify(config, null, 2) }] };
      }

      case 'update_config': {
        const validated = UpdateConfigArgsSchema.parse(args || {});
        await supervisor.updateConfig(validated as Partial<SupervisorConfig>);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      }

      // Rate limiting
      case 'check_rate_limit': {
        // This would need access to rate limiter internals
        return { content: [{ type: 'text', text: JSON.stringify({ message: 'Rate limit check - use evaluate_action for full check' }) }] };
      }

      case 'add_rate_limit': {
        const validated = AddRateLimitArgsSchema.parse(args);
        supervisor.addRateLimit(validated.config);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      }

      // Risk assessment
      case 'calculate_risk_score': {
        const validated = EvaluateActionArgsSchema.parse(args);
        const result = await supervisor.evaluateAction(
          validated.action,
          validated.context
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              riskScore: result.riskScore,
              riskLevel: result.riskLevel,
              violations: result.violations.length,
              warnings: result.warnings.length
            }, null, 2)
          }]
        };
      }

      // Health check
      case 'health_check': {
        const config = supervisor.getConfig();
        const stats = supervisor.getAuditStats();

        // Try to get pending approvals, but don't fail if no repo is available
        let pendingApprovalsCount = 0;
        try {
          const repo = typeof args?.repo === 'string' ? args.repo : undefined;
          if (repo) {
            const pendingApprovals = await supervisor.getPendingApprovals(repo);
            pendingApprovalsCount = pendingApprovals.length;
          }
        } catch {
          // No repo available or error - that's fine for health check
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'healthy',
              version: config.version,
              environment: config.environment,
              rulesLoaded: supervisor.getRules().length,
              auditEventsLogged: stats.total,
              pendingApprovals: pendingApprovalsCount,
              features: config.features
            }, null, 2)
          }]
        };
      }

      // CSS Evaluation tools
      case 'css_eval': {
        const newRule = args?.newRule as CSSRule;
        const existingRules = args?.existingRules as CSSRule[] | undefined;
        const context = args?.context as Partial<CSSAnalysisContext> | undefined;

        const analysisContext: CSSAnalysisContext = {
          newRule,
          existingRules,
          projectType: context?.projectType,
          framework: context?.framework,
          hasStyleSystem: context?.hasStyleSystem,
          styleSystemName: context?.styleSystemName,
          globalStylesFile: context?.globalStylesFile,
          componentName: context?.componentName
        };

        const result = cssAnalyzer.analyze(analysisContext);

        // Also log this evaluation
        await supervisor.logEvent({
          action: 'css_eval',
          eventType: 'action_evaluated',
          outcome: result.riskScore > 50 ? 'failure' : 'success',
          metadata: {
            selector: newRule.selector,
            source: newRule.source,
            riskScore: result.riskScore,
            suggestionCount: result.suggestions.length,
            duplicateCount: result.duplicates.length
          }
        });

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'analyze_css_cleanup': {
        const rules = args?.rules as CSSRule[];
        const context = args?.context as { framework?: string; hasStyleSystem?: boolean } | undefined;

        // Analyze each rule against others
        const allSuggestions: Array<{
          ruleSelector: string;
          suggestions: ReturnType<typeof cssAnalyzer.analyze>['suggestions'];
          duplicates: CSSRule[];
          removable: boolean;
        }> = [];

        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i];
          const otherRules = [...rules.slice(0, i), ...rules.slice(i + 1)];

          const result = cssAnalyzer.analyze({
            newRule: rule,
            existingRules: otherRules,
            framework: context?.framework as CSSAnalysisContext['framework'],
            hasStyleSystem: context?.hasStyleSystem
          });

          if (result.suggestions.length > 0 || result.duplicates.length > 0) {
            allSuggestions.push({
              ruleSelector: rule.selector,
              suggestions: result.suggestions,
              duplicates: result.duplicates,
              removable: result.removableCandidates.length > 0
            });
          }
        }

        // Calculate overall stats
        const totalDuplicates = allSuggestions.reduce((sum, s) => sum + s.duplicates.length, 0);
        const totalSuggestions = allSuggestions.reduce((sum, s) => sum + s.suggestions.length, 0);
        const removableCount = allSuggestions.filter(s => s.removable).length;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              summary: {
                rulesAnalyzed: rules.length,
                rulesWithIssues: allSuggestions.length,
                totalDuplicates,
                totalSuggestions,
                removableCandidates: removableCount
              },
              details: allSuggestions
            }, null, 2)
          }]
        };
      }

      case 'suggest_css_variables': {
        const rules = args?.rules as CSSRule[];
        const variableSuggestions: Array<{
          selector: string;
          property: string;
          currentValue: string;
          suggestedVariable: string;
          category: string;
        }> = [];

        // Patterns for variable candidates
        const patterns = [
          { regex: /^#[0-9a-fA-F]{3,8}$/, category: 'color', prefix: '--color-' },
          { regex: /^rgb\(|^rgba\(|^hsl\(|^hsla\(/, category: 'color', prefix: '--color-' },
          { regex: /^\d+(px|rem|em)$/, category: 'spacing', prefix: '--spacing-', minPx: 8 },
          { regex: /^\d{3}$/, category: 'font-weight', prefix: '--font-weight-' },
          { regex: /^(\d+(\.\d+)?)(s|ms)$/, category: 'duration', prefix: '--duration-' }
        ];

        // Track unique values for naming
        const colorValues = new Map<string, number>();
        const spacingValues = new Map<string, number>();

        for (const rule of rules) {
          for (const [property, value] of Object.entries(rule.properties)) {
            for (const pattern of patterns) {
              if (pattern.regex.test(value)) {
                // Skip small pixel values for spacing
                if (pattern.category === 'spacing' && pattern.minPx) {
                  const numValue = parseInt(value);
                  if (numValue < pattern.minPx) continue;
                }

                // Generate suggested variable name
                let varName = pattern.prefix;
                if (pattern.category === 'color') {
                  const count = colorValues.get(value) || colorValues.size + 1;
                  colorValues.set(value, count);
                  varName += `${count}`;
                } else if (pattern.category === 'spacing') {
                  const count = spacingValues.get(value) || spacingValues.size + 1;
                  spacingValues.set(value, count);
                  varName += `${count}`;
                } else {
                  varName += value.replace(/[^a-zA-Z0-9]/g, '-');
                }

                variableSuggestions.push({
                  selector: rule.selector,
                  property,
                  currentValue: value,
                  suggestedVariable: `var(${varName})`,
                  category: pattern.category
                });
                break;
              }
            }
          }
        }

        // Group by category
        const byCategory = variableSuggestions.reduce((acc, s) => {
          acc[s.category] = acc[s.category] || [];
          acc[s.category].push(s);
          return acc;
        }, {} as Record<string, typeof variableSuggestions>);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              summary: {
                totalSuggestions: variableSuggestions.length,
                byCategory: Object.fromEntries(
                  Object.entries(byCategory).map(([k, v]) => [k, v.length])
                )
              },
              suggestions: byCategory
            }, null, 2)
          }]
        };
      }

      // App monitoring tools
      case 'add_monitored_app': {
        const validated = AddMonitoredAppArgsSchema.parse(args);
        const result = await supervisor.addMonitoredApp(validated);
        const healthCheck = supervisor.getLastAppHealthCheck(result.id);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ app: result, initialHealth: healthCheck }, null, 2)
          }]
        };
      }

      case 'remove_monitored_app': {
        const validated = RemoveMonitoredAppArgsSchema.parse(args);
        const removed = await supervisor.removeMonitoredApp(validated.appId);
        return { content: [{ type: 'text', text: JSON.stringify({ success: removed }) }] };
      }

      case 'list_monitored_apps': {
        let apps = supervisor.getAllMonitoredApps();
        if (args?.tag && typeof args.tag === 'string') {
          apps = supervisor.findAppsByTag(args.tag);
        }

        const includeHealth = args?.includeHealth !== false;
        const result = apps.map(app => {
          const base = { ...app };
          if (includeHealth) {
            return {
              ...base,
              lastHealth: supervisor.getLastAppHealthCheck(app.id)
            };
          }
          return base;
        });

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'get_app_status': {
        const validated = GetAppStatusArgsSchema.parse(args);
        let app = validated.appId
          ? supervisor.getMonitoredApp(validated.appId)
          : validated.appName
            ? supervisor.getMonitoredAppByName(validated.appName)
            : undefined;

        if (!app) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'App not found' }) }],
            isError: true
          };
        }

        const healthCheck = supervisor.getLastAppHealthCheck(app.id);
        const history = supervisor.getAppStatusHistory(app.id, validated.historyLimit || 10);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              app,
              currentHealth: healthCheck,
              recentHistory: history
            }, null, 2)
          }]
        };
      }

      case 'check_app_health': {
        const validated = CheckAppHealthArgsSchema.parse(args);
        let appId = validated.appId;
        if (!appId && validated.appName) {
          const app = supervisor.getMonitoredAppByName(validated.appName);
          if (app) appId = app.id;
        }

        if (!appId) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'App not found' }) }],
            isError: true
          };
        }

        const result = await supervisor.checkAppHealth(appId);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'check_all_apps_health': {
        const results = await supervisor.checkAllAppsHealth();
        const stats = supervisor.getAppMonitorStats();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ stats, results }, null, 2)
          }]
        };
      }

      case 'get_app_monitor_stats': {
        const stats = supervisor.getAppMonitorStats();
        return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
      }

      case 'update_monitored_app': {
        const validated = UpdateMonitoredAppArgsSchema.parse(args);
        const result = await supervisor.updateMonitoredApp(
          validated.appId,
          validated.updates
        );
        if (!result) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'App not found' }) }],
            isError: true
          };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'set_app_monitoring_enabled': {
        const validated = SetAppMonitoringEnabledArgsSchema.parse(args);
        const success = supervisor.setAppMonitoringEnabled(
          validated.appId,
          validated.enabled
        );
        return { content: [{ type: 'text', text: JSON.stringify({ success }) }] };
      }

      case 'get_offline_apps': {
        const offlineApps = supervisor.getOfflineApps();
        const result = offlineApps.map(app => ({
          ...app,
          lastHealth: supervisor.getLastAppHealthCheck(app.id)
        }));
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'get_degraded_apps': {
        const degradedApps = supervisor.getDegradedApps();
        const result = degradedApps.map(app => ({
          ...app,
          lastHealth: supervisor.getLastAppHealthCheck(app.id)
        }));
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'scan_prod_apps': {
        const potentialApps = await supervisor.scanForApps();
        return { content: [{ type: 'text', text: JSON.stringify(potentialApps, null, 2) }] };
      }

      case 'get_app_logs': {
        const validated = GetAppLogsArgsSchema.parse(args);
        let appId = validated.appId;
        if (!appId && validated.appName) {
          const app = supervisor.getMonitoredAppByName(validated.appName);
          if (app) appId = app.id;
        }

        if (!appId) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'App not found' }) }],
            isError: true
          };
        }

        const logs = await supervisor.getAppLogs(appId, validated.lines || 50);
        return { content: [{ type: 'text', text: JSON.stringify(logs, null, 2) }] };
      }

      case 'get_app_status_history': {
        const validated = GetAppStatusHistoryArgsSchema.parse(args);
        let appId = validated.appId;
        if (!appId && validated.appName) {
          const app = supervisor.getMonitoredAppByName(validated.appName);
          if (app) appId = app.id;
        }

        if (!appId) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'App not found' }) }],
            isError: true
          };
        }

        const history = supervisor.getAppStatusHistory(appId, validated.limit || 100);
        return { content: [{ type: 'text', text: JSON.stringify(history, null, 2) }] };
      }

      // Session management tools
      case 'register_session': {
        const validated = z.object({
          agentId: z.string(),
          sessionId: z.string(),
          projectPath: z.string(),
          agentType: z.enum(['claude', 'scheduler', 'service', 'manual']).optional(),
          metadata: z.record(z.any()).optional()
        }).parse(args);

        const agent = projectTracker.registerSession({
          agentId: validated.agentId,
          sessionId: validated.sessionId,
          projectPath: validated.projectPath,
          agentType: validated.agentType,
          metadata: validated.metadata
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ registered: true, agent }, null, 2)
          }]
        };
      }

      case 'complete_session': {
        const validated = z.object({
          agentId: z.string(),
          outcome: z.enum(['success', 'failure', 'cancelled']).optional()
        }).parse(args);

        projectTracker.completeSession(validated.agentId, validated.outcome);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ completed: true }, null, 2)
          }]
        };
      }

      // Task management tools
      case 'create_task': {
        const validated = CreateTaskArgsSchema.parse(args);
        const task = await taskManager.createTask(validated);
        return resp(slimTask(task));
      }

      case 'get_tasks': {
        const validated = GetTasksArgsSchema.parse(args || {});
        const tasks = await taskManager.getTasksByProject(
          validated.projectName,
          {
            status: validated.status,
            priority: validated.priority,
            assignee: validated.assignee,
            labels: validated.labels
          }
        );
        return resp({ count: tasks.length, tasks: tasks.map(slimTask) });
      }

      case 'get_pending_tasks': {
        const projectName = typeof args?.projectName === 'string' ? args.projectName : undefined;
        const tasks = await taskManager.getPendingTasks(projectName);
        const approvedTasks = tasks.filter(task => !task.labels?.includes('needs-approval'));
        return resp({ count: approvedTasks.length, tasks: approvedTasks.map(slimTask) });
      }

      case 'get_approved_tasks': {
        const projectName = typeof args?.projectName === 'string' ? args.projectName : undefined;
        const allTasks = await taskManager.getTasksByProject(projectName);
        const approvedTasks = allTasks.filter(task =>
          (task.status === 'pending' || task.status === 'in_progress') &&
          task.labels?.includes('approved')
        );
        return resp({ count: approvedTasks.length, tasks: approvedTasks.map(slimTask) });
      }

      case 'get_task': {
        const validated = GetTaskArgsSchema.parse(args);
        const task = await taskManager.getTask(validated.projectName, validated.taskId);
        if (!task) {
          return { content: [{ type: 'text', text: json({ error: 'Task not found' }) }], isError: true };
        }
        return resp(slimTask(task));
      }

      case 'update_task': {
        const validated = UpdateTaskArgsSchema.parse(args);
        const task = await taskManager.updateTask(
          validated.projectName,
          validated.taskId,
          {
            title: validated.title,
            description: validated.description,
            priority: validated.priority,
            status: validated.status,
            assignee: validated.assignee,
            labels: validated.labels,
            comment: validated.comment,
            commits: validated.commits
          }
        );
        if (!task) {
          return { content: [{ type: 'text', text: json({ error: 'Update failed' }) }], isError: true };
        }
        return resp(slimTask(task));
      }

      case 'update_task_status': {
        const validated = UpdateTaskStatusArgsSchema.parse(args);
        const task = await taskManager.updateTaskStatus(validated.projectName, validated.taskId, validated.status);
        if (!task) {
          return { content: [{ type: 'text', text: json({ error: 'Status update failed' }) }], isError: true };
        }
        return resp(slimTask(task));
      }

      case 'add_task_comment': {
        const validated = AddTaskCommentArgsSchema.parse(args);
        const success = await taskManager.addComment(validated.projectName, validated.taskId, validated.comment, validated.commits);
        return resp({ success });
      }

      case 'link_commits': {
        const validated = LinkCommitsArgsSchema.parse(args);
        const success = await taskManager.linkCommits(validated.projectName, validated.taskId, validated.commits, validated.message);
        return resp({ success });
      }

      case 'close_task_with_comment': {
        const validated = CloseTaskWithCommentArgsSchema.parse(args);
        const task = await taskManager.closeWithComment(validated.projectName, validated.taskId, validated.resolution, validated.commits);
        if (!task) {
          return { content: [{ type: 'text', text: json({ error: 'Close failed' }) }], isError: true };
        }
        return resp(slimTask(task));
      }

      case 'delete_task': {
        const projectName = typeof args?.projectName === 'string' ? args.projectName : undefined;
        const taskId = typeof args?.taskId === 'string' ? args.taskId : '';
        if (!taskId) {
          return { content: [{ type: 'text', text: json({ error: 'taskId required' }) }], isError: true };
        }
        const success = await taskManager.deleteTask(projectName, taskId);
        return resp({ success });
      }

      case 'list_projects': {
        const projects = await taskManager.listProjects();
        return resp(projects);
      }

      case 'get_project_stats': {
        const projectName = typeof args?.projectName === 'string' ? args.projectName : undefined;
        const stats = await taskManager.getProjectStats(projectName);
        if (!stats) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Failed to get project stats' }) }],
            isError: true
          };
        }
        return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
      }

      case 'search_tasks': {
        const validated = SearchTasksArgsSchema.parse(args);
        const tasks = await taskManager.searchTasks(validated.query, validated.projectName);
        return { content: [{ type: 'text', text: JSON.stringify({
          query: validated.query,
          count: tasks.length,
          tasks
        }, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: errorMessage }, null, 2)
      }],
      isError: true
    };
  }
});

// Export server and start function
export { server };

export async function startServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Agent Supervisor MCP Server running on stdio');
}
