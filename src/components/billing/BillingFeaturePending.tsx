/**
 * BillingFeaturePending — honest "not available yet" state for billing/revenue
 * analytics surfaces whose backend endpoints are not built out yet (they return
 * HTTP 503 `not_configured`).
 *
 * Decision D8: live self-serve billing + revenue analytics (MRR/churn/cohort/
 * recognition/forecast/subscription-changes) are DEFERRED. Rather than letting
 * the UI fire dead requests and render raw 503 error banners, these surfaces
 * render this honest empty state when `isBillingSelfServeEnabled()` is OFF.
 *
 * Uses the shared EmptyState primitive + crimson accent (brand canon).
 */

import { Clock } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui';

interface BillingFeaturePendingProps {
  /** Optional override title. */
  title?: string;
  /** Optional override description. */
  description?: string;
}

export const BillingFeaturePending: React.FC<BillingFeaturePendingProps> = ({
  title,
  description,
}) => {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<Clock className="text-crimson-600 dark:text-crimson-400" />}
      title={title ?? t('billing.pending.title', 'Not available yet')}
      description={
        description ??
        t(
          'billing.pending.description',
          'This billing capability is not enabled yet. It will appear here once self-serve billing is turned on.'
        )
      }
    />
  );
};

export default BillingFeaturePending;
