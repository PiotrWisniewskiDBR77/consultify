/**
 * FindingPanel — Criterion Workspace, ogniwa „ustalenie" i „odpowiedź
 * właściciela".
 *
 * Lista ustaleń kryterium (`StandardTable`) + formularz utworzenia ustalenia
 * (`finding.draft`) + przegląd (`finding.review`: confirm/send_back/reject)
 * + odpowiedź właściciela obszaru (`finding.respond_as_management`) +
 * akceptacja ryzyka rezydualnego (`finding.accept_residual_risk`).
 *
 * SEGREGACJA OBOWIĄZKÓW (widoczna w UI, nie tylko wymuszona serwerem):
 * audytowany, który sam odpowiadał na kryterium jako auditee
 * (`criterion.auditeeRespondedBy === currentUserId`), NIE dostaje przycisku
 * „wyciągnij wniosek" — TA reguła żyje w `CriterionWorkspace` (blokuje samo
 * ogniwo „status zgodności"), ale analogiczna zasada dla RECENZJI ustalenia
 * (autor nie recenzuje własnego ustalenia) jest lokalna tutaj:
 * `finding.authorId === currentUserId` chowa przycisk przeglądu z powodem.
 */
import { AlertTriangle, CheckCircle2, ClipboardList, RotateCcw, Send, ShieldAlert, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { StandardTable, type TableColumn, type TableRow } from '@/components/standard';
import { PreviewActionButton } from '@/components/shared/PreviewPane/PreviewActionButton';
import { ErrorState, LoadingState, SaveStateIndicator, type SaveStatus } from '@/components/shared/states';
import { StatusChip } from '@/components/ui/primitives/chips';

import TeresaProposalCard from './TeresaProposalCard';
import * as workspaceApi from './workspaceApi';
import type {
  FindingSeverity,
  ResponsePosition,
  WorkspaceCapability,
  WorkspaceFinding,
  WorkspaceFindingDetail,
} from './workspaceApi';

export interface FindingPanelProps {
  programId: string;
  criterionId: string;
  capabilities: Set<WorkspaceCapability>;
  currentUserId: string | null;
  isPolish: boolean;
  selectedFindingId: string | null;
  onSelectFinding: (id: string | null) => void;
  onFindingDetailChange: (detail: WorkspaceFindingDetail | null) => void;
  /** Wywołane po każdej zmianie listy ustaleń — kryterium odświeża liczniki. */
  onFindingsChanged?: () => void;
  /**
   * Gdy podane, tabela pokazuje domyślnie tylko pierwsze `maxRows` wierszy +
   * link „pokaż wszystkie (N)" pod tabelą (DEC-88, wariant A pyt. 2).
   * Nieustawione (domyślnie `undefined`) = bez zmian, cała lista jak dotąd.
   */
  maxRows?: number;
}

const SEVERITIES: FindingSeverity[] = ['informational', 'low', 'medium', 'high', 'critical'];

function findingStatusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'closed') return 'success';
  if (status === 'rejected') return 'neutral';
  if (status === 'risk_accepted') return 'info';
  if (status === 'draft') return 'neutral';
  return 'warning';
}

