import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import ThreatIntelligenceView from '@/views/superadmin/iam/ThreatIntelligenceView';

vi.mock('@/services/api', () => ({
  Api: {
    getThreats: vi.fn(),
    getThreatStats: vi.fn(),
    addThreat: vi.fn(),
    blockThreat: vi.fn(),
    unblockThreat: vi.fn(),
    deleteThreat: vi.fn(),
    checkIPReputation: vi.fn(),
    checkDomainReputation: vi.fn(),
  },
}));

const threatStats = {
  totalThreats: 0,
  blockedCount: 0,
  byThreatLevel: {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  },
  ipCount: 0,
  domainCount: 0,
  avgReputation: 0,
};

const threat = {
  id: 'threat-1',
  threatType: 'malicious_ip',
  source: 'Internal',
  ipAddress: '10.0.0.1',
  domain: null,
  reputationScore: 10,
  threatLevel: 'MEDIUM',
  description: 'Known bad IP',
  firstSeen: '2026-04-26T00:00:00.000Z',
  lastSeen: 'not-a-date',
  isBlocked: false,
  createdAt: '2026-04-26T00:00:00.000Z',
};

describe('ThreatIntelligenceView honest UI', () => {
  const openRowActions = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
  };

  const chooseRowAction = (name: string) => {
    openRowActions();
    fireEvent.click(screen.getByRole('menuitem', { name }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    vi.mocked(Api.getThreats).mockRejectedValue(new Error('Threat feed backend down'));
    vi.mocked(Api.getThreatStats).mockResolvedValue(threatStats);
    vi.mocked(Api.addThreat).mockResolvedValue({ id: 'threat-1' });
    vi.mocked(Api.blockThreat).mockResolvedValue({ success: true });
    vi.mocked(Api.unblockThreat).mockResolvedValue({ success: true });
    vi.mocked(Api.deleteThreat).mockResolvedValue({ success: true });
  });

  it('does not render threat load failures as an empty threat feed', async () => {
    render(<ThreatIntelligenceView />);

    await waitFor(() => {
      expect(screen.getByText('Threat intelligence unavailable')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Threat feed backend down').length).toBeGreaterThan(0);
    expect(screen.getByText('Threat list unavailable')).toBeInTheDocument();

    expect(screen.queryByText('No threats found')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Threats')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Filters/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Add Threat/i })).toBeDisabled();
    expect(Api.addThreat).not.toHaveBeenCalled();
    expect(Api.blockThreat).not.toHaveBeenCalled();
    expect(Api.unblockThreat).not.toHaveBeenCalled();
    expect(Api.deleteThreat).not.toHaveBeenCalled();
  });

  it('does not close create modal when threat read-back is stale', async () => {
    vi.mocked(Api.getThreats).mockResolvedValue([]);

    render(<ThreatIntelligenceView />);

    await screen.findByText('No threats found');
    fireEvent.click(screen.getByRole('button', { name: /Add Threat/i }));
    fireEvent.change(screen.getByPlaceholderText('192.168.1.1'), {
      target: { value: '10.0.0.1' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Add Threat/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Threat creation was not confirmed by the server'
      );
    });
    expect(screen.getByPlaceholderText('192.168.1.1')).toBeInTheDocument();
  });

  it('keeps create modal open when create response does not include an id', async () => {
    vi.mocked(Api.getThreats).mockResolvedValue([]);
    vi.mocked(Api.addThreat).mockResolvedValue({ success: true });

    render(<ThreatIntelligenceView />);

    await screen.findByText('No threats found');
    fireEvent.click(screen.getByRole('button', { name: /Add Threat/i }));
    fireEvent.change(screen.getByPlaceholderText('192.168.1.1'), {
      target: { value: '10.0.0.1' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Add Threat/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Threat creation response was incomplete'
      );
    });
    expect(screen.getByPlaceholderText('192.168.1.1')).toBeInTheDocument();
  });

  it('does not crash or render NaN when threat stats and scores are malformed', async () => {
    vi.mocked(Api.getThreats).mockResolvedValue([
      { ...threat, reputationScore: 'bad-score', threatLevel: 'UNKNOWN_LEVEL' },
    ]);
    vi.mocked(Api.getThreatStats).mockResolvedValue({
      totalThreats: 'bad-total',
      blockedCount: 'bad-blocked',
      byThreatLevel: null,
      ipCount: 'bad-ip',
      domainCount: 'bad-domain',
    });

    render(<ThreatIntelligenceView />);

    await screen.findByText('10.0.0.1');

    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByText(/NaN|bad-/i)).not.toBeInTheDocument();
  });

  it('accepts wrapped threat payloads and exposes labelled actions', async () => {
    vi.mocked(Api.getThreats).mockResolvedValue({
      data: { data: { threats: [threat] } },
    });
    vi.mocked(Api.getThreatStats).mockResolvedValue({
      data: { data: threatStats },
    });

    render(<ThreatIntelligenceView />);

    expect(await screen.findByText('10.0.0.1')).toBeInTheDocument();
    openRowActions();
    expect(screen.getByRole('menuitem', { name: 'Block' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('closes create modal only after threat is confirmed by read-back', async () => {
    vi.mocked(Api.getThreats).mockResolvedValueOnce([]).mockResolvedValueOnce([threat]);

    render(<ThreatIntelligenceView />);

    await screen.findByText('No threats found');
    fireEvent.click(screen.getByRole('button', { name: /Add Threat/i }));
    fireEvent.change(screen.getByPlaceholderText('192.168.1.1'), {
      target: { value: '10.0.0.1' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Add Threat/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('192.168.1.1')).not.toBeInTheDocument();
    });
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
  });

  it('does not block, unblock, or delete threats when read-back remains stale', async () => {
    vi.mocked(Api.getThreats).mockResolvedValue([threat]);

    render(<ThreatIntelligenceView />);

    await screen.findByText('10.0.0.1');
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    chooseRowAction('Block');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Threat block was not confirmed by the server'
      );
    });

    vi.mocked(Api.getThreats).mockResolvedValue([{ ...threat, isBlocked: true }]);
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    await screen.findByText('10.0.0.1');
    chooseRowAction('Unblock');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Threat unblock was not confirmed by the server'
      );
    });

    chooseRowAction('Delete');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Threat deletion was not confirmed by the server'
      );
    });
  });

  it('does not report delete success when threat read-back is unavailable', async () => {
    vi.mocked(Api.getThreats)
      .mockResolvedValueOnce([threat])
      .mockRejectedValueOnce(new Error('Read-back down'));

    render(<ThreatIntelligenceView />);

    await screen.findByText('10.0.0.1');
    chooseRowAction('Delete');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Threat deletion was not confirmed by the server'
      );
    });
  });

  it('accepts a deeply wrapped create response when read-back confirms it', async () => {
    vi.mocked(Api.getThreats).mockResolvedValueOnce([]).mockResolvedValueOnce([threat]);
    vi.mocked(Api.addThreat).mockResolvedValue({
      data: { data: { threat: { id: 'threat-1' } } },
    });

    render(<ThreatIntelligenceView />);

    await screen.findByText('No threats found');
    fireEvent.click(screen.getByRole('button', { name: /Add Threat/i }));
    fireEvent.change(screen.getByPlaceholderText('192.168.1.1'), {
      target: { value: '10.0.0.1' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Add Threat/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('192.168.1.1')).not.toBeInTheDocument();
    });
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
  });

  it('does not render malformed threat payloads as an empty feed', async () => {
    vi.mocked(Api.getThreats).mockResolvedValue({ unexpected: true });

    render(<ThreatIntelligenceView />);

    await waitFor(() => {
      expect(screen.getByText('Threat intelligence unavailable')).toBeInTheDocument();
    });
    expect(
      screen.getAllByText('Threat intelligence response was not a list').length
    ).toBeGreaterThan(0);
    expect(screen.queryByText('No threats found')).not.toBeInTheDocument();
  });
});
