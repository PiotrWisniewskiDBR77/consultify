/**
 * @vitest-environment jsdom
 *
 * RowDetailPanel — Attachments section (legacy workspace).
 *
 * Covers: image attachments render an inline thumbnail and open a lightbox
 * on click; the lightbox closes on Escape and on backdrop/close-button click;
 * non-image attachments (pdf, etc.) fall back to a type icon + open-in-new-tab
 * link instead of a thumbnail.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RowDetailPanel } from '../RowDetailPanel';
import type { ColumnDef, NodeAttachment, TableNode } from '../tableTypes';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/services/api/tablePlatform.api', () => ({}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      currentUser: { id: 'user-1', firstName: 'Test', lastName: 'User' },
      currentOrganization: { id: 'org-1' },
    }),
}));

vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: { getOrganizationMembers: vi.fn().mockResolvedValue([]) },
}));

const FIXTURE_COLUMNS: ColumnDef[] = [
  { key: 'fld_name', header: 'Name', type: 'text', visible: true, width: 200 },
];

function makeNode(attachments: NodeAttachment[]): TableNode {
  return {
    id: 'rec-1',
    type: 'idea',
    data: { fld_name: 'Alpha', attachments },
    position: { x: 0, y: 0 },
  };
}

function renderAttachmentsTab(attachments: NodeAttachment[]) {
  const node = makeNode(attachments);
  render(
    <RowDetailPanel
      open
      onClose={vi.fn()}
      node={node}
      columns={FIXTURE_COLUMNS}
      edges={[]}
      allNodes={[node]}
      onFieldChange={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: /Attachments/i }));
}

describe('RowDetailPanel — Attachments', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders an inline thumbnail for an image/* attachment', () => {
    renderAttachmentsTab([
      {
        id: 'att-1',
        type: 'image',
        name: 'diagram.png',
        url: 'https://cdn.example.com/diagram.png',
        mimeType: 'image/png',
        createdAt: '2026-07-01T10:00:00.000Z',
      },
    ]);

    const thumb = screen.getByTestId('attachment-thumbnail');
    const img = within(thumb).getByRole('img', { name: 'diagram.png' });
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/diagram.png');
  });

  it('opens a lightbox on thumbnail click and closes it on Escape', () => {
    renderAttachmentsTab([
      {
        id: 'att-1',
        type: 'image',
        name: 'diagram.png',
        url: 'https://cdn.example.com/diagram.png',
        mimeType: 'image/png',
        createdAt: '2026-07-01T10:00:00.000Z',
      },
    ]);

    expect(screen.queryByTestId('attachment-lightbox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('attachment-thumbnail'));

    const lightbox = screen.getByTestId('attachment-lightbox');
    expect(lightbox).toBeInTheDocument();
    expect(within(lightbox).getByRole('img', { name: 'diagram.png' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/diagram.png'
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('attachment-lightbox')).not.toBeInTheDocument();
  });

  it('closes the lightbox when the close button is clicked', () => {
    renderAttachmentsTab([
      {
        id: 'att-1',
        type: 'image',
        name: 'diagram.png',
        url: 'https://cdn.example.com/diagram.png',
        mimeType: 'image/png',
        createdAt: '2026-07-01T10:00:00.000Z',
      },
    ]);

    fireEvent.click(screen.getByTestId('attachment-thumbnail'));
    expect(screen.getByTestId('attachment-lightbox')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('attachment-lightbox-close'));
    expect(screen.queryByTestId('attachment-lightbox')).not.toBeInTheDocument();
  });

  it('falls back to a type icon (no thumbnail) for a non-image attachment and links out', () => {
    renderAttachmentsTab([
      {
        id: 'att-2',
        type: 'file',
        name: 'contract.pdf',
        url: 'https://cdn.example.com/contract.pdf',
        mimeType: 'application/pdf',
        createdAt: '2026-07-01T10:00:00.000Z',
      },
    ]);

    expect(screen.queryByTestId('attachment-thumbnail')).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'contract.pdf' });
    expect(link).toHaveAttribute('href', 'https://cdn.example.com/contract.pdf');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
