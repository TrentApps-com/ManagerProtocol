/**
 * Project Tracker - Tracks agent activity across projects
 *
 * This system monitors:
 * - Which agents are working in which projects
 * - Real-time agent activity logs per project
 * - Project metadata (git info, path, status)
 * - Historical activity and statistics
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export interface AgentActivity {
  agentId: string;
  sessionId: string;
  action: string;
  category: string;
  timestamp: string;
  details?: any;
  riskScore?: number;
  outcome?: 'success' | 'failure' | 'pending';
  duration?: number;
  // Metrics
  tokensUsed?: number;
  estimatedCost?: number;
  latencyMs?: number;
}

export interface MetricsSummary {
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  errorRate: number;
  requestCount: number;
  last24h: {
    tokens: number;
    cost: number;
    requests: number;
    errors: number;
  };
}

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  type: 'git' | 'directory';

  // Git information
  gitRepo?: string;
  gitBranch?: string;
  gitRemote?: string;
  gitCommit?: string;

  // Production deployment
  productionPort?: number;
  productionUrl?: string;

  // Status
  activeAgents: number;
  lastActivity?: string;
  totalActions: number;

  // Statistics
  stats: {
    totalEvents: number;
    successRate: number;
    avgRiskScore: number;
    topCategories: { category: string; count: number }[];
  };
}

export interface AgentInfo {
  agentId: string;
  sessionId: string;
  currentProject?: string;
  startTime: string;
  lastActivity: string;
  actionsCount: number;
  status: 'active' | 'idle' | 'disconnected';
}

class ProjectTracker {
  private projects: Map<string, ProjectInfo> = new Map();
  private agents: Map<string, AgentInfo> = new Map();
  private activityLog: Map<string, AgentActivity[]> = new Map(); // projectId -> activities
  private agentActivityIndex: Map<string, AgentActivity[]> = new Map(); // agentId -> activities (performance index)
  private agentToProject: Map<string, string> = new Map(); // agentId -> projectId

  // Configuration
  private maxActivitiesPerProject = 1000;
  private activityRetentionMs = 24 * 60 * 60 * 1000; // 24 hours
  private agentIdleTimeoutMs = 5 * 60 * 1000; // 5 minutes of inactivity = idle
  private agentDisconnectTimeoutMs = 30 * 60 * 1000; // 30 minutes = disconnected

  /**
   * Register or update a project
   */
  async registerProject(projectPath: string): Promise<ProjectInfo> {
    const projectId = this.getProjectId(projectPath);

    let project = this.projects.get(projectId);
    if (!project) {
      project = await this.createProjectInfo(projectPath);
      this.projects.set(projectId, project);
      this.activityLog.set(projectId, []);
    } else {
      // Update git info
      await this.updateGitInfo(project, projectPath);
    }

    return project;
  }

  /**
   * Record agent activity in a project
   * NO LONGER auto-creates agent entries - use registerSession() explicitly
   */
  recordActivity(
    projectPath: string,
    agentId: string,
    sessionId: string,
    activity: Omit<AgentActivity, 'agentId' | 'sessionId' | 'timestamp'>
  ): void {
    const projectId = this.getProjectId(projectPath);

    // Ensure project exists
    if (!this.projects.has(projectId)) {
      // Auto-register project
      this.registerProject(projectPath).catch(console.error);
    }

    // Record activity
    const fullActivity: AgentActivity = {
      agentId,
      sessionId,
      timestamp: new Date().toISOString(),
      ...activity
    };

    const activities = this.activityLog.get(projectId) || [];
    activities.unshift(fullActivity); // Add to beginning

    // Trim old activities
    if (activities.length > this.maxActivitiesPerProject) {
      activities.splice(this.maxActivitiesPerProject);
    }

    this.activityLog.set(projectId, activities);

    // Update agent activity index for efficient agent-based queries
    const agentActivities = this.agentActivityIndex.get(agentId) || [];
    agentActivities.unshift(fullActivity);
    if (agentActivities.length > this.maxActivitiesPerProject) {
      agentActivities.splice(this.maxActivitiesPerProject);
    }
    this.agentActivityIndex.set(agentId, agentActivities);

    // Update project stats
    this.updateProjectStats(projectId);

    // Only update agent if it's already registered
    if (this.agents.has(agentId)) {
      this.updateAgentInfo(agentId, sessionId, projectPath);
      this.agentToProject.set(agentId, projectId);
    }
  }

  /**
   * Explicitly register a session/agent working on a project
   * Must be called by services or Claude instances to appear in agent list
   */
  registerSession(params: {
    agentId: string;
    sessionId: string;
    projectPath: string;
    agentType?: 'claude' | 'scheduler' | 'service' | 'manual';
    metadata?: Record<string, any>;
  }): AgentInfo {
    const projectId = this.getProjectId(params.projectPath);

    // Ensure project exists
    if (!this.projects.has(projectId)) {
      this.registerProject(params.projectPath).catch(console.error);
    }

    let agent = this.agents.get(params.agentId);

    if (!agent) {
      agent = {
        agentId: params.agentId,
        sessionId: params.sessionId,
        currentProject: projectId,
        startTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        actionsCount: 0,
        status: 'active',
        ...(params.agentType && { type: params.agentType }),
        ...(params.metadata && { metadata: params.metadata })
      } as AgentInfo;
    } else {
      agent.currentProject = projectId;
      agent.lastActivity = new Date().toISOString();
      agent.status = 'active';
      if (params.metadata) {
        (agent as any).metadata = { ...(agent as any).metadata, ...params.metadata };
      }
    }

    this.agents.set(params.agentId, agent);
    this.agentToProject.set(params.agentId, projectId);

    return agent;
  }

  /**
   * Explicitly unregister/complete a session
   */
  completeSession(agentId: string, outcome?: 'success' | 'failure' | 'cancelled'): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = 'disconnected';
      (agent as any).completedAt = new Date().toISOString();
      if (outcome) {
        (agent as any).outcome = outcome;
      }
      this.agents.set(agentId, agent);

      // Will be cleaned up by cleanupStaleAgents after retention period
    }
  }

  /**
   * Get all projects
   */
  getProjects(): ProjectInfo[] {
    return Array.from(this.projects.values())
      .sort((a, b) => {
        // Sort by last activity, most recent first
        if (!a.lastActivity && !b.lastActivity) return 0;
        if (!a.lastActivity) return 1;
        if (!b.lastActivity) return -1;
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      });
  }

  /**
   * Get project by ID or path
   */
  getProject(idOrPath: string): ProjectInfo | undefined {
    const projectId = idOrPath.startsWith('/') ? this.getProjectId(idOrPath) : idOrPath;
    return this.projects.get(projectId);
  }

  /**
   * Get project activities
   */
  getProjectActivities(projectId: string, limit = 100): AgentActivity[] {
    const activities = this.activityLog.get(projectId) || [];
    return activities.slice(0, limit);
  }

  /**
   * Get agent activities efficiently (uses index, no N+1 queries)
   */
  getAgentActivities(agentId: string, limit = 100): AgentActivity[] {
    const activities = this.agentActivityIndex.get(agentId) || [];
    return activities.slice(0, limit);
  }

  /**
   * Get recent activities across all projects efficiently
   * Uses k-way merge for optimal performance (O(n log k) where n=limit, k=projects)
   * Avoids fetching and sorting thousands of activities when only need a few
   */
  getAllRecentActivities(limit = 50): Array<AgentActivity & { projectId: string; projectName: string }> {
    // Create iterators for each project's activity log
    const projectIterators: Array<{
      projectId: string;
      projectName: string;
      activities: AgentActivity[];
      index: number;
    }> = [];

    for (const [projectId, activities] of this.activityLog.entries()) {
      if (activities.length > 0) {
        const project = this.projects.get(projectId);
        projectIterators.push({
          projectId,
          projectName: project?.name || projectId,
          activities,
          index: 0
        });
      }
    }

    // K-way merge using a simple approach
    const result: Array<AgentActivity & { projectId: string; projectName: string }> = [];

    while (result.length < limit && projectIterators.length > 0) {
      // Find the iterator with the most recent activity
      let maxTimestamp = 0;
      let maxIteratorIndex = -1;

      for (let i = 0; i < projectIterators.length; i++) {
        const iterator = projectIterators[i];
        if (iterator.index < iterator.activities.length) {
          const activity = iterator.activities[iterator.index];
          const timestamp = new Date(activity.timestamp).getTime();

          if (timestamp > maxTimestamp) {
            maxTimestamp = timestamp;
            maxIteratorIndex = i;
          }
        }
      }

      // If we found an activity, add it to results
      if (maxIteratorIndex >= 0) {
        const iterator = projectIterators[maxIteratorIndex];
        const activity = iterator.activities[iterator.index];

        result.push({
          ...activity,
          projectId: iterator.projectId,
          projectName: iterator.projectName
        });

        // Move iterator forward
        iterator.index++;

        // Remove iterator if exhausted
        if (iterator.index >= iterator.activities.length) {
          projectIterators.splice(maxIteratorIndex, 1);
        }
      } else {
        // No more activities
        break;
      }
    }

    return result;
  }

  /**
   * Clean up stale agents (remove disconnected agents older than retention period)
   */
  private cleanupStaleAgents(): void {
    const now = Date.now();
    const disconnectedRetentionMs = 60 * 60 * 1000; // Keep disconnected for 1 hour

    for (const [agentId, agent] of this.agents.entries()) {
      const lastActivityTime = new Date(agent.lastActivity).getTime();
      const inactiveDuration = now - lastActivityTime;

      // Remove agents that have been disconnected for too long
      if (agent.status === 'disconnected' && inactiveDuration > disconnectedRetentionMs) {
        this.agents.delete(agentId);
        this.agentToProject.delete(agentId);
        continue;
      }

      // Mark idle agents as disconnected if inactive for 30+ minutes
      if (inactiveDuration > this.agentDisconnectTimeoutMs) {
        agent.status = 'disconnected';
        this.agents.set(agentId, agent);
      }
      // Mark active agents as idle if inactive for 5+ minutes
      else if (agent.status === 'active' && inactiveDuration > this.agentIdleTimeoutMs) {
        agent.status = 'idle';
        this.agents.set(agentId, agent);
      }
    }
  }

  /**
   * Get all agents (automatically cleans up stale entries)
   */
  getAgents(): AgentInfo[] {
    this.cleanupStaleAgents();
    return Array.from(this.agents.values())
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
  }

  /**
   * Get agents working in a specific project
   */
  getProjectAgents(projectId: string): AgentInfo[] {
    const agents: AgentInfo[] = [];

    for (const [agentId, currentProjectId] of this.agentToProject.entries()) {
      if (currentProjectId === projectId) {
        const agent = this.agents.get(agentId);
        if (agent) {
          agents.push(agent);
        }
      }
    }

    return agents.sort((a, b) =>
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get overall metrics summary
   */
  getMetrics(): MetricsSummary {
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);

    let totalTokens = 0;
    let totalCost = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    let requestCount = 0;
    let errorCount = 0;

    let tokens24h = 0;
    let cost24h = 0;
    let requests24h = 0;
    let errors24h = 0;

    // Aggregate from all project activities
    for (const activities of this.activityLog.values()) {
      for (const activity of activities) {
        const activityTime = new Date(activity.timestamp).getTime();
        const isRecent = activityTime > last24h;

        requestCount++;
        if (isRecent) requests24h++;

        if (activity.tokensUsed) {
          totalTokens += activity.tokensUsed;
          if (isRecent) tokens24h += activity.tokensUsed;
        }

        if (activity.estimatedCost) {
          totalCost += activity.estimatedCost;
          if (isRecent) cost24h += activity.estimatedCost;
        }

        if (activity.latencyMs) {
          totalLatency += activity.latencyMs;
          latencyCount++;
        }

        if (activity.outcome === 'failure') {
          errorCount++;
          if (isRecent) errors24h++;
        }
      }
    }

    return {
      totalTokens,
      totalCost,
      avgLatency: latencyCount > 0 ? totalLatency / latencyCount : 0,
      errorRate: requestCount > 0 ? errorCount / requestCount : 0,
      requestCount,
      last24h: {
        tokens: tokens24h,
        cost: cost24h,
        requests: requests24h,
        errors: errors24h
      }
    };
  }

  /**
   * Get metrics for a specific project
   */
  getProjectMetrics(projectId: string): MetricsSummary {
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);

    let totalTokens = 0;
    let totalCost = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    let requestCount = 0;
    let errorCount = 0;

    let tokens24h = 0;
    let cost24h = 0;
    let requests24h = 0;
    let errors24h = 0;

    const activities = this.activityLog.get(projectId) || [];

    for (const activity of activities) {
      const activityTime = new Date(activity.timestamp).getTime();
      const isRecent = activityTime > last24h;

      requestCount++;
      if (isRecent) requests24h++;

      if (activity.tokensUsed) {
        totalTokens += activity.tokensUsed;
        if (isRecent) tokens24h += activity.tokensUsed;
      }

      if (activity.estimatedCost) {
        totalCost += activity.estimatedCost;
        if (isRecent) cost24h += activity.estimatedCost;
      }

      if (activity.latencyMs) {
        totalLatency += activity.latencyMs;
        latencyCount++;
      }

      if (activity.outcome === 'failure') {
        errorCount++;
        if (isRecent) errors24h++;
      }
    }

    return {
      totalTokens,
      totalCost,
      avgLatency: latencyCount > 0 ? totalLatency / latencyCount : 0,
      errorRate: requestCount > 0 ? errorCount / requestCount : 0,
      requestCount,
      last24h: {
        tokens: tokens24h,
        cost: cost24h,
        requests: requests24h,
        errors: errors24h
      }
    };
  }

  /**
   * Mark agent as disconnected
   */
  markAgentDisconnected(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = 'disconnected';
      this.agents.set(agentId, agent);
    }

    // Remove from project mapping
    this.agentToProject.delete(agentId);

    // Update project active agent count
    for (const project of this.projects.values()) {
      project.activeAgents = this.getProjectAgents(project.id).filter(a => a.status === 'active').length;
    }
  }

  /**
   * Clean up old data
   */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.activityRetentionMs;

    // Clean up old activities
    for (const [projectId, activities] of this.activityLog.entries()) {
      const filtered = activities.filter(a =>
        new Date(a.timestamp).getTime() > cutoff
      );
      this.activityLog.set(projectId, filtered);
    }

    // Mark idle agents as disconnected
    const idleThreshold = 5 * 60 * 1000; // 5 minutes
    for (const agent of this.agents.values()) {
      const lastActivity = new Date(agent.lastActivity).getTime();
      if (now - lastActivity > idleThreshold && agent.status === 'active') {
        agent.status = 'idle';
      }
    }
  }

  /**
   * Get project ID from path
   */
  private getProjectId(projectPath: string): string {
    // Use basename as ID, or full path hash if needed
    const normalized = path.resolve(projectPath);
    return path.basename(normalized) + '-' + this.hashString(normalized);
  }

  /**
   * Create project info from path
   */
  private async createProjectInfo(projectPath: string): Promise<ProjectInfo> {
    const projectId = this.getProjectId(projectPath);
    const name = path.basename(projectPath);

    const info: ProjectInfo = {
      id: projectId,
      name,
      path: projectPath,
      type: 'directory',
      activeAgents: 0,
      totalActions: 0,
      stats: {
        totalEvents: 0,
        successRate: 0,
        avgRiskScore: 0,
        topCategories: []
      }
    };

    // Check if it's a git repo and get git info
    try {
      const gitDir = path.join(projectPath, '.git');
      if (fs.existsSync(gitDir)) {
        info.type = 'git';
        await this.updateGitInfo(info, projectPath);
      }
    } catch (err) {
      // Not a git repo or error reading git info
    }

    return info;
  }

  /**
   * Update git information for a project with proper error handling
   */
  private async updateGitInfo(project: ProjectInfo, projectPath: string): Promise<void> {
    const timeout = 5000; // 5 second timeout for git commands

    try {
      // Get branch
      try {
        const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', {
          cwd: projectPath,
          timeout
        });
        if (branch && branch.trim()) {
          project.gitBranch = branch.trim();
        }
      } catch (branchErr) {
        console.warn(`[ProjectTracker] Failed to get git branch for ${projectPath}:`, (branchErr as Error).message);
      }

      // Get remote URL
      try {
        const { stdout: remote } = await execAsync('git remote get-url origin', {
          cwd: projectPath,
          timeout
        });
        if (remote && remote.trim()) {
          project.gitRemote = remote.trim();

          // Extract repo name from remote URL
          const match = remote.trim().match(/([^/]+\/[^/]+?)(\.git)?$/);
          if (match) {
            project.gitRepo = match[1].replace('.git', '');
          }
        }
      } catch (remoteErr: any) {
        // Remote might not exist (not pushed yet) - this is normal, don't log
        if (remoteErr.code !== 128) { // Git error code 128 = no remote
          console.warn(`[ProjectTracker] Failed to get git remote for ${projectPath}:`, remoteErr.message);
        }
      }

      // Get latest commit
      try {
        const { stdout: commit } = await execAsync('git rev-parse --short HEAD', {
          cwd: projectPath,
          timeout
        });
        if (commit && commit.trim()) {
          project.gitCommit = commit.trim();
        }
      } catch (commitErr) {
        console.warn(`[ProjectTracker] Failed to get git commit for ${projectPath}:`, (commitErr as Error).message);
      }
    } catch (err) {
      // Overall git failure - log for debugging
      console.error(`[ProjectTracker] Git info update failed for ${projectPath}:`, err);
    }
  }

  /**
   * Update project statistics
   */
  private updateProjectStats(projectId: string): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    const activities = this.activityLog.get(projectId) || [];

    project.stats.totalEvents = activities.length;
    project.totalActions = activities.length;

    if (activities.length > 0) {
      // Last activity
      project.lastActivity = activities[0].timestamp;

      // Success rate
      const successes = activities.filter(a => a.outcome === 'success').length;
      project.stats.successRate = successes / activities.length;

      // Average risk score
      const withRisk = activities.filter(a => a.riskScore !== undefined);
      if (withRisk.length > 0) {
        const totalRisk = withRisk.reduce((sum, a) => sum + (a.riskScore || 0), 0);
        project.stats.avgRiskScore = totalRisk / withRisk.length;
      }

      // Top categories
      const categoryCounts = new Map<string, number>();
      for (const activity of activities) {
        const count = categoryCounts.get(activity.category) || 0;
        categoryCounts.set(activity.category, count + 1);
      }

      project.stats.topCategories = Array.from(categoryCounts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    }

    // Update active agents count
    project.activeAgents = this.getProjectAgents(projectId).filter(a => a.status === 'active').length;
  }

  /**
   * Update agent information
   */
  private updateAgentInfo(agentId: string, sessionId: string, projectPath: string): void {
    const projectId = this.getProjectId(projectPath);

    let agent = this.agents.get(agentId);

    if (!agent) {
      agent = {
        agentId,
        sessionId,
        currentProject: projectId,
        startTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        actionsCount: 1,
        status: 'active'
      };
    } else {
      agent.currentProject = projectId;
      agent.lastActivity = new Date().toISOString();
      agent.actionsCount++;
      agent.status = 'active';
    }

    this.agents.set(agentId, agent);
  }

  /**
   * Simple string hash for generating IDs
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }
}

export const projectTracker = new ProjectTracker();

// Cleanup old data every hour
setInterval(() => {
  projectTracker.cleanup();
}, 60 * 60 * 1000).unref();
