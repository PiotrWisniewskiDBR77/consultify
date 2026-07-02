/**
 * DecisionsSection
 *
 * Task-like table for decisions linked to the initiative.
 * Follows the same ergonomics as TasksMilestonesSection:
 *   title | type | status | owner | due | priority | row actions
 *
 * @see docs/ui-standards/02-components/initiative-sections.md §Decisions card
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  Edit3,
  ExternalLink,
  Loader2,
  MoreVertical,
  Plus,
  Scale,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Callout, EmptyStateInline } from '@/components/shared/NModeBlocks';
import { Api } from '@/services/api';

import { useInitiativeContext } from './InitiativeContext';
import type { Decision, InitiativeSectionProps } from './types';

// ==========================================
// STATUS CONFIG (aligned with decision-panel.md)
// ==========================================

const DECISION_STATUS_CONFIG: Record<
  string,
  { label: { en: string; pl: string }; dotColor: string; bgColor: string; textColor: string }
> = {
  PENDING: {
    label: { en: 'Pending', pl: 'Oczekująca' },
    dotColor: 'bg-amber-500 animate-pulse',
    bgColor: 'bg-amber-100 dark:bg-amber-500/20',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  APPROVED: {
    label: { en: 'Approved', pl: 'Zatwierdzona' },
    dotColor: 'bg-emerald-500',
    bgColor: 'bg-emerald-100 dark:bg-emerald-500/20',
    textColor: 'text-emerald-600 dark:text-emerald-400',
  },
  REJECTED: {
    label: { en: 'Rejected', pl: 'Odrzucona' },
    dotColor: 'bg-danger-500',
    bgColor: 'bg-danger-100 dark:bg-danger-500/20',
    textColor: 'text-danger-600 dark:text-danger-400',
  },
  ESCALATED: {
    label: { en: 'Escalated', pl: 'Eskalowana' },
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-100 dark:bg-amber-500/20',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  DEFERRED: {
    label: { en: 'Deferred', pl: 'Odroczona' },
    dotColor: 'bg-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-500/20',
    textColor: 'text-slate-600 dark:text-slate-400',
  },
};

// ==========================================
// TYPE CONFIG (decision categories)
// ==========================================

const DECISION_TYPE_LABELS: Record<string, { en: string; pl: string }> = {
  GOVERNANCE_DECISION_MAKING: { en: 'Go/No-Go', pl: 'Go/No-Go' },
  GO_NO_GO: { en: 'Go/No-Go', pl: 'Go/No-Go' },
  RESOURCE_RESPONSIBILITY: { en: 'Resources Commit', pl: 'Zobowiązanie zasobów' },
  SCHEDULE_MILESTONES: { en: 'Schedule Lock', pl: 'Blokada harmonogramu' },
  BUDGET_APPROVAL: { en: 'Budget Approval', pl: 'Zatwierdzenie budżetu' },
  SCOPE_CHANGE: { en: 'Scope Change', pl: 'Zmiana zakresu' },
  RISK_ACCEPTANCE: { en: 'Risk Acceptance', pl: 'Akceptacja ryzyka' },
  RESOURCE_ALLOCATION: { en: 'Resource Allocation', pl: 'Alokacja zasobów' },
  STRATEGIC: { en: 'Strategic', pl: 'Strategiczna' },
  EXECUTION: { en: 'Execution', pl: 'Wykonawcza' },
  GENERAL: { en: 'General', pl: 'Ogólna' },
  OTHER: { en: 'Other', pl: 'Inna' },
};

// ==========================================
// PRIORITY CONFIG
// ==========================================

const PRIORITY_CONFIG: Record<string, { label: { en: string; pl: string }; color: string }> = {
  LOW: { label: { en: 'Low', pl: 'Niski' }, color: 'text-slate-500' },
  MEDIUM: { label: { en: 'Medium', pl: 'Średni' }, color: 'text-blue-500' },
  HIGH: { label: { en: 'High', pl: 'Wysoki' }, color: 'text-amber-500' },
  CRITICAL: { label: { en: 'Critical', pl: 'Krytyczny' }, color: 'text-danger-600 font-bold' },
};

// ==========================================
// SOURCE CONFIG (Manual / AI)
// ==========================================

const SOURCE_CONFIG: Record<
  string,
  { label: { en: string; pl: string }; icon: typeof User; color: string }
> = {
  manual: {
    label: { en: 'Manual', pl: 'Ręczny' },
    icon: User,
    color: 'text-slate-500 dark:text-slate-400',
  },
  ai: {
    label: { en: 'AI', pl: 'AI' },
    icon: Sparkles,
    color: 'text-primary-500 dark:text-primary-400',
  },
};

// ==========================================
// HELPERS
// ==========================================

function normalizeStatus(s: string): string {
  const upper = s.toUpperCase();
  if (upper === 'PENDING' || upper === 'OPEN') return 'PENDING';
  if (upper === 'APPROVED') return 'APPROVED';
  if (upper === 'REJECTED') return 'REJECTED';
  if (upper === 'ESCALATED') return 'ESCALATED';
  if (upper === 'DEFERRED') return 'DEFERRED';
  return upper;
}

const formatDueDate = (value?: string) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
};

type AIDecisionProposal = {
  add: Array<{
    title: string;
    type: string;
    rationale?: string;
  }>;
  remove: Array<{
    decisionId: string;
    reason: string;
  }>;
  reorder?: {
    /** Recommended decision order by decisionId (existing decisions only). */
    order: string[];
    note?: string;
  };
};

type RemovalCandidate = {
  decisionId: string;
  title: string;
  why: string;
};

function normalizeDecisionTitleForDedupe(title: string): string {
  const t = String(title || '')
    .trim()
    .toLowerCase()
    .replace(/\s+—\s+.+$/g, '')
    .replace(/\s+/g, ' ');
  return t.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
}

