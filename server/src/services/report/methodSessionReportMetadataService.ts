import * as DbPromise from '../../utils/DbPromise.js';
import { nowIso, parseJson, runOrThrow } from '../../method-core/db.js';

export interface ReportPerson { name: string; role: string }
export interface ReportCalendarEntry { date: string; description: string }
export interface ReportRecommendation {
  axisId: number;
  text: string;
  priority: 'Krytyczny' | 'Wysoki' | 'Średni' | 'Niski';
  horizon: string;
  owner: string;
}

export interface MethodSessionReportMetadata {
  sessionId: string;
  organizationId: string;
  advisoryTeam: ReportPerson[];
  clientTeam: ReportPerson[];
  studyPeriod: string;
  studyScope: string;
  exclusions: string[];
  calendarEntries: ReportCalendarEntry[];
  recommendations: ReportRecommendation[];
  recommendedCeilingRationales: Record<string, string>;
  updatedBy: string;
  updatedAt: string;
}

interface MetadataRow {
  session_id: string;
  organization_id: string;
  advisory_team: unknown;
  client_team: unknown;
  study_period: string;
  study_scope: string;
  exclusions: unknown;
  calendar_entries: unknown;
  recommendations: unknown;
  recommended_ceiling_rationales: unknown;
  updated_by: string;
  updated_at: string;
}

const fromRow = (row: MetadataRow): MethodSessionReportMetadata => ({
  sessionId: row.session_id,
  organizationId: row.organization_id,
  advisoryTeam: parseJson(row.advisory_team, []),
  clientTeam: parseJson(row.client_team, []),
  studyPeriod: row.study_period,
  studyScope: row.study_scope,
  exclusions: parseJson(row.exclusions, []),
  calendarEntries: parseJson(row.calendar_entries, []),
  recommendations: parseJson(row.recommendations, []),
  recommendedCeilingRationales: parseJson(row.recommended_ceiling_rationales, {}),
  updatedBy: row.updated_by,
  updatedAt: row.updated_at,
});

export class MethodSessionReportMetadataService {
  async get(organizationId: string, sessionId: string): Promise<MethodSessionReportMetadata | null> {
    const row = await DbPromise.get<MetadataRow>(
      `SELECT * FROM method_session_report_metadata
       WHERE organization_id = ? AND session_id = ?`,
      [organizationId, sessionId]
    );
    return row ? fromRow(row) : null;
  }

  async save(input: Omit<MethodSessionReportMetadata, 'updatedAt'>): Promise<MethodSessionReportMetadata> {
    const now = nowIso();
    await runOrThrow(
      `INSERT INTO method_session_report_metadata
        (session_id, organization_id, advisory_team, client_team, study_period, study_scope,
         exclusions, calendar_entries, recommendations, recommended_ceiling_rationales,
         updated_by, created_at, updated_at)
       SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?
       WHERE EXISTS (
         SELECT 1 FROM method_sessions WHERE id = ? AND organization_id = ?
       )
       ON CONFLICT (session_id) DO UPDATE SET
         advisory_team = EXCLUDED.advisory_team,
         client_team = EXCLUDED.client_team,
         study_period = EXCLUDED.study_period,
         study_scope = EXCLUDED.study_scope,
         exclusions = EXCLUDED.exclusions,
         calendar_entries = EXCLUDED.calendar_entries,
         recommendations = EXCLUDED.recommendations,
         recommended_ceiling_rationales = EXCLUDED.recommended_ceiling_rationales,
         updated_by = EXCLUDED.updated_by,
         updated_at = EXCLUDED.updated_at`,
      [
        input.sessionId, input.organizationId, JSON.stringify(input.advisoryTeam),
        JSON.stringify(input.clientTeam), input.studyPeriod, input.studyScope,
        JSON.stringify(input.exclusions), JSON.stringify(input.calendarEntries),
        JSON.stringify(input.recommendations), JSON.stringify(input.recommendedCeilingRationales),
        input.updatedBy, now, now, input.sessionId, input.organizationId,
      ]
    );
    const saved = await this.get(input.organizationId, input.sessionId);
    if (!saved) throw new Error('report metadata save refused: session not found in organization');
    return saved;
  }
}

export const methodSessionReportMetadataService = new MethodSessionReportMetadataService();
