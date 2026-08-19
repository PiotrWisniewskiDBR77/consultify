import { ArrowRight } from 'lucide-react';
import React from 'react';

const FLOWS = {
  'dynamic-swot': {
    en: ['Frame the decision', 'Capture S/W/O/T evidence', 'Test tensions', 'Choose a move'],
    pl: ['Zdefiniuj decyzję', 'Zbierz dowody S/W/O/T', 'Sprawdź napięcia', 'Wybierz ruch'],
  },
  'market-forces': {
    en: ['Define the market', 'Score five forces', 'Explain profit pressure', 'Choose a response'],
    pl: ['Zdefiniuj rynek', 'Oceń pięć sił', 'Wyjaśnij presję na marżę', 'Wybierz odpowiedź'],
  },
} as const;

export function ToolProcessDiagram({
  toolType,
  isPolish,
}: {
  toolType: keyof typeof FLOWS;
  isPolish: boolean;
}) {
  const steps = FLOWS[toolType][isPolish ? 'pl' : 'en'];
  return (
    <ol
      aria-label={isPolish ? 'Proces narzędzia' : 'Tool process'}
      className="grid gap-2 md:grid-cols-4"
    >
      {steps.map((step, index) => (
        <li
          key={step}
          className="relative flex min-h-24 items-center rounded-2xl border border-c-border bg-c-surface-raised p-4 text-sm font-semibold text-c-text"
        >
          <span className="mr-3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-c-focus/10 text-xs text-c-focus">
            {index + 1}
          </span>
          {step}
          {index < steps.length - 1 && (
            <ArrowRight
              aria-hidden
              className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 text-c-text-muted md:block"
              size={16}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
