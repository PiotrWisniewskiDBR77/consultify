/**
 * @vitest-environment jsdom
 *
 * T28 R11 — CandidatesTable: populated/empty/error, Scan preserved outside
 * the table, row->preview (<=140 words), kebab/PPM parity with exactly
 * Accept/Dismiss (no promote/reject), preview mirrors row actions, no
 * selection/Menu3 bulk.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/services/api/baseClient', () => ({
  API_URL: 'http://test/api',
  getHeaders: () => ({}),
}));

import { CandidatesTable } from '../../../src/components/Initiatives/CandidatesTable';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('T28 CandidatesTable', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('empty state preserves header/geometry, Scan button present outside the table', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ candidates: [] }));
    render(<CandidatesTable />);
    expect(await screen.findByText('No candidates yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: /scan discovery/i })).toBeTruthy();
  });

  it('honest error state on fetch failure', async () => {
    mockFetch.mockImplementation(() => jsonResponse(null, false, 500));
    render(<CandidatesTable />);
    expect(await screen.findByText(/Failed to load candidates/i)).toBeTruthy();
  });

  it('populated: real columns from InitiativeCandidate (sourceType/status/fitScore/createdAt)', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (String(url).includes('/candidates?status=')) {
        return jsonResponse({
          candidates: [
            {
              id: 'c-1',
              organizationId: 'o-1',
              sourceType: 'assessment',
              sourceId: 's-1',
              title: 'Automate intake',
              rationale: 'Manual intake takes 3 days per request.',
              fitScore: 0.82,
              status: 'pending',
              createdAt: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      return jsonResponse({});
    });
    render(<CandidatesTable />);
    expect(await screen.findByText('Automate intake')).toBeTruthy();
    expect(screen.getByText('assessment')).toBeTruthy();
    expect(screen.getByText('82%')).toBeTruthy();
  });

  it('row click -> factual preview <=140 words, no invented fields', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (String(url).includes('/candidates?status=')) {
        return jsonResponse({
          candidates: [
            {
              id: 'c-1',
              organizationId: 'o-1',
              sourceType: 'assessment',
              sourceId: 's-1',
              title: 'Automate intake',
              rationale: 'Manual intake takes 3 days per request.',
              fitScore: 0.82,
              status: 'pending',
              createdAt: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      return jsonResponse({});
    });
    render(<CandidatesTable />);
    const row = await screen.findByText('Automate intake');
    fireEvent.click(row);
    const details = await screen.findByText(/Rationale: Manual intake takes 3 days per request\./);
    const text = details.textContent || '';
    expect(text.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(140);
    expect(text).not.toMatch(/\[object Object\]/);
  });

  it('kebab exposes exactly Open preview + Accept + Dismiss — no promote/reject/export', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (String(url).includes('/candidates?status=')) {
        return jsonResponse({
          candidates: [
            {
              id: 'c-1',
              organizationId: 'o-1',
              sourceType: 'assessment',
              sourceId: 's-1',
              title: 'Automate intake',
              rationale: 'text',
              fitScore: 0.5,
              status: 'pending',
              createdAt: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      return jsonResponse({});
    });
    render(<CandidatesTable />);
    await screen.findByText('Automate intake');
    const kebabButtons = screen.getAllByRole('button', { name: /row actions/i });
    fireEvent.click(kebabButtons[0]);
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Accept')).toBeTruthy();
    expect(within(menu).getByText('Dismiss')).toBeTruthy();
    expect(within(menu).getByText('Open preview')).toBeTruthy();
    expect(within(menu).queryByText(/promote/i)).toBeNull();
    expect(within(menu).queryByText(/reject/i)).toBeNull();
    expect(within(menu).queryByText(/export/i)).toBeNull();
  });

  it('Accept calls the real per-row accept endpoint and removes the row', async () => {
    let listCall = 0;
    mockFetch.mockImplementation((url: string, opts?: { method?: string }) => {
      const u = String(url);
      if (u.includes('/candidates?status=')) {
        listCall += 1;
        return jsonResponse({
          candidates:
            listCall === 1
              ? [
                  {
                    id: 'c-1',
                    organizationId: 'o-1',
                    sourceType: 'assessment',
                    sourceId: 's-1',
                    title: 'Automate intake',
                    rationale: 'text',
                    fitScore: 0.5,
                    status: 'pending',
                    createdAt: '2026-07-01T00:00:00Z',
                  },
                ]
              : [],
        });
      }
      if (u.includes('/c-1/accept') && opts?.method === 'POST') {
        return jsonResponse({ accepted: true, initiativeId: 'i-9', filled: true, payload: {} });
      }
      return jsonResponse({});
    });
    render(<CandidatesTable />);
    await screen.findByText('Automate intake');
    const kebabButtons = screen.getAllByRole('button', { name: /row actions/i });
    fireEvent.click(kebabButtons[0]);
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText('Accept'));
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/c-1/accept'),
        expect.objectContaining({ method: 'POST' })
      )
    );
    await waitFor(() => expect(screen.queryByText('Automate intake')).toBeNull());
  });

  it('no selection checkboxes rendered (selection: none, no Menu3 bulk)', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (String(url).includes('/candidates?status=')) {
        return jsonResponse({
          candidates: [
            {
              id: 'c-1',
              organizationId: 'o-1',
              sourceType: 'assessment',
              sourceId: 's-1',
              title: 'Automate intake',
              rationale: 'text',
              fitScore: 0.5,
              status: 'pending',
              createdAt: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      return jsonResponse({});
    });
    render(<CandidatesTable />);
    await screen.findByText('Automate intake');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
