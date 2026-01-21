/**
 * Enterprise Agent Supervisor - GitHub Client
 *
 * Provides a clean wrapper around the GitHub API via Octokit.
 * Used by TaskManager for GitHub Issues operations.
 *
 * Features:
 * - Singleton pattern for connection reuse
 * - Automatic authentication via GITHUB_TOKEN
 * - Repository auto-detection from git remote
 * - Proper TypeScript types
 * - Structured error handling
 */

import { Octokit } from '@octokit/rest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// GitHub API response types
export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  state_reason?: 'completed' | 'not_planned' | 'reopened' | null;
  labels: Array<{ name: string; color?: string; description?: string | null }>;
  assignees: Array<{ login: string }> | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
  milestone?: { title: string } | null;
}

export interface GitHubLabel {
  name: string;
  color: string;
  description: string | null;
}

export interface CreateIssueParams {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

export interface UpdateIssueParams {
  owner: string;
  repo: string;
  issue_number: number;
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  state_reason?: 'completed' | 'not_planned' | 'reopened';
  labels?: string[];
  assignees?: string[];
  milestone?: number | null;
}

export interface ListIssuesParams {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  labels?: string;
  assignee?: string;
  per_page?: number;
  page?: number;
}

export interface SearchIssuesParams {
  query: string;
  per_page?: number;
  page?: number;
}

export interface GitHubClientError extends Error {
  status?: number;
  code?: string;
}

/**
 * GitHub API client using Octokit
 */
export class GitHubClient {
  private static instance: GitHubClient | null = null;
  private octokit: Octokit;
  private cachedRepo: { owner: string; repo: string } | null = null;
  private authenticated: boolean = false;

  private constructor() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.warn('[GitHubClient] GITHUB_TOKEN not set - some operations may fail');
    }

    this.octokit = new Octokit({
      auth: token,
      userAgent: 'enterprise-agent-supervisor/1.1.3',
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): GitHubClient {
    if (!GitHubClient.instance) {
      GitHubClient.instance = new GitHubClient();
    }
    return GitHubClient.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    GitHubClient.instance = null;
  }

  /**
   * Verify authentication and get current user
   */
  async verifyAuth(): Promise<{ ok: boolean; user?: string; error?: string }> {
    if (this.authenticated) {
      return { ok: true };
    }

    try {
      const { data } = await this.octokit.users.getAuthenticated();
      this.authenticated = true;
      return { ok: true, user: data.login };
    } catch (error: unknown) {
      const err = error as GitHubClientError;
      if (err.status === 401) {
        return { ok: false, error: 'GitHub authentication failed. Set GITHUB_TOKEN environment variable.' };
      }
      return { ok: false, error: err.message || 'Unknown authentication error' };
    }
  }

  /**
   * Parse owner/repo string into components
   */
  parseRepo(repoString: string): { owner: string; repo: string } {
    const parts = repoString.split('/');
    if (parts.length !== 2) {
      throw new Error(`Invalid repository format: ${repoString}. Expected "owner/repo".`);
    }
    return { owner: parts[0], repo: parts[1] };
  }

  /**
   * Get current repository from git remote
   */
  async getCurrentRepo(): Promise<{ owner: string; repo: string } | null> {
    if (this.cachedRepo) {
      return this.cachedRepo;
    }

    try {
      // Try to get repo from git remote
      const { stdout } = await execAsync('git remote get-url origin 2>/dev/null');
      const url = stdout.trim();

      // Parse various git remote URL formats:
      // https://github.com/owner/repo.git
      // git@github.com:owner/repo.git
      // https://github.com/owner/repo
      let match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
      if (match) {
        this.cachedRepo = { owner: match[1], repo: match[2] };
        return this.cachedRepo;
      }
    } catch {
      // Git command failed
    }

    return null;
  }

  /**
   * Handle API errors consistently
   */
  private handleError(error: unknown, operation: string): never {
    const err = error as GitHubClientError;

    if (err.status === 401) {
      throw new Error(`Authentication failed for ${operation}. Check GITHUB_TOKEN.`);
    }
    if (err.status === 403) {
      throw new Error(`Permission denied for ${operation}. Check repository access.`);
    }
    if (err.status === 404) {
      throw new Error(`Not found during ${operation}. Check repository/issue exists.`);
    }
    if (err.status === 422) {
      throw new Error(`Validation failed for ${operation}: ${err.message}`);
    }

    throw new Error(`GitHub API error during ${operation}: ${err.message || 'Unknown error'}`);
  }

  // ============================================================================
  // ISSUE OPERATIONS
  // ============================================================================

  /**
   * Create a new issue
   */
  async createIssue(params: CreateIssueParams): Promise<GitHubIssue> {
    try {
      const { data } = await this.octokit.issues.create({
        owner: params.owner,
        repo: params.repo,
        title: params.title,
        body: params.body,
        labels: params.labels,
        assignees: params.assignees,
        milestone: params.milestone,
      });

      return this.normalizeIssue(data);
    } catch (error) {
      this.handleError(error, 'createIssue');
    }
  }

  /**
   * Get a single issue by number
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    try {
      const { data } = await this.octokit.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });

      return this.normalizeIssue(data);
    } catch (error) {
      this.handleError(error, 'getIssue');
    }
  }

  /**
   * List issues for a repository
   */
  async listIssues(params: ListIssuesParams): Promise<GitHubIssue[]> {
    try {
      const { data } = await this.octokit.issues.listForRepo({
        owner: params.owner,
        repo: params.repo,
        state: params.state || 'all',
        labels: params.labels,
        assignee: params.assignee,
        per_page: params.per_page || 100,
        page: params.page || 1,
      });

      // Filter out pull requests (GitHub API returns PRs in issues endpoint)
      return data
        .filter((issue) => !('pull_request' in issue))
        .map((issue) => this.normalizeIssue(issue));
    } catch (error) {
      this.handleError(error, 'listIssues');
    }
  }

  /**
   * Update an existing issue
   */
  async updateIssue(params: UpdateIssueParams): Promise<GitHubIssue> {
    try {
      const { data } = await this.octokit.issues.update({
        owner: params.owner,
        repo: params.repo,
        issue_number: params.issue_number,
        title: params.title,
        body: params.body,
        state: params.state,
        state_reason: params.state_reason,
        labels: params.labels,
        assignees: params.assignees,
        milestone: params.milestone,
      });

      return this.normalizeIssue(data);
    } catch (error) {
      this.handleError(error, 'updateIssue');
    }
  }

  /**
   * Close an issue
   */
  async closeIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    reason: 'completed' | 'not_planned' = 'completed'
  ): Promise<GitHubIssue> {
    return this.updateIssue({
      owner,
      repo,
      issue_number: issueNumber,
      state: 'closed',
      state_reason: reason,
    });
  }

