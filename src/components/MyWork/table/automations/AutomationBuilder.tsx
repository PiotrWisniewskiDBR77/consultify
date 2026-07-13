/**
 * AutomationBuilder — form for creating and editing table automations.
 * Supports trigger type selection, trigger config, action list management, and save/cancel.
 */
import {
  ArrowDown,
  ArrowUp,
  Bell,
  Calendar,
  GripVertical,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  Webhook,
  Zap,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CronBuilder } from './CronBuilder';

// ─── Types ───────────────────────────────────────────────────────

export type TriggerType = 'record_created' | 'record_updated' | 'scheduled' | 'webhook_received';
export type ActionType = 'update_record' | 'create_record' | 'send_webhook' | 'send_email';

export interface AutomationAction {
  id: string;
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
}

export interface AutomationFormData {
  name: string;
  description: string;
  triggerType: TriggerType;
  triggerConfig: Record<string, unknown>;
  actions: AutomationAction[];
  enabled: boolean;
}

export interface AutomationBuilderProps {
  initialData?: Partial<AutomationFormData>;
  onSave: (data: AutomationFormData) => void | Promise<void>;
  onCancel: () => void;
  saving?: boolean;
  fields?: Array<{ id: string; name: string; fieldType: string }>;
}

// ─── Constants ───────────────────────────────────────────────────

interface TriggerOption {
  type: TriggerType;
  label: string;
  labelPl: string;
  icon: React.ReactNode;
  description: string;
  descriptionPl: string;
}

const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    type: 'record_created',
    label: 'Record created',
    labelPl: 'Rekord utworzony',
    icon: <Plus className="h-4 w-4" />,
    description: 'Runs when a new record is added',
    descriptionPl: 'Uruchamia się po dodaniu nowego rekordu',
  },
  {
    type: 'record_updated',
    label: 'Record updated',
    labelPl: 'Rekord zaktualizowany',
    icon: <Settings2 className="h-4 w-4" />,
    description: 'Runs when a record is modified',
    descriptionPl: 'Uruchamia się po zmianie rekordu',
  },
  {
    type: 'scheduled',
    label: 'Scheduled',
    labelPl: 'Zaplanowane',
    icon: <Calendar className="h-4 w-4" />,
    description: 'Runs on a cron schedule',
    descriptionPl: 'Uruchamia się wg harmonogramu cron',
  },
  {
    type: 'webhook_received',
    label: 'Webhook received',
    labelPl: 'Webhook odebrany',
    icon: <Webhook className="h-4 w-4" />,
    description: 'Runs when an external webhook is received',
    descriptionPl: 'Uruchamia się po odebraniu webhooka',
  },
];

interface ActionOption {
  type: ActionType;
  label: string;
  labelPl: string;
}

const ACTION_OPTIONS: ActionOption[] = [
  { type: 'update_record', label: 'Update record', labelPl: 'Zaktualizuj rekord' },
  { type: 'create_record', label: 'Create record', labelPl: 'Utwórz rekord' },
  { type: 'send_webhook', label: 'Send webhook', labelPl: 'Wyślij webhook' },
  { type: 'send_email', label: 'Send email', labelPl: 'Wyślij email' },
];

let actionIdCounter = 0;
function nextActionId(): string {
  return `action-${Date.now()}-${++actionIdCounter}`;
}

// ─── Component ───────────────────────────────────────────────────

