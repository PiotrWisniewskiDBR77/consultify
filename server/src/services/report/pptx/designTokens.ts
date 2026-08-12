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

// Premium type — aligned with the curated font library (themeRegistry / §1
// DELIVERABLE_FORMATTING_SPEC). Inter is a confident, modern grotesque that
// reads far less "Office template" than Calibri Light; it renders in .pptx /
// .docx / web, and where unavailable PowerPoint substitutes to a clean sans
// (still better than thin Calibri Light). Title uses a heavier presence via the
// per-element `bold` flag rather than a Light weight.
const FONTS = {
  title: 'Inter',
  body: 'Inter',
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
    primary: '0A2A4E', // Deep warm navy (richer, more premium than 003A70)
    secondary: '35699B', // Mid blue — clearer support tone for the navy dominant
    accent: '0E9F6E', // Refined emerald (stonowany vs jaskrawe 00AA55) — liczby/akcenty
    background: 'FFFFFF',
    surface: 'F6F8FB',
    textPrimary: '17223B', // Slightly deeper, warmer ink
    textSecondary: '54607A', // ~6.3:1 on white (WCAG AA)
    textInverse: 'FFFFFF',
    success: '16A34A',
    warning: 'F59E0B',
    danger: 'DC2626', // Slightly deeper red — less alarming, more editorial
    info: '3B82F6',
    border: 'E3E7EE',
    muted: '9AA3B5',
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
    primary: '111827', // Near black — strong monochrome dominant
    secondary: '374151', // Graphite support
    accent: '4F46E5', // Deeper indigo — single restrained accent on numbers
    background: 'FFFFFF',
    surface: 'F9FAFB',
    textPrimary: '111827',
    textSecondary: '5B6472', // ~5.6:1 on white (WCAG AA), warmer than 6B7280
    textInverse: 'FFFFFF',
    success: '059669',
    warning: 'D97706',
    danger: 'DC2626',
    info: '4F46E5',
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
    primary: '1D4ED8', // Confident royal blue (deeper than 0066CC, less web-link)
    secondary: '1E3A5F', // Deep navy support
    accent: '7C3AED', // Violet accent — reserved for numbers/highlights
    background: 'FFFFFF',
    surface: 'F2F6FE', // Soft, subtle blue tint
    textPrimary: '0F172A',
    textSecondary: '465069', // ~7.6:1 on white (WCAG AAA), warmer slate
    textInverse: 'FFFFFF',
    success: '16A34A',
    warning: 'F59E0B', // Calmer amber than FBBF24
    danger: 'E11D48', // Slightly deeper rose — less neon than F43F5E
    info: '0EA5E9',
    border: 'D5DDE8', // Softer hairline
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
    case 'critical':
      return tokens.colors.danger;
    case 'high':
      return tokens.colors.warning;
    case 'medium':
      return tokens.colors.info;
    case 'low':
      return tokens.colors.success;
  }
}

export function trendColor(trend: 'up' | 'down' | 'flat', tokens: DesignTokens): string {
  switch (trend) {
    case 'up':
      return tokens.colors.success;
    case 'down':
      return tokens.colors.danger;
    case 'flat':
      return tokens.colors.muted;
  }
}

export function statusColor(status: 'good' | 'warning' | 'critical', tokens: DesignTokens): string {
  switch (status) {
    case 'good':
      return tokens.colors.success;
    case 'warning':
      return tokens.colors.warning;
    case 'critical':
      return tokens.colors.danger;
  }
}

export function likelihoodImpactColor(level: string, tokens: DesignTokens): string {
  switch (String(level).trim().toLowerCase()) {
    case 'high':
      return tokens.colors.danger;
    case 'medium':
      return tokens.colors.warning;
    case 'low':
      return tokens.colors.success;
    default:
      // Evidence-bound decks deliberately preserve UNKNOWN and may also carry
      // qualitative impact labels.  Rendering an unrecognised value without a
      // fill lets pptxgenjs fall back to black, which looks like a critical
      // risk and invents meaning.  Use the neutral surface instead.
      return tokens.colors.muted;
  }
}

// ============================================================
// STRATEGIC INTENT / ROLE COLORS
// ============================================================

/** Strategic intent → hex color (without #) */
export function strategicIntentColor(intent: string): string {
  switch (intent) {
    case 'Grow':
      return '22C55E'; // green
    case 'Fix':
      return 'EF4444'; // red
    case 'Stabilize':
      return '3B82F6'; // blue
    case 'De-risk':
      return 'F59E0B'; // amber
    case 'Build Capability':
      return '6366F1'; // indigo
    default:
      return '94A3B8'; // slate
  }
}

/** Strategic role → hex color (without #) */
export function strategicRoleColor(role: string): string {
  switch (role) {
    case 'Foundation':
      return '64748B'; // slate
    case 'Enabler':
      return '3B82F6'; // blue
    case 'Accelerator':
      return 'F59E0B'; // amber
    case 'Scaling':
      return '8B5CF6'; // purple
    default:
      return '94A3B8';
  }
}

/** Priority → hex color (without #) */
export function priorityColor(priority: string, tokens: DesignTokens): string {
  switch (priority) {
    case 'critical':
      return tokens.colors.danger;
    case 'high':
      return tokens.colors.warning;
    case 'medium':
      return tokens.colors.info;
    case 'low':
      return tokens.colors.success;
    default:
      return tokens.colors.muted;
  }
}
