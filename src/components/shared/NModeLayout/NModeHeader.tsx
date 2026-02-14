/**
 * NModeHeader
 *
 * Standard header bar for all N-mode artifact detail views.
 * Contains: back button, title input, artifact code, permalink, save, chat, mode switcher.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.1
 */

import { motion } from 'framer-motion';
import { ChevronLeft, Loader2, MessageSquare, Save } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { PresentationModeSwitcher } from '@/components/MyWork/shared/PresentationModeSwitcher';
import { ArtifactPermalinkButton } from '@/components/shared/ArtifactPermalinkButton';
import type { PresentationMode } from '@/hooks/usePresentationMode';

import type { NModeHeaderConfig } from './types';

interface NModeHeaderProps extends NModeHeaderConfig {
  /** Current presentation mode */
  presentationMode: PresentationMode;
  /** Mode change handler */
  onPresentationModeChange: (mode: PresentationMode) => void;
  /** Build artifact code string from type + id */
  buildArtifactCode?: (type: string, id: string) => string;
}

export const NModeHeader: React.FC<NModeHeaderProps> = ({
  title,
  onTitleChange,
  titleReadOnly = false,
  titlePlaceholder,
  artifactId,
  artifactType,
  onSave,
  saving = false,
  isDirty = false,
  onChat,
  onClose,
  draftSavedLabel,
  statusDotColor,
  presentationMode,
  onPresentationModeChange,
  buildArtifactCode,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="col-span-full bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
    >
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Back button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-navy-800/80 transition-all"
        >
          <ChevronLeft size={20} />
        </motion.button>

        {/* Title area */}
        <div className="flex-1 flex items-center gap-3">
          {statusDotColor && <div className={`w-3 h-3 rounded-full ${statusDotColor} shadow-lg`} />}
          <input
            type="text"
            value={title}
            onChange={(e) => !titleReadOnly && onTitleChange(e.target.value)}
            readOnly={titleReadOnly}
            className="flex-1 text-xl font-bold bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            placeholder={
              titlePlaceholder ? (isPolish ? titlePlaceholder.pl : titlePlaceholder.en) : undefined
            }
            autoFocus={!artifactId}
          />
          {artifactId && (
            <>
              <span className="hidden sm:inline-flex px-2 py-1 rounded-md border border-slate-300/50 dark:border-navy-600/70 text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                {buildArtifactCode ? buildArtifactCode(artifactType, artifactId) : artifactId}
              </span>
              <ArtifactPermalinkButton
                artifactType={artifactType}
                artifactId={artifactId}
                isPolish={isPolish}
                size={14}
              />
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Save */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onSave}
            disabled={saving || !isDirty}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:cursor-not-allowed ${
              isDirty
                ? 'bg-white/70 dark:bg-navy-900/50 border border-blue-500/40 dark:border-blue-400/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/10'
                : 'bg-slate-100/70 dark:bg-navy-900/40 border border-slate-300/50 dark:border-navy-700/60 text-slate-400 dark:text-slate-500'
            } ${saving ? 'opacity-70' : ''}`}
            title={
              isDirty
                ? isPolish
                  ? 'Zapisz i opublikuj zmiany'
                  : 'Save and publish changes'
                : isPolish
                  ? 'Brak zmian do zapisu'
                  : 'No changes to save'
            }
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>
              {isDirty ? (isPolish ? 'Zapisz' : 'Save') : isPolish ? 'Zapisane' : 'Saved'}
            </span>
          </motion.button>

          {/* Chat */}
          {onChat && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onChat}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-purple-500/40 dark:border-purple-400/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 dark:hover:bg-purple-500/10 text-sm font-semibold transition-all shadow-sm"
              title={isPolish ? 'Otwórz czat' : 'Open chat'}
            >
              <MessageSquare size={16} />
              <span>{isPolish ? 'Czat' : 'Chat'}</span>
            </motion.button>
          )}

          {/* Mode Switcher */}
          <div className="w-px h-6 bg-slate-200 dark:bg-navy-700" />
          <PresentationModeSwitcher value={presentationMode} onChange={onPresentationModeChange} />
          {draftSavedLabel && (
            <span className="hidden xl:inline text-xs text-slate-500 dark:text-slate-400">
              {draftSavedLabel}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default NModeHeader;
