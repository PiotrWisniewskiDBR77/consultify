/**
 * NotebookRightRail — SPEC-A accordion rail for the Notebook document artifact.
 *
 * DEC-2026-08-25-69 ("prawe menu rozwijane pochodzi z wersji aplikacji sprzed
 * pół roku"): the previous Work/Context tab pair implemented the correct
 * information split (document record vs. living relationships) but never
 * adopted the shared right-panel canon (`ArtifactRightPanel`,
 * Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §9.1a/§11.2) — 360px,
 * accordion sections in a fixed order, hairline dividers, no bespoke tablist.
 * This rewrite keeps every governance control and every Context relation
 * 1:1, but presents them as accordion sections instead of tabs:
 *
 *   Akcje · Właściwości (was "Work") · Powiązania (was "Context")
 *   · Źródła i założenia (2026-08-30 — sekcja kanonu, której brakowało)
 *   · Komentarze (new, empty placeholder — no comment system on notes yet)
 *   · Historia (version history + "Open Teresa"); nazwa BEZ dopisku „i AI" —
 *     SSOT nazw = `ARTIFACT_PANEL_SECTION_LABELS`
 *
 * State (open/tab) is still owned by the caller for the `open`/`activeTab`
 * props — `activeTab` now means "which section an external caller wants
 * revealed" (properties for 'work', relations for 'context') rather than
 * "which tab is exclusively visible"; both sections can be open together.
 */
import type { Editor } from '@tiptap/react';
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Copy,
  Download,
  Eye,
  History,
  Layers,
  ListTree,
  Loader2,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Tag,
  UserRound,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ARTIFACT_PANEL_SECTION_LABELS,
  ARTIFACT_PANEL_SECTION_ORDER,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import {
  type ArtifactRailTeresaCommand,
  type ArtifactRailTypeMode,
  ArtifactRightRail,
} from '@/components/standard/ArtifactRightRail';
import type { NotebookPage } from '@/types/myWork';
import { isArtifactRightRailEnabled } from '@/utils/artifactRightRailFlag';

import type { ConvertTarget } from './AIChatInlinePanel';
import { NotebookContextPanel } from './NotebookContextPanel';
import { isNotebookSpecAShellEnabled } from './notebookSpecAShellFlag';
import { IdeaNotebookRightPanelPrototypeGate } from '../prototypes/IdeaNotebookRightPanelPrototype';

interface NotebookRailPage {
  id: string;
  maturity: 'seed' | 'growing' | 'mature' | 'actionable';
  summary?: string | null;
  updatedAt?: string | null;
  visibility?: 'private' | 'project' | null;
  projectId?: string | null;
  wordCount: number;
}

// Kolejność sekcji czytana z kanonu (`ARTIFACT_PANEL_SECTION_ORDER`), nie
// z własnej kopii.
//
// ★ NAPRAWA 2026-08-30 (przegląd `PRZEGLAD_PRZED_ODBIOREM.md` §Z-2): notatnik
// pomijał 'evidence' („Źródła i założenia") i nazywał ostatnią sekcję
// „Historia i AI". Sekcja kanonu nie może zniknąć dlatego, że jest pusta —
// mówi wprost, że jest pusta. Ta ścieżka (flaga `ff_notebookSpecAShell` OFF)
// renderuje własny akordeon, więc domknięcie z `ArtifactRightPanel` jej nie
// dosięga; nazwy bierze jednak z TEGO SAMEGO źródła co powłoka.
// 'results' zostaje pominięte — notatka nic nie produkuje (kanon: sekcja
// warunkowa).

/**
 * ★ NAPRAWA (2026-08-30, dyżur 131-noc-moja-praca): stopka sekcji AKCJE
 * pokazywała „Źródło: manual" — surowy `activePage.captureSource` wprost
 * bez etykiety (linia ~706, poniżej). `getNotebookUploadSourceSummary()`
 * (notebookCaptureSourceSummary.ts) już rozwiązuje ten problem dla
 * NotebookMetadataBadges, ale celowo zwraca `null` dla zwykłych/częstych
 * źródeł ('manual', 'quick') — bo te nie dostają odznaki. Tu w AKCJACH
 * pole jest ZAWSZE widoczne, więc potrzebuje etykiety również dla nich.
 * Lista pokrywa wartości realnie przypisywane w kodzie (grep
 * `captureSource:` w src/ i server/src/); nieznana wartość nadal pokazuje
 * surowy tekst — degradacja, nie awaria.
 */
const CAPTURE_SOURCE_LABELS: Record<string, { pl: string; en: string }> = {
  manual: { pl: 'Ręcznie', en: 'Manual' },
  quick: { pl: 'Szybkie wrzucanie', en: 'Quick capture' },
  api_import: { pl: 'Import przez API', en: 'API import' },
  web_clipper: { pl: 'Wycinek strony', en: 'Web clip' },
  email_forward: { pl: 'Przekazany e-mail', en: 'Email forward' },
  source_pack_create: { pl: 'Pakiet źródeł', en: 'Source pack' },
  table_conversion: { pl: 'Konwersja tabeli', en: 'Table conversion' },
  work_canvas: { pl: 'Kanwa', en: 'Canvas' },
};

function captureSourceLabel(raw: string | null | undefined, isPolish: boolean): string | null {
  if (!raw) return null;
  const entry = CAPTURE_SOURCE_LABELS[String(raw).trim().toLowerCase()];
  if (!entry) return null;
  return isPolish ? entry.pl : entry.en;
}

