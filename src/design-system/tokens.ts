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
  category: 'color' | 'spacing' | 'radius' | 'shadow' | 'typography' | 'z-index' | 'transition';
  description: string;
  aliases?: string[];
  usage?: string[];
}

/**
 * Color tokens - backgrounds, text, accents, semantic colors
 */
export const colorTokens: DesignToken[] = [
  // Backgrounds
  { name: '--bg-primary', value: '#f5f5f3', category: 'color', description: 'Main page background', usage: ['body', 'main', 'page'] },
  { name: '--bg-secondary', value: '#fafafa', category: 'color', description: 'Card/surface background', usage: ['card', 'surface', 'panel'] },
  { name: '--bg-elevated', value: '#ffffff', category: 'color', description: 'Elevated elements', usage: ['modal', 'dropdown', 'popover'] },
  { name: '--bg-subtle', value: '#ebebea', category: 'color', description: 'Subtle containers', usage: ['container', 'section'], aliases: ['--bg-tertiary'] },

  // Text
  { name: '--text-primary', value: '#2a2a2a', category: 'color', description: 'Primary text', usage: ['heading', 'body', 'label'] },
  { name: '--text-secondary', value: '#5a5a5a', category: 'color', description: 'Secondary text', usage: ['description', 'subtitle'] },
  { name: '--text-tertiary', value: '#8a8a8a', category: 'color', description: 'Tertiary/label text', usage: ['label', 'caption', 'placeholder'] },
  { name: '--text-muted', value: '#9a9a9a', category: 'color', description: 'Muted/disabled text', usage: ['disabled', 'hint'] },

  // Accents
  { name: '--accent-primary', value: '#6b7c93', category: 'color', description: 'Primary accent (slate blue)', usage: ['button', 'link', 'focus'], aliases: ['--accent'] },
  { name: '--accent-primary-hover', value: '#5a6a7f', category: 'color', description: 'Accent hover state', usage: ['button:hover'], aliases: ['--accent-hover'] },
  { name: '--accent-secondary', value: '#8b9aaf', category: 'color', description: 'Secondary accent', usage: ['highlight', 'selection'] },
  { name: '--accent-subtle', value: '#e8ecf0', category: 'color', description: 'Subtle accent background', usage: ['badge', 'tag'] },

  // Semantic
  { name: '--success', value: '#7a9678', category: 'color', description: 'Success state', usage: ['success', 'valid', 'complete'] },
  { name: '--success-bg', value: '#f0f4f0', category: 'color', description: 'Success background', usage: ['success-message'] },
  { name: '--warning', value: '#b8956f', category: 'color', description: 'Warning state', usage: ['warning', 'caution'] },
  { name: '--danger', value: '#b87b7b', category: 'color', description: 'Danger/error state', usage: ['error', 'danger', 'delete'] },
  { name: '--info', value: '#3b82f6', category: 'color', description: 'Informational state', usage: ['info', 'notice'] },

  // Borders
  { name: '--border-primary', value: '#e5e5e3', category: 'color', description: 'Primary border', usage: ['border', 'divider'], aliases: ['--border'] },
  { name: '--border-secondary', value: '#d5d5d3', category: 'color', description: 'Stronger border', usage: ['border:hover'], aliases: ['--border-hover'] },
  { name: '--border-subtle', value: '#f0f0ee', category: 'color', description: 'Subtle divider', usage: ['separator'] },
];

/**
 * Spacing tokens - margins, paddings, gaps
 */
export const spacingTokens: DesignToken[] = [
  { name: '--space-xs', value: '8px', category: 'spacing', description: 'Extra small spacing', usage: ['gap-tight', 'padding-small'] },
  { name: '--space-sm', value: '12px', category: 'spacing', description: 'Small spacing', usage: ['gap', 'padding'] },
  { name: '--space-md', value: '16px', category: 'spacing', description: 'Medium spacing (default)', usage: ['gap', 'padding', 'margin'] },
  { name: '--space-lg', value: '24px', category: 'spacing', description: 'Large spacing', usage: ['section-gap', 'padding-large'] },
  { name: '--space-xl', value: '32px', category: 'spacing', description: 'Extra large spacing', usage: ['section-margin'] },
  { name: '--space-2xl', value: '48px', category: 'spacing', description: '2x large spacing', usage: ['page-section'] },
];

