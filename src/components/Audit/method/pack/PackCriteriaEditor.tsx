/**
 * PackCriteriaEditor — OP-2b (Wpis 99, wiersz planu 65 / U-27): tryb edycji
 * listy kryteriów na ekranie obiektu pakietu audytowego.
 *
 * Kontrakt zapisu jest ZMIERZONY z serwera (`packs.routes.ts:155-173` +
 * `packService.replaceCriteria:693`), nie zaprojektowany tu:
 *  - `PUT /audits/packs/:id/criteria` to REPLACE całego drzewa w jednej
 *    transakcji (DELETE + INSERT), więc payload musi nieść KAŻDE kryterium,
 *    także te nietknięte przez użytkownika;
 *  - pola spoza formularza (`sourceReference`, `auditQuestion`,
 *    `expectedEvidence`, `auditProcedure`, `samplingGuidance`,
 *    `applicabilityRule`, `suggestedOwnerRole`) są przepisywane 1:1 z odczytu
 *    (`preserved`) — inaczej zapis samej nazwy wyzerowałby resztę kryterium,
 *    bo `INSERT` wstawia `null` za każde pole, którego payload nie niesie;
 *  - `id` w payloadzie to klucz TYMCZASOWY (stare id albo `new-N`) służący
 *    wyłącznie do sparowania rodzica w tym samym wywołaniu;
 *  - `title` jest jedynym polem wymaganym (pusty → 400
 *    `AUDIT_CRITERION_TITLE_MISSING`), więc zapis z pustą nazwą jest
 *    blokowany po stronie ekranu komunikatem inline, bez żądania;
 *  - pakiet `published` odmawia zapisu (`AuditStateError`) — edytor jest
 *    montowany tylko dla `draft` (bramka w `AuditPackObjectPage`).
 *
 * Formularz jest zbiorem pól, NIE tabelą: widok read-only (ten sam ekran)
 * pozostaje `StandardTable`, więc kanon TRIADA nie dostaje drugiej tabeli.
 */
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/primitives/Button';
import { Input } from '@/components/ui/primitives/Input';
import { Select } from '@/components/ui/primitives/Select';

import {
  replaceCriteria,
  type AuditPackCriterionNode,
  type ReplaceCriterionInput,
} from '../auditsMethodApi';

/** `CRITERION_NODE_KINDS` z `server/src/services/audits/types.ts:261`. */
export const CRITERION_NODE_KINDS = ['domain', 'clause', 'control', 'criterion'] as const;

/** Pola, których formularz nie edytuje, a których replace nie może zgubić. */
export type PreservedCriterionFields = Pick<
  ReplaceCriterionInput,
  | 'sourceReference'
  | 'auditQuestion'
  | 'expectedEvidence'
  | 'auditProcedure'
  | 'samplingGuidance'
  | 'applicabilityRule'
  | 'suggestedOwnerRole'
>;

export interface CriterionDraftRow {
  /** Klucz tymczasowy sesji edycji — stare id z bazy albo `new-N`. */
  key: string;
  parentKey: string | null;
  /** `ordinal` z odczytu — tylko do wyświetlenia; zapis nesie indeks wiersza. */
  ordinal: number;
  refCode: string;
  nodeKind: string;
  title: string;
  requirementText: string;
  /** Wartość pola liczbowego jako tekst; pusty = `null` w payloadzie. */
  weight: string;
  mandatory: boolean;
  preserved: PreservedCriterionFields;
}

type CriterionIdSet = Set<string>;

function collectCriterionIds(nodes: AuditPackCriterionNode[], acc: CriterionIdSet = new Set()): CriterionIdSet {
  for (const node of nodes ?? []) {
    acc.add(node.id);
    if (node.children?.length) collectCriterionIds(node.children, acc);
  }
  return acc;
}

