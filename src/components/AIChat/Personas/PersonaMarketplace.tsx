/**
 * PersonaMarketplace - Browse and discover public AI personas
 * Gallery view with filtering, search, and installation
 *
 * @version 1.0.0
 */

import {
  Bot,
  ChevronRight,
  Copy,
  ExternalLink,
  Filter,
  Heart,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Persona } from './PersonaSelector';

interface PersonaMarketplaceProps {
  onSelect: (persona: Persona) => void;
  onClose: () => void;
  onDuplicate?: (persona: Persona) => void;
}

interface Category {
  category: string;
  count: number;
}

const SORT_OPTIONS = [
  { id: 'popular', label: 'Most Popular', icon: TrendingUp },
  { id: 'rating', label: 'Highest Rated', icon: Star },
  { id: 'newest', label: 'Newest', icon: Sparkles },
];

export const PersonaMarketplace: React.FC<PersonaMarketplaceProps> = ({
  onSelect,
  onClose,
  onDuplicate,
}) => {
  const { t } = useTranslation();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [featured, setFeatured] = useState<Persona[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'newest'>('popular');
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);

  // Load marketplace data
  useEffect(() => {
    loadMarketplace();
  }, [selectedCategory, sortBy]);

  const loadMarketplace = async () => {
    setIsLoading(true);
    try {
      // In production, fetch from API
      // const response = await fetch(`/api/personas/marketplace?category=${selectedCategory}&sort=${sortBy}`);

      // Mock data
      const mockPersonas: Persona[] = [
        {
          id: 'persona_business_analyst',
          name: 'Business Analyst Pro',
          description: 'Expert in business analysis, requirements gathering, and strategic planning with 15+ years of experience',
          category: 'business',
          rating: 4.8,
          usage_count: 12500,
          is_verified: true,
          is_featured: true,
        },
        {
          id: 'persona_code_reviewer',
          name: 'Senior Code Reviewer',
          description: 'Expert code reviewer focusing on best practices, security, and performance optimization',
          category: 'technical',
          rating: 4.9,
          usage_count: 8900,
          is_verified: true,
          is_featured: true,
        },
        {
          id: 'persona_creative_writer',
          name: 'Creative Copywriter',
          description: 'Skilled writer for marketing copy, storytelling, and engaging content creation',
          category: 'creative',
          rating: 4.7,
          usage_count: 6700,
          is_verified: true,
          is_featured: true,
        },
        {
          id: 'persona_project_coach',
          name: 'Agile Project Coach',
          description: 'PMO expert helping with project planning, risk management, and team leadership',
          category: 'business',
          rating: 4.6,
          usage_count: 5400,
          is_verified: true,
        },
        {
          id: 'persona_data_analyst',
          name: 'Data Insights Analyst',
          description: 'Expert in data analysis, visualization, and deriving insights from complex datasets',
          category: 'technical',
          rating: 4.8,
          usage_count: 4200,
          is_verified: true,
        },
        {
          id: 'persona_ux_designer',
          name: 'UX Design Consultant',
          description: 'User experience expert helping design intuitive and accessible interfaces',
          category: 'creative',
          rating: 4.5,
          usage_count: 3100,
          is_verified: true,
        },
      ];

      const mockCategories: Category[] = [
        { category: 'business', count: 45 },
        { category: 'technical', count: 38 },
        { category: 'creative', count: 27 },
        { category: 'education', count: 19 },
        { category: 'productivity', count: 15 },
      ];

      let filtered = mockPersonas;
      if (selectedCategory) {
        filtered = filtered.filter((p) => p.category === selectedCategory);
      }

      // Sort
      if (sortBy === 'rating') {
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      } else if (sortBy === 'newest') {
        filtered.reverse();
      }

      setPersonas(filtered);
      setFeatured(mockPersonas.filter((p) => p.is_featured).slice(0, 3));
      setCategories(mockCategories);
    } catch (error) {
      console.error('Failed to load marketplace:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = useCallback(() => {
    if (!search.trim()) {
      loadMarketplace();
      return;
    }

    const searchLower = search.toLowerCase();
    setPersonas((prev) =>
      prev.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description?.toLowerCase().includes(searchLower)
      )
    );
  }, [search]);

  useEffect(() => {
    const timeout = setTimeout(handleSearch, 300);
    return () => clearTimeout(timeout);
  }, [search, handleSearch]);

  const formatCount = (count?: number) => {
    if (!count) return '0';
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      business: 'Business & Strategy',
      technical: 'Technical',
      creative: 'Creative',
      education: 'Education',
      productivity: 'Productivity',
    };
    return labels[category] || category;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-navy-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            {t('personas.marketplace.title', 'Persona Marketplace')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('personas.marketplace.subtitle', 'Discover and use expert AI personas')}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <X size={20} />
        </button>
      </div>

      {/* Search & Filters */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('personas.marketplace.searchPlaceholder', 'Search personas...')}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          {/* Categories */}
          <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`shrink-0 px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                !selectedCategory
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-600'
              }`}
            >
              {t('common.all', 'All')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.category}
                onClick={() => setSelectedCategory(cat.category)}
                className={`shrink-0 px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  selectedCategory === cat.category
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-600'
                }`}
              >
                {getCategoryLabel(cat.category)} ({cat.count})
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedPersona ? (
          // Detail View
          <PersonaDetail
            persona={selectedPersona}
            onBack={() => setSelectedPersona(null)}
            onSelect={onSelect}
            onDuplicate={onDuplicate}
          />
        ) : (
          <div className="p-6 space-y-6">
            {/* Featured Section */}
            {!search && !selectedCategory && featured.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-500" />
                  {t('personas.marketplace.featured', 'Featured Personas')}
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {featured.map((persona) => (
                    <PersonaCard
                      key={persona.id}
                      persona={persona}
                      onClick={() => setSelectedPersona(persona)}
                      featured
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Personas */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                {selectedCategory
                  ? getCategoryLabel(selectedCategory)
                  : t('personas.marketplace.allPersonas', 'All Personas')}
                <span className="font-normal text-slate-400 ml-2">({personas.length})</span>
              </h3>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : personas.length === 0 ? (
                <div className="text-center py-12">
                  <Bot size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">
                    {t('personas.marketplace.noResults', 'No personas found')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {personas.map((persona) => (
                    <PersonaCard
                      key={persona.id}
                      persona={persona}
                      onClick={() => setSelectedPersona(persona)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Persona Card Component
interface PersonaCardProps {
  persona: Persona;
  onClick: () => void;
  featured?: boolean;
}

const PersonaCard: React.FC<PersonaCardProps> = ({ persona, onClick, featured }) => {
  const formatCount = (count?: number) => {
    if (!count) return '0';
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  return (
    <button
      onClick={onClick}
      className={`text-left p-4 border rounded-xl transition-all hover:shadow-lg ${
        featured
          ? 'border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10'
          : 'border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-700 bg-white dark:bg-navy-800'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            featured
              ? 'bg-amber-100 dark:bg-amber-900/30'
              : 'bg-slate-100 dark:bg-navy-700'
          }`}
        >
          {persona.avatar_url ? (
            <img src={persona.avatar_url} alt={persona.name} className="w-10 h-10 rounded-full" />
          ) : (
            <Bot size={20} className={featured ? 'text-amber-600' : 'text-slate-400'} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-medium text-slate-800 dark:text-white truncate">{persona.name}</h4>
            {persona.is_verified && <Sparkles size={12} className="text-primary-500 shrink-0" />}
            {featured && <Star size={12} className="text-amber-500 fill-amber-500 shrink-0" />}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
            {persona.description}
          </p>

          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
            {persona.rating && (
              <span className="flex items-center gap-1">
                <Star size={12} className="text-amber-500 fill-amber-500" />
                {persona.rating.toFixed(1)}
              </span>
            )}
            {persona.usage_count && (
              <span className="flex items-center gap-1">
                <Users size={12} />
                {formatCount(persona.usage_count)}
              </span>
            )}
          </div>
        </div>

        <ChevronRight size={16} className="text-slate-300 shrink-0" />
      </div>
    </button>
  );
};

// Persona Detail Component
interface PersonaDetailProps {
  persona: Persona;
  onBack: () => void;
  onSelect: (persona: Persona) => void;
  onDuplicate?: (persona: Persona) => void;
}

const PersonaDetail: React.FC<PersonaDetailProps> = ({
  persona,
  onBack,
  onSelect,
  onDuplicate,
}) => {
  const { t } = useTranslation();

  return (
    <div className="p-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 mb-4"
      >
        <ChevronRight size={16} className="rotate-180" />
        {t('common.back', 'Back')}
      </button>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-navy-700 flex items-center justify-center">
          {persona.avatar_url ? (
            <img src={persona.avatar_url} alt={persona.name} className="w-16 h-16 rounded-xl" />
          ) : (
            <Bot size={32} className="text-slate-400" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white">{persona.name}</h2>
            {persona.is_verified && <Sparkles size={16} className="text-primary-500" />}
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{persona.description}</p>

          <div className="flex items-center gap-4 mt-3">
            {persona.rating && (
              <div className="flex items-center gap-1 text-sm">
                <Star size={14} className="text-amber-500 fill-amber-500" />
                <span className="font-medium">{persona.rating.toFixed(1)}</span>
                <span className="text-slate-400">rating</span>
              </div>
            )}
            {persona.usage_count && (
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <Users size={14} />
                <span>
                  {persona.usage_count.toLocaleString()} {t('common.uses', 'uses')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => onSelect(persona)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
        >
          <Bot size={16} />
          {t('personas.usePersona', 'Use this Persona')}
        </button>
        {onDuplicate && (
          <button
            onClick={() => onDuplicate(persona)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-700 rounded-lg transition-colors"
          >
            <Copy size={16} />
            {t('personas.duplicate', 'Duplicate')}
          </button>
        )}
      </div>

      {/* Category & Tags */}
      {persona.category && (
        <div className="mb-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('common.category', 'Category')}
          </span>
          <div className="mt-1">
            <span className="inline-block px-2 py-1 text-xs font-medium bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded-full capitalize">
              {persona.category}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonaMarketplace;
