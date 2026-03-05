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
  useIsDemo,
  useIsTrial,
  useIsTrialExpired,
  usePolicySnapshot,
} from '../../contexts/AccessPolicyContext';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import DemoBanner from './DemoBanner';
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
  const isDemo = useIsDemo();
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
      snapshot.trialDaysLeft > 7
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

  if (loading || !snapshot) {
    return null;
  }

  // PAID orgs see no banners
  if (snapshot.isPaid) {
    return null;
  }

  return (
    <>
      {/* Demo Banner — skip when DemoModeBanner already shows (toggle flow) */}
      {isDemo && !isDemoMode && <DemoBanner onStartTrialClick={onStartTrial || (() => {})} />}

      {/* Trial Banner */}
      {isTrial && !isTrialExpired && (
        <TrialBanner
          daysRemaining={snapshot.trialDaysLeft}
          warningLevel={snapshot.warningLevel}
          onUpgradeClick={onUpgrade || (() => {})}
          usageToday={snapshot.usageToday}
          limits={snapshot.limits ?? undefined}
        />
      )}

      {/* Expired Trial Banner */}
      {isTrial && isTrialExpired && (
        <TrialBanner
          daysRemaining={0}
          warningLevel="expired"
          onUpgradeClick={onUpgrade || (() => {})}
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
