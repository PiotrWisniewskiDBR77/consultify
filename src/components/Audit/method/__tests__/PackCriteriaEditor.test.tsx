/**
 * OP-2b (Wpis 99, wiersz planu 65 / U-27) — edycja listy kryteriów pakietu
 * audytowego: `PUT /audits/packs/:id/criteria` to REPLACE całego drzewa, więc
 * ten plik pilnuje trzech reguł (każda z dowodem mutacyjnym w meldunku):
 *   1. STAN EDYCJI: dodaj + usuń + zmień → payload jest DOKŁADNIE oczekiwaną
 *      listą (kolejność ekranu = `ordinal`, `parentId` sparowany po kluczu
 *      tymczasowym, pola spoza formularza przepisane 1:1 z odczytu);
 *   2. JEDEN ZAPIS: „Save criteria" woła `replaceCriteria` RAZ z całym
 *      payloadem walidatora (`title` wymagane) i dopiero potem `onSaved`,
 *      żeby właściciel ekranu przeczytał pakiet ponownie (`getPack`);
 *   3. UCZCIWY BŁĄD: 4xx/5xx → komunikat inline, stan lokalny ZACHOWANY,
 *      `onSaved` niewołane (ekran nie udaje sukcesu i nie kasuje pracy).
 *
 * i18n jest PRAWDZIWY (bundle EN/PL z `public/locales`) — wzór
 * `AuditPackObjectPage.test.tsx`.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import React from 'react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../../../public/locales/en/translation.json';
import plTranslation from '../../../../../public/locales/pl/translation.json';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return { ...actual, replaceCriteria: vi.fn() };
});

import {
  buildReplacePayload,
  countCriteriaChanges,
  flattenCriteria,
  PackCriteriaEditor,
} from '../pack/PackCriteriaEditor';
import { replaceCriteria, type AuditPackCriterionNode } from '../auditsMethodApi';

const mockedReplace = vi.mocked(replaceCriteria);
const INITIAL_LANGUAGE = i18n.language;

/**
 * Drzewo, nie lista płaska: `GET /audits/packs/:id` oddaje
 * `buildCriteriaTree(getCriteriaFlat(...))`, więc potomek siedzi w `children`.
 * Payload musi go nieść, bo replace kasuje całe drzewo.
 */
const criteriaTree: AuditPackCriterionNode[] = [
  {
    id: 'crit-1',
    parentId: null,
    ordinal: 1,
    refCode: 'ZAK-8.4.1',
    nodeKind: 'control',
    title: 'Supplier qualification',
    mandatory: true,
    requirementText: 'Evaluate suppliers before contracting.',
    weight: 2,
    sourceReference: 'ISO 9001:2015 §8.4.1',
    auditQuestion: null,
    expectedEvidence: [{ kind: 'document', description: 'Supplier list' }],
    auditProcedure: 'Inspect contracting records.',
    samplingGuidance: null,
    applicabilityRule: { scope: 'purchasing' },
    suggestedOwnerRole: 'lead_auditor',
    children: [
      {
        id: 'crit-1a',
        parentId: 'crit-1',
        ordinal: 1,
        refCode: null,
        nodeKind: 'criterion',
        title: 'Approved supplier list',
        mandatory: false,
        requirementText: null,
        weight: null,
        children: [],
      },
    ],
  },
  {
    id: 'crit-2',
    parentId: null,
    ordinal: 2,
    refCode: 'ZAK-9.1',
    nodeKind: 'clause',
    title: 'Internal audit programme',
    mandatory: true,
    requirementText: null,
    weight: null,
    children: [],
  },
];

function renderEditor(overrides: Partial<React.ComponentProps<typeof PackCriteriaEditor>> = {}) {
  const onSaved = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const utils = render(
    <PackCriteriaEditor
      packId="pack-1"
      criteria={criteriaTree}
      onSaved={onSaved}
      onCancel={onCancel}
      {...overrides}
    />
  );
  return { ...utils, onSaved, onCancel };
}

const titleInput = (key: string) =>
  screen.getByTestId(`pack-criteria-title-${key}`) as HTMLInputElement;

