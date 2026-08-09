import { describe, expect, it } from 'vitest';

import {
  documentSourceRefEvidenceText,
  documentSourceRefsEvidenceText,
} from '../documentStudioTypes.js';

describe('Document Studio source evidence', () => {
  it('prefers the explicit source excerpt', () => {
    expect(
      documentSourceRefEvidenceText({
        sourceType: 'text',
        sourceId: 'stable-id',
        sourceTitle: 'period KPIs',
        sourceExcerpt: 'Delivery 72% vs 75%; annual benefit EUR 2.2m.',
      })
    ).toBe('Delivery 72% vs 75%; annual benefit EUR 2.2m.');
  });

  it('reads the legacy text binding without treating arbitrary IDs as evidence', () => {
    expect(
      documentSourceRefEvidenceText({
        sourceType: 'text',
        sourceId: 'text:risks:Migration delay; adoption risk',
        sourceTitle: 'risks',
      })
    ).toBe('Migration delay; adoption risk');
    expect(
      documentSourceRefEvidenceText({
        sourceType: 'interview',
        sourceId: 'interview-123',
        sourceTitle: 'CFO interview',
      })
    ).toBe('');
  });

  it('builds a labelled grounding corpus', () => {
    expect(
      documentSourceRefsEvidenceText([
        {
          sourceType: 'text',
          sourceId: 'kpi-id',
          sourceTitle: 'period KPIs',
          sourceExcerpt: 'Delivery 72% vs 75%',
        },
        {
          sourceType: 'text',
          sourceId: 'risk-id',
          sourceTitle: 'risks',
          sourceExcerpt: 'Data migration delay',
        },
      ])
    ).toBe('period KPIs: Delivery 72% vs 75%\nrisks: Data migration delay');
  });
});
