/**
 * UnifiedChatPanel
 *
 * A unified chat interface component that works in both:
 * - Full-screen mode (main AI Chat view)
 * - Split-screen mode (alongside workspace)
 *
 * Uses useConversationStore as the primary source of truth for all
 * chat state, messages, and conversation management.
 *
 * Features:
 * - EnhancedChatInput with all rich features (files, tools, voice)
 * - FocusModeSelector (compact in split mode)
 * - ChatSlidingPanel integration for history
 * - Message rendering with streaming, thinking, artifacts
 * - Responsive design
 *
 * @version 1.0.0
 */

import {
  Briefcase,
  Calculator,
  CheckCircle2,
  GitFork,
  History,
  Loader2,
  MessageSquare,
  Mic,
  PanelRight,
  Plus,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import type {
  IdeaWorkspaceCreationPayload,
  IdeaWorkspaceSeedIntent,
} from '@/components/MyWork/ideaEntryTypes';
import { ChatToSchemaPanel } from '@/components/MyWork/table/ChatToSchemaPanel';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { isValidLanguage, normalizeLanguageCode, type SupportedLanguage } from '@/i18n';
import {
  deckTitleFromIntent,
  type DeliverableGenerationPlanItem,
  type DeliverableGenerationStatus,
  isDeliverablesLightEnabled,
  planDeckGeneration,
  planDocGeneration,
  planSheetGeneration,
  pollDeckGenerationUntilDone,
  startDeckGeneration,
  startDocGeneration,
  startSheetGeneration,
} from '@/services/deliverablesGeneration';

// Z4 transport (fala „Teresa steruje Ideą przez rejestr") — manifest narzędzi z
// rejestru akcji + wykonawca (ta sama ścieżka, co klik człowieka).
import {
  buildTeresaToolManifest,
  executeTeresaTool,
  shouldUseLegacyIdeaIntentFallback,
  toServerIdeaActionManifest,
} from '../../actions/teresaActionManifest';
import type { ActionResult } from '../../actions/registry/types';
import { useTeresaVoiceContext } from '../../contexts/TeresaVoiceContext';
import { useAIStream } from '../../hooks/useAIStream';
import { useChatActions } from '../../hooks/useChatActions';
import { useDemoSession } from '../../hooks/useDemoSession';
import { useUniversalVoice } from '../../hooks/useUniversalVoice';
import { Api } from '../../services/api';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import type { ChatContextAction } from '../../store/slices/uiSlice';
import { useAIActionsStore } from '../../store/useAIActionsStore';
import { useAppStore } from '../../store/useAppStore';
import { useArtifactsStore } from '../../store/useArtifactsStore';
import { useConversationStore } from '../../store/useConversationStore';
import { useProposalLifecycleStore } from '../../store/useProposalLifecycleStore';
import {
  AppView,
  Artifact,
  ChatMessage,
  FocusMode,
  ResponseFeedback,
  ThinkingStep,
} from '../../types';
import type {
  CanvasContextPacket,
  CanvasSelection,
  CanvasStarterId,
} from '../../types/canvasWorkspace';
import { ChatDisplayMode, WorkspaceContext } from '../../types/workspace';
import { notifyBargeIn } from '../../utils/bargeInToast';
import { buildPersistedAiResponseMetadata } from '../../utils/chatPersistence';
import { detectMessageLanguage } from '../../utils/detectMessageLanguage';
import { cleanTextForSpeech } from '../../utils/textCleaning';
import { isRtlLanguage } from '../../utils/textDirection';
import { ChatSmartSuggestions, type ChatSuggestion } from '../Chat/ChatSmartSuggestions';
import type { CanvasToolType, IdeaWorkspaceSelection } from '../MyWork/ideaSelectionTypes';
import { EMPTY_SELECTION } from '../MyWork/ideaSelectionTypes';
import TeresaMark from '../shared/TeresaMark';
import { BranchSelector, type ConversationBranch } from './BranchSelector';
import { detectCanvasWriteIntent } from './canvasStreamIntentDetector';
import {
  getChatAttachmentRejectionReason,
  MAX_CHAT_ATTACHMENT_BYTES,
  SUPPORTED_CHAT_ATTACHMENT_LABEL,
} from './chatAttachmentSupport';
import { pushRecentAttachment } from './chatRecentAttachments';
import { ChatSignalsPanel } from './ChatSignalsPanel';
import { ChatSlidingPanel } from './ChatSlidingPanel';
import { ContextBadge } from './ContextBadge';
import {
  detectDocumentIntent,
  detectPresentationIntent,
  hasStrongDocumentNoun,
} from './documentIntentDetector';
import { EnhancedChatInput } from './EnhancedChatInput';
import { MessageRenderer } from './MessageRenderer';
import { detectMindmapIntent } from './mindmapIntentDetector';
import { OutputToolSelector } from './OutputToolSelector';
import { PrivateModeDetails } from './PrivateModeDetails';
import { detectProcessFlowIntent } from './processFlowIntentDetector';
import {
  detectExceleIntent,
  detectTableIntent,
  hasWorkbookLaneSignals,
  resolveSheetLane,
} from './tableIntentDetector';
import {
  formatTeresaAdminDiagnostic,
  getTeresaEmptyResponseMessage,
  getTeresaStartFailureMessage,
} from './teresaRuntimeCopy';
import { TeresaTTSPlayer } from './TeresaTTSPlayer';
import { V8ArtifactRunControl } from './V8ArtifactRunControl';
import { V8ContextIndicator } from './V8ContextIndicator';
import { detectWhiteboardIntent } from './whiteboardIntentDetector';
import { type ActiveCanvasDocument, WorkCanvasDocumentPanel } from './WorkCanvasDocumentPanel';

// ============================================================================
// Types
// ============================================================================

type ChatSaveTarget = 'idea' | 'note';

const WORK_CANVAS_SPLIT_STORAGE_KEY = 'workCanvas.splitWidthPercent';
const DEFAULT_WORK_CANVAS_WIDTH_PERCENT = 60;
const MIN_WORK_CANVAS_WIDTH_PERCENT = 45;
const MAX_WORK_CANVAS_WIDTH_PERCENT = 72;

interface ChatSaveIntent {
  target: ChatSaveTarget;
  cleanPrompt: string;
}

interface ChatCanvasIntent {
  starterId: CanvasStarterId;
  cleanPrompt: string;
}

function clampWorkCanvasWidth(value: number): number {
  return Math.min(MAX_WORK_CANVAS_WIDTH_PERCENT, Math.max(MIN_WORK_CANVAS_WIDTH_PERCENT, value));
}

function getInitialWorkCanvasWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WORK_CANVAS_WIDTH_PERCENT;
  const stored = Number(window.localStorage.getItem(WORK_CANVAS_SPLIT_STORAGE_KEY));
  return Number.isFinite(stored) ? clampWorkCanvasWidth(stored) : DEFAULT_WORK_CANVAS_WIDTH_PERCENT;
}

