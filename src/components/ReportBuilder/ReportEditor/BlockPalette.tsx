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
import React, { useMemo, useState } from 'react';

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
}

interface BlockPaletteProps {
  onSelect: (type: string, title: string) => void;
  onClose: () => void;
  isPl: boolean;
  sourceType: ReportSourceType | null;
}

// ==========================================
// BLOCK DEFINITIONS
// ==========================================

const BLOCK_TYPES: BlockType[] = [
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
    color: 'from-slate-500 to-slate-600',
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
    color: 'from-gray-500 to-gray-600',
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
    color: 'from-violet-500 to-violet-600',
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
    color: 'from-purple-500 to-purple-600',
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
    color: 'from-cyan-500 to-cyan-600',
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
    color: 'from-rose-500 to-rose-600',
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
    color: 'from-orange-500 to-orange-600',
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
    color: 'from-teal-500 to-teal-600',
    category: 'visual',
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

  const filteredBlocks = useMemo(() => {
    return BLOCK_TYPES.filter((block) => {
      // Filter by source type
      if (block.sourceTypes && sourceType && !block.sourceTypes.includes(sourceType)) {
        return false;
      }

      // Filter by category
      if (activeCategory !== 'all' && block.category !== activeCategory) {
        return false;
      }

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
  }, [search, activeCategory, sourceType, isPl]);

  const categories = [
    { id: 'all', label: isPl ? 'Wszystkie' : 'All' },
    { id: 'content', label: isPl ? 'Treść' : 'Content' },
    { id: 'data', label: isPl ? 'Dane' : 'Data' },
    { id: 'visual', label: isPl ? 'Wizualne' : 'Visual' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isPl ? 'Dodaj blok' : 'Add Block'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isPl ? 'Szukaj bloków...' : 'Search blocks...'}
              className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
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
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
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
            {filteredBlocks.map((block) => (
              <button
                key={block.id}
                onClick={() => onSelect(block.type, isPl ? block.titlePl : block.title)}
                className="p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-left transition-all group border-2 border-transparent hover:border-blue-500"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${block.color} flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform`}
                  >
                    {block.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {isPl ? block.titlePl : block.title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {isPl ? block.descriptionPl : block.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {filteredBlocks.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              {isPl ? 'Nie znaleziono bloków' : 'No blocks found'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockPalette;
