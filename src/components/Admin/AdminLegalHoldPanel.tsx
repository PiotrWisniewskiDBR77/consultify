import { Scale } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { getLegalHold, type LegalHoldState } from '../../services/adminLegalHoldApi';
export const AdminLegalHoldPanel: React.FC = () => {
  const [data, setData] = useState<LegalHoldState | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getLegalHold()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">Legal hold</h2>
        <p className="text-sm text-c-text-secondary">
          Stan faktycznego wstrzymania dla całej organizacji — tylko odczyt.
        </p>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-c-danger bg-c-surface p-4 text-sm text-c-danger"
        >
          {error}
        </div>
      )}
      {loading ? (
        <div role="status" className="py-8 text-center text-sm text-c-text-muted">
          Ładowanie stanu legal hold…
        </div>
      ) : (
        <section className="rounded-xl border border-c-border p-5">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            <strong>
              {data?.legalHoldEnabled ? 'Wstrzymanie aktywne' : 'Wstrzymanie nieaktywne'}
            </strong>
          </div>
          <p className="mt-2 text-sm text-c-text-secondary">
            Gdy aktywne, blokowane są: eksport danych oraz usunięcie organizacji.
          </p>
        </section>
      )}
      <section className="rounded-xl border border-c-border p-5">
        <h3 className="font-semibold text-c-text">Sprawy objęte wstrzymaniem</h3>
        <p className="mt-2 text-sm text-c-text-secondary">
          Rejestr spraw nie jest jeszcze prowadzony; wstrzymanie działa dziś na poziomie całej
          organizacji.
        </p>
      </section>
    </div>
  );
};
