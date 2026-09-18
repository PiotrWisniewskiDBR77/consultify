/**
 * [ODMROZENIE 05_INITIATIVES DEC-461] D-77 (DLUG-PO-MVP, P2/S) — podgląd
 * inicjatywy przy `lang=en` pokazywał polski literał „Usuń blokadę realizacji"
 * w rekomendacji readiness. Przyczyna: wiersz demo o statusie IN_EXECUTION
 * (`isBlocked`) niósł surowe polskie zdanie w `nextAction` i NIE ustawiał
 * `nextActionKey`, więc `CanonicalInitiativeRegister` (i kolumna tabeli)
 * spadał na `String(initiative.nextAction)` zamiast rozwiązać etykietę przez
 * `enumLabel('initiativeNextAction', key)`.
 *
 * Naprawa: demo ustawia `nextActionKey: 'UNBLOCK'` (kod), `nextAction` niesie
 * tekst ANGIELSKI, a domena `initiativeNextAction` + klucze `enums.*` en/pl
 * dostały wpis `UNBLOCK`. Ten plik zamraża wszystkie trzy warstwy.
 *
 * DOWÓD MUTACYJNY:
 *  - cofnięcie `initiativesDemoData.ts:794` do PL literału bez `nextActionKey`
 *    → test „blocked demo initiative … renders the EN enum label" RED;
 *  - usunięcie `UNBLOCK` z `enumLabel.ts` → test „enum … resolves UNBLOCK" RED;
 *  - usunięcie klucza PL z `translation.json` → test „i18n pair" RED.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { CanonicalInitiativeRegister } from '../CanonicalInitiativeRegister';
import { createInitiativesDemoDataset } from '../initiativesDemoData';
import { enumLabel, isKnownEnumValue } from '../../../utils/enumLabel';

import en from '../../../../public/locales/en/translation.json';
import pl from '../../../../public/locales/pl/translation.json';

const PL_LITERAL = 'Usuń blokadę realizacji';
const EN_LABEL = 'Resume execution';

const identityT = (_key: string, fallback: string) => fallback;

describe('D-77 — blocked initiative next-action is i18n-resolved, never a raw PL literal', () => {
  it('enum initiativeNextAction resolves UNBLOCK to the EN label', () => {
    expect(isKnownEnumValue('initiativeNextAction', 'UNBLOCK')).toBe(true);
    expect(enumLabel('initiativeNextAction', 'UNBLOCK', identityT)).toBe(EN_LABEL);
  });

  it('keeps the EN/PL i18n pair for enums.initiativeNextAction.UNBLOCK', () => {
    const enBlock = (en as any).enums.initiativeNextAction;
    const plBlock = (pl as any).enums.initiativeNextAction;
    expect(enBlock.UNBLOCK).toBe(EN_LABEL);
    expect(plBlock.UNBLOCK).toBe(PL_LITERAL);
  });

  it('blocked demo initiative preview renders the EN enum label, not the PL literal', () => {
    const { initiatives } = createInitiativesDemoDataset();
    const blocked = initiatives.find(
      (i) => (i as { nextActionKey?: string }).nextActionKey === 'UNBLOCK'
    );
    expect(blocked).toBeTruthy();
    // The demo row must NOT carry the raw Polish literal anywhere.
    expect(blocked!.nextAction).not.toBe(PL_LITERAL);

    render(
      <MemoryRouter>
        <CanonicalInitiativeRegister
          rows={[blocked as never]}
          selectedId={blocked!.id}
          onSelect={vi.fn()}
          onOpen={vi.fn()}
          persistKey="initiatives.d77-unblock.v1"
          emptyTitle="Empty"
          emptyDescription="Empty description"
        />
      </MemoryRouter>
    );

    expect(screen.getAllByText(EN_LABEL).length).toBeGreaterThan(0);
    expect(screen.queryByText(PL_LITERAL)).toBeNull();
  });
});
