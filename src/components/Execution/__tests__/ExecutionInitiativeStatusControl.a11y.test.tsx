/**
 * @vitest-environment jsdom
 *
 * CB-01 — the Execution table's inline status control (extracted from
 * ExecutionHub so it can be mounted directly instead of the whole 4000+
 * line hub, which OOMs jsdom on mount). Verifies the transparent select's
 * accessible name, focusability, and that choosing a target status invokes
 * onChange with the real value — in both EN and real PL.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRealT } from '@/test-utils/realTranslations';
import { InitiativeStatus } from '@/types/core';

function mockI18n(lang: 'en' | 'pl') {
  const t = createRealT(lang);
  vi.doMock('react-i18next', () => ({
    useTranslation: () => ({ t, i18n: { language: lang } }),
  }));
}

let ExecutionInitiativeStatusControlImport: typeof import('../ExecutionInitiativeStatusControl');

const mountWithLang = async (lang: 'en' | 'pl', onChange: (next: InitiativeStatus) => void) => {
  vi.resetModules();
  mockI18n(lang);
  ExecutionInitiativeStatusControlImport = await import('../ExecutionInitiativeStatusControl');
  const { ExecutionInitiativeStatusControl } = ExecutionInitiativeStatusControlImport;
  return render(
    <ExecutionInitiativeStatusControl
      initiativeName="Apator rollout"
      currentStatus={InitiativeStatus.DRAFT}
      onChange={onChange}
    />
  );
};

beforeEach(() => {
  vi.resetModules();
});

describe('ExecutionInitiativeStatusControl — accessible contract (EN)', () => {
  it('names the transparent status select with the initiative name', async () => {
    await mountWithLang('en', vi.fn());

    // Real EN string: execution.table.changeStatusFor = "Change status for {{name}}"
    expect(
      screen.getByRole('combobox', { name: 'Change status for Apator rollout' })
    ).toBeInTheDocument();
  });

  it('is focusable via the accessible name', async () => {
    await mountWithLang('en', vi.fn());

    const select = screen.getByRole('combobox', { name: 'Change status for Apator rollout' });
    select.focus();
    expect(select).toHaveFocus();
  });

  it('calls onChange with the chosen target status', async () => {
    const onChange = vi.fn();
    await mountWithLang('en', onChange);

    const select = screen.getByRole('combobox', { name: 'Change status for Apator rollout' });
    fireEvent.change(select, { target: { value: InitiativeStatus.PENDING_REVIEW } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(InitiativeStatus.PENDING_REVIEW);
  });

  it('does not render a mutation control when disabled', async () => {
    vi.resetModules();
    mockI18n('en');
    const { ExecutionInitiativeStatusControl } =
      await import('../ExecutionInitiativeStatusControl');
    render(
      <ExecutionInitiativeStatusControl
        initiativeName="Apator rollout"
        currentStatus={InitiativeStatus.DRAFT}
        onChange={vi.fn()}
        disabled
      />
    );

    expect(screen.queryByRole('combobox', { name: /Change status for/i })).not.toBeInTheDocument();
  });
});

describe('ExecutionInitiativeStatusControl — accessible contract (real PL)', () => {
  it('names the transparent status select in real Polish, not English fallback', async () => {
    await mountWithLang('pl', vi.fn());

    // Real PL string: execution.table.changeStatusFor = "Zmień status dla {{name}}"
    expect(
      screen.getByRole('combobox', { name: 'Zmień status dla Apator rollout' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Change status for/i })).not.toBeInTheDocument();
  });

  it('calls onChange with the chosen target status under real Polish', async () => {
    const onChange = vi.fn();
    await mountWithLang('pl', onChange);

    const select = screen.getByRole('combobox', { name: 'Zmień status dla Apator rollout' });
    fireEvent.change(select, { target: { value: InitiativeStatus.PENDING_REVIEW } });

    expect(onChange).toHaveBeenCalledWith(InitiativeStatus.PENDING_REVIEW);
  });
});
