/**
 * Cover Layout — premium editorial redesign (W7.1 beat-Gamma, Fala 1).
 * Asserts the cover renders an eyebrow/kicker, an action title in the TITLE font,
 * an accent rule + left spine, and a Consultify wordmark. Uses a capturing mock
 * slide so we assert the real geometry the renderer emits.
 */
import { describe, expect, it } from 'vitest';

import { getDesignTokens } from '../../../server/src/services/report/pptx/designTokens.js';
import { CoverLayout } from '../../../server/src/services/report/pptx/layouts/CoverLayout.js';
import type {
  CoverContent,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../../../server/src/services/report/pptx/types.js';

interface Captured {
  texts: Array<{ text: any; opts: any }>;
  shapes: Array<{ type: any; opts: any }>;
  images: Array<{ opts: any }>;
}

function makeMockSlide(): Captured & {
  addText: (t: any, o: any) => void;
  addShape: (t: any, o: any) => void;
  addImage: (o: any) => void;
} {
  const texts: Captured['texts'] = [];
  const shapes: Captured['shapes'] = [];
  const images: Captured['images'] = [];
  return {
    texts,
    shapes,
    images,
    addText: (text, opts) => texts.push({ text, opts }),
    addShape: (type, opts) => shapes.push({ type, opts }),
    addImage: (opts) => images.push({ opts }),
  };
}

function runCover(meta: UnifiedReportMeta, content: CoverContent): Captured {
  const tokens = getDesignTokens('corporate');
  const slide: UnifiedSlide = { intent: 'cover', key_message: '', content };
  const result = CoverLayout(slide, meta, tokens);
  const mock = makeMockSlide();
  for (const el of result.elements) el.apply(mock as any);
  return { texts: mock.texts, shapes: mock.shapes, images: mock.images };
}

const baseMeta: UnifiedReportMeta = {
  client: 'DBR77',
  project: 'AI Readiness',
  date: '2026-06-28',
  author: 'Consultify',
  confidentiality: 'internal',
  language: 'en',
  framework: 'AI Readiness Assessment',
};

const baseContent: CoverContent = {
  type: 'cover',
  title: 'Transforming DBR77 into an AI-First Organization',
  subtitle: 'A board-level roadmap to measurable AI advantage',
  organization: 'DBR77',
  date: '2026-06-28',
};

describe('CoverLayout — premium editorial (Fala 1)', () => {
  it('renders an uppercase eyebrow/kicker in the accent color', () => {
    const { texts } = runCover(baseMeta, baseContent);
    const tokens = getDesignTokens('corporate');
    const eyebrow = texts.find((t) => String(t.text) === 'AI READINESS ASSESSMENT');
    expect(eyebrow).toBeTruthy();
    expect(eyebrow!.opts.color).toBe(tokens.colors.accent);
    expect(eyebrow!.opts.charSpacing).toBeGreaterThan(0);
  });

  it('renders the title in the TITLE font (not body), bold and left-aligned', () => {
    const { texts } = runCover(baseMeta, baseContent);
    const tokens = getDesignTokens('corporate');
    const title = texts.find((t) => String(t.text) === baseContent.title);
    expect(title).toBeTruthy();
    expect(title!.opts.fontFace).toBe(tokens.fonts.title);
    expect(title!.opts.bold).toBe(true);
    expect(title!.opts.align).toBe('left');
    expect(title!.opts.fontSize).toBeGreaterThanOrEqual(36);
  });

  it('renders an accent rule (line) and a left accent spine (rect)', () => {
    const { shapes } = runCover(baseMeta, baseContent);
    expect(shapes.some((s) => String(s.type) === 'line')).toBe(true);
    const spine = shapes.find(
      (s) => String(s.type) === 'rect' && s.opts.x === 0 && (s.opts.w as number) < 0.3
    );
    expect(spine).toBeTruthy();
  });

  it('renders the meta baseline and the Consultify wordmark', () => {
    const { texts } = runCover(baseMeta, baseContent);
    expect(texts.some((t) => String(t.text).includes('DBR77'))).toBe(true);
    expect(texts.some((t) => String(t.text) === 'CONSULTIFY')).toBe(true);
  });

  it('falls back to a generic PL kicker when no framework/sourceType', () => {
    const meta: UnifiedReportMeta = { ...baseMeta, language: 'pl', framework: undefined, sourceType: undefined };
    const { texts } = runCover(meta, baseContent);
    expect(texts.some((t) => String(t.text) === 'PREZENTACJA STRATEGICZNA')).toBe(true);
  });

  it('omits the subtitle text element when no subtitle is provided', () => {
    const { texts } = runCover(baseMeta, { ...baseContent, subtitle: undefined });
    expect(texts.some((t) => String(t.text) === baseContent.subtitle)).toBe(false);
  });
});
