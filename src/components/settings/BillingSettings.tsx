import { Clock, CreditCard, ExternalLink, FileText } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

import { usePermissions } from '../../hooks/usePermissions';
import { User } from '../../types';
import { BillingCore } from '../shared/BillingCore';
import { InfoButton } from '../shared/InfoButton';

interface BillingSettingsProps {
  currentUser: User;
}

export const BillingSettings: React.FC<BillingSettingsProps> = ({ currentUser }) => {
  const { isAdmin, canManageOrgBilling } = usePermissions();

  return (
    <div className="max-w-4xl relative">
      <InfoButton cardId="settings-billing" position="top-right" />
      <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">
        Subscription & Billing
      </h2>
      <BillingCore
        mode={isAdmin ? 'org-admin' : 'user'}
        currentUser={currentUser}
        showUserLicense={true}
        showCurrentPlan={true}
        showUsageMeters={true}
        showAvailablePlans={canManageOrgBilling}
        showInvoices={true}
      />

      {/* Legal Documents Section */}
      <div className="mt-8 pt-6 border-t border-slate-200 dark:border-navy-700">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
          Billing & Subscription Terms
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <LegalDocumentLink
            to="/legal/subscription"
            icon={<FileText className="w-4 h-4" />}
            title="Subscription Agreement"
            description="Plans, pricing, AI credits"
          />
          <LegalDocumentLink
            to="/legal/sla"
            icon={<Clock className="w-4 h-4" />}
            title="Service Level Agreement"
            description="Uptime & support guarantees"
          />
          <LegalDocumentLink
            to="/legal/refunds"
            icon={<CreditCard className="w-4 h-4" />}
            title="Refund Policy"
            description="Cancellations & refunds"
          />
        </div>
      </div>
    </div>
  );
};

interface LegalDocumentLinkProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const LegalDocumentLink: React.FC<LegalDocumentLinkProps> = ({ to, icon, title, description }) => (
  <Link
    to={to}
    className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group"
  >
    <div className="text-slate-400 dark:text-slate-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 mt-0.5">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400">
          {title}
        </span>
        <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500" />
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400">{description}</span>
    </div>
  </Link>
);
