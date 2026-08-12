/**
 * `/results/roi/cases/:roiCaseId` — RN-G5 (2026-08-12) deep-link route for
 * the ROI Case FULL TOOL (`RoiCaseFullTool.tsx`).
 *
 * WHY THIS ROUTE NOW EXISTS: `RoiCaseFullTool.tsx`'s own header (still
 * accurate about the FOUR-PHASE STRUCTURE it documents) notes the tool was
 * originally placed as a case-scoped sub-view of `/results/roi`, switched by
 * local state, specifically because `RN_G2_UI_SCOPE.md` §G Open Question #2
 * (klasa S vs L for the full tool) was still open — a real route would have
 * silently pre-decided it. That question is CLOSED: D03
 * (`RESUME_HANDOFF_2026-08-11.md` §7) settles "pełne narzędzia to klasa L,
 * żadnych wielkich edytorów w podglądzie" as binding. `routeConfig.ts`
 * already reserved `ROUTES.RESULTS_ROI.CASE` for this (master plan §11);
 * this file mounts it. `ResultsRoiHub.tsx`'s "Open full tool" row action
 * now `navigate()`s here instead of swapping local state — see that file's
 * header for the mechanics of returning to the registry with list context
 * preserved.
 *
 * `RoiCaseFullTool`/its four phase workspaces take an ALREADY-LOADED
 * `RoiCaseListItem`, not an id (`ResultsRoiHub.tsx`'s row-click flow never
 * needed a redundant `GET /cases/:caseId` — the row IS the case). A direct
 * URL hit (bookmark, reload, Teresa link) has no such row, so this page is
 * the one place that DOES fetch by id — `getRoiCase` (`roiApi.ts`, added by
 * this same package; the server route already existed, unused by any
 * client wrapper before this).
 *
 * Loading/error/forbidden states mirror `../kpiTool/KpiToolPage.tsx`
 * byte-for-byte (same `EmptyState`/`ResultsVNextForbiddenState` shapes, same
 * `NO_VISIBILITY_RECORD` fail-closed default for a 404 — `getRoiCase`
 * collapses "does not exist" and "cross-tenant" into the identical 404, so
 * this page cannot and must not claim to know which one it was, D06/D07).
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
import { getRoiCase, type RoiCaseListItem } from './roiApi';
import { RoiCaseFullTool } from './RoiCaseFullTool';

export const RoiCaseToolPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);
  const navigate = useNavigate();
  const { roiCaseId } = useParams<{ roiCaseId: string }>();
  const enabled = isResultsVNextFlagEnabled('roiRegistry');

  const [roiCase, setRoiCase] = useState<RoiCaseListItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<ResultsVNextForbiddenDetail | null>(null);

  const loadCase = useCallback(async () => {
    if (!roiCaseId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const record = await getRoiCase(roiCaseId);
      if (!record) {
        setForbidden({ reason: 'NO_VISIBILITY_RECORD' });
        setRoiCase(null);
        return;
      }
      setForbidden(null);
      setRoiCase(record);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [roiCaseId]);

  useEffect(() => {
    if (!enabled) return;
    void loadCase();
  }, [enabled, loadCase]);

  // RN-G6-C2: preserve the current query string (carries
  // `?ff_resultsVNextRoi=1` when the flag was set via URL rather than
  // localStorage/env — see `ResultsRoiHub.tsx`'s `onModel` comment for the
  // matching fix on the way IN to this page) — otherwise every "back to
  // registry" click loses the flag and the registry itself falls back to
  // its own "not yet enabled" state for a URL-flag-only session.
  const goToRegistry = useCallback(
    () => navigate({ pathname: ROUTES.RESULTS_ROI.ROOT, search: window.location.search }),
    [navigate]
  );

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-roi-tool-disabled">
        <EmptyState
          variant="new"
          icon={Blocks}
          title={t('Narzędzie ROI — jeszcze nie włączone', 'ROI tool — not yet enabled')}
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

  if (loading || (!roiCase && !loadError)) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="results-vnext-roi-tool-loading">
        <div className="text-sm text-c-text-muted">{t('Ładowanie sprawy ROI…', 'Loading ROI case…')}</div>
      </div>
    );
  }

  if (loadError || !roiCase) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-roi-tool-error">
        <EmptyState
          variant="error"
          icon={AlertTriangle}
          title={t('Nie udało się wczytać sprawy ROI', 'Could not load the ROI case')}
          description={loadError ?? undefined}
          onRetry={() => void loadCase()}
          compact
        />
      </div>
    );
  }

  return (
    <div className="h-full" data-testid="results-vnext-roi-tool-page">
      <RoiCaseFullTool roiCase={roiCase} isPolish={isPolish} onBack={goToRegistry} />
    </div>
  );
};

export default RoiCaseToolPage;
