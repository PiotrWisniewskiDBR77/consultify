/**
 * CommissionView
 *
 * Commission portal with AI-powered intelligence and PMO compliance
 * Aligned with BENEFITS_REALIZATION PMO domain
 */

import { AlertTriangle, FileText, HelpCircle } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { PMODomainBadge } from '../../components/Partner/EcosystemAnalytics';
import { Api } from '../../services/api';
import {
  shouldFallbackToLegacyPartner,
  V8PartnerApi,
  type V8PartnerCommissionTransaction,
  type V8PartnerPayoutHistoryItem,
} from '../../services/api/v8';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';
import { type CommissionStatement, PARTNER_PMO_MAPPING } from './types';

function formatStatementPeriod(start?: string, end?: string): string {
  const startLabel = typeof start === 'string' ? start.slice(0, 10) : '';
  const endLabel = typeof end === 'string' ? end.slice(0, 10) : '';

  if (startLabel && endLabel) {
    return `${startLabel} - ${endLabel}`;
  }

  return startLabel || endLabel || 'Commission statement';
}

function mapStatementStatus(status?: string): CommissionStatement['status'] {
  switch (String(status || '').toUpperCase()) {
    case 'COMPLETED':
    case 'PAID':
      return 'PAID';
    case 'PROCESSING':
    case 'APPROVED':
      return 'APPROVED';
    default:
      return 'PENDING';
  }
}

function buildLiveStatements(
  payouts: V8PartnerPayoutHistoryItem[],
  transactions: V8PartnerCommissionTransaction[]
): CommissionStatement[] {
  const payoutStatements: CommissionStatement[] = payouts.map((payout) => ({
    id: `payout:${payout.id}`,
    partnerId: 'partner-runtime',
    period: formatStatementPeriod(payout.periodStart, payout.periodEnd),
    totalAmount: Number(payout.netAmount ?? payout.grossAmount ?? 0),
    status: mapStatementStatus(payout.status),
    paidAt: payout.completedAt || undefined,
    paymentReference: payout.id,
    deals: [],
  }));

  const unsettledBuckets = new Map<
    string,
    {
      id: string;
      period: string;
      totalAmount: number;
      status: CommissionStatement['status'];
    }
  >();

  for (const tx of transactions) {
    if (tx.payoutId) continue;

    const period =
      typeof tx.transactionDate === 'string' ? tx.transactionDate.slice(0, 7) : 'Unscheduled';
    const status = mapStatementStatus(tx.status);
    const key = `${status}:${period}`;
    const bucket = unsettledBuckets.get(key);

    if (bucket) {
      bucket.totalAmount += Number(tx.commissionAmount ?? 0);
      continue;
    }

    unsettledBuckets.set(key, {
      id: `tx:${key}`,
      period,
      totalAmount: Number(tx.commissionAmount ?? 0),
      status,
    });
  }

  const unsettledStatements: CommissionStatement[] = Array.from(unsettledBuckets.values()).map(
    (bucket) => ({
      id: bucket.id,
      partnerId: 'partner-runtime',
      period: bucket.period,
      totalAmount: bucket.totalAmount,
      status: bucket.status,
      deals: [],
    })
  );

  return [...payoutStatements, ...unsettledStatements];
}

