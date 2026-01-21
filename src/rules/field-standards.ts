/**
 * Enterprise Agent Supervisor - Field Standards
 * Task #33: Standardize Condition Naming and Field References
 *
 * This module defines standard field names for rule conditions to ensure
 * consistency across all rule files. Use these constants when defining
 * rule conditions instead of string literals.
 */

// ============================================================================
// STANDARD FIELD PATHS - Use these constants in rule conditions
// ============================================================================

/**
 * Action-related fields
 * These fields describe the action being evaluated
 */
export const ActionFields = {
  /** The name/identifier of the action (e.g., 'deploy', 'export', 'webhook') */
  NAME: 'action.name',
  /** The category of action (data_access, data_modification, etc.) */
  CATEGORY: 'action.category',
  /** Action parameters object */
  PARAMETERS: 'action.parameters',
  /** Action metadata */
  METADATA: 'action.metadata',
  /** Description of the action */
  DESCRIPTION: 'action.description',

  // Legacy aliases (for backward compatibility during migration)
  /** @deprecated Use ActionFields.NAME instead */
  LEGACY_ACTION_NAME: 'actionName',
  /** @deprecated Use ActionFields.CATEGORY instead */
  LEGACY_ACTION_CATEGORY: 'actionCategory',
} as const;

/**
 * Environment fields
 * Fields describing the execution environment
 */
export const EnvironmentFields = {
  /** The deployment environment (development, staging, production) */
  ENVIRONMENT: 'context.environment',
  /** The platform/framework (flask, azure-functions, etc.) */
  PLATFORM: 'context.platform',
  /** The framework in use */
  FRAMEWORK: 'context.framework',

  // Legacy aliases
  /** @deprecated Use EnvironmentFields.ENVIRONMENT instead */
  LEGACY_ENVIRONMENT: 'environment',
  /** @deprecated Use EnvironmentFields.PLATFORM instead */
  LEGACY_PLATFORM: 'platform',
  /** @deprecated Use EnvironmentFields.FRAMEWORK instead */
  LEGACY_FRAMEWORK: 'framework',
} as const;

/**
 * User and authentication fields
 * Fields related to the user or agent performing the action
 */
export const UserFields = {
  /** User's unique identifier */
  USER_ID: 'context.userId',
  /** User's role (admin, data_officer, etc.) */
  USER_ROLE: 'context.userRole',
  /** Agent's unique identifier */
  AGENT_ID: 'context.agentId',
  /** Agent's type classification */
  AGENT_TYPE: 'context.agentType',
  /** Session identifier */
  SESSION_ID: 'context.sessionId',
  /** Organization identifier */
  ORG_ID: 'context.organizationId',
  /** Department within organization */
  DEPARTMENT: 'context.department',

  // Legacy aliases
  /** @deprecated Use UserFields.USER_ID instead */
  LEGACY_USER_ID: 'userId',
  /** @deprecated Use UserFields.USER_ROLE instead */
  LEGACY_USER_ROLE: 'userRole',
  /** @deprecated Use UserFields.AGENT_ID instead */
  LEGACY_AGENT_ID: 'agentId',
  /** @deprecated Use UserFields.SESSION_ID instead */
  LEGACY_SESSION_ID: 'sessionId',
} as const;

/**
 * Data classification and handling fields
 * Fields describing the data being accessed or modified
 */
export const DataFields = {
  /** Data classification level (public, internal, confidential, restricted) */
  CLASSIFICATION: 'data.classification',
  /** Type of data (phi, cardholder, pan, cvv, pii, etc.) */
  TYPE: 'data.type',
  /** Whether data contains PII */
  CONTAINS_PII: 'data.containsPii',
  /** Number of records affected */
  RECORD_COUNT: 'data.recordCount',
  /** Size of data in bytes */
  SIZE: 'data.size',
  /** Data retention exceeded flag */
  RETENTION_EXCEEDED: 'data.retentionExceeded',
  /** Storage type (localStorage, sessionStorage, indexedDB) */
  STORAGE_TYPE: 'data.storageType',

  // Legacy aliases
  /** @deprecated Use DataFields.CLASSIFICATION instead */
  LEGACY_DATA_CLASSIFICATION: 'dataClassification',
  /** @deprecated Use DataFields.TYPE instead */
  LEGACY_DATA_TYPE: 'dataType',
  /** @deprecated Use DataFields.CONTAINS_PII instead */
  LEGACY_DATA_CONTAINS_PII: 'dataContainsPII',
  /** @deprecated Use DataFields.RECORD_COUNT instead */
  LEGACY_RECORD_COUNT: 'recordCount',
  /** @deprecated Use DataFields.RETENTION_EXCEEDED instead */
  LEGACY_DATA_RETENTION_EXCEEDED: 'dataRetentionExceeded',
  /** @deprecated Use DataFields.STORAGE_TYPE instead */
  LEGACY_STORAGE_TYPE: 'storageType',
} as const;

/**
 * Operation and request fields
 * Fields describing the operation being performed
 */
export const OperationFields = {
  /** The operation type (read, write, delete, upload, etc.) */
  OPERATION: 'operation.type',
  /** HTTP method for API calls */
  HTTP_METHOD: 'operation.httpMethod',
  /** Protocol being used (https, websocket, etc.) */
  PROTOCOL: 'operation.protocol',
  /** File path for file system operations */
  FILE_PATH: 'operation.filePath',
  /** Query string for data access */
  QUERY: 'operation.query',
  /** Request type */
  REQUEST_TYPE: 'operation.requestType',
  /** Target role for authorization operations */
  TARGET_ROLE: 'operation.targetRole',
  /** Destination region for data transfers */
  DESTINATION_REGION: 'operation.destinationRegion',

  // Legacy aliases
  /** @deprecated Use OperationFields.OPERATION instead */
  LEGACY_OPERATION: 'operation',
  /** @deprecated Use OperationFields.HTTP_METHOD instead */
  LEGACY_HTTP_METHOD: 'httpMethod',
  /** @deprecated Use OperationFields.PROTOCOL instead */
  LEGACY_PROTOCOL: 'protocol',
  /** @deprecated Use OperationFields.FILE_PATH instead */
  LEGACY_FILE_PATH: 'filePath',
  /** @deprecated Use OperationFields.QUERY instead */
  LEGACY_QUERY: 'query',
  /** @deprecated Use OperationFields.REQUEST_TYPE instead */
  LEGACY_REQUEST_TYPE: 'requestType',
  /** @deprecated Use OperationFields.TARGET_ROLE instead */
  LEGACY_TARGET_ROLE: 'targetRole',
  /** @deprecated Use OperationFields.DESTINATION_REGION instead */
  LEGACY_DESTINATION_REGION: 'destinationRegion',
} as const;

