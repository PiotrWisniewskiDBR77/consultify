/**
 * ROI Case FULL TOOL — Learn phase write modals: PIR schedule
 * (`ScheduleRoiCasePostInvestmentReviewSchema`), PIR draft edit
 * (`UpdateRoiPostInvestmentReviewDraftSchema`), PIR Teresa-draft disposition
 * (`RecordRoiPirTeresaDraftDispositionSchema` — D13: Teresa PROPOSES, this
 * form only records the human's disposition on an already-generated draft,
 * it never itself generates or decides), Finance link create
 * (`CreateRoiFinanceLinkSchema`), Finance reconciliation open
 * (`OpenRoiFinanceReconciliationSchema`), Finance reconciliation status
 * update (`UpdateRoiFinanceReconciliationStatusSchema`). Same "group by
 * phase" compression as the other two modal files.
 */
import { AlertTriangle, CalendarClock, FileEdit, Link2, Plus, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import {
  ROI_FINANCE_RECONCILIATION_STATUSES,
  ROI_PIR_OUTCOMES,
  ROI_PIR_TERESA_DRAFT_DISPOSITIONS,
  type CreateRoiFinanceLinkInput,
  type OpenRoiFinanceReconciliationInput,
  type RecordRoiPirTeresaDraftDispositionInput,
  type RoiFinanceLink,
  type RoiFinanceReconciliationStatus,
  type RoiPirOutcome,
  type RoiPirTeresaDraftDisposition,
  type ScheduleRoiPirInput,
  type UpdateRoiFinanceReconciliationStatusInput,
  type UpdateRoiPirDraftInput,
} from './roiCaseFullToolApi';
import { roiFinanceReconciliationStatusLabel, roiPirOutcomeLabel, roiPirTeresaDispositionLabel } from './roiCaseFullToolMappers';

const FIELD_CLASS =
  'w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';
const TEXTAREA_CLASS =
  'w-full min-h-[64px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors resize-y ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';
const LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';
const GHOST_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 ' +
  'text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

function ErrorBanner({ message, isConflict, isPolish, testId }: { message: string | null; isConflict: boolean; isPolish: boolean; testId: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text" data-testid={testId}>
      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
      <span>{isConflict ? (isPolish ? `Konflikt zapisu: ${message}` : `Write conflict: ${message}`) : message}</span>
    </div>
  );
}

// ==========================================================================
// PIR — schedule
// ==========================================================================

export interface RoiPirScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: Omit<ScheduleRoiPirInput, 'expectedVersion'>) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}
export const RoiPirScheduleModal: React.FC<RoiPirScheduleModalProps> = ({ open, onClose, onSubmit, isPolish, busy = false, errorMessage = null, isConflict = false }) => {
  const [nextReviewAt, setNextReviewAt] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (!open) return; setNextReviewAt(''); setReason(''); setTouched(false); }, [open]);
  const dateError = touched && !nextReviewAt;
  const handleSubmit = () => {
    setTouched(true);
    if (!nextReviewAt) return;
    onSubmit({ nextReviewAt: new Date(nextReviewAt).toISOString(), reason: reason.trim() || null });
  };
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={isPolish ? 'Zaplanuj przegląd poinwestycyjny' : 'Schedule post-investment review'} size="sm" preventOverlayClose={busy} preventEscapeClose={busy}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
        <button type="button" onClick={handleSubmit} disabled={busy} data-testid="roi-pir-schedule-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
          <CalendarClock size={16} /><span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : (isPolish ? 'Zaplanuj' : 'Schedule')}</span>
        </button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-pir-schedule-date">{isPolish ? 'Termin przeglądu (wymagany)' : 'Review date (required)'}</label>
          <input id="roi-pir-schedule-date" type="datetime-local" autoFocus value={nextReviewAt} onChange={(e) => setNextReviewAt(e.target.value)} className={FIELD_CLASS} data-testid="roi-pir-schedule-date" aria-invalid={dateError || undefined} />
          {dateError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Termin jest wymagany' : 'Date is required'}</p> : null}
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-pir-schedule-reason">{isPolish ? 'Notatka (opcjonalnie)' : 'Note (optional)'}</label>
          <textarea id="roi-pir-schedule-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-pir-schedule-reason" />
        </div>
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-pir-schedule-error" />
      </div>
    </Modal>
  );
};

