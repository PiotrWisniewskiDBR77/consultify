import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import i18next from "i18next";
import {
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Lightbulb,
  MessageSquare,
  Send,
  Sparkles,
  Target
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { ArtifactPropertiesTable } from "@/components/standard/ArtifactPropertiesTable";
import { statusChipLabel } from "@/components/ui/primitives/chips/EntityStatusChip";
import {
  ARTIFACT_PANEL_CARD_CLASS_DOCKED,
  ArtifactRightPanel
} from "@/components/standard/ArtifactRightPanel";
import { LoadingState } from "@/components/ui/primitives";
import { CONSULTING_TOOL_STANDARD_OUTPUTS } from "@/config/consultingToolsStandard";
import { useToolAI } from "@/hooks/discovery/useToolAI";
import { usePresentationMode } from "@/hooks/usePresentationMode";
import {
  mapToolSessionSyncStatusToLegacySaveState,
  useToolSessionSync
} from "@/hooks/useToolSessionSync";
import { Api } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { useConversationStore } from "@/store/useConversationStore";
import {
  useToolStore
} from "@/store/useToolStore";
import { AppView } from "@/types";
import { formatListDate, formatListDateTime } from "@/utils/listDateFormat";
import { exportToPDF } from "@/utils/pdfExport";
import { getMenu3AiButtonClass } from "../shared/ModuleHub/menu3ActionButtonStyles";
import { EmbeddedView } from "../shared/NModeBlocks";
import { NModeShell } from "../shared/NModeLayout";
import {
  ActivityLogCanvas,
  CommentsCanvas
} from "../shared/NModeSections";
import { countAiCardStatuses, getAiReviewTotal, scrollToAiCards } from "./aiCardGovernance";
import { ToolPhaseAiActions } from "./shared/ToolPhaseAiActions";
import { getToolPhaseAiActions } from "./toolAiActions";
import { ToolCanvas } from "./ToolCanvas";
import {
  computeDynamicSwotOverallReadiness,
  computeDynamicSwotPhaseSummaries,
  computeToolCompletionItems,
  computeToolReviewGaps
} from "./toolCompletion";
import { ToolContextPanel } from "./ToolContextPanel";
import { TeresaSwotProposals } from "./tools/DynamicSWOT/TeresaSwotProposals";
const TOOL_META = {
  "dynamic-swot": {
    name: "Dynamic SWOT",
    namePl: "Dynamiczny SWOT",
    badge: "SWT",
    category: "strategic",
    statusDot: "bg-emerald-400"
  },
  "market-forces": {
    name: "Market Forces",
    namePl: "Si\u0142y Rynkowe",
    badge: "PTR",
    category: "strategic",
    statusDot: "bg-blue-400"
  },
  "growth-paths": {
    name: "Growth Paths",
    namePl: "\u015Acie\u017Cki Wzrostu",
    badge: "ANS",
    category: "strategic",
    statusDot: "bg-primary-400"
  },
  "portfolio-priority": {
    name: "Portfolio Priority",
    namePl: "Priorytetyzacja Portfolio",
    badge: "BCG",
    category: "strategic",
    statusDot: "bg-pink-400"
  },
  "risk-uncertainty": {
    name: "Risk & Uncertainty",
    namePl: "Ryzyko i Niepewno\u015B\u0107",
    badge: "RSK",
    category: "strategic",
    statusDot: "bg-amber-400"
  }
};
const prettifyToolType = (toolType) => toolType.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
const buildToolMeta = (toolType) => {
  const predefined = TOOL_META[toolType];
  if (predefined) return predefined;
  const pretty = prettifyToolType(toolType);
  return {
    name: pretty,
    namePl: pretty,
    badge: pretty.split(" ").map((part) => part[0]).join("").slice(0, 3).toUpperCase(),
    category: "strategic",
    statusDot: "bg-slate-400"
  };
};
const getConsultingJourneyStage = (stepId) => {
  if (!stepId) return "entry";
  if (["mission", "context"].includes(stepId)) return "entry";
  if (["input", "strengths", "weaknesses", "opportunities", "threats"].includes(stepId)) {
    return "conversation";
  }
  if (["outputs", "summary", "results", "reasoning", "prepare", "report", "initiatives"].includes(
    stepId
  )) {
    return "summary";
  }
  if (["insights", "correlations", "swot"].includes(stepId)) return "analysis";
  return "conversation";
};
const statusLabel = (status) => statusChipLabel(status, i18next.t.bind(i18next));
const toolCategoryLabel = (category) => {
  const t = i18next.t.bind(i18next);
  if (category === "operational") return t("discoveryToolsMain.knownToolPreviewV3.categoryOperations", "Operations");
  if (category === "digital") return t("discoveryToolsMain.knownToolPreviewV3.categoryDigital", "Digital");
  if (category === "automation") return i18next.language === "pl" ? "Automatyzacja" : "Automation";
  return t("discoveryToolsMain.knownToolPreviewV3.categoryStrategy", "Strategy");
};
const defaultSessionName = (toolName, isPolish) => `${toolName} \u2014 ${isPolish ? "Sesja" : "Session"}`;
const getPriorityDotClass = (priority) => priority === "high" ? "bg-danger-500" : priority === "low" ? "bg-emerald-500" : "bg-blue-500";
const getPriorityButtonClass = (priority, isActive) => isActive ? priority === "high" ? "border-danger-400/80 text-danger-300 bg-danger-500/20" : priority === "low" ? "border-emerald-400/80 text-emerald-300 bg-emerald-500/20" : "border-indigo-400/70 text-indigo-300 bg-indigo-500/15" : "border-slate-300/55 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 hover:border-slate-400/70 hover:text-slate-700 dark:hover:text-slate-300";
const getPriorityLabel = (priority) => priority === "high" ? "High" : priority === "low" ? "Low" : "Normal";
const getPriorityHint = (priority, t) => priority === "high" ? t("discoveryToolsMain.toolDocumentView.priorityHintHigh") : priority === "low" ? t("discoveryToolsMain.toolDocumentView.priorityHintLow") : t("discoveryToolsMain.toolDocumentView.priorityHintNormal");
const ToolDocumentView = ({
  toolType,
  sessionId,
  onBack,
  onOpenInitiative,
  autoExportPdf,
  onAutoExportPdfConsumed,
  onCommandRowActionsChange
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === "pl";
  const {
    currentOrganization,
    currentProjectId,
    isChatCollapsed,
    toggleChatCollapse,
    activeChatMessages
  } = useAppStore();
  const { updateWorkspaceFromView } = useConversationStore();
  const { mode, setMode } = usePresentationMode({ entityType: "tool", syncURL: false });
  const {
    currentSession,
    currentStep,
    createSession,
    setCurrentStep,
    nextStep,
    prevStep,
    canAdvanceStep,
    calculateProgress,
    getStepDefinitions,
    hydrateSessionFromApi,
    acceptCard,
    rejectCard
  } = useToolStore();
  const {
    isStreaming,
    streamedContent,
    error: toolAiError,
    generateFullSession,
    runPhaseAiAction,
    phaseAiActions,
    activeAiActionId,
    missionSuggestion,
    applyMissionSuggestion,
    dismissMissionSuggestion,
    rethinkCard,
    abortStream
  } = useToolAI({ toolType });
  const isStrategicPhaseTool = [
    "dynamic-swot",
    "market-forces",
    "growth-paths",
    "portfolio-priority",
    "risk-uncertainty"
  ].includes(toolType);
  const toolMeta = buildToolMeta(toolType);
  const stepDefs = getStepDefinitions();
  const currentStepDef = stepDefs[currentStep - 1];
  const progress = calculateProgress();
  const [toolSessionId, setToolSessionId] = useState(sessionId || null);
  const [toolStatus, setToolStatus] = useState("DRAFT");
  const [sessionName, setSessionName] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [lastModified, setLastModified] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [activeSection, setActiveSection] = useState(
    isStrategicPhaseTool ? "mission" : "work"
  );
  const explicitStrategicSectionRef = useRef(null);
  const [commandRowPortalTarget, setCommandRowPortalTarget] = useState(null);
  const [showRequestReviewModal, setShowRequestReviewModal] = useState(false);
  const [showTeresaProposals, setShowTeresaProposals] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [generatedInitiatives, setGeneratedInitiatives] = useState([]);
  const [toolDecisions, setToolDecisions] = useState([]);
  const [toolPermissions, setToolPermissions] = useState({});
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [toolBacklinks, setToolBacklinks] = useState([]);
  const [toolBacklinksLoading, setToolBacklinksLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [reviewDueDate, setReviewDueDate] = useState("");
  const [reviewPriority, setReviewPriority] = useState(
    "medium"
  );
  const [reviewDecisionOwnerId, setReviewDecisionOwnerId] = useState("");
  const [generationDefaults, setGenerationDefaults] = useState({
    methodologyId: "impact-feasibility",
    count: 3,
    includeChatContext: true
  });
  const [commentDraft, setCommentDraft] = useState("");
  const [commentDateFilter, setCommentDateFilter] = useState("all");
  const [commentSortOrder, setCommentSortOrder] = useState("desc");
  const [draftPriority, setDraftPriority] = useState("normal");
  useEffect(() => {
    if (mode !== "n") setMode("n");
  }, [mode, setMode]);
  const reviewGaps = useMemo(
    () => computeToolReviewGaps(toolType, currentSession?.inputData, isPolish),
    [toolType, currentSession?.inputData, isPolish]
  );
  const completionItems = useMemo(
    () => computeToolCompletionItems(toolType, currentSession?.inputData, isPolish),
    [toolType, currentSession?.inputData, isPolish]
  );
  const aiReviewCount = useMemo(
    () => getAiReviewTotal(countAiCardStatuses(currentSession?.inputData)),
    [currentSession?.inputData]
  );
  const completionReady = reviewGaps.length === 0;
  const confidenceAvg = useMemo(() => {
    if (!currentSession) return 1;
    if (completionReady) return 4;
    return Math.max(1, Math.min(5, Math.round(progress / 20)));
  }, [completionReady, currentSession, progress]);
  const missingItemsPayload = useMemo(
    () => reviewGaps.map((gap, index) => ({
      id: `${toolType}-gap-${index + 1}`,
      label: gap,
      severity: "blocker",
      stepId: currentStepDef?.id || "review",
      resolved: false
    })),
    [currentStepDef?.id, reviewGaps, toolType]
  );
  const wizardStatePayload = useMemo(
    () => ({
      sessionId: toolSessionId || sessionId || "",
      toolType,
      status: toolStatus === "REVIEW" ? "REVIEW" : ["APPROVED", "GENERATED", "COMPLETED", "FINALIZED"].includes(toolStatus) ? "FINALIZED" : "IN_PROGRESS",
      currentStep: currentStepDef?.id || "context",
      locked: ["APPROVED", "GENERATED", "COMPLETED", "FINALIZED"].includes(toolStatus),
      review: {
        missingItems: missingItemsPayload
      }
    }),
    [currentStepDef?.id, missingItemsPayload, sessionId, toolSessionId, toolStatus, toolType]
  );
  const toolSync = useToolSessionSync({
    toolId: toolSessionId,
    getExtraPayload: () => ({
      completionPercent: completionReady ? 100 : progress,
      confidenceAvg,
      missingItems: missingItemsPayload,
      wizardState: wizardStatePayload
    }),
    onRecoveryDiscarded: () => {
      toast(
        t(
          "discoveryToolsMain.toolDocumentView.recoveryDraftDiscarded",
          "A local unsynced draft was discarded \u2014 the server already had newer data."
        )
      );
    },
    // toolSyncRef (declared right below) is populated on every render
    // before this can ever fire -- it only runs from inside load(), which
    // this component triggers itself (fetchAll -> toolSync.load()) no
    // earlier than its own first effect pass.
    onRecoveryAvailable: (_draftData, draftSavedAt) => {
      toast.custom(
        (tst) => /* @__PURE__ */ jsx(
          "div",
          {
            className: `${tst.visible ? "animate-enter" : "animate-leave"} max-w-md w-full bg-c-surface-raised shadow-xl rounded-xl pointer-events-auto ring-1 ring-c-border overflow-hidden`,
            children: /* @__PURE__ */ jsxs("div", { className: "p-4", children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-c-text", children: t(
                "discoveryToolsMain.toolDocumentView.recoveryDraftAvailable",
                "Unsynced local changes from a previous session were found."
              ) }),
              /* @__PURE__ */ jsx("p", { className: "text-xs text-c-text-secondary mt-0.5", children: t(
                "discoveryToolsMain.toolDocumentView.recoveryDraftSavedAt",
                "Saved locally at {{time}}",
                {
                  // Odbiór 2026-08-30 (przegląd modułów 04/11/16):
                  // `toLocaleString()` bez argumentu bierze locale z
                  // przeglądarki — patrz `src/utils/listDateFormat.ts` (SSOT).
                  time: formatListDateTime(draftSavedAt)
                }
              ) }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 mt-2", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => {
                      toast.dismiss(tst.id);
                      toolSyncRef.current?.applyRecoveryDraft();
                    },
                    className: "text-xs font-medium text-c-text underline underline-offset-2 hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]",
                    children: t("discoveryToolsMain.toolDocumentView.recoveryDraftRecover", "Recover")
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => {
                      toast.dismiss(tst.id);
                      toolSyncRef.current?.discardRecoveryDraft();
                    },
                    className: "text-xs text-c-text-secondary hover:text-c-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]",
                    children: t("discoveryToolsMain.toolDocumentView.recoveryDraftDiscardAction", "Discard")
                  }
                )
              ] })
            ] })
          }
        ),
        {
          duration: 15e3,
          // React StrictMode may run the initial load effect twice in development.
          // A stable, session-scoped id makes react-hot-toast update the existing
          // recovery prompt instead of rendering two contradictory actions for
          // the same draft.
          id: `tool-session-recovery-${toolSessionId || "pending"}`
        }
      );
    }
  });
  const toolSyncRef = useRef(toolSync);
  toolSyncRef.current = toolSync;
  const swotData = useMemo(
    () => toolType === "dynamic-swot" ? currentSession?.inputData : void 0,
    [currentSession?.inputData, toolType]
  );
  const effectivePhaseAiActions = useMemo(() => {
    if (phaseAiActions.length > 0) return phaseAiActions;
    return getToolPhaseAiActions(toolType, currentStepDef);
  }, [currentStepDef, phaseAiActions, toolType]);
  const dynamicSwotPhaseSummaries = useMemo(
    () => toolType === "dynamic-swot" ? computeDynamicSwotPhaseSummaries(swotData, isPolish) : [],
    [isPolish, swotData, toolType]
  );
  const dynamicSwotReadiness = useMemo(
    () => toolType === "dynamic-swot" ? computeDynamicSwotOverallReadiness(swotData, isPolish) : null,
    [isPolish, swotData, toolType]
  );
  const consultingJourneyStage = useMemo(
    () => getConsultingJourneyStage(currentStepDef?.id),
    [currentStepDef?.id]
  );
  useEffect(() => {
    if (!isStrategicPhaseTool) return;
    if (explicitStrategicSectionRef.current === activeSection) {
      explicitStrategicSectionRef.current = null;
      return;
    }
    if (currentStepDef?.id && activeSection !== currentStepDef.id) {
      setActiveSection(currentStepDef.id);
    }
  }, [activeSection, currentStepDef?.id, isStrategicPhaseTool]);
  const handleExportPdf = useCallback(async () => {
    try {
      setIsExportingPdf(true);
      const safeName = (sessionName || toolMeta.name).replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
      const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      await exportToPDF("tool-report-export", {
        filename: `tool-report-${toolType}-${safeName}-${date}.pdf`,
        title: `${toolMeta.name} \u2022 Tool Report`,
        orientation: "portrait"
      });
      toast.success(t("discoveryToolsMain.toolDocumentView.pDFExported"));
    } catch {
      toast.error(t("discoveryToolsMain.toolDocumentView.pDFExportFailed"));
    } finally {
      setIsExportingPdf(false);
    }
  }, [isPolish, sessionName, toolMeta.name, toolType]);
  const autoExportRanRef = useRef(false);
  const hydratedSessionObjectRef = useRef(null);
  useEffect(() => {
    if (!autoExportPdf) {
      autoExportRanRef.current = false;
      return;
    }
    if (loading || isExportingPdf || autoExportRanRef.current) return;
    autoExportRanRef.current = true;
    void handleExportPdf().finally(() => onAutoExportPdfConsumed?.());
  }, [autoExportPdf, handleExportPdf, isExportingPdf, loading, onAutoExportPdfConsumed]);
  const fetchAll = useCallback(async () => {
    if (!toolSessionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const sessionData = await toolSync.load();
      if (!sessionData) {
        toast.error(t("discoveryToolsMain.toolDocumentView.failedToLoadSession"));
        return;
      }
      setToolStatus((sessionData.status || "DRAFT").toUpperCase());
      setSessionName(sessionData.name || "");
      setCreatedAt(sessionData.createdAt || "");
      setLastModified(sessionData.updatedAt || "");
      setGeneratedInitiatives(
        (sessionData.generatedInitiatives || []).map((initiative) => ({
          ...initiative,
          title: initiative.title || initiative.id
        }))
      );
      setToolDecisions(sessionData.decisions || []);
      setToolPermissions(sessionData.permissions || {});
      hydrateSessionFromApi({
        id: toolSessionId,
        toolType,
        name: sessionData.name,
        createdAt: sessionData.createdAt,
        updatedAt: sessionData.updatedAt,
        status: sessionData.status,
        answers: sessionData.answers || {},
        completionPercent: typeof sessionData.completion_percent === "number" ? sessionData.completion_percent : sessionData.completionPercent,
        wizardState: sessionData.wizardState ?? null
      });
      hydratedSessionObjectRef.current = useToolStore.getState().currentSession;
      const fetchedUsers = await Api.getUsers();
      setUsers(fetchedUsers || []);
      try {
        const commentsRes = await Api.get(`/api/tools/${toolSessionId}/comments`);
        setComments(commentsRes || []);
      } catch {
        setComments([]);
      }
      try {
        const historyRes = await Api.get(`/api/tools/${toolSessionId}/history`);
        setHistory(historyRes || []);
      } catch {
        setHistory([]);
      }
    } catch (error) {
      console.error("Failed to fetch tool session:", error);
      toast.error(t("discoveryToolsMain.toolDocumentView.failedToLoadSession"));
    } finally {
      setLoading(false);
    }
  }, [hydrateSessionFromApi, isPolish, toolSessionId, toolSync.load, toolType]);
  useEffect(() => {
    if (!toolSessionId) return;
    setToolBacklinksLoading(true);
    Api.getLinkGraphBacklinks({ type: "tool_session", id: toolSessionId, limit: 50 }).then((rows) => {
      setToolBacklinks(
        (Array.isArray(rows) ? rows : []).map((row) => ({
          id: String(row?.id || ""),
          sourceType: String(row?.sourceType || ""),
          sourceId: String(row?.sourceId || "")
        })).filter((row) => row.sourceType && row.sourceId)
      );
    }).catch(() => setToolBacklinks([])).finally(() => setToolBacklinksLoading(false));
  }, [toolSessionId]);
  const createSessionInFlightRef = useRef(false);
  useEffect(() => {
    const initSession = async () => {
      if (sessionId) {
        setToolSessionId(sessionId);
        return;
      }
      if (createSessionInFlightRef.current) return;
      if (!currentSession || currentSession.toolType !== toolType) {
        createSessionInFlightRef.current = true;
        createSession(toolType);
        const name = defaultSessionName(toolMeta.name, isPolish);
        try {
          const createdId = await toolSync.create({
            toolType,
            name,
            projectId: currentProjectId || null
          });
          setToolSessionId(createdId);
          setSessionName(name);
          setToolStatus("DRAFT");
          setLastModified((/* @__PURE__ */ new Date()).toISOString());
        } catch (error) {
          console.error("Failed to create tool session:", error);
          toast.error(t("discoveryToolsMain.toolDocumentView.failedToCreateSession"));
          createSessionInFlightRef.current = false;
        }
      }
    };
    void initSession();
  }, [
    createSession,
    currentProjectId,
    currentSession,
    isPolish,
    sessionId,
    toolMeta.name,
    toolSync.create,
    toolType
  ]);
  useEffect(() => {
    if (toolSessionId) void fetchAll();
  }, [fetchAll, toolSessionId]);
  const isSessionHydrated = Boolean(
    currentSession && toolSessionId && currentSession.id === toolSessionId
  );
  useEffect(() => {
    if (!currentSession || !toolSessionId) return;
    if (!isSessionHydrated) return;
    if (currentSession === hydratedSessionObjectRef.current) return;
    toolSync.setData(currentSession.inputData);
  }, [currentSession, isSessionHydrated, toolSessionId, toolSync.setData]);
  useEffect(() => {
    if (toolSync.session?.updatedAt) setLastModified(toolSync.session.updatedAt);
  }, [toolSync.session]);
  const saveState = mapToolSessionSyncStatusToLegacySaveState(toolSync.status);
  const handleReconcileConflict = useCallback(async () => {
    await toolSync.reconcile();
    if (toolSessionId) void fetchAll();
  }, [fetchAll, toolSessionId, toolSync.reconcile]);
  const showConflictToast = useCallback(() => {
    toast.custom(
      (tst) => /* @__PURE__ */ jsx(
        "div",
        {
          className: `${tst.visible ? "animate-enter" : "animate-leave"} max-w-md w-full bg-c-surface-raised shadow-xl rounded-xl pointer-events-auto ring-1 ring-c-border overflow-hidden`,
          children: /* @__PURE__ */ jsx("div", { className: "p-4 flex items-start gap-3", children: /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-c-text", children: t(
              "discoveryToolsMain.toolDocumentView.saveConflict",
              "Could not save \u2014 this session changed on the server."
            ) }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => {
                  toast.dismiss(tst.id);
                  void handleReconcileConflict();
                },
                className: "mt-2 text-xs font-medium text-c-text underline underline-offset-2 hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]",
                children: t("discoveryToolsMain.toolDocumentView.saveConflictReload", "Reload from server")
              }
            )
          ] }) })
        }
      ),
      { duration: 8e3 }
    );
  }, [handleReconcileConflict, t]);
  const handleSave = async () => {
    if (!toolSessionId || !currentSession) return;
    if (!isSessionHydrated) {
      toast.error(
        t("tools.session.notLoadedYet", "Session is still loading \u2014 try again in a moment")
      );
      return;
    }
    setSaving(true);
    try {
      const outcome = await toolSync.flush();
      if (outcome === "saved") {
        toast.success(t("discoveryToolsMain.toolDocumentView.saved"));
      } else if (outcome === "conflict") {
        showConflictToast();
      } else if (outcome === "offline") {
        toast.error(
          t(
            "discoveryToolsMain.toolDocumentView.saveOffline",
            "You are offline \u2014 this change is saved locally and will sync automatically."
          )
        );
      } else {
        toast.error(t("discoveryToolsMain.toolDocumentView.saveFailed"));
      }
    } finally {
      setSaving(false);
    }
  };
  const handleOpenChat = () => {
    updateWorkspaceFromView(AppView.DISCOVERY_TOOLS_STRATEGIC, toolSessionId || void 0, {
      toolType,
      sessionName
    });
    if (isChatCollapsed) toggleChatCollapse();
  };
  const handleRequestReview = async () => {
    if (!toolSessionId || !completionReady) {
      toast.error(t("discoveryToolsMain.toolDocumentView.completeAllRequiredItemsFirst"));
      return;
    }
    setShowRequestReviewModal(true);
  };
  const handleConfirmRequestReview = async () => {
    if (!toolSessionId) return;
    try {
      const result = await Api.requestToolReview(toolSessionId, {
        decisionOwnerId: reviewDecisionOwnerId || void 0,
        dueDate: reviewDueDate || void 0,
        priority: reviewPriority
      });
      setToolStatus((result.status || "REVIEW").toUpperCase());
      toast.success(t("discoveryToolsMain.toolDocumentView.sentToReview"));
      setShowRequestReviewModal(false);
      setReviewDecisionOwnerId("");
      setReviewDueDate("");
      setReviewPriority("medium");
      await fetchAll();
    } catch (err) {
      toast.error(err?.message || "Failed to request review");
    }
  };
  const handleApprove = async () => {
    if (!toolSessionId) return;
    if (!completionReady) {
      toast.error(t("discoveryToolsMain.toolDocumentView.completeAllRequiredItemsFirst"));
      return;
    }
    try {
      const result = await Api.approveTool(toolSessionId);
      setToolStatus((result.status || "APPROVED").toUpperCase());
      toast.success(t("discoveryToolsMain.toolDocumentView.approved"));
      await fetchAll();
    } catch (err) {
      toast.error(err?.message || "Failed to approve");
    }
  };
  const handleSendBack = async () => {
    if (!toolSessionId) return;
    const reason = prompt(t("discoveryToolsMain.toolDocumentView.reasonForSendingBack"));
    if (!reason) return;
    try {
      const result = await Api.sendToolBackToDraft(toolSessionId, reason);
      setToolStatus((result.status || "DRAFT").toUpperCase());
      toast.success(t("discoveryToolsMain.toolDocumentView.sentBackToDraft"));
      await fetchAll();
    } catch (err) {
      toast.error(err?.message || "Failed to send back");
    }
  };
  const handleGenerateAI = async () => {
    const primaryAction = phaseAiActions[0];
    if (!primaryAction) return;
    setIsGeneratingAI(true);
    try {
      await runPhaseAiAction(primaryAction.id);
      toast.success(t("discoveryToolsMain.toolDocumentView.aIGenerationFinished"));
    } catch {
      toast.error(t("discoveryToolsMain.toolDocumentView.aIGenerationFailed"));
    } finally {
      setIsGeneratingAI(false);
    }
  };
  const handleAddComment = async (content) => {
    if (!toolSessionId || !content.trim()) return false;
    try {
      await Api.post(`/api/tools/${toolSessionId}/comments`, { content: content.trim() });
      const updated = await Api.get(`/api/tools/${toolSessionId}/comments`);
      setComments(updated || []);
      toast.success(t("discoveryToolsMain.toolDocumentView.commentAdded"));
      return true;
    } catch {
      toast.error(t("discoveryToolsMain.toolDocumentView.failedToAddComment"));
      return false;
    }
  };
  const handleDeleteComment = async (commentId) => {
    if (!toolSessionId) return;
    try {
      await Api.delete(`/api/tools/${toolSessionId}/comments/${commentId}`);
      const updated = await Api.get(`/api/tools/${toolSessionId}/comments`);
      setComments(updated || []);
      toast.success(t("discoveryToolsMain.toolDocumentView.commentDeleted"));
    } catch {
      toast.error(t("discoveryToolsMain.toolDocumentView.failedToDeleteComment"));
    }
  };
  const nModeComments = useMemo(
    () => comments.filter((comment) => {
      if (commentDateFilter === "all") return true;
      const date = new Date(comment.createdAt);
      const now = /* @__PURE__ */ new Date();
      if (commentDateFilter === "today") return date.toDateString() === now.toDateString();
      if (commentDateFilter === "7d") return now.getTime() - date.getTime() < 7 * 864e5;
      if (commentDateFilter === "30d") return now.getTime() - date.getTime() < 30 * 864e5;
      return true;
    }).sort(
      (a, b) => commentSortOrder === "desc" ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ).map((comment) => ({
      id: comment.id,
      authorName: comment.authorName || comment.author_name || "User",
      content: comment.content || comment.text || "",
      createdAt: comment.createdAt || comment.created_at || (/* @__PURE__ */ new Date()).toISOString(),
      isAIGenerated: comment.authorId === "ai-assistant",
      priority: "normal"
    })),
    [commentDateFilter, commentSortOrder, comments]
  );
  const activityEntries = useMemo(
    () => history.map((entry) => ({
      id: entry.id,
      type: entry.eventType,
      description: entry.eventType,
      timestamp: entry.createdAt,
      userName: entry.actorName,
      oldValue: entry.payload?.oldValue ? String(entry.payload.oldValue) : void 0,
      newValue: entry.payload?.newValue ? String(entry.payload.newValue) : void 0
    })),
    [history]
  );
  const activityStats = useMemo(() => {
    const total = history.length;
    const edited = history.filter((entry) => entry.eventType.includes("edit")).length;
    const escalations = history.filter((entry) => entry.eventType.includes("review")).length;
    const collaboration = history.filter(
      (entry) => entry.eventType.includes("comment") || entry.eventType.includes("share")
    ).length;
    return { total, edited, escalations, collaboration };
  }, [history]);
  const activityTypeMeta = useCallback(
    (type) => {
      const map = {
        created: {
          icon: /* @__PURE__ */ jsx(CheckCircle2, { size: 10 }),
          label: t("discoveryToolsMain.toolDocumentView.created"),
          style: "border-emerald-300/50 bg-emerald-500/10 text-emerald-600"
        },
        comment: {
          icon: /* @__PURE__ */ jsx(MessageSquare, { size: 10 }),
          label: t("discoveryToolsMain.toolDocumentView.comment"),
          style: "border-amber-300/50 bg-amber-500/10 text-amber-600"
        },
        review_requested: {
          icon: /* @__PURE__ */ jsx(Send, { size: 10 }),
          label: t("discoveryToolsMain.toolDocumentView.review"),
          style: "border-blue-300/50 bg-blue-500/10 text-blue-600"
        }
      };
      return map[type] || {
        icon: /* @__PURE__ */ jsx(Clock, { size: 10 }),
        label: type,
        style: "border-slate-300/50 bg-slate-500/10 text-slate-600"
      };
    },
    [isPolish]
  );
  const properties = useMemo(
    () => [
      {
        id: "toolType",
        label: { en: "Tool type", pl: "Typ narz\u0119dzia" },
        type: "text",
        value: toolType,
        onChange: () => {
        },
        readOnly: true
      },
      {
        id: "category",
        label: { en: "Category", pl: "Kategoria" },
        type: "text",
        value: toolCategoryLabel(toolMeta.category),
        onChange: () => {
        },
        readOnly: true
      },
      {
        id: "status",
        label: { en: "Status", pl: "Status" },
        type: "text",
        value: statusLabel(toolStatus),
        onChange: () => {
        },
        readOnly: true
      },
      {
        id: "runtimeStage",
        label: { en: "Consulting stage", pl: "Etap konsultingowy" },
        type: "text",
        value: {
          entry: t("discoveryToolsMain.toolDocumentView.entryPurpose"),
          conversation: t("discoveryToolsMain.toolDocumentView.conversationCapture"),
          analysis: t("discoveryToolsMain.toolDocumentView.analysis"),
          summary: t("discoveryToolsMain.toolDocumentView.conclusionsSummary")
        }[consultingJourneyStage] || consultingJourneyStage,
        onChange: () => {
        },
        readOnly: true
      },
      {
        id: "currentStep",
        label: { en: "Current step", pl: "Aktualny krok" },
        type: "text",
        value: currentStepDef ? isPolish ? currentStepDef.namePl : currentStepDef.name : "-",
        onChange: () => {
        },
        readOnly: true
      },
      {
        id: "progress",
        label: { en: "Progress", pl: "Post\u0119p" },
        type: "text",
        value: `${progress}%`,
        onChange: () => {
        },
        readOnly: true
      }
    ],
    [
      consultingJourneyStage,
      currentStepDef,
      isPolish,
      progress,
      toolMeta.category,
      toolStatus,
      toolType
    ]
  );
  const sections = useMemo(() => {
    const renderDynamicSwotPhaseOverview = () => /* @__PURE__ */ jsxs("div", { className: "space-y-3", "data-testid": "dynamic-swot-phase-overview", children: [
      dynamicSwotReadiness ? /* @__PURE__ */ jsx("div", { className: "flex justify-end", children: /* @__PURE__ */ jsx(
        "span",
        {
          "data-testid": "dynamic-swot-readiness-badge",
          className: `rounded-full border px-3 py-1 text-[11px] font-medium ${dynamicSwotReadiness.readiness === "ready" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300" : dynamicSwotReadiness.readiness === "needs-work" ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300" : "border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300"}`,
          children: dynamicSwotReadiness.label
        }
      ) }) : null,
      /* @__PURE__ */ jsx("div", { className: "grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3", children: dynamicSwotPhaseSummaries.map((phase, index) => {
        const isActive = activeSection === phase.id;
        return /* @__PURE__ */ jsxs(
          "button",
          {
            "data-testid": "dynamic-swot-phase-tile",
            "data-phase-id": phase.id,
            type: "button",
            "aria-current": isActive ? "step" : void 0,
            onClick: () => {
              explicitStrategicSectionRef.current = phase.id;
              setCurrentStep(index + 1);
              setActiveSection(phase.id);
            },
            className: `c-focus rounded-2xl border px-4 py-3 text-left transition ${isActive ? "border-slate-400 bg-slate-100 shadow-sm dark:border-navy-500 dark:bg-navy-800/80" : phase.readiness === "ready" ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/10" : phase.readiness === "needs-work" ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/10" : "border-slate-200 bg-white dark:border-navy-700 dark:bg-navy-900/60"}`,
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[11px] uppercase tracking-[0.16em] text-slate-600 dark:text-slate-500", children: index + 1 }),
                phase.done ? /* @__PURE__ */ jsx(Check, { size: 12, className: "text-emerald-500" }) : /* @__PURE__ */ jsx("span", { className: "text-[11px] text-slate-600", children: phase.gapCount })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100", children: phase.label }),
              /* @__PURE__ */ jsx("div", { className: "mt-1 text-xs text-slate-500 dark:text-slate-400", children: phase.primaryGap || (phase.done ? t("discoveryToolsMain.toolDocumentView.readyStatus") : t("discoveryToolsMain.toolDocumentView.needsWorkStatus")) })
            ]
          },
          phase.id
        );
      }) })
    ] });
    const workSection = /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
      /* @__PURE__ */ jsx("div", { className: "rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx("div", { className: "text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-500", children: t("discoveryToolsMain.toolDocumentView.visibleHumanAILoop") }),
          /* @__PURE__ */ jsx("div", { className: "text-sm text-slate-700 dark:text-slate-300", children: t("discoveryToolsMain.toolDocumentView.sessionVisibilityDescription") })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
          CONSULTING_TOOL_STANDARD_OUTPUTS.map((outputType) => /* @__PURE__ */ jsx(
            "span",
            {
              className: "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600 dark:border-navy-700 dark:bg-navy-900/70 dark:text-slate-300",
              children: outputType
            },
            outputType
          )),
          toolType === "dynamic-swot" && dynamicSwotReadiness && /* @__PURE__ */ jsx(
            "span",
            {
              className: `rounded-full border px-3 py-1 text-[11px] font-medium ${dynamicSwotReadiness.readiness === "ready" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300" : dynamicSwotReadiness.readiness === "needs-work" ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300" : "border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300"}`,
              children: dynamicSwotReadiness.label
            }
          )
        ] })
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "flex items-start justify-between gap-4", children: /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-[11px] uppercase tracking-[0.16em] text-slate-600 dark:text-slate-500", children: [
          t("discoveryToolsMain.toolDocumentView.currentStage"),
          ":",
          " ",
          {
            entry: t("discoveryToolsMain.toolDocumentView.entryPurpose"),
            conversation: t("discoveryToolsMain.toolDocumentView.conversationCapture"),
            analysis: t("discoveryToolsMain.toolDocumentView.analysisBenchmarking"),
            summary: t("discoveryToolsMain.toolDocumentView.conclusionsFinalSummary")
          }[consultingJourneyStage]
        ] }),
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-slate-800 dark:text-slate-100", children: currentStepDef ? isPolish ? currentStepDef.namePl : currentStepDef.name : toolMeta.name }),
        currentStepDef && /* @__PURE__ */ jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400", children: isPolish ? currentStepDef.descriptionPl : currentStepDef.description })
      ] }) }),
      toolType === "dynamic-swot" ? renderDynamicSwotPhaseOverview() : /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: stepDefs.map((step, index) => {
        const stepNum = index + 1;
        const isCompleted = currentSession?.steps?.some(
          (sessionStep) => sessionStep.stepId === step.id && sessionStep.status === "completed"
        );
        const isActive = currentStep === stepNum;
        return /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => setCurrentStep(stepNum),
            className: `inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors ${isActive ? "bg-primary-500/15 text-primary-700 dark:text-primary-300" : isCompleted ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 dark:bg-navy-900/70 text-slate-500 dark:text-slate-400"}`,
            children: [
              isCompleted ? /* @__PURE__ */ jsx(Check, { size: 12 }) : /* @__PURE__ */ jsx("span", { className: "inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200/80 dark:bg-navy-800 text-[10px]", children: stepNum }),
              /* @__PURE__ */ jsx("span", { children: isPolish ? step.namePl : step.name })
            ]
          },
          step.id
        );
      }) }),
      /* @__PURE__ */ jsx("div", { className: "rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4", children: currentSession ? /* @__PURE__ */ jsx(
        ToolCanvas,
        {
          toolType,
          currentStep,
          stepDefinition: currentStepDef,
          session: currentSession,
          isStreaming,
          streamedContent: streamedContent || "",
          isPolish,
          onOpenChat: handleOpenChat,
          generatedInitiatives,
          onContinue: () => setCurrentStep(Math.min(stepDefs.length, currentStep + 1)),
          missionSuggestion,
          onApplyMissionSuggestion: applyMissionSuggestion,
          onDismissMissionSuggestion: dismissMissionSuggestion,
          onAcceptCard: acceptCard,
          onRejectCard: rejectCard,
          onRethinkCard: (cardType, cardId, comment) => {
            const phaseId = stepDefs[currentStep - 1]?.id || "mission";
            rethinkCard(phaseId, cardType, cardId, comment);
          }
        }
      ) : /* @__PURE__ */ jsx("div", { className: "py-10 text-center text-sm text-slate-500 dark:text-slate-400", children: t("discoveryToolsMain.toolDocumentView.noSessionData") }) }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between pt-2", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => prevStep(),
            disabled: currentStep <= 1,
            className: "rounded-lg bg-slate-100 dark:bg-navy-900/70 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 disabled:opacity-50",
            children: t("discoveryToolsMain.toolDocumentView.previous")
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "text-xs text-slate-500 dark:text-slate-400", children: [
          t("discoveryToolsMain.toolDocumentView.step"),
          " ",
          currentStep,
          "/",
          stepDefs.length
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => nextStep(),
            disabled: currentStep >= stepDefs.length || !canAdvanceStep(),
            className: "rounded-lg bg-navy-900 px-3 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50",
            children: t("discoveryToolsMain.toolDocumentView.next")
          }
        )
      ] })
    ] });
    const reviewSection = /* @__PURE__ */ jsxs("div", { className: "space-y-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-slate-800 dark:text-slate-100", children: t("discoveryToolsMain.toolDocumentView.appliedConclusionsReadiness") }),
        /* @__PURE__ */ jsxs("div", { className: "rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4 space-y-4", children: [
          /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-navy-700/70 dark:bg-navy-950/30 dark:text-slate-300", children: t("discoveryToolsMain.toolDocumentView.appliedConclusionsSectionDescription") }),
          /* @__PURE__ */ jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { className: "text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500", children: t("discoveryToolsMain.toolDocumentView.status") }),
              /* @__PURE__ */ jsx("div", { className: "mt-1 text-sm text-slate-700 dark:text-slate-300", children: statusLabel(toolStatus) })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { className: "text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500", children: t("discoveryToolsMain.toolDocumentView.progress") }),
              /* @__PURE__ */ jsxs("div", { className: "mt-1 text-sm text-slate-700 dark:text-slate-300", children: [
                progress,
                "%"
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { className: "text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500", children: t("discoveryToolsMain.toolDocumentView.created2") }),
              /* @__PURE__ */ jsx("div", { className: "mt-1 text-sm text-slate-700 dark:text-slate-300", children: formatListDate(createdAt) })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { className: "text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500", children: t("discoveryToolsMain.toolDocumentView.lastModified") }),
              /* @__PURE__ */ jsx("div", { className: "mt-1 text-sm text-slate-700 dark:text-slate-300", children: formatListDateTime(lastModified) })
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "space-y-2", children: completionItems.map((item, index) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-sm", children: [
            /* @__PURE__ */ jsx(
              "span",
              {
                className: `h-2 w-2 rounded-full ${item.done ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`
              }
            ),
            /* @__PURE__ */ jsx(
              "span",
              {
                className: item.done ? "text-slate-700 dark:text-slate-300" : "text-slate-500 dark:text-slate-400",
                children: item.label
              }
            )
          ] }, `${item.label}-${index}`)) }),
          toolType === "dynamic-swot" && (swotData?.summary?.appliedConclusions?.length || 0) > 0 && /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-emerald-200/80 bg-emerald-500/5 px-4 py-3", children: [
            /* @__PURE__ */ jsx("div", { className: "mb-2 text-sm font-medium text-emerald-700 dark:text-emerald-300", children: t("discoveryToolsMain.toolDocumentView.appliedConclusions") }),
            /* @__PURE__ */ jsx("ul", { className: "space-y-1 text-sm text-slate-600 dark:text-slate-300", children: swotData?.summary?.appliedConclusions?.map((conclusion, index) => /* @__PURE__ */ jsxs("li", { children: [
              "\u2022 ",
              conclusion
            ] }, `${conclusion}-${index}`)) })
          ] }),
          toolType === "dynamic-swot" && swotData?.summary?.executiveSummary && /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 dark:border-navy-700/70 dark:bg-navy-950/30", children: [
            /* @__PURE__ */ jsx("div", { className: "mb-2 text-sm font-medium text-slate-800 dark:text-slate-100", children: t("discoveryToolsMain.toolDocumentView.finalSourceSummary") }),
            /* @__PURE__ */ jsx("p", { className: "text-sm text-slate-600 dark:text-slate-300", children: swotData.summary.executiveSummary })
          ] }),
          reviewGaps.length > 0 && /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300", children: [
            /* @__PURE__ */ jsx("div", { className: "mb-2 font-medium", children: t("discoveryToolsMain.toolDocumentView.missingItems") }),
            /* @__PURE__ */ jsx("ul", { className: "space-y-1", children: reviewGaps.map((gap, index) => /* @__PURE__ */ jsxs("li", { children: [
              "\u2022 ",
              gap
            ] }, `${gap}-${index}`)) })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 text-xs text-slate-500 dark:border-navy-700/70 dark:bg-navy-950/30 dark:text-slate-400", children: t("discoveryToolsMain.toolDocumentView.lifecycleActionsHint") })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-slate-800 dark:text-slate-100", children: t("discoveryToolsMain.toolDocumentView.generationSettings") }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 md:grid-cols-3 rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4", children: [
          /* @__PURE__ */ jsxs("label", { className: "space-y-1", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500", children: t("discoveryToolsMain.toolDocumentView.methodology") }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: generationDefaults.methodologyId,
                onChange: (e) => setGenerationDefaults((prev) => ({ ...prev, methodologyId: e.target.value })),
                className: "h-9 w-full rounded-lg border border-slate-300/60 bg-white px-3 text-sm dark:border-navy-600/40 dark:bg-navy-900",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "impact-feasibility", children: "Impact-Feasibility Matrix" }),
                  /* @__PURE__ */ jsx("option", { value: "strategic-alignment", children: "Strategic Alignment" }),
                  /* @__PURE__ */ jsx("option", { value: "quick-wins", children: "Quick Wins First" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "space-y-1", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500", children: t("discoveryToolsMain.toolDocumentView.initiativesCount") }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                min: 1,
                max: 10,
                value: generationDefaults.count,
                onChange: (e) => setGenerationDefaults((prev) => ({
                  ...prev,
                  count: Math.max(1, Number(e.target.value) || 3)
                })),
                className: "h-9 w-full rounded-lg border border-slate-300/60 bg-white px-3 text-sm dark:border-navy-600/40 dark:bg-navy-900"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "flex items-end gap-2 rounded-xl bg-white/70 dark:bg-navy-950/40 px-3 py-2 text-sm text-slate-600 dark:text-slate-400", children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "checkbox",
                checked: generationDefaults.includeChatContext,
                onChange: (e) => setGenerationDefaults((prev) => ({
                  ...prev,
                  includeChatContext: e.target.checked
                }))
              }
            ),
            /* @__PURE__ */ jsx("span", { children: t("discoveryToolsMain.toolDocumentView.includeChatContext") })
          ] })
        ] })
      ] }),
      toolDecisions.length > 0 && /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-slate-800 dark:text-slate-100", children: t("discoveryToolsMain.toolDocumentView.gateDecisions") }),
        /* @__PURE__ */ jsx("div", { className: "space-y-2 rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4", children: toolDecisions.map((decision, index) => /* @__PURE__ */ jsxs(
          "div",
          {
            className: "flex items-center justify-between gap-3 rounded-xl bg-white/70 dark:bg-navy-950/40 px-3 py-2 text-sm",
            children: [
              /* @__PURE__ */ jsx("span", { className: "text-slate-700 dark:text-slate-300", children: decision.decision_type }),
              /* @__PURE__ */ jsx("span", { className: "text-slate-500 dark:text-slate-400", children: decision.decision_status || decision.status })
            ]
          },
          `${decision.decision_id || decision.decision_type}-${index}`
        )) })
      ] })
    ] });
    const outputsSection = /* @__PURE__ */ jsxs("div", { className: "space-y-8", children: [
      toolType === "dynamic-swot" && swotData?.summary?.executiveSummary && /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-slate-800 dark:text-slate-100", children: t("discoveryToolsMain.toolDocumentView.sourceArtifact") }),
        /* @__PURE__ */ jsxs("div", { className: "rounded-2xl bg-slate-50/70 p-4 dark:bg-navy-900/40", children: [
          /* @__PURE__ */ jsx("div", { className: "text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500", children: t("discoveryToolsMain.toolDocumentView.finalSourceSummary") }),
          /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-slate-700 dark:text-slate-300", children: swotData.summary.executiveSummary }),
          (swotData.summary.appliedConclusions?.length || 0) > 0 && /* @__PURE__ */ jsxs("div", { className: "mt-4", children: [
            /* @__PURE__ */ jsx("div", { className: "mb-2 text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-500", children: t("discoveryToolsMain.toolDocumentView.appliedConclusions") }),
            /* @__PURE__ */ jsx("ul", { className: "space-y-1 text-sm text-slate-600 dark:text-slate-300", children: swotData.summary.appliedConclusions?.map((conclusion, index) => /* @__PURE__ */ jsxs("li", { children: [
              "\u2022 ",
              conclusion
            ] }, `${conclusion}-${index}`)) })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-slate-800 dark:text-slate-100", children: t("discoveryToolsMain.toolDocumentView.outputContract") }),
        /* @__PURE__ */ jsx("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-4", children: CONSULTING_TOOL_STANDARD_OUTPUTS.map((outputType) => /* @__PURE__ */ jsxs(
          "div",
          {
            className: "rounded-2xl bg-slate-50/70 p-4 text-sm text-slate-600 dark:bg-navy-900/40 dark:text-slate-300",
            children: [
              /* @__PURE__ */ jsx("div", { className: "font-medium text-slate-800 dark:text-slate-100", children: outputType }),
              /* @__PURE__ */ jsx("div", { className: "mt-1 text-xs text-slate-500 dark:text-slate-400", children: outputType === "initiative" ? t("discoveryToolsMain.toolDocumentView.outputHintInitiative") : outputType === "report" ? t("discoveryToolsMain.toolDocumentView.outputHintReport") : outputType === "presentation" ? t("discoveryToolsMain.toolDocumentView.outputHintPresentation") : t("discoveryToolsMain.toolDocumentView.outputHintIdea") })
            ]
          },
          outputType
        )) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-slate-800 dark:text-slate-100", children: t("discoveryToolsMain.toolDocumentView.initiativesFromThisSession") }),
        /* @__PURE__ */ jsx(
          EmbeddedView,
          {
            title: t("discoveryToolsMain.toolDocumentView.generatedInitiatives"),
            count: generatedInitiatives.length,
            viewModes: ["list"],
            readOnly: true,
            children: generatedInitiatives.length === 0 ? /* @__PURE__ */ jsx("div", { className: "px-1 text-[11px] text-slate-500 dark:text-slate-400", children: t("discoveryToolsMain.toolDocumentView.noInitiativesGeneratedYet") }) : /* @__PURE__ */ jsx("div", { className: "space-y-2", children: generatedInitiatives.map((initiative) => /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onOpenInitiative?.(initiative.id),
                className: "flex w-full items-center justify-between rounded-xl bg-white/70 dark:bg-navy-950/40 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300",
                children: [
                  /* @__PURE__ */ jsx("span", { className: "truncate", children: initiative.title }),
                  /* @__PURE__ */ jsx(ExternalLink, { size: 14, className: "shrink-0 text-slate-600" })
                ]
              },
              initiative.id
            )) })
          }
        )
      ] }),
      toolType === "dynamic-swot" && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-slate-800 dark:text-slate-100", children: t("discoveryToolsMain.toolDocumentView.recommendedMoves") }),
          /* @__PURE__ */ jsx("div", { className: "space-y-2", children: (swotData?.recommendedMoves || []).length === 0 ? /* @__PURE__ */ jsx("div", { className: "rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4 text-sm text-slate-500 dark:text-slate-400", children: t("discoveryToolsMain.toolDocumentView.noMovesGeneratedYet") }) : swotData?.recommendedMoves?.map((move) => /* @__PURE__ */ jsxs(
            "div",
            {
              className: "rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4 space-y-2",
              children: [
                /* @__PURE__ */ jsx("div", { className: "text-sm font-medium text-slate-800 dark:text-slate-200", children: move.title }),
                /* @__PURE__ */ jsx("div", { className: "text-xs uppercase tracking-wide text-slate-600 dark:text-slate-500", children: move.category }),
                /* @__PURE__ */ jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: move.rationale })
              ]
            },
            move.id
          )) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-slate-800 dark:text-slate-100", children: t("discoveryToolsMain.toolDocumentView.outputCandidates") }),
          /* @__PURE__ */ jsx("div", { className: "space-y-2", children: (swotData?.outputCandidates || []).length === 0 ? /* @__PURE__ */ jsx("div", { className: "rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4 text-sm text-slate-500 dark:text-slate-400", children: t("discoveryToolsMain.toolDocumentView.noOutputCandidatesYet") }) : swotData?.outputCandidates?.map((candidate) => /* @__PURE__ */ jsxs(
            "div",
            {
              className: "rounded-2xl bg-slate-50/70 dark:bg-navy-900/40 p-4 space-y-1",
              children: [
                /* @__PURE__ */ jsx("div", { className: "text-sm font-medium text-slate-800 dark:text-slate-200", children: candidate.title }),
                /* @__PURE__ */ jsx("div", { className: "text-xs uppercase tracking-wide text-slate-600 dark:text-slate-500", children: candidate.outputType }),
                /* @__PURE__ */ jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: candidate.description })
              ]
            },
            candidate.id
          )) })
        ] })
      ] })
    ] });
    const aiCollaborationSection = currentSession ? /* @__PURE__ */ jsx(
      ToolContextPanel,
      {
        toolType,
        session: currentSession,
        currentStepId: currentStepDef?.id,
        isPolish,
        orgName: currentOrganization?.name,
        aiContent: isStreaming ? streamedContent : void 0,
        onOpenChat: handleOpenChat,
        generatedInitiatives,
        recentInitiatives: generatedInitiatives.slice(0, 5),
        chatSnippets: (activeChatMessages || []).slice(-6).map((message) => ({
          role: message.role,
          content: message.content
        })),
        embedded: true
      }
    ) : /* @__PURE__ */ jsx("div", { className: "py-10 text-center text-sm text-slate-500 dark:text-slate-400", children: t("discoveryToolsMain.toolDocumentView.noSessionData") });
    const groupLabels = t("discoveryToolsMain.toolDocumentView.groupLabels", {
      returnObjects: true
    });
    const phaseGroupIndex = (stepId) => {
      if (["mission", "context", "input", "signals"].includes(stepId)) return 0;
      if (["insights", "synthesis", "swot", "forces", "options", "items", "assumptions"].includes(
        stepId
      )) {
        return 1;
      }
      if (["recommendations"].includes(stepId)) return 2;
      if (["outputs", "report", "initiatives", "results", "summary", "review"].includes(stepId))
        return 2;
      return 0;
    };
    const staticGroupIndexById = {
      work: 0,
      "session-review": 1,
      outputs: 2,
      "ai-collaboration": 3,
      comments: 4,
      activity: 4,
      "used-in": 4
    };
    const cSpanById = {
      work: 3,
      // wide step canvas + tool workspace
      "session-review": 2,
      // readiness + generation grids
      outputs: 3,
      // output contract grid + initiatives + candidates
      "ai-collaboration": 2
    };
    const cHiddenById = (id) => {
      if (id === "comments") return nModeComments.length === 0;
      if (id === "activity") return history.length === 0;
      if (id === "used-in") return toolBacklinks.length === 0;
      return false;
    };
    if (isStrategicPhaseTool) {
      const renderPhaseCanvas = (phaseStep, extras) => {
        const phaseIndex = stepDefs.findIndex((step) => step.id === phaseStep.id) + 1;
        const isStrategicSessionPhase = [
          "mission",
          "input",
          "swot",
          "forces",
          "options",
          "items",
          "assumptions",
          "insights",
          "outputs"
        ].includes(phaseStep.id);
        return /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
          toolType === "dynamic-swot" ? renderDynamicSwotPhaseOverview() : null,
          !isStrategicSessionPhase && /* @__PURE__ */ jsx("div", { className: "rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30", children: /* @__PURE__ */ jsx("div", { className: "flex flex-wrap items-start justify-between gap-3", children: /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx("div", { className: "text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-500", children: t("discoveryToolsMain.toolDocumentView.aIConsultantFlow") }),
            /* @__PURE__ */ jsx("div", { className: "text-sm text-slate-700 dark:text-slate-300", children: isPolish ? phaseStep.descriptionPl : phaseStep.description })
          ] }) }) }),
          /* @__PURE__ */ jsxs("div", { className: "overflow-hidden rounded-2xl", children: [
            toolType === "dynamic-swot" && toolAiError ? /* @__PURE__ */ jsxs(
              "div",
              {
                role: "alert",
                className: "m-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-300/60 bg-danger-50 p-3 text-sm text-danger-800 dark:border-danger-800 dark:bg-danger-950/30 dark:text-danger-200",
                children: [
                  /* @__PURE__ */ jsx("span", { children: /timeout|timed out|limit czasu/i.test(toolAiError) ? isPolish ? "Przekroczono limit czasu generowania. Twoje dane s\u0105 bezpieczne." : "Generation timed out. Your work is safe." : /cancel|anulow/i.test(toolAiError) ? isPolish ? "Generowanie anulowano. Twoje dane s\u0105 bezpieczne." : "Generation was cancelled. Your work is safe." : isPolish ? "Dostawca AI nie odpowiedzia\u0142. Twoje dane s\u0105 bezpieczne." : "The AI provider did not respond. Your work is safe." }),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => void generateFullSession(),
                      className: "rounded-lg border border-current px-3 py-1.5 text-xs font-semibold",
                      children: isPolish ? "Spr\xF3buj ponownie" : "Retry"
                    }
                  )
                ]
              }
            ) : null,
            currentSession && ["recommendations", "review"].includes(phaseStep.id) ? /* @__PURE__ */ jsxs(
              "div",
              {
                "data-testid": "dynamic-swot-phase-empty-state",
                "data-phase-id": phaseStep.id,
                className: "rounded-2xl border border-slate-200/70 bg-white/80 p-6 dark:border-navy-700/70 dark:bg-navy-950/30",
                children: [
                  /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-slate-900 dark:text-slate-100", children: isPolish ? phaseStep.namePl : phaseStep.name }),
                  /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-slate-600 dark:text-slate-300", children: isPolish ? phaseStep.descriptionPl : phaseStep.description }),
                  /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm text-slate-500 dark:text-slate-400", children: isPolish ? "Ten etap czeka na jawn\u0105 decyzj\u0119 w bie\u017C\u0105cej sesji." : "This stage is waiting for an explicit decision in the current session." })
                ]
              }
            ) : currentSession ? /* @__PURE__ */ jsx(
              ToolCanvas,
              {
                toolType,
                currentStep: phaseIndex,
                stepDefinition: phaseStep,
                session: currentSession,
                isStreaming,
                streamedContent: streamedContent || "",
                isPolish,
                onOpenChat: handleOpenChat,
                generatedInitiatives,
                onGenerateFullSession: generateFullSession,
                onContinue: () => setCurrentStep(Math.min(stepDefs.length, phaseIndex + 1)),
                missionSuggestion,
                onApplyMissionSuggestion: applyMissionSuggestion,
                onDismissMissionSuggestion: dismissMissionSuggestion,
                isGeneratingAI,
                sessionGenerationStatus: currentSession.sessionGenerationStatus,
                onAcceptCard: acceptCard,
                onRejectCard: rejectCard,
                onRethinkCard: (cardType, cardId, comment) => {
                  rethinkCard(phaseStep.id, cardType, cardId, comment);
                }
              }
            ) : /* @__PURE__ */ jsx("div", { className: "py-10 text-center text-sm text-slate-500 dark:text-slate-400", children: t("discoveryToolsMain.toolDocumentView.noSessionData") })
          ] }),
          extras,
          !(toolType === "dynamic-swot" && phaseStep.id === "mission") && /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between pt-2", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setCurrentStep(Math.max(1, phaseIndex - 1)),
                disabled: phaseIndex <= 1,
                className: "rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 disabled:opacity-50 dark:bg-navy-900/70 dark:text-slate-300",
                children: t("discoveryToolsMain.toolDocumentView.previous2")
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "text-xs text-slate-500 dark:text-slate-400", children: [
              t("discoveryToolsMain.toolDocumentView.step"),
              " ",
              phaseIndex,
              "/",
              stepDefs.length
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => {
                  if (phaseIndex === currentStep) {
                    nextStep();
                    return;
                  }
                  setCurrentStep(Math.min(stepDefs.length, phaseIndex + 1));
                },
                disabled: phaseIndex >= stepDefs.length || phaseIndex === currentStep && !canAdvanceStep(),
                className: "rounded-lg bg-navy-900 px-3 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50",
                children: phaseIndex >= stepDefs.length ? t("discoveryToolsMain.toolDocumentView.finish") : t("discoveryToolsMain.toolDocumentView.nextStep")
              }
            )
          ] })
        ] });
      };
      const phaseIcon = (stepId) => {
        if (["mission", "context"].includes(stepId)) return Target;
        if (["input", "signals"].includes(stepId)) return MessageSquare;
        if (["insights", "synthesis"].includes(stepId)) return Lightbulb;
        if (["outputs", "report", "initiatives"].includes(stepId)) return CheckCircle2;
        return Target;
      };
      return [
        ...stepDefs.map((step) => {
          const isOutputs = ["outputs", "report", "initiatives"].includes(step.id);
          return {
            id: step.id,
            icon: phaseIcon(step.id),
            label: {
              en: isOutputs ? "Outputs & Actions" : step.name,
              pl: step.namePl
            },
            badge: isOutputs ? generatedInitiatives.length + (swotData?.outputCandidates?.length || 0) : void 0,
            group: groupLabels[phaseGroupIndex(step.id)],
            cSpan: 3,
            // phase canvases are wide step workspaces
            component: /* @__PURE__ */ jsx("div", { "data-testid": "dynamic-swot-section-step", "data-phase-id": step.id, children: renderPhaseCanvas(step) })
          };
        }),
        ...toolType === "dynamic-swot" ? [] : [
          {
            id: "ai-collaboration",
            icon: Sparkles,
            label: { en: "AI Collaboration Panel", pl: "AI Collaboration Panel" },
            group: groupLabels[3],
            cSpan: 2,
            component: aiCollaborationSection
          }
        ]
      ];
    }
    const defaultSections = [
      {
        id: "work",
        icon: Target,
        label: { en: "Work", pl: "Praca" },
        component: workSection
      },
      {
        id: "session-review",
        icon: CheckCircle2,
        label: { en: "Review", pl: "Review" },
        badge: reviewGaps.length,
        component: reviewSection
      },
      {
        id: "outputs",
        icon: Lightbulb,
        // Odbiór 2026-08-30 (przegląd całości): `pl: 'Outputs'` był 1:1
        // kopią angielskiego — nagłówek lewej szyny po angielsku obok
        // przetłumaczonych sąsiadów ("Praca"/"Komentarze"). "Rezultaty" to
        // to samo słowo, którego już używa `KnownToolDetailView.tsx` dla
        // "outputs" w tym samym module.
        label: { en: "Outputs", pl: "Rezultaty" },
        badge: generatedInitiatives.length + (swotData?.outputCandidates?.length || 0),
        component: outputsSection
      },
      ...toolType === "dynamic-swot" ? [] : [
        {
          id: "ai-collaboration",
          icon: Sparkles,
          label: { en: "AI Collaboration Panel", pl: "AI Collaboration Panel" },
          component: aiCollaborationSection
        }
      ],
      {
        id: ["comments"].join(""),
        icon: MessageSquare,
        label: { en: "Comments", pl: "Komentarze" },
        badge: nModeComments.length,
        component: /* @__PURE__ */ jsx(
          CommentsCanvas,
          {
            comments: nModeComments,
            onDeleteComment: handleDeleteComment,
            dateFilter: commentDateFilter,
            onDateFilterChange: setCommentDateFilter,
            sortOrder: commentSortOrder,
            onToggleSort: () => setCommentSortOrder((prev) => prev === "desc" ? "asc" : "desc"),
            commentDraft,
            onCommentDraftChange: setCommentDraft,
            onSubmitComment: async () => {
              const added = await handleAddComment(commentDraft);
              if (added) {
                setCommentDraft("");
                setDraftPriority("normal");
              }
            },
            draftPriority,
            onDraftPriorityChange: setDraftPriority,
            getPriorityDotClass,
            getCommentPriority: () => "normal",
            getPriorityButtonClass,
            getCommentPriorityLabel: getPriorityLabel,
            getCommentPriorityHint: (priority) => getPriorityHint(priority, t)
          }
        )
      },
      {
        id: "activity",
        icon: History,
        label: { en: "Activity", pl: "Aktywno\u015B\u0107" },
        badge: history.length,
        component: /* @__PURE__ */ jsx(
          ActivityLogCanvas,
          {
            entries: activityEntries,
            stats: activityStats,
            typeMeta: activityTypeMeta
          }
        )
      },
      {
        id: "used-in",
        icon: ExternalLink,
        label: { en: "Used in", pl: "Used in" },
        badge: toolBacklinks.length,
        component: /* @__PURE__ */ jsx(
          EmbeddedView,
          {
            title: t("discoveryToolsMain.toolDocumentView.backlinks"),
            count: toolBacklinks.length,
            loading: toolBacklinksLoading,
            readOnly: true,
            viewModes: ["list"],
            children: toolBacklinks.length === 0 && !toolBacklinksLoading ? /* @__PURE__ */ jsx("div", { className: "px-1 text-[11px] text-slate-500 dark:text-slate-400", children: t("discoveryToolsMain.toolDocumentView.noLinksYet") }) : /* @__PURE__ */ jsx("div", { className: "space-y-2", children: toolBacklinks.map((item) => /* @__PURE__ */ jsxs(
              "div",
              {
                className: "rounded-xl bg-white/70 dark:bg-navy-950/40 px-3 py-2",
                children: [
                  /* @__PURE__ */ jsx("div", { className: "text-[11px] font-medium text-slate-800 dark:text-slate-200", children: item.sourceType }),
                  /* @__PURE__ */ jsx("div", { className: "text-[10px] text-slate-500 dark:text-slate-400", children: item.sourceId })
                ]
              },
              item.id
            )) })
          }
        )
      }
    ];
    return defaultSections.map((section) => ({
      ...section,
      group: toolType === "dynamic-swot" ? void 0 : groupLabels[staticGroupIndexById[section.id] ?? 4],
      cSpan: cSpanById[section.id] ?? section.cSpan,
      cHidden: cHiddenById(section.id) || section.cHidden
    }));
  }, [
    activeChatMessages,
    activityEntries,
    activityStats,
    activityTypeMeta,
    canAdvanceStep,
    commentDateFilter,
    commentDraft,
    commentSortOrder,
    comments.length,
    completionItems,
    completionReady,
    currentSession?.sessionGenerationStatus,
    createdAt,
    currentOrganization?.name,
    currentSession,
    currentStep,
    currentStepDef,
    draftPriority,
    dynamicSwotPhaseSummaries,
    dynamicSwotReadiness,
    generatedInitiatives,
    handleAddComment,
    handleDeleteComment,
    handleGenerateAI,
    handleOpenChat,
    history.length,
    isStrategicPhaseTool,
    isGeneratingAI,
    isPolish,
    isStreaming,
    lastModified,
    nModeComments,
    nextStep,
    onOpenInitiative,
    prevStep,
    progress,
    reviewGaps,
    setCurrentStep,
    stepDefs,
    streamedContent,
    swotData?.outputCandidates,
    swotData?.recommendedMoves,
    toolBacklinks,
    toolBacklinksLoading,
    toolMeta.name,
    toolPermissions.canApproveTool,
    toolPermissions.canGenerate,
    toolPermissions.canRequestReview,
    toolStatus,
    toolType
  ]);
  const handleSectionChange = useCallback(
    (sectionId) => {
      if (isStrategicPhaseTool) explicitStrategicSectionRef.current = sectionId;
      setActiveSection(sectionId);
      if (!isStrategicPhaseTool) return;
      const targetIndex = stepDefs.findIndex((step) => step.id === sectionId);
      if (targetIndex >= 0) {
        setCurrentStep(targetIndex + 1);
      }
    },
    [isStrategicPhaseTool, setCurrentStep, stepDefs]
  );
  const lastSavedLabel = useMemo(() => {
    if (!lastModified) return void 0;
    return `${t("discoveryToolsMain.toolDocumentView.saved")} ${new Date(
      lastModified
    ).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  }, [isPolish, lastModified]);
  const lifecycleControls = useMemo(() => {
    const showAiActions = effectivePhaseAiActions.length > 0 || isStreaming || aiReviewCount > 0;
    return /* @__PURE__ */ jsxs(
      "div",
      {
        className: "flex flex-wrap items-center justify-end gap-1.5",
        "data-menu3-actions": "tool-lifecycle-ai-chat",
        children: [
          toolType === "dynamic-swot" && currentSession?.sessionGenerationStatus === "generating" ? /* @__PURE__ */ jsx("button", { type: "button", onClick: abortStream, className: getMenu3AiButtonClass(false), children: isPolish ? "Anuluj generowanie" : "Cancel generation" }) : null,
          /* @__PURE__ */ jsx(
            "span",
            {
              className: "inline-flex h-8 items-center rounded-full border border-slate-200/60 bg-slate-100 px-3 text-[11px] font-semibold text-slate-600 dark:border-navy-700/60 dark:bg-navy-800 dark:text-slate-300",
              "data-menu3-lifecycle-status": toolStatus,
              children: statusLabel(toolStatus)
            }
          ),
          toolStatus === "DRAFT" ? /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: handleRequestReview,
              disabled: !completionReady || toolPermissions.canRequestReview === false,
              className: getMenu3AiButtonClass(false),
              title: completionReady ? t("discoveryToolsMain.toolDocumentView.requestReviewTitleReady") : t("discoveryToolsMain.toolDocumentView.requestReviewTitleNotReady"),
              children: [
                /* @__PURE__ */ jsx(Send, { size: 12 }),
                t("discoveryToolsMain.toolDocumentView.requestReview")
              ]
            }
          ) : null,
          toolStatus === "REVIEW" ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: handleApprove,
                disabled: !completionReady || toolPermissions.canApproveTool === false,
                className: getMenu3AiButtonClass(false),
                title: completionReady ? t("discoveryToolsMain.toolDocumentView.approveThisSession") : t("discoveryToolsMain.toolDocumentView.requestReviewTitleNotReady"),
                children: [
                  /* @__PURE__ */ jsx(CheckCircle2, { size: 12 }),
                  t("discoveryToolsMain.toolDocumentView.approve")
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: handleSendBack,
                className: getMenu3AiButtonClass(false),
                title: t("discoveryToolsMain.toolDocumentView.sendBackToDraftWithAComment"),
                children: [
                  /* @__PURE__ */ jsx(ExternalLink, { size: 12 }),
                  t("discoveryToolsMain.toolDocumentView.sendBack")
                ]
              }
            )
          ] }) : null,
          showAiActions ? /* @__PURE__ */ jsx(
            ToolPhaseAiActions,
            {
              actions: effectivePhaseAiActions,
              activeActionId: activeAiActionId,
              isStreaming,
              isPolish,
              onRunAction: (actionId) => void runPhaseAiAction(actionId),
              onAbort: abortStream,
              aiReviewCount,
              onReviewAiCards: scrollToAiCards,
              className: "shrink-0"
            }
          ) : null
        ]
      }
    );
  }, [
    abortStream,
    activeAiActionId,
    aiReviewCount,
    completionReady,
    effectivePhaseAiActions,
    handleApprove,
    handleRequestReview,
    handleSendBack,
    isPolish,
    isStreaming,
    runPhaseAiAction,
    toolPermissions.canApproveTool,
    toolPermissions.canGenerate,
    toolPermissions.canRequestReview,
    toolStatus,
    toolType
  ]);
  useEffect(() => {
    if (!onCommandRowActionsChange) return;
    onCommandRowActionsChange(toolType === "dynamic-swot" ? null : lifecycleControls);
    return () => onCommandRowActionsChange(null);
  }, [lifecycleControls, onCommandRowActionsChange, toolType]);
  const sessionRightPanelSections = useMemo(
    () => [
      {
        id: "actions",
        label: isPolish ? "Akcje" : "Actions",
        icon: Sparkles,
        defaultOpen: true,
        children: lifecycleControls
      },
      {
        id: "properties",
        label: isPolish ? "W\u0142a\u015Bciwo\u015Bci" : "Properties",
        icon: Target,
        defaultOpen: true,
        children: /* @__PURE__ */ jsx(
          ArtifactPropertiesTable,
          {
            propertyLabel: isPolish ? "W\u0142a\u015Bciwo\u015B\u0107" : "Property",
            valueLabel: isPolish ? "Warto\u015B\u0107" : "Value",
            rows: properties.map((property) => ({
              id: property.id,
              label: isPolish ? property.label.pl : property.label.en,
              value: String(property.value ?? "\u2014")
            }))
          }
        )
      },
      {
        id: "relations",
        label: isPolish ? "Powi\u0105zania" : "Relations",
        icon: ExternalLink,
        defaultOpen: false,
        badge: toolBacklinks.length,
        showZeroBadge: true,
        isEmpty: toolBacklinks.length === 0,
        emptyLabel: isPolish ? "Brak powi\u0105zanych element\xF3w." : "No related items.",
        children: /* @__PURE__ */ jsx("ul", { className: "space-y-2 text-xs text-c-text-secondary", children: toolBacklinks.map((item) => /* @__PURE__ */ jsx("li", { children: `${item.sourceType}: ${item.sourceId}` }, item.id)) })
      },
      {
        id: "evidence",
        label: isPolish ? "\u0179r\xF3d\u0142a i za\u0142o\u017Cenia" : "Sources & assumptions",
        icon: CheckCircle2,
        defaultOpen: false,
        children: /* @__PURE__ */ jsx("p", { className: "text-xs leading-relaxed text-c-text-secondary", children: isPolish ? "\u0179r\xF3d\u0142a, za\u0142o\u017Cenia i materia\u0142 wej\u015Bciowy u\u017Cyty w tej sesji s\u0105 widoczne w kroku Input & Exploration." : "Sources, assumptions, and input material used in this session are available in Input & Exploration." })
      },
      {
        id: "results",
        label: isPolish ? "Rezultaty" : "Results",
        icon: Lightbulb,
        defaultOpen: false,
        badge: generatedInitiatives.length + (swotData?.outputCandidates?.length || 0),
        showZeroBadge: true,
        children: /* @__PURE__ */ jsx("p", { className: "text-xs text-c-text-secondary", children: isPolish ? `Post\u0119p sesji: ${progress}%` : `Session progress: ${progress}%` })
      },
      {
        id: "comments",
        label: isPolish ? "Komentarze" : "Comments",
        icon: MessageSquare,
        defaultOpen: false,
        badge: nModeComments.length,
        showZeroBadge: true,
        isEmpty: nModeComments.length === 0,
        emptyLabel: isPolish ? "Brak komentarzy." : "No comments.",
        children: /* @__PURE__ */ jsx("p", { className: "text-xs text-c-text-secondary", children: nModeComments.length })
      }
    ],
    [
      generatedInitiatives.length,
      isPolish,
      lifecycleControls,
      nModeComments.length,
      progress,
      properties,
      swotData?.outputCandidates?.length,
      toolBacklinks
    ]
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const syncPortalTarget = () => {
      setCommandRowPortalTarget(document.getElementById("module-command-row-right-actions"));
    };
    syncPortalTarget();
    const rafId = window.requestAnimationFrame(syncPortalTarget);
    return () => window.cancelAnimationFrame(rafId);
  }, [toolSessionId, lifecycleControls]);
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "flex h-full items-center justify-center bg-slate-50 dark:bg-navy-950", children: /* @__PURE__ */ jsx(LoadingState, { variant: "spinner", label: t("discoveryToolsMain.toolDocumentView.loading") }) });
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    toolType !== "dynamic-swot" && commandRowPortalTarget && lifecycleControls ? createPortal(lifecycleControls, commandRowPortalTarget) : null,
    /* @__PURE__ */ jsx(
      NModeShell,
      {
        loading,
        presentationMode: "n",
        onPresentationModeChange: () => {
        },
        showModeSwitcher: false,
        header: {
          sticky: true,
          title: sessionName || defaultSessionName(toolMeta.name, isPolish),
          onTitleChange: setSessionName,
          titleReadOnly: true,
          artifactId: toolSessionId || toolType,
          artifactType: "tool",
          onSave: handleSave,
          saving,
          saveState,
          lastSavedLabel,
          isDirty: saveState === "dirty" || saveState === "error",
          onClose: onBack,
          statusLabel: statusLabel(toolStatus),
          statusTone: toolStatus === "DRAFT" ? "draft" : toolStatus === "REVIEW" ? "review" : "approved",
          inlineActions: toolType === "dynamic-swot" ? /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => setShowTeresaProposals((visible) => !visible),
              className: "inline-flex h-8 items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 text-xs font-semibold text-c-text-secondary transition hover:bg-c-surface",
              "data-testid": "ask-teresa-header",
              children: [
                /* @__PURE__ */ jsx(Sparkles, { size: 13 }),
                isPolish ? "Zapytaj Teres\u0119" : "Ask Teresa"
              ]
            }
          ) : void 0
        },
        rightPanel: /* @__PURE__ */ jsx("div", { "data-testid": "tool-session-properties", className: "h-full", children: /* @__PURE__ */ jsx(
          ArtifactRightPanel,
          {
            sections: sessionRightPanelSections,
            className: ARTIFACT_PANEL_CARD_CLASS_DOCKED,
            ariaLabel: isPolish ? "Panel sesji narz\u0119dzia" : "Tool session panel"
          }
        ) }),
        sections,
        actions: [],
        actionsVisible: false,
        activeSection,
        onSectionChange: handleSectionChange,
        children: null
      }
    ),
    showTeresaProposals && toolType === "dynamic-swot" && toolSessionId ? /* @__PURE__ */ jsxs(
      "aside",
      {
        role: "dialog",
        "aria-modal": "false",
        "aria-label": isPolish ? "Propozycje Teresy" : "Teresa proposals",
        className: "fixed bottom-5 right-5 z-40 max-h-[70vh] w-[min(440px,calc(100vw-2.5rem))] overflow-y-auto rounded-2xl border border-c-border bg-c-surface p-4 shadow-2xl",
        "data-testid": "teresa-proposals-panel",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "mb-3 flex items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsx("strong", { className: "text-sm text-c-text", children: isPolish ? "Propozycje Teresy" : "Teresa proposals" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setShowTeresaProposals(false),
                onKeyDown: (event) => {
                  if (event.key === "Escape") setShowTeresaProposals(false);
                },
                className: "rounded-lg px-2 py-1 text-xs text-c-text-secondary hover:bg-c-surface-raised",
                autoFocus: true,
                children: isPolish ? "Zamknij" : "Close"
              }
            )
          ] }),
          /* @__PURE__ */ jsx(TeresaSwotProposals, { toolSessionId, isPolish })
        ]
      }
    ) : null,
    /* @__PURE__ */ jsxs("div", { id: "tool-report-export", className: "hidden p-8 bg-white text-slate-900", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-semibold", children: sessionName || defaultSessionName(toolMeta.name, isPolish) }),
      /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-slate-600", children: toolType }),
      /* @__PURE__ */ jsxs("div", { className: "mt-6 space-y-2", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          "Status: ",
          statusLabel(toolStatus)
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          "Progress: ",
          progress,
          "%"
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          "Current step: ",
          currentStepDef?.name || "-"
        ] })
      ] }),
      toolType === "dynamic-swot" && swotData?.summary?.executiveSummary && /* @__PURE__ */ jsxs("div", { className: "mt-8", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold", children: "Executive summary" }),
        /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm", children: swotData.summary.executiveSummary })
      ] })
    ] }),
    showRequestReviewModal && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-lg rounded-2xl bg-white p-5 dark:bg-navy-900", children: [
      /* @__PURE__ */ jsxs("div", { className: "mb-4", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-lg font-semibold text-slate-900 dark:text-slate-100", children: t("discoveryToolsMain.toolDocumentView.requestReview2") }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-slate-500 dark:text-slate-400", children: t("discoveryToolsMain.toolDocumentView.configureDecisionOwnerHint") })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxs("label", { className: "block space-y-1", children: [
          /* @__PURE__ */ jsx("span", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("discoveryToolsMain.toolDocumentView.decisionOwner") }),
          /* @__PURE__ */ jsxs(
            "select",
            {
              value: reviewDecisionOwnerId,
              onChange: (e) => setReviewDecisionOwnerId(e.target.value),
              className: "h-10 w-full rounded-lg border border-slate-300/60 bg-white px-3 text-sm dark:border-navy-600/40 dark:bg-navy-950",
              children: [
                /* @__PURE__ */ jsx("option", { value: "", children: t("discoveryToolsMain.toolDocumentView.select") }),
                users.map((user) => /* @__PURE__ */ jsx("option", { value: user.id, children: user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || user.id }, user.id))
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "block space-y-1", children: [
          /* @__PURE__ */ jsx("span", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("discoveryToolsMain.toolDocumentView.dueDate") }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "date",
              value: reviewDueDate,
              onChange: (e) => setReviewDueDate(e.target.value),
              className: "h-10 w-full rounded-lg border border-slate-300/60 bg-white px-3 text-sm dark:border-navy-600/40 dark:bg-navy-950"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "block space-y-1", children: [
          /* @__PURE__ */ jsx("span", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("discoveryToolsMain.toolDocumentView.priority") }),
          /* @__PURE__ */ jsxs(
            "select",
            {
              value: reviewPriority,
              onChange: (e) => setReviewPriority(e.target.value),
              className: "h-10 w-full rounded-lg border border-slate-300/60 bg-white px-3 text-sm dark:border-navy-600/40 dark:bg-navy-950",
              children: [
                /* @__PURE__ */ jsx("option", { value: "low", children: "Low" }),
                /* @__PURE__ */ jsx("option", { value: "medium", children: "Medium" }),
                /* @__PURE__ */ jsx("option", { value: "high", children: "High" }),
                /* @__PURE__ */ jsx("option", { value: "critical", children: "Critical" })
              ]
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-6 flex justify-end gap-2", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => setShowRequestReviewModal(false),
            className: "rounded-lg border border-slate-300/60 px-4 py-2 text-sm text-slate-700 dark:border-navy-600/40 dark:text-slate-300",
            children: t("discoveryToolsMain.toolDocumentView.cancel")
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => void handleConfirmRequestReview(),
            className: "rounded-lg bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800",
            children: t("discoveryToolsMain.toolDocumentView.sendReview")
          }
        )
      ] })
    ] }) })
  ] });
};
var ToolDocumentView_default = ToolDocumentView;
export {
  ToolDocumentView,
  ToolDocumentView_default as default
};
