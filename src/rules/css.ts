/**
 * Enterprise Agent Supervisor - CSS Rules
 *
 * Comprehensive rules for CSS code quality, accessibility, performance,
 * maintainability, and modern best practices.
 */

import type { BusinessRule } from '../types/index.js';

export const cssRules: BusinessRule[] = [
  // ============================================================================
  // CSS ORGANIZATION RULES (css-001 to css-009)
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
  {
    id: 'css-004',
    name: 'Organize CSS by Component',
    description: 'CSS should be organized by component or feature',
    type: 'architecture',
    enabled: true,
    priority: 700,
    conditions: [
      { field: 'hasMixedConcerns', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'CSS mixes multiple components - organize by component/feature' }
    ],
    riskWeight: 8,
    tags: ['css', 'organization', 'architecture']
  },
  {
    id: 'css-005',
    name: 'Use CSS Layers for Cascade Control',
    description: 'Use @layer for better cascade control in large projects',
    type: 'architecture',
    enabled: true,
    priority: 650,
    conditions: [
      { field: 'isLargeStylesheet', operator: 'equals', value: true },
      { field: 'usesLayers', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Consider using @layer for cascade control in large stylesheets' }
    ],
    riskWeight: 5,
    tags: ['css', 'layers', 'cascade', 'modern']
  },

  // ============================================================================
  // CSS SPECIFICITY RULES (css-010 to css-019)
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
  {
    id: 'css-013',
    name: 'Avoid Chained Classes',
    description: 'Excessive class chaining increases specificity unnecessarily',
    type: 'architecture',
    enabled: true,
    priority: 780,
    conditions: [
      { field: 'chainedClassCount', operator: 'greater_than', value: 3 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Avoid chaining more than 3 classes - use a single descriptive class' }
    ],
    riskWeight: 10,
    tags: ['css', 'specificity', 'selectors']
  },
  {
    id: 'css-014',
    name: 'Use :where() for Low Specificity',
    description: 'Use :where() to reduce specificity when needed',
    type: 'architecture',
    enabled: true,
    priority: 680,
    conditions: [
      { field: 'needsLowSpecificity', operator: 'equals', value: true },
      { field: 'usesWhere', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Consider :where() for easily overridable defaults' }
    ],
    riskWeight: 5,
    tags: ['css', 'specificity', 'where', 'modern']
  },

  // ============================================================================
  // CSS VARIABLE RULES (css-020 to css-029)
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
  {
    id: 'css-023',
    name: 'Use CSS Variables for Shadows',
    description: 'Box shadows should use CSS custom properties',
    type: 'ux',
    enabled: true,
    priority: 740,
    conditions: [
      { field: 'hasHardcodedShadow', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use CSS variables for shadows (e.g., var(--shadow-md))' }
    ],
    riskWeight: 5,
    tags: ['css', 'variables', 'shadows']
  },
  {
    id: 'css-024',
    name: 'Use CSS Variables for Border Radius',
    description: 'Border radius values should be consistent',
    type: 'ux',
    enabled: true,
    priority: 730,
    conditions: [
      { field: 'hasHardcodedRadius', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use CSS variables for border-radius (e.g., var(--radius-md))' }
    ],
    riskWeight: 4,
    tags: ['css', 'variables', 'radius']
  },
  {
    id: 'css-025',
    name: 'Use CSS Variables for Transitions',
    description: 'Transition durations should be consistent',
    type: 'ux',
    enabled: true,
    priority: 720,
    conditions: [
      { field: 'hasHardcodedTransition', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use CSS variables for transitions (e.g., var(--transition-speed))' }
    ],
    riskWeight: 4,
    tags: ['css', 'variables', 'transitions', 'animation']
  },
  {
    id: 'css-026',
    name: 'Use CSS Variables for Z-Index',
    description: 'Z-index values should be managed centrally',
    type: 'architecture',
    enabled: true,
    priority: 800,
    conditions: [
      { field: 'hasHardcodedZIndex', operator: 'equals', value: true },
      { field: 'zIndexValue', operator: 'greater_than', value: 10 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use CSS variables for z-index to prevent stacking conflicts' }
    ],
    riskWeight: 10,
    tags: ['css', 'variables', 'z-index', 'stacking']
  },

  // ============================================================================
  // CSS NAMING RULES (css-030 to css-039)
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
  {
    id: 'css-032',
    name: 'Avoid Generic Class Names',
    description: 'Class names like .container, .wrapper should be namespaced',
    type: 'architecture',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'hasGenericClassName', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Avoid generic class names - namespace to prevent conflicts (.my-component__container)' }
    ],
    riskWeight: 8,
    tags: ['css', 'naming', 'conflicts']
  },
  {
    id: 'css-033',
    name: 'Consistent Naming Convention',
    description: 'Use consistent naming (kebab-case, camelCase, etc.)',
    type: 'architecture',
    enabled: true,
    priority: 680,
    conditions: [
      { field: 'hasMixedNamingConvention', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use consistent naming convention throughout the stylesheet' }
    ],
    riskWeight: 5,
    tags: ['css', 'naming', 'consistency']
  },

  // ============================================================================
  // CSS UTILITY RULES (css-040 to css-049)
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
  {
    id: 'css-041',
    name: 'Avoid Redundant Utility Combinations',
    description: 'Simplify utility class combinations',
    type: 'architecture',
    enabled: true,
    priority: 700,
    conditions: [
      { field: 'hasRedundantUtilities', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Simplify utility class combination or extract to component class' }
    ],
    riskWeight: 4,
    tags: ['css', 'utilities', 'simplification']
  },

  // ============================================================================
  // CSS PERFORMANCE RULES (css-050 to css-069)
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
  {
    id: 'css-052',
    name: 'Avoid Expensive Selectors',
    description: 'Attribute selectors and :nth-child can be slow',
    type: 'architecture',
    enabled: true,
    priority: 780,
    conditions: [
      { field: 'hasExpensiveSelector', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Complex attribute selectors can be slow - consider adding a class' }
    ],
    riskWeight: 8,
    tags: ['css', 'performance', 'selectors']
  },
  {
    id: 'css-053',
    name: 'Use transform for Animations',
    description: 'Prefer transform/opacity over layout-triggering properties',
    type: 'ux',
    enabled: true,
    priority: 800,
    conditions: [
      { field: 'animatesLayoutProperty', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Animating width/height/margin causes layout thrashing - use transform instead' }
    ],
    riskWeight: 12,
    tags: ['css', 'performance', 'animation', 'layout']
  },
  {
    id: 'css-054',
    name: 'Avoid Forced Reflows',
    description: 'Certain property combinations cause forced reflows',
    type: 'architecture',
    enabled: true,
    priority: 820,
    conditions: [
      { field: 'causesReflow', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'This CSS pattern may cause forced reflows - batch DOM reads/writes' }
    ],
    riskWeight: 10,
    tags: ['css', 'performance', 'reflow']
  },
  {
    id: 'css-055',
    name: 'Use contain for Paint Isolation',
    description: 'Use CSS containment for complex components',
    type: 'architecture',
    enabled: true,
    priority: 700,
    conditions: [
      { field: 'isComplexComponent', operator: 'equals', value: true },
      { field: 'usesContain', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Consider contain: layout style for paint isolation in complex components' }
    ],
    riskWeight: 5,
    tags: ['css', 'performance', 'contain', 'modern']
  },
  {
    id: 'css-056',
    name: 'Avoid box-shadow on Scroll',
    description: 'Large box-shadows during scroll hurt performance',
    type: 'ux',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'hasLargeShadow', operator: 'equals', value: true },
      { field: 'isScrollableContext', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Large box-shadows in scrollable areas hurt performance - consider alternatives' }
    ],
    riskWeight: 8,
    tags: ['css', 'performance', 'shadow', 'scroll']
  },
  {
    id: 'css-057',
    name: 'Limit filter/backdrop-filter Usage',
    description: 'Filters are GPU-intensive',
    type: 'ux',
    enabled: true,
    priority: 740,
    conditions: [
      { field: 'hasFilter', operator: 'equals', value: true },
      { field: 'filterCount', operator: 'greater_than', value: 2 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Multiple filters are GPU-intensive - use sparingly' }
    ],
    riskWeight: 8,
    tags: ['css', 'performance', 'filter', 'gpu']
  },
  {
    id: 'css-058',
    name: 'Use content-visibility for Offscreen Content',
    description: 'Improve render performance with content-visibility',
    type: 'architecture',
    enabled: true,
    priority: 680,
    conditions: [
      { field: 'isLongList', operator: 'equals', value: true },
      { field: 'usesContentVisibility', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Consider content-visibility: auto for offscreen content' }
    ],
    riskWeight: 5,
    tags: ['css', 'performance', 'content-visibility', 'modern']
  },

  // ============================================================================
  // CSS ACCESSIBILITY RULES (css-060 to css-079)
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
    tags: ['css', 'accessibility', 'focus', 'wcag']
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
    tags: ['css', 'accessibility', 'outline', 'focus', 'wcag']
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
    tags: ['css', 'accessibility', 'animation', 'motion', 'wcag']
  },
  {
    id: 'css-063',
    name: 'Ensure Color Contrast',
    description: 'Text must have sufficient color contrast (WCAG 2.1 AA)',
    type: 'ux',
    enabled: true,
    priority: 920,
    conditions: [
      { field: 'hasTextColor', operator: 'equals', value: true },
      { field: 'meetsContrastRatio', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'deny', message: 'Text color does not meet WCAG 2.1 AA contrast ratio (4.5:1 for normal text)' }
    ],
    riskWeight: 25,
    tags: ['css', 'accessibility', 'contrast', 'color', 'wcag']
  },
  {
    id: 'css-064',
    name: 'Minimum Touch Target Size',
    description: 'Touch targets should be at least 44x44px',
    type: 'ux',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'isInteractiveElement', operator: 'equals', value: true },
      { field: 'touchTargetSize', operator: 'less_than', value: 44 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Touch targets should be at least 44x44px for accessibility' }
    ],
    riskWeight: 12,
    tags: ['css', 'accessibility', 'touch', 'mobile', 'wcag']
  },
  {
    id: 'css-065',
    name: 'Avoid Text in Images',
    description: 'Text should not be embedded in background images',
    type: 'ux',
    enabled: true,
    priority: 800,
    conditions: [
      { field: 'hasBackgroundImage', operator: 'equals', value: true },
      { field: 'containsTextInImage', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Avoid text in background images - use real text for accessibility' }
    ],
    riskWeight: 10,
    tags: ['css', 'accessibility', 'images', 'text']
  },
  {
    id: 'css-066',
    name: 'Support High Contrast Mode',
    description: 'Ensure styles work in Windows High Contrast Mode',
    type: 'ux',
    enabled: true,
    priority: 780,
    conditions: [
      { field: 'usesCustomColors', operator: 'equals', value: true },
      { field: 'supportsHighContrast', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Consider @media (forced-colors: active) for High Contrast Mode support' }
    ],
    riskWeight: 8,
    tags: ['css', 'accessibility', 'high-contrast', 'wcag']
  },
  {
    id: 'css-067',
    name: 'Avoid display:none for Active Content',
    description: 'display:none hides content from screen readers',
    type: 'ux',
    enabled: true,
    priority: 820,
    conditions: [
      { field: 'hidesActiveContent', operator: 'equals', value: true },
      { field: 'usesDisplayNone', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'display:none hides from screen readers - use .visually-hidden if content should be accessible' }
    ],
    riskWeight: 10,
    tags: ['css', 'accessibility', 'screen-reader', 'hidden']
  },
  {
    id: 'css-068',
    name: 'Readable Line Length',
    description: 'Line length should be 45-75 characters for readability',
    type: 'ux',
    enabled: true,
    priority: 720,
    conditions: [
      { field: 'isTextContent', operator: 'equals', value: true },
      { field: 'lineLength', operator: 'greater_than', value: 80 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Limit line length to ~75 characters for readability (use max-width: 65ch)' }
    ],
    riskWeight: 6,
    tags: ['css', 'accessibility', 'readability', 'typography']
  },
  {
    id: 'css-069',
    name: 'Minimum Text Size',
    description: 'Body text should be at least 16px',
    type: 'ux',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'isBodyText', operator: 'equals', value: true },
      { field: 'fontSize', operator: 'less_than', value: 16 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Body text should be at least 16px (1rem) for readability' }
    ],
    riskWeight: 10,
    tags: ['css', 'accessibility', 'typography', 'font-size']
  },
  {
    id: 'css-070',
    name: 'Use focus-visible for Focus Styles',
    description: 'Use :focus-visible instead of :focus for better UX',
    type: 'ux',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'usesFocusPseudo', operator: 'equals', value: true },
      { field: 'usesFocusVisible', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Consider :focus-visible instead of :focus to show focus only for keyboard users' }
    ],
    riskWeight: 5,
    tags: ['css', 'accessibility', 'focus', 'focus-visible']
  },

  // ============================================================================
  // CSS RESPONSIVE DESIGN RULES (css-080 to css-089)
  // ============================================================================
  {
    id: 'css-080',
    name: 'Use Relative Units',
    description: 'Prefer rem/em over px for better accessibility',
    type: 'ux',
    enabled: true,
    priority: 760,
    conditions: [
      { field: 'usesPxForFontSize', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use rem/em instead of px for font-size to respect user preferences' }
    ],
    riskWeight: 8,
    tags: ['css', 'responsive', 'units', 'accessibility']
  },
  {
    id: 'css-081',
    name: 'Mobile-First Media Queries',
    description: 'Use min-width media queries for mobile-first approach',
    type: 'architecture',
    enabled: true,
    priority: 700,
    conditions: [
      { field: 'usesMaxWidthMediaQuery', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Consider mobile-first approach with min-width media queries' }
    ],
    riskWeight: 5,
    tags: ['css', 'responsive', 'mobile-first', 'media-queries']
  },
  {
    id: 'css-082',
    name: 'Use Fluid Typography',
    description: 'Use clamp() for responsive typography',
    type: 'ux',
    enabled: true,
    priority: 680,
    conditions: [
      { field: 'hasFixedFontSize', operator: 'equals', value: true },
      { field: 'usesClamp', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Consider clamp() for fluid typography (e.g., font-size: clamp(1rem, 2vw + 1rem, 2rem))' }
    ],
    riskWeight: 4,
    tags: ['css', 'responsive', 'typography', 'clamp', 'modern']
  },
  {
    id: 'css-083',
    name: 'Avoid Fixed Widths',
    description: 'Fixed widths break responsive design',
    type: 'ux',
    enabled: true,
    priority: 780,
    conditions: [
      { field: 'hasFixedWidth', operator: 'equals', value: true },
      { field: 'widthValue', operator: 'greater_than', value: 300 }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Avoid fixed widths on container elements - use max-width and percentages' }
    ],
    riskWeight: 10,
    tags: ['css', 'responsive', 'width', 'layout']
  },
  {
    id: 'css-084',
    name: 'Use Container Queries',
    description: 'Container queries for component-level responsiveness',
    type: 'architecture',
    enabled: true,
    priority: 650,
    conditions: [
      { field: 'isReusableComponent', operator: 'equals', value: true },
      { field: 'usesContainerQueries', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Consider @container queries for component-level responsive design' }
    ],
    riskWeight: 4,
    tags: ['css', 'responsive', 'container-queries', 'modern']
  },
  {
    id: 'css-085',
    name: 'Use Logical Properties',
    description: 'Logical properties support RTL layouts',
    type: 'ux',
    enabled: true,
    priority: 700,
    conditions: [
      { field: 'usesPhysicalProperties', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Consider logical properties (margin-inline, padding-block) for RTL support' }
    ],
    riskWeight: 5,
    tags: ['css', 'responsive', 'logical-properties', 'rtl', 'i18n']
  },
  {
    id: 'css-086',
    name: 'Responsive Images',
    description: 'Images should be responsive',
    type: 'ux',
    enabled: true,
    priority: 800,
    conditions: [
      { field: 'hasImageStyles', operator: 'equals', value: true },
      { field: 'imagesAreResponsive', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Add max-width: 100% and height: auto for responsive images' }
    ],
    riskWeight: 8,
    tags: ['css', 'responsive', 'images']
  },
  {
    id: 'css-087',
    name: 'Use aspect-ratio',
    description: 'Use aspect-ratio for consistent proportions',
    type: 'ux',
    enabled: true,
    priority: 680,
    conditions: [
      { field: 'usesPaddingHack', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use aspect-ratio instead of padding hack for aspect ratios' }
    ],
    riskWeight: 5,
    tags: ['css', 'responsive', 'aspect-ratio', 'modern']
  },

  // ============================================================================
  // CSS DARK MODE / THEMING RULES (css-090 to css-099)
  // ============================================================================
  {
    id: 'css-090',
    name: 'Support Color Scheme Preference',
    description: 'Support prefers-color-scheme for dark mode',
    type: 'ux',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'hasCustomColors', operator: 'equals', value: true },
      { field: 'supportsColorScheme', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Consider supporting @media (prefers-color-scheme: dark)' }
    ],
    riskWeight: 6,
    tags: ['css', 'dark-mode', 'color-scheme', 'theming']
  },
  {
    id: 'css-091',
    name: 'Use color-scheme Property',
    description: 'Set color-scheme for system UI elements',
    type: 'ux',
    enabled: true,
    priority: 700,
    conditions: [
      { field: 'supportsDarkMode', operator: 'equals', value: true },
      { field: 'usesColorScheme', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Add color-scheme: light dark for system UI elements in dark mode' }
    ],
    riskWeight: 4,
    tags: ['css', 'dark-mode', 'color-scheme']
  },
  {
    id: 'css-092',
    name: 'Dark Mode Contrast Check',
    description: 'Ensure dark mode maintains contrast ratios',
    type: 'ux',
    enabled: true,
    priority: 850,
    conditions: [
      { field: 'isDarkModeRule', operator: 'equals', value: true },
      { field: 'meetsDarkModeContrast', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Dark mode colors must maintain WCAG contrast ratios' }
    ],
    riskWeight: 12,
    tags: ['css', 'dark-mode', 'contrast', 'accessibility']
  },
  {
    id: 'css-093',
    name: 'Avoid Pure Black in Dark Mode',
    description: 'Pure black (#000) is harsh in dark mode',
    type: 'ux',
    enabled: true,
    priority: 680,
    conditions: [
      { field: 'isDarkModeRule', operator: 'equals', value: true },
      { field: 'usesPureBlack', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Avoid pure black (#000) in dark mode - use dark gray (#121212) for less eye strain' }
    ],
    riskWeight: 5,
    tags: ['css', 'dark-mode', 'colors', 'ux']
  },

  // ============================================================================
  // CSS MAINTAINABILITY RULES (css-100 to css-109)
  // ============================================================================
  {
    id: 'css-100',
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
    id: 'css-101',
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
    id: 'css-102',
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
  },
  {
    id: 'css-103',
    name: 'Avoid Vendor Prefixes',
    description: 'Use autoprefixer instead of manual vendor prefixes',
    type: 'architecture',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'hasVendorPrefix', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Avoid manual vendor prefixes - use autoprefixer in build process' }
    ],
    riskWeight: 6,
    tags: ['css', 'maintainability', 'vendor-prefix', 'build']
  },
  {
    id: 'css-104',
    name: 'Comment Complex Selectors',
    description: 'Complex selectors should have comments',
    type: 'architecture',
    enabled: true,
    priority: 640,
    conditions: [
      { field: 'hasComplexSelector', operator: 'equals', value: true },
      { field: 'hasComment', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Add comment explaining complex selector purpose' }
    ],
    riskWeight: 4,
    tags: ['css', 'maintainability', 'comments']
  },

  // ============================================================================
  // CSS PRINT RULES (css-110 to css-114)
  // ============================================================================
  {
    id: 'css-110',
    name: 'Consider Print Styles',
    description: 'Important pages should have print styles',
    type: 'ux',
    enabled: true,
    priority: 600,
    conditions: [
      { field: 'isPrintableContent', operator: 'equals', value: true },
      { field: 'hasPrintStyles', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Consider adding @media print styles for printable content' }
    ],
    riskWeight: 4,
    tags: ['css', 'print', 'media-queries']
  },
  {
    id: 'css-111',
    name: 'Hide Non-Essential Elements in Print',
    description: 'Navigation and ads should be hidden in print',
    type: 'ux',
    enabled: true,
    priority: 580,
    conditions: [
      { field: 'isPrintRule', operator: 'equals', value: true },
      { field: 'hidesNonEssential', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Hide navigation, ads, and interactive elements in print styles' }
    ],
    riskWeight: 3,
    tags: ['css', 'print', 'cleanup']
  },

  // ============================================================================
  // MODERN CSS RULES (css-120 to css-129)
  // ============================================================================
  {
    id: 'css-120',
    name: 'Use CSS Grid for Layouts',
    description: 'Prefer Grid over floats for complex layouts',
    type: 'architecture',
    enabled: true,
    priority: 720,
    conditions: [
      { field: 'usesFloatLayout', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use CSS Grid instead of floats for complex layouts' }
    ],
    riskWeight: 8,
    tags: ['css', 'grid', 'layout', 'modern']
  },
  {
    id: 'css-121',
    name: 'Use Flexbox for Alignment',
    description: 'Prefer Flexbox for alignment tasks',
    type: 'architecture',
    enabled: true,
    priority: 700,
    conditions: [
      { field: 'usesOldAlignmentHacks', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use Flexbox for vertical centering and alignment' }
    ],
    riskWeight: 6,
    tags: ['css', 'flexbox', 'alignment', 'modern']
  },
  {
    id: 'css-122',
    name: 'Use gap Instead of Margins',
    description: 'Use gap property for spacing in flex/grid',
    type: 'architecture',
    enabled: true,
    priority: 680,
    conditions: [
      { field: 'usesFlexOrGrid', operator: 'equals', value: true },
      { field: 'usesMarginForGap', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use gap property instead of margins for spacing in flex/grid' }
    ],
    riskWeight: 5,
    tags: ['css', 'gap', 'flexbox', 'grid', 'modern']
  },
  {
    id: 'css-123',
    name: 'Use CSS Custom Properties',
    description: 'Use CSS variables for dynamic theming',
    type: 'architecture',
    enabled: true,
    priority: 750,
    conditions: [
      { field: 'hasRepeatedValue', operator: 'equals', value: true },
      { field: 'usesCssVariables', operator: 'not_equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Extract repeated values into CSS custom properties' }
    ],
    riskWeight: 6,
    tags: ['css', 'variables', 'custom-properties', 'modern']
  },
  {
    id: 'css-124',
    name: 'Use min()/max()/clamp()',
    description: 'Use comparison functions for responsive values',
    type: 'ux',
    enabled: true,
    priority: 660,
    conditions: [
      { field: 'hasMediaQueryForSize', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Consider min()/max()/clamp() instead of media queries for responsive sizing' }
    ],
    riskWeight: 4,
    tags: ['css', 'responsive', 'clamp', 'modern']
  },
  {
    id: 'css-125',
    name: 'Use :is() for Grouping',
    description: 'Use :is() to reduce selector repetition',
    type: 'architecture',
    enabled: true,
    priority: 640,
    conditions: [
      { field: 'hasRepetitiveSelectorGroups', operator: 'equals', value: true }
    ],
    conditionLogic: 'all',
    actions: [
      { type: 'warn', message: 'Use :is() pseudo-class to group and simplify selectors' }
    ],
    riskWeight: 3,
    tags: ['css', 'selectors', 'is', 'modern']
  }
];

export default cssRules;
