/**
 * Deck Builder V3 — Gamma-like WYSIWYG Presentation Editor
 * Three-panel layout: Slide Sorter | Card Canvas | Block Toolbar
 * Features: AI Agent, Command Palette, Theme Switcher, Version History,
 * animations, collaboration, data refresh, source traceability, media library.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { getSourceDisplayLabel } from '@/components/Initiatives/InitiativeSourceLink';
import { EmbeddedView } from '@/components/shared/NModeBlocks';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

import type { CardBlock, Deck, DeckCard } from '../wizard/types';
import { AgentPanel } from './AgentPanel';
import { BlockToolbar } from './BlockToolbar';
import { CardCanvas } from './CardCanvas';
import { CommandPalette, useCommandPaletteShortcut } from './CommandPalette';
import { DeckBuilderBottomBar } from './DeckBuilderBottomBar';
import { DeckBuilderTopBar } from './DeckBuilderTopBar';
import { DeckQualityGatesPanel } from './DeckQualityGatesPanel';
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

    return {
      card_id: cardId,
      deck_id: params.deckId,
      order_index: idx,
      intent,
      layout_id:
        intent === 'cover'
          ? 'cover_centered'
          : intent === 'performance_overview'
            ? 'data_grid'
            : 'content_full',
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
  const { deckId } = useParams<{ deckId: string }>();
  const isPolish = i18n.language?.startsWith('pl');
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
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [deckBacklinks, setDeckBacklinks] = useState<
    Array<{ id: string; sourceType: string; sourceId: string }>
  >([]);
  const [deckBacklinksLoading, setDeckBacklinksLoading] = useState(false);
  const [pendingAgentEdit, setPendingAgentEdit] = useState<{
    deck: any;
    reply: string;
    actions: string[];
  } | null>(null);

  const { versions, hasUnsavedChanges, lastSavedAt, restoreVersion, saveManualCheckpoint } =
    useVersionHistory(deck);

  const { isCardOutdated, refreshCard, refreshAllCards } = useDataRefresh(deck, updateCard);

  const { currentUser: authUser } = useAppStore();
  const currentUser = useMemo(
    () => ({
      userId: authUser?.id || 'current-user',
      name: authUser?.name || authUser?.email || 'You',
    }),
    [authUser]
  );
  const collab = useCollaboration(deckId, currentUser, false);

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

  useCommandPaletteShortcut(() => setCommandPaletteOpen(true));

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!deckId) return;
      setLoadingDeck(true);
      setLoadError(null);
      hasLoadedInitialRef.current = false;
      setDeck(null);

      try {
        const res = (await Api.get(`/presentations/decks/${deckId}`)) as any;
        const payload = res?.data;
        const row =
          payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;

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
        await Api.put(
          `/presentations/decks/${deckForAutosave.deckId}/autosave`,
          deckForAutosave.deck
        );
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
        const request =
          format === 'pptx'
            ? {
                url: `/api/presentations/decks/${deck.deck_id}/download`,
                init: { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } },
                extension: 'pptx',
              }
            : format === 'png'
              ? {
                  url: `/api/presentations/decks/${deck.deck_id}/export/png`,
                  init: {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                  },
                  extension: 'zip',
                }
              : {
                  url: `/api/presentations/decks/${deck.deck_id}/export/pdf`,
                  init: { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } },
                  extension: 'pdf',
                };
        const response = await fetch(request.url, request.init);
        if (!response.ok) {
          let errorMsg = 'Export failed';
          try {
            const errorBody = await response.json();
            errorMsg = errorBody?.error || errorMsg;
          } catch {
            /* ignore parse errors */
          }
          throw new Error(errorMsg);
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${deck.title || 'presentation'}.${request.extension}`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success(
          isPolish
            ? `Wyeksportowano jako ${format.toUpperCase()}`
            : `Exported as ${format.toUpperCase()}`
        );
      } catch (err: any) {
        const message = err?.message || (isPolish ? 'Eksport nie powiódł się' : 'Export failed');
        toast.error(message);
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

  const handleAcceptAgentEdit = useCallback(() => {
    if (pendingAgentEdit?.deck) {
      setDeck(pendingAgentEdit.deck);
      toast.success(isPolish ? 'Zmiany zastosowane' : 'Changes applied');
    }
    setPendingAgentEdit(null);
  }, [pendingAgentEdit, setDeck, isPolish]);

  const handleRejectAgentEdit = useCallback(() => {
    toast(isPolish ? 'Zmiany odrzucone' : 'Changes rejected');
    setPendingAgentEdit(null);
  }, [isPolish]);

  const handleAiPrompt = useCallback(
    async (prompt: string) => {
      if (!deck) return { reply: 'No deck loaded.' };
      const res = (await Api.post(`/presentations/decks/${deck.deck_id}/agent-edit`, {
        prompt,
      })) as any;
      const payload =
        res?.data && typeof res.data === 'object' && 'data' in res.data ? res.data.data : res?.data;
      const nextDeck = payload?.deck;
      const reply =
        payload?.reply ||
        (isPolish
          ? 'Zastosowałem zmiany w decku.'
          : 'I applied the requested changes to the deck.');
      const actions = Array.isArray(payload?.appliedActions) ? payload.appliedActions : [];
      if (nextDeck) {
        setPendingAgentEdit({ deck: nextDeck, reply, actions });
      }
      return { reply };
    },
    [deck, isPolish]
  );

  if (loadingDeck || !deck) {
    if (!loadingDeck && loadError) {
      return (
        <div className="h-screen flex items-center justify-center bg-white dark:bg-navy-950 px-6">
          <div className="max-w-md rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-6 text-center shadow-xl">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('presentations.builder.loadFailed', 'Failed to load deck')}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              {t('common.retry', 'Retry')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-navy-950">
        <div className="animate-pulse text-slate-400">
          {t('presentations.builder.loading', 'Loading deck...')}
        </div>
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
    <DeckThemeProvider
      initialColorSetId={deck.color_set_id || 'midnight_navy'}
      initialBrandKit={brandKit}
    >
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
          <ThemeSwitcher isOpen={themeSwitcherOpen} onClose={() => setThemeSwitcherOpen(false)} />
        </div>

        <div className="border-b border-slate-200 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-900/40 px-4 py-2">
          <EmbeddedView
            title={t('presentations.builder.usedIn', 'Used in (backlinks)')}
            count={deckBacklinks.length}
            loading={deckBacklinksLoading}
            readOnly
            viewModes={['list']}
          >
            {deckBacklinks.length === 0 && !deckBacklinksLoading ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isPolish ? 'Brak powiązań' : 'No links yet'}
              </div>
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
                    className="rounded-full border border-slate-200 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-blue-500/50"
                  >
                    {getSourceDisplayLabel(bl.sourceType, i18n.language === 'pl')}: {bl.sourceId}
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
            </span>
            <button
              type="button"
              onClick={handleAcceptAgentEdit}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
            >
              {isPolish ? 'Zastosuj' : 'Accept'}
            </button>
            <button
              type="button"
              onClick={handleRejectAgentEdit}
              className="rounded-lg bg-slate-200 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            >
              {isPolish ? 'Odrzuć' : 'Reject'}
            </button>
          </div>
        )}

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

          {/* Agent Panel (conditional) — bridged to conversation store */}
          {agentOpen && (
            <AgentPanel
              onClose={() => setAgentOpen(false)}
              sourceNames={deck.source_refs.map((s) => s.artifact_name)}
              onSendMessage={handleAiPrompt}
              conversationId={deckId}
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
