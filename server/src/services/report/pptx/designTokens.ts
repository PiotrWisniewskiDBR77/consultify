/**
 * Design Tokens — Centralized visual constants
 *
 * ALL visual decisions live here. Components NEVER hardcode colors/sizes.
 * Three theme presets: corporate (default), minimal, modern.
 */

import type { DesignTokens } from './types.js';

// ============================================================
// SHARED CONSTANTS
// ============================================================

const FONTS = {
  title: 'Calibri Light',
  body: 'Calibri',
  mono: 'Courier New',
};

const FONT_SIZES = {
  slideTitle: 28,
  sectionTitle: 36,
  heading: 20,
  subheading: 16,
  body: 13,
  caption: 11,
  footnote: 9,
  kpiValue: 36,
  kpiLabel: 11,
};

/** 16:9 grid constants — immutable */
const GRID = {
  slideW: 10,
  slideH: 5.625,
  contentX: 0.5,
  contentY: 1.0,
  contentW: 9.0,
  contentH: 4.0,
  headerH: 0.8,
  footerY: 5.2,
};

const SPACING = {
  margin: 0.5,
  gutter: 0.3,
  paragraphGap: 8,
  elementGap: 0.15,
};

// ============================================================
// THEME: CORPORATE (default — BCG-inspired)
// ============================================================

export const corporateTokens: DesignTokens = {
  colors: {
    primary: '003A70',      // Dark navy (BCG-like)
    secondary: '2C5F8A',    // Mid blue
    accent: '00AA55',       // Green for positive
    background: 'FFFFFF',
    surface: 'F7F8FA',
    textPrimary: '1A1A2E',
    textSecondary: '5A6178',
    textInverse: 'FFFFFF',
    success: '22C55E',
    warning: 'F59E0B',
    danger: 'EF4444',
    info: '3B82F6',
    border: 'E2E5EB',
    muted: 'A0A8B8',
  },
  fonts: FONTS,
  fontSizes: FONT_SIZES,
  spacing: SPACING,
  grid: GRID,
};

// ============================================================
// THEME: MINIMAL (clean, modern whitespace)
// ============================================================

export const minimalTokens: DesignTokens = {
  colors: {
    primary: '111827',      // Near black
    secondary: '374151',
    accent: '6366F1',       // Indigo accent
    background: 'FFFFFF',
    surface: 'F9FAFB',
    textPrimary: '111827',
    textSecondary: '6B7280',
    textInverse: 'FFFFFF',
    success: '10B981',
    warning: 'F59E0B',
    danger: 'EF4444',
    info: '6366F1',
    border: 'E5E7EB',
    muted: '9CA3AF',
  },
  fonts: FONTS,
  fontSizes: FONT_SIZES,
  spacing: SPACING,
  grid: GRID,
};

// ============================================================
// THEME: MODERN (vibrant, startup-like)
// ============================================================

export const modernTokens: DesignTokens = {
  colors: {
    primary: '0066CC',       // Bright blue
    secondary: '1E3A5F',
    accent: '7C3AED',       // Purple accent
    background: 'FFFFFF',
    surface: 'F0F4FF',
    textPrimary: '0F172A',
    textSecondary: '475569',
    textInverse: 'FFFFFF',
    success: '22C55E',
    warning: 'FBBF24',
    danger: 'F43F5E',
    info: '0EA5E9',
    border: 'CBD5E1',
    muted: '94A3B8',
  },
  fonts: FONTS,
  fontSizes: FONT_SIZES,
  spacing: SPACING,
  grid: GRID,
};

// ============================================================
// RESOLVER
// ============================================================

export function getDesignTokens(
  template: 'corporate' | 'minimal' | 'modern' = 'corporate',
  brandColorOverride?: string
): DesignTokens {
  let tokens: DesignTokens;

  switch (template) {
    case 'minimal':
      tokens = { ...minimalTokens };
      break;
    case 'modern':
      tokens = { ...modernTokens };
      break;
    case 'corporate':
    default:
      tokens = { ...corporateTokens };
      break;
  }

  // Apply brand color override
  if (brandColorOverride) {
    tokens = {
      ...tokens,
      colors: {
        ...tokens.colors,
        primary: brandColorOverride.replace('#', ''),
      },
    };
  }

  return tokens;
}

// ============================================================
// HELPER: severity → color
// ============================================================

export function severityColor(
  severity: 'critical' | 'high' | 'medium' | 'low',
  tokens: DesignTokens
): string {
  switch (severity) {
    case 'critical': return tokens.colors.danger;
    case 'high': return tokens.colors.warning;
    case 'medium': return tokens.colors.info;
    case 'low': return tokens.colors.success;
  }
}

export function trendColor(
  trend: 'up' | 'down' | 'flat',
  tokens: DesignTokens
): string {
  switch (trend) {
    case 'up': return tokens.colors.success;
    case 'down': return tokens.colors.danger;
    case 'flat': return tokens.colors.muted;
  }
}

export function statusColor(
  status: 'good' | 'warning' | 'critical',
  tokens: DesignTokens
): string {
  switch (status) {
    case 'good': return tokens.colors.success;
    case 'warning': return tokens.colors.warning;
    case 'critical': return tokens.colors.danger;
  }
}

export function likelihoodImpactColor(
  level: 'high' | 'medium' | 'low',
  tokens: DesignTokens
): string {
  switch (level) {
    case 'high': return tokens.colors.danger;
    case 'medium': return tokens.colors.warning;
    case 'low': return tokens.colors.success;
  }
}

// ============================================================
// STRATEGIC INTENT / ROLE COLORS
// ============================================================

/** Strategic intent → hex color (without #) */
export function strategicIntentColor(intent: string): string {
  switch (intent) {
    case 'Grow': return '22C55E';       // green
    case 'Fix': return 'EF4444';        // red
    case 'Stabilize': return '3B82F6';  // blue
    case 'De-risk': return 'F59E0B';    // amber
    case 'Build Capability': return '6366F1'; // indigo
    default: return '94A3B8';           // slate
  }
}

/** Strategic role → hex color (without #) */
export function strategicRoleColor(role: string): string {
  switch (role) {
    case 'Foundation': return '64748B';   // slate
    case 'Enabler': return '3B82F6';      // blue
    case 'Accelerator': return 'F59E0B';  // amber
    case 'Scaling': return '8B5CF6';      // purple
    default: return '94A3B8';
  }
}

/** Priority → hex color (without #) */
export function priorityColor(priority: string, tokens: DesignTokens): string {
  switch (priority) {
    case 'critical': return tokens.colors.danger;
    case 'high': return tokens.colors.warning;
    case 'medium': return tokens.colors.info;
    case 'low': return tokens.colors.success;
    default: return tokens.colors.muted;
  }
}
