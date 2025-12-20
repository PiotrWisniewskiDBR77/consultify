/**
 * Global Access Banners Component
 * 
 * Renders TrialBanner, DemoBanner, and TrialExpirationModal based on policy snapshot
 * Should be included in the main App layout
 * 
 * Step 2 Finalization: Enterprise+ Ready
 */

import React, { useState, useEffect } from 'react';
import { usePolicySnapshot, useIsDemo, useIsTrial, useIsTrialExpired } from '../contexts/AccessPolicyContext';
import TrialBanner from './TrialBanner';
import DemoBanner from './DemoBanner';
import TrialExpirationModal from './TrialExpirationModal';

interface GlobalAccessBannersProps {
    onStartTrial?: () => void;
    onUpgrade?: () => void;
    onContactSales?: () => void;
}

const GlobalAccessBanners: React.FC<GlobalAccessBannersProps> = ({
    onStartTrial,
    onUpgrade,
    onContactSales
}) => {
    const { snapshot, loading } = usePolicySnapshot();
    const isDemo = useIsDemo();
    const isTrial = useIsTrial();
    const isTrialExpired = useIsTrialExpired();

    const [showExpirationModal, setShowExpirationModal] = useState(false);
    const [modalDismissed, setModalDismissed] = useState(false);

    // Show expiration modal when trial expires (only once per session)
    useEffect(() => {
        if (isTrialExpired && !modalDismissed) {
            setShowExpirationModal(true);
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
            {/* Demo Banner */}
            {isDemo && (
                <DemoBanner onStartTrialClick={onStartTrial || (() => { })} />
            )}

            {/* Trial Banner */}
            {isTrial && !isTrialExpired && (
                <TrialBanner
                    daysRemaining={snapshot.trialDaysLeft}
                    warningLevel={snapshot.warningLevel}
                    onUpgradeClick={onUpgrade || (() => { })}
                />
            )}

            {/* Expired Trial Banner */}
            {isTrial && isTrialExpired && (
                <TrialBanner
                    daysRemaining={0}
                    warningLevel="expired"
                    onUpgradeClick={onUpgrade || (() => { })}
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
