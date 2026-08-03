/**
 * TasksMilestonesSection
 *
 * Card-based task management for initiatives.
 * Inspired by ImplementationIdeasSection — each task has its own expandable card
 * with status indicator on the left, full task form, and inline editing.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  Edit3,
  ExternalLink,
  Flag,
  Loader2,
  MoreVertical,
  Plus,
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
import { bumpInitiativeRefresh } from '@/store/useInitiativeRefreshStore';

import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps, TaskItem } from './types';

type AITaskProposal = {
  add: Array<{
    title: string;
    description?: string;
    rationale?: string;
  }>;
  remove: Array<{
    taskId: string;
    reason: string;
  }>;
  reorder?: {
    /** Recommended task order by taskId (existing tasks only). */
    order: string[];
    note?: string;
  };
};

type RemovalCandidate = {
  taskId: string;
  title: string;
  why: string;
};

/**
 * Client-generated key for retry-safe POSTs — a transport-level retry of an
 * in-flight create request resends the same body (same key), so the server's
 * idempotency_key uniqueness check can return the original row instead of
 * inserting a duplicate. See server/migrations/20260801_exe002004_idempotency_keys.sql.
 */
const generateClientRequestId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `creq-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// EXE-02/03/04 gap-fill: backend already exposes POST/GET
// /initiatives/:id/milestones (separate initiative_milestones table), but the
// UI never rendered or created milestones — only tasks. This is the minimal
// local shape for the milestone list rendered in this section.
type MilestoneItem = {
  id: string;
  name: string;
  targetDate?: string | null;
  status?: string;
  isGate?: boolean;
};

// ==========================================
// STATUS CONFIG
// ==========================================

const TASK_STATUS_CONFIG: Record<
  string,
  {
    label: { en: string; pl: string };
    color: string;
    dotColor: string;
    bgColor: string;
    textColor: string;
  }
> = {
  todo: {
    label: { en: 'To Do', pl: 'Do zrobienia' },
    color: 'bg-slate-400',
    dotColor: 'bg-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-500/20',
    textColor: 'text-slate-600 dark:text-slate-400',
  },
  in_progress: {
    label: { en: 'In Progress', pl: 'W trakcie' },
    color: 'bg-blue-500',
    dotColor: 'bg-blue-500 animate-pulse',
    bgColor: 'bg-blue-100 dark:bg-blue-500/20',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  review: {
    label: { en: 'Review', pl: 'Przegląd' },
    color: 'bg-sky-500',
    dotColor: 'bg-navy-900',
    bgColor: 'bg-c-info/10 dark:bg-c-info/20',
    textColor: 'text-c-info dark:text-c-info',
  },
  blocked: {
    label: { en: 'Blocked', pl: 'Zablokowane' },
    color: 'bg-danger-500',
    dotColor: 'bg-danger-500',
    bgColor: 'bg-danger-100 dark:bg-danger-500/20',
    textColor: 'text-danger-600 dark:text-danger-400',
  },
  done: {
    label: { en: 'Done', pl: 'Ukończone' },
    color: 'bg-emerald-500',
    dotColor: 'bg-emerald-500',
    bgColor: 'bg-emerald-100 dark:bg-emerald-500/20',
    textColor: 'text-emerald-600 dark:text-emerald-400',
  },
};

const PRIORITY_CONFIG: Record<string, { label: { en: string; pl: string }; color: string }> = {
  low: { label: { en: 'Low', pl: 'Niski' }, color: 'text-slate-500' },
  medium: { label: { en: 'Medium', pl: 'Średni' }, color: 'text-blue-500' },
  high: { label: { en: 'High', pl: 'Wysoki' }, color: 'text-amber-500' },
  urgent: { label: { en: 'Urgent', pl: 'Pilny' }, color: 'text-danger-500' },
  critical: { label: { en: 'Critical', pl: 'Krytyczny' }, color: 'text-danger-600 font-bold' },
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
    color: 'text-c-info dark:text-c-info',
  },
};

// ==========================================
// HELPER: normalize status for case-insensitive lookup
// ==========================================
function normalizeStatus(s: string): string {
  const lower = s.toLowerCase();
  if (lower === 'in_progress' || lower === 'inprogress') return 'in_progress';
  if (lower === 'todo' || lower === 'to_do') return 'todo';
  if (lower === 'done' || lower === 'completed') return 'done';
  if (lower === 'blocked') return 'blocked';
  if (lower === 'review' || lower === 'in_review') return 'review';
  return lower;
}

function normalizeTaskTitleForDedupe(title: string): string {
  const t = String(title || '')
    .trim()
    .toLowerCase()
    // remove long suffixes often auto-appended like "— Initiative name"
    .replace(/\s+—\s+.+$/g, '')
    .replace(/\s*-\s*.+$/g, (m) => (m.length > 35 ? '' : m))
    .replace(/\s+/g, ' ');
  // strip punctuation-ish noise
  return t.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
}

function buildRemovalCandidates(tasks: TaskItem[]): RemovalCandidate[] {
  const candidates: RemovalCandidate[] = [];
  const seen = new Map<string, string>(); // normTitle -> firstTaskId

  const junkPatterns: Array<{ re: RegExp; why: string }> = [
    { re: /\b(test|demo|dummy)\b/i, why: 'Test/demo placeholder — not a real delivery task.' },
    { re: /\b(wip|tmp|temp)\b/i, why: 'Temporary/WIP placeholder — not a real delivery task.' },
    {
      re: /\b(menu|modal|ui)\b/i,
      why: 'UI/debug item — belongs to dev backlog, not initiative delivery tasks.',
    },
    { re: /\bfix\b/i, why: 'Generic “fix” task without a concrete deliverable/outcome.' },
  ];

  const tooShort = (s: string) => String(s || '').trim().length < 6;
  const looksLikeGarbage = (s: string) =>
    /^\?+$/.test(s.trim()) || /^[\d\W_]+$/.test(s.trim()) || /^(new task|task)$/i.test(s.trim());

  for (const t of tasks) {
    const id = String(t.id);
    const title = String(t.title || '').trim();
    const norm = normalizeTaskTitleForDedupe(title);

    if (!title) {
      candidates.push({ taskId: id, title: '(empty title)', why: 'Empty title — invalid task.' });
      continue;
    }

    if (tooShort(title) || looksLikeGarbage(title)) {
      candidates.push({ taskId: id, title, why: 'Placeholder/garbage title — not actionable.' });
    }

    for (const p of junkPatterns) {
      if (p.re.test(title)) {
        candidates.push({ taskId: id, title, why: p.why });
        break;
      }
    }

    if (norm) {
      const first = seen.get(norm);
      if (!first) {
        seen.set(norm, id);
      } else if (first !== id) {
        candidates.push({
          taskId: id,
          title,
          why: 'Duplicate task title (or same intent) — candidate for removal/merge.',
        });
      }
    }
  }

  // De-dupe candidates by taskId, keep first reason.
  const byId = new Map<string, RemovalCandidate>();
  for (const c of candidates) {
    if (!byId.has(c.taskId)) byId.set(c.taskId, c);
  }
  return Array.from(byId.values()).slice(0, 20);
}

function inferPhaseRank(title: string, description?: string): number {
  const text = `${title || ''}\n${description || ''}`.toLowerCase();
  const has = (re: RegExp) => re.test(text);

  // Rough delivery lifecycle ordering (lower = earlier)
  if (has(/\b(kick[- ]?off|workshop|align|alignment|scope|scoping)\b/i)) return 10;
  if (has(/\b(discover|discovery|as[- ]?is|current state|baseline|diagnos)\b/i)) return 20;
  if (has(/\b(requirements?|spec|specification|acceptance|criteria)\b/i)) return 30;
  if (has(/\b(design|architecture|solution design|blueprint)\b/i)) return 40;
  if (has(/\b(configure|configuration|setup|implement|build|develop|integrat|automation)\b/i))
    return 50;
  if (has(/\b(pilot|test|testing|qa|validate|verification|u[a]?t)\b/i)) return 60;
  if (has(/\b(rollout|deploy|release|go[- ]?live|cutover|launch)\b/i)) return 70;
  if (has(/\b(training|enablement|handover|documentation|doc)\b/i)) return 80;
  if (has(/\b(monitor|stabiliz|hypercare|refine|optimi[sz]e|continuous)\b/i)) return 90;
  return 55; // default to build-ish
}

function inferRemovalRank(reason: string): number {
  const r = String(reason || '').toLowerCase();
  if (r.includes('test/demo') || r.includes('placeholder') || r.includes('wip')) return 10;
  if (r.includes('duplicate')) return 20;
  if (r.includes('out-of-scope') || r.includes('out of scope')) return 30;
  if (r.includes('garbage') || r.includes('not actionable') || r.includes('low-quality')) return 40;
  return 50;
}

const formatDueDate = (value?: string) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
};

// ==========================================
// MAIN SECTION COMPONENT
// ==========================================

export const TasksMilestonesSection: React.FC<InitiativeSectionProps> = ({ readonly }) => {
  const { t } = useTranslation();
  const {
    tasks,
    setTasks,
    tasksDone,
    isPolish,
    onOpenTask,
    users,
    initiative,
    showCreateTask,
    setShowCreateTask,
    tasksAiRequest,
    clearTasksAiRequest,
  } = useInitiativeContext();

  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [isAIProposing, setIsAIProposing] = useState(false);
  const [aiProposal, setAiProposal] = useState<AITaskProposal | null>(null);
  const [aiNoSuggestionsMessage, setAiNoSuggestionsMessage] = useState<string | null>(null);
  const aiNoSuggestionsTimerRef = useRef<number | null>(null);
  const [selectedAddIdx, setSelectedAddIdx] = useState<Record<number, boolean>>({});
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<Record<string, boolean>>({});
  const [applySuggestedOrder, setApplySuggestedOrder] = useState(false);
  const [taskOrderOverride, setTaskOrderOverride] = useState<string[] | null>(null);
  const [aiMode, setAiMode] = useState<'generate' | 'review'>('generate');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(true);
  const [milestonesLoadError, setMilestonesLoadError] = useState(false);
  const [showCreateMilestoneModal, setShowCreateMilestoneModal] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [isCreatingMilestone, setIsCreatingMilestone] = useState(false);
  const [taskQuery, setTaskQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [dueFilter, setDueFilter] = useState<'all' | 'upcoming' | 'overdue' | 'no_due'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'ai'>('all');
  const addTriggered = useRef(false);
  const createTitleInputRef = useRef<HTMLInputElement | null>(null);
  const createMilestoneTitleInputRef = useRef<HTMLInputElement | null>(null);
  const initiativeId = initiative?.id;
  const projectId =
    initiative?.projectId || initiative?.project_id || initiative?.project?.id || null;

  const closeAIModal = useCallback(() => {
    setShowAIModal(false);
    setAiProposal(null);
    setSelectedAddIdx({});
    setSelectedRemoveIds({});
    setApplySuggestedOrder(false);
  }, []);

  useEffect(() => {
    return () => {
      if (aiNoSuggestionsTimerRef.current) window.clearTimeout(aiNoSuggestionsTimerRef.current);
    };
  }, []);

  const parseAIJson = (raw: string): any | null => {
    const text = String(raw || '').trim();
    if (!text) return null;
    // Prefer fenced json if present
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = (fenced?.[1] || text).trim();
    try {
      return JSON.parse(candidate);
    } catch {
      // Try to extract first JSON object
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
  };

  const proposeOneTaskWithAI = useCallback(async () => {
    if (readonly) return;
    setIsAIProposing(true);
    setAiNoSuggestionsMessage(null);
    try {
      const aiLanguage = isPolish ? 'pl' : 'en';
      const targetLanguageName = t('initiatives.tasksMilestonesSection.english');
      const existingTitles = tasks
        .map((t) => String(t.title || '').trim())
        .filter(Boolean)
        .slice(0, 80);

      const systemInstruction = [
        `You are a senior PMO delivery lead.`,
        `Propose exactly ONE additional task for this initiative.`,
        `Rules:`,
        `- Title starts with a strong verb and describes one deliverable/outcome (atomic).`,
        `- Description contains assumptions/notes and optionally 2–6 short hyphen bullets for acceptance criteria.`,
        `- Do NOT propose dates, estimates, or priorities. We will fill those later in the task panel.`,
        `- Avoid duplicates of existing tasks (same intent).`,
        `- Do NOT invent project facts, systems, numbers, owners, KPIs, or deadlines that are not in context.`,
        `- Output language MUST be ${targetLanguageName}. Translate if needed.`,
        ``,
        `Return ONLY valid JSON (no markdown, no code fences, no commentary).`,
        `Schema: { "title": string, "description": string, "rationale"?: string }`,
      ].join('\n');

      const contextText = [
        `[INITIATIVE CONTEXT]`,
        `Initiative name: ${initiative?.name || ''}`,
        `Status: ${initiative?.status || ''}`,
        `Priority: ${initiative?.priority || ''}`,
        `Summary: ${(initiative?.summary || initiative?.description || '').toString()}`,
        `Scope (if available): ${JSON.stringify(initiative?.scope || null)}`,
        `Target state (if available): ${JSON.stringify(initiative?.targetState || initiative?.target_state || null)}`,
        `Problem definition (if available): ${JSON.stringify(initiative?.problemDefinition || initiative?.problem_definition || initiative?.problemStatement || initiative?.problem_statement || null)}`,
        ``,
        `[EXISTING TASK TITLES]`,
        JSON.stringify(existingTitles, null, 2),
      ].join('\n');

      const aiRes = await Api.post('/ai/refine-text?timeoutMs=20000', {
        text: contextText,
        mode: 'generate',
        systemInstruction,
        fieldLabel: 'Add one initiative task',
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
      const description = String(parsed?.description || '').trim();
      const rationale = String(parsed?.rationale || '').trim();

      if (!title) {
        toast.error(t('initiatives.tasksMilestonesSection.aiReturnedNoTaskTitle'));
        return;
      }

      setNewTaskTitle(title);
      setNewTaskDescription(
        [description, rationale ? `\n\nRationale: ${rationale}` : ''].join('').trim()
      );
      setNewTaskAssigneeId('');
      setShowCreateModal(true);
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.tasksMilestonesSection.failedToProposeTask'));
    } finally {
      setIsAIProposing(false);
    }
  }, [initiative, isPolish, parseAIJson, readonly, tasks, t]);

  const proposeTasksWithAI = useCallback(
    async (mode: 'generate' | 'review') => {
      if (readonly) return;
      setIsAIProposing(true);
      setAiNoSuggestionsMessage(null);
      setAiMode(mode);
      try {
        const aiLanguage = isPolish ? 'pl' : 'en';
        const targetLanguageName = t('initiatives.english');
        const removalCandidates = mode === 'review' ? buildRemovalCandidates(tasks) : [];
        const existingTasksCompact = tasks.map((t) => ({
          id: String(t.id),
          title: t.title || '',
          status: normalizeStatus(t.status || 'todo'),
          priority: String(t.priority || 'medium').toLowerCase(),
          dueDate: t.dueDate || null,
          owner: t.assigneeName || null,
        }));

        const systemInstruction = [
          `You are a senior PMO delivery lead.`,
          `Your goal is to propose a practical task backlog for executing an initiative in our delivery application.`,
          `You MUST follow our task methodology:`,
          `- Each task title starts with a strong verb and describes a single deliverable/outcome (atomic, actionable).`,
          `- Descriptions are concise but specific; include acceptance criteria or checklist as short hyphen bullets when useful.`,
          `- Default status for new tasks: "todo".`,
          `- Do NOT propose due dates, estimates, or priorities. We will fill those later in the task panel.`,
          `- Provide "add" tasks in a logical execution order (from discovery/scope -> design -> build -> test/pilot -> rollout -> enablement -> monitoring).`,
          `- Keep the backlog lean. Prefer fewer, higher-quality tasks over many generic tasks.`,
          `- It is OK to return zero additions/removals if the backlog is already good; in that case, return a reorder proposal only.`,
          `- Remove suggestions should focus on items that are NOT real delivery tasks (tests/demos/debug), duplicates, out-of-scope, or low-quality placeholders.`,
          `- If removal candidates are provided, you MUST include up to 5 removals chosen from them (unless you can explicitly justify keeping them).`,
          `- Do NOT invent project facts, systems, dates, numbers, owners, or KPIs that are not in the provided context.`,
          `- Output language MUST be ${targetLanguageName}. Translate if needed.`,
          ``,
          `Return ONLY valid JSON (no markdown, no code fences, no commentary).`,
          `IMPORTANT: For "remove", you MUST use existing taskIds only (prefer from REMOVAL CANDIDATES). Never fabricate taskId values.`,
          `IMPORTANT: For "reorder.order", include only existing taskIds (from EXISTING TASKS). Never fabricate ids.`,
          `Schema:`,
          `{`,
          `  "add": [`,
          `    { "title": string, "description"?: string, "rationale"?: string }`,
          `  ],`,
          `  "remove": [`,
          `    { "taskId": string, "reason": string }`,
          `  ]`,
          `  "reorder"?: { "order": string[], "note"?: string }`,
          `}`,
          ``,
          mode === 'generate'
            ? `Mode: generate an initial backlog. Return 8–14 tasks in "add". "remove" MUST be empty. Do not include "reorder".`
            : `Mode: review the existing backlog. Return 0–6 tasks in "add" (missing/valuable). Return 0–5 items in "remove" ONLY if clearly redundant, out-of-scope, placeholder, or low-quality; always include a reason. Optionally include "reorder" to suggest a better sequence; if you return no adds/removes, you MUST return "reorder".`,
        ].join('\n');

        const contextText = [
          `[INITIATIVE CONTEXT]`,
          `Initiative name: ${initiative?.name || ''}`,
          `Status: ${initiative?.status || ''}`,
          `Priority: ${initiative?.priority || ''}`,
          `Summary: ${(initiative?.summary || initiative?.description || '').toString()}`,
          `Target date: ${initiative?.plannedEndDate || initiative?.targetDate || ''}`,
          `Scope (if available): ${JSON.stringify(initiative?.scope || null)}`,
          `Target state (if available): ${JSON.stringify(initiative?.targetState || initiative?.target_state || null)}`,
          `Problem definition (if available): ${JSON.stringify(initiative?.problemDefinition || initiative?.problem_definition || null)}`,
          ``,
          `[EXISTING TASKS]`,
          JSON.stringify(existingTasksCompact, null, 2),
          mode === 'review'
            ? [
                ``,
                `[REMOVAL CANDIDATES]`,
                `These are flagged by deterministic quality rules. Prefer removing these if they are truly not delivery tasks:`,
                JSON.stringify(removalCandidates, null, 2),
              ].join('\n')
            : '',
        ].join('\n');

        const aiRes = await Api.post('/ai/refine-text?timeoutMs=20000', {
          text: contextText,
          mode: 'generate',
          systemInstruction,
          fieldLabel: mode === 'generate' ? 'Initiative tasks backlog' : 'Initiative tasks review',
          artifactContext: {
            title: initiative?.name || '',
            status: initiative?.status || '',
            priority: initiative?.priority || '',
            type: 'initiative',
          },
          language: aiLanguage,
        });

        const parsed = parseAIJson(String(aiRes?.text || ''));
        const proposal: AITaskProposal = {
          add: Array.isArray(parsed?.add) ? parsed.add : [],
          remove: Array.isArray(parsed?.remove) ? parsed.remove : [],
          reorder:
            parsed?.reorder && Array.isArray(parsed?.reorder?.order)
              ? { order: parsed.reorder.order, note: parsed.reorder.note }
              : Array.isArray(parsed?.order)
                ? { order: parsed.order, note: parsed.note }
                : undefined,
        };

        // Basic validation + normalization
        proposal.add = proposal.add
          .map((t: any) => ({
            title: String(t?.title || '').trim(),
            description: t?.description ? String(t.description).trim() : '',
            rationale: t?.rationale ? String(t.rationale).trim() : '',
          }))
          .filter((t) => t.title.length > 0)
          .sort((a, b) => {
            const ra = inferPhaseRank(a.title, a.description);
            const rb = inferPhaseRank(b.title, b.description);
            if (ra !== rb) return ra - rb;
            return a.title.localeCompare(b.title);
          })
          .slice(0, mode === 'generate' ? 25 : 15);

        proposal.remove = proposal.remove
          .map((r: any) => ({
            taskId: String(r?.taskId || '').trim(),
            reason: String(r?.reason || '').trim(),
          }))
          .filter((r) => r.taskId.length > 0 && r.reason.length > 0)
          .sort((a, b) => {
            const ra = inferRemovalRank(a.reason);
            const rb = inferRemovalRank(b.reason);
            if (ra !== rb) return ra - rb;
            return a.taskId.localeCompare(b.taskId);
          })
          .slice(0, 8);

        if (mode === 'generate') {
          proposal.remove = [];
          proposal.reorder = undefined;
        }

        const existingTaskIds = new Set(tasks.map((t) => String(t.id)));
        const reorderOrder = Array.isArray(proposal.reorder?.order) ? proposal.reorder!.order : [];
        const normalizedOrder = reorderOrder
          .map((id) => String(id).trim())
          .filter((id) => existingTaskIds.has(id));
        const uniqueOrder: string[] = [];
        const seen = new Set<string>();
        for (const id of normalizedOrder) {
          if (seen.has(id)) continue;
          seen.add(id);
          uniqueOrder.push(id);
        }
        if (proposal.reorder) proposal.reorder.order = uniqueOrder;

        if (
          proposal.add.length === 0 &&
          proposal.remove.length === 0 &&
          (!proposal.reorder || proposal.reorder.order.length === 0)
        ) {
          const msg = t('initiatives.tasksMilestonesSection.aiFoundNoChangeSuggestionsBacklog');
          setAiNoSuggestionsMessage(msg);
          if (aiNoSuggestionsTimerRef.current) {
            window.clearTimeout(aiNoSuggestionsTimerRef.current);
          }
          aiNoSuggestionsTimerRef.current = window.setTimeout(() => {
            setAiNoSuggestionsMessage(null);
            aiNoSuggestionsTimerRef.current = null;
          }, 7000);
          setAiProposal(null);
          return;
        }

        setAiProposal(proposal);
        setShowAIModal(true);
        // default selections: add checked, remove unchecked
        setSelectedAddIdx(
          Object.fromEntries(proposal.add.map((_, idx) => [idx, true])) as Record<number, boolean>
        );
        setSelectedRemoveIds(
          Object.fromEntries(proposal.remove.map((r) => [r.taskId, false])) as Record<
            string,
            boolean
          >
        );
        setApplySuggestedOrder(!!proposal.reorder?.order?.length);
      } catch (e: any) {
        toast.error(e?.message || t('initiatives.tasksMilestonesSection.aiProposalFailed'));
      } finally {
        setIsAIProposing(false);
      }
    },
    [readonly, isPolish, tasks, initiative, parseAIJson, t]
  );

  useEffect(() => {
    if (!tasksAiRequest) return;
    const run = async () => {
      try {
        if (tasksAiRequest.mode === 'analyze') {
          await proposeTasksWithAI(tasks.length === 0 ? 'generate' : 'review');
          return;
        }
        if (tasksAiRequest.mode === 'addOne') {
          await proposeOneTaskWithAI();
        }
      } finally {
        clearTasksAiRequest();
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksAiRequest?.nonce]);

  const sortedTasks = useMemo(() => {
    const list = [...tasks];
    const order = taskOrderOverride;
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
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });
  }, [tasks, taskOrderOverride]);

  const ownerFilterOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        sortedTasks
          .map((t) => String(t.assigneeName || '').trim())
          .filter((name) => name.length > 0)
      )
    );
    return names.sort((a, b) => a.localeCompare(b));
  }, [sortedTasks]);

  const filteredTasks = useMemo(() => {
    const now = Date.now();
    return sortedTasks.filter((task) => {
      const normalizedStatus = normalizeStatus(task.status || 'todo');
      const normalizedPriority = String(task.priority || 'medium').toLowerCase();
      const normalizedSource =
        String(task.source || 'manual').toLowerCase() === 'ai' ? 'ai' : 'manual';
      const ownerName = String(task.assigneeName || '').trim();
      const title = String(task.title || '').toLowerCase();
      const dueTs = task.dueDate ? new Date(task.dueDate).getTime() : NaN;

      if (taskQuery.trim() && !title.includes(taskQuery.trim().toLowerCase())) return false;
      if (statusFilter !== 'all' && normalizedStatus !== statusFilter) return false;
      if (priorityFilter !== 'all' && normalizedPriority !== priorityFilter) return false;
      if (sourceFilter !== 'all' && normalizedSource !== sourceFilter) return false;
      if (ownerFilter === '__none' && ownerName) return false;
      if (ownerFilter !== 'all' && ownerFilter !== '__none' && ownerName !== ownerFilter)
        return false;

      if (dueFilter === 'no_due') return !task.dueDate;
      if (dueFilter === 'overdue') return Number.isFinite(dueTs) && dueTs < now;
      if (dueFilter === 'upcoming') return Number.isFinite(dueTs) && dueTs >= now;

      return true;
    });
  }, [dueFilter, ownerFilter, priorityFilter, sortedTasks, sourceFilter, statusFilter, taskQuery]);

  const closeMenu = useCallback(() => setMenuTaskId(null), []);

  useEffect(() => {
    if (!menuTaskId) return;
    const onDocClick = () => setMenuTaskId(null);
    const t = setTimeout(() => document.addEventListener('click', onDocClick), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', onDocClick);
    };
  }, [menuTaskId]);

  useEffect(() => {
    if (showCreateModal) {
      setTimeout(() => createTitleInputRef.current?.focus(), 20);
    }
  }, [showCreateModal]);

  useEffect(() => {
    if (showCreateMilestoneModal) {
      setTimeout(() => createMilestoneTitleInputRef.current?.focus(), 20);
    }
  }, [showCreateMilestoneModal]);

  // EXE-02/03/04 gap-fill: load existing milestones for this initiative
  // (endpoint already existed and was consumed read-only in
  // InitiativeDrawer.tsx; this section had no reader and no writer at all).
  useEffect(() => {
    if (!initiativeId) {
      setMilestonesLoading(false);
      return;
    }
    let cancelled = false;
    setMilestonesLoading(true);
    setMilestonesLoadError(false);
    (async () => {
      try {
        const response = await Api.get(`/initiatives/${initiativeId}/milestones`);
        if (!cancelled) setMilestones(response?.milestones || []);
      } catch {
        if (!cancelled) {
          setMilestones([]);
          setMilestonesLoadError(true);
        }
      } finally {
        if (!cancelled) setMilestonesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  const createTaskArtifact = useCallback(
    async (
      title: string,
      source: 'manual' | 'ai' = 'manual',
      options?: {
        description?: string;
        status?: string;
        priority?: string;
        dueDate?: string | null;
        assigneeId?: string | null;
      }
    ) => {
      if (!initiativeId) return;
      const safeTitle = (title || '').trim() || t('initiatives.tasksMilestonesSection.newTask');

      const res = await Api.post('/tasks', {
        title: safeTitle,
        description: options?.description || '',
        projectId,
        initiativeId,
        status: options?.status || 'todo',
        priority: options?.priority || 'medium',
        taskType: 'execution',
        source,
        dueDate: options?.dueDate || null,
        assigneeId: options?.assigneeId || null,
        estimatedHours: null,
        // Retry-safe create — see generateClientRequestId doc comment above.
        idempotencyKey: generateClientRequestId(),
      });

      const selectedUser = users.find((u) => u.id === (options?.assigneeId || ''));

      const newTask: TaskItem = {
        id: res.id,
        title: safeTitle,
        description: options?.description || '',
        status: options?.status || 'todo',
        priority: options?.priority || 'medium',
        taskType: 'execution',
        dueDate: options?.dueDate || undefined,
        assigneeId: options?.assigneeId || undefined,
        assigneeName: selectedUser
          ? `${selectedUser.firstName} ${selectedUser.lastName}`.trim()
          : undefined,
        estimatedHours: null,
        isMilestone: false,
        milestoneDate: undefined,
        source,
      };

      setTasks((prev) => [...prev, newTask]);
      return newTask;
    },
    [initiativeId, isPolish, projectId, setTasks, users, t]
  );

  const handleStartInlineAdd = useCallback(() => {
    if (readonly) return;
    setShowCreateModal(true);
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskAssigneeId('');
  }, [readonly]);

  const handleCreateInlineTask = useCallback(async () => {
    if (isCreatingTask) return;
    if (!newTaskTitle.trim()) return;
    setIsCreatingTask(true);
    try {
      await createTaskArtifact(newTaskTitle, 'manual', {
        description: newTaskDescription.trim() || '',
        status: 'todo', // first status in flow
        priority: 'medium',
        dueDate: null,
        assigneeId: newTaskAssigneeId || null,
      });
      setShowCreateModal(false);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskAssigneeId('');
      // Keep user in list context after creation; task appears immediately with first status.
      toast.success(t('initiatives.tasksMilestonesSection.taskCreated', 'Task created'));
    } catch (e: any) {
      toast.error(t('initiatives.tasksMilestonesSection.failedToCreateTask'));
    } finally {
      setIsCreatingTask(false);
    }
  }, [
    isCreatingTask,
    createTaskArtifact,
    newTaskTitle,
    newTaskDescription,
    newTaskAssigneeId,
    isPolish,
    onOpenTask,
    t,
  ]);

  const handleStartInlineMilestoneAdd = useCallback(() => {
    if (readonly) return;
    setShowCreateMilestoneModal(true);
    setNewMilestoneName('');
    setNewMilestoneDate('');
  }, [readonly]);

  // EXE-02/03/04 gap-fill: real writer for POST /initiatives/:id/milestones
  // (distinct from tasks — separate initiative_milestones table/endpoint).
  const handleCreateInlineMilestone = useCallback(async () => {
    if (isCreatingMilestone) return;
    if (!newMilestoneName.trim()) return;
    if (!initiativeId) return;
    setIsCreatingMilestone(true);
    try {
      const res = await Api.post(`/initiatives/${initiativeId}/milestones`, {
        name: newMilestoneName.trim(),
        description: '',
        targetDate: newMilestoneDate || null,
        // Retry-safe: a network drop + client retry (or double-submit that
        // slips past isCreatingMilestone) must not create a duplicate
        // milestone — see server/migrations/20260801_exe002004_idempotency_keys.sql.
        idempotencyKey: generateClientRequestId(),
      });
      const created = res?.milestone;
      if (created) {
        setMilestones((prev) => [
          ...prev,
          {
            id: created.id,
            name: created.name,
            targetDate: created.targetDate,
            status: created.status,
            isGate: created.isGate,
          },
        ]);
      }
      setShowCreateMilestoneModal(false);
      setNewMilestoneName('');
      setNewMilestoneDate('');
      toast.success(t('initiatives.tasksMilestonesSection.milestoneCreated', 'Milestone created'));
      // INI-05: the portfolio timeline/roadmap read models must see this
      // milestone without a manual reload.
      bumpInitiativeRefresh();
    } catch (e: any) {
      toast.error(
        t('initiatives.tasksMilestonesSection.failedToCreateMilestone', 'Failed to create milestone')
      );
    } finally {
      setIsCreatingMilestone(false);
    }
  }, [isCreatingMilestone, newMilestoneName, newMilestoneDate, initiativeId, t]);

  // Remove task
  const handleRemoveTask = useCallback(
    async (id: string) => {
      try {
        await Api.delete(`/tasks/${id}`);
        setTasks((prev) => prev.filter((task) => task.id !== id));
        toast.success(t('initiatives.tasksMilestonesSection.taskRemoved'));
      } catch {
        toast.error(t('initiatives.tasksMilestonesSection.failedToRemove'));
      }
    },
    [isPolish, setTasks, t]
  );

  const handleDuplicateTask = useCallback(
    async (task: TaskItem) => {
      try {
        const fallbackTitle = task.title || t('initiatives.tasksMilestonesSection.newTask');
        const copyWord = t('initiatives.tasksMilestonesSection.copy');
        const created = await createTaskArtifact(
          `${fallbackTitle} (${copyWord})`,
          task.source === 'ai' ? 'ai' : 'manual',
          {
            description: task.description || '',
            status: 'todo', // Always start from first status in flow
            priority: String(task.priority || 'medium').toLowerCase(),
            dueDate: task.dueDate || null,
            assigneeId: task.assigneeId || null,
          }
        );
        if (created?.id) {
          toast.success(t('initiatives.tasksMilestonesSection.taskDuplicated'));
        }
      } catch {
        toast.error(t('initiatives.tasksMilestonesSection.failedToDuplicateTask'));
      }
    },
    [createTaskArtifact, isPolish, t]
  );

  const applyAIProposal = useCallback(async () => {
    if (!aiProposal) return;
    const toAdd = aiProposal.add.filter((_, idx) => selectedAddIdx[idx]);
    const toRemove = aiProposal.remove.filter((r) => selectedRemoveIds[r.taskId]);
    const hasOrder = !!aiProposal.reorder?.order?.length;

    if (toAdd.length === 0 && toRemove.length === 0 && !(applySuggestedOrder && hasOrder)) {
      toast(t('initiatives.tasksMilestonesSection.noSelectedChanges'));
      return;
    }

    if (toRemove.length > 0) {
      const ok = window.confirm(
        t('initiatives.tasksMilestonesSection.deleteTasksConfirm', { count: toRemove.length })
      );
      if (!ok) return;
    }

    try {
      // Add tasks sequentially to keep API load predictable
      for (const item of toAdd) {
        await createTaskArtifact(item.title, 'ai', {
          description: item.description || '',
          status: 'todo',
          priority: 'medium',
          dueDate: null,
          assigneeId: null,
        });
      }

      // Remove selected tasks
      for (const r of toRemove) {
        await handleRemoveTask(r.taskId);
      }

      // Apply suggested ordering locally (view-only) so the list reads logically.
      if (applySuggestedOrder && hasOrder) {
        const removedIds = new Set(toRemove.map((r) => r.taskId));
        const filtered = aiProposal.reorder!.order.filter((id) => !removedIds.has(id));
        if (filtered.length > 0) {
          setTaskOrderOverride(filtered);
        }
      }

      const appliedReordered = applySuggestedOrder && hasOrder;
      const appliedSummary =
        appliedReordered && toRemove.length
          ? t('initiatives.tasksMilestonesSection.appliedAiProposalsAddedRemovedReordered', {
              added: toAdd.length,
              removed: toRemove.length,
            })
          : appliedReordered
            ? t('initiatives.tasksMilestonesSection.appliedAiProposalsAddedReordered', {
                added: toAdd.length,
              })
            : toRemove.length
              ? t('initiatives.tasksMilestonesSection.appliedAiProposalsAddedRemoved', {
                  added: toAdd.length,
                  removed: toRemove.length,
                })
              : t('initiatives.tasksMilestonesSection.appliedAiProposalsAdded', {
                  added: toAdd.length,
                });
      toast.success(appliedSummary);
      closeAIModal();
    } catch {
      toast.error(t('initiatives.tasksMilestonesSection.failedToApplyProposals'));
    }
  }, [
    aiProposal,
    selectedAddIdx,
    selectedRemoveIds,
    isPolish,
    createTaskArtifact,
    handleRemoveTask,
    closeAIModal,
    applySuggestedOrder,
    t,
  ]);

  const selectedAddCount = useMemo(() => {
    if (!aiProposal) return 0;
    return aiProposal.add.reduce((sum, _t, idx) => sum + (selectedAddIdx[idx] ? 1 : 0), 0);
  }, [aiProposal, selectedAddIdx]);

  const selectedRemoveCount = useMemo(() => {
    if (!aiProposal) return 0;
    return aiProposal.remove.reduce((sum, r) => sum + (selectedRemoveIds[r.taskId] ? 1 : 0), 0);
  }, [aiProposal, selectedRemoveIds]);

  // When "New Task" button in toolbar triggers showCreateTask, auto-add a task card
  useEffect(() => {
    if (showCreateTask && !addTriggered.current) {
      addTriggered.current = true;
      handleStartInlineAdd();
      setShowCreateTask(false);
      setTimeout(() => {
        addTriggered.current = false;
      }, 300);
    }
  }, [showCreateTask, handleStartInlineAdd, setShowCreateTask]);

  // Cleanup: remove legacy client-side demo rows if they exist in state.
  useEffect(() => {
    if (!initiativeId) return;
    const hasLegacyDemo = tasks.some((t) => String(t.id).startsWith('demo-task-'));
    if (!hasLegacyDemo) return;
    setTasks((prev) => prev.filter((t) => !String(t.id).startsWith('demo-task-')));
  }, [initiativeId, tasks, setTasks]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Tasks</h2>
          {tasks.length > 0 && (
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">
              {tasks.length}
            </span>
          )}
          {isAIProposing && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-navy-800/50 px-2 py-0.5 rounded-full">
              <Loader2 size={12} className="animate-spin" />
              {t('initiatives.tasksMilestonesSection.aiWorking')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!readonly && (
            <>
              <button
                onClick={handleStartInlineAdd}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <Plus size={12} />
                {t('initiatives.tasksMilestonesSection.addTask')}
              </button>
              <button
                onClick={handleStartInlineMilestoneAdd}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <Flag size={12} />
                {t('initiatives.tasksMilestonesSection.addMilestone', 'Add milestone')}
              </button>
            </>
          )}
        </div>
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
                  label: t('initiatives.tasksMilestonesSection.aiAddTask'),
                  onClick: () => void proposeOneTaskWithAI(),
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
                  {aiMode === 'generate'
                    ? t('initiatives.tasksMilestonesSection.proposedTaskBacklogAi')
                    : t('initiatives.tasksMilestonesSection.proposedTaskChangesAi')}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('initiatives.tasksMilestonesSection.selectItemsToAddRemove')}
                </p>
              </div>
              <button
                onClick={closeAIModal}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                title={t('initiatives.tasksMilestonesSection.close')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">
              {/* Remove suggestions (top) */}
              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {t('initiatives.tasksMilestonesSection.toRemove')} ({aiProposal.remove.length})
                  </span>
                  {aiProposal.remove.length > 0 && (
                    <button
                      onClick={() =>
                        setSelectedRemoveIds(
                          Object.fromEntries(
                            aiProposal.remove.map((r) => [r.taskId, true])
                          ) as Record<string, boolean>
                        )
                      }
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {t('initiatives.tasksMilestonesSection.selectAll')}
                    </button>
                  )}
                </div>
                {aiProposal.remove.length === 0 ? (
                  <EmptyStateInline
                    icon={Trash2}
                    dashed={false}
                    className="p-5"
                    message={
                      aiMode === 'generate'
                        ? t('initiatives.tasksMilestonesSection.generateModeNoRemovals')
                        : t('initiatives.tasksMilestonesSection.noRemovalSuggestions')
                    }
                    hint={t('initiatives.tasksMilestonesSection.backlogOkOnlyAdditionsOrdering')}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {aiProposal.remove.map((r) => {
                      const existing = tasks.find((t) => String(t.id) === String(r.taskId));
                      return (
                        <label
                          key={r.taskId}
                          className="flex items-start gap-2 p-2 rounded-xl bg-amber-50/40 dark:bg-amber-500/5 hover:bg-amber-50/70 dark:hover:bg-amber-500/10 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={!!selectedRemoveIds[r.taskId]}
                            onChange={(e) =>
                              setSelectedRemoveIds((prev) => ({
                                ...prev,
                                [r.taskId]: e.target.checked,
                              }))
                            }
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-slate-800 dark:text-white">
                              {existing?.title || r.taskId}
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

              {/* Add proposals */}
              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {t('initiatives.tasksMilestonesSection.toAdd')} ({aiProposal.add.length})
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
                      {t('initiatives.tasksMilestonesSection.selectAll')}
                    </button>
                  )}
                </div>
                {aiProposal.add.length === 0 ? (
                  <EmptyStateInline
                    icon={Plus}
                    dashed={false}
                    className="p-5"
                    message={t('initiatives.tasksMilestonesSection.noAdditionsProposed')}
                    hint={t('initiatives.tasksMilestonesSection.backlogCompleteOnlyOrdering')}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {aiProposal.add.map((item, idx) => (
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
                              {item.title}
                            </span>
                          </div>
                          {item.description ? (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">
                              {item.description}
                            </p>
                          ) : null}
                          {item.rationale ? (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              {item.rationale}
                            </p>
                          ) : null}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Suggested ordering */}
              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {t('initiatives.tasksMilestonesSection.suggestedOrder')} (
                    {aiProposal.reorder?.order?.length || 0})
                  </span>
                  <label className="inline-flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 select-none">
                    <input
                      type="checkbox"
                      checked={applySuggestedOrder}
                      onChange={(e) => setApplySuggestedOrder(e.target.checked)}
                      disabled={!aiProposal.reorder?.order?.length}
                    />
                    {t('initiatives.tasksMilestonesSection.applyOrder')}
                  </label>
                </div>
                {!aiProposal.reorder?.order?.length ? (
                  <EmptyStateInline
                    icon={Sparkles}
                    dashed={false}
                    className="p-5"
                    message={t('initiatives.tasksMilestonesSection.noOrderingSuggestion')}
                    hint={t('initiatives.tasksMilestonesSection.aiMayReturnWithoutReordering')}
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
                        const existing = tasks.find((t) => String(t.id) === String(id));
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
                    {t('initiatives.tasksMilestonesSection.removeSelectedTasks', {
                      count: selectedRemoveCount,
                    })}
                  </li>
                  <li>
                    {t('initiatives.tasksMilestonesSection.addSelectedTasks', {
                      count: selectedAddCount,
                    })}
                  </li>
                  <li>
                    {applySuggestedOrder && aiProposal.reorder?.order?.length
                      ? t('initiatives.tasksMilestonesSection.applySuggestedOrderingBacklog')
                      : t('initiatives.tasksMilestonesSection.optionalApplySuggestedOrdering')}
                  </li>
                </ul>
              </Callout>
            </div>

            <div className="px-5 py-4 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center justify-end gap-2">
              <button
                onClick={closeAIModal}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
              >
                {t('initiatives.tasksMilestonesSection.cancel')}
              </button>
              <button
                onClick={() => void applyAIProposal()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-c-info/50 text-c-info dark:text-c-info hover:bg-c-info/10 transition-colors"
              >
                {t('initiatives.tasksMilestonesSection.apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto overflow-y-visible rounded-xl border border-slate-200 dark:border-navy-700/40">
        <table
          /* §27-exempt: sub-tabela w widoku szczegolow, nie samodzielna lista */ className="w-full text-sm table-fixed"
        >
          <colgroup>
            <col style={{ width: '4%' }} />
            <col style={{ width: '38%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '4%' }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-navy-800 border-b border-slate-200 dark:border-navy-700/40">
              <th className="text-right py-2.5 pl-3 pr-2">#</th>
              <th className="text-left py-2.5 pl-3 pr-2">Task</th>
              <th className="text-left py-2.5 pr-2">Status</th>
              <th className="text-left py-2.5 pr-2">Priority</th>
              <th className="text-left py-2.5 pr-2">Owner</th>
              <th className="text-left py-2.5 pr-2">Due</th>
              <th className="text-left py-2.5 pr-2">Source</th>
              <th className="text-right py-2.5 pr-3"></th>
            </tr>
            <tr className="bg-slate-50 dark:bg-navy-800 border-b border-slate-200/60 dark:border-navy-700/40">
              <th className="py-1.5 pl-3 pr-2" />
              <th className="py-1.5 pl-3 pr-2">
                <input
                  value={taskQuery}
                  onChange={(e) => setTaskQuery(e.target.value)}
                  placeholder={t('initiatives.tasksMilestonesSection.filter')}
                  className="w-full h-7 rounded-md border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/60 px-2 text-[11px] text-slate-600 dark:text-slate-300 focus:outline-none focus:border-c-focus"
                />
              </th>
              <th className="py-1.5 pr-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-7 rounded-md border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/60 px-2 text-[11px] text-slate-600 dark:text-slate-300 focus:outline-none focus:border-c-focus"
                >
                  <option value="all">{t('initiatives.tasksMilestonesSection.all')}</option>
                  {Object.entries(TASK_STATUS_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>
                      {isPolish ? cfg.label.pl : cfg.label.en}
                    </option>
                  ))}
                </select>
              </th>
              <th className="py-1.5 pr-2">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full h-7 rounded-md border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/60 px-2 text-[11px] text-slate-600 dark:text-slate-300 focus:outline-none focus:border-c-focus"
                >
                  <option value="all">{t('initiatives.tasksMilestonesSection.all')}</option>
                  {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>
                      {isPolish ? cfg.label.pl : cfg.label.en}
                    </option>
                  ))}
                </select>
              </th>
              <th className="py-1.5 pr-2">
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className="w-full h-7 rounded-md border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/60 px-2 text-[11px] text-slate-600 dark:text-slate-300 focus:outline-none focus:border-c-focus"
                >
                  <option value="all">{t('initiatives.tasksMilestonesSection.allPeople')}</option>
                  <option value="__none">
                    {t('initiatives.tasksMilestonesSection.unassigned')}
                  </option>
                  {ownerFilterOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </th>
              <th className="py-1.5 pr-2">
                <select
                  value={dueFilter}
                  onChange={(e) =>
                    setDueFilter(e.target.value as 'all' | 'upcoming' | 'overdue' | 'no_due')
                  }
                  className="w-full h-7 rounded-md border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/60 px-2 text-[11px] text-slate-600 dark:text-slate-300 focus:outline-none focus:border-c-focus"
                >
                  <option value="all">{t('initiatives.tasksMilestonesSection.all')}</option>
                  <option value="upcoming">
                    {t('initiatives.tasksMilestonesSection.upcoming')}
                  </option>
                  <option value="overdue">{t('initiatives.tasksMilestonesSection.overdue')}</option>
                  <option value="no_due">
                    {t('initiatives.tasksMilestonesSection.noDueDate')}
                  </option>
                </select>
              </th>
              <th className="py-1.5 pr-2">
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as 'all' | 'manual' | 'ai')}
                  className="w-full h-7 rounded-md border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/60 px-2 text-[11px] text-slate-600 dark:text-slate-300 focus:outline-none focus:border-c-focus"
                >
                  <option value="all">{t('initiatives.tasksMilestonesSection.all')}</option>
                  <option value="manual">{t('initiatives.tasksMilestonesSection.manual')}</option>
                  <option value="ai">AI</option>
                </select>
              </th>
              <th className="py-1.5 pr-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
            <AnimatePresence mode="popLayout">
              {filteredTasks.map((task, index) => {
                const status = normalizeStatus(task.status || 'todo');
                const statusConfig = TASK_STATUS_CONFIG[status] || TASK_STATUS_CONFIG.todo;
                const source = task.source || 'manual';
                const sourceCfg = SOURCE_CONFIG[source] || SOURCE_CONFIG.manual;
                const priorityKey = String(task.priority || 'medium').toLowerCase();
                return (
                  <motion.tr
                    key={task.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group hover:bg-slate-50/50 dark:hover:bg-navy-800/20 transition-colors"
                  >
                    <td className="py-2.5 pl-3 pr-2 text-xs text-right text-slate-500 dark:text-slate-400">
                      {index + 1}
                    </td>
                    <td className="py-2.5 pl-3 pr-2">
                      <button
                        onClick={() => onOpenTask?.(task.id)}
                        className="block w-full truncate text-left text-slate-700 dark:text-slate-200 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                        title={task.title || t('initiatives.tasksMilestonesSection.untitled')}
                      >
                        {task.title || t('initiatives.tasksMilestonesSection.untitled')}
                      </button>
                    </td>
                    <td className="py-2.5 pr-2">
                      {/* canon §4.2 — neutral shell; colour carried by the signal dot only */}
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border border-slate-200/70 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.color}`} />
                        {isPolish ? statusConfig.label.pl : statusConfig.label.en}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-xs">
                      <span className={PRIORITY_CONFIG[priorityKey]?.color || 'text-slate-500'}>
                        {isPolish
                          ? PRIORITY_CONFIG[priorityKey]?.label.pl || task.priority || '—'
                          : PRIORITY_CONFIG[priorityKey]?.label.en || task.priority || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-xs text-slate-600 dark:text-slate-300">
                      {task.assigneeName || '—'}
                    </td>
                    <td className="py-2.5 pr-2 text-xs text-slate-500 dark:text-slate-400">
                      {task.dueDate ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={11} />
                          {formatDueDate(task.dueDate)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 pr-2 text-xs">
                      <span className={`inline-flex items-center gap-1 ${sourceCfg.color}`}>
                        <sourceCfg.icon size={10} />
                        {isPolish ? sourceCfg.label.pl : sourceCfg.label.en}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuTaskId((prev) => (prev === task.id ? null : task.id));
                        }}
                        className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/10 transition-colors"
                        title={t('initiatives.tasksMilestonesSection.actions')}
                      >
                        <MoreVertical size={14} />
                      </button>
                      {menuTaskId === task.id && (
                        <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-slate-200 dark:border-navy-700/70 bg-white dark:bg-navy-900 p-1.5 shadow-xl shadow-slate-900/10 dark:shadow-black/30">
                          <button
                            onClick={() => {
                              closeMenu();
                              onOpenTask?.(task.id);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                          >
                            <ExternalLink size={13} />
                            {t('initiatives.tasksMilestonesSection.openTask')}
                          </button>
                          <button
                            onClick={() => {
                              closeMenu();
                              void handleDuplicateTask(task);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                          >
                            <Edit3 size={13} />
                            {t('initiatives.tasksMilestonesSection.duplicate')}
                          </button>
                          {!readonly && (
                            <>
                              <div className="my-1 border-t border-slate-200 dark:border-navy-700/50" />
                              <button
                                onClick={() => {
                                  closeMenu();
                                  void handleRemoveTask(task.id);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors"
                              >
                                <Trash2 size={13} />
                                {t('initiatives.tasksMilestonesSection.delete')}
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
            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8">
                  {tasks.length === 0 ? (
                    // M13 flow redesign — a fresh DRAFT has no tasks, so the
                    // plan (and the Gantt) is empty. Explain it and offer the
                    // two consultant moves instead of a bare "no tasks" line.
                    <div data-testid="tasks-empty-state" className="mx-auto max-w-md text-center">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {t(
                          'initiatives.tasksMilestonesSection.emptyPlanTitle',
                          'Ta inicjatywa nie ma jeszcze planu'
                        )}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {t(
                          'initiatives.tasksMilestonesSection.emptyPlanHint',
                          'Zadania zasilają harmonogram (Gantt) i postęp inicjatywy. Dodaj pierwsze zadanie albo pozwól AI zaproponować kompletny plan.'
                        )}
                      </p>
                      {!readonly && (
                        <div className="mt-4 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            data-testid="tasks-empty-add"
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300/70 dark:border-navy-600 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                          >
                            <Plus size={13} />
                            {t(
                              'initiatives.tasksMilestonesSection.emptyPlanAddFirst',
                              'Dodaj pierwsze zadanie'
                            )}
                          </button>
                          <button
                            type="button"
                            data-testid="tasks-empty-ai"
                            disabled={isAIProposing}
                            onClick={() => void proposeTasksWithAI('generate')}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
                          >
                            {isAIProposing ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Sparkles size={13} />
                            )}
                            {t(
                              'initiatives.tasksMilestonesSection.emptyPlanGenerateAi',
                              'Wygeneruj plan z AI'
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                      {t('initiatives.tasksMilestonesSection.noResultsForFilters')}
                    </p>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* EXE-02/03/04 gap-fill: minimal milestones list. Section previously had
          no reader or writer for initiative_milestones — only tasks. */}
      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {t('initiatives.tasksMilestonesSection.milestonesHeading', 'Milestones')}
          </h3>
          {milestones.length > 0 && (
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">
              {milestones.length}
            </span>
          )}
        </div>
        {milestonesLoading ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('initiatives.tasksMilestonesSection.milestonesLoading', 'Loading milestones…')}
          </p>
        ) : milestonesLoadError ? (
          <p className="text-xs text-danger-500 dark:text-danger-400">
            {t(
              'initiatives.tasksMilestonesSection.milestonesLoadError',
              'Could not load milestones'
            )}
          </p>
        ) : milestones.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('initiatives.tasksMilestonesSection.noMilestonesYet', 'No milestones yet')}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200/40 dark:divide-navy-700/40 rounded-xl border border-slate-200 dark:border-navy-700/40">
            {milestones.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
              >
                <span className="inline-flex items-center gap-1.5 min-w-0 text-slate-700 dark:text-slate-200">
                  <Flag size={11} className="shrink-0 text-slate-400 dark:text-slate-500" />
                  <span className="truncate">{m.name}</span>
                </span>
                <span className="shrink-0 inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  {m.targetDate ? (
                    <>
                      <Calendar size={11} />
                      {formatDueDate(m.targetDate)}
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!readonly && showCreateModal && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-navy-700/70 bg-white dark:bg-navy-900 shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700/70 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t('initiatives.tasksMilestonesSection.newTaskTitle')}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewTaskTitle('');
                }}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-navy-800"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">
                  {t('initiatives.tasksMilestonesSection.title')}
                </label>
                <input
                  ref={createTitleInputRef}
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder={t('initiatives.tasksMilestonesSection.titlePlaceholder')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">
                  {t('initiatives.tasksMilestonesSection.assumptionsNotes')}
                </label>
                <textarea
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">
                  Owner
                </label>
                <select
                  value={newTaskAssigneeId}
                  onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-sm"
                >
                  <option value="">{t('initiatives.tasksMilestonesSection.none')}</option>
                  {users.map((u) => (
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
                  setNewTaskTitle('');
                }}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
              >
                {t('initiatives.tasksMilestonesSection.cancel')}
              </button>
              <button
                onClick={() => void handleCreateInlineTask()}
                disabled={isCreatingTask || !newTaskTitle.trim()}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {isCreatingTask
                  ? t('initiatives.tasksMilestonesSection.creating')
                  : t('initiatives.tasksMilestonesSection.createTask')}
              </button>
            </div>
          </div>
        </div>
      )}

      {!readonly && showCreateMilestoneModal && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-navy-700/70 bg-white dark:bg-navy-900 shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700/70 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t('initiatives.tasksMilestonesSection.newMilestoneTitle', 'New milestone')}
              </h3>
              <button
                onClick={() => {
                  setShowCreateMilestoneModal(false);
                  setNewMilestoneName('');
                  setNewMilestoneDate('');
                }}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-navy-800"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">
                  {t('initiatives.tasksMilestonesSection.title')}
                </label>
                <input
                  ref={createMilestoneTitleInputRef}
                  value={newMilestoneName}
                  onChange={(e) => setNewMilestoneName(e.target.value)}
                  placeholder={t(
                    'initiatives.tasksMilestonesSection.milestoneNamePlaceholder',
                    'e.g. Go-live approved'
                  )}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">
                  {t('initiatives.tasksMilestonesSection.targetDate', 'Target date')}
                </label>
                <input
                  type="date"
                  value={newMilestoneDate}
                  onChange={(e) => setNewMilestoneDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-sm"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-700/70 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateMilestoneModal(false);
                  setNewMilestoneName('');
                  setNewMilestoneDate('');
                }}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
              >
                {t('initiatives.tasksMilestonesSection.cancel')}
              </button>
              <button
                onClick={() => void handleCreateInlineMilestone()}
                disabled={isCreatingMilestone || !newMilestoneName.trim()}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {isCreatingMilestone
                  ? t('initiatives.tasksMilestonesSection.creating')
                  : t('initiatives.tasksMilestonesSection.createMilestone', 'Create milestone')}
              </button>
            </div>
          </div>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="pt-2 border-t border-slate-200/70 dark:border-navy-700/50 text-xs text-slate-500 dark:text-slate-400">
          {tasksDone}/{tasks.length} {t('initiatives.tasksMilestonesSection.done')}
        </div>
      )}
    </motion.div>
  );
};
