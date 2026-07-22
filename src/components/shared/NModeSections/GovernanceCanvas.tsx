/**
 * GovernanceCanvas
 *
 * Shared N-mode section for RACI responsibility matrix, Reminders, and
 * Escalation rules with full CRUD, delivery channel configuration, and
 * optional AI assistance.
 *
 * Used in: Task, Decision, (future) Initiative, Notification
 *
 * The parent owns the data arrays (stakeholders, reminders, escalationRules)
 * and passes them + setters. GovernanceCanvas manages its own editing state
 * (drafts, modals, channel toggles) internally.
 *
 * @see docs/ui-standards/02-components/shared-sections.md
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.5
 */

import { Edit3, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  EscalationRule,
  ReminderRule,
  Stakeholder,
  StakeholderRole,
} from '../../MyWork/shared';

// ── Local types (delivery config — shared across Task & Decision) ──────────

export type IntegrationChannel = 'slack' | 'teams' | 'webhook' | 'jira';
export type CoreDeliveryChannel = 'in_app' | 'email';
export type EscalationMode = 'notify_only' | 'manager_review' | 'executive_alert';

export interface DeliveryConfig {
  coreChannels: CoreDeliveryChannel[];
  integrationChannels: IntegrationChannel[];
  syncTargets: string[];
}

export type ReminderRuleWithDelivery = ReminderRule & { delivery?: DeliveryConfig };

export type EscalationRuleWithConfig = EscalationRule & {
  warningDays: number;
  criticalDays: number;
  escalationMode: EscalationMode;
  delivery: DeliveryConfig;
};

export interface GovernanceUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

// ── Props ──────────────────────────────────────────────────────────────────

export interface GovernanceCanvasProps {
  /** RACI stakeholders */
  stakeholders: Stakeholder[];
  setStakeholders: React.Dispatch<React.SetStateAction<Stakeholder[]>>;

  /** Reminders */
  reminders: ReminderRuleWithDelivery[];
  setReminders: React.Dispatch<React.SetStateAction<ReminderRuleWithDelivery[]>>;

  /** Escalation rules */
  escalationRules: EscalationRuleWithConfig[];
  setEscalationRules: React.Dispatch<React.SetStateAction<EscalationRuleWithConfig[]>>;

  /** Available users for selects */
  users: GovernanceUser[];

  /** Artifact reference id (for new stakeholder's decisionId field) */
  artifactId: string;

  /** Whether UI is read-only / locked */
  locked?: boolean;

  /** AI: suggest RACI team handler (omit to hide) */
  onAISuggestStakeholders?: () => void;
  isSuggestingStakeholders?: boolean;

  /** AI: suggest reminders handler (omit to hide) */
  onAISuggestReminders?: () => void;
  isSuggestingReminders?: boolean;

  /** AI: suggest escalation rules handler (omit to hide) */
  onAISuggestEscalations?: () => void;
  isSuggestingEscalations?: boolean;

