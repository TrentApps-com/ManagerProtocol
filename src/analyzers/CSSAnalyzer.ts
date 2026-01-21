/**
 * Enterprise Agent Supervisor - CSS Analyzer
 *
 * Analyzes CSS rules for optimization, deduplication, and best practices.
 *
 * Task #44: Extensible pattern catalog system
 * Task #51: Optimized similarity calculation with hashing/indexing
 * Task #52: Comprehensive logging and metrics tracking
 */

import {
  suggestToken,
  getRecommendedTokens
} from '../design-system/index.js';
import { hashString } from '../utils/shared.js';

// ============================================================================
// INTERFACES
// ============================================================================

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
  metrics?: CSSAnalysisMetrics; // Task #52: Analysis metrics
}

// ============================================================================
// Task #52: METRICS AND LOGGING INTERFACES
// ============================================================================

export interface CSSAnalysisMetrics {
  rulesAnalyzed: number;
  duplicatesFound: number;
  suggestionsMade: number;
  suggestionsByType: Record<string, number>;
  suggestionsBySeverity: Record<string, number>;
  timingMs: {
    total: number;
    duplicateCheck: number;
    externalizeCheck: number;
    globalCheck: number;
    variableCheck: number;
    utilityCheck: number;
    specificityCheck: number;
    namingCheck: number;
    removableCheck: number;
  };
  cacheHits: number;
  cacheMisses: number;
}

export interface CSSAnalyzerLogger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
}

// Default no-op logger
const noopLogger: CSSAnalyzerLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
};

// Console logger for debugging
export const consoleLogger: CSSAnalyzerLogger = {
  debug: (msg, data) => console.debug(`[CSSAnalyzer:DEBUG] ${msg}`, data || ''),
  info: (msg, data) => console.info(`[CSSAnalyzer:INFO] ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[CSSAnalyzer:WARN] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[CSSAnalyzer:ERROR] ${msg}`, data || '')
};

// ============================================================================
// Task #44: PATTERN CATALOG SYSTEM
// ============================================================================

export interface CSSVariablePattern {
  id: string;
  pattern: RegExp;
  type: 'color' | 'spacing' | 'font-size' | 'font-weight' | 'duration' | 'easing' | 'custom';
  varPrefix: string;
  minValue?: number;
  maxValue?: number;
  description?: string;
  enabled: boolean;
}

export interface CSSGlobalPattern {
  id: string;
  properties: string[];
  minMatches: number;
  description?: string;
  enabled: boolean;
}

export interface CSSReusablePattern {
  id: string;
  name: string;
  requiredProperties: string[];
  optionalProperties?: string[];
  description?: string;
  enabled: boolean;
}

export interface CSSUtilityMapping {
  property: string;
  valueMapper: (value: string) => string | null;
  enabled: boolean;
}

export interface CSSPatternCatalog {
  variablePatterns: CSSVariablePattern[];
  globalPatterns: CSSGlobalPattern[];
  reusablePatterns: CSSReusablePattern[];
  utilityMappings: CSSUtilityMapping[];
}

