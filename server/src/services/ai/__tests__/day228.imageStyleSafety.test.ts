import { readFileSync } from 'node:fs';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildImageStyleAppendix,
  generateImageVisual,
  IMAGE_STYLE_PRESET_PROMPTS,
} from '../deckVisualsService.js';
import { detectTextInGeneratedImage } from '../deckImageSafetyGates.js';

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

const selection = (provider: string) => ({
  provider: { id: 'day228', provider },
  apiKey: 'not-used-by-injected-generator',
  modelId: 'day228-model',
});

const baseParams = {
  deckId: 'day228-test',
  organizationId: 'day228-org',
  meta: {} as any,
  purpose: 'image_slide_asset' as const,
  slot: 'side_illustration' as const,
  label: 'Day 228 test image',
  prompt: 'BASE PROMPT',
  styleAppendix: 'THEME FIRST PRESET SECOND',
  priority: 'quality' as const,
  filenamePrefix: 'day228',
};

describe('Day 228 image style prompt and safety gates', () => {
  afterEach(() => {
    delete process.env.ENABLE_PRESENTATION_IMAGE_STYLE;
  });

  it.each(['openai', 'gemini', 'replicate'])(
    'sends the appended prompt through the %s provider branch when ON',
    async (provider) => {
      process.env.ENABLE_PRESENTATION_IMAGE_STYLE = 'true';
      const prompts: string[] = [];
      const result = await generateImageVisual({
        ...baseParams,
        dependencies: {
          selection: selection(provider),
          generate: async (_provider, prompt) => {
            prompts.push(prompt);
            return PIXEL;
          },
          detectText: async () => ({ hasText: false }),
          detectFace: async () => ({ hasFace: false }),
        },
      });
      expect(result.warning).toBeUndefined();
      expect(prompts).toEqual(['BASE PROMPT THEME FIRST PRESET SECOND']);
    }
  );

  it('keeps the original prompt byte-for-byte and skips both gates when OFF', async () => {
    process.env.ENABLE_PRESENTATION_IMAGE_STYLE = 'false';
    const prompts: string[] = [];
    let gateCalls = 0;
    await generateImageVisual({
      ...baseParams,
      dependencies: {
        selection: selection('openai'),
        generate: async (_provider, prompt) => {
          prompts.push(prompt);
          return PIXEL;
        },
        detectText: async () => {
          gateCalls += 1;
          return { hasText: false };
        },
        detectFace: async () => {
          gateCalls += 1;
          return { hasFace: false };
        },
      },
    });
    expect(prompts).toEqual(['BASE PROMPT']);
    expect(gateCalls).toBe(0);
  });

  it.each(Object.entries(IMAGE_STYLE_PRESET_PROMPTS))(
    'maps preset %s to its named prompt fragment',
    (preset, fragment) => {
      expect(buildImageStyleAppendix(undefined, preset)).toBe(fragment);
    }
  );

  it('orders theme text before the named preset fragment', () => {
    const appendix = buildImageStyleAppendix('BRAND THEME', 'abstract_geometric');
    expect(appendix).toBe(`BRAND THEME ${IMAGE_STYLE_PRESET_PROMPTS.abstract_geometric}`);
  });

  it('retries exactly three times after face rejection and then uses stock fallback', async () => {
    process.env.ENABLE_PRESENTATION_IMAGE_STYLE = 'true';
    let attempts = 0;
    let fallbackCalls = 0;
    const result = await generateImageVisual({
      ...baseParams,
      dependencies: {
        selection: selection('openai'),
        generate: async () => {
          attempts += 1;
          return PIXEL;
        },
        detectText: async () => ({ hasText: false }),
        detectFace: async () => ({ hasFace: true }),
        stockFallback: async (params) => {
          fallbackCalls += 1;
          return {
            slot: params.slot,
            purpose: params.purpose,
            label: params.label,
            prompt: params.prompt,
            asset: { url: 'https://stock.invalid/day228.png', provider: 'stock:test' },
          } as any;
        },
      },
    });
    expect(attempts).toBe(3);
    expect(fallbackCalls).toBe(1);
    expect(result.visual?.asset?.provider).toBe('stock:test');
  });

  it('accepts an image when neither OCR nor face gate finds forbidden content', async () => {
    process.env.ENABLE_PRESENTATION_IMAGE_STYLE = 'true';
    const result = await generateImageVisual({
      ...baseParams,
      dependencies: {
        selection: selection('openai'),
        generate: async () => PIXEL,
        detectText: async () => ({ hasText: false }),
        detectFace: async () => ({ hasFace: false }),
      },
    });
    expect(result.visual?.asset?.path).toBeTruthy();
  });

  it('runs real tesseract OCR on text and blank PNG fixtures', async () => {
    const textPng = await sharp({
      create: { width: 900, height: 240, channels: 3, background: '#ffffff' },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="900" height="240"><text x="40" y="150" font-size="96" font-family="Arial" fill="black">CONSULTIFY</text></svg>'
          ),
        },
      ])
      .png()
      .toBuffer();
    const blankPng = await sharp({
      create: { width: 900, height: 240, channels: 3, background: '#2255aa' },
    })
      .png()
      .toBuffer();

    const withText = await detectTextInGeneratedImage(textPng);
    const blank = await detectTextInGeneratedImage(blankPng);
    expect(withText.hasText).toBe(true);
    expect(blank.hasText).toBe(false);
    expect(readFileSync(new URL('../deckImageSafetyGates.ts', import.meta.url), 'utf8')).toContain(
      'tesseract.recognize'
    );
  }, 60_000);
});
