/**
 * ArtifactModuleHome — shared landing screen for Dokumenty / Tabele / Prezentacje modules.
 *
 * Configured by a single `lane` prop. Shows:
 * - Top action pills: Nowe | Ostatnie | Zapisane
 * - Hero section with lane description
 * - Template grid cards
 * - Recent artifacts list
 */

import {
  Clock,
  FileSpreadsheet,
  FolderOpen,
  Loader2,
  Plus,
  Presentation,
  Save,
  Sparkles,
  Table,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { isTemplateLifecycleEnabled } from '@/utils/templateLifecycleFlag';

import { ExceleParametricTemplates } from './ExceleParametricTemplates';
import type { KimiLane } from './KimiWorkspaceShell';
import { TabeleTemplatesGrid } from './templateLifecycle/TabeleTemplatesGrid';
import { useModuleRecentArtifacts } from './useModuleRecentArtifacts';
import { useModuleTemplates } from './useModuleTemplates';

type HomeTab = 'templates' | 'recent' | 'saved';

// Terminal/finalized statuses that qualify an artifact as "Saved".
// Anything else (draft, generated, generating, editing, error…) is treated as
// work-in-progress and only shows under "Recent". Covers document
// (ready/exported/archived), presentation (ready/shared/archived) and sheet
// (final/published/archived) vocabularies.
const SAVED_STATUS_KEYS = new Set<string>([
  'ready',
  'shared',
  'exported',
  'published',
  'final',
  'finalized',
  'archived',
  'complete',
  'completed',
]);

const LANE_META: Record<
  KimiLane,
  {
    icon: React.ElementType;
    route: string;
    accentBg: string;
    accentText: string;
  }
> = {
  excele: {
    icon: FileSpreadsheet,
    // /excele (nie /tabele) — inaczej „Zacznij nowy"/szablon w odsłoniętym Excelu
    // odbija do Table Studio, nigdy nie docierając do silnika arkuszy (audyt
    // 2026-07-22, Sheet #9). ExceleView czyta view=new/templatePrompt/artifactId.
    route: '/excele',
    accentBg: 'bg-emerald-500/10',
    accentText: 'text-emerald-500',
  },
  prezentacje: {
    icon: Presentation,
    route: '/prezentacje',
    accentBg: 'bg-fuchsia-500/10',
    accentText: 'text-fuchsia-500',
  },
  tabele: {
    icon: Table,
    route: '/tabele',
    accentBg: 'bg-sky-500/10',
    accentText: 'text-sky-500',
  },
};

interface ArtifactModuleHomeProps {
  lane: KimiLane;
}

export const ArtifactModuleHome: React.FC<ArtifactModuleHomeProps> = ({ lane }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isPolish = (i18n.resolvedLanguage || i18n.language || '').toLowerCase().startsWith('pl');
  const [activeTab, setActiveTab] = useState<HomeTab>('templates');

  const meta = LANE_META[lane];
  const Icon = meta.icon;

  const { templates, loading: templatesLoading } = useModuleTemplates(lane);
  const {
    artifacts: recentArtifacts,
    loading: recentLoading,
    refetch: refetchRecent,
  } = useModuleRecentArtifacts(lane, 10);
  // Scope split (M19/M20 scope-bug fix):
  //   Recent = every artifact in this lane, newest-touched first (incl. drafts/WIP).
  //   Saved  = ONLY artifacts the user has finalized/persisted — an explicit
  //            allowlist of terminal states. Using a plain `!== 'draft'` made
  //            Saved leak WIP states (generated/editing/generating) so it
  //            mirrored Recent whenever no row happened to be a draft.
  const savedArtifacts = useMemo(
    () =>
      recentArtifacts.filter((a) => SAVED_STATUS_KEYS.has(String(a.statusKey || '').toLowerCase())),
    [recentArtifacts]
  );
  // Block A / A-S5b — when ON, lane=tabele swaps to the
  // `tp_base_templates` lifecycle endpoint via `<TabeleTemplatesGrid>`
  // and surfaces the lifecycle filter + dot badge + governance drawer.
  // OFF preserves the legacy Outputs Library behaviour for every lane.
  const useTabeleLifecycleGrid = lane === 'tabele' && isTemplateLifecycleEnabled();

  const heroText = useMemo(() => {
    if (lane === 'excele')
      return t(
        'kimi.artifactHome.hero.excele',
        'Budgets, financial models, timelines, risk matrices'
      );
    if (lane === 'tabele')
      return t(
        'kimi.artifactHome.hero.tabele',
        'Operational tables, master data, registers, logs, OKRs, decisions'
      );
    return t(
      'kimi.artifactHome.hero.deck',
      'Executive decks, pitch, status updates, workshop presentations'
    );
  }, [lane, t]);

  const laneLabel = useMemo(() => {
    if (lane === 'excele') return t('kimi.artifactHome.laneLabel.excele', 'Excel');
    if (lane === 'tabele') return t('kimi.artifactHome.laneLabel.tabele', 'Table Studio');
    return t('kimi.artifactHome.laneLabel.deck', 'Presentations');
  }, [lane, t]);

  const handleNewClick = () => {
    navigate(`${meta.route}?view=new`);
  };

  const handleTemplateClick = (templateId: string, promptOverride?: string) => {
    if (promptOverride) {
      navigate(`${meta.route}?view=new&templatePrompt=${encodeURIComponent(promptOverride)}`);
    } else {
      navigate(`${meta.route}?templateArtifactId=${encodeURIComponent(templateId)}`);
    }
  };

  const handleArtifactClick = (artifactId: string) => {
    navigate(`${meta.route}?artifactId=${encodeURIComponent(artifactId)}`);
  };

  const tabs: Array<{ id: HomeTab; label: string; icon: React.ElementType }> = [
    { id: 'templates', label: t('kimi.artifactHome.tab.templates', 'Templates'), icon: Sparkles },
    { id: 'recent', label: t('kimi.artifactHome.tab.recent', 'Recent'), icon: Clock },
    { id: 'saved', label: t('kimi.artifactHome.tab.saved', 'Saved'), icon: Save },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-c-surface-raised">
      {/* Hero */}
      <div className="px-6 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl ${meta.accentBg} flex items-center justify-center`}>
            <Icon size={22} className={meta.accentText} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-c-text">{laneLabel}</h1>
            <p className="text-sm text-c-text-secondary">{heroText}</p>
          </div>
        </div>

        {/* New button */}
        <button
          onClick={handleNewClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-c-text text-c-bg text-sm font-medium hover:opacity-90 transition-opacity mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <Plus size={16} />
          {t('kimi.artifactHome.startNew', 'Start new')}
        </button>
      </div>

      {/* Tab pills */}
      <div className="px-6 pb-3 flex items-center gap-1.5">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                isActive
                  ? 'bg-c-surface shadow-sm text-c-text/[0.12] dark:text-[var(--c-info)]'
                  : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle'
              }`}
            >
              <TabIcon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="px-6 pb-8 flex-1">
        {activeTab === 'templates' && useTabeleLifecycleGrid && (
          <TabeleTemplatesGrid onTemplateClick={(tplId) => handleTemplateClick(tplId)} />
        )}
        {activeTab === 'templates' && !useTabeleLifecycleGrid && (
          <>
            {/* C3 — parametric model templates (live-formula .xlsx) from the
                server registry. Only /excele; mounted here (a really-rendered
                component) to avoid the phantom-UI trap. */}
            {lane === 'excele' && (
              <ExceleParametricTemplates isPolish={isPolish} onBuilt={refetchRecent} />
            )}
            <TemplatesGrid
              templates={templates}
              loading={templatesLoading}
              onTemplateClick={handleTemplateClick}
              isPolish={isPolish}
              lane={lane}
            />
          </>
        )}
        {activeTab === 'recent' && (
          <ArtifactsList
            artifacts={recentArtifacts}
            loading={recentLoading}
            onArtifactClick={handleArtifactClick}
            isPolish={isPolish}
            emptyLabel={t('kimi.artifactHome.emptyRecent', 'No recent documents')}
          />
        )}
        {activeTab === 'saved' && (
          <ArtifactsList
            artifacts={savedArtifacts}
            loading={recentLoading}
            onArtifactClick={handleArtifactClick}
            isPolish={isPolish}
            emptyLabel={t('kimi.artifactHome.emptySaved', 'No saved documents')}
          />
        )}
      </div>
    </div>
  );
};

/* ---------- Sub-components ---------- */

interface TemplatesGridProps {
  templates: Array<{ id: string; title: string; description?: string; category?: string }>;
  loading: boolean;
  onTemplateClick: (id: string, promptOverride?: string) => void;
  isPolish: boolean;
  lane: KimiLane;
}

const BUILTIN_TEMPLATES: Record<
  KimiLane,
  Array<{ id: string; title: string; titlePl: string; desc: string; descPl: string }>
> = {
  excele: [
    {
      id: 'bt-sheet-finmodel',
      title: 'Financial Model',
      titlePl: 'Model finansowy',
      desc: 'P&L + Balance Sheet + Cash Flow',
      descPl: 'RZiS + Bilans + Cash Flow',
    },
    {
      id: 'bt-sheet-budget',
      title: 'Budget Planning',
      titlePl: 'Planowanie budżetu',
      desc: 'Annual/quarterly budget template',
      descPl: 'Szablon budżetu rocznego/kwartalnego',
    },
    {
      id: 'bt-sheet-resource',
      title: 'Resource Allocation Matrix',
      titlePl: 'Macierz alokacji zasobów',
      desc: 'Team capacity and assignment',
      descPl: 'Pojemność zespołu i przypisania',
    },
    {
      id: 'bt-sheet-risk',
      title: 'Risk Register',
      titlePl: 'Rejestr ryzyk',
      desc: 'Risk log with scoring and owners',
      descPl: 'Log ryzyk z oceną i właścicielami',
    },
    {
      id: 'bt-sheet-timeline',
      title: 'Project Timeline',
      titlePl: 'Harmonogram projektu',
      desc: 'Gantt-style milestone tracker',
      descPl: 'Tracker kamieni milowych',
    },
    {
      id: 'bt-sheet-competitive',
      title: 'Competitive Analysis Matrix',
      titlePl: 'Macierz analizy konkurencji',
      desc: 'Feature comparison grid',
      descPl: 'Siatka porównania funkcji',
    },
    {
      id: 'bt-sheet-recruit',
      title: 'Recruitment Pipeline',
      titlePl: 'Pipeline rekrutacji',
      desc: 'Candidate tracking and stages',
      descPl: 'Śledzenie kandydatów i etapów',
    },
    {
      id: 'bt-sheet-okr',
      title: 'OKR Tracking Sheet',
      titlePl: 'Arkusz śledzenia OKR',
      desc: 'Objectives, key results, progress',
      descPl: 'Cele, kluczowe rezultaty, postęp',
    },
  ],
  prezentacje: [
    {
      id: 'bt-deck-steering',
      title: 'Steering Committee Deck',
      titlePl: 'Deck dla Komitetu Sterującego',
      desc: 'Board-level status presentation',
      descPl: 'Prezentacja statusu dla zarządu',
    },
    {
      id: 'bt-deck-status',
      title: 'Project Status Update',
      titlePl: 'Status update projektu',
      desc: 'Weekly/monthly progress slides',
      descPl: 'Slajdy postępu tygodniowego/miesięcznego',
    },
    {
      id: 'bt-deck-pitch',
      title: 'Pitch Deck',
      titlePl: 'Pitch Deck',
      desc: 'Investor / stakeholder pitch',
      descPl: 'Pitch dla inwestorów / interesariuszy',
    },
    {
      id: 'bt-deck-workshop',
      title: 'Workshop Facilitation Deck',
      titlePl: 'Deck warsztatowy',
      desc: 'Interactive exercises and agenda',
      descPl: 'Interaktywne ćwiczenia i agenda',
    },
    {
      id: 'bt-deck-qbr',
      title: 'Quarterly Business Review',
      titlePl: 'Kwartalny przegląd biznesowy',
      desc: 'QBR metrics and roadmap',
      descPl: 'Metryki QBR i roadmapa',
    },
    {
      id: 'bt-deck-strategy',
      title: 'Strategy Roadmap',
      titlePl: 'Roadmapa strategiczna',
      desc: 'Vision, goals, milestones',
      descPl: 'Wizja, cele, kamienie milowe',
    },
    {
      id: 'bt-deck-invest',
      title: 'Investment Case Deck',
      titlePl: 'Deck case inwestycyjnego',
      desc: 'NPV/IRR/ROI decision support',
      descPl: 'Wsparcie decyzji NPV/IRR/ROI',
    },
    {
      id: 'bt-deck-digital',
      title: 'Digital Transformation Assessment',
      titlePl: 'Ocena transformacji cyfrowej',
      desc: 'Maturity, gaps, recommendations',
      descPl: 'Dojrzałość, luki, rekomendacje',
    },
  ],
  tabele: [
    {
      id: 'bt-tab-rolereg',
      title: 'Role Register',
      titlePl: 'Rejestr ról',
      desc: 'Roles, owners, RACI matrix per initiative',
      descPl: 'Role, właściciele, macierz RACI per inicjatywa',
    },
    {
      id: 'bt-tab-vendor',
      title: 'Vendor Master Data',
      titlePl: 'Master danych dostawców',
      desc: 'Vendor master data, contracts, status, SLAs',
      descPl: 'Master danych dostawców, umowy, status, SLA',
    },
    {
      id: 'bt-tab-okrset',
      title: 'OKR Set',
      titlePl: 'Zestaw OKR',
      desc: 'Objectives and key results with check-ins',
      descPl: 'Cele i kluczowe rezultaty z check-inami',
    },
    {
      id: 'bt-tab-incidentlog',
      title: 'Incident Log',
      titlePl: 'Log incydentów',
      desc: 'Operational incidents with severity and owners',
      descPl: 'Incydenty operacyjne z severity i właścicielami',
    },
    {
      id: 'bt-tab-clientreg',
      title: 'Client Registry',
      titlePl: 'Rejestr klientów',
      desc: 'Customer accounts, segment, lifecycle',
      descPl: 'Konta klientów, segment, cykl życia',
    },
    {
      id: 'bt-tab-tasktracker',
      title: 'Task Tracker',
      titlePl: 'Tracker zadań',
      desc: 'Cross-team task backlog with owners and due dates',
      descPl: 'Backlog zadań między zespołami z właścicielami i terminami',
    },
    {
      id: 'bt-tab-meetingbacklog',
      title: 'Meeting Backlog',
      titlePl: 'Backlog spotkań',
      desc: 'Pending meetings, agenda items, follow-ups',
      descPl: 'Oczekujące spotkania, punkty agendy, follow-upy',
    },
    {
      id: 'bt-tab-decisionlog',
      title: 'Decision Log',
      titlePl: 'Log decyzji',
      desc: 'Captured decisions, owners, rationale, status',
      descPl: 'Zapisane decyzje, właściciele, uzasadnienie, status',
    },
  ],
};

function TemplatesGrid({
  templates,
  loading,
  onTemplateClick,
  isPolish,
  lane,
}: TemplatesGridProps) {
  const builtinCards = BUILTIN_TEMPLATES[lane];

  const allCards = useMemo(() => {
    const apiCards = templates.map((t) => ({
      id: t.id,
      title: t.title,
      desc: t.description || '',
      isBuiltin: false,
      builtinPrompt: '',
    }));
    const builtin = builtinCards.map((b) => ({
      id: b.id,
      title: isPolish ? b.titlePl : b.title,
      desc: isPolish ? b.descPl : b.desc,
      isBuiltin: true,
      builtinPrompt: isPolish
        ? `Stwórz: ${b.titlePl}. ${b.descPl}`
        : `Create: ${b.title}. ${b.desc}`,
    }));
    const apiIds = new Set(apiCards.map((c) => c.id));
    return [...apiCards, ...builtin.filter((b) => !apiIds.has(b.id))];
  }, [templates, builtinCards, isPolish]);

  if (loading && allCards.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-c-text-secondary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {allCards.map((card) => (
        <button
          key={card.id}
          onClick={() => onTemplateClick(card.id, card.isBuiltin ? card.builtinPrompt : undefined)}
          className="group text-left p-4 rounded-xl border border-c-border-subtle bg-c-surface hover:border-brand/40 dark:hover:border-brand/30 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <p className="text-sm font-medium text-c-text group-hover:text-brand transition-colors line-clamp-1">
            {card.title}
          </p>
          <p className="text-xs text-c-text-secondary mt-1 line-clamp-2">{card.desc}</p>
        </button>
      ))}
    </div>
  );
}

interface ArtifactsListProps {
  artifacts: Array<{
    originRecordId: string;
    artifactId?: string;
    title: string;
    updatedAt: string;
    statusKey: string;
  }>;
  loading: boolean;
  onArtifactClick: (id: string) => void;
  isPolish: boolean;
  emptyLabel: string;
}

function ArtifactsList({
  artifacts,
  loading,
  onArtifactClick,
  isPolish,
  emptyLabel,
}: ArtifactsListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-c-text-secondary" />
      </div>
    );
  }

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FolderOpen size={32} className="text-c-text-secondary mb-3" />
        <p className="text-sm text-c-text-secondary">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {artifacts.map((item) => {
        const id = item.originRecordId || item.artifactId;
        const d = new Date(item.updatedAt);
        if (!id) return null;
        const safeId = id;
        return (
          <button
            key={safeId}
            onClick={() => onArtifactClick(safeId)}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-c-border-subtle bg-c-surface hover:border-brand/40 dark:hover:border-brand/30 hover:shadow-sm transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-c-text truncate">{item.title}</p>
              <p className="text-xs text-c-text-secondary mt-0.5">
                {d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <span className="text-xs font-medium text-c-text-secondary bg-c-surface-raised px-2 py-0.5 rounded-full ml-3 shrink-0">
              {item.statusKey}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default ArtifactModuleHome;