export const CommissionView: React.FC = () => {
  const { setCurrentView } = useAppStore();
  const [statements, setStatements] = useState<CommissionStatement[]>([]);
  const [statementsLoading, setStatementsLoading] = useState(true);

  const navigate = useCallback((view: AppView) => () => setCurrentView(view), [setCurrentView]);

  useEffect(() => {
    let cancelled = false;

    const loadStatements = async () => {
      setStatementsLoading(true);
      try {
        const [payouts, transactions] = await Promise.all([
          (async () => {
            try {
              const response = await V8PartnerApi.getPayouts();
              return Array.isArray(response?.payouts) ? response.payouts : [];
            } catch (error) {
              if (!shouldFallbackToLegacyPartner(error)) {
                throw error;
              }
              const response = await Api.get('/api/partners/payouts');
              return response?.success && Array.isArray(response?.data) ? response.data : [];
            }
          })(),
          (async () => {
            try {
              const response = await V8PartnerApi.getCommissionTransactions();
              return Array.isArray(response?.transactions) ? response.transactions : [];
            } catch (error) {
              if (!shouldFallbackToLegacyPartner(error)) {
                throw error;
              }
              const response = await Api.get('/api/partners/commission-transactions');
              return response?.success && Array.isArray(response?.data) ? response.data : [];
            }
          })(),
        ]);

        if (!cancelled) {
          setStatements(buildLiveStatements(payouts, transactions));
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[Partner] Failed to load commission statements:', error);
          setStatements([]);
        }
      } finally {
        if (!cancelled) {
          setStatementsLoading(false);
        }
      }
    };

    loadStatements();
    return () => {
      cancelled = true;
    };
  }, []);

  const statementSummary = useMemo(() => {
    return statements.reduce(
      (summary, statement) => {
        if (statement.status === 'PAID') {
          summary.paidAmount += statement.totalAmount;
          summary.paidCount += 1;
        } else if (statement.status === 'APPROVED') {
          summary.approvedAmount += statement.totalAmount;
          summary.approvedCount += 1;
        } else {
          summary.pendingAmount += statement.totalAmount;
          summary.pendingCount += 1;
        }

        return summary;
      },
      {
        paidAmount: 0,
        paidCount: 0,
        approvedAmount: 0,
        approvedCount: 0,
        pendingAmount: 0,
        pendingCount: 0,
      }
    );
  }, [statements]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-navy-950">
      <div className="space-y-6 px-6 py-4">
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/60 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Commission Runtime Summary
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Governed statement and payout readback for the active commission surface.
              </p>
            </div>
            <PMODomainBadge mapping={PARTNER_PMO_MAPPING.COMMISSION_SETTLEMENT} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Paid statements
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                ${statementSummary.paidAmount.toLocaleString()}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {statementSummary.paidCount} settled statement
                {statementSummary.paidCount === 1 ? '' : 's'}
              </div>
            </div>

            <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Approved statements
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                ${statementSummary.approvedAmount.toLocaleString()}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {statementSummary.approvedCount} awaiting payout
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Pending statements
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                ${statementSummary.pendingAmount.toLocaleString()}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {statementSummary.pendingCount} still under review
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="mt-0.5 text-amber-500" />
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  Deal intelligence unavailable on governed runtime
                </div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  This surface no longer shows placeholder deal pipeline projections. Commission
                  intelligence will return only after a real partner-authenticated deal-pipeline
                  contract lands.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statements Section */}
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/60 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <FileText size={20} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Commission Statements
                </h3>
                <p className="text-xs text-slate-600">Historical statements and payouts</p>
              </div>
            </div>
            <PMODomainBadge mapping={PARTNER_PMO_MAPPING.COMMISSION_SETTLEMENT} />
          </div>

          <div className="space-y-3">
            {statementsLoading && (
              <div className="rounded-xl bg-slate-50 dark:bg-navy-950/40 p-4 text-center text-sm text-slate-600">
                Loading commission statements...
              </div>
            )}

            {statements.map((statement) => (
              <div
                key={statement.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-navy-700 p-4"
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {statement.period}
                  </div>
                  <div className="text-xs text-slate-600">
                    {statement.paymentReference
                      ? `Ref ${statement.paymentReference}`
                      : statement.deals.length > 0
                        ? `${statement.deals.length} deal${statement.deals.length !== 1 ? 's' : ''}`
                        : 'Historical statement'}
                    {statement.paidAt &&
                      ` · Paid ${new Date(statement.paidAt).toLocaleDateString()}`}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      ${statement.totalAmount.toLocaleString()}
                    </div>
                    <div
                      className={`text-xs ${
                        statement.status === 'PAID'
                          ? 'text-emerald-500'
                          : statement.status === 'APPROVED'
                            ? 'text-blue-500'
                            : 'text-amber-500'
                      }`}
                    >
                      {statement.status}
                    </div>
                  </div>
                  <button className="rounded-xl border border-slate-200 dark:border-navy-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:border-brand/30">
                    View
                  </button>
                </div>
              </div>
            ))}

            {!statementsLoading && statements.length === 0 && (
              <div className="rounded-xl bg-slate-50 dark:bg-navy-950/40 p-4 text-center text-sm text-slate-600">
                No commission statements yet
              </div>
            )}
          </div>
        </div>

        {/* Inquiry Routing */}
        <div
          id="inquiry-form"
          className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/60 p-6"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <AlertTriangle size={20} className="text-amber-500" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Commission inquiry routing unavailable
              </h3>
              <p className="text-xs text-slate-600">
                This partner surface no longer pretends to submit inquiries without a governed
                partner-user support contract.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 p-4 text-sm text-slate-600 dark:text-slate-300">
              Review the governed statement history above and use partner resources for current
              commission guidance while inquiry routing remains outside the bounded partner runtime.
            </div>

            <button
              onClick={navigate(AppView.PARTNER_RESOURCES)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              Open Partner Resources
            </button>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/40 p-6">
          <div className="mb-4 flex items-center gap-2">
            <HelpCircle size={18} className="text-slate-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white">Commission FAQ</h3>
          </div>

          <div className="space-y-4 text-sm">
            <FaqItem
              question="Jak działa process payouts?"
              answer="Commission statements są generowane kwartalnie. Po zamknięciu kwartału, Finance Team weryfikuje wszystkie deals i generuje statement. Payout następuje w ciągu 30 dni od approval."
            />
            <FaqItem
              question="Co zrobić jeśli kwota jest nieprawidłowa?"
              answer="Użyj formularza inquiry powyżej, wybierając 'Statement question'. Dołącz numer statement i szczegóły rozbieżności. Finance Team odpowie w ciągu 2 dni roboczych."
            />
            <FaqItem
              question="Jak są mapowane deals do PMO standards?"
              answer="Każdy deal registration jest automatycznie mapowany do GOVERNANCE_DECISION_MAKING (ISO 21500 Clause 4.3.4), a commission settlement do BENEFITS_REALIZATION (Clause 4.4.1)."
            />
          </div>

          <button
            onClick={navigate(AppView.PARTNER_RESOURCES)}
            className="mt-4 text-sm font-semibold text-brand hover:underline"
          >
            View All FAQs →
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface FaqItemProps {
  question: string;
  answer: string;
}

const FaqItem: React.FC<FaqItemProps> = ({ question, answer }) => (
  <div className="rounded-xl bg-slate-50 dark:bg-navy-900/60 p-4">
    <div className="font-semibold text-slate-900 dark:text-white">{question}</div>
    <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">{answer}</div>
  </div>
);

export default CommissionView;
