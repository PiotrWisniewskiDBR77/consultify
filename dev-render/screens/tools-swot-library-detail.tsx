/**
 * Harness: Dynamic SWOT — Library detail (KnownToolDetailView).
 *
 * Mounts the REAL component (`KnownToolDetailView`) that renders when a
 * client opens a tool from the Library before starting a session. No login,
 * no backend — `Api.getKnownTool` / `Api.listToolSessions` /
 * `Api.createToolSession` are patched directly on the singleton with
 * realistic fixture data (same pattern as `tool-outputs-panel.tsx`'s
 * stateful fetch stub, applied at the method level since the exact call
 * signatures are known from `src/services/api.ts`).
 *
 * Renders the REAL component, not a mockup — CLAUDE.md #7 / stream G5 brief.
 *
 * URL: ?screen=tools-swot-library-detail&theme=light|dark&state=ready|loading|error
 */
import React from 'react';

import { KnownToolDetailView } from '@/components/DiscoveryTools/KnownToolDetailView';
import { HelpProvider } from '@/contexts/HelpContext';
import { Api } from '@/services/api';

const TOOL_TYPE = 'dynamic-swot';

const KNOWN_TOOL = {
  id: 'kt-dynamic-swot',
  toolType: TOOL_TYPE,
  name: 'Dynamic SWOT',
  libraryCategory: 'strategy',
  description:
    'Żywa macierz SWOT, w której AI proponuje pozycje i napięcia między nimi, a konsultant zatwierdza każdą przed przejściem dalej. Zamiast statycznej listy plusów i minusów dostajesz decyzje strategiczne wynikające z zderzenia mocnych stron z okazjami i zagrożeniami.',
  whatYouGet: [
    'Zatwierdzona macierz SWOT z dowodami przy każdej pozycji',
    'Zidentyfikowane napięcia strategiczne (attack/protect) między ćwiartkami',
    'Rekomendowane ruchy z uzasadnieniem, trade-offem i odrzuconą alternatywą',
    'Dokument klienta (Report) i talia (Presentation) generowane z tego samego zatwierdzonego Outputu',
  ],
  tags: ['strategia', 'diagnoza', 'workshop'],
  icon: null,
  isLicensed: true,
  isActive: true,
  isComingSoon: false,
  sortOrder: 1,
  createdAt: '2026-01-10T09:00:00Z',
  whenToUse:
    'Na starcie projektu doradczego, gdy trzeba wspólnie z klientem ustalić punkt wyjścia i uzgodnić, które ruchy mają pierwszeństwo — a very long English variant follows to stress-test wrapping across both locales in the library detail argument-evidence-implication layout without truncation or overflow.',
  inputs: [
    'Wywiady z zarządem i kluczowymi menedżerami',
    'Dane finansowe i operacyjne za ostatnie 3 lata',
    'Analiza konkurencji, jeśli dostępna',
  ],
  steps: [
    'Zbierz pozycje SWOT (AI proponuje, konsultant akceptuje/odrzuca/prosi o przemyślenie)',
    'System wykrywa napięcia między zaakceptowanymi pozycjami',
    'Zaproponuj i zatwierdź ruchy strategiczne wynikające z napięć',
    'Zatwierdź Output — od tego momentu Report i Presentation są generowane automatycznie',
  ],
  outputs: ['Zatwierdzony Output SWOT', 'Report', 'Presentation', 'Propozycje inicjatyw'],
  commonMistakes: [
    'Akceptowanie pozycji bez dowodu (evidence) — obniża wiarygodność w oczach klienta',
    'Pomijanie napięć o niskim komforcie — to tam często jest najciekawsza rekomendacja',
  ],
  example:
    'Firma X: siła — 40 zamkniętych wdrożeń; okazja — rosnący popyt w DACH; napięcie „attack" łączy obie pozycje i prowadzi do ruchu „uruchomić pilota referencyjnego".',
  nextSteps: ['Przekształć zatwierdzone ruchy w inicjatywy', 'Udostępnij Report klientowi'],
  kbArticleSlug: 'dynamic-swot',
};

const SESSIONS = [
  {
    id: 'sess-demo-1',
    name: 'Wejście na rynek DACH',
    toolType: TOOL_TYPE,
    status: 'approved',
    progress: 100,
    confidenceAvg: 0.82,
    createdAt: '2026-08-10T09:00:00Z',
    updatedAt: '2026-08-13T12:00:00Z',
  },
  {
    id: 'sess-demo-2',
    name: 'Repozycjonowanie oferty premium',
    toolType: TOOL_TYPE,
    status: 'in_progress',
    progress: 45,
    confidenceAvg: 0.61,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-13T08:00:00Z',
  },
];

const params = new URLSearchParams(window.location.search);
const fixtureState = params.get('state') === 'error' ? 'error' : params.get('state') === 'loading' ? 'loading' : 'ready';

// Patch the Api singleton directly — same fixture-per-call philosophy as the
// stateful fetch stub in tool-outputs-panel.tsx, but at method level because
// the exact signatures are already known from src/services/api.ts.
(Api as any).getKnownTool = async () => {
  if (fixtureState === 'error') throw new Error('Failed to fetch known tool');
  if (fixtureState === 'loading') return new Promise(() => {}); // never resolves
  return { tool: KNOWN_TOOL };
};
(Api as any).listToolSessions = async () => {
  if (fixtureState === 'error') return { items: [], total: 0, limit: 100, offset: 0 };
  return { items: SESSIONS, total: SESSIONS.length, limit: 100, offset: 0 };
};
(Api as any).createToolSession = async () => ({ id: 'sess-demo-new', toolType: TOOL_TYPE, name: 'Nowa sesja' });

export default function ToolsSwotLibraryDetailScreen() {
  return (
    <HelpProvider>
      <div className="min-h-screen bg-c-bg">
        <KnownToolDetailView
          toolType={TOOL_TYPE}
          onClose={() => {}}
          onSessionCreated={() => {}}
        />
      </div>
    </HelpProvider>
  );
}
