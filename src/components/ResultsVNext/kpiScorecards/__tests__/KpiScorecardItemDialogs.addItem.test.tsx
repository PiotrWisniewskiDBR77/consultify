/**
 * DEC-422c (1.1-R3) — okno „Dodaj miernik do karty wyników" bez UUID.
 *
 * Trzy twierdzenia, każde z własną mutacją sprawdzoną RED przed commitem
 * (patrz meldunek zadania):
 *  (A) wybór z listy wysyła `kpiId` WYBRANEGO REKORDU, nie tekst z pola;
 *  (B) „Dodaj" bez opisu = walidacja i ZERO wywołania `createKpiDraft`;
 *  (C) „Zaproponuj z AI" wypełnia pola i NIE zapisuje niczego.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { KpiDefinitionDto } from '../../kpiApi';

vi.mock('../../kpiApi', () => ({
  listKpis: vi.fn(),
  createKpiDraft: vi.fn(),
  newKpiIdempotencyKey: () => 'klucz-idempotencji-testowy',
}));
vi.mock('@/services/ai/generujTrescPola', () => ({
  generujTrescPola: vi.fn(),
}));

import { generujTrescPola } from '@/services/ai/generujTrescPola';

import { createKpiDraft, listKpis } from '../../kpiApi';
import { AddKpiScorecardItemModal } from '../KpiScorecardItemDialogs';

const KPI_ID = 'a1b2c3d4-1111-4222-8333-444455556666';
const KPI: KpiDefinitionDto = {
  kpiId: KPI_ID,
  organizationId: 'org-1',
  kpiCode: 'ON_TIME_DELIVERY',
  status: 'active',
  currentDefinitionVersionId: 'ver-1',
  primaryProcessId: null,
  responsePolicyId: null,
  ownerUserId: null,
  rowVersion: 3,
  createdBy: 'user-1',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  name: 'Terminowość dostaw',
};

const listKpisMock = vi.mocked(listKpis);
const createKpiDraftMock = vi.mocked(createKpiDraft);
const generujTrescPolaMock = vi.mocked(generujTrescPola);

function renderujOkno(onSubmit = vi.fn()) {
  render(
    <AddKpiScorecardItemModal
      open
      onClose={() => {}}
      onSubmit={onSubmit}
      isPolish
      scorecardName="Karta zarządu"
    />
  );
  return onSubmit;
}

beforeEach(() => {
  vi.clearAllMocks();
  listKpisMock.mockResolvedValue([KPI]);
});

describe('AddKpiScorecardItemModal — droga A: wybór istniejącego miernika', () => {
  it('wysyła kpiId WYBRANEGO rekordu, a użytkownik nigdy nie widzi UUID', async () => {
    const user = userEvent.setup();
    const onSubmit = renderujOkno();

    await user.type(screen.getByTestId('kpi-scorecard-add-item-search'), 'termin');
    await waitFor(() =>
      expect(listKpisMock).toHaveBeenCalledWith(expect.objectContaining({ q: 'termin' }))
    );

    const opcja = await screen.findByTestId(`kpi-scorecard-add-item-option-${KPI_ID}`);
    expect(opcja).toHaveTextContent('Terminowość dostaw');
    await user.click(opcja);

    await user.click(screen.getByTestId('kpi-scorecard-add-item-submit'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ kpiId: KPI_ID, role: 'primary' });
    // Mutacja „wyślij nazwę zamiast id" musi ten test wywrócić.
    expect(onSubmit.mock.calls[0][0].kpiId).not.toBe('Terminowość dostaw');
    // Zero UUID na ekranie — ani w polu wyszukiwania, ani na plakietce wyboru.
    expect(screen.queryByText(KPI_ID)).toBeNull();
  });
});

describe('AddKpiScorecardItemModal — droga B: nowy miernik', () => {
  it('bez opisu pokazuje walidację i NIE woła tworzenia KPI', async () => {
    const user = userEvent.setup();
    const onSubmit = renderujOkno();

    await user.click(screen.getByTestId('kpi-scorecard-add-item-tab-new'));
    await user.type(screen.getByTestId('kpi-scorecard-add-item-name'), 'Rotacja zapasów');
    await user.click(screen.getByTestId('kpi-scorecard-add-item-submit'));

    expect(screen.getByTestId('kpi-scorecard-add-item-description-error')).toHaveTextContent(
      'Opis miernika jest wymagany.'
    );
    expect(createKpiDraftMock).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('z opisem tworzy KPI i oddaje jego kpiId do dodania na kartę', async () => {
    const user = userEvent.setup();
    createKpiDraftMock.mockResolvedValue({
      kpi: { ...KPI, kpiId: 'f0f0f0f0-1111-4222-8333-444455556666' },
      definitionVersion: {} as never,
    });
    const onSubmit = renderujOkno();

    await user.click(screen.getByTestId('kpi-scorecard-add-item-tab-new'));
    await user.type(screen.getByTestId('kpi-scorecard-add-item-name'), 'Rotacja zapasów');
    await user.type(
      screen.getByTestId('kpi-scorecard-add-item-description'),
      'Ile razy w roku obracamy zapasem magazynowym.'
    );
    await user.click(screen.getByTestId('kpi-scorecard-add-item-submit'));

    await waitFor(() => expect(createKpiDraftMock).toHaveBeenCalledTimes(1));
    expect(createKpiDraftMock.mock.calls[0][0]).toMatchObject({
      name: 'Rotacja zapasów',
      description: 'Ile razy w roku obracamy zapasem magazynowym.',
      targetGeometry: 'threshold_min',
    });
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        kpiId: 'f0f0f0f0-1111-4222-8333-444455556666',
        role: 'primary',
      })
    );
  });
});

describe('AddKpiScorecardItemModal — „Zaproponuj z AI"', () => {
  it('wypełnia pola propozycją i nie zapisuje NICZEGO do kliknięcia „Dodaj"', async () => {
    const user = userEvent.setup();
    generujTrescPolaMock.mockImplementation(async ({ etykietaPola }) => {
      if (etykietaPola.startsWith('Opis')) return 'Udział dostaw zrealizowanych w terminie.';
      if (etykietaPola.startsWith('Jednostka')) return '%';
      if (etykietaPola.startsWith('Kierunek')) return 'WYŻEJ';
      return '95';
    });
    const onSubmit = renderujOkno();

    await user.click(screen.getByTestId('kpi-scorecard-add-item-tab-new'));
    await user.type(screen.getByTestId('kpi-scorecard-add-item-name'), 'Terminowość dostaw');
    await user.click(screen.getByTestId('kpi-scorecard-add-item-ai'));

    await waitFor(() =>
      expect(screen.getByTestId('kpi-scorecard-add-item-description')).toHaveValue(
        'Udział dostaw zrealizowanych w terminie.'
      )
    );
    expect(screen.getByTestId('kpi-scorecard-add-item-unit')).toHaveValue('%');
    expect(screen.getByTestId('kpi-scorecard-add-item-target')).toHaveValue('95');
    expect(screen.getByTestId('kpi-scorecard-add-item-direction')).toHaveValue('threshold_min');

    // Propozycja to propozycja: żadnego zapisu ani KPI, ani pozycji karty.
    expect(createKpiDraftMock).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
