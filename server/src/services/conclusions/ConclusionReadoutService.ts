import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../../utils/queryHelpers.js';
import { artifactConversionService } from '../artifacts/ArtifactConversionService.js';
import { type Conclusion, conclusionService } from './ConclusionService.js';

export interface ConclusionReadoutSections {
  researchSummary: string;
  strongestConclusions: string[];
  risks: string[];
  opportunities: string[];
  contradictions: string[];
  coverageGaps: string[];
  decisionsNeeded: string[];
  proposedConversions: string[];
}

export interface ConclusionReadout {
  id: string;
  organizationId: string;
  projectId?: string | null;
  title: string;
  sourceConclusionIds: string[];
  summary: string;
  sections: ConclusionReadoutSections;
  visibilityScope: 'private' | 'project' | 'organization' | 'review_shared';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  outputArtifactRefs: Array<{ type: string; id: string; title?: string; url?: string }>;
}

interface ReadoutRow {
  id: string;
  organization_id: string;
  project_id?: string | null;
  title: string;
  source_conclusion_ids_json?: string | null;
  summary: string;
  sections_json?: string | null;
  visibility_scope: ConclusionReadout['visibilityScope'];
  created_by: string;
  created_at: string;
  updated_at: string;
  output_artifact_refs_json?: string | null;
}

let ensureTablesPromise: Promise<void> | null = null;

function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToReadout(row: ReadoutRow): ConclusionReadout {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id ?? null,
    title: row.title,
    sourceConclusionIds: safeJson<string[]>(row.source_conclusion_ids_json, []),
    summary: row.summary,
    sections: safeJson<ConclusionReadoutSections>(row.sections_json, {
      researchSummary: '',
      strongestConclusions: [],
      risks: [],
      opportunities: [],
      contradictions: [],
      coverageGaps: [],
      decisionsNeeded: [],
      proposedConversions: [],
    }),
    visibilityScope: row.visibility_scope,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    outputArtifactRefs: safeJson(row.output_artifact_refs_json, []),
  };
}

async function ensureTables(): Promise<void> {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await conclusionService.ensureReady();
      await artifactConversionService.ensureReady();
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS conclusion_readouts (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          project_id TEXT,
          title TEXT NOT NULL,
          source_conclusion_ids_json TEXT NOT NULL DEFAULT '[]',
          summary TEXT NOT NULL DEFAULT '',
          sections_json TEXT NOT NULL DEFAULT '{}',
          visibility_scope TEXT NOT NULL DEFAULT 'project',
          output_artifact_refs_json TEXT NOT NULL DEFAULT '[]',
          created_by TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
      await queryHelpers.queryRun(
        `CREATE INDEX IF NOT EXISTS idx_conclusion_readouts_org ON conclusion_readouts(organization_id)`
      );
      await queryHelpers.queryRun(
        `CREATE INDEX IF NOT EXISTS idx_conclusion_readouts_project ON conclusion_readouts(organization_id, project_id)`
      );
    })();
  }
  return ensureTablesPromise;
}

function deriveSections(conclusions: Conclusion[]): ConclusionReadoutSections {
  const contradicted = conclusions.filter((item) => item.confidenceLevel === 'contradicted');
  const weak = conclusions.filter(
    (item) => item.confidenceLevel === 'low' || item.confidenceLevel === 'insufficient'
  );
  return {
    researchSummary: `Readout built from ${conclusions.length} governed conclusion(s). Sources: ${
      [...new Set(conclusions.map((item) => item.sourceModule))].join(', ') || 'n/a'
    }.`,
    strongestConclusions: conclusions
      .filter((item) => ['high', 'medium'].includes(item.confidenceLevel))
      .map((item) => item.statement)
      .slice(0, 8),
    risks: conclusions
      .filter((item) => item.limits)
      .map((item) => item.limits)
      .slice(0, 8),
    opportunities: conclusions
      .filter((item) => item.recommendedNextAction)
      .map((item) => item.recommendedNextAction || '')
      .slice(0, 8),
    contradictions: contradicted.map((item) => item.statement).slice(0, 8),
    coverageGaps: weak.map((item) => `${item.title}: needs stronger evidence`).slice(0, 8),
    decisionsNeeded: conclusions
      .filter((item) => item.status !== 'converted')
      .map((item) => `Decide whether to convert: ${item.title}`)
      .slice(0, 8),
    proposedConversions: conclusions
      .filter((item) => item.recommendedNextAction)
      .map((item) => `Initiative candidate: ${item.title}`)
      .slice(0, 8),
  };
}