// Default pattern catalog
const DEFAULT_PATTERN_CATALOG: CSSPatternCatalog = {
  variablePatterns: [
    { id: 'color-hex', pattern: /^#[0-9a-fA-F]{3,8}$/, type: 'color', varPrefix: '--color-', description: 'Hex color values', enabled: true },
    { id: 'color-rgb', pattern: /^rgb\(|^rgba\(/, type: 'color', varPrefix: '--color-', description: 'RGB/RGBA color values', enabled: true },
    { id: 'color-hsl', pattern: /^hsl\(|^hsla\(/, type: 'color', varPrefix: '--color-', description: 'HSL/HSLA color values', enabled: true },
    { id: 'spacing-px', pattern: /^\d+px$/, type: 'spacing', varPrefix: '--spacing-', minValue: 8, description: 'Pixel spacing values', enabled: true },
    { id: 'spacing-rem', pattern: /^\d+rem$/, type: 'spacing', varPrefix: '--spacing-', description: 'Rem spacing values', enabled: true },
    { id: 'font-size', pattern: /^(\d+(\.\d+)?)(px|rem|em)$/, type: 'font-size', varPrefix: '--font-size-', description: 'Font size values', enabled: true },
    { id: 'font-weight', pattern: /^\d{3}$/, type: 'font-weight', varPrefix: '--font-weight-', description: 'Font weight values', enabled: true },
    { id: 'duration', pattern: /^(\d+(\.\d+)?)(s|ms)$/, type: 'duration', varPrefix: '--duration-', description: 'Animation/transition durations', enabled: true },
    { id: 'easing', pattern: /^cubic-bezier\(/, type: 'easing', varPrefix: '--easing-', description: 'Cubic bezier easing functions', enabled: true }
  ],
  globalPatterns: [
    { id: 'typography', properties: ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing'], minMatches: 2, description: 'Typography styles', enabled: true },
    { id: 'theme-colors', properties: ['color', 'background-color'], minMatches: 1, description: 'Theme color properties', enabled: true },
    { id: 'design-tokens', properties: ['border-radius', 'box-shadow', 'transition', 'animation'], minMatches: 2, description: 'Design token properties', enabled: true }
  ],
  reusablePatterns: [
    { id: 'button', name: 'Button', requiredProperties: ['padding', 'border-radius', 'background', 'cursor'], optionalProperties: ['background-color', 'border'], description: 'Button-like component', enabled: true },
    { id: 'card', name: 'Card', requiredProperties: ['box-shadow', 'border-radius', 'padding'], description: 'Card component', enabled: true },
    { id: 'input', name: 'Input', requiredProperties: ['border', 'padding'], optionalProperties: ['border-radius', 'outline'], description: 'Form input', enabled: true }
  ],
  utilityMappings: [
    { property: 'display', valueMapper: (v) => v === 'flex' ? 'flex' : v === 'grid' ? 'grid' : v === 'none' ? 'hidden' : null, enabled: true },
    { property: 'flex-direction', valueMapper: (v) => v === 'column' ? 'flex-col' : v === 'row' ? 'flex-row' : null, enabled: true },
    { property: 'justify-content', valueMapper: (v) => `justify-${v.replace('flex-', '').replace('space-', '')}`, enabled: true },
    { property: 'align-items', valueMapper: (v) => `items-${v.replace('flex-', '')}`, enabled: true },
    { property: 'text-align', valueMapper: (v) => `text-${v}`, enabled: true },
    { property: 'font-weight', valueMapper: () => null, enabled: true }, // Handled separately with getFontWeightName
    { property: 'position', valueMapper: (v) => v, enabled: true },
    { property: 'overflow', valueMapper: (v) => `overflow-${v}`, enabled: true },
    { property: 'cursor', valueMapper: (v) => `cursor-${v}`, enabled: true }
  ]
};

/**
 * Properties that commonly indicate global/reusable styles
 * Legacy constant for backward compatibility
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

// ============================================================================
// Task #51: OPTIMIZED INDEXING STRUCTURES
// ============================================================================

interface PropertySignature {
  hash: string;
  propertyCount: number;
  sortedKeys: string;
}

interface RuleIndex {
  // Maps property hash to rules with those exact properties
  byPropertyHash: Map<string, CSSRule[]>;
  // Maps selector to rules
  bySelector: Map<string, CSSRule[]>;
  // Maps sorted property keys to rules for quick similarity pre-filtering
  byPropertyKeys: Map<string, CSSRule[]>;
  // Cached signatures for each rule
  signatures: Map<CSSRule, PropertySignature>;
}

export interface CSSAnalyzerOptions {
  logger?: CSSAnalyzerLogger;
  patternCatalog?: Partial<CSSPatternCatalog>;
  enableMetrics?: boolean;
  enableCaching?: boolean;
  similarityThreshold?: number; // Default: 0.7
}

export class CSSAnalyzer {
  private knownUtilityClasses: Set<string> = new Set();

  // Task #44: Pattern catalog (extensible)
  private patternCatalog: CSSPatternCatalog;

  // Task #51: Optimized indexing
  // ruleIndex and lastIndexedRules used internally by getOrBuildIndex for caching
  private _ruleIndex: RuleIndex | null = null;
  private _lastIndexedRules: CSSRule[] | null = null;
  private similarityThreshold: number;
  private enableCaching: boolean;

  // Task #52: Logging and metrics
  private logger: CSSAnalyzerLogger;
  private enableMetrics: boolean;
  private cumulativeMetrics: {
    totalAnalyses: number;
    totalRulesAnalyzed: number;
    totalDuplicatesFound: number;
    totalSuggestionsMade: number;
    totalCacheHits: number;
    totalCacheMisses: number;
    totalTimeMs: number;
  };

  constructor(options: CSSAnalyzerOptions = {}) {
    this.logger = options.logger || noopLogger;
    this.enableMetrics = options.enableMetrics ?? false;
    this.enableCaching = options.enableCaching ?? true;
    this.similarityThreshold = options.similarityThreshold ?? 0.7;

    // Task #44: Merge custom patterns with defaults
    this.patternCatalog = this.mergePatternCatalog(options.patternCatalog);

    // Task #52: Initialize cumulative metrics
    this.cumulativeMetrics = {
      totalAnalyses: 0,
      totalRulesAnalyzed: 0,
      totalDuplicatesFound: 0,
      totalSuggestionsMade: 0,
      totalCacheHits: 0,
      totalCacheMisses: 0,
      totalTimeMs: 0
    };

    this.initializeKnownPatterns();
    this.logger.info('CSSAnalyzer initialized', {
      enableMetrics: this.enableMetrics,
      enableCaching: this.enableCaching,
      similarityThreshold: this.similarityThreshold,
      patternCount: {
        variablePatterns: this.patternCatalog.variablePatterns.filter(p => p.enabled).length,
        globalPatterns: this.patternCatalog.globalPatterns.filter(p => p.enabled).length,
        reusablePatterns: this.patternCatalog.reusablePatterns.filter(p => p.enabled).length,
        utilityMappings: this.patternCatalog.utilityMappings.filter(p => p.enabled).length
      }
    });
  }

  // ============================================================================
  // Task #44: PATTERN CATALOG MANAGEMENT
  // ============================================================================

  /**
   * Merge custom patterns with defaults
   */
  private mergePatternCatalog(custom?: Partial<CSSPatternCatalog>): CSSPatternCatalog {
    if (!custom) return { ...DEFAULT_PATTERN_CATALOG };

    return {
      variablePatterns: [
        ...DEFAULT_PATTERN_CATALOG.variablePatterns,
        ...(custom.variablePatterns || [])
      ],
      globalPatterns: [
        ...DEFAULT_PATTERN_CATALOG.globalPatterns,
        ...(custom.globalPatterns || [])
      ],
      reusablePatterns: [
        ...DEFAULT_PATTERN_CATALOG.reusablePatterns,
        ...(custom.reusablePatterns || [])
      ],
      utilityMappings: [
        ...DEFAULT_PATTERN_CATALOG.utilityMappings,
        ...(custom.utilityMappings || [])
      ]
    };
  }

  /**
   * Add a custom variable pattern
   */
  addVariablePattern(pattern: CSSVariablePattern): void {
    this.patternCatalog.variablePatterns.push(pattern);
    this.logger.debug('Added variable pattern', { id: pattern.id });
  }

  /**
   * Add a custom global pattern
   */
  addGlobalPattern(pattern: CSSGlobalPattern): void {
    this.patternCatalog.globalPatterns.push(pattern);
    this.logger.debug('Added global pattern', { id: pattern.id });
  }

  /**
   * Add a custom reusable pattern
   */
  addReusablePattern(pattern: CSSReusablePattern): void {
    this.patternCatalog.reusablePatterns.push(pattern);
    this.logger.debug('Added reusable pattern', { id: pattern.id });
  }

  /**
   * Add a custom utility mapping
   */
  addUtilityMapping(mapping: CSSUtilityMapping): void {
    this.patternCatalog.utilityMappings.push(mapping);
    this.logger.debug('Added utility mapping', { property: mapping.property });
  }

  /**
   * Enable or disable a pattern by ID
   */
  setPatternEnabled(patternId: string, enabled: boolean): boolean {
    for (const patterns of [
      this.patternCatalog.variablePatterns,
      this.patternCatalog.globalPatterns,
      this.patternCatalog.reusablePatterns
    ]) {
      const pattern = patterns.find(p => p.id === patternId);
      if (pattern) {
        pattern.enabled = enabled;
        this.logger.debug('Pattern enabled state changed', { id: patternId, enabled });
        return true;
      }
    }
    return false;
  }

  /**
   * Get the current pattern catalog (for inspection/debugging)
   */
  getPatternCatalog(): CSSPatternCatalog {
    return { ...this.patternCatalog };
  }

  /**
   * Get cumulative metrics (Task #52)
   */
  getCumulativeMetrics() {
    return { ...this.cumulativeMetrics };
  }

  /**
   * Reset cumulative metrics (Task #52)
   */
  resetCumulativeMetrics(): void {
    this.cumulativeMetrics = {
      totalAnalyses: 0,
      totalRulesAnalyzed: 0,
      totalDuplicatesFound: 0,
      totalSuggestionsMade: 0,
      totalCacheHits: 0,
      totalCacheMisses: 0,
      totalTimeMs: 0
    };
    this.logger.debug('Cumulative metrics reset');
  }

  /**
   * Main analysis entry point
   */
  analyze(context: CSSAnalysisContext): CSSAnalysisResult {
    // Task #52: Start timing
    const totalStart = performance.now();
    const timingMs = {
      total: 0,
      duplicateCheck: 0,
      externalizeCheck: 0,
      globalCheck: 0,
      variableCheck: 0,
      utilityCheck: 0,
      specificityCheck: 0,
      namingCheck: 0,
      removableCheck: 0
    };
    let cacheHits = 0;
    let cacheMisses = 0;

    this.logger.debug('Starting CSS analysis', {
      selector: context.newRule.selector,
      source: context.newRule.source,
      propertyCount: Object.keys(context.newRule.properties).length,
      existingRulesCount: context.existingRules?.length || 0
    });

    try {
      // Validate selector first
      if (!this.isValidSelector(context.newRule.selector)) {
        this.logger.warn('Invalid CSS selector', { selector: context.newRule.selector });
        return {
          ruleId: `css-invalid-${this.simpleHash(context.newRule.selector)}`,
          newRule: context.newRule,
          shouldExternalize: false,
          shouldMakeGlobal: false,
          duplicates: [],
          suggestions: [{
            type: 'specificity_warning',
            severity: 'error',
            message: 'Invalid CSS selector',
            details: 'The selector appears to be malformed or contains invalid characters'
          }],
          removableCandidates: [],
          riskScore: 50,
          summary: 'Skipped analysis: invalid CSS selector'
        };
      }

      const ruleId = this.generateRuleId(context.newRule);
      const suggestions: CSSSuggestion[] = [];
      const duplicates: CSSRule[] = [];
      const removableCandidates: CSSRule[] = [];
      let riskScore = 0;

      // Task #51: Build or reuse index for existing rules
      const existingRules = context.existingRules || [];
      if (existingRules.length > 0) {
        const indexResult = this.getOrBuildIndex(existingRules);
        cacheHits += indexResult.cacheHit ? 1 : 0;
        cacheMisses += indexResult.cacheHit ? 0 : 1;
      }

      // 1. Check for duplicates/similar rules (Task #51: optimized)
      let stepStart = performance.now();
      const duplicateCheck = this.findDuplicatesOptimized(context.newRule, existingRules);
      timingMs.duplicateCheck = performance.now() - stepStart;
      duplicates.push(...duplicateCheck.duplicates);
      suggestions.push(...duplicateCheck.suggestions);
      riskScore += duplicateCheck.duplicates.length * 10;
      this.logger.debug('Duplicate check complete', {
        duplicatesFound: duplicateCheck.duplicates.length,
        timeMs: timingMs.duplicateCheck.toFixed(2)
      });

      // 2. Check if should be externalized
      stepStart = performance.now();
      const externalizeCheck = this.checkExternalization(context);
      timingMs.externalizeCheck = performance.now() - stepStart;
      suggestions.push(...externalizeCheck.suggestions);
      if (externalizeCheck.shouldExternalize) riskScore += 15;

      // 3. Check if should be global
      stepStart = performance.now();
      const globalCheck = this.checkGlobalCandidate(context);
      timingMs.globalCheck = performance.now() - stepStart;
      suggestions.push(...globalCheck.suggestions);
      if (globalCheck.shouldMakeGlobal) riskScore += 10;

      // 4. Check for variable candidates (Task #44: uses pattern catalog)
      stepStart = performance.now();
      const variableCheck = this.checkVariableCandidates(context.newRule);
      timingMs.variableCheck = performance.now() - stepStart;
      suggestions.push(...variableCheck.suggestions);
      riskScore += variableCheck.suggestions.length * 5;

      // 5. Check for utility class opportunities (Task #44: uses pattern catalog)
      stepStart = performance.now();
      if (context.hasStyleSystem) {
        const utilityCheck = this.checkUtilityOpportunities(context);
        suggestions.push(...utilityCheck.suggestions);
      }
      timingMs.utilityCheck = performance.now() - stepStart;

      // 6. Check specificity issues
      stepStart = performance.now();
      const specificityCheck = this.checkSpecificity(context.newRule);
      timingMs.specificityCheck = performance.now() - stepStart;
      suggestions.push(...specificityCheck.suggestions);
      riskScore += specificityCheck.riskContribution;

      // 7. Check naming conventions
      stepStart = performance.now();
      const namingCheck = this.checkNamingConvention(context.newRule, context.framework);
      timingMs.namingCheck = performance.now() - stepStart;
      suggestions.push(...namingCheck.suggestions);

      // 8. Find removable candidates (Task #51: optimized)
      stepStart = performance.now();
      if (existingRules.length > 0) {
        removableCandidates.push(...this.findRemovableCandidatesOptimized(context.newRule, existingRules));
      }
      timingMs.removableCheck = performance.now() - stepStart;

      // Generate summary
      const summary = this.generateSummary(
        context.newRule,
        suggestions,
        duplicates,
        externalizeCheck.shouldExternalize,
        globalCheck.shouldMakeGlobal
      );

      timingMs.total = performance.now() - totalStart;

      // Task #52: Build metrics
      const metrics: CSSAnalysisMetrics = {
        rulesAnalyzed: existingRules.length + 1,
        duplicatesFound: duplicates.length,
        suggestionsMade: suggestions.length,
        suggestionsByType: this.countSuggestionsByType(suggestions),
        suggestionsBySeverity: this.countSuggestionsBySeverity(suggestions),
        timingMs,
        cacheHits,
        cacheMisses
      };

      // Task #52: Update cumulative metrics
      this.cumulativeMetrics.totalAnalyses++;
      this.cumulativeMetrics.totalRulesAnalyzed += metrics.rulesAnalyzed;
      this.cumulativeMetrics.totalDuplicatesFound += metrics.duplicatesFound;
      this.cumulativeMetrics.totalSuggestionsMade += metrics.suggestionsMade;
      this.cumulativeMetrics.totalCacheHits += cacheHits;
      this.cumulativeMetrics.totalCacheMisses += cacheMisses;
      this.cumulativeMetrics.totalTimeMs += timingMs.total;

      this.logger.info('CSS analysis complete', {
        ruleId,
        riskScore: Math.min(100, riskScore),
        duplicatesFound: duplicates.length,
        suggestionsCount: suggestions.length,
        totalTimeMs: timingMs.total.toFixed(2)
      });

      const result: CSSAnalysisResult = {
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

      // Task #52: Include metrics if enabled
      if (this.enableMetrics) {
        result.metrics = metrics;
      }

      return result;
    } catch (error) {
      this.logger.error('CSS analysis failed', {
        selector: context.newRule.selector,
        error: error instanceof Error ? error.message : String(error)
      });

      // Gracefully handle unexpected errors during analysis
      return {
        ruleId: `css-error-${this.simpleHash(context.newRule.selector)}`,
        newRule: context.newRule,
        shouldExternalize: false,
        shouldMakeGlobal: false,
        duplicates: [],
        suggestions: [{
          type: 'specificity_warning',
          severity: 'error',
          message: 'CSS analysis error',
          details: `Failed to analyze CSS selector: ${error instanceof Error ? error.message : String(error)}`
        }],
        removableCandidates: [],
        riskScore: 50,
        summary: 'Analysis failed due to unexpected error'
      };
    }
  }

  // ============================================================================
  // Task #52: METRICS HELPERS
  // ============================================================================

  private countSuggestionsByType(suggestions: CSSSuggestion[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const s of suggestions) {
      counts[s.type] = (counts[s.type] || 0) + 1;
    }
    return counts;
  }

  private countSuggestionsBySeverity(suggestions: CSSSuggestion[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const s of suggestions) {
      counts[s.severity] = (counts[s.severity] || 0) + 1;
    }
    return counts;
  }

  // ============================================================================
  // Task #51: OPTIMIZED INDEXING AND DUPLICATE DETECTION
  // ============================================================================

  /**
   * Get or build index for existing rules (Task #51: caching for performance)
   */
  private getOrBuildIndex(existingRules: CSSRule[]): { index: RuleIndex; cacheHit: boolean } {
    // Check if we can reuse the existing index
    if (this.enableCaching && this._ruleIndex && this._lastIndexedRules === existingRules) {
      this.logger.debug('Index cache hit');
      return { index: this._ruleIndex, cacheHit: true };
    }

    this.logger.debug('Building new rule index', { ruleCount: existingRules.length });
    const startTime = performance.now();

    const index: RuleIndex = {
      byPropertyHash: new Map(),
      bySelector: new Map(),
      byPropertyKeys: new Map(),
      signatures: new Map()
    };

    for (const rule of existingRules) {
      const signature = this.computePropertySignature(rule.properties);
      index.signatures.set(rule, signature);

      // Index by property hash (for exact matches)
      const hashRules = index.byPropertyHash.get(signature.hash) || [];
      hashRules.push(rule);
      index.byPropertyHash.set(signature.hash, hashRules);

      // Index by selector
      const selectorRules = index.bySelector.get(rule.selector) || [];
      selectorRules.push(rule);
      index.bySelector.set(rule.selector, selectorRules);

      // Index by sorted property keys (for similarity pre-filtering)
      const keyRules = index.byPropertyKeys.get(signature.sortedKeys) || [];
      keyRules.push(rule);
      index.byPropertyKeys.set(signature.sortedKeys, keyRules);
    }

    if (this.enableCaching) {
      this._ruleIndex = index;
      this._lastIndexedRules = existingRules;
    }

    this.logger.debug('Index built', {
      timeMs: (performance.now() - startTime).toFixed(2),
      uniquePropertyHashes: index.byPropertyHash.size,
      uniqueSelectors: index.bySelector.size,
      uniquePropertyKeyPatterns: index.byPropertyKeys.size
    });

    return { index, cacheHit: false };
  }

  /**
   * Compute a signature for CSS properties for fast comparison (Task #51)
   */
  private computePropertySignature(properties: Record<string, string>): PropertySignature {
    const keys = Object.keys(properties).sort();
    const sortedKeys = keys.join(',');
    const values = keys.map(k => `${k}:${properties[k]}`).join(';');
    const hash = this.simpleHash(values);

    return {
      hash,
      propertyCount: keys.length,
      sortedKeys
    };
  }

  /**
   * Find duplicates with optimized O(1) hash lookup + O(k) similarity check (Task #51)
   * where k is the number of rules with similar property counts/keys
   */
  private findDuplicatesOptimized(newRule: CSSRule, existingRules: CSSRule[]): {
    duplicates: CSSRule[];
    suggestions: CSSSuggestion[];
  } {
    const duplicates: CSSRule[] = [];
    const suggestions: CSSSuggestion[] = [];

    if (existingRules.length === 0) {
      return { duplicates, suggestions };
    }

    const { index } = this.getOrBuildIndex(existingRules);
    const newSignature = this.computePropertySignature(newRule.properties);

    // Step 1: O(1) lookup for exact property matches by hash
    const exactMatches = index.byPropertyHash.get(newSignature.hash) || [];
    for (const existing of exactMatches) {
      // Verify it's truly an exact match (hash collision protection)
      if (this.calculateSimilarity(newRule.properties, existing.properties) === 1) {
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
      }
    }

    // Step 2: Check for same selector with different properties
    const sameSelectors = index.bySelector.get(newRule.selector) || [];
    for (const existing of sameSelectors) {
      const similarity = this.calculateSimilarity(newRule.properties, existing.properties);
      if (similarity < 1 && similarity > 0) {
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

    // Step 3: Similarity search with early termination (Task #51 optimization)
    // Only check rules with similar property counts (within 50% range)
    const newCount = newSignature.propertyCount;
    const minCount = Math.floor(newCount * 0.5);
    const maxCount = Math.ceil(newCount * 1.5);

    // Get candidate rules by property key patterns for pre-filtering
    const checked = new Set<CSSRule>(exactMatches);
    for (const existing of existingRules) {
      if (checked.has(existing)) continue;

      const existingSig = index.signatures.get(existing);
      if (!existingSig) continue;

      // Early termination: skip if property count difference is too large
      if (existingSig.propertyCount < minCount || existingSig.propertyCount > maxCount) {
        continue;
      }

      // Calculate similarity only for candidates that pass pre-filter
      const similarity = this.calculateSimilarity(newRule.properties, existing.properties);

      if (similarity >= this.similarityThreshold && similarity < 1) {
        suggestions.push({
          type: 'consolidate',
          severity: 'warning',
          message: `Similar CSS properties (${Math.round(similarity * 100)}% match) found in "${existing.selector}"`,
          details: 'Consider consolidating these rules to reduce CSS bundle size',
          existingRule: existing,
          suggestedAction: 'Extend the existing rule or create a shared base class'
        });
      }
    }

    return { duplicates, suggestions };
  }

  /**
   * Find removable candidates with optimized lookup (Task #51)
   */
  private findRemovableCandidatesOptimized(newRule: CSSRule, existingRules: CSSRule[]): CSSRule[] {
    const removable: CSSRule[] = [];
    const { index } = this.getOrBuildIndex(existingRules);

    // Only check rules with the same selector
    const sameSelectors = index.bySelector.get(newRule.selector) || [];
    for (const existing of sameSelectors) {
      if (this.completelyOverrides(newRule, existing)) {
        removable.push(existing);
      }
    }

    // Check for likely unused rules (no optimization needed, fast check)
    for (const existing of existingRules) {
      if (this.isLikelyUnused(existing) && !removable.includes(existing)) {
        removable.push(existing);
      }
    }

    return removable;
  }

  /**
   * Clear the rule index cache (call when rules change)
   */
  clearIndexCache(): void {
    this._ruleIndex = null;
    this._lastIndexedRules = null;
    this.logger.debug('Index cache cleared');
  }

  /**
   * Find duplicate or similar CSS rules
   * @deprecated Use findDuplicatesOptimized instead (Task #51)
   * @internal Kept for backward compatibility - delegates to optimized version
   */
  public findDuplicates(newRule: CSSRule, existingRules: CSSRule[]): {
    duplicates: CSSRule[];
    suggestions: CSSSuggestion[];
  } {
    // Delegate to optimized version
    return this.findDuplicatesOptimized(newRule, existingRules);
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
   * Check if CSS should be made global (Task #44: uses pattern catalog)
   */
  private checkGlobalCandidate(context: CSSAnalysisContext): {
    shouldMakeGlobal: boolean;
    suggestions: CSSSuggestion[];
  } {
    const suggestions: CSSSuggestion[] = [];
    let shouldMakeGlobal = false;

    const properties = Object.keys(context.newRule.properties);

    // Task #44: Check against global patterns from catalog
    for (const pattern of this.patternCatalog.globalPatterns.filter(p => p.enabled)) {
      const matches = properties.filter(p => pattern.properties.includes(p));
      if (matches.length >= pattern.minMatches) {
        shouldMakeGlobal = true;
        suggestions.push({
          type: 'make_global',
          severity: 'suggestion',
          message: `Rule matches global pattern "${pattern.id}": ${matches.join(', ')}`,
          details: pattern.description || 'These properties often indicate design system tokens that should be global',
          suggestedAction: 'Consider adding to global styles or design system'
        });
      }
    }

    // Legacy check for backward compatibility (only if not already matched)
    if (!shouldMakeGlobal) {
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
    }

    // Task #44: Check reusable patterns from catalog
    for (const pattern of this.patternCatalog.reusablePatterns.filter(p => p.enabled)) {
      if (this.matchesReusablePattern(context.newRule, pattern)) {
        shouldMakeGlobal = true;
        suggestions.push({
          type: 'make_global',
          severity: 'suggestion',
          message: `${pattern.name} styles should be global components`,
          details: pattern.description || 'Consistent interactive elements improve UX and accessibility',
          suggestedAction: `Create a reusable ${pattern.name.toLowerCase()} component/class`
        });
      }
    }

    return { shouldMakeGlobal, suggestions };
  }

  /**
   * Check if a rule matches a reusable pattern from the catalog (Task #44)
   */
  private matchesReusablePattern(rule: CSSRule, pattern: CSSReusablePattern): boolean {
    const props = Object.keys(rule.properties);

    // All required properties must be present (or start with the property name for variants like background-color)
    const hasAllRequired = pattern.requiredProperties.every(req =>
      props.some(p => p === req || p.startsWith(req))
    );

    if (!hasAllRequired) return false;

    // For button pattern, also check cursor: pointer
    if (pattern.id === 'button' && rule.properties['cursor'] !== 'pointer') {
      return false;
    }

    return true;
  }

  /**
   * Check for CSS variable candidates using design system tokens
   */
  private checkVariableCandidates(rule: CSSRule): {
    suggestions: CSSSuggestion[];
  } {
    const suggestions: CSSSuggestion[] = [];

    for (const [property, value] of Object.entries(rule.properties)) {
      // First, try to find an exact or close match from the design system
      const tokenSuggestion = suggestToken(value, property);

      if (tokenSuggestion && tokenSuggestion.confidence >= 0.7) {
        const { token, confidence } = tokenSuggestion;
        const confidencePercent = Math.round(confidence * 100);

        suggestions.push({
          type: 'use_variable',
          severity: confidence >= 0.95 ? 'warning' : 'info',
          message: `${property}: ${value} should use design token var(${token.name})`,
          details: confidence >= 0.95
            ? `Exact match found: "${token.description}" - Use design system token for consistency`
            : `Close match (${confidencePercent}%): "${token.description}" - Consider using design system token`,
          suggestedAction: `Replace with var(${token.name})`,
          codeExample: `${property}: var(${token.name}); /* ${token.description} */`
        });
        continue;
      }

      // Fall back to generic variable suggestions for unmatched values
      for (const candidate of this.patternCatalog.variablePatterns) {
        if (candidate.pattern.test(value)) {
          // Skip small values for spacing
          if (candidate.type === 'spacing' && candidate.minValue) {
            const numValue = parseInt(value);
            if (numValue < candidate.minValue) continue;
          }

          // Map candidate type to token category
          const tokenCategory = this.mapTypeToTokenCategory(candidate.type);
          const recommendedTokens = tokenCategory ? getRecommendedTokens(tokenCategory) : [];
          const tokenList = recommendedTokens.slice(0, 3).map(t => t.name).join(', ');

          suggestions.push({
            type: 'use_variable',
            severity: 'info',
            message: `${property}: ${value} should use a CSS variable`,
            details: recommendedTokens.length > 0
              ? `Available ${candidate.type} tokens: ${tokenList}`
              : `${candidate.type} values should be defined as CSS custom properties for consistency`,
            suggestedAction: recommendedTokens.length > 0
              ? `Consider design tokens: ${tokenList}`
              : `Replace with var(${candidate.varPrefix}xxx)`,
            codeExample: recommendedTokens.length > 0
              ? `${property}: var(${recommendedTokens[0].name}); /* ${recommendedTokens[0].description} */`
              : `${property}: var(${candidate.varPrefix}primary);`
          });
          break;
        }
      }
    }

    return { suggestions };
  }

  /**
   * Check for utility class opportunities (Task #44: uses pattern catalog)
   */
  private checkUtilityOpportunities(context: CSSAnalysisContext): {
    suggestions: CSSSuggestion[];
  } {
    const suggestions: CSSSuggestion[] = [];
    const properties = context.newRule.properties;

    // Task #44: Use utility mappings from pattern catalog
    for (const [property, value] of Object.entries(properties)) {
      // First check catalog mappings
      const catalogMapping = this.patternCatalog.utilityMappings.find(
        m => m.enabled && m.property === property
      );

      if (catalogMapping) {
        // Special handling for font-weight (uses getFontWeightName)
        let utilityClass: string | null = null;
        if (property === 'font-weight') {
          utilityClass = `font-${this.getFontWeightName(value)}`;
        } else {
          utilityClass = catalogMapping.valueMapper(value);
        }

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

    try {
      const selector = rule.selector;

      // Validate selector before processing
      if (!selector || typeof selector !== 'string' || selector.length === 0) {
        return { suggestions };
      }

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
    } catch (error) {
      // Silently skip naming convention checks if they fail
    }

    return { suggestions };
  }

  /**
   * Find CSS rules that can be safely removed
   * @deprecated Use findRemovableCandidatesOptimized instead (Task #51)
   * @internal Kept for backward compatibility - delegates to optimized version
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected findRemovableCandidates(newRule: CSSRule, existingRules: CSSRule[]): CSSRule[] {
    // Delegate to optimized version
    return this.findRemovableCandidatesOptimized(newRule, existingRules);
  }

  // ============================================================================
  // VALIDATION METHODS
  // ============================================================================

  /**
   * Validate that a selector is well-formed and safe to process
   */
  private isValidSelector(selector: string): boolean {
    try {
      // Check for empty or whitespace-only selectors
      if (!selector || typeof selector !== 'string' || selector.trim().length === 0) {
        return false;
      }

      // Limit selector length to prevent processing extremely large selectors
      if (selector.length > 2000) {
        return false;
      }

      // Check for unclosed brackets/quotes
      const openBrackets = (selector.match(/\[/g) || []).length;
      const closeBrackets = (selector.match(/\]/g) || []).length;
      if (openBrackets !== closeBrackets) {
        return false;
      }

      // Check for unclosed parentheses
      const openParens = (selector.match(/\(/g) || []).length;
      const closeParens = (selector.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        return false;
      }

      // Check for unclosed quotes (both single and double)
      const singleQuotes = (selector.match(/'/g) || []).length;
      const doubleQuotes = (selector.match(/"/g) || []).length;
      if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
        return false;
      }

      return true;
    } catch {
      // If validation itself throws, consider selector invalid
      return false;
    }
  }

  /**
   * Normalize a selector for safe analysis by removing problematic content
   */
  private normalizeSelectorForAnalysis(selector: string): string {
    try {
      if (!selector || typeof selector !== 'string') {
        return '';
      }

      // Remove pseudo-elements and pseudo-classes that contain content
      let normalized = selector
        .replace(/:not\([^)]*\)/gi, '') // Remove :not() pseudo-class with content
        .replace(/::?before/gi, '')
        .replace(/::?after/gi, '')
        .replace(/::?first-line/gi, '')
        .replace(/::?first-letter/gi, '');

      // Limit length to prevent excessive processing
      if (normalized.length > 2000) {
        normalized = normalized.substring(0, 2000);
      }

      return normalized;
    } catch {
      return '';
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private generateRuleId(rule: CSSRule): string {
    const hash = this.simpleHash(rule.selector + JSON.stringify(rule.properties));
    return `css-${hash}`;
  }

  private simpleHash(str: string): string {
    return hashString(str);
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
    try {
      // Sanitize and normalize selector
      const normalizedSelector = this.normalizeSelectorForAnalysis(selector);

      if (!normalizedSelector) {
        return { ids: 0, classes: 0, elements: 0, depth: 0 };
      }

      const ids = (normalizedSelector.match(/#/g) || []).length;
      const classes = (normalizedSelector.match(/\./g) || []).length;
      const elements = (normalizedSelector.match(/^[a-z]+|[\s>+~][a-z]+/gi) || []).length;
      const depth = Math.min(normalizedSelector.split(/[\s>+~]/).length, 100); // Cap depth at 100

      return { ids, classes, elements, depth };
    } catch {
      // Return safe defaults if parsing fails
      return { ids: 0, classes: 0, elements: 0, depth: 0 };
    }
  }

  /**
   * Check if rule is a reusable pattern (Task #44: uses pattern catalog)
   */
  private isReusablePattern(rule: CSSRule): boolean {
    // Check against reusable patterns from catalog
    for (const pattern of this.patternCatalog.reusablePatterns.filter(p => p.enabled)) {
      if (this.matchesReusablePattern(rule, pattern)) {
        return true;
      }
    }

    // Legacy fallback
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

  /**
   * Check if rule is a typography rule (Task #44: uses pattern catalog)
   * @internal Exposed for testing - now uses pattern catalog internally
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected isTypographyRule(rule: CSSRule): boolean {
    // Check against typography global pattern from catalog
    const typographyPattern = this.patternCatalog.globalPatterns.find(
      p => p.id === 'typography' && p.enabled
    );

    if (typographyPattern) {
      const props = Object.keys(rule.properties);
      const matchCount = props.filter(p => typographyPattern.properties.includes(p)).length;
      return matchCount >= typographyPattern.minMatches;
    }

    // Legacy fallback
    const typographyProps = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing'];
    const props = Object.keys(rule.properties);
    const typographyCount = props.filter(p => typographyProps.includes(p)).length;
    return typographyCount >= 2;
  }

  /**
   * Check if rule is a button pattern (Task #44: uses pattern catalog)
   * @internal Exposed for testing - now uses pattern catalog internally
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected isButtonPattern(rule: CSSRule): boolean {
    // Check against button reusable pattern from catalog
    const buttonPattern = this.patternCatalog.reusablePatterns.find(
      p => p.id === 'button' && p.enabled
    );

    if (buttonPattern) {
      return this.matchesReusablePattern(rule, buttonPattern);
    }

    // Legacy fallback
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
    try {
      const trimmed = selector.trim();

      // Handle edge cases
      if (!trimmed || trimmed.length > 1000) {
        return selector;
      }

      const parts = trimmed.split(/\s+/).filter(p => p.length > 0);

      if (parts.length >= 2) {
        const block = parts[0].replace(/[^a-zA-Z0-9_-]/g, '');
        const element = parts[parts.length - 1].replace(/[^a-zA-Z0-9_-]/g, '');

        if (block && element) {
          return `.${block}__${element}`;
        }
      }

      return selector;
    } catch {
      return selector;
    }
  }

  private completelyOverrides(newRule: CSSRule, existing: CSSRule): boolean {
    if (newRule.selector !== existing.selector) return false;

    const existingProps = Object.keys(existing.properties);
    const newProps = Object.keys(newRule.properties);

    return existingProps.every(prop => newProps.includes(prop));
  }

  private isLikelyUnused(rule: CSSRule): boolean {
    try {
      const selector = rule.selector;

      // Handle edge cases
      if (!selector || typeof selector !== 'string' || selector.length > 2000) {
        return false;
      }

      // Very specific selectors that might be stale
      if (selector.includes('[data-v-') || selector.includes('[_ngcontent-')) {
        return true; // Likely framework-generated and orphaned
      }

      return false;
    } catch {
      return false;
    }
  }

  private prioritizeSuggestions(suggestions: CSSSuggestion[]): CSSSuggestion[] {
    const severityOrder = { error: 0, warning: 1, info: 2, suggestion: 3 };
    return suggestions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  private generateSummary(
    _rule: CSSRule,
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

  /**
   * Map pattern catalog variable types to design token categories
   */
  private mapTypeToTokenCategory(candidateType: string): 'background' | 'color' | 'border' | 'spacing' | 'radius' | 'shadow' | 'font-size' | 'z-index' | 'transition' | null {
    const mapping: Record<string, 'background' | 'color' | 'border' | 'spacing' | 'radius' | 'shadow' | 'font-size' | 'z-index' | 'transition'> = {
      'color': 'color',
      'spacing': 'spacing',
      'font-size': 'font-size',
      'font-weight': 'color', // No direct match in token categories
      'duration': 'transition',
      'easing': 'transition'
    };
    return mapping[candidateType] || null;
  }
}

// Export singleton
export const cssAnalyzer = new CSSAnalyzer();
