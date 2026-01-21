/**
 * Enterprise Agent Supervisor - Rate Limiting Utilities
 *
 * Reusable utilities for rate limiting:
 * - Bucket key building for different scopes
 * - Sliding window time-based tracking
 */

/**
 * Scope types for rate limit bucket keys
 */
export type BucketScope = 'global' | 'agent' | 'session' | 'user' | 'action_type';

/**
 * Identifiers used to build bucket keys
 */
export interface BucketIdentifiers {
  agentId?: string;
  sessionId?: string;
  userId?: string;
  actionType?: string;
}

/**
 * Window algorithm types
 */
export type WindowAlgorithm = 'fixed' | 'sliding';

/**
 * Statistics for a time window
 */
export interface WindowStats {
  /** Number of requests in the current window */
  count: number;
  /** Number of requests remaining before limit */
  remaining: number;
  /** Timestamp when the window started (ms since epoch) */
  windowStart: number;
  /** Timestamp when the window resets (ms since epoch) */
  resetAt: number;
  /** ISO string of reset time */
  resetAtISO: string;
  /** Whether the limit has been exceeded */
  exceeded: boolean;
  /** Percentage of limit used (0-100) */
  usagePercent: number;
}

/**
 * Configuration for SlidingWindow
 */
export interface SlidingWindowConfig {
  /** Window duration in milliseconds */
  windowMs: number;
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Optional burst limit for short-term spikes */
  burstLimit?: number;
  /** Window algorithm: 'fixed' resets at boundaries, 'sliding' moves with time */
  algorithm?: WindowAlgorithm;
}

// ============================================================================
// BUCKET KEY BUILDING
// ============================================================================

/**
 * Separator used in bucket keys to prevent collisions
 */
const KEY_SEPARATOR = ':';

/**
 * Default identifier when none is provided
 */
const DEFAULT_IDENTIFIER = 'unknown';

/**
 * Build a bucket key based on scope and identifiers.
 *
 * Key format: `{prefix}:{scope}:{identifier}`
 *
 * This creates consistent, collision-free keys for rate limit buckets.
 *
 * @param scope - The scope for the bucket (global, agent, session, user, action_type)
 * @param identifiers - Object containing identifier values
 * @param prefix - Optional prefix for namespacing (e.g., config ID)
 * @returns A unique bucket key string
 *
 * @example
 * ```typescript
 * // Global scope
 * buildBucketKey('global', {}) // "global"
 * buildBucketKey('global', {}, 'rate-1') // "rate-1:global"
 *
 * // Agent scope
 * buildBucketKey('agent', { agentId: 'agent-123' }) // "agent:agent-123"
 *
 * // Session scope with prefix
 * buildBucketKey('session', { sessionId: 'sess-456' }, 'api-limit')
 * // "api-limit:session:sess-456"
 * ```
 */
export function buildBucketKey(
  scope: BucketScope,
  identifiers: BucketIdentifiers,
  prefix?: string
): string {
  let key: string;

  switch (scope) {
    case 'global':
      key = 'global';
      break;
    case 'agent':
      key = `agent${KEY_SEPARATOR}${identifiers.agentId || DEFAULT_IDENTIFIER}`;
      break;
    case 'session':
      key = `session${KEY_SEPARATOR}${identifiers.sessionId || DEFAULT_IDENTIFIER}`;
      break;
    case 'user':
      key = `user${KEY_SEPARATOR}${identifiers.userId || DEFAULT_IDENTIFIER}`;
      break;
    case 'action_type':
      key = `action${KEY_SEPARATOR}${identifiers.actionType || DEFAULT_IDENTIFIER}`;
      break;
    default:
      key = 'unknown';
  }

  return prefix ? `${prefix}${KEY_SEPARATOR}${key}` : key;
}

/**
 * Parse a bucket key to extract scope and identifier.
 *
 * @param key - The bucket key to parse
 * @returns Object with scope and identifier, or null if invalid
 *
 * @example
 * ```typescript
 * parseBucketKey('rate-1:agent:agent-123')
 * // { prefix: 'rate-1', scope: 'agent', identifier: 'agent-123' }
 *
 * parseBucketKey('global')
 * // { prefix: undefined, scope: 'global', identifier: undefined }
 * ```
 */
