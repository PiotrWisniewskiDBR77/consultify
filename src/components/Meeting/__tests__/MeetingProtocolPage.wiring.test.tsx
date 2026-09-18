/**
 * @vitest-environment jsdom
 *
 * MTG-2a (DEC-607) — WIRING test for `/meetings/:meetingId/protocol`.
 *
 * Wpis 112 P1 hard condition: the flag-OFF fail-closed behaviour must be
 * proven on a REAL router mount that exercises the actual `<Navigate>`, NOT on
 * a source-slice mirror of the route table (the `meetingsCanonicalRoute.test.ts`
 * pattern reads AppRoutes.tsx as text — that asserts a string, not a redirect).
 * Mounting the whole real `AppRoutes` is impractical (lazy imports + auth/org/
 * flag providers), so this mounts the REAL `MeetingProtocolPage` inside a REAL
 * `MemoryRouter` + `Routes` with a sibling object-card route. The `<Navigate>`
 * here is the same react-router-dom component AppRoutes would render, and the
 * assertion is on the resulting LOCATION (the object card actually mounts), so
 * the redirect is measured, not mirrored.
 *
 * The viewer itself is stubbed to a probe: this file owns the page's routing
 * contract (flag gate + redirect target + onClose target + the meetingId it
 * forwards), while `MeetingProtocolViewer.wiring.test.tsx` owns the viewer's
 * approve/errata wiring. Mocking the heavy shell-based viewer keeps the two
 * contracts independently falsifiable.
 *
 * Mutations that MUST turn this RED (proven in the report):
 *   · drop the `<Navigate>` (return null when OFF)        → OFF no longer redirects;
 *   · redirect to the wrong target (e.g. `/meetings`)      → object card never mounts;
 *   · remove the flag gate (always render the viewer)      → OFF renders the document;
 *   · forward a wrong/empty meetingId to the viewer        → probe records the wrong id;
 *   · onClose navigates somewhere other than objectRoute   → close probe lands wrong.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// tests/setup.ts globally stubs `useNavigate` to a no-op (for tests that render
// router-aware components without a <Router>). This file mounts a REAL router
// and asserts REAL redirects, so restore the genuine react-router-dom module —
// the actual `<Navigate>` and `useNavigate` must run for the wiring to be
// measured rather than mocked away.
vi.mock('react-router-dom', async (importOriginal) => await importOriginal<any>());

// i18n: the page itself renders no copy, but the router stack and any child pull
// `react-i18next` in at module scope; keep the global mock shape (tests/setup.ts)
// honest by returning the literal defaultValue.
vi.mock('react-i18next', () => {
  const translate = (k: string, opts?: string | { defaultValue?: string }) =>
    (typeof opts === 'string' ? opts : opts?.defaultValue) ?? k;
  return {
    useTranslation: () => ({
      t: translate,
      i18n: { language: 'en', getFixedT: () => translate, changeLanguage: async () => undefined },
    }),
    Trans: ({ children, i18nKey }: any) => children || i18nKey,
    I18nextProvider: ({ children }: any) => children,
    Translation: ({ children }: any) => children({ t: translate, i18n: {} }),
    initReactI18next: { type: '3rdParty', init: () => undefined },
  };
});

const { flagState, viewerProps } = vi.hoisted(() => ({
  flagState: { enabled: false },
  viewerProps: { last: null as null | { meetingId: string; closed: boolean } },
}));

vi.mock('../meetingProtocolFlag', () => ({
  isMeetingProtocolEnabled: () => flagState.enabled,
  MEETING_PROTOCOL_FLAG_KEYS: { env: 'VITE_MEETING_PROTOCOL' },
}));

// Stub the viewer to a probe that records the meetingId it was handed and
// exposes a button firing onClose, so the page's forwarding + close target are
// asserted on the REAL page wiring rather than the viewer internals.
vi.mock('../MeetingProtocolViewer', () => ({
  MeetingProtocolViewer: ({ meetingId, onClose }: { meetingId: string; onClose: () => void }) => {
    viewerProps.last = { meetingId, closed: false };
    return (
      <div data-testid="viewer-probe">
        <span data-testid="viewer-meeting-id">{meetingId}</span>
        <button type="button" data-testid="viewer-close" onClick={onClose}>
          close
        </button>
      </div>
    );
  },
}));

import { MeetingProtocolPage } from '../MeetingProtocolPage';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        <Route path="/meetings/:meetingId/protocol" element={<MeetingProtocolPage />} />
        <Route
          path="/meetings/:meetingId"
          element={<div data-testid="object-card">OBJECT_CARD</div>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('MeetingProtocolPage — flag fail-closed wiring (Wpis 112 P1)', () => {
  beforeEach(() => {
    flagState.enabled = false;
    viewerProps.last = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('flag OFF: the real <Navigate> redirects to the object card, never rendering the document', () => {
    renderAt('/meetings/meeting-1/protocol');
    // The redirect actually fired: the sibling object-card route is now mounted
    // and the location moved off /protocol.
    expect(screen.getByTestId('object-card')).toHaveTextContent('OBJECT_CARD');
    expect(screen.getByTestId('location')).toHaveTextContent('/meetings/meeting-1');
    expect(screen.queryByTestId('meeting-protocol-page')).toBeNull();
    expect(screen.queryByTestId('viewer-probe')).toBeNull();
  });

  it('flag ON: renders the page shell and forwards the real meetingId to the viewer', () => {
    flagState.enabled = true;
    renderAt('/meetings/meeting-xyz/protocol');
    expect(screen.getByTestId('meeting-protocol-page')).toBeInTheDocument();
    expect(screen.getByTestId('viewer-meeting-id')).toHaveTextContent('meeting-xyz');
    expect(viewerProps.last?.meetingId).toBe('meeting-xyz');
    // Still on the protocol route — no redirect when the flag is ON.
    expect(screen.getByTestId('location')).toHaveTextContent('/meetings/meeting-xyz/protocol');
    expect(screen.queryByTestId('object-card')).toBeNull();
  });

  it('flag ON: onClose navigates back to the object card route', () => {
    flagState.enabled = true;
    renderAt('/meetings/meeting-xyz/protocol');
    fireEvent.click(screen.getByTestId('viewer-close'));
    expect(screen.getByTestId('location')).toHaveTextContent('/meetings/meeting-xyz');
    expect(screen.getByTestId('object-card')).toHaveTextContent('OBJECT_CARD');
  });
});
