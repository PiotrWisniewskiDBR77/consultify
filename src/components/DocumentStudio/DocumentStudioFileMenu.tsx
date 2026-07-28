/**
 * Consultify Document Studio — File menu (M1).
 *
 * 2026-07-28, live odbiór (N20, `_NAGRANIE_PIOTRA_WIZJA_MATERIALY_2026-07-27.md`
 * część 3): "Nie ma Zapisz, Zapisz jako, Otwórz — to co jest pierwszymi
 * przyciskami w Wordzie." Document Studio's top bar only had end-of-flow
 * operations (History · QA · Governance · Share · Export DOCX · AI Editor);
 * nothing operated on the FILE itself.
 *
 * A single "Plik" dropdown groups the four Word-equivalent operations so the
 * top bar stays dense (kanon: JEDEN blok, nie 4 luźne przyciski):
 *   - Nowy      — start a fresh document (delegates to whatever "start
 *                 over" flow the host already has; Document Studio has no
 *                 separate create-blank-draft path — see
 *                 `DocumentStudioView.handleCreateEmptyDoc`).
 *   - Otwórz    — the cheapest correct answer per the ticket's own framing:
 *                 navigate to the Materiały documents list rather than
 *                 build a bespoke "recent files" picker (that list already
 *                 IS the canonical "Otwórz" surface — same target the
 *                 existing "Wróć do Materiałów" control uses).
 *   - Zapisz    — Document Studio autosaves (P0 data-loss fix,
 *                 `DocumentTipTapEditor.tsx` `persistManualEdit`); this row
 *                 is deliberately NOT a manual-save action (that would lie
 *                 about there being something to trigger). It surfaces the
 *                 live autosave status instead, honestly, per the
 *                 "zero cichych fallbacków" house rule.
 *   - Zapisz jako — no artifact-duplication endpoint exists for Document
 *                 Studio documents (checked: only template cloning does,
 *                 `POST /document-studio/templates/:id/clone`). Implemented
 *                 minimally by composing two EXISTING endpoints the panel
 *                 already calls elsewhere: create a fresh artifact
 *                 (`generateDocumentStudioArtifact`, the same
 *                 deterministic/no-LLM path `handleCreateEmptyDoc` uses),
 *                 then overwrite its sections with the current schema's via
 *                 the same manual-content PUT the editor's autosave uses
 *                 (`saveDocumentStudioManualContent`). No new backend engine.
 */

import { Check, ChevronDown, Copy, FilePlus, FolderOpen, Loader2, Save, Wand2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DocumentAutosaveStatus } from './editor';

export interface DocumentStudioFileMenuProps {
  onNew: () => void;
  onOpen: () => void;
  /**
   * `undefined` when there is no artifact yet (intake / plan-template
   * phase) — the Zapisz row renders a neutral "not applicable" state
   * instead of claiming a save happened.
   */
  saveStatus: DocumentAutosaveStatus | undefined;
  onSaveAs?: () => void;
  saveAsBusy?: boolean;
  /**
   * Fala 2 (2026-07-28) — "Zrób z tego wzorzec" (ożywienie fantomu:
   * `createTemplateFromArtifact` istniał server-side, zero przycisku w UI
   * go wywoływało). `undefined` when there is no artifact yet — row hidden,
   * same convention as `onSaveAs`.
   */
  onSaveAsTemplate?: () => void;
}

function useOutsideClose(open: boolean, onClose: () => void): React.RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref as React.RefObject<HTMLDivElement>;
}

