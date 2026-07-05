/**
 * captureScreenshot
 *
 * Uses html-to-image (already a dependency) to grab a compressed JPEG of the
 * current viewport. Before rasterising we flip the attribute
 * `data-feedback-redact-active="1"` on <html> so consumers can hide PII with
 * a CSS rule while the shot is taken.
 *
 * We also force a hard visual redact on all obviously sensitive inputs in the
 * cloned subtree (password, email, tel, card-number, etc.) — this is done in
 * the `filter` hook so the user's live DOM is never touched.
 *
 * Output: data URL string (jpeg) capped at ~800 KB (downscale + quality).
 * Returns null on any failure — feedback flow must still work without a shot.
 */

import { toJpeg } from 'html-to-image';

export interface CaptureResult {
  dataUrl: string;
  approxBytes: number;
  width: number;
  height: number;
  tookMs: number;
}

const DEFAULT_MAX_WIDTH = 1600;
const DEFAULT_QUALITY = 0.82;
const MAX_BYTES = 800 * 1024;

const SENSITIVE_INPUT_TYPES = new Set([
  'password',
  'email',
  'tel',
  'cc-number',
  'cc-csc',
  'cc-exp',
]);

function shouldRedactNode(node: Node): boolean {
  if (!(node instanceof Element)) return false;
  // Feedback #64133ece — the report panel (and its dimming backdrop) are
  // still mounted in document.body while the screenshot is taken, so an
  // un-excluded capture shows the panel/backdrop covering the real page
  // instead of the content the user is trying to report. html-to-image's
  // filter fully omits matched nodes from the render, which — since the
  // clone re-lays out the tree from scratch rather than compositing
  // z-index layers — reveals the underlying page content in their place.
  if (node.hasAttribute('data-feedback-capture-exclude')) return true;
  if (node.hasAttribute('data-feedback-redact')) return true;
  const tag = node.tagName.toLowerCase();
  if (tag === 'input') {
    const type = (node.getAttribute('type') || '').toLowerCase();
    if (SENSITIVE_INPUT_TYPES.has(type)) return true;
    const autocomplete = (node.getAttribute('autocomplete') || '').toLowerCase();
    if (autocomplete.includes('password') || autocomplete.includes('email')) return true;
    const aria = (node.getAttribute('aria-label') || '').toLowerCase();
    if (aria.includes('password') || aria.includes('email')) return true;
  }
  return false;
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaAt = dataUrl.indexOf(',');
  if (commaAt < 0) return dataUrl.length;
  const base64Len = dataUrl.length - commaAt - 1;
  return Math.floor((base64Len * 3) / 4);
}

export async function captureScreenshot(
  target?: HTMLElement,
  overrides?: { maxWidth?: number; quality?: number }
): Promise<CaptureResult | null> {
  if (typeof document === 'undefined') return null;
  const node = target || document.body;
  if (!node) return null;

  const root = document.documentElement;
  const hadFlag = root.hasAttribute('data-feedback-redact-active');
  root.setAttribute('data-feedback-redact-active', '1');

  const startedAt = performance.now();

  try {
    const maxWidth = overrides?.maxWidth ?? DEFAULT_MAX_WIDTH;
    const quality = overrides?.quality ?? DEFAULT_QUALITY;
    const currentWidth = Math.max(node.clientWidth, window.innerWidth, 1);
    const pixelRatio = Math.min(2, Math.max(0.5, maxWidth / currentWidth));

    const dataUrl = await toJpeg(node, {
      quality,
      pixelRatio,
      cacheBust: true,
      skipFonts: false,
      backgroundColor: getComputedStyle(document.body).backgroundColor || '#0f172a',
      filter: (el) => !shouldRedactNode(el),
    });

    if (!dataUrl || dataUrl.length < 100) return null;

    let finalUrl = dataUrl;
    const approx = estimateDataUrlBytes(finalUrl);
    if (approx > MAX_BYTES) {
      try {
        finalUrl = await toJpeg(node, {
          quality: 0.6,
          pixelRatio: pixelRatio * 0.7,
          cacheBust: true,
          skipFonts: false,
          backgroundColor: getComputedStyle(document.body).backgroundColor || '#0f172a',
          filter: (el) => !shouldRedactNode(el),
        });
      } catch {
        // fall back to oversized shot — caller may still accept
      }
    }

    const width = Math.round(currentWidth * pixelRatio);
    const height = Math.round(node.clientHeight * pixelRatio);

    return {
      dataUrl: finalUrl,
      approxBytes: estimateDataUrlBytes(finalUrl),
      width,
      height,
      tookMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('[feedbackCollector] captureScreenshot failed:', error);
    }
    return null;
  } finally {
    if (!hadFlag) root.removeAttribute('data-feedback-redact-active');
  }
}
