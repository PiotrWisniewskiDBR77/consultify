/**
 * EscalationRulesSection
 * Component for configuring escalation rules and reminders for decisions
 * ClickUp-style design following Golden Standard
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowUpCircle,
  Bell,
  Calendar,
  ChevronDown,
  Clock,
  Loader2,
  Plus,
  Save,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export interface ReminderRule {
  id: string;
  type: 'before_due' | 'overdue';
  daysOffset: number;
  recipients: 'requester' | 'decider' | 'both' | 'custom';
  customRecipients?: string[];
  enabled: boolean;
}

export interface EscalationRule {
  id: string;
  escalateTo: string; // User ID
  escalateToName?: string;
  afterDaysOverdue: number;
  notifyUsers: ('requester' | 'decider' | 'escalateTo')[];
  reason?: string;
  enabled: boolean;
}

export interface WarningThresholds {
  warningDays: number; // Days before due to show warning
  criticalDays: number; // Days before due to show critical
  showOverdueAlert: boolean;
}

interface EscalationRulesSectionProps {
  reminders: ReminderRule[];
  escalation: EscalationRule | null;
  thresholds: WarningThresholds;
  availableUsers: { id: string; name: string; avatar?: string }[];
  onSave: (data: {
    reminders: ReminderRule[];
    escalation: EscalationRule | null;
    thresholds: WarningThresholds;
  }) => Promise<void>;
  readOnly?: boolean;
  dueDate?: string;
}

export const EscalationRulesSection: React.FC<EscalationRulesSectionProps> = ({
  reminders: initialReminders,
  escalation: initialEscalation,
  thresholds: initialThresholds,
  availableUsers,
  onSave,
  readOnly = false,
  dueDate,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [reminders, setReminders] = useState<ReminderRule[]>(initialReminders);
  const [escalation, setEscalation] = useState<EscalationRule | null>(initialEscalation);
  const [thresholds, setThresholds] = useState<WarningThresholds>(initialThresholds);
  const [isExpanded, setIsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave({ reminders, escalation, thresholds });
      setHasChanges(false);
      toast.success(isPolish ? 'Zasady zapisane' : 'Rules saved');
    } catch (error) {
      toast.error(isPolish ? 'Nie udało się zapisać' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addReminder = () => {
    const newReminder: ReminderRule = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'before_due',
      daysOffset: 3,
      recipients: 'decider',
      enabled: true,
    };
    setReminders([...reminders, newReminder]);
    setHasChanges(true);
  };

  const updateReminder = (id: string, updates: Partial<ReminderRule>) => {
    setReminders(reminders.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    setHasChanges(true);
  };

  const removeReminder = (id: string) => {
    setReminders(reminders.filter((r) => r.id !== id));
    setHasChanges(true);
  };

  const toggleEscalation = () => {
    if (escalation) {
      setEscalation(null);
    } else {
      setEscalation({
        id: Math.random().toString(36).substr(2, 9),
        escalateTo: '',
        afterDaysOverdue: 7,
        notifyUsers: ['requester', 'decider', 'escalateTo'],
        enabled: true,
      });
    }
    setHasChanges(true);
  };

  const updateEscalation = (updates: Partial<EscalationRule>) => {
    if (escalation) {
      setEscalation({ ...escalation, ...updates });
      setHasChanges(true);
    }
  };

  const updateThresholds = (updates: Partial<WarningThresholds>) => {
    setThresholds({ ...thresholds, ...updates });
    setHasChanges(true);
  };

  // Calculate current status based on due date
  const getDueDateStatus = () => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { type: 'overdue', days: Math.abs(diffDays) };
    if (diffDays <= thresholds.criticalDays) return { type: 'critical', days: diffDays };
    if (diffDays <= thresholds.warningDays) return { type: 'warning', days: diffDays };
    return { type: 'normal', days: diffDays };
  };

  const dueDateStatus = getDueDateStatus();

  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Clock size={16} className="text-amber-500" />
          </div>
          <div className="text-left">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {isPolish ? 'Przypomnienia i eskalacja' : 'Reminders & Escalation'}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              {reminders.filter((r) => r.enabled).length > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {reminders.filter((r) => r.enabled).length}{' '}
                  {isPolish ? 'przypomnień' : 'reminders'}
                </span>
              )}
              {escalation?.enabled && (
                <span className="text-xs text-amber-500">
                  • {isPolish ? 'Eskalacja aktywna' : 'Escalation active'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Current Status Badge */}
          {dueDateStatus && (
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                dueDateStatus.type === 'overdue'
                  ? 'bg-red-500/20 text-red-500'
                  : dueDateStatus.type === 'critical'
                  ? 'bg-orange-500/20 text-orange-500'
                  : dueDateStatus.type === 'warning'
                  ? 'bg-amber-500/20 text-amber-500'
                  : 'bg-emerald-500/20 text-emerald-500'
              }`}
            >
              {dueDateStatus.type === 'overdue'
                ? `${dueDateStatus.days}d ${isPolish ? 'po terminie' : 'overdue'}`
                : `${dueDateStatus.days}d ${isPolish ? 'pozostało' : 'left'}`}
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-slate-200 dark:border-navy-700 pt-4">
              {/* Warning Thresholds */}
              <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Progi ostrzeżeń' : 'Warning Thresholds'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                      {isPolish ? '🟡 Ostrzeżenie (dni przed)' : '🟡 Warning (days before)'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={thresholds.warningDays}
                      onChange={(e) =>
                        updateThresholds({ warningDays: parseInt(e.target.value) || 3 })
                      }
                      disabled={readOnly}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-800 dark:text-white disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                      {isPolish ? '🟠 Krytyczne (dni przed)' : '🟠 Critical (days before)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={thresholds.criticalDays}
                      onChange={(e) =>
                        updateThresholds({ criticalDays: parseInt(e.target.value) || 1 })
                      }
                      disabled={readOnly}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-800 dark:text-white disabled:opacity-50"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={thresholds.showOverdueAlert}
                    onChange={(e) => updateThresholds({ showOverdueAlert: e.target.checked })}
                    disabled={readOnly}
                    className="rounded border-slate-300 dark:border-navy-600 text-primary-500"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {isPolish ? '🔴 Pokaż alert po terminie' : '🔴 Show overdue alert'}
                  </span>
                </label>
              </div>

              {/* Reminders */}
              <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-blue-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {isPolish ? 'Przypomnienia' : 'Reminders'}
                    </span>
                  </div>
                  {!readOnly && (
                    <button
                      onClick={addReminder}
                      className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600"
                    >
                      <Plus size={14} />
                      {isPolish ? 'Dodaj' : 'Add'}
                    </button>
                  )}
                </div>

                {reminders.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-3">
                    {isPolish ? 'Brak skonfigurowanych przypomnień' : 'No reminders configured'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {reminders.map((reminder) => (
                      <div
                        key={reminder.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          reminder.enabled
                            ? 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-600'
                            : 'bg-slate-100 dark:bg-navy-800/50 border-slate-200/50 dark:border-navy-700/50 opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={reminder.enabled}
                          onChange={(e) =>
                            updateReminder(reminder.id, { enabled: e.target.checked })
                          }
                          disabled={readOnly}
                          className="rounded border-slate-300 dark:border-navy-600 text-primary-500"
                        />

                        <select
                          value={reminder.type}
                          onChange={(e) =>
                            updateReminder(reminder.id, {
                              type: e.target.value as ReminderRule['type'],
                            })
                          }
                          disabled={readOnly || !reminder.enabled}
                          className="px-2 py-1 rounded text-xs bg-transparent border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300"
                        >
                          <option value="before_due">
                            {isPolish ? 'Przed terminem' : 'Before due'}
                          </option>
                          <option value="overdue">{isPolish ? 'Po terminie' : 'Overdue'}</option>
                        </select>

                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={reminder.daysOffset}
                          onChange={(e) =>
                            updateReminder(reminder.id, {
                              daysOffset: parseInt(e.target.value) || 1,
                            })
                          }
                          disabled={readOnly || !reminder.enabled}
                          className="w-16 px-2 py-1 rounded text-xs bg-transparent border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300"
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {isPolish ? 'dni' : 'days'}
                        </span>

                        <select
                          value={reminder.recipients}
                          onChange={(e) =>
                            updateReminder(reminder.id, {
                              recipients: e.target.value as ReminderRule['recipients'],
                            })
                          }
                          disabled={readOnly || !reminder.enabled}
                          className="px-2 py-1 rounded text-xs bg-transparent border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300"
                        >
                          <option value="decider">
                            {isPolish ? 'Decydent' : 'Decider'}
                          </option>
                          <option value="requester">
                            {isPolish ? 'Zgłaszający' : 'Requester'}
                          </option>
                          <option value="both">{isPolish ? 'Obaj' : 'Both'}</option>
                        </select>

                        {!readOnly && (
                          <button
                            onClick={() => removeReminder(reminder.id)}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Auto-Escalation */}
              <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ArrowUpCircle size={16} className="text-orange-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {isPolish ? 'Auto-eskalacja' : 'Auto-Escalation'}
                    </span>
                  </div>
                  {!readOnly && (
                    <button
                      onClick={toggleEscalation}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        escalation
                          ? 'bg-orange-500/20 text-orange-500'
                          : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {escalation
                        ? isPolish
                          ? 'Wyłącz'
                          : 'Disable'
                        : isPolish
                        ? 'Włącz'
                        : 'Enable'}
                    </button>
                  )}
                </div>

                {escalation ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          {isPolish ? 'Eskaluj do' : 'Escalate to'}
                        </label>
                        <select
                          value={escalation.escalateTo}
                          onChange={(e) => {
                            const user = availableUsers.find((u) => u.id === e.target.value);
                            updateEscalation({
                              escalateTo: e.target.value,
                              escalateToName: user?.name,
                            });
                          }}
                          disabled={readOnly}
                          className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-800 dark:text-white"
                        >
                          <option value="">{isPolish ? 'Wybierz osobę' : 'Select person'}</option>
                          {availableUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          {isPolish ? 'Po dniach spóźnienia' : 'After days overdue'}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={escalation.afterDaysOverdue}
                          onChange={(e) =>
                            updateEscalation({
                              afterDaysOverdue: parseInt(e.target.value) || 7,
                            })
                          }
                          disabled={readOnly}
                          className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-800 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">
                        {isPolish ? 'Powiadom' : 'Notify'}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(['requester', 'decider', 'escalateTo'] as const).map((recipient) => (
                          <label
                            key={recipient}
                            className="flex items-center gap-1.5 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={escalation.notifyUsers.includes(recipient)}
                              onChange={(e) => {
                                const newNotify = e.target.checked
                                  ? [...escalation.notifyUsers, recipient]
                                  : escalation.notifyUsers.filter((r) => r !== recipient);
                                updateEscalation({ notifyUsers: newNotify });
                              }}
                              disabled={readOnly}
                              className="rounded border-slate-300 dark:border-navy-600 text-primary-500"
                            />
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              {recipient === 'requester'
                                ? isPolish
                                  ? 'Zgłaszający'
                                  : 'Requester'
                                : recipient === 'decider'
                                ? isPolish
                                  ? 'Decydent'
                                  : 'Decider'
                                : isPolish
                                ? 'Osoba eskalacji'
                                : 'Escalation target'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {isPolish ? 'Powód eskalacji (opcjonalnie)' : 'Escalation reason (optional)'}
                      </label>
                      <input
                        type="text"
                        value={escalation.reason || ''}
                        onChange={(e) => updateEscalation({ reason: e.target.value })}
                        placeholder={
                          isPolish
                            ? 'np. Wymaga uwagi kierownictwa'
                            : 'e.g., Requires management attention'
                        }
                        disabled={readOnly}
                        className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-800 dark:text-white placeholder-slate-400"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-3">
                    {isPolish
                      ? 'Auto-eskalacja jest wyłączona'
                      : 'Auto-escalation is disabled'}
                  </p>
                )}
              </div>

              {/* Save Button */}
              {!readOnly && hasChanges && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 transition-colors"
                  >
                    {saving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    <span>{isPolish ? 'Zapisz zmiany' : 'Save changes'}</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EscalationRulesSection;
