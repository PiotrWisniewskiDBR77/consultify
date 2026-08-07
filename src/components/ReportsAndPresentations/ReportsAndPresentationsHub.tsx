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
  Filter,
  LayoutGrid,
  LayoutTemplate,
  Package2,
  PenLine,
  Presentation,
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
import { MATERIAL_VISUAL_IDENTITY } from '@/components/shared/materialsVisualIdentity';
import { PersistedTemplateBuilder, TemplateBuilderFlow } from '@/components/TemplateBuilder';
import { isDeliverablesLightEnabled } from '@/services/deliverablesGeneration';
import { useConversationStore } from '@/store/useConversationStore';
import { isDeckArchitectEnabled } from '@/utils/deckArchitectFlag';
import { isWorkbookTemplatesEnabled } from '@/utils/workbookTemplatesFlag';

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
} from '../shared/ModuleMenu3';
import { StandardModuleBar } from '../standard/StandardModuleBar';
import { BundleHistoryPanel } from './BundleHistoryPanel';
import { OutputsAggregateTabContent } from './OutputsAggregateTabContent';
import { parseRapTabFromQuery, RAP_TAB_TO_QUERY } from './outputsLibraryTabQuery';
import { PresentationsTabContent } from './PresentationsTabContent';
import { ReportsTabContent } from './ReportsTabContent';
import { type SheetsSubView, SheetsTabContent } from './SheetsTabContent';
import { TemplatesTabContent } from './TemplatesTabContent';
import type {
  PresentationSourceType,
  PresentationStatus,
  RapTab,
  ReportStatus,
  TemplateStatus,
} from './types';
import {
  PRESENTATION_STATUS_META,
  REPORT_STATUS_META,
  SOURCE_TYPE_META,
  TEMPLATE_STATUS_META,
} from './types';
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
  onOpenWorkbookTemplates?: () => void;
}

