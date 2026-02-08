import {
  ArrowLeft,
  Check,
  Edit3,
  FileText,
  Info,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  Save,
  Settings,
  Sparkles,
  Unlock,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ADMAAssessmentEditor } from '@/components/assessment/adma/ADMAAssessmentEditor';
import { DRDAssessmentEditor } from '@/components/assessment/drd/DRDAssessmentEditor';
import { InitiativesGenerationWizardModal } from '@/components/assessment/InitiativesGenerationWizardModal';
import { AssessmentManagePanel } from '@/components/assessment/manage/AssessmentManagePanel';
import { ReportTemplatePickerModal } from '@/components/assessment/modals/ReportTemplatePickerModal';
import { RequestAccessModal, useAssessmentPermissions } from '@/components/assessment/permissions';
import { SIRIAssessmentEditor } from '@/components/assessment/siri/SIRIAssessmentEditor';
import { CMPracticeForm } from '@/components/assessment/tools/CMPracticeForm';
import { LeanForm } from '@/components/assessment/tools/LeanForm';
import { Api } from '@/services/api';
import { ADMA_DIMENSIONS } from '@/services/admaStructure';
import { CMMI_PRACTICE_AREAS } from '@/services/cmmiStructure';
import { DRD_STRUCTURE } from '@/services/drdStructure';
import { SIRI_DIMENSIONS } from '@/services/siriStructure';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import { createWorkspaceContext } from '@/types/workspace';

type SupportedFramework = 'drd' | 'siri' | 'adma' | 'cmmi' | 'lean';

type AssessmentSession = {
  id: string;
  name: string;
  status: string;
  type?: string;
  completion_percent?: number;
  confidence_avg?: number;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  updated_by_name?: string;
  updated_by_email?: string;
  answers?: Record<string, any>;
  contextSnapshot?: Record<string, any>;
  navigation?: { axisId?: number; areaId?: string; level?: number } | null;
  userState?: { navigation?: { axisId?: number; areaId?: string; level?: number } | null } | null;
};

type DRDFormData = Record<string, any>;
type SIRIFormData = Record<string, any>;

