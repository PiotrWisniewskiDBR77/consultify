import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { V8FinanceApi } from '../../services/api/v8/finance';
interface Props {
  organizationId?: string;
}
interface ProfileDefaults {
  defaultTimezone: string;
  defaultLanguage: string;
  dateFormat: string;
}
interface FinanceDefaults {
  defaultCurrency: string;
  defaultWacc: number;
  defaultHorizonYears: number;
}
const INITIAL_PROFILE: ProfileDefaults = {
  defaultTimezone: '',
  defaultLanguage: '',
  dateFormat: '',
};
const INITIAL_FINANCE: FinanceDefaults = {
  defaultCurrency: '',
  defaultWacc: 0,
  defaultHorizonYears: 0,
};
const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm font-medium text-c-text hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]';
const isV8Disabled = (error: unknown) => {
  const value = error as {
    data?: {
      code?: string;
    };
    message?: string;
  };
  return (
    `${value?.data?.code || ''} ${value?.message || ''}`.includes('V8_DISABLED') ||
    `${value?.data?.code || ''} ${value?.message || ''}`.includes('V8_MISSING_ORG_CONTEXT')
  );
};
export const AdminOrganizationDefaultsPanel: React.FC<Props> = ({ organizationId }) => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [finance, setFinance] = useState(INITIAL_FINANCE);
  const [financeVersion, setFinanceVersion] = useState(0);
  const [profileState, setProfileState] = useState<'loading' | 'ready' | 'saving' | 'error'>(
    'loading'
  );
  const [financeState, setFinanceState] = useState<
    'loading' | 'ready' | 'saving' | 'disabled' | 'error'
  >('loading');
  const [profileMessage, setProfileMessage] = useState('');
  const [financeMessage, setFinanceMessage] = useState('');
  const loadProfile = useCallback(async () => {
    try {
      setProfileState('loading');
      const response = await Api.get('/admin/organization-profile');
      const value = response?.profile || {};
      setProfile({
        defaultTimezone: value.defaultTimezone || '',
        defaultLanguage: value.defaultLanguage || '',
        dateFormat: value.dateFormat || '',
      });
      setProfileState('ready');
      setProfileMessage('');
    } catch (error) {
      setProfileState('error');
      setProfileMessage(
        error instanceof Error
          ? error.message
          : t('admin.command.organization-defaults.profile.loadError')
      );
    }
  }, []);
  const loadFinance = useCallback(async () => {
    try {
      setFinanceState('loading');
      const value = await V8FinanceApi.getSettings();
      setFinance({
        defaultCurrency: value.defaultCurrency,
        defaultWacc: value.defaultWacc,
        defaultHorizonYears: value.defaultHorizonYears,
      });
      setFinanceVersion(value.version);
      setFinanceState('ready');
      setFinanceMessage('');
    } catch (error) {
      setFinanceState(isV8Disabled(error) ? 'disabled' : 'error');
      setFinanceMessage(
        error instanceof Error
          ? error.message
          : t('admin.command.organization-defaults.finance.loadError')
      );
    }
  }, []);
  useEffect(() => {
    void loadProfile();
    void loadFinance();
  }, [loadFinance, loadProfile]);
  const saveProfile = async () => {
    try {
      setProfileState('saving');
      await Api.put('/admin/organization-profile', profile);
      const readback = await Api.get('/admin/organization-profile');
      const value = readback?.profile || {};
      setProfile({
        defaultTimezone: value.defaultTimezone || '',
        defaultLanguage: value.defaultLanguage || '',
        dateFormat: value.dateFormat || '',
      });
      setProfileState('ready');
      setProfileMessage('Zapisano i potwierdzono odczytem.');
    } catch (error) {
      setProfileState('error');
      setProfileMessage(
        error instanceof Error
          ? error.message
          : t('admin.command.organization-defaults.profile.saveError')
      );
    }
  };
  const saveFinance = async () => {
    try {
      setFinanceState('saving');
      const result = await V8FinanceApi.updateSettings(
        finance,
        financeVersion,
        crypto.randomUUID()
      );
      const { version, ...readback } = result.state;
      setFinance(readback);
      setFinanceVersion(version);
      setFinanceState('ready');
      setFinanceMessage(t('admin.command.organization-defaults.finance.saveSuccess'));
    } catch (error) {
      const conflict =
        (
          error as {
            status?: number;
          }
        )?.status === 409;
      setFinanceState(isV8Disabled(error) ? 'disabled' : 'error');
      setFinanceMessage(
        conflict
          ? t('admin.command.organization-defaults.finance.conflict')
          : error instanceof Error
            ? error.message
            : t('admin.command.organization-defaults.finance.saveError')
      );
    }
  };
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{t('admin.command.organization-defaults.title')}</h2>
        <p className="text-sm text-c-text-secondary">
          {t('admin.command.organization-defaults.description')}
        </p>
      </div>
      <section className="space-y-3 rounded-xl border border-c-border p-4">
        <h3 className="font-semibold">{t('admin.command.organization-defaults.profile.title')}</h3>
        {profileMessage && (
          <p role={profileState === 'error' ? 'alert' : 'status'}>{profileMessage}</p>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          <label>
            {t('admin.command.organization-defaults.profile.timezoneLabel')}
            <input
              aria-label={t('admin.command.organization-defaults.profile.timezoneAria')}
              value={profile.defaultTimezone}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  defaultTimezone: event.target.value,
                })
              }
              className="block w-full rounded border border-c-border bg-c-surface p-2"
            />
          </label>
          <label>
            {t('admin.command.organization-defaults.profile.languageLabel')}
            <input
              aria-label={t('admin.command.organization-defaults.profile.languageAria')}
              value={profile.defaultLanguage}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  defaultLanguage: event.target.value,
                })
              }
              className="block w-full rounded border border-c-border bg-c-surface p-2"
            />
          </label>
          <label>
            {t('admin.command.organization-defaults.profile.dateFormatLabel')}
            <input
              aria-label={t('admin.command.organization-defaults.profile.dateFormatAria')}
              value={profile.dateFormat}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  dateFormat: event.target.value,
                })
              }
              className="block w-full rounded border border-c-border bg-c-surface p-2"
            />
          </label>
        </div>
        {profileState === 'error' && (
          <button
            onClick={() => void loadProfile()}
            className="rounded border border-c-border px-3 py-2"
          >
            {t('admin.command.organization-defaults.actions.retry')}
          </button>
        )}
        <button
          disabled={profileState !== 'ready' || !organizationId}
          onClick={() => void saveProfile()}
          className={buttonClass}
        >
          {t('admin.command.organization-defaults.profile.saveAction')}
        </button>
      </section>
      <section className="space-y-3 rounded-xl border border-c-border p-4">
        <h3 className="font-semibold">{t('admin.command.organization-defaults.finance.title')}</h3>
        {financeState === 'disabled' ? (
          <p role="status">{t('admin.command.organization-defaults.finance.disabled')}</p>
        ) : (
          <>
            {financeMessage && (
              <p role={financeState === 'error' ? 'alert' : 'status'}>{financeMessage}</p>
            )}
            <div className="grid gap-3 md:grid-cols-3">
              <label>
                {t('admin.command.organization-defaults.finance.currencyLabel')}
                <input
                  aria-label={t('admin.command.organization-defaults.finance.currencyAria')}
                  value={finance.defaultCurrency}
                  onChange={(event) =>
                    setFinance({
                      ...finance,
                      defaultCurrency: event.target.value,
                    })
                  }
                  className="block w-full rounded border border-c-border bg-c-surface p-2"
                />
              </label>
              <label>
                {t('admin.command.organization-defaults.finance.waccLabel')}
                <input
                  aria-label={t('admin.command.organization-defaults.finance.waccAria')}
                  type="number"
                  value={finance.defaultWacc}
                  onChange={(event) =>
                    setFinance({
                      ...finance,
                      defaultWacc: Number(event.target.value),
                    })
                  }
                  className="block w-full rounded border border-c-border bg-c-surface p-2"
                />
              </label>
              <label>
                {t('admin.command.organization-defaults.finance.horizonLabel')}
                <input
                  aria-label={t('admin.command.organization-defaults.finance.horizonAria')}
                  type="number"
                  value={finance.defaultHorizonYears}
                  onChange={(event) =>
                    setFinance({
                      ...finance,
                      defaultHorizonYears: Number(event.target.value),
                    })
                  }
                  className="block w-full rounded border border-c-border bg-c-surface p-2"
                />
              </label>
            </div>
            {financeState === 'error' && (
              <button
                onClick={() => void loadFinance()}
                className="rounded border border-c-border px-3 py-2"
              >
                {t('admin.command.organization-defaults.actions.retry')}
              </button>
            )}
            <button
              disabled={financeState !== 'ready'}
              onClick={() => void saveFinance()}
              className={buttonClass}
            >
              {t('admin.command.organization-defaults.finance.saveAction')}
            </button>
          </>
        )}
      </section>
    </div>
  );
};
