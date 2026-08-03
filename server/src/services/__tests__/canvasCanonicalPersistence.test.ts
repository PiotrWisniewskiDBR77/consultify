import { describe, expect, it } from 'vitest';

import {
  buildCanvasCanonicalWrite,
  inferCanvasVersionFormat,
  resolveCanvasCanonicalEnvelope,
} from '../artifacts/canvasCanonicalPersistence.js';

describe('canvas canonical persistence', () => {
  it('treats legal canonical_format as authoritative and preserves empty markdown', () => {
    const envelope = resolveCanvasCanonicalEnvelope({
      canonical_format: 'markdown',
      content_md: '',
      content_json: '"old"',
      content_json_native: JSON.stringify({ should: 'not-win' }),
      kind: 'document',
    });
    expect(envelope.canonicalFormat).toBe('markdown');
    expect(envelope.contentMd).toBe('');
    expect(envelope.contentJson).toBeUndefined();
    expect(envelope.markdownProjectionStatus).toBe('missing');
    expect(envelope.projection.status).toBe('missing');
  });

  it('uses deterministic legacy fallback only for NULL columns and structured JSON', () => {
    const markdown = resolveCanvasCanonicalEnvelope({
      canonical_format: null,
      content_md: null,
      content_json: '"legacy md"',
    });
    const json = resolveCanvasCanonicalEnvelope({
      canonical_format: null,
      content_md: null,
      content_json: '{"b":2,"a":1}',
    });
    expect(markdown).toMatchObject({
      canonicalFormat: 'markdown',
      contentMd: 'legacy md',
      contentSchemaVersion: 'legacy/v0',
    });
    expect(json).toMatchObject({
      canonicalFormat: 'json',
      contentJson: { a: 1, b: 2 },
      contentSchemaVersion: 'legacy/v0',
    });
  });

  it('clears JSON on json→markdown and dual-writes markdown coherently', () => {
    const result = buildCanvasCanonicalWrite(
      {
        canonical_format: 'json',
        content_json: '{"old":true}',
        content_md: 'old projection',
        content_json_native: '{"old":true}',
      },
      { canonicalFormat: 'markdown', contentMd: '' }
    );
    expect(result).toMatchObject({
      canonical_format: 'markdown',
      content_json: '""',
      content_md: '',
      content_json_native: null,
      markdown_projection_status: 'synced',
    });
    expect(result.envelope.contentMd).toBe('');
  });

  it('clears markdown and marks projection missing on markdown→json without projection', () => {
    const result = buildCanvasCanonicalWrite(
      { canonical_format: 'markdown', content_json: '"old"', content_md: 'old' },
      { canonicalFormat: 'json', contentJson: { rows: [1] } }
    );
    expect(result).toMatchObject({
      canonical_format: 'json',
      content_md: null,
      content_json_native: '{"rows":[1]}',
      markdown_projection_status: 'missing',
    });
    expect(result.envelope.contentJson).toEqual({ rows: [1] });
  });

  it('marks an existing markdown projection stale after JSON mutation without a new projection', () => {
    const result = buildCanvasCanonicalWrite(
      {
        canonical_format: 'json',
        content_json: '{"v":1}',
        content_md: 'projection',
        content_json_native: '{"v":1}',
        markdown_projection_status: 'synced',
      },
      { contentJson: { v: 2 } }
    );
    expect(result.markdown_projection_status).toBe('stale');
    expect(result.envelope.markdownProjectionStatus).toBe('stale');
  });

  it('infers historical version format from snapshot rather than current draft', () => {
    expect(
      inferCanvasVersionFormat({
        content_md: 'projection',
        content_json_native: '{"rows":[]}',
        blocks_json: null,
      })
    ).toBe('json');
    expect(
      inferCanvasVersionFormat({
        content_md: '# historical markdown',
        content_json_native: null,
        blocks_json: null,
      })
    ).toBe('markdown');
    const restored = buildCanvasCanonicalWrite(
      { canonical_format: 'json', content_json_native: '{"current":true}', content_md: 'current' },
      {
        canonicalFormat: 'markdown',
        contentMd: '# historical markdown',
        contentSchemaVersion: 'legacy/v0',
      }
    );
    expect(restored.envelope).toMatchObject({
      canonicalFormat: 'markdown',
      contentSchemaVersion: 'legacy/v0',
      contentMd: '# historical markdown',
    });
  });
});
