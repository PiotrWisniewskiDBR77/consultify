import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  reports: new Map<string, any>(),
  sections: new Map<string, any[]>(),
  decks: new Map<string, any>(),
  artifacts: new Map<string, any>(),
  origins: new Map<string, any>(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  get: vi.fn(async (sql: string, params: unknown[]) => {
    const key = `${params[1]}:${params[0]}`;
    if (sql.includes('FROM report_builder_reports')) return state.reports.get(key) || null;
    if (sql.includes('FROM presentation_decks')) return state.decks.get(key) || null;
    if (sql.includes('FROM v8_output_artifacts')) return state.artifacts.get(key) || null;
    if (sql.includes('FROM v8_artifact_origin_links')) return state.origins.get(key) || null;
    return null;
  }),
  all: vi.fn(async (sql: string, params: unknown[]) => {
    if (!sql.includes('FROM report_builder_sections')) return [];
    return [...(state.sections.get(`${params[1]}:${params[0]}`) || [])].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.id.localeCompare(b.id)
    );
  }),
}));

import {
  clearArtifactContentAdaptersForTests,
  registerArtifactContentAdapter,
  resolveArtifactContent,
} from '../artifacts/artifactContentResolverService.js';
import { presentationArtifactContentAdapter } from '../artifacts/presentationArtifactContentAdapter.js';
import { reportArtifactContentAdapter } from '../artifacts/reportArtifactContentAdapter.js';

function reportSection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'section-1',
    section_key: 'summary',
    title: 'Summary',
    order_index: 1,
    content_format: 'markdown',
    generated_content: 'Generated content',
    edited_content: null,
    updated_at: '2026-07-31T10:00:00.000Z',
    ...overrides,
  };
}

