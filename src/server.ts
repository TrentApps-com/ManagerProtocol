/**
 * Enterprise Agent Supervisor - MCP Server
 *
 * Model Context Protocol server exposing agent governance tools.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const execAsync = promisify(exec);
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

// ============================================================================
// CLAUDE.MD INSTRUCTIONS - Returned via MCP resource for easy setup
// ============================================================================

function getClaudeMdInstructions(): string {
  return `## Agent Supervisor (ManagerProtocol)

**Use the Agent Supervisor MCP for governance, approvals, and audit logging.**

### Required Workflow

1. **At session start**: Run \`health_check\` to verify supervisor is available
2. **Before significant actions**: Run \`evaluate_action\` to check compliance
3. **After completing work**: Run \`log_event\` to record what was done
4. **When approval needed**: Use \`AskUserQuestion\` for inline prompts (see below)

### Human Approval Flow

When \`evaluate_action\` returns \`requiresHumanApproval: true\`, prompt the user inline:

\`\`\`
1. Call evaluate_action → returns requiresHumanApproval: true
2. Use AskUserQuestion → User sees inline CLI prompt
3. User approves/denies → Proceed accordingly
\`\`\`

This provides instant feedback like Claude's built-in planning questions.

### Key Tools

| Tool | Purpose |
|------|---------|
| \`health_check\` | Verify supervisor is running |
| \`evaluate_action\` | Check if action is allowed, get risk score |
| \`log_event\` | Record audit events |
| \`list_rules\` | See configured governance rules |
| \`create_github_issue\` | Create tasks/issues via gh CLI |
| \`css_eval\` | Evaluate CSS before adding |

### Example: Evaluating an Action

\`\`\`typescript
const result = await evaluate_action({
  action: {
    name: "modify_database",
    category: "data_modification",
    description: "Delete inactive user records"
  },
  context: {
    environment: "production",
    dataClassification: "confidential"
  }
});

if (result.requiresHumanApproval) {
  // Use AskUserQuestion to prompt user inline
}
\`\`\`

### GitHub Integration

Task management uses \`gh\` CLI (requires \`gh auth login\`):
- \`create_github_issue\` - Create issues with labels
- \`list_github_issues\` - Query issues
- \`update_github_issue\` - Modify issues
- \`close_github_issue\` - Close with comment
`;
}

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
// RESPONSE SIZE LIMITS - Prevent OOM errors from large payloads
// ============================================================================

/** Maximum number of items in any list response to prevent memory exhaustion */
const MAX_RESPONSE_ITEMS = 1000;

/** Default limit for list responses when not specified */
const DEFAULT_RESPONSE_LIMIT = 100;

/** Helper to truncate arrays and add warning if truncated */
function limitResults<T>(items: T[], limit: number = DEFAULT_RESPONSE_LIMIT, maxLimit: number = MAX_RESPONSE_ITEMS): {
  items: T[];
  total: number;
  truncated: boolean;
  warning?: string;
  pagination?: { offset: number; limit: number; hasMore: boolean };
} {
  const effectiveLimit = Math.min(limit, maxLimit);
  const total = items.length;
  const truncated = total > effectiveLimit;
  const limitedItems = items.slice(0, effectiveLimit);

  return {
    items: limitedItems,
    total,
    truncated,
    ...(truncated && {
      warning: `Response truncated: showing ${effectiveLimit} of ${total} items. Use limit/offset parameters for pagination.`,
      pagination: { offset: 0, limit: effectiveLimit, hasMore: true }
    })
  };
}

// ============================================================================
// COMPACT RESPONSE HELPERS - Keep MCP responses concise
// ============================================================================

/** Compact JSON (no pretty printing) */
const json = (obj: unknown) => JSON.stringify(obj);

/** MCP text response wrapper */
const resp = (obj: unknown) => ({ content: [{ type: 'text' as const, text: json(obj) }] });

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

const ExportAuditLogArgsSchema = z.object({
  since: z.string().optional(),
  until: z.string().optional(),
  eventType: AuditEventTypeSchema.optional()
});

const ApproveRequestArgsSchema = z.object({
  requestId: z.string(),
  approverId: z.string(),
  comments: z.string().optional()
});

