/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordKpiMeasurement = vi.hoisted(() => vi.fn());
const listKpiMeasurements = vi.hoisted(() => vi.fn());
const keys = vi.hoisted(() => ({ value: 0 }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/components/ResultsVNext/kpiApi', () => ({
  listKpis: vi.fn(async () => [
    { kpiId: 'canonical-a', kpiCode: 'CAN-A' },
    { kpiId: 'canonical-b', kpiCode: 'CAN-B' },
  ]),
  getKpiCurrentDefinitionVersion: vi.fn(async (kpiId: string) => ({
    definitionVersionId: `version-${kpiId}`,
    approvalStatus: 'approved',
  })),
  recordKpiMeasurement,
  listKpiMeasurements,
  newKpiIdempotencyKey: () => `key-${++keys.value}`,
}));

import { KpiSignalSheetView } from '../KpiSignalSheetView';

const sheet = {
  id: 'sheet-1',
  title: 'Monthly signals',
  kind: 'generated' as const,
  ownerLabel: 'Owner',
  dueDate: '2026-08-19',
  dueLabel: 'Today',
  statusLabel: 'Open',
  statusTone: 'slate' as const,
  frequencyLabel: 'Monthly',
  phaseLabel: 'Measure',
  summary: 'Enter governed measurements',
  instructions: 'Use exact sources',
  requiredInputs: ['Value'],
  items: [
    { id: 'legacy-a', name: 'Legacy A', latestValue: 1, needsEntry: true },
    { id: 'legacy-b', name: 'Legacy B', latestValue: 2, needsEntry: true },
  ],
};

describe('KpiSignalSheetView canonical cutover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    keys.value = 0;
  });

  it('keeps a failed row key for retry and rotates a saved row only after explicit new measurement', async () => {
    let bAttempts = 0;
    let aAttempts = 0;
    recordKpiMeasurement.mockImplementation(async (kpiId: string) => {
      if (kpiId === 'canonical-b' && bAttempts++ === 0) throw new Error('transport failed');
      return {
        measurementId:
          kpiId === 'canonical-a' ? `measurement-a-${++aAttempts}` : 'measurement-b',
      };
    });
    listKpiMeasurements.mockImplementation(async (kpiId: string) => [
      {
        measurementId:
          kpiId === 'canonical-a' ? `measurement-a-${aAttempts}` : 'measurement-b',
      },
    ]);

    render(<KpiSignalSheetView sheet={sheet} onBack={vi.fn()} />);
    const selects = await screen.findAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'canonical-a' } });
    fireEvent.change(selects[1], { target: { value: 'canonical-b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findAllByText('Saved and verified')).toHaveLength(1);
    await screen.findByText('transport failed');
    const firstKey = recordKpiMeasurement.mock.calls[0][1].idempotencyKey;
    const failedKey = recordKpiMeasurement.mock.calls[1][1].idempotencyKey;

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(recordKpiMeasurement).toHaveBeenCalledTimes(3));
    expect(recordKpiMeasurement.mock.calls[2][1].idempotencyKey).toBe(failedKey);

    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: 'Record another measurement' })
      ).toHaveLength(2)
    );
    const newMeasurementButtons = screen.getAllByRole('button', {
      name: 'Record another measurement',
    });
    fireEvent.click(newMeasurementButtons[0]);
    const legacyACard = screen.getByText('Legacy A').closest('.rounded-2xl') as HTMLElement;
    fireEvent.change(within(legacyACard).getByRole('spinbutton'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(recordKpiMeasurement).toHaveBeenCalledTimes(4));
    expect(recordKpiMeasurement.mock.calls[3][1].idempotencyKey).not.toBe(firstKey);
    expect(recordKpiMeasurement.mock.calls[3][1].definitionVersionId).toBe(
      'version-canonical-a'
    );
  });
});