/**
 * Security and authentication fields
 * Fields related to security state and verification
 */
export const SecurityFields = {
  /** Authentication token present */
  AUTH_TOKEN: 'security.authToken',
  /** Whether the request is authenticated */
  AUTHENTICATED: 'security.authenticated',
  /** Whether code has been validated */
  CODE_VALIDATED: 'security.codeValidated',
  /** Whether request is sandboxed */
  SANDBOXED: 'security.sandboxed',
  /** Whether host is whitelisted */
  HOST_WHITELISTED: 'security.hostWhitelisted',
  /** Whether encryption is enabled */
  ENCRYPTION_ENABLED: 'security.encryptionEnabled',
  /** Session anomaly score (0-1) */
  SESSION_ANOMALY_SCORE: 'security.sessionAnomalyScore',
  /** Webhook signature validation status */
  SIGNATURE_VALIDATED: 'security.signatureValidated',
  /** Input validation status */
  INPUT_VALIDATED: 'security.inputValidated',
  /** File validation status */
  FILE_VALIDATED: 'security.fileValidated',
  /** Whether TLS is enabled */
  TLS_ENABLED: 'security.tlsEnabled',

  // Legacy aliases
  /** @deprecated Use SecurityFields.AUTH_TOKEN instead */
  LEGACY_AUTH_TOKEN: 'authToken',
  /** @deprecated Use SecurityFields.AUTHENTICATED instead */
  LEGACY_AUTHENTICATED: 'authenticated',
  /** @deprecated Use SecurityFields.CODE_VALIDATED instead */
  LEGACY_CODE_VALIDATED: 'codeValidated',
  /** @deprecated Use SecurityFields.SANDBOXED instead */
  LEGACY_SANDBOXED: 'sandboxed',
  /** @deprecated Use SecurityFields.HOST_WHITELISTED instead */
  LEGACY_HOST_WHITELISTED: 'hostWhitelisted',
  /** @deprecated Use SecurityFields.ENCRYPTION_ENABLED instead */
  LEGACY_ENCRYPTION_ENABLED: 'encryptionEnabled',
  /** @deprecated Use SecurityFields.SESSION_ANOMALY_SCORE instead */
  LEGACY_SESSION_ANOMALY_SCORE: 'sessionAnomalyScore',
  /** @deprecated Use SecurityFields.SIGNATURE_VALIDATED instead */
  LEGACY_SIGNATURE_VALIDATED: 'signatureValidated',
  /** @deprecated Use SecurityFields.INPUT_VALIDATED instead */
  LEGACY_INPUT_VALIDATION: 'inputValidation',
  /** @deprecated Use SecurityFields.FILE_VALIDATED instead */
  LEGACY_FILE_VALIDATION: 'fileValidation',
  /** @deprecated Use SecurityFields.TLS_ENABLED instead */
  LEGACY_TLS_ENABLED: 'tlsEnabled',
} as const;

/**
 * Compliance and consent fields
 * Fields related to regulatory compliance
 */
export const ComplianceFields = {
  /** Verification completed status */
  VERIFICATION_COMPLETED: 'compliance.verificationCompleted',
  /** Processing basis (consent, legitimate_interest, etc.) */
  PROCESSING_BASIS: 'compliance.processingBasis',
  /** Consent validity status */
  CONSENT_VALID: 'compliance.consentValid',
  /** Whether data is masked */
  DATA_MASKED: 'compliance.dataMasked',
  /** Business justification provided */
  BUSINESS_JUSTIFICATION: 'compliance.businessJustification',
  /** Number of fields requested */
  FIELDS_REQUESTED: 'compliance.fieldsRequested',
  /** Initiator ID for segregation of duties */
  INITIATOR_ID: 'compliance.initiatorId',
  /** Whether account requirements are validated */
  ACCOUNT_REQUIREMENTS_VALIDATED: 'compliance.accountRequirementsValidated',
  /** SCA enabled for EU payments */
  SCA_ENABLED: 'compliance.scaEnabled',
  /** Customer region */
  CUSTOMER_REGION: 'compliance.customerRegion',

  // Legacy aliases
  /** @deprecated Use ComplianceFields.VERIFICATION_COMPLETED instead */
  LEGACY_VERIFICATION_COMPLETED: 'verificationCompleted',
  /** @deprecated Use ComplianceFields.PROCESSING_BASIS instead */
  LEGACY_PROCESSING_BASIS: 'processingBasis',
  /** @deprecated Use ComplianceFields.CONSENT_VALID instead */
  LEGACY_CONSENT_VALID: 'consentValid',
  /** @deprecated Use ComplianceFields.DATA_MASKED instead */
  LEGACY_MASKED: 'masked',
  /** @deprecated Use ComplianceFields.BUSINESS_JUSTIFICATION instead */
  LEGACY_BUSINESS_JUSTIFICATION: 'businessJustification',
  /** @deprecated Use ComplianceFields.FIELDS_REQUESTED instead */
  LEGACY_FIELDS_REQUESTED: 'fieldsRequested',
  /** @deprecated Use ComplianceFields.INITIATOR_ID instead */
  LEGACY_INITIATOR_ID: 'initiatorId',
  /** @deprecated Use ComplianceFields.ACCOUNT_REQUIREMENTS_VALIDATED instead */
  LEGACY_ACCOUNT_REQUIREMENTS_VALIDATED: 'accountRequirementsValidated',
  /** @deprecated Use ComplianceFields.SCA_ENABLED instead */
  LEGACY_SCA_ENABLED: 'scaEnabled',
  /** @deprecated Use ComplianceFields.CUSTOMER_REGION instead */
  LEGACY_CUSTOMER_REGION: 'customerRegion',
} as const;

