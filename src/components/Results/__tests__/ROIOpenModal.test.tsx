/**
 * @vitest-environment jsdom
 *
 * CB-04/RB-012 — ROI picker must deduplicate exact-ID duplicate API rows and
 * never fall back to a raw internal ID to disambiguate same-name
 * initiatives.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';

import { ROIOpenModal } from '../ROIOpenModal';

describe('ROIOpenModal', () => {
  it('deduplicates exact-ID duplicate rows from the API', async () => {
    vi.spyOn(Api, 'get').mockResolvedValue([
      { id: 'init-1', name: 'Digital Transformation' },
      { id: 'init-1', name: 'Digital Transformation' }, // exact duplicate row
      { id: 'init-2', name: 'Cost Reduction' },
    ] as any);

    render(<ROIOpenModal onClose={() => {}} onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByText('Digital Transformation')).toHaveLength(1);
    });
    expect(screen.getByText('Cost Reduction')).toBeInTheDocument();
  });

  it('never renders a raw internal ID as the disambiguator for same-name initiatives', async () => {
    vi.spyOn(Api, 'get').mockResolvedValue([
      {
        id: 'a1b2c3d4-uuid-raw',
        name: 'Market Expansion',
        category: 'Growth',
        status: 'active',
        createdAt: '2026-01-15T00:00:00.000Z',
      },
      {
        id: 'e5f6g7h8-uuid-raw',
        name: 'Market Expansion',
        category: 'Growth',
        status: 'draft',
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    ] as any);

    render(<ROIOpenModal onClose={() => {}} onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByText('Market Expansion')).toHaveLength(2);
    });
    // The raw UUIDs must never appear anywhere in the picker.
    expect(screen.queryByText('a1b2c3d4-uuid-raw')).not.toBeInTheDocument();
    expect(screen.queryByText('e5f6g7h8-uuid-raw')).not.toBeInTheDocument();
    // Business-safe disambiguation (status here differs) IS shown.
    expect(screen.getByText(/active/i)).toBeInTheDocument();
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
  });

  it('shows no disambiguator line for a uniquely-named initiative', async () => {
    vi.spyOn(Api, 'get').mockResolvedValue([
      { id: 'init-9', name: 'One-off Initiative', category: 'Ops', status: 'active' },
    ] as any);

    render(<ROIOpenModal onClose={() => {}} onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('One-off Initiative')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Ops/)).not.toBeInTheDocument();
  });
});
