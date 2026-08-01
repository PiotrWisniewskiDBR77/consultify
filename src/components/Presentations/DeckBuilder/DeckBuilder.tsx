/**
 * Deck Builder V3 — Gamma-like WYSIWYG Presentation Editor
 * Three-panel layout: Slide Sorter | Card Canvas | Block Toolbar
 * Features: Teresa, Command Palette, Theme Switcher, Version History,
 * animations, collaboration, data refresh, source traceability, media library.
 */

import { AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { UnifiedChatPanel } from '@/components/AIChat/UnifiedChatPanel';
import { getSourceDisplayLabel } from '@/components/Initiatives/InitiativeSourceLink';
import { EmbeddedView } from '@/components/shared/NModeBlocks';
import { ErrorState as SpecAErrorState, SkeletonState } from '@/components/shared/states';
import { ArtifactApprovalStatusBar } from '@/components/standard/ArtifactApprovalStatusBar';
import { EvidencePanelSection } from '@/components/standard/EvidencePanelSection';
import { ErrorState, LoadingState } from '@/components/ui/primitives';
import { EntityStatusChip } from '@/components/ui/primitives/chips/EntityStatusChip';
import { Api } from '@/services/api';
import { PresentationStudioApi } from '@/services/api/presentationStudio.api';
import { exportPresentationDeck, PresentationExportError } from '@/services/presentationExport';
import {
  fetchPresentationGovernanceCard,
  type GovernanceVerdict,
} from '@/services/presentationGovernance';
import {
  deriveLastAgentActivity,
  fetchPresentationRuntimeEvents,
  type PresentationRuntimeEvent,
} from '@/services/presentationRuntimeEvents';
import { useAppStore } from '@/store/useAppStore';
import { AppView } from '@/types';
import type { WorkspaceContext } from '@/types/workspace';
import { isArtifactApprovalUiEnabled } from '@/utils/artifactApprovalUiFlag';
import { isEvidencePanelEnabled } from '@/utils/evidencePanelFlag';
import { isMelsDeckBuilderEnabled } from '@/utils/melsDeckBuilderFlag';

import type { CardBlock, Deck, DeckCard } from '../wizard/types';
import { AgentActivityPanel } from './AgentActivityPanel';
import { deleteBlockFromList, duplicateBlockInList, moveBlockInList } from './blockOps';
import { BlockToolbar } from './BlockToolbar';
import { CardCanvas } from './CardCanvas';
import { CommandPalette, useCommandPaletteShortcut } from './CommandPalette';
import { ConflictBanner } from './ConflictBanner';
import { DeckAuditLogModal } from './DeckAuditLogModal';
import { DeckBuilderBottomBar } from './DeckBuilderBottomBar';
import type { DeckBuilderTopBarChipsState } from './DeckBuilderMelsChips';
import { DeckBuilderMelsView } from './DeckBuilderMelsView';
import { DeckBuilderTopBar } from './DeckBuilderTopBar';
import { DeckCommentsPanel, type DeckSlideRef } from './DeckCommentsPanel';
// STEP 1b — reuse the canonical composition normalizer so this builder's local
// unifiedJson→Deck converter honours B1's composition identically to deckData.ts.
import { normalizeSlideComposition } from './deckData';
import { DeckGovernanceCardModal } from './DeckGovernanceCardModal';
import { DeckPresenceStack } from './DeckPresenceStack';
import { DeckQualityGatesPanel } from './DeckQualityGatesPanel';
import { DeckRelationsPanel } from './DeckRelationsPanel';
import type { BrandKit } from './DeckThemeContext';
import { DeckThemeProvider } from './DeckThemeContext';
import { MediaLibraryBrowser } from './MediaLibraryBrowser';
import { PresentMode } from './PresentMode';
import { ShareAnalyticsPanel } from './ShareAnalyticsPanel';
import { ShareModal } from './ShareModal';
import { SlideSorter } from './SlideSorter';
import { ThemeSwitcher } from './ThemeSwitcher';
import { useCollaboration } from './useCollaboration';
import { useDataRefresh } from './useDataRefresh';
import { useDeckState } from './useDeckState';
import { useVersionHistory } from './useVersionHistory';
import { VersionHistoryPanel } from './VersionHistoryPanel';

// VF1-7 (SPEC-A wzorzec Deck): gate for the shared/states swap on the
// loading/error guards below (SkeletonState variant="deck" / ErrorState).
// Default OFF until Piotr accepts on screenshots (reguła #7 — Piotr nie jest
// pierwszym testerem wizualnym). Zero change in behaviour while OFF.
const VF1_DECK_SPECA = import.meta.env.VITE_VF1_DECK_SPECA === 'true';

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function deckFromUnifiedJson(params: {
  deckId: string;
  title?: string;
  unifiedJson: unknown;
  sourceRefs?: Deck['source_refs'];
  orgId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: Deck['status'];
}): Deck | null {
  const parsed = safeJsonParse<any>(params.unifiedJson, null);
  if (!parsed?.slides || !Array.isArray(parsed.slides)) return null;

  const nowIso = new Date().toISOString();

  const intentMap: Record<string, DeckCard['intent']> = {
    cover: 'cover',
    executive_summary: 'executive_summary',
    section_intro: 'section_intro',
    key_messages: 'key_messages',
    performance_overview: 'performance_overview',
    single_insight: 'single_insight',
    comparison: 'comparison',
    assessment: 'assessment',
    roadmap: 'roadmap',
    risk_management: 'risk_management',
    recommendation_portfolio: 'recommendation_portfolio',
    recommendation_single: 'recommendation_portfolio',
    initiative_portfolio: 'initiative_portfolio',
    next_steps: 'next_steps',
    appendix: 'appendix',
    root_cause: 'assessment',
    prioritization_matrix: 'prioritization_matrix',
  };

  const cards: DeckCard[] = parsed.slides.map((slide: any, idx: number) => {
    const cardId = slide.slide_id || slide.id || slide.card_id || `card-${params.deckId}-${idx}`;
    const intent = intentMap[String(slide.intent || '')] || 'key_messages';
    const contentType = String(slide?.content?.type || slide?.intent || '');

    const blocks: CardBlock[] = [];
    const pushBlock = (
      type: CardBlock['type'],
      content: Record<string, unknown>,
      isRefreshable = false
    ) => {
      blocks.push({
        block_id: `block-${cardId}-${blocks.length}`,
        card_id: cardId,
        type,
        content,
        is_refreshable: isRefreshable,
        position: { area: 'full', order: blocks.length },
        ai_editable: true,
      });
    };

    // Title-ish heading
    const headingText =
      slide?.content?.title ||
      slide?.content?.headline ||
      slide?.content?.section_title ||
      slide?.key_message ||
      slide?.intent ||
      'Slide';
    pushBlock('heading', { text: String(headingText), level: 2 });

    if (contentType === 'cover') {
      const subtitle = slide?.content?.subtitle ? String(slide.content.subtitle) : '';
      const org = slide?.content?.organization ? String(slide.content.organization) : '';
      const date = slide?.content?.date ? String(slide.content.date) : '';
      const conf = slide?.content?.confidentiality ? String(slide.content.confidentiality) : '';
      const parts = [subtitle, org, date, conf].filter(Boolean);
      if (parts.length) pushBlock('paragraph', { text: parts.join(' · ') });
    } else if (contentType === 'executive_summary') {
      const findings = Array.isArray(slide?.content?.key_findings)
        ? slide.content.key_findings
        : [];
      if (findings.length) pushBlock('bullet_list', { items: findings.map((x: any) => String(x)) });
      const kpis = Array.isArray(slide?.content?.kpis) ? slide.content.kpis : [];
      if (kpis.length) {
        pushBlock(
          'metric_strip',
          {
            metrics: kpis.slice(0, 6).map((k: any) => ({
              label: String(k.label ?? k.name ?? 'KPI'),
              value: String(k.value ?? '—'),
              unit: k.unit ? String(k.unit) : '',
            })),
          },
          true
        );
      }
      if (slide?.content?.recommendation)
        pushBlock('callout', { text: String(slide.content.recommendation), kind: 'info' });
    } else if (contentType === 'key_messages') {
      const msgs = Array.isArray(slide?.content?.messages) ? slide.content.messages : [];
      if (msgs.length) {
        pushBlock('bullet_list', {
          items: msgs
            .slice(0, 10)
            .map((m: any) =>
              m?.description
                ? `${String(m.title || '')}: ${String(m.description)}`
                : String(m?.title || m)
            ),
        });
      }
    } else if (contentType === 'performance_overview') {
      const kpis = Array.isArray(slide?.content?.kpis) ? slide.content.kpis : [];
      if (kpis.length) {
        pushBlock(
          'metric_strip',
          {
            metrics: kpis.slice(0, 8).map((k: any) => ({
              label: String(k.label ?? k.name ?? 'KPI'),
              value: String(k.value ?? '—'),
              unit: k.unit ? String(k.unit) : '',
            })),
          },
          true
        );
      } else {
        pushBlock('paragraph', { text: slide?.key_message ? String(slide.key_message) : '—' });
      }
    } else if (contentType === 'single_insight') {
      const insight = slide?.content?.insight_text ? String(slide.content.insight_text) : '';
      if (insight) pushBlock('callout', { text: insight, kind: 'info' });
      if (slide?.content?.chart_data)
        pushBlock(
          'chart',
          { chartType: slide?.content?.chart_type || 'bar', data: slide.content.chart_data },
          true
        );
    } else {
      // Generic fallback (still editable)
      try {
        const pretty = JSON.stringify(slide?.content ?? slide, null, 2);
        pushBlock('paragraph', {
          text: pretty.length > 1200 ? `${pretty.slice(0, 1200)}…` : pretty,
        });
      } catch {
        pushBlock('paragraph', { text: String(slide?.key_message || '') });
      }
    }

    const hasRefreshable = blocks.some((b) => b.is_refreshable);

    // STEP 1b — honour B1's per-slide composition when present. The renderer
    // resolves `layout_id` (an archetype id) to a template and prefers the AI's
    // region plan. Absent/malformed composition → the prior hardcoded
    // intent→layout choice (byte-identical back-compat).
    const composition = normalizeSlideComposition((slide as any)?.composition);
    const heuristicLayoutId =
      intent === 'cover'
        ? 'cover_centered'
        : intent === 'performance_overview'
          ? 'data_grid'
          : 'content_full';
    const layoutId =
      composition?.layoutVariantId && composition.layoutVariantId.trim()
        ? composition.layoutVariantId.trim()
        : heuristicLayoutId;

    return {
      card_id: cardId,
      deck_id: params.deckId,
      order_index: idx,
      intent,
      layout_id: layoutId,
      composition: composition ?? null,
      title: String(headingText || 'Slide'),
      blocks,
      source_refs: [],
      has_refreshable_data: hasRefreshable,
      background: {
        type: intent === 'cover' ? 'gradient' : 'theme',
        value: intent === 'cover' ? 'linear-gradient(135deg, #0B3D91, #1A8A8A)' : undefined,
      },
      animations: { entrance: 'fade', block_stagger: false },
      is_locked: false,
    };
  });

  return {
    deck_id: params.deckId,
    organization_id: params.orgId || '',
    title: params.title || 'Untitled',
    theme_id: 'default',
    presentation_mode: 'show',
    communication_register: 'professional',
    image_style_preset: 'minimal_no_images',
    color_set_id: 'midnight_navy',
    status: params.status || 'draft',
    card_size: '16:9',
    cards,
    source_refs: Array.isArray(params.sourceRefs) ? params.sourceRefs : [],
    generation_settings: {
      text_mode: 'preserve',
      content_depth: 'concise',
      audience: 'internal',
      tone: 'professional',
      language: 'en',
      image_source: 'none',
    },
    animations_enabled: true,
    share_settings: { is_shared: false, permissions: 'view' },
    speaker_notes_generated: false,
    created_by: params.createdBy || '',
    created_at: params.createdAt || nowIso,
    updated_at: params.updatedAt || nowIso,
  };
}

export const DeckBuilder: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { deckId } = useParams<{ deckId: string }>();
  // J12-S1 — back navigation for the builder. Mirrors the legacy
  // DeckBuilderTopBar (`goToPresentations`) and sibling editors
  // (IdeaMapWorkspace → navigate('/my-work')): return to the presentations
  // library. Autosave (800ms debounce) has already persisted edits, so this
  // is non-destructive.
  const handleBackToPresentations = useCallback(() => {
    navigate('/presentations');
  }, [navigate]);
  const {
    deck,
    setDeck,
    activeCard,
    activeCardIndex,
    setActiveCardIndex,
    updateCard,
    reorderCards,
    deleteCard,
    duplicateCard,
    addCard,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useDeckState(null);

  // P3.3 — live presence (behind VITE_ENABLE_DECK_COLLABORATE). Fail-open:
  // resolving the current user or connecting the WS is entirely best-effort;
  // when the flag is off or anything fails, `collab.connectedUsers` stays empty
  // and the presence stack renders nothing — the editor is never blocked.
  const collaborateEnabled = import.meta.env.VITE_ENABLE_DECK_COLLABORATE === 'true';
  const currentUser = useMemo(() => {
    if (!collaborateEnabled) return null;
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const u = JSON.parse(raw);
      const userId = u?.id || u?.userId;
      if (!userId) return null;
      return {
        userId: String(userId),
        name: u?.name || u?.email || 'User',
        avatarUrl: u?.avatarUrl || u?.avatar_url,
      };
    } catch {
      return null;
    }
  }, [collaborateEnabled]);
  const collab = useCollaboration(deckId, currentUser, collaborateEnabled);

  // HP-8 — current user for the approval status bar (canonical store source;
  // distinct from the collaborate-only `currentUser` above, which is id-only
  // and null when VITE_ENABLE_DECK_COLLABORATE is off).
  const approvalUser = useAppStore((s) => s.currentUser);

  const [loadingDeck, setLoadingDeck] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deckReloadKey, setDeckReloadKey] = useState(0);
  // A4 (2026-07-23) — nie-blokujący sygnał jakości (Critic kompozycji + M19
  // walidacja strukturalna), zapisany na deckDocument.generation przy generacji
  // (ENABLE_DECK_QUALITY_GATES, default ON). Czytany TYLKO z już policzonych
  // danych persystowanych na decku — zero nowego liczenia w FE.
  const [deckQualityInfo, setDeckQualityInfo] = useState<{
    warnings: string[];
    critic?: { overallScore: number; regenerateSlides: number[]; passed: boolean };
  } | null>(null);
  const [qualityBannerExpanded, setQualityBannerExpanded] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedInitialRef = useRef(false);
  const serverVersionRef = useRef<number>(1);

  const [teresaOpen, setTeresaOpen] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [presentMode, setPresentMode] = useState<'off' | 'fullscreen' | 'presenter'>('off');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  // P3.1 — visible conflict state when autosave returns 409 (another session
  // saved the deck). Instead of silently overwriting the local (possibly
  // unsaved) edits with the server copy, we surface a banner and let the user
  // choose: reload the latest, or keep their version (which force-saves on top,
  // last-write-wins). `pendingServer` holds the freshly-fetched server deck so
  // "Reload latest" is instant.
  const [conflict, setConflict] = useState<{
    serverVersion: number | null;
    pendingServer: { deckJson: any; title: string } | null;
  } | null>(null);
  const [themeSwitcherOpen, setThemeSwitcherOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  // R4 — animations toggle UI removed; deck animations stay on by default.
  const [animationsEnabled] = useState(true);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  // P2.2 — "AI Generate" button in BlockToolbar's Images panel is in flight.
  const [generatingAiImage, setGeneratingAiImage] = useState(false);
  const [qualityGatesOpen, setQualityGatesOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [auditLogOpen, setAuditLogOpen] = useState(() => {
    if (typeof window === 'undefined' || !window.location) return false;
    try {
      return new URLSearchParams(window.location.search).get('audit_log') === 'true';
    } catch {
      return false;
    }
  });
  const [governanceModalOpen, setGovernanceModalOpen] = useState(false);
  const [governanceVerdict, setGovernanceVerdict] = useState<GovernanceVerdict | null>(null);
  // Right-rail active tool — controlled so the top-bar Comments chip can toggle
  // the comments panel (the rest of the rail stays user-driven).
  const [activeRailTool, setActiveRailTool] = useState<string | null>(null);
  const [openCommentCount, setOpenCommentCount] = useState(0);
  const [runtimeEvents, setRuntimeEvents] = useState<{
    events: PresentationRuntimeEvent[];
    degraded: boolean;
    reason?: string;
  }>({ events: [], degraded: false });
  const [lastAgentActivityAt, setLastAgentActivityAt] = useState<string | null>(null);
  const [deckBacklinks, setDeckBacklinks] = useState<
    Array<{ id: string; sourceType: string; sourceId: string }>
  >([]);
  const [deckBacklinksLoading, setDeckBacklinksLoading] = useState(false);
  const [pendingAgentEdit, setPendingAgentEdit] = useState<{
    deck: any;
    reply: string;
    actions: string[];
    operationId?: string;
    diff?: {
      cardsBefore?: number;
      cardsAfter?: number;
      cardsAdded?: number;
      cardsRemoved?: number;
      changedCards?: number;
      // ★ Fala 2 (SPEC §3.3.4) — 1-based slide numbers skipped because they
      // are locked (`is_locked`) and not explicitly named in the prompt.
      skippedLockedSlides?: number[];
    };
  } | null>(null);

  const getExpectedDeckVersion = useCallback(() => serverVersionRef.current, []);
  const syncDeckServerVersion = useCallback((version: number) => {
    serverVersionRef.current = version;
  }, []);
  const {
    versions,
    historyStatus,
    refreshVersions,
    hasUnsavedChanges,
    lastSavedAt,
    markSaved,
    restoreVersion,
    saveManualCheckpoint,
    markSaved,
    noteSaveStarted,
    notePersistedSave,
    noteSaveFailed,
  } = useVersionHistory(deck, deckId, getExpectedDeckVersion, syncDeckServerVersion);

  const { isCardOutdated, refreshCard, refreshAllCards, refreshBlock } = useDataRefresh(
    deck,
    updateCard
  );

  // Fala 1 (manual mode) — selected block for the floating toolbar / inline
  // TipTap edit (EditableBlock). Block ids are unique across the whole deck
  // (`block-<card_id>-<n>` or `block-<timestamp>-<rand>`), so a single id is
  // enough to identify the selection deck-wide.
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const handleSelectCard = useCallback(
    (index: number) => {
      setActiveCardIndex(index);
      setSelectedBlockId(null);
    },
    [setActiveCardIndex]
  );

  const handleSelectBlock = useCallback(
    (cardId: string, blockId: string) => {
      setSelectedBlockId(blockId);
      const idx = deck?.cards.findIndex((c) => c.card_id === cardId) ?? -1;
      if (idx >= 0 && idx !== activeCardIndex) setActiveCardIndex(idx);
    },
    [deck, activeCardIndex, setActiveCardIndex]
  );

  // ★ Fala 2 (SPEC §3.3.1) — każda ręczna zmiana bloku ustawia `is_locked`
  // razem ze zmianą treści, w JEDNYM wywołaniu `updateCard` (jeden krok undo),
  // żeby karta była chroniona przed globalnym „przebuduj przez Teresę"
  // automatycznie, bez dodatkowego kliku użytkownika.
  const applyBlockChange = useCallback(
    (cardId: string, mutate: (blocks: CardBlock[]) => CardBlock[]) => {
      const card = deck?.cards.find((c) => c.card_id === cardId);
      if (!card) return;
      const nextBlocks = mutate(card.blocks);
      updateCard(cardId, { blocks: nextBlocks, is_locked: true });
    },
    [deck, updateCard]
  );

  const handleBlockUpdate = useCallback(
    (cardId: string, blockId: string, updates: Partial<CardBlock>) => {
      applyBlockChange(cardId, (blocks) =>
        blocks.map((b) => (b.block_id === blockId ? { ...b, ...updates } : b))
      );
    },
    [applyBlockChange]
  );

  const handleBlockDelete = useCallback(
    (cardId: string, blockId: string) => {
      applyBlockChange(cardId, (blocks) => deleteBlockFromList(blocks, blockId));
      setSelectedBlockId((current) => (current === blockId ? null : current));
    },
    [applyBlockChange]
  );

  const handleBlockDuplicate = useCallback(
    (cardId: string, blockId: string) => {
      applyBlockChange(cardId, (blocks) => duplicateBlockInList(blocks, blockId));
    },
    [applyBlockChange]
  );

  const handleBlockMove = useCallback(
    (cardId: string, blockId: string, direction: 'up' | 'down') => {
      applyBlockChange(cardId, (blocks) => moveBlockInList(blocks, blockId, direction));
    },
    [applyBlockChange]
  );

  const handleBlockRefresh = useCallback(
    (cardId: string, blockId: string) => {
      // Odświeżenie ciągnie świeże dane ze źródła — to NIE jest ręczna
      // nadpisanie treści (w odróżnieniu od edit/delete/duplicate/move), więc
      // — inaczej niż `applyBlockChange` — nie ustawia `is_locked`.
      void refreshBlock(cardId, blockId);
    },
    [refreshBlock]
  );

  // ★ Fala 2 (SPEC §3.3.2) — widoczna, ODWRACALNA kłódka: użytkownik może
  // świadomie odblokować kartę ("mimo wszystko przebuduj to") albo zablokować
  // ją ręcznie z wyprzedzeniem, bez czekania na pierwszą ręczną zmianę.
  const handleToggleCardLock = useCallback(
    (cardId: string) => {
      const card = deck?.cards.find((c) => c.card_id === cardId);
      if (!card) return;
      updateCard(cardId, { is_locked: !card.is_locked });
    },
    [deck, updateCard]
  );

  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  useEffect(() => {
    Api.get('/presentations/brand-kit')
      .then((res: any) => {
        const kit = res?.data?.data ?? res?.data ?? res;
        if (kit && typeof kit === 'object' && kit.primary_color) {
          setBrandKit({
            primaryColor: kit.primary_color,
            secondaryColor: kit.secondary_color,
            accentColor: kit.accent_color,
            logoUrl: kit.logo_url,
            fontTitle: kit.font_title,
            fontBody: kit.font_body,
          });
        }
      })
      .catch(() => {});
  }, []);

  const refetchRuntimeEvents = useCallback(async () => {
    const targetDeckId = deck?.deck_id;
    if (!targetDeckId) return;
    const result = await fetchPresentationRuntimeEvents(targetDeckId, { limit: 50 });
    setRuntimeEvents(result);
    setLastAgentActivityAt(deriveLastAgentActivity(result.events));
  }, [deck?.deck_id]);

  useEffect(() => {
    if (!deck?.deck_id) return;
    refetchRuntimeEvents();
    const intervalId = setInterval(refetchRuntimeEvents, 30_000);
    return () => {
      clearInterval(intervalId);
    };
  }, [deck?.deck_id, refetchRuntimeEvents]);

  useEffect(() => {
    const targetDeckId = deck?.deck_id;
    if (!targetDeckId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchPresentationGovernanceCard(targetDeckId);
        if (cancelled) return;
        if (res.status === 'ok' && res.card) {
          setGovernanceVerdict(res.card.overallVerdict);
        }
      } catch {
        // never block deck builder on prefetch errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deck?.deck_id]);

  useCommandPaletteShortcut(() => setCommandPaletteOpen(true));

  const handleAutosaveConflict = useCallback(
    (next: {
      serverVersion: number | null;
      pendingServer: { deckJson: any; title: string } | null;
    }) => {
      setConflict(next);
      toast.error(t('presentations.versionConflictDetected'));
    },
    [t]
  );

  const fetchLatestDeck = useCallback(
    (id: string) => Api.get(`/presentations/decks/${id}`) as Promise<any>,
    []
  );

  // ★ ONE AUTOSAVE OWNER (MAT-006B / P1). `useDeckAutosave` is the ONLY writer
  // and the only user of `serverVersionRef` — the single compare-and-swap token,
  // seeded here from the canonical load. `useVersionHistory` used to run a
  // second, independent 30 s PUT to the same endpoint with its OWN baseline and
  // its OWN token (hardcoded to 1, never seeded), which 409-ed by construction
  // on every deck with `version > 1`; that loop is deleted. What it legitimately
  // provided — the "Saving…/Saved" state, `lastSavedAt`, and re-reading the
  // durable version timeline after a write — is preserved by reporting the
  // writer's start/success/failure back into it.
  //
  // Declared BEFORE the loader effect so `markPersisted` is in scope there and
  // so the autosave effect runs first on mount, while `hasLoadedInitialRef` is
  // still false.
  const { markPersisted: markAutosaveBaseline } = useDeckAutosave({
    deckId,
    deck,
    hasLoadedInitialRef,
    serverVersionRef,
    paused: Boolean(conflict),
    onConflict: handleAutosaveConflict,
    fetchLatestDeck,
    onSaveStart: noteSaveStarted,
    onSaveSuccess: notePersistedSave,
    onSaveError: noteSaveFailed,
  });

  // Every place that puts SERVER truth into state (loader, restore read-back,
  // agent-edit accept, "Reload latest") must call THIS, not either hook's own
  // marker: the writer must not write that state back, and the version-history
  // UI must not report it as a save that happened.
  const markPersisted = useCallback(
    (persisted: Deck | null) => {
      markAutosaveBaseline(persisted);
      markSaved(persisted);
    },
    [markAutosaveBaseline, markSaved]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!deckId) return;
      setLoadingDeck(true);
      setLoadError(null);
      hasLoadedInitialRef.current = false;
      setDeck(null);
      setDeckQualityInfo(null);

      try {
        const res = (await Api.get(`/presentations/decks/${deckId}`)) as any;
        const payload = res?.data;
        const row =
          payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
        if (typeof row?.version === 'number' && Number.isFinite(row.version)) {
          serverVersionRef.current = row.version;
        }

        const status = (String(row?.status || 'draft').toLowerCase() as Deck['status']) || 'draft';
        const title = row?.title ? String(row.title) : undefined;

        // 1) Prefer autosaved deck_json (builder-native).
        const deckJson = safeJsonParse<any>(row?.deck_json, null);

        // A4 — surface already-persisted quality signal (Critic + M19), read
        // straight off the loaded row: `validation_warnings` (normalizeDeckRow,
        // parsed array) and deck_json.generation.qualityGates (canonical
        // DeckDocument, additive field set by generateDeck when
        // ENABLE_DECK_QUALITY_GATES !== 'false'). No new computation — pure read.
        const persistedWarnings = Array.isArray(row?.validation_warnings)
          ? row.validation_warnings.filter((w: unknown) => typeof w === 'string')
          : [];
        const persistedCritic = deckJson?.generation?.qualityGates?.critic;
        if (!cancelled && (persistedWarnings.length > 0 || persistedCritic)) {
          setDeckQualityInfo({
            warnings: persistedWarnings,
            critic:
              persistedCritic &&
              typeof persistedCritic.overallScore === 'number' &&
              Array.isArray(persistedCritic.regenerateSlides)
                ? persistedCritic
                : undefined,
          });
        }
        if (deckJson && typeof deckJson === 'object' && Array.isArray(deckJson.cards)) {
          const loaded: Deck = {
            ...deckJson,
            deck_id: deckId,
            title: title || deckJson.title || 'Untitled',
            status,
            source_refs: Array.isArray(deckJson.source_refs)
              ? deckJson.source_refs
              : Array.isArray(row?.source_refs)
                ? row.source_refs
                : [],
            updated_at: row?.updated_at || deckJson.updated_at || new Date().toISOString(),
          };
          if (!cancelled) {
            setDeck(loaded);
            setLoadingDeck(false);
            setLoadError(null);
            hasLoadedInitialRef.current = true;
          }
          return;
        }

        // 2) Fallback: convert unified_json (generator output) to builder deck.
        const unified = row?.unified_json;
        const converted = deckFromUnifiedJson({
          deckId,
          title,
          unifiedJson: unified,
          sourceRefs: Array.isArray(row?.source_refs) ? row.source_refs : [],
          orgId: row?.organization_id,
          createdBy: row?.generated_by || row?.created_by,
          createdAt: row?.created_at,
          updatedAt: row?.updated_at,
          status,
        });
        if (converted) {
          if (!cancelled) {
            setDeck(converted);
            setLoadingDeck(false);
            setLoadError(null);
            hasLoadedInitialRef.current = true;
          }
          return;
        }

        // 3) No valid deck data found — show empty deck shell.
        const nowIso = new Date().toISOString();
        const emptyDeck: Deck = {
          deck_id: deckId,
          organization_id: String(row?.organization_id || ''),
          title: title || 'Untitled',
          theme_id: 'default',
          presentation_mode: 'show',
          communication_register: 'professional',
          image_style_preset: 'minimal_no_images',
          color_set_id: 'midnight_navy',
          status,
          card_size: '16:9',
          cards: [],
          source_refs: Array.isArray(row?.source_refs) ? row.source_refs : [],
          generation_settings: {
            text_mode: 'preserve',
            content_depth: 'concise',
            audience: 'internal',
            tone: 'professional',
            language: 'en',
            image_source: 'none',
          },
          animations_enabled: true,
          share_settings: { is_shared: false, permissions: 'view' },
          speaker_notes_generated: false,
          created_by: String(row?.generated_by || row?.created_by || ''),
          created_at: String(row?.created_at || nowIso),
          updated_at: String(row?.updated_at || nowIso),
        };
        if (!cancelled) {
          setDeck(emptyDeck);
          setLoadingDeck(false);
          setLoadError(null);
          hasLoadedInitialRef.current = true;
          toast.error(
            t('presentations.builder.noContent', 'Deck has no content yet. Generate slides first.')
          );
        }
      } catch (e: any) {
        if (!cancelled) {
          const message = e?.message
            ? String(e.message)
            : t('presentations.builder.loadFailed', 'Failed to load presentation deck');
          toast.error(message);
          setDeck(null);
          setLoadingDeck(false);
          setLoadError(message);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [deckId, setDeck, deckReloadKey]);

  const deckForAutosave = useMemo(() => {
    if (!deckId || !deck) return null;
    return { deckId, deck };
  }, [deckId, deck]);

  useEffect(() => {
    if (!deckForAutosave) return;
    if (!hasLoadedInitialRef.current) return;
    // A canonical load/reload is already persisted. Only schedule a write for
    // a real local delta; this also prevents false version bumps on open.
    if (!hasUnsavedChanges) return;
    // P3.1 — pause autosave while an unresolved version conflict is on screen.
    // Autosaving again would just re-trigger the same 409 loop; the user must
    // pick "Reload latest" or "Keep my version" first.
    if (conflict) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/presentations/decks/${deckForAutosave.deckId}/autosave`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'X-Deck-Version': String(serverVersionRef.current),
          },
          body: JSON.stringify(deckForAutosave.deck),
        });
        if (res.status === 409) {
          // P3.1 — another session advanced the deck's version. DO NOT silently
          // clobber the local (unsaved) edits with the server copy. Fetch the
          // latest so we can offer an instant reload, then raise a visible
          // conflict banner and stop autosaving until the user resolves it.
          const conflictPayload = await res.json().catch(() => ({}));
          let serverVersion: number | null =
            typeof conflictPayload?.serverVersion === 'number'
              ? conflictPayload.serverVersion
              : null;
          let pendingServer: { deckJson: any; title: string } | null = null;
          try {
            const latest = (await Api.get(`/presentations/decks/${deckForAutosave.deckId}`)) as any;
            const latestPayload =
              latest?.data && typeof latest.data === 'object' && 'data' in latest.data
                ? latest.data.data
                : latest?.data;
            if (typeof latestPayload?.version === 'number') {
              serverVersion = latestPayload.version;
            }
            const latestDeckJson = safeJsonParse<any>(latestPayload?.deck_json, null);
            if (latestDeckJson && Array.isArray(latestDeckJson.cards)) {
              pendingServer = {
                deckJson: latestDeckJson,
                title: String(latestPayload?.title || latestDeckJson.title || 'Untitled'),
              };
            }
          } catch {
            /* keep whatever the 409 body told us */
          }
          setConflict({ serverVersion, pendingServer });
          toast.error(t('presentations.versionConflictDetected'));
          return;
        }
        if (!res.ok) {
          throw new Error(`Deck autosave failed (${res.status})`);
        }
        const payload = await res.json().catch(() => ({}));
        if (typeof payload?.version === 'number') {
          serverVersionRef.current = payload.version;
        }
        markSaved(deckForAutosave.deck);
      } catch {
        // Keep the dirty state visible and make failure explicit; never present
        // an unsuccessful write as "Saved".
        toast.error(
          t('presentations.builder.autosaveFailed', 'Could not save changes. Please try again.')
        );
      }
    }, 800);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [deckForAutosave, conflict, hasUnsavedChanges, markSaved, t]);

  // P3.1 — conflict resolution handlers. "Reload latest" adopts the server's
  // deck (discarding local edits); "Keep my version" bumps our version pointer
  // to the server's and clears the banner so the next autosave force-wins
  // (last-write-wins, but now an explicit, visible choice — no silent loss).
  const resolveConflictReload = useCallback(() => {
    setConflict((current) => {
      if (current?.serverVersion != null) {
        serverVersionRef.current = current.serverVersion;
      }
      if (current?.pendingServer && Array.isArray(current.pendingServer.deckJson?.cards)) {
        setDeck((prev) => ({
          ...(prev || {}),
          ...current.pendingServer!.deckJson,
          deck_id: deckId,
          title: String(current.pendingServer!.title || prev?.title || 'Untitled'),
        }));
      }
      return null;
    });
    toast.success(t('presentations.versionConflictReloaded'));
  }, [deckId, setDeck, t]);

  const resolveConflictKeepMine = useCallback(() => {
    setConflict((current) => {
      if (current?.serverVersion != null) {
        // Adopt the server's version number so our next autosave's
        // compare-and-swap matches and overwrites (last-write-wins).
        serverVersionRef.current = current.serverVersion;
      }
      return null;
    });
    toast(t('presentations.versionConflictKeptMine'));
  }, [t]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    const targetDeckId = String(deckId || deck?.deck_id || '').trim();
    if (!targetDeckId) return;
    setDeckBacklinksLoading(true);

    const linkGraphP = Api.getLinkGraphBacklinks({
      type: 'presentation',
      id: targetDeckId,
      limit: 50,
    })
      .then((rows: any) =>
        (Array.isArray(rows) ? rows : [])
          .map((x: any) => ({
            id: String(x?.id || ''),
            sourceType: String(x?.sourceType || ''),
            sourceId: String(x?.sourceId || ''),
          }))
          .filter((x: any) => x.sourceType && x.sourceId)
      )
      .catch(() => [] as Array<{ id: string; sourceType: string; sourceId: string }>);

    const reportBacklinksP = Api.get(`/report-builder/backlinks/presentation/${targetDeckId}`)
      .then((res: any) => {
        const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        return items.map((r: any) => ({
          id: String(r?.id || r?.reportId || ''),
          sourceType: 'report',
          sourceId: String(r?.reportId || r?.id || ''),
        }));
      })
      .catch(() => [] as Array<{ id: string; sourceType: string; sourceId: string }>);

    Promise.all([linkGraphP, reportBacklinksP])
      .then(([linkRows, reportRows]) => {
        const seen = new Set<string>();
        const merged = [...linkRows, ...reportRows].filter((x) => {
          const key = `${x.sourceType}:${x.sourceId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setDeckBacklinks(merged);
      })
      .finally(() => setDeckBacklinksLoading(false));
  }, [deck?.deck_id, deckId]);

  const handleTitleChange = useCallback(
    (title: string) => {
      setDeck((prev) => (prev ? { ...prev, title } : prev));
    },
    [setDeck]
  );

  const handleAddBlankCard = useCallback(
    (atIndex?: number) => {
      const idx = atIndex ?? (deck?.cards.length || 0);
      const newCard: DeckCard = {
        card_id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        deck_id: deck?.deck_id || '',
        order_index: idx,
        intent: 'key_messages',
        layout_id: 'content_full',
        title: 'New Slide',
        blocks: [],
        source_refs: [],
        has_refreshable_data: false,
        background: { type: 'theme' },
        animations: { entrance: 'fade', block_stagger: false },
        is_locked: false,
      };
      addCard(idx, newCard);
    },
    [deck, addCard]
  );

  const handleInsertBlock = useCallback(
    (blockType: string, content?: Record<string, unknown>) => {
      if (!activeCard) return;
      const newBlock: CardBlock = {
        block_id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        card_id: activeCard.card_id,
        type: blockType as CardBlock['type'],
        content: content || getDefaultContent(blockType),
        is_refreshable: false,
        position: { area: 'full', order: activeCard.blocks.length },
        ai_editable: true,
      };
      updateCard(activeCard.card_id, {
        blocks: [...activeCard.blocks, newBlock],
      });
    },
    [activeCard, updateCard]
  );

  const handleInsertMediaImage = useCallback(
    (item: { storage_url: string; original_name: string }) => {
      handleInsertBlock('image', {
        url: item.storage_url,
        alt: item.original_name,
        fit: 'cover',
      });
      setMediaLibraryOpen(false);
    },
    [handleInsertBlock]
  );

  const handleExport = useCallback(
    async (format: 'pdf' | 'pptx' | 'png') => {
      if (!deck) return;
      try {
        await exportPresentationDeck({ deckId: deck.deck_id, title: deck.title, format });
        toast.success(t('presentations.exportedAs', { format: format.toUpperCase() }));
      } catch (err: any) {
        if (err instanceof PresentationExportError && err.code === 'QUALITY_GATE_BLOCKED') {
          setQualityGatesOpen(true);
          const firstBlocker = (
            Array.isArray(err.gates)
              ? err.gates.find(
                  (gate: unknown): gate is { cardIndex: number } =>
                    typeof (gate as { cardIndex?: unknown } | null)?.cardIndex === 'number'
                )
              : null
          ) as { cardIndex?: number } | null;
          if (firstBlocker && typeof firstBlocker.cardIndex === 'number') {
            setActiveCardIndex(firstBlocker.cardIndex);
          }
        }
        const message = err?.message || t('presentations.exportFailed');
        toast.error(message);
      }
    },
    [deck]
  );

  const handleRestoreVersion = useCallback(
    async (versionId: string) => {
      try {
        const restored = await restoreVersion(versionId);
        if (restored) {
          // MAT-006B — a SERVER restore has already been persisted, and the deck
          // below is its canonical read-back (the CAS token was synchronized to
          // it inside the hook). Baseline it, or the debounced autosave writes
          // the server's own content straight back 800 ms later: another version
          // bump that desynchronizes the token the restore just fixed, another
          // `presentation_deck_versions` snapshot recording no change, and an
          // `updated_at` reorder of the Materials list.
          // An in-session checkpoint (`source: 'session'`) is NOT on the server,
          // so it deliberately keeps the write.
          if (restored.source === 'server') markPersisted(restored.deck);
          setDeck(restored.deck);
          toast.success(t('presentations.versionRestored'));
        } else {
          toast.error(t('presentations.couldNotRestoreThatVersion'));
        }
      } catch {
        toast.error(t('presentations.couldNotRestoreThatVersion'));
      }
    },
    [restoreVersion, setDeck, markPersisted, t]
  );

  const handleAcceptAgentEdit = useCallback(async () => {
    if (pendingAgentEdit?.deck) {
      if (pendingAgentEdit.operationId && deck?.deck_id) {
        const res = (await Api.post(
          `/presentations/decks/${deck.deck_id}/agent-edit/${pendingAgentEdit.operationId}/accept`,
          {}
        )) as any;
        const payload =
          res?.data && typeof res.data === 'object' && 'data' in res.data
            ? res.data.data
            : res?.data;
        // MAT-006B — `POST /agent-edit/:id/accept` UPDATEs `deck_json`, bumps
        // `version` and writes the history snapshot server-side, then answers
        // with the persisted deck and its new version. Two consequences:
        //   1. the CAS token must follow the server, otherwise the next autosave
        //      still carries the pre-accept version and 409s into the conflict
        //      banner for a user who did nothing wrong;
        //   2. the returned deck is server truth, so baselining it stops the
        //      debounced autosave from re-writing what accept just wrote.
        if (typeof payload?.version === 'number' && Number.isFinite(payload.version)) {
          serverVersionRef.current = payload.version;
        }
        if (payload?.deck) {
          markPersisted(payload.deck);
          setDeck(payload.deck);
        } else {
          // Unexpected response shape — the server persisted something we did
          // not get back. Keep the local proposal AND the write that reconciles
          // it; that is the safe direction (content preserved, not dropped).
          setDeck(pendingAgentEdit.deck);
        }
      } else {
        // No operationId: nothing was persisted server-side, so this really is
        // an unsaved change — autosave must write it.
        setDeck(pendingAgentEdit.deck);
      }
      toast.success(t('presentations.changesAppliedAndSaved'));
    }
    setPendingAgentEdit(null);
  }, [pendingAgentEdit, setDeck, deck?.deck_id, markPersisted, t]);

  const handleRejectAgentEdit = useCallback(async () => {
    if (pendingAgentEdit?.operationId && deck?.deck_id) {
      await Api.post(
        `/presentations/decks/${deck.deck_id}/agent-edit/${pendingAgentEdit.operationId}/reject`,
        {}
      ).catch(() => null);
    }
    toast(t('presentations.changesRejected'));
    setPendingAgentEdit(null);
  }, [pendingAgentEdit?.operationId, deck?.deck_id]);

  const handleAiPrompt = useCallback(
    async (prompt: string) => {
      if (!deck) return { reply: 'No deck loaded.' };
      const res = (await Api.post(`/presentations/decks/${deck.deck_id}/agent-edit`, {
        prompt,
      })) as any;
      const payload =
        res?.data && typeof res.data === 'object' && 'data' in res.data ? res.data.data : res?.data;
      const nextDeck = payload?.deck;
      const reply = payload?.reply || t('presentations.iAppliedTheRequestedChangesTo');
      const actions = Array.isArray(payload?.appliedActions) ? payload.appliedActions : [];
      if (nextDeck) {
        setPendingAgentEdit({
          deck: nextDeck,
          reply,
          actions,
          operationId: payload?.operationId,
          diff: payload?.diff,
        });
      }
      return payload && typeof payload === 'object' ? { ...payload, reply } : { reply };
    },
    [deck]
  );

  const deckWorkspaceContext = useMemo<WorkspaceContext | null>(() => {
    if (!deck) return null;
    return {
      view: AppView.PREZENTACJE_GEN,
      type: 'presentation',
      entityId: deck.deck_id,
      entityName: deck.title || t('presentations.presentationDeck'),
      entityData: {
        moduleKey: 'deckBuilder',
        artifactKind: 'deck',
        artifactId: deck.deck_id,
        activeCardId: activeCard?.card_id || null,
        activeCardTitle: activeCard?.title || null,
        slideCount: deck.cards.length,
      },
      timestamp: new Date(),
    };
  }, [activeCard?.card_id, activeCard?.title, deck]);

  const handleTeresaDeckIntent = useCallback(
    async (prompt: string) => {
      if (!deck) return false;
      const response = await handleAiPrompt(prompt);
      const reply =
        response && typeof response === 'object' && 'reply' in response
          ? String((response as { reply?: unknown }).reply || '')
          : '';
      const fallbackReply = t('presentations.teresaPreparedADeckChangeProposal');
      toast.success(reply || fallbackReply);
      return { handled: true, reply: reply || fallbackReply };
    },
    [deck, handleAiPrompt]
  );

  // R4 — Free-text per-slide rewrite. Uses the returned rebuilt `card` to
  // update the card in place (OPTION B) so Undo/Redo keeps working — NOT
  // setDeckReloadKey which wipes the undo stack.
  const handleRewriteCard = useCallback(
    async (cardIndex: number, instruction?: string) => {
      if (!deckId) return;
      const card = deck?.cards[cardIndex];
      if (!card) return;
      try {
        // studioPostTyped unwraps the envelope, so `res` is `{ slide, card }`.
        const res = await PresentationStudioApi.regenerateSlide(deckId, cardIndex, instruction);
        const rebuilt = res?.card;
        if (rebuilt && typeof rebuilt === 'object') {
          // Preserve the stable client card_id; merge server-rebuilt content.
          const { card_id: _ignored, ...rest } = rebuilt as Record<string, unknown>;
          // ★ Fala 2 (SPEC §3.3.1) — a TARGETED local instruction ("Przerób ten
          // slajd…") is "lokalne AI" tknięcie tej karty: lock it so a later
          // global Teresa rebuild does not silently overwrite this deliberate
          // choice. A blank "Regenerate" (no instruction) is a generic re-roll,
          // not a considered edit worth protecting — it does NOT lock.
          const shouldLock = Boolean(instruction && instruction.trim().length > 0);
          updateCard(card.card_id, {
            ...(rest as Partial<typeof card>),
            ...(shouldLock ? { is_locked: true } : {}),
          });
        } else {
          // Fallback: server returned no card (AI off / no context pack) —
          // reload deck so the persisted state is reflected.
          setDeckReloadKey((k) => k + 1);
        }
        toast.success(t('presentations.slideRegenerated'), { duration: 2000 });
      } catch (err) {
        toast.error(t('presentations.failedToRegenerateSlide'));
      }
    },
    [deckId, deck, updateCard, t]
  );

  // P2.2 — BlockToolbar "AI Generate" button (Images panel). No dedicated
  // single-block image-generation endpoint exists, so this reuses the R4
  // per-slide rewrite mechanism (handleRewriteCard → regenerateSlide) with
  // an image-focused instruction, targeting the currently active card.
  const handleGenerateAiImage = useCallback(async () => {
    if (activeCardIndex == null || activeCardIndex < 0) return;
    setGeneratingAiImage(true);
    try {
      await handleRewriteCard(
        activeCardIndex,
        t(
          'presentations.builder.toolbar.aiGenerateInstruction',
          'Add a relevant AI-generated image to this slide.'
        )
      );
    } finally {
      setGeneratingAiImage(false);
    }
  }, [activeCardIndex, handleRewriteCard, t]);

  // ── VF1-7 a11y: Esc = zamknij najwyższą nakładkę / wróć (kanon §12.2/§17,
  // "Esc → zamknij drawer/modal; pełna strona → route poprzedni") ──────────
  // Skips when typing in a field. Modals that already own Escape
  // (PresentMode, DeckGovernanceCardModal, DeckAuditLogModal, CommandPalette)
  // are left alone here to avoid double-firing; overlays that do NOT yet
  // self-close on Escape are closed here instead of falling through to
  // "back", so Esc never skips a level. No visual change (keyboard-only).
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
      // Fala 1 (manual mode) — Escape deselects the active block first (most
      // local interaction), before falling through to modals/back-navigation.
      if (selectedBlockId) {
        setSelectedBlockId(null);
        return;
      }
      if (presentMode !== 'off' || commandPaletteOpen || governanceModalOpen || auditLogOpen) {
        return;
      }
      if (themeSwitcherOpen) {
        setThemeSwitcherOpen(false);
        return;
      }
      if (versionHistoryOpen) {
        setVersionHistoryOpen(false);
        return;
      }
      if (qualityGatesOpen) {
        setQualityGatesOpen(false);
        return;
      }
      if (analyticsOpen) {
        setAnalyticsOpen(false);
        return;
      }
      if (shareModalOpen) {
        setShareModalOpen(false);
        return;
      }
      if (mediaLibraryOpen) {
        setMediaLibraryOpen(false);
        return;
      }
      if (teresaOpen) {
        setTeresaOpen(false);
        return;
      }
      handleBackToPresentations();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    presentMode,
    commandPaletteOpen,
    governanceModalOpen,
    auditLogOpen,
    themeSwitcherOpen,
    versionHistoryOpen,
    qualityGatesOpen,
    analyticsOpen,
    shareModalOpen,
    mediaLibraryOpen,
    teresaOpen,
    selectedBlockId,
    handleBackToPresentations,
  ]);

  if (loadingDeck || !deck) {
    if (!loadingDeck && loadError) {
      // VF1-7 (SPEC-A): shared/states ErrorState with a real exit (onBack),
      // gated — visual change needs Piotr's screenshot sign-off (reguła #7).
      if (VF1_DECK_SPECA) {
        return (
          <div className="h-screen flex items-center justify-center bg-c-surface px-6">
            <SpecAErrorState
              title={t('presentations.builder.loadFailed', 'Failed to load deck')}
              description={loadError}
              onRetry={() => window.location.reload()}
              onBack={handleBackToPresentations}
              backLabel={t('presentations.builder.back', 'Back to presentations')}
            />
          </div>
        );
      }
      return (
        <div className="h-screen flex items-center justify-center bg-c-surface px-6">
          <ErrorState
            title={t('presentations.builder.loadFailed', 'Failed to load deck')}
            message={loadError}
            retry={() => window.location.reload()}
          />
        </div>
      );
    }

    // VF1-7 (SPEC-A): ad-hoc spinner → SkeletonState variant="deck" (shared/states,
    // the exact archetype-E shape) — gated, same reguła #7 as the error branch above.
    if (VF1_DECK_SPECA) {
      return (
        <div className="h-screen flex items-center justify-center bg-c-surface px-6 py-10">
          <div className="w-full max-w-3xl">
            <SkeletonState
              variant="deck"
              label={t('presentations.builder.loading', 'Loading deck...')}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="h-screen flex items-center justify-center bg-c-surface">
        <LoadingState
          variant="spinner"
          label={t('presentations.builder.loading', 'Loading deck...')}
        />
      </div>
    );
  }

  if (presentMode !== 'off') {
    return (
      <PresentMode
        cards={deck.cards}
        colorSetId={deck.color_set_id}
        title={deck.title}
        onExit={() => setPresentMode('off')}
        presenterView={presentMode === 'presenter'}
      />
    );
  }

  // WS-A4: unified ExecutiveModuleShell rendering — now the DEFAULT surface
  // (flag default ON, Module 12 audit gap #4). The shell adapter is
  // presentational only — all deck state/handlers below are reused verbatim,
  // so the legacy 3-panel path remains available via an explicit `?ff_melsDeckBuilder=0`
  // / localStorage override.
  if (isMelsDeckBuilderEnabled()) {
    const deckConfidentiality = ((deck as any)?.confidentiality ||
      (deck as any)?.meta?.confidentiality ||
      'internal') as 'public' | 'internal' | 'confidential';
    return (
      <DeckThemeProvider
        initialColorSetId={deck.color_set_id || 'midnight_navy'}
        initialBrandKit={brandKit}
      >
        <DeckBuilderMelsView
          title={deck.title}
          onTitleChange={handleTitleChange}
          onBack={handleBackToPresentations}
          moduleLabel={t('presentations.builder.moduleLabel', 'Prezentacje')}
          backLabel={t('presentations.builder.back', 'Back to presentations')}
          topBarHandlers={{
            onTheme: () => setThemeSwitcherOpen(true),
            onHistory: () => setVersionHistoryOpen((v) => !v),
            onQa: () => setQualityGatesOpen((v) => !v),
            onGovernance: () => setGovernanceModalOpen(true),
            onAnalytics: () => setAnalyticsOpen((v) => !v),
            onAudit: () => setAuditLogOpen(true),
            onToggleComments: () =>
              setActiveRailTool((prev) => (prev === 'comments' ? null : 'comments')),
            onShare: () => setShareModalOpen(true),
            onToggleAgent: () => setTeresaOpen((v) => !v),
            onRun: () => setPresentMode('fullscreen'),
            // J12-S2 — presenter view (notes + next-slide + timer). The primary
            // "Present" chip runs the audience fullscreen ('show'); presenter is
            // a distinct mode, surfaced as an overflow (⋯) chip. ESC exits both.
            onPresenter: () => setPresentMode('presenter'),
          }}
          topBarState={
            {
              confidentiality: deckConfidentiality,
              governanceVerdict: governanceVerdict ?? null,
              agentOpen: teresaOpen,
              runEnabled: deck.cards.length > 0,
              commentsOpen: activeRailTool === 'comments',
              openCommentCount,
            } satisfies DeckBuilderTopBarChipsState
          }
          presenceSlot={
            <div className="flex items-center gap-2">
              {hasUnsavedChanges ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {t('presentations.builder.saving', 'Saving…')}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <Check size={11} />
                  {t('presentations.builder.saved', 'Saved')}
                </span>
              )}
              <EntityStatusChip status={deck.status || 'draft'} />
            </div>
          }
          activeRightRailToolId={activeRailTool}
          onActiveRightRailToolChange={setActiveRailTool}
          rightRailState={{
            agentActivityCount: runtimeEvents.events.length,
            activityTone: runtimeEvents.degraded
              ? 'warning'
              : runtimeEvents.events.length > 0
                ? 'info'
                : null,
            openCommentCount,
          }}
          rightRailPanels={{
            blocks: (
              <BlockToolbar
                onInsertBlock={handleInsertBlock}
                onOpenMediaLibrary={() => setMediaLibraryOpen(true)}
                onGenerateAiImage={handleGenerateAiImage}
                isGeneratingAiImage={generatingAiImage}
                onUpload={() => setMediaLibraryOpen(true)}
              />
            ),
            comments: (
              <DeckCommentsPanel
                deckId={deckId || deck?.deck_id || ''}
                slides={deck.cards.map(
                  (c, idx): DeckSlideRef => ({ id: c.card_id, title: c.title || '', index: idx })
                )}
                activeSlideId={activeCard?.card_id ?? null}
                onJumpToSlide={(slideId) => {
                  const idx = deck.cards.findIndex((c) => c.card_id === slideId);
                  if (idx >= 0) setActiveCardIndex(idx);
                }}
                onCountsChanged={(counts) => setOpenCommentCount(counts.totalOpen)}
              />
            ),
            activity: (
              <AgentActivityPanel
                events={runtimeEvents.events}
                degraded={runtimeEvents.degraded}
                reason={runtimeEvents.reason}
              />
            ),
            relations: <DeckRelationsPanel cards={deck.cards} />,
            // HP-17: „Źródła i założenia" (EvidencePanelSection artifactType='deck',
            // artifactId=deck_id) TYLKO za flagą ff_evidencePanel (default OFF,
            // src/utils/evidencePanelFlag.ts). OFF → undefined → narzędzie nie
            // pojawia się na pasku (DeckBuilderMelsView.includeEvidence=false) →
            // pasek 1:1 jak przed HP-17. Silnik: presentationGeneratorService
            // .buildDeckEvidenceContract (HP-16).
            evidence:
              isEvidencePanelEnabled() && (deckId || deck?.deck_id) ? (
                <EvidencePanelSection
                  artifactType="deck"
                  artifactId={deckId || deck?.deck_id}
                  isPolish={i18n.language?.startsWith('pl')}
                />
              ) : undefined,
          }}
          leftRailTitle={t('presentations.builder.slides', 'Slides')}
          leftRail={
            <SlideSorter
              cards={deck.cards}
              activeIndex={activeCardIndex}
              colorSetId={deck.color_set_id}
              onSelect={handleSelectCard}
              onReorder={reorderCards}
              onDuplicate={duplicateCard}
              onDelete={deleteCard}
              onAddCard={handleAddBlankCard}
              isCardOutdated={isCardOutdated}
              onToggleLock={handleToggleCardLock}
            />
          }
          canvas={
            <CardCanvas
              cards={deck.cards}
              activeCardIndex={activeCardIndex}
              colorSetId={deck.color_set_id}
              onSelectCard={handleSelectCard}
              onBlockClick={handleSelectBlock}
              onAddCard={handleAddBlankCard}
              onRewriteCard={handleRewriteCard}
              speakerNotes={activeCard?.speaker_notes}
              showNotes={showNotes}
              animationsEnabled={animationsEnabled}
              selectedBlockId={selectedBlockId}
              onBlockUpdate={handleBlockUpdate}
              onBlockDelete={handleBlockDelete}
              onBlockDuplicate={handleBlockDuplicate}
              onBlockMove={handleBlockMove}
              onBlockRefresh={handleBlockRefresh}
            />
          }
          aiEntrySlot={
            teresaOpen ? (
              <div className="w-[360px] min-w-[320px] max-w-[420px] h-full">
                <UnifiedChatPanel
                  mode="split"
                  title={t('presentations.builder.teresa.title', 'Teresa')}
                  workspaceContext={deckWorkspaceContext}
                  onModuleIntent={handleTeresaDeckIntent}
                  showModeToggle={false}
                  showHistoryTrigger
                  showFocusMode
                  maxHeight="100%"
                />
              </div>
            ) : null
          }
          bannerSlot={
            pendingAgentEdit ? (
              <div className="flex items-center gap-3 border-b border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-2.5">
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200 flex-1">
                  {pendingAgentEdit.reply}
                  {pendingAgentEdit.actions.length > 0 && (
                    <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                      ({pendingAgentEdit.actions.join(', ')})
                    </span>
                  )}
                  {pendingAgentEdit.diff && (
                    <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                      {t('presentations.deckDiff', {
                        added: pendingAgentEdit.diff.cardsAdded || 0,
                        removed: pendingAgentEdit.diff.cardsRemoved || 0,
                        changed: pendingAgentEdit.diff.changedCards || 0,
                      })}
                    </span>
                  )}
                  {/* ★ Fala 2 (SPEC §3.3.4) — pominięte slajdy WYMIENIONE po
                      numerze, nie tylko zliczone, żeby użytkownik wiedział
                      DOKŁADNIE które ręczne poprawki przetrwały. */}
                  {pendingAgentEdit.diff?.skippedLockedSlides &&
                    pendingAgentEdit.diff.skippedLockedSlides.length > 0 && (
                      <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                        {t('presentations.deckDiffSkippedLocked', {
                          count: pendingAgentEdit.diff.skippedLockedSlides.length,
                          numbers: pendingAgentEdit.diff.skippedLockedSlides.join(', '),
                        })}
                      </span>
                    )}
                </span>
                <button
                  type="button"
                  onClick={handleAcceptAgentEdit}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-c-text hover:bg-green-700 transition-colors"
                >
                  {t('presentations.accept')}
                </button>
                <button
                  type="button"
                  onClick={handleRejectAgentEdit}
                  className="rounded-lg bg-c-border-subtle px-3 py-1.5 text-xs font-medium text-c-text hover:bg-c-border transition-colors"
                >
                  {t('presentations.reject')}
                </button>
              </div>
            ) : deckQualityInfo && deckQualityInfo.warnings.length > 0 ? (
              <div className="border-b border-c-warning/20 bg-c-warning/5">
                <button
                  type="button"
                  aria-expanded={qualityBannerExpanded}
                  onClick={() => setQualityBannerExpanded((v) => !v)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-c-warning/10"
                >
                  {qualityBannerExpanded ? (
                    <ChevronDown size={14} className="text-c-warning flex-shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-c-warning flex-shrink-0" />
                  )}
                  <AlertTriangle size={14} className="text-c-warning flex-shrink-0" />
                  <span className="text-xs font-medium text-c-warning">
                    {t('presentations.qualitySignal.badge', 'Jakość: {{count}} ostrzeżeń', {
                      count: deckQualityInfo.warnings.length,
                    })}
                  </span>
                  {deckQualityInfo.critic && (
                    <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium bg-c-warning/10 text-c-warning">
                      {t('presentations.qualitySignal.score', 'Score {{score}}/100', {
                        score: deckQualityInfo.critic.overallScore,
                      })}
                    </span>
                  )}
                </button>
                {qualityBannerExpanded && (
                  <ul className="px-4 pb-2.5 space-y-1">
                    {deckQualityInfo.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-c-warning/90">
                        &bull; {w}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null
          }
          bottomBarSlot={
            <DeckBuilderBottomBar
              currentIndex={activeCardIndex}
              totalCards={deck.cards.length}
              cardTitle={activeCard?.title || ''}
              onQuickEdits={() => setTeresaOpen(true)}
              onToggleNotes={() => setShowNotes((v) => !v)}
              notesOpen={showNotes}
            />
          }
          overlays={
            <>
              <ThemeSwitcher
                isOpen={themeSwitcherOpen}
                onClose={() => setThemeSwitcherOpen(false)}
              />
              <VersionHistoryPanel
                isOpen={versionHistoryOpen}
                onClose={() => setVersionHistoryOpen(false)}
                versions={versions}
                historyStatus={historyStatus}
                onRetryHistory={refreshVersions}
                onRestore={handleRestoreVersion}
                onSaveCheckpoint={saveManualCheckpoint}
                hasUnsavedChanges={hasUnsavedChanges}
                lastSavedAt={lastSavedAt}
              />
              <MediaLibraryBrowser
                isOpen={mediaLibraryOpen}
                onClose={() => setMediaLibraryOpen(false)}
                onSelect={handleInsertMediaImage}
              />
              <DeckQualityGatesPanel
                deckId={deckId || deck?.deck_id || ''}
                isOpen={qualityGatesOpen}
                onClose={() => setQualityGatesOpen(false)}
                onJumpToCard={setActiveCardIndex}
              />
              <ShareAnalyticsPanel
                deckId={deckId || deck?.deck_id || ''}
                isOpen={analyticsOpen}
                onClose={() => setAnalyticsOpen(false)}
                totalCards={deck?.cards.length || 0}
              />
              {auditLogOpen && (
                <DeckAuditLogModal
                  deckId={deckId || deck?.deck_id || ''}
                  onClose={() => setAuditLogOpen(false)}
                />
              )}
              {governanceModalOpen && (
                <DeckGovernanceCardModal
                  deckId={deckId || deck?.deck_id || ''}
                  onClose={() => setGovernanceModalOpen(false)}
                  onCardLoaded={(card) => setGovernanceVerdict(card.overallVerdict)}
                />
              )}
              <ShareModal
                isOpen={shareModalOpen}
                onClose={() => setShareModalOpen(false)}
                deckId={deck.deck_id}
                deckTitle={deck.title}
                onExport={handleExport}
              />
              <CommandPalette
                isOpen={commandPaletteOpen}
                onClose={() => setCommandPaletteOpen(false)}
                onInsertBlock={handleInsertBlock}
                onPresent={() => setPresentMode('fullscreen')}
                onPresentPresenter={() => setPresentMode('presenter')}
                onExport={handleExport}
                onToggleAgent={() => setTeresaOpen((v) => !v)}
                onOpenTheme={() => setThemeSwitcherOpen(true)}
                onAddCard={() => handleAddBlankCard()}
                onShare={() => setShareModalOpen(true)}
              />
            </>
          }
          onRunPrimary={() => setPresentMode('fullscreen')}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />
      </DeckThemeProvider>
    );
  }

  return (
    <DeckThemeProvider
      initialColorSetId={deck.color_set_id || 'midnight_navy'}
      initialBrandKit={brandKit}
    >
      <div className="h-screen flex flex-col bg-c-surface overflow-hidden">
        {/* Top Bar */}
        <div className="relative">
          <DeckBuilderTopBar
            title={deck.title}
            onTitleChange={handleTitleChange}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onToggleAgent={() => setTeresaOpen((v) => !v)}
            agentOpen={teresaOpen}
            onPresent={() => setPresentMode('fullscreen')}
            onTheme={() => setThemeSwitcherOpen(true)}
            onShare={() => setShareModalOpen(true)}
            onVersionHistory={() => setVersionHistoryOpen((v) => !v)}
            onQualityGates={() => setQualityGatesOpen((v) => !v)}
            onAnalytics={() => setAnalyticsOpen((v) => !v)}
            onAuditLog={() => setAuditLogOpen(true)}
            onGovernance={() => setGovernanceModalOpen(true)}
            governanceVerdict={governanceVerdict}
            confidentiality={
              ((deck as any)?.confidentiality ||
                (deck as any)?.meta?.confidentiality ||
                'internal') as 'public' | 'internal' | 'confidential'
            }
            lastAgentActivityAt={lastAgentActivityAt}
            statusBar={
              // HP-8 workflow-engine status bar (deck) — behind
              // ff_artifactApprovalUi. At OFF this is `undefined` and the top
              // bar renders 1:1 as before (no new DOM, no visual change).
              isArtifactApprovalUiEnabled() && (deckId || deck?.deck_id) ? (
                <ArtifactApprovalStatusBar
                  artifactType="deck"
                  artifactId={(deckId || deck?.deck_id) as string}
                  currentUserId={approvalUser?.id}
                  canReview
                />
              ) : undefined
            }
          />
          <ThemeSwitcher isOpen={themeSwitcherOpen} onClose={() => setThemeSwitcherOpen(false)} />
          {collaborateEnabled && (
            <div className="absolute top-1/2 -translate-y-1/2 right-40 z-sticky pointer-events-none">
              <DeckPresenceStack
                users={collab.connectedUsers}
                localUserId={collab.localUser?.userId}
                connectionStatus={collab.connectionStatus}
              />
            </div>
          )}
        </div>

        {conflict && (
          <ConflictBanner
            serverVersion={conflict.serverVersion}
            onReload={resolveConflictReload}
            onKeepMine={resolveConflictKeepMine}
          />
        )}

        <div className="border-b border-c-border-subtle bg-c-surface-raised px-4 py-2">
          <EmbeddedView
            title={t('presentations.builder.usedIn', 'Used in (backlinks)')}
            count={deckBacklinks.length}
            loading={deckBacklinksLoading}
            readOnly
            viewModes={['list']}
          >
            {deckBacklinks.length === 0 && !deckBacklinksLoading ? (
              <div className="text-xs text-c-text-secondary">{t('presentations.noLinksYet')}</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {deckBacklinks.slice(0, 8).map((bl) => (
                  <button
                    key={bl.id}
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent('mywork-open-item', {
                          detail: {
                            type: bl.sourceType,
                            id: bl.sourceId,
                            name: `${bl.sourceType} ${bl.sourceId}`,
                          },
                        })
                      )
                    }
                    className="rounded-full border border-c-border-subtle/[0.08] bg-c-surface/[0.04] px-3 py-1 text-[11px] font-medium text-c-text hover:border-blue-400 dark:hover:border-blue-500/50"
                  >
                    {getSourceDisplayLabel(bl.sourceType)}: {bl.sourceId}
                  </button>
                ))}
              </div>
            )}
          </EmbeddedView>
        </div>

        {/* AI Agent Edit Proposal Banner (P20 Builder P0 Contract §6.3: proposals, not silent mutation) */}
        {pendingAgentEdit && (
          <div className="flex items-center gap-3 border-b border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-2.5">
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200 flex-1">
              {pendingAgentEdit.reply}
              {pendingAgentEdit.actions.length > 0 && (
                <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                  ({pendingAgentEdit.actions.join(', ')})
                </span>
              )}
              {pendingAgentEdit.diff && (
                <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                  {t('presentations.deckDiff', {
                    added: pendingAgentEdit.diff.cardsAdded || 0,
                    removed: pendingAgentEdit.diff.cardsRemoved || 0,
                    changed: pendingAgentEdit.diff.changedCards || 0,
                  })}
                </span>
              )}
              {pendingAgentEdit.diff?.skippedLockedSlides &&
                pendingAgentEdit.diff.skippedLockedSlides.length > 0 && (
                  <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                    {t('presentations.deckDiffSkippedLocked', {
                      count: pendingAgentEdit.diff.skippedLockedSlides.length,
                      numbers: pendingAgentEdit.diff.skippedLockedSlides.join(', '),
                    })}
                  </span>
                )}
            </span>
            <button
              type="button"
              onClick={handleAcceptAgentEdit}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-c-text hover:bg-green-700 transition-colors"
            >
              {t('presentations.accept')}
            </button>
            <button
              type="button"
              onClick={handleRejectAgentEdit}
              className="rounded-lg bg-c-border-subtle px-3 py-1.5 text-xs font-medium text-c-text hover:bg-c-border transition-colors"
            >
              {t('presentations.reject')}
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden relative">
          {teresaOpen && (
            <aside className="w-[360px] min-w-[320px] max-w-[420px] flex-shrink-0 border-r border-c-border-subtle bg-c-surface-raised">
              <UnifiedChatPanel
                mode="split"
                title={t('presentations.builder.teresa.title', 'Teresa')}
                workspaceContext={deckWorkspaceContext}
                onModuleIntent={handleTeresaDeckIntent}
                showModeToggle={false}
                showHistoryTrigger
                showFocusMode
                maxHeight="100%"
              />
            </aside>
          )}

          {/* Left: Slide Sorter */}
          <SlideSorter
            cards={deck.cards}
            activeIndex={activeCardIndex}
            colorSetId={deck.color_set_id}
            onSelect={handleSelectCard}
            onReorder={reorderCards}
            onDuplicate={duplicateCard}
            onDelete={deleteCard}
            onAddCard={handleAddBlankCard}
            isCardOutdated={isCardOutdated}
            onToggleLock={handleToggleCardLock}
          />

          {/* Center: Card Canvas */}
          <CardCanvas
            cards={deck.cards}
            activeCardIndex={activeCardIndex}
            colorSetId={deck.color_set_id}
            onSelectCard={handleSelectCard}
            onBlockClick={handleSelectBlock}
            onAddCard={handleAddBlankCard}
            onRewriteCard={handleRewriteCard}
            speakerNotes={activeCard?.speaker_notes}
            showNotes={showNotes}
            animationsEnabled={animationsEnabled}
            selectedBlockId={selectedBlockId}
            onBlockUpdate={handleBlockUpdate}
            onBlockDelete={handleBlockDelete}
            onBlockDuplicate={handleBlockDuplicate}
            onBlockMove={handleBlockMove}
            onBlockRefresh={handleBlockRefresh}
          />

          {/* Right: Block Toolbar */}
          <BlockToolbar
            onInsertBlock={handleInsertBlock}
            onOpenMediaLibrary={() => setMediaLibraryOpen(true)}
            onGenerateAiImage={handleGenerateAiImage}
            isGeneratingAiImage={generatingAiImage}
            onUpload={() => setMediaLibraryOpen(true)}
          />

          {/* Passive AI Activity Panel — runtime telemetry feed */}
          {teresaOpen && (
            <AgentActivityPanel
              events={runtimeEvents.events}
              degraded={runtimeEvents.degraded}
              reason={runtimeEvents.reason}
            />
          )}

          {/* Version History Panel */}
          <VersionHistoryPanel
            isOpen={versionHistoryOpen}
            onClose={() => setVersionHistoryOpen(false)}
            versions={versions}
            historyStatus={historyStatus}
            onRetryHistory={refreshVersions}
            onRestore={handleRestoreVersion}
            onSaveCheckpoint={saveManualCheckpoint}
            hasUnsavedChanges={hasUnsavedChanges}
            lastSavedAt={lastSavedAt}
          />

          {/* Media Library Browser */}
          <MediaLibraryBrowser
            isOpen={mediaLibraryOpen}
            onClose={() => setMediaLibraryOpen(false)}
            onSelect={handleInsertMediaImage}
          />

          {/* G1: Quality Gates Panel */}
          <DeckQualityGatesPanel
            deckId={deckId || deck?.deck_id || ''}
            isOpen={qualityGatesOpen}
            onClose={() => setQualityGatesOpen(false)}
            onJumpToCard={setActiveCardIndex}
          />

          {/* G3: Share Analytics Panel */}
          <ShareAnalyticsPanel
            deckId={deckId || deck?.deck_id || ''}
            isOpen={analyticsOpen}
            onClose={() => setAnalyticsOpen(false)}
            totalCards={deck?.cards.length || 0}
          />

          {/* Audit Log Modal */}
          {auditLogOpen && (
            <DeckAuditLogModal
              deckId={deckId || deck?.deck_id || ''}
              onClose={() => setAuditLogOpen(false)}
            />
          )}

          {/* Governance Card Modal */}
          {governanceModalOpen && (
            <DeckGovernanceCardModal
              deckId={deckId || deck?.deck_id || ''}
              onClose={() => setGovernanceModalOpen(false)}
              onCardLoaded={(card) => setGovernanceVerdict(card.overallVerdict)}
            />
          )}
        </div>

        {/* Bottom Bar */}
        <DeckBuilderBottomBar
          currentIndex={activeCardIndex}
          totalCards={deck.cards.length}
          cardTitle={activeCard?.title || ''}
          onQuickEdits={() => setTeresaOpen(true)}
          onToggleNotes={() => setShowNotes((v) => !v)}
          notesOpen={showNotes}
        />

        {/* Share Modal */}
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          deckId={deck.deck_id}
          deckTitle={deck.title}
          onExport={handleExport}
        />

        {/* Command Palette */}
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onInsertBlock={handleInsertBlock}
          onPresent={() => setPresentMode('fullscreen')}
          onPresentPresenter={() => setPresentMode('presenter')}
          onExport={handleExport}
          onToggleAgent={() => setTeresaOpen((v) => !v)}
          onOpenTheme={() => setThemeSwitcherOpen(true)}
          onAddCard={() => handleAddBlankCard()}
          onShare={() => setShareModalOpen(true)}
        />
      </div>
    </DeckThemeProvider>
  );
};

function getDefaultContent(blockType: string): Record<string, unknown> {
  switch (blockType) {
    case 'heading':
      return { text: 'New Heading', level: 2 };
    case 'paragraph':
      return { text: 'Enter text here...' };
    case 'bullet_list':
      return { items: ['Item 1', 'Item 2', 'Item 3'] };
    case 'numbered_list':
      return { items: ['Step 1', 'Step 2', 'Step 3'] };
    case 'table':
      return { headers: ['A', 'B', 'C'], rows: [['1', '2', '3']] };
    case 'chart':
      return {
        chartType: 'bar',
        title: 'Chart',
        data: [
          { label: 'A', value: 30 },
          { label: 'B', value: 50 },
          { label: 'C', value: 40 },
        ],
      };
    case 'kpi_widget':
      return { label: 'Metric', value: '0', trend: 'stable' };
    case 'metric_strip':
      return {
        metrics: [
          { label: 'A', value: '0' },
          { label: 'B', value: '0' },
        ],
      };
    case 'callout':
      return { variant: 'info', text: 'Important note' };
    case 'smart_layout':
      return { layoutType: '3col', items: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] };
    case 'smart_diagram':
      return {
        diagram_kind: 'process_steps',
        items: [{ label: 'Step 1' }, { label: 'Step 2' }, { label: 'Step 3' }],
      };
    case 'timeline_block':
      return {
        items: [
          { date: 'Q1', title: 'Start' },
          { date: 'Q2', title: 'Mid' },
          { date: 'Q3', title: 'End' },
        ],
      };
    case 'divider':
      return { style: 'line' };
    case 'image':
      return { url: '', alt: 'Image', fit: 'cover' };
    default:
      return {};
  }
}

export default DeckBuilder;
