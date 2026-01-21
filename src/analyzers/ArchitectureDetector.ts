/**
 * Architecture Change Detector
 *
 * Detects when agent actions represent architectural changes that should
 * be documented in the project's CLAUDE.md file.
 */

import type { AgentAction, BusinessContext } from '../types/index.js';
import path from 'path';

export interface ClaudeMdUpdate {
  needed: boolean;
  reason: string;
  suggestedContent: string;
  section: string;
}

export class ArchitectureDetector {
  /**
   * Detect if an action represents an architectural change
   */
  static detectChanges(
    action: AgentAction,
    _context?: BusinessContext
  ): ClaudeMdUpdate | null {
    // Only process file-related actions
    if (!this.isFileAction(action)) {
      return null;
    }

    const filePath = this.extractFilePath(action);
    if (!filePath) {
      return null;
    }

    // Skip non-architectural files
    if (this.shouldSkipFile(filePath)) {
      return null;
    }

    // Detect the type of architectural change
    const componentType = this.detectComponentType(filePath);
    if (!componentType) {
      return null;
    }

    // Generate documentation suggestion
    return this.generateDocumentation(filePath, componentType, action);
  }

  /**
   * Check if action is file-related
   */
  private static isFileAction(action: AgentAction): boolean {
    const fileActions = [
      'write_file',
      'create_file',
      'edit_file',
      'modify_file',
      'file_system'
    ];

    return (
      fileActions.some(a => action.name.toLowerCase().includes(a)) ||
      action.category === 'file_system'
    );
  }

  /**
   * Extract file path from action parameters
   */
  private static extractFilePath(action: AgentAction): string | null {
    const params = action.parameters || {};

    // Try common parameter names
    const pathKeys = ['filePath', 'file_path', 'path', 'file', 'target'];
    for (const key of pathKeys) {
      if (params[key] && typeof params[key] === 'string') {
        return params[key] as string;
      }
    }

    return null;
  }

