import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateLimiter } from './RateLimiter.js';
import type { RateLimitConfig } from '../types/index.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Configuration', () => {
    it('should register a rate limit configuration', () => {
      const config: RateLimitConfig = {
        id: 'test-limit',
        name: 'Test Limit',
        windowMs: 60000,
        maxRequests: 100,
        scope: 'global',
        enabled: true
      };

      limiter.registerLimit(config);
      expect(limiter.getConfigs()).toHaveLength(1);
      expect(limiter.getConfigs()[0].id).toBe('test-limit');
    });

    it('should register multiple configurations', () => {
      const configs: RateLimitConfig[] = [
        {
          id: 'limit-1',
          name: 'Limit 1',
          windowMs: 60000,
          maxRequests: 100,
          scope: 'global',
          enabled: true
        },
        {
          id: 'limit-2',
          name: 'Limit 2',
          windowMs: 30000,
          maxRequests: 50,
          scope: 'agent',
          enabled: true
        }
      ];

      limiter.registerLimits(configs);
      expect(limiter.getConfigs()).toHaveLength(2);
    });

    it('should remove a rate limit configuration', () => {
      const config: RateLimitConfig = {
        id: 'test-limit',
        name: 'Test Limit',
        windowMs: 60000,
        maxRequests: 100,
        scope: 'global',
        enabled: true
      };

      limiter.registerLimit(config);
      expect(limiter.getConfigs()).toHaveLength(1);

      const result = limiter.removeLimit('test-limit');
      expect(result).toBe(true);
      expect(limiter.getConfigs()).toHaveLength(0);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limit', () => {
      limiter.registerLimit({
        id: 'global-limit',
        name: 'Global Limit',
        windowMs: 60000,
        maxRequests: 5,
        scope: 'global',
        enabled: true
      });

      // First 5 requests should be allowed
      for (let i = 0; i < 5; i++) {
        const result = limiter.checkLimit({});
        expect(result.allowed).toBe(true);
        limiter.recordRequest({});
      }
    });

    it('should block requests exceeding limit', () => {
      limiter.registerLimit({
        id: 'global-limit',
        name: 'Global Limit',
        windowMs: 60000,
        maxRequests: 3,
        scope: 'global',
        enabled: true
      });

      // Record 3 requests
      for (let i = 0; i < 3; i++) {
        limiter.recordRequest({});
      }

      // 4th request should be blocked
      const result = limiter.checkLimit({});
      expect(result.allowed).toBe(false);
      expect(result.limitId).toBe('global-limit');
      expect(result.state?.remaining).toBe(0);
    });

    it('should reset after window expires', () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

      limiter.registerLimit({
        id: 'global-limit',
        name: 'Global Limit',
        windowMs: 60000, // 1 minute
        maxRequests: 3,
        scope: 'global',
        enabled: true
      });

      // Use all requests
      for (let i = 0; i < 3; i++) {
        limiter.recordRequest({});
      }

      // Should be blocked
      expect(limiter.checkLimit({}).allowed).toBe(false);

      // Advance time past window
      vi.advanceTimersByTime(61000);

      // Should be allowed again
      expect(limiter.checkLimit({}).allowed).toBe(true);
    });

    it('should respect burst limits', () => {
      limiter.registerLimit({
        id: 'burst-limit',
        name: 'Burst Limit',
        windowMs: 60000,
        maxRequests: 100,
        burstLimit: 3,
        scope: 'global',
        enabled: true
      });

      // Record 3 requests (burst limit)
      for (let i = 0; i < 3; i++) {
        limiter.recordRequest({});
      }

      // 4th request should be blocked due to burst limit
      const result = limiter.checkLimit({});
      expect(result.allowed).toBe(false);
    });

    it('should skip disabled configurations', () => {
      limiter.registerLimit({
        id: 'disabled-limit',
        name: 'Disabled Limit',
        windowMs: 60000,
        maxRequests: 1,
        scope: 'global',
        enabled: false
      });

      // Record many requests
      for (let i = 0; i < 10; i++) {
        limiter.recordRequest({});
      }

      // Should still be allowed because config is disabled
      const result = limiter.checkLimit({});
      expect(result.allowed).toBe(true);
    });
  });

  describe('Scoping', () => {
    it('should scope limits by agent', () => {
      limiter.registerLimit({
        id: 'agent-limit',
        name: 'Agent Limit',
        windowMs: 60000,
        maxRequests: 2,
        scope: 'agent',
        enabled: true
      });

      // Agent 1 uses its limit
      limiter.recordRequest({ agentId: 'agent-1' });
      limiter.recordRequest({ agentId: 'agent-1' });

      // Agent 1 should be blocked
      expect(limiter.checkLimit({ agentId: 'agent-1' }).allowed).toBe(false);

      // Agent 2 should still be allowed
      expect(limiter.checkLimit({ agentId: 'agent-2' }).allowed).toBe(true);
    });

    it('should scope limits by session', () => {
      limiter.registerLimit({
        id: 'session-limit',
        name: 'Session Limit',
        windowMs: 60000,
        maxRequests: 2,
        scope: 'session',
        enabled: true
      });

      // Session 1 uses its limit
      limiter.recordRequest({ sessionId: 'session-1' });
      limiter.recordRequest({ sessionId: 'session-1' });

      // Session 1 should be blocked
      expect(limiter.checkLimit({ sessionId: 'session-1' }).allowed).toBe(false);

      // Session 2 should still be allowed
      expect(limiter.checkLimit({ sessionId: 'session-2' }).allowed).toBe(true);
    });

    it('should scope limits by user', () => {
      limiter.registerLimit({
        id: 'user-limit',
        name: 'User Limit',
        windowMs: 60000,
        maxRequests: 2,
        scope: 'user',
        enabled: true
      });

      // User 1 uses their limit
      limiter.recordRequest({ userId: 'user-1' });
      limiter.recordRequest({ userId: 'user-1' });

      // User 1 should be blocked
      expect(limiter.checkLimit({ userId: 'user-1' }).allowed).toBe(false);

      // User 2 should still be allowed
      expect(limiter.checkLimit({ userId: 'user-2' }).allowed).toBe(true);
    });

    it('should scope limits by action type', () => {
      limiter.registerLimit({
        id: 'action-limit',
        name: 'Action Limit',
        windowMs: 60000,
        maxRequests: 2,
        scope: 'action_type',
        enabled: true
      });

      // Action type 1 uses its limit
      limiter.recordRequest({ actionType: 'create' });
      limiter.recordRequest({ actionType: 'create' });

      // Action type 1 should be blocked
      expect(limiter.checkLimit({ actionType: 'create' }).allowed).toBe(false);

      // Action type 2 should still be allowed
      expect(limiter.checkLimit({ actionType: 'read' }).allowed).toBe(true);
    });
  });

  describe('Action Category Filtering', () => {
    it('should only apply limits to matching action categories', () => {
      limiter.registerLimit({
        id: 'financial-limit',
        name: 'Financial Limit',
        windowMs: 60000,
        maxRequests: 2,
        scope: 'global',
        actionCategories: ['financial'],
        enabled: true
      });

      // Financial actions use the limit
      limiter.recordRequest({ actionCategory: 'financial' });
      limiter.recordRequest({ actionCategory: 'financial' });

      // Financial actions should be blocked
      expect(limiter.checkLimit({ actionCategory: 'financial' }).allowed).toBe(false);

      // Non-financial actions should be allowed
      expect(limiter.checkLimit({ actionCategory: 'data_access' }).allowed).toBe(true);
    });
  });

  describe('State Management', () => {
    it('should return current state for a limit', () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

      limiter.registerLimit({
        id: 'test-limit',
        name: 'Test Limit',
        windowMs: 60000,
        maxRequests: 10,
        scope: 'global',
        enabled: true
      });

      limiter.recordRequest({});
      limiter.recordRequest({});
      limiter.recordRequest({});

      const state = limiter.getState('test-limit', {});
      expect(state).not.toBeNull();
      expect(state?.count).toBe(3);
      expect(state?.remaining).toBe(7);
    });

    it('should return null for non-existent limit', () => {
      const state = limiter.getState('non-existent', {});
      expect(state).toBeNull();
    });

    it('should return fresh state after window expires', () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

      limiter.registerLimit({
        id: 'test-limit',
        name: 'Test Limit',
        windowMs: 60000,
        maxRequests: 10,
        scope: 'global',
        enabled: true
      });

      limiter.recordRequest({});
      limiter.recordRequest({});

      // Advance past window
      vi.advanceTimersByTime(61000);

      const state = limiter.getState('test-limit', {});
      expect(state?.count).toBe(0);
      expect(state?.remaining).toBe(10);
    });

    it('should clear all buckets', () => {
      limiter.registerLimit({
        id: 'test-limit',
        name: 'Test Limit',
        windowMs: 60000,
        maxRequests: 2,
        scope: 'global',
        enabled: true
      });

      limiter.recordRequest({});
      limiter.recordRequest({});

      // Should be blocked
      expect(limiter.checkLimit({}).allowed).toBe(false);

      // Clear buckets
      limiter.clearBuckets();

      // Should be allowed again
      expect(limiter.checkLimit({}).allowed).toBe(true);
    });
  });
});
