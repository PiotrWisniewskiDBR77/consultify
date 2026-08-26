/**
 * CriterionWorkspace — ekran, na którym audytor faktycznie wykonuje audyt
 * jednego kryterium. Prowadzi przez cały łańcuch osiemnastu ogniw (patrz
 * `CriterionChain.tsx`), każde jako OSOBNA sekcja — nigdy zlane w jeden
 * formularz „odpowiedź" (mandat W1, `CLAUDE.md`).
 *
 * Trasa: `/audit-programs/method/:programId/criteria/:criterionId` (za
 * `BetaGate MODULE_AUDITS` + flagą `auditsFiveSurfacesV1`, jak sąsiedni
 * `/audit-programs/method`).
 *
 * ROLE: widoczność KAŻDEJ akcji merytorycznej wynika z `capabilities`,
 * policzonych z ról zwróconych przez `GET /audits/programs/:id/members`
 * (mirror macierzy `permissions.ts` w `workspaceApi.ts` — patrz komentarz
 * tamtego pliku o statusie „UI-podpowiedź, serwer bramkuje ponownie"). Gdy
 * akcja jest niedostępna, ekran pokazuje DLACZEGO (tekst), nigdy nie chowa
 * przycisku bez słowa.
 *
 * SEGREGACJA OBOWIĄZKÓW widoczna tu wprost: audytowany, który sam odpowiadał
 * na to kryterium (`criterion.auditeeRespondedBy === currentUserId`), nie
 * dostaje przycisku „wyciągnij wniosek" (mirror
 * `assertNotConcludingOwnResponse`, `permissions.ts`).
 */
import { AlertCircle } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ErrorState, LoadingState, SaveStateIndicator, type SaveStatus } from '@/components/shared/states';
import { StatusChip } from '@/components/ui/primitives/chips';
import { useAppStore } from '@/store/useAppStore';

import { CriterionChain } from './CriterionChain';
import { EvidencePanel } from './EvidencePanel';
import { FindingPanel } from './FindingPanel';
import { RemediationPanel } from './RemediationPanel';
import { TeresaProposalCard } from './TeresaProposalCard';
import {
  buildChainLinks,
  REMEDIATION_LABELS_EN,
  REMEDIATION_LABELS_PL,
  REMEDIATION_LINK_IDS,
} from './chainLinks';
import * as workspaceApi from './workspaceApi';
import type {
  ConformityStatus,
  CriterionDetail,
  TestResult,
  WorkspaceCapability,
  WorkspaceFindingDetail,
} from './workspaceApi';

