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
    <div className="min-h-screen w-full overflow-y-auto bg-c-bg p-8">
      <div className="mx-auto max-w-2xl">
        <DocumentStudioIntakeForm onSubmit={() => {}} />
      </div>
    </div>
  );
}
