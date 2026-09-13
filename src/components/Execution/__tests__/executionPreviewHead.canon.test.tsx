/**
 * K5-5 — GÓRA PODGLĄDÓW REALIZACJI (bloki 1–2) NA POWŁOCE KANONU, test RENDERU.
 *
 * Warunek właściciela przy odbiorze (staging `cf3fded7e4`, Realizacja → Work,
 * podgląd zadania): „tutaj preview też na górze nie jest zgodne".
 *
 * Test montuje REALNY `<StandardPreview>` na REALNEJ deklaracji z
 * `buildExecutionPreviewHead` — tej samej funkcji, którą wołają zakładki Work,
 * Risk management i Reports, a nie na jej kopii. Asercje patrzą na DOM, nie na
 * źródło, więc nie przechodzą wtedy, gdy wyrenderowany blok 2 jest zły.
 *
 * Sprawdzane literalnie (TABLE_AND_PREVIEW_CANON §7.3 pkt 1–2):
 *   · blok 2 niesie STAN, nie prozę — zdanie wstawione do karty meta NIE
 *     renderuje się w niej (mutacja: wyłącz `czyProza` → test czerwony),
 *   · zdanie nie ginie: ląduje w dopisku bloku „Co dalej",
 *   · strefa terminu ma JEDNE klasy w całym module,
 *   · w całym podglądzie jest dokładnie jedno „Open" (nagłówek powłoki).
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { StandardPreview } from '../../standard/StandardPreview';
import {
  buildExecutionPreviewHead,
  czyProza,
  EXECUTION_PREVIEW_TRAILING_CLASS,
} from '../executionPreviewHead';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

/** Zdanie, które właściciel widział w karcie meta podglądu zadania. */
const ZDANIE_Z_ODBIORU = 'Check completeness and the next step.';

const podglad = (head: ReturnType<typeof buildExecutionPreviewHead>) =>
  render(
    <StandardPreview
      title="Close the security audit"
      onClose={() => undefined}
      onOpenFull={() => undefined}
      meta={head.meta}
      whatsNext={head.whatsNext}
      details={{ label: 'Work details', text: 'Archive the evidence pack.' }}
    />
  );

describe('K5-5 — góra podglądów Realizacji (bloki 1–2)', () => {
  it('blok 2 NIE renderuje zdania — proza wędruje do dopisku „Co dalej"', () => {
    const head = buildExecutionPreviewHead({
      pills: [{ label: 'Task', tone: 'neutral' }],
      term: { label: 'Due date', value: '26/08/2026' },
      stateLine: ZDANIE_Z_ODBIORU,
    });

    expect(head.meta.recommendation).toBeUndefined();
    expect(head.whatsNext?.note).toContain(ZDANIE_Z_ODBIORU);

    podglad(head);
    const meta = document.querySelector('[data-preview-block="meta"]');
    expect(meta).not.toBeNull();
    expect(meta?.textContent ?? '').not.toContain(ZDANIE_Z_ODBIORU);
    expect(document.querySelector('[data-preview-block="whatsnext"]')?.textContent ?? '').toContain(
      ZDANIE_Z_ODBIORU
    );
  });

  it('krótka etykieta stanu ZOSTAJE w bloku 2 (to stan, nie proza)', () => {
    const head = buildExecutionPreviewHead({
      pills: [{ label: 'Pending', tone: 'neutral' }],
      term: { label: 'Needed by', value: '24/08/2026' },
      stateLine: 'Days overdue 19',
    });

    expect(head.meta.recommendation).toBe('Days overdue 19');
    podglad(head);
    expect(document.querySelector('[data-preview-block="meta"]')?.textContent ?? '').toContain(
      'Days overdue 19'
    );
  });

  it('termin stoi w strefie terminu, z jednymi klasami dla całego modułu', () => {
    const head = buildExecutionPreviewHead({
      pills: [{ label: 'Task', tone: 'neutral' }],
      term: { label: 'Due date', value: '26/08/2026' },
    });

    podglad(head);
    const meta = document.querySelector('[data-preview-block="meta"]');
    // Strefa trailing to PRAWA kolumna karty meta (`PreviewMetaCard`), a nie
    // dowolny `span` — chipy stanu po lewej mają własną typografię.
    const trailing = meta?.querySelector(':scope > div > div.shrink-0 > span');
    expect(trailing).not.toBeNull();
    expect(trailing?.className).toBe(EXECUTION_PREVIEW_TRAILING_CLASS);
    expect(trailing?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Due date 26/08/2026');
  });

  it('brak terminu i brak stanu ⇒ blok 2 to same chipy, bez pustej strefy', () => {
    const head = buildExecutionPreviewHead({ pills: [{ label: 'Draft', tone: 'neutral' }] });

    expect(head.meta.trailing).toBeUndefined();
    expect(head.meta.recommendation).toBeUndefined();
    expect(head.whatsNext).toBeUndefined();
  });

  it('w całym podglądzie jest DOKŁADNIE JEDNO „Open" (kanon §7.3 pkt 1)', () => {
    podglad(
      buildExecutionPreviewHead({
        pills: [{ label: 'Task', tone: 'neutral' }],
        term: { label: 'Due date', value: '26/08/2026' },
        nextStep: 'The task is already closed.',
      })
    );

    expect(screen.getAllByRole('button', { name: /^Open$/ })).toHaveLength(1);
  });

  it('`czyProza` rozpoznaje wszystkie zdania, które stały w kartach meta Realizacji', () => {
    for (const zdanie of [
      ZDANIE_Z_ODBIORU,
      'Finish preparing the report',
      'Frozen snapshot — open the document, download DOCX or PDF.',
      'Overdue by 17 days — resolve or escalate.',
      'Item closed — stays in the register.',
      'Visible in the catalog, generation in Wave 2.',
    ]) {
      expect(czyProza(zdanie)).toBe(true);
    }
    for (const stan of ['Days overdue 19', 'Ready to use', 'Progress 45%', 'v3']) {
      expect(czyProza(stan)).toBe(false);
    }
  });
});