export const CriterionWorkspace: React.FC = () => {
  const params = useParams<{ programId: string; criterionId: string }>();
  const programId = params.programId ?? '';
  const criterionId = params.criterionId ?? '';

  const currentUser = useAppStore((s) => s.currentUser);
  const currentUserId = currentUser?.id ?? null;
  const isPolish = true; // ekran roboczy audytora — treść PO POLSKU (mandat CLAUDE.md); i18n hook nieużywany celowo.

  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);

  const [detail, setDetail] = useState<CriterionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [capabilities, setCapabilities] = useState<Set<WorkspaceCapability>>(new Set());
  const [rolesLoaded, setRolesLoaded] = useState(false);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const [auditeeResponseDraft, setAuditeeResponseDraft] = useState('');
  const [procedurePerformed, setProcedurePerformed] = useState('');
  const [sampleDescription, setSampleDescription] = useState('');
  const [testPerformed, setTestPerformed] = useState('');
  const [testResult, setTestResult] = useState<TestResult | ''>('');
  const [auditorConclusion, setAuditorConclusion] = useState('');
  const [conformityChoice, setConformityChoice] = useState<ConformityStatus | ''>('');

  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [selectedFindingDetail, setSelectedFindingDetail] = useState<WorkspaceFindingDetail | null>(null);

  const load = useCallback(() => {
    if (!criterionId) return;
    setLoading(true);
    setError(null);
    workspaceApi
      .getCriterion(criterionId)
      .then((res) => {
        if (!res) {
          setError(t('Kryterium audytu nie zostało znalezione', 'Audit criterion not found'));
          return;
        }
        setDetail(res);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : t('Nie udało się wczytać kryterium', 'Could not load the criterion'))
      )
      .finally(() => setLoading(false));
  }, [criterionId, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!programId || !currentUserId) return;
    let cancelled = false;
    workspaceApi
      .getProgramMembers(programId)
      .then((members) => {
        if (cancelled) return;
        const myRoles = members.filter((m) => m.userId === currentUserId).map((m) => m.memberRole);
        setCapabilities(workspaceApi.capabilitiesForRoles(myRoles));
      })
      .catch(() => {
        if (!cancelled) setCapabilities(new Set());
      })
      .finally(() => {
        if (!cancelled) setRolesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [programId, currentUserId]);

  useEffect(() => {
    if (detail?.criterion) {
      setAuditeeResponseDraft(detail.criterion.auditeeResponse ?? '');
      setProcedurePerformed(detail.criterion.procedurePerformed ?? '');
      setSampleDescription(detail.criterion.sampleDescription ?? '');
      setTestPerformed(detail.criterion.testPerformed ?? '');
      setTestResult(detail.criterion.testResult ?? '');
      setAuditorConclusion(detail.criterion.auditorConclusion ?? '');
    }
  }, [detail?.criterion]);

  const criterion = detail?.criterion ?? null;
  const hasAcceptedEvidence = useMemo(
    () => (detail?.evidence ?? []).some((e) => e.accepted === true),
    [detail?.evidence]
  );

  // Domyślny wybór formularza wniosku: brak zaakceptowanego dowodu proponuje
  // `evidence_insufficient`, NIGDY `nonconforming` z automatu (test #6 pakietu
  // robotnika — audyt nie może cicho zamienić braku dowodu w niezgodność).
  useEffect(() => {
    if (!criterion) return;
    if (conformityChoice) return;
    setConformityChoice(hasAcceptedEvidence ? 'nonconforming' : 'evidence_insufficient');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criterion?.id, hasAcceptedEvidence]);

  const isOwnAuditeeResponse = !!criterion && !!currentUserId && criterion.auditeeRespondedBy === currentUserId;

  const canRespondAsAuditee = capabilities.has('criterion.respond_as_auditee');
  const canPerformTest = capabilities.has('criterion.perform_test');
  const canConclude = capabilities.has('criterion.conclude');
  const canProposeAi = capabilities.has('ai.propose');
  const canCommitAi = capabilities.has('ai.commit');

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setSaveStatus('saving');
    try {
      await fn();
      setSaveStatus('saved');
    } catch (e: unknown) {
      setSaveStatus('error');
    }
  }, []);

  const handleSubmitAuditeeResponse = useCallback(() => {
    if (!criterionId || !auditeeResponseDraft.trim()) return;
    run(() => workspaceApi.submitAuditeeResponse(criterionId, auditeeResponseDraft.trim()).then(() => load()));
  }, [criterionId, auditeeResponseDraft, run, load]);

  const handleRecordTest = useCallback(() => {
    if (!criterionId) return;
    run(() =>
      workspaceApi
        .recordTest(criterionId, {
          procedurePerformed: procedurePerformed.trim() || null,
          sampleDescription: sampleDescription.trim() || null,
          testPerformed: testPerformed.trim() || null,
          testResult: testResult || null,
        })
        .then(() => load())
    );
  }, [criterionId, procedurePerformed, sampleDescription, testPerformed, testResult, run, load]);

  const handleConclude = useCallback(() => {
    if (!criterionId || !conformityChoice) return;
    run(() =>
      workspaceApi
        .concludeCriterion(criterionId, {
          auditorConclusion: auditorConclusion.trim() || null,
          conformityStatus: conformityChoice,
        })
        .then(() => load())
    );
  }, [criterionId, conformityChoice, auditorConclusion, run, load]);

  const chainLinks = useMemo(
    () =>
      buildChainLinks({
        criterion,
        findings: detail?.findings,
        hasAcceptedEvidence,
        selectedFindingId,
        selectedFindingDetail,
        isPolish,
        t,
      }),
    [criterion, detail?.findings, hasAcceptedEvidence, selectedFindingId, selectedFindingDetail, isPolish, t]
  );

  if (loading) {
    return <LoadingState template="panel" label={t('Wczytywanie kryterium…', 'Loading criterion…')} />;
  }

  if (error || !criterion) {
    return (
      <ErrorState
        title={t('Nie udało się wczytać kryterium', 'Could not load the criterion')}
        description={error || t('Kryterium nie istnieje.', 'The criterion does not exist.')}
        onRetry={load}
      />
    );
  }

  return (
    <div data-testid="criterion-workspace" className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          {criterion.refCode && <span className="font-mono text-xs text-c-text-muted">{criterion.refCode}</span>}
          <h2 className="text-lg font-semibold text-c-text">{criterion.title}</h2>
          <StatusChip label={criterion.conformityStatus} tone={criterion.conformityStatus === 'conforming' ? 'success' : criterion.conformityStatus === 'nonconforming' ? 'danger' : 'neutral'} />
        </div>
        <SaveStateIndicator status={saveStatus} />
        {!rolesLoaded && (
          <p className="text-xs text-c-text-muted">{t('Wczytywanie uprawnień…', 'Loading permissions…')}</p>
        )}
      </header>

      <CriterionChain links={chainLinks} isPolish={isPolish} />

      {/* Ogniwo 1: kryterium/źródło */}
      <section data-testid="chain-link-kryterium-zrodlo" className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">{t('Kryterium / źródło', 'Criterion / source')}</h3>
        <p className="text-sm text-c-text">{criterion.requirementText || t('Brak sformułowanego wymagania.', 'No requirement text yet.')}</p>
        {criterion.sourceReference && <p className="text-xs text-c-text-muted">{criterion.sourceReference}</p>}
      </section>

      {/* Ogniwo 2: pytanie audytowe */}
      <section data-testid="chain-link-pytanie-audytowe" className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">{t('Pytanie audytowe', 'Audit question')}</h3>
        <p className="text-sm text-c-text">{criterion.auditQuestion || t('Brak zdefiniowanego pytania audytowego.', 'No audit question defined.')}</p>
      </section>

      {/* Ogniwo 3: oczekiwany dowód */}
      <section data-testid="chain-link-oczekiwany-dowod" className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">{t('Oczekiwany dowód', 'Expected evidence')}</h3>
        {criterion.expectedEvidence.length === 0 ? (
          <p className="text-sm text-c-text-muted">{t('Pakiet nie zdefiniował oczekiwanego dowodu.', 'The pack does not define expected evidence.')}</p>
        ) : (
          <ul className="list-disc space-y-0.5 pl-4 text-sm text-c-text">
            {criterion.expectedEvidence.map((e, i) => (
              <li key={i}>
                {e.description} {e.mandatory ? <span className="text-c-text-muted">({t('wymagany', 'required')})</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ogniwo 4: dostarczony dowód */}
      <section data-testid="chain-link-dostarczony-dowod" className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">{t('Dostarczony dowód', 'Provided evidence')}</h3>
        <EvidencePanel programId={programId} criterionId={criterionId} capabilities={capabilities} isPolish={isPolish} onEvidenceChanged={load} />
      </section>

      {/* Ogniwa 5-8: procedura audytora / próba / wykonany test / wynik testu */}
      {!criterion.applicable ? (
        <section data-testid="chain-link-procedura-audytora" className="rounded-token-md border border-c-border-subtle p-3">
          <p className="flex items-center gap-2 text-xs text-c-text-muted">
            <AlertCircle size={14} aria-hidden />
            {t('Kryterium oznaczone jako „nie dotyczy" — próba i test są nieosiągalne.', 'Criterion marked "not applicable" — sampling and testing are unreachable.')}
          </p>
        </section>
      ) : (
        <>
          <section data-testid="chain-link-procedura-audytora" className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">{t('Procedura audytora', "Auditor's procedure")}</h3>
            <textarea
              value={procedurePerformed}
              onChange={(e) => setProcedurePerformed(e.target.value)}
              disabled={!canPerformTest}
              aria-label={t('Procedura audytora', "Auditor's procedure")}
              className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text disabled:opacity-60"
              rows={2}
            />
          </section>

          <section data-testid="chain-link-proba" className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">{t('Próba', 'Sample')}</h3>
            <textarea
              value={sampleDescription}
              onChange={(e) => setSampleDescription(e.target.value)}
              disabled={!canPerformTest}
              aria-label={t('Próba', 'Sample')}
              className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text disabled:opacity-60"
              rows={2}
            />
          </section>

          <section data-testid="chain-link-wykonany-test" className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">{t('Wykonany test', 'Test performed')}</h3>
            <textarea
              value={testPerformed}
              onChange={(e) => setTestPerformed(e.target.value)}
              disabled={!canPerformTest}
              aria-label={t('Wykonany test', 'Test performed')}
              className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text disabled:opacity-60"
              rows={2}
            />
          </section>

          <section data-testid="chain-link-wynik-testu" className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">{t('Wynik testu', 'Test result')}</h3>
            <select
              value={testResult}
              onChange={(e) => setTestResult(e.target.value as TestResult)}
              disabled={!canPerformTest}
              aria-label={t('Wynik testu', 'Test result')}
              className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text disabled:opacity-60"
            >
              <option value="">—</option>
              <option value="pass">pass</option>
              <option value="fail">fail</option>
              <option value="partial">partial</option>
              <option value="inconclusive">inconclusive</option>
            </select>
            {canPerformTest ? (
              <button
                type="button"
                onClick={handleRecordTest}
                disabled={saveStatus === 'saving'}
                className="rounded-token-md border border-c-border bg-c-surface px-3 py-1.5 text-xs font-medium text-c-text hover:bg-c-surface-raised"
              >
                {t('Zapisz procedurę i wynik testu', 'Save procedure and test result')}
              </button>
            ) : (
              <p className="text-xs text-c-text-muted">
                {t('Wykonanie testu wymaga roli audytora.', 'Performing the test requires the auditor role.')}
              </p>
            )}
          </section>
        </>
      )}

      {/* Ogniwo 9: wniosek audytora */}
      <section data-testid="chain-link-wniosek-audytora" className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">{t('Wniosek audytora', "Auditor's conclusion")}</h3>
        {!criterion.testResult ? (
          <p className="text-xs text-c-text-muted">
            {t('Nieosiągalne: wymaga wcześniej wykonanej procedury testowej (wynik testu).', 'Unreachable: requires a recorded test result first.')}
          </p>
        ) : (
          <textarea
            value={auditorConclusion}
            onChange={(e) => setAuditorConclusion(e.target.value)}
            disabled={!canConclude}
            aria-label={t('Wniosek audytora', "Auditor's conclusion")}
            className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text disabled:opacity-60"
            rows={2}
          />
        )}
      </section>

      {/* Ogniwo 10: status zgodności */}
      <section data-testid="chain-link-status-zgodnosci" className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">{t('Status zgodności', 'Conformity status')}</h3>
        {!criterion.testResult ? (
          <p className="text-xs text-c-text-muted">
            {t('Nieosiągalne: wymaga wcześniej wykonanej procedury testowej (wynik testu).', 'Unreachable: requires a recorded test result first.')}
          </p>
        ) : isOwnAuditeeResponse ? (
          <p className="text-xs text-c-text-muted">
            {t(
              'Nie możesz wyciągnąć wniosku dla kryterium, na które sam odpowiadałeś jako strona audytowana.',
              'You cannot conclude a criterion you yourself answered as the auditee.'
            )}
          </p>
        ) : !canConclude ? (
          <p className="text-xs text-c-text-muted">
            {t('Wyciągnięcie wniosku wymaga roli audytora/lead auditora.', 'Concluding requires the auditor/lead auditor role.')}
          </p>
        ) : (
          <>
            <select
              value={conformityChoice}
              onChange={(e) => setConformityChoice(e.target.value as ConformityStatus)}
              aria-label={t('Status zgodności', 'Conformity status')}
              className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
            >
              {workspaceApi.CONFORMITY_STATUSES.filter((s) => s !== 'not_tested').map((s) => (
                <option key={s} value={s} disabled={s === 'conforming' && !hasAcceptedEvidence}>
                  {s}
                  {s === 'conforming' && !hasAcceptedEvidence
                    ? ` — ${t('wymaga zaakceptowanego dowodu', 'requires accepted evidence')}`
                    : ''}
                </option>
              ))}
            </select>
            {!hasAcceptedEvidence && (
              <p className="text-xs text-c-text-muted">
                {t(
                  'Brak zaakceptowanego dowodu — sugerowany wniosek to „evidence_insufficient", nie automatyczna niezgodność.',
                  'No accepted evidence — the suggested conclusion is "evidence_insufficient", not an automatic nonconformity.'
                )}
              </p>
            )}
            <button
              type="button"
              onClick={handleConclude}
              disabled={!conformityChoice || saveStatus === 'saving'}
              className="rounded-token-md border border-c-border bg-c-surface px-3 py-1.5 text-xs font-medium text-c-text hover:bg-c-surface-raised"
            >
              {t('Wyciągnij wniosek', 'Conclude')}
            </button>
          </>
        )}
      </section>

      {/* Odpowiedź audytowanego — nie jest jednym z 18 ogniw wprost, ale jest
          niezbędnym wejściem do „ustalenia"; renderowana obok ogniwa 4/9 jako
          osobna, jawnie podpisana sekcja (nie zlana z żadnym innym polem). */}
      <section data-testid="chain-link-odpowiedz-audytowanego" className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">{t('Odpowiedź audytowanego', 'Auditee response')}</h3>
        {canRespondAsAuditee ? (
          <>
            <textarea
              value={auditeeResponseDraft}
              onChange={(e) => setAuditeeResponseDraft(e.target.value)}
              aria-label={t('Odpowiedź audytowanego', 'Auditee response')}
              className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
              rows={2}
            />
            <button
              type="button"
              onClick={handleSubmitAuditeeResponse}
              disabled={!auditeeResponseDraft.trim() || saveStatus === 'saving'}
              className="rounded-token-md border border-c-border bg-c-surface px-3 py-1.5 text-xs font-medium text-c-text hover:bg-c-surface-raised"
            >
              {t('Wyślij odpowiedź', 'Submit response')}
            </button>
          </>
        ) : (
          <p className="text-sm text-c-text-muted">{criterion.auditeeResponse || t('Brak odpowiedzi audytowanego.', 'No auditee response yet.')}</p>
        )}
      </section>

      <TeresaProposalCard
        label={t('Teresa: wyjaśnij kryterium', 'Teresa: explain the criterion')}
        programId={programId}
        targetType="criterion"
        targetId={criterionId}
        intent="explain_criterion"
        canPropose={canProposeAi}
        canCommit={canCommitAi}
        isPolish={isPolish}
        onCommitted={load}
      />

      {/* Ogniwa 11-12: ustalenie / odpowiedź właściciela */}
      <section data-testid="chain-link-ustalenie" className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">{t('Ustalenie i odpowiedź właściciela', 'Finding and management response')}</h3>
        <FindingPanel
          programId={programId}
          criterionId={criterionId}
          capabilities={capabilities}
          currentUserId={currentUserId}
          isPolish={isPolish}
          selectedFindingId={selectedFindingId}
          onSelectFinding={setSelectedFindingId}
          onFindingDetailChange={setSelectedFindingDetail}
          onFindingsChanged={load}
        />
      </section>
      <section data-testid="chain-link-odpowiedz-wlasciciela" className="sr-only" />

      {/* Ogniwa 13-18: naprawa */}
      {selectedFindingDetail ? (
        <RemediationPanel
          programId={programId}
          isPolish={isPolish}
          capabilities={capabilities}
          currentUserId={currentUserId}
          finding={selectedFindingDetail}
          onChanged={() => {
            load();
          }}
        />
      ) : (
        <div className="space-y-2">
          {REMEDIATION_LINK_IDS.map((id) => (
            <section key={id} data-testid={`chain-link-${id}`} aria-label={isPolish ? REMEDIATION_LABELS_PL[id] : REMEDIATION_LABELS_EN[id]}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                {isPolish ? REMEDIATION_LABELS_PL[id] : REMEDIATION_LABELS_EN[id]}
              </h4>
              <p className="text-xs text-c-text-muted">
                {t('Wybierz ustalenie powyżej, aby zobaczyć ten krok naprawczy.', 'Select a finding above to see this remediation step.')}
              </p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default CriterionWorkspace;
