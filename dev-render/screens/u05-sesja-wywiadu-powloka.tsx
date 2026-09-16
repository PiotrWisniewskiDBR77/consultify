/**
 * dev-render host — U-05 · Interview → Sessions · powłoka sesji wywiadu.
 *
 * Montuje REALNY <InterviewWorkspace /> na REALNYCH danych ze stagingu
 * (`dev-render/mocks/u05-wywiad.json` — zaciągnięte sondą API z org Northwind,
 * sesje 87d0f2ba… „Interview 9/15/2026" [submitted, 6 pytań, 6 zatwierdzeń
 * pending] oraz 6174a0c0… „Operational Excellence Discovery" [approved,
 * 7 pytań, 7 zatwierdzeń stages_complete]).
 *
 * Warianty (?wariant=):
 *   zywy-submitted      — stan ZASTANY, zrzut nr 2 właściciela
 *   zywy-approved       — stan ZASTANY, zrzut nr 3 właściciela
 *   propozycja-submitted — JEDNA POWŁOKA: zatwierdzanie jako STAN pytania
 *   propozycja-approved  — jw., sesja zatwierdzona
 *
 * Propozycja NIE zmienia kodu produktu: realny `InterviewWorkspace` dostaje
 * PUSTĄ projekcję zatwierdzeń (więc doklejona lista znika i zostaje kanoniczna
 * powłoka: Menu 1 + question workspace), a makieta stanu pytania jest wstrzykiwana
 * przez portal harnessu do karty pytania. To rysunek do Tak/Nie właściciela.
 *
 * URL: ?screen=u05-sesja-wywiadu-powloka&wariant=...&lang=en&theme=light
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MemoryRouter } from 'react-router-dom';

import { InterviewWorkspace } from '../../src/components/Interview/InterviewWorkspace';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { Api } from '../../src/services/api';
import { V8InterviewApi } from '../../src/services/api/v8/interview';
import { useAppStore } from '../../src/store/useAppStore';
import dane from '../mocks/u05-wywiad.json';

const wariant = new URLSearchParams(location.search).get('wariant') || 'zywy-submitted';
const czyZatwierdzona = wariant.endsWith('approved');
const czyPropozycja = wariant.startsWith('propozycja');

/** U-06: pigułka przypisania w nagłówku — zastępuje usunięty przycisk „List"
 * (druga powierzchnia N-karty). Dane 1:1 z mocka. */
const przypisanie = czyZatwierdzona
  ? 'Operational Excellence Discovery · Irina Lebedjuk · 2 Oct 2026'
  : 'Automation Readiness · Irina Lebedjuk · 13 Oct 2026';

const sesja: any = czyZatwierdzona ? (dane as any).sessionApproved : (dane as any).sessionSubmitted;
const pytania: any[] = czyZatwierdzona
  ? (dane as any).questionsApproved
  : (dane as any).questionsSubmitted;
const zatwierdzenia: any = czyZatwierdzona
  ? (dane as any).approvalsApproved
  : (dane as any).approvalsSubmitted;

useAppStore.setState({
  currentUser: {
    id: '08c54d75-5260-57b1-9db6-a30aed89a587',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr.wisniewski@dbr77.com',
    role: 'OWNER',
    status: 'active',
    isAuthenticated: true,
    accessLevel: 'full',
    organizationId: sesja.organizationId,
  } as any,
  currentOrganization: { id: sesja.organizationId, name: 'Northwind Manufacturing Ltd.' } as any,
});

const przydzial = {
  id: sesja.assignmentId,
  sessionId: sesja.id,
  status: czyZatwierdzona ? 'approved' : 'submitted',
  templateId: sesja.templateId,
  dueAt: czyZatwierdzona ? '2026-10-02T16:00:00.000Z' : '2026-10-13T16:00:00.000Z',
  assigneeUserId: '75f25357-2f33-48b8-9638-ad67ff65bcef',
  template: {
    id: sesja.templateId,
    name: czyZatwierdzona ? 'Operational Excellence Discovery' : 'Automation Readiness',
  },
  assignee: {
    id: '75f25357-2f33-48b8-9638-ad67ff65bcef',
    name: 'Irina Lebedjuk',
    email: 'irina.lebedjuk@northwind.example',
  },
  sentBackReason: null,
};

