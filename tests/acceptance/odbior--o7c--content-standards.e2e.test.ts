/**
 * ODBIÓR O7 — Standardy treści (CARD_CONTENT_FORMULA / INITIATIVE_FORMULA /
 * ton PL-EN konsultanta Teresy).
 *
 * Pattern: same as `oxford.e2e.test.ts` — the O7 validators and the persona
 * prompt builder are DETERMINISTIC pure functions (no LLM, no HTTP, no DB),
 * so this proof imports the REAL production modules and asserts on real
 * output. A validator that only "exists" as an unused file is worthless; each
 * block below feeds a KNOWN-GOOD fixture (must pass / must contain) and a
 * KNOWN-BAD fixture (must fail / must flag) through the exact function the
 * real generation/creation pipeline calls.
 *
 * Wiring evidence (traced 2026-07-19, see O7 REJESTR audit report — NOT
 * re-asserted here as a runtime call because that requires booting
 * InterviewInsightService / createInitiativeService / AIPipeline, which pull
 * in DB + the 46-lazy-wrapper service graph):
 *   - O7.1 insight:      server/src/services/InterviewInsightService.ts
 *                         imports and calls `validateInsightCard` (real
 *                         insight-generation path) — cardContentFormulaValidator.ts:237.
 *   - O7.1/O7.2 initiative: server/src/services/initiative/createInitiativeService.ts
 *                         line ~316 calls `validateCardStructure(card)` on every
 *                         created initiative (F3.2, "ADVISORY — NEVER blocks
 *                         creation", by DESIGN per the file's own comment).
 *   - O7.3 tone:          server/src/services/ai/AIPipeline.ts:1682 calls
 *                         `buildPersonaPrompt(currentScreen, language, options)`
 *                         inside `buildRoleSection`, which `buildSystemPrompt`
 *                         (AIPipeline.ts:1235) ALWAYS invokes unless the caller
 *                         sets `dedicatedSystemPrompt=true` (WorkbookGenerator
 *                         etc. only) — `server/src/routes/ai.routes.ts`'s
 *                         `/chat/stream` (the main Teresa chat surface) never
 *                         sets that flag, so the persona prompt below IS what
 *                         reaches the LLM system prompt in production.
 *
 * Prefix: none — this file writes no DB rows (pure-function proof only).
 */
import { describe, expect, it } from 'vitest';

// O7.1 — CARD_CONTENT_FORMULA scored validators (real production module).
import {
  type InitiativeCardInput,
  type InsightCardData,
  validateInitiativeCard,
  validateInsightCard,
} from '../../server/src/services/cardContentFormulaValidator.js';
// O7.2 — INITIATIVE_FORMULA §B3 structural + prose validators (real module,
// reused BY cardContentFormulaValidator AND called directly by
// createInitiativeService.ts).
import {
  kpiBaselineTarget,
  raidMix,
  validateCardContent,
  validateCardStructure,
} from '../../server/src/services/initiative/initiativeCardValidators.js';
// O7.3 — Teresa persona/tone prompt builder (real module; the ONLY place the
// BCG doctrine + PL/EN consulting tone + response discipline are authored).
import {
  buildPersonaPrompt,
  detectLanguage,
  getAvailableEmphases,
  getScreenEmphasis,
} from '../../server/src/ai/persona.js';