function buildDecisionRemovalCandidates(decisions: Decision[]): RemovalCandidate[] {
  const candidates: RemovalCandidate[] = [];
  const seen = new Map<string, string>();

  const junkPatterns: Array<{ re: RegExp; why: string }> = [
    { re: /\b(test|demo|dummy)\b/i, why: 'Test/demo placeholder — not a real decision.' },
    { re: /^test[-_\s]*decision/i, why: 'Test placeholder — not a real decision.' },
    { re: /\b(wip|tmp|temp)\b/i, why: 'Temporary/WIP placeholder — not a real decision.' },
  ];

  const tooShort = (s: string) => String(s || '').trim().length < 6;
  const looksLikeGarbage = (s: string) =>
    /^\?+$/.test(s.trim()) ||
    /^[\d\W_]+$/.test(s.trim()) ||
    /^(new decision|decision)$/i.test(s.trim());

  for (const d of decisions) {
    const id = String(d.id);
    const title = String(d.title || '').trim();
    const norm = normalizeDecisionTitleForDedupe(title);

    if (!title) {
      candidates.push({
        decisionId: id,
        title: '(empty title)',
        why: 'Empty title — invalid decision.',
      });
      continue;
    }

    if (looksLikeGarbage(title) || tooShort(title)) {
      candidates.push({ decisionId: id, title, why: 'Low-quality placeholder title.' });
      continue;
    }

    for (const jp of junkPatterns) {
      if (jp.re.test(title)) {
        candidates.push({ decisionId: id, title, why: jp.why });
        break;
      }
    }

    if (norm) {
      if (seen.has(norm)) {
        candidates.push({ decisionId: id, title, why: 'Duplicate decision (same intent/title).' });
      } else {
        seen.set(norm, id);
      }
    }
  }

  return candidates;
}

function parseAIJson(raw: string): any | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced?.[1] || text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ==========================================
// GATE TYPE DETECTION
// ==========================================

const GATE_TYPES = new Set([
  'GOVERNANCE_DECISION_MAKING',
  'RESOURCE_RESPONSIBILITY',
  'SCHEDULE_MILESTONES',
  'GO_NO_GO',
]);

// ==========================================
// MAIN SECTION COMPONENT
// ==========================================