export const DocumentStudioFileMenu: React.FC<DocumentStudioFileMenuProps> = ({
  onNew,
  onOpen,
  saveStatus,
  onSaveAs,
  saveAsBusy = false,
  onSaveAsTemplate,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));

  const saveAsDisabled = !onSaveAs || saveAsBusy;

  const saveStatusMeta = ((): { label: string; icon: React.ReactNode } => {
    switch (saveStatus) {
      case 'saving':
        return {
          label: t('documentStudio.fileMenu.saveStatusSaving', 'Zapisywanie…'),
          icon: (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-c-text-muted" aria-hidden />
          ),
        };
      case 'conflict':
        return {
          label: t(
            'documentStudio.fileMenu.saveStatusConflict',
            'Konflikt zapisu — pobrano najnowszą wersję'
          ),
          icon: <Save className="h-3.5 w-3.5 shrink-0 text-c-warning" aria-hidden />,
        };
      case 'error':
        return {
          label: t('documentStudio.fileMenu.saveStatusError', 'Błąd zapisu — spróbuj ponownie'),
          icon: <Save className="h-3.5 w-3.5 shrink-0 text-c-danger" aria-hidden />,
        };
      case 'idle':
      case 'saved':
        return {
          label: t('documentStudio.fileMenu.saveStatusSaved', 'Zapisano automatycznie'),
          icon: <Check className="h-3.5 w-3.5 shrink-0 text-c-success" aria-hidden />,
        };
      default:
        return {
          label: t('documentStudio.fileMenu.saveStatusDisabled', 'Brak dokumentu do zapisania'),
          icon: <Save className="h-3.5 w-3.5 shrink-0 text-c-text-muted" aria-hidden />,
        };
    }
  })();

  const closeAnd = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-c-border-subtle px-2.5 text-sm text-c-text-secondary transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="document-file-menu-trigger"
      >
        <span className="hidden sm:inline">{t('documentStudio.fileMenu.trigger', 'Plik')}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={t('documentStudio.fileMenu.trigger', 'Plik')}
          // U4 (odbiór "menu pliku") — was `left-0`, which overflowed past the
          // right edge of the viewport at 1280px when the trigger sits near
          // the right side of the bar (now more likely per U3's reordering).
          // `right-0` mirrors the existing `⋯` OverflowMenu in `TopBar.tsx`,
          // which already solves this exact viewport-collision problem the
          // same way. Verified at 1280px and 1024px.
          className="absolute right-0 top-full z-dropdown mt-1 min-w-[260px] max-w-[calc(100vw-2rem)] rounded-token-md border border-c-border-subtle bg-c-surface p-1 shadow-lg"
          data-testid="document-file-menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={closeAnd(onNew)}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-c-text-secondary transition-colors hover:bg-c-surface-raised"
            data-testid="document-file-menu-new"
          >
            <FilePlus className="h-3.5 w-3.5 shrink-0 text-c-text-muted" aria-hidden />
            <span className="flex-1 truncate">{t('documentStudio.fileMenu.new', 'Nowy')}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={closeAnd(onOpen)}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-c-text-secondary transition-colors hover:bg-c-surface-raised"
            data-testid="document-file-menu-open"
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-c-text-muted" aria-hidden />
            <span className="flex-1 truncate">{t('documentStudio.fileMenu.open', 'Otwórz')}</span>
          </button>
          <div className="my-1 border-t border-c-border-subtle" aria-hidden="true" />
          {/* Zapisz — status only, not a manual-save button: Document Studio
              autosaves. A clickable "Save" here would either be a no-op
              (dishonest) or duplicate the debounce logic (a second save
              engine). Showing the true state satisfies N20 ("gdzie jest
              Zapisz") without lying about what happens on click. */}
          <div
            role="menuitem"
            aria-disabled="true"
            className="flex w-full cursor-default items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-c-text-secondary"
            data-testid="document-file-menu-save"
          >
            {saveStatusMeta.icon}
            <span className="flex-1 truncate">{t('documentStudio.fileMenu.save', 'Zapisz')}</span>
            <span className="shrink-0 truncate text-[11px] text-c-text-muted">
              {saveStatusMeta.label}
            </span>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={saveAsDisabled ? undefined : closeAnd(onSaveAs!)}
            disabled={saveAsDisabled}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-c-text-secondary transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="document-file-menu-save-as"
          >
            {saveAsBusy ? (
              <Loader2
                className="h-3.5 w-3.5 shrink-0 animate-spin text-c-text-muted"
                aria-hidden
              />
            ) : (
              <Copy className="h-3.5 w-3.5 shrink-0 text-c-text-muted" aria-hidden />
            )}
            <span className="flex-1 truncate">
              {saveAsBusy
                ? t('documentStudio.fileMenu.saveAsBusy', 'Duplikuję…')
                : t('documentStudio.fileMenu.saveAs', 'Zapisz jako')}
            </span>
          </button>
          {onSaveAsTemplate ? (
            <>
              <div className="my-1 border-t border-c-border-subtle" aria-hidden="true" />
              <button
                type="button"
                role="menuitem"
                onClick={closeAnd(onSaveAsTemplate)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-c-text-secondary transition-colors hover:bg-c-surface-raised"
                data-testid="document-file-menu-save-as-template"
              >
                <Wand2 className="h-3.5 w-3.5 shrink-0 text-c-text-muted" aria-hidden />
                <span className="flex-1 truncate">
                  {t('documentStudio.fileMenu.saveAsTemplate', 'Zrób z tego wzorzec')}
                </span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default DocumentStudioFileMenu;
