import { Calendar, CheckSquare, Link as LinkIcon, Loader2, Save, Trash2, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { InitiativeService } from '../../services/initiativeService';
import { type IdempotencyState, resolveIdempotencyKey } from '../../utils/createIdempotencyKey';

interface TaskDetailModalProps {
  taskId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskSaved: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  isOpen,
  onClose,
  taskId,
  onTaskSaved,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [progress, setProgress] = useState(0);
  const [blockedReason, setBlockedReason] = useState('');
  const [checklist, setChecklist] = useState<{ id: string; text: string; completed: boolean }[]>(
    []
  );

  // Links
  const [initiativeId, setInitiativeId] = useState('');
  const [initiatives, setInitiatives] = useState<{ id: string; name: string }[]>([]);
  // Users
  const [assigneeId, setAssigneeId] = useState('');
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);

  // M02-003: idempotency key for the CREATE submission. Held in a ref (not
  // state) so a double-click inside the same tick sees the same value — a state
  // update would not have flushed yet, which is exactly the race that produced
  // the live duplicates ("Audyt 3 maszyn krytycznych pod PdM", 4 rows / 26s).
  // Survives failed attempts so a retry reuses the key; cleared on success and
  // whenever the modal opens for a new task (a deliberate new intention).
  const createIdempotencyRef = useRef<IdempotencyState | null>(null);

  useEffect(() => {
    loadInitiatives();
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      // API returns { users: [...], total: N }
      const response = await Api.get('/users');
      const usersArray = Array.isArray(response) ? response : response?.users || [];
      setUsers(
        usersArray.map((u: any) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName }))
      );
    } catch (error) {
      console.error('Failed to load users', error);
    }
  };

  const loadInitiatives = async () => {
    try {
      const data = await InitiativeService.getAll();
      // Handle both array and object response
      const initiativesArray = Array.isArray(data) ? data : (data as any)?.initiatives || [];
      setInitiatives(initiativesArray.map((i: any) => ({ id: i.id, name: i.name })));
    } catch (error) {
      console.error('Failed to load initiatives', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (taskId) {
        loadTask(taskId);
      } else {
        resetForm();
      }
    }
  }, [isOpen, taskId]);

  const resetForm = () => {
    // Opening the modal for a fresh create is a deliberate new intention —
    // never carry a previous submission's key into it.
    createIdempotencyRef.current = null;
    setTitle('');
    setDescription('');
    setStatus('todo');
    setPriority('medium');
    setDueDate('');
    setProgress(0);
    setBlockedReason('');
    setChecklist([]);
    setInitiativeId('');
    setAssigneeId('');
  };

  const loadTask = async (id: string) => {
    try {
      setLoading(true);
      const task = await Api.get(`/tasks/${id}`);
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
      setProgress(task.progress || 0);
      setBlockedReason(task.blockedReason || '');
      setChecklist(task.checklist || []);
      setInitiativeId(task.initiativeId || '');
      setAssigneeId(task.assigneeId || '');
    } catch (error) {
      console.error('Failed to load task', error);
      toast.error('Failed to load task details');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title,
        description,
        status,
        priority,
        dueDate: dueDate || null,
        progress,
        blockedReason: status === 'blocked' ? blockedReason : '',
        checklist,
        initiativeId: initiativeId || null,
        assigneeId: assigneeId || null,
      };

      if (taskId) {
        await Api.put(`/tasks/${taskId}`, payload);
        toast.success('Task updated');
      } else {
        // Global tasks might not have projectId initially
        const createPayload = { ...payload, projectId: null };
        // Same payload (double-click, retry after a timeout) -> same key, so the
        // server collapses it to one row. Edited payload -> new key, so a
        // corrected retry is NOT answered with the stale first attempt.
        const idem = resolveIdempotencyKey(createIdempotencyRef.current, createPayload);
        createIdempotencyRef.current = idem;
        await Api.post('/tasks', { ...createPayload, idempotencyKey: idem.key });
        // Success: the next create must be a genuinely new row.
        createIdempotencyRef.current = null;
        toast.success('Task created');
      }
      onTaskSaved();
    } catch (error) {
      console.error('Failed to save task', error);
      toast.error('Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const addChecklistItem = () => {
    setChecklist([
      ...checklist,
      { id: Math.random().toString(36).substr(2, 9), text: '', completed: false },
    ]);
  };

  const updateChecklistItem = (id: string, updates: any) => {
    setChecklist(checklist.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const removeChecklistItem = (id: string) => {
    setChecklist(checklist.filter((item) => item.id !== id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-toast flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-c-surface w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-c-border-subtle shrink-0">
          <h3 className="text-lg font-bold text-c-text">
            {taskId ? t('task.edit', 'Edit Task') : t('task.new', 'New Task')}
          </h3>
          <button
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="text-c-text-muted hover:text-c-text"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('task.title', 'Title')}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-c-border-subtle rounded-lg bg-c-surface-raised text-c-text focus:ring-2 focus:ring-c-focus outline-none"
                  placeholder="Enter task title"
                  autoFocus
                />
              </div>

              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-1">
                    {t('task.status', 'Status')}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-c-border-subtle rounded-lg bg-c-surface-raised text-c-text outline-none"
                  >
                    <option value="todo">Todo</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-1">
                    {t('task.priority', 'Priority')}
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-c-border-subtle rounded-lg bg-c-surface-raised text-c-text outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('task.dueDate', 'Due Date')}
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 text-c-text-muted" size={16} />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-c-border-subtle rounded-lg bg-c-surface-raised text-c-text outline-none"
                  />
                </div>
              </div>

              {/* Progress & Blocked Reason */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-medium text-c-text-secondary">Progress</label>
                    <span className="text-sm font-bold text-blue-600">{progress}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={progress}
                    onChange={(e) => setProgress(Number(e.target.value))}
                    className="w-full h-2 bg-c-surface-raised rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {status === 'blocked' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-bold text-danger-600 dark:text-danger-400 mb-1">
                      Reason for blocking
                    </label>
                    <input
                      type="text"
                      value={blockedReason}
                      onChange={(e) => setBlockedReason(e.target.value)}
                      className="w-full px-3 py-2 border border-danger-300 dark:border-danger-500/30 rounded-lg bg-danger-50 dark:bg-danger-500/10 text-danger-900 dark:text-white placeholder:text-danger-400 focus:ring-2 focus:ring-danger-500 outline-none"
                      placeholder="What is blocking this task?"
                    />
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('task.description', 'Description')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-c-border-subtle rounded-lg bg-c-surface-raised text-c-text focus:ring-2 focus:ring-c-focus outline-none resize-none"
                  placeholder="Add details..."
                />
              </div>

              {/* Checklist */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-c-text-secondary flex items-center gap-2">
                    <CheckSquare size={16} />
                    Subtasks
                  </label>
                  <button
                    onClick={addChecklistItem}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {checklist.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={(e) =>
                          updateChecklistItem(item.id, { completed: e.target.checked })
                        }
                        className="rounded border-c-border-subtle text-blue-600 focus:ring-c-focus"
                      />
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) => updateChecklistItem(item.id, { text: e.target.value })}
                        className="flex-1 px-2 py-1 text-sm border-b border-transparent focus:border-c-border-subtle text-c-text bg-transparent outline-none"
                        placeholder="Subtask..."
                      />
                      <button
                        onClick={() => removeChecklistItem(item.id)}
                        aria-label={t('myWork.tasks.removeSubtask', 'Remove subtask')}
                        className="text-c-text-muted hover:text-danger-500"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {checklist.length === 0 && (
                    <div className="text-xs text-c-text-muted italic">No subtasks</div>
                  )}
                </div>
              </div>

              {/* Links Section (Initiative Link) */}
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1 flex items-center gap-2">
                  <LinkIcon size={16} />
                  Linked Initiative
                </label>
                <select
                  value={initiativeId}
                  onChange={(e) => setInitiativeId(e.target.value)}
                  className="w-full px-3 py-2 border border-c-border-subtle rounded-lg bg-c-surface-raised text-c-text text-sm outline-none"
                >
                  <option value="">Select Initiative (Optional)</option>
                  {initiatives.map((initiative) => (
                    <option key={initiative.id} value={initiative.id}>
                      {initiative.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  Assignee
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 border border-c-border-subtle rounded-lg bg-c-surface-raised text-c-text text-sm outline-none"
                >
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-c-border-subtle flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised rounded-lg transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 text-sm font-medium bg-c-text text-c-surface hover:opacity-90 rounded-lg shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Task
          </button>
        </div>
      </div>
    </div>
  );
};
