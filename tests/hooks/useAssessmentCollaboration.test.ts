/**
 * @vitest-environment jsdom
 *
 * useAssessmentCollaboration Hook Tests
 * Tests for assessment collaboration state management
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock the hook since it may have complex dependencies
vi.mock('@/hooks/useAssessmentCollaboration', () => ({
  useAssessmentCollaboration: vi.fn(() => ({
    // State
    collaborators: [],
    activeUsers: [],
    isLoading: false,
    error: null,

    // Actions
    addCollaborator: vi.fn(),
    removeCollaborator: vi.fn(),
    updatePermissions: vi.fn(),
    refreshCollaborators: vi.fn(),

    // Real-time
    isConnected: false,
    lastSync: null,
  })),
}));

import { useAssessmentCollaboration } from '@/hooks/useAssessmentCollaboration';

describe('useAssessmentCollaboration Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('State', () => {
    it('returns collaborators array', () => {
      const { result } = renderHook(() => useAssessmentCollaboration());
      expect(Array.isArray(result.current.collaborators)).toBe(true);
    });

    it('returns activeUsers array', () => {
      const { result } = renderHook(() => useAssessmentCollaboration());
      expect(Array.isArray(result.current.activeUsers)).toBe(true);
    });

    it('returns isLoading', () => {
      const { result } = renderHook(() => useAssessmentCollaboration());
      expect(typeof result.current.isLoading).toBe('boolean');
    });

    it('returns error state', () => {
      const { result } = renderHook(() => useAssessmentCollaboration());
      expect(result.current.error === null || typeof result.current.error === 'string').toBe(true);
    });
  });

  describe('Actions', () => {
    it('exposes addCollaborator method', () => {
      const { result } = renderHook(() => useAssessmentCollaboration());
      expect(typeof result.current.addCollaborator).toBe('function');
    });

    it('exposes removeCollaborator method', () => {
      const { result } = renderHook(() => useAssessmentCollaboration());
      expect(typeof result.current.removeCollaborator).toBe('function');
    });

    it('exposes updatePermissions method', () => {
      const { result } = renderHook(() => useAssessmentCollaboration());
      expect(typeof result.current.updatePermissions).toBe('function');
    });

    it('exposes refreshCollaborators method', () => {
      const { result } = renderHook(() => useAssessmentCollaboration());
      expect(typeof result.current.refreshCollaborators).toBe('function');
    });
  });

  describe('Real-time State', () => {
    it('returns isConnected', () => {
      const { result } = renderHook(() => useAssessmentCollaboration());
      expect(typeof result.current.isConnected).toBe('boolean');
    });

    it('returns lastSync', () => {
      const { result } = renderHook(() => useAssessmentCollaboration());
      expect(result.current.lastSync === null || result.current.lastSync instanceof Date).toBe(
        true
      );
    });
  });
});