const DenyRequestArgsSchema = z.object({
  requestId: z.string(),
  denierId: z.string(),
  reason: z.string().optional()
});

const RemoveRuleArgsSchema = z.object({
  ruleId: z.string()
});

const GetAuditStatsArgsSchema = z.object({
  since: z.string().optional()
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

RECOMMENDED: In Claude Code CLI, after calling evaluate_action and seeing requiresHumanApproval: true,
use Claude's AskUserQuestion tool to prompt the user inline. This provides the best UX.

If called directly, this tool uses a fallback chain:
1. MCP Elicitation (prompts user directly if client supports it)
2. GitHub Issue with needs-approval label (via gh CLI)
3. In-memory request storage`,
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
  // APPROVAL MANAGEMENT TOOLS (In-memory - GitHub integration removed)
  // ============================================================================
  {
    name: 'check_approval_status',
    description: 'Check the status of a pending approval request (in-memory storage)',
    inputSchema: {
      type: 'object',
      properties: {
        requestId: { type: 'string', description: 'ID of the approval request' }
      },
      required: ['requestId']
    }
  },
  {
    name: 'list_pending_approvals',
    description: 'List all pending approval requests (in-memory storage)',
    inputSchema: {
      type: 'object',
      properties: {
        priority: { type: 'string', enum: ['urgent', 'high', 'normal', 'low'] },
        minRiskScore: { type: 'number', minimum: 0, maximum: 100 }
      }
    }
  },
  {
    name: 'approve_request',
    description: 'Approve a pending approval request (requires approver privileges)',
    inputSchema: {
      type: 'object',
      properties: {
        requestId: { type: 'string', description: 'ID of the request to approve' },
        approverId: { type: 'string', description: 'ID of the approver' },
        comments: { type: 'string', description: 'Approval comments' }
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
        requestId: { type: 'string', description: 'ID of the request to deny' },
        denierId: { type: 'string', description: 'ID of the denier' },
        reason: { type: 'string', description: 'Reason for denial' }
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
      properties: {}
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
  // SESSION MANAGEMENT TOOLS
  // ============================================================================
  {
    name: 'register_session',
    description: `Register a Claude session working on a project.

IMPORTANT: Call this at the START of working on a project to be tracked by the supervisor.

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
  // GITHUB ISSUE TOOLS (uses gh CLI - auto-detects current repository)
  // ============================================================================
  {
    name: 'create_github_issue',
    description: `Create a GitHub issue in the current repository using the gh CLI.

Automatically detects the repository from the current git context.
Requires gh CLI to be installed and authenticated.

Returns the created issue URL and number.`,
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue body/description (supports markdown)' },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels to apply (e.g., ["bug", "enhancement"])'
        },
        assignees: {
          type: 'array',
          items: { type: 'string' },
          description: 'GitHub usernames to assign'
        },
        milestone: { type: 'string', description: 'Milestone name or number' },
        project: { type: 'string', description: 'Project name to add issue to' }
      },
      required: ['title']
    }
  },
  {
    name: 'list_github_issues',
    description: `List GitHub issues in the current repository using the gh CLI.

Automatically detects the repository from the current git context.
Requires gh CLI to be installed and authenticated.`,
    inputSchema: {
      type: 'object',
      properties: {
        state: {
          type: 'string',
          enum: ['open', 'closed', 'all'],
          description: 'Filter by state (default: open)'
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by labels'
        },
        assignee: { type: 'string', description: 'Filter by assignee' },
        limit: { type: 'number', description: 'Max issues to return (default: 30)' }
      }
    }
  },
  {
    name: 'update_github_issue',
    description: `Update a GitHub issue in the current repository using the gh CLI.

Automatically detects the repository from the current git context.
Requires gh CLI to be installed and authenticated.`,
    inputSchema: {
      type: 'object',
      properties: {
        issue: { type: 'number', description: 'Issue number to update' },
        title: { type: 'string', description: 'New title' },
        body: { type: 'string', description: 'New body' },
        addLabels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels to add'
        },
        removeLabels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels to remove'
        },
        addAssignees: {
          type: 'array',
          items: { type: 'string' },
          description: 'Assignees to add'
        },
        state: {
          type: 'string',
          enum: ['open', 'closed'],
          description: 'Set issue state'
        }
      },
      required: ['issue']
    }
  },
  {
    name: 'close_github_issue',
    description: `Close a GitHub issue with an optional comment.

Automatically detects the repository from the current git context.
Requires gh CLI to be installed and authenticated.`,
    inputSchema: {
      type: 'object',
      properties: {
        issue: { type: 'number', description: 'Issue number to close' },
        comment: { type: 'string', description: 'Optional closing comment' },
        reason: {
          type: 'string',
          enum: ['completed', 'not_planned'],
          description: 'Close reason (default: completed)'
        }
      },
      required: ['issue']
    }
  }
];

