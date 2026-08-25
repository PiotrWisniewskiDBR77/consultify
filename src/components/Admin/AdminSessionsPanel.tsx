import { MonitorX } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAdminSessions,
  revokeAdminSession,
  type AdminSession,
} from '../../services/adminSessionsApi';
import { ConfirmDialog } from '../MyWork/shared/ConfirmDialog';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
export const AdminSessionsPanel: React.FC = () => {
  const [data, setData] = useState<AdminSession[]>([]),
    [target, setTarget] = useState<AdminSession | null>(null),
    [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await getAdminSessions());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd sesji');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const cols = useMemo<TableColumn[]>(
    () => [
      { id: 'user', label: 'Użytkownik' },
      { id: 'device', label: 'Urządzenie / przeglądarka' },
      { id: 'ip', label: 'IP' },
      { id: 'location', label: 'Lokalizacja' },
      { id: 'active', label: 'Ostatnia aktywność' },
      { id: 'expires', label: 'Wygaśnięcie' },
    ],
    []
  );
  const rows = useMemo<TableRow[]>(
    () =>
      data.map((s) => ({
        id: s.id,
        user: [s.first_name, s.last_name].filter(Boolean).join(' ') || s.user_email,
        device: s.device_info || s.user_agent || 'Nieznane',
        ip: s.ip_address || 'Nieznane',
        location: s.location || 'Nieznana',
        active: s.last_activity ? new Date(s.last_activity).toLocaleString() : '—',
        expires: s.expires_at ? new Date(s.expires_at).toLocaleString() : '—',
      })),
    [data]
  );
  const revoke = async () => {
    if (!target) return;
    try {
      setData(await revokeAdminSession(target.id));
      setTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd unieważnienia');
    }
  };
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-c-text">Sesje organizacji</h2>
      {error && <div role="alert">{error}</div>}
      <StandardTable
        columns={cols}
        data={rows}
        rowMenu={(row) => ({
          destructive: {
            label: 'Unieważnij sesję',
            icon: MonitorX,
            onClick: () => setTarget(data.find((s) => s.id === row.id) || null),
          },
        })}
        empty={{
          icon: MonitorX,
          title: 'Brak aktywnych sesji',
          description: 'Nie znaleziono aktywnych sesji członków organizacji.',
        }}
        persistKey="admin.sessions"
      />
      <ConfirmDialog
        isOpen={!!target}
        onCancel={() => setTarget(null)}
        onConfirm={() => void revoke()}
        title="Unieważnić sesję?"
        description="Ta sesja natychmiast utraci dostęp. Użytkownik może zalogować się ponownie."
        confirmLabel="Unieważnij sesję"
        variant="danger"
      />
    </div>
  );
};
