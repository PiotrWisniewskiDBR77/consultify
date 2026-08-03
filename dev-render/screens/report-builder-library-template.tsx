/**
 * Dev-render host for the REAL `<ReportBuilderView>` — Library „Użyj wzorca" /
 * „Klonuj" entry for a `report_template` (R1, 2026-07-26), route
 * `/reports/builder?new=true&templateArtifactId=<index id>`.
 *
 * `ReportBuilderView` recognizes this as `isLibraryTemplateEntry`
 * (templateArtifactId + new=true, no reportId/sourceType/sourceId) and
 * mounts the internal `LibraryTemplateReportCreateFlow`, which:
 *   1. `resolveReportBuilderTemplate()` → `POST /api/report-builder/templates/resolve`
 *      (`src/components/ReportBuilder/libraryTemplateResolveClient.ts`)
 *   2. on success, `getReportBuilderTemplateDetails()` →
 *      `GET /api/report-builder/templates/:id/details`
 *   3. on success, `Api.listAssessments()` for the assessment picker, then
 *      renders `<NewAssessmentReportModal lockTemplate>` with the resolved
 *      template pre-filled and locked.
 *
 * Both `resolveReportBuilderTemplate`/`getReportBuilderTemplateDetails` call
 * `apiPost`/`apiGet` from `src/services/api/baseClient.ts` directly (NOT the
 * `Api` object) — those helpers hit `window.fetch` under the hood, so THIS
 * screen mocks `window.fetch` for those two paths (module-level, guarded by
 * `?screen=`, pattern from `document-studio-template-resolve-error.tsx`).
 * `Api.listAssessments` (a real method on the `Api` singleton) is patched
 * directly, same as other dev-render screens.
 *
 * ★ Patched at MODULE level, not inside a React effect — `LibraryTemplateReportCreateFlow`
 * fires its resolve POST from a mount effect that commits in the same pass as
 * this wrapper's own effects, and child effects commit before parent effects.
 * Safe because `dev-render/main.tsx` lazy-loads every screen, so only this
 * module's top-level code runs when this screen is selected.
 *
 * URL: ?screen=report-builder-library-template&new=true&templateArtifactId=fake-1
 *        [&variant=success|orphaned|deprecated|forbidden][&theme=light|dark]
 *
 * variant=success (default) — resolve succeeds → modal with template field
 *   LOCKED + assessment dropdown (1 approved assessment).
 * variant=orphaned   — 404 TEMPLATE_ORPHANED  → PL blocking state "Nie można użyć tego wzorca".
 * variant=deprecated — 409 TEMPLATE_DEPRECATED → PL blocking state.
 * variant=forbidden  — 403 TEMPLATE_FORBIDDEN  → PL blocking state.
 * All three blocking states render "Powrót do Biblioteki".
 */
import React from 'react';

import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { ReportBuilderView } from '../../src/views/ReportBuilderView';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const params = new URLSearchParams(window.location.search);
const variant = params.get('variant') || 'success';

const TEMPLATE_ID = 'tpl-canon-drd-standard-elkomtech';

const RESOLVE_ERROR: Record<string, { status: number; code: string }> = {
  orphaned: { status: 404, code: 'TEMPLATE_ORPHANED' },
  deprecated: { status: 409, code: 'TEMPLATE_DEPRECATED' },
  forbidden: { status: 403, code: 'TEMPLATE_FORBIDDEN' },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const g = window as unknown as { __RB_LIB_TPL_FETCH__?: boolean };
const tenEkran = params.get('screen') === 'report-builder-library-template';
if (tenEkran && !g.__RB_LIB_TPL_FETCH__) {
  g.__RB_LIB_TPL_FETCH__ = true;

  Api.listAssessments = (async () => ({
    items: [
      {
        id: 'assess-elkomtech-drd-2026',
        name: 'Elkomtech — Audyt DRD 2026',
        type: 'digital_readiness',
        status: 'approved',
      },
    ],
    total: 1,
    limit: 200,
    offset: 0,
  })) as typeof Api.listAssessments;

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;

    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);

    if (url.includes('/report-builder/templates/resolve')) {
      const rejection = RESOLVE_ERROR[variant];
      if (rejection) return jsonResponse({ error: rejection.code }, rejection.status);
      return jsonResponse({
        template: {
          canonicalTemplateId: TEMPLATE_ID,
          originRuntime: 'report_template',
          format: 'document',
          scope: 'organization',
          status: 'active',
          source: 'canonical',
          legacy: false,
          sectionCount: 6,
        },
      });
    }

    if (url.includes(`/report-builder/templates/${TEMPLATE_ID}/details`)) {
      return jsonResponse({
        template: {
          id: TEMPLATE_ID,
          name: 'Raport dojrzałości cyfrowej DRD — szablon standardowy',
          description:
            'Streszczenie zarządcze, wynik 7 osi dojrzałości cyfrowej, analiza luk względem celu, rekomendacje i plan działań na 90 dni.',
          report_type: 'drd_maturity',
          source_type: 'ASSESSMENT',
          is_system: true,
        },
      });
    }

    if (url.includes('/api/')) {
      return jsonResponse({ data: [], items: [] });
    }

    return realFetch(input as RequestInfo, init);
  };
}

export default function ReportBuilderLibraryTemplateScreen(): React.ReactElement {
  return (
    <AppProviders>
      <ReportBuilderView />
    </AppProviders>
  );
}
