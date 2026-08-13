#!/usr/bin/env node
/**
 * contrast-ratio.mjs — RISK-35 (S1-CONTRAST) reusable WCAG contrast measurement tool.
 *
 * Implements the SAME method §21_FOCUS_AND_CONTRAST.md §3 describes as "Method 1":
 * composite every ancestor's background-color in outermost-to-innermost order
 * (Porter-Duff "over"), multiply the foreground's alpha by the cumulative opacity
 * of the element and its ancestors, then apply the standard WCAG 2.x contrast
 * formula to the two OPAQUE composited colours.
 *
 * Usage (CLI):
 *   node scripts/contrast-ratio.mjs <fgR> <fgG> <fgB> <bgR> <bgG> <bgB> [fgAlpha=1]
 *   node scripts/contrast-ratio.mjs composite <fgR> <fgG> <fgB> <fgAlpha> <bgR> <bgG> <bgB>
 *   node scripts/contrast-ratio.mjs min-opacity <fgR> <fgG> <fgB> <bgR> <bgG> <bgB> <targetRatio>
 *
 * Usage (import):
 *   import { contrastRatio, compositeOver, relativeLuminance, minOpacityForRatio } from './contrast-ratio.mjs';
 */

/** sRGB channel (0-255) -> linear channel, per WCAG 2.x. */
function srgbToLinear(c) {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

/** Relative luminance of an opaque [r,g,b] (0-255 each). */
export function relativeLuminance([r, g, b]) {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG contrast ratio between two OPAQUE colors (order-independent). */
export function contrastRatio(rgbA, rgbB) {
  const lA = relativeLuminance(rgbA);
  const lB = relativeLuminance(rgbB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Porter-Duff "over": composite a translucent foreground [r,g,b] with alpha
 * (0-1, already the CUMULATIVE product of element opacity × all ancestor
 * opacities) onto an OPAQUE background [r,g,b]. Returns an opaque [r,g,b].
 */
export function compositeOver([fr, fg, fb], alpha, [br, bg, bb]) {
  const a = Math.max(0, Math.min(1, alpha));
  return [
    Math.round(fr * a + br * (1 - a)),
    Math.round(fg * a + bg * (1 - a)),
    Math.round(fb * a + bb * (1 - a)),
  ];
}

/**
 * Composite a full ancestor chain of backgrounds (outermost-to-innermost),
 * each possibly translucent, onto an implicit opaque canvas, THEN composite
 * the foreground (with its own cumulative alpha) on top. Mirrors the method
 * §21_FOCUS_AND_CONTRAST.md §3 names "ancestor-walk compositing".
 *
 * @param {[number,number,number]} fg foreground opaque color
 * @param {number} fgAlpha cumulative foreground alpha (element × ancestors)
 * @param {Array<{rgb:[number,number,number], alpha?:number}>} bgChain outermost→innermost
 * @param {[number,number,number]} canvas the base canvas color under everything (e.g. --c-bg)
 */
export function compositeChain(fg, fgAlpha, bgChain, canvas) {
  let bg = canvas;
  for (const layer of bgChain) {
    bg = compositeOver(layer.rgb, layer.alpha ?? 1, bg);
  }
  const finalFg = compositeOver(fg, fgAlpha, bg);
  return { compositedBackground: bg, compositedForeground: finalFg };
}

/**
 * Binary search: minimum alpha (0-1] at which `fg` composited over `bg`
 * clears `targetRatio`. Returns null if even alpha=1 cannot clear it (color
 * choice itself is insufficient, not just the opacity).
 */
export function minOpacityForRatio(fg, bg, targetRatio, precision = 0.001) {
  if (contrastRatio(compositeOver(fg, 1, bg), bg) < targetRatio) return null;
  let lo = 0;
  let hi = 1;
  while (hi - lo > precision) {
    const mid = (lo + hi) / 2;
    const composited = compositeOver(fg, mid, bg);
    if (contrastRatio(composited, bg) >= targetRatio) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return hi;
}

// ── CLI ──────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'composite') {
    const [, fr, fgc, fb, fa, br, bgc, bb] = args.map((v, i) => (i === 0 ? v : Number(v)));
    const composited = compositeOver([fr, fgc, fb], fa, [br, bgc, bb]);
    const ratio = contrastRatio(composited, [br, bgc, bb]);
    console.log(
      JSON.stringify({ compositedForeground: composited, ratio: Number(ratio.toFixed(2)) })
    );
    return;
  }
  if (args[0] === 'min-opacity') {
    const [, fr, fgc, fb, br, bgc, bb, target] = args.map((v, i) => (i === 0 ? v : Number(v)));
    const alpha = minOpacityForRatio([fr, fgc, fb], [br, bgc, bb], target);
    console.log(JSON.stringify({ minAlpha: alpha === null ? null : Number(alpha.toFixed(4)) }));
    return;
  }
  const [fr, fgc, fb, br, bgc, bb, fa] = args.map(Number);
  const alpha = Number.isFinite(fa) ? fa : 1;
  const composited = compositeOver([fr, fgc, fb], alpha, [br, bgc, bb]);
  const ratio = contrastRatio(composited, [br, bgc, bb]);
  console.log(
    JSON.stringify({
      compositedForeground: composited,
      ratio: Number(ratio.toFixed(2)),
      pass_3_0: ratio >= 3.0,
      pass_4_5: ratio >= 4.5,
    })
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
