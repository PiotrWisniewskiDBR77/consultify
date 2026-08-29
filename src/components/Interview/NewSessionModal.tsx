/**
 * NewSessionModal
 * Enhanced modal for creating interview assignments
 *
 * Supports:
 * - Starting for yourself
 * - Assigning to team members (single or multiple)
 * - Setting deadline and priority
 * - Adding notes
 */

import {
  AlertCircle,
  Calendar,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  User,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

type AssignmentMode = 'myself' | 'team';
type Priority = 'low' | 'medium' | 'high' | 'urgent';

interface Template {
  id: string;
  name: string;
  description?: string;
  category?: string;
  questionCount?: number;
  version: number;
  hasPublishedVersion?: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (assignment: any) => void;
  templates: Template[];
}

const PRIORITY_CONFIG: Record<Priority, { label: string; labelPl: string; color: string }> = {
  low: { label: 'Low', labelPl: 'Niski', color: 'bg-slate-500/20 text-slate-300' },
  medium: { label: 'Medium', labelPl: 'Sredni', color: 'bg-blue-500/20 text-blue-300' },
  high: { label: 'High', labelPl: 'Wysoki', color: 'bg-amber-500/20 text-amber-300' },
  urgent: { label: 'Urgent', labelPl: 'Pilny', color: 'bg-danger-500/20 text-danger-300' },
};

export const NewSessionModal: React.FC<NewSessionModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  templates,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { currentUser, currentProjectId } = useAppStore();

  // Form state
  const [mode, setMode] = useState<AssignmentMode>('myself');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [teamLeadId, setTeamLeadId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [notes, setNotes] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const requestKeyRef = React.useRef('');

  // Load team members
  useEffect(() => {
    if (!isOpen || mode !== 'team') return;

    const loadTeamMembers = async () => {
      setLoadingMembers(true);
      try {
        // Load project members or organization users
        const endpoint = currentProjectId ? `/projects/${currentProjectId}/members` : '/users';
        const res = await Api.get(endpoint);
        const members = Array.isArray(res) ? res : (res as any)?.users || [];
        setTeamMembers(
          members.map((m: any) => ({
            id: m.userId || m.id,
            name: m.userName || m.name || m.email,
            email: m.userEmail || m.email,
            role: m.projectRole || m.role,
          }))
        );
      } catch (err) {
        console.error('[NewSessionModal] Failed to load team members:', err);
      } finally {
        setLoadingMembers(false);
      }
    };

    loadTeamMembers();
  }, [isOpen, mode, currentProjectId]);

  // Set default due date (7 days from now)
  useEffect(() => {
    if (isOpen && !dueDate) {
      requestKeyRef.current =
        globalThis.crypto?.randomUUID?.() ?? `assignment-${Date.now()}-${Math.random()}`;
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      setDueDate(defaultDate.toISOString().split('T')[0]);
    }
  }, [isOpen]);

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      setMode('myself');
      setSelectedTemplateId('');
      setSelectedAssignees([]);
      setTeamLeadId('');
      setDueDate('');
      setPriority('medium');
      setNotes('');
    }
  }, [isOpen]);

  const handleToggleAssignee = useCallback(
    (userId: string) => {
      setSelectedAssignees((prev) => {
        if (prev.includes(userId)) {
          // If removing and this was the lead, clear lead
          if (teamLeadId === userId) {
            setTeamLeadId('');
          }
          return prev.filter((id) => id !== userId);
        }
        return [...prev, userId];
      });
    },
    [teamLeadId]
  );

  const handleSubmit = useCallback(async () => {
    // Validation
    if (!selectedTemplateId) {
      toast.error(t('interview.newSessionModal.pleaseSelectATemplate'));
      return;
    }

    if (!dueDate) {
      toast.error(t('interview.newSessionModal.pleaseSetADueDate'));
      return;
    }

    if (mode === 'team' && selectedAssignees.length === 0) {
      toast.error(t('interview.newSessionModal.pleaseSelectAtLeastOne'));
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'myself') {
        // Start for myself - create session directly from template
        const session = await Api.post(`/interview/templates/${selectedTemplateId}/use`, {
          projectId: currentProjectId,
          name: `Interview ${new Date().toLocaleDateString()}`,
        });
        toast.success(t('interview.newSessionModal.sessionCreated'));
        onCreated(session);
      } else {
        // Create assignment for team
        const assigneeIds = selectedAssignees.length > 0 ? selectedAssignees : [currentUser?.id];
        const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
        if (!selectedTemplate?.hasPublishedVersion || !Number.isInteger(selectedTemplate.version)) {
          throw new Error('Publish this template before assigning it.');
        }

        const assignment = await Api.post('/interview/assignments', {
          templateId: selectedTemplateId,
          templateVersion: selectedTemplate.version,
          idempotencyKey: requestKeyRef.current,
          assigneeUserIds: assigneeIds,
          teamLeadId: teamLeadId || assigneeIds[0],
          dueAt: new Date(dueDate).toISOString(),
          priority,
          notes: notes || undefined,
          projectId: currentProjectId,
        });
        toast.success(
          (assignment as any)?.splitAssignments
            ? t('interview.newSessionModal.createdSeparateAssignmentsCount', {
                count: (assignment as any)?.createdCount || assigneeIds.length,
              })
            : t('interview.newSessionModal.interviewAssigned')
        );
        onCreated(assignment);
      }
      onClose();
    } catch (err: any) {
      console.error('[NewSessionModal] Failed to create:', err);
      toast.error(err?.message || t('interview.newSessionModal.failedToCreate'));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    mode,
    selectedTemplateId,
    dueDate,
    selectedAssignees,
    teamLeadId,
    priority,
    notes,
    currentProjectId,
    currentUser,
    isPolish,
    onCreated,
    onClose,
  ]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
            <div>
              <h2 className="text-slate-900 dark:text-white font-semibold text-lg">
                {t('interview.newSessionModal.createInterview')}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {t('interview.newSessionModal.startForYourselfOrAssign')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Mode Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300 dark:text-slate-400">
                {t('interview.newSessionModal.mode')}
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setMode('myself')}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all
                    ${
                      mode === 'myself'
                        ? 'bg-c-info/15 border-c-info text-c-info'
                        : 'bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:border-slate-500'
                    }
                  `}
                >
                  <User size={18} />
                  {t('interview.newSessionModal.forMyself')}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('team')}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all
                    ${
                      mode === 'team'
                        ? 'bg-c-info/15 border-c-info text-c-info'
                        : 'bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:border-slate-500'
                    }
                  `}
                >
                  <Users size={18} />
                  {t('interview.newSessionModal.assignToTeam')}
                </button>
              </div>
            </div>

            {/* Template Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300 dark:text-slate-400">
                {t('interview.newSessionModal.template')} *
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-left hover:border-slate-500 transition-colors"
                >
                  {selectedTemplate ? (
                    <div>
                      <span className="text-slate-900 dark:text-white">
                        {selectedTemplate.name}
                      </span>
                      {selectedTemplate.questionCount && (
                        <span className="ml-2 text-xs text-slate-500">
                          ({selectedTemplate.questionCount}{' '}
                          {t('interview.newSessionModal.questions')})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-500">
                      {t('interview.newSessionModal.selectTemplate')}
                    </span>
                  )}
                  <ChevronDown size={16} className="text-slate-500 dark:text-slate-400" />
                </button>

                {showTemplateDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-10 max-h-60 overflow-auto bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-xl">
                    {templates
                      .filter((t) => (t as any).status === 'approved')
                      .map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => {
                            setSelectedTemplateId(template.id);
                            setShowTemplateDropdown(false);
                          }}
                          className={`
                          w-full flex items-center justify-between px-4 py-3 text-left transition-colors
                          ${
                            selectedTemplateId === template.id
                              ? 'bg-c-info/10 text-c-info'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700'
                          }
                        `}
                        >
                          <div>
                            <span className="font-medium">{template.name}</span>
                            {template.description && (
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                {template.description}
                              </p>
                            )}
                          </div>
                          {selectedTemplateId === template.id && (
                            <Check size={16} className="text-c-info" />
                          )}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Team Assignment - Assignees */}
            {mode === 'team' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300 dark:text-slate-400">
                  {t('interview.newSessionModal.assignees')} *
                </label>
                {loadingMembers ? (
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    {t('interview.newSessionModal.loading')}
                  </div>
                ) : (
                  <div className="max-h-40 overflow-auto space-y-1 bg-slate-50 dark:bg-navy-800/50 rounded-lg p-2 border border-slate-200 dark:border-navy-700">
                    {teamMembers.length === 0 ? (
                      <p className="text-slate-500 text-sm p-2">
                        {t('interview.newSessionModal.noTeamMembersAvailable')}
                      </p>
                    ) : (
                      teamMembers.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleToggleAssignee(member.id)}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
                            ${
                              selectedAssignees.includes(member.id)
                                ? 'bg-c-info/15 text-c-info'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700'
                            }
                          `}
                        >
                          <div
                            className={`
                            w-5 h-5 rounded border flex items-center justify-center transition-colors
                            ${
                              selectedAssignees.includes(member.id)
                                ? 'bg-navy-900 border-navy-900'
                                : 'border-slate-500'
                            }
                          `}
                          >
                            {selectedAssignees.includes(member.id) && (
                              <Check size={12} className="text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium truncate">{member.name}</span>
                            <span className="ml-2 text-xs text-slate-500">{member.email}</span>
                          </div>
                          {teamLeadId === member.id && (
                            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                              Lead
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Team Lead Selection */}
                {selectedAssignees.length > 1 && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      {t('interview.newSessionModal.teamLead')}
                    </label>
                    <select
                      value={teamLeadId}
                      onChange={(e) => setTeamLeadId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white text-sm"
                    >
                      <option value="">{t('interview.newSessionModal.selectLead')}</option>
                      {selectedAssignees.map((id) => {
                        const member = teamMembers.find((m) => m.id === id);
                        return member ? (
                          <option key={id} value={id}>
                            {member.name}
                          </option>
                        ) : null;
                      })}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Due Date */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300 dark:text-slate-400">
                {t('interview.newSessionModal.dueDate')} *
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
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
            </div>

            {/* Priority (only for team assignments) */}
            {mode === 'team' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300 dark:text-slate-400">
                  {t('interview.newSessionModal.priority')}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-left hover:border-slate-500 transition-colors"
                  >
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${PRIORITY_CONFIG[priority].color}`}
                    >
                      {t(
                        `interview.newSessionModal.priorityLabel.${priority}`,
                        PRIORITY_CONFIG[priority].label
                      )}
                    </span>
                    <ChevronDown size={16} className="text-slate-500 dark:text-slate-400" />
                  </button>

                  {showPriorityDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-xl">
                      {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setPriority(p);
                            setShowPriorityDropdown(false);
                          }}
                          className={`
                            w-full flex items-center justify-between px-4 py-3 text-left transition-colors
                            ${priority === p ? 'bg-c-info/10' : 'hover:bg-navy-700'}
                          `}
                        >
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${PRIORITY_CONFIG[p].color}`}
                          >
                            {t(
                              `interview.newSessionModal.priorityLabel.${p}`,
                              PRIORITY_CONFIG[p].label
                            )}
                          </span>
                          {priority === p && <Check size={16} className="text-c-info" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes (only for team assignments) */}
            {mode === 'team' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300 dark:text-slate-400">
                  {t('interview.newSessionModal.notesOptional')}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('interview.newSessionModal.addInstructionsForAssignees')}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white text-sm placeholder-slate-500 resize-none"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {t('interview.newSessionModal.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedTemplateId}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-c-text hover:bg-c-text-secondary text-c-bg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t('interview.newSessionModal.creating')}
                </>
              ) : (
                <>
                  <Plus size={16} />
                  {mode === 'myself'
                    ? t('interview.newSessionModal.start')
                    : t('interview.newSessionModal.assign')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default NewSessionModal;
