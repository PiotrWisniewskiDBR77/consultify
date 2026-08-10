/**
 * SyncManager — Manage data sync configurations between tables.
 * List syncs, create via wizard, trigger manual sync.
 */
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Check,
  ChevronLeft,
  Clock,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';

// ─── Types ───────────────────────────────────────────────────────

interface TableSync {
  id: string;
  source_table_id: string;
  target_table_id: string;
  field_mapping: Record<string, string>;
  sync_mode: 'one_way' | 'two_way';
  filter_config: any | null;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
}

type WizardStep = 'source' | 'target' | 'mapping' | 'schedule' | 'review';

interface SyncManagerProps {
  tableId: string;
  baseId: string;
  tables?: Array<{ id: string; name: string }>;
  fields?: Array<{ id: string; name: string; fieldType: string }>;
  onClose: () => void;
}

const WIZARD_STEPS: { key: WizardStep; en: string }[] = [
  { key: 'source', en: 'Source' },
  { key: 'target', en: 'Target' },
  { key: 'mapping', en: 'Field Mapping' },
  { key: 'schedule', en: 'Schedule & Mode' },
  { key: 'review', en: 'Review' },
];

// ─── Component ───────────────────────────────────────────────────

export const SyncManager: React.FC<SyncManagerProps> = ({
  tableId,
  baseId,
  tables = [],
  fields = [],
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [syncs, setSyncs] = useState<TableSync[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>('source');
  const [sourceType, setSourceType] = useState<'table' | 'csv_url' | 'google_sheets'>('table');
  const [sourceTableId, setSourceTableId] = useState('');
  const [targetTableId, setTargetTableId] = useState(tableId);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [syncMode, setSyncMode] = useState<'one_way' | 'two_way'>('one_way');
  const [creating, setCreating] = useState(false);

  const fetchSyncs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await TablePlatformApi.listTableSyncs(tableId);
      setSyncs(Array.isArray(data) ? data : []);
    } catch {
      toast.error(t('ideas.table.failedToLoadSyncs', 'Failed to load syncs'));
    } finally {
      setLoading(false);
    }
  }, [tableId, isPl]);

  useEffect(() => {
    fetchSyncs();
  }, [fetchSyncs]);

  // Program B (E02) — dwie ścieżki, jedna funkcja rejestru: klik człowieka =
  // `ctx.params.run` (rejestr wykonuje ORYGINALNY callback wprost); Teresa =
  // ta sama funkcja rejestru woła REST bezpośrednio (`runTableSync*Callback`
  // w `ideaActionRegistry.ts`).
  const runSyncAction = (actionId: string, run: () => void, params?: Record<string, unknown>) => {
    const ctx: ActionContext = {
      ideaId: baseId,
      tool: 'table',
      selection: EMPTY_SELECTION,
      surface: 'panel',
      source: 'ui',
      language: isPl ? 'pl' : 'en',
      params: { run, ...(params || {}) },
    };
    void runIdeaAction(actionId, ctx);
  };

  const handleDelete = (syncId: string) => {
    runSyncAction(
      'table.sync.delete',
      async () => {
        try {
          await TablePlatformApi.deleteTableSync(syncId);
          setSyncs((prev) => prev.filter((s) => s.id !== syncId));
          toast.success(t('ideas.table.syncDeleted', 'Sync deleted'));
        } catch {
          toast.error(t('ideas.table.failedToDelete', 'Failed to delete'));
        }
      },
      { syncId }
    );
  };

  const handleSyncNow = (syncId: string) => {
    runSyncAction(
      'table.sync.run_now',
      async () => {
        setSyncingId(syncId);
        try {
          const result = await TablePlatformApi.executeTableSync(syncId);
          toast.success(
            t('ideas.table.syncResult', 'Synced: {{created}} created, {{updated}} updated', {
              created: result?.created ?? 0,
              updated: result?.updated ?? 0,
            })
          );
          await fetchSyncs();
        } catch {
          toast.error(t('ideas.table.syncFailed', 'Sync failed'));
        } finally {
          setSyncingId(null);
        }
      },
      { syncId }
    );
  };

  const handleCreateSync = () => {
    if (!sourceTableId || !targetTableId) {
      toast.error(t('ideas.table.selectSourceAndTarget', 'Select source and target'));
      return;
    }
    const resolvedFieldMapping =
      Object.keys(fieldMapping).length > 0 ? fieldMapping : { '*': '*' };
    runSyncAction(
      'table.sync.create',
      async () => {
        setCreating(true);
        try {
          await TablePlatformApi.createTableSync(
            sourceTableId,
            targetTableId,
            resolvedFieldMapping,
            syncMode
          );
          toast.success(t('ideas.table.syncCreated', 'Sync created'));
          resetWizard();
          await fetchSyncs();
        } catch {
          toast.error(t('ideas.table.failedToCreate', 'Failed to create'));
        } finally {
          setCreating(false);
        }
      },
      { sourceTableId, targetTableId, fieldMapping: resolvedFieldMapping, syncMode }
    );
  };

  const resetWizard = () => {
    setShowWizard(false);
    setWizardStep('source');
    setSourceType('table');
    setSourceTableId('');
    setTargetTableId(tableId);
    setFieldMapping({});
    setSyncMode('one_way');
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(isPl ? 'pl-PL' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(iso);
    }
  };

  const getTableName = (id: string) => {
    const t = tables.find((t) => t.id === id);
    return t?.name ?? id.slice(0, 8) + '…';
  };

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === wizardStep);

  // ─── Wizard view ─────────────────────────────────────────────
  if (showWizard) {
    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-c-border-subtle px-5 py-4 border-c-border-subtle">
          <button
            onClick={resetWizard}
            className="rounded-lg p-1 transition-colors hover:bg-c-surface-raised"
          >
            <ChevronLeft size={16} className="text-c-text-secondary" />
          </button>
          <RefreshCw size={16} className="text-c-info" />
          <h3 className="text-sm font-semibold text-c-text">
            {t('ideas.table.newSync', 'New Sync')}
          </h3>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 border-b border-c-border-subtle px-5 py-3 border-c-border-subtle">
          {WIZARD_STEPS.map((step, idx) => (
            <React.Fragment key={step.key}>
              {idx > 0 && <ArrowRight size={10} className="text-c-text-secondary" />}
              <button
                onClick={() => idx <= stepIndex && setWizardStep(step.key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  idx === stepIndex
                    ? 'bg-c-info text-c-text'
                    : idx < stepIndex
                      ? 'bg-c-info text-c-info bg-c-info text-c-info'
                      : 'text-c-text-secondary'
                }`}
              >
                {t(`ideas.table.syncWizardStep.${step.key}`, step.en)}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-5">
          {wizardStep === 'source' && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-c-text-muted">
                {t('ideas.table.sourceType', 'Source Type')}
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {(['table', 'csv_url', 'google_sheets'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSourceType(type)}
                    className={`rounded-xl border p-3 text-center text-xs font-medium transition-colors ${
                      sourceType === type
                        ? 'border-c-info bg-c-info text-c-info border-c-info bg-c-info text-c-info'
                        : 'border-c-border-subtle text-c-text-secondary hover:border-c-border-subtle text-c-text-muted'
                    }`}
                  >
                    {type === 'table'
                      ? t('ideas.table.table', 'Table')
                      : type === 'csv_url'
                        ? 'CSV URL'
                        : 'Google Sheets'}
                  </button>
                ))}
              </div>

              {sourceType === 'table' && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-c-text-muted">
                    {t('ideas.table.sourceTable', 'Source Table')}
                  </label>
                  <select
                    value={sourceTableId}
                    onChange={(e) => setSourceTableId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm border-c-border-subtle bg-c-surface"
                  >
                    <option value="">{t('ideas.table.selectTable', 'Select table...')}</option>
                    {tables
                      .filter((t) => t.id !== tableId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {sourceType === 'csv_url' && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-c-text-muted">CSV URL</label>
                  <input
                    type="url"
                    value={sourceTableId}
                    onChange={(e) => setSourceTableId(e.target.value)}
                    placeholder="https://example.com/data.csv"
                    className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm border-c-border-subtle bg-c-surface"
                  />
                </div>
              )}

              {sourceType === 'google_sheets' && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-c-text-muted">
                    Google Sheets URL
                  </label>
                  <input
                    type="url"
                    value={sourceTableId}
                    onChange={(e) => setSourceTableId(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm border-c-border-subtle bg-c-surface"
                  />
                </div>
              )}
            </div>
          )}

          {wizardStep === 'target' && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-c-text-muted">
                {t('ideas.table.targetTable', 'Target Table')}
              </h4>
              <select
                value={targetTableId}
                onChange={(e) => setTargetTableId(e.target.value)}
                className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm border-c-border-subtle bg-c-surface"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-c-text-secondary">
                {t(
                  'ideas.table.dataFromTheSourceWillBeSyncedToThisTable',
                  'Data from the source will be synced to this table.'
                )}
              </p>
            </div>
          )}

          {wizardStep === 'mapping' && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-c-text-muted">
                {t('ideas.table.fieldMapping', 'Field Mapping')}
              </h4>
              <p className="text-[11px] text-c-text-secondary">
                {t(
                  'ideas.table.mapSourceFieldsToTargetFieldsLeaveEmptyForAutoMatching',
                  'Map source fields to target fields. Leave empty for auto-matching.'
                )}
              </p>
              {fields.length > 0 ? (
                <div className="space-y-2">
                  {fields.map((f) => (
                    <div key={f.id} className="flex items-center gap-2">
                      <span className="w-1/3 truncate text-xs text-c-text-muted">{f.name}</span>
                      <ArrowRight size={12} className="text-c-text-secondary" />
                      <input
                        type="text"
                        value={fieldMapping[f.id] ?? ''}
                        onChange={(e) =>
                          setFieldMapping((prev) => ({
                            ...prev,
                            [f.id]: e.target.value,
                          }))
                        }
                        placeholder={f.name}
                        className="flex-1 rounded-lg border border-slate-200/60 dark:border-white/[0.03] px-2.5 py-1.5 text-xs border-c-border-subtle bg-c-surface"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-c-border-subtle p-4 text-center text-xs text-c-text-secondary border-c-border-subtle">
                  {t(
                    'ideas.table.fieldsWillBeAutoMatchedByName',
                    'Fields will be auto-matched by name.'
                  )}
                </div>
              )}
            </div>
          )}

          {wizardStep === 'schedule' && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-c-text-muted">
                {t('ideas.table.syncMode', 'Sync Mode')}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSyncMode('one_way')}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-colors ${
                    syncMode === 'one_way'
                      ? 'border-c-info bg-c-info text-c-info border-c-info bg-c-info'
                      : 'border-c-border-subtle text-c-text-secondary hover:border-c-border-subtle'
                  }`}
                >
                  <ArrowRight size={14} />
                  {t('ideas.table.oneWay', 'One-way')}
                </button>
                <button
                  onClick={() => setSyncMode('two_way')}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-colors ${
                    syncMode === 'two_way'
                      ? 'border-c-info bg-c-info text-c-info border-c-info bg-c-info'
                      : 'border-c-border-subtle text-c-text-secondary hover:border-c-border-subtle'
                  }`}
                >
                  <ArrowLeftRight size={14} />
                  {t('ideas.table.twoWay', 'Two-way')}
                </button>
              </div>
            </div>
          )}

          {wizardStep === 'review' && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-c-text-muted">
                {t('ideas.table.summary', 'Summary')}
              </h4>
              <div className="space-y-2 rounded-xl border border-c-border-subtle bg-c-surface-raised p-4 border-c-border-subtle bg-c-surface">
                <Row
                  label={t('ideas.table.source', 'Source')}
                  value={getTableName(sourceTableId)}
                />
                <Row
                  label={t('ideas.table.target', 'Target')}
                  value={getTableName(targetTableId)}
                />
                <Row
                  label={t('ideas.table.mode', 'Mode')}
                  value={
                    syncMode === 'one_way'
                      ? t('ideas.table.oneWay', 'One-way')
                      : t('ideas.table.twoWay', 'Two-way')
                  }
                />
                <Row
                  label={t('ideas.table.fields', 'Fields')}
                  value={
                    Object.keys(fieldMapping).filter((k) => fieldMapping[k]).length > 0
                      ? `${Object.keys(fieldMapping).filter((k) => fieldMapping[k]).length} ${t('ideas.table.mapped', 'mapped')}`
                      : t('ideas.table.autoMatch', 'Auto-match')
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-c-border-subtle px-5 py-3 border-c-border-subtle">
          <button
            onClick={() => {
              if (stepIndex === 0) resetWizard();
              else setWizardStep(WIZARD_STEPS[stepIndex - 1].key);
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-c-text-muted transition-colors hover:text-c-text-secondary"
          >
            {stepIndex === 0 ? t('ideas.table.cancel', 'Cancel') : t('ideas.table.back', 'Back')}
          </button>
          {wizardStep === 'review' ? (
            <button
              onClick={handleCreateSync}
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-c-info px-4 py-1.5 text-xs font-medium text-c-text transition-colors hover:bg-c-info disabled:opacity-50"
            >
              {creating && <Loader2 size={12} className="animate-spin" />}
              {t('ideas.table.createSync', 'Create Sync')}
            </button>
          ) : (
            <button
              onClick={() => setWizardStep(WIZARD_STEPS[stepIndex + 1].key)}
              disabled={wizardStep === 'source' && !sourceTableId}
              className="inline-flex items-center gap-1 rounded-lg bg-c-info px-3 py-1.5 text-xs font-medium text-c-text transition-colors hover:bg-c-info disabled:opacity-50"
            >
              {t('ideas.table.next', 'Next')}
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── List view ───────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-c-border-subtle px-5 py-4 border-c-border-subtle">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:bg-c-surface-raised"
          >
            <ChevronLeft size={16} className="text-c-text-secondary" />
          </button>
          <RefreshCw size={18} className="text-c-info" />
          <h3 className="text-sm font-semibold text-c-text">
            {t('ideas.table.dataSync', 'Data Sync')}
            {syncs.length > 0 && (
              <span className="ml-1 font-normal text-c-text-secondary">({syncs.length})</span>
            )}
          </h3>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-c-info px-2.5 py-1.5 text-xs font-medium text-c-info transition-colors hover:bg-c-info text-c-info hover:bg-c-info"
        >
          <Plus size={12} />
          {t('ideas.table.new', 'New')}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-c-text-secondary" />
          </div>
        ) : syncs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-2xl bg-c-surface-raised p-4 bg-c-surface-raised">
              <RefreshCw size={28} className="text-c-text-muted" />
            </div>
            <p className="mb-1 text-sm font-medium text-c-text-muted">
              {t('ideas.table.noSyncsConfigured', 'No syncs configured')}
            </p>
            <p className="mb-4 max-w-xs text-xs text-c-text-muted">
              {t(
                'ideas.table.syncDataBetweenTablesFromCsvOrGoogleSheets',
                'Sync data between tables, from CSV, or Google Sheets.'
              )}
            </p>
            <button
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-c-info px-4 py-2 text-sm font-medium text-c-text transition-colors hover:bg-c-info"
            >
              <Plus size={14} />
              {t('ideas.table.createSync2', 'Create sync')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {syncs.map((sync) => {
              const isSyncing = syncingId === sync.id;
              return (
                <div
                  key={sync.id}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-4 py-3 transition-colors hover:border-c-border-subtle bg-c-surface hover:border-c-border-subtle"
                >
                  <div className="flex-shrink-0">
                    {sync.sync_mode === 'two_way' ? (
                      <ArrowLeftRight size={16} className="text-c-info" />
                    ) : (
                      <ArrowRight size={16} className="text-c-info" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-c-text">
                      <span className="truncate">{getTableName(sync.source_table_id)}</span>
                      <ArrowRight size={10} className="flex-shrink-0 text-c-text-secondary" />
                      <span className="truncate">{getTableName(sync.target_table_id)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-c-text-muted">
                      <span>
                        {sync.sync_mode === 'two_way'
                          ? t('ideas.table.twoWay', 'Two-way')
                          : t('ideas.table.oneWay', 'One-way')}
                      </span>
                      <span>
                        {t('ideas.table.last', 'Last:')} {formatTime(sync.last_synced_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleSyncNow(sync.id)}
                      disabled={isSyncing}
                      className="rounded-lg p-1.5 text-c-info transition-colors hover:bg-c-info disabled:opacity-50 text-c-info hover:bg-c-info"
                      title={t('ideas.table.syncNow', 'Sync now')}
                    >
                      {isSyncing ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Play size={14} />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(sync.id)}
                      className="rounded-lg p-1.5 text-c-danger transition-colors hover:bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] text-c-danger dark:hover:bg-[color-mix(in_srgb,var(--c-danger)_18%,transparent)]"
                      title={t('ideas.table.delete', 'Delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-[11px] text-c-text-muted">{label}</span>
    <span className="text-xs font-medium text-c-text-muted">{value}</span>
  </div>
);

export default SyncManager;
