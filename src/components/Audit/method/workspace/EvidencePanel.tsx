/**
 * EvidencePanel — Criterion Workspace, ogniwo „dostarczony dowód".
 *
 * Lista dowodów kryterium (`StandardTable` — kanon list, CLAUDE.md #1/#9) +
 * formularz złożenia nowego dowodu (`evidence.submit`) + recenzja dowodu
 * (`evidence.review`: sufficiency/reliability/currency/supportsConformity/
 * accepted). Dowód PRZECZĄCY (`supportsConformity=false`) jest oznaczany
 * WYRAŹNIE — nigdy chowany (test #12 pakietu robotnika).
 *
 * Oczekiwane dowody (`criterion.expectedEvidence`) i żądania dowodów
 * (`audit_evidence_requests`) są pokazane osobno od dowodów DOSTARCZONYCH —
 * to trzy różne ogniwa łańcucha („oczekiwany dowód" żyje w
 * `CriterionWorkspace`, ten panel odpowiada tylko za „dostarczony dowód").
 */
import { CheckCircle2, FileText, Plus, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { StandardTable, type TableColumn, type TableRow } from '@/components/standard';
import { PreviewActionButton } from '@/components/shared/PreviewPane/PreviewActionButton';
import { ErrorState, LoadingState, SaveStateIndicator, type SaveStatus } from '@/components/shared/states';
import { StatusChip } from '@/components/ui/primitives/chips';

import * as workspaceApi from './workspaceApi';
import type { EvidenceKind, WorkspaceCapability, WorkspaceEvidence } from './workspaceApi';

export interface EvidencePanelProps {
  programId: string;
  criterionId: string;
  capabilities: Set<WorkspaceCapability>;
  isPolish: boolean;
  /** Wywołane po każdej udanej zmianie (submit/review) — kryterium odświeża liczniki. */
  onEvidenceChanged?: () => void;
  /**
   * Gdy podane, tabela pokazuje domyślnie tylko pierwsze `maxRows` wierszy +
   * link „pokaż wszystkie (N)" pod tabelą (DEC-88, wariant A pyt. 2 — tabela
   * osadzona w karcie fazy nie rośnie bez ograniczeń). Nieustawione (domyślnie
   * `undefined`) = bez zmian, cała lista jak dotąd (stary ekran V1).
   */
  maxRows?: number;
}

const EVIDENCE_KIND_OPTIONS: EvidenceKind[] = [
  'document',
  'interview_answer',
  'interview_statement',
  'observation',
  'system_export',
  'screenshot',
  'note',
  'sample',
];

// Słownik RODZAJU dowodu — jedno miejsce, tak jak lokalny `t(pl,en)` tego
// ekranu. Odbiór 2026-08-26: „zero surowych enumów na twarzy ekranu" —
// `evidenceKind` z API (`EvidenceKind`, `workspaceApi.ts`) zostaje bez zmian,
// tylko WARSTWA WYŚWIETLANIA dostaje pigułkę PL/EN.
const EVIDENCE_KIND_LABEL_PL: Record<EvidenceKind, string> = {
  document: 'Dokument',
  interview_answer: 'Odpowiedź z wywiadu',
  interview_statement: 'Oświadczenie z wywiadu',
  observation: 'Obserwacja',
  system_export: 'Eksport systemowy',
  screenshot: 'Zrzut ekranu',
  note: 'Notatka',
  sample: 'Próbka',
};
const EVIDENCE_KIND_LABEL_EN: Record<EvidenceKind, string> = {
  document: 'Document',
  interview_answer: 'Interview answer',
  interview_statement: 'Interview statement',
  observation: 'Observation',
  system_export: 'System export',
  screenshot: 'Screenshot',
  note: 'Note',
  sample: 'Sample',
};

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  programId,
  criterionId,
  capabilities,
  isPolish,
  onEvidenceChanged,
  maxRows,
}) => {
  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);

  const [items, setItems] = useState<WorkspaceEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showAll, setShowAll] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formKind, setFormKind] = useState<EvidenceKind>('document');
  const [formDescription, setFormDescription] = useState('');

  const canSubmit = capabilities.has('evidence.submit');
  const canReview = capabilities.has('evidence.review');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    workspaceApi
      .listEvidence({ programId, criterionId })
      .then((res) => setItems(res))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : t('Nie udało się wczytać dowodów', 'Could not load evidence'))
      )
      .finally(() => setLoading(false));
  }, [programId, criterionId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = items.find((i) => i.id === selectedId) || null;

  const handleSubmit = useCallback(async () => {
    if (!formTitle.trim()) return;
    setSaveStatus('saving');
    try {
      await workspaceApi.submitEvidence({
        programId,
        criterionId,
        kind: formKind,
        title: formTitle.trim(),
        description: formDescription.trim() || null,
      });
      setSaveStatus('saved');
      setFormTitle('');
      setFormDescription('');
      setFormOpen(false);
      load();
      onEvidenceChanged?.();
    } catch (e: unknown) {
      setSaveStatus('error');
    }
  }, [programId, criterionId, formKind, formTitle, formDescription, load, onEvidenceChanged]);

  const handleReview = useCallback(
    async (id: string, patch: workspaceApi.ReviewEvidenceInput) => {
      setSaveStatus('saving');
      try {
        await workspaceApi.reviewEvidence(id, patch);
        setSaveStatus('saved');
        load();
        onEvidenceChanged?.();
      } catch (e: unknown) {
        setSaveStatus('error');
      }
    },
    [load, onEvidenceChanged]
  );

  const columns: TableColumn[] = [
    {
      id: 'title',
      label: t('Tytuł', 'Title'),
      render: (row: WorkspaceEvidence) => (
        <div className="flex items-center gap-2">
          <FileText size={14} className="shrink-0 text-c-text-muted" aria-hidden />
          <span className="text-sm text-c-text">{row.title}</span>
        </div>
      ),
    },
    {
      id: 'evidenceKind',
      label: t('Rodzaj', 'Kind'),
      width: '140px',
      render: (row: WorkspaceEvidence) => (
        <span className="text-sm text-c-text">
          {(isPolish ? EVIDENCE_KIND_LABEL_PL : EVIDENCE_KIND_LABEL_EN)[row.evidenceKind] ?? row.evidenceKind}
        </span>
      ),
    },
    {
      id: 'supportsConformity',
      label: t('Wspiera zgodność?', 'Supports conformity?'),
      width: '170px',
      render: (row: WorkspaceEvidence) =>
        row.supportsConformity === null ? (
          <span className="text-xs text-c-text-muted">{t('nieoceniony', 'unassessed')}</span>
        ) : row.supportsConformity ? (
          <StatusChip label={t('Wspiera', 'Supports')} tone="success" />
        ) : (
          <StatusChip
            label={t('Dowód przeczący', 'Contradicting evidence')}
            tone="danger"
          />
        ),
    },
    {
      id: 'accepted',
      label: t('Zaakceptowany', 'Accepted'),
      width: '140px',
      render: (row: WorkspaceEvidence) =>
        row.accepted === null ? (
          <span className="text-xs text-c-text-muted">{t('nierozstrzygnięty', 'pending')}</span>
        ) : row.accepted ? (
          <StatusChip label={t('Tak', 'Yes')} tone="success" />
        ) : (
          <StatusChip label={t('Nie', 'No')} tone="danger" />
        ),
    },
  ];

  if (error) {
    return (
      <ErrorState
        compact
        title={t('Nie udało się wczytać dowodów', 'Could not load evidence')}
        description={error}
        onRetry={load}
      />
    );
  }

  return (
    <div data-testid="evidence-panel" className="space-y-3">
      <div className="flex items-center justify-between">
        <SaveStateIndicator status={saveStatus} />
        {canSubmit && (
          <PreviewActionButton
            variant="neutral"
            label={t('Dodaj dowód', 'Add evidence')}
            icon={Plus}
            onClick={() => setFormOpen((v) => !v)}
          />
        )}
      </div>

      {formOpen && canSubmit && (
        <div className="space-y-2 rounded-token-md border border-c-border-subtle p-3">
          <input
            type="text"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder={t('Tytuł dowodu', 'Evidence title')}
            aria-label={t('Tytuł dowodu', 'Evidence title')}
            className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
          />
          <select
            value={formKind}
            onChange={(e) => setFormKind(e.target.value as EvidenceKind)}
            aria-label={t('Rodzaj dowodu', 'Evidence kind')}
            className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
          >
            {EVIDENCE_KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder={t('Opis (opcjonalnie)', 'Description (optional)')}
            aria-label={t('Opis dowodu', 'Evidence description')}
            className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
            rows={2}
          />
          <PreviewActionButton
            variant="positive"
            label={t('Zapisz dowód', 'Save evidence')}
            onClick={handleSubmit}
            disabled={!formTitle.trim() || saveStatus === 'saving'}
          />
        </div>
      )}

      {loading ? (
        <LoadingState template="list" rows={2} />
      ) : (
        <>
          <StandardTable
            columns={columns}
            data={(maxRows && !showAll ? items.slice(0, maxRows) : items) as unknown as TableRow[]}
            loading={false}
            selectedRowId={selectedId}
            onRowClick={(row) => setSelectedId(String(row.id))}
            persistKey="audits.method.workspace.evidence"
            empty={{
              icon: FileText,
              title: t('Brak dowodów', 'No evidence yet'),
              description: canSubmit
                ? t('Dodaj pierwszy dowód dla tego kryterium.', 'Add the first piece of evidence for this criterion.')
                : t('Audytowany jeszcze nie złożył dowodu.', 'The auditee has not submitted evidence yet.'),
            }}
          />
          {maxRows && items.length > maxRows && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-xs font-semibold text-c-focus-solid underline underline-offset-2"
            >
              {showAll
                ? t('Pokaż mniej', 'Show fewer')
                : t(`Pokaż wszystkie (${items.length})`, `Show all (${items.length})`)}
            </button>
          )}
        </>
      )}

      {selected && canReview && (
        <div data-testid="evidence-review-form" className="space-y-2 rounded-token-md border border-c-border-subtle p-3">
          <p className="text-xs font-semibold text-c-text">
            {t('Recenzja dowodu:', 'Evidence review:')} {selected.title}
          </p>
          <div className="flex flex-wrap gap-2">
            <PreviewActionButton
              variant="positive"
              label={t('Wspiera zgodność', 'Supports conformity')}
              icon={CheckCircle2}
              onClick={() => handleReview(selected.id, { supportsConformity: true, accepted: true })}
            />
            <PreviewActionButton
              variant="destructive"
              label={t('Dowód przeczący', 'Contradicting evidence')}
              icon={XCircle}
              onClick={() => handleReview(selected.id, { supportsConformity: false, accepted: true })}
            />
            <PreviewActionButton
              variant="neutral"
              label={t('Odrzuć dowód', 'Reject evidence')}
              onClick={() =>
                handleReview(selected.id, {
                  accepted: false,
                  rejectionReason: t('Dowód niewystarczający', 'Insufficient evidence'),
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidencePanel;
