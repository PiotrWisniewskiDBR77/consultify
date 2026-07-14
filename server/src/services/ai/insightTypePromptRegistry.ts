/**
 * Insight per-type prompt registry (Z60 / #57).
 *
 * SSOT of content: `Harvard/wdrozenie-100/_FORMULA_TRESCI_INSIGHT_2026-07-13.md`
 * §3 — the McKinsey-grade "co KONKRETNIE ma nieść karta danego typu". This module
 * turns that doctrine into reusable prompt fragments so the V6 generation pipeline
 * (`InterviewInsightService.buildV6Prompt`) and its auto-repair pass produce content
 * with a real finding → so-what → evidence → implication four-beat per type.
 *
 * IMPORTANT — no new AI client, no schema change. The live V6 contract emits SIX
 * core fields (executive_summary, themes, issues, opportunities, signals,
 * evidence_map); the InsightViewer DERIVES the other seven ★ types from them
 * (themes → key-findings, issues+opportunities → recommendations, tension/
 * contradiction signals → tensions, cross-session findings → patterns, …). So the
 * highest-leverage lever is to make those six carry thesis-titles, quote-ready
 * evidence, measurable so-whats and correctly-typed signals. This registry injects
 * exactly that guidance (contract + widełki + wzorzec + anty-wzorzec) inline.
 *
 * Pure data + pure string builders — no I/O, safe to import anywhere.
 */

export type InsightFormulaSectionId =
  | 'executive-summary'
  | 'themes'
  | 'issues-risks'
  | 'opportunities'
  | 'consulting-readout'
  | 'key-findings'
  | 'recommendations'
  | 'signals'
  | 'tensions'
  | 'patterns'
  | 'mental-models'
  | 'power-dynamics'
  | 'evidence-map'
  | 'quote-comparison';

export interface InsightTypePromptSpec {
  /** Human label (PL) used in the injected guidance block. */
  label: string;
  /** Which live V6 field carries this type (or "derived" when computed in the viewer). */
  carrier: string;
  /** One-line contract: the four-beat + hard fields, from §3. */
  contract: string;
  /** Length / tone envelope (widełki), from §3. */
  envelope: string;
  /** ✅ WZORZEC — a compact McKinsey-grade example (few-shot) from §3. */
  wzorzec: string;
  /** ❌ ANTY-WZORZEC — how it fails + why (few-shot negative) from §3. */
  antiWzorzec: string;
}

/**
 * The 13 ★ priority types (brief #57) + evidence-map. Content lifted from §3 of
 * the formula doctrine — do NOT invent here; this is a faithful transcription.
 */
