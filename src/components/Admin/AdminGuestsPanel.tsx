import { UserMinus, Users } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { getAdminGuests, revokeAdminGuest, type AdminGuest } from '../../services/adminGuestsApi';
import { ConfirmDialog } from '../MyWork/shared/ConfirmDialog';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
export const AdminGuestsPanel: React.FC = () => {
  const [data, setData] = useState<AdminGuest[]>([]),
    [target, setTarget] = useState<AdminGuest | null>(null),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getAdminGuests()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  const cols = useMemo<TableColumn[]>(
      () => [
        { id: 'guest', label: 'Gość' },
        { id: 'email', label: 'E-mail' },
        { id: 'scope', label: 'Zakres' },
        { id: 'granted', label: 'Przyznano' },
        { id: 'expires', label: 'Wygasa' },
        { id: 'status', label: 'Status' },
      ],
      []
    ),
    rows = useMemo<TableRow[]>(
      () =>
        data.map((g) => {
          const expired = !!g.expires_at && new Date(g.expires_at) < new Date();
          return {
            id: g.user_id,
            guest: [g.first_name, g.last_name].filter(Boolean).join(' ') || g.email,
            email: g.email,
            scope: g.project_id ? `Projekt ${g.project_id}` : 'Organizacja',
            granted: new Date(g.granted_at).toLocaleString(),
            expires: g.expires_at ? new Date(g.expires_at).toLocaleString() : 'Bez terminu',
            status: expired ? 'Wygasł' : g.status,
          };
        }),
      [data]
    );
  const revoke = async () => {
    if (!target) return;
    try {
      setData(await revokeAdminGuest(target.user_id));
      setTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd odebrania');
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">Goście i dostęp zewnętrzny</h2>
        <p className="text-sm text-c-text-secondary">
          Stan faktycznie przyznanych dostępów. Przełącznik polityki gości pozostaje ukryty,
          ponieważ nie jest jeszcze egzekwowany.
        </p>
      </div>
      {error && <div role="alert">{error}</div>}
      <StandardTable
        columns={cols}
        data={rows}
        rowMenu={(row) => ({
          destructive: {
            label: 'Odbierz dostęp',
            icon: UserMinus,
            onClick: () => setTarget(data.find((g) => g.user_id === row.id) || null),
          },
        })}
        empty={{
          icon: Users,
          title: 'Brak gości',
          description: 'Organizacja nie ma aktywnych dostępów zewnętrznych.',
        }}
        persistKey="admin.guests"
      />
      <ConfirmDialog
        isOpen={!!target}
        onCancel={() => setTarget(null)}
        onConfirm={() => void revoke()}
        title="Odebrać dostęp gościa?"
        description={
          target
            ? `${target.email} utraci dostęp do organizacji. Ponowne uzyskanie dostępu wymaga nowego zaproszenia.`
            : undefined
        }
        confirmLabel="Odbierz dostęp"
        variant="danger"
      />
    </div>
  );
};
