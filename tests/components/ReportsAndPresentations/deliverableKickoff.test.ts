/**
 * FT-2 (integracja seed↔detektor) dla E3 — gwarancja, że openery launchera
 * trafiają w produkcyjne detektory intencji Tryb B (deck/doc/sheet) i NIE w złą
 * precedencję. Bez uruchamiania appki. Tracker: DELIVERABLES-STAN-PRACY-ODBIORY.md (E3).
 */
import { describe, expect, it } from 'vitest';

import {
  detectDocumentIntent,
  detectPresentationIntent,
  hasStrongDocumentNoun,
} from '@/components/AIChat/documentIntentDetector';
import { detectTableIntent } from '@/components/AIChat/tableIntentDetector';
import { deliverableKickoffSeed } from '@/components/ReportsAndPresentations/deliverableKickoff';

// Pełna wiadomość = opener (seed) + temat dopisany przez użytkownika.
const TOPIC = { pl: 'transformacja AI w VTS', en: 'AI transformation at VTS' } as const;
const msg = (type: 'report' | 'presentation' | 'table', lang: 'pl' | 'en') =>
  deliverableKickoffSeed(type, lang) + TOPIC[lang];

describe('deliverableKickoffSeed → detektory intencji (E3 · FT-2)', () => {
  it('PREZENTACJA: seed+temat trafia w detectPresentationIntent (PL i EN)', () => {
    expect(detectPresentationIntent(msg('presentation', 'pl'))).toBe(true);
    expect(detectPresentationIntent(msg('presentation', 'en'))).toBe(true);
  });

  it('RAPORT: seed+temat trafia w detectDocumentIntent (PL i EN)', () => {
    expect(detectDocumentIntent(msg('report', 'pl'))).toBe(true);
    expect(detectDocumentIntent(msg('report', 'en'))).toBe(true);
  });

  it('TABELA: seed+temat trafia w detectTableIntent (PL i EN)', () => {
    expect(detectTableIntent(msg('table', 'pl'))).toBe(true);
    expect(detectTableIntent(msg('table', 'en'))).toBe(true);
  });

  it('TABELA nie wpada w precedencję doc (hasStrongDocumentNoun = false)', () => {
    // Document-with-table ma precedencję; seed tabeli NIE może nieść „document noun".
    expect(hasStrongDocumentNoun(msg('table', 'pl'))).toBe(false);
    expect(hasStrongDocumentNoun(msg('table', 'en'))).toBe(false);
  });

  it('PREZENTACJA nie jest mylona z dokumentem ani tabelą', () => {
    expect(detectDocumentIntent(msg('presentation', 'pl'))).toBe(false);
    expect(detectTableIntent(msg('presentation', 'pl'))).toBe(false);
  });

  it('RAPORT ma silny document-noun (poprawna precedencja przy „raport z tabelą")', () => {
    expect(hasStrongDocumentNoun(msg('report', 'pl'))).toBe(true);
    expect(hasStrongDocumentNoun(msg('report', 'en'))).toBe(true);
  });
});
