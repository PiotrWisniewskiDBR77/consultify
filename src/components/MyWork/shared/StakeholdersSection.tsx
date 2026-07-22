/**
 * StakeholdersSection
 * Enhanced component for managing decision stakeholders (RACI model)
 * Includes notification settings per stakeholder
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  BellOff,
  Check,
  ChevronDown,
  Clock,
  Eye,
  Mail,
  MessageSquare,
  Plus,
  Settings,
  Trash2,
  User,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type StakeholderRole = 'responsible' | 'accountable' | 'consulted' | 'informed';

export type NotificationTrigger =
  | 'on_create'
  | 'on_update'
  | 'on_comment'
  | 'on_status_change'
  | 'on_deadline_approaching'
  | 'on_decision_made';

export interface StakeholderNotificationSettings {
  enabled: boolean;
  triggers: NotificationTrigger[];
  emailEnabled: boolean;
  inAppEnabled: boolean;
  // Optional external channels for cross-system synchronization.
  integrationChannels?: Array<'slack' | 'teams' | 'jira' | 'webhook'>;
  // Optional sync destinations, e.g. "jira:PROJ", "asana:workspace-a", webhook aliases.
  syncTargets?: string[];
}

export interface Stakeholder {
  id: string;
  decisionId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  role: StakeholderRole;
  notificationSettings: StakeholderNotificationSettings;
  notifiedAt?: string;
  acknowledgedAt?: string;
}

interface StakeholdersSectionProps {
  stakeholders: Stakeholder[];
  availableUsers: { id: string; name: string; email?: string }[];
  onAdd: (
    userId: string,
    role: StakeholderRole,
    notificationSettings: StakeholderNotificationSettings
  ) => void;
  onUpdate: (id: string, updates: Partial<Stakeholder>) => void;
  onRemove: (id: string) => void;
  readOnly?: boolean;
}

const ROLE_CONFIG: Record<
  StakeholderRole,
  {
    label: { en: string; pl: string };
    description: { en: string; pl: string };
    icon: React.ElementType;
    color: string;
    bgColor: string;
    defaultTriggers: NotificationTrigger[];
  }
> = {
  accountable: {
    label: { en: 'Accountable', pl: 'Rozliczany' },
    description: { en: 'Makes the final decision', pl: 'Podejmuje ostateczną decyzję' },
    icon: UserCheck,
    color: 'text-c-text',
    bgColor: 'bg-c-surface-raised',
    defaultTriggers: [
      'on_create',
      'on_update',
      'on_comment',
      'on_status_change',
      'on_deadline_approaching',
    ],
  },
  responsible: {
    label: { en: 'Responsible', pl: 'Odpowiedzialny' },
    description: { en: 'Does the work', pl: 'Wykonuje pracę' },
    icon: UserCog,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    defaultTriggers: ['on_create', 'on_update', 'on_comment', 'on_deadline_approaching'],
  },
  consulted: {
    label: { en: 'Consulted', pl: 'Konsultowany' },
    description: { en: 'Provides input', pl: 'Dostarcza opinię' },
    icon: MessageSquare,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    defaultTriggers: ['on_create', 'on_comment'],
  },
  informed: {
    label: { en: 'Informed', pl: 'Informowany' },
    description: { en: 'Kept in the loop', pl: 'Informowany o postępach' },
    icon: Eye,
    color: 'text-slate-500',
    bgColor: 'bg-slate-500/10',
    defaultTriggers: ['on_status_change', 'on_decision_made'],
  },
};

const NOTIFICATION_TRIGGERS: Record<NotificationTrigger, { en: string; pl: string }> = {
  on_create: { en: 'When created', pl: 'Przy utworzeniu' },
  on_update: { en: 'When updated', pl: 'Przy aktualizacji' },
  on_comment: { en: 'New comment', pl: 'Nowy komentarz' },
  on_status_change: { en: 'Status change', pl: 'Zmiana statusu' },
  on_deadline_approaching: { en: 'Deadline approaching', pl: 'Zbliżający się termin' },
  on_decision_made: { en: 'Decision made', pl: 'Decyzja podjęta' },
};

export const StakeholdersSection: React.FC<StakeholdersSectionProps> = ({
  stakeholders,
  availableUsers,
  onAdd,
  onUpdate,
  onRemove,
  readOnly = false,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<StakeholderRole>('consulted');
  const [expandedStakeholderId, setExpandedStakeholderId] = useState<string | null>(null);

  // Filter out already added users
  const availableToAdd = availableUsers.filter((u) => !stakeholders.some((s) => s.userId === u.id));

  const handleAdd = () => {
    if (!selectedUserId) return;

    const roleConfig = ROLE_CONFIG[selectedRole];
    const user = availableUsers.find((u) => u.id === selectedUserId);

    const defaultSettings: StakeholderNotificationSettings = {
      enabled: true,
      triggers: roleConfig.defaultTriggers,
      emailEnabled: true,
      inAppEnabled: true,
    };

    onAdd(selectedUserId, selectedRole, defaultSettings);
    setSelectedUserId('');
    setShowAddForm(false);
  };

  const toggleTrigger = (stakeholderId: string, trigger: NotificationTrigger) => {
    const stakeholder = stakeholders.find((s) => s.id === stakeholderId);
    if (!stakeholder) return;

    const currentTriggers = stakeholder.notificationSettings.triggers;
    const newTriggers = currentTriggers.includes(trigger)
      ? currentTriggers.filter((t) => t !== trigger)
      : [...currentTriggers, trigger];

    onUpdate(stakeholderId, {
      notificationSettings: {
        ...stakeholder.notificationSettings,
        triggers: newTriggers,
      },
    });
  };

  const toggleNotifications = (stakeholderId: string) => {
    const stakeholder = stakeholders.find((s) => s.id === stakeholderId);
    if (!stakeholder) return;

    onUpdate(stakeholderId, {
      notificationSettings: {
        ...stakeholder.notificationSettings,
        enabled: !stakeholder.notificationSettings.enabled,
      },
    });
  };

  const groupedStakeholders = stakeholders.reduce(
    (acc, s) => {
      acc[s.role] = acc[s.role] || [];
      acc[s.role].push(s);
      return acc;
    },
    {} as Record<StakeholderRole, Stakeholder[]>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-navy-700/50 shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
    >
      {/* Header */}
      <motion.button
        whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 dark:bg-blue-500/20">
            <Users size={18} className="text-blue-500 dark:text-blue-400" />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('myWork.stakeholders.stakeholdersRACI', 'Stakeholders (RACI)')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {stakeholders.length > 0 && (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-500">
              {stakeholders.length}
            </span>
          )}
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} className="text-slate-600" />
          </motion.div>
        </div>
      </motion.button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-slate-200 dark:border-navy-700 pt-3">
              {/* Grouped by Role */}
              {(['accountable', 'responsible', 'consulted', 'informed'] as StakeholderRole[]).map(
                (role) => {
                  const roleStakeholders = groupedStakeholders[role] || [];
                  const config = ROLE_CONFIG[role];
                  const Icon = config.icon;

                  return (
                    <div key={role}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                          <Icon size={14} className={config.color} />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {isPolish ? config.label.pl : config.label.en}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-500">
                          ({roleStakeholders.length})
                        </span>
                        <span className="text-[10px] text-slate-600 dark:text-slate-500 italic hidden sm:inline">
                          - {isPolish ? config.description.pl : config.description.en}
                        </span>
                      </div>

                      {roleStakeholders.length > 0 ? (
                        <div className="space-y-2 ml-6">
                          {roleStakeholders.map((stakeholder) => {
                            const isStakeholderExpanded = expandedStakeholderId === stakeholder.id;

                            return (
                              <motion.div
                                key={stakeholder.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`rounded-xl border overflow-hidden transition-all ${
                                  isStakeholderExpanded
                                    ? 'border-c-border-strong bg-c-surface-raised'
                                    : 'border-slate-200 dark:border-navy-600 bg-slate-50 dark:bg-navy-800/50'
                                }`}
                              >
                                {/* Stakeholder Row */}
                                <div className="flex items-center justify-between p-2.5 group">
                                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs font-medium text-white">
                                        {stakeholder.userName?.charAt(0).toUpperCase() || '?'}
                                      </span>
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block truncate">
                                        {stakeholder.userName || stakeholder.userId}
                                      </span>
                                      {stakeholder.userEmail && (
                                        <span className="text-[10px] text-slate-600 dark:text-slate-500 truncate block">
                                          {stakeholder.userEmail}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    {/* Notification Status */}
                                    <button
                                      onClick={() => toggleNotifications(stakeholder.id)}
                                      className={`p-1.5 rounded-lg transition-colors ${
                                        stakeholder.notificationSettings.enabled
                                          ? 'text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20'
                                          : 'text-slate-600 bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600'
                                      }`}
                                      title={
                                        stakeholder.notificationSettings.enabled
                                          ? t(
                                              'myWork.stakeholders.notificationsEnabled',
                                              'Notifications enabled'
                                            )
                                          : t(
                                              'myWork.stakeholders.notificationsDisabled',
                                              'Notifications disabled'
                                            )
                                      }
                                    >
                                      {stakeholder.notificationSettings.enabled ? (
                                        <Bell size={14} />
                                      ) : (
                                        <BellOff size={14} />
                                      )}
                                    </button>

                                    {/* Settings Toggle */}
                                    <button
                                      onClick={() =>
                                        setExpandedStakeholderId(
                                          isStakeholderExpanded ? null : stakeholder.id
                                        )
                                      }
                                      className={`p-1.5 rounded-lg transition-colors ${
                                        isStakeholderExpanded
                                          ? 'text-c-text bg-c-surface-raised'
                                          : 'text-slate-600 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-700'
                                      }`}
                                      title={t('myWork.stakeholders.title', 'Settings')}
                                    >
                                      <Settings size={14} />
                                    </button>

                                    {/* Remove Button */}
                                    {!readOnly && (
                                      <button
                                        onClick={() => onRemove(stakeholder.id)}
                                        className="p-1.5 rounded-lg text-slate-600 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/20 transition-colors opacity-0 group-hover:opacity-100"
                                        title={t('myWork.stakeholders.title2', 'Remove')}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Expanded Settings */}
                                <AnimatePresence>
                                  {isStakeholderExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="px-3 pb-3 pt-2 border-t border-slate-200 dark:border-navy-600 space-y-3">
                                        {/* Notification Triggers */}
                                        <div>
                                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                                            {t('myWork.stakeholders.notifyWhen', 'Notify when:')}
                                          </label>
                                          <div className="flex flex-wrap gap-1.5">
                                            {Object.entries(NOTIFICATION_TRIGGERS).map(
                                              ([trigger, label]) => {
                                                const isActive =
                                                  stakeholder.notificationSettings.triggers.includes(
                                                    trigger as NotificationTrigger
                                                  );
                                                return (
                                                  <button
                                                    key={trigger}
                                                    onClick={() =>
                                                      toggleTrigger(
                                                        stakeholder.id,
                                                        trigger as NotificationTrigger
                                                      )
                                                    }
                                                    disabled={readOnly}
                                                    className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                                                      isActive
                                                        ? 'bg-navy-900 text-white'
                                                        : 'bg-slate-100 dark:bg-navy-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-600'
                                                    } ${readOnly ? 'cursor-not-allowed' : ''}`}
                                                  >
                                                    {isPolish ? label.pl : label.en}
                                                  </button>
                                                );
                                              }
                                            )}
                                          </div>
                                        </div>

                                        {/* Notification Channels */}
                                        <div className="flex gap-3">
                                          <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={
                                                stakeholder.notificationSettings.emailEnabled
                                              }
                                              onChange={() =>
                                                onUpdate(stakeholder.id, {
                                                  notificationSettings: {
                                                    ...stakeholder.notificationSettings,
                                                    emailEnabled:
                                                      !stakeholder.notificationSettings
                                                        .emailEnabled,
                                                  },
                                                })
                                              }
                                              disabled={readOnly}
                                              className="w-3.5 h-3.5 rounded border-slate-300 dark:border-navy-600 text-c-text focus:ring-c-focus"
                                            />
                                            <Mail size={12} className="text-slate-600" />
                                            <span className="text-xs text-slate-600 dark:text-slate-400">
                                              Email
                                            </span>
                                          </label>
                                          <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={
                                                stakeholder.notificationSettings.inAppEnabled
                                              }
                                              onChange={() =>
                                                onUpdate(stakeholder.id, {
                                                  notificationSettings: {
                                                    ...stakeholder.notificationSettings,
                                                    inAppEnabled:
                                                      !stakeholder.notificationSettings
                                                        .inAppEnabled,
                                                  },
                                                })
                                              }
                                              disabled={readOnly}
                                              className="w-3.5 h-3.5 rounded border-slate-300 dark:border-navy-600 text-c-text focus:ring-c-focus"
                                            />
                                            <Bell size={12} className="text-slate-600" />
                                            <span className="text-xs text-slate-600 dark:text-slate-400">
                                              {t('myWork.stakeholders.inApp', 'In-app')}
                                            </span>
                                          </label>
                                        </div>

                                        {/* Acknowledged status */}
                                        {stakeholder.acknowledgedAt && (
                                          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                                            <Check size={12} />
                                            <span>
                                              {t(
                                                'myWork.stakeholders.acknowledged',
                                                'Acknowledged'
                                              )}{' '}
                                              {new Date(
                                                stakeholder.acknowledgedAt
                                              ).toLocaleDateString()}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="ml-6 py-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-500"
                        >
                          <div className="w-4 h-4 rounded-full border-2 border-dashed border-slate-300 dark:border-navy-600" />
                          <span className="italic">{t('myWork.stakeholders.none', 'None')}</span>
                        </motion.div>
                      )}
                    </div>
                  );
                }
              )}

              {/* Add Form */}
              {!readOnly && (
                <>
                  {showAddForm ? (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                            {t('myWork.stakeholders.person', 'Person')}
                          </label>
                          <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-c-focus"
                          >
                            <option value="">{t('myWork.stakeholders.select', 'Select...')}</option>
                            {availableToAdd.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                            {t('myWork.stakeholders.role', 'Role')}
                          </label>
                          <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value as StakeholderRole)}
                            className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-c-focus"
                          >
                            {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                              <option key={role} value={role}>
                                {isPolish ? config.label.pl : config.label.en}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Role description */}
                      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-700 px-3 py-2 rounded-lg">
                        {isPolish
                          ? ROLE_CONFIG[selectedRole].description.pl
                          : ROLE_CONFIG[selectedRole].description.en}
                        <span className="block mt-1 text-[10px] text-slate-600">
                          {t('myWork.stakeholders.defaultNotifications', 'Default notifications: ')}
                          {ROLE_CONFIG[selectedRole].defaultTriggers
                            .map((t) =>
                              isPolish ? NOTIFICATION_TRIGGERS[t].pl : NOTIFICATION_TRIGGERS[t].en
                            )
                            .join(', ')}
                        </span>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setShowAddForm(false)}
                          className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
                        >
                          {t('myWork.stakeholders.cancel', 'Cancel')}
                        </button>
                        <button
                          onClick={handleAdd}
                          disabled={!selectedUserId}
                          className="px-4 py-2 text-xs font-medium bg-c-text text-c-bg rounded-lg hover:bg-c-text-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {t('myWork.stakeholders.add', 'Add')}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowAddForm(true)}
                      disabled={availableToAdd.length === 0}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 dark:hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      <Plus size={16} />
                      <span className="text-sm">
                        {availableToAdd.length === 0
                          ? t('myWork.stakeholders.allUsersAdded', 'All users added')
                          : t('myWork.stakeholders.addStakeholder', 'Add stakeholder')}
                      </span>
                    </motion.button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StakeholdersSection;
