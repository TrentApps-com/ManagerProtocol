# Enterprise Agent Supervisor

**A comprehensive governance framework for AI agents** - providing compliance, action limits, risk scoring, and audits through the Model Context Protocol (MCP).

Plug this into ANY agent and suddenly you have:

✔ Compliance enforcement
✔ Action limits & rate limiting
✔ Risk scoring
✔ Comprehensive audits
✔ Human-in-the-loop approval workflows
✔ UX/Architecture validation

---

## Why Agent Supervisor?

Companies **LOVE** governance add-ons. And all MCP ecosystems lack a good "decision gatekeeper."

AI agents are powerful, but without guardrails they can:
- Access sensitive data inappropriately
- Execute high-risk operations without approval
- Overwhelm external APIs
- Violate compliance requirements
- Make costly mistakes in production

**Agent Supervisor** provides the governance layer that enterprises need to deploy AI agents confidently.

---

## Features

### 🛡️ Core Governance Tools

| Tool | Description |
|------|-------------|
| `evaluate_action` | Evaluate any agent action against governance rules |
| `apply_business_rules` | Apply business rules to operational context |
| `require_human_approval` | Request human-in-the-loop approval |
| `log_event` | Log audit events for compliance |

### 🎨 CSS Governance Tools

| Tool | Description |
|------|-------------|
| `css_eval` | Evaluate CSS before adding - finds duplicates, suggests externalization |
| `analyze_css_cleanup` | Analyze existing CSS for cleanup opportunities |
| `suggest_css_variables` | Identify values that should be CSS custom properties |

### 📋 Built-in Rule Sets

- **Security Rules** - SQL injection prevention, privilege escalation detection, authentication enforcement
- **Compliance Rules** - GDPR, HIPAA, PCI-DSS, SOX compliance
- **UX Rules** - Response length limits, accessibility checks, user experience validation
- **Architecture Rules** - API versioning, circuit breakers, observability requirements
- **Operational Rules** - Cost controls, deployment windows, incident escalation
- **CSS Rules** - Inline style detection, specificity warnings, variable recommendations

### 🎛️ Presets

| Preset | Description |
|--------|-------------|
| `minimal` | Basic security and logging only |
| `standard` | Balanced security and operations |
| `strict` | Full compliance and governance |
| `financial` | Optimized for financial services |
| `healthcare` | HIPAA-focused for healthcare |
| `frontend` | Frontend development with CSS governance |
| `development` | Relaxed rules for dev environment |

---

## Quick Start

### Installation

```bash
npm install @trentapps/manager-protocol
```

### MCP Configuration

Add to your Claude Desktop or MCP client configuration:

```json
{
  "mcpServers": {
    "agent-supervisor": {
      "command": "npx",
      "args": ["@trentapps/manager-protocol"]
    }
  }
}
```

### Programmatic Usage

```typescript
import { AgentSupervisor } from '@trentapps/manager-protocol';

const supervisor = new AgentSupervisor({
  config: {
    environment: 'production',
    strictMode: true,
    requireApprovalAboveRisk: 80
  }
});

await supervisor.initialize('standard');

// Evaluate an action
const result = await supervisor.evaluateAction({
  name: 'delete_user_data',
  category: 'data_modification',
  parameters: { userId: '123', recordCount: 1000 }
});

if (!result.allowed) {
  console.log('Action blocked:', result.violations);
}

if (result.requiresHumanApproval) {
  const approval = await supervisor.requireHumanApproval({
    reason: result.approvalReason,
    priority: 'high'
  });
}
```

---

## MCP Tools Reference

### evaluate_action

Evaluate an agent action against governance rules.

```json
{
  "action": {
    "name": "call_external_api",
    "category": "external_api",
    "parameters": {
      "endpoint": "https://api.example.com",
      "method": "POST"
    }
  },
  "context": {
    "environment": "production",
    "userRole": "developer",
    "dataClassification": "confidential"
  }
}
```

**Returns:**
```json
{
  "status": "pending_approval",
  "riskScore": 75,
  "riskLevel": "high",
  "allowed": true,
  "requiresHumanApproval": true,
  "violations": [],
  "warnings": ["External API call to non-whitelisted host"],
  "appliedRules": ["sec-030", "arch-010"]
}
```

### apply_business_rules

Apply rules to understand constraints for a context.

```json
{
  "context": {
    "environment": "production",
    "department": "engineering",
    "dataClassification": "restricted",
    "complianceFrameworks": ["gdpr", "hipaa"]
  }
}
```

### require_human_approval

Request human approval for high-risk actions.

```json
{
  "reason": "Bulk delete of 10,000 customer records",
  "priority": "urgent",
  "riskScore": 85,
  "details": "Agent requests permission to purge inactive accounts older than 2 years"
}
```

### log_event

Log audit events for compliance.

```json
{
  "action": "customer_data_exported",
  "eventType": "action_executed",
  "outcome": "success",
  "metadata": {
    "recordCount": 500,
    "format": "csv",
    "destination": "s3://exports/"
  }
}
```

### css_eval

Evaluate CSS before adding it. Checks for duplicates, recommends externalization, and more.

```json
{
  "newRule": {
    "selector": ".card-header",
    "properties": {
      "background-color": "#3b82f6",
      "padding": "16px",
      "border-radius": "8px"
    },
    "source": "inline"
  },
  "existingRules": [
    {
      "selector": ".header",
      "properties": {
        "background-color": "#3b82f6",
        "padding": "16px"
      },
      "source": "external",
      "file": "styles.css"
    }
  ],
  "context": {
    "framework": "react",
    "hasStyleSystem": true,
    "styleSystemName": "tailwind"
  }
}
```

