/**
 * TagsSection - Initiative categorization tags
 */

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Plus, Tag, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const TagsSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { t } = useTranslation();
  const { tags, setTags, newTag, setNewTag } = useInitiativeContext();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.18 }}
      className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
    >
      <motion.button
        whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
        whileTap={{ scale: 0.98 }}
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 dark:from-pink-500/20 dark:to-rose-500/20">
            <Tag size={18} className="text-pink-500 dark:text-pink-400" />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('initiatives.tagsSection.tags')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {tags.length > 0 && (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-500">
              {tags.length}
            </span>
          )}
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} className="text-slate-600" />
          </motion.div>
        </div>
      </motion.button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
          >
            <div className="p-4">
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300"
                  >
                    {tag}
                    <button
                      onClick={() => setTags(tags.filter((tg) => tg !== tag))}
                      className="hover:text-pink-900 dark:hover:text-pink-100"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTag.trim()) {
                      setTags([...tags, newTag.trim()]);
                      setNewTag('');
                    }
                  }}
                  placeholder={t('initiatives.tagsSection.newTag')}
                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-pink-400"
                />
                <button
                  onClick={() => {
                    if (newTag.trim()) {
                      setTags([...tags, newTag.trim()]);
                      setNewTag('');
                    }
                  }}
                  disabled={!newTag.trim()}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-500/10 border border-pink-200 dark:border-pink-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