Object.assign(Api, {
  get: async (path: string) => {
    if (path.endsWith('/questions')) return pytania;
    if (path.endsWith('/notes')) return [];
    if (path.endsWith('/evidence')) return [];
    if (path.endsWith('/linked-items')) return [];
    if (path.endsWith('/summary')) return null;
    if (path.endsWith('/answer-history')) return { history: {} };
    if (path === '/interview/context') return null;
    if (path.startsWith(`/interview/assignments/${sesja.assignmentId}`)) return przydzial;
    if (path.startsWith(`/interview/sessions/${sesja.id}`)) return sesja;
    if (path === '/access/effective') return { effectiveAccess: { capabilities: ['*'] } };
    return {};
  },
  post: async () => ({}),
  put: async () => ({}),
  patch: async () => ({}),
  delete: async () => ({}),
});

Object.assign(V8InterviewApi, {
  getSession: async () => ({ session: sesja }),
  getSessions: async () => ({ sessions: [sesja] }),
  getMyAssignments: async () => ({ assignments: [przydzial] }),
  getAssignmentReviewAccess: async () => ({ canReview: true }),
  // ★ To jest cała różnica między wariantami: propozycja dostaje PUSTĄ
  //   projekcję (kontrakt „legacy"), więc doklejana lista „Answer approval"
  //   nie renderuje się wcale — zostaje kanoniczna powłoka.
  getAnswerApprovals: async () => ({
    assignmentId: sesja.assignmentId,
    approvals: czyPropozycja ? [] : zatwierdzenia.approvals,
  }),
  getSessionEvaluation: async () => {
    throw new Error('brak oceny');
  },
  retryAiAnswerApprovals: async () => ({ approvals: [] }),
  decideAnswerApprovals: async () => ({ approvals: [] }),
});

/* ──────────────────────────────────────────────────────────────────────────
 * MAKIETA PROPOZYCJI — zatwierdzanie jako STAN PYTANIA (nie osobna lista).
 * Rysowana tokenami c-*, CTA neutralne (zielony „Approve answer" wypada).
 * ────────────────────────────────────────────────────────────────────────── */
function PigulkaStanu({ stan }: { stan: 'pending' | 'approved' | 'sent_back' }) {
  const mapa = {
    pending: { txt: 'Pending approval', cls: 'bg-c-info/15 text-c-info' },
    approved: { txt: 'Approved', cls: 'bg-c-success/15 text-c-success' },
    sent_back: { txt: 'Sent back', cls: 'bg-c-danger/15 text-c-danger' },
  }[stan];
  return (
    <span
      className={`inline-flex h-5 items-center gap-1 rounded-md px-2 text-[10px] font-semibold whitespace-nowrap ${mapa.cls}`}
    >
      {mapa.txt}
    </span>
  );
}

function PasekDecyzjiPytania() {
  if (czyZatwierdzona) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-c-border/60 bg-c-surface/60 px-3 py-2">
        <PigulkaStanu stan="approved" />
        <span className="text-xs text-c-text-muted">
          Approved by Piotr Wiśniewski · 9/15/2026, 2:16 AM
        </span>
        {/* U-05(4): uzasadnienie w kolorze tekstu WTÓRNEGO (nie pomarańcz — było text-c-warning w realnym bloku doklejonym). */}
        <span className="text-xs text-c-text-secondary">
          — Specific, evidenced and consistent with the Line 3 audit findings.
        </span>
        <button
          type="button"
          className="ml-auto inline-flex h-8 items-center rounded-lg border border-c-border px-3 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised"
        >
          Reopen
        </button>
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-c-border/60 bg-c-surface/60 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <PigulkaStanu stan="pending" />
        <span className="text-xs text-c-text-muted">manager stage 1 of 6</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-lg border border-c-border bg-c-surface-raised px-3 text-xs font-medium text-c-text"
          >
            Approve answer
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-lg border border-c-border px-3 text-xs font-medium text-c-text-secondary"
          >
            Send back…
          </button>
        </div>
      </div>
    </div>
  );
}

