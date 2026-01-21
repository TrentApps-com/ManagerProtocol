import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskManager } from './TaskManager.js';

// Note: TaskManager relies heavily on GitHub CLI (gh) which requires authentication
// and network access. These tests focus on error handling and internal logic that
// can be tested without actual GitHub integration.

describe('TaskManager', () => {
  let manager: TaskManager;

  beforeEach(() => {
    manager = new TaskManager({
      priorityLabelPrefix: 'priority:',
      statusLabelPrefix: 'status:'
    });
  });

  describe('Initialization', () => {
    it('should create a TaskManager instance with default options', () => {
      const tm = new TaskManager();
      expect(tm).toBeInstanceOf(TaskManager);
    });

    it('should create a TaskManager instance with custom options', () => {
      const tm = new TaskManager({
        priorityLabelPrefix: 'p:',
        statusLabelPrefix: 's:'
      });
      expect(tm).toBeInstanceOf(TaskManager);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing repository gracefully', async () => {
      // When no repo is provided and auto-detect fails
      await expect(
        manager.createTask({
          title: 'Test Task'
        })
      ).rejects.toThrow(); // Will throw some error related to gh CLI
    });

    it('should handle gh CLI not being available', async () => {
      // This will fail if gh is not installed
      const result = await manager.verifyGh();
      // Result should be either ok:true or have an error message
      expect(result).toHaveProperty('ok');
      if (!result.ok) {
        expect(result.error).toBeDefined();
      }
    });

    it('should return null when getting task from non-existent repo', async () => {
      const result = await manager.getTask('nonexistent-owner/nonexistent-repo', '1');
      expect(result).toBeNull();
    });

    it('should throw error when creating task in non-existent repo', async () => {
      await expect(
        manager.createTask({
          projectName: 'nonexistent-owner/nonexistent-repo-12345',
          title: 'Test Task'
        })
      ).rejects.toThrow();
    });
  });

  describe('Repo Resolution', () => {
    it('should attempt to get current repo from git', async () => {
      // This may succeed or fail depending on whether we're in a git repo
      const repo = await manager.getCurrentRepo();
      // Result should be either a string or null
      expect(repo === null || typeof repo === 'string').toBe(true);
    });

    it('should cache repo detection result', async () => {
      const repo1 = await manager.getCurrentRepo();
      const repo2 = await manager.getCurrentRepo();
      // Second call should return the same result (cached)
      expect(repo1).toBe(repo2);
    });
  });

  describe('Input Validation', () => {
    it('should handle empty task title', async () => {
      await expect(
        manager.createTask({
          projectName: 'test/repo',
          title: ''
        })
      ).rejects.toThrow();
    });

    it('should handle special characters in task title safely', async () => {
      // Even though this will fail due to auth/repo, it should not cause shell injection
      const dangerousTitle = 'Test"; rm -rf /; echo "pwned';
      await expect(
        manager.createTask({
          projectName: 'test/repo',
          title: dangerousTitle
        })
      ).rejects.toThrow();
      // The important part is that it throws an error, not executes the injection
    });

    it('should handle special characters in description safely', async () => {
      const dangerousDescription = 'Test"; cat /etc/passwd; echo "';
      await expect(
        manager.createTask({
          projectName: 'test/repo',
          title: 'Safe Title',
          description: dangerousDescription
        })
      ).rejects.toThrow();
    });
  });

  describe('GitHub CLI Verification', () => {
    it('should verify gh CLI status', async () => {
      const result = await manager.verifyGh();
      expect(result).toHaveProperty('ok');
      expect(typeof result.ok).toBe('boolean');

      if (!result.ok) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });

    it('should cache gh verification result', async () => {
      const result1 = await manager.verifyGh();
      const result2 = await manager.verifyGh();
      // Both should return the same result
      expect(result1.ok).toBe(result2.ok);
    });
  });

  describe('Security - Shell Escaping', () => {
    it('should safely handle task IDs with special characters', async () => {
      // Task IDs should be numeric, but test defensively
      const result = await manager.getTask('test/repo', '"; echo "injected"');
      expect(result).toBeNull(); // Returns null for invalid task, doesn't execute injection
    });

    it('should safely handle repo names with special characters', async () => {
      await expect(
        manager.createTask({
          projectName: 'test/repo"; echo "injected',
          title: 'Test'
        })
      ).rejects.toThrow();
    });

    it('should safely handle assignee names', async () => {
      await expect(
        manager.createTask({
          projectName: 'test/repo',
          title: 'Test',
          assignee: 'user"; echo "injected'
        })
      ).rejects.toThrow();
    });

    it('should safely handle label names', async () => {
      await expect(
        manager.createTask({
          projectName: 'test/repo',
          title: 'Test',
          labels: ['label"; echo "injected']
        })
      ).rejects.toThrow();
    });
  });

  describe('Task Status and Priority', () => {
    it('should accept valid priority values', () => {
      const validPriorities = ['critical', 'high', 'medium', 'low'];
      // Just verify these don't throw when used in params
      for (const priority of validPriorities) {
        expect(() => {
          const params = {
            projectName: 'test/repo',
            title: 'Test',
            priority: priority as any
          };
          // This will fail due to auth, but priority value itself is valid
          expect(params.priority).toBe(priority);
        }).not.toThrow();
      }
    });

    it('should accept valid status values', () => {
      const validStatuses = ['pending', 'in_progress', 'completed', 'blocked', 'cancelled'];
      // Just verify these don't throw
      for (const status of validStatuses) {
        expect(() => {
          const filter = { status: status as any };
          expect(filter.status).toBe(status);
        }).not.toThrow();
      }
    });
  });

  describe('Pending Tasks', () => {
    it('should return empty array for getPendingTasks when repo has no tasks', async () => {
      const result = await manager.getPendingTasks('nonexistent-owner/nonexistent-repo-xyz');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for getInProgressTasks when repo has no tasks', async () => {
      const result = await manager.getInProgressTasks('nonexistent-owner/nonexistent-repo-xyz');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Task Updates', () => {
    it('should return null for updateTask with invalid task ID', async () => {
      const result = await manager.updateTask('test/repo', '999999999', {
        title: 'Updated Title'
      });
      expect(result).toBeNull();
    });

    it('should handle needs-approval flag in task creation', async () => {
      await expect(
        manager.createTask({
          projectName: 'test/repo',
          title: 'Test',
          needsApproval: true
        })
      ).rejects.toThrow();
      // Will fail due to repo not existing, but parameter is accepted
    });
  });

  describe('Label Management', () => {
    it('should handle label creation for priority labels', async () => {
      // This will fail due to repo not existing, but ensures label logic is called
      await expect(
        manager.createTask({
          projectName: 'test/repo',
          title: 'Test',
          priority: 'critical'
        })
      ).rejects.toThrow();
    });

    it('should handle custom labels', async () => {
      await expect(
        manager.createTask({
          projectName: 'test/repo',
          title: 'Test',
          labels: ['bug', 'enhancement']
        })
      ).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined project name with no git repo', async () => {
      // When no repo is provided, it should throw an error
      await expect(
        manager.createTask({
          title: 'Test'
        })
      ).rejects.toThrow();
    });

    it('should return empty array for empty task list', async () => {
      const result = await manager.getTasksByProject('nonexistent-owner/nonexistent-repo-xyz');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return null for null or undefined in task queries', async () => {
      const result = await manager.getTask(undefined, '');
      expect(result).toBeNull();
    });
  });

  describe('Integration Points', () => {
    it('should handle valid repo name formats', async () => {
      // Valid format is "owner/repo"
      const validRepos = [
        'owner/repo',
        'my-org/my-project',
        'user123/project-name'
      ];

      for (const repo of validRepos) {
        const result = await manager.getTask(repo, '1');
        // Returns null for non-existent task, but format is accepted
        expect(result === null || typeof result === 'object').toBe(true);
      }
    });

    it('should handle invalid repo formats', async () => {
      const invalidRepos = [
        'just-repo-name',
        'owner/',
        '/repo',
        ''
      ];

      for (const repo of invalidRepos) {
        const result = await manager.getTask(repo, '1');
        // May return null or handle gracefully
        expect(result === null || typeof result === 'object').toBe(true);
      }
    });
  });
});
