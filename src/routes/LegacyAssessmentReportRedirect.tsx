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
 *   1a. ★ F8a: ocena źródłowa MA zamrożony Output jądra
 *      (`GET /api/method/outputs?sessionId=<assessmentId>` → niepusta lista) →
 *      `/assessment/outputs/:outputId/report`, czyli wynik Z LICZBAMI.
 *      Rekord sesji jest dopiero fallbackiem, nie pierwszym wyborem.
 *      Szczegóły pomiaru i dlaczego dla `71de85bb-…` taki Output NIE ISTNIEJE
 *      — przy `idZamrozonegoOutputu` niżej.
 *   2. brak `builderReportId` i brak zamrożonego Outputu, jest `assessmentId` →
 *      RAPORT OCENY z rekordu sesji → `/assessment/outputs/:assessmentId/report`.
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
export function trasaZPayloaduRaportu(
  payload: unknown,
  /** Id ZAMROŻONEGO Outputu jądra znalezionego dla oceny źródłowej tego
   * raportu (`idZamrozonegoOutputu`), albo `null`, gdy takiego nie ma. */
  idZamrozonegoOutputu: string | null = null
): string | null {
  const dane = (payload ?? {}) as Record<string, unknown>;
  const raport = ((dane.report as Record<string, unknown> | undefined) ?? dane) as Record<
    string,
    unknown
  >;

  const builderId = String(raport.builderReportId ?? raport.builder_report_id ?? '').trim();
  if (builderId) return `/reports/builder/${encodeURIComponent(builderId)}`;

  // ★ F8a: ZAMROŻONY Output ma pierwszeństwo przed rekordem sesji. Kolejność
  // z rozkazu: raport prowadzi do zamrożonego wyniku z liczbami, a do rekordu
  // sesji dopiero wtedy, gdy zamrożonego wyniku NIE MA.
  if (idZamrozonegoOutputu) {
    return `/assessment/outputs/${encodeURIComponent(idZamrozonegoOutputu)}/report`;
  }

  const assessmentId = String(raport.assessmentId ?? raport.assessment_id ?? '').trim();
  if (assessmentId) return `/assessment/outputs/${encodeURIComponent(assessmentId)}/report`;

  return null;
}

/** Id oceny źródłowej z payloadu `/assessment-reports/:id/full` (albo `null`). */
export function idOcenyZrodlowej(payload: unknown): string | null {
  const dane = (payload ?? {}) as Record<string, unknown>;
  const raport = ((dane.report as Record<string, unknown> | undefined) ?? dane) as Record<
    string,
    unknown
  >;
  const id = String(raport.assessmentId ?? raport.assessment_id ?? '').trim();
  return id || null;
}

/**
 * ★ F8a. Czy ocena źródłowa tego raportu ma ZAMROŻONY Output w jądrze?
 *
 * ZMIERZONE 15.09 na stagingu `6c34292eb0` (org Northwind, konto Iriny, dowody
 * `~/Developer/cto-codex/fala-f8a-20260915/pomiar/m2-api.json`) — i to pomiar
 * OBALIŁ założenie, że raport `71de85bb-…` ma gdzieś swój zamrożony Output:
 *   `GET /api/assessment-reports/71de85bb…/full` → 200, ale payload NIE niesie
 *     ani `outputId`, ani `sourceOutputId`, ani `sessionId` — tylko
 *     `assessmentId = b2de5832-…`;
 *   `GET /api/method/outputs/b2de5832-…` → 404 („Output not found");
 *   `GET /api/v8/assessment/b2de5832-…` → 200, `answers.drd` ma WYŁĄCZNIE 7 osi
 *     (achieved/target), ZERO obszarów — stąd „0 of 39 areas in 0 of 7 axes";
 *   cała organizacja ma 2 zamrożone Outputy (`49ea2d44-…` dla sesji
 *     `63aa51e1-…`, `566e5de3-…` dla sesji `a9c8f477-…`, po 39 jednostek), ale
 *     ŻADEN z nich nie wskazuje na ocenę `b2de5832-…` i odwrotnie —
 *     `method_sessions` nie ma kolumny wskazującej na `assessments` (to samo
 *     ograniczenie jest opisane w `assessmentOutputProjection.ts`).
 * Dopasowanie po nazwie („Northwind 2027…") byłoby ZGADYWANIEM i podstawiłoby
 * klientowi cudze liczby, więc go tu nie ma.
 *
 * Reguła, która z tego zostaje i jest uczciwa: gdy `assessmentId` raportu
 * NAZYWA sesję jądra, `GET /api/method/outputs?sessionId=<id>` zwróci jej
 * zamrożony Output i alias prowadzi wprost do niego. Gdy nie zwróci nic (jak
 * dla `b2de5832-…`) — spadamy do czytnika rekordu sesji, dokładnie jak dotąd.
 * Błąd sieci/uprawnień też daje `null`: alias ma prowadzić gdziekolwiek, nie
 * pękać.
 */
export async function idZamrozonegoOutputu(assessmentId: string): Promise<string | null> {
  try {
    const data = (await Api.get(
      `/method/outputs?sessionId=${encodeURIComponent(assessmentId)}&limit=1`
    )) as { outputs?: { id?: string }[] } | null;
    const id = data?.outputs?.[0]?.id;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
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

    // `/full` jest JEDYNYM wywołaniem, którego porażka oznacza „to nie jest id
    // raportu oceny" — dlatego tylko ono ma gałąź zapasową Kreatora. Krok F8a
    // (pytanie o zamrożony Output) NIE MOŻE wpaść w tamten catch, bo jego
    // porażka znaczy tylko „nie ma Outputu", a nie „to inny byt".
    const rozstrzygnij = async () => {
      let pelny: unknown;
      try {
        pelny = await Api.get(`/assessment-reports/${id}/full`);
      } catch {
        // `/full` nie zna tego id → to może być id z przestrzeni Kreatora raportów.
        try {
          await Api.get(`/report-builder/${id}`);
          if (!cancelled) setWynik({ stan: 'trasa', trasa: `/reports/builder/${id}` });
        } catch {
          if (!cancelled) setWynik({ stan: 'brak' });
        }
        return;
      }
      if (cancelled) return;

      // F8a: zanim zdecydujemy, pytamy jądro, czy ocena źródłowa ma ZAMROŻONY
      // Output — ten z liczbami. Pytamy tylko wtedy, gdy raport nie jest
      // raportem Kreatora i w ogóle ma ocenę źródłową (jeden GET, nie dwa).
      const assessmentId = idOcenyZrodlowej(pelny);
      const trasaBezOutputu = trasaZPayloaduRaportu(pelny);
      const idOutputu =
        assessmentId && !trasaBezOutputu?.startsWith('/reports/builder/')
          ? await idZamrozonegoOutputu(assessmentId)
          : null;
      if (cancelled) return;

      const trasa = trasaZPayloaduRaportu(pelny, idOutputu);
      if (trasa) {
        setWynik({ stan: 'trasa', trasa });
        return;
      }
      // Raport istnieje, ale nie ma ani wiersza Kreatora, ani oceny źródłowej —
      // nie ma dokąd wejść, więc mówimy to wprost zamiast otwierać pusty kreator.
      setWynik({ stan: 'brak' });
    };

    void rozstrzygnij();

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
