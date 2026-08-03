/**
 * @vitest-environment node
 *
 * DOKTRYNA TREŚCI EXCELA — testy bramek doktrynalnych i kontraktu promptu.
 * SSOT: `Harvard/wdrozenie-100/_DOKTRYNA_TRESCI_EXCEL_2026-07-27.md`
 *
 * Zamyka trzy potwierdzone dziury (§10 doktryny):
 *   L1 — prompt planowania kazał modelowi ZMYŚLAĆ liczby („use realistic numbers
 *        for the domain"). Test (a): prompty NIE zachęcają do fabrykacji i NIOSĄ
 *        sekwencję E1→E5 (§4.7 kontrakt prompt-ready).
 *   L4 — arkusz BEZ warstwy Założeń dostawał 100/100 (WQ-03 milczy, gdy arkusza
 *        nie ma). Test (b): DX-01 = CRITICAL, blocking, passed=false.
 *   L3 — klasa `formula_cycle_detected` istniała w taksonomii P23, ale żadna
 *        reguła jej nie emitowała. Test (c): cykl A→B→A = DX-02 CRITICAL.
 *
 * Test (d) — REGRESJA WARTOŚCI: wszystkie 7 zarejestrowanych szablonów przechodzi
 * bramkę bez CRITICAL (nowe reguły nie mogą zabić działającej biblioteki).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildFromTemplateFlat, listWorkbookTemplates } from '../templates/index.js';
import { critiqueWorkbook } from '../workbookQualityGate.js';
import type { WorkbookSchema } from '../WorkbookSchema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_SRC = readFileSync(resolve(__dirname, '../WorkbookGeneratorService.ts'), 'utf8');

/** Wytnij ciało danego prompt-literalu z pliku serwisu (prompty są module-private). */
function promptBody(constName: string): string {
  const start = SERVICE_SRC.indexOf(`const ${constName} = \``);
  expect(start).toBeGreaterThanOrEqual(0);
  const from = SERVICE_SRC.indexOf('`', start) + 1;
  const end = SERVICE_SRC.indexOf('`;', from);
  expect(end).toBeGreaterThan(from);
  return SERVICE_SRC.slice(from, end);
}

// ───────────────────────────────────────────────────────────────────────────
// (a) L1 — prompt nie zaprasza do zmyślania liczb + niesie sekwencję E1→E5
// ───────────────────────────────────────────────────────────────────────────

