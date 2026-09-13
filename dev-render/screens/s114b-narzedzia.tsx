import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'react-hot-toast';

import { AccessBlockedModal } from '../../src/components/access/AccessBlockedModal';
import { ConvertToDialog } from '../../src/components/MyWork/ConvertToDialog';
import { describeIdeaConversion } from '../../src/components/MyWork/ideaConversionOutcome';
import { NotebookVersionHistory } from '../../src/components/MyWork/notebook/NotebookVersionHistory';
import { OrgSetupWizard } from '../../src/views/OrgSetupWizard';
import { useAppStore } from '../../src/store/useAppStore';

/**
 * S1.14b — dowody PO dla napraw Idea · Notes · Documents (raport S1.14, staging 13.09).
 *
 * Każda część montuje REALNY komponent produktu (nie makietę) z danymi atrapowymi,
 * żeby zrzut pokazywał dokładnie to, co zobaczy użytkownik.
 *
 *   ?screen=s114b-narzedzia&part=b1   ConvertToDialog — widoczny powód nieudanej konwersji
 *   ?screen=s114b-narzedzia&part=b2   AccessBlockedModal — TRIAL_PROFILE_INCOMPLETE + CTA
 *   ?screen=s114b-narzedzia&part=w3   AccessBlockedModal — TRIAL_EXPORT_DISABLED po angielsku
 *   ?screen=s114b-narzedzia&part=b3   OrgSetupWizard — uzupełnia ISTNIEJĄCĄ organizację
 *   ?screen=s114b-narzedzia&part=b6   NotebookVersionHistory — lista wersji, „Restore" osiągalny
 *   ?screen=s114b-narzedzia&part=w11  toast akcji „Team Chat" — mówi, co naprawdę zrobiła
 */

const REJECTION = 'projectId is required — every initiative must belong to a project';

/** Atrapa sieci na czas ekranu — bez logowania i bez żywego backendu. */
function useStubbedFetch(handler: (url: string) => unknown | undefined) {
  // Instalacja W TRAKCIE RENDERU, nie w useEffect: efekty dzieci odpalają się
  // PRZED efektem rodzica, więc atrapa w useEffect spóźniała się o pierwsze
  // żądanie komponentu (404 w konsoli zrzutu).
  const handlerRef = React.useRef(handler);
  handlerRef.current = handler;
  React.useState(() => {
    const original = window.fetch;
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : String((input as Request)?.url ?? input);
      const stubbed = handlerRef.current(url);
      if (stubbed !== undefined) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => stubbed,
          text: async () => JSON.stringify(stubbed),
        } as unknown as Response;
      }
      return original(input as RequestInfo, init);
    }) as typeof window.fetch;
    return true;
  });
}

function Ramka({ tytul, opis, children }: { tytul: string; opis: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)', color: 'var(--c-text)', padding: 28 }}>
      <h1 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{tytul}</h1>
      <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', marginBottom: 22, maxWidth: 760 }}>
        {opis}
      </p>
      {children}
    </div>
  );
}

function CzescB1() {
  const [ready, setReady] = React.useState(false);
  useStubbedFetch(
    React.useCallback(
      (url) => (/\/api\/tools(\?|$)/.test(url) ? { id: 'session-dev', status: 'DRAFT' } : undefined),
      []
    )
  );
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      document.querySelectorAll('button').forEach((b) => {
        if (b.textContent?.includes('Confirm & create')) b.click();
      });
      window.setTimeout(() => setReady(true), 300);
    }, 250);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <Ramka
      tytul="B1 · Idea → Initiative: nieudana konwersja mówi, dlaczego"
      opis={`Przed naprawą okno znikało i nie działo się nic (400 lądował tylko w konsoli jako PAGEERROR). Teraz okno czeka i pokazuje powód. Stan: ${ready ? 'po kliknięciu „Confirm & create"' : 'klikam…'}`}
    >
      <ConvertToDialog
        open
        onClose={() => undefined}
        sources={[{ type: 'idea', id: 'idea-1', title: 'Order-to-Cash Diagnostic - Warsaw Plant' }]}
        targetType="initiative"
        onConvert={async () => {
          throw new Error(REJECTION);
        }}
      />
    </Ramka>
  );
}