export const INSIGHT_TYPE_PROMPT_REGISTRY: Record<InsightFormulaSectionId, InsightTypePromptSpec> =
  {
    'executive-summary': {
      label: 'Executive Summary / Podsumowanie',
      carrier: 'executive_summary',
      contract:
        'Answer-first: pierwsze zdanie NIESIE konkluzję (teza, nie temat) → 3 najważniejsze so-what (policzalne) → poziom pewności (co pewne vs niepewne).',
      envelope:
        '60–130 słów, ≥3 zdania. Zero rozgrzewki („W trakcie rozmów…" = kasacja). Ton: zarząd czyta 20 s.',
      wzorzec:
        'Transformacja utknie na warstwie planowania, nie technologii: lead-time (~34 dni) napędza ręczny handoff, nie brak systemu. Trzy dźwignie: (1) jeden przepływ zleceń z SLA, (2) wspólny master danych, (3) COPQ na linii. Pewność wysoka co do lead-time (7/7), umiarkowana co do marży (brak baseline).',
      antiWzorzec:
        '„Podczas wywiadów zidentyfikowano szereg obszarów wymagających uwagi… istnieje potencjał do poprawy efektywności." — zero konkretu, zero so-what, frazes nie-falsyfikowalny; to streszczenie ROZMOWY, nie synteza WNIOSKU.',
    },
    themes: {
      label: 'Themes / Tematy',
      carrier: 'themes[]',
      contract:
        'Tytuł = action-title niosący tezę + so-what (≤14 słów, NIE goły temat). Opis = MECHANIZM (dlaczego), nie objaw. strength=strong ⇒ ≥2 evidence_refs. Nazwij rozjazd perspektyw w divergence_note.',
      envelope: '3–6 motywów; opis ≥50 słów; ≥1 evidence_ref; ton analityczny, mechanizm > objaw.',
      wzorzec:
        '„Planowanie żyje w głowach planistów, nie w systemie — skaluje ryzyko z każdym zakładem". Mechanizm: brak reguł priorytetyzacji w systemie → planista rozstrzyga ręcznie → wiedza niewymienialna. So-what: źródło rozjazdu OTIF Wrocław 91% vs Brno 78%. strength: strong · refs: [H3,H7,H12].',
      antiWzorzec:
        '„Planowanie produkcji" / „Planowanie jest wyzwaniem. Wymaga usprawnienia." — tytuł = TEMAT nie teza; opis bez mechanizmu i so-what; strength strong bez ani jednego evidence_ref (kłamstwo o sile).',
    },
    'issues-risks': {
      label: 'Issues & Risks / Problemy i ryzyka',
      carrier: 'issues[]',
      contract:
        'Nazwij ryzyko + jego KOSZT/skutek, nie tylko objaw. severity uzasadniona w opisie („dlaczego high" = blokuje inny value-driver / rząd wielkości). ≥1 evidence_ref.',
      envelope: '2–5; opis ≥40 słów; severity high wymaga skutku/kosztu w opisie.',
      wzorzec:
        '„Master danych rozjeżdża się Wrocław↔Drezno — blokuje wspólne zakupy". So-what: hamulec na 2–3 mln zł/rok potencjału (szacunek COO, do walidacji N5). severity: high (blokuje inny value-driver). refs: [H3,H9].',
      antiWzorzec:
        '„Problemy z danymi. Dane bywają niespójne. Severity: high." — tytuł generyczny; brak GDZIE/JAK; severity high bez uzasadnienia; brak so-what (co to KOSZTUJE).',
    },
    opportunities: {
      label: 'Opportunity Spaces / Szanse',
      carrier: 'opportunities[]',
      contract:
        'Szansa = konkretna zmiana + mierzalny cel + do jakiego value-drivera. Sygnalizuj impact/effort (quick-win vs strategiczne). Gdy brak sygnałów — jawnie „— Pominięto: brak sygnałów szansy".',
      envelope: '2–4 (gdy są); opis ≥40 słów; KAŻDA ma liczbę/cel LUB opt-out.',
      wzorzec:
        '„Triage zleceń S/M/L z SLA skróci medianę lead-time do ≤20 dni w 6 mies." 60% zleceń to powtarzalne „S". So-what: 34→≤20 dni odblokowuje ~5–8% sprzedaży (proxy: 3 przegrane przetargi Q2, H4). impact high, effort low.',
      antiWzorzec:
        '„Automatyzacja procesów da duże korzyści. Warto rozważyć AI." — kategoria, nie szansa; „duże korzyści" bez liczby; rozwiązanie w poszukiwaniu problemu; brak evidence_refs.',
    },
    'consulting-readout': {
      label: 'Consulting Readout / Odczyt konsultingowy',
      carrier: 'derived (content markdown + summary)',
      contract:
        'Łańcuch dowodowy w nagłówkach: Obserwacja → Mechanizm → Dowody → Wpływ → Rozjazdy → Rekomendacja. MECHANIZM (dlaczego tak się dzieje) jest obowiązkowy. Rekomendacja = SEKWENCJA, nie lista życzeń.',
      envelope: '350–700 słów; ton: partner na zarządzie — pewny, uczciwy co do niepewności.',
      wzorzec:
        'Obserwacja: dojrzały stack a OTIF 78–91%. Mechanizm: warstwa decyzyjna poza systemem. Dowody: 7/7 opisało prywatne arkusze. Wpływ: lead-time 34 dni, utrata 5–8% sprzedaży. Rozjazdy: IT=dyscyplina vs operacje=reguły. Rekomendacja: reguły → triage → master-data → dopiero narzędzia.',
      antiWzorzec:
        'Ściana tekstu bez nagłówków, „Mechanizm" powtarza „Obserwację", „Dowody" = „rozmówcy podkreślali", „Rekomendacja" = „usprawnić procesy i wdrożyć systemy" (brak sekwencji/priorytetu).',
    },
    'key-findings': {
      label: 'Key Findings / Kluczowe wnioski',
      carrier: 'derived (themes) — uczyń każdy motyw cytowalnym',
      contract:
        'KAŻDY finding = teza (action-title) + 2–4 zdania + min. 1 DOSŁOWNY cytat z atrybucją (H#/rola). Hierarchiczny: najważniejsze pierwsze. To „gdybyś miał zapamiętać 5 rzeczy".',
      envelope: '3–7; cytat dosłowny przy KAŻDEJ pozycji (EACH_ITEM).',
      wzorzec:
        'Teza: „Największym hamulcem jest warstwa planowania, nie brak technologii." Cytat: „Mój Excel wie więcej niż SAP. Bez niego stanęłaby produkcja." — planista, Wrocław (H7).',
      antiWzorzec:
        'Teza: „Firma stoi przed wyzwaniami cyfrowymi." Cytat: „Tak, mamy pewne wyzwania." (bez atrybucji) — teza generyczna; cytat nijaki i bez H#/roli.',
    },
    recommendations: {
      label: 'Recommendations / Rekomendacje',
      carrier: 'derived (opportunities + issues) — uczyń mierzalnymi i zsekwencjonowanymi',
      contract:
        'KAŻDA = imperatyw + mechanizm + spodziewany efekt MIERZALNY + horyzont. ZSEKWENCJONOWANE (co przed czym) i spójne 1:1 z Key Findings. Ton decyzyjny, nie doradczo-mglisty.',
      envelope: '3–6; ≥⅔ z efektem mierzalnym + horyzontem.',
      wzorzec:
        '1. Najpierw reguły, nie zakupy (0–1 mies.): skodyfikuj priorytetyzację w SAP. Efekt: lead-time 34→≤25 dni w 3 mies. BLOKUJE sens każdego nowego zakupu IT. 2. Triage S/M/L z SLA (1–3 mies.): wynika z 1. Efekt: ≤20 dni, +5–8% sprzedaży.',
      antiWzorzec:
        '„Rekomendujemy: usprawnić planowanie, poprawić dane, wdrożyć narzędzia, przeszkolić zespół, rozważyć AI." — lista wszystkiego bez priorytetu/sekwencji; zero efektów mierzalnych („consulting soup").',
    },
    signals: {
      label: 'Signals / Sygnały',
      carrier: 'signals[]',
      contract:
        '„To, co słychać między słowami". type DOPASOWANY do treści (tension|gap|contradiction|emerging_pattern). So-what: CO ten sygnał zepsuje. Sygnały tension/contradiction zasilają Napięcia; emerging_pattern zasila Wzorce.',
      envelope: '1–4; opis ≥25 słów; type trafny (nie losowy).',
      wzorzec:
        'type: contradiction · „Zarząd chce centralizacji, zakłady bronią autonomii — cel programu nie jest uzgodniony". So-what: sprzeczność celu wykolei każdą inicjatywę centralizacyjną, jeśli nie rozstrzygnięta na starcie.',
      antiWzorzec:
        'type: emerging_pattern · „Ludzie chcą, żeby było lepiej." — banał; type przypięty losowo (nic się nie „wyłania"); zero so-what.',
    },
    tensions: {
      label: 'Tensions / Napięcia',
      carrier: 'derived (signals tension/contradiction) — nazwij trade-off dwustronnie',
      contract:
        'A vs B, OBA uprawnione, dowód po OBU stronach (H#), + dlaczego to napięcie jest groźne/produktywne. Nie „kto ma rację" — „na czym polega trade-off". Napięcie = TRWAŁY trade-off (≠ problem do naprawy).',
      envelope: '2–4; obie strony z evidence; so-what obecny.',
      wzorzec:
        'Standaryzacja globalna ⟷ Elastyczność lokalna. A (COO, H3): „bez wspólnych procesów nie ma skali". B (Kier. Brno, H12): „elastyczność to nasza przewaga". So-what: program musi jawnie rozstrzygnąć GDZIE standaryzujemy a gdzie zostawiamy autonomię.',
      antiWzorzec:
        '„Napięcie: dobrzy vs źli pracownicy" / jedna strona ma dowód, druga nie — fałszywa dychotomia; napięcie bez dowodu po obu stronach to opinia.',
    },
    patterns: {
      label: 'Patterns / Wzorce',
      carrier: 'derived (cross-session findings + emerging_pattern) — oznacz zasięg',
      contract:
        'Powtarzalność w ≥2 NIEZALEŻNYCH źródłach + wspólny mechanizm + dlaczego powtarzalność znaczy więcej niż pojedynczy głos → predykcja. „To nie anegdota, to struktura". Oznaczaj cross_session_pattern + zasięg.',
      envelope: '2–5; zasięg ≥2 źródła/sesje jawnie podany.',
      wzorzec:
        '„Rozwiązanie w poszukiwaniu problemu" powtarza się w 3 zakładach niezależnie (MES/BI/RPA, użycie <30%). Mechanizm: zakup napędzany dostawcą, nie potrzebą. Zasięg 3/3, 5 respondentów. So-what: kolejny „zakup AI" podzieli ten los.',
      antiWzorzec:
        '„Wzorzec: ludzie narzekają na IT" — jedno źródło rozdmuchane do „wzorca"; brak zasięgu; nie da się odróżnić struktury od anegdoty.',
    },
    'mental-models': {
      label: 'Mental Models / Modele myślowe',
      carrier: 'derived (analysis lenses)',
      contract:
        'Niewypowiedziane założenie „jak działa świat" + KTO je trzyma (held_by) + implikacja dla programu. Ton antropologiczny — opisujesz cudzą mapę, nie oceniasz. Ugruntowane cytatem.',
      envelope: '2–4; held_by niepusty ∧ implikacja obecna.',
      wzorzec:
        'Model: „Cyfryzacja = kupić system" (held_by: zarząd, dyr. IT). Implikacja: dopóki decydenci utożsamiają transformację z zakupem, warstwa procesowa będzie niedofinansowana — program musi PRZEDEFINIOWAĆ transformację, zanim poprosi o budżet.',
      antiWzorzec:
        '„Model: pracownicy boją się zmian." — stereotyp, nie model tego klienta; brak held_by; brak implikacji dla programu.',
    },
    'power-dynamics': {
      label: 'Power Dynamics / Dynamika władzy',
      carrier: 'derived (analysis lenses)',
      contract:
        'Relacja władzy REALNEJ, nie formalnej (kto NAPRAWDĘ przesuwa/blokuje decyzje) + stance (za/przeciw/neutralny) + implikacja dla sponsora (ruch). Mapa polityczna bez oceny moralnej.',
      envelope: '3–6 aktorów/relacji; każdy: stance + implikacja.',
      wzorzec:
        'Aktor: Kier. Brno · Wpływ: wysoki NIEFORMALNY (staż, zaufanie CEO, de-facto weto). Postawa: obronna wobec centralizacji. Implikacja: bez pozyskania Brna jako sojusznika program ugrzęźnie — sponsor: zaadresować przed kick-offem.',
      antiWzorzec:
        '„Zarząd ma władzę decyzyjną. Pracownicy wykonują polecenia." — schemat organigramu, nie dynamika (kto realnie blokuje/napędza); zero implikacji.',
    },
    'evidence-map': {
      label: 'Evidence Map / Mapa dowodów',
      carrier: 'evidence_map[]',
      contract:
        'Warstwa audytu: łączy każdą tezę z surowym źródłem. snippet DOSŁOWNY (≤120 zn.), BEZ parafrazy analityka. ≥1 wpis na każdy użyty evidence_ref. linked_themes/linked_issues wypełnione.',
      envelope: 'cel ≥4 wpisy; answer_snippet ≤120 zn., wierny głosowi.',
      wzorzec:
        'answer_id: H7 · pytanie: „Jak powstaje harmonogram?" · snippet: „Robię go w swoim Excelu rano, SAP dostaje to po fakcie." · linked_themes: [„Planowanie żyje w głowach"].',
      antiWzorzec:
        'snippet: „Respondent opisał proces planowania jako suboptymalny." — to PARAFRAZA analityka, nie głos źródła; łamie wierność cytatu.',
    },
    'quote-comparison': {
      label: 'Quote Comparison / Porównanie cytatów',
      carrier: 'derived (evidence_map + roles)',
      contract:
        'Oś/temat + ≥2 cytaty DOSŁOWNE z RÓŻNYCH ról na TEN SAM temat + so-what kontrastu. Pokaż rozjazd GŁOSAMI, nie opisem. Najsilniejszy dowód divergencji.',
      envelope: '1–3 osie; per oś ≥2 głosy z atrybucją; cytaty dosłowne.',
      wzorzec:
        'Oś „Kto jest właścicielem lead-time?": COO (H3): „to odpowiedzialność produkcji"; Kier. prod. (H6): „lead-time robi sprzedaż"; Sprzedaż (H4): „dajemy terminy, bo produkcja nie mówi realnego". So-what: nikt nie jest właścicielem — pierwszy ruch to PRZYPISANIE właścicielstwa.',
      antiWzorzec:
        'Dwa cytaty mówiące to samo podane jako „porównanie" / cytaty parafrazowane / brak so-what — porównanie bez kontrastu nie jest porównaniem.',
    },
  };