describe('PackCriteriaEditor — stan edycji i payload replace', () => {
  beforeEach(async () => {
    i18n.addResourceBundle('en', 'translation', enTranslation, true, true);
    i18n.addResourceBundle('pl', 'translation', plTranslation, true, true);
    await i18n.changeLanguage('en');
    mockedReplace.mockReset();
    mockedReplace.mockResolvedValue([]);
  });

  afterAll(async () => {
    await i18n.changeLanguage(INITIAL_LANGUAGE);
  });

  it('flattenCriteria spłaszcza drzewo i zachowuje pola spoza formularza (replace nie może ich zgubić)', () => {
    const rows = flattenCriteria(criteriaTree);

    expect(rows.map((row) => row.key)).toEqual(['crit-1', 'crit-1a', 'crit-2']);
    expect(rows.map((row) => row.parentKey)).toEqual([null, 'crit-1', null]);
    expect(rows[0].preserved).toEqual({
      sourceReference: 'ISO 9001:2015 §8.4.1',
      auditQuestion: null,
      expectedEvidence: [{ kind: 'document', description: 'Supplier list' }],
      auditProcedure: 'Inspect contracting records.',
      samplingGuidance: null,
      applicabilityRule: { scope: 'purchasing' },
      suggestedOwnerRole: 'lead_auditor',
    });
    expect(rows[0].weight).toBe('2');
    expect(rows[1].weight).toBe('');
  });

  it('buildReplacePayload: kolejność ekranu = ordinal, puste pole = null, `id` = klucz tymczasowy', () => {
    const rows = flattenCriteria(criteriaTree);
    const payload = buildReplacePayload([rows[1], { ...rows[0], weight: '  ' }]);

    expect(payload[0]).toMatchObject({ id: 'crit-1a', parentId: 'crit-1', ordinal: 0 });
    expect(payload[1]).toMatchObject({
      id: 'crit-1',
      parentId: null,
      ordinal: 1,
      weight: null,
      title: 'Supplier qualification',
    });
  });

  it('płaska odpowiedź z zadeklarowanym `parentId` NIE gubi hierarchii w payloadzie', () => {
    const flat: AuditPackCriterionNode[] = [
      { ...criteriaTree[0], children: [] },
      {
        id: 'crit-1a',
        parentId: 'crit-1',
        ordinal: 2,
        refCode: null,
        nodeKind: 'criterion',
        title: 'Approved supplier list',
        mandatory: false,
      },
    ];

    const payload = buildReplacePayload(flattenCriteria(flat));

    expect(payload.map((row) => row.parentId)).toEqual([null, 'crit-1']);
  });

  it('sieroca `parentId` (rodzica nie ma w tym pakiecie) → null, bo walidator odrzuciłby 400 PARENT_MISSING', () => {
    const orphan: AuditPackCriterionNode[] = [
      { ...criteriaTree[1], parentId: 'crit-spoza-pakietu' },
    ];

    expect(buildReplacePayload(flattenCriteria(orphan))[0].parentId).toBeNull();
  });

  it('countCriteriaChanges liczy wiersz raz: zmiana + usunięcie + dodanie = 3', () => {
    const before = flattenCriteria(criteriaTree);
    const after = [
      { ...before[0], title: 'Supplier qualification (updated)', weight: '3' },
      ...before.slice(1).filter((row) => row.key !== 'crit-2'),
      { ...before[2], key: 'new-1', title: 'Management review' },
    ];

    expect(countCriteriaChanges(before, after)).toBe(3);
    expect(countCriteriaChanges(before, before)).toBe(0);
  });

  it('dodaj + usuń + zmień → JEDEN „Save criteria" wysyła DOKŁADNIE payload walidatora', async () => {
    const { onSaved } = renderEditor();

    // ZMIANA: nazwa i waga pierwszego kryterium.
    fireEvent.change(titleInput('crit-1'), { target: { value: 'Supplier qualification v2' } });
    fireEvent.change(screen.getByTestId('pack-criteria-weight-crit-1'), {
      target: { value: '3.5' },
    });
    // USUNIĘCIE: drugie kryterium znika z listy.
    fireEvent.click(screen.getByTestId('pack-criteria-remove-crit-2'));
    // DODANIE: nowy wiersz z własną nazwą.
    fireEvent.click(screen.getByTestId('pack-criteria-add'));
    fireEvent.change(titleInput('new-1'), { target: { value: 'Management review' } });

    // Liczba zmian jest pokazana PRZED zapisem (replace, nie patch).
    expect(screen.getByTestId('pack-criteria-changes').textContent).toMatch(/3/);

    fireEvent.click(screen.getByTestId('pack-criteria-save'));

    await waitFor(() => expect(mockedReplace).toHaveBeenCalledTimes(1));
    expect(mockedReplace).toHaveBeenCalledWith('pack-1', [
      {
        id: 'crit-1',
        parentId: null,
        ordinal: 0,
        refCode: 'ZAK-8.4.1',
        nodeKind: 'control',
        title: 'Supplier qualification v2',
        requirementText: 'Evaluate suppliers before contracting.',
        mandatory: true,
        weight: 3.5,
        sourceReference: 'ISO 9001:2015 §8.4.1',
        auditQuestion: null,
        expectedEvidence: [{ kind: 'document', description: 'Supplier list' }],
        auditProcedure: 'Inspect contracting records.',
        samplingGuidance: null,
        applicabilityRule: { scope: 'purchasing' },
        suggestedOwnerRole: 'lead_auditor',
      },
      {
        id: 'crit-1a',
        parentId: 'crit-1',
        ordinal: 1,
        refCode: null,
        nodeKind: 'criterion',
        title: 'Approved supplier list',
        requirementText: null,
        mandatory: false,
        weight: null,
        sourceReference: null,
        auditQuestion: null,
        expectedEvidence: [],
        auditProcedure: null,
        samplingGuidance: null,
        applicabilityRule: {},
        suggestedOwnerRole: null,
      },
      {
        id: 'new-1',
        parentId: null,
        ordinal: 2,
        refCode: null,
        nodeKind: 'criterion',
        title: 'Management review',
        requirementText: null,
        mandatory: true,
        weight: null,
        sourceReference: null,
        auditQuestion: null,
        expectedEvidence: [],
        auditProcedure: null,
        samplingGuidance: null,
        applicabilityRule: {},
        suggestedOwnerRole: null,
      },
    ]);
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('pack-criteria-save-error')).not.toBeInTheDocument();
  });

  it('kolejność na ekranie jest kolejnością zapisu (move down → ordinal)', async () => {
    renderEditor();

    fireEvent.click(screen.getByTestId('pack-criteria-move-down-crit-1'));
    fireEvent.click(screen.getByTestId('pack-criteria-save'));

    await waitFor(() => expect(mockedReplace).toHaveBeenCalledTimes(1));
    const sent = mockedReplace.mock.calls[0][1];
    expect(sent.map((row) => row.id)).toEqual(['crit-1a', 'crit-1', 'crit-2']);
    expect(sent.map((row) => row.ordinal)).toEqual([0, 1, 2]);
  });

  it('pusta nazwa blokuje żądanie po stronie ekranu (walidator oddałby 400 TITLE_MISSING)', async () => {
    const { onSaved } = renderEditor();

    fireEvent.change(titleInput('crit-1'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('pack-criteria-save'));

    expect(await screen.findByTestId('pack-criteria-save-error')).toHaveTextContent(
      /every criterion needs a title/i
    );
    expect(mockedReplace).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('błąd 4xx/5xx → komunikat inline, stan lokalny ZACHOWANY, ekran nie udaje sukcesu', async () => {
    mockedReplace.mockRejectedValue(new Error('AUDIT_CRITERIA_PAYLOAD_INVALID'));
    const { onSaved } = renderEditor();

    fireEvent.change(titleInput('crit-1'), { target: { value: 'Kept locally' } });
    fireEvent.click(screen.getByTestId('pack-criteria-save'));

    expect(await screen.findByTestId('pack-criteria-save-error')).toHaveTextContent(
      /AUDIT_CRITERIA_PAYLOAD_INVALID/
    );
    expect(titleInput('crit-1').value).toBe('Kept locally');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('opublikowany pakiet odmawia zapisu → ten sam komunikat inline z odpowiedzi serwera', async () => {
    mockedReplace.mockRejectedValue(new Error('AUDIT_PACK_STATE_INVALID'));
    renderEditor({ criteria: [criteriaTree[1]] });

    fireEvent.click(screen.getByTestId('pack-criteria-save'));

    expect(await screen.findByTestId('pack-criteria-save-error')).toHaveTextContent(
      /AUDIT_PACK_STATE_INVALID/
    );
    expect(screen.getByTestId('pack-criteria-title-crit-2')).toBeInTheDocument();
  });

  it('„Cancel" oddaje ekran właścicielowi bez żądania', () => {
    const { onCancel } = renderEditor();

    fireEvent.click(screen.getByTestId('pack-criteria-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockedReplace).not.toHaveBeenCalled();
  });
});