/**
 * Operational and system fields
 * Fields related to system operations and limits
 */
export const OperationalFields = {
  /** Estimated cost of operation */
  ESTIMATED_COST: 'operational.estimatedCost',
  /** Resource cost in dollars */
  RESOURCE_COST: 'operational.resourceCost',
  /** Estimated memory usage in MB */
  ESTIMATED_MEMORY_MB: 'operational.estimatedMemoryMb',
  /** Token count for LLM operations */
  TOKEN_COUNT: 'operational.tokenCount',
  /** Daily spend amount */
  DAILY_SPEND: 'operational.dailySpend',
  /** Budget override approved */
  BUDGET_OVERRIDE_APPROVED: 'operational.budgetOverrideApproved',
  /** Deployment window status */
  DEPLOYMENT_WINDOW_OPEN: 'operational.deploymentWindowOpen',
  /** Rollback plan defined */
  ROLLBACK_PLAN_DEFINED: 'operational.rollbackPlanDefined',
  /** Change freeze active */
  CHANGE_FREEZE_ACTIVE: 'operational.changeFreezeActive',
  /** Maintenance window active */
  MAINTENANCE_WINDOW_ACTIVE: 'operational.maintenanceWindowActive',
  /** Backup verified */
  BACKUP_VERIFIED: 'operational.backupVerified',
  /** Incident severity */
  INCIDENT_SEVERITY: 'operational.incidentSeverity',
  /** Session action count */
  SESSION_ACTION_COUNT: 'operational.sessionActionCount',
  /** Retry count */
  RETRY_COUNT: 'operational.retryCount',
  /** Action pattern (loop detection) */
  ACTION_PATTERN: 'operational.actionPattern',
  /** Concurrent count */
  CONCURRENT_COUNT: 'operational.concurrentCount',
  /** Operation type */
  OPERATION_TYPE: 'operational.operationType',
  /** Timeout configuration in ms */
  TIMEOUT_MS: 'operational.timeoutMs',

  // Legacy aliases
  /** @deprecated Use OperationalFields.ESTIMATED_COST instead */
  LEGACY_ESTIMATED_COST: 'estimatedCost',
  /** @deprecated Use OperationalFields.RESOURCE_COST instead */
  LEGACY_RESOURCE_COST: 'resourceCost',
  /** @deprecated Use OperationalFields.ESTIMATED_MEMORY_MB instead */
  LEGACY_ESTIMATED_MEMORY_MB: 'estimatedMemoryMb',
  /** @deprecated Use OperationalFields.TOKEN_COUNT instead */
  LEGACY_TOKEN_COUNT: 'tokenCount',
  /** @deprecated Use OperationalFields.DAILY_SPEND instead */
  LEGACY_DAILY_SPEND: 'dailySpend',
  /** @deprecated Use OperationalFields.DEPLOYMENT_WINDOW_OPEN instead */
  LEGACY_DEPLOYMENT_WINDOW_OPEN: 'deploymentWindowOpen',
  /** @deprecated Use OperationalFields.ROLLBACK_PLAN_DEFINED instead */
  LEGACY_ROLLBACK_PLAN_DEFINED: 'rollbackPlanDefined',
  /** @deprecated Use OperationalFields.CHANGE_FREEZE_ACTIVE instead */
  LEGACY_CHANGE_FREEZE_ACTIVE: 'changeFreezeActive',
  /** @deprecated Use OperationalFields.MAINTENANCE_WINDOW_ACTIVE instead */
  LEGACY_MAINTENANCE_WINDOW_ACTIVE: 'maintenanceWindowActive',
  /** @deprecated Use OperationalFields.BACKUP_VERIFIED instead */
  LEGACY_BACKUP_VERIFIED: 'backupVerified',
  /** @deprecated Use OperationalFields.INCIDENT_SEVERITY instead */
  LEGACY_INCIDENT_SEVERITY: 'incidentSeverity',
  /** @deprecated Use OperationalFields.SESSION_ACTION_COUNT instead */
  LEGACY_SESSION_ACTION_COUNT: 'sessionActionCount',
  /** @deprecated Use OperationalFields.RETRY_COUNT instead */
  LEGACY_RETRY_COUNT: 'retryCount',
  /** @deprecated Use OperationalFields.ACTION_PATTERN instead */
  LEGACY_ACTION_PATTERN: 'actionPattern',
  /** @deprecated Use OperationalFields.CONCURRENT_COUNT instead */
  LEGACY_CONCURRENT_COUNT: 'concurrentCount',
  /** @deprecated Use OperationalFields.TIMEOUT_MS instead */
  LEGACY_TIMEOUT: 'timeout',
} as const;

/**
 * Testing and QA fields
 * Fields specific to testing operations
 */
