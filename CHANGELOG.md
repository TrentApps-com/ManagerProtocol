# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-01-21

### Added
- **GitHub API Integration via Octokit**: Replaced `gh` CLI dependency with native GitHub REST API calls using `@octokit/rest` for improved reliability and performance (Task #99)
- **Priority-Weighted Risk Scoring**: Enhanced RulesEngine to calculate risk scores based on rule priority weights, providing more accurate risk assessments
- **Connection Pooling**: Implemented TCP connection pooling and caching in AppMonitor for efficient health checks (Task #47)
- **Evaluation Caching**: Added caching to AgentSupervisor to reduce redundant evaluations and improve performance (Task #91)
- **Dashboard Enhancements**:
  - Authentication system with session management (Task #4)
  - Dark mode support (Task #21)
  - Configuration management UI (Task #24, #25)
  - Write-through caching for improved responsiveness (Task #75, #89)
- **RateLimiter Utilities**: Added helper methods for rate limit management (Task #45)
- **AuditLogger QueryBuilder**: Introduced fluent query builder API for easier audit log queries (Task #49)
- **CSS Analyzer Improvements**:
  - Pattern extraction for consistent CSS rule detection (Task #44)
  - Performance optimizations (Task #51)
  - Enhanced logging and debugging (Task #52)
  - Consistency checks for CSS rules (Task #36)
- **Rule Dependency Analysis**: Tools to analyze and visualize rule dependencies (Task #37)
- **Enhanced Testing Framework**: Improved test coverage and testing utilities (Task #38)
- **Security Rules**: Added rules for common vulnerabilities including:
  - Path traversal prevention
  - Server-side request forgery (SSRF) protection
  - XML external entity (XXE) injection prevention
  - Insecure deserialization detection
  (Task #32)
- **Shared Utilities**: Extracted common patterns into reusable utilities (Tasks #40, #41, #42, #48)
- **CODEOWNERS File**: Added GitHub CODEOWNERS for better code review workflow

### Changed
- **Rule Consolidation**: Consolidated duplicate rules into shared patterns for better maintainability (Tasks #26-30)
- **RulesEngine Refactoring**: Improved rule evaluation logic and error handling (Tasks #53, #56, #57)
- **Test Updates**: Updated test suite to reflect priority-weighted risk calculation changes

### Fixed
- **AuditLogger Hybrid Storage**: Fixed consistency issues between in-memory and SQLite storage (Task #78)

### Documentation
- Added Security & Deployment section explaining local MCP usage and security considerations

## [1.1.3] - 2026-01-21

### Fixed
- **OOM Prevention**: Added response size limits to prevent out-of-memory errors in HTTP requests
- **GitHubApprovalManager**: Fixed race conditions, improved validation, and enhanced error handling
- **Task Validation**: Added validation to ensure task existence before operations
- **CSS Selector Handling**: Improved error handling for malformed CSS selectors
- **RateLimiter**: Fixed window expiration boundary calculation for accurate rate limiting

### Performance
- **Async Git Operations**: Converted ProjectTracker git operations to async with caching for faster repository analysis
- **Database Indexes**: Added indexes to audit log database tables for significantly faster query performance

### Documentation
- Fixed incorrect repository URLs in documentation
- Fixed typo in README

## [1.1.2] - 2026-01-21

### Security
- **Command Injection Prevention**: Fixed command injection vulnerabilities in TaskManager by replacing shell execution with native Git operations
- **Secure Audit Storage**: Changed default audit database path from current directory to secure home directory location (`~/.config/agent-supervisor/`)
- **Secure Temp Files**: Updated GitHubApprovalManager to use cryptographically secure temporary file creation

### Fixed
- **Memory Leak Prevention**: Used `once()` for HTTP response listeners to prevent memory leaks
- **Process Exit**: Added `unref()` to cleanup interval timer to allow graceful process exit

### Changed
- Updated dependencies to latest stable versions
- Added `publishConfig` for npm public access

## [1.0.0] - 2026-01-21

### Added
- **Initial public release** - Enterprise Agent Supervisor MCP Server
- **Rules Engine**: 170+ business rules across 12 domains
  - Security rules (XSS, SQL injection, authentication, secrets management)
  - Compliance rules (GDPR, PII handling, audit requirements)
  - Architecture rules (separation of concerns, design patterns)
  - Operational rules (deployment safety, monitoring, rollbacks)
  - UX rules (accessibility, responsiveness, performance)
  - CSS governance rules (duplicates, variables, specificity)
- **Technology-Specific Rules**:
  - Flask (Python web framework security)
  - Azure (cloud services governance)
  - Stripe (payment processing security)
  - WebSocket (real-time communication)
  - ML/AI (machine learning governance)
  - Testing (coverage and quality standards)
- **Risk Scoring System**: Configurable risk thresholds with automatic action evaluation
- **Human-in-the-Loop Approval**: GitHub Issues-based approval workflow for high-risk actions
- **Comprehensive Audit Logging**:
  - SQLite-based persistent storage
  - Queryable event history with filters
  - Statistics and analytics
  - Export capabilities
  - Webhook support for real-time notifications
- **Rate Limiting**: Multi-scope rate limiting (global, agent, session, user, action type)
- **Task Management**: GitHub-integrated task tracking system
  - Create, update, close, delete tasks
  - Label-based workflow
  - Commit linking
  - Status and priority filtering
- **CSS Governance**:
  - Evaluate CSS before adding (duplicate detection, variable extraction)
  - Cleanup analysis
  - Variable suggestion engine
- **App Monitoring**:
  - Port availability checking
  - HTTP health endpoint monitoring
  - Process information tracking
  - Response time metrics
  - Status history and uptime statistics
- **Project Tracking**:
  - Active agent session monitoring
  - Git repository integration
  - Architecture change detection
- **HTTP Dashboard** (port 3100):
  - Real-time agent activity monitoring
  - Pending approvals management
  - Task board with GitHub integration
  - Audit log viewer
  - App health monitoring
  - WebSocket updates every 2 seconds
- **80+ MCP Tools** for Claude agents:
  - Governance tools (`evaluate_action`, `apply_business_rules`, etc.)
  - Task management tools (`create_task`, `get_tasks`, `update_task`, etc.)
  - App monitoring tools (`add_monitored_app`, `check_app_health`, etc.)
  - Audit tools (`log_event`, `get_audit_events`, `export_audit_log`)
  - CSS tools (`css_eval`, `analyze_css_cleanup`, `suggest_css_variables`)
  - Rules management tools (`list_rules`, `add_rule`, `load_preset`, etc.)
- **Rule Presets**: Pre-configured rule sets for common scenarios
  - `minimal` - Basic security and compliance
  - `standard` - Recommended for most projects
  - `strict` - Maximum governance
  - `financial` - Financial services compliance
  - `healthcare` - HIPAA and healthcare
  - `development` - Developer-friendly defaults
  - `frontend` - Frontend-focused rules
- **Design System**: CSS tokens and base styles for consistent dashboard UI
- **CLI Interface**: Command-line tool for standalone operation
- **TypeScript Support**: Full TypeScript definitions for type safety
- **Comprehensive Test Suite**: Unit tests with Vitest for core components
- **Examples**: Basic usage and custom rules examples
- **Documentation**:
  - Detailed README with architecture overview
  - CONTRIBUTING guide with development workflow
  - Architecture detection specification
  - Security and deployment guide

### Infrastructure
- ESLint and Prettier configuration for code quality
- Automated Playwright cleanup scripts
- SystemD service configuration for production deployment
- MIT License

[Unreleased]: https://github.com/TrentApps-com/ManagerProtocol/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/TrentApps-com/ManagerProtocol/compare/v1.1.3...v1.2.0
[1.1.3]: https://github.com/TrentApps-com/ManagerProtocol/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/TrentApps-com/ManagerProtocol/compare/v1.0.0...v1.1.2
[1.0.0]: https://github.com/TrentApps-com/ManagerProtocol/releases/tag/v1.0.0
