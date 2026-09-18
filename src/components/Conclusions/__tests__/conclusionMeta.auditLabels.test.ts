/**
 * U-29 resztki (Wpis 125, stanowisko B): etykiety źródła i typów dowodów
 * wniosku z audytu. Most serwerowy `auditReportConclusionBridge.ts` pisze
 * `sourceModule='audit'` (:50) oraz typy dowodów `audit_evidence` (:135) i
 * `audit_report` (:52); przed naprawą `sourceLabel` nie znał `'audit'`
 * (plakietka „Other" — dokładnie uwaga właściciela U-29), a readout
 * renderował surowy klucz typu dowodu (`ConclusionReadout.tsx:106`).
 *
 * MUTACJE (dowód): (M1) usunięcie `audit` z mapy `sourceLabel` → test
 * „audit → Audit" RED; (M2) `evidenceTypeLabel` zwracający surowy `raw`
 * → testy mapy RED; (M3) fallback zwracający klucz zamiast humanizacji
 * → test fallback RED.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { evidenceTypeLabel, sourceLabel } from '../conclusionMeta';

// t zwracające fallback (ten sam wzorzec co ConclusionsHub.filterChipCanon.test.tsx)
const t = ((key: string, fallback?: string) =>
  typeof fallback === 'string' ? fallback : key) as never;

describe('sourceLabel — źródło „audit" (U-29: brak plakietki „Other")', () => {
  it('sourceModule "audit" (AUDIT_CONCLUSION_SOURCE_MODULE) → „Audit", nie „Other"', () => {
    expect(sourceLabel(t, 'audit')).toBe('Audit');
  });

  it('wariant mnogi "audits" też mapuje na „Audit"', () => {
    expect(sourceLabel(t, 'audits')).toBe('Audit');
  });

  it('nieznane źródło idzie ścieżką fallbacku „other" (mapa nie trafiła)', () => {
    // t zwraca fallback = sourceModule → dowód, że mapa NIE zna klucza
    // (w realnym i18n klucz conclusions.source.other rozwiązuje się na „Other")
    expect(sourceLabel(t, 'cosmos')).toBe('cosmos');
  });
});

describe('evidenceTypeLabel — nazwy zamiast surowych kluczy (U-29)', () => {
  it.each([
    ['audit_evidence', 'Audit evidence'],
    ['audit_report', 'Audit report'],
    ['assessment_report', 'Assessment report'],
    ['tool_session', 'Tool session'],
    ['interview_finding', 'Interview finding'],
    ['interview_insight', 'Interview insight'],
    ['report', 'Report'],
    ['conclusion_readout', 'Conclusion readout'],
  ])('klucz serwerowy "%s" → „%s"', (raw, expected) => {
    expect(evidenceTypeLabel(t, raw)).toBe(expected);
  });

  it('nieznany klucz jest humanizowany, NIGDY nie wypływa surowy (M3)', () => {
    expect(evidenceTypeLabel(t, 'supplier_document_v2')).toBe('Supplier document v2');
  });

  it('pusty/null/undefined → „Evidence"', () => {
    expect(evidenceTypeLabel(t, '')).toBe('Evidence');
    expect(evidenceTypeLabel(t, null)).toBe('Evidence');
    expect(evidenceTypeLabel(t, undefined)).toBe('Evidence');
  });
});

describe('i18n EN/PL parami — klucze conclusions.source.audit i evidenceType.*', () => {
  const load = (lang: 'en' | 'pl') =>
    JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../../../../public/locales', lang, 'translation.json'),
        'utf8'
      )
    ) as Record<string, any>;

  it('oba locale mają source.audit i pełny blok evidenceType (9 kluczy)', () => {
    for (const lang of ['en', 'pl'] as const) {
      const c = load(lang).conclusions;
      expect(c.source.audit, `${lang}: source.audit`).toBeTruthy();
      for (const key of [
        'audit_evidence',
        'audit_report',
        'assessment_report',
        'tool_session',
        'interview_finding',
        'interview_insight',
        'report',
        'conclusion_readout',
        'unknown',
      ]) {
        expect(c.evidenceType?.[key], `${lang}: evidenceType.${key}`).toBeTruthy();
      }
    }
  });
});
