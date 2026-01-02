/**
 * AdminBillingManagement - Organization billing and subscription management
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Download, Calendar, TrendingUp, DollarSign, Users, RefreshCw } from 'lucide-react';
import { Api } from '../../services/api';
import { Invoice } from '../../types';

interface BillingData {
  plan: string;
  status: string;
  nextBilling: string;
  amount: number;
  users: number;
  maxUsers: number;
}

interface AdminBillingManagementProps {
  className?: string;
}

export const AdminBillingManagement: React.FC<AdminBillingManagementProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  useEffect(() => {
    fetchBillingData();
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const data = await Api.getInvoices();
      setInvoices(data);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/billing', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setBilling(data);
      }
    } catch (_error) {
      // Mock data
      setBilling({
        plan: 'Professional',
        status: 'active',
        nextBilling: '2025-02-01',
        amount: 299,
        users: 12,
        maxUsers: 25
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">{t('common.loading', 'Loading...')}</div>;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <CreditCard size={16} className="text-slate-500" />
            {t('admin.billing.title', 'Billing & Subscription')}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('admin.billing.desc', 'Manage your organization\'s subscription and billing')}
          </p>
        </div>
        <button className="admin-btn admin-btn-accent">
          {t('admin.billing.upgrade', 'Upgrade Plan')}
        </button>
      </div>

      {/* Current Plan - Clean minimal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="admin-metric">
          <div className="flex items-center gap-2">
            <CreditCard size={14} className="text-slate-500" />
            <span className="admin-metric-label">{t('admin.billing.currentPlan', 'Current Plan')}</span>
          </div>
          <p className="admin-metric-value">{billing?.plan}</p>
          <p className="admin-metric-subtitle">${billing?.amount}/month</p>
        </div>

        <div className="admin-metric">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-slate-500" />
            <span className="admin-metric-label">{t('admin.billing.nextBilling', 'Next Billing')}</span>
          </div>
          <p className="admin-metric-value">{billing?.nextBilling}</p>
        </div>

        <div className="admin-metric">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-slate-500" />
            <span className="admin-metric-label">{t('admin.billing.seats', 'Seats Used')}</span>
          </div>
          <p className="admin-metric-value">
            {billing?.users} / {billing?.maxUsers}
          </p>
          <div className="w-full bg-white/5 rounded-full h-1.5 mt-2">
            <div
              className="bg-[var(--admin-accent)] rounded-full h-1.5"
              style={{ width: `${((billing?.users || 0) / (billing?.maxUsers || 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Usage & Invoices - Clean minimal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Usage */}
        <div className="admin-card p-4">
          <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-slate-500" />
            {t('admin.billing.usage', 'Current Usage')}
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-500">AI Tokens</span>
                <span className="text-slate-300">75,000 / 100,000</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5">
                <div className="bg-slate-400 rounded-full h-1.5" style={{ width: '75%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-500">Storage</span>
                <span className="text-slate-300">2.5 GB / 10 GB</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5">
                <div className="bg-slate-500 rounded-full h-1.5" style={{ width: '25%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-500">Projects</span>
                <span className="text-slate-300">8 / 20</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5">
                <div className="bg-slate-500 rounded-full h-1.5" style={{ width: '40%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="admin-card p-4">
          <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
            <DollarSign size={14} className="text-slate-500" />
            {t('admin.billing.invoices', 'Recent Invoices')}
          </h3>
          <div className="space-y-2">
            {loadingInvoices ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 text-slate-500 animate-spin" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-sm">
                {t('admin.billing.noInvoices', 'No invoices found')}
              </div>
            ) : (
              invoices.map((invoice, i) => (
                <div key={invoice.id || i} className="flex items-center justify-between p-3 bg-white/[0.02] hover:bg-white/[0.04] rounded-lg transition-colors">
                  <div>
                    <p className="text-sm text-white">
                      {invoice.currency === 'USD' ? '$' : ''}{(invoice.amount_paid / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`admin-status ${
                      invoice.status === 'Paid' || invoice.status === 'paid'
                        ? 'admin-status-healthy'
                        : 'admin-status-warning'
                    }`}>
                      <span className="admin-status-dot" />
                      {invoice.status}
                    </span>
                    {invoice.downloadUrl && (
                      <a
                        href={invoice.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-slate-500 hover:text-white transition-colors"
                      >
                        <Download size={14} />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Payment Method - Clean minimal */}
      <div className="admin-card p-4">
        <h3 className="text-sm font-medium text-white mb-4">
          {t('admin.billing.paymentMethod', 'Payment Method')}
        </h3>
        <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
          <div className="flex items-center gap-3">
            <CreditCard size={16} className="text-slate-500" />
            <div>
              <p className="text-sm text-white">•••• •••• •••• 4242</p>
              <p className="text-xs text-slate-500 mt-0.5">Expires 12/2026</p>
            </div>
          </div>
          <button className="admin-btn admin-btn-subtle text-sm">
            {t('admin.billing.update', 'Update')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminBillingManagement;

