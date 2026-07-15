/**
 * Command Center — "DLP" (F-CC3, blok Harvey-Parity HP-10…13).
 *
 * Reguły data-loss-prevention: lista (StandardTable, kebab toggle/delete) +
 * formularz dodania reguły + test-scan bez zapisu. Wszystko za flagą
 * `?ff_commandCenter=1` (patrz `commandCenterFlag.ts`) — moduł-rodzic
 * (`AdminCommandCenterPanel`) gejtuje widoczność całej sekcji.
 *
 * Endpointy (`enterpriseComplianceApi.ts`): getDlpRules · createDlpRule ·
 * toggleDlpRule · deleteDlpRule · scanDlpContent.
 */
import { Plus, ScanLine, ShieldAlert, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  createDlpRule,
  deleteDlpRule,
  type DlpRule,
  type DlpRuleInput,
  type DlpScanResult,
  getDlpRules,
  scanDlpContent,
  toggleDlpRule,
} from '../../../services/enterpriseComplianceApi';
import { useConfirmDialog } from '../../MyWork/shared/ConfirmDialog';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../../standard';

const RULE_TYPES: DlpRuleInput['ruleType'][] = ['regex', 'keyword', 'entity'];
const ACTIONS: DlpRuleInput['action'][] = ['block', 'redact', 'warn', 'log'];
const APPLIES_TO: DlpRuleInput['appliesTo'][] = ['input', 'output', 'both'];
const SEVERITIES: DlpRuleInput['severity'][] = ['low', 'medium', 'high', 'critical'];

const emptyForm: DlpRuleInput = {
  ruleName: '',
  ruleType: 'keyword',
  pattern: '',
  action: 'warn',
  appliesTo: 'both',
  severity: 'medium',
};

const selectClass =
  'w-full rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text focus:border-c-focus focus:outline-none focus:ring-1 focus:ring-c-focus';
const inputClass = selectClass;

