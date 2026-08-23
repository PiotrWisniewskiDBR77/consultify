import {
  Briefcase,
  Building2,
  CalendarOff,
  CheckCircle,
  Globe,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Save,
  User as UserIcon,
  UserCircle,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Api } from '../../services/api';
import { User } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { SettingsHeaderActionPortal } from './SettingsHeaderActions';

interface ProfileSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

// Job title suggestions
const JOB_TITLE_SUGGESTIONS = [
  'CEO',
  'CTO',
  'CFO',
  'COO',
  'CMO',
  'VP of Engineering',
  'VP of Product',
  'VP of Operations',
  'Director',
  'Senior Manager',
  'Manager',
  'Project Manager',
  'Product Manager',
  'Program Manager',
  'Team Lead',
  'Tech Lead',
  'Engineering Lead',
  'Senior Developer',
  'Developer',
  'Software Engineer',
  'Business Analyst',
  'Data Analyst',
  'Data Scientist',
  'Consultant',
  'Senior Consultant',
  'Principal Consultant',
  'Designer',
  'UX Designer',
  'Product Designer',
  'Other',
];

const JOB_TITLE_I18N_KEYS: Record<string, string> = {
  CEO: 'ceo',
  CTO: 'cto',
  CFO: 'cfo',
  COO: 'coo',
  CMO: 'cmo',
  'VP of Engineering': 'vpEngineering',
  'VP of Product': 'vpProduct',
  'VP of Operations': 'vpOperations',
  Director: 'director',
  'Senior Manager': 'seniorManager',
  Manager: 'manager',
  'Project Manager': 'projectManager',
  'Product Manager': 'productManager',
  'Program Manager': 'programManager',
  'Team Lead': 'teamLead',
  'Tech Lead': 'techLead',
  'Engineering Lead': 'engineeringLead',
  'Senior Developer': 'seniorDeveloper',
  Developer: 'developer',
  'Software Engineer': 'softwareEngineer',
  'Business Analyst': 'businessAnalyst',
  'Data Analyst': 'dataAnalyst',
  'Data Scientist': 'dataScientist',
  Consultant: 'consultant',
  'Senior Consultant': 'seniorConsultant',
  'Principal Consultant': 'principalConsultant',
  Designer: 'designer',
  'UX Designer': 'uxDesigner',
  'Product Designer': 'productDesigner',
  Other: 'other',
};

const PROFILE_CONFIRMATION_FIELDS = [
  'firstName',
  'lastName',
  'phone',
  'companyName',
  'jobTitle',
  'linkedinId',
  'displayName',
  'pronouns',
  'department',
  'statusMessage',
  'isOutOfOffice',
  'outOfOfficeUntil',
  'outOfOfficeMessage',
] as const;

type ProfileConfirmationField = (typeof PROFILE_CONFIRMATION_FIELDS)[number];

// Extended form state type
interface ExtendedFormState {
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  jobTitle: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  linkedinId: string;
  // New fields
  displayName: string;
  pronouns: string;
  department: string;
  statusMessage: string;
  isOutOfOffice: boolean;
  outOfOfficeUntil: string;
  outOfOfficeMessage: string;
}

const toFormStateFromUser = (user: User): ExtendedFormState => ({
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  phone: user.phone || '',
  companyName: user.companyName || '',
  jobTitle: user.jobTitle || '',
  timezone: user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: user.dateFormat || 'DD/MM/YYYY',
  timeFormat: user.timeFormat || '24h',
  linkedinId: user.linkedinId || '',
  displayName: user.displayName || '',
  pronouns: user.pronouns || '',
  department: user.department || '',
  statusMessage: user.statusMessage || '',
  isOutOfOffice: user.isOutOfOffice || false,
  outOfOfficeUntil: user.outOfOfficeUntil || '',
  outOfOfficeMessage: user.outOfOfficeMessage || '',
});

const areProfileValuesEqual = (left: unknown, right: unknown): boolean => {
  if (typeof left === 'boolean' || typeof right === 'boolean') {
    return Boolean(left) === Boolean(right);
  }
  return String(left ?? '') === String(right ?? '');
};

const normalizeDateOnlyValue = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  return raw;
};

