/**
 * LegacyAssessmentReportRedirect — alias `/assessment-reports/:reportId`.
 *
 * ★ NAPRAWA F5 (2026-09-15, bloker targowy). ZMIERZONE na stagingu
 * (`de73155bc7`, org Northwind, konto Irina, dowody
 * `~/Developer/cto-codex/fala-f5-20260915/pomiar/`):
 *
 *   GET /api/assessment-reports            → 200, raport „Northwind 2027
 *     Operational Maturity Report", id `71de85bb-…`, status APPROVED,
 *     assessmentId `b2de5832-…`, **builderReportId: null**.
 *   /assessment-reports/71de85bb-…         → poprzednia wersja tego pliku
 *     robiła `Navigate('/reports/builder/71de85bb-…')`, czyli wkładała id
 *     RAPORTU OCENY w trasę KREATORA. Kreator woła
 *     `GET /api/report-builder/71de85bb-…` → 404 `Report not found`,
 *     użytkownik widzi PUSTY DRAFT „Start building your report".
 *   /assessment/outputs/b2de5832-…/report  → 200, pełny raport DRD (9 465
 *     znaków treści EN) — to jest ŻYWY czytnik raportu oceny i ta sama
 *     trasa, którą otwiera dwuklik na wierszu w Assessment → Reports
 *     (`AssessmentHub.tsx` + `trasaOtwarciaRaportuOceny`).
 *
 * Reguła rozstrzygania (bez zgadywania, maks. dwa GET-y):
 *   1. `builderReportId` jest ustawione → raport Kreatora → `/reports/builder/:builderId`.
 *   2. brak `builderReportId`, jest `assessmentId` → RAPORT OCENY →
 *      `/assessment/outputs/:assessmentId/report`.
 *   3. `/full` nie zna tego id → sprawdzamy przestrzeń Kreatora
 *      (`GET /report-builder/:id`); gdy istnieje → `/reports/builder/:id`.
 *   4. żadne źródło nie zna id → CZYTELNY stan „Report not available"
 *      (i18n, EN first) z powrotem na listę raportów. Nigdy surowy ApiError
 *      ani pusty kreator udający nowy raport.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { ErrorState } from '@/components/shared/states';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

type Rozstrzygniecie =
  | { stan: 'ladowanie' }
  | { stan: 'trasa'; trasa: string }
  | { stan: 'brak' };

/**
 * Czysta reguła wyboru trasy z payloadu `/assessment-reports/:id/full`.
 * Wydzielona, żeby test routingu nie musiał montować całego drzewa tras.
 */
export function trasaZPayloaduRaportu(payload: unknown): string | null {
  const dane = (payload ?? {}) as Record<string, unknown>;
  const raport = ((dane.report as Record<string, unknown> | undefined) ?? dane) as Record<
    string,
    unknown
  >;

  const builderId = String(raport.builderReportId ?? raport.builder_report_id ?? '').trim();
  if (builderId) return `/reports/builder/${encodeURIComponent(builderId)}`;

  const assessmentId = String(raport.assessmentId ?? raport.assessment_id ?? '').trim();
  if (assessmentId) return `/assessment/outputs/${encodeURIComponent(assessmentId)}/report`;

  return null;
}

export const LegacyAssessmentReportRedirect: React.FC = () => {
  const params = useParams<{ reportId?: string }>();
  const reportId = params.reportId;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [wynik, setWynik] = React.useState<Rozstrzygniecie>({ stan: 'ladowanie' });

  React.useEffect(() => {
    if (!reportId) return;
    let cancelled = false;

    const id = encodeURIComponent(reportId);

    Api.get(`/assessment-reports/${id}/full`)
      .then((data: unknown) => {
        if (cancelled) return;
        const trasa = trasaZPayloaduRaportu(data);
        if (trasa) {
          setWynik({ stan: 'trasa', trasa });
          return;
        }
        // Raport istnieje, ale nie ma ani wiersza Kreatora, ani oceny źródłowej —
        // nie ma dokąd wejść, więc mówimy to wprost zamiast otwierać pusty kreator.
        setWynik({ stan: 'brak' });
      })
      .catch(() =>
        // `/full` nie zna tego id → to może być id z przestrzeni Kreatora raportów.
        Api.get(`/report-builder/${id}`)
          .then(() => {
            if (cancelled) return;
            setWynik({ stan: 'trasa', trasa: `/reports/builder/${id}` });
          })
          .catch(() => {
            if (cancelled) return;
            setWynik({ stan: 'brak' });
          })
      );

    return () => {
      cancelled = true;
    };
  }, [reportId]);

  React.useEffect(() => {
    if (!reportId) {
      trackFunnelEvent('route_redirected', {
        from: '/assessment-reports/:reportId',
        to: '/reports/builder',
        reason: 'legacy_assessment_report_missing_id',
      });
      return;
    }
    if (wynik.stan === 'ladowanie') return;
    trackFunnelEvent('route_redirected', {
      from: `/assessment-reports/${reportId}`,
      to: wynik.stan === 'trasa' ? wynik.trasa : 'not_available',
      reason: 'legacy_assessment_report_alias',
    });
  }, [reportId, wynik]);

  if (!reportId) return <Navigate to="/reports/builder" replace />;

  if (wynik.stan === 'trasa') return <Navigate to={wynik.trasa} replace />;

  if (wynik.stan === 'brak') {
    return (
      <div className="p-6" data-testid="legacy-assessment-report-not-available">
        <ErrorState
          title={t('assessment.report.notAvailableTitle', 'Report not available')}
          description={t(
            'assessment.report.notAvailableDescription',
            'This report link no longer points to a report we can open. Open the assessment it came from to see its current results.'
          )}
          onBack={() => navigate('/assessment?tab=reports')}
          backLabel={t('assessment.report.notAvailableBack', 'Back to assessment reports')}
        />
      </div>
    );
  }

  return null;
};
