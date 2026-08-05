/**
 * M12 Meeting — harness odbioru MVP (CLAUDE.md #7: nadzorca robi zrzut PRZED
 * Piotrem). Montuje REALNY `MeetingHub` — bez logowania, bez backendu.
 *
 * MeetingHub woła `Api.*` (nie surowy fetch), więc stubujemy METODY obiektu
 * `Api`, zgodnie z lekcją z [[gendeck-genexcel-nadganianie]]. Mock jest
 * STANOWY: create/update/delete/decision/follow-up naprawdę zmieniają dane,
 * żeby dało się przejść golden flow wzrokiem, a nie tylko zobaczyć listę.
 *
 * URL:
 *   ?screen=m12-mvp-meeting&stan=dane|demo|pusto|blad
 *      dane  — bogata scena (agenda, uczestnicy, decyzje, follow-upy)
 *      demo  — DOKŁADNY kształt danych z bazy demo 2026-08-05:
 *              0 follow-upów, 0 pre-read, część spotkań bez agendy/lokalizacji
 *      pusto — pusta organizacja
 *      blad  — błąd ładowania listy
 *   &brief=ok|404|blad   stan Operator Brief (404 = odpowiedź strażnika
 *                        internal-tools, którą UI czyta jako „brak briefu")
 *   &widok=lista|preview|detal|kalendarz|modal-nowe|modal-notatki|modal-usun
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { MeetingHub } from '@/components/Meeting/MeetingHub';
import { Api } from '@/services/api';

type FollowUp = { id: string; title: string; owner: string; status: 'open' | 'done' };
type Meeting = {
  id: string;
  projectId?: string | null;
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  attendees: string[];
  preRead: string[];
  agenda: string[];
  decisions: string[];
  followUps: FollowUp[];
  status: 'scheduled' | 'completed';
};

const params = new URLSearchParams(window.location.search);
const stan = params.get('stan') || 'dane';
const briefTryb = params.get('brief') || 'ok';
const widok = params.get('widok') || 'lista';

const iso = (d: string) => new Date(d).toISOString();

const SCENA_BOGATA: Meeting[] = [
  {
    id: 'm-1',
    projectId: 'proj-atelier-1',
    title: 'Line 3 Digital Twin — Steering Committee',
    startAt: iso('2026-08-06T09:00:00Z'),
    endAt: iso('2026-08-06T10:30:00Z'),
    location: 'Sala Warszawa / Teams',
    attendees: ['Anna Kowalska', 'Piotr Wiśniewski', 'Marek Nowak'],
    preRead: ['Raport z audytu linii 3', 'Model kosztowy v4'],
    agenda: ['Status wdrożenia', 'Ryzyka dostaw', 'Decyzja o budżecie Q4'],
    decisions: ['Budżet Q4 zatwierdzony w wariancie B'],
    followUps: [
      { id: 'fu-1', title: 'Wysłać protokół do zarządu', owner: 'Anna Kowalska', status: 'open' },
      { id: 'fu-2', title: 'Zaktualizować model kosztowy', owner: 'Marek Nowak', status: 'done' },
    ],
    status: 'scheduled',
  },
  {
    id: 'm-2',
    projectId: null,
    title: 'Supplier Risk Control Tower — przegląd miesięczny',
    startAt: iso('2026-08-10T13:00:00Z'),
    endAt: iso('2026-08-10T14:00:00Z'),
    location: 'Teams',
    attendees: ['Katarzyna Zielińska', 'Tomasz Lis'],
    preRead: [],
    agenda: ['Top 5 ryzyk', 'Plan mitygacji'],
    decisions: [],
    followUps: [{ id: 'fu-3', title: 'Domknąć plan mitygacji', owner: 'Tomasz Lis', status: 'open' }],
    status: 'scheduled',
  },
  {
    id: 'm-3',
    projectId: null,
    title: 'Discovery Wrap-up — Cross-functional Readout',
    startAt: iso('2026-07-28T15:00:00Z'),
    endAt: iso('2026-07-28T16:00:00Z'),
    location: '',
    attendees: ['Anna Kowalska'],
    preRead: [],
    agenda: [],
    decisions: ['Przechodzimy do fazy wdrożenia'],
    followUps: [],
    status: 'completed',
  },
  {
    id: 'm-4',
    projectId: 'proj-atelier-1',
    title: 'Board Readout Prep — Atelier Forward',
    startAt: iso('2026-08-21T08:30:00Z'),
    endAt: iso('2026-08-21T09:30:00Z'),
    location: 'Sala Kraków',
    attendees: ['Piotr Wiśniewski', 'Anna Kowalska', 'Marek Nowak', 'Tomasz Lis'],
    preRead: ['Draft prezentacji zarządczej'],
    agenda: ['Narracja', 'Liczby', 'Q&A'],
    decisions: [],
    followUps: [],
    status: 'scheduled',
  },
  {
    id: 'm-5',
    projectId: null,
    title: 'Digital Growth & Attach Rate Sync',
    startAt: iso('2026-08-13T11:00:00Z'),
    endAt: iso('2026-08-13T11:45:00Z'),
    location: 'Teams',
    attendees: ['Katarzyna Zielińska'],
    preRead: [],
    agenda: ['Attach rate', 'Kampanie'],
    decisions: [],
    followUps: [],
    status: 'completed',
  },
];

/** Kształt 1:1 z bazą demo (2026-08-05): 0 follow-upów, 0 pre-read w CAŁEJ bazie. */
const SCENA_DEMO: Meeting[] = SCENA_BOGATA.map((m, i) => ({
  ...m,
  preRead: [],
  followUps: [],
  decisions: i === 2 ? m.decisions : [],
  location: i >= 2 ? '' : m.location,
  agenda: i >= 3 ? [] : m.agenda,
  attendees: i >= 3 ? [] : m.attendees,
}));

