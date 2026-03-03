/**
 * Deck Builder V3 — Gamma-like WYSIWYG Presentation Editor
 * Three-panel layout: Slide Sorter | Card Canvas | Block Toolbar
 * Features: AI Agent, Command Palette, Theme Switcher, Version History,
 * animations, collaboration, data refresh, source traceability, media library.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useParams } from 'react-router-dom';

import { Api } from '@/services/api';

import type { CardBlock, Deck, DeckCard } from '../wizard/types';

import { AgentPanel } from './AgentPanel';
import { BlockToolbar } from './BlockToolbar';
import { CardCanvas } from './CardCanvas';
import { CommandPalette, useCommandPaletteShortcut } from './CommandPalette';
import { DeckBuilderBottomBar } from './DeckBuilderBottomBar';
import { DeckBuilderTopBar } from './DeckBuilderTopBar';
import { DeckQualityGatesPanel } from './DeckQualityGatesPanel';
import { DeckThemeProvider } from './DeckThemeContext';
import { MediaLibraryBrowser } from './MediaLibraryBrowser';
import { MOCK_DECK } from './mockDeckData';
import { PresentMode } from './PresentMode';
import { ShareAnalyticsPanel } from './ShareAnalyticsPanel';
import { ShareModal } from './ShareModal';
import { SlideSorter } from './SlideSorter';
import { ThemeSwitcher } from './ThemeSwitcher';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { useCollaboration } from './useCollaboration';
import { useDataRefresh } from './useDataRefresh';
import { useDeckState } from './useDeckState';
import { useVersionHistory } from './useVersionHistory';

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
    section_intro: 'section_divider',
    key_messages: 'content',
    performance_overview: 'kpi_dashboard',
    single_insight: 'data',
    comparison: 'comparison',
    assessment: 'data',
    roadmap: 'timeline',
    risk_management: 'risk_overview',
    recommendation_portfolio: 'recommendation',
    recommendation_single: 'recommendation',
    initiative_portfolio: 'content',
    next_steps: 'next_steps',
    appendix: 'content',
    root_cause: 'content',
    prioritization_matrix: 'data',
  };

  const cards: DeckCard[] = parsed.slides.map((slide: any, idx: number) => {
    const cardId = `card-${params.deckId}-${idx}`;
    const intent = intentMap[String(slide.intent || '')] || 'content';
    const contentType = String(slide?.content?.type || slide?.intent || '');

    const blocks: CardBlock[] = [];
    const pushBlock = (type: CardBlock['type'], content: Record<string, unknown>, isRefreshable = false) => {
      blocks.push({
        block_id: `block-${params.deckId}-${idx}-${blocks.length}`,
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
      const findings = Array.isArray(slide?.content?.key_findings) ? slide.content.key_findings : [];
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
      if (slide?.content?.recommendation) pushBlock('callout', { text: String(slide.content.recommendation), kind: 'info' });
    } else if (contentType === 'key_messages') {
      const msgs = Array.isArray(slide?.content?.messages) ? slide.content.messages : [];
      if (msgs.length) {
        pushBlock(
          'bullet_list',
          {
            items: msgs.slice(0, 10).map((m: any) =>
              m?.description ? `${String(m.title || '')}: ${String(m.description)}` : String(m?.title || m)
            ),
          }
        );
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
      if (slide?.content?.chart_data) pushBlock('chart', { chartType: slide?.content?.chart_type || 'bar', data: slide.content.chart_data }, true);
    } else {
      // Generic fallback (still editable)
      try {
        const pretty = JSON.stringify(slide?.content ?? slide, null, 2);
        pushBlock('paragraph', { text: pretty.length > 1200 ? `${pretty.slice(0, 1200)}…` : pretty });
      } catch {
        pushBlock('paragraph', { text: String(slide?.key_message || '') });
      }
    }

    const hasRefreshable = blocks.some((b) => b.is_refreshable);

    return {
      card_id: cardId,
      deck_id: params.deckId,
      order_index: idx,
      intent,
      layout_id: intent === 'cover' ? 'cover_centered' : intent === 'kpi_dashboard' ? 'data_grid' : 'content_full',
      title: String(headingText || 'Slide'),
      blocks,
      source_refs: [],
      has_refreshable_data: hasRefreshable,
      background: { type: intent === 'cover' ? 'gradient' : 'theme', value: intent === 'cover' ? 'linear-gradient(135deg, #0B3D91, #1A8A8A)' : undefined },
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
    source_refs: [],
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
  const { deckId } = useParams<{ deckId: string }>();
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

  const [loadingDeck, setLoadingDeck] = useState(true);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedInitialRef = useRef(false);

  const [agentOpen, setAgentOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [presentMode, setPresentMode] = useState<'off' | 'fullscreen' | 'presenter'>('off');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [themeSwitcherOpen, setThemeSwitcherOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [qualityGatesOpen, setQualityGatesOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const {
    versions,
    hasUnsavedChanges,
    lastSavedAt,
    restoreVersion,
    saveManualCheckpoint,
  } = useVersionHistory(deck);

  const { isCardOutdated, refreshCard, refreshAllCards } = useDataRefresh(deck, updateCard);

  const currentUser = { userId: 'current-user', name: 'You' };
  const collab = useCollaboration(deckId, currentUser, false);

  useCommandPaletteShortcut(() => setCommandPaletteOpen(true));

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!deckId) return;
      setLoadingDeck(true);
      hasLoadedInitialRef.current = false;
      setDeck(null);

      try {
        const res = (await Api.get(`/presentations/decks/${deckId}`)) as any;
        const row = res?.data ?? res;

        const status = (String(row?.status || 'draft').toLowerCase() as Deck['status']) || 'draft';
        const title = row?.title ? String(row.title) : undefined;

        // 1) Prefer autosaved deck_json (builder-native).
        const deckJson = safeJsonParse<any>(row?.deck_json, null);
        if (deckJson && typeof deckJson === 'object' && Array.isArray(deckJson.cards)) {
          const loaded: Deck = {
            ...deckJson,
            deck_id: deckId,
            title: title || deckJson.title || 'Untitled',
            status,
            updated_at: row?.updated_at || deckJson.updated_at || new Date().toISOString(),
          };
          if (!cancelled) {
            setDeck(loaded);
            setLoadingDeck(false);
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
            hasLoadedInitialRef.current = true;
          }
          return;
        }

        // 3) Final fallback: mock deck (so UI still opens), but keep real deckId/title.
        const fallback: Deck = {
          ...MOCK_DECK,
          deck_id: deckId,
          title: title || MOCK_DECK.title || 'Untitled',
          status,
          updated_at: row?.updated_at || new Date().toISOString(),
        } as Deck;
        if (!cancelled) {
          setDeck(fallback);
          setLoadingDeck(false);
          hasLoadedInitialRef.current = true;
        }
      } catch (e: any) {
        if (!cancelled) {
          toast.error(e?.message ? String(e.message) : 'Failed to load presentation deck');
          setDeck({ ...(MOCK_DECK as any), deck_id: deckId || 'unknown' });
          setLoadingDeck(false);
          hasLoadedInitialRef.current = true;
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [deckId, setDeck]);

  const deckForAutosave = useMemo(() => {
    if (!deckId || !deck) return null;
    return { deckId, deck };
  }, [deckId, deck]);

  useEffect(() => {
    if (!deckForAutosave) return;
    if (!hasLoadedInitialRef.current) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        await Api.put(`/presentations/decks/${deckForAutosave.deckId}/autosave`, deckForAutosave.deck);
      } catch {
        // Non-blocking; builder remains usable offline-ish.
      }
    }, 800);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [deckForAutosave]);

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
    collab.updatePresence({ activeCardIndex });
  }, [activeCardIndex, collab]);

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
        intent: 'content',
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
        const response = await fetch(`/api/presentations/decks/${deck.deck_id}/export/${format}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!response.ok) throw new Error('Export failed');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${deck.title || 'presentation'}.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch {
        /* graceful fallback */
      }
    },
    [deck]
  );

  const handleRestoreVersion = useCallback(
    (versionId: string) => {
      const restored = restoreVersion(versionId);
      if (restored) setDeck(restored);
    },
    [restoreVersion, setDeck]
  );

  const handleAiPrompt = useCallback(
    (_prompt: string) => {
      setAgentOpen(true);
    },
    []
  );

  if (loadingDeck || !deck) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-navy-950">
        <div className="animate-pulse text-slate-400">Loading deck...</div>
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

  return (
    <DeckThemeProvider initialColorSetId={deck.color_set_id || 'midnight_navy'}>
      <div className="h-screen flex flex-col bg-white dark:bg-navy-950 overflow-hidden">
        {/* Top Bar */}
        <div className="relative">
          <DeckBuilderTopBar
            title={deck.title}
            onTitleChange={handleTitleChange}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onToggleAgent={() => setAgentOpen((v) => !v)}
            agentOpen={agentOpen}
            onPresent={() => setPresentMode('fullscreen')}
            onTheme={() => setThemeSwitcherOpen(true)}
            onShare={() => setShareModalOpen(true)}
            onVersionHistory={() => setVersionHistoryOpen((v) => !v)}
            onToggleAnimations={() => setAnimationsEnabled((v) => !v)}
            animationsEnabled={animationsEnabled}
            collaborators={collab.connectedUsers}
            isConnected={collab.isConnected}
            connectionStatus={collab.connectionStatus}
            onQualityGates={() => setQualityGatesOpen((v) => !v)}
            onAnalytics={() => setAnalyticsOpen((v) => !v)}
          />
          <ThemeSwitcher
            isOpen={themeSwitcherOpen}
            onClose={() => setThemeSwitcherOpen(false)}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left: Slide Sorter */}
          <SlideSorter
            cards={deck.cards}
            activeIndex={activeCardIndex}
            colorSetId={deck.color_set_id}
            onSelect={setActiveCardIndex}
            onReorder={reorderCards}
            onDuplicate={duplicateCard}
            onDelete={deleteCard}
            onAddCard={handleAddBlankCard}
            isCardOutdated={isCardOutdated}
          />

          {/* Center: Card Canvas */}
          <CardCanvas
            cards={deck.cards}
            activeCardIndex={activeCardIndex}
            colorSetId={deck.color_set_id}
            onSelectCard={setActiveCardIndex}
            onBlockClick={() => {}}
            onAddCard={handleAddBlankCard}
            speakerNotes={activeCard?.speaker_notes}
            showNotes={showNotes}
            animationsEnabled={animationsEnabled}
          />

          {/* Right: Block Toolbar */}
          <BlockToolbar
            onInsertBlock={handleInsertBlock}
            onOpenMediaLibrary={() => setMediaLibraryOpen(true)}
          />

          {/* Agent Panel (conditional) */}
          {agentOpen && (
            <AgentPanel
              onClose={() => setAgentOpen(false)}
              sourceNames={deck.source_refs.map((s) => s.artifact_name)}
            />
          )}

          {/* Version History Panel */}
          <VersionHistoryPanel
            isOpen={versionHistoryOpen}
            onClose={() => setVersionHistoryOpen(false)}
            versions={versions}
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
        </div>

        {/* Bottom Bar */}
        <DeckBuilderBottomBar
          currentIndex={activeCardIndex}
          totalCards={deck.cards.length}
          cardTitle={activeCard?.title || ''}
          onQuickEdits={() => {}}
          onToggleNotes={() => setShowNotes((v) => !v)}
          notesOpen={showNotes}
        />

        {/* Share Modal */}
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          deckTitle={deck.title}
          onExport={handleExport}
        />

        {/* Command Palette */}
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onInsertBlock={handleInsertBlock}
          onPresent={() => setPresentMode('fullscreen')}
          onExport={handleExport}
          onToggleAgent={() => setAgentOpen((v) => !v)}
          onOpenTheme={() => setThemeSwitcherOpen(true)}
          onAddCard={() => handleAddBlankCard()}
          onAiPrompt={handleAiPrompt}
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
      return { metrics: [{ label: 'A', value: '0' }, { label: 'B', value: '0' }] };
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
      return { items: [{ date: 'Q1', title: 'Start' }, { date: 'Q2', title: 'Mid' }, { date: 'Q3', title: 'End' }] };
    case 'divider':
      return { style: 'line' };
    case 'image':
      return { url: '', alt: 'Image', fit: 'cover' };
    default:
      return {};
  }
}

export default DeckBuilder;
