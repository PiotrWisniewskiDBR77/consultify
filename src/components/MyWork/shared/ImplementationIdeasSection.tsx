/**
 * ImplementationIdeasSection
 * Brainstorming component for task implementation ideas
 * Supports manual and AI-generated ideas
 */

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Lightbulb, Plus, Sparkles, ThumbsUp, Trash2, User, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ImplementationIdea {
  id: string;
  title: string;
  description: string;
  source: 'manual' | 'ai' | 'team';
  status: 'idea' | 'considered' | 'selected' | 'rejected';
  votes: number;
  votedByMe: boolean;
  createdBy?: string;
  createdAt?: string;
}

interface ImplementationIdeasSectionProps {
  ideas: ImplementationIdea[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<ImplementationIdea>) => void;
  onRemove: (id: string) => void;
  onVote: (id: string) => void;
  onGenerateAI?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  readOnly?: boolean;
  isGenerating?: boolean;
}

const STATUS_CONFIG = {
  idea: {
    label: { en: 'Idea', pl: 'Pomysł' },
    color: 'bg-slate-400',
    textColor: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-500/20',
  },
  considered: {
    label: { en: 'Considered', pl: 'Rozważany' },
    color: 'bg-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-500/20',
  },
  selected: {
    label: { en: 'Selected', pl: 'Wybrany' },
    color: 'bg-emerald-500',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-500/20',
  },
  rejected: {
    label: { en: 'Rejected', pl: 'Odrzucony' },
    color: 'bg-danger-500',
    textColor: 'text-danger-600 dark:text-danger-400',
    bgColor: 'bg-danger-100 dark:bg-danger-500/20',
  },
};

const SOURCE_CONFIG = {
  manual: {
    label: { en: 'Manual', pl: 'Ręczny' },
    icon: User,
    color: 'text-slate-500',
  },
  ai: {
    label: { en: 'AI', pl: 'AI' },
    icon: Sparkles,
    color: 'text-c-info',
  },
  team: {
    label: { en: 'Team', pl: 'Zespół' },
    icon: User,
    color: 'text-blue-500',
  },
};

