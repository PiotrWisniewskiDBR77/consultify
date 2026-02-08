/**
 * Knowledge Library Component
 * Full-featured Knowledge Base browser for the Help panel
 *
 * Features:
 * - Category filtering
 * - Full-text search
 * - Article cards with thumbnails
 * - Reading time estimates
 */

import {
  BookOpen,
  ChevronRight,
  Clock,
  Eye,
  FolderOpen,
  Rocket,
  Search,
  Sparkles,
  Star,
  Wrench,
  X,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  KbArticleListItem,
  KbCategory,
  useKnowledgeArticles,
  useKnowledgeCategories,
  useKnowledgeContextual,
  useKnowledgeSearch,
} from '../../hooks/useKnowledge';

// ============================================
// DYNAMIC ICON
// ============================================

const DynamicIcon: React.FC<{ name: string; size?: number; className?: string }> = ({
  name,
  size = 20,
  className,
}) => {
  const IconComponent = (LucideIcons as any)[name];
  if (!IconComponent) return <BookOpen size={size} className={className} />;
  return <IconComponent size={size} className={className} />;
};

// ============================================
// ARTICLE CARD
// ============================================

interface ArticleCardProps {
  article: KbArticleListItem;
  onClick: (slug: string) => void;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, onClick }) => {
  const { t } = useTranslation();

  return (
    <button
      onClick={() => onClick(article.slug)}
      className="w-full text-left p-4 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all group"
    >
      {/* Thumbnail */}
      {article.thumbnail_url && (
        <div className="w-full h-32 mb-3 rounded-lg overflow-hidden bg-slate-100 dark:bg-navy-800">
          <img
            src={article.thumbnail_url}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        </div>
      )}

      {/* Category Badge */}
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] font-semibold rounded-full uppercase">
          <DynamicIcon name={article.category_icon} size={10} />
          {article.category_name}
        </span>
        {article.is_featured && <Star size={12} className="text-amber-500 fill-amber-500" />}
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1 line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
        {article.title}
      </h4>

      {/* Summary */}
      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
        {article.summary}
      </p>

      {/* Meta */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {article.reading_time_minutes} {t('help.knowledge.minRead', 'min read')}
        </span>
        <span className="flex items-center gap-1">
          <Eye size={10} />
          {article.view_count}
        </span>
      </div>

      {/* Arrow */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight size={16} className="text-purple-500" />
      </div>
    </button>
  );
};

// ============================================
// CATEGORY CHIP
// ============================================

interface CategoryChipProps {
  category: KbCategory;
  isActive: boolean;
  onClick: () => void;
}

const CategoryChip: React.FC<CategoryChipProps> = ({ category, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`
      inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
      transition-all whitespace-nowrap
      ${
        isActive
          ? 'bg-purple-600 text-white shadow-md'
          : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-purple-900/30'
      }
    `}
  >
    <DynamicIcon name={category.icon} size={12} />
    {category.name}
    <span className={`text-[10px] ${isActive ? 'text-purple-200' : 'text-slate-400'}`}>
      ({category.article_count})
    </span>
  </button>
);

// ============================================
// MAIN COMPONENT
// ============================================

interface KnowledgeLibraryProps {
  onArticleClick: (slug: string) => void;
  moduleId?: string;
}

export const KnowledgeLibrary: React.FC<KnowledgeLibraryProps> = ({ onArticleClick, moduleId }) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const limit = 10;

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useKnowledgeCategories(true);

  // Fetch contextual articles if moduleId is provided and no category/search is active
  const { data: contextualArticles = [], isLoading: contextualLoading } = useKnowledgeContextual(
    !activeCategory && !searchQuery ? moduleId : undefined
  );

  // Fetch articles with filters
  const { data: articlesData, isLoading: articlesLoading } = useKnowledgeArticles({
    category: activeCategory || undefined,
    limit,
    offset: page * limit,
  });

  // Search results (only when searching)
  const { data: searchResults = [], isLoading: searchLoading } = useKnowledgeSearch(searchQuery);

  // Use search results, contextual articles, or regular articles
  const articles = useMemo(() => {
    if (searchQuery.length >= 2) return searchResults;
    if (!activeCategory && moduleId && contextualArticles.length > 0) return contextualArticles;
    return articlesData?.articles || [];
  }, [searchQuery, searchResults, activeCategory, moduleId, contextualArticles, articlesData]);

  const total = searchQuery.length >= 2 ? searchResults.length : articlesData?.total || 0;
  const isLoading = categoriesLoading || articlesLoading || searchLoading || contextualLoading;

  // Reset page when category changes
  const handleCategoryClick = (slug: string | null) => {
    setActiveCategory(slug);
    setPage(0);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="px-1 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('help.knowledge.searchPlaceholder', 'Search articles...')}
            className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Category Pills */}
      {!searchQuery && (
        <div className="px-1 mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => handleCategoryClick(null)}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
              transition-all whitespace-nowrap
              ${
                !activeCategory
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-purple-100'
              }
            `}
          >
            {t('help.knowledge.allCategories', 'All')}
          </button>
          {categories.map((cat) => (
            <CategoryChip
              key={cat.id}
              category={cat}
              isActive={activeCategory === cat.slug}
              onClick={() => handleCategoryClick(cat.slug)}
            />
          ))}
        </div>
      )}

      {/* Articles Grid */}
      <div className="flex-1 overflow-y-auto px-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          </div>
        ) : articles.length > 0 ? (
          <div className="grid gap-3">
            {articles.map((article: KbArticleListItem) => (
              <ArticleCard key={article.id} article={article} onClick={onArticleClick} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {searchQuery
                ? t('help.knowledge.noSearchResults', 'No articles found for your search.')
                : t('help.knowledge.noArticles', 'No articles available in this category.')}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!searchQuery && total > limit && (
        <div className="flex items-center justify-between px-1 pt-3 border-t border-slate-200 dark:border-navy-700 mt-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← {t('common.previous', 'Previous')}
          </button>
          <span className="text-xs text-slate-500">
            {page * limit + 1}-{Math.min((page + 1) * limit, total)} {t('common.of', 'of')} {total}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * limit >= total}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('common.next', 'Next')} →
          </button>
        </div>
      )}
    </div>
  );
};

export default KnowledgeLibrary;
