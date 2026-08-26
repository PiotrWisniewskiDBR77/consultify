/**
 * Dev-render: staging-fixes-20260826, Naprawa 1 — REALNY <InitiativesHub>.
 *
 * Weryfikacja wzrokowa (CLAUDE.md #7) naprawy mieszanki PL/EN: brakujące klucze
 * i18n (toast/hub/filters/materialize/kanban) + konwersja modułowej stałej
 * `INITIATIVE_LEVELS` (statyczny angielski) na `getInitiativeLevels(t)` w
 * selektorze poziomu inicjatywy w modalu "Nowa inicjatywa".
 *
 * `seedRealisticSession()` ustawia `isDemoMode: true` w store, co włącza
 * `shouldAllowDemoData()` w InitiativesHub — komponent renderuje wbudowane
 * dane demo bez potrzeby mockowania każdego endpointu osobno.
 *
 * Otwórz modal "Nowa inicjatywa" (przycisk w prawym górnym rogu) ręcznie po
 * załadowaniu ekranu, żeby zobaczyć naprawiony selektor poziomu.
 */
import React from 'react';

import { InitiativesHub } from '../../src/components/Initiatives/InitiativesHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

export default function StagingFixesInitiativesI18nScreen() {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }}>
        <InitiativesHub />
      </div>
    </AppProviders>
  );
}
