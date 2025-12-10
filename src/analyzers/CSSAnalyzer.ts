/**
 * Enterprise Agent Supervisor - CSS Analyzer
 *
 * Analyzes CSS rules for optimization, deduplication, and best practices.
 */

export interface CSSRule {
  selector: string;
  properties: Record<string, string>;
  source: 'inline' | 'style_tag' | 'external' | 'unknown';
  file?: string;
  line?: number;
  specificity?: number;
}

export interface CSSAnalysisContext {
  newRule: CSSRule;
  existingRules?: CSSRule[];
  projectType?: 'spa' | 'mpa' | 'component_library' | 'website';
  framework?: 'react' | 'vue' | 'angular' | 'svelte' | 'vanilla' | 'other';
  hasStyleSystem?: boolean; // e.g., Tailwind, styled-components
  styleSystemName?: string;
  globalStylesFile?: string;
  componentName?: string;
}

export interface CSSSuggestion {
  type: 'use_existing' | 'make_global' | 'externalize' | 'remove_unused' | 'consolidate' | 'use_variable' | 'use_utility' | 'specificity_warning' | 'naming_convention';
  severity: 'error' | 'warning' | 'info' | 'suggestion';
  message: string;
  details?: string;
  existingRule?: CSSRule;
  suggestedAction?: string;
  codeExample?: string;
}

export interface CSSAnalysisResult {
  ruleId: string;
  newRule: CSSRule;
  shouldExternalize: boolean;
  shouldMakeGlobal: boolean;
  duplicates: CSSRule[];
  suggestions: CSSSuggestion[];
  removableCandidates: CSSRule[];
  riskScore: number;
  summary: string;
}

/**
 * Common CSS property patterns that should be variables
 */
