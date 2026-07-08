export const meta = {
  name: 'panel-adwersaryjny',
  description: 'Reużywalny harness testowy: adwersaryjny panel BCG N-obiektywów ocenia bundle modułu → każdy finding weryfikowany przez osobnego sceptyka (obalanie) → synteza score+werdykt+naprawy. System z metodyki 12 narzędzi Harvard.',
  phases: [
    { title: 'Panel', detail: '5 obiektywów adwersaryjnych czyta bundle, punktuje /100 + findingi' },
    { title: 'Weryfikacja', detail: 'każdy finding: osobny sceptyk próbuje OBALIĆ (default refuted jeśli niepewne)' },
    { title: 'Synteza', detail: 'agregacja score + potwierdzone findingi + werdykt + 3 naprawy' },
  ],
}

// Odporność na niespójną serializację: args bywa OBIEKTEM albo STRINGIEM JSON — obsłuż oba.
let ARGS = args
if (typeof ARGS === 'string') { try { ARGS = JSON.parse(ARGS) } catch (e) { ARGS = {} } }
ARGS = ARGS || {}
const BP = ARGS.bundlePath
const CTX = ARGS.context || ''
const PREV = ARGS.prevScore ?? null

// Twardy guard: bez realnego bundla obiektywy dostają "undefined" i produkują fałszywe zera (0/40).
if (!BP || typeof BP !== 'string') {
  throw new Error(`panel-adwersaryjny: brak args.bundlePath (dostałem typ ${typeof args}: ${JSON.stringify(args)?.slice(0,120)}). Przekaż absolutną ścieżkę do bundla.`)
}

// Dobór modeli wg trudności obiektywu (bez Fable): opus na analityczne/liczbowe
// (rygor, logika, model_finansowy), sonnet na lżejsze (kompletność, prezentacja).
const LENSES = [
  { key: 'kompletnosc', title: 'KOMPLETNOŚĆ / MECE', model: 'claude-sonnet-5', focus: 'luki pokrycia: czy każda z 6 inicjatyw ma komplet KPI+benefit+ROI+link? Czy finanse mają komplet (P&L+CF+BS+finansowanie+downside)? Braki MECE, martwe/osierocone rekordy, brakujące metryki krytyczne (burn/runway/D-E/kowenanty).' },
  { key: 'rygor', title: 'RYGOR / GROUNDING', model: 'claude-opus-4-8', focus: 'przelicz KAŻDĄ tożsamość księgową z surowych liczb: gross−opex=EBITDA, assets=liab+equity, cash rollforward=CF, NPV odtwarzalne z fcf+exit. Które liczby zmyślone/nieuziemione? Czy ROI netuje opex? Czy marże obronne? Czy MOIC ma poprawny mianownik/net-cash bridge?' },
  { key: 'logika', title: 'LOGIKA / CROSS-RECORD', model: 'claude-opus-4-8', focus: 'sprzeczności MIĘDZY rekordami: czy suma links=drawdown=CF financing? Czy mostek base+uplift=P&L target? Czy ARR składniki sumują się bez podwójnego liczenia? Czy reconciliacje mają poprawną, nieskopiowaną semantykę? Czy status reconciled/disputed jest spójny z deviation?' },
  { key: 'prezentacja', title: 'PREZENTACJA / BOARD-READY', model: 'claude-sonnet-5', focus: 'czy answer-first (ile wkładam/co dostaję/kiedy zwrot)? Czy teza zwrotu mocna i wiarygodna? Czy reconciliation nie straszy/nie kłamie? Czy wrażliwość i downside pokazane? Fałszywa precyzja? Co dzieli od gotowe-przed-zarząd?' },
  { key: 'model_finansowy', title: 'WALIDACJA MODELU FINANSOWEGO', model: 'claude-opus-4-8', focus: 'jak analityk M&A: czy wycena (multiple exitu, WACC, terminal value) jest obroniona komparablami? Czy klasyfikacja instrumentów (RBF equity vs dług) konsekwentna i wpływa na gearing? Czy J-curve/tarcza podatkowa/kowenanty uwzględnione? Czy raise-size uzasadniony vs burn? Gdzie model jest zbyt optymistyczny lub zbyt surowy dla siebie?' },
]

const REVIEW_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['score', 'findings'],
  properties: {
    score: { type: 'integer', minimum: 0, maximum: 100 },
    findings: { type: 'array', maxItems: 5, items: {
      type: 'object', additionalProperties: false,
      required: ['severity', 'claim', 'evidence', 'fix'],
      properties: {
        severity: { type: 'string', enum: ['krytyczna', 'wysoka', 'srednia', 'niska'] },
        claim: { type: 'string' },
        evidence: { type: 'string' },
        fix: { type: 'string' },
      },
    } },
  },
}
const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['real', 'reason'],
  properties: { real: { type: 'boolean' }, reason: { type: 'string' } },
}

