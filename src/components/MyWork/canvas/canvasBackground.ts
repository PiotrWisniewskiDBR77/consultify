/**
 * canvasBackground — V5-IDEA-42 SuperCanvas background system.
 *
 * Unified, configurable background tokens for all canvas tools.
 * Provides consistent premium visual quality across Mind Map, Whiteboard,
 * Process Flow, and Table canvas modes.
 */

export type CanvasBgVariant = 'dots' | 'lines' | 'cross' | 'blank';

export interface CanvasBgConfig {
  color: string;
  gap: number;
  size: number;
  variant: CanvasBgVariant;
  containerClass: string;
}

export type CanvasTheme = 'light' | 'dark';

const LIGHT_BG: Record<string, CanvasBgConfig> = {
  mindmap: {
    color: 'rgba(148,163,184,0.08)',
    gap: 24,
    size: 1,
    variant: 'dots',
    containerClass: 'bg-slate-50/90',
  },
  whiteboard: {
    color: 'rgba(148,163,184,0.10)',
    gap: 24,
    size: 1,
    variant: 'dots',
    containerClass: 'bg-white',
  },
  process_flow: {
    color: 'rgba(148,163,184,0.12)',
    gap: 20,
    size: 1,
    variant: 'lines',
    containerClass: 'bg-slate-50/80',
  },
  table: {
    color: 'rgba(148,163,184,0.06)',
    gap: 32,
    size: 1,
    variant: 'dots',
    containerClass: 'bg-white',
  },
};

const DARK_BG: Record<string, CanvasBgConfig> = {
  mindmap: {
    color: 'rgba(148,163,184,0.06)',
    gap: 24,
    size: 1,
    variant: 'dots',
    containerClass: 'bg-navy-950',
  },
  whiteboard: {
    color: 'rgba(148,163,184,0.08)',
    gap: 24,
    size: 1,
    variant: 'dots',
    containerClass: 'bg-navy-950',
  },
  process_flow: {
    color: 'rgba(148,163,184,0.10)',
    gap: 20,
    size: 1,
    variant: 'lines',
    containerClass: 'bg-navy-950',
  },
  table: {
    color: 'rgba(148,163,184,0.04)',
    gap: 32,
    size: 1,
    variant: 'dots',
    containerClass: 'bg-navy-950',
  },
};

export function getCanvasBg(
  tool: string,
  theme: CanvasTheme = 'dark',
  overrideVariant?: CanvasBgVariant
): CanvasBgConfig {
  const map = theme === 'light' ? LIGHT_BG : DARK_BG;
  const config = map[tool] || map.mindmap;
  if (overrideVariant && overrideVariant !== 'blank') {
    return { ...config, variant: overrideVariant };
  }
  return config;
}

export const CANVAS_BG_VARIANTS: { id: CanvasBgVariant; labelEn: string; labelPl: string }[] = [
  { id: 'dots', labelEn: 'Dots', labelPl: 'Kropki' },
  { id: 'lines', labelEn: 'Lines', labelPl: 'Linie' },
  { id: 'cross', labelEn: 'Grid', labelPl: 'Siatka' },
  { id: 'blank', labelEn: 'Blank', labelPl: 'Puste' },
];
