/**
 * H1b — SKRZYNKA RECENZENTA (Inicjatywy → „Do akceptacji").
 *
 * DLACZEGO MIESZKA W INICJATYWACH, a nie w Realizacji ani w Mojej Pracy:
 * przedmiotem decyzji jest ETAP INICJATYWY (DEC-490 — 12 etapów silnika jedyną
 * prawdą), a nie zadanie ani wpis w Banku Realizacji. Recenzent ogląda tu
 * przejście `z → do` wraz z inicjatywą, której dotyczy, i po zatwierdzeniu
 * widzi tę samą inicjatywę w tym samym module na nowym etapie (DEC-453:
 * „widać i da się zmienić").
 *
 * CO TO JEST, A CZYM NIE JEST: to PRZEWÓD do istniejącego silnika. Ekran nie
 * liczy żadnej prowenancji — sha-256 `sourceDigest`, `a05ApprovalReceiptRef`,
 * `baselineRefs` i `idempotencyKey` wylicza serwer z zapisanej propozycji.
 * „Zatwierdź" zapisuje recenzję A05 i wywołuje istniejące
 * `POST /:id/lifecycle-transition-executions`; „Odrzuć z powodem" zapisuje samą
 * recenzję odmowną i NIE wykonuje żadnego przejścia.
 *
 * KANON: lista = `StandardTable` w `TableWithPreviewLayout`, podgląd =
 * `StandardPreview` (6 bloków; akcje wyłącznie przez `StandardPreviewActions`,
 * moduł nie stylizuje przycisków). Zero własnej tabeli, zero `primary-*`.
 */
import type { TFunction } from 'i18next';
import { Check, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StandardPreview } from '@/components/standard/StandardPreview';
import { StandardTable } from '@/components/standard/StandardTable';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  approveTransitionProposal,
  listTransitionProposals,
  rejectTransitionProposal,
  type TransitionProposal,
} from '@/services/initiativeTransitionInboxApi';

import { humanizeKey, initiativeStatusLabel } from './initiativeStatusLabels';
import { InitiativeReasonDialog } from './lifecycle/InitiativeReasonDialog';

/**
 * Etykieta obszaru nadzoru PMO (`pmoDomain`) — CZTERY kody z
 * `INITIATIVE_LIFECYCLE_GATE_DOMAINS` (server/src/services/initiative/
 * initiativeLifecycleGateDecisionService.ts). Surowy kod zostaje w `title`
 * (tooltip) — na ekranie tylko tłumaczenie (kanon §7.3: zero surowych kluczy
 * UPPER_SNAKE w preview/tabeli).
 */
const pmoDomainLabel = (t: TFunction, raw: string): string => {
  const key = raw.trim().toUpperCase();
  const map: Record<string, string> = {
    SCHEDULE_MILESTONES: t(
      'initiatives.transitionInbox.pmoDomain.scheduleMilestones',
      'Schedule & milestones'
    ),
    RESOURCE_RESPONSIBILITY: t(
      'initiatives.transitionInbox.pmoDomain.resourceResponsibility',
      'Resources & responsibility'
    ),
    GOVERNANCE_DECISION_MAKING: t(
      'initiatives.transitionInbox.pmoDomain.governanceDecisionMaking',
      'Governance decision'
    ),
    CLOSURE: t('initiatives.transitionInbox.pmoDomain.closure', 'Closure'),
  };
  return map[key] ?? humanizeKey(raw);
};

export interface TransitionInboxSurfaceProps {
  /**
   * Wstrzyknięte wiersze — używane WYŁĄCZNIE przez harness zrzutowy
   * (dev-render), żeby zrobić zdjęcie ekranu bez logowania i bez bazy.
   * W aplikacji zostaje `undefined` i dane idą z API.
   */
  proposalsOverride?: TransitionProposal[];
}

type PendingDecision = { proposal: TransitionProposal; decision: 'approve' | 'reject' };

const dateLabel = (value: string, language: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-GB', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });
};

