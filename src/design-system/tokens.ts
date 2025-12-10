/**
 * Enterprise Agent Supervisor - Design System Tokens
 *
 * These tokens define the design language that css_eval uses to suggest
 * consistent styles. When a user writes CSS with hardcoded values,
 * the analyzer will suggest using these variables instead.
 */

export interface DesignToken {
  name: string;
  value: string;
  category: 'color' | 'spacing' | 'radius' | 'shadow' | 'typography' | 'z-index' | 'transition' | 'breakpoint' | 'easing' | 'border' | 'font-size' | 'line-height';
  description: string;
  aliases?: string[];
  usage?: string[];
}

/**
 * Color tokens - backgrounds, text, accents, semantic colors
 */
export const colorTokens: DesignToken[] = [
  // Backgrounds - Light Mode
  { name: '--bg-primary', value: '#f5f5f3', category: 'color', description: 'Main page background', usage: ['body', 'main', 'page'] },
  { name: '--bg-secondary', value: '#fafafa', category: 'color', description: 'Card/surface background', usage: ['card', 'surface', 'panel'] },
  { name: '--bg-elevated', value: '#ffffff', category: 'color', description: 'Elevated elements', usage: ['modal', 'dropdown', 'popover'] },
  { name: '--bg-subtle', value: '#ebebea', category: 'color', description: 'Subtle containers', usage: ['container', 'section'], aliases: ['--bg-tertiary'] },
  { name: '--bg-muted', value: '#e0e0de', category: 'color', description: 'Muted backgrounds', usage: ['disabled', 'skeleton'] },
  { name: '--bg-inverse', value: '#2a2a2a', category: 'color', description: 'Inverse background (dark)', usage: ['tooltip', 'dark-section'] },

  // Text - Light Mode
  { name: '--text-primary', value: '#2a2a2a', category: 'color', description: 'Primary text', usage: ['heading', 'body', 'label'] },
  { name: '--text-secondary', value: '#5a5a5a', category: 'color', description: 'Secondary text', usage: ['description', 'subtitle'] },
  { name: '--text-tertiary', value: '#8a8a8a', category: 'color', description: 'Tertiary/label text', usage: ['label', 'caption', 'placeholder'] },
  { name: '--text-muted', value: '#9a9a9a', category: 'color', description: 'Muted/disabled text', usage: ['disabled', 'hint'] },
  { name: '--text-inverse', value: '#ffffff', category: 'color', description: 'Text on dark backgrounds', usage: ['inverse'] },
  { name: '--text-link', value: '#6b7c93', category: 'color', description: 'Link text color', usage: ['link', 'anchor'] },
  { name: '--text-link-hover', value: '#5a6a7f', category: 'color', description: 'Link hover color', usage: ['link:hover'] },

  // Accents
  { name: '--accent-primary', value: '#6b7c93', category: 'color', description: 'Primary accent (slate blue)', usage: ['button', 'link', 'focus'], aliases: ['--accent'] },
  { name: '--accent-primary-hover', value: '#5a6a7f', category: 'color', description: 'Accent hover state', usage: ['button:hover'], aliases: ['--accent-hover'] },
  { name: '--accent-primary-active', value: '#4a5a6f', category: 'color', description: 'Accent active state', usage: ['button:active'] },
  { name: '--accent-secondary', value: '#8b9aaf', category: 'color', description: 'Secondary accent', usage: ['highlight', 'selection'] },
  { name: '--accent-subtle', value: '#e8ecf0', category: 'color', description: 'Subtle accent background', usage: ['badge', 'tag'] },
  { name: '--accent-muted', value: '#d0d8e0', category: 'color', description: 'Muted accent', usage: ['disabled-button'] },

  // Semantic - Success
  { name: '--success', value: '#7a9678', category: 'color', description: 'Success state', usage: ['success', 'valid', 'complete'] },
  { name: '--success-bg', value: '#f0f4f0', category: 'color', description: 'Success background', usage: ['success-message'] },
  { name: '--success-border', value: '#c5d4c3', category: 'color', description: 'Success border', usage: ['success-alert'] },
  { name: '--success-text', value: '#4a6848', category: 'color', description: 'Success text', usage: ['success-message'] },

  // Semantic - Warning
  { name: '--warning', value: '#b8956f', category: 'color', description: 'Warning state', usage: ['warning', 'caution'] },
  { name: '--warning-bg', value: '#fdf8f3', category: 'color', description: 'Warning background', usage: ['warning-message'] },
  { name: '--warning-border', value: '#e0c9a8', category: 'color', description: 'Warning border', usage: ['warning-alert'] },
  { name: '--warning-text', value: '#8a6d4a', category: 'color', description: 'Warning text', usage: ['warning-message'] },

  // Semantic - Danger/Error
  { name: '--danger', value: '#b87b7b', category: 'color', description: 'Danger/error state', usage: ['error', 'danger', 'delete'] },
  { name: '--danger-bg', value: '#fdf5f5', category: 'color', description: 'Danger background', usage: ['error-message'] },
  { name: '--danger-border', value: '#e0c0c0', category: 'color', description: 'Danger border', usage: ['error-alert'] },
  { name: '--danger-text', value: '#8a5a5a', category: 'color', description: 'Danger text', usage: ['error-message'] },

  // Semantic - Info
  { name: '--info', value: '#3b82f6', category: 'color', description: 'Informational state', usage: ['info', 'notice'] },
  { name: '--info-bg', value: '#eff6ff', category: 'color', description: 'Info background', usage: ['info-message'] },
  { name: '--info-border', value: '#bfdbfe', category: 'color', description: 'Info border', usage: ['info-alert'] },
  { name: '--info-text', value: '#1e40af', category: 'color', description: 'Info text', usage: ['info-message'] },

  // Borders
  { name: '--border-primary', value: '#e5e5e3', category: 'color', description: 'Primary border', usage: ['border', 'divider'], aliases: ['--border'] },
  { name: '--border-secondary', value: '#d5d5d3', category: 'color', description: 'Stronger border', usage: ['border:hover'], aliases: ['--border-hover'] },
  { name: '--border-subtle', value: '#f0f0ee', category: 'color', description: 'Subtle divider', usage: ['separator'] },
  { name: '--border-focus', value: '#6b7c93', category: 'color', description: 'Focus ring', usage: ['focus'] },

  // Dark Mode Colors
  { name: '--dark-bg-primary', value: '#1a1a1a', category: 'color', description: 'Dark mode page background', usage: ['body-dark'] },
  { name: '--dark-bg-secondary', value: '#242424', category: 'color', description: 'Dark mode surface', usage: ['card-dark'] },
  { name: '--dark-bg-elevated', value: '#2d2d2d', category: 'color', description: 'Dark mode elevated', usage: ['modal-dark'] },
  { name: '--dark-text-primary', value: '#f0f0f0', category: 'color', description: 'Dark mode primary text', usage: ['heading-dark'] },
  { name: '--dark-text-secondary', value: '#b0b0b0', category: 'color', description: 'Dark mode secondary text', usage: ['body-dark'] },
  { name: '--dark-border', value: '#3a3a3a', category: 'color', description: 'Dark mode border', usage: ['border-dark'] },
];