/** Wstrzykuje makietę do REALNEJ karty pytania (bez dotykania kodu produktu). */
function PortalDoKartyPytania() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!czyPropozycja) return;
    let zatrzymane = false;
    const probuj = () => {
      if (zatrzymane) return;
      const h2 = document.querySelector('main h2');
      const karta = h2?.closest('.flex.items-start') as HTMLElement | null;
      if (karta?.parentElement) {
        const el = document.createElement('div');
        karta.parentElement.insertBefore(el, karta.nextSibling);
        setHost(el);
        return;
      }
      requestAnimationFrame(probuj);
    };
    probuj();
    return () => {
      zatrzymane = true;
    };
  }, []);
  if (!host) return null;
  return createPortal(<PasekDecyzjiPytania />, host);
}

/* ──────────────────────────────────────────────────────────────────────────
 * DOPRACOWANIE NAGŁÓWKA — U-05/U-06, uwagi 15.09:
 *  - „Approve"(zielony)/„Send back"(pomarańcz) → JEDEN neutralny primary
 *    „Approve all pending" + kebab „Send back…"; „Review" = zwykła pigułka.
 *  - usuwa przycisk „List" (U-06: nie ma tu drugiej powierzchni N-karty) —
 *    w jego miejsce pigułka przypisania Template · Assignee · Due.
 * Manipulacja WYŁĄCZNIE w DOM harnessu (portal/postprocessing), zero zmian
 * w `src/`: realny komponent renderuje swoje oryginalne przyciski, tu są
 * tylko wizualnie podmieniane/ukrywane do celów makiety.
 * ────────────────────────────────────────────────────────────────────────── */
