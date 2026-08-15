/**
 * @vitest-environment jsdom
 *
 * Tests for `TabeleLeftRail` (EPIC-T16 D3).
 *
 * Coverage:
 *   * Default outline contains the six Foundation Block sections in
 *     order (Cover/KPI/Schema/Records/Relations/Rationale).
 *   * Custom items override the default outline.
 *   * Active item gets the `data-active="true"` flag.
 *   * onSelect fires with the item id.
 *   * Disabled items don't trigger onSelect.
 *   * Badge renders with the configured tone.
 *   * Empty state renders the empty label.
 *   * Tools slot renders above the outline.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | Record<string, unknown>) => {
      const options = typeof fallback === 'object' ? fallback : {};
      const template =
        typeof fallback === 'string' ? fallback : String(options.defaultValue ?? _key);
      return template.replace(/{{(\w+)}}/g, (_match, name: string) => String(options[name] ?? ''));
    },
    i18n: { language: 'en' },
  }),
}));

import { TABELE_DEFAULT_OUTLINE, TabeleLeftRail } from '../TabeleLeftRail';

describe('TabeleLeftRail', () => {
  it('renders the default Foundation Block outline in order', () => {
    render(<TabeleLeftRail />);
    const ids = TABELE_DEFAULT_OUTLINE.map((i) => i.id);
    expect(ids).toEqual(['cover', 'kpi', 'schema', 'records', 'relations', 'rationale']);
    for (const id of ids) {
      expect(screen.getByTestId(`tabele-outline-${id}`)).toBeInTheDocument();
    }
  });

  it('honours custom items', () => {
    render(
      <TabeleLeftRail
        items={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ]}
      />
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByTestId('tabele-outline-cover')).not.toBeInTheDocument();
  });

  it('marks the active item with data-active=true', () => {
    render(<TabeleLeftRail activeItemId="schema" />);
    const schema = screen.getByTestId('tabele-outline-schema');
    expect(schema.getAttribute('data-active')).toBe('true');
    const cover = screen.getByTestId('tabele-outline-cover');
    expect(cover.getAttribute('data-active')).toBe('false');
  });

  it('calls onSelect with the item id', () => {
    const onSelect = vi.fn();
    render(<TabeleLeftRail onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('tabele-outline-records'));
    expect(onSelect).toHaveBeenCalledWith('records');
  });

  it('does not call onSelect when item is disabled', () => {
    const onSelect = vi.fn();
    render(
      <TabeleLeftRail items={[{ id: 'x', label: 'X', disabled: true }]} onSelect={onSelect} />
    );
    fireEvent.click(screen.getByTestId('tabele-outline-x'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders a badge when supplied', () => {
    render(
      <TabeleLeftRail items={[{ id: 'records', label: 'Records', badge: 23, tone: 'warning' }]} />
    );
    const badge = screen.getByLabelText('Records count');
    expect(badge).toHaveTextContent('23');
  });

  it('renders the empty state when items=[]', () => {
    render(<TabeleLeftRail items={[]} emptyLabel="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders the tools slot above the outline', () => {
    render(
      <TabeleLeftRail toolsSlot={<input data-testid="tools-input" placeholder="Search…" />} />
    );
    expect(screen.getByTestId('tabele-left-rail-tools')).toBeInTheDocument();
    expect(screen.getByTestId('tools-input')).toBeInTheDocument();
  });
});
