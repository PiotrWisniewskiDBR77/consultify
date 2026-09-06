/**
 * MVP audit 05/06.09.2026 (evidence/audyt-mvp-20260906/B2/RAPORT_B2.md,
 * WAŻNY #8 / defekt 2): the "Nowy audyt" modal's empty state (no eligible
 * pack) said "...zakładce Library..." — an English tab name dropped into an
 * otherwise fully Polish sentence, even though the real tab is labeled
 * "Biblioteka" (audits.method.tabs.library → 'Biblioteka' in pl). Fixed in
 * `src/components/Audit/method/NewAuditModal.tsx`.
 *
 * Mutation check: reverting the string back to "...zakładce Library..."
 * makes this test fail.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { NewAuditModal } from '../../../src/components/Audit/method/NewAuditModal';

vi.mock('@/components/ui/primitives/Modal', () => ({
  Modal: ({ children, footer }: any) => (
    <div>
      {children}
      {footer}
    </div>
  ),
}));
vi.mock('@/components/ui/primitives/Button', () => ({
  Button: ({ children, ...rest }: any) => <button {...rest}>{children}</button>,
}));

describe('NewAuditModal — empty state copy is fully Polish', () => {
  it('does not contain the English tab name "Library" inside the Polish sentence', () => {
    render(
      <NewAuditModal
        open
        onClose={() => {}}
        packs={[]}
        isPolish
        onStartAudit={() => {}}
        starting={false}
      />
    );
    const empty = screen.getByText(/Opublikuj pakiet w zakładce/i);
    expect(empty.textContent).not.toMatch(/\bLibrary\b/);
    expect(empty.textContent).toMatch(/zakładce Biblioteka/);
  });
});
