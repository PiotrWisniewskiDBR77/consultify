import React, { useEffect, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/BaseCard';
import { LoadingState } from '../../../components/ui/primitives';
import { Api } from '../../../services/api';

interface PaymentMethod {
  id: string;
  organization_id: string;
  organization_name?: string;
  payment_type: 'credit_card' | 'bank_transfer' | 'paypal' | 'invoice';
  payment_details_json: string;
  is_default: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface PaymentFailure {
  id: string;
  organization_id: string;
  organization_name?: string;
  payment_method_id: string;
  failure_reason: string;
  failure_code: string;
  attempted_at: string;
  retry_count: number;
  status: 'pending' | 'retrying' | 'resolved' | 'failed';
  resolved_at: string | null;
}

interface PaymentStats {
  totalMethods: number;
  activeMethods: number;
  pendingFailures: number;
  totalFailures: number;
  failureRate: number;
}

export const PaymentMethodsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'methods' | 'failures'>('methods');
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [failures, setFailures] = useState<PaymentFailure[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [methodsRes, failuresRes, statsRes] = await Promise.all([
        Api.getPaymentMethodsAdvanced(),
        Api.getPaymentFailures(),
        Api.getPaymentFailureStats(),
      ]);
      const methodsList = Array.isArray(methodsRes)
        ? methodsRes
        : (methodsRes as any)?.methods || [];
      const failuresList = Array.isArray(failuresRes)
        ? failuresRes
        : (failuresRes as any)?.failures || [];
      setMethods(methodsList);
      setFailures(failuresList);
      const failureStats = statsRes as any;
      const totalMethods = methodsList.length;
      const activeMethods = methodsList.filter(
        (m: any) => m.is_active !== false && m.status !== 'expired'
      ).length;
      const totalFailures = failureStats?.total || failuresList.length;
      const pendingFailures =
        failureStats?.pending ||
        failuresList.filter((f: any) => f.status === 'pending' || f.status === 'retrying').length;
      setStats({
        totalMethods,
        activeMethods,
        pendingFailures,
        totalFailures,
        failureRate: totalMethods > 0 ? totalFailures / (totalMethods + totalFailures) : 0,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load payment data');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveFailure = async (id: string) => {
    try {
      await Api.resolvePaymentFailure(id, 'manual');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to resolve payment failure');
    }
  };

  const handleDeleteMethod = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;
    try {
      await Api.deletePaymentMethodAdvanced(id);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete payment method');
    }
  };

  const getPaymentTypeBadge = (type: string) => {
    const badges: Record<string, { bg: string; text: string; icon: string }> = {
      credit_card: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: '💳' },
      bank_transfer: { bg: 'bg-green-500/20', text: 'text-green-400', icon: '🏦' },
      paypal: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', icon: '🅿️' },
      invoice: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: '📄' },
    };
    const badge = badges[type] || {
      bg: 'bg-gray-50 dark:bg-navy-8000/20',
      text: 'text-gray-600',
      icon: '💰',
    };
    return (
      <span
        className={`px-2 py-0.5 text-xs rounded-full ${badge.bg} ${badge.text} flex items-center gap-1`}
      >
        <span>{badge.icon}</span>
        {type.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const safe = status || 'unknown';
    const badges: Record<string, { bg: string; text: string }> = {
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
      retrying: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
      resolved: { bg: 'bg-green-500/20', text: 'text-green-400' },
      failed: { bg: 'bg-danger-500/20', text: 'text-danger-400' },
      recovered: { bg: 'bg-green-500/20', text: 'text-green-400' },
    };
    const badge = badges[safe] || {
      bg: 'bg-gray-50 dark:bg-navy-8000/20',
      text: 'text-gray-600',
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${badge.bg} ${badge.text}`}>
        {safe.charAt(0).toUpperCase() + safe.slice(1)}
      </span>
    );
  };

  const parsePaymentDetails = (json: string) => {
    try {
      return JSON.parse(json);
    } catch {
      return {};
    }
  };

  const maskCardNumber = (number: string) => {
    if (!number) return '****';
    return '**** **** **** ' + number.slice(-4);
  };

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Payment Management & Dunning
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage payment methods and handle payment failures
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-danger-500/20 border border-danger-500 text-danger-300 px-4 py-3 rounded-lg">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right text-danger-300 hover:text-danger-100"
          >
            ×
          </button>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.totalMethods}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Total Methods</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-400">{stats.activeMethods}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Active Methods</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-400">{stats.pendingFailures}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Pending Failures</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-danger-400">{stats.totalFailures}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Total Failures</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-400">
                {(stats.failureRate * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Failure Rate</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-c-border-subtle">
        <button
          onClick={() => setActiveTab('methods')}
          className={`px-4 py-2 -mb-px border-b-2 transition-colors ${
            activeTab === 'methods'
              ? 'border-indigo-500 text-slate-900 dark:text-white'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Payment Methods ({methods.length})
        </button>
        <button
          onClick={() => setActiveTab('failures')}
          className={`px-4 py-2 -mb-px border-b-2 transition-colors ${
            activeTab === 'failures'
              ? 'border-indigo-500 text-slate-900 dark:text-white'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Payment Failures (
          {failures.filter((f) => f.status === 'pending' || f.status === 'retrying').length})
        </button>
      </div>

      {/* Payment Methods Tab */}
      {activeTab === 'methods' && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {methods.map((method) => {
                const details = parsePaymentDetails(method.payment_details_json);
                return (
                  <div
                    key={method.id}
                    className="p-4 bg-slate-50 dark:bg-navy-950/20 rounded-lg border border-slate-200 dark:border-navy-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-900 dark:text-white font-medium">
                            {method.organization_name || method.organization_id}
                          </span>
                          {getPaymentTypeBadge(method.payment_type)}
                          {method.is_default === 1 && (
                            <span className="px-2 py-0.5 text-xs bg-indigo-500/20 text-indigo-400 rounded-full">
                              Default
                            </span>
                          )}
                          {method.is_active === 1 ? (
                            <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs bg-slate-200/60 dark:bg-navy-800/20 text-slate-700 dark:text-slate-300 rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                          {method.payment_type === 'credit_card' && details.last_four && (
                            <span>{maskCardNumber(details.last_four)}</span>
                          )}
                          {method.payment_type === 'bank_transfer' && details.bank_name && (
                            <span>
                              {details.bank_name} - {details.account_last_four || '****'}
                            </span>
                          )}
                          {method.payment_type === 'paypal' && details.email && (
                            <span>{details.email}</span>
                          )}
                          {method.payment_type === 'invoice' && <span>Invoice billing</span>}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                          Added: {new Date(method.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteMethod(method.id)}
                        className="px-3 py-1.5 text-sm bg-danger-600/20 text-danger-400 rounded hover:bg-danger-600/30 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}

              {methods.length === 0 && (
                <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                  No payment methods found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Failures Tab */}
      {activeTab === 'failures' && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Failures (Dunning)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {failures.map((failure) => (
                <div
                  key={failure.id}
                  className={`p-4 rounded-lg border ${
                    failure.status === 'pending' || failure.status === 'retrying'
                      ? 'bg-danger-900/20 border-danger-800'
                      : 'bg-slate-50 dark:bg-navy-950/20 border-slate-200 dark:border-navy-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-900 dark:text-white font-medium">
                          {failure.organization_name || failure.organization_id}
                        </span>
                        {getStatusBadge(failure.status)}
                        {failure.retry_count > 0 && (
                          <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
                            Retries: {failure.retry_count}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-sm text-danger-400">
                        <strong>Reason:</strong> {failure.failure_reason}
                      </div>
                      {failure.failure_code && (
                        <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                          Error Code: {failure.failure_code}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                        Attempted: {new Date(failure.attempted_at).toLocaleString()}
                        {failure.resolved_at && (
                          <span> • Resolved: {new Date(failure.resolved_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    {(failure.status === 'pending' || failure.status === 'retrying') && (
                      <button
                        onClick={() => handleResolveFailure(failure.id)}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {failures.length === 0 && (
                <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                  No payment failures recorded
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PaymentMethodsView;
