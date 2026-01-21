# Architecture Change Detection Specification

## Purpose
Detect when the ManagerProtocol architecture has changed and the CLAUDE.md system prompt needs updating.

## Core Concept
Agents should be able to call an MCP tool that:
1. Scans the current project architecture
2. Compares it to what's documented in CLAUDE.md
3. Returns a list of changes that need documentation updates
4. Optionally auto-generates updated documentation

## New MCP Tools

### 1. `detect_architecture_changes`

**Purpose**: Analyze project and detect architecture changes

**Parameters**:
```typescript
{
  projectPath: string;           // Path to project (default: cwd)
  claudeMdPath?: string;         // Path to CLAUDE.md (default: ~/.claude/CLAUDE.md)
  autoGenerate?: boolean;        // Generate updated docs (default: false)
}
```

**Returns**:
```typescript
{
  needsUpdate: boolean;
  changeCount: number;
  changes: Array<{
    type: 'new_component' | 'removed_component' | 'modified_structure' |
          'new_endpoint' | 'new_integration' | 'missing_documentation';
    component: string;
    path?: string;
    description: string;
    suggestedUpdate: string;    // Markdown to add/update
    priority: 'high' | 'medium' | 'low';
  }>;
  currentArchitecture: ProjectArchitecture;
  documentedSections: string[]; // What's currently in CLAUDE.md
}
```

### 2. `generate_architecture_docs`

**Purpose**: Auto-generate architecture documentation for CLAUDE.md

**Parameters**:
```typescript
{
  projectPath: string;
  format?: 'markdown' | 'json';
  sections?: string[];          // Which sections to generate
}
```

**Returns**:
```typescript
{
  markdown: string;             // Ready-to-insert markdown
  sections: {
    overview: string;
    components: string;
    apiEndpoints: string;
    integrations: string;
    dataFlow: string;
  };
}
```

### 3. `update_system_prompt`

**Purpose**: Update CLAUDE.md with architecture changes

**Parameters**:
```typescript
{
  changes: ArchitectureChange[];
  mode: 'append' | 'replace' | 'merge';
  createBackup?: boolean;
}
```

**Returns**:
```typescript
{
  updated: boolean;
  backupPath?: string;
  sectionsUpdated: string[];
}
```

## Project Architecture Scanning

### What to Detect

1. **Core Components**
   - Directories in `src/`
   - Main modules (engine, rules, analyzers, supervisor, dashboard, etc.)
   - Their responsibilities

2. **API Endpoints**
   - HTTP endpoints (from httpDashboard.ts, server.ts)
   - MCP tools (from AgentSupervisor.ts)
   - CLI commands (from cli.ts)

3. **Data Stores**
   - SQLite databases
   - File-based stores
   - In-memory caches

4. **External Integrations**
   - GitHub API (for approvals, tasks)
   - Playwright MCP server
   - Other MCP servers

5. **Rules & Policies**
   - Rule categories (security, compliance, operational, etc.)
   - Project profiles (flask, dotnet-azure, etc.)
   - Rule presets

6. **Services**
   - Task management
   - App monitoring
   - Audit logging
   - Rate limiting

### Scanning Algorithm

```typescript
async function scanProjectArchitecture(projectPath: string): Promise<ProjectArchitecture> {
  return {
    name: detectProjectName(projectPath),
    type: detectProjectType(projectPath), // 'mcp-server', 'web-app', etc.

    components: await scanComponents(projectPath),
    // {
    //   engine: { path: 'src/engine', files: [...], purpose: '...' },
    //   rules: { path: 'src/rules', files: [...], purpose: '...' },
    //   ...
    // }

    apiEndpoints: await scanEndpoints(projectPath),
    // [
    //   { method: 'POST', path: '/api/tasks', handler: '...' },
    //   { tool: 'create_task', handler: 'AgentSupervisor.createTask' },
    //   ...
    // ]

    mcpTools: await scanMCPTools(projectPath),
    // [
    //   { name: 'evaluate_action', category: 'governance', ... },
    //   { name: 'create_task', category: 'tasks', ... },
    //   ...
    // ]

    dataStores: await scanDataStores(projectPath),
    integrations: await scanIntegrations(projectPath),
    services: await scanServices(projectPath),
  };
}
```

### Comparison Algorithm

