/**
 * Enterprise Agent Supervisor - Task Manager
 *
 * Manages project tasks using GitHub Issues via the `gh` CLI.
 * Tasks are stored as GitHub Issues, providing persistence and visibility.
 *
 * Features:
 * - Auto-detects repo from current directory if not specified
 * - Creates priority/status labels automatically
 * - Caches repo detection for performance
 * - Full GitHub Issues integration
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  ProjectTask,
  TaskPriority,
  TaskStatus
} from '../types/index.js';
import { auditLogger } from './AuditLogger.js';
import { escapeForShell } from '../utils/shell.js';

const execAsync = promisify(exec);

export interface TaskManagerOptions {
  defaultLabels?: string[];
  priorityLabelPrefix?: string;
  statusLabelPrefix?: string;
}

// GitHub Issue structure from gh CLI
interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'OPEN' | 'CLOSED';
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  url: string;
  milestone?: { title: string } | null;
}

interface GitHubLabel {
  name: string;
  color: string;
  description: string;
}

export class TaskManager {
  private priorityPrefix: string;
  private statusPrefix: string;
  private cachedRepo: string | null = null;
  private initializedLabels: Set<string> = new Set();
  private ghVerified: boolean = false;

  constructor(options: TaskManagerOptions = {}) {
    this.priorityPrefix = options.priorityLabelPrefix || 'priority:';
    this.statusPrefix = options.statusLabelPrefix || 'status:';
  }

  /**
   * Verify gh CLI is installed and authenticated
   */
  async verifyGh(): Promise<{ ok: boolean; error?: string; user?: string }> {
    if (this.ghVerified) return { ok: true };

    try {
      const { stdout } = await execAsync('gh auth status --json user 2>&1 || gh auth status');
      this.ghVerified = true;

      // Try to extract user
      try {
        const status = JSON.parse(stdout);
        return { ok: true, user: status.user };
      } catch {
        return { ok: true };
      }
    } catch (error: any) {
      return {
        ok: false,
        error: 'gh CLI not authenticated. Run: gh auth login'
      };
    }
  }

  /**
   * Get the current repo from git remote or gh CLI
   */
  async getCurrentRepo(): Promise<string | null> {
    if (this.cachedRepo) return this.cachedRepo;

    try {
      // Try to get repo from current directory
      const { stdout } = await execAsync('gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null');
      this.cachedRepo = stdout.trim();
      return this.cachedRepo;
    } catch {
      return null;
    }
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
   * Execute a gh command and return parsed JSON output
   */
  private async execGh<T>(command: string): Promise<T> {
    try {
      const { stdout } = await execAsync(`gh ${command}`, {
        maxBuffer: 10 * 1024 * 1024
      });
      return JSON.parse(stdout || '[]') as T;
    } catch (error: any) {
      if (error.stdout === '' || error.stdout === '[]') {
        return [] as T;
      }

      // Parse error message for better feedback
      const errMsg = error.stderr || error.message || 'Unknown error';
      if (errMsg.includes('Could not resolve to a Repository')) {
        throw new Error(`Repository not found. Check the repo name format (owner/repo).`);
      }
      if (errMsg.includes('HTTP 404')) {
        throw new Error(`Not found - check repository access permissions.`);
      }
      if (errMsg.includes('HTTP 401') || errMsg.includes('authentication')) {
        throw new Error(`Authentication failed. Run: gh auth login`);
      }

      throw new Error(`gh command failed: ${errMsg}`);
    }
  }

  /**
   * Execute a gh command without JSON output
   */
  private async execGhRaw(command: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`gh ${command}`);
      return stdout.trim();
    } catch (error: any) {
      const errMsg = error.stderr || error.message || 'Unknown error';
      throw new Error(`gh command failed: ${errMsg}`);
    }
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

    try {
      // Check if label exists
      await this.execGh<GitHubLabel>(`label view "${labelName}" --repo "${repo}" --json name`);
      this.initializedLabels.add(cacheKey);
    } catch {
      // Label doesn't exist, create it
      try {
        const color = labelColors[labelName] || '666666';
        const description = labelName.startsWith(this.priorityPrefix)
          ? `Priority: ${labelName.replace(this.priorityPrefix, '')}`
          : labelName.startsWith(this.statusPrefix)
            ? `Status: ${labelName.replace(this.statusPrefix, '')}`
            : labelName === 'needs-approval'
              ? 'Significant change requiring approval before implementation'
              : '';

        await this.execGhRaw(
          `label create "${labelName}" --repo "${repo}" --color "${color}" --description "${description}" --force`
        );
        this.initializedLabels.add(cacheKey);
      } catch {
        // Label creation failed, might be permissions - continue anyway
        this.initializedLabels.add(cacheKey);
      }
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
    let status: TaskStatus = issue.state === 'OPEN' ? 'pending' : 'completed';
    const statusLabel = labels.find(l => l.startsWith(this.statusPrefix));
    if (statusLabel) {
      const labelStatus = statusLabel.replace(this.statusPrefix, '');
      if (['pending', 'in_progress', 'completed', 'blocked', 'cancelled'].includes(labelStatus)) {
        status = labelStatus as TaskStatus;
      }
    } else if (issue.state === 'OPEN') {
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
      assignee: issue.assignees[0]?.login,
      labels: cleanLabels.length > 0 ? cleanLabels : undefined,
      dueDate: issue.milestone?.title,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      completedAt: issue.closedAt || undefined,
      metadata: { url: issue.url }
    };
  }

  /**
   * Build labels array for gh command
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

    // Build the gh issue create command
    let cmd = `issue create --repo "${repo}" --title ${escapeForShell(params.title)}`;

    if (params.description) {
      cmd += ` --body ${escapeForShell(params.description)}`;
    }

    if (allLabels.length > 0) {
      cmd += ` --label "${allLabels.join(',')}"`;
    }

    if (params.assignee) {
      // Handle @me specially
      const assignee = params.assignee === '@me' ? '@me' : params.assignee;
      cmd += ` --assignee "${assignee}"`;
    }

    // Create the issue - gh issue create returns the URL, not JSON
    const issueUrl = await this.execGhRaw(cmd);

    // Extract issue number from URL (e.g., https://github.com/owner/repo/issues/123)
    const issueNumberMatch = issueUrl.match(/\/issues\/(\d+)/);
    if (!issueNumberMatch) {
      throw new Error(`Failed to parse issue number from: ${issueUrl}`);
    }
    const issueNumber = issueNumberMatch[1];

    // Fetch the full issue details
    const result = await this.execGh<GitHubIssue>(
      `issue view ${issueNumber} --repo "${repo}" --json number,title,body,state,labels,assignees,createdAt,updatedAt,closedAt,url`
    );

    const task = this.issueToTask(result, repo);

    await auditLogger.log({
      eventType: 'action_executed',
      action: 'task_created',
      outcome: 'success',
      details: {
        taskId: task.id,
        projectName: repo,
        title: params.title,
        priority: task.priority,
        ghIssueUrl: result.url
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
    const repo = await this.resolveRepo(projectName);

    let stateFilter = 'all';
    if (filter?.status === 'completed' || filter?.status === 'cancelled') {
      stateFilter = 'closed';
    } else if (filter?.status) {
      // Status is pending, in_progress, or blocked - use open issues
      stateFilter = 'open';
    }

    let cmd = `issue list --repo "${repo}" --state ${stateFilter} --json number,title,body,state,labels,assignees,createdAt,updatedAt,closedAt,url --limit 100`;

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

    if (labelFilters.length > 0) {
      cmd += ` --label "${labelFilters.join(',')}"`;
    }

    if (filter?.assignee) {
      cmd += ` --assignee "${filter.assignee}"`;
    }

    const issues = await this.execGh<GitHubIssue[]>(cmd);
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
      const issue = await this.execGh<GitHubIssue>(
        `issue view ${taskId} --repo "${repo}" --json number,title,body,state,labels,assignees,createdAt,updatedAt,closedAt,url`
      );
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

      // Verify task exists before attempting update
      const existingTask = await this.getTask(repo, taskId);
      if (!existingTask) {
        console.error(`[TaskManager] Cannot update task ${taskId}: task not found in ${repo}`);
        return null;
      }

      let cmd = `issue edit ${taskId} --repo "${repo}"`;

      if (updates.title) {
        cmd += ` --title ${escapeForShell(updates.title)}`;
      }

      if (updates.description !== undefined) {
        cmd += ` --body ${escapeForShell(updates.description || '')}`;
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

        if (newLabels.length > 0) {
          cmd += ` --add-label ${escapeForShell(newLabels.join(','))}`;
        }
      }

      if (updates.assignee) {
        cmd += ` --add-assignee ${escapeForShell(updates.assignee)}`;
      }

      await this.execGhRaw(cmd);

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

      await this.execGhRaw(`issue comment ${taskId} --repo "${repo}" --body ${escapeForShell(body)}`);

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

      // Close or reopen based on status
      if (status === 'completed' || status === 'cancelled') {
        const reason = status === 'cancelled' ? ' --reason "not planned"' : '';
        await this.execGhRaw(`issue close ${taskId} --repo "${repo}"${reason}`);
      } else {
        const task = await this.getTask(repo, taskId);
        if (task?.status === 'completed' || task?.status === 'cancelled') {
          await this.execGhRaw(`issue reopen ${taskId} --repo "${repo}"`);
        }
      }

      // Update status label
      if (status !== 'pending' && status !== 'completed') {
        const statusLabel = `${this.statusPrefix}${status}`;
        await this.ensureLabel(repo, statusLabel);
        await this.execGhRaw(`issue edit ${escapeForShell(taskId)} --repo ${escapeForShell(repo)} --add-label ${escapeForShell(statusLabel)}`);
      }

      // Remove old status labels
      const oldStatuses = ['in_progress', 'blocked', 'cancelled'].filter(s => s !== status);
      for (const oldStatus of oldStatuses) {
        try {
          await this.execGhRaw(`issue edit ${escapeForShell(taskId)} --repo ${escapeForShell(repo)} --remove-label ${escapeForShell(this.statusPrefix + oldStatus)}`);
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
    if (reason) {
      await this.execGhRaw(`issue comment ${taskId} --repo "${repo}" --body "Blocked: ${reason}"`);
    }
    return this.updateTaskStatus(repo, taskId, 'blocked');
  }

  /**
   * Delete a task (close as "not planned")
   */
  async deleteTask(projectName: string | undefined, taskId: string): Promise<boolean> {
    try {
      const repo = await this.resolveRepo(projectName);
      await this.execGhRaw(`issue close ${taskId} --repo "${repo}" --reason "not planned"`);

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
      const repos = await this.execGh<Array<{ nameWithOwner: string }>>(
        'repo list --limit 20 --json nameWithOwner'
      );

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
            const [openIssues, closedIssues] = await Promise.all([
              this.execGh<GitHubIssue[]>(`issue list --repo "${repo.nameWithOwner}" --state open --json number,labels --limit 100`),
              this.execGh<GitHubIssue[]>(`issue list --repo "${repo.nameWithOwner}" --state closed --json number --limit 100`)
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

      // Fetch only minimal fields needed for stats (labels, closedAt)
      // Increased limit to 500 to capture more tasks for accurate stats
      const [openIssues, closedIssues] = await Promise.all([
        this.execGh<Array<{ labels: GitHubLabel[] }>>(`issue list --repo "${repo}" --state open --json labels --limit 500`),
        this.execGh<Array<{ labels: GitHubLabel[]; closedAt?: string }>>(`issue list --repo "${repo}" --state closed --json labels,closedAt --limit 500`)
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
        if (issue.closedAt && new Date(issue.closedAt) >= oneWeekAgo) {
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
      let cmd = `issue list --search "${query}" --state all --json number,title,body,state,labels,assignees,createdAt,updatedAt,closedAt,url --limit 50`;

      if (projectName) {
        cmd += ` --repo "${projectName}"`;
      }

      const issues = await this.execGh<GitHubIssue[]>(cmd);

      return issues.map(issue => {
        const repoMatch = issue.url.match(/github\.com\/([^/]+\/[^/]+)\//);
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
    const closedIssues = await this.execGh<GitHubIssue[]>(
      `issue list --repo "${repo}" --state closed --json number --limit 100`
    );
    return closedIssues.length;
  }
}

// Export singleton instance
export const taskManager = new TaskManager();
