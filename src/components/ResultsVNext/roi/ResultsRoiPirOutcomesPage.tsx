/**
 * /results/roi/pir-outcomes — RN-G5 §G #11 route entry
 * (`ROUTES.RESULTS_ROI.PIR_OUTCOMES`). Same disabled-flag fallback shape as
 * `../ResultsRoiRegistryPage.tsx` (byte-for-byte, task convention for every
 * RN-G2/RN-G5 domain screen), gated behind the SAME `roiRegistry` flag as
 * the rest of the ROI vertical (`resultsVNextFeatureFlags.ts`'s "one flag
 * per domain" convention — this is still the ROI domain, just a second
 * perspective on it).
 *
 * See `RoiPirOutcomesTab.tsx`'s own header for why this is a standalone
 * route today rather than a `ResultsRoiHub.tsx` Menu 2 tab — that hub file
 * is outside this package's edit allowlist.
 */
import { Blocks } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/shared/states';

import { isResultsVNextFlagEnabled } from '../resultsVNextFeatureFlags';
import { RoiPirOutcomesTab } from './RoiPirOutcomesTab';

export const ResultsRoiPirOutcomesPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const title = isPolish ? 'Wyniki PIR (ROI)' : 'ROI PIR outcomes';
  const enabled = isResultsVNextFlagEnabled('roiRegistry');

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-roi-pir-outcomes-disabled">
        <EmptyState
          variant="new"
          icon={Blocks}
          title={isPolish ? `${title} — jeszcze nie włączone` : `${title} — not yet enabled`}
          description={
            isPolish
              ? 'Ten widok jest w budowie. Wróć później albo poproś administratora o dostęp za flagą.'
              : 'This view is still being built. Check back later, or ask an administrator for flag access.'
          }
          compact
        />
      </div>
    );
  }

  return <RoiPirOutcomesTab isPolish={isPolish} />;
};

export default ResultsRoiPirOutcomesPage;
