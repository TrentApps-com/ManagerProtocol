/**
 * Enterprise Agent Supervisor - Task Manager
 *
 * Manages project tasks using GitHub Issues via the Octokit API.
 * Tasks are stored as GitHub Issues, providing persistence and visibility.
 *
 * Features:
 * - Auto-detects repo from current directory if not specified
 * - Creates priority/status labels automatically
 * - Caches repo detection for performance
 * - Full GitHub Issues integration via Octokit
 */

import type {
  ProjectTask,
  TaskPriority,
  TaskStatus
} from '../types/index.js';
import { auditLogger } from './AuditLogger.js';
import { GitHubClient, GitHubIssue, gitHubClient } from './GitHubClient.js';

export interface TaskManagerOptions {
  defaultLabels?: string[];
  priorityLabelPrefix?: string;
  statusLabelPrefix?: string;
}

export class TaskManager {
  private priorityPrefix: string;
  private statusPrefix: string;
  private cachedRepo: string | null = null;
  private initializedLabels: Set<string> = new Set();
  private client: GitHubClient;

  constructor(options: TaskManagerOptions = {}) {
    this.priorityPrefix = options.priorityLabelPrefix || 'priority:';
    this.statusPrefix = options.statusLabelPrefix || 'status:';
    this.client = gitHubClient;
  }

  /**
   * Verify GitHub API authentication
   */
  async verifyGh(): Promise<{ ok: boolean; error?: string; user?: string }> {
    return this.client.verifyAuth();
  }

  /**
   * Get the current repo from git remote
   */
  async getCurrentRepo(): Promise<string | null> {
    if (this.cachedRepo) return this.cachedRepo;

    const repo = await this.client.getCurrentRepo();
    if (repo) {
      this.cachedRepo = `${repo.owner}/${repo.repo}`;
      return this.cachedRepo;
    }

    return null;
  }

  /**
   * Resolve project name - use provided or auto-detect
   */
  private async resolveRepo(projectName?: string): Promise<string> {
    if (projectName) return projectName;

    const currentRepo = await this.getCurrentRepo();
    if (currentRepo) return currentRepo;

    throw new Error(
      'No repository specified and could not auto-detect from current directory. ' +
      'Either provide projectName or run from within a git repository.'
    );
  }

  /**
   * Parse repo string into owner/repo components
   */
  private parseRepo(repoString: string): { owner: string; repo: string } {
    return this.client.parseRepo(repoString);
  }

  /**
   * Ensure a task exists before operating on it
   * @throws Error if task is not found
   */
  private async ensureTaskExists(repo: string, taskId: string): Promise<ProjectTask> {
    const task = await this.getTask(repo, taskId);
    if (!task) {
      throw new Error(`Task #${taskId} not found in ${repo}`);
    }
    return task;
  }

  /**
   * Ensure a label exists in the repo, create if not
   */
  private async ensureLabel(repo: string, labelName: string): Promise<void> {
    const cacheKey = `${repo}:${labelName}`;
    if (this.initializedLabels.has(cacheKey)) return;

    // Define colors for our labels
    const labelColors: Record<string, string> = {
      [`${this.priorityPrefix}critical`]: 'B60205',
      [`${this.priorityPrefix}high`]: 'D93F0B',
      [`${this.priorityPrefix}medium`]: 'FBCA04',
      [`${this.priorityPrefix}low`]: '0E8A16',
      [`${this.statusPrefix}in_progress`]: '1D76DB',
      [`${this.statusPrefix}blocked`]: 'E99695',
      [`${this.statusPrefix}cancelled`]: '808080',
      'needs-approval': 'FF6B6B',
    };

    const { owner, repo: repoName } = this.parseRepo(repo);

    try {
      // Check if label exists
      const existing = await this.client.getLabel(owner, repoName, labelName);
      if (existing) {
        this.initializedLabels.add(cacheKey);
        return;
      }

      // Label doesn't exist, create it
      const color = labelColors[labelName] || '666666';
      const description = labelName.startsWith(this.priorityPrefix)
        ? `Priority: ${labelName.replace(this.priorityPrefix, '')}`
        : labelName.startsWith(this.statusPrefix)
          ? `Status: ${labelName.replace(this.statusPrefix, '')}`
          : labelName === 'needs-approval'
            ? 'Significant change requiring approval before implementation'
            : '';

      await this.client.createLabel(owner, repoName, labelName, color, description || undefined);
      this.initializedLabels.add(cacheKey);
    } catch {
      // Label creation failed, might be permissions - continue anyway
      this.initializedLabels.add(cacheKey);
    }
  }

