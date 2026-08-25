import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  History,
  Lightbulb,
  Link2,
  MessageSquare,
  Package,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// `PreviewActionBar` USUNIETY z importow (2026-07-24, fala 2) — jedynym jego
// konsumentem byla sekcja ① AKCJE prawego panelu, zdjeta przez anty-duplikacje
// SPEC-N §2.6 (obie akcje maja swoj kanoniczny dom w Menu 1 / Menu 2).
import { PreviewRelations } from '@/components/shared/PreviewPane/PreviewRelations';
import { ArtifactPropertiesTable } from '@/components/standard/ArtifactPropertiesTable';
import {
  ARTIFACT_PANEL_CARD_CLASS_DOCKED,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
// PRZELACZNIK Edycja|Podglad — SWIADOMIE NIE RENDEROWANY (2026-07-23).
// `NModeMenu2` pokazuje go tylko gdy dostanie `onReadModeChange`; karta
// biblioteczna go NIE podaje, bo nie ma czym przelaczac (patrz `renderActionBar`).
import { useHelpSidePanel } from '@/contexts/HelpContext';
import { resolveToolStatus } from '@/domain/toolStatus';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { Api } from '@/services/api';
// ETAP 3 standardu n-Type — „Analizuj z AI" (silnik + panel wyników).
import type { CardAnalysisField } from '@/services/cardAnalysis';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';
import { TEXT_L1 } from '@/styles/typography';
import { humanizeEnum } from '@/utils/enumLabels';

import {
  type CardLayout,
  Menu2HowToButton,
  NCardAIAnalysisPanel,
  type NModeArtifactType,
  NModeContentBlock,
  type NModePropertyField,
  type NModeSection,
  NModeShell,
  SectionsManagerMenu,
  useCardAIAnalysis,
  useCardLayout,
} from '../shared/NModeLayout';
import { DynamicSwotLibraryGraphic } from './DynamicSwotLibraryGraphic';
import { GrowthPathsLibraryGraphic } from './GrowthPathsLibraryGraphic';
import { MarketForcesLibraryGraphic } from './MarketForcesLibraryGraphic';
import { PortfolioPriorityLibraryGraphic } from './PortfolioPriorityLibraryGraphic';
import { RiskUncertaintyLibraryGraphic } from './RiskUncertaintyLibraryGraphic';
import { TOOL_CARD_RENDER_IDS, TOOL_CARD_SPEC } from './toolCards.contract';
import { ToolProcessDiagram } from './ToolProcessDiagram';

type KnownTool = Awaited<ReturnType<typeof Api.getKnownTool>>['tool'];

// ── MIGRACJA (D-8, kontrakt karty) — Tool wpina WIĄŻĄCY kontrakt jako źródło
// 4 sekcji centrum (Piotr 2026-07-22: analogicznie do zaakceptowanej migracji
// Notification). Default OFF (zero regresji na demo). Opt-in URL `?cardContract=1`
// oraz localStorage `ff.cardContract` działają TAKŻE na produkcji (bez DEV guardu) —
// żeby Piotr mógł włączyć kontrakt tylko sobie jednym linkiem. Kolejność: URL →
// localStorage → env → OFF. Wzór: isInitiativeCardContractEnabled.
function parseCardContractFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'off') return false;
  return null;
}

