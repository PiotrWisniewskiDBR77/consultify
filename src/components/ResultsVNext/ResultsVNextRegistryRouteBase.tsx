/**
 * ResultsVNextRegistryRouteBase — the route-mounted entry point shared by the
 * three thin per-domain pages (`ResultsKpiRegistryPage.tsx` /
 * `ResultsRoiRegistryPage.tsx` / `ResultsOkrRegistryPage.tsx`). P0 (this
 * package) wires the route + flag + shell honestly with ZERO domain data —
 * columns/filters/rowMenu/preview content are P1/P2/P3 work
 * (RN_G2_UI_SCOPE.md §G). Until then this renders `ResultsVNextRegistryShell`
 * in a genuine, honest "no rows yet" empty state so the route is real and
 * clickable end-to-end without pretending a domain screen exists.
 *
 * Behind its own per-domain flag (`resultsVNextFeatureFlags.ts`, default
 * OFF): disabled renders a small, honest "not yet enabled" panel — NOT the
 * full shell — so nothing half-built is visible by default (CLAUDE.md rule
 * #7). Full state coverage (loading/empty/error/forbidden/locked +
 * honest-missing values) is demonstrated by the dev-render harness screen
 * (`dev-render/screens/results-vnext-registry-shell.tsx`), not by this route.
 */

import { Blocks } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/shared/states';

import { ResultsVNextRegistryShell } from './ResultsVNextRegistryShell';
import { isResultsVNextFlagEnabled, type ResultsVNextFlag } from './resultsVNextFeatureFlags';
import type { ResultsVNextDomain } from './types';

export interface ResultsVNextRegistryRouteBaseProps {
  domain: ResultsVNextDomain;
  flag: ResultsVNextFlag;
  titlePl: string;
  titleEn: string;
}

export const ResultsVNextRegistryRouteBase: React.FC<ResultsVNextRegistryRouteBaseProps> = ({
  domain,
  flag,
  titlePl,
  titleEn,
}) => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const title = isPolish ? titlePl : titleEn;
  const enabled = isResultsVNextFlagEnabled(flag);

  if (!enabled) {
    return (
      <div
        className="h-full flex items-center justify-center p-6"
        data-testid={`results-vnext-${domain}-disabled`}
      >
        <EmptyState
          variant="new"
          icon={Blocks}
          title={
            isPolish ? `${title} — jeszcze nie włączone` : `${title} — not yet enabled`
          }
          description={
            isPolish
              ? 'Ten rejestr jest w budowie. Wróć później albo poproś administratora o dostęp za flagą.'
              : 'This registry is still being built. Check back later, or ask an administrator for flag access.'
          }
          compact
        />
      </div>
    );
  }

  return (
    <ResultsVNextRegistryShell
      domain={domain}
      moduleBar={{
        tabs: [{ id: 'my', label: isPolish ? 'Moje' : 'My' }],
        activeTab: 'my',
        showTabCounts: false,
        viewModes: ['table'],
        viewMode: 'table',
      }}
      table={{
        columns: [],
        data: [],
        persistKey: `results-vnext.${domain}-registry`,
        empty: {
          title: isPolish ? `Brak pozycji (${title})` : `No items yet (${title})`,
          description: isPolish
            ? 'Rejestr jest gotowy, ale narzędzie domenowe nie jest jeszcze podłączone (P0 — sama powłoka).'
            : 'The registry shell is ready, but the domain tool is not wired yet (P0 — shell only).',
        },
      }}
      preview={null}
    />
  );
};

export default ResultsVNextRegistryRouteBase;
