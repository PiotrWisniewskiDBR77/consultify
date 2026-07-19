/**
 * Dev-render host for the REAL Deck artifact view (archetyp E · Deck, SPEC-A).
 *
 * Mounts `<DeckBuilder>` (src/components/Presentations/DeckBuilder/DeckBuilder.tsx)
 * — the exact production component wired onto the real route
 * `/presentations/builder/:deckId` (see src/routes/AppRoutes.tsx) — with a mock
 * 6-slide deck (tytuł/cover · problem · podejście · wyniki · rekomendacje ·
 * zamknięcie) so the SPEC-A powłoka (`DeckBuilderMelsView` → `ExecutiveModuleShell`,
 * `isMelsDeckBuilderEnabled()` default ON) can be screenshotted before Piotr sees
 * it (CLAUDE.md #7). No re-implementation — same idiom as
 * `melscanvas-workspace.tsx` (fetch/Api safety net keyed by URL path).
 *
 * Routing: `DeckBuilder` reads `deckId` via `useParams`, so it MUST be rendered
 * under a `<Route>` that matches the real builder path (with a `:deckId`
 * TOKEN — not the literal resolved path, or `useParams` returns `{}`).
 * `AppProviders` already supplies the app's single `<BrowserRouter>` (do NOT
 * nest a second router — react-router throws), so this screen calls the
 * router's OWN `useNavigate()` inside a mounted-effect to switch to the
 * target path — NOT a raw `window.history.replaceState`. That distinction
 * matters: every dev-render screen module is statically imported up-front by
 * `main.tsx` (so it's picked via a shared `SCREENS` registry), so a raw
 * history mutation at module scope would fire on EVERY page load regardless
 * of which `?screen=` was actually selected, wiping the `?screen=` query
 * main.tsx itself still needs to read — corrupting every other screen's
 * routing. Routing through `useNavigate()` inside this screen's own effect
 * only ever runs once this component is actually mounted (i.e. once
 * `?screen=deck-artifact` was selected), so it is side-effect-free for every
 * other screen.
 *
 * Data: `DeckBuilder` loads the deck via `Api.get('/presentations/decks/:id')`
 * (option 1 in its loader — `deck_json` already shaped as a builder `Deck`,
 * no unified_json conversion needed), plus a handful of secondary reads
 * (brand-kit, runtime-events, governance-card, comments, link-graph
 * backlinks, version history). Two layers are mocked, both delegating
 * anything unrecognized to whatever came before them:
 *   1. `window.fetch` — catches the sibling hooks that call raw
 *      `fetch('/api/...')` directly (useVersionHistory, EvidencePanelSection,
 *      presentationRuntimeEvents/Governance's non-`Api.get` fallback path).
 *   2. `Api.get` — catches DeckBuilder's own primary loader. This ALSO has
 *      to be patched here (not just at the fetch layer): several OTHER
 *      dev-render screens (e.g. `navdeclutter-sidebar.tsx`,
 *      `assessment-menu3-status-chips.tsx`) unconditionally reassign
 *      `Api.get` at their own module scope to a mock that returns
 *      `{ data: null }` for anything it doesn't recognize and NEVER calls
 *      `fetch` — and since `main.tsx` eagerly imports every screen for its
 *      registry, those reassignments already ran by the time this module
 *      evaluates (real observed symptom while building this file: the deck
 *      loaded as an empty "Untitled" shell because `Api.get` had already
 *      been clobbered before this file's fetch-level mock ever saw the
 *      request). Patching `Api.get` here too — narrowly, for `/presentations/
 *      decks/:id**` + the couple of adjacent read-only endpoints, delegating
 *      everything else to whatever `Api.get` already was — makes this screen
 *      correct regardless of import order or what any other screen does.
 */
