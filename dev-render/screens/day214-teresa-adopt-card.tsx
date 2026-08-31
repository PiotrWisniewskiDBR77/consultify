/**
 * FIX-214 pkt 4 (ODBIOR_214.md, CLAUDE.md #7) — zrzut karty adopcji szkicu z
 * czatu Teresy, ZANIM Piotr zobaczy cokolwiek.
 *
 * Montuje WYŁĄCZNIE realny, produkcyjny komponent
 * `GovernedInitiativeHandoffCard` (src/components/AIChat/GovernedInitiativeHandoffCard.tsx)
 * — zero mocka jego wnętrza, zero atrapy wizualnej. Karta nie ma propsów
 * sterujących stanem (`idle|checking|blocked|ready|adopting|adopted|failed`
 * to stan WEWNĘTRZNY, sterowany przez jej własne wywołania `fetch`), więc
 * jedynym sposobem pokazania czterech stanów bez klikania przez Piotra jest
 * przechwycenie `window.fetch` realistycznymi fixture'ami (w KSZTAŁCIE
 * realnej odpowiedzi `GET /api/initiatives/:id` i `POST
 * /api/initiatives/runtime-v1/adoptions/chat-draft` — pola i nazwy skopiowane
 * z `adoptChatDraftInitiative.gateway.realdb.test.ts`) i zasymulowanie tych
 * samych kliknięć, które zrobiłby użytkownik.
 *
 * ★★ UCZCIWOŚĆ WPROST (CLAUDE.md #7, „Piotr nigdy pierwszym testerem"):
 * DANE NA TYM ZRZUCIE POCHODZĄ Z PROPSÓW/FIXTURE'ÓW W HARNESSIE, NIE Z
 * REALNEGO PRZEBIEGU. Nie ma tu prawdziwego Postgresa, prawdziwego JWT ani
 * prawdziwej trasy — `window.fetch` jest przechwycony i zwraca stałe dane
 * napisane w tym pliku. Dowód, że przebieg backendowy jest REALNY, żyje
 * osobno w `tests/integration/initiatives-execution/adoptChatDraftInitiative.gateway.realdb.test.ts`
 * (realny ApiGateway + realny Postgres). Ten ekran dowodzi WYŁĄCZNIE, że
 * `GovernedInitiativeHandoffCard` renderuje się poprawnie (tokeny c-*,
 * jasny/ciemny, brak ozdobników) i przechodzi przez swoje cztery stany po
 * kliknięciu — nie dowodzi integracji z żywym backendem.
 *
 * Flaga `ENABLE_TERESA_ADOPT_CHAT_DRAFT` pozostaje domyślnie OFF w kodzie
 * produktowym — ten ekran nie zmienia tej wartości, jest tylko harnessem
 * do zrzutu.
 *
 * &theme=light|dark sterowane globalnie przez dev-render/main.tsx.
 */
import React, { useEffect, useRef } from 'react';

import { GovernedInitiativeHandoffCard } from '../../src/components/AIChat/GovernedInitiativeHandoffCard';

type DraftFixture = {
  projectId: string | null;
  ownerExecutionId: string | null;
  problemStatement: string | null;
};

const DRAFTS: Record<string, DraftFixture> = {
  'day214-demo-blocked': {
    projectId: null,
    ownerExecutionId: null,
    problemStatement: 'Klienci porzucają koszyk na etapie płatności.',
  },
  'day214-demo-ready': {
    projectId: 'proj-teresa-demo',
    ownerExecutionId: 'user-teresa-demo-owner',
    problemStatement: 'Klienci porzucają koszyk na etapie płatności.',
  },
  'day214-demo-adopted': {
    projectId: 'proj-teresa-demo',
    ownerExecutionId: 'user-teresa-demo-owner',
    problemStatement: 'Klienci porzucają koszyk na etapie płatności.',
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, window.location.origin).pathname;

  const readMatch = path.match(/^\/api\/initiatives\/([^/]+)$/);
  if (readMatch) {
    const id = decodeURIComponent(readMatch[1]);
    const draft = DRAFTS[id];
    if (draft) {
      return json({
        id,
        projectId: draft.projectId,
        ownerExecutionId: draft.ownerExecutionId,
        problemStatement: draft.problemStatement,
      });
    }
  }

  if (path === '/api/initiatives/runtime-v1/adoptions/chat-draft' && init?.method === 'POST') {
    const body = JSON.parse(String(init.body || '{}'));
    // Shape copied from the real 201 envelope proven in
    // adoptChatDraftInitiative.gateway.realdb.test.ts (`created.body`).
    return json(
      {
        status: 'APPLIED',
        aggregateVersion: 1,
        response: {
          initiativeId: body.chatInitiativeId,
          lifecycleState: 'REGISTERED_DRAFT',
        },
      },
      201
    );
  }

  return originalFetch(input, init);
};

/** Drives the real card through its real click handlers — no shortcuts into
 * its internal state. `steps` names the visible button text to click, in
 * order, waiting a tick between each so React commits before the next click. */
function AutoDrive({
  initiativeId,
  title,
  steps,
}: {
  initiativeId: string;
  title: string;
  steps: string[];
}): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // NOTE: dev-render mounts under React.StrictMode, which double-invokes
    // effects (mount → cleanup → mount again) in dev. A `done`-ref guard
    // that survives across that double-invoke would let the FIRST run's
    // cleanup cancel its own clicks while the SECOND run finds the guard
    // already tripped and never starts — net result: no clicks at all.
    // Scoping `cancelled` to this effect instance (no persistent guard)
    // means the harmless first invocation's clicks simply get cancelled by
    // its own cleanup, and the second (real, StrictMode-kept) invocation
    // runs the full sequence normally.
    let cancelled = false;
    (async () => {
      for (const label of steps) {
        await new Promise((resolve) => setTimeout(resolve, 80));
        if (cancelled) return;
        const button = Array.from(containerRef.current?.querySelectorAll('button') ?? []).find(
          (candidate) => candidate.textContent?.trim() === label
        );
        button?.click();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [steps]);

  return (
    <div ref={containerRef} className="w-full max-w-[520px]">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
        {title}
      </p>
      <GovernedInitiativeHandoffCard
        initiativeId={initiativeId}
        title="Redukcja porzuceń koszyka na płatności"
        onOpenInitiative={() => {}}
        onAdopted={() => {}}
      />
    </div>
  );
}

export default function Day214TeresaAdoptCardScreen(): React.ReactElement {
  return (
    <div className="flex min-h-screen w-full flex-col items-center gap-8 bg-c-bg p-10">
      <h1 className="text-sm font-semibold text-c-text">
        FIX-214 pkt 4 — karta adopcji szkicu z czatu Teresy (GovernedInitiativeHandoffCard,
        realny komponent, dane z fixture&#39;ów harnessu — patrz komentarz na górze pliku)
      </h1>
      <div className="flex w-full max-w-[560px] flex-col gap-6">
        <AutoDrive initiativeId="day214-demo-idle" title="idle (bez kliknięcia)" steps={[]} />
        <AutoDrive
          initiativeId="day214-demo-blocked"
          title="blocked (po sprawdzeniu — brakuje projektu i właściciela)"
          steps={['Check before handoff']}
        />
        <AutoDrive
          initiativeId="day214-demo-ready"
          title="ready (po sprawdzeniu — kompletny draft)"
          steps={['Check before handoff']}
        />
        <AutoDrive
          initiativeId="day214-demo-adopted"
          title="adopted (po sprawdzeniu + zgodzie)"
          steps={['Check before handoff', 'Pass to execution']}
        />
      </div>
    </div>
  );
}