const VARIABLE_CANDIDATES = [
  { pattern: /^#[0-9a-fA-F]{3,8}$/, type: 'color', varPrefix: '--color-' },
  { pattern: /^rgb\(|^rgba\(|^hsl\(|^hsla\(/, type: 'color', varPrefix: '--color-' },
  { pattern: /^\d+px$/, type: 'spacing', varPrefix: '--spacing-', minValue: 8 },
  { pattern: /^\d+rem$/, type: 'spacing', varPrefix: '--spacing-' },
  { pattern: /^(\d+(\.\d+)?)(px|rem|em)$/, type: 'font-size', varPrefix: '--font-size-' },
  { pattern: /^\d{3}$/, type: 'font-weight', varPrefix: '--font-weight-' },
  { pattern: /^(\d+(\.\d+)?)(s|ms)$/, type: 'duration', varPrefix: '--duration-' },
  { pattern: /^cubic-bezier\(/, type: 'easing', varPrefix: '--easing-' }
];

/**
 * Properties that commonly indicate global/reusable styles
 */
const GLOBAL_PROPERTY_INDICATORS = [
  'font-family',
  'color',
  'background-color',
  'border-radius',
  'box-shadow',
  'transition',
  'animation'
];

/**
 * Utility class patterns (Tailwind-like)
 */
const UTILITY_PATTERNS: Record<string, RegExp> = {
  margin: /^m[trblxy]?-/,
  padding: /^p[trblxy]?-/,
  display: /^(flex|grid|block|inline|hidden)$/,
  position: /^(relative|absolute|fixed|sticky)$/,
  width: /^w-/,
  height: /^h-/,
  text: /^text-/,
  font: /^font-/,
  bg: /^bg-/,
  border: /^border-/,
  rounded: /^rounded-/,
  shadow: /^shadow-/,
  gap: /^gap-/
};

export class CSSAnalyzer {
  private knownUtilityClasses: Set<string> = new Set();
  private globalPatterns: CSSRule[] = [];

  constructor() {
    this.initializeKnownPatterns();
  }

  /**
   * Main analysis entry point
   */
  analyze(context: CSSAnalysisContext): CSSAnalysisResult {
    const ruleId = this.generateRuleId(context.newRule);
    const suggestions: CSSSuggestion[] = [];
    const duplicates: CSSRule[] = [];
    const removableCandidates: CSSRule[] = [];
    let riskScore = 0;

    // 1. Check for duplicates/similar rules
    const duplicateCheck = this.findDuplicates(context.newRule, context.existingRules || []);
    duplicates.push(...duplicateCheck.duplicates);
    suggestions.push(...duplicateCheck.suggestions);
    riskScore += duplicateCheck.duplicates.length * 10;

    // 2. Check if should be externalized
    const externalizeCheck = this.checkExternalization(context);
    suggestions.push(...externalizeCheck.suggestions);
    if (externalizeCheck.shouldExternalize) riskScore += 15;

    // 3. Check if should be global
    const globalCheck = this.checkGlobalCandidate(context);
    suggestions.push(...globalCheck.suggestions);
    if (globalCheck.shouldMakeGlobal) riskScore += 10;

    // 4. Check for variable candidates
    const variableCheck = this.checkVariableCandidates(context.newRule);
    suggestions.push(...variableCheck.suggestions);
    riskScore += variableCheck.suggestions.length * 5;

    // 5. Check for utility class opportunities
    if (context.hasStyleSystem) {
      const utilityCheck = this.checkUtilityOpportunities(context);
      suggestions.push(...utilityCheck.suggestions);
    }

    // 6. Check specificity issues
    const specificityCheck = this.checkSpecificity(context.newRule);
    suggestions.push(...specificityCheck.suggestions);
    riskScore += specificityCheck.riskContribution;

    // 7. Check naming conventions
    const namingCheck = this.checkNamingConvention(context.newRule, context.framework);
    suggestions.push(...namingCheck.suggestions);

    // 8. Find removable candidates
    if (context.existingRules) {
      removableCandidates.push(...this.findRemovableCandidates(context.newRule, context.existingRules));
    }

    // Generate summary
    const summary = this.generateSummary(
      context.newRule,
      suggestions,
      duplicates,
      externalizeCheck.shouldExternalize,
      globalCheck.shouldMakeGlobal
    );

    return {
      ruleId,
      newRule: context.newRule,
      shouldExternalize: externalizeCheck.shouldExternalize,
      shouldMakeGlobal: globalCheck.shouldMakeGlobal,
      duplicates,
      suggestions: this.prioritizeSuggestions(suggestions),
      removableCandidates,
      riskScore: Math.min(100, riskScore),
      summary
    };
  }

  /**
   * Find duplicate or similar CSS rules
   */
  private findDuplicates(newRule: CSSRule, existingRules: CSSRule[]): {
    duplicates: CSSRule[];
    suggestions: CSSSuggestion[];
  } {
    const duplicates: CSSRule[] = [];
    const suggestions: CSSSuggestion[] = [];

    for (const existing of existingRules) {
      // Exact property match
      const similarity = this.calculateSimilarity(newRule.properties, existing.properties);

      if (similarity === 1) {
        duplicates.push(existing);
        suggestions.push({
          type: 'use_existing',
          severity: 'error',
          message: `Identical CSS properties already exist in "${existing.selector}"`,
          details: `Found at ${existing.source}${existing.file ? `: ${existing.file}` : ''}${existing.line ? `:${existing.line}` : ''}`,
          existingRule: existing,
          suggestedAction: `Use existing class "${existing.selector}" instead of creating new rule`,
          codeExample: `class="${existing.selector.replace('.', '')}"`
        });
      } else if (similarity >= 0.7) {
        suggestions.push({
          type: 'consolidate',
          severity: 'warning',
          message: `Similar CSS properties (${Math.round(similarity * 100)}% match) found in "${existing.selector}"`,
          details: 'Consider consolidating these rules to reduce CSS bundle size',
          existingRule: existing,
          suggestedAction: 'Extend the existing rule or create a shared base class'
        });
      }

      // Check for same selector different properties
      if (existing.selector === newRule.selector && similarity < 1) {
        suggestions.push({
          type: 'consolidate',
          severity: 'warning',
          message: `Selector "${newRule.selector}" already exists with different properties`,
          details: 'Multiple rules with same selector can cause specificity conflicts',
          existingRule: existing,
          suggestedAction: 'Merge properties into single rule or use more specific selectors'
        });
      }
    }

    return { duplicates, suggestions };
  }

  /**
   * Check if CSS should be externalized
   */
  private checkExternalization(context: CSSAnalysisContext): {
    shouldExternalize: boolean;
    suggestions: CSSSuggestion[];
  } {
    const suggestions: CSSSuggestion[] = [];
    let shouldExternalize = false;

    // Inline styles should almost always be externalized
    if (context.newRule.source === 'inline') {
      shouldExternalize = true;
      suggestions.push({
        type: 'externalize',
        severity: 'warning',
        message: 'Inline styles should be moved to external stylesheet',
        details: 'Inline styles hurt cacheability, increase HTML size, and make maintenance difficult',
        suggestedAction: 'Create a class in your stylesheet and apply it to the element',
        codeExample: this.generateExternalizeExample(context.newRule, context.componentName)
      });
    }

    // Style tags with many rules should be external
    if (context.newRule.source === 'style_tag') {
      const propertyCount = Object.keys(context.newRule.properties).length;

      if (propertyCount > 5) {
        shouldExternalize = true;
        suggestions.push({
          type: 'externalize',
          severity: 'info',
          message: 'Complex style rules (>5 properties) benefit from external stylesheets',
          details: 'External stylesheets enable better caching, minification, and tooling support',
          suggestedAction: `Move to ${context.globalStylesFile || 'styles.css'}`
        });
      }

      // Reusable patterns should be external
      if (this.isReusablePattern(context.newRule)) {
        shouldExternalize = true;
        suggestions.push({
          type: 'externalize',
          severity: 'suggestion',
          message: 'This appears to be a reusable pattern',
          details: 'Reusable CSS patterns should be in external files for consistency',
          suggestedAction: 'Move to shared stylesheet or component library'
        });
      }
    }

    return { shouldExternalize, suggestions };
  }

  /**
   * Check if CSS should be made global
   */
  private checkGlobalCandidate(context: CSSAnalysisContext): {
    shouldMakeGlobal: boolean;
    suggestions: CSSSuggestion[];
  } {
    const suggestions: CSSSuggestion[] = [];
    let shouldMakeGlobal = false;

    const properties = Object.keys(context.newRule.properties);

    // Check for global property indicators
    const globalIndicators = properties.filter(p =>
      GLOBAL_PROPERTY_INDICATORS.includes(p)
    );

    if (globalIndicators.length >= 2) {
      shouldMakeGlobal = true;
      suggestions.push({
        type: 'make_global',
        severity: 'suggestion',
        message: `Rule contains commonly global properties: ${globalIndicators.join(', ')}`,
        details: 'These properties often indicate design system tokens that should be global',
        suggestedAction: 'Consider adding to global styles or design system'
      });
    }

    // Typography rules should typically be global
    if (this.isTypographyRule(context.newRule)) {
      shouldMakeGlobal = true;
      suggestions.push({
        type: 'make_global',
        severity: 'suggestion',
        message: 'Typography styles should be defined globally for consistency',
        details: 'Consistent typography improves design cohesion and accessibility',
        suggestedAction: 'Add to typography section in global styles'
      });
    }

    // Button-like patterns should be global
    if (this.isButtonPattern(context.newRule)) {
      shouldMakeGlobal = true;
      suggestions.push({
        type: 'make_global',
        severity: 'suggestion',
        message: 'Button/interactive styles should be global components',
        details: 'Consistent interactive elements improve UX and accessibility',
        suggestedAction: 'Create a reusable button component/class'
      });
    }

    return { shouldMakeGlobal, suggestions };
  }

  /**
   * Check for CSS variable candidates
   */
  private checkVariableCandidates(rule: CSSRule): {
    suggestions: CSSSuggestion[];
  } {
    const suggestions: CSSSuggestion[] = [];

    for (const [property, value] of Object.entries(rule.properties)) {
      for (const candidate of VARIABLE_CANDIDATES) {
        if (candidate.pattern.test(value)) {
          // Skip small values for spacing
          if (candidate.type === 'spacing' && candidate.minValue) {
            const numValue = parseInt(value);
            if (numValue < candidate.minValue) continue;
          }

          suggestions.push({
            type: 'use_variable',
            severity: 'info',
            message: `${property}: ${value} should use a CSS variable`,
            details: `${candidate.type} values should be defined as CSS custom properties for consistency`,
            suggestedAction: `Replace with var(${candidate.varPrefix}xxx)`,
            codeExample: `${property}: var(${candidate.varPrefix}primary);`
          });
          break;
        }
      }
    }

    return { suggestions };
  }

  /**
   * Check for utility class opportunities
   */
  private checkUtilityOpportunities(context: CSSAnalysisContext): {
    suggestions: CSSSuggestion[];
  } {
    const suggestions: CSSSuggestion[] = [];
    const properties = context.newRule.properties;

    // Common utility mappings
    const utilityMappings: Record<string, (value: string) => string | null> = {
      'display': (v) => v === 'flex' ? 'flex' : v === 'grid' ? 'grid' : v === 'none' ? 'hidden' : null,
      'flex-direction': (v) => v === 'column' ? 'flex-col' : v === 'row' ? 'flex-row' : null,
      'justify-content': (v) => `justify-${v.replace('flex-', '').replace('space-', '')}`,
      'align-items': (v) => `items-${v.replace('flex-', '')}`,
      'text-align': (v) => `text-${v}`,
      'font-weight': (v) => `font-${this.getFontWeightName(v)}`,
      'position': (v) => v,
      'overflow': (v) => `overflow-${v}`,
      'cursor': (v) => `cursor-${v}`
    };

    for (const [property, value] of Object.entries(properties)) {
      if (utilityMappings[property]) {
        const utilityClass = utilityMappings[property](value);
        if (utilityClass) {
          suggestions.push({
            type: 'use_utility',
            severity: 'suggestion',
            message: `"${property}: ${value}" can be replaced with utility class`,
            details: `Using ${context.styleSystemName || 'utility'} classes reduces custom CSS`,
            suggestedAction: `Use class="${utilityClass}" instead`,
            codeExample: `<div class="${utilityClass}">...</div>`
          });
        }
      }
    }

    return { suggestions };
  }

  /**
   * Check CSS specificity issues
   */
  private checkSpecificity(rule: CSSRule): {
    suggestions: CSSSuggestion[];
    riskContribution: number;
  } {
    const suggestions: CSSSuggestion[] = [];
    let riskContribution = 0;

    const specificity = this.calculateSpecificity(rule.selector);

    // ID selectors
    if (specificity.ids > 0) {
      suggestions.push({
        type: 'specificity_warning',
        severity: 'warning',
        message: 'Avoid ID selectors in CSS',
        details: 'ID selectors have high specificity making overrides difficult',
        suggestedAction: 'Use class selectors instead of IDs'
      });
      riskContribution += 15;
    }

    // Deeply nested selectors
    if (specificity.depth > 3) {
      suggestions.push({
        type: 'specificity_warning',
        severity: 'warning',
        message: `Deep selector nesting (${specificity.depth} levels)`,
        details: 'Deeply nested selectors are brittle and hard to override',
        suggestedAction: 'Use BEM or flat class naming instead'
      });
      riskContribution += 10;
    }

    // !important
    const hasImportant = Object.values(rule.properties).some(v =>
      v.includes('!important')
    );
    if (hasImportant) {
      suggestions.push({
        type: 'specificity_warning',
        severity: 'error',
        message: 'Avoid !important declarations',
        details: '!important creates specificity problems and indicates architecture issues',
        suggestedAction: 'Refactor CSS to avoid needing !important'
      });
      riskContribution += 25;
    }

    return { suggestions, riskContribution };
  }

  /**
   * Check naming convention
   */
  private checkNamingConvention(rule: CSSRule, framework?: string): {
    suggestions: CSSSuggestion[];
  } {
    const suggestions: CSSSuggestion[] = [];
    const selector = rule.selector;

    // Check for meaningful names
    if (/^\.[a-z]$/.test(selector) || /^\.(div|span|container)\d*$/.test(selector)) {
      suggestions.push({
        type: 'naming_convention',
        severity: 'warning',
        message: 'Use descriptive class names',
        details: 'Generic names like "div1" or single letters are hard to understand',
        suggestedAction: 'Use semantic names that describe purpose (e.g., .card-header)'
      });
    }

    // BEM recommendation for complex selectors
    if (selector.includes(' ') && !selector.includes('__') && !selector.includes('--')) {
      suggestions.push({
        type: 'naming_convention',
        severity: 'info',
        message: 'Consider using BEM naming convention',
        details: 'BEM (Block__Element--Modifier) creates clear relationships',
        suggestedAction: 'Rename using BEM: .block__element--modifier',
        codeExample: this.suggestBEMName(selector)
      });
    }

    // Framework-specific conventions
    if (framework === 'react' && selector.includes('_')) {
      suggestions.push({
        type: 'naming_convention',
        severity: 'info',
        message: 'React typically uses camelCase for CSS Modules',
        details: 'CSS Modules work better with camelCase class names',
        suggestedAction: 'Use camelCase: .cardHeader instead of .card_header'
      });
    }

    return { suggestions };
  }

  /**
   * Find CSS rules that can be safely removed
   */
  private findRemovableCandidates(newRule: CSSRule, existingRules: CSSRule[]): CSSRule[] {
    const removable: CSSRule[] = [];

    for (const existing of existingRules) {
      // If new rule completely overrides existing
      if (this.completelyOverrides(newRule, existing)) {
        removable.push(existing);
      }

      // Dead selectors (would need DOM analysis in real implementation)
      if (this.isLikelyUnused(existing)) {
        removable.push(existing);
      }
    }

    return removable;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private generateRuleId(rule: CSSRule): string {
    const hash = this.simpleHash(rule.selector + JSON.stringify(rule.properties));
    return `css-${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }

  private calculateSimilarity(props1: Record<string, string>, props2: Record<string, string>): number {
    const keys1 = Object.keys(props1);
    const keys2 = Object.keys(props2);
    const allKeys = new Set([...keys1, ...keys2]);

    if (allKeys.size === 0) return 0;

    let matches = 0;
    for (const key of allKeys) {
      if (props1[key] === props2[key]) {
        matches++;
      }
    }

    return matches / allKeys.size;
  }

  private calculateSpecificity(selector: string): { ids: number; classes: number; elements: number; depth: number } {
    const ids = (selector.match(/#/g) || []).length;
    const classes = (selector.match(/\./g) || []).length;
    const elements = (selector.match(/^[a-z]+|[\s>+~][a-z]+/gi) || []).length;
    const depth = selector.split(/[\s>+~]/).length;

    return { ids, classes, elements, depth };
  }

  private isReusablePattern(rule: CSSRule): boolean {
    const props = Object.keys(rule.properties);

    // Button patterns
    if (props.includes('padding') && props.includes('border-radius') &&
        (props.includes('background') || props.includes('background-color'))) {
      return true;
    }

    // Card patterns
    if (props.includes('box-shadow') && props.includes('border-radius') &&
        props.includes('padding')) {
      return true;
    }

    return false;
  }

  private isTypographyRule(rule: CSSRule): boolean {
    const typographyProps = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing'];
    const props = Object.keys(rule.properties);
    const typographyCount = props.filter(p => typographyProps.includes(p)).length;
    return typographyCount >= 2;
  }

  private isButtonPattern(rule: CSSRule): boolean {
    const props = Object.keys(rule.properties);
    const buttonIndicators = ['cursor', 'background', 'border', 'padding', 'border-radius'];
    const matchCount = props.filter(p => buttonIndicators.some(b => p.includes(b))).length;
    return matchCount >= 3 && rule.properties['cursor'] === 'pointer';
  }

  private generateExternalizeExample(rule: CSSRule, componentName?: string): string {
    const className = componentName
      ? `${componentName.toLowerCase()}-style`
      : 'custom-class';

    const cssProps = Object.entries(rule.properties)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');

    return `.${className} {\n${cssProps}\n}`;
  }

  private getFontWeightName(value: string): string {
    const weights: Record<string, string> = {
      '100': 'thin', '200': 'extralight', '300': 'light',
      '400': 'normal', '500': 'medium', '600': 'semibold',
      '700': 'bold', '800': 'extrabold', '900': 'black'
    };
    return weights[value] || value;
  }

  private suggestBEMName(selector: string): string {
    const parts = selector.trim().split(/\s+/);
    if (parts.length >= 2) {
      const block = parts[0].replace('.', '');
      const element = parts[parts.length - 1].replace('.', '');
      return `.${block}__${element}`;
    }
    return selector;
  }

  private completelyOverrides(newRule: CSSRule, existing: CSSRule): boolean {
    if (newRule.selector !== existing.selector) return false;

    const existingProps = Object.keys(existing.properties);
    const newProps = Object.keys(newRule.properties);

    return existingProps.every(prop => newProps.includes(prop));
  }

  private isLikelyUnused(rule: CSSRule): boolean {
    // Heuristics for likely unused rules
    const selector = rule.selector;

    // Very specific selectors that might be stale
    if (selector.includes('[data-v-') || selector.includes('[_ngcontent-')) {
      return true; // Likely framework-generated and orphaned
    }

    return false;
  }

  private prioritizeSuggestions(suggestions: CSSSuggestion[]): CSSSuggestion[] {
    const severityOrder = { error: 0, warning: 1, info: 2, suggestion: 3 };
    return suggestions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  private generateSummary(
    rule: CSSRule,
    suggestions: CSSSuggestion[],
    duplicates: CSSRule[],
    shouldExternalize: boolean,
    shouldMakeGlobal: boolean
  ): string {
    const parts: string[] = [];

    if (duplicates.length > 0) {
      parts.push(`Found ${duplicates.length} duplicate rule(s)`);
    }

    if (shouldExternalize) {
      parts.push('Should be moved to external stylesheet');
    }

    if (shouldMakeGlobal) {
      parts.push('Consider making global');
    }

    const errors = suggestions.filter(s => s.severity === 'error').length;
    const warnings = suggestions.filter(s => s.severity === 'warning').length;

    if (errors > 0) {
      parts.push(`${errors} error(s)`);
    }
    if (warnings > 0) {
      parts.push(`${warnings} warning(s)`);
    }

    if (parts.length === 0) {
      return 'CSS rule looks good';
    }

    return parts.join('. ') + '.';
  }

  private initializeKnownPatterns(): void {
    // Add common utility classes
    const utilities = [
      'flex', 'grid', 'hidden', 'block', 'inline', 'inline-block',
      'relative', 'absolute', 'fixed', 'sticky',
      'text-center', 'text-left', 'text-right',
      'font-bold', 'font-normal', 'font-medium'
    ];
    utilities.forEach(u => this.knownUtilityClasses.add(u));
  }
}

// Export singleton
export const cssAnalyzer = new CSSAnalyzer();
