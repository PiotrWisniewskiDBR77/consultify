/**
 * Report Builder — client for the SERVER-SIDE template resolution used by
 * the Template Library's „Użyj wzorca" (and „Klonuj") for a legacy
 * `report_template`.
 *
 * Mirrors `src/components/DocumentStudio/api.ts` (`resolveDocumentStudioTemplate`)
 * — same contract, same reason: the Library only ever hands the client an
 * INDEX id (`templateArtifactId`, a `v8_artifact_origin_links` row). The
 * canonical `report_builder_templates.id` the generator needs is resolved
 * server-side (`POST /report-builder/templates/resolve` →
 * `resolveDocumentTemplateForCreation`, the SAME resolver Document Studio
 * uses) so a client-supplied canonical id never becomes an unvalidated
 * pointer straight into generation.
 *
 * Rejections arrive as a typed code so the caller renders an honest blocking
 * message instead of silently falling back to a template-less draft.
 */

import { apiGet, apiPost } from '@/services/api/baseClient';

export type ReportTemplateResolveErrorCode =
  | 'TEMPLATE_NOT_INDEXED'
  | 'TEMPLATE_ORPHANED'
  | 'TEMPLATE_FORBIDDEN'
  | 'TEMPLATE_DEPRECATED'
  | 'TEMPLATE_FORMAT_UNSUPPORTED';

export class ReportTemplateResolveClientError extends Error {
  readonly code: ReportTemplateResolveErrorCode | 'TEMPLATE_RESOLVE_FAILED';
  constructor(code: ReportTemplateResolveErrorCode | 'TEMPLATE_RESOLVE_FAILED', message?: string) {
    super(message ?? code);
    this.name = 'ReportTemplateResolveClientError';
    this.code = code;
  }
}

export interface ResolvedLibraryReportTemplate {
  canonicalTemplateId: string;
  originRuntime: string;
  format: 'document';
  scope: string;
  status: string;
  source: 'canonical' | 'legacy';
  legacy: boolean;
  sectionCount: number;
}

/** POST /api/report-builder/templates/resolve — throws `ReportTemplateResolveClientError`. */
export async function resolveReportBuilderTemplate(
  templateArtifactId: string
): Promise<ResolvedLibraryReportTemplate> {
  try {
    const json = await apiPost<{ template: ResolvedLibraryReportTemplate }>(
      '/report-builder/templates/resolve',
      { templateArtifactId },
      'Report Builder resolve template'
    );
    return json.template;
  } catch (err: any) {
    const code: ReportTemplateResolveErrorCode | 'TEMPLATE_RESOLVE_FAILED' =
      (err?.data?.error as ReportTemplateResolveErrorCode) || 'TEMPLATE_RESOLVE_FAILED';
    throw new ReportTemplateResolveClientError(code);
  }
}

export interface ReportTemplateDetails {
  id: string;
  name: string;
  description: string | null;
  reportType: string | null;
  sourceType: string | null;
  isSystem: boolean;
}

/**
 * GET /api/report-builder/templates/:templateId/details — display metadata
 * (name/description/sourceType) for a template already validated by
 * `resolveReportBuilderTemplate`. Reuses the existing details endpoint
 * (`server/src/routes/report-builder.routes.ts`) rather than a second parser.
 */
export async function getReportBuilderTemplateDetails(
  templateId: string
): Promise<ReportTemplateDetails> {
  const json = await apiGet<{ template: Record<string, unknown> }>(
    `/report-builder/templates/${encodeURIComponent(templateId)}/details`,
    'Report Builder template details'
  );
  const t = json?.template || {};
  return {
    id: String(t.id ?? templateId),
    name: String(t.name ?? t.title ?? ''),
    description: (t.description as string | undefined) ?? null,
    reportType:
      (t.report_type as string | undefined) ?? (t.reportType as string | undefined) ?? null,
    sourceType:
      (t.source_type as string | undefined) ?? (t.sourceType as string | undefined) ?? null,
    isSystem: Boolean(t.is_system ?? t.isSystem),
  };
}