phase('Panel')
const reviews = await parallel(LENSES.map(l => () =>
  agent(
    `Jesteś partnerem BCG. Obiektyw: ${l.title}. Adwersaryjnie, bez taryfy ulgowej, ale RZETELNIE. Użyj narzędzia Read na pliku: ${BP}\n\nKONTEKST: ${CTX}\n\nSKUP SIĘ NA: ${l.focus}\n\n` +
    `TWARDE ZASADY (inaczej ocena nieważna):\n` +
    `1. Oceniasz WYŁĄCZNIE pola realnie obecne w bundle. KAŻDY finding musi cytować konkretną ścieżkę/wartość z pliku (np. valuation.assumptions.fcf, statements FY2028). ZAKAZ wymyślania pól/właścicieli/kolumn których nie ma (żadnych 'TOPLINE', 'owner 3_DELIVERY' itp.) — taki finding = dyskwalifikacja.\n` +
    `2. Przelicz zanim oskarżysz. Jeśli liczby się zgadzają — to nie finding.\n` +
    `3. Świadomie oznaczone założenie (status 'disputed' z notą + requires_evidence) to DOJRZAŁOŚĆ, nie wada — nie karz go jak błędu; co najwyżej finding 'niska'.\n` +
    `4. Dla PREZENTACJI: materiał to backbone DANYCH + warstwa answer-first w valuation.advisory (board_summary, the_ask, waterfall, sensitivity, downside_bear). Oceniaj czytelność/wiarygodność TYCH pól — NIE oczekuj slajdów PPT ani grafiki.\n` +
    `KALIBRACJA WYNIKU: 90-100 = spójne, tylko drobne (niska) findingi; 75-89 = kilka średnich; 60-74 = min. jeden wysoki realny; <60 = krytyczny realny. Wynik odzwierciedla WAGĘ realnych, policzalnych wad — nie liczbę opinii.\n\n` +
    `Zwróć wynik /100 (twardo, wg kalibracji) + max 5 findingów (most-severe-first), każdy: severity + claim (jedno zdanie) + evidence (konkretna ścieżka+liczba z bundle) + fix.`,
    { label: `panel:${l.key}`, phase: 'Panel', schema: REVIEW_SCHEMA, model: l.model }
  ).then(r => (r && typeof r.score === 'number' && Array.isArray(r.findings)) ? { ...r, lens: l.key } : null).catch(() => null)
))
// Odporność: agent rate-limited/padły → null; licz tylko realne oceny, nie wywalaj przebiegu.
const ok = reviews.filter(r => r && typeof r.score === 'number' && Array.isArray(r.findings))
const failedLenses = LENSES.filter((l, i) => !reviews[i] || typeof reviews[i]?.score !== 'number').map(l => l.key)
const avgRaw = ok.length ? Math.round(ok.reduce((a, r) => a + r.score, 0) / ok.length) : 0
log(`Panel: ${ok.length}/${LENSES.length} obiektywów${failedLenses.length ? ' (padły: ' + failedLenses.join(', ') + ')' : ''}. Średnia surowa ${avgRaw}/100. Findingów łącznie: ${ok.reduce((a,r)=>a+(r.findings||[]).length,0)}`)

phase('Weryfikacja')
const flat = ok.flatMap(r => (r.findings || []).map(f => ({ ...f, lens: r.lens })))
const verified = await parallel(flat.map(f => () =>
  agent(
    `Jesteś niezależnym sceptykiem-audytorem. Twoim zadaniem jest OBALIĆ poniższy zarzut, nie potwierdzić. Użyj Read na: ${BP}\n\nZARZUT (${f.lens}, ${f.severity}): ${f.claim}\nDOWÓD ZARZUTU: ${f.evidence}\n\nPrzelicz/sprawdź z surowych liczb w bundle. Czy zarzut jest REALNY (faktyczny błąd/luka/sprzeczność), czy da się go obalić (zarzut myli się, liczby jednak grają, albo to kwestia sądu bez błędu)? Domyślnie real=false jeśli niepewne lub to tylko opinia. real=true tylko gdy potwierdzisz twardy problem.`,
    { label: `verify:${f.lens}`, phase: 'Weryfikacja', schema: VERDICT_SCHEMA, model: 'claude-sonnet-5' }
  ).then(v => ({ ...f, verdict: v })).catch(() => null)
))
const vok = verified.filter(Boolean)
const confirmed = vok.filter(f => f.verdict?.real)
const rank = { krytyczna: 0, wysoka: 1, srednia: 2, niska: 3 }
confirmed.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9))
log(`Weryfikacja: ${confirmed.length}/${flat.length} findingów POTWIERDZONYCH (reszta obalona jako niepewne/opinie).`)

phase('Synteza')
const synth = await agent(
  `Jesteś prowadzącym partnerem panelu. PO POLSKU, zwięźle. Kontekst: ${CTX}\n` +
  `Średnia panelu: ${avgRaw}/100 (poprzednio: ${PREV ?? 'brak'}). Wyniki per obiektyw: ${ok.map(r => r.lens + ' ' + r.score).join(', ')}.\n` +
  `POTWIERDZONE findingi (po adwersaryjnej weryfikacji, ${confirmed.length}): ${JSON.stringify(confirmed.map(f => ({ sev: f.severity, lens: f.lens, claim: f.claim, fix: f.fix })))}\n\n` +
  `Wydaj: (1) WERDYKT jednym zdaniem (gotowe przed zarząd / dopracować / szkielet), (2) 3 NAJPILNIEJSZE naprawy (konkretne, z liczbami), (3) jedno zdanie: czy to postęp vs poprzedni wynik i co jest realną granicą jakości.`,
  { label: 'synteza', phase: 'Synteza' }
)

return {
  srednia: avgRaw,
  poprzednio: PREV,
  wyniki: ok.map(r => ({ obiektyw: r.lens, wynik: r.score })),
  obiektywy_padly: failedLenses,
  findingow_zgloszonych: flat.length,
  findingow_potwierdzonych: confirmed.length,
  potwierdzone: confirmed.map(f => ({ severity: f.severity, lens: f.lens, claim: f.claim, fix: f.fix })),
  synteza: synth,
}