/** The 13 ★ priority ids (brief #57) — bramka jakości aktywna dla nich. */
export const INSIGHT_PRIORITY_TYPE_IDS: InsightFormulaSectionId[] = [
  'executive-summary',
  'themes',
  'issues-risks',
  'opportunities',
  'consulting-readout',
  'key-findings',
  'recommendations',
  'signals',
  'tensions',
  'patterns',
  'mental-models',
  'power-dynamics',
  'quote-comparison',
];

/**
 * Compose the per-type guidance block injected into the V6 generation prompt.
 * Renders the ★ priority types with contract + widełki + ✅ wzorzec + ❌ anty-wzorzec,
 * plus the derivation map so the model knows the six emitted fields must be
 * quote-ready / measurable / correctly-typed to feed the derived types.
 */
export function buildInsightTypeGuidanceBlock(
  ids: InsightFormulaSectionId[] = INSIGHT_PRIORITY_TYPE_IDS
): string {
  const blocks = ids
    .map((id) => INSIGHT_TYPE_PROMPT_REGISTRY[id])
    .filter(Boolean)
    .map(
      (s) =>
        `### ${s.label}  (nośnik: ${s.carrier})\n` +
        `- Kontrakt: ${s.contract}\n` +
        `- Widełki/ton: ${s.envelope}\n` +
        `- ✅ WZORZEC: ${s.wzorzec}\n` +
        `- ❌ ANTY-WZORZEC (NIE rób tak): ${s.antiWzorzec}`
    )
    .join('\n\n');

  return [
    'FORMUŁA TREŚCI PER TYP (McKinsey-grade — SSOT: _FORMULA_TRESCI_INSIGHT §3).',
    'Każdy element karty niesie CZTEROTAKT: FINDING → SO-WHAT → EVIDENCE → IMPLICATION.',
    'Test „czy to insight": jeśli element da się skwitować „no i co z tego?" — jest niegotowy.',
    '',
    'MAPA ZASILANIA (te sześć pól karty ZASILAJĄ pochodne sekcje — dbaj o jakość u źródła):',
    '- themes → Key Findings (każdy motyw musi być CYTOWALNY: dosłowny cytat + H#/rola),',
    '- issues + opportunities → Recommendations (mierzalny efekt + horyzont + SEKWENCJA),',
    '- signals(tension|contradiction) → Tensions (dowód po OBU stronach trade-offu),',
    '- signals(emerging_pattern) + cross_session_pattern → Patterns (zasięg ≥2 niezależne źródła),',
    '- evidence_map → Quote Comparison / Evidence Map (snippet DOSŁOWNY ≤120 zn., zero parafrazy).',
    '',
    blocks,
  ].join('\n');
}

