/**
 * GateReadinessSection
 *
 * Gate approval workflow with readiness checks.
 * Extracted from InitiativeDocumentView.
 */

import { motion } from 'framer-motion';
import {
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  Loader2,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Callout, EmptyStateInline } from '@/components/shared/NModeBlocks';
import { useGateAi } from '@/hooks/useGateAi';
import Api from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { getStatusMeta } from '@/services/initiativeLifecycle';

import { GateReadinessPanel, GateReadinessPill } from '../gate-ai';
import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import { InitiativeGatesWorkflowTable } from './InitiativeGatesWorkflowTable';
import { InitiativeStatusPipeline } from './InitiativeStatusPipeline';
import type { InitiativeSectionProps } from './types';
import { GATE_CONFIG, GATE_DEFINITIONS, getNextGateForStatus, getRoleLabel } from './types';

type AIGatesProposal = {
  initiative: {
    update?: {
      ownerId?: string;
      sponsorId?: string;
      plannedEndDate?: string; // YYYY-MM-DD
      priority?: 'critical' | 'high' | 'medium' | 'low';
      reason: string;
    };
  };
  gateRoles: {
    add: Array<{ gateRole: string; userId: string; reason: string }>;
    remove: Array<{ gateRole: string; userId: string; reason: string }>;
  };
  gateDecisions: {
    update: Array<{
      decisionId: string;
      decisionOwnerId?: string;
      dueDate?: string; // YYYY-MM-DD
      description?: string;
      reason: string;
    }>;
  };
  tasks: {
    update: Array<{
      taskId: string;
      assigneeId?: string;
      dueDate?: string; // YYYY-MM-DD
      status?: 'TODO' | 'IN_PROGRESS' | "BLOCKED" | 'DONE';
      reason: string;
    }>;
  };
  raid: {
    update: Array<{
      raidId: string;
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      status?: string; // OPEN | IN_PROGRESS | BLOCKED | RESOLVED (server accepts string)
      ownerId?: string;
      dueDate?: string; // YYYY-MM-DD
      title?: string;
      description?: string;
      reason: string;
    }>;
  };
  note?: string;
};