let stanowe: Meeting[] =
  stan === 'pusto' ? [] : stan === 'demo' ? [...SCENA_DEMO] : [...SCENA_BOGATA];

const kopia = () => JSON.parse(JSON.stringify(stanowe)) as Meeting[];
const znajdz = (id: string) => stanowe.find((m) => m.id === id) || null;
const opoznij = <T,>(v: T, ms = 120): Promise<T> =>
  new Promise((res) => setTimeout(() => res(v), ms));

const A = Api as unknown as Record<string, unknown>;

A.getMeetings = async () => {
  if (stan === 'blad') {
    await opoznij(null, 150);
    throw Object.assign(new Error('Failed to load meetings'), { status: 500 });
  }
  return opoznij({ meetings: kopia() });
};

A.createMeeting = async (data: Record<string, any>) => {
  const nowe: Meeting = {
    id: `m-${Date.now()}`,
    projectId: null,
    title: String(data.title || ''),
    startAt: data.startAt,
    endAt: data.endAt || data.startAt,
    location: String(data.location || ''),
    attendees: data.attendees || [],
    preRead: data.preRead || [],
    agenda: data.agenda || [],
    decisions: [],
    followUps: [],
    status: 'scheduled',
  };
  stanowe = [nowe, ...stanowe];
  return opoznij({ meeting: JSON.parse(JSON.stringify(nowe)) });
};

A.updateMeeting = async (id: string, data: Record<string, any>) => {
  const m = znajdz(id);
  if (!m) throw Object.assign(new Error('Meeting not found'), { status: 404 });
  Object.assign(m, {
    title: data.title ?? m.title,
    startAt: data.startAt ?? m.startAt,
    endAt: data.endAt ?? m.endAt,
    location: data.location ?? m.location,
    attendees: data.attendees ?? m.attendees,
    preRead: data.preRead ?? m.preRead,
    agenda: data.agenda ?? m.agenda,
  });
  return opoznij({ meeting: JSON.parse(JSON.stringify(m)) });
};

A.deleteMeeting = async (id: string) => {
  stanowe = stanowe.filter((m) => m.id !== id);
  return opoznij({ success: true });
};

A.updateMeetingStatus = async (id: string, status: 'scheduled' | 'completed') => {
  const m = znajdz(id);
  if (!m) throw Object.assign(new Error('Meeting not found'), { status: 404 });
  m.status = status;
  return opoznij({ meeting: JSON.parse(JSON.stringify(m)) });
};

A.addMeetingDecision = async (id: string, decision: string) => {
  const m = znajdz(id);
  if (!m) throw Object.assign(new Error('Meeting not found'), { status: 404 });
  m.decisions = [...m.decisions, decision];
  return opoznij({ meeting: JSON.parse(JSON.stringify(m)) });
};

A.addMeetingFollowUp = async (id: string, data: { title: string; owner?: string }) => {
  const m = znajdz(id);
  if (!m) throw Object.assign(new Error('Meeting not found'), { status: 404 });
  m.followUps = [
    ...m.followUps,
    { id: `fu-${Date.now()}`, title: data.title, owner: data.owner || '', status: 'open' },
  ];
  return opoznij({ meeting: JSON.parse(JSON.stringify(m)) });
};