export function parseBucketKey(key: string): {
  prefix?: string;
  scope: BucketScope | 'unknown';
  identifier?: string;
} | null {
  if (!key) return null;

  const parts = key.split(KEY_SEPARATOR);

  // Handle simple global key
  if (parts.length === 1 && parts[0] === 'global') {
    return { scope: 'global' };
  }

  // Handle keys without prefix: "scope:identifier"
  if (parts.length === 2) {
    const scopeMap: Record<string, BucketScope> = {
      'agent': 'agent',
      'session': 'session',
      'user': 'user',
      'action': 'action_type'
    };
    const scope = scopeMap[parts[0]];
    if (scope) {
      return { scope, identifier: parts[1] };
    }
  }

  // Handle keys with prefix: "prefix:scope:identifier" or "prefix:global"
  if (parts.length >= 2) {
    const prefix = parts[0];
    const scopePart = parts[1];

    if (scopePart === 'global') {
      return { prefix, scope: 'global' };
    }

    const scopeMap: Record<string, BucketScope> = {
      'agent': 'agent',
      'session': 'session',
      'user': 'user',
      'action': 'action_type'
    };
    const scope = scopeMap[scopePart];
    if (scope && parts.length >= 3) {
      return { prefix, scope, identifier: parts.slice(2).join(KEY_SEPARATOR) };
    }
  }

  return { scope: 'unknown' };
}

// ============================================================================
// SLIDING WINDOW
// ============================================================================

/**
 * SlidingWindow class for time-based window tracking.
 *
 * Supports both fixed and sliding window algorithms:
 * - Fixed: Window resets at fixed boundaries (simpler, less memory)
 * - Sliding: Window slides with time (more accurate, tracks individual requests)
 *
 * @example
 * ```typescript
 * // Create a window: 100 requests per minute
 * const window = new SlidingWindow({
 *   windowMs: 60000,
 *   maxRequests: 100,
 *   algorithm: 'fixed'
 * });
 *
 * // Check and record a request
 * if (window.canAccept()) {
 *   window.record();
 *   // Process request
 * } else {
 *   // Rate limited
 *   const stats = window.getStats();
 *   console.log(`Retry after ${stats.resetAt}`);
 * }
 * ```
 */
export class SlidingWindow {
  private config: Required<SlidingWindowConfig>;

  // Fixed window state
  private count: number = 0;
  private burstCount: number = 0;
  private windowStart: number;

  // Sliding window state (for sliding algorithm)
  private requestTimestamps: number[] = [];

