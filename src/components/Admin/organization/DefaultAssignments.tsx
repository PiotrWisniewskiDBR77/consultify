/**
 * DefaultAssignments - Default assignments for new users component
 *
 * Features:
 * - Default team assignment
 * - Default role assignment
 * - Default workspace permissions
 * - Onboarding settings
 *
 * Design: Form with dropdowns and toggles
 */

import {
  Briefcase,
  CheckCircle,
  HelpCircle,
  Save,
  Settings,
  Shield,
  Star,
  Users,
} from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Team option
export interface TeamOption {
  id: string;
  name: string;
  memberCount: number;
}

// Role option
export interface RoleOption {
  id: string;
  name: string;
  description?: string;
}

// Default assignments config
export interface DefaultAssignmentsConfig {
  defaultTeamId: string | null;
  defaultRoleId: string | null;
  defaultWorkspaceAccess: 'full' | 'limited' | 'none';
  autoJoinPublicChannels: boolean;
  sendWelcomeEmail: boolean;
  requireProfileCompletion: boolean;
  autoAssignMentor: boolean;
  defaultMentorId?: string;
  probationPeriodDays: number;
}

interface DefaultAssignmentsProps {
  config: DefaultAssignmentsConfig;
  teams: TeamOption[];
  roles: RoleOption[];
  mentors?: { id: string; name: string }[];
  onChange: (config: DefaultAssignmentsConfig) => void;
  onSave?: () => void;
  className?: string;
}