const areProfileFieldValuesEqual = (
  field: ProfileConfirmationField,
  left: unknown,
  right: unknown
): boolean => {
  if (field === 'outOfOfficeUntil') {
    return normalizeDateOnlyValue(left) === normalizeDateOnlyValue(right);
  }
  return areProfileValuesEqual(left, right);
};

const removeKnownSuffix = (value: string, suffix: string): string => {
  const trimmedValue = value.trim();
  const trimmedSuffix = suffix.trim();
  if (!trimmedValue || !trimmedSuffix || trimmedValue === trimmedSuffix) return trimmedValue;
  const withoutSuffix = trimmedValue.endsWith(trimmedSuffix)
    ? trimmedValue.slice(0, -trimmedSuffix.length).trim()
    : trimmedValue;
  return withoutSuffix.replace(/\b(.{3,}?)\1\b/g, '$1').trim();
};

const collapseRepeatedTextFragments = (value: string): string => {
  let next = value.trim();
  let previous = '';
  while (next !== previous) {
    previous = next;
    for (let size = Math.floor(next.length / 2); size >= 3; size--) {
      const first = next.slice(0, size);
      if (next.startsWith(first + first)) {
        next = first + next.slice(size * 2);
        break;
      }
    }
  }
  return next.trim();
};

const removeKnownValueArtifacts = (value: string, knownValue: string): string => {
  let next = value.trim();
  const known = knownValue.trim();
  if (!next || !known || next === known) return next;

  let previous = '';
  while (next !== previous) {
    previous = next;

    if (next.endsWith(known) && next.length > known.length) {
      next = next.slice(0, -known.length).trim();
    }

    for (let size = known.length - 1; size >= 3; size--) {
      const prefix = known.slice(0, size).trim();
      if (prefix && next.endsWith(prefix) && next.length > prefix.length) {
        next = next.slice(0, -prefix.length).trim();
        break;
      }
    }

    next = collapseRepeatedTextFragments(next);
  }

  return next;
};

