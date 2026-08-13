/**
 * T054 — Financial Model Workspace
 *
 * Split layout: sidebar (model list) + main area with tabs:
 *   Inputs & Assumptions | Events Timeline | Outputs (P&L/BS/CF) | Validation Panel
 * Workflow: DRAFT → REVIEW → APPROVED
 */

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Edit3,
  FileText,
  Link2,
  Loader2,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyState as SharedEmptyState } from '@/components/shared/states';

import Api from '../../services/api';
import {
  shouldFallbackToLegacyFinance,
  V8FinanceApi,
  type V8FinanceCaseScenario,
  type V8FinanceModelCreatePayload,
  type V8FinanceModelEventCreatePayload,
} from '../../services/api/v8/finance';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import { isFinanceFlagEnabled } from '../Economics/financeFeatureFlags';
import { ModelVersionHistory } from '../Economics/ModelVersionHistory';
import { ExportButton } from './ExportButton';

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
  source_statement_id?: string | null;
  source_statement_pack_id?: string | null;
  source_statement?: {
    id: string;
    statement_type: string;
    period_label: string;
    period_start: string;
    period_end: string;
    currency: string;
    scaling: string;
    source_file_name: string;
    status: string;
  } | null;
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

/** #82f — jeden driver z assumptionsRegistry (Z114), status/badge do UI. */
interface AssumptionStatusRow {
  key: string;
  status: 'missing' | 'assumed' | 'edited' | 'sourced';
  needsReview: boolean;
  provenance?: { source_type?: string; rationale?: string; source_ref?: string };
}

type Tab = 'inputs' | 'events' | 'outputs' | 'validation';

interface Props {
  projectId?: string;
  initialModelId?: string;
  hideSidebar?: boolean;
  onModelChanged?: (modelId: string) => void;
}

async function getModelDetailWithFallback(modelId: string) {
  try {
    const data = await V8FinanceApi.getModel(modelId);
    return data?.model ?? null;
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.get(`/api/financial-modeling/models/${modelId}`);
  }
}

async function getModelsListWithFallback() {
  try {
    const data = await V8FinanceApi.getModels();
    return Array.isArray(data?.models) ? data.models : [];
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.get('/api/financial-modeling/models');
  }
}

async function getModelAssumptionsStatusWithFallback(modelId: string) {
  return await Api.get(`/api/financial-modeling/models/${modelId}/assumptions-status`);
}

async function getModelValidationsWithFallback(modelId: string) {
  try {
    return await V8FinanceApi.getModelValidations(modelId);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.get(`/api/financial-modeling/models/${modelId}/validations`);
  }
}

async function getModelOutputsWithFallback(modelId: string) {
  try {
    return await V8FinanceApi.getModelOutputs(modelId);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.get(`/api/financial-modeling/models/${modelId}/outputs`);
  }
}

async function computeModelWithFallback(modelId: string) {
  try {
    return await V8FinanceApi.computeModel(modelId);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.post(`/api/financial-modeling/models/${modelId}/compute`, {});
  }
}

async function approveModelWithFallback(modelId: string) {
  try {
    return await V8FinanceApi.approveModel(modelId);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.post(`/api/financial-modeling/models/${modelId}/approve`, {});
  }
}

async function refreshModelSourceWithFallback(modelId: string) {
  try {
    return await V8FinanceApi.refreshModelSource(modelId);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return (await Api.post(`/api/financial-modeling/models/${modelId}/refresh-source`, {})) as {
      success: boolean;
      seededFrom: string;
      missingBaselineLines: string[];
    };
  }
}

async function createModelWithFallback(body: V8FinanceModelCreatePayload) {
  try {
    return await V8FinanceApi.createModel(body);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.post('/api/financial-modeling/models', body);
  }
}

async function addModelEventWithFallback(modelId: string, body: V8FinanceModelEventCreatePayload) {
  try {
    return await V8FinanceApi.addModelEvent(modelId, body);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.post(`/api/financial-modeling/models/${modelId}/events`, body);
  }
}

async function deleteModelEventWithFallback(eventId: string) {
  try {
    return await V8FinanceApi.deleteModelEvent(eventId);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.delete(`/api/financial-modeling/events/${eventId}`);
  }
}

async function updateModelWithFallback(
  modelId: string,
  body: Record<string, unknown>,
  opts?: { expectedVersion?: number }
) {
  try {
    return await V8FinanceApi.updateModel(modelId, body, opts);
  } catch (error) {
    // FIN-03 CAS: a 409 VERSION_CONFLICT must reach the caller as-is — never
    // silently retried against the legacy route (shouldFallbackToLegacyFinance
    // already excludes 409, this comment just makes the intent explicit).
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.put(`/api/financial-modeling/models/${modelId}`, body);
  }
}

