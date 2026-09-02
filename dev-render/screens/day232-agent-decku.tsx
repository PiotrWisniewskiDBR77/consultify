import { Check, Clock3, FileSearch, GitBranch, Sparkles, X } from 'lucide-react';
import React from 'react';

import { AgentActivityPanel } from '../../src/components/Presentations/DeckBuilder/AgentActivityPanel';
import type { PresentationRuntimeEvent } from '../../src/services/presentationRuntimeEvents';

type State = 'pending' | 'applied' | 'rejected';

const state = (new URLSearchParams(window.location.search).get('state') || 'pending') as State;

const copy = {
  pending: { label: 'Oczekuje na zatwierdzenie', tone: 'text-amber-700 dark:text-amber-300', icon: Clock3 },
  applied: { label: 'Zastosowana · wersja 8', tone: 'text-emerald-700 dark:text-emerald-300', icon: Check },
  rejected: { label: 'Odrzucona', tone: 'text-danger-700 dark:text-danger-300', icon: X },
}[state];

const events: PresentationRuntimeEvent[] = [
  {
    id: 'evt-3', organizationId: 'org-fixture', deckId: 'deck-fixture', userId: 'user-fixture',
    eventType: state === 'pending' ? 'agent_edit_proposal_created' : state === 'applied' ? 'agent_edit_applied' : 'agent_edit_rejected',
    status: state === 'pending' ? 'proposal' : state, scope: 'slide', metadata: { operationId: 'op-fixture' }, createdAt: '2026-09-01T08:32:00.000Z',
  },
  {
    id: 'evt-2', organizationId: 'org-fixture', deckId: 'deck-fixture', userId: 'user-fixture',
    eventType: 'agent_edit_applied', status: 'applied', scope: 'slide', metadata: {}, createdAt: '2026-09-01T08:24:00.000Z',
  },
  {
    id: 'evt-1', organizationId: 'org-fixture', deckId: 'deck-fixture', userId: 'user-fixture',
    eventType: 'agent_edit_proposal_created', status: 'proposal', scope: 'global', metadata: {}, createdAt: '2026-09-01T08:20:00.000Z',
  },
];

// FIX-232 A3 (ODBIÓR 232, blokujący pokazanie właścicielowi): the "Po" cell
// used to show invented editorial output ("Retencja wzrosła o 12,2 p.p...")
// that `rewrite_slide` cannot produce — it only pastes back whatever the
// human wrote after the colon (presentationAgentEditService.ts:463:
// `String(prompt).split(':').slice(1).join(':').trim()`). Derive "Po" the
// same way from a literal prompt string so this screen cannot silently
// drift from what the operation actually does again.
const rewritePrompt = 'Przeredaguj slajd 3: Retencja wzrosła o 12,2 p.p.; rekomendujemy kontrolowane rozszerzenie w Q4.';
const rewriteBefore = 'Pilotaż dał lepsze wyniki i warto rozważyć dalsze działania.';
const rewriteAfter = rewritePrompt.split(':').slice(1).join(':').trim();