// ============================================================================
// O7.1 — Insight card (validateInsightCard)
// ============================================================================
describe('O7.1 — CARD_CONTENT_FORMULA insight validator REJECTS bad output, PASSES good', () => {
  function goodInsight(): InsightCardData {
    return {
      title: 'Koncentracja u Klienta A blokuje odbudowę marży automotive',
      executive_summary:
        'Marża brutto w segmencie automotive spadła do 12 procent wobec progu 20 procent zapisanego w modelu ' +
        'finansowym klienta, a Klient A odpowiada za 61 procent przychodu tego segmentu, więc erozja marży ' +
        'koncentruje ryzyko na jednym kontrahencie i wymaga natychmiastowej reakcji zarządu. Poziom pewności tej ' +
        'oceny jest potwierdzony na podstawie trzech ostatnich zamknięć miesięcznych oraz niezależnej weryfikacji ' +
        'przez dział controllingu, co wyklucza jednorazowe zaburzenie sezonowe.',
      themes: [
        {
          title: 'Koncentracja przychodu u Klienta A ogranicza elastyczność negocjacyjną',
          description:
            'Klient A generuje 61 procent przychodu segmentu automotive, co jest znacznie powyżej bezpiecznego ' +
            'progu dywersyfikacji ustalonego na 30 procent przez zarząd w poprzednim roku obrotowym. Utrata lub ' +
            'renegocjacja tego kontraktu bezpośrednio zagraża rentowności całego segmentu i wymaga natychmiastowej ' +
            'reakcji zarządu w horyzoncie jednego kwartału, ponieważ alternatywni odbiorcy nie są jeszcze rozwinięci ' +
            'na wystarczającą skalę.',
          evidence_refs: ['fact:clientA'],
        },
        {
          title: 'Rosnące koszty materiałów bezpośrednich napędzają erozję marży',
          description:
            'Koszty materiałów bezpośrednich wzrosły o 9 punktów procentowych rok do roku, co jest głównym ' +
            'sterownikiem erozji marży brutto obok cen sprzedaży utrzymywanych na niezmienionym poziomie od ' +
            'dłuższego czasu. Dostawcy sygnalizują dalsze podwyżki w kolejnym kwartale, co pogłębi presję kosztową, ' +
            'jeśli ceny sprzedaży dla Klienta A pozostaną bez zmian przez cały bieżący rok obrotowy.',
          evidence_refs: ['fact:margin'],
        },
        {
          title: 'Brak indeksacji cennika od 18 miesięcy subsydiuje klienta',
          description:
            'Cennik dla Klienta A nie był renegocjowany od 18 miesięcy mimo systematycznego wzrostu kosztów wsadu, ' +
            'co oznacza że organizacja faktycznie subsydiuje klienta kosztem własnej marży segmentu automotive. ' +
            'Standardowa klauzula indeksacyjna zapisana w umowie ramowej nie jest egzekwowana przez zespół ' +
            'sprzedaży, mimo że jej aktywacja mogłaby częściowo odbudować rentowność kontraktu już w tym kwartale.',
          evidence_refs: ['fact:pricing'],
        },
      ],
      issues: [
        {
          title: 'Koncentracja u jednego klienta blokuje dywersyfikację przychodu',
          severity: 'high',
          evidence_refs: ['fact:clientA'],
        },
        {
          title: 'Presja kosztowa materiałów obniża marżę kwartał do kwartału',
          severity: 'medium',
          evidence_refs: ['fact:margin'],
        },
      ],
      missing_data: ['Brak danych o marży konkurencji', 'Brak prognozy cen stali na 2026'],
      evidence_map: [{ answer_snippet: 'Marża 12% vs próg 20%' }],
      material_quality: {
        overall_material_score: 0.82,
        limitations: 'Dane tylko za ostatnie 3 miesiące.',
        missing_voices: ['CFO'],
        recommended_followups: ['Potwierdzić z CFO trend kwartalny'],
      },
    };
  }

  it('GOOD insight card → pass === true, score ≥ 90, zero HARD violations', () => {
    const verdict = validateInsightCard(goodInsight());
    if (!verdict.pass) {
      // eslint-disable-next-line no-console
      console.log('[O7.1 insight GOOD unexpected violations]', verdict.violations);
    }
    expect(verdict.pass).toBe(true);
    expect(verdict.score).toBeGreaterThanOrEqual(90);
    // Zero HARD (blocking-grade) violations. A stray SOFT nuance from the
    // 13-type §3 heuristics (e.g. one theme reads slightly topic-ish) is
    // realistic on a hand-written fixture and does not indicate a bug —
    // the important proof is that nothing here is a crash-risk / §A6 auto-FAIL.
    expect(verdict.violations.filter((v) => v.severity === 'hard')).toHaveLength(0);
  });

  it('BAD insight: missing material_quality → hard FAIL (§A6.2 crash-risk)', () => {
    const bad = goodInsight();
    delete (bad as any).material_quality;
    const verdict = validateInsightCard(bad);
    expect(verdict.pass).toBe(false);
    expect(verdict.violationCodes).toContain('insight.material_quality_complete');
  });

  it('BAD insight: filler/placeholder text → hard FAIL (§A6 no_filler)', () => {
    const bad = goodInsight();
    bad.executive_summary = 'TODO: uzupełnić podsumowanie [placeholder]. Lorem ipsum dolor sit amet consectetur.';
    const verdict = validateInsightCard(bad);
    expect(verdict.pass).toBe(false);
    expect(verdict.violationCodes).toContain('insight.no_filler');
  });

  it('BAD insight: empty card → hard FAIL on title + summary + material_quality', () => {
    const verdict = validateInsightCard(null);
    expect(verdict.pass).toBe(false);
    expect(verdict.violationCodes).toEqual(
      expect.arrayContaining([
        'insight.title_present',
        'insight.summary_present',
        'insight.material_quality_complete',
      ])
    );
    expect(verdict.score).toBeLessThan(90);
  });

  it('BAD insight: English-drift prose → soft violation (§A6.1 lang_pl)', () => {
    const bad = goodInsight();
    bad.executive_summary =
      'The margin has decreased because of the increased cost and this will have a significant impact on the business.';
    const verdict = validateInsightCard(bad);
    expect(verdict.violationCodes).toContain('insight.lang_pl');
  });
});

