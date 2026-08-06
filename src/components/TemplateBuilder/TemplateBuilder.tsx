/**
 * TemplateBuilder — kontener wspólnej powłoki builderów (#83c/#83d).
 *
 * Trzyma stan draftu, wylicza spis struktury PER TYP i podmienia centrum
 * (doc/deck/table) — powłoka i raile pozostają wspólne. Zapis → fasada.
 *
 * `TemplateBuilderFlow` niżej spina wizard START + builder pod realną app.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  approveTemplate as approveWorkbookTemplate,
  deprecateTemplate as deprecateWorkbookTemplate,
  getTemplate as getWorkbookLifecycle,
  type LifecycleTemplate,
} from '@/services/api/templateLifecycle.api';

import {
  deleteTemplate,
  loadTemplate,
  recordToDraft,
  saveTemplate,
  updateTemplate,
} from './templateBuilderApi';
import {
  type DeckSlide,
  DOC_BLOCK_LABELS,
  type DocSection,
  emptyDraft,
  newDeckSlide,
  newDocSection,
  newWorkbookSheet,
  SLIDE_ARCHETYPE_LABELS,
  type TemplateDraft,
  type TemplateScope,
  type TemplateType,
  validateTemplateDraft,
  type WorkbookTemplateSheet,
} from './templateBuilderModel';
import { TemplateBuilderShell } from './TemplateBuilderShell';
import { DeckSlideEditor, DocSectionEditor, WorkbookSheetEditor } from './TemplateCenterEditors';
import { TemplateCreateWizard } from './TemplateCreateWizard';
import type { TemplateRightTool, ThemeOption } from './TemplateRightPanel';
import type { StructureListItem } from './TemplateStructureList';

/** Przykładowe motywy org — w realu z themeRegistry/brandIngestion (front do zrobienia w T3). */
export const DEMO_THEME_OPTIONS: ThemeOption[] = [
  { value: 'brand-dbr77', label: 'DBR77 (firmowy)' },
  { value: 'brand-mono', label: 'Monochrom' },
  { value: 'brand-navy', label: 'Navy Executive' },
];

export interface TemplateBuilderProps {
  initialDraft: TemplateDraft;
  themeOptions?: ThemeOption[];
  onSaved?: (id: string) => void;
  onClose?: () => void;
  /** wstrzyknięcie zapisu (dev-render / testy). Domyślnie żywa fasada. */
  saveFn?: (draft: TemplateDraft) => Promise<{ id: string }>;
  persistRailState?: boolean;
  /** Canonical id switches Save from create to persisted update. */
  templateId?: string;
}

