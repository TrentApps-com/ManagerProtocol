/**
 * Enterprise Agent Supervisor - Rate Limiter
 *
 * Token bucket rate limiting with multiple scopes and configurations.
 * Uses extracted utilities from src/utils/rate-limiting.ts for
 * bucket key building and sliding window logic.
 */

import type { RateLimitConfig, RateLimitState, ActionCategory } from '../types/index.js';
import { buildBucketKey, SlidingWindow, type BucketIdentifiers, type BucketScope } from '../utils/rate-limiting.js';

/**
 * Internal bucket structure using SlidingWindow for time tracking
 */
interface RateLimitBucket {
  window: SlidingWindow;
  key: string;
}

export class RateLimiter {
  private configs: Map<string, RateLimitConfig> = new Map();
  private buckets: Map<string, RateLimitBucket> = new Map();
  private lastCleanup: number = Date.now();
  private cleanupIntervalMs: number = 5 * 60 * 1000; // Cleanup every 5 minutes

  /**
   * Register a rate limit configuration
   */
  registerLimit(config: RateLimitConfig): void {
    this.configs.set(config.id, config);
  }

  /**
   * Register multiple rate limit configurations
   */
  registerLimits(configs: RateLimitConfig[]): void {
    for (const config of configs) {
      this.registerLimit(config);
    }
  }

  /**
   * Remove a rate limit configuration
   */
  removeLimit(configId: string): boolean {
    return this.configs.delete(configId);
  }

  /**
   * Check if an action should be rate limited
   */
  checkLimit(params: {
    agentId?: string;
    sessionId?: string;
    userId?: string;
    actionCategory?: ActionCategory;
    actionType?: string;
  }): { allowed: boolean; limitId?: string; state?: RateLimitState } {
    const now = Date.now();

    // Periodically clean up expired buckets to prevent memory leaks
    this.cleanupExpiredBuckets(now);

    for (const [configId, config] of this.configs) {
      if (!config.enabled) continue;

      // Check if action category matches (if specified)
      if (config.actionCategories && params.actionCategory) {
        if (!config.actionCategories.includes(params.actionCategory)) {
          continue;
        }
      }

      // Build bucket key using extracted utility
      const identifiers = this.toIdentifiers(params);
      const bucketKey = buildBucketKey(config.scope as BucketScope, identifiers, configId);
      const bucket = this.getOrCreateBucket(bucketKey, config);

      // Check if window can accept using SlidingWindow
      if (!bucket.window.canAccept(now)) {
        const stats = bucket.window.getStats(now);
        return {
          allowed: false,
          limitId: configId,
          state: {
            key: bucketKey,
            count: stats.count,
            windowStart: stats.windowStart,
            remaining: 0,
            resetAt: stats.resetAtISO
          }
        };
      }

      // Check burst limit if configured
      if (config.burstLimit && !bucket.window.canAcceptBurst(now)) {
        const stats = bucket.window.getStats(now);
        return {
          allowed: false,
          limitId: configId,
          state: {
            key: bucketKey,
            count: stats.count,
            windowStart: stats.windowStart,
            remaining: 0,
            resetAt: stats.resetAtISO
          }
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Record a request (consume from bucket)
   */
  recordRequest(params: {
    agentId?: string;
    sessionId?: string;
    userId?: string;
    actionCategory?: ActionCategory;
    actionType?: string;
  }): void {
    const now = Date.now();

    for (const [configId, config] of this.configs) {
      if (!config.enabled) continue;

      if (config.actionCategories && params.actionCategory) {
        if (!config.actionCategories.includes(params.actionCategory)) {
          continue;
        }
      }

      const identifiers = this.toIdentifiers(params);
      const bucketKey = buildBucketKey(config.scope as BucketScope, identifiers, configId);
      const bucket = this.getOrCreateBucket(bucketKey, config);

      // Record the request in the sliding window
      bucket.window.record(now);
    }
  }

  /**
   * Get current state for a specific limit
   */
  getState(configId: string, params: {
    agentId?: string;
    sessionId?: string;
    userId?: string;
  }): RateLimitState | null {
    const config = this.configs.get(configId);
    if (!config) return null;

    const now = Date.now();
    const identifiers = this.toIdentifiers(params);
    const bucketKey = buildBucketKey(config.scope as BucketScope, identifiers, configId);
    const bucket = this.buckets.get(bucketKey);

    if (!bucket) {
      return {
        key: bucketKey,
        count: 0,
        windowStart: now,
        remaining: config.maxRequests,
        resetAt: new Date(now + config.windowMs).toISOString()
      };
    }

    const stats = bucket.window.getStats(now);

    return {
      key: bucketKey,
      count: stats.count,
      windowStart: stats.windowStart,
      remaining: stats.remaining,
      resetAt: stats.resetAtISO
    };
  }

  /**
   * Get all registered configurations
   */
  getConfigs(): RateLimitConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Clear all buckets (useful for testing)
   */
  clearBuckets(): void {
    this.buckets.clear();
  }

  /**
   * Convert params to BucketIdentifiers for the utility function
   */
  private toIdentifiers(params: {
    agentId?: string;
    sessionId?: string;
    userId?: string;
    actionType?: string;
  }): BucketIdentifiers {
    return {
      agentId: params.agentId,
      sessionId: params.sessionId,
      userId: params.userId,
      actionType: params.actionType
    };
  }

  /**
   * Get or create a bucket with SlidingWindow
   */
  private getOrCreateBucket(key: string, config: RateLimitConfig): RateLimitBucket {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        key,
        window: new SlidingWindow({
          windowMs: config.windowMs,
          maxRequests: config.maxRequests,
          burstLimit: config.burstLimit,
          algorithm: 'fixed' // Use fixed window for consistent behavior with original implementation
        })
      };
      this.buckets.set(key, bucket);
    }

    return bucket;
  }

  /**
   * Clean up expired buckets to prevent memory leaks
   * Removes buckets that are older than their window duration
   */
  private cleanupExpiredBuckets(now: number): void {
    // Only cleanup every cleanupIntervalMs to avoid excessive work
    if (now - this.lastCleanup < this.cleanupIntervalMs) {
      return;
    }

    this.lastCleanup = now;

    // Find the maximum window duration across all configs
    let maxWindowMs = 60000; // Default 1 minute
    for (const config of this.configs.values()) {
      if (config.windowMs > maxWindowMs) {
        maxWindowMs = config.windowMs;
      }
    }

    // Remove buckets that are older than the maximum window
    // This uses >= for consistency with window expiration checks
    // A bucket is expired when: now - windowStart >= 2*maxWindowMs (2x safety margin)
    let removedCount = 0;

    for (const [key, bucket] of this.buckets.entries()) {
      const state = bucket.window.getState();
      // Off-by-one fix: use consistent >= comparison for boundary calculation
      // Window boundary semantics: now - windowStart >= threshold means expired
      if (now - state.windowStart >= maxWindowMs * 2) {
        this.buckets.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`[RateLimiter] Cleaned up ${removedCount} expired buckets`);
    }
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();
