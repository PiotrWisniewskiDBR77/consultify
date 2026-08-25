import { FileClock, MailPlus, ShieldCheck } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const linkClass =
  'inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]';

export const AdminAccessRequestsPanel: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-c-text">
          {t('admin.accessRequests.title', 'Wnioski o dostęp')}
        </h2>
      </header>
      <section className="rounded-2xl border border-c-border bg-c-surface p-5">
        <div className="flex gap-3">
          <FileClock className="h-5 w-5 text-c-text-muted" />
          <p className="text-sm text-c-text-secondary">
            {t(
              'admin.accessRequests.truth',
              'Wnioski o dostęp do tej organizacji nie są jeszcze obsługiwane. Istniejący rejestr wniosków działa na poziomie platformy i dotyczy zakładania nowych organizacji, a nie dołączania do istniejącej — dlatego nie jest tu pokazywany.'
            )}
          </p>
        </div>
      </section>
      <section className="rounded-2xl border border-c-border bg-c-surface p-5">
        <h3 className="font-semibold text-c-text">
          {t('admin.accessRequests.plan.title', 'Planowany przepływ')}
        </h3>
        <ol className="mt-3 space-y-3 text-sm text-c-text-secondary">
          <li>
            {t(
              'admin.accessRequests.plan.submit',
              '1. Użytkownik spoza organizacji składa wniosek — z adresem w zatwierdzonej domenie lub bez niego.'
            )}
          </li>
          <li>
            {t(
              'admin.accessRequests.plan.queue',
              '2. Wniosek trafia do kolejki tej organizacji, widocznej wyłącznie dla OWNER/ADMIN.'
            )}
          </li>
          <li>
            {t(
              'admin.accessRequests.plan.decide',
              '3. OWNER/ADMIN zatwierdza wniosek ze wskazaną rolą albo odrzuca go z powodem.'
            )}
          </li>
          <li>
            {t(
              'admin.accessRequests.plan.member',
              '4. Zatwierdzenie tworzy aktywne członkostwo w istniejącej organizacji — nigdy nową organizację.'
            )}
          </li>
          <li>
            {t(
              'admin.accessRequests.plan.audit',
              '5. Audyt zapisuje osobę decydującą, czas, decyzję, rolę i powód.'
            )}
          </li>
        </ol>
      </section>
      <section className="rounded-2xl border border-c-border bg-c-surface p-5">
        <h3 className="font-semibold text-c-text">
          {t('admin.accessRequests.today.title', 'Dostępne dzisiaj')}
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/admin/team/invitations" className={linkClass}>
            <MailPlus className="h-4 w-4" />{' '}
            {t('admin.accessRequests.today.invitations', 'Wyślij zaproszenie')}
          </Link>
          <Link to="/admin/security/domains" className={linkClass}>
            <ShieldCheck className="h-4 w-4" />{' '}
            {t('admin.accessRequests.today.domains', 'Zarządzaj zweryfikowanymi domenami')}
          </Link>
        </div>
      </section>
    </div>
  );
};

export default AdminAccessRequestsPanel;
