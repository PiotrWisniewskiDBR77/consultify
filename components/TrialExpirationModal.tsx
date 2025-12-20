import React from 'react';
import { useTranslation } from 'react-i18next';

interface TrialExpirationModalProps {
    isOpen: boolean;
    organizationName: string;
    onUpgradeClick: () => void;
    onContactSalesClick: () => void;
    onDismiss: () => void;
}

/**
 * TrialExpirationModal - Modal shown when trial expires
 * Explains read-only mode and provides upgrade/contact CTAs
 */
const TrialExpirationModal: React.FC<TrialExpirationModalProps> = ({
    isOpen,
    organizationName,
    onUpgradeClick,
    onContactSalesClick,
    onDismiss
}) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onDismiss}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
                    <div className="flex items-center gap-3">
                        <span className="text-4xl">🔒</span>
                        <div>
                            <h2 className="text-xl font-bold">
                                {t('trialExpired.title', 'Trial Expired')}
                            </h2>
                            <p className="text-orange-100 text-sm mt-1">
                                {organizationName}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-700 mb-4">
                        {t('trialExpired.message', 'Your trial period has ended. Your data is safe, but your organization is now in read-only mode.')}
                    </p>

                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <h3 className="font-semibold text-gray-800 mb-2">
                            {t('trialExpired.whatNext', 'What happens now?')}
                        </h3>
                        <ul className="text-sm text-gray-600 space-y-2">
                            <li className="flex items-start gap-2">
                                <span className="text-green-500">✓</span>
                                {t('trialExpired.dataSafe', 'Your data is preserved and secure')}
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500">✓</span>
                                {t('trialExpired.canView', 'You can still view all projects and tasks')}
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-red-500">✗</span>
                                {t('trialExpired.noCreate', 'You cannot create or modify content')}
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-red-500">✗</span>
                                {t('trialExpired.noAI', 'AI features are disabled')}
                            </li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={onUpgradeClick}
                            className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md"
                        >
                            {t('trialExpired.upgrade', 'Upgrade Now')}
                        </button>
                        <button
                            onClick={onContactSalesClick}
                            className="w-full py-3 px-4 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-all"
                        >
                            {t('trialExpired.contactSales', 'Contact Sales')}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 text-center">
                    <button
                        onClick={onDismiss}
                        className="text-sm text-gray-500 hover:text-gray-700"
                    >
                        {t('trialExpired.dismiss', 'Dismiss for now')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TrialExpirationModal;
