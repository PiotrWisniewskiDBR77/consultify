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
 * ★ K-21c (KANAL Wpis 143): (a) etykiety klikane przez harness szły z
 * PRZYBITEGO angielskiego napisu — w `&lang=pl` harness nic nie znajdował i
 * zrzut pokazywał zamknięte menu („przyrząd kłamie"); teraz etykieta idzie z
 * i18n (`i18n.t`), czyli z tego samego źródła co produkt. (b) `&krok=`
 * prowadzi ekran dalej: `menu` (domyślnie) → `modal` (otwarty modal tworzenia)
 * → `utworzona` (atrapa `POST /api/organizations` + `switch-organization`,
 * widać toast „Organization created — you are now in <nazwa>").
 *
 * URL: ?screen=feedback-k21b-create-org[&role=ADMIN|MEMBER][&fix=off][&krok=menu|modal|utworzona][&lang=en|pl][&theme=light|dark]
 */
import React from 'react';

import i18n from '../../src/i18n';

import { MainLayout } from '../../src/layouts/MainLayout';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { AppView } from '../../src/types';
import type { User } from '../../src/types';

const params = new URLSearchParams(window.location.search);
const rola = params.get('role') === 'MEMBER' ? 'MEMBER' : 'ADMIN';
const fixOff = params.get('fix') === 'off';
const krok = (params.get('krok') || 'menu') as 'menu' | 'modal' | 'utworzona';

const NOWA_ORG = { id: 'k21c-org-nowa', name: 'Baltic Robotics' };

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
  // K-21c: atrapa DWÓCH żądań ścieżki „utwórz → przełącz". Zero backendu.
  if (url.includes('/api/auth/switch-organization')) {
    return new Response(
      JSON.stringify({
        token: 'k21c-token',
        refreshToken: 'k21c-refresh',
        organization: NOWA_ORG,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (url.includes('/api/organizations') && String(init?.method || '').toUpperCase() === 'POST') {
    return new Response(JSON.stringify(NOWA_ORG), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return oryginalnyFetch(input, init);
}) as typeof window.fetch;

/**
 * K-21c — PRZYRZĄD, nie produkt: `handleSwitchOrg` kończy się
 * `setTimeout(() => (window.location.href = window.location.pathname), 300)`.
 * W dev-render `pathname` nie niesie `?screen=`, więc przeładowanie wyrzuciłoby
 * zrzut na pusty ekran ZANIM toast zdąży się pokazać. Wycinamy TYLKO ten jeden
 * callback (rozpoznany po treści), reszta `setTimeout` działa normalnie.
 * Produkt nie jest zmieniony — w aplikacji przeładowanie ma się dziać.
 */
if (krok === 'utworzona') {
  const prawdziwySetTimeout = window.setTimeout.bind(window);
  window.setTimeout = ((fn: any, ms?: any, ...reszta: any[]) => {
    if (typeof fn === 'function' && /location\.href/.test(Function.prototype.toString.call(fn))) {
      return 0 as unknown as number;
    }
    return prawdziwySetTimeout(fn, ms, ...reszta);
  }) as typeof window.setTimeout;
}

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

    // K-21c: etykiety z TEGO SAMEGO źródła co produkt (i18n), nie przybite
    // po angielsku — inaczej `&lang=pl` daje zrzut zamkniętego menu.
    const etykieta = (klucz: string, zapasowa: string) =>
      i18n.t(klucz, { defaultValue: zapasowa }) as string;

    klik(() =>
      document.querySelector<HTMLElement>(
        `[aria-label="${etykieta('userProfile.openMenu', 'Open user profile menu')}"]`
      )
    );
    window.setTimeout(
      () => klik(() => szukajTekst(etykieta('settings.menu.switchOrg', 'Switch Organization'))),
      300
    );

    if (krok === 'modal' || krok === 'utworzona') {
      window.setTimeout(
        () =>
          klik(() =>
            document.querySelector<HTMLElement>('[data-testid="user-menu-create-organization"]')
          ),
        700
      );
    }

    if (krok === 'utworzona') {
      // Wpisz nazwę i potwierdź — dalej idzie REALNY kod produktu
      // (`CreateOrganizationModal` → `onCreated` → `handleSwitchOrg`).
      window.setTimeout(() => {
        const pole = document.querySelector<HTMLInputElement>('#create-organization-name');
        if (!pole) return;
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        setter?.call(pole, NOWA_ORG.name);
        pole.dispatchEvent(new Event('input', { bubbles: true }));
        window.setTimeout(() => {
          const modal = document.querySelector<HTMLElement>(
            '[data-testid="create-organization-modal"]'
          );
          const przyciski = Array.from(modal?.querySelectorAll<HTMLElement>('button') || []);
          przyciski[przyciski.length - 1]?.click();
        }, 120);
      }, 1100);
    }

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