function CzescDostep({ code, message }: { code: string; message: string }) {
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('access:blocked', {
          detail: { code, message, cta: { label: 'Skontaktuj się z zespołem', href: '/contact' } },
        })
      );
    }, 150);
    return () => window.clearTimeout(timer);
  }, [code, message]);
  return (
    <MemoryRouter>
      <Ramka
        tytul={`${code} — komunikat i CTA z katalogu i18n`}
        opis="Serwer przysyła też własny napis; interfejs bierze teraz zdanie z katalogu języka, nigdy polskiego napisu z API w angielskim UI."
      >
        <AccessBlockedModal />
      </Ramka>
    </MemoryRouter>
  );
}

function CzescB3() {
  // Zasiew PRZED pierwszym renderem kreatora — w produkcie organizacja jest już
  // w sesji, zanim ekran się zamontuje; zasiew w useEffect pokazywałby puste
  // pole nazwy, czyli stan, którego użytkownik nigdy nie zobaczy.
  React.useState(() => {
    useAppStore.setState({
      currentUser: { id: 'user-dev', email: 'qa.fable@dbr77.com', role: 'OWNER' } as never,
      currentOrganization: { id: 'org-dev', name: 'QA Fable 13.09' } as never,
    });
    return true;
  });
  return <OrgSetupWizard />;
}

function CzescB6() {
  useStubbedFetch(
    React.useCallback(
      (url) =>
        url.includes('/versions')
          ? {
              data: [
                {
                  id: 'v-2',
                  pageId: 'page-1',
                  title: 'Order-to-Cash Diagnostic - Warsaw Plant',
                  contentJson: {},
                  contentText: 'Invoices are issued via Peppol; dunning starts on day 14.',
                  createdAt: '2026-09-13T14:20:00.000Z',
                  createdBy: 'Piotr Wiśniewski',
                },
                {
                  id: 'v-1',
                  pageId: 'page-1',
                  title: 'Order-to-Cash Diagnostic',
                  contentJson: {},
                  contentText: 'Invoices are issued via Peppol.',
                  createdAt: '2026-09-13T13:05:00.000Z',
                  createdBy: 'Piotr Wiśniewski',
                },
              ],
              meta: { count: 2 },
            }
          : undefined,
      []
    )
  );
  return (
    <Ramka
      tytul="B6 · Historia wersji notatki — wersje naprawdę powstają"
      opis={'Przed naprawą lista była zawsze pusta („No saved versions yet”), bo nic w aplikacji nie wołało POST …/versions, więc „Restore” był nieosiągalny. Zapis notatki tworzy teraz wersję (dławik: pierwszy zapis, potem ≥10 min i ≥200 znaków zmiany).'}
    >
      <div style={{ maxWidth: 720 }}>
        <NotebookVersionHistory
          pageId="page-1"
          currentText="Invoices are issued via Peppol; dunning starts on day 14. Escalation on day 30."
        />
      </div>
    </Ramka>
  );
}

function CzescW11() {
  const outcome = describeIdeaConversion('team_chat', { created: { conversationId: 'conv-42' } });
  React.useEffect(() => {
    const timer = window.setTimeout(() => toast.success(outcome.toastDefault), 200);
    return () => window.clearTimeout(timer);
  }, [outcome.toastDefault]);
  return (
    <Ramka
      tytul={'W11 · Kebab „Team Chat” — akcja mówi, co zrobiła'}
      opis={`Przed naprawą kliknięcie przestawiało etap pomysłu seed → promoted i pokazywało tylko „Done", bez czatu. Teraz komunikat nazywa zmianę, a akcja otwiera utworzony wątek (${outcome.href}).`}
    >
      <div
        style={{
          border: '1px solid var(--c-border)',
          borderRadius: 12,
          padding: 16,
          maxWidth: 560,
          fontSize: 13,
          color: 'var(--c-text-secondary)',
        }}
      >
        Docelowy adres po akcji: <code>{outcome.href}</code>
      </div>
    </Ramka>
  );
}

export default function S114bNarzedziaScreen(): React.ReactElement {
  const part = new URLSearchParams(window.location.search).get('part') || 'b1';
  if (part === 'b2')
    return (
      <CzescDostep
        code="TRIAL_PROFILE_INCOMPLETE"
        message="Please complete organization setup to start your trial AI experience."
      />
    );
  if (part === 'w3')
    return (
      <CzescDostep
        code="TRIAL_EXPORT_DISABLED"
        message="Ta funkcja jest czasowo wyłączona dla triala."
      />
    );
  if (part === 'b3') return <CzescB3 />;
  if (part === 'b6') return <CzescB6 />;
  if (part === 'w11') return <CzescW11 />;
  return <CzescB1 />;
}
