/**
 * Dev-render: K-21b (FEEDBACK-1 DEC-575, zgłoszenie testera Tomka #61 —
 * „nie da się utworzyć organizacji").
 *
 * PO CO (CLAUDE.md §7): zrzut REALNEJ powłoki, zanim właściciel cokolwiek
 * zobaczy. Mountowany jest PRAWDZIWY `<MainLayout>` z prawdziwym
 * `<UserProfileMenu>` w nagłówku — czyli dokładnie to, co widzi tester, a nie
 * odtworzona geometria.
 *
 * Stan PRZED (`?fix=off`) chowa nowe wejście, więc widać gałąź, w której
 * użytkownik z jedną organizacją nie miał JAK utworzyć kolejnej.
 *
 * Atrapa transportu: `/api/organizations/current` oddaje jedną organizację z
 * rolą z `?role=`. Bez backendu, bez logowania.
 *
 * URL: ?screen=feedback-k21b-create-org[&role=ADMIN|MEMBER][&fix=off][&lang=en|pl][&theme=light|dark]
 */
import React from 'react';

import { MainLayout } from '../../src/layouts/MainLayout';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { AppView } from '../../src/types';
import type { User } from '../../src/types';

const params = new URLSearchParams(window.location.search);
const rola = params.get('role') === 'MEMBER' ? 'MEMBER' : 'ADMIN';
const fixOff = params.get('fix') === 'off';

const ORG = { id: 'k21b-org', name: 'Northwind Manufacturing' };

const uzytkownik = {
  id: 'k21b-user',
  email: 'tomasz.jankowski@k21.local',
  firstName: 'Tomasz',
  lastName: 'Jankowski',
  language: 'en',
  role: rola,
  organizationId: ORG.id,
  isAuthenticated: true,
} as User;

// Onboarding pierwszego uruchomienia zasłoniłby nagłówek na każdym zrzucie —
// to przyrząd, nie produkt tej naprawy (lekcja „przyrząd zasłania produkt").
try {
  localStorage.setItem('consultify_onboarding_done:k21b-user', 'true');
} catch {
  /* brak localStorage — nic nie szkodzi */
}

useAppStore.setState({
  currentUser: uzytkownik,
  currentOrganization: ORG,
  currentView: AppView.MY_WORK,
  isChatCollapsed: true,
});

// Atrapa transportu — tylko odczyt listy organizacji; zero zapisów.
const oryginalnyFetch = window.fetch.bind(window);
window.fetch = (async (input: any, init?: any) => {
  const url = String(typeof input === 'string' ? input : input?.url || '');
  if (url.includes('/api/organizations/current')) {
    return new Response(
      JSON.stringify({ organizations: [{ ...ORG, role: rola, is_current: true }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return oryginalnyFetch(input, init);
}) as typeof window.fetch;

/**
 * Otwiera menu profilu i rozwija przełącznik organizacji, żeby zrzut pokazał
 * listę razem z wejściem „Create Organization". Klikane są REALNE kontrolki
 * produktu (aria-label / etykieta), nie wewnętrzny stan komponentu.
 */
function useOtwartyPrzelacznik() {
  React.useEffect(() => {
    let anulowane = false;
    const klik = (znajdz: () => HTMLElement | null, proby = 40) => {
      const krok = () => {
        if (anulowane) return;
        const el = znajdz();
        if (el) {
          el.click();
          return;
        }
        if (proby-- > 0) window.setTimeout(krok, 50);
      };
      krok();
    };
    const szukajTekst = (tekst: string) =>
      Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) =>
        (b.textContent || '').includes(tekst)
      ) || null;

    klik(() => document.querySelector<HTMLElement>('[aria-label="Open user profile menu"]'));
    window.setTimeout(
      () => klik(() => szukajTekst('Switch Organization') || szukajTekst('Zmień organizację')),
      300
    );
    return () => {
      anulowane = true;
    };
  }, []);
}

const FeedbackK21bCreateOrgScreen: React.FC = () => {
  useOtwartyPrzelacznik();
  return (
    <>
      {fixOff && (
        <style>{`[data-testid="user-menu-create-organization"]{display:none !important}`}</style>
      )}
      <AppProviders>
        <MainLayout breadcrumbs={['K-21b']}>
          <div className="p-6 text-sm text-c-text-secondary" />
        </MainLayout>
      </AppProviders>
    </>
  );
};

export default FeedbackK21bCreateOrgScreen;
