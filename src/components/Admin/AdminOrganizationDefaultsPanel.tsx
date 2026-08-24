import React, { useCallback, useEffect, useState } from 'react';

import { Api } from '../../services/api';
import { V8FinanceApi } from '../../services/api/v8/finance';

interface Props { organizationId?: string }
interface ProfileDefaults { defaultTimezone: string; defaultLanguage: string; dateFormat: string }
interface FinanceDefaults { defaultCurrency: string; defaultWacc: number; defaultHorizonYears: number }

const INITIAL_PROFILE: ProfileDefaults = { defaultTimezone: '', defaultLanguage: '', dateFormat: '' };
const INITIAL_FINANCE: FinanceDefaults = { defaultCurrency: '', defaultWacc: 0, defaultHorizonYears: 0 };
const isV8Disabled = (error: unknown) => {
  const value = error as { data?: { code?: string }; message?: string };
  return `${value?.data?.code || ''} ${value?.message || ''}`.includes('V8_DISABLED') || `${value?.data?.code || ''} ${value?.message || ''}`.includes('V8_MISSING_ORG_CONTEXT');
};

export const AdminOrganizationDefaultsPanel: React.FC<Props> = ({ organizationId }) => {
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [finance, setFinance] = useState(INITIAL_FINANCE);
  const [financeVersion, setFinanceVersion] = useState(0);
  const [profileState, setProfileState] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [financeState, setFinanceState] = useState<'loading' | 'ready' | 'saving' | 'disabled' | 'error'>('loading');
  const [profileMessage, setProfileMessage] = useState('');
  const [financeMessage, setFinanceMessage] = useState('');

  const loadProfile = useCallback(async () => {
    if (!organizationId) { setProfileState('error'); setProfileMessage('Brak kontekstu organizacji w sesji.'); return; }
    try {
      setProfileState('loading');
      const response = await Api.get(`/organization-profiles/${organizationId}`);
      const value = response?.profile || {};
      setProfile({ defaultTimezone: value.defaultTimezone || '', defaultLanguage: value.defaultLanguage || '', dateFormat: value.dateFormat || '' });
      setProfileState('ready'); setProfileMessage('');
    } catch (error) { setProfileState('error'); setProfileMessage(error instanceof Error ? error.message : 'Nie udało się pobrać profilu.'); }
  }, [organizationId]);

  const loadFinance = useCallback(async () => {
    try {
      setFinanceState('loading');
      const value = await V8FinanceApi.getSettings();
      setFinance({ defaultCurrency: value.defaultCurrency, defaultWacc: value.defaultWacc, defaultHorizonYears: value.defaultHorizonYears });
      setFinanceVersion(value.version); setFinanceState('ready'); setFinanceMessage('');
    } catch (error) {
      setFinanceState(isV8Disabled(error) ? 'disabled' : 'error');
      setFinanceMessage(error instanceof Error ? error.message : 'Nie udało się pobrać ustawień finansowych.');
    }
  }, []);

  useEffect(() => { void loadProfile(); void loadFinance(); }, [loadFinance, loadProfile]);

  const saveProfile = async () => {
    if (!organizationId) return;
    try {
      setProfileState('saving');
      await Api.put(`/organization-profiles/${organizationId}`, profile);
      const readback = await Api.get(`/organization-profiles/${organizationId}`);
      const value = readback?.profile || {};
      setProfile({ defaultTimezone: value.defaultTimezone || '', defaultLanguage: value.defaultLanguage || '', dateFormat: value.dateFormat || '' });
      setProfileState('ready'); setProfileMessage('Zapisano i potwierdzono odczytem.');
    } catch (error) { setProfileState('error'); setProfileMessage(error instanceof Error ? error.message : 'Nie udało się zapisać profilu.'); }
  };

  const saveFinance = async () => {
    try {
      setFinanceState('saving');
      const result = await V8FinanceApi.updateSettings(finance, financeVersion, crypto.randomUUID());
      const { version, ...readback } = result.state;
      setFinance(readback); setFinanceVersion(version); setFinanceState('ready'); setFinanceMessage('Zapisano; potwierdzono wersją odpowiedzi.');
    } catch (error) {
      const conflict = (error as { status?: number })?.status === 409;
      setFinanceState(isV8Disabled(error) ? 'disabled' : 'error');
      setFinanceMessage(conflict ? 'Ustawienia zmieniły się równolegle (409). Odśwież sekcję przed ponowieniem.' : error instanceof Error ? error.message : 'Nie udało się zapisać ustawień finansowych.');
    }
  };

  return <div className="space-y-5"><div><h2 className="text-lg font-semibold">Ustawienia domyślne organizacji</h2><p className="text-sm text-c-text-secondary">Dwa niezależne źródła danych i dwa niezależne zapisy.</p></div>
    <section className="space-y-3 rounded-xl border border-c-border p-4"><h3 className="font-semibold">Lokalizacja i format</h3>{profileMessage && <p role={profileState === 'error' ? 'alert' : 'status'}>{profileMessage}</p>}<div className="grid gap-3 md:grid-cols-3"><label>Strefa czasowa<input aria-label="Strefa czasowa" value={profile.defaultTimezone} onChange={(event) => setProfile({ ...profile, defaultTimezone: event.target.value })} className="block w-full rounded border border-c-border bg-c-surface p-2"/></label><label>Język<input aria-label="Domyślny język" value={profile.defaultLanguage} onChange={(event) => setProfile({ ...profile, defaultLanguage: event.target.value })} className="block w-full rounded border border-c-border bg-c-surface p-2"/></label><label>Format daty<input aria-label="Format daty" value={profile.dateFormat} onChange={(event) => setProfile({ ...profile, dateFormat: event.target.value })} className="block w-full rounded border border-c-border bg-c-surface p-2"/></label></div><button disabled={profileState === 'loading' || profileState === 'saving' || !organizationId} onClick={() => void saveProfile()} className="rounded bg-c-accent px-3 py-2 text-white disabled:opacity-50">Zapisz lokalizację i format</button></section>
    <section className="space-y-3 rounded-xl border border-c-border p-4"><h3 className="font-semibold">Domyślne finansowe</h3>{financeState === 'disabled' ? <p role="status">Ustawienia finansowe są niedostępne, ponieważ V8 nie jest włączone dla tej organizacji. Sekcja profilu powyżej pozostaje aktywna.</p> : <>{financeMessage && <p role={financeState === 'error' ? 'alert' : 'status'}>{financeMessage}</p>}<div className="grid gap-3 md:grid-cols-3"><label>Waluta<input aria-label="Domyślna waluta" value={finance.defaultCurrency} onChange={(event) => setFinance({ ...finance, defaultCurrency: event.target.value })} className="block w-full rounded border border-c-border bg-c-surface p-2"/></label><label>WACC<input aria-label="Domyślny WACC" type="number" value={finance.defaultWacc} onChange={(event) => setFinance({ ...finance, defaultWacc: Number(event.target.value) })} className="block w-full rounded border border-c-border bg-c-surface p-2"/></label><label>Horyzont (lata)<input aria-label="Domyślny horyzont" type="number" value={finance.defaultHorizonYears} onChange={(event) => setFinance({ ...finance, defaultHorizonYears: Number(event.target.value) })} className="block w-full rounded border border-c-border bg-c-surface p-2"/></label></div><button disabled={financeState === 'loading' || financeState === 'saving'} onClick={() => void saveFinance()} className="rounded bg-c-accent px-3 py-2 text-white disabled:opacity-50">Zapisz domyślne finansowe</button></>}</section>
  </div>;
};