export default function Day232AgentDecku(): React.ReactElement {
  const StateIcon = copy.icon;
  return (
    <main className="min-h-screen bg-c-bg p-8 text-c-text">
      <div className="mx-auto flex max-w-6xl overflow-hidden rounded-2xl border border-c-border bg-c-surface shadow-xl">
        <section className="min-w-0 flex-1 p-7">
          <div className="border-b border-c-border-subtle pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-c-text-secondary">Deck · Agent redagujący</p>
            <h1 className="mt-2 text-2xl font-semibold">Wyniki pilotażu — decyzja na Q4</h1>
            {/* FIX-232 A3: "Model proponuje zmianę" claimed a model that does not
                exist — parsePresentationEditIntent is five regexes over
                prompt.toLowerCase(), zero model calls. */}
            <p className="mt-2 text-sm text-c-text-secondary">Polecenie proponuje zmianę. Deck zmienia się dopiero po zatwierdzeniu człowieka.</p>
          </div>

          {/* FIX-232 A3: this card has no counterpart in src/ — it is written
              directly in this harness file, not rendered from a real
              Presentation Studio component. Labelled as a target mockup, not
              evidence of a built screen, per the alternative FIX-232 offers. */}
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-dashed border-c-border bg-c-surface-raised px-3 py-2 text-xs font-semibold uppercase tracking-wide text-c-text-secondary">
            Makieta ekranu docelowego — nie dowód działającego komponentu
          </div>

          <article className="mt-3 rounded-xl border border-c-border bg-c-surface-raised p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className={`flex items-center gap-2 text-sm font-semibold ${copy.tone}`}><StateIcon size={16} />{copy.label}</div>
                <h2 className="mt-3 text-lg font-semibold">Przeredaguj slajd 3 na język zarządczy</h2>
              </div>
              <span className="rounded-md bg-c-surface px-2 py-1 font-mono text-[11px] text-c-text-secondary">op_232_7fa1</span>
            </div>
            <p className="mt-4 rounded-lg border border-c-border-subtle bg-c-surface p-3 font-mono text-xs text-c-text-secondary">Polecenie: „{rewritePrompt}”</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-c-border-subtle bg-c-surface p-3"><p className="text-xs font-medium text-c-text-secondary">Przed</p><p className="mt-1">{rewriteBefore}</p></div>
              <div className="rounded-lg border border-c-border-subtle bg-c-surface p-3">
                <p className="text-xs font-medium text-c-text-secondary">Po</p>
                <p className="mt-1">{rewriteAfter}</p>
                {/* Honest about what rewrite_slide is: a paste, not a redaction. */}
                <p className="mt-2 text-[11px] italic text-c-text-secondary">= tekst wklejony w poleceniu po dwukropku. rewrite_slide niczego nie redaguje.</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3 text-xs text-c-text-secondary"><GitBranch size={14} /> 1 slajd zmieniony · wersja 7 → 8 · wymagane presentation_approve</div>
            {state === 'pending' ? <div className="mt-5 flex justify-end gap-2"><button className="rounded-lg border border-c-border px-4 py-2 text-sm">Odrzuć</button><button className="rounded-lg bg-c-accent px-4 py-2 text-sm font-semibold text-white">Zatwierdź zmianę</button></div> : null}
          </article>

          <section className="mt-6">
            <div className="mb-3 flex items-center gap-2"><Sparkles size={16} className="text-c-accent" /><h2 className="text-sm font-semibold">Następne ruchy</h2></div>
            <div className="grid grid-cols-3 gap-3">
              {/* FIX-232 A3: "Dodaj 2 slajdy" and "Znajdź studia przypadku" name
                  operations that do not exist anywhere in the product — the
                  only five editorial operations are rewrite_slide,
                  shorten_slide, split_slide, change_archetype, add_source
                  (presentationAgentEditService.ts). Disabled like the third
                  button, not presented as available actions. */}
              <button disabled className="cursor-not-allowed rounded-lg border border-c-border bg-c-surface-raised p-3 text-left text-sm opacity-50">Dodaj 2 slajdy<span className="mt-1 block text-xs text-c-text-secondary">Operacja nie istnieje w produkcie</span></button>
              <button disabled className="cursor-not-allowed rounded-lg border border-c-border bg-c-surface-raised p-3 text-left text-sm opacity-50"><FileSearch size={14} className="mb-2" />Znajdź studia przypadku<span className="mt-1 block text-xs text-c-text-secondary">Operacja nie istnieje w produkcie</span></button>
              <button disabled className="cursor-not-allowed rounded-lg border border-c-border bg-c-surface-raised p-3 text-left text-sm opacity-50">Zwizualizuj przeładowane slajdy<span className="mt-1 block text-xs text-c-text-secondary">Czeka na detektor z dyżuru 230</span></button>
            </div>
          </section>
        </section>
        <AgentActivityPanel events={events} />
      </div>
    </main>
  );
}