/**
 * Spacing tokens - margins, paddings, gaps
 */
export const spacingTokens: DesignToken[] = [
  { name: '--space-0', value: '0', category: 'spacing', description: 'No spacing', usage: ['reset'] },
  { name: '--space-px', value: '1px', category: 'spacing', description: 'Hairline spacing', usage: ['border-spacing'] },
  { name: '--space-0.5', value: '2px', category: 'spacing', description: 'Micro spacing', usage: ['icon-gap'] },
  { name: '--space-1', value: '4px', category: 'spacing', description: 'Tiny spacing', usage: ['inline-gap'] },
  { name: '--space-2', value: '8px', category: 'spacing', description: 'Extra small spacing', usage: ['gap-tight', 'padding-small'], aliases: ['--space-xs'] },
  { name: '--space-3', value: '12px', category: 'spacing', description: 'Small spacing', usage: ['gap', 'padding'], aliases: ['--space-sm'] },
  { name: '--space-4', value: '16px', category: 'spacing', description: 'Medium spacing (default)', usage: ['gap', 'padding', 'margin'], aliases: ['--space-md'] },
  { name: '--space-5', value: '20px', category: 'spacing', description: 'Medium-large spacing', usage: ['section-gap'] },
  { name: '--space-6', value: '24px', category: 'spacing', description: 'Large spacing', usage: ['section-gap', 'padding-large'], aliases: ['--space-lg'] },
  { name: '--space-8', value: '32px', category: 'spacing', description: 'Extra large spacing', usage: ['section-margin'], aliases: ['--space-xl'] },
  { name: '--space-10', value: '40px', category: 'spacing', description: '2x large spacing', usage: ['page-section'] },
  { name: '--space-12', value: '48px', category: 'spacing', description: '3x large spacing', usage: ['page-section'], aliases: ['--space-2xl'] },
  { name: '--space-16', value: '64px', category: 'spacing', description: '4x large spacing', usage: ['hero-section'], aliases: ['--space-3xl'] },
  { name: '--space-20', value: '80px', category: 'spacing', description: '5x large spacing', usage: ['page-margin'] },
  { name: '--space-24', value: '96px', category: 'spacing', description: '6x large spacing', usage: ['hero-margin'] },
];

