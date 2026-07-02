import {
  AlarmClockOff,
  Bell,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  Sparkles,
  TrendingUp,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  actionPillClass,
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
  const language = isPolish ? 'pl' : 'en';
  const intentLabel =
    intent === 'summarize_context'
      ? isPolish
        ? 'Podsumuj kontekst'
        : 'Summarize context'
      : intent === 'propose_options'
        ? isPolish
          ? 'Zaproponuj opcje'
          : 'Propose options'
        : isPolish
          ? 'Oceń ryzyko'
          : 'Assess risk';

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
  // canon §4.1 — status color driven by statusChipTone() on neutral shell, no hardcoded fills.
  const status = String(decision?.status || 'PENDING').toUpperCase();
  const statusTone = statusChipTone(decision?.status || 'pending');

  // canon §4.0 — priority carries a signal tone only when it warrants attention.
  const pri = String(decision?.priority || 'MEDIUM').toUpperCase();
  const priTone: MetaPill['tone'] =
    pri === 'CRITICAL' ? 'danger' : pri === 'HIGH' ? 'warning' : 'neutral';

  const priLabel = isPolish
    ? pri === 'CRITICAL'
      ? 'Krytyczne'
      : pri === 'HIGH'
        ? 'Wysoki'
        : pri === 'MEDIUM'
          ? 'Średni'
          : 'Niski'
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
                ? isPolish
                  ? 'Pilne'
                  : 'Urgent'
                : isPolish
                  ? 'Normalne'
                  : 'Normal',
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
      {isPolish ? 'Bez terminu' : 'No due date'}
    </span>
  );

  const detailsText = detailsOverride ?? String(decision?.description || '').trim();

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
              label: isPolish ? 'Rozwiń' : 'Expand',
              icon: ChevronDown,
              onClick: () => onDetailsAction('expand'),
              disabled: detailsLoading,
            },
            {
              id: 'summarize',
              label: isPolish ? 'Podsumuj' : 'Summarize',
              icon: Sparkles,
              onClick: () => onDetailsAction('summarize'),
              disabled: detailsLoading,
            },
            {
              id: 'copy',
              label: isPolish ? 'Kopiuj' : 'Copy',
              icon: Copy,
              onClick: () => onDetailsAction('copy'),
            },
            {
              id: 'copy-md',
              label: isPolish ? 'Kopiuj jako Markdown' : 'Copy as Markdown',
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
            {
              id: 'copy-slack',
              label: isPolish ? 'Kopiuj dla Slack' : 'Copy for Slack',
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
  onMoreInfo: () => void;
  onRemind: () => void;
  onEscalate: () => void;
  snoozeOpen: boolean;
  onToggleSnooze: () => void;
  onCloseSnooze: () => void;
  onSnooze: (preset: DecisionSnoozePreset) => void;
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
  onMoreInfo,
  onRemind,
  onEscalate,
  snoozeOpen,
  onToggleSnooze,
  onCloseSnooze,
  onSnooze,
}) => {
  const hintSummarize = isPolish ? 'Podsumuj kontekst' : 'Summarize context';
  const hintPropose = isPolish ? 'Zaproponuj opcje' : 'Propose options';
  const hintAssess = isPolish ? 'Oceń ryzyko' : 'Assess risk';
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
  }));

  const actionRows: ActionRow[] = [
    ...(canAct
      ? [
          {
            buttons: [
              {
                label: isPolish ? 'Przyjęta' : 'Approve',
                icon: Check,
                onClick: onApprove,
                colorScheme: 'emerald' as const,
                flex: true,
                shortcut: 'A',
              },
              {
                label: isPolish ? 'Odrzucona' : 'Reject',
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
    {
      buttons: [
        {
          label: isPolish ? 'Więcej info' : 'More info',
          icon: MessageSquare,
          onClick: onMoreInfo,
          colorScheme: 'neutral' as const,
          flex: true,
          shortcut: 'I',
        },
        ...(canAct
          ? [
              {
                label: isPolish ? 'Deleguj' : 'Delegate',
                icon: UserPlus,
                onClick: onDelegate,
                colorScheme: 'neutral' as const,
                flex: true,
                shortcut: 'G',
              },
            ]
          : [
              {
                label: isPolish ? 'Przypomnij' : 'Remind',
                icon: Bell,
                onClick: onRemind,
                colorScheme: 'blue' as const,
                flex: true,
                shortcut: 'M',
              },
            ]),
      ],
    },
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
        emptyLabel={isPolish ? 'Brak powiązań' : 'No relations'}
      />

      <div className="space-y-2.5 py-1">
        <PreviewActionBar rows={actionRows} />

        <div className="flex gap-2">
          <button onClick={onRemind} className={actionPillClass('neutral', 'flex-1')}>
            <Bell size={14} />
            {isPolish ? 'Przypomnij' : 'Remind'}
          </button>
          <button onClick={onEscalate} className={actionPillClass('amber', '')}>
            <TrendingUp size={14} />
            {isPolish ? 'Eskaluj' : 'Escalate'}
          </button>
          <div className="relative flex-1">
            <button
              onClick={onToggleSnooze}
              className={actionPillClass('neutral', 'w-full flex-1')}
            >
              <AlarmClockOff size={14} />
              {isPolish ? 'Odłóż' : 'Snooze'}
              <ChevronDown
                size={12}
                className={`transition-transform ${snoozeOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {snoozeOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={onCloseSnooze} />
                <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-c-border bg-c-surface-raised shadow-xl overflow-hidden">
                  {(['1h', '4h', 'tomorrow', 'week'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => onSnooze(p)}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-c-surface text-c-text-secondary"
                    >
                      {labelForSnoozePreset(p, isPolish)}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
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
          toast.success(isPolish ? 'Skopiowano' : 'Copied');
        } catch {
          toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
        }
        setDetailsMenuOpen(false);
        return;
      }

      try {
        setDetailsLoading(true);
        setDetailsMenuOpen(false);
        const language = isPolish ? 'pl' : 'en';
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
        toast.error(isPolish ? 'AI niedostępne' : 'AI unavailable');
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
        setAiError(isPolish ? 'AI niedostępne' : 'AI unavailable');
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
      toast.success(isPolish ? 'Skopiowano' : 'Copied');
    } catch {
      toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
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
          ? isPolish
            ? 'Zatwierdzono'
            : 'Approved'
          : isPolish
            ? 'Odrzucono'
            : 'Rejected'
      );
      onDidMutate?.();
      await fetchDetails();
    } catch (e) {
      toast.error(isPolish ? 'Nie udało się wykonać akcji' : 'Action failed');
    }
  };

  const handleDefer = async () => {
    if (!decisionId) return;
    try {
      await Api.decideDecision(decisionId, 'deferred', isPolish ? 'Odroczone' : 'Deferred');
      toast.success(isPolish ? 'Odroczono' : 'Deferred');
      onDidMutate?.();
      await fetchDetails();
    } catch {
      toast.error(isPolish ? 'Nie udało się odroczyć' : 'Failed to defer');
    }
  };

  const handleRemind = async () => {
    if (!decisionId) return;
    try {
      await Api.remindDecision(decisionId);
      toast.success(isPolish ? 'Wysłano przypomnienie' : 'Reminder sent');
    } catch (e: any) {
      const msg = String(e?.message || '');
      toast.error(
        msg.includes('recent')
          ? isPolish
            ? 'Przypomnienie było niedawno wysłane'
            : 'Reminder recently sent'
          : isPolish
            ? 'Nie udało się wysłać przypomnienia'
            : 'Failed to send reminder'
      );
    }
  };

  const handleEscalate = async () => {
    if (!decisionId) return;
    try {
      await Api.escalateDecision(
        decisionId,
        isPolish
          ? 'Eskalacja z preview — wymaga reakcji'
          : 'Escalated from preview — needs attention'
      );
      toast.success(isPolish ? 'Eskaluowano' : 'Escalated');
      onDidMutate?.();
      await fetchDetails();
    } catch {
      toast.error(isPolish ? 'Nie udało się eskalować' : 'Failed to escalate');
    }
  };

  const handleSnooze = async (preset: DecisionSnoozePreset) => {
    if (!decisionId) return;
    try {
      await Api.snoozeDecision(decisionId, { preset });
      toast.success(isPolish ? 'Odłożono' : 'Snoozed');
      onDidMutate?.();
      onClose();
    } catch (e) {
      toast.error(isPolish ? 'Nie udało się odłożyć' : 'Failed to snooze');
    }
  };

  if (!decisionId) {
    return (
      <aside className="w-[420px] flex-shrink-0 bg-c-bg h-full p-3">
        <PreviewPaneShell
          kicker={isPolish ? 'Podgląd' : 'Preview'}
          title={isPolish ? 'Decyzja' : 'Decision'}
          onClose={onClose}
        >
          <div className="h-full flex items-center justify-center p-6 text-center">
            <div className="text-sm text-c-text-muted">
              {isPolish
                ? 'Wybierz decyzję z listy, aby zobaczyć podgląd.'
                : 'Select a decision to preview.'}
            </div>
          </div>
        </PreviewPaneShell>
      </aside>
    );
  }

  return (
    <aside className="w-[420px] flex-shrink-0 bg-c-bg h-full p-3 overflow-hidden">
      <PreviewPaneShell
        kicker={
          mode === 'requests_pending'
            ? isPolish
              ? 'Moja prośba'
              : 'My request'
            : isPolish
              ? 'Podgląd'
              : 'Preview'
        }
        title={decision?.title || (isPolish ? 'Decyzja' : 'Decision')}
        onClose={onClose}
        actions={
          <button
            onClick={() => onOpenFullDetail(decisionId, decision)}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-full border border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
            title={isPolish ? 'Otwórz pełny widok' : 'Open full detail'}
          >
            <ExternalLink size={13} />
            {isPolish ? 'Otwórz' : 'Open'}
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
            onMoreInfo={() => onOpenFullDetail(decisionId, decision)}
            onRemind={handleRemind}
            onEscalate={handleEscalate}
            snoozeOpen={snoozeOpen}
            onToggleSnooze={() => setSnoozeOpen((v) => !v)}
            onCloseSnooze={() => setSnoozeOpen(false)}
            onSnooze={(preset) => {
              setSnoozeOpen(false);
              void handleSnooze(preset);
            }}
          />
        }
      >
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-c-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{isPolish ? 'Ładowanie…' : 'Loading…'}</span>
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
