import React, { useState, useEffect } from 'react';
import { Api } from '../../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';

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
        Api.getPaymentFailuresAdvanced(),
        Api.getPaymentFailureStatsAdvanced()
      ]);
      setMethods(methodsRes.methods || []);
      setFailures(failuresRes.failures || []);
      setStats(statsRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load payment data');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveFailure = async (id: string) => {
    try {
      await Api.resolvePaymentFailureAdvanced(id);
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
      invoice: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: '📄' }
    };
    const badge = badges[type] || { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: '💰' };
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${badge.bg} ${badge.text} flex items-center gap-1`}>
        <span>{badge.icon}</span>
        {type.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
      retrying: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
      resolved: { bg: 'bg-green-500/20', text: 'text-green-400' },
      failed: { bg: 'bg-red-500/20', text: 'text-red-400' }
    };
    const badge = badges[status] || { bg: 'bg-gray-500/20', text: 'text-gray-400' };
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${badge.bg} ${badge.text}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Payment Management & Dunning</h2>
          <p className="text-gray-400 mt-1">Manage payment methods and handle payment failures</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="float-right text-red-300 hover:text-red-100">×</button>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-white">{stats.totalMethods}</div>
              <div className="text-sm text-gray-400">Total Methods</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-400">{stats.activeMethods}</div>
              <div className="text-sm text-gray-400">Active Methods</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-400">{stats.pendingFailures}</div>
              <div className="text-sm text-gray-400">Pending Failures</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-400">{stats.totalFailures}</div>
              <div className="text-sm text-gray-400">Total Failures</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-400">{(stats.failureRate * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-400">Failure Rate</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('methods')}
          className={`px-4 py-2 -mb-px border-b-2 transition-colors ${
            activeTab === 'methods'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Payment Methods ({methods.length})
        </button>
        <button
          onClick={() => setActiveTab('failures')}
          className={`px-4 py-2 -mb-px border-b-2 transition-colors ${
            activeTab === 'failures'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Payment Failures ({failures.filter(f => f.status === 'pending' || f.status === 'retrying').length})
        </button>
      </div>

      {/* Payment Methods Tab */}
      {activeTab === 'methods' && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {methods.map((method) => {
                const details = parsePaymentDetails(method.payment_details_json);
                return (
                  <div
                    key={method.id}
                    className="p-4 bg-gray-900/50 rounded-lg border border-gray-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-white font-medium">
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
                            <span className="px-2 py-0.5 text-xs bg-gray-500/20 text-gray-400 rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-gray-400">
                          {method.payment_type === 'credit_card' && details.last_four && (
                            <span>{maskCardNumber(details.last_four)}</span>
                          )}
                          {method.payment_type === 'bank_transfer' && details.bank_name && (
                            <span>{details.bank_name} - {details.account_last_four || '****'}</span>
                          )}
                          {method.payment_type === 'paypal' && details.email && (
                            <span>{details.email}</span>
                          )}
                          {method.payment_type === 'invoice' && (
                            <span>Invoice billing</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          Added: {new Date(method.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteMethod(method.id)}
                        className="px-3 py-1.5 text-sm bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {methods.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  No payment methods found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Failures Tab */}
      {activeTab === 'failures' && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Payment Failures (Dunning)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {failures.map((failure) => (
                <div
                  key={failure.id}
                  className={`p-4 rounded-lg border ${
                    failure.status === 'pending' || failure.status === 'retrying'
                      ? 'bg-red-900/20 border-red-800'
                      : 'bg-gray-900/50 border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium">
                          {failure.organization_name || failure.organization_id}
                        </span>
                        {getStatusBadge(failure.status)}
                        {failure.retry_count > 0 && (
                          <span className="px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded-full">
                            Retries: {failure.retry_count}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-sm text-red-400">
                        <strong>Reason:</strong> {failure.failure_reason}
                      </div>
                      {failure.failure_code && (
                        <div className="mt-1 text-xs text-gray-500">
                          Error Code: {failure.failure_code}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-gray-500">
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
                <div className="text-center py-8 text-gray-400">
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