const RAIL_SECTION_ORDER = ARTIFACT_PANEL_SECTION_ORDER.filter(
  (id): id is 'actions' | 'properties' | 'relations' | 'evidence' | 'comments' | 'history' =>
    id !== 'results'
);
type RailSectionId = (typeof RAIL_SECTION_ORDER)[number];

interface NotebookRightRailProps {
  open: boolean;
  /** 'work' asks the rail to reveal Właściwości; 'context' asks for Powiązania. */
  activeTab: 'work' | 'context';
  onTabChange: (tab: 'work' | 'context') => void;
  onClose: () => void;
  ownerLabel?: string;

  // Active page data
  activePage: NotebookPage | null;
  allPages: NotebookPage[];
  editor: Editor | null;

  // Props forwarded to AIChatInlinePanel (legacy interface — see note below)
  noteTitle: string;
  noteContent: string;
  noteTags: string[];
  notePage: NotebookRailPage | undefined;
  onAskAI?: () => void;
  onDeletePage?: () => void;
  onSetVisibility?: (next: 'private' | 'project') => void;
  saveState?: 'saving' | 'saved' | 'error' | 'conflict' | 'offline' | null;
  onRetrySave?: () => void;
  onReloadConflict?: () => void;
  onKeepMineConflict?: () => void;
  onSetVerificationStatus?: (next: 'unverified' | 'verified' | 'disputed') => void;
  onSetReviewCadence?: (next: 'weekly' | 'monthly' | 'quarterly' | 'never') => void;
  onMarkReviewed?: () => void;
  getRelativeTime?: (iso: string) => string;
  onFocusAICommand?: () => void;
  onOpenAIChat?: () => void;
  onConvert?: (target: ConvertTarget) => void;
  canConvertDeliverable?: boolean;
  convertBlockedReason?: string;
  /** Undefined preserves legacy integrators; production passes its proven receipt capabilities. */
  receiptCapableActionIds?: string[];

  /** Akcje section (DEC-69, "same action registry as the kebab" — MYW-NBK-CORE-002). */
  onExport?: () => void;
  onShare?: () => void;
  onToggleVersionHistory?: () => void;
  versionHistoryOpen?: boolean;

  /**
   * Który TRYB wspólnego prawego pasa otwiera się na start
   * (`artefakt` | `teresa` | `struktura`). Ma skutek WYŁĄCZNIE przy fladze
   * `ff_artifact_right_rail`; przy fladze OFF prop jest martwy i ścieżka
   * renderu go nie dotyka. Nieustawiony → pierwszy tryb (Artefakt).
   * Realny konsument kontraktu: powierzchnia, która chce otworzyć pas na
   * konkretnym trybie po akcji użytkownika (wzór z Worda: po generacji
   * dokumentu pas otwiera się na „Kontrola jakości"), oraz harness
   * dev-render, który robi deterministyczne zrzuty każdego trybu.
   */
  defaultRailModeId?: string;
}

/**
 * Struktura notatki — nagłówki H1–H3 wprost z dokumentu.
 *
 * To jest treść klasy „PO artefakcie" (nawigacja), nie „O artefakcie"
 * (metadane) — dokładnie ten rozdział, który
 * `docs/program/grafika/ANALIZA_PRAWY_PANEL.md` (uzupełnienie „dokumenty")
 * nazywa drugim rodzajem zawartości prawego pasa. Odpowiednik `structure`
 * z Excela; dla notatnika to JEDYNY dziś realny tryb zależny od typu.
 *
 * Źródło danych jest REALNE, nie mockowane: żywy dokument edytora
 * (`editor.getJSON()`), a gdy edytora nie ma (podgląd, harness) — zapisany
 * `contentJson` strony. Brak nagłówków = jawny stan pusty, nie atrapa.
 */
interface NotebookOutlineEntry {
  key: string;
  level: number;
  text: string;
}

function readNotebookOutline(editor: Editor | null, contentJson: unknown): NotebookOutlineEntry[] {
  let doc: unknown = null;
  try {
    doc = editor ? editor.getJSON() : contentJson;
  } catch {
    doc = contentJson;
  }
  const content = (doc as { content?: unknown[] } | null)?.content;
  if (!Array.isArray(content)) return [];
  const out: NotebookOutlineEntry[] = [];
  content.forEach((node, index) => {
    const typed = node as {
      type?: string;
      attrs?: { level?: number };
      content?: { text?: string }[];
    };
    if (typed?.type !== 'heading') return;
    const text = (typed.content ?? [])
      .map((child) => child?.text ?? '')
      .join('')
      .trim();
    if (!text) return;
    out.push({
      key: `${index}-${text}`,
      level: Math.min(Math.max(typed.attrs?.level ?? 1, 1), 3),
      text,
    });
  });
  return out;
}

const NotebookOutlineList: React.FC<{ entries: NotebookOutlineEntry[]; emptyLabel: string }> = ({
  entries,
  emptyLabel,
}) =>
  entries.length === 0 ? (
    <p className="text-xs italic text-c-text-muted">{emptyLabel}</p>
  ) : (
    <ol className="flex flex-col gap-0.5">
      {entries.map((entry) => (
        <li
          key={entry.key}
          className="truncate rounded-md px-2 py-1 text-[12.5px] text-c-text-secondary"
          style={{ paddingLeft: `${(entry.level - 1) * 12 + 8}px` }}
        >
          {entry.text}
        </li>
      ))}
    </ol>
  );

