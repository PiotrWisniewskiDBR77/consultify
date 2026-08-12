/**
 * `/results/okr/sets/:okrSetId` — RN-G5 (2026-08-12) deep-link route for the
 * OKR Set FULL TOOL (`OkrSetWorkspace.tsx`).
 *
 * WHY THIS ROUTE NOW EXISTS: `OkrSetWorkspace.tsx`'s own header documents the
 * workspace was placed as a breadcrumb-drill sub-view of `/results/okr`,
 * switched by local state in `ResultsOkrHub.tsx` (`drill.level ===
 * 'workspace'`) — the same `RN_G2_UI_SCOPE.md` §G Open Question #2
 * rationale `RoiCaseFullTool.tsx` documents. That question is CLOSED: D03
 * (`RESUME_HANDOFF_2026-08-11.md` §7) — "pełne narzędzia to klasa L" is
 * binding. `routeConfig.ts` already reserved `ROUTES.RESULTS_OKR.SET`; this
 * file mounts it. `ResultsOkrHub.tsx`'s "Otwórz obszar roboczy" row/preview
 * action now `navigate()`s here instead of setting `drill` — the pre-
 * existing Objectives/Key Results/Check-ins breadcrumb-drill levels (§G #25)
 * are UNCHANGED, still local `drill` state under `/results/okr` (they were
 * never part of Open Question #2 — only the full workspace was).
 *
 * `OkrSetWorkspace` takes an ALREADY-LOADED `OkrSetDto`, not an id — a
 * direct URL hit has no such row, so this page fetches by id via
 * `getOkrSet` (`okrApi.ts`), the SAME function `ResultsOkrHub.tsx`'s
 * pre-existing `?setId=` deep-link already uses (not a new endpoint
 * wrapper — see that function's own header for why the 404 branch collapses
 * "does not exist" and "cross-tenant" into one response, D06/D07).
 *
 * Loading/error/forbidden states mirror `../kpiTool/KpiToolPage.tsx` /
 * `../roi/RoiCaseToolPage.tsx` byte-for-byte.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Blocks } from 'lucide-react';

import { EmptyState } from '@/components/shared/states';
import { ROUTES } from '@/routes/routeConfig';

import { ResultsVNextForbiddenState } from '../ResultsVNextForbiddenState';
import type { ResultsVNextForbiddenDetail } from '../types';
import { isResultsVNextFlagEnabled } from '../resultsVNextFeatureFlags';
import { getOkrSet, type OkrSetDto } from './okrApi';
import { OkrSetWorkspace } from './OkrSetWorkspace';

export const OkrSetToolPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);
  const navigate = useNavigate();
  const { okrSetId } = useParams<{ okrSetId: string }>();
  const enabled = isResultsVNextFlagEnabled('okrRegistry');

  const [set, setSet] = useState<OkrSetDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<ResultsVNextForbiddenDetail | null>(null);

  const loadSet = useCallback(async () => {
    if (!okrSetId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const record = await getOkrSet(okrSetId);
      if (!record) {
        setForbidden({ reason: 'NO_VISIBILITY_RECORD' });
        setSet(null);
        return;
      }
      setForbidden(null);
      setSet(record);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [okrSetId]);

  useEffect(() => {
    if (!enabled) return;
    void loadSet();
  }, [enabled, loadSet]);

  const goToRegistry = useCallback(
    () => navigate(`${ROUTES.RESULTS_OKR.ROOT}${window.location.search}`),
    [navigate]
  );
  const setsLabel = t('Zestawy OKR', 'OKR sets');

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-okr-tool-disabled">
        <EmptyState
          variant="new"
          icon={Blocks}
          title={t('Narzędzie OKR — jeszcze nie włączone', 'OKR tool — not yet enabled')}
          description={t(
            'Ten ekran jest w budowie. Wróć później albo poproś administratora o dostęp za flagą.',
            'This screen is still being built. Check back later, or ask an administrator for flag access.'
          )}
          compact
        />
      </div>
    );
  }

  if (forbidden) {
    return <ResultsVNextForbiddenState forbidden={forbidden} onBack={goToRegistry} />;
  }

  if (loading || (!set && !loadError)) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="results-vnext-okr-tool-loading">
        <div className="text-sm text-c-text-muted">{t('Ładowanie zestawu OKR…', 'Loading OKR set…')}</div>
      </div>
    );
  }

  if (loadError || !set) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-okr-tool-error">
        <EmptyState
          variant="error"
          icon={AlertTriangle}
          title={t('Nie udało się wczytać zestawu OKR', 'Could not load the OKR set')}
          description={loadError ?? undefined}
          onRetry={() => void loadSet()}
          compact
        />
      </div>
    );
  }

  return (
    <div className="h-full" data-testid="results-vnext-okr-tool-page">
      <OkrSetWorkspace
        set={set}
        isPolish={isPolish}
        setsLabel={setsLabel}
        onBackToSets={goToRegistry}
        onSetChanged={(updated) => setSet(updated)}
      />
    </div>
  );
};

export default OkrSetToolPage;
