/**
 * InterviewAssignmentsPanel - Admin management for interview assignments
 *
 * Admin can:
 * - Assign approved interview templates to users (repeatable)
 * - View assignment progress
 * - Send back when completeness < 50%
 *
 * Admin has no influence on answers.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

type AssignmentStatus = 'assigned' | 'in_progress' | 'submitted' | 'sent_back' | 'completed';

interface AssignmentRow {
  id: string;
  assignee_user_id: string;
  due_at?: string | null;
  status: AssignmentStatus;
  sent_back_reason?: string | null;
  updated_at?: string;
  created_at?: string;
  template?: { id: string; name: string; category?: string; version?: number };
  session?: { id: string; status: string; completenessPercent: number };
}

export const InterviewAssignmentsPanel: React.FC = () => {
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [users, setUsers] = useState<
    { id: string; firstName: string; lastName: string; email?: string }[]
  >([]);

  // Create form
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [dueDate, setDueDate] = useState(''); // yyyy-mm-dd
  const [processRef, setProcessRef] = useState('');

  const approvedTemplates = useMemo(
    () => (templates || []).filter((t: any) => String(t.status || 'approved') === 'approved'),
    [templates]
  );

  const refresh = async () => {
    setLoading(true);
    try {
      const [aRes, tRes, uRes] = await Promise.all([
        Api.get('/interview/assignments'),
        Api.get('/interview/templates'),
        Api.get('/users'),
      ]);
      setAssignments(Array.isArray(aRes) ? (aRes as AssignmentRow[]) : []);
      setTemplates(Array.isArray(tRes) ? tRes : []);
      const uArr = Array.isArray(uRes) ? uRes : (uRes as any)?.users || [];
      setUsers(
        uArr.map((u: any) => ({
          id: u.id,
          firstName: u.firstName || u.first_name || '',
          lastName: u.lastName || u.last_name || '',
          email: u.email,
        }))
      );
    } catch (err) {
      console.error('[InterviewAssignmentsPanel] Failed to load:', err);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleCreate = async () => {
    if (!assigneeUserId || !templateId) return;
    setSaving(true);
    try {
      await Api.post('/interview/assignments', {
        assigneeUserId,
        templateId,
        dueAt: dueDate ? new Date(dueDate).toISOString() : null,
        processRef: processRef || null,
      });
      setAssigneeUserId('');
      setTemplateId('');
      setDueDate('');
      setProcessRef('');
      await refresh();
    } catch (err) {
      console.error('[InterviewAssignmentsPanel] Failed to create assignment:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSendBack = async (assignmentId: string) => {
    const reason =
      window.prompt(t('admin.interviewAssignmentsPanel.sendBackReason')) ||
      t('admin.interviewAssignmentsPanel.pleaseCompleteTheInterview');
    try {
      await Api.post(`/interview/assignments/${assignmentId}/send-back`, { reason });
      await refresh();
    } catch (err) {
      console.error('[InterviewAssignmentsPanel] Failed to send back:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-5 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('admin.interviewAssignmentsPanel.interviewAssignments')}
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('admin.interviewAssignmentsPanel.adminAssignsUserSubmits')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
              {t('admin.interviewAssignmentsPanel.user')}
            </label>
            <select
              value={assigneeUserId}
              onChange={(e) => setAssigneeUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white text-sm"
            >
              <option value="">{t('admin.interviewAssignmentsPanel.select')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} {u.email ? `(${u.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
              {t('admin.interviewAssignmentsPanel.templateApproved')}
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white text-sm"
            >
              <option value="">{t('admin.select')}</option>
              {approvedTemplates.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
              {t('admin.interviewAssignmentsPanel.dueDateOptional')}
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
              {t('admin.interviewAssignmentsPanel.processOptional')}
            </label>
            <input
              value={processRef}
              onChange={(e) => setProcessRef(e.target.value)}
              placeholder={t('admin.interviewAssignmentsPanel.eGOrderToCash')}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => void refresh()}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors text-sm"
          >
            {t('admin.interviewAssignmentsPanel.refresh')}
          </button>
          <button
            onClick={() => void handleCreate()}
            disabled={saving || !assigneeUserId || !templateId}
            className="px-4 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving
              ? t('admin.interviewAssignmentsPanel.saving')
              : t('admin.interviewAssignmentsPanel.assign')}
          </button>
        </div>
      </div>

      <div className="p-5 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t('admin.interviewAssignmentsPanel.assignmentsList')}
          </h4>
          <span className="text-xs text-slate-500 dark:text-slate-400">{assignments.length}</span>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t('admin.interviewAssignmentsPanel.loading')}
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t('admin.interviewAssignmentsPanel.noData')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */ className="w-full text-sm"
            >
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3">{t('admin.interviewAssignmentsPanel.template')}</th>
                  <th className="py-2 pr-3">{t('admin.interviewAssignmentsPanel.status')}</th>
                  <th className="py-2 pr-3">{t('admin.interviewAssignmentsPanel.progress')}</th>
                  <th className="py-2 pr-3">{t('admin.interviewAssignmentsPanel.due')}</th>
                  <th className="py-2 pr-3">{t('admin.interviewAssignmentsPanel.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
                {assignments.map((a) => {
                  const progress = a.session?.completenessPercent ?? 0;
                  const canSendBack = a.status === 'submitted' && progress < 50;
                  return (
                    <tr key={a.id} className="text-slate-800 dark:text-slate-200">
                      <td className="py-3 pr-3">
                        <div className="font-medium">
                          {a.template?.name || a.template?.id || 'N/A'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {(a.template?.category || '').toUpperCase()}
                        </div>
                      </td>
                      <td className="py-3 pr-3">{a.status}</td>
                      <td className="py-3 pr-3">{a.session ? `${progress}%` : '-'}</td>
                      <td className="py-3 pr-3">
                        {a.due_at ? new Date(a.due_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => void refresh()}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors text-xs"
                          >
                            {t('admin.refresh')}
                          </button>
                          <button
                            onClick={() => void handleSendBack(a.id)}
                            disabled={!canSendBack}
                            className="px-3 py-1.5 rounded-lg bg-danger-600/20 text-danger-300 border border-danger-500/20 hover:bg-danger-600/30 transition-colors text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {t('admin.interviewAssignmentsPanel.sendBack')}
                          </button>
                        </div>
                        {a.sent_back_reason && (
                          <div className="text-xs text-danger-300 mt-1 truncate">
                            {a.sent_back_reason}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewAssignmentsPanel;
