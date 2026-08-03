/**
 * VaultDocumentPanel — panel boczny WNĘTRZA SEJFU: „Dodaj dokument" i „Edytuj metadane".
 *
 * POWÓD ISTNIENIA (uwaga właściciela, 2026-07-24: „nadzwyczajnie tandetnie brzydkie"):
 * do tej pory formularz uploadu był WKLEJONY NA STAŁE w ekran i zajmował górne pół
 * widoku — lista dokumentów zaczynała się dopiero pod nim. Formularz to CZYNNOŚĆ,
 * nie zawartość ekranu, więc mieszka w panelu otwieranym CTA „Dodaj dokument"
 * (doktryna gęstości §2 — zero pół-pustych połaci na ekranie roboczym).
 *
 * Zachowana CAŁA funkcjonalność starego formularza (drag&drop, Kategoria, Tagi,
 * Poziom, Projekt) — z tą różnicą, że wewnątrz sejfu Poziom i Projekt są już
 * ZDETERMINOWANE przez sejf, więc pokazujemy je jako KONTEKST (read-only), nie
 * jako pytanie. Tryb 'edit' dokłada zmianę poziomu z dry-runem `scope-impact`
 * (VLT-002/003) — jedyna droga, żeby wyjąć własny prywatny dokument z sejfu.
 *
 * Kanon: zero własnych tabel/menu/preview. Powierzchnia panelu = `ui/sheet`
 * (istniejący komponent aplikacji), kolory = tokeny `c-*`, fokus = `c-focus`,
 * CTA neutralne (navy/inwers), NIGDY crimson (`primary-*`).
 */