// ============================================================================
// O7.1 / O7.2 — Initiative card (validateInitiativeCard, incl. INITIATIVE_FORMULA
// hypothesis_format + structural §B3 rules reused from initiativeCardValidators.ts)
// ============================================================================
describe('O7.1/O7.2 — CARD_CONTENT_FORMULA + INITIATIVE_FORMULA initiative validator', () => {
  function goodInitiative(): InitiativeCardInput {
    return {
      title: 'Renegocjacja cennika z Klientem A w segmencie automotive',
      problem_statement:
        'Marża brutto segmentu automotive spadła do 12 procent wobec progu 20 procent ze względu na brak indeksacji ' +
        'cennika Klienta A od 18 miesięcy przy jednoczesnym wzroście kosztów materiałów bezpośrednich o 9 punktów ' +
        'procentowych rok do roku. Klient A odpowiada za 61 procent przychodu segmentu, więc dalsza erozja marży ' +
        'bezpośrednio zagraża rentowności całej linii biznesowej i wymaga interwencji zarządu w bieżącym kwartale, ' +
        'zanim kolejny cykl budżetowy utrwali obecne, nierentowne warunki handlowe na kolejny rok obrotowy. ' +
        'Dodatkowo dostawcy sygnalizują dalsze podwyżki cen stali w najbliższych dwóch kwartałach, co jeszcze ' +
        'pogłębi presję na marżę, jeśli cennik nie zostanie zaktualizowany przed rozpoczęciem nowego roku ' +
        'kontraktowego z kluczowym klientem strategicznym, a zespół sprzedaży dotychczas nie egzekwował istniejącej ' +
        'klauzuli indeksacyjnej mimo jej formalnej obecności w umowie ramowej podpisanej trzy lata temu.',
      hypothesis:
        'Jeśli wynegocjujemy indeksację cennika o 8% z Klientem A, to marża brutto segmentu wzrośnie do co najmniej 17% w dwa kwartały, ' +
        'bo koszt materiałów jest głównym sterownikiem erozji marży i indeksacja bezpośrednio kompensuje ten wzrost.',
      description:
        'Program renegocjacji obejmuje przegląd struktury kosztowej, przygotowanie argumentacji opartej na wzroście ' +
        'kosztów wsadu, oraz serię trzech spotkań negocjacyjnych z działem zakupów Klienta A rozłożonych na ' +
        'najbliższy kwartał kalendarzowy, z jasno określonymi rolami po stronie sprzedaży, controllingu i zarządu ' +
        'na każdym etapie procesu negocjacyjnego. Zespół finansowy przygotuje model wrażliwości pokazujący wpływ ' +
        'różnych scenariuszy indeksacji na marżę segmentu automotive, uwzględniając zarówno wariant konserwatywny ' +
        'jak i optymistyczny w horyzoncie dwóch lat, a także analizę wrażliwości na dalsze wahania cen stali i ' +
        'aluminium na rynkach światowych. Zespół sprzedaży zaktualizuje umowę ramową o klauzulę automatycznej ' +
        'indeksacji kwartalnej powiązaną z publikowanym indeksem cen stali, aby zapobiec powtórce obecnej sytuacji ' +
        'w przyszłych okresach rozliczeniowych i ustabilizować przewidywalność marży dla całego portfela klienta na ' +
        'kolejne trzy lata współpracy. Równolegle dział prawny zweryfikuje możliwość wprowadzenia klauzuli ' +
        'retroaktywnej za bieżący kwartał, a controlling przygotuje szczegółowy raport zwrotu z inwestycji z ' +
        'wdrożenia nowego cennika, obejmujący porównanie do progu rentowności 20 procent oraz do wyniku segmentu za ' +
        'poprzedni rok obrotowy w rozbiciu miesięcznym i kwartalnym. Cały program jest koordynowany przez sponsora ' +
        'biznesowego raportującego bezpośrednio do dyrektora finansowego co dwa tygodnie, z formalnym punktem ' +
        'kontrolnym po zakończeniu pierwszej rundy negocjacji i jawną decyzją go albo no-go przed rozpoczęciem ' +
        'drugiej rundy rozmów handlowych z klientem strategicznym, uwzględniającą ryzyko eskalacji do poziomu ' +
        'zarządu obu stron w przypadku braku porozumienia w terminie. Dodatkowo zespół HR przygotuje plan ' +
        'komunikacji wewnętrznej dla działu obsługi klienta, aby zapewnić spójny przekaz w kontaktach z Klientem A ' +
        'przez cały okres trwania negocjacji cennikowych. Program przewiduje również przegląd portfela pozostałych ' +
        'klientów segmentu automotive pod kątem podobnego ryzyka braku indeksacji, aby uniknąć powtórzenia tego ' +
        'samego mechanizmu erozji marży w innych relacjach handlowych w kolejnych kwartałach roku obrotowego. Dział ' +
        'zakupów przeanalizuje możliwość renegocjacji warunków z kluczowymi dostawcami materiałów bezpośrednich ' +
        'równolegle do rozmów z Klientem A, aby częściowo skompensować presję kosztową z drugiej strony łańcucha ' +
        'wartości i zmniejszyć zależność wyniku segmentu wyłącznie od decyzji jednego kontrahenta. Zarząd otrzyma ' +
        'cotygodniowy raport statusu obejmujący postęp negocjacji, zaktualizowaną prognozę marży oraz listę ' +
        'otwartych ryzyk wymagających decyzji na poziomie komitetu sterującego, co zapewni pełną transparentność ' +
        'procesu dla wszystkich interesariuszy programu transformacyjnego. Po zakończeniu pierwszego cyklu ' +
        'negocjacyjnego zespół projektowy przygotuje retrospektywę wyciągającą wnioski do wykorzystania przy ' +
        'kolejnych renegocjacjach cennikowych w innych segmentach biznesowych organizacji, domykając pętlę uczenia ' +
        'się na poziomie całej firmy. Wszystkie decyzje cenowe podjęte w ramach programu będą archiwizowane w ' +
        'rejestrze decyzji PMO wraz z uzasadnieniem biznesowym, co ułatwi audyt zgodności w trakcie corocznego ' +
        'przeglądu kontroli wewnętrznej organizacji.',
      kpis: [{ baseline: '12%', target: '17%', unit: 'marża brutto %' }],
      key_risks: [
        { type: 'RISK', title: 'Klient odrzuca podwyżkę' },
        { type: 'RISK', title: 'Konkurent oferuje niższą cenę' },
        { type: 'ASSUMPTION', title: 'Ceny stali pozostaną stabilne' },
        { type: 'DEPENDENCY', title: 'Zgoda zarządu na nową politykę cenową' },
      ],
      scope_in: ['Klient A automotive', 'Cennik podstawowy', 'Klauzula indeksacyjna'],
      scope_out: ['Pozostali klienci segmentu', 'Zmiana dostawcy', 'Restrukturyzacja produkcji'],
      deliverables: [
        'Zaktualizowana umowa ramowa',
        'Model wrażliwości marży',
        'Raport ROI',
        'Klauzula indeksacyjna kwartalna',
      ],
      success_criteria: [
        'Marża brutto ≥17% w Q3',
        'Podpisany aneks do umowy',
        'Klauzula indeksacyjna aktywna',
        'Brak utraty Klienta A',
      ],
      kill_criteria: ['Klient A grozi zerwaniem kontraktu', 'Marża spada poniżej 8%'],
      milestones: ['Model wrażliwości gotowy', 'Pierwsze spotkanie negocjacyjne', 'Aneks podpisany'],
      cost_capex: 0,
      cost_opex: 15000,
      expected_roi: '210%',
      owner_business_id: 'user-cfo-001',
    };
  }

  it('GOOD initiative card → pass === true, score ≥ 90, zero hard violations', () => {
    const verdict = validateInitiativeCard(goodInitiative());
    if (!verdict.pass) {
      // eslint-disable-next-line no-console
      console.log('[O7.1/O7.2 initiative GOOD unexpected violations]', verdict.violations);
    }
    expect(verdict.pass).toBe(true);
    expect(verdict.score).toBeGreaterThanOrEqual(90);
    expect(verdict.violations.filter((v) => v.severity === 'hard')).toHaveLength(0);
  });

  it('O7.2 INITIATIVE_FORMULA: non-falsifiable hypothesis (no "Jeśli…to…bo/ponieważ") → hard FAIL', () => {
    const bad = goodInitiative();
    bad.hypothesis = 'Chcemy poprawić marżę i zadowolenie klienta w przyszłości.';
    const verdict = validateInitiativeCard(bad);
    expect(verdict.pass).toBe(false);
    expect(verdict.violationCodes).toContain('initiative.hypothesis_format');
    const hyp = verdict.violations.find((v) => v.code === 'initiative.hypothesis_format')!;
    expect(hyp.severity).toBe('hard');
  });

  it('O7.2 INITIATIVE_FORMULA: well-formed "Jeśli X to Y bo Z" hypothesis passes the format check', () => {
    // Direct proof on the underlying INITIATIVE_FORMULA regex-driven rule
    // (initiativeCardValidators.ts), independent of the wrapper's scoring.
    const goodHyp = validateCardContent(
      'Jeśli wdrożymy klauzulę indeksacyjną, to marża brutto wzrośnie do 17%, bo koszt materiałów przestanie erodować cenę sprzedaży.',
      ['hypothesis_format']
    );
    expect(goodHyp).toHaveLength(0);

    const badHyp = validateCardContent('Poprawimy marżę dzięki lepszej negocjacji.', ['hypothesis_format']);
    expect(badHyp).toHaveLength(1);
    expect(badHyp[0].rule).toBe('hypothesis_format');
  });

  it('O7.2 structural §B3: kpi_baseline_target and raid_mix REJECT an empty card, PASS a complete one', () => {
    expect(kpiBaselineTarget(undefined).pass).toBe(false);
    expect(raidMix(undefined).pass).toBe(false);

    const good = goodInitiative();
    expect(kpiBaselineTarget(good).pass).toBe(true);
    expect(raidMix(good).pass).toBe(true);

    const allResults = validateCardStructure(good);
    expect(allResults.every((r) => r.pass)).toBe(true);
  });

  it('BAD initiative: generic title ("Poprawić X") without a metric → soft FAIL (§C1 anti-pattern)', () => {
    const bad = goodInitiative();
    bad.title = 'Poprawić marżę';
    const verdict = validateInitiativeCard(bad);
    expect(verdict.violationCodes).toContain('initiative.title_generic');
  });

  it('BAD initiative: missing KPI baseline/target/unit and missing RAID mix → hard FAILs surface via structural rules', () => {
    const bad = goodInitiative();
    delete (bad as any).kpis;
    bad.key_risks = [{ type: 'RISK', title: 'Only one risk' }]; // fails raid_mix (needs ≥2 RISK, ≥1 ASSUMPTION, ≥1 DEPENDENCY)
    const verdict = validateInitiativeCard(bad);
    expect(verdict.pass).toBe(false);
    expect(verdict.violationCodes).toContain('initiative.kpi_baseline_target');
    expect(verdict.violationCodes).toContain('initiative.raid_mix');
    const kpiViol = verdict.violations.find((v) => v.code === 'initiative.kpi_baseline_target')!;
    const raidViol = verdict.violations.find((v) => v.code === 'initiative.raid_mix')!;
    expect(kpiViol.severity).toBe('hard');
    expect(raidViol.severity).toBe('hard');
  });

  it('BAD initiative: filler placeholder in description → hard FAIL (§A6 no_filler)', () => {
    const bad = goodInitiative();
    bad.description = 'TBD — do uzupełnienia [placeholder]. Lorem ipsum dolor sit amet.';
    const verdict = validateInitiativeCard(bad);
    expect(verdict.pass).toBe(false);
    expect(verdict.violationCodes).toContain('initiative.no_filler');
  });
});

