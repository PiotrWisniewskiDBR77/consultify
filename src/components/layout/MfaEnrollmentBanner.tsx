/**
 * Baner okresu przejściowego MFA.
 *
 * POWÓD ISTNIENIA (defekt 2026-09-02): wymóg drugiego składnika odmawiał
 * logowania, a użytkownik nie dowiadywał się o nim NICZEGO aż do momentu, w
 * którym już nie mógł wejść. Teraz w okresie karencji logowanie przechodzi, a
 * ten baner niesie jawny termin i prowadzi do ekranu konfiguracji.
 *
 * Kolor: to jest termin do dotrzymania, nie awaria — używamy neutralnych
 * tokenów c-*, czerwień zostaje zarezerwowana dla semantyki krytycznej.
 */
import { ShieldCheck, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Api } from '../../services/api';

type MfaStatusResponse = {
  enabled?: boolean;
  enforced?: boolean;
  graceActive?: boolean;
  graceDaysRemaining?: number;
  graceDeadline?: string | null;
};

const DISMISS_KEY = 'consultify-mfa-grace-banner-dismissed-on';

export const MfaEnrollmentBanner: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<MfaStatusResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = (await Api.get('/api/mfa/status')) as MfaStatusResponse;
        if (!cancelled) setStatus(res || null);
      } catch {
        // Baner jest dodatkiem do komunikatu z logowania — jego brak nigdy nie
        // może przeszkodzić w pracy, więc błąd odczytu po prostu go ukrywa.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      setDismissed(localStorage.getItem(DISMISS_KEY) === today);
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!status || dismissed) return null;
  if (!status.enforced || status.enabled) return null;

  const days = Number(status.graceDaysRemaining ?? 0);
  const message = status.graceActive
    ? t('mfa.graceBanner.remaining', {
        defaultValue:
          'Twoja organizacja wymaga drugiego składnika logowania. Zostało {{count}} dni na jego skonfigurowanie.',
        count: days,
      })
    : t(
        'mfa.graceBanner.expired',
        'Twoja organizacja wymaga drugiego składnika logowania. Okres przejściowy minął — skonfiguruj go teraz.'
      );

  return (
    <div
      role="status"
      data-testid="mfa-grace-banner"
      className="flex items-center gap-3 border-b border-c-border bg-c-surface px-4 py-2 text-sm text-c-text-secondary"
    >
      <ShieldCheck size={16} className="shrink-0 text-c-text" aria-hidden="true" />
      <span className="min-w-0 flex-1">{message}</span>
      <Link
        to="/settings/security"
        className="shrink-0 rounded-md border border-c-border px-3 py-1 text-xs font-semibold text-c-text transition-colors hover:bg-c-surface-raised"
      >
        {t('mfa.graceBanner.action', 'Skonfiguruj')}
      </Link>
      <button
        type="button"
        aria-label={t('common.dismiss', 'Ukryj')}
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, new Date().toISOString().slice(0, 10));
          } catch {
            // Ukrycie na dziś jest wygodą, nie stanem produktu.
          }
          setDismissed(true);
        }}
        className="shrink-0 rounded-md p-1 text-c-text-muted transition-colors hover:text-c-text"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default MfaEnrollmentBanner;
