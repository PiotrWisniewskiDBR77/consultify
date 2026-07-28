/**
 * Consultify — Shared Color Patterns (Fala 1, 2026-07-28).
 *
 * Moved out of `Presentations/wizard/types.ts` so the Deck/Word Template
 * Architects can offer the SAME color-pattern gallery the Presentation
 * Wizard (`SetupStep.tsx`) already uses to pick a deck's colors — the
 * live proof of N31 ("wzorzec kolorów i wzorzec treści, dwa typy, można
 * je nakładać, ale niekoniecznie") lived only in the Wizard, not in the
 * place a consultant BUILDS a reusable template. See
 * `Harvard/wdrozenie-100/_SPEC_GENERATOR_TEMPLATOW_2026-07-28.md` Część 2.
 *
 * `Presentations/wizard/types.ts` re-exports these two symbols so every
 * existing caller (SetupStep, DeckBuilder/ThemeSwitcher,
 * DeckBuilder/DeckThemeContext, presentationLayoutDirectorService.ts
 * comment) keeps working unchanged — this file is the new canonical
 * source, not a duplicate.
 */

// ─── Curated Color Sets ──────────────────────────────────────────────
export interface CuratedColorSet {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    textPrimary: string;
    textSecondary: string;
    heading: string;
  };
  chartPalette: string[];
  styleTags: string[];
}

