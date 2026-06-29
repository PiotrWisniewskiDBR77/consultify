/**
 * M17/T4.3 — tab „Dane" (DataSourcesTabContent).
 *
 * Locks the revival of the previously dead-in-FE data layer: the component lists
 * connector types from materialData, previews a connector dataset, and pulls a
 * form dataset — all through the real service client (here mocked).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const listConnectorTypes = vi.fn();
const previewConnector = vi.fn();
const fetchFormDataset = vi.fn();

vi.mock('@/services/materialData', () => ({
  listConnectorTypes: (...a: unknown[]) => listConnectorTypes(...a),
  previewConnector: (...a: unknown[]) => previewConnector(...a),
  fetchFormDataset: (...a: unknown[]) => fetchFormDataset(...a),
}));

import { DataSourcesTabContent } from '../../../src/components/ReportsAndPresentations/DataSourcesTabContent';

afterEach(() => vi.clearAllMocks());

describe('DataSourcesTabContent — tab Dane', () => {
  it('lists connector types from the service', async () => {
    listConnectorTypes.mockResolvedValue(['postgres', 'airtable']);
    render(<DataSourcesTabContent />);
    await waitFor(() => expect(listConnectorTypes).toHaveBeenCalled());
    const select = (await screen.findByTestId('rap-data-connector-select')) as HTMLSelectElement;
    expect(select.querySelectorAll('option')).toHaveLength(2);
  });

  it('shows the empty state when no connectors are available (fail-soft)', async () => {
    listConnectorTypes.mockResolvedValue([]);
    render(<DataSourcesTabContent />);
    expect(await screen.findByTestId('rap-data-no-connectors')).toBeInTheDocument();
  });

  it('previews a connector dataset and renders rows', async () => {
    listConnectorTypes.mockResolvedValue(['postgres']);
    previewConnector.mockResolvedValue({
      columns: ['id', 'name'],
      rows: [{ id: 1, name: 'Alpha' }],
      rowCount: 1,
      source: { kind: 'connector', ref: 'postgres' },
    });
    render(<DataSourcesTabContent />);
    fireEvent.click(await screen.findByTestId('rap-data-preview-btn'));
    await waitFor(() => expect(previewConnector).toHaveBeenCalledWith('postgres', {}));
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
  });

  it('rejects invalid JSON config without calling the service', async () => {
    listConnectorTypes.mockResolvedValue(['postgres']);
    render(<DataSourcesTabContent />);
    const cfg = await screen.findByTestId('rap-data-config');
    fireEvent.change(cfg, { target: { value: '{ not json' } });
    fireEvent.click(screen.getByTestId('rap-data-preview-btn'));
    expect(await screen.findByTestId('rap-data-connector-error')).toBeInTheDocument();
    expect(previewConnector).not.toHaveBeenCalled();
  });

  it('pulls a form dataset by id', async () => {
    listConnectorTypes.mockResolvedValue(['postgres']);
    fetchFormDataset.mockResolvedValue({
      columns: ['q1'],
      rows: [{ q1: 'yes' }],
      rowCount: 1,
      source: { kind: 'form', ref: 'form-9' },
    });
    render(<DataSourcesTabContent />);
    fireEvent.change(await screen.findByTestId('rap-data-form-id'), { target: { value: 'form-9' } });
    fireEvent.click(screen.getByTestId('rap-data-form-btn'));
    await waitFor(() => expect(fetchFormDataset).toHaveBeenCalledWith('form-9'));
    expect(await screen.findByText('yes')).toBeInTheDocument();
  });
});