/**
 * Border radius tokens
 */
export const radiusTokens: DesignToken[] = [
  { name: '--radius-xs', value: '4px', category: 'radius', description: 'Extra small radius', usage: ['tag', 'badge'] },
  { name: '--radius-sm', value: '6px', category: 'radius', description: 'Small radius', usage: ['button', 'input'] },
  { name: '--radius-md', value: '8px', category: 'radius', description: 'Medium radius (default)', usage: ['card', 'modal'], aliases: ['--radius'] },
  { name: '--radius-lg', value: '12px', category: 'radius', description: 'Large radius', usage: ['panel', 'dialog'] },
  { name: '--radius-xl', value: '16px', category: 'radius', description: 'Extra large radius', usage: ['hero', 'feature-card'] },
];

/**
 * Shadow tokens
 */
export const shadowTokens: DesignToken[] = [
  { name: '--shadow-sm', value: '0 1px 2px rgba(0, 0, 0, 0.04)', category: 'shadow', description: 'Subtle shadow', usage: ['input', 'button'] },
  { name: '--shadow-md', value: '0 2px 4px rgba(0, 0, 0, 0.06)', category: 'shadow', description: 'Medium shadow', usage: ['card', 'dropdown'] },
  { name: '--shadow-lg', value: '0 4px 8px rgba(0, 0, 0, 0.08)', category: 'shadow', description: 'Large shadow', usage: ['modal', 'popover'] },
];

/**
 * Typography tokens
 */
export const typographyTokens: DesignToken[] = [
  { name: '--font-normal', value: '400', category: 'typography', description: 'Normal weight', usage: ['body'] },
  { name: '--font-medium', value: '500', category: 'typography', description: 'Medium weight', usage: ['label', 'button'] },
  { name: '--font-semibold', value: '600', category: 'typography', description: 'Semibold weight', usage: ['heading', 'emphasis'] },
];

/**
 * Z-index tokens
 */
export const zIndexTokens: DesignToken[] = [
  { name: '--z-base', value: '1', category: 'z-index', description: 'Base layer', usage: ['content'] },
  { name: '--z-dropdown', value: '1000', category: 'z-index', description: 'Dropdowns', usage: ['dropdown', 'menu'] },
  { name: '--z-modal', value: '2000', category: 'z-index', description: 'Modals', usage: ['modal', 'dialog'] },
  { name: '--z-overlay', value: '3000', category: 'z-index', description: 'Overlays', usage: ['overlay', 'backdrop'] },
  { name: '--z-notification', value: '9999', category: 'z-index', description: 'Notifications', usage: ['toast', 'alert'] },
];

/**
 * Transition tokens
 */
export const transitionTokens: DesignToken[] = [
  { name: '--transition-speed', value: '200ms', category: 'transition', description: 'Default transition', usage: ['hover', 'focus', 'state-change'] },
];

/**
 * All design tokens combined
 */
export const allTokens: DesignToken[] = [
  ...colorTokens,
  ...spacingTokens,
  ...radiusTokens,
  ...shadowTokens,
  ...typographyTokens,
  ...zIndexTokens,
  ...transitionTokens,
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

  return null;
}

/**
 * Get recommended token for a property type
 */
export function getRecommendedTokens(propertyType: 'background' | 'color' | 'border' | 'spacing' | 'radius' | 'shadow'): DesignToken[] {
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
  return ['margin', 'padding', 'gap', 'top', 'right', 'bottom', 'left', 'width', 'height']
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

export default {
  colorTokens,
  spacingTokens,
  radiusTokens,
  shadowTokens,
  typographyTokens,
  zIndexTokens,
  transitionTokens,
  allTokens,
  findMatchingToken,
  suggestToken,
  getRecommendedTokens,
};
