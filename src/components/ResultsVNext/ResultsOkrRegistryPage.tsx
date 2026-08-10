/**
 * /results/okr — RN-G2 P3 #23 route entry. P0
 * (`ResultsVNextRegistryRouteBase`) built the honest empty-shell placeholder
 * shared by all three domains; this package (RN_G2_UI_SCOPE.md §G #23, "OKR
 * Sets registry") replaces it with the real OKR Set registry (`ResultsOkrHub`)
 * — list + preview only, not the full Program/Cycle/Objective/Key-Result/
 * check-in/alignment/review/closing tool (§G #24-#29, later packages).
 * Mirrors `ResultsRoiRegistryPage.tsx` exactly.
 *
 * Deliberately does NOT delegate to `ResultsVNextRegistryRouteBase` anymore
 * (that component stays untouched for KPI, which already shipped its own
 * page the same way) — this file owns its own disabled-flag fallback,
 * byte-for-byte the same shape RouteBase renders, so flipping the flag is a
 * pure swap with zero shared-file coordination needed with the sibling
 * KPI/ROI packages.
 */
import { Blocks } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/shared/states';

import { isResultsVNextFlagEnabled } from './resultsVNextFeatureFlags';
import { ResultsOkrHub } from './okr/ResultsOkrHub';

export const ResultsOkrRegistryPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const title = isPolish ? 'Rejestr OKR' : 'OKR registry';
  const enabled = isResultsVNextFlagEnabled('okrRegistry');

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-okr-disabled">
        <EmptyState
          variant="new"
          icon={Blocks}
          title={isPolish ? `${title} — jeszcze nie włączone` : `${title} — not yet enabled`}
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

  return <ResultsOkrHub />;
};

export default ResultsOkrRegistryPage;
