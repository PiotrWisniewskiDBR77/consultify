/**
 * @vitest-environment jsdom
 *
 * TAB-003 regression test: EntityStatusChip used to "humanize" a raw status
 * string (underscore -> space, capitalize) with no translation, so tables
 * showed English labels ("Planning", "Awaiting approval") even when the UI
 * language was Polish. This test locks in the fix: a known status resolves
 * through the `statusChip.*` i18n dictionary, an unrecognized status still
 * falls back to the mechanical humanization (never a raw i18n key), and an
 * explicit `label` prop always wins over both.
 *
 * `react-i18next` is mocked with a tiny in-memory dictionary mirroring a
 * couple of real entries from public/locales/pl/translation.json's
 * `statusChip` block, so the test doesn't depend on loading the real JSON
 * files over HttpBackend.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EntityStatusChip } from '../../../../../src/components/ui/primitives/chips/EntityStatusChip';

const PL_DICT: Record<string, string> = {
  'statusChip.planning': 'Planowanie',
  'statusChip.awaiting_approval': 'Czeka na zgodę',
  'statusChip.failed': 'Błąd',
  'statusChip.deprecated': 'Wycofane',
};

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: { defaultValue?: string }) => PL_DICT[key] ?? opts?.defaultValue ?? key,
      i18n: { language: 'pl' },
    }),
  };
});

describe('EntityStatusChip (TAB-003 i18n)', () => {
  it('renders the translated Polish label for a known status', () => {
    render(<EntityStatusChip status="planning" />);
    expect(screen.getByText('Planowanie')).toBeInTheDocument();
    expect(screen.queryByText('Planning')).not.toBeInTheDocument();
  });

  it('translates an underscore status via the normalized dictionary key', () => {
    render(<EntityStatusChip status="AWAITING_APPROVAL" />);
    expect(screen.getByText('Czeka na zgodę')).toBeInTheDocument();
  });

  it('falls back to mechanical humanization for a status with no dictionary entry', () => {
    render(<EntityStatusChip status="some_new_status" />);
    // Never leaks the raw i18n key or the raw status string.
    expect(screen.queryByText('statusChip.some_new_status')).not.toBeInTheDocument();
    expect(screen.getByText('Some new status')).toBeInTheDocument();
  });

  it('lets an explicit label override win over the dictionary', () => {
    render(<EntityStatusChip status="failed" label="Custom label" />);
    expect(screen.getByText('Custom label')).toBeInTheDocument();
    expect(screen.queryByText('Błąd')).not.toBeInTheDocument();
  });

  it('renders the governed deprecated lifecycle status instead of leaking an i18n key', () => {
    render(<EntityStatusChip status="deprecated" />);
    expect(screen.getByText('Wycofane')).toBeInTheDocument();
    expect(screen.queryByText('statusChip.deprecated')).not.toBeInTheDocument();
  });

  it('handles a null/empty status without crashing', () => {
    render(<EntityStatusChip status={null} />);
    // No label text; component should still mount (neutral tone, empty label).
    expect(document.querySelector('[role="status"]')).toBeInTheDocument();
  });
});