  constructor(config: SlidingWindowConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      burstLimit: config.burstLimit ?? config.maxRequests,
      algorithm: config.algorithm ?? 'fixed'
    };
    this.windowStart = Date.now();
  }

  /**
   * Check if the window has expired and needs reset.
   *
   * For fixed windows: Checks if current time is past window boundary.
   * For sliding windows: Always returns false (sliding handles this differently).
   *
   * @param now - Current timestamp (defaults to Date.now())
   * @returns Whether the window has expired
   */
  isExpired(now: number = Date.now()): boolean {
    if (this.config.algorithm === 'sliding') {
      return false; // Sliding windows don't expire in the same way
    }

    // Fixed window: expired when now - windowStart >= windowMs
    return now - this.windowStart >= this.config.windowMs;
  }

  /**
   * Reset the window to initial state.
   *
   * @param now - Timestamp to use as new window start (defaults to Date.now())
   */
  reset(now: number = Date.now()): void {
    this.count = 0;
    this.burstCount = 0;
    this.windowStart = now;
    this.requestTimestamps = [];
  }

  /**
   * Check if the window can accept another request.
   * Automatically resets expired windows (for fixed algorithm).
   *
   * @param now - Current timestamp (defaults to Date.now())
   * @returns Whether a request can be accepted
   */
  canAccept(now: number = Date.now()): boolean {
    this.maybeResetWindow(now);

    if (this.config.algorithm === 'sliding') {
      return this.getSlidingCount(now) < this.config.maxRequests;
    }

    // Fixed window
    if (this.count >= this.config.maxRequests) {
      return false;
    }

    if (this.burstCount >= this.config.burstLimit) {
      return false;
    }

    return true;
  }

  /**
   * Check if the window can accept based on burst limit only.
   *
   * @param now - Current timestamp (defaults to Date.now())
   * @returns Whether burst limit allows acceptance
   */
  canAcceptBurst(now: number = Date.now()): boolean {
    this.maybeResetWindow(now);

    if (this.config.algorithm === 'sliding') {
      // For sliding, burst is same as regular limit
      return this.getSlidingCount(now) < this.config.burstLimit;
    }

    return this.burstCount < this.config.burstLimit;
  }

  /**
   * Record a request in the window.
   *
   * @param now - Current timestamp (defaults to Date.now())
   */
  record(now: number = Date.now()): void {
    this.maybeResetWindow(now);

    if (this.config.algorithm === 'sliding') {
      this.requestTimestamps.push(now);
      // Clean up old timestamps to prevent memory growth
      this.cleanupOldTimestamps(now);
    } else {
      this.count++;
      this.burstCount++;
    }
  }

  /**
   * Get current window statistics.
   *
   * @param now - Current timestamp (defaults to Date.now())
   * @returns WindowStats object with current state
   */
  getStats(now: number = Date.now()): WindowStats {
    this.maybeResetWindow(now);

    const count = this.config.algorithm === 'sliding'
      ? this.getSlidingCount(now)
      : this.count;

    const remaining = Math.max(0, this.config.maxRequests - count);
    const resetAt = this.windowStart + this.config.windowMs;

    return {
      count,
      remaining,
      windowStart: this.windowStart,
      resetAt,
      resetAtISO: new Date(resetAt).toISOString(),
      exceeded: count >= this.config.maxRequests,
      usagePercent: Math.min(100, Math.round((count / this.config.maxRequests) * 100))
    };
  }

  /**
   * Get the current count of requests in the window.
   *
   * @param now - Current timestamp (defaults to Date.now())
   * @returns Current request count
   */
  getCount(now: number = Date.now()): number {
    this.maybeResetWindow(now);

    return this.config.algorithm === 'sliding'
      ? this.getSlidingCount(now)
      : this.count;
  }

  /**
   * Get remaining requests before limit is hit.
   *
   * @param now - Current timestamp (defaults to Date.now())
   * @returns Number of remaining requests
   */
  getRemaining(now: number = Date.now()): number {
    return Math.max(0, this.config.maxRequests - this.getCount(now));
  }

  /**
   * Get timestamp when the window resets.
   *
   * @returns Reset timestamp in milliseconds since epoch
   */
  getResetTime(): number {
    return this.windowStart + this.config.windowMs;
  }

  /**
   * Get the window configuration.
   *
   * @returns The window configuration
   */
  getConfig(): Required<SlidingWindowConfig> {
    return { ...this.config };
  }

  /**
   * Set internal state (useful for persistence/restoration).
   *
   * @param state - State to restore
   */
  setState(state: { count: number; windowStart: number; burstCount?: number }): void {
    this.count = state.count;
    this.windowStart = state.windowStart;
    this.burstCount = state.burstCount ?? 0;
  }

  /**
   * Get internal state (useful for persistence).
   *
   * @returns Current internal state
   */
  getState(): { count: number; windowStart: number; burstCount: number } {
    return {
      count: this.count,
      windowStart: this.windowStart,
      burstCount: this.burstCount
    };
  }

  // Private methods

  private maybeResetWindow(now: number): void {
    if (this.config.algorithm === 'fixed' && this.isExpired(now)) {
      this.reset(now);
    }
  }

  private getSlidingCount(now: number): number {
    const windowStart = now - this.config.windowMs;
    return this.requestTimestamps.filter(ts => ts > windowStart).length;
  }

  private cleanupOldTimestamps(now: number): void {
    const windowStart = now - this.config.windowMs;
    // Keep only timestamps within the window plus a small buffer
    this.requestTimestamps = this.requestTimestamps.filter(
      ts => ts > windowStart - 1000
    );
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a sliding window with common presets.
 *
 * @param preset - Preset name
 * @returns Configured SlidingWindow
 *
 * @example
 * ```typescript
 * // 60 requests per minute
 * const perMinute = createWindowPreset('per-minute');
 *
 * // 1000 requests per hour
 * const perHour = createWindowPreset('per-hour');
 * ```
 */
export function createWindowPreset(preset: 'per-second' | 'per-minute' | 'per-hour' | 'per-day'): SlidingWindow {
  const presets: Record<string, SlidingWindowConfig> = {
    'per-second': { windowMs: 1000, maxRequests: 10, algorithm: 'fixed' },
    'per-minute': { windowMs: 60000, maxRequests: 60, algorithm: 'fixed' },
    'per-hour': { windowMs: 3600000, maxRequests: 1000, algorithm: 'fixed' },
    'per-day': { windowMs: 86400000, maxRequests: 10000, algorithm: 'fixed' }
  };

  return new SlidingWindow(presets[preset]);
}

/**
 * Create multiple bucket keys for different scopes from the same identifiers.
 *
 * @param identifiers - Identifiers to use
 * @param prefix - Optional prefix for all keys
 * @returns Object with keys for each scope
 *
 * @example
 * ```typescript
 * const keys = createBucketKeys({ agentId: 'a1', userId: 'u1' }, 'rate');
 * // {
 * //   global: 'rate:global',
 * //   agent: 'rate:agent:a1',
 * //   user: 'rate:user:u1',
 * //   session: 'rate:session:unknown',
 * //   action_type: 'rate:action:unknown'
 * // }
 * ```
 */
export function createBucketKeys(
  identifiers: BucketIdentifiers,
  prefix?: string
): Record<BucketScope, string> {
  return {
    global: buildBucketKey('global', identifiers, prefix),
    agent: buildBucketKey('agent', identifiers, prefix),
    session: buildBucketKey('session', identifiers, prefix),
    user: buildBucketKey('user', identifiers, prefix),
    action_type: buildBucketKey('action_type', identifiers, prefix)
  };
}