/**
 * Font size tokens
 */
export const fontSizeTokens: DesignToken[] = [
  { name: '--text-xs', value: '12px', category: 'font-size', description: 'Extra small text', usage: ['caption', 'label-small'], aliases: ['--font-size-xs'] },
  { name: '--text-sm', value: '14px', category: 'font-size', description: 'Small text', usage: ['label', 'helper-text'], aliases: ['--font-size-sm'] },
  { name: '--text-base', value: '16px', category: 'font-size', description: 'Base text size', usage: ['body', 'paragraph'], aliases: ['--font-size-base', '--font-size-md'] },
  { name: '--text-lg', value: '18px', category: 'font-size', description: 'Large text', usage: ['lead', 'subtitle'], aliases: ['--font-size-lg'] },
  { name: '--text-xl', value: '20px', category: 'font-size', description: 'Extra large text', usage: ['heading-small'], aliases: ['--font-size-xl'] },
  { name: '--text-2xl', value: '24px', category: 'font-size', description: '2x large text', usage: ['h4', 'card-title'], aliases: ['--font-size-2xl'] },
  { name: '--text-3xl', value: '30px', category: 'font-size', description: '3x large text', usage: ['h3'], aliases: ['--font-size-3xl'] },
  { name: '--text-4xl', value: '36px', category: 'font-size', description: '4x large text', usage: ['h2'], aliases: ['--font-size-4xl'] },
  { name: '--text-5xl', value: '48px', category: 'font-size', description: '5x large text', usage: ['h1'], aliases: ['--font-size-5xl'] },
  { name: '--text-6xl', value: '60px', category: 'font-size', description: '6x large text', usage: ['display'], aliases: ['--font-size-6xl'] },
  { name: '--text-7xl', value: '72px', category: 'font-size', description: '7x large text', usage: ['hero'], aliases: ['--font-size-7xl'] },
];

/**
 * Line height tokens
 */
export const lineHeightTokens: DesignToken[] = [
  { name: '--leading-none', value: '1', category: 'line-height', description: 'No line height', usage: ['icon', 'single-line'] },
  { name: '--leading-tight', value: '1.25', category: 'line-height', description: 'Tight line height', usage: ['heading'] },
  { name: '--leading-snug', value: '1.375', category: 'line-height', description: 'Snug line height', usage: ['heading-small'] },
  { name: '--leading-normal', value: '1.5', category: 'line-height', description: 'Normal line height', usage: ['body', 'paragraph'] },
  { name: '--leading-relaxed', value: '1.625', category: 'line-height', description: 'Relaxed line height', usage: ['readable-text'] },
  { name: '--leading-loose', value: '2', category: 'line-height', description: 'Loose line height', usage: ['spaced-text'] },
];

