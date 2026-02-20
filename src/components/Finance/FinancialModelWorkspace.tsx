/**
 * T054 — Financial Model Workspace
 *
 * Split layout: sidebar (model list) + main area with tabs:
 *   Inputs & Assumptions | Events Timeline | Outputs (P&L/BS/CF) | Validation Panel
 * Workflow: DRAFT → REVIEW → APPROVED
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Settings, Play, CheckCircle2, AlertTriangle, XCircle, ChevronDown,
  ChevronRight, Loader2, Trash2, Edit3, Calendar, DollarSign, TrendingUp,
  FileText, Shield, BarChart3, ArrowRight, RefreshCw, Lock,
} from 'lucide-react';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import Api from '../../services/Api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Model {
  id: string;
  name: string;
  description?: string;
  currency: string;
  horizon_months: number;
  start_date: string;
  granularity: string;
  scenario: string;
  status: string;
  version: number;
  assumptions_json: Record<string, any>;
  events?: ModelEvent[];
}

interface ModelEvent {
  id: string;
  event_type: string;
  name: string;
  description?: string;
  amount: number;
  period_start: string;
  period_end?: string;
  recurrence: string;
  growth_rate: number;
  cf_classification: string;
  is_active: boolean;
  sort_order: number;
}

interface ValidationItem {
  check_code: string;
  check_name: string;
  status: string;
  expected_value: number;
  actual_value: number;
  difference: number;
  message: string;
  period_date: string;
}

interface OutputLine {
  lineCode: string;
  lineName: string;
  value: number;
}

type Tab = 'inputs' | 'events' | 'outputs' | 'validation';

interface Props {
  projectId?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  { value: 'revenue', label: 'Revenue', labelPl: 'Przychody', cf: 'operating', icon: '📈' },
  { value: 'cogs', label: 'COGS', labelPl: 'Koszt sprzedaży', cf: 'operating', icon: '📦' },
  { value: 'opex', label: 'Operating Expenses', labelPl: 'Koszty operacyjne', cf: 'operating', icon: '💼' },
  { value: 'capex_purchase', label: 'CAPEX Purchase', labelPl: 'Zakup środków trwałych', cf: 'investing', icon: '🏗️' },
  { value: 'depreciation_run', label: 'Depreciation', labelPl: 'Amortyzacja', cf: 'none', icon: '📉' },
  { value: 'debt_drawdown', label: 'Debt Drawdown', labelPl: 'Zaciągnięcie długu', cf: 'financing', icon: '🏦' },
  { value: 'debt_repayment', label: 'Debt Repayment', labelPl: 'Spłata długu', cf: 'financing', icon: '💳' },
  { value: 'interest_accrual', label: 'Interest', labelPl: 'Odsetki', cf: 'operating', icon: '📊' },
  { value: 'tax_accrual', label: 'Tax', labelPl: 'Podatek', cf: 'operating', icon: '🏛️' },
  { value: 'wc_change', label: 'Working Capital Change', labelPl: 'Zmiana kapitału obrotowego', cf: 'operating', icon: '🔄' },
  { value: 'equity_injection', label: 'Equity Injection', labelPl: 'Dokapitalizowanie', cf: 'financing', icon: '💰' },
  { value: 'dividend', label: 'Dividend', labelPl: 'Dywidenda', cf: 'financing', icon: '🎯' },
];

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  draft: { color: 'slate', icon: <Edit3 size={12} /> },
  review: { color: 'amber', icon: <AlertTriangle size={12} /> },
  approved: { color: 'emerald', icon: <CheckCircle2 size={12} /> },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FinancialModelWorkspace: React.FC<Props> = ({ projectId }) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('inputs');
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [newHorizon, setNewHorizon] = useState(60);
  const [newGranularity, setNewGranularity] = useState('monthly');
  const [newCurrency, setNewCurrency] = useState('PLN');

  // Events
  const [events, setEvents] = useState<ModelEvent[]>([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({
    eventType: 'revenue', name: '', amount: 0, periodStart: '', periodEnd: '',
    recurrence: 'monthly', growthRate: 0, cfClassification: 'operating',
  });

  // Outputs
  const [outputs, setOutputs] = useState<Record<string, Record<string, OutputLine[]>>>({});
  const [outputTab, setOutputTab] = useState<'P&L' | 'BS' | 'CF'>('P&L');

  // Validations
  const [validations, setValidations] = useState<ValidationItem[]>([]);
  const [validationSummary, setValidationSummary] = useState({ total: 0, pass: 0, fail: 0, warning: 0 });

  // Assumptions
  const [assumptions, setAssumptions] = useState<Record<string, number>>({});

  // ── Load models ──
  const loadModels = useCallback(async () => {
    try {
      const resp = await Api.get('/api/financial-modeling/models');
      setModels(resp.data || []);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { loadModels(); }, [loadModels]);

  const selectModel = async (modelId: string) => {
    setLoading(true);
    try {
      const resp = await Api.get(`/api/financial-modeling/models/${modelId}`);
      const model = resp.data;
      setSelectedModel(model);
      setEvents(model.events || []);
      setAssumptions(model.assumptions_json || {});
      setError(null);
      trackFunnelEvent('financial_model_created', { modelId }); // viewed
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    }
    setLoading(false);
  };

  // ── Create model ──
  const handleCreate = async () => {
    if (!newName || !newStartDate) return;
    setLoading(true);
    try {
      const resp = await Api.post('/api/financial-modeling/models', {
        name: newName, startDate: newStartDate, horizonMonths: newHorizon,
        granularity: newGranularity, currency: newCurrency, projectId,
        assumptions: { initialCash: 0, initialEquity: 0, initialDebt: 0, initialPPE: 0 },
      });
      trackFunnelEvent('financial_model_created', { modelId: resp.data.id });
      setShowCreate(false);
      setNewName('');
      await loadModels();
      await selectModel(resp.data.id);
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    }
    setLoading(false);
  };

  // ── Add event ──
  const handleAddEvent = async () => {
    if (!selectedModel || !eventForm.name || !eventForm.periodStart) return;
    try {
      await Api.post(`/api/financial-modeling/models/${selectedModel.id}/events`, {
        eventType: eventForm.eventType, name: eventForm.name, amount: eventForm.amount,
        periodStart: eventForm.periodStart, periodEnd: eventForm.periodEnd || undefined,
        recurrence: eventForm.recurrence, growthRate: eventForm.growthRate,
        cfClassification: eventForm.cfClassification,
      });
      trackFunnelEvent('financial_model_event_added', { modelId: selectedModel.id, eventType: eventForm.eventType });
      setShowEventForm(false);
      setEventForm({ eventType: 'revenue', name: '', amount: 0, periodStart: '', periodEnd: '', recurrence: 'monthly', growthRate: 0, cfClassification: 'operating' });
      await selectModel(selectedModel.id);
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await Api.delete(`/api/financial-modeling/events/${eventId}`);
      if (selectedModel) await selectModel(selectedModel.id);
    } catch { /* noop */ }
  };

  // ── Compute ──
  const handleCompute = async () => {
    if (!selectedModel) return;
    setComputing(true);
    setError(null);
    try {
      await Api.post(`/api/financial-modeling/models/${selectedModel.id}/compute`, {});

      // Load outputs
      const outResp = await Api.get(`/api/financial-modeling/models/${selectedModel.id}/outputs`);
      setOutputs(outResp.data.grouped || {});

      // Load validations
      const valResp = await Api.get(`/api/financial-modeling/models/${selectedModel.id}/validations`);
      setValidations(valResp.data.validations || []);
      setValidationSummary(valResp.data.summary || { total: 0, pass: 0, fail: 0, warning: 0 });

      setActiveTab('outputs');
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    }
    setComputing(false);
  };

  // ── Approve ──
  const handleApprove = async () => {
    if (!selectedModel) return;
    setLoading(true);
    try {
      const resp = await Api.post(`/api/financial-modeling/models/${selectedModel.id}/approve`, {});
      if (resp.data.success) {
        trackFunnelEvent('financial_model_approved', { modelId: selectedModel.id });
        await selectModel(selectedModel.id);
        await loadModels();
      } else {
        setError(resp.data.error);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    }
    setLoading(false);
  };

  // ── Save assumptions ──
  const handleSaveAssumptions = async () => {
    if (!selectedModel) return;
    try {
      await Api.put(`/api/financial-modeling/models/${selectedModel.id}`, { assumptions });
    } catch { /* noop */ }
  };

  // ── Render helpers ──

  const statusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-${cfg.color}-100 text-${cfg.color}-700 dark:bg-${cfg.color}-900/30 dark:text-${cfg.color}-400`}>
        {cfg.icon} {status.toUpperCase()}
      </span>
    );
  };

  const validationStatusIcon = (status: string) => {
    if (status === 'pass') return <CheckCircle2 size={14} className="text-emerald-500" />;
    if (status === 'fail') return <XCircle size={14} className="text-red-500" />;
    return <AlertTriangle size={14} className="text-amber-500" />;
  };

  const formatAmount = (n: number) => n.toLocaleString(isPl ? 'pl-PL' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'inputs', label: t('finance.model.inputs', 'Inputs & Assumptions'), icon: <Settings size={14} /> },
    { key: 'events', label: t('finance.model.events', 'Events Timeline'), icon: <Calendar size={14} /> },
    { key: 'outputs', label: t('finance.model.outputs', 'Outputs (P&L / BS / CF)'), icon: <BarChart3 size={14} /> },
    { key: 'validation', label: t('finance.model.validation', 'Validation'), icon: <Shield size={14} /> },
  ];

  return (
    <div className="flex h-full min-h-[600px]">
      {/* ── Sidebar ── */}
      <div className="w-72 border-r border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-900 dark:text-white text-sm">
            {t('finance.model.title', 'Financial Models')}
          </h2>
          <button onClick={() => setShowCreate(true)} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500">
            <Plus size={14} />
          </button>
        </div>

        <div className="space-y-1.5 flex-1 overflow-y-auto">
          {models.map(m => (
            <button
              key={m.id}
              onClick={() => selectModel(m.id)}
              className={`w-full text-left p-3 rounded-xl transition-colors ${
                selectedModel?.id === m.id ? 'bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'hover:bg-white dark:hover:bg-navy-800 border border-transparent'
              }`}
            >
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{m.name}</p>
              <div className="flex items-center gap-2 mt-1">
                {statusBadge(m.status)}
                <span className="text-[10px] text-slate-400">v{m.version}</span>
              </div>
            </button>
          ))}
          {models.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-8">
              {t('finance.model.noModels', 'No models yet. Create one to start.')}
            </p>
          )}
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedModel ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <FileText size={40} className="mx-auto mb-3 opacity-40" />
              <p>{t('finance.model.selectOrCreate', 'Select or create a model')}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedModel.name}</h2>
                  {statusBadge(selectedModel.status)}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedModel.currency} · {selectedModel.granularity} · {selectedModel.horizon_months} {t('finance.model.months', 'months')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleCompute} disabled={computing || events.length === 0} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-500 disabled:opacity-50">
                  {computing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  {t('finance.model.compute', 'Compute')}
                </button>
                {selectedModel.status === 'draft' && (
                  <button onClick={handleApprove} disabled={loading || validationSummary.fail > 0} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-500 disabled:opacity-50">
                    <CheckCircle2 size={14} />
                    {t('finance.model.approve', 'Approve')}
                  </button>
                )}
                {selectedModel.status === 'approved' && (
                  <span className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 text-sm font-medium rounded-xl">
                    <Lock size={14} /> {t('finance.model.approved', 'Approved')}
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div className="mx-6 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
              </div>
            )}

            {/* Tabs */}
            <div className="px-6 pt-3 flex gap-1 border-b border-slate-200 dark:border-navy-700">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === tab.key
                      ? 'bg-white dark:bg-navy-800 text-blue-600 border border-b-0 border-slate-200 dark:border-navy-700'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {tab.icon} {tab.label}
                  {tab.key === 'validation' && validationSummary.fail > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded-full">{validationSummary.fail}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* ── Inputs tab ── */}
              {activeTab === 'inputs' && (
                <div className="max-w-2xl space-y-6">
                  <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5 space-y-4">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{t('finance.model.initialBalances', 'Initial Balance Sheet')}</h3>
                    {[
                      { key: 'initialCash', label: 'Cash', labelPl: 'Gotówka' },
                      { key: 'initialEquity', label: 'Equity', labelPl: 'Kapitał własny' },
                      { key: 'initialDebt', label: 'Debt', labelPl: 'Dług' },
                      { key: 'initialPPE', label: 'PPE (Net)', labelPl: 'Środki trwałe (netto)' },
                      { key: 'initialAR', label: 'Accounts Receivable', labelPl: 'Należności' },
                      { key: 'initialInventory', label: 'Inventory', labelPl: 'Zapasy' },
                      { key: 'initialAP', label: 'Accounts Payable', labelPl: 'Zobowiązania' },
                    ].map(({ key, label, labelPl }) => (
                      <div key={key} className="flex items-center justify-between gap-4">
                        <label className="text-sm text-slate-700 dark:text-slate-300 w-48">{isPl ? labelPl : label}</label>
                        <input
                          type="number"
                          value={assumptions[key] ?? 0}
                          onChange={e => setAssumptions(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                          className="w-48 px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-sm text-right font-mono"
                        />
                      </div>
                    ))}
                    <button onClick={handleSaveAssumptions} className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500">
                      {t('common.save', 'Save')}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Events tab ── */}
              {activeTab === 'events' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{t('finance.model.economicEvents', 'Economic Events')}</h3>
                    <button onClick={() => setShowEventForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500">
                      <Plus size={14} /> {t('finance.model.addEvent', 'Add Event')}
                    </button>
                  </div>

                  {events.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      <Calendar size={32} className="mx-auto mb-3 opacity-40" />
                      <p>{t('finance.model.noEvents', 'No events yet. Add economic events to drive the model.')}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {events.map(ev => {
                      const cfg = EVENT_TYPES.find(e => e.value === ev.event_type);
                      return (
                        <div key={ev.id} className={`p-4 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 flex items-center gap-4 ${!ev.is_active ? 'opacity-50' : ''}`}>
                          <span className="text-lg">{cfg?.icon || '📌'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{ev.name}</p>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                              <span>{isPl ? cfg?.labelPl : cfg?.label}</span>
                              <span className="font-mono">{formatAmount(ev.amount)} {selectedModel.currency}</span>
                              <span>{ev.recurrence}</span>
                              {ev.growth_rate !== 0 && <span className="text-emerald-500">+{ev.growth_rate}%/yr</span>}
                              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-navy-800 rounded text-[10px]">{ev.cf_classification}</span>
                            </div>
                          </div>
                          <span className="text-xs text-slate-400">{ev.period_start}{ev.period_end ? ` → ${ev.period_end}` : ''}</span>
                          <button onClick={() => handleDeleteEvent(ev.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                            <Trash2 size={14} className="text-red-400" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Event form modal */}
                  {showEventForm && (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('finance.model.addEvent', 'Add Event')}</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="text-xs text-slate-500">{t('finance.model.eventType', 'Event Type')}</label>
                            <select value={eventForm.eventType} onChange={e => { const cfg = EVENT_TYPES.find(et => et.value === e.target.value); setEventForm(f => ({ ...f, eventType: e.target.value, cfClassification: cfg?.cf || 'operating' })); }} className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800">
                              {EVENT_TYPES.map(et => <option key={et.value} value={et.value}>{et.icon} {isPl ? et.labelPl : et.label}</option>)}
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-slate-500">{t('finance.model.eventName', 'Name')}</label>
                            <input value={eventForm.name} onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">{t('finance.model.amount', 'Amount')}</label>
                            <input type="number" value={eventForm.amount} onChange={e => setEventForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800 text-right font-mono" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">{t('finance.model.recurrence', 'Recurrence')}</label>
                            <select value={eventForm.recurrence} onChange={e => setEventForm(f => ({ ...f, recurrence: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800">
                              <option value="one_time">{t('finance.model.oneTime', 'One-time')}</option>
                              <option value="monthly">{t('finance.model.monthly', 'Monthly')}</option>
                              <option value="quarterly">{t('finance.model.quarterly', 'Quarterly')}</option>
                              <option value="annual">{t('finance.model.annual', 'Annual')}</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">{t('finance.model.startDate', 'Start Date')}</label>
                            <input type="date" value={eventForm.periodStart} onChange={e => setEventForm(f => ({ ...f, periodStart: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">{t('finance.model.endDate', 'End Date')}</label>
                            <input type="date" value={eventForm.periodEnd} onChange={e => setEventForm(f => ({ ...f, periodEnd: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">{t('finance.model.growthRate', 'Growth Rate (%/yr)')}</label>
                            <input type="number" step="0.1" value={eventForm.growthRate} onChange={e => setEventForm(f => ({ ...f, growthRate: parseFloat(e.target.value) || 0 }))} className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800 text-right font-mono" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">{t('finance.model.cfClass', 'CF Classification')}</label>
                            <select value={eventForm.cfClassification} onChange={e => setEventForm(f => ({ ...f, cfClassification: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800">
                              <option value="operating">Operating</option>
                              <option value="investing">Investing</option>
                              <option value="financing">Financing</option>
                              <option value="none">None</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <button onClick={() => setShowEventForm(false)} className="px-4 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm">{t('common.cancel', 'Cancel')}</button>
                          <button onClick={handleAddEvent} disabled={!eventForm.name || !eventForm.periodStart} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50">{t('finance.model.addEvent', 'Add Event')}</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Outputs tab ── */}
              {activeTab === 'outputs' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {(['P&L', 'BS', 'CF'] as const).map(st => (
                      <button
                        key={st}
                        onClick={() => setOutputTab(st)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          outputTab === st ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700'
                        }`}
                      >
                        {st === 'P&L' ? t('finance.model.pl', 'P&L') : st === 'BS' ? t('finance.model.bs', 'Balance Sheet') : t('finance.model.cf', 'Cash Flow')}
                      </button>
                    ))}
                  </div>

                  {Object.keys(outputs).length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <BarChart3 size={32} className="mx-auto mb-3 opacity-40" />
                      <p>{t('finance.model.noOutputs', 'Click "Compute" to generate outputs')}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-navy-800">
                            <th className="text-left px-3 py-2 font-medium text-slate-500 sticky left-0 bg-slate-50 dark:bg-navy-800 z-10">{t('finance.model.line', 'Line')}</th>
                            {Object.keys(outputs).map(period => (
                              <th key={period} className="text-right px-3 py-2 font-medium text-slate-500 whitespace-nowrap">{period}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                          {(() => {
                            const firstPeriod = Object.values(outputs)[0]?.[outputTab];
                            if (!firstPeriod) return null;
                            return firstPeriod.map((line, idx) => {
                              const isSummaryLine = ['GROSS_PROFIT', 'EBITDA', 'EBIT', 'NET_INCOME', 'TOTAL_ASSETS', 'TOTAL_LIABILITIES', 'TOTAL_EQUITY', 'TOTAL_LIABILITIES_EQUITY', 'OPERATING_CF', 'INVESTING_CF', 'FINANCING_CF', 'NET_CHANGE_CASH', 'CLOSING_CASH'].includes(line.lineCode);
                              return (
                                <tr key={line.lineCode} className={isSummaryLine ? 'bg-slate-50/50 dark:bg-navy-800/30 font-semibold' : ''}>
                                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-navy-950 z-10 whitespace-nowrap">{line.lineName}</td>
                                  {Object.entries(outputs).map(([period, stmts]) => {
                                    const val = stmts[outputTab]?.find(l => l.lineCode === line.lineCode)?.value ?? 0;
                                    return (
                                      <td key={period} className={`px-3 py-2 text-right font-mono whitespace-nowrap ${val < 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                                        {formatAmount(val)}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Validation tab ── */}
              {activeTab === 'validation' && (
                <div className="space-y-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-4 gap-4">
                    <SummaryCard label={t('finance.model.totalChecks', 'Total Checks')} value={String(validationSummary.total)} icon={<Shield size={16} className="text-blue-500" />} />
                    <SummaryCard label={t('finance.model.passed', 'Passed')} value={String(validationSummary.pass)} icon={<CheckCircle2 size={16} className="text-emerald-500" />} />
                    <SummaryCard label={t('finance.model.failed', 'Failed')} value={String(validationSummary.fail)} icon={<XCircle size={16} className="text-red-500" />} />
                    <SummaryCard label={t('finance.model.warnings', 'Warnings')} value={String(validationSummary.warning)} icon={<AlertTriangle size={16} className="text-amber-500" />} />
                  </div>

                  {/* Model health indicator */}
                  <div className={`p-4 rounded-xl border ${
                    validationSummary.fail > 0 ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' :
                    validationSummary.warning > 0 ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' :
                    validationSummary.total > 0 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' :
                    'bg-slate-50 border-slate-200 dark:bg-navy-800 dark:border-navy-700'
                  }`}>
                    <div className="flex items-center gap-2">
                      {validationSummary.fail > 0 ? <XCircle size={20} className="text-red-500" /> :
                       validationSummary.warning > 0 ? <AlertTriangle size={20} className="text-amber-500" /> :
                       validationSummary.total > 0 ? <CheckCircle2 size={20} className="text-emerald-500" /> :
                       <Shield size={20} className="text-slate-400" />}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {t('finance.model.modelHealth', 'Model Health')}:
                        {' '}
                        {validationSummary.fail > 0 ? t('finance.model.needsReview', 'NEEDS REVIEW') :
                         validationSummary.warning > 0 ? t('finance.model.warnings', 'WARNINGS') :
                         validationSummary.total > 0 ? t('finance.model.healthy', 'HEALTHY') :
                         t('finance.model.notComputed', 'Not computed yet')}
                      </span>
                    </div>
                  </div>

                  {/* Validation details */}
                  {validations.length > 0 && (
                    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-navy-800">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium text-slate-500">{t('finance.model.check', 'Check')}</th>
                            <th className="text-left px-4 py-2 font-medium text-slate-500">{t('finance.model.period', 'Period')}</th>
                            <th className="text-center px-4 py-2 font-medium text-slate-500">{t('finance.model.status', 'Status')}</th>
                            <th className="text-left px-4 py-2 font-medium text-slate-500">{t('finance.model.message', 'Message')}</th>
                            <th className="text-right px-4 py-2 font-medium text-slate-500">{t('finance.model.diff', 'Diff')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                          {validations.slice(0, 60).map((v, i) => (
                            <tr key={i} className={v.status === 'fail' ? 'bg-red-50/30 dark:bg-red-900/10' : ''}>
                              <td className="px-4 py-2 text-slate-700 dark:text-slate-300 font-medium">{v.check_name}</td>
                              <td className="px-4 py-2 text-slate-500 text-xs font-mono">{v.period_date?.slice(0, 7)}</td>
                              <td className="px-4 py-2 text-center">{validationStatusIcon(v.status)}</td>
                              <td className="px-4 py-2 text-slate-600 dark:text-slate-400 text-xs">{v.message}</td>
                              <td className="px-4 py-2 text-right font-mono text-xs text-slate-500">{v.difference?.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Create modal ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('finance.model.createModel', 'Create Financial Model')}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">{t('finance.model.modelName', 'Model Name')}</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('finance.model.modelNamePlaceholder', 'e.g. Initiative Alpha — 5yr projection') as string} className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">{t('finance.model.startDate', 'Start Date')}</label>
                  <input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">{t('finance.model.horizon', 'Horizon (months)')}</label>
                  <input type="number" value={newHorizon} onChange={e => setNewHorizon(parseInt(e.target.value) || 60)} className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">{t('finance.model.granularity', 'Granularity')}</label>
                  <select value={newGranularity} onChange={e => setNewGranularity(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800">
                    <option value="monthly">{t('finance.model.monthly', 'Monthly')}</option>
                    <option value="quarterly">{t('finance.model.quarterly', 'Quarterly')}</option>
                    <option value="annual">{t('finance.model.annual', 'Annual')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500">{t('finance.model.currency', 'Currency')}</label>
                  <select value={newCurrency} onChange={e => setNewCurrency(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800">
                    {['PLN', 'EUR', 'USD', 'GBP', 'CZK', 'CHF'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm">{t('common.cancel', 'Cancel')}</button>
              <button onClick={handleCreate} disabled={!newName || loading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50">{t('common.create', 'Create')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-components ──
const SummaryCard: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 flex items-center gap-3">
    <div className="p-2 bg-slate-50 dark:bg-navy-800 rounded-lg">{icon}</div>
    <div>
      <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  </div>
);

export default FinancialModelWorkspace;