export const TestingFields = {
  /** Whether the operation is a test */
  IS_TEST: 'testing.isTest',
  /** Test type (unit, integration, e2e) */
  TEST_TYPE: 'testing.testType',
  /** Test isolation status */
  TEST_ISOLATION: 'testing.testIsolation',
  /** Test cleanup status */
  HAS_CLEANUP: 'testing.hasCleanup',
  /** Execution time in ms */
  EXECUTION_TIME_MS: 'testing.executionTimeMs',
  /** Uses random wait (anti-pattern) */
  USES_RANDOM_WAIT: 'testing.usesRandomWait',
  /** Runs in parallel */
  RUNS_IN_PARALLEL: 'testing.runsInParallel',
  /** Parallel safe */
  PARALLEL_SAFE: 'testing.parallelSafe',
  /** Screenshot retention days */
  SCREENSHOT_RETENTION_DAYS: 'testing.screenshotRetentionDays',

  // Legacy aliases
  /** @deprecated Use TestingFields.IS_TEST instead */
  LEGACY_IS_TEST: 'isTest',
  /** @deprecated Use TestingFields.TEST_TYPE instead */
  LEGACY_TEST_TYPE: 'testType',
  /** @deprecated Use TestingFields.TEST_ISOLATION instead */
  LEGACY_TEST_ISOLATION: 'testIsolation',
  /** @deprecated Use TestingFields.HAS_CLEANUP instead */
  LEGACY_HAS_CLEANUP: 'hasCleanup',
  /** @deprecated Use TestingFields.EXECUTION_TIME_MS instead */
  LEGACY_EXECUTION_TIME_MS: 'executionTimeMs',
  /** @deprecated Use TestingFields.USES_RANDOM_WAIT instead */
  LEGACY_USES_RANDOM_WAIT: 'usesRandomWait',
  /** @deprecated Use TestingFields.RUNS_IN_PARALLEL instead */
  LEGACY_RUNS_IN_PARALLEL: 'runsInParallel',
  /** @deprecated Use TestingFields.PARALLEL_SAFE instead */
  LEGACY_PARALLEL_SAFE: 'parallelSafe',
} as const;

/**
 * API and external service fields
 * Fields related to API calls and external integrations
 */
export const ApiFields = {
  /** API version */
  API_VERSION: 'api.version',
  /** Rate limit headers included */
  RATE_LIMIT_HEADERS_INCLUDED: 'api.rateLimitHeadersIncluded',
  /** Idempotency key */
  IDEMPOTENCY_KEY: 'api.idempotencyKey',
  /** Circuit breaker enabled */
  CIRCUIT_BREAKER_ENABLED: 'api.circuitBreakerEnabled',
  /** Retry policy defined */
  RETRY_POLICY: 'api.retryPolicy',
  /** Whether operation is idempotent */
  IS_IDEMPOTENT: 'api.isIdempotent',
  /** Provider name (stripe, azure-openai, etc.) */
  PROVIDER: 'api.provider',
  /** Respects rate limits */
  RESPECTS_RATE_LIMITS: 'api.respectsRateLimits',

  // Legacy aliases
  /** @deprecated Use ApiFields.API_VERSION instead */
  LEGACY_API_VERSION: 'apiVersion',
  /** @deprecated Use ApiFields.RATE_LIMIT_HEADERS_INCLUDED instead */
  LEGACY_RATE_LIMIT_HEADERS_INCLUDED: 'rateLimitHeadersIncluded',
  /** @deprecated Use ApiFields.IDEMPOTENCY_KEY instead */
  LEGACY_IDEMPOTENCY_KEY: 'idempotencyKey',
  /** @deprecated Use ApiFields.CIRCUIT_BREAKER_ENABLED instead */
  LEGACY_CIRCUIT_BREAKER_ENABLED: 'circuitBreakerEnabled',
  /** @deprecated Use ApiFields.RETRY_POLICY instead */
  LEGACY_RETRY_POLICY: 'retryPolicy',
  /** @deprecated Use ApiFields.IS_IDEMPOTENT instead */
  LEGACY_IS_IDEMPOTENT: 'isIdempotent',
  /** @deprecated Use ApiFields.PROVIDER instead */
  LEGACY_PROVIDER: 'provider',
  /** @deprecated Use ApiFields.RESPECTS_RATE_LIMITS instead */
  LEGACY_RESPECTS_RATE_LIMITS: 'respectsRateLimits',
} as const;

/**
 * UX and communication fields
 * Fields related to user experience
 */
export const UxFields = {
  /** Response length in characters */
  RESPONSE_LENGTH: 'ux.responseLength',
  /** User type (technical, non_technical) */
  USER_TYPE: 'ux.userType',
  /** Technical term count */
  TECHNICAL_TERM_COUNT: 'ux.technicalTermCount',
  /** Recovery steps included */
  INCLUDES_RECOVERY_STEPS: 'ux.includesRecoverySteps',
  /** Confirmation required */
  CONFIRMATION_REQUIRED: 'ux.confirmationRequired',
  /** Estimated duration in ms */
  ESTIMATED_DURATION_MS: 'ux.estimatedDurationMs',
  /** Progress callback enabled */
  PROGRESS_CALLBACK_ENABLED: 'ux.progressCallbackEnabled',
  /** Undo supported */
  UNDO_SUPPORTED: 'ux.undoSupported',
  /** User initiated */
  USER_INITIATED: 'ux.userInitiated',
  /** Notifications in last hour */
  NOTIFICATIONS_LAST_HOUR: 'ux.notificationsLastHour',
  /** Prompts in last minute */
  PROMPTS_LAST_MINUTE: 'ux.promptsLastMinute',
  /** Loading indicator enabled */
  LOADING_INDICATOR_ENABLED: 'ux.loadingIndicatorEnabled',
  /** Timeout warning enabled */
  TIMEOUT_WARNING_ENABLED: 'ux.timeoutWarningEnabled',
  /** Alt text exists */
  ALT_TEXT: 'ux.altText',
  /** Contrast ratio met */
  CONTRAST_RATIO_MET: 'ux.contrastRatioMet',
  /** Keyboard accessible */
  KEYBOARD_ACCESSIBLE: 'ux.keyboardAccessible',
  /** Result count */
  RESULT_COUNT: 'ux.resultCount',
  /** Empty state message */
  EMPTY_STATE_MESSAGE: 'ux.emptyStateMessage',
  /** Is async operation */
  IS_ASYNC: 'ux.isAsync',
  /** Has timeout */
  HAS_TIMEOUT: 'ux.hasTimeout',
  /** Content type */
  CONTENT_TYPE: 'ux.contentType',
  /** Has color content */
  HAS_COLOR_CONTENT: 'ux.hasColorContent',

  // Legacy aliases
  /** @deprecated Use UxFields.RESPONSE_LENGTH instead */
  LEGACY_RESPONSE_LENGTH: 'responseLength',
  /** @deprecated Use UxFields.USER_TYPE instead */
  LEGACY_USER_TYPE: 'userType',
  /** @deprecated Use UxFields.TECHNICAL_TERM_COUNT instead */
  LEGACY_TECHNICAL_TERM_COUNT: 'technicalTermCount',
  /** @deprecated Use UxFields.INCLUDES_RECOVERY_STEPS instead */
  LEGACY_INCLUDES_RECOVERY_STEPS: 'includesRecoverySteps',
  /** @deprecated Use UxFields.CONFIRMATION_REQUIRED instead */
  LEGACY_CONFIRMATION_REQUIRED: 'confirmationRequired',
  /** @deprecated Use UxFields.ESTIMATED_DURATION_MS instead */
  LEGACY_ESTIMATED_DURATION_MS: 'estimatedDurationMs',
  /** @deprecated Use UxFields.PROGRESS_CALLBACK_ENABLED instead */
  LEGACY_PROGRESS_CALLBACK_ENABLED: 'progressCallbackEnabled',
  /** @deprecated Use UxFields.UNDO_SUPPORTED instead */
  LEGACY_UNDO_SUPPORTED: 'undoSupported',
  /** @deprecated Use UxFields.USER_INITIATED instead */
  LEGACY_USER_INITIATED: 'userInitiated',
  /** @deprecated Use UxFields.NOTIFICATIONS_LAST_HOUR instead */
  LEGACY_NOTIFICATIONS_LAST_HOUR: 'notificationsLastHour',
  /** @deprecated Use UxFields.IS_ASYNC instead */
  LEGACY_IS_ASYNC: 'isAsync',
  /** @deprecated Use UxFields.CONTENT_TYPE instead */
  LEGACY_CONTENT_TYPE: 'contentType',
} as const;

