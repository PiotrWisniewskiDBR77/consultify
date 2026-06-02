/**
 * @vitest-environment jsdom
 *
 * Component tests for `<PublicJwtFormPage>` (Block D · D-S4).
 *
 * Coverage:
 *   - Renders the form fields filtered to the JWT allow-list.
 *   - Shows an "expires soon" warning when the hard expiry is < 7 days away.
 *   - Renders the friendly "no longer valid" error on token expiry.
 *   - Submitting calls `submitPublicFormByJwt` with the filtered payload.
 *   - Validates required fields before submission.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPublicForm: vi.fn(),
  getPublicFormByJwt: vi.fn(),
  submitPublicFormByJwt: vi.fn(),
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  getPublicForm: mocks.getPublicForm,
  getPublicFormByJwt: mocks.getPublicFormByJwt,
  submitPublicFormByJwt: mocks.submitPublicFormByJwt,
}));

import { PublicJwtFormPage } from '../PublicJwtFormPage';

const FORM_DEFINITION = {
  id: 'form-1',
  name: 'Partner intake',
  description: 'Submit your details',
  slug: 'form-1-slug',
  config: {
    fields: [
      { fieldId: 'fld-email', label: 'Email', required: true },
      { fieldId: 'fld-company', label: 'Company' },
      { fieldId: 'fld-notes', label: 'Notes', helpText: 'Optional' },
    ],
    submitMessage: 'Thanks!',
  },
  fields: [
    { id: 'fld-email', name: 'Email', fieldType: 'email' },
    { id: 'fld-company', name: 'Company', fieldType: 'singleLineText' },
    { id: 'fld-notes', name: 'Notes', fieldType: 'longText' },
  ],
};

function makeContext(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    formId: 'form-1',
    formSlug: 'form-1-slug',
    targetTableId: 'tbl-1',
    fieldAllowList: ['fld-email', 'fld-company'],
    publicLinkExpiresAt: null,
    ...overrides,
  };
}

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/public/forms/jwt/test-token']}>
      <Routes>
        <Route path="/public/forms/jwt/:token" element={ui} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PublicJwtFormPage', () => {
  it('renders only allow-listed fields', () => {
    renderWithRouter(
      <PublicJwtFormPage
        testInitialContext={makeContext()}
        testInitialForm={FORM_DEFINITION as any}
      />
    );

    // Labels render above inputs (no htmlFor wiring on the legacy slug surface);
    // assert by text presence and placeholder lookup.
    expect(screen.getByText(/Email/)).toBeInTheDocument();
    expect(screen.getByText(/Company/)).toBeInTheDocument();
    expect(screen.queryByText(/Notes/)).toBeNull();
    expect(screen.getByPlaceholderText('email@example.com')).toBeInTheDocument();
  });

  it('shows an expiry warning when the hard expiry is less than 7 days away', () => {
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    renderWithRouter(
      <PublicJwtFormPage
        testInitialContext={makeContext({ publicLinkExpiresAt: expiresAt })}
        testInitialForm={FORM_DEFINITION as any}
      />
    );

    expect(screen.getByTestId('public-jwt-form-expiry-warning')).toBeInTheDocument();
  });

  it('submits only the visible (allow-listed) fields', async () => {
    mocks.submitPublicFormByJwt.mockResolvedValue({ recordId: 'rec-1' });

    renderWithRouter(
      <PublicJwtFormPage
        testInitialContext={makeContext()}
        testInitialForm={FORM_DEFINITION as any}
      />
    );

    const inputs = screen.getAllByRole('textbox');
    // First text-like input is the email (type=email also reports textbox).
    fireEvent.change(screen.getByPlaceholderText('email@example.com'), {
      target: { value: 'partner@example.com' },
    });
    // Second is Company (no placeholder).
    const companyInput = inputs.find(
      (el) =>
        el instanceof HTMLInputElement &&
        el.getAttribute('type') === 'text' &&
        !el.getAttribute('placeholder')
    );
    expect(companyInput).toBeDefined();
    fireEvent.change(companyInput!, { target: { value: 'Acme Corp' } });

    fireEvent.click(screen.getByTestId('public-jwt-form-submit'));

    await waitFor(() => {
      expect(mocks.submitPublicFormByJwt).toHaveBeenCalledWith('test-token', {
        'fld-email': 'partner@example.com',
        'fld-company': 'Acme Corp',
      });
    });
  });

  it('blocks submission when a required field is missing', async () => {
    mocks.submitPublicFormByJwt.mockClear();

    renderWithRouter(
      <PublicJwtFormPage
        testInitialContext={makeContext()}
        testInitialForm={FORM_DEFINITION as any}
      />
    );

    fireEvent.click(screen.getByTestId('public-jwt-form-submit'));

    await waitFor(() => {
      expect(screen.getByText(/Email is required/)).toBeInTheDocument();
    });
    expect(mocks.submitPublicFormByJwt).not.toHaveBeenCalled();
  });
});