const sanitizeProfileTextInput = (
  value: string,
  knownValues: string[],
  options: { removeLeadingKnownValue?: boolean } = {}
): string => {
  let next = knownValues.reduce(
    (current, knownValue) => removeKnownValueArtifacts(current, knownValue),
    value.trim()
  );

  if (options.removeLeadingKnownValue) {
    for (const knownValue of knownValues) {
      const known = knownValue.trim();
      if (known && next.startsWith(known) && next.length > known.length) {
        next = next.slice(known.length).trim();
      }
    }
  }

  return collapseRepeatedTextFragments(next);
};

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ currentUser, onUpdateUser }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const PRONOUNS_OPTIONS = useMemo(
    () => [
      {
        value: '',
        label: t('settings.profile.pronounsOptions.preferNotToSay', 'Prefer not to say'),
      },
      { value: 'he/him', label: t('settings.profile.pronounsOptions.heHim', 'He/Him') },
      { value: 'she/her', label: t('settings.profile.pronounsOptions.sheHer', 'She/Her') },
      { value: 'they/them', label: t('settings.profile.pronounsOptions.theyThem', 'They/Them') },
      { value: 'other', label: t('settings.profile.pronounsOptions.other', 'Other') },
    ],
    [t]
  );

  const DEPARTMENT_OPTIONS = useMemo(
    () => [
      {
        value: '',
        label: t('settings.profile.departmentOptions.selectDepartment', 'Select department...'),
      },
      {
        value: 'Engineering',
        label: t('settings.profile.departmentOptions.engineering', 'Engineering'),
      },
      { value: 'Product', label: t('settings.profile.departmentOptions.product', 'Product') },
      { value: 'Design', label: t('settings.profile.departmentOptions.design', 'Design') },
      { value: 'Marketing', label: t('settings.profile.departmentOptions.marketing', 'Marketing') },
      { value: 'Sales', label: t('settings.profile.departmentOptions.sales', 'Sales') },
      {
        value: 'Operations',
        label: t('settings.profile.departmentOptions.operations', 'Operations'),
      },
      { value: 'Finance', label: t('settings.profile.departmentOptions.finance', 'Finance') },
      { value: 'HR', label: t('settings.profile.departmentOptions.hr', 'Human Resources') },
      { value: 'Legal', label: t('settings.profile.departmentOptions.legal', 'Legal') },
      {
        value: 'Customer Success',
        label: t('settings.profile.departmentOptions.customerSuccess', 'Customer Success'),
      },
      { value: 'Support', label: t('settings.profile.departmentOptions.support', 'Support') },
      { value: 'Executive', label: t('settings.profile.departmentOptions.executive', 'Executive') },
      { value: 'Other', label: t('settings.profile.departmentOptions.other', 'Other') },
    ],
    [t]
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [firstNameValidationError, setFirstNameValidationError] = useState<string | null>(null);
  const [showJobTitleSuggestions, setShowJobTitleSuggestions] = useState(false);
  const initialFormState = useMemo(() => toFormStateFromUser(currentUser), [currentUser.id]);
  const [formState, setFormState] = useState<ExtendedFormState>(initialFormState);
  const lastSyncedFormRef = useRef<ExtendedFormState>(initialFormState);
  const previousUserIdRef = useRef<string>(currentUser.id);
  const hasLocalEditsRef = useRef(false);

  const getJobTitleLabel = useCallback(
    (title: string) =>
      t(`settings.profile.jobTitleSuggestions.${JOB_TITLE_I18N_KEYS[title] || 'other'}`, title),
    [t]
  );
  const updateFormField = useCallback(
    <K extends keyof ExtendedFormState>(field: K, value: ExtendedFormState[K]) => {
      hasLocalEditsRef.current = true;
      let nextValidationValue = value;
      setFormState((current) => {
        const sanitizedValue =
          typeof value === 'string' && (field === 'firstName' || field === 'jobTitle')
            ? sanitizeProfileTextInput(
                value,
                [String(current[field] || ''), String(lastSyncedFormRef.current[field] || '')],
                { removeLeadingKnownValue: field === 'jobTitle' }
              )
            : value;
        nextValidationValue = sanitizedValue as ExtendedFormState[K];
        return { ...current, [field]: sanitizedValue as ExtendedFormState[K] };
      });
      setSaveStatus('idle');
      setSaveError(null);
      if (field === 'firstName') {
        const nextFirstName =
          typeof nextValidationValue === 'string' ? nextValidationValue.trim() : '';
        if (!nextFirstName) {
          setFirstNameValidationError(
            t(
              'settings.profile.validation.firstNameRequired',
              'First name is required before saving'
            )
          );
        } else {
          setFirstNameValidationError(null);
        }
      }
    },
    [t]
  );

  // Filter job title suggestions
  const filteredJobTitles = useMemo(() => {
    if (!formState.jobTitle) return JOB_TITLE_SUGGESTIONS;
    const query = formState.jobTitle.toLowerCase();
    return JOB_TITLE_SUGGESTIONS.filter(
      (title) =>
        title.toLowerCase().includes(query) || getJobTitleLabel(title).toLowerCase().includes(query)
    );
  }, [formState.jobTitle, getJobTitleLabel]);

  // Initial state sync.
  // Keep local edits stable while typing and only resync when:
  // - user identity changes, or
  // - local form is clean and a fresh server snapshot arrived.
  useEffect(() => {
    const incomingFormState = toFormStateFromUser(currentUser);
    const incomingDiffersFromLastSynced = PROFILE_CONFIRMATION_FIELDS.some(
      (field) => !areProfileValuesEqual(incomingFormState[field], lastSyncedFormRef.current[field])
    );
    const userIdentityChanged = previousUserIdRef.current !== currentUser.id;
    previousUserIdRef.current = currentUser.id;

    if (userIdentityChanged) {
      hasLocalEditsRef.current = false;
      lastSyncedFormRef.current = incomingFormState;
      setFormState(incomingFormState);
      return;
    }

    if (!hasLocalEditsRef.current && incomingDiffersFromLastSynced) {
      lastSyncedFormRef.current = incomingFormState;
      setFormState(incomingFormState);
    }
  }, [currentUser]);

  const buildProfileUpdatePayload = (): Partial<User> => {
    const updates: Partial<User> = {};

    for (const field of PROFILE_CONFIRMATION_FIELDS) {
      let nextValue = formState[field];
      const currentValue = lastSyncedFormRef.current[field];
      if (
        (field === 'jobTitle' || field === 'firstName') &&
        typeof nextValue === 'string' &&
        typeof currentValue === 'string'
      ) {
        nextValue = sanitizeProfileTextInput(nextValue, [currentValue], {
          removeLeadingKnownValue: field === 'jobTitle',
        });
      }
      if (!areProfileValuesEqual(nextValue, currentValue)) {
        (
          updates as Partial<
            Record<ProfileConfirmationField, ExtendedFormState[ProfileConfirmationField]>
          >
        )[field] = nextValue;
      }
    }

    return updates;
  };

  // Handle manual save
  const handleSave = async () => {
    const normalizedFirstName = formState.firstName.trim();
    if (!normalizedFirstName) {
      const validationMessage = t(
        'settings.profile.validation.firstNameRequired',
        'First name is required before saving'
      );
      setFirstNameValidationError(validationMessage);
      setSaveError(validationMessage);
      setSaveStatus('error');
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');
    setSaveError(null);
    setFirstNameValidationError(null);
    try {
      const updates = buildProfileUpdatePayload();

      if (Object.keys(updates).length === 0) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
        return;
      }

      if (updates.firstName !== undefined) updates.firstName = normalizedFirstName;
      if (updates.lastName !== undefined) updates.lastName = formState.lastName.trim();
      if (updates.jobTitle !== undefined) {
        updates.jobTitle = sanitizeProfileTextInput(
          String(updates.jobTitle || ''),
          [formState.jobTitle, lastSyncedFormRef.current.jobTitle],
          { removeLeadingKnownValue: true }
        );
      }

      await Api.updateUser(currentUser.id, updates);
      const persistedUser = await Api.getMe();

      if (!persistedUser) {
        throw new Error('Profile save was not confirmed by the server');
      }

      const persistedFormState = toFormStateFromUser(persistedUser);
      const updatedProfileFields = (Object.keys(updates) as Array<keyof typeof updates>).filter(
        (field): field is ProfileConfirmationField =>
          PROFILE_CONFIRMATION_FIELDS.includes(field as ProfileConfirmationField)
      );
      const mismatchedField = updatedProfileFields.find(
        (field) => !areProfileFieldValuesEqual(field, persistedFormState[field], updates[field])
      );

      if (mismatchedField) {
        throw new Error('Profile changes were not confirmed by the server');
      }

      lastSyncedFormRef.current = persistedFormState;
      hasLocalEditsRef.current = false;
      setFormState(persistedFormState);
      onUpdateUser(persistedUser);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: unknown) {
      setSaveError(normalizeApiErrorMessage(error, 'Failed to save profile settings'));
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // Input class for consistent styling
  const inputClass =
    'w-full px-3 py-2 bg-[var(--c-surface-raised)] border border-[var(--c-border)] rounded-md text-[var(--c-text)] focus:ring-2 focus:ring-[var(--c-focus)] focus:border-[var(--c-focus-solid)] outline-none transition-all';
  const firstNameInputClass = firstNameValidationError
    ? 'w-full px-3 py-2 bg-[color-mix(in_srgb,var(--c-danger)_8%,transparent)] border border-[var(--c-danger)] rounded-md text-[var(--c-text)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--c-danger)_40%,transparent)] outline-none transition-all'
    : inputClass;
  const inputWithIconClass =
    'w-full pl-9 pr-3 py-2 bg-[var(--c-surface-raised)] border border-[var(--c-border)] rounded-md text-[var(--c-text)] focus:ring-2 focus:ring-[var(--c-focus)] focus:border-[var(--c-focus-solid)] outline-none transition-all';
  const selectClass =
    'w-full pl-9 pr-8 py-2 bg-[var(--c-surface-raised)] border border-[var(--c-border)] rounded-md text-[var(--c-text)] focus:ring-2 focus:ring-[var(--c-focus)] focus:border-[var(--c-focus-solid)] outline-none transition-all appearance-none cursor-pointer';
  const labelClass = 'text-xs font-medium text-[var(--c-text-muted)]';
  const sectionTitleClass =
    'text-sm font-bold text-[var(--c-text)] mb-6 uppercase tracking-wider border-b border-[var(--c-border-subtle)] pb-2';
  const cardClass = 'bg-[var(--c-surface)] border border-[var(--c-border-subtle)] rounded-lg p-6';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--c-text)]">
            {t('settings.profile.header', 'Personal Information')}
          </h2>
          <p className="mt-1 text-sm text-[var(--c-text-muted)]">
            {t('settings.profile.manage', 'Manage your personal information and preferences')}
          </p>
        </div>
        <SettingsHeaderActionPortal>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="type-control flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-white shadow-sm transition-colors hover:bg-navy-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving
              ? t('settings.profile.saving', 'Saving...')
              : t('settings.profile.save', 'Save Changes')}
          </button>
        </SettingsHeaderActionPortal>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Avatar & Basic Info */}
        <div className="md:col-span-1 space-y-6">
          <div className={cardClass + ' flex flex-col items-center text-center'}>
            <button
              type="button"
              onClick={() => navigate('/settings/avatar')}
              title={t('settings.profile.changePhoto', 'Change Photo')}
              aria-label={t('settings.profile.changePhoto', 'Change Photo')}
              className="relative group cursor-pointer mb-4 rounded-full focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)]"
            >
              <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-[var(--c-surface)] bg-[var(--c-surface-raised)] shadow-xl">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserCircle size={64} className="text-[var(--c-text-secondary)]" />
                )}
              </div>
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-xs font-medium">
                  {t('settings.profile.changePhoto', 'Change Photo')}
                </span>
              </div>
            </button>
            <h3 className="text-lg font-bold text-[var(--c-text)]">
              {formState.displayName || `${currentUser.firstName} ${currentUser.lastName}`}
            </h3>
            {formState.pronouns && (
              <p className="text-[var(--c-text-muted)] text-xs">({formState.pronouns})</p>
            )}
            <p className="text-sm font-medium text-c-text-secondary">{currentUser.companyName}</p>

            {/* Status Badge */}
            {(formState.statusMessage || formState.isOutOfOffice) && (
              <div className="mt-3 w-full">
                {formState.isOutOfOffice ? (
                  <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium">
                    <CalendarOff size={12} />
                    {t('settings.profile.outOfOfficeBadge', 'Out of Office')}
                    {formState.outOfOfficeUntil && (
                      <span>
                        {t('settings.profile.outOfOfficeUntil', 'until {{date}}', {
                          date: new Date(formState.outOfOfficeUntil).toLocaleDateString(),
                        })}
                      </span>
                    )}
                  </div>
                ) : (
                  formState.statusMessage && (
                    <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                      <MessageCircle size={12} />
                      {formState.statusMessage}
                    </div>
                  )
                )}
              </div>
            )}

            <div className="mt-4 flex w-full flex-col items-start gap-2 rounded-lg bg-[var(--c-surface-raised)] p-4 text-sm text-[var(--c-text-muted)]">
              <div className="flex items-center gap-2">
                <Mail size={14} />
                <span className="truncate">{currentUser.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 size={14} />
                <span className="truncate">{currentUser.role}</span>
              </div>
              {formState.department && (
                <div className="flex items-center gap-2">
                  <Users size={14} />
                  <span className="truncate">{formState.department}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Edit Form */}
        <div className="md:col-span-2 space-y-6">
          {/* Public Profile Section */}
          <div className={cardClass}>
            <h4 className={sectionTitleClass}>
              {t('settings.profile.publicProfile', 'Public Profile')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5 md:col-span-2">
                <label className={labelClass}>
                  {t('settings.profile.displayName', 'Display Name')}
                </label>
                <div className="relative">
                  <UserIcon
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-text-muted)]"
                  />
                  <input
                    value={formState.displayName}
                    onChange={(e) => updateFormField('displayName', e.target.value)}
                    placeholder={`${formState.firstName} ${formState.lastName}`}
                    className={inputWithIconClass}
                  />
                </div>
                <p className="text-[10px] text-[var(--c-text-muted)] mt-1">
                  {t(
                    'settings.profile.displayNameHint',
                    'This is how your name will appear to other users. Leave empty to use your full name.'
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="profile-pronouns">
                  {t('settings.profile.pronouns', 'Pronouns')}
                </label>
                <div className="relative">
                  <select
                    id="profile-pronouns"
                    value={formState.pronouns}
                    onChange={(e) => updateFormField('pronouns', e.target.value)}
                    className={inputClass + ' appearance-none cursor-pointer pr-8'}
                  >
                    {PRONOUNS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg
                      className="w-4 h-4 text-[var(--c-text-muted)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="profile-department">
                  {t('settings.profile.department', 'Department')}
                </label>
                <div className="relative">
                  <Users
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-text-muted)] pointer-events-none"
                  />
                  <select
                    id="profile-department"
                    value={formState.department}
                    onChange={(e) => updateFormField('department', e.target.value)}
                    className={selectClass}
                  >
                    {DEPARTMENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg
                      className="w-4 h-4 text-[var(--c-text-muted)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Information Section */}
          <div className={cardClass}>
            <h4 className={sectionTitleClass}>
              {t('settings.profile.header', 'Personal Information')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="profile-first-name">
                  {t('settings.profile.firstName', 'First Name')}
                </label>
                <input
                  id="profile-first-name"
                  value={formState.firstName}
                  aria-invalid={firstNameValidationError ? 'true' : undefined}
                  aria-describedby={
                    firstNameValidationError ? 'first-name-validation-error' : undefined
                  }
                  onChange={(e) => updateFormField('firstName', e.target.value)}
                  className={firstNameInputClass}
                />
                {firstNameValidationError && (
                  <p
                    id="first-name-validation-error"
                    className="mt-1 text-xs font-medium text-[var(--c-danger)]"
                  >
                    {firstNameValidationError}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="profile-last-name">
                  {t('settings.profile.lastName', 'Last Name')}
                </label>
                <input
                  id="profile-last-name"
                  value={formState.lastName}
                  onChange={(e) => updateFormField('lastName', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="profile-phone">
                  {t('auth.phone', 'Phone')}
                </label>
                <div className="relative">
                  <Phone
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-text-muted)]"
                  />
                  <input
                    id="profile-phone"
                    value={formState.phone}
                    onChange={(e) => updateFormField('phone', e.target.value)}
                    className={inputWithIconClass}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="profile-company-name">
                  {t('settings.profile.company', 'Company')}
                </label>
                <div className="relative">
                  <Building2
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-text-muted)]"
                  />
                  <input
                    id="profile-company-name"
                    value={formState.companyName}
                    onChange={(e) => updateFormField('companyName', e.target.value)}
                    className={inputWithIconClass}
                  />
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className={labelClass}>
                  {t('settings.profile.linkedinId', 'LinkedIn Profile ID')}
                </label>
                <div className="relative">
                  <Globe
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-text-muted)]"
                  />
                  <input
                    value={formState.linkedinId}
                    onChange={(e) => updateFormField('linkedinId', e.target.value)}
                    placeholder="e.g. piotr-wisniewski-123"
                    className={inputWithIconClass}
                  />
                  <p className="text-[10px] text-[var(--c-text-muted)] mt-1 ml-1">
                    {t(
                      'settings.profile.linkedinHint',
                      'Enter your profile ID from the LinkedIn URL (after /in/)'
                    )}
                  </p>
                </div>
              </div>
              {/* Job Title with autocomplete */}
              <div className="space-y-1.5 md:col-span-2">
                <label className={labelClass}>{t('settings.profile.jobTitle', 'Job Title')}</label>
                <div className="relative">
                  <Briefcase
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-text-muted)]"
                  />
                  <input
                    value={formState.jobTitle}
                    onChange={(e) => updateFormField('jobTitle', e.target.value)}
                    onFocus={() => setShowJobTitleSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowJobTitleSuggestions(false), 200)}
                    placeholder={t(
                      'settings.profile.jobTitlePlaceholder',
                      'e.g. Product Manager, Developer...'
                    )}
                    className={inputWithIconClass}
                  />
                  {/* Suggestions dropdown */}
                  {showJobTitleSuggestions && filteredJobTitles.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] shadow-lg">
                      {filteredJobTitles.map((title) => (
                        <button
                          key={title}
                          type="button"
                          onClick={() => {
                            updateFormField('jobTitle', getJobTitleLabel(title));
                            setShowJobTitleSuggestions(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-[var(--c-text-secondary)] transition-colors hover:bg-[var(--c-surface-raised)] hover:text-[var(--c-text)]"
                        >
                          {getJobTitleLabel(title)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Availability & Status Section */}
          <div className={cardClass}>
            <h4 className={sectionTitleClass}>
              {t('settings.profile.availability', 'Availability & Status')}
            </h4>
            <div className="space-y-6">
              {/* Status Message */}
              <div className="space-y-1.5">
                <label className={labelClass}>
                  {t('settings.profile.statusMessage', 'Status Message')}
                </label>
                <div className="relative">
                  <MessageCircle
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-text-muted)]"
                  />
                  <input
                    value={formState.statusMessage}
                    onChange={(e) => updateFormField('statusMessage', e.target.value)}
                    placeholder={t(
                      'settings.profile.statusPlaceholder',
                      'e.g. In meetings until 3pm, Working remotely...'
                    )}
                    maxLength={100}
                    className={inputWithIconClass}
                  />
                </div>
                <p className="text-[10px] text-[var(--c-text-muted)] mt-1">
                  {t(
                    'settings.profile.statusHint',
                    "Let your team know what you're up to ({{count}}/100)",
                    { count: formState.statusMessage.length }
                  )}
                </p>
              </div>

              {/* Out of Office */}
              <div className="space-y-4 rounded-lg bg-[var(--c-surface-raised)] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${formState.isOutOfOffice ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-slate-200 dark:bg-white/10'}`}
                    >
                      <CalendarOff
                        size={18}
                        className={
                          formState.isOutOfOffice
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-[var(--c-text-muted)]'
                        }
                      />
                    </div>
                    <div>
                      <label
                        className="text-sm font-medium text-[var(--c-text)]"
                        htmlFor="profile-out-of-office-toggle"
                      >
                        {t('settings.profile.outOfOffice', 'Out of Office')}
                      </label>
                      <p className="text-xs text-[var(--c-text-muted)]">
                        {t(
                          'settings.profile.outOfOfficeNotify',
                          "Automatically notify others when you're away"
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    id="profile-out-of-office-toggle"
                    role="switch"
                    aria-checked={formState.isOutOfOffice}
                    onClick={() => updateFormField('isOutOfOffice', !formState.isOutOfOffice)}
                    className={`relative h-6 w-12 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] ${
                      formState.isOutOfOffice
                        ? 'bg-[var(--c-warning)]'
                        : 'bg-[var(--c-border-strong)]'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        formState.isOutOfOffice ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {formState.isOutOfOffice && (
                  <div className="grid grid-cols-1 gap-4 border-t border-[var(--c-border-subtle)] pt-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={labelClass}>
                        {t('settings.profile.returnDate', 'Return Date')}
                      </label>
                      <input
                        type="date"
                        value={formState.outOfOfficeUntil}
                        onChange={(e) => updateFormField('outOfOfficeUntil', e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className={labelClass}>
                        {t('settings.profile.outOfOfficeMessage', 'Auto-reply Message')}
                      </label>
                      <textarea
                        value={formState.outOfOfficeMessage}
                        onChange={(e) => updateFormField('outOfOfficeMessage', e.target.value)}
                        placeholder={t(
                          'settings.profile.outOfOfficePlaceholder',
                          "I'm currently out of office and will respond when I return..."
                        )}
                        rows={3}
                        className={inputClass + ' resize-none'}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Regional preferences have one canonical writer. */}
          <div className={cardClass}>
            <h4 className={sectionTitleClass}>
              {t('settings.profile.regional', 'Regional Settings')}
            </h4>
            <p className="text-sm text-[var(--c-text-secondary)]">
              {t(
                'settings.profile.regionalCanonicalHint',
                'Timezone, date, time, number and unit formats are managed together in Regional Settings.'
              )}
            </p>
            <button
              type="button"
              onClick={() => navigate('/settings/regional')}
              className="mt-4 rounded-lg border border-[var(--c-border)] px-4 py-2 text-sm font-medium text-[var(--c-text)] hover:border-[var(--c-border-strong)]"
            >
              {t('settings.profile.openRegionalSettings', 'Open Regional Settings')}
            </button>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      {saveStatus === 'success' && (
        <div className="fixed bottom-8 right-8 flex items-center gap-2 rounded-lg bg-[var(--c-success)] px-4 py-2 text-white shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle size={16} />
          {t('settings.profile.saved', 'Saved!')}
        </div>
      )}
      {saveStatus === 'error' && saveError && (
        <div
          role="alert"
          className="fixed bottom-8 right-8 flex items-center gap-2 rounded-lg bg-[var(--c-danger)] px-4 py-2 text-white shadow-lg animate-in fade-in slide-in-from-bottom-2"
        >
          {saveError}
        </div>
      )}
    </div>
  );
};

export default ProfileSettings;