export const DefaultAssignments: React.FC<DefaultAssignmentsProps> = ({
  config,
  teams,
  roles,
  mentors = [],
  onChange,
  onSave,
  className,
}) => {
  const { t } = useTranslation();

  // Update config
  const updateConfig = useCallback(
    <K extends keyof DefaultAssignmentsConfig>(key: K, value: DefaultAssignmentsConfig[K]) => {
      onChange({ ...config, [key]: value });
    },
    [config, onChange]
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            {t('admin.organization.defaults.title', 'Default Assignments')}
            <Tooltip
              content={t(
                'admin.organization.defaults.tooltip',
                'Configure what happens when new users join'
              )}
            >
              <HelpCircle size={16} className="text-slate-600 dark:text-slate-500" />
            </Tooltip>
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('admin.organization.defaults.subtitle', 'Settings applied to all new users')}
          </p>
        </div>
        {onSave && (
          <Button variant="outline" size="sm" onClick={onSave} icon={<Save size={16} />}>
            {t('admin.organization.defaults.save', 'Save Changes')}
          </Button>
        )}
      </div>

      {/* Team Assignment */}
      <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-primary-500" />
          <h4 className="font-medium text-navy-900 dark:text-white">
            {t('admin.organization.defaults.teamAssignment', 'Team Assignment')}
          </h4>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
            {t('admin.organization.defaults.defaultTeam', 'Default Team')}
          </label>
          <select
            value={config.defaultTeamId || ''}
            onChange={(e) => updateConfig('defaultTeamId', e.target.value || null)}
            className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
          >
            <option value="">
              {t('admin.organization.defaults.noDefaultTeam', 'No default team')}
            </option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.memberCount} members)
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'admin.organization.defaults.teamHelp',
              'New users will automatically be added to this team'
            )}
          </p>
        </div>
      </div>

      {/* Role Assignment */}
      <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-blue-500" />
          <h4 className="font-medium text-navy-900 dark:text-white">
            {t('admin.organization.defaults.roleAssignment', 'Role & Permissions')}
          </h4>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t('admin.organization.defaults.defaultRole', 'Default Role')}
            </label>
            <select
              value={config.defaultRoleId || ''}
              onChange={(e) => updateConfig('defaultRoleId', e.target.value || null)}
              className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
            >
              <option value="">
                {t('admin.organization.defaults.noDefaultRole', 'No default role')}
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t('admin.organization.defaults.workspaceAccess', 'Workspace Access')}
            </label>
            <select
              value={config.defaultWorkspaceAccess}
              onChange={(e) =>
                updateConfig(
                  'defaultWorkspaceAccess',
                  e.target.value as 'full' | 'limited' | 'none'
                )
              }
              className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
            >
              <option value="full">
                {t('admin.organization.defaults.accessFull', 'Full Access')}
              </option>
              <option value="limited">
                {t('admin.organization.defaults.accessLimited', 'Limited Access')}
              </option>
              <option value="none">
                {t('admin.organization.defaults.accessNone', 'No Access (Manual Approval)')}
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Onboarding Settings */}
      <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-2 mb-4">
          <Star size={18} className="text-amber-500" />
          <h4 className="font-medium text-navy-900 dark:text-white">
            {t('admin.organization.defaults.onboarding', 'Onboarding')}
          </h4>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-900 rounded-lg cursor-pointer">
            <div>
              <p className="font-medium text-navy-900 dark:text-white">
                {t('admin.organization.defaults.welcomeEmail', 'Send welcome email')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'admin.organization.defaults.welcomeEmailDesc',
                  'Send a personalized welcome email to new users'
                )}
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.sendWelcomeEmail}
              onChange={(e) => updateConfig('sendWelcomeEmail', e.target.checked)}
              className="rounded border-slate-300 dark:border-navy-700"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-900 rounded-lg cursor-pointer">
            <div>
              <p className="font-medium text-navy-900 dark:text-white">
                {t('admin.organization.defaults.autoJoinChannels', 'Auto-join public channels')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'admin.organization.defaults.autoJoinDesc',
                  'Automatically add to all public channels'
                )}
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.autoJoinPublicChannels}
              onChange={(e) => updateConfig('autoJoinPublicChannels', e.target.checked)}
              className="rounded border-slate-300 dark:border-navy-700"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-900 rounded-lg cursor-pointer">
            <div>
              <p className="font-medium text-navy-900 dark:text-white">
                {t('admin.organization.defaults.requireProfile', 'Require profile completion')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'admin.organization.defaults.requireProfileDesc',
                  'Prompt users to complete their profile on first login'
                )}
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.requireProfileCompletion}
              onChange={(e) => updateConfig('requireProfileCompletion', e.target.checked)}
              className="rounded border-slate-300 dark:border-navy-700"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-900 rounded-lg cursor-pointer">
            <div>
              <p className="font-medium text-navy-900 dark:text-white">
                {t('admin.organization.defaults.autoMentor', 'Auto-assign mentor')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'admin.organization.defaults.autoMentorDesc',
                  'Assign a mentor to help onboard new users'
                )}
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.autoAssignMentor}
              onChange={(e) => updateConfig('autoAssignMentor', e.target.checked)}
              className="rounded border-slate-300 dark:border-navy-700"
            />
          </label>

          {config.autoAssignMentor && mentors.length > 0 && (
            <div className="ml-4">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t('admin.organization.defaults.defaultMentor', 'Default Mentor')}
              </label>
              <select
                value={config.defaultMentorId || ''}
                onChange={(e) => updateConfig('defaultMentorId', e.target.value || undefined)}
                className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
              >
                <option value="">
                  {t('admin.organization.defaults.autoSelect', 'Auto-select based on team')}
                </option>
                {mentors.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Probation Period */}
      <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase size={18} className="text-emerald-500" />
          <h4 className="font-medium text-navy-900 dark:text-white">
            {t('admin.organization.defaults.probation', 'Probation Period')}
          </h4>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
            {t('admin.organization.defaults.probationDays', 'Probation period (days)')}
          </label>
          <input
            type="number"
            min="0"
            max="365"
            value={config.probationPeriodDays}
            onChange={(e) => updateConfig('probationPeriodDays', parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {config.probationPeriodDays > 0
              ? t(
                  'admin.organization.defaults.probationActive',
                  'New users will have limited permissions for {{days}} days',
                  { days: config.probationPeriodDays }
                )
              : t('admin.organization.defaults.probationDisabled', 'Probation period is disabled')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DefaultAssignments;
