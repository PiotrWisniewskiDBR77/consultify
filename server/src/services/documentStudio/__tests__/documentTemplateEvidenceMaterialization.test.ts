import { describe, expect, it } from 'vitest';

import { replaceTemplatePlaceholdersWithEvidence } from '../documentStudioService.js';
import type { DocumentSection, DocumentSourceRef } from '../documentStudioTypes.js';

const placeholder = 'Content removed — unsupported claim (assumption to verify).';

function section(title: string, type: 'paragraph' | 'risk_table' = 'paragraph'): DocumentSection {
  return {
    sectionId: title,
    orderIndex: 0,
    level: 1,
    title,
    blocks: [{ blockId: `${title}-block`, type, content: { text: placeholder } }],
    sourceRefs: [],
  };
}

describe('template evidence materialization', () => {
  it('replaces placeholder decisions, risks, financials and next steps with supplied evidence', () => {
    const refs: DocumentSourceRef[] = [
      {
        sourceType: 'text',
        sourceId: 'kpi',
        sourceTitle: 'period KPIs',
        sourceExcerpt: 'Delivery 72% vs 75%; annual benefit EUR 2.2m; spend EUR 1.08m.',
      },
      {
        sourceType: 'text',
        sourceId: 'decision',
        sourceTitle: 'decisions required',
        sourceExcerpt: 'Lock scope by 15 August; confirm Operations owner.',
      },
      {
        sourceType: 'text',
        sourceId: 'risk',
        sourceTitle: 'risks',
        sourceExcerpt:
          'Data migration delay — mitigation: parallel reconciliation. Adoption risk — mitigation: named champions.',
      },
    ];
    const sections = [
      section('Executive Summary'),
      section('Decisions Required'),
      section('Financial Snapshot'),
      section('Risks', 'risk_table'),
      section('Next Steps'),
    ];

    replaceTemplatePlaceholdersWithEvidence(refs, sections);
    const serialized = JSON.stringify(sections);

    expect(serialized).not.toContain('Content removed');
    expect(serialized).toContain('72%');
    expect(serialized).toContain('EUR 2.2m');
    expect(serialized).toContain('Lock scope by 15 August');
    expect(serialized).toContain('Data migration delay');
    expect(serialized).toContain('parallel reconciliation');
    expect(serialized).toContain('We recommend approval of the following board decisions');
    expect(sections[1].blocks[0].type).toBe('numbered_list');
    expect(sections[3].blocks[0].type).toBe('risk_table');
    expect(sections[4].blocks[0].type).toBe('numbered_list');
  });
});
