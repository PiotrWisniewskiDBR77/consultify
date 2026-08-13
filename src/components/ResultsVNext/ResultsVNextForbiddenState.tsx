/**
 * ResultsVNextForbiddenState — "you don't have access to this resource" for a
 * DEEP LINK to a visibility-denied KPI/ROI-case/OKR-set (typed URL, old
 * bookmark). A row the ABAC resolver DENYs must never appear in a LIST
 * (fail-closed at the query layer, RN_G1_PLATFORM_DESIGN.md §B.4
 * `rvnVisibilityScopedQuery`) — this component is only for the direct-link
 * case, distinct from a plain 404.
 *
 * Reuses the app's existing "forbidden" vocabulary — `EmptyState
 * variant="forbidden"` (Lock icon, same component My Work/Tools/etc. already
 * use) — rather than inventing new chrome, per the visual precedent named in
 * RN_G2_UI_SCOPE.md §D: `getPilotBlockedFallbackPath` /
 * `dispatchPilotAccessBlocked` in `src/utils/pilotAccess.ts` and the
 * artifact-shell "guard/transition" states (ARTIFACT_ANATOMY_STANDARD.md
 * §12.4).
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/shared/states';

import type { ResultsVNextDenyReason, ResultsVNextForbiddenDetail } from './types';

const REASON_COPY: Record<ResultsVNextDenyReason, { pl: string; en: string }> = {
  CROSS_TENANT: {
    pl: 'Ten rekord należy do innej organizacji.',
    en: 'This record belongs to a different organization.',
  },
  NO_VISIBILITY_RECORD: {
    pl: 'Brak wpisu widoczności dla tego rekordu — domyślnie traktowany jako niedostępny.',
    en: 'No visibility record exists for this item — treated as denied by default.',
  },
  PRIVATE_NOT_OWNER: {
    pl: 'Ten rekord jest prywatny i nie jesteś jego właścicielem.',
    en: 'This record is private and you are not its owner.',
  },
  OUT_OF_SCOPE: {
    pl: 'Ten rekord jest poza zakresem przypisanym do Twojego konta.',
    en: 'This record is outside the scope assigned to your account.',
  },
  NOT_IN_CHAIN: {
    pl: 'Nie jesteś w łańcuchu zatwierdzania tego rekordu.',
    en: 'You are not in the approval chain for this record.',
  },
  NOT_ON_ACL: {
    pl: 'Twoje konto nie jest na liście dostępu (ACL) tego rekordu.',
    en: 'Your account is not on this record’s access list (ACL).',
  },
};

export interface ResultsVNextForbiddenStateProps {
  forbidden: ResultsVNextForbiddenDetail;
  onBack?: () => void;
  backLabel?: string;
  className?: string;
}

export const ResultsVNextForbiddenState: React.FC<ResultsVNextForbiddenStateProps> = ({
  forbidden,
  onBack,
  backLabel,
  className,
}) => {
  const { i18n, t } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const copy = REASON_COPY[forbidden.reason];
  const description = [
    isPolish ? copy.pl : copy.en,
    forbidden.detail,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      data-testid="results-vnext-forbidden"
      data-deny-reason={forbidden.reason}
    >
      <EmptyState
        variant="forbidden"
        title={
          isPolish
            ? 'Nie masz dostępu do tego rekordu'
            : "You don't have access to this record"
        }
        description={description}
        primaryAction={
          onBack
            ? {
                label: backLabel ?? t('common.back', isPolish ? 'Wróć' : 'Back'),
                onClick: onBack,
              }
            : undefined
        }
      />
    </div>
  );
};

export default ResultsVNextForbiddenState;
