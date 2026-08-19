/**
 * AssignInterviewModal
 *
 * Modal do przydzielania wywiadów użytkownikom.
 * Obsługuje:
 * - Wybór szablonu wywiadu
 * - Wybór użytkowników (pojedynczy lub zespół)
 * - Ustawienie terminu i priorytetu
 * - Walidację scope przydziałów (organizacja vs projekt)
 */

import { AlertTriangle, EyeOff, FileText, UserPlus, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  DatePicker,
  Field,
  FieldLabel,
  MultiSelect,
  type MultiSelectOption,
  Select,
  type SelectOption,
} from '@/components/shared/forms';
import { Button, LoadingState, Switch } from '@/components/ui/primitives';
import { useInterviewPermissions } from '@/hooks/useInterviewPermissions';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

import {
  getTemplateAreaTagLabel,
  getTemplateSourceLabel,
  normalizeInterviewTemplateAreaTags,
  type TemplateScope,
} from './templateLibraryMeta';

interface InterviewTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  questionCount?: number;
  scope?: TemplateScope;
  areaTags?: string[];
  status?: string;
  version: number;
  hasPublishedVersion?: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  projectRole?: string;
}

interface AssignInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedTemplateId?: string;
}

type Priority = 'low' | 'medium' | 'high' | 'urgent';