export const FindingPanel: React.FC<FindingPanelProps> = ({
  programId,
  criterionId,
  capabilities,
  currentUserId,
  isPolish,
  selectedFindingId,
  onSelectFinding,
  onFindingDetailChange,
  onFindingsChanged,
  maxRows,
}) => {
  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);

  const [items, setItems] = useState<WorkspaceFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkspaceFindingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showAll, setShowAll] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [statement, setStatement] = useState('');
  const [classification, setClassification] = useState('nonconforming');
  const [severity, setSeverity] = useState<FindingSeverity>('medium');

  const [responseText, setResponseText] = useState('');
  const [responsePosition, setResponsePosition] = useState<ResponsePosition>('accept');
  const [riskNote, setRiskNote] = useState('');

  const canDraft = capabilities.has('finding.draft');
  const canReview = capabilities.has('finding.review');
  const canRespond = capabilities.has('finding.respond_as_management');
  const canAcceptRisk = capabilities.has('finding.accept_residual_risk');

  const loadList = useCallback(() => {
    setLoading(true);
    setError(null);
    workspaceApi
      .listFindings({ programId, criterionId })
      .then((res) => setItems(res.items))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : t('Nie udało się wczytać ustaleń', 'Could not load findings'))
      )
      .finally(() => setLoading(false));
  }, [programId, criterionId, t]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedFindingId) {
      setDetail(null);
      onFindingDetailChange(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    workspaceApi
      .getFinding(selectedFindingId)
      .then((d) => {
        if (!cancelled) {
          setDetail(d);
          onFindingDetailChange(d);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(null);
          onFindingDetailChange(null);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFindingId]);

  const refreshDetail = useCallback(() => {
    if (!selectedFindingId) return;
    workspaceApi.getFinding(selectedFindingId).then((d) => {
      setDetail(d);
      onFindingDetailChange(d);
    });
  }, [selectedFindingId, onFindingDetailChange]);

  const handleCreate = useCallback(async () => {
    if (!statement.trim()) return;
    setSaveStatus('saving');
    try {
      const created = await workspaceApi.createFinding({
        programId,
        criterionId,
        statement: statement.trim(),
        classification,
        severity,
        objectiveEvidence: [],
      });
      setSaveStatus('saved');
      setStatement('');
      setFormOpen(false);
      loadList();
      onFindingsChanged?.();
      onSelectFinding(created.id);
    } catch (e: unknown) {
      setSaveStatus('error');
    }
  }, [programId, criterionId, statement, classification, severity, loadList, onFindingsChanged, onSelectFinding]);

  const handleReview = useCallback(
    async (decision: 'confirm' | 'send_back' | 'reject', note?: string) => {
      if (!detail) return;
      setSaveStatus('saving');
      try {
        await workspaceApi.reviewFinding(detail.id, { decision, note: note ?? null });
        setSaveStatus('saved');
        loadList();
        refreshDetail();
        onFindingsChanged?.();
      } catch (e: unknown) {
        setSaveStatus('error');
      }
    },
    [detail, loadList, refreshDetail, onFindingsChanged]
  );

  const handleRespond = useCallback(async () => {
    if (!detail || !responseText.trim()) return;
    setSaveStatus('saving');
    try {
      await workspaceApi.submitManagementResponse(detail.id, {
        position: responsePosition,
        statement: responseText.trim(),
      });
      setSaveStatus('saved');
      setResponseText('');
      refreshDetail();
      onFindingsChanged?.();
    } catch (e: unknown) {
      setSaveStatus('error');
    }
  }, [detail, responsePosition, responseText, refreshDetail, onFindingsChanged]);

  const handleAcceptRisk = useCallback(async () => {
    if (!detail || !riskNote.trim()) return;
    setSaveStatus('saving');
    try {
      await workspaceApi.acceptResidualRisk(detail.id, riskNote.trim());
      setSaveStatus('saved');
      setRiskNote('');
      loadList();
      refreshDetail();
      onFindingsChanged?.();
    } catch (e: unknown) {
      setSaveStatus('error');
    }
  }, [detail, riskNote, loadList, refreshDetail, onFindingsChanged]);

  const columns: TableColumn[] = [
    {
      id: 'referenceCode',
      label: t('Nr', '#'),
      width: '70px',
      render: (row: WorkspaceFinding) => (
        <span className="font-mono text-xs text-c-text-muted">{row.referenceCode || '—'}</span>
      ),
    },
    {
      id: 'statement',
      label: t('Treść', 'Statement'),
      render: (row: WorkspaceFinding) => (
        <span className="text-sm text-c-text line-clamp-1">{row.statement}</span>
      ),
    },
    {
      id: 'classification',
      label: t('Klasyfikacja', 'Classification'),
      width: '160px',
    },
    {
      id: 'status',
      label: t('Status', 'Status'),
      width: '150px',
      render: (row: WorkspaceFinding) => <StatusChip label={row.status} tone={findingStatusTone(row.status)} />,
    },
  ];

  // Autor nie recenzuje własnego ustalenia — mirror assertNotReviewingOwnFinding.
  const isOwnFinding = !!detail && !!currentUserId && detail.authorId === currentUserId;
  const reviewBlockedReason = isOwnFinding
    ? t('Nie możesz zrecenzować własnego ustalenia — recenzja wymaga niezależności.', 'You cannot review your own finding — review requires independence.')
    : null;

  if (error) {
    return (
      <ErrorState
        compact
        title={t('Nie udało się wczytać ustaleń', 'Could not load findings')}
        description={error}
        onRetry={loadList}
      />
    );
  }

  return (
    <div data-testid="finding-panel" className="space-y-3">
      <div className="flex items-center justify-between">
        <SaveStateIndicator status={saveStatus} />
        {canDraft && (
          <PreviewActionButton
            variant="neutral"
            label={t('Nowe ustalenie', 'New finding')}
            icon={ClipboardList}
            onClick={() => setFormOpen((v) => !v)}
          />
        )}
      </div>

      {formOpen && canDraft && (
        <div className="space-y-2 rounded-token-md border border-c-border-subtle p-3">
          <textarea
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            placeholder={t('Treść ustalenia', 'Finding statement')}
            aria-label={t('Treść ustalenia', 'Finding statement')}
            className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
            rows={2}
          />
          <div className="flex gap-2">
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              aria-label={t('Klasyfikacja', 'Classification')}
              className="flex-1 rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
            >
              <option value="nonconforming">nonconforming</option>
              <option value="observation">observation</option>
              <option value="opportunity_for_improvement">opportunity_for_improvement</option>
              <option value="evidence_insufficient">evidence_insufficient</option>
            </select>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as FindingSeverity)}
              aria-label={t('Istotność', 'Severity')}
              className="flex-1 rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <PreviewActionButton
            variant="positive"
            label={t('Utwórz ustalenie', 'Create finding')}
            onClick={handleCreate}
            disabled={!statement.trim() || saveStatus === 'saving'}
          />
        </div>
      )}

      <TeresaProposalCard
        label={t('Teresa: redakcja ustalenia', "Teresa: draft the finding's text")}
        programId={programId}
        targetType="finding"
        targetId={detail?.id ?? criterionId}
        intent="draft_finding"
        context={{ criterionId }}
        canPropose={capabilities.has('ai.propose')}
        canCommit={capabilities.has('ai.commit')}
        isPolish={isPolish}
        onCommitted={() => {
          loadList();
          refreshDetail();
        }}
      />

      {loading ? (
        <LoadingState template="list" rows={2} />
      ) : (
        <>
          <StandardTable
            columns={columns}
            data={(maxRows && !showAll ? items.slice(0, maxRows) : items) as unknown as TableRow[]}
            loading={false}
            selectedRowId={selectedFindingId}
            onRowClick={(row) => onSelectFinding(String(row.id))}
            persistKey="audits.method.workspace.findings"
            empty={{
              icon: ClipboardList,
              title: t('Brak ustaleń', 'No findings yet'),
              description: canDraft
                ? t('Utwórz pierwsze ustalenie dla tego kryterium.', 'Create the first finding for this criterion.')
                : t('Dla tego kryterium nie zarejestrowano jeszcze ustalenia.', 'No finding has been recorded for this criterion yet.'),
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

      {selectedFindingId && detailLoading && <LoadingState template="panel" />}

      {detail && !detailLoading && (
        <div className="space-y-3 rounded-token-md border border-c-border-subtle p-3">
          <p className="text-xs font-semibold text-c-text">
            {t('Ustalenie', 'Finding')} {detail.referenceCode}: {detail.statement}
          </p>

          {canReview && detail.status === 'draft' && !isOwnFinding && (
            <div className="flex flex-wrap gap-2">
              <PreviewActionButton
                variant="positive"
                label={t('Potwierdź', 'Confirm')}
                icon={CheckCircle2}
                onClick={() => handleReview('confirm')}
              />
              <PreviewActionButton
                variant="warning"
                label={t('Odeślij do audytora', 'Send back')}
                icon={RotateCcw}
                onClick={() => handleReview('send_back', t('Wymaga doprecyzowania', 'Needs clarification'))}
              />
              <PreviewActionButton
                variant="destructive"
                label={t('Odrzuć', 'Reject')}
                icon={XCircle}
                onClick={() => handleReview('reject', t('Ustalenie nieuzasadnione', 'Finding not substantiated'))}
              />
            </div>
          )}
          {canReview && detail.status === 'draft' && isOwnFinding && (
            <p className="text-xs text-c-text-muted">{reviewBlockedReason}</p>
          )}
          {!canReview && detail.status === 'draft' && (
            <p className="text-xs text-c-text-muted">
              {t('Recenzja ustalenia wymaga roli lead auditor/auditor/reviewer.', 'Reviewing a finding requires the lead auditor/auditor/reviewer role.')}
            </p>
          )}

          {canRespond && (detail.status === 'confirmed' || detail.status === 'response_pending') && (
            <div data-testid="management-response-form" className="space-y-2">
              <p className="text-xs font-semibold text-c-text">{t('Odpowiedź właściciela obszaru', 'Management response')}</p>
              <select
                value={responsePosition}
                onChange={(e) => setResponsePosition(e.target.value as ResponsePosition)}
                aria-label={t('Stanowisko', 'Position')}
                className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
              >
                <option value="accept">accept</option>
                <option value="partially_accept">partially_accept</option>
                <option value="reject">reject</option>
                <option value="request_clarification">request_clarification</option>
              </select>
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder={t('Treść odpowiedzi', 'Response text')}
                aria-label={t('Treść odpowiedzi', 'Response text')}
                className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
                rows={2}
              />
              <PreviewActionButton
                variant="neutral"
                label={t('Wyślij odpowiedź', 'Submit response')}
                icon={Send}
                onClick={handleRespond}
                disabled={!responseText.trim()}
              />
            </div>
          )}

          {detail.managementResponses.length > 0 && (
            <div className="space-y-1">
              {detail.managementResponses.map((r) => (
                <p key={r.id} className="text-xs text-c-text-muted">
                  <span className="font-medium text-c-text">{r.position}:</span> {r.statement}
                </p>
              ))}
            </div>
          )}

          {canAcceptRisk && detail.status !== 'closed' && detail.status !== 'risk_accepted' && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-c-text">
                <ShieldAlert size={12} className="mr-1 inline" aria-hidden />
                {t('Akceptacja ryzyka rezydualnego', 'Accept residual risk')}
              </p>
              <textarea
                value={riskNote}
                onChange={(e) => setRiskNote(e.target.value)}
                placeholder={t('Uzasadnienie decyzji', 'Justification for the decision')}
                aria-label={t('Uzasadnienie akceptacji ryzyka', 'Risk acceptance justification')}
                className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
                rows={2}
              />
              <PreviewActionButton
                variant="warning"
                label={t('Zaakceptuj ryzyko', 'Accept risk')}
                icon={AlertTriangle}
                onClick={handleAcceptRisk}
                disabled={!riskNote.trim()}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FindingPanel;
