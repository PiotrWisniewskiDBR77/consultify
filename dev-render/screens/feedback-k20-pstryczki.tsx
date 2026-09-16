/**
 * Dev-render: K-20 (zgłoszenie testera #60, Tomek, `/settings/working-hours`,
 * pl/light) — „suwak wyłączony jest praktycznie niewidoczny".
 *
 * Mountowany jest PRAWDZIWY `<WorkingHoursSettings>`. Stany MIESZANE celowo:
 * część dni włączona, część wyłączona — na jednym zrzucie widać oba stany
 * obok siebie, więc nie da się „przyzwyczaić oka" do jednego (pamięć
 * „przyrząd kłamie, a oko przywyka").
 *
 * Atrapa transportu: GET oddaje harmonogram, PUT potwierdza. Bez backendu.
 *
 * URL: ?screen=feedback-k20-pstryczki[&lang=en|pl][&theme=light|dark]
 */
import React from 'react';

import { WorkingHoursSettings } from '../../src/components/settings/WorkingHoursSettings';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import type { User } from '../../src/types';

const uzytkownik = {
  id: 'k20-user',
  email: 'tomasz.jankowski@k20.local',
  firstName: 'Tomasz',
  lastName: 'Jankowski',
  language: 'en',
  role: 'OWNER',
  organizationId: 'k20-org',
  isAuthenticated: true,
} as User;

useAppStore.setState({ currentUser: uzytkownik });

const dzien = (enabled: boolean) => ({ enabled, startTime: '09:00', endTime: '17:00' });

/** Cztery dni ON, trzy OFF — oba stany na jednym zrzucie. */
const HARMONOGRAM = {
  timezone: 'Europe/Warsaw',
  sameEveryDay: false,
  schedule: {
    monday: dzien(true),
    tuesday: dzien(true),
    wednesday: dzien(false),
    thursday: dzien(true),
    friday: dzien(true),
    saturday: dzien(false),
    sunday: dzien(false),
  },
};

const realGet = Api.get.bind(Api);
Api.get = (async (url: string, ...reszta: unknown[]) => {
  if (url.includes('working-hours')) return HARMONOGRAM;
  return (realGet as (u: string, ...r: unknown[]) => unknown)(url, ...reszta);
}) as typeof Api.get;

const realPut = Api.put.bind(Api);
Api.put = (async (url: string, body?: unknown, ...reszta: unknown[]) => {
  if (url.includes('working-hours')) return HARMONOGRAM;
  return (realPut as (u: string, b?: unknown, ...r: unknown[]) => unknown)(url, body, ...reszta);
}) as typeof Api.put;

export default function FeedbackK20PstryczkiScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ minHeight: '100vh' }} className="bg-c-bg p-8">
        <WorkingHoursSettings currentUser={uzytkownik} onUpdateUser={() => {}} />
      </div>
    </AppProviders>
  );
}
