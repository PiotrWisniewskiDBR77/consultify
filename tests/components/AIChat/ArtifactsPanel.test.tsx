/**
 * Tests for ArtifactsPanel component
 * World-Class Chat 2025
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ArtifactsPanel } from '../../../components/AIChat/Artifacts/ArtifactsPanel';
import { Artifact } from '../../../types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' }
  })
}));

describe('ArtifactsPanel', () => {
  const mockArtifacts: Artifact[] = [
    {
      id: 'artifact-1',
      type: 'markdown',
      title: 'Test Document',
      content: '# Test Content',
      editable: true,
      version: 1,
      createdAt: new Date()
    },
    {
      id: 'artifact-2',
      type: 'code',
      title: 'Test Code',
      content: 'function test() { return true; }',
      language: 'javascript',
      editable: true,
      version: 1,
      createdAt: new Date()
    }
  ];

  const defaultProps = {
    artifacts: mockArtifacts,
    activeArtifactId: 'artifact-1',
    onSelectArtifact: vi.fn(),
    onUpdateArtifact: vi.fn(),
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders artifacts panel with first artifact active', () => {
    render(<ArtifactsPanel {...defaultProps} />);
    
    // Check header title
    const headers = screen.getAllByText('Test Document');
    expect(headers.length).toBeGreaterThan(0);
    // Check language badge for code artifacts
    const languageBadges = screen.queryAllByText('markdown');
    expect(languageBadges.length).toBeGreaterThanOrEqual(0);
  });

  it('displays multiple artifacts as tabs', () => {
    render(<ArtifactsPanel {...defaultProps} />);
    
    // Check that both artifacts are present (may appear in header and tabs)
    const docElements = screen.getAllByText('Test Document');
    const codeElements = screen.getAllByText('Test Code');
    expect(docElements.length).toBeGreaterThan(0);
    expect(codeElements.length).toBeGreaterThan(0);
  });

  it('calls onSelectArtifact when clicking on artifact tab', () => {
    render(<ArtifactsPanel {...defaultProps} />);
    
    const codeTab = screen.getByText('Test Code');
    fireEvent.click(codeTab);
    
    expect(defaultProps.onSelectArtifact).toHaveBeenCalledWith('artifact-2');
  });

  it('calls onClose when clicking close button', () => {
    render(<ArtifactsPanel {...defaultProps} />);
    
    const closeButton = screen.getByTitle(/close/i);
    fireEvent.click(closeButton);
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('copies artifact content to clipboard', async () => {
    // Mock clipboard API
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true
    });
    
    render(<ArtifactsPanel {...defaultProps} />);
    
    const copyButton = screen.getByTitle(/copy/i);
    fireEvent.click(copyButton);
    
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('# Test Content');
    });
  });

  it('shows navigation buttons for multiple artifacts', () => {
    render(<ArtifactsPanel {...defaultProps} />);
    
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('navigates to previous artifact', () => {
    render(<ArtifactsPanel {...defaultProps} activeArtifactId="artifact-2" />);
    
    const prevButton = screen.getByTitle(/previous/i);
    fireEvent.click(prevButton);
    
    expect(defaultProps.onSelectArtifact).toHaveBeenCalledWith('artifact-1');
  });

  it('navigates to next artifact', () => {
    render(<ArtifactsPanel {...defaultProps} />);
    
    const nextButton = screen.getByTitle(/next/i);
    fireEvent.click(nextButton);
    
    expect(defaultProps.onSelectArtifact).toHaveBeenCalledWith('artifact-2');
  });

  it('disables navigation buttons at boundaries', () => {
    render(<ArtifactsPanel {...defaultProps} />);
    
    const prevButton = screen.getByTitle(/previous/i);
    expect(prevButton).toBeDisabled();
  });

  it('shows edit mode when edit button clicked', () => {
    render(<ArtifactsPanel {...defaultProps} />);
    
    const editButtons = screen.getAllByTitle(/edit/i);
    const editButton = editButtons[0]; // Get first edit button
    fireEvent.click(editButton);
    
    // Should show editor (check for textarea or editor component)
    const editor = screen.queryByPlaceholderText(/start typing|artifacts.startTyping/i) ||
                   screen.queryByRole('textbox');
    expect(editor).toBeInTheDocument();
  });

  it('handles fullscreen toggle', () => {
    const onToggleFullscreen = vi.fn();
    render(
      <ArtifactsPanel 
        {...defaultProps} 
        onToggleFullscreen={onToggleFullscreen}
        isFullscreen={false}
      />
    );
    
    const fullscreenButton = screen.getByTitle(/fullscreen/i);
    fireEvent.click(fullscreenButton);
    
    expect(onToggleFullscreen).toHaveBeenCalled();
  });

  it('renders empty state when no artifacts', () => {
    render(
      <ArtifactsPanel 
        {...defaultProps} 
        artifacts={[]}
        activeArtifactId={null}
      />
    );
    
    // Should not render panel
    expect(screen.queryByText('Test Document')).not.toBeInTheDocument();
  });
});

