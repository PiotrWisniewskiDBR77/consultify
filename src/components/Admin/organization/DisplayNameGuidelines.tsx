/**
 * DisplayNameGuidelines - Display name guidelines configuration component
 *
 * Features:
 * - Name format options (First Last, Last First, etc.)
 * - Character restrictions
 * - Preview
 * - Enforcement level
 *
 * Design: Form with live preview
 */

import {
  AlertCircle,
  Check,
  Eye,
  HelpCircle,
  Info,
  Save,
  Settings,
  Shield,
  User,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Name format options
export type NameFormat = 'first_last' | 'last_first' | 'first_mi_last' | 'username' | 'custom';

// Enforcement level
export type EnforcementLevel = 'none' | 'suggest' | 'require';

// Display name guidelines
export interface DisplayNameGuidelines {
  format: NameFormat;
  customFormat?: string;
  minLength: number;
  maxLength: number;
  allowNumbers: boolean;
  allowSpecialChars: boolean;
  allowedSpecialChars?: string;
  enforcementLevel: EnforcementLevel;
  requireCapitalization: boolean;
  blockProfanity: boolean;
}

interface DisplayNameGuidelinesProps {
  guidelines: DisplayNameGuidelines;
  onChange: (guidelines: DisplayNameGuidelines) => void;
  onSave?: () => void;
  className?: string;
}

// Example names for preview
const exampleNames = {
  firstName: 'John',
  middleInitial: 'R',
  lastName: 'Smith',
  username: 'jsmith123',
};

export const DisplayNameGuidelinesConfig: React.FC<DisplayNameGuidelinesProps> = ({
  guidelines,
  onChange,
  onSave,
  className,
}) => {
  const { t } = useTranslation();

  // Generate preview based on format
  const preview = useMemo(() => {
    switch (guidelines.format) {
      case 'first_last':
        return `${exampleNames.firstName} ${exampleNames.lastName}`;
      case 'last_first':
        return `${exampleNames.lastName}, ${exampleNames.firstName}`;
      case 'first_mi_last':
        return `${exampleNames.firstName} ${exampleNames.middleInitial}. ${exampleNames.lastName}`;
      case 'username':
        return exampleNames.username;
      case 'custom':
        return (
          guidelines.customFormat
            ?.replace('{first}', exampleNames.firstName)
            .replace('{last}', exampleNames.lastName)
            .replace('{mi}', exampleNames.middleInitial) || 'Custom Format'
        );
      default:
        return `${exampleNames.firstName} ${exampleNames.lastName}`;
    }
  }, [guidelines.format, guidelines.customFormat]);

  // Update guideline
  const updateGuideline = useCallback(
    <K extends keyof DisplayNameGuidelines>(key: K, value: DisplayNameGuidelines[K]) => {
      onChange({ ...guidelines, [key]: value });
    },
    [guidelines, onChange]
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            {t('admin.organization.displayName.title', 'Display Name Guidelines')}
            <Tooltip
              content={t(
                'admin.organization.displayName.tooltip',
                'Configure how names are displayed across the workspace'
              )}
            >
              <HelpCircle size={16} className="text-slate-400 dark:text-slate-500" />
            </Tooltip>
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t(
              'admin.organization.displayName.subtitle',
              'Set naming conventions for your organization'
            )}
          </p>
        </div>
        {onSave && (
          <Button variant="outline" size="sm" onClick={onSave} icon={<Save size={16} />}>
            {t('admin.organization.displayName.save', 'Save Changes')}
          </Button>
        )}
      </div>

      {/* Preview Card */}
      <div className="p-4 bg-gradient-to-br from-primary-500/10 to-primary-600/5 border border-primary-200 dark:border-primary-800 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Eye size={16} className="text-primary-600 dark:text-primary-400" />
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {t('admin.organization.displayName.preview', 'Preview')}
          </span>
        </div>
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-navy-800 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium">
            {preview.charAt(0)}
          </div>
          <span className="text-lg font-medium text-navy-900 dark:text-white">{preview}</span>
        </div>
      </div>

      {/* Format Selection */}
      <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <h4 className="font-medium text-navy-900 dark:text-white mb-4">
          {t('admin.organization.displayName.format', 'Name Format')}
        </h4>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { value: 'first_last', label: 'First Last', example: 'John Smith' },
            { value: 'last_first', label: 'Last, First', example: 'Smith, John' },
            { value: 'first_mi_last', label: 'First M. Last', example: 'John R. Smith' },
            { value: 'username', label: 'Username', example: 'jsmith123' },
            { value: 'custom', label: 'Custom', example: 'Define your own' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => updateGuideline('format', option.value as NameFormat)}
              className={cn(
                'p-3 rounded-lg border text-left transition-all',
                guidelines.format === option.value
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500/20'
                  : 'border-slate-200 dark:border-navy-700 hover:border-primary-300'
              )}
            >
              <p className="font-medium text-navy-900 dark:text-white">{option.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{option.example}</p>
            </button>
          ))}
        </div>

        {/* Custom Format */}
        {guidelines.format === 'custom' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t('admin.organization.displayName.customFormat', 'Custom Format')}
            </label>
            <input
              type="text"
              value={guidelines.customFormat || ''}
              onChange={(e) => updateGuideline('customFormat', e.target.value)}
              placeholder="{first} {mi}. {last}"
              className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t(
                'admin.organization.displayName.customHelp',
                'Use {first}, {last}, {mi} as placeholders'
              )}
            </p>
          </div>
        )}
      </div>

      {/* Character Restrictions */}
      <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <h4 className="font-medium text-navy-900 dark:text-white mb-4">
          {t('admin.organization.displayName.restrictions', 'Character Restrictions')}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t('admin.organization.displayName.minLength', 'Minimum Length')}
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={guidelines.minLength}
              onChange={(e) => updateGuideline('minLength', parseInt(e.target.value) || 2)}
              className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t('admin.organization.displayName.maxLength', 'Maximum Length')}
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={guidelines.maxLength}
              onChange={(e) => updateGuideline('maxLength', parseInt(e.target.value) || 50)}
              className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
            />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={guidelines.allowNumbers}
              onChange={(e) => updateGuideline('allowNumbers', e.target.checked)}
              className="rounded border-slate-300 dark:border-navy-700"
            />
            <span className="text-sm text-navy-900 dark:text-white">
              {t('admin.organization.displayName.allowNumbers', 'Allow numbers')}
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={guidelines.allowSpecialChars}
              onChange={(e) => updateGuideline('allowSpecialChars', e.target.checked)}
              className="rounded border-slate-300 dark:border-navy-700"
            />
            <span className="text-sm text-navy-900 dark:text-white">
              {t('admin.organization.displayName.allowSpecial', 'Allow special characters')}
            </span>
          </label>

          {guidelines.allowSpecialChars && (
            <div className="ml-6">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t('admin.organization.displayName.allowedChars', 'Allowed characters')}
              </label>
              <input
                type="text"
                value={guidelines.allowedSpecialChars || '.-_'}
                onChange={(e) => updateGuideline('allowedSpecialChars', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg font-mono text-navy-900 dark:text-white"
              />
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={guidelines.requireCapitalization}
              onChange={(e) => updateGuideline('requireCapitalization', e.target.checked)}
              className="rounded border-slate-300 dark:border-navy-700"
            />
            <span className="text-sm text-navy-900 dark:text-white">
              {t('admin.organization.displayName.requireCaps', 'Require proper capitalization')}
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={guidelines.blockProfanity}
              onChange={(e) => updateGuideline('blockProfanity', e.target.checked)}
              className="rounded border-slate-300 dark:border-navy-700"
            />
            <span className="text-sm text-navy-900 dark:text-white">
              {t(
                'admin.organization.displayName.blockProfanity',
                'Block profanity and inappropriate words'
              )}
            </span>
          </label>
        </div>
      </div>

      {/* Enforcement Level */}
      <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <h4 className="font-medium text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <Shield size={18} className="text-slate-400 dark:text-slate-500" />
          {t('admin.organization.displayName.enforcement', 'Enforcement Level')}
        </h4>

        <div className="space-y-2">
          {[
            {
              value: 'none',
              label: t('admin.organization.displayName.enfNone', 'None'),
              description: t(
                'admin.organization.displayName.enfNoneDesc',
                'Guidelines shown but not enforced'
              ),
            },
            {
              value: 'suggest',
              label: t('admin.organization.displayName.enfSuggest', 'Suggest'),
              description: t(
                'admin.organization.displayName.enfSuggestDesc',
                'Warn users but allow non-compliant names'
              ),
            },
            {
              value: 'require',
              label: t('admin.organization.displayName.enfRequire', 'Require'),
              description: t(
                'admin.organization.displayName.enfRequireDesc',
                'Enforce guidelines strictly'
              ),
            },
          ].map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                guidelines.enforcementLevel === option.value
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-slate-200 dark:border-navy-700 hover:border-primary-300'
              )}
            >
              <input
                type="radio"
                name="enforcement"
                checked={guidelines.enforcementLevel === option.value}
                onChange={() =>
                  updateGuideline('enforcementLevel', option.value as EnforcementLevel)
                }
                className="mt-1"
              />
              <div>
                <p className="font-medium text-navy-900 dark:text-white">{option.label}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{option.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DisplayNameGuidelinesConfig;
