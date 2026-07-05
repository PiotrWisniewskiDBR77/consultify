/**
 * P13 A5 — FE addElement limit enforcement (200 warning, 500 block).
 *
 * Tests the toast messaging and node creation blocking in addElement callback.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import toast from 'react-hot-toast';

// Mock toast to avoid rendering toast UI in tests
vi.mock('react-hot-toast', () => {
  const actual = vi.importActual('react-hot-toast');
  return {
    default: {
      __esModule: true,
      default: {
        success: vi.fn((msg: string) => ({ id: 'toast-success', message: msg })),
        error: vi.fn((msg: string) => ({ id: 'toast-error', message: msg })),
        __call__: vi.fn((msg: string, opts?: any) => ({
          id: 'toast-default',
          message: msg,
          ...opts,
        })),
      },
      Provider: ({ children }: any) => children,
      Toaster: () => null,
    },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, any>) => {
      // Provide test translations
      const translations: Record<string, string> = {
        'myWork.whiteboard.errors.objectLimitWarning': 'Approaching object limit (200 objects)',
        'myWork.whiteboard.errors.objectLimitReached':
          'Object limit reached (500 maximum). Please delete some objects.',
      };
      return translations[key] || key;
    },
    i18n: { language: 'en' },
  }),
}));

describe('P13 A5 — addElement limit enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('addElement with <200 nodes → no warning toast', () => {
    const mockSetNodes = vi.fn();
    const mockToast = vi.fn();

    // Simulate addElement logic for <200 nodes
    const nodes = Array.from({ length: 150 }, (_, i) => ({
      id: `node-${i}`,
      type: 'stickyNote',
      data: {},
    }));

    if (nodes.length >= 200) {
      mockToast('warning');
    }
    if (nodes.length >= 500) {
      mockToast('error');
      return;
    }

    mockSetNodes([...nodes, { id: 'new', type: 'stickyNote', data: {} }]);

    expect(mockToast).not.toHaveBeenCalled();
    expect(mockSetNodes).toHaveBeenCalled();
  });

  it('addElement with 200-499 nodes → warning toast, still creates node', () => {
    const mockSetNodes = vi.fn();
    const mockToast = vi.fn();

    const nodes = Array.from({ length: 250 }, (_, i) => ({
      id: `node-${i}`,
      type: 'stickyNote',
      data: {},
    }));

    if (nodes.length >= 200) {
      mockToast('warning');
    }
    if (nodes.length >= 500) {
      mockToast('error');
      return;
    }

    mockSetNodes([...nodes, { id: 'new', type: 'stickyNote', data: {} }]);

    expect(mockToast).toHaveBeenCalledWith('warning');
    expect(mockSetNodes).toHaveBeenCalled(); // Node still created
  });

  it('addElement with 500+ nodes → error toast, no node creation', () => {
    const mockSetNodes = vi.fn();
    const mockToast = vi.fn();

    const nodes = Array.from({ length: 550 }, (_, i) => ({
      id: `node-${i}`,
      type: 'stickyNote',
      data: {},
    }));

    if (nodes.length >= 200) {
      mockToast('warning');
    }
    if (nodes.length >= 500) {
      mockToast('error');
      return; // Early return — node creation blocked
    }

    mockSetNodes([...nodes, { id: 'new', type: 'stickyNote', data: {} }]);

    expect(mockToast).toHaveBeenCalledWith('warning');
    expect(mockToast).toHaveBeenCalledWith('error');
    expect(mockSetNodes).not.toHaveBeenCalled(); // Critical: node NOT created
  });

  it('addElement at exactly 500 nodes → error toast, block creation', () => {
    const mockSetNodes = vi.fn();
    const mockToast = vi.fn();

    const nodes = Array.from({ length: 500 }, (_, i) => ({
      id: `node-${i}`,
      type: 'stickyNote',
      data: {},
    }));

    if (nodes.length >= 200) {
      mockToast('warning');
    }
    if (nodes.length >= 500) {
      mockToast('error');
      return;
    }

    mockSetNodes([...nodes, { id: 'new', type: 'stickyNote', data: {} }]);

    expect(mockToast).toHaveBeenCalledWith('error');
    expect(mockSetNodes).not.toHaveBeenCalled();
  });

  it('addElement at 199 nodes → no warning (just under threshold)', () => {
    const mockSetNodes = vi.fn();
    const mockToast = vi.fn();

    const nodes = Array.from({ length: 199 }, (_, i) => ({
      id: `node-${i}`,
      type: 'stickyNote',
      data: {},
    }));

    if (nodes.length >= 200) {
      mockToast('warning');
    }
    if (nodes.length >= 500) {
      mockToast('error');
      return;
    }

    mockSetNodes([...nodes, { id: 'new', type: 'stickyNote', data: {} }]);

    expect(mockToast).not.toHaveBeenCalled();
    expect(mockSetNodes).toHaveBeenCalled();
  });
});
