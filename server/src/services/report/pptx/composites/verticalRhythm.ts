/**
 * Vertical Rhythm — anti-sparseness helper (beat-Gamma, W7).
 *
 * The #1 gap vs Gamma was content sitting in the top half of the slide leaving a
 * large empty bottom. These pure helpers let layouts distribute / centre their
 * stacked blocks so content fills the usable region (`tokens.grid.contentH`)
 * instead of clinging to the top. Pure math → unit-testable, no pptxgenjs.
 */

export type FillMode = 'fill' | 'center' | 'top';

/**
 * Return the y-coordinate for each stacked block so the stack occupies `region`.
 * - 'fill'   : equal gaps so blocks span the whole region (no empty bottom).
 * - 'center' : keep blocks tight (minGap) and centre the stack vertically.
 * - 'top'    : stack from the top with minGap (legacy behaviour).
 * A single block is always centred in the region (both 'fill' and 'center').
 */
export function distributeY(
  region: { y: number; h: number },
  rowHeights: number[],
  mode: FillMode = 'fill',
  minGap = 0.15
): number[] {
  const n = rowHeights.length;
  if (n === 0) return [];
  const totalRows = rowHeights.reduce((a, b) => a + b, 0);

  if (n === 1 && mode !== 'top') {
    return [region.y + Math.max(0, (region.h - rowHeights[0]) / 2)];
  }

  if (mode === 'top') {
    const ys: number[] = [];
    let y = region.y;
    for (let i = 0; i < n; i++) {
      ys.push(y);
      y += rowHeights[i] + minGap;
    }
    return ys;
  }

  if (mode === 'center') {
    const stackH = totalRows + minGap * (n - 1);
    let y = region.y + Math.max(0, (region.h - stackH) / 2);
    const ys: number[] = [];
    for (let i = 0; i < n; i++) {
      ys.push(y);
      y += rowHeights[i] + minGap;
    }
    return ys;
  }

  // 'fill' — equal gaps so the stack spans region.h.
  const free = region.h - totalRows;
  const gap = Math.max(minGap, free / (n - 1));
  const ys: number[] = [];
  let y = region.y;
  for (let i = 0; i < n; i++) {
    ys.push(y);
    y += rowHeights[i] + gap;
  }
  return ys;
}

/** The y that vertically centres a single block of height `totalH` in `region`. */
export function centerY(region: { y: number; h: number }, totalH: number): number {
  return region.y + Math.max(0, (region.h - totalH) / 2);
}

/**
 * Scale a set of row heights up so they (with gaps) fill `region.h` when the
 * natural content is much shorter than the region. Returns scaled heights capped
 * by `maxScale` so a 2-row slide doesn't become absurdly tall. Useful for cards
 * / tiles that should grow to fill the canvas.
 */
export function fillHeights(
  regionH: number,
  rowHeights: number[],
  gap: number,
  maxScale = 1.6
): number[] {
  const n = rowHeights.length;
  if (n === 0) return [];
  const totalRows = rowHeights.reduce((a, b) => a + b, 0);
  const available = regionH - gap * (n - 1);
  if (totalRows <= 0) return rowHeights;
  const scale = Math.min(maxScale, Math.max(1, available / totalRows));
  return rowHeights.map((h) => h * scale);
}
