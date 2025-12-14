/**
 * Enterprise Agent Supervisor - Error Utilities
 *
 * Provides custom error types and error handling utilities.
 */

/**
 * Base error class for Agent Supervisor errors
 */
export class AgentSupervisorError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AgentSupervisorError';
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AgentSupervisorError);
    }
  }
}

/**
 * Error thrown when a rule validation fails
 */
export class RuleValidationError extends AgentSupervisorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'RULE_VALIDATION_ERROR', details);
    this.name = 'RuleValidationError';
  }
}

/**
 * Error thrown when a rule is not found
 */
export class RuleNotFoundError extends AgentSupervisorError {
  constructor(ruleId: string) {
    super(`Rule not found: ${ruleId}`, 'RULE_NOT_FOUND', { ruleId });
    this.name = 'RuleNotFoundError';
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitExceededError extends AgentSupervisorError {
  public readonly resetAt: Date;
  public readonly remaining: number;

  constructor(limitId: string, resetAt: Date, remaining: number = 0) {
    super(`Rate limit exceeded: ${limitId}`, 'RATE_LIMIT_EXCEEDED', {
      limitId,
      resetAt: resetAt.toISOString(),
      remaining
    });
    this.name = 'RateLimitExceededError';
    this.resetAt = resetAt;
    this.remaining = remaining;
  }
}

/**
 * Error thrown when an approval request is not found
 */
export class ApprovalNotFoundError extends AgentSupervisorError {
  constructor(requestId: string) {
    super(`Approval request not found: ${requestId}`, 'APPROVAL_NOT_FOUND', { requestId });
    this.name = 'ApprovalNotFoundError';
  }
}

/**
 * Error thrown when an approval request has expired
 */
export class ApprovalExpiredError extends AgentSupervisorError {
  constructor(requestId: string, expiredAt: string) {
    super(`Approval request expired: ${requestId}`, 'APPROVAL_EXPIRED', { requestId, expiredAt });
    this.name = 'ApprovalExpiredError';
  }
}

/**
 * Error thrown for configuration errors
 */
export class ConfigurationError extends AgentSupervisorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

/**
 * Error thrown when webhook delivery fails
 */
export class WebhookDeliveryError extends AgentSupervisorError {
  public readonly url: string;
  public readonly statusCode?: number;
  public readonly retryCount: number;

  constructor(
    url: string,
    cause: Error | string,
    statusCode?: number,
    retryCount: number = 0
  ) {
    const message = typeof cause === 'string' ? cause : cause.message;
    super(`Webhook delivery failed: ${message}`, 'WEBHOOK_DELIVERY_ERROR', {
      url,
      statusCode,
      retryCount
    });
    this.name = 'WebhookDeliveryError';
    this.url = url;
    this.statusCode = statusCode;
    this.retryCount = retryCount;
  }
}

/**
 * Retry configuration options
 */
export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2
};

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < opts.maxRetries) {
        await sleep(delay);
        delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Type guard for checking if an error is an AgentSupervisorError
 */
export function isAgentSupervisorError(error: unknown): error is AgentSupervisorError {
  return error instanceof AgentSupervisorError;
}

/**
 * Format an error for logging
 */
export function formatError(error: unknown): string {
  if (error instanceof AgentSupervisorError) {
    return `[${error.code}] ${error.message}${error.details ? ` - ${JSON.stringify(error.details)}` : ''}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Safe JSON stringify that handles circular references
 */
export function safeStringify(obj: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  });
}
