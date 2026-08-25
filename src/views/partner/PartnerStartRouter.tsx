/**
 * M16 — Partner Start router (D8, DEC-2026-08-24-08).
 *
 * The Start surface is chosen by the partner's PERSISTED lifecycle phase, read
 * from the server on every mount:
 *
 *   invited / onboarding (runtime: `onboard`, `activate`)
 *     → operational workspace orientation, never acquisition/marketing.
 *   earn / payout
 *     → skip "Be Our Partner" entirely; open on the partner's own numbers,
 *       program data and `program/status.whatNext`.
 *   unknown / error
 *     → an honest degraded state. It must NEVER fall through to the
 *       acquisition screen: an active partner would then be told to sign up,
 *       and a broken read would look like "you are not a partner yet".
 *
 * There is no local flag and no default that pretends the partner is active:
 * the initial state is `loading`, and only a server answer moves it forward.
 * Because the phase is re-read from the server, a fresh reopen reproduces the
 * same variant.
 *
 * Colour note: crimson (`primary-*`) is reserved for errors, destruction and
 * critical warnings. Nothing here uses it as a surface or as the primary CTA.
 */
import { AlertTriangle, ArrowRight, Wallet } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PartnerSection } from '../../components/Partner/PartnerSidebar';
import { V8PartnerApi, type V8PartnerProgramStatus } from '../../services/api/v8';
import { cn } from '../../utils/cn';

export type PartnerStartVariant = 'onboarding' | 'active' | 'unknown';

/** Runtime phases (`onboard`/`activate`/`earn`/`payout`) plus the owner-facing
 *  aliases (`invited`/`onboarding`), so either vocabulary routes correctly. */
export function resolveStartVariant(phase: unknown): PartnerStartVariant {
  const value = String(phase ?? '')
    .trim()
    .toLowerCase();
  switch (value) {
    case 'invited':
    case 'onboarding':
    case 'onboard':
    case 'activate':
      return 'onboarding';
    case 'earn':
    case 'payout':
      return 'active';
    default:
      return 'unknown';
  }
}

const formatMoney = (amount: number, currency: string, locale: string) => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch {
    return `${Number(amount) || 0} ${currency || 'EUR'}`;
  }
};

interface PartnerStartRouterProps {
  /** Operational workspace orientation for invited/onboarding partners. */
  onboardingSurface: React.ReactNode;
  onNavigateSection?: (section: PartnerSection) => void;
}

