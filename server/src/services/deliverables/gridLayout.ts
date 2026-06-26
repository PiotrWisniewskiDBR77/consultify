/**
 * gridLayout — W7.1: transformacja regionów znormalizowanych → pudełka kanwy PPTX.
 *
 * Archetypy (slideArchetypes) i composition (presentationLayoutDirectorService)
 * opisują regiony w przestrzeni ZNORMALIZOWANEJ 0..1. Renderery pracują w CALACH na
 * kanwie 16:9 (pptxgenjs LAYOUT_16x9 = 10 × 5.625"). Ten moduł to JEDYNY most między
 * tymi przestrzeniami — czysty, testowalny, z opcjonalną rezerwacją pasa tytułu i
 * marginesami bezpieczeństwa.
 *
 * Deterministyczny, fail-soft (puste/niepoprawne wejście → pusta mapa).
 */

import { resolveArchetype } from './slideArchetypes.js';

// Kanwa pptxgenjs LAYOUT_16x9 (cale).
export const CANVAS_WIDTH_IN = 10;
export const CANVAS_HEIGHT_IN = 5.625;

/** Region znormalizowany (0..1) — kompatybilny z ArchetypeRegion / SlideComposition. */
export interface NormalizedRegion {
  name: string;
  x: number; y: number; w: number; h: number;
}

/** Pudełko na kanwie w CALACH (origin top-left). */
export interface CanvasBox {
  name: string;
  x: number; y: number; w: number; h: number;
}

export interface GridLayoutOptions {
  /** Margines bezpieczeństwa od krawędzi kanwy (cale, każda strona). Domyślnie 0. */
  margin?: number;
  /** Gutter odejmowany od każdego regionu (cale) — wewnętrzny oddech. Domyślnie 0. */
  gutter?: number;
  /** Wymiary kanwy (cale) — override dla innych layoutów. */
  canvas?: { width: number; height: number };
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/**
 * Mapuje listę regionów 0..1 na pudełka kanwy (cale). Każdy region klampowany do
 * [0,1]; margines zwęża OBSZAR ROBOCZY (regiony skalowane proporcjonalnie wewnątrz
 * marginesów); gutter odejmowany od każdego pudełka (połowa z każdej strony).
 */
export function regionsToCanvas(
  regions: NormalizedRegion[],
  opts: GridLayoutOptions = {},
): CanvasBox[] {
  if (!Array.isArray(regions) || regions.length === 0) return [];

  const cw = opts.canvas?.width ?? CANVAS_WIDTH_IN;
  const ch = opts.canvas?.height ?? CANVAS_HEIGHT_IN;
  const margin = Math.max(0, Math.min(opts.margin ?? 0, Math.min(cw, ch) / 4));
  const gutter = Math.max(0, opts.gutter ?? 0);

  const areaX = margin;
  const areaY = margin;
  const areaW = cw - margin * 2;
  const areaH = ch - margin * 2;

  const out: CanvasBox[] = [];
  for (const r of regions) {
    const nx = clamp01(r.x);
    const ny = clamp01(r.y);
    const nw = clamp01(r.w);
    const nh = clamp01(r.h);
    // skala do obszaru roboczego
    let bx = areaX + nx * areaW;
    let by = areaY + ny * areaH;
    let bw = nw * areaW;
    let bh = nh * areaH;
    // gutter: zwęź symetrycznie, nigdy poniżej zera
    const gx = Math.min(gutter / 2, bw / 2);
    const gy = Math.min(gutter / 2, bh / 2);
    bx += gx; by += gy; bw -= gx * 2; bh -= gy * 2;
    // przytnij do obszaru roboczego (zabezpieczenie przed klampem regionu)
    if (bx + bw > areaX + areaW) bw = areaX + areaW - bx;
    if (by + bh > areaY + areaH) bh = areaY + areaH - by;
    out.push({
      name: r.name,
      x: round(bx), y: round(by), w: round(Math.max(0, bw)), h: round(Math.max(0, bh)),
    });
  }
  return out;
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/** Wygodne wyszukanie pudełka po nazwie regionu (lub null). */
export function findBox(boxes: CanvasBox[], name: string): CanvasBox | null {
  return boxes.find((b) => b.name === name) ?? null;
}

/**
 * Mapa nazwa→pudełko dla szybkiego dostępu w rendererze.
 * Przy duplikatach nazw wygrywa OSTATNI (jak Object.fromEntries).
 */
export function boxMap(boxes: CanvasBox[]): Record<string, CanvasBox> {
  const m: Record<string, CanvasBox> = {};
  for (const b of boxes) m[b.name] = b;
  return m;
}

/**
 * Resolver „jednym strzałem": intencja (+ opcjonalny preferowany archetyp) → pudełka
 * kanwy gotowe dla renderera. Łączy arsenał archetypów (W7.3) z transformacją gridu.
 * To kontrakt, który renderer composition (W7.1 wiring) będzie konsumował.
 */
export function resolveSlideBoxes(
  intent: string,
  preferredVariantId?: string | null,
  opts: GridLayoutOptions = {},
): { archetypeId: string; boxes: CanvasBox[] } {
  const archetype = resolveArchetype(intent, preferredVariantId);
  return {
    archetypeId: archetype.id,
    boxes: regionsToCanvas(archetype.regions, { margin: 0.1, ...opts }),
  };
}
