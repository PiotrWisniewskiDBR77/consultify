/**
 * ReportsAndPresentationsHub — V8.1 Outputs Library (route alias /presentations)
 *
 * Taxonomy: All | Mine | Needs review | Documents | Presentations | Sheets | Templates
 * Uses ModuleHub + registry-backed lists (GET /api/artifacts, view=mine|review).
 */

import {
  ArrowLeft,
  BookTemplate,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  LayoutTemplate,
  Package2,
  PenLine,
  Presentation,
  ShieldCheck,
  Sparkles,
  Table2,
  Wand2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { ExceleParametricTemplates } from '@/components/AIChat/KimiWorkspace/ExceleParametricTemplates';
import { PresentationTemplateArchitectView } from '@/components/Presentations/PresentationTemplateArchitectView';
import { CreateFormatModeLauncher } from '@/components/shared/CreateFormatModeLauncher';
import { TemplateBuilderFlow } from '@/components/TemplateBuilder';
import { isDeliverablesLightEnabled } from '@/services/deliverablesGeneration';
import { useConversationStore } from '@/store/useConversationStore';
import { isDeckArchitectEnabled } from '@/utils/deckArchitectFlag';
import { isTemplatesGalleryEnabled } from '@/utils/templatesGalleryFlag';

// DEC-423 (właściciel, 06.09.2026): dwa kanoniczne dropdowny Menu 2 zamiast
// bespoke popovera „Filters". Ten sam generyczny komponent, co Inicjatywy
// (Menu2PresetDropdown, DEC-420) i Ocena (StatusDropdown, DEC-414) — zero
// nowego komponentu, per instrukcję dyżuru 1.1-M-1.
import { Menu2PresetDropdown } from '../standard/Menu2PresetDropdown';
import { type FilterChip, type ModuleTab, type ViewMode } from '../shared/ModuleHub';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';
import {
  MENU_3_ALL_DOT_CLASS,
  MENU_3_BADGE_ACTIVE,
  MENU_3_BADGE_INACTIVE,
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_INACTIVE,
  MENU_3_INNER_CLASS,
  MENU_3_LEFT_CLASS,
  MENU_3_RIGHT_CLASS,
  Menu3Badge,
  Menu3Chip,
} from '../shared/ModuleMenu3';
import { StandardModuleBar } from '../standard/StandardModuleBar';
import { resolveTemplatesDeepLink } from './artifactNavigation';
import { BundleHistoryPanel } from './BundleHistoryPanel';
import { OutputsAggregateTabContent } from './OutputsAggregateTabContent';
import { parseRapTabFromQuery, RAP_TAB_TO_QUERY } from './outputsLibraryTabQuery';
import { PresentationsTabContent } from './PresentationsTabContent';
import { ReportsTabContent } from './ReportsTabContent';
import { type SheetsSubView, SheetsTabContent } from './SheetsTabContent';
import { countRowsByStatus, type MaterialsStatusCountScope } from './statusCounts';
import { TemplateProvenanceApprovalDialog } from './TemplateProvenanceApprovalDialog';
import {
  TEMPLATE_SCOPE_ORDER,
  TEMPLATE_TYPE_LABEL_PLURAL,
  TEMPLATE_TYPE_ORDER,
  templateScopeLabel,
} from './TemplatesGalleryView';
import { filterTemplatesBySearch, TemplatesTabContent } from './TemplatesTabContent';
import type { RapTab, TemplateScope, TemplateType } from './types';
import { PRESENTATION_STATUS_META, REPORT_STATUS_META, TEMPLATE_STATUS_META } from './types';
import {
  useArtifactOutputsList,
  usePresentations,
  useRapActions,
  useReports,
  useSheetOutputs,
  useTemplates,
} from './useRapData';

/**
 * "Nowy szablon" CTA for the Template Library tab, extended (2026-07-26,
 * kanon MATERIALS_TARGET_STATE §3) with a secondary menu that opens the two
 * template ARCHITECTS in place, inside the same "Szablony" tab — they are
 * NOT siblings of Menu 1 anymore. Reuses the exact CTA button classes from
 * ModuleNavBar's default `onNewItem` button and the dropdown-panel styling
 * from `StatusDropdown` (neutral tokens only — zero new colors/menus).
 */
interface TemplatesNewSplitButtonProps {
  label: string;
  onNewTemplate: () => void;
  onOpenDeckArchitect?: () => void;
}

const TemplatesNewSplitButton: React.FC<TemplatesNewSplitButtonProps> = ({
  label,
  onNewTemplate,
  onOpenDeckArchitect,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  const ctaBase =
    'inline-flex h-9 items-center gap-2 px-4 text-sm font-medium text-white transition-colors duration-150 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]';

  if (!onOpenDeckArchitect) {
    return (
      <button
        type="button"
        onClick={onNewTemplate}
        data-testid="outputs-new-btn"
        className={`${ctaBase} rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`}
      >
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        type="button"
        onClick={onNewTemplate}
        data-testid="outputs-new-btn"
        className={`${ctaBase} rounded-l-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`}
      >
        <span>{label}</span>
      </button>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={t('rap.templatesLauncher.moreOptions', 'Więcej opcji tworzenia szablonów')}
        aria-expanded={isOpen}
        data-testid="templates-new-split-toggle"
        className={`${ctaBase} rounded-r-lg border-l border-white/20 px-2 dark:border-navy-950/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`}
      >
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full z-overlay mt-1 min-w-[280px] rounded-xl border border-c-border-subtle bg-white py-1 shadow-hig-xl dark:bg-navy-800 dark:shadow-hig-dark-xl"
          data-testid="templates-new-split-menu"
        >
          {onOpenDeckArchitect && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenDeckArchitect();
              }}
              data-testid="templates-open-deck-architect"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-c-text transition-colors duration-150 hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <Wand2 size={14} className="shrink-0 text-c-text-muted" />
              <span>
                {t('rap.templatesLauncher.openDeckArchitect', 'Architekt szablonów (Prezentacja)')}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const ReportsAndPresentationsHub: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isPolish = i18n.language?.startsWith('pl');

  // Kanon 2026-07-26 (docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md
  // §3): Menu 1 ma DOKŁADNIE 5 pozycji (All/Documents/Presentations/Sheets/
  // Templates) — Architekt szablonów (Deck) i Generator szablonów (Excel) NIE
  // są siostrzanymi zakładkami. Otwierają się WEWNĄTRZ zakładki "Szablony" jako
  // tryb widoku (`templatesView`). Stare deep linki (`?tab=template_architect`,
  // `?tab=workbook_templates`) nadal działają — lądują na 'templates' z
  // odpowiednim `templatesView` zamiast na osobnej zakładce.
  type TemplatesLibraryView = 'library' | 'deckArchitect' | 'workbookTemplates';

  const {
    initialTab,
    initialArtifactId,
    initialTemplatesView,
    initialWorkbookTemplateId,
    initialOpenProvenance,
  } = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    const fromQuery = parseRapTabFromQuery(params.get('tab'));
    // ODBIÓR NA ŻYWO 05.09 (pakiet 10 · Materiały, obserwacja „martwy
    // przewód"): kebab → „Edytuj" przy wzorcu Arkusza produkuje
    // `?tab=templates&editWorkbookTemplateId=<kanoniczne id>`
    // (`artifactNavigation.ts` `resolveTemplateEditPath`), ale w całym `src/`
    // NIE BYŁO ani jednego czytelnika tego parametru — jedynie producent i
    // jego test kontraktowy. Użytkownik klikał „Edytuj", adres się zmieniał,
    // a builder nigdy się nie otwierał: zostawał na liście. Czytelnik
    // (`resolveTemplatesDeepLink`) leży dziś OBOK producenta, w tym samym
    // pliku i pod tym samym testem, żeby oba końce przewodu nie mogły znowu
    // się rozjechać.
    const deepLink = resolveTemplatesDeepLink(params);
    let tab: RapTab;
    const templatesView: TemplatesLibraryView = deepLink.templatesView;
    if (deepLink.forcesTemplatesTab) {
      tab = 'templates';
    } else if (fromQuery) {
      tab = fromQuery;
    } else if (location.pathname.startsWith('/reports')) {
      tab = 'outputs_documents';
    } else if (location.pathname.startsWith('/presentations')) {
      tab = 'presentations';
    } else {
      tab = 'outputs_all';
    }
    return {
      initialTab: tab,
      // Keep backward compatibility with older deep links using ?deck=<id>.
      initialArtifactId: params.get('artifactId') || params.get('deck') || null,
      initialTemplatesView: templatesView,
      initialWorkbookTemplateId: deepLink.workbookTemplateId,
      initialOpenProvenance: deepLink.openProvenance,
    };
  }, [location.pathname, location.search]);

  const [activeTab, setActiveTab] = useState<RapTab>(initialTab);
  // Internal sub-view of the 'templates' tab — see kanon note above initialTab.
  const [templatesView, setTemplatesView] = useState<TemplatesLibraryView>(initialTemplatesView);
  const [workbookTemplateId, setWorkbookTemplateId] = useState<string | null>(
    initialWorkbookTemplateId
  );
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  // M17 junk filter (S6.3): OFF by default so the hub shows only real/final
  // outputs (server excludes drafts + dedupes). Toggle surfaces the "Robocze" set.
  const [showDrafts, setShowDrafts] = useState(false);
  /* D-06: wybor zbioru danych zakladki Sheets — podniesiony z wlasnego paska
     SheetsTabContent do Menu 2 (patrz `rightControls`). DEC-423d: segment jest
     dzis UKRYTY (wraca w Fali 2 · 3.17), wiec stan trzyma sie na 'list'. */
  const [sheetsSubView] = useState<SheetsSubView>('list');
  /* Biblioteka wzorcow: Galeria | Tabela — podniesione z wlasnego rzedu w
     tresci zakladki do Menu 2 (DEC-423d). */
  const templatesGalleryEnabled = isTemplatesGalleryEnabled();
  const [templatesInnerView, setTemplatesInnerView] = useState<'gallery' | 'table'>('gallery');

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const artifactId = params.get('artifactId');
    const deck = params.get('deck');
    if (!artifactId && deck) {
      params.set('artifactId', deck);
      params.delete('deck');
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('reports_presentations');

  /* `useReports` zostaje wyłącznie dla `fetchReports` (pociąga listę przy
     przełączeniu „Robocze"); sama lista raportów nie jest już czytana w hubie —
     zakładka Dokumenty rysuje `artifactOutputRows`. */
  const { fetchReports } = useReports();
  const {
    presentations,
    loading: presLoading,
    error: presentationsError,
    fetchPresentations,
  } = usePresentations();
  const {
    templates,
    loading: templatesLoading,
    error: templatesError,
    fetchTemplates,
  } = useTemplates();
  const actions = useRapActions();

  const libraryView =
    activeTab === 'outputs_all'
      ? 'all'
      : activeTab === 'outputs_documents'
        ? 'all'
        : activeTab === 'outputs_mine'
          ? 'mine'
          : activeTab === 'outputs_review'
            ? 'review'
            : null;
  const {
    rows: artifactOutputRows,
    loading: artifactOutputsLoading,
    error: artifactOutputsError,
    moduleDisabled: artifactOutputsModuleDisabled,
    refetch: refetchArtifactOutputs,
  } = useArtifactOutputsList(libraryView);
  const {
    rows: sheetRows,
    loading: sheetsLoading,
    error: sheetsError,
    fetchSheets,
  } = useSheetOutputs();

  const [bundleHistoryOpen, setBundleHistoryOpen] = useState(false);
  // Licznik zwiększany po udanej generacji Kompletu AI → wymusza refetch historii.
  const [bundleRefresh, setBundleRefresh] = useState(0);

  // Re-pull the active list whenever the "Pokaż robocze" toggle flips. Each
  // fetcher accepts includeDrafts and appends ?include=drafts server-side.
  useEffect(() => {
    void refetchArtifactOutputs(showDrafts);
    void fetchReports(showDrafts);
    void fetchPresentations(showDrafts);
    void fetchSheets(showDrafts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDrafts]);

  // #83: Menu 2 = 5 TYPES only (owner canon "Menu 2 = types"):
  // All · Documents · Presentations · Sheets · Template Library. Non-type views
  // `Mine` / `Needs review` are personal scopes, not artifact types, so they no
  // longer sit in the tab bar (still reachable via ?tab= deep links + the Filters
  // dropdown's Visibility/Review facets). `Data` already folded under Sheets.
  const tabs = useMemo(
    () => [
      {
        id: 'outputs_all' as ModuleTab,
        label: t('rap.outputs.tabs.all', 'All'),
        icon: <LayoutGrid size={16} />,
      },
      {
        id: 'outputs_documents' as ModuleTab,
        label: t('rap.outputs.tabs.documents', 'Documents'),
        icon: <FileText size={16} />,
      },
      {
        id: 'presentations' as ModuleTab,
        label: t('rap.tabs.presentations', 'Presentations'),
        icon: <Presentation size={16} />,
      },
      {
        id: 'outputs_sheets' as ModuleTab,
        label: t('rap.outputs.tabs.sheets', 'Sheets'),
        icon: <Table2 size={16} />,
      },
      {
        id: 'templates' as ModuleTab,
        label: t('rap.tabs.templates', 'Template Library'),
        icon: <BookTemplate size={16} />,
      },
      // Kanon 2026-07-26: Architekt szablonów (Deck) NIE jest zakładką Menu 1 —
      // niezależnie od stanu isDeckArchitectEnabled(). Otwiera się wewnątrz
      // zakładki "Szablony" (patrz `templatesView` + TemplatesNewSplitButton
      // poniżej), zgodnie z docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md §3.
      // 2026-09-02 (owner decyzja „nie" na gen-excel-templates-tab, 08-30):
      // zdjęty zdublowany wpis "Generator szablonów (Arkusz)" z tego menu —
      // isWorkbookTemplatesEnabled() był domyślnie OFF wszędzie i nawet ON
      // wołał dokładnie ten sam handler co kafel "Excel" w "Nowy szablon"
      // (handleTemplateLauncherSelect('spreadsheet', 'blank')). Ekran końcowy
      // kreatora (`templatesView === 'workbookTemplates'`, ExceleParametricTemplates)
      // ZOSTAJE — to żywy landing po zapisie szablonu i cel `resolveTemplateUsePath`
      // dla sheet_template. Szczegóły: docs/program/grafika/ANALIZA_ODRZUCONE_20260901.md §1.
    ],
    [t]
  );

  const ctaLabels: Record<RapTab, string> = useMemo(
    () => ({
      outputs_all: t('rap.outputs.cta.new', 'New material'),
      outputs_mine: t('rap.outputs.cta.new', 'New material'),
      outputs_review: t('rap.outputs.cta.new', 'New material'),
      outputs_documents: t('rap.actions.newDocument', 'New document'),
      presentations: t('rap.actions.newPresentation', 'New presentation'),
      // Odblokowane 2026-07-24 (item 3 briefu Materiały-entry) — Sheets dostaje
      // realne „Dodaj" (tablica format→tryb), tak jak Documents/Presentations/All.
      outputs_sheets: t('rap.actions.newSheet', 'New sheet'),
      templates: t('rap.actions.newTemplate', 'New template'),
      template_architect: '',
      workbook_templates: '',
    }),
    [t]
  );

  // Materiały wspólny launcher (2026-07-24, Harvard/wdrozenie-100/_MATERIALY_INWENTARYZACJA_2026-07-24.md
  // §8) — dwustopniowa tablica KROK 1 (format) → KROK 2 (tryb), nawiguje do
  // REALNEGO edytora zamiast openChatWithContext (dawne handleLauncherSelect
  // z templateId ginącym w kontekście czatu — martwa ścieżka, usunięta).
  type MaterialFormat = 'document' | 'presentation' | 'spreadsheet';
  type MaterialStart = 'blank' | 'ai' | 'from_template';

  const [materialsLauncherOpen, setMaterialsLauncherOpen] = useState(false);
  const [materialsLauncherFormat, setMaterialsLauncherFormat] = useState<MaterialFormat | null>(
    null
  );

  const openMaterialsLauncher = useCallback((defaultFormat: MaterialFormat | null) => {
    setMaterialsLauncherFormat(defaultFormat);
    setMaterialsLauncherOpen(true);
  }, []);

  // KROK 1 → KROK 2 → nawigacja do realnego silnika (mapa: brief §"FAKTY Z
  // INWENTARYZACJI"). `entry`/`view=new` — sygnał trybu czytany przez
  // DocumentStudioView/PrezentacjeView/ExceleView (patrz te pliki, 2026-07-24).
  const handleMaterialsLauncherSelect = useCallback(
    (format: MaterialFormat, start: MaterialStart) => {
      setMaterialsLauncherOpen(false);
      if (format === 'document') {
        navigate(
          start === 'blank'
            ? '/document-studio?entry=blank'
            : start === 'ai'
              ? '/document-studio?entry=ai'
              : '/document-studio?entry=template'
        );
      } else if (format === 'presentation') {
        navigate(
          start === 'blank'
            ? '/prezentacje?view=new&entry=blank'
            : start === 'ai'
              ? '/prezentacje?view=new&entry=ai'
              : // "Z szablonu" — brak konkretnego templateId na tym kroku (KROK 2
                // nie wybiera pojedynczego szablonu), więc lądujemy na ekranie
                // wyboru szablonu Decka (ArtifactModuleHome „Templates"), zgodnie
                // z tym, co robi własny TriModeChooser Prezentacji (onTemplate).
                '/prezentacje'
        );
      } else {
        navigate(
          start === 'blank'
            ? '/excele?view=new&entry=blank'
            : start === 'ai'
              ? '/excele?view=new&entry=ai'
              : // "Z szablonu" — jw., ekran wyboru szablonu Excela (ArtifactModuleHome).
                '/excele?view=home'
        );
      }
    },
    [navigate]
  );

  const materialsFormatTiles = useMemo(
    () => [
      {
        id: 'document' as MaterialFormat,
        icon: FileText,
        title: t('rap.materialsLauncher.document', 'Dokument'),
      },
      {
        id: 'presentation' as MaterialFormat,
        icon: Presentation,
        title: t('rap.materialsLauncher.presentation', 'Prezentacja'),
      },
      {
        id: 'spreadsheet' as MaterialFormat,
        icon: FileSpreadsheet,
        title: t('rap.materialsLauncher.spreadsheet', 'Arkusz Excel'),
      },
    ],
    [t]
  );

  const materialsModeTiles = useMemo(
    () => [
      {
        id: 'blank' as MaterialStart,
        icon: PenLine,
        title: t('rap.materialsLauncher.blankTitle', 'Czysto'),
        desc: t(
          'rap.materialsLauncher.blankDesc',
          'Ręczny start — pusty artefakt w edytorze, bez AI.'
        ),
      },
      {
        id: 'ai' as MaterialStart,
        icon: Sparkles,
        title: t('rap.materialsLauncher.aiTitle', 'Z AI'),
        desc: t('rap.materialsLauncher.aiDesc', 'Opisz brief — AI zbuduje pierwszą wersję.'),
      },
      {
        id: 'from_template' as MaterialStart,
        icon: LayoutTemplate,
        title: t('rap.materialsLauncher.templateTitle', 'Z szablonu'),
        desc: t('rap.materialsLauncher.templateDesc', 'Wybierz istniejący szablon i dostosuj.'),
      },
    ],
    [t]
  );

  // Analogiczna tablica dla Biblioteki szablonów (item 4 briefu): typ szablonu
  // → tryb → architekt danego formatu (nie artefakt — kolejny SZABLON).
  // Architekci mają dziś JEDEN przepływ (AI-plan + wybór+klon istniejącego w
  // tej samej liście) — 3 kafle trybu prowadzą świadomie do TEGO SAMEGO
  // ekranu; realne różnicowanie wejścia per tryb w architekcie = osobna
  // robota (poza zakresem entry-only, patrz renderNotes handoffu).
  type TemplateFormat = 'document' | 'presentation' | 'spreadsheet';
  type TemplateStart = 'blank' | 'ai' | 'from_existing';

  const [templateLauncherOpen, setTemplateLauncherOpen] = useState(false);

  const handleTemplateLauncherSelect = useCallback(
    (format: TemplateFormat, _start: TemplateStart) => {
      setTemplateLauncherOpen(false);
      if (format === 'document') {
        navigate('/document-studio?tab=templates');
        return;
      }
      if (format === 'spreadsheet') {
        setTemplateBuilderOpen(true);
        return;
      }
      const targetTab = 'template_architect';
      const params = new URLSearchParams(location.search || '');
      params.set('tab', targetTab);
      navigate(`${location.pathname}?${params.toString()}`);
    },
    [navigate, location.pathname, location.search]
  );

  // "← Szablony" — returns from an embedded architect view to the Template
  // Library table, inside the SAME tab (no Menu 1 tab change). Also normalizes
  // the URL back to `?tab=templates` so a refresh doesn't re-open the architect.
  const handleBackToTemplatesLibrary = useCallback(() => {
    setTemplatesView('library');
    const params = new URLSearchParams(location.search || '');
    params.set('tab', RAP_TAB_TO_QUERY.templates);
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  }, [navigate, location.pathname, location.search]);

  const templateFormatTiles = useMemo(
    () => [
      {
        id: 'document' as TemplateFormat,
        icon: FileText,
        title: t('rap.templatesLauncher.document', 'Word'),
      },
      {
        id: 'presentation' as TemplateFormat,
        icon: Presentation,
        title: t('rap.templatesLauncher.presentation', 'Prezentacja'),
      },
      {
        id: 'spreadsheet' as TemplateFormat,
        icon: FileSpreadsheet,
        title: t('rap.templatesLauncher.spreadsheet', 'Excel'),
      },
    ],
    [t]
  );

  const templateModeTiles = useMemo(
    () => [
      {
        id: 'blank' as TemplateStart,
        icon: PenLine,
        title: t('rap.templatesLauncher.blankTitle', 'Od czystego'),
        desc: t('rap.templatesLauncher.blankDesc', 'Nowy szablon od zera w architekcie.'),
      },
      {
        id: 'ai' as TemplateStart,
        icon: Sparkles,
        title: t('rap.templatesLauncher.aiTitle', 'Z AI'),
        desc: t('rap.templatesLauncher.aiDesc', 'Opisz szablon — architekt zaplanuje strukturę.'),
      },
      {
        id: 'from_existing' as TemplateStart,
        icon: LayoutTemplate,
        title: t('rap.templatesLauncher.existingTitle', 'Na bazie istniejącego'),
        desc: t('rap.templatesLauncher.existingDesc', 'Sklonuj zatwierdzony szablon i dostosuj.'),
      },
    ],
    [t]
  );

  // #83c/#83d legacy: TemplateBuilderFlow (wizard→builder) pozostaje w kodzie
  // (state + render niżej, NIE kasowany) ale od 2026-07-24 „Dodaj" w Bibliotece
  // szablonów otwiera zamiast niego tablicę format→tryb→architekt (item 4
  // briefu Materiały-entry — decyzja świadoma, patrz handoff/renderNotes).
  const [templateBuilderOpen, setTemplateBuilderOpen] = useState(false);
  const [templateProvenanceOpen, setTemplateProvenanceOpen] = useState(false);

  const handleNewItem = useCallback(() => {
    switch (activeTab) {
      // Documents/Presentations/Sheets/All(+Mine/Review) — wspólna dwustopniowa
      // tablica Materiałów (KROK 1 format, KROK 2 tryb), NIE gated przez
      // isDeliverablesLightEnabled już (bramka była martwa: flaga nigdy nie ON
      // w env). Tablica to zwykły React-modal bez zależności zewnętrznych, więc
      // nie ma dziś warunku „niedostępności" do fallbacku — jeśli kiedyś
      // zajdzie taka potrzeba, dopisać awaryjny navigate() tutaj.
      case 'outputs_documents':
        openMaterialsLauncher('document');
        break;
      case 'presentations':
        openMaterialsLauncher('presentation');
        break;
      case 'outputs_sheets':
        openMaterialsLauncher('spreadsheet');
        break;
      case 'templates':
        setTemplateLauncherOpen(true);
        break;
      case 'outputs_all':
      case 'outputs_mine':
      case 'outputs_review':
        openMaterialsLauncher(null);
        break;
      default:
        break;
    }
  }, [activeTab, openMaterialsLauncher]);

  // Keep route-driven entry stable (e.g. /presentations should open "presentations" tab).
  // This also supports direct links like /reports?tab=templates.
  React.useEffect(() => {
    setActiveTab(initialTab);
    setActiveFilters([]);
    setTemplatesView(initialTemplatesView);
    // Bez tego wiersza „Edytuj" z kebaba działa TYLKO przy zimnym wejściu:
    // hub jest już zamontowany, adres się zmienia, `useState(initial…)` nie.
    // `null` nie zeruje wyboru zrobionego wewnątrz buildera (patrz
    // `setWorkbookTemplateId(id)` po zapisie) — nadpisujemy wyłącznie wtedy,
    // gdy adres realnie NIESIE identyfikator.
    if (initialWorkbookTemplateId) setWorkbookTemplateId(initialWorkbookTemplateId);
    // AGENT_WZORCE_SYSTEMOWE_ATESTACJA_20260905 — `?openProvenance=1`
    // (`resolveTemplateProvenancePath`, przycisk „Przejdź do Pochodzenie i
    // prawa" na komunikacie 409 TEMPLATE_PROVENANCE_UNVERIFIED w Document
    // Studio / Report Builder / Prezentacje) otwiera dialog od razu, zamiast
    // zostawiać użytkownika na samej liście szablonów.
    if (initialOpenProvenance) setTemplateProvenanceOpen(true);
  }, [initialTab, initialTemplatesView, initialWorkbookTemplateId, initialOpenProvenance]);

  const setWorkspaceContext = useConversationStore((s) => s.setWorkspaceContext);
  React.useEffect(() => {
    if (activeTab === 'templates') {
      setWorkspaceContext({
        type: 'templates' as any,
        view: 'PRESENTATIONS_TEMPLATES',
        entityData: { tab: 'templates' },
      } as any);
    }
  }, [activeTab, setWorkspaceContext]);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const setSinglePreset = useCallback(
    (column: string, value: string | null, label?: string, color?: string) => {
      setActiveFilters((prev) => {
        const without = prev.filter((f) => f.column !== column);
        if (!value) return without;
        return [
          ...without,
          { id: `${column}:${value}`, column, value, label: label || value, color },
        ];
      });
    },
    []
  );

  /**
   * ── Jedno źródło wierszy zakładki ─────────────────────────────────────────
   * Liczniki dropdownów Menu 2 i chipów Menu 3 czytają DOKŁADNIE ten sam
   * zbiór, co tabela zakładki. Regres 05.09 (licznik czytał `status`, tabela
   * `statusKey`) wziął się z dwóch osobnych ścieżek — tutaj jest jedna.
   */
  const tabRows = useMemo<ReadonlyArray<Record<string, unknown>>>(() => {
    const asRows = (rows: unknown[]) => rows as ReadonlyArray<Record<string, unknown>>;
    if (activeTab === 'templates') return asRows(templates);
    if (activeTab === 'presentations') return asRows(presentations);
    if (activeTab === 'outputs_sheets') return asRows(sheetRows);
    if (activeTab === 'outputs_documents')
      return asRows(artifactOutputRows.filter((row) => row.kind === 'document'));
    return asRows(artifactOutputRows);
  }, [activeTab, artifactOutputRows, presentations, sheetRows, templates]);

  const statusCountScope: MaterialsStatusCountScope =
    activeTab === 'templates'
      ? 'templates'
      : activeTab === 'presentations'
        ? 'presentations'
        : activeTab === 'outputs_sheets'
          ? 'outputs_sheets'
          : activeTab === 'outputs_documents'
            ? 'outputs_documents'
            : 'outputs_all';

  const tabStatusCounts = useMemo(
    () => countRowsByStatus(tabRows, statusCountScope),
    [tabRows, statusCountScope]
  );

  /**
   * Pełna lista statusów zakładki — JEDNO źródło dla dropdownu Status (Menu 2)
   * i chipów Menu 3, żeby etykieta tego samego statusu nie rozjechała się
   * między dwoma menu.
   */
  const tabStatusOptions = useMemo(() => {
    type StatusMetaEntry = { label: string; labelPl: string; dotColor: string };
    const fromMeta = <K extends string>(meta: Record<K, StatusMetaEntry>) =>
      (Object.entries(meta) as Array<[string, StatusMetaEntry]>).map(([value, m]) => ({
        value,
        label: isPolish ? m.labelPl || m.label : m.label,
        dotColor: m.dotColor,
      }));

    if (activeTab === 'templates') return fromMeta(TEMPLATE_STATUS_META);
    if (activeTab === 'presentations') return fromMeta(PRESENTATION_STATUS_META);
    // Wszystkie / Dokumenty / Arkusze — wiersze `UnifiedOutputRow` niosą
    // `statusKey` z pełnej siedmiostanowej ścieżki dostarczenia; REPORT_STATUS_META
    // pokrywa tylko 4 z nich, więc lista jest budowana wprost.
    return [
      { value: 'draft', label: t('rap.filters.status.draft', 'Draft'), dotColor: 'bg-slate-400' },
      {
        value: 'generated',
        label: t('rap.filters.status.generated', 'Generated'),
        dotColor: 'bg-blue-400',
      },
      {
        value: 'editing',
        label: t('rap.filters.status.editing', 'Editing'),
        dotColor: 'bg-amber-400',
      },
      {
        value: 'ready',
        label: isPolish
          ? REPORT_STATUS_META.ready.labelPl || REPORT_STATUS_META.ready.label
          : REPORT_STATUS_META.ready.label,
        dotColor: 'bg-emerald-400',
      },
      {
        value: 'exported',
        label: t('rap.filters.status.exported', 'Exported'),
        dotColor: 'bg-blue-400',
      },
      {
        value: 'shared',
        label: t('rap.filters.status.shared', 'Shared'),
        dotColor: 'bg-blue-400',
      },
      {
        value: 'archived',
        label: t('rap.filters.status.archived', 'Archived'),
        dotColor: 'bg-slate-500',
      },
    ];
  }, [activeTab, isPolish, t]);

  /* Biblioteka wzorców — zbiór po samej wyszukiwarce; liczniki fasetowe chipów
     Menu 3 (format/źródło) muszą być liczone na TYM zbiorze, nie na zbiorze po
     filtrach, żeby licznik chipa nie zależał od filtra, który sam reprezentuje. */
  const templatesAfterSearch = useMemo(
    () => filterTemplatesBySearch(templates, searchQuery),
    [templates, searchQuery]
  );

  const rightControls = useMemo(() => {
    // Embedded architect views own their own chrome — the Template Library's
    // status-filter controls don't apply to them.
    if (activeTab === 'templates' && templatesView !== 'library') return null;

    // `shrink-0 whitespace-nowrap` — P6_CZERWIEN_I_1440 §5 krok 4: bez tego
    // przy 1440 px etykieta „Pochodzenie i prawa" łamie się na dwie linie i
    // rozpycha cały pasek w pionie (zmierzone zrzutem 06.09).
    const chipBase =
      'h-9 inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-medium border transition-colors';

    /* D-06 (2026-07-27) segment „Arkusze | Źródła danych" stał TUTAJ.
       DEC-423d (właściciel, 06.09.2026): zakładka Arkuszy ma mieć ten sam
       układ Menu 2, co pozostałe — wybór zbioru „Źródła danych" wraca w Fali 2
       (3.17). Kod przełącznika i `sheetsSubView` ZOSTAJĄ (SheetsTabContent
       czyta `subView`), po prostu nic go dziś nie renderuje; `sheetsSubView`
       trzyma się na 'list'. */

    /**
     * DEC-423 (właściciel, 06.09.2026): „to filtrowanie w prawym górnym rogu
     * trzeba doprowadzić do standardu, czyli rozwijanej listy. Zostają dwa
     * rozwijane filtry, a to dziwne coś usuń." + DEC-423b/c/d (16:25–16:41):
     * ten SAM układ Menu 2 w każdej zakładce.
     *
     * WYMIARY (rozstrzygnięcie 1.1-M-2, patrz meldunek):
     *  · Status  = stan dokumentu (`status`/`statusKey`) + pozycja „Robocze",
     *    która przejęła rolę pstryczka „Pokaż robocze" (zakres POBRANIA:
     *    `?include=drafts`, serwerowy filtr śmieci M17 — NIE jest to status
     *    „Szkic", patrz `isDraftHeuristicTitle` w artifactRegistryService.ts).
     *  · Widoczność = kto i na jakim etapie obiegu widzi artefakt: kolumna
     *    `visibilityScope` ORAZ `publishState` (dawne „Review" z popovera).
     *    To jeden wymiar udostępniania, więc jeden dropdown; oba zestawy
     *    opcji filtruje `OutputsAggregateTabContent`.
     */
    const activeStatusFilter = activeFilters.find((f) => f.column === 'status');
    const activeVisibilityFilter = activeFilters.find(
      (f) => f.column === 'visibilityScope' || f.column === 'publishState'
    );

    const statusDropdownValue = showDrafts
      ? '__drafts__'
      : activeStatusFilter
        ? String(activeStatusFilter.value)
        : '__all__';

    // Martwe opcje (0 wierszy) nie wchodzą do listy — chyba że są aktualnie
    // wybrane, żeby wybór nie zniknął spod kursora.
    const statusDropdownOptions = [
      { id: '__all__', label: t('common.all', 'All'), count: tabRows.length },
      { id: '__drafts__', label: t('rap.filters.drafts', 'Robocze') },
      ...tabStatusOptions
        .map((o) => ({
          id: o.value,
          label: o.label,
          count: tabStatusCounts[String(o.value).toLowerCase()] || 0,
        }))
        .filter((o) => o.count > 0 || o.id === statusDropdownValue),
    ];

    const visibilityOptions = [
      {
        column: 'visibilityScope',
        value: 'private',
        label: t('rap.outputs.visibility.private', 'Private'),
      },
      {
        column: 'visibilityScope',
        value: 'review_shared',
        label: t('rap.outputs.visibility.reviewShared', 'Review shared'),
      },
      {
        column: 'visibilityScope',
        value: 'project',
        label: t('rap.outputs.visibility.project', 'Project'),
      },
      {
        column: 'visibilityScope',
        value: 'organization',
        label: t('rap.outputs.visibility.organization', 'Organization'),
      },
      { column: 'visibilityScope', value: 'demo', label: t('rap.outputs.visibility.demo', 'Demo') },
      // Dawne „Review" z popovera (DEC-423, przywrócone jako część wymiaru
      // widoczności — nie jako trzeci dropdown).
      {
        column: 'publishState',
        value: 'private_draft',
        label: t('rap.outputs.review.privateDraft', 'Private draft'),
      },
      {
        column: 'publishState',
        value: 'reviewable_share',
        label: t('rap.outputs.review.reviewableShare', 'Reviewable share'),
      },
      {
        column: 'publishState',
        value: 'in_review',
        label: t('rap.outputs.review.inReview', 'In review'),
      },
      {
        column: 'publishState',
        value: 'approved',
        label: t('rap.outputs.review.approved', 'Approved'),
      },
      {
        column: 'publishState',
        value: 'published',
        label: t('rap.outputs.review.published', 'Published'),
      },
      {
        column: 'publishState',
        value: 'archived',
        label: t('rap.outputs.review.archived', 'Archived'),
      },
    ] as const;

    const governanceCount = (column: string, value: string) =>
      tabRows.filter((row) => {
        const governance = (row as { governance?: Record<string, unknown> }).governance;
        return String(governance?.[column] ?? '') === value;
      }).length;

    const visibilityDropdownValue = activeVisibilityFilter
      ? `${activeVisibilityFilter.column}:${activeVisibilityFilter.value}`
      : '__all__';

    const visibilityDropdownOptions = [
      { id: '__all__', label: t('common.all', 'All'), count: tabRows.length },
      ...visibilityOptions
        .map((o) => ({
          id: `${o.column}:${o.value}`,
          label: o.label,
          count: governanceCount(o.column, o.value),
        }))
        .filter((o) => o.count > 0 || o.id === visibilityDropdownValue),
    ];

    /* Biblioteka wzorców NIE dostaje dropdownu „Widoczność": jej wymiar
       widoczności to `scope` (Osobisty/System/Organizacja/Nieznany), a ten —
       decyzją właściciela z 06.09 („ten cały pasek powinien wjechać do menu
       trzeciego") — mieszka w Menu 3 razem z formatami. Drugi, równoległy
       dropdown o tym samym znaczeniu byłby dubletem. */
    const showVisibilityDropdown = activeTab !== 'templates';

    return (
      <div className="relative flex items-center gap-2">
        {activeTab === 'templates' ? (
          <button
            type="button"
            onClick={() => setTemplateProvenanceOpen(true)}
            className={`${chipBase} bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`}
            title={t('rap.templates.provenanceQueue', 'Pochodzenie i prawa')}
            data-testid="materials-provenance-btn"
          >
            <ShieldCheck size={16} />
            <span>{t('rap.templates.provenanceQueue', 'Pochodzenie i prawa')}</span>
          </button>
        ) : null}
        <Menu2PresetDropdown
          className="shrink-0"
          compact
          label={t('rap.filters.statusLabel', 'Status')}
          options={statusDropdownOptions}
          value={statusDropdownValue}
          onChange={(id) => {
            if (id === '__drafts__') {
              setShowDrafts(true);
              setSinglePreset('status', null);
              return;
            }
            setShowDrafts(false);
            if (id === '__all__') {
              setSinglePreset('status', null);
              return;
            }
            const opt = tabStatusOptions.find((o) => o.value === id);
            setSinglePreset('status', id, opt?.label, opt?.dotColor);
          }}
          data-testid="materials-status-dropdown"
        />
        {showVisibilityDropdown ? (
          <Menu2PresetDropdown
            className="shrink-0"
            compact
            label={t('rap.outputs.columns.visibility', 'Visibility')}
            options={visibilityDropdownOptions}
            value={visibilityDropdownValue}
            onChange={(id) => {
              setSinglePreset('visibilityScope', null);
              setSinglePreset('publishState', null);
              if (id === '__all__') return;
              const opt = visibilityOptions.find((o) => `${o.column}:${o.value}` === id);
              if (!opt) return;
              setSinglePreset(opt.column, opt.value, opt.label, 'bg-slate-400');
            }}
            data-testid="materials-visibility-dropdown"
          />
        ) : null}
        {/* Biblioteka wzorców — pstryczek Galeria|Tabela zamiast standardowego
            pstryczka lista/kafle (DEC-423d). Stał wcześniej we WŁASNYM rzędzie
            w treści zakładki, czyli jako czwarta warstwa nagłówkowa. */}
        {activeTab === 'templates' && templatesGalleryEnabled ? (
          /* Kształt 1:1 z kanonicznym pstryczkiem widoku (`ModuleNavBar`,
             lista/kafle): same ikony, bez etykiet. Pomiar 1440 px z 06.09:
             wersja z podpisami („Galeria"/„Tabela", 170 px) wypychała CTA
             „Nowy wzorzec" poza pasek (koniec 1450 px przy krawędzi 1392).
             Nazwy zostają w `title`/`aria-label`. */
          <div
            data-testid="templates-gallery-view-toggle"
            role="group"
            aria-label={t('rap.templates.viewToggle', 'Widok biblioteki wzorców')}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-c-border-subtle p-1"
          >
            {(
              [
                ['gallery', LayoutGrid, t('rap.templates.viewGallery', 'Galeria')],
                ['table', Table2, t('rap.templates.viewTable', 'Tabela')],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                data-testid={`templates-gallery-view-toggle-${id}`}
                onClick={() => setTemplatesInnerView(id)}
                aria-pressed={templatesInnerView === id}
                aria-label={label}
                title={label}
                className={`inline-flex items-center rounded-full p-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                  templatesInnerView === id
                    ? 'bg-state-selected text-c-text'
                    : 'text-c-text-secondary hover:bg-state-hover'
                }`}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }, [
    activeFilters,
    activeTab,
    setSinglePreset,
    showDrafts,
    t,
    tabRows,
    tabStatusCounts,
    tabStatusOptions,
    templatesGalleryEnabled,
    templatesInnerView,
    templatesView,
    setTemplateProvenanceOpen,
  ]);

  const commandRowLeftSlot = useMemo(() => {
    // Same rationale as rightControls above — embedded architect views have
    // no filterable list, so Menu 3 chips would apply to nothing.
    if (activeTab === 'templates' && templatesView !== 'library') return null;

    const chipActive = MENU_3_CHIP_ACTIVE;
    const chipInactive = MENU_3_CHIP_INACTIVE;
    const badgeActive = MENU_3_BADGE_ACTIVE;
    const badgeInactive = MENU_3_BADGE_INACTIVE;

    const allChip = (active: boolean, count: number, onClick: () => void) => (
      <button
        type="button"
        onClick={onClick}
        className={active ? chipActive : chipInactive}
        title={t('common.all', 'All')}
        data-testid="materials-menu3-chip-all"
      >
        <span className={MENU_3_ALL_DOT_CLASS} />
        <span>{t('common.all', 'All')}</span>
        <span className={active ? badgeActive : badgeInactive}>{count}</span>
      </button>
    );

    /* Wszystkie — chipy TYPU materiału (Dokument/Prezentacja/Tabela).
       Właściciel ich nie kwestionował, zostają bez zmian. */
    if (
      activeTab === 'outputs_all' ||
      activeTab === 'outputs_mine' ||
      activeTab === 'outputs_review'
    ) {
      const kindCounts = artifactOutputRows.reduce(
        (acc, r) => {
          acc[r.kind] = (acc[r.kind] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
      const kindChips = [
        {
          value: 'document',
          label: t('rap.outputs.kind.document', 'Document'),
          dot: 'bg-blue-400',
        },
        {
          value: 'presentation',
          label: t('rap.outputs.kind.presentation', 'Presentation'),
          dot: 'bg-blue-400',
        },
        { value: 'sheet', label: t('rap.outputs.kind.sheet', 'Sheet'), dot: 'bg-emerald-400' },
      ];
      const kindActive = (v: string) =>
        activeFilters.some((f) => f.column === 'outputKind' && f.value === v);

      return (
        <div className={MENU_3_LEFT_CLASS} data-testid="materials-menu3-row">
          {allChip(
            !activeFilters.some((f) => f.column === 'outputKind'),
            artifactOutputRows.length,
            () => setSinglePreset('outputKind', null)
          )}
          {kindChips.map((c) => {
            const active = kindActive(c.value);
            return (
              <button
                key={c.value}
                type="button"
                onClick={() =>
                  setSinglePreset('outputKind', active ? null : c.value, c.label, c.dot)
                }
                className={active ? chipActive : chipInactive}
                title={c.label}
                data-testid={`materials-menu3-chip-${c.value}`}
              >
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span>{c.label}</span>
                <span className={active ? badgeActive : badgeInactive}>
                  {kindCounts[c.value] || 0}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    /**
     * Biblioteka wzorców — DEC-423d (właściciel, 06.09.2026): „ten cały pasek
     * powinien wjechać do menu trzeciego; w Menu 2 zostawić tylko Pochodzenie
     * i prawa". Pasek formatów i źródeł stał w OSOBNYM rzędzie w treści
     * zakładki (wewnątrz `TemplatesGalleryView`) — czyli poza kanonem Menu 1/2/3
     * i tylko w widoku Galerii, mimo że filtruje oba widoki. Tutaj jest jeden
     * rząd Menu 3, wspólny dla Galerii i Tabeli. Osiem chipów STATUSU, które
     * stały w tym miejscu, przeniosło się do dropdownu Status w Menu 2.
     */
    if (activeTab === 'templates') {
      const currentType = activeFilters.find((f) => f.column === 'type')?.value as
        | TemplateType
        | undefined;
      const currentScope = activeFilters.find((f) => f.column === 'scope')?.value as
        | TemplateScope
        | undefined;

      const typeCount = (type: TemplateType | null) =>
        templatesAfterSearch.filter(
          (item) =>
            (type === null || item.type === type) &&
            (currentScope === undefined || item.scope === currentScope)
        ).length;
      const scopeCount = (scope: TemplateScope | null) =>
        templatesAfterSearch.filter(
          (item) =>
            (scope === null || item.scope === scope) &&
            (currentType === undefined || item.type === currentType)
        ).length;

      return (
        <div className={MENU_3_LEFT_CLASS} data-testid="materials-menu3-row">
          <Menu3Chip
            active={!currentType}
            onClick={() => setSinglePreset('type', null)}
            data-testid="materials-menu3-chip-all"
          >
            {t('rap.templates.allFormats', 'Wszystkie formaty')}
            <Menu3Badge count={typeCount(null)} active={!currentType} />
          </Menu3Chip>
          {TEMPLATE_TYPE_ORDER.map((type) => (
            <Menu3Chip
              key={type}
              active={currentType === type}
              onClick={() =>
                setSinglePreset(
                  'type',
                  currentType === type ? null : type,
                  TEMPLATE_TYPE_LABEL_PLURAL[type]
                )
              }
              data-testid={`materials-menu3-chip-type-${type}`}
            >
              {TEMPLATE_TYPE_LABEL_PLURAL[type]}
              <Menu3Badge count={typeCount(type)} active={currentType === type} />
            </Menu3Chip>
          ))}
          <span className="mx-1.5 h-4 w-px bg-c-border" aria-hidden="true" />
          <Menu3Chip
            active={!currentScope}
            onClick={() => setSinglePreset('scope', null)}
            data-testid="materials-menu3-chip-all-scopes"
          >
            {t('rap.templates.allScopes', 'Wszystkie źródła')}
            <Menu3Badge count={scopeCount(null)} active={!currentScope} />
          </Menu3Chip>
          {TEMPLATE_SCOPE_ORDER.map((scope) => (
            <Menu3Chip
              key={scope}
              active={currentScope === scope}
              onClick={() =>
                setSinglePreset(
                  'scope',
                  currentScope === scope ? null : scope,
                  templateScopeLabel(t, scope)
                )
              }
              data-testid={`materials-menu3-chip-scope-${scope}`}
            >
              {templateScopeLabel(t, scope)}
              <Menu3Badge count={scopeCount(scope)} active={currentScope === scope} />
            </Menu3Chip>
          ))}
        </div>
      );
    }

    /**
     * Dokumenty · Prezentacje · Arkusze — DEC-423c (właściciel, 06.09.2026):
     * „tak jak w Dokumentach", czyli JEDEN rząd o tym samym kształcie, ≤3
     * chipy (Menu 2 ma nad nim dropdown z pełną listą statusów). Wcześniej:
     * Dokumenty 5 chipów, Prezentacje 7, Arkusze martwy chip „Tabela 26"
     * (nieklikalny licznik, który niczego nie filtrował).
     */
    const MENU_3_STATUSES = ['draft', 'ready'];
    const statusActive = (value: string) =>
      activeFilters.some((f) => f.column === 'status' && String(f.value).toLowerCase() === value);

    return (
      <div className={MENU_3_LEFT_CLASS} data-testid="materials-menu3-row">
        {allChip(!activeFilters.some((f) => f.column === 'status'), tabRows.length, () =>
          setSinglePreset('status', null)
        )}
        {MENU_3_STATUSES.map((value) => {
          const option = tabStatusOptions.find((o) => o.value === value);
          if (!option) return null;
          const active = statusActive(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() =>
                setSinglePreset('status', active ? null : value, option.label, option.dotColor)
              }
              className={active ? chipActive : chipInactive}
              title={option.label}
              data-testid={`materials-menu3-chip-${value}`}
            >
              <span className={`w-2 h-2 rounded-full ${option.dotColor}`} />
              <span>{option.label}</span>
              <span className={active ? badgeActive : badgeInactive}>
                {tabStatusCounts[value] || 0}
              </span>
            </button>
          );
        })}
      </div>
    );
  }, [
    activeFilters,
    activeTab,
    artifactOutputRows,
    setSinglePreset,
    t,
    tabRows,
    tabStatusCounts,
    tabStatusOptions,
    templatesAfterSearch,
    templatesView,
  ]);

  /**
   * P-27 (Piotr, 2026-07-27): „w trzecim menu `New AI document` i `Discuss` —
   * przecież mamy to w innym miejscu."
   *
   * Prawa strona Menu 3 jest PUSTA:
   *   - „+ New AI document (Document Studio)" → usunięty 07-27 (D-01): dublował
   *     kontekstowe CTA Menu 2, prowadzące do tej samej ścieżki
   *     `/document-studio?entry=ai`.
   *   - „Discuss" → usunięty tu (07-28): ta sama pozycja żyje w kebabie wiersza,
   *     i to w wersji użyteczniejszej (czat o KONKRETNYM dokumencie zamiast
   *     o całej zakładce).
   * Pusta prawa strona jest zgodna z kanonem — tak wygląda cały moduł Interview.
   */
  const commandRowRightSlot = null;

  // Canonical Menu 3: one flex row (MENU_3_INNER_CLASS = flex items-center justify-between).
  // ModuleNavBar voids commandRowRightContent; merge both sides into commandRowContent.
  const commandRowContent = useMemo(
    () => (
      <div className={MENU_3_INNER_CLASS}>
        {commandRowLeftSlot}
        <div className={MENU_3_RIGHT_CLASS}>{commandRowRightSlot}</div>
      </div>
    ),
    [commandRowLeftSlot, commandRowRightSlot]
  );

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
  }, [setActiveDocumentId]);

  const handleCloseDocument = useCallback(
    (id: string) => {
      setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocumentId === id) setActiveDocumentId(null);
    },
    [activeDocumentId, setActiveDocumentId, setOpenDocuments]
  );

  // Shared "← Szablony" header bar for the two embedded architect sub-views —
  // one visual pattern, reused for both (kanon: no bespoke per-screen chrome).
  const renderTemplatesArchitectBackBar = (testId: string) => (
    <div className="shrink-0 border-b border-c-border-subtle px-4 py-2">
      <button
        type="button"
        onClick={handleBackToTemplatesLibrary}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-c-text-secondary transition-colors hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        data-testid={testId}
      >
        <ArrowLeft size={14} />
        {t('rap.templates.backToLibrary', 'Szablony')}
      </button>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'outputs_all':
      case 'outputs_mine':
      case 'outputs_review':
        return (
          <OutputsAggregateTabContent
            viewMode={viewMode}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            rows={artifactOutputRows}
            loading={artifactOutputsLoading}
            error={artifactOutputsError}
            moduleDisabled={artifactOutputsModuleDisabled}
            onRefresh={refetchArtifactOutputs}
            actions={actions}
            initialArtifactId={initialArtifactId}
          />
        );
      case 'templates':
        // Kanon 2026-07-26: architekci szablonów otwierają się WEWNĄTRZ tej
        // zakładki jako tryb widoku, nie jako osobne Menu 1 zakładki (usunięte
        // powyżej z `tabs`). Deep linki `?tab=template_architect` /
        // `?tab=workbook_templates` nadal działają — patrz initialTemplatesView.
        if (templatesView === 'deckArchitect') {
          return (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              {renderTemplatesArchitectBackBar('templates-architect-back')}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <PresentationTemplateArchitectView />
              </div>
            </div>
          );
        }
        if (templatesView === 'workbookTemplates') {
          return (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              {renderTemplatesArchitectBackBar('templates-workbook-back')}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ExceleParametricTemplates
                  isPolish={isPolish}
                  initialTemplateId={workbookTemplateId}
                />
              </div>
            </div>
          );
        }
        return (
          <TemplatesTabContent
            viewMode="table"
            innerView={templatesInnerView}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            templates={templates}
            loading={templatesLoading}
            error={templatesError}
            onRefresh={fetchTemplates}
            actions={{ startArtifactReview: actions.startArtifactReview }}
            initialArtifactId={initialArtifactId}
          />
        );
      case 'outputs_documents':
        return (
          <OutputsAggregateTabContent
            viewMode={viewMode}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            rows={artifactOutputRows.filter((row) => row.kind === 'document')}
            loading={artifactOutputsLoading}
            error={artifactOutputsError}
            moduleDisabled={artifactOutputsModuleDisabled}
            onRefresh={refetchArtifactOutputs}
            actions={actions}
            initialArtifactId={initialArtifactId}
          />
        );
      case 'presentations':
        return (
          <PresentationsTabContent
            viewMode={viewMode}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            presentations={presentations}
            loading={presLoading}
            error={presentationsError}
            onRefresh={fetchPresentations}
            actions={actions}
            initialArtifactId={initialArtifactId}
          />
        );
      case 'outputs_sheets':
        return (
          <SheetsTabContent
            subView={sheetsSubView}
            viewMode={viewMode}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            rows={sheetRows}
            loading={sheetsLoading}
            error={sheetsError}
            onRefresh={fetchSheets}
            actions={actions}
            initialArtifactId={initialArtifactId}
          />
        );
      default:
        return null;
    }
  };

  // "New template" CTA gains a secondary menu (Architekt szablonów) when the
  // deck architect flag is ON — the ONLY way to reach it now (kanon: no Menu 1
  // siblings). Reuses `handleTemplateLauncherSelect`'s existing navigation
  // (sets `?tab=...`, which `initialTemplatesView` resolves into the embedded
  // view) instead of duplicating navigation logic. `undefined` outside the
  // Templates library view — ModuleHub then falls back to its plain
  // `onNewItem` button.
  // 2026-09-02: dropped the "Generator szablonów (Arkusz)" entry — see the
  // kanon note above `tabs` for why (owner decyzja „nie" on gen-excel-templates-tab).
  /**
   * DEC-423d (właściciel, 06.09.2026): „Nowy wzorzec" jest ZAMROŻONY do Fali 2 —
   * dokładnie tak, jak „Nowy audyt" (DEC-417): natywnie `disabled` + powód w
   * tooltipie (`StandardPrimaryCta.disabled`/`disabledReason`), nie znika i nie
   * udaje działającego. Split-button z wejściem do Architekta szablonów ZOSTAJE
   * w kodzie (nie kasujemy) — po prostu nic go dziś nie renderuje. Typ `boolean`
   * (nie literal `true`) świadomie: to jeden przełącznik do odmrożenia w Fali 2.
   */
  const TEMPLATES_CTA_FROZEN: boolean = true;
  const TEMPLATES_CTA_FROZEN_REASON = t('rap.templates.ctaFrozen', 'Tworzenie wzorców w fali 2');

  const templatesLibraryCta =
    !TEMPLATES_CTA_FROZEN && activeTab === 'templates' && templatesView === 'library'
      ? (() => {
          const showDeckArchitect = isDeckArchitectEnabled();
          if (!showDeckArchitect) return undefined;
          return (
            <TemplatesNewSplitButton
              label={ctaLabels.templates}
              onNewTemplate={handleNewItem}
              onOpenDeckArchitect={() => handleTemplateLauncherSelect('presentation', 'blank')}
            />
          );
        })()
      : undefined;

  return (
    <div className="h-full" data-testid="reports-presentations-hub">
      <StandardModuleBar
        tabs={tabs}
        activeTab={activeTab as ModuleTab}
        onTabChange={(tab) => {
          const next = tab as RapTab;
          setActiveTab(next);
          setActiveFilters([]);
          const q = RAP_TAB_TO_QUERY[next];
          const params = new URLSearchParams(location.search || '');
          params.set('tab', q);
          navigate(`${location.pathname}?${params.toString()}`, { replace: true });
        }}
        showTabCounts={false}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openItems={openDocuments}
        activeItemId={activeDocumentId}
        onSelectItem={setActiveDocumentId}
        onCloseItem={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        primaryCta={
          // Sheets odblokowane 2026-07-24 (item 3) — dostaje tablicę jak
          // Documents/Presentations/All. Embedded architect views (templatesView
          // !== 'library') to NARZĘDZIA bez semantyki „nowy" — CTA ukryte, tak
          // jak wcześniej dla osobnych zakładek template_architect/workbook_templates.
          // DEC-423d: kanoniczny `primaryCta` (zamiast `onNewItem`) — tylko on
          // umie stan ZAMROŻONY („Nowy wzorzec", jak „Nowy audyt" w Audytach).
          activeTab === 'templates' && templatesView !== 'library'
            ? undefined
            : {
                label: ctaLabels[activeTab],
                onClick: handleNewItem,
                testId: 'outputs-new-btn',
                disabled: activeTab === 'templates' && TEMPLATES_CTA_FROZEN,
                disabledReason:
                  activeTab === 'templates' && TEMPLATES_CTA_FROZEN
                    ? TEMPLATES_CTA_FROZEN_REASON
                    : undefined,
              }
        }
        primaryCtaContent={templatesLibraryCta}
        /* Biblioteka wzorców steruje widokiem własnym pstryczkiem Galeria|Tabela
           w Menu 2 (DEC-423d), więc standardowy segment lista/kafle jest tam
           ukryty (jeden tryb ⇒ ModuleNavBar go nie rysuje). */
        viewModes={activeTab === 'templates' ? ['table'] : ['table', 'grid']}
        filterControls={rightControls}
        commandRowContent={commandRowContent}
      >
        <div className="h-full min-h-0 overflow-hidden">{renderTabContent()}</div>
      </StandardModuleBar>
      {/* Materiały — wspólne „Dodaj" (Documents/Presentations/Sheets/All), item 1-3
          briefu Materiały-entry 2026-07-24. Zastępuje martwy OutputsLauncherModal
          (nadal istnieje w repo, `./OutputsLauncherModal.tsx`, nieużywany z tego
          miejsca — legacy nie skasowany, tylko odpięty). */}
      <CreateFormatModeLauncher<MaterialFormat, MaterialStart>
        isOpen={materialsLauncherOpen}
        onClose={() => setMaterialsLauncherOpen(false)}
        title={t('rap.materialsLauncher.title', 'Nowy materiał')}
        stepOneHint={t('rap.materialsLauncher.subtitle', 'Wybierz format')}
        stepTwoTitle={() => t('rap.materialsLauncher.chooseMode', 'Jak chcesz zacząć?')}
        stepTwoHint={() =>
          t('rap.materialsLauncher.modeHint', 'Wybierz tryb — wszystkie trzy są równorzędne.')
        }
        formatTiles={materialsFormatTiles}
        modeTiles={materialsModeTiles}
        defaultFormat={materialsLauncherFormat}
        onSelect={handleMaterialsLauncherSelect}
        testId="materials-create-launcher"
      />

      {/* Biblioteka szablonów — „Dodaj" analogiczny, item 4 briefu Materiały-entry
          2026-07-24: typ szablonu → tryb → architekt danego formatu. */}
      <CreateFormatModeLauncher<TemplateFormat, TemplateStart>
        isOpen={templateLauncherOpen}
        onClose={() => setTemplateLauncherOpen(false)}
        title={t('rap.templatesLauncher.title', 'Nowy szablon')}
        stepOneHint={t('rap.templatesLauncher.subtitle', 'Wybierz typ szablonu')}
        stepTwoTitle={() => t('rap.materialsLauncher.chooseMode', 'Jak chcesz zacząć?')}
        stepTwoHint={() =>
          t('rap.materialsLauncher.modeHint', 'Wybierz tryb — wszystkie trzy są równorzędne.')
        }
        formatTiles={templateFormatTiles}
        modeTiles={templateModeTiles}
        onSelect={handleTemplateLauncherSelect}
        testId="template-library-create-launcher"
      />
      <TemplateProvenanceApprovalDialog
        open={templateProvenanceOpen}
        onClose={() => setTemplateProvenanceOpen(false)}
        onApproved={() => void refetchArtifactOutputs(showDrafts)}
      />

      {/* #83c/#83d — „Nowy szablon" (Biblioteka wzorców) → wizard→builder, za flagą
          isTemplateBuilderEnabled. TemplateBuilderShell jest h-screen (mysli że jest
          root) — owijamy w fixed inset-0 z-modal, tak jak inne pełnoekranowe nakładki. */}
      {templateBuilderOpen && (
        <div className="fixed inset-0 z-modal" data-testid="template-builder-overlay">
          <TemplateBuilderFlow
            initialType="table"
            onClose={() => setTemplateBuilderOpen(false)}
            onSaved={(id) => {
              setTemplateBuilderOpen(false);
              setActiveTab('templates');
              setTemplatesView('workbookTemplates');
              setWorkbookTemplateId(id);
              const params = new URLSearchParams(location.search || '');
              params.set('tab', 'workbook_templates');
              params.set('workbookTemplateId', id);
              navigate(`${location.pathname}?${params.toString()}`, { replace: true });
              toast.success(
                t(
                  'rap.templateBuilder.savedBuildNow',
                  'Szablon zapisany — wybierz „Zbuduj skoroszyt”'
                )
              );
              void fetchTemplates();
            }}
          />
        </div>
      )}

      {/* W3.8 / W4.4 — Komplet AI bundle history (only when deliverables premium is enabled) */}
      {isDeliverablesLightEnabled() && (
        <div className="mx-4 mb-4 mt-2">
          {/* Section header with collapse toggle */}
          <button
            onClick={() => setBundleHistoryOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left text-sm font-semibold text-c-text-secondary transition-colors hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            aria-expanded={bundleHistoryOpen}
            data-testid="bundle-history-toggle"
          >
            <Package2 className="h-4 w-4 shrink-0 text-blue-500" />
            <span className="flex-1">
              {t('rap.bundles.sectionTitle', 'Komplet AI — historia generacji')}
            </span>
            {bundleHistoryOpen ? (
              <ChevronUp className="h-4 w-4 text-c-text-muted" />
            ) : (
              <ChevronDown className="h-4 w-4 text-c-text-muted" />
            )}
          </button>

          {bundleHistoryOpen && (
            <div className="mt-2">
              <BundleHistoryPanel refreshSignal={bundleRefresh} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsAndPresentationsHub;
