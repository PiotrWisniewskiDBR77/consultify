/**
 * Dev-render: KATALOG-AKCEPT #10-AB — galeria startowych szablonów konsultingowych.
 *
 * ★ NAPRAWA PARYTETU 2026-09-01 (AUDYT_PRZYRZADU_20260901.md, Kategoria 4).
 * Poprzednia wersja tego pliku budowała WŁASNĄ siatkę kart z surowych danych
 * `CONSULTING_TEMPLATES` — czyli własny ekran katalogowy, którego w aplikacji
 * nie ma. Produkcja montuje modal `IdeaTemplateGallery`
 * (`src/components/MyWork/IdeaMapWorkspace.tsx:5230`, otwierany przyciskiem
 * „Szablony" na pasku narzędzi pomysłu). Właściciel oceniał więc kompozycję
 * przyrządu, a nie galerię, którą realnie zobaczy użytkownik.
 *
 * Teraz montujemy REALNY `<IdeaTemplateGallery open>` z propsami 1:1 jak u
 * wołacza produkcyjnego. Komponent nie robi ŻADNEGO wołania sieciowego przy
 * montażu (sprawdzone w kodzie: `applyIdeaTemplate` / `generateAIProposal`
 * odpalają się dopiero po kliknięciu), więc harness nie potrzebuje backendu
 * ani logowania — zrzut robi nadzorca przed odbiorem (CLAUDE.md #7).
 *
 * `existingNodeCount={0}` = pusta kanwa, czyli stan, w którym użytkownik
 * najczęściej otwiera galerię (zastosowanie szablonu nie żąda wtedy
 * potwierdzenia L-06 i nie zasłania listy dialogiem).
 *
 * URL: ?screen=idea-templates-catalog[&lang=pl|en][&theme=light|dark]
 *      [&tool=mindmap|whiteboard|process_flow|table]
 */
import React from 'react';

import { IdeaTemplateGallery } from '../../src/components/MyWork/IdeaTemplateGallery';
import type { CanvasToolType } from '../../src/components/MyWork/ideaSelectionTypes';

const TOOLS: CanvasToolType[] = ['mindmap', 'whiteboard', 'process_flow', 'table'];

export default function IdeaTemplatesCatalogScreen(): React.ReactElement {
  const requested = new URLSearchParams(window.location.search).get('tool') as CanvasToolType | null;
  const activeTool: CanvasToolType =
    requested && TOOLS.includes(requested) ? requested : 'mindmap';

  return (
    <div className="h-screen w-screen bg-c-bg">
      <IdeaTemplateGallery
        open
        onClose={() => undefined}
        ideaId="idea-atelier-toys-0001"
        activeTool={activeTool}
        onApplied={() => undefined}
        baseVersion={1}
        existingNodeCount={0}
      />
    </div>
  );
}