  /** AI: auto-fill single stakeholder draft (omit to hide AI button in modal) */
  onAISuggestStakeholderDraft?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const INTEGRATION_CHANNEL_CATALOG: Array<{
  key: IntegrationChannel;
  label: string;
  scope: string;
}> = [
  { key: 'slack', label: 'Slack', scope: 'Real-time messaging' },
  { key: 'teams', label: 'Teams', scope: 'Microsoft Teams channel' },
  { key: 'webhook', label: 'Webhook', scope: 'Custom HTTP hook' },
  { key: 'jira', label: 'Jira', scope: 'Atlassian Jira sync' },
];

const ensureDeliveryConfig = (
  d?: DeliveryConfig | null,
  fallback?: { inAppNotification?: boolean; emailNotification?: boolean }
): DeliveryConfig => ({
  coreChannels: d?.coreChannels ?? [
    ...(fallback?.inAppNotification !== false ? (['in_app'] as CoreDeliveryChannel[]) : []),
    ...(fallback?.emailNotification ? (['email'] as CoreDeliveryChannel[]) : []),
  ],
  integrationChannels: (d?.integrationChannels ?? []) as IntegrationChannel[],
  syncTargets: d?.syncTargets ?? [],
});

const toggleChannel = <T extends string>(list: T[], item: T, shouldAdd: boolean): T[] =>
  shouldAdd ? [...list, item] : list.filter((c) => c !== item);

const normalizeReminderRule = (
  rule: Partial<ReminderRuleWithDelivery>
): ReminderRuleWithDelivery => ({
  id: String(rule.id || Math.random().toString(36).slice(2, 11)),
  type: rule.type === 'after_due' ? 'after_due' : 'before_due',
  days: Math.max(0, Number(rule.days ?? 2)),
  recipients: (['requester', 'decider', 'both', 'stakeholders'] as const).includes(
    rule.recipients as any
  )
    ? (rule.recipients as ReminderRule['recipients'])
    : 'both',
  inAppNotification: rule.inAppNotification !== false,
  emailNotification: !!rule.emailNotification,
  message: String(rule.message || ''),
  enabled: rule.enabled !== false,
  delivery: ensureDeliveryConfig(rule.delivery as DeliveryConfig | undefined, rule as any),
});

const normalizeEscalationRule = (
  rule: Partial<EscalationRuleWithConfig>
): EscalationRuleWithConfig => ({
  id: String(rule.id || Math.random().toString(36).slice(2, 11)),
  enabled: rule.enabled !== false,
  escalateTo: String(rule.escalateTo || ''),
  escalateToName: String(rule.escalateToName || ''),
  afterDays: Math.max(1, Number(rule.afterDays ?? 3)),
  message: String(rule.message || ''),
  warningDays: Math.max(0, Number(rule.warningDays ?? 3)),
  criticalDays: Math.max(0, Number(rule.criticalDays ?? 1)),
  escalationMode: (
    ['notify_only', 'manager_review', 'executive_alert'] as EscalationMode[]
  ).includes(rule.escalationMode as EscalationMode)
    ? (rule.escalationMode as EscalationMode)
    : 'notify_only',
  delivery: ensureDeliveryConfig(rule.delivery as DeliveryConfig | undefined),
});

const deliveryBadgeLabels = (
  d?: DeliveryConfig | null,
  fallback?: { inAppNotification?: boolean; emailNotification?: boolean }
): string[] => {
  const cfg = ensureDeliveryConfig(d, fallback);
  const labels: string[] = [];
  if (cfg.coreChannels.includes('in_app')) labels.push('In-app');
  if (cfg.coreChannels.includes('email')) labels.push('Email');
  cfg.integrationChannels.forEach((ch) => labels.push(ch.charAt(0).toUpperCase() + ch.slice(1)));
  if (cfg.syncTargets.length > 0) labels.push(`Sync(${cfg.syncTargets.length})`);
  return labels;
};

// ── CSS tokens ─────────────────────────────────────────────────────────────

const TABLE_CARD =
  'bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200/60 dark:border-navy-700/60 p-4 space-y-3 h-[340px] flex flex-col';
const MODAL_OVERLAY = 'fixed inset-0 z-[120] flex items-center justify-center p-4';
const MODAL_CLASS =
  'relative w-full max-w-2xl rounded-3xl border border-slate-200/50 dark:border-navy-700/50 bg-white/95 dark:bg-navy-900/95 shadow-2xl p-6 space-y-5';
const MODAL_HINT =
  'rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 px-3 py-2 text-xs text-slate-600 dark:text-slate-300';
const CHANNEL_CHIP =
  'px-2 py-1 rounded-md border text-[11px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const ADD_BTN =
  'px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-500 hover:text-c-text hover:border-c-border-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const AI_BTN =
  'px-2.5 py-1 rounded-lg text-xs font-medium border border-c-info/40 text-c-info hover:text-c-info hover:border-c-info/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1';
const TH =
  'text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500 border-b border-slate-200/50 dark:border-navy-700/50';
const BADGE =
  'px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/50 text-[10px] text-slate-500 dark:text-slate-400';

// ── Component ──────────────────────────────────────────────────────────────

export const GovernanceCanvas: React.FC<GovernanceCanvasProps> = ({
  stakeholders,
  setStakeholders,
  reminders,
  setReminders,
  escalationRules,
  setEscalationRules,
  users,
  artifactId,
  locked = false,
  onAISuggestStakeholders,
  isSuggestingStakeholders = false,
  onAISuggestReminders,
  isSuggestingReminders = false,
  onAISuggestEscalations,
  isSuggestingEscalations = false,
  onAISuggestStakeholderDraft,
}) => {
  const { t } = useTranslation();

  // ── Internal editing state ──

  const [editingStakeholderId, setEditingStakeholderId] = useState<string | null>(null);
  const [stakeholderDraft, setStakeholderDraft] = useState<Stakeholder | null>(null);

  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [reminderDraft, setReminderDraft] = useState<ReminderRuleWithDelivery | null>(null);

  const [editingEscalationId, setEditingEscalationId] = useState<string | null>(null);
  const [escalationDraft, setEscalationDraft] = useState<EscalationRuleWithConfig | null>(null);

  // ── Label helpers ──

  const stakeholderRoleLabel = (role: StakeholderRole): string => {
    const known: StakeholderRole[] = ['responsible', 'accountable', 'consulted', 'informed'];
    const key = known.includes(role) ? role : 'consulted';
    return t(`sharedComponents.governanceCanvas.stakeholderRole.${key}`);
  };

  const stakeholderChannelLabels = (ns: Stakeholder['notificationSettings']): string[] => {
    const labels: string[] = [];
    if (!ns.enabled) {
      labels.push(t('sharedComponents.governanceCanvas.disabled'));
      return labels;
    }
    if (ns.inAppEnabled) labels.push('In-app');
    if (ns.emailEnabled) labels.push('Email');
    (ns.integrationChannels || []).forEach((ch) =>
      labels.push(ch.charAt(0).toUpperCase() + ch.slice(1))
    );
    return labels.length > 0 ? labels : [t('sharedComponents.governanceCanvas.none')];
  };

  const escalationModeOptions: Array<{ value: EscalationMode; label: string }> = [
    { value: 'notify_only', label: t('sharedComponents.governanceCanvas.notifyOnly') },
    { value: 'manager_review', label: t('sharedComponents.governanceCanvas.managerReview') },
    { value: 'executive_alert', label: t('sharedComponents.governanceCanvas.executiveAlert') },
  ];

  const escalationModeLabel = (mode: EscalationMode): string => {
    const found = escalationModeOptions.find((o) => o.value === mode);
    return found ? found.label : mode;
  };

  // ── Create helpers ──

  const createStakeholder = () => {
    const fallbackUser = users[0];
    if (!fallbackUser) return;
    setEditingStakeholderId('__new__');
    setStakeholderDraft({
      id: '__new__',
      decisionId: artifactId || 'new',
      userId: fallbackUser.id,
      userName: `${fallbackUser.firstName} ${fallbackUser.lastName}`,
      userEmail: fallbackUser.email,
      role: 'consulted',
      notificationSettings: {
        enabled: true,
        triggers: ['on_status_change'],
        emailEnabled: false,
        inAppEnabled: true,
        integrationChannels: [],
        syncTargets: [],
      },
    });
  };

  const createReminder = () => {
    setEditingReminderId('__new__');
    setReminderDraft({
      id: '__new__',
      type: 'before_due',
      days: 2,
      recipients: 'both',
      inAppNotification: true,
      emailNotification: false,
      delivery: ensureDeliveryConfig({
        coreChannels: ['in_app'],
        integrationChannels: [],
        syncTargets: [],
      }),
      message: '',
      enabled: true,
    });
  };

  const createEscalation = () => {
    setEscalationDraft(
      normalizeEscalationRule({
        id: Math.random().toString(36).slice(2, 11),
        enabled: true,
        escalateTo: users[0]?.id || '',
        escalateToName: users[0] ? `${users[0].firstName} ${users[0].lastName}` : '',
        afterDays: 3,
        warningDays: 3,
        criticalDays: 1,
        escalationMode: 'manager_review',
        delivery: ensureDeliveryConfig({
          coreChannels: ['in_app', 'email'],
          integrationChannels: [],
          syncTargets: [],
        }),
        message: '',
      })
    );
    setEditingEscalationId('__new__');
  };

  // ── Save helpers ──

  const saveStakeholder = () => {
    if (!stakeholderDraft) return;
    if (editingStakeholderId === '__new__') {
      setStakeholders((prev) => [
        ...prev,
        { ...stakeholderDraft, id: Math.random().toString(36).slice(2, 11) },
      ]);
    } else {
      setStakeholders((prev) =>
        prev.map((item) =>
          item.id === editingStakeholderId ? { ...stakeholderDraft, id: item.id } : item
        )
      );
    }
    setEditingStakeholderId(null);
    setStakeholderDraft(null);
  };

  const saveReminder = () => {
    if (!reminderDraft) return;
    const normalized = normalizeReminderRule(reminderDraft);
    if (editingReminderId === '__new__') {
      setReminders((prev) => [
        ...prev,
        { ...normalized, id: Math.random().toString(36).slice(2, 11) },
      ]);
    } else {
      setReminders((prev) =>
        prev.map((item) => (item.id === editingReminderId ? { ...normalized, id: item.id } : item))
      );
    }
    setEditingReminderId(null);
    setReminderDraft(null);
  };

  const saveEscalation = () => {
    if (!escalationDraft) return;
    const normalized = normalizeEscalationRule(escalationDraft);
    if (editingEscalationId === '__new__') {
      setEscalationRules((prev) => [
        ...prev,
        { ...normalized, id: Math.random().toString(36).slice(2, 11) },
      ]);
    } else {
      setEscalationRules((prev) =>
        prev.map((item) =>
          item.id === editingEscalationId ? { ...normalized, id: item.id } : item
        )
      );
    }
    setEditingEscalationId(null);
    setEscalationDraft(null);
  };

  // ── Channel chip builder ──

  const ChannelChips: React.FC<{
    label: string;
    channels: Array<{ key: string; label: string; scope?: string }>;
    selected: string[];
    onToggle: (key: string, next: boolean) => void;
  }> = ({ label, channels, selected, onToggle }) => (
    <div className="rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {channels.map((ch) => {
          const isSelected = selected.includes(ch.key);
          return (
            <button
              key={ch.key}
              type="button"
              disabled={locked}
              onClick={() => onToggle(ch.key, !isSelected)}
              className={`${CHANNEL_CHIP} ${
                isSelected
                  ? 'border-c-border text-c-text bg-c-surface-raised'
                  : 'border-slate-300/70 text-slate-500 hover:border-slate-400/80'
              }`}
              title={ch.scope}
            >
              {ch.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Render ──

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
        {t('sharedComponents.governanceCanvas.raciEscalation')}
      </h2>

      <div className="space-y-4">
        {/* ── RACI table ── */}
        <div className={TABLE_CARD}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-100">
              {t('sharedComponents.governanceCanvas.raciResponsibilityMatrix')}
            </h3>
            <div className="inline-flex items-center gap-2">
              {onAISuggestStakeholders && (
                <button
                  disabled={locked || isSuggestingStakeholders}
                  onClick={onAISuggestStakeholders}
                  className={AI_BTN}
                >
                  {isSuggestingStakeholders ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  {t('sharedComponents.governanceCanvas.generateRaci')}
                </button>
              )}
              <button disabled={locked} onClick={createStakeholder} className={ADD_BTN}>
                + {t('sharedComponents.governanceCanvas.addPerson')}
              </button>
            </div>
          </div>
          <div className="overflow-auto flex-1">
            <table
              /* §27-exempt: macierz/komorki kalkulacyjne, osobny spec matrix-editor */ className="w-full text-sm"
            >
              <thead>
                <tr className={TH}>
                  <th className="text-left py-2 pr-2">
                    {t('sharedComponents.governanceCanvas.person')}
                  </th>
                  <th className="text-left py-2 pr-2">
                    {t('sharedComponents.governanceCanvas.role')}
                  </th>
                  <th className="text-left py-2 pr-2">Email</th>
                  <th className="text-left py-2 pr-2">
                    {t('sharedComponents.governanceCanvas.notifications')}
                  </th>
                  <th className="text-right py-2">
                    {t('sharedComponents.governanceCanvas.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                {stakeholders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-slate-600">
                      {t('sharedComponents.governanceCanvas.noStakeholdersYet')}
                    </td>
                  </tr>
                ) : (
                  stakeholders.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2 pr-2 text-slate-700 dark:text-slate-300">
                        {s.userName || s.userId}
                      </td>
                      <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                        {stakeholderRoleLabel(s.role)}
                      </td>
                      <td className="py-2 pr-2 text-slate-500 dark:text-slate-400">
                        {s.userEmail || '—'}
                      </td>
                      <td className="py-2 pr-2 text-xs">
                        <div className="flex flex-wrap gap-1">
                          {stakeholderChannelLabels(s.notificationSettings).map((label) => (
                            <span key={`${s.id}-${label}`} className={BADGE}>
                              {label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            disabled={locked}
                            onClick={() => {
                              setEditingStakeholderId(s.id);
                              setStakeholderDraft({ ...s });
                            }}
                            className="p-1 text-slate-600 hover:text-c-text disabled:opacity-40"
                            title={t('sharedComponents.governanceCanvas.edit')}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            disabled={locked}
                            onClick={() =>
                              setStakeholders((prev) => prev.filter((item) => item.id !== s.id))
                            }
                            className="p-1 text-slate-600 hover:text-danger-500 disabled:opacity-40"
                            title={t('sharedComponents.governanceCanvas.delete')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Reminders table ── */}
        <div className={TABLE_CARD}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-100">
              {t('sharedComponents.governanceCanvas.reminders')}
            </h3>
            <div className="inline-flex items-center gap-2">
              {onAISuggestReminders && (
                <button
                  disabled={locked || isSuggestingReminders}
                  onClick={onAISuggestReminders}
                  className={AI_BTN}
                >
                  {isSuggestingReminders ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  AI
                </button>
              )}
              <button disabled={locked} onClick={createReminder} className={ADD_BTN}>
                + {t('sharedComponents.governanceCanvas.addReminder')}
              </button>
            </div>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className={TH}>
                  <th className="text-left py-2 pr-2">
                    {t('sharedComponents.governanceCanvas.type')}
                  </th>
                  <th className="text-left py-2 pr-2">
                    {t('sharedComponents.governanceCanvas.days')}
                  </th>
                  <th className="text-left py-2 pr-2">
                    {t('sharedComponents.governanceCanvas.recipients')}
                  </th>
                  <th className="text-left py-2 pr-2">
                    {t('sharedComponents.governanceCanvas.notifications')}
                  </th>
                  <th className="text-right py-2">
                    {t('sharedComponents.governanceCanvas.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                {reminders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-slate-600">
                      {t('sharedComponents.governanceCanvas.noRemindersYet')}
                    </td>
                  </tr>
                ) : (
                  reminders.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                        {r.type === 'before_due'
                          ? t('sharedComponents.governanceCanvas.beforeDue')
                          : t('sharedComponents.governanceCanvas.afterDue')}
                      </td>
                      <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                        {r.days}
                      </td>
                      <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                        {r.recipients}
                      </td>
                      <td className="py-2 pr-2 text-xs">
                        <div className="flex flex-wrap gap-1">
                          {!r.enabled && (
                            <span className={BADGE}>
                              {t('sharedComponents.governanceCanvas.disabled')}
                            </span>
                          )}
                          {deliveryBadgeLabels(r.delivery, r).map((label) => (
                            <span key={`${r.id}-${label}`} className={BADGE}>
                              {label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            disabled={locked}
                            onClick={() => {
                              setEditingReminderId(r.id);
                              setReminderDraft(normalizeReminderRule({ ...r }));
                            }}
                            className="p-1 text-slate-600 hover:text-c-text disabled:opacity-40"
                            title={t('sharedComponents.governanceCanvas.edit')}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            disabled={locked}
                            onClick={() =>
                              setReminders((prev) => prev.filter((item) => item.id !== r.id))
                            }
                            className="p-1 text-slate-600 hover:text-danger-500 disabled:opacity-40"
                            title={t('sharedComponents.governanceCanvas.delete')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Escalation table ── */}
        <div className={TABLE_CARD}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-100">
              {t('sharedComponents.governanceCanvas.escalationAndRules')}
            </h3>
            <div className="inline-flex items-center gap-2">
              {onAISuggestEscalations && (
                <button
                  disabled={locked || isSuggestingEscalations}
                  onClick={onAISuggestEscalations}
                  className={AI_BTN}
                >
                  {isSuggestingEscalations ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  AI
                </button>
              )}
              <button disabled={locked} onClick={createEscalation} className={ADD_BTN}>
                + {t('sharedComponents.governanceCanvas.addEscalation')}
              </button>
            </div>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className={TH}>
                  <th className="text-left py-2 pr-2">Status</th>
                  <th className="text-left py-2 pr-2">
                    {t('sharedComponents.governanceCanvas.wCThresholds')}
                  </th>
                  <th className="text-left py-2 pr-2">
                    {t('sharedComponents.governanceCanvas.escalateAfter')}
                  </th>
                  <th className="text-left py-2 pr-2">
                    {t('sharedComponents.governanceCanvas.escalateTo')}
                  </th>
                  <th className="text-left py-2 pr-2">
                    {t('sharedComponents.governanceCanvas.message')}
                  </th>
                  <th className="text-left py-2 pr-2">
                    {t('sharedComponents.governanceCanvas.mode')}
                  </th>
                  <th className="text-left py-2 pr-2">
                    {t('sharedComponents.governanceCanvas.channels')}
                  </th>
                  <th className="text-right py-2">
                    {t('sharedComponents.governanceCanvas.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                {escalationRules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-xs text-slate-600">
                      {t('sharedComponents.governanceCanvas.noEscalationRulesYet')}
                    </td>
                  </tr>
                ) : (
                  escalationRules.map((rule) => (
                    <tr key={rule.id}>
                      <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                        {rule.enabled
                          ? t('sharedComponents.governanceCanvas.enabled')
                          : t('sharedComponents.governanceCanvas.escalationDisabledState')}
                      </td>
                      <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                        {rule.warningDays}/{rule.criticalDays} d
                      </td>
                      <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                        {rule.afterDays} d
                      </td>
                      <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                        {rule.escalateToName || '—'}
                      </td>
                      <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                        {rule.message || '—'}
                      </td>
                      <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                        {escalationModeLabel(rule.escalationMode)}
                      </td>
                      <td className="py-2 pr-2 text-xs">
                        <div className="flex flex-wrap gap-1">
                          {deliveryBadgeLabels(rule.delivery).map((label) => (
                            <span key={`${rule.id}-ch-${label}`} className={BADGE}>
                              {label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            disabled={locked}
                            onClick={() => {
                              setEditingEscalationId(rule.id);
                              setEscalationDraft({ ...rule });
                            }}
                            className="p-1 text-slate-600 hover:text-c-text disabled:opacity-40"
                            title={t('sharedComponents.governanceCanvas.edit')}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            disabled={locked}
                            onClick={() =>
                              setEscalationRules((prev) =>
                                prev.filter((item) => item.id !== rule.id)
                              )
                            }
                            className="p-1 text-slate-600 hover:text-danger-500 disabled:opacity-40"
                            title={t('sharedComponents.governanceCanvas.delete')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
       *  MODALS
       * ═══════════════════════════════════════════════════════════════════ */}

      {/* ── Stakeholder modal ── */}
      {stakeholderDraft && (
        <div className={MODAL_OVERLAY}>
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setEditingStakeholderId(null);
              setStakeholderDraft(null);
            }}
          />
          <div className={`${MODAL_CLASS} min-h-[380px]`}>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {editingStakeholderId === '__new__'
                  ? t('sharedComponents.governanceCanvas.addRaciPerson')
                  : t('sharedComponents.governanceCanvas.editRaciPerson')}
              </h4>
              <div className="inline-flex items-center gap-2">
                {onAISuggestStakeholderDraft && (
                  <button
                    disabled={locked || isSuggestingStakeholders}
                    onClick={onAISuggestStakeholderDraft}
                    className={AI_BTN}
                  >
                    {isSuggestingStakeholders ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    AI
                  </button>
                )}
                <button
                  className="p-1 text-slate-600 hover:text-slate-600"
                  onClick={() => {
                    setEditingStakeholderId(null);
                    setStakeholderDraft(null);
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className={MODAL_HINT}>
              {t('sharedComponents.governanceCanvas.stakeholderModalHint')}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-slate-500 dark:text-slate-400">
                {t('sharedComponents.governanceCanvas.person')}
                <select
                  value={stakeholderDraft.userId}
                  onChange={(e) => {
                    const selected = users.find((u) => u.id === e.target.value);
                    setStakeholderDraft({
                      ...stakeholderDraft,
                      userId: e.target.value,
                      userName: selected
                        ? `${selected.firstName} ${selected.lastName}`
                        : stakeholderDraft.userName,
                      userEmail: selected?.email || stakeholderDraft.userEmail,
                    });
                  }}
                  className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-500 dark:text-slate-400">
                {t('sharedComponents.governanceCanvas.role')}
                <select
                  value={stakeholderDraft.role}
                  onChange={(e) =>
                    setStakeholderDraft({
                      ...stakeholderDraft,
                      role: e.target.value as StakeholderRole,
                    })
                  }
                  className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                >
                  <option value="responsible">Responsible</option>
                  <option value="accountable">Accountable</option>
                  <option value="consulted">Consulted</option>
                  <option value="informed">Informed</option>
                </select>
              </label>
            </div>
            <div className="space-y-2 flex-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('sharedComponents.governanceCanvas.notificationChannels')}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ChannelChips
                  label={t('sharedComponents.governanceCanvas.coreChannels')}
                  channels={[
                    {
                      key: 'enabled',
                      label: t('sharedComponents.governanceCanvas.channelEnabledChip'),
                    },
                    { key: 'in_app', label: 'In-app' },
                    { key: 'email', label: 'Email' },
                  ]}
                  selected={[
                    ...(stakeholderDraft.notificationSettings.enabled ? ['enabled'] : []),
                    ...(stakeholderDraft.notificationSettings.inAppEnabled ? ['in_app'] : []),
                    ...(stakeholderDraft.notificationSettings.emailEnabled ? ['email'] : []),
                  ]}
                  onToggle={(key, next) => {
                    const ns = { ...stakeholderDraft.notificationSettings };
                    if (key === 'enabled') ns.enabled = next;
                    if (key === 'in_app') ns.inAppEnabled = next;
                    if (key === 'email') ns.emailEnabled = next;
                    setStakeholderDraft({ ...stakeholderDraft, notificationSettings: ns });
                  }}
                />
                <ChannelChips
                  label={t('sharedComponents.governanceCanvas.integrationChannels')}
                  channels={INTEGRATION_CHANNEL_CATALOG.map((ch) => ({
                    key: ch.key,
                    label: ch.label,
                    scope: ch.scope,
                  }))}
                  selected={[...(stakeholderDraft.notificationSettings.integrationChannels || [])]}
                  onToggle={(key, next) => {
                    const current = stakeholderDraft.notificationSettings.integrationChannels || [];
                    const nextList = next
                      ? [...current, key]
                      : current.filter((c: string) => c !== key);
                    setStakeholderDraft({
                      ...stakeholderDraft,
                      notificationSettings: {
                        ...stakeholderDraft.notificationSettings,
                        integrationChannels: nextList as any,
                      },
                    });
                  }}
                />
              </div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block">
                {t('sharedComponents.governanceCanvas.syncTargets')}
                <input
                  value={(stakeholderDraft.notificationSettings.syncTargets || []).join(', ')}
                  onChange={(e) =>
                    setStakeholderDraft({
                      ...stakeholderDraft,
                      notificationSettings: {
                        ...stakeholderDraft.notificationSettings,
                        syncTargets: e.target.value
                          .split(',')
                          .map((item: string) => item.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                  className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                  placeholder="slack:#ops, jira:DRD"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditingStakeholderId(null);
                  setStakeholderDraft(null);
                }}
                className="px-3 py-1.5 rounded-md text-xs border border-slate-300/60 dark:border-navy-600 text-slate-500"
              >
                {t('sharedComponents.governanceCanvas.cancel')}
              </button>
              <button
                onClick={saveStakeholder}
                className="px-3 py-1.5 rounded-md text-xs bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800"
              >
                {t('sharedComponents.governanceCanvas.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reminder modal ── */}
      {reminderDraft && (
        <div className={MODAL_OVERLAY}>
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setEditingReminderId(null);
              setReminderDraft(null);
            }}
          />
          <div className={`${MODAL_CLASS} min-h-[380px]`}>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {editingReminderId === '__new__'
                  ? t('sharedComponents.governanceCanvas.addReminder')
                  : t('sharedComponents.governanceCanvas.editReminder')}
              </h4>
              <div className="inline-flex items-center gap-2">
                {onAISuggestReminders && (
                  <button
                    disabled={locked || isSuggestingReminders}
                    onClick={onAISuggestReminders}
                    className={AI_BTN}
                  >
                    {isSuggestingReminders ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    AI
                  </button>
                )}
                <button
                  className="p-1 text-slate-600 hover:text-slate-600"
                  onClick={() => {
                    setEditingReminderId(null);
                    setReminderDraft(null);
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className={MODAL_HINT}>
              {t('sharedComponents.governanceCanvas.reminderModalHint')}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-slate-500 dark:text-slate-400">
                {t('sharedComponents.governanceCanvas.type')}
                <select
                  value={reminderDraft.type}
                  onChange={(e) =>
                    setReminderDraft({
                      ...reminderDraft,
                      type: e.target.value as 'before_due' | 'after_due',
                    })
                  }
                  className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                >
                  <option value="before_due">
                    {t('sharedComponents.governanceCanvas.beforeDue')}
                  </option>
                  <option value="after_due">
                    {t('sharedComponents.governanceCanvas.afterDue')}
                  </option>
                </select>
              </label>
              <label className="text-xs text-slate-500 dark:text-slate-400">
                {t('sharedComponents.governanceCanvas.days')}
                <input
                  type="number"
                  min={0}
                  value={reminderDraft.days}
                  onChange={(e) =>
                    setReminderDraft({ ...reminderDraft, days: Number(e.target.value) || 0 })
                  }
                  className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                />
              </label>
            </div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block">
              {t('sharedComponents.governanceCanvas.recipientsLabel')}
              <select
                value={reminderDraft.recipients}
                onChange={(e) =>
                  setReminderDraft({ ...reminderDraft, recipients: e.target.value as any })
                }
                className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
              >
                <option value="both">{t('sharedComponents.governanceCanvas.both')}</option>
                <option value="stakeholders">
                  {t('sharedComponents.governanceCanvas.stakeholders')}
                </option>
                <option value="owner">Owner</option>
              </select>
            </label>
            <div className="space-y-3">
              <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={reminderDraft.enabled}
                  onChange={(e) =>
                    setReminderDraft({ ...reminderDraft, enabled: e.target.checked })
                  }
                />
                {t('sharedComponents.governanceCanvas.ruleEnabled')}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ChannelChips
                  label={t('sharedComponents.governanceCanvas.coreChannels')}
                  channels={[
                    { key: 'in_app', label: 'In-app' },
                    { key: 'email', label: 'Email' },
                  ]}
                  selected={
                    ensureDeliveryConfig(reminderDraft.delivery, reminderDraft).coreChannels
                  }
                  onToggle={(key, next) => {
                    const delivery = ensureDeliveryConfig(reminderDraft.delivery, reminderDraft);
                    const newCore = toggleChannel(
                      delivery.coreChannels,
                      key as CoreDeliveryChannel,
                      next
                    );
                    setReminderDraft({
                      ...reminderDraft,
                      delivery: { ...delivery, coreChannels: newCore },
                      inAppNotification: newCore.includes('in_app'),
                      emailNotification: newCore.includes('email'),
                    });
                  }}
                />
                <ChannelChips
                  label={t('sharedComponents.governanceCanvas.integrationChannels')}
                  channels={INTEGRATION_CHANNEL_CATALOG}
                  selected={
                    ensureDeliveryConfig(reminderDraft.delivery, reminderDraft).integrationChannels
                  }
                  onToggle={(key, next) => {
                    const delivery = ensureDeliveryConfig(reminderDraft.delivery, reminderDraft);
                    setReminderDraft({
                      ...reminderDraft,
                      delivery: {
                        ...delivery,
                        integrationChannels: toggleChannel(
                          delivery.integrationChannels,
                          key as IntegrationChannel,
                          next
                        ),
                      },
                    });
                  }}
                />
              </div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block">
                {t('sharedComponents.governanceCanvas.syncTargets')}
                <input
                  value={ensureDeliveryConfig(
                    reminderDraft.delivery,
                    reminderDraft
                  ).syncTargets.join(', ')}
                  onChange={(e) => {
                    const delivery = ensureDeliveryConfig(reminderDraft.delivery, reminderDraft);
                    setReminderDraft({
                      ...reminderDraft,
                      delivery: {
                        ...delivery,
                        syncTargets: e.target.value
                          .split(',')
                          .map((item: string) => item.trim())
                          .filter(Boolean),
                      },
                    });
                  }}
                  className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                  placeholder="slack:#delivery, jira:PROJ, webhook:ops"
                />
              </label>
            </div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block">
              {t('sharedComponents.governanceCanvas.messageLabel')}
              <textarea
                value={reminderDraft.message || ''}
                onChange={(e) => setReminderDraft({ ...reminderDraft, message: e.target.value })}
                rows={3}
                className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditingReminderId(null);
                  setReminderDraft(null);
                }}
                className="px-3 py-1.5 rounded-md text-xs border border-slate-300/60 dark:border-navy-600 text-slate-500"
              >
                {t('sharedComponents.governanceCanvas.cancel')}
              </button>
              <button
                onClick={saveReminder}
                className="px-3 py-1.5 rounded-md text-xs bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800"
              >
                {t('sharedComponents.governanceCanvas.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Escalation modal ── */}
      {editingEscalationId && escalationDraft && (
        <div className={MODAL_OVERLAY}>
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setEditingEscalationId(null);
              setEscalationDraft(null);
            }}
          />
          <div className={MODAL_CLASS}>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {editingEscalationId === '__new__'
                  ? t('sharedComponents.governanceCanvas.addEscalationRule')
                  : t('sharedComponents.governanceCanvas.editEscalationRule')}
              </h4>
              <div className="inline-flex items-center gap-2">
                {onAISuggestEscalations && (
                  <button
                    disabled={locked || isSuggestingEscalations}
                    onClick={onAISuggestEscalations}
                    className={AI_BTN}
                  >
                    {isSuggestingEscalations ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    AI
                  </button>
                )}
                <button
                  className="p-1 text-slate-600 hover:text-slate-600"
                  onClick={() => {
                    setEditingEscalationId(null);
                    setEscalationDraft(null);
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className={MODAL_HINT}>
              {t('sharedComponents.governanceCanvas.escalationModalHint')}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-slate-500 dark:text-slate-400">
                {t('sharedComponents.governanceCanvas.warningThresholdDays')}
                <input
                  type="number"
                  min={0}
                  value={escalationDraft.warningDays}
                  onChange={(e) =>
                    setEscalationDraft({
                      ...escalationDraft,
                      warningDays: Number(e.target.value) || 0,
                    })
                  }
                  className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                />
              </label>
              <label className="text-xs text-slate-500 dark:text-slate-400">
                {t('sharedComponents.governanceCanvas.criticalThresholdDays')}
                <input
                  type="number"
                  min={0}
                  value={escalationDraft.criticalDays}
                  onChange={(e) =>
                    setEscalationDraft({
                      ...escalationDraft,
                      criticalDays: Number(e.target.value) || 0,
                    })
                  }
                  className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                />
              </label>
              <label className="text-xs text-slate-500 dark:text-slate-400">
                {t('sharedComponents.governanceCanvas.escalateAfterDays')}
                <input
                  type="number"
                  min={1}
                  value={escalationDraft.afterDays}
                  onChange={(e) =>
                    setEscalationDraft({
                      ...escalationDraft,
                      afterDays: Number(e.target.value) || 1,
                    })
                  }
                  className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                />
              </label>
              <label className="text-xs text-slate-500 dark:text-slate-400">
                {t('sharedComponents.governanceCanvas.escalateTo')}
                <select
                  value={escalationDraft.escalateTo}
                  onChange={(e) => {
                    const selected = users.find((u) => u.id === e.target.value);
                    setEscalationDraft({
                      ...escalationDraft,
                      escalateTo: e.target.value,
                      escalateToName: selected
                        ? `${selected.firstName} ${selected.lastName}`
                        : escalationDraft.escalateToName,
                    });
                  }}
                  className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                >
                  <option value="">{t('sharedComponents.governanceCanvas.select')}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block">
              {t('sharedComponents.governanceCanvas.escalationMode')}
              <select
                value={escalationDraft.escalationMode}
                onChange={(e) =>
                  setEscalationDraft({
                    ...escalationDraft,
                    escalationMode: e.target.value as EscalationMode,
                  })
                }
                className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
              >
                {escalationModeOptions.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={escalationDraft.enabled}
                onChange={(e) =>
                  setEscalationDraft({ ...escalationDraft, enabled: e.target.checked })
                }
              />
              {t('sharedComponents.governanceCanvas.ruleEnabled')}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ChannelChips
                label={t('sharedComponents.governanceCanvas.coreChannels')}
                channels={[
                  { key: 'in_app', label: 'In-app' },
                  { key: 'email', label: 'Email' },
                ]}
                selected={ensureDeliveryConfig(escalationDraft.delivery).coreChannels}
                onToggle={(key, next) => {
                  const delivery = ensureDeliveryConfig(escalationDraft.delivery);
                  setEscalationDraft({
                    ...escalationDraft,
                    delivery: {
                      ...delivery,
                      coreChannels: toggleChannel(
                        delivery.coreChannels,
                        key as CoreDeliveryChannel,
                        next
                      ),
                    },
                  });
                }}
              />
              <ChannelChips
                label={t('sharedComponents.governanceCanvas.integrationChannels')}
                channels={INTEGRATION_CHANNEL_CATALOG}
                selected={ensureDeliveryConfig(escalationDraft.delivery).integrationChannels}
                onToggle={(key, next) => {
                  const delivery = ensureDeliveryConfig(escalationDraft.delivery);
                  setEscalationDraft({
                    ...escalationDraft,
                    delivery: {
                      ...delivery,
                      integrationChannels: toggleChannel(
                        delivery.integrationChannels,
                        key as IntegrationChannel,
                        next
                      ),
                    },
                  });
                }}
              />
            </div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block">
              {t('sharedComponents.governanceCanvas.syncTargets')}
              <input
                value={ensureDeliveryConfig(escalationDraft.delivery).syncTargets.join(', ')}
                onChange={(e) => {
                  const delivery = ensureDeliveryConfig(escalationDraft.delivery);
                  setEscalationDraft({
                    ...escalationDraft,
                    delivery: {
                      ...delivery,
                      syncTargets: e.target.value
                        .split(',')
                        .map((item: string) => item.trim())
                        .filter(Boolean),
                    },
                  });
                }}
                className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                placeholder="slack:#ops, webhook:escalation"
              />
            </label>
            <label className="text-xs text-slate-500 dark:text-slate-400 block">
              {t('sharedComponents.governanceCanvas.message')}
              <textarea
                value={escalationDraft.message || ''}
                onChange={(e) =>
                  setEscalationDraft({ ...escalationDraft, message: e.target.value })
                }
                rows={3}
                className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditingEscalationId(null);
                  setEscalationDraft(null);
                }}
                className="px-3 py-1.5 rounded-md text-xs border border-slate-300/60 dark:border-navy-600 text-slate-500"
              >
                {t('sharedComponents.governanceCanvas.cancel')}
              </button>
              <button
                onClick={saveEscalation}
                className="px-3 py-1.5 rounded-md text-xs bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800"
              >
                {t('sharedComponents.governanceCanvas.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GovernanceCanvas;
