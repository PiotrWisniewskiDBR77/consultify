import { CalendarCheck, Users } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAccessReviewData,
  type AccessReviewPolicy,
  type PrivilegedMember,
} from '../../services/adminAccessReviewsApi';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
import { useTranslation } from 'react-i18next';
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
          label: t('admin.team.access-reviews.day2Auto.text1'),
        },
        {
          id: 'email',
          label: 'E-mail',
        },
        {
          id: t('admin.team.access-reviews.day2Auto.text2'),
          label: t('admin.team.access-reviews.day2Auto.text3'),
        },
        {
          id: t('admin.team.access-reviews.day2Auto.text4'),
          label: t('admin.team.access-reviews.day2Auto.text5'),
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
          {t('admin.team.access-reviews.day2Auto.text6')}
        </h2>
        <p className="text-sm text-c-text-secondary">
          Odczyt konfiguracji i kont uprzywilejowanych; edycja pozostaje w polityce IAM.
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
          {t('admin.team.access-reviews.day2Auto.text7')}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-c-border p-4">
            {t('admin.team.access-reviews.day2Auto.text16')}{' '}
            {policy?.accessReviewsEnabled
              ? t('admin.team.access-reviews.day2Auto.text8')
              : t('admin.team.access-reviews.day2Auto.text9')}
          </div>
          <div className="rounded-xl border border-c-border p-4">
            {t('admin.team.access-reviews.day2Auto.text19', {
              value: policy?.accessReviewCadenceDays ?? '—',
            })}
          </div>
          <div className="rounded-xl border border-c-border p-4">
            {t('admin.team.access-reviews.day2Auto.text10')}
            {next}
          </div>
        </div>
      )}
      <Link to="/admin/team/roles-permissions" className="text-sm text-c-text underline">
        {t('admin.team.access-reviews.day2Auto.text11')}
      </Link>
      <StandardTable
        columns={cols}
        data={rows}
        loading={loading}
        empty={{
          icon: Users,
          title: t('admin.team.access-reviews.day2Auto.text12'),
          description: t('admin.team.access-reviews.day2Auto.text13'),
        }}
        persistKey="admin.accessReviews"
      />
      <section className="rounded-xl border border-c-border p-4">
        <h3 className="font-semibold text-c-text">
          {t('admin.team.access-reviews.day2Auto.text14')}
        </h3>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t('admin.team.access-reviews.day2Auto.text15')}
        </p>
      </section>
    </div>
  );
};