/**
 * Border radius tokens
 */
export const radiusTokens: DesignToken[] = [
  { name: '--radius-none', value: '0', category: 'radius', description: 'No radius', usage: ['sharp-corners'] },
  { name: '--radius-xs', value: '2px', category: 'radius', description: 'Extra small radius', usage: ['small-chip'] },
  { name: '--radius-sm', value: '4px', category: 'radius', description: 'Small radius', usage: ['tag', 'badge'] },
  { name: '--radius-md', value: '6px', category: 'radius', description: 'Medium radius', usage: ['button', 'input'], aliases: ['--radius'] },
  { name: '--radius-lg', value: '8px', category: 'radius', description: 'Large radius', usage: ['card', 'modal'] },
  { name: '--radius-xl', value: '12px', category: 'radius', description: 'Extra large radius', usage: ['panel', 'dialog'] },
  { name: '--radius-2xl', value: '16px', category: 'radius', description: '2x large radius', usage: ['hero', 'feature-card'] },
  { name: '--radius-3xl', value: '24px', category: 'radius', description: '3x large radius', usage: ['large-card'] },
  { name: '--radius-full', value: '9999px', category: 'radius', description: 'Full/pill radius', usage: ['pill', 'avatar', 'circle'] },
];

/**
 * Border width tokens
 */
export const borderWidthTokens: DesignToken[] = [
  { name: '--border-0', value: '0', category: 'border', description: 'No border', usage: ['borderless'] },
  { name: '--border-1', value: '1px', category: 'border', description: 'Default border', usage: ['border', 'divider'], aliases: ['--border-width'] },
  { name: '--border-2', value: '2px', category: 'border', description: 'Medium border', usage: ['focus-ring', 'emphasis'] },
  { name: '--border-4', value: '4px', category: 'border', description: 'Thick border', usage: ['accent-border'] },
  { name: '--border-8', value: '8px', category: 'border', description: 'Extra thick border', usage: ['decorative'] },
];

/**
 * Shadow tokens
 */
export const shadowTokens: DesignToken[] = [
  { name: '--shadow-none', value: 'none', category: 'shadow', description: 'No shadow', usage: ['flat'] },
  { name: '--shadow-xs', value: '0 1px 2px rgba(0, 0, 0, 0.04)', category: 'shadow', description: 'Extra small shadow', usage: ['subtle'] },
  { name: '--shadow-sm', value: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)', category: 'shadow', description: 'Small shadow', usage: ['input', 'button'] },
  { name: '--shadow-md', value: '0 4px 6px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.04)', category: 'shadow', description: 'Medium shadow', usage: ['card', 'dropdown'] },
  { name: '--shadow-lg', value: '0 10px 15px rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.04)', category: 'shadow', description: 'Large shadow', usage: ['modal', 'popover'] },
  { name: '--shadow-xl', value: '0 20px 25px rgba(0, 0, 0, 0.10), 0 10px 10px rgba(0, 0, 0, 0.04)', category: 'shadow', description: 'Extra large shadow', usage: ['dialog'] },
  { name: '--shadow-2xl', value: '0 25px 50px rgba(0, 0, 0, 0.15)', category: 'shadow', description: '2x large shadow', usage: ['floating'] },
  { name: '--shadow-inner', value: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)', category: 'shadow', description: 'Inner shadow', usage: ['pressed', 'inset'] },
  { name: '--shadow-focus', value: '0 0 0 3px rgba(107, 124, 147, 0.25)', category: 'shadow', description: 'Focus ring shadow', usage: ['focus'] },
];

/**
 * Typography weight tokens
 */
