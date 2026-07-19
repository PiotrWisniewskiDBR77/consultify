/**
 * REJESTR V7-8 — image comparison, two-tier.
 *
 * Tier 1: pixelmatch (if present in node_modules) — real per-pixel diff with
 *         an output diff PNG, industry-standard for visual regression.
 * Tier 2 (fallback, no extra install — repo doesn't have pixelmatch as a
 *         dependency and this harness must not touch the shared node_modules
 *         symlinked from the main repo): a perceptual grid-hash comparison
 *         built on `pngjs` (already a transitive dep). Downsamples both
 *         images to a fixed NxN grid of average-luminance cells and computes
 *         the mean absolute difference across cells as a 0..1 score. This is
 *         "rozmiar+hash z progiem": size mismatch is an instant FAIL; a
 *         color/content change moves the grid averages enough to cross the
 *         threshold even though it's not a literal per-pixel diff.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

let pixelmatchImpl = null;
export async function getPixelmatch() {
  if (pixelmatchImpl !== null) return pixelmatchImpl;
  try {
    const mod = await import('pixelmatch');
    pixelmatchImpl = mod.default ?? mod;
  } catch {
    pixelmatchImpl = false;
  }
  return pixelmatchImpl;
}

const GRID = 24; // 24x24 cells — coarse enough to survive AA jitter, fine enough to catch a color-swapped panel

function gridSignature(png) {
  const { width, height, data } = png;
  const cellW = width / GRID;
  const cellH = height / GRID;
  const sums = new Float64Array(GRID * GRID * 3); // r,g,b accumulators
  const counts = new Float64Array(GRID * GRID);

  for (let y = 0; y < height; y++) {
    const gy = Math.min(GRID - 1, Math.floor(y / cellH));
    for (let x = 0; x < width; x++) {
      const gx = Math.min(GRID - 1, Math.floor(x / cellW));
      const idx = (width * y + x) * 4;
      const cell = gy * GRID + gx;
      sums[cell * 3] += data[idx];
      sums[cell * 3 + 1] += data[idx + 1];
      sums[cell * 3 + 2] += data[idx + 2];
      counts[cell]++;
    }
  }

  const sig = new Float64Array(GRID * GRID * 3);
  for (let c = 0; c < GRID * GRID; c++) {
    const n = counts[c] || 1;
    sig[c * 3] = sums[c * 3] / n;
    sig[c * 3 + 1] = sums[c * 3 + 1] / n;
    sig[c * 3 + 2] = sums[c * 3 + 2] / n;
  }
  return sig;
}

function gridDiffRatio(sigA, sigB) {
  let total = 0;
  for (let i = 0; i < sigA.length; i++) {
    total += Math.abs(sigA[i] - sigB[i]);
  }
  // Normalize: max possible per-channel diff is 255, sigA.length channel-cells.
  return total / (sigA.length * 255);
}

/**
 * Compares two PNG files on disk.
 * Returns { status: 'match'|'diff'|'size-mismatch'|'new'|'missing-baseline',
 *           diffRatio, engine, diffPath? }
 */
export async function comparePng({ currentPath, baselinePath, diffPath, threshold = 0.0015 }) {
  let currentBuf;
  try {
    currentBuf = readFileSync(currentPath);
  } catch {
    return { status: 'missing-current', diffRatio: null, engine: 'n/a' };
  }

  let baselineBuf;
  try {
    baselineBuf = readFileSync(baselinePath);
  } catch {
    return { status: 'new', diffRatio: null, engine: 'n/a' };
  }

  const current = PNG.sync.read(currentBuf);
  const baseline = PNG.sync.read(baselineBuf);

  if (current.width !== baseline.width || current.height !== baseline.height) {
    return {
      status: 'size-mismatch',
      diffRatio: 1,
      engine: 'size',
      detail: `current ${current.width}x${current.height} vs baseline ${baseline.width}x${baseline.height}`,
    };
  }

  const pixelmatch = await getPixelmatch();
  if (pixelmatch) {
    const { width, height } = current;
    const diffPng = new PNG({ width, height });
    const diffPixels = pixelmatch(current.data, baseline.data, diffPng.data, width, height, {
      threshold: 0.1,
    });
    const diffRatio = diffPixels / (width * height);
    if (diffPath && diffRatio > threshold) {
      writeFileSync(diffPath, PNG.sync.write(diffPng));
    }
    return {
      status: diffRatio > threshold ? 'diff' : 'match',
      diffRatio,
      engine: 'pixelmatch',
    };
  }

  // Fallback: grid perceptual hash.
  const sigA = gridSignature(current);
  const sigB = gridSignature(baseline);
  const diffRatio = gridDiffRatio(sigA, sigB);
  return {
    status: diffRatio > threshold ? 'diff' : 'match',
    diffRatio,
    engine: 'grid-hash-fallback',
  };
}