export const PartnerStartRouter: React.FC<PartnerStartRouterProps> = ({
  onboardingSurface,
  onNavigateSection,
}) => {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [status, setStatus] = useState<V8PartnerProgramStatus | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const response = await V8PartnerApi.getProgramStatus();
      if (!response || typeof response.lifecyclePhase !== 'string') {
        setStatus(null);
        setState('error');
        return;
      }
      setStatus(response);
      setState('ready');
    } catch {
      setStatus(null);
      setState('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (state === 'loading') {
    return (
      <div className="space-y-4 animate-pulse" data-testid="partner-start-loading">
        <div className="h-8 w-1/3 rounded bg-slate-200 dark:bg-navy-700" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-200 dark:bg-navy-700" />
          ))}
        </div>
      </div>
    );
  }

  // Unknown / error — never the acquisition screen.
  if (state === 'error' || !status) {
    return (
      <div
        className="rounded-xl border border-amber-300 bg-c-surface p-8 text-center dark:border-amber-700/60"
        data-testid="partner-start-unknown"
      >
        <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-600 dark:text-amber-400" />
        <p className="font-medium text-c-text">
          {t('partner.start.unknownTitle', 'Nie udało się ustalić statusu Twojego programu')}
        </p>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t(
            'partner.start.unknownDescription',
            'Nie pokazujemy Ci ekranu rejestracji, bo nie wiemy, na jakim etapie jesteś. Spróbuj ponownie za chwilę.'
          )}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg border border-c-border px-4 py-2 text-sm text-c-text hover:bg-c-surface-hover"
        >
          {t('partner.start.retry', 'Spróbuj ponownie')}
        </button>
      </div>
    );
  }

  const variant = resolveStartVariant(status.lifecyclePhase);

  if (variant === 'onboarding') {
    return <div data-testid="partner-start-onboarding">{onboardingSurface}</div>;
  }

  if (variant === 'unknown') {
    return (
      <div
        className="rounded-xl border border-amber-300 bg-c-surface p-8 text-center dark:border-amber-700/60"
        data-testid="partner-start-unknown"
      >
        <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-600 dark:text-amber-400" />
        <p className="font-medium text-c-text">
          {t('partner.start.unknownPhaseTitle', 'Nieznany etap programu partnerskiego')}
        </p>
        <p className="mt-1 font-mono text-xs text-c-text-muted">{String(status.lifecyclePhase)}</p>
      </div>
    );
  }

  // ── Active partner: own numbers first ──────────────────────────────────────
  const currency = status.balances?.currency || 'EUR';
  const locale = i18n.language?.startsWith('pl') ? 'pl-PL' : 'en-GB';
  const reconciliation = (status.balances as any)?.paidReconciliation as
    | { status: string; settledPayouts: number; unreconciledAmount: number }
    | undefined;

  const tiles = [
    {
      id: 'gross',
      label: t('partner.start.grossEarned', 'Zarobione łącznie'),
      value: formatMoney(status.balances?.grossEarned ?? 0, currency, locale),
    },
    {
      id: 'available',
      label: t('partner.start.availableToPayout', 'Gotowe do wypłaty'),
      value: formatMoney(status.balances?.availableToPayout ?? 0, currency, locale),
    },
    {
      id: 'paid',
      label: t('partner.start.paidOut', 'Wypłacone'),
      value: formatMoney(status.balances?.paidOut ?? 0, currency, locale),
    },
    {
      id: 'held',
      label: t('partner.start.heldAmount', 'Wstrzymane'),
      value: formatMoney(status.balances?.heldAmount ?? 0, currency, locale),
    },
  ];

  return (
    <div className="space-y-6" data-testid="partner-start-active">
      <div>
        <h1 className="text-2xl font-semibold text-c-text">
          {t('partner.start.activeTitle', 'Twój program partnerski')}
        </h1>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t('partner.start.activeSubtitle', 'Aktualne saldo, status programu i następny krok.')}
        </p>
      </div>

      {status.degraded && (
        <div
          className="rounded-lg border border-amber-300 bg-c-surface p-4 text-sm text-c-text dark:border-amber-700/60"
          data-testid="partner-start-degraded"
        >
          <AlertTriangle className="mr-2 inline h-4 w-4 text-amber-600 dark:text-amber-400" />
          {t(
            'partner.start.degraded',
            'Saldo pokazujemy z ograniczeniami — rejestr programu był chwilowo nieczytelny.'
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.id}
            className="rounded-xl border border-c-border-subtle bg-c-surface p-4"
            data-testid={`partner-start-tile-${tile.id}`}
          >
            <p className="text-xs uppercase tracking-wide text-c-text-muted">{tile.label}</p>
            <p className="mt-2 text-2xl font-semibold text-c-text">{tile.value}</p>
          </div>
        ))}
      </div>

      {reconciliation?.status === 'LEDGER_BEHIND_REGISTER' && (
        <p className="text-xs text-c-text-secondary" data-testid="partner-start-reconciliation">
          {t(
            'partner.start.paidProjection',
            'Kwota wypłacona pochodzi z rejestru zakończonych wypłat; część nie została jeszcze zaksięgowana w rejestrze programu.'
          )}
        </p>
      )}

      {Array.isArray(status.whatNext) && status.whatNext.length > 0 && (
        <div className="rounded-xl border border-c-border-subtle bg-c-surface p-5">
          <h2 className="text-sm font-semibold text-c-text">
            {t('partner.start.whatNext', 'Następny krok')}
          </h2>
          <ul className="mt-3 space-y-2">
            {status.whatNext.map((step, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-c-text-secondary"
                data-testid="partner-start-whatnext-item"
              >
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-c-text-muted" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onNavigateSection?.('earnings')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
            'bg-c-text text-c-surface hover:opacity-90'
          )}
        >
          <Wallet className="h-4 w-4" />
          {t('partner.start.goToEarnings', 'Przejdź do prowizji')}
        </button>
        <button
          type="button"
          onClick={() => onNavigateSection?.('referral-tools')}
          className="inline-flex items-center gap-2 rounded-lg border border-c-border px-4 py-2 text-sm font-medium text-c-text hover:bg-c-surface-hover"
        >
          {t('partner.start.goToReferralTools', 'Moje linki i kody')}
        </button>
      </div>
    </div>
  );
};

export const PartnerOnboardingOrientation: React.FC = () => {
  const { t } = useTranslation();
  return (
    <section
      className="mx-auto max-w-2xl rounded-2xl border border-c-border-subtle bg-c-surface p-8 text-center shadow-sm"
      data-testid="partner-orientation-onboarding"
    >
      <h1 className="text-2xl font-semibold text-c-text">{t('partner.day12.onboardingTitle')}</h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-c-text-secondary">
        {t('partner.day12.onboardingDescription')}
      </p>
    </section>
  );
};

export default PartnerStartRouter;