/**
 * WebSocket and real-time fields
 */
export const WebSocketFields = {
  /** WebSocket protocol */
  PROTOCOL: 'websocket.protocol',
  /** Message rate limit enabled */
  MESSAGE_RATE_LIMIT_ENABLED: 'websocket.messageRateLimitEnabled',
  /** Message type (text, binary) */
  MESSAGE_TYPE: 'websocket.messageType',
  /** Max message size */
  MAX_MESSAGE_SIZE: 'websocket.maxMessageSize',
  /** Heartbeat enabled */
  HEARTBEAT_ENABLED: 'websocket.heartbeatEnabled',
  /** Concurrent connections */
  CONCURRENT_CONNECTIONS: 'websocket.concurrentConnections',
  /** Message validation enabled */
  MESSAGE_VALIDATION: 'websocket.messageValidation',

  // Legacy aliases
  /** @deprecated Use WebSocketFields.MESSAGE_RATE_LIMIT_ENABLED instead */
  LEGACY_MESSAGE_RATE_LIMIT_ENABLED: 'messageRateLimitEnabled',
  /** @deprecated Use WebSocketFields.MAX_MESSAGE_SIZE instead */
  LEGACY_MAX_MESSAGE_SIZE: 'maxMessageSize',
  /** @deprecated Use WebSocketFields.HEARTBEAT_ENABLED instead */
  LEGACY_HEARTBEAT_ENABLED: 'heartbeatEnabled',
  /** @deprecated Use WebSocketFields.CONCURRENT_CONNECTIONS instead */
  LEGACY_CONCURRENT_CONNECTIONS: 'concurrentConnections',
  /** @deprecated Use WebSocketFields.MESSAGE_VALIDATION instead */
  LEGACY_MESSAGE_VALIDATION: 'messageValidation',
} as const;

/**
 * ML/AI specific fields
 */
export const MlAiFields = {
  /** OOM handling configured */
  OOM_HANDLING: 'mlai.oomHandling',
  /** Unload strategy defined */
  UNLOAD_STRATEGY: 'mlai.unloadStrategy',
  /** Inference batch size */
  BATCH_SIZE: 'mlai.batchSize',
  /** Content safety filter enabled */
  CONTENT_SAFETY_FILTER: 'mlai.contentSafetyFilter',
  /** GPU memory usage (0-1) */
  GPU_MEMORY_USAGE: 'mlai.gpuMemoryUsage',
  /** Model version */
  MODEL_VERSION: 'mlai.modelVersion',

  // Legacy aliases
  /** @deprecated Use MlAiFields.OOM_HANDLING instead */
  LEGACY_OOM_HANDLING: 'oomHandling',
  /** @deprecated Use MlAiFields.UNLOAD_STRATEGY instead */
  LEGACY_UNLOAD_STRATEGY: 'unloadStrategy',
  /** @deprecated Use MlAiFields.BATCH_SIZE instead */
  LEGACY_BATCH_SIZE: 'batchSize',
  /** @deprecated Use MlAiFields.CONTENT_SAFETY_FILTER instead */
  LEGACY_CONTENT_SAFETY_FILTER: 'contentSafetyFilter',
  /** @deprecated Use MlAiFields.GPU_MEMORY_USAGE instead */
  LEGACY_GPU_MEMORY_USAGE: 'gpuMemoryUsage',
  /** @deprecated Use MlAiFields.MODEL_VERSION instead */
  LEGACY_MODEL_VERSION: 'modelVersion',
} as const;

/**
 * Framework-specific fields (Flask, Azure, etc.)
 */
