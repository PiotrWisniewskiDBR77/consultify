import React, { useEffect, useState } from 'react';

import { BillingFeaturePending } from '../../../components/billing/BillingFeaturePending';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/BaseCard';
import { Api } from '../../../services/api';
import { isBillingSelfServeEnabled } from '../../../utils/billingSelfServeFlag';

interface RevenueRecognition {
  id: string;
  organization_id: string;
  organization_name?: string;
  contract_id: string;
  contract_name?: string;
  revenue_amount: number;
  currency: string;
  recognition_method: 'straight_line' | 'milestone' | 'percentage_completion' | 'point_in_time';
  recognition_schedule_json: string;
  recognized_amount: number;
  remaining_amount: number;
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold';
  created_at: string;
  updated_at: string;
}

interface RevenueRecognitionStats {
  totalRevenue: number;
  recognizedRevenue: number;
  remainingRevenue: number;
  pendingItems: number;
  inProgressItems: number;
  completedItems: number;
}

interface RecognitionScheduleItem {
  period: string;
  amount: number;
  recognized: boolean;
  recognized_at?: string;
}

export const RevenueRecognitionView: React.FC = () => {
  // Decision D8: revenue-recognition endpoints return 503 until built out.
  const billingAnalyticsEnabled = isBillingSelfServeEnabled();
  const [recognitions, setRecognitions] = useState<RevenueRecognition[]>([]);
  const [stats, setStats] = useState<RevenueRecognitionStats | null>(null);
  const [loading, setLoading] = useState(billingAnalyticsEnabled);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecognition, setSelectedRecognition] = useState<RevenueRecognition | null>(null);
  const [schedule, setSchedule] = useState<RecognitionScheduleItem[]>([]);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    organization_id: '',
    contract_id: '',
    revenue_amount: 0,
    currency: 'USD',
    recognition_method: 'straight_line',
    periods: 12,
  });

  useEffect(() => {
    if (!billingAnalyticsEnabled) return;
    fetchData();
  }, [billingAnalyticsEnabled]);

  if (!billingAnalyticsEnabled) {
    return <BillingFeaturePending />;
  }

  const fetchData = async () => {
    try {
      setLoading(true);
      const [recognitionsRes, statsRes] = await Promise.all([
        Api.getRevenueRecognitions(),
        Api.getRevenueRecognitionStats(),
      ]);
      const items = Array.isArray(recognitionsRes)
        ? recognitionsRes
        : (recognitionsRes as any)?.items || [];
      setRecognitions(items);

      const raw = statsRes as any;
      const apiTotalRevenue = Number(raw?.totalRevenue || raw?.total_revenue || 0);
      const apiRecognized = Number(raw?.recognizedRevenue || raw?.recognized_revenue || 0);
      const apiRemaining = Number(raw?.remainingRevenue || raw?.remaining_revenue || 0);

      const itemsTotalRevenue = items.reduce(
        (s: number, r: any) => s + Number(r.revenue_amount || r.total_amount || r.amount || 0),
        0
      );
      const itemsRecognized = items.reduce(
        (s: number, r: any) => s + Number(r.recognized_amount || 0),
        0
      );
      const itemsRemaining = items.reduce(
        (s: number, r: any) => s + Number(r.remaining_amount || 0),
        0
      );

      const totalRevenue = apiTotalRevenue > 0 ? apiTotalRevenue : itemsTotalRevenue;
      const recognizedRevenue = apiRecognized > 0 ? apiRecognized : itemsRecognized;
      const remainingRevenue =
        apiRemaining > 0
          ? apiRemaining
          : itemsRemaining > 0
            ? itemsRemaining
            : Math.max(0, totalRevenue - recognizedRevenue);

      setStats({
        totalRevenue,
        recognizedRevenue,
        remainingRevenue,
        pendingItems:
          Number(raw?.pendingItems || raw?.pending_items || 0) ||
          items.filter((r: any) => r.status === 'pending').length,
        inProgressItems:
          Number(raw?.inProgressItems || raw?.in_progress_items || 0) ||
          items.filter((r: any) => r.status === 'in_progress').length,
        completedItems:
          Number(raw?.completedItems || raw?.completed_items || 0) ||
          items.filter((r: any) => r.status === 'completed').length,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load revenue recognition data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSchedule = async (recognition: RevenueRecognition) => {
    try {
      const response = await Api.getRecognitionSchedule(recognition.id);
      setSchedule(response.schedule || []);
      setSelectedRecognition(recognition);
    } catch (err: any) {
      // If no schedule, parse from JSON
      try {
        setSchedule(JSON.parse(recognition.recognition_schedule_json || '[]'));
      } catch {
        setSchedule([]);
      }
      setSelectedRecognition(recognition);
    }
  };

  const handleRecognize = async (id: string) => {
    try {
      await Api.recognizeRevenue(id);
      fetchData();
      if (selectedRecognition?.id === id) {
        const response = await Api.getRecognitionSchedule(id);
        setSchedule(response.schedule || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to recognize revenue');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Api.createRevenueRecognition(formData);
      fetchData();
      setShowModal(false);
      setFormData({
        organization_id: '',
        contract_id: '',
        revenue_amount: 0,
        currency: 'USD',
        recognition_method: 'straight_line',
        periods: 12,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create revenue recognition');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
      in_progress: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
      completed: { bg: 'bg-green-500/20', text: 'text-green-400' },
      on_hold: { bg: 'bg-gray-50 dark:bg-navy-8000/20', text: 'text-gray-600' },
    };
    const badge = badges[status] || {
      bg: 'bg-gray-50 dark:bg-navy-8000/20',
      text: 'text-gray-600',
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${badge.bg} ${badge.text}`}>
        {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
      </span>
    );
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      straight_line: 'Straight Line',
      milestone: 'Milestone',
      percentage_completion: 'Percentage of Completion',
      point_in_time: 'Point in Time',
    };
    return labels[method] || method;
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const calculateProgress = (recognized: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((recognized / total) * 100);
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
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Revenue Recognition (ASC 606)
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage revenue recognition schedules and compliance
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + New Recognition
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/20 border border-rose-500 text-rose-300 px-4 py-3 rounded-lg">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right text-rose-300 hover:text-rose-100"
          >
            ×
          </button>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(stats.totalRevenue)}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Total Revenue</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xl font-bold text-green-400">
                {formatCurrency(stats.recognizedRevenue)}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Recognized</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xl font-bold text-yellow-400">
                {formatCurrency(stats.remainingRevenue)}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Remaining</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-400">{stats.pendingItems}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-400">{stats.inProgressItems}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">In Progress</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-400">{stats.completedItems}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Completed</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recognitions List */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Recognition Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {recognitions.map((recognition) => (
                <div
                  key={recognition.id}
                  onClick={() => handleViewSchedule(recognition)}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedRecognition?.id === recognition.id
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-500'
                      : 'bg-slate-50 dark:bg-navy-950/20 border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900 dark:text-white font-medium">
                          {recognition.organization_name || recognition.organization_id}
                        </span>
                        {getStatusBadge(recognition.status)}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {getMethodLabel(recognition.recognition_method)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-900 dark:text-white font-bold">
                        {formatCurrency(recognition.revenue_amount, recognition.currency)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                      <span>Progress</span>
                      <span>
                        {calculateProgress(
                          recognition.recognized_amount,
                          recognition.revenue_amount
                        )}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${calculateProgress(recognition.recognized_amount, recognition.revenue_amount)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>
                        {formatCurrency(recognition.recognized_amount, recognition.currency)}{' '}
                        recognized
                      </span>
                      <span>
                        {formatCurrency(recognition.remaining_amount, recognition.currency)}{' '}
                        remaining
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {recognitions.length === 0 && (
                <div className="text-center py-8 text-gray-600 dark:text-gray-500 dark:text-gray-400">
                  No revenue recognition items found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Schedule Timeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recognition Schedule</CardTitle>
            {selectedRecognition && selectedRecognition.status !== 'completed' && (
              <button
                onClick={() => handleRecognize(selectedRecognition.id)}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Recognize Next Period
              </button>
            )}
          </CardHeader>
          <CardContent>
            {selectedRecognition ? (
              <div className="space-y-4">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Schedule for{' '}
                  {selectedRecognition.organization_name || selectedRecognition.organization_id}
                </div>

                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-gray-700" />

                  <div className="space-y-4">
                    {schedule.map((item, index) => (
                      <div key={index} className="relative pl-10">
                        {/* Timeline dot */}
                        <div
                          className={`absolute left-2 w-4 h-4 rounded-full border-2 ${
                            item.recognized
                              ? 'bg-green-500 border-green-500'
                              : 'bg-white dark:bg-gray-800 border-slate-300 dark:border-gray-600'
                          }`}
                        />

                        <div
                          className={`p-3 rounded-lg ${
                            item.recognized
                              ? 'bg-green-900/20 border border-green-800'
                              : 'bg-slate-50 dark:bg-navy-950/20 border border-slate-200 dark:border-navy-700'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-slate-900 dark:text-white font-medium">
                              {item.period}
                            </span>
                            <span
                              className={`font-bold ${
                                item.recognized
                                  ? 'text-green-400'
                                  : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {formatCurrency(item.amount, selectedRecognition.currency)}
                            </span>
                          </div>
                          {item.recognized && item.recognized_at && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Recognized on {new Date(item.recognized_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {schedule.length === 0 && (
                  <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                    No schedule available
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 text-slate-600 dark:text-slate-400">
                Select a recognition item to view schedule
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Create Revenue Recognition
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Organization ID
                </label>
                <input
                  type="text"
                  value={formData.organization_id}
                  onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Contract ID (Optional)
                </label>
                <input
                  type="text"
                  value={formData.contract_id}
                  onChange={(e) => setFormData({ ...formData, contract_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Revenue Amount
                  </label>
                  <input
                    type="number"
                    value={formData.revenue_amount}
                    onChange={(e) =>
                      setFormData({ ...formData, revenue_amount: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="PLN">PLN</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Recognition Method
                  </label>
                  <select
                    value={formData.recognition_method}
                    onChange={(e) =>
                      setFormData({ ...formData, recognition_method: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="straight_line">Straight Line</option>
                    <option value="milestone">Milestone</option>
                    <option value="percentage_completion">Percentage of Completion</option>
                    <option value="point_in_time">Point in Time</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Recognition Periods
                  </label>
                  <input
                    type="number"
                    value={formData.periods}
                    onChange={(e) =>
                      setFormData({ ...formData, periods: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                    min="1"
                    max="60"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-navy-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 dark:bg-navy-800 dark:text-white dark:hover:bg-navy-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevenueRecognitionView;
