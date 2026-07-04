import React, { useState } from 'react';

import { InfoButton } from '../../../components/shared/InfoButton';
import { PaymentMethodsView } from './PaymentMethodsView';
import { PricingPlansAdvancedView } from './PricingPlansAdvancedView';
import { RevenueForecastView } from './RevenueForecastView';
import { RevenueRecognitionView } from './RevenueRecognitionView';
import { SubscriptionChangesView } from './SubscriptionChangesView';

type RevenueTab = 'pricing' | 'subscriptions' | 'recognition' | 'forecast' | 'payments';

const TAB_HELP_CARDS: Record<RevenueTab, string> = {
  pricing: 'superadmin-revenue-pricing',
  subscriptions: 'superadmin-revenue-subscriptions',
  recognition: 'superadmin-revenue-recognition',
  forecast: 'superadmin-revenue-forecast',
  payments: 'superadmin-revenue-payments',
};

export const RevenueModuleView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<RevenueTab>('pricing');

  const tabs: { id: RevenueTab; label: string; description: string }[] = [
    { id: 'pricing', label: 'Pricing Plans', description: 'Manage pricing tiers and features' },
    {
      id: 'subscriptions',
      label: 'Subscription Changes',
      description: 'Handle upgrades, downgrades & cancellations',
    },
    { id: 'recognition', label: 'Revenue Recognition', description: 'ASC 606 compliance tracking' },
    { id: 'forecast', label: 'Revenue Forecast', description: 'Predictive revenue analysis' },
    { id: 'payments', label: 'Payment Management', description: 'Payment methods & dunning' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'pricing':
        return <PricingPlansAdvancedView />;
      case 'subscriptions':
        return <SubscriptionChangesView />;
      case 'recognition':
        return <RevenueRecognitionView />;
      case 'forecast':
        return <RevenueForecastView />;
      case 'payments':
        return <PaymentMethodsView />;
      default:
        return <PricingPlansAdvancedView />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl p-6 border border-emerald-200 dark:border-green-800/50">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Revenue & Billing Module
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Comprehensive revenue management including pricing, subscriptions, recognition,
              forecasting, and payments
            </p>
          </div>
          <InfoButton cardId="superadmin-revenue" />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 bg-white dark:bg-navy-900/50 p-2 rounded-xl border border-slate-200 dark:border-c-border-subtle">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[180px] px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-green-600 text-white shadow-lg'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:bg-navy-800/60 dark:text-slate-400 dark:hover:bg-navy-700 dark:hover:text-white'
            }`}
          >
            <div className="font-medium">{tab.label}</div>
            <div className="text-xs opacity-75 mt-0.5">{tab.description}</div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        <div className="flex justify-end mb-4">
          <InfoButton cardId={TAB_HELP_CARDS[activeTab]} />
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default RevenueModuleView;
