/**
 * TEST KALIBRACJI RUBRYKI „Analizuj z AI".
 *
 * Pytanie, na które ten plik odpowiada: czy nowa rubryka daje modelowi OSTRZEJSZY
 * i BARDZIEJ KONKRETNY wsad niż stara — na tym samym wejściu, BEZ wywołania LLM.
 * Porównujemy wyrenderowany prompt: stara wersja renderowała kryterium jako
 * `- risk: ryzyko` (sama nazwa osi, zero progu), nowa dokłada próg spełnienia
 * i próg odcięcia, blok DOKTRYNY, pasma kalibracji `completeness` i kotwice wagi.
 *
 * Uruchomienie wąskie (bez pełnego vitest):
 *   npx vitest run tests/unit/services/cardAnalysisRubric.test.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({
  Api: { post: vi.fn(), get: vi.fn() },
}));

import { Api } from '@/services/api';
import {
  analyzeCard,
  ARTIFACT_CRITERIA,
  buildAnalysisPrompt,
  criteriaFor,
  DOCTRINE_RULES,
} from '@/services/cardAnalysis';
import type { CardAnalysisInput } from '@/services/cardAnalysis';

/** Wsad testowy — karta „Opcje i trade-offy" decyzji, celowo słaba. */
const WSAD: CardAnalysisInput = {
  artifactType: 'decision',
  cardId: 'options-tradeoffs',
  artifactTitle: 'Wybór dostawcy WMS dla magazynu centralnego',
  artifactContext: [
    'Karta „Kontekst i problem": czas kompletacji zamówienia wynosi dziś 96 min.',
    'Historia zmian: wskaźnik kompletacji 84 → 71 (2026-05), oraz 35 → 42 (2026-06).',
  ].join('\n'),
  fields: [
    {
      id: 'options',
      label: 'Opcje',
      kind: 'list',
      writable: true,
      value: 'Opcja A: wdrożyć WMS dostawcy X.\nOpcja B: nic nie robić.',
    },
    {
      id: 'tradeoffs',
      label: 'Trade-offy',
      kind: 'text',
      writable: true,
      value: 'Opcja A jest ważna dla organizacji i przyniesie znaczne oszczędności.',
    },
  ],
  isPolish: true,
};

/**
 * Odtworzenie STAREGO renderu kryteriów (`origin/demo`, przed zmianą), żeby
 * różnica była w teście widoczna, a nie deklarowana w opisie commita.
 */
function staryRenderKryteriow(input: CardAnalysisInput): string {
  return criteriaFor(input.artifactType, input.isPolish)
    .map((c) => `- ${c.id}: ${c.text}`)
    .join('\n');
}

describe('rubryka: kryteria mają progi, nie tylko nazwy', () => {
  const TYPY = ['task', 'decision', 'insight', 'initiative', 'tool', 'notification'] as const;

  it.each(TYPY)('%s — każde kryterium ma definicję i próg odcięcia w obu językach', (typ) => {
    const kryteria = ARTIFACT_CRITERIA[typ];
    expect(kryteria.length).toBeGreaterThan(0);
    for (const k of kryteria) {
      expect(k.definition.pl.length, `${typ}/${k.id} definition.pl`).toBeGreaterThan(40);
      expect(k.definition.en.length, `${typ}/${k.id} definition.en`).toBeGreaterThan(40);
      expect(k.failsWhen.pl.length, `${typ}/${k.id} failsWhen.pl`).toBeGreaterThan(30);
      expect(k.failsWhen.en.length, `${typ}/${k.id} failsWhen.en`).toBeGreaterThan(30);
    }
  });

  it('Powiadomienie nie ma już pseudo-kryteriów „gaps"/„risks" (tautologia)', () => {
    const ids = ARTIFACT_CRITERIA.notification.map((c) => c.id);
    expect(ids).not.toContain('gaps');
    expect(ids).not.toContain('risks');
    expect(ids).toEqual([
      'event-clarity',
      'required-action',
      'deadline-urgency',
      'addressee',
      'ignore-consequence',
    ]);
  });

  it('Interview zostaje BEZ kryteriów — nie ma przycisku „Analizuj z AI"', () => {
    expect(ARTIFACT_CRITERIA.interview).toEqual([]);
  });
});

