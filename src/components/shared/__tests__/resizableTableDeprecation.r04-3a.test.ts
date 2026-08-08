/**
 * R04-3A — strażnik wygaszonego drugiego shella.
 *
 * `REPAIR_MASTER_PLAN.md` R04 wymaga JEDNEGO register shella. Kanonem jest
 * `FilterableTable` (fasada: `StandardTable`); `ResizableTable` został
 * oznaczony `@deprecated`, bo nie ma ani jednego konsumenta JSX i strukturalnie
 * nie jest rejestrem (renderuje `<thead>` + `<tbody>{children}</tbody>`, bez
 * danych, empty state, loadingu, kliknięcia wiersza i persystencji).
 *
 * Ten test pilnuje, żeby nie wrócił jako alternatywny shell. Skanuje `src/`
 * i przewraca się, gdy pojawi się użycie JSX albo import runtime spoza
 * jawnej listy dozwolonych plików.
 *
 * ── OGRANICZENIA HEURYSTYKI (świadome, nie przeoczone) ──────────────────────
 *
 * Skan jest TEKSTOWY, nie oparty na AST. Konkretnie:
 *
 *  · komentarze (blokowe i liniowe) oraz stringi są usuwane przed analizą,
 *    bo w repo istnieje dziś pięć NIEKODOWYCH wzmianek o `ResizableTable`
 *    (nagłówki plików, opisy testów) i bez tego kroku strażnik byłby czerwony
 *    od pierwszej sekundy;
 *  · wykrywamy: JSX `<ResizableTable`, import nazwany `{ … ResizableTable … }`
 *    oraz `import * as X` z barrela (namespace daje dostęp do wszystkiego);
 *  · NIE wykryjemy dostępu dynamicznego (`mod['Resizable' + 'Table']`),
 *    re-eksportu z aliasem w trzecim pliku ani `require()` liczonego runtime.
 *    To są ścieżki, których nikt tu nie używa, a ich pełne pokrycie wymaga
 *    analizy AST — jeśli kiedyś staną się realne, ten test trzeba wymienić
 *    na regułę ESLint (`no-restricted-imports`), a nie rozbudowywać regexy.
 *
 * Strażnik jest FAIL-CLOSED: nowy plik odwołujący się do komponentu wywala
 * test, dopóki ktoś świadomie nie dopisze go do `DOZWOLONE_REFERENCJE` poniżej.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');

/**
 * Jedyne pliki, które mogą odwoływać się do komponentu `ResizableTable`.
 * Lista jest zamknięta — dopisanie czegokolwiek jest decyzją, nie formalnością.
 */
const DOZWOLONE_REFERENCJE = new Set<string>([
  // Plik definiujący (i zarazem barrel).
  'components/ui/ResizableTable/index.tsx',
  // Ten strażnik.
  'components/shared/__tests__/resizableTableDeprecation.r04-3a.test.ts',
]);

/**
 * Import namespace z barrela — sprawdzany na SUROWYM źródle, bo ścieżka żyje
 * w literale stringowym, który `stripNonCode` celowo kasuje.
 */
const NAMESPACE_IMPORT = /import\s+\*\s+as\s+\w+\s+from\s+['"][^'"]*ui\/ResizableTable['"]/;

/** Usuwa komentarze i literały stringowe — zostaje sam kod. */
function stripNonCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // /* … */
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ') // // … (bez zjadania https://)
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      listSourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const files = listSourceFiles(SRC);

/** Odwołania do KOMPONENTU (nie do ścieżki barrela, nie do innych eksportów). */
function componentReferences(): Array<{ file: string; kind: string }> {
  const hits: Array<{ file: string; kind: string }> = [];

  for (const absolute of files) {
    const rel = path.relative(SRC, absolute).split(path.sep).join('/');
    if (DOZWOLONE_REFERENCJE.has(rel)) continue;

    const raw = fs.readFileSync(absolute, 'utf8');
    const code = stripNonCode(raw);

    if (/<ResizableTable[\s/>]/.test(code)) {
      hits.push({ file: rel, kind: 'JSX <ResizableTable>' });
    }
    // Import nazwany: `import { A, ResizableTable, B } from '…'`.
    if (/import\s*\{[^}]*\bResizableTable\b[^}]*\}/.test(code)) {
      hits.push({ file: rel, kind: 'named import' });
    }
    // Namespace daje dostęp do WSZYSTKICH eksportów barrela, w tym do shella.
    // Sprawdzany na SUROWYM źródle: `stripNonCode` zamienia literały na puste,
    // więc ścieżka importu znika i wzorzec nigdy by nie trafił. Złapał to
    // autotest niżej („wykrywa import namespace").
    if (NAMESPACE_IMPORT.test(raw)) {
      hits.push({ file: rel, kind: 'namespace import' });
    }
  }

  return hits;
}