/**
 * Map validator violation codes → targeted PL repair hints (few-shot-lite), so the
 * auto-repair pass fixes the SPECIFIC per-type weakness rather than regenerating
 * blindly. Falls back to the generic repair brief when a code has no hint.
 */
const REPAIR_HINTS: Record<string, string> = {
  'insight.title_is_thesis':
    'Zamień tytuły-tematy na action-title z czasownikiem/relacją (np. „X wydłuża Y", „A ⟷ B"), nie gołe rzeczowniki.',
  'insight.summary_sowhat':
    'Dodaj do podsumowania konkretną liczbę LUB value-driver (lead-time/OTIF/marża/koszt) — bez tego to trivia.',
  'insight.theme_strength_grounded':
    'Motyw o strength="strong" musi mieć ≥2 evidence_refs; albo dołóż drugie źródło, albo obniż strength.',
  'insight.issue_severity_justified':
    'Przy severity="high" nazwij KOSZT/skutek w opisie (rząd wielkości, zablokowany value-driver) — inaczej obniż severity.',
  'insight.opp_measurable':
    'Każda szansa: mierzalny cel/liczba + do jakiego value-drivera; gdy brak sygnałów — „— Pominięto: brak sygnałów szansy".',
  'insight.signal_type_valid':
    'Dopasuj type sygnału do treści: tension|gap|contradiction|emerging_pattern; usuń sygnały-banały bez so-what.',
  'insight.signal_desc_len': 'Rozwiń opis sygnału do ≥25 słów — nazwij, CO ten sygnał zepsuje.',
  'insight.snippet_verbatim':
    'answer_snippet ma być DOSŁOWNYM głosem respondenta (≤120 zn.), nie parafrazą („Respondent opisał…" = FAIL).',
  'insight.finding_quote':
    'Przy każdym kluczowym wniosku dołóż dosłowny cytat z atrybucją H#/rola (EACH_ITEM).',
  'insight.quote_attribution': 'Każdy cytat w banku musi mieć H#/rolę.',
  'insight.reco_measurable':
    'Każda rekomendacja: mierzalny efekt + horyzont (mies./kwartał) + sekwencja (co przed czym).',
  'insight.readout_sections':
    'Ustrukturyzuj readout w nagłówki: Obserwacja → Mechanizm → Dowody → Wpływ → Rozjazdy → Rekomendacja.',
  'insight.tension_two_sided':
    'Napięcie musi mieć dowód po OBU stronach (A vs B, każda z H#) + so-what trade-offu.',
  'insight.pattern_multisource':
    'Wzorzec wymaga zasięgu ≥2 niezależne źródła/sesje — podaj zasięg jawnie.',
  'insight.model_heldby': 'Model myślowy: podaj held_by (kto trzyma) + implikację dla programu.',
  'insight.power_implication':
    'Dynamika władzy: podaj stance (za/przeciw) + implikację dla sponsora (konkretny ruch).',
  'insight.qc_multivoice':
    'Porównanie cytatów: ≥2 dosłowne cytaty z RÓŻNYCH ról na jedną oś + so-what kontrastu.',
};

/** Build a compact per-code hint block for the repair prompt from violation codes. */
export function buildInsightRepairHints(violationCodes: string[]): string {
  const seen = new Set<string>();
  const lines = violationCodes
    .filter((code) => {
      if (seen.has(code)) return false;
      seen.add(code);
      return Boolean(REPAIR_HINTS[code]);
    })
    .map((code) => `- [${code}] ${REPAIR_HINTS[code]}`);
  return lines.length > 0 ? `Wskazówki naprawcze per typ (§3 formuły):\n${lines.join('\n')}` : '';
}
