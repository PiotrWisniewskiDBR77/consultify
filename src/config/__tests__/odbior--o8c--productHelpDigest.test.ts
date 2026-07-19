/**
 * ODBIÓR O8.2 — Help content aktualny do nowych przepływów (productHelpDigest)
 *
 * REJESTR/_PROJEKT_C_OXFORD.md status: 🟡 "JA weryf.". This test proves the REAL
 * runtime state: buildProductHelpDigest() (consumed by Teresa's voice system
 * prompt and by Anna's landing-page assistant, per grep of
 * src/utils/teresaVoiceInstruction.ts and src/components/Landing/AnnaAssistantWidget.tsx)
 * actually resolves every listed module id against HELP_DOCUMENTS and produces
 * non-empty, bilingual, per-module content — not a stub/placeholder digest.
 */
import { describe, expect, it } from 'vitest';

import { getLocalizedText, HELP_DOCUMENTS } from '../helpExperience';
import { buildProductHelpDigest } from '../productHelpDigest';

// Mirrors DIGEST_DOCUMENT_IDS in productHelpDigest.ts — kept here explicitly so a
// silent drift (someone renames/removes a HELP_DOCUMENTS entry without updating
// the digest) fails this test rather than silently shrinking Teresa's context.
const EXPECTED_MODULE_IDS = [
  'chat',
  'interview',
  'tools_assessments',
  'audits',
  'initiatives',
  'execution',
  'results',
  'finance',
  'my_work',
  'ideas',
  'presentations',
  'document_studio',
  'presentation_studio',
  'table_studio',
  'meeting',
  'settings',
];

describe('O8.2 — productHelpDigest: real coverage of live HELP_DOCUMENTS', () => {
  it('every digest module id resolves to a real HELP_DOCUMENTS entry', () => {
    for (const id of EXPECTED_MODULE_IDS) {
      expect(HELP_DOCUMENTS[id], `HELP_DOCUMENTS missing entry for "${id}"`).toBeDefined();
    }
  });

  it('EN digest includes every module title and is a substantial, non-stub document', () => {
    const digest = buildProductHelpDigest('en');
    expect(digest.length).toBeGreaterThan(500);
    for (const id of EXPECTED_MODULE_IDS) {
      const doc = HELP_DOCUMENTS[id];
      const title = getLocalizedText(doc.title, 'en');
      expect(digest).toContain(title);
    }
    expect(digest).toContain('HOW WE DOCUMENT INSIGHTS & INITIATIVES');
  });

  it('PL digest is a genuine translation, not a copy of the EN digest', () => {
    const en = buildProductHelpDigest('en');
    const pl = buildProductHelpDigest('pl');
    expect(pl).not.toBe(en);
    expect(pl).toContain('JAK DOKUMENTUJEMY WNIOSKI I INICJATYWY');
    expect(pl.length).toBeGreaterThan(500);
  });

  it('falls back to English digest for a non-PL supported language rather than throwing', () => {
    const de = buildProductHelpDigest('de');
    expect(de).toBe(buildProductHelpDigest('en'));
  });
});