/**
 * Hierarchia musi przetrwać replace — payload jest jej JEDYNYM nośnikiem
 * (serwis kasuje całe drzewo i wstawia to, co przyszło). Rozstrzyga pozycja w
 * drzewie; gdy odpowiedź jest płaska, korzeń z `parentId` wskazującym inne
 * kryterium TEGO pakietu zachowuje rodzica zamiast go zgubić.
 */
export function flattenCriteria(
  nodes: AuditPackCriterionNode[] | undefined | null,
  parentKey: string | null = null,
  knownIds: Set<string> = collectCriterionIds(nodes ?? [])
): CriterionDraftRow[] {
  const rows: CriterionDraftRow[] = [];
  for (const node of nodes ?? []) {
    rows.push({
      key: node.id,
      parentKey: parentKey ?? (node.parentId && knownIds.has(node.parentId) ? node.parentId : null),
      ordinal: Number(node.ordinal) || 0,
      refCode: node.refCode ?? '',
      nodeKind: node.nodeKind ?? 'criterion',
      title: node.title ?? '',
      requirementText: node.requirementText ?? '',
      weight: node.weight == null ? '' : String(node.weight),
      mandatory: !!node.mandatory,
      preserved: {
        sourceReference: node.sourceReference ?? null,
        auditQuestion: node.auditQuestion ?? null,
        expectedEvidence: node.expectedEvidence ?? [],
        auditProcedure: node.auditProcedure ?? null,
        samplingGuidance: node.samplingGuidance ?? null,
        applicabilityRule: node.applicabilityRule ?? {},
        suggestedOwnerRole: node.suggestedOwnerRole ?? null,
      },
    });
    if (node.children?.length) rows.push(...flattenCriteria(node.children, node.id, knownIds));
  }
  return rows;
}

