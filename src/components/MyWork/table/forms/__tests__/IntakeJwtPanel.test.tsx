/**
 * @vitest-environment jsdom
 *
 * Component tests for `<IntakeJwtPanel>` (Block D · D-S4).
 *
 * Coverage:
 *   - Renders the intake summary with target table and current allow-list size.
 *   - Allow-list editor toggles fields and saves a deduplicated array.
 *   - Empty allow-list saves as `null` (fall back to form fields).
 *   - Issuing a JWT link calls the API with the selected TTL and surfaces
 *     the recipient URL.
 *   - Issue button is disabled when the form is unpublished.
 *   - Close button invokes the onClose callback.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

// i18n: resolve against the REAL shipped en/pl JSON rather than the global
// key-returning mock. The allow-list summary is a pluralized string
// (`ideas.table.intakeJwt.fieldCount_one/_other`), so a key-returning mock
// renders the raw key and this assertion cannot see the product's actual
// output. Asserting through the real resource is STRICTER than the literal
// '2 fields' this test used before the string was localized: it now also
// fails if the key, or its plural form, goes missing from the JSON.
import { createRealT } from '@/test-utils/realTranslations';

vi.mock('react-i18next', () => {
  const t = createRealT('en');
  return {
    useTranslation: () => ({ t, i18n: { language: 'en' } }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    Trans: ({ children, i18nKey }: any) => children || i18nKey,
    I18nextProvider: ({ children }: any) => children,
  };
});

const mocks = vi.hoisted(() => ({
  getFormIntakeContext: vi.fn(),
  issueFormIntakeJwt: vi.fn(),
  setFormIntakeAllowList: vi.fn(),
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  getFormIntakeContext: mocks.getFormIntakeContext,
  issueFormIntakeJwt: mocks.issueFormIntakeJwt,
  setFormIntakeAllowList: mocks.setFormIntakeAllowList,
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign((..._args: unknown[]) => undefined, {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

import { IntakeJwtPanel } from '../IntakeJwtPanel';

const FIELDS = [
  { fieldId: 'fld-1', label: 'Email' },
  { fieldId: 'fld-2', label: 'Company' },
  { fieldId: 'fld-3', label: 'Notes' },
];

function makeContext(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    formId: 'form-1',
    formSlug: 'form-1-slug',
    targetTableId: 'tbl-1',
    fieldAllowList: ['fld-1', 'fld-2'],
    publicLinkExpiresAt: null,
    isPublished: true,
    ...overrides,
  };
}

describe('IntakeJwtPanel', () => {
  it('renders the intake summary with target table and allow-list count', () => {
    render(
      <IntakeJwtPanel
        formId="form-1"
        configuredFields={FIELDS}
        baseUrl="https://app.example.com"
        onClose={vi.fn()}
        testInitialContext={makeContext()}
      />
    );
    expect(screen.getByTestId('intake-target-table')).toHaveTextContent('tbl-1');
    expect(screen.getByTestId('intake-allow-list-summary')).toHaveTextContent('2 fields');
  });

  it('saves a deduplicated allow-list when the user toggles fields', async () => {
    const onClose = vi.fn();
    mocks.setFormIntakeAllowList.mockResolvedValue(
      makeContext({ fieldAllowList: ['fld-1', 'fld-3'] })
    );

    render(
      <IntakeJwtPanel
        formId="form-1"
        configuredFields={FIELDS}
        baseUrl="https://app.example.com"
        onClose={onClose}
        testInitialContext={makeContext()}
      />
    );

    fireEvent.click(screen.getByTestId('intake-allow-list-toggle-fld-2'));
    fireEvent.click(screen.getByTestId('intake-allow-list-toggle-fld-3'));

    fireEvent.click(screen.getByTestId('intake-allow-list-save'));

    await waitFor(() => {
      expect(mocks.setFormIntakeAllowList).toHaveBeenCalledWith('form-1', ['fld-1', 'fld-3']);
    });
  });

  it('saves null when the allow-list is cleared', async () => {
    mocks.setFormIntakeAllowList.mockResolvedValue(makeContext({ fieldAllowList: null }));

    render(
      <IntakeJwtPanel
        formId="form-1"
        configuredFields={FIELDS}
        baseUrl="https://app.example.com"
        onClose={vi.fn()}
        testInitialContext={makeContext()}
      />
    );

    fireEvent.click(screen.getByTestId('intake-allow-list-clear'));
    fireEvent.click(screen.getByTestId('intake-allow-list-save'));

    await waitFor(() => {
      expect(mocks.setFormIntakeAllowList).toHaveBeenCalledWith('form-1', null);
    });
  });

  it('issues a JWT link with the selected TTL and shows the recipient URL', async () => {
    mocks.issueFormIntakeJwt.mockResolvedValue({
      token: 'eyJ.test.token',
      expiresAt: '2026-06-08T00:00:00Z',
    });

    render(
      <IntakeJwtPanel
        formId="form-1"
        configuredFields={FIELDS}
        baseUrl="https://app.example.com"
        onClose={vi.fn()}
        testInitialContext={makeContext()}
      />
    );

    fireEvent.change(screen.getByTestId('intake-issue-subject'), {
      target: { value: 'partner@example.com' },
    });

    fireEvent.change(screen.getByTestId('intake-issue-ttl'), {
      target: { value: String(7 * 24 * 60 * 60) },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('intake-issue-submit'));
    });

    await waitFor(() => {
      expect(mocks.issueFormIntakeJwt).toHaveBeenCalledWith('form-1', {
        subject: 'partner@example.com',
        expiresInSeconds: 7 * 24 * 60 * 60,
      });
    });

    expect(screen.getByTestId('intake-issued-result')).toHaveTextContent(
      'https://app.example.com/public/forms/jwt/eyJ.test.token'
    );
  });

  it('disables the issue button when the form is unpublished', () => {
    render(
      <IntakeJwtPanel
        formId="form-1"
        configuredFields={FIELDS}
        baseUrl="https://app.example.com"
        onClose={vi.fn()}
        testInitialContext={makeContext({ isPublished: false })}
      />
    );

    const button = screen.getByTestId('intake-issue-submit');
    expect(button).toBeDisabled();
  });

  it('invokes onClose when the close button is pressed', () => {
    const onClose = vi.fn();
    render(
      <IntakeJwtPanel
        formId="form-1"
        configuredFields={FIELDS}
        baseUrl="https://app.example.com"
        onClose={onClose}
        testInitialContext={makeContext()}
      />
    );
    fireEvent.click(screen.getByTestId('intake-jwt-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
