/**
 * RevenueModule - Revenue & Billing Management
 * 
 * Tabs: Billing | Invoices | Usage | Pricing Plans | Subscriptions | Revenue Recognition | Forecasts | Payments
 */

import React, { useState } from 'react';
import { CreditCard, Receipt, BarChart3, Layers, RefreshCw, Calculator, TrendingUp, Wallet } from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { BillingCenterView } from './BillingCenterView';
import { InvoiceCenterView } from './InvoiceCenterView';
import { UsageStatsPanel } from '../../components/SuperAdmin/UsageStatsPanel';
import { 
    PricingPlansAdvancedView, 
    SubscriptionChangesView, 
    RevenueRecognitionView, 
    RevenueForecastView, 
    PaymentMethodsView 
} from './revenue';

interface RevenueModuleProps {
    initialTab?: string;
}

export const RevenueModule: React.FC<RevenueModuleProps> = ({ initialTab }) => {
    const [activeTab, setActiveTab] = useState(initialTab || 'billing');

    const tabs: Tab[] = [
        { id: 'billing', label: 'Billing', icon: <CreditCard size={16} /> },
        { id: 'invoices', label: 'Invoices', icon: <Receipt size={16} /> },
        { id: 'usage', label: 'Usage', icon: <BarChart3 size={16} /> },
        { id: 'pricing', label: 'Pricing Plans', icon: <Layers size={16} /> },
        { id: 'subscriptions', label: 'Subscriptions', icon: <RefreshCw size={16} /> },
        { id: 'recognition', label: 'Revenue Recognition', icon: <Calculator size={16} /> },
        { id: 'forecasts', label: 'Forecasts', icon: <TrendingUp size={16} /> },
        { id: 'payments', label: 'Payments', icon: <Wallet size={16} /> },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'billing':
                return <BillingCenterView />;
            case 'invoices':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <InvoiceCenterView />
                    </div>
                );
            case 'usage':
                return <UsageStatsPanel />;
            case 'pricing':
                return <PricingPlansAdvancedView />;
            case 'subscriptions':
                return <SubscriptionChangesView />;
            case 'recognition':
                return <RevenueRecognitionView />;
            case 'forecasts':
                return <RevenueForecastView />;
            case 'payments':
                return <PaymentMethodsView />;
            default:
                return null;
        }
    };

    return (
        <TabLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title="Revenue"
            subtitle="Billing, invoices, pricing, subscriptions, recognition, forecasts and payment management"
        >
            {renderContent()}
        </TabLayout>
    );
};

export default RevenueModule;



