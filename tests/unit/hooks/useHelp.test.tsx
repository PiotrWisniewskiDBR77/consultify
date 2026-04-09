/**
 * useHelp / useHelpSidePanel Hook Integration Tests
 *
 * Tests the real HelpContext hooks for contextual help resolution.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

import { HelpProvider, useHelp, useHelpSidePanel, useModuleFAQs } from '@/contexts/HelpContext';
import { useAppStore } from '@/store/useAppStore';
import { AppView } from '@/types';

vi.mock('@/store/useAppStore', () => {
  const store = {
    currentUser: { id: 'u1', name: 'Test' },
    currentView: 'DASHBOARD' as AppView,
    activeSidePanel: null as string | null,
    toggleSidePanel: vi.fn(),
  };
  return {
    useAppStore: vi.fn((selector?: any) => (selector ? selector(store) : store)),
  };
});

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ playbooks: [] }),
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <HelpProvider>{children}</HelpProvider>;
}

describe('useHelp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides contextual help for the current view', () => {
    const { result } = renderHook(() => useHelp(), { wrapper });

    const ctx = result.current.contextualHelp;
    expect(ctx).toBeDefined();
    expect(ctx.moduleId).toBe('dashboard');
    expect(ctx.document).toBeDefined();
    expect(ctx.document.title).toBeDefined();
    expect(ctx.document.title.en).toBeTruthy();
    expect(ctx.document.title.pl).toBeTruthy();
  });

  it('returns FAQs for the current module', () => {
    const { result } = renderHook(() => useModuleFAQs(), { wrapper });

    expect(Array.isArray(result.current)).toBe(true);
    expect(result.current.length).toBeGreaterThan(0);
  });

  it('getHelpForView resolves different views', () => {
    const { result } = renderHook(() => useHelp(), { wrapper });

    const assessmentHelp = result.current.getHelpForView(AppView.LICENSED_TOOLS_HUB ?? 'LICENSED_TOOLS_HUB');
    expect(assessmentHelp.document).toBeDefined();
    expect(assessmentHelp.document.title.en).toBeTruthy();
  });

  it('setActiveHelpTab normalises onboarding to guides', () => {
    const { result } = renderHook(() => useHelp(), { wrapper });

    act(() => {
      result.current.setActiveHelpTab('onboarding');
    });

    expect(result.current.activeHelpTab).toBe('guides');
  });
});

describe('useHelpSidePanel', () => {
  it('exposes toggle and tab setters', () => {
    const { result } = renderHook(() => useHelpSidePanel(), { wrapper });

    expect(typeof result.current.toggle).toBe('function');
    expect(typeof result.current.setActiveTab).toBe('function');
    expect(typeof result.current.setKnowledgeModuleIdOverride).toBe('function');
    expect(typeof result.current.setHelpDocumentIdOverride).toBe('function');
  });

  it('help object contains document with bilingual title', () => {
    const { result } = renderHook(() => useHelpSidePanel(), { wrapper });

    expect(result.current.help.document.title.en).toBeTruthy();
    expect(result.current.help.document.title.pl).toBeTruthy();
  });
});
