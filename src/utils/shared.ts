/**
 * Enterprise Agent Supervisor - Shared Utilities
 *
 * Common utility functions used across the codebase.
 * Extracted from various modules to reduce duplication and ensure consistency.
 *
 * Tasks: #40, #41, #42, #48
 */

// ============================================================================
// HASH UTILITIES (#42)
// ============================================================================

/**
 * Simple string hash function for generating IDs.
 * Uses a fast, non-cryptographic hash algorithm (djb2 variant).
 *
 * @param str - The string to hash
 * @param options - Optional configuration
 * @returns Hexadecimal hash string (default) or base36 string
 *
 * @example
 * ```typescript
 * hashString('hello world'); // Returns: 'a3e45bc1'
 * hashString('hello world', { base: 36 }); // Returns: 'x7k2m'
 * hashString('hello world', { length: 16 }); // Returns: '00000000a3e45bc1'
 * ```
 */
export function hashString(
  str: string,
  options: { base?: 16 | 36; length?: number } = {}
): string {
  const { base = 16, length = 8 } = options;

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  const result = Math.abs(hash).toString(base);
  return result.substring(0, length);
}

// ============================================================================
// TIME WINDOW UTILITIES (#41)
// ============================================================================

/**
 * Options for TimeWindow calculations
 */
export interface TimeWindowOptions {
  /** Duration in milliseconds. Defaults to 24 hours */
  durationMs?: number;
  /** Reference time (defaults to Date.now()) */
  referenceTime?: number;
}

/**
 * Result of a time window check
 */
export interface TimeWindowResult {
  /** Start of the window (ISO timestamp) */
  start: string;
  /** End of the window (ISO timestamp) */
  end: string;
  /** Start timestamp in milliseconds */
  startMs: number;
  /** End timestamp in milliseconds */
  endMs: number;
  /** Whether a given timestamp is within this window */
  contains: (timestamp: string | number | Date) => boolean;
}

/**
 * Common time window durations
 */
export const TimeWindows = {
  /** 1 hour in milliseconds */
  HOUR: 60 * 60 * 1000,
  /** 24 hours in milliseconds */
  DAY: 24 * 60 * 60 * 1000,
  /** 7 days in milliseconds */
  WEEK: 7 * 24 * 60 * 60 * 1000,
  /** 30 days in milliseconds */
  MONTH: 30 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Create a time window for filtering data.
 *
 * @param options - Time window options
 * @returns TimeWindowResult with start/end times and contains() function
 *
 * @example
 * ```typescript
 * // Last 24 hours
 * const window = createTimeWindow();
 *
 * // Last hour
 * const hourWindow = createTimeWindow({ durationMs: TimeWindows.HOUR });
 *
 * // Check if a timestamp is in the window
 * if (window.contains(event.timestamp)) {
 *   // Event is within the time window
 * }
 * ```
 */
export function createTimeWindow(options: TimeWindowOptions = {}): TimeWindowResult {
  const { durationMs = TimeWindows.DAY, referenceTime = Date.now() } = options;

  const endMs = referenceTime;
  const startMs = endMs - durationMs;

  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    startMs,
    endMs,
    contains: (timestamp: string | number | Date): boolean => {
      const ts = typeof timestamp === 'string'
        ? new Date(timestamp).getTime()
        : timestamp instanceof Date
          ? timestamp.getTime()
          : timestamp;
      return ts >= startMs && ts <= endMs;
    }
  };
}

/**
 * Check if a window has expired based on start time and duration.
 * Uses >= comparison for consistency (window expires AT the boundary).
 *
 * @param windowStart - Window start timestamp in milliseconds
 * @param windowMs - Window duration in milliseconds
 * @param now - Current time (defaults to Date.now())
 * @returns true if the window has expired
 *
 * @example
 * ```typescript
 * if (isWindowExpired(bucket.windowStart, config.windowMs)) {
 *   // Reset the window
 *   bucket.count = 0;
 *   bucket.windowStart = Date.now();
 * }
 * ```
 */
export function isWindowExpired(
  windowStart: number,
  windowMs: number,
  now: number = Date.now()
): boolean {
  return now - windowStart >= windowMs;
}

/**
 * Calculate the reset time for a window.
 *
 * @param windowStart - Window start timestamp in milliseconds
 * @param windowMs - Window duration in milliseconds
 * @returns Date object for when the window resets
 */
export function getWindowResetTime(windowStart: number, windowMs: number): Date {
  return new Date(windowStart + windowMs);
}

// ============================================================================
// METRIC CALCULATION UTILITIES (#40)
// ============================================================================

/**
 * Options for metric calculation
 */
export interface MetricCalculationOptions<T> {
  /** Field to extract for aggregation (e.g., 'tokensUsed', 'latencyMs') */
  valueField?: keyof T;
  /** Field containing the timestamp (defaults to 'timestamp') */
  timestampField?: keyof T;
  /** Field to check for errors (defaults to 'outcome') */
  outcomeField?: keyof T;
  /** Value that indicates failure (defaults to 'failure') */
  failureValue?: string;
  /** Include 24h metrics (defaults to true) */
  include24h?: boolean;
}

