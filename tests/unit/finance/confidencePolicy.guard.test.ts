import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');

describe('Finance confidence and tenant policy guard', () => {
  // Usuwa komentarze i literaly tekstowe, zeby slowo "confidence" wystepujace
  // w opisie albo w seedowanej tresci nie udawalo przypisania do kolumny.
  const stripSqlNoise = (sql: string) =>
    sql
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/--[^\n]*/g, ' ')
      .replace(/\$\$[\s\S]*?\$\$/g, "''")
      .replace(/'(?:[^']|'')*'/g, "''");

  // UPDATE na tabeli FINANSOWEJ, ktory przypisuje cokolwiek do kolumny
  // *confidence*. Dodanie kolumny (ALTER TABLE) i wartosc domyslna sa
  // dozwolone — chodzi o nadpisywanie juz zapisanej historii.
  const REWRITES_FINANCE_CONFIDENCE =
    /\bupdate\s+(?:only\s+)?(?:public\.)?"?\w*(?:financial|finance)\w*"?[^;]*?\bset\b[^;]*?\b\w*confidence\w*\s*=/is;

  it('detects a migration that rewrites finance confidence (kontrola narzedzia)', () => {
    // Straznik, ktory nigdy nie zapalil sie na niczym, nie jest dowodem.
    // Te cztery przypadki pokazuja, ze regula rozroznia nadpisanie historii
    // finansowej od rzeczy podobnie wygladajacych.
    const detects = (sql: string) => REWRITES_FINANCE_CONFIDENCE.test(stripSqlNoise(sql));
    expect(detects('UPDATE financial_statement_values SET mapping_confidence = 0.5;')).toBe(true);
    expect(
      detects('UPDATE public.financial_statements SET overall_confidence = 1 WHERE id > 0;')
    ).toBe(true);
    // Inna dziedzina — nie finanse.
    expect(detects('UPDATE interview_insights SET confidence = 0.9;')).toBe(false);
    // Rozszerzenie schematu, nie przepisanie wartosci.
    expect(detects('ALTER TABLE financial_statements ADD COLUMN confidence REAL DEFAULT 0;')).toBe(
      false
    );
  });

  it('adds no migration that could rewrite historical confidence', () => {
    // PRZEPISANE 2026-09-01. Wczesniej ten test robil:
    //
    //   git diff --name-only codex/m03-admin-20260824...HEAD -- server/migrations
    //   expect(changed).toBe('')
    //
    // czyli nie ogladal TRESCI migracji w ogole — sprawdzal tylko, czy plik
    // migracji rozni sie od ZASZYTEJ NA SZTYWNO galezi roboczej. Skutki:
    //
    //   1. alarmowal na KAZDEJ nowej migracji, niezaleznie od tego, czego
    //      dotyka. Scalenie linii integracyjnej wnioslo szesc migracji
    //      (knowledge chunks, legacy task cutover x2, adopcja szkicu Teresy,
    //      knowledge docs x2) — ZADNA nie tyka finansow, a test byl czerwony;
    //   2. byl zielony tylko dopoki HEAD nie odjechal od tamtej galezi — czyli
    //      z czasem musial padac na wszystkim, a straznik padajacy zawsze
    //      przestaje chronic, bo ludzie ucza sie go omijac;
    //   3. NIE bronil tego, co ma w nazwie: migracja faktycznie przepisujaca
    //      pewnosc przeszlaby bez slowa, gdyby istniala juz na tamtej galezi.
    //
    // Teraz sprawdzamy deklarowana wlasnosc, na calym katalogu migracji i bez
    // zadnego punktu odniesienia w historii gita.
    const migrationsDir = path.join(repoRoot, 'server/migrations');
    const offenders = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .filter((file) =>
        REWRITES_FINANCE_CONFIDENCE.test(
          stripSqlNoise(readFileSync(path.join(migrationsDir, file), 'utf8'))
        )
      );
    expect(offenders).toEqual([]);
  });

  it('preserves the historical confidence fallback order', () => {
    expect(read('server/src/services/financeStatementAnalyticsService.ts')).toContain(
      'directHead?.mapping_confidence ?? directHead?.confidence ?? (isDerived ? 1 : 0)'
    );
  });

  it('preserves the mapping confidence threshold at 0.85', () => {
    const source = read('src/components/Finance/FinancialStatementMappingEditor.tsx');
    expect(source.match(/0\.85/g)).toHaveLength(2);
  });

  it('keeps both canonical Finance router guards ahead of every subrouter', () => {
    const source = read('server/src/routes/v8/finance-v2/index.ts');
    const membership = source.indexOf('financeV2Router.use(requireActiveMembership)');
    const mutation = source.indexOf('financeV2Router.use(requireCanonicalFinanceMutation)');
    const firstSubrouter = source.indexOf('financeV2Router.use(modelsRoutes)');
    expect(membership).toBeGreaterThan(-1);
    expect(mutation).toBeGreaterThan(membership);
    expect(firstSubrouter).toBeGreaterThan(mutation);
  });
});