function buildMarkdown(readout: ConclusionReadout): string {
  const section = (title: string, items: string[]) =>
    `\n## ${title}\n${items.length ? items.map((item) => `- ${item}`).join('\n') : '- Brak danych.'}\n`;

  return `# ${readout.title}

${readout.summary}

${readout.sections.researchSummary}
${section('Najmocniejsze wnioski', readout.sections.strongestConclusions)}
${section('Ryzyka i ograniczenia', readout.sections.risks)}
${section('Szanse / następne działania', readout.sections.opportunities)}
${section('Sprzeczności', readout.sections.contradictions)}
${section('Luki pokrycia', readout.sections.coverageGaps)}
${section('Decyzje do podjęcia', readout.sections.decisionsNeeded)}
${section('Proponowane konwersje', readout.sections.proposedConversions)}
`;
}

export class ConclusionReadoutService {
  async ensureReady(): Promise<void> {
    await ensureTables();
  }

  async listReadouts(organizationId: string): Promise<ConclusionReadout[]> {
    await ensureTables();
    const rows = await queryHelpers.queryAll<ReadoutRow>(
      `SELECT * FROM conclusion_readouts WHERE organization_id = ? ORDER BY updated_at DESC`,
      [organizationId]
    );
    return rows.map(rowToReadout);
  }

  async getReadout(organizationId: string, readoutId: string): Promise<ConclusionReadout | null> {
    await ensureTables();
    const row = await queryHelpers.queryOne<ReadoutRow>(
      `SELECT * FROM conclusion_readouts WHERE id = ? AND organization_id = ?`,
      [readoutId, organizationId]
    );
    return row ? rowToReadout(row) : null;
  }

  async createReadout(params: {
    organizationId: string;
    actorUserId: string;
    title?: string;
    conclusionIds: string[];
    visibilityScope?: ConclusionReadout['visibilityScope'];
  }): Promise<ConclusionReadout> {
    await ensureTables();
    const conclusions = (
      await Promise.all(
        params.conclusionIds.map((id) =>
          conclusionService.getConclusion(params.organizationId, id, params.actorUserId)
        )
      )
    ).filter(Boolean) as Conclusion[];

    if (conclusions.length === 0) {
      throw new Error('At least one conclusion is required to create a readout');
    }

    const now = new Date().toISOString();
    const id = uuidv4();
    const sections = deriveSections(conclusions);
    const title = params.title || `Readout: ${conclusions[0].title}`;
    const summary = `Sponsor-ready synthesis of ${conclusions.length} conclusion(s).`;
    await queryHelpers.queryRun(
      `INSERT INTO conclusion_readouts (
        id, organization_id, project_id, title, source_conclusion_ids_json, summary,
        sections_json, visibility_scope, output_artifact_refs_json, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?)`,
      [
        id,
        params.organizationId,
        conclusions[0].projectId ?? null,
        title,
        JSON.stringify(conclusions.map((item) => item.id)),
        summary,
        JSON.stringify(sections),
        params.visibilityScope || 'project',
        params.actorUserId,
        now,
        now,
      ]
    );

    const readout = await this.getReadout(params.organizationId, id);
    if (!readout) throw new Error('Failed to create readout');
    return readout;
  }