describe('kalibracja promptu: PRZED vs PO na tym samym wsadzie', () => {
  it('nowy render kryteriów zawiera stary render I dokłada oba progi', () => {
    const { message } = buildAnalysisPrompt(WSAD);
    const stary = staryRenderKryteriow(WSAD);

    // Stary prompt: 4 linie po samej nazwie osi, zero progów.
    expect(stary).toContain('- risk: ryzyko');
    expect(stary).not.toContain('SPEŁNIONE GDY');

    // Nowy prompt: ta sama oś, ale z progiem spełnienia i progiem odcięcia.
    expect(message).toContain('- risk — ryzyko');
    expect(message).toContain(
      'SPEŁNIONE GDY: Każde ryzyko ma prawdopodobieństwo, wpływ, właściciela, mitygację, wyzwalacz i ryzyko rezydualne'
    );
    expect(message).toContain('NIESPEŁNIONE GDY: Ryzyko jest nazwą kategorii');

    // Każde kryterium typu ma OBA progi — nie tylko to jedno.
    const kryteria = criteriaFor('decision', true);
    for (const k of kryteria) {
      expect(message).toContain(`SPEŁNIONE GDY: ${k.definition}`);
      expect(message).toContain(`NIESPEŁNIONE GDY: ${k.failsWhen}`);
    }
  });

  it('prompt niesie blok DOKTRYNY z pięcioma regułami warsztatu + językiem + liczbami', () => {
    const { message } = buildAnalysisPrompt(WSAD);

    expect(message).toContain('=== DOKTRYNA');
    for (const d of DOCTRINE_RULES) {
      expect(message).toContain(`[criterionId: ${d.id}]`);
    }
    expect(DOCTRINE_RULES.map((d) => d.id)).toEqual([
      'doktryna-piramida',
      'doktryna-mece',
      'doktryna-kwantyfikacja',
      'doktryna-falsyfikowalnosc',
      'doktryna-niepewnosc',
      'doktryna-jezyk',
      'doktryna-liczby',
    ]);
    // Instrukcja egzekwowania — bez niej doktryna jest ozdobą.
    expect(message).toContain('Naruszenie doktryny ZGŁASZAJ JAKO GAP');
  });

  it('prompt niesie pasma kalibracji `completeness` (nie samą prośbę o liczbę)', () => {
    const { message } = buildAnalysisPrompt(WSAD);
    expect(message).toContain('=== KALIBRACJA OCENY "completeness"');
    for (const pasmo of ['90-100:', '70-89:', '50-69:', '< 50:']) {
      expect(message).toContain(pasmo);
    }
    expect(message).toContain('Zaokrąglij do pełnych 5');
  });

  it('prompt niesie kotwice wagi i czyni `severity` obowiązkowym', () => {
    const { message } = buildAnalysisPrompt(WSAD);
    expect(message).toContain('pole OBOWIĄZKOWE przy KAŻDEJ pozycji');
    expect(message).toContain('high: BLOKUJE');
    expect(message).toContain('medium: OBNIŻA JAKOŚĆ');
    expect(message).toContain('low: ROZWINIĘCIE');
  });

  it('prompt zakazuje powtarzania tej samej pozycji między szufladami', () => {
    const { message } = buildAnalysisPrompt(WSAD);
    expect(message).toContain('kolejność: gaps > risks > suggestions');
  });

  it('nowy prompt jest istotnie bogatszy, ale mieści się w limicie endpointu', () => {
    const { message } = buildAnalysisPrompt(WSAD);
    expect(message.length).toBeGreaterThan(6000); // stary dla tego wsadu: ~2,8 tys. znaków
    expect(message.length).toBeLessThan(30_000); // limit AiGenerateRequestSchema (z zapasem)
  });

  it('znacznik przycięcia idzie w języku przebiegu (wada: polski marker w trybie EN)', () => {
    const dlugi = 'x'.repeat(9000);
    const en = buildAnalysisPrompt({ ...WSAD, isPolish: false, artifactContext: dlugi });
    expect(en.message).toContain('[truncated');
    expect(en.message).not.toContain('przycięto');

    const pl = buildAnalysisPrompt({ ...WSAD, artifactContext: dlugi });
    expect(pl.message).toContain('[przycięto');
  });
});