function safeJsonParse(raw: string): any | null {
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

const ALLOWED_GATE_ROLES = [
  'PMO',
  'STEERING_COMMITTEE',
  'INITIATIVE_OWNER',
  'PROJECT_SPONSOR',
  'BUSINESS_OWNER',
  'CONSULTANT',
  'PROJECT_MANAGER',
  'PROJECT_LEAD',
  'TEAM_MEMBER',
] as const;

const GATE_DECISION_TYPES = [
  'SUBMIT_FOR_REVIEW',
  'APPROVE_TO_INITIATIVE',
  'ACCEPT',
  'START_PLANNING',
  'APPROVE',
  'SCHEDULE',
  'START',
  'BLOCK',
  'UNBLOCK',
  'COMPLETE',
  'START_TRACKING',
  'CANCEL',
  'ARCHIVE',
] as const;

const ALLOWED_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
const ALLOWED_TASK_STATUSES = ['TODO', 'IN_PROGRESS', "BLOCKED", 'DONE'] as const;

const normalizeTaskStatus = (
  value?: string
): (typeof ALLOWED_TASK_STATUSES)[number] | undefined => {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  const up = raw.toUpperCase();
  if (up === 'INPROGRESS') return 'IN_PROGRESS';
  if ((ALLOWED_TASK_STATUSES as readonly string[]).includes(up)) return up as any;
  return undefined;
};

const normalizeRaidSeverity = (
  value?: string
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined => {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  const up = raw.toUpperCase();
  if (up === 'LOW' || up === 'MEDIUM' || up === 'HIGH' || up === 'CRITICAL') return up;
  return undefined;
};

const normalizeRaidStatus = (value?: string): string | undefined => {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  const up = raw.toUpperCase();
  // keep a small canonical set, but allow pass-through for backend flexibility
  if (up === 'OPEN' || up === 'IN_PROGRESS' || up === "BLOCKED" || up === 'RESOLVED') return up;
  return up;
};

const toIsoFromDateOnly = (dateOnly?: string): string | undefined => {
  const d = String(dateOnly || '').trim();
  if (!d) return undefined;
  const [yy, mm, dd] = d.split('-').map((x) => Number(x));
  if (!yy || !mm || !dd) return undefined;
  const dt = new Date(yy, mm - 1, dd, 12, 0, 0);
  return dt.toISOString();
};

export const GateReadinessSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { t } = useTranslation();
  const {
    initiative,
    initiativeId,
    decisions,
    gateRoles,
    raidItems,
    tasks,
    stakeholders,
    summary,
    description,
    ownerId,
    sponsorId,
    targetDate,
    users,
    pendingApprovals,
    isPolish,
    canEditCards,
    openSection,
    focusTopBarField,
    gatesAiRequest,
    requestGatesAi,
    clearGatesAiRequest,
    fetchAll,
    handleRequestApproval,
    isMutating,
    gateReadiness,
  } = useInitiativeContext();

  const status = (initiative?.status || 'DRAFT') as string;
  const nextGate = getNextGateForStatus(status);
  const nextGateConfig = nextGate ? GATE_CONFIG[nextGate] : null;
  const canRequestApproval =
    nextGateConfig && !pendingApprovals.some((a) => a.gateType === nextGate);

  // G5 (STATUS_ROLE_CTA_MATRIX) — AI is gated per status by the backend
  // capabilities. Disable the AI CTA + explain when AI is explicitly disallowed
  // for the current status. Only block when the backend actually sent the
  // capability (ctaBar present) so legacy payloads without it are not regressed.
  const ctaBarCaps = gateReadiness?.capabilities?.ctaBar;
  const aiBlockedForStatus = ctaBarCaps ? ctaBarCaps.canUseAi === false : false;

  // M13 Depth · Fala 1 — AI gate readiness for the NEXT gate (proactive pill).
  // Lazy + behind per-org flag: when disabled the endpoint returns enabled:false
  // and the pill renders nothing. Fetches only while the section is expanded.
  const { check: checkGateAi, data: gateAiData, loading: gateAiLoading } = useGateAi(initiativeId);
  const [showGateAiPanel, setShowGateAiPanel] = useState(false);
  useEffect(() => {
    if (expanded && initiativeId && nextGate) void checkGateAi(String(nextGate));
  }, [expanded, initiativeId, nextGate, checkGateAi]);

  const [isAIProposing, setIsAIProposing] = useState(false);
  const [aiProposal, setAiProposal] = useState<AIGatesProposal | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedRoleAddIdx, setSelectedRoleAddIdx] = useState<Record<number, boolean>>({});
  const [selectedRoleRemove, setSelectedRoleRemove] = useState<Record<string, boolean>>({});
  const [selectedDecisionUpdate, setSelectedDecisionUpdate] = useState<Record<string, boolean>>({});
  const [selectedInitiativeFields, setSelectedInitiativeFields] = useState<
    Partial<Record<'ownerId' | 'sponsorId' | 'plannedEndDate' | 'priority', boolean>>
  >({});
  const [selectedTaskUpdate, setSelectedTaskUpdate] = useState<Record<string, boolean>>({});
  const [selectedRaidUpdate, setSelectedRaidUpdate] = useState<Record<string, boolean>>({});
  const [noSuggestionsMessage, setNoSuggestionsMessage] = useState<string | null>(null);
  const noSuggestionsTimerRef = useRef<number | null>(null);

  const [isAIReadinessLoading, setIsAIReadinessLoading] = useState(false);
  const [aiReadinessResult, setAiReadinessResult] = useState<any | null>(null);

  const requiredGates = useMemo(
    () => GATE_DEFINITIONS.filter((g) => g.forStatus === status),
    [status]
  );

  const getGateStatus = useCallback(
    (pmoDomain: string) => {
      const match = decisions.find((d) => d.type === pmoDomain);
      if (!match) return 'MISSING';
      return match.status;
    },
    [decisions]
  );

  const getUserDisplayName = useCallback(
    (userId: string) => {
      const u = users.find((x) => x.id === userId);
      if (!u) return userId;
      const full = `${u.firstName} ${u.lastName}`.trim();
      return full || u.email || userId;
    },
    [users]
  );

  const checkRequirement = useCallback(
    (req: string) => {
      switch (req) {
        case 'title':
          return !!initiative?.name;
        case 'problem':
          return !!summary;
        case 'owner':
          return !!ownerId;
        case 'sponsor':
          return !!sponsorId;
        case 'timeline':
          return !!targetDate;
        case 'team':
          return stakeholders.length > 0;
        case 'risks':
          return raidItems.some((r) => r.type === 'risk');
        case 'objective':
          return !!summary;
        case 'scope':
          return !!description;
        case 'capacity':
          return true;
        case 'dependencies':
          return true;
        case 'all_tasks_done':
          return tasks.every((t) => t.status === 'DONE');
        default:
          return false;
      }
    },
    [
      initiative,
      summary,
      ownerId,
      sponsorId,
      targetDate,
      stakeholders,
      raidItems,
      description,
      tasks,
    ]
  );

  const readinessPercent = useMemo(() => {
    if (!nextGateConfig) return 0;
    const metCount = nextGateConfig.requirements.filter(checkRequirement).length;
    return Math.round((metCount / nextGateConfig.requirements.length) * 100);
  }, [nextGateConfig, checkRequirement]);

  const backendReadiness = useMemo(() => {
    const items = (gateReadiness?.readiness || []).map((r: any) => ({
      key: String(r.key || ''),
      label: String(r.label || r.key || ''),
      pass: !!r.pass,
      severity: String(r.severity || 'warning'),
      suggestedAction: String(r.suggestedAction || r.suggested_action || ''),
      suggestedActor: String(r.suggestedActor || r.suggested_actor || ''),
    }));
    // Sort: blocking fails first, then warnings fails, then passes.
    const weight = (x: { pass: boolean; severity: string }) => {
      if (!x.pass && x.severity === 'blocking') return 0;
      if (!x.pass && x.severity === 'warning') return 1;
      if (x.pass && x.severity === 'blocking') return 2;
      return 3;
    };
    return items.sort((a, b) => weight(a) - weight(b));
  }, [gateReadiness]);

  const blockingMissing = useMemo(
    () => backendReadiness.filter((r) => r.severity === 'blocking' && !r.pass),
    [backendReadiness]
  );

  useEffect(() => {
    if (expanded && initiativeId) {
      trackFunnelEvent('initiative_gate_readiness_viewed', { initiativeId });
    }
  }, [expanded, initiativeId]);

  const requestAIReadiness = useCallback(async () => {
    if (!initiativeId || !initiative) return;
    setIsAIReadinessLoading(true);
    trackFunnelEvent('initiative_gate_readiness_ai_requested', { initiativeId });
    try {
      const projectId = (initiative as any)?.project_id || (initiative as any)?.projectId || '';
      const res = await Api.post('/ai/readiness-analysis', {
        initiativeId,
        projectId,
        targetGate: status,
        language: isPolish ? 'pl' : 'en',
      });
      setAiReadinessResult(res as any);
    } catch (err: any) {
      toast.error(err?.message || t('initiatives.gateReadinessSection.aiAnalysisFailed'));
    } finally {
      setIsAIReadinessLoading(false);
    }
  }, [initiativeId, initiative, status, isPolish, t]);

  const handleFix = useCallback(
    (key: string) => {
      const k = String(key || '').toLowerCase();
      if (!k) return;
      // Top-bar fields / header title
      if (k === 'title') {
        focusTopBarField('title');
        return;
      }
      if (k === 'owner') {
        focusTopBarField('owner');
        openSection('team');
        return;
      }
      if (k === 'timeline') {
        openSection('timeline');
        return;
      }
      // Narrative content
      if (k === 'summary') {
        openSection('overview');
        return;
      }
      if (k === 'sponsor') {
        openSection('team');
        return;
      }
      // Benefits readiness (DONE -> TRACKING)
      if (k.startsWith('benefits_kpi')) {
        openSection('kpis');
        return;
      }
      if (k === 'benefits_owner') {
        openSection('team');
        return;
      }
      // Gate role assignment warnings
      if (k.startsWith('gate_role_')) {
        openSection('gates');
        return;
      }
      // Default fallback
      openSection('gates');
    },
    [focusTopBarField, openSection]
  );

  const proposeGatesWithAI = useCallback(async () => {
    if (!initiativeId) {
      toast.error(t('initiatives.gateReadinessSection.missingInitiativeId'));
      return;
    }
    setIsAIProposing(true);
    setNoSuggestionsMessage(null);
    try {
      const allowedUserIds = new Set(users.map((u) => String(u.id)));
      const allowedRoles = new Set<string>(ALLOWED_GATE_ROLES as unknown as string[]);

      const explicitAssignments = (gateRoles || []).filter((r) => r.source === 'explicit');
      const explicitSet = new Set(explicitAssignments.map((r) => `${r.gateRole}::${r.userId}`));

      const gateDecisions = (decisions || []).filter((d) =>
        (GATE_DECISION_TYPES as readonly string[]).includes(String(d.type || ''))
      );
      const decisionIdSet = new Set(gateDecisions.map((d) => String(d.id)));
      const taskIdSet = new Set((tasks || []).map((t) => String((t as any)?.id)));
      const raidIdSet = new Set((raidItems || []).map((r: any) => String(r?.id)));

      const readinessSnapshot = gateReadiness
        ? {
            currentStatus: gateReadiness.currentStatus,
            userRoles: gateReadiness.userRoles,
            allBlocking: gateReadiness.allBlocking,
            allWarnings: gateReadiness.allWarnings,
            readiness: (gateReadiness.readiness || []).slice(0, 50),
            availableTransitions: (gateReadiness.availableTransitions || []).map((t) => ({
              targetStatus: t.targetStatus,
              gate: t.gate,
              requiredRoles: t.requiredRoles,
              hasAssignedApprover: t.hasAssignedApprover,
              assignedApprovers: (t.assignedApprovers || []).slice(0, 10),
            })),
          }
        : null;

      const aiLanguage = isPolish ? 'pl' : 'en';
      const targetLanguageName = t('initiatives.gateReadinessSection.english');
      const systemInstruction = [
        `You are a senior PMO governance lead.`,
        `Your goal is to review the Initiative's gate workflow governance and propose high-signal improvements.`,
        ``,
        `You MAY propose only changes in these categories:`,
        `1) Initiative top-bar fields (owner/sponsor/target date/priority) — update only`,
        `2) Gate role assignments (add/remove explicit assignments)`,
        `3) Updates to EXISTING gate decisions (owner, due date, description)`,
        `4) Updates to EXISTING tasks (assignee/due/status) — update only`,
        `5) Updates to EXISTING RAID items (severity/status/owner/due/title/description) — update only`,
        ``,
        `Rules:`,
        `- Do NOT propose creating new tasks, decisions, or gates.`,
        `- Do NOT propose changing the initiative status.`,
        `- Do NOT invent user ids. You MUST use only userId values from ALLOWED USERS.`,
        `- Do NOT invent decision ids. For decision updates, you MUST use only decisionId values from EXISTING GATE DECISIONS.`,
        `- Do NOT invent task ids. For task updates, you MUST use only taskId values from EXISTING TASKS.`,
        `- Do NOT invent raid ids. For RAID updates, you MUST use only raidId values from EXISTING RAID ITEMS.`,
        `- gateRole MUST be one of ALLOWED GATE ROLES.`,
        `- dueDate (if used) MUST be in YYYY-MM-DD format.`,
        `- For initiative.priority use exactly one of: ${ALLOWED_PRIORITIES.join(' | ')}`,
        `- For tasks.status use exactly one of: ${ALLOWED_TASK_STATUSES.join(' | ')}`,
        `- Output language MUST be ${targetLanguageName}. Translate if needed.`,
        ``,
        `Return ONLY valid JSON (no markdown, no code fences, no commentary).`,
        `Schema:`,
        `{`,
        `"initiative": { "update"?: { "ownerId"?: string, "sponsorId"?: string, "plannedEndDate"?: "YYYY-MM-DD", "priority"?: "critical"|"high"|"medium"|"low", "reason": string } },`,
        `"gateRoles": {`,
        `"add": [ { "gateRole": string, "userId": string, "reason": string } ],`,
        `"remove": [ { "gateRole": string, "userId": string, "reason": string } ]`,
        `},`,
        `"gateDecisions": {`,
        `"update": [ { "decisionId": string, "decisionOwnerId"?: string, "dueDate"?: "YYYY-MM-DD", "description"?: string, "reason": string } ]`,
        `},`,
        `"tasks": {`,
        `"update": [ { "taskId": string, "assigneeId"?: string, "dueDate"?: "YYYY-MM-DD", "status"?: "TODO"|"IN_PROGRESS"|"BLOCKED"|"DONE", "reason": string } ]`,
        `},`,
        `"raid": {`,
        `"update": [ { "raidId": string, "severity"?: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "status"?: string, "ownerId"?: string, "dueDate"?: "YYYY-MM-DD", "title"?: string, "description"?: string, "reason": string } ]`,
        `},`,
        `"note"?: string`,
        `}`,
      ].join('\n');

      const contextText = [
        `[INITIATIVE CONTEXT]`,
        `Initiative name: ${initiative?.name || ''}`,
        `Status: ${initiative?.status || ''}`,
        `Priority: ${initiative?.priority || ''}`,
        `Summary: ${(initiative?.summary || initiative?.description || '').toString()}`,
        ``,
        `[GATE READINESS]`,
        JSON.stringify(readinessSnapshot, null, 2),
        ``,
        `[EXISTING EXPLICIT GATE ROLE ASSIGNMENTS]`,
        JSON.stringify(
          explicitAssignments.map((r) => ({
            gateRole: String(r.gateRole),
            userId: String(r.userId),
            name: `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || r.userId,
          })),
          null,
          2
        ),
        ``,
        `[EXISTING GATE DECISIONS]`,
        JSON.stringify(
          gateDecisions.map((d) => ({
            decisionId: String(d.id),
            type: String(d.type || ''),
            status: String(d.status || ''),
            decisionOwnerId: (d as any)?.decisionOwnerId || (d as any)?.decisionMakerId || null,
            dueDate: (d as any)?.dueDate || null,
            description: String((d as any)?.description || '').slice(0, 600) || null,
          })),
          null,
          2
        ),
        ``,
        `[ALLOWED USERS]`,
        JSON.stringify(
          users.map((u) => ({
            userId: String(u.id),
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.id,
            email: u.email || null,
          })),
          null,
          2
        ),
        ``,
        `[ALLOWED GATE ROLES]`,
        JSON.stringify(Array.from(allowedRoles), null, 2),
        ``,
        `[EXISTING TASKS]`,
        JSON.stringify(
          (tasks || []).slice(0, 80).map((t: any) => ({
            taskId: String(t?.id),
            title: String(t?.title || ''),
            status: String(t?.status || ''),
            dueDate: String(t?.dueDate || ''),
            assigneeId: t?.assigneeId ? String(t.assigneeId) : null,
            assigneeName: t?.assigneeName || null,
          })),
          null,
          2
        ),
        ``,
        `[EXISTING RAID ITEMS]`,
        JSON.stringify(
          (raidItems || []).slice(0, 60).map((r: any) => ({
            raidId: String(r?.id),
            type: String(r?.type || ''),
            title: String(r?.title || ''),
            status: String(r?.status || ''),
            severity: String(r?.severity || ''),
            ownerId: r?.ownerId ? String(r.ownerId) : null,
            owner: r?.owner || null,
            dueDate: r?.dueDate || null,
            description: String(r?.description || '').slice(0, 400) || null,
          })),
          null,
          2
        ),
        ``,
        `[INITIATIVE TOP BAR]`,
        JSON.stringify(
          {
            ownerId: ownerId || null,
            sponsorId: sponsorId || null,
            plannedEndDate: targetDate || null,
            priority: String(initiative?.priority || ''),
          },
          null,
          2
        ),
      ].join('\n');

      const aiRes = await Api.post('/ai/refine-text?timeoutMs=20000', {
        text: contextText,
        mode: 'generate',
        systemInstruction,
        fieldLabel: 'Initiative gates governance review',
        artifactContext: {
          title: initiative?.name || '',
          status: initiative?.status || '',
          priority: initiative?.priority || '',
          type: 'initiative',
        },
        language: aiLanguage,
      });

      const parsed = safeJsonParse(String(aiRes?.text || '')) as any;
      const proposal: AIGatesProposal = {
        initiative: {
          update: parsed?.initiative?.update ? parsed.initiative.update : undefined,
        },
        gateRoles: {
          add: Array.isArray(parsed?.gateRoles?.add) ? parsed.gateRoles.add : [],
          remove: Array.isArray(parsed?.gateRoles?.remove) ? parsed.gateRoles.remove : [],
        },
        gateDecisions: {
          update: Array.isArray(parsed?.gateDecisions?.update) ? parsed.gateDecisions.update : [],
        },
        tasks: {
          update: Array.isArray(parsed?.tasks?.update) ? parsed.tasks.update : [],
        },
        raid: {
          update: Array.isArray(parsed?.raid?.update) ? parsed.raid.update : [],
        },
        note: parsed?.note ? String(parsed.note).trim() : undefined,
      };

      // Normalize initiative update
      if (proposal.initiative.update) {
        const u = proposal.initiative.update as any;
        const owner = u?.ownerId ? String(u.ownerId).trim() : undefined;
        const sponsor = u?.sponsorId ? String(u.sponsorId).trim() : undefined;
        const plannedEndDate = u?.plannedEndDate ? String(u.plannedEndDate).trim() : undefined;
        const pr = u?.priority ? String(u.priority).trim().toLowerCase() : undefined;
        const reason = String(u?.reason || '').trim();

        const normalized: AIGatesProposal['initiative']['update'] = {
          reason: reason || 'Suggested top-bar adjustment to improve gate readiness.',
        };
        if (owner && allowedUserIds.has(owner)) normalized.ownerId = owner;
        if (sponsor && allowedUserIds.has(sponsor)) normalized.sponsorId = sponsor;
        if (plannedEndDate && /^\d{4}-\d{2}-\d{2}$/.test(plannedEndDate)) {
          normalized.plannedEndDate = plannedEndDate;
        }
        if (
          pr &&
          (ALLOWED_PRIORITIES as readonly string[]).includes(pr) &&
          pr !==
            String(initiative?.priority || '')
              .trim()
              .toLowerCase()
        ) {
          normalized.priority = pr as any;
        }

        // Drop update if it contains no actionable field
        const hasAny =
          !!normalized.ownerId ||
          !!normalized.sponsorId ||
          !!normalized.plannedEndDate ||
          !!normalized.priority;
        proposal.initiative.update = hasAny ? normalized : undefined;
      }

      // Normalize role add/remove
      proposal.gateRoles.add = proposal.gateRoles.add
        .map((x: any) => ({
          gateRole: String(x?.gateRole || '').trim(),
          userId: String(x?.userId || '').trim(),
          reason: String(x?.reason || '').trim(),
        }))
        .filter((x) => x.gateRole && x.userId && x.reason)
        .filter((x) => allowedRoles.has(x.gateRole) && allowedUserIds.has(x.userId))
        .filter((x) => !explicitSet.has(`${x.gateRole}::${x.userId}`))
        .slice(0, 12);

      proposal.gateRoles.remove = proposal.gateRoles.remove
        .map((x: any) => ({
          gateRole: String(x?.gateRole || '').trim(),
          userId: String(x?.userId || '').trim(),
          reason: String(x?.reason || '').trim(),
        }))
        .filter((x) => x.gateRole && x.userId && x.reason)
        .filter((x) => allowedRoles.has(x.gateRole) && allowedUserIds.has(x.userId))
        .filter((x) => explicitSet.has(`${x.gateRole}::${x.userId}`))
        .slice(0, 12);

      // Normalize decision updates
      proposal.gateDecisions.update = proposal.gateDecisions.update
        .map((x: any) => ({
          decisionId: String(x?.decisionId || '').trim(),
          decisionOwnerId: x?.decisionOwnerId ? String(x.decisionOwnerId).trim() : undefined,
          dueDate: x?.dueDate ? String(x.dueDate).trim() : undefined,
          description: x?.description ? String(x.description).trim() : undefined,
          reason: String(x?.reason || '').trim(),
        }))
        .filter((x) => x.decisionId && x.reason)
        .filter((x) => decisionIdSet.has(x.decisionId))
        .filter((x) => (x.decisionOwnerId ? allowedUserIds.has(x.decisionOwnerId) : true))
        .filter((x) => (x.dueDate ? /^\d{4}-\d{2}-\d{2}$/.test(x.dueDate) : true))
        .filter((x) => !!x.decisionOwnerId || !!x.dueDate || !!x.description)
        .slice(0, 20);

      // Normalize task updates
      proposal.tasks.update = proposal.tasks.update
        .map((x: any) => ({
          taskId: String(x?.taskId || '').trim(),
          assigneeId: x?.assigneeId ? String(x.assigneeId).trim() : undefined,
          dueDate: x?.dueDate ? String(x.dueDate).trim() : undefined,
          status: normalizeTaskStatus(x?.status),
          reason: String(x?.reason || '').trim(),
        }))
        .filter((x) => x.taskId && x.reason)
        .filter((x) => taskIdSet.has(x.taskId))
        .filter((x) => (x.assigneeId ? allowedUserIds.has(x.assigneeId) : true))
        .filter((x) => (x.dueDate ? /^\d{4}-\d{2}-\d{2}$/.test(x.dueDate) : true))
        .filter((x) => !!x.assigneeId || !!x.dueDate || !!x.status)
        .slice(0, 25);

      // Normalize RAID updates
      proposal.raid.update = proposal.raid.update
        .map((x: any) => ({
          raidId: String(x?.raidId || '').trim(),
          severity: normalizeRaidSeverity(x?.severity),
          status: normalizeRaidStatus(x?.status),
          ownerId: x?.ownerId ? String(x.ownerId).trim() : undefined,
          dueDate: x?.dueDate ? String(x.dueDate).trim() : undefined,
          title: x?.title ? String(x.title).trim() : undefined,
          description: x?.description ? String(x.description).trim() : undefined,
          reason: String(x?.reason || '').trim(),
        }))
        .filter((x) => x.raidId && x.reason)
        .filter((x) => raidIdSet.has(x.raidId))
        .filter((x) => (x.ownerId ? allowedUserIds.has(x.ownerId) : true))
        .filter((x) => (x.dueDate ? /^\d{4}-\d{2}-\d{2}$/.test(x.dueDate) : true))
        .filter(
          (x) =>
            !!x.severity || !!x.status || !!x.ownerId || !!x.dueDate || !!x.title || !!x.description
        )
        .slice(0, 30);

      const hasAny =
        !!proposal.initiative.update ||
        proposal.gateRoles.add.length > 0 ||
        proposal.gateRoles.remove.length > 0 ||
        proposal.gateDecisions.update.length > 0 ||
        proposal.tasks.update.length > 0 ||
        proposal.raid.update.length > 0;

      if (!hasAny) {
        const msg = t('initiatives.gateReadinessSection.aiFoundNoChangeSuggestionsGates');
        setNoSuggestionsMessage(msg);
        if (noSuggestionsTimerRef.current) window.clearTimeout(noSuggestionsTimerRef.current);
        noSuggestionsTimerRef.current = window.setTimeout(() => {
          setNoSuggestionsMessage(null);
          noSuggestionsTimerRef.current = null;
        }, 7000);
      }

      // Always open modal (also for "no suggestions" — per UX request)
      setAiProposal(proposal);
      setShowAIModal(true);
      setSelectedRoleAddIdx(
        Object.fromEntries(proposal.gateRoles.add.map((_, idx) => [idx, true])) as Record<
          number,
          boolean
        >
      );
      setSelectedRoleRemove(
        Object.fromEntries(
          proposal.gateRoles.remove.map((r) => [`${r.gateRole}::${r.userId}`, false])
        ) as Record<string, boolean>
      );
      setSelectedDecisionUpdate(
        Object.fromEntries(
          proposal.gateDecisions.update.map((u) => [u.decisionId, true])
        ) as Record<string, boolean>
      );
      setSelectedInitiativeFields({
        ownerId: !!proposal.initiative.update?.ownerId,
        sponsorId: !!proposal.initiative.update?.sponsorId,
        plannedEndDate: !!proposal.initiative.update?.plannedEndDate,
        priority: !!proposal.initiative.update?.priority,
      });
      setSelectedTaskUpdate(
        Object.fromEntries(proposal.tasks.update.map((u) => [u.taskId, true])) as Record<
          string,
          boolean
        >
      );
      setSelectedRaidUpdate(
        Object.fromEntries(proposal.raid.update.map((u) => [u.raidId, true])) as Record<
          string,
          boolean
        >
      );
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.gateReadinessSection.failedToAnalyzeGates'));
    } finally {
      setIsAIProposing(false);
    }
  }, [
    decisions,
    gateReadiness,
    gateRoles,
    initiative,
    initiativeId,
    isPolish,
    ownerId,
    raidItems,
    sponsorId,
    targetDate,
    tasks,
    users,
    t,
  ]);

  useEffect(() => {
    if (!gatesAiRequest) return;
    const run = async () => {
      try {
        await proposeGatesWithAI();
      } finally {
        clearGatesAiRequest();
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatesAiRequest?.nonce]);

  const closeAIModal = useCallback(() => {
    setShowAIModal(false);
    setAiProposal(null);
    setSelectedRoleAddIdx({});
    setSelectedRoleRemove({});
    setSelectedDecisionUpdate({});
    setSelectedInitiativeFields({});
    setSelectedTaskUpdate({});
    setSelectedRaidUpdate({});
  }, []);

  const applyAIProposal = useCallback(async () => {
    if (!aiProposal) return;
    if (!initiativeId) return;
    const initiativeUpdate = aiProposal.initiative.update;
    const roleAdds = aiProposal.gateRoles.add.filter((_, idx) => selectedRoleAddIdx[idx]);
    const roleRemoves = aiProposal.gateRoles.remove.filter(
      (r) => selectedRoleRemove[`${r.gateRole}::${r.userId}`]
    );
    const decisionUpdates = aiProposal.gateDecisions.update.filter(
      (u) => selectedDecisionUpdate[u.decisionId]
    );
    const taskUpdates = aiProposal.tasks.update.filter((u) => selectedTaskUpdate[u.taskId]);
    const raidUpdates = aiProposal.raid.update.filter((u) => selectedRaidUpdate[u.raidId]);

    const selectedInitiativePayload: Record<string, any> = {};
    if (initiativeUpdate?.ownerId && selectedInitiativeFields.ownerId) {
      selectedInitiativePayload.ownerId = initiativeUpdate.ownerId;
    }
    if (initiativeUpdate?.sponsorId && selectedInitiativeFields.sponsorId) {
      selectedInitiativePayload.sponsorId = initiativeUpdate.sponsorId;
    }
    if (initiativeUpdate?.plannedEndDate && selectedInitiativeFields.plannedEndDate) {
      selectedInitiativePayload.plannedEndDate = initiativeUpdate.plannedEndDate;
    }
    if (initiativeUpdate?.priority && selectedInitiativeFields.priority) {
      selectedInitiativePayload.priority = initiativeUpdate.priority;
    }

    if (
      Object.keys(selectedInitiativePayload).length === 0 &&
      roleAdds.length === 0 &&
      roleRemoves.length === 0 &&
      decisionUpdates.length === 0 &&
      taskUpdates.length === 0 &&
      raidUpdates.length === 0
    ) {
      toast.error(t('initiatives.gateReadinessSection.selectChangesToApply'));
      return;
    }

    if (roleRemoves.length > 0) {
      const ok = window.confirm(
        t('initiatives.gateReadinessSection.removeGateRoleAssignmentsConfirm', {
          count: roleRemoves.length,
        })
      );
      if (!ok) return;
    }

    setIsAIProposing(true);
    try {
      // 0) Initiative top-bar updates
      if (Object.keys(selectedInitiativePayload).length > 0) {
        await Api.put(`/initiatives/${initiativeId}`, selectedInitiativePayload);
      }

      // 1) Gate roles (explicit only)
      if (roleAdds.length > 0 || roleRemoves.length > 0) {
        const removeSet = new Set(roleRemoves.map((r) => `${r.gateRole}::${r.userId}`));
        const existingExplicit = (gateRoles || [])
          .filter((r) => r.source === 'explicit')
          .map((r) => ({ gateRole: String(r.gateRole), userId: String(r.userId) }));

        const next: Array<{ gateRole: string; userId: string }> = existingExplicit.filter(
          (r) => !removeSet.has(`${r.gateRole}::${r.userId}`)
        );
        const nextSet = new Set(next.map((r) => `${r.gateRole}::${r.userId}`));
        for (const a of roleAdds) {
          const key = `${a.gateRole}::${a.userId}`;
          if (!nextSet.has(key)) {
            next.push({ gateRole: a.gateRole, userId: a.userId });
            nextSet.add(key);
          }
        }

        await Api.put(`/initiatives/${initiativeId}/gate-roles`, { roles: next });
      }

      // 2) Gate decision updates
      if (decisionUpdates.length > 0) {
        for (const u of decisionUpdates) {
          const payload: Record<string, any> = {};
          if (u.decisionOwnerId) payload.decisionOwnerId = u.decisionOwnerId;
          if (u.dueDate) payload.dueDate = toIsoFromDateOnly(u.dueDate);
          if (u.description) payload.description = u.description;
          if (Object.keys(payload).length === 0) continue;
          await Api.put(`/decisions/${u.decisionId}`, payload);
        }
      }

      // 3) Task updates
      if (taskUpdates.length > 0) {
        for (const u of taskUpdates) {
          const payload: Record<string, any> = {};
          if (u.assigneeId) payload.assigneeId = u.assigneeId;
          if (u.dueDate) payload.dueDate = toIsoFromDateOnly(u.dueDate);
          if (u.status) payload.status = u.status;
          if (Object.keys(payload).length === 0) continue;
          await Api.put(`/tasks/${u.taskId}`, payload);
        }
      }

      // 4) RAID updates (initiative-scoped RAID endpoints)
      if (raidUpdates.length > 0) {
        for (const u of raidUpdates) {
          const payload: Record<string, any> = {};
          if (u.title) payload.title = u.title;
          if (u.description) payload.description = u.description;
          if (u.severity) payload.severity = u.severity;
          if (u.status) payload.status = u.status;
          if (u.ownerId) payload.ownerId = u.ownerId;
          if (u.dueDate) payload.dueDate = toIsoFromDateOnly(u.dueDate);
          if (Object.keys(payload).length === 0) continue;
          await Api.patch(`/initiatives/${initiativeId}/raid/${u.raidId}`, payload);
        }
      }

      toast.success(t('initiatives.gateReadinessSection.appliedAiSuggestions'));
      await fetchAll();
      closeAIModal();
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.gateReadinessSection.failedToApply'));
    } finally {
      setIsAIProposing(false);
    }
  }, [
    aiProposal,
    closeAIModal,
    fetchAll,
    gateRoles,
    initiativeId,
    isPolish,
    selectedInitiativeFields,
    selectedDecisionUpdate,
    selectedRoleAddIdx,
    selectedRoleRemove,
    selectedTaskUpdate,
    selectedRaidUpdate,
    t,
  ]);

  const reqLabels: Record<string, { en: string; pl: string }> = {
    title: { en: 'Title defined', pl: 'Tytuł zdefiniowany' },
    problem: { en: 'Problem statement', pl: 'Opis problemu' },
    owner: { en: 'Owner assigned', pl: 'Właściciel przypisany' },
    sponsor: { en: 'Sponsor assigned', pl: 'Sponsor przypisany' },
    timeline: { en: 'Timeline set', pl: 'Harmonogram ustalony' },
    team: { en: 'Team assigned', pl: 'Zespół przypisany' },
    risks: { en: 'Risks identified', pl: 'Ryzyka zidentyfikowane' },
    objective: { en: 'Objective defined', pl: 'Cel zdefiniowany' },
    scope: { en: 'Scope defined', pl: 'Zakres zdefiniowany' },
    capacity: { en: 'Capacity confirmed', pl: 'Zasoby potwierdzone' },
    dependencies: { en: 'Dependencies mapped', pl: 'Zależności zmapowane' },
    all_tasks_done: { en: 'All tasks done', pl: 'Wszystkie zadania ukończone' },
    delivery_confirmed: { en: 'Delivery confirmed', pl: 'Dostawa potwierdzona' },
    baseline_kpis: { en: 'Baseline KPIs', pl: 'Bazowe KPI' },
    tracking_period: { en: 'Tracking period', pl: 'Okres śledzenia' },
    blocked_reason: { en: 'Block reason', pl: 'Powód blokady' },
    impact_assessment: { en: 'Impact assessment', pl: 'Ocena wpływu' },
    resolution_decision: { en: 'Resolution decision', pl: 'Decyzja o rozwiązaniu' },
    updated_timeline: { en: 'Updated timeline', pl: 'Zaktualizowany harmonogram' },
  };

  return (
    <CollapsibleSection
      id="gateReadiness"
      title={t('initiatives.gateReadinessSection.gateReadinessTimeline')}
      icon={<Flag size={18} className="text-indigo-500 dark:text-indigo-400" />}
      iconBg="bg-c-surface-raised"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        <div className="flex items-center gap-2">
          {nextGate && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
              {t('initiatives.gateReadinessSection.next')}: {nextGate}
            </span>
          )}
          {requiredGates.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
              {requiredGates.filter((g) => getGateStatus(g.pmoDomain) === 'APPROVED').length}/
              {requiredGates.length}
            </span>
          )}
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          {nextGateConfig && canRequestApproval && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                handleRequestApproval(
                  nextGateConfig.requiredRole === 'owner' ? 'owner' : 'sponsor',
                  nextGate!
                );
              }}
              disabled={isMutating}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-c-border text-c-text-muted hover:text-c-text hover:border-c-border-strong text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Send size={14} />
              <span>{t('initiatives.gateReadinessSection.request')}</span>
            </motion.button>
          )}
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              if (aiBlockedForStatus) return;
              requestGatesAi();
            }}
            disabled={!!gatesAiRequest || aiBlockedForStatus}
            title={
              aiBlockedForStatus
                ? t('initiatives.gateReadinessSection.aiNotAvailableForStatus')
                : undefined
            }
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-c-border text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {gatesAiRequest ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            <span>AI</span>
          </motion.button>
        </div>
      }
    >
      {/* AI "no suggestions" callout (auto-dismiss) */}
      {noSuggestionsMessage && !showAIModal && (
        <div className="mb-4">
          <Callout variant="purple" title={t('initiatives.gateReadinessSection.aiNoSuggestions')}>
            {noSuggestionsMessage}
          </Callout>
        </div>
      )}

      {/* AI proposal modal */}
      {showAIModal && aiProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-3xl rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200/60 dark:border-navy-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-c-surface-raised flex items-center justify-center">
                  <Sparkles size={16} className="text-c-info" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-c-text">
                    {t('initiatives.gateReadinessSection.aiGatesReview')}
                  </div>
                  <div className="text-xs text-c-text-muted">
                    {t('initiatives.gateReadinessSection.nothingAppliedAutomatically')}
                  </div>
                </div>
              </div>
              <button
                onClick={closeAIModal}
                className="p-2 rounded-xl hover:bg-c-surface-raised text-c-text-muted"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {aiProposal.note ? (
                <Callout variant="purple" title={t('initiatives.gateReadinessSection.aiNote')}>
                  {aiProposal.note}
                </Callout>
              ) : null}

              {/* Initiative top-bar updates */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-c-text">
                    {t('initiatives.gateReadinessSection.initiativeTopBar')}
                  </span>
                </div>

                {!aiProposal.initiative.update ? (
                  <EmptyStateInline
                    icon={Flag}
                    message={t('initiatives.gateReadinessSection.noTopBarChanges')}
                    hint={t('initiatives.gateReadinessSection.aiSuggestsNoTopBarChanges')}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {(() => {
                      const u = aiProposal.initiative.update!;
                      const items: Array<
                        | {
                            key: 'ownerId' | 'sponsorId';
                            label: string;
                            value: string;
                          }
                        | { key: 'plannedEndDate' | 'priority'; label: string; value: string }
                      > = [];

                      if (u.ownerId) {
                        const user = users.find((x) => String(x.id) === String(u.ownerId));
                        const name =
                          (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '') ||
                          (user ? user.email : '') ||
                          u.ownerId;
                        items.push({
                          key: 'ownerId',
                          label: 'Owner',
                          value: name,
                        });
                      }
                      if (u.sponsorId) {
                        const user = users.find((x) => String(x.id) === String(u.sponsorId));
                        const name =
                          (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '') ||
                          (user ? user.email : '') ||
                          u.sponsorId;
                        items.push({
                          key: 'sponsorId',
                          label: 'Sponsor',
                          value: name,
                        });
                      }
                      if (u.plannedEndDate) {
                        items.push({
                          key: 'plannedEndDate',
                          label: t('initiatives.gateReadinessSection.targetDateEnd'),
                          value: u.plannedEndDate,
                        });
                      }
                      if (u.priority) {
                        items.push({
                          key: 'priority',
                          label: t('initiatives.gateReadinessSection.priority'),
                          value: u.priority,
                        });
                      }

                      return items.map((it) => (
                        <label
                          key={it.key}
                          className="flex items-start gap-2 p-3 rounded-xl bg-slate-50/60 dark:bg-navy-800/40 border border-slate-200/60 dark:border-navy-700/60 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={!!selectedInitiativeFields[it.key]}
                            onChange={(e) =>
                              setSelectedInitiativeFields((p) => ({
                                ...p,
                                [it.key]: e.target.checked,
                              }))
                            }
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-c-text truncate">
                              {it.label}: {it.value}
                            </div>
                            <div className="text-[11px] text-c-text-muted mt-0.5">{u.reason}</div>
                          </div>
                        </label>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {/* Gate roles */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-c-text">
                    {t('initiatives.gateReadinessSection.gateRoles')}
                  </span>
                </div>

                {aiProposal.gateRoles.add.length === 0 &&
                aiProposal.gateRoles.remove.length === 0 ? (
                  <EmptyStateInline
                    icon={User}
                    message={t('initiatives.gateReadinessSection.noGateRoleChanges')}
                    hint={t('initiatives.gateReadinessSection.aiSuggestsNoRoleChanges')}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Adds */}
                    <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 p-3 bg-slate-50/60 dark:bg-navy-800/40">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-c-text-secondary uppercase tracking-wider">
                          {t('initiatives.gateReadinessSection.toAdd')} (
                          {aiProposal.gateRoles.add.length})
                        </span>
                        {aiProposal.gateRoles.add.length > 0 && (
                          <button
                            onClick={() =>
                              setSelectedRoleAddIdx(
                                Object.fromEntries(
                                  aiProposal.gateRoles.add.map((_, idx) => [idx, true])
                                ) as Record<number, boolean>
                              )
                            }
                            className="text-[11px] font-medium text-c-info hover:underline"
                          >
                            {t('initiatives.gateReadinessSection.selectAll')}
                          </button>
                        )}
                      </div>
                      {aiProposal.gateRoles.add.length === 0 ? (
                        <div className="text-xs text-c-text-muted">—</div>
                      ) : (
                        <div className="space-y-1.5">
                          {aiProposal.gateRoles.add.map((a, idx) => {
                            const u = users.find((x) => String(x.id) === String(a.userId));
                            const name =
                              (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '') ||
                              (u ? u.email : '') ||
                              a.userId;
                            return (
                              <label
                                key={`${a.gateRole}::${a.userId}::${idx}`}
                                className="flex items-start gap-2 p-2 rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/40 dark:border-navy-700/40 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={!!selectedRoleAddIdx[idx]}
                                  onChange={(e) =>
                                    setSelectedRoleAddIdx((p) => ({
                                      ...p,
                                      [idx]: e.target.checked,
                                    }))
                                  }
                                  className="mt-0.5"
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-c-text truncate">
                                    {a.gateRole} → {name}
                                  </div>
                                  <div className="text-[11px] text-c-text-muted">{a.reason}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Removes */}
                    <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 p-3 bg-slate-50/60 dark:bg-navy-800/40">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-c-text-secondary uppercase tracking-wider">
                          {t('initiatives.gateReadinessSection.toRemove')} (
                          {aiProposal.gateRoles.remove.length})
                        </span>
                        {aiProposal.gateRoles.remove.length > 0 && (
                          <button
                            onClick={() =>
                              setSelectedRoleRemove(
                                Object.fromEntries(
                                  aiProposal.gateRoles.remove.map((r) => [
                                    `${r.gateRole}::${r.userId}`,
                                    true,
                                  ])
                                ) as Record<string, boolean>
                              )
                            }
                            className="text-[11px] font-medium text-c-info hover:underline"
                          >
                            {t('initiatives.gateReadinessSection.selectAll')}
                          </button>
                        )}
                      </div>
                      {aiProposal.gateRoles.remove.length === 0 ? (
                        <div className="text-xs text-c-text-muted">—</div>
                      ) : (
                        <div className="space-y-1.5">
                          {aiProposal.gateRoles.remove.map((r) => {
                            const key = `${r.gateRole}::${r.userId}`;
                            const u = users.find((x) => String(x.id) === String(r.userId));
                            const name =
                              (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '') ||
                              (u ? u.email : '') ||
                              r.userId;
                            return (
                              <label
                                key={key}
                                className="flex items-start gap-2 p-2 rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/40 dark:border-navy-700/40 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={!!selectedRoleRemove[key]}
                                  onChange={(e) =>
                                    setSelectedRoleRemove((p) => ({
                                      ...p,
                                      [key]: e.target.checked,
                                    }))
                                  }
                                  className="mt-0.5"
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-c-text truncate">
                                    {r.gateRole} → {name}
                                  </div>
                                  <div className="text-[11px] text-c-text-muted">{r.reason}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Gate decision updates */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-c-text">
                    {t('initiatives.gateReadinessSection.gateDecisions')}
                  </span>
                </div>
                {aiProposal.gateDecisions.update.length === 0 ? (
                  <EmptyStateInline
                    icon={Flag}
                    message={t('initiatives.gateReadinessSection.noDecisionUpdates')}
                    hint={t('initiatives.gateReadinessSection.aiSuggestsNoDecisionUpdates')}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {aiProposal.gateDecisions.update.map((u) => {
                      const decision = (decisions || []).find(
                        (d) => String(d.id) === String(u.decisionId)
                      );
                      const title = decision?.title || decision?.type || u.decisionId;
                      const ownerUser = u.decisionOwnerId
                        ? users.find((x) => String(x.id) === String(u.decisionOwnerId))
                        : undefined;
                      const ownerName = u.decisionOwnerId
                        ? (ownerUser
                            ? `${ownerUser.firstName || ''} ${ownerUser.lastName || ''}`.trim()
                            : '') ||
                          ownerUser?.email ||
                          u.decisionOwnerId
                        : null;
                      return (
                        <label
                          key={u.decisionId}
                          className="flex items-start gap-2 p-3 rounded-xl bg-slate-50/60 dark:bg-navy-800/40 border border-slate-200/60 dark:border-navy-700/60 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={!!selectedDecisionUpdate[u.decisionId]}
                            onChange={(e) =>
                              setSelectedDecisionUpdate((p) => ({
                                ...p,
                                [u.decisionId]: e.target.checked,
                              }))
                            }
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-c-text truncate">
                              {title}
                            </div>
                            <div className="text-[11px] text-c-text-muted mt-0.5">{u.reason}</div>
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-c-text-secondary">
                              <div className="rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/40 dark:border-navy-700/40 px-2 py-1">
                                <span className="text-c-text-muted">Owner:</span>{' '}
                                <span className="font-medium">{ownerName || '—'}</span>
                              </div>
                              <div className="rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/40 dark:border-navy-700/40 px-2 py-1">
                                <span className="text-c-text-muted">Due:</span>{' '}
                                <span className="font-medium">{u.dueDate || '—'}</span>
                              </div>
                              <div className="rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/40 dark:border-navy-700/40 px-2 py-1">
                                <span className="text-c-text-muted">Note:</span>{' '}
                                <span className="font-medium">{u.description ? '✓' : '—'}</span>
                              </div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Task updates */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-c-text">
                    {t('initiatives.gateReadinessSection.tasks')}
                  </span>
                </div>
                {aiProposal.tasks.update.length === 0 ? (
                  <EmptyStateInline
                    icon={CheckCircle2}
                    message={t('initiatives.gateReadinessSection.noTaskUpdates')}
                    hint={t('initiatives.gateReadinessSection.aiSuggestsNoTaskChanges')}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {aiProposal.tasks.update.map((u) => {
                      const task = (tasks || []).find(
                        (t: any) => String(t?.id) === String(u.taskId)
                      );
                      const title = String((task as any)?.title || '').trim() || u.taskId;
                      const assigneeUser = u.assigneeId
                        ? users.find((x) => String(x.id) === String(u.assigneeId))
                        : undefined;
                      const assigneeName = u.assigneeId
                        ? (assigneeUser
                            ? `${assigneeUser.firstName || ''} ${assigneeUser.lastName || ''}`.trim()
                            : '') ||
                          assigneeUser?.email ||
                          u.assigneeId
                        : null;
                      return (
                        <label
                          key={u.taskId}
                          className="flex items-start gap-2 p-3 rounded-xl bg-slate-50/60 dark:bg-navy-800/40 border border-slate-200/60 dark:border-navy-700/60 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={!!selectedTaskUpdate[u.taskId]}
                            onChange={(e) =>
                              setSelectedTaskUpdate((p) => ({
                                ...p,
                                [u.taskId]: e.target.checked,
                              }))
                            }
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-c-text truncate">
                              {title}
                            </div>
                            <div className="text-[11px] text-c-text-muted mt-0.5">{u.reason}</div>
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-c-text-secondary">
                              <div className="rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/40 dark:border-navy-700/40 px-2 py-1">
                                <span className="text-c-text-muted">Owner:</span>{' '}
                                <span className="font-medium">{assigneeName || '—'}</span>
                              </div>
                              <div className="rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/40 dark:border-navy-700/40 px-2 py-1">
                                <span className="text-c-text-muted">Due:</span>{' '}
                                <span className="font-medium">{u.dueDate || '—'}</span>
                              </div>
                              <div className="rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/40 dark:border-navy-700/40 px-2 py-1">
                                <span className="text-c-text-muted">Status:</span>{' '}
                                <span className="font-medium">{u.status || '—'}</span>
                              </div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RAID updates */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-c-text">RAID</span>
                </div>
                {aiProposal.raid.update.length === 0 ? (
                  <EmptyStateInline
                    icon={User}
                    message={t('initiatives.gateReadinessSection.noRaidUpdates')}
                    hint={t('initiatives.gateReadinessSection.aiSuggestsNoRaidChanges')}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {aiProposal.raid.update.map((u) => {
                      const item = (raidItems || []).find(
                        (r: any) => String(r?.id) === String(u.raidId)
                      );
                      const title = String(item?.title || '').trim() || u.raidId;
                      const ownerUser = u.ownerId
                        ? users.find((x) => String(x.id) === String(u.ownerId))
                        : undefined;
                      const ownerName = u.ownerId
                        ? (ownerUser
                            ? `${ownerUser.firstName || ''} ${ownerUser.lastName || ''}`.trim()
                            : '') ||
                          ownerUser?.email ||
                          u.ownerId
                        : null;
                      return (
                        <label
                          key={u.raidId}
                          className="flex items-start gap-2 p-3 rounded-xl bg-slate-50/60 dark:bg-navy-800/40 border border-slate-200/60 dark:border-navy-700/60 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={!!selectedRaidUpdate[u.raidId]}
                            onChange={(e) =>
                              setSelectedRaidUpdate((p) => ({
                                ...p,
                                [u.raidId]: e.target.checked,
                              }))
                            }
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-c-text truncate">
                              {title}
                            </div>
                            <div className="text-[11px] text-c-text-muted mt-0.5">{u.reason}</div>
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-c-text-secondary">
                              <div className="rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/40 dark:border-navy-700/40 px-2 py-1">
                                <span className="text-c-text-muted">Severity:</span>{' '}
                                <span className="font-medium">{u.severity || '—'}</span>
                              </div>
                              <div className="rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/40 dark:border-navy-700/40 px-2 py-1">
                                <span className="text-c-text-muted">Status:</span>{' '}
                                <span className="font-medium">{u.status || '—'}</span>
                              </div>
                              <div className="rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/40 dark:border-navy-700/40 px-2 py-1">
                                <span className="text-c-text-muted">Owner:</span>{' '}
                                <span className="font-medium">{ownerName || '—'}</span>
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-c-text-secondary">
                              <div className="rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/40 dark:border-navy-700/40 px-2 py-1">
                                <span className="text-c-text-muted">Due:</span>{' '}
                                <span className="font-medium">{u.dueDate || '—'}</span>
                              </div>
                              <div className="rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/40 dark:border-navy-700/40 px-2 py-1">
                                <span className="text-c-text-muted">Title:</span>{' '}
                                <span className="font-medium">{u.title ? '✓' : '—'}</span>
                              </div>
                              <div className="rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/40 dark:border-navy-700/40 px-2 py-1">
                                <span className="text-c-text-muted">Desc:</span>{' '}
                                <span className="font-medium">{u.description ? '✓' : '—'}</span>
                              </div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* No suggestions table */}
              {!aiProposal.initiative.update &&
              aiProposal.gateRoles.add.length === 0 &&
              aiProposal.gateRoles.remove.length === 0 &&
              aiProposal.gateDecisions.update.length === 0 &&
              aiProposal.tasks.update.length === 0 &&
              aiProposal.raid.update.length === 0 ? (
                <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 overflow-hidden">
                  <table
                    /* §27-exempt: sub-tabela w widoku szczegolow, nie samodzielna lista */ className="w-full"
                  >
                    <thead className="bg-slate-50/80 dark:bg-navy-800/60">
                      <tr>
                        <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
                          {t('initiatives.gateReadinessSection.analysisResult')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-4 py-3 text-sm text-c-text-secondary">
                          {t('initiatives.gateReadinessSection.aiDidNotProposeChanges')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>

            <div className="px-6 py-4 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center justify-between bg-slate-50/60 dark:bg-navy-900/40">
              <button
                onClick={closeAIModal}
                disabled={isAIProposing}
                className="px-4 py-2 rounded-xl text-sm font-medium text-c-text-muted hover:bg-c-surface-raised transition-colors disabled:opacity-50"
              >
                {t('initiatives.gateReadinessSection.close')}
              </button>
              <button
                onClick={() => void applyAIProposal()}
                disabled={
                  isAIProposing ||
                  (!aiProposal.initiative.update &&
                    aiProposal.gateRoles.add.length === 0 &&
                    aiProposal.gateRoles.remove.length === 0 &&
                    aiProposal.gateDecisions.update.length === 0 &&
                    aiProposal.tasks.update.length === 0 &&
                    aiProposal.raid.update.length === 0)
                }
                className="px-5 py-2 rounded-xl bg-c-text text-c-bg hover:opacity-90 disabled:opacity-40 text-sm font-semibold transition-opacity inline-flex items-center gap-2"
              >
                {isAIProposing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                <span>{t('initiatives.gateReadinessSection.applySelected')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Read-only happy-path status pipeline (L-03 / #14): "you are here + next gate".
          Reveals the status×gate matrix as an overview; transitions stay in the
          Properties Strip + workflow table below (existing endpoints). */}
      <div className="mb-6">
        <InitiativeStatusPipeline />
        {gateAiData?.enabled && (
          <div className="mt-3">
            <GateReadinessPill
              readiness={gateAiData.aiReadiness}
              loading={gateAiLoading}
              onClick={() => setShowGateAiPanel((v) => !v)}
            />
            {showGateAiPanel && (
              <div className="mt-2">
                <GateReadinessPanel
                  readiness={gateAiData.aiReadiness}
                  timeline={gateAiData.timeline}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full lifecycle gate workflow table (13 stages) */}
      <div className="mb-6">
        <InitiativeGatesWorkflowTable />
      </div>

      {/* Gate Timeline Visual */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-c-text-muted uppercase">
            {t('initiatives.gateReadinessSection.gateTimeline')}
          </span>
        </div>
        <div className="relative">
          <div className="absolute top-4 left-0 right-0 h-1 bg-c-border-subtle rounded-full" />
          <div
            className="absolute top-4 left-0 h-1 bg-gradient-to-r from-emerald-500 to-c-info rounded-full transition-all duration-500"
            style={{
              width: `${(() => {
                const gateOrder = ['PROMOTE', 'APPROVE', 'SCHEDULE', 'COMPLETE', 'START_TRACKING'];
                const currentIdx = nextGate ? gateOrder.indexOf(nextGate) : gateOrder.length;
                return Math.max(0, (currentIdx / gateOrder.length) * 100);
              })()}%`,
            }}
          />
          <div className="relative flex justify-between">
            {Object.entries(GATE_CONFIG)
              .filter(([key]) => !['BLOCK', 'UNBLOCK'].includes(key))
              .map(([key, config], idx, arr) => {
                const gateOrder = ['PROMOTE', 'APPROVE', 'SCHEDULE', 'COMPLETE', 'START_TRACKING'];
                const currentIdx = nextGate ? gateOrder.indexOf(nextGate) : gateOrder.length;
                const isPast = gateOrder.indexOf(key) < currentIdx;
                const isCurrent = key === nextGate;

                return (
                  <div
                    key={key}
                    className="flex flex-col items-center"
                    style={{ width: `${100 / arr.length}%` }}
                  >
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: isCurrent ? 1.2 : 1 }}
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                        isPast
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : isCurrent
                            ? 'bg-c-text border-c-text text-c-bg shadow-lg'
                            : 'bg-c-surface border-c-border text-c-text-secondary'
                      }`}
                    >
                      {isPast ? (
                        <Check size={14} />
                      ) : isCurrent ? (
                        <Flag size={14} />
                      ) : (
                        <span className="text-xs font-bold">{idx + 1}</span>
                      )}
                    </motion.div>
                    <div className={`mt-2 text-center ${isCurrent ? 'font-semibold' : ''}`}>
                      <p
                        className={`text-[10px] ${isPast ? 'text-emerald-500' : isCurrent ? 'text-c-text dark:text-white font-semibold' : 'text-c-text-secondary'}`}
                      >
                        {isPolish ? config.namePl.split(' ')[0] : config.name.split(' ')[0]}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Current Gate Details */}
      {nextGateConfig && (
        <div className="mb-4 p-4 rounded-xl bg-slate-50/60 dark:bg-navy-800/40 border border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-c-surface-raised">
                <Flag size={16} className="text-c-info" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-c-text-secondary">
                  {t('initiatives.gateReadinessSection.currentGate')}:{' '}
                  {isPolish ? nextGateConfig.namePl : nextGateConfig.name}
                </h4>
                <p className="text-xs text-c-text-muted">
                  {isPolish ? nextGateConfig.descriptionPl : nextGateConfig.description}
                </p>
              </div>
            </div>
          </div>

          {/* Backend readiness (source of truth) */}
          {backendReadiness.length > 0 && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-c-text-muted uppercase tracking-wide">
                  {t('initiatives.gateReadinessSection.readinessSystem')}
                </span>
                {blockingMissing.length > 0 ? (
                  <span className="text-[10px] font-semibold text-danger-500">
                    {t('initiatives.gateReadinessSection.blockingMissing')}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    OK
                  </span>
                )}
              </div>

              {blockingMissing.length > 0 && (
                <Callout
                  variant="warning"
                  compact
                  title={t('initiatives.gateReadinessSection.cantProgressYet')}
                >
                  {t('initiatives.gateReadinessSection.fillMissingBlockingItems')}
                </Callout>
              )}

              <div className="space-y-1">
                {backendReadiness.slice(0, 10).map((r) => {
                  const isBlocking = r.severity === 'blocking';
                  const isFail = !r.pass;
                  return (
                    <div
                      key={r.key}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border ${
                        isFail && isBlocking
                          ? 'bg-danger-500/5 border-danger-500/20'
                          : isFail
                            ? 'bg-amber-500/5 border-amber-500/20'
                            : 'bg-emerald-500/5 border-emerald-500/20'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center ${
                          r.pass ? 'bg-emerald-500' : isBlocking ? 'bg-danger-500' : 'bg-amber-500'
                        }`}
                      >
                        {r.pass ? (
                          <Check size={12} className="text-white" />
                        ) : (
                          <X size={12} className="text-white" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-c-text truncate">
                            {r.label}
                          </span>
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              isBlocking
                                ? 'bg-danger-500/10 text-danger-600 dark:text-danger-400'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {isBlocking
                              ? t('initiatives.gateReadinessSection.blocking')
                              : t('initiatives.gateReadinessSection.warning')}
                          </span>
                        </div>
                        {!r.pass && r.suggestedAction && (
                          <div className="mt-1 text-[11px] text-c-text-muted">
                            <span className="font-medium">
                              {t('initiatives.gateReadinessSection.suggestedAction')}:
                            </span>{' '}
                            {r.suggestedAction}
                            {r.suggestedActor && (
                              <span className="ml-2 text-c-text-secondary dark:text-c-text-muted">
                                ({r.suggestedActor})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {!r.pass && (
                        <button
                          type="button"
                          onClick={() => handleFix(r.key)}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold text-c-info hover:bg-c-surface-raised transition-colors shrink-0"
                          title={
                            !canEditCards
                              ? t('initiatives.gateReadinessSection.viewOnlyNoEditPermission')
                              : undefined
                          }
                        >
                          {t('initiatives.gateReadinessSection.fix')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Readiness Analysis */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-c-text-muted uppercase tracking-wide">
                {t('initiatives.gateReadinessSection.aiReadinessAnalysis')}
              </span>
              <button
                onClick={requestAIReadiness}
                disabled={isAIReadinessLoading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-c-info border border-c-border hover:bg-c-surface-raised transition-colors disabled:opacity-50"
              >
                {isAIReadinessLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Brain size={12} />
                )}
                {t('initiatives.gateReadinessSection.askAi')}
              </button>
            </div>

            {isAIReadinessLoading && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-c-surface-raised border border-c-border">
                <Loader2 size={14} className="animate-spin text-c-info" />
                <span className="text-xs text-c-info">
                  {t('initiatives.gateReadinessSection.aiAnalyzingReadiness')}
                </span>
              </div>
            )}

            {aiReadinessResult && !isAIReadinessLoading && (
              <div className="space-y-2">
                <div className="flex items-center gap-4 p-3 rounded-lg bg-c-surface-raised border border-c-border">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-c-text">
                      {aiReadinessResult.overallScore}%
                    </div>
                    <div className="text-[10px] text-c-text-muted">
                      {t('initiatives.gateReadinessSection.score')}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-c-text-muted uppercase mb-1">
                      {t('initiatives.gateReadinessSection.summary')}
                    </div>
                    <p className="text-xs text-c-text-secondary">{aiReadinessResult.summary}</p>
                  </div>
                </div>

                {aiReadinessResult.findings.length > 0 ? (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-c-text-muted uppercase">
                      {t('initiatives.gateReadinessSection.aiFindings')}
                    </span>
                    {aiReadinessResult.findings.map((f: any, idx: number) => (
                      <div
                        key={f.key || idx}
                        className={`p-2.5 rounded-lg border ${
                          f.severity === 'blocking' && !f.pass
                            ? 'bg-danger-500/5 border-danger-500/20'
                            : !f.pass
                              ? 'bg-amber-500/5 border-amber-500/20'
                              : 'bg-emerald-500/5 border-emerald-500/20'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center mt-0.5 shrink-0 ${
                              f.pass
                                ? 'bg-emerald-500'
                                : f.severity === 'blocking'
                                  ? 'bg-danger-500'
                                  : 'bg-amber-500'
                            }`}
                          >
                            {f.pass ? (
                              <Check size={10} className="text-white" />
                            ) : (
                              <X size={10} className="text-white" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-c-text">{f.message}</div>
                            {f.suggestedAction && (
                              <div className="mt-1 text-[11px] text-c-text-muted">
                                <span className="font-medium">
                                  {t('initiatives.gateReadinessSection.action')}:
                                </span>{' '}
                                {f.suggestedAction}
                                {f.suggestedActor && (
                                  <span className="ml-1.5 text-c-text-secondary dark:text-c-text-muted">
                                    ({f.suggestedActor})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-c-text-muted italic p-2">
                    {t('initiatives.gateReadinessSection.aiFoundNoAdditionalIssues')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Requirements Checklist */}
          <div className="space-y-2 mb-4">
            <span className="text-[10px] font-semibold text-c-text-muted uppercase">
              {t('initiatives.gateReadinessSection.requirementsChecklist')}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {nextGateConfig.requirements.map((req) => {
                const hasReq = checkRequirement(req);
                return (
                  <div
                    key={req}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      hasReq
                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                        : 'bg-c-surface-raised border border-c-border'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${hasReq ? 'bg-emerald-500' : 'bg-c-border-strong '}`}
                    >
                      {hasReq ? (
                        <Check size={12} className="text-white" />
                      ) : (
                        <X size={12} className="text-white" />
                      )}
                    </div>
                    <span
                      className={`text-xs ${hasReq ? 'text-emerald-600 dark:text-emerald-400' : 'text-c-text-muted'}`}
                    >
                      {isPolish ? reqLabels[req]?.pl : reqLabels[req]?.en || req}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Readiness Score */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-c-text-muted">
                {t('initiatives.gateReadinessSection.readiness')}
              </span>
              <span className="text-xs font-semibold text-c-text">{readinessPercent}%</span>
            </div>
            <div className="h-2 bg-c-border-subtle rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${readinessPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full bg-c-info rounded-full"
              />
            </div>
          </div>

          {/* Approver Info */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-white/50 dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50">
            <div className="flex items-center gap-2">
              <User size={14} className="text-c-text-secondary" />
              <span className="text-xs text-c-text-muted">
                {t('initiatives.gateReadinessSection.requiredApproval')}:
              </span>
              <span className="text-xs font-medium text-c-text-secondary">
                {getRoleLabel(nextGateConfig.requiredRole, isPolish)}
              </span>
            </div>
            {nextGateConfig.requiredRole === 'sponsor' && sponsorId && (
              <span className="text-xs text-c-text">{getUserDisplayName(sponsorId)}</span>
            )}
            {nextGateConfig.requiredRole === 'owner' && ownerId && (
              <span className="text-xs text-c-text">{getUserDisplayName(ownerId)}</span>
            )}
          </div>
        </div>
      )}

      {/* All Gates Status */}
      {requiredGates.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-c-text-muted uppercase block mb-2">
            {t('initiatives.gateReadinessSection.requiredApprovalsForStatus')}
          </span>
          {requiredGates.map((g) => {
            const gs = getGateStatus(g.pmoDomain);
            const ok = gs === 'APPROVED';
            return (
              <div
                key={g.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50 dark:bg-navy-800/50 border border-slate-200/50 dark:border-navy-700/50"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${ok ? 'bg-emerald-500' : gs === 'PENDING' ? 'bg-amber-500' : 'bg-c-border-strong '}`}
                  >
                    {ok ? (
                      <Check size={12} className="text-white" />
                    ) : gs === 'PENDING' ? (
                      <Clock size={12} className="text-white" />
                    ) : (
                      <X size={12} className="text-white" />
                    )}
                  </div>
                  <span className="text-sm text-c-text-secondary">{g.label}</span>
                </div>
                <span
                  className={`px-2 py-0.5 text-[10px] font-medium rounded ${ok ? 'bg-emerald-500/20 text-emerald-400' : gs === 'PENDING' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-c-text-secondary'}`}
                >
                  {gs === 'MISSING' ? t('initiatives.gateReadinessSection.notRequested') : gs}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!nextGateConfig && requiredGates.length === 0 && (
        <div className="text-center py-6 border-2 border-dashed border-c-border rounded-xl">
          <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500" />
          <p className="text-sm text-c-text-muted">
            {t('initiatives.gateReadinessSection.allGatesPassed')}
          </p>
        </div>
      )}
    </CollapsibleSection>
  );
};
