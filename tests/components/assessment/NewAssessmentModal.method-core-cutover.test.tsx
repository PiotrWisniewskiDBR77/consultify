/** @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock, getMock, keyMock, legacyCreateMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  getMock: vi.fn(),
  keyMock: vi.fn(() => 'idem-drd-1'),
  legacyCreateMock: vi.fn(),
}));

vi.mock('../../../src/method-core/api/methodCoreApi', () => ({
  createSession: createMock,
  getSession: getMock,
  newIdempotencyKey: keyMock,
}));
vi.mock('../../../src/services/api', () => ({
  Api: { createAssessmentSession: legacyCreateMock },
}));
vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({ currentProjectId: 'project-1' }),
}));

import { NewAssessmentModal } from '../../../src/components/assessment/NewAssessmentModal';

describe('NewAssessmentModal Method Core DRD cutover', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates DRD through Method Core, verifies canonical readback, and never calls legacy create', async () => {
    const session = {
      id: 'method-session-1',
      module: 'assessment',
      methodPackId: 'drd',
      methodPackVersion: '2.0.0-methodpack.1',
      state: 'active',
    };
    createMock.mockResolvedValue({ session, idempotentReplay: false });
    getMock.mockResolvedValue({ session, roles: [] });
    const onSuccess = vi.fn();

    render(<NewAssessmentModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: /Digital Readiness Diagnosis/i }));
    expect(screen.queryByLabelText('Assessment Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Description/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start DRD session' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'assessment',
        methodPackId: 'drd',
        mode: 'guided_manual',
        projectId: 'project-1',
      }),
      'idem-drd-1'
    );
    expect(getMock).toHaveBeenCalledWith('method-session-1');
    expect(legacyCreateMock).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'method-session-1',
        name: 'DRD · method-s',
        assessmentType: 'DRD',
      })
    );
  });

  it('fails closed on readback mismatch and does not report success', async () => {
    createMock.mockResolvedValue({
      session: { id: 'created-id' },
      idempotentReplay: false,
    });
    getMock.mockResolvedValue({
      session: {
        id: 'different-id',
        module: 'assessment',
        methodPackId: 'drd',
        methodPackVersion: '2.0.0-methodpack.1',
        state: 'active',
      },
      roles: [],
    });
    const onSuccess = vi.fn();

    render(<NewAssessmentModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: /Digital Readiness Diagnosis/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Start DRD session' }));

    expect(await screen.findByText('Canonical DRD session readback mismatch')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(legacyCreateMock).not.toHaveBeenCalled();
  });
});
