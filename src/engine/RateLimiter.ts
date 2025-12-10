/**
 * Enterprise Agent Supervisor - Rate Limiter
 *
 * Token bucket rate limiting with multiple scopes and configurations.
 */

import type { RateLimitConfig, RateLimitState, ActionCategory } from '../types/index.js';

interface RateLimitBucket {
  count: number;
  windowStart: number;
  burstCount: number;
}

export class RateLimiter {
  private configs: Map<string, RateLimitConfig> = new Map();
  private buckets: Map<string, RateLimitBucket> = new Map();

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

    for (const [configId, config] of this.configs) {
      if (!config.enabled) continue;

      // Check if action category matches (if specified)
      if (config.actionCategories && params.actionCategory) {
        if (!config.actionCategories.includes(params.actionCategory)) {
          continue;
        }
      }

      // Build bucket key based on scope
      const bucketKey = this.buildBucketKey(configId, config.scope, params);
      const bucket = this.getOrCreateBucket(bucketKey, now, config.windowMs);

      // Check if within window
      if (now - bucket.windowStart >= config.windowMs) {
        // Reset window
        bucket.count = 0;
        bucket.windowStart = now;
        bucket.burstCount = 0;
      }

      // Check limits
      if (bucket.count >= config.maxRequests) {
        const resetAt = new Date(bucket.windowStart + config.windowMs);
        return {
          allowed: false,
          limitId: configId,
          state: {
            key: bucketKey,
            count: bucket.count,
            windowStart: bucket.windowStart,
            remaining: 0,
            resetAt: resetAt.toISOString()
          }
        };
      }

      // Check burst limit if configured
      if (config.burstLimit && bucket.burstCount >= config.burstLimit) {
        const resetAt = new Date(bucket.windowStart + config.windowMs);
        return {
          allowed: false,
          limitId: configId,
          state: {
            key: bucketKey,
            count: bucket.count,
            windowStart: bucket.windowStart,
            remaining: 0,
            resetAt: resetAt.toISOString()
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

      const bucketKey = this.buildBucketKey(configId, config.scope, params);
      const bucket = this.getOrCreateBucket(bucketKey, now, config.windowMs);

      // Reset if window expired
      if (now - bucket.windowStart >= config.windowMs) {
        bucket.count = 0;
        bucket.windowStart = now;
        bucket.burstCount = 0;
      }

      bucket.count++;
      bucket.burstCount++;
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
    const bucketKey = this.buildBucketKey(configId, config.scope, params);
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

    // Check if window has expired
    if (now - bucket.windowStart >= config.windowMs) {
      return {
        key: bucketKey,
        count: 0,
        windowStart: now,
        remaining: config.maxRequests,
        resetAt: new Date(now + config.windowMs).toISOString()
      };
    }

    return {
      key: bucketKey,
      count: bucket.count,
      windowStart: bucket.windowStart,
      remaining: Math.max(0, config.maxRequests - bucket.count),
      resetAt: new Date(bucket.windowStart + config.windowMs).toISOString()
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
   * Build a bucket key based on scope
   */
  private buildBucketKey(
    configId: string,
    scope: RateLimitConfig['scope'],
    params: {
      agentId?: string;
      sessionId?: string;
      userId?: string;
      actionType?: string;
    }
  ): string {
    switch (scope) {
      case 'global':
        return `${configId}:global`;
      case 'agent':
        return `${configId}:agent:${params.agentId || 'unknown'}`;
      case 'session':
        return `${configId}:session:${params.sessionId || 'unknown'}`;
      case 'user':
        return `${configId}:user:${params.userId || 'unknown'}`;
      case 'action_type':
        return `${configId}:action:${params.actionType || 'unknown'}`;
      default:
        return `${configId}:unknown`;
    }
  }

  /**
   * Get or create a bucket
   */
  private getOrCreateBucket(
    key: string,
    now: number,
    windowMs: number
  ): RateLimitBucket {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        count: 0,
        windowStart: now,
        burstCount: 0
      };
      this.buckets.set(key, bucket);
    }

    return bucket;
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();
