import { ShieldCheck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Api } from '../../services/api';
export const AdminAuditIntegrityPanel: React.FC = () => {
  const [stats, setStats] = useState<any>(null),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Api.getTenantAdminAuditStats()
      .then(setStats)
      .catch((e: any) => setError(e.message));
  }, []);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">Integralność dziennika audytu</h2>
        <p className="text-sm text-c-text-secondary">
          Dowody dostępne obecnie — bez deklarowania nieistniejącej kryptografii.
        </p>
      </div>
      {error && <div role="alert">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-c-border p-4">
          Zdarzenia: {stats?.totalLogs ?? '—'}
        </div>
        <div className="rounded-xl border border-c-border p-4">
          Nierozwiązane: {stats?.unresolvedCount ?? '—'}
        </div>
        <div className="rounded-xl border border-c-border p-4">
          Wysokie ryzyko: {stats?.highRiskCount ?? '—'}
        </div>
      </div>
      <section className="rounded-xl border border-c-border p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <h3 className="font-semibold text-c-text">Niezmienność dla ról klienta</h3>
        </div>
        <p className="mt-2 text-sm text-c-text-secondary">
          Interfejs administracji klienta udostępnia odczyt i eksport dziennika; nie udostępnia
          endpointu modyfikowania ani usuwania zdarzeń audytowych.
        </p>
      </section>
      <section className="rounded-xl border border-c-border p-5">
        <h3 className="font-semibold text-c-text">Weryfikacja kryptograficzna</h3>
        <p className="mt-2 text-sm text-c-text-secondary">
          Łańcuch haszy nie jest jeszcze prowadzony. Integralność opiera się dziś na kontroli
          dostępu (brak ścieżki zapisu dla ról klienta), nie na dowodzie kryptograficznym.
        </p>
      </section>
    </div>
  );
};
