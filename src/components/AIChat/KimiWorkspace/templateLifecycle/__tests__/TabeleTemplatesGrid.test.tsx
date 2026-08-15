/**
 * @vitest-environment jsdom
 *
 * Component tests for TabeleTemplatesGrid (Block A · A-S5b).
 *
 * Coverage:
 *   * Default mount fetches with `approved` status (A-P1).
 *   * Switching the filter triggers a refetch.
 *   * Cards render with the dot badge + governance trigger.
 *   * Clicking a card invokes `onTemplateClick` with the template id.
 *   * Empty state renders when the API returns nothing.
 *   * Error state surfaces an `alert` role.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (
      _key: string,
      fallback?: string | Record<string, unknown>,
      values?: Record<string, unknown>
    ) => {
      const options = typeof fallback === 'object' ? fallback : (values ?? {});
      const template =
        typeof fallback === 'string' ? fallback : String(options.defaultValue ?? _key);
      return template.replace(/{{(\w+)}}/g, (_match, name: string) => String(options[name] ?? ''));
    },
    i18n: { language: 'en' },
  }),
}));

import type { LifecycleTemplate, TemplateStatus } from '@/services/api/templateLifecycle.api';
import * as api from '@/services/api/templateLifecycle.api';

import { TabeleTemplatesGrid } from '../TabeleTemplatesGrid';

function makeTemplate(overrides: Partial<LifecycleTemplate> = {}): LifecycleTemplate {
  return {
    id: overrides.id ?? `tpl-${Math.random().toString(36).slice(2, 7)}`,
    name: overrides.name ?? 'Demo template',
    description: overrides.description ?? 'A useful description',
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

describe('TabeleTemplatesGrid', () => {
  let listSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    listSpy = vi.spyOn(api, 'listLifecycleTemplates');
  });

  afterEach(() => {
    listSpy.mockRestore();
  });

  it('mounts with the default approved filter (A-P1)', async () => {
    listSpy.mockResolvedValue([makeTemplate({ id: 't-1', name: 'Approved one' })]);
    render(<TabeleTemplatesGrid onTemplateClick={vi.fn()} />);
    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith({ status: 'approved', category: undefined });
    });
    expect(await screen.findByText('Approved one')).toBeInTheDocument();
  });

  it('refetches when the filter changes', async () => {
    listSpy.mockImplementation(async ({ status }: { status?: TemplateStatus }) => [
      makeTemplate({ id: status ?? 'none', name: `Items in ${status}` }),
    ]);
    render(<TabeleTemplatesGrid onTemplateClick={vi.fn()} />);
    await screen.findByText('Items in approved');
    fireEvent.click(screen.getByTestId('template-lifecycle-filter-draft'));
    await screen.findByText('Items in draft');
    expect(listSpy).toHaveBeenLastCalledWith({ status: 'draft', category: undefined });
  });

  it('renders a dot badge and governance trigger on each card', async () => {
    listSpy.mockResolvedValue([makeTemplate({ id: 'badge-1' })]);
    render(<TabeleTemplatesGrid onTemplateClick={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('tabele-templates-grid-card-badge-1-status')).toBeInTheDocument();
    });
    expect(screen.getByTestId('tabele-templates-grid-card-badge-1-governance')).toBeInTheDocument();
  });

  it('invokes onTemplateClick when a card is clicked', async () => {
    listSpy.mockResolvedValue([makeTemplate({ id: 'click-me' })]);
    const onTemplateClick = vi.fn();
    render(<TabeleTemplatesGrid onTemplateClick={onTemplateClick} />);
    const cardBtn = await screen.findByTestId('tabele-templates-grid-card-click-me');
    fireEvent.click(cardBtn);
    expect(onTemplateClick).toHaveBeenCalledWith('click-me');
  });

  it('renders an empty state when no templates are returned', async () => {
    listSpy.mockResolvedValue([]);
    render(<TabeleTemplatesGrid onTemplateClick={vi.fn()} />);
    expect(await screen.findByTestId('tabele-templates-grid-empty')).toHaveTextContent(/approved/);
  });

  it('surfaces errors with an alert role', async () => {
    listSpy.mockRejectedValue(new Error('Network down'));
    render(<TabeleTemplatesGrid onTemplateClick={vi.fn()} />);
    const err = await screen.findByTestId('tabele-templates-grid-error');
    expect(err).toHaveTextContent('Network down');
    expect(err.getAttribute('role')).toBe('alert');
  });

  it('opens the governance drawer for the picked template', async () => {
    listSpy.mockResolvedValue([
      makeTemplate({ id: 'gov-1', name: 'Governed template', version: '1.2.3' }),
    ]);
    render(<TabeleTemplatesGrid onTemplateClick={vi.fn()} />);
    const governanceBtn = await screen.findByTestId('tabele-templates-grid-card-gov-1-governance');
    act(() => {
      fireEvent.click(governanceBtn);
    });
    expect(screen.getByTestId('template-governance-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('template-governance-drawer-body')).toHaveTextContent(
      'Governed template'
    );
  });
});