// ==========================================================================
// PIR — draft edit
// ==========================================================================

export interface RoiPirDraftEditModalProps {
  open: boolean;
  current: { outcome: RoiPirOutcome | null; lessonsLearned: string | null; recommendation: string | null } | null;
  onClose: () => void;
  onSubmit: (values: Omit<UpdateRoiPirDraftInput, 'expectedVersion'>) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}
export const RoiPirDraftEditModal: React.FC<RoiPirDraftEditModalProps> = ({ open, current, onClose, onSubmit, isPolish, busy = false, errorMessage = null, isConflict = false }) => {
  const [outcome, setOutcome] = useState<RoiPirOutcome | ''>('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [recommendation, setRecommendation] = useState('');
  useEffect(() => {
    if (!open) return;
    setOutcome(current?.outcome ?? '');
    setLessonsLearned(current?.lessonsLearned ?? '');
    setRecommendation(current?.recommendation ?? '');
  }, [open, current]);
  const handleSubmit = () => {
    onSubmit({ outcome: outcome || null, lessonsLearned: lessonsLearned.trim() || null, recommendation: recommendation.trim() || null, reason: null });
  };
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={isPolish ? 'Edytuj szkic PIR' : 'Edit PIR draft'} size="lg" preventOverlayClose={busy} preventEscapeClose={busy}
      className="max-h-[85vh] overflow-y-auto"
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
        <button type="button" onClick={handleSubmit} disabled={busy} data-testid="roi-pir-draft-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
          <FileEdit size={16} /><span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : (isPolish ? 'Zapisz szkic' : 'Save draft')}</span>
        </button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-pir-outcome">{isPolish ? 'Wynik' : 'Outcome'}</label>
          <select id="roi-pir-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as RoiPirOutcome | '')} className={FIELD_CLASS} data-testid="roi-pir-outcome">
            <option value="">—</option>
            {ROI_PIR_OUTCOMES.map((o) => (<option key={o} value={o}>{roiPirOutcomeLabel(o, isPolish)}</option>))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-pir-lessons">{isPolish ? 'Wnioski' : 'Lessons learned'}</label>
          <textarea id="roi-pir-lessons" value={lessonsLearned} onChange={(e) => setLessonsLearned(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-pir-lessons" />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-pir-recommendation">{isPolish ? 'Rekomendacja' : 'Recommendation'}</label>
          <textarea id="roi-pir-recommendation" value={recommendation} onChange={(e) => setRecommendation(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-pir-recommendation" />
        </div>
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-pir-draft-error" />
      </div>
    </Modal>
  );
};

// ==========================================================================
// PIR — Teresa draft disposition
// ==========================================================================

export interface RoiPirTeresaDispositionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: Omit<RecordRoiPirTeresaDraftDispositionInput, 'expectedVersion'>) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}
/** D13 — Teresa proposes, a human decides. This modal never auto-generates
 * anything; it only records a human's disposition on a draft the backend
 * already produced (`teresaDraftLessonsPayload`), matching the ROI backend's
 * own `recordRoiPirTeresaDraftDisposition` contract exactly. */
export const RoiPirTeresaDispositionModal: React.FC<RoiPirTeresaDispositionModalProps> = ({ open, onClose, onSubmit, isPolish, busy = false, errorMessage = null, isConflict = false }) => {
  const [disposition, setDisposition] = useState<RoiPirTeresaDraftDisposition>('accepted');
  const [finalLessonsText, setFinalLessonsText] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (!open) return; setDisposition('accepted'); setFinalLessonsText(''); setTouched(false); }, [open]);
  const needsText = disposition !== 'rejected';
  const textError = touched && needsText && !finalLessonsText.trim();
  const handleSubmit = () => {
    setTouched(true);
    if (needsText && !finalLessonsText.trim()) return;
    onSubmit({ disposition, finalLessonsText: needsText ? finalLessonsText.trim() : null, reason: null });
  };
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={isPolish ? 'Decyzja o szkicu Teresy' : 'Teresa draft decision'} size="md" preventOverlayClose={busy} preventEscapeClose={busy}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
        <button type="button" onClick={handleSubmit} disabled={busy} data-testid="roi-pir-teresa-disposition-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
          <Sparkles size={16} /><span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : (isPolish ? 'Zapisz decyzję' : 'Save decision')}</span>
        </button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-pir-teresa-disposition">{isPolish ? 'Decyzja' : 'Disposition'}</label>
          <select id="roi-pir-teresa-disposition" value={disposition} onChange={(e) => setDisposition(e.target.value as RoiPirTeresaDraftDisposition)} className={FIELD_CLASS} data-testid="roi-pir-teresa-disposition">
            {ROI_PIR_TERESA_DRAFT_DISPOSITIONS.map((d) => (<option key={d} value={d}>{roiPirTeresaDispositionLabel(d, isPolish)}</option>))}
          </select>
        </div>
        {needsText ? (
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-pir-teresa-final-text">{isPolish ? 'Ostateczny tekst wniosków (wymagany)' : 'Final lessons text (required)'}</label>
            <textarea id="roi-pir-teresa-final-text" value={finalLessonsText} onChange={(e) => setFinalLessonsText(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-pir-teresa-final-text" aria-invalid={textError || undefined} />
            {textError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Tekst jest wymagany, chyba że odrzucasz szkic' : 'Text is required unless rejecting the draft'}</p> : null}
          </div>
        ) : null}
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-pir-teresa-disposition-error" />
      </div>
    </Modal>
  );
};

// ==========================================================================
// Finance link — create
// ==========================================================================

export interface RoiFinanceLinkFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateRoiFinanceLinkInput) => void;
  isPolish: boolean;
  defaultCurrency: string;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}
