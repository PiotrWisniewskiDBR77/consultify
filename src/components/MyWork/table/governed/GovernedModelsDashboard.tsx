/**
 * GovernedModelsDashboard — browse, create, and manage governed data models.
 * Each model aggregates KPIs, dimensions, and source tables with trust metadata.
 */
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Database,
  Layers,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui';
import { LoadingState } from '@/components/ui/primitives';
import * as Api from '@/services/api/tablePlatform.api';

import { DataLineageView } from './DataLineageView';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface KpiDef {
  kpi_id: string;
  code: string;
  label_en: string;
  label_pl?: string;
  formula_type: string;
  unit?: string;
  source_table_id?: string;
  source_field_id?: string;
}

interface DimensionDef {
  dimension_id: string;
  name: string;
  dimension_type: string;
  source_table_id?: string;
  source_field_id?: string;
}

interface ModelSource {
  id: string;
  table_id: string;
  table_name?: string;
  trusted: boolean;
}

interface GovernedModel {
  model_id: string;
  name: string;
  description?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  kpis?: KpiDef[];
  dimensions?: DimensionDef[];
  sources?: ModelSource[];
}

interface KpiValue {
  kpiId: string;
  value: number | null;
  computedAt: string;
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

const TRUST_CONFIG: Record<
  string,
  { label: string; labelPl: string; color: string; icon: React.ReactNode }
> = {
  certified: {
    label: 'Certified',
    labelPl: 'Certyfikowany',
    color: 'text-c-success bg-c-success',
    icon: <ShieldCheck size={12} />,
  },
  draft: {
    label: 'Draft',
    labelPl: 'Szkic',
    color: 'text-c-warning bg-c-warning',
    icon: <AlertTriangle size={12} />,
  },
  deprecated: {
    label: 'Deprecated',
    labelPl: 'Wycofany',
    color: 'text-c-danger bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] bg-c-danger',
    icon: <XCircle size={12} />,
  },
};

function TrustBadge({ status, isPl }: { status?: string; isPl: boolean }) {
  const cfg = TRUST_CONFIG[status ?? 'draft'] ?? TRUST_CONFIG.draft;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.color}`}
    >
      {cfg.icon}
      {isPl ? cfg.labelPl : cfg.label}
    </span>
  );
}

function KpiProgressBar({
  value,
  target,
  unit,
}: {
  value: number | null;
  target?: number;
  unit?: string;
}) {
  if (value === null) return <span className="text-xs text-c-text-secondary">—</span>;
  const pct = target && target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-c-surface-raised rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ backgroundColor: 'var(--c-info)', width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-c-text-muted whitespace-nowrap">
        {value.toLocaleString()}
        {unit ? ` ${unit}` : ''}
        {target ? ` / ${target.toLocaleString()}` : ''}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Wizard                                                              */
/* ------------------------------------------------------------------ */

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface WizardState {
  name: string;
  description: string;
  sourceTables: string[];
  kpis: Array<{
    code: string;
    labelEn: string;
    labelPl: string;
    formulaType: string;
    unit: string;
    targetValue: string;
  }>;
  dimensions: Array<{ name: string; sourceFieldId: string; dimensionType: string }>;
  trustLevel: string;
}

const EMPTY_KPI = {
  code: '',
  labelEn: '',
  labelPl: '',
  formulaType: 'field_sum',
  unit: '',
  targetValue: '',
};
const EMPTY_DIM = { name: '', sourceFieldId: '', dimensionType: 'categorical' };

function CreateModelWizard({
  baseId,
  tables,
  isPl,
  onCreated,
  onClose,
}: {
  baseId: string;
  tables: { id: string; name: string }[];
  isPl: boolean;
  onCreated: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<WizardStep>(1);
  const [saving, setSaving] = useState(false);
  const [wiz, setWiz] = useState<WizardState>({
    name: '',
    description: '',
    sourceTables: [],
    kpis: [{ ...EMPTY_KPI }],
    dimensions: [{ ...EMPTY_DIM }],
    trustLevel: 'draft',
  });

  const canNext = useMemo(() => {
    if (step === 1) return wiz.name.trim().length > 0;
    if (step === 2) return wiz.sourceTables.length > 0;
    return true;
  }, [step, wiz]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const model = await Api.createGovernedModel(baseId, {
        name: wiz.name,
        description: wiz.description,
      });
      const modelId = model.model_id ?? model.modelId;

      for (const tid of wiz.sourceTables) {
        await Api.addModelSource(modelId, {
          tableId: tid,
          trusted: wiz.trustLevel === 'certified',
        });
      }
      for (const k of wiz.kpis.filter((k) => k.code.trim())) {
        await Api.addModelKpi(modelId, {
          code: k.code,
          labelEn: k.labelEn || k.code,
          labelPl: k.labelPl || undefined,
          formulaType: k.formulaType,
          unit: k.unit || undefined,
        });
      }
      for (const d of wiz.dimensions.filter((d) => d.name.trim())) {
        await Api.addModelDimension(modelId, {
          name: d.name,
          dimensionType: d.dimensionType,
        });
      }
      if (wiz.trustLevel !== 'draft') {
        await Api.updateGovernedModel(modelId, { status: wiz.trustLevel });
      }

      toast.success(isPl ? 'Model utworzony' : 'Model created');
      onCreated();
    } catch (err) {
      toast.error(isPl ? 'Błąd tworzenia modelu' : 'Failed to create model');
    } finally {
      setSaving(false);
    }
  }, [baseId, wiz, isPl, onCreated]);

  const stepLabels = isPl
    ? ['Nazwa', 'Źródła', 'KPI', 'Wymiary', 'Zaufanie']
    : ['Name', 'Sources', 'KPIs', 'Dimensions', 'Trust'];

  const inputCls =
    'w-full rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-c-tag-2';

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-[560px] max-w-[95vw] max-h-[85vh] bg-c-bg rounded-2xl shadow-2xl border border-c-border flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-c-border">
          <h3 className="text-sm font-semibold text-c-text">
            {isPl ? 'Nowy model danych' : 'New Data Model'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-c-surface-raised"
          >
            <X size={16} className="text-c-text-secondary" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-5 py-3 border-b border-c-border">
          {stepLabels.map((lbl, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight size={12} className="text-c-text-secondary" />}
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  i + 1 === step
                    ? 'bg-c-tag-2 text-c-tag-2 bg-c-tag-2 text-c-tag-2'
                    : i + 1 < step
                      ? 'text-c-success'
                      : 'text-c-text-secondary'
                }`}
              >
                {lbl}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {step === 1 && (
            <>
              <label className="block text-xs font-medium text-c-text-muted">
                {isPl ? 'Nazwa modelu' : 'Model name'}
              </label>
              <input
                className={inputCls}
                value={wiz.name}
                onChange={(e) => setWiz((p) => ({ ...p, name: e.target.value }))}
                placeholder={isPl ? 'np. Revenue Model' : 'e.g. Revenue Model'}
                autoFocus
              />
              <label className="block text-xs font-medium text-c-text-muted mt-3">
                {isPl ? 'Opis' : 'Description'}
              </label>
              <textarea
                className={inputCls + ' min-h-[80px]'}
                value={wiz.description}
                onChange={(e) => setWiz((p) => ({ ...p, description: e.target.value }))}
                placeholder={isPl ? 'Opcjonalny opis...' : 'Optional description...'}
              />
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-xs text-c-text-muted">
                {isPl ? 'Wybierz tabele źródłowe:' : 'Select source tables:'}
              </p>
              {tables.length === 0 && (
                <p className="text-xs text-c-text-secondary italic">
                  {isPl ? 'Brak tabel' : 'No tables available'}
                </p>
              )}
              <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                {tables.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-c-surface-raised cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={wiz.sourceTables.includes(t.id)}
                      onChange={() =>
                        setWiz((p) => ({
                          ...p,
                          sourceTables: p.sourceTables.includes(t.id)
                            ? p.sourceTables.filter((x) => x !== t.id)
                            : [...p.sourceTables, t.id],
                        }))
                      }
                      className="rounded border-c-border text-c-tag-2"
                    />
                    <Database size={14} className="text-c-text-secondary" />
                    <span className="text-sm text-c-text-muted">{t.name}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-xs text-c-text-muted mb-2">
                {isPl ? 'Zdefiniuj KPI:' : 'Define KPIs:'}
              </p>
              {wiz.kpis.map((k, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-c-border space-y-2 mb-2"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className={inputCls}
                      placeholder={isPl ? 'Kod (np. revenue)' : 'Code (e.g. revenue)'}
                      value={k.code}
                      onChange={(e) => {
                        const kpis = [...wiz.kpis];
                        kpis[idx] = { ...kpis[idx], code: e.target.value };
                        setWiz((p) => ({ ...p, kpis }));
                      }}
                    />
                    <input
                      className={inputCls}
                      placeholder={isPl ? 'Etykieta EN' : 'Label EN'}
                      value={k.labelEn}
                      onChange={(e) => {
                        const kpis = [...wiz.kpis];
                        kpis[idx] = { ...kpis[idx], labelEn: e.target.value };
                        setWiz((p) => ({ ...p, kpis }));
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      className={inputCls}
                      value={k.formulaType}
                      onChange={(e) => {
                        const kpis = [...wiz.kpis];
                        kpis[idx] = { ...kpis[idx], formulaType: e.target.value };
                        setWiz((p) => ({ ...p, kpis }));
                      }}
                    >
                      <option value="field_sum">SUM</option>
                      <option value="field_avg">AVG</option>
                      <option value="field_count">COUNT</option>
                      <option value="expression">Expression</option>
                    </select>
                    <input
                      className={inputCls}
                      placeholder={isPl ? 'Jednostka' : 'Unit'}
                      value={k.unit}
                      onChange={(e) => {
                        const kpis = [...wiz.kpis];
                        kpis[idx] = { ...kpis[idx], unit: e.target.value };
                        setWiz((p) => ({ ...p, kpis }));
                      }}
                    />
                    <input
                      className={inputCls}
                      placeholder={isPl ? 'Cel' : 'Target'}
                      type="number"
                      value={k.targetValue}
                      onChange={(e) => {
                        const kpis = [...wiz.kpis];
                        kpis[idx] = { ...kpis[idx], targetValue: e.target.value };
                        setWiz((p) => ({ ...p, kpis }));
                      }}
                    />
                  </div>
                  {wiz.kpis.length > 1 && (
                    <button
                      onClick={() =>
                        setWiz((p) => ({ ...p, kpis: p.kpis.filter((_, i) => i !== idx) }))
                      }
                      className="text-[11px] text-c-danger hover:underline"
                    >
                      {isPl ? 'Usuń' : 'Remove'}
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setWiz((p) => ({ ...p, kpis: [...p.kpis, { ...EMPTY_KPI }] }))}
                className="inline-flex items-center gap-1 text-xs text-c-tag-2 hover:underline"
              >
                <Plus size={12} /> {isPl ? 'Dodaj KPI' : 'Add KPI'}
              </button>
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-xs text-c-text-muted mb-2">
                {isPl ? 'Zdefiniuj wymiary:' : 'Define dimensions:'}
              </p>
              {wiz.dimensions.map((d, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-c-border space-y-2 mb-2"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className={inputCls}
                      placeholder={isPl ? 'Nazwa wymiaru' : 'Dimension name'}
                      value={d.name}
                      onChange={(e) => {
                        const dims = [...wiz.dimensions];
                        dims[idx] = { ...dims[idx], name: e.target.value };
                        setWiz((p) => ({ ...p, dimensions: dims }));
                      }}
                    />
                    <select
                      className={inputCls}
                      value={d.dimensionType}
                      onChange={(e) => {
                        const dims = [...wiz.dimensions];
                        dims[idx] = { ...dims[idx], dimensionType: e.target.value };
                        setWiz((p) => ({ ...p, dimensions: dims }));
                      }}
                    >
                      <option value="categorical">{isPl ? 'Kategoryczny' : 'Categorical'}</option>
                      <option value="temporal">{isPl ? 'Czasowy' : 'Temporal'}</option>
                      <option value="hierarchical">{isPl ? 'Geograficzny' : 'Geographic'}</option>
                    </select>
                  </div>
                  {wiz.dimensions.length > 1 && (
                    <button
                      onClick={() =>
                        setWiz((p) => ({
                          ...p,
                          dimensions: p.dimensions.filter((_, i) => i !== idx),
                        }))
                      }
                      className="text-[11px] text-c-danger hover:underline"
                    >
                      {isPl ? 'Usuń' : 'Remove'}
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() =>
                  setWiz((p) => ({ ...p, dimensions: [...p.dimensions, { ...EMPTY_DIM }] }))
                }
                className="inline-flex items-center gap-1 text-xs text-c-tag-2 hover:underline"
              >
                <Plus size={12} /> {isPl ? 'Dodaj wymiar' : 'Add dimension'}
              </button>
            </>
          )}

          {step === 5 && (
            <>
              <p className="text-xs text-c-text-muted mb-3">
                {isPl ? 'Ustaw poziom zaufania:' : 'Set trust level:'}
              </p>
              {(['draft', 'certified', 'deprecated'] as const).map((lvl) => {
                const cfg = TRUST_CONFIG[lvl];
                return (
                  <label
                    key={lvl}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-c-surface-raised cursor-pointer mb-1"
                  >
                    <input
                      type="radio"
                      name="trust"
                      checked={wiz.trustLevel === lvl}
                      onChange={() => setWiz((p) => ({ ...p, trustLevel: lvl }))}
                      className="text-c-tag-2"
                    />
                    <span
                      className={`inline-flex items-center gap-1 text-sm font-medium ${cfg.color} px-2 py-0.5 rounded-full`}
                    >
                      {cfg.icon} {isPl ? cfg.labelPl : cfg.label}
                    </span>
                  </label>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-c-border">
          <button
            onClick={() => (step === 1 ? onClose() : setStep((s) => (s - 1) as WizardStep))}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-c-text-muted hover:bg-c-surface-raised"
          >
            {step === 1 ? (isPl ? 'Anuluj' : 'Cancel') : isPl ? 'Wstecz' : 'Back'}
          </button>
          {step < 5 ? (
            <button
              disabled={!canNext}
              onClick={() => setStep((s) => (s + 1) as WizardStep)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-c-tag-2 text-c-text hover:bg-c-tag-2 disabled:opacity-40"
            >
              {isPl ? 'Dalej' : 'Next'}
            </button>
          ) : (
            <button
              disabled={saving}
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-c-tag-2 text-c-text hover:bg-c-tag-2 disabled:opacity-40 inline-flex items-center gap-1"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              {isPl ? 'Utwórz model' : 'Create Model'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Model Card                                                          */
/* ------------------------------------------------------------------ */

function ModelCard({
  model,
  isPl,
  kpiValues,
  onEdit,
  onDelete,
  onSelect,
}: {
  model: GovernedModel;
  isPl: boolean;
  kpiValues: Record<string, KpiValue>;
  onEdit: () => void;
  onDelete: () => void;
  onSelect: () => void;
}) {
  const kpiCount = model.kpis?.length ?? 0;
  const dimCount = model.dimensions?.length ?? 0;
  const sourceCount = model.sources?.length ?? 0;

  return (
    <div
      className="rounded-xl border border-c-border bg-c-surface p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-c-text truncate">
            {model.name}
          </h4>
          {model.description && (
            <p className="text-xs text-c-text-muted mt-0.5 line-clamp-2">
              {model.description}
            </p>
          )}
        </div>
        <TrustBadge status={model.status} isPl={isPl} />
      </div>

      {/* Counters */}
      <div className="flex items-center gap-4 mb-3">
        <span className="inline-flex items-center gap-1 text-[11px] text-c-text-muted">
          <BarChart3 size={12} /> {kpiCount} KPI{kpiCount !== 1 ? 's' : ''}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-c-text-muted">
          <Layers size={12} /> {dimCount} {isPl ? 'wym.' : 'dim.'}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-c-text-muted">
          <Database size={12} /> {sourceCount} {isPl ? 'źr.' : 'src.'}
        </span>
      </div>

      {/* Source tables */}
      {model.sources && model.sources.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {model.sources.slice(0, 3).map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-c-surface-raised text-[10px] text-c-text-muted"
            >
              <Database size={10} />
              {s.table_name || s.table_id.slice(0, 8)}
              {s.trusted && <CheckCircle2 size={10} className="text-c-success" />}
            </span>
          ))}
          {model.sources.length > 3 && (
            <span className="text-[10px] text-c-text-secondary">+{model.sources.length - 3}</span>
          )}
        </div>
      )}

      {/* KPI values preview */}
      {model.kpis && model.kpis.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {model.kpis.slice(0, 3).map((kpi) => {
            const val = kpiValues[kpi.kpi_id];
            return (
              <div key={kpi.kpi_id}>
                <span className="text-[11px] text-c-text-muted">
                  {isPl ? kpi.label_pl || kpi.label_en : kpi.label_en}
                </span>
                <KpiProgressBar value={val?.value ?? null} unit={kpi.unit} />
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-c-border">
        <span className="text-[10px] text-c-text-secondary">
          {model.updated_at
            ? `${isPl ? 'Ost. zmiana' : 'Updated'}: ${new Date(model.updated_at).toLocaleDateString()}`
            : ''}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 rounded hover:bg-c-surface-raised text-c-text-secondary hover:text-c-text-secondary"
            title={isPl ? 'Edytuj' : 'Edit'}
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded hover:bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] hover:bg-c-danger text-c-text-secondary hover:text-c-danger"
            title={isPl ? 'Usuń' : 'Delete'}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Edit Model Modal                                                    */
/* ------------------------------------------------------------------ */

const TRUST_OPTIONS = ['draft', 'certified', 'deprecated'] as const;

function EditModelModal({
  model,
  isPl,
  onSaved,
  onClose,
}: {
  model: GovernedModel;
  isPl: boolean;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(model.name ?? '');
  const [description, setDescription] = useState(model.description ?? '');
  const [status, setStatus] = useState(model.status ?? 'draft');
  const [saving, setSaving] = useState(false);

  const inputCls =
    'w-full rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-crimson-500/40';

  const dirty =
    name.trim() !== (model.name ?? '').trim() ||
    description.trim() !== (model.description ?? '').trim() ||
    status !== (model.status ?? 'draft');

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error(isPl ? 'Nazwa jest wymagana' : 'Name is required');
      return;
    }
    setSaving(true);
    try {
      await Api.updateGovernedModel(model.model_id, {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
      });
      toast.success(isPl ? 'Model zaktualizowany' : 'Model updated');
      onSaved();
    } catch {
      toast.error(isPl ? 'Nie udało się zapisać' : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [name, description, status, model.model_id, isPl, onSaved]);

  const trustLabel = (s: string) =>
    isPl ? (TRUST_CONFIG[s]?.labelPl ?? s) : (TRUST_CONFIG[s]?.label ?? s);

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-[480px] max-w-[95vw] max-h-[85vh] bg-c-bg rounded-2xl shadow-2xl border border-c-border flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-c-border">
          <h3 className="text-sm font-semibold text-c-text">
            {isPl ? 'Edytuj model' : 'Edit model'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-c-surface-raised"
            aria-label={isPl ? 'Zamknij' : 'Close'}
          >
            <X size={16} className="text-c-text-secondary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-c-text-muted mb-1">
              {isPl ? 'Nazwa modelu' : 'Model name'}
            </label>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-c-text-muted mb-1">
              {isPl ? 'Opis' : 'Description'}
            </label>
            <textarea
              className={inputCls + ' min-h-[80px]'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-c-text-muted mb-1">
              {isPl ? 'Poziom zaufania' : 'Trust level'}
            </label>
            <div className="flex flex-wrap gap-2">
              {TRUST_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setStatus(opt)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    status === opt
                      ? 'border-crimson-500 bg-crimson-50 text-crimson-700 dark:bg-crimson-500/10 dark:text-crimson-300'
                      : 'border-c-border text-c-text-muted hover:border-c-border'
                  }`}
                >
                  {TRUST_CONFIG[opt]?.icon}
                  {trustLabel(opt)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-c-border">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            {isPl ? 'Anuluj' : 'Cancel'}
          </Button>
          <Button
            variant="brand"
            size="sm"
            onClick={handleSave}
            disabled={saving || !dirty}
            loading={saving}
          >
            {isPl ? 'Zapisz zmiany' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Dashboard                                                      */
/* ------------------------------------------------------------------ */

interface GovernedModelsDashboardProps {
  baseId: string;
  tables: { id: string; name: string; fields?: { id: string; name: string }[] }[];
  locked?: boolean;
  onOpenTable?: (tableId: string) => void;
}

export const GovernedModelsDashboard: React.FC<GovernedModelsDashboardProps> = ({
  baseId,
  tables,
  locked,
  onOpenTable,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [models, setModels] = useState<GovernedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [showLineage, setShowLineage] = useState(false);
  const [kpiValues, setKpiValues] = useState<Record<string, KpiValue>>({});
  const [selectedModel, setSelectedModel] = useState<GovernedModel | null>(null);
  const [editModel, setEditModel] = useState<GovernedModel | null>(null);

  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      const list = await Api.listGovernedModels(baseId);
      const detailed = await Promise.all(
        list.map(async (m: any) => {
          try {
            return await Api.getGovernedModel(m.model_id);
          } catch {
            return m;
          }
        })
      );
      setModels(detailed);

      const allKpis = detailed.flatMap((m: any) => m.kpis ?? []);
      const values: Record<string, KpiValue> = {};
      await Promise.allSettled(
        allKpis.map(async (k: any) => {
          try {
            const v = await Api.computeKpi(k.kpi_id);
            values[k.kpi_id] = v;
          } catch {
            /* ignore */
          }
        })
      );
      setKpiValues(values);
    } catch {
      toast.error(isPl ? 'Nie udało się załadować modeli' : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, [baseId, isPl]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleDelete = useCallback(
    async (modelId: string) => {
      if (!confirm(isPl ? 'Usunąć model?' : 'Delete this model?')) return;
      try {
        await Api.deleteGovernedModel(modelId);
        toast.success(isPl ? 'Model usunięty' : 'Model deleted');
        loadModels();
      } catch {
        toast.error(isPl ? 'Błąd usuwania' : 'Failed to delete');
      }
    },
    [isPl, loadModels]
  );

  if (loading) {
    return <LoadingState variant="spinner" className="py-16" />;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-c-text">
            {isPl ? 'Modele danych' : 'Data Models'}
          </h2>
          <p className="text-xs text-c-text-muted mt-0.5">
            {isPl
              ? 'Zarządzaj modelami KPI, wymiarami i źródłami danych'
              : 'Manage KPI models, dimensions, and data sources'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLineage(!showLineage)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showLineage
                ? 'bg-c-tag-2 text-c-tag-2 bg-c-tag-2 text-c-tag-2'
                : 'bg-c-surface-raised text-c-text-secondary bg-c-surface-raised text-c-text-muted hover:bg-c-surface-raised'
            }`}
          >
            <Activity size={14} />
            {isPl ? 'Przepływ' : 'Lineage'}
          </button>
          {!locked && (
            <button
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-c-tag-2 text-c-text hover:bg-c-tag-2 transition-colors"
            >
              <Plus size={14} />
              {isPl ? 'Nowy model' : 'New Model'}
            </button>
          )}
        </div>
      </div>

      {/* Lineage view */}
      {showLineage && (
        <DataLineageView baseId={baseId} tables={tables} onClose={() => setShowLineage(false)} />
      )}

      {/* Empty state */}
      {!showLineage && models.length === 0 && (
        <div className="text-center py-12">
          <Layers size={40} className="mx-auto text-c-text-secondary mb-3" />
          <p className="text-sm text-c-text-muted">
            {isPl ? 'Brak modeli danych' : 'No data models yet'}
          </p>
          {!locked && (
            <button
              onClick={() => setShowWizard(true)}
              className="mt-3 inline-flex items-center gap-1 text-xs text-c-tag-2 hover:underline"
            >
              <Plus size={12} /> {isPl ? 'Utwórz pierwszy model' : 'Create your first model'}
            </button>
          )}
        </div>
      )}

      {/* Model grid */}
      {!showLineage && models.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {models.map((m) => (
            <ModelCard
              key={m.model_id}
              model={m}
              isPl={isPl}
              kpiValues={kpiValues}
              onEdit={() => setEditModel(m)}
              onDelete={() => handleDelete(m.model_id)}
              onSelect={() => setSelectedModel(m)}
            />
          ))}
        </div>
      )}

      {/* Detail slide-over for selected model */}
      {selectedModel && (
        <div
          className="fixed inset-0 z-[150] flex items-stretch justify-end bg-black/20 backdrop-blur-[2px]"
          onClick={() => setSelectedModel(null)}
        >
          <div
            className="w-[480px] max-w-[90vw] h-full bg-c-bg border-l border-c-border shadow-2xl overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-c-text">
                {selectedModel.name}
              </h3>
              <button
                onClick={() => setSelectedModel(null)}
                className="p-1 rounded hover:bg-c-surface-raised"
              >
                <X size={16} className="text-c-text-secondary" />
              </button>
            </div>

            {selectedModel.description && (
              <p className="text-xs text-c-text-muted mb-4">
                {selectedModel.description}
              </p>
            )}

            <TrustBadge status={selectedModel.status} isPl={isPl} />

            {/* KPIs */}
            <div className="mt-6">
              <h4 className="text-xs font-semibold text-c-text-muted uppercase tracking-wider mb-2">
                KPIs
              </h4>
              {(selectedModel.kpis ?? []).length === 0 && (
                <p className="text-xs text-c-text-secondary italic">
                  {isPl ? 'Brak KPI' : 'No KPIs defined'}
                </p>
              )}
              <div className="space-y-2">
                {(selectedModel.kpis ?? []).map((kpi) => {
                  const val = kpiValues[kpi.kpi_id];
                  return (
                    <div
                      key={kpi.kpi_id}
                      className="p-3 rounded-lg border border-c-border"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-c-text-muted">
                          {isPl ? kpi.label_pl || kpi.label_en : kpi.label_en}
                        </span>
                        <span className="text-[10px] text-c-text-secondary uppercase">
                          {kpi.formula_type}
                        </span>
                      </div>
                      <KpiProgressBar value={val?.value ?? null} unit={kpi.unit} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dimensions */}
            <div className="mt-6">
              <h4 className="text-xs font-semibold text-c-text-muted uppercase tracking-wider mb-2">
                {isPl ? 'Wymiary' : 'Dimensions'}
              </h4>
              {(selectedModel.dimensions ?? []).length === 0 && (
                <p className="text-xs text-c-text-secondary italic">
                  {isPl ? 'Brak wymiarów' : 'No dimensions'}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {(selectedModel.dimensions ?? []).map((d) => (
                  <span
                    key={d.dimension_id}
                    className="px-2 py-1 rounded-md bg-c-surface-raised text-[11px] text-c-text-muted"
                  >
                    {d.name} <span className="opacity-50">({d.dimension_type})</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Sources */}
            <div className="mt-6">
              <h4 className="text-xs font-semibold text-c-text-muted uppercase tracking-wider mb-2">
                {isPl ? 'Źródła' : 'Sources'}
              </h4>
              {(selectedModel.sources ?? []).length === 0 && (
                <p className="text-xs text-c-text-secondary italic">
                  {isPl ? 'Brak źródeł' : 'No sources'}
                </p>
              )}
              <div className="space-y-1.5">
                {(selectedModel.sources ?? []).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-c-border"
                  >
                    <Database size={14} className="text-c-text-secondary" />
                    <span className="text-xs text-c-text-muted flex-1">
                      {s.table_name || s.table_id}
                    </span>
                    {s.trusted ? (
                      <CheckCircle2 size={14} className="text-c-success" />
                    ) : (
                      <AlertTriangle size={14} className="text-c-warning" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create wizard */}
      {showWizard && (
        <CreateModelWizard
          baseId={baseId}
          tables={tables}
          isPl={isPl}
          onCreated={() => {
            setShowWizard(false);
            loadModels();
          }}
          onClose={() => setShowWizard(false)}
        />
      )}

      {/* Edit model modal */}
      {editModel && (
        <EditModelModal
          model={editModel}
          isPl={isPl}
          onSaved={() => {
            setEditModel(null);
            loadModels();
          }}
          onClose={() => setEditModel(null)}
        />
      )}
    </div>
  );
};

export default GovernedModelsDashboard;
