/**
 * RevenueModule - Revenue & Billing Management
 * 
 * Tabs: Billing | Invoices | Usage
 */

import React, { useState } from 'react';
import { CreditCard, Receipt, BarChart3 } from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { BillingCenterView } from './BillingCenterView';
import { InvoiceCenterView } from './InvoiceCenterView';
import { UsageStatsPanel } from '../../components/SuperAdmin/UsageStatsPanel';

interface RevenueModuleProps {
    initialTab?: string;
}

export const RevenueModule: React.FC<RevenueModuleProps> = ({ initialTab }) => {
    const [activeTab, setActiveTab] = useState(initialTab || 'billing');

    const tabs: Tab[] = [
        { id: 'billing', label: 'Billing', icon: <CreditCard size={16} /> },
        { id: 'invoices', label: 'Invoices', icon: <Receipt size={16} /> },
        { id: 'usage', label: 'Usage', icon: <BarChart3 size={16} /> },
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
            subtitle="Billing, invoices, and usage analytics"
        >
            {renderContent()}
        </TabLayout>
    );
};

export default RevenueModule;