export const FrameworkFields = {
  // Flask
  /** Flask debug mode enabled */
  FLASK_DEBUG_ENABLED: 'flask.debugEnabled',
  /** CORS origins setting */
  CORS_ORIGINS: 'flask.corsOrigins',
  /** Max content length */
  MAX_CONTENT_LENGTH: 'flask.maxContentLength',
  /** Secret key strength */
  SECRET_KEY_STRENGTH: 'flask.secretKeyStrength',
  /** Jinja auto escape enabled */
  JINJA_AUTO_ESCAPE: 'flask.jinjaAutoEscape',
  /** HTTPS enforced */
  HTTPS_ENFORCED: 'flask.httpsEnforced',
  /** Session cookie secure */
  SESSION_COOKIE_SECURE: 'flask.sessionCookieSecure',

  // Azure
  /** Azure database type (cosmos-db) */
  DATABASE: 'azure.database',
  /** RU usage percent */
  RU_USAGE_PERCENT: 'azure.ruUsagePercent',
  /** Uses connection string */
  USES_CONNECTION_STRING: 'azure.usesConnectionString',
  /** App Insights enabled */
  APP_INSIGHTS_ENABLED: 'azure.appInsightsEnabled',
  /** Partition key optimized */
  PARTITION_KEY_OPTIMIZED: 'azure.partitionKeyOptimized',
  /** CORS configured */
  CORS_CONFIGURED: 'azure.corsConfigured',

  // Legacy aliases
  /** @deprecated Use FrameworkFields.FLASK_DEBUG_ENABLED instead */
  LEGACY_FLASK_DEBUG_ENABLED: 'flaskDebugEnabled',
  /** @deprecated Use FrameworkFields.CORS_ORIGINS instead */
  LEGACY_CORS_ORIGINS: 'corsOrigins',
  /** @deprecated Use FrameworkFields.MAX_CONTENT_LENGTH instead */
  LEGACY_MAX_CONTENT_LENGTH: 'maxContentLength',
  /** @deprecated Use FrameworkFields.SECRET_KEY_STRENGTH instead */
  LEGACY_SECRET_KEY_STRENGTH: 'secretKeyStrength',
  /** @deprecated Use FrameworkFields.JINJA_AUTO_ESCAPE instead */
  LEGACY_JINJA_AUTO_ESCAPE: 'jinjaAutoEscape',
  /** @deprecated Use FrameworkFields.HTTPS_ENFORCED instead */
  LEGACY_HTTPS_ENFORCED: 'httpsEnforced',
  /** @deprecated Use FrameworkFields.SESSION_COOKIE_SECURE instead */
  LEGACY_SESSION_COOKIE_SECURE: 'sessionCookieSecure',
  /** @deprecated Use FrameworkFields.DATABASE instead */
  LEGACY_DATABASE: 'database',
  /** @deprecated Use FrameworkFields.RU_USAGE_PERCENT instead */
  LEGACY_RU_USAGE_PERCENT: 'ruUsagePercent',
  /** @deprecated Use FrameworkFields.USES_CONNECTION_STRING instead */
  LEGACY_USES_CONNECTION_STRING: 'usesConnectionString',
  /** @deprecated Use FrameworkFields.APP_INSIGHTS_ENABLED instead */
  LEGACY_APP_INSIGHTS_ENABLED: 'appInsightsEnabled',
  /** @deprecated Use FrameworkFields.PARTITION_KEY_OPTIMIZED instead */
  LEGACY_PARTITION_KEY_OPTIMIZED: 'partitionKeyOptimized',
  /** @deprecated Use FrameworkFields.CORS_CONFIGURED instead */
  LEGACY_CORS_CONFIGURED: 'corsConfigured',
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** All standard field paths as a union type */
export type StandardFieldPath =
  | typeof ActionFields[keyof typeof ActionFields]
  | typeof EnvironmentFields[keyof typeof EnvironmentFields]
  | typeof UserFields[keyof typeof UserFields]
  | typeof DataFields[keyof typeof DataFields]
  | typeof OperationFields[keyof typeof OperationFields]
  | typeof SecurityFields[keyof typeof SecurityFields]
  | typeof ComplianceFields[keyof typeof ComplianceFields]
  | typeof OperationalFields[keyof typeof OperationalFields]
  | typeof TestingFields[keyof typeof TestingFields]
  | typeof ApiFields[keyof typeof ApiFields]
  | typeof UxFields[keyof typeof UxFields]
  | typeof WebSocketFields[keyof typeof WebSocketFields]
  | typeof MlAiFields[keyof typeof MlAiFields]
  | typeof FrameworkFields[keyof typeof FrameworkFields];

/** Field category names */
export type FieldCategory =
  | 'action'
  | 'context'
  | 'data'
  | 'operation'
  | 'security'
  | 'compliance'
  | 'operational'
  | 'testing'
  | 'api'
  | 'ux'
  | 'websocket'
  | 'mlai'
  | 'flask'
  | 'azure'
  | 'css';

// ============================================================================
// LEGACY FIELD MAPPINGS
// ============================================================================

/**
 * Mapping from legacy field names to standard field paths
 * Used for migration and backward compatibility
 */
export const LegacyFieldMappings: Record<string, string> = {
  // Action fields
  'actionName': ActionFields.NAME,
  'actionCategory': ActionFields.CATEGORY,

  // Environment fields
  'environment': EnvironmentFields.ENVIRONMENT,
  'platform': EnvironmentFields.PLATFORM,
  'framework': EnvironmentFields.FRAMEWORK,

  // User fields
  'userId': UserFields.USER_ID,
  'userRole': UserFields.USER_ROLE,
  'agentId': UserFields.AGENT_ID,
  'sessionId': UserFields.SESSION_ID,

  // Data fields
  'dataClassification': DataFields.CLASSIFICATION,
  'dataType': DataFields.TYPE,
  'dataContainsPII': DataFields.CONTAINS_PII,
  'recordCount': DataFields.RECORD_COUNT,
  'dataRetentionExceeded': DataFields.RETENTION_EXCEEDED,
  'storageType': DataFields.STORAGE_TYPE,

  // Operation fields
  'operation': OperationFields.OPERATION,
  'httpMethod': OperationFields.HTTP_METHOD,
  'protocol': OperationFields.PROTOCOL,
  'filePath': OperationFields.FILE_PATH,
  'query': OperationFields.QUERY,
  'requestType': OperationFields.REQUEST_TYPE,
  'targetRole': OperationFields.TARGET_ROLE,
  'destinationRegion': OperationFields.DESTINATION_REGION,

  // Security fields
  'authToken': SecurityFields.AUTH_TOKEN,
  'authenticated': SecurityFields.AUTHENTICATED,
  'codeValidated': SecurityFields.CODE_VALIDATED,
  'sandboxed': SecurityFields.SANDBOXED,
  'hostWhitelisted': SecurityFields.HOST_WHITELISTED,
  'encryptionEnabled': SecurityFields.ENCRYPTION_ENABLED,
  'sessionAnomalyScore': SecurityFields.SESSION_ANOMALY_SCORE,
  'signatureValidated': SecurityFields.SIGNATURE_VALIDATED,
  'inputValidation': SecurityFields.INPUT_VALIDATED,
  'fileValidation': SecurityFields.FILE_VALIDATED,
  'tlsEnabled': SecurityFields.TLS_ENABLED,

  // Compliance fields
  'verificationCompleted': ComplianceFields.VERIFICATION_COMPLETED,
  'processingBasis': ComplianceFields.PROCESSING_BASIS,
  'consentValid': ComplianceFields.CONSENT_VALID,
  'masked': ComplianceFields.DATA_MASKED,
  'businessJustification': ComplianceFields.BUSINESS_JUSTIFICATION,
  'fieldsRequested': ComplianceFields.FIELDS_REQUESTED,
  'initiatorId': ComplianceFields.INITIATOR_ID,
  'accountRequirementsValidated': ComplianceFields.ACCOUNT_REQUIREMENTS_VALIDATED,
  'scaEnabled': ComplianceFields.SCA_ENABLED,
  'customerRegion': ComplianceFields.CUSTOMER_REGION,

  // Operational fields
  'estimatedCost': OperationalFields.ESTIMATED_COST,
  'resourceCost': OperationalFields.RESOURCE_COST,
  'estimatedMemoryMb': OperationalFields.ESTIMATED_MEMORY_MB,
  'tokenCount': OperationalFields.TOKEN_COUNT,
  'dailySpend': OperationalFields.DAILY_SPEND,
  'deploymentWindowOpen': OperationalFields.DEPLOYMENT_WINDOW_OPEN,
  'rollbackPlanDefined': OperationalFields.ROLLBACK_PLAN_DEFINED,
  'changeFreezeActive': OperationalFields.CHANGE_FREEZE_ACTIVE,
  'maintenanceWindowActive': OperationalFields.MAINTENANCE_WINDOW_ACTIVE,
  'backupVerified': OperationalFields.BACKUP_VERIFIED,
  'incidentSeverity': OperationalFields.INCIDENT_SEVERITY,
  'sessionActionCount': OperationalFields.SESSION_ACTION_COUNT,
  'retryCount': OperationalFields.RETRY_COUNT,
  'actionPattern': OperationalFields.ACTION_PATTERN,
  'concurrentCount': OperationalFields.CONCURRENT_COUNT,
  'timeout': OperationalFields.TIMEOUT_MS,

  // Testing fields
  'isTest': TestingFields.IS_TEST,
  'testType': TestingFields.TEST_TYPE,
  'testIsolation': TestingFields.TEST_ISOLATION,
  'hasCleanup': TestingFields.HAS_CLEANUP,
  'executionTimeMs': TestingFields.EXECUTION_TIME_MS,
  'usesRandomWait': TestingFields.USES_RANDOM_WAIT,
  'runsInParallel': TestingFields.RUNS_IN_PARALLEL,
  'parallelSafe': TestingFields.PARALLEL_SAFE,

  // API fields
  'apiVersion': ApiFields.API_VERSION,
  'rateLimitHeadersIncluded': ApiFields.RATE_LIMIT_HEADERS_INCLUDED,
  'idempotencyKey': ApiFields.IDEMPOTENCY_KEY,
  'circuitBreakerEnabled': ApiFields.CIRCUIT_BREAKER_ENABLED,
  'retryPolicy': ApiFields.RETRY_POLICY,
  'isIdempotent': ApiFields.IS_IDEMPOTENT,
  'provider': ApiFields.PROVIDER,
  'respectsRateLimits': ApiFields.RESPECTS_RATE_LIMITS,

  // UX fields
  'responseLength': UxFields.RESPONSE_LENGTH,
  'userType': UxFields.USER_TYPE,
  'technicalTermCount': UxFields.TECHNICAL_TERM_COUNT,
  'includesRecoverySteps': UxFields.INCLUDES_RECOVERY_STEPS,
  'confirmationRequired': UxFields.CONFIRMATION_REQUIRED,
  'estimatedDurationMs': UxFields.ESTIMATED_DURATION_MS,
  'progressCallbackEnabled': UxFields.PROGRESS_CALLBACK_ENABLED,
  'undoSupported': UxFields.UNDO_SUPPORTED,
  'userInitiated': UxFields.USER_INITIATED,
  'notificationsLastHour': UxFields.NOTIFICATIONS_LAST_HOUR,
  'isAsync': UxFields.IS_ASYNC,
  'contentType': UxFields.CONTENT_TYPE,

  // WebSocket fields
  'messageRateLimitEnabled': WebSocketFields.MESSAGE_RATE_LIMIT_ENABLED,
  'maxMessageSize': WebSocketFields.MAX_MESSAGE_SIZE,
  'heartbeatEnabled': WebSocketFields.HEARTBEAT_ENABLED,
  'concurrentConnections': WebSocketFields.CONCURRENT_CONNECTIONS,
  'messageValidation': WebSocketFields.MESSAGE_VALIDATION,

  // ML/AI fields
  'oomHandling': MlAiFields.OOM_HANDLING,
  'unloadStrategy': MlAiFields.UNLOAD_STRATEGY,
  'batchSize': MlAiFields.BATCH_SIZE,
  'contentSafetyFilter': MlAiFields.CONTENT_SAFETY_FILTER,
  'gpuMemoryUsage': MlAiFields.GPU_MEMORY_USAGE,
  'modelVersion': MlAiFields.MODEL_VERSION,

  // Framework fields
  'flaskDebugEnabled': FrameworkFields.FLASK_DEBUG_ENABLED,
  'corsOrigins': FrameworkFields.CORS_ORIGINS,
  'maxContentLength': FrameworkFields.MAX_CONTENT_LENGTH,
  'secretKeyStrength': FrameworkFields.SECRET_KEY_STRENGTH,
  'jinjaAutoEscape': FrameworkFields.JINJA_AUTO_ESCAPE,
  'httpsEnforced': FrameworkFields.HTTPS_ENFORCED,
  'sessionCookieSecure': FrameworkFields.SESSION_COOKIE_SECURE,
  'database': FrameworkFields.DATABASE,
  'ruUsagePercent': FrameworkFields.RU_USAGE_PERCENT,
  'usesConnectionString': FrameworkFields.USES_CONNECTION_STRING,
  'appInsightsEnabled': FrameworkFields.APP_INSIGHTS_ENABLED,
  'partitionKeyOptimized': FrameworkFields.PARTITION_KEY_OPTIMIZED,
  'corsConfigured': FrameworkFields.CORS_CONFIGURED,
};

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Set of all known legacy field names for validation
 */
const knownLegacyFields = new Set(Object.keys(LegacyFieldMappings));

/**
 * Set of all standard field paths
 */
const standardFields = new Set<string>();

// Populate standard fields from all field constants
[
  ActionFields, EnvironmentFields, UserFields, DataFields, OperationFields,
  SecurityFields, ComplianceFields, OperationalFields, TestingFields,
  ApiFields, UxFields, WebSocketFields, MlAiFields, FrameworkFields
].forEach(fieldSet => {
  Object.values(fieldSet).forEach(value => {
    if (!value.startsWith('LEGACY_')) {
      standardFields.add(value);
    }
  });
});

/**
 * Field validation result
 */
export interface FieldValidationResult {
  /** Whether the field is valid (known) */
  valid: boolean;
  /** Whether this is a legacy field that should be migrated */
  isLegacy: boolean;
  /** The standard field path to use (if migrating from legacy) */
  standardPath?: string;
  /** Warning message if applicable */
  warning?: string;
  /** Suggestion for unknown fields */
  suggestion?: string;
}

/**
 * Validate a field name and provide migration guidance
 *
 * @param field - The field name to validate
 * @returns Validation result with migration guidance
 */
export function validateFieldName(field: string): FieldValidationResult {
  // Check if it's a standard field path
  if (standardFields.has(field)) {
    return { valid: true, isLegacy: false };
  }

  // Check if it's a known legacy field
  if (knownLegacyFields.has(field)) {
    const standardPath = LegacyFieldMappings[field];
    return {
      valid: true,
      isLegacy: true,
      standardPath,
      warning: `Field '${field}' is using legacy naming. Consider migrating to '${standardPath}'`
    };
  }

  // CSS-specific fields are handled separately and are valid
  if (field.startsWith('css') || field.startsWith('has') || field.startsWith('is') || field.startsWith('uses')) {
    // These are domain-specific fields that may not have standard paths
    return {
      valid: true,
      isLegacy: false,
      suggestion: `Field '${field}' appears to be domain-specific. Consider adding to field-standards.ts if used across multiple rules.`
    };
  }

  // Unknown field - provide suggestions
  const possibleMatches = findSimilarFields(field);
  return {
    valid: false,
    isLegacy: false,
    warning: `Unknown field '${field}'`,
    suggestion: possibleMatches.length > 0
      ? `Did you mean: ${possibleMatches.join(', ')}?`
      : 'Consider adding this field to field-standards.ts'
  };
}

/**
 * Find similar field names using Levenshtein distance
 */
function findSimilarFields(field: string, maxDistance: number = 3): string[] {
  const similar: string[] = [];
  const allFields = [...knownLegacyFields, ...standardFields];

  for (const knownField of allFields) {
    const distance = levenshteinDistance(field.toLowerCase(), knownField.toLowerCase());
    if (distance <= maxDistance) {
      similar.push(knownField);
    }
  }

  return similar.slice(0, 3);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Validate all fields in a rule's conditions
 *
 * @param conditions - Array of rule conditions to validate
 * @returns Array of validation results for each condition
 */
export function validateRuleConditions(conditions: Array<{ field: string }>): FieldValidationResult[] {
  return conditions.map(condition => validateFieldName(condition.field));
}

/**
 * Get all legacy field warnings for a set of rules
 *
 * @param rules - Array of rules to check
 * @returns Array of warnings about legacy field usage
 */
export function getLegacyFieldWarnings(rules: Array<{ id: string; conditions: Array<{ field: string }> }>): Array<{
  ruleId: string;
  field: string;
  warning: string;
  standardPath: string;
}> {
  const warnings: Array<{
    ruleId: string;
    field: string;
    warning: string;
    standardPath: string;
  }> = [];

  for (const rule of rules) {
    for (const condition of rule.conditions) {
      const result = validateFieldName(condition.field);
      if (result.isLegacy && result.standardPath && result.warning) {
        warnings.push({
          ruleId: rule.id,
          field: condition.field,
          warning: result.warning,
          standardPath: result.standardPath
        });
      }
    }
  }

  return warnings;
}

/**
 * Convert a legacy field name to its standard path
 *
 * @param legacyField - The legacy field name
 * @returns The standard field path, or the original if not found
 */
export function toStandardFieldPath(legacyField: string): string {
  return LegacyFieldMappings[legacyField] || legacyField;
}

// ============================================================================
// EXPORT CONVENIENCE OBJECT
// ============================================================================

/**
 * All field constants organized by category
 */
export const Fields = {
  Action: ActionFields,
  Environment: EnvironmentFields,
  User: UserFields,
  Data: DataFields,
  Operation: OperationFields,
  Security: SecurityFields,
  Compliance: ComplianceFields,
  Operational: OperationalFields,
  Testing: TestingFields,
  Api: ApiFields,
  Ux: UxFields,
  WebSocket: WebSocketFields,
  MlAi: MlAiFields,
  Framework: FrameworkFields,
} as const;

export default Fields;