export const DecisionsSection: React.FC<InitiativeSectionProps> = ({ readonly }) => {
  const { t } = useTranslation();
  const {
    decisions,
    setDecisions,
    tasks,
    raidItems,
    decisionsAiRequest,
    clearDecisionsAiRequest,
    isPolish,
    onOpenDecision,
    handleRemoveDecision,
    initiative,
    showCreateDecision,
    setShowCreateDecision,
    users,
  } = useInitiativeContext();

  const [menuDecisionId, setMenuDecisionId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDecisionTitle, setNewDecisionTitle] = useState('');
  const [newDecisionDescription, setNewDecisionDescription] = useState('');
  const [newDecisionOwnerId, setNewDecisionOwnerId] = useState('');
  const [newDecisionType, setNewDecisionType] = useState('GENERAL');
  const [newDecisionPriority, setNewDecisionPriority] = useState<
    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  >('MEDIUM');
  const [isCreatingDecision, setIsCreatingDecision] = useState(false);

  const [isAIProposing, setIsAIProposing] = useState(false);
  const [aiProposal, setAiProposal] = useState<AIDecisionProposal | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiNoSuggestionsMessage, setAiNoSuggestionsMessage] = useState<string | null>(null);
  const [selectedAddIdx, setSelectedAddIdx] = useState<Record<number, boolean>>({});
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<Record<string, boolean>>({});
  const [applySuggestedOrder, setApplySuggestedOrder] = useState(false);
  const [decisionOrderOverride, setDecisionOrderOverride] = useState<string[] | null>(null);

  const createTitleInputRef = useRef<HTMLInputElement | null>(null);
  const addTriggered = useRef(false);
  const initiativeId = initiative?.id;
  const aiNoSuggestionsTimerRef = useRef<number | null>(null);

  // Sort: gate decisions + pending first, then by due date (unless AI order override is applied)
  const sortedDecisions = useMemo(() => {
    const list = [...decisions];
    const order = decisionOrderOverride;
    if (order && order.length > 0) {
      const rank = new Map(order.map((id, idx) => [id, idx]));
      return list.sort((a, b) => {
        const ra = rank.has(a.id) ? (rank.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
        const rb = rank.has(b.id) ? (rank.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb;
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return ad - bd;
      });
    }

    return list.sort((a, b) => {
      // Gate decisions on top
      const aIsGate = GATE_TYPES.has(a.type);
      const bIsGate = GATE_TYPES.has(b.type);
      if (aIsGate && !bIsGate) return -1;
      if (!aIsGate && bIsGate) return 1;
      // Pending first
      const aIsPending = !['APPROVED', 'REJECTED'].includes(normalizeStatus(a.status));
      const bIsPending = !['APPROVED', 'REJECTED'].includes(normalizeStatus(b.status));
      if (aIsPending && !bIsPending) return -1;
      if (!aIsPending && bIsPending) return 1;
      // Then by due date
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });
  }, [decisions, decisionOrderOverride]);

  const approvedCount = useMemo(
    () => decisions.filter((d) => normalizeStatus(d.status) === 'APPROVED').length,
    [decisions]
  );

  // Gate-blocking decisions: PENDING Go/No-Go decisions are the gate-blocking
  // calls that must be resolved before the initiative can be promoted past its
  // next gate (see docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md).
  const gateBlockingDecisions = useMemo(
    () =>
      sortedDecisions.filter(
        (d) => d.type === 'GO_NO_GO' && normalizeStatus(d.status) === 'PENDING'
      ),
    [sortedDecisions]
  );

  const closeMenu = useCallback(() => setMenuDecisionId(null), []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuDecisionId) return;
    const onDocClick = () => setMenuDecisionId(null);
    const t = setTimeout(() => document.addEventListener('click', onDocClick), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', onDocClick);
    };
  }, [menuDecisionId]);

  // Auto-focus modal title input
  useEffect(() => {
    if (showCreateModal) {
      setTimeout(() => createTitleInputRef.current?.focus(), 20);
    }
  }, [showCreateModal]);

  // Handle external "New" trigger from toolbar
  useEffect(() => {
    if (showCreateDecision && !addTriggered.current) {
      addTriggered.current = true;
      if (!readonly) {
        setNewDecisionTitle('');
        setNewDecisionDescription('');
        setNewDecisionOwnerId('');
        setNewDecisionType('GENERAL');
        setNewDecisionPriority('MEDIUM');
        setShowCreateModal(true);
      }
      setShowCreateDecision(false);
      setTimeout(() => {
        addTriggered.current = false;
      }, 300);
    }
  }, [showCreateDecision, setShowCreateDecision, readonly]);

  const resetCreateForm = useCallback(() => {
    setNewDecisionTitle('');
    setNewDecisionDescription('');
    setNewDecisionOwnerId('');
    setNewDecisionType('GENERAL');
    setNewDecisionPriority('MEDIUM');
  }, []);

  const handleStartCreate = useCallback(() => {
    if (readonly) return;
    resetCreateForm();
    setShowCreateModal(true);
  }, [readonly, resetCreateForm]);

  const handleCreateDecision = useCallback(async () => {
    if (isCreatingDecision || !newDecisionTitle.trim()) return;
    if (!initiativeId) {
      toast.error(t('initiatives.decisionsSection.missingInitiativeId'));
      return;
    }
    setIsCreatingDecision(true);
    try {
      const priorityLower = String(newDecisionPriority || '').toLowerCase();
      const res = await Api.post('/decisions', {
        title: newDecisionTitle.trim(),
        description: newDecisionDescription.trim() || undefined,
        type: newDecisionType,
        decisionType: newDecisionType,
        decisionOwnerId: newDecisionOwnerId || undefined,
        relatedObjectId: initiativeId,
        relatedObjectType: 'initiative',
        priority:
          priorityLower === 'low' ||
          priorityLower === 'medium' ||
          priorityLower === 'high' ||
          priorityLower === 'critical'
            ? priorityLower
            : undefined,
        status: 'PENDING',
      });
      const created: Decision = {
        id: res.id,
        title: res.title || newDecisionTitle.trim(),
        description: res.description || newDecisionDescription.trim() || undefined,
        type: res.decisionType || res.type || newDecisionType,
        status: res.status || 'PENDING',
        priority: (res.priority || undefined) as any,
        decisionMakerId: res.decisionOwnerId || res.decisionMakerId || undefined,
        ownerName: res.ownerName || undefined,
        requestedByName: res.requestedByName || undefined,
        dueDate: res.dueDate || undefined,
        createdAt: res.createdAt || new Date().toISOString(),
        isOverdue: false,
        daysOverdue: 0,
        source: 'manual',
      };
      setDecisions((prev) => [...prev, created]);
      setShowCreateModal(false);
      resetCreateForm();
      toast.success(t('initiatives.decisionsSection.decisionCreated'));
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.decisionsSection.failedToCreateDecision'));
    } finally {
      setIsCreatingDecision(false);
    }
  }, [
    isCreatingDecision,
    newDecisionTitle,
    newDecisionDescription,
    newDecisionOwnerId,
    newDecisionType,
    newDecisionPriority,
    initiativeId,
    setDecisions,
    isPolish,
    resetCreateForm,
    t,
  ]);

  const handleDuplicateDecision = useCallback(
    async (decision: Decision) => {
      if (readonly) return;
      if (!initiativeId) {
        toast.error(t('initiatives.decisionsSection.missingInitiativeId'));
        return;
      }
      try {
        const title = (decision.title || '').trim();
        const copySuffix = ` (${t('initiatives.decisionsSection.copy')})`;
        const newDecisionFallbackTitle = `${t('initiatives.decisionsSection.newDecision')}${copySuffix}`;
        const priorityLower = String(decision.priority || '').toLowerCase();
        const res = await Api.post('/decisions', {
          title: title ? `${title}${copySuffix}` : newDecisionFallbackTitle,
          description: decision.description || undefined,
          type: decision.type || 'GENERAL',
          decisionType: decision.type || 'GENERAL',
          relatedObjectId: initiativeId,
          relatedObjectType: 'initiative',
          priority:
            priorityLower === 'low' ||
            priorityLower === 'medium' ||
            priorityLower === 'high' ||
            priorityLower === 'critical'
              ? priorityLower
              : undefined,
          status: 'PENDING',
        });
        const duplicated: Decision = {
          id: res.id,
          title: res.title || (title ? `${title}${copySuffix}` : newDecisionFallbackTitle),
          description: res.description || decision.description,
          type: res.decisionType || res.type || decision.type || 'GENERAL',
          status: res.status || 'PENDING',
          priority: (res.priority || undefined) as any,
          decisionMakerId: res.decisionOwnerId || res.decisionMakerId || undefined,
          ownerName: res.ownerName || undefined,
          requestedByName: res.requestedByName || undefined,
          dueDate: res.dueDate || undefined,
          createdAt: res.createdAt || new Date().toISOString(),
          isOverdue: false,
          daysOverdue: 0,
          source: 'manual',
        };
        setDecisions((prev) => [...prev, duplicated]);
        toast.success(t('initiatives.decisionsSection.decisionDuplicated'));
      } catch {
        toast.error(t('initiatives.decisionsSection.failedToDuplicateDecision'));
      }
    },
    [initiativeId, isPolish, readonly, setDecisions, t]
  );

  const handleRemove = useCallback(
    async (id: string) => {
      if (handleRemoveDecision) {
        await handleRemoveDecision(id);
      }
    },
    [handleRemoveDecision]
  );

  const closeAIModal = useCallback(() => {
    setShowAIModal(false);
    setAiProposal(null);
    setSelectedAddIdx({});
    setSelectedRemoveIds({});
    setApplySuggestedOrder(false);
  }, []);

  const normalizeDecisionType = useCallback((type: any): string => {
    const t = String(type || '').trim();
    if (!t) return 'GENERAL';
    const upper = t.toUpperCase();
    const allowed = new Set(Object.keys(DECISION_TYPE_LABELS));
    if (allowed.has(upper)) return upper;
    // Common aliases
    if (upper === 'GO/NO-GO' || upper === 'GONOGO') return 'GO_NO_GO';
    if (upper === 'BUDGET') return 'BUDGET_APPROVAL';
    if (upper === 'SCOPE') return 'SCOPE_CHANGE';
    if (upper === 'RESOURCES') return 'RESOURCE_ALLOCATION';
    return 'GENERAL';
  }, []);

  const proposeOneDecisionWithAI = useCallback(async () => {
    if (readonly) return;
    setIsAIProposing(true);
    setAiNoSuggestionsMessage(null);
    try {
      const aiLanguage = isPolish ? 'pl' : 'en';
      const targetLanguageName = isPolish ? 'Polish' : 'English';
      const existingCompact = decisions
        .map((d) => ({
          id: String(d.id),
          title: String(d.title || ''),
          type: String(d.type || ''),
          status: normalizeStatus(String(d.status || 'PENDING')),
        }))
        .slice(0, 80);

      const systemInstruction = [
        `You are a senior PMO governance lead.`,
        `Propose exactly ONE additional decision that should be requested for this initiative.`,
        `A "decision" is an approval/commitment/Go-No-Go choice that unblocks work or reduces risk (not a task).`,
        `Rules:`,
        `- Title is a clear decision statement (e.g., "Approve X", "Select vendor Y", "Go/No-Go for pilot").`,
        `- Keep it atomic: one decision per item.`,
        `- Do NOT invent facts, dates, owners, budgets, KPIs, vendors, systems, or scope details that are not in context.`,
        `- Do NOT propose due dates, estimates, impact levels, or priorities. We will fill those later in the decision panel.`,
        `- Avoid duplicates of existing decisions (same intent).`,
        `- Choose "type" from the allowed list.`,
        `- Output language MUST be ${targetLanguageName}. Translate if needed.`,
        ``,
        `Allowed types: ${Object.keys(DECISION_TYPE_LABELS).join(', ')}`,
        ``,
        `Return ONLY valid JSON (no markdown, no code fences, no commentary).`,
        `Schema: { "title": string, "type": string, "notes"?: string, "rationale"?: string }`,
      ].join('\n');

      const contextText = [
        `[INITIATIVE CONTEXT]`,
        `Initiative name: ${initiative?.name || ''}`,
        `Status: ${initiative?.status || ''}`,
        `Priority: ${initiative?.priority || ''}`,
        `Summary: ${(initiative?.summary || initiative?.description || '').toString()}`,
        ``,
        `[EXISTING DECISIONS]`,
        JSON.stringify(existingCompact, null, 2),
        ``,
        `[TASKS SNAPSHOT]`,
        JSON.stringify(
          (tasks || []).slice(0, 25).map((t) => ({
            id: String((t as any)?.id),
            title: String((t as any)?.title || ''),
            status: String((t as any)?.status || ''),
            owner: (t as any)?.assigneeName || null,
          })),
          null,
          2
        ),
        ``,
        `[RAID SNAPSHOT]`,
        JSON.stringify(
          (raidItems || []).slice(0, 15).map((r) => ({
            id: String((r as any)?.id),
            type: String((r as any)?.type || ''),
            title: String((r as any)?.title || ''),
            severity: String((r as any)?.severity || ''),
            status: String((r as any)?.status || ''),
          })),
          null,
          2
        ),
      ].join('\n');

      const aiRes = await Api.post('/ai/refine-text?timeoutMs=20000', {
        text: contextText,
        mode: 'generate',
        systemInstruction,
        fieldLabel: 'Add one initiative decision',
        artifactContext: {
          title: initiative?.name || '',
          status: initiative?.status || '',
          priority: initiative?.priority || '',
          type: 'initiative',
        },
        language: aiLanguage,
      });

      const parsed = parseAIJson(String(aiRes?.text || '')) as any;
      const title = String(parsed?.title || '').trim();
      const type = normalizeDecisionType(parsed?.type);
      const notes = String(parsed?.notes || '').trim();
      const rationale = String(parsed?.rationale || '').trim();

      if (!title) {
        toast.error(t('initiatives.decisionsSection.aiReturnedNoDecisionTitle'));
        return;
      }

      setNewDecisionTitle(title);
      setNewDecisionType(type);
      setNewDecisionDescription(
        [notes, rationale ? `\n\nRationale: ${rationale}` : ''].join('').trim()
      );
      setNewDecisionOwnerId('');
      setNewDecisionPriority('MEDIUM');
      setShowCreateModal(true);
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.decisionsSection.failedToProposeDecision'));
    } finally {
      setIsAIProposing(false);
    }
  }, [
    decisions,
    initiative,
    isPolish,
    normalizeDecisionType,
    readonly,
    decisions?.length,
    tasks,
    raidItems,
    t,
  ]);

  const proposeDecisionsWithAI = useCallback(async () => {
    if (readonly) return;
    setIsAIProposing(true);
    setAiNoSuggestionsMessage(null);
    try {
      const aiLanguage = isPolish ? 'pl' : 'en';
      const targetLanguageName = isPolish ? 'Polish' : 'English';
      const existingIds = new Set(decisions.map((d) => String(d.id)));
      const existingNormTitles = new Set(
        decisions.map((d) => normalizeDecisionTitleForDedupe(String(d.title || ''))).filter(Boolean)
      );
      const removalCandidates = buildDecisionRemovalCandidates(decisions);

      const existingDecisionsCompact = decisions.map((d) => ({
        id: String(d.id),
        title: String(d.title || ''),
        type: String(d.type || ''),
        status: normalizeStatus(String(d.status || 'PENDING')),
        dueDate: (d as any)?.dueDate || null,
        priority: String((d as any)?.priority || '').toUpperCase() || null,
        owner: (d as any)?.ownerName || null,
      }));

      const systemInstruction = [
        `You are a senior PMO governance lead.`,
        `Your goal is to propose a lean, high-signal decisions log for this initiative in our delivery application.`,
        `Rules:`,
        `- A decision is an approval/commitment/Go-No-Go choice (NOT a task).`,
        `- Keep the log lean: prefer fewer, higher-quality decisions.`,
        `- Titles must be clear decision statements (verb-led).`,
        `- Do NOT propose due dates, estimates, impact levels, or priorities. We fill those later.`,
        `- Remove suggestions should focus on placeholders/tests/duplicates/low-quality entries.`,
        `- If REMOVAL CANDIDATES are provided, you MUST include up to 5 removals chosen from them (unless you explicitly justify keeping them).`,
        `- It is OK to return zero adds/removes if the decision log is already good; in that case return a reorder proposal only.`,
        `- Do NOT invent facts, systems, vendors, budgets, dates, or owners not present in context.`,
        `- Output language MUST be ${targetLanguageName}. Translate if needed.`,
        ``,
        `Allowed types: ${Object.keys(DECISION_TYPE_LABELS).join(', ')}`,
        ``,
        `Return ONLY valid JSON (no markdown, no code fences, no commentary).`,
        `IMPORTANT: For "remove", you MUST use existing decisionId values only (prefer from REMOVAL CANDIDATES). Never fabricate ids.`,
        `IMPORTANT: For "reorder.order", include only existing decisionIds (from EXISTING DECISIONS). Never fabricate ids.`,
        `Schema:`,
        `{`,
        `  "add": [ { "title": string, "type": string, "rationale"?: string } ],`,
        `  "remove": [ { "decisionId": string, "reason": string } ],`,
        `  "reorder"?: { "order": string[], "note"?: string }`,
        `}`,
        ``,
        `Mode: review. Return 0–6 items in "add" (only missing/high-value). Return 0–5 items in "remove" ONLY if clearly low-quality/duplicate/placeholder; always include a reason. Optionally include "reorder" to suggest better ordering; if you return no adds/removes, you MUST return "reorder".`,
      ].join('\n');

      const contextText = [
        `[INITIATIVE CONTEXT]`,
        `Initiative name: ${initiative?.name || ''}`,
        `Status: ${initiative?.status || ''}`,
        `Priority: ${initiative?.priority || ''}`,
        `Summary: ${(initiative?.summary || initiative?.description || '').toString()}`,
        ``,
        `[EXISTING DECISIONS]`,
        JSON.stringify(existingDecisionsCompact, null, 2),
        ``,
        `[REMOVAL CANDIDATES]`,
        `These are flagged by deterministic quality rules. Prefer removing these if they are truly not real decisions:`,
        JSON.stringify(removalCandidates, null, 2),
        ``,
        `[TASKS SNAPSHOT]`,
        JSON.stringify(
          (tasks || []).slice(0, 25).map((t) => ({
            id: String((t as any)?.id),
            title: String((t as any)?.title || ''),
            status: String((t as any)?.status || ''),
          })),
          null,
          2
        ),
        ``,
        `[RAID SNAPSHOT]`,
        JSON.stringify(
          (raidItems || []).slice(0, 15).map((r) => ({
            id: String((r as any)?.id),
            type: String((r as any)?.type || ''),
            title: String((r as any)?.title || ''),
            severity: String((r as any)?.severity || ''),
            status: String((r as any)?.status || ''),
          })),
          null,
          2
        ),
      ].join('\n');

      const aiRes = await Api.post('/ai/refine-text?timeoutMs=20000', {
        text: contextText,
        mode: 'generate',
        systemInstruction,
        fieldLabel: 'Initiative decisions review',
        artifactContext: {
          title: initiative?.name || '',
          status: initiative?.status || '',
          priority: initiative?.priority || '',
          type: 'initiative',
        },
        language: aiLanguage,
      });

      const parsed = parseAIJson(String(aiRes?.text || '')) as any;
      const proposal: AIDecisionProposal = {
        add: Array.isArray(parsed?.add) ? parsed.add : [],
        remove: Array.isArray(parsed?.remove) ? parsed.remove : [],
        reorder:
          parsed?.reorder && Array.isArray(parsed?.reorder?.order)
            ? { order: parsed.reorder.order, note: parsed.reorder.note }
            : undefined,
      };

      // Normalize add
      const seenAdd = new Set<string>();
      proposal.add = proposal.add
        .map((d: any) => ({
          title: String(d?.title || '').trim(),
          type: normalizeDecisionType(d?.type),
          rationale: d?.rationale ? String(d.rationale).trim() : '',
        }))
        .filter((d) => d.title.length > 0)
        .filter((d) => {
          const norm = normalizeDecisionTitleForDedupe(d.title);
          if (!norm) return true;
          if (existingNormTitles.has(norm)) return false;
          if (seenAdd.has(norm)) return false;
          seenAdd.add(norm);
          return true;
        })
        .sort((a, b) => {
          const aGate = GATE_TYPES.has(a.type);
          const bGate = GATE_TYPES.has(b.type);
          if (aGate !== bGate) return aGate ? -1 : 1;
          return a.title.localeCompare(b.title);
        })
        .slice(0, 15);

      // Normalize remove
      proposal.remove = proposal.remove
        .map((r: any) => ({
          decisionId: String(r?.decisionId || '').trim(),
          reason: String(r?.reason || '').trim(),
        }))
        .filter(
          (r) => r.decisionId.length > 0 && r.reason.length > 0 && existingIds.has(r.decisionId)
        )
        .slice(0, 8);

      // Normalize reorder
      if (proposal.reorder?.order?.length) {
        const unique: string[] = [];
        const seen = new Set<string>();
        for (const id of proposal.reorder.order) {
          const s = String(id);
          if (!existingIds.has(s)) continue;
          if (seen.has(s)) continue;
          seen.add(s);
          unique.push(s);
        }
        // Append any missing existing decisions to keep a stable full order
        const allIds = decisions.map((d) => String(d.id));
        const missing = allIds.filter((id) => !seen.has(id));
        proposal.reorder.order = [...unique, ...missing];
        if (proposal.reorder.order.length === 0) proposal.reorder = undefined;
      }

      const hasAny =
        proposal.add.length > 0 || proposal.remove.length > 0 || !!proposal.reorder?.order?.length;
      if (!hasAny) {
        const msg = t('initiatives.decisionsSection.aiFoundNoChangeSuggestionsDecisions');
        setAiNoSuggestionsMessage(msg);
        if (aiNoSuggestionsTimerRef.current) {
          window.clearTimeout(aiNoSuggestionsTimerRef.current);
        }
        aiNoSuggestionsTimerRef.current = window.setTimeout(() => {
          setAiNoSuggestionsMessage(null);
          aiNoSuggestionsTimerRef.current = null;
        }, 7000);
        return;
      }

      setAiProposal(proposal);
      setSelectedAddIdx(
        Object.fromEntries(proposal.add.map((_, idx) => [idx, true])) as Record<number, boolean>
      );
      setSelectedRemoveIds(
        // Destructive changes are opt-in: default unchecked.
        Object.fromEntries(proposal.remove.map((r) => [r.decisionId, false])) as Record<
          string,
          boolean
        >
      );
      setApplySuggestedOrder(
        !!proposal.reorder?.order?.length &&
          proposal.add.length === 0 &&
          proposal.remove.length === 0
      );
      setShowAIModal(true);
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.decisionsSection.failedToAnalyzeDecisions'));
    } finally {
      setIsAIProposing(false);
    }
  }, [decisions, initiative, isPolish, normalizeDecisionType, readonly, tasks, raidItems, t]);

  const selectedAddCount = useMemo(() => {
    if (!aiProposal) return 0;
    return aiProposal.add.reduce((sum, _d, idx) => sum + (selectedAddIdx[idx] ? 1 : 0), 0);
  }, [aiProposal, selectedAddIdx]);

  const selectedRemoveCount = useMemo(() => {
    if (!aiProposal) return 0;
    return aiProposal.remove.reduce((sum, r) => sum + (selectedRemoveIds[r.decisionId] ? 1 : 0), 0);
  }, [aiProposal, selectedRemoveIds]);

  const applyAIProposal = useCallback(async () => {
    if (!aiProposal) return;
    if (readonly) return;
    if (!initiativeId) {
      toast.error(t('initiatives.decisionsSection.missingInitiativeId'));
      return;
    }
    setIsAIProposing(true);
    try {
      if (applySuggestedOrder && aiProposal.reorder?.order?.length) {
        setDecisionOrderOverride(aiProposal.reorder.order);
      }

      // Removals
      const removeIds = aiProposal.remove
        .filter((r) => !!selectedRemoveIds[r.decisionId])
        .map((r) => r.decisionId);

      if (removeIds.length > 0) {
        const ok = window.confirm(
          t('initiatives.decisionsSection.deleteDecisionsConfirm', { count: removeIds.length })
        );
        if (!ok) return;
      }

      for (const id of removeIds) {
        await handleRemove(id);
      }

      // Additions
      const toAdd = aiProposal.add.filter((_, idx) => !!selectedAddIdx[idx]);
      for (const d of toAdd) {
        const res = await Api.post('/decisions', {
          title: d.title,
          description: d.rationale || undefined,
          type: d.type,
          decisionType: d.type,
          relatedObjectId: initiativeId,
          relatedObjectType: 'initiative',
          status: 'PENDING',
        });
        const created: Decision = {
          id: res.id,
          title: res.title || d.title,
          description: res.description || d.rationale || undefined,
          type: res.decisionType || res.type || d.type,
          status: res.status || 'PENDING',
          priority: (res.priority || undefined) as any,
          decisionMakerId: res.decisionOwnerId || res.decisionMakerId || undefined,
          ownerName: res.ownerName || undefined,
          requestedByName: res.requestedByName || undefined,
          dueDate: res.dueDate || undefined,
          createdAt: res.createdAt || new Date().toISOString(),
          isOverdue: false,
          daysOverdue: 0,
          source: 'ai',
        };
        setDecisions((prev) => [...prev, created]);
      }

      toast.success(t('initiatives.decisionsSection.appliedAiSuggestions'));
      closeAIModal();
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.decisionsSection.failedToApplyAiSuggestions'));
    } finally {
      setIsAIProposing(false);
    }
  }, [
    aiProposal,
    applySuggestedOrder,
    closeAIModal,
    handleRemove,
    initiativeId,
    isPolish,
    readonly,
    selectedAddIdx,
    selectedRemoveIds,
    setDecisions,
    t,
  ]);

  // Triggered from CTA bar (InitiativeDocumentView)
  useEffect(() => {
    if (!decisionsAiRequest) return;
    const run = async () => {
      try {
        if (readonly) return;
        setAiNoSuggestionsMessage(null);
        const mode = decisionsAiRequest.mode;
        if (mode === 'addOne') {
          await proposeOneDecisionWithAI();
        } else {
          await proposeDecisionsWithAI();
        }
      } finally {
        // Keep CTA-bar spinner visible until AI finishes.
        clearDecisionsAiRequest?.();
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionsAiRequest?.nonce]);

  useEffect(() => {
    return () => {
      if (aiNoSuggestionsTimerRef.current) window.clearTimeout(aiNoSuggestionsTimerRef.current);
    };
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            {t('initiatives.decisionsSection.decisions')}
          </h2>
          {decisions.length > 0 && (
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">
              {decisions.length}
            </span>
          )}
          {isAIProposing && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-navy-800/50 px-2 py-0.5 rounded-full">
              <Loader2 size={12} className="animate-spin" />
              {t('initiatives.decisionsSection.aiWorking')}
            </span>
          )}
        </div>
        {!readonly && decisions.length > 0 && (
          <button
            onClick={handleStartCreate}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <Plus size={12} />
            {t('initiatives.decisionsSection.addDecision')}
          </button>
        )}
      </div>

      {aiNoSuggestionsMessage && !showAIModal && (
        <Callout
          variant="purple"
          compact
          title="AI"
          action={
            readonly
              ? undefined
              : {
                  label: t('initiatives.decisionsSection.aiAddDecision'),
                  onClick: () => void proposeOneDecisionWithAI(),
                }
          }
        >
          {aiNoSuggestionsMessage}
        </Callout>
      )}

      {/* AI proposal modal */}
      {showAIModal && aiProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-3xl rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  {t('initiatives.decisionsSection.proposedDecisionChangesAi')}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('initiatives.decisionsSection.selectItemsToAddRemove')}
                </p>
              </div>
              <button
                onClick={closeAIModal}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                title={t('initiatives.decisionsSection.close')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">
              {/* To remove (top) */}
              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {t('initiatives.decisionsSection.toRemove')} ({aiProposal.remove.length})
                  </span>
                  {aiProposal.remove.length > 0 && (
                    <button
                      onClick={() =>
                        setSelectedRemoveIds(
                          Object.fromEntries(
                            aiProposal.remove.map((r) => [r.decisionId, true])
                          ) as Record<string, boolean>
                        )
                      }
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {t('initiatives.decisionsSection.selectAll')}
                    </button>
                  )}
                </div>

                {aiProposal.remove.length === 0 ? (
                  <EmptyStateInline
                    icon={Trash2}
                    dashed={false}
                    className="p-5"
                    message={t('initiatives.decisionsSection.noRemovalSuggestions')}
                    hint={t('initiatives.decisionsSection.decisionsLogOkOnlyAdditionsOrdering')}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {aiProposal.remove.map((r) => {
                      const existing = decisions.find((d) => String(d.id) === String(r.decisionId));
                      return (
                        <label
                          key={r.decisionId}
                          className="flex items-start gap-2 p-2 rounded-xl bg-amber-50/40 dark:bg-amber-500/5 hover:bg-amber-50/70 dark:hover:bg-amber-500/10 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={!!selectedRemoveIds[r.decisionId]}
                            onChange={(e) =>
                              setSelectedRemoveIds((prev) => ({
                                ...prev,
                                [r.decisionId]: e.target.checked,
                              }))
                            }
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-slate-800 dark:text-white">
                              {existing?.title || r.decisionId}
                            </span>
                            <p className="text-xs text-amber-800/90 dark:text-amber-200 mt-0.5">
                              {r.reason}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* To add */}
              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {t('initiatives.decisionsSection.toAdd')} ({aiProposal.add.length})
                  </span>
                  {aiProposal.add.length > 0 && (
                    <button
                      onClick={() =>
                        setSelectedAddIdx(
                          Object.fromEntries(aiProposal.add.map((_, idx) => [idx, true])) as Record<
                            number,
                            boolean
                          >
                        )
                      }
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {t('initiatives.decisionsSection.selectAll')}
                    </button>
                  )}
                </div>

                {aiProposal.add.length === 0 ? (
                  <EmptyStateInline
                    icon={Plus}
                    dashed={false}
                    className="p-5"
                    message={t('initiatives.decisionsSection.noAdditionsProposed')}
                    hint={t('initiatives.decisionsSection.aiMayReturnOnlyRemovalsOrdering')}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {aiProposal.add.map((d, idx) => {
                      const typeLabel = DECISION_TYPE_LABELS[d.type];
                      return (
                        <label
                          key={idx}
                          className="flex items-start gap-2 p-2 rounded-xl bg-white/60 dark:bg-navy-900/30 hover:bg-white/80 dark:hover:bg-navy-900/40 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={!!selectedAddIdx[idx]}
                            onChange={(e) =>
                              setSelectedAddIdx((prev) => ({ ...prev, [idx]: e.target.checked }))
                            }
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-slate-800 dark:text-white">
                                {d.title}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200/60 dark:bg-navy-700/60 text-slate-600 dark:text-slate-300">
                                {isPolish ? typeLabel?.pl || d.type : typeLabel?.en || d.type}
                              </span>
                            </div>
                            {d.rationale ? (
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">
                                {d.rationale}
                              </p>
                            ) : null}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Suggested order */}
              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {t('initiatives.decisionsSection.suggestedOrder')} (
                    {aiProposal.reorder?.order?.length || 0})
                  </span>
                  <label className="inline-flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 select-none">
                    <input
                      type="checkbox"
                      checked={applySuggestedOrder}
                      onChange={(e) => setApplySuggestedOrder(e.target.checked)}
                      disabled={!aiProposal.reorder?.order?.length}
                    />
                    {t('initiatives.decisionsSection.applyOrder')}
                  </label>
                </div>

                {!aiProposal.reorder?.order?.length ? (
                  <EmptyStateInline
                    icon={Sparkles}
                    dashed={false}
                    className="p-5"
                    message={t('initiatives.decisionsSection.noOrderingSuggestion')}
                    hint={t('initiatives.decisionsSection.aiMayReturnWithoutReordering')}
                  />
                ) : (
                  <>
                    {aiProposal.reorder.note ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {aiProposal.reorder.note}
                      </p>
                    ) : null}
                    <ol className="space-y-1.5 list-decimal pl-5">
                      {aiProposal.reorder.order.map((id) => {
                        const existing = decisions.find((d) => String(d.id) === String(id));
                        return (
                          <li key={id} className="text-xs text-slate-700 dark:text-slate-200">
                            {existing?.title || id}
                          </li>
                        );
                      })}
                    </ol>
                  </>
                )}
              </div>

              {/* Plan (bottom) */}
              <Callout variant="purple" title="Plan" compact className="rounded-xl">
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    {t('initiatives.decisionsSection.removeSelectedDecisions', {
                      count: selectedRemoveCount,
                    })}
                  </li>
                  <li>
                    {t('initiatives.decisionsSection.addSelectedDecisions', {
                      count: selectedAddCount,
                    })}
                  </li>
                  <li>
                    {applySuggestedOrder && aiProposal.reorder?.order?.length
                      ? t('initiatives.decisionsSection.applySuggestedOrderingReadability')
                      : t('initiatives.decisionsSection.optionalApplySuggestedOrdering')}
                  </li>
                </ul>
              </Callout>
            </div>

            <div className="px-5 py-4 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center justify-end gap-2">
              <button
                onClick={closeAIModal}
                disabled={isAIProposing}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors disabled:opacity-50"
              >
                {t('initiatives.decisionsSection.cancel')}
              </button>
              <button
                onClick={() => void applyAIProposal()}
                disabled={isAIProposing}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-primary-400/50 text-primary-700 dark:text-primary-300 hover:bg-primary-500/10 transition-colors disabled:opacity-50"
              >
                {isAIProposing ? <Loader2 size={13} className="animate-spin" /> : null}
                {t('initiatives.decisionsSection.apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gate-blocking decisions banner — PENDING Go/No-Go calls block promotion */}
      {gateBlockingDecisions.length > 0 && (
        <div className="rounded-xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 px-3.5 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Scale size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              {isPolish
                ? 'Decyzja bramki — wymagana przed promocją'
                : 'Gate decision — required before promotion'}
            </span>
          </div>
          <ul className="space-y-1.5">
            {gateBlockingDecisions.map((decision) => {
              const statusConfig =
                DECISION_STATUS_CONFIG[normalizeStatus(decision.status)] ||
                DECISION_STATUS_CONFIG.PENDING;
              return (
                <li key={decision.id} className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => onOpenDecision?.(decision.id)}
                    className="text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors truncate"
                  >
                    {decision.title || t('initiatives.decisionsSection.untitled')}
                  </button>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] border border-slate-200/70 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 flex-shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                    {isPolish ? statusConfig.label.pl : statusConfig.label.en}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto overflow-y-visible rounded-xl border border-slate-200 dark:border-navy-700/40">
        <table
          /* §27-exempt: sub-tabela w widoku szczegolow, nie samodzielna lista */ className="w-full text-sm"
        >
          <thead className="sticky top-0 z-10">
            <tr className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-navy-800 border-b border-slate-200 dark:border-navy-700/40">
              <th className="text-left py-2.5 pl-3 pr-2">
                {t('initiatives.decisionsSection.decision')}
              </th>
              <th className="text-left py-2.5 pr-2">{t('initiatives.decisionsSection.type')}</th>
              <th className="text-left py-2.5 pr-2">{t('initiatives.decisionsSection.status')}</th>
              <th className="text-left py-2.5 pr-2">{t('initiatives.decisionsSection.owner')}</th>
              <th className="text-left py-2.5 pr-2">{t('initiatives.decisionsSection.due')}</th>
              <th className="text-left py-2.5 pr-2">
                {t('initiatives.decisionsSection.priority')}
              </th>
              <th className="text-right py-2.5 pr-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
            <AnimatePresence mode="popLayout">
              {sortedDecisions.map((decision) => {
                const status = normalizeStatus(decision.status);
                const statusConfig =
                  DECISION_STATUS_CONFIG[status] || DECISION_STATUS_CONFIG.PENDING;
                const isGate = GATE_TYPES.has(decision.type);
                const typeLabel = DECISION_TYPE_LABELS[decision.type];
                const priorityKey = (decision.priority || '').toUpperCase();
                const priorityCfg = PRIORITY_CONFIG[priorityKey];
                const source = decision.source || 'manual';
                const sourceCfg = SOURCE_CONFIG[source] || SOURCE_CONFIG.manual;

                return (
                  <motion.tr
                    key={decision.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group hover:bg-slate-50/50 dark:hover:bg-navy-800/20 transition-colors"
                  >
                    {/* Decision title */}
                    <td className="py-2.5 pl-3 pr-2">
                      <button
                        onClick={() => onOpenDecision?.(decision.id)}
                        className="text-left text-slate-700 dark:text-slate-200 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors flex items-center gap-2"
                      >
                        <span className="truncate max-w-[220px]">
                          {decision.title || t('initiatives.decisionsSection.untitled')}
                        </span>
                        {isGate && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-400 font-semibold flex-shrink-0">
                            GATE
                          </span>
                        )}
                      </button>
                    </td>

                    {/* Type */}
                    <td className="py-2.5 pr-2 text-xs text-slate-500 dark:text-slate-400">
                      {isPolish ? typeLabel?.pl || decision.type : typeLabel?.en || decision.type}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 pr-2">
                      {/* canon §4.2 — neutral shell; colour carried by the signal dot only */}
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border border-slate-200/70 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                        {isPolish ? statusConfig.label.pl : statusConfig.label.en}
                      </span>
                    </td>

                    {/* Owner */}
                    <td className="py-2.5 pr-2 text-xs text-slate-600 dark:text-slate-300">
                      {decision.ownerName || '—'}
                    </td>

                    {/* Due date */}
                    <td className="py-2.5 pr-2 text-xs text-slate-500 dark:text-slate-400">
                      {decision.dueDate ? (
                        <span
                          className={`inline-flex items-center gap-1 ${decision.isOverdue ? 'text-danger-500 font-medium' : ''}`}
                        >
                          <Calendar size={11} />
                          {formatDueDate(decision.dueDate)}
                          {decision.isOverdue && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-danger-500/20 text-danger-400 font-medium ml-1">
                              {t('initiatives.decisionsSection.overdue')}
                            </span>
                          )}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Priority */}
                    <td className="py-2.5 pr-2 text-xs">
                      <span className={priorityCfg?.color || 'text-slate-500'}>
                        {isPolish
                          ? priorityCfg?.label.pl || decision.priority || '—'
                          : priorityCfg?.label.en || decision.priority || '—'}
                      </span>
                    </td>

                    {/* Row actions */}
                    <td className="py-2.5 pr-3 text-right relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuDecisionId((prev) => (prev === decision.id ? null : decision.id));
                        }}
                        className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/10 transition-colors"
                        title={t('initiatives.decisionsSection.actions')}
                      >
                        <MoreVertical size={14} />
                      </button>
                      {menuDecisionId === decision.id && (
                        <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-slate-200 dark:border-navy-700/70 bg-white dark:bg-navy-900 p-1.5 shadow-xl shadow-slate-900/10 dark:shadow-black/30">
                          <button
                            onClick={() => {
                              closeMenu();
                              onOpenDecision?.(decision.id);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                          >
                            <ExternalLink size={13} />
                            {t('initiatives.decisionsSection.openDecision')}
                          </button>
                          <button
                            onClick={() => {
                              closeMenu();
                              void handleDuplicateDecision(decision);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                          >
                            <Edit3 size={13} />
                            {t('initiatives.decisionsSection.duplicate')}
                          </button>
                          {!readonly && (
                            <>
                              <div className="my-1 border-t border-slate-200 dark:border-navy-700/50" />
                              <button
                                onClick={() => {
                                  closeMenu();
                                  void handleRemove(decision.id);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors"
                              >
                                <Trash2 size={13} />
                                {t('initiatives.decisionsSection.delete')}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>

            {/* Empty state */}
            {sortedDecisions.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  <Scale size={24} className="mx-auto mb-2 text-slate-600 dark:text-slate-400" />
                  <p>{t('initiatives.decisionsSection.noDecisionsYet')}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {t('initiatives.decisionsSection.addGateOrOperationalDecisions')}
                  </p>
                  {!readonly && (
                    <button
                      onClick={handleStartCreate}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                      <Plus size={12} />
                      {t('initiatives.decisionsSection.addDecision')}
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!readonly && showCreateModal && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-navy-700/70 bg-white dark:bg-navy-900 shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700/70 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t('initiatives.decisionsSection.newDecisionTitle')}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-navy-800"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">
                  {t('initiatives.decisionsSection.title')}
                </label>
                <input
                  ref={createTitleInputRef}
                  value={newDecisionTitle}
                  onChange={(e) => setNewDecisionTitle(e.target.value)}
                  placeholder={t('initiatives.decisionsSection.titlePlaceholder')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-sm"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">
                  {t('initiatives.decisionsSection.contextNotes')}
                </label>
                <textarea
                  value={newDecisionDescription}
                  onChange={(e) => setNewDecisionDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">
                    {t('initiatives.decisionsSection.type')}
                  </label>
                  <select
                    value={newDecisionType}
                    onChange={(e) => setNewDecisionType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-sm"
                  >
                    {Object.keys(DECISION_TYPE_LABELS).map((k) => (
                      <option key={k} value={k}>
                        {isPolish ? DECISION_TYPE_LABELS[k].pl : DECISION_TYPE_LABELS[k].en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">
                    {t('initiatives.decisionsSection.priority')}
                  </label>
                  <select
                    value={newDecisionPriority}
                    onChange={(e) =>
                      setNewDecisionPriority(
                        (e.target.value || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-sm"
                  >
                    <option value="LOW">{t('initiatives.decisionsSection.priorityLow')}</option>
                    <option value="MEDIUM">
                      {t('initiatives.decisionsSection.priorityMedium')}
                    </option>
                    <option value="HIGH">{t('initiatives.decisionsSection.priorityHigh')}</option>
                    <option value="CRITICAL">
                      {t('initiatives.decisionsSection.priorityCritical')}
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">
                  Owner
                </label>
                <select
                  value={newDecisionOwnerId}
                  onChange={(e) => setNewDecisionOwnerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-sm"
                >
                  <option value="">{t('initiatives.decisionsSection.none')}</option>
                  {(users || []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-700/70 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
              >
                {t('initiatives.decisionsSection.cancel')}
              </button>
              <button
                onClick={() => void handleCreateDecision()}
                disabled={isCreatingDecision || !newDecisionTitle.trim()}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {isCreatingDecision
                  ? t('initiatives.decisionsSection.creating')
                  : t('initiatives.decisionsSection.createDecision')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer summary */}
      {decisions.length > 0 && (
        <div className="pt-2 border-t border-slate-200/70 dark:border-navy-700/50 text-xs text-slate-500 dark:text-slate-400">
          {approvedCount}/{decisions.length} {t('initiatives.decisionsSection.approved')}
        </div>
      )}
    </motion.div>
  );
};