export const TransitionInboxSurface: React.FC<TransitionInboxSurfaceProps> = ({
  proposalsOverride,
}) => {
  const { t, i18n } = useTranslation();
  const [proposals, setProposals] = useState<TransitionProposal[]>(proposalsOverride ?? []);
  const [loading, setLoading] = useState(!proposalsOverride);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDecision | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (proposalsOverride) return;
    setLoading(true);
    try {
      const rows = await listTransitionProposals('pending');
      setProposals(rows);
      setError(null);
    } catch (err) {
      /* Kanon: błąd wjeżdża NA EKRAN. Pusta tabela po cichu udawałaby
         „nic nie czeka na twoją decyzję" — najgorsze możliwe kłamstwo
         w skrzynce zatwierdzeń. */
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [proposalsOverride]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const statusLabel = useCallback(
    (proposal: TransitionProposal) => {
      if (proposal.reviewDecision === 'rejected')
        return t('initiatives.transitionInbox.status.rejected', 'Rejected');
      if (proposal.executable)
        return t('initiatives.transitionInbox.status.approved', 'Approved — ready to apply');
      return t('initiatives.transitionInbox.status.pending', 'Awaiting your decision');
    },
    [t]
  );

  const rows = useMemo(
    () =>
      proposals.map((proposal) => ({
        ...proposal,
        id: proposal.proposalVersionId,
        /* `TableWithPreviewLayout` bierze nagłówek panelu z `item.title`
           (bez tego pola pisze generyczne „Record" — tak właśnie wyglądał
           pierwszy zrzut). Tytułem jest INICJATYWA, bo to jej etap się zmienia. */
        title: proposal.initiativeName || proposal.initiativeId,
        /* Kanon §7.3: zero surowych kodów UPPER_SNAKE na ekranie — etykieta
           tłumaczona przez `initiativeStatusLabel` (ta sama mapa co
           `InitiativePreviewV3`), kod surowy zostaje w `transitionTitle`
           (tooltip/`title`, nie znika — recenzent może go zweryfikować). */
        transition: `${initiativeStatusLabel(t, proposal.fromStatus)} → ${initiativeStatusLabel(t, proposal.toStatus)}`,
        transitionTitle: `${proposal.fromStatus} → ${proposal.toStatus}`,
        domainLabel: pmoDomainLabel(t, proposal.pmoDomain),
        createdLabel: dateLabel(proposal.createdAt, i18n.language),
        statusText: statusLabel(proposal),
      })),
    [proposals, i18n.language, statusLabel, t]
  );

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const runDecision = useCallback(
    async (reason: string) => {
      if (!pending) return;
      setBusy(true);
      try {
        if (pending.decision === 'approve') await approveTransitionProposal(pending.proposal, reason);
        else await rejectTransitionProposal(pending.proposal, reason);
        setPending(null);
        setSelectedId(null);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPending(null);
      } finally {
        setBusy(false);
      }
    },
    [pending, refresh]
  );

  return (
    <section
      aria-label={t('initiatives.transitionInbox.sectionAria', 'Transition approvals')}
      className="h-full min-h-0"
      data-testid="initiatives-transition-inbox"
    >
      {error && (
        <div
          className="mx-4 mb-2 rounded-md border border-c-border bg-c-surface-2 px-3 py-2 text-sm text-c-text"
          data-testid="initiatives-transition-inbox-error"
          role="status"
        >
          {t('initiatives.transitionInbox.error', 'Could not load transition approvals:')} {error}
        </div>
      )}
      <TableWithPreviewLayout<(typeof rows)[number]>
        selectedId={selectedId}
        selectedItem={selected}
        onSelect={setSelectedId}
        itemIds={rows.map((row) => row.id)}
        getItemById={(id) => rows.find((row) => row.id === id) ?? null}
        previewOpen={Boolean(selected)}
        /* Kanon FIX-1: przycisk „Otwórz" ma się renderować WYŁĄCZONY z powodem,
           a nie milczeć — propozycja nie jest artefaktem z własną trasą. */
        openDisabledReason={t(
          'initiatives.transitionInbox.openDisabled',
          'A proposal has no document of its own — it changes the stage of the initiative above.'
        )}
        renderPreview={(row) => (
          <StandardPreview
            embedded
            title={row.initiativeName || row.initiativeId}
            onClose={() => setSelectedId(null)}
            /* Brak trasy do „obiektu propozycji" — propozycja nie jest
               artefaktem, tylko wnioskiem o zmianę etapu inicjatywy. Kanon
               FIX-1: powiedz to wprost zamiast milczeć o przycisku. */
            openDisabledReason={t(
              'initiatives.transitionInbox.openDisabled',
              'A proposal has no document of its own — it changes the stage of the initiative above.'
            )}
            meta={{
              pills: [
                { label: row.statusText, tone: 'neutral' },
                { label: row.transition, tone: 'neutral' },
              ],
              trailing: t('initiatives.transitionInbox.expires', 'Valid until {{date}}', {
                date: dateLabel(row.expiresAt, i18n.language),
              }),
            }}
            details={{
              label: t('initiatives.transitionInbox.whyLabel', 'Why'),
              text: row.reason || t('initiatives.transitionInbox.noReason', 'No reason given.'),
              properties: [
                {
                  id: 'initiative',
                  label: t('initiatives.transitionInbox.columns.initiative', 'Initiative'),
                  value: row.initiativeName || row.initiativeId,
                },
                {
                  id: 'transition',
                  label: t('initiatives.transitionInbox.columns.transition', 'Transition'),
                  value: <span title={row.transitionTitle}>{row.transition}</span>,
                },
                {
                  id: 'proposer',
                  label: t('initiatives.transitionInbox.columns.proposer', 'Proposed by'),
                  value: row.proposerName || row.proposerUserId,
                },
                {
                  id: 'createdAt',
                  label: t('initiatives.transitionInbox.columns.createdAt', 'Proposed on'),
                  value: row.createdLabel,
                },
                {
                  id: 'domain',
                  label: t('initiatives.transitionInbox.columns.domain', 'Governance area'),
                  value: <span title={row.pmoDomain}>{row.domainLabel}</span>,
                },
              ],
            }}
            actions={{
              resolutions: [
                {
                  id: 'approve',
                  variant: 'positive',
                  label: t('initiatives.transitionInbox.approve', 'Approve'),
                  icon: Check,
                  shortcut: 'A',
                  disabled: !row.viewerIsReviewer || busy,
                  onClick: () => setPending({ proposal: row, decision: 'approve' }),
                },
                {
                  id: 'reject',
                  variant: 'destructive',
                  label: t('initiatives.transitionInbox.reject', 'Reject with a reason'),
                  icon: X,
                  shortcut: 'R',
                  disabled: !row.viewerIsReviewer || busy || row.executable,
                  onClick: () => setPending({ proposal: row, decision: 'reject' }),
                },
              ],
            }}
          />
        )}
      >
        <StandardTable
          columns={[
            {
              id: 'initiativeName',
              label: t('initiatives.transitionInbox.columns.initiative', 'Initiative'),
              sortable: true,
              render: (row: any) => row.initiativeName || row.initiativeId,
            },
            {
              id: 'transition',
              label: t('initiatives.transitionInbox.columns.transition', 'Transition'),
              render: (row: any) => <span title={row.transitionTitle}>{row.transition}</span>,
            },
            {
              id: 'proposerName',
              label: t('initiatives.transitionInbox.columns.proposer', 'Proposed by'),
              sortable: true,
              render: (row: any) => row.proposerName || row.proposerUserId,
            },
            {
              id: 'createdLabel',
              label: t('initiatives.transitionInbox.columns.createdAt', 'Proposed on'),
              sortable: true,
            },
            {
              id: 'statusText',
              label: t('common.status', 'Status'),
            },
          ]}
          data={rows as any}
          loading={loading}
          selectedRowId={selectedId}
          onRowClick={(row: any) => setSelectedId(String(row.id))}
          empty={{
            title: t('initiatives.transitionInbox.emptyTitle', 'Nothing to approve'),
            description: t(
              'initiatives.transitionInbox.emptyDescription',
              'Stage changes proposed by someone else land here. You will see the initiative, the transition and the reason before you decide.'
            ),
          }}
        />
      </TableWithPreviewLayout>

      <InitiativeReasonDialog
        open={Boolean(pending)}
        busy={busy}
        destructive={pending?.decision === 'reject'}
        title={
          pending?.decision === 'reject'
            ? t('initiatives.transitionInbox.rejectTitle', 'Reject this transition')
            : t('initiatives.transitionInbox.approveTitle', 'Approve this transition')
        }
        confirmLabel={
          pending?.decision === 'reject'
            ? t('initiatives.transitionInbox.reject', 'Reject with a reason')
            : t('initiatives.transitionInbox.approve', 'Approve')
        }
        onCancel={() => setPending(null)}
        onConfirm={(reason) => void runDecision(reason)}
      />
    </section>
  );
};

export default TransitionInboxSurface;