export const typographyTokens: DesignToken[] = [
  { name: '--font-thin', value: '100', category: 'typography', description: 'Thin weight', usage: ['display'] },
  { name: '--font-extralight', value: '200', category: 'typography', description: 'Extra light weight', usage: ['large-display'] },
  { name: '--font-light', value: '300', category: 'typography', description: 'Light weight', usage: ['subtle-text'] },
  { name: '--font-normal', value: '400', category: 'typography', description: 'Normal weight', usage: ['body'] },
  { name: '--font-medium', value: '500', category: 'typography', description: 'Medium weight', usage: ['label', 'button'] },
  { name: '--font-semibold', value: '600', category: 'typography', description: 'Semibold weight', usage: ['heading', 'emphasis'] },
  { name: '--font-bold', value: '700', category: 'typography', description: 'Bold weight', usage: ['strong', 'heading'] },
  { name: '--font-extrabold', value: '800', category: 'typography', description: 'Extra bold weight', usage: ['display-heading'] },
  { name: '--font-black', value: '900', category: 'typography', description: 'Black weight', usage: ['hero-heading'] },
];

/**
 * Z-index tokens
 */
export const zIndexTokens: DesignToken[] = [
  { name: '--z-auto', value: 'auto', category: 'z-index', description: 'Auto z-index', usage: ['default'] },
  { name: '--z-0', value: '0', category: 'z-index', description: 'Base layer', usage: ['background'] },
  { name: '--z-10', value: '10', category: 'z-index', description: 'Slightly elevated', usage: ['sticky-header'] },
  { name: '--z-20', value: '20', category: 'z-index', description: 'Low elevation', usage: ['fixed-element'] },
  { name: '--z-30', value: '30', category: 'z-index', description: 'Medium-low elevation', usage: ['sidebar'] },
  { name: '--z-40', value: '40', category: 'z-index', description: 'Medium elevation', usage: ['header'] },
  { name: '--z-50', value: '50', category: 'z-index', description: 'Medium-high elevation', usage: ['navigation'] },
  { name: '--z-dropdown', value: '1000', category: 'z-index', description: 'Dropdowns', usage: ['dropdown', 'menu'] },
  { name: '--z-sticky', value: '1100', category: 'z-index', description: 'Sticky elements', usage: ['sticky'] },
  { name: '--z-fixed', value: '1200', category: 'z-index', description: 'Fixed elements', usage: ['fixed'] },
  { name: '--z-backdrop', value: '1300', category: 'z-index', description: 'Modal backdrop', usage: ['overlay'] },
  { name: '--z-modal', value: '1400', category: 'z-index', description: 'Modals', usage: ['modal', 'dialog'] },
  { name: '--z-popover', value: '1500', category: 'z-index', description: 'Popovers', usage: ['popover', 'tooltip'] },
  { name: '--z-toast', value: '1600', category: 'z-index', description: 'Toasts/notifications', usage: ['toast', 'alert'] },
  { name: '--z-max', value: '9999', category: 'z-index', description: 'Maximum z-index', usage: ['critical'] },
];

/**
 * Transition duration tokens
 */
export const transitionTokens: DesignToken[] = [
  { name: '--duration-0', value: '0ms', category: 'transition', description: 'No duration', usage: ['instant'] },
  { name: '--duration-75', value: '75ms', category: 'transition', description: 'Ultra fast', usage: ['micro-interaction'] },
  { name: '--duration-100', value: '100ms', category: 'transition', description: 'Very fast', usage: ['hover-feedback'] },
  { name: '--duration-150', value: '150ms', category: 'transition', description: 'Fast', usage: ['quick-transition'] },
  { name: '--duration-200', value: '200ms', category: 'transition', description: 'Normal', usage: ['hover', 'focus', 'state-change'], aliases: ['--transition-speed'] },
  { name: '--duration-300', value: '300ms', category: 'transition', description: 'Medium', usage: ['expand', 'collapse'] },
  { name: '--duration-500', value: '500ms', category: 'transition', description: 'Slow', usage: ['page-transition'] },
  { name: '--duration-700', value: '700ms', category: 'transition', description: 'Very slow', usage: ['complex-animation'] },
  { name: '--duration-1000', value: '1000ms', category: 'transition', description: 'Extra slow', usage: ['dramatic-effect'] },
];