// ============================================================================
// O7.3 — Teresa persona / consulting tone (buildPersonaPrompt, PL + EN)
// ============================================================================
describe('O7.3 — Teresa persona prompt: PL/EN consulting tone is REALLY authored (not a phantom)', () => {
  it('PL persona prompt carries the BCG doctrine, Teresa identity, and Polish business register', () => {
    const prompt = buildPersonaPrompt(null, 'pl');
    expect(prompt).toContain('Jesteś Teresa');
    expect(prompt).toContain('DOKTRYNA BCG');
    expect(prompt).toContain('MECE');
    expect(prompt).toContain('Answer-first');
    expect(prompt).toContain('Komunikujesz się po polsku');
    expect(prompt).toContain('DYSCYPLINA ODPOWIEDZI');
    expect(prompt).toContain('ZACZNIJ OD ODPOWIEDZI (BLUF)');
    // Anti-chatbot-filler contract must be explicit, not implied.
    expect(prompt).toMatch(/świetne pytanie/);
  });

  it('EN persona prompt carries the equivalent English doctrine + response discipline', () => {
    const prompt = buildPersonaPrompt(null, 'en');
    expect(prompt).toContain('You are Teresa');
    expect(prompt).toContain('BCG DOCTRINE');
    expect(prompt).toContain('MECE');
    expect(prompt).toContain('Communicate in English');
    expect(prompt).toContain('RESPONSE DISCIPLINE');
    expect(prompt).toContain('ANSWER FIRST (BLUF)');
    expect(prompt).toMatch(/great question/);
  });

  it('default language (no explicit lang) is English, not Polish (i18n-teresa fix 2026-04-18 regression guard)', () => {
    expect(detectLanguage(undefined, undefined)).toBe('en');
    expect(detectLanguage(null, null)).toBe('en');
    // No 3rd arg -> buildPersonaPrompt itself also defaults unknown/absent lang to 'en'.
    const prompt = buildPersonaPrompt(null, undefined);
    expect(prompt).toContain('You are Teresa');
    expect(prompt).not.toContain('Jesteś Teresa');
  });

  it('screen emphasis overlays the base persona (assessment screen -> Strategic Consultant framing)', () => {
    const emphasis = getScreenEmphasis('assessment');
    expect(emphasis?.role).toBe('consultant');

    const withScreen = buildPersonaPrompt('assessment', 'en');
    const withoutScreen = buildPersonaPrompt(null, 'en');
    expect(withScreen).toContain('Strategic Consultant');
    expect(withScreen.length).toBeGreaterThan(withoutScreen.length);
  });

  it('O5.4 fix: screen-emphasis overlay is Polish when lang=pl, not silently English (all screens)', () => {
    // Regression guard: buildPersonaPrompt used to append emphasis.instructions
    // (always English) verbatim regardless of `lang`, so a PL conversation on
    // e.g. the assessment screen got an all-Polish persona EXCEPT the
    // "### Kontekst ekranu" block, which stayed in English. Every screen in
    // SCREEN_EMPHASIS must now carry a PL instructionsPl and the PL build must
    // surface it, not the English `instructions` string.
    for (const screen of Object.keys(getAvailableEmphases())) {
      const emphasis = getScreenEmphasis(screen)!;
      expect(emphasis.instructionsPl, `missing instructionsPl for screen "${screen}"`).toBeTruthy();

      const plPrompt = buildPersonaPrompt(screen, 'pl');
      expect(plPrompt, `PL prompt for "${screen}" should contain its Polish overlay`).toContain(
        emphasis.instructionsPl!
      );
      expect(
        plPrompt,
        `PL prompt for "${screen}" should NOT leak the English overlay text`
      ).not.toContain(emphasis.instructions);
    }

    // Spot-check: assessment screen names the consultant role in Polish, not English.
    const plAssessment = buildPersonaPrompt('assessment', 'pl');
    expect(plAssessment).toContain('Konsultant Strategiczny');
    expect(plAssessment).not.toContain('Strategic Consultant');
  });

  it('responseStyle option measurably changes the prompt (concise vs executive are distinct directives)', () => {
    const concise = buildPersonaPrompt(null, 'pl', { responseStyle: 'concise' });
    const executive = buildPersonaPrompt(null, 'pl', { responseStyle: 'executive' });
    const none = buildPersonaPrompt(null, 'pl');

    expect(concise).toContain('Tryb zwięzły');
    expect(executive).toContain('Tryb executive');
    expect(concise).not.toContain('Tryb executive');
    expect(none).not.toContain('STYL ODPOWIEDZI');
  });

  it('user free-text steering is threaded into the prompt at high priority, with the safety boundary intact', () => {
    const prompt = buildPersonaPrompt(null, 'pl', {
      customInstructions: 'Zawsze zaczynaj od pytania kontrolnego.',
    });
    expect(prompt).toContain('STEROWANIE UŻYTKOWNIKA');
    expect(prompt).toContain('Zawsze zaczynaj od pytania kontrolnego.');
    // The boundary clause (never fabricate / never fake execution) must still be present.
    expect(prompt).toMatch(/nie zmyślaj danych/);
  });

  it('the language instruction the persona itself asserts matches the requested language for both PL and EN', () => {
    const pl = buildPersonaPrompt(null, 'pl');
    const en = buildPersonaPrompt(null, 'en');
    // Response-discipline PL section is present only in the PL build, and vice
    // versa — proves the two languages are not accidentally sharing one prompt.
    expect(pl).toContain('konsultant MBA Harvard');
    expect(en).toContain('HBS-MBA consultant');
    expect(pl).not.toContain('HBS-MBA consultant');
    expect(en).not.toContain('konsultant MBA Harvard');
  });
});