export const CURATED_COLOR_SETS: CuratedColorSet[] = [
  // Harvard — canonical brand-default theme. Crimson + HBS complementary.
  // Spec: docs/audit/2026-06-03/HARVARD_COLOR_REMAP_AUDIT.md
  {
    id: 'harvard',
    name: 'Harvard',
    colors: {
      primary: '#A51C30', // Harvard Crimson
      secondary: '#3B2883', // HBS Blue 1 (dark)
      accent: '#6578B4', // HBS Blue 2
      background: '#FAFAF9',
      surface: '#FFFFFF',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      heading: '#A51C30',
    },
    // Harvard categorical chart palette — crimson-anchored, HBS complementary.
    chartPalette: ['#A51C30', '#6578B4', '#52A52E', '#E87D1E', '#00979D', '#80408D'],
    styleTags: ['brand', 'professional', 'executive'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: {
      primary: '#0B3D91',
      secondary: '#1A8A8A',
      accent: '#00BCD4',
      background: '#F0F7FA',
      surface: '#FFFFFF',
      textPrimary: '#1A2332',
      textSecondary: '#5A6B7D',
      heading: '#0B3D91',
    },
    chartPalette: ['#0B3D91', '#1A8A8A', '#00BCD4', '#4FC3F7', '#80DEEA', '#B2EBF2'],
    styleTags: ['professional', 'calm', 'corporate'],
  },
  {
    id: 'slate',
    name: 'Slate',
    colors: {
      primary: '#475569',
      secondary: '#1E40AF',
      accent: '#3B82F6',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      heading: '#1E293B',
    },
    chartPalette: ['#475569', '#1E40AF', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'],
    styleTags: ['neutral', 'modern', 'professional'],
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      primary: '#14532D',
      secondary: '#166534',
      accent: '#CA8A04',
      background: '#F0FDF4',
      surface: '#FFFFFF',
      textPrimary: '#052E16',
      textSecondary: '#4D7C5E',
      heading: '#14532D',
    },
    chartPalette: ['#14532D', '#166534', '#22C55E', '#CA8A04', '#86EFAC', '#FDE047'],
    styleTags: ['natural', 'warm', 'professional'],
  },
  {
    id: 'ember',
    name: 'Ember',
    colors: {
      primary: '#292524',
      secondary: '#78350F',
      accent: '#EA580C',
      background: '#FFFBEB',
      surface: '#FFFFFF',
      textPrimary: '#1C1917',
      textSecondary: '#78716C',
      heading: '#292524',
    },
    chartPalette: ['#292524', '#EA580C', '#F59E0B', '#FB923C', '#FDBA74', '#FED7AA'],
    styleTags: ['bold', 'energetic', 'dark'],
  },
  {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      primary: '#0F0F23',
      secondary: '#312E81',
      accent: '#6366F1',
      background: '#0F0F23',
      surface: '#1E1B4B',
      textPrimary: '#F8FAFC',
      textSecondary: '#A5B4FC',
      heading: '#E0E7FF',
    },
    chartPalette: ['#6366F1', '#A78BFA', '#C4B5FD', '#6D28D9', '#4C1D95', '#DDD6FE'],
    styleTags: ['dark', 'premium', 'modern'],
  },
  {
    id: 'arctic',
    name: 'Arctic',
    colors: {
      primary: '#E2E8F0',
      secondary: '#64748B',
      accent: '#0EA5E9',
      background: '#FFFFFF',
      surface: '#F1F5F9',
      textPrimary: '#1E293B',
      textSecondary: '#64748B',
      heading: '#334155',
    },
    chartPalette: ['#0EA5E9', '#38BDF8', '#7DD3FC', '#64748B', '#94A3B8', '#CBD5E1'],
    styleTags: ['light', 'clean', 'minimal'],
  },
  {
    id: 'sand',
    name: 'Sand',
    colors: {
      primary: '#78716C',
      secondary: '#92400E',
      accent: '#D97706',
      background: '#FAFAF9',
      surface: '#FFFFFF',
      textPrimary: '#292524',
      textSecondary: '#78716C',
      heading: '#44403C',
    },
    chartPalette: ['#92400E', '#D97706', '#F59E0B', '#78716C', '#A8A29E', '#D6D3D1'],
    styleTags: ['warm', 'elegant', 'natural'],
  },
  {
    id: 'indigo',
    name: 'Indigo',
    colors: {
      primary: '#3730A3',
      secondary: '#4338CA',
      accent: '#10B981',
      background: '#EEF2FF',
      surface: '#FFFFFF',
      textPrimary: '#1E1B4B',
      textSecondary: '#6366F1',
      heading: '#312E81',
    },
    chartPalette: ['#3730A3', '#4338CA', '#10B981', '#6366F1', '#818CF8', '#34D399'],
    styleTags: ['vibrant', 'modern', 'tech'],
  },
  {
    id: 'graphite',
    name: 'Graphite',
    colors: {
      primary: '#374151',
      secondary: '#4B5563',
      accent: '#2563EB',
      background: '#F3F4F6',
      surface: '#FFFFFF',
      textPrimary: '#111827',
      textSecondary: '#6B7280',
      heading: '#1F2937',
    },
    chartPalette: ['#374151', '#2563EB', '#3B82F6', '#60A5FA', '#6B7280', '#9CA3AF'],
    styleTags: ['corporate', 'neutral', 'professional'],
  },
  {
    id: 'olive',
    name: 'Olive',
    colors: {
      primary: '#4D5F3E',
      secondary: '#6B7F3E',
      accent: '#BDB76B',
      background: '#FEFDF6',
      surface: '#FFFFFF',
      textPrimary: '#2D3A1F',
      textSecondary: '#6B7F5E',
      heading: '#3D4F2E',
    },
    chartPalette: ['#4D5F3E', '#6B7F3E', '#BDB76B', '#9CB380', '#C5D6A0', '#E8F0D8'],
    styleTags: ['organic', 'soft', 'earthy'],
  },
  {
    id: 'burgundy',
    name: 'Burgundy',
    colors: {
      primary: '#7F1D1D',
      secondary: '#991B1B',
      accent: '#374151',
      background: '#FEF2F2',
      surface: '#FFFFFF',
      textPrimary: '#450A0A',
      textSecondary: '#991B1B',
      heading: '#7F1D1D',
    },
    chartPalette: ['#7F1D1D', '#991B1B', '#DC2626', '#374151', '#6B7280', '#F87171'],
    styleTags: ['premium', 'bold', 'executive'],
  },
  {
    id: 'teal',
    name: 'Teal',
    colors: {
      primary: '#115E59',
      secondary: '#0F766E',
      accent: '#475569',
      background: '#F0FDFA',
      surface: '#FFFFFF',
      textPrimary: '#042F2E',
      textSecondary: '#5EEAD4',
      heading: '#134E4A',
    },
    chartPalette: ['#115E59', '#0F766E', '#3B82F6', '#2DD4BF', '#475569', '#94A3B8'],
    styleTags: ['fresh', 'professional', 'balanced'],
  },
];