describe('R04-3A · ResizableTable pozostaje wygaszony', () => {
  it('skan obejmuje realny zbiór plików źródłowych', () => {
    // Zabezpieczenie przed „zielono, bo nic nie przeskanowano".
    expect(files.length).toBeGreaterThan(500);
  });

  it('komponent NIE ma konsumenta JSX ani importu runtime', () => {
    const hits = componentReferences();
    expect(
      hits,
      hits.length
        ? `ResizableTable wrócił jako shell w: ${hits.map((h) => `${h.file} (${h.kind})`).join(', ')}. ` +
            'Kanonicznym register shellem jest FilterableTable / StandardTable. ' +
            'Jeśli to świadoma decyzja, dopisz plik do DOZWOLONE_REFERENCJE.'
        : undefined
    ).toEqual([]);
  });

  it('plik definiujący nosi znacznik @deprecated ze wskazaniem kanonu', () => {
    const source = fs.readFileSync(
      path.join(SRC, 'components/ui/ResizableTable/index.tsx'),
      'utf8'
    );
    expect(source).toContain('@deprecated');
    expect(source).toContain('FilterableTable');
    expect(source).toContain('StandardTable');
  });

  it('barrel nadal eksportuje to, z czego żyją konsumenci', () => {
    // R04-3A wygasza KOMPONENT, nie barrel. Usunięcie tych re-eksportów
    // zerwałoby 18 plików, w tym `PreviewPaneShell` używany 50 razy (R03).
    const source = fs.readFileSync(
      path.join(SRC, 'components/ui/ResizableTable/index.tsx'),
      'utf8'
    );
    for (const named of [
      'PreviewPaneShell',
      'ColumnResizer',
      'FilterDropdown',
      'BulkActionBar',
      'TableHeader',
    ]) {
      expect(source).toContain(named);
    }
  });

  it('lista dozwolonych referencji jest minimalna i zamknięta', () => {
    expect([...DOZWOLONE_REFERENCJE]).toEqual([
      'components/ui/ResizableTable/index.tsx',
      'components/shared/__tests__/resizableTableDeprecation.r04-3a.test.ts',
    ]);
  });
});

describe('R04-3A · strażnik faktycznie łapie regresję', () => {
  it('wykrywa użycie JSX w kodzie', () => {
    const code = stripNonCode('const x = <ResizableTable columns={[]} />;');
    expect(/<ResizableTable[\s/>]/.test(code)).toBe(true);
  });

  it('wykrywa import nazwany', () => {
    const code = stripNonCode("import { ResizableTable } from '@/components/ui/ResizableTable';");
    expect(/import\s*\{[^}]*\bResizableTable\b[^}]*\}/.test(code)).toBe(true);
  });

  it('wykrywa import namespace na surowym źródle', () => {
    // NIE na strippowanym: literał ze ścieżką jest kasowany, więc wzorzec
    // musiałby trafić w pustkę. To był realny błąd tego strażnika.
    const raw = "import * as RT from '@/components/ui/ResizableTable';";
    expect(NAMESPACE_IMPORT.test(raw)).toBe(true);
    expect(NAMESPACE_IMPORT.test(stripNonCode(raw))).toBe(false);
  });

  it('NIE liczy wzmianek w komentarzach ani stringach', () => {
    // To jest powód, dla którego strażnik strippuje kod — w repo żyje dziś
    // pięć niekodowych wzmianek i bez tego byłby czerwony od startu.
    const code = stripNonCode(
      `/* Uses PreviewPaneShell from ui/ResizableTable. */\n` +
        `// bespoke ResizableTable embedding, migrated\n` +
        `const label = 'pill z ResizableTable';`
    );
    expect(/<ResizableTable[\s/>]/.test(code)).toBe(false);
    expect(/import\s*\{[^}]*\bResizableTable\b[^}]*\}/.test(code)).toBe(false);
  });

  it('NIE liczy importu ścieżki po inne eksporty barrela', () => {
    const code = stripNonCode("import { PreviewPaneShell } from '@/components/ui/ResizableTable';");
    expect(/import\s*\{[^}]*\bResizableTable\b[^}]*\}/.test(code)).toBe(false);
  });
});