```typescript
function compareArchitectures(current: ProjectArchitecture, documented: ParsedClaudeMd): ArchitectureChange[] {
  const changes: ArchitectureChange[] = [];

  // Check for new components
  for (const [name, component] of Object.entries(current.components)) {
    if (!documented.sections.includes(`## ${name}`)) {
      changes.push({
        type: 'new_component',
        component: name,
        path: component.path,
        description: `New component '${name}' detected at ${component.path}`,
        suggestedUpdate: generateComponentDocs(name, component),
        priority: 'high'
      });
    }
  }

  // Check for new MCP tools
  for (const tool of current.mcpTools) {
    if (!documentedToolsInclude(documented, tool.name)) {
      changes.push({
        type: 'new_integration',
        component: tool.name,
        description: `New MCP tool '${tool.name}' not documented`,
        suggestedUpdate: generateToolDocs(tool),
        priority: 'medium'
      });
    }
  }

  // Check for removed components
  for (const section of documented.componentSections) {
    if (!current.components[section]) {
      changes.push({
        type: 'removed_component',
        component: section,
        description: `Component '${section}' documented but no longer exists`,
        suggestedUpdate: `Remove or archive documentation for ${section}`,
        priority: 'medium'
      });
    }
  }

  return changes;
}
```

## CLAUDE.md Structure Requirements

To enable automated updates, CLAUDE.md should have:

1. **Section Markers**
   ```markdown
   ## ManagerProtocol Architecture
   <!-- AUTO-GENERATED: DO NOT EDIT MANUALLY -->
   <!-- LAST UPDATED: 2026-01-10 -->

   ... content ...

   <!-- END AUTO-GENERATED -->
   ```

2. **Consistent Headings**
   - Use `## ` for major sections
   - Use `### ` for subsections
   - Use specific keywords for detection

3. **Metadata**
   - Project version
   - Last scan date
   - Components list

## Integration with Supervisor

The supervisor should:

1. **On Session Start**: Check if architecture docs are stale
   - If last scan > 7 days, trigger scan
   - If changes detected, notify agent

2. **After Significant Changes**: Detect when to rescan
   - After approved tasks are completed
   - After new files added to src/
   - After package.json changes

3. **Notification to Agent**:
   ```typescript
   {
     type: 'architecture_change_detected',
     message: 'Architecture changes detected. Run detect_architecture_changes to update CLAUDE.md',
     changeCount: 5,
     priority: 'medium'
   }
   ```

## Usage Example

### Agent Workflow

```javascript
// 1. At start of session, check for changes
const changes = await detect_architecture_changes({
  projectPath: '/path/to/your-project'
});

if (changes.needsUpdate) {
  console.log(`⚠️  System prompt needs updating: ${changes.changeCount} changes detected`);

  // 2. Generate updated docs
  const docs = await generate_architecture_docs({
    projectPath: '/path/to/your-project',
    sections: ['components', 'apiEndpoints', 'mcpTools']
  });

  // 3. Update CLAUDE.md
  await update_system_prompt({
    changes: changes.changes,
    mode: 'merge',
    createBackup: true
  });

  console.log('✅ System prompt updated');
}
```

### Automated Detection

The supervisor can run this periodically:

```typescript
// In supervisor's session initialization
if (config.autoDetectArchitectureChanges) {
  const lastScan = getLastArchitectureScan(projectPath);
  const daysSinceLastScan = (Date.now() - lastScan) / (1000 * 60 * 60 * 24);

  if (daysSinceLastScan > 7) {
    const changes = await detectArchitectureChanges(projectPath);

    if (changes.needsUpdate) {
      // Create a task for updating CLAUDE.md
      await createTask({
        title: 'Update CLAUDE.md with architecture changes',
        description: `Detected ${changes.changeCount} architecture changes:\n\n` +
          changes.changes.map(c => `- ${c.description}`).join('\n'),
        labels: ['documentation', 'architecture'],
        priority: 'medium'
      });
    }
  }
}
```

## Implementation Priority

1. **Phase 1** (Immediate):
   - Basic architecture scanning
   - Component detection
   - Simple change detection

2. **Phase 2** (Next):
   - MCP tool scanning
   - API endpoint detection
   - Documentation generation

3. **Phase 3** (Future):
   - Auto-update CLAUDE.md
   - Smart merging of changes
   - Version tracking

## Benefits

1. **Always Current**: System prompt stays up-to-date automatically
2. **Agent Awareness**: Agents know when to update documentation
3. **Reduced Manual Work**: No need to manually track architecture changes
4. **Consistency**: Standard format for architecture documentation
5. **Audit Trail**: Track when and why docs were updated
