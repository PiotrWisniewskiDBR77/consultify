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

import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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

  // Data state
  const [templates, setTemplates] = useState<InterviewTemplate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI state
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');

  // Load templates and users
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      console.log('[AssignInterviewModal] Starting to load data...');

      try {
        console.log('[AssignInterviewModal] Loading templates and users...');

        // Load templates separately to see which one fails
        let templatesRes: any[] = [];
        let usersRes: any[] = [];

        try {
          console.log('[AssignInterviewModal] Fetching templates from /interview/templates...');
          const templatesData = await Api.get('/interview/templates');
          console.log('[AssignInterviewModal] Templates raw response:', templatesData);
          templatesRes = Array.isArray(templatesData) ? templatesData : [];
          console.log('[AssignInterviewModal] Templates parsed:', templatesRes);
        } catch (err: any) {
          console.error('[AssignInterviewModal] Failed to load templates:', err);
          console.error('[AssignInterviewModal] Error details:', {
            status: err?.response?.status,
            statusText: err?.response?.statusText,
            data: err?.response?.data,
            message: err?.message,
            stack: err?.stack,
          });
          const errorMsg = err?.response?.data?.error || err?.message || 'Failed to load templates';
          if (err?.response?.status === 403) {
            toast.error(
              isPolish
                ? 'Brak uprawnień do przeglądania szablonów'
                : 'No permission to view templates'
            );
          } else {
            const msg = typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg);
            toast.error(
              isPolish
                ? `Nie udało się załadować szablonów: ${msg}`
                : `Failed to load templates: ${msg}`
            );
          }
          templatesRes = [];
        }

        try {
          console.log('[AssignInterviewModal] Fetching users from /users...');
          const usersData = await Api.get('/users');
          console.log('[AssignInterviewModal] Users raw response:', usersData);
          // API returns { users, total }, extract users array
          usersRes = Array.isArray(usersData?.users)
            ? usersData.users
            : Array.isArray(usersData)
              ? usersData
              : [];
          console.log('[AssignInterviewModal] Users parsed:', usersRes);
        } catch (err: any) {
          console.error('[AssignInterviewModal] Failed to load users:', err);
          console.error('[AssignInterviewModal] Error details:', {
            status: err?.response?.status,
            statusText: err?.response?.statusText,
            data: err?.response?.data,
            message: err?.message,
            stack: err?.stack,
          });
          const errorMsg = err?.response?.data?.error || err?.message || 'Failed to load users';
          if (err?.response?.status === 403) {
            toast.error(
              isPolish
                ? 'Brak uprawnień do przeglądania użytkowników'
                : 'No permission to view users'
            );
          } else {
            const msg = typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg);
            toast.error(
              isPolish
                ? `Nie udało się załadować użytkowników: ${msg}`
                : `Failed to load users: ${msg}`
            );
          }
          usersRes = [];
        }

        console.log('[AssignInterviewModal] Final data:', {
          templatesCount: templatesRes.length,
          usersCount: usersRes.length,
        });

        setTemplates(
          templatesRes.map((template) => ({
            ...template,
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

        console.log('[AssignInterviewModal] Mapped users:', allUsers);
        setUsers(allUsers);

        if (templatesRes.length === 0) {
          console.warn(
            '[AssignInterviewModal] ⚠️ No templates found - check permissions or backend'
          );
          toast.error(
            isPolish
              ? 'Brak dostępnych szablonów. Sprawdź uprawnienia.'
              : 'No templates available. Check permissions.'
          );
        }
        if (allUsers.length === 0) {
          console.warn('[AssignInterviewModal] ⚠️ No users found - check permissions or backend');
          toast.error(
            isPolish
              ? 'Brak dostępnych użytkowników. Sprawdź uprawnienia.'
              : 'No users available. Check permissions.'
          );
        }
      } catch (error: any) {
        console.error('[AssignInterviewModal] Unexpected error in loadData:', error);
        const errorMessage =
          typeof error === 'string'
            ? error
            : error?.response?.data?.error ||
              error?.message ||
              (isPolish ? 'Nie udało się załadować danych' : 'Failed to load data');
        const msg = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
        toast.error(msg);
      } finally {
        setIsLoading(false);
        console.log('[AssignInterviewModal] Loading completed');
      }
    };

    loadData();
  }, [isOpen, isPolish]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTemplateId(preselectedTemplateId || '');
      setSelectedUserIds([]);
      setTeamLeadId('');
      setDueDate('');
      setPriority('medium');
      setNotes('');
      setIsTeamAssignment(false);
      setUserSearchQuery('');
      setTemplateSearchQuery('');
    }
  }, [isOpen, preselectedTemplateId]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    if (!templateSearchQuery) return templates;
    const query = templateSearchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query) ||
        getTemplateSourceLabel(t.scope, isPolish).toLowerCase().includes(query) ||
        (t.areaTags || []).join(' ').toLowerCase().includes(query)
    );
  }, [templates, templateSearchQuery, isPolish]);

  // Filter users
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery) return users;
    const query = userSearchQuery.toLowerCase();
    return users.filter(
      (u) => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)
    );
  }, [users, userSearchQuery]);

  // Get selected template
  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId);
  }, [templates, selectedTemplateId]);

  // Get selected users
  const selectedUsers = useMemo(() => {
    return users.filter((u) => selectedUserIds.includes(u.id));
  }, [users, selectedUserIds]);

  // Toggle user selection
  const toggleUserSelection = useCallback(
    (userId: string) => {
      setSelectedUserIds((prev) => {
        if (prev.includes(userId)) {
          // Remove user
          const newIds = prev.filter((id) => id !== userId);
          // If team lead was removed, clear team lead
          if (userId === teamLeadId) {
            setTeamLeadId('');
          }
          // If less than 2 users, disable team assignment
          if (newIds.length < 2) {
            setIsTeamAssignment(false);
          }
          return newIds;
        } else {
          return [...prev, userId];
        }
      });
    },
    [teamLeadId]
  );

  // Handle submit
  const handleSubmit = async () => {
    // Validation
    if (!selectedTemplateId) {
      toast.error(isPolish ? 'Wybierz szablon wywiadu' : 'Select an interview template');
      return;
    }
    if (selectedUserIds.length === 0) {
      toast.error(
        isPolish ? 'Wybierz co najmniej jednego użytkownika' : 'Select at least one user'
      );
      return;
    }
    if (!dueDate) {
      toast.error(isPolish ? 'Ustaw termin wykonania' : 'Set a due date');
      return;
    }
    if (isTeamAssignment && !teamLeadId) {
      toast.error(isPolish ? 'Wybierz lidera zespołu' : 'Select a team lead');
      return;
    }

    setIsSubmitting(true);
    try {
      await Api.post('/interview/assignments', {
        templateId: selectedTemplateId,
        assigneeUserIds: selectedUserIds,
        teamLeadId: isTeamAssignment ? teamLeadId : undefined,
        dueAt: new Date(dueDate).toISOString(),
        priority,
        notes: notes || undefined,
        projectId: currentProjectId || undefined,
      });

      toast.success(
        isPolish
          ? `Wywiad przydzielony do ${selectedUserIds.length} osób`
          : `Interview assigned to ${selectedUserIds.length} user(s)`
      );

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('[AssignInterviewModal] Failed to create assignment:', error);
      let errorMessage: string;
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.response?.data?.error) {
        const errData = error.response.data.error;
        errorMessage = typeof errData === 'string' ? errData : JSON.stringify(errData);
      } else if (error?.message) {
        errorMessage =
          typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
      } else {
        errorMessage = isPolish
          ? 'Nie udało się przydzielić wywiadu'
          : 'Failed to assign interview';
      }
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Debug: log when modal should be visible
  useEffect(() => {
    console.log('[AssignInterviewModal] Modal state:', {
      isOpen,
      templatesCount: templates.length,
      usersCount: users.length,
      isLoading,
    });
  }, [isOpen, templates.length, users.length, isLoading]);

  if (!isOpen) return null;

  console.log('[AssignInterviewModal] Rendering modal...');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <UserPlus size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isPolish ? 'Przydziel wywiad' : 'Assign Interview'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isPolish
                  ? 'Wybierz szablon i przydziel do użytkowników'
                  : 'Select a template and assign to users'}
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
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Template Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {isPolish ? 'Szablon wywiadu' : 'Interview Template'} *
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-left hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                  >
                    {selectedTemplate ? (
                      <div className="flex items-center gap-3">
                        <FileText size={18} className="text-blue-400" />
                        <div>
                          <span className="text-slate-900 dark:text-white block">
                            {selectedTemplate.name}
                          </span>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {selectedTemplate.category ? (
                              <span className="text-xs text-slate-500">
                                ({selectedTemplate.category})
                              </span>
                            ) : null}
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-300">
                              {getTemplateSourceLabel(selectedTemplate.scope, isPolish)}
                            </span>
                            {(selectedTemplate.areaTags || []).slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-300"
                              >
                                {getTemplateAreaTagLabel(tag, isPolish)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500">
                        {isPolish ? 'Wybierz szablon...' : 'Select template...'}
                      </span>
                    )}
                    <ChevronDown
                      size={18}
                      className={`text-slate-500 dark:text-slate-400 transition-transform ${
                        showTemplateDropdown ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {showTemplateDropdown && (
                    <div className="absolute z-10 w-full mt-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-slate-200 dark:border-navy-700">
                        <div className="relative">
                          <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                          />
                          <input
                            type="text"
                            value={templateSearchQuery}
                            onChange={(e) => setTemplateSearchQuery(e.target.value)}
                            placeholder={isPolish ? 'Szukaj szablonu...' : 'Search templates...'}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredTemplates.length > 0 ? (
                          filteredTemplates.map((template) => (
                            <button
                              key={template.id}
                              onClick={() => {
                                setSelectedTemplateId(template.id);
                                setShowTemplateDropdown(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                                template.id === selectedTemplateId ? 'bg-blue-500/10' : ''
                              }`}
                            >
                              <FileText size={16} className="text-blue-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-slate-900 dark:text-white block truncate">
                                  {template.name}
                                </span>
                                {template.description && (
                                  <span className="text-xs text-slate-500 block truncate">
                                    {template.description}
                                  </span>
                                )}
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-300">
                                    {getTemplateSourceLabel(template.scope, isPolish)}
                                  </span>
                                  {(template.areaTags || []).slice(0, 3).map((tag) => (
                                    <span
                                      key={tag}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-300"
                                    >
                                      {getTemplateAreaTagLabel(tag, isPolish)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              {template.id === selectedTemplateId && (
                                <Check size={16} className="text-blue-400 flex-shrink-0" />
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-6 text-center">
                            <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                              {isPolish ? 'Brak szablonów' : 'No templates found'}
                            </div>
                            {templates.length === 0 && !isLoading && (
                              <div className="text-xs text-slate-500 mt-2">
                                {isPolish
                                  ? 'Sprawdź konsolę przeglądarki (F12) dla szczegółów'
                                  : 'Check browser console (F12) for details'}
                              </div>
                            )}
                            {templateSearchQuery && templates.length > 0 && (
                              <div className="text-xs text-slate-500 mt-2">
                                {isPolish
                                  ? 'Spróbuj innej frazy wyszukiwania'
                                  : 'Try a different search term'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* User Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {isPolish ? 'Przydziel do' : 'Assign to'} *
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-left hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                  >
                    {selectedUsers.length > 0 ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        {selectedUsers.slice(0, 3).map((user) => (
                          <span
                            key={user.id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs"
                          >
                            {user.name}
                          </span>
                        ))}
                        {selectedUsers.length > 3 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            +{selectedUsers.length - 3} {isPolish ? 'więcej' : 'more'}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500">
                        {isPolish ? 'Wybierz użytkowników...' : 'Select users...'}
                      </span>
                    )}
                    <ChevronDown
                      size={18}
                      className={`text-slate-500 dark:text-slate-400 transition-transform ${
                        showUserDropdown ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {showUserDropdown && (
                    <div className="absolute z-10 w-full mt-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-slate-200 dark:border-navy-700">
                        <div className="relative">
                          <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                          />
                          <input
                            type="text"
                            value={userSearchQuery}
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                            placeholder={isPolish ? 'Szukaj użytkownika...' : 'Search users...'}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredUsers.length > 0 ? (
                          filteredUsers.map((user) => {
                            const isSelected = selectedUserIds.includes(user.id);
                            return (
                              <button
                                key={user.id}
                                onClick={() => toggleUserSelection(user.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                                  isSelected ? 'bg-blue-500/10' : ''
                                }`}
                              >
                                <div
                                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? 'bg-blue-500 border-blue-500'
                                      : 'border-slate-300 dark:border-navy-500 bg-white dark:bg-navy-900'
                                  }`}
                                >
                                  {isSelected && <Check size={12} className="text-white" />}
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-xs text-slate-700 dark:text-slate-300">
                                  {user.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm text-slate-900 dark:text-white block truncate">
                                    {user.name}
                                  </span>
                                  <span className="text-xs text-slate-500 block truncate">
                                    {user.email}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-4 py-6 text-center">
                            <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                              {isPolish ? 'Brak użytkowników' : 'No users found'}
                            </div>
                            {users.length === 0 && !isLoading && (
                              <div className="text-xs text-slate-500 mt-2">
                                {isPolish
                                  ? 'Sprawdź konsolę przeglądarki (F12) dla szczegółów'
                                  : 'Check browser console (F12) for details'}
                              </div>
                            )}
                            {userSearchQuery && users.length > 0 && (
                              <div className="text-xs text-slate-500 mt-2">
                                {isPolish
                                  ? 'Spróbuj innej frazy wyszukiwania'
                                  : 'Try a different search term'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Team Assignment Toggle */}
                {selectedUserIds.length >= 2 && (
                  <div className="mt-3 p-3 bg-slate-50 dark:bg-navy-800/50 border border-slate-200 dark:border-navy-700 rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isTeamAssignment}
                        onChange={(e) => setIsTeamAssignment(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-navy-500 bg-white dark:bg-navy-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                      />
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-slate-500 dark:text-slate-400" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {isPolish ? 'Przydzielenie zespołowe' : 'Team assignment'}
                        </span>
                      </div>
                    </label>

                    {isTeamAssignment && (
                      <div className="mt-3 pl-7">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                          {isPolish ? 'Lider zespołu' : 'Team Lead'}
                        </label>
                        <select
                          value={teamLeadId}
                          onChange={(e) => setTeamLeadId(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                        >
                          <option value="">
                            {isPolish ? 'Wybierz lidera...' : 'Select lead...'}
                          </option>
                          {selectedUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Due Date & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {isPolish ? 'Termin' : 'Due Date'} *
                  </label>
                  <div className="relative">
                    <Calendar
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                    />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {isPolish ? 'Priorytet' : 'Priority'}
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full px-3 py-3 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="low">{isPolish ? 'Niski' : 'Low'}</option>
                    <option value="medium">{isPolish ? 'Średni' : 'Medium'}</option>
                    <option value="high">{isPolish ? 'Wysoki' : 'High'}</option>
                    <option value="urgent">{isPolish ? 'Pilny' : 'Urgent'}</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {isPolish ? 'Notatki (opcjonalne)' : 'Notes (optional)'}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    isPolish
                      ? 'Dodatkowe instrukcje dla przydzielonych osób...'
                      : 'Additional instructions for assignees...'
                  }
                  rows={3}
                  className="w-full px-3 py-3 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              {/* Scope Warning */}
              {assignmentScope.type === 'projects' && (
                <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-300">
                    {isPolish
                      ? 'Możesz przydzielać wywiady tylko członkom projektów, w których masz rolę zarządzającą.'
                      : 'You can only assign interviews to members of projects where you have a management role.'}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/50">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {isPolish ? 'Przydzielanie...' : 'Assigning...'}
              </>
            ) : (
              <>
                <UserPlus size={16} />
                {isPolish ? 'Przydziel' : 'Assign'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignInterviewModal;
