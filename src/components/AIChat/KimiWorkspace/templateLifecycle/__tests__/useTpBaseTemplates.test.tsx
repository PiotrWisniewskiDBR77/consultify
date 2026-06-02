/**
 * @vitest-environment jsdom
 *
 * Hook tests for useTpBaseTemplates (Block A · EPIC-T6).
 *
 * Coverage:
 *   * Initial fetch loads the default status (`approved`).
 *   * Switching `status` triggers a refetch with the new param.
 *   * `enabled = false` skips the fetch.
 *   * Stale responses are dropped (request-seq guard).
 *   * API errors land on `error` and clear `templates`.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, def?: string) => def ?? _k,
    i18n: { language: 'en' },
  }),
}));

import type { LifecycleTemplate, TemplateStatus } from '@/services/api/templateLifecycle.api';
import * as api from '@/services/api/templateLifecycle.api';

import { useTpBaseTemplates } from '../useTpBaseTemplates';

function makeTemplate(overrides: Partial<LifecycleTemplate> = {}): LifecycleTemplate {
  return {
    id: overrides.id ?? `tpl-${Math.random().toString(36).slice(2, 7)}`,
    name: overrides.name ?? 'Demo template',
    description: overrides.description ?? null,
    category: overrides.category ?? 'demo',
    thumbnail_url: overrides.thumbnail_url ?? null,
    schema_snapshot: overrides.schema_snapshot ?? {},
    is_featured: overrides.is_featured ?? false,
    usage_count: overrides.usage_count ?? 0,
    created_by: overrides.created_by ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
    status: overrides.status ?? 'approved',
    version: overrides.version ?? '1.0.0',
    owner_user_id: overrides.owner_user_id ?? null,
    approval_history: overrides.approval_history ?? [],
    governance_rules: overrides.governance_rules ?? {},
  };
}

describe('useTpBaseTemplates', () => {
  let listSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    listSpy = vi.spyOn(api, 'listLifecycleTemplates');
  });

  afterEach(() => {
    listSpy.mockRestore();
  });

  it('fetches with the default status on mount', async () => {
    listSpy.mockResolvedValue([makeTemplate({ id: 'a' })]);
    const { result } = renderHook(() => useTpBaseTemplates());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(listSpy).toHaveBeenCalledWith({ status: 'approved', category: undefined });
    expect(result.current.templates.map((t) => t.id)).toEqual(['a']);
    expect(result.current.error).toBeNull();
  });

  it('refetches when status changes', async () => {
    listSpy.mockImplementation(async ({ status }: { status?: TemplateStatus }) => [
      makeTemplate({ id: status ?? 'none' }),
    ]);
    const { result } = renderHook(() => useTpBaseTemplates());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    act(() => {
      result.current.setStatus('draft');
    });
    await waitFor(() => {
      expect(result.current.templates.map((t) => t.id)).toEqual(['draft']);
    });
    expect(listSpy).toHaveBeenLastCalledWith({ status: 'draft', category: undefined });
  });

  it('skips fetching when enabled=false', () => {
    renderHook(() => useTpBaseTemplates({ enabled: false }));
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('drops stale responses (request-seq guard)', async () => {
    let resolveFirst!: (v: LifecycleTemplate[]) => void;
    let resolveSecond!: (v: LifecycleTemplate[]) => void;
    listSpy
      .mockImplementationOnce(
        () =>
          new Promise<LifecycleTemplate[]>((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<LifecycleTemplate[]>((resolve) => {
            resolveSecond = resolve;
          })
      );

    const { result } = renderHook(() => useTpBaseTemplates());
    // Trigger second request before the first resolves.
    act(() => {
      result.current.setStatus('deprecated');
    });
    // Resolve second first (the fresh one), then first (the stale one).
    await act(async () => {
      resolveSecond([makeTemplate({ id: 'fresh' })]);
    });
    await act(async () => {
      resolveFirst([makeTemplate({ id: 'stale' })]);
    });
    await waitFor(() => {
      expect(result.current.templates.map((t) => t.id)).toEqual(['fresh']);
    });
  });

  it('surfaces errors and clears templates', async () => {
    listSpy.mockRejectedValue(new Error('Boom'));
    const { result } = renderHook(() => useTpBaseTemplates());
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error?.message).toBe('Boom');
    expect(result.current.templates).toEqual([]);
  });
});
