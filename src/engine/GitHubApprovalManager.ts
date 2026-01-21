/**
 * GitHub-based Approval Manager
 *
 * Uses GitHub Issues via `gh` CLI as the source of truth for approval requests.
 * Integrates with the task management system.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

const execAsync = promisify(exec);

export interface GitHubApprovalOptions {
  defaultRepo?: string; // Format: "owner/repo"
  approvalLabelName?: string;
  approvedLabelName?: string;
  deniedLabelName?: string;
  expirationHours?: number;
}

export interface ApprovalRequest {
  requestId: string;
  issueNumber: number;
  issueUrl: string;
  repo: string;
  actionId: string;
  reason: string;
  details?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  riskScore?: number;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  createdAt: string;
  expiresAt?: string;
}

export class GitHubApprovalManager {
  private defaultRepo: string;
  private approvalLabel: string;
  private approvedLabel: string;
  private deniedLabel: string;
  private expirationHours: number;

  constructor(options: GitHubApprovalOptions = {}) {
    this.defaultRepo = options.defaultRepo || '';
    this.approvalLabel = options.approvalLabelName || 'needs-approval';
    this.approvedLabel = options.approvedLabelName || 'approved';
    this.deniedLabel = options.deniedLabelName || 'denied';
    this.expirationHours = options.expirationHours || 24;
  }

  /**
   * Create a secure temporary file with unpredictable name and restricted permissions
   */
  private createSecureTempFile(prefix: string, content: string): string {
    const randomSuffix = randomBytes(16).toString('hex');
    const tempFile = join(tmpdir(), `${prefix}-${randomSuffix}.md`);
    writeFileSync(tempFile, content, { encoding: 'utf-8', mode: 0o600 });
    return tempFile;
  }

  /**
   * Safely delete a temp file, ignoring errors if the file doesn't exist
   */
  private safeDeleteTempFile(tempFile: string): void {
    try {
      unlinkSync(tempFile);
    } catch {
      // Ignore errors - file may not exist or already be deleted
    }
  }

  /**
   * Execute a function with a temp file, ensuring cleanup happens in all code paths (Fix #83)
   * This guarantees the temp file is deleted even if an exception occurs
   */
  private async withTempFile<T>(
    prefix: string,
    content: string,
    fn: (tempFile: string) => Promise<T>
  ): Promise<T> {
    const tempFile = this.createSecureTempFile(prefix, content);
    try {
      return await fn(tempFile);
    } finally {
      this.safeDeleteTempFile(tempFile);
    }
  }

  /**
   * Create a new approval request as a GitHub issue
   */
  async createApprovalIssue(params: {
    repo?: string;
    actionId: string;
    action: string;
    reason: string;
    details?: Record<string, unknown>;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    riskScore?: number;
    violations?: string[];
    warnings?: string[];
    context?: Record<string, unknown>;
  }): Promise<ApprovalRequest> {
    const repo = params.repo || this.defaultRepo;
    if (!repo) throw new Error('Repository required');

    const labels = [this.approvalLabel];
    if (params.priority) labels.push(`priority:${params.priority}`);
    if (params.riskScore && params.riskScore >= 80) labels.push('security');

    const expiresAt = new Date(Date.now() + this.expirationHours * 60 * 60 * 1000).toISOString();

    const body = this.formatApprovalIssueBody({
      actionId: params.actionId,
      action: params.action,
      reason: params.reason,
      details: params.details,
      riskScore: params.riskScore,
      violations: params.violations,
      warnings: params.warnings,
      context: params.context,
      expiresAt
    });

    // Create issue using gh CLI
    const title = `[APPROVAL REQUIRED] ${params.action}`;
    const labelArgs = labels.map(l => `--label "${l}"`).join(' ');

    // Write body to temp file to avoid shell escaping issues (Fix #83 - guaranteed cleanup)
    return this.withTempFile('gh-issue', body, async (tempFile) => {
      const cmd = `gh issue create --repo "${repo}" --title "${title}" ${labelArgs} --body-file "${tempFile}"`;
      const { stdout } = await execAsync(cmd);
      const issueUrl = stdout.trim();

      return this.parseApprovalResponse(issueUrl, repo, params, expiresAt);
    });
  }

  private parseApprovalResponse(issueUrl: string, repo: string, params: any, expiresAt: string): ApprovalRequest {

    // Extract issue number from URL
    const issueNumber = parseInt(issueUrl.split('/').pop() || '0');

    const createdAt = new Date().toISOString();

    return {
      requestId: `approval-${params.actionId}`,
      issueNumber,
      issueUrl,
      repo,
      actionId: params.actionId,
      reason: params.reason,
      details: params.details ? JSON.stringify(params.details) : undefined,
      priority: params.priority || 'normal',
      riskScore: params.riskScore,
      status: 'pending',
      createdAt,
      expiresAt
    };
  }

  /**
   * Add approval request to existing task issue
   */
  async addApprovalToTask(params: {
    repo?: string;
    issueNumber: number;
    actionId: string;
    reason: string;
    details?: Record<string, unknown>;
    riskScore?: number;
    violations?: string[];
    warnings?: string[];
  }): Promise<void> {
    const repo = params.repo || this.defaultRepo;
    if (!repo) throw new Error('Repository required');

    // Validate issue number format
    this.validateIssueNumber(params.issueNumber);

    // Add approval label
    await execAsync(`gh issue edit ${params.issueNumber} --repo "${repo}" --add-label "${this.approvalLabel}"`);

    // Add comment with approval details
    const expiresAt = new Date(Date.now() + this.expirationHours * 60 * 60 * 1000).toISOString();
    const comment = this.formatApprovalComment({
      actionId: params.actionId,
      reason: params.reason,
      details: params.details,
      riskScore: params.riskScore,
      violations: params.violations,
      warnings: params.warnings,
      expiresAt
    });

    // Write comment to temp file (Fix #83 - guaranteed cleanup)
    await this.withTempFile('gh-comment', comment, async (tempFile) => {
      await execAsync(`gh issue comment ${params.issueNumber} --repo "${repo}" --body-file "${tempFile}"`);
    });
  }

  /**
   * Validate that an issue number is a positive integer
   */
  private validateIssueNumber(issueNumber: number): void {
    if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
      throw new Error(`Invalid issue number: ${issueNumber}. Must be a positive integer.`);
    }
  }

  /**
   * Check approval status of a GitHub issue
   */
  async checkApprovalStatus(params: {
    repo?: string;
    issueNumber: number;
  }): Promise<ApprovalRequest> {
    const repo = params.repo || this.defaultRepo;
    if (!repo) throw new Error('Repository required');

    // Validate issue number format (Fix #85)
    this.validateIssueNumber(params.issueNumber);

    // Get issue details - fetched atomically via single API call (Fix #86)
    // The gh CLI returns a consistent snapshot of the issue state
    const { stdout } = await execAsync(
      `gh issue view ${params.issueNumber} --repo "${repo}" --json number,title,url,labels,state,createdAt,comments`
    );

    const issue = JSON.parse(stdout);
    const labels = issue.labels.map((l: any) => l.name);
    const hasApprovalLabel = labels.includes(this.approvalLabel);
    const hasApprovedLabel = labels.includes(this.approvedLabel);
    const hasDeniedLabel = labels.includes(this.deniedLabel);
    const isClosed = issue.state === 'CLOSED';

    let status: 'pending' | 'approved' | 'denied' | 'expired' = 'pending';

    if (hasApprovedLabel || (!hasApprovalLabel && !hasDeniedLabel && !isClosed)) {
      status = 'approved';
    } else if (hasDeniedLabel || isClosed) {
      status = 'denied';
    }

    // Check comments for /approve or /deny commands (Fix #86)
    // Process ALL comments chronologically to find the MOST RECENT command
    // This prevents race conditions where order matters
    let lastCommandStatus: 'approved' | 'denied' | null = null;
    let lastCommandTime: string | null = null;

    for (const comment of issue.comments) {
      const body = comment.body?.toLowerCase() || '';
      const commentTime = comment.createdAt || '';

      // Only update if this is a newer command than what we've seen
      if (body.includes('/approve')) {
        if (!lastCommandTime || commentTime > lastCommandTime) {
          lastCommandStatus = 'approved';
          lastCommandTime = commentTime;
        }
      }
      if (body.includes('/deny')) {
        if (!lastCommandTime || commentTime > lastCommandTime) {
          lastCommandStatus = 'denied';
          lastCommandTime = commentTime;
        }
      }
    }

    // Apply the most recent command status if found
    if (lastCommandStatus) {
      status = lastCommandStatus;
    }

    return {
      requestId: `approval-${issue.number}`,
      issueNumber: issue.number,
      issueUrl: issue.url,
      repo,
      actionId: issue.number.toString(),
      reason: issue.title,
      status,
      createdAt: issue.createdAt,
      priority: 'normal'
    };
  }

  /**
   * Approve a request (remove needs-approval label, add approved label)
   */
  async approveRequest(params: {
    repo?: string;
    issueNumber: number;
    approverId: string;
    comments?: string;
  }): Promise<void> {
    const repo = params.repo || this.defaultRepo;
    if (!repo) throw new Error('Repository required');

    // Validate issue number format
    this.validateIssueNumber(params.issueNumber);

    // Remove needs-approval label and add approved label
    await execAsync(
      `gh issue edit ${params.issueNumber} --repo "${repo}" --remove-label "${this.approvalLabel}" --add-label "${this.approvedLabel}"`
    );

    // Add approval comment (Fix #83 - guaranteed cleanup)
    const comment = `✅ **Approved** by ${params.approverId}\n\n${params.comments || 'No comments provided.'}`;
    await this.withTempFile('gh-approve', comment, async (tempFile) => {
      await execAsync(`gh issue comment ${params.issueNumber} --repo "${repo}" --body-file "${tempFile}"`);
    });
  }

  /**
   * Deny a request (add denied label, close issue)
   */
  async denyRequest(params: {
    repo?: string;
    issueNumber: number;
    denierId: string;
    reason?: string;
  }): Promise<void> {
    const repo = params.repo || this.defaultRepo;
    if (!repo) throw new Error('Repository required');

    // Validate issue number format
    this.validateIssueNumber(params.issueNumber);

    // Add denied label
    await execAsync(`gh issue edit ${params.issueNumber} --repo "${repo}" --add-label "${this.deniedLabel}"`);

    // Add denial comment (Fix #83 - guaranteed cleanup)
    const comment = `❌ **Denied** by ${params.denierId}\n\n${params.reason || 'No reason provided.'}`;
    await this.withTempFile('gh-deny', comment, async (tempFile) => {
      await execAsync(`gh issue comment ${params.issueNumber} --repo "${repo}" --body-file "${tempFile}"`);
    });

    // Close the issue
    await execAsync(`gh issue close ${params.issueNumber} --repo "${repo}" --reason "not planned"`);
  }

  /**
   * Get all pending approval requests
   */
  async getPendingApprovals(repo?: string): Promise<ApprovalRequest[]> {
    const targetRepo = repo || this.defaultRepo;
    if (!targetRepo) throw new Error('Repository required');

    const { stdout } = await execAsync(
      `gh issue list --repo "${targetRepo}" --label "${this.approvalLabel}" --state open --json number,title,url,labels,createdAt --limit 100`
    );

    const issues = JSON.parse(stdout);

    return issues.map((issue: any) => ({
      requestId: `approval-${issue.number}`,
      issueNumber: issue.number,
      issueUrl: issue.url,
      repo: targetRepo,
      actionId: issue.number.toString(),
      reason: issue.title,
      status: 'pending' as const,
      createdAt: issue.createdAt,
      priority: this.extractPriority(issue.labels)
    }));
  }

  /**
   * Extract priority from labels
   */
  private extractPriority(labels: any[]): 'low' | 'normal' | 'high' | 'urgent' {
    const labelNames = labels.map(l => l.name);
    if (labelNames.includes('priority:urgent')) return 'urgent';
    if (labelNames.includes('priority:high')) return 'high';
    if (labelNames.includes('priority:low')) return 'low';
    return 'normal';
  }

  /**
   * Format approval issue body
   */
  private formatApprovalIssueBody(params: {
    actionId: string;
    action: string;
    reason: string;
    details?: Record<string, unknown>;
    riskScore?: number;
    violations?: string[];
    warnings?: string[];
    context?: Record<string, unknown>;
    expiresAt: string;
  }): string {
    let body = `## 🔐 Approval Required\n\n`;
    body += `**Action:** ${params.action}\n`;
    body += `**Reason:** ${params.reason}\n`;
    body += `**Action ID:** \`${params.actionId}\`\n`;

    if (params.riskScore) {
      const emoji = params.riskScore >= 80 ? '🔴' : params.riskScore >= 60 ? '🟠' : '🟡';
      body += `**Risk Score:** ${emoji} ${params.riskScore}/100\n`;
    }

    body += `**Expires:** ${new Date(params.expiresAt).toLocaleString()}\n\n`;

    if (params.violations && params.violations.length > 0) {
      body += `### ⚠️ Violations\n`;
      params.violations.forEach(v => body += `- ${v}\n`);
      body += `\n`;
    }

    if (params.warnings && params.warnings.length > 0) {
      body += `### ⚡ Warnings\n`;
      params.warnings.forEach(w => body += `- ${w}\n`);
      body += `\n`;
    }

    if (params.details) {
      body += `### 📋 Details\n\`\`\`json\n${JSON.stringify(params.details, null, 2)}\n\`\`\`\n\n`;
    }

    if (params.context) {
      body += `### 🔍 Context\n\`\`\`json\n${JSON.stringify(params.context, null, 2)}\n\`\`\`\n\n`;
    }

    body += `---\n\n`;
    body += `### How to Approve/Deny\n\n`;
    body += `- **Approve:** Remove the \`needs-approval\` label or comment \`/approve\`\n`;
    body += `- **Deny:** Add the \`denied\` label or comment \`/deny\`\n`;

    return body;
  }

  /**
   * Format approval comment for existing task
   */
  private formatApprovalComment(params: {
    actionId: string;
    reason: string;
    details?: Record<string, unknown>;
    riskScore?: number;
    violations?: string[];
    warnings?: string[];
    expiresAt: string;
  }): string {
    let comment = `## 🔐 Approval Required for This Task\n\n`;
    comment += `**Reason:** ${params.reason}\n`;
    comment += `**Action ID:** \`${params.actionId}\`\n`;

    if (params.riskScore) {
      const emoji = params.riskScore >= 80 ? '🔴' : params.riskScore >= 60 ? '🟠' : '🟡';
      comment += `**Risk Score:** ${emoji} ${params.riskScore}/100\n`;
    }

    comment += `**Expires:** ${new Date(params.expiresAt).toLocaleString()}\n\n`;

    if (params.violations && params.violations.length > 0) {
      comment += `### ⚠️ Violations\n`;
      params.violations.forEach(v => comment += `- ${v}\n`);
      comment += `\n`;
    }

    if (params.warnings && params.warnings.length > 0) {
      comment += `### ⚡ Warnings\n`;
      params.warnings.forEach(w => comment += `- ${w}\n`);
      comment += `\n`;
    }

    if (params.details) {
      comment += `### 📋 Details\n\`\`\`json\n${JSON.stringify(params.details, null, 2)}\n\`\`\`\n\n`;
    }

    comment += `**To approve:** Remove the \`needs-approval\` label or comment \`/approve\`\n`;
    comment += `**To deny:** Add the \`denied\` label or comment \`/deny\`\n`;

    return comment;
  }
}