export const CommandCenterDlpTab: React.FC = () => {
  const { t } = useTranslation();
  const { dialog, confirm } = useConfirmDialog();

  const [rules, setRules] = useState<DlpRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DlpRuleInput>(emptyForm);
  const [creating, setCreating] = useState(false);

  const [scanContent, setScanContent] = useState('');
  const [scanDirection, setScanDirection] = useState<'input' | 'output' | 'both'>('both');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<DlpScanResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDlpRules();
      setRules(data);
    } catch (err: any) {
      setError(err?.message || t('commandCenter.dlp.toasts.loadError', 'Failed to load DLP rules'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const markBusy = (id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!form.ruleName.trim() || !form.pattern.trim()) return;
    setCreating(true);
    try {
      await createDlpRule({
        ...form,
        ruleName: form.ruleName.trim(),
        pattern: form.pattern.trim(),
      });
      toast.success(t('commandCenter.dlp.toasts.created', 'DLP rule created'));
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err: any) {
      toast.error(
        err?.message || t('commandCenter.dlp.toasts.createError', 'Failed to create DLP rule')
      );
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = useCallback(
    async (rule: DlpRule) => {
      markBusy(rule.id, true);
      try {
        await toggleDlpRule(rule.id, !rule.isActive);
        toast.success(
          rule.isActive
            ? t('commandCenter.dlp.toasts.toggledOff', 'Rule disabled')
            : t('commandCenter.dlp.toasts.toggledOn', 'Rule enabled')
        );
        await load();
      } catch (err: any) {
        toast.error(
          err?.message || t('commandCenter.dlp.toasts.toggleError', 'Failed to update DLP rule')
        );
      } finally {
        markBusy(rule.id, false);
      }
    },
    [load, t]
  );

  const handleDelete = useCallback(
    async (rule: DlpRule) => {
      const ok = await confirm({
        title: t('commandCenter.dlp.confirmDelete.title', 'Delete DLP rule?'),
        description: t(
          'commandCenter.dlp.confirmDelete.description',
          'This rule will stop applying to new messages immediately. This cannot be undone.'
        ),
        confirmLabel: t('commandCenter.dlp.actions.delete', 'Delete'),
        cancelLabel: t('commandCenter.dlp.actions.cancel', 'Cancel'),
        variant: 'danger',
      });
      if (!ok) return;
      markBusy(rule.id, true);
      try {
        await deleteDlpRule(rule.id);
        toast.success(t('commandCenter.dlp.toasts.deleted', 'DLP rule deleted'));
        await load();
      } catch (err: any) {
        toast.error(
          err?.message || t('commandCenter.dlp.toasts.deleteError', 'Failed to delete DLP rule')
        );
        markBusy(rule.id, false);
      }
    },
    [confirm, load, t]
  );

  const handleScan = async () => {
    if (!scanContent.trim()) return;
    setScanning(true);
    setScanResult(null);
    try {
      const result = await scanDlpContent(scanContent, scanDirection);
      setScanResult(result);
    } catch (err: any) {
      toast.error(
        err?.message || t('commandCenter.dlp.toasts.scanError', 'Failed to run DLP scan')
      );
    } finally {
      setScanning(false);
    }
  };

  const rows = useMemo<TableRow[]>(() => rules.map((rule) => ({ ...rule, id: rule.id })), [rules]);

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'ruleName',
        label: t('commandCenter.dlp.columns.ruleName', 'Rule'),
        sortable: true,
      },
      {
        id: 'ruleType',
        label: t('commandCenter.dlp.columns.ruleType', 'Type'),
        width: '110px',
        filterable: true,
        filterOptions: RULE_TYPES.map((v) => ({
          value: v,
          label: t(`commandCenter.dlp.form.ruleTypeOptions.${v}`, v),
        })),
      },
      {
        id: 'pattern',
        label: t('commandCenter.dlp.columns.pattern', 'Pattern'),
        render: (row: TableRow) => (
          <code className="rounded bg-c-surface-raised px-1.5 py-0.5 text-xs text-c-text-secondary">
            {String(row.pattern || '')}
          </code>
        ),
      },
      {
        id: 'action',
        label: t('commandCenter.dlp.columns.action', 'Action'),
        width: '110px',
        filterable: true,
        filterOptions: ACTIONS.map((v) => ({
          value: v,
          label: t(`commandCenter.dlp.form.actionOptions.${v}`, v),
        })),
        render: (row: TableRow) =>
          t(`commandCenter.dlp.form.actionOptions.${row.action}`, String(row.action)),
      },
      {
        id: 'appliesTo',
        label: t('commandCenter.dlp.columns.appliesTo', 'Applies to'),
        width: '110px',
        render: (row: TableRow) =>
          t(`commandCenter.dlp.form.appliesToOptions.${row.appliesTo}`, String(row.appliesTo)),
      },
      {
        id: 'severity',
        label: t('commandCenter.dlp.columns.severity', 'Severity'),
        width: '110px',
        filterable: true,
        filterOptions: SEVERITIES.map((v) => ({
          value: v,
          label: t(`commandCenter.dlp.form.severityOptions.${v}`, v),
        })),
        render: (row: TableRow) => (
          <span
            className={
              row.severity === 'critical' || row.severity === 'high'
                ? 'text-c-danger font-medium'
                : 'text-c-text-secondary'
            }
          >
            {t(`commandCenter.dlp.form.severityOptions.${row.severity}`, String(row.severity))}
          </span>
        ),
      },
      {
        id: 'status',
        label: t('commandCenter.dlp.columns.status', 'Status'),
        width: '110px',
        render: (row: TableRow) => (
          <span
            className={
              row.isActive
                ? 'inline-flex items-center rounded-full bg-c-success/15 px-2 py-0.5 text-xs font-medium text-c-success'
                : 'inline-flex items-center rounded-full bg-c-surface-raised px-2 py-0.5 text-xs font-medium text-c-text-muted'
            }
          >
            {row.isActive
              ? t('commandCenter.dlp.status.active', 'Active')
              : t('commandCenter.dlp.status.inactive', 'Inactive')}
          </span>
        ),
      },
    ],
    [t]
  );

  const rowMenu = useCallback(
    (row: TableRow): StandardRowMenu => {
      const rule = row as unknown as DlpRule;
      const isBusy = busyIds.has(rule.id);
      return {
        primary: [
          {
            id: 'toggle',
            label: rule.isActive
              ? t('commandCenter.dlp.actions.toggleDisable', 'Disable')
              : t('commandCenter.dlp.actions.toggleEnable', 'Enable'),
            disabled: isBusy,
            onClick: () => void handleToggle(rule),
          },
        ],
        destructive: {
          label: t('commandCenter.dlp.actions.delete', 'Delete'),
          icon: Trash2,
          onClick: isBusy ? undefined : () => void handleDelete(rule),
        },
      };
    },
    [busyIds, handleToggle, handleDelete, t]
  );

  return (
    <div className="space-y-6">
      {dialog}
      <div className="rounded-2xl border border-c-border bg-c-surface p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-c-text">
              {t('commandCenter.dlp.title', 'Data loss prevention rules')}
            </h3>
            <p className="mt-1 text-sm text-c-text-secondary">
              {t(
                'commandCenter.dlp.description',
                'Regex, keyword, and entity rules applied to model input/output.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-c-text px-3 py-2 text-sm font-medium text-c-bg hover:bg-c-text-secondary"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {t('commandCenter.dlp.actions.addRule', 'Add rule')}
          </button>
        </div>

        {showForm && (
          <div className="mt-4 grid gap-3 rounded-xl border border-c-border bg-c-surface-raised p-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                {t('commandCenter.dlp.form.ruleName', 'Rule name')}
              </label>
              <input
                className={inputClass}
                value={form.ruleName}
                onChange={(e) => setForm((f) => ({ ...f, ruleName: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                {t('commandCenter.dlp.form.pattern', 'Pattern')}
              </label>
              <input
                className={inputClass}
                value={form.pattern}
                onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                {t('commandCenter.dlp.form.ruleType', 'Type')}
              </label>
              <select
                className={selectClass}
                value={form.ruleType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ruleType: e.target.value as DlpRuleInput['ruleType'] }))
                }
              >
                {RULE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {t(`commandCenter.dlp.form.ruleTypeOptions.${v}`, v)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                {t('commandCenter.dlp.form.action', 'Action')}
              </label>
              <select
                className={selectClass}
                value={form.action}
                onChange={(e) =>
                  setForm((f) => ({ ...f, action: e.target.value as DlpRuleInput['action'] }))
                }
              >
                {ACTIONS.map((v) => (
                  <option key={v} value={v}>
                    {t(`commandCenter.dlp.form.actionOptions.${v}`, v)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                {t('commandCenter.dlp.form.appliesTo', 'Applies to')}
              </label>
              <select
                className={selectClass}
                value={form.appliesTo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, appliesTo: e.target.value as DlpRuleInput['appliesTo'] }))
                }
              >
                {APPLIES_TO.map((v) => (
                  <option key={v} value={v}>
                    {t(`commandCenter.dlp.form.appliesToOptions.${v}`, v)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                {t('commandCenter.dlp.form.severity', 'Severity')}
              </label>
              <select
                className={selectClass}
                value={form.severity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, severity: e.target.value as DlpRuleInput['severity'] }))
                }
              >
                {SEVERITIES.map((v) => (
                  <option key={v} value={v}>
                    {t(`commandCenter.dlp.form.severityOptions.${v}`, v)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 md:col-span-2">
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating || !form.ruleName.trim() || !form.pattern.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-c-text px-3 py-2 text-sm font-medium text-c-bg hover:bg-c-text-secondary disabled:opacity-50"
              >
                {t('commandCenter.dlp.actions.create', 'Create rule')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(emptyForm);
                }}
                className="rounded-lg border border-c-border px-3 py-2 text-sm font-medium text-c-text-secondary hover:bg-c-surface"
              >
                {t('commandCenter.dlp.actions.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-c-border bg-c-surface p-2">
        <StandardTable
          columns={columns}
          data={rows}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          empty={{
            icon: ShieldAlert,
            title: t('commandCenter.dlp.empty.title', 'No DLP rules configured'),
            description: t(
              'commandCenter.dlp.empty.description',
              'Add a rule to start scanning input and output content.'
            ),
            actionLabel: t('commandCenter.dlp.actions.addRule', 'Add rule'),
            onAction: () => setShowForm(true),
          }}
          rowMenu={rowMenu}
          persistKey="commandCenter.dlpRules"
        />
      </div>

      <div className="rounded-2xl border border-c-border bg-c-surface p-5">
        <h4 className="text-sm font-semibold text-c-text">
          {t('commandCenter.dlp.scan.title', 'Test scan')}
        </h4>
        <p className="mt-1 text-xs text-c-text-secondary">
          {t(
            'commandCenter.dlp.scan.description',
            'Run the active rule set against sample content without saving it.'
          )}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <textarea
            className="min-h-[88px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text focus:border-c-focus focus:outline-none focus:ring-1 focus:ring-c-focus"
            placeholder={t('commandCenter.dlp.scan.contentPlaceholder', 'Paste content to scan…')}
            value={scanContent}
            onChange={(e) => setScanContent(e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <select
              className={selectClass}
              value={scanDirection}
              onChange={(e) => setScanDirection(e.target.value as typeof scanDirection)}
            >
              {APPLIES_TO.map((v) => (
                <option key={v} value={v}>
                  {t(`commandCenter.dlp.form.appliesToOptions.${v}`, v)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleScan()}
              disabled={scanning || !scanContent.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-c-text px-3 py-2 text-sm font-medium text-c-bg hover:bg-c-text-secondary disabled:opacity-50"
            >
              <ScanLine className="h-4 w-4" />
              {t('commandCenter.dlp.actions.scan', 'Run scan')}
            </button>
          </div>
        </div>

        {scanResult && (
          <div
            className={
              scanResult.clean
                ? 'mt-3 rounded-lg border border-c-success/30 bg-c-success/10 px-3 py-2 text-sm text-c-success'
                : 'mt-3 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-sm text-c-danger'
            }
          >
            {scanResult.clean
              ? t('commandCenter.dlp.scan.clean', 'Clean — no violations')
              : scanResult.blocked
                ? t('commandCenter.dlp.scan.blocked', 'Blocked by {{count}} rule(s)', {
                    count: scanResult.violations.length,
                  })
                : t('commandCenter.dlp.scan.violations', '{{count}} violation(s) found', {
                    count: scanResult.violations.length,
                  })}
            {scanResult.violations.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-c-text-secondary">
                {scanResult.violations.map((v, idx) => (
                  <li key={`${v.ruleId}-${idx}`}>
                    <span className="font-medium">{v.ruleName}</span> ({v.severity}) — {v.action}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommandCenterDlpTab;
