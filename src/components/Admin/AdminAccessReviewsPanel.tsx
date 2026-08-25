import { CalendarCheck, Users } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  getAccessReviewData,
  type AccessReviewPolicy,
  type PrivilegedMember,
} from '../../services/adminAccessReviewsApi';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
export const AdminAccessReviewsPanel: React.FC = () => {
  const [policy, setPolicy] = useState<AccessReviewPolicy | null>(null),
    [members, setMembers] = useState<PrivilegedMember[]>([]),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getAccessReviewData()
      .then((x) => {
        setPolicy(x.policy);
        setMembers(x.members);
      })
      .catch((e) => setError(e.message));
  }, []);
  const next = policy
    ? new Date(
        Date.now() + Number(policy.accessReviewCadenceDays || 90) * 86400000
      ).toLocaleDateString()
    : '—';
  const cols = useMemo<TableColumn[]>(
      () => [
        { id: 'person', label: 'Osoba' },
        { id: 'email', label: 'E-mail' },
        { id: 'role', label: 'Rola' },
        { id: 'status', label: 'Status' },
      ],
      []
    ),
    rows = useMemo<TableRow[]>(
      () =>
        members.map((m) => ({
          id: m.userId,
          person: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
          email: m.email,
          role: m.role,
          status: m.status,
        })),
      [members]
    );
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">Przeglądy dostępów</h2>
        <p className="text-sm text-c-text-secondary">
          Odczyt konfiguracji i kont uprzywilejowanych; edycja pozostaje w polityce IAM.
        </p>
      </div>
      {error && <div role="alert">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-c-border p-4">
          Stan: {policy?.accessReviewsEnabled ? 'Włączone' : 'Wyłączone'}
        </div>
        <div className="rounded-xl border border-c-border p-4">
          Kadencja: {policy?.accessReviewCadenceDays ?? '—'} dni
        </div>
        <div className="rounded-xl border border-c-border p-4">Następny przegląd: {next}</div>
      </div>
      <a href="/admin/team/roles-permissions" className="text-sm text-c-accent underline">
        Otwórz kanoniczną politykę IAM
      </a>
      <StandardTable
        columns={cols}
        data={rows}
        empty={{
          icon: Users,
          title: 'Brak kont uprzywilejowanych',
          description: 'Nie znaleziono aktywnych właścicieli ani administratorów.',
        }}
        persistKey="admin.accessReviews"
      />
      <section className="rounded-xl border border-c-border p-4">
        <h3 className="font-semibold text-c-text">Historia przeglądów</h3>
        <p className="mt-1 text-sm text-c-text-secondary">
          Rejestr kampanii przeglądów nie jest jeszcze prowadzony.
        </p>
      </section>
    </div>
  );
};
