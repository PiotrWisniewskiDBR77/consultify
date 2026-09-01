/**
 * Dev-render host — odbiór Word #8 (audyt 2026-07-22): DocumentStudioIntakeForm
 * z domyślnie WŁĄCZONYM „Wygeneruj treść sekcji z AI (zalecane)" (dawniej OFF,
 * myląca etykieta „Refine outline"). Pokazuje realny checkbox + etykietę.
 *
 * URL: ?screen=word-intake-uselm-default&theme=light|dark&lang=pl|en
 */
import React from 'react';

import { DocumentStudioIntakeForm } from '@/components/DocumentStudio/DocumentStudioIntakeForm';

export default function WordIntakeUseLlmDefaultScreen(): React.ReactElement {
  return (
    // Produkcja: DocumentStudioView.tsx:910 — <main> bez max-w, formularz
    // zajmuje pełną szerokość dostępnego obszaru studia (nie kartka max-w-2xl).
    <div className="h-screen w-full bg-c-bg">
      <main className="flex h-full min-h-0 flex-col">
        <DocumentStudioIntakeForm onSubmit={() => {}} />
      </main>
    </div>
  );
}
