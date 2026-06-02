import { describe, expect, it } from 'vitest';

import {
  createJsonContentEnvelope,
  createMarkdownContentEnvelope,
  validateArtifactContentEnvelope,
} from '../../../src/types/artifactContent';
import { projectArtifactToMarkdown } from '../../../server/src/services/artifacts/contentProjectionService';

describe('Canvas content contract', () => {
  it('validates markdown-canonical artifacts', () => {
    const envelope = createMarkdownContentEnvelope({
      artifactType: 'document',
      contentMd: '# Decision memo',
    });

    expect(validateArtifactContentEnvelope(envelope)).toEqual({ valid: true, errors: [] });
  });

  it('requires JSON-native artifacts to carry native JSON', () => {
    const envelope = createJsonContentEnvelope({
      artifactType: 'table',
      contentJson: { rows: [{ KPI: 'Revenue', Target: '10%' }] },
      contentMd: '| KPI | Target |\n|---|---|\n| Revenue | 10% |',
    });

    expect(envelope.canonicalFormat).toBe('json');
    expect(validateArtifactContentEnvelope(envelope).valid).toBe(true);
  });

  it('projects tables without exposing raw JSON as UI text', () => {
    const projection = projectArtifactToMarkdown('table', {
      title: 'KPI model',
      rows: [{ KPI: 'Revenue', Target: '10%' }],
    });

    expect(projection.status).toBe('synced');
    expect(projection.contentMd).toContain('| KPI | Target |');
    expect(projection.contentMd).not.toContain('{"');
  });

  it('projects decks into readable slide sections', () => {
    const projection = projectArtifactToMarkdown('deck', {
      title: 'Board update',
      slides: [{ title: 'Summary', bullets: ['Growth up', 'Risk under review'] }],
    });

    expect(projection.contentMd).toContain('# Board update');
    expect(projection.contentMd).toContain('## Slide 1: Summary');
    expect(projection.contentMd).toContain('- Growth up');
  });
});

