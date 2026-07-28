/**
 * FolderCreateDialog — wspólny dialog tworzenia folderu (nazwa + poziom + projekt).
 *
 * POWÓD (AGT-015 §6 D4, zgłoszenie z odbioru): oba miejsca, w których user
 * zakłada folder — Run agent (`AgentHubShell.handleCreateFolder`) i wnętrze
 * sejfu (`VaultDocumentsView.handleCreateFolder`) — szły przez SEKWENCJĘ
 * `window.prompt`: nazwa → (Run agent) poziom cyfrą 1/2/3 → wybór projektu
 * NUMEREM z listy wypisanej w treści prompta. Bardzo szorstkie, bez
 * walidacji poza „pusta nazwa", zero listy projektów do klikania.
 *
 * Poziomy (decyzja Piotra, AGT-015: „pracujemy projektami, te trzy poziomy
 * wydają mi się sensowne") — identyczne z Vault (`VaultScope` w
 * `src/views/vault/vaultDocuments.ts`) i z Run agent (`AgentFolderScope` w
 * `src/services/api/agentPlan.api.ts`), oba `'user' | 'project' | 'organization'`:
 *   - prywatny (user)         — tylko twórca
 *   - projektowy (project)    — zespół projektu, WYMAGA wyboru projektu z listy
 *   - organizacyjny (organization) — cała firma
 *
 * Dwa tryby użycia:
 *   - Poziom WYBIERALNY (Run agent — folder jest płaską listą, poziom pyta
 *     wprost przy tworzeniu): nie podawaj `fixedScope`, dialog pokazuje 3
 *     przełączniki poziomu + (gdy 'project') `<select>` projektów.
 *   - Poziom NARZUCONY (Vault — folder dziedziczy poziom sejfu, w którym
 *     user stoi): podaj `fixedScope` (+ `fixedProjectName` do opisu) — dialog
 *     chowa przełącznik i pokazuje poziom jako kontekst tekstowy, pyta TYLKO
 *     o nazwę.
 *
 * Zero crimson (CLAUDE.md §UI pkt 3/6: `primary-*` KAŻDY numer = crimson) —
 * WYŁĄCZNIE tokeny `c-*`/neutralne, fokus `c-focus`. Wzorzec wizualny 1:1
 * `src/components/Studio/StudioLinkModal.tsx` (portal, `role="dialog"`,
 * nagłówek/treść/stopka, `c-surface`/`c-border-subtle`) + pola formularza
 * 1:1 `src/views/vault/VaultDocumentPanel.tsx` (`FIELD_CLASS`/`LABEL_CLASS`,
 * CTA = `MENU_1_PRIMARY_CTA`).
 */
import { Building2, FolderKanban, Loader2, Plus, User, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

export type FolderCreateScope = 'user' | 'project' | 'organization';

export interface FolderCreateProjectOption {
  id: string;
  name: string;
}

export interface FolderCreateSubmitInput {
  name: string;
  scope: FolderCreateScope;
  projectId?: string;
}

export interface FolderCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: FolderCreateSubmitInput) => void | Promise<void>;
  /** Projekty do wyboru gdy poziom = 'project'. Pusta lista → poziom projektowy zablokowany. */
  projects?: FolderCreateProjectOption[];
  /**
   * Poziom narzucony z zewnątrz (Vault: dziedziczy poziom sejfu) — chowa
   * przełącznik poziomu, dialog pyta TYLKO o nazwę. Pomiń dla poziomu
   * wybieralnego (Run agent).
   */
  fixedScope?: FolderCreateScope;
  /** Etykieta kontekstu przy `fixedScope` (np. nazwa sejfu/projektu) — czysto opisowa. */
  fixedScopeContextLabel?: string;
  /** Trwa zapis (blokuje formularz, pokazuje spinner na CTA). */
  busy?: boolean;
  /** Komunikat błędu z ostatniej próby zapisu (np. z backendu). */
  errorMessage?: string | null;
  title?: string;
}

const FIELD_CLASS =
  'w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';

const LABEL_CLASS =
  'block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';

const GHOST_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 ' +
  'text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