export const AutomationBuilder: React.FC<AutomationBuilderProps> = ({
  initialData,
  onSave,
  onCancel,
  saving = false,
  fields = [],
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [triggerType, setTriggerType] = useState<TriggerType>(
    initialData?.triggerType ?? 'record_created'
  );
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>(
    initialData?.triggerConfig ?? {}
  );
  const [actions, setActions] = useState<AutomationAction[]>(
    initialData?.actions ?? [{ id: nextActionId(), actionType: 'update_record', actionConfig: {} }]
  );
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (actions.length === 0) return false;
    if (triggerType === 'scheduled' && !triggerConfig.cron) return false;
    return true;
  }, [name, actions, triggerType, triggerConfig]);

  const handleSave = useCallback(() => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      triggerType,
      triggerConfig,
      actions,
      enabled,
    });
  }, [canSave, name, description, triggerType, triggerConfig, actions, enabled, onSave]);

  const addAction = useCallback(() => {
    setActions((prev) => [
      ...prev,
      { id: nextActionId(), actionType: 'create_record', actionConfig: {} },
    ]);
  }, []);

  const removeAction = useCallback((id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const moveAction = useCallback((index: number, direction: -1 | 1) => {
    setActions((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const updateAction = useCallback((id: string, patch: Partial<AutomationAction>) => {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const updateActionConfig = useCallback((id: string, key: string, value: unknown) => {
    setActions((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, actionConfig: { ...a.actionConfig, [key]: value } } : a
      )
    );
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isPl ? 'Nazwa automatyzacji...' : 'Automation name...'}
          className="w-full rounded-lg border border-c-border-subtle bg-c-surface px-4 py-2.5 text-base font-medium border-c-border-subtle bg-c-surface-raised"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={isPl ? 'Opis (opcjonalny)' : 'Description (optional)'}
          rows={2}
          className="w-full resize-none rounded-lg border border-c-border-subtle bg-c-surface px-4 py-2 text-sm border-c-border-subtle bg-c-surface-raised"
        />
      </div>

      {/* Enabled toggle */}
      <div className="flex items-center justify-between rounded-lg border border-c-border-subtle px-4 py-3 border-c-border-subtle">
        <span className="text-sm font-medium">{isPl ? 'Aktywna' : 'Enabled'}</span>
        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            enabled ? 'bg-c-surface' : 'bg-c-surface-raised'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-c-surface shadow transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Trigger type */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-c-text-muted">
          <Zap className="mr-1.5 inline h-4 w-4" />
          {isPl ? 'Wyzwalacz' : 'Trigger'}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {TRIGGER_OPTIONS.map((opt) => {
            const isActive = triggerType === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => {
                  setTriggerType(opt.type);
                  setTriggerConfig({});
                }}
                className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                  isActive
                    ? 'border-c-border-strong bg-c-surface-raised'
                    : 'border-c-border-subtle bg-c-surface hover:border-c-border-subtle'
                }`}
              >
                <span
                  className={`mt-0.5 ${isActive ? 'text-c-text' : 'text-c-text-secondary'}`}
                >
                  {opt.icon}
                </span>
                <div>
                  <p className="text-sm font-medium">{isPl ? opt.labelPl : opt.label}</p>
                  <p className="text-xs text-c-text-muted">
                    {isPl ? opt.descriptionPl : opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Trigger config */}
      <div className="rounded-lg border border-c-border-subtle p-4 border-c-border-subtle">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-c-text-muted">
          {isPl ? 'Konfiguracja wyzwalacza' : 'Trigger configuration'}
        </h4>

        {triggerType === 'scheduled' && (
          <CronBuilder
            value={(triggerConfig.cron as string) || ''}
            onChange={(cron) => setTriggerConfig((prev) => ({ ...prev, cron }))}
            timezone={(triggerConfig.timezone as string) || 'Europe/Warsaw'}
            onTimezoneChange={(tz) => setTriggerConfig((prev) => ({ ...prev, timezone: tz }))}
          />
        )}

        {(triggerType === 'record_created' || triggerType === 'record_updated') && (
          <div className="space-y-3">
            <p className="text-xs text-c-text-muted">
              {isPl
                ? 'Opcjonalnie dodaj warunki filtrujące (pole, operator, wartość).'
                : 'Optionally add filter conditions (field, operator, value).'}
            </p>
            {fields.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-c-text-muted">
                  {isPl ? 'Pole warunkowe' : 'Condition field'}
                </label>
                <select
                  value={(triggerConfig.conditionFieldId as string) || ''}
                  onChange={(e) =>
                    setTriggerConfig((prev) => ({
                      ...prev,
                      conditionFieldId: e.target.value || undefined,
                    }))
                  }
                  className="w-full rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm border-c-border-subtle bg-c-surface-raised"
                >
                  <option value="">{isPl ? '(brak warunku)' : '(no condition)'}</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {triggerType === 'webhook_received' && (
          <p className="text-xs text-c-text-muted">
            {isPl
              ? 'Webhook URL zostanie wygenerowany po zapisaniu automatyzacji.'
              : 'Webhook URL will be generated after saving the automation.'}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-c-text-muted">
            <Bell className="mr-1.5 inline h-4 w-4" />
            {isPl ? 'Akcje' : 'Actions'}
            <span className="ml-1.5 text-xs font-normal text-c-text-secondary">({actions.length})</span>
          </h3>
          <button
            type="button"
            onClick={addAction}
            className="flex items-center gap-1 rounded-md bg-c-surface-raised px-2.5 py-1 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised text-c-text-muted hover:bg-c-surface-raised"
          >
            <Plus className="h-3 w-3" />
            {isPl ? 'Dodaj akcję' : 'Add action'}
          </button>
        </div>

        <div className="space-y-2">
          {actions.map((action, idx) => (
            <div
              key={action.id}
              className="rounded-lg border border-c-border-subtle bg-c-surface p-3 border-c-border-subtle bg-c-surface-raised"
            >
              <div className="mb-2 flex items-center gap-2">
                <GripVertical className="h-4 w-4 flex-shrink-0 text-c-text-secondary" />
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-c-accent text-xs font-bold text-c-accent bg-c-accent-soft text-c-accent">
                  {idx + 1}
                </span>
                <select
                  value={action.actionType}
                  onChange={(e) =>
                    updateAction(action.id, {
                      actionType: e.target.value as ActionType,
                      actionConfig: {},
                    })
                  }
                  className="flex-1 rounded border border-c-border-subtle bg-transparent px-2 py-1 text-sm border-c-border-subtle"
                >
                  {ACTION_OPTIONS.map((opt) => (
                    <option key={opt.type} value={opt.type}>
                      {isPl ? opt.labelPl : opt.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveAction(idx, -1)}
                    disabled={idx === 0}
                    className="rounded p-1 text-c-text-secondary hover:text-c-text-secondary disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveAction(idx, 1)}
                    disabled={idx === actions.length - 1}
                    className="rounded p-1 text-c-text-secondary hover:text-c-text-secondary disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAction(action.id)}
                    disabled={actions.length <= 1}
                    className="rounded p-1 text-c-danger hover:text-c-danger disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Action-specific config */}
              <div className="ml-11 space-y-2">
                {action.actionType === 'send_webhook' && (
                  <input
                    type="url"
                    value={(action.actionConfig.url as string) || ''}
                    onChange={(e) => updateActionConfig(action.id, 'url', e.target.value)}
                    placeholder="https://example.com/webhook"
                    className="w-full rounded border border-c-border-subtle px-2.5 py-1.5 text-sm border-c-border-subtle bg-c-surface-raised"
                  />
                )}
                {action.actionType === 'create_record' && fields.length > 0 && (
                  <p className="text-xs text-c-text-secondary">
                    {isPl
                      ? 'Rekord zostanie utworzony z domyślnymi wartościami.'
                      : 'Record will be created with default values.'}
                  </p>
                )}
                {action.actionType === 'update_record' && fields.length > 0 && (
                  <select
                    value={(action.actionConfig.fieldId as string) || ''}
                    onChange={(e) => updateActionConfig(action.id, 'fieldId', e.target.value)}
                    className="w-full rounded border border-c-border-subtle bg-transparent px-2.5 py-1.5 text-sm border-c-border-subtle"
                  >
                    <option value="">{isPl ? 'Wybierz pole...' : 'Select field...'}</option>
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                )}
                {action.actionType === 'send_email' && (
                  <p className="text-xs text-c-warning">
                    {isPl
                      ? 'Usługa email nie jest jeszcze skonfigurowana.'
                      : 'Email service not yet configured.'}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-c-border-subtle pt-4 border-c-border-subtle">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-c-border-subtle px-4 py-2 text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised border-c-border-subtle text-c-text-muted hover:bg-c-surface-raised"
        >
          {isPl ? 'Anuluj' : 'Cancel'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="flex items-center gap-2 rounded-lg bg-c-text px-4 py-2 text-sm font-medium text-c-surface hover:opacity-90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPl ? 'Zapisz' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default AutomationBuilder;
