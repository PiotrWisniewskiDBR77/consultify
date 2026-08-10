/**
 * /results/roi — RN-G2 P2 route entry. P0 (`ResultsVNextRegistryRouteBase`)
 * built the honest empty-shell placeholder shared by all three domains;
 * this package (RN_G2_UI_SCOPE.md §G #11, "ROI vertical") replaces it with
 * the real ROI Case registry (`ResultsRoiHub`) — list + preview only, not
 * the full 15-sub-resource Case tool (§G #12-21, later packages).
 *
 * Deliberately does NOT delegate to `ResultsVNextRegistryRouteBase` anymore
 * (that component stays untouched for KPI/OKR, which have not shipped their
 * domain screens yet) — this file owns its own disabled-flag fallback,
 * byte-for-byte the same shape RouteBase renders, so flipping the flag is a
 * pure swap with zero shared-file coordination needed with the sibling
 * KPI/OKR packages.
 */
import { Blocks } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/shared/states';

import { isResultsVNextFlagEnabled } from './resultsVNextFeatureFlags';
import { ResultsRoiHub } from './roi/ResultsRoiHub';

export const ResultsRoiRegistryPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const title = isPolish ? 'Rejestr ROI' : 'ROI registry';
  const enabled = isResultsVNextFlagEnabled('roiRegistry');

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-roi-disabled">
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

  return <ResultsRoiHub />;
};

export default ResultsRoiRegistryPage;
