/**
 * Dev-render: D-01 (DLUG-PO-MVP, P2/S) — REALNY <FirstRunOnboarding> (modal
 * powitalny, krok 1 „Meet Teresa") z wymuszonym otwarciem bramy, żeby zmierzyć
 * kolor CTA „Get started".
 *
 * Przed naprawą CTA używał <Button variant="brand"> = crimson #85182F
 * (złamanie kanonu „czerwień tylko dla semantyki krytycznej"; karta
 * akcepty-f2-20260917/KARTY-2.md, pomiar pikselowy). Po naprawie
 * variant="primary" = neutralny navy (Button.tsx §5.1: „the single main action
 * look across all modules"; crimson brand reserved for Talk-to-Teresa).
 *
 * Brama first-run (useFirstRunOnboarding) otwiera się TYLKO dla nowego
 * użytkownika POZA trybem demo, więc harness: (1) ustawia currentUser +
 * isDemoMode=false w realnym useAppStore, (2) stubuje
 * Api.onboarding.getFirstRunState → { completed:false } (stan „brand-new
 * user"), (3) czyści lokalną flagę done. Modal renderuje się przez
 * createPortal, a jedyna zależność kontekstowa to useNavigate → MemoryRouter
 * wystarczy, bez ciężkich providerów (zero nieautoryzowanych calli sieciowych,
 * bledyKonsoli=0).
 *
 * URL: ?screen=d01-onboarding-cta &lang=en|pl &theme=light|dark
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { FirstRunOnboarding } from '../../src/components/Onboarding/FirstRunOnboarding';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';

const HARNESS_USER_ID = 'user-d01-harness';

useAppStore.setState({
  isDemoMode: false,
  currentUser: {
    id: HARNESS_USER_ID,
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr.wisniewski@dbr77.com',
    role: 'ADMIN',
    status: 'active',
    isAuthenticated: true,
    accessLevel: 'full',
    preferredLanguage: 'en',
    organizationId: 'org-d01-harness',
    organizationName: 'Harness Org',
  } as any,
  currentOrganization: { id: 'org-d01-harness', name: 'Harness Org' } as any,
});

// Deterministic first-run gate: a brand-new user, no completed flag.
(Api.onboarding as any).getFirstRunState = async () => ({ completed: false, role: null });
(Api.onboarding as any).setFirstRunRole = async () => undefined;
(Api.onboarding as any).markFirstRunComplete = async () => undefined;
(Api.onboarding as any).resetFirstRun = async () => undefined;

try {
  localStorage.removeItem(`consultify_onboarding_done:${HARNESS_USER_ID}`);
} catch {
  /* ignore */
}

export default function D01OnboardingCtaScreen() {
  return (
    <MemoryRouter>
      <FirstRunOnboarding />
    </MemoryRouter>
  );
}