  /**
   * Convert GitHub Issue to ProjectTask
   */
  private issueToTask(issue: GitHubIssue, projectName: string): ProjectTask {
    const labels = issue.labels.map(l => l.name);

    // Extract priority from labels
    const priorityLabel = labels.find(l => l.startsWith(this.priorityPrefix));
    const priority = (priorityLabel?.replace(this.priorityPrefix, '') || 'medium') as TaskPriority;

    // Extract status from labels or state
    let status: TaskStatus = issue.state === 'open' ? 'pending' : 'completed';
    const statusLabel = labels.find(l => l.startsWith(this.statusPrefix));
    if (statusLabel) {
      const labelStatus = statusLabel.replace(this.statusPrefix, '');
      if (['pending', 'in_progress', 'completed', 'blocked', 'cancelled'].includes(labelStatus)) {
        status = labelStatus as TaskStatus;
      }
    } else if (issue.state === 'open') {
      if (labels.includes('in-progress') || labels.includes('wip')) {
        status = 'in_progress';
      }
    }

    // Filter out priority and status labels
    const cleanLabels = labels.filter(l =>
      !l.startsWith(this.priorityPrefix) &&
      !l.startsWith(this.statusPrefix) &&
      l !== 'in-progress' &&
      l !== 'wip'
    );

    return {
      id: String(issue.number),
      projectName,
      title: issue.title,
      description: issue.body || undefined,
      status,
      priority,
      assignee: issue.assignees?.[0]?.login,
      labels: cleanLabels.length > 0 ? cleanLabels : undefined,
      dueDate: issue.milestone?.title,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      completedAt: issue.closed_at || undefined,
      metadata: { url: issue.html_url }
    };
  }

  /**
   * Build labels array for issue
   */
  private buildLabels(priority?: TaskPriority, status?: TaskStatus, labels?: string[]): string[] {
    const allLabels: string[] = [];

    if (priority) {
      allLabels.push(`${this.priorityPrefix}${priority}`);
    }

    if (status && status !== 'pending' && status !== 'completed') {
      allLabels.push(`${this.statusPrefix}${status}`);
    }

    if (labels) {
      allLabels.push(...labels);
    }

    return allLabels;
  }

  /**
   * Create a new task (GitHub Issue) for a project
   *
   * @param params.projectName - Optional repo in "owner/repo" format. Auto-detects if not provided.
   * @param params.needsApproval - Flag for significant changes requiring approval before implementation
   */
  async createTask(params: {
    projectName?: string;
    title: string;
    description?: string;
    priority?: TaskPriority;
    assignee?: string;
    labels?: string[];
    dueDate?: string;
    estimatedHours?: number;
    parentTaskId?: string;
    dependencies?: string[];
    metadata?: Record<string, unknown>;
    needsApproval?: boolean;
  }): Promise<ProjectTask> {
    const repo = await this.resolveRepo(params.projectName);
    const { owner, repo: repoName } = this.parseRepo(repo);
    const allLabels = this.buildLabels(params.priority, 'pending', params.labels);

    // Add needs-approval label if flagged
    if (params.needsApproval) {
      allLabels.push('needs-approval');
    }

    // Ensure labels exist
    for (const label of allLabels) {
      if (label.startsWith(this.priorityPrefix) || label.startsWith(this.statusPrefix) || label === 'needs-approval') {
        await this.ensureLabel(repo, label);
      }
    }

    // Handle @me assignee - need to resolve to actual username
    let assignees: string[] | undefined;
    if (params.assignee) {
      if (params.assignee === '@me') {
        const auth = await this.client.verifyAuth();
        if (auth.ok && auth.user) {
          assignees = [auth.user];
        }
      } else {
        assignees = [params.assignee];
      }
    }

    // Create the issue
    const issue = await this.client.createIssue({
      owner,
      repo: repoName,
      title: params.title,
      body: params.description,
      labels: allLabels.length > 0 ? allLabels : undefined,
      assignees,
    });

    const task = this.issueToTask(issue, repo);

    await auditLogger.log({
      eventType: 'action_executed',
      action: 'task_created',
      outcome: 'success',
      details: {
        taskId: task.id,
        projectName: repo,
        title: params.title,
        priority: task.priority,
        ghIssueUrl: issue.html_url
      }
    });

    return task;
  }