describe('report/presentation artifact content adapters', () => {
  beforeEach(() => {
    state.reports.clear();
    state.sections.clear();
    state.decks.clear();
    state.artifacts.clear();
    state.origins.clear();
    clearArtifactContentAdaptersForTests();
  });

  it('resolves generated report content and enforces tenant scope', async () => {
    state.reports.set('org-a:report-1', {
      id: 'report-1',
      title: 'Board report',
      updated_at: '2026-07-31T10:00:00.000Z',
    });
    state.sections.set('org-a:report-1', [reportSection()]);

    const resolved = await reportArtifactContentAdapter.resolve({
      artifactId: 'artifact-1',
      organizationId: 'org-a',
      originRuntime: 'report',
      originRecordId: 'report-1',
    });
    expect(resolved?.envelope.contentMd).toContain('Generated content');
    expect(resolved?.envelope.projection.status).toBe('synced');
    await expect(
      reportArtifactContentAdapter.resolve({
        artifactId: 'artifact-1',
        organizationId: 'org-b',
        originRuntime: 'report',
        originRecordId: 'report-1',
      })
    ).resolves.toBeNull();
  });

  it('uses edited report content before generated and preserves mixed formats in order', async () => {
    state.reports.set('org-a:report-1', {
      id: 'report-1',
      title: 'Mixed report',
      updated_at: '2026-07-31T10:00:00.000Z',
    });
    state.sections.set('org-a:report-1', [
      reportSection({
        id: 'json-2',
        title: 'Data',
        order_index: 2,
        content_format: 'json',
        generated_content: JSON.stringify({ generated: true }),
        edited_content: JSON.stringify({ edited: true }),
      }),
      reportSection({
        id: 'md-1',
        title: 'Intro',
        order_index: 1,
        generated_content: 'First section',
      }),
      reportSection({
        id: 'tip-3',
        title: 'Rich text',
        order_index: 3,
        content_format: 'tiptap',
        generated_content: JSON.stringify({ type: 'doc', content: [] }),
      }),
    ]);

    const resolved = await reportArtifactContentAdapter.resolve({
      artifactId: 'artifact-1',
      organizationId: 'org-a',
      originRuntime: 'report',
      originRecordId: 'report-1',
    });
    const sections = (resolved?.envelope.contentJson as any).sections;
    expect(sections.map((section: any) => section.title)).toEqual(['Intro', 'Data', 'Rich text']);
    expect(sections[1]).toMatchObject({
      format: 'json',
      content: { edited: true },
      source: 'edited',
    });
    expect(sections[2]).toMatchObject({ format: 'tiptap', content: { type: 'doc', content: [] } });
    expect(resolved?.envelope.contentMd.indexOf('## Intro')).toBeLessThan(
      resolved!.envelope.contentMd.indexOf('## Data')
    );
    expect(resolved?.envelope.contentMd).not.toContain('"generated": true');
  });

  it('returns presentation JSON as canonical content and Markdown as projection', async () => {
    state.decks.set('org-a:deck-1', {
      id: 'deck-1',
      title: 'Board deck',
      deck_json: JSON.stringify({
        title: 'Board deck',
        slides: [{ title: 'Summary', bullets: ['Growth'] }],
      }),
      content_json_native: null,
      outline_json: null,
      version: 3,
      updated_at: '2026-07-31T10:00:00.000Z',
    });
    const resolved = await presentationArtifactContentAdapter.resolve({
      artifactId: 'artifact-1',
      organizationId: 'org-a',
      originRuntime: 'presentation',
      originRecordId: 'deck-1',
    });
    expect(resolved?.envelope.canonicalFormat).toBe('json');
    expect(resolved?.envelope.contentJson).toMatchObject({ title: 'Board deck' });
    expect(resolved?.envelope.contentMd).toContain('## Slide 1: Summary');
    expect(resolved?.envelope.contentMd).toContain('- Growth');
  });

  it('distinguishes empty presentation content from malformed JSON without placeholders', async () => {
    state.decks.set('org-a:empty', {
      id: 'empty',
      deck_json: '',
      content_json_native: null,
      outline_json: null,
      version: 1,
      updated_at: null,
    });
    state.decks.set('org-a:broken', {
      id: 'broken',
      deck_json: '{broken',
      content_json_native: null,
      outline_json: null,
      version: 1,
      updated_at: null,
    });
    const empty = await presentationArtifactContentAdapter.resolve({
      artifactId: 'a',
      organizationId: 'org-a',
      originRuntime: 'presentation',
      originRecordId: 'empty',
    });
    const broken = await presentationArtifactContentAdapter.resolve({
      artifactId: 'a',
      organizationId: 'org-a',
      originRuntime: 'presentation',
      originRecordId: 'broken',
    });
    expect(empty?.envelope.projection.status).toBe('missing');
    expect(empty?.envelope.contentMd).toBe('');
    expect(broken?.envelope.projection.status).toBe('failed');
    expect(broken?.envelope.projection.error).toBeTruthy();
    expect(broken?.envelope.contentMd).toBe('');
  });

  it('keeps read-back hash/ETag stable and changes them after report edit', async () => {
    state.artifacts.set('org-a:artifact-1', { artifact_id: 'artifact-1' });
    state.origins.set('org-a:artifact-1', {
      origin_runtime: 'report',
      origin_record_id: 'report-1',
    });
    state.reports.set('org-a:report-1', {
      id: 'report-1',
      title: 'Report',
      updated_at: '2026-07-31T10:00:00.000Z',
    });
    const section = reportSection();
    state.sections.set('org-a:report-1', [section]);
    registerArtifactContentAdapter('report', reportArtifactContentAdapter);

    const first = await resolveArtifactContent({
      artifactId: 'artifact-1',
      organizationId: 'org-a',
    });
    const second = await resolveArtifactContent({
      artifactId: 'artifact-1',
      organizationId: 'org-a',
    });
    expect(second.contentHash).toBe(first.contentHash);
    expect(second.etag).toBe(first.etag);

    section.edited_content = 'Edited content';
    section.updated_at = '2026-07-31T11:00:00.000Z';
    const edited = await resolveArtifactContent({
      artifactId: 'artifact-1',
      organizationId: 'org-a',
    });
    expect(edited.originRevision).not.toBe(first.originRevision);
    expect(edited.contentHash).not.toBe(first.contentHash);
    expect(edited.etag).not.toBe(first.etag);
    expect(edited.envelope.contentMd).toContain('Edited content');
  });

  it('changes presentation revision, hash and ETag after a deck edit', async () => {
    state.artifacts.set('org-a:artifact-1', { artifact_id: 'artifact-1' });
    state.origins.set('org-a:artifact-1', {
      origin_runtime: 'presentation',
      origin_record_id: 'deck-1',
    });
    const deck = {
      id: 'deck-1',
      title: 'Deck',
      deck_json: JSON.stringify({ title: 'Deck', slides: [{ title: 'Before' }] }),
      content_json_native: null,
      outline_json: null,
      version: 1,
      updated_at: '2026-07-31T10:00:00.000Z',
    };
    state.decks.set('org-a:deck-1', deck);
    registerArtifactContentAdapter('presentation', presentationArtifactContentAdapter);

    const before = await resolveArtifactContent({
      artifactId: 'artifact-1',
      organizationId: 'org-a',
    });
    deck.deck_json = JSON.stringify({ title: 'Deck', slides: [{ title: 'After' }] });
    deck.version = 2;
    deck.updated_at = '2026-07-31T11:00:00.000Z';
    const after = await resolveArtifactContent({
      artifactId: 'artifact-1',
      organizationId: 'org-a',
    });

    expect(after.originRevision).not.toBe(before.originRevision);
    expect(after.contentHash).not.toBe(before.contentHash);
    expect(after.etag).not.toBe(before.etag);
    expect(after.envelope.contentMd).toContain('Slide 1: After');
  });
});