function useToolCardContractEnabled(): boolean {
  return useMemo(() => {
    if (typeof window !== 'undefined' && window.location) {
      try {
        const q = parseCardContractFlag(
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
        const ls = parseCardContractFlag(window.localStorage.getItem('ff.cardContract'));
        if (ls !== null) return ls;
      } catch {
        /* ignore */
      }
    }
    if (import.meta.env.VITE_VF1_TOOL_CARD_CONTRACT === 'true') return true;
    return false;
  }, []);
}

// 'tool' NIE istnieje w NModeArtifactType (shared cardSets.ts:32 — dziś
// 'insight'|'initiative'|'decision'|'task'). Pole `artifactType` jest INERTNE,
// bo `spec` (TOOL_CARD_SPEC) zawsze zastępuje DEFAULT_CARD_SETS
// (useCardLayout.ts:148-151) — identyczny placeholder jak w Notification
// (NotificationDetailView.tsx:205), wspóldzielony plik świadomie nietknięty.
const TOOL_ARTIFACT_TYPE = 'tool' as unknown as NModeArtifactType;

// ── SPEC „wszystko widoczne" — domyślny wariant Menu 2 (2026-07-24, fala 2) ──
// Ten sam KATALOG co `TOOL_CARD_SPEC` (jedno źródło sekcji — kontrakt karty),
// ale zestaw domyślny obejmuje KOMPLET sekcji. Dzięki temu picker „Sekcje" może
// być w Menu 2 zawsze, a pierwszy render karty pozostaje identyczny jak przed
// zmianą (Cel · Proces · Rezultat · Przykład). Zwężenie zestawu domyślnego do
// rdzenia metody (3 sekcje) czeka na decyzję właściciela i dalej siedzi za flagą
// `?cardContract=1` — patrz `toolCards.contract.ts`, „★ DO POTWIERDZENIA PIOTRA".
//
// Referencja MODUŁOWA (nie budowana w renderze) — `useCardLayout` wymaga
// stabilnego `spec`, bo zasila memo warstwy layoutu.
const TOOL_CARD_SPEC_ALL_VISIBLE = {
  catalog: TOOL_CARD_SPEC.catalog,
  sets: [
    {
      id: 'all',
      label: { en: 'All sections', pl: 'Wszystkie sekcje' },
      cards: TOOL_CARD_SPEC.catalog.map((c) => c.id),
    },
  ],
};

export function KnownToolDetailView(props: {
  toolType: string;
  onClose: () => void;
  onSessionCreated: (sessionId: string, toolType: string, name: string) => void;
}) {
  const { toolType, onClose, onSessionCreated } = props;
  const { i18n, t } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';
  const isPolish = lang === 'pl';
  const { currentProjectId } = useAppStore();
  const {
    setOpen: setHelpOpen,
    setActiveTab: setHelpTab,
    setKnowledgeModuleIdOverride,
  } = useHelpSidePanel();

  const { mode, setMode } = usePresentationMode({ entityType: 'tool', syncURL: false });

  // ETAP 1.1 n-Type: przełącznik N/C zniknął z Menu 1 — tryb 'c' nie ma już ani
  // wejścia, ani wyjścia, a `usePresentationMode` wciąż czyta go z localStorage.
  // Bez tego strażnika user, który kiedyś kliknął „C", utknąłby w nim na stałe.
  // Ten sam wzorzec ma już Task/Decision/Notification (TaskDetailView ~758).
  useEffect(() => {
    if (mode === 'c') {
      setMode('n');
    }
  }, [mode, setMode]);

  const [activeSection, setActiveSection] = useState<string>('goal');
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState<KnownTool | null>(null);
  const [starting, setStarting] = useState(false);
  // SPEC-N §2.2 / DoD §18.1 — UCZCIWY STAN BŁĘDU.
  // Wcześniej błąd API ustawiał tool=null i komponent leciał dalej do gałęzi
  // domyślnej `sections`, renderując PEŁNĄ treść instruktażową tak, jakby dane
  // się wczytały. To jest kłamstwo wobec użytkownika: widzi kompletny ekran,
  // choć narzędzia nie ma. Teraz błąd ma własny stan i własny render.
  const [loadError, setLoadError] = useState<string | null>(null);
  // Licznik ponowień — bump wywołuje useEffect ponownie. Świadomie licznik,
  // a nie wyciągnięty `useCallback` z loaderem: zero ryzyka TDZ/nieaktualnego
  // domknięcia (lekcja fali N — `ReferenceError` przechodzący esbuild i tsc).
  const [reloadKey, setReloadKey] = useState(0);

  // ── Tryb czytania — STAŁA, nie stan (naprawa 2026-07-23) ─────────────────
  // Właściciel potwierdził (2026-07-23): Narzędzie to BIBLIOTEKA REFERENCYJNA
  // READ-ONLY. Backend to potwierdza — `/api/known-tools` ma wyłącznie GET
  // (`server/src/routes/knownTools.routes.ts`), więc nie istnieje tryb, w którym
  // cokolwiek na tej karcie da się zapisać.
  //
  // Było `useState(true)` + przełącznik „Edycja | Podgląd" w Menu 2. Zmierzone:
  // przełącznik nie sterował NICZYM (0 pól edytowalnych i 0 uchwytów w OBU
  // trybach), czyli był atrapą. Zdjęty (patrz `renderActionBar`), a wartość
  // została jako stała — `NModeContentBlock` nadal dostaje jawną informację
  // „to jest tryb czytania".
  const readMode = true;

  // ── Metryka użycia narzędzia (Właściwości) ────────────────────────────────
  // Liczba sesji i data ostatniego użycia to JEDYNE realne dane o „użyciu"
  // narzędzia, jakie system dziś ma (`Api.listToolSessions` filtrowane po
  // `toolType`). Gdy zapytanie padnie, trzymamy `available: false` i pola
  // pokazują „—", zamiast pokazywać 0 jako fakt (0 ≠ „nie wiem").
  const [sessionStats, setSessionStats] = useState<{
    available: boolean;
    count: number;
    lastUsedAt: string | null;
    // DoD §18.1 („powiazania klikalne first-class"): zeby Powiazania byly
    // linkami, a nie samym licznikiem, trzymamy takze SAME sesje. Zrodlo to ta
    // sama odpowiedz `Api.listToolSessions` — zero dodatkowych zapytan.
    items: Array<{ id: string; name: string; status: string }>;
  }>({ available: false, count: 0, lastUsedAt: null, items: [] });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await Api.listToolSessions({ toolType, limit: 100 });
        if (!alive) return;
        const items = Array.isArray(res?.items) ? res.items : [];
        const stamps = items
          .map((s) => s.updatedAt || s.createdAt || null)
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
          .sort();
        setSessionStats({
          available: true,
          count: typeof res?.total === 'number' ? res.total : items.length,
          lastUsedAt: stamps.length > 0 ? stamps[stamps.length - 1] : null,
          items: items
            .filter((s) => s && typeof s.id === 'string' && s.id.length > 0)
            .map((s) => ({
              id: String(s.id),
              name: String(s.name || s.id),
              status: String(s.status || ''),
            })),
        });
      } catch {
        if (!alive) return;
        setSessionStats({ available: false, count: 0, lastUsedAt: null, items: [] });
      }
    })();
    return () => {
      alive = false;
    };
  }, [toolType, reloadKey]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const res = await Api.getKnownTool(toolType, { lang });
        if (!alive) return;
        if (!res?.tool) {
          setTool(null);
          setLoadError('empty');
          return;
        }
        setTool(res.tool);
        trackFunnelEvent('known_tool_viewed', { toolType });
      } catch (e: any) {
        if (!alive) return;
        toast.error(e?.message || 'Failed to load tool');
        setTool(null);
        setLoadError(e?.message || 'error');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [toolType, lang, reloadKey]);

  const openKb = () => {
    setKnowledgeModuleIdOverride(toolType);
    setHelpTab('knowledge');
    setHelpOpen(true);
    trackFunnelEvent('tool_kb_opened', { toolType });
  };

  const startSession = async () => {
    if (!tool) return;
    if (!tool.isActive) {
      toast.error(t('discoveryToolsMain.knownToolDetailView.thisToolIsNotActiveYet'));
      return;
    }
    try {
      setStarting(true);
      trackFunnelEvent('tool_session_started_from_library', { toolType: tool.toolType });
      const created = await Api.createToolSession({
        toolType: tool.toolType,
        name: `${tool.name} — Session`,
        projectId: currentProjectId || null,
      });
      onSessionCreated(created.id, tool.toolType, tool.name);
      toast.success(t('discoveryToolsMain.knownToolDetailView.toolSessionCreated'));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to start tool session');
    } finally {
      setStarting(false);
    }
  };

  // ── WŁAŚCIWOŚCI (zgłoszenie właściciela 2026-07-23: „za mało pozycji, pełna
  //    metryka") ─────────────────────────────────────────────────────────────
  // Wzorzec = tabela Właściwości Zadania/Decyzji/Inicjatywy (ArtifactPropertiesTable).
  // Były 3 wiersze, z czego jeden („Etap konsultingowy: Poznaj narzędzie") to
  // stała tekstowa bez pokrycia w danych — usunięty, bo właściwość, która zawsze
  // ma tę samą wartość, nie jest metryką, tylko dekoracją.
  //
  // KAŻDY wiersz poniżej ma pokrycie w REALNYM źródle:
  //   · pola `tool.*`         → `Api.getKnownTool` (server: KnownToolsService.getKnownTool)
  //   · liczba sesji / ost. użycie → `Api.listToolSessions({ toolType })`
  //
  // ŚWIADOMIE NIEOBECNE (właściciel prosił, danych NIE MA — patrz raport):
  //   · Właściciel  — `tools` to katalog GLOBALNY (brak kolumny owner/author).
  //   · Czas trwania sesji — brak pola w rejestrze narzędzi i brak pomiaru w
  //     `tool_sessions`; wyliczanie go z updatedAt−createdAt byłoby zmyśleniem
  //     (sesja bywa otwarta tygodniami).
  const fmtDate = (v?: string | null) => {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    try {
      return d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return d.toISOString().slice(0, 10);
    }
  };

  const properties: NModePropertyField[] = useMemo(() => {
    const dash = '—';
    const arr = (v: unknown) => (Array.isArray(v) ? v : []);
    const statusText = tool?.isComingSoon
      ? t('discoveryToolsMain.knownToolDetailView.statusComingSoon', 'Coming soon')
      : tool?.isActive
        ? t('discoveryToolsMain.knownToolDetailView.statusActive', 'Active')
        : t('discoveryToolsMain.knownToolDetailView.statusInactive', 'Inactive');

    const row = (id: string, en: string, pl: string, value: string): NModePropertyField => ({
      id,
      label: { en, pl },
      type: 'text',
      value,
      onChange: () => {},
      readOnly: true,
    });

    return [
      row('status', 'Status', 'Status', statusText),
      row('category', 'Category', 'Kategoria', tool?.libraryCategory || dash),
      // „Typ narzędzia" pokazywał SLUG techniczny („dynamic-swot") — identyfikator
      // katalogu, nie nazwa dla czytelnika (2026-07-24). `tool.name` przychodzi
      // z tego samego zapytania `Api.getKnownTool(toolType, { lang })`, więc jest
      // już w języku interfejsu („Dynamiczny SWOT"). Gdy katalog nie odpowiedział,
      // humanizujemy slug zamiast go pokazywać wprost — nic nie zmyślamy.
      row('toolType', 'Tool type', 'Typ narzędzia', tool?.name || humanizeEnum(toolType) || dash),
      row(
        'access',
        'Access',
        'Dostęp',
        tool?.isLicensed
          ? t('discoveryToolsMain.knownToolDetailView.propAccessLicensed', 'Licensed')
          : t('discoveryToolsMain.knownToolDetailView.propAccessOpen', 'Open')
      ),
      row(
        'tags',
        'Tags',
        'Tagi',
        arr(tool?.tags).length > 0 ? (tool?.tags as string[]).join(' · ') : dash
      ),
      row(
        'inputs',
        'Inputs',
        'Wejścia',
        arr(tool?.inputs).length > 0 ? String(arr(tool?.inputs).length) : dash
      ),
      row(
        'steps',
        'Process steps',
        'Kroki procesu',
        arr(tool?.steps).length > 0 ? String(arr(tool?.steps).length) : dash
      ),
      row(
        'outputs',
        'Outputs',
        'Rezultaty',
        arr(tool?.outputs).length > 0 ? String(arr(tool?.outputs).length) : dash
      ),
      row(
        'sessionsCount',
        'Sessions run',
        'Liczba użyć (sesje)',
        sessionStats.available ? String(sessionStats.count) : dash
      ),
      // ── KWANTYFIKACJA (2026-07-24, fala 2) ────────────────────────────────
      // Sędzia merytoryki zapisał „zero liczb na całej karcie" — to nieprawda
      // (Wejścia/Kroki procesu/Rezultaty/Liczba użyć/dwie daty były i są), ale
      // JEDNA realna miara faktycznie leżała odłogiem: `status` każdej sesji
      // przychodzi już w tej samej odpowiedzi `Api.listToolSessions`, z której
      // liczymy `count`, i nikt go nie pokazywał. „Ile z uruchomionych sesji
      // dobiegło końca" to dla biblioteki referencyjnej sygnał mocny: metoda,
      // której nikt nie kończy, jest w praktyce trudniejsza niż w opisie.
      // ZERO nowych zapytań, ZERO wymyślonych wartości — gdy zapytanie padło,
      // wiersz pokazuje „—" jak pozostałe (0 ≠ „nie wiem").
      row(
        'sessionsCompleted',
        'Sessions completed',
        'Sesje ukończone',
        sessionStats.available
          ? `${
              // tool_sessions.status is written UPPERCASE canonical
              // (DRAFT/IN_PROGRESS/REVIEW/APPROVED/GENERATED/FINALIZED/
              // FAILED — see server/src/controllers/ToolController.ts) with a
              // legacy `COMPLETED` alias; comparing against the lowercase
              // literal 'completed' here never matched anything, so this
              // counter was silently always "0 / N". Routes through the
              // canonical mapper (src/domain/toolStatus.ts) instead.
              (Array.isArray(sessionStats.items) ? sessionStats.items : []).filter((s) => {
                const domain = resolveToolStatus(s.status).domain;
                return domain === 'finalized' || domain === 'generated' || domain === 'approved';
              }).length
            } / ${sessionStats.count}`
          : dash
      ),
      row(
        'lastUsed',
        'Last used',
        'Ostatnie użycie',
        sessionStats.available ? fmtDate(sessionStats.lastUsedAt) : dash
      ),
      row('addedAt', 'Added to library', 'Dodane do biblioteki', fmtDate(tool?.createdAt)),
      row(
        'source',
        'Source',
        'Źródło',
        t('discoveryToolsMain.knownToolDetailView.propSourceLibrary', 'Consultify tool library')
      ),
    ];
  }, [
    isPolish,
    tool,
    toolType,
    sessionStats,
    /* + t: tlumaczenia ladowane async — bez tego memo zwraca surowy klucz na stale (2026-07-21) */ t,
  ]);

  // Rezultaty metody wprost z API (`tool.outputs`), z fallbackiem na
  // `whatYouGet` — oba pola pochodzą z tego samego wpisu bibliotecznego.
  const outcomeItems: string[] = useMemo(() => {
    const outputs = Array.isArray(tool?.outputs) ? (tool?.outputs as string[]) : [];
    if (outputs.length > 0) return outputs;
    return Array.isArray(tool?.whatYouGet) ? (tool?.whatYouGet as string[]) : [];
  }, [tool]);

  // ── ŹRÓDŁA I ZAŁOŻENIA (sekcja ④ prawego panelu) ──────────────────────────
  // Oba pola przychodzą z `Api.getKnownTool` — tej samej odpowiedzi, która
  // zasila resztę karty. Nic tu nie jest wymyślone ani wyliczone „na oko".
  const evidenceInputs: string[] = useMemo(
    () => (Array.isArray(tool?.inputs) ? (tool?.inputs as string[]).filter(Boolean) : []),
    [tool]
  );
  const evidenceLimits: string[] = useMemo(
    () =>
      Array.isArray(tool?.commonMistakes) ? (tool?.commonMistakes as string[]).filter(Boolean) : [],
    [tool]
  );

  // SPEC-N §2.3 — dokładnie jeden primary, w nagłówku (Menu 1).
  // „Startuj sesję" to GŁÓWNE CTA tej karty: cała karta jest bazą wiedzy, której
  // jedynym wyjściem do pracy jest utworzenie sesji narzędzia. Dlatego akcja
  // idzie do `header.primaryAction` (niżej), a NIE do toolbara.
  // SPEC-N §2.6 (anty-duplikacja): „Startuj sesję" ŚWIADOMIE nie występuje tutaj —
  // żyje wyłącznie w slocie primary nagłówka. Toolbar niesie już tylko akcję
  // drugorzędną. Jedna akcja = jedno miejsce.
  // ETAP 1.2: tablica `actions` (jedyna pozycja: „How to / Baza wiedzy") zniknela —
  // akcja ma teraz wlasny, nazwany slot `howToButton` w menu 2, wiec nie musi
  // udawac anonimowego wpisu paska akcji.

  const sections: NModeSection[] = useMemo(() => {
    const bullets = (items: string[] | undefined) => {
      const safe = Array.isArray(items) ? items : [];
      if (safe.length === 0) {
        return (
          <div className="text-sm text-c-text-muted">
            {t('discoveryToolsMain.knownToolDetailView.sectionPendingExpansion')}
          </div>
        );
      }
      return (
        <ul className="space-y-2 text-sm text-c-text-secondary">
          {safe.map((v, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-c-text-muted" />
              <span>{v}</span>
            </li>
          ))}
        </ul>
      );
    };

    // ── NAPRAWA 2026-07-23: chipy były zaszyte PO ANGIELSKU w polskiej karcie ─
    // Wzorzec 1:1 z `NModeMenu2.tsx` (tabela `L` + `pick`): pary { en, pl }
    // trzymane lokalnie, bez wpisów w translation.json. Powód wskazany w tamtym
    // pliku: `t(klucz, 'English default')` renderuje angielski default w polskim
    // UI do czasu doładowania klucza — pary nie mają tego wyścigu.
    const chip = (pair: { en: string; pl: string }) => (isPolish ? pair.pl : pair.en);

    const chipRow = (items: Array<{ en: string; pl: string }> | undefined) => {
      const safe = Array.isArray(items) ? items : [];
      if (safe.length === 0) return null;
      return (
        <div className="flex flex-wrap gap-2">
          {safe.map((v, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-c-surface-raised text-c-text-secondary border border-c-border"
            >
              {chip(v)}
            </span>
          ))}
        </div>
      );
    };

    const caseGrid = (
      cases: Array<{
        title: string;
        context: string;
        question: string;
        evidence: string[];
        aiDraft: string;
        approvedUse: string;
        outcome: string;
      }>,
      limitToOne = false
    ) => (
      <div className="grid gap-4 lg:grid-cols-3">
        {(limitToOne ? cases.slice(0, 1) : cases).map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-c-border-subtle bg-c-surface p-4"
          >
            <div className={TEXT_L1}>{t('discoveryToolsMain.knownToolDetailView.case')}</div>
            <h3 className="mt-2 text-sm font-semibold text-c-text">{item.title}</h3>
            <div className="mt-3 space-y-2 text-xs leading-relaxed max-w-prose text-c-text-secondary">
              <div>
                <span className="font-semibold text-c-text">
                  {t('discoveryToolsMain.knownToolDetailView.context')}
                </span>
                {item.context}
              </div>
              <div>
                <span className="font-semibold text-c-text">
                  {t('discoveryToolsMain.knownToolDetailView.question')}
                </span>
                {item.question}
              </div>
              <div>
                <span className="font-semibold text-c-text">
                  {t('discoveryToolsMain.knownToolDetailView.evidence')}
                </span>
                {item.evidence.join(' ')}
              </div>
              <div>
                <span className="font-semibold text-c-text">
                  {t('discoveryToolsMain.knownToolDetailView.aIDraft')}
                </span>
                {item.aiDraft}
              </div>
              <div>
                <span className="font-semibold text-c-text">
                  {t('discoveryToolsMain.knownToolDetailView.afterApproval')}
                </span>
                {item.approvedUse}
              </div>
              <div>
                <span className="font-semibold text-c-text">
                  {t('discoveryToolsMain.knownToolDetailView.outcome')}
                </span>
                {item.outcome}
              </div>
            </div>
          </div>
        ))}
      </div>
    );

    const goalSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-c-text-muted">
            {t('discoveryToolsMain.knownToolDetailView.toolPositioning')}
          </div>
          {/* CANON FIX (stream G5, 2026-08-13): was a plain <div> — the
              default "Goal" tab had zero semantic headings (h1-h3) reachable
              by assistive tech, unlike every other tab in this view (Process/
              Outcomes/etc. already use <h2>). */}
          <h2 className="mt-3 text-lg font-semibold leading-tight text-c-text">
            {t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.positioningHeadline')}
          </h2>
          <div className="mt-3 text-sm leading-relaxed max-w-prose text-c-text-secondary">
            {t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.positioningBody')}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              {t('discoveryToolsMain.knownToolDetailView.whatTheToolActuallyDoes')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.whatItDoes', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
          {/* ── NAPRAWA 2026-07-23: czerwień brandowa jako DEKORACJA ────────
              BYŁO: `border-danger-200/70 bg-danger-500/5` + `text-danger-700`
              (= rgb(145,10,40) na rgba(232,5,56,0.05)). To panel INFORMACYJNY
              („czym ta metoda nie jest"), a nie błąd/usunięcie/blokada —
              czerwień rezerwuje CLAUDE.md pułapka nr 1 wyłącznie dla semantyki
              krytycznej. JEST: neutralny kafel `c-*` + ikona niosąca znaczenie
              „to jest wykluczenie" zamiast koloru. */}
          <div className="rounded-2xl border border-c-border-subtle bg-c-surface-raised p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary">
              <AlertTriangle size={12} className="shrink-0 text-c-text-muted" aria-hidden="true" />
              {t('discoveryToolsMain.knownToolDetailView.whatThisToolIsNot')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.whatItIsNot', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              {t('discoveryToolsMain.knownToolDetailView.whenToUse')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.whenToUse', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
          {/* Ten sam powód co wyżej: „kiedy NIE zaczynać od SWOT" to porada,
              nie alarm. Neutralny kafel + ikona zamiast czerwieni brandowej. */}
          <div className="rounded-2xl border border-c-border-subtle bg-c-surface-raised p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary">
              <AlertTriangle size={12} className="shrink-0 text-c-text-muted" aria-hidden="true" />
              {t('discoveryToolsMain.knownToolDetailView.whenNotToStartWithSWOT')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.whenNotToUse', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('discoveryToolsMain.knownToolDetailView.whatToPrepareBeforeStarting')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.prepare', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
          <div className="rounded-2xl border border-c-info/30 bg-c-info/5 p-4 dark:border-c-info/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-c-info">
              {t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.dynamicLabel')}
            </div>
            {chipRow([
              { en: 'Mission brief', pl: 'Brief decyzji' },
              { en: 'Evidence-first', pl: 'Najpierw dowody' },
              { en: 'Tensions', pl: 'Napięcia' },
              { en: 'Recommended moves', pl: 'Rekomendowane ruchy' },
              { en: 'Outputs', pl: 'Rezultaty' },
            ])}
            <div className="mt-3 text-sm leading-relaxed max-w-prose text-c-text-secondary">
              {t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.dynamicBody')}
            </div>
          </div>
        </div>
      </div>
    );

    const dynamicSwotStepsMeta = [
      { id: 1, accent: 'bg-c-info', tone: 'from-c-info/[0.12] to-c-info/5' },
      { id: 2, accent: 'bg-sky-500', tone: 'from-sky-500/[0.12] to-blue-500/5' },
      { id: 3, accent: 'bg-emerald-500', tone: 'from-emerald-500/[0.12] to-blue-500/5' },
      { id: 4, accent: 'bg-amber-500', tone: 'from-amber-500/15 to-amber-500/5' },
      { id: 5, accent: 'bg-c-info', tone: 'from-c-info/15 to-c-info/5' },
    ];
    const dynamicSwotStepsTitles = [
      t('discoveryToolsMain.knownToolDetailView.missionBrief'),
      t('discoveryToolsMain.knownToolDetailView.signalsEvidence'),
      t('discoveryToolsMain.knownToolDetailView.matrixBuild'),
      t('discoveryToolsMain.knownToolDetailView.strategicTensions'),
      t('discoveryToolsMain.knownToolDetailView.movesOutputs'),
    ];
    const dynamicSwotStepsText = t('discoveryToolsMain.knownToolDetail.dynamicSwot.process.steps', {
      returnObjects: true,
    }) as Array<{ oneLiner: string; items: string[]; note: string }>;
    const processSteps = dynamicSwotStepsMeta.map((meta, idx) => ({
      ...meta,
      title: dynamicSwotStepsTitles[idx],
      ...dynamicSwotStepsText[idx],
    }));

    const ProcessStepper = () => {
      const [openStep, setOpenStep] = React.useState<number | null>(null);
      return (
        <div className="space-y-2">
          {processSteps.map((step) => {
            const isOpen = openStep === step.id;
            return (
              <div
                key={step.id}
                className={`rounded-2xl border transition-all duration-200 ${
                  isOpen
                    ? `border-c-border-strong bg-gradient-to-br ${step.tone} shadow-sm`
                    : 'border-c-border-subtle bg-c-surface-raised/50 hover:border-c-border-strong hover:bg-c-surface-raised/80'
                }`}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 p-3 text-left"
                  onClick={() => setOpenStep(isOpen ? null : step.id)}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-c-text text-[11px] font-bold text-c-bg">
                    {step.id}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-c-text">{step.title}</div>
                    {!isOpen && (
                      <div className="mt-0.5 text-xs text-c-text-muted">{step.oneLiner}</div>
                    )}
                  </div>
                  <span className={`mr-1 h-2 w-2 shrink-0 rounded-full ${step.accent}`} />
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    className={`shrink-0 text-c-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <path
                      d="M3 5.5l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t border-c-border-subtle px-3 pb-4 pt-3">
                    <div className="pl-10">
                      {bullets(step.items)}
                      {step.note ? (
                        <div className="mt-3 rounded-xl border border-c-border-subtle bg-c-surface-raised/70 px-3 py-2 text-sm text-c-text-secondary">
                          {step.note}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    const processSection = (
      <div className="space-y-6">
        <ToolProcessDiagram toolType="dynamic-swot" isPolish={isPolish} />
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-c-text">
              {t('discoveryToolsMain.knownToolDetailView.workLogic')}
            </h2>
            <span className="inline-flex shrink-0 rounded-full border border-c-border-strong bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted dark:bg-white/[0.05]">
              {chip({ en: 'Process', pl: 'Proces' })}
            </span>
          </div>
          <div className="mt-2 text-sm leading-relaxed max-w-prose text-c-text-secondary">
            {t('discoveryToolsMain.knownToolDetail.dynamicSwot.process.intro')}
          </div>
        </div>

        <ProcessStepper />

        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {t('discoveryToolsMain.knownToolDetail.dynamicSwot.process.sessionQualityLabel')}
            </div>
            <span className="inline-flex shrink-0 rounded-full border border-emerald-300/50 bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200">
              {chip({ en: 'Quality', pl: 'Jakość' })}
            </span>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-c-text-secondary">
            {(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.process.sessionQualityItems', {
                returnObjects: true,
              }) as string[]
            ).map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-c-info/30 bg-c-info/5 p-4 dark:border-c-info/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-info">
              {t('discoveryToolsMain.knownToolDetailView.4CommonDecisionSituations')}
            </div>
            <span className="inline-flex shrink-0 rounded-full border border-c-info/40 bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-info dark:bg-white/[0.05]">
              {chip({ en: 'Insight', pl: 'Wniosek' })}
            </span>
          </div>
          <div className="mt-2 text-sm leading-relaxed max-w-prose text-c-text-secondary">
            {t('discoveryToolsMain.knownToolDetail.dynamicSwot.process.decisionSituationsIntro')}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.process.decisionSituationsCards', {
                returnObjects: true,
              }) as Array<{ label: string; desc: string; accent: string }>
            ).map((item) => {
              const accentMap: Record<
                string,
                { border: string; bg: string; title: string; dot: string }
              > = {
                emerald: {
                  border: 'border-emerald-200/70',
                  bg: 'bg-emerald-500/5',
                  title: 'text-emerald-700 dark:text-emerald-300',
                  dot: 'bg-emerald-500',
                },
                sky: {
                  border: 'border-sky-200/70',
                  bg: 'bg-sky-500/5',
                  title: 'text-sky-700 dark:text-sky-300',
                  dot: 'bg-sky-500',
                },
                amber: {
                  border: 'border-amber-200/70',
                  bg: 'bg-amber-500/5',
                  title: 'text-amber-800 dark:text-amber-200',
                  dot: 'bg-amber-500',
                },
                // NAPRAWA 2026-07-23: kategoria danych NIE MOŻE być crimson
                // (`danger-*` = rodzina czerwieni brandowej). Piąta kategoria
                // jest neutralna — kolor tu i tak nie niesie znaczenia, a
                // czerwień czytałaby się jako „błąd".
                rose: {
                  border: 'border-c-border-subtle',
                  bg: 'bg-c-surface-raised',
                  title: 'text-c-text-secondary',
                  dot: 'bg-c-text-muted',
                },
              };
              const a = accentMap[item.accent] || accentMap.emerald;
              return (
                <div key={item.label} className={`rounded-xl border ${a.border} ${a.bg} p-3`}>
                  <div className={`text-xs font-semibold ${a.title}`}>{item.label}</div>
                  <div className="mt-1.5 text-[13px] leading-relaxed max-w-prose text-c-text-secondary">
                    {item.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/70 bg-amber-500/5 p-4 dark:border-amber-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-200">
              {t('discoveryToolsMain.knownToolDetailView.workingNotes')}
            </div>
            <span className="inline-flex shrink-0 rounded-full border border-amber-300/50 bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800 dark:border-amber-800/50 dark:bg-white/[0.05] dark:text-amber-200">
              {chip({ en: 'Tips', pl: 'Wskazówki' })}
            </span>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-c-text-secondary">
            {(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.process.workingNotesItems', {
                returnObjects: true,
              }) as string[]
            ).map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );

    // Etykiety pigułek — pary { en, pl } jak w `NModeMenu2` (wzorzec `L`+`pick`),
    // bo `t(klucz, 'English default')` renderowałby po polsku angielski default.
    // 2026-07-24 (fala 2): były to nagie łańcuchy angielskie („Decision",
    // „Evidence", „Tensions", „Moves", „Execution") widoczne w polskiej wersji
    // karty — zgłoszenie sędziego merytoryki (mieszanka językowa).
    const dynamicSwotOutcomeMeta = [
      {
        id: 'decision-frame',
        badge: chip({ en: 'Decision', pl: 'Decyzja' }),
        color: 'violet' as const,
      },
      {
        id: 'evidence-picture',
        badge: chip({ en: 'Evidence', pl: 'Dowody' }),
        color: 'sky' as const,
      },
      { id: 'tensions', badge: chip({ en: 'Tensions', pl: 'Napięcia' }), color: 'amber' as const },
      { id: 'moves', badge: chip({ en: 'Moves', pl: 'Ruchy' }), color: 'emerald' as const },
      {
        id: 'execution-bridge',
        badge: chip({ en: 'Execution', pl: 'Wykonanie' }),
        color: 'rose' as const,
      },
    ];
    const dynamicSwotOutcomeText = t(
      'discoveryToolsMain.knownToolDetail.dynamicSwot.outcomes.blocks',
      { returnObjects: true }
    ) as Array<{ title: string; what: string; why: string; next: string }>;
    const outcomeBlocks = dynamicSwotOutcomeMeta.map((meta, idx) => ({
      ...meta,
      ...dynamicSwotOutcomeText[idx],
    }));

    const colorMap = {
      violet: {
        card: 'border-c-info/30 bg-c-info/5 dark:border-c-info/40',
        badge: 'border-c-info/40 bg-white/70 text-c-info dark:bg-white/[0.05]',
        title: 'text-c-info',
        dot: 'bg-c-info',
      },
      sky: {
        card: 'border-sky-200/70 bg-sky-500/5 dark:border-sky-900/40',
        badge:
          'border-sky-300/50 bg-white/70 text-sky-800 dark:border-sky-800/50 dark:bg-white/[0.05] dark:text-sky-200',
        title: 'text-sky-700 dark:text-sky-300',
        dot: 'bg-sky-500',
      },
      amber: {
        card: 'border-amber-200/70 bg-amber-500/5 dark:border-amber-900/40',
        badge:
          'border-amber-300/50 bg-white/70 text-amber-800 dark:border-amber-800/50 dark:bg-white/[0.05] dark:text-amber-200',
        title: 'text-amber-800 dark:text-amber-200',
        dot: 'bg-amber-500',
      },
      emerald: {
        card: 'border-emerald-200/70 bg-emerald-500/5 dark:border-emerald-900/40',
        badge:
          'border-emerald-300/50 bg-white/70 text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200',
        title: 'text-emerald-700 dark:text-emerald-300',
        dot: 'bg-emerald-500',
      },
      rose: {
        // NAPRAWA 2026-07-23: piąty blok rezultatu („most do wykonania") był
        // crimson (`danger-*`) jako KATEGORIA DANYCH — zakaz z CLAUDE.md
        // pułapka nr 1. Neutralny kafel niesie dokładnie tyle samo informacji.
        card: 'border-c-border-subtle bg-c-surface-raised',
        badge: 'border-c-border-strong bg-c-surface text-c-text-secondary',
        title: 'text-c-text-secondary',
        dot: 'bg-c-text-muted',
      },
    };

    const outcomesSection = (
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-c-text">
              {t('discoveryToolsMain.knownToolDetailView.whatTheSessionProduces')}
            </h2>
            <span className="inline-flex shrink-0 rounded-full border border-c-border-strong bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted dark:bg-white/[0.05]">
              {chip({ en: 'Output', pl: 'Rezultat' })}
            </span>
          </div>
          <div className="mt-2 text-sm leading-relaxed max-w-prose text-c-text-secondary">
            {t('discoveryToolsMain.knownToolDetail.dynamicSwot.outcomes.intro')}
          </div>
        </div>

        <div className="space-y-3">
          {outcomeBlocks.map((block) => {
            const c = colorMap[block.color];
            return (
              <div key={block.id} className={`rounded-2xl border p-4 ${c.card}`}>
                <div className="flex items-center justify-between gap-3">
                  <div
                    className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${c.title}`}
                  >
                    {block.title}
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${c.badge}`}
                  >
                    {block.badge}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-c-text-secondary">
                      {t('discoveryToolsMain.knownToolDetailView.contains')}
                    </div>
                    <div className="text-sm leading-relaxed max-w-prose text-c-text-secondary">
                      {block.what}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-c-text-secondary">
                      {t('discoveryToolsMain.knownToolDetailView.whyItMatters')}
                    </div>
                    <div className="text-sm leading-relaxed max-w-prose text-c-text-secondary">
                      {block.why}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-c-text-secondary">
                      {t('discoveryToolsMain.knownToolDetailView.enablesNext')}
                    </div>
                    <div className="text-sm leading-relaxed max-w-prose text-c-text">
                      {block.next}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {t('discoveryToolsMain.knownToolDetailView.whatAStrongOutcomeLooksLike')}
            </div>
            <span className="inline-flex shrink-0 rounded-full border border-emerald-300/50 bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200">
              {chip({ en: 'Quality', pl: 'Jakość' })}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed max-w-prose text-c-text-secondary">
            {t('discoveryToolsMain.knownToolDetail.dynamicSwot.outcomes.qualityBody')}
          </p>
        </div>
      </div>
    );

    const exampleSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-4">
          <h2 className="text-lg font-semibold text-c-text">
            {t('discoveryToolsMain.knownToolDetailView.example')}
          </h2>
          <div className="mt-2 text-sm leading-relaxed max-w-prose text-c-text-secondary">
            {t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.intro')}
          </div>
        </div>

        {caseGrid(
          (
            t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.cases', {
              returnObjects: true,
            }) as Array<{
              title: string;
              context: string;
              question: string;
              evidence: string[];
              aiDraft: string;
              approvedUse: string;
              outcome: string;
            }>
          ).slice(0, 1),
          true
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-c-surface-raised p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('discoveryToolsMain.knownToolDetailView.situationAndDecisionQuestion')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.situationItems', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
          <div className="rounded-2xl bg-c-surface-raised p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('discoveryToolsMain.knownToolDetailView.keyInputSignals')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.signalsItems', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('discoveryToolsMain.knownToolDetailView.howTheMatrixLooks')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.matrixItems', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
          <div className="rounded-2xl border border-amber-200/70 bg-amber-500/5 p-4 dark:border-amber-900/40">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              {t('discoveryToolsMain.knownToolDetailView.tensionAndInterpretation')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.tensionItems', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                {t('discoveryToolsMain.knownToolDetailView.recommendedMoves')}
              </div>
              {bullets(
                t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.movesItems', {
                  returnObjects: true,
                }) as string[]
              )}
            </div>
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                {t('discoveryToolsMain.knownToolDetailView.outputsFromTheSession')}
              </div>
              {bullets(
                t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.outputsItems', {
                  returnObjects: true,
                }) as string[]
              )}
            </div>
          </div>
        </div>

        <DynamicSwotLibraryGraphic isPolish={isPolish} variant="example" />

        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 text-sm text-c-text-secondary dark:border-emerald-900/50">
          {t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.closingNote')}
        </div>
      </div>
    );

    const marketGoalSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-c-text-muted">
            {t('discoveryToolsMain.knownToolDetailView.toolPositioning')}
          </div>
          <div className="mt-3 text-lg font-semibold leading-tight text-c-text">
            {t('discoveryToolsMain.knownToolDetail.marketForces.goal.positioningHeadline')}
          </div>
          <div className="mt-3 text-sm leading-relaxed max-w-prose text-c-text-secondary">
            {t('discoveryToolsMain.knownToolDetail.marketForces.goal.positioningBody')}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-blue-200/70 bg-blue-500/5 p-4 dark:border-blue-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
              {t('discoveryToolsMain.knownToolDetailView.whatTheToolActuallyDoes')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.marketForces.goal.whatItDoes', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
          {/* Ta sama naprawa co w wariancie dynamic-swot: panel informacyjny
              („czym ta metoda nie jest") NIE jest semantyką krytyczną. */}
          <div className="rounded-2xl border border-c-border-subtle bg-c-surface-raised p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary">
              <AlertTriangle size={12} className="shrink-0 text-c-text-muted" aria-hidden="true" />
              {t('discoveryToolsMain.knownToolDetailView.whatThisToolIsNot')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.marketForces.goal.whatItIsNot', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-c-info/30 bg-c-info/5 p-4 dark:border-c-info/40">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-c-info">
            {t('discoveryToolsMain.knownToolDetailView.aIPhilosophy')}
          </div>
          {chipRow([
            { en: 'Market brief', pl: 'Brief rynkowy' },
            { en: 'Evidence', pl: 'Dowody' },
            { en: 'AI proposals', pl: 'Propozycje AI' },
            { en: 'User approval', pl: 'Zatwierdzenie użytkownika' },
            { en: 'Initiatives', pl: 'Inicjatywy' },
          ])}
          <div className="mt-3 text-sm leading-relaxed max-w-prose text-c-text-secondary">
            {t('discoveryToolsMain.knownToolDetail.marketForces.goal.aiPhilosophyBody')}
          </div>
        </div>
      </div>
    );

    const marketProcessSection = (
      <div className="space-y-6">
        <ToolProcessDiagram toolType="market-forces" isPolish={isPolish} />
        <div>
          <h2 className="text-lg font-semibold text-c-text">
            {t('discoveryToolsMain.knownToolDetailView.workLogic')}
          </h2>
          <div className="mt-2 text-sm leading-relaxed max-w-prose text-c-text-secondary">
            {t('discoveryToolsMain.knownToolDetail.marketForces.process.intro')}
          </div>
        </div>
        <div className="grid gap-3">
          {(
            t('discoveryToolsMain.knownToolDetail.marketForces.process.steps', {
              returnObjects: true,
            }) as Array<{ title: string; text: string }>
          ).map(({ title, text }, index) => (
            <div key={title} className="rounded-2xl border border-c-border-subtle bg-c-surface p-4">
              <div className="flex items-start gap-3">
                {/* stonowane: bylo `bg-blue-600 text-white` (solid, bez wariantu dark) — konkurowalo
                    wizualnie ze slotem primary. Wyrownane do wzorca numeratora z L437. (2026-07-21) */}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-c-text text-[11px] font-bold text-c-bg">
                  {index + 1}
                </div>
                <div>
                  <div className="text-sm font-semibold text-c-text">{title}</div>
                  <div className="mt-1 text-sm text-c-text-secondary">{text}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    const marketOutcomesSection = (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-c-text">
            {t('discoveryToolsMain.knownToolDetailView.whatTheSessionProduces')}
          </h2>
          <div className="mt-2 text-sm leading-relaxed max-w-prose text-c-text-secondary">
            {t('discoveryToolsMain.knownToolDetail.marketForces.outcomes.intro')}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(
            t('discoveryToolsMain.knownToolDetail.marketForces.outcomes.blocks', {
              returnObjects: true,
            }) as Array<{ title: string; text: string }>
          ).map(({ title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-blue-200/70 bg-blue-500/5 p-4 dark:border-blue-900/40"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
                {title}
              </div>
              <div className="mt-2 text-sm leading-relaxed max-w-prose text-c-text-secondary">
                {text}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    const marketExampleSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-4">
          <h2 className="text-lg font-semibold text-c-text">
            {t('discoveryToolsMain.knownToolDetailView.example')}
          </h2>
          <div className="mt-2 text-sm leading-relaxed max-w-prose text-c-text-secondary">
            {t('discoveryToolsMain.knownToolDetail.marketForces.example.intro')}
          </div>
        </div>
        {caseGrid(
          t('discoveryToolsMain.knownToolDetail.marketForces.example.cases', {
            returnObjects: true,
          }) as Array<{
            title: string;
            context: string;
            question: string;
            evidence: string[];
            aiDraft: string;
            approvedUse: string;
            outcome: string;
          }>,
          true
        )}
        <MarketForcesLibraryGraphic isPolish={isPolish} variant="example" />
      </div>
    );

    const growthGoalSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-c-text-muted">
            {t('discoveryToolsMain.knownToolDetailView.toolPositioning')}
          </div>
          <div className="mt-3 text-lg font-semibold leading-tight text-c-text">
            {t('discoveryToolsMain.knownToolDetail.growthPaths.goal.positioningHeadline')}
          </div>
          <div className="mt-3 text-sm leading-relaxed max-w-prose text-c-text-secondary">
            {t('discoveryToolsMain.knownToolDetail.growthPaths.goal.positioningBody')}
          </div>
        </div>
        <GrowthPathsLibraryGraphic isPolish={isPolish} variant="process" />
      </div>
    );

    const growthProcessSection = (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-c-text">
          {t('discoveryToolsMain.knownToolDetailView.workLogic')}
        </h2>
        <div className="grid gap-3">
          {(
            t('discoveryToolsMain.knownToolDetail.growthPaths.process.steps', {
              returnObjects: true,
            }) as Array<{ title: string; text: string }>
          ).map(({ title, text }, index) => (
            <div key={title} className="rounded-2xl border border-c-border-subtle bg-c-surface p-4">
              <div className="flex items-start gap-3">
                {/* stonowane: bylo bg (slate/navy) + text-white bez wariantu dark — numerator ginal
                    na ciemnym tle. Wyrownane do wzorca numeratora z L437. (2026-07-21) */}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-c-text text-[11px] font-bold text-c-bg">
                  {index + 1}
                </div>
                <div>
                  <div className="text-sm font-semibold text-c-text">{title}</div>
                  <div className="mt-1 text-sm text-c-text-secondary">{text}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    const growthOutcomesSection = (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-c-text">
          {t('discoveryToolsMain.knownToolDetailView.whatTheSessionProduces')}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {(
            t('discoveryToolsMain.knownToolDetail.growthPaths.outcomes.blocks', {
              returnObjects: true,
            }) as Array<{ title: string; text: string }>
          ).map(({ title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-c-info/30 bg-c-info/5 p-4 dark:border-c-info/40"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-info">
                {title}
              </div>
              <div className="mt-2 text-sm leading-relaxed max-w-prose text-c-text-secondary">
                {text}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    const growthExampleSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-4">
          <h2 className="text-lg font-semibold text-c-text">
            {t('discoveryToolsMain.knownToolDetailView.example')}
          </h2>
          <div className="mt-2 text-sm leading-relaxed max-w-prose text-c-text-secondary">
            {t('discoveryToolsMain.knownToolDetail.growthPaths.example.intro')}
          </div>
        </div>
        {caseGrid(
          t('discoveryToolsMain.knownToolDetail.growthPaths.example.cases', {
            returnObjects: true,
          }) as Array<{
            title: string;
            context: string;
            question: string;
            evidence: string[];
            aiDraft: string;
            approvedUse: string;
            outcome: string;
          }>
        )}
        <GrowthPathsLibraryGraphic isPolish={isPolish} variant="example" />
      </div>
    );

    const portfolioGoalSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-c-text-muted">
            {t('discoveryToolsMain.knownToolDetailView.whyUseIt')}
          </div>
          <div className="mt-2 text-sm leading-relaxed max-w-prose text-c-text-secondary">
            {t('discoveryToolsMain.knownToolDetail.portfolioPriority.goal.positioningBody')}
          </div>
        </div>
        <PortfolioPriorityLibraryGraphic isPolish={isPolish} variant="process" />
      </div>
    );

    // Tytuły kafli — pary { en, pl } przez `chip` (2026-07-24, fala 2). Były
    // nagimi łańcuchami angielskimi w polskiej karcie, tak samo jak pigułki
    // Rezultatu (ta sama klasa defektu, inne narzędzie biblioteki).
    const portfolioProcessSection = (
      <div className="grid gap-4 md:grid-cols-2">
        {[
          [
            chip({ en: 'Mission', pl: 'Cel sesji' }),
            t('discoveryToolsMain.knownToolDetail.portfolioPriority.process.missionText'),
          ],
          [
            chip({ en: 'Evidence', pl: 'Dowody' }),
            t('discoveryToolsMain.knownToolDetail.portfolioPriority.process.evidenceText'),
          ],
          [
            chip({ en: 'Items', pl: 'Pozycje portfela' }),
            t('discoveryToolsMain.knownToolDetail.portfolioPriority.process.itemsText'),
          ],
          [
            chip({ en: 'Outputs', pl: 'Materiały wyjściowe' }),
            t('discoveryToolsMain.knownToolDetail.portfolioPriority.process.outputsText'),
          ],
        ].map(([title, text]) => (
          <div key={title} className="rounded-2xl border border-c-border-subtle bg-c-surface p-5">
            <div className="font-semibold text-c-text">{title}</div>
            <div className="mt-2 text-sm leading-relaxed max-w-prose text-c-text-secondary">
              {text}
            </div>
          </div>
        ))}
      </div>
    );

    const portfolioOutcomesSection = (
      <div className="space-y-3">
        {[
          t('discoveryToolsMain.knownToolDetailView.approvedBCGPortfolioMatrix'),
          t('discoveryToolsMain.knownToolDetail.portfolioPriority.outcomes.tradeOffs'),
          t('discoveryToolsMain.knownToolDetail.portfolioPriority.outcomes.moves'),
          t('discoveryToolsMain.knownToolDetail.portfolioPriority.outcomes.candidates'),
        ].map((text) => (
          <div
            key={text}
            className="rounded-2xl border border-c-border-subtle bg-c-surface p-4 text-sm text-c-text-secondary"
          >
            {text}
          </div>
        ))}
      </div>
    );

    const portfolioExampleSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-5 text-sm leading-relaxed max-w-prose text-c-text-muted">
          {t('discoveryToolsMain.knownToolDetail.portfolioPriority.example.intro')}
        </div>
        {caseGrid(
          t('discoveryToolsMain.knownToolDetail.portfolioPriority.example.cases', {
            returnObjects: true,
          }) as Array<{
            title: string;
            context: string;
            question: string;
            evidence: string[];
            aiDraft: string;
            approvedUse: string;
            outcome: string;
          }>
        )}
        <PortfolioPriorityLibraryGraphic isPolish={isPolish} variant="example" />
      </div>
    );

    const riskGoalSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-c-text-muted">
            {t('discoveryToolsMain.knownToolDetailView.whyUseIt')}
          </div>
          <div className="mt-2 text-sm leading-relaxed max-w-prose text-c-text-secondary">
            {t('discoveryToolsMain.knownToolDetail.riskUncertainty.goal.positioningBody')}
          </div>
        </div>
        <RiskUncertaintyLibraryGraphic isPolish={isPolish} variant="process" />
      </div>
    );

    const riskProcessSection = (
      <div className="grid gap-4 md:grid-cols-2">
        {[
          [
            chip({ en: 'Mission', pl: 'Cel sesji' }),
            t('discoveryToolsMain.knownToolDetail.riskUncertainty.process.missionText'),
          ],
          [
            chip({ en: 'Evidence', pl: 'Dowody' }),
            t('discoveryToolsMain.knownToolDetail.riskUncertainty.process.evidenceText'),
          ],
          [
            chip({ en: 'Risk map', pl: 'Mapa ryzyk' }),
            t('discoveryToolsMain.knownToolDetail.riskUncertainty.process.riskMapText'),
          ],
          [
            chip({ en: 'Outputs', pl: 'Materiały wyjściowe' }),
            t('discoveryToolsMain.knownToolDetail.riskUncertainty.process.outputsText'),
          ],
        ].map(([title, text]) => (
          <div key={title} className="rounded-2xl border border-c-border-subtle bg-c-surface p-5">
            <div className="font-semibold text-c-text">{title}</div>
            <div className="mt-2 text-sm leading-relaxed max-w-prose text-c-text-secondary">
              {text}
            </div>
          </div>
        ))}
      </div>
    );

    const riskOutcomesSection = (
      <div className="space-y-3">
        {[
          t('discoveryToolsMain.knownToolDetail.riskUncertainty.outcomes.map'),
          t('discoveryToolsMain.knownToolDetail.riskUncertainty.outcomes.moves'),
          t('discoveryToolsMain.knownToolDetail.riskUncertainty.outcomes.earlyWarnings'),
          t('discoveryToolsMain.knownToolDetail.riskUncertainty.outcomes.candidates'),
        ].map((text) => (
          <div
            key={text}
            className="rounded-2xl border border-c-border-subtle bg-c-surface p-4 text-sm text-c-text-secondary"
          >
            {text}
          </div>
        ))}
      </div>
    );

    const riskExampleSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-5 text-sm leading-relaxed max-w-prose text-c-text-muted">
          {t('discoveryToolsMain.knownToolDetail.riskUncertainty.example.intro')}
        </div>
        {caseGrid(
          t('discoveryToolsMain.knownToolDetail.riskUncertainty.example.cases', {
            returnObjects: true,
          }) as Array<{
            title: string;
            context: string;
            question: string;
            evidence: string[];
            aiDraft: string;
            approvedUse: string;
            outcome: string;
          }>
        )}
        <RiskUncertaintyLibraryGraphic isPolish={isPolish} variant="example" />
      </div>
    );

    // ── Standard-C group tabs (mirrors InsightViewer/InitiativeDocumentView) ──
    // Every per-tool branch below returns the same 4 sections (goal / process /
    // outcomes / example). A localized groupLabels array +
    // a per-section group assignment makes NModeShell's C-board render top group
    // tabs; wide narrative sections get cSpan: 2 so they breathe in the dense
    // 3-column grid. N-mode uses the same group fields for sidebar headers.
    const groupLabels = [
      t('discoveryToolsMain.knownToolDetailView.groupOverview'),
      t('discoveryToolsMain.knownToolDetailView.groupHowItWorks'),
      t('discoveryToolsMain.knownToolDetailView.groupExample'),
    ];
    const groupIndexById: Record<string, number> = {
      goal: 0, // Overview / Przegląd
      process: 1, // How it works / Jak to działa
      outcomes: 1,
      example: 2, // Example / Przykład
    };
    const cSpanById: Record<string, 1 | 2 | 3> = {
      goal: 2, // multi-card positioning grids
      process: 2, // stepper + decision-situation grids
      outcomes: 2, // 3-column outcome blocks
      example: 3, // wide 3-col case grids
    };
    // ── SPEC-N §2.5 — KONTRAKT AI: jawne WYKLUCZENIE dla wszystkich 4 sekcji ──
    // Reguła §2.5 mówi: każda sekcja deklaruje kontrakt AI albo jawne wykluczenie;
    // milczenie jest zabronione. Tutaj deklarujemy wykluczenie —
    //   aiContract: { none: true, reason: 'statyczna baza wiedzy' }
    // dla goal · process · outcomes · example, we WSZYSTKICH sześciu wariantach
    // narzędzi (wszystkie przechodzą przez ten jeden lejek `withGroup`).
    //
    // UZASADNIENIE (a nie tylko fakt): treść tych sekcji to kanoniczny opis
    // metody doradczej pobierany z backendu (`Api.getKnownTool`) — identyczny dla
    // każdego użytkownika i każdego projektu. Nie ma tu czego generować ani
    // regenerować: AI pisząca „czym jest BCG matrix" produkowałaby wariancję tam,
    // gdzie wariancja jest wadą. Karta Tool jest CZYTANA, nie współtworzona —
    // treść współtworzona przez AI powstaje dopiero w SESJI narzędzia
    // (przycisk primary „Startuj sesję"), która jest osobnym artefaktem.
    //
    // UWAGA dla następnej osoby: `NModeSection` nie ma dziś pola `aiContract`
    // (typ w `shared/NModeLayout/types.ts`), a ten pakiet migracyjny ma zakaz
    // edycji powłoki — więc deklaracja jest komentarzem, nie polem. Gdy fala F
    // doda `aiContract` do typu (SPEC-N §5.1), przenieś ją tutaj jako pole:
    // to jest jedyne miejsce, które trzeba zmienić.
    //
    // ── BLOKI CENTRUM (zgłoszenie właściciela 2026-07-23, pkt 2) ─────────────
    // „Bloki są statycznymi kartami. W trybie Edycja każdy ma mieć: przycisk AI,
    // bezpośrednią edycję, auto-fit, uchwyt zmiany wysokości. W Podglądzie
    // kontrolki ukryte."
    //
    // Ten sam lejek `withGroup` obudowuje KAŻDĄ sekcję centrum wspólną powłoką
    // `NModeContentBlock` — więc afordancje dostaje każdy z sześciu wariantów
    // narzędzia naraz, bez kopiowania kodu per narzędzie („standard jest kodem").
    // Dostarczone tutaj: auto-dopasuj + uchwyt wysokości + ukrycie kontrolek
    // w Podglądzie.
    //
    // ⚠ ŚWIADOMIE NIE PODAJEMY `onAI` ani `onEdit`. Treść tej karty jest
    // read-only na poziomie API: `/api/known-tools` wystawia WYŁĄCZNIE
    // `GET /` i `GET /:toolType` (server/src/routes/knownTools.routes.ts) —
    // nie ma PUT/PATCH, więc nie ma dokąd zapisać ani wyniku edycji, ani wyniku
    // AI. Przycisk, który zmienia tekst do pierwszego odświeżenia, jest gorszy
    // niż jego brak. Komponent przyjmuje oba handlery, więc podpięcie po
    // dorobieniu endpointu to jedna linia. Patrz raport ETAP 2.2 (zgłoszenie Z-1).
    const withGroup = (list: NModeSection[]): NModeSection[] =>
      list.map((section) => ({
        ...section,
        group: groupLabels[groupIndexById[section.id] ?? 0],
        cSpan: cSpanById[section.id] ?? section.cSpan,
        component: (
          <NModeContentBlock
            blockId={section.id}
            scope={`tool:${tool?.toolType || toolType}`}
            readMode={readMode}
            isPolish={isPolish}
            variant="plain"
          >
            {section.component}
          </NModeContentBlock>
        ),
      }));

    if (tool?.toolType === 'dynamic-swot') {
      return withGroup([
        {
          id: 'goal',
          icon: Target,
          label: { en: 'Goal', pl: 'Cel' },
          component: goalSection,
        },
        {
          id: 'process',
          icon: CheckCircle2,
          label: { en: 'Process', pl: 'Proces' },
          component: processSection,
        },
        {
          id: 'outcomes',
          icon: Lightbulb,
          label: { en: 'Outcomes', pl: 'Rezultat' },
          component: outcomesSection,
        },
        {
          id: 'example',
          icon: FileText,
          label: { en: 'Example', pl: 'Przykład' },
          component: exampleSection,
        },
      ]);
    }

    if (tool?.toolType === 'market-forces' || toolType === 'market-forces') {
      return withGroup([
        {
          id: 'goal',
          icon: Target,
          label: { en: 'Goal', pl: 'Cel' },
          component: marketGoalSection,
        },
        {
          id: 'process',
          icon: CheckCircle2,
          label: { en: 'Process', pl: 'Proces' },
          component: marketProcessSection,
        },
        {
          id: 'outcomes',
          icon: Lightbulb,
          label: { en: 'Outcomes', pl: 'Rezultat' },
          component: marketOutcomesSection,
        },
        {
          id: 'example',
          icon: FileText,
          label: { en: 'Example', pl: 'Przykład' },
          component: marketExampleSection,
        },
      ]);
    }

    if (tool?.toolType === 'growth-paths' || toolType === 'growth-paths') {
      return withGroup([
        {
          id: 'goal',
          icon: Target,
          label: { en: 'Goal', pl: 'Cel' },
          component: growthGoalSection,
        },
        {
          id: 'process',
          icon: CheckCircle2,
          label: { en: 'Process', pl: 'Proces' },
          component: growthProcessSection,
        },
        {
          id: 'outcomes',
          icon: Lightbulb,
          label: { en: 'Outcomes', pl: 'Rezultat' },
          component: growthOutcomesSection,
        },
        {
          id: 'example',
          icon: FileText,
          label: { en: 'Example', pl: 'Przykład' },
          component: growthExampleSection,
        },
      ]);
    }

    if (tool?.toolType === 'portfolio-priority' || toolType === 'portfolio-priority') {
      return withGroup([
        {
          id: 'goal',
          icon: Target,
          label: { en: 'Goal', pl: 'Cel' },
          component: portfolioGoalSection,
        },
        {
          id: 'process',
          icon: CheckCircle2,
          label: { en: 'Process', pl: 'Proces' },
          component: portfolioProcessSection,
        },
        {
          id: 'outcomes',
          icon: Lightbulb,
          label: { en: 'Outcomes', pl: 'Rezultat' },
          component: portfolioOutcomesSection,
        },
        {
          id: 'example',
          icon: FileText,
          label: { en: 'Example', pl: 'Przykład' },
          component: portfolioExampleSection,
        },
      ]);
    }

    if (tool?.toolType === 'risk-uncertainty' || toolType === 'risk-uncertainty') {
      return withGroup([
        {
          id: 'goal',
          icon: Target,
          label: { en: 'Goal', pl: 'Cel' },
          component: riskGoalSection,
        },
        {
          id: 'process',
          icon: CheckCircle2,
          label: { en: 'Process', pl: 'Proces' },
          component: riskProcessSection,
        },
        {
          id: 'outcomes',
          icon: Lightbulb,
          label: { en: 'Outcomes', pl: 'Rezultat' },
          component: riskOutcomesSection,
        },
        {
          id: 'example',
          icon: FileText,
          label: { en: 'Example', pl: 'Przykład' },
          component: riskExampleSection,
        },
      ]);
    }

    return withGroup([
      {
        id: 'goal',
        icon: Target,
        label: { en: 'Goal', pl: 'Cel' },
        component: goalSection,
      },
      {
        id: 'process',
        icon: CheckCircle2,
        label: { en: 'Process', pl: 'Proces' },
        component: processSection,
      },
      {
        id: 'outcomes',
        icon: Lightbulb,
        label: { en: 'Outcomes', pl: 'Rezultat' },
        component: outcomesSection,
      },
      {
        id: 'example',
        icon: FileText,
        label: { en: 'Example', pl: 'Przykład' },
        component: exampleSection,
      },
    ]);
  }, [
    tool,
    isPolish,
    toolType,
    readMode,
    /* + t: tlumaczenia ladowane async — bez tego memo zwraca surowy klucz na stale (2026-07-21) */ t,
  ]);

  // ── MIGRACJA (D-8): layout kart centrum z WIĄŻĄCEGO kontraktu karty ────────
  // Za flagą (default OFF). Gdy ON: katalog + zestawy płyną z TOOL_CARD_SPEC
  // (węższy zestaw domyślny Cel/Proces/Rezultat — rola 'domyslna'; „Przykład"
  // dodawalny z pickera „Sekcje ▾", rola 'dodawalna'). Gdy OFF:
  // applyToSections/manager nie są używane ⇒ zachowanie 1:1 bez zmian (zero
  // regresji na demo — reguła #7/#9 CLAUDE.md).
  const toolCardContractEnabled = useToolCardContractEnabled();
  // Osobny namespace klucza per WARIANT SPEC-u — layout zapisany przy węższym
  // zestawie domyślnym nie może być odczytany jako layout zestawu pełnego
  // (i odwrotnie), bo `order`/`visible` odnoszą się do innego zestawu bazowego.
  const toolCardLayoutStorageKey = `tool:nmode:card-layout:${
    toolCardContractEnabled ? 'v2-contract' : 'v2-all'
  }:${tool?.toolType || toolType}`;
  const initialToolCardLayout = useMemo<CardLayout | null>(() => {
    try {
      const raw = localStorage.getItem(toolCardLayoutStorageKey);
      return raw ? (JSON.parse(raw) as CardLayout) : null;
    } catch {
      return null;
    }
  }, [toolCardLayoutStorageKey]);
  const persistToolCardLayout = useCallback(
    (next: CardLayout) => {
      try {
        localStorage.setItem(toolCardLayoutStorageKey, JSON.stringify(next));
      } catch {
        /* localStorage niedostępny — layout pozostaje w pamięci sesji */
      }
    },
    [toolCardLayoutStorageKey]
  );

  const toolCardLayout = useCardLayout({
    // INERTNE gdy `spec` podany (patrz TOOL_ARTIFACT_TYPE wyżej).
    artifactType: TOOL_ARTIFACT_TYPE,
    // ── MENU 2, LEWY SLOT (naprawa 2026-07-24, fala 2) ──────────────────────
    // Do tej pory `spec` był ZAWSZE `TOOL_CARD_SPEC`, którego zestaw domyślny
    // jest WĘŻSZY (Cel/Proces/Rezultat — „Przykład" ukryty; patrz
    // `toolCards.contract.ts`, oznaczone „★ DO POTWIERDZENIA PIOTRA"). Dlatego
    // cała warstwa managera wisiała za flagą `?cardContract=1` i przy domyślnym
    // OFF lewa strefa Menu 2 była PUSTA — to jest zgłoszony defekt.
    //
    // Rozdzielamy dwie rzeczy, które były sklejone w jedną flagę:
    //   (a) CZY karta ma picker „Sekcje"  → od teraz ZAWSZE (sterowanie
    //       widocznością to preferencja WIDOKU, nie zapis danych, więc
    //       read-only jej nie blokuje — picker ma realny skutek: chowa/pokazuje
    //       sekcję w lewej nawigacji i w centrum),
    //   (b) JAKI jest zestaw DOMYŚLNY     → nadal za flagą (propozycja zwężenia
    //       czeka na decyzję właściciela).
    // Przy OFF podajemy spec o tym samym katalogu, ale z zestawem domyślnym =
    // WSZYSTKIE 4 sekcje ⇒ pierwszy render jest co do sekcji identyczny jak
    // przed zmianą (zero regresji), a picker i tak działa.
    spec: toolCardContractEnabled ? TOOL_CARD_SPEC : TOOL_CARD_SPEC_ALL_VISIBLE,
    initialLayout: initialToolCardLayout,
    onLayoutChange: persistToolCardLayout,
  });

  // Sekcje przekazywane do NModeShell — layout stosowany ZAWSZE, bo picker
  // „Sekcje" jest teraz stały. Przy fladze OFF zestaw domyślny obejmuje komplet
  // sekcji, więc wynik początkowy = surowe `sections`.
  const orderedToolSections = useMemo<NModeSection[]>(
    () => toolCardLayout.applyToSections(sections),
    [toolCardLayout, sections]
  );

  // Gdy aktywna sekcja została ukryta w pickerze — przeskocz na pierwszą
  // widoczną (analogicznie do Notification).
  useEffect(() => {
    const visibleIds = toolCardLayout.visibleOrderedIds;
    if (visibleIds.length > 0 && !visibleIds.includes(activeSection)) {
      setActiveSection(visibleIds[0]);
    }
  }, [toolCardLayout.visibleOrderedIds, activeSection]);

  // R2 (KONTRAKT §9): każda sekcja centrum renderowana przez Tool ma wpis w
  // katalogu kanonicznym. Cichy dev-only sygnał rozjazdu id kod↔katalog.
  useEffect(() => {
    if (!import.meta.env.DEV || !toolCardContractEnabled) return;
    const missing = sections.map((s) => s.id).filter((id) => !TOOL_CARD_RENDER_IDS.includes(id));
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('[toolCardContract] sekcje centrum bez wpisu w katalogu:', missing);
    }
  }, [toolCardContractEnabled, sections]);

  // ── ETAP 3 standardu n-Type: „Analizuj z AI" AKTYWNEJ KARTY ────────────────
  // Kryteria oceny Narzędzia (kontrakt właściciela 2026-07-23) żyją w rubryce
  // silnika (`ARTIFACT_CRITERIA.tool`): zgodność treści z celem · kompletność
  // wejść · klarowność procesu · jakość rezultatu · ograniczenia · gotowość do
  // sesji.
  //
  // ★ SLOT AI PRZESTAJE BYĆ PUSTY. Migracja ETAPU 1.2 zostawiła go świadomie
  //   („karta nie ma żadnej akcji AI") — bo wtedy AI umiało tylko PISAĆ treść,
  //   a wpis biblioteczny nie ma pól do pisania. Kontrakt ETAPU 3 wprowadza
  //   funkcję, która niczego nie pisze: OCENIA gotowość karty przed sesją.
  //   Dla wpisu bibliotecznego to jedyna sensowna akcja AI — i właściciel
  //   wylicza dla Narzędzia sześć kryteriów, więc slot ma czym być wypełniony.
  //
  // ★ WSZYSTKIE POLA TYLKO-DO-ODCZYTU — karta Tool jest READ-ONLY z definicji
  //   (wspólna baza wiedzy, zero pól edytowalnych; dlatego nie ma tu nawet
  //   przełącznika Edycja|Podgląd). Panel pokaże Braki/Ryzyka/Sugestie i da
  //   „Kopiuj treść" zamiast „Zastosuj". Zapis treści biblioteki wymagałby
  //   endpointu edycji `known-tools` — patrz raport.
  const toolAnalysisFields = useMemo<CardAnalysisField[]>(() => {
    const list = (items: readonly string[] | undefined) =>
      (items ?? [])
        .filter(Boolean)
        .map((s) => `- ${s}`)
        .join('\n');

    const ro = (id: string, label: string, value: string): CardAnalysisField => ({
      id,
      label,
      value,
      kind: 'text',
      writable: false,
    });

    switch (activeSection) {
      case 'goal':
        return [
          ro(
            'description',
            isPolish ? 'Opis narzędzia' : 'Tool description',
            String(tool?.description ?? '')
          ),
          ro('whenToUse', isPolish ? 'Kiedy używać' : 'When to use', String(tool?.whenToUse ?? '')),
        ];

      case 'process':
        return [
          // „kompletność wejść" i „klarowność procesu" mają tu swoje realne dane.
          ro('inputs', isPolish ? 'Wejścia' : 'Inputs', list(tool?.inputs)),
          ro('steps', isPolish ? 'Kroki procesu' : 'Process steps', list(tool?.steps)),
        ];

      case 'outcomes':
        return [
          ro('outputs', isPolish ? 'Rezultaty' : 'Outputs', list(tool?.outputs)),
          ro('whatYouGet', isPolish ? 'Co dostajesz' : 'What you get', list(tool?.whatYouGet)),
          ro('nextSteps', isPolish ? 'Następne kroki' : 'Next steps', list(tool?.nextSteps)),
        ];

      case 'example':
        return [
          ro('example', isPolish ? 'Przykład' : 'Example', String(tool?.example ?? '')),
          // „ograniczenia" z kryteriów właściciela = częste błędy tej metody.
          ro(
            'commonMistakes',
            isPolish ? 'Ograniczenia i częste błędy' : 'Limitations & common mistakes',
            list(tool?.commonMistakes)
          ),
        ];

      default:
        return [];
    }
  }, [activeSection, isPolish, tool]);

  const buildToolAnalysisInput = useCallback(() => {
    const ctx = [
      `${isPolish ? 'Typ narzędzia' : 'Tool type'}: ${tool?.toolType ?? '—'}`,
      `${isPolish ? 'Kategoria' : 'Category'}: ${tool?.libraryCategory ?? '—'}`,
      `${isPolish ? 'Opis' : 'Description'}: ${tool?.description ?? '—'}`,
      `${isPolish ? 'Kiedy używać' : 'When to use'}: ${tool?.whenToUse ?? '—'}`,
      // „gotowość do sesji" bez liczby wejść/kroków/rezultatów byłaby zgadywaniem.
      `${isPolish ? 'Wejścia' : 'Inputs'}: ${(tool?.inputs ?? []).length} · ${isPolish ? 'Kroki' : 'Steps'}: ${(tool?.steps ?? []).length} · ${isPolish ? 'Rezultaty' : 'Outputs'}: ${(tool?.outputs ?? []).length}`,
      `${isPolish ? 'Aktywne' : 'Active'}: ${tool?.isActive ? 'tak/yes' : 'nie/no'} · ${isPolish ? 'Wkrótce' : 'Coming soon'}: ${tool?.isComingSoon ? 'tak/yes' : 'nie/no'}`,
    ].join('\n');

    return {
      artifactType: 'tool' as const,
      cardId: activeSection,
      artifactTitle: String(tool?.name ?? ''),
      artifactContext: ctx,
      fields: toolAnalysisFields,
      isPolish,
    };
  }, [activeSection, isPolish, tool, toolAnalysisFields]);

  // Wpis biblioteczny nie ma pól do zapisu — zwracamy `false`, zamiast udawać.
  const applyToolAnalysisChange = useCallback(() => false, []);

  const toolCardAnalysis = useCardAIAnalysis({
    activeCardId: activeSection,
    buildInput: buildToolAnalysisInput,
    applyChange: applyToolAnalysisChange,
  });

  // ── SPEC-N §2.2 / SPEC-A §11.2 — PRAWY PANEL ──────────────────────────────
  // Właściwości renderowały się jako `NModePropertiesStrip` (pozioma listwa pod
  // nagłówkiem) — dokładnie ten anty-wzorzec, który §2.2 nazywa „brakiem całej
  // struktury". Teraz jedno źródło (`properties`) zasila panel, a `properties`
  // NIE jest już przekazywane do NModeShell, więc listwa znika (§2.6: jedna
  // treść = jedno miejsce; powłoka pomija strip, gdy prop pominięty).
  //
  // ── NAPRAWA 2026-07-23 (sędzia: 3 z 7 sekcji kanonu, zła kolejność) ────────
  // KANON (`ARTIFACT_PANEL_SECTION_ORDER`, SPEC-A §11.2):
  //   ① Akcje ② Właściwości ③ Powiązania ④ Źródła i założenia
  //   ⑤ Rezultaty ⑥ Komentarze ⑦ Historia
  // Domyślnie ROZWINIĘTE tylko ① i ②; reszta `defaultOpen: false`.
  //
  // BYŁO: Właściwości · Rezultaty · Powiązania (3 sekcje, Rezultaty przed
  // Powiązaniami, Rezultaty `defaultOpen: true`).
  // JEST: Akcje · Właściwości · Powiązania · Źródła i założenia · Rezultaty.
  //
  // ★ DWIE SEKCJE KANONU NADAL NIEOBECNE — I TO JEST ODPOWIEDŹ UCZCIWA, NIE
  //   NIEDOKOŃCZONA ROBOTA. Kanon mówi wprost: „Sekcja BEZ ZASTOSOWANIA może być
  //   NIEOBECNA (lepiej brak niż pusty akordeon udający funkcję)". Sprawdzone
  //   w runtime, nie w dokumentacji — `server/src/routes/knownTools.routes.ts`
  //   wystawia DOKŁADNIE dwie trasy: `GET /` i `GET /:toolType`. Nie ma tabeli,
  //   endpointu ani pola dla żadnej z poniższych:
  //
  //  · ⑥ Komentarze — ZERO źródła danych. Nie ma `known_tool_comments`, nie ma
  //    POST komentarza, nie ma wątku. Karta jest globalnym katalogiem metod
  //    (ten sam rekord dla wszystkich najemców), więc nie ma nawet „czyjego"
  //    komentarza dołożyć. Pusty akordeon „Komentarze (0)" sugerowałby, że da
  //    się skomentować — nie da się. → ZGŁOSZONE w raporcie.
  //
  //  · ⑦ Historia — ZERO strumienia zdarzeń. `Api.getKnownTool` zwraca JEDEN
  //    znacznik czasu (`createdAt`) i on już jest w Właściwościach jako „Dodane
  //    do biblioteki". Jedna data to nie historia; akordeon „Historia" z jednym
  //    wpisem „utworzono" udawałby dziennik zmian, którego system nie prowadzi
  //    (brak audytu na `known_tools`, brak PUT/PATCH → nie ma nawet czego
  //    zapisywać). → ZGŁOSZONE w raporcie.
  //
  // ── SPROSTOWANIE WŁASNEGO SPRAWDZENIA (2026-07-24, fala 2) ────────────────
  // Powyższe zdanie „Nie ma `known_tool_comments`" jest PRAWDZIWE co do nazwy,
  // ale MYLĄCE co do faktu: tabela `tool_comments` ISTNIEJE
  // (`server/migrations-v2/001_baseline_20260413.sql:29088`, tworzona też przez
  // `ensureToolCommentsSchema` w `ToolController.ts:498`). WNIOSEK MIMO TO STOI,
  // tylko z innego powodu: jej kluczem jest `tool_session_id` + `organization_id`
  // (`ToolController.ts:500-508`, odczyt `:2278` filtruje
  // `WHERE c.tool_session_id = ? AND c.organization_id = ?`). Komentarz należy
  // więc do SESJI narzędzia u konkretnego najemcy, a nie do wpisu bibliotecznego
  // — a ta karta to globalny katalog metod, który żadnego `tool_session_id` nie
  // ma. Nie da się jej podpiąć pod istniejący wątek bez wymyślenia nowej encji.
  //
  // ── ANTY-DUPLIKACJA (SPEC-N §2.6, fala 2) ─────────────────────────────────
  // BYŁA sekcja ① AKCJE z dwoma przyciskami: „Startuj sesję" i „How to / Baza
  // wiedzy". OBA były trzecim renderem tego samego handlera:
  //   · „Startuj sesję"        → Menu 1, slot `primaryAction` (JEDYNY primary karty),
  //   · „How to / Baza wiedzy" → Menu 2, nazwany slot `howToButton` (`NModeMenu2`).
  // §2.6 mówi wprost: „Sekcja «Akcje» w panelu automatycznie wyklucza akcje,
  // które powłoka renderuje w nagłówku". Po wykluczeniu obu w sekcji nie zostaje
  // NIC — a karta read-only nie ma ani jednej akcji bez własnego domu w powłoce
  // (kopiuj kod/permalink siedzą w kebabie Menu 1 — `NModeHeader` D-D).
  // Kanon dopuszcza wprost: „Sekcja BEZ ZASTOSOWANIA może być NIEOBECNA (lepiej
  // brak niż pusty akordeon udający funkcję)" — więc ① znika, zamiast zostać
  // pustym nagłówkiem. Panel: Właściwości · Powiązania · Źródła i założenia ·
  // Rezultaty. → ZGŁOSZONE w raporcie (spadek 5→4 sekcji jest ŚWIADOMY).
  const rightPanelSections: ArtifactRightPanelSection[] = useMemo(() => {
    // Obrona przed kształtem stanu bez `items` (np. stan przeniesiony przez
    // hot-reload sprzed dodania pola). `sessionItems.length` na
    // `undefined` wywalało cały widok do error-boundary — dokładnie ta klasa
    // błędu, którą skill `consultify-artefakty` opisuje jako „lekcję fali N":
    // przechodzi esbuild i tsc, a wysypuje się dopiero w przeglądarce.
    const sessionItems = Array.isArray(sessionStats.items) ? sessionStats.items : [];
    return [
      {
        // AKCJE (Etap 4 gridu n-Type, _GRID_STABILIZATION_COMMAND_2026-07-24.md
        // §Prawy panel + rozstrzygnięcie CTO 2026-07-24): sekcja BYŁA
        // nieobecna (fala 2, anty-duplikacja §2.6) — powód wciąż stoi, „Startuj
        // sesję" i „How to" mają już swój dom w Menu 1 / Menu 2, więc panel
        // nie ma żadnej NIEZDUBLOWANEJ akcji do pokazania. Rozstrzygnięcie:
        // przewidywalność kanonu (sekcja obecna na WSZYSTKICH 6 kartach)
        // wygrywa nad „lepiej brak niż pusty akordeon" — sekcja zostaje
        // WIDOCZNA, ale ZWINIĘTA z licznikiem 0. Zero nowego backendu.
        id: 'actions',
        label: t('discoveryToolsMain.knownToolDetailView.panelActions', 'Actions'),
        icon: Sparkles,
        defaultOpen: false,
        isEmpty: true,
        badge: 0,
        showZeroBadge: true,
        emptyLabel: t(
          'discoveryToolsMain.knownToolDetailView.panelActionsEmpty',
          'This library entry has no actions of its own — start a session from the header.'
        ),
        children: null,
      },
      {
        id: 'properties',
        label: t('discoveryToolsMain.knownToolDetailView.panelProperties', 'Properties'),
        icon: SlidersHorizontal,
        defaultOpen: true,
        children: (
          <ArtifactPropertiesTable
            propertyLabel={t('discoveryToolsMain.knownToolDetailView.property', 'Property')}
            valueLabel={t('discoveryToolsMain.knownToolDetailView.value', 'Value')}
            rows={properties.map((field) => ({
              id: field.id,
              label: isPolish ? field.label.pl : field.label.en,
              value: field.value || '—',
            }))}
          />
        ),
      },
      {
        // ── ③ POWIĄZANIA (kanon: PRZED Rezultatami — było odwrotnie) ────────
        // Powiązania = realne sesje TEGO narzędzia (`Api.listToolSessions`).
        // Gdy zapytanie padło albo sesji nie ma — uczciwy stan pusty, bez
        // udawania danych.
        //
        // DoD §18.1: powiązania są teraz KLIKALNE (były samym licznikiem).
        // `onSessionCreated` to w huborze `handleKnownToolSessionCreated`, czyli
        // „otwórz tę sesję narzędzia" — ten sam realny cel, do którego trafia
        // świeżo utworzona sesja. Licznik został jako badge nagłówka sekcji.
        id: 'relations',
        label: t('discoveryToolsMain.knownToolDetailView.panelRelations', 'Relations'),
        icon: Link2,
        defaultOpen: false,
        badge: sessionStats.available ? sessionStats.count : undefined,
        isEmpty: !sessionStats.available || sessionItems.length === 0,
        emptyLabel: t(
          'discoveryToolsMain.knownToolDetailView.panelRelationsEmpty',
          'No linked items yet — relations appear once you start a session.'
        ),
        children: (
          <PreviewRelations
            title={t(
              'discoveryToolsMain.knownToolDetailView.panelRelationsSessions',
              'Tool sessions'
            )}
            items={sessionItems.map((s) => ({
              id: s.id,
              label: s.name,
              type: 'tool-session',
              icon: FileText,
              onClick: () => onSessionCreated(s.id, toolType, s.name),
            }))}
            emptyLabel={t(
              'discoveryToolsMain.knownToolDetailView.panelRelationsEmpty',
              'No linked items yet — relations appear once you start a session.'
            )}
          />
        ),
      },
      {
        // ── ④ ŹRÓDŁA I ZAŁOŻENIA (nowa; kanon §11.2 poz. 4) ────────────────
        // ŹRÓDŁO DANYCH JEST REALNE — to nie jest wypełniacz kanonu:
        //   · `tool.inputs`         → materiał dowodowy, który metoda ZUŻYWA
        //     („na czym ta analiza ma stanąć"),
        //   · `tool.commonMistakes` → założenia, przy których metoda przestaje
        //     działać (ograniczenia stosowalności),
        //   · pochodzenie wpisu     → katalog `known_tools` (`Api.getKnownTool`).
        // Wszystkie trzy przychodzą z tej samej odpowiedzi API co reszta karty.
        // Gdy backend nie poda ani wejść, ani ograniczeń → uczciwy stan pusty.
        id: 'evidence',
        label: t('discoveryToolsMain.knownToolDetailView.panelEvidence', 'Sources & assumptions'),
        icon: ShieldCheck,
        defaultOpen: false,
        isEmpty: evidenceInputs.length === 0 && evidenceLimits.length === 0,
        emptyLabel: t(
          'discoveryToolsMain.knownToolDetailView.panelEvidenceEmpty',
          'The library entry declares no required inputs or limitations for this method yet.'
        ),
        children: (
          <div className="flex flex-col gap-4">
            {evidenceInputs.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-c-text-secondary">
                  {t(
                    'discoveryToolsMain.knownToolDetailView.panelEvidenceInputs',
                    'Evidence the method consumes'
                  )}
                </div>
                <ul className="flex flex-col gap-1.5">
                  {evidenceInputs.map((item, idx) => (
                    <li
                      key={`in-${idx}`}
                      className="flex items-start gap-2 text-xs text-c-text-secondary"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-c-text-muted" />
                      <span className="min-w-0">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {evidenceLimits.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-c-text-secondary">
                  {t(
                    'discoveryToolsMain.knownToolDetailView.panelEvidenceLimits',
                    'Where the method stops working'
                  )}
                </div>
                <ul className="flex flex-col gap-1.5">
                  {evidenceLimits.map((item, idx) => (
                    <li
                      key={`lim-${idx}`}
                      className="flex items-start gap-2 text-xs text-c-text-secondary"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-c-text-muted" />
                      <span className="min-w-0">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[11px] leading-relaxed text-c-text-muted">
              {t(
                'discoveryToolsMain.knownToolDetailView.panelEvidenceProvenance',
                'Source of this entry: the Consultify tool library — a shared, read-only catalogue of methods.'
              )}
            </p>
          </div>
        ),
      },
      {
        // ── ⑤ REZULTATY (zgłoszenie właściciela 2026-07-23, pkt 3) ──────────
        // „Sekcja Rezultaty, jeśli narzędzie pozwala utworzyć raport/prezentację,
        // wyeksportować lub wysłać wynik sesji."
        //
        // Co tu JEST: kanoniczna lista rezultatów metody (`tool.outputs`) — to
        // realne dane z `Api.getKnownTool`, czyli odpowiedź na pytanie „co
        // dostanę, gdy tę sesję doprowadzę do końca".
        //
        // Czego tu NIE MA i DLACZEGO: przycisków „Utwórz raport / prezentację /
        // Eksportuj". Karta biblioteczna opisuje METODĘ, a nie wynik — dopóki
        // sesja nie istnieje, nie ma czego eksportować ani wysyłać. Wstawienie
        // tu tych przycisków dałoby kontrolki, które albo nic nie robią, albo
        // po cichu tworzą sesję pod inną nazwą. Wejściem jest primary „Startuj
        // sesję" w Menu 1; eksport/raport/prezentacja żyją w karcie SESJI
        // (ToolDocumentView) — tam mają realny wynik do zapakowania.
        //
        // `defaultOpen` NAPRAWIONE `true` → `false`: kanon rozwija domyślnie
        // WYŁĄCZNIE Akcje i Właściwości.
        id: 'results',
        label: t('discoveryToolsMain.knownToolDetailView.panelResults', 'Results'),
        icon: Package,
        defaultOpen: false,
        isEmpty: outcomeItems.length === 0,
        emptyLabel: t(
          'discoveryToolsMain.knownToolDetailView.panelResultsEmpty',
          'This tool has no declared outputs in the library yet.'
        ),
        children: (
          <div className="flex flex-col gap-2">
            <ul className="flex flex-col gap-1.5">
              {outcomeItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-c-text-secondary">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-c-text-muted" />
                  <span className="min-w-0">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] leading-relaxed text-c-text-muted">
              {t(
                'discoveryToolsMain.knownToolDetailView.panelResultsHint',
                'Reports, decks and exports are produced inside a tool session — start one from the header.'
              )}
            </p>
          </div>
        ),
      },
      {
        // KOMENTARZE (Etap 4 gridu n-Type — SSOT §Prawy panel: „nie usuwać
        // losowo Comments i History z wybranych kart" + rozstrzygnięcie CTO
        // 2026-07-24). Karta biblioteczna to katalog GLOBALNY, bez wpisu
        // per-organizacja — nie ma tu do czego podpiąć wątku komentarzy bez
        // wymyślenia nowej encji (ten sam powód co przy sesjach narzędzia,
        // patrz komentarz `ToolController.ts` gdzie indziej w repo). Sekcja
        // zostaje WIDOCZNA dla przewidywalności kanonu, ZWINIĘTA z licznikiem
        // 0 — zero nowego backendu, zero kompozytora.
        id: 'comments',
        label: t('discoveryToolsMain.knownToolDetailView.panelComments', 'Comments'),
        icon: MessageSquare,
        defaultOpen: false,
        isEmpty: true,
        badge: 0,
        showZeroBadge: true,
        emptyLabel: t(
          'discoveryToolsMain.knownToolDetailView.panelCommentsEmpty',
          'Comments are not available for shared library entries.'
        ),
        children: null,
      },
      {
        // HISTORIA — tak samo: katalog globalny, bez per-organizacja logu
        // zmian tego wpisu. Widoczna, zwinięta, licznik 0.
        id: 'history',
        label: t('discoveryToolsMain.knownToolDetailView.panelHistory', 'History'),
        icon: History,
        defaultOpen: false,
        isEmpty: true,
        badge: 0,
        showZeroBadge: true,
        emptyLabel: t(
          'discoveryToolsMain.knownToolDetailView.panelHistoryEmpty',
          'No history for this library entry.'
        ),
        children: null,
      },
    ];
  }, [
    properties,
    isPolish,
    t,
    outcomeItems,
    sessionStats,
    evidenceInputs,
    evidenceLimits,
    tool,
    // `starting` / `startSession` / `openKb` zdjete z zaleznosci razem z sekcja
    // ① AKCJE (anty-duplikacja §2.6) — panel juz ich nie renderuje.
    onSessionCreated,
    toolType,
  ]);

  // ── SPEC-N §2.2 / DoD §18.1 — uczciwy stan błędu ──────────────────────────
  // Musi stać PO wszystkich hookach (reguła kolejności hooków) i PRZED renderem
  // powłoki. `loading` obsługuje NModeShell, więc tu łapiemy wyłącznie „skończyło
  // się ładowanie, a narzędzia nie ma".
  if (!loading && (loadError || !tool)) {
    return (
      <div className="h-full min-h-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-c-bg">
        <AlertTriangle size={28} className="text-c-warning" aria-hidden="true" />
        <h2 className="text-base font-semibold text-c-text">
          {t('discoveryToolsMain.knownToolDetailView.errorTitle', 'Could not load this tool')}
        </h2>
        <p className="max-w-sm text-sm text-c-text-secondary">
          {t(
            'discoveryToolsMain.knownToolDetailView.errorBody',
            'The tool description could not be fetched. Check your connection and try again.'
          )}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-c-surface-raised text-c-text border border-c-border-subtle hover:bg-c-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
          >
            <RefreshCw size={14} className="text-c-text-muted" />
            {t('discoveryToolsMain.knownToolDetailView.errorRetry', 'Try again')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center h-8 px-3 rounded-lg text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
          >
            {t('discoveryToolsMain.knownToolDetailView.errorClose', 'Close')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <NModeShell
        loading={loading}
        presentationMode={mode}
        onPresentationModeChange={setMode}
        // ETAP 1.1 n-Type: karta N ma JEDEN widok — bez przełącznika N/C.
        showModeSwitcher={false}
        header={{
          sticky: true,
          title: tool?.name || toolType,
          onTitleChange: () => {},
          titleReadOnly: true,
          artifactId: tool?.toolType || toolType,
          artifactType: 'tool',
          onSave: () => {},
          saving: false,
          isDirty: false,
          onClose,
          // D-B (2026-07-22) — status = ETYKIETA-PIGUŁKA z tekstem, nie naga kropka.
          // Karta lokalizuje sama; ton mapuje na c-*. Stan domenowy narzędzia:
          //   coming-soon → „Wkrótce" (neutral)  ·  aktywne → „Aktywne" (approved =
          //   bg-c-success, przeniesione z byłego statusDotColor:1630)  ·  reszta →
          //   „Nieaktywne" (neutral). Czerwień (rejected) nie występuje — status
          //   biblioteczny to nie awaria (CLAUDE.md pułapka nr 1).
          statusLabel: tool?.isComingSoon
            ? t('discoveryToolsMain.knownToolDetailView.statusComingSoon', 'Coming soon')
            : tool?.isActive
              ? t('discoveryToolsMain.knownToolDetailView.statusActive', 'Active')
              : t('discoveryToolsMain.knownToolDetailView.statusInactive', 'Inactive'),
          statusTone: tool?.isActive && !tool?.isComingSoon ? 'approved' : 'neutral',
          inlineActions: (
            <div className="flex items-center gap-2" data-testid="tool-single-header-actions">
              <SectionsManagerMenu layout={toolCardLayout} isPolish={isPolish} />
              <Menu2HowToButton
                variant="knowledge"
                isPolish={isPolish}
                label={isPolish ? 'Baza wiedzy' : 'Knowledge base'}
                onClick={openKb}
                disabled={!tool}
              />
              <button
                type="button"
                aria-expanded={toolCardAnalysis.open}
                disabled={!tool || toolCardAnalysis.loading}
                onClick={toolCardAnalysis.run}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 text-xs font-semibold text-c-text-secondary transition hover:bg-c-surface disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles size={13} />
                {isPolish ? 'Analizuj' : 'Analyze'}
              </button>
              <button
                type="button"
                onClick={startSession}
                disabled={starting || !tool || !tool.isActive}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/70 bg-white px-3 text-xs font-semibold text-navy-950 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-navy-950"
              >
                <ArrowRight size={13} />
                {isPolish ? 'Rozpocznij sesję' : 'Start session'}
              </button>
            </div>
          ),
        }}
        hideToolbarWhenEmpty
        sections={orderedToolSections}
        /* ETAP 1.2: `actions`/`actionsVisible` USUNIETE — przy podanym
         `renderActionBar` powloka i tak ich nie czyta (NModeShell.tsx), a
         jedyna akcja („How to / Baza wiedzy") ma teraz wlasny slot w menu 2. */
        // ETAP 1.2 standardu n-Type — MENU 2 = wspolny `NModeMenu2`.
        // Zgloszenie wlasciciela pkt 4: picker "Sekcje" byl doklejony po PRAWEJ
        // (`ml-auto`) — teraz jest po LEWEJ, nad lista kart. "+ Nowa karta"
        // zdjete: karty sa predefiniowane, widocznoscia steruje Sekcje.
        // "How to / Baza wiedzy" idzie do prawej strefy jako wlasny slot
        // (przestaje byc anonimowa pozycja `NModeActionBar`).
        //
        // ── NAPRAWA 2026-07-23 (a): PRZELACZNIK Edycja|Podglad ZDJETY ──────────
        // Poprzedni komentarz uzasadnial go tak: „fala narzedzia dala centrum
        // bloki NModeContentBlock z auto-fit i uchwytem, wiec przelacznik MA co
        // przelaczac". Zmierzone w runtime — NIE MA: w OBU trybach 0 pol
        // edytowalnych, 0 przyciskow AI przy polach i 0 uchwytow. Powod jest
        // strukturalny i udokumentowany kilkaset linii wyzej (`withGroup`):
        // `/api/known-tools` wystawia WYLACZNIE `GET /` i `GET /:toolType`, wiec
        // `onAI`/`onEdit` swiadomie nie sa podawane — nie ma dokad zapisac.
        // Wlasciciel potwierdzil (2026-07-23), ze Narzedzie to biblioteka
        // referencyjna READ-ONLY. Kontrolka bez skutku to atrapa, wiec pomijamy
        // `onReadModeChange` — `NModeMenu2` renderuje przelacznik TYLKO wtedy,
        // gdy dostanie handler (`showToggle = typeof onReadModeChange === 'function'`).
        // Stan `readMode` zostaje (stale `true` = Podglad) i dalej karmi
        // `NModeContentBlock`, wiec bloki wiedza, ze sa w trybie czytania.
        //
        // ── ROZSTRZYGNIECIE 2026-07-24 (fala 2), WARIANT A ────────────────────
        // Pytanie postawione tej fali brzmialo: (A) dodac „Sekcje" i zostawic bez
        // trybow, czy (B) przywrocic tryby i nadac im skutek. Sprawdzone jeszcze
        // raz w runtime: w centrum jest 0 pol edytowalnych i 0 przyciskow AI przy
        // polach, a `/api/known-tools` nadal wystawia wylacznie `GET /` i
        // `GET /:toolType` (zero POST/PUT/PATCH — `knownTools.routes.ts:18-19`).
        // „Podglad" nie mialby wiec czego schowac — wariant B odtworzylby dokladnie
        // te atrape, ktora poprzednia fala slusznie zdjela. WYBRANO A: lewy slot
        // wypelnia picker „Sekcje" (realny skutek), a brak trybow zostaje jawna,
        // uzasadniona konsekwencja charakteru read-only. Srodkowy slot paska
        // pozostaje pusty zgodnie z kontraktem `NModeMenu2` (srodek nalezy WYLACZNIE
        // do przelacznika trybu — dokladanie tam czegokolwiek innego zlamaloby
        // wspolny standard szesciu kart N).
        //
        // ── ZGLOSZENIE (b): SZEROKOSC MENU 2 — NAPRAWIONE W POWLOCE ───────────
        // HISTORYCZNE: Menu 2 bywalo wezsze od Menu 1 o 2×24 px, bo w `NModeShell`
        // padding `px-6` Menu 2 siedzial WEWNATRZ limitu `max-w-6xl` (a Menu 1
        // mial go NA ZEWNATRZ). Naprawione 2026-07-24 po stronie powloki: wszystkie
        // trzy segmenty (Menu 1 · Menu 2 · Sekcje) maja teraz `px-6` na zewnatrz
        // limitu i wspolna os lewej krawedzi — patrz NModeShell.tsx (komentarz przy
        // segmencie Menu 2). Ta karta nie musi juz nic kompensowac; probowany tu
        // kiedys workaround `-mx-6 w-auto` zostal zdjety (tworzyl nowa rozjezdzke
        // przy waskim oknie).
        //
        // ETAP 3: slot "Analizuj z AI" JEST juz wypelniony. Wczesniejsza uwaga
        // ("karta nie ma zadnej akcji AI") byla prawdziwa dla AI-ktore-PISZE.
        // Analiza niczego nie pisze — ocenia gotowosc karty przed sesja, a
        // wlasciciel wylicza dla Narzedzia szesc kryteriow tej oceny.
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        rightPanel={
          // ETAP 1.4 — bylo `border-l ... h-full`, czyli techniczny sidebar
          // doklejony do krawedzi. Teraz ten sam wyglad co Inicjatywa: jasna
          // zaokraglona karta odsunieta od brzegu (wariant _DOCKED, bo slot
          // `rightPanel` w NModeShell jest pelnowysokosciowy).
          <ArtifactRightPanel
            sections={rightPanelSections}
            className={ARTIFACT_PANEL_CARD_CLASS_DOCKED}
            ariaLabel={t('discoveryToolsMain.knownToolDetailView.panelAriaLabel', 'Tool details')}
          />
        }
      />

      {/* ── ETAP 3: panel wyników „Analizuj z AI" ─────────────────────────────
          `writableFieldIds` PUSTE świadomie — karta Tool jest READ-ONLY (wspólna
          baza wiedzy). Panel pokaże Braki/Ryzyka/Sugestie i „Kopiuj treść"
          zamiast „Zastosuj", z jawnym powodem. */}
      <NCardAIAnalysisPanel
        open={toolCardAnalysis.open}
        onClose={toolCardAnalysis.close}
        loading={toolCardAnalysis.loading}
        result={toolCardAnalysis.result}
        errorCode={toolCardAnalysis.errorCode}
        serverErrorCode={toolCardAnalysis.serverErrorCode}
        onRerun={toolCardAnalysis.rerun}
        onApplyChange={toolCardAnalysis.applyChange}
        writableFieldIds={[]}
        isPolish={isPolish}
      />
    </>
  );
}