/**
 * Easing function tokens
 */
export const easingTokens: DesignToken[] = [
  { name: '--ease-linear', value: 'linear', category: 'easing', description: 'Linear easing', usage: ['progress-bar'] },
  { name: '--ease-in', value: 'cubic-bezier(0.4, 0, 1, 1)', category: 'easing', description: 'Ease in (accelerate)', usage: ['exit-animation'] },
  { name: '--ease-out', value: 'cubic-bezier(0, 0, 0.2, 1)', category: 'easing', description: 'Ease out (decelerate)', usage: ['enter-animation'] },
  { name: '--ease-in-out', value: 'cubic-bezier(0.4, 0, 0.2, 1)', category: 'easing', description: 'Ease in-out', usage: ['default-animation'] },
  { name: '--ease-bounce', value: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', category: 'easing', description: 'Bouncy easing', usage: ['playful-animation'] },
  { name: '--ease-spring', value: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', category: 'easing', description: 'Spring easing', usage: ['spring-animation'] },
];

/**
 * Breakpoint tokens (for reference, not actual CSS values)
 */
export const breakpointTokens: DesignToken[] = [
  { name: '--breakpoint-xs', value: '320px', category: 'breakpoint', description: 'Extra small screens (mobile)', usage: ['mobile-small'] },
  { name: '--breakpoint-sm', value: '640px', category: 'breakpoint', description: 'Small screens (mobile)', usage: ['mobile'] },
  { name: '--breakpoint-md', value: '768px', category: 'breakpoint', description: 'Medium screens (tablet)', usage: ['tablet'] },
  { name: '--breakpoint-lg', value: '1024px', category: 'breakpoint', description: 'Large screens (laptop)', usage: ['laptop'] },
  { name: '--breakpoint-xl', value: '1280px', category: 'breakpoint', description: 'Extra large screens (desktop)', usage: ['desktop'] },
  { name: '--breakpoint-2xl', value: '1536px', category: 'breakpoint', description: '2x large screens (large desktop)', usage: ['large-desktop'] },
];

/**
 * All design tokens combined
 */
export const allTokens: DesignToken[] = [
  ...colorTokens,
  ...spacingTokens,
  ...fontSizeTokens,
  ...lineHeightTokens,
  ...radiusTokens,
  ...borderWidthTokens,
  ...shadowTokens,
  ...typographyTokens,
  ...zIndexTokens,
  ...transitionTokens,
  ...easingTokens,
  ...breakpointTokens,
];

/**
 * Value to token mapping for quick lookups
 */
export const valueToTokenMap: Map<string, DesignToken[]> = new Map();

// Build the reverse lookup map
allTokens.forEach(token => {
  const existing = valueToTokenMap.get(token.value) || [];
  existing.push(token);
  valueToTokenMap.set(token.value, existing);
});

/**
 * Find matching design token for a CSS value
 */
export function findMatchingToken(value: string, _property?: string): DesignToken | null {
  // Direct match
  const directMatch = valueToTokenMap.get(value);
  if (directMatch && directMatch.length > 0) {
    return directMatch[0];
  }

  // Normalize and try again
  const normalized = value.toLowerCase().trim();
  for (const [tokenValue, tokens] of valueToTokenMap) {
    if (tokenValue.toLowerCase() === normalized) {
      return tokens[0];
    }
  }

  // Check for similar colors (hex normalization)
  if (value.startsWith('#')) {
    const normalizedHex = normalizeHex(value);
    for (const token of colorTokens) {
      if (normalizeHex(token.value) === normalizedHex) {
        return token;
      }
    }
  }

  return null;
}

/**
 * Suggest a token for a hardcoded value
 */
export function suggestToken(value: string, property: string): { token: DesignToken; confidence: number } | null {
  // Try direct match first
  const direct = findMatchingToken(value, property);
  if (direct) {
    return { token: direct, confidence: 1.0 };
  }

  // Check for close color matches
  if (isColorValue(value)) {
    const closestColor = findClosestColorToken(value);
    if (closestColor) {
      return closestColor;
    }
  }

  // Check for font-size values
  if (property.includes('font-size') || property === 'font') {
    const closestFontSize = findClosestFontSizeToken(value);
    if (closestFontSize) {
      return closestFontSize;
    }
  }

  // Check for spacing values
  if (isSpacingProperty(property)) {
    const closestSpacing = findClosestSpacingToken(value);
    if (closestSpacing) {
      return closestSpacing;
    }
  }

  // Check for radius values
  if (property.includes('radius')) {
    const closestRadius = findClosestRadiusToken(value);
    if (closestRadius) {
      return closestRadius;
    }
  }

  // Check for z-index values
  if (property === 'z-index') {
    const closestZIndex = findClosestZIndexToken(value);
    if (closestZIndex) {
      return closestZIndex;
    }
  }

  // Check for transition duration values
  if (property.includes('transition') || property.includes('animation') || property.includes('duration')) {
    const closestDuration = findClosestDurationToken(value);
    if (closestDuration) {
      return closestDuration;
    }
  }

  return null;
}

/**
 * Get recommended token for a property type
 */
export function getRecommendedTokens(propertyType: 'background' | 'color' | 'border' | 'spacing' | 'radius' | 'shadow' | 'font-size' | 'z-index' | 'transition'): DesignToken[] {
  switch (propertyType) {
    case 'background':
      return colorTokens.filter(t => t.name.includes('bg-'));
    case 'color':
      return colorTokens.filter(t => t.name.includes('text-') || t.name.includes('accent'));
    case 'border':
      return colorTokens.filter(t => t.name.includes('border'));
    case 'spacing':
      return spacingTokens;
    case 'radius':
      return radiusTokens;
    case 'shadow':
      return shadowTokens;
    case 'font-size':
      return fontSizeTokens;
    case 'z-index':
      return zIndexTokens;
    case 'transition':
      return transitionTokens;
    default:
      return [];
  }
}

// Helper functions
function normalizeHex(hex: string): string {
  let h = hex.replace('#', '').toLowerCase();
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('');
  }
  return h;
}

function isColorValue(value: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ||
         /^rgb\(|^rgba\(|^hsl\(|^hsla\(/.test(value);
}

function isSpacingProperty(property: string): boolean {
  return ['margin', 'padding', 'gap', 'top', 'right', 'bottom', 'left', 'width', 'height', 'inset']
    .some(p => property.includes(p));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = normalizeHex(hex);
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function colorDistance(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

function findClosestColorToken(value: string): { token: DesignToken; confidence: number } | null {
  if (!value.startsWith('#')) return null;

  const inputRgb = hexToRgb(value);
  if (!inputRgb) return null;

  let closest: { token: DesignToken; distance: number } | null = null;

  for (const token of colorTokens) {
    if (!token.value.startsWith('#')) continue;
    const tokenRgb = hexToRgb(token.value);
    if (!tokenRgb) continue;

    const distance = colorDistance(inputRgb, tokenRgb);
    if (!closest || distance < closest.distance) {
      closest = { token, distance };
    }
  }

  // Only suggest if reasonably close (distance < 50)
  if (closest && closest.distance < 50) {
    const confidence = Math.max(0, 1 - (closest.distance / 100));
    return { token: closest.token, confidence };
  }

  return null;
}

function parsePixelValue(value: string): number | null {
  const match = value.match(/^(\d+(?:\.\d+)?)(px|rem|em)?$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const unit = match[2] || 'px';
  if (unit === 'rem' || unit === 'em') {
    return num * 16; // Assume 16px base
  }
  return num;
}

function findClosestSpacingToken(value: string): { token: DesignToken; confidence: number } | null {
  const inputPx = parsePixelValue(value);
  if (inputPx === null) return null;

  let closest: { token: DesignToken; diff: number } | null = null;

  for (const token of spacingTokens) {
    const tokenPx = parsePixelValue(token.value);
    if (tokenPx === null) continue;

    const diff = Math.abs(inputPx - tokenPx);
    if (!closest || diff < closest.diff) {
      closest = { token, diff };
    }
  }

  // Only suggest if very close (within 4px)
  if (closest && closest.diff <= 4) {
    const confidence = Math.max(0, 1 - (closest.diff / 8));
    return { token: closest.token, confidence };
  }

  return null;
}

function findClosestRadiusToken(value: string): { token: DesignToken; confidence: number } | null {
  const inputPx = parsePixelValue(value);
  if (inputPx === null) return null;

  let closest: { token: DesignToken; diff: number } | null = null;

  for (const token of radiusTokens) {
    const tokenPx = parsePixelValue(token.value);
    if (tokenPx === null) continue;

    const diff = Math.abs(inputPx - tokenPx);
    if (!closest || diff < closest.diff) {
      closest = { token, diff };
    }
  }

  // Only suggest if close (within 2px)
  if (closest && closest.diff <= 2) {
    const confidence = Math.max(0, 1 - (closest.diff / 4));
    return { token: closest.token, confidence };
  }

  return null;
}

function findClosestFontSizeToken(value: string): { token: DesignToken; confidence: number } | null {
  const inputPx = parsePixelValue(value);
  if (inputPx === null) return null;

  let closest: { token: DesignToken; diff: number } | null = null;

  for (const token of fontSizeTokens) {
    const tokenPx = parsePixelValue(token.value);
    if (tokenPx === null) continue;

    const diff = Math.abs(inputPx - tokenPx);
    if (!closest || diff < closest.diff) {
      closest = { token, diff };
    }
  }

  // Only suggest if close (within 2px)
  if (closest && closest.diff <= 2) {
    const confidence = Math.max(0, 1 - (closest.diff / 4));
    return { token: closest.token, confidence };
  }

  return null;
}

function findClosestZIndexToken(value: string): { token: DesignToken; confidence: number } | null {
  const inputVal = parseInt(value);
  if (isNaN(inputVal)) return null;

  let closest: { token: DesignToken; diff: number } | null = null;

  for (const token of zIndexTokens) {
    if (token.value === 'auto') continue;
    const tokenVal = parseInt(token.value);
    if (isNaN(tokenVal)) continue;

    const diff = Math.abs(inputVal - tokenVal);
    if (!closest || diff < closest.diff) {
      closest = { token, diff };
    }
  }

  // Only suggest exact or very close matches
  if (closest && closest.diff <= 5) {
    const confidence = closest.diff === 0 ? 1.0 : 0.8;
    return { token: closest.token, confidence };
  }

  return null;
}

function findClosestDurationToken(value: string): { token: DesignToken; confidence: number } | null {
  // Parse ms or s values
  const match = value.match(/^(\d+(?:\.\d+)?)(ms|s)?$/);
  if (!match) return null;

  let ms = parseFloat(match[1]);
  const unit = match[2] || 'ms';
  if (unit === 's') {
    ms = ms * 1000;
  }

  let closest: { token: DesignToken; diff: number } | null = null;

  for (const token of transitionTokens) {
    const tokenMatch = token.value.match(/^(\d+)(ms)?$/);
    if (!tokenMatch) continue;
    const tokenMs = parseInt(tokenMatch[1]);

    const diff = Math.abs(ms - tokenMs);
    if (!closest || diff < closest.diff) {
      closest = { token, diff };
    }
  }

  // Only suggest if close (within 50ms)
  if (closest && closest.diff <= 50) {
    const confidence = Math.max(0, 1 - (closest.diff / 100));
    return { token: closest.token, confidence };
  }

  return null;
}

export default {
  colorTokens,
  spacingTokens,
  fontSizeTokens,
  lineHeightTokens,
  radiusTokens,
  borderWidthTokens,
  shadowTokens,
  typographyTokens,
  zIndexTokens,
  transitionTokens,
  easingTokens,
  breakpointTokens,
  allTokens,
  findMatchingToken,
  suggestToken,
  getRecommendedTokens,
};
