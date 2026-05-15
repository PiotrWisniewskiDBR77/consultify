/**
 * Global Access Banners Component
 *
 * Renders TrialBanner, DemoBanner, and TrialExpirationModal based on policy snapshot
 * Should be included in the main App layout
 *
 * Step 2 Finalization: Enterprise+ Ready
 */

import React, { useEffect, useRef, useState } from 'react';

import {
  useIsTrial,
  useIsTrialExpired,
  usePolicySnapshot,
} from '../../contexts/AccessPolicyContext';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import TrialBanner from './TrialBanner';
import TrialExpirationModal from './TrialExpirationModal';

interface GlobalAccessBannersProps {
  onStartTrial?: () => void;
  onUpgrade?: () => void;
  onContactSales?: () => void;
}

const GlobalAccessBanners: React.FC<GlobalAccessBannersProps> = ({
  onStartTrial,
  onUpgrade,
  onContactSales,
}) => {
  const { snapshot, loading } = usePolicySnapshot();
  const isTrial = useIsTrial();
  const isTrialExpired = useIsTrialExpired();
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const trialWarningRecordedRef = useRef(false);

  const [showExpirationModal, setShowExpirationModal] = useState(false);
  const [modalDismissed, setModalDismissed] = useState(false);

  // TRIAL-03: Record trial_expiry_warning_shown when user sees trial banner (T-7, T-3, T-1) — once per session
  useEffect(() => {
    if (
      !snapshot ||
      !isTrial ||
      isTrialExpired ||
      trialWarningRecordedRef.current ||
      snapshot.warningLevel === 'none'
    ) {
      return;
    }
    trialWarningRecordedRef.current = true;
    Api.recordDemoTrialEvent({
      eventType: 'trial_expiry_warning_shown',
      metadata: { daysRemaining: snapshot.trialDaysLeft },
    }).catch(() => {
      trialWarningRecordedRef.current = false; // retry next mount
    });
  }, [snapshot, isTrial, isTrialExpired]);

  // Show expiration modal when trial expires (only once per session)
  useEffect(() => {
    if (isTrialExpired && !modalDismissed) {
      // Defer state update to avoid synchronous setState in effect
      queueMicrotask(() => setShowExpirationModal(true));
    }
  }, [isTrialExpired, modalDismissed]);

  const handleDismissModal = () => {
    setShowExpirationModal(false);
    setModalDismissed(true);
  };

  const handleUpgrade = () => {
    setShowExpirationModal(false);
    onUpgrade?.();
  };

  const handleContactSales = () => {
    setShowExpirationModal(false);
    onContactSales?.();
  };

  const handleBannerAction = () => {
    const target = snapshot?.upgradeCtas?.urlOrRoute || '/settings?tab=billing';
    const isManualAction =
      snapshot?.posture === 'paid_manual_renewal_due' || snapshot?.posture === 'suspended';

    if (isManualAction) {
      if (onContactSales) {
        onContactSales();
        return;
      }
      window.location.assign(target);
      return;
    }

    if (snapshot?.isDemo) {
      if (onStartTrial) {
        onStartTrial();
        return;
      }
      window.location.assign(target);
      return;
    }

    if (onUpgrade) {
      onUpgrade();
      return;
    }
    window.location.assign(target);
  };

  if (loading || !snapshot) {
    return null;
  }

  const showPaymentBanner =
    snapshot.posture === 'paid_past_due' ||
    snapshot.posture === 'paid_canceling' ||
    snapshot.posture === 'paid_manual_renewal_due' ||
    snapshot.posture === 'suspended';

  if (!showPaymentBanner && snapshot.isPaid && !isDemoMode) {
    return null;
  }

  return (
    <>
      {/* Trial Banner */}
      {isTrial && !isTrialExpired && (
        <TrialBanner
          daysRemaining={snapshot.trialDaysLeft}
          warningLevel={snapshot.warningLevel}
          onUpgradeClick={handleBannerAction}
          usageToday={snapshot.usageToday}
          limits={snapshot.limits ?? undefined}
        />
      )}

      {/* Expired Trial Banner */}
      {isTrial && isTrialExpired && (
        <TrialBanner daysRemaining={0} warningLevel="expired" onUpgradeClick={handleBannerAction} />
      )}

      {showPaymentBanner && !isTrial && (
        <TrialBanner
          daysRemaining={snapshot.trialDaysLeft}
          warningLevel={
            snapshot.posture === 'paid_manual_renewal_due' || snapshot.posture === 'paid_canceling'
              ? 'warning'
              : 'expired'
          }
          onUpgradeClick={handleBannerAction}
          bannerText={snapshot.messages.bannerText}
          actionLabel={snapshot.upgradeCtas?.primaryAction}
        />
      )}

      {/* Trial Expiration Modal */}
      {showExpirationModal && (
        <TrialExpirationModal
          isOpen={showExpirationModal}
          onDismiss={handleDismissModal}
          onUpgradeClick={handleUpgrade}
          onContactSalesClick={handleContactSales}
          organizationName=""
        />
      )}
    </>
  );
};

export default GlobalAccessBanners;