async function getCaseScenariosWithFallback(modelId: string) {
  try {
    return await V8FinanceApi.getCaseScenarios(modelId);
  } catch {
    // FIN-04 has no legacy predecessor route; a model that isn't part of a
    // case (or a transient error) just means "no scenario panel to show".
    return { scenarios: [] as V8FinanceCaseScenario[], count: 0, baselineModelId: null };
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  {
    value: 'revenue',
    i18nKey: 'finance.model.eventTypes.revenue',
    fallback: 'Revenue',
    cf: 'operating',
    icon: '📈',
  },
  {
    value: 'cogs',
    i18nKey: 'finance.model.eventTypes.cogs',
    fallback: 'COGS',
    cf: 'operating',
    icon: '📦',
  },
  {
    value: 'opex',
    i18nKey: 'finance.model.eventTypes.opex',
    fallback: 'Operating Expenses',
    cf: 'operating',
    icon: '💼',
  },
  {
    value: 'capex_purchase',
    i18nKey: 'finance.model.eventTypes.capexPurchase',
    fallback: 'CAPEX Purchase',
    cf: 'investing',
    icon: '🏗️',
  },
  {
    value: 'depreciation_run',
    i18nKey: 'finance.model.eventTypes.depreciationRun',
    fallback: 'Depreciation',
    cf: 'none',
    icon: '📉',
  },
  {
    value: 'debt_drawdown',
    i18nKey: 'finance.model.eventTypes.debtDrawdown',
    fallback: 'Debt Drawdown',
    cf: 'financing',
    icon: '🏦',
  },
  {
    value: 'debt_repayment',
    i18nKey: 'finance.model.eventTypes.debtRepayment',
    fallback: 'Debt Repayment',
    cf: 'financing',
    icon: '💳',
  },
  {
    value: 'interest_accrual',
    i18nKey: 'finance.model.eventTypes.interestAccrual',
    fallback: 'Interest',
    cf: 'operating',
    icon: '📊',
  },
  {
    value: 'tax_accrual',
    i18nKey: 'finance.model.eventTypes.taxAccrual',
    fallback: 'Tax',
    cf: 'operating',
    icon: '🏛️',
  },
  {
    value: 'wc_change',
    i18nKey: 'finance.model.eventTypes.wcChange',
    fallback: 'Working Capital Change',
    cf: 'operating',
    icon: '🔄',
  },
  {
    value: 'equity_injection',
    i18nKey: 'finance.model.eventTypes.equityInjection',
    fallback: 'Equity Injection',
    cf: 'financing',
    icon: '💰',
  },
  {
    value: 'dividend',
    i18nKey: 'finance.model.eventTypes.dividend',
    fallback: 'Dividend',
    cf: 'financing',
    icon: '🎯',
  },
];

const STATUS_CONFIG: Record<string, { badgeClass: string; icon: React.ReactNode }> = {
  draft: {
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
    icon: <Edit3 size={12} />,
  },
  review: {
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: <AlertTriangle size={12} />,
  },
  approved: {
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: <CheckCircle2 size={12} />,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FinancialModelWorkspace: React.FC<Props> = ({
  projectId,
  initialModelId,
  hideSidebar = false,
  onModelChanged,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const navigate = useNavigate();

  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('inputs');
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [refreshingSource, setRefreshingSource] = useState(false);
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
    eventType: 'revenue',
    name: '',
    amount: 0,
    periodStart: '',
    periodEnd: '',
    recurrence: 'monthly',
    growthRate: 0,
    cfClassification: 'operating',
  });

  // Outputs
  const [outputs, setOutputs] = useState<Record<string, Record<string, OutputLine[]>>>({});
  const [outputTab, setOutputTab] = useState<'P&L' | 'BS' | 'CF'>('P&L');

  // Validations
  const [validations, setValidations] = useState<ValidationItem[]>([]);
  const [validationSummary, setValidationSummary] = useState({
    total: 0,
    pass: 0,
    fail: 0,
    warning: 0,
  });

  // Assumptions
  const [assumptions, setAssumptions] = useState<Record<string, number>>({});
  // #82f — assumptionsRegistry status (imported/ai_assumed/missing) per driver, keyed by driver key.
  const [assumptionsStatus, setAssumptionsStatus] = useState<Record<string, AssumptionStatusRow>>(
    {}
  );

  // FIN-03 — save state for the assumptions CAS write. 'saved' is only reached
  // AFTER the server confirms the write AND we've re-fetched the persisted
  // model (durable read-back) — never set optimistically before the request
  // resolves.
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'conflict' | 'error'>(
    'idle'
  );
  const [saveConflict, setSaveConflict] = useState<{ serverVersion: number | null } | null>(null);

  // FIN-04 — sibling scenarios (Base/Upside/Downside + case root) of the
  // selected model's Investment Case, with baseline selection.
  const [caseScenarios, setCaseScenarios] = useState<V8FinanceCaseScenario[]>([]);
  const [baselineBusyId, setBaselineBusyId] = useState<string | null>(null);
  const [baselineError, setBaselineError] = useState<string | null>(null);

  // ── Load models ──
  const loadModels = useCallback(async () => {
    try {
      const data = await getModelsListWithFallback();
      setModels((data as any) || []);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const selectModel = useCallback(async (modelId: string) => {
    setLoading(true);
    try {
      // Real GET, every time — this is what makes a hard reload/reopen show
      // the SAME case/scenarios/baseline: nothing here is read from a client
      // cache or localStorage, it always re-fetches from the backend.
      const model = await getModelDetailWithFallback(modelId);
      setSelectedModel(model);
      setEvents((model as any)?.events || []);
      setAssumptions((model as any)?.assumptions_json || {});
      try {
        const [outData, valData, assumptionsStatusData, caseData] = await Promise.all([
          getModelOutputsWithFallback(modelId).catch(() => null),
          getModelValidationsWithFallback(modelId).catch(() => null),
          getModelAssumptionsStatusWithFallback(modelId).catch(() => null),
          getCaseScenariosWithFallback(modelId),
        ]);
        setOutputs(
          ((outData as any)?.grouped || {}) as Record<string, Record<string, OutputLine[]>>
        );
        setValidations(((valData as any)?.validations || []) as ValidationItem[]);
        setValidationSummary(
          ((valData as any)?.summary || { total: 0, pass: 0, fail: 0, warning: 0 }) as {
            total: number;
            pass: number;
            fail: number;
            warning: number;
          }
        );
        const statusRows: AssumptionStatusRow[] = Array.isArray(
          (assumptionsStatusData as any)?.assumptions
        )
          ? (assumptionsStatusData as any).assumptions
          : [];
        setAssumptionsStatus(Object.fromEntries(statusRows.map((row) => [row.key, row])));
        setCaseScenarios(
          Array.isArray((caseData as any)?.scenarios) ? (caseData as any).scenarios : []
        );
      } catch {
        setOutputs({});
        setValidations([]);
        setValidationSummary({ total: 0, pass: 0, fail: 0, warning: 0 });
        setAssumptionsStatus({});
        setCaseScenarios([]);
      }
      setError(null);
      trackFunnelEvent('financial_model_created', { modelId }); // viewed
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initialModelId) return;
    void selectModel(initialModelId);
  }, [initialModelId, selectModel]);

  // ── Create model ──
  const handleCreate = async () => {
    if (!newName || !newStartDate) return;
    setLoading(true);
    try {
      const data = await createModelWithFallback({
        name: newName,
        startDate: newStartDate,
        horizonMonths: newHorizon,
        granularity: newGranularity,
        currency: newCurrency,
        projectId,
        assumptions: { initialCash: 0, initialEquity: 0, initialDebt: 0, initialPPE: 0 },
      });
      const createdModel = (data as any)?.model || data;
      const createdModelId = String(createdModel?.id || (data as any)?.id || '');
      trackFunnelEvent('financial_model_created', { modelId: createdModelId || undefined });
      setShowCreate(false);
      setNewName('');
      await loadModels();
      if (createdModelId) {
        await selectModel(createdModelId);
        onModelChanged?.(createdModelId);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    }
    setLoading(false);
  };

  // ── Add event ──
  const handleAddEvent = async () => {
    if (!selectedModel || !eventForm.name || !eventForm.periodStart) return;
    try {
      await addModelEventWithFallback(selectedModel.id, {
        eventType: eventForm.eventType,
        name: eventForm.name,
        amount: eventForm.amount,
        periodStart: eventForm.periodStart,
        periodEnd: eventForm.periodEnd || undefined,
        recurrence: eventForm.recurrence,
        growthRate: eventForm.growthRate,
        cfClassification: eventForm.cfClassification,
      });
      trackFunnelEvent('financial_model_event_added', {
        modelId: selectedModel.id,
        eventType: eventForm.eventType,
      });
      setShowEventForm(false);
      setEventForm({
        eventType: 'revenue',
        name: '',
        amount: 0,
        periodStart: '',
        periodEnd: '',
        recurrence: 'monthly',
        growthRate: 0,
        cfClassification: 'operating',
      });
      await selectModel(selectedModel.id);
      onModelChanged?.(selectedModel.id);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteModelEventWithFallback(eventId);
      if (selectedModel) {
        await selectModel(selectedModel.id);
        onModelChanged?.(selectedModel.id);
      }
    } catch {
      /* noop */
    }
  };

  // ── Compute ──
  const handleCompute = async () => {
    if (!selectedModel) return;
    setComputing(true);
    setError(null);
    try {
      await computeModelWithFallback(selectedModel.id);

      // Load outputs
      const outData = await getModelOutputsWithFallback(selectedModel.id);
      setOutputs((outData as any)?.grouped || {});

      // Load validations
      const valData = await getModelValidationsWithFallback(selectedModel.id);
      setValidations((valData as any)?.validations || []);
      setValidationSummary((valData as any)?.summary || { total: 0, pass: 0, fail: 0, warning: 0 });

      setActiveTab('outputs');
      onModelChanged?.(selectedModel.id);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    }
    setComputing(false);
  };

  // ── Approve ──
  const handleApprove = async () => {
    if (!selectedModel) return;
    setLoading(true);
    try {
      const data = await approveModelWithFallback(selectedModel.id);
      if ((data as any)?.success) {
        trackFunnelEvent('financial_model_approved', { modelId: selectedModel.id });
        await selectModel(selectedModel.id);
        await loadModels();
        onModelChanged?.(selectedModel.id);
      } else {
        setError((data as any)?.error || 'Approval failed');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    }
    setLoading(false);
  };

  // ── Refresh from source (S6.4d) ──
  const handleRefreshSource = async () => {
    if (!selectedModel) return;
    setRefreshingSource(true);
    setError(null);
    try {
      await refreshModelSourceWithFallback(selectedModel.id);
      await selectModel(selectedModel.id);
      onModelChanged?.(selectedModel.id);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    }
    setRefreshingSource(false);
  };

  // ── Save assumptions ──
  // FIN-03: optimistic-concurrency (CAS) write. `expectedVersion` pins the
  // update to the version this session last read; a 409 VERSION_CONFLICT
  // means someone else changed the model since — surfaced honestly (never
  // silently overwritten). Success is only reported AFTER the server
  // confirms the write AND we've re-fetched the persisted model — no
  // optimistic/premature success.
  const handleSaveAssumptions = async () => {
    if (!selectedModel) return;
    setSaveState('saving');
    setSaveConflict(null);
    try {
      await updateModelWithFallback(
        selectedModel.id,
        { assumptions },
        { expectedVersion: selectedModel.version }
      );
      await selectModel(selectedModel.id);
      setSaveState('saved');
      onModelChanged?.(selectedModel.id);
    } catch (e: any) {
      if (e?.status === 409) {
        setSaveState('conflict');
        setSaveConflict({ serverVersion: (e?.data?.serverVersion as number) ?? null });
      } else {
        setSaveState('error');
        setError(e?.data?.error || e?.response?.data?.error || e?.message || String(e));
      }
    }
  };

  // ── FIN-04: set baseline ──
  // Calls the EXISTING POST /finance/models/:modelId/set-baseline endpoint
  // (no new route). Reloads the scenario list from the server afterward so
  // the "exactly one baseline" invariant shown in the UI always reflects
  // backend truth, not a locally-guessed toggle.
  const handleSetBaseline = async (scenarioModelId: string) => {
    if (!selectedModel) return;
    setBaselineBusyId(scenarioModelId);
    setBaselineError(null);
    try {
      await V8FinanceApi.setBaseline(scenarioModelId);
      const refreshed = await getCaseScenariosWithFallback(selectedModel.id);
      setCaseScenarios(
        Array.isArray((refreshed as any)?.scenarios) ? (refreshed as any).scenarios : []
      );
      if (scenarioModelId === selectedModel.id) {
        await selectModel(selectedModel.id);
      }
      onModelChanged?.(selectedModel.id);
    } catch (e: any) {
      setBaselineError(e?.data?.error || e?.message || String(e));
    } finally {
      setBaselineBusyId(null);
    }
  };

  // ── Render helpers ──

  const statusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badgeClass}`}
      >
        {cfg.icon} {status.toUpperCase()}
      </span>
    );
  };

  // #82f — status/source label for a driver (assumptionsRegistry Z114), reusing the exact
  // text style already used for the „Imported from statement" hint (line-under-label,
  // text-[10px] uppercase tracking-wide), only the color changes per status.
  const ASSUMPTION_STATUS_LABEL_CLASS: Record<string, string> = {
    sourced: 'text-blue-600 dark:text-blue-300',
    edited: 'text-emerald-600 dark:text-emerald-400',
    assumed: 'text-amber-600 dark:text-amber-400',
    missing: 'text-slate-500 dark:text-slate-500',
  };
  const assumptionStatusLabel = (driverKey: string) => {
    const row = assumptionsStatus[driverKey];
    if (!row) return null;
    const labels: Record<string, string> = {
      sourced: t('finance.modelWorkspace.assumptionStatus.sourced', 'Sourced'),
      edited: t('finance.modelWorkspace.assumptionStatus.edited', 'Edited'),
      assumed: t('finance.modelWorkspace.assumptionStatus.assumed', 'AI assumed — needs review'),
      missing: t('finance.modelWorkspace.assumptionStatus.missing', 'Missing'),
    };
    const cls = ASSUMPTION_STATUS_LABEL_CLASS[row.status] || ASSUMPTION_STATUS_LABEL_CLASS.missing;
    return (
      <div
        className={`mt-1 text-[10px] uppercase tracking-wide ${cls}`}
        title={row.provenance?.rationale || undefined}
      >
        {labels[row.status] || row.status}
      </div>
    );
  };

  const validationStatusIcon = (status: string) => {
    if (status === 'pass') return <CheckCircle2 size={14} className="text-emerald-500" />;
    if (status === 'fail') return <XCircle size={14} className="text-danger-500" />;
    return <AlertTriangle size={14} className="text-amber-500" />;
  };

  const formatAmount = (n: number, opts?: { decimals?: number }) => {
    const decimals = opts?.decimals ?? 0;
    return new Intl.NumberFormat(isPl ? 'pl-PL' : 'en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      signDisplay: 'auto',
    }).format(n);
  };

  const formatCurrency = (n: number) => {
    const currency = selectedModel?.currency || 'PLN';
    try {
      return new Intl.NumberFormat(isPl ? 'pl-PL' : 'en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `${formatAmount(n)} ${currency}`;
    }
  };

  const seedSource = selectedModel?.assumptions_json?.seedSource || null;
  const seedStatus = selectedModel?.assumptions_json?.seedStatus || null;
  const baselineAssumptions = (assumptions?.baseline || {}) as Record<string, number>;
  const hasManualBaseline =
    Object.values(baselineAssumptions).some((value) => Number(value || 0) !== 0) ||
    [
      assumptions?.initialCash,
      assumptions?.initialEquity,
      assumptions?.initialDebt,
      assumptions?.initialPPE,
      assumptions?.initialAR,
      assumptions?.initialInventory,
      assumptions?.initialAP,
    ].some((value) => Number(value || 0) !== 0);
  // #82e — Analysis→Models bridge (FinancialAnalysisWorkspace "Use as model
  // assumptions"): ratios pushed from a financial analysis, tagged with
  // provenance 'from-analysis'. Read-only display here; written via the
  // existing PUT /models/:id assumptions CRUD by the bridge action.
  const fromAnalysis = (assumptions as any)?.fromAnalysis as
    | {
        analysisId?: string;
        analysisTitle?: string;
        appliedAt?: string;
        ratios?: Array<{
          ratio_code: string;
          ratio_name: string;
          value: number | null;
          period?: string;
          interpretation?: string | null;
          benchmark?: number | null;
        }>;
      }
    | undefined;
  const missingBaselineLines: string[] = Array.isArray(seedStatus?.missingBaselineLines)
    ? seedStatus.missingBaselineLines
    : [];
  // A model is "grounded" when it was seeded from a statement OR a statement
  // pack. Both carry historical lines; the badge must reflect either (S6.4c).
  const isGrounded =
    seedSource?.type === 'statement' ||
    seedSource?.type === 'statement_pack' ||
    Boolean(selectedModel?.source_statement || selectedModel?.source_statement_id);
  const groundedLabel: string =
    selectedModel?.source_statement?.period_label ||
    seedSource?.periodLabel ||
    (seedSource?.sourceFileName ? String(seedSource.sourceFileName) : '') ||
    '';
  const seededInputKeys = new Set(
    isGrounded
      ? [
          'initialCash',
          'initialEquity',
          'initialDebt',
          'initialPPE',
          'initialAR',
          'initialInventory',
          'initialAP',
        ]
      : []
  );

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'inputs',
      label: t('finance.model.inputs', 'Inputs & Assumptions'),
      icon: <Settings size={14} />,
    },
    {
      key: 'events',
      label: t('finance.model.events', 'Events Timeline'),
      icon: <Calendar size={14} />,
    },
    {
      key: 'outputs',
      label: t('finance.model.outputs', 'Outputs (P&L / BS / CF)'),
      icon: <BarChart3 size={14} />,
    },
    {
      key: 'validation',
      label: t('finance.model.validation', 'Validation'),
      icon: <Shield size={14} />,
    },
  ];

  return (
    <div className="flex h-full min-h-[600px]">
      {/* ── Sidebar ── */}
      {!hideSidebar && (
        <div className="w-72 border-r border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">
              {t('finance.model.title', 'Financial Models')}
            </h2>
            <button
              onClick={() => setShowCreate(true)}
              className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-1.5 flex-1 overflow-y-auto">
            {models.map((m) => (
              <button
                key={m.id}
                onClick={() => selectModel(m.id)}
                className={`w-full text-left p-3 rounded-xl transition-colors ${
                  selectedModel?.id === m.id
                    ? 'bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                    : 'hover:bg-white dark:hover:bg-navy-800 border border-transparent'
                }`}
              >
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {m.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {statusBadge(m.status)}
                  <span className="text-[10px] text-slate-600">v{m.version}</span>
                </div>
              </button>
            ))}
            {models.length === 0 && (
              <p className="text-xs text-slate-600 text-center py-8">
                {t('finance.model.noModels', 'No models yet. Create one to start.')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedModel ? (
          <div className="flex-1 flex items-center justify-center">
            <SharedEmptyState
              variant="new"
              icon={FileText}
              title={t('finance.model.emptyTitle', 'No model selected')}
              description={t(
                'finance.model.emptyDesc',
                'Pick a financial model from the list, or create a new one to start forecasting.'
              )}
              primaryAction={{
                label: t('finance.model.createModel', 'Create Financial Model'),
                onClick: () => setShowCreate(true),
                icon: Plus,
              }}
            />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {selectedModel.name}
                  </h2>
                  {statusBadge(selectedModel.status)}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {selectedModel.currency} · {selectedModel.granularity} ·{' '}
                  {selectedModel.horizon_months} {t('finance.model.months', 'months')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Secondary actions — neutral, lower visual weight than Compute */}
                <ExportButton
                  analysisId={selectedModel.id}
                  analysisTitle={selectedModel.name}
                  analysisType="financial_model"
                  className="shrink-0"
                />
                <button
                  onClick={() =>
                    navigate(
                      `/economics?tab=valuation&createFrom=financial_model&sourceId=${selectedModel.id}`
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus transition-colors"
                >
                  <TrendingUp size={14} />
                  {t('finance.model.valuateModel', 'Wycen model')}
                </button>
                {selectedModel.status === 'draft' && (
                  <button
                    onClick={handleApprove}
                    disabled={loading || validationSummary.fail > 0}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle2 size={14} />
                    {t('finance.model.approve', 'Approve')}
                  </button>
                )}
                {selectedModel.status === 'approved' && (
                  <span className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 text-sm font-medium rounded-xl">
                    <Lock size={14} /> {t('finance.model.approved', 'Approved')}
                  </span>
                )}
                {/* Primary action — Compute drives the model; highest visual weight.
                    Neutral inverted style (bg-c-text/text-c-bg), matching the
                    EditorShell TopBar primary-chip convention — NEVER crimson. */}
                <button
                  onClick={handleCompute}
                  disabled={computing}
                  className="flex items-center gap-1.5 px-4 py-2 bg-c-text text-c-bg text-sm font-semibold rounded-xl hover:bg-c-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50 transition-colors"
                >
                  {computing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  {t('finance.model.compute', 'Compute')}
                </button>
              </div>
            </div>

            {isGrounded ? (
              <div className="mx-6 mt-4 rounded-2xl border border-blue-200/70 dark:border-blue-700/40 bg-blue-50/70 dark:bg-blue-900/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300">
                      <Link2 size={12} />
                      {t('finance.model.groundedBadgeLabel', 'Grounded on')}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {groundedLabel ||
                        t('finance.model.groundedGenericSource', 'Approved statement')}
                    </div>
                    <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {selectedModel.source_statement
                        ? `${selectedModel.source_statement.statement_type} • ${selectedModel.source_statement.currency} • ${selectedModel.source_statement.status}`
                        : seedSource?.type === 'statement_pack'
                          ? t('finance.model.seededFromPack', 'Seeded from approved statement pack')
                          : t(
                              'finance.model.seededFromStatement',
                              'Seeded from imported statement'
                            )}
                    </div>
                    {missingBaselineLines.length > 0 && (
                      <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        {t('finance.model.missingBaselineLines', 'Missing baseline lines')}:{' '}
                        {missingBaselineLines.join(', ')}
                      </div>
                    )}
                  </div>
                  {selectedModel.status !== 'approved' && (
                    <button
                      onClick={handleRefreshSource}
                      disabled={refreshingSource}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-blue-300/70 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700/50 dark:bg-navy-800 dark:text-blue-300 dark:hover:bg-navy-700"
                      title={
                        t(
                          'finance.model.refreshSourceHint',
                          'Re-pull historical lines from the source statement'
                        ) as string
                      }
                    >
                      <RefreshCw
                        size={14}
                        className={refreshingSource ? 'animate-spin' : undefined}
                      />
                      {refreshingSource
                        ? t('finance.model.refreshingSource', 'Refreshing…')
                        : t('finance.model.refreshSource', 'Refresh from source')}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mx-6 mt-4 rounded-2xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('finance.model.seedStatus', 'Seed status')}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {hasManualBaseline
                    ? t('finance.model.seededFromManualBaseline', 'Manual / prepared baseline')
                    : t('finance.model.seededManually', 'Manual / zero-seeded')}
                </div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {hasManualBaseline
                    ? t(
                        'finance.model.manualBaselineHint',
                        'This model uses a manually prepared baseline. Review the assumptions before approval.'
                      )
                    : t(
                        'finance.model.notGroundedHint',
                        'This model was created without a source statement. Opening balances start at zero.'
                      )}
                </div>
              </div>
            )}

            {/* FIN-04 — Investment Case scenarios (Base/Upside/Downside) + baseline
                selection. Only shown once the model actually has siblings (i.e. it
                is part of a case with more than one scenario). Reading from
                `caseScenarios`, which selectModel() always re-fetches from the
                server — so a reopen shows the same baseline, not a stale local
                guess. */}
            {caseScenarios.length > 1 && (
              <div
                className="mx-6 mt-4 rounded-2xl border border-c-border-subtle bg-c-surface p-4"
                data-testid="case-scenarios-panel"
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <h3 className="text-sm font-semibold text-c-text">
                    {t('finance.model.scenarios.title', 'Scenariusze i baseline')}
                  </h3>
                  {baselineError && (
                    <span className="text-xs text-c-danger" data-testid="baseline-error">
                      {baselineError}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {caseScenarios.map((s) => (
                    <div
                      key={s.id}
                      data-testid={`scenario-chip-${s.id}`}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                        s.is_baseline
                          ? 'border-c-focus bg-c-focus/10 text-c-text'
                          : 'border-c-border bg-c-surface-raised text-c-text-secondary'
                      }`}
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-[10px] uppercase tracking-wide text-c-text-muted">
                        {s.scenario || '—'}
                      </span>
                      {s.is_baseline ? (
                        <span
                          className="rounded-full bg-c-focus/20 px-2 py-0.5 text-[10px] font-semibold text-c-text"
                          data-testid={`baseline-badge-${s.id}`}
                        >
                          {t('finance.model.scenarios.baseline', 'Baseline')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetBaseline(s.id)}
                          disabled={baselineBusyId !== null}
                          className="rounded-lg border border-c-border px-2 py-1 text-[10px] font-medium text-c-text-secondary hover:border-c-focus hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50"
                          data-testid={`set-baseline-${s.id}`}
                        >
                          {baselineBusyId === s.id
                            ? t('finance.model.scenarios.settingBaseline', 'Ustawiam…')
                            : t('finance.model.scenarios.setBaseline', 'Ustaw jako baseline')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="mx-6 mt-3 p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl flex items-start gap-2">
                <AlertTriangle size={14} className="text-danger-500 mt-0.5 shrink-0" />
                <span className="text-sm text-danger-700 dark:text-danger-400">{error}</span>
              </div>
            )}

            {/* Tabs — one segmented control (editor-shell-canon overflow/segmented
                pattern), same activeTab/setActiveTab state + aria wiring as before. */}
            <div className="px-6 pt-3 pb-3 border-b border-c-border-subtle">
              <div
                role="tablist"
                aria-label={t('finance.model.tabs', 'Model sections')}
                className="inline-flex items-center gap-0.5 rounded-lg bg-c-surface-raised p-0.5"
              >
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.key}
                    aria-controls={`tabpanel-${tab.key}`}
                    id={`tab-${tab.key}`}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-c-surface text-c-text shadow-sm'
                        : 'text-c-text-muted hover:text-c-text-secondary'
                    }`}
                  >
                    {tab.icon} {tab.label}
                    {tab.key === 'validation' && validationSummary.fail > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-danger-100 text-danger-700 text-[10px] rounded-full">
                        {validationSummary.fail}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div
              role="tabpanel"
              id={`tabpanel-${activeTab}`}
              aria-labelledby={`tab-${activeTab}`}
              className="flex-1 overflow-y-auto p-6"
            >
              {/* ── Inputs tab ── */}
              {activeTab === 'inputs' && (
                <div className="max-w-2xl space-y-6">
                  <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {t('finance.model.seedInputs', 'Seed source and baseline')}
                      </h3>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {isGrounded
                          ? t('finance.model.seededFromStatement', 'Seeded from statement')
                          : hasManualBaseline
                            ? t(
                                'finance.model.seededFromManualBaseline',
                                'Manual / prepared baseline'
                              )
                            : t('finance.model.seededManually', 'Manual / zero-seeded')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ['Revenue', baselineAssumptions.revenue, 'baseline.revenue'],
                        ['COGS', baselineAssumptions.cogs, 'baseline.cogs'],
                        ['OPEX', baselineAssumptions.opex, 'baseline.opex'],
                        ['Depreciation', baselineAssumptions.depreciation, 'baseline.depreciation'],
                        ['Interest', baselineAssumptions.interest, 'baseline.interest'],
                        ['Tax', baselineAssumptions.tax, 'baseline.tax'],
                        ['CAPEX', baselineAssumptions.capex, 'baseline.capex'],
                      ].map(([label, value, driverKey]) => (
                        <div
                          key={String(label)}
                          className="rounded-xl bg-slate-50 dark:bg-navy-800/70 p-3"
                        >
                          <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {label}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                            {formatAmount(Number(value || 0))}
                          </div>
                          {assumptionStatusLabel(String(driverKey))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* #82e — Analysis→Models bridge: shows what a "Use as model
                      assumptions" action from FinancialAnalysisWorkspace pushed
                      here, so the wiring is visible, not silent. */}
                  {fromAnalysis && (fromAnalysis.ratios?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-blue-200/70 dark:border-blue-700/40 bg-blue-50/70 dark:bg-blue-900/10 p-5 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {t('finance.model.fromAnalysisTitle', 'From financial analysis')}
                        </h3>
                        <span className="text-[10px] uppercase tracking-wide text-blue-700 dark:text-blue-300">
                          {t('finance.model.fromAnalysisProvenance', 'from-analysis')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        {fromAnalysis.analysisTitle || fromAnalysis.analysisId}
                        {fromAnalysis.appliedAt
                          ? ` · ${new Date(fromAnalysis.appliedAt).toLocaleString(isPl ? 'pl-PL' : 'en-US')}`
                          : ''}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(fromAnalysis.ratios || []).map((r) => (
                          <span
                            key={r.ratio_code}
                            title={r.interpretation || undefined}
                            className="rounded-full bg-white dark:bg-navy-800 border border-blue-200/70 dark:border-blue-700/40 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200"
                          >
                            {r.ratio_name}: <span className="font-mono">{r.value ?? '—'}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5 space-y-4">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {t('finance.model.initialBalances', 'Initial Balance Sheet')}
                    </h3>
                    {[
                      {
                        key: 'initialCash',
                        i18nKey: 'finance.model.initialFields.cash',
                        fallback: 'Cash',
                      },
                      {
                        key: 'initialEquity',
                        i18nKey: 'finance.model.initialFields.equity',
                        fallback: 'Equity',
                      },
                      {
                        key: 'initialDebt',
                        i18nKey: 'finance.model.initialFields.debt',
                        fallback: 'Debt',
                      },
                      {
                        key: 'initialPPE',
                        i18nKey: 'finance.model.initialFields.ppe',
                        fallback: 'PPE (Net)',
                      },
                      {
                        key: 'initialAR',
                        i18nKey: 'finance.model.initialFields.accountsReceivable',
                        fallback: 'Accounts Receivable',
                      },
                      {
                        key: 'initialInventory',
                        i18nKey: 'finance.model.initialFields.inventory',
                        fallback: 'Inventory',
                      },
                      {
                        key: 'initialAP',
                        i18nKey: 'finance.model.initialFields.accountsPayable',
                        fallback: 'Accounts Payable',
                      },
                    ].map(({ key, i18nKey, fallback }) => (
                      <div key={key} className="flex items-center justify-between gap-4">
                        <div className="w-48">
                          <label className="text-sm text-slate-700 dark:text-slate-300">
                            {t(i18nKey, fallback)}
                          </label>
                          {seededInputKeys.has(key) ? (
                            <div className="mt-1 text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-300">
                              {t('finance.model.importedFromStatement', 'Imported from statement')}
                            </div>
                          ) : (
                            assumptionStatusLabel(key)
                          )}
                        </div>
                        <input
                          type="number"
                          value={assumptions[key] ?? 0}
                          onChange={(e) =>
                            setAssumptions((prev) => ({
                              ...prev,
                              [key]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-48 px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-sm text-right font-mono"
                        />
                      </div>
                    ))}
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        onClick={handleSaveAssumptions}
                        disabled={saveState === 'saving'}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 disabled:opacity-50"
                        data-testid="save-assumptions"
                      >
                        {saveState === 'saving'
                          ? t('common.saving', 'Zapisuję…')
                          : t('common.save', 'Save')}
                      </button>
                      {saveState === 'saved' && (
                        <span
                          className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"
                          data-testid="save-success"
                        >
                          <CheckCircle2 size={14} />
                          {t('finance.model.saved', 'Zapisano')}
                        </span>
                      )}
                    </div>
                    {saveState === 'conflict' && (
                      <div
                        className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300"
                        data-testid="version-conflict-banner"
                      >
                        {t(
                          'finance.model.versionConflict',
                          'Model został zmieniony przez kogoś innego od ostatniego odczytu. Odśwież, aby zobaczyć aktualną wersję, i spróbuj ponownie.'
                        )}
                        {saveConflict?.serverVersion != null && (
                          <>
                            {' '}
                            ({t('finance.model.serverVersion', 'wersja serwera')}:{' '}
                            {saveConflict.serverVersion})
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            void selectModel(selectedModel.id).then(() => setSaveState('idle'));
                          }}
                          className="ml-2 font-medium underline underline-offset-2 hover:no-underline"
                          data-testid="version-conflict-reload"
                        >
                          {t('common.reload', 'Odśwież')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Events tab ── */}
              {activeTab === 'events' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {t('finance.model.economicEvents', 'Economic Events')}
                    </h3>
                    <button
                      onClick={() => setShowEventForm(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500"
                    >
                      <Plus size={14} /> {t('finance.model.addEvent', 'Add Event')}
                    </button>
                  </div>

                  {events.length === 0 && (
                    <div className="text-center py-12 text-slate-600">
                      <Calendar size={32} className="mx-auto mb-3 opacity-40" />
                      <p>
                        {isGrounded
                          ? t(
                              'finance.model.noEventsSeeded',
                              'No forecast events yet. This model already has a seeded baseline; add events to project changes on top of it.'
                            )
                          : t(
                              'finance.model.noEvents',
                              'No events yet. Add economic events to drive the model.'
                            )}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {events.map((ev) => {
                      const cfg = EVENT_TYPES.find((e) => e.value === ev.event_type);
                      return (
                        <div
                          key={ev.id}
                          className={`p-4 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 flex items-center gap-4 ${!ev.is_active ? 'opacity-50' : ''}`}
                        >
                          <span className="text-lg">{cfg?.icon || '📌'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {ev.name}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-slate-600 mt-0.5">
                              <span>{cfg ? t(cfg.i18nKey, cfg.fallback) : ''}</span>
                              <span className="font-mono">{formatCurrency(ev.amount)}</span>
                              <span>{ev.recurrence}</span>
                              {ev.growth_rate !== 0 && (
                                <span className="text-emerald-500">+{ev.growth_rate}%/yr</span>
                              )}
                              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-navy-800 rounded text-[10px]">
                                {ev.cf_classification}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-slate-600">
                            {ev.period_start}
                            {ev.period_end ? ` → ${ev.period_end}` : ''}
                          </span>
                          <button
                            onClick={() => handleDeleteEvent(ev.id)}
                            aria-label={t('finance.model.deleteEvent', 'Delete event') as string}
                            className="p-1.5 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg"
                          >
                            <Trash2 size={14} className="text-danger-400" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Event form modal */}
                  {showEventForm && (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          {t('finance.model.addEvent', 'Add Event')}
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="text-xs text-slate-500">
                              {t('finance.model.eventType', 'Event Type')}
                            </label>
                            <select
                              value={eventForm.eventType}
                              onChange={(e) => {
                                const cfg = EVENT_TYPES.find((et) => et.value === e.target.value);
                                setEventForm((f) => ({
                                  ...f,
                                  eventType: e.target.value,
                                  cfClassification: cfg?.cf || 'operating',
                                }));
                              }}
                              className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
                            >
                              {EVENT_TYPES.map((et) => (
                                <option key={et.value} value={et.value}>
                                  {et.icon} {t(et.i18nKey, et.fallback)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-slate-500">
                              {t('finance.model.eventName', 'Name')}
                            </label>
                            <input
                              value={eventForm.name}
                              onChange={(e) =>
                                setEventForm((f) => ({ ...f, name: e.target.value }))
                              }
                              className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">
                              {t('finance.model.amount', 'Amount')}
                            </label>
                            <input
                              type="number"
                              value={eventForm.amount}
                              onChange={(e) =>
                                setEventForm((f) => ({
                                  ...f,
                                  amount: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800 text-right font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">
                              {t('finance.model.recurrence', 'Recurrence')}
                            </label>
                            <select
                              value={eventForm.recurrence}
                              onChange={(e) =>
                                setEventForm((f) => ({ ...f, recurrence: e.target.value }))
                              }
                              className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
                            >
                              <option value="one_time">
                                {t('finance.model.oneTime', 'One-time')}
                              </option>
                              <option value="monthly">
                                {t('finance.model.monthly', 'Monthly')}
                              </option>
                              <option value="quarterly">
                                {t('finance.model.quarterly', 'Quarterly')}
                              </option>
                              <option value="annual">{t('finance.model.annual', 'Annual')}</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">
                              {t('finance.model.startDate', 'Start Date')}
                            </label>
                            <input
                              type="date"
                              value={eventForm.periodStart}
                              onChange={(e) =>
                                setEventForm((f) => ({ ...f, periodStart: e.target.value }))
                              }
                              className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">
                              {t('finance.model.endDate', 'End Date')}
                            </label>
                            <input
                              type="date"
                              value={eventForm.periodEnd}
                              onChange={(e) =>
                                setEventForm((f) => ({ ...f, periodEnd: e.target.value }))
                              }
                              className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">
                              {t('finance.model.growthRate', 'Growth Rate (%/yr)')}
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={eventForm.growthRate}
                              onChange={(e) =>
                                setEventForm((f) => ({
                                  ...f,
                                  growthRate: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800 text-right font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">
                              {t('finance.model.cfClass', 'CF Classification')}
                            </label>
                            <select
                              value={eventForm.cfClassification}
                              onChange={(e) =>
                                setEventForm((f) => ({ ...f, cfClassification: e.target.value }))
                              }
                              className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
                            >
                              <option value="operating">Operating</option>
                              <option value="investing">Investing</option>
                              <option value="financing">Financing</option>
                              <option value="none">None</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            onClick={() => setShowEventForm(false)}
                            className="px-4 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm"
                          >
                            {t('common.cancel', 'Cancel')}
                          </button>
                          <button
                            onClick={handleAddEvent}
                            disabled={!eventForm.name || !eventForm.periodStart}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50"
                          >
                            {t('finance.model.addEvent', 'Add Event')}
                          </button>
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
                    {(['P&L', 'BS', 'CF'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setOutputTab(st)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          outputTab === st
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700'
                        }`}
                      >
                        {st === 'P&L'
                          ? t('finance.model.pl', 'P&L')
                          : st === 'BS'
                            ? t('finance.model.bs', 'Balance Sheet')
                            : t('finance.model.cf', 'Cash Flow')}
                      </button>
                    ))}
                  </div>

                  {computing && Object.keys(outputs).length === 0 ? (
                    // Loading-state fix (finding baseclient_20s_timeout / staging_db_perf):
                    // compute + outputs + validations fetch can take 5-30s. Previously the
                    // Outputs tab kept showing the stale "compute not run yet" empty state
                    // during this window, reading as a hang. Show an explicit "what's
                    // happening" message plus a skeleton table so the wait is legible.
                    <div className="py-8" aria-busy="true" aria-live="polite">
                      <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
                        <Loader2 size={16} className="animate-spin" />
                        <span>
                          {t(
                            'finance.model.computing',
                            'Computing forecast — running the model, generating outputs and validations. This can take up to 30 seconds…'
                          )}
                        </span>
                      </div>
                      <div className="space-y-2 max-w-3xl mx-auto">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-8 rounded-md bg-slate-100 dark:bg-navy-800 animate-pulse"
                          />
                        ))}
                      </div>
                    </div>
                  ) : Object.keys(outputs).length === 0 ? (
                    <div className="text-center py-12 text-slate-600">
                      <BarChart3 size={32} className="mx-auto mb-3 opacity-40" />
                      <p>
                        {isGrounded
                          ? t(
                              'finance.model.noOutputsSeeded',
                              'Statement connected but compute not run yet. Run compute to generate forecast outputs.'
                            )
                          : t('finance.model.noOutputs', 'Click "Compute" to generate outputs')}
                      </p>
                      {missingBaselineLines.length > 0 && (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                          {t('finance.model.missingBaselineLines', 'Missing baseline lines')}:{' '}
                          {missingBaselineLines.join(', ')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table
                        /* §27-exempt: edytor komorkowy/workspace, edycja cell-by-cell */ className="w-full text-sm border-collapse"
                      >
                        <thead>
                          <tr className="bg-slate-50 dark:bg-navy-800">
                            <th className="text-left px-3 py-2 font-medium text-slate-500 sticky left-0 bg-slate-50 dark:bg-navy-800 z-10 border-r border-slate-200 dark:border-navy-700 min-w-[180px]">
                              {t('finance.model.line', 'Line')}
                            </th>
                            {Object.keys(outputs).map((period) => (
                              <th
                                key={period}
                                className="text-right px-3 py-2 font-medium text-slate-500 whitespace-nowrap"
                              >
                                {period}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.03]">
                          {(() => {
                            const firstPeriod = Object.values(outputs)[0]?.[outputTab];
                            if (!firstPeriod) return null;
                            return firstPeriod.map((line, idx) => {
                              const isSummaryLine = [
                                'GROSS_PROFIT',
                                'EBITDA',
                                'EBIT',
                                'NET_INCOME',
                                'TOTAL_ASSETS',
                                'TOTAL_LIABILITIES',
                                'TOTAL_EQUITY',
                                'TOTAL_LIABILITIES_EQUITY',
                                'OPERATING_CF',
                                'INVESTING_CF',
                                'FINANCING_CF',
                                'NET_CHANGE_CASH',
                                'CLOSING_CASH',
                              ].includes(line.lineCode);
                              return (
                                <tr
                                  key={line.lineCode}
                                  className={
                                    isSummaryLine
                                      ? 'bg-slate-50/50 dark:bg-navy-800/30 font-semibold'
                                      : ''
                                  }
                                >
                                  <td
                                    className={`px-3 py-2 text-slate-700 dark:text-slate-300 sticky left-0 z-10 whitespace-nowrap border-r border-slate-200 dark:border-navy-700 ${
                                      isSummaryLine
                                        ? 'bg-slate-50 dark:bg-navy-800/50'
                                        : 'bg-white dark:bg-navy-950'
                                    }`}
                                  >
                                    {line.lineName}
                                  </td>
                                  {Object.entries(outputs).map(([period, stmts]) => {
                                    const val =
                                      stmts[outputTab]?.find((l) => l.lineCode === line.lineCode)
                                        ?.value ?? 0;
                                    return (
                                      <td
                                        key={period}
                                        className={`px-3 py-2 text-right font-mono whitespace-nowrap ${val < 0 ? 'text-danger-600' : 'text-slate-900 dark:text-white'}`}
                                      >
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <SummaryCard
                      label={t('finance.model.totalChecks', 'Total Checks')}
                      value={String(validationSummary.total)}
                      icon={<Shield size={18} className="text-blue-500" />}
                      accentClass="border-l-blue-500"
                    />
                    <SummaryCard
                      label={t('finance.model.passed', 'Passed')}
                      value={String(validationSummary.pass)}
                      icon={<CheckCircle2 size={18} className="text-emerald-500" />}
                      accentClass="border-l-emerald-500"
                      ratio={
                        validationSummary.total > 0
                          ? validationSummary.pass / validationSummary.total
                          : 0
                      }
                      ratioColor="bg-emerald-500"
                    />
                    <SummaryCard
                      label={t('finance.model.failed', 'Failed')}
                      value={String(validationSummary.fail)}
                      icon={<XCircle size={18} className="text-danger-500" />}
                      accentClass="border-l-danger-500"
                      ratio={
                        validationSummary.total > 0
                          ? validationSummary.fail / validationSummary.total
                          : 0
                      }
                      ratioColor="bg-danger-500"
                    />
                    <SummaryCard
                      label={t('finance.model.warnings', 'Warnings')}
                      value={String(validationSummary.warning)}
                      icon={<AlertTriangle size={18} className="text-amber-500" />}
                      accentClass="border-l-amber-500"
                      ratio={
                        validationSummary.total > 0
                          ? validationSummary.warning / validationSummary.total
                          : 0
                      }
                      ratioColor="bg-amber-500"
                    />
                  </div>

                  {/* Model health indicator */}
                  <div
                    className={`p-4 rounded-xl border ${
                      validationSummary.fail > 0
                        ? 'bg-danger-50 border-danger-200 dark:bg-danger-900/20 dark:border-danger-800'
                        : validationSummary.warning > 0
                          ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                          : validationSummary.total > 0
                            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'
                            : 'bg-slate-50 border-slate-200 dark:bg-navy-800 dark:border-navy-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {validationSummary.fail > 0 ? (
                        <XCircle size={20} className="text-danger-500" />
                      ) : validationSummary.warning > 0 ? (
                        <AlertTriangle size={20} className="text-amber-500" />
                      ) : validationSummary.total > 0 ? (
                        <CheckCircle2 size={20} className="text-emerald-500" />
                      ) : (
                        <Shield size={20} className="text-slate-600" />
                      )}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {t('finance.model.modelHealth', 'Model Health')}:{' '}
                        {validationSummary.fail > 0
                          ? t('finance.model.needsReview', 'NEEDS REVIEW')
                          : validationSummary.warning > 0
                            ? t('finance.model.warnings', 'WARNINGS')
                            : validationSummary.total > 0
                              ? t('finance.model.healthy', 'HEALTHY')
                              : t('finance.model.notComputed', 'Not computed yet')}
                      </span>
                    </div>
                  </div>

                  {/* Validation details */}
                  {validations.length > 0 && (
                    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-navy-800">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium text-slate-500">
                              {t('finance.model.check', 'Check')}
                            </th>
                            <th className="text-left px-4 py-2 font-medium text-slate-500">
                              {t('finance.model.period', 'Period')}
                            </th>
                            <th className="text-center px-4 py-2 font-medium text-slate-500">
                              {t('finance.model.status', 'Status')}
                            </th>
                            <th className="text-left px-4 py-2 font-medium text-slate-500">
                              {t('finance.model.message', 'Message')}
                            </th>
                            <th className="text-right px-4 py-2 font-medium text-slate-500">
                              {t('finance.model.diff', 'Diff')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.03]">
                          {validations.slice(0, 60).map((v, i) => (
                            <tr
                              key={i}
                              className={
                                v.status === 'fail' ? 'bg-danger-50/30 dark:bg-danger-900/10' : ''
                              }
                            >
                              <td className="px-4 py-2 text-slate-700 dark:text-slate-300 font-medium">
                                {v.check_name}
                              </td>
                              <td className="px-4 py-2 text-slate-500 text-xs font-mono">
                                {v.period_date?.slice(0, 7)}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {validationStatusIcon(v.status)}
                              </td>
                              <td className="px-4 py-2 text-slate-600 dark:text-slate-400 text-xs">
                                {v.message}
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-xs text-slate-500">
                                {v.difference?.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {validations.length === 0 && (
                    <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-6 text-sm text-slate-500 dark:text-slate-400">
                      {isGrounded
                        ? t(
                            'finance.model.validationSeededEmpty',
                            'Statement connected but compute not run yet. Run compute to generate validation checks.'
                          )
                        : t(
                            'finance.model.validationEmpty',
                            'No validation results yet. Run compute to evaluate model consistency.'
                          )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Version history (M16/6.5) — behind ff_modelVersioning, same
                parity as the previous FinanceModelDocumentView full-view. */}
            {isFinanceFlagEnabled('modelVersioning') && (
              <div className="border-t border-slate-200 dark:border-navy-700 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                  {t('finance.versions.title', 'Version history')}
                </div>
                <ModelVersionHistory modelId={selectedModel.id} />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Create modal ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('finance.model.createModel', 'Create Financial Model')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">
                  {t('finance.model.modelName', 'Model Name')}
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={
                    t(
                      'finance.model.modelNamePlaceholder',
                      'e.g. Initiative Alpha — 5yr projection'
                    ) as string
                  }
                  className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">
                    {t('finance.model.startDate', 'Start Date')}
                  </label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">
                    {t('finance.model.horizon', 'Horizon (months)')}
                  </label>
                  <input
                    type="number"
                    value={newHorizon}
                    onChange={(e) => setNewHorizon(parseInt(e.target.value) || 60)}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">
                    {t('finance.model.granularity', 'Granularity')}
                  </label>
                  <select
                    value={newGranularity}
                    onChange={(e) => setNewGranularity(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
                  >
                    <option value="monthly">{t('finance.model.monthly', 'Monthly')}</option>
                    <option value="quarterly">{t('finance.model.quarterly', 'Quarterly')}</option>
                    <option value="annual">{t('finance.model.annual', 'Annual')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500">
                    {t('finance.model.currency', 'Currency')}
                  </label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
                  >
                    {['PLN', 'EUR', 'USD', 'GBP', 'CZK', 'CHF'].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName || loading}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50"
              >
                {t('common.create', 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-components ──
const SummaryCard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  accentClass?: string;
  ratio?: number;
  ratioColor?: string;
}> = ({ label, value, icon, accentClass, ratio, ratioColor }) => (
  <div
    className={`bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 border-l-4 ${accentClass || 'border-l-slate-300'}`}
  >
    <div className="flex items-center gap-3">
      <div className="p-2 bg-slate-50 dark:bg-navy-800 rounded-lg shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
      </div>
    </div>
    {ratio != null && ratio > 0 && (
      <div className="mt-3 h-1.5 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${ratioColor || 'bg-slate-400'}`}
          style={{ width: `${Math.min(ratio * 100, 100)}%` }}
        />
      </div>
    )}
  </div>
);

export default FinancialModelWorkspace;