function PostprocesNaglowka() {
  const [otwartyKebab, setOtwartyKebab] = useState(false);

  useEffect(() => {
    if (!czyPropozycja) return;
    let zatrzymane = false;

    const probuj = () => {
      if (zatrzymane) return;
      const header = document.querySelector('header');
      if (!header) {
        requestAnimationFrame(probuj);
        return;
      }
      const przyciski = Array.from(header.querySelectorAll('button'));
      const btnApprove = przyciski.find((b) => b.textContent?.trim() === 'Approve');
      const btnSendBack = przyciski.find((b) => b.textContent?.trim() === 'Send back');
      const btnList = przyciski.find((b) => b.textContent?.trim() === 'List');
      const pillReview = Array.from(header.querySelectorAll('span')).find(
        (s) => s.textContent?.trim() === 'Review'
      );

      // Nagłówek InterviewWorkspace montuje się asynchronicznie (ładowanie
      // pytań) — czekaj aż realne przyciski faktycznie istnieją.
      if (!btnList && !btnApprove) {
        requestAnimationFrame(probuj);
        return;
      }

      if (btnApprove) btnApprove.style.display = 'none';
      if (btnSendBack) btnSendBack.style.display = 'none';
      if (btnList) btnList.style.display = 'none';
      if (pillReview) {
        pillReview.className =
          'hidden items-center gap-1 rounded-md bg-c-surface-raised px-2 py-1 text-xs font-medium text-c-text-secondary md:inline-flex';
      }

      // Pigułka przypisania Template · Assignee · Due — w miejscu „List".
      if (!header.querySelector('[data-makieta="przypisanie"]')) {
        const wiersz = header.querySelector(':scope > div');
        const blokPostepu = wiersz?.querySelector('.ml-auto');
        if (wiersz) {
          const pigulka = document.createElement('span');
          pigulka.setAttribute('data-makieta', 'przypisanie');
          pigulka.className =
            'hidden shrink-0 items-center gap-1 rounded-md bg-c-surface-raised px-2 py-1 text-[11px] font-medium text-c-text-secondary md:inline-flex';
          pigulka.textContent = przypisanie;
          if (blokPostepu) wiersz.insertBefore(pigulka, blokPostepu);
          else wiersz.appendChild(pigulka);
        }
      }

      // JEDEN primary + kebab (tylko gdy tryb recenzenta miał Approve/Send back).
      if (btnApprove && !header.querySelector('[data-makieta="primary"]')) {
        const kontener = btnApprove.parentElement;
        const primary = document.createElement('button');
        primary.type = 'button';
        primary.setAttribute('data-makieta', 'primary');
        primary.className =
          'inline-flex h-9 items-center gap-1.5 rounded-lg bg-c-text px-3 text-sm font-medium text-c-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]';
        primary.textContent = 'Approve all pending';
        const kebab = document.createElement('button');
        kebab.type = 'button';
        kebab.setAttribute('data-makieta', 'kebab');
        kebab.setAttribute('aria-label', 'More actions');
        kebab.className =
          'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-c-border text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]';
        kebab.textContent = '⋯';
        kontener?.insertBefore(primary, btnApprove);
        kontener?.insertBefore(kebab, btnApprove);
      }
    };
    probuj();
    return () => {
      zatrzymane = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Menu kebaba „Send back…" — wstrzykiwane portalem obok kebaba, sterowane
  // Reactem (żeby ładnie się otwierało/zamykało na zrzutach).
  useEffect(() => {
    if (!czyPropozycja) return;
    const kebab = document.querySelector('[data-makieta="kebab"]');
    if (!kebab) return;
    const onClick = () => setOtwartyKebab((v) => !v);
    kebab.addEventListener('click', onClick);
    return () => kebab.removeEventListener('click', onClick);
  }, [otwartyKebab]);

  return null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * AI QUALITY REVIEW — zwinięty do jednej linii, nie blokuje centrum.
 * Realny `aiReviewPanel` (Callout wielowierszowy) jest ukrywany, a w jego
 * miejscu wstawiany jest jednowierszowy pasek-etykieta.
 * ────────────────────────────────────────────────────────────────────────── */
function PostprocesAiReview() {
  useEffect(() => {
    if (!czyPropozycja) return;
    let zatrzymane = false;
    const probuj = () => {
      if (zatrzymane) return;
      const kandydaci = Array.from(
        document.querySelectorAll('[role="status"], [role="alert"]')
      ) as HTMLElement[];
      const panel = kandydaci.find((el) =>
        Array.from(el.querySelectorAll('p')).some(
          (p) => p.textContent?.trim() === 'AI quality review'
        )
      );
      if (!panel) {
        requestAnimationFrame(probuj);
        return;
      }
      if (panel.getAttribute('data-makieta-zwiniety') === '1') return;
      panel.setAttribute('data-makieta-zwiniety', '1');
      panel.className =
        'mx-4 mt-2 flex items-center gap-2 rounded-lg bg-c-surface-raised px-3 py-1.5';
      panel.innerHTML = `
        <span class="text-xs font-medium text-c-text-secondary">AI quality review</span>
        <span class="text-xs text-c-text-muted">— not run yet</span>
        <button type="button" class="ml-auto text-xs font-medium text-c-text-secondary underline underline-offset-2 hover:no-underline">Run</button>
      `;
    };
    probuj();
    return () => {
      zatrzymane = true;
    };
  }, []);
  return null;
}

export default function U05SesjaWywiaduPowlokaScreen() {
  return (
    <>
      {czyPropozycja ? (
        <style>{`section[aria-label="Answer approval"]{display:none !important}`}</style>
      ) : null}
      <FeatureFlagsProvider config={{ enableLocalOverrides: true }} showDevTools={false}>
        <MemoryRouter initialEntries={['/interview']}>
          <div className="h-screen w-screen overflow-hidden bg-c-background">
            <InterviewWorkspace sessionId={sesja.id} onClose={() => {}} />
            <PortalDoKartyPytania />
            {czyPropozycja ? <PostprocesNaglowka /> : null}
            {czyPropozycja ? <PostprocesAiReview /> : null}
          </div>
        </MemoryRouter>
      </FeatureFlagsProvider>
    </>
  );
}
