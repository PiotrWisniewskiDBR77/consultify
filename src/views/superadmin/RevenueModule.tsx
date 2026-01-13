/**
 * RevenueModule - Revenue & Billing Management
 *
 * Tabs: Billing | Invoices | Usage | Pricing Plans | Subscriptions | Revenue Recognition | Forecasts | Payments
 */

import {
  BarChart3,
  Calculator,
  CreditCard,
  Layers,
  Receipt,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import React, { useState } from 'react';

import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { InfoButton } from '../../components/shared/InfoButton';
import { UsageStatsPanel } from '../../components/SuperAdmin/UsageStatsPanel';
import { BillingCenterView } from './BillingCenterView';
import { InvoiceCenterView } from './InvoiceCenterView';
import {
  PaymentMethodsView,
  PricingPlansAdvancedView,
  RevenueForecastView,
  RevenueRecognitionView,
  SubscriptionChangesView,
} from './revenue';

interface RevenueModuleProps {
  initialTab?: string;
}

// Map tabs to help card IDs
const TAB_HELP_CARDS: Record<string, string> = {
  billing: 'superadmin-billing',
  invoices: 'superadmin-invoices',
  usage: 'superadmin-revenue',
  pricing: 'superadmin-revenue-pricing',
  subscriptions: 'superadmin-revenue-subscriptions',
  recognition: 'superadmin-revenue-recognition',
  forecasts: 'superadmin-revenue-forecast',
  payments: 'superadmin-revenue-payments',
};

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
      actions={<InfoButton cardId={TAB_HELP_CARDS[activeTab]} />}
    >
      {renderContent()}
    </TabLayout>
  );
};

export default RevenueModule;