// Create and configure MCP server
const server = new Server(
  {
    name: 'manager-protocol',
    version: '1.3.1'
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
      uri: 'supervisor://setup/claude-md',
      name: 'CLAUDE.md Instructions',
      description: 'Recommended instructions to add to your ~/.claude/CLAUDE.md for optimal agent governance workflow',
      mimeType: 'text/markdown'
    },
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

    case 'supervisor://setup/claude-md':
      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: getClaudeMdInstructions()
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

        // Build approval message
        const priorityLabel = validated.priority ? `[${validated.priority.toUpperCase()}] ` : '';
        const riskLabel = validated.riskScore !== undefined ? `\nRisk Score: ${validated.riskScore}/100` : '';
        const detailsSection = validated.details ? `\n\nDetails:\n${validated.details}` : '';

        const message = `${priorityLabel}Approval Required

${validated.reason}${riskLabel}${detailsSection}`;

        try {
          // Use MCP elicitation to prompt user directly
          const elicitResult = await server.elicitInput({
            mode: 'form',
            message,
            requestedSchema: {
              type: 'object',
              properties: {
                approved: {
                  type: 'boolean',
                  title: 'Approve this action?',
                  description: 'Check to approve, uncheck to deny'
                },
                comments: {
                  type: 'string',
                  title: 'Comments (optional)',
                  description: 'Add any notes about your decision'
                }
              },
              required: ['approved']
            }
          });

          // Log the approval decision
          const approved = elicitResult.action === 'accept' && elicitResult.content?.approved === true;
          const comments = elicitResult.content?.comments || '';

          await supervisor.logEvent({
            action: `Human approval ${approved ? 'granted' : 'denied'}: ${validated.reason}`,
            eventType: approved ? 'approval_granted' : 'approval_denied',
            outcome: approved ? 'success' : 'failure',
            metadata: {
              reason: validated.reason,
              priority: validated.priority,
              riskScore: validated.riskScore,
              comments,
              elicitAction: elicitResult.action
            }
          });

          return resp({
            approved,
            action: elicitResult.action,
            comments,
            decision: approved ? 'approved' : 'denied'
          });
        } catch (elicitError: any) {
          // Elicitation not supported - fall back to GitHub issue
          const priorityInfo = validated.priority ? `\n**Priority:** ${validated.priority.toUpperCase()}` : '';
          const riskInfo = validated.riskScore !== undefined ? `\n**Risk Score:** ${validated.riskScore}/100` : '';
          const detailsInfo = validated.details ? `\n\n**Details:**\n${validated.details}` : '';

          const issueBody = `## Approval Required

${validated.reason}${priorityInfo}${riskInfo}${detailsInfo}

---
*This approval request was created automatically because MCP elicitation is not available.*
*Add the \`approved\` label to approve, or close as "not planned" to deny.*`;

          const cmdParts = [
            'gh', 'issue', 'create',
            '--title', JSON.stringify(`[Approval Required] ${validated.reason.slice(0, 60)}`),
            '--body', JSON.stringify(issueBody),
            '--label', 'needs-approval'
          ];

          try {
            const { stdout } = await execAsync(cmdParts.join(' '));
            const url = stdout.trim();
            const issueNumber = url.match(/\/issues\/(\d+)/)?.[1];

            await supervisor.logEvent({
              action: `Approval request created as GitHub issue: ${validated.reason}`,
              eventType: 'approval_requested',
              outcome: 'pending',
              metadata: {
                reason: validated.reason,
                priority: validated.priority,
                riskScore: validated.riskScore,
                issueUrl: url,
                issueNumber,
                fallbackReason: elicitError.message
              }
            });

            return resp({
              approved: false,
              pending: true,
              issueUrl: url,
              issueNumber: issueNumber ? parseInt(issueNumber) : null,
              note: 'Elicitation not available - GitHub issue created for approval'
            });
          } catch (ghError: any) {
            // GitHub CLI also failed - fall back to in-memory
            const result = await supervisor.requireHumanApproval(validated);
            return resp({
              requestId: result.requestId,
              status: result.status,
              priority: result.priority,
              note: 'Elicitation and GitHub unavailable - in-memory approval request created'
            });
          }
        }
      }

      case 'log_event': {
        const validated = LogEventArgsSchema.parse(args);
        const result = await supervisor.logEvent(validated);
        return resp({ eventId: result.eventId, logged: true });
      }

      // Approval management (in-memory - GitHub integration removed)
      case 'check_approval_status': {
        const requestId = typeof args?.requestId === 'string' ? args.requestId : '';
        if (!requestId) return resp({ error: 'requestId is required' });
        const isApproved = await supervisor.isApproved(requestId);
        const pending = await supervisor.getPendingApprovals();
        const request = pending.find((r: any) => r.requestId === requestId);
        if (!request && !isApproved) return resp({ status: 'not_found' });
        return resp({
          status: isApproved ? 'approved' : (request?.status || 'unknown'),
          reason: request?.reason,
          priority: request?.priority
        });
      }

      case 'list_pending_approvals': {
        const allApprovals = await supervisor.getPendingApprovals();
        // Filter by priority and minRiskScore if provided
        let filtered = allApprovals;
        if (args?.priority) {
          filtered = filtered.filter((a: any) => a.priority === args.priority);
        }
        const minRiskScore = typeof args?.minRiskScore === 'number' ? args.minRiskScore : undefined;
        if (minRiskScore !== undefined) {
          filtered = filtered.filter((a: any) => (a.riskScore || 0) >= minRiskScore);
        }
        const result = limitResults(filtered, DEFAULT_RESPONSE_LIMIT);
        return resp({
          count: result.items.length,
          total: result.total,
          approvals: result.items.map((a: any) => ({ id: a.requestId, reason: a.reason, priority: a.priority, riskScore: a.riskScore })),
          ...(result.truncated && { warning: result.warning, pagination: result.pagination })
        });
      }

      case 'approve_request': {
        const validated = ApproveRequestArgsSchema.parse(args);
        await supervisor.approveRequest(validated.requestId, validated.approverId, validated.comments);
        return resp({ approved: true, requestId: validated.requestId });
      }

      case 'deny_request': {
        const validated = DenyRequestArgsSchema.parse(args);
        await supervisor.denyRequest(validated.requestId, validated.denierId, validated.reason);
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
        const requestedLimit = validated.limit || DEFAULT_RESPONSE_LIMIT;
        const events = supervisor.getAuditEvents({ ...validated, limit: Math.min(requestedLimit, MAX_RESPONSE_ITEMS) });
        const result = limitResults(events, requestedLimit);
        return resp({
          count: result.items.length,
          total: result.total,
          events: result.items,
          ...(result.truncated && { warning: result.warning, pagination: result.pagination })
        });
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
        // Parse exported JSON to apply limits
        try {
          const parsed = JSON.parse(exported);
          if (Array.isArray(parsed)) {
            const result = limitResults(parsed, MAX_RESPONSE_ITEMS, MAX_RESPONSE_ITEMS);
            return resp({
              count: result.items.length,
              total: result.total,
              events: result.items,
              ...(result.truncated && { warning: result.warning, pagination: result.pagination })
            });
          }
          return { content: [{ type: 'text', text: exported }] };
        } catch {
          return { content: [{ type: 'text', text: exported }] };
        }
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
        const pendingApprovals = await supervisor.getPendingApprovals();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'healthy',
              version: config.version,
              environment: config.environment,
              rulesLoaded: supervisor.getRules().length,
              auditEventsLogged: stats.total,
              pendingApprovals: pendingApprovals.length,
              features: config.features,
              note: 'GitHub integration removed - use GitHub MCP for GitHub functionality'
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

      // GitHub Issue tools (using gh CLI)
      case 'create_github_issue': {
        const validated = z.object({
          title: z.string(),
          body: z.string().optional(),
          labels: z.array(z.string()).optional(),
          assignees: z.array(z.string()).optional(),
          milestone: z.string().optional(),
          project: z.string().optional()
        }).parse(args);

        const cmdParts = ['gh', 'issue', 'create', '--title', JSON.stringify(validated.title)];
        if (validated.body) cmdParts.push('--body', JSON.stringify(validated.body));
        if (validated.labels?.length) cmdParts.push('--label', validated.labels.join(','));
        if (validated.assignees?.length) cmdParts.push('--assignee', validated.assignees.join(','));
        if (validated.milestone) cmdParts.push('--milestone', validated.milestone);
        if (validated.project) cmdParts.push('--project', validated.project);

        try {
          const { stdout } = await execAsync(cmdParts.join(' '));
          const url = stdout.trim();
          const issueNumber = url.match(/\/issues\/(\d+)/)?.[1];
          return resp({ success: true, url, issueNumber: issueNumber ? parseInt(issueNumber) : null });
        } catch (err: any) {
          return resp({ success: false, error: err.stderr || err.message });
        }
      }

      case 'list_github_issues': {
        const validated = z.object({
          state: z.enum(['open', 'closed', 'all']).optional(),
          labels: z.array(z.string()).optional(),
          assignee: z.string().optional(),
          limit: z.number().optional()
        }).parse(args || {});

        const cmdParts = ['gh', 'issue', 'list', '--json', 'number,title,state,labels,assignees,url'];
        if (validated.state) cmdParts.push('--state', validated.state);
        if (validated.labels?.length) cmdParts.push('--label', validated.labels.join(','));
        if (validated.assignee) cmdParts.push('--assignee', validated.assignee);
        cmdParts.push('--limit', String(validated.limit || 30));

        try {
          const { stdout } = await execAsync(cmdParts.join(' '));
          const issues = JSON.parse(stdout);
          return resp({ success: true, issues, count: issues.length });
        } catch (err: any) {
          return resp({ success: false, error: err.stderr || err.message });
        }
      }

      case 'update_github_issue': {
        const validated = z.object({
          issue: z.number(),
          title: z.string().optional(),
          body: z.string().optional(),
          addLabels: z.array(z.string()).optional(),
          removeLabels: z.array(z.string()).optional(),
          addAssignees: z.array(z.string()).optional(),
          state: z.enum(['open', 'closed']).optional()
        }).parse(args);

        const cmdParts = ['gh', 'issue', 'edit', String(validated.issue)];
        if (validated.title) cmdParts.push('--title', JSON.stringify(validated.title));
        if (validated.body) cmdParts.push('--body', JSON.stringify(validated.body));
        if (validated.addLabels?.length) cmdParts.push('--add-label', validated.addLabels.join(','));
        if (validated.removeLabels?.length) cmdParts.push('--remove-label', validated.removeLabels.join(','));
        if (validated.addAssignees?.length) cmdParts.push('--add-assignee', validated.addAssignees.join(','));

        try {
          await execAsync(cmdParts.join(' '));

          // Handle state change separately if needed
          if (validated.state === 'closed') {
            await execAsync(`gh issue close ${validated.issue}`);
          } else if (validated.state === 'open') {
            await execAsync(`gh issue reopen ${validated.issue}`);
          }

          return resp({ success: true, issue: validated.issue });
        } catch (err: any) {
          return resp({ success: false, error: err.stderr || err.message });
        }
      }

      case 'close_github_issue': {
        const validated = z.object({
          issue: z.number(),
          comment: z.string().optional(),
          reason: z.enum(['completed', 'not_planned']).optional()
        }).parse(args);

        try {
          // Add comment first if provided
          if (validated.comment) {
            await execAsync(`gh issue comment ${validated.issue} --body ${JSON.stringify(validated.comment)}`);
          }

          // Close the issue
          const reasonFlag = validated.reason === 'not_planned' ? '--reason "not planned"' : '';
          await execAsync(`gh issue close ${validated.issue} ${reasonFlag}`.trim());

          return resp({ success: true, issue: validated.issue, closed: true });
        } catch (err: any) {
          return resp({ success: false, error: err.stderr || err.message });
        }
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