function parseWeight(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Kolejność w edytorze JEST kolejnością zapisu: `ordinal` = indeks wiersza. */
export function buildReplacePayload(rows: CriterionDraftRow[]): ReplaceCriterionInput[] {
  return rows.map((row, index) => ({
    id: row.key,
    parentId: row.parentKey,
    ordinal: index,
    refCode: row.refCode.trim() || null,
    nodeKind: row.nodeKind,
    title: row.title.trim(),
    requirementText: row.requirementText.trim() || null,
    mandatory: row.mandatory,
    weight: parseWeight(row.weight),
    ...row.preserved,
  }));
}

/**
 * Liczba zmian do pokazania PRZED zapisem (replace, nie patch — użytkownik
 * musi widzieć, ile wierszy dotknie jedno żądanie). Wiersz liczy się raz,
 * nawet gdy ma kilka zmienionych pól; przesunięcie kolejności też jest zmianą.
 */
export function countCriteriaChanges(
  before: CriterionDraftRow[],
  after: CriterionDraftRow[]
): number {
  const beforeByKey = new Map(before.map((row, index) => [row.key, { row, index }]));
  const afterByKey = new Map(after.map((row, index) => [row.key, { row, index }]));
  let changes = 0;
  for (const [key, entry] of afterByKey) {
    const previous = beforeByKey.get(key);
    if (!previous) {
      changes += 1;
      continue;
    }
    const a = previous.row;
    const b = entry.row;
    const edited =
      a.title !== b.title ||
      a.requirementText !== b.requirementText ||
      a.weight !== b.weight ||
      a.mandatory !== b.mandatory ||
      a.nodeKind !== b.nodeKind ||
      a.refCode !== b.refCode ||
      a.parentKey !== b.parentKey ||
      previous.index !== entry.index;
    if (edited) changes += 1;
  }
  for (const key of beforeByKey.keys()) {
    if (!afterByKey.has(key)) changes += 1;
  }
  return changes;
}

export interface PackCriteriaEditorProps {
  packId: string;
  criteria: AuditPackCriterionNode[];
  /**
   * Wołane PO udanym `PUT`. Właściciel ekranu czyta pakiet ponownie
   * (`getPack`) i renderuje z odpowiedzi serwera, nie z lokalnego stanu.
   */
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
}

export const PackCriteriaEditor: React.FC<PackCriteriaEditorProps> = ({
  packId,
  criteria,
  onSaved,
  onCancel,
}) => {
  const { t } = useTranslation();
  const baseline = useMemo(() => flattenCriteria(criteria), [criteria]);
  const [rows, setRows] = useState<CriterionDraftRow[]>(baseline);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Licznik kluczy tymczasowych — monotoniczny, więc add/remove/add nie koliduje. */
  const newKeyRef = useRef(0);

  const changes = useMemo(() => countCriteriaChanges(baseline, rows), [baseline, rows]);

  const nodeKindOptions = useMemo(
    () =>
      CRITERION_NODE_KINDS.map((kind) => ({
        value: kind,
        label: t(`audit.pack.viewer.criteria.nodeKind.${kind}`, kind),
      })),
    [t]
  );

  const patchRow = useCallback((key: string, patch: Partial<CriterionDraftRow>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }, []);

  const addRow = useCallback(() => {
    newKeyRef.current += 1;
    const key = `new-${newKeyRef.current}`;
    setRows((current) => [
      ...current,
      {
        key,
        parentKey: null,
        ordinal: 0,
        refCode: '',
        nodeKind: 'criterion',
        title: '',
        requirementText: '',
        weight: '',
        mandatory: true,
        preserved: {
          sourceReference: null,
          auditQuestion: null,
          expectedEvidence: [],
          auditProcedure: null,
          samplingGuidance: null,
          applicabilityRule: {},
          suggestedOwnerRole: null,
        },
      },
    ]);
  }, []);

  const removeRow = useCallback((key: string) => {
    // Usunięcie rodzica nie zostawia sierot: potomkowie wchodzą na jego poziom.
    setRows((current) => {
      const removed = current.find((row) => row.key === key);
      return current
        .filter((row) => row.key !== key)
        .map((row) =>
          removed && row.parentKey === key ? { ...row, parentKey: removed.parentKey } : row
        );
    });
  }, []);

  const moveRow = useCallback((index: number, direction: -1 | 1) => {
    setRows((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaveError(null);
    if (rows.some((row) => !row.title.trim())) {
      setSaveError(
        t('audit.pack.viewer.criteria.titleMissing', 'Every criterion needs a title.')
      );
      return;
    }
    setSaving(true);
    try {
      await replaceCriteria(packId, buildReplacePayload(rows));
      await onSaved();
    } catch (e: any) {
      // Stan lokalny ZACHOWANY: błąd 4xx/5xx nie kasuje pracy użytkownika.
      setSaveError(
        e?.message ||
          t('audit.pack.viewer.criteria.saveFailed', 'Could not save the criteria list.')
      );
    } finally {
      setSaving(false);
    }
  }, [saving, rows, packId, onSaved, t]);

  return (
    <div className="flex flex-col gap-3" data-testid="pack-criteria-editor">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-c-text-secondary" data-testid="pack-criteria-changes">
          {changes > 0
            ? t('audit.pack.viewer.criteria.unsavedChanges', 'Unsaved changes: {{count}}', {
                count: changes,
              })
            : t('audit.pack.viewer.criteria.noChanges', 'No changes yet.')}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={saving}
            data-testid="pack-criteria-cancel"
          >
            {t('audit.pack.viewer.criteria.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSave()}
            loading={saving}
            disabled={saving}
            data-testid="pack-criteria-save"
          >
            {t('audit.pack.viewer.criteria.save', 'Save criteria')}
          </Button>
        </div>
      </div>

      {saveError ? (
        <div
          role="alert"
          data-testid="pack-criteria-save-error"
          className="rounded-lg border border-c-danger/30 bg-c-danger/5 px-3 py-2 text-xs text-c-danger"
        >
          {saveError}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div
            key={row.key}
            data-testid="pack-criteria-row"
            className="flex flex-col gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-xs tabular-nums text-c-text-muted">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Input
                  size="sm"
                  value={row.title}
                  disabled={saving}
                  placeholder={t('audit.pack.viewer.criteria.titlePlaceholder', 'Criterion title')}
                  aria-label={t('audit.pack.viewer.criteria.title', 'Criterion')}
                  onChange={(event) => patchRow(row.key, { title: event.target.value })}
                  data-testid={`pack-criteria-title-${row.key}`}
                />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveRow(index, -1)}
                  disabled={saving || index === 0}
                  aria-label={t('audit.pack.viewer.criteria.moveUp', 'Move up')}
                  data-testid={`pack-criteria-move-up-${row.key}`}
                >
                  <ArrowUp size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveRow(index, 1)}
                  disabled={saving || index === rows.length - 1}
                  aria-label={t('audit.pack.viewer.criteria.moveDown', 'Move down')}
                  data-testid={`pack-criteria-move-down-${row.key}`}
                >
                  <ArrowDown size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(row.key)}
                  disabled={saving}
                  aria-label={t('audit.pack.viewer.criteria.remove', 'Remove criterion')}
                  data-testid={`pack-criteria-remove-${row.key}`}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-2 pl-10">
              <div className="w-40 shrink-0">
                <Input
                  size="sm"
                  value={row.refCode}
                  disabled={saving}
                  placeholder={t('audit.pack.viewer.criteria.refCode', 'Reference')}
                  aria-label={t('audit.pack.viewer.criteria.refCode', 'Reference')}
                  onChange={(event) => patchRow(row.key, { refCode: event.target.value })}
                  data-testid={`pack-criteria-refcode-${row.key}`}
                />
              </div>
              <div className="w-44 shrink-0">
                <Select
                  value={CRITERION_NODE_KINDS.includes(row.nodeKind as never) ? row.nodeKind : 'criterion'}
                  options={nodeKindOptions}
                  disabled={saving}
                  onChange={(value) => patchRow(row.key, { nodeKind: value })}
                  aria-label={t('audit.pack.viewer.criteria.structure', 'Structure level')}
                />
              </div>
              <div className="w-24 shrink-0">
                <Input
                  size="sm"
                  type="number"
                  step="0.1"
                  value={row.weight}
                  disabled={saving}
                  placeholder={t('audit.pack.viewer.criteria.weight', 'Weight')}
                  aria-label={t('audit.pack.viewer.criteria.weight', 'Weight')}
                  onChange={(event) => patchRow(row.key, { weight: event.target.value })}
                  data-testid={`pack-criteria-weight-${row.key}`}
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-c-text-secondary">
                <input
                  type="checkbox"
                  checked={row.mandatory}
                  disabled={saving}
                  onChange={(event) => patchRow(row.key, { mandatory: event.target.checked })}
                  data-testid={`pack-criteria-mandatory-${row.key}`}
                />
                {t('audit.pack.viewer.criteria.mandatory', 'Mandatory')}
              </label>
            </div>

            <div className="pl-10">
              <textarea
                rows={2}
                value={row.requirementText}
                disabled={saving}
                placeholder={t(
                  'audit.pack.viewer.criteria.descriptionPlaceholder',
                  'Requirement description'
                )}
                aria-label={t('audit.pack.viewer.criteria.description', 'Description')}
                onChange={(event) => patchRow(row.key, { requirementText: event.target.value })}
                data-testid={`pack-criteria-description-${row.key}`}
                className="w-full resize-y rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text placeholder:text-c-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <Button
          variant="outline"
          size="sm"
          icon={<Plus size={14} />}
          onClick={addRow}
          disabled={saving}
          data-testid="pack-criteria-add"
        >
          {t('audit.pack.viewer.criteria.add', 'Add criterion')}
        </Button>
      </div>
    </div>
  );
};

export default PackCriteriaEditor;