/**
 * Generic metrics summary structure
 */
export interface MetricsSummary {
  total: number;
  count: number;
  average: number;
  min: number;
  max: number;
  errorCount: number;
  errorRate: number;
  last24h?: {
    total: number;
    count: number;
    errors: number;
  };
}

/**
 * Calculate aggregate metrics from an array of data items.
 *
 * @param items - Array of items to analyze
 * @param valueExtractor - Function to extract numeric value from each item
 * @param options - Configuration options
 * @returns Aggregated metrics
 *
 * @example
 * ```typescript
 * const activities = [
 *   { tokensUsed: 100, timestamp: '2024-01-01T00:00:00Z', outcome: 'success' },
 *   { tokensUsed: 200, timestamp: '2024-01-01T01:00:00Z', outcome: 'failure' },
 * ];
 *
 * const metrics = calculateMetrics(
 *   activities,
 *   item => item.tokensUsed,
 *   {
 *     timestampField: 'timestamp',
 *     outcomeField: 'outcome',
 *     failureValue: 'failure'
 *   }
 * );
 * // Returns: { total: 300, count: 2, average: 150, min: 100, max: 200, ... }
 * ```
 */
export function calculateMetrics<T>(
  items: T[],
  valueExtractor: (item: T) => number | undefined,
  options: MetricCalculationOptions<T> = {}
): MetricsSummary {
  const {
    timestampField = 'timestamp' as keyof T,
    outcomeField = 'outcome' as keyof T,
    failureValue = 'failure',
    include24h = true
  } = options;

  const now = Date.now();
  const last24h = now - TimeWindows.DAY;

  let total = 0;
  let count = 0;
  let min = Infinity;
  let max = -Infinity;
  let errorCount = 0;

  let total24h = 0;
  let count24h = 0;
  let errors24h = 0;

  for (const item of items) {
    const value = valueExtractor(item);
    const timestamp = item[timestampField];
    const outcome = item[outcomeField];

    const isRecent = include24h && timestamp
      ? new Date(timestamp as unknown as string).getTime() > last24h
      : false;

    // Count all items for error rate calculation
    count++;
    if (isRecent) count24h++;

    // Track failures
    if (outcome === failureValue) {
      errorCount++;
      if (isRecent) errors24h++;
    }

    // Aggregate numeric values (skip undefined)
    if (value !== undefined && value !== null) {
      total += value;
      if (value < min) min = value;
      if (value > max) max = value;
      if (isRecent) total24h += value;
    }
  }

  // Handle edge cases
  if (min === Infinity) min = 0;
  if (max === -Infinity) max = 0;

  const result: MetricsSummary = {
    total,
    count,
    average: count > 0 ? total / count : 0,
    min,
    max,
    errorCount,
    errorRate: count > 0 ? errorCount / count : 0
  };

  if (include24h) {
    result.last24h = {
      total: total24h,
      count: count24h,
      errors: errors24h
    };
  }

  return result;
}

/**
 * Calculate grouped metrics (e.g., by category, by type).
 *
 * @param items - Array of items to analyze
 * @param groupExtractor - Function to extract group key from each item
 * @returns Map of group key to count
 *
 * @example
 * ```typescript
 * const events = [
 *   { eventType: 'action_evaluated' },
 *   { eventType: 'action_approved' },
 *   { eventType: 'action_evaluated' },
 * ];
 *
 * const byType = calculateGroupedCounts(events, e => e.eventType);
 * // Returns: { 'action_evaluated': 2, 'action_approved': 1 }
 * ```
 */
export function calculateGroupedCounts<T>(
  items: T[],
  groupExtractor: (item: T) => string | undefined
): Record<string, number> {
  const groups: Record<string, number> = {};

  for (const item of items) {
    const group = groupExtractor(item);
    if (group !== undefined) {
      groups[group] = (groups[group] || 0) + 1;
    }
  }

  return groups;
}

/**
 * Get top N items from a count record.
 *
 * @param counts - Record of key to count
 * @param limit - Maximum number of items to return
 * @returns Array of { key, count } sorted by count descending
 */
