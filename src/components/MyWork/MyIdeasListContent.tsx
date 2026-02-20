import { Lightbulb, Loader2, Plus, Tag } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

export type MyIdea = {
  id: string;
  title: string;
  body?: string | null;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  sourceType?: string | null;
  sourceConversationId?: string | null;
  sourceMessageId?: string | null;
};

interface MyIdeasListContentProps {
  searchQuery: string;
  onIdeaClick: (ideaId: string, ideaData?: MyIdea) => void;
  onCreateIdea: () => void;
  onCountsChange: (counts: { total: number }) => void;
}

export const MyIdeasListContent: React.FC<MyIdeasListContentProps> = ({
  searchQuery,
  onIdeaClick,
  onCreateIdea,
  onCountsChange,
}) => {
  const { t } = useTranslation();
  const [ideas, setIdeas] = useState<MyIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string>('all');

  const fetchIdeas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Api.getMyIdeas({ q: searchQuery || undefined, limit: 200 });
      setIdeas((data || []) as MyIdea[]);
    } catch (err) {
      console.error('Failed to fetch ideas:', err);
      toast.error(t('myWork.errors.fetchFailed', 'Failed to load ideas'));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, t]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  useEffect(() => {
    onCountsChange({ total: ideas.length });
  }, [ideas.length, onCountsChange]);

  const tags = useMemo(() => {
    const s = new Set<string>();
    ideas.forEach((i) => (i.tags || []).forEach((tag) => s.add(String(tag).toLowerCase())));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [ideas]);

  const filteredIdeas = useMemo(() => {
    if (activeTag === 'all') return ideas;
    return ideas.filter((i) => (i.tags || []).map((x) => String(x).toLowerCase()).includes(activeTag));
  }, [ideas, activeTag]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-navy-950">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Tag filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTag('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeTag === 'all'
                ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
            }`}
          >
            {t('myWork.ideas.tags.all', 'All')}
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeTag === tag
                  ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                  : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
              }`}
              title={tag}
            >
              <span className="inline-flex items-center gap-1">
                <Tag size={12} />
                {tag}
              </span>
            </button>
          ))}
        </div>

        {filteredIdeas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl">
            <Lightbulb size={48} className="text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-2">
              {t('myWork.ideas.empty.title', 'No ideas yet')}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {t(
                'myWork.ideas.empty.description',
                'Save a great insight from chat to build your private idea library.'
              )}
            </p>
            <button
              onClick={onCreateIdea}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-400 border border-blue-500/50 rounded-lg hover:bg-blue-500/10 transition-colors"
            >
              <Plus size={16} />
              {t('myWork.ideas.create', 'New idea')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredIdeas.map((idea) => (
              <button
                key={idea.id}
                onClick={() => onIdeaClick(idea.id, idea)}
                className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {idea.title}
                    </div>
                    {idea.body ? (
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {idea.body}
                      </div>
                    ) : null}
                    {(idea.tags || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(idea.tags || []).slice(0, 6).map((tag) => (
                          <span
                            key={`${idea.id}-${tag}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-navy-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {idea.createdAt ? new Date(idea.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyIdeasListContent;

