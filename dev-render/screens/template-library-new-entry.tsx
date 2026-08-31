/**
 * Dev-render: wpięcie „Nowy szablon" (Materials▸Biblioteka wzorców) — proof
 * że przycisk realnie otwiera TemplateBuilderFlow (wizard→builder) tym samym
 * importem/wiringiem co ReportsAndPresentationsHub.tsx (state → overlay
 * fixed inset-0 z-modal → TemplateBuilderFlow). Nie mockuje całego Huba
 * (routing/store/API) — tylko sam punkt wejścia + flaga.
 *
 * ★ GRAFIKA 2026-08-31 (naprawa oceny C — „ekran nie pokazuje obiecanego
 * kreatora"): pierwotna wersja renderowała TYLKO instrukcję dla testera
 * ("Kliknij „Nowy szablon"…") i czekała na RĘCZNY klik — narzędzie zrzutowe
 * nie klika, więc zrzut zawsze łapał stan sprzed otwarcia. Kreator NIE jest
 * martwy (flaga `ff_templateBuilder`/`ff.template_builder` domyślnie ON poza
 * publiczną produkcją — patrz `templateBuilderFlags.ts` — i jest realnie
 * wpięty w `ReportsAndPresentationsHub.tsx`), więc naprawa to symulacja kliku
 * po montażu, wzorem `excele-jeden-widok-recent.tsx` (tab „Recent").
 */
import { BookTemplate, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { isTemplateBuilderEnabled, TemplateBuilderFlow } from '@/components/TemplateBuilder';

export default function TemplateLibraryNewEntryScreen(): React.ReactElement {
  const [templateBuilderOpen, setTemplateBuilderOpen] = useState(false);
  const enabled = isTemplateBuilderEnabled();

  // Symulacja realnego kliku „Nowy szablon" po montażu — bez tego harness
  // zrzuca tylko stan sprzed otwarcia (instrukcję dla testera), a nie
  // rzeczywisty kreator, który ma pokazać ten ekran.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setTemplateBuilderOpen(true);
    }, 300);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="h-screen w-screen bg-c-bg">
      {/* Pasek jak StandardModuleBar — tylko przycisk „Nowy szablon" do dowodu wpięcia. */}
      <div className="flex items-center justify-between border-b border-c-border px-6 py-4">
        <div className="flex items-center gap-2 text-c-text">
          <BookTemplate size={18} />
          <span className="text-sm font-semibold">Materiały ▸ Biblioteka wzorców</span>
          <span className="ml-2 rounded bg-c-surface-raised px-2 py-0.5 text-[11px] text-c-text-muted">
            flaga templateBuilder: {enabled ? 'ON' : 'OFF'}
          </span>
        </div>
        <button
          type="button"
          data-testid="outputs-new-btn"
          onClick={() => setTemplateBuilderOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-c-text px-3 py-1.5 text-sm font-medium text-c-bg hover:opacity-90"
        >
          <Plus size={14} />
          Nowy szablon
        </button>
      </div>

      <div className="flex items-center justify-center h-[calc(100%-57px)] text-c-text-muted text-sm">
        Kliknij „Nowy szablon" — powinien otworzyć się wizard→builder (overlay).
      </div>

      {templateBuilderOpen && (
        <div className="fixed inset-0 z-modal" data-testid="template-builder-overlay">
          <TemplateBuilderFlow
            onClose={() => setTemplateBuilderOpen(false)}
            onSaved={(id) => {
              setTemplateBuilderOpen(false);
              // eslint-disable-next-line no-console
              console.log('[dev-render] template saved', id);
            }}
            // dev-render: saveFn zamockowany, bez uderzania w /api/deliverables/templates
            saveFn={async (draft) => {
              // eslint-disable-next-line no-console
              console.log('[dev-render] saveFn draft', draft);
              return { id: 'dev-render-mock-id' };
            }}
          />
        </div>
      )}
    </div>
  );
}