import {
  FileText,
  FolderKanban,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';
import { Sheet, SheetContent } from '@/components/ui/sheet';

import { Api } from '../../services/api';
import {
  DOCUMENT_CATEGORIES,
  getUploadedDocumentInfo,
  SCOPE_OPTIONS,
  scopeLabel,
  type VaultDocument,
  type VaultProject,
  type VaultScope,
} from './vaultDocuments';

const ACCEPTED = '.pdf,.txt,.md,.csv,.docx,.xlsx,.xls,.pptx';

// ★ MW-10 — kształt jednej wersji, tak jak wystawia `GET .../documents/:id/versions`
// (`serializeVersion` w `knowledge.routes.ts`).
interface DocumentVersionEntry {
  versionId: string;
  documentId: string;
  versionNumber: number;
  filename: string;
  fileSizeBytes: number | null;
  contentHash: string | null;
  chunkCount: number;
  origin: 'upload' | 'edit' | 'restore';
  restoredFromVersion: number | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string | null;
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

export interface VaultDocumentPanelProps {
  open: boolean;
  mode: 'add' | 'edit';
  /** Sejf, w którym stoimy — determinuje poziom i projekt nowego dokumentu. */
  safeName: string;
  safeScope: VaultScope;
  safeProjectId?: string | null;
  /** Dokument edytowany (mode='edit'). */
  document?: VaultDocument | null;
  /** Czy wolno zmienić poziom TEGO dokumentu (mirror backendu: własny prywatny). */
  canChangeScope?: boolean;
  /** Projekty, w których użytkownik jest członkiem (do zmiany poziomu na „Projekt"). */
  projects: VaultProject[];
  onClose: () => void;
  /** Wywoływane po udanym zapisie — ekran przeładowuje listę. */
  onSaved: () => void;
}

export const VaultDocumentPanel: React.FC<VaultDocumentPanelProps> = ({
  open,
  mode,
  safeName,
  safeScope,
  safeProjectId,
  document: editedDocument,
  canChangeScope = false,
  projects,
  onClose,
  onSaved,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Zmiana poziomu (tryb edit) — dwa kroki: dry-run wpływu → potwierdzenie.
  const [nextScope, setNextScope] = useState<VaultScope>('organization');
  const [nextProjectId, setNextProjectId] = useState('');
  const [impact, setImpact] = useState<{ checking: boolean; count: number | null }>({
    checking: false,
    count: null,
  });

  // ★ MW-10 — historia wersji (tryb edit). `currentVersion` to token CAS wysyłany
  // z każdym zapisem nowej treści/restore — patrz `handleUploadVersion`/`handleRestore`.
  const [versions, setVersions] = useState<DocumentVersionEntry[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const versionFileInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadVersions = useCallback(async () => {
    if (!editedDocument) return;
    setVersionsLoading(true);
    try {
      const res = await Api.getKnowledgeDocumentVersions(editedDocument.id);
      setVersions(Array.isArray(res.versions) ? res.versions : []);
      setCurrentVersion(
        Number.isFinite(Number(res.currentVersion)) ? Number(res.currentVersion) : null
      );
    } catch (err: unknown) {
      // Historia jest informacyjna — brak jej nie blokuje edycji metadanych.
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }, [editedDocument]);

  // Reset przy każdym otwarciu — panel nigdy nie wstaje z resztkami poprzedniej sesji.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setDragging(false);
    setImpact({ checking: false, count: null });
    if (mode === 'add') {
      setFile(null);
      setCategory('');
      setTags('');
      setVersions([]);
      setCurrentVersion(null);
    } else {
      setFile(null);
      setCategory(editedDocument?.category || '');
      setTags(editedDocument?.tags?.join(', ') || '');
      setNextScope(editedDocument?.scope || 'organization');
      setNextProjectId(editedDocument?.project_id || '');
      setNewVersionFile(null);
      setRestoringVersion(null);
      void loadVersions();
    }
  }, [open, mode, editedDocument, loadVersions]);

  // Kanon B.42 — Esc zamyka najbardziej lokalną warstwę (tu: panel).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Fokus na pierwszym polu po otwarciu (a11y — fokus nie zostaje pod spodem).
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    }, 20);
    return () => window.clearTimeout(id);
  }, [open]);

  const projectName = useMemo(
    () => projects.find((p) => p.id === safeProjectId)?.name || safeName,
    [projects, safeProjectId, safeName]
  );

  const handleFiles = useCallback((list: FileList | null) => {
    const picked = list && list.length > 0 ? list[0] : null;
    if (picked) {
      setFile(picked);
      setError(null);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const tagsArray = tags
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      const result = await Api.uploadKnowledgeDocument(
        file,
        category || undefined,
        tagsArray.length > 0 ? tagsArray : undefined,
        safeScope,
        safeScope === 'project' ? safeProjectId || undefined : undefined
      );
      const uploaded = getUploadedDocumentInfo(result);
      toast.success(
        t('vault.docs.uploaded', {
          defaultValue: isPolish
            ? `Dodano i zindeksowano ({{count}} fragmentów)`
            : `Uploaded & indexed ({{count}} chunks)`,
          count: uploaded.chunkCount,
        })
      );
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t('vault.docs.uploadFailed', isPolish ? 'Nie udało się dodać pliku' : 'Upload failed');
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [file, tags, category, safeScope, safeProjectId, onSaved, onClose, t, isPolish]);

  const handleSaveMetadata = useCallback(async () => {
    if (!editedDocument) return;
    setBusy(true);
    setError(null);
    try {
      const tagsArray = tags
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      await Api.updateKnowledgeDocument(editedDocument.id, {
        category: category || undefined,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
      });
      toast.success(t('vault.docs.updated', isPolish ? 'Zapisano metadane' : 'Metadata saved'));
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t('vault.docs.updateFailed', isPolish ? 'Nie udało się zapisać' : 'Update failed');
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [editedDocument, tags, category, onSaved, onClose, t, isPolish]);

  // ★ MW-10 — nowa treść = kolejna, niezmienna wersja. `currentVersion` (token
  // CAS) idzie w każdym zapisie; 409 = ktoś inny zapisał w międzyczasie, więc
  // odświeżamy historię i pokazujemy komunikat zamiast cicho nadpisać.
  const handleUploadVersion = useCallback(async () => {
    if (!editedDocument || !newVersionFile || currentVersion === null) return;
    setBusy(true);
    setError(null);
    try {
      await Api.uploadKnowledgeDocumentVersion(editedDocument.id, newVersionFile, currentVersion);
      toast.success(
        t('vault.docs.versionSaved', isPolish ? 'Zapisano nową wersję' : 'New version saved')
      );
      setNewVersionFile(null);
      await loadVersions();
      onSaved();
    } catch (err: any) {
      if (err?.code === 'VAULT_VERSION_CONFLICT') {
        setError(
          t(
            'vault.docs.versionConflict',
            isPolish
              ? 'Dokument zmienił się w międzyczasie — historia odświeżona, spróbuj ponownie.'
              : 'The document changed in the meantime — history refreshed, try again.'
          )
        );
        await loadVersions();
      } else {
        setError(
          err instanceof Error
            ? err.message
            : t(
                'vault.docs.versionFailed',
                isPolish ? 'Nie udało się zapisać wersji' : 'Failed to save version'
              )
        );
      }
    } finally {
      setBusy(false);
    }
  }, [editedDocument, newVersionFile, currentVersion, loadVersions, onSaved, t, isPolish]);

  // ★ MW-10 — restore NIE nadpisuje historii: tworzy kolejną wersję z
  // `restoredFromVersion` (provenance). Ten sam token CAS chroni przed
  // wyścigiem z równoległym edit/restore.
  const handleRestore = useCallback(
    async (versionNumber: number) => {
      if (!editedDocument || currentVersion === null) return;
      setRestoringVersion(versionNumber);
      setError(null);
      try {
        await Api.restoreKnowledgeDocumentVersion(editedDocument.id, versionNumber, currentVersion);
        toast.success(
          t('vault.docs.versionRestored', {
            defaultValue: isPolish ? 'Przywrócono wersję {{v}}' : 'Restored version {{v}}',
            v: versionNumber,
          })
        );
        await loadVersions();
        onSaved();
      } catch (err: any) {
        if (err?.code === 'VAULT_VERSION_CONFLICT') {
          setError(
            t(
              'vault.docs.versionConflict',
              isPolish
                ? 'Dokument zmienił się w międzyczasie — historia odświeżona, spróbuj ponownie.'
                : 'The document changed in the meantime — history refreshed, try again.'
            )
          );
          await loadVersions();
        } else {
          setError(
            err instanceof Error
              ? err.message
              : t(
                  'vault.docs.restoreFailed',
                  isPolish ? 'Nie udało się przywrócić wersji' : 'Failed to restore version'
                )
          );
        }
      } finally {
        setRestoringVersion(null);
      }
    },
    [editedDocument, currentVersion, loadVersions, onSaved, t, isPolish]
  );

  // VLT-002/003 — krok 1/2: dry-run „ile dokumentów zobaczy cała organizacja".
  const requestScopeChange = useCallback(
    async (scope: VaultScope, projectId: string) => {
      if (!editedDocument) return;
      setNextScope(scope);
      if (scope === editedDocument.scope && scope !== 'project') {
        setImpact({ checking: false, count: null });
        return;
      }
      if (scope === 'project' && !projectId) {
        setImpact({ checking: false, count: null });
        return;
      }
      setImpact({ checking: true, count: null });
      try {
        const res = await Api.getKnowledgeDocumentScopeImpact(editedDocument.id, scope);
        setImpact({ checking: false, count: res.becameOrgVisibleCount });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to check scope impact');
        setImpact({ checking: false, count: null });
      }
    },
    [editedDocument]
  );

  // VLT-002/003 — krok 2/2: dopiero PO potwierdzeniu leci PATCH .../scope.
  const confirmScopeChange = useCallback(async () => {
    if (!editedDocument) return;
    if (nextScope === 'project' && !nextProjectId) {
      setError(
        t(
          'vault.docs.pickProject',
          isPolish ? 'Wybierz projekt dla poziomu „Projekt”' : 'Select a project'
        )
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await Api.updateKnowledgeDocumentScope(
        editedDocument.id,
        nextScope,
        nextScope === 'project' ? nextProjectId : undefined
      );
      toast.success(t('vault.docs.levelUpdated', isPolish ? 'Zmieniono poziom' : 'Level updated'));
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update document scope');
    } finally {
      setBusy(false);
    }
  }, [editedDocument, nextScope, nextProjectId, onSaved, onClose, t, isPolish]);

  if (!open) return null;

  const title =
    mode === 'add'
      ? t('vault.docs.addTitle', isPolish ? 'Dodaj dokument' : 'Add document')
      : t('vault.docs.editTitle', isPolish ? 'Edytuj metadane' : 'Edit metadata');

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent side="right" aria-label={title} className="border-c-border bg-c-bg p-0">
        <div ref={panelRef} className="flex h-full flex-col">
          {/* Nagłówek panelu */}
          <div className="flex items-center justify-between gap-3 border-b border-c-border-subtle px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-c-text">{title}</h2>
              <p className="mt-0.5 truncate text-[11px] text-c-text-muted">
                {t('vault.docs.inSafe', isPolish ? 'Sejf' : 'Safe')}: {safeName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close', isPolish ? 'Zamknij' : 'Close')}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-c-text-muted transition-colors hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <X size={16} />
            </button>
          </div>

          {/* Treść */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[13px] text-c-danger"
              >
                {error}
              </div>
            ) : null}

            {mode === 'add' ? (
              <div>
                <span className={LABEL_CLASS}>
                  {t('vault.docs.file', isPolish ? 'Plik' : 'File')}
                </span>
                {/* Strefa upuszczania — klikalna i osiągalna klawiaturą (B.41). */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    handleFiles(e.dataTransfer?.files ?? null);
                  }}
                  data-testid="vault-dropzone"
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-7 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                    dragging
                      ? 'border-c-border-strong bg-c-surface-raised'
                      : 'border-c-border bg-c-surface hover:bg-c-surface-raised'
                  }`}
                >
                  {file ? (
                    <>
                      <FileText size={20} className="text-c-text-secondary" />
                      <span className="max-w-full truncate text-sm font-medium text-c-text">
                        {file.name}
                      </span>
                      <span className="text-[11px] text-c-text-muted">
                        {t(
                          'vault.docs.replaceHint',
                          isPolish ? 'Kliknij, aby zmienić' : 'Click to replace'
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload size={20} className="text-c-text-muted" />
                      <span className="text-sm text-c-text-secondary">
                        {t(
                          'vault.docs.dropHint',
                          isPolish
                            ? 'Przeciągnij plik albo kliknij, aby wybrać'
                            : 'Drag a file here or click to select'
                        )}
                      </span>
                      <span className="text-[11px] text-c-text-muted">
                        PDF · DOCX · XLSX · PPTX · TXT · MD · CSV
                      </span>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED}
                  className="sr-only"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>
            ) : null}

            <div>
              <label className={LABEL_CLASS} htmlFor="vault-doc-category">
                {t('vault.docs.category', isPolish ? 'Kategoria' : 'Category')}
              </label>
              <select
                id="vault-doc-category"
                data-testid="vault-panel-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">
                  {t('vault.docs.noCategory', isPolish ? 'Bez kategorii' : 'No category')}
                </option>
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="vault-doc-tags">
                {t('vault.docs.tags', isPolish ? 'Tagi (po przecinku)' : 'Tags (comma-separated)')}
              </label>
              <input
                id="vault-doc-tags"
                data-testid="vault-panel-tags"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={
                  isPolish ? 'np. rynek, 2026, benchmark' : 'e.g. market, 2026, benchmark'
                }
                className={FIELD_CLASS}
              />
            </div>

            {/* KONTEKST — poziom/projekt są ustalone przez sejf, więc to informacja,
                nie pytanie (uwaga właściciela: „nie pytaj o to, co już wiadomo"). */}
            {mode === 'add' ? (
              <div className="rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {t('vault.docs.destination', isPolish ? 'Trafi do' : 'Destination')}
                </div>
                <dl className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[13px] text-c-text-muted">
                      {t('vault.docs.level', isPolish ? 'Poziom' : 'Level')}
                    </dt>
                    <dd className="truncate text-[13px] font-medium text-c-text">
                      {scopeLabel(safeScope, isPolish)}
                    </dd>
                  </div>
                  {safeScope === 'project' ? (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[13px] text-c-text-muted">
                        {t('vault.docs.project', isPolish ? 'Projekt' : 'Project')}
                      </dt>
                      <dd className="inline-flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium text-c-text">
                        <FolderKanban size={13} className="shrink-0 text-c-text-muted" />
                        {projectName}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <p className="mt-2.5 text-[11px] leading-4 text-c-text-muted">
                  {t(
                    'vault.docs.indexHint',
                    isPolish
                      ? 'Plik zostanie podzielony na fragmenty i zindeksowany do wyszukiwania przez AI.'
                      : 'The file is chunked, embedded and indexed for AI retrieval.'
                  )}
                </p>
              </div>
            ) : null}

            {/* ★ MW-10 — Wersje: historia + wgraj nową treść + przywróć. Widoczne
                tylko gdy wołający ma prawo edycji (backend i tak odrzuci 403,
                to tylko unika pokazywania martwych przycisków). */}
            {mode === 'edit' && editedDocument ? (
              <div className="rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                  <History size={12} />
                  {t('vault.docs.versions', isPolish ? 'Wersje' : 'Versions')}
                </div>

                {canChangeScope ? (
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="vault-panel-new-version-pick"
                      onClick={() => versionFileInputRef.current?.click()}
                      className={`${GHOST_BUTTON_CLASS} h-8 px-3 text-[12px]`}
                    >
                      <Upload size={13} />
                      {newVersionFile
                        ? newVersionFile.name
                        : t(
                            'vault.docs.newVersionPick',
                            isPolish ? 'Wybierz nowy plik…' : 'Choose new file…'
                          )}
                    </button>
                    <input
                      ref={versionFileInputRef}
                      type="file"
                      accept={ACCEPTED}
                      className="sr-only"
                      onChange={(e) => {
                        const picked = e.target.files?.[0] || null;
                        setNewVersionFile(picked);
                        setError(null);
                      }}
                    />
                    {newVersionFile ? (
                      <button
                        type="button"
                        data-testid="vault-panel-new-version-submit"
                        disabled={busy || currentVersion === null}
                        onClick={() => void handleUploadVersion()}
                        className={`${MENU_1_PRIMARY_CTA} h-8 px-3 text-[12px] disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {busy ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          t(
                            'vault.docs.newVersionSave',
                            isPolish ? 'Zapisz wersję' : 'Save version'
                          )
                        )}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <ul className="mt-3 space-y-1.5" data-testid="vault-panel-version-list">
                  {versionsLoading ? (
                    <li className="text-[12px] text-c-text-muted">
                      {t('vault.docs.versionsLoading', isPolish ? 'Wczytuję…' : 'Loading…')}
                    </li>
                  ) : versions.length === 0 ? (
                    <li className="text-[12px] text-c-text-muted">
                      {t('vault.docs.versionsEmpty', isPolish ? 'Brak historii' : 'No history yet')}
                    </li>
                  ) : (
                    versions.map((v) => {
                      const isCurrent = v.versionNumber === currentVersion;
                      const originLabel = isPolish
                        ? v.origin === 'upload'
                          ? 'Wgrano'
                          : v.origin === 'restore'
                            ? `Przywrócono z v${v.restoredFromVersion ?? '—'}`
                            : 'Edytowano'
                        : v.origin === 'upload'
                          ? 'Uploaded'
                          : v.origin === 'restore'
                            ? `Restored from v${v.restoredFromVersion ?? '—'}`
                            : 'Edited';
                      return (
                        <li
                          key={v.versionId}
                          data-testid={`vault-panel-version-row-${v.versionNumber}`}
                          data-version-number={v.versionNumber}
                          className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[12px] ${
                            isCurrent ? 'bg-c-surface-raised' : ''
                          }`}
                        >
                          <span className="min-w-0 truncate">
                            <span className="font-medium text-c-text">v{v.versionNumber}</span>
                            {isCurrent ? (
                              <span className="ml-1.5 text-[10px] uppercase text-c-text-muted">
                                {t('vault.docs.current', isPolish ? 'aktualna' : 'current')}
                              </span>
                            ) : null}
                            <span className="ml-2 text-c-text-muted">{originLabel}</span>
                          </span>
                          {!isCurrent && canChangeScope ? (
                            <button
                              type="button"
                              data-testid={`vault-panel-version-restore-${v.versionNumber}`}
                              disabled={restoringVersion !== null || currentVersion === null}
                              onClick={() => void handleRestore(v.versionNumber)}
                              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-c-border px-2 text-[11px] text-c-text-secondary transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {restoringVersion === v.versionNumber ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <RotateCcw size={12} />
                              )}
                              {t('vault.docs.restore', isPolish ? 'Przywróć' : 'Restore')}
                            </button>
                          ) : null}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            ) : null}

            {/* Zmiana poziomu — tylko własny prywatny dokument (mirror backendu). */}
            {mode === 'edit' && editedDocument ? (
              <div className="rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {t('vault.docs.level', isPolish ? 'Poziom' : 'Level')}
                </div>
                {canChangeScope ? (
                  <div className="mt-2 space-y-2">
                    <select
                      data-testid="vault-panel-scope"
                      value={nextScope}
                      onChange={(e) =>
                        void requestScopeChange(e.target.value as VaultScope, nextProjectId)
                      }
                      className={FIELD_CLASS}
                    >
                      {SCOPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {isPolish ? opt.labelPl : opt.labelEn}
                        </option>
                      ))}
                    </select>
                    {nextScope === 'project' ? (
                      <select
                        data-testid="vault-panel-scope-project"
                        value={nextProjectId}
                        onChange={(e) => {
                          setNextProjectId(e.target.value);
                          if (e.target.value) void requestScopeChange('project', e.target.value);
                        }}
                        className={FIELD_CLASS}
                      >
                        <option value="">
                          {t(
                            'vault.docs.pickProjectOption',
                            isPolish ? 'Wybierz projekt…' : 'Select project…'
                          )}
                        </option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {impact.checking ? (
                      <p className="text-[11px] text-c-text-muted">
                        {t(
                          'vault.docs.checkingImpact',
                          isPolish ? 'Sprawdzam skutek…' : 'Checking impact…'
                        )}
                      </p>
                    ) : null}
                    {!impact.checking &&
                    impact.count !== null &&
                    nextScope !== editedDocument.scope ? (
                      <div
                        role="alert"
                        className="rounded-lg border border-c-warning/30 bg-c-warning/10 px-3 py-2.5 text-[12px] text-c-text"
                      >
                        <p>
                          {impact.count > 0
                            ? t('vault.docs.impactSome', {
                                defaultValue: isPolish
                                  ? 'Po zmianie {{count}} dokument(y) zobaczy cała organizacja.'
                                  : '{{count}} document(s) will become visible to the whole organization.',
                                count: impact.count,
                              })
                            : t(
                                'vault.docs.impactNone',
                                isPolish
                                  ? 'Ta zmiana nikomu nie odsłania nowych dokumentów.'
                                  : 'This change does not expose any document.'
                              )}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            data-testid="vault-panel-scope-confirm"
                            onClick={() => void confirmScopeChange()}
                            disabled={busy}
                            className={`${GHOST_BUTTON_CLASS} h-8 px-3 text-[12px] disabled:opacity-50`}
                          >
                            {t(
                              'vault.docs.confirmLevel',
                              isPolish ? 'Potwierdź zmianę' : 'Confirm change'
                            )}
                          </button>
                          <button
                            type="button"
                            data-testid="vault-panel-scope-cancel"
                            onClick={() => {
                              setNextScope(editedDocument.scope);
                              setNextProjectId(editedDocument.project_id || '');
                              setImpact({ checking: false, count: null });
                            }}
                            className={`${GHOST_BUTTON_CLASS} h-8 px-3 text-[12px]`}
                          >
                            {t('common.cancel', isPolish ? 'Anuluj' : 'Cancel')}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-1.5 text-[13px] text-c-text-secondary">
                    {scopeLabel(editedDocument.scope, isPolish)}
                    <span className="ml-2 text-[11px] text-c-text-muted">
                      {t(
                        'vault.docs.levelLocked',
                        isPolish
                          ? '— poziom zmienia właściciel dokumentu'
                          : '— only the document owner can change the level'
                      )}
                    </span>
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {/* Stopka — jedno CTA + Anuluj */}
          <div className="flex items-center justify-end gap-2 border-t border-c-border-subtle px-5 py-4">
            <button type="button" onClick={onClose} className={GHOST_BUTTON_CLASS}>
              {t('common.cancel', isPolish ? 'Anuluj' : 'Cancel')}
            </button>
            <button
              type="button"
              data-testid="vault-panel-submit"
              disabled={busy || (mode === 'add' && !file)}
              onClick={() => void (mode === 'add' ? handleUpload() : handleSaveMetadata())}
              className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : mode === 'add' ? (
                <Plus size={16} />
              ) : (
                <Save size={16} />
              )}
              <span>
                {mode === 'add'
                  ? busy
                    ? t('vault.docs.indexing', isPolish ? 'Indeksuję…' : 'Indexing…')
                    : t('vault.docs.addSubmit', isPolish ? 'Dodaj i zindeksuj' : 'Add & index')
                  : t('common.save', isPolish ? 'Zapisz' : 'Save')}
              </span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default VaultDocumentPanel;