export const RoiFinanceLinkFormModal: React.FC<RoiFinanceLinkFormModalProps> = ({ open, onClose, onSubmit, isPolish, defaultCurrency, busy = false, errorMessage = null, isConflict = false }) => {
  const [financeArtifactType, setFinanceArtifactType] = useState('');
  const [financeArtifactId, setFinanceArtifactId] = useState('');
  const [financeVersionId, setFinanceVersionId] = useState('');
  const [source, setSource] = useState('');
  const [asOf, setAsOf] = useState('');
  const [semanticUnit, setSemanticUnit] = useState('');
  const [currency, setCurrency] = useState('');
  const [linkPurpose, setLinkPurpose] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFinanceArtifactType(''); setFinanceArtifactId(''); setFinanceVersionId('');
    setSource(''); setAsOf(''); setSemanticUnit(''); setCurrency(defaultCurrency); setLinkPurpose(''); setTouched(false);
  }, [open, defaultCurrency]);

  const required = [financeArtifactType, financeArtifactId, financeVersionId, source, asOf, linkPurpose];
  const hasError = (v: string) => touched && !v.trim();

  const handleSubmit = () => {
    setTouched(true);
    if (required.some((v) => !v.trim())) return;
    onSubmit({
      financeArtifactType: financeArtifactType.trim(),
      financeArtifactId: financeArtifactId.trim(),
      financeVersionId: financeVersionId.trim(),
      source: source.trim(),
      asOf: new Date(asOf).toISOString(),
      semanticUnit: semanticUnit.trim() || null,
      currency: currency.trim() || null,
      linkPurpose: linkPurpose.trim(),
      reason: null,
    });
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={isPolish ? 'Nowe powiązanie Finance' : 'New finance link'} size="lg" preventOverlayClose={busy} preventEscapeClose={busy}
      className="max-h-[85vh] overflow-y-auto"
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
        <button type="button" onClick={handleSubmit} disabled={busy} data-testid="roi-finance-link-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
          <Link2 size={16} /><span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : (isPolish ? 'Powiąż' : 'Link')}</span>
        </button>
      </>}>
      <div className="space-y-4">
        <p className="text-[12px] text-c-text-muted">
          {isPolish
            ? 'Typ/ID/wersja artefaktu Finance to zwykły tekst (decyzja D4) — brak wyszukiwarki, wpisz ręcznie.'
            : 'Finance artifact type/ID/version are plain text (Decision D4) — no picker, enter manually.'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-finance-artifact-type">{isPolish ? 'Typ artefaktu' : 'Artifact type'}</label>
            <input id="roi-finance-artifact-type" autoFocus value={financeArtifactType} onChange={(e) => setFinanceArtifactType(e.target.value)} className={FIELD_CLASS} data-testid="roi-finance-artifact-type" aria-invalid={hasError(financeArtifactType) || undefined} aria-describedby={hasError(financeArtifactType) ? 'roi-finance-artifact-type-error' : undefined} />
            {hasError(financeArtifactType) ? <p id="roi-finance-artifact-type-error" className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Typ artefaktu jest wymagany' : 'Artifact type is required'}</p> : null}
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-finance-artifact-id">{isPolish ? 'ID artefaktu' : 'Artifact ID'}</label>
            <input id="roi-finance-artifact-id" value={financeArtifactId} onChange={(e) => setFinanceArtifactId(e.target.value)} className={FIELD_CLASS} data-testid="roi-finance-artifact-id" aria-invalid={hasError(financeArtifactId) || undefined} aria-describedby={hasError(financeArtifactId) ? 'roi-finance-artifact-id-error' : undefined} />
            {hasError(financeArtifactId) ? <p id="roi-finance-artifact-id-error" className="mt-1 text-[11px] text-c-danger">{isPolish ? 'ID artefaktu jest wymagane' : 'Artifact ID is required'}</p> : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-finance-version-id">{isPolish ? 'ID wersji' : 'Version ID'}</label>
            <input id="roi-finance-version-id" value={financeVersionId} onChange={(e) => setFinanceVersionId(e.target.value)} className={FIELD_CLASS} data-testid="roi-finance-version-id" aria-invalid={hasError(financeVersionId) || undefined} aria-describedby={hasError(financeVersionId) ? 'roi-finance-version-id-error' : undefined} />
            {hasError(financeVersionId) ? <p id="roi-finance-version-id-error" className="mt-1 text-[11px] text-c-danger">{isPolish ? 'ID wersji jest wymagane' : 'Version ID is required'}</p> : null}
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-finance-source">{isPolish ? 'Źródło' : 'Source'}</label>
            <input id="roi-finance-source" value={source} onChange={(e) => setSource(e.target.value)} className={FIELD_CLASS} data-testid="roi-finance-source" aria-invalid={hasError(source) || undefined} aria-describedby={hasError(source) ? 'roi-finance-source-error' : undefined} />
            {hasError(source) ? <p id="roi-finance-source-error" className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Źródło jest wymagane' : 'Source is required'}</p> : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-finance-as-of">{isPolish ? 'Stan na' : 'As of'}</label>
            <input id="roi-finance-as-of" type="datetime-local" value={asOf} onChange={(e) => setAsOf(e.target.value)} className={FIELD_CLASS} data-testid="roi-finance-as-of" aria-invalid={hasError(asOf) || undefined} aria-describedby={hasError(asOf) ? 'roi-finance-as-of-error' : undefined} />
            {hasError(asOf) ? <p id="roi-finance-as-of-error" className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Data jest wymagana' : 'Date is required'}</p> : null}
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-finance-purpose">{isPolish ? 'Cel powiązania' : 'Link purpose'}</label>
            <input id="roi-finance-purpose" value={linkPurpose} onChange={(e) => setLinkPurpose(e.target.value)} className={FIELD_CLASS} data-testid="roi-finance-purpose" aria-invalid={hasError(linkPurpose) || undefined} aria-describedby={hasError(linkPurpose) ? 'roi-finance-purpose-error' : undefined} />
            {hasError(linkPurpose) ? <p id="roi-finance-purpose-error" className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Cel powiązania jest wymagany' : 'Link purpose is required'}</p> : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-finance-semantic-unit">{isPolish ? 'Jednostka semantyczna' : 'Semantic unit'}</label>
            <input id="roi-finance-semantic-unit" value={semanticUnit} onChange={(e) => setSemanticUnit(e.target.value)} className={FIELD_CLASS} data-testid="roi-finance-semantic-unit" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-finance-currency">{isPolish ? 'Waluta' : 'Currency'}</label>
            <input id="roi-finance-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={FIELD_CLASS} data-testid="roi-finance-currency" />
          </div>
        </div>
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-finance-link-error" />
      </div>
    </Modal>
  );
};

// ==========================================================================
// Finance reconciliation — open
// ==========================================================================

export interface RoiFinanceReconciliationFormModalProps {
  open: boolean;
  financeLinks: RoiFinanceLink[];
  onClose: () => void;
  onSubmit: (values: OpenRoiFinanceReconciliationInput) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}
export const RoiFinanceReconciliationFormModal: React.FC<RoiFinanceReconciliationFormModalProps> = ({
  open, financeLinks, onClose, onSubmit, isPolish, busy = false, errorMessage = null, isConflict = false,
}) => {
  const [financeLinkId, setFinanceLinkId] = useState('');
  const [roiValue, setRoiValue] = useState('');
  const [financeValue, setFinanceValue] = useState('');
  const [divergenceReason, setDivergenceReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFinanceLinkId(financeLinks[0]?.linkId ?? '');
    setRoiValue(''); setFinanceValue(''); setDivergenceReason(''); setTouched(false);
  }, [open, financeLinks]);

  const linkError = touched && !financeLinkId;
  const roiError = touched && roiValue.trim() === '';
  const financeError = touched && financeValue.trim() === '';

  const handleSubmit = () => {
    setTouched(true);
    if (!financeLinkId || roiValue.trim() === '' || financeValue.trim() === '') return;
    onSubmit({ financeLinkId, roiValue: Number(roiValue), financeValue: Number(financeValue), divergenceReason: divergenceReason.trim() || null, reason: null });
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={isPolish ? 'Otwórz rekoncyliację' : 'Open reconciliation'} size="md" preventOverlayClose={busy} preventEscapeClose={busy}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
        <button type="button" onClick={handleSubmit} disabled={busy || financeLinks.length === 0} data-testid="roi-finance-reconciliation-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
          <Plus size={16} /><span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : (isPolish ? 'Otwórz' : 'Open')}</span>
        </button>
      </>}>
      <div className="space-y-4">
        {financeLinks.length === 0 ? (
          <p className="text-sm text-c-text-muted">{isPolish ? 'Brak powiązań Finance w tej sprawie — dodaj powiązanie najpierw.' : 'No finance links in this case — add a link first.'}</p>
        ) : (
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-recon-link">{isPolish ? 'Powiązanie Finance' : 'Finance link'}</label>
            <select id="roi-recon-link" value={financeLinkId} onChange={(e) => setFinanceLinkId(e.target.value)} className={FIELD_CLASS} data-testid="roi-recon-link" aria-invalid={linkError || undefined} aria-describedby={linkError ? 'roi-recon-link-error' : undefined}>
              {financeLinks.map((l) => (<option key={l.linkId} value={l.linkId}>{l.financeArtifactType} · {l.financeArtifactId}</option>))}
            </select>
            {linkError ? <p id="roi-recon-link-error" className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Wybierz powiązanie Finance' : 'Select a finance link'}</p> : null}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-recon-roi-value">{isPolish ? 'Wartość ROI (wymagana)' : 'ROI value (required)'}</label>
            <input id="roi-recon-roi-value" type="number" value={roiValue} onChange={(e) => setRoiValue(e.target.value)} className={FIELD_CLASS} data-testid="roi-recon-roi-value" aria-invalid={roiError || undefined} aria-describedby={roiError ? 'roi-recon-roi-value-error' : undefined} />
            {roiError ? <p id="roi-recon-roi-value-error" className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Wartość ROI jest wymagana' : 'ROI value is required'}</p> : null}
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-recon-finance-value">{isPolish ? 'Wartość Finance (wymagana)' : 'Finance value (required)'}</label>
            <input id="roi-recon-finance-value" type="number" value={financeValue} onChange={(e) => setFinanceValue(e.target.value)} className={FIELD_CLASS} data-testid="roi-recon-finance-value" aria-invalid={financeError || undefined} aria-describedby={financeError ? 'roi-recon-finance-value-error' : undefined} />
            {financeError ? <p id="roi-recon-finance-value-error" className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Wartość Finance jest wymagana' : 'Finance value is required'}</p> : null}
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-recon-divergence">{isPolish ? 'Powód rozbieżności' : 'Divergence reason'}</label>
          <textarea id="roi-recon-divergence" value={divergenceReason} onChange={(e) => setDivergenceReason(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-recon-divergence" />
        </div>
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-finance-reconciliation-error" />
      </div>
    </Modal>
  );
};

// ==========================================================================
// Finance reconciliation — status update
// ==========================================================================

export interface RoiFinanceReconciliationStatusModalProps {
  open: boolean;
  currentStatus: RoiFinanceReconciliationStatus;
  onClose: () => void;
  onSubmit: (values: Omit<UpdateRoiFinanceReconciliationStatusInput, 'expectedVersion'>) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}
export const RoiFinanceReconciliationStatusModal: React.FC<RoiFinanceReconciliationStatusModalProps> = ({
  open, currentStatus, onClose, onSubmit, isPolish, busy = false, errorMessage = null, isConflict = false,
}) => {
  const [status, setStatus] = useState<RoiFinanceReconciliationStatus>(currentStatus);
  const [resolutionNotes, setResolutionNotes] = useState('');
  useEffect(() => { if (!open) return; setStatus(currentStatus); setResolutionNotes(''); }, [open, currentStatus]);
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={isPolish ? 'Zmień status rekoncyliacji' : 'Change reconciliation status'} size="sm" preventOverlayClose={busy} preventEscapeClose={busy}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
        <button type="button" onClick={() => onSubmit({ status, resolutionNotes: resolutionNotes.trim() || null, reason: null })} disabled={busy} data-testid="roi-recon-status-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
          <span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : (isPolish ? 'Zapisz' : 'Save')}</span>
        </button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-recon-status-select">{isPolish ? 'Status' : 'Status'}</label>
          <select id="roi-recon-status-select" value={status} onChange={(e) => setStatus(e.target.value as RoiFinanceReconciliationStatus)} className={FIELD_CLASS} data-testid="roi-recon-status-select">
            {ROI_FINANCE_RECONCILIATION_STATUSES.map((s) => (<option key={s} value={s}>{roiFinanceReconciliationStatusLabel(s, isPolish)}</option>))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-recon-status-notes">{isPolish ? 'Notatki rozwiązania' : 'Resolution notes'}</label>
          <textarea id="roi-recon-status-notes" value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-recon-status-notes" />
        </div>
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-recon-status-error" />
      </div>
    </Modal>
  );
};