  async generateReportFromReadout(params: {
    organizationId: string;
    actorUserId: string;
    readoutId: string;
  }): Promise<{ reportId: string; readout: ConclusionReadout }> {
    await ensureTables();
    const readout = await this.getReadout(params.organizationId, params.readoutId);
    if (!readout) throw new Error('Readout not found');

    const reportId = uuidv4();
    const now = new Date().toISOString();
    const sourceRefs = readout.sourceConclusionIds.map((id) => ({
      artifact_type: 'conclusion',
      artifact_id: id,
    }));

    await queryHelpers.queryRun(
      `INSERT INTO report_builder_reports (
        id, organization_id, project_id, source_type, source_id, source_name, title,
        description, report_type, config_json, status, created_by, created_at, updated_at,
        updated_by, report_type_v3, density, data_level, confidentiality, context_pack_snapshot,
        goal_v3, source_refs_json
      ) VALUES (?, ?, ?, 'conclusion_readout', ?, ?, ?, ?, 'audit_readout', ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportId,
        params.organizationId,
        readout.projectId ?? null,
        readout.id,
        readout.title,
        readout.title,
        readout.summary,
        JSON.stringify({ generatedFrom: 'conclusion_readout' }),
        params.actorUserId,
        now,
        now,
        params.actorUserId,
        'audit_readout',
        'standard',
        'balanced',
        'internal',
        JSON.stringify({ readoutId: readout.id, sections: readout.sections }),
        'Sponsor readout from governed conclusions',
        JSON.stringify(sourceRefs),
      ]
    );

    const markdown = buildMarkdown(readout);
    await queryHelpers.queryRun(
      `INSERT INTO report_builder_sections (
        id, report_id, section_key, section_type, title, order_index, enabled, required,
        length, language, generated_content, edited_content, content_format, source_data_snapshot,
        generated_at, source_refs_json, is_refreshable, last_data_timestamp, created_at, updated_at
      ) VALUES (?, ?, 'readout_summary', 'readout', 'Readout summary', 1, 1, 1, 'long', 'business', ?, ?, 'markdown', ?, ?, ?, 1, ?, ?, ?)`,
      [
        uuidv4(),
        reportId,
        markdown,
        markdown,
        JSON.stringify(readout),
        now,
        JSON.stringify(sourceRefs),
        now,
        now,
        now,
      ]
    );

    const outputRef = {
      type: 'report',
      id: reportId,
      title: readout.title,
      url: `/reports/builder/${encodeURIComponent(reportId)}`,
    };
    const outputRefs = [...readout.outputArtifactRefs, outputRef];
    await queryHelpers.queryRun(
      `UPDATE conclusion_readouts SET output_artifact_refs_json = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
      [JSON.stringify(outputRefs), now, readout.id, params.organizationId]
    );

    for (const conclusionId of readout.sourceConclusionIds) {
      await artifactConversionService.recordCompletedConversion({
        organizationId: params.organizationId,
        actorUserId: params.actorUserId,
        sourceConclusionId: conclusionId,
        sourceArtifactType: 'conclusion',
        sourceArtifactId: conclusionId,
        sourceArtifactTitle: readout.title,
        sourceModule: 'wnioski',
        targetArtifactType: 'report',
        targetArtifactId: reportId,
        conversionIntent: 'Generate report from readout',
        projectId: readout.projectId ?? null,
        sourcePack: { readoutId: readout.id },
        payload: { readoutId: readout.id, reportId },
      });
    }

    const updated = await this.getReadout(params.organizationId, readout.id);
    return { reportId, readout: updated || readout };
  }

  buildChatContext(readout: ConclusionReadout): Record<string, unknown> {
    return {
      type: 'conclusion_readout',
      readoutId: readout.id,
      title: readout.title,
      summary: readout.summary,
      sourceConclusionIds: readout.sourceConclusionIds,
      sections: readout.sections,
      boundaries: [
        'Use only the supplied readout and source conclusion IDs as grounded context.',
        'Do not create durable artifacts without explicit user acceptance.',
      ],
    };
  }
}

export const conclusionReadoutService = new ConclusionReadoutService();