A.updateMeetingFollowUpStatus = async (
  id: string,
  followUpId: string,
  status: 'open' | 'done'
) => {
  const m = znajdz(id);
  if (!m) throw Object.assign(new Error('Meeting not found'), { status: 404 });
  m.followUps = m.followUps.map((f) => (f.id === followUpId ? { ...f, status } : f));
  return opoznij({ meeting: JSON.parse(JSON.stringify(m)) });
};

A.generateMeetingNotes = async (id: string) => {
  const m = znajdz(id);
  if (!m) throw Object.assign(new Error('Meeting not found'), { status: 404 });
  m.decisions = [...m.decisions, 'Wdrożenie startuje 1 września'];
  m.followUps = [
    ...m.followUps,
    { id: `fu-ai-${Date.now()}`, title: 'Przygotować plan wdrożenia', owner: 'Marek Nowak', status: 'open' },
  ];
  return opoznij(
    {
      note: {
        source: 'heuristic',
        summary:
          'Spotkanie potwierdziło gotowość linii 3 i domknęło budżet Q4. Otwarte pozostaje ryzyko dostaw.',
        keyPoints: ['Linia 3 gotowa w 85%', 'Ryzyko dostaw komponentu X', 'Budżet Q4 w wariancie B'],
        decisions: [{ decision: 'Wdrożenie startuje 1 września' }],
        actionItems: [{ task: 'Przygotować plan wdrożenia', owner: 'Marek Nowak' }],
      },
      meeting: JSON.parse(JSON.stringify(m)),
    },
    400
  );
};

A.getAIOperatorMeetingBrief = async (meetingId: string) => {
  if (briefTryb === '404') {
    // To jest DOKŁADNIE odpowiedź strażnika internal-tools na produkcji
    // (`requireInternalToolsAccess` → 404 „Not found"). MeetingHub czyta 404
    // jako „brak briefu", więc pod spodem widać cichą pustkę, nie błąd.
    throw Object.assign(new Error('Not found'), { status: 404 });
  }
  if (briefTryb === 'blad') {
    throw Object.assign(new Error('Server error'), { status: 500 });
  }
  const m = znajdz(meetingId);
  return opoznij({
    meetingId,
    title: m?.title || '',
    prepSummary:
      'Skup spotkanie na statusie wdrożenia, domknij otwarte follow-upy i zamień dyskusję na właścicieli kolejnych kroków.',
    agendaGaps: ['Dodaj materiały pre-read przed spotkaniem.', 'Potwierdź obecność decydentów.'],
    followUpSuggestions: [
      'Przejrzyj zadanie: Aktualizacja modelu kosztowego',
      'Wymuś domknięcie decyzji: Wariant budżetu Q4',
    ],
    executiveBrief: { headline: '', bullets: [] },
  });
};

/** Klika w harnessie to, czego nie da się ustawić propsem (modale, preview). */
function useAutoWidok(): void {
  React.useEffect(() => {
    const t = window.setTimeout(() => {
      const klik = (sel: string) => {
        const el = document.querySelector<HTMLElement>(sel);
        el?.click();
        return Boolean(el);
      };
      const wiersz = () =>
        document.querySelectorAll<HTMLElement>('tbody tr')[0] ||
        document.querySelectorAll<HTMLElement>('[role="row"]')[1];

      if (widok === 'preview') wiersz()?.click();
      if (widok === 'detal' || widok === 'modal-notatki' || widok === 'modal-usun') {
        const r = wiersz();
        if (r) {
          r.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        }
      }
      if (widok === 'modal-nowe') {
        const btn = Array.from(document.querySelectorAll('button')).find((b) =>
          /nowe spotkanie|new meeting/i.test(b.textContent || '')
        );
        btn?.click();
      }
      if (widok === 'kalendarz') {
        const btn = document.querySelector<HTMLElement>('[title*="alendar"], [aria-label*="alendar"]');
        if (!btn) klik('[data-view-mode="calendar"]');
        else btn.click();
      }
    }, 900);
    return () => window.clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (widok !== 'modal-notatki' && widok !== 'modal-usun') return;
    const t = window.setTimeout(() => {
      const wzor = widok === 'modal-notatki' ? /ai notes|notatki ai/i : /usuń|delete/i;
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        wzor.test(b.textContent || '')
      );
      btn?.click();
    }, 1900);
    return () => window.clearTimeout(t);
  }, []);
}

export default function M12MvpMeetingScreen(): React.ReactElement {
  useAutoWidok();
  return (
    <MemoryRouter initialEntries={['/meeting']}>
      <div className="h-screen w-full bg-c-bg text-c-text">
        <MeetingHub />
      </div>
    </MemoryRouter>
  );
}
