import { describe, expect, it } from 'vitest';

import { generateInteractiveHtml } from '../presentationHtmlExportService.js';

describe('presentationHtmlExportService structured blocks', () => {
  it('renders smart layout, timeline and table semantically without raw JSON or type placeholders', () => {
    const html = generateInteractiveHtml({
      title: 'Nova decision',
      theme: {
        primary: '#123456',
        secondary: '#234567',
        accent: '#00aacc',
        background: '#ffffff',
        surface: '#f4f6f8',
        textPrimary: '#111111',
        textSecondary: '#555555',
        heading: '#123456',
      },
      cards: [
        {
          card_id: 'card-1',
          title: 'Decision evidence',
          background: { type: 'theme' },
          animations: { entrance: 'fade', block_stagger: false },
          blocks: [
            {
              block_id: 'smart',
              type: 'smart_layout',
              content: { layoutType: '3col', items: [{ title: 'Scale', description: 'Best NPV' }] },
            },
            {
              block_id: 'timeline',
              type: 'timeline_block',
              content: { items: [{ date: 'Q1', title: 'Mobilise', description: 'Set controls' }] },
            },
            {
              block_id: 'table',
              type: 'table',
              content: { headers: ['Risk', 'Owner'], rows: [['Adoption', 'COO']] },
            },
          ],
        },
      ],
    });

    expect(html).toContain('Best NPV');
    expect(html).toContain('Mobilise');
    expect(html).toContain('<table');
    expect(html).toContain('Adoption');
    expect(html).not.toContain('[smart_layout]');
    expect(html).not.toContain('[timeline_block]');
    expect(html).not.toContain('[table]');
    expect(html).not.toContain('&quot;layoutType&quot;');
  });
});
