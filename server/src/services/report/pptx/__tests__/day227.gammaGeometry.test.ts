import { mkdir, readFile, writeFile } from 'node:fs/promises';

import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';

const EMU_PER_INCH = 914_400;
const CONTENT_MARKER = 'DAY227 geometry proof';

type Point = { x: number; y: number };

function shapePoint(shapeXml: string): Point {
  const offset = shapeXml.match(/<a:off x="(\d+)" y="(\d+)"/);
  if (!offset) throw new Error('Shape has no OOXML offset');
  return { x: Number(offset[1]) / EMU_PER_INCH, y: Number(offset[2]) / EMU_PER_INCH };
}

function canonicalContentPoint(xml: string): Point {
  const card = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].find((match) =>
    match[0].includes('prst="roundRect"')
  );
  if (!card) throw new Error('Canonical PPTX has no key-message card');
  return shapePoint(card[0]);
}

function fallbackContentPoint(xml: string): Point {
  const body = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].find((match) =>
    match[0].includes(CONTENT_MARKER)
  );
  if (!body) throw new Error('Fallback PPTX has no marked content body');
  return shapePoint(body[0]);
}

async function generatePair(enabled: boolean): Promise<{
  canonical: Buffer;
  fallback: Buffer;
  canonicalPoint: Point;
  fallbackPoint: Point;
}> {
  process.env.ENABLE_PPTX_CANONICAL_GEOMETRY = enabled ? 'true' : 'false';
  vi.resetModules();

  const [{ PptxPipelineService }, { deckPlansToPptxBuffer }] = await Promise.all([
    import('../PptxPipelineService.js'),
    import('../../../deliverables/bundlePptxRuntime.js'),
  ]);

  const canonicalResult = await new PptxPipelineService().generateFromUnifiedJson(
    {
      meta: {
        client: 'Day 227',
        project: 'Geometry parity',
        date: '2026-09-01',
        author: 'Consultify',
        confidentiality: 'internal',
        language: 'en',
      },
      slides: [
        {
          intent: 'key_messages',
          key_message: 'One geometry',
          content: {
            type: 'key_messages',
            messages: [{ title: 'Proof', description: CONTENT_MARKER }],
          },
        },
      ],
    },
    { addClosingSlide: false, skipValidation: true }
  );
  const fallback = await deckPlansToPptxBuffer(
    [
      {
        slideIndex: 1,
        layoutIntent: 'plain',
        title: 'One geometry',
        keyMessage: CONTENT_MARKER,
      },
    ],
    { title: 'Geometry parity', company: 'Day 227', language: 'en', date: '2026-09-01' }
  );
  if (!fallback) throw new Error('Fallback renderer returned null');

  const canonicalZip = await JSZip.loadAsync(canonicalResult.buffer);
  const fallbackZip = await JSZip.loadAsync(fallback);
  const canonicalSlide = canonicalZip.file('ppt/slides/slide1.xml');
  const fallbackSlide = fallbackZip.file('ppt/slides/slide2.xml');
  if (!canonicalSlide || !fallbackSlide) throw new Error('Generated PPTX has no content slide');
  const canonicalXml = await canonicalSlide.async('string');
  const fallbackXml = await fallbackSlide.async('string');

  const artifactDir = process.env.DAY227_ARTIFACT_DIR;
  if (artifactDir && enabled) {
    await mkdir(artifactDir, { recursive: true });
    await Promise.all([
      writeFile(`${artifactDir}/day227-canonical-on.pptx`, canonicalResult.buffer),
      writeFile(`${artifactDir}/day227-fallback-on.pptx`, fallback),
    ]);
  }

  return {
    canonical: canonicalResult.buffer,
    fallback,
    canonicalPoint: canonicalContentPoint(canonicalXml),
    fallbackPoint: fallbackContentPoint(fallbackXml),
  };
}

async function resolveHarvardPalette(enabled: boolean): Promise<string | undefined> {
  process.env.ENABLE_PPTX_CANONICAL_GEOMETRY = enabled ? 'true' : 'false';
  vi.resetModules();
  vi.doMock('../../../deliverableGenerationTier.js', () => ({
    resolveDeliverableTier: () => 'PREMIUM',
  }));
  vi.doMock('../../../presentationLayoutDirectorService.js', () => ({
    planDeckLayout: async () => ({
      plans: [{ paletteId: 'harvard', source: 'deterministic' }],
    }),
  }));

  const { planDeckVisualsTiered } = await import('../../../presentationVisualDirectorService.js');
  const result = await planDeckVisualsTiered({
    slides: [
      {
        intent: 'key_messages',
        key_message: 'Brand proof',
        content: { type: 'key_messages', messages: [] },
      },
    ],
    meta: {
      client: 'Day 227',
      project: 'Brand parity',
      date: '2026-09-01',
      author: 'Consultify',
      confidentiality: 'internal',
      language: 'en',
    },
    deckTitle: 'Brand parity',
    audience: 'owner',
    goal: 'proof',
    settings: { enabled: false },
    preferPremium: true,
  });
  vi.doUnmock('../../../deliverableGenerationTier.js');
  vi.doUnmock('../../../presentationLayoutDirectorService.js');
  return result.deckPaletteHex;
}

describe('Day 227 canonical PPTX geometry', { retry: 0 }, () => {
  afterEach(() => {
    delete process.env.ENABLE_PPTX_CANONICAL_GEOMETRY;
    vi.resetModules();
  });

  it('measures legacy OFF output as 0.1in wider margin and 0.7in lower content', async () => {
    const pair = await generatePair(false);

    expect(pair.canonical.length).toBeGreaterThan(0);
    expect(pair.fallback.length).toBeGreaterThan(0);
    expect(pair.canonicalPoint).toEqual({ x: 0.5, y: 1 });
    expect(pair.fallbackPoint.x - pair.canonicalPoint.x).toBeCloseTo(0.1, 6);
    expect(pair.fallbackPoint.y - pair.canonicalPoint.y).toBeCloseTo(0.7, 6);
  });

  it('measures flag ON output from both real PPTX files at the same content coordinates', async () => {
    const pair = await generatePair(true);

    expect(pair.canonical.length).toBeGreaterThan(0);
    expect(pair.fallback.length).toBeGreaterThan(0);
    expect(pair.fallbackPoint.x - pair.canonicalPoint.x).toBeCloseTo(0, 6);
    expect(pair.fallbackPoint.y - pair.canonicalPoint.y).toBeCloseTo(0, 6);
  });

  it('keeps the server brand bridge synchronized with the frontend canonical token', async () => {
    const [{ PRODUCT_BRAND_PRIMARY }, tailwindSource, cssSource] = await Promise.all([
      import('../productBrandTokens.js'),
      readFile('tailwind.config.js', 'utf8'),
      readFile('src/index.css', 'utf8'),
    ]);

    expect(tailwindSource).toContain(`DEFAULT: '${PRODUCT_BRAND_PRIMARY}'`);
    expect(cssSource).toContain(`crimson-600 ${PRODUCT_BRAND_PRIMARY}`);
  });

  it('keeps Harvard legacy color OFF and resolves the product brand bridge ON', async () => {
    expect(await resolveHarvardPalette(false)).toBe('A41034');
    expect(await resolveHarvardPalette(true)).toBe('85182F');
  });
});
