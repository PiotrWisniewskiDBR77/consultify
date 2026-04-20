import { AlertTriangle, Loader2, RefreshCcw, Save, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  V8InterviewApi,
  type V8InterviewManageAssignmentPayload,
} from '@/services/api/v8/interview';
import { Api } from '@/services/api';

type AssignmentStatus =
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'sent_back'
  | 'approved'
  | 'completed';

interface AssignmentLike {
  id: string;
  status: AssignmentStatus;
  assigneeUserId: string;
  templateId: string;
  dueAt?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string | null;
  assignee?: {
    id: string;
    name: string;
    email: string;
  } | null;
  template?: {
    id: string;
    name: string;
    description?: string;
    category?: string;
  } | null;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface TemplateOption {
  id: string;
  name: string;
  category?: string;
}

interface ManageAssignmentModalProps {
  isOpen: boolean;
  assignment: AssignmentLike | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const toDateInputValue = (value?: string | null): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const toIsoDateOrNull = (value: string): string | null => {
  if (!value) return null;
  return new Date(`${value}T12:00:00`).toISOString();
};

export const ManageAssignmentModal: React.FC<ManageAssignmentModalProps> = ({
  isOpen,
  assignment,
  onClose,
  onSuccess,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [users, setUsers] = useState<UserOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [forceFreshAssignment, setForceFreshAssignment] = useState(false);

  useEffect(() => {
    if (!isOpen || !assignment) return;

    setAssigneeUserId(assignment.assigneeUserId);
    setTemplateId(assignment.templateId);
    setDueDate(toDateInputValue(assignment.dueAt));
    setPriority(assignment.priority || 'medium');
    setNotes(assignment.notes || '');
    setReason('');
    setForceFreshAssignment(false);
  }, [assignment, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [templatesRes, usersRes] = await Promise.all([
          Api.get('/interview/templates').catch(() => []),
          Api.get('/users').catch(() => []),
        ]);

        const rawTemplates = Array.isArray(templatesRes) ? templatesRes : [];
        const rawUsers = Array.isArray((usersRes as any)?.users)
          ? (usersRes as any).users
          : Array.isArray(usersRes)
            ? usersRes
            : [];

        setTemplates(
          rawTemplates.map((item: any) => ({
            id: item.id,
            name: item.name || 'Interview template',
            category: item.category || undefined,
          }))
        );
        setUsers(
          rawUsers.map((item: any) => ({
            id: item.id,
            name:
              item.name ||
              `${item.firstName || item.first_name || ''} ${item.lastName || item.last_name || ''}`.trim() ||
              item.email ||
              'User',
            email: item.email || '',
          }))
        );
      } catch (error: any) {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          (isPolish ? 'Nie udało się załadować danych do zarządzania' : 'Failed to load data');
        toast.error(typeof message === 'string' ? message : JSON.stringify(message));
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [isOpen, isPolish]);

  const isAssigned = assignment?.status === 'assigned';
  const isClosed = assignment?.status === 'approved' || assignment?.status === 'completed';
  const assigneeChanged = assignment ? assigneeUserId !== assignment.assigneeUserId : false;
  const templateChanged = assignment ? templateId !== assignment.templateId : false;
  const sensitiveChange = assigneeChanged || templateChanged;
  const shouldCreateFreshAssignment = Boolean(
    assignment &&
      ((isClosed && (sensitiveChange || forceFreshAssignment)) ||
        (!isAssigned && (sensitiveChange || forceFreshAssignment)))
  );
  const requiresReason = Boolean(assignment && shouldCreateFreshAssignment && !isAssigned && !isClosed);

  const effectiveMode: V8InterviewManageAssignmentPayload['mode'] = useMemo(() => {
    if (!assignment) return 'update';
    if (shouldCreateFreshAssignment) {
      return isClosed ? 'assign_again' : 'restart';
    }
    return 'update';
  }, [assignment, isClosed, shouldCreateFreshAssignment]);

  const actionSummary = useMemo(() => {
    if (!assignment) return '';
    if (effectiveMode === 'assign_again') {
      return isPolish
        ? 'Zostanie utworzony nowy assignment, a obecny pozostanie jako historia.'
        : 'A new assignment will be created and the current one will stay as history.';
    }
    if (effectiveMode === 'restart') {
      return isPolish
        ? 'Zostanie utworzony nowy assignment, a bieżący progres zostanie odłożony do historii.'
        : 'A new assignment will be created and the current progress will be archived.';
    }
    if (isAssigned) {
      return isPolish
        ? 'Zmiany zapiszą się bez tworzenia nowego assignmentu.'
        : 'Changes will be saved in place without creating a new assignment.';
    }
    return isPolish
      ? 'Możesz bezpiecznie zmienić deadline, priorytet i notatki bez ruszania odpowiedzi.'
      : 'You can safely update due date, priority, and notes without touching answers.';
  }, [assignment, effectiveMode, isAssigned, isPolish]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === templateId) || assignment?.template || null,
    [assignment?.template, templateId, templates]
  );
  const selectedUser = useMemo(
    () => users.find((item) => item.id === assigneeUserId) || assignment?.assignee || null,
    [assignment?.assignee, assigneeUserId, users]
  );

  const handleSubmit = async () => {
    if (!assignment) return;
    if (!assigneeUserId) {
      toast.error(isPolish ? 'Wybierz przypisaną osobę' : 'Select an assignee');
      return;
    }
    if (!templateId) {
      toast.error(isPolish ? 'Wybierz szablon' : 'Select a template');
      return;
    }
    if (requiresReason && !reason.trim()) {
      toast.error(
        isPolish
          ? 'Podaj powód utworzenia nowego assignmentu'
          : 'Provide a reason for creating a fresh assignment'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: V8InterviewManageAssignmentPayload = {
        assigneeUserId,
        templateId,
        dueAt: toIsoDateOrNull(dueDate),
        priority,
        notes: notes.trim() ? notes.trim() : null,
        mode: effectiveMode,
        reason: reason.trim() || undefined,
      };

      const response = await V8InterviewApi.manageAssignment(assignment.id, payload).catch(() =>
        Api.patch(`/interview/assignments/${assignment.id}/manage`, payload)
      );

      const action = (response as any)?.action || effectiveMode;
      if (action === 'updated') {
        toast.success(isPolish ? 'Assignment zaktualizowany' : 'Assignment updated');
      } else if (action === 'assigned_again') {
        toast.success(isPolish ? 'Utworzono nowy assignment follow-up' : 'Created a follow-up assignment');
      } else {
        toast.success(isPolish ? 'Utworzono świeży assignment' : 'Created a fresh assignment');
      }

      onSuccess?.();
      onClose();
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        (isPolish ? 'Nie udało się zapisać zmian' : 'Failed to save changes');
      toast.error(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !assignment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-navy-700 dark:bg-navy-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-navy-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isPolish ? 'Zarządzaj assignmentem' : 'Manage assignment'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isPolish
                ? 'Zmień właściciela, szablon, termin i zdecyduj czy zachować historię.'
                : 'Update owner, template, due date, and decide whether to preserve history.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-navy-800 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[calc(90vh-154px)] space-y-6 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-navy-700 dark:bg-navy-800/70">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {isPolish ? 'Bieżący assignment' : 'Current assignment'}
                </div>
                <div className="mt-2 text-sm text-slate-900 dark:text-white">
                  <div>{selectedTemplate?.name || assignment.template?.name || 'Interview template'}</div>
                  <div className="mt-1 text-slate-500 dark:text-slate-400">
                    {(selectedUser?.name || assignment.assignee?.name || 'User') +
                      (selectedUser?.email ? ` (${selectedUser.email})` : '')}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Przypisany użytkownik' : 'Assignee'}
                  </span>
                  <select
                    value={assigneeUserId}
                    onChange={(e) => setAssigneeUserId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
                  >
                    <option value="">{isPolish ? 'Wybierz użytkownika' : 'Select user'}</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} {user.email ? `(${user.email})` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Szablon' : 'Template'}
                  </span>
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
                  >
                    <option value="">{isPolish ? 'Wybierz szablon' : 'Select template'}</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.category ? ` (${template.category})` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Termin' : 'Due date'}
                  </span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Priorytet' : 'Priority'}
                  </span>
                  <select
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
                  >
                    <option value="low">{isPolish ? 'Niski' : 'Low'}</option>
                    <option value="medium">{isPolish ? 'Średni' : 'Medium'}</option>
                    <option value="high">{isPolish ? 'Wysoki' : 'High'}</option>
                    <option value="urgent">{isPolish ? 'Pilny' : 'Urgent'}</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isPolish ? 'Notatki dla assignmentu' : 'Assignment notes'}
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
                  placeholder={
                    isPolish
                      ? 'Opcjonalny kontekst dla respondenta lub managera'
                      : 'Optional context for the respondent or manager'
                  }
                />
              </label>

              {!isAssigned && (
                <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-400/20 dark:bg-amber-500/10">
                  <input
                    type="checkbox"
                    checked={forceFreshAssignment}
                    onChange={(e) => setForceFreshAssignment(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                  />
                  <div className="text-sm text-slate-700 dark:text-slate-200">
                    <div className="font-medium">
                      {isClosed
                        ? isPolish
                          ? 'Utwórz follow-up nawet bez zmiany właściciela lub szablonu'
                          : 'Create a follow-up even without changing owner or template'
                        : isPolish
                          ? 'Wymuś nowy assignment i odłóż obecny do historii'
                          : 'Force a new assignment and archive the current one'}
                    </div>
                    <div className="mt-1 text-slate-500 dark:text-slate-400">
                      {isClosed
                        ? isPolish
                          ? 'Przydatne, gdy chcesz ponowić interview po poprzednim review.'
                          : 'Useful when you want to re-run the interview after a previous review.'
                        : isPolish
                          ? 'Gdy zmieniasz właściciela albo szablon, system i tak przejdzie w tryb świeżego assignmentu.'
                          : 'If you change owner or template, the system will switch to a fresh assignment automatically.'}
                    </div>
                  </div>
                </label>
              )}

              {(shouldCreateFreshAssignment || !isAssigned) && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-400/20 dark:bg-blue-500/10">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-blue-500" />
                    <div className="text-sm text-slate-700 dark:text-slate-200">
                      <div className="font-medium">
                        {isPolish ? 'Efekt tej operacji' : 'What this action will do'}
                      </div>
                      <div className="mt-1 text-slate-500 dark:text-slate-400">{actionSummary}</div>
                    </div>
                  </div>
                </div>
              )}

              {shouldCreateFreshAssignment && (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Powód zmiany' : 'Reason for change'}
                    {requiresReason ? ' *' : ''}
                  </span>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
                    placeholder={
                      isPolish
                        ? 'Np. zmiana właściciela projektu, błędny dobór respondenta, potrzeba nowego podejścia'
                        : 'E.g. project ownership changed, wrong respondent, need a fresh pass'
                    }
                  />
                </label>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-navy-700">
          <div className="text-xs text-slate-500 dark:text-slate-400">{actionSummary}</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-navy-600 dark:text-slate-300 dark:hover:bg-navy-800"
            >
              {isPolish ? 'Anuluj' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || isLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : shouldCreateFreshAssignment ? (
                <RefreshCcw className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {shouldCreateFreshAssignment
                ? isPolish
                  ? 'Utwórz nowy assignment'
                  : 'Create new assignment'
                : isPolish
                  ? 'Zapisz zmiany'
                  : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageAssignmentModal;
import { AlertTriangle, Loader2, RefreshCcw, Save, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  V8InterviewApi,
  type V8InterviewManageAssignmentPayload,
} from '@/services/api/v8/interview';
import { Api } from '@/services/api';

type AssignmentStatus =
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'sent_back'
  | 'approved'
  | 'completed';

interface AssignmentLike {
  id: string;
  status: AssignmentStatus;
  assigneeUserId: string;
  templateId: string;
  dueAt?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string | null;
  assignee?: {
    id: string;
    name: string;
    email: string;
  } | null;
  template?: {
    id: string;
    name: string;
    description?: string;
    category?: string;
  } | null;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface TemplateOption {
  id: string;
  name: string;
  category?: string;
}

interface ManageAssignmentModalProps {
  isOpen: boolean;
  assignment: AssignmentLike | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const toDateInputValue = (value?: string | null): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const toIsoDateOrNull = (value: string): string | null => {
  if (!value) return null;
  return new Date(`${value}T12:00:00`).toISOString();
};

export const ManageAssignmentModal: React.FC<ManageAssignmentModalProps> = ({
  isOpen,
  assignment,
  onClose,
  onSuccess,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [users, setUsers] = useState<UserOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [forceFreshAssignment, setForceFreshAssignment] = useState(false);

  useEffect(() => {
    if (!isOpen || !assignment) return;

    setAssigneeUserId(assignment.assigneeUserId);
    setTemplateId(assignment.templateId);
    setDueDate(toDateInputValue(assignment.dueAt));
    setPriority(assignment.priority || 'medium');
    setNotes(assignment.notes || '');
    setReason('');
    setForceFreshAssignment(false);
  }, [assignment, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [templatesRes, usersRes] = await Promise.all([
          Api.get('/interview/templates').catch(() => []),
          Api.get('/users').catch(() => []),
        ]);

        const rawTemplates = Array.isArray(templatesRes) ? templatesRes : [];
        const rawUsers = Array.isArray((usersRes as any)?.users)
          ? (usersRes as any).users
          : Array.isArray(usersRes)
            ? usersRes
            : [];

        setTemplates(
          rawTemplates.map((item: any) => ({
            id: item.id,
            name: item.name || 'Interview template',
            category: item.category || undefined,
          }))
        );
        setUsers(
          rawUsers.map((item: any) => ({
            id: item.id,
            name:
              item.name ||
              `${item.firstName || item.first_name || ''} ${item.lastName || item.last_name || ''}`.trim() ||
              item.email ||
              'User',
            email: item.email || '',
          }))
        );
      } catch (error: any) {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          (isPolish ? 'Nie udało się załadować danych do zarządzania' : 'Failed to load data');
        toast.error(typeof message === 'string' ? message : JSON.stringify(message));
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [isOpen, isPolish]);

  const isAssigned = assignment?.status === 'assigned';
  const isClosed = assignment?.status === 'approved' || assignment?.status === 'completed';
  const assigneeChanged = assignment ? assigneeUserId !== assignment.assigneeUserId : false;
  const templateChanged = assignment ? templateId !== assignment.templateId : false;
  const sensitiveChange = assigneeChanged || templateChanged;
  const shouldCreateFreshAssignment = Boolean(
    assignment &&
      ((isClosed && (sensitiveChange || forceFreshAssignment)) ||
        (!isAssigned && (sensitiveChange || forceFreshAssignment)))
  );
  const requiresReason = Boolean(assignment && shouldCreateFreshAssignment && !isAssigned && !isClosed);

  const effectiveMode: V8InterviewManageAssignmentPayload['mode'] = useMemo(() => {
    if (!assignment) return 'update';
    if (shouldCreateFreshAssignment) {
      return isClosed ? 'assign_again' : 'restart';
    }
    return 'update';
  }, [assignment, isClosed, shouldCreateFreshAssignment]);

  const actionSummary = useMemo(() => {
    if (!assignment) return '';
    if (effectiveMode === 'assign_again') {
      return isPolish
        ? 'Zostanie utworzony nowy assignment, a obecny pozostanie jako historia.'
        : 'A new assignment will be created and the current one will stay as history.';
    }
    if (effectiveMode === 'restart') {
      return isPolish
        ? 'Zostanie utworzony nowy assignment, a bieżący progres zostanie odłożony do historii.'
        : 'A new assignment will be created and the current progress will be archived.';
    }
    if (isAssigned) {
      return isPolish
        ? 'Zmiany zapiszą się bez tworzenia nowego assignmentu.'
        : 'Changes will be saved in place without creating a new assignment.';
    }
    return isPolish
      ? 'Możesz bezpiecznie zmienić deadline, priorytet i notatki bez ruszania odpowiedzi.'
      : 'You can safely update due date, priority, and notes without touching answers.';
  }, [assignment, effectiveMode, isAssigned, isPolish]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === templateId) || assignment?.template || null,
    [assignment?.template, templateId, templates]
  );
  const selectedUser = useMemo(
    () => users.find((item) => item.id === assigneeUserId) || assignment?.assignee || null,
    [assignment?.assignee, assigneeUserId, users]
  );

  const handleSubmit = async () => {
    if (!assignment) return;
    if (!assigneeUserId) {
      toast.error(isPolish ? 'Wybierz przypisaną osobę' : 'Select an assignee');
      return;
    }
    if (!templateId) {
      toast.error(isPolish ? 'Wybierz szablon' : 'Select a template');
      return;
    }
    if (requiresReason && !reason.trim()) {
      toast.error(
        isPolish
          ? 'Podaj powód utworzenia nowego assignmentu'
          : 'Provide a reason for creating a fresh assignment'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: V8InterviewManageAssignmentPayload = {
        assigneeUserId,
        templateId,
        dueAt: toIsoDateOrNull(dueDate),
        priority,
        notes: notes.trim() ? notes.trim() : null,
        mode: effectiveMode,
        reason: reason.trim() || undefined,
      };

      const response = await V8InterviewApi.manageAssignment(assignment.id, payload).catch(() =>
        Api.patch(`/interview/assignments/${assignment.id}/manage`, payload)
      );

      const action = (response as any)?.action || effectiveMode;
      if (action === 'updated') {
        toast.success(isPolish ? 'Assignment zaktualizowany' : 'Assignment updated');
      } else if (action === 'assigned_again') {
        toast.success(isPolish ? 'Utworzono nowy assignment follow-up' : 'Created a follow-up assignment');
      } else {
        toast.success(isPolish ? 'Utworzono świeży assignment' : 'Created a fresh assignment');
      }

      onSuccess?.();
      onClose();
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        (isPolish ? 'Nie udało się zapisać zmian' : 'Failed to save changes');
      toast.error(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !assignment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-navy-700 dark:bg-navy-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-navy-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isPolish ? 'Zarządzaj assignmentem' : 'Manage assignment'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isPolish
                ? 'Zmień właściciela, szablon, termin i zdecyduj czy zachować historię.'
                : 'Update owner, template, due date, and decide whether to preserve history.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-navy-800 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[calc(90vh-154px)] space-y-6 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-navy-700 dark:bg-navy-800/70">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {isPolish ? 'Bieżący assignment' : 'Current assignment'}
                </div>
                <div className="mt-2 text-sm text-slate-900 dark:text-white">
                  <div>{selectedTemplate?.name || assignment.template?.name || 'Interview template'}</div>
                  <div className="mt-1 text-slate-500 dark:text-slate-400">
                    {(selectedUser?.name || assignment.assignee?.name || 'User') +
                      (selectedUser?.email ? ` (${selectedUser.email})` : '')}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Przypisany użytkownik' : 'Assignee'}
                  </span>
                  <select
                    value={assigneeUserId}
                    onChange={(e) => setAssigneeUserId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
                  >
                    <option value="">{isPolish ? 'Wybierz użytkownika' : 'Select user'}</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} {user.email ? `(${user.email})` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Szablon' : 'Template'}
                  </span>
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
                  >
                    <option value="">{isPolish ? 'Wybierz szablon' : 'Select template'}</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.category ? ` (${template.category})` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Termin' : 'Due date'}
                  </span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Priorytet' : 'Priority'}
                  </span>
                  <select
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
                  >
                    <option value="low">{isPolish ? 'Niski' : 'Low'}</option>
                    <option value="medium">{isPolish ? 'Średni' : 'Medium'}</option>
                    <option value="high">{isPolish ? 'Wysoki' : 'High'}</option>
                    <option value="urgent">{isPolish ? 'Pilny' : 'Urgent'}</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isPolish ? 'Notatki dla assignmentu' : 'Assignment notes'}
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
                  placeholder={
                    isPolish
                      ? 'Opcjonalny kontekst dla respondenta lub managera'
                      : 'Optional context for the respondent or manager'
                  }
                />
              </label>

              {!isAssigned && (
                <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-400/20 dark:bg-amber-500/10">
                  <input
                    type="checkbox"
                    checked={forceFreshAssignment}
                    onChange={(e) => setForceFreshAssignment(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                  />
                  <div className="text-sm text-slate-700 dark:text-slate-200">
                    <div className="font-medium">
                      {isClosed
                        ? isPolish
                          ? 'Utwórz follow-up nawet bez zmiany właściciela lub szablonu'
                          : 'Create a follow-up even without changing owner or template'
                        : isPolish
                          ? 'Wymuś nowy assignment i odłóż obecny do historii'
                          : 'Force a new assignment and archive the current one'}
                    </div>
                    <div className="mt-1 text-slate-500 dark:text-slate-400">
                      {isClosed
                        ? isPolish
                          ? 'Przydatne, gdy chcesz ponowić interview po poprzednim review.'
                          : 'Useful when you want to re-run the interview after a previous review.'
                        : isPolish
                          ? 'Gdy zmieniasz właściciela albo szablon, system i tak przejdzie w tryb świeżego assignmentu.'
                          : 'If you change owner or template, the system will switch to a fresh assignment automatically.'}
                    </div>
                  </div>
                </label>
              )}

              {(shouldCreateFreshAssignment || !isAssigned) && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-400/20 dark:bg-blue-500/10">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-blue-500" />
                    <div className="text-sm text-slate-700 dark:text-slate-200">
                      <div className="font-medium">
                        {isPolish ? 'Efekt tej operacji' : 'What this action will do'}
                      </div>
                      <div className="mt-1 text-slate-500 dark:text-slate-400">{actionSummary}</div>
                    </div>
                  </div>
                </div>
              )}

              {shouldCreateFreshAssignment && (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Powód zmiany' : 'Reason for change'}
                    {requiresReason ? ' *' : ''}
                  </span>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
                    placeholder={
                      isPolish
                        ? 'Np. zmiana właściciela projektu, błędny dobór respondenta, potrzeba nowego podejścia'
                        : 'E.g. project ownership changed, wrong respondent, need a fresh pass'
                    }
                  />
                </label>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-navy-700">
          <div className="text-xs text-slate-500 dark:text-slate-400">{actionSummary}</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-navy-600 dark:text-slate-300 dark:hover:bg-navy-800"
            >
              {isPolish ? 'Anuluj' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || isLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : shouldCreateFreshAssignment ? (
                <RefreshCcw className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {shouldCreateFreshAssignment
                ? isPolish
                  ? 'Utwórz nowy assignment'
                  : 'Create new assignment'
                : isPolish
                  ? 'Zapisz zmiany'
                  : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageAssignmentModal;
