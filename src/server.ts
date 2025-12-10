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
import { AgentActionSchema, BusinessContextSchema } from './types/index.js';
import { rulePresets, allBuiltInRules, defaultRateLimits } from './rules/index.js';
import { cssAnalyzer, type CSSAnalysisContext, type CSSRule } from './analyzers/index.js';

// Initialize supervisor
const supervisor = new AgentSupervisor({
  config: {
    environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development'
  },
  auditOptions: {
    enableConsoleLog: process.env.DEBUG === 'true'
  }
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
        requestId: { type: 'string', description: 'ID of the approval request' }
      },
      required: ['requestId']
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
    description: 'List all configured governance rules',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['compliance', 'security', 'operational', 'financial', 'ux', 'architecture', 'data_governance', 'rate_limit', 'custom'],
          description: 'Filter by rule type'
        },
        enabled: { type: 'boolean', description: 'Filter by enabled status' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' }
      }
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
  }
];

// Create and configure MCP server
const server = new Server(
  {
    name: 'agent-supervisor',
    version: '1.0.0'
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
        const result = await supervisor.evaluateAction(
          args?.action as any,
          args?.context as any
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'apply_business_rules': {
        const result = await supervisor.applyBusinessRules(args?.context as any);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'require_human_approval': {
        const result = await supervisor.requireHumanApproval(args as any);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'log_event': {
        const result = await supervisor.logEvent(args as any);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      // Approval management
      case 'check_approval_status': {
        const request = supervisor.getPendingApprovals().find(
          r => r.requestId === args?.requestId
        );
        if (!request) {
          return { content: [{ type: 'text', text: JSON.stringify({ status: 'not_found' }) }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify(request, null, 2) }] };
      }

      case 'list_pending_approvals': {
        const approvals = supervisor.getPendingApprovals();
        return { content: [{ type: 'text', text: JSON.stringify(approvals, null, 2) }] };
      }

      case 'approve_request': {
        const result = await supervisor.approveRequest(
          args?.requestId as string,
          args?.approverId as string,
          args?.comments as string
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'deny_request': {
        const result = await supervisor.denyRequest(
          args?.requestId as string,
          args?.denierId as string,
          args?.reason as string
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      // Rule management
      case 'list_rules': {
        let rules = supervisor.getRules();
        if (args?.type) {
          rules = rules.filter(r => r.type === args.type);
        }
        if (args?.enabled !== undefined) {
          rules = rules.filter(r => r.enabled === args.enabled);
        }
        if (args?.tags) {
          const tags = args.tags as string[];
          rules = rules.filter(r => r.tags?.some(t => tags.includes(t)));
        }
        return { content: [{ type: 'text', text: JSON.stringify(rules, null, 2) }] };
      }

      case 'add_rule': {
        supervisor.addRule(args?.rule as any);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, ruleId: (args?.rule as any).id }) }] };
      }

      case 'remove_rule': {
        const removed = supervisor.removeRule(args?.ruleId as string);
        return { content: [{ type: 'text', text: JSON.stringify({ success: removed }) }] };
      }

      case 'load_preset': {
        await supervisor.loadPreset(args?.preset as any);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, preset: args?.preset }) }] };
      }

      // Audit & reporting
      case 'get_audit_events': {
        const events = supervisor.getAuditEvents(args as any);
        return { content: [{ type: 'text', text: JSON.stringify(events, null, 2) }] };
      }

      case 'get_audit_stats': {
        const stats = supervisor.getAuditStats(args?.since as string);
        return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
      }

      case 'get_approval_stats': {
        const stats = supervisor.getApprovalStats();
        return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
      }

      case 'export_audit_log': {
        const exported = supervisor.exportAuditLog(args as any);
        return { content: [{ type: 'text', text: exported }] };
      }

      // Configuration
      case 'get_config': {
        const config = supervisor.getConfig();
        return { content: [{ type: 'text', text: JSON.stringify(config, null, 2) }] };
      }

      case 'update_config': {
        await supervisor.updateConfig(args as any);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      }

      // Rate limiting
      case 'check_rate_limit': {
        // This would need access to rate limiter internals
        return { content: [{ type: 'text', text: JSON.stringify({ message: 'Rate limit check - use evaluate_action for full check' }) }] };
      }

      case 'add_rate_limit': {
        supervisor.addRateLimit(args?.config as any);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      }

      // Risk assessment
      case 'calculate_risk_score': {
        const result = await supervisor.evaluateAction(
          args?.action as any,
          args?.context as any
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
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'healthy',
              version: config.version,
              environment: config.environment,
              rulesLoaded: supervisor.getRules().length,
              auditEventsLogged: stats.total,
              pendingApprovals: supervisor.getPendingApprovals().length,
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