describe('doktryna treści Excela — (a) kontrakt promptu: zero zachęty do fabrykacji', () => {
  /**
   * Dosłowna instrukcja sprzed naprawy (PLAN, punkt 7):
   *   „7. REALISTIC DATA: What sample data makes sense? Use realistic numbers for the domain."
   * i (GENERATE, punkt 8):
   *   „8. Use realistic sample data when the user didn't provide specific numbers."
   * Obie wprost zapraszały model do wymyślania liczb — nie mogą wrócić.
   */
  const FABRICATION_INVITATIONS = [
    /use\s+realistic\s+numbers/i,
    /realistic\s+sample\s+data/i,
    /realistic\s+data\s*:/i,
    /make\s+up\s+(?:some\s+)?(?:numbers|data)/i,
    /invent\s+(?:plausible|realistic)/i,
  ];

  it.each(['PLANNING_SYSTEM_PROMPT', 'GENERATION_SYSTEM_PROMPT', 'REVIEW_SYSTEM_PROMPT'])(
    '%s nie zawiera zachęty do zmyślania liczb',
    (name) => {
      const p = promptBody(name);
      for (const re of FABRICATION_INVITATIONS) {
        expect(p, `prompt ${name} zawiera zachętę do fabrykacji: ${re}`).not.toMatch(re);
      }
    }
  );

  it('PLANNING prompt narzuca 3 dozwolone źródła liczby i zakaz fabrykacji', () => {
    const p = promptBody('PLANNING_SYSTEM_PROMPT');
    expect(p).toMatch(/NO FABRICATION/i);
    // Trzy źródła: żądanie użytkownika / kontekst / jawnie oznaczone ZAŁOŻENIE.
    expect(p).toMatch(/user's request/i);
    expect(p).toMatch(/context/i);
    expect(p).toMatch(/assumption/i);
    expect(p).toContain('(założenie)');
    // Jawnie: żadnego „realistycznie wyglądającego" wymysłu.
    expect(p).toMatch(/never invent/i);
  });

  it('GENERATION prompt powtarza zakaz fabrykacji i zakaz cykli', () => {
    const p = promptBody('GENERATION_SYSTEM_PROMPT');
    expect(p).toMatch(/NO FABRICATION/i);
    expect(p).toMatch(/NO CIRCULAR REFERENCES/i);
    expect(p).toContain('(założenie)');
  });
});

describe('doktryna treści Excela — (a2) sekwencja E1→E5 w fazie PLAN (§4.7)', () => {
  it('PLANNING prompt prowadzi model przez E1→E5 w tej kolejności', () => {
    const p = promptBody('PLANNING_SYSTEM_PROMPT');
    const steps = ['E1', 'E2', 'E3', 'E4', 'E5'];
    // Szukamy MARKERA kroku na początku linii (`\nE1  …`), nie wystąpienia „E1"
    // w zdaniu opisowym — inaczej wzmianka „the E1→E5 sequence" fałszuje kolejność.
    const positions = steps.map((s) => {
      const idx = p.indexOf(`\n${s}  `);
      expect(idx, `brak kroku ${s} w prompcie planowania`).toBeGreaterThan(0);
      return idx;
    });
    // Kolejność sekwencji jest częścią kontraktu (pytanie → zmienne → silnik → wyniki → wrażliwość).
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('PLANNING prompt niesie treść każdego kroku, nie same etykiety', () => {
    const p = promptBody('PLANNING_SYSTEM_PROMPT');
    // E1 — pytanie decyzyjne z progiem + test falsyfikowalności
    expect(p).toMatch(/DECISION QUESTION/i);
    expect(p).toMatch(/threshold/i);
    // E2 — driver tree MECE, 3-8 wejść, źródło/zakres/ranga
    expect(p).toMatch(/MECE/);
    expect(p).toMatch(/3-8/);
    expect(p).toMatch(/sensitivity rank/i);
    expect(p).toMatch(/min-max range/i);
    // E3 — łańcuch równań, zero liczb po prawej, graf acykliczny, tożsamość kontrolna
    expect(p).toMatch(/output = f\(inputs \| earlier outputs\)/);
    expect(p).toMatch(/ACYCLIC/);
    expect(p).toMatch(/CONTROL IDENTITY/i);
    // E4 — miary decyzji z progiem i kierunkiem
    expect(p).toMatch(/good direction/i);
    // E5 — wrażliwość + punkt przełamania + wniosek K1→K4
    expect(p).toMatch(/BREAK POINT/i);
    expect(p).toMatch(/K1→K4/);
  });

  it('PLANNING prompt żąda kontraktu JSON z §4.7 (klucze E1→E5) i warstw A0-A6', () => {
    const p = promptBody('PLANNING_SYSTEM_PROMPT');
    for (const key of [
      'decisionQuestion',
      'decisionMetric',
      'threshold',
      'inputs',
      'sensitivityRank',
      'equations',
      'identities',
      'results',
      'goodDirection',
      'sensitivity',
      'breakEven',
      'conclusionDraft',
      'layer',
    ]) {
      expect(p, `brak klucza kontraktu „${key}"`).toContain(`"${key}"`);
    }
    // Anatomia warstw: A1+A2+A3 = minimum żywotne.
    expect(p).toMatch(/A1 Assumptions \(MANDATORY/);
    expect(p).toMatch(/A2 Engine \(MANDATORY\)/);
    expect(p).toMatch(/A3 Results \(MANDATORY\)/);
  });

  it('CONFIRM prompt sprawdza kompletność E1→E5 (plan z pustym krokiem nie idzie dalej)', () => {
    const p = promptBody('CONFIRMATION_SYSTEM_PROMPT');
    expect(p).toMatch(/E1→E5/);
    expect(p).toMatch(/decisionQuestion/);
    expect(p).toMatch(/ACYCLIC/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// (b) DX-01 — brak warstwy Założeń = CRITICAL blokujący
// ───────────────────────────────────────────────────────────────────────────

/** Model 2-arkuszowy z formułami, ale BEZ arkusza Założeń (drivery wpisane w silniku). */
function modelWithoutAssumptions(): WorkbookSchema {
  return {
    title: 'Model bez założeń',
    sheets: [
      {
        name: 'Dane',
        columns: [
          { key: 'item', header: 'Pozycja', type: 'text' },
          { key: 'val', header: 'Wartość', type: 'currency' },
        ],
        rows: [
          { cells: { item: { value: 'Przychód' }, val: { value: 100000 } } },
          { cells: { item: { value: 'Koszt' }, val: { value: 60000 } } },
        ],
      },
      {
        name: 'Wynik',
        columns: [
          { key: 'metric', header: 'Miara', type: 'text' },
          { key: 'v', header: 'Wartość', type: 'currency' },
        ],
        rows: [{ cells: { metric: { value: 'Marża' }, v: { formula: "'Dane'!B2-'Dane'!B3" } } }],
      },
    ],
  };
}

describe('doktryna treści Excela — (b) DX-01 brak warstwy Założeń', () => {
  it('model bez arkusza Założeń → DX-01 CRITICAL, blocking=true, passed=false', () => {
    const report = critiqueWorkbook(modelWithoutAssumptions());
    const dx1 = report.issues.find((i) => i.code === 'DX-01-NO-ASSUMPTIONS-LAYER');

    expect(dx1).toBeDefined();
    expect(dx1!.severity).toBe('CRITICAL');
    expect(dx1!.blocking).toBe(true);
    expect(dx1!.canonCode).toBe('validation_failed');
    expect(dx1!.message).toMatch(/Założeń/);
    expect(report.passed).toBe(false);
    expect(report.score).toBeLessThan(100);
  });

  it('ten sam model Z arkuszem Założeń (nazwa) → DX-01 milczy', () => {
    const wb = modelWithoutAssumptions();
    wb.sheets[0].name = 'Założenia';
    expect(
      critiqueWorkbook(wb).issues.find((i) => i.code === 'DX-01-NO-ASSUMPTIONS-LAYER')
    ).toBeUndefined();
  });

  it('ten sam model Z flagą isAssumptions → DX-01 milczy (flaga równoprawna z nazwą)', () => {
    const wb = modelWithoutAssumptions();
    wb.sheets[0].isAssumptions = true;
    expect(
      critiqueWorkbook(wb).issues.find((i) => i.code === 'DX-01-NO-ASSUMPTIONS-LAYER')
    ).toBeUndefined();
  });

  it('GRANICA: jedna zakładka = TABELA, nie model → DX-01 NIE flaguje (doktryna §2)', () => {
    const wb: WorkbookSchema = {
      title: 'Eksport listy',
      sheets: [
        {
          name: 'Budget',
          columns: [
            { key: 'item', header: 'Pozycja', type: 'text' },
            { key: 'amount', header: 'Kwota', type: 'currency' },
          ],
          rows: [
            { cells: { item: { value: 'A' }, amount: { value: 10 } } },
            { cells: { item: { value: 'B' }, amount: { value: 20 } } },
            {
              isSummary: true,
              cells: { item: { value: 'Razem' }, amount: { formula: 'SUM(B2:B3)' } },
            },
          ],
        },
      ],
    };
    const report = critiqueWorkbook(wb);
    expect(report.issues.find((i) => i.code === 'DX-01-NO-ASSUMPTIONS-LAYER')).toBeUndefined();
    expect(report.score).toBe(100);
  });

  it('GRANICA: wiele arkuszy ale ZERO formuł = zrzut danych → DX-01 NIE flaguje', () => {
    const wb = modelWithoutAssumptions();
    wb.sheets[1].rows[0].cells.v = { value: 40000 };
    expect(
      critiqueWorkbook(wb).issues.find((i) => i.code === 'DX-01-NO-ASSUMPTIONS-LAYER')
    ).toBeUndefined();
  });

  it('R-A1: dwa arkusze Założeń → DX-01 MAJOR (jeden model = jedno źródło wejść)', () => {
    const wb = modelWithoutAssumptions();
    wb.sheets[0].name = 'Założenia';
    wb.sheets.push({
      name: 'Parametry',
      columns: [{ key: 'p', header: 'Parametr', type: 'number' }],
      rows: [{ cells: { p: { value: 7 } } }],
    });
    const dx1 = critiqueWorkbook(wb).issues.find((i) => i.code === 'DX-01-NO-ASSUMPTIONS-LAYER');
    expect(dx1).toBeDefined();
    expect(dx1!.severity).toBe('MAJOR');
    expect(dx1!.blocking).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// (c) DX-02 — odwołania cykliczne
// ───────────────────────────────────────────────────────────────────────────

/** Arkusz z cyklem A→B→A: B2 = C2*2, C2 = B2+1. */
function cyclicWorkbook(): WorkbookSchema {
  return {
    title: 'Model z cyklem',
    sheets: [
      {
        name: 'Założenia',
        columns: [
          { key: 'p', header: 'Parametr', type: 'text' },
          { key: 'v', header: 'Wartość', type: 'number' },
        ],
        rows: [{ cells: { p: { value: 'Stopa' }, v: { value: 0.1 } } }],
      },
      {
        name: 'Model',
        columns: [
          { key: 'label', header: 'Pozycja', type: 'text' },
          { key: 'a', header: 'A', type: 'number' },
          { key: 'b', header: 'B', type: 'number' },
        ],
        rows: [
          {
            cells: {
              label: { value: 'Odsetki' },
              a: { formula: 'C2*2' }, // B2 ← C2
              b: { formula: 'B2+1' }, // C2 ← B2   → cykl
            },
          },
        ],
      },
    ],
  };
}

describe('doktryna treści Excela — (c) DX-02 odwołania cykliczne', () => {
  it('cykl A→B→A → DX-02 CRITICAL, canonCode formula_cycle_detected, passed=false', () => {
    const report = critiqueWorkbook(cyclicWorkbook());
    const dx2 = report.issues.find((i) => i.code === 'DX-02-FORMULA-CYCLE');

    expect(dx2).toBeDefined();
    expect(dx2!.severity).toBe('CRITICAL');
    expect(dx2!.blocking).toBe(true);
    expect(dx2!.canonCode).toBe('formula_cycle_detected');
    expect(dx2!.sheet).toBe('Model');
    expect(dx2!.message).toMatch(/cykliczne/i);
    expect(report.passed).toBe(false);
  });

  it('cykl zgłoszony JEDEN raz (deduplikacja po zbiorze węzłów)', () => {
    const found = critiqueWorkbook(cyclicWorkbook()).issues.filter(
      (i) => i.code === 'DX-02-FORMULA-CYCLE'
    );
    expect(found).toHaveLength(1);
  });

  it('cykl przez ARKUSZE (Model!B2 ↔ Wynik!B2) też jest wykryty', () => {
    const wb: WorkbookSchema = {
      title: 'Cykl cross-sheet',
      sheets: [
        {
          name: 'Założenia',
          columns: [{ key: 'v', header: 'Wartość', type: 'number' }],
          rows: [{ cells: { v: { value: 5 } } }],
        },
        {
          name: 'Model',
          columns: [{ key: 'x', header: 'X', type: 'number' }],
          rows: [{ cells: { x: { formula: "'Wynik'!A2*2" } } }],
        },
        {
          name: 'Wynik',
          columns: [{ key: 'y', header: 'Y', type: 'number' }],
          rows: [{ cells: { y: { formula: "'Model'!A2+1" } } }],
        },
      ],
    };
    const dx2 = critiqueWorkbook(wb).issues.find((i) => i.code === 'DX-02-FORMULA-CYCLE');
    expect(dx2).toBeDefined();
    expect(dx2!.severity).toBe('CRITICAL');
  });

  it('SUM obejmujący własną komórkę (total sumujący sam siebie) → DX-02', () => {
    const wb: WorkbookSchema = {
      title: 'Total sumujący sam siebie',
      sheets: [
        {
          name: 'Założenia',
          columns: [{ key: 'v', header: 'Wartość', type: 'number' }],
          rows: [{ cells: { v: { value: 5 } } }],
        },
        {
          name: 'Budżet',
          columns: [
            { key: 'item', header: 'Pozycja', type: 'text' },
            { key: 'amount', header: 'Kwota', type: 'currency' },
          ],
          rows: [
            { cells: { item: { value: 'A' }, amount: { formula: "'Założenia'!A2" } } },
            { cells: { item: { value: 'B' }, amount: { formula: "'Założenia'!A2*2" } } },
            // SUM(B2:B4) w komórce B4 → obejmuje samą siebie.
            {
              isSummary: true,
              cells: { item: { value: 'Razem' }, amount: { formula: 'SUM(B2:B4)' } },
            },
          ],
        },
      ],
    };
    const dx2 = critiqueWorkbook(wb).issues.find((i) => i.code === 'DX-02-FORMULA-CYCLE');
    expect(dx2).toBeDefined();
    expect(dx2!.severity).toBe('CRITICAL');
  });

  it('GRANICA: łańcuch okresów n = f(n-1) to DAG, nie cykl → DX-02 milczy', () => {
    const wb: WorkbookSchema = {
      title: 'Projekcja łańcuchowa',
      sheets: [
        {
          name: 'Założenia',
          columns: [
            { key: 'p', header: 'Parametr', type: 'text' },
            { key: 'v', header: 'Wartość', type: 'number' },
          ],
          rows: [{ cells: { p: { value: 'Wzrost' }, v: { value: 0.05 } } }],
        },
        {
          name: 'Projekcja',
          columns: [
            { key: 'period', header: 'Okres', type: 'text' },
            { key: 'rev', header: 'Przychód', type: 'currency' },
          ],
          rows: [
            { cells: { period: { value: '2026' }, rev: { formula: "'Założenia'!B2*1000000" } } },
            { cells: { period: { value: '2027' }, rev: { formula: "B2*(1+'Założenia'!B2)" } } },
            { cells: { period: { value: '2028' }, rev: { formula: "B3*(1+'Założenia'!B2)" } } },
          ],
        },
      ],
    };
    const report = critiqueWorkbook(wb);
    expect(report.issues.find((i) => i.code === 'DX-02-FORMULA-CYCLE')).toBeUndefined();
    expect(report.passed).toBe(true);
  });

  it('GRANICA: nazwa funkcji z cyfrą (LOG10) nie jest traktowana jak adres komórki', () => {
    const wb: WorkbookSchema = {
      title: 'Funkcje',
      sheets: [
        {
          name: 'Założenia',
          columns: [{ key: 'v', header: 'Wartość', type: 'number' }],
          rows: [{ cells: { v: { value: 100 } } }],
        },
        {
          name: 'Model',
          columns: [{ key: 'x', header: 'X', type: 'number' }],
          rows: [{ cells: { x: { formula: "LOG10('Założenia'!A2)" } } }],
        },
      ],
    };
    expect(
      critiqueWorkbook(wb).issues.find((i) => i.code === 'DX-02-FORMULA-CYCLE')
    ).toBeUndefined();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// (d) REGRESJA WARTOŚCI — 7 szablonów przechodzi nowe bramki
// ───────────────────────────────────────────────────────────────────────────

describe('doktryna treści Excela — (d) 7 zarejestrowanych szablonów przechodzi bramkę', () => {
  const templates = listWorkbookTemplates();

  // Liczba szablonów rośnie wraz z uzupełnianiem typologii doktryny (§8) — asercja
  // pilnuje MINIMUM i unikalności id, a nie sztywnej liczby, żeby dołożenie kolejnego
  // archetypu (np. projectViability, 2026-07-28) nie wywracało bramki doktryny.
  it('rejestr ma komplet szablonów, każdy z unikalnym id', () => {
    expect(templates.length).toBeGreaterThanOrEqual(7);
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(templates.map((t) => t.id))(
    'szablon „%s" — brak CRITICAL, brak DX-01, brak DX-02, score 100',
    (id) => {
      const schema = buildFromTemplateFlat(id, {});
      expect(schema, `szablon ${id} nie zbudował się z domyślnymi parametrami`).not.toBeNull();

      const report = critiqueWorkbook(schema as WorkbookSchema);
      const critical = report.issues.filter((i) => i.severity === 'CRITICAL');

      expect(
        critical.map((i) => `${i.code}: ${i.message}`),
        `szablon ${id} ma CRITICAL`
      ).toEqual([]);
      expect(report.issues.find((i) => i.code === 'DX-01-NO-ASSUMPTIONS-LAYER')).toBeUndefined();
      expect(report.issues.find((i) => i.code === 'DX-02-FORMULA-CYCLE')).toBeUndefined();
      expect(report.passed).toBe(true);
      expect(report.score).toBe(100);
    }
  );

  it('każdy szablon ma jawną warstwę Założeń (A1) — dowód, że DX-01 nie jest martwy', () => {
    for (const t of templates) {
      const schema = buildFromTemplateFlat(t.id, {}) as WorkbookSchema;
      const hasAssumptions = schema.sheets.some(
        (s) =>
          s.isAssumptions === true || /assumption|założen|zalozen|inputs|parametry/i.test(s.name)
      );
      expect(hasAssumptions, `szablon ${t.id} nie ma warstwy Założeń`).toBe(true);
    }
  });
});