const SectionHeader: React.FC<{
  id: RailSectionId;
  label: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
}> = ({ label, count, open, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={open}
    className="flex h-11 w-full items-center gap-2 px-4 text-left hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] focus-visible:ring-inset"
  >
    <span className="flex-1 min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
      {label}
    </span>
    {typeof count === 'number' && count > 0 ? (
      <span className="text-[11px] tabular-nums text-c-text-muted">{count}</span>
    ) : null}
    <ChevronDown
      size={16}
      className={`shrink-0 text-c-text-muted transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
      aria-hidden="true"
    />
  </button>
);

const ActionRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  hint?: string;
  pressed?: boolean;
  actionId: string;
}> = ({ icon, label, onClick, disabled, title, hint, pressed, actionId }) => (
  <button
    type="button"
    data-notebook-action-id={actionId}
    onClick={onClick}
    disabled={!onClick || disabled}
    title={title}
    aria-pressed={pressed}
    className="-mx-2 flex h-8 w-[calc(100%+1rem)] items-center gap-2.5 rounded-md px-2 text-left text-[12.5px] text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:bg-c-surface-raised aria-pressed:text-c-text"
  >
    <span className="shrink-0 text-c-text-muted">{icon}</span>
    <span className="flex-1 min-w-0 truncate">{label}</span>
    {hint ? <span className="shrink-0 text-[10px] text-c-text-muted">{hint}</span> : null}
  </button>
);

export const NotebookRightRail: React.FC<NotebookRightRailProps> = ({
  open,
  activeTab,
  onTabChange: _onTabChange,
  onClose,
  ownerLabel,
  activePage,
  allPages,
  editor,
  noteTags,
  notePage,
  onSetVisibility,
  saveState,
  onRetrySave,
  onReloadConflict,
  onKeepMineConflict,
  onSetVerificationStatus,
  onSetReviewCadence,
  onMarkReviewed,
  getRelativeTime,
  onFocusAICommand,
  onOpenAIChat,
  onConvert,
  canConvertDeliverable,
  convertBlockedReason,
  receiptCapableActionIds,
  onExport,
  onShare,
  onToggleVersionHistory,
  versionHistoryOpen,
  defaultRailModeId,
}) => {
  const { t, i18n } = useTranslation();
  // Nazwy sekcji kanonu pochodzą z JEDNEGO miejsca w całej aplikacji
  // (`ARTIFACT_PANEL_SECTION_LABELS`) — moduł ich nie wymyśla.
  const isPolishRail = !!i18n.language?.startsWith('pl');
  const canonLabel = (id: RailSectionId) => {
    const entry = ARTIFACT_PANEL_SECTION_LABELS[id];
    return t(`artifactPanel.section.${id}`, isPolishRail ? entry.pl : entry.en);
  };
  const isReceiptCapable = (actionId: string) =>
    receiptCapableActionIds === undefined || receiptCapableActionIds.includes(actionId);

  const [openIds, setOpenIds] = useState<Set<RailSectionId>>(
    () => new Set<RailSectionId>(['actions', 'properties', 'relations'])
  );

  // An external caller asking to reveal 'work' or 'context' (e.g. the kebab
  // menu's "Verification" shortcut) re-opens the matching section without
  // closing any section the user already has open — the accordion allows
  // several sections open at once, unlike the old exclusive tabs.
  useEffect(() => {
    setOpenIds((prev) => {
      const target: RailSectionId = activeTab === 'work' ? 'properties' : 'relations';
      if (prev.has(target)) return prev;
      const next = new Set(prev);
      next.add(target);
      return next;
    });
  }, [activeTab]);

  const toggle = (id: RailSectionId) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!open || !activePage) return null;

  const specAShellEnabled = isNotebookSpecAShellEnabled();
  // Wspólny prawy pas (`ArtifactRightRail`) — flaga DOMYŚLNIE OFF
  // (src/utils/artifactRightRailFlag.ts). Przy OFF ta zmienna jest `false`,
  // więc każda gałąź niżej wybiera dokładnie dotychczasową ścieżkę.
  const artifactRailEnabled = isArtifactRightRailEnabled();
  // Obie nowe powłoki konsumują sekcje jako DANE (a nie jako JSX z własnym
  // nagłówkiem), więc `section()` zbiera je do listy w obu przypadkach.
  const declareSections = specAShellEnabled || artifactRailEnabled;
  const specASections: ArtifactRightPanelSection[] = [];

  const section = (
    id: RailSectionId,
    label: string,
    count: number | undefined,
    body: React.ReactNode
  ) => {
    if (declareSections) {
      specASections.push({
        id,
        label,
        children: body,
        defaultOpen: id === 'actions' || id === 'properties',
        badge: count,
        showZeroBadge: count === 0,
      });
      return null;
    }
    const isOpen = openIds.has(id);
    return (
      <section
        key={id}
        id={`notebook-rail-section-${id}`}
        className="border-b border-c-border-subtle last:border-b-0"
      >
        <SectionHeader
          id={id}
          label={label}
          count={count}
          open={isOpen}
          onToggle={() => toggle(id)}
        />
        {isOpen ? <div className="px-4 pb-4 pt-0.5">{body}</div> : null}
      </section>
    );
  };

  const legacyRail = (
    <aside
      aria-label={t('notebook.rightRail.label', 'Document details and context')}
      className="flex shrink-0 flex-col overflow-hidden bg-c-surface"
      // ★ 2026-09-01 (dyżur 164): tu stała wpisana ręcznie szerokość 360 px.
      // Ten pas (flaga SPEC-A OFF = stan produkcyjny) był o 40 px szerszy od
      // kart N. Jedno źródło szerokości prawego pasa: `--ntype-right-panel-width`.
      style={{
        width: 'var(--ntype-right-panel-width)',
        minWidth: 'var(--ntype-right-panel-width)',
      }}
    >
      {/* Rail header — title + close, no tabs (DEC-69). */}
      <div className="flex h-11 items-center gap-2 border-b border-c-border-subtle px-4">
        <span className="flex-1 min-w-0 truncate text-[12.5px] font-semibold text-c-text">
          {activePage.title || t('notebook.rightRail.untitled', 'Bez tytułu')}
        </span>
        <button
          type="button"
          data-notebook-action-id="rail:close"
          onClick={onClose}
          aria-label={t('notebook.rightRail.closePanel', 'Close panel')}
          className="rounded-md p-1 text-c-text-muted transition-colors hover:bg-c-surface-raised hover:text-c-text"
          title={t('notebook.rightRail.closePanel', 'Close panel')}
        >
          <X size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* 1 · AKCJE */}
        {section(
          'actions',
          canonLabel('actions'),
          undefined,
          <div className="space-y-0.5">
            <ActionRow
              actionId="rail:export"
              icon={<Download size={15} />}
              label={t('notebook.rightRail.export', 'Eksportuj')}
              onClick={onExport}
              hint="PDF · Word"
            />
            <ActionRow
              actionId="rail:share"
              icon={<Share2 size={15} />}
              label={t('notebook.rightRail.share', 'Udostępnij')}
              onClick={onShare}
            />
            <ActionRow
              actionId="rail:copy-link"
              icon={<Copy size={15} />}
              label={t('notebook.rightRail.copyLink', 'Kopiuj link')}
              disabled
              title={t('notebook.rightRail.copyLinkReason', 'Akcja czeka na definicję zakresu')}
            />
            <ActionRow
              actionId="rail:version-history"
              icon={<History size={15} />}
              label={t('notebook.rightRail.versionHistory', 'Historia wersji')}
              onClick={onToggleVersionHistory}
              pressed={versionHistoryOpen}
            />
          </div>
        )}

        {/* 2 · WŁAŚCIWOŚCI (was "Work") */}
        {section(
          'properties',
          canonLabel('properties'),
          undefined,
          <div className="space-y-3">
            {receiptCapableActionIds?.length === 0 ? (
              <p id="notebook-rail-receipt-unavailable" className="text-xs text-c-text-muted">
                {t(
                  'notebook.rightRail.receiptUnavailable',
                  'Editing controls are unavailable until the server can return a durable action receipt.'
                )}
              </p>
            ) : null}

            <div>
              <div className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="text-c-text-muted">
                  {t('notebook.rightRail.saveStatus', 'Save status')}
                </span>
                <span
                  data-testid="notebook-save-state"
                  role={saveState === 'error' ? 'alert' : 'status'}
                >
                  {saveState === 'saving' && (
                    <span className="inline-flex items-center gap-1.5 text-c-text">
                      <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                      {t('notebook.rightRail.saving', 'Saving…')}
                    </span>
                  )}
                  {saveState === 'saved' && (
                    <span className="inline-flex items-center gap-1.5 text-c-success">
                      <CheckCircle2 size={12} aria-hidden="true" />
                      {t('notebook.rightRail.saved', 'Saved')}
                    </span>
                  )}
                  {saveState === 'offline' &&
                    t('notebook.rightRail.offlineQueued', 'Offline — changes are queued')}
                  {saveState === 'conflict' &&
                    t('notebook.rightRail.conflict', 'Changed elsewhere — your edits remain local')}
                  {saveState === 'error' &&
                    t('notebook.rightRail.saveFailed', 'Save failed — changes remain local')}
                  {saveState == null &&
                    t('notebook.rightRail.noPendingChanges', 'No pending changes')}
                </span>
              </div>
              {saveState === 'error' && onRetrySave && (
                <button
                  type="button"
                  data-notebook-action-id="rail:retry-save"
                  aria-disabled={!isReceiptCapable('retry-save') || undefined}
                  aria-describedby={
                    !isReceiptCapable('retry-save')
                      ? 'notebook-rail-receipt-unavailable'
                      : undefined
                  }
                  onClick={() => {
                    if (isReceiptCapable('retry-save')) onRetrySave();
                  }}
                  className="mt-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold text-c-text-secondary hover:bg-c-surface-raised"
                >
                  {t('common.retry', 'Retry')}
                </button>
              )}
              {saveState === 'conflict' && onReloadConflict && onKeepMineConflict && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-notebook-action-id="rail:load-theirs"
                    aria-disabled={!isReceiptCapable('load-theirs') || undefined}
                    aria-describedby={
                      !isReceiptCapable('load-theirs')
                        ? 'notebook-rail-receipt-unavailable'
                        : undefined
                    }
                    onClick={() => {
                      if (isReceiptCapable('load-theirs')) onReloadConflict();
                    }}
                    className="rounded-md border border-c-border-subtle px-2 py-1 text-[11.5px] font-semibold text-c-text-secondary hover:bg-c-surface-raised"
                  >
                    {t('notebook.rightRail.loadTheirs', 'Load theirs')}
                  </button>
                  <button
                    type="button"
                    data-notebook-action-id="rail:keep-mine"
                    aria-disabled={!isReceiptCapable('keep-mine') || undefined}
                    aria-describedby={
                      !isReceiptCapable('keep-mine')
                        ? 'notebook-rail-receipt-unavailable'
                        : undefined
                    }
                    onClick={() => {
                      if (isReceiptCapable('keep-mine')) onKeepMineConflict();
                    }}
                    className="rounded-md border border-c-border-subtle px-2 py-1 text-[11.5px] font-semibold text-c-text-secondary hover:bg-c-surface-raised"
                  >
                    {t('notebook.rightRail.keepMine', 'Keep mine')}
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-start gap-3 text-[12.5px]">
              <span className="flex w-[104px] shrink-0 items-center gap-1.5 text-c-text-muted">
                <UserRound size={13} aria-hidden="true" />
                {t('notebook.rightRail.owner', 'Owner')}
              </span>
              <span data-testid="notebook-owner-state" className="min-w-0 flex-1 text-c-text">
                {ownerLabel ||
                  (activePage.ownerUserId
                    ? t('notebook.rightRail.ownerUnavailable', 'Owner identity unavailable')
                    : t('notebook.rightRail.ownerMissing', 'Owner not assigned'))}
              </span>
            </div>

            <div className="flex items-start gap-3 text-[12.5px]">
              <span className="flex w-[104px] shrink-0 items-center gap-1.5 text-c-text-muted">
                <Eye size={13} aria-hidden="true" />
                {t('notebook.rightRail.visibility', 'Visibility')}
              </span>
              <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {(['private', 'project'] as const).map((visibility) => (
                  <button
                    key={visibility}
                    type="button"
                    data-notebook-action-id={`rail:visibility-${visibility}`}
                    aria-pressed={activePage.visibility === visibility}
                    aria-disabled={
                      !isReceiptCapable(`visibility-${visibility}`) ||
                      (visibility === 'project' && !activePage.projectId) ||
                      undefined
                    }
                    aria-describedby={
                      !isReceiptCapable(`visibility-${visibility}`)
                        ? 'notebook-rail-receipt-unavailable'
                        : undefined
                    }
                    onClick={() => {
                      if (
                        isReceiptCapable(`visibility-${visibility}`) &&
                        !(visibility === 'project' && !activePage.projectId)
                      ) {
                        onSetVisibility?.(visibility);
                      }
                    }}
                    className="rounded-full border border-c-border-subtle px-2.5 py-1 text-[11.5px] text-c-text-secondary aria-pressed:border-c-border-strong aria-pressed:bg-c-surface-raised aria-pressed:text-c-text disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {visibility === 'private'
                      ? t('notebook.rightRail.private', 'Private')
                      : t('notebook.rightRail.project', 'Project')}
                  </button>
                ))}
              </span>
            </div>

            <div className="flex items-start gap-3 text-[12.5px]">
              <span className="flex w-[104px] shrink-0 items-center gap-1.5 text-c-text-muted">
                <ShieldCheck size={13} aria-hidden="true" />
                {t('notebook.rightRail.verification', 'Verification')}
              </span>
              <select
                data-notebook-action-id="rail:verification-status"
                aria-label={t('notebook.rightRail.verification', 'Verification')}
                value={activePage.verificationStatus || 'unverified'}
                aria-disabled={!isReceiptCapable('verification-status') || undefined}
                aria-describedby={
                  !isReceiptCapable('verification-status')
                    ? 'notebook-rail-receipt-unavailable'
                    : undefined
                }
                onChange={(event) => {
                  if (isReceiptCapable('verification-status')) {
                    onSetVerificationStatus?.(
                      event.target.value as 'unverified' | 'verified' | 'disputed'
                    );
                  }
                }}
                disabled={!onSetVerificationStatus}
                className="-mx-1.5 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-c-text hover:border-c-border-subtle hover:bg-c-surface-raised focus:border-c-border focus:bg-c-surface focus:outline-none"
              >
                <option value="unverified">
                  {t('notebook.rightRail.unverified', 'Unverified')}
                </option>
                <option value="verified">{t('notebook.rightRail.verified', 'Verified')}</option>
                <option value="disputed">{t('notebook.rightRail.disputed', 'Disputed')}</option>
              </select>
            </div>

            <div className="flex items-start gap-3 text-[12.5px]">
              <span className="flex w-[104px] shrink-0 items-center gap-1.5 text-c-text-muted">
                <CalendarClock size={13} aria-hidden="true" />
                {t('notebook.rightRail.review', 'Review')}
              </span>
              <select
                data-notebook-action-id="rail:review-cadence"
                aria-label={t('notebook.rightRail.reviewCadence', 'Review cadence')}
                value={activePage.reviewCadence || 'monthly'}
                aria-disabled={!isReceiptCapable('review-cadence') || undefined}
                aria-describedby={
                  !isReceiptCapable('review-cadence')
                    ? 'notebook-rail-receipt-unavailable'
                    : undefined
                }
                onChange={(event) => {
                  if (isReceiptCapable('review-cadence')) {
                    onSetReviewCadence?.(
                      event.target.value as 'weekly' | 'monthly' | 'quarterly' | 'never'
                    );
                  }
                }}
                disabled={!onSetReviewCadence}
                className="-mx-1.5 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-c-text hover:border-c-border-subtle hover:bg-c-surface-raised focus:border-c-border focus:bg-c-surface focus:outline-none"
              >
                <option value="weekly">{t('notebook.rightRail.weekly', 'Weekly')}</option>
                <option value="monthly">{t('notebook.rightRail.monthly', 'Monthly')}</option>
                <option value="quarterly">{t('notebook.rightRail.quarterly', 'Quarterly')}</option>
                <option value="never">{t('notebook.rightRail.neverCadence', 'Never')}</option>
              </select>
            </div>

            <div className="flex items-start gap-3 text-[12.5px]">
              <span className="flex w-[104px] shrink-0 items-center gap-1.5 text-c-text-muted">
                <Tag size={13} aria-hidden="true" />
                {t('notebook.rightRail.tagsAndStatus', 'Tags and status')}
              </span>
              <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                <span className="rounded-full bg-c-surface-raised px-2 py-1 text-[11px] text-c-text-secondary">
                  {activePage.status}
                </span>
                <span className="rounded-full bg-c-surface-raised px-2 py-1 text-[11px] text-c-text-secondary">
                  {activePage.maturity}
                </span>
                {noteTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-c-surface-raised px-2 py-1 text-[11px] text-c-text-secondary"
                  >
                    {tag}
                  </span>
                ))}
              </span>
            </div>

            <div className="space-y-1 border-t border-c-border-subtle pt-3 text-[12.5px] text-c-text-secondary">
              <div>
                {t('notebook.rightRail.modified', 'Modified')}:{' '}
                {getRelativeTime?.(activePage.updatedAt) || activePage.updatedAt}
              </div>
              <div>
                {t('notebook.rightRail.wordCount', 'Words')}:{' '}
                {notePage?.wordCount ?? activePage.wordCount ?? 0}
              </div>
              <div>
                {t('notebook.rightRail.lastReviewed', 'Last reviewed')}:{' '}
                {activePage.lastReviewedAt
                  ? getRelativeTime?.(activePage.lastReviewedAt) || activePage.lastReviewedAt
                  : t('notebook.rightRail.never', 'Never')}
              </div>
              {onMarkReviewed && (
                <button
                  type="button"
                  data-notebook-action-id="rail:mark-reviewed"
                  aria-disabled={!isReceiptCapable('mark-reviewed') || undefined}
                  aria-describedby={
                    !isReceiptCapable('mark-reviewed')
                      ? 'notebook-rail-receipt-unavailable'
                      : undefined
                  }
                  onClick={() => {
                    if (isReceiptCapable('mark-reviewed')) onMarkReviewed();
                  }}
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold text-c-text-secondary hover:bg-c-surface-raised"
                >
                  <RefreshCw size={11} aria-hidden="true" />
                  {t('notebook.rightRail.markReviewed', 'Mark reviewed')}
                </button>
              )}
            </div>

            <div className="space-y-1 border-t border-c-border-subtle pt-3 text-[12.5px]">
              <div className="text-c-text">
                {t('notebook.rightRail.source', 'Source')}:{' '}
                {captureSourceLabel(activePage.captureSource, isPolishRail) ||
                  captureSourceLabel(activePage.captureMetadata?.sourceType, isPolishRail) ||
                  activePage.captureSource ||
                  activePage.captureMetadata?.sourceType ||
                  t('notebook.rightRail.sourceNotRecorded', 'Not recorded')}
              </div>
              <div className="text-c-text">
                {t('notebook.rightRail.nextAction', 'Next action')}:{' '}
                {activePage.verificationStatus !== 'verified'
                  ? t('notebook.rightRail.verifyDocument', 'Verify document evidence')
                  : activePage.staleAt
                    ? t('notebook.rightRail.reviewStaleDocument', 'Review stale document')
                    : t('notebook.rightRail.keepCurrent', 'Keep current through the next review')}
              </div>
              {activePage.captureMetadata?.sourceId ? (
                <details className="pt-1 text-c-text-muted">
                  <summary className="cursor-pointer">
                    {t('notebook.rightRail.technicalLineage', 'Technical lineage')}
                  </summary>
                  <code className="mt-1 block break-all text-[10px]">
                    {activePage.captureMetadata.sourceType || 'source'}:
                    {activePage.captureMetadata.sourceId}
                  </code>
                </details>
              ) : null}
            </div>
          </div>
        )}

        {/* 3 · POWIĄZANIA (was "Context") */}
        {section(
          'relations',
          canonLabel('relations'),
          undefined,
          <NotebookContextPanel
            embedded
            open={true}
            onClose={onClose}
            editor={editor}
            noteId={activePage.id}
            noteTitle={activePage.title}
            noteTags={noteTags}
            allNotes={allPages}
            noteConvertedTo={activePage.convertedTo || []}
          />
        )}

        {/* 4 · ŹRÓDŁA I ZAŁOŻENIA — sekcja kanonu, której notatnik nie miał.
             Notatka nie prowadzi dziś własnego rejestru źródeł/założeń; gdy
             powstała z przechwytu, pokazujemy realne pochodzenie, a gdy nie —
             mówimy to wprost zamiast chować nagłówek. */}
        {section(
          'evidence',
          canonLabel('evidence'),
          undefined,
          activePage.captureMetadata?.sourceId ? (
            <div className="space-y-1 text-[11.5px] text-c-text-secondary">
              <p>{t('notebook.rightRail.evidenceCaptured', 'Notatka powstała z przechwytu:')}</p>
              <code className="block break-all text-[10px] text-c-text-muted">
                {activePage.captureMetadata.sourceType || 'source'}:
                {activePage.captureMetadata.sourceId}
              </code>
            </div>
          ) : (
            <p className="text-xs italic text-c-text-muted">
              {t(
                'notebook.rightRail.noEvidence',
                'Ta notatka nie ma zapisanych źródeł ani założeń.'
              )}
            </p>
          )
        )}

        {/* 5 · KOMENTARZE (new — no comment system on notes yet) */}
        {section(
          'comments',
          canonLabel('comments'),
          0,
          <p className="text-xs italic text-c-text-muted">
            {t('notebook.rightRail.noComments', 'Brak komentarzy do tego dokumentu.')}
          </p>
        )}

        {/* 6 · HISTORIA */}
        {section(
          'history',
          canonLabel('history'),
          undefined,
          <div className="space-y-2">
            {versionHistoryOpen ? (
              <p className="flex items-center gap-1.5 text-[11.5px] text-c-text-secondary">
                <History size={13} aria-hidden="true" />
                {t(
                  'notebook.rightRail.versionHistoryOpenHint',
                  'Historia wersji otwarta poniżej dokumentu — patrz sekcja Akcje.'
                )}
              </p>
            ) : (
              <p className="text-[11.5px] text-c-text-muted">
                {t(
                  'notebook.rightRail.versionHistoryHint',
                  'Otwórz historię wersji w sekcji Akcje, żeby zobaczyć poprzednie zapisy.'
                )}
              </p>
            )}
            {/* Przycisk-wyjście „Open Teresa" znika przy fladze ON — wspólna
                szyna ma WŁASNE, kanoniczne wejście („Zapytaj Teresę o tę
                notatkę" w sekcji Akcje), a dwa wejścia do tej samej rozmowy
                w jednym pasie to dokładnie ten rozjazd, który likwidujemy.
                Przy fladze OFF przycisk zostaje bez zmian — to jedyne wejście
                starej szyny i nie wolno go zabrać razem z niczym innym. */}
            {onOpenAIChat && !artifactRailEnabled ? (
              <button
                type="button"
                data-notebook-action-id="rail:open-teresa"
                onClick={onOpenAIChat}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-c-ai/30 bg-c-ai/[0.06] px-3 py-2 text-sm font-semibold text-c-ai"
              >
                <Sparkles size={14} aria-hidden="true" />
                {t('notebook.rightRail.openTeresa', 'Open Teresa')}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );

  // ═══════════════════════════════════════════════════════════════════
  // WSPÓLNY PRAWY PAS (flaga ON) — jedyna dziś wpięta powierzchnia formuły.
  // Notatnik deklaruje TREŚĆ trzech trybów; wygląd narzuca `ArtifactRightRail`.
  // ═══════════════════════════════════════════════════════════════════
  if (artifactRailEnabled) {
    const noteLabel = activePage.title || t('notebook.rightRail.untitled', 'Bez tytułu');

    // Komendy Teresy = WYŁĄCZNIE realne akcje, które ta szyna już dostaje
    // z NotebookContent. Zero chipów bez handlera — atrapa w pasie Teresy
    // byłaby gorsza niż jej brak.
    const teresaCommands: ArtifactRailTeresaCommand[] = [];
    if (onFocusAICommand) {
      teresaCommands.push({
        id: 'ai-command',
        label: t('notebook.rightRail.teresaCommandPrompt', 'Polecenie w dokumencie'),
        icon: Sparkles,
        onClick: onFocusAICommand,
      });
    }
    if (onConvert) {
      teresaCommands.push({
        id: 'convert-task',
        label: t('notebook.rightRail.teresaConvertTask', 'Zamień w zadanie'),
        icon: ClipboardList,
        onClick: () => onConvert('task'),
      });
      teresaCommands.push({
        id: 'convert-initiative',
        label: t('notebook.rightRail.teresaConvertInitiative', 'Zamień w inicjatywę'),
        icon: Layers,
        onClick: () => onConvert('initiative'),
        disabled: canConvertDeliverable === false,
        disabledReason: convertBlockedReason,
      });
    }

    const outline = readNotebookOutline(editor, activePage.contentJson);
    const typeModes: ArtifactRailTypeMode[] = [
      {
        id: 'struktura',
        label: t('notebook.rightRail.structure', 'Struktura notatki'),
        icon: ListTree,
        contextLabel: t(
          'notebook.rightRail.structureHint',
          'Nagłówki dokumentu — nawigacja PO artefakcie, nie metadana o nim.'
        ),
        content: (
          <NotebookOutlineList
            entries={outline}
            emptyLabel={t(
              'notebook.rightRail.structureEmpty',
              'Ta notatka nie ma jeszcze nagłówków — struktura pojawi się, gdy dodasz nagłówek.'
            )}
          />
        ),
      },
    ];

    return (
      <ArtifactRightRail
        title={noteLabel}
        onClose={onClose}
        ariaLabel={t('notebook.rightRail.label', 'Document details and context')}
        artifact={{ sections: specASections }}
        teresa={{
          contextLabel: t('notebook.rightRail.teresaContext', 'Notatka „{{title}}"', {
            title: noteLabel,
          }),
          commands: teresaCommands,
          // Notatka nie ma dziś WŁASNEGO wątku rozmowy zapisanego przy
          // dokumencie — jest wspólny czat notatnika. Mówimy to wprost
          // zamiast rysować pusty strumień udający historię.
          messages: [],
          emptyLabel: t(
            'notebook.rightRail.teresaEmpty',
            'Ta notatka nie ma jeszcze własnego wątku rozmowy — otwórz rozmowę, żeby zacząć.'
          ),
          // BRAK `onSend`: pole pisania renderuje się wyłączone z jawnym
          // powodem. Wątek per-notatka to praca toru funkcji (kontrakt
          // danych), nie toru grafiki — patrz §"Połowa funkcjonalna" analizy.
          composeDisabledReason: t(
            'notebook.rightRail.teresaComposeDisabled',
            'Pisanie wprost w pasie będzie możliwe, gdy notatka dostanie własny wątek rozmowy.'
          ),
          /*
            ★ 2026-09-01 („jedna Teresa, w swoim oknie"): z całego trybu
            Teresy powłoka renderuje dziś WYŁĄCZNIE te dwa pola — jako
            przycisk-wejście w sekcji „Akcje". Etykieta nazywa OBIEKT
            (kanon `TeresaEntryButton`), nie funkcję: „Open Teresa" mówiło
            czym jest cel, a nie o czym będzie rozmowa. Pola wyżej
            (`commands`/`messages`/`composeDisabledReason`) zostają
            zadeklarowane, ale NIE MAJĄ JUŻ SKUTKU WIZUALNEGO — czatu na
            szynie nie ma. Zostawiamy je, bo kontrakt propsa się nie zmienił,
            a skasowanie ich sugerowałoby, że komend nigdy nie było.
          */
          entryLabel: t('notebook.rightRail.askTeresaAboutNote', 'Zapytaj Teresę o tę notatkę'),
          footerAction: onOpenAIChat
            ? {
                label: t('notebook.rightRail.openTeresa', 'Open Teresa'),
                icon: Sparkles,
                onClick: onOpenAIChat,
              }
            : undefined,
        }}
        typeModes={typeModes}
        defaultModeId={defaultRailModeId}
        testId="notebook-artifact-right-rail"
      />
    );
  }

  const specAPanel = (
    <div className="flex h-full shrink-0 flex-col overflow-hidden bg-c-surface">
      {/*
        ★ Pomiar na żywo 05.09 (`mywork-notebook-rail-speca`): nagłówek pasa
        pokazywał sam tytuł notatki + X, a zatwierdzony obraz ma dwuwierszową
        główkę „NOTEBOOK / Szczegóły notatki” (nadkreślnik modułu + stała
        nazwa panelu). Tytuł notatki stoi już w nagłówku samego dokumentu na
        lewo od pasa, więc powtarzanie go tutaj nie niosło informacji, a
        zabierało jedyny wiersz główki. Ta sama struktura co w powłoce
        `IdeaNotebookRightPanelPrototype` — nagłówek jest wspólnym kanonem
        obu pasów, niezależnym od flagi prototypu (której NIE ruszamy:
        decyzja właściciela w toku).
      */}
      <div className="flex h-12 items-center gap-2 border-b border-c-border-subtle px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-c-text-muted">
            {t('notebook.rightRail.eyebrow', 'Notebook')}
          </p>
          <h2 className="truncate text-sm font-semibold text-c-text">
            {t('notebook.rightRail.panelTitle', 'Szczegóły notatki')}
          </h2>
        </div>
        <button
          type="button"
          data-notebook-action-id="rail:close"
          onClick={onClose}
          aria-label={t('notebook.rightRail.closePanel', 'Close panel')}
          className="rounded-md p-1 text-c-text-muted transition-colors hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
          title={t('notebook.rightRail.closePanel', 'Close panel')}
        >
          <X size={15} />
        </button>
      </div>
      <ArtifactRightPanel
        ariaLabel={t('notebook.rightRail.label', 'Document details and context')}
        className="min-h-0 flex-1 border-l-0"
        // ★ 2026-09-01 (dyżur 164): jawne nadpisanie szerokości (360 px)
        // USUNIĘTE. Pas Notatnika był o 40 px szerszy od kart N, mimo że oba
        // renderują ten sam `ArtifactRightPanel`. Domyślna szerokość komponentu
        // to token `--ntype-right-panel-width` — zmierzone przy 320 px: zero
        // nowych ucięć treści względem poprzedniej szerokości.
        sections={specASections}
      />
    </div>
  );

  return (
    <IdeaNotebookRightPanelPrototypeGate
      context="notebook"
      language={isPolishRail ? 'pl' : 'en'}
      title={activePage.title || t('notebook.rightRail.untitled', 'Bez tytułu')}
      ariaLabel={t('notebook.rightRail.label', 'Document details and context')}
      onClose={onClose}
      sections={specASections}
      legacy={specAShellEnabled ? specAPanel : legacyRail}
    />
  );
};
