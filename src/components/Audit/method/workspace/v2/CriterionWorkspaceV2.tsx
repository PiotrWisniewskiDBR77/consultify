/**
 * CriterionWorkspaceV2 — SPEC-A (archetyp Rekord) reshell of the criterion
 * workspace, DEC-88 (owner accept 2026-08-26, Variant A on all 4 decision
 * cards). Behind `ff_criterionWorkspaceV2` (default OFF) — see
 * `../CriterionWorkspaceGate.tsx`.
 *
 * WHAT CHANGED vs. V1 (`../CriterionWorkspace.tsx`): ONLY the shell/layout.
 *  - 18 links grouped into 4 CONTIGUOUS macro-phases (Planowanie 1-3 ·
 *    Badanie 4-8 · Ustalenia 9-12 · Naprawa i zamknięcie 13-18) — see
 *    `../chainLinks.ts` `AUDIT_CHAIN_PHASES` (shared with V1, same states).
 *  - Evidence/finding tables stay `StandardTable`, now truncated to 3 rows
 *    (+ "show all") inside their phase card (`maxRows` prop added to
 *    `EvidencePanel`/`FindingPanel` — additive, V1 unaffected).
 *  - Right panel is `ArtifactRightPanel` (SPEC-A canon,
 *    `ARTIFACT_PANEL_SECTION_ORDER`) instead of no panel at all. "Rola i
 *    uprawnienia" is the first group inside Properties.
 *  - Menu 1 primary label/action tracks the single current link across all
 *    18 (see `getPrimaryAction` below) — never claims to perform a step
 *    that belongs to someone else; a handful of sub-states have NO backing
 *    endpoint yet (management-response reminder, a standalone
 *    "close criterion") and render honestly disabled with a reason instead
 *    of a fake handler (see BRAK_API notes inline).
 *
 * WHAT DID NOT CHANGE: the 18-link state machine (`chainLinks.ts`), every
 * API call, every capability gate, `EvidencePanel`/`FindingPanel`/
 * `RemediationPanel`/`TeresaProposalCard` internals. This file only composes
 * them differently.
 */
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Copy,
  FileText,
  Link2,
  Lock,
  MoreVertical,
  ScrollText,
  Send,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PreviewActivityStrip, type ActivityEvent } from '@/components/shared/PreviewPane/PreviewActivityStrip';
import { ErrorState, LoadingState, SaveStateIndicator, type SaveStatus } from '@/components/shared/states';
import { ArtifactRightPanel, type ArtifactRightPanelSection } from '@/components/standard/ArtifactRightPanel';
import { StatusChip, type StatusTone } from '@/components/ui/primitives/chips';
import { useAppStore } from '@/store/useAppStore';

import * as auditsMethodApi from '../../auditsMethodApi';
import type {
  AuditCriterionSummary,
  AuditProgramDetail,
  AuditProposalSummary,
  AuditReportSummary,
} from '../../auditsMethodApi';
import { EvidencePanel } from '../EvidencePanel';
import { FindingPanel, findingStatusLabel } from '../FindingPanel';
import { RemediationPanel } from '../RemediationPanel';
import { TeresaProposalCard } from '../TeresaProposalCard';
import {
  AUDIT_CHAIN_PHASES,
  type AuditChainPhaseId,
  buildChainLinks,
  groupLinksIntoPhases,
  REMEDIATION_LABELS_EN,
  REMEDIATION_LABELS_PL,
  REMEDIATION_LINK_IDS,
} from '../chainLinks';
import * as workspaceApi from '../workspaceApi';
import type {
  ConformityStatus,
  CriterionDetail,
  TestResult,
  WorkspaceCapability,
  WorkspaceDomainEvent,
  WorkspaceFindingDetail,
  WorkspaceProgramMember,
} from '../workspaceApi';

// ---------------------------------------------------------------------------
// Small local helpers
// ---------------------------------------------------------------------------

const CONFORMITY_TONE: Record<ConformityStatus, StatusTone> = {
  conforming: 'success',
  nonconforming: 'danger',
  observation: 'warning',
  opportunity_for_improvement: 'info',
  evidence_insufficient: 'warning',
  not_applicable: 'neutral',
  not_tested: 'neutral',
};

const CONFORMITY_LABEL_PL: Record<ConformityStatus, string> = {
  conforming: 'Zgodne',
  nonconforming: 'Niezgodność',
  observation: 'Obserwacja',
  opportunity_for_improvement: 'Szansa na usprawnienie',
  evidence_insufficient: 'Dowód niewystarczający',
  not_applicable: 'Nie dotyczy',
  not_tested: 'Nie przetestowane',
};
const CONFORMITY_LABEL_EN: Record<ConformityStatus, string> = {
  conforming: 'Conforming',
  nonconforming: 'Nonconformity',
  observation: 'Observation',
  opportunity_for_improvement: 'Opportunity for improvement',
  evidence_insufficient: 'Insufficient evidence',
  not_applicable: 'Not applicable',
  not_tested: 'Not tested',
};

const ROLE_LABEL_PL: Record<string, string> = {
  program_owner: 'właścicielem programu',
  lead_auditor: 'audytorem wiodącym',
  auditor: 'audytorem',
  technical_expert: 'ekspertem technicznym',
  auditee: 'stroną audytowaną',
  evidence_owner: 'właścicielem dowodu',
  reviewer: 'recenzentem',
  action_owner: 'właścicielem działania',
  administrator: 'administratorem',
  viewer: 'obserwatorem',
};
const ROLE_LABEL_EN: Record<string, string> = {
  program_owner: 'program owner',
  lead_auditor: 'lead auditor',
  auditor: 'auditor',
  technical_expert: 'technical expert',
  auditee: 'auditee',
  evidence_owner: 'evidence owner',
  reviewer: 'reviewer',
  action_owner: 'action owner',
  administrator: 'administrator',
  viewer: 'viewer',
};

// Odbiór 2026-08-26 (fix-pass po nadzorcy): „zero surowych enumów/ID na
// twarzy ekranu" — poniższe słowniki tłumaczą KAŻDĄ wartość enum z API, która
// trafia na widok, na pigułkę PL/EN. Jedno miejsce, jak lokalny `t(pl,en)`
// tego ekranu; wartości z API (TestResult/AuditCriterionSummary.workStatus/
// AuditReportStatus/AuditProposalStatus, wszystkie `workspaceApi.ts` /
// `auditsMethodApi.ts`) zostają BEZ ZMIAN, tylko warstwa wyświetlania.
// Nierozpoznana wartość pokazuje się wprost (fallback `?? value`) — nigdy
// nie znika po cichu.
const TEST_RESULT_LABEL_PL: Record<string, string> = {
  pass: 'Zaliczony',
  fail: 'Niezaliczony',
  partial: 'Częściowy',
  inconclusive: 'Nierozstrzygający',
};
const TEST_RESULT_LABEL_EN: Record<string, string> = {
  pass: 'Pass',
  fail: 'Fail',
  partial: 'Partial',
  inconclusive: 'Inconclusive',
};

const CRITERION_WORK_STATUS_LABEL_PL: Record<string, string> = {
  open: 'Otwarte',
  evidence_requested: 'Poproszono o dowód',
  evidence_received: 'Dowód dostarczony',
  tested: 'Przetestowane',
  concluded: 'Zakończone wnioskiem',
};
const CRITERION_WORK_STATUS_LABEL_EN: Record<string, string> = {
  open: 'Open',
  evidence_requested: 'Evidence requested',
  evidence_received: 'Evidence received',
  tested: 'Tested',
  concluded: 'Concluded',
};

const AUDIT_REPORT_STATUS_LABEL_PL: Record<string, string> = {
  draft: 'Szkic',
  in_review: 'W recenzji',
  approved: 'Zatwierdzony',
  published: 'Opublikowany',
  superseded: 'Zastąpiony',
};
const AUDIT_REPORT_STATUS_LABEL_EN: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  published: 'Published',
  superseded: 'Superseded',
};

const AUDIT_PROPOSAL_STATUS_LABEL_PL: Record<string, string> = {
  draft: 'Szkic',
  sent_to_candidates: 'Wysłano do kandydatów',
  registered: 'Zarejestrowana',
  deferred: 'Odłożona',
  dismissed: 'Odrzucona',
};
const AUDIT_PROPOSAL_STATUS_LABEL_EN: Record<string, string> = {
  draft: 'Draft',
  sent_to_candidates: 'Sent to candidates',
  registered: 'Registered',
  deferred: 'Deferred',
  dismissed: 'Dismissed',
};