  /**
   * Check if file should be skipped (not architectural)
   */
  private static shouldSkipFile(filePath: string): boolean {
    const skipPatterns = [
      /\.test\.(ts|js|py)$/,           // Test files
      /\.spec\.(ts|js|py)$/,           // Spec files
      /\.md$/,                          // Documentation (except CLAUDE.md)
      /node_modules\//,                 // Dependencies
      /\.git\//,                        // Git files
      /dist\//,                         // Build output
      /build\//,                        // Build output
      /\.env/,                          // Environment files
      /package-lock\.json$/,            // Lock files
      /yarn\.lock$/,                    // Lock files
      /\.gitignore$/,                   // Config files
      /\.eslintrc/,                     // Config files
      /tsconfig\.json$/,                // Config files
      /\.prettierrc/,                   // Config files
      /README\.md$/,                    // READMEs
      /LICENSE$/,                       // License files
      /\.(png|jpg|jpeg|gif|svg|ico)$/  // Images
    ];

    return skipPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Detect the type of component being added/modified
   */
  private static detectComponentType(filePath: string): string | null {
    const normalized = filePath.toLowerCase();

    // Check directory structure
    if (normalized.includes('/src/services/') || normalized.includes('/services/')) {
      return 'service';
    }
    if (normalized.includes('/src/components/') || normalized.includes('/components/')) {
      return 'component';
    }
    if (normalized.includes('/src/api/') || normalized.includes('/api/') ||
        normalized.includes('/routes/') || normalized.includes('/blueprints/')) {
      return 'api';
    }
    if (normalized.includes('/src/models/') || normalized.includes('/models/') ||
        normalized.includes('/schemas/')) {
      return 'model';
    }
    if (normalized.includes('/src/utils/') || normalized.includes('/utils/') ||
        normalized.includes('/helpers/')) {
      return 'utility';
    }
    if (normalized.includes('/src/middleware/') || normalized.includes('/middleware/')) {
      return 'middleware';
    }
    if (normalized.includes('/src/config/') || normalized.includes('/config/')) {
      return 'configuration';
    }
    if (normalized.includes('/src/integrations/') || normalized.includes('/integrations/')) {
      return 'integration';
    }
    if (normalized.includes('/src/engine/') || normalized.includes('/engine/')) {
      return 'engine';
    }
    if (normalized.includes('/src/analyzers/') || normalized.includes('/analyzers/')) {
      return 'analyzer';
    }
    if (normalized.includes('/src/dashboard/') || normalized.includes('/dashboard/')) {
      return 'dashboard';
    }

    // Check for package.json (dependency change)
    if (normalized.endsWith('package.json')) {
      return 'dependency';
    }

    // Check for specific file patterns
    if (normalized.endsWith('server.ts') || normalized.endsWith('server.js') ||
        normalized.endsWith('app.ts') || normalized.endsWith('app.js')) {
      return 'main';
    }

    return null;
  }

  /**
   * Generate documentation suggestion
   */
  private static generateDocumentation(
    filePath: string,
    componentType: string,
    _action: AgentAction
  ): ClaudeMdUpdate {
    const fileName = path.basename(filePath, path.extname(filePath));
    const componentName = this.formatComponentName(fileName);

    const templates: Record<string, { section: string; template: (_name: string) => string }> = {
      service: {
        section: 'Services',
        template: (name) => `### ${name}\n\nBrief description of what this service does.\n\n**Purpose**: Core functionality provided by this service\n\n**Key Features**:\n- Feature 1\n- Feature 2\n\n**Dependencies**: List any external services or APIs used`
      },
      component: {
        section: 'Components',
        template: (name) => `### ${name}\n\nDescription of this component's role.\n\n**Props/Interface**:\n- Prop 1: Description\n- Prop 2: Description\n\n**Usage Example**:\n\`\`\`typescript\n// Usage example here\n\`\`\``
      },
      api: {
        section: 'API Endpoints',
        template: (name) => `### ${name} Endpoints\n\n**Routes**:\n- \`GET /api/${name.toLowerCase()}\` - Description\n- \`POST /api/${name.toLowerCase()}\` - Description\n\n**Authentication**: Required/Optional\n\n**Request/Response Format**:\n\`\`\`json\n{\n  "example": "data"\n}\n\`\`\``
      },
      model: {
        section: 'Data Models',
        template: (name) => `### ${name}\n\n**Schema**:\n\`\`\`typescript\ninterface ${name} {\n  // Define schema here\n}\n\`\`\`\n\n**Relationships**: Related models or tables\n\n**Validation**: Key validation rules`
      },
      utility: {
        section: 'Utilities',
        template: (name) => `### ${name}\n\n**Purpose**: What this utility provides\n\n**Key Functions**:\n- \`function1()\` - Description\n- \`function2()\` - Description\n\n**Usage**: Common use cases`
      },
      middleware: {
        section: 'Middleware',
        template: (name) => `### ${name}\n\n**Purpose**: What this middleware does\n\n**Applied To**: Which routes/endpoints\n\n**Configuration**: Any configuration options`
      },
      integration: {
        section: 'Integrations',
        template: (name) => `### ${name}\n\n**External Service**: Name and purpose\n\n**API Version**: Version of external API\n\n**Configuration**:\n- API Key: How to configure\n- Endpoints: List of used endpoints\n\n**Error Handling**: How failures are handled`
      },
      engine: {
        section: 'Core Engine',
        template: (name) => `### ${name}\n\n**Purpose**: Core engine component responsibility\n\n**Key Methods**:\n- Method 1: Description\n- Method 2: Description\n\n**Integration**: How it integrates with other components`
      },
      analyzer: {
        section: 'Analyzers',
        template: (name) => `### ${name}\n\n**Analyzes**: What this analyzer evaluates\n\n**Returns**: Analysis result format\n\n**Usage**: When and how to use this analyzer`
      },
      dashboard: {
        section: 'Dashboard',
        template: (name) => `### ${name}\n\n**Feature**: Dashboard feature provided\n\n**API Endpoints**: Related endpoints\n\n**UI Components**: User interface elements`
      },
      dependency: {
        section: 'Dependencies',
        template: () => `### New Dependency Added\n\nA new dependency was added to package.json.\n\n**Review Required**: Check package.json for the new dependency and document its purpose here.`
      },
      main: {
        section: 'Core Application',
        template: (name) => `### ${name}\n\n**Purpose**: Main application entry point changes\n\n**Configuration**: New configuration options\n\n**Startup**: Changes to startup sequence`
      }
    };

    const template = templates[componentType] || templates.utility;
    const suggestedContent = template.template(componentName);

    return {
      needed: true,
      reason: `New ${componentType} detected at ${filePath}`,
      suggestedContent,
      section: template.section
    };
  }

  /**
   * Format component name for documentation
   */
  private static formatComponentName(fileName: string): string {
    // Convert PascalCase/camelCase to Title Case
    return fileName
      .replace(/([A-Z])/g, ' $1')  // Add space before capitals
      .replace(/[-_]/g, ' ')        // Replace dashes and underscores with spaces
      .trim()                        // Remove leading/trailing spaces
      .split(' ')                    // Split into words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