**Returns:**
```json
{
  "shouldExternalize": true,
  "shouldMakeGlobal": false,
  "duplicates": [{ "selector": ".header", "...": "..." }],
  "suggestions": [
    {
      "type": "use_existing",
      "severity": "warning",
      "message": "Similar CSS properties (80% match) found in '.header'"
    },
    {
      "type": "externalize",
      "severity": "warning",
      "message": "Inline styles should be moved to external stylesheet"
    },
    {
      "type": "use_variable",
      "severity": "info",
      "message": "background-color: #3b82f6 should use a CSS variable"
    }
  ],
  "riskScore": 35,
  "summary": "Should be moved to external stylesheet. 1 warning(s)."
}
```

---

## Custom Rules

Create custom rules for your organization:

```typescript
supervisor.addRule({
  id: 'my-rule-001',
  name: 'Cost Limit Per Request',
  type: 'financial',
  priority: 900,
  conditions: [
    { field: 'estimatedCost', operator: 'greater_than', value: 100 }
  ],
  actions: [
    { type: 'require_approval', message: 'Request exceeds $100 cost threshold' }
  ],
  riskWeight: 30,
  tags: ['cost-control']
});
```

### Condition Operators

| Operator | Description |
|----------|-------------|
| `equals` | Exact match |
| `not_equals` | Not equal |
| `contains` | String/array contains |
| `greater_than` | Numeric comparison |
| `less_than` | Numeric comparison |
| `in` | Value in array |
| `not_in` | Value not in array |
| `matches_regex` | Regex pattern match |
| `exists` | Field exists and is not null |
| `not_exists` | Field is null or undefined |

### Rule Actions

| Action | Description |
|--------|-------------|
| `allow` | Explicitly allow |
| `deny` | Block the action |
| `require_approval` | Request human approval |
| `warn` | Add warning but allow |
| `log` | Log the action |
| `rate_limit` | Apply rate limiting |
| `escalate` | Escalate for review |
| `notify` | Send notification |

---

## Rate Limiting

Configure rate limits to prevent abuse:

```typescript
supervisor.addRateLimit({
  id: 'api-calls',
  name: 'External API Rate Limit',
  windowMs: 60000,        // 1 minute window
  maxRequests: 20,        // Max 20 requests
  scope: 'agent',         // Per agent
  actionCategories: ['external_api'],
  burstLimit: 5           // Max 5 in burst
});
```

---

## Compliance Frameworks

Built-in support for:

- **GDPR** - Data subject rights, cross-border transfers, consent
- **HIPAA** - PHI access, minimum necessary, encryption
- **PCI-DSS** - Cardholder data, PAN masking, CVV prohibition
- **SOX** - Financial controls, segregation of duties
- **SOC 2** - Security, availability, confidentiality

---

## Security & Deployment

### Local Usage (Default)

The Agent Supervisor MCP server is designed to run **locally** alongside your AI agent. When configured as an MCP server in Claude Desktop or other MCP clients, it communicates via stdio (standard input/output), not HTTP.

**Key points:**
- **No CORS required** - The MCP protocol uses stdio for communication, not HTTP requests
- **No network exposure** - The server doesn't listen on any network ports by default
- **Process isolation** - Runs as a child process of the MCP client

### Dashboard (Optional)

The optional HTTP dashboard (for monitoring and approvals) runs on `localhost:3100` by default:
- Only accessible from the local machine
- Not exposed to the network
- For remote access, use SSH tunneling or a reverse proxy with authentication

### Production Considerations

If deploying in a production environment with network access:
1. **Add authentication** - Implement your own auth layer (OAuth, API keys, etc.)
2. **Use a reverse proxy** - Put nginx/Caddy in front with TLS and auth
3. **Network isolation** - Run in a private network or VPC
4. **Audit logging** - Enable comprehensive audit logging (built-in)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Agent Supervisor                          │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Rules     │  │    Rate     │  │      Approval       │  │
│  │   Engine    │  │   Limiter   │  │      Manager        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Audit Logger                         ││
│  └─────────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────┤
│                      MCP Server                              │
│  evaluate_action | apply_business_rules | require_approval  │
│  log_event | list_rules | add_rule | get_audit_events ...   │
└──────────────────────────────────────────────────────────────┘
```

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev

# Run tests
npm test
```

---

## API Reference

### AgentSupervisor

The main class for agent governance.

```typescript
const supervisor = new AgentSupervisor(options);

// Core methods
await supervisor.evaluateAction(action, context);
await supervisor.applyBusinessRules(context);
await supervisor.requireHumanApproval(params);
await supervisor.logEvent(params);

// Rule management
supervisor.addRule(rule);
supervisor.removeRule(ruleId);
supervisor.getRules();
supervisor.loadPreset(preset);

// Approval management
await supervisor.approveRequest(requestId, approverId, comments);
await supervisor.denyRequest(requestId, denierId, reason);
supervisor.getPendingApprovals();

// Audit & reporting
supervisor.getAuditEvents(filter);
supervisor.getAuditStats(since);
supervisor.exportAuditLog(filter);
```

---

## License

MIT

---

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit PRs.

---

**Built for enterprise AI governance.** 🏢🤖🛡️