  /**
   * Reopen an issue
   */
  async reopenIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    return this.updateIssue({
      owner,
      repo,
      issue_number: issueNumber,
      state: 'open',
      state_reason: 'reopened',
    });
  }

  // ============================================================================
  // COMMENT OPERATIONS
  // ============================================================================

  /**
   * Add a comment to an issue
   */
  async addComment(owner: string, repo: string, issueNumber: number, body: string): Promise<void> {
    try {
      await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
      });
    } catch (error) {
      this.handleError(error, 'addComment');
    }
  }

  // ============================================================================
  // LABEL OPERATIONS
  // ============================================================================

  /**
   * Get a label
   */
  async getLabel(owner: string, repo: string, labelName: string): Promise<GitHubLabel | null> {
    try {
      const { data } = await this.octokit.issues.getLabel({
        owner,
        repo,
        name: labelName,
      });

      return {
        name: data.name,
        color: data.color,
        description: data.description,
      };
    } catch (error: unknown) {
      const err = error as GitHubClientError;
      if (err.status === 404) {
        return null;
      }
      this.handleError(error, 'getLabel');
    }
  }

  /**
   * Create a label
   */
  async createLabel(
    owner: string,
    repo: string,
    name: string,
    color: string,
    description?: string
  ): Promise<GitHubLabel> {
    try {
      const { data } = await this.octokit.issues.createLabel({
        owner,
        repo,
        name,
        color,
        description,
      });

      return {
        name: data.name,
        color: data.color,
        description: data.description,
      };
    } catch (error: unknown) {
      const err = error as GitHubClientError;
      // If label already exists, ignore the error
      if (err.status === 422) {
        return { name, color, description: description || null };
      }
      this.handleError(error, 'createLabel');
    }
  }

  /**
   * Add labels to an issue
   */
  async addLabels(owner: string, repo: string, issueNumber: number, labels: string[]): Promise<void> {
    try {
      await this.octokit.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels,
      });
    } catch (error) {
      this.handleError(error, 'addLabels');
    }
  }

  /**
   * Remove a label from an issue
   */
  async removeLabel(owner: string, repo: string, issueNumber: number, label: string): Promise<void> {
    try {
      await this.octokit.issues.removeLabel({
        owner,
        repo,
        issue_number: issueNumber,
        name: label,
      });
    } catch (error: unknown) {
      const err = error as GitHubClientError;
      // Ignore if label doesn't exist on the issue
      if (err.status === 404) {
        return;
      }
      this.handleError(error, 'removeLabel');
    }
  }

  // ============================================================================
  // SEARCH OPERATIONS
  // ============================================================================

  /**
   * Search issues
   */
  async searchIssues(params: SearchIssuesParams): Promise<GitHubIssue[]> {
    try {
      const { data } = await this.octokit.search.issuesAndPullRequests({
        q: params.query + ' is:issue',
        per_page: params.per_page || 50,
        page: params.page || 1,
      });

      return data.items.map((item) => this.normalizeIssue(item as any));
    } catch (error) {
      this.handleError(error, 'searchIssues');
    }
  }

  // ============================================================================
  // REPOSITORY OPERATIONS
  // ============================================================================

  /**
   * List repositories for authenticated user
   */
  async listRepos(limit: number = 20): Promise<Array<{ nameWithOwner: string }>> {
    try {
      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        per_page: limit,
        sort: 'pushed',
      });

      return data.map((repo) => ({ nameWithOwner: repo.full_name }));
    } catch (error) {
      this.handleError(error, 'listRepos');
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Normalize issue data to our interface
   */
  private normalizeIssue(data: any): GitHubIssue {
    return {
      number: data.number,
      title: data.title,
      body: data.body,
      state: data.state,
      state_reason: data.state_reason,
      labels: (data.labels || []).map((label: any) => ({
        name: typeof label === 'string' ? label : label.name,
        color: typeof label === 'string' ? undefined : label.color,
        description: typeof label === 'string' ? null : label.description,
      })),
      assignees: data.assignees || [],
      created_at: data.created_at,
      updated_at: data.updated_at,
      closed_at: data.closed_at,
      html_url: data.html_url,
      milestone: data.milestone ? { title: data.milestone.title } : null,
    };
  }
}

// Export singleton getter for convenience
export const gitHubClient = GitHubClient.getInstance();