export const AssignInterviewModal: React.FC<AssignInterviewModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedTemplateId,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { currentProjectId, currentOrganization } = useAppStore();
  const { assignmentScope, canAssignToUser } = useInterviewPermissions();

  // Form state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(preselectedTemplateId || '');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [teamLeadId, setTeamLeadId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [notes, setNotes] = useState('');
  const [isTeamAssignment, setIsTeamAssignment] = useState(false);
  // D18-A — anonymous survey mode. Default false: existing assignment flow is
  // unchanged unless the manager explicitly opts in here.
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Data state
  const [templates, setTemplates] = useState<InterviewTemplate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestKeyRef = React.useRef('');

  // Load templates and users
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);

      try {
        // Load templates separately to see which one fails
        let templatesRes: any[] = [];
        let usersRes: any[] = [];

        try {
          const templatesData = await Api.get('/interview/templates');
          templatesRes = Array.isArray(templatesData) ? templatesData : [];
        } catch (err: any) {
          console.error(
            '[AssignInterviewModal] Failed to load templates:',
            err?.response?.status,
            err?.message
          );
          const errorMsg = err?.response?.data?.error || err?.message || 'Failed to load templates';
          if (err?.response?.status === 403) {
            toast.error(t('interview.assignModal.noPermissionToViewTemplates'));
          } else {
            const msg = typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg);
            toast.error(t('interview.assignModal.failedToLoadTemplatesX', { msg }));
          }
          templatesRes = [];
        }

        try {
          const usersData = await Api.get('/users');
          // API returns { users, total }, extract users array
          usersRes = Array.isArray(usersData?.users)
            ? usersData.users
            : Array.isArray(usersData)
              ? usersData
              : [];
        } catch (err: any) {
          console.error(
            '[AssignInterviewModal] Failed to load users:',
            err?.response?.status,
            err?.message
          );
          const errorMsg = err?.response?.data?.error || err?.message || 'Failed to load users';
          if (err?.response?.status === 403) {
            toast.error(t('interview.assignModal.noPermissionToViewUsers'));
          } else {
            const msg = typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg);
            toast.error(t('interview.assignModal.failedToLoadUsersX', { msg }));
          }
          usersRes = [];
        }

        setTemplates(
          templatesRes
            .filter(
              (template) =>
                String(template?.status || '').toLowerCase() === 'approved' &&
                template?.hasPublishedVersion === true
            )
            .map((template) => ({
              ...template,
              version: Number(template?.version || 0),
              scope: ((template?.scope || 'private') as TemplateScope) || 'private',
              areaTags: normalizeInterviewTemplateAreaTags(template?.areaTags),
            }))
        );

        // Map users and filter based on assignment scope
        const allUsers = usersRes.map((u: any) => ({
          id: u.id,
          name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unknown',
          email: u.email || '',
          avatarUrl: u.avatarUrl || u.avatar_url,
          projectRole: u.projectRole || u.project_role,
        }));

        setUsers(allUsers);

        if (templatesRes.length === 0) {
          console.warn(
            '[AssignInterviewModal] ⚠️ No templates found - check permissions or backend'
          );
          toast.error(t('interview.assignModal.noTemplatesAvailableCheckPermissions'));
        }
        if (allUsers.length === 0) {
          console.warn('[AssignInterviewModal] ⚠️ No users found - check permissions or backend');
          toast.error(t('interview.assignModal.noUsersAvailableCheckPermissions'));
        }
      } catch (error: any) {
        console.error('[AssignInterviewModal] Unexpected error in loadData:', error);
        const errorMessage =
          typeof error === 'string'
            ? error
            : error?.response?.data?.error ||
              error?.message ||
              t('interview.assignModal.failedToLoadData');
        const msg = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, isPolish]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      requestKeyRef.current =
        globalThis.crypto?.randomUUID?.() ?? `assignment-${Date.now()}-${Math.random()}`;
      setSelectedTemplateId(preselectedTemplateId || '');
      setSelectedUserIds([]);
      setTeamLeadId('');
      setDueDate('');
      setPriority('medium');
      setNotes('');
      setIsTeamAssignment(false);
      setIsAnonymous(false);
    }
  }, [isOpen, preselectedTemplateId]);

  // Template options for the portal-based Select (with scope/area-tag hints).
  const templateOptions = useMemo<SelectOption[]>(
    () =>
      templates.map((template) => {
        const tags = [
          getTemplateSourceLabel(template.scope, t),
          ...(template.areaTags || []).map((tag) => getTemplateAreaTagLabel(tag, t)),
        ].filter(Boolean);
        const label = tags.length ? `${template.name} · ${tags.join(' · ')}` : template.name;
        return {
          value: template.id,
          label,
          icon: <FileText size={16} className="shrink-0 text-blue-400" />,
        };
      }),
    [templates, isPolish]
  );

  // User options for the portal-based MultiSelect.
  const userOptions = useMemo<MultiSelectOption[]>(
    () =>
      users.map((user) => ({
        value: user.id,
        label: user.name,
        description: user.email,
      })),
    [users]
  );

  // Get selected users (for team-lead picker + count).
  const selectedUsers = useMemo(() => {
    return users.filter((u) => selectedUserIds.includes(u.id));
  }, [users, selectedUserIds]);

  // Team-lead options (restricted to currently selected users).
  const teamLeadOptions = useMemo<SelectOption[]>(
    () => selectedUsers.map((user) => ({ value: user.id, label: user.name })),
    [selectedUsers]
  );

  // Apply a new user selection from the MultiSelect, preserving the
  // team-assignment invariants (clear lead if removed, disable team mode <2).
  const handleUsersChange = useCallback(
    (next: string[]) => {
      if (teamLeadId && !next.includes(teamLeadId)) {
        setTeamLeadId('');
      }
      if (next.length < 2) {
        setIsTeamAssignment(false);
      }
      setSelectedUserIds(next);
    },
    [teamLeadId]
  );

  // Handle submit
  const handleSubmit = async () => {
    // Validation
    if (!selectedTemplateId) {
      toast.error(t('interview.assignModal.selectAnInterviewTemplate'));
      return;
    }
    if (selectedUserIds.length === 0) {
      toast.error(t('interview.assignModal.selectAtLeastOneUser'));
      return;
    }
    if (!dueDate) {
      toast.error(t('interview.assignModal.setADueDate'));
      return;
    }
    if (isTeamAssignment && !teamLeadId) {
      toast.error(t('interview.assignModal.selectATeamLead'));
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
      if (
        !selectedTemplate ||
        !Number.isInteger(selectedTemplate.version) ||
        selectedTemplate.version < 1
      ) {
        toast.error('The selected template has no published version. Publish it before assigning.');
        return;
      }
      const result = await Api.post('/interview/assignments', {
        templateId: selectedTemplateId,
        templateVersion: selectedTemplate.version,
        idempotencyKey: requestKeyRef.current,
        assigneeUserIds: selectedUserIds,
        teamLeadId: isTeamAssignment ? teamLeadId : undefined,
        dueAt: new Date(dueDate).toISOString(),
        priority,
        notes: notes || undefined,
        projectId: currentProjectId || undefined,
        isAnonymous,
      });

      toast.success(
        (result as any)?.splitAssignments
          ? t('interview.assignModal.createdSeparateAssignmentsCount', {
              count: (result as any)?.createdCount || selectedUserIds.length,
            })
          : t('interview.assignModal.interviewAssignedToCount', { count: selectedUserIds.length })
      );

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('[AssignInterviewModal] Failed to create assignment:', error);
      let errorMessage: string;
      const errorCode = String(
        error?.data?.code || error?.response?.data?.code || error?.code || ''
      );
      if (errorCode === 'PUBLISHED_TEMPLATE_VERSION_NOT_FOUND') {
        errorMessage =
          'This template version is no longer available. Reload and select a published version.';
      } else if (errorCode === 'ASSIGNMENT_IDEMPOTENCY_PAYLOAD_MISMATCH') {
        errorMessage =
          'This assignment changed while it was being retried. Close and reopen the form.';
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.data?.error || error?.response?.data?.error) {
        const errData = error?.data?.error || error.response.data.error;
        errorMessage = typeof errData === 'string' ? errData : JSON.stringify(errData);
      } else if (error?.message) {
        errorMessage =
          typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
      } else {
        errorMessage = t('interview.assignModal.failedToAssignInterview');
      }
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop — VISUAL_STANDARD §5.6: every modal dims the app behind it
          (same layer as the Modal primitive: black/30 light, black/50 dark). */}
      <div
        className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-c-accent-soft flex items-center justify-center">
              <UserPlus size={20} className="text-c-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('interview.assignModal.assignInterview')}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('interview.assignModal.selectATemplateAndAssign')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-6">
          {isLoading ? (
            <LoadingState variant="spinner" className="py-12" />
          ) : (
            <>
              {/* Template Selection */}
              <Field>
                <FieldLabel required>{t('interview.assignModal.interviewTemplate')}</FieldLabel>
                <Select
                  value={selectedTemplateId}
                  onChange={setSelectedTemplateId}
                  options={templateOptions}
                  placeholder={t('interview.assignModal.selectTemplate')}
                  aria-label={t('interview.assignModal.interviewTemplate')}
                />
              </Field>

              {/* User Selection */}
              <Field>
                <FieldLabel required>{t('interview.assignModal.assignTo')}</FieldLabel>
                <MultiSelect
                  values={selectedUserIds}
                  onChange={handleUsersChange}
                  options={userOptions}
                  placeholder={t('interview.assignModal.selectUsers')}
                  searchPlaceholder={t('interview.assignModal.searchUsers')}
                  emptyLabel={t('interview.assignModal.noUsersFound')}
                  aria-label={t('interview.assignModal.assignTo')}
                  renderOptionLeading={(option) => (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-700 dark:bg-navy-700 dark:text-slate-300">
                      {option.label.charAt(0)}
                    </span>
                  )}
                />

                {/* Team Assignment Toggle */}
                {selectedUserIds.length >= 2 && (
                  <div className="mt-1 p-3 bg-slate-50 dark:bg-navy-800/50 border border-slate-200 dark:border-navy-700 rounded-xl">
                    <Switch
                      checked={isTeamAssignment}
                      onCheckedChange={setIsTeamAssignment}
                      aria-label={t('interview.assignModal.teamAssignment')}
                      label={
                        <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <Users size={16} className="text-slate-500 dark:text-slate-400" />
                          {t('interview.assignModal.teamAssignment')}
                        </span>
                      }
                    />

                    {isTeamAssignment && (
                      <div className="mt-3 pl-7">
                        <FieldLabel className="mb-1.5 text-xs text-slate-500 dark:text-slate-400">
                          {t('interview.assignModal.teamLead')}
                        </FieldLabel>
                        <Select
                          value={teamLeadId}
                          onChange={setTeamLeadId}
                          options={teamLeadOptions}
                          placeholder={t('interview.assignModal.selectLead')}
                          aria-label={t('interview.assignModal.teamLead')}
                        />
                      </div>
                    )}
                  </div>
                )}
              </Field>

              {/* Due Date & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel required>{t('interview.assignModal.dueDate')}</FieldLabel>
                  <DatePicker
                    value={dueDate}
                    onChange={setDueDate}
                    min={new Date().toISOString().split('T')[0]}
                    placeholder={t('interview.assignModal.pickADate')}
                    isPolish={isPolish}
                    aria-label={t('interview.assignModal.dueDate')}
                  />
                </Field>

                <Field>
                  <FieldLabel>{t('interview.assignModal.priority')}</FieldLabel>
                  <Select
                    value={priority}
                    onChange={(v) => setPriority(v as Priority)}
                    options={[
                      { value: 'low', label: t('interview.assignModal.low') },
                      { value: 'medium', label: t('interview.assignModal.medium') },
                      { value: 'high', label: t('interview.assignModal.high') },
                      { value: 'urgent', label: t('interview.assignModal.urgent') },
                    ]}
                    aria-label={t('interview.assignModal.priority')}
                  />
                </Field>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('interview.assignModal.notesOptional')}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('interview.assignModal.additionalInstructionsForAssignees')}
                  rows={3}
                  className="w-full px-3 py-3 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 focus:border-c-focus focus:ring-1 focus:ring-c-focus focus:outline-none resize-none transition-colors"
                />
              </div>

              {/* Anonymous responses toggle (D18-A) */}
              <div className="p-3 bg-slate-50 dark:bg-navy-800/50 border border-slate-200 dark:border-navy-700 rounded-xl">
                <Switch
                  checked={isAnonymous}
                  onCheckedChange={setIsAnonymous}
                  aria-label={t('interview.assignModal.anonymousResponses')}
                  label={
                    <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <EyeOff size={16} className="text-slate-500 dark:text-slate-400" />
                      {t('interview.assignModal.anonymousResponses')}
                    </span>
                  }
                />
                <p className="mt-1.5 pl-7 text-xs text-slate-500 dark:text-slate-400">
                  {t('interview.assignModal.theManagerWillOnlyEver')}
                </p>
              </div>

              {/* Scope Warning */}
              {assignmentScope.type === 'projects' && (
                <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-300">
                    {t('interview.assignModal.youCanOnlyAssignInterviews')}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/50">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t('interview.assignModal.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading}
            loading={isSubmitting}
            icon={isSubmitting ? undefined : <UserPlus size={16} />}
          >
            {isSubmitting
              ? t('interview.assignModal.assigning')
              : t('interview.assignModal.assign')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AssignInterviewModal;
