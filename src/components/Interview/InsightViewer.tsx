/**
 * InsightViewer — N-mode canonical 2-pane layout
 *
 * Matches TaskDetailView / DecisionDetailView pattern:
 *   NModeHeader → NModePropertiesStrip → ActionBar → NModeLeftNav + NModeCanvas
 */

import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Flame,
  GitCompare,
  Heart,
  History,
  Layers,
  LayoutGrid,
  Lightbulb,
  Link2,
  Loader2,
  Map as MapIcon,
  MessageSquare,
  Network,
  Pencil,
  Plus,
  Quote,
  Radio,
  RefreshCw,
  Rocket,
  // (usunięte) Save — ikona obsługiwała wyłącznie zdublowany przycisk Zapisz
  // w sekcji Akcje prawego panelu (SPEC-N §2.6); zapis żyje w nagłówku.
  Scale,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  Star,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { confidenceShortLabel } from '@/components/Conclusions/conclusionMeta';
import { InitiativeGeneratorModal } from '@/components/Initiatives/Wizard/InitiativeGeneratorModal';
import { PresentMode } from '@/components/Presentations/DeckBuilder/PresentMode';
import type { DeckCard } from '@/components/Presentations/wizard/types';
// n-Type §6.2–6.4 — ręczna edycja treści sekcji Insightu (właściciel 2026-07-23).
import { AIFieldEnhancer } from '@/components/shared/AIFieldEnhancer';
import { ArtifactActionPanel } from '@/components/shared/artifact-actions/ArtifactActionPanel';
import { AutoFitTextarea } from '@/components/shared/AutoFitTextarea';
import { Select } from '@/components/shared/forms';
import type { InlineTableColumn } from '@/components/shared/NModeBlocks';
import { Callout, EmptyStateInline, InlineTable } from '@/components/shared/NModeBlocks';
import {
  EvidenceBadge,
  NModeCardBadge,
  type NModeCardStatus,
  NModeSectionWrapper,
} from '@/components/shared/NModeLayout';
import { NCardAIAnalysisPanel } from '@/components/shared/NModeLayout/NCardAIAnalysisPanel';
import { Menu2AIButton, NModeMenu2 } from '@/components/shared/NModeLayout/NModeMenu2';
import { NModeShell } from '@/components/shared/NModeLayout/NModeShell';
// ToolbarAISolidButton celowo NIE importowany (SPEC-N §2.3 — poza slotem primary
// nic nie jest solid; AI Consultant zjechał na wariant outline/split).
import { ToolbarGhostButton } from '@/components/shared/NModeLayout/NModeToolbar';
import { SectionErrorBoundary } from '@/components/shared/NModeLayout/SectionErrorBoundary';
import type { NModeSection, PropertyFieldOption } from '@/components/shared/NModeLayout/types';
import { useCardAIAnalysis } from '@/components/shared/NModeLayout/useCardAIAnalysis';
import { type CardLayout, useCardLayout } from '@/components/shared/NModeLayout/useCardLayout';
import {
  ActivityLogCanvas,
  type ActivityLogEntry as NModeActivityLogEntry,
  type ActivityStats,
  type ActivityTypeMeta,
} from '@/components/shared/NModeSections';
import {
  type CommentItem,
  type CommentPriority,
  CommentsCanvas,
  type DateFilter,
  type SortOrder,
} from '@/components/shared/NModeSections';
import { ErrorState, SkeletonState } from '@/components/shared/states';
import { ArtifactApprovalStatusBar } from '@/components/standard/ArtifactApprovalStatusBar';
import { ArtifactPropertiesTable } from '@/components/standard/ArtifactPropertiesTable';
import {
  ARTIFACT_PANEL_CARD_CLASS_DOCKED,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import { EvidencePanelSection } from '@/components/standard/EvidencePanelSection';
import { Button, LoadingState } from '@/components/ui/primitives';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { ROUTES } from '@/routes/routeConfig';
import { Api } from '@/services/api';
import { type ArtifactConversion, ConclusionsApi } from '@/services/api/conclusions.api';
import {
  type V8InsightAnalysis,
  type V8InsightAnalysisMatrixCell,
  type V8InsightCandidate,
  type V8InsightFinding,
  type V8InsightMaterialQuality,
  type V8InsightSourcePack,
  V8InterviewApi,
  type V8InterviewReportPack,
  type V8InterviewReportReadiness,
  type V8InterviewReportWorksheetStatus,
} from '@/services/api/v8/interview';
// ETAP 3 standardu n-Type — „Analizuj z AI" (silnik + panel wyników).
import type { CardAnalysisField } from '@/services/cardAnalysis';
import { exportReportToPDF } from '@/services/pdf/pdfExport';
import { useAppStore } from '@/store/useAppStore';
import { TEXT_L1 } from '@/styles/typography';
import { isArtifactApprovalUiEnabled } from '@/utils/artifactApprovalUiFlag';
import { type ArtifactType, buildArtifactCode } from '@/utils/artifactLinks';
import { getHandoffLandingPath } from '@/utils/initiativeLinks';

// MIGRACJA (D-8): kompozycja kart Insight płynie z WIĄŻĄCEGO kontraktu karty
// (cardContract.types.ts) zamiast z martwego mirrora INSIGHT_SPEC — patrz
// insightCardContract.ts. Za flagą (default OFF); OFF ⇒ zero zmian.
import {
  INSIGHT_CARD_RENDER_IDS,
  INSIGHT_CARD_SPEC,
  INSIGHT_PHASE_D_RENDER_IDS,
} from './insightCardContract';
import { extractQuotedFragments } from './insightQuotes';
import { createInterviewDemoDataset, isInterviewDemoId } from './interviewDemoData';

// VF1-2 (SPEC-A wzorzec, analogicznie do VF1-1 Task): gate for visible
// shared empty/skeleton/error states on the N-mode canonical path. Default
// OFF until Piotr accepts on screenshots (reguła #7 — nie jest pierwszym
// testerem wizualnym). See docs/ui-standards/TRIADA_KANON.md +
// ARTIFACT_ANATOMY_STANDARD.md §18.1.
const VF1_INSIGHT_SPECA = import.meta.env.VITE_VF1_INSIGHT_SPECA === 'true';

/**
 * Wspólny log „cichej" awarii danych wtórnych (aktywność, komentarze, sesje,
 * streszczenia, packi, persystencja layoutu). ŚWIADOMIE tylko `console.warn` —
 * te ścieżki mają fail-soft UI (pusta lista / null) i NIE mają krzyczeć do
 * użytkownika. Cel: realna awaria backendu przestaje być niewidoczna dla
 * developera (dotąd `catch {}` / `.catch(() => [])` połykały ją bez śladu).
 */
function warnInsightSilentFailure(context: string, err?: unknown): void {
  console.warn(`[InsightViewer] ${context}`, err);
}

// MIGRACJA — kompozycja kart Insight przez WIĄŻĄCY kontrakt karty (D-8, KONTRAKT §9).
// Default OFF (zero regresji na demo). Kolejność opt-in (wzór Initiative
// `isInitiativeCardContractEnabled`): URL `?cardContract=1` → localStorage
// `ff.cardContract` → env `VITE_VF1_INSIGHT_CARD_CONTRACT` → OFF. BEZ guardu
// `import.meta.env.DEV`, żeby Piotr włączył kontrakt na ŻYWYM demo jednym linkiem;
// publiczność bez linku/localStorage/env widzi demo bez zmian (reguła #7 — nadzorca
// renderuje zrzut sam). Flaga DEDYKOWANA (jak POC Decision/Task/Initiative:
// VITE_VF1_*_CARD_CONTRACT), świadomie NIE współdzielona z VF1_INSIGHT_SPECA — tamta
// bramkuje puste/skeleton/error stany (inny cel, InsightViewer:7806/7819).
function parseInsightCardContractFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'off') return false;
  return null;
}

function useInsightCardContractEnabled(): boolean {
  return useMemo(() => {
    if (typeof window !== 'undefined' && window.location) {
      try {
        const q = parseInsightCardContractFlag(
          new URLSearchParams(window.location.search).get('cardContract')
        );
        if (q !== null) {
          try {
            window.localStorage.setItem('ff.cardContract', q ? '1' : '0');
          } catch {
            /* ignore */
          }
          return q;
        }
      } catch {
        /* ignore */
      }
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const ls = parseInsightCardContractFlag(window.localStorage.getItem('ff.cardContract'));
        if (ls !== null) return ls;
      } catch {
        /* ignore */
      }
    }
    try {
      const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
      const env = parseInsightCardContractFlag(meta?.env?.VITE_VF1_INSIGHT_CARD_CONTRACT);
      if (env !== null) return env;
    } catch {
      /* ignore */
    }
    return false;
  }, []);
}

/**
 * Tryb prezentacji (PresentMode) — WYŁĄCZONY 2026-07-20 decyzją Piotra.
 *
 * Powód: renderuje strukturalną kartę Insightu jako jeden zlepiony akapit —
 * waga wchodzi w zdanie jako „(severity: high)" zamiast pilla, sekcje sklejone
 * bez hierarchii, etykiety wewnętrzne („Perspective lenses", „Divergence")
 * wyciekają do treści klienckiej, tekst urywa się w połowie zdania.
 * Piotr: „lepiej to wyłączyć niż takie coś pokazywać".
 *
 * Kod zostaje — przywrócić (`true`) po zadaniu C10 z planu wykonawczego
 * (kontrakt renderu prezentacji): Harvard/wdrozenie-100/_PLAN_WYKONAWCZY_2026-07-20.md
 */
// ETAP 1.2 (2026-07-23): staly PRESENT_MODE_ENABLED USUNIETY razem z przyciskiem
// "Prezentuj" w pasku — kontrakt menu 2 zna trzy strefy i nie ma w nich ikony
// prezentacji, a flaga i tak byla OFF. Wejscie do prezentacji zostaje w Eksporcie
// ("Do prezentacji" -> setExportTarget('deck')), wiec zdolnosc nie znika.

/**
 * ETAP 1.2 standardu n-Type (2026-07-23) — „Eksport ▾" ZDJĘTY z menu 2.
 *
 * Właściciel: „Eksportuj → kebab lub Rezultaty. Jeśli przeniesienie wymaga
 * decyzji produktowej — usuń z paska i ZGŁOŚ, nie wymyślaj." Kontrakt menu 2
 * zna trzy strefy (Sekcje | Edycja|Podgląd | How-to + Analizuj z AI) i nie ma
 * w nich miejsca na eksport, a docelowy dom (kebab Menu 1 vs sekcja
 * „Rezultaty") to decyzja właściciela, nie robotnika.
 *
 * Dlatego kod eksportu NIE jest kasowany — zostaje kompletny za tą flagą
 * (domyślnie OFF). Po decyzji: albo `true` (wraca do paska), albo jeden ruch
 * do kebaba/Rezultatów. Do tego czasu Insight NIE MA wejścia do eksportu —
 * to świadoma, zgłoszona luka, nie przeoczenie.
 */
const INSIGHT_EXPORT_IN_MENU2 = false;

// ── Types ────────────────────────────────────────────────────────────────────

type InsightPromptType =
  | 'summary'
  | 'general_analysis'
  | 'trends'
  | 'problems'
  | 'recommendations'
  | 'comparison'
  | 'gaps'
  | 'risk_assessment'
  | 'opportunity_scan'
  | 'maturity'
  | 'stakeholder_map'
  | 'between_the_lines';

type InsightStatus = 'generating' | 'completed' | 'failed' | 'draft' | 'in_review' | 'published';

/**
 * Mapowanie stanu artefaktu Insight (`InsightStatus`, whole-artifact) na model
 * stanu karty wzorca N (`NModeCardStatus`). Wzorzec N §3.2.
 *
 *   generating → generating   (AI pisze — skeleton „Teresa pisze…")
 *   failed     → error        (generacja padła)
 *   draft      → ai-draft      (AI napisało, człowiek jeszcze nie zaakceptował)
 *   in_review  → edited        (człowiek recenzuje/dotknął treści)
 *   published  → done          (zatwierdzone)
 *   completed  → ai-draft      (domyślnie: treść z AI, czeka na akceptację)
 *
 * Per-sekcja nakładamy jeszcze:
 *   - `regenerating` (globalny) → generating (ta karta jest właśnie odświeżana)
 *   - sekcja bez treści (`hasContent === false`) → empty
 */
const insightStatusToCardBaseState = (status: InsightStatus | undefined): NModeCardStatus => {
  switch (status) {
    case 'generating':
      return 'generating';
    case 'failed':
      return 'error';
    case 'draft':
      return 'ai-draft';
    case 'in_review':
      return 'edited';
    case 'published':
      return 'done';
    case 'completed':
    default:
      return 'ai-draft';
  }
};

/**
 * Rozwiązuje stan pojedynczej karty-sekcji Insightu: łączy stan whole-artifact
 * z sygnałami per-sekcja (odświeżanie tej karty, obecność treści).
 */
const resolveInsightSectionCardState = (
  status: InsightStatus | undefined,
  opts: { hasContent: boolean; regenerating?: boolean }
): NModeCardStatus => {
  if (opts.regenerating) return 'generating';
  if (status === 'generating') return 'generating';
  if (status === 'failed') return 'error';
  if (!opts.hasContent) return 'empty';
  return insightStatusToCardBaseState(status);
};

type P10ConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient' | 'contradicted';

type InsightReviewStatus = 'draft' | 'in_review' | 'published';

interface InsightTheme {
  title: string;
  description: string;
  evidence_refs: string[];
  strength: 'strong' | 'moderate' | 'weak';
  confidence?: P10ConfidenceLevel;
  limits?: string[];
  crossSessionPattern?: boolean;
  perspective_labels?: string[];
  divergence_note?: string;
}

interface InsightIssue {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  evidence_refs: string[];
  confidence?: P10ConfidenceLevel;
  limits?: string[];
  crossSessionPattern?: boolean;
  perspective_labels?: string[];
  divergence_note?: string;
}

interface InsightOpportunity {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  evidence_refs: string[];
  confidence?: P10ConfidenceLevel;
  limits?: string[];
  crossSessionPattern?: boolean;
  perspective_labels?: string[];
  divergence_note?: string;
}

interface InsightSignal {
  title: string;
  description: string;
  type: 'tension' | 'gap' | 'contradiction' | 'emerging_pattern';
}

interface InsightEvidenceMapEntry {
  answer_id: string;
  question_text: string;
  answer_snippet: string;
  linked_themes: string[];
  linked_issues: string[];
  evidence_pointers?: string[];
}

type P10ReadbackStatus =
  | 'draft_interpretation'
  | 'shared_for_readback'
  | 'confirmed_by_client'
  | 'partially_confirmed'
  | 'challenged_by_client'
  | 'needs_more_evidence';

interface Insight {
  id: string;
  organizationId: string;
  title: string;
  promptType: InsightPromptType;
  sourceSessionIds: string[];
  filters?: Record<string, any>;
  content?: string;
  executiveSummary?: string;
  themes?: InsightTheme[];
  issues?: InsightIssue[];
  opportunities?: InsightOpportunity[];
  signals?: InsightSignal[];
  evidenceMap?: InsightEvidenceMapEntry[];
  missingData?: string[];
  materialQuality?: V8InsightMaterialQuality | null;
  status: InsightStatus;
  reviewStatus?: InsightReviewStatus;
  publishedAt?: string;
  reviewedBy?: string;
  errorMessage?: string;
  sourceSessionCount: number;
  tokensUsed: number;
  generationTimeMs?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface SourceSession {
  id: string;
  name: string;
  templateName?: string;
  completedAt?: string;
  respondentRole?: string;
  department?: string;
}

interface SourceSessionSummary {
  facts: string[];
  gaps: string[];
  constraints: string[];
  painPoints: string[];
}

interface ParsedInsightSection {
  heading: string;
  body: string;
  bullets: string[];
  paragraphs: string[];
}

const DEFAULT_SESSION_SUMMARY: SourceSessionSummary = {
  facts: [],
  gaps: [],
  constraints: [],
  painPoints: [],
};

function uniqueNonEmpty(items: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  items.forEach((item) => {
    const normalized = String(item || '')
      .replace(/^[-*]\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });
  return result;
}

/**
 * Coerce a loosely-typed API array (session summary `facts`/`gaps`/`constraints`/
 * `painPoints`) into a clean `string[]`. The backend sometimes returns these as
 * objects (e.g. `{ text }`, `{ fact }`, `{ statement }`) rather than plain
 * strings — rendering those directly yields "[object Object]". This normalizes
 * each element to a meaningful string and drops empties.
 */
function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): string => {
      if (typeof item === 'string') return item;
      if (item == null) return '';
      if (typeof item === 'number' || typeof item === 'boolean') return String(item);
      if (typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const pick =
          o.text ??
          o.fact ??
          o.value ??
          o.statement ??
          o.label ??
          o.title ??
          o.content ??
          o.description ??
          o.name ??
          o.summary;
        if (typeof pick === 'string') return pick;
        if (typeof pick === 'number' || typeof pick === 'boolean') return String(pick);
      }
      return '';
    })
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * #23b — Strip Markdown markup to clean plain text for PREVIEW sub-texts only.
 * Conservative: removes leading heading hashes, bold/italic/strike markers,
 * inline-code backticks, link/image syntax, leading list/quote markers, and
 * collapses Markdown table rows (`| a | b |`) into a readable `a · b`.
 * The full section bodies still render via ReactMarkdown — do NOT use this there.
 */
function stripMarkdownPreview(input?: string): string {
  if (!input) return '';
  return input
    .split('\n')
    .map((line) => {
      let l = line.trim();
      // Drop table separator rows like `| --- | :--: |`
      if (/^\|?[\s:|-]+\|[\s:|-]*$/.test(l) && l.includes('-')) return '';
      // Collapse table rows `| a | b |` → `a · b`
      if (l.startsWith('|') || /\|.*\|/.test(l)) {
        l = l
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((cell) => cell.trim())
          .filter(Boolean)
          .join(' · ');
      }
      // Strip leading heading hashes, blockquote `>` and list markers
      l = l
        .replace(/^#{1,6}\s+/, '')
        .replace(/^>\s?/, '')
        .replace(/^(?:[-*+]|\d+\.)\s+/, '');
      return l;
    })
    .join(' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images → alt text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → label
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // italic
    .replace(/~~(.*?)~~/g, '$1') // strikethrough
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractQuotedLines(content?: string): string[] {
  // Skan cytatów mieszka w `insightQuotes.ts` (czysty tekst, test jednostkowy
  // bez rusztowania React). Tutaj zostaje wyłącznie deduplikacja — kontrakt
  // funkcji (kolejność: blokowe → w linii, potem unikalne) bez zmian.
  return uniqueNonEmpty(extractQuotedFragments(content));
}

function parseInsightContent(content?: string): ParsedInsightSection[] {
  if (!content) return [];

  const chunks = content
    .split(/^#{1,6}\s+/gm)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.map((chunk) => {
    const [headingLine, ...rest] = chunk.split('\n');
    const body = rest.join('\n').trim();
    const paragraphs = body
      .split(/\n{2,}/)
      .map((part) => part.replace(/^[-*]\s+/gm, '').trim())
      .filter(Boolean);
    const bullets = Array.from(body.matchAll(/^(?:[-*]|\d+\.)\s+(.+)$/gm)).map((match) =>
      String(match[1] || '').trim()
    );

    return {
      heading: String(headingLine || '').trim(),
      body,
      bullets: uniqueNonEmpty(bullets),
      paragraphs: uniqueNonEmpty(paragraphs),
    };
  });
}

interface InsightViewerProps {
  insightId: string;
  onClose: () => void;
  onRegenerate?: () => void;
  onSaved?: (data: Insight) => void;
}

// ── Type metadata ────────────────────────────────────────────────────────────

const TYPE_METADATA: Record<
  InsightPromptType,
  { icon: React.ReactNode; color: string; label: string; labelPl: string }
> = {
  summary: {
    icon: <FileText size={16} />,
    color: 'blue',
    label: 'Executive Summary',
    labelPl: 'Podsumowanie Wykonawcze',
  },
  general_analysis: {
    icon: <Compass size={16} />,
    color: 'muted',
    label: 'General Analysis',
    labelPl: 'Analiza Ogólna',
  },
  trends: {
    icon: <TrendingUp size={16} />,
    color: 'purple',
    label: 'Trend Analysis',
    labelPl: 'Analiza Trendów',
  },
  problems: {
    icon: <AlertTriangle size={16} />,
    color: 'red',
    label: 'Problem Discovery',
    labelPl: 'Odkrywanie Problemów',
  },
  recommendations: {
    icon: <Lightbulb size={16} />,
    color: 'amber',
    label: 'Recommendations',
    labelPl: 'Rekomendacje',
  },
  comparison: {
    icon: <BarChart3 size={16} />,
    color: 'cyan',
    label: 'Cross-Interview Comparison',
    labelPl: 'Porównanie Wywiadów',
  },
  gaps: {
    icon: <Target size={16} />,
    color: 'orange',
    label: 'Gap Analysis',
    labelPl: 'Analiza Luk',
  },
  risk_assessment: {
    icon: <AlertTriangle size={16} />,
    color: 'rose',
    label: 'Risk Assessment',
    labelPl: 'Ocena Ryzyk',
  },
  opportunity_scan: {
    icon: <Zap size={16} />,
    color: 'emerald',
    label: 'Opportunity Scan',
    labelPl: 'Skan Szans',
  },
  maturity: {
    icon: <Brain size={16} />,
    color: 'indigo',
    label: 'Maturity Assessment',
    labelPl: 'Ocena Dojrzałości',
  },
  stakeholder_map: {
    icon: <Users size={16} />,
    color: 'violet',
    label: 'Stakeholder Mapping',
    labelPl: 'Mapa Interesariuszy',
  },
  between_the_lines: {
    icon: <Brain size={16} />,
    color: 'rose',
    label: 'Between the Lines',
    labelPl: 'Czytanie Między Wierszami',
  },
};

const STATUS_CONFIG: Record<
  InsightStatus,
  { label: { en: string; pl: string }; color: string; textColor: string }
> = {
  generating: {
    label: { en: 'Generating', pl: 'Generowanie' },
    color: 'bg-amber-500',
    textColor: 'text-amber-500',
  },
  draft: {
    label: { en: 'Draft', pl: 'Szkic' },
    color: 'bg-c-text-muted',
    textColor: 'text-c-text-muted',
  },
  completed: {
    label: { en: 'Completed', pl: 'Ukończone' },
    color: 'bg-emerald-500',
    textColor: 'text-emerald-500',
  },
  in_review: {
    label: { en: 'In Review', pl: 'W recenzji' },
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
  },
  published: {
    label: { en: 'Published', pl: 'Opublikowane' },
    color: 'bg-sky-500',
    textColor: 'text-c-info',
  },
  failed: {
    label: { en: 'Failed', pl: 'Błąd' },
    color: 'bg-danger-500',
    textColor: 'text-danger-500',
  },
};

// D-A (2026-07-22) — tryb otwarcia karty: SZKIC/nowa → Edycja; artefakt
// gotowy / w recenzji / zatwierdzony → Podgląd (czysta prezentacja). Zwraca
// true dla stanów prezentacyjnych. Używa EFEKTYWNEGO statusu — reviewStatus ma
// pierwszeństwo nad statusem generacji (spójnie z `currentInsightStatus`).
function insightOpensInPreview(
  i: { status?: string; reviewStatus?: string } | null | undefined
): boolean {
  if (!i) return false;
  const eff =
    i.reviewStatus === 'in_review' || i.reviewStatus === 'published' ? i.reviewStatus : i.status;
  return eff === 'completed' || eff === 'in_review' || eff === 'published';
}

// Colored-pill visual map for the Properties Strip STATUS field (parity with
// Initiative). bg = soft tint, text = label color, dot = solid swatch.
const STATUS_PILL: Record<string, { bg: string; text: string; dot: string }> = {
  generating: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-600 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  draft: {
    bg: 'bg-c-surface-raised',
    text: 'text-c-text-secondary',
    dot: 'bg-c-text-muted',
  },
  completed: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-600 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  in_review: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-600 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  published: {
    bg: 'bg-teal-50 dark:bg-teal-900/20',
    text: 'text-teal-600 dark:text-teal-300',
    dot: 'bg-teal-500',
  },
  failed: {
    bg: 'bg-danger-50 dark:bg-danger-900/20',
    text: 'text-danger-600 dark:text-danger-300',
    dot: 'bg-danger-500',
  },
};

// ── N-mode section definitions (without component — assigned later) ──────────

// Section nav model (#22 / #23c).
//
// MERGES — content is preserved by composing the removed sections' rendered
// JSX into the surviving section's component (see `composedComponentById`
// inside `nModeSectionsWithContent`). Only the NAV entries are consolidated:
//   • material-quality  ← absorbs truth-review-summary  → "Quality & Trust"
//   • source-pack       ← absorbs source-sessions       → "Sources"
//   • candidate-triage  ← absorbs traceability          → "Findings & Evidence"
//   • full-analysis     — removed (covered by Consulting Readout / raw markdown
//                          stays reachable via Report Pack export)
//
// NEW analytical "between the lines" sections (#22c / #23d) derive purely from
// data already in scope (no new backend calls); each shows an informative
// empty-state until the underlying multi-respondent data exists.
// ── ROZSTRZYGNIĘCIE (właściciel, 2026-07-23, decyzja nr 2) ───────────────────
// Kafelki „Rozpocznij decyzję" / „Rozpocznij inicjatywę" (i reszta rodziny:
// raport, prezentacja, tabela, idea, notatka) BYŁY sekcją centrum
// `artifact-actions` (etykieta „Rezultaty"). Teraz mieszkają w PRAWYM PANELU,
// w sekcji Rezultaty na pozycji 5 (standard n-Type §7.2/§7.7 +
// 04_INSIGHT_BLEDY_I_ZMIANY §6.2/§6.3).
//
// Sekcja centrum ZNIKA — właściciel powiedział wprost: „Nie dubluj: jeśli kafel
// idzie do Rezultatów, znika z centrum". Wpis nawigacji usunięty stąd; JSX
// kafelków powstaje teraz w JEDNYM miejscu — `resultTilesNode` przy budowie
// prawego panelu (wariant `compact` pod szerokość panelu).
// `insightCardContract.ts` (flaga default OFF) zostaje NIETKNIĘTY — id żyje
// dalej w katalogu kanonicznym; `applyToSections` po prostu nie znajdzie dla
// niego sekcji, a picker „Sekcje ▾" chodzi po sekcjach, nie po katalogu, więc
// nie pokaże fantomu.
const INSIGHT_SECTIONS: Omit<NModeSection, 'component'>[] = [
  {
    id: 'executive-summary',
    icon: Star,
    label: { en: 'Executive Summary', pl: 'Podsumowanie' },
    cSpan: 2,
  },
  {
    id: 'consulting-readout',
    icon: Sparkles,
    label: { en: 'Consulting Readout', pl: 'Odczyt konsultingowy' },
    cSpan: 3,
  },
  { id: 'themes', icon: Layers, label: { en: 'Themes', pl: 'Tematy' } },
  {
    id: 'issues-risks',
    icon: ShieldAlert,
    label: { en: 'Issues & Risks', pl: 'Problemy i ryzyka' },
    quoteRequirementLevel: 'STRONG_ITEMS',
  },
  {
    id: 'opportunities',
    icon: TrendingUp,
    label: { en: 'Opportunity Spaces', pl: 'Przestrzenie szans' },
  },

  // ── Między wierszami / Between the lines ──────────────────────────────────
  { id: 'people', icon: Users, label: { en: 'People', pl: 'Perspektywy' }, cSpan: 2 },
  { id: 'signals', icon: Radio, label: { en: 'Signals', pl: 'Sygnały' } },
  {
    id: 'analysis-matrix',
    icon: BarChart3,
    label: { en: 'Analysis Matrix', pl: 'Macierz Analizy' },
    cSpan: 2,
  },
  {
    id: 'consensus-divergence',
    icon: GitCompare,
    label: { en: 'Consensus & Divergence', pl: 'Zgoda i rozbieżności' },
    cSpan: 2,
  },
  {
    id: 'implicit-assumptions',
    icon: Brain,
    label: { en: 'Implicit Assumptions', pl: 'Ukryte założenia' },
  },
  { id: 'silences', icon: EyeOff, label: { en: 'Silences', pl: 'Przemilczenia' } },
  {
    id: 'quote-comparison',
    icon: Quote,
    label: { en: 'Quote Comparison', pl: 'Porównanie cytatów' },
  },
  {
    id: 'sentiment-tone',
    icon: Heart,
    label: { en: 'Sentiment & Tone', pl: 'Sentyment i ton' },
  },
  { id: 'power-dynamics', icon: Scale, label: { en: 'Power Dynamics', pl: 'Dynamika władzy' } },
  {
    id: 'hypothesis-board',
    icon: Network,
    label: { en: 'Hypothesis Board', pl: 'Tablica hipotez' },
  },

  // ── Dowody / Evidence ─────────────────────────────────────────────────────
  {
    id: 'evidence-map',
    icon: MapIcon,
    label: { en: 'Evidence Map', pl: 'Mapa dowodów' },
    cSpan: 2,
    quoteRequirementLevel: 'STRONG_ITEMS',
  },
  {
    id: 'candidate-triage',
    icon: Eye,
    label: { en: 'Findings & Evidence', pl: 'Wnioski i dowody' },
    cSpan: 2,
  },
  {
    id: 'source-pack',
    icon: Link2,
    label: { en: 'Sources', pl: 'Źródła' },
  },

  // ── Dostarczane / Deliverables ────────────────────────────────────────────
  {
    id: 'report-pack',
    icon: FileText,
    label: { en: 'Report Pack', pl: 'Pakiet raportu' },
    cSpan: 3,
  },

  // ── Audyt / Audit ─────────────────────────────────────────────────────────
  {
    id: 'material-quality',
    icon: AlertCircle,
    label: { en: 'Quality & Trust', pl: 'Jakość i zaufanie' },
    cSpan: 2,
  },
  // TODO(#23c) WYKONANY 2026-07-21 (SPEC-N §2.1 — zarezerwowane identyfikatory):
  // `comments` i `activity-log` NIE MOGĄ być sekcją lewej kolumny — należą
  // wyłącznie do prawego panelu. Do dziś renderowały się DWA RAZY: pełny canvas
  // w centrum + skrót w panelu (§2.6 anty-duplikacja). Wpisy nav usunięte;
  // treść nie zginęła — CommentsCanvas przeniesiony w PEŁNEJ formie do sekcji
  // `comments` prawego panelu, aktywność do sekcji `history` (bez obcięcia).

  // ── Phase D: Canon sections → 23/23 ─────────────────────────────────────────
  {
    id: 'key-findings',
    icon: Star,
    label: { en: 'Key Findings', pl: 'Kluczowe wnioski' },
    quoteRequirementLevel: 'EACH_ITEM',
  },
  { id: 'recommendations', icon: Rocket, label: { en: 'Recommendations', pl: 'Rekomendacje' } },
  { id: 'tensions', icon: GitCompare, label: { en: 'Tensions', pl: 'Napięcia' } },
  { id: 'patterns', icon: Layers, label: { en: 'Patterns', pl: 'Wzorce' } },
  { id: 'mental-models', icon: Brain, label: { en: 'Mental Models', pl: 'Modele myślowe' } },
  { id: 'moments', icon: Quote, label: { en: 'Moments', pl: 'Momenty' } },
  {
    id: 'quote-bank',
    icon: Quote,
    label: { en: 'Quote Bank', pl: 'Bank cytatów' },
    cSpan: 2,
    quoteRequirementLevel: 'EACH_ITEM',
  },
  {
    id: 'stakeholder-map',
    icon: Users,
    label: { en: 'Stakeholder Map', pl: 'Mapa interesariuszy' },
    cSpan: 2,
  },
  {
    id: 'source-credibility',
    icon: Eye,
    label: { en: 'Source Credibility', pl: 'Wiarygodność źródeł' },
  },
  {
    id: 'consulting-narrative',
    icon: FileText,
    label: { en: 'Consulting Narrative', pl: 'Narracja konsultingowa' },
    cSpan: 3,
  },
  {
    id: 'executive-memo',
    icon: Sparkles,
    label: { en: 'Executive Memo', pl: 'Memo zarządcze' },
    cSpan: 2,
  },
];

// ── AI-draft affordance na kartach Insightu (wzorzec N §3.3) ────────────────
//
// Insight renderuje własne nagłówki sekcji (bespoke, przez NModeSectionWrapper),
// więc NIE możemy wpiąć całego `NModeCardState` (który dostarcza własny nagłówek).
// Zamiast tego dokładamy cienki pasek stanu karty POD nagłówkiem sekcji:
//   [badge stanu: AI-draft / Edytowane / Gotowe / Błąd]  ···  [✨Regeneruj ✎Edytuj ✓Zaakceptuj]
// Badge = `NModeCardBadge` (c-info/c-success/c-danger — NIGDY crimson); akcent AI
// (✨/regeneracja) = teal jak reszta kitu; fokus = c-focus. Wszystko theme-aware
// przez tokeny c-*. Pasek akcji jest ukryty w trybie Read/Present (readOnly).
interface InsightSectionCardHeaderProps {
  state: NModeCardStatus;
  isPolish: boolean;
  readOnly?: boolean;
  /** ✨ Regeneruj — odśwież tę sekcję z AI. */
  onRegenerate?: () => void;
  regenerating?: boolean;
  /** ✎ Edytuj — otwórz edycję (dla Insightu: czat z kontekstem sekcji). */
  onEdit?: () => void;
  /** ✓ Zaakceptuj — oznacz sekcję jako zatwierdzoną (toggle completion). */
  onAccept?: () => void;
}

const InsightSectionCardHeader: React.FC<InsightSectionCardHeaderProps> = ({
  state,
  isPolish,
  readOnly = false,
  onRegenerate,
  regenerating = false,
  onEdit,
  onAccept,
}) => {
  const { t } = useTranslation();
  // Pusta karta nie ma stanu do pokazania (empty badge = null) i nie ma treści
  // do regeneracji/akceptacji — pasek nic by nie wnosił.
  if (state === 'empty') return null;
  // Podgląd (readOnly): pasek nie ma już czego pokazać — akcje są schowane, a
  // badge stanu redakcyjnego („Szkic AI"/„Edytowane") to kuchnia, nie treść dla
  // klienta. Spójne z `hideBadge` w NModeCardState. Edycja bez zmian.
  if (readOnly) return null;

  const isDone = state === 'done';
  const actionBase =
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

  return (
    <div className="-mt-2 mb-2 flex items-center gap-2 flex-wrap">
      <NModeCardBadge status={state} isPolish={isPolish} />
      {!readOnly && (state === 'ai-draft' || state === 'edited' || state === 'done') && (
        <div className="flex items-center gap-1 ml-auto">
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating}
              title={t('interview.insightViewer.regenerateThisSectionWithAi')}
              className={`${actionBase} text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/25`}
            >
              {regenerating ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              {t('interview.insightViewer.regenerate')}
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              title={t('interview.insightViewer.editThisSection')}
              className={`${actionBase} text-c-text-secondary hover:bg-c-surface-raised`}
            >
              <Pencil size={12} />
              {t('interview.insightViewer.edit')}
            </button>
          )}
          {onAccept && (
            <button
              type="button"
              onClick={onAccept}
              title={
                isDone
                  ? t('interview.insightViewer.unAccept')
                  : t('interview.insightViewer.acceptThisSection')
              }
              className={`${actionBase} ${
                isDone
                  ? 'text-c-success'
                  : 'text-c-text-secondary hover:bg-c-success/10 hover:text-c-success'
              }`}
            >
              {isDone ? <CheckCircle2 size={12} /> : <Check size={12} />}
              {t('interview.insightViewer.accept')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Ręczna edycja treści sekcji (n-Type §6.2–6.4, właściciel 2026-07-23) ─────
//
// DECYZJA WŁAŚCICIELA: „każda sekcja Insightu dostaje pole do ręcznej edycji".
// Do dziś treść Insightu była read-only markdownem z AI, a „edycja" oznaczała
// otwarcie czatu (`onEdit={handleOpenChat}`) — czyli prośbę do modelu, nie
// edycję. Tu jest realne pole ze standardem: `AutoFitTextarea` (auto-fit,
// ręczny uchwyt z pamięcią wysokości, powrót do auto — §6.3), przycisk AI
// FIOLETOWY w prawym górnym rogu (§6.4, `AIFieldEnhancer` = propozycja +
// Zastosuj/Odrzuć, nigdy ciche nadpisanie) i `previewMode` pod trybem
// Edycja/Podgląd (§4.4 — w Podglądzie znikają uchwyt, AI i ramki edycyjne).
//
// ZAKRES ŚWIADOMIE WĄSKI (patrz raport, punkt „do decyzji"): pole NIE zastępuje
// bloku wygenerowanego przez AI — leży NAD nim jako redakcja konsultanta.
// Czy ręczna treść ma WYPIERAĆ treść AI w Podglądzie/eksporcie/PDF, to decyzja
// produktowa właściciela, a nie coś, co wolno domyślić kodem.
//
// Kolory: zero `primary-*` (crimson) — tokeny `c-*`, akcent AI z `AIFieldEnhancer`
// (`c-ai`, fiolet), fokus `c-focus`.
interface InsightSectionManualFieldProps {
  sectionId: string;
  sectionLabel: string;
  /** Wartość robocza (draft) — nie to samo co zapisane nadpisanie. */
  value: string;
  onValueChange: (value: string) => void;
  /** Zapis do backendu (blur / „Zapisz"). */
  onSave: () => void;
  /** Usunięcie nadpisania — sekcja wraca do czystej treści z AI. */
  onRevert: () => void;
  /** Czy na wniosku jest ZAPISANE nadpisanie tej sekcji. */
  hasOverride: boolean;
  saving: boolean;
  dirty: boolean;
  /** Tryb Podgląd (§4.4) — czytelnia, bez uchwytu/AI/ramek. */
  previewMode: boolean;
  isPolish: boolean;
  artifactTitle: string;
  artifactStatus?: string;
  savedAt?: string;
  /** Ref na textarea — „✎ Edytuj" w pasku karty ustawia tu fokus. */
  textareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
}

const InsightSectionManualField: React.FC<InsightSectionManualFieldProps> = ({
  sectionId,
  sectionLabel,
  value,
  onValueChange,
  onSave,
  onRevert,
  hasOverride,
  saving,
  dirty,
  previewMode,
  isPolish,
  artifactTitle,
  artifactStatus,
  savedAt,
  textareaRef,
}) => {
  const { t } = useTranslation();

  // Podgląd bez treści = nic do pokazania. Klientowi nie pokazujemy pustego
  // okienka „tu mogłaby być treść" (§4.4 — Podgląd jest czytelnią).
  if (previewMode && !value.trim()) return null;

  const savedLabel = (() => {
    if (saving) return t('interview.insightViewer.manualFieldSaving', 'Saving…');
    if (dirty) return t('interview.insightViewer.manualFieldUnsaved', 'Unsaved changes');
    if (!savedAt) return null;
    const d = new Date(savedAt);
    if (Number.isNaN(d.getTime())) return null;
    try {
      return `${t('interview.insightViewer.manualFieldSavedAt', 'Saved')} ${d.toLocaleString(
        isPolish ? 'pl-PL' : 'en-US',
        { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }
      )}`;
    } catch {
      return null;
    }
  })();

  return (
    // §4.4 — w Podglądzie ZNIKAJĄ ramki edycyjne. Zostaje sam tekst z etykietą
    // pola; obwódka i tło „pojemnika do pisania" należą do trybu Edycja.
    <div
      className={
        previewMode
          ? 'mb-4'
          : 'mb-4 rounded-2xl border border-c-border-subtle bg-c-surface-raised/40 p-3'
      }
    >
      <AutoFitTextarea
        value={value}
        onValueChange={onValueChange}
        onBlur={onSave}
        previewMode={previewMode}
        // Edycja rezerwuje miejsce do pisania (4 wiersze); Podgląd jest
        // czytelnią i nie ma powodu ciągnąć pustego prostokąta pod krótkim
        // akapitem — wysokość idzie wtedy czysto z treści.
        minRows={previewMode ? 1 : 4}
        containerClassName="space-y-1"
        label={
          <span className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary">
              {sectionLabel}
            </span>
            {!previewMode && (
              <span className="text-[11px] leading-snug text-c-text-muted">
                {t(
                  'interview.insightViewer.manualFieldHint',
                  'Text edited by hand. Stored separately from the AI content — regeneration does not erase it.'
                )}
              </span>
            )}
          </span>
        }
        aiSlot={
          <AIFieldEnhancer
            fieldKey={`insight-section-${sectionId}`}
            sectionLabel={sectionLabel}
            currentValue={value}
            onApply={onValueChange}
            artifactContext={{ title: artifactTitle, status: artifactStatus, type: 'insight' }}
          />
        }
        textareaRef={textareaRef}
        autoFitLabel={t('interview.insightViewer.manualFieldAutoFit', 'Back to auto-fit')}
        className="w-full rounded-xl bg-transparent px-3 py-2 text-sm leading-relaxed text-c-text placeholder-c-text-muted focus:outline-none"
        editClassName="border border-c-border-subtle focus:border-c-focus-solid focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] transition-colors"
        placeholder={t(
          'interview.insightViewer.manualFieldPlaceholder',
          'Write this section yourself, or correct what the AI produced…'
        )}
      />

      {!previewMode && (
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-[11px] text-c-text-muted">{savedLabel}</span>
          <div className="flex items-center gap-1.5">
            {hasOverride && (
              <button
                type="button"
                onClick={onRevert}
                disabled={saving}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                title={t(
                  'interview.insightViewer.manualFieldRevertHint',
                  'Remove the manual text — the section goes back to the AI content only.'
                )}
              >
                <RefreshCw size={12} />
                {t('interview.insightViewer.manualFieldRevert', 'Discard manual text')}
              </button>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !dirty}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface-raised px-2.5 text-[11px] font-medium text-c-text transition-colors hover:bg-c-surface disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {t('interview.insightViewer.manualFieldSave', 'Save section')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

// Phase E — id of the hidden, print-only container captured by the Report (PDF)
// export. Holds the canonical insight sections so the PDF is always complete
// regardless of which C-board section is currently active on screen.
const REPORT_PRINT_ELEMENT_ID = 'insight-report-print-root';

/**
 * Id pola widzianego przez „Analizuj z AI" jako ZAPISYWALNE — ręczna redakcja
 * aktywnej sekcji. Pola z generacji zostają read-only (brak endpointu zapisu),
 * więc to jedyny cel, dla którego „Zastosuj" ma prawo być aktywne.
 */
const INSIGHT_MANUAL_FIELD_ID = 'manual-section-text';

export const InsightViewer: React.FC<InsightViewerProps> = ({
  insightId,
  onClose,
  onRegenerate,
  onSaved,
}) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const { currentUser, currentOrganization, currentProjectId } = useAppStore();

  // ── REZULTATY tego wniosku (prawy panel, sekcja `results`) ─────────────────
  // Decyzja właściciela nr 2 (2026-07-23): kafelki tworzenia artefaktów zjechały
  // z centrum DO tej sekcji panelu (pozycja 5 wg §7.2) i w centrum ich już nie
  // ma (§2.6 — jedna funkcja, jedno miejsce). Pod kafelkami zostaje REJESTR
  // tego, co z tego wniosku JUŻ powstało — realne dane z
  // `GET /api/artifact-conversions?sourceArtifactType=interview_insight&sourceArtifactId=…`
  // (server/src/routes/artifact-conversions.routes.ts). Zero nowego backendu,
  // zero zmyślonych liczb: gdy zapytanie padnie, sekcja jest uczciwie pusta.
  const [producedResults, setProducedResults] = useState<ArtifactConversion[]>([]);

  useEffect(() => {
    let alive = true;
    if (!insightId) {
      setProducedResults([]);
      return;
    }
    (async () => {
      try {
        const res = await ConclusionsApi.listConversions({
          sourceArtifactType: 'interview_insight',
          sourceArtifactId: insightId,
        });
        if (!alive) return;
        setProducedResults(Array.isArray(res?.conversions) ? res.conversions : []);
      } catch {
        if (!alive) return;
        setProducedResults([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [insightId]);
  const setChatSystemPrompt = useAppStore((s) => s.setChatSystemPrompt);
  const setChatContextActions = useAppStore((s) => s.setChatContextActions);
  const openChatWithContext = useOpenChatWithContext();
  const interviewDemoData = useMemo(
    () =>
      createInterviewDemoDataset({
        currentUserId: currentUser?.id,
        currentUserName: currentUser?.displayName || (currentUser as any)?.name,
        currentUserEmail: currentUser?.email,
        organizationId: currentOrganization?.id,
        organizationName: currentOrganization?.name,
      }),
    [
      currentOrganization?.id,
      currentOrganization?.name,
      currentUser?.displayName,
      currentUser?.email,
      currentUser?.id,
      (currentUser as any)?.name,
    ]
  );

  // N-mode navigation
  const [activeNSection, setActiveNSection] = useState(INSIGHT_SECTIONS[0].id);
  const { mode: presentationMode, setMode: setPresentationMode } = usePresentationMode({
    entityType: 'insight',
  });

  // ETAP 1.1 n-Type: po zdjęciu przełącznika N/C z Menu 1 tryb 'c' nie ma już
  // wejścia ANI wyjścia — a `usePresentationMode` czyta go z `?view=c` i z
  // localStorage. Bez tego strażnika user, który kiedyś kliknął „C", zostaje w
  // nim na zawsze, bez kontrolki powrotu. Ten sam wzorzec ma już Task/Decision/
  // Notification (TaskDetailView ~758).
  useEffect(() => {
    if (presentationMode === 'c') {
      setPresentationMode('n');
    }
  }, [presentationMode, setPresentationMode]);

  // Core state
  const [insight, setInsight] = useState<Insight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // N-mode section order (drag-reorder persistence) — parity with
  // InitiativeDocumentView so both detail views share the same draggable sidebar.
  const nModeOrderStorageKey = `insight:nmode:section-order:v1:${insight?.id ?? 'new'}`;
  const [nModeSectionOrder, setNModeSectionOrder] = useState<string[] | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(nModeOrderStorageKey);
      if (!raw) {
        setNModeSectionOrder(null);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (id): id is string => typeof id === 'string' && id.length > 0
        );
        setNModeSectionOrder(cleaned.length > 0 ? cleaned : null);
      } else {
        setNModeSectionOrder(null);
      }
    } catch {
      setNModeSectionOrder(null);
    }
  }, [nModeOrderStorageKey]);

  const handleNModeSectionReorder = useCallback(
    (sectionIds: string[]) => {
      setNModeSectionOrder(sectionIds);
      try {
        localStorage.setItem(nModeOrderStorageKey, JSON.stringify(sectionIds));
      } catch (err) {
        // Ignore storage errors; drag-and-drop still works for this session.
        warnInsightSilentFailure(`persisting section order (${nModeOrderStorageKey}) failed`, err);
      }
    },
    [nModeOrderStorageKey]
  );

  // ── Card-management primitive (wzorzec N §3.5) ────────────────────────────
  // Referencyjne wpięcie `useCardLayout`: model { id, visible, order }[] dla kart
  // Insightu. Persystencja = localStorage (callback `onLayoutChange`), analogicznie
  // do `nModeSectionOrder`. Layout jest SSOT dla dodawania/usuwania/ukrywania kart;
  // istniejące `hiddenSectionIds` + `nModeSectionOrder` są z niego synchronizowane
  // niżej (minimalny blast-radius — reszta maszynerii bez zmian).
  // MIGRACJA (D-8): gdy włączony kontrakt, layout ma INNE znaczenie (węższy zestaw
  // domyślny — 10 kart), więc namespace klucza jest OSOBNY. Stary layout NIE hydratuje
  // się nad węższy default, a wyłączenie flagi wraca do 'v1' bez utraty.
  const insightCardContractEnabled = useInsightCardContractEnabled();
  const cardLayoutStorageKey = `insight:nmode:card-layout:${
    insightCardContractEnabled ? 'v2-contract' : 'v1'
  }:${insight?.id ?? 'new'}`;
  const initialCardLayout = useMemo<CardLayout | null>(() => {
    try {
      const raw = localStorage.getItem(cardLayoutStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      const cleaned = parsed.filter(
        (c: unknown): c is { id: string; visible: boolean; order: number } =>
          !!c &&
          typeof (c as { id?: unknown }).id === 'string' &&
          typeof (c as { visible?: unknown }).visible === 'boolean' &&
          typeof (c as { order?: unknown }).order === 'number'
      );
      return cleaned.length > 0 ? cleaned : null;
    } catch {
      return null;
    }
    // Hydrate once per insight id; layout state is owned by the hook afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardLayoutStorageKey]);

  const persistCardLayout = useCallback(
    (next: CardLayout) => {
      try {
        localStorage.setItem(cardLayoutStorageKey, JSON.stringify(next));
      } catch (err) {
        // Ignore storage errors; card management still works for this session.
        warnInsightSilentFailure(`persisting card layout (${cardLayoutStorageKey}) failed`, err);
      }
    },
    [cardLayoutStorageKey]
  );

  const cardLayout = useCardLayout({
    artifactType: 'insight',
    // MIGRACJA: flaga ON ⇒ katalog+zestawy z kontraktu kanonicznego (INSIGHT_CARD_SPEC —
    // stała moduł-const, stabilna referencja); OFF ⇒ undefined ⇒ useCardLayout czyta
    // DEFAULT_CARD_SETS['insight'] jak dotąd (pozostałe artefakty nietknięte).
    spec: insightCardContractEnabled ? INSIGHT_CARD_SPEC : undefined,
    initialLayout: initialCardLayout,
    onLayoutChange: persistCardLayout,
  });

  // R2/R4 (przepis §2/§4): dev-only sygnał rozjazdu render↔katalog. Każda sekcja
  // renderowana przez INSIGHT_SECTIONS ma być ZNANA kontraktowi; brak wpisu =
  // prawdziwa sierota (orphan). „Extras" = sekcje renderowane, których NIE ma w
  // SPEC.catalog → applyToSections doklejałby je zawsze-widoczne na koniec. Po
  // domknięciu zwężenia (Phase-D w katalogu jako `dodawalna`) extras MA być 0.
  useEffect(() => {
    if (!import.meta.env.DEV || !insightCardContractEnabled) return;
    const known = new Set(INSIGHT_CARD_RENDER_IDS);
    const orphans = INSIGHT_SECTIONS.map((s) => s.id).filter((id) => !known.has(id));
    if (orphans.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('[insightCardContract] sekcje renderowane bez wpisu w deskryptorze:', orphans);
    }
    const catalogIds = new Set(INSIGHT_CARD_SPEC.catalog.map((c) => c.id));
    const extras = INSIGHT_SECTIONS.map((s) => s.id).filter((id) => !catalogIds.has(id));
    // eslint-disable-next-line no-console
    console.info(
      `[insightCardContract] kontrakt ON — katalog ${INSIGHT_CARD_SPEC.catalog.length} kart, ` +
        `Phase-D w katalogu (dodawalne): ${INSIGHT_PHASE_D_RENDER_IDS.length}, ` +
        `renderowane poza katalogiem (extras): ${extras.length}`
    );
  }, [insightCardContractEnabled]);

  // Editable fields
  const [title, setTitle] = useState('');

  // AI generation states
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Export states
  const [isExportingTools, setIsExportingTools] = useState(false);
  const [isExportingAssessment, setIsExportingAssessment] = useState(false);
  const [isExportingNotebook, setIsExportingNotebook] = useState(false);

  // #25 — smart export generator (preview-pane dialog with section selection)
  type ExportTargetId =
    | 'note'
    | 'tools'
    | 'assessment'
    | 'markdown'
    | 'report'
    | 'deck'
    | 'table'
    | 'idea'
    | 'initiative';
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<ExportTargetId>('note');
  const [exportSelectedIds, setExportSelectedIds] = useState<Set<string>>(new Set());
  const [exportRunning, setExportRunning] = useState(false);

  // Tryb Read/Edit (§ menu 5A · „do pokazania klientowi"). Read = pasek akcji
  // kart (Regeneruj/Edytuj/Zaakceptuj) znika (przekazane jako `readOnly` do
  // InsightSectionCardHeader). Insight = raport AZ read-only w treści; jedyne
  // edytowalne afordancje to per-section action bar + edycja tytułu. Default =
  // Edit (readMode=false), żeby nie zmieniać dotychczasowego zachowania.
  const [readMode, setReadMode] = useState(false);

  // Phase A3 — fullscreen Present mode (read-only deck over canonical sections)
  const [presentOpen, setPresentOpen] = useState(false);

  // #26 toolbar — uniform outline dropdowns (Export ▾ / ✨ AI ▾)
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [sectionsMenuOpen, setSectionsMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const aiMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionsMenuRef = useRef<HTMLDivElement | null>(null);
  // Toolbar "≡ Sections ▾" visibility toggles (canon BLOCK_TYPES line 571).
  // Maps section id → hidden. Sections absent from the map are visible.
  // Local UI state only — drops hidden sections from the nav/canvas; no backend.
  const [hiddenSectionIds, setHiddenSectionIds] = useState<Set<string>>(new Set());

  // Sync the card-layout SSOT → existing hide/order machinery. Cards that are in
  // the layout but not `visible` (hidden OR removed from the visible set) drop out
  // of the nav/canvas; the visible order drives `nModeSectionOrder`. This lets the
  // new `useCardLayout` primitive + `+ Nowa karta` menu drive the same downstream
  // filtering the ad-hoc Sections dropdown already used, without a deep refactor.
  const cardLayoutVisibleIds = cardLayout.visibleOrderedIds;
  const cardLayoutAllIds = useMemo(() => cardLayout.layout.map((c) => c.id), [cardLayout.layout]);
  useEffect(() => {
    const hidden = new Set(cardLayoutAllIds.filter((id) => !cardLayoutVisibleIds.includes(id)));
    setHiddenSectionIds(hidden);
    setNModeSectionOrder(cardLayoutVisibleIds.length > 0 ? cardLayoutVisibleIds : null);
  }, [cardLayoutVisibleIds, cardLayoutAllIds]);

  // #26b — "Submit for Information" (no review/approval gate; just notifies)
  const [submittingForInfo, setSubmittingForInfo] = useState(false);

  // Handoff modal state
  const [handoffModalOpen, setHandoffModalOpen] = useState(false);
  const [handoffFinding, setHandoffFinding] = useState<{
    findingId?: string;
    title: string;
    description: string;
    confidence?: P10ConfidenceLevel;
    limits?: string[];
    sectionType: 'theme' | 'issue' | 'opportunity';
    index: number;
  } | null>(null);
  const [handoffSubmitting, setHandoffSubmitting] = useState(false);
  const handoffSubmitLockRef = useRef(false);
  // Link-to-existing picker: the org's initiatives, loaded when the handoff
  // modal opens. Without a real target_initiative_id the link mode submits a
  // bogus placeholder, so the "Link to existing" button stays disabled until
  // the user picks a concrete initiative here.
  const [handoffInitiatives, setHandoffInitiatives] = useState<
    Array<{ id: string; title: string; status?: string }>
  >([]);
  const [handoffInitiativesLoading, setHandoffInitiativesLoading] = useState(false);
  const [handoffTargetInitiativeId, setHandoffTargetInitiativeId] = useState('');
  // Insight-level "Propose initiatives" → opens the initiative generator (reconciles
  // AI/heuristic candidates from this insight against the live initiative grid).
  const [genOpen, setGenOpen] = useState(false);

  // Lifecycle transition state
  const [lifecycleTransitioning, setLifecycleTransitioning] = useState(false);

  // Limits expand state per card
  const [expandedLimits, setExpandedLimits] = useState<Set<string>>(new Set());

  // Related data
  const [sourceSessions, setSourceSessions] = useState<SourceSession[]>([]);
  const [sourceSessionSummaries, setSourceSessionSummaries] = useState<
    Record<string, SourceSessionSummary>
  >({});
  const [activityEntries, setActivityEntries] = useState<NModeActivityLogEntry[]>([]);
  const [findings, setFindings] = useState<V8InsightFinding[]>([]);
  const [candidates, setCandidates] = useState<V8InsightCandidate[]>([]);
  const [analysis, setAnalysis] = useState<V8InsightAnalysis | null>(null);
  const [sourcePack, setSourcePack] = useState<V8InsightSourcePack | null>(null);
  const [reportPack, setReportPack] = useState<V8InterviewReportPack | null>(null);
  const [reportReadiness, setReportReadiness] = useState<V8InterviewReportReadiness | null>(null);
  const [analysisLensMode, setAnalysisLensMode] = useState<'stakeholder' | 'session'>(
    'stakeholder'
  );
  const [analysisRoleFilter, setAnalysisRoleFilter] = useState('all');
  const [analysisDepartmentFilter, setAnalysisDepartmentFilter] = useState('all');
  const [candidateActionLoadingId, setCandidateActionLoadingId] = useState<string | null>(null);
  const [readbackLoadingId, setReadbackLoadingId] = useState<string | null>(null);
  const [worksheetActionLoadingKey, setWorksheetActionLoadingKey] = useState<string | null>(null);
  const [reportReviewSubmitting, setReportReviewSubmitting] = useState(false);
  const [reportPublishing, setReportPublishing] = useState(false);
  const [reportExporting, setReportExporting] = useState(false);
  const [reportMarkdownExporting, setReportMarkdownExporting] = useState(false);
  const [reportRevisionCreating, setReportRevisionCreating] = useState(false);

  // NMode shared section state — Comments
  const [nComments, setNComments] = useState<CommentItem[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentDateFilter, setCommentDateFilter] = useState<DateFilter>('all');
  const [commentSortOrder, setCommentSortOrder] = useState<SortOrder>('desc');
  const [draftPriority, setDraftPriority] = useState<CommentPriority>('normal');

  const loadPersistedFindings = useCallback(async (currentInsightId: string) => {
    try {
      const findingsRes = await V8InterviewApi.listFindings(currentInsightId)
        .then((r) => r.findings)
        .catch((err) => {
          warnInsightSilentFailure(`listFindings(${currentInsightId}) failed`, err);
          return [];
        });
      setFindings(Array.isArray(findingsRes) ? findingsRes : []);
    } catch (err) {
      warnInsightSilentFailure(`loadPersistedFindings(${currentInsightId}) failed`, err);
      setFindings([]);
    }
  }, []);

  const loadInsightAnalysis = useCallback(async (currentInsightId: string) => {
    try {
      const analysisRes = await V8InterviewApi.getAnalysis(currentInsightId)
        .then((r) => r.analysis)
        .catch((err) => {
          warnInsightSilentFailure(`getAnalysis(${currentInsightId}) failed`, err);
          return null;
        });
      setAnalysis(analysisRes || null);
    } catch (err) {
      warnInsightSilentFailure(`loadInsightAnalysis(${currentInsightId}) failed`, err);
      setAnalysis(null);
    }
  }, []);

  const loadCandidates = useCallback(async (currentInsightId: string) => {
    try {
      const candidatesRes = await V8InterviewApi.listCandidates(currentInsightId)
        .then((r) => r.candidates)
        .catch((err) => {
          warnInsightSilentFailure(`listCandidates(${currentInsightId}) failed`, err);
          return [];
        });
      setCandidates(Array.isArray(candidatesRes) ? candidatesRes : []);
    } catch (err) {
      warnInsightSilentFailure(`loadCandidates(${currentInsightId}) failed`, err);
      setCandidates([]);
    }
  }, []);

  const loadSourcePack = useCallback(async (currentInsightId: string) => {
    try {
      const sourcePackRes = await V8InterviewApi.getSourcePack(currentInsightId)
        .then((r) => r.sourcePack)
        .catch((err) => {
          warnInsightSilentFailure(`getSourcePack(${currentInsightId}) failed`, err);
          return null;
        });
      setSourcePack(sourcePackRes || null);
    } catch (err) {
      warnInsightSilentFailure(`loadSourcePack(${currentInsightId}) failed`, err);
      setSourcePack(null);
    }
  }, []);

  const loadReportPack = useCallback(async (currentInsightId: string) => {
    try {
      const reportPackRes = await V8InterviewApi.getInsightReportPack(currentInsightId)
        .then((r) => r.reportPack)
        .catch((err) => {
          warnInsightSilentFailure(`getInsightReportPack(${currentInsightId}) failed`, err);
          return null;
        });
      setReportPack(reportPackRes || null);
    } catch (err) {
      warnInsightSilentFailure(`loadReportPack(${currentInsightId}) failed`, err);
      setReportPack(null);
    }
  }, []);

  const loadReportReadiness = useCallback(async (currentInsightId: string) => {
    try {
      const readinessRes = await V8InterviewApi.getInsightReportReadiness(currentInsightId)
        .then((r) => r.readiness)
        .catch((err) => {
          warnInsightSilentFailure(`getInsightReportReadiness(${currentInsightId}) failed`, err);
          return null;
        });
      setReportReadiness(readinessRes || null);
    } catch (err) {
      warnInsightSilentFailure(`loadReportReadiness(${currentInsightId}) failed`, err);
      setReportReadiness(null);
    }
  }, []);

  const handleWorksheetStatusUpdate = useCallback(
    async (
      worksheetKey: string,
      status: V8InterviewReportWorksheetStatus,
      completenessScore: number,
      warnings: string[] = []
    ) => {
      if (!insight?.id) return;
      setWorksheetActionLoadingKey(`${worksheetKey}:${status}`);
      try {
        const response = await V8InterviewApi.updateInsightReportWorksheet(
          insight.id,
          worksheetKey,
          {
            status,
            completenessScore,
            warnings,
          }
        );
        setReportPack(response.reportPack);
        await loadReportReadiness(insight.id);
        toast.success(t('interview.insightViewer.reportWorksheetUpdated'));
      } catch (error) {
        console.error('[InsightViewer] Failed to update report worksheet:', error);
        toast.error(t('interview.insightViewer.failedToSaveWorksheetStatus'));
      } finally {
        setWorksheetActionLoadingKey(null);
      }
    },
    [insight?.id, isPolish, loadReportReadiness]
  );

  const handleSubmitReportForReview = useCallback(async () => {
    if (!insight?.id) return;
    setReportReviewSubmitting(true);
    try {
      const response = await V8InterviewApi.submitInsightReportForReview(insight.id);
      setReportPack(response.result.reportPack);
      setReportReadiness(response.result.readiness);
      if (response.result.blocked) {
        toast.error(t('interview.insightViewer.theReadinessGateBlocksReview'));
        return;
      }
      toast.success(
        response.result.alreadyInReview
          ? t('interview.insightViewer.reportPackIsAlreadyIn')
          : t('interview.insightViewer.reportPackSubmittedForReview')
      );
    } catch (error) {
      console.error('[InsightViewer] Failed to submit report pack for review:', error);
      toast.error(t('interview.insightViewer.failedToSubmitReportPack'));
    } finally {
      setReportReviewSubmitting(false);
    }
  }, [insight?.id, isPolish]);

  const handlePublishReportPack = useCallback(async () => {
    if (!insight?.id) return;
    setReportPublishing(true);
    try {
      const response = await V8InterviewApi.publishInsightReportPack(insight.id);
      setReportPack(response.result.reportPack);
      setReportReadiness(response.result.readiness);
      if (response.result.blocked) {
        toast.error(t('interview.insightViewer.thePublishGateBlocksReport'));
        return;
      }
      toast.success(
        response.result.alreadyPublished
          ? t('interview.insightViewer.reportPackIsAlreadyPublished')
          : t('interview.insightViewer.reportPackPublished')
      );
    } catch (error) {
      console.error('[InsightViewer] Failed to publish report pack:', error);
      toast.error(t('interview.insightViewer.failedToPublishReportPack'));
    } finally {
      setReportPublishing(false);
    }
  }, [insight?.id, isPolish]);

  const handleExportReportManifest = useCallback(async () => {
    if (!insight?.id) return;
    setReportExporting(true);
    try {
      const response = await V8InterviewApi.getInsightReportExportManifest(insight.id);
      const payload = JSON.stringify(response.exportManifest, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${response.exportManifest.reportPackId}-manifest.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('interview.insightViewer.reportManifestDownloaded'));
    } catch (error) {
      console.error('[InsightViewer] Failed to export report manifest:', error);
      toast.error(t('interview.insightViewer.failedToDownloadManifestThe'));
    } finally {
      setReportExporting(false);
    }
  }, [insight?.id, isPolish]);

  const handleExportReportMarkdown = useCallback(async () => {
    if (!insight?.id) return;
    setReportMarkdownExporting(true);
    try {
      const response = await V8InterviewApi.getInsightReportMarkdownExport(insight.id);
      const blob = new Blob([response.markdownExport.markdown], { type: 'text/markdown' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.markdownExport.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('interview.insightViewer.markdownReportDownloaded'));
    } catch (error) {
      console.error('[InsightViewer] Failed to export report markdown:', error);
      toast.error(t('interview.insightViewer.failedToDownloadMarkdownReport'));
    } finally {
      setReportMarkdownExporting(false);
    }
  }, [insight?.id, isPolish]);

  const handleCreateReportRevision = useCallback(async () => {
    if (!insight?.id) return;
    setReportRevisionCreating(true);
    try {
      const response = await V8InterviewApi.createInsightReportRevision(insight.id);
      setReportPack(response.result.reportPack);
      await loadReportReadiness(insight.id);
      toast.success(
        t('interview.insightViewer.newDraftFromVersion', {
          version: response.result.revision.version,
        })
      );
    } catch (error) {
      console.error('[InsightViewer] Failed to create report pack revision:', error);
      toast.error(t('interview.insightViewer.failedToCreateANew'));
    } finally {
      setReportRevisionCreating(false);
    }
  }, [insight?.id, isPolish, loadReportReadiness]);

  // ── Load data ──────────────────────────────────────────────────────────────

  // #26 — close toolbar dropdowns on outside click / Escape (repo pattern)
  useEffect(() => {
    if (!exportMenuOpen && !aiMenuOpen && !sectionsMenuOpen) return;
    const handlePointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (exportMenuOpen && exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setExportMenuOpen(false);
      }
      if (aiMenuOpen && aiMenuRef.current && !aiMenuRef.current.contains(target)) {
        setAiMenuOpen(false);
      }
      if (
        sectionsMenuOpen &&
        sectionsMenuRef.current &&
        !sectionsMenuRef.current.contains(target)
      ) {
        setSectionsMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExportMenuOpen(false);
        setAiMenuOpen(false);
        setSectionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [exportMenuOpen, aiMenuOpen, sectionsMenuOpen]);

  useEffect(() => {
    const loadInsight = async () => {
      const applyDemoInsight = (id: string) => {
        const demoInsight = interviewDemoData.insightDetailsById[id];
        if (!demoInsight) return false;

        setInsight(demoInsight as Insight);
        setTitle(demoInsight.title || '');
        // D-A: gotowy/w recenzji/zatwierdzony → Podgląd; szkic/nowy → Edycja.
        setReadMode(insightOpensInPreview(demoInsight as Insight));
        const demoSessions = demoInsight.sourceSessionIds
          .map((sessionId: string) => interviewDemoData.sessionDetailsById[sessionId]?.session)
          .filter(Boolean);
        setSourceSessions(demoSessions as SourceSession[]);
        setSourceSessionSummaries(
          demoInsight.sourceSessionIds.reduce<Record<string, SourceSessionSummary>>(
            (acc, sessionId) => {
              acc[sessionId] =
                (interviewDemoData.sessionDetailsById[sessionId]
                  ?.summary as SourceSessionSummary) || DEFAULT_SESSION_SUMMARY;
              return acc;
            },
            {}
          )
        );
        setActivityEntries(
          (interviewDemoData.insightActivityById[id] || []) as NModeActivityLogEntry[]
        );
        setNComments((interviewDemoData.insightCommentsById[id] || []) as CommentItem[]);
        setFindings([]);
        setCandidates([]);
        setAnalysis(null);
        setSourcePack(null);
        setReportPack(null);
        return true;
      };

      setIsLoading(true);
      setError(null);
      try {
        if (isInterviewDemoId(insightId) && applyDemoInsight(insightId)) return;

        const data = await V8InterviewApi.getInsight(insightId)
          .then((r) => r.insight)
          .catch(() => Api.get(`/interview/insights/${insightId}`).catch(() => null));
        if (!data) {
          if (applyDemoInsight(insightId)) return;
          throw new Error('Failed to load insight');
        }
        setInsight(data);
        setTitle(data.title || '');
        // D-A: gotowy/w recenzji/zatwierdzony → Podgląd; szkic/nowy → Edycja.
        setReadMode(insightOpensInPreview(data));
        await loadPersistedFindings(insightId);
        await loadCandidates(insightId);
        await loadInsightAnalysis(insightId);
        await loadSourcePack(insightId);
        await loadReportPack(insightId);
        await loadReportReadiness(insightId);

        if (data.sourceSessionIds?.length > 0) {
          try {
            const sessionsData = await Promise.all(
              data.sourceSessionIds.slice(0, 10).map((id: string) =>
                V8InterviewApi.getSession(id)
                  .then((r) => r.session)
                  .catch(() =>
                    Api.get(`/interview/sessions/${id}`).catch((err) => {
                      warnInsightSilentFailure(`getSession(${id}) failed (source session)`, err);
                      return null;
                    })
                  )
              )
            );
            // Dedup po id — powiązania nie mogą renderować dwóch wpisów o tym
            // samym kluczu (React „same key") ani duplikować sesji źródłowej,
            // gdy sourceSessionIds/getSession zwrócą powtórzone id.
            const validSessions = Array.from(
              new Map(
                (sessionsData || [])
                  .filter(Boolean)
                  .map((session: SourceSession) => [session.id, session])
              ).values()
            );
            setSourceSessions(validSessions);

            const summaryEntries = await Promise.all(
              validSessions.map(async (session: SourceSession) => {
                const summary = await V8InterviewApi.getSessionSummary(session.id).catch(() =>
                  Api.get(`/interview/sessions/${session.id}/summary`).catch((err) => {
                    warnInsightSilentFailure(`getSessionSummary(${session.id}) failed`, err);
                    return null;
                  })
                );
                return [session.id, summary] as const;
              })
            );

            setSourceSessionSummaries(
              summaryEntries.reduce<Record<string, SourceSessionSummary>>(
                (acc, [sessionId, summary]) => {
                  acc[sessionId] = summary
                    ? {
                        facts: toTextList(summary.facts),
                        gaps: toTextList(summary.gaps),
                        constraints: toTextList(summary.constraints),
                        painPoints: toTextList(summary.painPoints),
                      }
                    : DEFAULT_SESSION_SUMMARY;
                  return acc;
                },
                {}
              )
            );
          } catch (err) {
            // Sesje źródłowe są opcjonalne dla UI (fail-soft), ale awaria musi
            // być widoczna w konsoli — inaczej pusty blok „Sesje" wygląda jak
            // brak danych, a nie jak padnięty backend.
            warnInsightSilentFailure(
              `loading source sessions/summaries for insight ${insightId} failed`,
              err
            );
          }
        } else {
          setSourceSessions([]);
          setSourceSessionSummaries({});
        }

        const [activityRes, commentsRes] = await Promise.all([
          V8InterviewApi.getInsightActivity(insightId)
            .then((r) => r.activity)
            .catch(() =>
              Api.get(`/interview/insights/${insightId}/activity`).catch((err) => {
                warnInsightSilentFailure(`getInsightActivity(${insightId}) failed`, err);
                return [];
              })
            ),
          V8InterviewApi.getInsightComments(insightId)
            .then((r) => r.comments)
            .catch(() =>
              Api.get(`/interview/insights/${insightId}/comments`).catch((err) => {
                warnInsightSilentFailure(`getInsightComments(${insightId}) failed`, err);
                return [];
              })
            ),
        ]);
        setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
        setNComments(Array.isArray(commentsRes) ? commentsRes : []);
      } catch (err: any) {
        if (applyDemoInsight(insightId)) return;
        setError(err?.message || 'Failed to load insight');
        console.error('[InsightViewer] Failed to load insight:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInsight();

    let lastStatus: InsightStatus | null = null;
    let consecutiveFailures = 0;
    let degradedNotified = false;
    const MAX_TICKS = 25; // ~75s at 3s interval
    let ticks = 0;
    const interval = setInterval(async () => {
      try {
        // Avoid background polling bursts (helps with 429 + browser instability).
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        if (isInterviewDemoId(insightId)) {
          clearInterval(interval);
          return;
        }
        const data = await V8InterviewApi.getInsight(insightId)
          .then((r) => r.insight)
          .catch(() => Api.get(`/interview/insights/${insightId}`));
        setInsight(data);
        const nextStatus = data?.status as InsightStatus | undefined;
        if (lastStatus === null) lastStatus = nextStatus ?? null;

        const isGenerating = nextStatus === 'generating';
        const generationJustFinished =
          lastStatus === 'generating' && nextStatus && nextStatus !== 'generating';

        // Heavy refresh only while generating (or once immediately after generation finishes).
        if (isGenerating || generationJustFinished) {
          await loadPersistedFindings(insightId);
          await loadCandidates(insightId);
          await loadInsightAnalysis(insightId);
          await loadSourcePack(insightId);
          await loadReportPack(insightId);
          await loadReportReadiness(insightId);
        }

        if (lastStatus === 'generating' && nextStatus && nextStatus !== 'generating') {
          clearInterval(interval);
          const activityRes = await V8InterviewApi.getInsightActivity(insightId)
            .then((r) => r.activity)
            .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
          setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
        }

        lastStatus = nextStatus ?? null;
        consecutiveFailures = 0;
        ticks += 1;

        // Stop polling once stable or after a safety budget.
        if (!isGenerating || ticks >= MAX_TICKS) {
          clearInterval(interval);
        }
      } catch (err: any) {
        consecutiveFailures += 1;
        const directStatus = Number(err?.status);
        const nestedStatus = Number(err?.response?.status);
        const status =
          Number.isFinite(directStatus) && directStatus > 0 ? directStatus : nestedStatus;

        // If auth is missing/invalid or we're being rate-limited, stop polling loop.
        if (status === 401 || status === 403 || status === 429) {
          clearInterval(interval);
          if (!degradedNotified) {
            degradedNotified = true;
            toast.error(
              status === 429
                ? t('interview.insightViewer.temporarilyRateLimited429Auto')
                : t('interview.insightViewer.sessionExpiredOrUnauthorizedAuto')
            );
          }
          return;
        }

        // Give up after repeated transient failures to avoid amplifying infra issues.
        if (consecutiveFailures >= 5) {
          clearInterval(interval);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [
    insightId,
    interviewDemoData,
    isPolish,
    loadCandidates,
    loadInsightAnalysis,
    loadSourcePack,
    loadReportPack,
    loadReportReadiness,
    loadPersistedFindings,
  ]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const typeMeta = insight
    ? TYPE_METADATA[insight.promptType] || TYPE_METADATA.summary
    : TYPE_METADATA.summary;

  const parsedInsightSections = useMemo(
    () => parseInsightContent(insight?.content),
    [insight?.content]
  );

  // Whole-artifact plain-text summary for the AI Consultant panel: title +
  // each section's heading & body in canonical order. Reuses the existing
  // markdown section parser (`parsedInsightSections`) and falls back to the
  // raw markdown content. No new backend.
  const aiContextText = useMemo(() => {
    if (!insight) return '';
    const titleLine = insight.title ? `# ${insight.title}` : '';
    const sectionText = parsedInsightSections
      .map((s) => {
        const heading = s.heading ? `## ${s.heading}` : '';
        const body = (s.body || '').trim();
        return [heading, body].filter(Boolean).join('\n');
      })
      .filter(Boolean)
      .join('\n\n');
    const composed = [titleLine, sectionText].filter(Boolean).join('\n\n').trim();
    return composed || (insight.content || '').trim();
  }, [insight, parsedInsightSections]);

  const executiveSummary = useMemo(() => {
    if (!insight?.content) return '';
    const firstParagraph = insight.content
      .split('\n\n')
      .map((part) => stripMarkdownPreview(part))
      .find(Boolean);
    return firstParagraph || '';
  }, [insight?.content]);

  const officialAnswers = useMemo(
    () =>
      uniqueNonEmpty(
        sourceSessions.flatMap((session) => sourceSessionSummaries[session.id]?.facts || [])
      ).slice(0, 10),
    [sourceSessionSummaries, sourceSessions]
  );

  const issuesReadout = useMemo(() => {
    const fromSummaries = sourceSessions.flatMap((session) => {
      const summary = sourceSessionSummaries[session.id] || DEFAULT_SESSION_SUMMARY;
      return [...summary.constraints, ...summary.painPoints, ...summary.gaps];
    });
    const fromNarrative = parsedInsightSections
      .filter((section) =>
        /(issue|problem|risk|gap|constraint|challenge|pain|blocker|critical)/i.test(section.heading)
      )
      .flatMap((section) => [...section.bullets, ...section.paragraphs]);

    return uniqueNonEmpty([...fromSummaries, ...fromNarrative])
      .map(stripMarkdownPreview)
      .filter(Boolean)
      .filter((item) => (item.match(/·/g) || []).length < 3)
      .slice(0, 10);
  }, [parsedInsightSections, sourceSessionSummaries, sourceSessions]);

  const opportunityReadout = useMemo(() => {
    const fromNarrative = parsedInsightSections
      .filter((section) =>
        /(opportunit|strength|theme|trend|alignment|growth|efficiency|innovation|maturity)/i.test(
          section.heading
        )
      )
      .flatMap((section) => [...section.bullets, ...section.paragraphs]);

    return uniqueNonEmpty(fromNarrative).map(stripMarkdownPreview).filter(Boolean).slice(0, 10);
  }, [parsedInsightSections]);

  const hiddenSignals = useMemo(() => {
    const fromNarrative = parsedInsightSections
      .filter((section) =>
        /(observation|between|pattern|divergent|root cause|implication|underlying|signal)/i.test(
          section.heading
        )
      )
      .flatMap((section) => [...section.bullets, ...section.paragraphs]);

    return uniqueNonEmpty(fromNarrative).map(stripMarkdownPreview).filter(Boolean).slice(0, 8);
  }, [parsedInsightSections]);

  const evidenceQuotes = useMemo(
    () =>
      extractQuotedLines(insight?.content).map(stripMarkdownPreview).filter(Boolean).slice(0, 6),
    [insight?.content]
  );

  const traceabilityRows = useMemo(
    () =>
      sourceSessions.map((session) => ({
        session,
        summary: sourceSessionSummaries[session.id] || DEFAULT_SESSION_SUMMARY,
      })),
    [sourceSessionSummaries, sourceSessions]
  );

  // V6 three-layer structured data
  const v6Themes = useMemo<InsightTheme[]>(() => insight?.themes ?? [], [insight?.themes]);
  const v6Issues = useMemo<InsightIssue[]>(() => insight?.issues ?? [], [insight?.issues]);
  const v6Opportunities = useMemo<InsightOpportunity[]>(
    () => insight?.opportunities ?? [],
    [insight?.opportunities]
  );
  const v6Signals = useMemo<InsightSignal[]>(() => insight?.signals ?? [], [insight?.signals]);
  const v6EvidenceMap = useMemo<InsightEvidenceMapEntry[]>(
    () => insight?.evidenceMap ?? [],
    [insight?.evidenceMap]
  );

  // #57 "dramat pustych kart" — some insights (mostly seed/imported rows created
  // directly in the DB, bypassing the create() → generateInsight() pipeline) sit
  // at status 'completed' with narrative `content` but no themes/issues/
  // opportunities/signals/evidenceMap ever written. The V6 section cards below
  // only read the structured fields, so those rows show a dead-end "will appear
  // after V6 analysis" placeholder forever — nothing ever triggers generation.
  // The backend materialization pipeline (InterviewInsightService.generateInsight)
  // already exists and is already wired to `handleRegenerate` (used by the
  // section card headers). Give the empty state itself a working CTA into that
  // same, existing pipeline instead of a dead end. Gate to status 'completed'
  // (not already generating/failed) and exclude demo-mock insights (no backing
  // DB row to regenerate).
  const canRegenerateV6 =
    insight?.status === 'completed' && !isRegenerating && !isInterviewDemoId(insightId);

  const materialQuality = useMemo<V8InsightMaterialQuality | null>(() => {
    if (insight?.materialQuality) {
      // Backend can return a partial material_quality (older rows, imported/seeded
      // insights). The panel below calls .length/.map/.join on these array fields,
      // so coalesce every one to [] — a missing field must not white-screen the view.
      const mq = insight.materialQuality;
      // Authored/imported insights may store these as a single string (or under
      // alternate keys: score/posture/coverage). Normalize to the shapes the
      // panel renders — every list field must be a real array.
      const toArr = (v: unknown): string[] =>
        Array.isArray(v)
          ? v.map(String)
          : typeof v === 'string' && v.trim()
            ? v
                .split(/\s*[;,•·]\s*|\s\+\s/)
                .map((s) => s.trim())
                .filter(Boolean)
            : [];
      const alt = mq as unknown as Record<string, unknown>;
      return {
        ...mq,
        overall_material_score:
          mq.overall_material_score ??
          (typeof alt.score === 'number'
            ? Math.max(0, Math.min(100, Math.round((alt.score as number) * 20)))
            : 0),
        answer_quality_posture:
          mq.answer_quality_posture ?? (typeof alt.posture === 'string' ? alt.posture : 'usable'),
        coverage_posture:
          mq.coverage_posture ??
          (typeof alt.coverage === 'string' ? alt.coverage : 'partial_coverage'),
        approved_session_count: mq.approved_session_count ?? 0,
        respondent_count: mq.respondent_count ?? 0,
        thin_answer_count: mq.thin_answer_count ?? 0,
        evidence_gap_count: mq.evidence_gap_count ?? 0,
        contradiction_count: mq.contradiction_count ?? 0,
        role_coverage: toArr(mq.role_coverage),
        department_coverage: toArr(mq.department_coverage),
        missing_voices: toArr(mq.missing_voices),
        limitations: toArr(mq.limitations),
        recommended_followups: toArr(mq.recommended_followups),
      };
    }
    if (!insight || insight.status === 'generating') return null;
    return {
      overall_material_score: Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (insight.sourceSessionIds?.length || 0) * 12 +
              Math.min(v6EvidenceMap.length, 12) * 4 -
              (insight.missingData?.length || 0) * 5
          )
        )
      ),
      answer_quality_posture:
        v6EvidenceMap.length >= 10 ? 'strong' : v6EvidenceMap.length >= 4 ? 'usable' : 'thin',
      coverage_posture:
        (insight.sourceSessionIds?.length || 0) <= 1
          ? 'single_perspective'
          : (insight.sourceSessionIds?.length || 0) >= 4
            ? 'good_coverage'
            : 'partial_coverage',
      approved_session_count: insight.sourceSessionIds?.length || 0,
      respondent_count: insight.sourceSessionIds?.length || 0,
      role_coverage: [],
      department_coverage: [],
      thin_answer_count: 0,
      missing_voices: [],
      evidence_gap_count: insight.missingData?.length || 0,
      contradiction_count: v6Signals.filter((signal) => signal.type === 'contradiction').length,
      limitations: insight.missingData || [],
      recommended_followups: [],
    };
  }, [insight, v6EvidenceMap.length, v6Signals]);
  const sourcePackByAnswerId = useMemo(
    () =>
      (sourcePack?.entries || []).reduce<Record<string, V8InsightSourcePack['entries'][number]>>(
        (acc, entry) => {
          if (entry.answerId) acc[entry.answerId] = entry;
          return acc;
        },
        {}
      ),
    [sourcePack?.entries]
  );
  const v6MissingData = useMemo<string[]>(() => insight?.missingData ?? [], [insight?.missingData]);
  const findingsBySourceKey = useMemo(
    () =>
      findings.reduce<Record<string, V8InsightFinding>>((acc, finding) => {
        if (finding.source_key) acc[finding.source_key] = finding;
        return acc;
      }, {}),
    [findings]
  );
  const findingsSummary = useMemo(
    () => ({
      total: findings.length,
      activeEvidence: findings.reduce(
        (sum, finding) =>
          sum + finding.evidence_pointers.filter((pointer) => !pointer.isTombstone).length,
        0
      ),
      pendingReview: findings.filter((finding) => finding.review_status === 'in_review').length,
      contradicted: findings.filter((finding) => finding.confidence_level === 'contradicted')
        .length,
    }),
    [findings]
  );

  /**
   * ── JEDNO ŹRÓDŁO LICZNIKÓW (R2/defekt #3, 2026-07-23) ──────────────────────
   *
   * Ta sama metryka miała na JEDNYM ekranie trzy różne wartości, bo trzy
   * miejsca liczyły ją z trzech różnych tablic:
   *   · kafle „Podsumowania"  → `issuesReadout` / `hiddenSignals` /
   *     `opportunityReadout` — HEURYSTYKA z narracji (regexp po nagłówkach
   *     sekcji + bullety), obcinana do 10/8/10 pozycji,
   *   · plakietki nawigacji    → `v6Issues` / `v6Opportunities` / `v6Signals`
   *     — STRUKTURA V6 z bazy,
   *   · widoczność sekcji      → jeszcze inny zestaw (`definiteCounts`).
   * Efekt: „ISSUES/RISKS 10" obok „Problemy i ryzyka 5".
   *
   * Rozwiązanie nie polega na poprawieniu liczb, tylko na usunięciu
   * możliwości rozjazdu: KAŻDY licznik wychodzi teraz stąd. Struktura V6 jest
   * źródłem prawdy; heurystyka z narracji wchodzi wyłącznie jako awaryjny
   * fallback dla wniosków zaimportowanych/zaseedowanych, które nigdy nie
   * przeszły materializacji V6 (patrz #57 niżej) — i wtedy obowiązuje
   * jednakowo w kaflach, w nawigacji i w bramce widoczności.
   */
  const insightCounts = useMemo(
    () => ({
      themes: v6Themes.length,
      issues: v6Issues.length > 0 ? v6Issues.length : issuesReadout.length,
      opportunities:
        v6Opportunities.length > 0 ? v6Opportunities.length : opportunityReadout.length,
      signals: v6Signals.length > 0 ? v6Signals.length : hiddenSignals.length,
      evidence: v6EvidenceMap.length,
      officialAnswers: officialAnswers.length,
    }),
    [
      v6Themes.length,
      v6Issues.length,
      v6Opportunities.length,
      v6Signals.length,
      v6EvidenceMap.length,
      issuesReadout.length,
      opportunityReadout.length,
      hiddenSignals.length,
      officialAnswers.length,
    ]
  );

  const candidateSummary = useMemo(
    () => ({
      total: candidates.length,
      ready: candidates.filter((candidate) => candidate.triage_status === 'ready_for_review')
        .length,
      needsEvidence: candidates.filter((candidate) => candidate.triage_status === 'needs_evidence')
        .length,
      needsSplit: candidates.filter((candidate) => candidate.triage_status === 'needs_split')
        .length,
      promoted: candidates.filter((candidate) => candidate.triage_status === 'promoted').length,
    }),
    [candidates]
  );

  const readbackSummary = useMemo(
    () => ({
      confirmed: findings.filter((finding) => finding.readback_status === 'confirmed_by_client')
        .length,
      challenged: findings.filter((finding) => finding.readback_status === 'challenged_by_client')
        .length,
      needsMoreEvidence: findings.filter(
        (finding) => finding.readback_status === 'needs_more_evidence'
      ).length,
      unresolved: findings.filter(
        (finding) =>
          finding.readback_status !== 'confirmed_by_client' &&
          finding.readback_status !== 'partially_confirmed'
      ).length,
    }),
    [findings]
  );

  const truthReviewSummary = useMemo(() => {
    const contradictionSignals = v6Signals.filter((signal) => signal.type === 'contradiction');
    const publishBlockers = uniqueNonEmpty([
      ...(findingsSummary.total === 0
        ? [t('interview.insightViewer.noPersistedP10FindingsAre')]
        : []),
      ...(findingsSummary.activeEvidence === 0
        ? [t('interview.insightViewer.noActiveEvidencePointersAre')]
        : []),
      ...(candidateSummary.needsEvidence > 0
        ? [
            t('interview.insightViewer.candidatesNeedEvidence', {
              count: candidateSummary.needsEvidence,
            }),
          ]
        : []),
      ...(candidateSummary.needsSplit > 0
        ? [t('interview.insightViewer.candidatesNeedSplit', { count: candidateSummary.needsSplit })]
        : []),
      ...(readbackSummary.unresolved > 0
        ? [
            t('interview.insightViewer.findingsUnresolvedReadback', {
              count: readbackSummary.unresolved,
            }),
          ]
        : []),
      ...(readbackSummary.challenged > 0
        ? [
            t('interview.insightViewer.findingsChallengedReadback', {
              count: readbackSummary.challenged,
            }),
          ]
        : []),
    ]);

    const safeClaims = findings
      .filter(
        (finding) =>
          finding.confidence_level !== 'contradicted' &&
          finding.evidence_pointers.some((pointer) => !pointer.isTombstone)
      )
      .slice(0, 4);

    const posture: 'ready' | 'review_needed' | 'weak' =
      publishBlockers.length === 0
        ? 'ready'
        : findingsSummary.activeEvidence > 0 || candidateSummary.ready > 0
          ? 'review_needed'
          : 'weak';

    return {
      contradictionSignals,
      publishBlockers,
      safeClaims,
      posture,
    };
  }, [
    candidateSummary.needsEvidence,
    candidateSummary.needsSplit,
    candidateSummary.ready,
    findings,
    findingsSummary.activeEvidence,
    findingsSummary.total,
    isPolish,
    readbackSummary.challenged,
    readbackSummary.unresolved,
    v6Signals,
    /* + t: tlumaczenia ladowane async — bez tego memo zwraca surowy klucz na stale (2026-07-21) */ t,
  ]);

  const analysisTopicsById = useMemo(
    () =>
      (analysis?.topics || []).reduce<Record<string, V8InsightAnalysis['topics'][number]>>(
        (acc, topic) => {
          acc[topic.id] = topic;
          return acc;
        },
        {}
      ),
    [analysis]
  );

  const consensusTopics = useMemo(
    () =>
      (analysis?.synthesis.consensusTopicIds || [])
        .map((id) => analysisTopicsById[id])
        .filter(Boolean),
    [analysis?.synthesis.consensusTopicIds, analysisTopicsById]
  );

  const localOnlyTopics = useMemo(
    () =>
      (analysis?.synthesis.localOnlyTopicIds || [])
        .map((id) => analysisTopicsById[id])
        .filter(Boolean),
    [analysis?.synthesis.localOnlyTopicIds, analysisTopicsById]
  );

  const contradictedTopics = useMemo(
    () =>
      (analysis?.synthesis.contradictedTopicIds || [])
        .map((id) => analysisTopicsById[id])
        .filter(Boolean),
    [analysis?.synthesis.contradictedTopicIds, analysisTopicsById]
  );

  const stakeholderMatrixCellMap = useMemo(
    () =>
      new Map(
        (analysis?.matrix.stakeholderCells || []).map(
          (cell) => [`${cell.topicId}:${cell.lensId}`, cell] as const
        )
      ),
    [analysis?.matrix.stakeholderCells]
  );

  const sessionMatrixCellMap = useMemo(
    () =>
      new Map(
        (analysis?.matrix.sessionCells || []).map(
          (cell) => [`${cell.topicId}:${cell.lensId}`, cell] as const
        )
      ),
    [analysis?.matrix.sessionCells]
  );

  const analysisRoleOptions = useMemo(
    () =>
      uniqueNonEmpty([
        ...(analysis?.people.sessionLenses || []).map((lens) => lens.role),
        ...(analysis?.people.stakeholderLenses || []).map((lens) => lens.role),
      ]),
    [analysis]
  );

  const analysisDepartmentOptions = useMemo(
    () =>
      uniqueNonEmpty([
        ...(analysis?.people.sessionLenses || []).map((lens) => lens.department),
        ...(analysis?.people.stakeholderLenses || []).map((lens) => lens.department),
      ]),
    [analysis]
  );

  const filteredSessionAnalysisLenses = useMemo(
    () =>
      (analysis?.people.sessionLenses || []).filter((lens) => {
        if (analysisRoleFilter !== 'all' && lens.role !== analysisRoleFilter) return false;
        if (analysisDepartmentFilter !== 'all' && lens.department !== analysisDepartmentFilter)
          return false;
        return true;
      }),
    [analysis?.people.sessionLenses, analysisDepartmentFilter, analysisRoleFilter]
  );

  const filteredStakeholderAnalysisLenses = useMemo(
    () =>
      (analysis?.people.stakeholderLenses || []).filter((lens) => {
        if (analysisRoleFilter !== 'all' && lens.role !== analysisRoleFilter) return false;
        if (analysisDepartmentFilter !== 'all' && lens.department !== analysisDepartmentFilter)
          return false;
        return true;
      }),
    [analysis?.people.stakeholderLenses, analysisDepartmentFilter, analysisRoleFilter]
  );

  const activeAnalysisColumns = useMemo(
    () =>
      analysisLensMode === 'stakeholder'
        ? filteredStakeholderAnalysisLenses.map((lens) => ({ id: lens.id, label: lens.label }))
        : filteredSessionAnalysisLenses.map((lens) => ({ id: lens.id, label: lens.label })),
    [analysisLensMode, filteredSessionAnalysisLenses, filteredStakeholderAnalysisLenses]
  );

  const activeAnalysisCellMap = useMemo(
    () => (analysisLensMode === 'stakeholder' ? stakeholderMatrixCellMap : sessionMatrixCellMap),
    [analysisLensMode, sessionMatrixCellMap, stakeholderMatrixCellMap]
  );

  const visibleAnalysisTopicRows = useMemo(() => {
    const baseRows = analysis?.matrix.rows || [];
    const filtersApplied = analysisRoleFilter !== 'all' || analysisDepartmentFilter !== 'all';
    if (!filtersApplied) return baseRows;
    return baseRows.filter((row) =>
      activeAnalysisColumns.some((column) => {
        const cell = activeAnalysisCellMap.get(`${row.id}:${column.id}`);
        return cell && cell.state !== 'not_observed';
      })
    );
  }, [
    activeAnalysisCellMap,
    activeAnalysisColumns,
    analysis?.matrix.rows,
    analysisDepartmentFilter,
    analysisRoleFilter,
  ]);

  const visiblePeopleLenses = useMemo(
    () =>
      analysisLensMode === 'stakeholder'
        ? filteredStakeholderAnalysisLenses
        : filteredSessionAnalysisLenses,
    [analysisLensMode, filteredSessionAnalysisLenses, filteredStakeholderAnalysisLenses]
  );

  // Evidence drilldown state
  const [expandedEvidenceRef, setExpandedEvidenceRef] = useState<string | null>(null);

  const toggleEvidenceRef = useCallback((ref: string) => {
    setExpandedEvidenceRef((prev) => (prev === ref ? null : ref));
  }, []);

  const findEvidenceForRef = useCallback(
    (ref: string): InsightEvidenceMapEntry | undefined =>
      v6EvidenceMap.find((entry) => entry.answer_id === ref || entry.question_text === ref),
    [v6EvidenceMap]
  );

  const isDirty = title !== (insight?.title || '');

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!insight) return;
    setSaving(true);
    try {
      await V8InterviewApi.updateInsight(insight.id, { title }).catch(() =>
        Api.patch(`/interview/insights/${insight.id}`, { title })
      );
      toast.success(t('interview.insightViewer.saved'));
      const refreshed = await V8InterviewApi.getInsight(insightId)
        .then((r) => r.insight)
        .catch(() => Api.get(`/interview/insights/${insightId}`).catch(() => null));
      if (refreshed) {
        setInsight(refreshed);
        await loadPersistedFindings(insightId);
        await loadCandidates(insightId);
        await loadInsightAnalysis(insightId);
        onSaved?.(refreshed);
      } else {
        onSaved?.({ ...insight, title });
      }
      const activityRes = await V8InterviewApi.getInsightActivity(insightId)
        .then((r) => r.activity)
        .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
      setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
    } catch {
      toast.error(t('interview.insightViewer.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChat = () => {
    void openChatWithContext({
      entityType: 'interview insight',
      entityId: insightId,
      entityName: title || insight?.title || insightId,
      contextData: {
        insightId,
        title,
        promptType: insight?.promptType,
        status: insight?.status,
        sourceSessionCount: insight?.sourceSessionCount,
      },
    });
  };

  const openSourceSessionInInterviewHub = useCallback(
    (session: SourceSession) => {
      try {
        const raw = window.sessionStorage.getItem('moduleHub.openDocuments.interview');
        const parsed = raw ? JSON.parse(raw) : {};
        const openDocuments = Array.isArray(parsed?.openDocuments) ? parsed.openDocuments : [];
        const activeDocumentId =
          typeof parsed?.activeDocumentId === 'string' ? parsed.activeDocumentId : null;

        const exists = openDocuments.some((d: any) => d?.id === session.id);
        const inferredStatus = session.completedAt ? ('completed' as const) : ('active' as const);
        const nextDocuments = exists
          ? openDocuments
          : [
              ...openDocuments,
              {
                id: session.id,
                type: 'session',
                name: session.name || 'Session',
                status: inferredStatus,
                data: { id: session.id, name: session.name || 'Session', status: inferredStatus },
              },
            ];

        window.sessionStorage.setItem(
          'moduleHub.openDocuments.interview',
          JSON.stringify({
            openDocuments: nextDocuments,
            activeDocumentId: session.id || activeDocumentId,
          })
        );
      } catch (err) {
        // Fail-soft: nawigujemy i tak, ale brak zapisu = zakładka sesji się nie
        // otworzy w hubie — to musi być widoczne w konsoli, nie połknięte.
        warnInsightSilentFailure(
          `handing off source session ${session.id} to Interview hub (sessionStorage) failed`,
          err
        );
      }
      navigate(ROUTES.INTERVIEW);
    },
    [navigate]
  );

  // ── Mark Complete (Canon Blok C — parity with InitiativeDocumentView) ──────
  // AI signal only; never locks fields. Persisted as JSON map on the insight row
  // (lazy-ALTER'd section_completions TEXT column server-side; PATCH updateInsight).
  const sectionCompletions = useMemo<Record<string, boolean>>(() => {
    const raw = (insight as any)?.sectionCompletions ?? (insight as any)?.section_completions;
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) || {};
      } catch {
        return {};
      }
    }
    return typeof raw === 'object' ? (raw as Record<string, boolean>) : {};
  }, [insight]);

  const handleToggleSectionComplete = useCallback(
    async (sectionId: string) => {
      if (!insight) return;
      const prevMap = sectionCompletions;
      const next = { ...prevMap, [sectionId]: !prevMap[sectionId] };
      // Optimistic — reflect immediately in nav badge + progress.
      setInsight((prev) =>
        prev ? ({ ...prev, sectionCompletions: next, section_completions: next } as any) : prev
      );
      try {
        await V8InterviewApi.updateInsight(insight.id, { sectionCompletions: next } as any);
      } catch {
        setInsight((prev) =>
          prev
            ? ({ ...prev, sectionCompletions: prevMap, section_completions: prevMap } as any)
            : prev
        );
        toast.error(t('interview.insightViewer.failedToSaveSectionStatus'));
      }
    },
    [insight, sectionCompletions, isPolish]
  );

  // ── Ręczna redakcja treści sekcji (n-Type §6.2–6.4; właściciel 2026-07-23) ──
  // ZAPISANE nadpisania czytamy z wniosku (`section_overrides`, kolumna dodana
  // migracją 931 + lazy-guardem po stronie serwera). Wersja ROBOCZA (to, co
  // użytkownik ma w polu) żyje osobno w `sectionDrafts`, żeby przeładowanie
  // wniosku nie kasowało niezapisanego tekstu, a udany zapis nie zostawiał
  // dwóch źródeł prawdy (po zapisie draft znika i pole czyta z wniosku).
  const sectionOverrides = useMemo<
    Record<string, { content: string; updatedAt?: string; updatedBy?: string | null }>
  >(() => {
    const raw = (insight as any)?.sectionOverrides ?? (insight as any)?.section_overrides;
    if (!raw) return {};
    const parsed =
      typeof raw === 'string'
        ? (() => {
            try {
              return JSON.parse(raw);
            } catch {
              return null;
            }
          })()
        : raw;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, { content: string; updatedAt?: string; updatedBy?: string | null }> =
      {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') out[id] = { content: value };
      else if (value && typeof value === 'object' && typeof (value as any).content === 'string') {
        out[id] = value as { content: string; updatedAt?: string; updatedBy?: string | null };
      }
    }
    return out;
  }, [insight]);

  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string>>({});
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  /** Fokus z „✎ Edytuj" w pasku karty — bez tego przycisk nie miałby dokąd prowadzić. */
  const manualFieldRef = useRef<HTMLTextAreaElement | null>(null);

  const setSectionDraft = useCallback((sectionId: string, value: string) => {
    setSectionDrafts((prev) => ({ ...prev, [sectionId]: value }));
  }, []);

  /**
   * Zapis JEDNEJ sekcji. Wysyłamy mapę CZĘŚCIOWĄ (`{ [sectionId]: … }`) — serwer
   * scala, więc równoległa redakcja innej sekcji przez drugą osobę nie ginie.
   * Pusty tekst = świadome cofnięcie redakcji ⇒ `null` ⇒ sekcja wraca do AI.
   */
  const handleSaveSectionOverride = useCallback(
    async (sectionId: string, explicitValue?: string) => {
      if (!insight) return;
      // `explicitValue` obsługuje wołających, którzy DOPIERO co ustawili draft
      // (setState jest asynchroniczne — closure widziałby jeszcze starą mapę).
      const draft = explicitValue !== undefined ? explicitValue : sectionDrafts[sectionId];
      if (draft === undefined) return; // pole nietknięte — nie ruszamy serwera
      const persisted = sectionOverrides[sectionId]?.content ?? '';
      if (draft === persisted) {
        setSectionDrafts((prev) => {
          const next = { ...prev };
          delete next[sectionId];
          return next;
        });
        return;
      }
      setSavingSectionId(sectionId);
      try {
        await V8InterviewApi.updateInsight(insight.id, {
          sectionOverrides: { [sectionId]: draft.trim() ? draft : null },
        });
        const nextMap = { ...sectionOverrides };
        if (draft.trim()) {
          nextMap[sectionId] = { content: draft, updatedAt: new Date().toISOString() };
        } else {
          delete nextMap[sectionId];
        }
        setInsight((prev) =>
          prev ? ({ ...prev, sectionOverrides: nextMap, section_overrides: nextMap } as any) : prev
        );
        setSectionDrafts((prev) => {
          const next = { ...prev };
          delete next[sectionId];
          return next;
        });
        toast.success(t('interview.insightViewer.manualFieldSaved', 'Section saved'));
      } catch {
        // Draft ZOSTAJE — użytkownik nie traci tekstu przez nieudany zapis.
        toast.error(t('interview.insightViewer.manualFieldSaveFailed', 'Failed to save section'));
      } finally {
        setSavingSectionId(null);
      }
    },
    [insight, sectionDrafts, sectionOverrides, t]
  );

  const handleRevertSectionOverride = useCallback(
    (sectionId: string) => {
      setSectionDrafts((prev) => ({ ...prev, [sectionId]: '' }));
      // Zapis pustki idzie tą samą drogą (serwer zamienia ją na `null`), więc
      // „cofnij" nie jest osobną ścieżką backendową, którą trzeba by utrzymywać.
      void (async () => {
        if (!insight) return;
        setSavingSectionId(sectionId);
        try {
          await V8InterviewApi.updateInsight(insight.id, {
            sectionOverrides: { [sectionId]: null },
          });
          const nextMap = { ...sectionOverrides };
          delete nextMap[sectionId];
          setInsight((prev) =>
            prev
              ? ({ ...prev, sectionOverrides: nextMap, section_overrides: nextMap } as any)
              : prev
          );
          setSectionDrafts((prev) => {
            const next = { ...prev };
            delete next[sectionId];
            return next;
          });
        } catch {
          toast.error(t('interview.insightViewer.manualFieldSaveFailed', 'Failed to save section'));
        } finally {
          setSavingSectionId(null);
        }
      })();
    },
    [insight, sectionOverrides, t]
  );

  /**
   * „✎ Edytuj" w pasku karty. Pole ręcznej edycji jest już na ekranie (nad
   * treścią sekcji) — przycisk ma je pokazać i postawić w nim kursor, a nie
   * otwierać drugiego, konkurencyjnego wejścia (§2.6 anty-duplikacja).
   */
  const focusManualField = useCallback(() => {
    const el = manualFieldRef.current;
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus();
    // Kursor na końcu — użytkownik dopisuje, nie nadpisuje zaznaczeniem.
    const end = el.value.length;
    try {
      el.setSelectionRange(end, end);
    } catch {
      /* niektóre przeglądarki blokują selection na świeżo sfokusowanym polu */
    }
  }, []);

  const handleRegenerate = async () => {
    if (!insight) return;
    setIsRegenerating(true);
    try {
      await V8InterviewApi.regenerateInsight(insight.id).catch(() =>
        Api.post(`/interview/insights/${insight.id}/regenerate`, {})
      );
      const data = await V8InterviewApi.getInsight(insightId)
        .then((r) => r.insight)
        .catch(() => Api.get(`/interview/insights/${insightId}`));
      setInsight(data);
      await loadPersistedFindings(insightId);
      await loadCandidates(insightId);
      await loadInsightAnalysis(insightId);
      const activityRes = await V8InterviewApi.getInsightActivity(insightId)
        .then((r) => r.activity)
        .catch(() =>
          Api.get(`/interview/insights/${insightId}/activity`).catch((err) => {
            warnInsightSilentFailure(
              `getInsightActivity(${insightId}) after regenerate failed`,
              err
            );
            return [];
          })
        );
      setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
      // Sukces DOPIERO po udanym przeładowaniu — inaczej nieudany reload dawał
      // użytkownikowi najpierw „rozpoczęto", a chwilę później „nie udało się".
      toast.success(t('interview.insightViewer.regenerationStarted'));
      onRegenerate?.();
    } catch (err) {
      warnInsightSilentFailure(`handleRegenerate(${insightId}) failed`, err);
      toast.error(t('interview.insightViewer.failedToRegenerate'));
    } finally {
      setIsRegenerating(false);
    }
  };

  // #56 (D17) — "AI Konsultant" na Insight NIE otwiera już drugiego czatu
  // (dawny AIConsultantPanel). Zamiast tego otwiera JEDEN, docked panel Teresy
  // (prawa strona) z kontekstem całego insightu i publikuje te same 5 akcji
  // jako trwałe przyciski komend WEWNĄTRZ Teresy (uiSlice.chatContextActions,
  // renderowane przez UnifiedChatPanel). 4 akcje zasiewają prompt przez
  // kanoniczny kanał pending-prompt Teresy (sessionStorage + event, konsumowany
  // przez EnhancedChatInput); "Odśwież" wywołuje realny handleRegenerate.
  const seedTeresaPrompt = useCallback((prompt: string) => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          'consultify.teresa.pendingPrompt',
          JSON.stringify({ prompt, ts: Date.now() })
        );
        window.dispatchEvent(new CustomEvent('consultify:teresa-pending-prompt'));
      }
    } catch (err) {
      // Non-critical dla użytkownika, ale prompt Teresy się NIE zasieje —
      // developer musi to zobaczyć zamiast zgadywać, czemu czat jest pusty.
      warnInsightSilentFailure('seeding Teresa pending prompt (sessionStorage) failed', err);
    }
  }, []);

  const openInsightConsultant = useCallback(() => {
    if (!insight) return;

    // Whole-insight context → docked Teresa system prompt (parytet z dawnym
    // AIConsultantPanel.buildSystemPrompt).
    const ctx = aiContextText && aiContextText.trim() ? `\n\n${aiContextText.trim()}` : '';
    const systemPrompt = isPolish
      ? `Jesteś konsultantem AI pracującym nad całym insightem${insight.title ? ` „${insight.title}”` : ''}. ` +
        `Masz dostęp do pełnego kontekstu (wszystkie sekcje + metadane). ` +
        `Pomagaj: uzupełniaj puste pola, syntetyzuj, kontroluj jakość, proponuj kolejne kroki. ` +
        `Odpowiadaj zwięźle i konkretnie.${ctx}`
      : `You are an AI consultant working on the whole insight${insight.title ? ` "${insight.title}"` : ''}. ` +
        `You have access to the full context (all sections + metadata). ` +
        `Help the user fill empty fields, synthesize, run quality checks, and propose next steps. ` +
        `Answer concisely and concretely.${ctx}`;
    setChatSystemPrompt(systemPrompt);

    // Te same 5 akcji, teraz WEWNĄTRZ panelu Teresy.
    setChatContextActions([
      {
        id: 'fill-empty',
        label: t('interview.insightViewer.fillEmpty'),
        icon: <Plus size={13} />,
        onClick: () => seedTeresaPrompt(t('interview.insightViewer.fillInTheEmptyAnd')),
      },
      {
        id: 'synthesize',
        label: t('interview.insightViewer.synthesize'),
        icon: <Layers size={13} />,
        onClick: () =>
          seedTeresaPrompt(t('interview.insightViewer.synthesizeThisInsightSurfaceThe')),
      },
      {
        id: 'quality-check',
        label: t('interview.insightViewer.qualityCheck'),
        icon: <CheckCircle2 size={13} />,
        onClick: () => seedTeresaPrompt(t('interview.insightViewer.doAQualityCheckOf')),
      },
      {
        id: 'refresh',
        label: t('interview.insightViewer.refresh'),
        icon: <RefreshCw size={13} />,
        busy: isRegenerating,
        onClick: () => {
          void handleRegenerate();
        },
      },
      {
        id: 'continue',
        label: t('interview.insightViewer.continue'),
        icon: <Send size={13} />,
        onClick: () => seedTeresaPrompt(t('interview.insightViewer.continueWhereWeLeftOff')),
      },
    ]);

    // Otwórz JEDEN docked panel Teresy z kontekstem insightu (prawa strona).
    void openChatWithContext({
      entityType: 'insight',
      entityId: insight.id,
      entityName: insight.title,
    });
  }, [
    insight,
    aiContextText,
    isPolish,
    isRegenerating,
    handleRegenerate,
    seedTeresaPrompt,
    setChatSystemPrompt,
    setChatContextActions,
    openChatWithContext,
    /* + t: tlumaczenia ladowane async — bez tego memo zwraca surowy klucz na stale (2026-07-21) */ t,
  ]);

  // Sprzątanie: akcje kontekstowe insightu nie mogą wyciekać do innych modułów.
  useEffect(() => {
    return () => {
      setChatContextActions(null);
    };
  }, [setChatContextActions]);

  // Pasek stanu karty AI-draft dla sekcji Insightu (wzorzec N §3.3). Wpina badge
  // stanu (AI-draft/Edytowane/Gotowe/Błąd) + akcje ✨Regeneruj · ✎Edytuj ·
  // ✓Zaakceptuj pod nagłówkiem sekcji. Stan liczony ze statusu artefaktu +
  // sygnałów per-sekcja (odświeżanie, obecność treści, ręczna akceptacja).
  //   • Edytuj → FOKUS w polu ręcznej edycji tej sekcji (n-Type §6.2; właściciel
  //     2026-07-23). BYŁO: `handleOpenChat` — „edycja" oznaczała otwarcie czatu,
  //     czyli prośbę do modelu, a nie edycję. Czat nie zniknął: żyje w nagłówku
  //     (`onChat`) i w toolbarze, więc żadna zdolność nie została zabrana.
  //   • Zaakceptuj → toggle completion (już persystowany per sekcja)
  //   • Regeneruj → whole-artifact regenerate (jedyny dostępny backend)
  // UWAGA: MUSI być zadeklarowany PO sectionCompletions/handleRegenerate/
  // handleToggleSectionComplete — tablica deps czytana w renderze (TDZ fix).
  const renderSectionCardHeader = useCallback(
    (sectionId: string, hasContent: boolean) => {
      const accepted = !!sectionCompletions[sectionId];
      const baseState = resolveInsightSectionCardState(insight?.status, {
        hasContent,
        regenerating: isRegenerating,
      });
      // Ręczna akceptacja sekcji ma pierwszeństwo nad stanem whole-artifact
      // (człowiek zatwierdził tę konkretną kartę → „Gotowe").
      const state: NModeCardStatus =
        accepted && (baseState === 'ai-draft' || baseState === 'edited') ? 'done' : baseState;
      return (
        <InsightSectionCardHeader
          state={state}
          isPolish={!!isPolish}
          readOnly={readMode}
          onRegenerate={handleRegenerate}
          regenerating={isRegenerating}
          onEdit={focusManualField}
          onAccept={() => handleToggleSectionComplete(sectionId)}
        />
      );
    },
    [
      sectionCompletions,
      insight?.status,
      isRegenerating,
      isPolish,
      readMode,
      handleRegenerate,
      focusManualField,
      handleToggleSectionComplete,
    ]
  );

  // #25 — best-effort section-filtered markdown. Matches selected section
  // labels (en + pl) against the insight's markdown headings and keeps the
  // matched heading blocks. If no headings match (content not section-headed),
  // returns null so callers fall back to the full content.
  const buildFilteredMarkdown = useCallback(
    (sectionIds: string[]): string | null => {
      const content = insight?.content;
      if (!content) return null;
      const selected = new Set(sectionIds);
      const wanted = INSIGHT_SECTIONS.filter((s) => selected.has(s.id)).flatMap((s) =>
        [s.label.en, s.label.pl].map((l) => l.toLowerCase().trim())
      );
      if (wanted.length === 0) return null;
      const lines = content.split('\n');
      const blocks: { heading: string; body: string[] }[] = [];
      let current: { heading: string; body: string[] } | null = null;
      for (const line of lines) {
        const headingMatch = /^#{1,6}\s+(.*)$/.exec(line);
        if (headingMatch) {
          if (current) blocks.push(current);
          current = { heading: headingMatch[1].toLowerCase().trim(), body: [line] };
        } else if (current) {
          current.body.push(line);
        }
      }
      if (current) blocks.push(current);
      if (blocks.length === 0) return null;
      const kept = blocks.filter((b) =>
        wanted.some((w) => b.heading.includes(w) || w.includes(b.heading))
      );
      if (kept.length === 0) return null;
      return kept.map((b) => b.body.join('\n').trim()).join('\n\n');
    },
    [insight?.content]
  );

  const handleExportMarkdown = (sectionIds?: string[]) => {
    if (!insight?.content) return;
    // #25 — when a section subset is supplied, emit a section-filtered markdown
    // document (best-effort heading match against the raw content). Falls back
    // to the full content if the subset can't be resolved.
    const markdown =
      sectionIds && sectionIds.length > 0
        ? buildFilteredMarkdown(sectionIds) || insight.content
        : insight.content;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${insight.title.replace(/[^a-z0-9]/gi, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('interview.insightViewer.downloadedMarkdownFile'));
  };

  const handleExportToTools = async (sectionIds?: string[]) => {
    if (!insight) return;
    setIsExportingTools(true);
    try {
      // #25: server honors `sectionIds` for the tools target — only the
      // selected sections are exported when provided.
      const exportRes = await V8InterviewApi.exportInsight(insight.id, {
        target: 'tools',
        ...(sectionIds ? { sectionIds } : {}),
      } as { target: 'tools' }).catch(() =>
        Api.post(`/interview/insights/${insight.id}/export`, {
          target: 'tools',
          ...(sectionIds ? { sectionIds } : {}),
        })
      );
      toast.success(t('interview.insightViewer.exportedToTools'));
      const activityRes = await V8InterviewApi.getInsightActivity(insightId)
        .then((r) => r.activity)
        .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
      setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
      const toolId = exportRes?.targetId;
      if (toolId) navigate(`${ROUTES.DISCOVERY_TOOLS.STRATEGIC}?tool=${toolId}`);
    } catch {
      toast.error(t('interview.insightViewer.failedToExport'));
    } finally {
      setIsExportingTools(false);
    }
  };

  const handleExportToAssessment = async (sectionIds?: string[]) => {
    if (!insight) return;
    setIsExportingAssessment(true);
    try {
      // #25: server honors `sectionIds` for the assessment target — only the
      // selected sections are exported when provided.
      const exportRes = await V8InterviewApi.exportInsight(insight.id, {
        target: 'assessment',
        ...(sectionIds ? { sectionIds } : {}),
      } as { target: 'assessment' }).catch(() =>
        Api.post(`/interview/insights/${insight.id}/export`, {
          target: 'assessment',
          ...(sectionIds ? { sectionIds } : {}),
        })
      );
      toast.success(t('interview.insightViewer.exportedToAssessment'));
      const activityRes = await V8InterviewApi.getInsightActivity(insightId)
        .then((r) => r.activity)
        .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
      setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
      const assessmentId = exportRes?.targetId;
      const assessmentType = String(exportRes?.assessmentType || 'DRD').toLowerCase();
      if (assessmentId) navigate(`${ROUTES.ASSESSMENT.ROOT}/${assessmentType}/${assessmentId}`);
    } catch {
      toast.error(t('interview.insightViewer.failedToExport'));
    } finally {
      setIsExportingAssessment(false);
    }
  };

  const handleExportToNotebook = async (sectionIds?: string[]) => {
    if (!insight) return;
    setIsExportingNotebook(true);
    try {
      // #25 — Note target exports the selected sections as fragments. When a
      // subset is chosen we send a section-filtered markdown body + the section
      // id list (consumed as fragments downstream once supported).
      const content =
        sectionIds && sectionIds.length > 0
          ? buildFilteredMarkdown(sectionIds) || insight.content || ''
          : insight.content || '';
      await Api.post('/my-work/notebook/pages', {
        title: insight.title,
        content,
        source: 'interview_insight',
        metadata: { insightId: insight.id, ...(sectionIds ? { sectionIds } : {}) },
      });
      toast.success(t('interview.insightViewer.savedToNotebook'));
    } catch {
      toast.error(t('interview.insightViewer.failedToSaveToNotebook'));
    } finally {
      setIsExportingNotebook(false);
    }
  };

  // #26b — Submit for Information: notify org managers/owners; no review gate.
  const handleSubmitForInformation = useCallback(async () => {
    if (!insight) return;
    setSubmittingForInfo(true);
    try {
      await Api.post(`/v8/interview/insights/${insight.id}/submit-for-information`, {});
      toast.success(t('interview.insightViewer.sentForInformation'));
    } catch {
      toast.error(t('interview.insightViewer.failedToSend'));
    } finally {
      setSubmittingForInfo(false);
    }
  }, [insight, isPolish]);

  const handleOpenHandoff = useCallback(
    (finding: {
      findingId?: string;
      title: string;
      description: string;
      confidence?: P10ConfidenceLevel;
      limits?: string[];
      sectionType: 'theme' | 'issue' | 'opportunity';
      index: number;
    }) => {
      setHandoffFinding(finding);
      setHandoffTargetInitiativeId('');
      setHandoffModalOpen(true);
    },
    []
  );

  // Load the org's initiatives for the link-to-existing picker whenever the
  // handoff modal opens. Reuses the canonical /initiatives list endpoint
  // (response is either an array or { initiatives: [...] }).
  useEffect(() => {
    if (!handoffModalOpen) return;
    let cancelled = false;
    setHandoffInitiativesLoading(true);
    void (async () => {
      try {
        const res: unknown = await Api.getInitiatives();
        const list = Array.isArray(res)
          ? res
          : ((res as { initiatives?: unknown[] } | null)?.initiatives ?? []);
        const normalized = (Array.isArray(list) ? list : [])
          .map((raw) => {
            const item = raw as { id?: unknown; title?: unknown; name?: unknown; status?: unknown };
            const id = item?.id != null ? String(item.id) : '';
            const title =
              (typeof item?.title === 'string' && item.title) ||
              (typeof item?.name === 'string' && item.name) ||
              id;
            const status = typeof item?.status === 'string' ? item.status : undefined;
            return { id, title, status };
          })
          .filter((i) => i.id);
        if (!cancelled) setHandoffInitiatives(normalized);
      } catch {
        if (!cancelled) setHandoffInitiatives([]);
      } finally {
        if (!cancelled) setHandoffInitiativesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handoffModalOpen]);

  const handleHandoffSubmit = useCallback(
    async (mode: 'link' | 'create') => {
      if (!insight || !handoffFinding || handoffSubmitLockRef.current || handoffSubmitting) return;
      handoffSubmitLockRef.current = true;
      setHandoffSubmitting(true);
      try {
        const MAX_RETRIES = 2;
        const findingId = handoffFinding.findingId;
        if (!findingId) {
          toast.error(t('interview.insightViewer.thisFindingIsNotYet'));
          return;
        }
        // Link mode requires a real, user-picked target initiative id.
        if (mode === 'link' && !handoffTargetInitiativeId) {
          toast.error(t('interview.insightViewer.pickATargetInitiativeTo'));
          return;
        }
        const targetInitiativeId = handoffTargetInitiativeId;
        const targetInitiativeName =
          handoffInitiatives.find((i) => i.id === targetInitiativeId)?.title || targetInitiativeId;
        let lastError: unknown;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const res = await V8InterviewApi.handoffFinding(
              insight.id,
              findingId,
              mode === 'link' ? { target_initiative_id: targetInitiativeId } : undefined
            );
            setHandoffModalOpen(false);
            setHandoffFinding(null);
            setHandoffTargetInitiativeId('');
            const initiativeId = res?.initiative?.id;
            const linkedLabel =
              mode === 'link' ? targetInitiativeName : initiativeId ? `${initiativeId}` : '';
            // M13 flow redesign: creating a NEW initiative lands the user in
            // its document immediately (Interview staging stays a source view).
            const landingPath = getHandoffLandingPath({
              mode,
              initiativeId,
              resultType: res?.initiative?.type,
            });
            if (landingPath) {
              toast.success(t('interview.insightViewer.initiativeCreatedOpeningItsDocument'));
              navigate(landingPath);
            } else {
              toast.success(
                t(
                  mode === 'create'
                    ? 'interview.insightViewer.initiativeCreatedX'
                    : 'interview.insightViewer.initiativeLinkedX',
                  { suffix: linkedLabel ? ` (${linkedLabel})` : '' }
                )
              );
            }
            // #59 — dedup parity with the Tools→Initiatives generator (#68b):
            // informational-only warning, shown after success, never blocks
            // the handoff that already happened.
            if (res?.duplicateWarning) {
              const matchTitle = res.duplicateWarning.topMatch?.title || '';
              toast(
                t('interview.insightViewer.duplicateInitiativeWarning', {
                  suffix: matchTitle ? ` (${matchTitle})` : '',
                }),
                { icon: '⚠️', duration: 6000 }
              );
            }
            return;
          } catch (err: unknown) {
            lastError = err;
            const errMsg = err instanceof Error ? err.message : String(err);

            if (
              errMsg.includes('403') ||
              errMsg.includes('permission') ||
              errMsg.includes('forbidden')
            ) {
              toast.error(t('interview.insightViewer.permissionDeniedForInitiativeHandoff'));
              return;
            }

            if (errMsg.includes('422') || errMsg.includes('HANDOFF_BLOCKED')) {
              toast.error(t('interview.insightViewer.handoffBlockedCheckFindingConfidence'));
              return;
            }

            if (attempt < MAX_RETRIES) {
              await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
              continue;
            }
          }
        }

        const errMsg = lastError instanceof Error ? lastError.message : '';
        if (errMsg.includes('network') || errMsg.includes('fetch') || errMsg.includes('timeout')) {
          toast.error(t('interview.insightViewer.networkIssuePayloadPreservedPlease'));
        } else {
          toast.error(t('interview.insightViewer.failedToHandOffFinding'));
        }
      } finally {
        handoffSubmitLockRef.current = false;
        setHandoffSubmitting(false);
      }
    },
    [
      insight,
      handoffFinding,
      handoffSubmitting,
      handoffTargetInitiativeId,
      handoffInitiatives,
      isPolish,
      navigate,
    ]
  );

  const handleLifecycleTransition = useCallback(
    async (uiAction: 'submit_review' | 'approve' | 'reject' | 'revert_draft') => {
      if (!insight) return;
      const ACTION_MAP: Record<string, string> = {
        submit_review: 'submit_for_review',
        approve: 'approve',
        reject: 'reject',
        revert_draft: 'revert_to_draft',
      };
      const backendAction = ACTION_MAP[uiAction] ?? uiAction;
      setLifecycleTransitioning(true);
      try {
        await V8InterviewApi.lifecycleTransition(insight.id, backendAction);
        const refreshed = await V8InterviewApi.getInsight(insightId)
          .then((r) => r.insight)
          .catch(() => Api.get(`/interview/insights/${insightId}`));
        setInsight(refreshed);
        await loadPersistedFindings(insightId);
        await loadCandidates(insightId);
        await loadInsightAnalysis(insightId);
        await loadSourcePack(insightId);
        const activityRes = await V8InterviewApi.getInsightActivity(insightId)
          .then((r) => r.activity)
          .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
        setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
        toast.success(t(`interview.insightViewer.lifecycleActionMsg.${uiAction}`));
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : '';
        if (
          errMsg.includes('403') ||
          errMsg.includes('permission') ||
          errMsg.includes('forbidden')
        ) {
          toast.error(t('interview.insightViewer.permissionDeniedForLifecycleChange'));
        } else {
          toast.error(t('interview.insightViewer.failedToChangeLifecycleStatus'));
        }
      } finally {
        setLifecycleTransitioning(false);
      }
    },
    [
      insight,
      insightId,
      isPolish,
      loadCandidates,
      loadInsightAnalysis,
      loadPersistedFindings,
      loadSourcePack,
    ]
  );

  const handleCandidateAction = useCallback(
    async (
      candidate: V8InsightCandidate,
      action:
        | 'mark_candidate'
        | 'mark_needs_split'
        | 'mark_needs_evidence'
        | 'mark_ready_for_review'
        | 'reject'
        | 'promote_to_finding'
    ) => {
      if (!insight) return;
      setCandidateActionLoadingId(candidate.id);
      try {
        await V8InterviewApi.triageCandidate(insight.id, candidate.id, {
          action,
          candidate_statement:
            action === 'promote_to_finding' ? candidate.candidate_statement : undefined,
          confidence_level: action === 'promote_to_finding' ? candidate.confidence_hint : undefined,
        });
        await Promise.all([
          loadCandidates(insightId),
          loadPersistedFindings(insightId),
          loadInsightAnalysis(insightId),
          loadSourcePack(insightId),
        ]);
        const activityRes = await V8InterviewApi.getInsightActivity(insightId)
          .then((r) => r.activity)
          .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
        setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
        toast.success(t(`interview.insightViewer.candidateActionMsg.${action}`));
      } catch (err: any) {
        toast.error(
          err?.response?.data?.error ||
            err?.message ||
            t('interview.insightViewer.failedToUpdateCandidateTriage')
        );
      } finally {
        setCandidateActionLoadingId(null);
      }
    },
    [
      insight,
      insightId,
      isPolish,
      loadCandidates,
      loadInsightAnalysis,
      loadPersistedFindings,
      loadSourcePack,
    ]
  );

  const handleReadbackStatus = useCallback(
    async (finding: V8InsightFinding, status: P10ReadbackStatus) => {
      if (!insight) return;
      setReadbackLoadingId(finding.id);
      try {
        const summaryDefaults: Record<P10ReadbackStatus, string> = {
          draft_interpretation: 'Readback reset to draft interpretation.',
          shared_for_readback: 'Finding shared for client readback.',
          confirmed_by_client: 'Client confirmed the interpretation for governed downstream use.',
          partially_confirmed: 'Client partially confirmed; keep limits visible before publish.',
          challenged_by_client: 'Client challenged the interpretation; return to evidence review.',
          needs_more_evidence: 'Readback requires more evidence before publish or handoff.',
        };
        await V8InterviewApi.updateFindingReadback(insight.id, finding.id, {
          readback_status: status,
          readback_summary: summaryDefaults[status],
        });
        await Promise.all([
          loadPersistedFindings(insightId),
          loadCandidates(insightId),
          loadInsightAnalysis(insightId),
          loadSourcePack(insightId),
        ]);
        toast.success(t('interview.insightViewer.readbackUpdated'));
      } catch {
        toast.error(t('interview.insightViewer.failedToUpdateReadback'));
      } finally {
        setReadbackLoadingId(null);
      }
    },
    [
      insight,
      insightId,
      isPolish,
      loadCandidates,
      loadInsightAnalysis,
      loadPersistedFindings,
      loadSourcePack,
    ]
  );

  const toggleLimitsExpand = useCallback((cardKey: string) => {
    setExpandedLimits((prev) => {
      const next = new Set(prev);
      if (next.has(cardKey)) next.delete(cardKey);
      else next.add(cardKey);
      return next;
    });
  }, []);

  // Comments handlers (NMode)
  const handleSubmitComment = useCallback(() => {
    void (async () => {
      const text = commentDraft.trim();
      if (!text) return;

      try {
        if (isInterviewDemoId(insightId)) {
          const created = {
            id: `demo-comment-${Date.now()}`,
            authorName: currentUser?.displayName || (currentUser as any)?.name || 'You',
            content: text,
            createdAt: new Date().toISOString(),
            priority: draftPriority,
          } as CommentItem;
          setNComments((prev) => [...prev, created]);
          setActivityEntries((prev) => [
            {
              id: `demo-activity-${Date.now()}`,
              type: 'comment',
              description: 'Comment added in demo mode.',
              timestamp: new Date().toISOString(),
              userName: created.authorName,
            },
            ...prev,
          ]);
          setCommentDraft('');
          setDraftPriority('normal');
          return;
        }

        const created = await V8InterviewApi.createInsightComment(insightId, {
          content: text,
          priority: draftPriority,
        }).catch(() =>
          Api.post(`/interview/insights/${insightId}/comments`, {
            content: text,
            priority: draftPriority,
          })
        );
        setNComments((prev) => [...prev, created]);
        setCommentDraft('');
        setDraftPriority('normal');

        const activityRes = await V8InterviewApi.getInsightActivity(insightId)
          .then((r) => r.activity)
          .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
        setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
      } catch {
        toast.error(t('interview.insightViewer.failedToAddComment'));
      }
    })();
  }, [
    commentDraft,
    currentUser?.displayName,
    currentUser?.id,
    draftPriority,
    insightId,
    isPolish,
    (currentUser as any)?.name,
    /* + t: tlumaczenia ladowane async — bez tego memo zwraca surowy klucz na stale (2026-07-21) */ t,
  ]);

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      void (async () => {
        try {
          if (isInterviewDemoId(insightId)) {
            setNComments((prev) => prev.filter((c) => c.id !== commentId));
            setActivityEntries((prev) => [
              {
                id: `demo-activity-delete-${Date.now()}`,
                type: 'comment',
                description: 'Comment removed in demo mode.',
                timestamp: new Date().toISOString(),
                userName: currentUser?.displayName || (currentUser as any)?.name || 'You',
              },
              ...prev,
            ]);
            return;
          }

          await V8InterviewApi.deleteInsightComment(insightId, commentId).catch(() =>
            Api.delete(`/interview/insights/${insightId}/comments/${commentId}`)
          );
          setNComments((prev) => prev.filter((c) => c.id !== commentId));
          const activityRes = await V8InterviewApi.getInsightActivity(insightId)
            .then((r) => r.activity)
            .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
          setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
        } catch {
          toast.error(t('interview.insightViewer.failedToDeleteComment'));
        }
      })();
    },
    [currentUser?.displayName, currentUser?.id, insightId, isPolish, (currentUser as any)?.name]
  );

  const getPriorityDotClass = useCallback((p: CommentPriority) => {
    if (p === 'high') return 'bg-danger-500';
    if (p === 'low') return 'bg-c-text-muted';
    return 'bg-blue-500';
  }, []);

  const getCommentPriority = useCallback(
    (comment: CommentItem): CommentPriority =>
      ((comment as CommentItem & { priority?: CommentPriority }).priority ||
        'normal') as CommentPriority,
    []
  );

  const getPriorityButtonClass = useCallback((p: CommentPriority, active: boolean) => {
    if (active && p === 'high') {
      return 'border-amber-500/55 text-amber-600 dark:text-amber-300 dark:border-amber-500/35 bg-amber-500/10';
    }
    if (active && p === 'normal') {
      return 'border-blue-500/55 text-blue-600 dark:text-blue-300 dark:border-blue-500/35 bg-blue-500/10';
    }
    if (active && p === 'low') {
      return 'border-c-border-strong text-c-text-secondary bg-c-text-muted/10';
    }
    return 'border-c-border text-c-text-muted hover:border-c-border-strong hover:text-c-text-secondary';
  }, []);

  const getCommentPriorityLabel = useCallback(
    (p: CommentPriority) =>
      p === 'high'
        ? t('interview.insightViewer.high')
        : p === 'low'
          ? t('interview.insightViewer.low')
          : t('interview.insightViewer.normal'),
    [isPolish]
  );

  const getCommentPriorityHint = useCallback(
    (p: CommentPriority) =>
      p === 'high'
        ? t('interview.insightViewer.requiresQuickResponseEscalation')
        : p === 'low'
          ? t('interview.insightViewer.informationalCanWait')
          : t('interview.insightViewer.standardPriority'),
    [isPolish]
  );

  const filteredComments = useMemo(() => {
    const now = Date.now();
    const cutoffMs =
      commentDateFilter === 'today'
        ? 24 * 60 * 60 * 1000
        : commentDateFilter === '7d'
          ? 7 * 24 * 60 * 60 * 1000
          : commentDateFilter === '30d'
            ? 30 * 24 * 60 * 60 * 1000
            : null;

    const withinRange = (c: CommentItem) => {
      if (!cutoffMs) return true;
      const ts = new Date(c.createdAt).getTime();
      if (!Number.isFinite(ts)) return true;
      return now - ts <= cutoffMs;
    };

    const filtered = nComments.filter(withinRange);
    const sorted = [...filtered].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
      return commentSortOrder === 'asc' ? ta - tb : tb - ta;
    });
    return sorted;
  }, [nComments, commentDateFilter, commentSortOrder]);

  // ── Right-panel "Właściwości" confidence (same derivation as the Results
  //    tiles below — read-only, no new backend). ────────────────────────────
  const panelConfidence = useMemo(
    () =>
      findings[0]?.confidence_level ||
      analysis?.topics?.[0]?.confidenceLevel ||
      (insight as any)?.confidence ||
      null,
    [findings, analysis, insight]
  );

  // ── Status field (governance) ───────────────────────────────────────────────
  // #54: the center "Properties Strip" (NModePropertiesStrip via NModeShell
  // `properties` prop) was removed — metadata belongs in the right panel
  // "Właściwości" tab (ArtifactRightPanel), not the artifact center. This field
  // is computed here (not in the old propertyFields array) and rendered as a
  // row inside `rightPanelSections` below. Canon (INSIGHT_CANON line 60/101):
  // status changes happen by clicking the STATUS field — NOT via toolbar
  // buttons. The select is interactive and routes the publish/review
  // transitions to the EXISTING `handleLifecycleTransition` handler (same
  // backend the old toolbar buttons used). Analysis Type/Created/Sessions
  // already have a home in the right panel table (Tag/Date/Source rows) — only
  // Status and Findings needed a new row there (see rightPanelSections below).
  const currentInsightStatus =
    insight?.reviewStatus === 'in_review' || insight?.reviewStatus === 'published'
      ? insight.reviewStatus
      : insight?.status || 'generating';
  // Always include the current (display) value so the select renders it.
  const statusBaseOptions: PropertyFieldOption[] = [
    { value: 'draft', label: { en: 'Draft', pl: 'Szkic' } },
    { value: 'generating', label: { en: 'Generating', pl: 'Generowanie' } },
    { value: 'completed', label: { en: 'Completed', pl: 'Ukończone' } },
    { value: 'in_review', label: { en: 'In Review', pl: 'W recenzji' } },
    { value: 'published', label: { en: 'Published', pl: 'Opublikowano' } },
    { value: 'failed', label: { en: 'Failed', pl: 'Błąd' } },
  ];
  // Governance transitions only fire when the value actually changes to a
  // valid target; AI-generation statuses (draft/generating/completed/failed)
  // are not user-settable, so selecting them is a no-op.
  const statusEditable = !lifecycleTransitioning;
  const runStatusTransition = (next: string) => {
    if (next === currentInsightStatus) return;
    if (next === 'in_review' && currentInsightStatus === 'completed') {
      void handleLifecycleTransition('submit_review');
    } else if (next === 'published') {
      void handleLifecycleTransition('approve');
    } else if (next === 'draft' && currentInsightStatus === 'published') {
      void handleLifecycleTransition('revert_draft');
    }
    // Any other target is an AI-generation status → not user-settable.
  };
  // Colored-pill visual parity with Initiative (bg / text / dot per state):
  // Draft=slate · Generating=amber · In Review=blue · Completed=emerald ·
  // Published(Ready)=teal · Failed=rose.
  const statusPill = STATUS_PILL[currentInsightStatus] || STATUS_PILL.completed;
  const statusPillLabel = t(
    `interview.insightViewer.insightStatusLabel2.${currentInsightStatus}`,
    STATUS_CONFIG[currentInsightStatus]?.label.en
  );
  // D-B (2026-07-22) — ton pigułki statusu w Menu 1 (kontrakt powłoki).
  // Parytet z prawym panelem (STATUS_PILL): draft=slate → 'draft';
  // in_review=blue → 'review'; completed/published=zielono/teal → 'approved';
  // failed=rose → 'rejected'; generating → 'neutral'.
  const headerStatusTone: 'draft' | 'review' | 'approved' | 'rejected' | 'neutral' =
    currentInsightStatus === 'draft'
      ? 'draft'
      : currentInsightStatus === 'in_review'
        ? 'review'
        : currentInsightStatus === 'completed' || currentInsightStatus === 'published'
          ? 'approved'
          : currentInsightStatus === 'failed'
            ? 'rejected'
            : 'neutral';

  // ── Activity log → NMode format ───────────────────────────────────────────

  const nModeActivityEntries = useMemo<NModeActivityLogEntry[]>(
    () => activityEntries,
    [activityEntries]
  );

  const activityStats = useMemo<ActivityStats>(
    () => ({
      total: activityEntries.length,
      edited: activityEntries.filter((e) => e.type === 'edit').length,
      escalations: 0,
      collaboration: activityEntries.filter((e) => e.type === 'comment').length,
    }),
    [activityEntries]
  );

  const activityTypeMeta = useCallback(
    (type: string): ActivityTypeMeta => {
      switch (type) {
        case 'created':
          return {
            icon: <Plus size={12} />,
            label: t('interview.insightViewer.created'),
            style: 'bg-emerald-500 text-white',
          };
        case 'regenerated':
          return {
            icon: <RefreshCw size={12} />,
            label: t('interview.insightViewer.regenerated'),
            style: 'bg-amber-500 text-white',
          };
        case 'exported':
          return {
            icon: <Send size={12} />,
            label: t('interview.insightViewer.exported'),
            style: 'bg-blue-500 text-white',
          };
        case 'comment':
          return {
            icon: <MessageSquare size={12} />,
            label: t('interview.insightViewer.comment'),
            style: 'bg-c-tag-8 text-c-tag-foreground',
          };
        case 'edit':
          return {
            icon: <Sparkles size={12} />,
            label: t('interview.insightViewer.edit2'),
            style: 'bg-c-tag-2 text-c-tag-foreground',
          };
        default:
          return {
            icon: <Clock size={12} />,
            label: type,
            style: 'bg-c-tag-8 text-c-tag-foreground',
          };
      }
    },
    [isPolish]
  );

  // ── Section content assignment ─────────────────────────────────────────────

  const nModeSectionsWithContent = useMemo<NModeSection[]>(() => {
    // Build a component for every id we render — including the ids whose nav
    // entry was merged away (#23c). Their JSX is still produced here and then
    // composed into the surviving section below, so no content is lost.
    const renderIds: string[] = [
      ...INSIGHT_SECTIONS.map((s) => s.id),
      // merged-away ids (content folded into a surviving section)
      'truth-review-summary',
      'source-sessions',
      'traceability',
      // `artifact-actions` celowo NIEOBECNE — od 2026-07-23 kafelki „utwórz…"
      // renderuje prawy panel (sekcja Rezultaty), nie centrum.
    ];

    const componentById: Record<string, React.ReactNode> = {};

    for (const sectionId of renderIds) {
      const section = { id: sectionId } as { id: string };
      let component: React.ReactNode = null;

      switch (section.id) {
        // `artifact-actions` NIE MA już case'a w centrum — kafelki „utwórz…"
        // przeniosły się do prawego panelu, sekcja Rezultaty (§7.2 poz. 5).
        // Ich JSX powstaje raz, w `resultTilesNode` (jeden `ArtifactActionPanel`,
        // wariant `compact` pod szerokość panelu), więc nie ma dwóch kopii
        // konfiguracji `source` do rozjechania się.

        case 'truth-review-summary': {
          const postureMeta = {
            ready: {
              label: t('interview.insightViewer.readyForGovernedPublish'),
              className:
                'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-200',
            },
            review_needed: {
              label: t('interview.insightViewer.operatorReviewNeeded'),
              className:
                'border-amber-500/20 bg-amber-500/[0.08] text-amber-700 dark:text-amber-200',
            },
            weak: {
              label: t('interview.insightViewer.weakDecisionMaterial'),
              className:
                'border-danger-500/20 bg-danger-500/[0.08] text-danger-700 dark:text-danger-200',
            },
          }[truthReviewSummary.posture];

          component = (
            <div className="space-y-5">
              <div className={`rounded-2xl border px-4 py-3 ${postureMeta.className}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
                      {t('interview.insightViewer.truthReviewSummary')}
                    </div>
                    <div className="mt-1 text-sm font-semibold">{postureMeta.label}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                    <span className="rounded-full bg-white/60 px-2 py-1 dark:bg-white/[0.08]">
                      P10 {findingsSummary.total}
                    </span>
                    <span className="rounded-full bg-white/60 px-2 py-1 dark:bg-white/[0.08]">
                      {t('interview.insightViewer.evidence')} {findingsSummary.activeEvidence}
                    </span>
                    <span className="rounded-full bg-white/60 px-2 py-1 dark:bg-white/[0.08]">
                      Readback {readbackSummary.confirmed}/{findingsSummary.total}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-c-border-subtle bg-white px-4 py-4 dark:border-white/[0.08] dark:bg-c-surface-raised/50">
                  <div className={TEXT_L1}>{t('interview.insightViewer.safeClaims')}</div>
                  <div className="mt-3 space-y-2">
                    {truthReviewSummary.safeClaims.length > 0 ? (
                      truthReviewSummary.safeClaims.map((finding) => (
                        <div key={finding.id} className="text-sm text-c-text-secondary">
                          <div className="font-medium text-c-text">{finding.finding_statement}</div>
                          <div className="mt-1 text-xs text-c-text-muted">
                            {finding.confidence_level} ·{' '}
                            {
                              finding.evidence_pointers.filter((pointer) => !pointer.isTombstone)
                                .length
                            }{' '}
                            {t('interview.insightViewer.ev')}
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyStateInline
                        icon={ShieldAlert}
                        message={t('interview.insightViewer.noFindingsWithActiveEvidence')}
                      />
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-c-border-subtle bg-white px-4 py-4 dark:border-white/[0.08] dark:bg-c-surface-raised/50">
                  <div className="flex items-center justify-between gap-3">
                    <div className={TEXT_L1}>
                      {t('interview.insightViewer.publishHandoffBlockers')}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNSection('candidate-triage')}
                      className="text-[11px] font-semibold text-c-text-secondary hover:text-c-text"
                    >
                      {t('interview.insightViewer.triage')}
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {truthReviewSummary.publishBlockers.length > 0 ? (
                      truthReviewSummary.publishBlockers.map((blocker) => (
                        <div
                          key={blocker}
                          className="rounded-xl bg-amber-500/[0.08] px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
                        >
                          {blocker}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl bg-emerald-500/[0.08] px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200">
                        {t('interview.insightViewer.noEvidenceReadbackBlockersFor')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-c-border-subtle bg-white px-4 py-4 dark:border-white/[0.08] dark:bg-c-surface-raised/50">
                  <div className="flex items-center justify-between gap-3">
                    <div className={TEXT_L1}>{t('interview.insightViewer.contradictions')}</div>
                    <button
                      type="button"
                      onClick={() => setActiveNSection('signals')}
                      className="text-[11px] font-semibold text-c-text-secondary hover:text-c-text"
                    >
                      {t('interview.insightViewer.signals')}
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {truthReviewSummary.contradictionSignals.length > 0 ? (
                      truthReviewSummary.contradictionSignals.slice(0, 4).map((signal) => (
                        <div
                          key={`${signal.title}-${signal.description}`}
                          className="rounded-xl bg-danger-500/[0.07] px-3 py-2 text-sm text-danger-800 dark:text-danger-200"
                        >
                          <div className="font-medium">{signal.title}</div>
                          {signal.description && (
                            <div className="mt-1 text-xs opacity-80">{signal.description}</div>
                          )}
                        </div>
                      ))
                    ) : (
                      <EmptyStateInline
                        icon={Radio}
                        message={t('interview.insightViewer.noExplicitContradictionSignals')}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
          break;
        }

        case 'executive-summary':
          component = (
            <div className="space-y-4">
              {renderSectionCardHeader('executive-summary', !!executiveSummary)}
              <Callout variant="purple" title={t('interview.insightViewer.readThisAsAConsulting')}>
                {executiveSummary || t('interview.insightViewer.noSummaryAvailable')}
              </Callout>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised px-4 py-3 shadow-[inset_3px_0_0_var(--c-border-strong)]">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-muted">
                    {t('interview.insightViewer.officialAnswers')}
                  </div>
                  {/* Wszystkie trzy kafle czytają `insightCounts` — te same
                      liczby, co plakietki nawigacji (R2/defekt #3). */}
                  <div className="mt-1 text-2xl font-bold text-c-text">
                    {insightCounts.officialAnswers}
                  </div>
                </div>
                <div className="rounded-xl border border-danger-200/40 dark:border-danger-900/30 bg-danger-50/60 dark:bg-danger-500/10 px-4 py-3 shadow-[inset_3px_0_0_theme(colors.danger.400)]">
                  {/* AA (sędzia grafiki, pkt 6): `danger-500` (#E80538) na jasnym
                      tle dawał 4,21:1 przy 11 px — poniżej progu 4,5. `danger-700`
                      (#910A28) to odcień opisany w palecie jako „AA text on white".
                      Ciemny motyw zmierzony na 7,3:1 → `danger-400` zostaje. */}
                  <div className="text-[11px] uppercase tracking-[0.16em] text-danger-700 dark:text-danger-400">
                    {t('interview.insightViewer.issuesRisks')}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-c-text">{insightCounts.issues}</div>
                </div>
                <div className="rounded-xl border border-emerald-200/40 dark:border-emerald-900/30 bg-emerald-50/60 dark:bg-emerald-500/10 px-4 py-3 shadow-[inset_3px_0_0_theme(colors.emerald.400)]">
                  {/* AA (sędzia grafiki, pkt 6): `emerald-600` (#388A22) dawał
                      4,08:1 przy 11 px. `emerald-700` (#026833) = HBS Green 1,
                      w palecie opisany jako AA na białym. Dark bez zmian. */}
                  <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
                    {t('interview.insightViewer.signalsOpportunities')}
                  </div>
                  {/* Kafel łączy dwie sekcje nawigacji („Sygnały" +
                      „Przestrzenie szans"), więc jego wartość musi być SUMĄ
                      dokładnie tych dwóch liczników — nie trzeciego zestawu. */}
                  <div className="mt-1 text-2xl font-bold text-c-text">
                    {insightCounts.signals + insightCounts.opportunities}
                  </div>
                </div>
              </div>

              {evidenceQuotes.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {evidenceQuotes.slice(0, 2).map((quote) => (
                    <div
                      key={quote}
                      className="rounded-2xl bg-c-surface-raised px-4 py-3 text-sm italic text-c-text-secondary"
                    >
                      "{quote}"
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          break;

        case 'consulting-readout': {
          const contradictionSignals = v6Signals.filter((s) => s.type === 'contradiction');
          const readoutHasContent =
            contradictionSignals.length > 0 ||
            issuesReadout.length > 0 ||
            opportunityReadout.length > 0 ||
            !!executiveSummary;
          component = (
            <div className="space-y-5">
              {renderSectionCardHeader('consulting-readout', readoutHasContent)}
              {contradictionSignals.length > 0 && (
                <Callout
                  variant="critical"
                  title={t('interview.insightViewer.contradictionsDetected')}
                >
                  <ul className="list-disc list-inside space-y-1">
                    {contradictionSignals.map((s, idx) => (
                      <li key={idx} className="text-sm">
                        <span className="font-medium">{s.title}</span>
                        {s.description && <> — {s.description}</>}
                      </li>
                    ))}
                  </ul>
                </Callout>
              )}
              <Callout variant="info" title={t('interview.insightViewer.interpretationScope')}>
                {t('interview.insightViewer.thisIsTheConsultingLayer')}
              </Callout>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="space-y-3">
                  <div className={TEXT_L1}>{t('interview.insightViewer.officialAnswers2')}</div>
                  {officialAnswers.length > 0 ? (
                    officialAnswers.map((item) => (
                      <div
                        key={item}
                        className="rounded-xl border border-c-border-subtle bg-c-surface-raised px-4 py-3 text-sm text-c-text-secondary shadow-[inset_3px_0_0_var(--c-border-strong)]"
                      >
                        {item}
                      </div>
                    ))
                  ) : (
                    <EmptyStateInline
                      icon={FileText}
                      message={t('interview.insightViewer.noSourceFactsAvailable')}
                    />
                  )}
                </div>

                <div className="space-y-3">
                  {/* AA (pkt 6) — ta sama zamiana co w kaflach wyżej. */}
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-danger-700 dark:text-danger-400">
                    {t('interview.insightViewer.issuesRisks2')}
                  </div>
                  {issuesReadout.length > 0 ? (
                    issuesReadout.map((item) => (
                      <div
                        key={item}
                        className="rounded-xl border border-danger-200/40 dark:border-danger-900/30 bg-danger-50/60 dark:bg-danger-500/10 px-4 py-3 text-sm text-c-text-secondary shadow-[inset_3px_0_0_theme(colors.danger.400)]"
                      >
                        {item}
                      </div>
                    ))
                  ) : (
                    <EmptyStateInline
                      icon={AlertTriangle}
                      message={t('interview.insightViewer.noClearIssuesToSurface')}
                    />
                  )}
                </div>

                <div className="space-y-3">
                  {/* AA (pkt 6) — ta sama zamiana co w kaflach wyżej. */}
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
                    {t('interview.insightViewer.signalsOpportunities2')}
                  </div>
                  {uniqueNonEmpty([...hiddenSignals, ...opportunityReadout]).length > 0 ? (
                    uniqueNonEmpty([...hiddenSignals, ...opportunityReadout]).map((item) => (
                      <div
                        key={item}
                        className="rounded-xl border border-emerald-200/40 dark:border-emerald-900/30 bg-emerald-50/60 dark:bg-emerald-500/10 px-4 py-3 text-sm text-c-text-secondary shadow-[inset_3px_0_0_theme(colors.emerald.400)]"
                      >
                        {item}
                      </div>
                    ))
                  ) : (
                    <EmptyStateInline
                      icon={Sparkles}
                      message={t('interview.insightViewer.noSignalsOrOpportunitiesYet')}
                    />
                  )}
                </div>
              </div>
            </div>
          );
          break;
        }

        case 'material-quality': {
          const quality = materialQuality;
          const score = quality?.overall_material_score ?? 0;
          const postureColor =
            score >= 80
              ? 'text-emerald-400'
              : score >= 60
                ? 'text-blue-400'
                : score >= 40
                  ? 'text-amber-400'
                  : 'text-danger-400';
          component = (
            <div className="space-y-5">
              <Callout
                variant={score >= 60 ? 'info' : 'warning'}
                title={t('interview.insightViewer.materialQualityIsNotA')}
              >
                {t('interview.insightViewer.thisCardExplainsHowFar')}
              </Callout>

              {quality ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                        {t('interview.insightViewer.score')}
                      </div>
                      <div className={`mt-1 text-2xl font-semibold ${postureColor}`}>
                        {score}/100
                      </div>
                    </div>
                    <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                        {t('interview.insightViewer.answerQuality')}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-c-text">
                        {quality.answer_quality_posture}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                        {t('interview.insightViewer.coverage')}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-c-text">
                        {quality.coverage_posture}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                        {t('interview.insightViewer.sessionsRespondents')}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-c-text">
                        {quality.approved_session_count} / {quality.respondent_count}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-c-border-subtle bg-c-surface-raised p-4">
                      <h4 className="text-sm font-semibold text-c-text">
                        {t('interview.insightViewer.materialLimitations')}
                      </h4>
                      {quality.limitations.length > 0 ? (
                        <ul className="mt-3 space-y-2 text-sm text-c-text-secondary">
                          {quality.limitations.map((item) => (
                            <li key={item} className="flex gap-2">
                              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-400" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-sm text-c-text-muted">
                          {t('interview.insightViewer.noExplicitLimitationsBeyondNormal')}
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-c-border-subtle bg-c-surface-raised p-4">
                      <h4 className="text-sm font-semibold text-c-text">
                        {t('interview.insightViewer.gapsAndFollowUp')}
                      </h4>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-c-text-secondary">
                        <div>
                          {t('interview.insightViewer.thinAnswers')}:{' '}
                          <span className="text-c-text-muted">{quality.thin_answer_count}</span>
                        </div>
                        <div>
                          {t('interview.insightViewer.evidenceGaps')}:{' '}
                          <span className="text-c-text-muted">{quality.evidence_gap_count}</span>
                        </div>
                        <div>
                          {t('interview.insightViewer.contradictions')}:{' '}
                          <span className="text-c-text-muted">{quality.contradiction_count}</span>
                        </div>
                        <div>
                          {t('interview.insightViewer.missingVoices')}:{' '}
                          <span className="text-c-text-muted">{quality.missing_voices.length}</span>
                        </div>
                      </div>
                      {quality.recommended_followups.length > 0 && (
                        <ul className="mt-3 space-y-2 text-sm text-c-text-secondary">
                          {quality.recommended_followups.map((item) => (
                            <li key={item} className="flex gap-2">
                              <MessageSquare size={15} className="mt-0.5 shrink-0 text-blue-400" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                        {t('interview.insightViewer.rolesCovered')}
                      </div>
                      <div className="mt-2 text-sm text-c-text-secondary">
                        {quality.role_coverage.length > 0
                          ? quality.role_coverage.join(', ')
                          : t('interview.insightViewer.noRoleMetadata')}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                        {t('interview.insightViewer.departmentsCovered')}
                      </div>
                      <div className="mt-2 text-sm text-c-text-secondary">
                        {quality.department_coverage.length > 0
                          ? quality.department_coverage.join(', ')
                          : t('interview.insightViewer.noDepartmentMetadata')}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyStateInline
                  icon={AlertCircle}
                  message={t('interview.insightViewer.materialQualityWillAppearAfter')}
                />
              )}
            </div>
          );
          break;
        }

        case 'report-pack': {
          const worksheets = reportPack?.worksheets || [];
          const generatedCount = worksheets.filter(
            (worksheet) => worksheet.status === 'generated'
          ).length;
          const degradedCount = worksheets.filter(
            (worksheet) => worksheet.status === 'degraded'
          ).length;
          const partialCount = worksheets.filter(
            (worksheet) => worksheet.status === 'partial'
          ).length;
          const readinessStatus = reportReadiness?.status || 'blocked';
          const readinessLabel =
            readinessStatus === 'ready_for_review'
              ? t('interview.insightViewer.passReadyForReview')
              : readinessStatus === 'ready_with_warnings'
                ? t('interview.insightViewer.passWithP2ReviewWarnings')
                : t('interview.insightViewer.blockedP1ReadinessBlockers');
          component = (
            <div className="space-y-5">
              {renderSectionCardHeader('report-pack', worksheets.length > 0)}
              <Callout
                variant={reportPack?.degraded ? 'warning' : 'info'}
                title={t('interview.insightViewer.reportPack')}
              >
                {t('interview.insightViewer.thisIsTheControlledProjection')}
              </Callout>

              {reportPack ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                        {t('interview.insightViewer.completeness')}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-c-text">
                        {reportPack.completenessScore}%
                      </div>
                    </div>
                    <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                        {t('interview.insightViewer.worksheets')}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-c-text">
                        {worksheets.length}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                        {t('interview.insightViewer.generatedPartial')}
                      </div>
                      <div className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-300">
                        {generatedCount} / {partialCount}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                        {t('interview.insightViewer.degraded')}
                      </div>
                      <div
                        className={`mt-1 text-lg font-semibold ${
                          degradedCount > 0
                            ? 'text-amber-600 dark:text-amber-300'
                            : 'text-emerald-600 dark:text-emerald-300'
                        }`}
                      >
                        {degradedCount}
                      </div>
                    </div>
                  </div>

                  <Callout
                    variant={
                      readinessStatus === 'blocked'
                        ? 'warning'
                        : readinessStatus === 'ready_with_warnings'
                          ? 'info'
                          : 'success'
                    }
                    title={t('interview.insightViewer.reportReadinessGate')}
                    compact
                  >
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">{readinessLabel}</div>
                      <div className="text-sm">
                        {t('interview.insightViewer.gateCompletenessSummary', {
                          score: reportReadiness?.completenessScore ?? reportPack.completenessScore,
                          blockers: reportReadiness?.blockers.length ?? 0,
                          warnings: reportReadiness?.warnings.length ?? 0,
                        })}
                      </div>
                      {reportReadiness?.blockers.length ? (
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {reportReadiness.blockers.slice(0, 4).map((issue) => (
                            <li key={`${issue.worksheetKey || 'pack'}:${issue.message}`}>
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleSubmitReportForReview}
                          disabled={
                            reportReviewSubmitting ||
                            !reportReadiness ||
                            reportPack.status === 'in_review' ||
                            reportPack.status === 'published'
                          }
                          // SPEC-N §2.3 — poza slotem primary (nagłówek:
                          // „Konwertuj na inicjatywę") żaden element powierzchni
                          // artefaktu nie jest solid/filled. Był solid navy/biały
                          // na całą szerokość; teraz neutralny outline na tokenach
                          // c-* (ta sama akcja, słabszy głos wizualny).
                          className="rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs font-semibold text-c-text transition hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {reportReviewSubmitting
                            ? t('interview.insightViewer.submitting')
                            : reportPack.status === 'in_review'
                              ? t('interview.insightViewer.inReview')
                              : reportPack.status === 'published'
                                ? t('interview.insightViewer.published')
                                : t('interview.insightViewer.submitForReview')}
                        </button>
                        <button
                          type="button"
                          onClick={handlePublishReportPack}
                          disabled={
                            reportPublishing ||
                            !reportReadiness ||
                            reportPack.status !== 'in_review' ||
                            reportReadiness.status !== 'ready_for_review'
                          }
                          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
                        >
                          {reportPublishing
                            ? t('interview.insightViewer.publishing')
                            : reportPack.status === 'published'
                              ? t('interview.insightViewer.published')
                              : t('interview.insightViewer.publish')}
                        </button>
                        <button
                          type="button"
                          onClick={handleExportReportManifest}
                          disabled={reportExporting || reportPack.status !== 'published'}
                          className="rounded-xl border border-c-border-subtle bg-c-surface px-3 py-2 text-xs font-semibold text-c-text-secondary transition hover:border-c-border-strong hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {reportExporting
                            ? t('interview.insightViewer.downloading')
                            : t('interview.insightViewer.downloadManifest')}
                        </button>
                        <button
                          type="button"
                          onClick={handleExportReportMarkdown}
                          disabled={reportMarkdownExporting || reportPack.status !== 'published'}
                          className="rounded-xl border border-c-border-subtle bg-c-surface px-3 py-2 text-xs font-semibold text-c-text-secondary transition hover:border-c-border-strong hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {reportMarkdownExporting
                            ? t('interview.insightViewer.downloading')
                            : t('interview.insightViewer.downloadReportMd')}
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateReportRevision}
                          disabled={reportRevisionCreating || reportPack.status !== 'published'}
                          className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300"
                        >
                          {reportRevisionCreating
                            ? t('interview.insightViewer.creatingDraft')
                            : t('interview.insightViewer.newDraftFromPublished')}
                        </button>
                        {reportReadiness?.status === 'blocked' && (
                          <span className="text-xs text-amber-700 dark:text-amber-300">
                            {t('interview.insightViewer.backendWillBlockTheTransition')}
                          </span>
                        )}
                        {reportPack.status === 'draft' &&
                          reportReadiness?.status === 'ready_for_review' && (
                            <span className="text-xs text-c-text-muted">
                              {t('interview.insightViewer.publishRequiresReviewFirst')}
                            </span>
                          )}
                        {reportPack.status === 'in_review' &&
                          reportReadiness?.status !== 'ready_for_review' && (
                            <span className="text-xs text-amber-700 dark:text-amber-300">
                              {t('interview.insightViewer.publishRequiresFullPassWith')}
                            </span>
                          )}
                      </div>
                      {!reportReadiness && (
                        <div className="text-xs text-c-text-muted">
                          {t('interview.insightViewer.theGateIsTemporarilyUnavailable')}
                        </div>
                      )}
                    </div>
                  </Callout>

                  {reportPack.degradedReasons.length > 0 && (
                    <Callout
                      variant="warning"
                      title={t('interview.insightViewer.reportLimitations')}
                      compact
                    >
                      <ul className="list-disc list-inside space-y-1">
                        {reportPack.degradedReasons.map((reason) => (
                          <li key={reason} className="text-sm">
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </Callout>
                  )}

                  {reportPack.status === 'published' && (
                    <Callout
                      variant="success"
                      title={t('interview.insightViewer.reportPublished')}
                      compact
                    >
                      {t('interview.insightViewer.thisPackIsPublishedAnd')}
                    </Callout>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {worksheets.map((worksheet) => (
                      <div
                        key={worksheet.key}
                        className="rounded-2xl border border-c-border-subtle bg-white/80 px-4 py-3 dark:border-white/[0.08] dark:bg-c-surface-raised/50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-c-text">
                              {worksheet.title}
                            </div>
                            <div className="mt-1 text-xs text-c-text-muted">
                              {worksheet.rows.length} {t('interview.insightViewer.rows')} ·{' '}
                              {worksheet.completenessScore}%
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                              worksheet.status === 'generated'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : worksheet.status === 'degraded'
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                  : worksheet.status === 'partial'
                                    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                    : 'bg-c-text-muted/10 text-c-text-secondary'
                            }`}
                          >
                            {worksheet.status}
                          </span>
                        </div>
                        {worksheet.warnings.length > 0 && (
                          <div className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300">
                            {worksheet.warnings.slice(0, 2).map((warning) => (
                              <div key={warning}>{warning}</div>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {(
                            [
                              {
                                status: 'generated' as const,
                                label: t('interview.insightViewer.generated'),
                                score: 100,
                                warnings: [],
                              },
                              {
                                status: 'partial' as const,
                                label: t('interview.insightViewer.partial'),
                                score: Math.max(worksheet.completenessScore || 70, 70),
                                warnings:
                                  worksheet.warnings.length > 0
                                    ? worksheet.warnings
                                    : [
                                        t(
                                          'interview.insightViewer.worksheetNeedsOperatorCompletion'
                                        ),
                                      ],
                              },
                              {
                                status: 'degraded' as const,
                                label: t('interview.insightViewer.degraded2'),
                                score: Math.min(worksheet.completenessScore || 40, 40),
                                warnings:
                                  worksheet.warnings.length > 0
                                    ? worksheet.warnings
                                    : [
                                        t(
                                          'interview.insightViewer.worksheetMarkedDegradedByOperator'
                                        ),
                                      ],
                              },
                            ] satisfies Array<{
                              status: V8InterviewReportWorksheetStatus;
                              label: string;
                              score: number;
                              warnings: string[];
                            }>
                          ).map((action) => {
                            const loading =
                              worksheetActionLoadingKey === `${worksheet.key}:${action.status}`;
                            return (
                              <button
                                key={action.status}
                                type="button"
                                disabled={
                                  loading ||
                                  reportPack.status === 'published' ||
                                  worksheet.status === action.status
                                }
                                onClick={() =>
                                  handleWorksheetStatusUpdate(
                                    worksheet.key,
                                    action.status,
                                    action.score,
                                    action.warnings
                                  )
                                }
                                className="rounded-md border border-c-border-subtle px-2 py-1 text-[10px] font-semibold text-c-text-secondary transition-colors hover:border-c-border-strong hover:text-c-text disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                {loading ? t('interview.insightViewer.saving') : action.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyStateInline
                  icon={FileText}
                  message={t('interview.insightViewer.reportPackIsNotAvailable')}
                />
              )}
            </div>
          );
          break;
        }

        case 'source-pack':
          component = (
            <div className="space-y-5">
              <Callout
                variant={sourcePack?.degraded ? 'warning' : 'purple'}
                title={t('interview.insightViewer.sourceEvidencePack')}
              >
                {t('interview.insightViewer.thisIsTheExplicitSource')}
              </Callout>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.insightViewer.sessions')}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-c-text">
                    {sourcePack?.sourceSessionIds.length || insight?.sourceSessionIds?.length || 0}
                  </div>
                </div>
                <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.insightViewer.fragments')}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-c-text">
                    {sourcePack?.entries.length || 0}
                  </div>
                </div>
                <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.insightViewer.activeEvidence')}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-c-text">
                    {sourcePack?.activePointerCount ?? findingsSummary.activeEvidence}
                  </div>
                </div>
                <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.insightViewer.state')}
                  </div>
                  <div
                    className={`mt-1 text-sm font-semibold ${
                      sourcePack?.degraded
                        ? 'text-amber-600 dark:text-amber-300'
                        : 'text-emerald-600 dark:text-emerald-300'
                    }`}
                  >
                    {sourcePack?.degraded
                      ? t('interview.insightViewer.degraded2')
                      : t('interview.insightViewer.auditable')}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.insightViewer.readbackOk')}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-300">
                    {readbackSummary.confirmed}
                  </div>
                </div>
                <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.insightViewer.challenged')}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-danger-600 dark:text-danger-300">
                    {readbackSummary.challenged}
                  </div>
                </div>
                <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.insightViewer.needsEvidence')}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-300">
                    {readbackSummary.needsMoreEvidence}
                  </div>
                </div>
                <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.insightViewer.unresolved')}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-c-text">
                    {readbackSummary.unresolved}
                  </div>
                </div>
              </div>

              {(sourcePack?.degradedReasons || []).length > 0 && (
                <Callout variant="warning" title={t('interview.insightViewer.sourceGaps')} compact>
                  <ul className="list-disc list-inside space-y-1">
                    {(sourcePack?.degradedReasons || []).map((reason) => (
                      <li key={reason} className="text-sm">
                        {reason}
                      </li>
                    ))}
                  </ul>
                </Callout>
              )}

              {sourcePack?.entries.length ? (
                <div className="space-y-3">
                  {sourcePack.entries.map((entry) => (
                    <div
                      key={entry.answerId}
                      className="rounded-2xl border border-c-border-subtle bg-white/70 dark:bg-c-surface-raised/30 px-4 py-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-c-text">
                            {entry.questionText || entry.answerId}
                          </div>
                          <div className="mt-1 text-[11px] text-c-text-muted">
                            {[
                              entry.respondentLabel,
                              entry.respondentRole,
                              entry.department,
                              entry.sourceSessionId,
                            ]
                              .filter(Boolean)
                              .join(' · ') || t('interview.insightViewer.noRespondentMetadata')}
                          </div>
                        </div>
                        {entry.degradedReason ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-medium">
                            <AlertTriangle size={10} />
                            {t('interview.insightViewer.missingPointer')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium">
                            <CheckCircle2 size={10} />
                            {entry.capturedPointers.length} {t('interview.insightViewer.ev')}
                          </span>
                        )}
                      </div>
                      <div className="rounded-xl bg-c-surface-raised px-3 py-2 text-xs italic text-c-text-secondary">
                        "{entry.answerSnippet}"
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          ...entry.linkedThemes,
                          ...entry.linkedIssues,
                          ...entry.linkedOpportunities,
                        ].map((label) => (
                          <span
                            key={label}
                            className="px-2 py-0.5 rounded-full bg-c-info/10 text-c-info dark:text-c-info text-[10px] font-medium"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyStateInline
                  icon={Link2}
                  message={t('interview.insightViewer.noSourcePackAvailable')}
                  hint={t('interview.insightViewer.sourcePackAppearsAfterInsight')}
                />
              )}
            </div>
          );
          break;

        case 'analysis-matrix': {
          const stakeholderLenses = analysis?.people.stakeholderLenses || [];
          const sessionLenses = analysis?.people.sessionLenses || [];
          const cellMeta = (cell?: V8InsightAnalysisMatrixCell) => {
            switch (cell?.state) {
              case 'supported':
                return {
                  label: t('interview.insightViewer.supports'),
                  className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                };
              case 'contradicted':
                return {
                  label: t('interview.insightViewer.contradicted'),
                  className: 'bg-danger-500/10 text-danger-700 dark:text-danger-300',
                };
              case 'local_only':
                return {
                  label: t('interview.insightViewer.localOnly'),
                  className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                };
              default:
                return {
                  label: t('interview.insightViewer.notObserved'),
                  className: 'bg-c-text-muted/10 text-c-text-secondary',
                };
            }
          };

          component = (
            <div className="space-y-5">
              <Callout
                variant="info"
                title={t('interview.insightViewer.analysisCanonPersonXTopic')}
              >
                {t('interview.insightViewer.thisLayerDoesNotCreate')}
              </Callout>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.insightViewer.posture')}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-c-text">
                    {analysis?.scope.posture === 'organization_synthesis'
                      ? t('interview.insightViewer.organizationSynthesis')
                      : analysis?.scope.posture === 'cross_perspective'
                        ? t('interview.insightViewer.crossPerspective')
                        : t('interview.insightViewer.singlePerspective')}
                  </div>
                </div>
                <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.insightViewer.sourceSessions')}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-c-text">
                    {analysis?.scope.sourceSessionCount || 0}
                  </div>
                </div>
                <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.insightViewer.lenses')}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-c-text">
                    {analysis?.scope.distinctStakeholderCount || 0}
                  </div>
                </div>
                <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.insightViewer.consensus')}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-c-text">
                    {consensusTopics.length}
                  </div>
                </div>
              </div>

              {(analysis?.synthesis.coverageGaps || []).length > 0 && (
                <Callout variant="warning" title={t('interview.insightViewer.coverageGaps')}>
                  <ul className="list-disc list-inside space-y-1">
                    {(analysis?.synthesis.coverageGaps || []).map((gap) => (
                      <li key={gap} className="text-sm">
                        {gap}
                      </li>
                    ))}
                  </ul>
                </Callout>
              )}

              <div className="rounded-2xl border border-c-border-subtle bg-white/70 dark:bg-c-surface-raised/30 px-4 py-4">
                <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                  <div className="inline-flex rounded-full bg-c-surface-raised p-1">
                    <button
                      type="button"
                      onClick={() => setAnalysisLensMode('stakeholder')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        analysisLensMode === 'stakeholder'
                          ? 'bg-white dark:bg-c-surface-raised text-c-text shadow-sm'
                          : 'text-c-text-muted'
                      }`}
                    >
                      {t('interview.insightViewer.stakeholderLenses')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalysisLensMode('session')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        analysisLensMode === 'session'
                          ? 'bg-white dark:bg-c-surface-raised text-c-text shadow-sm'
                          : 'text-c-text-muted'
                      }`}
                    >
                      {t('interview.insightViewer.sessionsPeople')}
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row gap-2 xl:ml-auto">
                    <select
                      value={analysisRoleFilter}
                      onChange={(e) => setAnalysisRoleFilter(e.target.value)}
                      className="h-10 rounded-xl border border-c-border-subtle bg-white dark:bg-c-surface-raised/50 px-3 text-sm text-c-text-secondary"
                    >
                      <option value="all">{t('interview.insightViewer.allRoles')}</option>
                      {analysisRoleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <select
                      value={analysisDepartmentFilter}
                      onChange={(e) => setAnalysisDepartmentFilter(e.target.value)}
                      className="h-10 rounded-xl border border-c-border-subtle bg-white dark:bg-c-surface-raised/50 px-3 text-sm text-c-text-secondary"
                    >
                      <option value="all">{t('interview.insightViewer.allDepartments')}</option>
                      {analysisDepartmentOptions.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="space-y-3">
                  <div className={TEXT_L1}>{t('interview.insightViewer.consensusTopics')}</div>
                  {consensusTopics.length > 0 ? (
                    consensusTopics.map((topic) => (
                      <div
                        key={topic.id}
                        className="rounded-2xl bg-emerald-500/[0.05] px-4 py-3 text-sm text-c-text-secondary"
                      >
                        <div className="font-medium text-c-text">{topic.label}</div>
                        <div className="mt-1 text-xs text-c-text-muted">
                          {topic.supportingStakeholderLabels.join(', ') ||
                            t('interview.insightViewer.noLenses')}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyStateInline
                      icon={CheckCircle2}
                      message={t('interview.insightViewer.noConfirmedConsensusYet')}
                    />
                  )}
                </div>

                <div className="space-y-3">
                  <div className={TEXT_L1}>{t('interview.insightViewer.localOnlySignals')}</div>
                  {localOnlyTopics.length > 0 ? (
                    localOnlyTopics.slice(0, 6).map((topic) => (
                      <div
                        key={topic.id}
                        className="rounded-2xl bg-amber-500/[0.05] px-4 py-3 text-sm text-c-text-secondary"
                      >
                        <div className="font-medium text-c-text">{topic.label}</div>
                        <div className="mt-1 text-xs text-c-text-muted">
                          {topic.supportingSessionIds.length === 1
                            ? sessionLenses.find((lens) =>
                                lens.sessionIds.includes(topic.supportingSessionIds[0])
                              )?.label || topic.supportingSessionIds[0]
                            : `${topic.supportingSessionIds.length} ${t('interview.insightViewer.sessions2')}`}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyStateInline
                      icon={Radio}
                      message={t('interview.insightViewer.noLocalOnlySignals')}
                    />
                  )}
                </div>

                <div className="space-y-3">
                  <div className={TEXT_L1}>
                    {analysisLensMode === 'stakeholder'
                      ? t('interview.insightViewer.stakeholderLenses')
                      : t('interview.insightViewer.sessionsPeople')}
                  </div>
                  {(analysisLensMode === 'stakeholder'
                    ? filteredStakeholderAnalysisLenses
                    : filteredSessionAnalysisLenses
                  ).length > 0 ? (
                    (analysisLensMode === 'stakeholder'
                      ? filteredStakeholderAnalysisLenses
                      : filteredSessionAnalysisLenses
                    ).map((lens) => (
                      <div
                        key={lens.id}
                        className="rounded-2xl bg-c-surface-raised px-4 py-3 text-sm text-c-text-secondary"
                      >
                        <div className="font-medium text-c-text">{lens.label}</div>
                        <div className="mt-1 text-xs text-c-text-muted space-y-1">
                          {lens.localSummary}
                          {(lens.role || lens.department) && (
                            <div>{[lens.role, lens.department].filter(Boolean).join(' · ')}</div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyStateInline
                      icon={Users}
                      message={t('interview.insightViewer.noLensesBuiltYet')}
                    />
                  )}
                </div>
              </div>

              {contradictedTopics.length > 0 && (
                <Callout
                  variant="critical"
                  title={t('interview.insightViewer.topicsWithCrossPerspectiveContradiction')}
                >
                  <ul className="list-disc list-inside space-y-1">
                    {contradictedTopics.map((topic) => (
                      <li key={topic.id} className="text-sm">
                        <span className="font-medium">{topic.label}</span>
                        {topic.supportingStakeholderLabels.length > 0 && (
                          <> ({topic.supportingStakeholderLabels.join(', ')})</>
                        )}
                      </li>
                    ))}
                  </ul>
                </Callout>
              )}

              {visibleAnalysisTopicRows.length > 0 && activeAnalysisColumns.length > 0 ? (
                <div className="rounded-2xl border border-c-border-subtle overflow-hidden">
                  <div className="px-4 py-3 border-b border-c-border-subtle bg-c-surface-raised">
                    <div className="text-sm font-semibold text-c-text">
                      {analysisLensMode === 'stakeholder'
                        ? t('interview.insightViewer.topicXStakeholderLensMatrix')
                        : t('interview.insightViewer.topicXSessionPersonMatrix')}
                    </div>
                    <div className="mt-1 text-xs text-c-text-muted">
                      {t('interview.insightViewer.cellsShowWhereAFinding')}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    {/* §27-exempt: pivot/cross-tab matrix — columns are dynamic (one per
                        session or stakeholder lens) and cells contain composite data
                        (support badge + evidence count). This is not a standard list
                        table; FilterableTable does not support pivot layouts. */}
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-white/70 dark:bg-c-surface-raised/30">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-c-text-secondary">
                            {t('interview.insightViewer.topic')}
                          </th>
                          {activeAnalysisColumns.map((column) => (
                            <th
                              key={column.id}
                              className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-c-text-secondary"
                            >
                              {column.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleAnalysisTopicRows.map((row) => (
                          <tr key={row.id} className="border-t border-c-border-subtle">
                            <td className="px-4 py-3 align-top min-w-[220px]">
                              <div className="font-medium text-c-text">{row.label}</div>
                              <div className="mt-1 text-xs text-c-text-muted">
                                {analysisTopicsById[row.id]?.kind}
                              </div>
                              {analysisTopicsById[row.id]?.perspectiveLabels?.length ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {analysisTopicsById[row.id]?.perspectiveLabels.map((label) => (
                                    <span
                                      key={label}
                                      className="inline-flex px-2 py-0.5 rounded-full bg-c-text-muted/10 text-c-text-secondary text-[10px] font-medium"
                                    >
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              {analysisTopicsById[row.id]?.divergenceNote && (
                                <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                                  {analysisTopicsById[row.id]?.divergenceNote}
                                </div>
                              )}
                            </td>
                            {activeAnalysisColumns.map((column) => {
                              const cell = activeAnalysisCellMap.get(`${row.id}:${column.id}`);
                              const meta = cellMeta(cell);
                              return (
                                <td key={column.id} className="px-3 py-3 align-top">
                                  <div
                                    className={`inline-flex px-2 py-1 rounded-full text-[10px] font-medium ${meta.className}`}
                                  >
                                    {meta.label}
                                  </div>
                                  {cell && cell.evidenceCount > 0 && (
                                    <div className="mt-1 text-[11px] text-c-text-muted">
                                      {cell.evidenceCount} {t('interview.insightViewer.ev')}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <EmptyStateInline
                  icon={BarChart3}
                  message={t('interview.insightViewer.noDataForTheCurrent')}
                />
              )}
            </div>
          );
          break;
        }

        case 'themes':
          component = (
            <div className="space-y-4">
              {renderSectionCardHeader('themes', v6Themes.length > 0)}
              {v6MissingData.length > 0 && (
                <Callout variant="warning" title={t('interview.insightViewer.missingData')} compact>
                  <ul className="list-disc list-inside space-y-0.5">
                    {v6MissingData.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </Callout>
              )}
              {v6Themes.length === 0 ? (
                <EmptyStateInline
                  icon={Layers}
                  message={t('interview.insightViewer.noThemesIdentifiedYet')}
                  hint={t('interview.insightViewer.themesWillAppearAfterV6')}
                  action={
                    canRegenerateV6
                      ? {
                          label: t('interview.insightViewer.generateV6Analysis'),
                          onClick: handleRegenerate,
                          disabled: isRegenerating,
                        }
                      : undefined
                  }
                />
              ) : (
                <div className="space-y-3">
                  {v6Themes.map((theme, idx) => {
                    const persistedFinding = findingsBySourceKey[`theme:${idx}`];
                    const findingConfidence = (persistedFinding?.confidence_level ||
                      theme.confidence) as P10ConfidenceLevel | undefined;
                    const findingLimits =
                      persistedFinding?.limits
                        ?.split(/\r?\n/)
                        .map((item) => item.trim())
                        .filter(Boolean) ||
                      theme.limits ||
                      [];
                    const activePointerCount =
                      persistedFinding?.evidence_pointers.filter((pointer) => !pointer.isTombstone)
                        .length || 0;
                    const confidenceBadgeMap: Record<
                      P10ConfidenceLevel,
                      { bg: string; label: string; labelPl: string }
                    > = {
                      high: {
                        bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                        label: 'High confidence',
                        labelPl: 'Wysoka pewność',
                      },
                      medium: {
                        bg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                        label: 'Medium confidence',
                        labelPl: 'Średnia pewność',
                      },
                      low: {
                        bg: 'bg-c-text-muted/15 text-c-text-muted',
                        label: 'Hypothesis',
                        labelPl: 'Hipoteza',
                      },
                      insufficient: {
                        bg: 'bg-danger-500/15 text-danger-600 dark:text-danger-400',
                        label: 'Insufficient data',
                        labelPl: 'Niewystarczające dane',
                      },
                      contradicted: {
                        bg: 'bg-danger-500/15 text-danger-600 dark:text-danger-400',
                        label: 'Contradiction',
                        labelPl: 'Sprzeczność',
                      },
                    };
                    const limitsKey = `theme-${idx}`;
                    const limitsExpanded = expandedLimits.has(limitsKey);
                    return (
                      <div key={idx} className="rounded-xl bg-c-surface-raised px-4 py-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-semibold text-c-text">{theme.title}</div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                theme.strength === 'strong'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : theme.strength === 'moderate'
                                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                    : 'bg-c-text-muted/15 text-c-text-muted'
                              }`}
                            >
                              {theme.strength === 'strong'
                                ? t('interview.insightViewer.strong')
                                : theme.strength === 'moderate'
                                  ? t('interview.insightViewer.moderate')
                                  : t('interview.insightViewer.weak')}
                            </span>
                            {findingConfidence && (
                              <span
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${confidenceBadgeMap[findingConfidence].bg}`}
                              >
                                {t(
                                  `interview.insightViewer.confidenceLevel.${findingConfidence}`,
                                  confidenceBadgeMap[findingConfidence].label
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        {findingConfidence === 'contradicted' && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-600 dark:text-danger-400 text-xs font-medium">
                            <AlertCircle size={14} />
                            {t('interview.insightViewer.contradictionDetectedInDataVerify')}
                          </div>
                        )}
                        <p className="text-sm text-c-text-secondary leading-relaxed max-w-prose">
                          {theme.description}
                        </p>
                        {theme.perspective_labels?.length || theme.divergence_note ? (
                          <div className="space-y-2">
                            {theme.perspective_labels && theme.perspective_labels.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {theme.perspective_labels.map((label) => (
                                  <span
                                    key={label}
                                    className="inline-flex px-2 py-0.5 rounded-full bg-c-text-muted/10 text-c-text-secondary text-[10px] font-medium"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {theme.divergence_note && (
                              <div className="text-xs text-amber-700 dark:text-amber-300">
                                {theme.divergence_note}
                              </div>
                            )}
                          </div>
                        ) : null}
                        <div className="border border-c-border-subtle rounded-lg">
                          <button
                            onClick={() => toggleLimitsExpand(limitsKey)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-c-text-muted hover:bg-state-hover transition-colors rounded-lg"
                          >
                            <AlertTriangle size={12} />
                            <span className="font-medium">
                              {t('interview.insightViewer.limitsAssumptions')}
                            </span>
                            {limitsExpanded ? (
                              <ChevronUp size={12} className="ml-auto" />
                            ) : (
                              <ChevronDown size={12} className="ml-auto" />
                            )}
                          </button>
                          {limitsExpanded && (
                            <div className="px-3 pb-2">
                              {findingLimits.length > 0 ? (
                                <ul className="space-y-1">
                                  {findingLimits.map((limit, li) => (
                                    <li key={li} className="text-xs italic text-c-text-muted">
                                      {limit}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs italic text-c-text-secondary">
                                  {t('interview.insightViewer.noLimitsSpecified')}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          {persistedFinding && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-c-text-muted/10 text-c-text-secondary text-[10px] font-medium">
                              <Target size={10} />
                              {t('interview.insightViewer.p10PointerCount', {
                                count: activePointerCount,
                              })}
                            </span>
                          )}
                          {theme.evidence_refs?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {theme.evidence_refs.map((ref) => {
                                const evidence = findEvidenceForRef(ref);
                                const isExpanded = expandedEvidenceRef === ref;
                                return (
                                  <div key={ref} className="inline-flex flex-col">
                                    <button
                                      onClick={() => toggleEvidenceRef(ref)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-c-info/10 text-c-info dark:text-c-info text-[10px] font-medium hover:bg-c-info/20 transition-colors"
                                    >
                                      <Zap size={10} />
                                      {evidence?.question_text
                                        ? evidence.question_text.slice(0, 40) +
                                          (evidence.question_text.length > 40 ? '…' : '')
                                        : ref.slice(0, 20)}
                                      {isExpanded ? (
                                        <ChevronUp size={10} />
                                      ) : (
                                        <ChevronDown size={10} />
                                      )}
                                    </button>
                                    {isExpanded && evidence && (
                                      <div className="mt-1.5 p-3 rounded-lg bg-white dark:bg-c-surface-raised border border-c-border-subtle text-xs space-y-1.5 max-w-sm">
                                        <div className="font-medium text-c-text-secondary">
                                          {evidence.question_text}
                                        </div>
                                        <div className="text-c-text-muted italic">
                                          "{evidence.answer_snippet}"
                                        </div>
                                        {evidence.linked_themes?.length > 0 && (
                                          <div className="flex flex-wrap gap-1 pt-0.5">
                                            {evidence.linked_themes.map((t) => (
                                              <span
                                                key={t}
                                                className="px-1.5 py-0.5 rounded bg-c-surface-raised text-[10px] text-c-text-muted"
                                              >
                                                {t}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <button
                            onClick={() =>
                              handleOpenHandoff({
                                findingId: persistedFinding?.id,
                                title: theme.title,
                                description: theme.description,
                                confidence: findingConfidence,
                                limits: findingLimits,
                                sectionType: 'theme',
                                index: idx,
                              })
                            }
                            disabled={!persistedFinding}
                            className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ExternalLink size={10} />
                            {t('interview.insightViewer.handoff')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
          break;

        case 'issues-risks':
          component = (
            <div className="space-y-4">
              {renderSectionCardHeader('issues-risks', v6Issues.length > 0)}
              {v6Issues.some((i) => i.severity === 'high') &&
                !v6Issues
                  .filter((i) => i.severity === 'high')
                  .every((i) => i.evidence_refs.length >= 2) && <EvidenceBadge />}
              {v6Issues.length === 0 ? (
                <EmptyStateInline
                  icon={ShieldAlert}
                  message={t('interview.insightViewer.noIssuesIdentifiedYet')}
                  hint={t('interview.insightViewer.issuesWillAppearAfterV6')}
                  action={
                    canRegenerateV6
                      ? {
                          label: t('interview.insightViewer.generateV6Analysis'),
                          onClick: handleRegenerate,
                          disabled: isRegenerating,
                        }
                      : undefined
                  }
                />
              ) : (
                <div className="space-y-3">
                  {v6Issues.map((issue, idx) => {
                    const persistedFinding = findingsBySourceKey[`issue:${idx}`];
                    const findingConfidence = (persistedFinding?.confidence_level ||
                      issue.confidence) as P10ConfidenceLevel | undefined;
                    const findingLimits =
                      persistedFinding?.limits
                        ?.split(/\r?\n/)
                        .map((item) => item.trim())
                        .filter(Boolean) ||
                      issue.limits ||
                      [];
                    const activePointerCount =
                      persistedFinding?.evidence_pointers.filter((pointer) => !pointer.isTombstone)
                        .length || 0;
                    const severityStyles =
                      issue.severity === 'high'
                        ? 'border-l-danger-500 bg-danger-500/[0.04] dark:bg-danger-500/10'
                        : issue.severity === 'medium'
                          ? 'border-l-amber-500 bg-amber-500/[0.04] dark:bg-amber-500/10'
                          : 'border-l-c-border-strong bg-c-surface-raised';
                    const severityBadge =
                      issue.severity === 'high'
                        ? 'bg-danger-500/15 text-danger-600 dark:text-danger-400'
                        : issue.severity === 'medium'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : 'bg-c-text-muted/15 text-c-text-muted';
                    const confMap: Record<
                      P10ConfidenceLevel,
                      { bg: string; label: string; labelPl: string }
                    > = {
                      high: {
                        bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                        label: 'High confidence',
                        labelPl: 'Wysoka pewność',
                      },
                      medium: {
                        bg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                        label: 'Medium confidence',
                        labelPl: 'Średnia pewność',
                      },
                      low: {
                        bg: 'bg-c-text-muted/15 text-c-text-muted',
                        label: 'Hypothesis',
                        labelPl: 'Hipoteza',
                      },
                      insufficient: {
                        bg: 'bg-danger-500/15 text-danger-600 dark:text-danger-400',
                        label: 'Insufficient data',
                        labelPl: 'Niewystarczające dane',
                      },
                      contradicted: {
                        bg: 'bg-danger-500/15 text-danger-600 dark:text-danger-400',
                        label: 'Contradiction',
                        labelPl: 'Sprzeczność',
                      },
                    };
                    const limitsKey = `issue-${idx}`;
                    const limitsExpanded = expandedLimits.has(limitsKey);
                    return (
                      <div
                        key={idx}
                        className={`rounded-xl border-l-4 ${severityStyles} px-4 py-4 space-y-2`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-semibold text-c-text">{issue.title}</div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${severityBadge}`}
                            >
                              {issue.severity === 'high'
                                ? t('interview.insightViewer.high')
                                : issue.severity === 'medium'
                                  ? t('interview.insightViewer.medium')
                                  : t('interview.insightViewer.low')}
                            </span>
                            {findingConfidence && (
                              <span
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${confMap[findingConfidence].bg}`}
                              >
                                {t(
                                  `interview.insightViewer.confidenceLevel.${findingConfidence}`,
                                  confMap[findingConfidence].label
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        {findingConfidence === 'contradicted' && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-600 dark:text-danger-400 text-xs font-medium">
                            <AlertCircle size={14} />
                            {t('interview.insightViewer.contradictionDetectedInDataVerify')}
                          </div>
                        )}
                        <p className="text-sm text-c-text-secondary leading-relaxed max-w-prose">
                          {issue.description}
                        </p>
                        {issue.perspective_labels?.length || issue.divergence_note ? (
                          <div className="space-y-2">
                            {issue.perspective_labels && issue.perspective_labels.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {issue.perspective_labels.map((label) => (
                                  <span
                                    key={label}
                                    className="inline-flex px-2 py-0.5 rounded-full bg-c-text-muted/10 text-c-text-secondary text-[10px] font-medium"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {issue.divergence_note && (
                              <div className="text-xs text-amber-700 dark:text-amber-300">
                                {issue.divergence_note}
                              </div>
                            )}
                          </div>
                        ) : null}
                        <div className="border border-c-border-subtle rounded-lg">
                          <button
                            onClick={() => toggleLimitsExpand(limitsKey)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-c-text-muted hover:bg-state-hover transition-colors rounded-lg"
                          >
                            <AlertTriangle size={12} />
                            <span className="font-medium">
                              {t('interview.insightViewer.limitsAssumptions')}
                            </span>
                            {limitsExpanded ? (
                              <ChevronUp size={12} className="ml-auto" />
                            ) : (
                              <ChevronDown size={12} className="ml-auto" />
                            )}
                          </button>
                          {limitsExpanded && (
                            <div className="px-3 pb-2">
                              {findingLimits.length > 0 ? (
                                <ul className="space-y-1">
                                  {findingLimits.map((limit, li) => (
                                    <li key={li} className="text-xs italic text-c-text-muted">
                                      {limit}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs italic text-c-text-secondary">
                                  {t('interview.insightViewer.noLimitsSpecified')}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          {persistedFinding && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-c-text-muted/10 text-c-text-secondary text-[10px] font-medium">
                              <Target size={10} />
                              {t('interview.insightViewer.p10PointerCount', {
                                count: activePointerCount,
                              })}
                            </span>
                          )}
                          {issue.evidence_refs?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {issue.evidence_refs.map((ref) => {
                                const evidence = findEvidenceForRef(ref);
                                const isExpanded = expandedEvidenceRef === ref;
                                return (
                                  <div key={ref} className="inline-flex flex-col">
                                    <button
                                      onClick={() => toggleEvidenceRef(ref)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-c-info/10 text-c-info dark:text-c-info text-[10px] font-medium hover:bg-c-info/20 transition-colors"
                                    >
                                      <Zap size={10} />
                                      {evidence?.question_text
                                        ? evidence.question_text.slice(0, 40) +
                                          (evidence.question_text.length > 40 ? '…' : '')
                                        : ref.slice(0, 20)}
                                      {isExpanded ? (
                                        <ChevronUp size={10} />
                                      ) : (
                                        <ChevronDown size={10} />
                                      )}
                                    </button>
                                    {isExpanded && evidence && (
                                      <div className="mt-1.5 p-3 rounded-lg bg-white dark:bg-c-surface-raised border border-c-border-subtle text-xs space-y-1.5 max-w-sm">
                                        <div className="font-medium text-c-text-secondary">
                                          {evidence.question_text}
                                        </div>
                                        <div className="text-c-text-muted italic">
                                          "{evidence.answer_snippet}"
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <button
                            onClick={() =>
                              handleOpenHandoff({
                                findingId: persistedFinding?.id,
                                title: issue.title,
                                description: issue.description,
                                confidence: findingConfidence,
                                limits: findingLimits,
                                sectionType: 'issue',
                                index: idx,
                              })
                            }
                            disabled={!persistedFinding}
                            className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ExternalLink size={10} />
                            {t('interview.insightViewer.handoff')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
          break;

        case 'opportunities':
          component = (
            <div className="space-y-4">
              {renderSectionCardHeader('opportunities', v6Opportunities.length > 0)}
              {v6Opportunities.length === 0 ? (
                <EmptyStateInline
                  icon={TrendingUp}
                  message={t('interview.insightViewer.noOpportunitiesIdentifiedYet')}
                  hint={t('interview.insightViewer.opportunitiesWillAppearAfterV6')}
                  action={
                    canRegenerateV6
                      ? {
                          label: t('interview.insightViewer.generateV6Analysis'),
                          onClick: handleRegenerate,
                          disabled: isRegenerating,
                        }
                      : undefined
                  }
                />
              ) : (
                <div className="space-y-3">
                  {v6Opportunities.map((opp, idx) => {
                    const persistedFinding = findingsBySourceKey[`opportunity:${idx}`];
                    const findingConfidence = (persistedFinding?.confidence_level ||
                      opp.confidence) as P10ConfidenceLevel | undefined;
                    const findingLimits =
                      persistedFinding?.limits
                        ?.split(/\r?\n/)
                        .map((item) => item.trim())
                        .filter(Boolean) ||
                      opp.limits ||
                      [];
                    const activePointerCount =
                      persistedFinding?.evidence_pointers.filter((pointer) => !pointer.isTombstone)
                        .length || 0;
                    const impactBadge =
                      opp.impact === 'high'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : opp.impact === 'medium'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          : 'bg-c-text-muted/15 text-c-text-muted';
                    const confMap: Record<
                      P10ConfidenceLevel,
                      { bg: string; label: string; labelPl: string }
                    > = {
                      high: {
                        bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                        label: 'High confidence',
                        labelPl: 'Wysoka pewność',
                      },
                      medium: {
                        bg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                        label: 'Medium confidence',
                        labelPl: 'Średnia pewność',
                      },
                      low: {
                        bg: 'bg-c-text-muted/15 text-c-text-muted',
                        label: 'Hypothesis',
                        labelPl: 'Hipoteza',
                      },
                      insufficient: {
                        bg: 'bg-danger-500/15 text-danger-600 dark:text-danger-400',
                        label: 'Insufficient data',
                        labelPl: 'Niewystarczające dane',
                      },
                      contradicted: {
                        bg: 'bg-danger-500/15 text-danger-600 dark:text-danger-400',
                        label: 'Contradiction',
                        labelPl: 'Sprzeczność',
                      },
                    };
                    const limitsKey = `opp-${idx}`;
                    const limitsExpanded = expandedLimits.has(limitsKey);
                    return (
                      <div
                        key={idx}
                        className="rounded-xl bg-emerald-500/[0.03] dark:bg-emerald-500/[0.06] px-4 py-4 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-semibold text-c-text">{opp.title}</div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${impactBadge}`}
                            >
                              {opp.impact === 'high'
                                ? t('interview.insightViewer.highImpact')
                                : opp.impact === 'medium'
                                  ? t('interview.insightViewer.mediumImpact')
                                  : t('interview.insightViewer.lowImpact')}
                            </span>
                            {findingConfidence && (
                              <span
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${confMap[findingConfidence].bg}`}
                              >
                                {t(
                                  `interview.insightViewer.confidenceLevel.${findingConfidence}`,
                                  confMap[findingConfidence].label
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        {findingConfidence === 'contradicted' && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-600 dark:text-danger-400 text-xs font-medium">
                            <AlertCircle size={14} />
                            {t('interview.insightViewer.contradictionDetectedInDataVerify')}
                          </div>
                        )}
                        <p className="text-sm text-c-text-secondary leading-relaxed max-w-prose">
                          {opp.description}
                        </p>
                        {opp.perspective_labels?.length || opp.divergence_note ? (
                          <div className="space-y-2">
                            {opp.perspective_labels && opp.perspective_labels.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {opp.perspective_labels.map((label) => (
                                  <span
                                    key={label}
                                    className="inline-flex px-2 py-0.5 rounded-full bg-c-text-muted/10 text-c-text-secondary text-[10px] font-medium"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {opp.divergence_note && (
                              <div className="text-xs text-amber-700 dark:text-amber-300">
                                {opp.divergence_note}
                              </div>
                            )}
                          </div>
                        ) : null}
                        <div className="border border-c-border-subtle rounded-lg">
                          <button
                            onClick={() => toggleLimitsExpand(limitsKey)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-c-text-muted hover:bg-state-hover transition-colors rounded-lg"
                          >
                            <AlertTriangle size={12} />
                            <span className="font-medium">
                              {t('interview.insightViewer.limitsAssumptions')}
                            </span>
                            {limitsExpanded ? (
                              <ChevronUp size={12} className="ml-auto" />
                            ) : (
                              <ChevronDown size={12} className="ml-auto" />
                            )}
                          </button>
                          {limitsExpanded && (
                            <div className="px-3 pb-2">
                              {findingLimits.length > 0 ? (
                                <ul className="space-y-1">
                                  {findingLimits.map((limit, li) => (
                                    <li key={li} className="text-xs italic text-c-text-muted">
                                      {limit}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs italic text-c-text-secondary">
                                  {t('interview.insightViewer.noLimitsSpecified')}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          {persistedFinding && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-c-text-muted/10 text-c-text-secondary text-[10px] font-medium">
                              <Target size={10} />
                              {t('interview.insightViewer.p10PointerCount', {
                                count: activePointerCount,
                              })}
                            </span>
                          )}
                          {opp.evidence_refs?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {opp.evidence_refs.map((ref) => {
                                const evidence = findEvidenceForRef(ref);
                                const isExpanded = expandedEvidenceRef === ref;
                                return (
                                  <div key={ref} className="inline-flex flex-col">
                                    <button
                                      onClick={() => toggleEvidenceRef(ref)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-c-info/10 text-c-info dark:text-c-info text-[10px] font-medium hover:bg-c-info/20 transition-colors"
                                    >
                                      <Zap size={10} />
                                      {evidence?.question_text
                                        ? evidence.question_text.slice(0, 40) +
                                          (evidence.question_text.length > 40 ? '…' : '')
                                        : ref.slice(0, 20)}
                                      {isExpanded ? (
                                        <ChevronUp size={10} />
                                      ) : (
                                        <ChevronDown size={10} />
                                      )}
                                    </button>
                                    {isExpanded && evidence && (
                                      <div className="mt-1.5 p-3 rounded-lg bg-white dark:bg-c-surface-raised border border-c-border-subtle text-xs space-y-1.5 max-w-sm">
                                        <div className="font-medium text-c-text-secondary">
                                          {evidence.question_text}
                                        </div>
                                        <div className="text-c-text-muted italic">
                                          "{evidence.answer_snippet}"
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <button
                            onClick={() =>
                              handleOpenHandoff({
                                findingId: persistedFinding?.id,
                                title: opp.title,
                                description: opp.description,
                                confidence: findingConfidence,
                                limits: findingLimits,
                                sectionType: 'opportunity',
                                index: idx,
                              })
                            }
                            disabled={!persistedFinding}
                            className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ExternalLink size={10} />
                            {t('interview.insightViewer.handoff')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
          break;

        case 'signals':
          component = (
            <div className="space-y-4">
              {/* #57 fix: this card was missing the section header that every
                  other V6 card gets (state badge + Regenerate/Edit/Accept) —
                  add it for consistency, matching 'themes'/'issues-risks'/
                  'opportunities'/'evidence-map' above. */}
              {renderSectionCardHeader('signals', v6Signals.length > 0)}
              {v6Signals.length === 0 ? (
                <EmptyStateInline
                  icon={Radio}
                  message={t('interview.insightViewer.noSignalsDetectedYet')}
                  hint={t('interview.insightViewer.signalsWillAppearAfterV6')}
                  action={
                    canRegenerateV6
                      ? {
                          label: t('interview.insightViewer.generateV6Analysis'),
                          onClick: handleRegenerate,
                          disabled: isRegenerating,
                        }
                      : undefined
                  }
                />
              ) : (
                <div className="space-y-3">
                  {v6Signals.map((signal, idx) => {
                    const typeConfig: Record<
                      string,
                      { bg: string; label: string; labelPl: string; icon: React.ReactNode }
                    > = {
                      tension: {
                        bg: 'bg-danger-500/10 text-danger-600 dark:text-danger-400',
                        label: 'Tension',
                        labelPl: 'Napięcie',
                        icon: <Flame size={10} />,
                      },
                      gap: {
                        bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                        label: 'Gap',
                        labelPl: 'Luka',
                        icon: <Target size={10} />,
                      },
                      contradiction: {
                        bg: 'bg-c-info/10 text-c-info dark:text-c-info',
                        label: 'Contradiction',
                        labelPl: 'Sprzeczność',
                        icon: <AlertCircle size={10} />,
                      },
                      emerging_pattern: {
                        bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                        label: 'Emerging Pattern',
                        labelPl: 'Wzorzec',
                        icon: <Sparkles size={10} />,
                      },
                    };
                    const cfg = typeConfig[signal.type] || typeConfig.emerging_pattern;
                    return (
                      <div key={idx} className="rounded-xl bg-c-surface-raised px-4 py-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-semibold text-c-text">{signal.title}</div>
                          <span
                            className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.bg}`}
                          >
                            {cfg.icon}
                            {t(`interview.insightViewer.v6SignalType.${signal.type}`, cfg.label)}
                          </span>
                        </div>
                        <p className="text-sm text-c-text-secondary leading-relaxed max-w-prose">
                          {signal.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
          break;

        case 'evidence-map': {
          const entriesWithNoPointers = v6EvidenceMap.filter(
            (e) =>
              (!e.evidence_pointers || e.evidence_pointers.length === 0) &&
              (sourcePackByAnswerId[e.answer_id]?.capturedPointers.length || 0) === 0
          );
          const evidenceSatisfied =
            v6EvidenceMap.length === 0 || entriesWithNoPointers.length === 0;
          component = (
            <div className="space-y-4">
              {renderSectionCardHeader('evidence-map', v6EvidenceMap.length > 0)}
              {!evidenceSatisfied && <EvidenceBadge />}
              <Callout variant="purple" title={t('interview.insightViewer.evidenceMap')} compact>
                {t('interview.insightViewer.thisTableLinksSourceAnswers')}
              </Callout>
              {entriesWithNoPointers.length > 0 && (
                <Callout
                  variant="warning"
                  title={t('interview.insightViewer.missingEvidence')}
                  compact
                >
                  {t('interview.insightViewer.entriesNoEvidencePointers', {
                    count: entriesWithNoPointers.length,
                  })}
                </Callout>
              )}
              {v6EvidenceMap.some(
                (e) => e.answer_snippet === '[REDACTED]' || e.answer_snippet?.includes('[redacted]')
              ) && (
                <Callout
                  variant="critical"
                  title={t('interview.insightViewer.redactedData')}
                  compact
                >
                  {t('interview.insightViewer.someSourceAnswersHaveBeen')}
                </Callout>
              )}
              {v6EvidenceMap.length === 0 ? (
                <EmptyStateInline
                  icon={MapIcon}
                  message={t('interview.insightViewer.noEvidenceMapAvailable')}
                  hint={t('interview.insightViewer.mapWillAppearAfterV6')}
                  action={
                    canRegenerateV6
                      ? {
                          label: t('interview.insightViewer.generateV6Analysis'),
                          onClick: handleRegenerate,
                          disabled: isRegenerating,
                        }
                      : undefined
                  }
                />
              ) : (
                <InlineTable<InsightEvidenceMapEntry & Record<string, unknown>>
                  columns={
                    [
                      {
                        key: 'question',
                        header: t('interview.insightViewer.question'),
                        width: 'w-1/3',
                        render: (row) => (
                          <span className="text-xs font-medium text-c-text-secondary">
                            {row.question_text}
                          </span>
                        ),
                      },
                      {
                        key: 'answer',
                        header: t('interview.insightViewer.answer'),
                        width: 'w-1/3',
                        render: (row) => (
                          <span className="text-xs text-c-text-muted italic">
                            {row.answer_snippet?.length > 120
                              ? row.answer_snippet.slice(0, 120) + '…'
                              : row.answer_snippet}
                          </span>
                        ),
                      },
                      {
                        key: 'linked',
                        header: t('interview.insightViewer.links'),
                        render: (row) => {
                          const hasPointers =
                            (row.evidence_pointers && row.evidence_pointers.length > 0) ||
                            (sourcePackByAnswerId[row.answer_id]?.capturedPointers.length || 0) > 0;
                          return (
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1">
                                {row.linked_themes?.map((t: string) => (
                                  <span
                                    key={`t-${t}`}
                                    className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]"
                                  >
                                    {t}
                                  </span>
                                ))}
                                {row.linked_issues?.map((i: string) => (
                                  <span
                                    key={`i-${i}`}
                                    className="px-1.5 py-0.5 rounded bg-danger-500/10 text-danger-600 dark:text-danger-400 text-[10px]"
                                  >
                                    {i}
                                  </span>
                                ))}
                              </div>
                              {!hasPointers && (
                                <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                  <AlertTriangle size={10} />
                                  {t('interview.insightViewer.missingEvidencePublishBlocked')}
                                </div>
                              )}
                            </div>
                          );
                        },
                      },
                    ] as InlineTableColumn<InsightEvidenceMapEntry & Record<string, unknown>>[]
                  }
                  data={v6EvidenceMap as (InsightEvidenceMapEntry & Record<string, unknown>)[]}
                  rowKey={(row, idx) => row.answer_id || String(idx)}
                  emptyMessage={t('interview.insightViewer.noData')}
                  striped
                />
              )}
            </div>
          );
          break;
        }

        case 'candidate-triage': {
          const triageBadge = (
            status: V8InsightCandidate['triage_status']
          ): { label: string; className: string } => {
            switch (status) {
              case 'ready_for_review':
                return {
                  label: t('interview.insightViewer.readyForReview'),
                  className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                };
              case 'needs_evidence':
                return {
                  label: t('interview.insightViewer.needsEvidence2'),
                  className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                };
              case 'needs_split':
                return {
                  label: t('interview.insightViewer.needsSplit'),
                  className: 'bg-danger-500/10 text-danger-700 dark:text-danger-300',
                };
              case 'rejected':
                return {
                  label: t('interview.insightViewer.rejected'),
                  className: 'bg-c-text-muted/10 text-c-text-secondary',
                };
              case 'promoted':
                return {
                  label: t('interview.insightViewer.promoted'),
                  className: 'bg-c-info/10 text-c-info dark:text-c-info',
                };
              default:
                return {
                  label: t('interview.insightViewer.candidate'),
                  className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
                };
            }
          };

          component = (
            <div className="space-y-5">
              <Callout
                variant="warning"
                title={t('interview.insightViewer.workingLayerBeforeAP10')}
              >
                {t('interview.insightViewer.candidatesAreNotPublishableTruth')}
              </Callout>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.insightViewer.candidates')}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-c-text">
                    {candidateSummary.total}
                  </div>
                </div>
                <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.insightViewer.ready')}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-300">
                    {candidateSummary.ready}
                  </div>
                </div>
                <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.insightViewer.needsEvidence3')}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-300">
                    {candidateSummary.needsEvidence}
                  </div>
                </div>
                <div className="rounded-2xl bg-c-surface-raised px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.insightViewer.needsSplit')}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-danger-600 dark:text-danger-300">
                    {candidateSummary.needsSplit}
                  </div>
                </div>
              </div>

              {candidates.length > 0 ? (
                <div className="space-y-3">
                  {candidates.map((candidate) => {
                    const statusMeta = triageBadge(candidate.triage_status);
                    const linkedTopic = candidate.source_key
                      ? analysis?.topics.find((topic) => topic.sourceKey === candidate.source_key)
                      : null;
                    const linkedFinding = candidate.linked_finding_id
                      ? findings.find((finding) => finding.id === candidate.linked_finding_id)
                      : null;
                    const isBusy = candidateActionLoadingId === candidate.id;
                    return (
                      <div
                        key={candidate.id}
                        className="rounded-2xl bg-c-surface-raised px-4 py-4 space-y-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-c-text">
                              {candidate.candidate_statement}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${statusMeta.className}`}
                              >
                                {statusMeta.label}
                              </span>
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-c-text-muted/10 text-c-text-secondary">
                                {candidate.confidence_hint}
                              </span>
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-c-text-muted/10 text-c-text-secondary">
                                {candidate.followup_type}
                              </span>
                              {candidate.source_section_type && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-c-text-muted/10 text-c-text-secondary">
                                  {candidate.source_section_type}
                                </span>
                              )}
                            </div>
                          </div>
                          {linkedFinding && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-c-info/10 text-c-info dark:text-c-info text-[10px] font-medium">
                              <Target size={10} />
                              {t('interview.insightViewer.linkedFinding')}
                            </span>
                          )}
                        </div>

                        {candidate.rationale && (
                          <div className="text-sm text-c-text-secondary whitespace-pre-line max-w-prose">
                            {candidate.rationale}
                          </div>
                        )}

                        {linkedTopic?.divergenceNote && (
                          <div className="text-xs text-amber-700 dark:text-amber-300">
                            {linkedTopic.divergenceNote}
                          </div>
                        )}

                        <Callout
                          variant={
                            candidate.triage_status === 'needs_split'
                              ? 'critical'
                              : candidate.triage_status === 'needs_evidence'
                                ? 'warning'
                                : 'info'
                          }
                          title={t('interview.insightViewer.recommendedNextStep')}
                          compact
                        >
                          {candidate.followup_recommendation}
                        </Callout>

                        {linkedTopic?.supportingStakeholderLabels?.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {linkedTopic.supportingStakeholderLabels.map((label) => (
                              <span
                                key={label}
                                className="inline-flex px-2 py-0.5 rounded-full bg-c-text-muted/10 text-c-text-secondary text-[10px] font-medium"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {linkedFinding && (
                          <div className="rounded-xl border border-c-border-subtle bg-white/70 dark:bg-c-surface-raised/30 px-3 py-3 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className={TEXT_L1}>
                                  {t('interview.insightViewer.clientReadback')}
                                </div>
                                <div className="mt-1 text-xs text-c-text-secondary">
                                  {linkedFinding.readback_status}
                                  {linkedFinding.readback_summary
                                    ? ` · ${linkedFinding.readback_summary}`
                                    : ''}
                                </div>
                              </div>
                              {readbackLoadingId === linkedFinding.id && (
                                <Loader2
                                  size={14}
                                  className="animate-spin text-c-text-secondary flex-shrink-0"
                                />
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() =>
                                  handleReadbackStatus(linkedFinding, 'shared_for_readback')
                                }
                                disabled={readbackLoadingId === linkedFinding.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 text-xs font-medium disabled:opacity-50"
                              >
                                <Send size={12} />
                                {t('interview.insightViewer.shareReadback')}
                              </button>
                              <button
                                onClick={() =>
                                  handleReadbackStatus(linkedFinding, 'confirmed_by_client')
                                }
                                disabled={readbackLoadingId === linkedFinding.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-xs font-medium disabled:opacity-50"
                              >
                                <CheckCircle2 size={12} />
                                {t('interview.insightViewer.confirmed')}
                              </button>
                              <button
                                onClick={() =>
                                  handleReadbackStatus(linkedFinding, 'challenged_by_client')
                                }
                                disabled={readbackLoadingId === linkedFinding.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger-500/10 text-danger-700 dark:text-danger-300 hover:bg-danger-500/20 text-xs font-medium disabled:opacity-50"
                              >
                                <AlertCircle size={12} />
                                {t('interview.insightViewer.challenged')}
                              </button>
                              <button
                                onClick={() =>
                                  handleReadbackStatus(linkedFinding, 'needs_more_evidence')
                                }
                                disabled={readbackLoadingId === linkedFinding.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-xs font-medium disabled:opacity-50"
                              >
                                <AlertTriangle size={12} />
                                {t('interview.insightViewer.needsEvidence4')}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleCandidateAction(candidate, 'mark_needs_evidence')}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-xs font-medium disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <AlertTriangle size={12} />
                            )}
                            {t('interview.insightViewer.needsEvidence5')}
                          </button>
                          <button
                            onClick={() => handleCandidateAction(candidate, 'mark_needs_split')}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger-500/10 text-danger-700 dark:text-danger-300 hover:bg-danger-500/20 text-xs font-medium disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <AlertCircle size={12} />
                            )}
                            {t('interview.insightViewer.needsSplit')}
                          </button>
                          <button
                            onClick={() =>
                              handleCandidateAction(candidate, 'mark_ready_for_review')
                            }
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-xs font-medium disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                            {t('interview.insightViewer.readyForReview')}
                          </button>
                          <button
                            onClick={() => handleCandidateAction(candidate, 'reject')}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-c-text-muted/10 text-c-text-secondary hover:bg-c-text-muted/20 text-xs font-medium disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <X size={12} />
                            )}
                            {t('interview.insightViewer.reject')}
                          </button>
                          {candidate.triage_status !== 'promoted' &&
                            candidate.triage_status !== 'rejected' && (
                              <button
                                onClick={() =>
                                  handleCandidateAction(candidate, 'promote_to_finding')
                                }
                                disabled={isBusy || candidate.triage_status !== 'ready_for_review'}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-c-info/10 text-c-info dark:text-c-info hover:bg-c-info/20 text-xs font-medium disabled:opacity-50"
                              >
                                {isBusy ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Target size={12} />
                                )}
                                {candidate.triage_status === 'ready_for_review'
                                  ? t('interview.insightViewer.promoteToFinding')
                                  : t('interview.insightViewer.reviewFirst')}
                              </button>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyStateInline
                  icon={Eye}
                  message={t('interview.insightViewer.noCandidatesAvailableForTriage')}
                />
              )}
            </div>
          );
          break;
        }

        case 'people': {
          component = (
            <div className="space-y-5">
              <Callout
                variant="info"
                title={t('interview.insightViewer.readTheInsightThroughPeople')}
              >
                {t('interview.insightViewer.thisSectionShowsWhichTopics')}
              </Callout>

              <div className="rounded-2xl border border-c-border-subtle bg-white/70 dark:bg-c-surface-raised/30 px-4 py-4">
                <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                  <div className="inline-flex rounded-full bg-c-surface-raised p-1">
                    <button
                      type="button"
                      onClick={() => setAnalysisLensMode('stakeholder')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        analysisLensMode === 'stakeholder'
                          ? 'bg-white dark:bg-c-surface-raised text-c-text shadow-sm'
                          : 'text-c-text-muted'
                      }`}
                    >
                      {t('interview.insightViewer.stakeholderLenses')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalysisLensMode('session')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        analysisLensMode === 'session'
                          ? 'bg-white dark:bg-c-surface-raised text-c-text shadow-sm'
                          : 'text-c-text-muted'
                      }`}
                    >
                      {t('interview.insightViewer.sessionsPeople')}
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row gap-2 xl:ml-auto">
                    <select
                      value={analysisRoleFilter}
                      onChange={(e) => setAnalysisRoleFilter(e.target.value)}
                      className="h-10 rounded-xl border border-c-border-subtle bg-white dark:bg-c-surface-raised/50 px-3 text-sm text-c-text-secondary"
                    >
                      <option value="all">{t('interview.insightViewer.allRoles')}</option>
                      {analysisRoleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <select
                      value={analysisDepartmentFilter}
                      onChange={(e) => setAnalysisDepartmentFilter(e.target.value)}
                      className="h-10 rounded-xl border border-c-border-subtle bg-white dark:bg-c-surface-raised/50 px-3 text-sm text-c-text-secondary"
                    >
                      <option value="all">{t('interview.insightViewer.allDepartments')}</option>
                      {analysisDepartmentOptions.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {visiblePeopleLenses.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {visiblePeopleLenses.map((lens) => {
                    const supportedTopics = lens.supportedTopicIds
                      .map((id) => analysisTopicsById[id])
                      .filter(Boolean);
                    const contradictedSupportedTopics = supportedTopics.filter(
                      (topic) => topic.isContradicted
                    );
                    const localSupportedTopics = supportedTopics.filter(
                      (topic) => !topic.isContradicted && topic.supportingSessionIds.length <= 1
                    );

                    return (
                      <div
                        key={lens.id}
                        className="rounded-2xl bg-c-surface-raised px-4 py-4 space-y-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-c-text">{lens.label}</div>
                            <div className="mt-1 text-xs text-c-text-muted">
                              {[lens.role, lens.department].filter(Boolean).join(' · ') ||
                                (analysisLensMode === 'session'
                                  ? t('interview.insightViewer.sourceSession')
                                  : t('interview.insightViewer.stakeholderLens'))}
                            </div>
                          </div>
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-c-text-muted/10 text-c-text-secondary text-[10px] font-medium">
                            <Target size={10} />
                            {supportedTopics.length} {t('interview.insightViewer.topics')}
                          </div>
                        </div>

                        <div className="text-xs text-c-text-muted">{lens.localSummary}</div>

                        {contradictedSupportedTopics.length > 0 && (
                          <Callout
                            variant="critical"
                            title={t(
                              'interview.insightViewer.contradictedTopicsForThisPerspective'
                            )}
                            compact
                          >
                            <ul className="list-disc list-inside space-y-1">
                              {contradictedSupportedTopics.map((topic) => (
                                <li key={topic.id} className="text-sm">
                                  {topic.label}
                                </li>
                              ))}
                            </ul>
                          </Callout>
                        )}

                        <div className="space-y-3">
                          <div className={TEXT_L1}>
                            {t('interview.insightViewer.supportedTopics')}
                          </div>
                          {supportedTopics.length > 0 ? (
                            supportedTopics.map((topic) => (
                              <div
                                key={topic.id}
                                className="rounded-xl bg-white dark:bg-c-surface-raised border border-c-border-subtle px-3 py-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-sm font-medium text-c-text">
                                    {topic.label}
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span
                                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                        topic.isContradicted
                                          ? 'bg-danger-500/15 text-danger-600 dark:text-danger-400'
                                          : topic.supportingSessionIds.length <= 1
                                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                      }`}
                                    >
                                      {topic.isContradicted
                                        ? t('interview.insightViewer.contradicted')
                                        : topic.supportingSessionIds.length <= 1
                                          ? t('interview.insightViewer.local')
                                          : t('interview.insightViewer.shared')}
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-1 text-xs text-c-text-muted">
                                  {topic.kind} · {topic.confidenceLevel} · {topic.evidenceCount}{' '}
                                  {t('interview.insightViewer.ev')}
                                </div>
                                {topic.divergenceNote && (
                                  <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                                    {topic.divergenceNote}
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <EmptyStateInline
                              icon={Users}
                              message={t('interview.insightViewer.noSupportedTopicsForThis')}
                            />
                          )}
                        </div>

                        {localSupportedTopics.length > 0 && (
                          <div className="space-y-2">
                            <div className={TEXT_L1}>
                              {t('interview.insightViewer.localSignals')}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {localSupportedTopics.map((topic) => (
                                <span
                                  key={topic.id}
                                  className="inline-flex px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-medium"
                                >
                                  {topic.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyStateInline
                  icon={Users}
                  message={t('interview.insightViewer.noPerspectivesForTheCurrent')}
                />
              )}
            </div>
          );
          break;
        }

        case 'traceability': {
          const loadedSessionIds = new Set(sourceSessions.map((s) => s.id));
          const unavailableSessionIds = (insight?.sourceSessionIds || []).filter(
            (id) => !loadedSessionIds.has(id)
          );
          component = (
            <div className="space-y-4">
              <Callout
                variant="success"
                title={t('interview.insightViewer.traceabilityToSourceAnswers')}
              >
                {t('interview.insightViewer.eachCardBelowShowsWhich')}
              </Callout>

              {traceabilityRows.length === 0 && unavailableSessionIds.length === 0 ? (
                <EmptyStateInline
                  icon={Target}
                  message={t('interview.insightViewer.noSourceSessions')}
                  hint={t('interview.insightViewer.addOrCompleteSessionsTo')}
                />
              ) : (
                <div className="space-y-3">
                  {traceabilityRows.map(({ session, summary }) => (
                    <div
                      key={session.id}
                      className="rounded-2xl bg-c-surface-raised px-4 py-4 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-c-text">{session.name}</div>
                          <div className="text-xs text-c-text-muted">
                            {session.templateName || t('interview.insightViewer.sourceSession')}
                          </div>
                        </div>
                        <button
                          onClick={() => openSourceSessionInInterviewHub(session)}
                          className="p-1.5 rounded-lg hover:bg-state-hover dark:hover:bg-white/[0.06] text-c-text-muted transition-colors"
                        >
                          <ExternalLink size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                            {t('interview.insightViewer.officialAnswers')}
                          </div>
                          {summary.facts.length > 0 ? (
                            summary.facts.slice(0, 4).map((fact) => (
                              <div key={fact} className="text-sm text-c-text-secondary">
                                {fact}
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-c-text-secondary">
                              {t('interview.insightViewer.noFactsCaptured')}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-c-text-secondary">
                            {t('interview.insightViewer.gapsConstraints')}
                          </div>
                          {uniqueNonEmpty([
                            ...summary.gaps,
                            ...summary.constraints,
                            ...summary.painPoints,
                          ]).length > 0 ? (
                            uniqueNonEmpty([
                              ...summary.gaps,
                              ...summary.constraints,
                              ...summary.painPoints,
                            ])
                              .slice(0, 4)
                              .map((item) => (
                                <div key={item} className="text-sm text-c-text-secondary">
                                  {item}
                                </div>
                              ))
                          ) : (
                            <div className="text-sm text-c-text-secondary">
                              {t('interview.insightViewer.noGapsOrConstraints')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {unavailableSessionIds.map((sessionId) => (
                    <div
                      key={sessionId}
                      className="rounded-2xl bg-c-surface-raised border border-dashed border-c-border px-4 py-4"
                    >
                      <div className="flex items-center gap-3 text-c-text-secondary">
                        <Link2 size={16} className="opacity-50" />
                        <div>
                          <div className="text-sm font-medium">
                            {t('interview.insightViewer.sourceUnavailable')}
                          </div>
                          <div className="text-xs">
                            {t('interview.insightViewer.sessionFailedToLoad', {
                              id: sessionId.slice(0, 12),
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          break;
        }

        case 'source-sessions':
          component = (
            <div className="space-y-2">
              {sourceSessions.length === 0 ? (
                <div className="text-center py-6 text-c-text-secondary">
                  <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('interview.insightViewer.noSessions')}</p>
                </div>
              ) : (
                sourceSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-c-surface-raised border border-c-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <MessageSquare size={14} className="text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-c-text-secondary">{session.name}</p>
                        {session.templateName && (
                          <p className="text-xs text-c-text-secondary">{session.templateName}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => openSourceSessionInInterviewHub(session)}
                      className="p-1.5 rounded-lg hover:bg-state-hover text-c-text-muted transition-colors"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          );
          break;

        // (removed) attachments-links — no backend contract for insight attachments/links

        // (przeniesione) comments / activity-log — SPEC-N §2.1: zarezerwowane
        // id nie renderują się w centrum. CommentsCanvas i lista aktywności
        // żyją teraz w prawym panelu (rightPanelSections: 'comments' / 'history').

        // ── #22c — Consensus & Divergence Matrix ──────────────────────────────
        case 'consensus-divergence': {
          const hasMatrix =
            consensusTopics.length > 0 ||
            localOnlyTopics.length > 0 ||
            contradictedTopics.length > 0;
          const distinctVoices = analysis?.scope.distinctStakeholderCount ?? 0;
          component = (
            <NModeSectionWrapper
              heading={{ en: 'Consensus & Divergence Matrix', pl: 'Macierz zgody i rozbieżności' }}
              aiAction={{
                title: { en: 'Regenerate this analysis with AI', pl: 'Odśwież tę analizę z AI' },
                onClick: handleRegenerate,
                loading: isRegenerating,
              }}
              isEmpty={!hasMatrix}
              emptyState={{
                icon: GitCompare,
                message: {
                  pl: 'Ta sekcja pokazuje, gdzie respondenci się zgadzają, a gdzie się różnią. Pojawi się, gdy insight łączy wiele perspektyw (≥2 respondentów lub sesji) i AI wykryje wspólne, lokalne lub sprzeczne tematy.',
                  en: 'This section maps where respondents agree vs. disagree. It populates once the insight spans multiple perspectives (≥2 respondents or sessions) and the AI detects shared, local, or contradicted topics.',
                },
                cta: {
                  label: { en: 'Generate with AI', pl: 'Wygeneruj z AI' },
                  onClick: handleRegenerate,
                },
              }}
            >
              {renderSectionCardHeader('consensus-divergence', hasMatrix)}
              <Callout
                variant="info"
                title={t('interview.insightViewer.readAgreementAndDivergence')}
              >
                {t('interview.insightViewer.derivedFromPerspectives', { count: distinctVoices })}
              </Callout>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {(
                  [
                    {
                      key: 'consensus',
                      topics: consensusTopics,
                      title: t('interview.insightViewer.consensus2'),
                      tone: 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300',
                      empty: t('interview.insightViewer.noSharedTopicsYet'),
                    },
                    {
                      key: 'local',
                      topics: localOnlyTopics,
                      title: t('interview.insightViewer.localSingleVoice'),
                      tone: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300',
                      empty: t('interview.insightViewer.noLocalOnlyTopics'),
                    },
                    {
                      key: 'divergence',
                      topics: contradictedTopics,
                      title: t('interview.insightViewer.divergenceContradiction'),
                      tone: 'border-danger-500/20 bg-danger-500/[0.06] text-danger-700 dark:text-danger-300',
                      empty: t('interview.insightViewer.noContradictions'),
                    },
                  ] as const
                ).map((col) => (
                  <div
                    key={col.key}
                    className={`rounded-2xl border px-4 py-4 space-y-3 ${col.tone}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                        {col.title}
                      </div>
                      <span className="text-xs font-semibold opacity-70">{col.topics.length}</span>
                    </div>
                    {col.topics.length > 0 ? (
                      <ul className="space-y-2">
                        {col.topics.slice(0, 8).map((topic) => (
                          <li
                            key={topic.id}
                            className="rounded-xl bg-white/70 dark:bg-c-surface-raised/40 px-3 py-2"
                          >
                            <div className="text-sm font-medium text-c-text">{topic.label}</div>
                            {topic.divergenceNote && (
                              <div className="mt-1 text-xs text-c-text-secondary">
                                {topic.divergenceNote}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-xs text-c-text-secondary">{col.empty}</div>
                    )}
                  </div>
                ))}
              </div>
            </NModeSectionWrapper>
          );
          break;
        }

        // ── #22c — Implicit Assumptions ───────────────────────────────────────
        case 'implicit-assumptions': {
          // Derive from existing AI signals/narrative: low-confidence or
          // single-voice topics carry implicit, unvalidated assumptions, plus
          // any "between the lines" narrative observations already parsed.
          const assumptionTopics = (analysis?.topics || []).filter(
            (topic) =>
              topic.confidenceLevel === 'low' ||
              topic.confidenceLevel === 'insufficient' ||
              (topic.supportingSessionIds.length <= 1 && !topic.isContradicted)
          );
          const assumptionNarrative = hiddenSignals;
          const hasAssumptions = assumptionTopics.length > 0 || assumptionNarrative.length > 0;
          component = (
            <NModeSectionWrapper
              heading={{ en: 'Implicit Assumptions', pl: 'Ukryte założenia' }}
              aiAction={{
                title: { en: 'Regenerate this analysis with AI', pl: 'Odśwież tę analizę z AI' },
                onClick: handleRegenerate,
                loading: isRegenerating,
              }}
              isEmpty={!hasAssumptions}
              emptyState={{
                icon: Brain,
                message: {
                  pl: 'Tu pojawią się niewypowiedziane założenia — twierdzenia oparte na jednym głosie, niskiej pewności lub przyjęte bez dowodu. Populuje się z analizy AI i tematów o słabym pokryciu.',
                  en: 'Unstated assumptions surface here — claims resting on a single voice, low confidence, or taken as given without evidence. Populates from AI analysis and weakly-covered topics.',
                },
                cta: {
                  label: { en: 'Generate with AI', pl: 'Wygeneruj z AI' },
                  onClick: handleRegenerate,
                },
              }}
            >
              <Callout
                variant="warning"
                title={t('interview.insightViewer.assumptionsToValidate')}
                compact
              >
                {t('interview.insightViewer.whatTheTeamTreatsAs')}
              </Callout>
              {assumptionTopics.length > 0 && (
                <div className="space-y-2">
                  {assumptionTopics.slice(0, 8).map((topic) => (
                    <div
                      key={topic.id}
                      className="rounded-xl border border-c-border-subtle bg-white/70 dark:bg-c-surface-raised/30 px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-medium text-c-text">{topic.label}</div>
                        <span className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          {topic.confidenceLevel}
                        </span>
                      </div>
                      {topic.description && (
                        <div className="mt-1 text-xs text-c-text-secondary max-w-prose">
                          {topic.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {assumptionNarrative.length > 0 && (
                <div className="space-y-2">
                  <div className={TEXT_L1}>{t('interview.insightViewer.fromAiNarrative')}</div>
                  <ul className="list-disc list-inside space-y-1">
                    {assumptionNarrative.slice(0, 6).map((line, i) => (
                      <li key={i} className="text-sm text-c-text-secondary">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </NModeSectionWrapper>
          );
          break;
        }

        // ── #22c — Silences (what was NOT said) ───────────────────────────────
        case 'silences': {
          const coverageGaps = analysis?.synthesis.coverageGaps || [];
          const silences = uniqueNonEmpty([...coverageGaps, ...v6MissingData]);
          const hasSilences = silences.length > 0;
          component = (
            <NModeSectionWrapper
              heading={{ en: 'Silences & Gaps', pl: 'Przemilczenia i luki' }}
              aiAction={{
                title: { en: 'Regenerate this analysis with AI', pl: 'Odśwież tę analizę z AI' },
                onClick: handleRegenerate,
                loading: isRegenerating,
              }}
              isEmpty={!hasSilences}
              emptyState={{
                icon: EyeOff,
                message: {
                  pl: 'Tu pojawi się to, czego NIE powiedziano — tematy oczekiwane, lecz nieporuszone, pytania bez odpowiedzi i luki w pokryciu. Populuje się z luk pokrycia AI i brakujących danych insightu.',
                  en: 'What was notably NOT said appears here — expected-but-absent topics, unanswered questions, and coverage gaps. Populates from AI coverage gaps and the insight’s missing-data list.',
                },
                cta: {
                  label: { en: 'Generate with AI', pl: 'Wygeneruj z AI' },
                  onClick: handleRegenerate,
                },
              }}
            >
              <Callout
                variant="info"
                title={t('interview.insightViewer.silenceIsAlsoASignal')}
                compact
              >
                {t('interview.insightViewer.theAbsenceOfATopic')}
              </Callout>
              <ul className="space-y-2">
                {silences.slice(0, 12).map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-xl border border-dashed border-c-border bg-c-surface-raised px-3 py-2.5"
                  >
                    <EyeOff size={14} className="mt-0.5 flex-shrink-0 text-c-text-muted" />
                    <span className="text-sm text-c-text-secondary">{item}</span>
                  </li>
                ))}
              </ul>
            </NModeSectionWrapper>
          );
          break;
        }

        // ── #23d — Cross-person Quote Comparison ───────────────────────────────
        case 'quote-comparison': {
          const lensesWithVoice = visiblePeopleLenses.filter(
            (lens) => lens.localSummary || lens.supportedTopicIds.length > 0
          );
          const hasComparison = lensesWithVoice.length >= 2 || evidenceQuotes.length > 0;
          component = (
            <NModeSectionWrapper
              heading={{ en: 'Cross-person Quote Comparison', pl: 'Porównanie cytatów osób' }}
              aiAction={{
                title: { en: 'Regenerate this analysis with AI', pl: 'Odśwież tę analizę z AI' },
                onClick: handleRegenerate,
                loading: isRegenerating,
              }}
              isEmpty={!hasComparison}
              emptyState={{
                icon: Quote,
                message: {
                  pl: 'Tu zestawimy obok siebie, jak różne osoby mówią o tym samym. Populuje się, gdy insight ma ≥2 perspektywy z lokalnym podsumowaniem lub gdy w treści są cytaty źródłowe.',
                  en: 'Side-by-side of how different people talk about the same thing. Populates when the insight has ≥2 perspectives with a local summary, or when source quotes exist in the content.',
                },
                cta: {
                  label: { en: 'Generate with AI', pl: 'Wygeneruj z AI' },
                  onClick: handleRegenerate,
                },
              }}
            >
              <Callout
                variant="purple"
                title={t('interview.insightViewer.sameTopicsDifferentVoices')}
                compact
              >
                {t('interview.insightViewer.compareHowEachPersonFrames')}
              </Callout>
              {lensesWithVoice.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {lensesWithVoice.slice(0, 6).map((lens) => (
                    <div
                      key={lens.id}
                      className="rounded-2xl border border-c-border-subtle bg-white/70 dark:bg-c-surface-raised/30 px-4 py-3"
                    >
                      <div className="text-sm font-semibold text-c-text">{lens.label}</div>
                      <div className="mt-0.5 text-xs text-c-text-muted">
                        {[lens.role, lens.department].filter(Boolean).join(' · ') ||
                          t('interview.insightViewer.perspective')}
                      </div>
                      <blockquote className="mt-2 border-l-2 border-c-info pl-3 text-sm italic text-c-text-secondary">
                        {lens.localSummary || t('interview.insightViewer.noLocalSummaryForThis')}
                      </blockquote>
                    </div>
                  ))}
                </div>
              )}
              {evidenceQuotes.length > 0 && (
                <div className="space-y-2">
                  <div className={TEXT_L1}>{t('interview.insightViewer.quotesFromContent')}</div>
                  {evidenceQuotes.map((quote, i) => (
                    <blockquote
                      key={i}
                      className="border-l-2 border-c-border pl-3 text-sm italic text-c-text-secondary"
                    >
                      &ldquo;{quote}&rdquo;
                    </blockquote>
                  ))}
                </div>
              )}
            </NModeSectionWrapper>
          );
          break;
        }

        // ── #23d — Sentiment / Tone Map ────────────────────────────────────────
        case 'sentiment-tone': {
          // Proxy tone from confidence + contradiction state of existing topics.
          const toneTopics = analysis?.topics || [];
          const toneBuckets = {
            positive: toneTopics.filter((t) => t.kind === 'opportunity' && !t.isContradicted),
            tense: toneTopics.filter((t) => t.isContradicted),
            concern: toneTopics.filter((t) => t.kind === 'issue' && !t.isContradicted),
          };
          const hasTone = toneTopics.length > 0 || v6Signals.length > 0;
          component = (
            <NModeSectionWrapper
              heading={{ en: 'Sentiment & Tone Map', pl: 'Mapa sentymentu i tonu' }}
              aiAction={{
                title: { en: 'Regenerate this analysis with AI', pl: 'Odśwież tę analizę z AI' },
                onClick: handleRegenerate,
                loading: isRegenerating,
              }}
              isEmpty={!hasTone}
              emptyState={{
                icon: Heart,
                message: {
                  pl: 'Tu zmapujemy emocjonalny ton wokół tematów — entuzjazm, napięcie, obawy. Populuje się z tematów AI (szanse vs. problemy vs. sprzeczności) i wykrytych sygnałów.',
                  en: 'The emotional tone around topics is mapped here — enthusiasm, tension, concern. Populates from AI topics (opportunities vs. issues vs. contradictions) and detected signals.',
                },
                cta: {
                  label: { en: 'Generate with AI', pl: 'Wygeneruj z AI' },
                  onClick: handleRegenerate,
                },
              }}
            >
              <Callout variant="info" title={t('interview.insightViewer.toneAsAProxy')} compact>
                {t('interview.insightViewer.toneIsApproximatedFromTopic')}
              </Callout>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(
                  [
                    {
                      key: 'positive',
                      topics: toneBuckets.positive,
                      title: t('interview.insightViewer.positiveEnergy'),
                      tone: 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300',
                    },
                    {
                      key: 'concern',
                      topics: toneBuckets.concern,
                      title: t('interview.insightViewer.concernProblem'),
                      tone: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300',
                    },
                    {
                      key: 'tense',
                      topics: toneBuckets.tense,
                      title: t('interview.insightViewer.tensionContradiction'),
                      tone: 'border-danger-500/20 bg-danger-500/[0.06] text-danger-700 dark:text-danger-300',
                    },
                  ] as const
                ).map((col) => (
                  <div
                    key={col.key}
                    className={`rounded-2xl border px-4 py-4 space-y-2 ${col.tone}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                        {col.title}
                      </div>
                      <span className="text-xs font-semibold opacity-70">{col.topics.length}</span>
                    </div>
                    {col.topics.slice(0, 6).map((topic) => (
                      <div key={topic.id} className="text-sm text-c-text-secondary">
                        {topic.label}
                      </div>
                    ))}
                    {col.topics.length === 0 && (
                      <div className="text-xs opacity-70">
                        {t('interview.insightViewer.noTopics')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </NModeSectionWrapper>
          );
          break;
        }

        // ── #23d — Power Dynamics ──────────────────────────────────────────────
        case 'power-dynamics': {
          const roleGroups = new Map<string, typeof visiblePeopleLenses>();
          for (const lens of visiblePeopleLenses) {
            const key = lens.role || t('interview.insightViewer.unspecifiedRole');
            const arr = roleGroups.get(key) || [];
            arr.push(lens);
            roleGroups.set(key, arr);
          }
          const hasPower = roleGroups.size > 0 && visiblePeopleLenses.length > 0;
          component = (
            <NModeSectionWrapper
              heading={{ en: 'Power Dynamics', pl: 'Dynamika władzy' }}
              aiAction={{
                title: { en: 'Regenerate this analysis with AI', pl: 'Odśwież tę analizę z AI' },
                onClick: handleRegenerate,
                loading: isRegenerating,
              }}
              isEmpty={!hasPower}
              emptyState={{
                icon: Scale,
                message: {
                  pl: 'Tu pokażemy, czyj głos dominuje — wpływ ról i działów na insight. Populuje się, gdy respondenci mają przypisane role/działy w analizie perspektyw.',
                  en: 'Whose voice dominates — the weight of roles and departments behind the insight — appears here. Populates when respondents carry role/department metadata in the perspective analysis.',
                },
              }}
            >
              <Callout
                variant="warning"
                title={t('interview.insightViewer.whoseVoiceCarriesWeight')}
                compact
              >
                {t('interview.insightViewer.anInsightBuiltMostlyFrom')}
              </Callout>
              <div className="space-y-2">
                {Array.from(roleGroups.entries())
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([role, lenses]) => {
                    const share = Math.round(
                      (lenses.length / Math.max(visiblePeopleLenses.length, 1)) * 100
                    );
                    return (
                      <div
                        key={role}
                        className="rounded-xl border border-c-border-subtle bg-white/70 dark:bg-c-surface-raised/30 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium text-c-text">{role}</div>
                          <span className="text-xs font-semibold text-c-text-muted">
                            {lenses.length} · {share}%
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-c-border-subtle">
                          <div
                            className="h-full rounded-full bg-c-text-secondary"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </NModeSectionWrapper>
          );
          break;
        }

        // ── #23d — Hypothesis Board ────────────────────────────────────────────
        case 'hypothesis-board': {
          // Treat triage candidates as working hypotheses, bucketed by status.
          const openHyp = candidates.filter(
            (c) =>
              c.triage_status === 'candidate' ||
              c.triage_status === 'needs_evidence' ||
              c.triage_status === 'needs_split'
          );
          const testingHyp = candidates.filter((c) => c.triage_status === 'ready_for_review');
          const resolvedHyp = candidates.filter(
            (c) => c.triage_status === 'promoted' || c.triage_status === 'rejected'
          );
          const hasHyp = candidates.length > 0;
          component = (
            <NModeSectionWrapper
              heading={{ en: 'Hypothesis Board', pl: 'Tablica hipotez' }}
              aiAction={{
                title: { en: 'Regenerate this analysis with AI', pl: 'Odśwież tę analizę z AI' },
                onClick: handleRegenerate,
                loading: isRegenerating,
              }}
              isEmpty={!hasHyp}
              emptyState={{
                icon: Network,
                message: {
                  pl: 'Tu kandydaci stają się hipotezami roboczymi w kolumnach: otwarte → w teście → rozstrzygnięte. Populuje się z triage kandydatów tego insightu.',
                  en: 'Candidates become working hypotheses across columns: open → testing → resolved. Populates from this insight’s candidate triage.',
                },
              }}
            >
              <Callout
                variant="info"
                title={t('interview.insightViewer.fromHypothesisToFinding')}
                compact
              >
                {t('interview.insightViewer.eachHypothesisMovesRightAs')}
              </Callout>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(
                  [
                    {
                      key: 'open',
                      items: openHyp,
                      title: t('interview.insightViewer.open'),
                      tone: 'border-c-border-subtle',
                    },
                    {
                      key: 'testing',
                      items: testingHyp,
                      title: t('interview.insightViewer.testing'),
                      tone: 'border-amber-500/20',
                    },
                    {
                      key: 'resolved',
                      items: resolvedHyp,
                      title: t('interview.insightViewer.resolved'),
                      tone: 'border-emerald-500/20',
                    },
                  ] as const
                ).map((col) => (
                  <div
                    key={col.key}
                    className={`rounded-2xl border bg-white/40 dark:bg-c-surface-raised/20 px-3 py-3 space-y-2 ${col.tone}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={TEXT_L1}>{col.title}</div>
                      <span className="text-xs font-semibold text-c-text-muted">
                        {col.items.length}
                      </span>
                    </div>
                    {col.items.slice(0, 8).map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl bg-white dark:bg-c-surface-raised border border-c-border-subtle px-3 py-2"
                      >
                        <div className="text-sm text-c-text">{c.candidate_statement}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-c-text-muted">
                          {c.confidence_hint}
                        </div>
                      </div>
                    ))}
                    {col.items.length === 0 && (
                      <div className="text-xs text-c-text-muted">
                        {t('interview.insightViewer.empty')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </NModeSectionWrapper>
          );
          break;
        }
      }

      componentById[section.id] = component;
    }

    // #23c — compose merged content under a single surviving section. Each
    // merged sub-block is preserved verbatim; only the nav entry is shared.
    const mergedDivider = (titleKey: string) => (
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-c-border-subtle" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
          {t(titleKey)}
        </span>
        <div className="h-px flex-1 bg-c-border-subtle" />
      </div>
    );

    const composedComponentById: Record<string, React.ReactNode> = { ...componentById };

    // Quality & Trust = Material Quality + Truth & Review
    composedComponentById['material-quality'] = (
      <div className="space-y-6">
        {componentById['material-quality']}
        {mergedDivider('interview.insightViewer.dividerTruthReview')}
        {componentById['truth-review-summary']}
      </div>
    );
    // Sources = Source Pack + Source Sessions
    composedComponentById['source-pack'] = (
      <div className="space-y-6">
        {componentById['source-pack']}
        {mergedDivider('interview.insightViewer.dividerSourceSessions')}
        {componentById['source-sessions']}
      </div>
    );
    // Findings & Evidence = Candidate Triage + Traceability
    composedComponentById['candidate-triage'] = (
      <div className="space-y-6">
        {componentById['candidate-triage']}
        {mergedDivider('interview.insightViewer.dividerTraceability')}
        {componentById['traceability']}
      </div>
    );

    // ── Phase D: Canon sections → 23/23 (derived from in-scope data; read-only + AI regenerate) ──
    const dRegen = {
      title: { en: 'Regenerate with AI', pl: 'Odśwież z AI' },
      onClick: handleRegenerate,
      loading: isRegenerating,
    };
    const dCard = 'rounded-lg border border-c-border-subtle px-3 py-2.5';
    const dTitle = 'text-sm font-medium text-c-text';
    const dBody = 'text-xs text-c-text-secondary mt-0.5';
    const dRegenCta = {
      label: { en: 'Generate with AI', pl: 'Wygeneruj z AI' },
      onClick: handleRegenerate,
    };

    const dPatternItems = [
      ...v6Themes
        .filter((t) => t.crossSessionPattern)
        .map((t) => ({ t: t.title, d: t.description })),
      ...v6Issues
        .filter((t) => t.crossSessionPattern)
        .map((t) => ({ t: t.title, d: t.description })),
      ...v6Opportunities
        .filter((t) => t.crossSessionPattern)
        .map((t) => ({ t: t.title, d: t.description })),
      ...v6Signals
        .filter((s) => s.type === 'emerging_pattern')
        .map((s) => ({ t: s.title, d: s.description })),
    ];
    const dTensionItems = [
      ...v6Signals
        .filter((s) => s.type === 'tension' || s.type === 'contradiction')
        .map((s) => ({ t: s.title, d: s.description })),
      ...contradictedTopics.map((t) => ({ t: t.label, d: t.divergenceNote || '' })),
    ];
    const dMentalLenses = (analysis?.people.stakeholderLenses || []).filter((l) => l.localSummary);
    const dRoles = analysis?.scope.roles || [];
    const dDepts = analysis?.scope.departments || [];
    const dStakeholders = analysis?.scope.stakeholderLabels || [];
    const dNarrative = (insight?.content || '').trim();
    const dMemo = (executiveSummary || '').trim();

    composedComponentById['key-findings'] = (
      <NModeSectionWrapper
        heading={{ en: 'Key Findings', pl: 'Kluczowe wnioski' }}
        aiAction={dRegen}
        isEmpty={v6Themes.length === 0}
        emptyState={{
          icon: Star,
          message: {
            en: 'Key findings surface here once the insight is synthesized from sessions.',
            pl: 'Kluczowe wnioski pojawią się po syntezie insightu z sesji.',
          },
          cta: dRegenCta,
        }}
        quoteRequirementLevel="EACH_ITEM"
        quotesSatisfied={v6Themes.length > 0 && v6Themes.every((t) => t.evidence_refs.length > 0)}
      >
        {renderSectionCardHeader('key-findings', v6Themes.length > 0)}
        <ol className="space-y-2 list-decimal list-inside">
          {v6Themes.slice(0, 6).map((t, i) => (
            <li key={i} className={dCard}>
              <span className={dTitle}>{t.title}</span>
              {t.description && <div className={dBody}>{t.description}</div>}
            </li>
          ))}
        </ol>
      </NModeSectionWrapper>
    );

    composedComponentById['recommendations'] = (
      <NModeSectionWrapper
        heading={{ en: 'Recommendations', pl: 'Rekomendacje' }}
        aiAction={dRegen}
        isEmpty={v6Opportunities.length + v6Issues.length === 0}
        emptyState={{
          icon: Rocket,
          message: {
            en: 'Recommended actions are derived from opportunities to pursue and issues to address.',
            pl: 'Rekomendowane działania wynikają z szans do wykorzystania i problemów do rozwiązania.',
          },
          cta: dRegenCta,
        }}
      >
        {renderSectionCardHeader('recommendations', v6Opportunities.length + v6Issues.length > 0)}
        <ul className="space-y-2">
          {v6Opportunities.map((o, i) => (
            <li key={`o${i}`} className={dCard}>
              <span className={dTitle}>
                <span className="text-teal-600 dark:text-teal-400">
                  {t('interview.insightViewer.pursue')}
                </span>
                {o.title}
              </span>
              {o.description && <div className={dBody}>{o.description}</div>}
            </li>
          ))}
          {v6Issues.map((s, i) => (
            <li key={`i${i}`} className={dCard}>
              <span className={dTitle}>
                <span className="text-amber-600 dark:text-amber-400">
                  {t('interview.insightViewer.address')}
                </span>
                {s.title}
              </span>
              {s.description && <div className={dBody}>{s.description}</div>}
            </li>
          ))}
        </ul>
      </NModeSectionWrapper>
    );

    composedComponentById['tensions'] = (
      <NModeSectionWrapper
        heading={{ en: 'Tensions', pl: 'Napięcia' }}
        aiAction={dRegen}
        isEmpty={dTensionItems.length === 0}
        emptyState={{
          icon: GitCompare,
          message: {
            en: 'Contradictions and tensions between respondents appear here once detected.',
            pl: 'Sprzeczności i napięcia między respondentami pojawią się po wykryciu.',
          },
          cta: dRegenCta,
        }}
      >
        <ul className="space-y-2">
          {dTensionItems.map((x, i) => (
            <li key={i} className={dCard}>
              <span className={dTitle}>{x.t}</span>
              {x.d && <div className={dBody}>{x.d}</div>}
            </li>
          ))}
        </ul>
      </NModeSectionWrapper>
    );

    composedComponentById['patterns'] = (
      <NModeSectionWrapper
        heading={{ en: 'Patterns', pl: 'Wzorce' }}
        aiAction={dRegen}
        isEmpty={dPatternItems.length === 0}
        emptyState={{
          icon: Layers,
          message: {
            en: 'Cross-session patterns appear here when a finding repeats across multiple sessions.',
            pl: 'Wzorce międzysesyjne pojawią się, gdy obserwacja powtarza się w wielu sesjach.',
          },
          cta: dRegenCta,
        }}
      >
        <ul className="space-y-2">
          {dPatternItems.map((x, i) => (
            <li key={i} className={dCard}>
              <span className={dTitle}>{x.t}</span>
              {x.d && <div className={dBody}>{x.d}</div>}
            </li>
          ))}
        </ul>
      </NModeSectionWrapper>
    );

    composedComponentById['mental-models'] = (
      <NModeSectionWrapper
        heading={{ en: 'Mental Models', pl: 'Modele myślowe' }}
        aiAction={dRegen}
        isEmpty={dMentalLenses.length === 0}
        emptyState={{
          icon: Brain,
          message: {
            en: 'How each stakeholder group frames the problem — populated from per-group analysis.',
            pl: 'Jak każda grupa interesariuszy postrzega problem — z analizy per grupa.',
          },
          cta: dRegenCta,
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {dMentalLenses.map((l) => (
            <div key={l.id} className={dCard}>
              <div className={dTitle}>{l.label}</div>
              <div className={dBody}>{l.localSummary}</div>
            </div>
          ))}
        </div>
      </NModeSectionWrapper>
    );

    composedComponentById['moments'] = (
      <NModeSectionWrapper
        heading={{ en: 'Moments', pl: 'Momenty' }}
        aiAction={dRegen}
        isEmpty={evidenceQuotes.length === 0}
        emptyState={{
          icon: Quote,
          message: {
            en: 'Memorable quotes pulled from the sessions surface here.',
            pl: 'Zapadające w pamięć cytaty z sesji pojawią się tutaj.',
          },
          cta: dRegenCta,
        }}
      >
        <ul className="space-y-3">
          {evidenceQuotes.map((q, i) => (
            <li
              key={i}
              className="border-l-2 border-teal-300 dark:border-teal-700 pl-3 text-sm italic text-c-text-secondary"
            >
              “{q}”
            </li>
          ))}
        </ul>
      </NModeSectionWrapper>
    );

    composedComponentById['quote-bank'] = (
      <NModeSectionWrapper
        heading={{ en: 'Quote Bank', pl: 'Bank cytatów' }}
        aiAction={dRegen}
        isEmpty={evidenceQuotes.length === 0}
        emptyState={{
          icon: Quote,
          message: {
            en: 'A curated library of evidence quotes, ready to drop into deliverables.',
            pl: 'Wykurowana biblioteka cytatów-dowodów, gotowa do użycia w dostawach.',
          },
          cta: dRegenCta,
        }}
        quoteRequirementLevel="EACH_ITEM"
        quotesSatisfied={evidenceQuotes.length > 0}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {evidenceQuotes.map((q, i) => (
            <div key={i} className={dCard}>
              <div className="text-sm italic text-c-text-secondary">“{q}”</div>
            </div>
          ))}
        </div>
      </NModeSectionWrapper>
    );

    composedComponentById['stakeholder-map'] = (
      <NModeSectionWrapper
        heading={{ en: 'Stakeholder Map', pl: 'Mapa interesariuszy' }}
        aiAction={dRegen}
        isEmpty={dRoles.length + dDepts.length + dStakeholders.length === 0}
        emptyState={{
          icon: Users,
          message: {
            en: 'Roles and departments represented across the sessions are mapped here.',
            pl: 'Role i działy reprezentowane w sesjach są tu zmapowane.',
          },
          cta: dRegenCta,
        }}
      >
        <div className="space-y-3">
          {[
            { label: t('interview.insightViewer.roles'), items: dRoles },
            { label: t('interview.insightViewer.departments'), items: dDepts },
            { label: t('interview.insightViewer.stakeholders'), items: dStakeholders },
          ]
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <div key={g.label}>
                <div className="text-[11px] uppercase tracking-wide text-c-text-muted mb-1">
                  {g.label}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map((it, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-c-surface-raised text-c-text-secondary"
                    >
                      {it}
                    </span>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </NModeSectionWrapper>
    );

    composedComponentById['source-credibility'] = (
      <NModeSectionWrapper
        heading={{ en: 'Source Credibility', pl: 'Wiarygodność źródeł' }}
        aiAction={dRegen}
        isEmpty={!analysis || analysis.scope.sourceSessionCount === 0}
        emptyState={{
          icon: Eye,
          message: {
            en: 'Coverage breadth and source diversity are assessed here once sessions are linked.',
            pl: 'Zasięg pokrycia i różnorodność źródeł oceniane są po powiązaniu sesji.',
          },
          cta: { label: { en: 'Add a session', pl: 'Dodaj sesję' }, onClick: handleRegenerate },
        }}
      >
        {analysis && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={dCard}>
              <div className={dBody}>{t('interview.insightViewer.sessions')}</div>
              <div className="text-xl font-semibold text-c-text">
                {analysis.scope.sourceSessionCount}
              </div>
            </div>
            <div className={dCard}>
              <div className={dBody}>{t('interview.insightViewer.distinctVoices')}</div>
              <div className="text-xl font-semibold text-c-text">
                {analysis.scope.distinctStakeholderCount}
              </div>
            </div>
            <div className={dCard}>
              <div className={dBody}>{t('interview.insightViewer.posture2')}</div>
              <div className="text-sm font-medium text-c-text mt-1">
                {analysis.scope.posture.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        )}
      </NModeSectionWrapper>
    );

    composedComponentById['consulting-narrative'] = (
      <NModeSectionWrapper
        heading={{ en: 'Consulting Narrative', pl: 'Narracja konsultingowa' }}
        aiAction={dRegen}
        isEmpty={dNarrative.length === 0}
        emptyState={{
          icon: FileText,
          message: {
            en: 'The full written consulting narrative for this insight appears here.',
            pl: 'Pełna pisemna narracja konsultingowa tego insightu pojawi się tutaj.',
          },
          cta: dRegenCta,
        }}
      >
        <div className="text-sm leading-relaxed text-c-text-secondary whitespace-pre-wrap">
          {dNarrative}
        </div>
      </NModeSectionWrapper>
    );

    composedComponentById['executive-memo'] = (
      <NModeSectionWrapper
        heading={{ en: 'Executive Memo', pl: 'Memo zarządcze' }}
        aiAction={dRegen}
        isEmpty={dMemo.length === 0}
        emptyState={{
          icon: Sparkles,
          message: {
            en: 'A one-page summary for leadership is distilled here.',
            pl: 'Jednostronicowe podsumowanie dla kierownictwa jest tu wydestylowane.',
          },
          cta: dRegenCta,
        }}
      >
        <div className="text-sm leading-relaxed text-c-text-secondary whitespace-pre-wrap">
          {dMemo}
        </div>
      </NModeSectionWrapper>
    );

    const badgeMap: Record<string, number | undefined> = {
      'report-pack': reportPack?.degraded
        ? reportPack.degradedReasons.length || 1
        : reportPack?.worksheets.length,
      'candidate-triage': candidates.length || undefined,
      // (SPEC-N §2.1) comments / activity-log nie są już sekcjami centrum —
      // ich liczniki żyją na sekcjach prawego panelu.
      'material-quality': truthReviewSummary.publishBlockers.length || undefined,
      'source-pack': sourceSessions.length || undefined,
      // R2/defekt #3: te same liczniki co kafle „Podsumowania" — `insightCounts`.
      themes: insightCounts.themes || undefined,
      'issues-risks': insightCounts.issues || undefined,
      opportunities: insightCounts.opportunities || undefined,
      signals: insightCounts.signals || undefined,
      'evidence-map': insightCounts.evidence || undefined,
      'hypothesis-board': candidates.length || undefined,
    };

    // Adaptive sidebar (#22): only sections with a definite zero count are
    // treated as empty (conservative — never hide a section that might have
    // content). Core sections always show. The new "between the lines"
    // analytical sections (#22c/#23d) self-render an informative empty-state,
    // so they are hidden from the nav until their derived data exists, except
    // the one or two flagged alwaysShow.
    const definiteCounts: Record<string, number> = {
      'candidate-triage': candidates.length,
      // R2/defekt #3: bramka widoczności czyta ten sam licznik, co plakietka —
      // inaczej sekcja mogła zniknąć z nawigacji mimo niezerowego kafla.
      themes: insightCounts.themes,
      'issues-risks': insightCounts.issues,
      opportunities: insightCounts.opportunities,
      signals: insightCounts.signals,
      'evidence-map': insightCounts.evidence,
      // derived analytical sections — hidden until their data exists
      'consensus-divergence':
        consensusTopics.length + localOnlyTopics.length + contradictedTopics.length,
      'implicit-assumptions':
        (analysis?.topics || []).filter(
          (t) =>
            t.confidenceLevel === 'low' ||
            t.confidenceLevel === 'insufficient' ||
            (t.supportingSessionIds.length <= 1 && !t.isContradicted)
        ).length + hiddenSignals.length,
      silences: (analysis?.synthesis.coverageGaps || []).length + v6MissingData.length,
      'quote-comparison':
        visiblePeopleLenses.filter((l) => l.localSummary || l.supportedTopicIds.length > 0).length +
        evidenceQuotes.length,
      'sentiment-tone': (analysis?.topics || []).length + v6Signals.length,
      'power-dynamics': visiblePeopleLenses.length,
      'hypothesis-board': candidates.length,
      // people / analysis-matrix derive entirely from lens data — gate them like
      // their "between the lines" siblings so a fresh insight (no lenses) doesn't
      // render two large explanatory-only panels in the dense C-board.
      people: visiblePeopleLenses.length,
      'analysis-matrix':
        (analysis?.people.stakeholderLenses || []).length +
        (analysis?.people.sessionLenses || []).length,
    };
    // alwaysShow: the two most important differentiators stay visible even empty.
    // (`artifact-actions` zdjęte 2026-07-23 — kafelki są w prawym panelu.)
    const alwaysShowSet = new Set(['executive-summary', 'consensus-divergence', 'silences']);

    // Sidebar grouping (#22b/#22): 5 themed groups.
    const groupLabels = [
      t('interview.insightViewer.groupInsight'),
      t('interview.insightViewer.groupBetweenTheLines'),
      t('interview.insightViewer.groupEvidence'),
      t('interview.insightViewer.groupDeliverables'),
      t('interview.insightViewer.groupAudit'),
    ];
    const groupIndexById: Record<string, number> = {
      // 0 — Wgląd / Insight
      'executive-summary': 0,
      'consulting-readout': 0,
      themes: 0,
      'issues-risks': 0,
      opportunities: 0,
      'key-findings': 0,
      recommendations: 0,
      // 1 — Między wierszami / Between the lines
      tensions: 1,
      patterns: 1,
      'mental-models': 1,
      people: 1,
      signals: 1,
      'analysis-matrix': 1,
      'consensus-divergence': 1,
      'implicit-assumptions': 1,
      silences: 1,
      'quote-comparison': 1,
      'sentiment-tone': 1,
      'power-dynamics': 1,
      'hypothesis-board': 1,
      // 2 — Dowody / Evidence
      'evidence-map': 2,
      'candidate-triage': 2,
      'source-pack': 2,
      moments: 2,
      'quote-bank': 2,
      'stakeholder-map': 2,
      'source-credibility': 2,
      // 3 — Dostarczane / Deliverables
      'report-pack': 3,
      'consulting-narrative': 3,
      'executive-memo': 3,
      // 4 — Audyt / Audit (comments/activity-log wyszły do prawego panelu, SPEC-N §2.1)
      'material-quality': 4,
    };

    const order = groupLabels;
    return INSIGHT_SECTIONS.map((section) => {
      const rawComponent = composedComponentById[section.id] ?? null;
      return {
        ...section,
        // ETAP 5 gridu n-Type (_GRID_STABILIZATION_COMMAND_2026-07-24.md §Insight):
        // „utrzymać tryb analityczny centralnej kolumny" — Insight jest kandydatem
        // na tryb ANALITYCZNY (karty findings/tabele/porównania), więc każda
        // sekcja dostaje twardy cap tokenem `--ntype-content-analytics-max-width`
        // (800–900px, Etap 2 index.css). Bez tego capu `NModeCanvas` (wspólny dla
        // WSZYSTKICH kart n-Type) jest `flex-1 min-w-0` bez żadnego ograniczenia —
        // na szerokich oknach treść rozciąga się do krawędzi. Cap żyje TYLKO tu
        // (per-sekcja, wyłącznie dla Insighta) — `NModeCanvas.tsx` zostaje
        // nietknięty, więc Zadanie/Decyzja/Inicjatywa/Powiadomienie/Narzędzie nie
        // dostają żadnej zmiany szerokości.
        component: rawComponent ? (
          <div className="w-full" style={{ maxWidth: 'var(--ntype-content-analytics-max-width)' }}>
            {rawComponent}
          </div>
        ) : null,
        badge: badgeMap[section.id],
        hasData: section.id in definiteCounts ? definiteCounts[section.id] > 0 : undefined,
        alwaysShow: alwaysShowSet.has(section.id),
        completed: !!sectionCompletions[section.id],
        group: groupLabels[groupIndexById[section.id] ?? 4],
      } as NModeSection;
    }).sort((a, b) => order.indexOf(a.group ?? '') - order.indexOf(b.group ?? ''));
  }, [
    executiveSummary,
    insight,
    insightId,
    isPolish,
    title,
    officialAnswers,
    issuesReadout,
    hiddenSignals,
    opportunityReadout,
    evidenceQuotes,
    traceabilityRows,
    sourceSessions,
    sourceSessionSummaries,
    sourcePack,
    reportPack,
    reportReadiness,
    reportExporting,
    reportMarkdownExporting,
    reportPublishing,
    reportRevisionCreating,
    reportReviewSubmitting,
    worksheetActionLoadingKey,
    analysis,
    findings,
    findingsSummary.activeEvidence,
    findingsSummary.total,
    candidates,
    candidateSummary,
    candidateActionLoadingId,
    consensusTopics,
    localOnlyTopics,
    contradictedTopics,
    visiblePeopleLenses,
    nComments,
    commentDraft,
    commentDateFilter,
    commentSortOrder,
    draftPriority,
    nModeActivityEntries,
    activityStats,
    activityTypeMeta,
    handleSubmitComment,
    handleDeleteComment,
    getPriorityDotClass,
    openSourceSessionInInterviewHub,
    activityEntries,
    insightCounts,
    v6Themes,
    v6Issues,
    v6Opportunities,
    v6Signals,
    v6EvidenceMap,
    v6MissingData,
    truthReviewSummary,
    readbackSummary.confirmed,
    expandedEvidenceRef,
    toggleEvidenceRef,
    findEvidenceForRef,
    expandedLimits,
    toggleLimitsExpand,
    handleOpenHandoff,
    handleCreateReportRevision,
    handleExportReportManifest,
    handleExportReportMarkdown,
    handlePublishReportPack,
    handleSubmitReportForReview,
    handleWorksheetStatusUpdate,
    handleRegenerate,
    isRegenerating,
    sectionCompletions,
  ]);

  // Apply the persisted drag order (within-group). Unknown/new sections fall to
  // the end so the list is never truncated. Mirrors InitiativeDocumentView.
  const orderedNModeSectionsWithContent = useMemo<NModeSection[]>(() => {
    if (!nModeSectionOrder || nModeSectionOrder.length === 0) return nModeSectionsWithContent;
    const byId = new Map(nModeSectionsWithContent.map((section) => [section.id, section]));
    const ordered = nModeSectionOrder
      .map((id) => byId.get(id))
      .filter((section): section is NModeSection => Boolean(section));
    const missing = nModeSectionsWithContent.filter(
      (section) => !nModeSectionOrder.includes(section.id)
    );
    return [...ordered, ...missing];
  }, [nModeSectionsWithContent, nModeSectionOrder]);

  // Canon: section "Mark complete" lives in the SectionCard header (INSIGHT_CANON
  // 106–119), NOT the toolbar. NModeSectionWrapper renders only a passive
  // `completed` indicator and we cannot edit it from here, so we inject a small
  // success-green toggle at the top of the ACTIVE section's content. The nav ✓
  // badge + progress keep working via the `completed` flag on each section.
  const renderSectionCompleteToggle = useCallback(
    (sectionId: string) => {
      // PODGLĄD = TYLKO CZYTANIE (decyzja właściciela 2026-07-24): „Oznacz
      // gotowe" ZAPISUJE stan ukończenia sekcji (zmienia badge ✓ w nawigacji
      // i sygnał dla AI). W Podglądzie nie ma go wcale — tak samo jak
      // Inicjatywa ukrywa swój odpowiednik. Chcesz oznaczyć → Edycja.
      if (readMode) return null;
      const done = !!sectionCompletions[sectionId];
      return (
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={() => handleToggleSectionComplete(sectionId)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              done
                ? 'border-success-400/50 text-success-700 dark:text-success-300 bg-success-50/60 dark:bg-success-900/20'
                : 'border-c-border text-c-text-secondary hover:bg-state-hover'
            }`}
            title={t('interview.insightViewer.markSectionCompleteAiSignal')}
          >
            <CheckCircle2
              size={14}
              className={done ? 'text-success-600 dark:text-success-400' : ''}
            />
            {done ? t('interview.insightViewer.reopen') : t('interview.insightViewer.markComplete')}
          </button>
        </div>
      );
    },
    [sectionCompletions, handleToggleSectionComplete, isPolish, readMode, t]
  );

  // ── Pole ręcznej edycji AKTYWNEJ sekcji (n-Type §6.2–6.4) ─────────────────
  // Tryb 'c' (C-board, wszystkie sekcje naraz) jest w Insighcie martwy — strażnik
  // przy `usePresentationMode` sprowadza go do 'n', więc renderowana jest zawsze
  // dokładnie JEDNA sekcja. Wstrzyknięcie w aktywną sekcję = „każda sekcja ma
  // pole" w praktyce, tym samym szwem, którym żyje już Mark-complete.
  const renderSectionManualField = useCallback(
    (sectionId: string) => {
      const meta = INSIGHT_SECTIONS.find((s) => s.id === sectionId);
      const label = meta ? (isPolish ? meta.label.pl : meta.label.en) : sectionId;
      const persisted = sectionOverrides[sectionId]?.content ?? '';
      const draft = sectionDrafts[sectionId];
      const value = draft ?? persisted;
      return (
        <InsightSectionManualField
          sectionId={sectionId}
          sectionLabel={label}
          value={value}
          onValueChange={(v) => setSectionDraft(sectionId, v)}
          onSave={() => void handleSaveSectionOverride(sectionId)}
          onRevert={() => handleRevertSectionOverride(sectionId)}
          hasOverride={Boolean(persisted)}
          saving={savingSectionId === sectionId}
          dirty={draft !== undefined && draft !== persisted}
          previewMode={readMode}
          isPolish={isPolish}
          artifactTitle={insight?.title || title}
          artifactStatus={insight?.status}
          savedAt={sectionOverrides[sectionId]?.updatedAt}
          textareaRef={manualFieldRef}
        />
      );
    },
    [
      isPolish,
      sectionOverrides,
      sectionDrafts,
      savingSectionId,
      readMode,
      insight,
      title,
      setSectionDraft,
      handleSaveSectionOverride,
      handleRevertSectionOverride,
    ]
  );

  // Apply Sections-dropdown visibility toggles + inject the Mark-complete control
  // and the manual-edit field into the active section. Hidden sections drop out
  // of the nav/canvas entirely.
  const visibleNModeSections = useMemo<NModeSection[]>(
    () =>
      orderedNModeSectionsWithContent
        .filter((section) => !hiddenSectionIds.has(section.id))
        .map((section) =>
          section.id === activeNSection
            ? {
                ...section,
                component: (
                  <>
                    {renderSectionCompleteToggle(section.id)}
                    {renderSectionManualField(section.id)}
                    {section.component}
                  </>
                ),
              }
            : section
        ),
    [
      orderedNModeSectionsWithContent,
      hiddenSectionIds,
      activeNSection,
      renderSectionCompleteToggle,
      renderSectionManualField,
    ]
  );

  useEffect(() => {
    if (visibleNModeSections.length === 0) return;
    if (!visibleNModeSections.some((section) => section.id === activeNSection)) {
      setActiveNSection(visibleNModeSections[0].id);
    }
  }, [visibleNModeSections, activeNSection]);

  // #25 — content-bearing sections offered in the export dialog. We exclude the
  // pure-UI / audit sections (next-actions, comments, activity log) that have no
  // exportable narrative body.
  const exportableSections = useMemo(() => {
    const excluded = new Set(['artifact-actions', 'comments', 'activity-log']);
    return nModeSectionsWithContent.filter((s) => !excluded.has(s.id));
  }, [nModeSectionsWithContent]);

  // ── Phase A3 / Phase E — canonical section → DeckCard mapping ──────────────
  // Used by both Present mode (fullscreen deck) and the `deck` export target.
  // We walk INSIGHT_SECTIONS in CANONICAL order (the nav order, NOT any drag
  // order) so the deck always reflects the doctrine sequence. Body text is
  // derived from the section's rendered narrative (best-effort markdown match)
  // with sensible fallbacks for the summary-style sections.
  const buildDeckCards = useCallback((): DeckCard[] => {
    const cards: DeckCard[] = [];
    INSIGHT_SECTIONS.forEach((section, index) => {
      // Resolve a plain-text body for this section.
      let body = stripMarkdownPreview(buildFilteredMarkdown([section.id]) || '');
      if (!body) {
        if (section.id === 'executive-summary' || section.id === 'executive-memo') {
          body = executiveSummary;
        } else if (section.id === 'consulting-readout' || section.id === 'consulting-narrative') {
          body = stripMarkdownPreview(insight?.content || '');
        }
      }
      body = (body || '').trim();
      // Skip sections that have no derivable content — a deck of empty slides
      // helps no one.
      if (!body) return;

      const cardTitle = t(`interview.insightViewer.sectionLabel.${section.id}`, section.label.en);
      // cSpan drives a coarse layout hint: 3-wide sections get the full-bleed
      // content layout, everything else a standard single-column body.
      const layoutId = section.cSpan && section.cSpan >= 3 ? 'content_wide' : 'content_standard';

      cards.push({
        card_id: `insight-${insight?.id ?? 'unknown'}-${section.id}`,
        deck_id: `insight-${insight?.id ?? 'unknown'}`,
        order_index: index,
        intent: index === 0 ? 'cover' : 'content',
        layout_id: layoutId,
        title: cardTitle,
        blocks: [
          {
            block_id: `insight-${section.id}-body`,
            card_id: `insight-${insight?.id ?? 'unknown'}-${section.id}`,
            type: 'paragraph',
            content: { text: body.slice(0, 1200) },
            is_refreshable: false,
            position: { area: 'full', order: 0 },
            ai_editable: false,
          },
        ],
        source_refs: [],
        has_refreshable_data: false,
        background: { type: 'theme' },
        animations: { entrance: 'fade', block_stagger: false },
        is_locked: false,
      });
    });
    return cards;
  }, [buildFilteredMarkdown, executiveSummary, insight?.content, insight?.id, isPolish]);

  const presentCards = useMemo<DeckCard[]>(
    () => (presentOpen ? buildDeckCards() : []),
    [presentOpen, buildDeckCards]
  );

  // Plain-text canonical sections used by the hidden Report (PDF) print root.
  const reportPrintSections = useMemo(
    () =>
      buildDeckCards().map((card) => ({
        title: card.title,
        body: String((card.blocks[0]?.content as { text?: string } | undefined)?.text ?? ''),
      })),
    [buildDeckCards]
  );

  // #25 — target catalogue. `supported` targets feed the existing export
  // handlers with the chosen section ids; unsupported ones are shown but
  // disabled-with-tooltip (honest over fake).
  const exportTargets = useMemo<
    {
      id: ExportTargetId;
      label: { en: string; pl: string };
      icon: React.FC<{ size?: number; className?: string }>;
      supported: boolean;
      hint: { en: string; pl: string };
    }[]
  >(
    () => [
      {
        id: 'note',
        label: { en: 'Note (fragments)', pl: 'Notatka (fragmenty)' },
        icon: BookOpen,
        supported: true,
        hint: {
          en: 'Selected sections become notebook fragments.',
          pl: 'Wybrane sekcje stają się fragmentami notatnika.',
        },
      },
      {
        id: 'tools',
        label: { en: 'Tools / Idea', pl: 'Narzędzia / Pomysł' },
        icon: Target,
        supported: true,
        hint: {
          en: 'Hand selected sections to a Discovery tool.',
          pl: 'Przekaż wybrane sekcje do narzędzia Discovery.',
        },
      },
      {
        id: 'assessment',
        label: { en: 'Assessment / Table', pl: 'Ocena / Tabela' },
        icon: BarChart3,
        supported: true,
        hint: {
          en: 'Map selected sections into an assessment.',
          pl: 'Zmapuj wybrane sekcje do oceny.',
        },
      },
      {
        id: 'markdown',
        label: { en: 'Markdown file', pl: 'Plik Markdown' },
        icon: Download,
        supported: true,
        hint: {
          en: 'Download the selected sections as a .md file.',
          pl: 'Pobierz wybrane sekcje jako plik .md.',
        },
      },
      {
        id: 'report',
        label: { en: 'Report', pl: 'Raport' },
        icon: FileText,
        supported: true,
        hint: {
          en: 'Download the selected sections as a PDF report.',
          pl: 'Pobierz wybrane sekcje jako raport PDF.',
        },
      },
      {
        id: 'deck',
        label: { en: 'Deck', pl: 'Prezentacja' },
        icon: LayoutGrid,
        supported: true,
        hint: {
          en: 'Export the canonical sections as a presentation deck.',
          pl: 'Eksportuj sekcje kanoniczne jako prezentację.',
        },
      },
      {
        id: 'initiative',
        label: { en: 'Initiative', pl: 'Inicjatywa' },
        icon: Rocket,
        supported: false,
        hint: {
          en: 'Use a finding’s "Create initiative" handoff instead.',
          pl: 'Użyj przekazania "Utwórz inicjatywę" przy wniosku.',
        },
      },
    ],
    []
  );

  const openExportDialog = useCallback(() => {
    // Default: all sections with hasData selected.
    const defaults = exportableSections.filter((s) => s.hasData !== false).map((s) => s.id);
    setExportSelectedIds(new Set(defaults));
    setExportTarget('note');
    setExportDialogOpen(true);
  }, [exportableSections]);

  const toggleExportSection = useCallback((id: string) => {
    setExportSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllExportSections = useCallback(() => {
    setExportSelectedIds(new Set(exportableSections.map((s) => s.id)));
  }, [exportableSections]);

  const clearExportSections = useCallback(() => {
    setExportSelectedIds(new Set());
  }, []);

  const runSmartExport = useCallback(async () => {
    const ids = Array.from(exportSelectedIds);
    if (ids.length === 0) {
      toast.error(t('interview.insightViewer.selectAtLeastOneSection'));
      return;
    }
    setExportRunning(true);
    try {
      switch (exportTarget) {
        case 'note':
          await handleExportToNotebook(ids);
          break;
        case 'tools':
        case 'idea':
          await handleExportToTools(ids);
          break;
        case 'assessment':
        case 'table':
          await handleExportToAssessment(ids);
          break;
        case 'markdown':
          handleExportMarkdown(ids);
          break;
        case 'report': {
          // Phase E — render-to-PDF over the hidden printable container that
          // holds the canonical insight sections (always complete, regardless of
          // which C-board section is active).
          const fileName = `${(insight?.title || 'insight').replace(/[^a-z0-9]/gi, '_')}.pdf`;
          const ok = await exportReportToPDF(REPORT_PRINT_ELEMENT_ID, fileName);
          if (ok) {
            toast.success(t('interview.insightViewer.downloadedPdfReport'));
          } else {
            toast.error(t('interview.insightViewer.failedToExportReport'));
          }
          break;
        }
        case 'deck': {
          // Phase E — present the insight as a live deck. The canonical
          // section→card mapping (buildDeckCards) drives PresentMode fullscreen.
          // (exportPresentationDeck is deckId/server-backed and an insight is not
          // a stored deck, so we open the in-app presenter instead — mirrors the
          // initiative Smart Export "Deck" target.)
          if (!insight?.id) {
            toast.error(t('interview.insightViewer.noInsightToPresent'));
            break;
          }
          setExportDialogOpen(false);
          setPresentOpen(true);
          break;
        }
        default:
          // unsupported targets are disabled in the UI; guard anyway
          toast.error(t('interview.insightViewer.thisTargetIsNotSupported'));
          return;
      }
      setExportDialogOpen(false);
    } finally {
      setExportRunning(false);
    }
  }, [
    exportSelectedIds,
    exportTarget,
    isPolish,
    insight?.id,
    insight?.title,
    handleExportToNotebook,
    handleExportToTools,
    handleExportToAssessment,
    handleExportMarkdown,
  ]);

  // ── VF1-2 a11y: Esc = zamknij artefakt (kanon §12.3/§17) ──────────────────
  // Skips when typing in a field, or while a local dropdown/dialog owns its
  // own close-affordance (toolbar menus, export dialog, present mode, gen
  // modal, handoff modal); keyboard-only, no visual change.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (
        exportMenuOpen ||
        aiMenuOpen ||
        sectionsMenuOpen ||
        exportDialogOpen ||
        presentOpen ||
        handoffModalOpen ||
        genOpen
      ) {
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onClose,
    exportMenuOpen,
    aiMenuOpen,
    sectionsMenuOpen,
    exportDialogOpen,
    presentOpen,
    handoffModalOpen,
    genOpen,
  ]);

  // ── ETAP 3 standardu n-Type: „Analizuj z AI" AKTYWNEJ KARTY ────────────────
  // Kryteria oceny Insightu (kontrakt właściciela 2026-07-23) żyją w rubryce
  // silnika (`ARTIFACT_CRITERIA.insight`): jasność tezy · jakość dowodów ·
  // poziom pewności · brakujące źródła · sprzeczności · potencjalny wpływ ·
  // gotowość do konwersji.
  //
  // ★ POLA WYGENEROWANE PRZEZ AI (executiveSummary, themes, issues,
  //   opportunities, signals) POZOSTAJĄ TYLKO-DO-ODCZYTU — i to nadal jest stan
  //   faktyczny, nie wybór: jedyną drogą ich zmiany jest `regenerateInsight`,
  //   czyli przepisanie CAŁOŚCI. Panel pokaże dla nich „Kopiuj treść" zamiast
  //   „Zastosuj", z jawnym powodem.
  //
  // ★ ZMIANA (właściciel 2026-07-23 + zapis sekcji na serwerze): doszło JEDNO
  //   pole ZAPISYWALNE — ręczna treść aktywnej sekcji (`section_overrides`,
  //   PATCH /interview/insights/:id). Dzięki temu „Zastosuj" w Proponowanych
  //   zmianach robi coś realnego: wkłada propozycję AI do pola redakcyjnego
  //   sekcji i zapisuje ją — zamiast być trwale wyszarzone. AI nadal NIE
  //   nadpisuje niczego bez kliknięcia człowieka (kontrakt cardAnalysis).
  const insightAnalysisFields = useMemo<CardAnalysisField[]>(() => {
    const asLines = (items: unknown[], toText: (x: any) => string) =>
      (items || []).map((x) => `- ${toText(x)}`).join('\n');

    const field = (id: string, label: string, value: string): CardAnalysisField => ({
      id,
      label,
      value,
      kind: 'text',
      writable: false,
    });

    const generated: CardAnalysisField[] = ((): CardAnalysisField[] => {
      switch (activeNSection) {
        case 'executive-summary':
          return [
            field(
              'executive-summary',
              isPolish ? 'Podsumowanie' : 'Executive summary',
              insight?.executiveSummary || executiveSummary || ''
            ),
          ];

        case 'consulting-readout':
          return [
            field(
              'consulting-readout',
              isPolish ? 'Odczyt konsultingowy' : 'Consulting readout',
              insight?.content || ''
            ),
          ];

        case 'themes':
          return [
            field(
              'themes',
              isPolish ? 'Tematy' : 'Themes',
              asLines(v6Themes, (th) => `${th?.title ?? th?.name ?? ''}: ${th?.description ?? ''}`)
            ),
          ];

        case 'issues-risks':
          return [
            field(
              'issues-risks',
              isPolish ? 'Problemy i ryzyka' : 'Issues & risks',
              asLines(v6Issues, (i) => `${i?.title ?? ''}: ${i?.description ?? ''}`)
            ),
          ];

        case 'opportunities':
          return [
            field(
              'opportunities',
              isPolish ? 'Przestrzenie szans' : 'Opportunity spaces',
              asLines(v6Opportunities, (o) => `${o?.title ?? ''}: ${o?.description ?? ''}`)
            ),
          ];

        case 'signals':
          return [
            field(
              'signals',
              isPolish ? 'Sygnały' : 'Signals',
              asLines(v6Signals, (s) => `${s?.title ?? s?.signal ?? ''}: ${s?.description ?? ''}`)
            ),
          ];

        default:
          // Karty pochodne (macierz, cytaty, przemilczenia, konsensus…) są
          // wyliczane z tych samych źródeł co powyżej. Zamiast zgadywać ich
          // wewnętrzny kształt, podajemy trzon Insightu jako kontekst i MÓWIMY,
          // że treść tej karty nie jest wystawiona do analizy pole-po-polu.
          return [
            field(
              'insight-core',
              isPolish ? 'Treść wniosku (trzon)' : 'Insight content (core)',
              insight?.content || insight?.executiveSummary || ''
            ),
          ];
      }
    })();

    // Jedyne pole, do którego karta POTRAFI zapisać — ręczna redakcja sekcji.
    return [
      ...generated,
      {
        id: INSIGHT_MANUAL_FIELD_ID,
        label: isPolish
          ? 'Treść ręczna tej sekcji (redakcja konsultanta)'
          : 'Manual text of this section (consultant edit)',
        value: sectionDrafts[activeNSection] ?? sectionOverrides[activeNSection]?.content ?? '',
        kind: 'text',
        writable: true,
        hint: isPolish
          ? 'Pole redakcyjne sekcji. Tu wpisz gotowy tekst do zastosowania — leży obok treści z AI i jest zapisywane na wniosku.'
          : 'The section editing field. Put ready-to-use text here — it lives next to the AI content and is persisted on the insight.',
      },
    ];
  }, [
    activeNSection,
    isPolish,
    insight,
    executiveSummary,
    v6Themes,
    v6Issues,
    v6Opportunities,
    v6Signals,
    sectionDrafts,
    sectionOverrides,
  ]);

  const buildInsightAnalysisInput = useCallback(() => {
    const ctx = [
      `${isPolish ? 'Status' : 'Status'}: ${insight?.status ?? '—'}`,
      `${isPolish ? 'Status przeglądu' : 'Review status'}: ${insight?.reviewStatus ?? '—'}`,
      `${isPolish ? 'Liczba sesji źródłowych' : 'Source sessions'}: ${insight?.sourceSessionCount ?? 0}`,
      // „brakujące źródła" i „jakość dowodów" bez tych dwóch pól byłyby zgadywaniem.
      `${isPolish ? 'Brakujące dane (zadeklarowane)' : 'Missing data (declared)'}: ${
        (insight?.missingData || []).join('; ') || '—'
      }`,
      `${isPolish ? 'Wpisów mapy dowodów' : 'Evidence map entries'}: ${
        (insight?.evidenceMap || []).length
      }`,
      activeNSection !== 'executive-summary' && (insight?.executiveSummary || executiveSummary)
        ? `${isPolish ? 'Podsumowanie' : 'Executive summary'}: ${insight?.executiveSummary || executiveSummary}`
        : '',
      `${isPolish ? 'Tematy' : 'Themes'}: ${v6Themes.length} · ${isPolish ? 'Problemy' : 'Issues'}: ${v6Issues.length} · ${isPolish ? 'Szanse' : 'Opportunities'}: ${v6Opportunities.length}`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      artifactType: 'insight' as const,
      cardId: activeNSection,
      artifactTitle: insight?.title ?? '',
      artifactContext: ctx,
      fields: insightAnalysisFields,
      isPolish,
    };
  }, [
    activeNSection,
    isPolish,
    insight,
    executiveSummary,
    v6Themes,
    v6Issues,
    v6Opportunities,
    insightAnalysisFields,
  ]);

  /**
   * Jedyna droga zapisu z panelu „Analizuj z AI". Przyjmuje WYŁĄCZNIE pole
   * ręcznej redakcji sekcji — pola wygenerowane przez AI nadal nie mają
   * endpointu zapisu i muszą zwrócić `false` (panel oznaczy pozycję jako
   * nieudaną zamiast udawać sukces).
   *
   * Zapis idzie przez ten sam handler co ręczna edycja, więc nie powstaje druga,
   * konkurencyjna ścieżka do backendu.
   */
  const applyInsightAnalysisChange = useCallback(
    (change: { fieldId: string; proposedValue: string; mode?: string }) => {
      if (change.fieldId !== INSIGHT_MANUAL_FIELD_ID) return false;
      const sectionId = activeNSection;
      const current = sectionDrafts[sectionId] ?? sectionOverrides[sectionId]?.content ?? '';
      const next =
        change.mode === 'append' && current.trim()
          ? `${current.replace(/\s+$/, '')}\n${change.proposedValue}`
          : change.proposedValue;
      setSectionDraft(sectionId, next);
      // Zapis w tle z JAWNĄ wartością (setState jeszcze nie zdążył wejść w stan);
      // błąd sieci zgłasza toast z `handleSaveSectionOverride` i NIE kasuje
      // wpisanego tekstu — draft zostaje w polu do ponowienia.
      void handleSaveSectionOverride(sectionId, next);
      return true;
    },
    [activeNSection, sectionDrafts, sectionOverrides, setSectionDraft, handleSaveSectionOverride]
  );

  const insightCardAnalysis = useCardAIAnalysis({
    activeCardId: activeNSection,
    buildInput: buildInsightAnalysisInput,
    applyChange: applyInsightAnalysisChange,
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  // VF1-2 (SPEC-A): swap ad-hoc spinner/error markup for the shared
  // shared/states library (record archetype) — gated (visible change,
  // needs Piotr's screenshot sign-off per reguła #7).

  if (isLoading) {
    if (VF1_INSIGHT_SPECA) {
      return (
        <div className="flex h-full items-center justify-center bg-c-bg p-8">
          <div className="w-full max-w-xl">
            <SkeletonState variant="record" />
          </div>
        </div>
      );
    }
    return <LoadingState variant="spinner" className="h-full bg-white dark:bg-c-bg py-0" />;
  }

  if (error) {
    if (VF1_INSIGHT_SPECA) {
      return (
        <div className="flex h-full items-center justify-center bg-c-bg">
          <ErrorState
            title={isPolish ? 'Nie udało się wczytać wniosku' : 'Failed to load insight'}
            description={error}
            onBack={onClose}
            backLabel={t('interview.insightViewer.goBack')}
          />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-c-bg gap-4">
        <AlertCircle size={48} className="text-danger-400" />
        <p className="text-danger-500">{error}</p>
        <button
          onClick={onClose}
          className="text-sm text-c-text-muted hover:text-c-text-secondary underline"
        >
          {t('interview.insightViewer.goBack')}
        </button>
      </div>
    );
  }

  // ── SPEC-A prawy panel artefaktu (ArtifactRightPanel) ─────────────────────
  // Stała kolejność: Akcje · Właściwości · Powiązania · Komentarze ·
  // Historia. Wyłącznie ISTNIEJĄCE handlery/dane — zero nowego backendu.
  // Centrum (N-mode sekcje obserwacja/znaczenie/rekomendacja) pozostaje
  // nietknięte — ten panel tylko dokuje się z boku (NModeShell `rightPanel`).
  const panelDash = '—';
  // VF1-2 bug fix: previously used `t('interview.insightViewer.enUs')` as the
  // BCP-47 locale tag. When the `interview` i18n bundle hasn't loaded yet,
  // `t()` falls back to returning the raw key string, which is not a valid
  // language tag → `toLocaleDateString`/`toLocaleString` throw
  // `RangeError: Invalid language tag`, tripping the ErrorBoundary. Derive
  // the tag directly from `isPolish` (already resolved from `i18n.language`,
  // no translation-bundle dependency) and keep a try/catch as a last-resort
  // guard against any other unexpected locale value.
  const panelLocale = isPolish ? 'pl-PL' : 'en-US';
  const fmtPanelDate = (v?: string) => {
    if (!v) return panelDash;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    try {
      return d.toLocaleDateString(panelLocale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return d.toISOString().slice(0, 10);
    }
  };
  // (usunięte) fmtPanelDateTime — obsługiwało wyłącznie skróty komentarzy
  // i historii w panelu; oba skróty zastąpione pełnymi canvasami (SPEC-N §2.1),
  // które formatują daty same.

  // ── Kafelki „utwórz z tego wniosku" (decyzja właściciela nr 2, 2026-07-23) ──
  // Jedyne miejsce, w którym powstaje `ArtifactActionPanel` dla Insightu.
  // Wariant `compact` (dwie grupy pigułek: Dokumenty / W aplikacji) jest tym,
  // który mieści się w stałej szerokości prawego panelu — pełne kafle 2xN
  // rozsadzałyby go w poziomie.
  const resultTilesNode = (
    <ArtifactActionPanel
      isPolish={isPolish}
      variant="compact"
      // Kontekst projektu — bez niego `POST /api/decisions` odrzuca żądanie
      // („Missing decision context"), więc kafelek „Rozpocznij decyzję"
      // renderuje się wyłączony z powodem zamiast zapraszać w błąd.
      projectId={currentProjectId || null}
      source={{
        type: 'interview_insight',
        id: insight?.id || insightId,
        title: insight?.title || title || t('interview.insightViewer.insight'),
        status: insight?.status,
        content: insight?.content || executiveSummary,
        confidence: panelConfidence,
        limits: uniqueNonEmpty(findings.map((finding) => finding.limits)).join('\n') || null,
        evidenceCount: sourcePack?.activePointerCount ?? findingsSummary.activeEvidence,
        sourceSessionCount:
          sourcePack?.sourceSessionIds.length || insight?.sourceSessionIds?.length || 0,
        sourcePack: sourcePack ? (sourcePack as unknown as Record<string, unknown>) : null,
        reportPack: reportPack
          ? {
              id: reportPack.id,
              status: reportPack.status,
              readinessStatus: reportReadiness?.status || undefined,
              completenessScore: reportReadiness?.completenessScore ?? reportPack.completenessScore,
              degraded: reportPack.degraded,
              degradedReasons: reportPack.degradedReasons,
            }
          : null,
      }}
    />
  );

  const rightPanelSections: ArtifactRightPanelSection[] = [
    {
      // SPEC-N §2.6 (anty-duplikacja: jedna akcja = jedno miejsce). Ta sekcja
      // trzymała TRZY przyciski, z których KAŻDY miał drugie, zawsze widoczne
      // wejście — ten sam handler renderowany dwa razy:
      //   · Save            → nagłówek NModeShell (onSave + wskaźnik „Saved");
      //   · Export          → toolbar, slot 3 „Export ▾" (openExportDialog);
      //   · AI Consultant   → toolbar, slot 9 (openInsightConsultant).
      // Reguła rozstrzygająca: zostaje miejsce widoczne ZAWSZE (nagłówek/toolbar),
      // znika duplikat w panelu. Funkcja użytkownikowi nie znika — zmienia się
      // tylko liczba wejść z dwóch na jedno.
      //
      // ⚠ ROZSTRZYGNIĘCIE (właściciel, 2026-07-23, ETAP 2.5 pkt 3): „Akcje —
      // osobno od Rezultatów: zmiana statusu, przypisanie, recenzja, forkowanie."
      // Sekcja przestaje być pusta i dostaje JEDYNĄ akcję, która ma tu realne
      // pokrycie: przejście stanu cyklu życia (`runStatusTransition` — ten sam
      // handler, który do dziś siedział WYŁĄCZNIE jako niewidoczny `select`
      // naciągnięty na pigułkę statusu we Właściwościach). Rozdział jest teraz
      // czysty: Właściwości POKAZUJĄ stan, Akcje go ZMIENIAJĄ, Rezultaty mówią,
      // co z wniosku powstało.
      //
      // ŚWIADOMIE NIEOBECNE (brak pokrycia — patrz raport ETAP 2.5, Z-3/Z-4):
      //  · przypisanie — model wniosku nie ma pola właściciela/przypisanego,
      //  · forkowanie  — handler forka żyje w kebabie wiersza tabeli Insights
      //                  (InterviewHub → rowMenu), nie w tym komponencie,
      //  · recenzja    — „wyślij do recenzji" to przejście stanu `in_review`,
      //                  więc jest już w przejściach wyżej; osobny przycisk
      //                  byłby drugim wejściem do tego samego handlera (§2.6).
      id: 'actions',
      label: t('interview.insightViewer.actions'),
      icon: Sparkles,
      // ── PODGLĄD = TYLKO CZYTANIE (decyzja właściciela 2026-07-24) ──
      // `readMode` jest PIERWSZYM warunkiem pustki: przyciski niżej wywołują
      // `runStatusTransition`, czyli ZAPIS statusu wniosku. W Podglądzie
      // sekcja mówi to samo, co w Zadaniu i Decyzji — akcje są w Edycji.
      // Etap 4 gridu n-Type (_GRID_STABILIZATION_COMMAND_2026-07-24.md): w
      // Podglądzie sekcja jest ZWINIĘTA z licznikiem 0, bez komunikatu
      // opisowego (był tu tekst „Actions are hidden in preview mode" — SSOT
      // go zakazuje wprost). Drugi powód pustki (`!statusEditable` /
      // brak opcji statusu) zachowuje swój własny, opisowy komunikat — to
      // NIE jest tryb Podgląd, więc reguła go nie dotyczy.
      defaultOpen: !(readMode || !statusEditable || statusBaseOptions.length === 0),
      isEmpty: readMode || !statusEditable || statusBaseOptions.length === 0,
      badge: readMode ? 0 : undefined,
      showZeroBadge: true,
      emptyLabel: readMode ? undefined : t('interview.insightViewer.actionsLiveInHeaderAndToolbar'),
      children: readMode ? null : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {statusBaseOptions
              .filter((opt) => opt.value !== currentInsightStatus)
              .map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => runStatusTransition(opt.value)}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface-raised px-2.5 text-xs font-medium text-c-text transition-colors hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                >
                  {t(`interview.insightViewer.statusOptionLabel.${opt.value}`, opt.label.en)}
                </button>
              ))}
          </div>
          <p className="text-[11px] leading-relaxed text-c-text-muted">
            {t(
              'interview.insightViewer.panelActionsHint',
              'Pick a state to move this insight forward in its lifecycle.'
            )}
          </p>
        </div>
      ),
    },
    {
      id: 'properties',
      label: t('interview.insightViewer.properties'),
      icon: Flag,
      defaultOpen: true,
      children: (
        <ArtifactPropertiesTable
          propertyLabel={t('interview.insightViewer.property')}
          valueLabel={t('interview.insightViewer.value')}
          rows={[
            {
              // SPEC-N §2.6 (2026-07-23): status POKAZUJEMY tu, ZMIENIAMY
              // w sekcji Akcje. Do dziś na pigułkę był naciągnięty niewidzialny
              // `<select>` — ten sam handler `runStatusTransition` co w Akcjach,
              // tylko ukryty i nieodkrywalny (kliknięcie w „właściwość" otwierało
              // listę wyboru). Zostaje jedno, widoczne wejście: przyciski przejść
              // w Akcjach. Właściwość wraca do bycia właściwością.
              id: 'status',
              label: t('interview.insightViewer.status'),
              value: (
                <span
                  className={`inline-flex h-6 items-center gap-1.5 px-2 rounded-md text-[11px] font-semibold ${statusPill.bg} ${statusPill.text}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusPill.dot}`} />
                  <span className="truncate">{statusPillLabel || currentInsightStatus}</span>
                </span>
              ),
            },
            {
              id: 'source',
              label: t('interview.insightViewer.source'),
              value: t('interview.insightViewer.sessionsCount', {
                count: insight?.sourceSessionCount ?? 0,
              }),
            },
            {
              id: 'date',
              label: t('interview.insightViewer.date'),
              value: fmtPanelDate(insight?.createdAt),
              mono: true,
            },
            {
              id: 'confidence',
              label: t('interview.insightViewer.confidence'),
              value: panelConfidence ? confidenceShortLabel(t, panelConfidence) : panelDash,
            },
            {
              id: 'findings',
              label: t('interview.insightViewer.findings'),
              value: String(findingsSummary.total),
              mono: true,
            },
            {
              id: 'tag',
              label: t('interview.insightViewer.tag'),
              value: t(
                `interview.insightViewer.insightTypeLabel.${insight?.promptType || 'summary'}`,
                typeMeta.label
              ),
            },
          ]}
        />
      ),
    },
    {
      id: 'relations',
      label: t('interview.insightViewer.relations'),
      icon: Link2,
      // Kanon n-Type: domyslnie rozwiniete TYLKO Akcje i Wlasciwosci.
      defaultOpen: false,
      isEmpty: sourceSessions.length === 0,
      emptyLabel: t('interview.insightViewer.noRelations'),
      children: (
        <div className="flex flex-col gap-2">
          {sourceSessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-xs font-medium bg-c-surface-raised text-c-text border border-c-border-subtle truncate">
                <MessageSquare size={12} className="text-c-text-muted shrink-0" />
                <span className="truncate">{session.name}</span>
              </span>
              <button
                type="button"
                onClick={() => openSourceSessionInInterviewHub(session)}
                className="p-1 rounded-md text-c-text-muted hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                title={t('interview.insightViewer.openInterview')}
              >
                <ExternalLink size={12} />
              </button>
            </div>
          ))}
        </div>
      ),
    },
    {
      // Warstwa Dowodowa (H1 Harvey-gap) — SSOT §3.3
      // Harvard/wdrozenie-100/_KONCEPT_RDZEN_2026-07-10.md. Insight = pierwszy
      // artefakt wpięty; envelope renderowany przez EvidencePanelSection
      // (fetch własny — patrz komponent). Reszta typów artefaktu = TODO.
      id: 'evidence',
      label: t('interview.insightViewer.sourcesAssumptions'),
      icon: Link2,
      defaultOpen: false,
      children: (
        <EvidencePanelSection artifactType="insight" artifactId={insight?.id} isPolish={isPolish} />
      ),
    },
    {
      // ── REZULTATY — pozycja 5 (decyzja właściciela nr 2, 2026-07-23) ───────
      // Standard n-Type §7.2 wiąże kolejność: Akcje · Właściwości · Powiązania ·
      // Źródła i założenia · REZULTATY · Komentarze · Historia. Sekcja stała do
      // teraz na pozycji 2 (zaraz po Akcjach) — przesunięta tutaj, bez wyjątków.
      //
      // §7.7: Rezultaty TWORZĄ lub WYSYŁAJĄ efekt artefaktu; Akcje zmieniają
      // jego stan. Dlatego kafelki „utwórz…" (raport · prezentacja · tabela ·
      // idea · notatka · inicjatywa · decyzja) zjechały TU z centrum — i tam ich
      // już NIE MA (§2.6: jedna funkcja, jedno miejsce). Pod kafelkami zostaje
      // rejestr tego, co z wniosku już powstało (`/api/artifact-conversions`).
      //
      // ⚠ DO DECYZJI WŁAŚCICIELA (raport): „Konwertuj na inicjatywę" jest
      // JEDNOCZEŚNIE akcją główną w nagłówku (generator inicjatywy, `setGenOpen`)
      // i kafelkiem `initiative` w tej sekcji (bezpośredni `POST /initiatives`).
      // To dwie różne ścieżki kodu o tym samym celu; 04_INSIGHT §6.3 mówi
      // „Konwertuj na inicjatywę — jeśli nie pozostaje w nagłówku". Nie usuwam
      // kafelka samowolnie, bo to odebranie działającej zdolności — zgłaszam.
      id: 'results',
      label: t('interview.insightViewer.panelResults', 'Results'),
      icon: Rocket,
      defaultOpen: false,
      badge: producedResults.length || undefined,
      children: (
        <div className="flex flex-col gap-3">
          {/* PODGLĄD = TYLKO CZYTANIE (2026-07-24): kafelki „utwórz raport /
              prezentację / tabelę / ideę / notatkę / inicjatywę / decyzję"
              robią `POST` i TWORZĄ nowy artefakt. W Podglądzie znikają.
              ZOSTAJE rejestr „Już powstało" niżej — to czyste czytanie
              (co z tego wniosku już zrobiono), więc nie ma powodu go zdejmować. */}
          {readMode ? null : resultTilesNode}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
              {t('interview.insightViewer.panelResultsProduced', 'Already produced')}
            </span>
            {producedResults.length === 0 ? (
              <span className="text-[11px] leading-snug text-c-text-muted">
                {t(
                  'interview.insightViewer.panelResultsEmpty',
                  'Nothing has been produced from this insight yet.'
                )}
              </span>
            ) : (
              producedResults.map((conv) => (
                <div key={conv.id} className="flex items-center justify-between gap-2">
                  <span className="inline-flex h-6 min-w-0 items-center gap-1.5 truncate rounded-md border border-c-border-subtle bg-c-surface-raised px-2 text-xs font-medium text-c-text">
                    <FileText size={12} className="shrink-0 text-c-text-muted" />
                    <span className="truncate">{conv.targetArtifactType}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-c-text-muted">
                    {conv.conversionStatus}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ),
    },
    {
      // SPEC-N §2.1 + §2.6 — komentarze mieszkają WYŁĄCZNIE tutaj. Do 2026-07-21
      // panel pokazywał skrót (6 pozycji, tylko do odczytu), a pełny CommentsCanvas
      // stał drugi raz w lewej nawigacji. Skasowanie centrum bez przeniesienia
      // canvasu odebrałoby użytkownikowi dodawanie/kasowanie/filtr/sortowanie
      // komentarzy — a znikać ma DUPLIKAT, nie funkcja. Dlatego panel dostaje
      // canvas w PEŁNEJ formie (ten sam komponent, te same handlery).
      id: 'comments',
      label: t('interview.insightViewer.comments'),
      icon: MessageSquare,
      defaultOpen: false,
      badge: nComments.length,
      children: (
        <CommentsCanvas
          comments={filteredComments}
          /* PODGLĄD = TYLKO CZYTANIE (2026-07-24): `locked` to TEN SAM prop,
             którym Zadanie (`isDone || readMode`) i Decyzja
             (`isDecisionStageLocked`) blokują kompozytor komentarzy. Bez niego
             Insight był jedyną z sześciu kart z ŻYWYM polem „Napisz komentarz…"
             w Podglądzie (zmierzone: 1 edytowalny input vs 0 w pozostałych).
             Filtr i sortowanie też gasną — ale to zachowanie wspólnego
             komponentu, identyczne u Zadania i Decyzji, więc karta nie
             wprowadza tu własnej odmiany. */
          locked={readMode}
          onDeleteComment={handleDeleteComment}
          dateFilter={commentDateFilter}
          onDateFilterChange={setCommentDateFilter}
          sortOrder={commentSortOrder}
          onToggleSort={() => setCommentSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
          commentDraft={commentDraft}
          onCommentDraftChange={setCommentDraft}
          onSubmitComment={handleSubmitComment}
          draftPriority={draftPriority}
          onDraftPriorityChange={setDraftPriority}
          getPriorityDotClass={getPriorityDotClass}
          getCommentPriority={getCommentPriority}
          getPriorityButtonClass={getPriorityButtonClass}
          getCommentPriorityLabel={getCommentPriorityLabel}
          getCommentPriorityHint={getCommentPriorityHint}
        />
      ),
    },
    {
      // SPEC-N §2.1 + §2.6 — dziennik aktywności mieszka WYŁĄCZNIE tutaj.
      // Analogicznie do komentarzy: panel pokazywał skrót (8 wpisów), a pełny
      // ActivityLogCanvas stał drugi raz w lewej nawigacji. Zostaje canvas
      // (wszystkie wpisy + karty statystyk + ikony typów), znika duplikat.
      id: 'history',
      label: t('interview.insightViewer.historyAi'),
      icon: History,
      defaultOpen: false,
      badge: activityEntries.length,
      children: (
        <ActivityLogCanvas
          entries={nModeActivityEntries}
          stats={activityStats}
          typeMeta={activityTypeMeta}
        />
      ),
    },
  ];

  return (
    <>
      <NModeShell
        header={{
          title,
          onTitleChange: setTitle,
          titlePlaceholder: { en: 'Insight title...', pl: 'Tytuł wniosku...' },
          // D-A: tytuł edytowalny tylko gdy karta otwarta w Edycji (readMode
          // false); w Podglądzie (readMode true) tytuł jest tylko-do-odczytu.
          titleReadOnly: readMode,
          artifactId: insight?.id,
          artifactType: 'insight',
          onSave: handleSave,
          saving,
          isDirty,
          onChat: handleOpenChat,
          onClose,
          // D-B: status = etykieta-pigułka (zlokalizowana + ton c-*), NIE kropka.
          statusLabel: statusPillLabel,
          statusTone: headerStatusTone,
          // PODGLĄD = TYLKO CZYTANIE (2026-07-24): „Konwertuj na inicjatywę"
          // otwiera generator, który TWORZY nowy artefakt (Inicjatywę) —
          // typowa akcja zmieniająca stan systemu, więc w Podglądzie znika.
          // Zdolność zostaje o jedno kliknięcie dalej (przełącz na Edycję),
          // a Menu 1 w Podglądzie jest puste tak jak w Zadaniu i Decyzji.
          primaryAction: readMode
            ? undefined
            : {
                label: { en: 'Convert to initiative', pl: 'Konwertuj na inicjatywę' },
                icon: Rocket,
                onClick: () => setGenOpen(true),
                disabled: !insight?.id,
              },
        }}
        sections={visibleNModeSections}
        activeSection={activeNSection}
        onSectionChange={setActiveNSection}
        // ⚠ 2026-07-23 (sędzia grafiki, pkt 9): `NModeLeftNav` rysuje uchwyt
        // `GripVertical` przy KAŻDEJ pozycji, gdy tylko dostanie
        // `onSectionReorder`. Karta otwiera się w PODGLĄDZIE, więc na wejściu
        // widać było 11 uchwytów przeciągania — zaproszenie do edycji układu
        // w trybie, który z definicji niczego nie zmienia. Przekazujemy
        // handler wyłącznie w Edycji: w Podglądzie prop znika, uchwyty razem
        // z nim, a sama zdolność (zmiana kolejności sekcji) zostaje o jedno
        // kliknięcie dalej — w Edycji, gdzie jej miejsce.
        onSectionReorder={
          readMode
            ? undefined
            : (ids) => {
                // Left-nav drag → cardLayout is SSOT. Keep the legacy order key
                // in sync for back-compat; the layout persist owns the real order.
                cardLayout.reorderByIds(ids);
                handleNModeSectionReorder(ids);
              }
        }
        presentationMode={presentationMode}
        onPresentationModeChange={setPresentationMode}
        // ETAP 1.1 n-Type: karta N ma JEDEN widok — bez przełącznika N/C.
        showModeSwitcher={false}
        rightPanel={
          // ETAP 1.4 — bez klasy panel dziedziczyl `border-l` powloki, czyli
          // sidebar doklejony do krawedzi. Teraz ten sam wyglad co Inicjatywa:
          // jasna zaokraglona karta odsunieta od brzegu (wariant _DOCKED).
          <ArtifactRightPanel
            sections={rightPanelSections}
            className={ARTIFACT_PANEL_CARD_CLASS_DOCKED}
            ariaLabel={t('interview.insightViewer.insightDetails')}
            statusBar={
              // HP-8 workflow-engine status bar — behind ff_artifactApprovalUi
              // (default OFF, see src/utils/artifactApprovalUiFlag.ts). At
              // OFF this is `undefined` and ArtifactRightPanel renders 1:1
              // as before (no new DOM, no visual change).
              //
              // PODGLĄD = TYLKO CZYTANIE (2026-07-24): dołożony warunek
              // `!readMode` — pasek niesie „Zgłoś do recenzji" (zapis obiegu
              // akceptacji) i stał AKTYWNY nad sekcją „Akcje", która w tym
              // samym panelu mówiła, że akcji nie ma. Ta sama bramka, którą
              // Decyzja dostała dzień wcześniej (`showApprovalBar`).
              isArtifactApprovalUiEnabled() && insight?.id && !readMode ? (
                <ArtifactApprovalStatusBar
                  artifactType="insight"
                  artifactId={insight.id}
                  currentUserId={currentUser?.id}
                  canReview
                />
              ) : undefined
            }
          />
        }
        buildArtifactCode={(type, id) => buildArtifactCode(type as ArtifactType, id)}
        renderActionBar={() => {
          // ETAP 1.2 standardu n-Type — MENU 2 = wspolny `NModeMenu2`, trzy strefy:
          //   LEWA   Sekcje  |  SRODEK Edycja|Podglad  |  PRAWA Analizuj z AI
          //
          // ZDJETE z paska (zgloszenie wlasciciela pkt 2):
          //   - "+ Nowa karta"  : karty sa predefiniowane, widocznoscia steruje Sekcje,
          //   - "Eksport"       : czeka na decyzje produktowa gdzie ma zamieszkac
          //                       (kebab vs sekcja Rezultaty); do tego czasu za flaga
          //                       INSIGHT_EXPORT_IN_MENU2 (domyslnie OFF),
          //   - nazwa aktywnej karty (m.in. "Dalsze akcje") : dublowala lewa nawigacje,
          //   - "AI sekcji"     : kazda sekcja ma juz wlasny przycisk regeneracji
          //                       (ten sam handleRegenerate), wiec pasek go dublowal,
          //   - "Prezentuj"     : i tak wylaczone flaga VITE_PRESENT_MODE.
          //
          // ⚠ 2026-07-23 (sędzia grafiki, pkt 8) — SZEROKOŚĆ MENU 2 = SZEROKOŚĆ
          // MENU 1. NAPRAWIONE 2026-07-24 W POWŁOCE (Etap 0): `NModeShell`
          // przeniósł `px-6` NA ZEWNĄTRZ limitu `max-w-6xl` (Segment 2), więc
          // Menu 2 ma teraz tę samą geometrię co Menu 1 i Sekcje bez żadnej
          // korekty po stronie karty. Poprzedni obejściowy `<div className="-mx-6">`
          // ZDJĘTY: po naprawie powłoki nadmiernie korygował (wypychał pasek
          // 24 px w lewo i poszerzał o 48 px), tworząc rozjazd w drugą stronę
          // i doklejając menu do krawędzi przy wąskim oknie.
          return (
            <NModeMenu2
              isPolish={isPolish}
              readMode={readMode}
              onReadModeChange={setReadMode}
              aiButton={
                // ETAP 3: przycisk ANALIZUJE aktywną kartę i otwiera panel
                // wyników. Było: `openInsightConsultant()` — czat konsultanta
                // na poziomie CAŁEGO artefaktu, bez oceny konkretnej karty.
                // Konsultant nie zniknął: żyje w toolbarze (slot 9) i w panelu
                // Akcje, więc żadna zdolność nie została zabrana.
                // Nadpisanie etykiety zdjęte — przycisk niesie teraz nazwę ze
                // standardu („Analizuj z AI"), zgodną z tym, co robi.
                //
                // ⚠ 2026-07-23 (sędzia grafiki, pkt 3): było `readMode ?
                // undefined : (...)`, a karta OTWIERA SIĘ w Podglądzie
                // (`insightOpensInPreview` → readMode=true). Efekt: prawa
                // strefa Menu 2 była PUSTA przy wejściu, a najważniejsza
                // zdolność karty (analiza AI) nie istniała, dopóki użytkownik
                // sam nie przełączył się na Edycję — czego nie miał powodu
                // zrobić. Analiza jest operacją CZYTAJĄCĄ (nie modyfikuje
                // treści), więc w Podglądzie jest równie legalna jak w Edycji.
                // Wzór: KnownToolDetailView.tsx (aiButton bezwarunkowo).
                <Menu2AIButton
                  isPolish={isPolish}
                  busy={insightCardAnalysis.loading}
                  aria-expanded={insightCardAnalysis.open}
                  onClick={() => {
                    setExportMenuOpen(false);
                    setSectionsMenuOpen(false);
                    setAiMenuOpen(false);
                    insightCardAnalysis.run();
                  }}
                />
              }
              overflowKebab={
                INSIGHT_EXPORT_IN_MENU2 ? (
                  <div className="relative" ref={exportMenuRef}>
                    <ToolbarGhostButton
                      icon={<ExternalLink size={14} />}
                      onClick={() => {
                        setExportMenuOpen((v) => !v);
                        setAiMenuOpen(false);
                        setSectionsMenuOpen(false);
                      }}
                    >
                      {t('interview.insightViewer.export')}
                      <ChevronDown
                        size={13}
                        className={`ml-0.5 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`}
                      />
                    </ToolbarGhostButton>
                    {exportMenuOpen && (
                      <div className="absolute left-0 z-30 mt-1 w-56 rounded-xl border border-c-border-subtle bg-white dark:bg-c-surface shadow-lg py-1">
                        {/* Canon destinations: Notatki · Idee/Tools · Prezentacja · PDF */}
                        <button
                          onClick={() => {
                            setExportMenuOpen(false);
                            handleExportToNotebook();
                          }}
                          disabled={isExportingNotebook || insight?.status !== 'completed'}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-c-text-secondary hover:bg-state-hover disabled:opacity-50"
                        >
                          {isExportingNotebook ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <BookOpen size={14} />
                          )}
                          {t('interview.insightViewer.toNotebook')}
                        </button>
                        <button
                          onClick={() => {
                            setExportMenuOpen(false);
                            handleExportToTools();
                          }}
                          disabled={isExportingTools || insight?.status !== 'completed'}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-c-text-secondary hover:bg-state-hover disabled:opacity-50"
                        >
                          {isExportingTools ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Target size={14} />
                          )}
                          {t('interview.insightViewer.toIdeasTools')}
                        </button>
                        <button
                          onClick={() => {
                            setExportMenuOpen(false);
                            setExportTarget('deck');
                            setPresentOpen(true);
                          }}
                          disabled={insight?.status !== 'completed'}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-c-text-secondary hover:bg-state-hover disabled:opacity-50"
                        >
                          <LayoutGrid size={14} />
                          {t('interview.insightViewer.toDeck')}
                        </button>
                        <button
                          onClick={() => {
                            setExportMenuOpen(false);
                            setExportTarget('report');
                            openExportDialog();
                          }}
                          disabled={insight?.status !== 'completed'}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-c-text-secondary hover:bg-state-hover disabled:opacity-50"
                        >
                          <FileText size={14} />
                          {t('interview.insightViewer.pdfReport')}
                        </button>
                        <div className="my-1 h-px bg-c-surface-raised" />
                        <button
                          onClick={() => {
                            setExportMenuOpen(false);
                            openExportDialog();
                          }}
                          disabled={insight?.status !== 'completed'}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-teal-700 dark:text-teal-300 hover:bg-state-hover disabled:opacity-50"
                        >
                          <Sparkles size={14} />
                          {t('interview.insightViewer.smartExport')}
                        </button>
                        <button
                          onClick={() => {
                            setExportMenuOpen(false);
                            handleExportMarkdown();
                          }}
                          disabled={insight?.status !== 'completed'}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-c-text-muted hover:bg-state-hover disabled:opacity-50"
                        >
                          <Download size={14} />
                          {t('interview.insightViewer.downloadMd')}
                        </button>
                        <div className="my-1 h-px bg-c-surface-raised" />
                        {/* Propose initiatives — moved here from the old AI dropdown so
                            the feature stays reachable after the slot-9 rework. */}
                        <button
                          onClick={() => {
                            setExportMenuOpen(false);
                            setGenOpen(true);
                          }}
                          disabled={!insight?.id}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-c-text-secondary hover:bg-state-hover disabled:opacity-50"
                        >
                          <Rocket size={14} />
                          {t('interview.insightViewer.proposeInitiatives')}
                        </button>
                      </div>
                    )}
                  </div>
                ) : undefined
              }
              sectionsMenu={
                <div className="relative" ref={sectionsMenuRef}>
                  <ToolbarGhostButton
                    icon={<Layers size={14} />}
                    onClick={() => {
                      setSectionsMenuOpen((v) => !v);
                      setExportMenuOpen(false);
                      setAiMenuOpen(false);
                    }}
                  >
                    {t('interview.insightViewer.sections')}
                    <ChevronDown
                      size={13}
                      className={`ml-0.5 transition-transform ${sectionsMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </ToolbarGhostButton>
                  {sectionsMenuOpen && (
                    <div className="absolute left-0 z-30 mt-1 w-72 max-h-[70vh] overflow-y-auto rounded-xl border border-c-border-subtle bg-white dark:bg-c-surface shadow-lg py-1">
                      {(() => {
                        // Group like the left nav (#22b). Walk in canonical order.
                        // MIGRACJA (domknięcie dedup Phase-D): gdy kontrakt kart ON,
                        // „Sekcje ▾" respektuje katalog kanoniczny — sekcje spoza
                        // katalogu (np. `executive-memo`/`recommendations`, scalone
                        // z rdzeniem Faza 0 DEDUP) NIE pojawiają się tu, tak samo jak
                        // już znikły z „+ Nowa karta ▾" (AddCardMenu → layout.availableToAdd
                        // z tego samego katalogu). Flaga OFF ⇒ bez zmian (32 sekcje jak dotąd).
                        const catalogIds = insightCardContractEnabled
                          ? new Set(cardLayout.catalog.map((c) => c.id))
                          : null;
                        const groups: { group: string; items: NModeSection[] }[] = [];
                        orderedNModeSectionsWithContent
                          .filter((s) => !catalogIds || catalogIds.has(s.id))
                          .forEach((s) => {
                            const g = s.group ?? '';
                            let bucket = groups.find((b) => b.group === g);
                            if (!bucket) {
                              bucket = { group: g, items: [] };
                              groups.push(bucket);
                            }
                            bucket.items.push(s);
                          });
                        return groups.map((bucket) => (
                          <div key={bucket.group} className="px-1 py-1">
                            {bucket.group && (
                              <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
                                {bucket.group}
                              </div>
                            )}
                            {bucket.items.map((s) => {
                              const empty = s.hasData === false && !s.alwaysShow;
                              const hidden = hiddenSectionIds.has(s.id);
                              const Icon = s.icon;
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() =>
                                    // SSOT = cardLayout; hidden state syncs down via effect.
                                    hidden ? cardLayout.showCard(s.id) : cardLayout.hideCard(s.id)
                                  }
                                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs rounded-lg hover:bg-state-hover"
                                >
                                  <span className="shrink-0 text-c-text-muted">
                                    {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </span>
                                  <Icon
                                    size={13}
                                    className={empty ? 'text-c-text-muted/60' : 'text-c-text-muted'}
                                  />
                                  <span
                                    className={`flex-1 truncate ${
                                      empty ? 'text-c-text-muted' : 'text-c-text-secondary'
                                    } ${hidden ? 'line-through opacity-60' : ''}`}
                                  >
                                    {t(`interview.insightViewer.sectionLabel.${s.id}`, s.label.en)}
                                  </span>
                                  {empty && (
                                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide bg-c-surface-raised text-c-text-muted">
                                      {t('interview.insightViewer.empty2')}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ));
                      })()}
                      <div className="my-1 h-px bg-c-surface-raised" />
                      <button
                        type="button"
                        onClick={() => {
                          cardLayout.resetToDefault();
                          setSectionsMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-c-text-secondary hover:bg-state-hover"
                      >
                        <RefreshCw size={14} />
                        {t('interview.insightViewer.restoreDefaults')}
                      </button>
                    </div>
                  )}
                </div>
              }
            />
          );
        }}
      >
        {insight && (
          <InitiativeGeneratorModal
            isOpen={genOpen}
            onClose={() => setGenOpen(false)}
            source={{
              label: insight.title,
              content: insight.content,
              sourceType: 'interview_insight',
              sourceId: insight.id,
            }}
            isPolish={isPolish}
            onCreated={() => setGenOpen(false)}
          />
        )}

        {handoffModalOpen && handoffFinding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => {
                setHandoffModalOpen(false);
                setHandoffFinding(null);
              }}
            />
            <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-c-surface rounded-2xl shadow-2xl border border-c-border-subtle overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-c-border-subtle">
                <h3 className="text-base font-semibold text-c-text dark:text-white">
                  {t('interview.insightViewer.createInitiativeFromFinding')}
                </h3>
                <button
                  onClick={() => {
                    setHandoffModalOpen(false);
                    setHandoffFinding(null);
                  }}
                  className="p-1.5 rounded-lg hover:bg-state-hover text-c-text-secondary transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-c-text-muted uppercase tracking-wider">
                    {t('interview.insightViewer.findingStatement')}
                  </label>
                  <div className="mt-1 px-3 py-2 rounded-lg bg-c-surface-raised text-sm text-c-text border border-c-border-subtle">
                    {handoffFinding.title}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-c-text-muted uppercase tracking-wider">
                      {t('interview.insightViewer.confidenceLevelLabel', 'Confidence level')}
                    </label>
                    <div className="mt-1 px-3 py-2 rounded-lg bg-c-surface-raised text-sm text-c-text-secondary border border-c-border-subtle">
                      {confidenceShortLabel(t, handoffFinding.confidence)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-c-text-muted uppercase tracking-wider">
                      {t('interview.insightViewer.type')}
                    </label>
                    <div className="mt-1 px-3 py-2 rounded-lg bg-c-surface-raised text-sm text-c-text-secondary border border-c-border-subtle">
                      {handoffFinding.sectionType}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-c-text-muted uppercase tracking-wider">
                    {t('interview.insightViewer.limitsAssumptions')}
                  </label>
                  <div className="mt-1 px-3 py-2 rounded-lg bg-c-surface-raised text-sm text-c-text-secondary border border-c-border-subtle min-h-[40px]">
                    {handoffFinding.limits && handoffFinding.limits.length > 0 ? (
                      <ul className="list-disc list-inside space-y-0.5">
                        {handoffFinding.limits.map((l, i) => (
                          <li key={i} className="text-xs italic">
                            {l}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs italic text-c-text-secondary">
                        {t('interview.insightViewer.noLimitsSpecified')}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-c-text-muted uppercase tracking-wider">
                    {t('interview.insightViewer.linkToExistingInitiative')}
                  </label>
                  <div className="mt-1">
                    <Select
                      value={handoffTargetInitiativeId}
                      onChange={setHandoffTargetInitiativeId}
                      disabled={handoffSubmitting || handoffInitiativesLoading}
                      options={handoffInitiatives.map((i) => ({
                        value: i.id,
                        label: i.status ? `${i.title} · ${i.status}` : i.title,
                      }))}
                      placeholder={
                        handoffInitiativesLoading
                          ? t('interview.insightViewer.loadingInitiatives')
                          : handoffInitiatives.length === 0
                            ? t('interview.insightViewer.noExistingInitiatives')
                            : t('interview.insightViewer.selectAnInitiative')
                      }
                      aria-label={t('interview.insightViewer.selectTargetInitiative')}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-c-text-muted">
                    {t('interview.insightViewer.pickAnInitiativeAboveTo')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-4 border-t border-c-border-subtle bg-c-surface-raised">
                <button
                  onClick={() => handleHandoffSubmit('link')}
                  disabled={handoffSubmitting || !handoffTargetInitiativeId}
                  title={
                    !handoffTargetInitiativeId
                      ? t('interview.insightViewer.pickATargetInitiativeAbove')
                      : undefined
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-c-surface-raised text-c-text-secondary hover:bg-state-hover text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {handoffSubmitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Link2 size={14} />
                  )}
                  {t('interview.insightViewer.linkToExisting')}
                </button>
                <button
                  onClick={() => handleHandoffSubmit('create')}
                  disabled={handoffSubmitting}
                  // SPEC-N §2.3 dotyczy POWIERZCHNI ARTEFAKTU (nagłówek·toolbar·
                  // panel·centrum). To jest MODAL — osobna powierzchnia z własnym,
                  // dokładnie jednym slotem primary („Utwórz nową inicjatywę");
                  // drugi przycisk obok jest neutralny. Degradacja potwierdzenia
                  // dialogu do outline byłaby regresją afordancji, nie porządkiem,
                  // więc świadomie zostaje solid i jest oznaczona furtką bramki.
                  // DO OBEJRZENIA PRZEZ WŁAŚCICIELA: jeśli reguła ma obejmować też
                  // modale — zdejmij `karty-n-ok` i przenieś na tokeny neutralne.
                  className={
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all disabled:opacity-50' /* karty-n-ok */
                  }
                >
                  {handoffSubmitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  {t('interview.insightViewer.createNewInitiative')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* #25 — Smart export generator: preview-pane dialog. Left = section
          checkbox table; right = target picker + live preview of selection. */}
        {exportDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => !exportRunning && setExportDialogOpen(false)}
            />
            <div className="relative w-full max-w-3xl mx-4 bg-white dark:bg-c-surface rounded-2xl shadow-2xl border border-c-border-subtle overflow-hidden flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-c-border-subtle">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-blue-500" />
                  <h3 className="text-base font-semibold text-c-text dark:text-white">
                    {t('interview.insightViewer.smartExport2')}
                  </h3>
                </div>
                <button
                  onClick={() => !exportRunning && setExportDialogOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-state-hover text-c-text-secondary transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Target picker */}
              <div className="px-6 pt-4">
                <label className="text-xs font-medium text-c-text-muted uppercase tracking-wider">
                  {t('interview.insightViewer.exportTarget')}
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {exportTargets.map((et) => {
                    const Icon = et.icon;
                    const active = exportTarget === et.id;
                    return (
                      <button
                        key={et.id}
                        onClick={() => et.supported && setExportTarget(et.id)}
                        disabled={!et.supported}
                        title={
                          t(`interview.insightViewer.exportTargetHint.${et.id}`, et.hint.en) ||
                          undefined
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          active
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                            : 'border-c-border-subtle text-c-text-secondary hover:bg-state-hover'
                        } ${!et.supported ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <Icon size={14} />
                        {t(`interview.insightViewer.exportTargetLabel.${et.id}`, et.label.en)}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-c-text-muted">
                  {(() => {
                    const activeTarget = exportTargets.find((et) => et.id === exportTarget);
                    return activeTarget
                      ? t(
                          `interview.insightViewer.exportTargetHint.${activeTarget.id}`,
                          activeTarget.hint.en
                        )
                      : null;
                  })()}
                </p>
                {(exportTarget === 'tools' || exportTarget === 'assessment') && (
                  <p className="mt-1 flex items-start gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
                    <span>{t('interview.insightViewer.sectionSelectionAppliesToThis')}</span>
                  </p>
                )}
              </div>

              {/* Body: left = section table, right = preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 flex-1 min-h-0 mt-3 border-t border-c-border-subtle">
                {/* Left: section checkbox table */}
                <div className="flex flex-col min-h-0 border-r border-c-border-subtle">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-c-border-subtle">
                    <span className="text-xs font-semibold text-c-text-secondary">
                      {t('interview.insightViewer.sections')} ({exportSelectedIds.size}/
                      {exportableSections.length})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAllExportSections}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {t('interview.insightViewer.all')}
                      </button>
                      <span className="text-c-border-strong">·</span>
                      <button
                        onClick={clearExportSections}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {t('interview.insightViewer.none')}
                      </button>
                    </div>
                  </div>
                  <div className="overflow-y-auto px-2 py-2 max-h-[42vh]">
                    {exportableSections.map((s) => {
                      const checked = exportSelectedIds.has(s.id);
                      const empty = s.hasData === false;
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleExportSection(s.id)}
                          className="flex w-full items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-state-hover"
                        >
                          {checked ? (
                            <CheckSquare size={15} className="shrink-0 text-blue-500" />
                          ) : (
                            <Square size={15} className="shrink-0 text-c-border-strong" />
                          )}
                          <span
                            className={`flex-1 text-xs ${
                              empty ? 'text-c-text-muted' : 'text-c-text-secondary'
                            }`}
                          >
                            {t(`interview.insightViewer.sectionLabel.${s.id}`, s.label.en)}
                          </span>
                          {typeof s.badge === 'number' && s.badge > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-c-surface-raised text-c-text-muted">
                              {s.badge}
                            </span>
                          )}
                          {empty && (
                            <span className="text-[10px] text-c-text-muted italic">
                              {t('interview.insightViewer.empty3')}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {exportableSections.length === 0 && (
                      <p className="px-2 py-4 text-xs text-c-text-muted">
                        {t('interview.insightViewer.noExportableSections')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: live preview */}
                <div className="flex flex-col min-h-0">
                  <div className="px-4 py-2 border-b border-c-border-subtle">
                    <span className="text-xs font-semibold text-c-text-secondary">
                      {t('interview.insightViewer.preview')}
                    </span>
                  </div>
                  <div className="overflow-y-auto px-4 py-3 max-h-[42vh] text-xs text-c-text-secondary space-y-2">
                    {exportSelectedIds.size === 0 ? (
                      <p className="text-c-text-muted italic">
                        {t('interview.insightViewer.selectSectionsToPreview')}
                      </p>
                    ) : (
                      <>
                        <p className="text-[11px] text-c-text-muted">
                          {t('interview.insightViewer.sectionsWillBeExportedTo', {
                            count: exportSelectedIds.size,
                            target: (() => {
                              const et = exportTargets.find((x) => x.id === exportTarget);
                              return et
                                ? t(
                                    `interview.insightViewer.exportTargetLabel.${et.id}`,
                                    et.label.en
                                  )
                                : '';
                            })(),
                          })}
                        </p>
                        <ul className="space-y-1">
                          {exportableSections
                            .filter((s) => exportSelectedIds.has(s.id))
                            .map((s) => (
                              <li key={s.id} className="flex items-center gap-2">
                                <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                                <span className="flex-1">
                                  {t(`interview.insightViewer.sectionLabel.${s.id}`, s.label.en)}
                                </span>
                                <span className="text-[10px] text-c-text-muted">{s.group}</span>
                              </li>
                            ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-c-border-subtle">
                <p className="text-[11px] text-c-text-muted">
                  {t('interview.insightViewer.sectionFilteringIsAppliedClient')}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => !exportRunning && setExportDialogOpen(false)}
                    className="px-4 py-2 rounded-xl text-sm text-c-text-secondary hover:bg-state-hover transition-colors"
                  >
                    {t('interview.insightViewer.cancel')}
                  </button>
                  <button
                    onClick={runSmartExport}
                    disabled={exportRunning || exportSelectedIds.size === 0}
                    // Jak wyżej (modal Smart Export): osobna powierzchnia, własny
                    // jeden primary („Eksportuj") + neutralne „Anuluj". SPEC-N §2.3
                    // adresuje powierzchnię artefaktu, nie dialogi — furtka bramki
                    // z uzasadnieniem zamiast cichego naruszenia.
                    className={
                      'flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all disabled:opacity-50' /* karty-n-ok */
                    }
                  >
                    {exportRunning ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ExternalLink size={14} />
                    )}
                    {t('interview.insightViewer.export2')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* C-mode (Standard C / ClickUp) is now rendered by NModeShell itself via
          the canonical NModeCBoard (top group-tabs + dense 3-col grid), driven
          by the same `sections`. No custom children needed. (#21) */}
      </NModeShell>

      {/* #56 (D17): dawny artifact-level AIConsultantPanel (drugi czat) został
          scalony w JEDEN docked panel Teresy. „AI Konsultant" (toolbar + prawy
          panel Akcje) wywołuje openInsightConsultant() — otwiera Teresę z
          kontekstem insightu i publikuje 5 akcji jako przyciski komend wewnątrz
          Teresy. Komponent AIConsultantPanel nie jest już renderowany (plik
          zostaje do sprzątnięcia martwego kodu po odbiorze). */}

      {/* ── ETAP 3: panel wyników „Analizuj z AI" ─────────────────────────────
          `writableFieldIds` zawiera DOKŁADNIE JEDNO pole — ręczną redakcję
          aktywnej sekcji (`section_overrides`; zapis dodany 2026-07-23). Pola
          wygenerowane przez AI nadal nie mają endpointu zapisu, więc dla nich
          panel pokazuje „Kopiuj treść" zamiast „Zastosuj", z jawnym powodem
          (patrz komentarz przy `insightAnalysisFields`) — zamiast udawać zapis. */}
      <NCardAIAnalysisPanel
        open={insightCardAnalysis.open}
        onClose={insightCardAnalysis.close}
        loading={insightCardAnalysis.loading}
        result={insightCardAnalysis.result}
        errorCode={insightCardAnalysis.errorCode}
        serverErrorCode={insightCardAnalysis.serverErrorCode}
        onRerun={insightCardAnalysis.rerun}
        onApplyChange={insightCardAnalysis.applyChange}
        writableFieldIds={[INSIGHT_MANUAL_FIELD_ID]}
        readMode={readMode}
        isPolish={isPolish}
      />

      {/* Phase A3 — fullscreen Present mode over the canonical insight sections */}
      {presentOpen && presentCards.length > 0 && (
        <PresentMode
          cards={presentCards}
          title={insight?.title || title}
          onExit={() => setPresentOpen(false)}
        />
      )}

      {/* Phase E — hidden, print-only Report root captured by exportReportToPDF.
          Off-screen (not display:none, so html2canvas can still measure it). */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          left: '-10000px',
          top: 0,
          width: '794px',
          background: '#ffffff',
          color: '#111827',
          padding: '32px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div id={REPORT_PRINT_ELEMENT_ID}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>
            {insight?.title || title}
          </h1>
          {reportPrintSections.map((s) => (
            <section key={s.title} style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>{s.title}</h2>
              <p style={{ fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0 }}>
                {s.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
};

export default InsightViewer;
