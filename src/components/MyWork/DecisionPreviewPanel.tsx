import {
  AlarmClockOff,
  Bell,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  Sparkles,
  TrendingUp,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  type ActionRow,
  type DetailsAction,
  type ExtraCopyFormat,
  type MetaPill,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';
import { statusChipTone } from '@/components/ui/primitives/chips';
import { PreviewPaneShell } from '@/components/ui/ResizableTable';
import { useUserIntegrations } from '@/hooks/useUserIntegrations';
import i18n from '@/i18n';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { copyAsMarkdown, copyForSlack } from '@/utils/clipboard';

import { DelegationModal } from './shared/DelegationModal';

export type DecisionPreviewMode = 'my' | 'requests_pending' | 'all';

export type DecisionSnoozePreset = '1h' | '4h' | 'tomorrow' | 'week';

export interface DecisionPreviewData {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  createdAt?: string | null;
  deciderId?: string | null;
  decisionOwnerId?: string | null;
  ownerName?: string | null;
  requestedById?: string | null;
  requestedByName?: string | null;
  projectName?: string | null;
  decisionType?: string | null;
  type?: string | null;
  linkedItems?: Array<{ id: string; type: string; title?: string; linkRelation?: string }>;
}

export interface DecisionBrief {
  decisionId: string;
  summary: string;
  recommendation: string;
  urgency: 'urgent' | 'normal';
  category?: string | null;
  createdAt?: string | null;
  dueDate?: string | null;
}

export interface DecisionPreviewPanelProps {
  decisionId: string | null;
  mode: DecisionPreviewMode;
  onClose: () => void;
  onOpenFullDetail: (decisionId: string, decisionData?: any) => void;
  onDidMutate?: () => void;
}

const formatShortDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const defaultRationaleFor = (status: 'approved' | 'rejected') =>
  status === 'approved' ? 'Approved' : 'Rejected';

function clampText(s: string, max = 220): string {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function labelForSnoozePreset(p: DecisionSnoozePreset, isPolish: boolean) {
  const map: Record<DecisionSnoozePreset, { pl: string; en: string }> = {
    '1h': { pl: 'Za 1h', en: '1 hour' },
    '4h': { pl: 'Za 4h', en: '4 hours' },
    tomorrow: { pl: 'Jutro (9:00)', en: 'Tomorrow (9:00)' },
    week: { pl: 'Za tydzień', en: 'Next week' },
  };
  return isPolish ? map[p].pl : map[p].en;
}

function relationTone(type: string) {
  const t = String(type || '').toLowerCase();
  if (t === 'task') return 'text-blue-600 dark:text-blue-300';
  if (t === 'initiative') return 'text-amber-700 dark:text-amber-300';
  if (t === 'decision') return 'text-blue-700 dark:text-blue-300';
  return 'text-c-text-secondary';
}

type DecisionAiIntent = 'summarize_context' | 'propose_options' | 'assess_risk';

async function runDecisionAi({
  intent,
  isPolish,
  decision,
}: {
  intent: DecisionAiIntent;
  isPolish: boolean;
  decision: DecisionPreviewData;
}): Promise<string> {
  const language = i18n.t('myWork.decisionPreview.en', 'en');
  const intentLabel =
    intent === 'summarize_context'
      ? i18n.t('myWork.decisionPreview.summarizeContext', 'Summarize context')
      : intent === 'propose_options'
        ? i18n.t('myWork.decisionPreview.proposeOptions', 'Propose options')
        : i18n.t('myWork.decisionPreview.assessRisk', 'Assess risk');

  const systemInstruction = [
    `You are a senior PMO decision advisor.`,
    `Output language MUST be ${language === 'pl' ? 'Polish' : 'English'}.`,
    `Do NOT invent facts. Use only provided decision fields.`,
    `Return plain text. No markdown. Keep it concise (3-6 short sentences or bullets).`,
    `Intent: ${intentLabel}`,
  ].join('\n');

  const seed = [
    `[GENERATE FROM SCRATCH]`,
    `Decision: ${decision.title || 'Decision'}`,
    `Type: ${decision.decisionType || decision.type || ''}`,
    `Project: ${decision.projectName || ''}`,
    `Status: ${decision.status || ''}`,
    `Priority: ${decision.priority || ''}`,
    `Due date: ${decision.dueDate || ''}`,
    `Description: ${String(decision.description || '').trim()}`,
  ]
    .filter(Boolean)
    .join('\n');

  const resp = await Api.post('/ai/refine-text?timeoutMs=20000', {
    text: seed,
    mode: 'generate',
    systemInstruction,
    fieldLabel: 'Decision preview AI',
    artifactContext: {
      id: decision.id,
      title: decision.title,
      type: 'decision',
      status: decision.status || 'pending',
      priority: decision.priority || 'medium',
    },
    language,
  });

  return String((resp as any)?.text || '').trim();
}

export const DecisionPreviewBody: React.FC<{
  decision: DecisionPreviewData | null;
  brief: DecisionBrief | null;
  isPolish: boolean;
  detailsOverride: string | null;
  detailsLoading: boolean;
  detailsMenuOpen: boolean;
  onToggleDetailsMenu: () => void;
  onCloseDetailsMenu: () => void;
  onDetailsAction: (action: 'expand' | 'summarize' | 'copy') => void;
}> = ({
  decision,
  brief,
  isPolish,
  detailsOverride,
  detailsLoading,
  detailsMenuOpen,
  onToggleDetailsMenu,
  onCloseDetailsMenu,
  onDetailsAction,
}) => {
  const { t } = useTranslation();
  // canon §4.1 — status color driven by statusChipTone() on neutral shell, no hardcoded fills.
  const status = String(decision?.status || 'PENDING').toUpperCase();
  const statusTone = statusChipTone(decision?.status || 'pending');

  // canon §4.0 — priority carries a signal tone only when it warrants attention.
  const pri = String(decision?.priority || 'MEDIUM').toUpperCase();
  const priTone: MetaPill['tone'] =
    pri === 'CRITICAL' ? 'danger' : pri === 'HIGH' ? 'warning' : 'neutral';

  const priLabel = isPolish
    ? pri === 'CRITICAL'
      ? t('myWork.decisionPreview.priorityCritical')
      : pri === 'HIGH'
        ? t('myWork.decisionPreview.priorityHigh')
        : pri === 'MEDIUM'
          ? t('myWork.decisionPreview.priorityMedium')
          : t('myWork.decisionPreview.priorityLow')
    : pri[0] + pri.slice(1).toLowerCase();

  const pills: MetaPill[] = [
    {
      label: isPolish ? status : status[0] + status.slice(1).toLowerCase(),
      tone: statusTone,
    },
    { label: priLabel, tone: priTone },
    ...(brief?.summary
      ? [
          {
            label:
              brief.urgency === 'urgent'
                ? i18n.t('myWork.decisionPreview.urgent', 'Urgent')
                : i18n.t('myWork.decisionPreview.normal', 'Normal'),
            tone: brief.urgency === 'urgent' ? 'danger' : 'neutral',
          } as MetaPill,
        ]
      : []),
    ...(decision?.projectName
      ? [
          {
            label: decision.projectName,
            tone: 'neutral',
            className: 'bg-transparent text-c-text-secondary truncate max-w-[120px]',
          } as MetaPill,
        ]
      : []),
  ];

  const trailing = decision?.dueDate ? (
    <span className="text-[11px] font-semibold text-c-text-secondary">
      {formatShortDate(decision.dueDate) || ''}
    </span>
  ) : (
    <span className="text-[11px] font-semibold text-c-text-muted italic">
      {i18n.t('myWork.decisionPreview.noDueDate', 'No due date')}
    </span>
  );

  const detailsText = detailsOverride ?? String(decision?.description || '').trim();

  // #41: "Copy for Slack" only makes sense when the user actually has an
  // active Slack integration (server/src/data/integrationsCatalog.ts +
  // /api/settings/integrations) — otherwise it's a dead affordance.
  const { isConnected: isIntegrationConnected } = useUserIntegrations();
  const isSlackConnected = isIntegrationConnected('slack');

  return (
    <div className="space-y-4">
      <PreviewMetaCard pills={pills} trailing={trailing}>
        {brief?.recommendation ? (
          <div className="mt-2 text-xs text-c-text-muted">
            {clampText(brief.recommendation, 140)}
          </div>
        ) : null}
      </PreviewMetaCard>

      <PreviewDetailsSection
        text={detailsText}
        loading={detailsLoading}
        customActions={
          [
            {
              id: 'expand',
              label: i18n.t('myWork.decisionPreview.label', 'Expand'),
              icon: ChevronDown,
              onClick: () => onDetailsAction('expand'),
              disabled: detailsLoading,
            },
            {
              id: 'summarize',
              label: i18n.t('myWork.decisionPreview.label2', 'Summarize'),
              icon: Sparkles,
              onClick: () => onDetailsAction('summarize'),
              disabled: detailsLoading,
            },
            {
              id: 'copy',
              label: i18n.t('myWork.decisionPreview.label3', 'Copy'),
              icon: Copy,
              onClick: () => onDetailsAction('copy'),
            },
            {
              id: 'copy-md',
              label: i18n.t('myWork.decisionPreview.label4', 'Copy as Markdown'),
              onClick: () =>
                void copyAsMarkdown(
                  {
                    title: decision?.title || '',
                    status: decision?.status ?? undefined,
                    description: detailsText,
                  },
                  isPolish ? 'pl' : 'en'
                ),
            },
            ...(isSlackConnected
              ? [
                  {
                    id: 'copy-slack',
                    label: i18n.t('myWork.decisionPreview.label5', 'Copy for Slack'),
                    onClick: () =>
                      void copyForSlack(
                        {
                          title: decision?.title || '',
                          status: decision?.status ?? undefined,
                          description: detailsText,
                        },
                        isPolish ? 'pl' : 'en'
                      ),
                  },
                ]
              : []),
          ] as DetailsAction[]
        }
      />
    </div>
  );
};

export const DecisionPreviewFooter: React.FC<{
  decision: DecisionPreviewData | null;
  mode: DecisionPreviewMode;
  canAct: boolean;
  isPolish: boolean;
  aiText: string | null;
  aiError: string | null;
  aiLoading: boolean;
  aiMenuOpen: boolean;
  onToggleAiMenu: () => void;
  onCloseAiMenu: () => void;
  onRunAi: (intent: DecisionAiIntent) => void;
  onCopyAi: () => void;
  onClearAi: () => void;
  onRegenerateAi: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDelegate: () => void;
  onRemind: () => void;
  onEscalate: () => void;
  snoozeOpen: boolean;
  onToggleSnooze: () => void;
  onCloseSnooze: () => void;
  onSnooze: (preset: DecisionSnoozePreset) => void;
  /** Navigate to another decision referenced in `decision.linkedItems` (r.type === 'decision'). */
  onOpenLinkedDecision?: (decisionId: string) => void;
}> = ({
  decision,
  mode,
  canAct,
  isPolish,
  aiText,
  aiError,
  aiLoading,
  aiMenuOpen,
  onToggleAiMenu,
  onCloseAiMenu,
  onRunAi,
  onCopyAi,
  onClearAi,
  onRegenerateAi,
  onApprove,
  onReject,
  onDelegate,
  onRemind,
  onEscalate,
  onSnooze,
  onOpenLinkedDecision,
}) => {
  const hintSummarize = i18n.t('myWork.decisionPreview.summarizeContext2', 'Summarize context');
  const hintPropose = i18n.t('myWork.decisionPreview.proposeOptions2', 'Propose options');
  const hintAssess = i18n.t('myWork.decisionPreview.assessRisk2', 'Assess risk');
  const hints = [hintSummarize, hintPropose, hintAssess];

  const hintToIntent = (hint: string): DecisionAiIntent => {
    if (hint === hintSummarize) return 'summarize_context';
    if (hint === hintPropose) return 'propose_options';
    if (hint === hintAssess) return 'assess_risk';
    return 'summarize_context';
  };

  const relationItems: RelationItem[] = (decision?.linkedItems || []).slice(0, 6).map((r) => ({
    label: clampText(String(r.title || r.id), 42),
    tone: relationTone(r.type),
    // Nawigacja dostępna dziś tylko dla linkowanych decyzji (onOpenLinkedDecision — te
    // same handlery co przycisk "Open"). Task/Initiative nie mają w tym module
    // gotowego adresu docelowego — bez onClick pigułka renderuje się jako <span> (bez
    // cursor-pointer/hover), więc nie udaje klikalności, której nie ma.
    onClick:
      String(r.type || '').toLowerCase() === 'decision' && onOpenLinkedDecision
        ? () => onOpenLinkedDecision(r.id)
        : undefined,
  }));

  // Zgloszenie Piotra 2026-07-21: stopka Decision mial 7 widocznych przyciskow
  // w 3 wierszach — lamie DOKTRYNA_GESTOSCI.md §1 ("toolbar <= 5 widocznych,
  // 6+ -> obowiazkowy overflow") i §15 ("gesty i plytki, nie plaski wysyp").
  // Decyzja Piotra: Zatwierdz/Odrzuc + Odloz zawsze widoczne (3), pozostale
  // cztery (Wiecej info/Deleguj/Przypomnij/Eskaluj) -> menu "...".
  const actionRows: ActionRow[] = [
    ...(canAct
      ? [
          {
            columns: 2,
            buttons: [
              {
                label: i18n.t('myWork.decisionPreview.label6', 'Approve'),
                icon: Check,
                onClick: onApprove,
                colorScheme: 'emerald' as const,
                flex: true,
                shortcut: 'A',
              },
              {
                label: i18n.t('myWork.decisionPreview.label7', 'Reject'),
                icon: X,
                onClick: onReject,
                colorScheme: 'red' as const,
                flex: true,
                shortcut: 'R',
              },
            ],
          },
        ]
      : []),
  ];

  return (
    // canon §7.3 — footer cards stacked with space-y-2.5, NO dividers between framed cards.
    <div className="space-y-2.5">
      <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-2.5">
        <PreviewAIHintStrip
          hints={hints}
          loading={aiLoading}
          result={aiText}
          error={aiError}
          onRunHint={(hint) => onRunAi(hintToIntent(hint))}
          onRegenerate={onRegenerateAi}
          onCopy={onCopyAi}
          onClear={onClearAi}
          disabled={!decision?.id}
        />
      </div>

      <PreviewRelations
        items={relationItems}
        emptyLabel={i18n.t('myWork.decisionPreview.emptyLabel', 'No relations')}
      />

      <div className="py-1">
        <PreviewActionBar
          rows={actionRows}
          overflowLabel={i18n.t('myWork.decisionPreview.moreActions', 'More actions')}
          overflowActions={[
            // canon §7.3 — "More info" usunięte: wołało dokładnie ten sam handler
            // co przycisk "Open" w headerze (onOpenFullDetail), czyli duplikat akcji.
            ...(canAct
              ? [
                  {
                    label: i18n.t('myWork.decisionPreview.label9', 'Delegate'),
                    icon: UserPlus,
                    onClick: onDelegate,
                    colorScheme: 'neutral' as const,
                  },
                ]
              : []),
            {
              label: i18n.t('myWork.decisionPreview.remind', 'Remind'),
              icon: Bell,
              onClick: onRemind,
              colorScheme: 'neutral',
            },
            {
              label: i18n.t('myWork.decisionPreview.escalate', 'Escalate'),
              icon: TrendingUp,
              onClick: onEscalate,
              colorScheme: 'amber',
            },
            ...(['1h', '4h', 'tomorrow', 'week'] as const).map((preset) => ({
              label: `${i18n.t('myWork.decisionPreview.snooze', 'Snooze')}: ${labelForSnoozePreset(
                preset,
                isPolish
              )}`,
              icon: AlarmClockOff,
              onClick: () => onSnooze(preset),
              colorScheme: 'neutral' as const,
            })),
          ]}
        />
      </div>
    </div>
  );
};

export const DecisionPreviewPanel: React.FC<DecisionPreviewPanelProps> = ({
  decisionId,
  mode,
  onClose,
  onOpenFullDetail,
  onDidMutate,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { currentUser } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<DecisionPreviewData | null>(null);
  const [brief, setBrief] = useState<DecisionBrief | null>(null);
  const [delegationOpen, setDelegationOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<
    Array<{ id: string; name: string; email?: string; avatar?: string }>
  >([]);

  const canAct = useMemo(() => {
    if (!decisionId) return false;
    if (mode === 'requests_pending') return false;
    // In "all" mode we still only allow acting when I'm the decider.
    const meId = currentUser?.id ? String(currentUser.id) : null;
    const ownerId = decision?.decisionOwnerId ? String(decision.decisionOwnerId) : null;
    return Boolean(meId && ownerId && meId === ownerId);
  }, [decisionId, mode, currentUser?.id, decision?.decisionOwnerId]);

  const canDelegate = canAct;

  // Details kebab state (MUST: kebab in Details)
  const [detailsMenuOpen, setDetailsMenuOpen] = useState(false);
  const [detailsOverride, setDetailsOverride] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // AI hints state (MUST: kebab in AI strip)
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const lastAiIntentRef = useRef<DecisionAiIntent>('summarize_context');

  // Snooze dropdown (pill dropdown)
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!decisionId) return;
    try {
      setLoading(true);
      const d = (await Api.getDecision(decisionId)) as DecisionPreviewData;
      setDecision({
        ...d,
        id: String((d as any)?.id || decisionId),
        title: String((d as any)?.title || 'Decision'),
      });
      try {
        const b = (await Api.get(`/my-work/decisions/${decisionId}/brief`)) as DecisionBrief;
        setBrief(b && typeof (b as any)?.summary === 'string' ? b : null);
      } catch {
        setBrief(null);
      }
    } catch (e) {
      setDecision(null);
      setBrief(null);
    } finally {
      setLoading(false);
    }
  }, [decisionId]);

  const fetchUsers = useCallback(async () => {
    try {
      const users = await Api.getUsers();
      const mapped = (Array.isArray(users) ? users : []).map((u: any) => ({
        id: String(u.id),
        name: String(
          u.name ||
            `${u.first_name || u.firstName || ''} ${u.last_name || u.lastName || ''}`.trim() ||
            u.email ||
            u.id
        ),
        email: u.email ? String(u.email) : undefined,
        avatar: u.avatar_url || u.avatarUrl || undefined,
      }));
      setAvailableUsers(mapped);
    } catch {
      setAvailableUsers([]);
    }
  }, []);

  useEffect(() => {
    setDecision(null);
    setBrief(null);
    setDetailsMenuOpen(false);
    setDetailsOverride(null);
    setDetailsLoading(false);
    setAiMenuOpen(false);
    setAiLoading(false);
    setAiText(null);
    setAiError(null);
    setSnoozeOpen(false);
    if (decisionId) fetchDetails();
  }, [decisionId, fetchDetails]);

  const handleDetailsAction = useCallback(
    async (action: 'expand' | 'summarize' | 'copy') => {
      if (!decision) return;
      const base = String(detailsOverride ?? decision.description ?? '').trim();
      if (action === 'copy') {
        try {
          await navigator.clipboard.writeText(base || decision.title || '');
          toast.success(t('myWork.decisionPreview.toastSuccess', 'Copied'));
        } catch {
          toast.error(t('myWork.decisionPreview.toastError', 'Copy failed'));
        }
        setDetailsMenuOpen(false);
        return;
      }

      try {
        setDetailsLoading(true);
        setDetailsMenuOpen(false);
        const language = t('myWork.decisionPreview.en4', 'en');
        const systemInstruction = [
          `You are a senior PMO decision advisor.`,
          `Output language MUST be ${language === 'pl' ? 'Polish' : 'English'}.`,
          `Do NOT invent facts. Use only the provided decision text/context.`,
          `Return plain text only (no markdown).`,
        ].join('\n');

        const mode = action === 'expand' ? 'expand' : 'shorten';
        const resp = await Api.post('/ai/refine-text?timeoutMs=20000', {
          text: base || decision.title,
          mode,
          systemInstruction,
          fieldLabel: 'Decision details',
          artifactContext: {
            id: decision.id,
            title: decision.title,
            type: 'decision',
            status: decision.status || 'pending',
            priority: decision.priority || 'medium',
          },
          language,
        });
        const text = String((resp as any)?.text || '').trim();
        if (text) setDetailsOverride(text);
      } catch {
        toast.error(t('myWork.decisionPreview.toastError2', 'AI unavailable'));
      } finally {
        setDetailsLoading(false);
      }
    },
    [decision, detailsOverride, isPolish]
  );

  const handleRunAi = useCallback(
    async (intent: DecisionAiIntent) => {
      if (!decision) return;
      lastAiIntentRef.current = intent;
      try {
        setAiLoading(true);
        setAiError(null);
        const text = await runDecisionAi({ intent, isPolish, decision });
        if (!text) throw new Error('empty');
        setAiText(text);
      } catch {
        setAiError(t('myWork.decisionPreview.setAiError', 'AI unavailable'));
      } finally {
        setAiLoading(false);
      }
    },
    [decision, isPolish]
  );

  const handleCopyAi = useCallback(async () => {
    if (!aiText) return;
    try {
      await navigator.clipboard.writeText(aiText);
      toast.success(t('myWork.decisionPreview.toastSuccess2', 'Copied'));
    } catch {
      toast.error(t('myWork.decisionPreview.toastError3', 'Copy failed'));
    } finally {
      setAiMenuOpen(false);
    }
  }, [aiText, isPolish]);

  const handleClearAi = useCallback(() => {
    setAiText(null);
    setAiError(null);
    setAiMenuOpen(false);
  }, []);

  const handleRegenerateAi = useCallback(() => {
    setAiMenuOpen(false);
    void handleRunAi(lastAiIntentRef.current || 'summarize_context');
  }, [handleRunAi]);

  const handleApproveReject = async (next: 'approved' | 'rejected') => {
    if (!decisionId) return;
    try {
      await Api.decideDecision(decisionId, next, defaultRationaleFor(next));
      toast.success(
        next === 'approved'
          ? t('myWork.decisionPreview.approved', 'Approved')
          : t('myWork.decisionPreview.rejected', 'Rejected')
      );
      onDidMutate?.();
      await fetchDetails();
    } catch (e) {
      toast.error(t('myWork.decisionPreview.toastError4', 'Action failed'));
    }
  };

  const handleDefer = async () => {
    if (!decisionId) return;
    try {
      await Api.decideDecision(
        decisionId,
        'deferred',
        t('myWork.decisionPreview.deferred', 'Deferred')
      );
      toast.success(t('myWork.decisionPreview.toastSuccess3', 'Deferred'));
      onDidMutate?.();
      await fetchDetails();
    } catch {
      toast.error(t('myWork.decisionPreview.toastError5', 'Failed to defer'));
    }
  };

  const handleRemind = async () => {
    if (!decisionId) return;
    try {
      await Api.remindDecision(decisionId);
      toast.success(t('myWork.decisionPreview.toastSuccess4', 'Reminder sent'));
    } catch (e: any) {
      const msg = String(e?.message || '');
      toast.error(
        msg.includes('recent')
          ? t('myWork.decisionPreview.reminderRecentlySent', 'Reminder recently sent')
          : t('myWork.decisionPreview.failedToSendReminder', 'Failed to send reminder')
      );
    }
  };

  const handleEscalate = async () => {
    if (!decisionId) return;
    try {
      await Api.escalateDecision(
        decisionId,
        t(
          'myWork.decisionPreview.escalatedFromPreviewNeeds',
          'Escalated from preview — needs attention'
        )
      );
      toast.success(t('myWork.decisionPreview.toastSuccess5', 'Escalated'));
      onDidMutate?.();
      await fetchDetails();
    } catch {
      toast.error(t('myWork.decisionPreview.toastError6', 'Failed to escalate'));
    }
  };

  const handleSnooze = async (preset: DecisionSnoozePreset) => {
    if (!decisionId) return;
    try {
      await Api.snoozeDecision(decisionId, { preset });
      toast.success(t('myWork.decisionPreview.toastSuccess6', 'Snoozed'));
      onDidMutate?.();
      onClose();
    } catch (e) {
      toast.error(t('myWork.decisionPreview.toastError7', 'Failed to snooze'));
    }
  };

  if (!decisionId) {
    return (
      <aside className="w-[clamp(340px,28%,480px)] flex-shrink-0 bg-c-bg h-full p-3">
        <PreviewPaneShell
          kicker={t('myWork.decisionPreview.kicker', 'Preview')}
          title={t('myWork.decisionPreview.title', 'Decision')}
          onClose={onClose}
        >
          <div className="h-full flex items-center justify-center p-6 text-center">
            <div className="text-sm text-c-text-muted">
              {t('myWork.decisionPreview.selectADecisionTo', 'Select a decision to preview.')}
            </div>
          </div>
        </PreviewPaneShell>
      </aside>
    );
  }

  return (
    <aside className="w-[clamp(340px,28%,480px)] flex-shrink-0 bg-c-bg h-full p-3 overflow-hidden">
      <PreviewPaneShell
        kicker={
          mode === 'requests_pending'
            ? t('myWork.decisionPreview.myRequest', 'My request')
            : t('myWork.decisionPreview.preview', 'Preview')
        }
        title={decision?.title || t('myWork.decisionPreview.decision', 'Decision')}
        onClose={onClose}
        actions={
          <button
            onClick={() => onOpenFullDetail(decisionId, decision)}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text-secondary hover:bg-c-surface-raised transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
            title={t('myWork.decisionPreview.title2', 'Open full detail')}
          >
            <ExternalLink size={13} />
            {t('myWork.decisionPreview.open', 'Open')}
          </button>
        }
        footer={
          <DecisionPreviewFooter
            decision={decision}
            mode={mode}
            canAct={canAct}
            isPolish={isPolish}
            aiText={aiText}
            aiError={aiError}
            aiLoading={aiLoading}
            aiMenuOpen={aiMenuOpen}
            onToggleAiMenu={() => setAiMenuOpen((v) => !v)}
            onCloseAiMenu={() => setAiMenuOpen(false)}
            onRunAi={handleRunAi}
            onCopyAi={handleCopyAi}
            onClearAi={handleClearAi}
            onRegenerateAi={handleRegenerateAi}
            onApprove={() => handleApproveReject('approved')}
            onReject={() => handleApproveReject('rejected')}
            onDelegate={async () => {
              await fetchUsers();
              setDelegationOpen(true);
            }}
            onRemind={handleRemind}
            onEscalate={handleEscalate}
            snoozeOpen={snoozeOpen}
            onToggleSnooze={() => setSnoozeOpen((v) => !v)}
            onCloseSnooze={() => setSnoozeOpen(false)}
            onSnooze={(preset) => {
              setSnoozeOpen(false);
              void handleSnooze(preset);
            }}
            onOpenLinkedDecision={(linkedId) => onOpenFullDetail(linkedId)}
          />
        }
      >
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-c-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t('myWork.decisionPreview.loading', 'Loading…')}</span>
          </div>
        ) : (
          <DecisionPreviewBody
            decision={decision}
            brief={brief}
            isPolish={isPolish}
            detailsOverride={detailsOverride}
            detailsLoading={detailsLoading}
            detailsMenuOpen={detailsMenuOpen}
            onToggleDetailsMenu={() => setDetailsMenuOpen((v) => !v)}
            onCloseDetailsMenu={() => setDetailsMenuOpen(false)}
            onDetailsAction={(a) => void handleDetailsAction(a)}
          />
        )}
      </PreviewPaneShell>

      {decisionId && decision && (
        <DelegationModal
          isOpen={delegationOpen}
          onClose={() => setDelegationOpen(false)}
          decisionId={decisionId}
          decisionTitle={String(decision?.title || '')}
          availableUsers={availableUsers}
          currentDeciderId={String(
            (decision as any)?.deciderId ||
              (decision as any)?.decider_id ||
              (decision as any)?.decisionOwnerId ||
              (decision as any)?.decision_maker_id ||
              ''
          )}
          onDelegated={() => {
            onDidMutate?.();
            fetchDetails();
          }}
        />
      )}
    </aside>
  );
};

export default DecisionPreviewPanel;