  /**
   * Get all tasks for a project
   */
  async getTasksByProject(projectName?: string, filter?: {
    status?: TaskStatus;
    priority?: TaskPriority;
    assignee?: string;
    labels?: string[];
  }): Promise<ProjectTask[]> {
    try {
      const repo = await this.resolveRepo(projectName);
      const { owner, repo: repoName } = this.parseRepo(repo);

      let stateFilter: 'open' | 'closed' | 'all' = 'all';
      if (filter?.status === 'completed' || filter?.status === 'cancelled') {
        stateFilter = 'closed';
      } else if (filter?.status) {
        // Status is pending, in_progress, or blocked - use open issues
        stateFilter = 'open';
      }

      // Build labels filter
      const labelFilters: string[] = [];
      if (filter?.priority) {
        labelFilters.push(`${this.priorityPrefix}${filter.priority}`);
      }
      if (filter?.status && !['pending', 'completed'].includes(filter.status)) {
        labelFilters.push(`${this.statusPrefix}${filter.status}`);
      }
      if (filter?.labels) {
        labelFilters.push(...filter.labels);
      }

      const issues = await this.client.listIssues({
        owner,
        repo: repoName,
        state: stateFilter,
        labels: labelFilters.length > 0 ? labelFilters.join(',') : undefined,
        assignee: filter?.assignee,
        per_page: 100,
      });

      let tasks = issues.map(issue => this.issueToTask(issue, repo));

      if (filter?.status) {
        tasks = tasks.filter(t => t.status === filter.status);
      }

      const priorityOrder: Record<TaskPriority, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3
      };

      return tasks.sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    } catch (error) {
      // Return empty array for 404 errors (repo doesn't exist or no access)
      // This maintains backward compatibility with the gh CLI version
      return [];
    }
  }

  /**
   * Get pending tasks for a project
   */
  async getPendingTasks(projectName?: string): Promise<ProjectTask[]> {
    return this.getTasksByProject(projectName, { status: 'pending' });
  }

  /**
   * Get in-progress tasks
   */
  async getInProgressTasks(projectName?: string): Promise<ProjectTask[]> {
    return this.getTasksByProject(projectName, { status: 'in_progress' });
  }

  /**
   * Get a specific task by ID (issue number)
   */
  async getTask(projectName: string | undefined, taskId: string): Promise<ProjectTask | null> {
    try {
      const repo = await this.resolveRepo(projectName);
      const { owner, repo: repoName } = this.parseRepo(repo);
      const issue = await this.client.getIssue(owner, repoName, parseInt(taskId, 10));
      return this.issueToTask(issue, repo);
    } catch {
      return null;
    }
  }

  /**
   * Update a task
   */
  async updateTask(
    projectName: string | undefined,
    taskId: string,
    updates: Partial<Omit<ProjectTask, 'id' | 'projectName' | 'createdAt'>> & {
      comment?: string;
      commits?: string[];
      closeWithComment?: boolean;
    }
  ): Promise<ProjectTask | null> {
    try {
      const repo = await this.resolveRepo(projectName);
      const { owner, repo: repoName } = this.parseRepo(repo);
      const issueNumber = parseInt(taskId, 10);

      // Verify task exists before attempting update
      const existingTask = await this.ensureTaskExists(repo, taskId);

      // Build update params
      const updateParams: {
        owner: string;
        repo: string;
        issue_number: number;
        title?: string;
        body?: string;
        labels?: string[];
        assignees?: string[];
      } = {
        owner,
        repo: repoName,
        issue_number: issueNumber,
      };

      if (updates.title) {
        updateParams.title = updates.title;
      }

      if (updates.description !== undefined) {
        updateParams.body = updates.description || '';
      }

      if (updates.priority || updates.labels) {
        const newLabels = this.buildLabels(
          updates.priority || existingTask.priority,
          updates.status || existingTask.status,
          updates.labels || existingTask.labels
        );

        for (const label of newLabels) {
          if (label.startsWith(this.priorityPrefix) || label.startsWith(this.statusPrefix)) {
            await this.ensureLabel(repo, label);
          }
        }

        // Get existing labels and merge with new ones
        updateParams.labels = newLabels;
      }

      if (updates.assignee) {
        updateParams.assignees = [updates.assignee];
      }

      await this.client.updateIssue(updateParams);

      // Add comment if provided (with optional commit links)
      if (updates.comment || updates.commits?.length) {
        await this.addComment(repo, taskId, updates.comment, updates.commits);
      }

      if (updates.status) {
        await this.updateTaskStatus(repo, taskId, updates.status);
      } else if (updates.closeWithComment) {
        await this.updateTaskStatus(repo, taskId, 'completed');
      }

      const task = await this.getTask(repo, taskId);

      if (task) {
        await auditLogger.log({
          eventType: 'action_executed',
          action: 'task_updated',
          outcome: 'success',
          details: {
            taskId,
            projectName: repo,
            updates: Object.keys(updates),
            hasComment: !!updates.comment,
            commitCount: updates.commits?.length || 0
          }
        });
      }

      return task;
    } catch (error) {
      console.error(`[TaskManager] Failed to update task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Add a comment to a task/issue
   */
  async addComment(
    projectName: string | undefined,
    taskId: string,
    comment?: string,
    commits?: string[]
  ): Promise<boolean> {
    try {
      const repo = await this.resolveRepo(projectName);
      const { owner, repo: repoName } = this.parseRepo(repo);
      const issueNumber = parseInt(taskId, 10);

      // Verify task exists before attempting to add comment
      await this.ensureTaskExists(repo, taskId);

      // Build comment body
      let body = '';

      if (comment) {
        body += comment;
      }

      // Add commit references
      if (commits && commits.length > 0) {
        if (body) body += '\n\n';
        body += '### Related Commits\n';
        for (const commit of commits) {
          // Short SHA for display, full for linking
          const shortSha = commit.substring(0, 7);
          body += `- ${shortSha}\n`;
        }
      }

      if (!body) {
        return false;
      }

      await this.client.addComment(owner, repoName, issueNumber, body);

      await auditLogger.log({
        eventType: 'action_executed',
        action: 'task_comment_added',
        outcome: 'success',
        details: { taskId, projectName: repo, hasCommits: (commits?.length || 0) > 0 }
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Link commits to a task by adding a comment
   */
  async linkCommits(
    projectName: string | undefined,
    taskId: string,
    commits: string[],
    message?: string
  ): Promise<boolean> {
    return this.addComment(projectName, taskId, message, commits);
  }

  /**
   * Close a task with a resolution comment
   */
  async closeWithComment(
    projectName: string | undefined,
    taskId: string,
    resolution: string,
    commits?: string[]
  ): Promise<ProjectTask | null> {
    const repo = await this.resolveRepo(projectName);

    // Verify task exists before attempting to close
    await this.ensureTaskExists(repo, taskId);

    // Add the resolution comment
    await this.addComment(repo, taskId, `**Resolution:** ${resolution}`, commits);

    // Close the issue
    return this.updateTaskStatus(repo, taskId, 'completed');
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    projectName: string | undefined,
    taskId: string,
    status: TaskStatus
  ): Promise<ProjectTask | null> {
    try {
      const repo = await this.resolveRepo(projectName);
      const { owner, repo: repoName } = this.parseRepo(repo);
      const issueNumber = parseInt(taskId, 10);

      // Close or reopen based on status
      if (status === 'completed' || status === 'cancelled') {
        const reason = status === 'cancelled' ? 'not_planned' : 'completed';
        await this.client.closeIssue(owner, repoName, issueNumber, reason);
      } else {
        const task = await this.getTask(repo, taskId);
        if (task?.status === 'completed' || task?.status === 'cancelled') {
          await this.client.reopenIssue(owner, repoName, issueNumber);
        }
      }

      // Update status label
      if (status !== 'pending' && status !== 'completed') {
        const statusLabel = `${this.statusPrefix}${status}`;
        await this.ensureLabel(repo, statusLabel);
        await this.client.addLabels(owner, repoName, issueNumber, [statusLabel]);
      }

      // Remove old status labels
      const oldStatuses = ['in_progress', 'blocked', 'cancelled'].filter(s => s !== status);
      for (const oldStatus of oldStatuses) {
        try {
          await this.client.removeLabel(owner, repoName, issueNumber, `${this.statusPrefix}${oldStatus}`);
        } catch {
          // Ignore - label might not exist
        }
      }

      return this.getTask(repo, taskId);
    } catch {
      return null;
    }
  }

  /**
   * Start a task (set to in_progress)
   */
  async startTask(projectName: string | undefined, taskId: string): Promise<ProjectTask | null> {
    return this.updateTaskStatus(projectName, taskId, 'in_progress');
  }

  /**
   * Complete a task
   */
  async completeTask(projectName: string | undefined, taskId: string): Promise<ProjectTask | null> {
    return this.updateTaskStatus(projectName, taskId, 'completed');
  }

  /**
   * Block a task
   */
  async blockTask(
    projectName: string | undefined,
    taskId: string,
    reason?: string
  ): Promise<ProjectTask | null> {
    const repo = await this.resolveRepo(projectName);
    const { owner, repo: repoName } = this.parseRepo(repo);
    const issueNumber = parseInt(taskId, 10);

    // Verify task exists before attempting to block
    await this.ensureTaskExists(repo, taskId);

    if (reason) {
      await this.client.addComment(owner, repoName, issueNumber, `Blocked: ${reason}`);
    }
    return this.updateTaskStatus(repo, taskId, 'blocked');
  }

  /**
   * Delete a task (close as "not planned")
   */
  async deleteTask(projectName: string | undefined, taskId: string): Promise<boolean> {
    try {
      const repo = await this.resolveRepo(projectName);
      const { owner, repo: repoName } = this.parseRepo(repo);
      const issueNumber = parseInt(taskId, 10);

      await this.client.closeIssue(owner, repoName, issueNumber, 'not_planned');

      await auditLogger.log({
        eventType: 'action_executed',
        action: 'task_deleted',
        outcome: 'success',
        details: { taskId, projectName: repo }
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * List projects with issues
   */
  async listProjects(): Promise<Array<{
    name: string;
    taskCount: number;
    pendingCount: number;
    inProgressCount: number;
    completedCount: number;
  }>> {
    try {
      const repos = await this.client.listRepos(20);

      const projects: Array<{
        name: string;
        taskCount: number;
        pendingCount: number;
        inProgressCount: number;
        completedCount: number;
      }> = [];

      const results = await Promise.allSettled(
        repos.slice(0, 10).map(async (repo) => {
          try {
            const { owner, repo: repoName } = this.parseRepo(repo.nameWithOwner);

            const [openIssues, closedIssues] = await Promise.all([
              this.client.listIssues({ owner, repo: repoName, state: 'open', per_page: 100 }),
              this.client.listIssues({ owner, repo: repoName, state: 'closed', per_page: 100 })
            ]);

            const inProgressCount = openIssues.filter(i =>
              i.labels?.some(l =>
                l.name === `${this.statusPrefix}in_progress` ||
                l.name === 'in-progress' ||
                l.name === 'wip'
              )
            ).length;

            return {
              name: repo.nameWithOwner,
              taskCount: openIssues.length + closedIssues.length,
              pendingCount: openIssues.length - inProgressCount,
              inProgressCount,
              completedCount: closedIssues.length
            };
          } catch {
            return null;
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value && result.value.taskCount > 0) {
          projects.push(result.value);
        }
      }

      return projects.sort((a, b) => b.taskCount - a.taskCount);
    } catch {
      return [];
    }
  }

  /**
   * Get task statistics for a project
   */
  async getProjectStats(projectName?: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdue: number;
    completedThisWeek: number;
  } | null> {
    try {
      const repo = await this.resolveRepo(projectName);
      const { owner, repo: repoName } = this.parseRepo(repo);

      // Fetch issues for stats
      const [openIssues, closedIssues] = await Promise.all([
        this.client.listIssues({ owner, repo: repoName, state: 'open', per_page: 100 }),
        this.client.listIssues({ owner, repo: repoName, state: 'closed', per_page: 100 })
      ]);

      const byStatus: Record<string, number> = {};
      const byPriority: Record<string, number> = {};
      let completedThisWeek = 0;

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Process open issues
      for (const issue of openIssues) {
        const labels = issue.labels?.map(l => l.name) || [];

        // Extract status from labels
        const status = labels.find(l => l.startsWith(this.statusPrefix))?.replace(this.statusPrefix, '') || 'pending';
        byStatus[status] = (byStatus[status] || 0) + 1;

        // Extract priority from labels
        const priority = labels.find(l => l.startsWith(this.priorityPrefix))?.replace(this.priorityPrefix, '') || 'medium';
        byPriority[priority] = (byPriority[priority] || 0) + 1;
      }

      // Process closed issues
      for (const issue of closedIssues) {
        const labels = issue.labels?.map(l => l.name) || [];

        // Extract status from labels
        const status = labels.find(l => l.startsWith(this.statusPrefix))?.replace(this.statusPrefix, '') || 'completed';
        byStatus[status] = (byStatus[status] || 0) + 1;

        // Extract priority from labels
        const priority = labels.find(l => l.startsWith(this.priorityPrefix))?.replace(this.priorityPrefix, '') || 'medium';
        byPriority[priority] = (byPriority[priority] || 0) + 1;

        // Count completed this week
        if (issue.closed_at && new Date(issue.closed_at) >= oneWeekAgo) {
          completedThisWeek++;
        }
      }

      const total = openIssues.length + closedIssues.length;

      return {
        total,
        byStatus,
        byPriority,
        overdue: 0,
        completedThisWeek
      };
    } catch (error) {
      console.error('[TaskManager] Failed to get project stats:', error);
      return null;
    }
  }

  /**
   * Search tasks
   */
  async searchTasks(query: string, projectName?: string): Promise<ProjectTask[]> {
    try {
      let searchQuery = query;

      if (projectName) {
        searchQuery = `repo:${projectName} ${query}`;
      }

      const issues = await this.client.searchIssues({ query: searchQuery, per_page: 50 });

      return issues.map(issue => {
        const repoMatch = issue.html_url.match(/github\.com\/([^/]+\/[^/]+)\//);
        const repo = repoMatch ? repoMatch[1] : projectName || 'unknown';
        return this.issueToTask(issue, repo);
      });
    } catch {
      return [];
    }
  }

  /**
   * Get count of completed tasks (GitHub doesn't support bulk delete)
   */
  async clearCompletedTasks(projectName?: string): Promise<number> {
    const repo = await this.resolveRepo(projectName);
    const { owner, repo: repoName } = this.parseRepo(repo);

    const closedIssues = await this.client.listIssues({
      owner,
      repo: repoName,
      state: 'closed',
      per_page: 100
    });

    return closedIssues.length;
  }
}

// Export singleton instance
export const taskManager = new TaskManager();
