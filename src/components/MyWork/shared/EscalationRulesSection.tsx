/**
 * EscalationRulesSection
 * Clean, structured reminder and escalation configuration
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowUpCircle,
  Bell,
  BellRing,
  ChevronDown,
  Mail,
  MessageSquare,
  Plus,
  Trash2,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ReminderRule {
  id: string;
  type: 'before_due' | 'after_due';
  days: number;
  recipients: 'requester' | 'decider' | 'both' | 'stakeholders';
  inAppNotification: boolean;
  emailNotification: boolean;
  message?: string;
  enabled: boolean;
}

export interface EscalationRule {
  id: string;
  enabled: boolean;
  escalateTo: string;
  escalateToName?: string;
  afterDays: number;
  message?: string;
}

export interface WarningThresholds {
  warningDays: number;
  criticalDays: number;
  showOverdueAlert: boolean;
}

interface EscalationRulesSectionProps {
  reminders: ReminderRule[];
  escalation: EscalationRule | null;
  thresholds: WarningThresholds;
  availableUsers: { id: string; name: string }[];
  onRemindersChange: (reminders: ReminderRule[]) => void;
  onEscalationChange: (escalation: EscalationRule | null) => void;
  onThresholdsChange: (thresholds: WarningThresholds) => void;
  readOnly?: boolean;
  dueDate?: string;
}

const RECIPIENT_OPTIONS = [
  { value: 'decider', label: { en: 'Decider', pl: 'Decydent' } },
  { value: 'requester', label: { en: 'Requester', pl: 'Zgłaszający' } },
  { value: 'both', label: { en: 'Both', pl: 'Obaj' } },
  { value: 'stakeholders', label: { en: 'All Stakeholders', pl: 'Wszyscy interesariusze' } },
];

// Consistent input styles
const INPUT_CLASS =
  'w-full h-9 px-3 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-400';
const SELECT_CLASS =
  'w-full h-9 px-3 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-400 cursor-pointer';
const LABEL_CLASS = 'text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block';

export const EscalationRulesSection: React.FC<EscalationRulesSectionProps> = ({
  reminders,
  escalation,
  thresholds,
  availableUsers,
  onRemindersChange,
  onEscalationChange,
  onThresholdsChange,
  readOnly = false,
  dueDate,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [isExpanded, setIsExpanded] = useState(false);

  const getDaysUntilDue = () => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const now = new Date();
    return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const daysUntilDue = getDaysUntilDue();

  const addReminder = () => {
    const newReminder: ReminderRule = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'before_due',
      days: 3,
      recipients: 'decider',
      inAppNotification: true,
      emailNotification: true,
      message: '',
      enabled: true,
    };
    onRemindersChange([...reminders, newReminder]);
  };

  const updateReminder = (id: string, updates: Partial<ReminderRule>) => {
    onRemindersChange(reminders.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const removeReminder = (id: string) => {
    onRemindersChange(reminders.filter((r) => r.id !== id));
  };

  const enableEscalation = () => {
    onEscalationChange({
      id: Math.random().toString(36).substr(2, 9),
      enabled: true,
      escalateTo: '',
      afterDays: 3,
    });
  };

  const disableEscalation = () => {
    onEscalationChange(null);
  };

  const activeRemindersCount = reminders.filter((r) => r.enabled).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/50 shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
    >
      {/* Header */}
      <motion.button
        whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/20">
            <BellRing size={18} className="text-amber-500 dark:text-amber-400" />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('myWork.escalationRules.remindersEscalation', 'Reminders & Escalation')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {activeRemindersCount > 0 && (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
              {activeRemindersCount}
            </span>
          )}
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
          </motion.div>
        </div>
      </motion.button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Reminders Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-blue-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {t('myWork.escalationRules.reminders', 'Reminders')}
                    </span>
                  </div>
                  {!readOnly && (
                    <button
                      onClick={addReminder}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 border border-primary-200 dark:border-primary-500/30 transition-colors"
                    >
                      <Plus size={14} />
                      {t('myWork.escalationRules.add', 'Add')}
                    </button>
                  )}
                </div>

                {reminders.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
                    <Bell size={24} className="mx-auto mb-2 text-slate-700 dark:text-slate-400" />
                    <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      {t('myWork.escalationRules.noReminders', 'No reminders')}
                    </p>
                    {!readOnly && (
                      <button
                        onClick={addReminder}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 border border-primary-200 dark:border-primary-500/30 transition-colors"
                      >
                        <Plus size={14} />
                        {t('myWork.escalationRules.addReminder', 'Add reminder')}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reminders.map((reminder, index) => (
                      <motion.div
                        key={reminder.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`rounded-xl border p-4 transition-all ${
                          reminder.enabled
                            ? 'border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800/50'
                            : 'border-slate-200 dark:border-navy-700/50 bg-slate-50 dark:bg-navy-900/30 opacity-60'
                        }`}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                updateReminder(reminder.id, { enabled: !reminder.enabled })
                              }
                              disabled={readOnly}
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                                reminder.enabled
                                  ? 'bg-navy-900 border-navy-900 text-white'
                                  : 'border-slate-300 dark:border-navy-600'
                              }`}
                            >
                              {reminder.enabled && <span className="text-xs">✓</span>}
                            </button>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {t('myWork.escalationRules.reminderNumber', 'Reminder {{number}}', {
                                number: index + 1,
                              })}
                            </span>
                          </div>
                          {!readOnly && (
                            <button
                              onClick={() => removeReminder(reminder.id)}
                              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/20 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        {/* Form Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* When - Type */}
                          <div>
                            <label className={LABEL_CLASS}>
                              {t('myWork.escalationRules.when', 'When')}
                            </label>
                            <select
                              value={reminder.type}
                              onChange={(e) =>
                                updateReminder(reminder.id, {
                                  type: e.target.value as ReminderRule['type'],
                                })
                              }
                              disabled={readOnly || !reminder.enabled}
                              className={SELECT_CLASS}
                            >
                              <option value="before_due">
                                {t('myWork.escalationRules.beforeDue', 'Before due')}
                              </option>
                              <option value="after_due">
                                {t('myWork.escalationRules.afterDue', 'After due')}
                              </option>
                            </select>
                          </div>

                          {/* Days */}
                          <div>
                            <label className={LABEL_CLASS}>
                              {t('myWork.escalationRules.days', 'Days')}
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="30"
                              value={reminder.days}
                              onChange={(e) =>
                                updateReminder(reminder.id, { days: parseInt(e.target.value) || 1 })
                              }
                              disabled={readOnly || !reminder.enabled}
                              className={INPUT_CLASS}
                            />
                          </div>

                          {/* To whom */}
                          <div className="col-span-2">
                            <label className={LABEL_CLASS}>
                              {t('myWork.escalationRules.toWhom', 'To whom')}
                            </label>
                            <select
                              value={reminder.recipients}
                              onChange={(e) =>
                                updateReminder(reminder.id, {
                                  recipients: e.target.value as ReminderRule['recipients'],
                                })
                              }
                              disabled={readOnly || !reminder.enabled}
                              className={SELECT_CLASS}
                            >
                              {RECIPIENT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {isPolish ? opt.label.pl : opt.label.en}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Notification toggles */}
                          <div>
                            <label className={LABEL_CLASS}>
                              {t('myWork.escalationRules.notification', 'Notification')}
                            </label>
                            <button
                              onClick={() =>
                                updateReminder(reminder.id, {
                                  inAppNotification: !reminder.inAppNotification,
                                })
                              }
                              disabled={readOnly || !reminder.enabled}
                              className={`${INPUT_CLASS} flex items-center justify-between cursor-pointer`}
                            >
                              <div className="flex items-center gap-2">
                                <Bell
                                  size={14}
                                  className={
                                    reminder.inAppNotification
                                      ? 'text-primary-500'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }
                                />
                                <span>{t('myWork.escalationRules.inApp', 'In-app')}</span>
                              </div>
                              <div
                                className={`w-8 h-5 rounded-full transition-colors relative ${
                                  reminder.inAppNotification
                                    ? 'bg-navy-900'
                                    : 'bg-slate-300 dark:bg-navy-600'
                                }`}
                              >
                                <div
                                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                    reminder.inAppNotification
                                      ? 'translate-x-3.5'
                                      : 'translate-x-0.5'
                                  }`}
                                />
                              </div>
                            </button>
                          </div>

                          <div>
                            <label className={LABEL_CLASS}>Email</label>
                            <button
                              onClick={() =>
                                updateReminder(reminder.id, {
                                  emailNotification: !reminder.emailNotification,
                                })
                              }
                              disabled={readOnly || !reminder.enabled}
                              className={`${INPUT_CLASS} flex items-center justify-between cursor-pointer`}
                            >
                              <div className="flex items-center gap-2">
                                <Mail
                                  size={14}
                                  className={
                                    reminder.emailNotification
                                      ? 'text-blue-500'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }
                                />
                                <span>{t('myWork.escalationRules.sendEmail', 'Send email')}</span>
                              </div>
                              <div
                                className={`w-8 h-5 rounded-full transition-colors relative ${
                                  reminder.emailNotification
                                    ? 'bg-blue-500'
                                    : 'bg-slate-300 dark:bg-navy-600'
                                }`}
                              >
                                <div
                                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                    reminder.emailNotification
                                      ? 'translate-x-3.5'
                                      : 'translate-x-0.5'
                                  }`}
                                />
                              </div>
                            </button>
                          </div>

                          {/* Message */}
                          <div className="col-span-2">
                            <label className={LABEL_CLASS}>
                              <div className="flex items-center gap-1.5">
                                <MessageSquare size={12} />
                                {t('myWork.escalationRules.messageOptional', 'Message (optional)')}
                              </div>
                            </label>
                            <input
                              type="text"
                              value={reminder.message || ''}
                              onChange={(e) =>
                                updateReminder(reminder.id, { message: e.target.value })
                              }
                              placeholder={t(
                                'myWork.escalationRules.optionalReminderMessage',
                                'Optional reminder message...'
                              )}
                              disabled={readOnly || !reminder.enabled}
                              className={INPUT_CLASS}
                            />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Escalation Section */}
              <div className="pt-3 border-t border-slate-200 dark:border-navy-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ArrowUpCircle size={16} className="text-amber-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {t('myWork.escalationRules.autoEscalation', 'Auto-Escalation')}
                    </span>
                  </div>
                  {!readOnly && (
                    <button
                      onClick={escalation ? disableEscalation : enableEscalation}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        escalation?.enabled
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-500/30'
                          : 'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-navy-600 hover:bg-slate-200 dark:hover:bg-navy-600'
                      }`}
                    >
                      {escalation
                        ? t('myWork.escalationRules.disable', 'Disable')
                        : t('myWork.escalationRules.enable', 'Enable')}
                    </button>
                  )}
                </div>

                {escalation ? (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/20"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      {/* After days */}
                      <div>
                        <label className={LABEL_CLASS}>
                          {t('myWork.escalationRules.afterDaysOverdue', 'After days overdue')}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={escalation.afterDays}
                          onChange={(e) =>
                            onEscalationChange({
                              ...escalation,
                              afterDays: parseInt(e.target.value) || 1,
                            })
                          }
                          disabled={readOnly}
                          className={INPUT_CLASS}
                        />
                      </div>

                      {/* Escalate to */}
                      <div>
                        <label className={LABEL_CLASS}>
                          {t('myWork.escalationRules.escalateTo', 'Escalate to')}
                        </label>
                        <select
                          value={escalation.escalateTo}
                          onChange={(e) => {
                            const user = availableUsers.find((u) => u.id === e.target.value);
                            onEscalationChange({
                              ...escalation,
                              escalateTo: e.target.value,
                              escalateToName: user?.name,
                            });
                          }}
                          disabled={readOnly}
                          className={SELECT_CLASS}
                        >
                          <option value="">
                            {t('myWork.escalationRules.selectPerson', 'Select person...')}
                          </option>
                          {availableUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Message */}
                      <div className="col-span-2">
                        <label className={LABEL_CLASS}>
                          {t('myWork.escalationRules.messageOptional2', 'Message (optional)')}
                        </label>
                        <input
                          type="text"
                          value={escalation.message || ''}
                          onChange={(e) =>
                            onEscalationChange({ ...escalation, message: e.target.value })
                          }
                          placeholder={t(
                            'myWork.escalationRules.placeholder',
                            'Escalation reason...'
                          )}
                          disabled={readOnly}
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="flex items-start gap-2 mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-500/20">
                      <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {t(
                          'myWork.escalationRules.escalationPreview',
                          'If decision is not made {{days}} days after due, it will be escalated to: ',
                          { days: escalation.afterDays }
                        )}
                        <span className="font-medium">
                          {escalation.escalateToName ||
                            t('myWork.escalationRules.selectPerson2', '(select person)')}
                        </span>
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
                    <ArrowUpCircle
                      size={24}
                      className="mx-auto mb-2 text-slate-700 dark:text-slate-400"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      {t('myWork.escalationRules.escalationDisabled', 'Escalation disabled')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EscalationRulesSection;
