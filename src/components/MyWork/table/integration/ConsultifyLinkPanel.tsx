/**
 * ConsultifyLinkPanel — connects Table Platform data to Consultify modules:
 * Results, Finance, Execution, and Initiatives.
 */
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Loader2,
  Rocket,
  Target,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import * as Api from '@/services/api/tablePlatform.api';
import { isBetaClosed } from '@/utils/betaAccess';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface LinkStatus {
  linked: boolean;
  lastSync?: string;
  recordCount: number;
  errors: string[];
}

interface ModuleLinkStatuses {
  results: LinkStatus | null;
  finance: LinkStatus | null;
  execution: LinkStatus | null;
  initiatives: LinkStatus | null;
}

interface TableInfo {
  id: string;
  name: string;
  fields?: { id: string; name: string; fieldType?: string }[];
}

/* ------------------------------------------------------------------ */
/* Module link section                                                 */
/* ------------------------------------------------------------------ */

const MODULE_CONFIG = {
  results: {
    icon: Target,
    color: 'text-c-success',
    bgColor: 'bg-c-success',
    borderColor: 'border-c-success',
    betaModuleId: 'MODULE_BENEFITS',
  },
  finance: {
    icon: DollarSign,
    color: 'text-c-info',
    bgColor: 'bg-c-info',
    borderColor: 'border-c-info',
    betaModuleId: 'MODULE_ECONOMICS',
  },
  execution: {
    icon: Zap,
    color: 'text-c-accent',
    bgColor: 'bg-c-accent-soft',
    borderColor: 'border-c-accent',
  },
  initiatives: {
    icon: Rocket,
    color: 'text-c-warning',
    bgColor: 'bg-c-warning',
    borderColor: 'border-c-warning',
  },
} as const;

type ModuleKey = keyof typeof MODULE_CONFIG;

const FINANCE_CATEGORIES = ['revenue', 'cost', 'profit', 'budget', 'forecast', 'actual'];
const EXECUTION_FIELDS = ['status', 'assignee', 'due_date', 'priority', 'progress'];
const INITIATIVE_FIELDS = [
  'title',
  'description',
  'owner',
  'status',
  'start_date',
  'end_date',
  'budget',
];

function formatTimeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ModuleLinkSection({
  moduleKey,
  isPl,
  status,
  tables,
  modelId,
  onSyncComplete,
}: {
  moduleKey: ModuleKey;
  isPl: boolean;
  status: LinkStatus | null;
  tables: TableInfo[];
  modelId: string | null;
  onSyncComplete: () => void;
}) {
  const cfg = MODULE_CONFIG[moduleKey];
  const Icon = cfg.icon;
  const [expanded, setExpanded] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);

  const moduleLabels: Record<ModuleKey, { en: string; pl: string }> = {
    results: { en: 'Results', pl: 'Wyniki' },
    finance: { en: 'Finance', pl: 'Finanse' },
    execution: { en: 'Execution', pl: 'Egzekucja' },
    initiatives: { en: 'Initiatives', pl: 'Inicjatywy' },
  };

  const selectedTable = tables.find((t) => t.id === selectedTableId);
  const targetFields =
    moduleKey === 'finance'
      ? FINANCE_CATEGORIES
      : moduleKey === 'execution'
        ? EXECUTION_FIELDS
        : moduleKey === 'initiatives'
          ? INITIATIVE_FIELDS
          : ['kpi_value', 'kpi_target', 'kpi_unit'];

  const handleSync = useCallback(async () => {
    if (!modelId) {
      toast.error(isPl ? 'Wybierz model' : 'Select a model first');
      return;
    }
    setSyncing(true);
    try {
      if (moduleKey === 'results') {
        await Api.publishToResults(modelId, { kpiIds: Object.values(fieldMappings) });
      } else if (moduleKey === 'finance') {
        await Api.syncToFinance(modelId, { fieldMappings, tableId: selectedTableId });
      } else if (moduleKey === 'execution') {
        await Api.syncToExecution(modelId, { fieldMappings, tableId: selectedTableId });
      } else if (moduleKey === 'initiatives') {
        await Api.syncToInitiatives(modelId, { fieldMappings, tableId: selectedTableId });
      }
      toast.success(isPl ? 'Synchronizacja zakończona' : 'Sync completed');
      onSyncComplete();
    } catch {
      toast.error(isPl ? 'Błąd synchronizacji' : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [modelId, moduleKey, fieldMappings, selectedTableId, isPl, onSyncComplete]);

  const inputCls =
    'w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-1.5 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-tag-2';

  return (
    <div className={`rounded-xl border ${cfg.borderColor} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-3 px-4 py-3 ${cfg.bgColor} transition-colors`}
      >
        <Icon size={16} className={cfg.color} />
        <span className={`text-sm font-medium ${cfg.color} flex-1 text-left`}>
          {isPl ? moduleLabels[moduleKey].pl : moduleLabels[moduleKey].en}
        </span>
        {status?.linked && (
          <span className="inline-flex items-center gap-1 text-[10px] text-c-success">
            <CheckCircle2 size={10} /> {isPl ? 'Połączono' : 'Linked'}
          </span>
        )}
        {expanded ? (
          <ChevronUp size={14} className="text-c-text-secondary" />
        ) : (
          <ChevronDown size={14} className="text-c-text-secondary" />
        )}
      </button>

      {/* Status bar */}
      {status && (
        <div className="flex items-center gap-4 px-4 py-2 bg-c-surface border-t border-c-border-subtle">
          <span className="text-[10px] text-c-text-muted">
            {status.linked ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-c-success border border-c-success text-c-success">{isPl ? 'Aktywne' : 'Active'}</span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-c-surface-raised border border-c-border-subtle text-c-text-muted">{isPl ? 'Nieaktywne' : 'Inactive'}</span>
            )}
          </span>
          {status.lastSync && (
            <span className="text-[10px] text-c-text-secondary">
              {isPl ? 'Ost. sync' : 'Last sync'}: {formatTimeAgo(status.lastSync)}
            </span>
          )}
          <span className="text-[10px] text-c-text-secondary">
            {status.recordCount} {isPl ? 'rek.' : 'rec.'}
          </span>
          {status.errors.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-c-danger">
              <XCircle size={10} /> {status.errors.length} {isPl ? 'błędów' : 'errors'}
            </span>
          )}
        </div>
      )}

      {/* Expanded mapping UI */}
      {expanded && (
        <div className="px-4 py-3 space-y-3 border-t border-c-border-subtle">
          {/* Select table */}
          <div>
            <label className="block text-[11px] font-medium text-c-text-muted mb-1">
              {isPl ? 'Tabela źródłowa' : 'Source table'}
            </label>
            <select
              className={inputCls}
              value={selectedTableId}
              onChange={(e) => {
                setSelectedTableId(e.target.value);
                setFieldMappings({});
              }}
            >
              <option value="">{isPl ? '— Wybierz tabelę —' : '— Select table —'}</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Field mapping */}
          {selectedTable && (
            <div>
              <label className="block text-[11px] font-medium text-c-text-muted mb-1">
                {isPl ? 'Mapowanie pól' : 'Field mapping'}
              </label>
              <div className="space-y-1.5">
                {targetFields.map((tf) => (
                  <div key={tf} className="flex items-center gap-2">
                    <span className="text-[11px] text-c-text-muted w-24 truncate">{tf}</span>
                    <ArrowRight size={10} className="text-c-text-secondary flex-shrink-0" />
                    <select
                      className={inputCls}
                      value={fieldMappings[tf] ?? ''}
                      onChange={(e) => setFieldMappings((p) => ({ ...p, [tf]: e.target.value }))}
                    >
                      <option value="">—</option>
                      {(selectedTable.fields ?? []).map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sync button — decision #6 (Harvard): real sync to target modules is
              not implemented (syncToModule only logs metadata to
              tp_module_sync_results, no data lands in Results/Finance). The
              button is disabled until the governed-sync release (FAZA C) so it
              cannot falsely report "sync completed". handleSync is retained for
              the revival. */}
          <button
            disabled
            onClick={handleSync}
            title={
              isPl
                ? 'Synchronizacja danych do modułu docelowego będzie dostępna wkrótce'
                : 'Data sync to the target module is coming soon'
            }
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-c-surface-raised text-c-text-muted cursor-not-allowed transition-colors"
          >
            {isPl ? 'Wkrótce' : 'Coming soon'}
          </button>
          <p className="text-[10px] text-c-text-muted text-center">
            {isPl
              ? 'Mapowanie pól możesz przygotować już teraz — przesył danych włączymy w kolejnym wydaniu.'
              : 'You can prepare the field mapping now — data transfer ships in an upcoming release.'}
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Panel                                                          */
/* ------------------------------------------------------------------ */

interface ConsultifyLinkPanelProps {
  baseId: string;
  tables: TableInfo[];
  modelId?: string | null;
  models?: any[];
  onClose: () => void;
}

export const ConsultifyLinkPanel: React.FC<ConsultifyLinkPanelProps> = ({
  baseId,
  tables,
  modelId: propModelId,
  models: _externalModels,
  onClose,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [models, setModels] = useState<{ model_id: string; name: string }[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>(propModelId ?? '');
  const [statuses, setStatuses] = useState<ModuleLinkStatuses>({
    results: null,
    finance: null,
    execution: null,
    initiatives: null,
  });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await Api.listGovernedModels(baseId);
      setModels(list);
      if (!selectedModelId && list.length > 0) {
        setSelectedModelId(list[0].model_id);
      }
    } catch {
      /* ignore */
    }

    if (selectedModelId) {
      try {
        const s = await Api.getModuleLinkStatus(selectedModelId);
        setStatuses(s);
      } catch {
        /* ignore */
      }
    }
    setLoading(false);
  }, [baseId, selectedModelId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const inputCls =
    'w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-1.5 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-tag-2';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-c-border-subtle">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {isPl ? 'Połączenie z Consultify' : 'Consultify Link'}
          </h3>
          <p className="text-[11px] text-c-text-muted mt-0.5">
            {isPl
              ? 'Połącz dane tabeli z modułami Consultify'
              : 'Connect table data to Consultify modules'}
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-c-surface-raised">
          <X size={16} className="text-c-text-secondary" />
        </button>
      </div>

      {/* Model selector */}
      <div className="px-5 py-3 border-b border-c-border-subtle">
        <label className="block text-[11px] font-medium text-c-text-muted mb-1">
          {isPl ? 'Model danych' : 'Data Model'}
        </label>
        <select
          className={inputCls}
          value={selectedModelId}
          onChange={(e) => setSelectedModelId(e.target.value)}
        >
          <option value="">{isPl ? '— Wybierz model —' : '— Select model —'}</option>
          {models.map((m) => (
            <option key={m.model_id} value={m.model_id}>
              {m.name}
            </option>
          ))}
        </select>
        {models.length === 0 && !loading && (
          <p className="text-[11px] text-c-text-secondary mt-1 italic">
            {isPl
              ? 'Utwórz model danych w zakładce Modele'
              : 'Create a data model in the Models tab first'}
          </p>
        )}
      </div>

      {/* Module links */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-c-text-secondary" size={20} />
          </div>
        ) : (
          (['results', 'finance', 'execution', 'initiatives'] as ModuleKey[])
            .filter((mk) => !isBetaClosed((MODULE_CONFIG[mk] as any).betaModuleId))
            .map((mk) => (
            <ModuleLinkSection
              key={mk}
              moduleKey={mk}
              isPl={isPl}
              status={statuses[mk]}
              tables={tables}
              modelId={selectedModelId || null}
              onSyncComplete={loadData}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ConsultifyLinkPanel;