export const TemplateBuilder: React.FC<TemplateBuilderProps> = ({
  initialDraft,
  themeOptions = DEMO_THEME_OPTIONS,
  onSaved,
  onClose,
  saveFn = saveTemplate,
  persistRailState = true,
  templateId,
}) => {
  const [builderState, setBuilderState] = useState(() => ({
    draft: initialDraft,
    selectedId: firstElementId(initialDraft),
  }));
  const { draft, selectedId } = builderState;
  const setDraft = useCallback((update: React.SetStateAction<TemplateDraft>) => {
    setBuilderState((current) => ({
      ...current,
      draft: typeof update === 'function' ? update(current.draft) : update,
    }));
  }, []);
  const setSelectedId = useCallback((update: React.SetStateAction<string | null>) => {
    setBuilderState((current) => ({
      ...current,
      selectedId: typeof update === 'function' ? update(current.selectedId) : update,
    }));
  }, []);
  const [activeRightTool, setActiveRightTool] = useState<TemplateRightTool | null>('properties');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lifecycle, setLifecycle] = useState<LifecycleTemplate | null>(null);

  const refreshLifecycle = useCallback(async () => {
    if (!templateId || draft.type !== 'table') return;
    try {
      setLifecycle(await getWorkbookLifecycle(templateId));
    } catch {
      setLifecycle(null);
    }
  }, [templateId, draft.type]);

  useEffect(() => {
    void refreshLifecycle();
  }, [refreshLifecycle]);

  const patchDraft = useCallback((patch: Partial<TemplateDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  // ── Spis struktury per typ ────────────────────────────────────────────────
  const structureItems: StructureListItem[] = useMemo(() => {
    if (draft.type === 'doc')
      return draft.doc.map((s, i) => ({
        id: s.id,
        label: s.title || 'Bez tytułu',
        meta: DOC_BLOCK_LABELS[s.block],
        index: i + 1,
      }));
    if (draft.type === 'deck')
      return draft.deck.map((s, i) => ({
        id: s.id,
        label: s.title || 'Bez tytułu',
        meta: SLIDE_ARCHETYPE_LABELS[s.archetype],
        index: i + 1,
      }));
    return draft.table.map((sheet, i) => ({
      id: sheet.id,
      label: sheet.name || 'Bez nazwy',
      meta: `${sheet.columns.length} kolumn`,
      index: i + 1,
    }));
  }, [draft]);

  const addLabel =
    draft.type === 'doc' ? 'Dodaj sekcję' : draft.type === 'deck' ? 'Dodaj slajd' : 'Dodaj arkusz';

  // ── Mutacje listy ─────────────────────────────────────────────────────────
  const handleAdd = useCallback(() => {
    if (draft.type === 'doc') {
      const element = newDocSection();
      setBuilderState((current) => ({
        draft: { ...current.draft, doc: [...current.draft.doc, element] },
        selectedId: element.id,
      }));
      return;
    }
    if (draft.type === 'deck') {
      const element = newDeckSlide();
      setBuilderState((current) => ({
        draft: { ...current.draft, deck: [...current.draft.deck, element] },
        selectedId: element.id,
      }));
      return;
    }
    const element = newWorkbookSheet(`Arkusz ${draft.table.length + 1}`);
    setBuilderState((current) => ({
      draft: { ...current.draft, table: [...current.draft.table, element] },
      selectedId: element.id,
    }));
  }, [draft.type, draft.table.length]);

  const handleMove = useCallback((id: string, dir: -1 | 1) => {
    setDraft((d) => {
      const key = d.type;
      const arr = [...(d[key] as { id: string }[])];
      const idx = arr.findIndex((e) => e.id === id);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= arr.length) return d;
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return { ...d, [key]: arr } as TemplateDraft;
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    setDraft((d) => {
      const key = d.type;
      const arr = (d[key] as { id: string }[]).filter((e) => e.id !== id);
      if (arr.length === 0) return d; // zawsze ≥1 element
      setSelectedId((cur) => (cur === id ? arr[0].id : cur));
      return { ...d, [key]: arr } as TemplateDraft;
    });
  }, []);

  // ── Centrum per typ ───────────────────────────────────────────────────────
  const centerEditor = useMemo(() => {
    if (draft.type === 'doc') {
      const sel = (draft.doc.find((s) => s.id === selectedId) ?? null) as DocSection | null;
      return (
        <DocSectionEditor
          section={sel}
          onChange={(patch) =>
            setDraft((d) => ({
              ...d,
              doc: d.doc.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)),
            }))
          }
        />
      );
    }
    if (draft.type === 'deck') {
      const sel = (draft.deck.find((s) => s.id === selectedId) ?? null) as DeckSlide | null;
      return (
        <DeckSlideEditor
          slide={sel}
          onChange={(patch) =>
            setDraft((d) => ({
              ...d,
              deck: d.deck.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)),
            }))
          }
        />
      );
    }
    const sel = (draft.table.find((sheet) => sheet.id === selectedId) ??
      null) as WorkbookTemplateSheet | null;
    return (
      <WorkbookSheetEditor
        sheet={sel}
        onChange={(nextSheet) =>
          setDraft((d) => ({
            ...d,
            table: d.table.map((sheet) => (sheet.id === selectedId ? nextSheet : sheet)),
          }))
        }
      />
    );
  }, [draft, selectedId]);

  // ── Zapis ─────────────────────────────────────────────────────────────────
  const validation = useMemo(() => validateTemplateDraft(draft), [draft]);
  const canSave = validation.valid;
  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = templateId ? await updateTemplate(templateId, draft) : await saveFn(draft);
      onSaved?.(res.id);
      setNotice(templateId ? 'Zmiany zapisane w wersji roboczej.' : 'Szablon zapisany jako draft.');
      await refreshLifecycle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zapis nie powiódł się');
    } finally {
      setSaving(false);
    }
  }, [canSave, saving, saveFn, draft, onSaved, templateId, refreshLifecycle]);

  const handleApprove = useCallback(async () => {
    if (!templateId || !validation.valid) return;
    try {
      setError(null);
      setLifecycle(
        await approveWorkbookTemplate(templateId, 'Approved in manual template builder')
      );
      setNotice('Szablon został zatwierdzony i jest gotowy do użycia.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publikacja nie powiodła się');
    }
  }, [templateId, validation.valid]);

  const handleDeprecate = useCallback(async () => {
    if (!templateId) return;
    try {
      setError(null);
      setLifecycle(
        await deprecateWorkbookTemplate(templateId, 'Deprecated in manual template builder')
      );
      setNotice('Szablon wycofano. Historia i wersje zostały zachowane.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wycofanie nie powiodło się');
    }
  }, [templateId]);

  const handleDeleteTemplate = useCallback(async () => {
    if (!templateId || lifecycle?.status === 'approved') return;
    if (!window.confirm('Usunąć ten draft szablonu? Tej operacji nie można cofnąć.')) return;
    try {
      setError(null);
      await deleteTemplate(templateId);
      onClose?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Usunięcie nie powiodło się');
    }
  }, [templateId, lifecycle?.status, onClose]);

  return (
    <>
      {error && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 z-toast rounded-lg border border-c-danger bg-c-danger/10 px-4 py-2 text-sm text-c-danger"
          role="alert"
        >
          {error}
        </div>
      )}
      {notice && !error && (
        <div
          role="status"
          className="absolute top-2 left-1/2 -translate-x-1/2 z-toast rounded-lg border border-c-success/30 bg-c-success/10 px-4 py-2 text-sm text-c-success"
        >
          {notice}
        </div>
      )}
      <TemplateBuilderShell
        draft={draft}
        onDraftChange={patchDraft}
        structureItems={structureItems}
        addLabel={addLabel}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={handleAdd}
        onMove={handleMove}
        onDelete={handleDelete}
        centerEditor={centerEditor}
        themeOptions={themeOptions}
        activeRightTool={activeRightTool}
        onActiveRightToolChange={setActiveRightTool}
        onSave={handleSave}
        saving={saving}
        canSave={canSave}
        saveLabel={templateId ? 'Zapisz zmiany' : 'Zapisz jako szablon'}
        validationErrors={validation.errors}
        lifecycle={
          templateId && draft.type === 'table'
            ? {
                status: lifecycle?.status ?? 'draft',
                version: lifecycle?.version ?? 'v0.1',
                historyCount: lifecycle?.approval_history.length ?? 0,
                onValidate: () =>
                  setNotice(
                    validation.valid
                      ? 'Walidacja zakończona: szablon jest gotowy do publikacji.'
                      : validation.errors.join(' ')
                  ),
                onApprove: lifecycle?.status === 'approved' ? undefined : handleApprove,
                onDeprecate: lifecycle?.status === 'approved' ? handleDeprecate : undefined,
                onDelete: lifecycle?.status === 'draft' ? handleDeleteTemplate : undefined,
              }
            : undefined
        }
        onBack={onClose}
        persistRailState={persistRailState}
      />
    </>
  );
};