type DRDPosition = {
  axisId: number;
  areaId: string;
  level: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function calcConfidenceAvgFromCompletion(completionPercent: number): number {
  const c = Number(completionPercent || 0);
  if (!Number.isFinite(c)) return 1;
  if (c >= 100) return 4;
  // Heuristic aligned with other tool workspaces:
  // 0-19% -> 1, 20-39% -> 2, 40-59% -> 3, 60-79% -> 4, 80-99% -> 5
  return clamp(Math.round(c / 20), 1, 5);
}

function getDrdFlatPositions(): Array<DRDPosition> {
  const out: Array<DRDPosition> = [];
  for (const axis of DRD_STRUCTURE) {
    for (const area of axis.areas) {
      const maxLvl = axis.levelCount || 5;
      for (let lvl = 1; lvl <= maxLvl; lvl++) {
        out.push({ axisId: axis.id, areaId: area.id, level: lvl });
      }
    }
  }
  return out;
}

function parseIntOr(n: string | null, fallback: number): number {
  const x = Number.parseInt(String(n ?? ''), 10);
  return Number.isFinite(x) ? x : fallback;
}

function getAssessmentNavStorageKey(assessmentId: string): string {
  return `assessment.nav.${assessmentId}`;
}

function calcDrdCompletionPercent(drd: any): number {
  // New DRD editor stores per-area achieved levels in `drd.areas`.
  // We treat an area as "answered" when any meaningful decision exists
  // (achievedLevel, targetLevel, explicit levelDecisions, or any note).
  const areas = drd?.areas || {};
  const totalAreas = DRD_STRUCTURE.reduce((acc, ax) => acc + ax.areas.length, 0);
  if (totalAreas === 0) return 0;
  const answered = DRD_STRUCTURE.reduce((acc, ax) => {
    for (const a of ax.areas) {
      const s = areas[a.id];
      const hasAchieved = Number(s?.achievedLevel || 0) > 0;
      const hasTarget = Number(s?.targetLevel || 0) > 0;
      const hasDecisions = s?.levelDecisions && Object.keys(s.levelDecisions || {}).length > 0;
      const hasNotes =
        s?.levelNotes && Object.values(s.levelNotes || {}).some((v: any) => String(v || '').trim());
      const hasLinks =
        s?.levelLinks &&
        Object.values(s.levelLinks || {}).some((arr: any) => Array.isArray(arr) && arr.length > 0);
      if (hasAchieved || hasTarget || hasDecisions || hasNotes || hasLinks) acc += 1;
    }
    return acc;
  }, 0);
  return Math.round((answered / totalAreas) * 100);
}

function calcAxisProgress(
  drd: any,
  axisId: number
): { completed: number; total: number; percent: number } {
  const axis = DRD_STRUCTURE.find((a) => a.id === axisId);
  if (!axis) return { completed: 0, total: 0, percent: 0 };
  const areas = drd?.areas || {};
  const completed = axis.areas.filter((a) => {
    const state = areas[a.id];
    const hasAchieved = Number(state?.achievedLevel || 0) > 0;
    const hasTarget = Number(state?.targetLevel || 0) > 0;
    const hasDecisions =
      state?.levelDecisions && Object.keys(state.levelDecisions || {}).length > 0;
    const hasNotes =
      state?.levelNotes &&
      Object.values(state.levelNotes || {}).some((v: any) => String(v || '').trim());
    const hasLinks =
      state?.levelLinks &&
      Object.values(state.levelLinks || {}).some(
        (arr: any) => Array.isArray(arr) && arr.length > 0
      );
    return hasAchieved || hasTarget || hasDecisions || hasNotes || hasLinks;
  }).length;
  return {
    completed,
    total: axis.areas.length,
    percent: axis.areas.length > 0 ? Math.round((completed / axis.areas.length) * 100) : 0,
  };
}

/**
 * SIRI completion%: a dimension is "answered" when its current score > 0
 * or it has target, notes, or evidence set.
 * Total = 8 dimensions.
 */
function calcSiriCompletionPercent(siri: any): number {
  const dims = siri?.dimensions || {};
  const totalDims = SIRI_DIMENSIONS.length; // 8
  if (totalDims === 0) return 0;
  const answered = SIRI_DIMENSIONS.filter((d) => {
    const s = dims[d.id];
    if (!s) return false;
    const hasCurrent = Number(s.current || 0) > 0;
    const hasTarget = Number(s.target || 0) > 0;
    const hasNotes = Boolean(String(s.notes || '').trim());
    const hasEvidence = Boolean(String(s.evidence || '').trim());
    return hasCurrent || hasTarget || hasNotes || hasEvidence;
  }).length;
  // Also count prioritisation areas if present
  const priMatrix = siri?.prioritisationMatrix || siri?.prioritisation || {};
  const priCount = Object.values(priMatrix).filter((v: any) => {
    if (typeof v === 'number') return v > 0;
    if (typeof v === 'object' && v !== null) return Number((v as any).score || 0) > 0;
    return false;
  }).length;
  // Weight: 70% from dimensions, 30% from prioritisation areas (16 total)
  const dimPercent = (answered / totalDims) * 100;
  const priPercent = priCount > 0 ? (priCount / 16) * 100 : 0;
  return Math.round(dimPercent * 0.7 + priPercent * 0.3);
}

/**
 * ADMA completion%: a dimension is "answered" when its current score differs
 * from default (1) or has target/notes/evidence.
 * Total = 12 dimensions.
 */
function calcAdmaCompletionPercent(adma: any): number {
  const dims = adma?.dimensions || {};
  const totalDims = ADMA_DIMENSIONS.length; // 12
  if (totalDims === 0) return 0;
  const answered = ADMA_DIMENSIONS.filter((d) => {
    const s = dims[d.id];
    if (!s) return false;
    // ADMA scale starts at 1 (default). Treat as "answered" if explicitly set > 1
    // OR if target/notes/evidence exist (even at level 1 — user consciously set it)
    const hasCurrent = Number(s.current || 0) > 1;
    const hasTarget = Number(s.target || 0) > 0;
    const hasNotes = Boolean(String(s.notes || '').trim());
    const hasEvidence = Boolean(String(s.evidence || '').trim());
    return hasCurrent || hasTarget || hasNotes || hasEvidence;
  }).length;
  return Math.round((answered / totalDims) * 100);
}

/**
 * CMMI completion%: a practice area is "answered" when its level > 1
 * or has target/evidence. Total = 20 practice areas.
 */
function calcCmmiCompletionPercent(cmmi: any): number {
  const cats = cmmi?.categories || {};
  const totalPAs = CMMI_PRACTICE_AREAS.length; // 20
  if (totalPAs === 0) return 0;
  let answered = 0;
  for (const catData of Object.values(cats) as any[]) {
    const scores = catData?.practiceAreaScores || {};
    for (const pa of Object.values(scores) as any[]) {
      const hasLevel = Number(pa?.level || 0) > 1;
      const hasTarget = Number(pa?.target || 0) > 0;
      const hasEvidence = Boolean(String(pa?.evidence || '').trim());
      if (hasLevel || hasTarget || hasEvidence) answered++;
    }
  }
  return Math.round((answered / totalPAs) * 100);
}

/**
 * Lean completion%: count processes + workstations with meaningful data.
 */
function calcLeanCompletionPercent(lean: any): number {
  const processes = Array.isArray(lean?.processes) ? lean.processes : [];
  const workstations = Array.isArray(lean?.workstations) ? lean.workstations : [];
  const total = processes.length + workstations.length;
  if (total === 0) return 0;
  const answeredProcesses = processes.filter((p: any) => {
    return Number(p?.leanMaturity || 0) > 0 || Number(p?.automationPotential || 0) > 0;
  }).length;
  const answeredWorkstations = workstations.filter((w: any) => {
    return Number(w?.leanMaturity || 0) > 0 || Number(w?.automationPotential || 0) > 0;
  }).length;
  return Math.round(((answeredProcesses + answeredWorkstations) / total) * 100);
}

/**
 * Universal completion percent calculator based on framework
 */
function calcCompletionPercent(framework: string, answers: Record<string, any>): number {
  switch (framework) {
    case 'drd':
      return calcDrdCompletionPercent(answers?.drd || {});
    case 'siri':
      return calcSiriCompletionPercent(answers?.siri || {});
    case 'adma':
      return calcAdmaCompletionPercent(answers?.adma || {});
    case 'cmmi':
      return calcCmmiCompletionPercent(answers?.cmmi || {});
    case 'lean':
      return calcLeanCompletionPercent(answers?.lean || {});
    default:
      return 0;
  }
}

export const AssessmentSessionEditorView: React.FC = () => {
  const navigate = useNavigate();
  const { framework: frameworkParam, assessmentId } = useParams();
  // NOTE (React 19 + useSyncExternalStore):
  // Avoid selectors returning new objects/arrays each call (even with shallow),
  // because it can trigger "getSnapshot should be cached" warnings/loops.
  const setCurrentViewState = useAppStore((s) => s.setCurrentViewState);
  const currentUser = useAppStore((s) => s.currentUser);
  const isChatCollapsed = useAppStore((s) => s.isChatCollapsed);
  const toggleChatCollapse = useAppStore((s) => s.toggleChatCollapse);
  const createConversation = useConversationStore((s) => s.createConversation);
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation);
  const setWorkspaceContext = useConversationStore((s) => s.setWorkspaceContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const framework = (frameworkParam?.toLowerCase() as SupportedFramework | undefined) || undefined;

  // Set currentView for breadcrumbs
  useEffect(() => {
    if (framework === 'drd') {
      setCurrentViewState(AppView.ASSESSMENT_DRD);
    } else if (framework === 'siri') {
      setCurrentViewState(AppView.ASSESSMENT_SIRI);
    } else if (framework === 'adma') {
      setCurrentViewState(AppView.ASSESSMENT_ADMA);
    } else if (framework === 'cmmi') {
      setCurrentViewState(AppView.ASSESSMENT_CMMI);
    } else if (framework === 'lean') {
      setCurrentViewState(AppView.ASSESSMENT_LEAN);
    }
  }, [framework, setCurrentViewState]);

  const [assessment, setAssessment] = useState<AssessmentSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [serverUpdatedAt, setServerUpdatedAt] = useState<Date | null>(null);
  const [lastEditorName, setLastEditorName] = useState<string | null>(null);
  const [currentAxisId, setCurrentAxisId] = useState<number>(1);
  const [currentAreaId, setCurrentAreaId] = useState<string>(
    DRD_STRUCTURE[0]?.areas?.[0]?.id || '1A'
  );
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [userNavFromServer, setUserNavFromServer] = useState<DRDPosition | null>(null);
  const [assignments, setAssignments] = useState<Array<any>>([]);
  const navInitRef = useRef(false);

  const saveTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Track the conversation created for this assessment session (to avoid duplicates)
  const assessmentChatIdRef = useRef<string | null>(null);

  // Chat context attach (general chat)
  const [isChatContextOpen, setIsChatContextOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatAttaching, setChatAttaching] = useState(false);
  const [chatConversations, setChatConversations] = useState<any[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  // Header UI controls
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [isLocked, setIsLocked] = useState(true);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showRequestAccessModal, setShowRequestAccessModal] = useState(false);
  const [leftWorkspace, setLeftWorkspace] = useState<'none' | 'manage'>('none');
  const [manageTab, setManageTab] = useState<
    'workflow' | 'team' | 'initiatives' | 'reports' | 'access' | 'logs'
  >('workflow');
  const [isInitiativesWizardOpen, setIsInitiativesWizardOpen] = useState(false);
  const [isReportTemplatePickerOpen, setIsReportTemplatePickerOpen] = useState(false);

  // Permissions
  const {
    role: userRole,
    permissions,
    isLoading: permissionsLoading,
    requestAccess,
    refreshPermissions,
  } = useAssessmentPermissions(assessmentId);

  const isGlobalAdmin = useMemo(() => {
    const r = String(currentUser?.role || '').toLowerCase();
    return (
      r === 'admin' ||
      r === 'owner' ||
      r === 'superadmin' ||
      r === 'super_admin' ||
      r === 'administrator'
    );
  }, [currentUser?.role]);

  const canManageEffective = Boolean(permissions?.canManage || isGlobalAdmin);
  const canEditEffective = Boolean(permissions?.canEdit || isGlobalAdmin);
  const isAdminEffective = Boolean(isGlobalAdmin || userRole === 'admin');

  // Admins shouldn't need a lock toggle: keep editing enabled.
  useEffect(() => {
    if (isAdminEffective) {
      setIsLocked(false);
    }
  }, [isAdminEffective]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const load = useCallback(async () => {
    if (!assessmentId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = (await Api.get(`/assessment-workflow-v2/${assessmentId}`)) as AssessmentSession;
      setAssessment(data);
      setAnswers(data?.answers || {});
      setNameDraft(data?.name || '');
      setServerUpdatedAt(data?.updated_at ? new Date(data.updated_at) : null);
      setLastEditorName(null);

      // Enterprise: load per-user state + assignments (DRD only)
      if (framework === 'drd') {
        Api.get(`/assessment-workflow-v2/${assessmentId}/user-state`)
          .then((s: any) => {
            const nav = s?.navigation;
            if (nav?.axisId && nav?.areaId && nav?.level) {
              setUserNavFromServer({
                axisId: Number(nav.axisId),
                areaId: String(nav.areaId),
                level: Number(nav.level),
              });
            } else {
              setUserNavFromServer(null);
            }
          })
          .catch(() => setUserNavFromServer(null));

        Api.get(`/assessment-workflow-v2/${assessmentId}/assignments`)
          .then((a: any) => setAssignments(Array.isArray(a?.assignments) ? a.assignments : []))
          .catch(() => setAssignments([]));
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load assessment');
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId, framework]);

  useEffect(() => {
    load();
  }, [load]);

  // Load conversations when modal opens (and on search)
  useEffect(() => {
    if (!isChatContextOpen) return;
    let cancelled = false;
    const run = async () => {
      setChatLoading(true);
      try {
        const resp = await Api.getConversations({
          search: chatSearch || undefined,
          limit: 30,
          offset: 0,
        });
        if (cancelled) return;
        setChatConversations(Array.isArray(resp?.conversations) ? resp.conversations : []);
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message || 'Failed to load conversations');
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isChatContextOpen, chatSearch]);

  // Initialize / restore DRD position from URL, then localStorage, then per-user server state, then shared server navigation (once).
  useEffect(() => {
    if (framework !== 'drd' || !assessmentId) return;
    if (!assessment) return;
    if (navInitRef.current) return;

    const urlAxis = parseIntOr(searchParams.get('axis'), NaN as any);
    const urlArea = searchParams.get('area');
    const urlLevel = parseIntOr(searchParams.get('level'), NaN as any);

    const isUrlComplete = Number.isFinite(urlAxis) && !!urlArea && Number.isFinite(urlLevel);

    let next: DRDPosition | null = null;

    if (isUrlComplete) {
      next = { axisId: urlAxis, areaId: urlArea!, level: urlLevel };
    } else {
      try {
        const raw = window.localStorage.getItem(getAssessmentNavStorageKey(assessmentId));
        if (raw) next = JSON.parse(raw) as DRDPosition;
      } catch {
        // ignore
      }
      if (
        !next &&
        userNavFromServer?.axisId &&
        userNavFromServer?.areaId &&
        userNavFromServer?.level
      ) {
        next = userNavFromServer;
      }
      if (
        !next &&
        assessment?.navigation?.axisId &&
        assessment?.navigation?.areaId &&
        assessment?.navigation?.level
      ) {
        next = {
          axisId: Number(assessment.navigation.axisId),
          areaId: String(assessment.navigation.areaId),
          level: Number(assessment.navigation.level),
        };
      }
    }

    // Validate + fallback
    const axis = DRD_STRUCTURE.find((a) => a.id === next?.axisId) || DRD_STRUCTURE[0];
    const area = (next?.areaId && axis.areas.find((x) => x.id === next?.areaId)) || axis.areas[0];
    const levelCount = axis.levelCount || 5;
    const level = clamp(Number(next?.level || 1), 1, levelCount);

    setCurrentAxisId(axis.id);
    setCurrentAreaId(area?.id || '1A');
    setCurrentLevel(level);

    // Ensure URL is canonical (shareable)
    setSearchParams(
      {
        axis: String(axis.id),
        area: String(area?.id || '1A'),
        level: String(level),
      },
      { replace: true }
    );

    navInitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framework, assessmentId, assessment, userNavFromServer]);

  // Persist DRD position to URL + localStorage
  useEffect(() => {
    if (framework !== 'drd' || !assessmentId) return;
    if (!navInitRef.current) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('axis', String(currentAxisId));
    nextParams.set('area', String(currentAreaId));
    nextParams.set('level', String(currentLevel));

    const currentSerialized = searchParams.toString();
    const nextSerialized = nextParams.toString();
    if (currentSerialized !== nextSerialized) {
      setSearchParams(nextParams, { replace: true });
    }

    try {
      const payload: DRDPosition = {
        axisId: currentAxisId,
        areaId: currentAreaId,
        level: currentLevel,
      };
      window.localStorage.setItem(
        getAssessmentNavStorageKey(assessmentId),
        JSON.stringify(payload)
      );
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framework, assessmentId, currentAxisId, currentAreaId, currentLevel]);

  const scheduleSave = useCallback(
    (nextAnswers: Record<string, any>, completionPercent?: number) => {
      if (!assessmentId) return;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

      saveTimerRef.current = window.setTimeout(async () => {
        setIsSaving(true);
        try {
          const resolvedCompletion = completionPercent ?? assessment?.completion_percent ?? 0;
          const payload: any = {
            answers: nextAnswers,
            completionPercent: resolvedCompletion,
            confidenceAvg: calcConfidenceAvgFromCompletion(resolvedCompletion),
          };
          if (framework === 'drd') {
            payload.navigation = {
              axisId: currentAxisId,
              areaId: currentAreaId,
              level: currentLevel,
            };
          }
          const resp = (await Api.put(`/assessment-workflow-v2/${assessmentId}`, payload)) as
            | { updatedAt?: string }
            | undefined;
          if (!isMountedRef.current) return;
          const ts = resp?.updatedAt ? new Date(resp.updatedAt) : new Date();
          setLastSavedAt(ts);
          setServerUpdatedAt(ts);
          setAssessment((prev) =>
            prev
              ? {
                  ...prev,
                  updated_at: ts.toISOString(),
                  updated_by: currentUser?.id || prev.updated_by,
                  navigation: framework === 'drd' ? payload.navigation : prev.navigation,
                }
              : prev
          );

          // Enterprise: persist per-user resume without affecting shared position semantics
          if (framework === 'drd') {
            Api.put(`/assessment-workflow-v2/${assessmentId}/user-state`, {
              navigation: { axisId: currentAxisId, areaId: currentAreaId, level: currentLevel },
            }).catch(() => {});
          }
        } catch (e: any) {
          console.error('[AssessmentSessionEditorView] Auto-save failed:', e);
          // Silent fail for auto-save; user can manually save if needed
        } finally {
          if (isMountedRef.current) {
            setIsSaving(false);
          }
        }
      }, 600);
    },
    [
      assessmentId,
      assessment?.completion_percent,
      framework,
      currentAxisId,
      currentAreaId,
      currentLevel,
      currentUser?.id,
    ]
  );

  const handleManualSave = useCallback(async () => {
    if (!assessmentId || isSaving) return;
    setIsSaving(true);
    try {
      const completionPercent = framework
        ? calcCompletionPercent(framework, answers)
        : (assessment?.completion_percent ?? 0);
      const confidenceAvg = calcConfidenceAvgFromCompletion(completionPercent);
      const payload: any = {
        answers,
        completionPercent,
        confidenceAvg,
      };
      if (framework === 'drd') {
        payload.navigation = { axisId: currentAxisId, areaId: currentAreaId, level: currentLevel };
      }
      const resp = (await Api.put(`/assessment-workflow-v2/${assessmentId}`, payload)) as
        | { updatedAt?: string }
        | undefined;
      const ts = resp?.updatedAt ? new Date(resp.updatedAt) : new Date();
      setLastSavedAt(ts);
      setServerUpdatedAt(ts);
      setAssessment((prev) =>
        prev
          ? {
              ...prev,
              updated_at: ts.toISOString(),
              updated_by: currentUser?.id || prev.updated_by,
              navigation: framework === 'drd' ? payload.navigation : prev.navigation,
            }
          : prev
      );
      if (framework === 'drd') {
        Api.put(`/assessment-workflow-v2/${assessmentId}/user-state`, {
          navigation: { axisId: currentAxisId, areaId: currentAreaId, level: currentLevel },
        }).catch(() => {});
      }
      toast.success('Assessment saved successfully');
    } catch (e: any) {
      const errorMsg = e?.message || 'Failed to save assessment';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  }, [
    assessmentId,
    isSaving,
    framework,
    answers,
    assessment?.completion_percent,
    currentAxisId,
    currentAreaId,
    currentLevel,
    currentUser?.id,
  ]);

  // Exit handlers
  const handleExitClick = useCallback(() => {
    setShowExitConfirm(true);
  }, []);

  const handleExitWithoutSave = useCallback(() => {
    setShowExitConfirm(false);
    navigate('/assessment/overview');
  }, [navigate]);

  const handleSaveAndExit = useCallback(async () => {
    if (!assessmentId) {
      navigate('/assessment/overview');
      return;
    }
    setIsExiting(true);
    try {
      const completionPercent = framework
        ? calcCompletionPercent(framework, answers)
        : (assessment?.completion_percent ?? 0);
      const confidenceAvg = calcConfidenceAvgFromCompletion(completionPercent);
      const payload: any = {
        answers,
        completionPercent,
        confidenceAvg,
      };
      if (framework === 'drd') {
        payload.navigation = { axisId: currentAxisId, areaId: currentAreaId, level: currentLevel };
      }
      await Api.put(`/assessment-workflow-v2/${assessmentId}`, payload);
      toast.success('Assessment saved');
      navigate('/assessment/overview');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
      setIsExiting(false);
    }
  }, [
    assessmentId,
    framework,
    answers,
    assessment?.completion_percent,
    currentAxisId,
    currentAreaId,
    currentLevel,
    navigate,
  ]);

  // Workspace context for AI chat awareness (assessment data snapshot)
  const chatWorkspaceContext = useMemo(() => {
    if (!assessmentId || !assessment) return undefined;
    const view =
      framework === 'drd'
        ? AppView.ASSESSMENT_DRD
        : framework === 'siri'
          ? AppView.ASSESSMENT_SIRI
          : framework === 'adma'
            ? AppView.ASSESSMENT_ADMA
            : framework === 'cmmi'
              ? AppView.ASSESSMENT_CMMI
              : framework === 'lean'
                ? AppView.ASSESSMENT_LEAN
                : AppView.ASSESSMENT_OVERVIEW;

    const completionPercent = framework
      ? calcCompletionPercent(framework, answers)
      : (assessment?.completion_percent ?? 0);
    const confidenceAvg = calcConfidenceAvgFromCompletion(completionPercent);

    const drdData: any = answers?.drd || {};
    const axisProgress =
      framework === 'drd'
        ? DRD_STRUCTURE.map((ax) => {
            const p = calcAxisProgress(drdData, ax.id);
            return {
              axisId: ax.id,
              axisName: ax.namePL || ax.name,
              completed: p.completed,
              total: p.total,
              percent: p.percent,
            };
          }).sort((a, b) => a.percent - b.percent)
        : [];

    return createWorkspaceContext(view, 'assessment', {
      entityId: assessmentId,
      entityName: assessment?.name || 'Assessment',
      entityData: {
        assessmentId,
        framework,
        status: assessment?.status,
        completionPercent,
        confidenceAvg,
        currentFocus:
          framework === 'drd'
            ? { axisId: currentAxisId, areaId: currentAreaId, level: currentLevel }
            : null,
        needsWorkTopAxes: axisProgress.slice(0, 3),
        contextSnapshot: assessment?.contextSnapshot || null,
      },
    });
  }, [assessmentId, assessment, framework, answers, currentAxisId, currentAreaId, currentLevel]);

  // Open chat with assessment context
  // Uses the existing MainLayout chat panel (not a separate overlay).
  // 1. Creates/reuses a conversation with assessment context
  // 2. Pushes the assessment workspaceContext so the AI "sees" the assessment
  // 3. Expands the MainLayout chat panel if it's collapsed
  const handleOpenChat = useCallback(async () => {
    if (!assessmentId || !assessment) return;

    try {
      // Reuse the conversation already created for this assessment session
      if (assessmentChatIdRef.current) {
        setActiveConversation(assessmentChatIdRef.current);
      } else {
        // Build a rich context package for the AI conversation
        const completionPercent = framework
          ? calcCompletionPercent(framework, answers)
          : (assessment?.completion_percent ?? 0);

        const drdData: any = answers?.drd || {};
        const axisProgress =
          framework === 'drd'
            ? DRD_STRUCTURE.map((ax) => {
                const p = calcAxisProgress(drdData, ax.id);
                return {
                  axisId: ax.id,
                  axisName: ax.namePL || ax.name,
                  completed: p.completed,
                  total: p.total,
                  percent: p.percent,
                };
              }).sort((a, b) => a.percent - b.percent)
            : [];

        const pmoContext: Record<string, any> = {
          assessmentId,
          framework,
          status: assessment?.status,
          completionPercent,
          currentFocus:
            framework === 'drd'
              ? { axisId: currentAxisId, areaId: currentAreaId, level: currentLevel }
              : null,
          needsWorkTopAxes: axisProgress.slice(0, 3),
          contextSnapshot: assessment?.contextSnapshot || null,
        };

        // Create new conversation with the full assessment context
        const conversation = await createConversation({
          title: `Assessment: ${assessment.name || 'Untitled'}`,
          pmoContext,
        });

        // Track conversation ID for this session so we can reuse on next click
        assessmentChatIdRef.current = conversation.id;
      }

      // Push assessment workspace context so the AI panel "sees" the assessment
      if (chatWorkspaceContext) {
        setWorkspaceContext(chatWorkspaceContext);
      }

      // Open the existing MainLayout chat panel if it's collapsed
      if (isChatCollapsed) {
        toggleChatCollapse();
      }
    } catch (e: any) {
      console.error('[AssessmentSessionEditorView] Failed to create chat:', e);
      toast.error('Failed to open chat');
    }
  }, [
    assessmentId,
    assessment,
    framework,
    answers,
    currentAxisId,
    currentAreaId,
    currentLevel,
    isChatCollapsed,
    chatWorkspaceContext,
    createConversation,
    setActiveConversation,
    setWorkspaceContext,
    toggleChatCollapse,
  ]);

  const handleOpenInitiativesWorkflow = useCallback(() => {
    if (canManageEffective) {
      setManageTab('initiatives');
      setLeftWorkspace('manage');
    }
    setIsInitiativesWizardOpen(true);
  }, [canManageEffective]);

  const openReport = useCallback(
    (reportId: string) => {
      // Open the Report Builder editor with a returnUrl so the close button brings back here
      const returnUrl = encodeURIComponent(
        `/assessment/${framework}/${assessmentId}?${searchParams.toString()}`
      );
      navigate(`/reports/builder/${reportId}?returnUrl=${returnUrl}`);
    },
    [navigate, assessmentId, searchParams, framework]
  );

  const handleOpenReportWorkflow = useCallback(() => {
    if (!assessmentId || !assessment) return;
    if (canManageEffective) {
      setManageTab('reports');
      setLeftWorkspace('manage');
    }
    setIsReportTemplatePickerOpen(true);
  }, [assessmentId, assessment, canManageEffective]);

  const handleStartNewReportFromTemplate = useCallback(
    async (templateId: string) => {
      if (!assessmentId || !assessment) return;

      // 1. Create the report record from the template
      // 2. Trigger AI generation for all sections
      // 3. Navigate to the editor with the fully-generated report
      const toastId = toast.loading('Creating report…');
      try {
        const reportTitle = `${assessment?.name || 'Assessment'} - Report`;
        const response = await Api.post('/report-builder', {
          sourceType: 'ASSESSMENT',
          sourceId: assessmentId,
          title: reportTitle,
          templateId,
        });

        const reportId = response?.report?.id;
        if (!reportId) throw new Error('Unexpected server response');

        // Auto-generate AI content for every section
        toast.loading('Generating report content with AI…', { id: toastId });
        try {
          await Api.post(`/report-builder/${reportId}/generate`, {
            regenerateAll: false,
          });
        } catch (genErr: any) {
          // Generation failed but report exists — show warning, still open the editor
          const genMsg = genErr?.error || genErr?.message || 'AI generation failed';
          console.error('[handleStartNewReportFromTemplate] Generation error:', genErr);
          toast.error(`Generation issue: ${genMsg}. You can retry in the editor.`, { id: toastId, duration: 6000 });
          // Skip the success toast — navigate to editor below
          const returnUrl = encodeURIComponent(
            `/assessment/${framework}/${assessmentId}?${searchParams.toString()}`
          );
          navigate(`/reports/builder/${reportId}?returnUrl=${returnUrl}`);
          return;
        }

        setIsReportTemplatePickerOpen(false);
        toast.success('Report generated — opening editor', { id: toastId });

        // Navigate to the Report Builder editor.
        // Pass returnUrl so the editor's close button brings the user back here.
        const returnUrl = encodeURIComponent(
          `/assessment/${framework}/${assessmentId}?${searchParams.toString()}`
        );
        navigate(`/reports/builder/${reportId}?returnUrl=${returnUrl}`);
      } catch (err: any) {
        const msg = err?.error || err?.message || 'Failed to create report';
        toast.error(msg, { id: toastId });
        console.error('[handleStartNewReportFromTemplate] Error:', err);
        throw err;
      }
    },
    [assessmentId, assessment, navigate, searchParams, framework]
  );

  const assignmentByAreaId = useMemo(() => {
    const map: Record<string, any> = {};
    for (const a of assignments || []) {
      if (a?.area_id) map[String(a.area_id)] = a;
    }
    return map;
  }, [assignments]);

  const assignAreaToMe = useCallback(
    async (areaId: string) => {
      if (!assessmentId || !currentUser?.id) return;
      try {
        await Api.put(`/assessment-workflow-v2/${assessmentId}/assignments`, {
          areaId,
          assignedUserId: currentUser.id,
        });
        const refreshed = await Api.get(`/assessment-workflow-v2/${assessmentId}/assignments`);
        setAssignments(Array.isArray(refreshed?.assignments) ? refreshed.assignments : []);
      } catch {
        // ignore
      }
    },
    [assessmentId, currentUser?.id]
  );

  // Resolve "last edited by" display name (enterprise-friendly)
  useEffect(() => {
    if (framework !== 'drd') return;
    const editorId = assessment?.updated_by;
    if (!editorId) return;
    if (editorId === currentUser?.id) {
      setLastEditorName('you');
      return;
    }
    let cancelled = false;
    Api.get(`/users/${editorId}`)
      .then((resp: any) => {
        const u = resp?.data || resp?.user || resp?.result || null;
        const first = u?.first_name || u?.firstName || '';
        const last = u?.last_name || u?.lastName || '';
        const name = String(`${first} ${last}`.trim() || u?.email || editorId);
        if (!cancelled) setLastEditorName(name);
      })
      .catch(() => {
        if (!cancelled) setLastEditorName(editorId);
      });
    return () => {
      cancelled = true;
    };
  }, [framework, assessment?.updated_by, currentUser?.id]);

  // Keyboard shortcuts: Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleManualSave]);

  const title = assessment?.name || 'Assessment';
  const status = assessment?.status || 'DRAFT';

  const headerMeta = useMemo(() => {
    const parts: string[] = [];
    if (framework) parts.push(framework.toUpperCase());
    parts.push(status);
    const completionPercent = framework
      ? calcCompletionPercent(framework, answers)
      : (assessment?.completion_percent ?? 0);
    if (completionPercent > 0) parts.push(`${completionPercent}% complete`);
    return parts.join(' · ');
  }, [framework, status, answers, assessment?.completion_percent]);

  const overallProgress = useMemo(() => {
    if (framework) {
      return calcCompletionPercent(framework, answers);
    }
    return assessment?.completion_percent ?? 0;
  }, [framework, answers, assessment?.completion_percent]);

  const drdMetrics = useMemo(() => {
    if (framework !== 'drd') return null;
    const drd = answers?.drd || {};
    const areas = drd?.areas || {};
    const totalAreas = DRD_STRUCTURE.reduce((acc, ax) => acc + ax.areas.length, 0);
    const answeredAreas = DRD_STRUCTURE.reduce((acc, ax) => {
      for (const a of ax.areas) {
        const s = areas[a.id];
        if (Number(s?.achievedLevel || 0) > 0 || Number(s?.targetLevel || 0) > 0) acc += 1;
      }
      return acc;
    }, 0);
    const axisProgress = calcAxisProgress(drd, currentAxisId);
    const stepsTotal = getDrdFlatPositions().length;
    const stepsDone = Math.max(
      0,
      Math.min(stepsTotal, Math.round((overallProgress / 100) * stepsTotal))
    );
    return { totalAreas, answeredAreas, axisProgress, stepsDone, stepsTotal };
  }, [framework, answers, currentAxisId, overallProgress]);

  const drdPositionLabel = useMemo(() => {
    if (framework !== 'drd') return null;
    const axis = DRD_STRUCTURE.find((a) => a.id === currentAxisId);
    const area = axis?.areas?.find((x) => x.id === currentAreaId);
    if (!axis || !area) return null;
    return `${axis.id}. ${axis.name} · ${area.id} ${area.name} · Level ${currentLevel}/${axis.levelCount || 5}`;
  }, [framework, currentAxisId, currentAreaId, currentLevel]);

  const editedMeta = useMemo(() => {
    if (!assessment) return null;
    const ts = serverUpdatedAt || (assessment.updated_at ? new Date(assessment.updated_at) : null);
    // Determine who edited: "you" if current user, otherwise name/email or null
    let who: string | null = lastEditorName;
    if (!who && assessment.updated_by) {
      if (currentUser?.id && assessment.updated_by === currentUser.id) {
        who = 'you';
      } else if (assessment.updated_by_name) {
        who = assessment.updated_by_name;
      } else if (assessment.updated_by_email) {
        who = assessment.updated_by_email;
      }
    }
    const parts: string[] = [];
    if (who) parts.push(`Edited by ${who}`);
    if (ts && Number.isFinite(ts.getTime())) {
      const diffMs = Date.now() - ts.getTime();
      const diffMin = Math.max(0, Math.round(diffMs / 60000));
      if (diffMin < 1) parts.push('just now');
      else if (diffMin < 60) parts.push(`${diffMin} min ago`);
      else {
        const diffH = Math.round(diffMin / 60);
        parts.push(`${diffH}h ago`);
      }
    }
    return parts.length ? parts.join(' · ') : null;
  }, [assessment, serverUpdatedAt, lastEditorName, currentUser?.id]);

  const drdNav = useMemo(() => {
    if (framework !== 'drd') return null;
    const flat = getDrdFlatPositions();
    const idx = flat.findIndex(
      (p) => p.axisId === currentAxisId && p.areaId === currentAreaId && p.level === currentLevel
    );
    return { flat, idx };
  }, [framework, currentAxisId, currentAreaId, currentLevel]);

  const handleAxisChange = useCallback((axisId: number) => {
    const axis = DRD_STRUCTURE.find((a) => a.id === axisId) || DRD_STRUCTURE[0];
    const firstArea = axis?.areas?.[0]?.id || '1A';
    setCurrentAxisId(axis.id);
    setCurrentAreaId(firstArea);
    setCurrentLevel(1);
  }, []);

  const handleAreaChange = useCallback((areaId: string) => {
    const axis =
      DRD_STRUCTURE.find((a) => a.areas.some((ar) => ar.id === areaId)) || DRD_STRUCTURE[0];
    setCurrentAxisId(axis.id);
    setCurrentAreaId(areaId);
    const max = axis.levelCount || 5;
    setCurrentLevel((lvl) => clamp(lvl, 1, max));
  }, []);

  const handleLevelChange = useCallback(
    (level: number) => {
      const axis = DRD_STRUCTURE.find((a) => a.id === currentAxisId) || DRD_STRUCTURE[0];
      setCurrentLevel(clamp(level, 1, axis.levelCount || 5));
    },
    [currentAxisId]
  );

  const goPrev = useCallback(() => {
    if (framework !== 'drd' || !drdNav) return;
    const prev = drdNav.flat[Math.max(0, drdNav.idx - 1)];
    if (!prev) return;
    setCurrentAxisId(prev.axisId);
    setCurrentAreaId(prev.areaId);
    setCurrentLevel(prev.level);
  }, [framework, drdNav]);

  const goNext = useCallback(() => {
    if (framework !== 'drd' || !drdNav) return;
    const next = drdNav.flat[Math.min(drdNav.flat.length - 1, drdNav.idx + 1)];
    if (!next) return;
    setCurrentAxisId(next.axisId);
    setCurrentAreaId(next.areaId);
    setCurrentLevel(next.level);
  }, [framework, drdNav]);

  if (!assessmentId || !framework) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="text-center text-slate-500 dark:text-slate-400">
          Invalid assessment URL.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading assessment…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="max-w-md text-center">
          <div className="text-rose-500 font-medium mb-2">{error}</div>
          <button
            onClick={() => navigate('/assessment/overview')}
            className="px-4 py-2 rounded-lg bg-navy-900 text-white hover:bg-navy-800 transition-colors"
          >
            Back to Assessment
          </button>
        </div>
      </div>
    );
  }

  const renderEditor = () => {
    if (framework === 'drd') {
      const drdData: DRDFormData = answers?.drd || {};
      return (
        <DRDAssessmentEditor
          assessmentId={assessmentId}
          readOnly={isLocked}
          currentUserId={currentUser?.id || undefined}
          assignmentByAreaId={assignmentByAreaId}
          onAssignToMe={assignAreaToMe}
          leftOverride={
            leftWorkspace === 'manage' && canManageEffective ? (
              <AssessmentManagePanel
                assessmentId={assessmentId}
                assessmentName={assessment?.name}
                initialTab={manageTab}
                onOpenReport={(reportId) => openReport(reportId)}
                onCreateReport={() => setIsReportTemplatePickerOpen(true)}
              />
            ) : undefined
          }
          onViewModeChange={() => {
            // Switching between Survey/Preview should exit Manage workspace
            if (leftWorkspace === 'manage') setLeftWorkspace('none');
          }}
          value={drdData}
          onChange={(next) => {
            const nextAnswers = { ...answers, drd: next };
            setAnswers(nextAnswers);
            scheduleSave(nextAnswers, calcDrdCompletionPercent(next));
          }}
          currentAxisId={currentAxisId}
          onAxisChange={(nextAxisId) => {
            if (leftWorkspace === 'manage') setLeftWorkspace('none');
            handleAxisChange(nextAxisId);
          }}
          currentAreaId={currentAreaId}
          onAreaChange={(nextAreaId) => {
            if (leftWorkspace === 'manage') setLeftWorkspace('none');
            handleAreaChange(nextAreaId);
          }}
          currentLevel={currentLevel}
          onLevelChange={(lvl) => {
            if (leftWorkspace === 'manage') setLeftWorkspace('none');
            handleLevelChange(lvl);
          }}
        />
      );
    }

    if (framework === 'siri') {
      const siriData = answers?.siri || {};
      return (
        <SIRIAssessmentEditor
          assessmentId={assessmentId || ''}
          readOnly={isLocked}
          leftOverride={
            leftWorkspace === 'manage' && canManageEffective ? (
              <AssessmentManagePanel
                assessmentId={assessmentId}
                assessmentName={assessment?.name}
                initialTab={manageTab}
                onOpenReport={(reportId) => openReport(reportId)}
                onCreateReport={() => setIsReportTemplatePickerOpen(true)}
              />
            ) : undefined
          }
          value={siriData}
          onChange={(next) => {
            const nextAnswers = { ...answers, siri: next };
            setAnswers(nextAnswers);
            scheduleSave(nextAnswers, calcSiriCompletionPercent(next));
          }}
        />
      );
    }

    if (framework === 'adma') {
      const admaData = answers?.adma || {};
      return (
        <ADMAAssessmentEditor
          assessmentId={assessmentId || ''}
          readOnly={isLocked}
          leftOverride={
            leftWorkspace === 'manage' && canManageEffective ? (
              <AssessmentManagePanel
                assessmentId={assessmentId}
                assessmentName={assessment?.name}
                initialTab={manageTab}
                onOpenReport={(reportId) => openReport(reportId)}
                onCreateReport={() => setIsReportTemplatePickerOpen(true)}
              />
            ) : undefined
          }
          value={admaData}
          onChange={(next) => {
            const nextAnswers = { ...answers, adma: next };
            setAnswers(nextAnswers);
            scheduleSave(nextAnswers, calcAdmaCompletionPercent(next));
          }}
        />
      );
    }

    if (framework === 'cmmi') {
      const cmmiData = answers?.cmmi || { maturityLevel: 1, categories: {}, overallScore: 0 };
      return (
        <CMPracticeForm
          data={cmmiData}
          onChange={(next) => {
            const nextAnswers = { ...answers, cmmi: next };
            setAnswers(nextAnswers);
            scheduleSave(nextAnswers, calcCmmiCompletionPercent(next));
          }}
          readOnly={isLocked}
          showProgress={true}
        />
      );
    }

    if (framework === 'lean') {
      const leanData = answers?.lean || { phase: 'MEASURE', processes: [], workstations: [] };
      return (
        <LeanForm
          data={leanData}
          onChange={(next) => {
            const nextAnswers = { ...answers, lean: next };
            setAnswers(nextAnswers);
            scheduleSave(nextAnswers, calcLeanCompletionPercent(next));
          }}
          readOnly={isLocked}
          showProgress={true}
        />
      );
    }

    return (
      <div className="p-6">
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <div className="text-slate-600 dark:text-slate-300 font-medium mb-1">
            Editor not available yet
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Framework: {framework?.toUpperCase()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950">
      {/* Top Header (compact, ClickUp-like) */}
      <div className="flex flex-col border-b border-slate-200 dark:border-navy-800 bg-white/80 dark:bg-navy-950/70 backdrop-blur">
        {/* Topbar */}
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/assessment/overview')}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200/80 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 hover:bg-slate-50 dark:hover:bg-navy-900 transition-colors"
              aria-label="Back to Assessment"
              type="button"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
            </button>

            <div className="min-w-0">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="truncate">Assessment</span>
                <span className="text-slate-300 dark:text-navy-700">/</span>
                <span className="truncate">{framework?.toUpperCase()}</span>
              </div>

              {/* Title + status */}
              <div className="flex items-center gap-2 min-w-0">
                {isRenaming ? (
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="h-9 w-[min(520px,55vw)] px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-900/40 text-navy-900 dark:text-white text-sm font-semibold"
                    placeholder="Assessment name…"
                    autoFocus
                    onKeyDown={async (e) => {
                      if (e.key === 'Escape') {
                        setIsRenaming(false);
                        setNameDraft(assessment?.name || title);
                      }
                      if (e.key === 'Enter') {
                        const nextName = String(nameDraft || '').trim();
                        if (!nextName || !assessmentId) return;
                        try {
                          await Api.put(`/assessment-workflow-v2/${assessmentId}`, {
                            name: nextName,
                          });
                          setAssessment((prev) =>
                            prev ? ({ ...prev, name: nextName } as any) : prev
                          );
                          toast.success('Name updated');
                          setIsRenaming(false);
                        } catch (err: any) {
                          toast.error(err?.message || 'Failed to update name');
                        }
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsRenaming(true)}
                    className="truncate text-base font-semibold text-navy-900 dark:text-white hover:underline text-left"
                    title="Rename assessment"
                  >
                    {title}
                  </button>
                )}
                <span
                  className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border ${
                    String(status).toUpperCase() === 'APPROVED'
                      ? 'bg-green-100/60 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200/60 dark:border-green-900/30'
                      : String(status).toUpperCase().includes('REVIEW')
                        ? 'bg-amber-100/60 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-900/30'
                        : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-navy-700'
                  }`}
                >
                  {String(status).toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Info button - always visible */}
            <button
              type="button"
              onClick={() => setIsInfoOpen((v) => !v)}
              className="hidden sm:inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-200/80 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-900 transition-colors"
              title="Info"
            >
              <Info className="w-4 h-4" />
              <span>Info</span>
            </button>

            {/* Manage button - only for admin/manager */}
            {canManageEffective && (
              <button
                type="button"
                onClick={() => {
                  setLeftWorkspace((v) => (v === 'manage' ? 'none' : 'manage'));
                }}
                className={`hidden sm:inline-flex items-center gap-2 h-10 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  leftWorkspace === 'manage'
                    ? 'border-purple-200/60 dark:border-purple-900/30 bg-purple-50/70 dark:bg-purple-900/10 text-purple-700 dark:text-purple-200'
                    : 'border-slate-200/80 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-900'
                }`}
                title="Manage assessment"
              >
                <Settings className="w-4 h-4" />
                <span>Manage</span>
              </button>
            )}

            {/* Edit button - behavior depends on permissions */}
            {!isAdminEffective && (
              <button
                type="button"
                onClick={() => {
                  if (canEditEffective) {
                    setIsLocked((v) => !v);
                  } else {
                    setShowRequestAccessModal(true);
                  }
                }}
                className={`hidden sm:inline-flex items-center gap-2 h-10 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  !canEditEffective
                    ? 'border-slate-200/80 dark:border-navy-700 bg-slate-50/70 dark:bg-navy-900/30 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 cursor-pointer'
                    : isLocked
                      ? 'border-slate-200/80 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-900'
                      : 'border-purple-200/60 dark:border-purple-900/30 bg-purple-50/70 dark:bg-purple-900/10 text-purple-700 dark:text-purple-200 hover:bg-purple-100/60 dark:hover:bg-purple-900/20'
                }`}
                title={
                  !canEditEffective
                    ? 'Request edit access'
                    : isLocked
                      ? 'Unlock editing'
                      : 'Lock editing'
                }
              >
                {canEditEffective ? (
                  isLocked ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>{canEditEffective ? (isLocked ? 'Edit' : 'Editing') : 'Edit'}</span>
              </button>
            )}

            {/* Chat button - opens new chat with assessment context */}
            <button
              onClick={handleOpenChat}
              className="hidden sm:inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-200/80 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-900 transition-colors"
              title="Open chat with assessment context"
              type="button"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat</span>
            </button>

            {/* Exit button - always visible */}
            <button
              onClick={handleExitClick}
              disabled={isExiting}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white text-sm font-semibold transition-colors"
              title="Save and exit"
              type="button"
            >
              {isExiting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>Exit</span>
            </button>
          </div>
        </div>

        {/* Subheader (compact) */}
        <div className="px-6 pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {framework === 'drd' && drdPositionLabel && (
                <div className="inline-flex items-center gap-2 text-[11px] px-2 py-1 rounded-lg border border-slate-200/80 dark:border-navy-700 bg-white/60 dark:bg-navy-900/40 text-slate-600 dark:text-slate-300 truncate">
                  <span className="truncate">{drdPositionLabel}</span>
                </div>
              )}
              {editedMeta && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {editedMeta}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {overallProgress > 0 && (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-36 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                    {Math.round(overallProgress)}%
                  </div>
                </div>
              )}
              {framework === 'drd' && drdMetrics && (
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="px-2 py-1 rounded-lg border border-slate-200/80 dark:border-navy-700 bg-white/60 dark:bg-navy-900/40 tabular-nums">
                    Areas {drdMetrics.answeredAreas}/{drdMetrics.totalAreas}
                  </span>
                  <span className="px-2 py-1 rounded-lg border border-slate-200/80 dark:border-navy-700 bg-white/60 dark:bg-navy-900/40 tabular-nums">
                    Axis {drdMetrics.axisProgress.completed}/{drdMetrics.axisProgress.total}
                  </span>
                  <span className="px-2 py-1 rounded-lg border border-slate-200/80 dark:border-navy-700 bg-white/60 dark:bg-navy-900/40 tabular-nums">
                    Path {drdMetrics.stepsDone}/{drdMetrics.stepsTotal}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {isInfoOpen && (
          <div className="px-6 pb-4">
            <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40 p-4 text-sm text-slate-700 dark:text-slate-200">
              {/* Workflow Status Banner */}
              <div className="mb-4 p-3 rounded-lg border border-slate-200/80 dark:border-navy-700 bg-slate-50/50 dark:bg-navy-800/40">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Workflow Status
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          String(status).toUpperCase() === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : String(status).toUpperCase() === 'IN_REVIEW'
                              ? 'bg-amber-500/20 text-amber-300'
                              : String(status).toUpperCase() === 'AWAITING_APPROVAL'
                                ? 'bg-orange-500/20 text-orange-300'
                                : String(status).toUpperCase() === 'REJECTED'
                                  ? 'bg-red-500/20 text-red-300'
                                  : 'bg-slate-500/20 text-slate-300'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            String(status).toUpperCase() === 'APPROVED'
                              ? 'bg-emerald-400'
                              : String(status).toUpperCase() === 'IN_REVIEW'
                                ? 'bg-amber-400'
                                : String(status).toUpperCase() === 'AWAITING_APPROVAL'
                                  ? 'bg-orange-400'
                                  : String(status).toUpperCase() === 'REJECTED'
                                    ? 'bg-red-400'
                                    : 'bg-slate-400'
                          }`}
                        />
                        {String(status).toUpperCase().replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${overallProgress >= 80 ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                      <span>Assessment {overallProgress >= 80 ? 'ready' : `${Math.round(overallProgress)}% complete`}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-x-6 gap-y-2">
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Created
                  </span>
                  <div className="mt-1 text-sm">
                    {assessment?.created_at
                      ? new Date(assessment.created_at).toLocaleString()
                      : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Updated
                  </span>
                  <div className="mt-1 text-sm">
                    {assessment?.updated_at
                      ? new Date(assessment.updated_at).toLocaleString()
                      : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Completion
                  </span>
                  <div className="mt-1 text-sm tabular-nums">{Math.round(overallProgress)}%</div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Mode
                  </span>
                  <div className="mt-1 text-sm">{isLocked ? 'Read-only' : 'Editing enabled'}</div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Confidence
                  </span>
                  <div className="mt-1 text-sm tabular-nums">
                    {calcConfidenceAvgFromCompletion(overallProgress).toFixed(1)} / 5
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Needs work
                  </span>
                  <div className="mt-1 text-sm">
                    {framework === 'drd' ? (
                      <div className="space-y-1">
                        {(chatWorkspaceContext as any)?.entityData?.needsWorkTopAxes?.map(
                          (ax: any) => (
                            <div
                              key={ax.axisId}
                              className="flex items-center justify-between gap-3"
                            >
                              <span className="truncate">{ax.axisName}</span>
                              <span className="tabular-nums text-slate-600 dark:text-slate-300">
                                {ax.percent}%
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">{renderEditor()}</div>

      <ReportTemplatePickerModal
        isOpen={isReportTemplatePickerOpen}
        onClose={() => setIsReportTemplatePickerOpen(false)}
        onSelect={(tpl) => handleStartNewReportFromTemplate(tpl.id)}
        sourceType="ASSESSMENT"
        framework={framework}
        lockFramework={true}
      />

      {/* Initiatives workflow overlay */}
      <InitiativesGenerationWizardModal
        isOpen={isInitiativesWizardOpen}
        onClose={() => setIsInitiativesWizardOpen(false)}
        initialAssessmentId={assessmentId}
        onCompleted={() => {
          // Keep user in-place; Manage panel already shows initiatives table if open.
          toast.success('Initiatives generation completed');
        }}
      />

      {isChatContextOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !chatAttaching && setIsChatContextOpen(false)}
          />
          <div className="relative w-[min(860px,calc(100vw-32px))] max-h-[min(720px,calc(100vh-32px))] overflow-hidden rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-navy-700">
              <div>
                <div className="text-base font-semibold text-navy-900 dark:text-white">
                  Attach context from general chat
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  This will store a reference + last messages in assessment context.
                </div>
              </div>
              <button
                type="button"
                onClick={() => !chatAttaching && setIsChatContextOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-3">
                <input
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Search conversations…"
                  className="flex-1 h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm"
                />
                <button
                  type="button"
                  disabled={!selectedConversationId || chatAttaching}
                  onClick={async () => {
                    if (!assessmentId || !selectedConversationId) return;
                    setChatAttaching(true);
                    try {
                      const convo = await Api.getConversation(selectedConversationId);
                      const messages = Array.isArray(convo?.messages) ? convo.messages : [];
                      const lastMessages = messages.slice(-20).map((m: any) => ({
                        role: m?.role,
                        content: String(m?.content || '').slice(0, 1000),
                        createdAt: m?.created_at || m?.createdAt,
                        messageType: m?.message_type || m?.messageType,
                      }));

                      const nextChatContext = {
                        conversationId: String(convo?.id || selectedConversationId),
                        title: String(convo?.title || ''),
                        attachedAt: new Date().toISOString(),
                        lastMessageAt: convo?.last_message_at || convo?.lastMessageAt || null,
                        messageCount: Number(convo?.message_count || messages.length || 0),
                        lastMessages,
                      };

                      const base = (assessment?.contextSnapshot || {}) as Record<string, any>;
                      // Keep compatibility with initiative-generation prompt builder
                      // (it currently expects `contextSnapshot.chat` to be an array).
                      const nextContextSnapshot = {
                        ...base,
                        chatContext: nextChatContext,
                        chat: lastMessages,
                      };

                      await Api.put(`/assessment-workflow-v2/${assessmentId}`, {
                        contextSnapshot: nextContextSnapshot,
                      });

                      setAssessment((prev) =>
                        prev ? ({ ...prev, contextSnapshot: nextContextSnapshot } as any) : prev
                      );

                      toast.success('Chat context attached');
                      setIsChatContextOpen(false);
                    } catch (e: any) {
                      toast.error(e?.message || 'Failed to attach chat context');
                    } finally {
                      setChatAttaching(false);
                    }
                  }}
                  className="h-10 px-4 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white text-sm font-semibold"
                >
                  {chatAttaching ? 'Attaching…' : 'Attach'}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                <div className="max-h-[420px] overflow-auto">
                  {chatLoading ? (
                    <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading…</div>
                  ) : chatConversations.length === 0 ? (
                    <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                      No conversations found.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-navy-800">
                      {chatConversations.map((c: any) => {
                        const id = String(c?.id || '');
                        const isSelected = id && selectedConversationId === id;
                        return (
                          <button
                            type="button"
                            key={id}
                            onClick={() => setSelectedConversationId(id)}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-900/60 ${
                              isSelected
                                ? 'bg-purple-50 dark:bg-purple-900/10'
                                : 'bg-white dark:bg-navy-950'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-navy-900 dark:text-white">
                                  {String(c?.title || 'Conversation')}
                                </div>
                                <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                                  {String(c?.last_message_preview || '')}
                                </div>
                              </div>
                              <div className="shrink-0 text-[11px] text-slate-400">
                                {c?.message_count ? `${c.message_count} msgs` : ''}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !isExiting && setShowExitConfirm(false)}
          />
          <div className="relative w-[min(420px,calc(100vw-32px))] overflow-hidden rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-navy-700">
              <div className="text-base font-semibold text-navy-900 dark:text-white">
                Exit Assessment
              </div>
              <button
                type="button"
                onClick={() => !isExiting && setShowExitConfirm(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                Do you want to save your changes before exiting?
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleExitWithoutSave}
                  disabled={isExiting}
                  className="flex-1 h-10 px-4 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                >
                  Exit without saving
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndExit}
                  disabled={isExiting}
                  className="flex-1 h-10 px-4 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                >
                  {isExiting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save & Exit</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Access Modal */}
      {showRequestAccessModal && (
        <RequestAccessModal
          assessmentId={assessmentId}
          assessmentName={assessment?.name}
          currentRole={userRole}
          onClose={() => setShowRequestAccessModal(false)}
          onSubmit={async (params) => {
            await requestAccess(params);
            setShowRequestAccessModal(false);
            toast.success('Access request submitted. You will be notified when it is reviewed.');
          }}
        />
      )}
    </div>
  );
};

export default AssessmentSessionEditorView;
