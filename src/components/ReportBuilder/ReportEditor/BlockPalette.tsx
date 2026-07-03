/**
 * BlockPalette
 *
 * Modal for selecting block types to add to the report
 */

import {
  BarChart3,
  FileText,
  Image,
  LayoutGrid,
  List,
  MessageSquare,
  PieChart,
  Quote,
  Search,
  Table,
  Target,
  Type,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { Api } from '@/services/api';

import type { ReportSourceType } from '../useReportBuilder';

// ==========================================
// TYPES
// ==========================================

interface BlockType {
  id: string;
  type: string;
  title: string;
  titlePl: string;
  description: string;
  descriptionPl: string;
  icon: React.ReactNode;
  color: string;
  category: 'content' | 'data' | 'visual';
  sourceTypes?: ReportSourceType[];
  blockTypeId?: string;
  renderKind?: string;
  defaultLength?: 'short' | 'medium' | 'long';
}

interface BlockPaletteProps {
  onSelect: (
    type: string,
    title: string,
    afterIndex?: number,
    meta?: {
      blockTypeId?: string;
      renderKind?: string;
      defaultLength?: 'short' | 'medium' | 'long';
    }
  ) => void;
  onClose: () => void;
  isPl: boolean;
  sourceType: ReportSourceType | null;
}

// ==========================================
// BLOCK DEFINITIONS
// ==========================================

const BLOCK_TYPES: BlockType[] = [
  // Core structural blocks (used by many system templates)
  {
    id: 'cover',
    type: 'cover',
    title: 'Cover Page',
    titlePl: 'Strona tytułowa',
    description: 'Title page (company, date, report subtitle)',
    descriptionPl: 'Strona tytułowa (firma, data, podtytuł raportu)',
    icon: <FileText className="w-6 h-6" />,
    color: 'bg-c-surface-raised',
    category: 'content',
  },

  // Content blocks
  {
    id: 'summary',
    type: 'summary',
    title: 'Executive Summary',
    titlePl: 'Streszczenie Zarządcze',
    description: 'High-level overview of key findings and recommendations',
    descriptionPl: 'Ogólny przegląd kluczowych wniosków i rekomendacji',
    icon: <FileText className="w-6 h-6" />,
    color: 'from-blue-500 to-blue-600',
    category: 'content',
  },
  {
    id: 'analysis',
    type: 'analysis',
    title: 'Detailed Analysis',
    titlePl: 'Analiza Szczegółowa',
    description: 'In-depth analysis of assessment results',
    descriptionPl: 'Dogłębna analiza wyników oceny',
    icon: <Target className="w-6 h-6" />,
    color: 'from-emerald-500 to-emerald-600',
    category: 'content',
    sourceTypes: ['ASSESSMENT'],
  },
  {
    id: 'recommendations',
    type: 'recommendations',
    title: 'Recommendations',
    titlePl: 'Rekomendacje',
    description: 'Actionable recommendations based on findings',
    descriptionPl: 'Praktyczne rekomendacje na podstawie wniosków',
    icon: <Zap className="w-6 h-6" />,
    color: 'from-amber-500 to-amber-600',
    category: 'content',
  },
  {
    id: 'methodology',
    type: 'methodology',
    title: 'Methodology',
    titlePl: 'Metodologia',
    description: 'Description of assessment methodology used',
    descriptionPl: 'Opis zastosowanej metodologii oceny',
    icon: <List className="w-6 h-6" />,
    color: 'bg-c-surface-raised',
    category: 'content',
    sourceTypes: ['ASSESSMENT'],
  },
  {
    id: 'custom',
    type: 'custom',
    title: 'Custom Section',
    titlePl: 'Własna Sekcja',
    description: 'Free-form text section with custom content',
    descriptionPl: 'Sekcja tekstowa z własną treścią',
    icon: <Type className="w-6 h-6" />,
    color: 'bg-c-surface-raised',
    category: 'content',
  },
  {
    id: 'quote',
    type: 'quote',
    title: 'Key Quote',
    titlePl: 'Kluczowy Cytat',
    description: 'Highlighted quote or key statement',
    descriptionPl: 'Wyróżniony cytat lub kluczowe stwierdzenie',
    icon: <Quote className="w-6 h-6" />,
    color: 'bg-c-accent',
    category: 'content',
  },
  {
    id: 'context',
    type: 'context',
    title: 'Context / Company Profile',
    titlePl: 'Kontekst / Profil organizacji',
    description: 'Business context, scope, and key assumptions',
    descriptionPl: 'Kontekst biznesowy, zakres i kluczowe założenia',
    icon: <Target className="w-6 h-6" />,
    color: 'from-emerald-500 to-emerald-600',
    category: 'content',
  },
  {
    id: 'axis_analysis',
    type: 'axis_analysis',
    title: 'Axis / Topic Analysis',
    titlePl: 'Analiza osi / tematu',
    description: 'Deep dive analysis repeated per axis/topic',
    descriptionPl: 'Analiza pogłębiona, często powtarzana per oś/temat',
    icon: <List className="w-6 h-6" />,
    color: 'from-blue-500 to-blue-600',
    category: 'content',
  },
  {
    id: 'action_plan',
    type: 'action_plan',
    title: 'Action Plan / Next Steps',
    titlePl: 'Plan działań / Następne kroki',
    description: 'Roadmap-style actions and owners',
    descriptionPl: 'Działania, ownerzy i harmonogram',
    icon: <Zap className="w-6 h-6" />,
    color: 'from-amber-500 to-amber-600',
    category: 'content',
  },
  {
    id: 'appendix',
    type: 'appendix',
    title: 'Appendix',
    titlePl: 'Aneks',
    description: 'Additional details, tables, glossary and evidence',
    descriptionPl: 'Dodatkowe szczegóły, tabele, słownik i dowody',
    icon: <FileText className="w-6 h-6" />,
    color: 'bg-c-surface-raised',
    category: 'content',
  },

  // Data blocks
  {
    id: 'matrix',
    type: 'matrix',
    title: 'Assessment Matrix',
    titlePl: 'Macierz Oceny',
    description: 'Visual matrix showing assessment scores',
    descriptionPl: 'Wizualna macierz pokazująca wyniki oceny',
    icon: <LayoutGrid className="w-6 h-6" />,
    color: 'bg-c-accent',
    category: 'data',
    sourceTypes: ['ASSESSMENT'],
  },
  {
    id: 'table',
    type: 'table',
    title: 'Data Table',
    titlePl: 'Tabela Danych',
    description: 'Structured data in table format',
    descriptionPl: 'Dane strukturalne w formacie tabeli',
    icon: <Table className="w-6 h-6" />,
    color: 'from-blue-500 to-blue-600',
    category: 'data',
  },
  {
    id: 'findings',
    type: 'findings',
    title: 'Key Findings',
    titlePl: 'Kluczowe Wnioski',
    description: 'List of most important findings',
    descriptionPl: 'Lista najważniejszych wniosków',
    icon: <MessageSquare className="w-6 h-6" />,
    color: 'from-danger-500 to-danger-600',
    category: 'data',
  },
  {
    id: 'dashboard',
    type: 'dashboard',
    title: 'Dashboard / Score Summary',
    titlePl: 'Dashboard / Podsumowanie wyników',
    description: 'High-level scorecard and key gaps',
    descriptionPl: 'Podsumowanie wyników i kluczowych luk',
    icon: <LayoutGrid className="w-6 h-6" />,
    color: 'from-indigo-500 to-indigo-600',
    category: 'data',
  },
  {
    id: 'scorecard',
    type: 'scorecard',
    title: 'Scorecard',
    titlePl: 'Scorecard',
    description: 'Structured summary of scores and targets',
    descriptionPl: 'Strukturalne podsumowanie wyników i celów',
    icon: <Table className="w-6 h-6" />,
    color: 'from-blue-500 to-blue-600',
    category: 'data',
  },
  {
    id: 'gap_analysis',
    type: 'gap_analysis',
    title: 'Gap Analysis',
    titlePl: 'Analiza luk',
    description: 'Where we are vs where we want to be',
    descriptionPl: 'Różnice: stan obecny vs docelowy',
    icon: <Target className="w-6 h-6" />,
    color: 'from-danger-500 to-danger-600',
    category: 'data',
  },

  // Visual blocks
  {
    id: 'chart_bar',
    type: 'chart',
    title: 'Bar Chart',
    titlePl: 'Wykres Słupkowy',
    description: 'Bar chart visualization of data',
    descriptionPl: 'Wizualizacja danych w formie wykresu słupkowego',
    icon: <BarChart3 className="w-6 h-6" />,
    color: 'from-pink-500 to-pink-600',
    category: 'visual',
  },
  {
    id: 'chart_pie',
    type: 'chart_pie',
    title: 'Pie Chart',
    titlePl: 'Wykres Kołowy',
    description: 'Pie chart for proportional data',
    descriptionPl: 'Wykres kołowy dla danych proporcjonalnych',
    icon: <PieChart className="w-6 h-6" />,
    color: 'from-amber-500 to-amber-600',
    category: 'visual',
  },
  {
    id: 'image',
    type: 'image',
    title: 'Image / Diagram',
    titlePl: 'Obraz / Diagram',
    description: 'Custom image or diagram',
    descriptionPl: 'Własny obraz lub diagram',
    icon: <Image className="w-6 h-6" />,
    color: 'from-blue-500 to-blue-600',
    category: 'visual',
  },
  {
    id: 'roadmap',
    type: 'roadmap',
    title: 'Roadmap',
    titlePl: 'Roadmapa',
    description: 'Phased timeline with milestones',
    descriptionPl: 'Harmonogram z kamieniami milowymi',
    icon: <BarChart3 className="w-6 h-6" />,
    color: 'from-blue-500 to-blue-600',
    category: 'visual',
  },
  {
    id: 'kpis',
    type: 'kpis',
    title: 'KPIs',
    titlePl: 'KPI',
    description: 'Metrics to track progress and outcomes',
    descriptionPl: 'Metryki do śledzenia postępu i efektów',
    icon: <PieChart className="w-6 h-6" />,
    color: 'from-amber-500 to-amber-600',
    category: 'visual',
  },
  {
    id: 'risk',
    type: 'risk',
    title: 'Risks',
    titlePl: 'Ryzyka',
    description: 'Risk register and mitigation',
    descriptionPl: 'Rejestr ryzyk i mitygacje',
    icon: <MessageSquare className="w-6 h-6" />,
    color: 'bg-c-accent',
    category: 'visual',
  },
  {
    id: 'prioritization',
    type: 'prioritization',
    title: 'Prioritization',
    titlePl: 'Priorytetyzacja',
    description: 'Impact vs effort, initiative prioritization',
    descriptionPl: 'Wpływ vs nakład, priorytety inicjatyw',
    icon: <LayoutGrid className="w-6 h-6" />,
    color: 'bg-c-accent',
    category: 'visual',
  },
  {
    id: 'initiatives',
    type: 'initiatives',
    title: 'Initiative Cards',
    titlePl: 'Karty Inicjatyw',
    description: 'Rich initiative cards with strategy, effort, metrics',
    descriptionPl: 'Karty inicjatyw ze strategią, wysiłkiem, metrykami',
    icon: <Zap className="w-6 h-6" />,
    color: 'bg-c-accent',
    category: 'visual',
    renderKind: 'initiatives',
    defaultLength: 'long',
  },
];

// ==========================================
// COMPONENT
// ==========================================

export const BlockPalette: React.FC<BlockPaletteProps> = ({
  onSelect,
  onClose,
  isPl,
  sourceType,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'content' | 'data' | 'visual'>(
    'all'
  );
  const [libraryBlocks, setLibraryBlocks] = useState<BlockType[]>([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await Api.get('/report-builder/block-types');
        const blocks = (res?.blocks || []) as any[];
        const mapped: BlockType[] = blocks.map((b) => {
          const rk = String(b.renderKind || 'markdown');
          const icon =
            rk === 'callout' ? (
              <Quote className="w-6 h-6" />
            ) : rk === 'table' ? (
              <Table className="w-6 h-6" />
            ) : rk === 'chart' ? (
              <BarChart3 className="w-6 h-6" />
            ) : rk === 'matrix' ? (
              <LayoutGrid className="w-6 h-6" />
            ) : rk === 'json' ? (
              <Target className="w-6 h-6" />
            ) : (
              <FileText className="w-6 h-6" />
            );

          const category: BlockType['category'] =
            rk === 'chart' || rk === 'matrix'
              ? 'visual'
              : rk === 'table' || rk === 'json'
                ? 'data'
                : 'content';

          const color =
            rk === 'chart'
              ? 'from-pink-500 to-pink-600'
              : rk === 'matrix'
                ? 'bg-c-accent'
                : rk === 'table'
                  ? 'from-blue-500 to-blue-600'
                  : rk === 'callout'
                    ? 'bg-c-accent'
                    : rk === 'json'
                      ? 'from-emerald-500 to-emerald-600'
                      : 'from-blue-500 to-blue-600';

          return {
            id: `bt_${String(b.id)}`,
            type: 'custom',
            title: String(b.name || 'Custom block'),
            titlePl: String(b.name || 'Custom block'),
            description: String(b.description || ''),
            descriptionPl: String(b.description || ''),
            icon,
            color,
            category,
            sourceTypes: Array.isArray(b.sourceTypes)
              ? (b.sourceTypes as string[])
                  .map((s) => String(s || '').toUpperCase())
                  .filter((s): s is ReportSourceType =>
                    ['ASSESSMENT', 'INTERVIEW', 'TOOL', 'INITIATIVE', 'UPLOAD_BUNDLE'].includes(s)
                  )
              : undefined,
            blockTypeId: String(b.id),
            renderKind: rk,
            defaultLength:
              b.defaultLength === 'short' ||
              b.defaultLength === 'medium' ||
              b.defaultLength === 'long'
                ? b.defaultLength
                : undefined,
          };
        });
        if (!cancelled) setLibraryBlocks(mapped);
      } catch {
        if (!cancelled) setLibraryBlocks([]);
      } finally {
        if (!cancelled) setLibraryLoaded(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const allBlocks = useMemo(() => {
    // Always include core blocks; merge library blocks on top for discoverability.
    const seen = new Set<string>();
    const out: BlockType[] = [];
    for (const b of [...BLOCK_TYPES, ...libraryBlocks]) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      out.push(b);
    }
    return out;
  }, [libraryBlocks]);

  const filteredBlocks = useMemo(() => {
    return allBlocks.filter((block) => {
      // Category filter
      if (activeCategory !== 'all' && block.category !== activeCategory) {
        return false;
      }

      // Filter by category
      // Filter by search
      if (search) {
        const searchLower = search.toLowerCase();
        const title = isPl ? block.titlePl : block.title;
        const desc = isPl ? block.descriptionPl : block.description;
        return (
          title.toLowerCase().includes(searchLower) ||
          desc.toLowerCase().includes(searchLower) ||
          block.type.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [allBlocks, search, activeCategory, isPl]);

  const categories = [
    { id: 'all', label: isPl ? 'Wszystkie' : 'All' },
    { id: 'content', label: isPl ? 'Treść' : 'Content' },
    { id: 'data', label: isPl ? 'Dane' : 'Data' },
    { id: 'visual', label: isPl ? 'Wizualne' : 'Visual' },
  ];

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-c-surface rounded-2xl shadow-2xl w-full max-w-2xl h-[min(720px,85vh)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-c-border-subtle">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-c-text">
              {isPl ? 'Dodaj blok' : 'Add Block'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-c-text-secondary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isPl ? 'Szukaj bloków...' : 'Search blocks...'}
              className="w-full pl-10 pr-4 py-3 bg-c-surface-raised border-none rounded-xl text-c-text placeholder:text-c-text-muted focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 mt-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as any)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${
                    activeCategory === cat.id
                      ? 'bg-blue-600 text-c-text'
                      : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle'
                  }
                `}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Block Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {filteredBlocks.map((block) => {
              const isCompatible =
                !block.sourceTypes || !sourceType || block.sourceTypes.includes(sourceType);
              return (
                <button
                  key={block.id}
                  disabled={!isCompatible}
                  onClick={() =>
                    isCompatible &&
                    onSelect(block.type, isPl ? block.titlePl : block.title, undefined, {
                      blockTypeId: block.blockTypeId,
                      renderKind: block.renderKind,
                      defaultLength: block.defaultLength,
                    })
                  }
                  className={[
                    'p-4 bg-c-surface-raised rounded-xl text-left transition-all group border-2 border-transparent',
                    isCompatible
                      ? 'hover:bg-c-surface-raised hover:border-blue-500'
                      : 'opacity-50 cursor-not-allowed',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${block.color} flex items-center justify-center text-c-text flex-shrink-0 group-hover:scale-110 transition-transform`}
                    >
                      {block.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-c-text">
                        {isPl ? block.titlePl : block.title}
                      </h3>
                      {!isCompatible && (
                        <div className="mt-1 text-[11px] text-c-text-secondary">
                          {isPl
                            ? 'Niedostępny dla tego kontekstu'
                            : 'Not available for this context'}
                        </div>
                      )}
                      <p className="text-sm text-c-text-secondary mt-1 line-clamp-2">
                        {isPl ? block.descriptionPl : block.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredBlocks.length === 0 && (
            <div className="text-center py-12 text-c-text-secondary">
              {isPl ? 'Nie znaleziono bloków' : 'No blocks found'}
            </div>
          )}

          {!libraryLoaded && (
            <div className="text-center pt-6 text-xs text-c-text-secondary">
              {isPl ? 'Ładowanie biblioteki bloków…' : 'Loading block library…'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockPalette;