export const ImplementationIdeasSection: React.FC<ImplementationIdeasSectionProps> = ({
  ideas,
  onAdd,
  onUpdate,
  onRemove,
  onVote,
  onGenerateAI,
  expanded = false,
  onToggleExpand,
  readOnly = false,
  isGenerating = false,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [editingId, setEditingId] = useState<string | null>(null);

  // Sort by votes and status
  const sortedIdeas = [...ideas].sort((a, b) => {
    // Selected first
    if (a.status === 'selected' && b.status !== 'selected') return -1;
    if (b.status === 'selected' && a.status !== 'selected') return 1;
    // Then by votes
    return b.votes - a.votes;
  });

  const selectedCount = ideas.filter((i) => i.status === 'selected').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/50 shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
    >
      {/* Collapsible Header */}
      <motion.button
        whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
        whileTap={{ scale: 0.98 }}
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 dark:bg-blue-500/20">
            <Zap size={18} className="text-blue-500 dark:text-blue-400" />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('myWork.implementationIdeas.implementationIdeas', 'Implementation Ideas')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {ideas.length > 0 && (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
              {ideas.length}
            </span>
          )}
          {/* AI Button - visible only when expanded */}
          <AnimatePresence>
            {expanded && onGenerateAI && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateAI();
                }}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-c-info/10 dark:bg-c-info/20 text-c-info hover:bg-c-info/20 dark:hover:bg-c-info/30 text-xs font-medium transition-all disabled:opacity-50"
                title={t('myWork.implementationIdeas.title', 'Generate AI')}
              >
                {isGenerating ? (
                  <Sparkles size={14} className="animate-pulse" />
                ) : (
                  <Sparkles size={14} />
                )}
                <span>AI</span>
              </motion.button>
            )}
          </AnimatePresence>
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
          </motion.div>
        </div>
      </motion.button>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {/* Ideas List */}
              {ideas.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
                  <Lightbulb
                    size={32}
                    className="mx-auto mb-2 text-slate-700 dark:text-slate-400"
                  />
                  <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    {t('myWork.implementationIdeas.noIdeasYet', 'No ideas yet')}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">
                    {t(
                      'myWork.implementationIdeas.addIdeasOnHow',
                      'Add ideas on how to implement this task'
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedIdeas.map((idea) => {
                    const statusConfig = STATUS_CONFIG[idea.status];
                    const sourceConfig = SOURCE_CONFIG[idea.source];
                    const SourceIcon = sourceConfig.icon;
                    const isEditing = editingId === idea.id;

                    return (
                      <motion.div
                        key={idea.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`rounded-xl border transition-all ${
                          idea.status === 'selected'
                            ? 'border-emerald-300 dark:border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-500/10'
                            : isEditing
                              ? 'border-blue-300 dark:border-blue-500/50 bg-blue-50/50 dark:bg-blue-500/5'
                              : 'border-slate-200 dark:border-navy-600 bg-slate-50/50 dark:bg-navy-800/50'
                        }`}
                      >
                        {/* Idea Header */}
                        <div
                          className="flex items-center justify-between px-4 py-3 cursor-pointer"
                          onClick={() => !readOnly && setEditingId(isEditing ? null : idea.id)}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Vote button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onVote(idea.id);
                              }}
                              disabled={readOnly}
                              className={`flex flex-col items-center p-1.5 rounded-lg transition-colors ${
                                idea.votedByMe
                                  ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                  : 'hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              <ThumbsUp
                                size={14}
                                className={idea.votedByMe ? 'fill-current' : ''}
                              />
                              <span className="text-xs font-medium">{idea.votes}</span>
                            </button>

                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={idea.title}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  onUpdate(idea.id, { title: e.target.value });
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full text-sm font-medium bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none truncate"
                                placeholder={t(
                                  'myWork.implementationIdeas.placeholder',
                                  'Idea name...'
                                )}
                                readOnly={readOnly}
                              />
                              <div className="flex items-center gap-2 mt-1">
                                <span
                                  className={`flex items-center gap-1 text-xs ${sourceConfig.color}`}
                                >
                                  <SourceIcon size={10} />
                                  {isPolish ? sourceConfig.label.pl : sourceConfig.label.en}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Status badge */}
                            <select
                              value={idea.status}
                              onChange={(e) => {
                                e.stopPropagation();
                                onUpdate(idea.id, {
                                  status: e.target.value as ImplementationIdea['status'],
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              disabled={readOnly}
                              className={`px-2 py-0.5 rounded text-xs font-medium border-0 cursor-pointer focus:outline-none ${statusConfig.bgColor} ${statusConfig.textColor}`}
                            >
                              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                <option key={key} value={key}>
                                  {isPolish ? config.label.pl : config.label.en}
                                </option>
                              ))}
                            </select>

                            {!readOnly && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemove(idea.id);
                                }}
                                className="p-1 rounded hover:bg-danger-100 dark:hover:bg-danger-500/20 text-slate-500 dark:text-slate-400 hover:text-danger-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}

                            <ChevronDown
                              size={16}
                              className={`text-slate-500 dark:text-slate-400 transition-transform ${isEditing ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </div>

                        {/* Idea Details (Expanded) */}
                        <AnimatePresence>
                          {isEditing && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-2 border-t border-slate-200 dark:border-navy-600">
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                  {t('myWork.implementationIdeas.description', 'Description')}
                                </label>
                                <textarea
                                  value={idea.description}
                                  onChange={(e) =>
                                    onUpdate(idea.id, { description: e.target.value })
                                  }
                                  rows={3}
                                  disabled={readOnly}
                                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-blue-400 resize-none"
                                  placeholder={t(
                                    'myWork.implementationIdeas.describeTheIdeaDetails',
                                    'Describe the idea details...'
                                  )}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Add Idea Button */}
              {!readOnly && (
                <div className="pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onAdd}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Plus size={18} />
                    <span className="text-sm font-medium">
                      {t('myWork.implementationIdeas.addIdea', 'Add idea')}
                    </span>
                  </motion.button>
                </div>
              )}

              {/* Selected count hint */}
              {selectedCount > 0 && (
                <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                  <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                    <Lightbulb size={12} />
                    <span>
                      {t(
                        'myWork.implementationIdeas.selectedForImplementation',
                        '{{count}} idea(s) selected for implementation',
                        { count: selectedCount }
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ImplementationIdeasSection;
