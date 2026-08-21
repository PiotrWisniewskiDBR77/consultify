import { Info, ShieldCheck } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface AdminCapabilityStateProps {
  title: string;
  domain: string;
}

/** Honest boundary for specified screens that do not yet have a verified,
 * independently connected backend surface. It deliberately exposes no CTA. */
export const AdminCapabilityState: React.FC<AdminCapabilityStateProps> = ({ title, domain }) => {
  const { i18n } = useTranslation();
  const isPolish = (i18n.resolvedLanguage || i18n.language || 'pl').toLowerCase().startsWith('pl');

  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-6"
    >
      <div className="flex items-start gap-4">
        <span className="rounded-lg bg-[var(--c-surface-raised)] p-2 text-[var(--c-info)]">
          <Info aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-[var(--c-text)]">{title}</h2>
            <span className="rounded-full border border-[var(--c-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--c-text-muted)]">
              {isPolish ? 'Niezweryfikowane' : 'Not verified'}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--c-text-secondary)]">
            {isPolish
              ? `Ten ekran ma zatwierdzone miejsce w domenie „${domain}”, ale niezależny kontrakt danych, uprawnień i trwałego odczytu nie został jeszcze potwierdzony. Nie udostępniamy pozornego formularza ani akcji do czasu powiązania z rzeczywistym backendem.`
              : `This screen has an approved place in “${domain}”, but its independent data, authorization, and durable-readback contract has not been verified. No placeholder form or action is exposed before a real backend connection exists.`}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-[var(--c-text-muted)]">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            {isPolish
              ? 'Brak zapisu, brak zmiany RBAC i brak fałszywego komunikatu sukcesu.'
              : 'No write, no RBAC change, and no false success message.'}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdminCapabilityState;