const TemplatesNewSplitButton: React.FC<TemplatesNewSplitButtonProps> = ({
  label,
  onNewTemplate,
  onOpenDeckArchitect,
  onOpenWorkbookTemplates,
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

  if (!onOpenDeckArchitect && !onOpenWorkbookTemplates) {
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
          {onOpenWorkbookTemplates && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenWorkbookTemplates();
              }}
              data-testid="templates-open-workbook-templates"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-c-text transition-colors duration-150 hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <FileSpreadsheet size={14} className="shrink-0 text-c-text-muted" />
              <span>
                {t('rap.templatesLauncher.openWorkbookTemplates', 'Generator szablonów (Arkusz)')}
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
    initialWorkbookId,
    initialEditWorkbookTemplateId,
  } = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    const fromQuery = parseRapTabFromQuery(params.get('tab'));
    let tab: RapTab;
    let templatesView: TemplatesLibraryView = 'library';
    if (fromQuery === 'template_architect') {
      tab = 'templates';
      templatesView = 'deckArchitect';
    } else if (fromQuery === 'workbook_templates') {
      tab = 'templates';
      templatesView = 'workbookTemplates';
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
      initialWorkbookTemplateId: params.get('workbookTemplateId') || null,
      initialWorkbookId: params.get('workbookId') || null,
      initialEditWorkbookTemplateId: params.get('editWorkbookTemplateId') || null,
    };
  }, [location.pathname, location.search]);

  const [activeTab, setActiveTab] = useState<RapTab>(initialTab);
  // Internal sub-view of the 'templates' tab — see kanon note above initialTab.
  const [templatesView, setTemplatesView] = useState<TemplatesLibraryView>(initialTemplatesView);
  const [workbookTemplateId, setWorkbookTemplateId] = useState<string | null>(
    initialWorkbookTemplateId
  );
  const [editWorkbookTemplateId, setEditWorkbookTemplateId] = useState<string | null>(
    initialEditWorkbookTemplateId
  );
  useEffect(() => {
    // `Use template` navigates inside this already-mounted hub. Keep the
    // selected template in sync with the URL so the form opens immediately;
    // relying on useState's initializer made the same deep link work only
    // after a full page reload.
    setWorkbookTemplateId(initialWorkbookTemplateId);
  }, [initialWorkbookTemplateId]);
  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    setEditWorkbookTemplateId(params.get('editWorkbookTemplateId') || null);
  }, [location.search]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  // M17 junk filter (S6.3): OFF by default so the hub shows only real/final
  // outputs (server excludes drafts + dedupes). Toggle surfaces the "Robocze" set.
  const [showDrafts, setShowDrafts] = useState(false);
  /* D-06: wybor zbioru danych zakladki Sheets — podniesiony z wlasnego paska
     SheetsTabContent do Menu 2 (patrz `rightControls`). */
  const [sheetsSubView, setSheetsSubView] = useState<SheetsSubView>('list');

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

  const { reports, loading: reportsLoading, error: reportsError, fetchReports } = useReports();
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

  const [filtersOpen, setFiltersOpen] = useState(false);
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
    void fetchTemplates(showDrafts);
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
      // Kanon 2026-07-26: Architekt szablonów (Deck) i Generator szablonów
      // (Excel) NIE są zakładkami Menu 1 — niezależnie od stanu
      // isDeckArchitectEnabled()/isWorkbookTemplatesEnabled(). Otwierają się
      // wewnątrz zakładki "Szablony" (patrz `templatesView` + TemplatesNewSplitButton
      // poniżej), zgodnie z docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md §3.
    ],
    [t]
  );

  const ctaLabels: Record<RapTab, string> = useMemo(
    () => ({
      outputs_all: t('rap.outputs.cta.new', 'New output'),
      outputs_mine: t('rap.outputs.cta.new', 'New output'),
      outputs_review: t('rap.outputs.cta.new', 'New output'),
      outputs_documents: t('rap.actions.newReport', 'New report'),
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
                '/excele'
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
        icon: MATERIAL_VISUAL_IDENTITY.document.templateIcon,
        title: t('rap.templatesLauncher.document', 'Szablon dokumentu Word'),
        hint: t(
          'rap.templatesLauncher.documentHint',
          'Raporty zarządcze, memoranda i dokumenty z kontrolowanym układem sekcji.'
        ),
      },
      {
        id: 'presentation' as TemplateFormat,
        icon: MATERIAL_VISUAL_IDENTITY.presentation.templateIcon,
        title: t('rap.templatesLauncher.presentation', 'Szablon prezentacji'),
        hint: t(
          'rap.templatesLauncher.presentationHint',
          'Narracja slajdowa, layouty i reguły wizualne dla prezentacji decyzyjnych.'
        ),
      },
      {
        id: 'spreadsheet' as TemplateFormat,
        icon: MATERIAL_VISUAL_IDENTITY.spreadsheet.templateIcon,
        title: t('rap.templatesLauncher.spreadsheet', 'Szablon skoroszytu Excel'),
        hint: t(
          'rap.templatesLauncher.spreadsheetHint',
          'Modele, budżety i trackery z arkuszami, formułami oraz walidacją danych.'
        ),
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
  }, [initialTab, initialTemplatesView]);

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

  const toggleFilter = useCallback(
    (column: string, value: string, label: string, color?: string) => {
      setActiveFilters((prev) => {
        const exists = prev.some((f) => f.column === column && f.value === value);
        if (exists) return prev.filter((f) => !(f.column === column && f.value === value));
        return [...prev, { id: `${column}:${value}`, column, value, label, color }];
      });
    },
    []
  );

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

  const rightControls = useMemo(() => {
    // Embedded architect views own their own chrome — the Template Library's
    // drafts-toggle/status-filter controls don't apply to them.
    if (activeTab === 'templates' && templatesView !== 'library') return null;

    const chipBase =
      'h-9 inline-flex items-center gap-2 rounded-full px-3 text-sm font-medium border transition-colors';

    const activeCount = activeFilters.length;

    const draftsToggle = (
      <button
        type="button"
        onClick={() => setShowDrafts((v) => !v)}
        className={`${chipBase} ${
          showDrafts
            ? 'bg-c-accent-soft text-c-text border-c-border'
            : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised'
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`}
        title={t('rap.filters.showDrafts', 'Pokaż robocze')}
        aria-pressed={showDrafts}
      >
        <span>{t('rap.filters.showDrafts', 'Pokaż robocze')}</span>
      </button>
    );

    if (activeTab === 'outputs_sheets') {
      /**
       * D-06 (Piotr, P-28, 2026-07-27): „Mamy przycisk Sheets albo Data sources.
       * Wrzuciłbym wybór — czy oglądamy arkusze, czy źródła danych — do drugiego
       * menu po prawej stronie. Dzięki temu podniesiemy całą tabelę."
       *
       * Przełącznik stał wcześniej we WŁASNYM pasku wewnątrz `SheetsTabContent`,
       * czyli jako czwarta warstwa nagłówkowa (Menu 1 + Menu 2 + Menu 3 + on).
       * Kanon zna wyłącznie Menu 1/2/3, a wybór zbioru danych to filtr — więc
       * jego miejsce jest tutaj, obok pozostałych kontrolek Menu 2.
       */
      const zakresy: Array<{ id: SheetsSubView; label: string }> = [
        { id: 'list', label: t('rap.outputs.tabs.sheets', 'Sheets') },
        { id: 'data', label: t('rap.sheets.subtabs.data', 'Data sources') },
      ];
      return (
        <div className="relative flex items-center gap-2">
          <div
            role="tablist"
            aria-label={t('rap.sheets.subtabs.label', 'Sheets sections')}
            data-testid="rap-sheets-subtabs"
            className="inline-flex items-center gap-1 rounded-full border border-c-border-subtle p-1"
          >
            {zakresy.map((z) => (
              <button
                key={z.id}
                type="button"
                role="tab"
                aria-selected={sheetsSubView === z.id}
                onClick={() => setSheetsSubView(z.id)}
                data-testid={`rap-sheets-subtab-${z.id}`}
                className={`h-7 rounded-full px-3 text-xs font-medium transition-colors ${
                  sheetsSubView === z.id
                    ? 'bg-c-accent-soft text-c-text'
                    : 'text-c-text-secondary hover:bg-c-surface-raised'
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`}
              >
                {z.label}
              </button>
            ))}
          </div>
          {draftsToggle}
        </div>
      );
    }

    const isAggregateTab =
      activeTab === 'outputs_all' || activeTab === 'outputs_mine' || activeTab === 'outputs_review';

    const statusOptions =
      activeTab === 'templates'
        ? ([
            {
              value: 'active',
              label: t('rap.filters.status.active', 'Active'),
              dotColor: 'bg-emerald-400',
            },
            {
              value: 'draft',
              label: t('rap.filters.status.draft', 'Draft'),
              dotColor: 'bg-slate-400',
            },
            {
              value: 'archived',
              label: t('rap.filters.status.archived', 'Archived'),
              dotColor: 'bg-slate-500',
            },
          ] as Array<{ value: TemplateStatus; label: string; dotColor: string }>)
        : activeTab === 'outputs_documents'
          ? (Object.entries(REPORT_STATUS_META).map(([value, meta]) => ({
              value: value as ReportStatus,
              label: isPolish ? meta.labelPl || meta.label : meta.label,
              dotColor: meta.dotColor,
            })) as Array<{ value: ReportStatus; label: string; dotColor: string }>)
          : activeTab === 'presentations'
            ? (Object.entries(PRESENTATION_STATUS_META).map(([value, meta]) => ({
                value: value as PresentationStatus,
                label: isPolish ? meta.labelPl || meta.label : meta.label,
                dotColor: meta.dotColor,
              })) as Array<{ value: PresentationStatus; label: string; dotColor: string }>)
            : isAggregateTab
              ? ([
                  {
                    value: 'draft',
                    label: t('rap.filters.status.draft', 'Draft'),
                    dotColor: 'bg-slate-400',
                  },
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
                ] as Array<{ value: string; label: string; dotColor: string }>)
              : [];

    const sourceOptions =
      activeTab === 'presentations'
        ? (Object.entries(SOURCE_TYPE_META).map(([value, meta]) => ({
            value: value as PresentationSourceType,
            label: isPolish ? meta.labelPl || meta.label : meta.label,
            color: meta.color,
          })) as Array<{ value: PresentationSourceType; label: string; color: string }>)
        : [];

    const kindOptions = isAggregateTab
      ? ([
          {
            value: 'document',
            label: t('rap.outputs.kind.document', 'Document'),
            color: 'text-blue-400',
          },
          {
            value: 'presentation',
            label: t('rap.outputs.kind.presentation', 'Presentation'),
            color: 'text-blue-400',
          },
          {
            value: 'sheet',
            label: t('rap.outputs.kind.sheet', 'Sheet'),
            color: 'text-emerald-400',
          },
        ] as Array<{ value: string; label: string; color: string }>)
      : [];

    const visibilityOptions = isAggregateTab
      ? ([
          {
            value: 'private',
            label: t('rap.outputs.visibility.private', 'Private'),
          },
          {
            value: 'review_shared',
            label: t('rap.outputs.visibility.reviewShared', 'Review shared'),
          },
          {
            value: 'project',
            label: t('rap.outputs.visibility.project', 'Project'),
          },
          {
            value: 'organization',
            label: t('rap.outputs.visibility.organization', 'Organization'),
          },
          {
            value: 'demo',
            label: t('rap.outputs.visibility.demo', 'Demo'),
          },
        ] as Array<{ value: string; label: string }>)
      : [];

    const reviewStateOptions = isAggregateTab
      ? ([
          {
            value: 'private_draft',
            label: t('rap.outputs.review.privateDraft', 'Private draft'),
          },
          {
            value: 'reviewable_share',
            label: t('rap.outputs.review.reviewableShare', 'Reviewable share'),
          },
          {
            value: 'in_review',
            label: t('rap.outputs.review.inReview', 'In review'),
          },
          {
            value: 'approved',
            label: t('rap.outputs.review.approved', 'Approved'),
          },
          {
            value: 'published',
            label: t('rap.outputs.review.published', 'Published'),
          },
          {
            value: 'archived',
            label: t('rap.outputs.review.archived', 'Archived'),
          },
        ] as Array<{ value: string; label: string }>)
      : [];

    const reportCanon =
      activeTab === 'outputs_documents' ? (
        <div className="mr-2 hidden xl:flex items-center gap-2">
          {[
            ['R1', t('rap.reportCanon.r1', 'Weekly Execution')],
            ['R2', t('rap.reportCanon.r2', 'Steering Committee')],
            ['R3', t('rap.reportCanon.r3', 'Benefits Tracking')],
            ['R4', t('rap.reportCanon.r4', 'Portfolio Overview')],
          ].map(([code, label]) => {
            const checked = activeFilters.some(
              (f) => f.column === 'reportType' && f.value === code
            );
            return (
              <button
                key={code}
                type="button"
                onClick={() =>
                  setSinglePreset(
                    'reportType',
                    checked ? null : code,
                    `${code} · ${label}`,
                    'bg-slate-400'
                  )
                }
                className={`h-8 rounded-full px-3 text-[11px] font-medium border inline-flex items-center gap-2 transition-colors ${
                  checked
                    ? 'bg-c-accent-soft text-c-text border-c-border'
                    : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised'
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`}
                title={label}
              >
                <span className="font-semibold">{code}</span>
                <span className="truncate max-w-[120px]">{label}</span>
              </button>
            );
          })}
        </div>
      ) : null;

    return (
      <div className="relative flex items-center gap-2">
        {draftsToggle}
        {reportCanon}
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`${chipBase} ${
            activeCount > 0
              ? 'bg-c-accent-soft text-c-text border-c-border'
              : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised'
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`}
          title={t('common.filters', 'Filters')}
        >
          <Filter size={16} />
          <span>{t('common.filters', 'Filters')}</span>
          {activeCount > 0 ? <span className={MENU_3_BADGE_ACTIVE}>{activeCount}</span> : null}
        </button>

        {filtersOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              onClick={() => setFiltersOpen(false)}
              aria-label={t('common.close', 'Close')}
            />
            <div className="absolute right-0 mt-2 z-50 w-[320px] rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl overflow-hidden">
              <div className="p-3 border-b border-c-border-subtle">
                <div className="text-xs font-semibold text-c-text">
                  {t('common.filters', 'Filters')}
                </div>
                <div className="text-[11px] text-c-text-muted mt-0.5">
                  {t('rap.filters.hint', 'Pick statuses and (optionally) sources.')}
                </div>
              </div>

              <div className="p-3 space-y-4 max-h-[360px] overflow-y-auto">
                {statusOptions.length > 0 ? (
                  <div>
                    <div className="text-[11px] font-semibold text-c-text-secondary mb-2">
                      {t('rap.filters.status', 'Status')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {statusOptions.map((o) => {
                        const checked = activeFilters.some(
                          (f) => f.column === 'status' && f.value === o.value
                        );
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => toggleFilter('status', o.value, o.label, o.dotColor)}
                            className={`h-8 rounded-full px-3 text-[11px] font-medium border inline-flex items-center gap-2 transition-colors ${
                              checked
                                ? 'bg-c-accent-soft text-c-text border-c-border'
                                : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised'
                            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`}
                          >
                            <span className={`w-2 h-2 rounded-full ${o.dotColor}`} />
                            <span className="truncate">{o.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {kindOptions.length > 0 ? (
                  <div>
                    <div className="text-[11px] font-semibold text-c-text-secondary mb-2">
                      {t('rap.outputs.filters.kind', 'Output type')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {kindOptions.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => toggleFilter('outputKind', o.value, o.label)}
                          className={`h-8 rounded-full px-3 text-[11px] font-medium border inline-flex items-center gap-2 transition-colors ${
                            activeFilters.some(
                              (f) => f.column === 'outputKind' && f.value === o.value
                            )
                              ? 'bg-c-accent-soft text-c-text border-c-border'
                              : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised'
                          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`}
                        >
                          <span className={`text-[11px] font-semibold ${o.color}`}>{o.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {visibilityOptions.length > 0 ? (
                  <div>
                    <div className="text-[11px] font-semibold text-c-text-secondary mb-2">
                      {t('rap.outputs.columns.visibility', 'Visibility')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {visibilityOptions.map((o) => {
                        const checked = activeFilters.some(
                          (f) => f.column === 'visibilityScope' && f.value === o.value
                        );
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() =>
                              toggleFilter('visibilityScope', o.value, o.label, 'bg-slate-400')
                            }
                            className={`h-8 rounded-full px-3 text-[11px] font-medium border inline-flex items-center gap-2 transition-colors ${
                              checked
                                ? 'bg-c-accent-soft text-c-text border-c-border'
                                : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised'
                            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`}
                          >
                            <span className="truncate">{o.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {reviewStateOptions.length > 0 ? (
                  <div>
                    <div className="text-[11px] font-semibold text-c-text-secondary mb-2">
                      {t('rap.outputs.columns.review', 'Review')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {reviewStateOptions.map((o) => {
                        const checked = activeFilters.some(
                          (f) => f.column === 'publishState' && f.value === o.value
                        );
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() =>
                              toggleFilter('publishState', o.value, o.label, 'bg-blue-400')
                            }
                            className={`h-8 rounded-full px-3 text-[11px] font-medium border inline-flex items-center gap-2 transition-colors ${
                              checked
                                ? 'bg-c-accent-soft text-c-text border-c-border'
                                : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised'
                            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`}
                          >
                            <span className="truncate">{o.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {sourceOptions.length > 0 ? (
                  <div>
                    <div className="text-[11px] font-semibold text-c-text-secondary mb-2">
                      {t('rap.filters.source', 'Source')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {sourceOptions.map((o) => {
                        const checked = activeFilters.some(
                          (f) => f.column === 'sourceType' && f.value === o.value
                        );
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => toggleFilter('sourceType', o.value, o.label)}
                            className={`h-8 rounded-full px-3 text-[11px] font-medium border inline-flex items-center gap-2 transition-colors ${
                              checked
                                ? 'bg-c-accent-soft text-c-text border-c-border'
                                : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised'
                            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`}
                          >
                            <span className={`text-[11px] font-semibold ${o.color}`}>
                              {o.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="p-3 border-t border-c-border-subtle flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveFilters([])}
                  className="text-[11px] text-c-text-muted hover:text-c-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  {t('common.clearAll', 'Clear all')}
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="h-8 px-3 rounded-full text-[11px] font-medium bg-c-text text-c-surface hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  {t('common.done', 'Done')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }, [
    activeFilters,
    activeTab,
    filtersOpen,
    setSinglePreset,
    sheetsSubView,
    showDrafts,
    t,
    templatesView,
    toggleFilter,
  ]);

  const commandRowLeftSlot = useMemo(() => {
    // Same rationale as rightControls above — embedded architect views have
    // no filterable list, so Menu 3 status chips would apply to nothing.
    if (activeTab === 'templates' && templatesView !== 'library') return null;

    const chipBase = '';
    const chipActive = MENU_3_CHIP_ACTIVE;
    const chipInactive = MENU_3_CHIP_INACTIVE;
    const badgeBase = '';
    const badgeActive = MENU_3_BADGE_ACTIVE;
    const badgeInactive = MENU_3_BADGE_INACTIVE;

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
        {
          value: 'sheet',
          label: t('rap.outputs.kind.sheet', 'Sheet'),
          dot: 'bg-emerald-400',
        },
      ];
      const kindActive = (v: string) =>
        activeFilters.some((f) => f.column === 'outputKind' && f.value === v);

      return (
        <div className={MENU_3_LEFT_CLASS}>
          <button
            type="button"
            onClick={() => setSinglePreset('outputKind', null)}
            className={`${chipBase} ${
              !activeFilters.some((f) => f.column === 'outputKind') ? chipActive : chipInactive
            }`}
            title={t('common.all', 'All')}
          >
            <span className={MENU_3_ALL_DOT_CLASS} />
            <span>{t('common.all', 'All')}</span>
            <span
              className={`${badgeBase} ${
                !activeFilters.some((f) => f.column === 'outputKind') ? badgeActive : badgeInactive
              }`}
            >
              {artifactOutputRows.length}
            </span>
          </button>
          {kindChips.map((c) => {
            const active = kindActive(c.value);
            const count = kindCounts[c.value] || 0;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() =>
                  setSinglePreset('outputKind', active ? null : c.value, c.label, c.dot)
                }
                className={`${chipBase} ${active ? chipActive : chipInactive}`}
                title={c.label}
              >
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span>{c.label}</span>
                <span className={`${badgeBase} ${active ? badgeActive : badgeInactive}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    if (activeTab === 'outputs_sheets') {
      return (
        <div className={MENU_3_LEFT_CLASS}>
          <span className={MENU_3_CHIP_ACTIVE}>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{t('rap.outputs.kind.sheet', 'Sheets')}</span>
            <span className={MENU_3_BADGE_ACTIVE}>{sheetRows.length}</span>
          </span>
        </div>
      );
    }

    const items =
      activeTab === 'templates'
        ? templates
        : activeTab === 'outputs_documents'
          ? reports
          : presentations;

    const statusKey = 'status' as const;

    const counts = (items || []).reduce(
      (acc, it: any) => {
        const s = String(it?.[statusKey] ?? '').toLowerCase();
        if (!s) return acc;
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // ★ Chipy dla 'templates' MUSZĄ pokrywać wszystkie statusy realnie zapisywane
    // przez `mapTemplateStatus` (useRapData.ts): approved/published/draft/deprecated/unknown.
    // Zahardkodowana lista active/draft/deprecated/archived była ślepa na
    // published/approved — większość szablonów typu Report (report_builder_templates)
    // ma status 'published', więc chipy pokazywały 0/0/0/0 mimo realnej zawartości.
    // Wzorzec identyczny jak outputs_documents/outputs_presentations poniżej.
    const statusChips =
      activeTab === 'templates'
        ? (Object.entries(TEMPLATE_STATUS_META).map(([value, meta]) => ({
            value,
            label: isPolish ? meta.labelPl || meta.label : meta.label,
            dot: meta.dotColor,
          })) as Array<{ value: string; label: string; dot: string }>)
        : activeTab === 'outputs_documents'
          ? (Object.entries(REPORT_STATUS_META).map(([value, meta]) => ({
              value,
              label: isPolish ? meta.labelPl || meta.label : meta.label,
              dot: meta.dotColor,
            })) as Array<{ value: string; label: string; dot: string }>)
          : (Object.entries(PRESENTATION_STATUS_META).map(([value, meta]) => ({
              value,
              label: isPolish ? meta.labelPl || meta.label : meta.label,
              dot: meta.dotColor,
            })) as Array<{ value: string; label: string; dot: string }>);

    const isActive = (value: string) =>
      activeFilters.some((f) => f.column === 'status' && String(f.value).toLowerCase() === value);

    return (
      <div className={MENU_3_LEFT_CLASS}>
        <button
          type="button"
          onClick={() => setSinglePreset('status', null)}
          className={`${chipBase} ${
            !activeFilters.some((f) => f.column === 'status') ? chipActive : chipInactive
          }`}
          title={t('common.all', 'All')}
        >
          <span className={MENU_3_ALL_DOT_CLASS} />
          <span>{t('common.all', 'All')}</span>
          <span
            className={`${badgeBase} ${
              !activeFilters.some((f) => f.column === 'status') ? badgeActive : badgeInactive
            }`}
          >
            {items.length}
          </span>
        </button>

        {statusChips.map((c) => {
          const active = isActive(String(c.value).toLowerCase());
          const key = String(c.value);
          const count = counts[String(c.value).toLowerCase()] || 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSinglePreset('status', active ? null : key, c.label, c.dot)}
              className={`${chipBase} ${active ? chipActive : chipInactive}`}
              title={c.label}
            >
              <span className={`w-2 h-2 rounded-full ${c.dot}`} />
              <span>{c.label}</span>
              <span className={`${badgeBase} ${active ? badgeActive : badgeInactive}`}>
                {count}
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
    presentations,
    reports,
    setSinglePreset,
    t,
    templates,
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
                  initialWorkbookId={initialWorkbookId}
                  onBuilt={(built) => {
                    const params = new URLSearchParams(location.search || '');
                    params.set('tab', 'workbook_templates');
                    params.set('workbookId', built.id);
                    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
                  }}
                />
              </div>
            </div>
          );
        }
        return (
          <TemplatesTabContent
            viewMode={viewMode}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
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
          <ReportsTabContent
            viewMode={viewMode}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            reports={reports}
            loading={reportsLoading}
            error={reportsError}
            onRefresh={fetchReports}
            actions={actions}
            initialArtifactId={initialArtifactId}
            onNewItem={handleNewItem}
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

  // "New template" CTA gains a secondary menu (Architekt szablonów / Generator
  // szablonów) whenever at least one of the two architect flags is ON — the
  // ONLY way to reach either architect now (kanon: no Menu 1 siblings). Reuses
  // `handleTemplateLauncherSelect`'s existing navigation (sets `?tab=...`,
  // which `initialTemplatesView` resolves into the embedded view) instead of
  // duplicating navigation logic. `undefined` outside the Templates library
  // view — ModuleHub then falls back to its plain `onNewItem` button.
  const templatesLibraryCta =
    activeTab === 'templates' && templatesView === 'library'
      ? (() => {
          const showDeckArchitect = isDeckArchitectEnabled();
          const showWorkbookTemplates = isWorkbookTemplatesEnabled();
          if (!showDeckArchitect && !showWorkbookTemplates) return undefined;
          return (
            <TemplatesNewSplitButton
              label={ctaLabels.templates}
              onNewTemplate={handleNewItem}
              onOpenDeckArchitect={
                showDeckArchitect
                  ? () => handleTemplateLauncherSelect('presentation', 'blank')
                  : undefined
              }
              onOpenWorkbookTemplates={
                showWorkbookTemplates
                  ? () => handleTemplateLauncherSelect('spreadsheet', 'blank')
                  : undefined
              }
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
          setFiltersOpen(false);
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
        onNewItem={
          // Sheets odblokowane 2026-07-24 (item 3) — dostaje tablicę jak
          // Documents/Presentations/All. Embedded architect views (templatesView
          // !== 'library') to NARZĘDZIA bez semantyki „nowy" — CTA ukryte, tak
          // jak wcześniej dla osobnych zakładek template_architect/workbook_templates.
          activeTab === 'templates' && templatesView !== 'library' ? undefined : handleNewItem
        }
        newItemLabel={ctaLabels[activeTab]}
        newItemTestId="outputs-new-btn"
        primaryCtaContent={templatesLibraryCta}
        viewModes={['table', 'grid']}
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

      {editWorkbookTemplateId && (
        <div className="fixed inset-0 z-modal" data-testid="persisted-template-builder-overlay">
          <PersistedTemplateBuilder
            templateId={editWorkbookTemplateId}
            onClose={() => {
              setEditWorkbookTemplateId(null);
              const params = new URLSearchParams(location.search || '');
              params.delete('editWorkbookTemplateId');
              params.set('tab', 'templates');
              navigate(`${location.pathname}?${params.toString()}`, { replace: true });
              void fetchTemplates();
            }}
            onSaved={() => {
              toast.success(t('rap.templateBuilder.updated', 'Zmiany szablonu zostały zapisane'));
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