function truncateCanvasContextText(value: unknown, max = 6000): string {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[Canvas context truncated to ${max} characters]`;
}

export function buildCanvasContextPacket(
  document: ActiveCanvasDocument | null,
  selection: CanvasSelection | null
): CanvasContextPacket | null {
  if (!document) return null;
  const blockSummaries = (document.blocks || []).slice(0, 12).map((block) => ({
    blockId: block.id,
    kind: block.kind,
    title: block.title,
    status: block.status,
    projectionStatus: block.markdownProjectionStatus,
    markdownProjection: truncateCanvasContextText(block.markdownProjection, 1200),
  }));
  const workflowRuns = (document.workflowRuns || []).slice(0, 5);
  const workflowEventSummaries = workflowRuns
    .flatMap((workflow) =>
      (workflow.events || []).slice(-3).map((event) => ({
        workflowRunId: workflow.id,
        workflowTitle: workflow.title,
        eventType: event.type,
        actorId: event.actorId,
        summary: truncateCanvasContextText(event.summary, 280),
        createdAt: event.createdAt,
      }))
    )
    .slice(-12);
  const workflowOutputSummaries = workflowRuns
    .flatMap((workflow) =>
      (workflow.outputs || []).slice(-5).map((output) => ({
        workflowRunId: workflow.id,
        workflowTitle: workflow.title,
        stepId: output.stepId,
        type: output.type,
        id: output.id,
        title: truncateCanvasContextText(output.title, 180),
        url: output.url,
      }))
    )
    .slice(-12);
  const workflowRunSummaries = workflowRuns.map((workflow) => ({
    id: workflow.id,
    draftId: workflow.draftId,
    conversationId: workflow.conversationId,
    template: workflow.template,
    title: workflow.title,
    status: workflow.status,
    lifecycle: workflow.collaboration?.lifecycle,
    stepSummaries: (workflow.steps || []).slice(0, 8).map((step) => ({
      id: step.id,
      kind: step.kind,
      title: step.title,
      status: step.status,
      approvalRequired: step.approvalRequired,
      outputType: step.outputType,
      outputId: step.outputId,
    })),
    approvalStatuses: (workflow.approvals || []).slice(0, 8).map((approval) => ({
      stepId: approval.stepId,
      status: approval.status,
    })),
    outputCount: (workflow.outputs || []).length,
    updatedAt: workflow.updatedAt,
  }));
  const workflowRunIds = workflowRuns.map((workflow) => workflow.id);
  const blockIds = blockSummaries.map((block) => block.blockId);
  const summaryParts = [
    `Active Canvas "${document.title}"`,
    document.draftId ? `draft ${document.draftId}` : 'unsaved draft',
    document.kind ? `kind ${document.kind}` : '',
    blockSummaries.length ? `${blockSummaries.length} block summaries` : 'no native blocks',
    workflowRuns.length ? `${workflowRuns.length} workflow runs` : 'no workflow runs',
  ].filter(Boolean);

  return {
    schemaVersion: 'canvas-context/v1',
    activeDraft: {
      draftId: document.draftId || null,
      researchSessionId: document.researchSessionId || null,
      title: document.title,
      kind: document.kind,
      lifecycleState: document.lifecycleState,
      saveState: document.saveState,
      markdownProjectionStatus: document.markdownProjectionStatus,
    },
    markdownProjection: truncateCanvasContextText(document.contentMd, 6000),
    selection: selection
      ? {
          ...selection,
          draftId: selection.draftId || document.draftId,
          selectedText: truncateCanvasContextText(selection.selectedText, 2000),
        }
      : null,
    blockSummaries,
    workflowRuns: workflowRunSummaries,
    workflowEventSummaries,
    workflowOutputSummaries,
    linkedOutputs: document.linkedOutputs || [],
    memorySnapshot: {
      summary: summaryParts.join(' · '),
      anchors: {
        draftId: document.draftId || null,
        researchSessionId: document.researchSessionId || null,
        title: document.title,
        kind: document.kind,
        workflowRunIds,
        blockIds,
      },
      limitations: [
        'Canvas packet uses Markdown projection and summaries only; raw native block JSON is not included.',
      ],
    },
  };
}

/**
 * RISK-30 (S22-TERESA, 2026-08-12) — reply layer must not stay silent when
 * `ActionResult.confirmed` is not `true`. Before this change, `onIdeaAction`
 * and `handleTeresaConfirmProceed` below only called `addChatMessage` when
 * `result.message` was already non-empty — any handler that returned
 * `ok: true` WITHOUT a `message` (the 58 UI-closure sites in
 * `runtimeHelpers.ts` after their `runUiClosureAsync` migration, or any
 * `runByTool`-style dispatch when `awaitQuickActionAck` resolves
 * `no_receiver`) left Teresa's already-streamed "done" standing unchallenged
 * on screen — the exact anti-pattern named in RISK-30's problem statement.
 *
 * This function is the SINGLE place that decides what the user sees when the
 * result itself is silent:
 *   • `result.message` present  → returned verbatim (existing behaviour,
 *     unchanged — refusals from the registry already carry their own text).
 *   • `ok: true` but `confirmed !== true` → honest "not confirmed" text,
 *     naming the action, so an unconfirmed result never reads as success.
 *   • `ok: false` with no message (defensive — the registry convention is
 *     that every refusal carries one, but never assume) → honest generic
 *     refusal, still naming the action, never silence.
 *   • `ok: true` and `confirmed === true` with no message → `null` (nothing
 *     to add; a real, explicit confirmation is not the RISK-30 defect).
 */
function describeUnconfirmedTeresaResult(
  result: ActionResult | undefined,
  toolName: string,
  t: (key: string, options: Record<string, unknown>) => string
): string | null {
  if (result?.message) return result.message;
  if (!result) return null; // brak wyniku obsługuje wywołujący (catch → błąd)
  if (result.ok && result.confirmed !== true) {
    return t('aiChat.teresaAction.unconfirmed', {
      defaultValue:
        'Nie mam potwierdzenia, że akcja „{{action}}” się wykonała — nic tego nie potwierdziło. Sprawdź ręcznie, zanim uznasz to za zrobione.',
      action: toolName,
    });
  }
  if (!result.ok) {
    return t('aiChat.teresaAction.refusedNoReason', {
      defaultValue: 'Nie wykonałem akcji „{{action}}” — rejestr odmówił bez podania powodu.',
      action: toolName,
    });
  }
  return null;
}

function mapChatArtifactToWave5Type(artifact: Artifact): string {
  switch ((artifact as any).type) {
    case 'table':
      return 'spreadsheet';
    case 'diagram':
      return 'diagram';
    case 'pmo-document':
    case 'markdown':
    case 'html':
      return 'report';
    case 'code':
      return 'note';
    case 'comparison-matrix':
    case 'decision-timeline':
      return 'decision';
    default:
      return 'note';
  }
}

const firstMatchIndex = (input: string, patterns: RegExp[]): number => {
  const s = String(input || '');
  let best = -1;
  for (const p of patterns) {
    const m = s.match(p);
    if (!m || typeof m.index !== 'number') continue;
    if (best === -1 || m.index < best) best = m.index;
  }
  return best;
};

const isLikelyAiFailureText = (text: string): boolean => {
  const t = String(text || '')
    .trim()
    .toLowerCase();
  if (!t) return true;
  return (
    t.startsWith('⚠️') ||
    t.includes('stream ended without output') ||
    t.includes('ai returned an empty response') ||
    t.includes('ai returned no output') ||
    t.includes('failed to start ai') ||
    t.includes('nie udało się uruchomić ai') ||
    t.includes('nie udalo sie uruchomic ai')
  );
};

const extractSlashPayload = (raw: string, commands: string[]): string | null => {
  const trimmed = String(raw || '').trim();
  const lower = trimmed.toLowerCase();
  for (const cmd of commands) {
    if (!lower.startsWith(cmd)) continue;
    const payload = trimmed.slice(cmd.length).trim();
    return payload || '';
  }
  return null;
};

const isUuidLike = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());

const canvasStarterFromText = (input: string): CanvasStarterId => {
  if (/research|badani|researchu|market|rynek|evidence|źród|zrodl|source/i.test(input)) {
    return 'research';
  }
  if (/decyz|decision|wyb[oó]r|opcj/i.test(input)) return 'decision';
  if (/plan|roadmap|harmonogram|krok|działan|dzialan/i.test(input)) return 'plan';
  if (/notatk|note|myśli|mysli|thought/i.test(input)) return 'thoughts';
  return 'document';
};

/**
 * Deliverables light (L1, krok 6): checklista Task-Progress generacji decka
 * w czacie (wzorzec Kimi) — jedna wiadomość AI edytowana w miarę przechodzenia
 * stanów planning→generating→validating→draft.
 */
type ChecklistFormat = 'deck' | 'doc' | 'sheet';

/** Etykiety checklisty per format i język — jedna mapa zamiast zagnieżdżonych ternari. */
const CHECKLIST_COPY: Record<
  ChecklistFormat,
  Record<'pl' | 'en', { noun: string; units: string; generating: string; doneHint: string }>
> = {
  deck: {
    pl: {
      noun: 'Prezentacja',
      units: 'slajdów',
      generating: 'Generowanie slajdów',
      doneHint: 'Możesz ją tam przejrzeć albo otworzyć w Deck Builderze.',
    },
    en: {
      noun: 'Presentation',
      units: 'slides',
      generating: 'Generating slides',
      doneHint: 'Review it there or open it in Deck Builder.',
    },
  },
  doc: {
    pl: {
      noun: 'Dokument',
      units: 'sekcji',
      generating: 'Pisanie treści',
      doneHint: 'Możesz go tam edytować albo wyeksportować.',
    },
    en: {
      noun: 'Document',
      units: 'sections',
      generating: 'Writing content',
      doneHint: 'Edit it there or export it.',
    },
  },
  sheet: {
    pl: {
      noun: 'Arkusz',
      units: 'wierszy',
      generating: 'Budowanie tabeli',
      doneHint: 'Możesz go tam edytować, wysłać do Table Studio albo wyeksportować (XLSX/CSV).',
    },
    en: {
      noun: 'Sheet',
      units: 'rows',
      generating: 'Building the table',
      doneHint: 'Edit it there, send it to Table Studio or export it (XLSX/CSV).',
    },
  },
};

const deckGenerationChecklist = (params: {
  lang: string;
  title: string;
  phase: 'planning' | 'plan_ready' | 'generating' | 'validating' | 'draft' | 'error';
  planCount?: number;
  /** E2: tytuły sekcji planu — pokazywane jako pod-punkty po plan_ready. */
  planItems?: DeliverableGenerationPlanItem[];
  unitCount?: number;
  /** B4: liczba źródeł org użytych do groundingu (auto-skan lub wskazane). */
  sourcesCount?: number;
  /** E2: tytuły źródeł — pokazywane jako pod-punkty obok licznika. */
  sources?: Array<{ sourceType: string; sourceId: string; sourceTitle?: string }>;
  error?: string;
  /** L2/L3: jedna checklista dla deck/doc/sheet — różnią się tylko etykiety. */
  format?: ChecklistFormat;
}): string => {
  const pl = params.lang === 'pl';
  const copy = CHECKLIST_COPY[params.format || 'deck'][pl ? 'pl' : 'en'];
  const order = ['plan_ready', 'generating', 'validating', 'draft'] as const;
  const reached = (step: (typeof order)[number]): boolean => {
    if (params.phase === 'error') return false;
    if (params.phase === 'planning') return false;
    return order.indexOf(step) <= order.indexOf(params.phase as (typeof order)[number]);
  };
  const mark = (step: (typeof order)[number]) => (reached(step) ? 'x' : ' ');

  const enabledItems = params.planItems?.filter((i) => i.enabled) ?? [];
  const planCountDisplay = params.planCount ?? (enabledItems.length || undefined);
  const planCountSuffix = planCountDisplay ? ` — ${planCountDisplay} ${copy.units}` : '';
  const planLabel = pl
    ? `Plan: ${copy.noun.toLowerCase()}${planCountSuffix}`
    : `${copy.noun} plan${planCountSuffix}`;
  const heading = pl
    ? `**${copy.noun}: „${params.title}”**`
    : `**${copy.noun}: “${params.title}”**`;

  const planSubItems =
    reached('plan_ready') && enabledItems.length > 0
      ? enabledItems.map((item) => `  - ${item.title}`)
      : [];

  const sourcesCount = params.sourcesCount ?? params.sources?.length ?? 0;
  const sourceSubItems =
    reached('plan_ready') && params.sources && params.sources.length > 0
      ? params.sources.filter((s) => s.sourceTitle).map((s) => `  - ${s.sourceTitle}`)
      : [];

  const lines = [
    heading,
    '',
    `- [${mark('plan_ready')}] ${planLabel}`,
    ...planSubItems,
    ...(sourcesCount > 0
      ? [
          `- [${mark('plan_ready')}] ${
            pl
              ? `Źródła organizacji — ${sourcesCount} znalezione`
              : `Organization sources — ${sourcesCount} found`
          }`,
          ...sourceSubItems,
        ]
      : []),
    `- [${mark('generating')}] ${copy.generating}`,
    `- [${mark('validating')}] ${pl ? 'Walidacja treści' : 'Validating content'}`,
    `- [${mark('draft')}] ${pl ? 'Artefakt gotowy' : 'Artifact ready'}`,
  ];
  if (params.phase === 'draft') {
    const unitsSuffix = params.unitCount ? ` (${params.unitCount} ${copy.units})` : '';
    lines.push(
      '',
      pl
        ? `✅ Gotowe — ${copy.noun.toLowerCase()}${unitsSuffix} jest po prawej stronie. ${copy.doneHint}`
        : `✅ Done — the ${copy.noun.toLowerCase()}${unitsSuffix} is on the right. ${copy.doneHint}`
    );
  }
  if (params.phase === 'error') {
    lines.push(
      '',
      pl
        ? `❌ Generacja nie powiodła się${params.error ? `: ${params.error}` : '.'}`
        : `❌ Generation failed${params.error ? `: ${params.error}` : '.'}`
    );
  }
  return lines.join('\n');
};

/**
 * B2 (artifact lifecycle): rejestruje chat-generated deliverable (deck/doc)
 * jako artefakt rozmowy w useArtifactsStore (persisted w localStorage).
 * Zasila przełącznik artefaktów w panelu canvas + przywracanie aktywnego
 * artefaktu po reloadzie. Chip w transkrypcie idzie osobno, z server-side
 * metadata wiadomości (metadata.deliverable).
 */
const registerChatDeliverable = (
  kind: 'deck' | 'doc' | 'sheet',
  generationId: string,
  title: string
) => {
  const conversationId = useConversationStore.getState().activeConversationId;
  if (!conversationId) return;
  useArtifactsStore.getState().registerConversationDeliverable(conversationId, {
    id: `deliverable-${generationId}`,
    type: kind === 'doc' ? 'document' : kind === 'sheet' ? 'table' : 'deck',
    title,
    content: '',
    createdAt: new Date(),
    metadata: { deliverable: { kind, generationId, title } },
  } as Artifact);

  // DEC-1 (Harvard R1 #8): register the artifact in the M17 Outputs library with a
  // back-reference (sourceType=chat, sourceId=conversationId) so the deliverable
  // actually lands in Materiały — the local store above only feeds the in-canvas
  // artifact switcher. Fire-and-forget + fail-soft: a non-v8 org (404) or any
  // registry error must never break the chat flow.
  void Api.post('/artifacts/register-chat', { kind, generationId, title, conversationId }).catch(
    () => undefined
  );
};

/**
 * Kimi-parity: panel canvasa montuje się przed końcem generacji, więc pojedynczy
 * event może wyścigać się z hydratacją draftu. Emitujemy z retry — listener w
 * panelu jest idempotentny (odświeża tylko, dopóki widzi szkielet).
 */
const announceDeliverableDraftReady = (draftId: string): void => {
  [0, 2000, 5000].forEach((delay) => {
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('deliverables:draft-ready', { detail: { draftId } }));
    }, delay);
  });
};

const parseChatCanvasIntent = (rawContent: string): ChatCanvasIntent | null => {
  const raw = String(rawContent || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  const slashPayload = extractSlashPayload(raw, ['/canvas', '/kanwa', '/research-canvas']);
  if (slashPayload !== null) {
    const prompt = slashPayload || raw;
    return { starterId: canvasStarterFromText(prompt), cleanPrompt: prompt };
  }

  // Match "canvas" / Polish locative "canvasie" / "kanwa"/"kanwie" etc. — the
  // \bcanvas\b boundary used to miss "w Canvasie", so the request fell through
  // to the backend copilot and misrouted to an Initiatives·create proposal.
  const mentionsCanvas = /\bcanvas\w*|\bkanw\w*|obszar roboczy|work area/i.test(lower);
  if (!mentionsCanvas) return null;
  const asksToRoute =
    /wrzu[cć]|przenie[sś]|otw[oó]rz|zrob|zrób|stw[oó]rz|utw[oó]rz|poka[zż]|wy[sś]wietl|przedstaw|wstaw|umie[sś][cć]|review|open|create|start|show|display|put/i.test(
      lower
    );
  if (!asksToRoute) return null;
  return { starterId: canvasStarterFromText(lower), cleanPrompt: raw };
};

const parseChatSaveIntent = (rawContent: string): ChatSaveIntent | null => {
  const raw = String(rawContent || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  const notePayload = extractSlashPayload(raw, ['/note', '/notatka']);
  if (notePayload !== null) {
    return {
      target: 'note',
      cleanPrompt:
        notePayload ||
        'Utworz krotka, uporzadkowana notatke na podstawie naszej rozmowy. Dodaj tytul i tresc.',
    };
  }

  const ideaPayload = extractSlashPayload(raw, ['/idea', '/pomysl', '/pomysł']);
  if (ideaPayload !== null) {
    return {
      target: 'idea',
      cleanPrompt:
        ideaPayload ||
        'Utworz konkretny pomysl do wdrozenia na podstawie naszej rozmowy. Dodaj tytul i opis.',
    };
  }

  const asksToSave = /(^|\s)zapisz(\s|$)|(^|\s)save(\s|$)/i.test(lower);
  if (!asksToSave) return null;

  const asksIdea = /pomysł|pomysl|idea|ideas/i.test(lower);
  const asksNote = /notatk|notebook|note/i.test(lower);

  if (asksIdea && asksNote) {
    const noteIdx = firstMatchIndex(lower, [/notatk/i, /notebook/i, /\bnote\b/i]);
    const ideaIdx = firstMatchIndex(lower, [/pomysł/i, /pomysl/i, /\bidea\b/i, /\bideas\b/i]);
    if (noteIdx >= 0 && ideaIdx >= 0) {
      return noteIdx <= ideaIdx
        ? { target: 'note', cleanPrompt: raw }
        : { target: 'idea', cleanPrompt: raw };
    }
  }

  if (asksIdea) return { target: 'idea', cleanPrompt: raw };
  if (asksNote) return { target: 'note', cleanPrompt: raw };

  return null;
};

export const __private__ = {
  firstMatchIndex,
  isLikelyAiFailureText,
  extractSlashPayload,
  parseChatCanvasIntent,
  parseChatSaveIntent,
  describeUnconfirmedTeresaResult,
};

interface UnifiedChatPanelProps {
  /** Display mode: full-screen or split-screen */
  mode?: ChatDisplayMode;

  /** Custom class name */
  className?: string;

  /** Whether to show expand/collapse button */
  showModeToggle?: boolean;

  /** Callback when mode toggle is clicked */
  onModeToggle?: () => void;

  /** Callback for "back" button in split mode */
  onBack?: () => void;

  /** Whether to show the sliding history panel trigger */
  showHistoryTrigger?: boolean;

  /** Optional title override */
  title?: string;

  /** Whether to show focus mode selector */
  showFocusMode?: boolean;

  /** Current workspace context (for AI awareness) */
  workspaceContext?: WorkspaceContext | null;

  /** Whether the panel is disabled */
  disabled?: boolean;

  /** Max height for the panel (useful in split mode) */
  maxHeight?: string;

  /** Callback when user sends a message */
  onMessageSent?: (content: string) => void;

  /** Optional active-module handler. When handled, Teresa owns the visible turn. */
  onModuleIntent?: (
    content: string
  ) =>
    | Promise<boolean | { handled: boolean; reply?: string }>
    | boolean
    | { handled: boolean; reply?: string };

  /** Callback when user clicks "View All Actions" */
  onNavigateToActions?: () => void;

  /** Optional system prompt override */
  systemPrompt?: string;

  /** Optional role name override */
  roleName?: string;

  /** Callback when user selects an interactive option */
  onOptionSelect?: (option: { id: string; label: string; value: string }) => void;

  /** Callback when user selects multiple interactive options */
  onMultiSelectSubmit?: (values: string[]) => void;

  /** Optional messages override for ephemeral/specialized views */
  customMessages?: ChatMessage[];

  /** One-shot kickoff message to auto-send (split panel) */
  kickoffMessage?: string;
  /** Callback after kickoff message is consumed */
  onKickoffConsumed?: () => void;

  /** Per-tab quick prompt chips shown above the input */
  quickPrompts?: string[];

  /**
   * Persistent contextual command buttons (D17): rendered above the input and
   * ALWAYS visible (unlike quickPrompts, which vanish after the first message).
   * An artifact view publishes these when it hands off to the one docked Teresa
   * panel, so its "AI Consultant" actions live inside Teresa. See
   * ChatContextAction (uiSlice).
   */
  contextActions?: ChatContextAction[];
}

// ============================================================================
// Component
// ============================================================================

export const UnifiedChatPanel: React.FC<UnifiedChatPanelProps> = ({
  mode = 'full',
  className = '',
  showModeToggle = true,
  onModeToggle,
  onBack,
  showHistoryTrigger = true,
  title,
  showFocusMode = true,
  workspaceContext,
  disabled = false,
  maxHeight,
  onMessageSent,
  onModuleIntent,
  onNavigateToActions,
  systemPrompt,
  roleName,
  onOptionSelect,
  onMultiSelectSubmit,
  customMessages,
  kickoffMessage,
  onKickoffConsumed,
  quickPrompts,
  contextActions,
}) => {
  const route = useLocation();
  const navigateToRoute = useNavigate();
  const { t, i18n } = useTranslation();
  const { isEnabled } = useFeatureFlagsContext();
  const signalsEnabled = isEnabled('myWorkSignalsV2');

  const routeInfo = useMemo(
    () => ({
      pathname: route.pathname,
      search: route.search,
      hash: route.hash,
    }),
    [route.hash, route.pathname, route.search]
  );

  // ========================================================================
  // Store hooks
  // ========================================================================

  const {
    currentStreamContent,
    isBotTyping,
    addChatMessage,
    deleteChatMessage,
    setIsBotTyping,
    aiFreezeStatus,
    aiConfig,
    setAIConfig,
    currentUser,
    currentOrganization,
  } = useAppStore();

  const {
    activeConversationId,
    activeMessages,
    isLoading: isConversationLoading,
    isSidebarOpen,
    displayMode,
    createConversation,
    addMessage: addMessageToConversation,
    setActiveConversation,
    fetchConversation,
    clearActiveChat,
    truncateFromMessage,
    toggleSidebar,
    setDisplayMode,
    expandToFullScreen,
    collapseToSplit,
    draftChatLanguage,
    chatLanguageByConversationId,
    _activeConversationState,
    _activeConversationStateMessage,
    notifyModelChange,
    exportConversation,
    purgeConversation,
  } = useConversationStore();

  const { addArtifact, togglePanel: toggleArtifactsPanel, exportArtifact } = useArtifactsStore();

  const pendingActionsCount = useAIActionsStore((s) => s.pendingCount);
  const { handleAction: handleChatAction } = useChatActions();

  // B3 patch-mode — useCanvasAIStream reports the outcome of a surgical
  // canvas patch via 'canvas-patch-result' (it has no chat access). Reply
  // briefly here: success → point the user at the diff; fallback → visible
  // note that we degraded to the full rewrite stream.
  useEffect(() => {
    const onPatchResult = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { status?: 'applied' | 'fallback'; opsApplied?: number }
        | undefined;
      if (!detail?.status) return;
      const uiLang = (i18n.language || 'en').split('-')[0];
      const content =
        detail.status === 'applied'
          ? uiLang === 'pl'
            ? 'Zmieniłem wskazany fragment — przejrzyj diff w dokumencie i zaakceptuj lub odrzuć poprawkę.'
            : 'I changed the targeted fragment — review the diff in the document and accept or reject the edit.'
          : uiLang === 'pl'
            ? 'Nie udało się przygotować punktowej poprawki — przepisuję wskazany fragment w trybie pełnym.'
            : 'Could not prepare a targeted patch — rewriting via the full streaming mode instead.';
      addChatMessage({
        id: `canvas-patch-${Date.now()}`,
        role: 'ai',
        content,
        timestamp: new Date(),
      });
    };
    window.addEventListener('canvas-patch-result', onPatchResult);
    return () => window.removeEventListener('canvas-patch-result', onPatchResult);
  }, [addChatMessage, i18n.language]);

  // Z20 (fala4-z20-intercept): track which Idea Workspace canvas tool (if any)
  // is currently mounted — IdeaMapWorkspace broadcasts this via
  // 'idea-workspace-active-tool' (null when no idea doc / no matching tool is
  // open). The mm/pf/wb chat interceptors below gate on this so a "create
  // mind map/process/whiteboard" prompt only gets intercepted+local-actioned
  // when the matching tool is actually open; otherwise it falls through to
  // the normal LLM flow instead of silently no-op'ing.
  const [activeIdeaWorkspaceTool, setActiveIdeaWorkspaceTool] = useState<string | null>(null);
  useEffect(() => {
    const onActiveIdeaTool = (event: Event) => {
      const detail = (event as CustomEvent).detail as { tool?: string | null } | undefined;
      setActiveIdeaWorkspaceTool(detail?.tool ?? null);
    };
    window.addEventListener('idea-workspace-active-tool', onActiveIdeaTool);
    return () => window.removeEventListener('idea-workspace-active-tool', onActiveIdeaTool);
  }, []);

  // E10 (2026-08-10, doc09 §9 Z4 "Teresa controls everything" / master
  // program §8.4): mirror of the `activeIdeaWorkspaceTool` listener above,
  // for the live element/edge/row selection — `IdeaMapWorkspace.tsx`
  // broadcasts it on 'idea-workspace-active-selection' every time it changes
  // (same shell state its own Tools/right panel already uses). Kept as a
  // ref, not state: it must be read at tool-call time inside `onIdeaAction`
  // without forcing that whole callback to re-close over fresh state on
  // every selection change (same pattern as `teresaIdeaCtxRef` right below).
  // BEFORE this change `executeTeresaTool` always sent
  // `selection: EMPTY_SELECTION` here — Teresa's `ctx.selection` was dead for
  // every real chat call (the only working path was the LLM supplying an
  // element id directly as a tool argument). This makes "act on what I have
  // selected" actually reach the registry the same way a UI click does.
  const teresaIdeaSelectionRef = useRef<{
    ideaId: string;
    tool: string | null;
    selection: IdeaWorkspaceSelection;
  } | null>(null);
  useEffect(() => {
    const onActiveIdeaSelection = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { ideaId?: string; tool?: string | null; selection?: IdeaWorkspaceSelection }
        | undefined;
      teresaIdeaSelectionRef.current = detail
        ? {
            ideaId: detail.ideaId || '',
            tool: detail.tool ?? null,
            selection: detail.selection || EMPTY_SELECTION,
          }
        : null;
    };
    window.addEventListener('idea-workspace-active-selection', onActiveIdeaSelection);
    return () =>
      window.removeEventListener('idea-workspace-active-selection', onActiveIdeaSelection);
  }, []);

  // E10: read the live selection ONLY when its ideaId+tool still match the
  // idea/tool this specific tool-call is executing against — a broadcast
  // left over from a just-closed workspace or a just-switched tool must NOT
  // silently apply to a different one (same "no silent fallback" rule this
  // whole wiring exists to satisfy, applied to the wiring itself).
  const getLiveTeresaSelection = useCallback(
    (ideaId: string, tool: string): IdeaWorkspaceSelection => {
      const live = teresaIdeaSelectionRef.current;
      if (!live || live.ideaId !== ideaId || live.tool !== tool) return EMPTY_SELECTION;
      return live.selection;
    },
    []
  );

  // Z4 transport — kontekst Idei zapamiętany W CHWILI WYSYŁKI (tool + ideaId), z
  // którym wróci tool-call. Dzięki temu wykonanie na froncie dotyczy dokładnie
  // tej reprezentacji, którą model widział (manifest jest po niej filtrowany).
  const teresaIdeaCtxRef = useRef<{ ideaId: string; tool: CanvasToolType } | null>(null);
  // Flaga buildowa jest default ON. Jawne `false` jest kill-switchem, który
  // przywraca legacy regex fallback; registry i fallback nigdy nie wykonują
  // tego samego polecenia równolegle.
  const teresaIdeaActionsEnabled = import.meta.env.VITE_ENABLE_TERESA_IDEA_ACTIONS !== 'false';

  // ========================================================================
  // Local state (must be declared before hooks that depend on them)
  // ========================================================================

  const [focusMode, setFocusMode] = useState<FocusMode>('all');
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
  // Auto-read is driven by textToSpeech from ToolsMenu (aiConfig) or manual toggle
  const [autoReadEnabled, setAutoReadEnabled] = useState(aiConfig?.textToSpeech ?? false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [editBusy, setEditBusy] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [isWorkPanelOpen, setIsWorkPanelOpen] = useState(false);
  const [requestedCanvasStarterId, setRequestedCanvasStarterId] = useState<CanvasStarterId | null>(
    null
  );
  const [requestedCanvasDraftId, setRequestedCanvasDraftId] = useState<string | null>(null);
  // Deliverables light (L1): deck montowany w prawym panelu (starter 'presentation').
  const [requestedCanvasDeckId, setRequestedCanvasDeckId] = useState<string | null>(null);
  const [activeCanvasDocument, setActiveCanvasDocument] = useState<ActiveCanvasDocument | null>(
    null
  );
  const [activeCanvasSelection, setActiveCanvasSelection] = useState<CanvasSelection | null>(null);
  const [workCanvasWidthPercent, setWorkCanvasWidthPercent] = useState(getInitialWorkCanvasWidth);
  const [tableBuilderOpen, setTableBuilderOpen] = useState(false);
  const [tableBuilderInitialMsg, setTableBuilderInitialMsg] = useState<string | undefined>();
  const lastKickoffSentRef = useRef<string | null>(null);
  // P2-2 (audyt): poll generacji deliverables ginie razem z widokiem czatu.
  const deliverablesPollAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    deliverablesPollAbortRef.current = controller;
    return () => controller.abort();
  }, []);
  const splitShellRef = useRef<HTMLDivElement | null>(null);
  // Message id already jumped to (M01-P02 history search deep link), so a
  // later re-render does not re-scroll the user away from where they are.
  const jumpedMessageRef = useRef<string | null>(null);
  const pendingChatSaveIntentRef = useRef<{
    target: ChatSaveTarget;
    originalUserMessage: string;
  } | null>(null);

  const chatLanguage: SupportedLanguage = useMemo(() => {
    // 1. User's explicit preference (set via ChatLanguageSelector) - highest priority
    const explicitPref =
      localStorage.getItem('consultinity-preferred-chat-lang') ||
      localStorage.getItem('consultify-preferred-chat-lang');
    // 2. Conversation-specific language (from DB/store)
    const activeLang = activeConversationId
      ? chatLanguageByConversationId[activeConversationId]
      : undefined;
    // 3. UI language (i18n) — always follow the current app language unless overridden above
    const uiLang = i18n.language?.split('-')[0] || 'en';
    const candidate = explicitPref || activeLang || uiLang;
    const base = String(candidate).split('-')[0];
    return (normalizeLanguageCode(base) ||
      (isValidLanguage(base) ? (base as SupportedLanguage) : 'en')) as SupportedLanguage;
  }, [activeConversationId, chatLanguageByConversationId, i18n.language]);

  // Voice Hook (uses autoReadEnabled state)
  const {
    speak,
    stopSpeaking,
    state: voiceState,
    startListening,
    stopListening,
    settings: voiceSettings,
    updateSettings: updateVoiceSettings,
    isSupported: ttsSupported,
  } = useUniversalVoice({
    onSendMessage: (msg) => handleSendMessage(msg),
    settings: {
      autoSpeakResponses: autoReadEnabled,
      sttProvider: 'whisper',
      ttsProvider: 'web',
      language: chatLanguage,
    },
  });

  // Teresa real-time voice — global context (persists across navigation)
  const teresaVoice = useTeresaVoiceContext();

  const {
    isDemo,
    timeRemainingMs: demoTimeRemainingMs,
    aiInteractionsRemaining,
    aiInteractionsLimit,
    consumeAIInteraction,
  } = useDemoSession();

  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [contextSaveBusyMessageId, setContextSaveBusyMessageId] = useState<string | null>(null);
  const [contextSavedMessageIds, setContextSavedMessageIds] = useState<Set<string>>(new Set());
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<string[]>([]);
  const [dtHintDismissed, setDtHintDismissed] = useState(false);
  const [abortFeedback, setAbortFeedback] = useState<'partial' | 'cancelled' | null>(null);
  const [partialRecovery, setPartialRecovery] = useState<{
    sessionId: string;
    content: string;
    updatedAt?: string;
  } | null>(null);
  const [partialRecoveryError, setPartialRecoveryError] = useState<string | null>(null);
  const [isResumingPartial, setIsResumingPartial] = useState(false);
  const [dtSavingDecision, setDtSavingDecision] = useState<string | null>(null);
  const [dtDecisionSaved, setDtDecisionSaved] = useState<Set<string>>(new Set());
  const [dtPendingConfirm, setDtPendingConfirm] = useState<{
    messageId: string;
    conversationId: string | null;
    originalMessage: string;
    editedMessage: string;
    confirm: any;
    context: any;
    attachments?: any[];
    agentAudit?: {
      suggested?: any;
      orchestratorRunId?: string;
      selectedAgentIds: string[];
      userIntent: 'validate' | 'stress_test' | 'approve';
      maxAgents: 2 | 3 | 4;
      decisionContext?: {
        topic: string;
        industry?: string;
        horizon?: string;
        functions?: string[];
        riskFocus?: string[];
      };
    };
  } | null>(null);
  const [dtConfirmBusy, setDtConfirmBusy] = useState(false);

  // Krok A (domknięcie Teresy — potwierdzenie akcji `confirmBeforeRun` w czacie).
  // Ten sam wzorzec co `dtPendingConfirm` powyżej: stan lokalny trzyma DOKŁADNIE
  // jedno oczekujące potwierdzenie (message.id → parametry ponownego wywołania),
  // a wiadomość w historii dostaje tylko znacznik `metadata.teresaConfirm` —
  // gdy stan lokalny zniknie (po kliknięciu), przyciski znikają z tej wiadomości
  // i nie da się wykonać akcji dwa razy.
  const [teresaPendingConfirm, setTeresaPendingConfirm] = useState<{
    messageId: string;
    toolName: string;
    args?: Record<string, unknown>;
    ideaId: string;
    tool: CanvasToolType;
    language: 'pl' | 'en';
    // E10 (2026-08-10): the selection captured at PROPOSAL time, not
    // re-sampled when the user clicks "Confirm" — the confirm dialog shows
    // the target based on this selection, so executing against a
    // possibly-drifted live selection instead (user clicked something else
    // in the canvas while the confirmation was pending) would silently
    // change what "Confirm" actually does versus what was shown.
    selection: IdeaWorkspaceSelection;
  } | null>(null);
  const [teresaConfirmBusy, setTeresaConfirmBusy] = useState(false);

  // Agent Audit Layer (registry + post-DT verdict)
  const [agentRegistryById, setAgentRegistryById] = useState<Record<string, any>>({});
  const [agentAuditBusy, setAgentAuditBusy] = useState(false);
  const [agentAuditActiveTabByMessageId, setAgentAuditActiveTabByMessageId] = useState<
    Record<string, string>
  >({});
  const deepThinkingRunRef = useRef<{
    conversationId: string | null;
    decisionContext: {
      topic: string;
      industry?: string;
      horizon?: string;
      functions?: string[];
      riskFocus?: string[];
    };
    agentIds: string[];
    userIntent: 'validate' | 'stress_test' | 'approve';
    loopIteration: 1 | 2;
    deepThinkingConfirm: any;
  } | null>(null);
  const agentAuditVerdictRef = useRef<any>(null);
  const persistedAgentAuditRunIdsRef = useRef<Set<string>>(new Set());

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoReadEnabledRef = useRef(autoReadEnabled);

  // Keep ref in sync with state
  useEffect(() => {
    autoReadEnabledRef.current = autoReadEnabled;
  }, [autoReadEnabled]);

  // Sync autoReadEnabled with textToSpeech from ToolsMenu (aiConfig)
  useEffect(() => {
    const ttsFromConfig = aiConfig?.textToSpeech ?? false;
    if (ttsFromConfig !== autoReadEnabled) {
      setAutoReadEnabled(ttsFromConfig);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiConfig?.textToSpeech]);

  useEffect(() => {
    setContextSavedMessageIds(new Set());
    setContextSaveBusyMessageId(null);
  }, [activeConversationId]);

  // V8 / Wave A6 — seed the unified proposal lifecycle cache when a
  // conversation is opened so chat bubbles can render the freshest state
  // rather than the snapshot frozen into each message's metadata at write time.
  useEffect(() => {
    if (!activeConversationId) return;
    void useProposalLifecycleStore.getState().loadForConversation(activeConversationId);
  }, [activeConversationId]);

  // B2 (artifact lifecycle): on conversation open, restore the conversation's
  // artifact list + persisted active artifact from localStorage.
  useEffect(() => {
    if (!activeConversationId) return;
    useArtifactsStore.getState().loadConversationArtifacts(activeConversationId);
  }, [activeConversationId]);

  // Session hook: create new session when model/preset changes mid-conversation (§2.3.1)
  const prevModelRef = useRef<string | null>(null);
  useEffect(() => {
    const currentModel = (aiConfig as any)?.selectedModelId ?? null;
    if (
      prevModelRef.current !== null &&
      currentModel !== prevModelRef.current &&
      activeConversationId
    ) {
      void notifyModelChange({
        modelId: currentModel || undefined,
        presetId: (aiConfig as any)?.selectedTier || undefined,
        locale: draftChatLanguage || undefined,
      });
    }
    prevModelRef.current = currentModel;
  }, [
    (aiConfig as any)?.selectedModelId,
    activeConversationId,
    notifyModelChange,
    draftChatLanguage,
  ]);

  // Ref for incremental TTS (defined here, used in effects after useAIStream)
  const spokenCharsRef = useRef(0);

  // Agent registry (for readable labels in approval UI)
  useEffect(() => {
    let mounted = true;
    Api.agentAuditListAgents()
      .then((res: any) => {
        const list = (res as any)?.agents || [];
        if (!mounted) return;
        const map: Record<string, any> = {};
        for (const a of list) {
          if (a?.id) map[String(a.id)] = a;
        }
        setAgentRegistryById(map);
      })
      .catch(() => {
        // best-effort; UI will fall back to ids
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Computed values
  const isWorkPanelMode = mode === 'full' && isWorkPanelOpen;
  const isSplitMode =
    isWorkPanelMode || mode === 'split' || (mode !== 'full' && displayMode === 'split');
  const isCompact = isSplitMode;
  const isDisabled = disabled || aiFreezeStatus.isFrozen;
  const isPrivateMode = Boolean((aiConfig as any)?.privateMode);
  const isRtlChatLanguage = isRtlLanguage(chatLanguage);

  // ========================================================================
  // AI Stream hook
  // ========================================================================

  const saveMessageAsIdea = useCallback(
    async (
      messageId: string,
      content: string,
      options?: {
        navigateToMyWork?: boolean;
        autoTriggered?: boolean;
      }
    ) => {
      const trimmed = String(content || '').trim();
      if (!trimmed) return;

      const firstLine =
        trimmed
          .split('\n')
          .map((l) => l.replace(/^#+\s*/, '').trim())
          .find((l) => !!l) || '';
      const title = firstLine.slice(0, 120) || t('chat.titles.idea', 'Idea');

      const navigateToMyWork = options?.navigateToMyWork !== false;
      const autoTriggered = options?.autoTriggered === true;

      try {
        if (navigateToMyWork) {
          const creationPayload: IdeaWorkspaceCreationPayload = {
            title,
            body: trimmed,
            tags: [],
            sourceType: 'chat',
            sourceConversationId: activeConversationId,
            sourceMessageId: messageId,
          };
          const seedIntent: IdeaWorkspaceSeedIntent = {
            startMode: 'describe_with_ai',
            seedText: trimmed,
            preferredSystem: 'mindmap',
            templateId: null,
            popularStartId: null,
            popularStartLabel: null,
            structuredBrief: null,
            source: 'chat_handoff',
          };
          const draftId = `new-idea-${Date.now()}`;

          trackFunnelEvent('my_idea_saved', {
            source: autoTriggered ? 'chat_auto' : 'chat',
            ideaId: draftId,
            messageId,
            handoff: true,
          });
          toast.success(
            autoTriggered
              ? t('myWork.ideas.savedFromChatToast', 'Saved from chat to My Ideas')
              : t('myWork.ideas.sentToWorkspaceToast', 'Opened in Ideas workspace')
          );

          try {
            const { setMyWorkIntent, setCurrentView } = useAppStore.getState() as any;
            setMyWorkIntent?.({
              tab: 'ideas',
              open: {
                type: 'idea',
                id: draftId,
                name: title,
                data: {
                  isNew: true,
                  creationPayload,
                  seedIntent,
                },
              },
            });
            setCurrentView?.(AppView.MY_WORK);
          } catch {
            // ignore
          }
          return;
        }

        const created = await Api.createIdeaFromChat({
          title,
          seedText: trimmed,
          sourceConversationId: activeConversationId || undefined,
          sourceMessageId: messageId,
          startMode: 'describe_with_ai',
          preferredSystem: 'mindmap',
        });

        trackFunnelEvent('my_idea_saved', {
          source: autoTriggered ? 'chat_auto' : 'chat',
          ideaId: created?.ideaId,
          messageId,
        });
        toast.success(
          autoTriggered
            ? t('myWork.ideas.savedFromChatToast', 'Saved from chat to My Ideas')
            : t('myWork.ideas.savedToast', 'Saved to My Ideas')
        );
      } catch (err) {
        console.error('[UnifiedChatPanel] Failed to save idea:', err);
        toast.error(t('myWork.errors.createFailed', 'Failed to create idea'));
      }
    },
    [activeConversationId, i18n.language, t]
  );

  const saveMessageAsNote = useCallback(
    async (
      messageId: string,
      content: string,
      options?: {
        navigateToMyWork?: boolean;
        autoTriggered?: boolean;
      }
    ) => {
      const trimmed = String(content || '').trim();
      if (!trimmed) return;

      const firstLine =
        trimmed
          .split('\n')
          .map((l) => l.replace(/^#+\s*/, '').trim())
          .find((l) => !!l) || '';
      const title = firstLine.slice(0, 120) || t('chat.titles.note', 'Note');

      const navigateToMyWork = options?.navigateToMyWork !== false;
      const autoTriggered = options?.autoTriggered === true;

      try {
        const created = await Api.post('/my-work/notebook/pages', {
          title,
          visibility: 'private',
          tags: [],
          contentText: trimmed,
          contentJson: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: trimmed }],
              },
            ],
          },
          source: { type: 'chat', conversationId: activeConversationId, messageId },
        });

        trackFunnelEvent('notebook_page_saved', {
          source: autoTriggered ? 'chat_auto' : 'chat',
          pageId: (created as any)?.id,
          messageId,
        });
        toast.success(
          autoTriggered
            ? t('myWork.notebook.savedFromChatToast', 'Saved from chat to Notebook')
            : t('myWork.notebook.savedToast', 'Saved to Notebook')
        );

        if (navigateToMyWork) {
          try {
            const { setMyWorkIntent, setCurrentView } = useAppStore.getState() as any;
            setMyWorkIntent?.({ tab: 'notebook' });
            setCurrentView?.(AppView.MY_WORK);
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.error('[UnifiedChatPanel] Failed to save note:', err);
        toast.error(t('myWork.errors.createFailed', 'Failed to create'));
      }
    },
    [activeConversationId, i18n.language, t]
  );

  const {
    startStream,
    abortStream,
    retryLastStream,
    lastError,
    clearLastError,
    checkPartialResponse,
    resumeFromPartial,
    isStreaming,
    streamedContent,
    reasoning: streamedReasoning,
    policyDecision,
    policyNotices,
    memoryCandidate,
    teresaProposal,
    researchProgress,
    researchVisibility,
    deepThinkingState,
    deepThinkingHint,
    interimInsight,
    agentAuditState,
    agentAuditVerdict,
    agentReviewProgressByAgentId,
    agentSourcesByAgentId,
    retryInfo,
    streamStartedAt,
    streamCompletedSignal,
  } = useAIStream({
    onStreamDone: async (fullText, thinking, artifacts, meta) => {
      const safeText =
        typeof fullText === 'string' && fullText.trim().length > 0
          ? fullText
          : getTeresaEmptyResponseMessage(i18n.language);

      // Feedback #53cc607e — read the active conversation id straight from the
      // store at callback time. The hook's option object is captured with the
      // component's render closure, so a conversation created *during* the send
      // (handleSendMessage → createConversation) would otherwise see a stale
      // `activeConversationId === null` here and silently skip persisting the
      // AI reply ("Chat nie pamięta rozmów").
      const liveActiveConversationId =
        useConversationStore.getState().activeConversationId || activeConversationId;

      // Feedback #5d27c9be + #f9fba1e0 (Elkomtech, 2026-06-10) — persist the reply
      // to the conversation the question was asked in, NOT whatever is active when
      // the stream finishes. The server sets streamSessionId = origin conversation id
      // (ai.routes.ts), so meta.sessionId is the authoritative target. Prod evidence:
      // three concurrent runs' replies all landed in the newest conversation (their
      // persisted streamSessionId pointed at three different origins), and replies
      // were dropped entirely when activeConversationId was momentarily null during
      // a new-chat transition.
      const sessionOriginConversationId =
        typeof meta?.sessionId === 'string' &&
        meta.sessionId.trim().length > 0 &&
        !meta.sessionId.startsWith('stream-')
          ? meta.sessionId.trim()
          : null;
      const persistConversationId = sessionOriginConversationId || liveActiveConversationId;

      let savedAiMessageId: string | null = null;
      // Save AI response to conversation store
      if (persistConversationId) {
        try {
          const saved = await addMessageToConversation({
            conversationId: persistConversationId,
            role: 'ai',
            content: safeText,
            messageType: 'text',
            metadata: buildPersistedAiResponseMetadata({
              thinking: thinking as any,
              artifacts: artifacts as any,
              citations: meta?.citations,
              sourceLedger: meta?.sourceLedger,
              streamSessionId: meta?.sessionId,
              extra:
                aiConfig?.deepResearch ||
                (aiConfig as any)?.marketResearch ||
                meta?.policyDecision ||
                (meta?.policyNotices && meta.policyNotices.length) ||
                meta?.sourceLedger ||
                meta?.trustBundle ||
                meta?.proposal ||
                meta?.reasoning
                  ? {
                      ...(aiConfig?.deepResearch || (aiConfig as any)?.marketResearch
                        ? {
                            options: [
                              { id: 'dt-go-deeper', label: 'Go deeper', value: 'Go deeper' },
                              { id: 'dt-too-shallow', label: 'Too shallow', value: 'Too shallow' },
                              {
                                id: 'dt-challenge',
                                label: 'Challenge this conclusion',
                                value: 'Challenge this conclusion',
                              },
                            ],
                            multiSelect: false,
                            deepThinking: { kind: 'report' },
                          }
                        : {}),
                      ...(meta?.policyDecision || (meta?.policyNotices && meta.policyNotices.length)
                        ? {
                            policyDecision: meta?.policyDecision,
                            policyNotices: meta?.policyNotices,
                          }
                        : {}),
                      // V8 / Wave A7 — forward the canonical trust bundle so
                      // the persisted AI row carries the same pills rendered
                      // live in the bubble. Server also enriches on write;
                      // this keeps client + server in lockstep and avoids
                      // depending on a refetch for live hydration.
                      ...(meta?.trustBundle ? { trustBundle: meta.trustBundle } : {}),
                      ...(meta?.sourceLedger ? { sourceLedger: meta.sourceLedger } : {}),
                      ...(meta?.proposal ? { proposal: meta.proposal } : {}),
                      // Persist the model's chain-of-thought so the per-message
                      // "Tok rozumowania" trace survives reload.
                      ...(meta?.reasoning ? { reasoning: meta.reasoning } : {}),
                    }
                  : undefined,
            }),
          });
          savedAiMessageId = String((saved as any)?.id || '') || null;
        } catch (err) {
          console.error('[UnifiedChatPanel] Failed to save AI message:', err);
        }
      }

      // Also update useAppStore for backward compatibility
      addChatMessage({
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: safeText,
        timestamp: new Date(),
        thinkingSteps: thinking,
        artifacts,
        ...(aiConfig?.deepResearch || (aiConfig as any)?.marketResearch
          ? ({
              options: [
                { id: 'dt-go-deeper', label: 'Go deeper', value: 'Go deeper' },
                { id: 'dt-too-shallow', label: 'Too shallow', value: 'Too shallow' },
                {
                  id: 'dt-challenge',
                  label: 'Challenge this conclusion',
                  value: 'Challenge this conclusion',
                },
              ],
              multiSelect: false,
            } as any)
          : {}),
        metadata: {
          ...(aiConfig?.deepResearch || (aiConfig as any)?.marketResearch
            ? { deepThinking: { kind: 'report' } }
            : {}),
          ...(meta?.policyDecision ? { policyDecision: meta.policyDecision } : {}),
          ...(meta?.policyNotices && meta.policyNotices.length
            ? { policyNotices: meta.policyNotices }
            : {}),
          ...(meta?.trustBundle ? { trustBundle: meta.trustBundle } : {}),
          ...(meta?.sourceLedger ? { sourceLedger: meta.sourceLedger } : {}),
          ...(meta?.proposal ? { proposal: meta.proposal } : {}),
        },
      });

      // Auto-read AI response if enabled (speak only remaining text not already spoken during streaming)
      if (autoReadEnabledRef.current && safeText) {
        const cleaned = cleanTextForSpeech(safeText);
        const remaining = cleaned.slice(spokenCharsRef.current).trim();
        if (remaining) {
          console.log('[TTS] Speaking remaining:', remaining.slice(0, 60) + '…');
          speak(remaining).catch((err) => console.warn('[TTS] speak error:', err));
        }
        spokenCharsRef.current = 0;
      }

      // Chat intent -> auto save AI output to My Work (Idea / Notebook)
      const pendingSave = pendingChatSaveIntentRef.current;
      pendingChatSaveIntentRef.current = null;
      if (pendingSave && !isLikelyAiFailureText(safeText)) {
        const aiMessageId = savedAiMessageId || `ai-auto-${Date.now()}`;
        if (pendingSave.target === 'idea') {
          await saveMessageAsIdea(aiMessageId, safeText, {
            navigateToMyWork: false,
            autoTriggered: true,
          });
        } else if (pendingSave.target === 'note') {
          await saveMessageAsNote(aiMessageId, safeText, {
            navigateToMyWork: false,
            autoTriggered: true,
          });
        }
      } else if (pendingSave && isLikelyAiFailureText(safeText)) {
        // Fallback: when AI stream fails/returns empty, still persist user intent content.
        const fallbackBody = pendingSave.originalUserMessage || '';
        const aiMessageId = savedAiMessageId || `ai-auto-fallback-${Date.now()}`;
        if (pendingSave.target === 'idea') {
          await saveMessageAsIdea(aiMessageId, fallbackBody, {
            navigateToMyWork: false,
            autoTriggered: true,
          });
        } else if (pendingSave.target === 'note') {
          await saveMessageAsNote(aiMessageId, fallbackBody, {
            navigateToMyWork: false,
            autoTriggered: true,
          });
        }
      }

      // Agent Audit Layer: run post-DT review on the CLOSED report
      if (
        aiConfig?.deepResearch &&
        deepThinkingRunRef.current &&
        // Compare origin-to-origin: the DT run started in the conversation the
        // stream belongs to, which may no longer be the active one.
        deepThinkingRunRef.current.conversationId === persistConversationId &&
        Array.isArray(deepThinkingRunRef.current.agentIds) &&
        deepThinkingRunRef.current.agentIds.length > 0
      ) {
        try {
          // Prefer streamed verdict (from SSE) if present; fallback to REST review otherwise.
          const streamed = agentAuditVerdictRef.current;
          const streamedRunId = String(streamed?.orchestratorRunId || '').trim();
          const canUseStreamed =
            streamed &&
            streamed?.verdict &&
            Array.isArray(streamed?.reviews) &&
            streamed?.reviews?.length >= 0 &&
            streamed?.loopIteration === deepThinkingRunRef.current.loopIteration &&
            !persistedAgentAuditRunIdsRef.current.has(streamedRunId);

          let verdict: any = null;
          let reviews: any[] = [];
          let runId: string | null = null;

          if (canUseStreamed) {
            verdict = streamed.verdict || {};
            reviews = streamed.reviews || [];
            runId = streamedRunId || null;
          } else {
            setAgentAuditBusy(true);
            const reviewRes = await Api.agentAuditReview({
              decisionContext: deepThinkingRunRef.current.decisionContext,
              deepThinkingReport: safeText,
              agentIds: deepThinkingRunRef.current.agentIds,
              conversationId: activeConversationId || undefined,
              dtSessionId: activeConversationId || undefined,
              webSearchEnabled: aiConfig?.webSearch === true,
              userIntent: deepThinkingRunRef.current.userIntent,
              language: chatLanguage,
              selectedTier: (aiConfig as any)?.selectedTier,
              selectedModelId: (aiConfig as any)?.selectedModelId ?? null,
              loopIteration: deepThinkingRunRef.current.loopIteration,
            });
            verdict = (reviewRes as any)?.verdict || {};
            reviews = (reviewRes as any)?.reviews || [];
            runId = String((reviewRes as any)?.orchestratorRunId || '').trim() || null;
          }

          const lines: string[] = [];
          lines.push('**Agent Audit (post Deep Thinking)**');
          lines.push(`- Status: **${String(verdict.qualityStatus || '—')}**`);
          lines.push(
            `- Gates: ${Array.isArray(verdict.gatesTriggered) && verdict.gatesTriggered.length ? verdict.gatesTriggered.join(', ') : '—'}`
          );
          lines.push(`- Reviewers: ${deepThinkingRunRef.current.agentIds.length}`);
          lines.push('');

          if (Array.isArray(verdict.criticalRisks) && verdict.criticalRisks.length) {
            lines.push('**Critical risks (high)**');
            for (const r of verdict.criticalRisks.slice(0, 6)) {
              lines.push(`- (${String(r.area || 'other')}) ${String(r.claim || '').trim()}`.trim());
            }
            lines.push('');
          }

          if (Array.isArray(verdict.actionableFollowups) && verdict.actionableFollowups.length) {
            lines.push('**Actionable follow-ups (data / gaps)**');
            for (const f of verdict.actionableFollowups.slice(0, 6)) {
              lines.push(`- ${String(f.question || '').trim()}`.trim());
            }
            lines.push('');
          }

          if (verdict?.directedLoop?.deepThinkingPrompt) {
            lines.push('**Directed deepening prompt (max 2 loops)**');
            lines.push('```');
            lines.push(String(verdict.directedLoop.deepThinkingPrompt || '').trim());
            lines.push('```');
          }

          const verdictMessageContent = lines.filter(Boolean).join('\n');
          const verdictMessageId = `agent-audit-${Date.now()}`;

          // Persist verdict into conversation (survives refresh)
          if (activeConversationId) {
            await addMessageToConversation({
              conversationId: activeConversationId,
              role: 'ai',
              content: verdictMessageContent,
              messageType: 'text',
              metadata: {
                agentAudit: {
                  kind: 'verdict',
                  orchestratorRunId: runId,
                  verdict,
                  reviews,
                  decisionContext: deepThinkingRunRef.current.decisionContext,
                  agentIds: deepThinkingRunRef.current.agentIds,
                  userIntent: deepThinkingRunRef.current.userIntent,
                  loopIteration: deepThinkingRunRef.current.loopIteration,
                },
              } as any,
            });
          }

          // Also add to legacy global store
          addChatMessage({
            id: verdictMessageId,
            role: 'ai',
            content: verdictMessageContent,
            timestamp: new Date(),
            metadata: {
              agentAudit: {
                kind: 'verdict',
                orchestratorRunId: runId,
                verdict,
                reviews,
                decisionContext: deepThinkingRunRef.current.decisionContext,
                agentIds: deepThinkingRunRef.current.agentIds,
                userIntent: deepThinkingRunRef.current.userIntent,
                loopIteration: deepThinkingRunRef.current.loopIteration,
              },
            },
          } as any);

          if (runId) persistedAgentAuditRunIdsRef.current.add(runId);
        } catch (err) {
          console.error('[UnifiedChatPanel] Agent audit review failed:', err);
        } finally {
          setAgentAuditBusy(false);
        }
      }

      setThinkingSteps([]);
    },
    onStreamError: async (err) => {
      const pendingSave = pendingChatSaveIntentRef.current;
      pendingChatSaveIntentRef.current = null;
      if ((err as any)?.code === 'DEEP_THINKING_CONFIRM_REQUIRED') {
        // Flow-control error: do not persist as a chat message.
        setThinkingSteps([]);
        return;
      }
      // Make failures visible in the conversation UI (otherwise user only sees their own messages).
      // Admins/owners also get the real cause (HTTP status / code / message) inline.
      const roleLowerErr =
        typeof currentUser?.role === 'string' ? currentUser.role.trim().toLowerCase() : '';
      const isPrivilegedErr = ['admin', 'owner', 'superadmin'].includes(roleLowerErr);
      const friendly = getTeresaStartFailureMessage(
        i18n.language,
        isPrivilegedErr ? formatTeresaAdminDiagnostic(err) : null
      );

      try {
        if (activeConversationId) {
          await addMessageToConversation({
            conversationId: activeConversationId,
            role: 'ai',
            content: friendly,
            messageType: 'text',
            metadata: { error: (err as Error)?.message || String(err) },
          });
        } else {
          addChatMessage({
            id: `ai-error-${Date.now()}`,
            role: 'ai',
            content: friendly,
            timestamp: new Date(),
          });
        }
      } catch (persistErr) {
        console.error('[UnifiedChatPanel] Failed to persist stream error message:', persistErr);
        addChatMessage({
          id: `ai-error-${Date.now()}`,
          role: 'ai',
          content: friendly,
          timestamp: new Date(),
        });
      }

      // Fallback save on hard stream error.
      if (pendingSave) {
        const fallbackBody = pendingSave.originalUserMessage || '';
        const fallbackMessageId = `ai-error-fallback-${Date.now()}`;
        if (pendingSave.target === 'idea') {
          await saveMessageAsIdea(fallbackMessageId, fallbackBody, {
            navigateToMyWork: false,
            autoTriggered: true,
          });
        } else if (pendingSave.target === 'note') {
          await saveMessageAsNote(fallbackMessageId, fallbackBody, {
            navigateToMyWork: false,
            autoTriggered: true,
          });
        }
      }
      setThinkingSteps([]);
    },
    onThinkingUpdate: (steps) => {
      setThinkingSteps(steps);
    },
    onArtifactDetected: (artifact, artifactMeta) => {
      const contentEnvelope =
        (artifact as any).contentEnvelope || (artifact as any).metadata?.contentEnvelope;
      const governedDraft = {
        ...artifact,
        metadata: {
          ...((artifact as any).metadata || {}),
          contentEnvelope,
          wave5Governance: {
            localDraftOnly: true,
            requiresMutationProposal: true,
            source: 'chat_artifact_detection',
            citationsLinked: Array.isArray(artifactMeta?.citations)
              ? artifactMeta.citations.length
              : 0,
            trustBundleId:
              (artifactMeta?.trustBundle as any)?.id ||
              (artifactMeta?.trustBundle as any)?.traceId ||
              null,
          },
        },
      } as Artifact;
      addArtifact(governedDraft);
      void Api.createWave5Artifact({
        artifactType: mapChatArtifactToWave5Type(artifact),
        title: artifact.title || 'Chat artifact',
        content: contentEnvelope?.contentMd || artifact.content || '',
        canonicalFormat: contentEnvelope?.canonicalFormat,
        contentMd: contentEnvelope?.contentMd,
        contentJson: contentEnvelope?.contentJson,
        contentSchemaVersion: contentEnvelope?.contentSchemaVersion,
        conversationId: activeConversationId || undefined,
        projectId: (workspaceContext as any)?.projectId || undefined,
        trustBundleId:
          (artifactMeta?.trustBundle as any)?.id ||
          (artifactMeta?.trustBundle as any)?.traceId ||
          undefined,
        aiRunId:
          (artifactMeta?.proposal as any)?.runId ||
          (artifactMeta?.proposal as any)?.metadata?.runId ||
          undefined,
        citations: Array.isArray(artifactMeta?.citations) ? artifactMeta?.citations : [],
        sourceRefs: [
          {
            sourceClass: 'chat',
            conversationId: activeConversationId || null,
            streamSessionId: artifactMeta?.sessionId || null,
          },
          ...((Array.isArray((artifactMeta?.sourceLedger as any)?.sources)
            ? (artifactMeta?.sourceLedger as any).sources
            : []) as any[]),
        ],
        metadata: {
          source: 'unified_chat',
          localArtifactId: artifact.id,
          localArtifactType: (artifact as any).type,
          policyDecision: artifactMeta?.policyDecision || null,
        },
      }).catch((err: any) => {
        console.warn('[UnifiedChatPanel] Wave 5 artifact persistence failed', err?.message || err);
        addChatMessage({
          id: `wave5-artifact-persist-failed-${Date.now()}`,
          role: 'ai',
          content:
            'Artifact was kept as a local draft, but saving it to the governed Wave 5 runtime failed. Try again from /ai/artifacts before treating it as committed workspace output.',
          timestamp: new Date(),
          type: 'text',
        } as any);
      });
    },
    // SPEC_01 (Tryb A): the chat backend created a deliverable via the
    // generate_deliverable function-call and asks us to mount it in the canvas.
    // Mirror the front-end intent-intercept mount sequence (Tryb B) so the
    // resulting artifact is identical regardless of which path triggered it.
    onDeliverable: (payload) => {
      const draftId = String(payload?.draftId || payload?.generationId || '').trim();
      if (!draftId) return;

      // M06 Fala 2 · 2.3 (+ Teresa "all 8 tools" rollout) — mind map / process
      // flow / Ideas Table (M08) / whiteboard are NOT canvas drafts. Mount them
      // in the Ideas workspace (same handoff path as "save message as idea"),
      // seeded with the topic so the describe-with-AI flow builds a real map —
      // only `preferredSystem` differs per tool, the mount contract is identical.
      const CANVAS_TOOL_KINDS = new Set(['mindmap', 'process_flow', 'table', 'whiteboard']);
      const payloadKind = (payload as any)?.kind;
      if (CANVAS_TOOL_KINDS.has(payloadKind)) {
        const preferredSystem = (payload as any)?.preferredSystem || payloadKind;
        const fallbackTitle =
          payloadKind === 'process_flow'
            ? t('chat.titles.processFlow', 'Przepływ procesu')
            : payloadKind === 'table'
              ? t('chat.titles.ideasTable', 'Tabela pomysłów')
              : payloadKind === 'whiteboard'
                ? t('chat.titles.whiteboard', 'Tablica')
                : t('chat.titles.idea', 'Mapa myśli');
        const mmTitle = String(payload.title || fallbackTitle).slice(0, 120);
        const seedText = String((payload as any)?.seedText || mmTitle);
        const creationPayload: IdeaWorkspaceCreationPayload = {
          title: mmTitle,
          body: seedText,
          tags: [],
          sourceType: 'chat',
          sourceConversationId: activeConversationId,
        };
        // Consume the backend-built skeleton graph directly when present
        // (mindmapSkeleton.ts / canvasToolSkeletons.ts) instead of re-deriving
        // one from `seedText` via a fresh AI kickoff — previously `payload.graph`
        // was ignored here, so the workspace always re-kicked-off an AI call,
        // wasting the already-built skeleton and risking a different result
        // than what the chat message described. `IdeaMapWorkspace.hydrate()`
        // syncs `seedGraph` as the new idea's initial map when set, and the
        // AI-kickoff effect skips entirely when a graph was already provided.
        const rawGraph = (payload as any)?.graph;
        const seedGraph =
          rawGraph && Array.isArray(rawGraph.nodes) && rawGraph.nodes.length > 0
            ? {
                nodes: rawGraph.nodes,
                edges: Array.isArray(rawGraph.edges) ? rawGraph.edges : [],
                // Forward backend-built canvas extensions (e.g. Ideas-Table custom
                // columns ROI/Budżet/Ryzyko) so they persist + render — previously
                // dropped here, leaving the table with only status/priority.
                ...(rawGraph.extensions && typeof rawGraph.extensions === 'object'
                  ? { extensions: rawGraph.extensions }
                  : {}),
              }
            : null;
        const seedIntent: IdeaWorkspaceSeedIntent = {
          // Only fall back to the AI re-kickoff flow when the backend did NOT
          // hand off a usable skeleton graph.
          startMode: seedGraph ? 'blank_canvas' : 'describe_with_ai',
          seedText,
          preferredSystem,
          templateId: null,
          popularStartId: null,
          popularStartLabel: null,
          structuredBrief: null,
          source: 'chat_handoff',
          seedGraph,
        };
        // Server-side materialization (canvasMaterialize.ts, target:'idea') now
        // creates the real my_ideas/my_idea_maps row before this event fires,
        // so `draftId` is normally a real idea id (`idea-<ts>-<hex>`) — use it
        // directly so IdeaMapWorkspace.hydrate's "existing idea" branch just
        // loads it (Api.getMyIdea + Api.getMyIdeaMap), never touching
        // createMyIdea/syncMyIdeaMap. Only fall back to the old FE-mount
        // contract (`new-idea-<ts>`) when the backend materialize failed and
        // fell back to its own placeholder id (`chat-<kind>-<ts>`).
        const isRealIdeaId = /^idea-\d+-[0-9a-f]+$/i.test(draftId);
        const newIdeaId = isRealIdeaId ? draftId : `new-idea-${Date.now()}`;
        try {
          trackFunnelEvent('my_idea_saved', {
            source: `chat_deliverable_${payloadKind}`,
            ideaId: newIdeaId,
            handoff: true,
          });
        } catch {
          /* ignore telemetry errors */
        }
        try {
          const { setMyWorkIntent, setCurrentView } = useAppStore.getState() as any;
          setMyWorkIntent?.({
            tab: 'ideas',
            open: {
              type: 'idea',
              id: newIdeaId,
              name: mmTitle,
              data: {
                isNew: true,
                creationPayload,
                seedIntent,
              },
            },
          });
          setCurrentView?.(AppView.MY_WORK);
        } catch (err) {
          console.warn('[UnifiedChatPanel] canvas-tool deliverable mount failed', err);
          return;
        }
        toast.success(t('myWork.ideas.sentToWorkspaceToast', 'Opened in Ideas workspace'));
        return;
      }

      // Teresa "all 8 tools" rollout — note: already a real notebook_pages row
      // (created server-side by generateDeliverable). Previously this only set
      // `tab: 'notebook'`, which lands on the notebooks LIBRARY, not the note
      // itself — the just-created page has no notebook container, so it was
      // invisible there (same shape as the MyWorkHub fix documented at
      // `parseMyWorkPathIntent` for /my-work/notebook/<pageId>). Deep-link to
      // that route directly (like the `initiative` branch below does for its
      // own record) so NotebookContent's `openPageId` fetches the page by id
      // and actually opens the editor on the note Teresa just created.
      if (payloadKind === 'note') {
        try {
          navigateToRoute(`/my-work/notebook/${encodeURIComponent(draftId)}`);
        } catch (err) {
          console.warn('[UnifiedChatPanel] note deliverable navigation failed', err);
          return;
        }
        toast.success(t('myWork.notebook.savedFromChatToast', 'Saved from chat to Notebook'));
        return;
      }

      // Teresa routing-N (naprawa-rN-routing) — task / decision are real N-objects
      // (a `tasks` / `decisions` row already persisted server-side by
      // create_task / create_decision), NOT canvas drafts. Navigate to the
      // matching My Work tab (same handoff shape as the note branch above).
      if (payloadKind === 'task' || payloadKind === 'decision') {
        try {
          const { setMyWorkIntent, setCurrentView } = useAppStore.getState() as any;
          setMyWorkIntent?.({ tab: payloadKind === 'task' ? 'tasks' : 'decisions' });
          setCurrentView?.(AppView.MY_WORK);
        } catch (err) {
          console.warn('[UnifiedChatPanel] task/decision deliverable navigation failed', err);
          return;
        }
        toast.success(
          payloadKind === 'task'
            ? t('myWork.tasks.createdFromChatToast', 'Task created from chat')
            : t('myWork.decisions.createdFromChatToast', 'Decision created from chat')
        );
        return;
      }

      // Teresa routing-N — initiative: a real DRAFT initiative row (generate_
      // initiative) is already persisted; deep-link into the Initiatives module
      // to open it. Falls back to the module list when no id is present.
      if (payloadKind === 'initiative') {
        try {
          const initiativeId = String(
            (payload as any)?.initiativeId || payload?.draftId || payload?.generationId || ''
          ).trim();
          navigateToRoute(
            initiativeId
              ? `/initiatives?open=${encodeURIComponent(initiativeId)}&mode=doc`
              : '/initiatives'
          );
        } catch (err) {
          console.warn('[UnifiedChatPanel] initiative deliverable navigation failed', err);
          return;
        }
        toast.success(t('myWork.initiatives.createdFromChatToast', 'Initiative created from chat'));
        return;
      }

      const kind = payload.kind === 'sheet' ? 'sheet' : payload.kind === 'deck' ? 'deck' : 'doc';
      const title =
        payload.title ||
        (kind === 'sheet' ? 'Arkusz' : kind === 'deck' ? 'Prezentacja' : 'Dokument');
      if (kind === 'deck') {
        setRequestedCanvasDraftId(null);
        setRequestedCanvasDeckId(draftId);
        setRequestedCanvasStarterId('presentation');
      } else {
        setRequestedCanvasDeckId(null);
        setRequestedCanvasDraftId(draftId);
        setRequestedCanvasStarterId('document');
      }
      setIsWorkPanelOpen(true);
      registerChatDeliverable(kind, draftId, title);
      announceDeliverableDraftReady(draftId);
    },
    // Z4 transport — model wywołał narzędzie akcji OTWARTEJ Idei. Wykonujemy je
    // TĄ SAMĄ ścieżką co klik człowieka: executeTeresaTool → runIdeaAction →
    // handler → szyna 'idea-workspace-quick-action'. Bezpieczeństwo (confirm-
    // BeforeRun, „akcja nie istnieje w tej reprezentacji") egzekwuje sam rejestr;
    // odmowę/komunikat pokazujemy w czacie. Detektory regexowe działają tylko
    // po jawnym wyłączeniu registry kill-switchem.
    onIdeaAction: async (payload) => {
      const ideaCtx = teresaIdeaCtxRef.current;
      if (!ideaCtx) {
        // Manifest był wysłany bez znanego kontekstu Idei — nie zgadujemy.
        return;
      }
      const uiLang: 'pl' | 'en' = (i18n.language || 'en').split('-')[0] === 'pl' ? 'pl' : 'en';
      try {
        const liveSelection = getLiveTeresaSelection(ideaCtx.ideaId, ideaCtx.tool);
        const result = await executeTeresaTool(payload.toolName, {
          ideaId: ideaCtx.ideaId,
          tool: ideaCtx.tool,
          selection: liveSelection,
          language: uiLang,
          params: payload.args,
        });
        // Rejestr sam mówi, czego NIE potrafi / że wymaga potwierdzenia — nie
        // udajemy sukcesu. RISK-30 (S22-TERESA): `describeUnconfirmedTeresaResult`
        // dogląda przypadków, w których SAM wynik milczy (`ok:true` bez
        // `confirmed:true` i bez `message`) — zero cichego „zrobione".
        const content = describeUnconfirmedTeresaResult(result, payload.toolName, t);
        if (content) {
          // Krok A: `runIdeaAction` odmawia z `data.needsConfirmation` gdy akcja
          // ma `teresa.confirmBeforeRun` — zamiast samego tekstu odmowy dajemy
          // wiadomości znacznik, który MessageRenderer zamienia w przyciski
          // „Potwierdź"/„Anuluj" (JEDNO oczekujące potwierdzenie na raz).
          const needsConfirmation = Boolean(
            (result?.data as { needsConfirmation?: boolean } | undefined)?.needsConfirmation
          );
          const messageId = `idea-action-${Date.now()}`;
          addChatMessage({
            id: messageId,
            role: 'ai',
            content,
            timestamp: new Date(),
            ...(needsConfirmation ? { metadata: { teresaConfirm: true } } : {}),
          });
          if (needsConfirmation) {
            setTeresaPendingConfirm({
              messageId,
              toolName: payload.toolName,
              args: payload.args,
              ideaId: ideaCtx.ideaId,
              tool: ideaCtx.tool,
              language: uiLang,
              selection: liveSelection,
            });
          }
        }
      } catch (err) {
        console.warn('[UnifiedChatPanel] idea-action execute failed', err);
        // RISK-30 (S22-TERESA): wyjątek nie może zostawić Teresy w milczeniu —
        // do tej zmiany catch robił WYŁĄCZNIE `console.warn`, więc streamowana
        // odpowiedź modelu stała nieoprotestowana na ekranie nawet przy realnym
        // błędzie wykonania.
        addChatMessage({
          id: `idea-action-error-${Date.now()}`,
          role: 'ai',
          content: t('aiChat.teresaAction.error', {
            defaultValue: 'Nie udało się wykonać akcji „{{action}}” — wystąpił błąd. Nic nie zostało potwierdzone jako zrobione.',
            action: payload.toolName,
          }),
          timestamp: new Date(),
        });
      }
    },
  });

  // A disconnected stream is a durable, tenant-bound checkpoint. Discovery is
  // explicit on a cold/deep conversation load; resuming always remains a human
  // action and never silently invokes the provider.
  const partialDiscoveryErrorLabel = t(
    'aiChat.partialRecovery.discoveryFailed',
    'Interrupted response could not be checked.'
  );
  useEffect(() => {
    let cancelled = false;
    setPartialRecovery(null);
    setPartialRecoveryError(null);
    if (!activeConversationId || isConversationLoading)
      return () => {
        cancelled = true;
      };

    void checkPartialResponse(activeConversationId)
      .then((partial) => {
        if (!cancelled && partial?.canResume && partial.content.trim()) {
          setPartialRecovery(partial);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPartialRecoveryError(partialDiscoveryErrorLabel);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeConversationId,
    checkPartialResponse,
    isConversationLoading,
    partialDiscoveryErrorLabel,
  ]);

  const handleResumePartial = useCallback(async () => {
    if (!partialRecovery || isStreaming || isResumingPartial) return;
    let sourceMessages = activeMessages;
    let latestUserIndex = [...sourceMessages]
      .map((message) => String(message.role || '').toLowerCase())
      .lastIndexOf('user');
    // On a hard deep-link the checkpoint lookup can finish before the
    // conversation store has hydrated. Re-read through the canonical store
    // loader once; never fabricate the original prompt.
    if (latestUserIndex < 0 && activeConversationId) {
      await fetchConversation(activeConversationId);
      sourceMessages = useConversationStore.getState().activeMessages;
      latestUserIndex = [...sourceMessages]
        .map((message) => String(message.role || '').toLowerCase())
        .lastIndexOf('user');
    }
    const latestUser = latestUserIndex >= 0 ? sourceMessages[latestUserIndex] : null;
    const prompt = typeof latestUser?.content === 'string' ? latestUser.content.trim() : '';
    if (!prompt) {
      setPartialRecoveryError(
        t(
          'aiChat.partialRecovery.missingPrompt',
          'The original request is unavailable; start a new message.'
        )
      );
      return;
    }
    setIsResumingPartial(true);
    setPartialRecoveryError(null);
    try {
      await resumeFromPartial(
        partialRecovery.sessionId,
        prompt,
        sourceMessages.slice(0, latestUserIndex)
      );
      setPartialRecovery(null);
    } catch {
      setPartialRecoveryError(
        t('aiChat.partialRecovery.resumeFailed', 'The interrupted response could not be resumed.')
      );
    } finally {
      setIsResumingPartial(false);
    }
  }, [
    activeConversationId,
    activeMessages,
    fetchConversation,
    isResumingPartial,
    isStreaming,
    partialRecovery,
    resumeFromPartial,
    t,
  ]);

  const partialRecoveryNotice =
    partialRecovery || partialRecoveryError ? (
      <div
        className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 dark:border-sky-900/40 dark:bg-sky-900/20"
        data-testid="chat-partial-recovery"
        role="status"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-sky-900 dark:text-sky-100">
            {partialRecoveryError ||
              t('aiChat.partialRecovery.available', 'An interrupted response is available.')}
          </div>
          <div className="flex items-center gap-2">
            {partialRecovery && (
              <button
                type="button"
                onClick={() => void handleResumePartial()}
                disabled={isResumingPartial || isStreaming}
                className="rounded-md bg-sky-700 px-3 py-1 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
              >
                {isResumingPartial
                  ? t('aiChat.partialRecovery.resuming', 'Resuming…')
                  : t('aiChat.partialRecovery.resume', 'Resume')}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setPartialRecovery(null);
                setPartialRecoveryError(null);
              }}
              className="rounded-md bg-c-surface-raised px-3 py-1 text-xs font-medium text-sky-900 hover:bg-c-border-subtle dark:text-sky-100"
            >
              {t('common.dismiss', 'Dismiss')}
            </button>
          </div>
        </div>
      </div>
    ) : null;

  // Krok A — klik „Potwierdź": ponowne `executeTeresaTool` z DOKŁADNIE tym samym
  // toolName+ctx zapamiętanym w `teresaPendingConfirm`, ale `confirmed: true`.
  // TA SAMA ścieżka co pierwsze wywołanie (executeTeresaTool → runIdeaAction →
  // handler) — zero drugiego mechanizmu wykonania.
  const handleTeresaConfirmProceed = useCallback(async () => {
    const pending = teresaPendingConfirm;
    if (!pending || teresaConfirmBusy) return;
    setTeresaConfirmBusy(true);
    try {
      const result = await executeTeresaTool(pending.toolName, {
        ideaId: pending.ideaId,
        tool: pending.tool,
        // E10: reuse the selection captured at proposal time — see the
        // comment on `teresaPendingConfirm`'s `selection` field above.
        selection: pending.selection,
        language: pending.language,
        params: pending.args,
        confirmed: true,
      });
      // RISK-30 (S22-TERESA): ta sama zasada co w `onIdeaAction` — `ok:true`
      // bez `confirmed:true` i bez `message` nie może przejść bez echa, bo to
      // JEST ścieżka, na której użytkownik dosłownie kliknął „Potwierdź".
      const content = describeUnconfirmedTeresaResult(result, pending.toolName, t);
      if (content) {
        addChatMessage({
          id: `idea-action-confirm-${Date.now()}`,
          role: 'ai',
          content,
          timestamp: new Date(),
        });
      }
    } catch (err) {
      console.warn('[UnifiedChatPanel] idea-action confirm execute failed', err);
      addChatMessage({
        id: `idea-action-confirm-error-${Date.now()}`,
        role: 'ai',
        content: t('aiChat.teresaAction.error', {
            defaultValue: 'Nie udało się wykonać akcji „{{action}}” — wystąpił błąd. Nic nie zostało potwierdzone jako zrobione.',
          action: pending.toolName,
        }),
        timestamp: new Date(),
      });
    } finally {
      setTeresaConfirmBusy(false);
      // Wyczyszczenie stanu USUWA przyciski z wiadomości źródłowej (dopasowanie
      // po `messageId` w MessageRenderer przestaje trafiać) — klik drugi raz
      // na tę samą wiadomość nic już nie robi.
      setTeresaPendingConfirm(null);
    }
  }, [teresaPendingConfirm, teresaConfirmBusy, addChatMessage, t]);

  // Krok A — klik „Anuluj": bez wywołania akcji, krótki komunikat, przyciski znikają.
  const handleTeresaConfirmCancel = useCallback(() => {
    if (!teresaPendingConfirm) return;
    const lang = teresaPendingConfirm.language;
    setTeresaPendingConfirm(null);
    addChatMessage({
      id: `idea-action-cancel-${Date.now()}`,
      role: 'ai',
      content: lang === 'pl' ? 'Anulowano.' : 'Cancelled.',
      timestamp: new Date(),
    });
  }, [teresaPendingConfirm, addChatMessage]);

  // =========================================================================
  // Incremental TTS: speak sentence-by-sentence WHILE AI is streaming
  // =========================================================================
  useEffect(() => {
    if (isStreaming) {
      spokenCharsRef.current = 0;
    }
  }, [isStreaming]);

  useEffect(() => {
    if (!autoReadEnabledRef.current || !isStreaming || !streamedContent) return;

    const text = cleanTextForSpeech(streamedContent);
    if (!text || text.length <= spokenCharsRef.current) return;

    const unspoken = text.slice(spokenCharsRef.current);
    // Split on sentence boundaries (. ! ? followed by whitespace, or newlines)
    const sentenceEnd = /(?<=[.!?])\s+|(?<=\n)\s*/g;
    const parts = unspoken.split(sentenceEnd).filter(Boolean);

    if (parts.length > 1) {
      // Speak all complete sentences, keep the last (potentially incomplete) part
      const toSpeak = parts.slice(0, -1).join(' ').trim();
      if (toSpeak) {
        console.log('[TTS] Speaking sentence:', toSpeak.slice(0, 60) + '…');
        speak(toSpeak).catch((err) => console.warn('[TTS] speak error:', err));
        spokenCharsRef.current += unspoken.length - parts[parts.length - 1].length;
      }
    }
  }, [isStreaming, streamedContent, speak]);

  // Keep the streamed verdict accessible from callbacks without dependency churn
  useEffect(() => {
    agentAuditVerdictRef.current = agentAuditVerdict;
  }, [agentAuditVerdict]);

  // ========================================================================
  // Convert conversation messages to ChatMessage format
  // ========================================================================

  const messages: ChatMessage[] = useMemo(() => {
    return activeMessages.map((msg) => ({
      id: msg.id,
      role: msg.role === 'ai' ? 'ai' : 'user',
      content: msg.content,
      timestamp: msg.createdAt,
      thinkingSteps: msg.metadata?.thinkingSteps as any,
      artifacts: msg.metadata?.artifacts,
      citations: msg.metadata?.citations,
      options: msg.metadata?.options,
      multiSelect: msg.metadata?.multiSelect,
      metadata: msg.metadata as any,
      authorUserId: msg.authorUserId || null,
      authorName: msg.authorName || null,
      isStreaming: false,
    })) as ChatMessage[];
  }, [activeMessages]);

  // Combined messages to display
  const displayMessages = useMemo(() => {
    const baseMessages = customMessages || messages;

    // Always append a streaming AI bubble while streaming, even before first chunk arrives.
    // This enables the Cursor-like "thinking" indicator immediately.
    if (isStreaming) {
      return [
        ...baseMessages,
        {
          id: 'stream',
          role: 'ai' as const,
          content: streamedContent || '',
          timestamp: new Date(),
          isStreaming: true,
          thinkingSteps: thinkingSteps.length > 0 ? thinkingSteps : undefined,
          metadata: {
            deepThinkingState,
            researchProgress,
            researchVisibility,
            policyDecision,
            policyNotices,
            memoryCandidate,
            ...(teresaProposal ? { proposal: teresaProposal } : {}),
            ...(streamedReasoning ? { reasoning: streamedReasoning } : {}),
          },
        },
      ];
    }

    return baseMessages;
  }, [
    messages,
    customMessages,
    isStreaming,
    streamedContent,
    streamedReasoning,
    thinkingSteps,
    deepThinkingState,
    researchProgress,
    researchVisibility,
    policyDecision,
    policyNotices,
    memoryCandidate,
    teresaProposal,
  ]);

  useEffect(() => {
    if (!memoryCandidate) return;
    if (memoryCandidate.blocked) {
      toast('Private mode blocked this memory request. Nothing was saved.');
      return;
    }
    if (memoryCandidate.candidate?.candidateId) {
      toast('Memory candidate created. Review it in AI Context before it is retained.');
    }
  }, [memoryCandidate]);

  const latestUserGoalHint = useMemo(() => {
    const latestUserMessage = [...displayMessages]
      .reverse()
      .find(
        (message) => message.role === 'user' && String(message.content || '').trim().length > 0
      );
    return String(latestUserMessage?.content || '').trim();
  }, [displayMessages]);

  const v8SnapshotContext = useMemo(() => {
    const workspaceId = isUuidLike(workspaceContext?.entityId)
      ? workspaceContext.entityId
      : isUuidLike(workspaceContext?.projectId)
        ? workspaceContext.projectId
        : isUuidLike(currentOrganization?.id)
          ? currentOrganization.id
          : null;

    const projectId = isUuidLike(workspaceContext?.projectId) ? workspaceContext.projectId : null;
    const resolvedRoleRef =
      typeof currentUser?.role === 'string' && currentUser.role.trim().length > 0
        ? currentUser.role.trim().toLowerCase()
        : 'member';

    return {
      workspaceId,
      projectId,
      effectiveScopeRef: 'workspace',
      resolvedRoleRef,
      privacyMode: isPrivateMode,
    };
  }, [
    currentOrganization?.id,
    currentUser?.role,
    isPrivateMode,
    workspaceContext?.entityId,
    workspaceContext?.projectId,
  ]);

  // ========================================================================
  // V3-B01: Contextual smart suggestions (shown below input after first exchange)
  // ========================================================================

  const chatSuggestions: ChatSuggestion[] = useMemo(() => {
    if (displayMessages.length < 2 || isStreaming) return [];
    const items: ChatSuggestion[] = [];

    if (workspaceContext?.type === 'initiative') {
      items.push({
        id: 'open-initiative',
        label: t('chat.suggestions.openInitiative', 'Open initiative'),
        type: 'initiative',
        action: {
          type: 'NAVIGATE',
          targetModule: 'initiatives',
          entityId: workspaceContext.entityId ?? undefined,
        },
      });
    }

    if (workspaceContext?.type === 'insight' || workspaceContext?.type === 'interview') {
      items.push(
        {
          id: 'generate-insights',
          label: t(
            'chat.suggestions.generateInsights',
            'Generate AI insights from completed sessions'
          ),
          type: 'interview' as any,
          action: {
            type: 'chat',
            prompt: t(
              'chat.suggestions.generateInsightsPrompt',
              'Generate AI insights from completed interview sessions'
            ),
          },
        },
        {
          id: 'submit-review',
          label: t('chat.suggestions.submitReview', 'Submit this insight for review'),
          type: 'interview' as any,
          action: {
            type: 'chat',
            prompt: t('chat.suggestions.submitReviewPrompt', 'Submit this insight for review'),
          },
        },
        {
          id: 'export-initiative',
          label: t('chat.suggestions.exportInsight', 'Export insight to initiative'),
          type: 'interview' as any,
          action: {
            type: 'chat',
            prompt: t(
              'chat.suggestions.exportInsightPrompt',
              'Export this insight to an initiative'
            ),
          },
        },
        {
          id: 'view-evidence',
          label: t('chat.suggestions.viewEvidence', 'View evidence map'),
          type: 'interview' as any,
          action: { type: 'NAVIGATE', targetModule: 'interview' },
        }
      );
    }

    // Removed always-on "Open Tools hub" / "View Results" nav chips (declutter —
    // those destinations live in the sidebar). Suggestions now show only when
    // contextually relevant (initiative/insight).
    //
    // 2026-07-28 (D4) — the artifact family ("Open Outputs Library" /
    // "Review pending artifacts") was removed on the owner's explicit,
    // app-wide decision: those two chips fired on any mention of
    // report/presentation/deck/sheet/template and cluttered the space right
    // under the composer without adding anything the sidebar doesn't already
    // give. Do NOT reintroduce them here — the whole `artifactMentioned`
    // heuristic went with them.

    return items;
  }, [displayMessages.length, isStreaming, workspaceContext, t]);

  // `handleSuggestionClick` is declared below `handleSendMessage` to avoid a
  // temporal-dead-zone reference when a suggestion of type 'chat' forwards
  // the prompt straight into the send pipeline. See decl further down.

  // ========================================================================
  // Ensure messages are loaded when activeConversationId changes (e.g. after
  // navigating between screens or browser refresh with localStorage rehydration)
  // ========================================================================

  useEffect(() => {
    if (activeConversationId && activeMessages.length === 0 && !isConversationLoading) {
      fetchConversation(activeConversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  // ========================================================================
  // Scroll to bottom on new messages (P1-1, P1-10)
  // ========================================================================

  // Track whether the user is pinned to the bottom of the scroller. The
  // ChatGPT / Claude pattern: only auto-scroll when the user is already
  // scrolled to (or very near) the bottom. The instant they scroll up to
  // re-read earlier content, auto-scroll pauses so the view doesn't yank
  // back to the latest token every render. Threshold of 80px tolerates
  // small mouse-wheel jitter without snapping back unexpectedly.
  const isAtBottomRef = useRef(true);
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 80;
      isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!isAtBottomRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages, isStreaming]);

  // ========================================================================
  // Handlers
  // ========================================================================

  const handleSendMessage = useCallback(
    async (content: string, attachments?: any[]) => {
      if (!content.trim() || isDisabled) return;

      // ──────────────────────────────────────────────────────────────────────
      // Language follows the message: reply in the language the user writes in.
      // Detection wins ONLY when confident; otherwise we keep the existing
      // chatLanguage resolution (explicit selector / conversation / UI). This is
      // the "respond in the language I start speaking to the chat" rule.
      // ──────────────────────────────────────────────────────────────────────
      const detectedMessageLanguage = detectMessageLanguage(content);
      const effectiveChatLanguage = detectedMessageLanguage || chatLanguage;

      // M2: Chat commands for MyWork actions
      const text = content.trim();
      if (text.startsWith('/task ') || text.startsWith('/decision ')) {
        const isTask = text.startsWith('/task ');
        const title = text.replace(/^\/(task|decision)\s+/, '').trim();
        if (title) {
          // FIX-001: guard the slash-command action fetch with an AbortController +
          // 20s timeout so a hung server can't freeze the composer indefinitely.
          const actionController = new AbortController();
          const actionTimeout = setTimeout(() => actionController.abort(), 20000);
          try {
            const token = localStorage.getItem('token');
            const resp = await fetch('/api/my-work/chat-actions', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: isTask ? 'create_task' : 'create_decision',
                payload: { title },
              }),
              signal: actionController.signal,
            });
            if (resp.ok) {
              const confirmMsg: ChatMessage = {
                id: `action-${Date.now()}`,
                role: 'ai',
                content: isTask ? `Task created: "${title}"` : `Decision created: "${title}"`,
                timestamp: new Date(),
              };
              addChatMessage(confirmMsg);
              if (activeConversationId) {
                try {
                  await addMessageToConversation({
                    conversationId: activeConversationId,
                    role: 'ai',
                    content: confirmMsg.content,
                    messageType: 'text',
                  });
                } catch {
                  /* best-effort persist */
                }
              }
              onMessageSent?.(content);
              return;
            }
          } catch {
            /* timeout/abort or network error — fall through to normal send */
          } finally {
            clearTimeout(actionTimeout);
          }
        }
      }

      // Explicit output tool routing (user picked a tool via OutputToolSelector)
      const outputTool = useAppStore.getState().chatOutputTool;
      if (outputTool !== 'auto') {
        const routeMap: Record<string, string> = {
          wordy: '/wordy',
          excele: '/tabele',
          tabele: '/tabele',
          prezentacje: '/prezentacje',
        };
        const uiLangExplicit = (i18n.language || 'en').split('-')[0];
        const labelMap: Record<string, { pl: string; en: string }> = {
          wordy: { pl: 'Dokumenty', en: 'Documents' },
          excele: { pl: 'Tabele Studio', en: 'Table Studio' },
          tabele: { pl: 'Tabele Studio', en: 'Table Studio' },
          prezentacje: { pl: 'Prezentacje', en: 'Presentations' },
        };
        const label = labelMap[outputTool]?.[uiLangExplicit === 'pl' ? 'pl' : 'en'] || outputTool;

        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        addChatMessage(userMessage);

        if (activeConversationId) {
          try {
            await addMessageToConversation({
              conversationId: activeConversationId,
              role: 'user',
              content,
              messageType: 'text',
            });
          } catch {
            /* best-effort persist */
          }
        }

        addChatMessage({
          id: `tool-redirect-${Date.now()}`,
          role: 'ai',
          content:
            uiLangExplicit === 'pl'
              ? `Otwieram ${label} — zaraz zaczynam pracę.`
              : `Opening ${label} — starting work now.`,
          timestamp: new Date(),
        });

        useAppStore.getState().setChatKickoffMessage(text);
        useAppStore.getState().setChatOutputTool('auto');
        navigateToRoute(routeMap[outputTool]);
        onMessageSent?.(content);
        return;
      }

      const canvasIntent = parseChatCanvasIntent(text);
      if (canvasIntent && canUseWorkPanel) {
        let conversationId = useConversationStore.getState().activeConversationId;
        if (!conversationId) {
          try {
            const conv = await createConversation();
            conversationId = conv.id;
          } catch (err) {
            console.error('[UnifiedChatPanel] Failed to create conversation for Canvas:', err);
          }
        }

        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        addChatMessage(userMessage);

        if (conversationId) {
          try {
            await addMessageToConversation({
              conversationId,
              role: 'user',
              content,
              messageType: 'text',
              metadata: {
                canvasCommand: {
                  starterId: canvasIntent.starterId,
                  cleanPrompt: canvasIntent.cleanPrompt,
                },
              },
            });
          } catch {
            /* best-effort persist */
          }
        }

        const uiLang = (i18n.language || 'en').split('-')[0];
        const starterLabel =
          canvasIntent.starterId === 'research'
            ? uiLang === 'pl'
              ? 'Research Canvas'
              : 'Research Canvas'
            : canvasIntent.starterId === 'decision'
              ? uiLang === 'pl'
                ? 'Decision Canvas'
                : 'Decision Canvas'
              : canvasIntent.starterId === 'plan'
                ? uiLang === 'pl'
                  ? 'Plan Canvas'
                  : 'Plan Canvas'
                : uiLang === 'pl'
                  ? 'Canvas'
                  : 'Canvas';
        addChatMessage({
          id: `canvas-route-${Date.now()}`,
          role: 'ai',
          content:
            uiLang === 'pl'
              ? `Otwieram ${starterLabel} po prawej stronie. Będziemy pracować w tej samej rozmowie.`
              : `Opening ${starterLabel} on the right. We'll keep working in the same conversation.`,
          timestamp: new Date(),
        });

        setRequestedCanvasStarterId(canvasIntent.starterId);
        setIsWorkPanelOpen(true);
        onMessageSent?.(content);
        return;
      }

      // Tables / workbook intents now land in the single canonical Table Studio module.
      // N-12: a prompt with an explicit document noun ("raport … tabela") is a
      // document-with-a-table, not a standalone workbook — let it fall through to
      // the Document gate below.
      // B2-brama (2026-07-22): prośba OBLICZENIOWA sformułowana przez „tabelę/
      // arkusz" (np. „Zrób arkusz finansowy: model 3 scenariusze RZiS") też ma
      // trafić do gałęzi excele → silnik formuł — detectExceleIntent sam jej nie
      // łapie (wymaga literalnie „arkusz excel"), a bez tego prośba spadała do
      // gałęzi tabeli i legacy panelu Table Builder. hasWorkbookLaneSignals jest
      // JAWNYM dopasowaniem (bez defaultu) — „zrób tabelę zadań" tu nie wejdzie.
      if (
        (detectExceleIntent(text) || (detectTableIntent(text) && hasWorkbookLaneSignals(text))) &&
        !hasStrongDocumentNoun(text)
      ) {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        addChatMessage(userMessage);

        if (activeConversationId) {
          try {
            await addMessageToConversation({
              conversationId: activeConversationId,
              role: 'user',
              content,
              messageType: 'text',
            });
          } catch {
            /* best-effort persist */
          }
        }

        const uiLang = (i18n.language || 'en').split('-')[0];

        // Deliverables light (L3): arkusz powstaje w miejscu — tabela GFM jako
        // canvas draft kind='table' (edycja + XLSX/CSV + bridge do Table Studio),
        // zamiast redirectu do /tabele. Za flagą; off ⇒ legacy.
        // B2-gate (2026-07-22, live-verify): tor OBLICZENIOWY (workbook — silnik
        // 5-fazowy z formułami) wchodzi tu NIEZALEŻNIE od flagi buildowej
        // VITE_ENABLE_DELIVERABLES_LIGHT — inaczej reroute B2 był martwy na demo
        // (env nieustawiony ⇒ legacy panel „AI Table Builder" z błędem workspaceId).
        // Lane 'gfm' przy fladze OFF zostaje na legacy jak dotąd (zero regresji).
        if (isDeliverablesLightEnabled() || resolveSheetLane(text) === 'workbook') {
          const sheetTitle = deckTitleFromIntent(
            text,
            t('chat.deliverable.sheetTitle', 'Sheet from chat')
          );
          if (!useConversationStore.getState().activeConversationId) {
            try {
              const conv = await createConversation();
              await addMessageToConversation({
                conversationId: conv.id,
                role: 'user',
                content,
                messageType: 'text',
              });
            } catch (convErr) {
              console.error('[UnifiedChatPanel] Failed to create conversation for sheet:', convErr);
            }
          }
          const progressMessageId = useConversationStore.getState().appendLocalMessage({
            role: 'ai',
            content: deckGenerationChecklist({
              lang: uiLang,
              title: sheetTitle,
              phase: 'planning',
              format: 'sheet',
            }),
          });
          onMessageSent?.(content);

          const updateSheetChecklist = (
            phase: Parameters<typeof deckGenerationChecklist>[0]['phase'],
            extra?: {
              planCount?: number;
              planItems?: DeliverableGenerationPlanItem[];
              sources?: Array<{ sourceType: string; sourceId: string; sourceTitle?: string }>;
              unitCount?: number;
              sourcesCount?: number;
              error?: string;
            }
          ) => {
            useConversationStore.getState().updateMessageContent(
              progressMessageId,
              deckGenerationChecklist({
                lang: uiLang,
                title: sheetTitle,
                phase,
                format: 'sheet',
                ...extra,
              })
            );
          };

          const persistSheetFinalNote = (
            note: string,
            // B2-parity: deliverable ref w metadata wiadomości — persystowane
            // server-side, dzięki czemu ArtifactChip w transkrypcie przeżywa reload.
            // B2 (Excel): dla toru workbook chip niesie workbookId/downloadUrl —
            // klik otwiera realny .xlsx (silnik formuł), nie draft canvasa.
            metadata?: {
              deliverable: {
                kind: 'deck' | 'doc' | 'sheet';
                generationId: string;
                title?: string;
                workbookId?: string;
                downloadUrl?: string;
              };
            }
          ) => {
            const conversationId = useConversationStore.getState().activeConversationId;
            if (!conversationId) return;
            void addMessageToConversation({
              conversationId,
              role: 'ai',
              content: note,
              messageType: 'text',
              ...(metadata ? { metadata } : {}),
            }).catch(() => {
              /* best-effort persist */
            });
          };

          const conversationContext = useConversationStore
            .getState()
            .activeMessages.slice(-6)
            .map(
              (m) => `${m.role === 'ai' ? 'Teresa' : 'User'}: ${String(m.content).slice(0, 400)}`
            )
            .join('\n');

          // Stary tor (GFM 10×15, plan/startSheet) — wyodrębniony do funkcji, bo
          // służy zarówno jako lane 'gfm' (prezentacja: tabela/lista), jak i jako
          // FAIL-SOFT fallback, gdy silnik formuł (workbook) zawiedzie. Nietknięty
          // względem poprzedniej wersji.
          const runGfmSheetGeneration = async () => {
            try {
              const planned = await planSheetGeneration({
                intent: text,
                title: sheetTitle,
                language: effectiveChatLanguage === 'pl' ? 'pl' : 'en',
                conversationId: useConversationStore.getState().activeConversationId,
                conversationContext,
              });
              const sheetSourcesCount = planned.sources?.length || 0;
              updateSheetChecklist('plan_ready', {
                planItems: planned.plan,
                sources: planned.sources,
                sourcesCount: sheetSourcesCount,
              });

              await startSheetGeneration({
                generationId: planned.generationId,
                setup: planned.setup,
              });
              updateSheetChecklist('generating', {
                planItems: planned.plan,
                sources: planned.sources,
                sourcesCount: sheetSourcesCount,
              });
              // Kimi-parity: artefakt widoczny od razu (szkielet), treść
              // dociągnie event 'deliverables:draft-ready' po generacji.
              setRequestedCanvasDeckId(null);
              setRequestedCanvasDraftId(planned.generationId);
              setRequestedCanvasStarterId('document');
              setIsWorkPanelOpen(true);

              const final = await pollDeckGenerationUntilDone({
                generationId: planned.generationId,
                signal: deliverablesPollAbortRef.current?.signal,
                onUpdate: (status: DeliverableGenerationStatus) => {
                  if (status.state === 'validating')
                    updateSheetChecklist('validating', {
                      planItems: planned.plan,
                      sources: planned.sources,
                      sourcesCount: sheetSourcesCount,
                    });
                },
              });
              if (final.state === 'draft') {
                useConversationStore.getState().removeLocalMessage(progressMessageId);
                persistSheetFinalNote(
                  deckGenerationChecklist({
                    lang: uiLang,
                    title: sheetTitle,
                    phase: 'draft',
                    format: 'sheet',
                    planItems: planned.plan,
                    sources: planned.sources,
                    sourcesCount: sheetSourcesCount,
                    unitCount: final.artifact?.unitCount,
                  }),
                  // B2-parity: chip artefaktu w transkrypcie (reload-safe, server-side).
                  {
                    deliverable: {
                      kind: 'sheet',
                      generationId: planned.generationId,
                      title: sheetTitle,
                    },
                  }
                );
                // B2-parity: artefakt rozmowy (persisted) — przełącznik + aktywny artefakt.
                registerChatDeliverable('sheet', planned.generationId, sheetTitle);
                announceDeliverableDraftReady(planned.generationId);
              } else {
                useConversationStore.getState().removeLocalMessage(progressMessageId);
                persistSheetFinalNote(
                  deckGenerationChecklist({
                    lang: uiLang,
                    title: sheetTitle,
                    phase: 'error',
                    format: 'sheet',
                    error: final.error,
                  })
                );
              }
            } catch (err: unknown) {
              if (err instanceof DOMException && err.name === 'AbortError') return;
              updateSheetChecklist('error', {
                error: err instanceof Error ? err.message : undefined,
              });
            }
          };

          // NOWY tor (B2, workstream Excel): żądanie OBLICZENIOWE (model/budżet/
          // P&L/prognoza/scenariusze/formuły) idzie do realnego 5-fazowego silnika
          // WorkbookGeneratorService (żywe formuły .xlsx), a nie do płaskiej tabeli
          // GFM. Prezentacja (tabela/lista) zostaje na starym torze GFM. Bramka:
          // resolveSheetLane. FAIL-SOFT: błąd silnika → fallback na tor GFM, żeby
          // czat NIGDY nie został bez artefaktu.
          const runWorkbookGeneration = async () => {
            // Silnik jest jednym długim wywołaniem (~30-120s) bez fazy planu —
            // pokazujemy 'generating' od razu (checklista analogiczna do GFM).
            updateSheetChecklist('generating');
            try {
              // Timeout: świadomie BEZ własnego — Api.generateWorkbook (jak lane
              // 'excele' w useKimiArtifactPipeline) to zwykły fetch bez AbortController;
              // silnik bywa długi, więc nie ucinamy go sztucznym limitem.
              const wb = await Api.generateWorkbook({
                prompt: text,
                language: effectiveChatLanguage === 'pl' ? 'pl' : 'en',
                conversationId: useConversationStore.getState().activeConversationId || undefined,
              });
              if (!wb?.id) throw new Error('workbook generation returned no id');

              const sheetCount = Array.isArray(wb.sheets) ? wb.sheets.length : undefined;
              const downloadUrl =
                typeof wb.downloadUrl === 'string'
                  ? wb.downloadUrl
                  : `/api/workbook/${wb.id}/download`;

              useConversationStore.getState().removeLocalMessage(progressMessageId);
              persistSheetFinalNote(
                deckGenerationChecklist({
                  lang: uiLang,
                  title: wb.title || sheetTitle,
                  phase: 'draft',
                  format: 'sheet',
                  unitCount: sheetCount,
                }),
                // Chip w transkrypcie (reload-safe, server-side): niesie workbookId +
                // downloadUrl → klik otwiera realny .xlsx (handleOpenDeliverableArtifact).
                {
                  deliverable: {
                    kind: 'sheet',
                    generationId: wb.id,
                    title: wb.title || sheetTitle,
                    workbookId: wb.id,
                    downloadUrl,
                  },
                }
              );
              // Uwaga: workbook rejestruje się w Materiałach po stronie backendu
              // (registerArtifactOrigin w /workbook/generate), więc NIE wołamy tu
              // registerChatDeliverable — uniknięcie zdublowanej/źle typowanej karty
              // oraz błędnego montażu draftu canvasa dla realnego .xlsx.
            } catch (err: unknown) {
              if (err instanceof DOMException && err.name === 'AbortError') return;
              // FAIL-SOFT: silnik formuł padł → wracamy na sprawdzony tor GFM.
              console.warn(
                '[UnifiedChatPanel] Workbook engine failed, falling back to GFM sheet track:',
                err
              );
              await runGfmSheetGeneration();
            }
          };

          if (resolveSheetLane(text) === 'workbook') {
            void runWorkbookGeneration();
          } else {
            void runGfmSheetGeneration();
          }
          return;
        }

        addChatMessage({
          id: `excele-redirect-${Date.now()}`,
          role: 'ai',
          content:
            uiLang === 'pl'
              ? 'Otwieram Tabele Studio — zaraz przygotuję Twoją tabelę.'
              : "Opening Table Studio — I'll prepare your table.",
          timestamp: new Date(),
        });

        useAppStore.getState().setChatKickoffMessage(text);
        navigateToRoute('/tabele');
        onMessageSent?.(content);
        return;
      }

      // Dokumenty: intercept document/report creation intents
      // N-12: also route here when an explicit document noun is present (even if
      // it escapes the verb-adjacent documentIntentDetector regexes, e.g. the
      // noun sits after a colon: "Zrób krótki raport: tabela …"). A document may
      // contain a table; the document wins over standalone Table/Excel.
      if (detectDocumentIntent(text) || hasStrongDocumentNoun(text)) {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        addChatMessage(userMessage);

        if (activeConversationId) {
          try {
            await addMessageToConversation({
              conversationId: activeConversationId,
              role: 'user',
              content,
              messageType: 'text',
            });
          } catch {
            /* best-effort persist */
          }
        }

        const uiLangDoc = (i18n.language || 'en').split('-')[0];

        // Deliverables light (L2): dokument powstaje w miejscu — realna treść
        // w canvasie (starter 'document') + checklista postępu, zamiast
        // redirectu do /wordy i formularza. Za flagą; off ⇒ legacy.
        if (isDeliverablesLightEnabled()) {
          const docTitle = deckTitleFromIntent(
            text,
            t('chat.deliverable.docTitle', 'Document from chat')
          );
          // Bez aktywnej konwersacji wiadomości lokalne giną w resecie stanu —
          // zapewniamy ją jak intercept Canvasa i dopiero wtedy piszemy.
          if (!useConversationStore.getState().activeConversationId) {
            try {
              const conv = await createConversation();
              await addMessageToConversation({
                conversationId: conv.id,
                role: 'user',
                content,
                messageType: 'text',
              });
            } catch (convErr) {
              console.error('[UnifiedChatPanel] Failed to create conversation for doc:', convErr);
            }
          }
          const progressMessageId = useConversationStore.getState().appendLocalMessage({
            role: 'ai',
            content: deckGenerationChecklist({
              lang: uiLangDoc,
              title: docTitle,
              phase: 'planning',
              format: 'doc',
            }),
          });
          onMessageSent?.(content);

          const updateDocChecklist = (
            phase: Parameters<typeof deckGenerationChecklist>[0]['phase'],
            extra?: {
              planCount?: number;
              planItems?: DeliverableGenerationPlanItem[];
              sources?: Array<{ sourceType: string; sourceId: string; sourceTitle?: string }>;
              unitCount?: number;
              sourcesCount?: number;
              error?: string;
            }
          ) => {
            useConversationStore.getState().updateMessageContent(
              progressMessageId,
              deckGenerationChecklist({
                lang: uiLangDoc,
                title: docTitle,
                phase,
                format: 'doc',
                ...extra,
              })
            );
          };

          const persistDocFinalNote = (
            note: string,
            // B2: deliverable ref w metadata wiadomości — persystowane server-side,
            // dzięki czemu ArtifactChip w transkrypcie przeżywa reload.
            metadata?: {
              deliverable: { kind: 'deck' | 'doc'; generationId: string; title?: string };
            }
          ) => {
            const conversationId = useConversationStore.getState().activeConversationId;
            if (!conversationId) return;
            void addMessageToConversation({
              conversationId,
              role: 'ai',
              content: note,
              messageType: 'text',
              ...(metadata ? { metadata } : {}),
            }).catch(() => {
              /* best-effort persist */
            });
          };

          // Grounding trybu rozmowy (D-L2-2b): krótki wycinek ostatnich wiadomości.
          const conversationContext = useConversationStore
            .getState()
            .activeMessages.slice(-6)
            .map(
              (m) => `${m.role === 'ai' ? 'Teresa' : 'User'}: ${String(m.content).slice(0, 400)}`
            )
            .join('\n');

          void (async () => {
            try {
              // B1: rozmowa otwarta z kontekstem encji (openChatWithContext) ⇒
              // encja staje się źródłem groundingu dokumentu (ContextPack ma
              // ekstraktory dla tych typów).
              const ENTITY_SOURCE_TYPES = ['initiative', 'task', 'decision', 'report'];
              const wsCtx = workspaceContext as
                | { type?: string; entityId?: string; entityName?: string }
                | null
                | undefined;
              const entitySourceRefs =
                wsCtx?.entityId && ENTITY_SOURCE_TYPES.includes(String(wsCtx.type || ''))
                  ? [
                      {
                        sourceType: String(wsCtx.type),
                        sourceId: wsCtx.entityId,
                        sourceTitle: wsCtx.entityName,
                      },
                    ]
                  : undefined;

              const planned = await planDocGeneration({
                intent: text,
                title: docTitle,
                // Język ARTEFAKTU podąża za językiem wiadomości (nie UI) —
                // "respond in the language I start speaking" dotyczy też dokumentu.
                language: effectiveChatLanguage === 'pl' ? 'pl' : 'en',
                conversationId: useConversationStore.getState().activeConversationId,
                conversationContext,
                sourceRefs: entitySourceRefs,
              });
              const enabledCount = planned.plan.filter((item) => item.enabled).length;
              const sourcesCount = planned.sources?.length || 0;
              updateDocChecklist('plan_ready', {
                planCount: enabledCount,
                planItems: planned.plan,
                sources: planned.sources,
                sourcesCount,
              });

              await startDocGeneration({
                generationId: planned.generationId,
                setup: planned.setup,
              });
              updateDocChecklist('generating', {
                planCount: enabledCount,
                planItems: planned.plan,
                sources: planned.sources,
                sourcesCount,
              });
              // Kimi-parity: dokument widoczny od razu jako szkielet sekcji;
              // gotową treść dociągnie event 'deliverables:draft-ready'.
              setRequestedCanvasDeckId(null);
              setRequestedCanvasDraftId(planned.generationId);
              setRequestedCanvasStarterId('document');
              setIsWorkPanelOpen(true);

              const final = await pollDeckGenerationUntilDone({
                generationId: planned.generationId,
                signal: deliverablesPollAbortRef.current?.signal,
                onUpdate: (status: DeliverableGenerationStatus) => {
                  if (status.state === 'validating') {
                    updateDocChecklist('validating', {
                      planCount: enabledCount,
                      planItems: planned.plan,
                      sources: planned.sources,
                      sourcesCount,
                    });
                  }
                },
              });
              if (final.state === 'draft') {
                useConversationStore.getState().removeLocalMessage(progressMessageId);
                persistDocFinalNote(
                  deckGenerationChecklist({
                    lang: uiLangDoc,
                    title: docTitle,
                    phase: 'draft',
                    format: 'doc',
                    planCount: enabledCount,
                    planItems: planned.plan,
                    sources: planned.sources,
                    sourcesCount,
                    unitCount: final.artifact?.unitCount,
                  }),
                  // B2: chip artefaktu w transkrypcie (reload-safe, server-side).
                  {
                    deliverable: {
                      kind: 'doc',
                      generationId: planned.generationId,
                      title: docTitle,
                    },
                  }
                );
                // B2: artefakt rozmowy (persisted) — przełącznik + aktywny artefakt.
                registerChatDeliverable('doc', planned.generationId, docTitle);
                announceDeliverableDraftReady(planned.generationId);
              } else {
                useConversationStore.getState().removeLocalMessage(progressMessageId);
                persistDocFinalNote(
                  deckGenerationChecklist({
                    lang: uiLangDoc,
                    title: docTitle,
                    phase: 'error',
                    format: 'doc',
                    error: final.error,
                  })
                );
              }
            } catch (err: unknown) {
              if (err instanceof DOMException && err.name === 'AbortError') return;
              updateDocChecklist('error', {
                error: err instanceof Error ? err.message : undefined,
              });
            }
          })();
          return;
        }

        addChatMessage({
          id: `doc-redirect-${Date.now()}`,
          role: 'ai',
          content:
            uiLangDoc === 'pl'
              ? 'Otwieram Dokumenty \u2014 zaraz zaczynam pracę nad dokumentem.'
              : "Opening Documents \u2014 I'll start working on your document.",
          timestamp: new Date(),
        });

        useAppStore.getState().setChatKickoffMessage(text);
        navigateToRoute('/wordy');
        onMessageSent?.(content);
        return;
      }

      // Prezentacje: intercept presentation/deck creation intents
      if (detectPresentationIntent(text)) {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        addChatMessage(userMessage);

        if (activeConversationId) {
          try {
            await addMessageToConversation({
              conversationId: activeConversationId,
              role: 'user',
              content,
              messageType: 'text',
            });
          } catch {
            /* best-effort persist */
          }
        }

        const uiLangPrez = (i18n.language || 'en').split('-')[0];

        // Deliverables light (L1, kroki 5+6): generacja w miejscu — deck jako
        // żywy artefakt w prawym panelu + checklista postępu w czacie,
        // zamiast nawigacji do osobnego modułu. Za flagą; off ⇒ legacy.
        if (isDeliverablesLightEnabled()) {
          const deckTitle = deckTitleFromIntent(
            text,
            t('chat.deliverable.deckTitle', 'Presentation from chat')
          );
          // Bez aktywnej konwersacji wiadomości lokalne giną w resecie stanu —
          // zapewniamy ją jak intercept Canvasa i dopiero wtedy piszemy.
          if (!useConversationStore.getState().activeConversationId) {
            try {
              const conv = await createConversation();
              await addMessageToConversation({
                conversationId: conv.id,
                role: 'user',
                content,
                messageType: 'text',
              });
            } catch (convErr) {
              console.error('[UnifiedChatPanel] Failed to create conversation for deck:', convErr);
            }
          }
          // Checklista jest ephemeral (local-only) — żywy postęp w activeMessages;
          // trwały wpis do rozmowy robimy raz, na stanie terminalnym.
          const progressMessageId = useConversationStore.getState().appendLocalMessage({
            role: 'ai',
            content: deckGenerationChecklist({
              lang: uiLangPrez,
              title: deckTitle,
              phase: 'planning',
            }),
          });

          setRequestedCanvasDeckId(null);
          setRequestedCanvasStarterId('presentation');
          setIsWorkPanelOpen(true);
          onMessageSent?.(content);

          const updateChecklist = (
            phase: Parameters<typeof deckGenerationChecklist>[0]['phase'],
            extra?: {
              planCount?: number;
              planItems?: DeliverableGenerationPlanItem[];
              sources?: Array<{ sourceType: string; sourceId: string; sourceTitle?: string }>;
              unitCount?: number;
              sourcesCount?: number;
              error?: string;
            }
          ) => {
            useConversationStore
              .getState()
              .updateMessageContent(
                progressMessageId,
                deckGenerationChecklist({ lang: uiLangPrez, title: deckTitle, phase, ...extra })
              );
          };

          const persistFinalNote = (
            note: string,
            // B2: deliverable ref w metadata wiadomości — persystowane server-side,
            // dzięki czemu ArtifactChip w transkrypcie przeżywa reload.
            metadata?: {
              deliverable: { kind: 'deck' | 'doc'; generationId: string; title?: string };
            }
          ) => {
            const conversationId = useConversationStore.getState().activeConversationId;
            if (!conversationId) return;
            void addMessageToConversation({
              conversationId,
              role: 'ai',
              content: note,
              messageType: 'text',
              ...(metadata ? { metadata } : {}),
            }).catch(() => {
              /* best-effort persist */
            });
          };

          void (async () => {
            try {
              const planned = await planDeckGeneration({
                intent: text,
                title: deckTitle,
                // Język artefaktu = język wiadomości użytkownika, nie język UI.
                language: effectiveChatLanguage === 'pl' ? 'pl' : 'en',
              });
              const enabledCount = planned.plan.filter((item) => item.enabled).length;
              updateChecklist('plan_ready', {
                planCount: enabledCount,
                planItems: planned.plan,
                sources: planned.sources,
              });

              await startDeckGeneration({
                generationId: planned.generationId,
                setup: planned.setup,
              });
              setRequestedCanvasDeckId(planned.generationId);
              updateChecklist('generating', {
                planCount: enabledCount,
                planItems: planned.plan,
                sources: planned.sources,
              });

              const final = await pollDeckGenerationUntilDone({
                generationId: planned.generationId,
                signal: deliverablesPollAbortRef.current?.signal,
                onUpdate: (status: DeliverableGenerationStatus) => {
                  if (status.state === 'validating') {
                    updateChecklist('validating', {
                      planCount: enabledCount,
                      planItems: planned.plan,
                      sources: planned.sources,
                    });
                  }
                },
              });
              if (final.state === 'draft') {
                // Stan terminalny: ephemeral checklistę zastępujemy trwałym wpisem
                // (przeżywa reload rozmowy); checklista znika.
                useConversationStore.getState().removeLocalMessage(progressMessageId);
                persistFinalNote(
                  deckGenerationChecklist({
                    lang: uiLangPrez,
                    title: deckTitle,
                    phase: 'draft',
                    planCount: enabledCount,
                    planItems: planned.plan,
                    sources: planned.sources,
                    unitCount: final.artifact?.unitCount,
                  }),
                  // B2: chip artefaktu w transkrypcie (reload-safe, server-side).
                  {
                    deliverable: {
                      kind: 'deck',
                      generationId: planned.generationId,
                      title: deckTitle,
                    },
                  }
                );
                // B2: artefakt rozmowy (persisted) — przełącznik + aktywny artefakt.
                registerChatDeliverable('deck', planned.generationId, deckTitle);
              } else {
                useConversationStore.getState().removeLocalMessage(progressMessageId);
                persistFinalNote(
                  deckGenerationChecklist({
                    lang: uiLangPrez,
                    title: deckTitle,
                    phase: 'error',
                    error: final.error,
                  })
                );
              }
            } catch (err: unknown) {
              if (err instanceof DOMException && err.name === 'AbortError') return;
              updateChecklist('error', {
                error: err instanceof Error ? err.message : undefined,
              });
            }
          })();
          return;
        }

        addChatMessage({
          id: `prez-redirect-${Date.now()}`,
          role: 'ai',
          content:
            uiLangPrez === 'pl'
              ? 'Otwieram Prezentacje \u2014 zaraz przygotuję deck.'
              : "Opening Presentations \u2014 I'll prepare your deck.",
          timestamp: new Date(),
        });

        useAppStore.getState().setChatKickoffMessage(text);
        navigateToRoute('/prezentacje');
        onMessageSent?.(content);
        return;
      }

      // Table Platform: intercept table creation/modification intents
      // Opens the AI Table Builder slide-over panel with the user's message
      // N-12: defensive — a document-noun prompt is already absorbed by the
      // Document gate above; this guard keeps standalone-table routing correct
      // even if gate ordering changes later.
      if (detectTableIntent(text) && !hasStrongDocumentNoun(text)) {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        addChatMessage(userMessage);

        if (activeConversationId) {
          try {
            await addMessageToConversation({
              conversationId: activeConversationId,
              role: 'user',
              content,
              messageType: 'text',
            });
          } catch {
            /* best-effort persist */
          }
        }

        const uiLang = (i18n.language || 'en').split('-')[0];
        addChatMessage({
          id: `table-builder-${Date.now()}`,
          role: 'ai',
          content:
            uiLang === 'pl'
              ? 'Otwieram AI Kreator Tabel \u2014 zaraz przygotuję propozycję struktury.'
              : "Opening AI Table Builder \u2014 I'll prepare a structure proposal for you.",
          timestamp: new Date(),
        });

        setTableBuilderInitialMsg(text);
        setTableBuilderOpen(true);

        onMessageSent?.(content);
        return;
      }

      // Mind Map: intercept mind map / idea map intents
      // Z20: only when the Mind Map canvas is actually the open tool — otherwise
      // 'idea-workspace-quick-action' has no listener and the prompt would
      // silently no-op instead of reaching the LLM (see useEffect above).
      const mmAction = activeIdeaWorkspaceTool === 'mindmap' ? detectMindmapIntent(text) : null;
      if (shouldUseLegacyIdeaIntentFallback(teresaIdeaActionsEnabled) && mmAction) {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        addChatMessage(userMessage);

        addChatMessage({
          id: `mm-intent-${Date.now()}`,
          role: 'ai',
          content: t('chat.working.mindMap', 'Working on mind map…'),
          timestamp: new Date(),
        });

        window.dispatchEvent(
          new CustomEvent('idea-workspace-quick-action', {
            // N-13: pass the raw prompt text through so mm_create / mm_apply_framework
            // handlers can seed the map topic / pick the right framework — the action
            // name alone isn't enough context to act on (see useMindMapQuickActions).
            detail: { action: mmAction, text },
          })
        );

        onMessageSent?.(content);
        return;
      }

      // Process Flow: intercept process/workflow intents
      // Z20: gated on the Process Flow canvas actually being open — see mm
      // gate above for why.
      const pfAction =
        activeIdeaWorkspaceTool === 'process_flow' ? detectProcessFlowIntent(text) : null;
      if (shouldUseLegacyIdeaIntentFallback(teresaIdeaActionsEnabled) && pfAction) {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        addChatMessage(userMessage);

        addChatMessage({
          id: `pf-intent-${Date.now()}`,
          role: 'ai',
          content: t('chat.working.processFlow', 'Building process flow…'),
          timestamp: new Date(),
        });

        window.dispatchEvent(
          new CustomEvent('idea-workspace-quick-action', {
            // pf_create carries the raw prompt so the process-flow AI
            // generator (flow_generator) has content to work from — see
            // useProcessFlowQuickActions.ts / IdeaProcessFlowTool.createFromPrompt.
            detail: { action: pfAction, prompt: text },
          })
        );

        onMessageSent?.(content);
        return;
      }

      // Whiteboard: intercept brainstorm/whiteboard/workshop intents
      // Canvas streaming: when a canvas doc is open and the user asks Teresa to
      // write INTO it, stream into the rich editor instead of replying in chat.
      // Bridged via a CustomEvent the WorkCanvasDocumentPanel listens for — no
      // direct coupling to the editor instance.
      const canvasStreamMode = activeCanvasDocument ? detectCanvasWriteIntent(text) : null;
      if (canvasStreamMode) {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        addChatMessage(userMessage);

        const uiLang = (i18n.language || 'en').split('-')[0];
        addChatMessage({
          id: `canvas-stream-${Date.now()}`,
          role: 'ai',
          // B3 — patch-mode gets its own status; the outcome reply arrives via
          // the 'canvas-patch-result' listener below once the diff is applied.
          content:
            canvasStreamMode === 'patch'
              ? uiLang === 'pl'
                ? 'Nanoszę punktową poprawkę w dokumencie…'
                : 'Applying a targeted edit in the document…'
              : uiLang === 'pl'
                ? 'Piszę w dokumencie…'
                : 'Writing in the document…',
          timestamp: new Date(),
        });

        // Give Teresa document + conversation awareness while streaming (same
        // canvasContextPacket shape /chat/stream reads, plus chat history/lang).
        const canvasStreamPacket = buildCanvasContextPacket(
          activeCanvasDocument,
          activeCanvasSelection
        );
        const canvasStreamHistory = (customMessages || messages || []).map(
          (m: { role: string; content: string }) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }],
          })
        );

        window.dispatchEvent(
          new CustomEvent('canvas-stream-request', {
            detail: {
              prompt: content,
              mode: canvasStreamMode,
              language: effectiveChatLanguage,
              canvasContextPacket: canvasStreamPacket,
              history: canvasStreamHistory,
            },
          })
        );

        onMessageSent?.(content);
        return;
      }

      // Whiteboard: intercept brainstorm/whiteboard/workshop intents.
      // Z20: gated on the Whiteboard canvas actually being open — see mm
      // gate above for why.
      const wbAction =
        activeIdeaWorkspaceTool === 'whiteboard' ? detectWhiteboardIntent(text) : null;
      if (shouldUseLegacyIdeaIntentFallback(teresaIdeaActionsEnabled) && wbAction) {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        addChatMessage(userMessage);

        addChatMessage({
          id: `wb-intent-${Date.now()}`,
          role: 'ai',
          content: t('chat.working.whiteboard', 'Running whiteboard action…'),
          timestamp: new Date(),
        });

        window.dispatchEvent(
          new CustomEvent('idea-workspace-quick-action', {
            detail: { action: wbAction },
          })
        );

        onMessageSent?.(content);
        return;
      }

      const saveIntent = parseChatSaveIntent(content);
      const effectivePrompt = saveIntent?.cleanPrompt || content;
      pendingChatSaveIntentRef.current = null;

      // Demo session enforcement (time + AI interactions quota)
      if (isDemo) {
        // Feedback #4180b14f: previously we attached a hardcoded English
        // `message` + `cta` to the access:blocked event, and the
        // AccessBlockedModal preferred that string over its i18n catalog —
        // so DE/ES/AR/JP users never saw a translated popup. Emit only the
        // error `code` here and let the modal resolve the localized copy
        // via `access.blocked.<code>` / `access.cta.*` keys.
        if (demoTimeRemainingMs <= 0) {
          window.dispatchEvent(
            new CustomEvent('access:blocked', {
              detail: { code: 'DEMO_TIME_EXPIRED' },
            })
          );
          return;
        }

        if ((aiInteractionsRemaining ?? 0) <= 0) {
          window.dispatchEvent(
            new CustomEvent('access:blocked', {
              detail: { code: 'DEMO_AI_SESSION_LIMIT_REACHED' },
            })
          );
          return;
        }

        // Count this interaction once per user send
        consumeAIInteraction();
      }

      // Read the active conversation from the store at send time. A quick
      // "new chat -> send" can otherwise reuse the previous render's id.
      let conversationId = useConversationStore.getState().activeConversationId;
      if (!conversationId) {
        try {
          const conv = await createConversation();
          conversationId = conv.id;
        } catch (err) {
          console.error('[UnifiedChatPanel] Failed to create conversation:', err);
          toast.error(getTeresaStartFailureMessage(i18n.language));
          return;
        }
      }
      // BUG 1b/2 fix: align the conversation store to THIS resolved id before building
      // history or appending the user bubble. Eliminates stale-render-closure bleed
      // (old thread sent as history) and guarantees the optimistic user message appends
      // (store guard: shouldAppend = activeConversationId === conversationId).
      if (useConversationStore.getState().activeConversationId !== conversationId) {
        setActiveConversation(conversationId);
      }
      // Persist the detected language onto the conversation so the whole thread
      // (and the chatLanguage memo on subsequent renders) follows the language
      // the user opened the conversation in.
      if (detectedMessageLanguage && conversationId) {
        const storedLang =
          useConversationStore.getState().chatLanguageByConversationId[conversationId];
        if (storedLang !== detectedMessageLanguage) {
          useConversationStore
            .getState()
            .setConversationChatLanguage(conversationId, detectedMessageLanguage);
        }
      }
      const sourceMessages = customMessages || useConversationStore.getState().activeMessages;

      // Conversation-scoped attachments: upload supported files to Knowledge Base and
      // pass doc filters to the backend so RAG only searches within these attachments.
      const existingAttachmentDocIds = Array.from(
        new Set(
          (sourceMessages || [])
            .flatMap((m: any) =>
              Array.isArray(m?.metadata?.attachments) ? m.metadata.attachments : []
            )
            .map((a: any) => a?.docId)
            .filter(Boolean)
            .map((x: any) => String(x))
        )
      );

      const files: File[] = Array.isArray(attachments)
        ? attachments.filter(
            (a: any): a is File => typeof File !== 'undefined' && a instanceof File
          )
        : [];

      const urlAttachments: Array<{ kind?: string; url: string; title?: string; name?: string }> =
        Array.isArray(attachments)
          ? attachments
              .filter((a: any) => a && typeof a === 'object' && typeof a.url === 'string')
              .map((a: any) => ({
                kind: a.kind,
                url: String(a.url),
                title: a.title ? String(a.title) : undefined,
                name: a.name ? String(a.name) : undefined,
              }))
          : [];

      // Re-attached docs from the Recent flyout (A5): already uploaded, so they
      // carry an existing docId and skip the upload loop — just add to RAG scope.
      const reattachedDocIds: string[] = Array.isArray(attachments)
        ? attachments
            .filter((a: any) => a && a.kind === 'doc' && a.docId)
            .map((a: any) => String(a.docId))
        : [];

      const uploadedAttachments: Array<{
        docId: string;
        filename: string;
        mimeType?: string;
        size?: number;
        sourceUrl?: string;
        kind?: 'file' | 'url';
      }> = [];
      const failedAttachments: Array<{
        filename: string;
        error: string;
        code?: string;
        extractionStatus?: string;
        mimeType?: string;
        kind?: 'file' | 'url';
      }> = [];

      // Show a visible "Analyzing file..." status message while files are being processed (C4.1)
      const sourcesCount = files.length + urlAttachments.length;
      const fileAnalysisMessageId = sourcesCount > 0 ? `file-analysis-${Date.now()}` : null;
      if (sourcesCount > 0 && fileAnalysisMessageId) {
        const sourceNames = [
          ...files.map((f) => f.name),
          ...urlAttachments.map((u) => u.name || u.url),
        ].join(', ');
        addChatMessage({
          id: fileAnalysisMessageId,
          role: 'assistant',
          content: t(
            'aiChat.attachments.analyzingSources',
            '📎 Analyzing {{count}} attachment(s): {{names}}... Extracting content for AI analysis.',
            { count: sourcesCount, names: sourceNames }
          ),
          timestamp: new Date(),
          isStreaming: true,
        } as ChatMessage);
        setIsBotTyping(true);
      }

      for (const file of files) {
        // M01-P04A — matrix pre-check (packet §3.3): reject honestly, with the
        // SPECIFIC reason (format vs size), before spending a network round-trip
        // on an upload the server would reject anyway. Recorded into
        // failedAttachments so it survives on the message the same way a
        // server-side ingest failure does (both feed the same "❌ Could not
        // process..." summary + persisted metadata.failedAttachments).
        const rejectionReason = getChatAttachmentRejectionReason(file);
        if (rejectionReason) {
          console.warn('[UnifiedChatPanel] Skipping attachment outside the matrix:', {
            name: file.name,
            type: file.type,
            size: file.size,
            reason: rejectionReason,
          });
          if (rejectionReason === 'SIZE_LIMIT_EXCEEDED') {
            const maxMb = Math.round(MAX_CHAT_ATTACHMENT_BYTES / (1024 * 1024));
            toast.error(
              t(
                'aiChat.attachments.sizeExceeded',
                'Plik "{{name}}" przekracza limit {{maxMb}} MB.',
                { name: file.name, maxMb }
              ),
              { duration: 5000 }
            );
          } else {
            toast.error(
              t(
                'aiChat.attachments.unsupportedType',
                'Plik "{{name}}" nie jest obsługiwany. Dozwolone formaty: {{types}}.',
                { name: file.name, types: SUPPORTED_CHAT_ATTACHMENT_LABEL }
              ),
              { duration: 5000 }
            );
          }
          failedAttachments.push({
            filename: file.name,
            error:
              rejectionReason === 'SIZE_LIMIT_EXCEEDED'
                ? `File exceeds the ${Math.round(MAX_CHAT_ATTACHMENT_BYTES / (1024 * 1024))}MB limit`
                : `Unsupported format — allowed: ${SUPPORTED_CHAT_ATTACHMENT_LABEL}`,
            code: rejectionReason,
            mimeType: file.type || undefined,
            kind: 'file',
          });
          continue;
        }

        try {
          const resp = await Api.uploadChatAttachment(file);
          const docId = String((resp as any)?.docId || '');
          if (!docId) {
            toast.error(
              t('aiChat.attachments.uploadFailed', 'Nie udało się przetworzyć pliku "{{name}}".', {
                name: file.name,
              }),
              { duration: 4000 }
            );
            continue;
          }
          uploadedAttachments.push({
            docId,
            filename: file.name,
            mimeType: file.type || undefined,
            size: file.size,
            kind: 'file',
          });
          // A5: upgrade the Recent entry with the real docId so it can be
          // re-attached later without re-uploading.
          pushRecentAttachment({ name: file.name, docId, mimeType: file.type || undefined });
          toast.success(
            t('aiChat.attachments.uploadSuccess', 'Załącznik "{{name}}" przetworzony.', {
              name: file.name,
            }),
            { duration: 2000 }
          );
        } catch (err: any) {
          console.error('[UnifiedChatPanel] Failed to upload attachment:', err);
          const errMsg = String(err?.message || '');
          const data = (err as any)?.data || (err as any)?.response?.data || {};
          failedAttachments.push({
            filename: file.name,
            error:
              String(data?.error || errMsg || '').trim() ||
              t(
                'aiChat.attachments.extractionFailedShort',
                'Could not extract readable text from this file.'
              ),
            code: typeof data?.code === 'string' ? data.code : undefined,
            extractionStatus:
              typeof data?.extractionStatus === 'string' ? data.extractionStatus : undefined,
            mimeType: file.type || undefined,
            kind: 'file',
          });
          const isTextExtraction = errMsg.includes('extract') || errMsg.includes('text');
          toast.error(
            isTextExtraction
              ? t(
                  'aiChat.attachments.extractionFailed',
                  'Nie udało się odczytać tekstu z pliku "{{name}}". Sprawdź czy plik nie jest pusty lub uszkodzony.',
                  { name: file.name }
                )
              : t(
                  'aiChat.attachments.uploadError',
                  'Błąd przesyłania pliku "{{name}}": {{error}}',
                  { name: file.name, error: errMsg.slice(0, 100) }
                ),
            { duration: 5000 }
          );
        }
      }

      for (const urlAtt of urlAttachments) {
        const url = String(urlAtt.url || '').trim();
        if (!url) continue;
        try {
          const resp = await Api.ingestChatUrlAttachment(url, { title: urlAtt.title });
          const docId = String((resp as any)?.docId || '');
          if (!docId) {
            toast.error(
              t('aiChat.attachments.urlIngestFailed', 'Nie udało się przetworzyć linku.'),
              {
                duration: 4000,
              }
            );
            continue;
          }
          const filename = String((resp as any)?.filename || '').trim() || urlAtt.name || url;
          uploadedAttachments.push({
            docId,
            filename,
            mimeType: (resp as any)?.mimeType || 'text/html',
            sourceUrl: String((resp as any)?.sourceUrl || url),
            kind: 'url',
          });
          toast.success(t('aiChat.attachments.urlReady', 'Link przetworzony.'), { duration: 1500 });
        } catch (err: any) {
          console.error('[UnifiedChatPanel] Failed to ingest URL attachment:', err);
          failedAttachments.push({
            filename: urlAtt.name || url,
            error: String((err as any)?.data?.error || err?.message || 'URL ingestion failed'),
            code: typeof (err as any)?.data?.code === 'string' ? (err as any).data.code : undefined,
            extractionStatus:
              typeof (err as any)?.data?.extractionStatus === 'string'
                ? (err as any).data.extractionStatus
                : undefined,
            mimeType: undefined,
            kind: 'url',
          });
          toast.error(
            t('aiChat.attachments.urlError', 'Błąd przetwarzania linku: {{error}}', {
              error: String(err?.message || '').slice(0, 120),
            }),
            { duration: 5000 }
          );
        }
      }

      // Remove the "Analyzing file..." message once processing is done
      if (fileAnalysisMessageId) {
        if (uploadedAttachments.length > 0) {
          const processedNames = uploadedAttachments.map((a) => a.filename).join(', ');
          const partialFailure = uploadedAttachments.length < sourcesCount;
          addChatMessage({
            id: fileAnalysisMessageId,
            role: 'assistant',
            content: partialFailure
              ? t(
                  'aiChat.attachments.filesPartial',
                  '⚠️ {{processed}}/{{total}} attachment(s) processed: {{names}}. Some sources could not be read and will not be referenced. You can retry them or continue.',
                  {
                    processed: uploadedAttachments.length,
                    total: sourcesCount,
                    names: processedNames,
                  }
                )
              : t(
                  'aiChat.attachments.filesReady',
                  '📎 {{count}} attachment(s) ready for analysis: {{names}}. The AI will reference these sources in its response.',
                  { count: uploadedAttachments.length, names: processedNames }
                ),
            timestamp: new Date(),
          } as ChatMessage);
        } else if (sourcesCount > 0) {
          // All attachments failed — surface a persistent, actionable error in the chat
          // instead of silently deleting the analysis message (feedback #f590c4fc, #e196a572).
          const failedNames = [
            ...files.map((f) => f.name),
            ...urlAttachments.map((u) => u.name || u.url),
          ].join(', ');
          addChatMessage({
            id: fileAnalysisMessageId,
            role: 'assistant',
            content: t(
              'aiChat.attachments.allFailed',
              '❌ Could not process the attached source(s): {{names}}. The AI will respond without them. Please re-upload in a supported format (PDF, TXT, MD, CSV, JSON) or check that the link is publicly accessible.',
              { names: failedNames }
            ),
            timestamp: new Date(),
          } as ChatMessage);
        } else {
          deleteChatMessage(fileAnalysisMessageId);
        }
        setIsBotTyping(false);
      }

      const attachmentDocIds = Array.from(
        new Set([
          ...existingAttachmentDocIds,
          ...reattachedDocIds,
          ...uploadedAttachments.map((a) => a.docId),
        ])
      );

      const canvasContextPacket = buildCanvasContextPacket(
        activeCanvasDocument,
        activeCanvasSelection
      );

      // Save user message to conversation store
      if (conversationId) {
        try {
          const userMessageMetadata =
            uploadedAttachments.length > 0 ||
            failedAttachments.length > 0 ||
            attachmentDocIds.length > 0 ||
            canvasContextPacket
              ? {
                  ...(uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : {}),
                  ...(failedAttachments.length > 0 ? { failedAttachments } : {}),
                  // Persist the KB doc ids attached to this turn so the RAG scope can be
                  // reconstructed after a page reload (previously only sent to the live AI call).
                  ...(attachmentDocIds.length > 0 ? { attachmentDocIds } : {}),
                  ...(canvasContextPacket
                    ? {
                        canvasContext: {
                          schemaVersion: canvasContextPacket.schemaVersion,
                          activeDraft: canvasContextPacket.activeDraft,
                          memorySnapshot: canvasContextPacket.memorySnapshot,
                          selection: canvasContextPacket.selection
                            ? {
                                mode: canvasContextPacket.selection.mode,
                                selectedText: canvasContextPacket.selection.selectedText,
                              }
                            : null,
                        },
                      }
                    : {}),
                }
              : undefined;
          await addMessageToConversation({
            conversationId,
            role: 'user',
            content,
            messageType: 'text',
            metadata: userMessageMetadata as any,
          });
        } catch (err) {
          // Don't silently swallow: the store keeps the optimistic bubble flagged with
          // localError and retries in the background (idempotent via clientMessageId), but
          // surface a non-blocking warning so the user knows this turn may not be persisted.
          console.error('[UnifiedChatPanel] Failed to save user message:', err);
          toast.error(
            t(
              'aiChat.errors.messageSaveFailed',
              "Couldn't save your message — retrying. It may not appear after a refresh until the save succeeds."
            )
          );
        }
      }

      // Also add to useAppStore for backward compatibility
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };
      addChatMessage(userMessage);

      if (onModuleIntent) {
        try {
          const moduleIntentResult = await onModuleIntent(effectivePrompt);
          const handledByModule =
            typeof moduleIntentResult === 'object'
              ? moduleIntentResult.handled
              : Boolean(moduleIntentResult);
          if (handledByModule) {
            const moduleReply =
              typeof moduleIntentResult === 'object'
                ? String(moduleIntentResult.reply || '').trim()
                : '';
            if (moduleReply) {
              addChatMessage({
                id: `module-intent-${Date.now()}`,
                role: 'ai',
                content: moduleReply,
                timestamp: new Date(),
              });
              if (conversationId) {
                try {
                  await addMessageToConversation({
                    conversationId,
                    role: 'ai',
                    content: moduleReply,
                    messageType: 'text',
                  });
                } catch {
                  /* best-effort persist */
                }
              }
            }
            onMessageSent?.(content);
            return;
          }
        } catch (err) {
          console.error('[UnifiedChatPanel] Module intent handler failed:', err);
          const errorContent = i18n.language?.startsWith('pl')
            ? 'Nie udało się wykonać tej akcji w aktywnym module.'
            : 'I could not complete that action in the active module.';
          addChatMessage({
            id: `module-intent-error-${Date.now()}`,
            role: 'ai',
            content: errorContent,
            timestamp: new Date(),
          });
          if (conversationId) {
            try {
              await addMessageToConversation({
                conversationId,
                role: 'ai',
                content: errorContent,
                messageType: 'text',
              });
            } catch {
              /* best-effort persist */
            }
          }
          onMessageSent?.(content);
          return;
        }
      }

      // Z4 transport — manifest akcji OTWARTEJ reprezentacji Idei, FILTROWANY po
      // aktualnie otwartym narzędziu (w Tablicy Teresa nie dostaje akcji Mapy).
      // Budujemy tylko gdy flaga buildowa ON i idea-canvas jest otwarty; inaczej
      // NIC nie dokładamy do `context` (zapytanie bajt-w-bajt jak dziś). Kontekst
      // wykonania zapamiętujemy w ref na powrót tool-calla. Serwer i tak ignoruje
      // manifest bez swojej flagi ENABLE_TERESA_IDEA_ACTIONS.
      const teresaIdeaTool =
        teresaIdeaActionsEnabled &&
        (activeIdeaWorkspaceTool === 'mindmap' ||
          activeIdeaWorkspaceTool === 'whiteboard' ||
          activeIdeaWorkspaceTool === 'process_flow' ||
          activeIdeaWorkspaceTool === 'table')
          ? (activeIdeaWorkspaceTool as CanvasToolType)
          : null;
      const teresaIdeaId =
        typeof workspaceContext?.entityId === 'string' ? workspaceContext.entityId : '';
      const teresaIdeaManifest = teresaIdeaTool
        ? toServerIdeaActionManifest(buildTeresaToolManifest({ tool: teresaIdeaTool }))
        : null;
      teresaIdeaCtxRef.current = teresaIdeaTool
        ? { ideaId: teresaIdeaId, tool: teresaIdeaTool }
        : null;

      // Build context for AI — include file metadata so the model can cite/reference attachments (C4.1)
      const context = {
        focusMode,
        // Z4 transport — payload manifestu (tylko gdy zbudowany). Pole
        // przepuszczalne przez walidator (context = z.record), więc bez zmian
        // w schemacie. Serwer czyta je za swoją flagą.
        ...(teresaIdeaManifest && teresaIdeaManifest.length > 0
          ? {
              ideaActionManifest: teresaIdeaManifest,
              ideaContext: { ideaId: teresaIdeaId, tool: teresaIdeaTool },
            }
          : {}),
        attachments: uploadedAttachments,
        failedAttachments,
        attachmentDocIds,
        // Provide file names and types so the AI can reference them in its response
        attachmentFileNames: uploadedAttachments.map((a) => a.filename),
        hasAttachments: uploadedAttachments.length > 0,
        // v3 context-awareness: pass project + screen context in the shape expected by backend
        projectId: workspaceContext?.projectId || null,
        screenContext: {
          screenId: workspaceContext?.view || workspaceContext?.type || null,
          currentScreen: workspaceContext?.type || null,
          selectedObjectId: workspaceContext?.entityId || null,
          selectedObjectType: workspaceContext?.type || null,
          route: routeInfo,
          page: (workspaceContext as any)?.entityData || null,
        },
        workspaceContext,
        canvasContextPacket,
        canvasMemorySnapshot: canvasContextPacket?.memorySnapshot || null,
        canvasContext: activeCanvasSelection
          ? {
              draftId: activeCanvasSelection.draftId || activeCanvasDocument?.draftId || null,
              title: activeCanvasDocument?.title || null,
              mode: activeCanvasSelection.mode,
              selectedText: activeCanvasSelection.selectedText,
              startOffset: activeCanvasSelection.startOffset ?? null,
              endOffset: activeCanvasSelection.endOffset ?? null,
              packetSchemaVersion: canvasContextPacket?.schemaVersion || null,
            }
          : activeCanvasDocument
            ? {
                draftId: activeCanvasDocument.draftId || null,
                title: activeCanvasDocument.title,
                packetSchemaVersion: canvasContextPacket?.schemaVersion || null,
              }
            : null,
        conversationId,
        conversationLanguage: effectiveChatLanguage,
        virtualWorkerSlug: 'teresa',
      };

      // Backend expects history roles as: user | model (Gemini-style)
      const history = sourceMessages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const normalized = String(effectivePrompt || '')
        .trim()
        .toLowerCase();
      const forceDepthTriggers = [
        'go deeper',
        'too shallow',
        'challenge this conclusion',
        // Polish (accept as user input too)
        'idź głębiej',
        'za płytkie',
        'podważ wnioski',
        'podważ tę konkluzję',
        'podważ tę rekomendację',
      ];
      const isForceDepth = forceDepthTriggers.includes(normalized);

      // Deep Thinking: force-depth triggers bypass Confirm (they are a quality control action)
      if ((aiConfig?.deepResearch || (aiConfig as any)?.marketResearch) && isForceDepth) {
        const base = sourceMessages.filter(
          (m) => !((m as any).metadata?.deepThinking?.kind === 'confirm')
        );
        const history = base.map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }));

        // Reuse last confirm payload if present (keeps flow deterministic while not blocking)
        const lastConfirm = sourceMessages
          .slice()
          .reverse()
          .find((m: any) => m?.metadata?.deepThinking?.kind === 'confirm') as any;

        pendingChatSaveIntentRef.current = saveIntent
          ? { target: saveIntent.target, originalUserMessage: content }
          : null;
        await startStream(
          effectivePrompt,
          history,
          systemPrompt,
          {
            ...(context || {}),
            deepThinkingConfirmed: true,
            deepThinkingConfirm: lastConfirm?.metadata?.deepThinkingConfirm,
            deepThinkingDepth: 'hard',
            forceDepth: true,
          },
          focusMode,
          roleName,
          effectiveChatLanguage
        );

        onMessageSent?.(content);
        return;
      }

      // Deep Thinking: blocking Confirm step (no streaming until user confirms)
      if (aiConfig?.deepResearch || (aiConfig as any)?.marketResearch) {
        if (dtConfirmBusy) return;
        setDtConfirmBusy(true);
        try {
          const confirmRes = await Api.chatConfirm(
            effectivePrompt,
            history,
            systemPrompt,
            context,
            roleName,
            effectiveChatLanguage,
            {
              deepResearch: aiConfig?.deepResearch,
              webSearch: aiConfig?.webSearch,
              showReasoning: aiConfig?.showReasoning,
              multiAgent: (aiConfig as any)?.multiAgent,
              marketResearch: (aiConfig as any)?.marketResearch,
              coThinkerMode: (aiConfig as any)?.coThinkerMode ?? null,
              privateMode: (aiConfig as any)?.privateMode ?? false,
              knowledgeSources: aiConfig?.knowledgeSources,
              responseStyle: aiConfig?.responseStyle,
              customInstructions: (aiConfig as any)?.customInstructions ?? undefined,
              selectedTier: (aiConfig as any)?.selectedTier || undefined,
              selectedModelId: (aiConfig as any)?.selectedModelId ?? null,
            } as any
          );

          const c = (confirmRes as any)?.confirm || {};
          const u = c?.understanding || {};
          // Agent Audit Layer: suggested reviewers (manual approval before DT)
          const decisionContext = {
            topic: String(content || '').trim(),
            horizon: String(u.decisionHorizon || '').trim() || undefined,
            industry: undefined,
            functions: [],
            riskFocus: [],
          };
          let suggestedAgentsSet: any = null;
          try {
            const suggestRes = await Api.agentAuditSuggest({
              decisionContext,
              userIntent: 'validate',
              language: effectiveChatLanguage,
              maxAgents: 3,
            });
            suggestedAgentsSet = (suggestRes as any)?.suggested || null;
          } catch {
            // best-effort; DT can proceed without agent layer
          }
          const md = [
            '**My understanding of your task**',
            `- Goal: ${u.goal || ''}`,
            u.context ? `- Context: ${u.context}` : '',
            Array.isArray(u.constraints) && u.constraints.length
              ? `- Constraints: ${u.constraints.join('; ')}`
              : '',
            u.expectedOutput ? `- Output: ${u.expectedOutput}` : '',
            u.decisionHorizon ? `- Horizon: ${u.decisionHorizon}` : '',
            '',
            Array.isArray(c.missingInfoQuestions) && c.missingInfoQuestions.length
              ? `**Assumptions & gaps (optional):**\n${c.missingInfoQuestions
                  .slice(0, 3)
                  .map((q: any, i: number) => `${i + 1}. ${q.question}`)
                  .join('\n')}`
              : '',
            '',
            '_Confirm to start Deep Thinking. Adjust if the task needs correction._',
          ]
            .filter(Boolean)
            .join('\n');

          // Persist confirm card as an AI message (so it survives refresh / history)
          let confirmMessageId = `dt-confirm-${Date.now()}`;
          if (conversationId) {
            const saved = await addMessageToConversation({
              conversationId,
              role: 'ai',
              content: md,
              messageType: 'text',
              metadata: {
                deepThinking: { kind: 'confirm', originalMessage: effectivePrompt },
                deepThinkingConfirm: c,
                agentAuditSuggested: suggestedAgentsSet,
              } as any,
            });
            confirmMessageId = (saved as any)?.id || confirmMessageId;
          } else {
            addChatMessage({
              id: confirmMessageId,
              role: 'ai',
              content: md,
              timestamp: new Date(),
              metadata: {
                deepThinking: { kind: 'confirm', originalMessage: effectivePrompt },
                deepThinkingConfirm: c,
                agentAuditSuggested: suggestedAgentsSet,
              },
            } as any);
          }

          setDtPendingConfirm({
            messageId: confirmMessageId,
            conversationId: conversationId || null,
            originalMessage: effectivePrompt,
            editedMessage: effectivePrompt,
            confirm: c,
            context,
            attachments,
            agentAudit: {
              suggested: suggestedAgentsSet,
              orchestratorRunId: String(suggestedAgentsSet?.orchestratorRunId || ''),
              selectedAgentIds: Array.isArray(suggestedAgentsSet?.agents)
                ? suggestedAgentsSet.agents
                    .map((a: any) => String(a?.agentId || ''))
                    .filter(Boolean)
                : [],
              userIntent: 'validate',
              maxAgents: 3,
              decisionContext,
            },
          });

          onMessageSent?.(content);
          return;
        } catch (err) {
          console.error('[UnifiedChatPanel] Deep Thinking confirm failed:', err);
          throw err;
        } finally {
          setDtConfirmBusy(false);
        }
      }

      // Add placeholder for AI response in useAppStore (legacy + non-conversation views)
      addChatMessage({
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      });

      // Start streaming (standard mode)
      pendingChatSaveIntentRef.current = saveIntent
        ? { target: saveIntent.target, originalUserMessage: content }
        : null;
      await startStream(
        effectivePrompt,
        history,
        systemPrompt,
        context,
        focusMode,
        roleName,
        effectiveChatLanguage
      );

      // Callback
      onMessageSent?.(content);
    },
    [
      activeConversationId,
      createConversation,
      addMessageToConversation,
      addChatMessage,
      displayMessages,
      messages,
      customMessages,
      focusMode,
      chatLanguage,
      workspaceContext,
      mode,
      activeCanvasDocument,
      activeCanvasSelection,
      activeIdeaWorkspaceTool,
      startStream,
      isDisabled,
      isDemo,
      demoTimeRemainingMs,
      aiInteractionsRemaining,
      aiInteractionsLimit,
      consumeAIInteraction,
      onMessageSent,
      onModuleIntent,
      aiConfig,
      dtConfirmBusy,
      addMessageToConversation,
      i18n.language,
      setIsBotTyping,
    ]
  );

  // Chat V8 — smart-suggestion dispatcher. Lives below `handleSendMessage`
  // so the `type: 'chat'` branch can forward the prompt straight into the
  // send pipeline without hitting a temporal-dead-zone reference.
  const handleSuggestionClick = useCallback(
    async (suggestion: ChatSuggestion) => {
      if (suggestion.action.type === 'chat') {
        const prompt = String((suggestion.action as { prompt?: unknown }).prompt ?? '').trim();
        if (!prompt) return;
        await handleSendMessage(prompt);
        return;
      }
      await handleChatAction(suggestion.action);
    },
    [handleChatAction, handleSendMessage]
  );

  // One-shot kickoff: when panel opens in split mode, auto-send the configured message.
  useEffect(() => {
    if (!kickoffMessage) return;
    if (isDisabled) return;
    if (isStreaming) return;
    if ((customMessages || []).length > 0) return;
    if ((activeMessages || []).length > 0) return;
    if (lastKickoffSentRef.current === kickoffMessage) return;

    // Fire-and-forget; handleSendMessage creates conversation if needed
    void handleSendMessage(kickoffMessage);
    lastKickoffSentRef.current = kickoffMessage;
    onKickoffConsumed?.();
  }, [
    kickoffMessage,
    isDisabled,
    isStreaming,
    customMessages,
    activeMessages,
    handleSendMessage,
    onKickoffConsumed,
  ]);

  const handleDeepThinkingProceed = useCallback(async () => {
    if (!dtPendingConfirm) return;
    if (isDisabled) return;

    // Build backend-compatible history, excluding confirm cards (they are UI-only)
    const base = (customMessages || messages).filter(
      (m) => !((m as any).metadata?.deepThinking?.kind === 'confirm')
    );
    const history = base.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const depthRaw = dtPendingConfirm?.confirm?.suggestedDepth || 'Standard';
    const depth = String(depthRaw).toLowerCase(); // light|standard|hard

    // Agent Audit Layer: lock context for post-DT review + directed loop
    const agentIds =
      dtPendingConfirm.agentAudit?.selectedAgentIds ||
      (Array.isArray(dtPendingConfirm.agentAudit?.suggested?.agents)
        ? dtPendingConfirm.agentAudit?.suggested?.agents
            ?.map((a: any) => String(a?.agentId || '').trim())
            .filter(Boolean)
        : []);
    const decisionContext =
      dtPendingConfirm.agentAudit?.decisionContext ||
      ({
        topic: String(
          dtPendingConfirm.editedMessage || dtPendingConfirm.originalMessage || ''
        ).trim(),
        horizon:
          String(dtPendingConfirm?.confirm?.understanding?.decisionHorizon || '').trim() ||
          undefined,
        industry: undefined,
        functions: [],
        riskFocus: [],
      } as any);

    deepThinkingRunRef.current = {
      conversationId: dtPendingConfirm.conversationId,
      decisionContext,
      agentIds,
      userIntent: dtPendingConfirm.agentAudit?.userIntent || 'validate',
      loopIteration: 1,
      deepThinkingConfirm: dtPendingConfirm.confirm,
    };

    // Persist approved agent set for transparency/history
    if (dtPendingConfirm.conversationId) {
      try {
        const suggested = dtPendingConfirm.agentAudit?.suggested?.agents || [];
        const selectedSet = new Set(agentIds);
        const selectedAgents = (Array.isArray(suggested) ? suggested : [])
          .map((a: any) => ({
            agentId: String(a?.agentId || '').trim(),
            whySelected: String(a?.whySelected || '').trim(),
          }))
          .filter((a: any) => a.agentId && selectedSet.has(a.agentId));

        const lines: string[] = [];
        lines.push('**Agent Audit — approved reviewers (pre Deep Thinking)**');
        lines.push(
          `- Intent: **${String(dtPendingConfirm.agentAudit?.userIntent || 'validate')}**`
        );
        lines.push(`- Max agents: **${String(dtPendingConfirm.agentAudit?.maxAgents || 3)}**`);
        lines.push('');
        for (const a of selectedAgents) {
          const label =
            agentRegistryById[a.agentId]?.displayName?.pl ||
            agentRegistryById[a.agentId]?.displayName?.en ||
            a.agentId;
          lines.push(`- **${String(label)}**`);
          if (a.whySelected) lines.push(`  - ${a.whySelected}`);
        }

        const approvalContent = lines.filter(Boolean).join('\n');
        await addMessageToConversation({
          conversationId: dtPendingConfirm.conversationId,
          role: 'ai',
          content: approvalContent,
          messageType: 'text',
          metadata: {
            agentAudit: {
              kind: 'approval',
              suggested: dtPendingConfirm.agentAudit?.suggested || null,
              selectedAgentIds: agentIds,
              userIntent: dtPendingConfirm.agentAudit?.userIntent || 'validate',
              maxAgents: dtPendingConfirm.agentAudit?.maxAgents || 3,
              decisionContext,
            },
          } as any,
        });
      } catch {
        // best-effort
      }
    }

    // Legacy placeholder in global store
    addChatMessage({
      id: `ai-${Date.now()}`,
      role: 'ai',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    });

    // Consume the confirm card before streaming starts. If the stream is slow,
    // subsequent user input must not regenerate another confirm card for the
    // same task and look like a Deep Thinking loop.
    setDtPendingConfirm(null);

    // Start stream with Deep Thinking context hints
    await startStream(
      dtPendingConfirm.editedMessage || dtPendingConfirm.originalMessage,
      history,
      systemPrompt,
      {
        ...(dtPendingConfirm.context || {}),
        deepThinkingConfirmed: true,
        deepThinkingConfirm: dtPendingConfirm.confirm,
        deepThinkingDepth: depth,
        agentAudit: {
          orchestratorRunId: dtPendingConfirm.agentAudit?.orchestratorRunId || null,
          agentIds,
          userIntent: dtPendingConfirm.agentAudit?.userIntent || 'validate',
          loopIteration: 1,
          decisionContext,
        },
      },
      focusMode,
      roleName,
      chatLanguage
    );
  }, [
    dtPendingConfirm,
    isDisabled,
    customMessages,
    messages,
    addChatMessage,
    addMessageToConversation,
    agentRegistryById,
    startStream,
    systemPrompt,
    focusMode,
    roleName,
    chatLanguage,
  ]);

  const handleDeepThinkingReconfirm = useCallback(async () => {
    if (!dtPendingConfirm) return;
    if (dtConfirmBusy) return;
    setDtConfirmBusy(true);
    try {
      const base = (customMessages || messages).filter(
        (m) => !((m as any).metadata?.deepThinking?.kind === 'confirm')
      );
      const history = base.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const confirmRes = await Api.chatConfirm(
        dtPendingConfirm.editedMessage || dtPendingConfirm.originalMessage,
        history,
        systemPrompt,
        dtPendingConfirm.context,
        roleName,
        chatLanguage,
        {
          deepResearch: aiConfig?.deepResearch,
          webSearch: aiConfig?.webSearch,
          showReasoning: aiConfig?.showReasoning,
          multiAgent: (aiConfig as any)?.multiAgent,
          marketResearch: (aiConfig as any)?.marketResearch,
          coThinkerMode: (aiConfig as any)?.coThinkerMode ?? null,
          privateMode: (aiConfig as any)?.privateMode ?? false,
          knowledgeSources: aiConfig?.knowledgeSources,
          responseStyle: aiConfig?.responseStyle,
          customInstructions: (aiConfig as any)?.customInstructions ?? undefined,
          selectedTier: (aiConfig as any)?.selectedTier || undefined,
          selectedModelId: (aiConfig as any)?.selectedModelId ?? null,
        } as any
      );

      const c = (confirmRes as any)?.confirm || {};
      // Refresh Agent Audit suggestions after reconfirm (task may have changed)
      const u = c?.understanding || {};
      const decisionContext = {
        topic: String(
          dtPendingConfirm.editedMessage || dtPendingConfirm.originalMessage || ''
        ).trim(),
        horizon: String(u.decisionHorizon || '').trim() || undefined,
        industry: undefined,
        functions: [],
        riskFocus: [],
      };
      let suggestedAgentsSet: any = null;
      try {
        const suggestRes = await Api.agentAuditSuggest({
          decisionContext,
          userIntent: dtPendingConfirm.agentAudit?.userIntent || 'validate',
          language: chatLanguage,
          maxAgents: dtPendingConfirm.agentAudit?.maxAgents || 3,
        });
        suggestedAgentsSet = (suggestRes as any)?.suggested || null;
      } catch {
        // ignore
      }

      setDtPendingConfirm((prev) => {
        if (!prev) return prev;
        const prevSelected = prev.agentAudit?.selectedAgentIds || [];
        const nextSuggestedIds = Array.isArray(suggestedAgentsSet?.agents)
          ? suggestedAgentsSet.agents.map((a: any) => String(a?.agentId || '')).filter(Boolean)
          : prevSelected;
        const nextSelected =
          prevSelected.length > 0
            ? nextSuggestedIds.filter((id: string) => prevSelected.includes(id))
            : nextSuggestedIds;
        return {
          ...prev,
          confirm: c,
          agentAudit: {
            ...(prev.agentAudit || {
              selectedAgentIds: [],
              userIntent: 'validate',
              maxAgents: 3,
            }),
            suggested: suggestedAgentsSet || prev.agentAudit?.suggested,
            orchestratorRunId: String(
              suggestedAgentsSet?.orchestratorRunId || prev.agentAudit?.orchestratorRunId || ''
            ),
            selectedAgentIds: nextSelected,
            decisionContext,
          },
        };
      });
    } catch (err) {
      console.error('[UnifiedChatPanel] Deep Thinking reconfirm failed:', err);
      throw err;
    } finally {
      setDtConfirmBusy(false);
    }
  }, [
    dtPendingConfirm,
    dtConfirmBusy,
    customMessages,
    messages,
    systemPrompt,
    roleName,
    chatLanguage,
    aiConfig,
  ]);

  const refreshAgentAuditSuggestionsOnly = useCallback(
    async (overrides?: {
      userIntent?: 'validate' | 'stress_test' | 'approve';
      maxAgents?: 2 | 3 | 4;
    }) => {
      if (!dtPendingConfirm) return;
      const decisionContext =
        dtPendingConfirm.agentAudit?.decisionContext ||
        ({
          topic: String(
            dtPendingConfirm.editedMessage || dtPendingConfirm.originalMessage || ''
          ).trim(),
          industry: undefined,
          horizon: undefined,
          functions: [],
          riskFocus: [],
        } as any);

      const userIntent =
        overrides?.userIntent || dtPendingConfirm.agentAudit?.userIntent || ('validate' as const);
      const maxAgents =
        overrides?.maxAgents || dtPendingConfirm.agentAudit?.maxAgents || (3 as const);

      try {
        const suggestRes = await Api.agentAuditSuggest({
          decisionContext,
          userIntent,
          language: chatLanguage,
          maxAgents,
        });
        const suggestedAgentsSet = (suggestRes as any)?.suggested || null;

        setDtPendingConfirm((prev) => {
          if (!prev?.agentAudit) return prev;
          const prevSelected = prev.agentAudit.selectedAgentIds || [];
          const nextSuggestedIds = Array.isArray(suggestedAgentsSet?.agents)
            ? suggestedAgentsSet.agents.map((a: any) => String(a?.agentId || '')).filter(Boolean)
            : prevSelected;

          // Preserve previous selections where possible; otherwise default to suggested list.
          const nextSelected =
            prevSelected.length > 0
              ? nextSuggestedIds.filter((id: string) => prevSelected.includes(id))
              : nextSuggestedIds;

          return {
            ...prev,
            agentAudit: {
              ...prev.agentAudit,
              suggested: suggestedAgentsSet || prev.agentAudit.suggested,
              orchestratorRunId: String(
                suggestedAgentsSet?.orchestratorRunId || prev.agentAudit.orchestratorRunId || ''
              ),
              selectedAgentIds: nextSelected.slice(0, maxAgents),
              userIntent,
              maxAgents,
              decisionContext,
            },
          };
        });
      } catch {
        // best-effort; DT can proceed without agent layer
      }
    },
    [dtPendingConfirm, chatLanguage]
  );

  const handleRunDirectedDeepening = useCallback(
    async (agentAuditPayload: any) => {
      const prompt = String(
        agentAuditPayload?.verdict?.directedLoop?.deepThinkingPrompt || ''
      ).trim();
      if (!prompt) return;
      if (isDisabled) return;

      const run = deepThinkingRunRef.current;
      if (!run) return;
      if (run.loopIteration >= 2) return;

      const nextIteration = ((run.loopIteration + 1) as 2) || 2;
      run.loopIteration = nextIteration;

      // Build backend-compatible history, excluding confirm cards
      const base = (customMessages || messages).filter(
        (m) => !((m as any).metadata?.deepThinking?.kind === 'confirm')
      );
      const history = base.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      // Legacy placeholder in global store
      addChatMessage({
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      });

      await startStream(
        prompt,
        history,
        systemPrompt,
        {
          deepThinkingConfirmed: true,
          deepThinkingConfirm: run.deepThinkingConfirm,
          deepThinkingDepth: 'hard',
          forceDepth: true,
          agentAudit: {
            agentIds: run.agentIds,
            userIntent: run.userIntent,
            loopIteration: nextIteration,
            decisionContext: run.decisionContext,
          },
        },
        focusMode,
        roleName,
        chatLanguage
      );
    },
    [
      addChatMessage,
      chatLanguage,
      customMessages,
      focusMode,
      isDisabled,
      messages,
      roleName,
      startStream,
      systemPrompt,
    ]
  );

  const handleNewChat = useCallback(async () => {
    clearActiveChat();
    // BUG 1a fix: also clear the legacy global chat store (useAppStore.activeChatMessages).
    // clearActiveChat() only resets the conversation store; without this, embedded views
    // rendering customMessages={activeChatMessages} leak the entire previous thread.
    try {
      useAppStore.getState().clearChat();
    } catch {
      /* non-critical */
    }
    try {
      const conv = await createConversation();
      setActiveConversation(conv.id);
    } catch (err) {
      console.error('[UnifiedChatPanel] Failed to create new chat:', err);
      toast.error(getTeresaStartFailureMessage(i18n.language));
    }
  }, [clearActiveChat, createConversation, i18n.language, setActiveConversation]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      setActiveConversation(id);
    },
    [setActiveConversation]
  );

  // Welcome "mode" tiles (composer audit #6): a tile is a real mode, not just a
  // prompt prefill. It atomically (1) applies the matching aiConfig preset
  // (marketResearch+webSearch / analyst style / consultant persona / deep
  // thinking) and (2) seeds the composer with the kickoff prompt. The user then
  // sends — so the freshly-applied flags are live on that send (config flows to
  // the send via React closures, which only refresh after this state update).
  const handleModeTile = useCallback(
    (preset: Record<string, unknown> | undefined, prompt: string) => {
      if (preset && Object.keys(preset).length > 0) {
        setAIConfig(preset as any);
      }
      try {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(
            'consultify.teresa.pendingPrompt',
            JSON.stringify({ prompt, ts: Date.now() })
          );
          window.dispatchEvent(new Event('consultify:teresa-pending-prompt'));
        }
      } catch {
        /* non-critical: prefill is best-effort */
      }
    },
    [setAIConfig]
  );

  const handleCopyMessage = useCallback(
    async (content: string, messageId: string) => {
      try {
        await navigator.clipboard.writeText(content);
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 2000);

        // Deep Thinking ops metric: "copied" as a reuse signal (best-effort)
        if (aiConfig?.deepResearch && activeConversationId) {
          Api.deepThinkingEvent({
            eventType: 'copied',
            sessionId: activeConversationId,
            conversationId: activeConversationId,
            payload: { messageId },
          }).catch(() => {
            /* ignore */
          });
        }
      } catch (err) {
        console.error('Failed to copy message:', err);
      }
    },
    [activeConversationId, aiConfig?.deepResearch]
  );

  const handleModeToggle = useCallback(() => {
    if (isSplitMode) {
      expandToFullScreen();
    } else {
      collapseToSplit();
    }
    onModeToggle?.();
  }, [isSplitMode, expandToFullScreen, collapseToSplit, onModeToggle]);

  const handleViewArtifacts = useCallback(
    (artifacts: Artifact[]) => {
      artifacts.forEach((artifact) => addArtifact(artifact));
      toggleArtifactsPanel(true);
    },
    [addArtifact, toggleArtifactsPanel]
  );

  // B2 (artifact lifecycle): ArtifactChip in the transcript → (re)open the
  // canvas split-view with the chat-generated deliverable mounted + mark it
  // as the conversation's active artifact (persisted).
  const handleOpenDeliverableArtifact = useCallback(
    (deliverable: {
      kind: 'deck' | 'doc' | 'sheet';
      generationId: string;
      title?: string;
      workbookId?: string;
      downloadUrl?: string;
    }) => {
      // B2 (Excel): realny .xlsx z silnika formuł nie ma draftu canvasa — otwieramy
      // wygenerowany skoroszyt bezpośrednio (wzorem Kimi ExceleView), zamiast
      // montować nieistniejący draft. Rozpoznanie po obecności workbookId.
      if (deliverable.workbookId) {
        const url = deliverable.downloadUrl || `/api/workbook/${deliverable.workbookId}/download`;
        window.open(url, '_blank');
        return;
      }
      // Sheet = GFM-table markdown draft → same draft mount as doc.
      if (deliverable.kind === 'doc' || deliverable.kind === 'sheet') {
        setRequestedCanvasDeckId(null);
        setRequestedCanvasDraftId(deliverable.generationId);
        setRequestedCanvasStarterId('document');
      } else {
        setRequestedCanvasDraftId(null);
        setRequestedCanvasDeckId(deliverable.generationId);
        setRequestedCanvasStarterId('presentation');
      }
      setIsWorkPanelOpen(true);
      const conversationId = useConversationStore.getState().activeConversationId;
      if (conversationId) {
        useArtifactsStore
          .getState()
          .setActiveArtifact(`deliverable-${deliverable.generationId}`, conversationId);
      }
    },
    []
  );

  // B4 (auto-emission) — lift a document-shaped chat answer into a fresh Canvas
  // draft and open it. No artifact existed yet (unlike handleOpenDeliverableArtifact),
  // so we create one from the message content, then mount it like a doc deliverable.
  const handleEmitArtifactFromMessage = useCallback(async (content: string, title: string) => {
    try {
      const token = window.localStorage.getItem('token') || '';
      const conversationId =
        useConversationStore.getState().activeConversationId || `canvas-${Date.now()}`;
      const response = await fetch('/api/work-canvas/drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          conversationId,
          kind: 'document',
          title: title || 'Dokument z czatu',
          content,
          contentMd: content,
          canonicalFormat: 'markdown',
          provenance: { source: 'chat-auto-emit' },
        }),
      });
      if (!response.ok) throw new Error(`draft create failed: ${response.status}`);
      const json = await response.json();
      const draftId = json?.data?.draft?.id || json?.draft?.id || json?.data?.id;
      if (!draftId) throw new Error('draft id missing in response');
      setRequestedCanvasDeckId(null);
      setRequestedCanvasDraftId(draftId);
      setRequestedCanvasStarterId('document');
      setIsWorkPanelOpen(true);
    } catch (err) {
      console.error('[UnifiedChatPanel] auto-emit to document failed:', err);
    }
  }, []);

  // Deep Thinking: Save output as Decision
  const handleSaveAsDecision = useCallback(
    async (messageId: string, content: string) => {
      if (!activeConversationId) return;
      setDtSavingDecision(messageId);
      try {
        await Api.saveDeepThinkingDecision({
          sessionId: activeConversationId,
          conversationId: activeConversationId,
          content,
        });
        setDtDecisionSaved((prev) => new Set(prev).add(messageId));
      } catch (err) {
        console.error('[UnifiedChatPanel] Failed to save decision:', err);
      } finally {
        setDtSavingDecision(null);
      }
    },
    [activeConversationId]
  );

  // T009: Save message output as My Idea (private)
  const handleSaveAsIdea = useCallback(
    async (messageId: string, content: string) => {
      await saveMessageAsIdea(messageId, content, { navigateToMyWork: true, autoTriggered: false });
    },
    [saveMessageAsIdea]
  );

  // T011: Save message output as Notebook page (private)
  const handleSaveAsNote = useCallback(
    async (messageId: string, content: string) => {
      await saveMessageAsNote(messageId, content, { navigateToMyWork: true, autoTriggered: false });
    },
    [saveMessageAsNote]
  );

  const handleSaveToContext = useCallback(
    async (messageId: string, _content: string, _role: 'user' | 'ai') => {
      if (!activeConversationId) return;
      setContextSaveBusyMessageId(messageId);
      try {
        const response = await Api.saveConversationMessageToContext(
          activeConversationId,
          messageId
        );
        setContextSavedMessageIds((prev) => {
          const next = new Set(prev);
          next.add(messageId);
          return next;
        });
        toast.success(
          response?.alreadyCaptured
            ? t('chat.context.alreadySaved', 'Message is already in Context OS')
            : t('chat.context.saved', 'Saved to Context OS')
        );
      } catch (err) {
        console.error('[UnifiedChatPanel] Failed to save message to context:', err);
        toast.error(t('chat.context.saveFailed', 'Failed to save to Context OS'));
      } finally {
        setContextSaveBusyMessageId(null);
      }
    },
    [activeConversationId, t]
  );

  // Deep Thinking: Enable DT mode from hint banner
  const handleEnableDeepThinking = useCallback(() => {
    setDtHintDismissed(true);
    // Toggle Deep Thinking in aiConfig
    const { setAIConfig } = useAppStore.getState();
    if (typeof setAIConfig === 'function') {
      setAIConfig({ ...aiConfig, deepResearch: true } as any);
    }
  }, [aiConfig]);

  /**
   * Handle feedback submission for AI responses
   * Integrated with FeedbackService for learning system
   */
  const handleFeedback = useCallback(
    async (messageId: string, messageContent: string, feedback: ResponseFeedback) => {
      try {
        // Find the user message that triggered this AI response
        const messageIndex = displayMessages.findIndex((m) => m.id === messageId);
        const userMessage = messageIndex > 0 ? displayMessages[messageIndex - 1]?.content : '';

        // Send detailed feedback to v2.0 adaptive system
        await Api.aiFeedback({
          messageId,
          conversationId: activeConversationId || undefined,
          rating: feedback.rating,
          lengthFeedback: feedback.lengthFeedback,
          detailFeedback: feedback.detailFeedback,
          wantedMode: feedback.wantedMode,
          customFeedback: feedback.customFeedback,
          screenContext: workspaceContext?.type,
          focusMode: focusMode,
          responseMode: focusMode, // Map focusMode to responseMode for learning
          capability: workspaceContext?.type || 'chat',
        });

        console.log('[UnifiedChatPanel] Detailed feedback submitted via Api.aiFeedback:', {
          messageId,
          conversationId: activeConversationId,
          rating: feedback.rating,
          hasDetailedFeedback: !!(
            feedback.lengthFeedback ||
            feedback.detailFeedback ||
            feedback.wantedMode
          ),
        });
      } catch (err) {
        console.error('[UnifiedChatPanel] Failed to submit specific feedback:', err);
      }
    },
    [displayMessages, workspaceContext, activeConversationId]
  );

  const handleMultiSelectToggle = (value: string) => {
    setSelectedMultiOptions((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleMultiSelectConfirm = () => {
    if (selectedMultiOptions.length > 0) {
      if (onMultiSelectSubmit) {
        onMultiSelectSubmit(selectedMultiOptions);
      } else if (onOptionSelect) {
        onOptionSelect({
          id: 'multi-confirm',
          label: t('chat.confirmSelection', 'Confirm Selection'),
          value: selectedMultiOptions.join(', '),
        });
      }
      setSelectedMultiOptions([]);
    }
  };

  // ========================================================================
  // Inline edit & regenerate (ChatGPT-like)
  // ========================================================================

  const handleStartEditMessage = useCallback(
    (messageId: string) => {
      const msg = displayMessages.find((m) => m.id === messageId);
      if (!msg || msg.role !== 'user') return;
      if (String(msg.id || '').startsWith('local-')) return;
      setEditingMessageId(messageId);
      setEditingText(msg.content || '');
    },
    [displayMessages]
  );

  const handleCancelEditMessage = useCallback(() => {
    setEditingMessageId(null);
    setEditingText('');
  }, []);

  // Branch/Fork (composer #4): copy this conversation up to a given message into
  // a fresh conversation and switch to it — explore a "what-if" without losing
  // the original thread (ChatGPT "Branch in new chat" / Claude edit-branch).
  const handleBranchFromMessage = useCallback(
    async (messageId: string) => {
      const sourceId = useConversationStore.getState().activeConversationId;
      if (!sourceId || !messageId || String(messageId).startsWith('local-')) {
        toast.error(t('aiChat.branch.unavailable', 'Send the message first, then branch.'));
        return;
      }
      const tid = toast.loading(t('aiChat.branch.working', 'Creating a branch…'));
      try {
        const res: any = await Api.branchConversation(sourceId, messageId);
        const newId = res?.conversation?.id;
        if (!newId) throw new Error('No conversation id returned');
        const store = useConversationStore.getState();
        await store.fetchConversations?.();
        await store.setActiveConversation(newId);
        toast.success(t('aiChat.branch.done', 'Branched into a new conversation'), { id: tid });
      } catch (err) {
        console.error('[UnifiedChatPanel] Branch failed:', err);
        toast.error(t('aiChat.branch.failed', 'Could not create a branch.'), { id: tid });
      }
    },
    [t]
  );

  // ------------------------------------------------------------------------
  // M01-P03A — BranchSelector wiring (finding M01-035: the component was
  // fully orphaned, imported nowhere). Lists branches forked FROM the active
  // conversation (GET /:id/branches) so the user can see and switch between
  // them, and — if the active conversation is itself a branch — offers a way
  // back to its parent. See src/components/AIChat/BranchSelector.tsx for the
  // real backend contract this maps onto.
  // ------------------------------------------------------------------------
  const [branchList, setBranchList] = useState<ConversationBranch[]>([]);
  const [branchParentConversationId, setBranchParentConversationId] = useState<string | null>(
    null
  );
  const [branchSelfName, setBranchSelfName] = useState<string | null>(null);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [branchCreating, setBranchCreating] = useState(false);

  const refreshBranches = useCallback(async (conversationId: string) => {
    setBranchesLoading(true);
    setBranchesError(null);
    try {
      const res: any = await Api.getConversationBranches(conversationId);
      const mapped: ConversationBranch[] = Array.isArray(res?.branches)
        ? res.branches.map((b: any) => ({
            id: b.id,
            conversationId: b.conversationId,
            parentBranchId: b.parentBranchId ?? null,
            forkMessageId: b.forkMessageId,
            name: b.branchName || 'Branch',
            messageCount: b.messageCount,
            createdAt: b.createdAt,
            createdBy: b.createdBy,
          }))
        : [];
      setBranchList(mapped);
      setBranchParentConversationId(res?.isBranch ? res?.parentConversationId || null : null);
      setBranchSelfName(res?.isBranch ? res?.branchName || null : null);
    } catch (err) {
      console.error('[UnifiedChatPanel] Failed to load conversation branches:', err);
      setBranchList([]);
      setBranchParentConversationId(null);
      setBranchSelfName(null);
      setBranchesError(t('branch.loadFailed', 'Could not load branches.'));
    } finally {
      setBranchesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!activeConversationId || String(activeConversationId).startsWith('local-')) {
      setBranchList([]);
      setBranchParentConversationId(null);
      setBranchSelfName(null);
      setBranchesError(null);
      return;
    }
    void refreshBranches(activeConversationId);
    // `refreshBranches` intentionally excluded: it's a `useCallback` keyed on
    // `[t]`, and this codebase's test-time `useTranslation()` mock
    // (tests/setup.ts) returns a brand-new `t` function on every call (real
    // react-i18next memoizes it; the test double does not) — including it
    // here turned this into an infinite effect->setState->render->new-t->
    // effect loop that OOM'd the component test suite (found by actually
    // running it, not assumed). Only `activeConversationId` should ever
    // trigger a refetch; `refreshBranches` is still always the current
    // render's closure when this effect DOES run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  const handleSelectBranch = useCallback(
    async (branchId: string) => {
      try {
        await useConversationStore.getState().setActiveConversation(branchId);
      } catch (err) {
        console.error('[UnifiedChatPanel] Failed to switch branch:', err);
        toast.error(t('branch.switchFailed', 'Could not switch to that branch.'));
      }
    },
    [t]
  );

  const handleCreateBranchFromSelector = useCallback(
    async (name: string) => {
      const sourceId = useConversationStore.getState().activeConversationId;
      if (!sourceId) return;
      // No explicit fork point from the dropdown's simple form — branch from
      // the latest message in the thread so far (server falls back to "no
      // messages" only when the source conversation is truly empty).
      const msgs = useConversationStore.getState().activeMessages || [];
      const lastRealMsg = [...msgs].reverse().find((m: any) => !String(m.id || '').startsWith('local-'));
      setBranchCreating(true);
      try {
        const res: any = await Api.branchConversation(sourceId, lastRealMsg?.id, name);
        const newId = res?.conversation?.id;
        if (!newId) throw new Error('No conversation id returned');
        await refreshBranches(sourceId);
        toast.success(t('aiChat.branch.done', 'Branched into a new conversation'));
      } catch (err) {
        console.error('[UnifiedChatPanel] Create branch failed:', err);
        setBranchesError(t('branch.createFailed', 'Could not create branch.'));
        toast.error(t('aiChat.branch.failed', 'Could not create a branch.'));
      } finally {
        setBranchCreating(false);
      }
    },
    [refreshBranches, t]
  );

  const handleRenameBranch = useCallback(
    async (branchId: string, newName: string) => {
      try {
        await Api.updateConversation(branchId, { title: newName });
        const sourceId = useConversationStore.getState().activeConversationId;
        if (sourceId) await refreshBranches(sourceId);
        await useConversationStore.getState().fetchConversations?.();
      } catch (err) {
        console.error('[UnifiedChatPanel] Rename branch failed:', err);
        toast.error(t('branch.renameFailed', 'Could not rename branch.'));
      }
    },
    [refreshBranches, t]
  );

  const handleDeleteBranch = useCallback(
    async (branchId: string) => {
      try {
        await Api.deleteConversation(branchId);
        // `branchId` is always one of the active conversation's own children
        // here (BranchSelector only offers delete on rows from `branches`,
        // which is always the children list — see refreshBranches) so the
        // active conversation itself never changes; just re-list.
        const sourceId = useConversationStore.getState().activeConversationId;
        if (sourceId) await refreshBranches(sourceId);
        await useConversationStore.getState().fetchConversations?.();
      } catch (err) {
        console.error('[UnifiedChatPanel] Delete branch failed:', err);
        toast.error(t('branch.deleteFailed', 'Could not delete branch.'));
      }
    },
    [refreshBranches, t]
  );

  const handleCommitEditMessage = useCallback(async () => {
    if (!editingMessageId) return;
    const newText = editingText.trim();
    if (!newText) return;
    if (!activeConversationId) return;
    if (editBusy || isStreaming) return;

    setEditBusy(true);
    try {
      await truncateFromMessage(editingMessageId, newText);

      const msgs = useConversationStore.getState().activeMessages || [];
      const idx = msgs.findIndex((m: any) => m.id === editingMessageId);
      const before = idx >= 0 ? msgs.slice(0, idx) : msgs;
      const history = before
        .filter((m: any) => m?.content && String(m.content).trim().length > 0)
        .map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: String(m.content || '') }],
        }));

      const context = {
        focusMode,
        attachments: [],
        workspaceContext,
        // v3 context-awareness: pass project + screen context in the shape expected by backend
        projectId: workspaceContext?.projectId || null,
        screenContext: {
          screenId: workspaceContext?.view || workspaceContext?.type || null,
          currentScreen: workspaceContext?.type || null,
          selectedObjectId: workspaceContext?.entityId || null,
          selectedObjectType: workspaceContext?.type || null,
          route: routeInfo,
          page: (workspaceContext as any)?.entityData || null,
        },
        conversationId: activeConversationId,
        conversationLanguage: chatLanguage,
        virtualWorkerSlug: 'teresa',
      };

      if (aiConfig?.deepResearch) {
        if (dtConfirmBusy) return;
        setDtConfirmBusy(true);
        try {
          const confirmRes = await Api.chatConfirm(
            newText,
            history,
            systemPrompt,
            context,
            roleName,
            chatLanguage,
            {
              deepResearch: aiConfig?.deepResearch,
              webSearch: aiConfig?.webSearch,
              showReasoning: aiConfig?.showReasoning,
              multiAgent: (aiConfig as any)?.multiAgent,
              marketResearch: (aiConfig as any)?.marketResearch,
              coThinkerMode: (aiConfig as any)?.coThinkerMode ?? null,
              privateMode: (aiConfig as any)?.privateMode ?? false,
              knowledgeSources: aiConfig?.knowledgeSources,
              responseStyle: aiConfig?.responseStyle,
              customInstructions: (aiConfig as any)?.customInstructions ?? undefined,
              selectedTier: (aiConfig as any)?.selectedTier || undefined,
              selectedModelId: (aiConfig as any)?.selectedModelId ?? null,
            } as any
          );

          const c = (confirmRes as any)?.confirm || {};
          const u = c?.understanding || {};
          const md = [
            '**My understanding of your task**',
            `- Goal: ${u.goal || ''}`,
            u.context ? `- Context: ${u.context}` : '',
            Array.isArray(u.constraints) && u.constraints.length
              ? `- Constraints: ${u.constraints.join('; ')}`
              : '',
            u.expectedOutput ? `- Output: ${u.expectedOutput}` : '',
            u.decisionHorizon ? `- Horizon: ${u.decisionHorizon}` : '',
            '',
            Array.isArray(c.missingInfoQuestions) && c.missingInfoQuestions.length
              ? `**Assumptions & gaps (optional):**\n${c.missingInfoQuestions
                  .slice(0, 3)
                  .map((q: any, i: number) => `${i + 1}. ${q.question}`)
                  .join('\n')}`
              : '',
            '',
            '_Confirm to start Deep Thinking. Adjust if the task needs correction._',
          ]
            .filter(Boolean)
            .join('\n');

          const saved = await addMessageToConversation({
            conversationId: activeConversationId,
            role: 'ai',
            content: md,
            messageType: 'text',
            metadata: {
              deepThinking: { kind: 'confirm', originalMessage: newText },
              deepThinkingConfirm: c,
            } as any,
          });
          const confirmMessageId = (saved as any)?.id || `dt-confirm-${Date.now()}`;

          setDtPendingConfirm({
            messageId: confirmMessageId,
            conversationId: activeConversationId,
            originalMessage: newText,
            editedMessage: newText,
            confirm: c,
            context,
            attachments: [],
          } as any);
        } finally {
          setDtConfirmBusy(false);
        }
      } else {
        await startStream(
          newText,
          history,
          systemPrompt,
          context,
          focusMode,
          roleName,
          chatLanguage
        );
      }

      handleCancelEditMessage();
    } catch (e) {
      console.error('[UnifiedChatPanel] Edit & regenerate failed:', e);
    } finally {
      setEditBusy(false);
    }
  }, [
    activeConversationId,
    addMessageToConversation,
    aiConfig,
    chatLanguage,
    dtConfirmBusy,
    editBusy,
    editingMessageId,
    editingText,
    focusMode,
    handleCancelEditMessage,
    isStreaming,
    roleName,
    startStream,
    systemPrompt,
    truncateFromMessage,
    workspaceContext,
  ]);

  // ========================================================================
  // Agent Audit: Accept risk handler (extracted for MessageRenderer)
  // ========================================================================

  const handleAgentAuditAccept = useCallback(
    async (audit: any, _msgId: string) => {
      if (agentAuditBusy) return;
      const runId = String(audit?.orchestratorRunId || '').trim();
      if (!runId) return;
      setAgentAuditBusy(true);
      try {
        await Api.agentAuditAcceptRun({ runId });
        const content = [
          '**Agent Audit — risk accepted**',
          `- Run: \`${runId}\``,
          '- Decision: user accepted proceeding despite FAIL.',
        ].join('\n');
        if (activeConversationId) {
          await addMessageToConversation({
            conversationId: activeConversationId,
            role: 'ai',
            content,
            messageType: 'text',
            metadata: {
              agentAudit: { kind: 'accept', runId },
            } as any,
          });
        }
        addChatMessage({
          id: `agent-audit-accept-${Date.now()}`,
          role: 'ai',
          content,
          timestamp: new Date(),
          metadata: { agentAudit: { kind: 'accept', runId } },
        } as any);
      } catch (err) {
        console.error('[UnifiedChatPanel] Failed to accept audit run:', err);
      } finally {
        setAgentAuditBusy(false);
      }
    },
    [activeConversationId, addChatMessage, addMessageToConversation, agentAuditBusy]
  );

  // ========================================================================
  // V8 governed proposal handlers (CHAT_V8_ACTIONS_AND_APPROVALS)
  // ========================================================================

  const [proposalBusyById, setProposalBusyById] = useState<
    Record<string, { approve?: boolean; reject?: boolean; execute?: boolean }>
  >({});

  const handleProposalApprove = useCallback(
    async (proposalId: string, msg: ChatMessage) => {
      if (!proposalId) return;
      setProposalBusyById((prev) => ({
        ...prev,
        [proposalId]: { ...(prev[proposalId] || {}), approve: true },
      }));
      try {
        const result: any = await Api.approveAIAction(
          proposalId,
          activeConversationId || undefined
        );
        if (result?.success !== false) {
          useProposalLifecycleStore.getState().patchLifecycle(proposalId, {
            lifecycleState: 'approved',
            actionType: (msg as any)?.metadata?.executionProposal?.actionType,
            latestMessageType: 'execution_progress',
          });
          // Optimistic local echo so the thread reflects the new lifecycle state
          // immediately — backend already persisted the execution_progress row.
          addChatMessage({
            id: `exec-progress-${proposalId}-${Date.now()}`,
            role: 'ai',
            content: 'Proposal approved — ready to execute.',
            timestamp: new Date(),
            type: 'execution_progress',
            metadata: {
              executionProposal: {
                proposalId,
                lifecycleState: 'approved',
                actionType: (msg as any)?.metadata?.executionProposal?.actionType,
              },
            },
          } as any);
        }
      } catch (err) {
        console.error('[UnifiedChatPanel] Proposal approve failed:', err);
      } finally {
        setProposalBusyById((prev) => {
          const next = { ...prev };
          const entry = { ...(next[proposalId] || {}) };
          delete entry.approve;
          if (Object.keys(entry).length === 0) delete next[proposalId];
          else next[proposalId] = entry;
          return next;
        });
      }
    },
    [activeConversationId, addChatMessage]
  );

  const handleProposalReject = useCallback(
    async (proposalId: string, msg: ChatMessage, reason?: string) => {
      if (!proposalId) return;
      setProposalBusyById((prev) => ({
        ...prev,
        [proposalId]: { ...(prev[proposalId] || {}), reject: true },
      }));
      try {
        const result: any = await Api.rejectAIAction(
          proposalId,
          reason,
          activeConversationId || undefined
        );
        if (result?.success !== false) {
          useProposalLifecycleStore.getState().patchLifecycle(proposalId, {
            lifecycleState: 'rejected',
            actionType: (msg as any)?.metadata?.executionProposal?.actionType,
            rejectionReason: reason || null,
            latestMessageType: 'execution_result',
          });
          addChatMessage({
            id: `exec-result-${proposalId}-${Date.now()}`,
            role: 'ai',
            content: reason ? `Proposal rejected — ${reason}` : 'Proposal rejected.',
            timestamp: new Date(),
            type: 'execution_result',
            metadata: {
              executionProposal: {
                proposalId,
                lifecycleState: 'rejected',
                actionType: (msg as any)?.metadata?.executionProposal?.actionType,
                rejectionReason: reason || null,
              },
            },
          } as any);
        }
      } catch (err) {
        console.error('[UnifiedChatPanel] Proposal reject failed:', err);
      } finally {
        setProposalBusyById((prev) => {
          const next = { ...prev };
          const entry = { ...(next[proposalId] || {}) };
          delete entry.reject;
          if (Object.keys(entry).length === 0) delete next[proposalId];
          else next[proposalId] = entry;
          return next;
        });
      }
    },
    [activeConversationId, addChatMessage]
  );

  const handleProposalExecute = useCallback(
    async (proposalId: string, msg: ChatMessage) => {
      if (!proposalId) return;
      setProposalBusyById((prev) => ({
        ...prev,
        [proposalId]: { ...(prev[proposalId] || {}), execute: true },
      }));
      try {
        const result: any = await Api.executeAIAction(
          proposalId,
          {},
          activeConversationId || undefined
        );
        const actionType = (msg as any)?.metadata?.executionProposal?.actionType;
        if (result?.success !== false) {
          useProposalLifecycleStore.getState().patchLifecycle(proposalId, {
            lifecycleState: result?.lifecycleState === 'audited' ? 'audited' : 'executed',
            actionType,
            latestMessageType: 'execution_result',
          });
          addChatMessage({
            id: `exec-result-${proposalId}-${Date.now()}`,
            role: 'ai',
            content: 'Proposal executed successfully.',
            timestamp: new Date(),
            type: 'execution_result',
            metadata: {
              executionProposal: {
                proposalId,
                runId: result?.runId,
                lifecycleState: result?.lifecycleState === 'audited' ? 'audited' : 'executed',
                actionType,
                result: result?.result,
              },
            },
          } as any);
        } else {
          useProposalLifecycleStore.getState().patchLifecycle(proposalId, {
            lifecycleState: 'failed',
            actionType,
            latestMessageType: 'execution_result',
          });
          addChatMessage({
            id: `exec-failed-${proposalId}-${Date.now()}`,
            role: 'ai',
            content: `Proposal execution failed — ${result?.error || 'Unknown error'}`,
            timestamp: new Date(),
            type: 'execution_result',
            metadata: {
              executionProposal: {
                proposalId,
                runId: result?.runId,
                lifecycleState: 'failed',
                actionType,
              },
            },
          } as any);
        }
      } catch (err) {
        console.error('[UnifiedChatPanel] Proposal execute failed:', err);
      } finally {
        setProposalBusyById((prev) => {
          const next = { ...prev };
          const entry = { ...(next[proposalId] || {}) };
          delete entry.execute;
          if (Object.keys(entry).length === 0) delete next[proposalId];
          else next[proposalId] = entry;
          return next;
        });
      }
    },
    [activeConversationId, addChatMessage]
  );

  const handleProposalInspect = useCallback(
    (proposalId: string) => {
      navigateToRoute(`/ai/action-center?actionId=${encodeURIComponent(proposalId)}`);
    },
    [navigateToRoute]
  );

  // ========================================================================
  // Render helpers
  // ========================================================================

  // Anchor wrapper for deep links (M01-P02 history search "jump to message").
  // Kept here rather than inside MessageRenderer (owned by a different
  // packet) so the anchor id is added without touching that file: a single
  // extra, unstyled wrapper div per message, invisible to layout.
  const renderMessage = (msg: ChatMessage, index: number) => (
    <div key={msg.id} data-message-anchor={msg.id}>
      <MessageRenderer
        msg={msg}
        index={index}
        displayMessages={displayMessages}
        isCompact={isCompact}
        isDisabled={isDisabled}
        activeConversationId={activeConversationId}
        thinkingSteps={thinkingSteps}
        streamStartedAt={streamStartedAt}
        streamCompletedSignal={streamCompletedSignal}
        retryInfo={retryInfo}
        abortFeedback={abortFeedback}
        agentAuditState={agentAuditState}
        agentAuditBusy={agentAuditBusy}
        agentRegistryById={agentRegistryById}
        agentReviewProgressByAgentId={agentReviewProgressByAgentId}
        agentSourcesByAgentId={agentSourcesByAgentId}
        agentAuditActiveTabByMessageId={agentAuditActiveTabByMessageId}
        setAgentAuditActiveTabByMessageId={setAgentAuditActiveTabByMessageId}
        deepThinkingHint={deepThinkingHint}
        dtHintDismissed={dtHintDismissed}
        dtPendingConfirm={dtPendingConfirm}
        setDtPendingConfirm={setDtPendingConfirm}
        dtConfirmBusy={dtConfirmBusy}
        dtSavingDecision={dtSavingDecision}
        dtDecisionSaved={dtDecisionSaved}
        interimInsight={interimInsight}
        aiConfig={aiConfig}
        editingMessageId={editingMessageId}
        editingText={editingText}
        editBusy={editBusy}
        setEditingText={setEditingText}
        hoveredMessageId={hoveredMessageId}
        setHoveredMessageId={setHoveredMessageId}
        copiedMessageId={copiedMessageId}
        contextSaveBusyMessageId={contextSaveBusyMessageId}
        contextSavedMessageIds={contextSavedMessageIds}
        selectedMultiOptions={selectedMultiOptions}
        voiceState={voiceState}
        handleCopyMessage={handleCopyMessage}
        handleStartEditMessage={handleStartEditMessage}
        handleBranchFromMessage={handleBranchFromMessage}
        handleCancelEditMessage={handleCancelEditMessage}
        handleCommitEditMessage={handleCommitEditMessage}
        handleViewArtifacts={handleViewArtifacts}
        onOpenDeliverableArtifact={handleOpenDeliverableArtifact}
        onEmitArtifactFromMessage={handleEmitArtifactFromMessage}
        handleFeedback={handleFeedback}
        handleSendMessage={handleSendMessage}
        handleEnableDeepThinking={handleEnableDeepThinking}
        handleDeepThinkingProceed={handleDeepThinkingProceed}
        handleDeepThinkingReconfirm={handleDeepThinkingReconfirm}
        handleSaveAsDecision={handleSaveAsDecision}
        handleSaveAsIdea={handleSaveAsIdea}
        handleSaveAsNote={handleSaveAsNote}
        handleSaveToContext={handleSaveToContext}
        handleRunDirectedDeepening={handleRunDirectedDeepening}
        handleMultiSelectToggle={handleMultiSelectToggle}
        handleMultiSelectConfirm={handleMultiSelectConfirm}
        refreshAgentAuditSuggestionsOnly={refreshAgentAuditSuggestionsOnly}
        speak={speak}
        stopSpeaking={stopSpeaking}
        setDtHintDismissed={setDtHintDismissed}
        addArtifact={addArtifact}
        toggleArtifactsPanel={toggleArtifactsPanel}
        exportArtifact={exportArtifact}
        handleAgentAuditAccept={handleAgentAuditAccept}
        onOptionSelect={onOptionSelect}
        isRtlChatLanguage={isRtlChatLanguage}
        onProposalApprove={handleProposalApprove}
        onProposalReject={handleProposalReject}
        onProposalExecute={handleProposalExecute}
        onProposalInspect={handleProposalInspect}
        proposalBusyById={proposalBusyById}
        teresaPendingConfirm={teresaPendingConfirm}
        teresaConfirmBusy={teresaConfirmBusy}
        onTeresaConfirmProceed={handleTeresaConfirmProceed}
        onTeresaConfirmCancel={handleTeresaConfirmCancel}
      />
    </div>
  );

  // ========================================================================
  // Render
  // ========================================================================
  const hasRenderableMessages = displayMessages.some((message) => {
    const metadata = (message as any)?.metadata || {};
    return (
      Boolean((message as any)?.isStreaming) ||
      String((message as any)?.content || '').trim().length > 0 ||
      Boolean(metadata.proposal || metadata.executionProposal || metadata.deepThinking)
    );
  });
  const isRehydratingConversation =
    !hasRenderableMessages && activeConversationId && isConversationLoading;
  const isWelcomeEmptyState = !hasRenderableMessages && !isRehydratingConversation;

  // Latest completed AI reply — fed to TeresaTTSPlayer for "talking Teresa" read-aloud.
  const latestAiMessageText = useMemo(() => {
    if (isStreaming) return '';
    for (let i = displayMessages.length - 1; i >= 0; i -= 1) {
      const m = displayMessages[i] as any;
      if (m?.role === 'ai' && !m?.isStreaming) {
        const content = String(m?.content || '').trim();
        if (content) return content;
      }
    }
    return '';
  }, [displayMessages, isStreaming]);

  const canUseWorkPanel = mode === 'full';
  const showWorkPanel = isWorkPanelMode;

  // Deep-link support: open the Work Canvas split panel from canonical /chat.
  // Used by `/ai/work-canvas` redirect and external links.
  useEffect(() => {
    if (mode !== 'full') return;
    const params = new URLSearchParams(location.search);
    const shouldOpen =
      params.get('workPanel') === '1' ||
      params.get('workPanel') === 'true' ||
      params.get('workCanvas') === '1';
    if (!shouldOpen) return;

    setIsWorkPanelOpen(true);

    const draftId = String(params.get('canvasDraftId') || params.get('draftId') || '').trim();
    if (draftId) setRequestedCanvasDraftId(draftId);

    // Consume params to avoid re-triggering on subsequent renders/navigation.
    const consumedKeys = [
      'workPanel',
      'workCanvas',
      'canvasDraftId',
      'draftId',
      'canvasKind',
      'kind',
    ];
    let changed = false;
    for (const key of consumedKeys) {
      if (params.has(key)) {
        params.delete(key);
        changed = true;
      }
    }
    if (changed) {
      const nextSearch = params.toString();
      navigateToRoute(
        { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
        { replace: true }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, mode, navigateToRoute]);

  // Deep-link support: jump to one message (`?m=`), used when opening a
  // history search hit (M01-P02, GF-CHAT-05) so the user lands on the
  // message that matched, not the top of a long conversation. Waits for the
  // message to actually be present in `displayMessages` before consuming the
  // param, so a slow conversation fetch does not silently drop the jump.
  //
  // M01-030 (severity P3, carried from P02 into P01): explicit semantics for
  // `?m=` vs. hard reload. This effect CONSUMES the param via
  // `navigateToRoute(..., {replace:true})` once the jump has happened, so
  // `?m=` is a ONE-SHOT deep link, not a persistent view state:
  //   - a hard reload / fresh tab open BEFORE the jump has consumed the
  //     param (e.g. the URL bar still shows `?m=<id>` because the message
  //     list was still loading) DOES replay the jump — the effect re-runs
  //     from scratch on the fresh mount and finds `?m=` still present;
  //   - a hard reload / fresh reopen AFTER the jump already consumed the
  //     param (the URL no longer contains `?m=`, exactly like clicking any
  //     other link and then reloading) does NOT re-jump or re-highlight —
  //     there is nothing left in the URL to jump to. This matches ordinary
  //     browser semantics for a one-time query param (compare: a "scroll to
  //     anchor" link consumed by `history.replaceState`) and is NOT a bug —
  //     but the GF-CHAT-05 claim "deep link survives hard reload" must be
  //     read as "survives a reload of the still-pending deep link", not "the
  //     jump target is a durable, reload-proof URL forever." See
  //     tests/components/AIChat/UnifiedChatPanel.test.tsx ("M01-030" cases)
  //     for both cases exercised directly.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetId = String(params.get('m') || '').trim();
    if (!targetId || jumpedMessageRef.current === targetId) return;
    if (!displayMessages.some((m) => (m as any)?.id === targetId)) return;

    const selectorId =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(targetId)
        : targetId;
    const el = document.querySelector(`[data-message-anchor="${selectorId}"]`);
    if (!el) return;

    jumpedMessageRef.current = targetId;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const HIGHLIGHT = ['ring-2', 'ring-c-focus', 'rounded-lg'];
    el.classList.add(...HIGHLIGHT);
    const timer = setTimeout(() => el.classList.remove(...HIGHLIGHT), 2400);

    // Consume `m` so a later re-render / navigation does not re-trigger the
    // jump and does not leave a stale message id sitting in the URL.
    params.delete('m');
    const nextSearch = params.toString();
    navigateToRoute(
      { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
      { replace: true }
    );

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, displayMessages, navigateToRoute]);

  // Full `/chat` must always use the rich start screen, regardless of persisted displayMode.
  // Once the work panel is open, the left side behaves like an active conversation panel:
  // no marketing welcome surface, input stays pinned at the bottom.
  const showFullWelcomeEmptyState = isWelcomeEmptyState && mode === 'full' && !isCompact;
  const showWorkPanelEmptyState = isWelcomeEmptyState && showWorkPanel;
  const showCompactEmptyState = isWelcomeEmptyState && mode !== 'full';
  const rootStyle = {
    maxHeight: maxHeight || '100%',
    ...(showWorkPanel ? { '--work-canvas-width': `${workCanvasWidthPercent}%` } : {}),
  } as React.CSSProperties;

  const setPersistedWorkCanvasWidth = useCallback((nextWidth: number) => {
    const clamped = clampWorkCanvasWidth(nextWidth);
    setWorkCanvasWidthPercent(clamped);
    window.localStorage.setItem(WORK_CANVAS_SPLIT_STORAGE_KEY, String(clamped));
  }, []);

  const updateWorkCanvasWidthFromClientX = useCallback(
    (clientX: number) => {
      const rect = splitShellRef.current?.getBoundingClientRect();
      if (!rect?.width) return;
      // D17: artefakt (canvas) po LEWEJ, Teresa po PRAWEJ → divider = prawa krawędź canvasu,
      // więc szerokość canvasu = odległość dividera od lewej krawędzi shella.
      const canvasPercent = ((clientX - rect.left) / rect.width) * 100;
      setPersistedWorkCanvasWidth(canvasPercent);
    },
    [setPersistedWorkCanvasWidth]
  );

  const handleWorkCanvasEdgeMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      updateWorkCanvasWidthFromClientX(event.clientX);

      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        updateWorkCanvasWidthFromClientX(moveEvent.clientX);
      };
      const handleMouseUp = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [updateWorkCanvasWidthFromClientX]
  );

  const handleWorkCanvasEdgeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // D17: canvas po LEWEJ → divider na jego prawej krawędzi.
      // ArrowRight rozsuwa divider w prawo = szerszy canvas; ArrowLeft = węższy.
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setPersistedWorkCanvasWidth(workCanvasWidthPercent - 2);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setPersistedWorkCanvasWidth(workCanvasWidthPercent + 2);
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setPersistedWorkCanvasWidth(MIN_WORK_CANVAS_WIDTH_PERCENT);
      }
      if (event.key === 'End') {
        event.preventDefault();
        setPersistedWorkCanvasWidth(MAX_WORK_CANVAS_WIDTH_PERCENT);
      }
    },
    [setPersistedWorkCanvasWidth, workCanvasWidthPercent]
  );

  return (
    <div
      ref={splitShellRef}
      className={`relative flex h-full overflow-hidden bg-c-bg ${
        isPrivateMode ? 'ring-1 ring-c-accent/30' : 'ring-1 ring-transparent'
      } ${className}`}
      style={rootStyle}
    >
      <div
        className={`group/composer flex min-w-0 flex-col h-full transition-[width] duration-200 lg:order-2 ${
          showWorkPanel ? 'w-full lg:w-[calc(100%_-_var(--work-canvas-width))]' : 'w-full'
        }`}
      >
        {/* Skip links for keyboard users */}
        <a
          href="#chat-input"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-overlay focus:bg-c-text focus:text-c-bg focus:px-4 focus:py-2 focus:rounded-lg"
        >
          {t('wcag.skipToInput', 'Skip to chat input')}
        </a>

        {/* Header — Tech Sexy (T104/T105) */}
        {/* M01-P03A: `relative z-10` — this row and the messages list below it
            are both position:static siblings, so without an explicit z-index
            here the header (earlier in DOM) loses to the messages list
            (later in DOM, same implicit stacking level) regardless of any
            z-index set on a descendant like BranchSelector's dropdown — a
            positioned descendant can't "escape" above a later sibling of its
            OWN ancestor's stacking level. Found by actually opening the
            branch dropdown in the browser: its lower rows painted correctly,
            but the upper portion was silently painted UNDER the message
            bubble text (confirmed via elementsFromPoint, not assumed from
            code reading — bumping the dropdown's own z-index to 9999 did
            NOT fix it, proving the escape was the real cause). */}
        <div
          className={`relative z-10 flex h-[42px] items-center justify-between ${isCompact ? 'px-3' : 'px-4'} border-b border-c-border-subtle bg-c-surface/50 backdrop-blur-sm`}
        >
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleNewChat}
              data-testid="chat-new-button"
              className="p-1.5 rounded-lg transition-colors text-c-text-muted hover:bg-c-surface-raised hover:text-c-text"
              title={t('aiChat.newChat', 'New chat')}
              aria-label={t('aiChat.newChat', 'New chat')}
            >
              <Plus size={18} strokeWidth={1.75} />
            </button>

            {showHistoryTrigger && (
              <button
                onClick={() => toggleSidebar()}
                data-testid="chat-history-button"
                data-chat-toggle
                className={`p-1.5 rounded-lg transition-colors ${
                  isSidebarOpen
                    ? 'text-c-text bg-c-surface-raised'
                    : 'text-c-text-muted hover:bg-c-surface-raised hover:text-c-text'
                }`}
                title={t('aiChat.history', 'History')}
                aria-label={t('aiChat.history', 'Chat history')}
              >
                <History size={18} strokeWidth={1.75} />
              </button>
            )}

            {/* M01-P03A — conversation branching (finding M01-035). Only once
                a real, persisted conversation is active: a `local-*` id has
                no server-side row yet, so GET /:id/branches would 404. */}
            {activeConversationId && !String(activeConversationId).startsWith('local-') && (
              <>
                {branchParentConversationId && (
                  <button
                    onClick={() => void handleSelectBranch(branchParentConversationId)}
                    data-testid="chat-branch-back-to-parent"
                    className="p-1.5 rounded-lg transition-colors text-c-text-muted hover:bg-c-surface-raised hover:text-c-text"
                    title={t('branch.backToParent', 'Back to source conversation')}
                    aria-label={t('branch.backToParent', 'Back to source conversation')}
                  >
                    <GitFork size={18} strokeWidth={1.75} className="rotate-180" />
                  </button>
                )}
                <BranchSelector
                  branches={branchList}
                  activeBranchId={null}
                  currentLabel={branchSelfName}
                  onSelectBranch={handleSelectBranch}
                  onCreateBranch={handleCreateBranchFromSelector}
                  onRenameBranch={handleRenameBranch}
                  onDeleteBranch={handleDeleteBranch}
                  isLoading={branchesLoading}
                  isCreating={branchCreating}
                  error={branchesError}
                />
              </>
            )}

            {/* Show the business/actions button only when a real navigation target exists. */}
            {onNavigateToActions && (
              <button
                onClick={() => {
                  trackFunnelEvent('chat_business_button_clicked', {
                    mode: isSplitMode ? 'split' : 'full',
                    pendingCount: pendingActionsCount,
                  });
                  onNavigateToActions();
                }}
                data-testid="chat-business-button"
                className="relative p-1.5 rounded-lg transition-colors text-c-text-muted hover:bg-c-surface-raised hover:text-c-text"
                title={t('aiChat.business', 'Business actions')}
                aria-label={t('aiChat.business', 'Business actions')}
              >
                <Briefcase size={18} strokeWidth={1.75} />
                {pendingActionsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-c-text text-[10px] font-medium text-c-bg px-1 leading-none">
                    {pendingActionsCount > 9 ? '9+' : pendingActionsCount}
                  </span>
                )}
              </button>
            )}

            {/* T012: Important signals (chat-active) */}
            {signalsEnabled && (
              <button
                onClick={() => setSignalsOpen(true)}
                data-testid="chat-signals-button"
                className="p-1.5 rounded-lg transition-colors text-c-text-muted hover:bg-c-surface-raised hover:text-c-text"
                title={t('aiChat.signals.title', 'Important signals')}
                aria-label={t('aiChat.signals.title', 'Important signals')}
              >
                <Sparkles size={18} strokeWidth={1.75} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            <V8ArtifactRunControl
              conversationId={activeConversationId}
              defaultGoal={latestUserGoalHint}
              snapshotContext={v8SnapshotContext}
            />
            <V8ContextIndicator
              conversationId={activeConversationId}
              defaultGoal={latestUserGoalHint}
            />
            {/* TRUST T-PM1 — `PrivateModeDetails` replaces the legacy static
              chip. When the feature flag is on, the badge becomes a button
              that opens a short popover explaining what private mode
              does and does NOT do (RODO honesty). When the flag is off
              the component renders the original read-only chip with the
              same classes, so disabling the flag is visually invisible. */}
            {isPrivateMode && <PrivateModeDetails />}
            {canUseWorkPanel && (
              <button
                onClick={() => setIsWorkPanelOpen((open) => !open)}
                data-testid="chat-work-panel-button"
                aria-pressed={showWorkPanel}
                className={`p-1.5 rounded-lg transition-colors ${
                  showWorkPanel
                    ? 'text-c-text bg-c-surface-raised'
                    : 'text-c-text-muted hover:bg-c-surface-raised hover:text-c-text'
                }`}
                title={t('aiChat.workPanel.open', 'Open work panel')}
                aria-label={t('aiChat.workPanel.open', 'Open work panel')}
              >
                <PanelRight size={18} strokeWidth={1.75} />
              </button>
            )}
            {ttsSupported && (
              <button
                onClick={() => {
                  // VM4 — snapshot `isSpeaking` BEFORE `stopSpeaking()` flips
                  // it to false so the barge-in toast only fires when the
                  // click actually interrupted an ongoing read. Debounce
                  // (1.5 s) is enforced inside `notifyBargeIn`, so repeated
                  // mute gestures produce at most one visible toast.
                  const wasBargeIn = voiceState.isSpeaking;
                  if (wasBargeIn) {
                    stopSpeaking();
                    notifyBargeIn({
                      message: t('voice.bargeInToast', 'Reading interrupted.'),
                      source: 'mute_button',
                    });
                  }
                  const nextState = wasBargeIn ? false : !autoReadEnabled;
                  setAutoReadEnabled(nextState);
                  updateVoiceSettings({ autoSpeakResponses: nextState });
                  setAIConfig({ textToSpeech: nextState } as any);
                }}
                data-testid="chat-autoread-button"
                className={`p-1.5 rounded-lg transition-colors ${
                  autoReadEnabled
                    ? 'text-c-text bg-c-surface-raised'
                    : 'text-c-text-muted hover:bg-c-surface-raised hover:text-c-text'
                }`}
                title={
                  voiceState.isSpeaking
                    ? t('aiChat.muteNow', 'Mute now')
                    : autoReadEnabled
                      ? t('aiChat.autoReadOff', 'Turn off auto-read')
                      : t('aiChat.autoReadOn', 'Turn on auto-read')
                }
                aria-label={
                  voiceState.isSpeaking
                    ? t('aiChat.muteNow', 'Mute now')
                    : autoReadEnabled
                      ? t('aiChat.autoReadOff', 'Turn off auto-read')
                      : t('aiChat.autoReadOn', 'Turn on auto-read')
                }
              >
                {autoReadEnabled ? (
                  <Volume2 size={18} strokeWidth={1.75} />
                ) : (
                  <VolumeX size={18} strokeWidth={1.75} />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Context Badge - shows what AI "sees" outside the Canvas split. */}
        {!showWorkPanel && (
          <div className={`${isCompact ? 'px-2' : 'px-3'}`}>
            <ContextBadge
              workspaceContext={workspaceContext}
              focusMode={focusMode}
              compact={isCompact}
            />
          </div>
        )}

        {/* Organization Memory panel removed — unused / WIP feature */}

        {/* Messages Area */}
        {/* Chat P1-6 — a11y: role=log + aria-live=polite so screen readers
            announce streaming AI responses as they arrive. aria-relevant
            additions keeps the announcement to new content rather than
            re-reading the whole thread on every update. */}
        <div
          ref={messagesContainerRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label="Conversation"
          className={`flex-1 ${showWorkPanelEmptyState ? 'overflow-hidden' : 'overflow-y-auto'} ${
            isCompact ? 'p-3 space-y-3' : 'p-4 space-y-4'
          } ${isStreaming ? 'chat-streaming-frame' : ''}`}
        >
          {isRehydratingConversation ? (
            /* Loading state — conversation selected but messages still loading */
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-8 h-8 border-2 border-c-accent border-t-transparent rounded-full animate-spin mb-3" />
              <p className={`${isCompact ? 'text-xs' : 'text-sm'} text-c-text-secondary`}>
                {t('aiChat.loadingConversation', 'Loading conversation…')}
              </p>
            </div>
          ) : showFullWelcomeEmptyState ? (
            <div
              data-testid="chat-full-welcome"
              className="flex min-h-full flex-col items-center justify-center px-4 py-12 text-center"
            >
              <h3
                className={`${isCompact ? 'text-2xl' : 'text-[32px]'} leading-tight font-semibold text-c-text`}
              >
                {t('aiChat.teresaWelcome', "Let's start your transformation")}
                {currentUser?.firstName && (
                  // Imię w kolorze tytułu (wzorzec 2026-07-04: czerwień TYLKO
                  // dla semantyki krytycznej, nie jako akcent ozdobny).
                  <span className="text-c-text">, {currentUser.firstName}</span>
                )}
              </h3>
              <p
                className={`${isCompact ? 'text-sm' : 'text-lg'} mt-4 max-w-2xl text-c-text-secondary`}
              >
                {t(
                  'aiChat.teresaWelcomeSubtitle',
                  "Describe a challenge, decision, or process you want to change — and we'll shape the transformation together, the way other leaders do."
                )}
              </p>

              {teresaVoice.voiceAvailable && (
                <button
                  type="button"
                  onClick={() => void teresaVoice.handleVoiceToggle()}
                  data-testid="welcome-voice-cta"
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-navy-700/20 bg-navy-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-navy-800 dark:border-white/20 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  {teresaVoice.voiceStatus === 'connecting' ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                      {teresaVoice.voiceStatus === 'live' && (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/50" />
                      )}
                      <Mic size={13} />
                    </span>
                  )}
                  {teresaVoice.voiceStatus === 'live'
                    ? t('aiChat.voice.stopVoice', 'End voice')
                    : teresaVoice.voiceStatus === 'connecting'
                      ? t('aiChat.voice.voiceConnecting', 'Connecting…')
                      : t('aiChat.voice.startVoice', 'Start by voice')}
                </button>
              )}

              <div id="chat-input" className="mt-8 w-full max-w-5xl text-left">
                {partialRecoveryNotice}
                {!!lastError && !isStreaming && (
                  <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-900/20">
                    <div className="text-xs text-amber-800 dark:text-amber-200">
                      {t('aiChat.streamError', 'Last request failed. You can retry.')}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => retryLastStream()}
                        className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
                      >
                        {t('common.tryAgain', 'Try again')}
                      </button>
                      <button
                        onClick={() => clearLastError()}
                        className="rounded-md bg-c-surface-raised px-3 py-1 text-xs font-medium text-amber-800 hover:bg-c-border-subtle dark:text-amber-200"
                      >
                        {t('common.dismiss', 'Dismiss')}
                      </button>
                    </div>
                  </div>
                )}
                <OutputToolSelector />
                <EnhancedChatInput
                  onSend={handleSendMessage}
                  onNewChat={handleNewChat}
                  onStopGenerating={() => {
                    const hadPartial = abortStream();
                    setAbortFeedback(hadPartial ? 'partial' : 'cancelled');
                    setTimeout(() => setAbortFeedback(null), 3000);
                  }}
                  onTeresaVoiceToggle={teresaVoice.handleVoiceToggle}
                  teresaVoiceStatus={teresaVoice.voiceStatus}
                  teresaVoiceAvailable={teresaVoice.voiceAvailable}
                  teresaVoiceUnavailableReason={teresaVoice.voiceUnavailableReason}
                  teresaVoiceMuted={teresaVoice.isMuted}
                  onTeresaVoiceMuteToggle={teresaVoice.toggleMute}
                  isStreaming={isStreaming}
                  disabled={isDisabled}
                  placeholder={t('aiChat.teresaPlaceholder', 'Ask Teresa about your work...')}
                  voiceModeEnabled={voiceModeEnabled}
                  onVoiceModeChange={setVoiceModeEnabled}
                  chatLanguage={chatLanguage}
                  voiceState={voiceState}
                  startVoiceListening={startListening}
                  stopVoiceListening={stopListening}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {[
                  {
                    label: t('aiChat.quickClicks.brief.label', 'Daily brief'),
                    prompt: t(
                      'aiChat.quickClicks.brief.prompt',
                      'Give me a short daily brief: priorities, risks, decisions, and next best actions.'
                    ),
                  },
                  {
                    label: t('aiChat.quickClicks.savings.label', 'Quick savings'),
                    prompt: t(
                      'aiChat.quickClicks.savings.prompt',
                      'Find quick savings opportunities without reducing quality. Ask me for missing context first.'
                    ),
                  },
                  {
                    label: t('aiChat.quickClicks.newProduct.label', 'Product idea'),
                    prompt: t(
                      'aiChat.quickClicks.newProduct.prompt',
                      'Help me shape a new product idea with market, ROI, risks, and first implementation steps.'
                    ),
                  },
                  {
                    label: t('aiChat.quickClicks.planReview.label', 'Plan review'),
                    prompt: t(
                      'aiChat.quickClicks.planReview.prompt',
                      'Review my plan like a senior consultant: find gaps, risks, assumptions, and next actions.'
                    ),
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleSendMessage(item.prompt)}
                    className="rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-1 text-[11px] font-medium text-c-text-secondary transition-colors hover:border-c-border-strong hover:bg-c-surface-raised hover:text-c-text"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    icon: Search,
                    label: t('aiChat.homeCards.market.label', 'Analiza rynku'),
                    desc: t(
                      'aiChat.homeCards.market.desc',
                      'Research a market, competitors, and positioning'
                    ),
                    prompt: t(
                      'aiChat.homeCards.market.kickoff',
                      'Chcę zrobić analizę rynku. Opisz proszę, jakie pytania musisz mi zadać, żeby dobrze zdefiniować: branżę, segment, kraj, klientów, konkurencję i przewagę. Zacznij od 5 pytań.'
                    ),
                    // Market analysis = web-backed market research mode.
                    preset: { marketResearch: true, webSearch: true },
                    color: 'text-indigo-500',
                    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
                  },
                  {
                    icon: Calculator,
                    label: t('aiChat.homeCards.finance.label', 'Analiza finansowa'),
                    desc: t('aiChat.homeCards.finance.desc', 'Analyze ROI, budgets, and scenarios'),
                    prompt: t(
                      'aiChat.homeCards.finance.kickoff',
                      'Chcę zrobić analizę finansową. Jakie dane mamy przeanalizować (budżet, koszty, przychody, ROI, CAPEX/OPEX)? Zadaj mi 5 pytań, a potem zaproponuj strukturę analizy.'
                    ),
                    // Financial analysis = data/metrics/tables-first answer style.
                    preset: { responseStyle: 'analyst' },
                    color: 'text-emerald-500',
                    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
                  },
                  {
                    icon: Wrench,
                    label: t('aiChat.homeCards.consulting.label', 'Klasyczny consulting'),
                    desc: t('aiChat.homeCards.consulting.desc', 'Use classic frameworks and tools'),
                    prompt: t(
                      'aiChat.homeCards.consulting.kickoff',
                      'Chcę użyć klasycznych narzędzi consultingowych. Jaki problem rozwiązujemy i w jakim kontekście? Zadaj mi 5 pytań, a potem zaproponuj 2–3 najlepsze ramy (np. SWOT, 5 Forces, Ansoff, Value Chain).'
                    ),
                    // Classic consulting = multi-consultant persona system prompt.
                    preset: { coThinkerMode: 'multi_consultant' },
                    color: 'text-amber-500',
                    bg: 'bg-amber-50 dark:bg-amber-900/20',
                  },
                  {
                    icon: CheckCircle2,
                    label: t('aiChat.homeCards.digital.label', 'Transformacja cyfrowa'),
                    desc: t(
                      'aiChat.homeCards.digital.desc',
                      'Run licensed diagnostics and assessments'
                    ),
                    prompt: t(
                      'aiChat.homeCards.digital.kickoff',
                      'Chcę ocenić gotowość do transformacji cyfrowej. Jakie obszary mamy ocenić i jakie są kryteria? Zadaj mi 5 pytań i zaproponuj szybki plan diagnozy.'
                    ),
                    // Digital transformation = multi-step deep-thinking diagnosis.
                    preset: { deepResearch: true },
                    color: 'text-blue-500',
                    bg: 'bg-blue-50 dark:bg-blue-900/20',
                  },
                ].map((cap) => (
                  <button
                    key={cap.label}
                    type="button"
                    onClick={() => handleModeTile(cap.preset, cap.prompt)}
                    className="group flex flex-col items-start gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface p-2.5 text-left transition-[background-color,border-color] duration-200 hover:border-c-border-subtle hover:bg-c-surface-raised"
                  >
                    <div className={`rounded-md p-1.5 ${cap.bg}`}>
                      <cap.icon size={15} className={cap.color} />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-c-text">{cap.label}</div>
                      <div className="mt-0.5 text-[9px] leading-tight text-c-text-secondary">
                        {cap.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-c-text-secondary">
                <Sparkles size={11} />
                {t(
                  'aiChat.onboarding.hint',
                  'Tip: Try voice mode, attach files, or enable Deep Thinking for multi-step analysis'
                )}
              </p>

              <div className="mt-12 flex flex-col items-center gap-1.5 pointer-events-none select-none">
                <p className="text-3xl font-semibold tracking-tight text-c-text/70">Consultify®</p>
                <p className="text-center text-[11px] uppercase tracking-[0.25em] text-c-text-secondary">
                  DBR77 Industrial Intelligence
                </p>
              </div>
            </div>
          ) : showWorkPanelEmptyState ? (
            <div data-testid="chat-work-panel-empty-state" className="min-h-full" />
          ) : showCompactEmptyState ? (
            <div
              data-testid="chat-compact-empty-state"
              className="flex min-h-full flex-col justify-end px-2 py-3"
            >
              <div className="rounded-2xl border border-c-border-subtle bg-c-surface-raised p-3 text-left">
                <div className="inline-flex items-center rounded-full border border-c-border-subtle bg-c-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-c-text-secondary">
                  Teresa
                </div>
                <p className="mt-2 text-xs leading-relaxed text-c-text-secondary">
                  {t(
                    'aiChat.sidebarEmptyHint',
                    'Ask Teresa from this side panel when you need quick context or next-step help.'
                  )}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation state banners (§2.3.5 — deep-link + degraded posture) */}
              {_activeConversationState === 'archived' && (
                <div className="mx-2 mb-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40 flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                  <span className="text-xs text-amber-700 dark:text-amber-400">
                    {t(
                      'aiChat.archivedBanner',
                      'This conversation is archived. Unarchive it to continue chatting.'
                    )}
                  </span>
                </div>
              )}
              {_activeConversationState === 'deleted' && (
                <div className="mx-2 mb-3 px-3 py-2 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200/60 dark:border-danger-700/40 flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-danger-600 dark:text-danger-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  <span className="text-xs text-danger-700 dark:text-danger-400">
                    {_activeConversationStateMessage ||
                      t('aiChat.deletedBanner', 'This conversation has been deleted.')}
                  </span>
                </div>
              )}
              {_activeConversationState === 'permission_denied' && (
                <div className="mx-2 mb-3 px-3 py-2 rounded-lg bg-c-surface-raised border border-c-border-subtle flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-c-text-muted shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <span className="text-xs text-c-text-secondary">
                    {_activeConversationStateMessage ||
                      t(
                        'aiChat.permissionDenied',
                        'You do not have access to this conversation. Contact the folder owner for access.'
                      )}
                  </span>
                </div>
              )}
              {_activeConversationState === 'not_found' && (
                <div className="mx-2 mb-3 px-3 py-2 rounded-lg bg-c-surface-raised border border-c-border-subtle flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-c-text-muted shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-xs text-c-text-secondary">
                    {t(
                      'aiChat.notFound',
                      'This conversation does not exist or has been permanently removed.'
                    )}
                  </span>
                </div>
              )}
              {displayMessages.map((msg, index) => renderMessage(msg, index))}
            </>
          )}

          {/* Typing indicator — only for non-streaming flows (e.g. file analysis).
              During a normal stream the AI bubble already shows the "Thinking…"
              state inline, so this would otherwise render a duplicate avatar/row. */}
          {isBotTyping && !streamedContent && !isStreaming && (
            <div className="mx-auto w-full max-w-5xl flex gap-2 justify-start">
              <div
                className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full bg-c-surface-raised border border-slate-200/60 dark:border-white/[0.03] flex items-center justify-center shrink-0 mt-0.5`}
              >
                <TeresaMark size={isCompact ? 12 : 14} className="text-c-text-secondary" />
              </div>
              <div className="bg-c-surface-raised border border-c-border-subtle rounded-xl rounded-tl-none px-3 py-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-c-text-muted rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-c-text-muted rounded-full animate-bounce delay-100"></span>
                <span className="w-1.5 h-1.5 bg-c-text-muted rounded-full animate-bounce delay-200"></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {!showFullWelcomeEmptyState && (
          <div id="chat-input" className={`${isCompact ? 'p-2' : 'px-3 pb-1.5 pt-3'} bg-c-bg`}>
            <div className="mx-auto w-full max-w-5xl">
              {partialRecoveryNotice}
              {!!lastError && !isStreaming && (
                <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                  <div className="text-xs text-amber-800 dark:text-amber-200">
                    {t('aiChat.streamError', 'Last request failed. You can retry.')}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => retryLastStream()}
                      className="px-3 py-1 rounded-md text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {t('common.tryAgain', 'Try again')}
                    </button>
                    <button
                      onClick={() => clearLastError()}
                      className="px-3 py-1 rounded-md text-xs font-medium bg-c-surface-raised hover:bg-c-border-subtle text-amber-800 dark:text-amber-200"
                    >
                      {t('common.dismiss', 'Dismiss')}
                    </button>
                  </div>
                </div>
              )}
              {/* Persistent contextual command buttons (D17). Unlike quickPrompts
                  these stay visible after the conversation starts — they are the
                  artifact's "AI Consultant" actions, now living inside the one
                  docked Teresa panel instead of a separate chat instance. */}
              {contextActions && contextActions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                  {contextActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => action.onClick()}
                      disabled={action.busy}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full border border-c-border-strong bg-c-surface-raised text-c-text-secondary hover:bg-c-surface hover:text-c-text transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                    >
                      {action.busy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        (action.icon ?? null)
                      )}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              )}
              {quickPrompts && quickPrompts.length > 0 && messages.length === 0 && !isStreaming && (
                <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleSendMessage(prompt)}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text-secondary hover:bg-c-surface-raised hover:border-c-border-strong hover:text-c-text transition-colors duration-200"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
              {/* "Read aloud" pill removed (declutter) — per-message Speak lives in the
                  response action row. */}
              <EnhancedChatInput
                onSend={handleSendMessage}
                onNewChat={handleNewChat}
                onStopGenerating={() => {
                  const hadPartial = abortStream();
                  setAbortFeedback(hadPartial ? 'partial' : 'cancelled');
                  setTimeout(() => setAbortFeedback(null), 3000);
                }}
                onTeresaVoiceToggle={teresaVoice.handleVoiceToggle}
                teresaVoiceStatus={teresaVoice.voiceStatus}
                teresaVoiceAvailable={teresaVoice.voiceAvailable}
                teresaVoiceUnavailableReason={teresaVoice.voiceUnavailableReason}
                teresaVoiceMuted={teresaVoice.isMuted}
                onTeresaVoiceMuteToggle={teresaVoice.toggleMute}
                isStreaming={isStreaming}
                disabled={isDisabled}
                placeholder={
                  workspaceContext &&
                  workspaceContext.type !== 'empty' &&
                  workspaceContext.entityName
                    ? t('aiChat.teresaContextPlaceholder', {
                        defaultValue: 'How can Teresa help with {{context}}?',
                        context: workspaceContext.entityName,
                      })
                    : t('aiChat.teresaPlaceholder', 'Ask Teresa about your work...')
                }
                voiceModeEnabled={voiceModeEnabled}
                onVoiceModeChange={setVoiceModeEnabled}
                chatLanguage={chatLanguage}
                voiceState={voiceState}
                startVoiceListening={startListening}
                stopVoiceListening={stopListening}
              />
              {chatSuggestions.length > 0 && (
                <ChatSmartSuggestions
                  suggestions={chatSuggestions}
                  onSuggestionClick={handleSuggestionClick}
                  className="pt-2"
                />
              )}
            </div>
          </div>
        )}

        {/* Sliding History Panel */}
        <ChatSlidingPanel
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          activeConversationId={activeConversationId}
        />
      </div>

      {showWorkPanel && (
        <aside
          data-testid="chat-work-panel"
          className="absolute inset-y-0 right-0 z-30 flex w-full flex-col bg-c-bg shadow-2xl lg:relative lg:z-auto lg:order-1 lg:w-[var(--work-canvas-width)] lg:shadow-none"
          aria-label={t('aiChat.workPanel.title', 'Canvas work area')}
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('aiChat.workPanel.resizeDivider', 'Resize Canvas panel')}
            aria-valuemin={MIN_WORK_CANVAS_WIDTH_PERCENT}
            aria-valuemax={MAX_WORK_CANVAS_WIDTH_PERCENT}
            aria-valuenow={Math.round(workCanvasWidthPercent)}
            tabIndex={0}
            data-testid="chat-work-panel-edge-resizer"
            onMouseDown={handleWorkCanvasEdgeMouseDown}
            onDoubleClick={() => setPersistedWorkCanvasWidth(DEFAULT_WORK_CANVAS_WIDTH_PERCENT)}
            onKeyDown={handleWorkCanvasEdgeKeyDown}
            className="group absolute inset-y-0 right-0 z-50 hidden w-4 translate-x-1/2 cursor-col-resize touch-none outline-none lg:block"
          >
            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-c-border transition-colors group-hover:bg-c-border-strong group-focus:bg-c-focus-solid" />
          </div>
          <div className="min-h-0 flex-1">
            <WorkCanvasDocumentPanel
              key={`${requestedCanvasStarterId || 'default'}:${requestedCanvasDraftId || requestedCanvasDeckId || 'none'}`}
              conversationId={activeConversationId}
              initialStarterId={requestedCanvasStarterId}
              initialDeckId={requestedCanvasDeckId}
              initialDraftId={requestedCanvasDraftId}
              onActiveDocumentChange={setActiveCanvasDocument}
              onCanvasSelectionChange={setActiveCanvasSelection}
              onClose={() => setIsWorkPanelOpen(false)}
            />
          </div>
        </aside>
      )}

      {/* Important signals panel (T012) */}
      {signalsEnabled && (
        <ChatSignalsPanel
          open={signalsOpen}
          onClose={() => setSignalsOpen(false)}
          projectId={workspaceContext?.projectId || null}
        />
      )}

      {/* AI Table Builder slide-over panel */}
      {tableBuilderOpen && (
        <ChatToSchemaPanel
          workspaceId={
            (workspaceContext?.entityData?.tableContext as { baseId?: string } | undefined)
              ?.baseId ||
            workspaceContext?.entityId ||
            ''
          }
          initialMessage={tableBuilderInitialMsg}
          slideOver
          companyContext={{
            workspaceName: workspaceContext?.entityName || workspaceContext?.projectName,
            moduleName: workspaceContext?.type || undefined,
          }}
          onExecuted={() => {
            const uiLang = (i18n.language || 'en').split('-')[0];
            addChatMessage({
              id: `table-created-${Date.now()}`,
              role: 'ai',
              content:
                uiLang === 'pl'
                  ? 'Tabela została utworzona pomyślnie! Możesz ją teraz znaleźć w zakładce My Work.'
                  : 'Table created successfully! You can find it in the My Work tab.',
              timestamp: new Date(),
            });
            setTableBuilderOpen(false);
            setTableBuilderInitialMsg(undefined);
          }}
          onClose={() => {
            setTableBuilderOpen(false);
            setTableBuilderInitialMsg(undefined);
          }}
        />
      )}
    </div>
  );
};

export default UnifiedChatPanel;
