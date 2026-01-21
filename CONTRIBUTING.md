# Contributing to Enterprise Agent Supervisor

Thank you for your interest in contributing to Enterprise Agent Supervisor! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/TrentApps-com/ManagerProtocol.git
   cd ManagerProtocol
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Run tests:
   ```bash
   npm test
   ```

## Development Workflow

### Code Style

This project uses ESLint and Prettier for code quality and formatting:

```bash
# Run linting
npm run lint

# Format code
npm run format
```

### Testing

We use Vitest for testing. Please ensure all tests pass before submitting a pull request:

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run
```

When adding new features or fixing bugs, please include appropriate tests.

### Building

```bash
# Build the project
npm run build

# Clean build artifacts
npm run clean
```

## Project Structure

```
src/
├── supervisor/          # Main AgentSupervisor class
├── engine/              # Core governance engines
│   ├── RulesEngine.ts   # Rule evaluation logic
│   ├── RateLimiter.ts   # Rate limiting implementation
│   ├── AuditLogger.ts   # Audit logging
│   └── ApprovalManager.ts # Human approval workflows
├── rules/               # Pre-built rule sets
│   ├── security.ts      # Security rules
│   ├── compliance.ts    # Compliance rules
│   ├── architecture.ts  # Architecture rules
│   ├── operational.ts   # Operational rules
│   ├── ux.ts           # UX rules
│   └── css.ts          # CSS governance rules
├── analyzers/           # Code analysis tools
├── design-system/       # Design system tokens
├── types/               # TypeScript type definitions
├── server.ts            # MCP server implementation
├── cli.ts               # CLI entry point
└── index.ts             # Package exports
```

## Pull Request Guidelines

1. **Branch naming**: Use descriptive branch names like `feature/add-new-rule`, `fix/rate-limiter-bug`, or `docs/update-readme`.

2. **Commit messages**: Write clear, concise commit messages that explain the what and why of your changes.

3. **Pull request description**: Include:
   - A clear description of what the PR does
   - Any breaking changes
   - Related issues (if any)
   - Testing instructions

4. **Code review**: All PRs require at least one approving review before merging.

## Adding New Rules

When adding new business rules:

1. Create rules in the appropriate file under `src/rules/`
2. Follow the existing pattern for rule definitions
3. Include comprehensive tests
4. Update documentation if needed

Example rule structure:
```typescript
export const myNewRule: BusinessRule = {
  id: 'unique-rule-id',
  name: 'Human-readable name',
  description: 'What this rule does',
  type: 'security', // or compliance, operational, etc.
  enabled: true,
  priority: 500, // 0-1000, higher = more important
  conditions: [
    { field: 'fieldName', operator: 'equals', value: 'expectedValue' }
  ],
  conditionLogic: 'all', // or 'any'
  actions: [
    { type: 'deny', message: 'Action denied because...' }
  ],
  riskWeight: 30 // 0-100
};
```

## Reporting Issues

When reporting issues, please include:

1. A clear description of the problem
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Environment details (Node.js version, OS, etc.)
6. Any relevant logs or error messages

## Feature Requests

We welcome feature requests! Please:

1. Check if the feature has already been requested
2. Clearly describe the use case
3. Explain how the feature would benefit users
4. Consider contributing the feature yourself

## Code of Conduct

Please be respectful and constructive in all interactions. We're all here to build something great together.

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

## Questions?

If you have questions about contributing, feel free to open an issue for discussion.
