/**
 * Dowód na defekt #3 audytu FIN 2026-09-06: klucz techniczny NIGDY nie trafia
 * na ekran jako tytuł — nawet gdy jest jedyną wartością, jaką niesie artefakt.
 */
import { describe, expect, it } from 'vitest';

import { financeArtifactDisplayTitle, isRawTechnicalValue } from '../financeArtifactTitle';

/** Wartości skopiowane z ŻYWEJ bazy i ze zrzutów audytu. */
const SEED_KEY =
  'seed:finance-cdprojekt-2025:cc9db573-260f-4a19-927f-f3cc1fbaea38:GRUPA_KAPITALOWA_CD_PROJEKT';
const ANALYSIS_KEY = 'derived-analysis:script:4db71c39-eb9a-4379-bb35-d6b4c939e8fd';
const LEGACY_KEY = 'financial_statement_packs:cdp2025-pack-33d3c3b64a';
const BARE_TOKEN = 'cdp2025-pack-33d3c3b64a';

describe('isRawTechnicalValue', () => {
  it('rozpoznaje klucze z zrzutów audytu', () => {
    for (const value of [SEED_KEY, ANALYSIS_KEY, LEGACY_KEY, BARE_TOKEN]) {
      expect(isRawTechnicalValue(value), value).toBe(true);
    }
  });

  it('nie myli nazwy człowieka z kluczem', () => {
    for (const value of [
      'Grupa Kapitałowa CD PROJEKT — skonsolidowane sprawozdanie 2025 (z 2024)',
      'Analiza wskaźnikowa 2024–2025 — CD PROJEKT',
      'Analiza 2025: wnioski',
      'Model bazowy FY2026',
    ]) {
      expect(isRawTechnicalValue(value), value).toBe(false);
    }
  });
});

describe('financeArtifactDisplayTitle', () => {
  it('nazwa własna wygrywa', () => {
    expect(
      financeArtifactDisplayTitle({
        displayName: 'Grupa Kapitałowa CD PROJEKT — skonsolidowane sprawozdanie 2025 (z 2024)',
        naturalKey: SEED_KEY,
        artifactType: 'STATEMENT_PACK',
      })
    ).toBe('Grupa Kapitałowa CD PROJEKT — skonsolidowane sprawozdanie 2025 (z 2024)');
  });

  it('bez nazwy własnej NIE pokazuje klucza technicznego, tylko uczciwą nazwę rodzajową', () => {
    expect(
      financeArtifactDisplayTitle({ displayName: null, naturalKey: SEED_KEY, artifactType: 'STATEMENT_PACK' })
    ).toBe('Sprawozdanie bez nazwy');
    expect(
      financeArtifactDisplayTitle({
        displayName: null,
        naturalKey: ANALYSIS_KEY,
        artifactType: 'HISTORICAL_ANALYSIS',
      })
    ).toBe('Analiza bez nazwy');
  });

  it('naturalKey nadany przez człowieka (stare artefakty) dalej działa jako tytuł', () => {
    expect(
      financeArtifactDisplayTitle({
        displayName: null,
        naturalKey: 'Grupa Kapitałowa CD PROJEKT FY2024',
        artifactType: 'STATEMENT_PACK',
      })
    ).toBe('Grupa Kapitałowa CD PROJEKT FY2024');
  });

  it('żadne wyjście funkcji nie jest wartością techniczną', () => {
    for (const key of [SEED_KEY, ANALYSIS_KEY, LEGACY_KEY, BARE_TOKEN, null]) {
      const title = financeArtifactDisplayTitle({ naturalKey: key, artifactType: 'VALUATION_CASE' });
      expect(isRawTechnicalValue(title), String(key)).toBe(false);
    }
  });
});