function testResultLabel(value: string, isPolish: boolean): string {
  return (isPolish ? TEST_RESULT_LABEL_PL : TEST_RESULT_LABEL_EN)[value] ?? value;
}
function criterionWorkStatusLabel(value: string, isPolish: boolean): string {
  return (isPolish ? CRITERION_WORK_STATUS_LABEL_PL : CRITERION_WORK_STATUS_LABEL_EN)[value] ?? value;
}
function reportStatusLabel(value: string, isPolish: boolean): string {
  return (isPolish ? AUDIT_REPORT_STATUS_LABEL_PL : AUDIT_REPORT_STATUS_LABEL_EN)[value] ?? value;
}
function proposalStatusLabel(value: string, isPolish: boolean): string {
  return (isPolish ? AUDIT_PROPOSAL_STATUS_LABEL_PL : AUDIT_PROPOSAL_STATUS_LABEL_EN)[value] ?? value;
}

function formatDateTime(iso: string | null | undefined, isPolish: boolean): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(isPolish ? 'pl-PL' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface PrimaryAction {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}

// ---------------------------------------------------------------------------
// Presentational bits
// ---------------------------------------------------------------------------

const StepPill: React.FC<{ no: number; label: string; state: 'done' | 'current' | 'inactive'; reason?: string; onClick?: () => void }> = ({
  no,
  label,
  state,
  reason,
  onClick,
}) => {
  const cls =
    state === 'done'
      ? 'border-c-success/40 bg-c-success/10 text-c-success'
      : state === 'current'
        ? 'border-c-focus-solid bg-c-focus/10 text-c-focus-solid font-semibold ring-2 ring-c-focus/20'
        : 'border-dashed border-c-border text-c-text-muted bg-c-surface-raised';
  return (
    <button
      type="button"
      onClick={onClick}
      title={state === 'inactive' ? reason : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${cls}`}
    >
      {state === 'done' ? <Check size={11} aria-hidden /> : state === 'current' ? <Circle size={11} className="fill-current" aria-hidden /> : <Lock size={10} aria-hidden />}
      <span className="text-[9.5px] font-bold tabular-nums opacity-70">{no}</span>
      <span>{label}</span>
    </button>
  );
};

const PropRow: React.FC<{ k: string; v: React.ReactNode; sub?: React.ReactNode }> = ({ k, v, sub }) => (
  <div className="flex items-start gap-2.5 border-b border-c-border-subtle py-1.5 last:border-b-0">
    <span className="w-[104px] shrink-0 text-[11.5px] leading-snug text-c-text-muted">{k}</span>
    <span className="min-w-0 flex-1 text-xs font-medium leading-snug text-c-text">
      {v}
      {sub ? <span className="mt-0.5 block text-[10.5px] font-normal text-c-text-muted">{sub}</span> : null}
    </span>
  </div>
);

const RelationRow: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; onClick?: () => void }> = ({
  icon,
  title,
  subtitle,
  onClick,
}) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 border-b border-c-border-subtle py-2 text-left last:border-b-0 ${onClick ? 'hover:bg-c-surface-raised' : ''}`}
    >
      <span className="shrink-0 text-c-text-muted">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-c-text">{title}</span>
        <span className="block text-[10.5px] text-c-text-muted">{subtitle}</span>
      </span>
      {onClick && <ChevronRight size={13} className="shrink-0 text-c-text-muted" aria-hidden />}
    </Tag>
  );
};

const PhaseCard: React.FC<{
  phaseId: AuditChainPhaseId;
  ordinal: number;
  title: string;
  summary: string;
  state: 'done' | 'current' | 'locked';
  doneCount: number;
  totalCount: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  innerRef?: React.Ref<HTMLElement>;
}> = ({ phaseId, ordinal, title, summary, state, doneCount, totalCount, expanded, onToggle, children, innerRef }) => {
  const mark =
    state === 'done' ? (
      <Check size={14} aria-hidden />
    ) : state === 'current' ? (
      <Circle size={13} className="fill-current" aria-hidden />
    ) : (
      <Lock size={12} aria-hidden />
    );
  const markCls =
    state === 'done'
      ? 'border-c-success/40 bg-c-success/10 text-c-success'
      : state === 'current'
        ? 'border-c-focus-solid bg-c-focus/10 text-c-focus-solid'
        : 'border-dashed border-c-border-subtle bg-c-surface-raised text-c-text-muted';
  return (
    <section
      ref={innerRef}
      data-testid={`v2-phase-${phaseId}`}
      data-state={state}
      className={`overflow-hidden rounded-token-md border bg-c-surface shadow-token-card ${
        state === 'current' ? 'border-c-focus-solid/40 ring-1 ring-c-focus-solid/20' : 'border-c-border-subtle'
      } ${state === 'locked' ? 'bg-c-surface-raised' : ''}`}
    >
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-c-surface-raised">
        <span className={`grid size-7 shrink-0 place-items-center rounded-full border ${markCls}`}>{mark}</span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[13.5px] font-semibold tracking-tight ${state === 'locked' ? 'text-c-text-secondary' : 'text-c-text'}`}>
            Faza {ordinal} · {title}
          </span>
          <span className="mt-0.5 block text-[11.5px] leading-snug text-c-text-muted">{summary}</span>
        </span>
        <span
          className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${
            state === 'current' ? 'border-c-focus-solid/40 bg-c-focus/10 text-c-focus-solid' : 'border-c-border-subtle bg-c-surface-raised text-c-text-muted'
          }`}
        >
          {doneCount} / {totalCount}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-c-text-muted transition-transform ${expanded ? '' : '-rotate-90'}`} aria-hidden />
      </button>
      {expanded && <div className="space-y-4 border-t border-c-border-subtle px-4 pb-4 pt-3">{children}</div>}
    </section>
  );
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export const CriterionWorkspaceV2: React.FC = () => {
  const params = useParams<{ programId: string; criterionId: string }>();
  const programId = params.programId ?? '';
  const criterionId = params.criterionId ?? '';
  const navigate = useNavigate();

  const currentUser = useAppStore((s) => s.currentUser);
  const currentUserId = currentUser?.id ?? null;
  const currentOrganization = useAppStore((s) => s.currentOrganization);
  const isPolish = true; // ekran roboczy audytora — treść PO POLSKU (mandat CLAUDE.md), jak V1.
  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);

  // ---- criterion detail (identyczne z V1) ---------------------------------
  const [detail, setDetail] = useState<CriterionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const [allMembers, setAllMembers] = useState<WorkspaceProgramMember[]>([]);
  const [capabilities, setCapabilities] = useState<Set<WorkspaceCapability>>(new Set());
  const [rolesLoaded, setRolesLoaded] = useState(false);

  const [auditeeResponseDraft, setAuditeeResponseDraft] = useState('');
  const [procedurePerformed, setProcedurePerformed] = useState('');
  const [sampleDescription, setSampleDescription] = useState('');
  const [testPerformed, setTestPerformed] = useState('');
  const [testResult, setTestResult] = useState<TestResult | ''>('');
  const [auditorConclusion, setAuditorConclusion] = useState('');
  const [conformityChoice, setConformityChoice] = useState<ConformityStatus | ''>('');

  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [selectedFindingDetail, setSelectedFindingDetail] = useState<WorkspaceFindingDetail | null>(null);

  // ---- context nowy w V2: program, rodzeństwo kryteriów, raporty, wnioski, historia ----
  const [program, setProgram] = useState<AuditProgramDetail | null>(null);
  const [siblingCriteria, setSiblingCriteria] = useState<AuditCriterionSummary[]>([]);
  const [reports, setReports] = useState<AuditReportSummary[]>([]);
  const [proposals, setProposals] = useState<AuditProposalSummary[]>([]);
  const [history, setHistory] = useState<WorkspaceDomainEvent[]>([]);

  // ---- shell state: fazy rozwinięte, widoczność mapy, mini-formularze Akcji ----
  const [expandedPhases, setExpandedPhases] = useState<Set<AuditChainPhaseId> | null>(null);
  const [mapVisible, setMapVisible] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignAuditorId, setAssignAuditorId] = useState('');
  const [naOpen, setNaOpen] = useState(false);
  const [naReason, setNaReason] = useState('');

  const phaseRefs = useRef<Record<AuditChainPhaseId, HTMLElement | null>>({
    planowanie: null,
    badanie: null,
    ustalenia: null,
    naprawa: null,
  });

  const load = useCallback(() => {
    if (!criterionId) return;
    setLoading(true);
    setError(null);
    workspaceApi
      .getCriterion(criterionId)
      .then((res) => {
        if (!res) {
          setError(t('Kryterium audytu nie zostało znalezione', 'Audit criterion not found'));
          return;
        }
        setDetail(res);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t('Nie udało się wczytać kryterium', 'Could not load the criterion')))
      .finally(() => setLoading(false));
  }, [criterionId, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    workspaceApi
      .getProgramMembers(programId)
      .then((members) => {
        if (cancelled) return;
        setAllMembers(members);
        const myRoles = members.filter((m) => m.userId === currentUserId).map((m) => m.memberRole);
        setCapabilities(workspaceApi.capabilitiesForRoles(myRoles));
      })
      .catch(() => {
        if (!cancelled) {
          setAllMembers([]);
          setCapabilities(new Set());
        }
      })
      .finally(() => {
        if (!cancelled) setRolesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [programId, currentUserId]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    auditsMethodApi
      .getProgram(programId)
      .then((p) => {
        if (!cancelled) setProgram(p);
      })
      .catch(() => {
        if (!cancelled) setProgram(null);
      });
    auditsMethodApi
      .listProgramCriteria(programId)
      .then((items) => {
        if (!cancelled) setSiblingCriteria(items);
      })
      .catch(() => {
        if (!cancelled) setSiblingCriteria([]);
      });
    auditsMethodApi
      .listReports(programId)
      .then((res) => {
        if (!cancelled) setReports(res.items);
      })
      .catch(() => {
        if (!cancelled) setReports([]);
      });
    auditsMethodApi
      .listProposals(programId)
      .then((res) => {
        if (!cancelled) setProposals(res.items);
      })
      .catch(() => {
        if (!cancelled) setProposals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [programId]);

  const loadHistory = useCallback(() => {
    if (!criterionId) return;
    workspaceApi
      .getEntityHistory('criterion', criterionId)
      .then((events) => setHistory(events))
      .catch(() => setHistory([]));
  }, [criterionId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (detail?.criterion) {
      setAuditeeResponseDraft(detail.criterion.auditeeResponse ?? '');
      setProcedurePerformed(detail.criterion.procedurePerformed ?? '');
      setSampleDescription(detail.criterion.sampleDescription ?? '');
      setTestPerformed(detail.criterion.testPerformed ?? '');
      setTestResult(detail.criterion.testResult ?? '');
      setAuditorConclusion(detail.criterion.auditorConclusion ?? '');
    }
  }, [detail?.criterion]);

  const criterion = detail?.criterion ?? null;
  const hasAcceptedEvidence = useMemo(() => (detail?.evidence ?? []).some((e) => e.accepted === true), [detail?.evidence]);

  useEffect(() => {
    if (!criterion) return;
    if (conformityChoice) return;
    setConformityChoice(hasAcceptedEvidence ? 'nonconforming' : 'evidence_insufficient');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criterion?.id, hasAcceptedEvidence]);

  const isOwnAuditeeResponse = !!criterion && !!currentUserId && criterion.auditeeRespondedBy === currentUserId;

  const canRespondAsAuditee = capabilities.has('criterion.respond_as_auditee');
  const canPerformTest = capabilities.has('criterion.perform_test');
  const canConclude = capabilities.has('criterion.conclude');
  const canProposeAi = capabilities.has('ai.propose');
  const canCommitAi = capabilities.has('ai.commit');
  const canSubmitEvidence = capabilities.has('evidence.submit');
  const canReviewEvidence = capabilities.has('evidence.review');
  const canDraftFinding = capabilities.has('finding.draft');
  const canCloseFinding = capabilities.has('finding.close');
  const canProposeAction = capabilities.has('action.propose');
  const canApproveAction = capabilities.has('action.approve');
  const canReportImplementation = capabilities.has('action.report_implementation');
  const canVerify = capabilities.has('verification.perform');
  const canAssign = capabilities.has('criterion.assign');

  const myRoles = useMemo(
    () => allMembers.filter((m) => m.userId === currentUserId).map((m) => m.memberRole),
    [allMembers, currentUserId]
  );
  const memberById = useMemo(() => {
    const map = new Map<string, WorkspaceProgramMember>();
    for (const m of allMembers) map.set(m.userId, m);
    return map;
  }, [allMembers]);
  const nameFor = useCallback(
    (userId: string | null | undefined): string | null => {
      if (!userId) return null;
      if (userId === currentUserId) return t('Ty', 'You');
      return memberById.get(userId)?.name ?? null;
    },
    [memberById, currentUserId, t]
  );

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setSaveStatus('saving');
    try {
      await fn();
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, []);

  const handleSubmitAuditeeResponse = useCallback(() => {
    if (!criterionId || !auditeeResponseDraft.trim()) return;
    run(() =>
      workspaceApi
        .submitAuditeeResponse(criterionId, auditeeResponseDraft.trim())
        .then(() => {
          load();
          loadHistory();
        })
    );
  }, [criterionId, auditeeResponseDraft, run, load, loadHistory]);

  const handleRecordTest = useCallback(() => {
    if (!criterionId) return;
    run(() =>
      workspaceApi
        .recordTest(criterionId, {
          procedurePerformed: procedurePerformed.trim() || null,
          sampleDescription: sampleDescription.trim() || null,
          testPerformed: testPerformed.trim() || null,
          testResult: testResult || null,
        })
        .then(() => {
          load();
          loadHistory();
        })
    );
  }, [criterionId, procedurePerformed, sampleDescription, testPerformed, testResult, run, load, loadHistory]);

  const handleConclude = useCallback(() => {
    if (!criterionId || !conformityChoice) return;
    run(() =>
      workspaceApi
        .concludeCriterion(criterionId, { auditorConclusion: auditorConclusion.trim() || null, conformityStatus: conformityChoice })
        .then(() => {
          load();
          loadHistory();
        })
    );
  }, [criterionId, conformityChoice, auditorConclusion, run, load, loadHistory]);

  const handleAssign = useCallback(() => {
    if (!criterionId || !assignAuditorId) return;
    run(() =>
      workspaceApi
        .assignCriterion(criterionId, { auditorId: assignAuditorId })
        .then(() => {
          load();
          loadHistory();
          setAssignOpen(false);
        })
    );
  }, [criterionId, assignAuditorId, run, load, loadHistory]);

  const handleMarkNotApplicable = useCallback(() => {
    if (!criterionId || !naReason.trim()) return;
    run(() =>
      workspaceApi
        .updateApplicability(criterionId, { applicable: false, reason: naReason.trim() })
        .then(() => {
          load();
          loadHistory();
          setNaOpen(false);
          setNaReason('');
        })
    );
  }, [criterionId, naReason, run, load, loadHistory]);

  const chainLinks = useMemo(
    () =>
      buildChainLinks({
        criterion,
        findings: detail?.findings,
        hasAcceptedEvidence,
        selectedFindingId,
        selectedFindingDetail,
        isPolish,
        t,
      }),
    [criterion, detail?.findings, hasAcceptedEvidence, selectedFindingId, selectedFindingDetail, isPolish, t]
  );
  const phases = useMemo(() => groupLinksIntoPhases(chainLinks), [chainLinks]);
  const currentPhase = phases.find((p) => p.state === 'current') ?? null;
  const currentLink = chainLinks.find((l) => l.state === 'current') ?? null;

  // Domyślnie rozwinięta TYLKO bieżąca faza (DEC-88 wariant A pyt. 1) —
  // liczona raz, gdy dane wejściowe są gotowe; dalsze zmiany usera wygrywają.
  useEffect(() => {
    if (expandedPhases !== null || !criterion) return;
    const target = currentPhase?.id ?? phases[phases.length - 1]?.id;
    setExpandedPhases(new Set(target ? [target] : []));
  }, [criterion, currentPhase, phases, expandedPhases]);

  const togglePhase = useCallback((id: AuditChainPhaseId) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAllPhases = useCallback(() => {
    setExpandedPhases(new Set(AUDIT_CHAIN_PHASES.map((p) => p.id)));
  }, []);

  const scrollToPhase = useCallback(
    (id: AuditChainPhaseId) => {
      setExpandedPhases((prev) => new Set([...(prev ?? []), id]));
      requestAnimationFrame(() => {
        phaseRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    []
  );

  // ---- Menu 1 primary — akcja bieżącego ogniwa (DEC-88 wariant A pyt. 4) --
  const primaryAction: PrimaryAction = useMemo(() => {
    if (!currentLink) {
      return { label: t('Kryterium zamknięte', 'Criterion closed'), disabled: true };
    }
    const id = currentLink.id;
    if (id === 'dostarczony-dowod') {
      if (canSubmitEvidence) return { label: t('Prześlij dowód', 'Submit evidence'), onClick: () => scrollToPhase('badanie') };
      if (canReviewEvidence) return { label: t('Sprawdź dowód', 'Review evidence'), onClick: () => scrollToPhase('badanie') };
      return { label: t('Czeka na dowód audytowanego', "Waiting for the auditee's evidence"), disabled: true };
    }
    if (['procedura-audytora', 'proba', 'wykonany-test', 'wynik-testu'].includes(id)) {
      if (canPerformTest) {
        return {
          label: t('Zapisz procedurę i wynik testu', 'Save procedure and test result'),
          onClick: handleRecordTest,
          disabled: saveStatus === 'saving',
        };
      }
      return { label: t('Wymaga roli audytora', 'Requires the auditor role'), disabled: true };
    }
    if (id === 'wniosek-audytora' || id === 'status-zgodnosci') {
      if (isOwnAuditeeResponse) {
        return {
          label: t('Nie możesz sam wyciągnąć wniosku', 'You cannot conclude this yourself'),
          disabled: true,
          title: t(
            'Nie możesz wyciągnąć wniosku dla kryterium, na które sam odpowiadałeś jako strona audytowana.',
            'You cannot conclude a criterion you yourself answered as the auditee.'
          ),
        };
      }
      if (canConclude) {
        return { label: t('Wyciągnij wniosek', 'Conclude'), onClick: handleConclude, disabled: !conformityChoice || saveStatus === 'saving' };
      }
      return { label: t('Wymaga roli audytora', 'Requires the auditor role'), disabled: true };
    }
    if (id === 'ustalenie') {
      if (canDraftFinding) return { label: t('Utwórz ustalenie', 'Create a finding'), onClick: () => scrollToPhase('ustalenia') };
      return { label: t('Czeka na ustalenie audytora', "Waiting for the auditor's finding"), disabled: true };
    }
    if (id === 'odpowiedz-wlasciciela') {
      // BRAK_API: nie ma endpointu przypomnienia o odpowiedzi właściciela
      // obszaru (`finding.respond_as_management` wypełnia tylko sam
      // właściciel, wewnątrz FindingPanel) — uczciwy disabled zamiast atrapy.
      return {
        label: t('Poproś o odpowiedź (ponownie)', 'Request response (again)'),
        disabled: true,
        title: t('Planowane — brak API przypomnienia o odpowiedzi.', 'Planned — no reminder API yet.'),
      };
    }
    if (id === 'zamkniecie') {
      if (canCloseFinding) return { label: t('Zamknij ustalenie', 'Close the finding'), onClick: () => scrollToPhase('naprawa') };
      return { label: t('Zamknięcie wymaga roli lead/reviewer', 'Closing requires the lead/reviewer role'), disabled: true };
    }
    // korekcja / przyczyna-zrodlowa / dzialanie-korygujace / wlasciciel-termin / weryfikacja-skutecznosci
    const remediationLabel = isPolish
      ? REMEDIATION_LABELS_PL[id as (typeof REMEDIATION_LINK_IDS)[number]]
      : REMEDIATION_LABELS_EN[id as (typeof REMEDIATION_LINK_IDS)[number]];
    const anyRemediationCap = canProposeAction || canApproveAction || canReportImplementation || canVerify;
    if (anyRemediationCap) {
      return { label: t(`Przejdź do: ${remediationLabel}`, `Go to: ${remediationLabel}`), onClick: () => scrollToPhase('naprawa') };
    }
    return { label: t(`${remediationLabel} — czeka na uprawnioną osobę`, `${remediationLabel} — waiting on an authorized person`), disabled: true };
  }, [
    currentLink,
    canSubmitEvidence,
    canReviewEvidence,
    canPerformTest,
    handleRecordTest,
    saveStatus,
    isOwnAuditeeResponse,
    canConclude,
    handleConclude,
    conformityChoice,
    canDraftFinding,
    canCloseFinding,
    canProposeAction,
    canApproveAction,
    canReportImplementation,
    canVerify,
    isPolish,
    t,
    scrollToPhase,
  ]);

  const handleCopyLink = useCallback(() => {
    try {
      void navigator.clipboard.writeText(window.location.href);
    } catch {
      /* clipboard może być niedostępny w niektórych kontekstach — cichy no-op */
    }
  }, []);

  const [kebabOpen, setKebabOpen] = useState(false);

  if (loading) {
    return <LoadingState template="panel" label={t('Wczytywanie kryterium…', 'Loading criterion…')} />;
  }
  if (error || !criterion) {
    return (
      <ErrorState
        title={t('Nie udało się wczytać kryterium', 'Could not load the criterion')}
        description={error || t('Kryterium nie istnieje.', 'The criterion does not exist.')}
        onRetry={load}
      />
    );
  }

  const conformityTone = CONFORMITY_TONE[criterion.conformityStatus] ?? 'neutral';
  const conformityLabel = (isPolish ? CONFORMITY_LABEL_PL : CONFORMITY_LABEL_EN)[criterion.conformityStatus] ?? criterion.conformityStatus;

  const leadAuditorId = allMembers.find((m) => m.memberRole === 'lead_auditor')?.userId ?? null;
  const auditorName = nameFor(criterion.assignedAuditorId);
  const leadAuditorName = nameFor(leadAuditorId);
  const auditeeName = nameFor(criterion.assignedAuditeeId);

  // ---- Relacje (Powiązania) — WYŁĄCZNIE dane z realnych API ----------------
  const siblingCriterion = siblingCriteria.find((c) => c.id !== criterion.id && c.workStatus !== 'concluded') ?? null;
  const relatedProposal = selectedFindingDetail
    ? proposals.find((p) => p.sourceFindingIds.includes(selectedFindingDetail.id)) ?? null
    : null;
  const latestReport = reports[0] ?? null;

  // ---- Historia — real trail events → ActivityEvent, autor rozwiązany z program members ----
  const activityEvents: ActivityEvent[] = history
    .slice()
    .reverse()
    .map((ev) => ({
      id: ev.id,
      description: ev.summary || ev.eventType,
      timestamp: ev.occurredAt,
      userName: ev.actorId ? nameFor(ev.actorId) ?? t('Członek zespołu', 'Team member') : undefined,
    }));

  // ---- Prawy panel (ArtifactRightPanel, ARTIFACT_PANEL_SECTION_ORDER) -----
  const rightPanelSections: ArtifactRightPanelSection[] = [
    {
      id: 'actions',
      label: t('Akcje', 'Actions'),
      defaultOpen: true,
      children: (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex h-8 items-center gap-1.5 rounded-token-sm border border-c-border px-2.5 text-[11.5px] font-medium text-c-text-secondary hover:border-c-border-strong hover:text-c-text"
            >
              <Link2 size={12} aria-hidden />
              {t('Kopiuj link', 'Copy link')}
            </button>
            {canAssign && (
              <button
                type="button"
                onClick={() => setAssignOpen((v) => !v)}
                className="inline-flex h-8 items-center gap-1.5 rounded-token-sm border border-c-border px-2.5 text-[11.5px] font-medium text-c-text-secondary hover:border-c-border-strong hover:text-c-text"
              >
                <UserCog size={12} aria-hidden />
                {t('Przekaż innemu audytorowi', 'Reassign to another auditor')}
              </button>
            )}
            {canAssign && criterion.applicable && (
              <button
                type="button"
                onClick={() => setNaOpen((v) => !v)}
                className="inline-flex h-8 items-center gap-1.5 rounded-token-sm border border-c-border px-2.5 text-[11.5px] font-medium text-c-text-secondary hover:border-c-border-strong hover:text-c-text"
              >
                <AlertCircle size={12} aria-hidden />
                {t('Oznacz „nie dotyczy"', 'Mark as not applicable')}
              </button>
            )}
          </div>
          {assignOpen && canAssign && (
            <div className="space-y-1.5 rounded-token-sm border border-c-border-subtle p-2">
              <select
                value={assignAuditorId}
                onChange={(e) => setAssignAuditorId(e.target.value)}
                aria-label={t('Nowy audytor', 'New auditor')}
                className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text"
              >
                <option value="">{t('Wybierz audytora…', 'Choose an auditor…')}</option>
                {allMembers
                  .filter((m) => m.memberRole === 'auditor' || m.memberRole === 'lead_auditor')
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name || m.userId}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleAssign}
                disabled={!assignAuditorId || saveStatus === 'saving'}
                className="w-full rounded-token-sm border border-c-border bg-c-surface-raised px-2 py-1.5 text-xs font-medium text-c-text disabled:opacity-50"
              >
                {t('Zapisz', 'Save')}
              </button>
            </div>
          )}
          {naOpen && canAssign && (
            <div className="space-y-1.5 rounded-token-sm border border-c-border-subtle p-2">
              <textarea
                value={naReason}
                onChange={(e) => setNaReason(e.target.value)}
                placeholder={t('Powód (wymagany)', 'Reason (required)')}
                aria-label={t('Powód oznaczenia „nie dotyczy"', 'Reason for "not applicable"')}
                className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text"
                rows={2}
              />
              <button
                type="button"
                onClick={handleMarkNotApplicable}
                disabled={!naReason.trim() || saveStatus === 'saving'}
                className="w-full rounded-token-sm border border-c-border bg-c-surface-raised px-2 py-1.5 text-xs font-medium text-c-text disabled:opacity-50"
              >
                {t('Potwierdź', 'Confirm')}
              </button>
            </div>
          )}
          <p className="text-[11px] leading-snug text-c-text-muted">
            {t(
              'Karta kryterium (PDF) — planowane, brak API eksportu pojedynczego kryterium.',
              'Criterion card (PDF) — planned, no single-criterion export API yet.'
            )}
          </p>
        </div>
      ),
    },
    {
      id: 'properties',
      label: t('Właściwości', 'Properties'),
      defaultOpen: true,
      children: (
        <div className="space-y-3">
          <div className="rounded-token-sm border border-c-border-subtle bg-c-surface-raised p-2.5">
            <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-c-text-muted">
              {t('Rola i uprawnienia', 'Role and permissions')}
            </p>
            <p className="mb-1.5 text-[11.5px] text-c-text-secondary">
              {myRoles.length > 0
                ? t(
                    `Jesteś ${myRoles.map((r) => (isPolish ? ROLE_LABEL_PL[r] : ROLE_LABEL_EN[r]) ?? r).join(' i ')} tego programu.`,
                    `You are the ${myRoles.map((r) => ROLE_LABEL_EN[r] ?? r).join(' and ')} of this program.`
                  )
                : t('Nie jesteś członkiem tego programu audytowego.', 'You are not a member of this audit program.')}
            </p>
            <div className="space-y-1">
              {canPerformTest && (
                <p className="flex gap-1.5 text-[11px] text-c-success">
                  <CheckCircle2 size={12} className="mt-0.5 shrink-0" aria-hidden />
                  {t('możesz oceniać dowody, wykonać test, wyciągnąć wniosek', 'you can assess evidence, perform the test, conclude')}
                </p>
              )}
              {canDraftFinding && (
                <p className="flex gap-1.5 text-[11px] text-c-success">
                  <CheckCircle2 size={12} className="mt-0.5 shrink-0" aria-hidden />
                  {t('możesz tworzyć ustalenia', 'you can create findings')}
                </p>
              )}
              {canCloseFinding && (
                <p className="flex gap-1.5 text-[11px] text-c-success">
                  <CheckCircle2 size={12} className="mt-0.5 shrink-0" aria-hidden />
                  {t('możesz potwierdzać i zamykać ustalenia', 'you can confirm and close findings')}
                </p>
              )}
              {canRespondAsAuditee && (
                <p className="flex gap-1.5 text-[11px] text-c-success">
                  <CheckCircle2 size={12} className="mt-0.5 shrink-0" aria-hidden />
                  {t('możesz odpowiadać jako strona audytowana', 'you can respond as the auditee')}
                </p>
              )}
              <p className="flex gap-1.5 text-[11px] text-c-text-muted">
                <Lock size={12} className="mt-0.5 shrink-0" aria-hidden />
                {t('nie możesz odpowiadać w imieniu strony audytowanej', 'you cannot respond on behalf of the auditee')}
              </p>
              <p className="flex gap-1.5 text-[11px] text-c-text-muted">
                <Lock size={12} className="mt-0.5 shrink-0" aria-hidden />
                {t(
                  'nie możesz zweryfikować skuteczności własnego działania korygującego',
                  'you cannot verify the effectiveness of your own corrective action'
                )}
              </p>
            </div>
          </div>

          <PropRow
            k={t('Program', 'Program')}
            v={program?.name ?? t('Wczytywanie…', 'Loading…')}
            sub={program ? t(`${program.applicableCriteria} kryteriów · ${program.concludedCriteria} zamkniętych`, `${program.applicableCriteria} criteria · ${program.concludedCriteria} concluded`) : undefined}
          />
          <PropRow k={t('Organizacja', 'Organization')} v={currentOrganization?.name ?? '—'} />
          <PropRow k={t('Źródło wymagania', 'Requirement source')} v={criterion.sourceReference || t('Nie podano', 'Not provided')} />
          <PropRow
            k={t('Kryterium dotyczy', 'Applicable')}
            v={criterion.applicable ? t('Tak', 'Yes') : t('Nie', 'No')}
            sub={!criterion.applicable && criterion.notApplicableReason ? criterion.notApplicableReason : undefined}
          />
          <PropRow k={t('Audytor wiodący', 'Lead auditor')} v={leadAuditorName || t('Nieprzypisany', 'Unassigned')} />
          <PropRow k={t('Audytor', 'Auditor')} v={auditorName || t('Nieprzypisany', 'Unassigned')} />
          <PropRow k={t('Strona audytowana', 'Auditee')} v={auditeeName || t('Nieprzypisana', 'Unassigned')} />
          <PropRow k={t('Status zgodności', 'Conformity status')} v={<StatusChip label={conformityLabel} tone={conformityTone} />} />
          <PropRow
            k={t('Wynik testu', 'Test result')}
            v={criterion.testResult ? testResultLabel(criterion.testResult, isPolish) : t('Brak', 'None')}
            sub={criterion.sampleDescription || undefined}
          />
          <PropRow k={t('Ostatnia zmiana', 'Last change')} v={formatDateTime(criterion.updatedAt, isPolish)} />
        </div>
      ),
    },
    {
      id: 'relations',
      label: t('Powiązania', 'Relations'),
      defaultOpen: false,
      badge: (selectedFindingDetail ? 1 : 0) + (siblingCriterion ? 1 : 0) + (latestReport ? 1 : 0) + (relatedProposal ? 1 : 0),
      isEmpty: !selectedFindingDetail && !siblingCriterion && !latestReport && !relatedProposal,
      emptyLabel: t('Brak powiązań na tym etapie.', 'No relations at this stage yet.'),
      children: (
        <div>
          {selectedFindingDetail && (
            <RelationRow
              icon={<AlertCircle size={13} aria-hidden />}
              title={`${selectedFindingDetail.referenceCode ?? ''} · ${selectedFindingDetail.statement}`.slice(0, 72)}
              subtitle={t(
                `ustalenie · ${findingStatusLabel(selectedFindingDetail.status, true)}`,
                `finding · ${findingStatusLabel(selectedFindingDetail.status, false)}`
              )}
              onClick={() => scrollToPhase('ustalenia')}
            />
          )}
          {siblingCriterion && (
            <RelationRow
              icon={<ScrollText size={13} aria-hidden />}
              title={`${siblingCriterion.refCode ?? ''} · ${siblingCriterion.title}`}
              subtitle={t(
                `kryterium siostrzane · ${criterionWorkStatusLabel(siblingCriterion.workStatus, true)}`,
                `sibling criterion · ${criterionWorkStatusLabel(siblingCriterion.workStatus, false)}`
              )}
              onClick={() => navigate(`/audit-programs/${programId}/criteria/${siblingCriterion.id}`)}
            />
          )}
          {latestReport && (
            <RelationRow
              icon={<FileText size={13} aria-hidden />}
              title={latestReport.title}
              subtitle={t(
                `dokument · ${reportStatusLabel(latestReport.status, true)}`,
                `document · ${reportStatusLabel(latestReport.status, false)}`
              )}
              onClick={() => navigate('/audit-programs?tab=reports')}
            />
          )}
          {relatedProposal && (
            <RelationRow
              icon={<ClipboardCheck size={13} aria-hidden />}
              title={relatedProposal.title}
              subtitle={t(
                `inicjatywa naprawcza · ${proposalStatusLabel(relatedProposal.status, true)}`,
                `remediation initiative · ${proposalStatusLabel(relatedProposal.status, false)}`
              )}
              onClick={() => navigate('/audit-programs?tab=initiatives')}
            />
          )}
          {selectedFindingDetail && !relatedProposal && (
            <p className="pt-2 text-[10.5px] leading-snug text-c-text-muted">
              {t(
                'Inicjatywa naprawcza — powstanie z działania korygującego (faza 4).',
                'Remediation initiative — will be created from a corrective action (phase 4).'
              )}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'evidence',
      label: t('Źródła i założenia', 'Sources and assumptions'),
      defaultOpen: false,
      badge: criterion.expectedEvidence.length + (criterion.sourceReference ? 1 : 0),
      isEmpty: criterion.expectedEvidence.length === 0 && !criterion.sourceReference,
      emptyLabel: t('Pakiet nie zdefiniował źródeł ani oczekiwanych dowodów.', 'The pack defines no sources or expected evidence.'),
      children: (
        <div className="space-y-1.5">
          {criterion.sourceReference && (
            <div className="rounded-token-sm border border-c-border-subtle p-2">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-c-text-muted">{t('Źródło', 'Source')}</p>
              <p className="text-xs text-c-text">{criterion.sourceReference}</p>
            </div>
          )}
          {criterion.expectedEvidence.map((e, i) => (
            <div key={i} className="rounded-token-sm border border-c-border-subtle p-2">
              <p className="text-xs text-c-text">{e.description}</p>
              <p className="text-[10.5px] text-c-text-muted">{e.mandatory ? t('wymagany', 'required') : t('opcjonalny', 'optional')}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'comments',
      label: t('Komentarze', 'Comments'),
      defaultOpen: false,
      isEmpty: true,
      emptyLabel: t('Planowane — brak API komentarzy dla kryteriów audytu.', 'Planned — no comments API for audit criteria yet.'),
      children: null,
    },
    {
      id: 'history',
      label: t('Historia', 'History'),
      defaultOpen: false,
      badge: history.length,
      isEmpty: activityEvents.length === 0,
      emptyLabel: t('Brak zdarzeń dla tego kryterium.', 'No events for this criterion yet.'),
      children: (
        <div>
          <PreviewActivityStrip
            events={activityEvents}
            initialCount={4}
            formatTimestamp={(ts) => formatDateTime(ts, isPolish)}
          />
          {canProposeAi && (
            <div className="mt-2 rounded-token-sm border border-c-focus-solid/30 bg-c-focus/5 p-2">
              <p className="text-[11px] leading-snug text-c-text-secondary">
                <Sparkles size={11} className="mr-1 inline text-c-focus-solid" aria-hidden />
                <span className="font-semibold text-c-text">{t('Teresa — asystent metodyczny.', 'Teresa — methodology assistant.')}</span>{' '}
                {t(
                  'Może wyjaśnić kryterium i zaproponować redakcję ustalenia, zawsze ze źródłami. Nigdy nie zapisuje niczego bez decyzji człowieka.',
                  'Can explain the criterion and draft a finding, always with sources. Never saves anything without a human decision.'
                )}
              </p>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div data-testid="criterion-workspace-v2" className="flex h-full min-h-0 flex-col">
      {/* ===== Menu 1 — tożsamość artefaktu ===== */}
      <div className="flex h-[60px] shrink-0 items-center gap-2.5 border-b border-c-border-subtle bg-c-surface px-4">
        <button
          type="button"
          onClick={() => (programId ? navigate(`/audit-programs?programId=${encodeURIComponent(programId)}`) : navigate(-1))}
          aria-label={t('Wróć do programu audytu', 'Back to the audit program')}
          className="grid size-8 shrink-0 place-items-center rounded-token-sm text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text"
        >
          <ArrowLeft size={17} aria-hidden />
        </button>
        <span className="h-6 w-px shrink-0 bg-c-border-subtle" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] text-c-text-muted">
            <button type="button" onClick={() => navigate('/audit-programs')} className="hover:text-c-text hover:underline">
              {t('Audyty', 'Audits')}
            </button>
            <span className="opacity-50">›</span>
            <button
              type="button"
              onClick={() => programId && navigate(`/audit-programs?programId=${encodeURIComponent(programId)}`)}
              className="max-w-[220px] truncate hover:text-c-text hover:underline"
            >
              {program?.name ?? t('Program…', 'Program…')}
            </button>
            <span className="opacity-50">›</span>
            <span>{t('Kryteria', 'Criteria')}</span>
            <span className="opacity-50">›</span>
            <span className="font-medium text-c-text-secondary">{criterion.refCode ?? criterion.id}</span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            {criterion.refCode && <span className="shrink-0 font-mono text-[11.5px] font-semibold text-c-text-secondary">{criterion.refCode}</span>}
            <h1 className="min-w-0 truncate text-sm font-semibold tracking-tight text-c-text">{criterion.title}</h1>
            <StatusChip label={conformityLabel} tone={conformityTone} />
            <span className="hidden shrink-0 text-xs text-c-text-muted sm:inline">
              <SaveStateIndicator status={saveStatus} />
            </span>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {canProposeAi && (
            <button
              type="button"
              onClick={() => scrollToPhase('planowanie')}
              className="inline-flex h-8 items-center gap-1.5 rounded-token-sm border border-c-border px-2.5 text-[11.5px] font-medium text-c-text-secondary hover:border-c-border-strong hover:text-c-text"
            >
              <Sparkles size={13} aria-hidden />
              {t('Teresa', 'Teresa')}
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setKebabOpen((v) => !v)}
              aria-label={t('Więcej akcji', 'More actions')}
              aria-expanded={kebabOpen}
              className="grid size-8 place-items-center rounded-token-sm text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text"
            >
              <MoreVertical size={17} aria-hidden />
            </button>
            {kebabOpen && (
              <div className="absolute right-0 top-9 z-10 w-56 rounded-token-md border border-c-border-subtle bg-c-surface py-1 shadow-token-pop">
                <button
                  type="button"
                  onClick={() => {
                    handleCopyLink();
                    setKebabOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-c-text hover:bg-c-surface-raised"
                >
                  <Link2 size={13} aria-hidden />
                  {t('Kopiuj link', 'Copy link')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      void navigator.clipboard.writeText(criterion.refCode || criterion.id);
                    } catch {
                      /* no-op */
                    }
                    setKebabOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-c-text hover:bg-c-surface-raised"
                >
                  <Copy size={13} aria-hidden />
                  {t('Kopiuj kod obiektu', 'Copy object code')}
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            title={primaryAction.title}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-token-lg border border-c-cta-bg bg-c-cta-bg px-3.5 text-xs font-semibold text-c-cta-text disabled:cursor-not-allowed disabled:opacity-45"
          >
            {primaryAction.label}
          </button>
        </div>
      </div>

      {/* ===== Menu 3 — 4 fazy jako nawigacja wewnętrzna ===== */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-c-border-subtle bg-c-bg px-4">
        <span className="mr-0.5 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">{t('Faza audytu', 'Audit phase')}</span>
        <div role="group" aria-label={t('Fazy audytu kryterium', 'Criterion audit phases')} className="inline-flex items-center gap-1 rounded-full border border-c-border-subtle bg-c-surface-raised p-1">
          {phases.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.state === 'current'}
              onClick={() => scrollToPhase(p.id)}
              className={`inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs ${
                p.state === 'current' ? 'bg-c-surface font-semibold text-c-text shadow-token-card' : 'text-c-text-secondary'
              }`}
            >
              {p.ordinal} · {isPolish ? p.labelPl : p.labelEn}
              <span
                className={`inline-flex h-4 items-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                  p.state === 'done'
                    ? 'bg-c-success/10 text-c-success'
                    : p.state === 'current'
                      ? 'bg-c-focus/10 text-c-focus-solid'
                      : 'bg-c-border-subtle text-c-text-muted'
                }`}
              >
                {p.doneCount}/{p.totalCount}
              </span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-pressed={mapVisible}
            onClick={() => setMapVisible((v) => !v)}
            className={`inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs ${
              mapVisible ? 'border-c-active-border bg-c-active-bg font-semibold text-c-active-text' : 'border-c-border text-c-text-secondary'
            }`}
          >
            {t('Mapa 18 ogniw', '18-link map')}
          </button>
          <button
            type="button"
            onClick={expandAllPhases}
            className="inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full border border-c-border px-2.5 text-xs text-c-text-secondary hover:text-c-text"
          >
            {t('Pokaż wszystkie fazy', 'Show all phases')}
          </button>
        </div>
      </div>

      {/* ===== Scena ===== */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          {!rolesLoaded && <p className="text-xs text-c-text-muted">{t('Wczytywanie uprawnień…', 'Loading permissions…')}</p>}

          {/* Nagłówek celu ekranu */}
          <section className="flex gap-3 rounded-token-md border border-c-border-subtle bg-c-surface p-3.5 shadow-token-card">
            <span className="grid size-8 shrink-0 place-items-center rounded-token-sm bg-c-focus/10 text-c-focus-solid">
              <ScrollText size={17} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-[14.5px] font-semibold tracking-tight text-c-text">
                {t('Warsztat kryterium — tu wykonujesz audyt jednego wymagania', 'Criterion workspace — you audit one requirement here')}
              </h2>
              <p className="mt-0.5 max-w-[82ch] text-[12.5px] leading-relaxed text-c-text-secondary">
                {t(
                  'Prowadzisz to jedno wymaganie przez cały łańcuch metodyki audytu: dowód → test → wniosek → ustalenie → naprawa. To arkusz roboczy audytora, nie ankieta ani podgląd.',
                  'You take this one requirement through the full audit chain: evidence → test → conclusion → finding → remediation. This is the auditor’s working sheet, not a survey or a preview.'
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {myRoles[0] && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-c-focus-solid/30 bg-c-focus/10 px-2 py-0.5 text-[10.5px] font-semibold text-c-focus-solid">
                    <Users size={11} aria-hidden />
                    {t(`Twoja rola: ${(isPolish ? ROLE_LABEL_PL : ROLE_LABEL_EN)[myRoles[0]] ?? myRoles[0]}`, `Your role: ${ROLE_LABEL_EN[myRoles[0]] ?? myRoles[0]}`)}
                  </span>
                )}
                {criterion.sourceReference && (
                  <span className="rounded-full border border-c-border-subtle px-2 py-0.5 text-[10.5px] text-c-text-secondary">{criterion.sourceReference}</span>
                )}
                {currentOrganization?.name && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-c-border-subtle px-2 py-0.5 text-[10.5px] text-c-text-secondary">
                    <Building2 size={11} aria-hidden />
                    {currentOrganization.name}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Mapa 18 ogniw w 4 fazach */}
          {mapVisible && (
            <section aria-label={t('Mapa łańcucha audytu', 'Audit chain map')} className="rounded-token-md border border-c-border-subtle bg-c-surface shadow-token-card">
              <header className="flex flex-wrap items-center gap-2.5 border-b border-c-border-subtle px-4 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                  {t('Łańcuch audytu · 18 ogniw w 4 fazach', 'Audit chain · 18 links in 4 phases')}
                </span>
              </header>
              <div className="space-y-2.5 px-4 py-3">
                {phases.map((p) => (
                  <div key={p.id} className="flex flex-col gap-2 border-b border-c-border-subtle pb-2.5 last:border-b-0 last:pb-0 sm:flex-row sm:items-start">
                    <span className="w-[150px] shrink-0">
                      <span className={`block text-[9.5px] font-bold uppercase tracking-wider ${p.state === 'current' ? 'text-c-focus-solid' : 'text-c-text-muted'}`}>
                        {t(`Faza ${p.ordinal}`, `Phase ${p.ordinal}`)}
                        {p.state === 'current' ? ` · ${t('teraz', 'now')}` : ''}
                      </span>
                      <span className="block text-xs font-semibold text-c-text">{isPolish ? p.labelPl : p.labelEn}</span>
                      <span className="block text-[10.5px] tabular-nums text-c-text-muted">
                        {t(`ogniwa ${p.range[0] + 1}–${p.range[1]} · ${p.doneCount} z ${p.totalCount}`, `links ${p.range[0] + 1}–${p.range[1]} · ${p.doneCount} of ${p.totalCount}`)}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      {p.links.map((link, i) => (
                        <React.Fragment key={link.id}>
                          <StepPill
                            no={p.range[0] + i + 1}
                            label={link.label}
                            state={link.state}
                            reason={link.reason}
                            onClick={() => scrollToPhase(p.id)}
                          />
                        </React.Fragment>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===== 4 karty faz ===== */}
          {phases.map((p) => {
            const expanded = expandedPhases?.has(p.id) ?? p.state === 'current';
            return (
              <PhaseCard
                key={p.id}
                innerRef={(el) => {
                  phaseRefs.current[p.id] = el;
                }}
                phaseId={p.id}
                ordinal={p.ordinal}
                title={isPolish ? p.labelPl : p.labelEn}
                summary={isPolish ? p.descriptionPl : p.descriptionEn}
                state={p.state}
                doneCount={p.doneCount}
                totalCount={p.totalCount}
                expanded={expanded}
                onToggle={() => togglePhase(p.id)}
              >
                {p.id === 'planowanie' && (
                  <>
                    <div>
                      <h4 className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-c-text-muted">{t('Kryterium / źródło', 'Criterion / source')}</h4>
                      <p className="text-[13px] leading-relaxed text-c-text">
                        {criterion.requirementText || t('Brak sformułowanego wymagania.', 'No requirement text yet.')}
                      </p>
                      {criterion.sourceReference && <p className="mt-0.5 text-[11px] text-c-text-muted">{criterion.sourceReference}</p>}
                    </div>
                    <div>
                      <h4 className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-c-text-muted">{t('Pytanie audytowe', 'Audit question')}</h4>
                      <p className="text-[13px] leading-relaxed text-c-text">
                        {criterion.auditQuestion || t('Brak zdefiniowanego pytania audytowego.', 'No audit question defined.')}
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-c-text-muted">{t('Oczekiwany dowód', 'Expected evidence')}</h4>
                      {criterion.expectedEvidence.length === 0 ? (
                        <p className="text-[13px] text-c-text-muted">{t('Pakiet nie zdefiniował oczekiwanego dowodu.', 'The pack defines no expected evidence.')}</p>
                      ) : (
                        <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-c-text">
                          {criterion.expectedEvidence.map((e, i) => (
                            <li key={i}>
                              {e.description} {e.mandatory ? <span className="text-c-text-muted">({t('wymagany', 'required')})</span> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}

                {p.id === 'badanie' && (
                  <>
                    <div>
                      <h4 className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-c-text-muted">{t('Dostarczony dowód', 'Provided evidence')}</h4>
                      <EvidencePanel programId={programId} criterionId={criterionId} capabilities={capabilities} isPolish={isPolish} onEvidenceChanged={load} maxRows={3} />
                    </div>
                    {!criterion.applicable ? (
                      <p className="flex items-center gap-2 rounded-token-md border border-c-border-subtle p-3 text-xs text-c-text-muted">
                        <AlertCircle size={14} aria-hidden />
                        {t('Kryterium oznaczone jako „nie dotyczy" — próba i test są nieosiągalne.', 'Criterion marked "not applicable" — sampling and testing are unreachable.')}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <h4 className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-c-text-muted">{t('Procedura audytora', "Auditor's procedure")}</h4>
                          <textarea
                            value={procedurePerformed}
                            onChange={(e) => setProcedurePerformed(e.target.value)}
                            disabled={!canPerformTest}
                            aria-label={t('Procedura audytora', "Auditor's procedure")}
                            className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text disabled:opacity-60"
                            rows={2}
                          />
                        </div>
                        <div>
                          <h4 className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-c-text-muted">{t('Próba', 'Sample')}</h4>
                          <textarea
                            value={sampleDescription}
                            onChange={(e) => setSampleDescription(e.target.value)}
                            disabled={!canPerformTest}
                            aria-label={t('Próba', 'Sample')}
                            className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text disabled:opacity-60"
                            rows={2}
                          />
                        </div>
                        <div>
                          <h4 className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-c-text-muted">{t('Wykonany test', 'Test performed')}</h4>
                          <textarea
                            value={testPerformed}
                            onChange={(e) => setTestPerformed(e.target.value)}
                            disabled={!canPerformTest}
                            aria-label={t('Wykonany test', 'Test performed')}
                            className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text disabled:opacity-60"
                            rows={2}
                          />
                        </div>
                        <div>
                          <h4 className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-c-text-muted">{t('Wynik testu', 'Test result')}</h4>
                          <select
                            value={testResult}
                            onChange={(e) => setTestResult(e.target.value as TestResult)}
                            disabled={!canPerformTest}
                            aria-label={t('Wynik testu', 'Test result')}
                            className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text disabled:opacity-60"
                          >
                            <option value="">—</option>
                            <option value="pass">{testResultLabel('pass', isPolish)}</option>
                            <option value="fail">{testResultLabel('fail', isPolish)}</option>
                            <option value="partial">{testResultLabel('partial', isPolish)}</option>
                            <option value="inconclusive">{testResultLabel('inconclusive', isPolish)}</option>
                          </select>
                          {canPerformTest ? (
                            <button
                              type="button"
                              onClick={handleRecordTest}
                              disabled={saveStatus === 'saving'}
                              className="mt-1.5 rounded-token-md border border-c-border bg-c-surface px-3 py-1.5 text-xs font-medium text-c-text hover:bg-c-surface-raised"
                            >
                              {t('Zapisz procedurę i wynik testu', 'Save procedure and test result')}
                            </button>
                          ) : (
                            <p className="mt-1.5 text-xs text-c-text-muted">{t('Wykonanie testu wymaga roli audytora.', 'Performing the test requires the auditor role.')}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {p.id === 'ustalenia' && (
                  <>
                    <div>
                      <h4 className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-c-text-muted">{t('Wniosek audytora', "Auditor's conclusion")}</h4>
                      {!criterion.testResult ? (
                        <p className="text-xs text-c-text-muted">{t('Nieosiągalne: wymaga wcześniej wykonanej procedury testowej.', 'Unreachable: requires a recorded test result first.')}</p>
                      ) : (
                        <textarea
                          value={auditorConclusion}
                          onChange={(e) => setAuditorConclusion(e.target.value)}
                          disabled={!canConclude}
                          aria-label={t('Wniosek audytora', "Auditor's conclusion")}
                          className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text disabled:opacity-60"
                          rows={3}
                        />
                      )}
                    </div>

                    <div>
                      <h4 className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-c-text-muted">{t('Status zgodności', 'Conformity status')}</h4>
                      {!criterion.testResult ? (
                        <p className="text-xs text-c-text-muted">{t('Nieosiągalne: wymaga wcześniej wykonanej procedury testowej.', 'Unreachable: requires a recorded test result first.')}</p>
                      ) : isOwnAuditeeResponse ? (
                        <p className="text-xs text-c-text-muted">
                          {t('Nie możesz wyciągnąć wniosku dla kryterium, na które sam odpowiadałeś jako strona audytowana.', 'You cannot conclude a criterion you yourself answered as the auditee.')}
                        </p>
                      ) : !canConclude ? (
                        <p className="text-xs text-c-text-muted">{t('Wyciągnięcie wniosku wymaga roli audytora/lead auditora.', 'Concluding requires the auditor/lead auditor role.')}</p>
                      ) : (
                        <>
                          <select
                            value={conformityChoice}
                            onChange={(e) => setConformityChoice(e.target.value as ConformityStatus)}
                            aria-label={t('Status zgodności', 'Conformity status')}
                            className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
                          >
                            {workspaceApi.CONFORMITY_STATUSES.filter((s) => s !== 'not_tested').map((s) => (
                              <option key={s} value={s} disabled={s === 'conforming' && !hasAcceptedEvidence}>
                                {(isPolish ? CONFORMITY_LABEL_PL : CONFORMITY_LABEL_EN)[s]}
                                {s === 'conforming' && !hasAcceptedEvidence ? ` — ${t('wymaga zaakceptowanego dowodu', 'requires accepted evidence')}` : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleConclude}
                            disabled={!conformityChoice || saveStatus === 'saving'}
                            className="mt-1.5 rounded-token-md border border-c-border bg-c-surface px-3 py-1.5 text-xs font-medium text-c-text hover:bg-c-surface-raised"
                          >
                            {t('Wyciągnij wniosek', 'Conclude')}
                          </button>
                        </>
                      )}
                    </div>

                    <TeresaProposalCard
                      label={t('Teresa: wyjaśnij kryterium', 'Teresa: explain the criterion')}
                      programId={programId}
                      targetType="criterion"
                      targetId={criterionId}
                      intent="explain_criterion"
                      canPropose={canProposeAi}
                      canCommit={canCommitAi}
                      isPolish={isPolish}
                      onCommitted={load}
                    />

                    <div>
                      <h4 className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-c-text-muted">{t('Ustalenie', 'Finding')}</h4>
                      <FindingPanel
                        programId={programId}
                        criterionId={criterionId}
                        capabilities={capabilities}
                        currentUserId={currentUserId}
                        isPolish={isPolish}
                        selectedFindingId={selectedFindingId}
                        onSelectFinding={setSelectedFindingId}
                        onFindingDetailChange={setSelectedFindingDetail}
                        onFindingsChanged={load}
                        maxRows={3}
                      />
                    </div>

                    <div className={selectedFindingId ? 'rounded-token-md border border-c-focus-solid/35 bg-c-focus/5 p-3.5' : 'space-y-1'}>
                      <div className="mb-1.5 flex items-center gap-2">
                        <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-c-text-muted">{t('Odpowiedź właściciela', 'Management response')}</h4>
                        {selectedFindingId && (
                          <span className="inline-flex h-[19px] items-center rounded-full bg-c-focus-solid px-2 text-[10px] font-bold uppercase tracking-wide text-c-cta-text">
                            {t('teraz', 'now')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-c-text-muted">
                        {t(
                          'Odpowiedź składa i przegląda właściciel obszaru wewnątrz sekcji „Ustalenie" powyżej (finding.respond_as_management) — segregacja obowiązków zabrania audytorowi wypełniać ją w czyimś imieniu.',
                          'The response is submitted and reviewed by the finding owner inside the "Finding" section above (finding.respond_as_management) — segregation of duties forbids the auditor from filling it in on someone else’s behalf.'
                        )}
                      </p>
                    </div>

                    <div>
                      <h4 className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-c-text-muted">{t('Odpowiedź audytowanego', 'Auditee response')}</h4>
                      {canRespondAsAuditee ? (
                        <>
                          <textarea
                            value={auditeeResponseDraft}
                            onChange={(e) => setAuditeeResponseDraft(e.target.value)}
                            aria-label={t('Odpowiedź audytowanego', 'Auditee response')}
                            className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
                            rows={2}
                          />
                          <button
                            type="button"
                            onClick={handleSubmitAuditeeResponse}
                            disabled={!auditeeResponseDraft.trim() || saveStatus === 'saving'}
                            className="mt-1.5 inline-flex items-center gap-1.5 rounded-token-md border border-c-border bg-c-surface px-3 py-1.5 text-xs font-medium text-c-text hover:bg-c-surface-raised"
                          >
                            <Send size={12} aria-hidden />
                            {t('Wyślij odpowiedź', 'Submit response')}
                          </button>
                        </>
                      ) : (
                        <p className="text-sm text-c-text-muted">{criterion.auditeeResponse || t('Brak odpowiedzi audytowanego.', 'No auditee response yet.')}</p>
                      )}
                    </div>
                  </>
                )}

                {p.id === 'naprawa' &&
                  (selectedFindingDetail ? (
                    <RemediationPanel
                      programId={programId}
                      isPolish={isPolish}
                      capabilities={capabilities}
                      currentUserId={currentUserId}
                      finding={selectedFindingDetail}
                      onChanged={() => {
                        load();
                        loadHistory();
                      }}
                    />
                  ) : (
                    <div className="space-y-2.5">
                      <p className="flex items-center gap-2 text-xs text-c-text-muted">
                        <ShieldCheck size={14} aria-hidden />
                        {t(
                          'Zablokowana — odblokuje się, gdy potwierdzone ustalenie zostanie wybrane w fazie 3. Nic tu nie przepadło, pola czekają.',
                          'Locked — unlocks once a confirmed finding is selected in phase 3. Nothing here is lost, the fields are waiting.'
                        )}
                      </p>
                      {REMEDIATION_LINK_IDS.map((id) => (
                        <div key={id}>
                          <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-c-text-muted">
                            {isPolish ? REMEDIATION_LABELS_PL[id] : REMEDIATION_LABELS_EN[id]}
                          </h4>
                          <p className="text-xs text-c-text-muted">{t('Wybierz ustalenie powyżej, aby zobaczyć ten krok naprawczy.', 'Select a finding above to see this remediation step.')}</p>
                        </div>
                      ))}
                    </div>
                  ))}
              </PhaseCard>
            );
          })}
        </div>

        {/* ===== Prawy panel artefaktu (SPEC-A) ===== */}
        <ArtifactRightPanel sections={rightPanelSections} width="100%" className="!h-auto rounded-token-md border shadow-token-card xl:sticky xl:top-4 xl:!h-fit xl:self-start" />
      </div>
    </div>
  );
};

export default CriterionWorkspaceV2;
