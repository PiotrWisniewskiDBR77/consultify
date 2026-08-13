/**
 * Smoke tests for mind map modals: AssignPersonModal, AttachArtifactModal,
 * AddEvidenceModal, ImageUrlModal.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Whole-module mock — see floatingNodeToolbar.test.tsx: an incomplete one makes the
// file fail to COLLECT the moment the import graph reaches `src/i18n.ts`, which reads
// as "0 test" and hides every test in the file. Shape copied from `tests/setup.ts`.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => key,
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  Trans: ({ children, i18nKey }: any) => children || i18nKey,
  I18nextProvider: ({ children }: any) => children,
}));

import { AssignPersonModal } from '@/components/MyWork/mindmap/AssignPersonModal';
import { AttachArtifactModal } from '@/components/MyWork/mindmap/AttachArtifactModal';
import { AddEvidenceModal } from '@/components/MyWork/mindmap/AddEvidenceModal';
import { ImageUrlModal } from '@/components/MyWork/mindmap/ImageUrlModal';

describe('AssignPersonModal', () => {
  it('renders when open and calls onAssign', () => {
    const onAssign = vi.fn();
    const onClose = vi.fn();

    render(
      <AssignPersonModal
        open={true}
        onClose={onClose}
        onAssign={onAssign}
        recentAssignees={['Alice', 'Bob']}
      />
    );

    expect(screen.getByPlaceholderText('ideas.mindmap.name')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Alice'));
    expect(onAssign).toHaveBeenCalledWith('Alice');
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <AssignPersonModal open={false} onClose={vi.fn()} onAssign={vi.fn()} />
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('AttachArtifactModal', () => {
  it('renders when open and calls onAttach', () => {
    const onAttach = vi.fn();
    const onClose = vi.fn();

    render(<AttachArtifactModal open={true} onClose={onClose} onAttach={onAttach} />);

    expect(screen.getByText('ideas.mindmap.attachArtifact')).toBeInTheDocument();

    const idInput = screen.getByPlaceholderText('ideas.mindmap.artifactId');
    fireEvent.change(idInput, { target: { value: '42' } });

    fireEvent.click(screen.getByText('ideas.mindmap.attach'));
    expect(onAttach).toHaveBeenCalledWith('initiative', '42', undefined);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('AddEvidenceModal', () => {
  it('renders when open and calls onAdd with title and url', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();

    render(<AddEvidenceModal open={true} onClose={onClose} onAdd={onAdd} />);

    expect(screen.getByText('ideas.mindmap.addEvidenceSource')).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText('ideas.mindmap.evidenceTitle');
    const urlInput = screen.getByPlaceholderText('ideas.mindmap.httpsDescription');

    fireEvent.change(titleInput, { target: { value: 'Research paper' } });
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });

    fireEvent.click(screen.getByText('ideas.mindmap.add'));
    expect(onAdd).toHaveBeenCalledWith('Research paper', 'https://example.com');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ImageUrlModal', () => {
  it('renders when open and calls onSubmit', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();

    render(<ImageUrlModal open={true} onClose={onClose} onSubmit={onSubmit} />);

    expect(screen.getByText('ideas.mindmap.addImage')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('ideas.mindmap.imageUrl');
    fireEvent.change(input, { target: { value: 'https://img.example.com/photo.png' } });

    fireEvent.click(screen.getByText('ideas.mindmap.add'));
    expect(onSubmit).toHaveBeenCalledWith('https://img.example.com/photo.png');
    expect(onClose).toHaveBeenCalled();
  });
});
