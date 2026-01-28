/**
 * StakeholdersSection
 * Component for managing decision stakeholders (RACI model)
 * Responsible, Accountable, Consulted, Informed
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  Plus,
  Trash2,
  User,
  UserCheck,
  UserCog,
  Users,
  Eye,
  MessageSquare,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type StakeholderRole = 'responsible' | 'accountable' | 'consulted' | 'informed';

export interface Stakeholder {
  id: string;
  decisionId: string;
  userId: string;
  userName?: string;
  role: StakeholderRole;
  notifiedAt?: string;
  acknowledgedAt?: string;
}

interface StakeholdersSectionProps {
  stakeholders: Stakeholder[];
  availableUsers: { id: string; name: string; email?: string }[];
  onAdd: (userId: string, role: StakeholderRole) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  onRoleChange?: (userId: string, role: StakeholderRole) => Promise<void>;
  readOnly?: boolean;
}

const ROLE_CONFIG: Record<
  StakeholderRole,
  {
    label: { en: string; pl: string };
    description: { en: string; pl: string };
    icon: React.ElementType;
    color: string;
  }
> = {
  responsible: {
    label: { en: 'Responsible', pl: 'Odpowiedzialny' },
    description: { en: 'Does the work', pl: 'Wykonuje pracę' },
    icon: UserCog,
    color: 'text-blue-500 bg-blue-500/10',
  },
  accountable: {
    label: { en: 'Accountable', pl: 'Rozliczalny' },
    description: { en: 'Makes the final decision', pl: 'Podejmuje ostateczną decyzję' },
    icon: UserCheck,
    color: 'text-purple-500 bg-purple-500/10',
  },
  consulted: {
    label: { en: 'Consulted', pl: 'Konsultowany' },
    description: { en: 'Provides input', pl: 'Dostarcza opinię' },
    icon: MessageSquare,
    color: 'text-emerald-500 bg-emerald-500/10',
  },
  informed: {
    label: { en: 'Informed', pl: 'Informowany' },
    description: { en: 'Kept in the loop', pl: 'Informowany o postępach' },
    icon: Eye,
    color: 'text-slate-500 bg-slate-500/10',
  },
};

export const StakeholdersSection: React.FC<StakeholdersSectionProps> = ({
  stakeholders,
  availableUsers,
  onAdd,
  onRemove,
  onRoleChange,
  readOnly = false,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<StakeholderRole>('consulted');
  const [adding, setAdding] = useState(false);

  // Filter out already added users
  const availableToAdd = availableUsers.filter(
    (u) => !stakeholders.some((s) => s.userId === u.id)
  );

  const handleAdd = async () => {
    if (!selectedUserId) return;
    
    try {
      setAdding(true);
      await onAdd(selectedUserId, selectedRole);
      setSelectedUserId('');
      setShowAddForm(false);
    } catch {
      // Error handled by parent
    } finally {
      setAdding(false);
    }
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
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Users size={16} className="text-blue-500" />
          </div>
          <div className="text-left">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {isPolish ? 'Interesariusze (RACI)' : 'Stakeholders (RACI)'}
            </span>
            {stakeholders.length > 0 && (
              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                ({stakeholders.length})
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

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
                        <div className={`p-1 rounded ${config.color}`}>
                          <Icon size={12} />
                        </div>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          {isPolish ? config.label.pl : config.label.en}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          ({roleStakeholders.length})
                        </span>
                      </div>

                      {roleStakeholders.length > 0 ? (
                        <div className="space-y-1 ml-6">
                          {roleStakeholders.map((stakeholder) => (
                            <div
                              key={stakeholder.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-navy-800 group"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                                  <span className="text-[10px] font-medium text-white">
                                    {stakeholder.userName?.charAt(0).toUpperCase() || '?'}
                                  </span>
                                </div>
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                  {stakeholder.userName || stakeholder.userId}
                                </span>
                                {stakeholder.acknowledgedAt && (
                                  <span className="text-xs text-emerald-500">✓</span>
                                )}
                              </div>

                              {!readOnly && (
                                <button
                                  onClick={() => onRemove(stakeholder.userId)}
                                  className="p-1 rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 dark:text-slate-500 ml-6 italic">
                          {isPolish ? 'Brak' : 'None'}
                        </p>
                      )}
                    </div>
                  );
                }
              )}

              {/* Add Form */}
              {!readOnly && (
                <>
                  {showAddForm ? (
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-navy-800 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                            {isPolish ? 'Osoba' : 'Person'}
                          </label>
                          <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300"
                          >
                            <option value="">{isPolish ? 'Wybierz...' : 'Select...'}</option>
                            {availableToAdd.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                            {isPolish ? 'Rola' : 'Role'}
                          </label>
                          <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value as StakeholderRole)}
                            className="w-full px-2 py-1.5 rounded-lg text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300"
                          >
                            {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                              <option key={role} value={role}>
                                {isPolish ? config.label.pl : config.label.en}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setShowAddForm(false)}
                          className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
                        >
                          {isPolish ? 'Anuluj' : 'Cancel'}
                        </button>
                        <button
                          onClick={handleAdd}
                          disabled={!selectedUserId || adding}
                          className="px-3 py-1.5 text-xs bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
                        >
                          {isPolish ? 'Dodaj' : 'Add'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddForm(true)}
                      disabled={availableToAdd.length === 0}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-primary-300 dark:hover:border-primary-500/50 hover:text-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={14} />
                      <span className="text-sm">
                        {isPolish ? 'Dodaj interesariusza' : 'Add stakeholder'}
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StakeholdersSection;
