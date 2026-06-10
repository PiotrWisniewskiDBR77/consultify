/**
 * PNG export rasterization — integration coverage (Module 12 audit gap #5).
 *
 * The `/decks/:deckId/export/png` route rasterizes each slide by rendering a
 * card to SVG (`renderCardToSvg`) and piping it through `sharp(...).png()`.
 * Before PNG export can be advertised in the UI we must confirm that this
 * primitive actually produces a *valid* raster image — not just that the
 * route returns 200.
 *
 * This test exercises the exact rasterization path the route uses:
 *   renderCardToSvg(card) -> sharp(Buffer.from(svg)).png().toBuffer()
 * and asserts:
 *   - the SVG is well-formed at the slide canvas size (1920x1080)
 *   - sharp returns a buffer with the PNG magic-byte signature
 *   - sharp can decode the buffer back into PNG metadata with the right dims
 */

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { renderCardToSvg } from '../presentations.routes.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('PNG export rasterization primitive', () => {
  const card = {
    title: 'Quarterly Strategy Review',
    key_message: 'Q3 outcomes & Q4 priorities',
    blocks: [
      { type: 'text', content: { text: 'Revenue grew 18% QoQ on enterprise expansion.' } },
      { type: 'bullet_list', content: { items: ['Expand EMEA', 'Ship Studio v2', 'Hire 3 AEs'] } },
      { type: 'metric', content: { label: 'NRR', value: '124%' } },
    ],
    header_footer: {
      confidentiality: 'confidential',
      footerText: 'Consultify',
      pageNumber: 1,
      totalPages: 12,
    },
  };

  it('renders a well-formed slide SVG at the deck canvas size', () => {
    const svg = renderCardToSvg(card, 0, 'Board Deck', 'corporate');
    expect(svg).toContain('<svg');
    expect(svg).toContain('width="1920"');
    expect(svg).toContain('height="1080"');
    // Content from the card must make it into the SVG.
    expect(svg).toContain('Quarterly Strategy Review');
    // XML-special characters must be escaped so sharp/librsvg can parse it.
    expect(svg).not.toMatch(/<text[^>]*>[^<]*&(?!amp;|lt;|gt;|quot;)/);
  });

  it('rasterizes the slide SVG into a valid PNG buffer via sharp', async () => {
    const svg = renderCardToSvg(card, 0, 'Board Deck', 'corporate');
    const pngBuffer = await sharp(Buffer.from(svg, 'utf-8')).png().toBuffer();

    expect(Buffer.isBuffer(pngBuffer)).toBe(true);
    expect(pngBuffer.length).toBeGreaterThan(0);
    // Valid PNG files begin with the 8-byte PNG signature.
    expect(pngBuffer.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  });

  it('produces a PNG sharp can decode back to the correct dimensions', async () => {
    const svg = renderCardToSvg(card, 2, 'Board Deck', 'modern');
    const pngBuffer = await sharp(Buffer.from(svg, 'utf-8')).png().toBuffer();

    const metadata = await sharp(pngBuffer).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(1920);
    expect(metadata.height).toBe(1080);
  });

  it('escapes hostile card content so rasterization cannot break or inject', async () => {
    const hostileCard = {
      title: 'Risks & "edge" cases <script>',
      blocks: [{ type: 'text', content: { text: 'a < b && c > d "quoted"' } }],
    };
    const svg = renderCardToSvg(hostileCard, 0, 'Deck & Co', 'minimal');
    // No raw script tag should survive escaping.
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&amp;');

    // And it must still rasterize to a valid PNG.
    const pngBuffer = await sharp(Buffer.from(svg, 'utf-8')).png().toBuffer();
    expect(pngBuffer.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  });
});