export function getTopCounts(
  counts: Record<string, number>,
  limit: number = 5
): Array<{ key: string; count: number }> {
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ============================================================================
// INPUT VALIDATION UTILITIES (#48)
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Collection of common input validators.
 *
 * Each validator returns { valid: true } or { valid: false, error: 'message' }
 */
export const validators = {
  /**
   * Validate email format
   *
   * @example
   * ```typescript
   * validators.email('user@example.com'); // { valid: true }
   * validators.email('invalid'); // { valid: false, error: '...' }
   * ```
   */
  email(value: string): ValidationResult {
    if (!value || typeof value !== 'string') {
      return { valid: false, error: 'Email is required' };
    }
    // RFC 5322 simplified regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { valid: false, error: 'Invalid email format' };
    }
    return { valid: true };
  },

  /**
   * Validate URL format
   *
   * @example
   * ```typescript
   * validators.url('https://example.com'); // { valid: true }
   * validators.url('not-a-url'); // { valid: false, error: '...' }
   * ```
   */
  url(value: string, options: { requireHttps?: boolean } = {}): ValidationResult {
    if (!value || typeof value !== 'string') {
      return { valid: false, error: 'URL is required' };
    }
    try {
      const url = new URL(value);
      if (options.requireHttps && url.protocol !== 'https:') {
        return { valid: false, error: 'URL must use HTTPS' };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  },

  /**
   * Validate file path (basic validation, no traversal attacks)
   *
   * @example
   * ```typescript
   * validators.path('/valid/path'); // { valid: true }
   * validators.path('../traversal'); // { valid: false, error: '...' }
   * ```
   */
  path(value: string, options: { allowRelative?: boolean } = {}): ValidationResult {
    if (!value || typeof value !== 'string') {
      return { valid: false, error: 'Path is required' };
    }

    // Check for path traversal attempts
    if (value.includes('..')) {
      return { valid: false, error: 'Path traversal not allowed' };
    }

    // Check for null bytes
    if (value.includes('\0')) {
      return { valid: false, error: 'Invalid characters in path' };
    }

    // Check if absolute path is required
    if (!options.allowRelative && !value.startsWith('/')) {
      return { valid: false, error: 'Path must be absolute' };
    }

    return { valid: true };
  },

  /**
   * Validate that a string is non-empty
   */
  nonEmpty(value: string, fieldName: string = 'Value'): ValidationResult {
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      return { valid: false, error: `${fieldName} cannot be empty` };
    }
    return { valid: true };
  },

  /**
   * Validate string length
   */
  length(
    value: string,
    options: { min?: number; max?: number; fieldName?: string } = {}
  ): ValidationResult {
    const { min = 0, max = Infinity, fieldName = 'Value' } = options;

    if (!value || typeof value !== 'string') {
      return { valid: false, error: `${fieldName} is required` };
    }

    if (value.length < min) {
      return { valid: false, error: `${fieldName} must be at least ${min} characters` };
    }

    if (value.length > max) {
      return { valid: false, error: `${fieldName} must be at most ${max} characters` };
    }

    return { valid: true };
  },

  /**
   * Validate number within range
   */
  numberRange(
    value: number,
    options: { min?: number; max?: number; fieldName?: string } = {}
  ): ValidationResult {
    const { min = -Infinity, max = Infinity, fieldName = 'Value' } = options;

    if (value === undefined || value === null || typeof value !== 'number' || isNaN(value)) {
      return { valid: false, error: `${fieldName} must be a number` };
    }

    if (value < min) {
      return { valid: false, error: `${fieldName} must be at least ${min}` };
    }

    if (value > max) {
      return { valid: false, error: `${fieldName} must be at most ${max}` };
    }

    return { valid: true };
  },

  /**
   * Validate port number
   */
  port(value: number): ValidationResult {
    return validators.numberRange(value, {
      min: 1,
      max: 65535,
      fieldName: 'Port'
    });
  },

  /**
   * Validate identifier (alphanumeric with dashes/underscores)
   */
  identifier(value: string, fieldName: string = 'Identifier'): ValidationResult {
    if (!value || typeof value !== 'string') {
      return { valid: false, error: `${fieldName} is required` };
    }

    const idRegex = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
    if (!idRegex.test(value)) {
      return {
        valid: false,
        error: `${fieldName} must start with a letter and contain only letters, numbers, dashes, and underscores`
      };
    }

    return { valid: true };
  },

  /**
   * Validate enum value
   */
  enum<T extends string>(
    value: string,
    allowedValues: readonly T[],
    fieldName: string = 'Value'
  ): ValidationResult {
    if (!allowedValues.includes(value as T)) {
      return {
        valid: false,
        error: `${fieldName} must be one of: ${allowedValues.join(', ')}`
      };
    }
    return { valid: true };
  },

  /**
   * Validate ISO date string
   */
  isoDate(value: string): ValidationResult {
    if (!value || typeof value !== 'string') {
      return { valid: false, error: 'Date is required' };
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return { valid: false, error: 'Invalid date format' };
    }

    return { valid: true };
  },

  /**
   * Validate GitHub repository format (owner/repo)
   */
  githubRepo(value: string): ValidationResult {
    if (!value || typeof value !== 'string') {
      return { valid: false, error: 'Repository is required' };
    }

    const repoRegex = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
    if (!repoRegex.test(value)) {
      return { valid: false, error: 'Repository must be in format: owner/repo' };
    }

    return { valid: true };
  },

  /**
   * Compose multiple validators (all must pass)
   */
  all(...validations: ValidationResult[]): ValidationResult {
    for (const validation of validations) {
      if (!validation.valid) {
        return validation;
      }
    }
    return { valid: true };
  }
};

/**
 * Helper to run validation and throw on failure
 *
 * @example
 * ```typescript
 * assertValid(validators.email(userEmail), 'email');
 * // Throws if invalid: "Validation failed for email: Invalid email format"
 * ```
 */
export function assertValid(result: ValidationResult, context?: string): void {
  if (!result.valid) {
    const message = context
      ? `Validation failed for ${context}: ${result.error}`
      : `Validation failed: ${result.error}`;
    throw new Error(message);
  }
}
