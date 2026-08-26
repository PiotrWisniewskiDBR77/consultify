/**
 * Prymitywy kart Organizacji (redesign v1) — dwa dodatki z DEC-2026-08-26-78:
 *   1. `techDetails` na `OrgSectionCard` → zwijana sekcja „Szczegóły techniczne"
 *      z identyfikatorami rekordu (prototyp `org-prototyp-uklad.html` §`.tech`).
 *   2. `provenance` na `OrgFieldShell`/`OrgTextField`/`OrgSelectField` →
 *      pochodzenie faktu pod wartością (prototyp §`.prov`).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  OrgSectionCard,
  OrgSelectField,
  OrgTextField,
} from '../OrganizationCardPrimitives';

describe('OrgSectionCard — Szczegóły techniczne', () => {
  it('nie renderuje bloku bez techDetails', () => {
    render(
      <OrgSectionCard id="x" title="Karta">
        <p>treść</p>
      </OrgSectionCard>
    );
    expect(screen.queryByText('Szczegóły techniczne')).not.toBeInTheDocument();
  });

  it('pokazuje identyfikatory dopiero po rozwinięciu', async () => {
    const user = userEvent.setup();
    render(
      <OrgSectionCard
        id="identity"
        title="Tożsamość"
        techDetails={[{ label: 'Identyfikator organizacji', value: 'org_7c1f-a904' }]}
      >
        <p>treść</p>
      </OrgSectionCard>
    );

    expect(screen.getByText('Szczegóły techniczne')).toBeInTheDocument();
    expect(screen.queryByText('org_7c1f-a904')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('org-card-identity-tech-toggle'));
    expect(screen.getByText('org_7c1f-a904')).toBeInTheDocument();
  });
});

describe('pochodzenie faktu (provenance)', () => {
  it('OrgTextField renderuje linię pochodzenia pod wartością', () => {
    render(
      <OrgTextField
        id="org-description"
        label="Opis organizacji"
        value="Metalpol"
        provenance="Dokument · zatwierdzone 31.03.2026"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('Dokument · zatwierdzone 31.03.2026')).toBeInTheDocument();
  });

  it('OrgSelectField renderuje linię pochodzenia pod wartością', () => {
    render(
      <OrgSelectField
        id="org-industry"
        label="Branża"
        value="a"
        options={[{ value: 'a', label: 'Przemysł' }]}
        provenance="Odpowiedź z wywiadu · niezatwierdzone 18.08.2026"
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByText('Odpowiedź z wywiadu · niezatwierdzone 18.08.2026')
    ).toBeInTheDocument();
  });

  it('brak provenance nie renderuje żadnej linii', () => {
    render(<OrgTextField id="org-x" label="Pole" value="v" onChange={vi.fn()} />);
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });
});
