/**
 * DeckThemeContext — React context providing the active DeckTheme to all blocks.
 * Includes auto-generation from BrandKit and the ThemeSwitcher panel.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { CURATED_COLOR_SETS, type CuratedColorSet } from '../wizard/types';

export interface DeckTheme extends CuratedColorSet {
  fonts: {
    headingFamily: string;
    bodyFamily: string;
    headingWeight: number;
    bodyWeight: number;
    headingSizeScale: 'S' | 'M' | 'L';
  };
  logoUrl?: string;
  cardBackdropStyle: 'none' | 'gradient' | 'pattern' | 'image';
  cardBackdropValue?: string;
}

export interface BrandKit {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl?: string;
  fontTitle?: string;
  fontBody?: string;
}

const DEFAULT_FONTS: DeckTheme['fonts'] = {
  headingFamily: 'Inter',
  bodyFamily: 'Inter',
  headingWeight: 700,
  bodyWeight: 400,
  headingSizeScale: 'M',
};

interface DeckThemeContextValue {
  theme: DeckTheme;
  colorSetId: string;
  setColorSetId: (id: string) => void;
  brandKit: BrandKit | null;
  setBrandKit: (kit: BrandKit | null) => void;
}

const Context = createContext<DeckThemeContextValue | null>(null);

export function useDeckTheme(): DeckThemeContextValue {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useDeckTheme must be used within DeckThemeProvider');
  return ctx;
}

/**
 * Generate a full DeckTheme from a BrandKit automatically.
 * Computes chart palette, contrast-safe text colors, and style tags.
 */
export function generateDeckThemeFromBrandKit(kit: BrandKit): DeckTheme {
  const primary = normalizeHex(kit.primaryColor);
  const secondary = normalizeHex(kit.secondaryColor);
  const accent = normalizeHex(kit.accentColor);

  const bgLightness = getLightness(primary);
  const isDark = bgLightness < 40;

  return {
    id: 'brand_kit',
    name: 'Brand Kit',
    colors: {
      primary,
      secondary,
      accent,
      background: isDark ? '#0F172A' : '#FAFBFC',
      surface: isDark ? '#1E293B' : '#FFFFFF',
      textPrimary: isDark ? '#F1F5F9' : '#0F172A',
      textSecondary: isDark ? '#94A3B8' : '#64748B',
      heading: isDark ? '#F8FAFC' : primary,
    },
    chartPalette: generateChartPalette(primary, secondary, accent),
    styleTags: isDark ? ['dark', 'branded', 'professional'] : ['light', 'branded', 'professional'],
    fonts: {
      headingFamily: kit.fontTitle || 'Inter',
      bodyFamily: kit.fontBody || 'Inter',
      headingWeight: 700,
      bodyWeight: 400,
      headingSizeScale: 'M',
    },
    logoUrl: kit.logoUrl,
    cardBackdropStyle: 'none',
  };
}

function normalizeHex(color: string): string {
  if (color.startsWith('#')) return color;
  return `#${color}`;
}

function getLightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return ((max + min) / 2) * 100;
}

function generateChartPalette(primary: string, secondary: string, accent: string): string[] {
  return [
    primary,
    secondary,
    accent,
    adjustBrightness(primary, 30),
    adjustBrightness(secondary, 30),
    adjustBrightness(accent, 30),
  ];
}

function adjustBrightness(hex: string, percent: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + percent);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + percent);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + percent);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

interface DeckThemeProviderProps {
  initialColorSetId: string;
  initialBrandKit?: BrandKit | null;
  children: React.ReactNode;
}

export const DeckThemeProvider: React.FC<DeckThemeProviderProps> = ({
  initialColorSetId,
  initialBrandKit = null,
  children,
}) => {
  const [colorSetId, setColorSetId] = useState(initialColorSetId);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(initialBrandKit);

  const theme = useMemo<DeckTheme>(() => {
    if (colorSetId === 'brand_kit' && brandKit) {
      return generateDeckThemeFromBrandKit(brandKit);
    }

    const colorSet = CURATED_COLOR_SETS.find((c) => c.id === colorSetId) || CURATED_COLOR_SETS[1];
    return {
      ...colorSet,
      fonts: DEFAULT_FONTS,
      cardBackdropStyle: 'none',
    };
  }, [colorSetId, brandKit]);

  const value = useMemo(
    () => ({ theme, colorSetId, setColorSetId, brandKit, setBrandKit }),
    [theme, colorSetId, brandKit]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
};