export const FolderCreateDialog: React.FC<FolderCreateDialogProps> = ({
  open,
  onClose,
  onSubmit,
  projects = [],
  fixedScope,
  fixedScopeContextLabel,
  busy = false,
  errorMessage = null,
  title,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [name, setName] = useState('');
  const [scope, setScope] = useState<FolderCreateScope>(fixedScope ?? 'user');
  const [projectId, setProjectId] = useState('');
  const [touched, setTouched] = useState(false);

  // Reset na każde otwarcie — inaczej user widzi resztki poprzedniej próby.
  useEffect(() => {
    if (!open) return;
    setName('');
    setScope(fixedScope ?? 'user');
    setProjectId('');
    setTouched(false);
  }, [open, fixedScope]);

  const levelOptions = useMemo(
    () =>
      [
        {
          value: 'user' as const,
          label: isPolish ? 'Prywatny' : 'Private',
          hint: isPolish ? 'Tylko ja' : 'Only me',
          icon: User,
        },
        {
          value: 'project' as const,
          label: isPolish ? 'Projektowy' : 'Project',
          hint: isPolish ? 'Zespół projektu' : 'Project team',
          icon: FolderKanban,
        },
        {
          value: 'organization' as const,
          label: isPolish ? 'Organizacyjny' : 'Organization',
          hint: isPolish ? 'Cała firma' : 'Whole company',
          icon: Building2,
        },
      ] as const,
    [isPolish]
  );

  const nameError = touched && !name.trim();
  const projectRequiredError = touched && scope === 'project' && !projectId;
  const canSubmit = !!name.trim() && (scope !== 'project' || !!projectId) && !busy;

  const handleSubmit = () => {
    setTouched(true);
    if (!name.trim()) return;
    if (scope === 'project' && !projectId) return;
    void onSubmit({
      name: name.trim(),
      scope,
      projectId: scope === 'project' ? projectId : undefined,
    });
  };

  if (!open) return null;

  const dialog = (
    <div
      className="fixed inset-0 z-overlay flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title || t('shared.folderDialog.title', isPolish ? 'Nowy folder' : 'New folder')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-sm bg-c-surface border border-c-border-subtle rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-c-border-subtle">
          <h2 className="text-sm font-semibold text-c-text">
            {title || t('shared.folderDialog.title', isPolish ? 'Nowy folder' : 'New folder')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1.5 text-c-text-muted hover:text-c-text hover:bg-c-surface-raised rounded-lg transition-colors disabled:opacity-50"
            title={t('common.close', isPolish ? 'Zamknij' : 'Close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className={LABEL_CLASS} htmlFor="folder-create-name">
              {t('shared.folderDialog.name', isPolish ? 'Nazwa folderu' : 'Folder name')}
            </label>
            <input
              id="folder-create-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              placeholder={t(
                'shared.folderDialog.namePlaceholder',
                isPolish ? 'np. Onboarding klienta' : 'e.g. Client onboarding'
              )}
              className={FIELD_CLASS}
              data-testid="folder-create-name"
            />
            {nameError ? (
              <p className="mt-1 text-[11px] text-c-danger">
                {t(
                  'shared.folderDialog.nameRequired',
                  isPolish ? 'Nazwa jest wymagana' : 'Name is required'
                )}
              </p>
            ) : null}
          </div>

          {fixedScope ? (
            <div>
              <div className={LABEL_CLASS}>
                {t('shared.folderDialog.level', isPolish ? 'Poziom' : 'Level')}
              </div>
              <p className="text-sm text-c-text-secondary">
                {levelOptions.find((o) => o.value === fixedScope)?.label}
                {fixedScopeContextLabel ? (
                  <span className="text-c-text-muted"> · {fixedScopeContextLabel}</span>
                ) : null}
              </p>
            </div>
          ) : (
            <div>
              <div className={LABEL_CLASS}>
                {t('shared.folderDialog.level', isPolish ? 'Poziom' : 'Level')}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {levelOptions.map((opt) => {
                  const Icon = opt.icon;
                  const active = scope === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setScope(opt.value);
                        if (opt.value !== 'project') setProjectId('');
                      }}
                      data-testid={`folder-create-level-${opt.value}`}
                      className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                        active
                          ? 'border-c-text bg-c-surface-raised text-c-text'
                          : 'border-c-border text-c-text-muted hover:bg-c-surface-raised hover:text-c-text'
                      }`}
                    >
                      <Icon size={16} />
                      <span className="text-[11px] font-medium leading-tight">{opt.label}</span>
                      <span className="text-[10px] leading-tight text-c-text-muted">
                        {opt.hint}
                      </span>
                    </button>
                  );
                })}
              </div>

              {scope === 'project' ? (
                <div className="mt-3">
                  <label className={LABEL_CLASS} htmlFor="folder-create-project">
                    {t('shared.folderDialog.project', isPolish ? 'Projekt' : 'Project')}
                  </label>
                  {projects.length === 0 ? (
                    <p className="text-[11px] text-c-text-muted">
                      {t(
                        'shared.folderDialog.noProjects',
                        isPolish
                          ? 'Nie należysz do żadnego projektu — folder projektowy nie jest możliwy.'
                          : 'You are not a member of any project — a project folder is not possible.'
                      )}
                    </p>
                  ) : (
                    <select
                      id="folder-create-project"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className={FIELD_CLASS}
                      data-testid="folder-create-project"
                    >
                      <option value="">
                        {t(
                          'shared.folderDialog.selectProject',
                          isPolish ? 'Wybierz projekt…' : 'Select project…'
                        )}
                      </option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {projectRequiredError ? (
                    <p className="mt-1 text-[11px] text-c-danger">
                      {t(
                        'shared.folderDialog.projectRequired',
                        isPolish ? 'Wybierz projekt' : 'Select a project'
                      )}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {errorMessage ? (
            <div
              role="alert"
              className="rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            >
              {errorMessage}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-c-border-subtle px-5 py-4">
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>
            {t('common.cancel', isPolish ? 'Anuluj' : 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="folder-create-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            <span>
              {t('shared.folderDialog.submit', isPolish ? 'Utwórz folder' : 'Create folder')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined' || !document.body) return dialog;
  return createPortal(dialog, document.body);
};

export default FolderCreateDialog;
