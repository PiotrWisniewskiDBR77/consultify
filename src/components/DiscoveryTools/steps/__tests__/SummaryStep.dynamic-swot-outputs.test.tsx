import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { useToolStore } from '@/store/useToolStore';

import { SummaryStep } from '../SummaryStep';

let getKnowledgeDocuments: ReturnType<typeof vi.spyOn>;
let uploadKnowledgeDocument: ReturnType<typeof vi.spyOn>;
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useNavigate: () => navigateMock,
}));

describe('SummaryStep Dynamic SWOT dedicated outputs', () => {
  beforeEach(() => {
    getKnowledgeDocuments = vi.spyOn(Api, 'getKnowledgeDocuments').mockResolvedValue([]);
    uploadKnowledgeDocument = vi
      .spyOn(Api, 'uploadKnowledgeDocument')
      .mockResolvedValue({ id: 'doc-uploaded' } as any);
    navigateMock.mockReset();
    useToolStore.setState({ currentSession: null, currentStep: 1, savedSessions: [] });
    useToolStore.getState().createSession('dynamic-swot');
  });

  it('uploads through the Vault owner and refreshes the persisted session-tagged list', async () => {
    const session = useToolStore.getState().currentSession!;
    getKnowledgeDocuments.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'doc-uploaded',
        filename: 'source.txt',
        category: 'tool-output-attachment',
        tags: ['dynamic-swot', session.id],
      },
    ] as any);
    render(
      <MemoryRouter>
        <SummaryStep toolType="dynamic-swot" session={session} isPolish={false} />
      </MemoryRouter>
    );

    const file = new File(['source evidence'], 'source.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Attach file'), { target: { files: [file] } });

    await waitFor(() => expect(uploadKnowledgeDocument).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('source.txt')).toBeInTheDocument();
  });

  it('cold-loads a session-tagged Vault document and exposes its download action', async () => {
    const session = useToolStore.getState().currentSession!;
    getKnowledgeDocuments.mockResolvedValue([
      {
        id: 'doc-1',
        filename: 'evidence.pdf',
        category: 'tool-output-attachment',
        tags: JSON.stringify(['dynamic-swot', session.id]),
      },
    ] as any);

    render(
      <MemoryRouter>
        <SummaryStep toolType="dynamic-swot" session={session} isPolish={false} />
      </MemoryRouter>
    );

    expect(await screen.findByText('evidence.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });

  it('shows a read error instead of presenting a failed Vault request as an empty list', async () => {
    const session = useToolStore.getState().currentSession!;
    getKnowledgeDocuments.mockRejectedValue(new Error('offline'));

    render(
      <MemoryRouter>
        <SummaryStep toolType="dynamic-swot" session={session} isPolish={false} />
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load files from Vault.');
  });

  it('shows one readiness surface and only truthful transitions to dedicated owners', async () => {
    const session = useToolStore.getState().currentSession!;
    render(
      <MemoryRouter>
        <SummaryStep toolType="dynamic-swot" session={session} isPolish={false} />
      </MemoryRouter>
    );

    expect(screen.getAllByTestId('swot-dedicated-outputs')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Open Report Generator/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Candidate Inbox/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vault/ })).toBeInTheDocument();
    expect(screen.queryByText(/AI Collaboration Panel/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Generate report/i)).not.toBeInTheDocument();
    expect(await screen.findByText('0/5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Open Report Generator/ }));
    expect(navigateMock).toHaveBeenCalledWith(
      `/reports/builder?new=true&sourceType=TOOL&sourceId=${session.id}`
    );
    fireEvent.click(screen.getByRole('button', { name: /Open Candidate Inbox/ }));
    expect(navigateMock).toHaveBeenCalledWith(
      '/initiatives?tab=candidates&candidateInbox=discovery'
    );
  });
});
