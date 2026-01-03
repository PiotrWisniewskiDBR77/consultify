/**
 * AdminSettingsModule - Organization Settings
 * 
 * Tabs: Organization | Billing | Payment | Tax | Alerts | Security | Feedback
 */

import React, { useState, useEffect } from 'react';
import { Building2, CreditCard, Shield, MessageSquare, Wallet, Receipt, Bell, Database, FileText, Palette, Webhook, Key } from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { OrganizationProfileForm } from '../../components/settings/OrganizationProfileForm';
import { BillingSettings } from '../../components/settings/BillingSettings';
import { SecuritySettings } from '../../components/settings/SecuritySettings';
import { PaymentMethodsPanel } from '../../components/billing/PaymentMethodsPanel';
import { TaxSettingsForm } from '../../components/billing/TaxSettingsForm';
import { UsageAlertsConfig } from '../../components/billing/UsageAlertsConfig';
import { SubscriptionManager } from '../../components/billing/SubscriptionManager';
import { DataGovernancePanel } from '../../components/Admin/DataGovernancePanel';
import { AuditExportPanel } from '../../components/Admin/AuditExportPanel';
import { BrandingSettingsPanel } from '../../components/Admin/BrandingSettingsPanel';
import { IntegrationsManagementPanel } from '../../components/Admin/IntegrationsManagementPanel';
import { ApiKeysManagementView } from './ApiKeysManagementView';
import { useTranslation } from 'react-i18next';
import { Api } from '../../services/api';
import { User } from '../../types';

interface AdminSettingsModuleProps {
    initialTab?: string;
    currentUser: User;
}

// Simple Feedback View Component
const AdminFeedbackView: React.FC = () => {
    const { t } = useTranslation();
    const [feedback, setFeedback] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFeedback = async () => {
            try {
                const data = await Api.getFeedback();
                setFeedback(data);
            } catch (err) {
                console.error('Failed to fetch feedback:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchFeedback();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {t('admin.feedback.title', 'User Feedback')}
                </h3>
                <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-full">
                    {feedback.length} {t('admin.feedback.items', 'items')}
                </span>
            </div>

            {feedback.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-white/5 rounded-xl">
                    <MessageSquare className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-slate-500 dark:text-slate-400">
                        {t('admin.feedback.empty', 'No feedback received yet')}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {feedback.slice(0, 20).map((item: any) => (
                        <div
                            key={item.id}
                            className="p-4 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${item.status === 'new' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300' :
                                            item.status === 'resolved' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' :
                                                'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300'
                                            }`}>
                                            {item.status}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {item.type || 'General'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-700 dark:text-slate-300">
                                        {item.message || item.content}
                                    </p>
                                </div>
                                <span className="text-xs text-slate-400">
                                    {new Date(item.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const AdminSettingsModule: React.FC<AdminSettingsModuleProps> = ({
    initialTab,
    currentUser
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(initialTab || 'organization');
    const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);

    // Fetch pending feedback count
    useEffect(() => {
        const fetchPendingCount = async () => {
            try {
                const feedback = await Api.getFeedback();
                const pending = feedback.filter((f: any) => f.status === 'new' || f.status === 'pending').length;
                setPendingFeedbackCount(pending);
            } catch (err) {
                // Silently fail
            }
        };
        fetchPendingCount();
    }, [activeTab]);

    const tabs: Tab[] = [
        {
            id: 'organization',
            label: t('admin.tabs.organization', 'Organization'),
            icon: <Building2 size={16} />
        },
        {
            id: 'branding',
            label: t('admin.tabs.branding', 'Branding'),
            icon: <Palette size={16} />
        },
        {
            id: 'billing',
            label: t('admin.tabs.billing', 'Plans'),
            icon: <CreditCard size={16} />
        },
        {
            id: 'payment',
            label: t('admin.tabs.payment', 'Payment'),
            icon: <Wallet size={16} />
        },
        {
            id: 'tax',
            label: t('admin.tabs.tax', 'Tax'),
            icon: <Receipt size={16} />
        },
        {
            id: 'alerts',
            label: t('admin.tabs.alerts', 'Alerts'),
            icon: <Bell size={16} />
        },
        {
            id: 'security',
            label: t('admin.tabs.security', 'Security'),
            icon: <Shield size={16} />
        },
        {
            id: 'governance',
            label: t('admin.tabs.governance', 'Governance'),
            icon: <Database size={16} />
        },
        {
            id: 'audit',
            label: t('admin.tabs.audit', 'Audit'),
            icon: <FileText size={16} />
        },
        {
            id: 'integrations',
            label: t('admin.tabs.integrations', 'Integrations'),
            icon: <Webhook size={16} />
        },
        {
            id: 'api',
            label: t('admin.tabs.api', 'API'),
            icon: <Key size={16} />
        },
        {
            id: 'feedback',
            label: t('admin.tabs.feedback', 'Feedback'),
            icon: <MessageSquare size={16} />,
            badge: pendingFeedbackCount
        },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'organization':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <OrganizationProfileForm currentUser={currentUser} />
                    </div>
                );
            case 'branding':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <BrandingSettingsPanel />
                    </div>
                );
            case 'billing':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <SubscriptionManager />
                    </div>
                );
            case 'payment':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <PaymentMethodsPanel />
                    </div>
                );
            case 'tax':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <TaxSettingsForm />
                    </div>
                );
            case 'alerts':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <UsageAlertsConfig />
                    </div>
                );
            case 'security':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <SecuritySettings currentUser={currentUser} />
                    </div>
                );
            case 'governance':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <DataGovernancePanel />
                    </div>
                );
            case 'audit':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AuditExportPanel />
                    </div>
                );
            case 'integrations':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <IntegrationsManagementPanel />
                    </div>
                );
            case 'api':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <ApiKeysManagementView />
                    </div>
                );
            case 'feedback':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AdminFeedbackView />
                    </div>
                );
            default:
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <OrganizationProfileForm currentUser={currentUser} />
                    </div>
                );
        }
    };

    return (
        <TabLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title={t('admin.modules.settings', 'Settings')}
            subtitle={t('admin.modules.settingsDesc', 'Organization profile, billing, security, and feedback management')}
        >
            {renderContent()}
        </TabLayout>
    );
};

export default AdminSettingsModule;

