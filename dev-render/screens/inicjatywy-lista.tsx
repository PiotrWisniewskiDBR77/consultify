/**
 * Dev-render: LISTA INICJATYW — REALNY <InitiativesHub>.
 *
 * Pomiar mechaniki KPI/OKR/ROI (2026-08-30): właściciel nigdy nie widział
 * tabeli/listy inicjatyw. Ekran REALNIE istniał w harnessie od naprawy
 * i18n (`staging-fixes-initiatives-i18n`, patrz ten plik) — ale pod nazwą
 * niezwiązaną z "lista inicjatyw", więc nieodkrywalny. Ten plik to kanoniczne
 * wejście pod właściwą nazwą: montuje ten sam REALNY komponent
 * `src/components/Initiatives/InitiativesHub.tsx` (StandardModuleBar +
 * StandardTable, kanon triady) z danymi przykładowymi (`isDemoMode: true` →
 * `shouldAllowDemoData()` w InitiativesHub renderuje wbudowany zestaw demo
 * bez potrzeby mockowania każdego endpointu REST osobno).
 *
 * Bez backendu w harnessie kilka wywołań sieciowych (lista userów do
 * przypisania właściciela, org context) kończy się błędem w konsoli —
 * nieszkodliwe, komponent i tak renderuje tabelę z danych demo.
 */
import React from 'react';

import { InitiativesHub } from '../../src/components/Initiatives/InitiativesHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

export default function InicjatywyListaScreen() {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }}>
        <InitiativesHub />
      </div>
    </AppProviders>
  );
}
