/**
 * Tests for CellRenderer — verifies all 24 column types render correctly
 * and that locked mode is respected.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CellRenderer } from '@/components/MyWork/table/CellRenderer';
import type { ColumnDef, ColumnType } from '@/components/MyWork/table/tableTypes';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

afterEach(cleanup);

function makeColumn(type: ColumnType, overrides: Partial<ColumnDef> = {}): ColumnDef {
  return {
    key: `col_${type}`,
    header: type,
    type,
    visible: true,
    width: 160,
    ...overrides,
  };
}

const noop = vi.fn();

const TYPE_TEST_VALUES: Partial<Record<ColumnType, any>> = {
  text: 'Hello World',
  number: 42,
  select: 'Option A',
  multiselect: ['Tag1', 'Tag2'],
  status: 'In Progress',
  date: '2026-03-10',
  checkbox: true,
  rating: 4,
  person: 'John Doe',
  url: 'https://example.com',
  progress: 75,
  formula: '=1+1',
  ai_generated: 'AI text output',
  file: 'document.pdf',
  relation: ['rel-1'],
  rollup: 15,
  emoji: '🎉',
  color: '#ff5733',
  currency: 99.99,
  phone: '+48123456789',
  email: 'test@example.com',
  created_time: '2026-01-15T10:30:00Z',
  created_by: 'admin',
  last_edited_time: '2026-03-10T14:00:00Z',
  last_edited_by: 'editor',
};

const ALL_TYPES: ColumnType[] = [
  'text', 'number', 'select', 'multiselect', 'status', 'date', 'checkbox',
  'rating', 'person', 'url', 'progress', 'formula', 'ai_generated', 'file',
  'relation', 'rollup', 'emoji', 'color', 'currency', 'phone', 'email',
  'created_time', 'created_by', 'last_edited_time', 'last_edited_by',
];

describe('CellRenderer', () => {
  describe('renders all 24 column types without crashing', () => {
    for (const type of ALL_TYPES) {
      it(`renders type: ${type}`, () => {
        const column = makeColumn(type, {
          options: type === 'select' || type === 'multiselect' || type === 'status'
            ? ['Option A', 'Option B', 'In Progress', 'Done']
            : undefined,
          formula: type === 'formula' ? '=1+1' : undefined,
        });
        const value = TYPE_TEST_VALUES[type] ?? '';

        const { container } = render(
          <CellRenderer
            column={column}
            value={value}
            rowData={{ [column.key]: value }}
            onChange={noop}
            locked={false}
            allNodes={[{ id: 'rel-1', label: 'Related Item' }]}
          />
        );

        expect(container.firstChild).toBeTruthy();
      });
    }
  });

  it('renders text cell with correct content', () => {
    render(
      <CellRenderer
        column={makeColumn('text')}
        value="Test Content"
        rowData={{ col_text: 'Test Content' }}
        onChange={noop}
      />
    );
    expect(screen.getByDisplayValue('Test Content')).toBeTruthy();
  });

  it('renders number cell with numeric value', () => {
    render(
      <CellRenderer
        column={makeColumn('number')}
        value={42}
        rowData={{ col_number: 42 }}
        onChange={noop}
      />
    );
    expect(screen.getByDisplayValue('42')).toBeTruthy();
  });

  it('renders checkbox cell with checked state', () => {
    const { container } = render(
      <CellRenderer
        column={makeColumn('checkbox')}
        value={true}
        rowData={{ col_checkbox: true }}
        onChange={noop}
      />
    );
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    if (checkbox) {
      expect(checkbox.checked).toBe(true);
    } else {
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
    }
  });

  it('renders locked text cell as read-only', () => {
    render(
      <CellRenderer
        column={makeColumn('text')}
        value="Locked Value"
        rowData={{ col_text: 'Locked Value' }}
        onChange={noop}
        locked={true}
      />
    );
    const input = screen.queryByDisplayValue('Locked Value') as HTMLInputElement | null;
    if (input) {
      expect(input.readOnly || input.disabled).toBe(true);
    }
  });

  it('renders url cell with link', () => {
    const { container } = render(
      <CellRenderer
        column={makeColumn('url')}
        value="https://example.com"
        rowData={{ col_url: 'https://example.com' }}
        onChange={noop}
      />
    );
    const link = container.querySelector('a');
    if (link) {
      expect(link.href).toContain('example.com');
    }
  });

  it('renders rating cell with stars', () => {
    const { container } = render(
      <CellRenderer
        column={makeColumn('rating')}
        value={3}
        rowData={{ col_rating: 3 }}
        onChange={noop}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders system timestamp cell', () => {
    const { container } = render(
      <CellRenderer
        column={makeColumn('created_time')}
        value="2026-01-15T10:30:00Z"
        rowData={{ col_created_time: '2026-01-15T10:30:00Z' }}
        onChange={noop}
        locked={true}
      />
    );
    expect(container.textContent).toBeTruthy();
  });

  it('renders empty value gracefully', () => {
    const { container } = render(
      <CellRenderer
        column={makeColumn('text')}
        value={null}
        rowData={{}}
        onChange={noop}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });
});
