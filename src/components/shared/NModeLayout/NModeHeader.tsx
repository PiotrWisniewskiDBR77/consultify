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
  Sparkles,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PresentationModeSwitcher } from '@/components/MyWork/shared/PresentationModeSwitcher';
import { ArtifactPermalinkButton } from '@/components/shared/ArtifactPermalinkButton';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';
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
  onChat,
  onClose,
  statusDotColor,
  presentationMode,
  onPresentationModeChange,
  showModeSwitcher = true,
  buildArtifactCode,
  titleInputId,
  primaryAction,
  showChatButton = false,
}) => {
  const { t, i18n } = useTranslation();
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
      label: t('sharedComponents.nModeHeader.savedLabel'),
      title: lastSavedLabel || t('sharedComponents.nModeHeader.savedTitle'),
      className:
        'bg-slate-100/70 dark:bg-navy-800/40 text-slate-600 dark:text-slate-500 border-transparent',
      icon: CheckCircle2,
      disabled: true,
    },
    saving: {
      label: t('sharedComponents.nModeHeader.savingLabel'),
      title: t('sharedComponents.nModeHeader.savingTitle'),
      className:
        'bg-blue-500/10 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
      icon: Loader2,
      disabled: true,
    },
    dirty: {
      label: t('sharedComponents.nModeHeader.saveLabel'),
      title: t('sharedComponents.nModeHeader.dirtyTitle'),
      className:
        'bg-blue-500/10 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/15 dark:hover:bg-blue-500/15 border-blue-500/20',
      icon: Save,
      disabled: false,
    },
    error: {
      label: t('sharedComponents.nModeHeader.saveFailedLabel'),
      title: t('sharedComponents.nModeHeader.saveFailedTitle'),
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
          className="p-2 -ml-2 rounded-xl text-c-text-secondary hover:bg-state-hover transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
        >
          <ChevronLeft size={20} />
        </motion.button>

        {/* Title area */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
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
            className="flex-1 text-xl font-bold bg-transparent text-c-text placeholder-c-text-muted border-b-2 border-transparent focus:outline-none focus:border-c-focus-solid transition-colors"
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
                title={t('sharedComponents.nModeHeader.copyArtifactId')}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md bg-c-surface-raised text-[10px] font-mono uppercase text-c-text-muted transition-colors hover:bg-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
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
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-fast ease-standard disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] ${saveCopy.className} ${saving ? 'opacity-70' : ''}`}
            title={saveCopy.title}
          >
            <SaveIcon size={16} className={effectiveSaveState === 'saving' ? 'animate-spin' : ''} />
            <span>{saveCopy.label}</span>
          </motion.button>
          {lastSavedLabel && effectiveSaveState === 'saved' ? (
            <span className="hidden items-center gap-1 text-[11px] text-c-text-muted 2xl:inline-flex">
              <Clock3 size={12} />
              {lastSavedLabel}
            </span>
          ) : null}

          {/* AI (#27/#37): header slot for klasa S (Task/Decision — no M3),
              opt-in via showChatButton so other NModeHeader consumers that
              already pass onChat (Notification/Initiative/Insight) are
              unaffected until reviewed separately. */}
          {showChatButton && onChat && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onChat}
              className="flex items-center gap-1.5 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-sm font-medium text-c-text transition-all duration-fast ease-standard hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
              title={t('sharedComponents.nModeHeader.aiAssistantTitle')}
            >
              <Sparkles size={16} className="text-c-text-muted" />
              <span>AI</span>
            </motion.button>
          )}

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

          {/* M1 primary CTA (SPEC-A §299) — ONE action, rightmost edge. Omitted
              by every other NModeHeader consumer (Task/Decision/…) unless they
              explicitly pass `primaryAction`. */}
          {primaryAction && (
            <>
              <div className="w-px h-6 bg-c-border-subtle" />
              <button
                type="button"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                title={
                  primaryAction.title
                    ? isPolish
                      ? primaryAction.title.pl
                      : primaryAction.title.en
                    : undefined
                }
                className={`${MENU_1_PRIMARY_CTA} shrink-0 whitespace-nowrap`}
              >
                {primaryAction.icon && <primaryAction.icon size={16} />}
                <span>{isPolish ? primaryAction.label.pl : primaryAction.label.en}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default NModeHeader;
