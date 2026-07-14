import {
  AlertCircle,
  DollarSign,
  HelpCircle,
  Percent,
  RefreshCw,
  Save,
  TrendingUp,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import {
  EmptyState as SharedEmptyState,
  LoadingState as SharedLoadingState,
} from '@/components/shared/states';

import { Api } from '../../services/api';

export const AdminMarginConfig = () => {
  const [margins, setMargins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMargins = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await Api.getBillingMargins();
      // Handle case where API might return undefined/null if table is empty
      if (Array.isArray(data)) {
        setMargins(data);
      } else {
        setMargins([]);
        setError('Margin configuration response was invalid.');
      }
    } catch (err: any) {
      console.error('Failed to load margins:', err);
      setError('Could not load margin configurations. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMargins();
  }, []);

  const handleChange = (sourceType: string, field: string, value: any) => {
    setMargins((prev) =>
      prev.map((m) => {
        if (m.source_type === sourceType) {
          return { ...m, [field]: value };
        }
        return m;
      })
    );
  };

  const handleSave = async (sourceType: string) => {
    setSaving(true);
    setError(null);
    try {
      const margin = margins.find((m) => m.source_type === sourceType);
      if (!margin) return;

      await Api.updateBillingMargin(sourceType, {
        baseCostPer1k: parseFloat(margin.base_cost_per_1k || 0),
        marginPercent: parseFloat(margin.margin_percent || 0),
        minCharge: parseFloat(margin.min_charge || 0),
        isActive: margin.is_active ? 1 : 0,
      });
      toast.success(`Updated ${margin.display_name}`);
    } catch (err: any) {
      setError(err.message);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading && margins.length === 0) {
    return (
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6 h-full">
        <SharedLoadingState template="list" rows={4} />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Global Margins
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Base profit margins for non-LLM costs.
          </p>
        </div>
        <button
          onClick={loadMargins}
          className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-navy-950/20 dark:hover:bg-navy-800/40 rounded-lg transition-colors border border-slate-200 dark:border-white/10"
          title="Refresh Data"
        >
          <RefreshCw
            className={`w-4 h-4 text-slate-600 dark:text-white/70 ${loading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {error && (
        <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-4 rounded-lg mb-4 flex items-start gap-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Error Loading Data</p>
            <p>{error}</p>
            <button
              onClick={loadMargins}
              className="text-c-text underline mt-2 hover:text-white/80"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4 flex-1 overflow-auto">
        {margins.length === 0 && !loading && !error && (
          <SharedEmptyState
            variant="new"
            icon={TrendingUp}
            compact
            title="No margin configurations yet"
            description="Add a margin configuration to set base profit margins for non-LLM costs."
          />
        )}

        {margins.map((margin) => (
          <div
            key={margin.id}
            className="bg-slate-50 dark:bg-navy-950/20 border border-slate-200 dark:border-white/10 rounded-xl p-4 hover:border-slate-300 dark:hover:border-white/20 transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-slate-900 dark:text-white font-bold text-sm">
                  {margin.display_name}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
                  {margin.source_type.replace('_', ' ')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-500 cursor-pointer select-none">
                  <div
                    className={`w-8 h-4 rounded-full relative transition-colors ${margin.is_active ? 'bg-emerald-500/30' : 'bg-c-surface-raised'}`}
                  >
                    <div
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white dark:bg-navy-900 transition-all ${margin.is_active ? 'left-4.5 bg-emerald-400' : 'left-0.5 bg-slate-400'}`}
                      style={{ left: margin.is_active ? '1.125rem' : '0.125rem' }}
                    />
                  </div>
                  <input
                    type="checkbox"
                    checked={!!margin.is_active}
                    onChange={(e) =>
                      handleChange(margin.source_type, 'is_active', e.target.checked)
                    }
                    className="hidden"
                  />
                </label>
                <button
                  onClick={() => handleSave(margin.source_type)}
                  disabled={saving}
                  className="p-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded transition-colors disabled:opacity-50"
                  title="Save Changes"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {margin.source_type === 'platform' && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label className="text-slate-600 dark:text-slate-500">Base Cost / 1k</label>
                    <span className="text-slate-500 dark:text-slate-400 font-mono">
                      ${parseFloat(margin.base_cost_per_1k).toFixed(4)}
                    </span>
                  </div>
                  <div className="relative group">
                    <input
                      type="number"
                      step="0.001"
                      value={margin.base_cost_per_1k}
                      onChange={(e) =>
                        handleChange(margin.source_type, 'base_cost_per_1k', e.target.value)
                      }
                      className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none transition-colors"
                    />
                    <span className="absolute left-2.5 top-2 text-slate-500 dark:text-slate-400 text-xs">
                      $
                    </span>
                  </div>
                </div>
              )}

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label className="text-slate-600 dark:text-slate-500">Margin Markup</label>
                  <span className="text-emerald-400 font-bold">{margin.margin_percent}%</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={margin.margin_percent}
                    onChange={(e) =>
                      handleChange(margin.source_type, 'margin_percent', e.target.value)
                    }
                    className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg pr-7 pl-3 py-2 text-sm text-emerald-600 dark:text-emerald-400 font-bold focus:border-emerald-500 outline-none transition-colors"
                  />
                  <span className="absolute right-2.5 top-2 text-emerald-500/50 text-xs">%</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
        <HelpCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
        <p>
          These global margins apply to base infrastructure costs. For AI Models, use the specific
          multipliers table.
        </p>
      </div>
    </div>
  );
};
