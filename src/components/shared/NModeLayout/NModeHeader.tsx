/**
 * NModeHeader
 *
 * Standard header bar for all N-mode artifact detail views.
 * Contains: back button, title input, artifact code, permalink, save, chat, mode switcher.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.1
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Copy,
  Loader2,
  Save,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PresentationModeSwitcher } from '@/components/MyWork/shared/PresentationModeSwitcher';
import { ArtifactPermalinkButton } from '@/components/shared/ArtifactPermalinkButton';
import type { PresentationMode } from '@/hooks/usePresentationMode';
import type { ArtifactType } from '@/utils/artifactLinks';

import type { NModeHeaderConfig } from './types';

interface NModeHeaderProps extends NModeHeaderConfig {
  /** Current presentation mode */
  presentationMode: PresentationMode;
  /** Mode change handler */
  onPresentationModeChange: (mode: PresentationMode) => void;
  /** If false, hides the N/C mode switcher (use N-only headers) */
  showModeSwitcher?: boolean;
  /** Build artifact code string from type + id */
  buildArtifactCode?: (type: ArtifactType, id: string) => string;
  /** Optional id for the title input (for guided focus/jump) */
  titleInputId?: string;
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
  saveState,
  lastSavedLabel,
  isDirty = false,
  onClose,
  statusDotColor,
  presentationMode,
  onPresentationModeChange,
  showModeSwitcher = true,
  buildArtifactCode,
  titleInputId,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [copiedId, setCopiedId] = useState(false);
  const artifactCode =
    artifactId && buildArtifactCode
      ? buildArtifactCode(artifactType, artifactId)
      : artifactId || '';
  const copyArtifactId = useCallback(async () => {
    if (!artifactCode) return;
    try {
      await navigator.clipboard.writeText(artifactCode);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }, [artifactCode]);
  const effectiveSaveState = saveState || (saving ? 'saving' : isDirty ? 'dirty' : 'saved');
  const saveCopy = {
    saved: {
      label: isPolish ? 'Zapisano' : 'Saved',
      title: lastSavedLabel || (isPolish ? 'Zmiany zapisane' : 'Changes saved'),
      className:
        'bg-slate-100/70 dark:bg-navy-800/40 text-slate-600 dark:text-slate-500 border-transparent',
      icon: CheckCircle2,
      disabled: true,
    },
    saving: {
      label: isPolish ? 'Zapisywanie...' : 'Saving...',
      title: isPolish ? 'Trwa zapis do backendu' : 'Saving to backend',
      className:
        'bg-blue-500/10 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
      icon: Loader2,
      disabled: true,
    },
    dirty: {
      label: isPolish ? 'Zapisz' : 'Save',
      title: isPolish ? 'Masz niezapisane zmiany' : 'You have unsaved changes',
      className:
        'bg-blue-500/10 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/15 dark:hover:bg-blue-500/15 border-blue-500/20',
      icon: Save,
      disabled: false,
    },
    error: {
      label: isPolish ? 'Błąd zapisu' : 'Save failed',
      title: isPolish
        ? 'Zapis nie powiódł się. Kliknij, aby spróbować ponownie.'
        : 'Save failed. Click to retry.',
      className:
        'bg-danger-500/10 dark:bg-danger-500/10 text-danger-700 dark:text-danger-300 hover:bg-danger-500/15 dark:hover:bg-danger-500/15 border-danger-500/30',
      icon: AlertTriangle,
      disabled: false,
    },
  }[effectiveSaveState];
  const SaveIcon = effectiveSaveState === 'saving' ? Loader2 : saveCopy.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="col-span-full bg-slate-50/90 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl overflow-hidden"
    >
      <div className="flex items-center gap-4 px-5 py-3">
        {/* Back button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="p-2 -ml-2 rounded-xl text-slate-600 hover:bg-slate-200/80 dark:hover:bg-navy-800/60 transition-all duration-150"
        >
          <ChevronLeft size={20} />
        </motion.button>

        {/* Title area */}
        <div className="flex-1 flex items-center gap-3">
          {statusDotColor && <div className={`w-3 h-3 rounded-full ${statusDotColor} shadow-lg`} />}
          <input
            id={titleInputId}
            type="text"
            value={title}
            onChange={(e) => !titleReadOnly && onTitleChange(e.target.value)}
            onBlur={() => {
              // Canon A1: auto-save on blur. Only fire when editable, there are
              // unsaved changes, and we're not mid-save (avoid double-submit).
              if (!titleReadOnly && isDirty && !saving && effectiveSaveState !== 'saving') {
                onSave?.();
              }
            }}
            readOnly={titleReadOnly}
            className="flex-1 text-xl font-bold bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
            placeholder={
              titlePlaceholder ? (isPolish ? titlePlaceholder.pl : titlePlaceholder.en) : undefined
            }
            autoFocus={!artifactId}
          />
          {artifactId && (
            <>
              <button
                type="button"
                onClick={copyArtifactId}
                title={isPolish ? 'Kopiuj ID artefaktu' : 'Copy artifact ID'}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-200/60 dark:bg-navy-800/60 text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-300/60 dark:hover:bg-navy-700/60"
              >
                {copiedId ? (
                  <Check size={10} className="text-emerald-500" />
                ) : (
                  <Copy size={10} className="opacity-60" />
                )}
                {artifactCode}
              </button>
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
            disabled={saveCopy.disabled}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed ${saveCopy.className} ${saving ? 'opacity-70' : ''}`}
            title={saveCopy.title}
          >
            <SaveIcon size={16} className={effectiveSaveState === 'saving' ? 'animate-spin' : ''} />
            <span>{saveCopy.label}</span>
          </motion.button>
          {lastSavedLabel && effectiveSaveState === 'saved' ? (
            <span className="hidden items-center gap-1 text-[11px] text-slate-600 dark:text-slate-500 2xl:inline-flex">
              <Clock3 size={12} />
              {lastSavedLabel}
            </span>
          ) : null}

          {/* Mode Switcher */}
          {showModeSwitcher && (
            <>
              <div className="w-px h-6 bg-slate-200/50 dark:bg-navy-700/30" />
              <PresentationModeSwitcher
                value={presentationMode}
                onChange={onPresentationModeChange}
              />
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default NModeHeader;