import React, { useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';

import type { Deck, DeckCard } from '../../src/components/Presentations/wizard/types';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

const DECK_ID = 'deck-dbr77-demo-1';
const BUILDER_PATH = `/presentations/builder/${DECK_ID}`;
const DECK_API_PATH = `/presentations/decks/${DECK_ID}`;
const API_DECK_BASE = `/api${DECK_API_PATH}`;

function block(
  cardId: string,
  index: number,
  type: DeckCard['blocks'][number]['type'],
  content: Record<string, unknown>,
  isRefreshable = false
): DeckCard['blocks'][number] {
  return {
    block_id: `block-${cardId}-${index}`,
    card_id: cardId,
    type,
    content,
    is_refreshable: isRefreshable,
    position: { area: 'full', order: index },
    ai_editable: true,
  };
}

function makeCard(params: {
  id: string;
  order: number;
  intent: DeckCard['intent'];
  title: string;
  blocks: DeckCard['blocks'];
  cover?: boolean;
}): DeckCard {
  return {
    card_id: params.id,
    deck_id: DECK_ID,
    order_index: params.order,
    intent: params.intent,
    layout_id: 'auto',
    composition: null,
    title: params.title,
    blocks: params.blocks,
    source_refs: [],
    has_refreshable_data: params.blocks.some((b) => b.is_refreshable),
    background: {
      type: params.cover ? 'gradient' : 'theme',
      value: params.cover ? 'linear-gradient(135deg, #0B3D91, #1A8A8A)' : undefined,
    },
    animations: { entrance: 'fade', block_stagger: false },
    is_locked: false,
  };
}

const CARD_COVER = makeCard({
  id: 'slide-cover',
  order: 0,
  intent: 'cover',
  title: 'Skrócenie czasu wdrożenia klienta o 30%',
  cover: true,
  blocks: [
    block('slide-cover', 0, 'heading', {
      text: 'Skrócenie czasu wdrożenia klienta o 30%',
      level: 1,
    }),
    block('slide-cover', 1, 'paragraph', {
      text: 'DBR77 Sp. z o.o. · Prezentacja zarządu · Lipiec 2026 · Poufne',
    }),
  ],
});

const CARD_PROBLEM = makeCard({
  id: 'slide-problem',
  order: 1,
  intent: 'section_intro',
  title: 'Problem',
  blocks: [
    block('slide-problem', 0, 'heading', { text: 'Problem', level: 2 }),
    block('slide-problem', 1, 'bullet_list', {
      items: [
        'Onboarding nowego klienta trwa dziś średnio 6 tygodni — konkurencja domyka w 3.',
        '68% kroków wdrożenia to ręczne przepisywanie danych między systemami.',
        'Brak jednego właściciela procesu — klient odbija się między 4 zespołami.',
      ],
    }),
  ],
});

const CARD_APPROACH = makeCard({
  id: 'slide-approach',
  order: 2,
  intent: 'key_messages',
  title: 'Podejście',
  blocks: [
    block('slide-approach', 0, 'heading', { text: 'Podejście', level: 2 }),
    block('slide-approach', 1, 'numbered_list', {
      items: [
        'Zmapować i skrócić checklistę wdrożeniową (44 → 18 kroków).',
        'Uruchomić self-service portal klienta na dokumenty startowe.',
        'Wyznaczyć jednego Implementation Ownera na klienta.',
        'Zautomatyzować przekazanie danych CRM → system rozliczeniowy.',
      ],
    }),
  ],
});

const CARD_RESULTS = makeCard({
  id: 'slide-results',
  order: 3,
  intent: 'performance_overview',
  title: 'Wyniki pilotażu',
  blocks: [
    block('slide-results', 0, 'heading', { text: 'Wyniki pilotażu (12 klientów)', level: 2 }),
    block(
      'slide-results',
      1,
      'metric_strip',
      {
        metrics: [
          { label: 'Czas wdrożenia', value: '4.1', unit: 'tyg.', trend: 'down' },
          { label: 'Kroki ręczne', value: '-59%', trend: 'down' },
          { label: 'NPS onboardingu', value: '+22', unit: 'pkt', trend: 'up' },
          { label: 'Koszt na klienta', value: '-18%', trend: 'down' },
        ],
      },
      true
    ),
  ],
});

const CARD_RECOMMENDATIONS = makeCard({
  id: 'slide-recommendations',
  order: 4,
  intent: 'recommendation_portfolio',
  title: 'Rekomendacje',
  blocks: [
    block('slide-recommendations', 0, 'heading', { text: 'Rekomendacje', level: 2 }),
    block('slide-recommendations', 1, 'table', {
      headers: ['Rekomendacja', 'Właściciel', 'Horyzont'],
      rows: [
        ['Skrócona checklista wdrożeniowa jako standard', 'Operacje', 'Q3 2026'],
        ['Self-service portal — pełny rollout', 'Produkt', 'Q4 2026'],
        ['Implementation Owner w każdym zespole', 'PMO', 'Q3 2026'],
      ],
    }),
    block('slide-recommendations', 2, 'callout', {
      text: 'Rekomendujemy zatwierdzenie budżetu fazy 2 na sesji zarządu 08.2026.',
      variant: 'info',
    }),
  ],
});

const CARD_CLOSING = makeCard({
  id: 'slide-closing',
  order: 5,
  intent: 'next_steps',
  title: 'Kolejne kroki',
  blocks: [
    block('slide-closing', 0, 'heading', { text: 'Dziękujemy — kolejne kroki', level: 2 }),
    block('slide-closing', 1, 'bullet_list', {
      items: [
        'Decyzja zarządu o budżecie fazy 2 — sierpień 2026.',
        'Kick-off self-service portalu — wrzesień 2026.',
        'Pytania: piotr.wisniewski@dbr77.com',
      ],
    }),
  ],
});

const MOCK_DECK: Deck = {
  deck_id: DECK_ID,
  organization_id: 'org-dbr77-demo',
  title: 'Skrócenie czasu wdrożenia klienta o 30%',
  theme_id: 'default',
  presentation_mode: 'show',
  communication_register: 'professional',
  image_style_preset: 'minimal_no_images',
  color_set_id: 'harvard',
  status: 'ready',
  card_size: '16:9',
  cards: [
    CARD_COVER,
    CARD_PROBLEM,
    CARD_APPROACH,
    CARD_RESULTS,
    CARD_RECOMMENDATIONS,
    CARD_CLOSING,
  ],
  source_refs: [],
  generation_settings: {
    text_mode: 'preserve',
    content_depth: 'concise',
    audience: 'internal',
    tone: 'professional',
    language: 'pl',
    image_source: 'none',
  },
  animations_enabled: true,
  share_settings: { is_shared: false, permissions: 'view' },
  speaker_notes_generated: false,
  created_by: 'user-piotr-demo',
  created_at: '2026-07-10T09:00:00Z',
  updated_at: '2026-07-18T14:00:00Z',
};

const MOCK_DECK_ROW = {
  id: DECK_ID,
  version: 3,
  status: MOCK_DECK.status,
  title: MOCK_DECK.title,
  organization_id: MOCK_DECK.organization_id,
  // DeckBuilder's loader prefers `deck_json` (builder-native shape) — passing
  // the object directly is fine, `safeJsonParse` returns objects as-is.
  deck_json: MOCK_DECK,
  source_refs: [],
  generated_by: MOCK_DECK.created_by,
  created_at: MOCK_DECK.created_at,
  updated_at: MOCK_DECK.updated_at,
};

const GENERIC_EMPTY = { data: [], items: [], events: [] };

/** Shared URL-keyed mock body, used by both the `Api.get` and `fetch` layers. */
function mockBodyFor(path: string): unknown {
  if (path === DECK_API_PATH) return { data: MOCK_DECK_ROW };
  if (path.startsWith(`${DECK_API_PATH}/`)) return GENERIC_EMPTY; // comments/runtime-events/governance-card/versions/autosave
  if (path === '/presentations/brand-kit') return {};
  return GENERIC_EMPTY;
}

// `Api.get` override — see file header for why this is needed alongside the
// fetch-level mock below. Delegates anything outside `/presentations/**` to
// whatever `Api.get` already was, so it never changes behaviour for calls
// this screen doesn't care about.
const __priorApiGet = Api.get.bind(Api);
Api.get = (async (url: string) => {
  if (url.startsWith('/presentations/') || url.startsWith('/report-builder/backlinks/')) {
    return { data: mockBodyFor(url) };
  }
  return __priorApiGet(url);
}) as typeof Api.get;

Api.getLinkGraphBacklinks = (async () => []) as typeof Api.getLinkGraphBacklinks;

// Fetch-layer interception — catches the sibling hooks that call raw
// `fetch('/api/...')` directly instead of going through `Api.get`. Passes
// `/locales/**` straight through (i18n) and falls back to whatever fetch was
// before for anything else.
const g = window as unknown as { __DECK_ARTIFACT_FETCH__?: boolean };
if (!g.__DECK_ARTIFACT_FETCH__) {
  g.__DECK_ARTIFACT_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
    if (url.startsWith(API_DECK_BASE) || url.includes('/api/presentations/brand-kit')) {
      const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '');
      return new Response(JSON.stringify(mockBodyFor(path)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/api/')) {
      return new Response(JSON.stringify(GENERIC_EMPTY), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input as RequestInfo, init);
  };
}

function DeckArtifactRoutes(): React.ReactElement {
  const navigate = useNavigate();

  // Router-aware navigation (see file header) — switches the app's single
  // BrowserRouter onto the real builder path so `useParams<{deckId}>()`
  // inside `<DeckBuilder>` resolves, WITHOUT touching `window.history`
  // directly (which would desync react-router's own location state).
  useEffect(() => {
    navigate(BUILDER_PATH, { replace: true });
  }, [navigate]);

  const [DeckBuilderLazy] = useState(() =>
    React.lazy(() =>
      import('../../src/components/Presentations/DeckBuilder/DeckBuilder').then((m) => ({
        default: m.DeckBuilder,
      }))
    )
  );

  return (
    <React.Suspense fallback={<div className="p-8 text-sm text-c-text-muted">Loading…</div>}>
      <Routes>
        <Route path="/presentations/builder/:deckId" element={<DeckBuilderLazy />} />
      </Routes>
    </React.Suspense>
  );
}

export function DeckArtifactScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div
          className="h-screen w-screen overflow-hidden bg-c-bg"
          data-testid="deck-artifact-dev-render"
        >
          <DeckArtifactRoutes />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default DeckArtifactScreen;
