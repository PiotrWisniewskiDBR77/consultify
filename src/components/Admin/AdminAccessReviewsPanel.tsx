import { CalendarCheck, Users } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import {
  type AccessReviewPolicy,
  getAccessReviewData,
  type PrivilegedMember,
} from '../../services/adminAccessReviewsApi';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
export const AdminAccessReviewsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState<AccessReviewPolicy | null>(null),
    [members, setMembers] = useState<PrivilegedMember[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getAccessReviewData()
      .then((x) => {
        setPolicy(x.policy);
        setMembers(x.members);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const next = policy
    ? new Date(
        Date.now() + Number(policy.accessReviewCadenceDays || 90) * 86400000
      ).toLocaleDateString()
    : '—';
  const cols = useMemo<TableColumn[]>(
      () => [
        {
          id: 'person',
          label: t('admin.team.access-reviews.columns.person'),
        },
        {
          id: 'email',
          label: t('admin.team.access-reviews.columns.email'),
        },
        {
          id: 'role',
          label: t('admin.team.access-reviews.columns.role'),
        },
        {
          id: 'status',
          label: t('admin.team.access-reviews.columns.status'),
        },
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
        <h2 className="text-lg font-semibold text-c-text">
          {t('admin.team.access-reviews.title')}
        </h2>
        <p className="text-sm text-c-text-secondary">
          {t('admin.team.access-reviews.description')}
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
          {t('admin.team.access-reviews.loading')}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-c-border p-4">
            {t('admin.team.access-reviews.policy.statusLabel')}{' '}
            {policy?.accessReviewsEnabled
              ? t('admin.team.access-reviews.policy.enabled')
              : t('admin.team.access-reviews.policy.disabled')}
          </div>
          <div className="rounded-xl border border-c-border p-4">
            {t('admin.team.access-reviews.policy.cadenceDays', {
              value: policy?.accessReviewCadenceDays ?? '—',
            })}
          </div>
          <div className="rounded-xl border border-c-border p-4">
            {t('admin.team.access-reviews.nextReview', { date: next })}
          </div>
        </div>
      )}
      <Link to="/admin/team/roles-permissions" className="text-sm text-c-text underline">
        {t('admin.team.access-reviews.actions.openIamPolicy')}
      </Link>
      <StandardTable
        columns={cols}
        data={rows}
        loading={loading}
        empty={{
          icon: Users,
          title: t('admin.team.access-reviews.privileged.emptyTitle'),
          description: t('admin.team.access-reviews.privileged.emptyDescription'),
        }}
        persistKey="admin.accessReviews"
      />
      <section className="rounded-xl border border-c-border p-4">
        <h3 className="font-semibold text-c-text">
          {t('admin.team.access-reviews.history.title')}
        </h3>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t('admin.team.access-reviews.history.empty')}
        </p>
      </section>
    </div>
  );
};