describe('parser: deduplikacja i waga', () => {
  beforeEach(() => {
    vi.mocked(Api.post).mockReset();
  });

  /** Odpowiedź z powtórzeniami i jedną pozycją bez `severity`. */
  const ODPOWIEDZ = JSON.stringify({
    completeness: 55,
    verdict: 'Karta wymaga uzupełnienia.',
    gaps: [
      { title: 'Brak właściciela ryzyka', detail: 'Ryzyko A nie ma właściciela.', severity: 'low' },
      { title: 'Brak kryteriów akceptacji', detail: 'Nie ma progów.', severity: 'high' },
      { title: 'brak wlasciciela ryzyka!', detail: 'Ryzyko A nie ma wlasciciela', severity: 'high' },
      { title: 'Brak decydenta', detail: 'Nikt nie jest wskazany.' },
    ],
    risks: [
      { title: 'Brak właściciela ryzyka', detail: 'Ryzyko A nie ma właściciela.', severity: 'high' },
      { title: 'Sprzeczne wartości metryki', detail: '96 min vs 84 → 71', severity: 'high' },
    ],
    suggestions: [{ title: 'Brak decydenta', detail: 'Nikt nie jest wskazany.', severity: 'medium' }],
    changes: [],
  });

  it('ten sam brak nie występuje trzy razy i nie zjada limitu', async () => {
    vi.mocked(Api.post).mockResolvedValue({ text: ODPOWIEDZ });
    const wynik = await analyzeCard(WSAD);

    // „Brak właściciela ryzyka" był 3× (2× w gaps po normalizacji, 1× w risks) → zostaje 1×.
    const wszystkie = [...wynik.gaps, ...wynik.risks, ...wynik.suggestions];
    const wlasciciel = wszystkie.filter((f) => /wlasciciela|właściciela/i.test(f.title));
    expect(wlasciciel).toHaveLength(1);

    // „Brak decydenta" był w gaps i w suggestions → zostaje w ostrzejszej szufladzie.
    expect(wynik.gaps.some((g) => g.title === 'Brak decydenta')).toBe(true);
    expect(wynik.suggestions.some((s) => s.title === 'Brak decydenta')).toBe(false);

    // Risks tracą duplikat, ale zachowują pozycję unikalną.
    expect(wynik.risks.map((r) => r.title)).toEqual(['Sprzeczne wartości metryki']);
  });

  it('pozycje są uszeregowane wagą, a brak wagi jest widoczny i idzie na koniec', async () => {
    vi.mocked(Api.post).mockResolvedValue({ text: ODPOWIEDZ });
    const wynik = await analyzeCard(WSAD);

    expect(wynik.gaps[0].severity).toBe('high');
    expect(wynik.gaps[0].title).toBe('Brak kryteriów akceptacji');

    const bezWagi = wynik.gaps[wynik.gaps.length - 1];
    expect(bezWagi.title).toBe('Brak decydenta');
    expect(bezWagi.severity).toBe('low'); // nigdy nie zawyżamy
    expect(bezWagi.detail).toContain('waga nieokreślona przez AI');
  });

  it('brak `severity` NIE jest już zamiatany domyślnym „medium"', async () => {
    vi.mocked(Api.post).mockResolvedValue({
      text: JSON.stringify({
        completeness: 40,
        verdict: 'x',
        gaps: [{ title: 'A', detail: 'a' }],
        risks: [],
        suggestions: [],
        changes: [],
      }),
    });
    const wynik = await analyzeCard(WSAD);
    expect(wynik.gaps[0].severity).not.toBe('medium');
    expect(wynik.gaps[0].detail).toContain('waga nieokreślona');
  });
});
