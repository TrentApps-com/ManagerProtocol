/**
 * Enterprise Agent Supervisor - CSS Rules
 *
 * Built-in rules for CSS code quality, maintainability, and best practices.
 */

import type { BusinessRule } from '../types/index.js';

export const cssRules: BusinessRule[] = [
  // ============================================================================
  // CSS ORGANIZATION RULES
  // ============================================================================
  {
    id: 'css-001',
    name: 'Externalize Inline Styles',
    description: 'Inline styles should be moved to external stylesheets',
    type: 'ux',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'cssSource', operator: 'equals', value: 'inline' }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Inline styles should be externalized for cacheability and maintainability' }
    ],
    riskWeight: 15,
    tags: ['css', 'inline-styles', 'best-practices']
  },
  {
    id: 'css-002',
    name: 'Avoid Duplicate CSS Rules',
    description: 'Prevent creation of duplicate CSS rules',
    type: 'architecture',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'hasDuplicates', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Duplicate CSS rules detected - use existing class instead' }
    ],
    riskWeight: 20,
    tags: ['css', 'duplicates', 'dry']
  },
  {
    id: 'css-003',
    name: 'Promote Reusable Patterns to Global',
    description: 'Common patterns should be global styles',
    type: 'architecture',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'isReusablePattern', operator: 'equals', value: true },
      { field: 'isGlobal', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Reusable CSS pattern detected - consider making global' }
    ],
    riskWeight: 10,
    tags: ['css', 'global-styles', 'design-system']
  },

  // ============================================================================
  // CSS SPECIFICITY RULES
  // ============================================================================
  {
    id: 'css-010',
    name: 'Avoid ID Selectors',
    description: 'ID selectors have high specificity and should be avoided',
    type: 'architecture',
    enabled: true,
    priority: 880,
    conditions: [
      { field: 'hasIdSelector', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Avoid ID selectors - use classes for styling' }
    ],
    riskWeight: 15,
    tags: ['css', 'specificity', 'best-practices']
  },
  {
    id: 'css-011',
    name: 'Avoid !important',
    description: '!important should be avoided as it breaks cascade',
    type: 'architecture',
    enabled: true,
    priority: 920,
    conditions: [
      { field: 'hasImportant', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Avoid !important - refactor CSS to use proper specificity' }
    ],
    riskWeight: 25,
    tags: ['css', 'important', 'specificity']
  },
  {
    id: 'css-012',
    name: 'Limit Selector Depth',
    description: 'Deep selector nesting creates brittle CSS',
    type: 'architecture',
    enabled: true,
    priority: 800,
    conditions: [
      { field: 'selectorDepth', operator: 'greater_than', value: 3 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Selector nesting too deep (>3 levels) - use BEM or flat classes' }
    ],
    riskWeight: 12,
    tags: ['css', 'specificity', 'nesting']
  },

  // ============================================================================
  // CSS VARIABLE RULES
  // ============================================================================
  {
    id: 'css-020',
    name: 'Use CSS Variables for Colors',
    description: 'Color values should use CSS custom properties',
    type: 'ux',
    enabled: true,
    priority: 780,
    conditions: [
      { field: 'hasHardcodedColor', operator: 'equals', value: true },
      { field: 'usesCssVariables', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use CSS variables for colors (e.g., var(--color-primary))' }
    ],
    riskWeight: 8,
    tags: ['css', 'variables', 'colors', 'theming']
  },
  {
    id: 'css-021',
    name: 'Use CSS Variables for Spacing',
    description: 'Spacing values should use CSS custom properties',
    type: 'ux',
    enabled: true,
    priority: 760,
    conditions: [
      { field: 'hasHardcodedSpacing', operator: 'equals', value: true },
      { field: 'spacingValue', operator: 'greater_than', value: 8 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use CSS variables for spacing (e.g., var(--spacing-md))' }
    ],
    riskWeight: 6,
    tags: ['css', 'variables', 'spacing']
  },
  {
    id: 'css-022',
    name: 'Use CSS Variables for Typography',
    description: 'Typography values should use CSS custom properties',
    type: 'ux',
    enabled: true,
    priority: 770,
    conditions: [
      { field: 'hasHardcodedTypography', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use CSS variables for typography (e.g., var(--font-size-lg))' }
    ],
    riskWeight: 6,
    tags: ['css', 'variables', 'typography']
  },

  // ============================================================================
  // CSS NAMING RULES
  // ============================================================================
  {
    id: 'css-030',
    name: 'Use Semantic Class Names',
    description: 'Class names should describe purpose, not appearance',
    type: 'ux',
    enabled: true,
    priority: 720,
    conditions: [
      { field: 'hasNonSemanticName', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use semantic class names (e.g., .card-header not .blue-box)' }
    ],
    riskWeight: 8,
    tags: ['css', 'naming', 'semantics']
  },
  {
    id: 'css-031',
    name: 'Follow BEM Convention',
    description: 'Complex components should use BEM naming',
    type: 'architecture',
    enabled: true,
    priority: 700,
    conditions: [
      { field: 'isComplexComponent', operator: 'equals', value: true },
      { field: 'usesBEM', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Consider BEM naming for complex components (.block__element--modifier)' }
    ],
    riskWeight: 5,
    tags: ['css', 'naming', 'bem']
  },

  // ============================================================================
  // CSS UTILITY RULES
  // ============================================================================
  {
    id: 'css-040',
    name: 'Use Utility Classes When Available',
    description: 'Prefer utility classes over custom CSS when using utility framework',
    type: 'ux',
    enabled: true,
    priority: 740,
    conditions: [
      { field: 'hasUtilityFramework', operator: 'equals', value: true },
      { field: 'canUseUtility', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use utility class instead of custom CSS' }
    ],
    riskWeight: 5,
    tags: ['css', 'utilities', 'tailwind']
  },

  // ============================================================================
  // CSS PERFORMANCE RULES
  // ============================================================================
  {
    id: 'css-050',
    name: 'Avoid Universal Selectors',
    description: 'Universal selectors (*) have performance implications',
    type: 'architecture',
    enabled: true,
    priority: 820,
    conditions: [
      { field: 'hasUniversalSelector', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Avoid universal selectors (*) for performance' }
    ],
    riskWeight: 10,
    tags: ['css', 'performance', 'selectors']
  },
  {
    id: 'css-051',
    name: 'Limit Animation Complexity',
    description: 'Complex animations should be optimized',
    type: 'ux',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'hasComplexAnimation', operator: 'equals', value: true },
      { field: 'usesWillChange', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Complex animations should use will-change or transform for performance' }
    ],
    riskWeight: 8,
    tags: ['css', 'performance', 'animation']
  },

  // ============================================================================
  // CSS ACCESSIBILITY RULES
  // ============================================================================
  {
    id: 'css-060',
    name: 'Ensure Focus Visibility',
    description: 'Interactive elements must have visible focus styles',
    type: 'ux',
    enabled: true,
    priority: 900,
    conditions: [
      { field: 'isInteractiveElement', operator: 'equals', value: true },
      { field: 'hasFocusStyles', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Interactive elements need visible focus styles for accessibility' }
    ],
    riskWeight: 15,
    tags: ['css', 'accessibility', 'focus']
  },
  {
    id: 'css-061',
    name: 'Avoid Hiding Outline',
    description: 'outline: none without replacement is an accessibility issue',
    type: 'ux',
    enabled: true,
    priority: 880,
    conditions: [
      { field: 'removesOutline', operator: 'equals', value: true },
      { field: 'providesAlternativeFocus', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Do not hide outline without providing alternative focus indicator' }
    ],
    riskWeight: 20,
    tags: ['css', 'accessibility', 'outline', 'focus']
  },
  {
    id: 'css-062',
    name: 'Respect Reduced Motion',
    description: 'Animations should respect prefers-reduced-motion',
    type: 'ux',
    enabled: true,
    priority: 840,
    conditions: [
      { field: 'hasAnimation', operator: 'equals', value: true },
      { field: 'respectsReducedMotion', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Animations should respect @media (prefers-reduced-motion: reduce)' }
    ],
    riskWeight: 12,
    tags: ['css', 'accessibility', 'animation', 'motion']
  },

  // ============================================================================
  // CSS MAINTAINABILITY RULES
  // ============================================================================
  {
    id: 'css-070',
    name: 'Limit Rule Complexity',
    description: 'Rules with too many properties should be split',
    type: 'architecture',
    enabled: true,
    priority: 680,
    conditions: [
      { field: 'propertyCount', operator: 'greater_than', value: 15 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'CSS rule has too many properties (>15) - consider splitting into smaller rules' }
    ],
    riskWeight: 8,
    tags: ['css', 'maintainability', 'complexity']
  },
  {
    id: 'css-071',
    name: 'Remove Unused CSS',
    description: 'Detect and flag potentially unused CSS rules',
    type: 'architecture',
    enabled: true,
    priority: 650,
    conditions: [
      { field: 'isPotentiallyUnused', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'CSS rule may be unused - verify and remove if not needed' }
    ],
    riskWeight: 5,
    tags: ['css', 'unused', 'cleanup']
  },
  {
    id: 'css-072',
    name: 'Avoid Magic Numbers',
    description: 'Avoid unexplained numeric values in CSS',
    type: 'architecture',
    enabled: true,
    priority: 660,
    conditions: [
      { field: 'hasMagicNumbers', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Avoid magic numbers - use CSS variables or add comments explaining values' }
    ],
    riskWeight: 6,
    tags: ['css', 'maintainability', 'magic-numbers']
  }
];

export default cssRules;
