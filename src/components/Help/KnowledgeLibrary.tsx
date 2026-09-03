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
  AlertTriangle,
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
  KbCollection,
  KbTag,
  useKnowledgeArticles,
  useKnowledgeCategories,
  useKnowledgeCollectionArticles,
  useKnowledgeCollections,
  useKnowledgeContextual,
  useKnowledgeSearch,
  useKnowledgeSearchFaceted,
  useKnowledgeTags,
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
      data-testid={`help-article-card-${article.slug}`}
      className="w-full text-left p-4 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all group"
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-[10px] font-semibold rounded-full uppercase">
          <DynamicIcon name={article.category_icon} size={10} />
          {article.category_name}
        </span>
        {article.is_featured && <Star size={12} className="text-amber-500 fill-amber-500" />}
        {(article as any)?.is_fallback && (article as any)?.resolved_language && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 text-[10px] font-semibold uppercase">
            {String((article as any).resolved_language).toUpperCase()}
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
        {article.title}
      </h4>

      {/* Summary */}
      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
        {article.summary}
      </p>

      {/* Meta */}
      <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-500">
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
        <ChevronRight size={16} className="text-primary-500" />
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
          ? 'bg-navy-900 text-white shadow-md'
          : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-primary-100 dark:hover:bg-primary-900/30'
      }
    `}
  >
    <DynamicIcon name={category.icon} size={12} />
    {category.name}
    <span
      className={`text-[10px] ${isActive ? 'text-slate-300 dark:text-slate-400' : 'text-slate-600'}`}
    >
      ({category.article_count})
    </span>
  </button>
);

// ============================================
// COLLECTION CARD (P26-B: IA spine)
// ============================================

interface CollectionCardProps {
  collection: KbCollection;
  onClick: (slug: string) => void;
}

const CollectionCard: React.FC<CollectionCardProps> = ({ collection, onClick }) => (
  <button
    onClick={() => onClick(collection.slug)}
    className="w-full text-left p-3 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all group"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <FolderOpen size={16} className="text-primary-500" />
        <span className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
          {collection.title}
        </span>
        {collection.featured && <Sparkles size={12} className="text-amber-500" />}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-600">{collection.article_count}</span>
        <ChevronRight size={14} className="text-slate-600 group-hover:text-primary-500" />
      </div>
    </div>
    {collection.description && (
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
        {collection.description}
      </p>
    )}
  </button>
);

// ============================================
// TAG CHIP (P26-B: facets)
// ============================================

interface TagChipProps {
  tag: KbTag;
  isActive: boolean;
  onClick: () => void;
}

const TagChip: React.FC<TagChipProps> = ({ tag, isActive, onClick }) => {
  const kindColors: Record<string, string> = {
    domain: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    tool: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    concept: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
    stage: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    audience: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all whitespace-nowrap
        ${isActive ? 'bg-navy-900 dark:bg-white/15 text-white shadow-sm ring-1 ring-slate-500/40 dark:ring-white/30' : kindColors[tag.kind] || 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300'}
      `}
    >
      {tag.label}
      <span className={`text-[9px] ${isActive ? 'text-slate-300' : 'opacity-60'}`}>
        ({tag.article_count})
      </span>
    </button>
  );
};

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
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const limit = 10;

  // P26-B: Collections (IA spine — primary browse)
  const { data: collections = [], isLoading: collectionsLoading } = useKnowledgeCollections();

  // P26-B: Tags (facets)
  const { data: tags = [], isLoading: tagsLoading } = useKnowledgeTags();

  // Fetch categories (legacy, still shown as secondary)
  const { data: categories = [], isLoading: categoriesLoading } = useKnowledgeCategories(true);

  // Collection-scoped articles
  const { data: collectionData, isLoading: collectionArticlesLoading } =
    useKnowledgeCollectionArticles(activeCollection || undefined, limit, page * limit);

  // Fetch contextual articles if moduleId is provided
  const { data: contextualArticles = [], isLoading: contextualLoading } = useKnowledgeContextual(
    !activeCategory && !activeCollection && !searchQuery ? moduleId : undefined
  );

  // Fetch articles with category filter (fallback)
  const { data: articlesData, isLoading: articlesLoading } = useKnowledgeArticles({
    category: !activeCollection ? activeCategory || undefined : undefined,
    limit,
    offset: page * limit,
  });

  // P26-B: Faceted search
  const {
    data: facetedResults,
    isLoading: facetedLoading,
    isError: facetedError,
  } = useKnowledgeSearchFaceted(searchQuery, {
    collectionSlug: activeCollection || undefined,
    tagSlugs: activeTags.length > 0 ? activeTags : undefined,
  });

  // Search results (legacy fallback)
  const { data: searchResults = [], isLoading: searchLoading } = useKnowledgeSearch(
    searchQuery.length >= 2 && !facetedResults ? searchQuery : ''
  );

  const articles = useMemo(() => {
    if (searchQuery.length >= 2) {
      return facetedResults?.articles || searchResults;
    }
    if (activeCollection) return collectionData?.articles || [];
    if (!activeCategory && moduleId && contextualArticles.length > 0) return contextualArticles;
    return articlesData?.articles || [];
  }, [
    searchQuery,
    facetedResults,
    searchResults,
    activeCollection,
    collectionData,
    activeCategory,
    moduleId,
    contextualArticles,
    articlesData,
  ]);

  const searchFacets = facetedResults?.facets;

  const total = useMemo(() => {
    if (searchQuery.length >= 2) return facetedResults?.total || searchResults.length;
    if (activeCollection) return collectionData?.total || 0;
    return articlesData?.total || 0;
  }, [searchQuery, facetedResults, searchResults, activeCollection, collectionData, articlesData]);

  const isLoading =
    collectionsLoading ||
    categoriesLoading ||
    articlesLoading ||
    searchLoading ||
    contextualLoading ||
    collectionArticlesLoading ||
    facetedLoading;

  const handleCollectionClick = (slug: string | null) => {
    setActiveCollection(slug);
    setActiveCategory(null);
    setPage(0);
  };

  const handleCategoryClick = (slug: string | null) => {
    setActiveCategory(slug);
    setActiveCollection(null);
    setPage(0);
  };

  const handleTagToggle = (slug: string) => {
    setActiveTags((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveTags([]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="px-1 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('help.knowledge.searchPlaceholder', 'Search articles...')}
            data-testid="help-knowledge-search"
            className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* P26-B: Tag facets (always visible, compact) */}
      {tags.length > 0 && (
        <div className="px-1 mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {tags.slice(0, 12).map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              isActive={activeTags.includes(tag.slug)}
              onClick={() => handleTagToggle(tag.slug)}
            />
          ))}
        </div>
      )}

      {/* P26-B: Search degraded banner */}
      {(facetedError || (facetedResults as any)?.degraded) && searchQuery.length >= 2 && (
        <div className="mx-1 mb-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <AlertTriangle size={14} className="flex-shrink-0" />
          {t(
            'help.knowledge.searchLimited',
            'Search is temporarily limited. Showing browse results instead.'
          )}
        </div>
      )}

      {/* Search facets (shown when searching) */}
      {searchQuery.length >= 2 && searchFacets && (
        <div className="px-1 mb-3">
          {searchFacets.collections.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {searchFacets.collections.map((f: any) => (
                <button
                  key={f.id}
                  onClick={() => handleCollectionClick(f.slug)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all
                    ${activeCollection === f.slug ? 'bg-navy-900 text-white' : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300'}
                  `}
                >
                  <FolderOpen size={10} />
                  {f.title} ({f.count})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* P26-B: Collections (IA spine — primary browse) */}
      {!searchQuery && !activeCollection && collections.length > 0 && (
        <div className="px-1 mb-3">
          <h3 className="text-[10px] font-semibold text-slate-600 dark:text-slate-500 uppercase tracking-wider mb-2">
            {t('help.knowledge.collections', 'Collections')}
          </h3>
          <div className="grid gap-2">
            {collections.map((coll) => (
              <CollectionCard key={coll.id} collection={coll} onClick={handleCollectionClick} />
            ))}
          </div>
        </div>
      )}

      {/* Collection breadcrumb */}
      {activeCollection && (
        <div className="px-1 mb-3 flex items-center gap-2">
          <button
            onClick={() => handleCollectionClick(null)}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            ← {t('help.knowledge.allCollections', 'All Collections')}
          </button>
          <span className="text-xs text-slate-600">
            {collectionData?.collection?.title || activeCollection}
          </span>
        </div>
      )}

      {/* Category Pills (secondary, when no collection active) */}
      {!searchQuery && !activeCollection && categories.length > 0 && (
        <div className="px-1 mb-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => handleCategoryClick(null)}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
              transition-all whitespace-nowrap
              ${
                !activeCategory
                  ? 'bg-navy-900 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-primary-100'
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>
        ) : (facetedError || (facetedResults as any)?.degraded) &&
          searchQuery.length >= 2 &&
          collections.length > 0 ? (
          <div>
            <h3 className="text-[10px] font-semibold text-slate-600 dark:text-slate-500 uppercase tracking-wider mb-2">
              {t('help.knowledge.browseFallback', 'Browse by collection instead')}
            </h3>
            <div className="grid gap-2">
              {collections.map((coll) => (
                <CollectionCard key={coll.id} collection={coll} onClick={handleCollectionClick} />
              ))}
            </div>
          </div>
        ) : articles.length > 0 ? (
          <div className="grid gap-3">
            {articles.map((article: KbArticleListItem) => (
              <ArticleCard key={article.id} article={article} onClick={onArticleClick} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen size={40} className="mx-auto text-slate-600 dark:text-slate-400 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {searchQuery
                ? t('help.knowledge.noSearchResults', 'No articles found for your search.')
                : activeCollection
                  ? t('help.knowledge.emptyCollection', 'No articles in this collection yet.')
                  : t('help.knowledge.noArticles', 'No articles available in this category.')}
            </p>
            {(searchQuery || activeCollection) && (
              <button
                onClick={() => {
                  handleCollectionClick(null);
                  handleClearSearch();
                }}
                className="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                {t('help.knowledge.browseAll', 'Browse all collections')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!searchQuery && total > limit && (
        <div className="flex items-center justify-between px-1 pt-3 border-t border-slate-200 dark:border-navy-700 mt-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← {t('common.previous', 'Previous')}
          </button>
          <span className="text-xs text-slate-500">
            {page * limit + 1}-{Math.min((page + 1) * limit, total)} {t('common.of', 'of')} {total}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * limit >= total}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('common.next', 'Next')} →
          </button>
        </div>
      )}
    </div>
  );
};

export default KnowledgeLibrary;
