import { createHash } from 'node:crypto';

import type { ArtifactContentEnvelopeV1 } from '../../types/artifactContent.js';
import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';
import type { ArtifactContentAdapter } from './artifactContentResolverService.js';

interface ReportRow {
  id: string;
  title: string | null;
  updated_at: string | null;
}

interface ReportSectionRow {
  id: string;
  section_key: string | null;
  title: string | null;
  order_index: number | null;
  content_format: string | null;
  generated_content: string | null;
  edited_content: string | null;
  updated_at: string | null;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseStructuredContent(value: string, format: string): unknown {
  if (format !== 'json' && format !== 'tiptap') return value;
  return JSON.parse(value);
}

function projectSection(title: string, format: string, raw: string): string {
  const heading = `## ${title}`;
  if (!raw.trim()) return heading;
  if (format === 'markdown') return `${heading}\n\n${raw}`;
  const parsed = parseStructuredContent(raw, format);
  return `${heading}\n\n\`\`\`${format}\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
}

export const reportArtifactContentAdapter: ArtifactContentAdapter = {
  async resolve(params) {
    const report = await dbGet<ReportRow>(
      `SELECT id, title, updated_at
         FROM report_builder_reports
        WHERE id = ? AND organization_id = ?`,
      [params.originRecordId, params.organizationId],
      { fallback: true }
    );
    if (!report) return null;

    const sections = await dbAll<ReportSectionRow>(
      `SELECT s.id, s.section_key, s.title, s.order_index, s.content_format,
              s.generated_content, s.edited_content, s.updated_at
         FROM report_builder_sections s
         JOIN report_builder_reports r ON r.id = s.report_id
        WHERE s.report_id = ? AND r.organization_id = ?
        ORDER BY s.order_index ASC, s.id ASC`,
      [params.originRecordId, params.organizationId],
      { fallback: true }
    );

    try {
      const normalizedSections = sections.map((section, index) => {
        const format = ['markdown', 'json', 'tiptap'].includes(
          String(section.content_format || '').toLowerCase()
        )
          ? String(section.content_format).toLowerCase()
          : 'markdown';
        const effectiveContent =
          section.edited_content !== null
            ? section.edited_content
            : section.generated_content || '';
        const title = String(section.title || section.section_key || `Section ${index + 1}`);
        return {
          id: section.id,
          key: section.section_key,
          title,
          order: section.order_index ?? index,
          format,
          content: parseStructuredContent(effectiveContent, format),
          source: section.edited_content !== null ? 'edited' : 'generated',
          updatedAt: section.updated_at,
          markdown: projectSection(title, format, effectiveContent),
        };
      });
      const contentMd = normalizedSections.map((section) => section.markdown).join('\n\n');
      const contentJson = {
        reportId: report.id,
        title: report.title,
        sections: normalizedSections.map(({ markdown: _markdown, ...section }) => section),
      };
      const sourceHash = hash(JSON.stringify(contentJson));
      const originRevision = `report:${report.updated_at || 'legacy'}:${sourceHash}`;
      const envelope: ArtifactContentEnvelopeV1 = {
        envelopeVersion: 'artifact-content/v1',
        canonicalFormat: 'json',
        canonicalKind: 'document',
        contentSchemaVersion: 'report-builder/v1',
        contentMd,
        contentJson,
        projection: {
          status: contentMd.trim() ? 'synced' : 'missing',
          projectedAt: null,
          error: null,
          completeness: 'full',
          projectedFromRevision: originRevision,
          projectedFromHash: sourceHash,
        },
        provenance: {
          originRuntime: 'report',
          originRecordId: report.id,
          originRevision,
          originHash: sourceHash,
        },
        artifactType: 'report',
        markdownProjectionStatus: contentMd.trim() ? 'synced' : 'missing',
      };
      return { envelope, originRevision };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Malformed report section content';
      const originRevision = `report:${report.updated_at || 'legacy'}:malformed`;
      const envelope: ArtifactContentEnvelopeV1 = {
        envelopeVersion: 'artifact-content/v1',
        canonicalFormat: 'json',
        canonicalKind: 'document',
        contentSchemaVersion: 'report-builder/v1',
        contentMd: '',
        projection: {
          status: 'failed',
          projectedAt: null,
          error: message,
          completeness: 'full',
          projectedFromRevision: originRevision,
          projectedFromHash: null,
        },
        provenance: {
          originRuntime: 'report',
          originRecordId: report.id,
          originRevision,
        },
        artifactType: 'report',
        markdownProjectionStatus: 'failed',
        projectionError: message,
      };
      return { envelope, originRevision };
    }
  },
};