function firstElementId(d: TemplateDraft): string | null {
  if (d.type === 'doc') return d.doc[0]?.id ?? null;
  if (d.type === 'deck') return d.deck[0]?.id ?? null;
  return d.table[0]?.id ?? null;
}

// ── Flow: wizard START + builder ───────────────────────────────────────────

export interface TemplateBuilderFlowProps {
  initialType?: TemplateType;
  themeOptions?: ThemeOption[];
  onSaved?: (id: string) => void;
  onClose?: () => void;
  saveFn?: (draft: TemplateDraft) => Promise<{ id: string }>;
}

/**
 * Pełny flow #83c: modal START → builder. Reużywalny wszędzie, gdzie user
 * tworzy szablon (Materials▸Template Library „Nowy", buildery „zapisz jako").
 */
export const TemplateBuilderFlow: React.FC<TemplateBuilderFlowProps> = ({
  initialType,
  themeOptions,
  onSaved,
  onClose,
  saveFn,
}) => {
  const [draft, setDraft] = useState<TemplateDraft | null>(null);

  if (!draft) {
    return (
      <TemplateCreateWizard
        open
        initialType={initialType}
        onCancel={() => onClose?.()}
        onComplete={({
          name,
          type,
          scope,
        }: {
          name: string;
          type: TemplateType;
          scope: TemplateScope;
        }) => setDraft(emptyDraft(type, name, scope))}
      />
    );
  }

  return (
    <TemplateBuilder
      initialDraft={draft}
      themeOptions={themeOptions}
      saveFn={saveFn}
      onSaved={onSaved}
      onClose={() => {
        setDraft(null);
        onClose?.();
      }}
    />
  );
};

export default TemplateBuilder;

export interface PersistedTemplateBuilderProps extends Omit<
  TemplateBuilderProps,
  'initialDraft' | 'templateId' | 'saveFn'
> {
  templateId: string;
}

/** Opens the canonical persisted record instead of relying on an in-memory draft. */
export const PersistedTemplateBuilder: React.FC<PersistedTemplateBuilderProps> = ({
  templateId,
  ...props
}) => {
  const [state, setState] = useState<{ draft: TemplateDraft | null; error: string | null }>({
    draft: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    setState({ draft: null, error: null });
    loadTemplate(templateId)
      .then((record) => active && setState({ draft: recordToDraft(record), error: null }))
      .catch(
        (error) =>
          active &&
          setState({
            draft: null,
            error: error instanceof Error ? error.message : 'Nie udało się otworzyć szablonu',
          })
      );
    return () => {
      active = false;
    };
  }, [templateId]);

  if (state.error)
    return (
      <div role="alert" className="p-6 text-sm text-c-danger">
        {state.error}
      </div>
    );
  if (!state.draft)
    return (
      <div role="status" className="p-6 text-sm text-c-muted">
        Otwieranie szablonu…
      </div>
    );
  return <TemplateBuilder {...props} initialDraft={state.draft} templateId={templateId} />;
};
