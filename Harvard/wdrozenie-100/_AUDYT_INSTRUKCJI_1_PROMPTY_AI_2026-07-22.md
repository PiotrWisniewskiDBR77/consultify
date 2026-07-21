# AUDYT INSTRUKCJI · KORPUS 1: PROMPTY AI PISZĄCE TREŚĆ DLA KLIENTA

**Data:** 2026-07-22 · **Gałąź:** `fix/prv-mywork-preview` (worktree `.worktrees/prv-mywork`, baza `origin/demo`)
**Pytanie:** czy prompty są na poziomie BCG i najlepszych konsultantów.
**Charakter:** audyt. Zero zmian w plikach źródłowych. Produktem jest ocena z cytatami.

---

## 1. WERDYKT (answer-first)

**Ocena: 7/10. Górna warstwa promptów jest realnie na poziomie BCG — problem nie w jakości, tylko w ROZRZUCIE.**

Consultify ma ~6 promptów, które bez wstydu pokazałbym partnerowi w BCG (doktryna inicjatyw, slajd Wniosków, doktryna Insightów, persona Teresy, prompty konkluzji narzędzi Discovery, reguły ugruntowania). Ma jednocześnie ~76 promptów sterujących Mind Mapą, Whiteboardem, Process Flow i Tabelą, które są jednozdaniowe i nie zawierają ŻADNEJ z ośmiu reguł — a to są artefakty, które konsultant pokazuje na ekranie przy kliencie.

Trzy konsekwencje dla decyzji:

1. **Ryzyko nie jest równomierne.** Ekran „Wnioski" w decku i karta inicjatywy są bezpieczne. Mapa myśli, whiteboard i tabela wygenerowane z czatu — nie są.
2. **Doktryna istnieje, ale jest kopiowana, nie współdzielona.** Ta sama lista 8 reguł żyje w ≥4 niezależnych kopiach. Poprawka jakości wymaga dziś 4+ edycji zamiast jednej.
3. **Najsłabsze kryterium to nie jakość pisania, tylko ODBIORCA.** W ścieżce deliverables pole `audience` jest zbierane od użytkownika i nigdy nie trafia do promptu.

Poziom „gotowe do klienta" osiąga dziś ok. **1/3 korpusu**. Reszta nie jest zła — jest neutralna, czyli produkuje tekst, który brzmi jak dobry chatbot, a nie jak konsultant.

---

## 2. INWENTARZ (co realnie istnieje)

Pomiar na `server/src/` + `src/`, z wyłączeniem `_backup/` i testów:

| Miara | Wartość |
|---|---|
| Pliki zawierające prompt (`You are` / `Jesteś`) | **179** (103 server + 76 frontend) |
| Wystąpienia otwarć promptu | **524** (325 server + 199 frontend) |
| Pliki wspominające answer-first / Minto / BLUF | **72** |
| Pliki wspominające MECE | 44 |
| Pliki wspominające falsyfikowalność | 42 |
| Pliki z listą anty-wzorców (`FORBIDDEN`/`ZABRONIONE`/`Anti-patterns`) | 37 |
| **Prompty z przykładem few-shot (ŹLE/DOBRZE)** | **2** |

### Dwa rejestry — nie mylić

- `src/hooks/discovery/toolAi/promptRegistry.ts` — **realny mózg** promptów narzędzi (1570 linii, wołany przez `useToolAI`).
- `server/src/ai/promptRegistry.ts` — **indeks meta**, nie zawiera treści promptów. Sam się do tego przyznaje w linii 1-3:
  > „to NIE jest mózg promptów narzędzi. Prompty per-tool żyją w `src/hooks/discovery/toolAi/promptRegistry.ts`" — `server/src/ai/promptRegistry.ts:1`

### Główne rodziny promptów (wg zasięgu)

| Rodzina | Plik | Zasięg |
|---|---|---|
| Persona Teresy (czat) | `server/src/ai/persona.ts` (52 KB) | każda rozmowa z Teresą |
| Systemowe narzędzi Discovery | `src/hooks/discovery/toolAi/systemPrompts.ts` | 31 typów narzędzi |
| Konkluzje narzędzi | `src/config/*/conclusionPrompts.ts` | 19 narzędzi |
| Reguły ugruntowania | `src/hooks/discovery/toolAi/groundingRules.ts` | 33 pliki importują |
| Doktryna inicjatyw | `server/src/services/initiativeGenerationService.ts` | karty inicjatyw |
| Doktryna Insightów | `server/src/services/InterviewInsightService.ts` | wszystkie insighty z wywiadów |
| Deck — slajd Wniosków | `server/src/services/deliverables/deckConclusionSlide.ts` | prezentacje |
| Dokument / arkusz | `server/src/services/deliverables/docGenerationRuntime.ts` | Word, Excel |
| Dokument (drugi silnik) | `server/src/services/documentStudio/documentBlockProseGenerator.ts` | Document Studio |
| **Mind Map / Whiteboard / Flow / Tabela** | `server/src/services/ideaAIGeneratorService.ts` | **76 promptów** |
| Mind Map / Flow / Notatka (czat) | `server/src/services/ai/canvasGraphLlm.ts` | Teresa → artefakt |

---

## 3. OCENA 8 NAJWAŻNIEJSZYCH PROMPTÓW

Legenda: **✅ SPEŁNIA** · **⚠️ CZĘŚCIOWO** · **❌ NIE SPEŁNIA** · **— NIE DOTYCZY**

| # | Prompt | 1 Answer-first | 2 MECE | 3 Liczby | 4 Tak-więc | 5 Ugrunt. | 6 Falsyf. | 7 Hipoteza | 8 Odbiorca |
|---|---|---|---|---|---|---|---|---|---|
| A | Doktryna inicjatyw | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| B | Slajd Wniosków (deck) | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ❌ | ✅ |
| C | Doktryna Insightów | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| D | Persona Teresy | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| E | Konkluzje narzędzi (SOP) | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠️ |
| F | Sekcja dokumentu | ✅ | ❌ | ✅ | ⚠️ | ✅ | ❌ | ❌ | ❌ |
| G | Systemowy „operacyjny" (20/31 narzędzi) | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| H | Generatory Idea Map (76 promptów) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

### A. Doktryna inicjatyw — `server/src/services/initiativeGenerationService.ts:233`

**Najlepszy prompt w repo.** Jedyny, który realizuje wszystkie osiem kryteriów jednocześnie i jako jeden z dwóch w całym korpusie podaje przykład few-shot.

> „5. QUANTIFICATION WITH EXPLICIT ASSUMPTION: every number cites a source OR is tagged "estimate: [assumption]" + horizon (currency/%/days/units). Never bare numbers.
> ⛔ HARD BAN in GOALS, KPIs, ROI, success criteria and costs: the phrases "to be determined" / "TBD" / "to be defined" as the VALUE of a goal/baseline/target. **A goal without a number = non-falsifiable = FAIL.**
> INSTEAD always give an ESTIMATE WITH AN EXPLICIT ASSUMPTION in the form: "[number+unit] (estimate; assuming [concrete assumption])". **BAD: "reduce by TBD %". GOOD: "reduce by 15% (estimate; assuming elimination of 3 of 8 monthly outages)".**"
> — `server/src/services/initiativeGenerationService.ts:242-244`

Czego brakuje większości promptów, a ten ma:

> „10. MARKET ANCHORS ONLY WITH A SOURCE (grounding): (…) ⛔ NO FABRICATED ATTRIBUTION: do not write "according to Gartner", "per IDC", "a McKinsey report states", nor cite specific market amounts (e.g. "€3.2B market") without certainty of the source. A fabricated anchor with a fake source = FAIL."
> — `server/src/services/initiativeGenerationService.ts:250`

Ma też regułę, której nie widziałem w żadnym innym prompcie w repo — spójność liczbowa:

> „9. NUMBER CONSISTENCY (one value per metric): for EVERY metric (CAC, ARR, revenue, growth %, customer count, cost, ROI, payback) use EXACTLY ONE value OR one range across the WHOLE card. (…) Compute once and stick to one number."
> — `server/src/services/initiativeGenerationService.ts:249`

**Brak (kryterium 8):** definiuje próg („a document the owner will SIGN in front of the client without edits", linia 235), ale nie mówi, KTO konkretnie czyta i jaką decyzję podejmuje. „Klient" to nie odbiorca — zarząd, komitet inwestycyjny i kierownik operacyjny czytają inaczej.

---

### B. Slajd Wniosków w decku — `server/src/services/deliverables/deckConclusionSlide.ts:413`

Najlepiej „domknięty" prompt w korpusie: powołuje się na standard, zamyka ugruntowanie i wymusza formułę K1→K4 z rolą i horyzontem.

> „ZASADY TWARDE:
> - Liczby WYŁĄCZNIE z "facts" — nie licz, nie szacuj, nie przywołuj statystyk spoza wsadu. Każda liczba w tekście MUSI występować w "facts".
> - **Grounding zamknięty: tylko "facts". Nic więcej. Zakaz „badań branżowych".**
> - K1 CO JEST: fakty/liczby ze silnika. K2 CO TO ZNACZY: konsekwencja biznesowa, każda teza oparta o fakt. K3 CO ROBIĆ: maks. 3 akcje, każda = czasownik + przedmiot + rola odpowiedzialna + dlaczego akurat teraz. K4 EFEKT: rezultat z HORYZONTEM czasowym.
> - Zakaz ogólników pasujących do każdej firmy. Answer-first."
> — `server/src/services/deliverables/deckConclusionSlide.ts:423-429`

Rzadka i dobra decyzja: kontrakt wyjścia zawiera `"confidence": "high"|"medium"|"low"|"insufficient"`. Model ma jawną drogę powiedzieć „za mało danych" zamiast konfabulować (linia 429).

Standard, na który się powołuje, **istnieje** — `docs/standards/CONCLUSION_LAYER_STANDARD.md` (20 578 B). To nie jest dokument-widmo.

**Brak:** MECE nie jest nazwane (K3 „maks. 3 akcje" to limit, nie rozłączność). Falsyfikowalność nienazwana wprost.

---

### C. Doktryna Insightów — `server/src/services/InterviewInsightService.ts:501`

Najlepiej sformułowana lista 8 reguł w repo — i jedyna, która dokłada kontrakt dowodowy na poziomie pojedynczego ustalenia.

> „BCG-GRADE DOCTRINE (hard rules — a deliverable that breaks these is a FAIL):
> 1. Answer-first / Pyramid Principle — lead every finding with the conclusion, then the evidence.
> 2. MECE — themes, issues and opportunities are mutually exclusive and collectively exhaustive; no overlap.
> 3. Quantify with an explicit assumption — every number carries a source OR an "estimate: [assumption]" tag; never bare numbers. (…)
> 6. Falsifiability — phrase theses testably ("If X, then Y, because Z"), not wishfully."
> — `server/src/services/InterviewInsightService.ts:501-509`

Kontrakt dowodowy — element, którego brakuje wszystkim innym promptom:

> „- Each finding MUST carry: a confidence_level (…), limits[] (what would break it), and evidence_refs[] (answer_ids).
> - "high" confidence requires triangulation: 2+ evidence pointers from different sources/segments with no contradictions. Otherwise cap at "medium" or lower.
> - Prefer "A correlates with B in this context" over "A causes B" unless confidence is high with explicit evidence."
> — `server/src/services/InterviewInsightService.ts:512-515`

`limits[]` = „co by ten wniosek obaliło". To dokładnie kryterium 6, zaimplementowane jako pole danych, nie jako prośba w prozie. Najmocniejszy pojedynczy element w całym korpusie.

Odbiorca zdefiniowany per sekcja:

> „- Executive Summary: 1 C-level page, BLUF. 3-5 findings, each one answer-first sentence + its implication. No methodology."
> — `server/src/services/InterviewInsightService.ts:518`

Doktryna jest wstrzykiwana automatycznie do wszystkich szablonów, nie ręcznie — `InterviewInsightService.ts:729-737`. Dobra mechanika.

---

### D. Persona Teresy — `server/src/ai/persona.ts:109` (PL) / `:140` (EN)

Ta sama doktryna 8 reguł, plus osobny „kontrakt wyjścia" umieszczony świadomie na końcu promptu dla maksymalnej istotności (`persona.ts:815` — „Output contract goes LAST so it has the highest recency/salience").

> „1. ZACZNIJ OD ODPOWIEDZI (BLUF). Pierwsze zdanie = konkluzja lub rekomendacja. Zero rozgrzewki, zero powtarzania pytania, zero „świetne pytanie", „z przyjemnością pomogę", „chętnie to sprawdzę", komplementów ani zapowiadania tego, co zaraz zrobisz. **Konsultant nie dziękuje za pytanie — odpowiada na nie.**"
> — `server/src/ai/persona.ts:621`

> „Test jakości przed wysłaniem: czy pierwsze zdanie samo w sobie odpowiada? czy da się skrócić bez utraty treści? czy każde zdanie coś wnosi? czy odwołuje się do danych TEGO klienta, a nie do ogólników? Jeśli nie — popraw, zanim odpowiesz."
> — `server/src/ai/persona.ts:632`

Jedyny prompt w repo realizujący kryterium 7 (hipoteza-najpierw) jako metodę pracy:

> „### Drzewo Hipotez (Issue Tree)
> Przy złożonych problemach:
> 1. Rozbij problem na 2-4 pod-pytania (każde testowalne)
> 2. Dla każdego pod-pytania: hipoteza + dane wspierające/obalające"
> — `server/src/ai/persona.ts:174-178`

**Weryfikacja runtime (nie dokumentacja):** persona jest realnie stosowana w czacie strumieniowym. `AIPipeline` pomija ją tylko przy `dedicatedSystemPrompt: true`, co ustawiają wyłącznie 3 miejsca (`smart-followup.routes.ts:75`, `BusinessCaseService.ts:312`, `WorkbookGeneratorService.ts:447`) — ścieżka czatu tego nie ustawia (`ai.routes.ts:2493-2510`). Komentarz w `ai.routes.ts:1872` twierdzący, że „AIPipeline bypasses the persona builder when one is provided", jest **nieaktualny** — kod w `AIPipeline.ts:1237-1241` dokleja instrukcję do persony, nie zastępuje jej.

**Brak:** odbiorca. Persona wie, KIM jest, nie wie, DO KOGO pisze.

---

### E. Konkluzje narzędzi Discovery — wzór: `src/config/sopbuilder/conclusionPrompts.ts`

19 narzędzi ma dedykowany prompt konkluzji. Wszystkie trzymają wspólny wzorzec W2. Jakość realnie dobra:

> „QUALITY BARS:
> - Answer-first: "verdict" is a thesis about the decision, not a recap of the inputs.
> - Numbers exclusively from the facts above; do not compute or invent new ones.
> - Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
> - **Every sentence falsifiable: with opposite facts it would read differently.**"
> — `src/config/sopbuilder/conclusionPrompts.ts:97-101`

Trade-off jako wymóg twardy, nie sugestia:

> „Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego)."
> — `src/config/sopbuilder/conclusionPrompts.ts:74`

> „Standard bez mierzalnego progu i bez punktu weryfikacji jest fikcją zgodności — nazwij to wprost."
> — `src/config/sopbuilder/conclusionPrompts.ts:76`

Kontrakt JSON wymusza strukturę, której nie da się wypełnić ogólnikiem: `verdict`, `tradeoffs[{chosen,rejected,why}]`, `expectedEffect{text,horizon}` (linie 115-124).

**Ważne, że działa też bez dedykowanego promptu:** 12 typów narzędzi nie ma własnego pliku konkluzji, ale wpada w generyczną gałąź operacyjną, która TEŻ niesie strukturę W2 — `src/hooks/discovery/toolAi/promptRegistry.ts:1057-1075`. To dobra architektura: brak dedykowanego promptu nie oznacza braku dyscypliny.

---

### F. Sekcja dokumentu (Word) — `server/src/services/deliverables/docGenerationRuntime.ts:1394`

Ma dwie z ośmiu reguł, wstrzykiwane jako osobne stałe:

> „ANSWER-FIRST (piramida Minto): pierwsze zdanie sekcji niesie konkluzję lub kluczowe ustalenie — żadnej rozgrzewki ani powtórzenia tytułu sekcji."
> — `server/src/services/deliverables/docGenerationRuntime.ts:1394`

> „KWANTYFIKACJA (§0.3): każda liczba, procent, kwota lub ROI/payback MUSI albo wynikać z dostarczonych faktów, albo być opatrzona jawnym założeniem w nawiasie (…). Liczby bez podstawy w faktach i bez założenia są ZABRONIONE."
> — `server/src/services/deliverables/docGenerationRuntime.ts:1391`

Osobno bardzo dobra reguła dla arkusza (Excel), chroniąca przed najgorszym scenariuszem — zmyślonymi metrykami udającymi dane klienta:

> „wiersze startowe muszą być jawnie oznaczone jako przykładowe (…) i używać okrągłych, ewidentnie ilustracyjnych liczb (10/20/30, **nie 27,4% czy 183 450 zł**) — NIGDY nie prezentuj zmyślonych precyzyjnych metryk biznesowych jako rzeczywistych danych organizacji."
> — `server/src/services/deliverables/docGenerationRuntime.ts:883`

**Braki:** brak MECE, brak falsyfikowalności, brak listy anty-wzorców (poza „bez meta-komentarzy"), brak odbiorcy — patrz §4.2.

---

### G. Prompt systemowy „operacyjny" — `src/hooks/discovery/toolAi/systemPrompts.ts:157`

**Obsługuje 20 z 31 typów narzędzi. Ma cztery linie treści i zero reguł jakości.**

> „You are guiding the user through an Operational Excellence tool.
>
> Provide concise, actionable items for each operational section and explain operational implications, not only observations."
> — `src/hooks/discovery/toolAi/systemPrompts.ts:159-161`

Baza, na której stoi, też nie stawia poprzeczki:

> „RESPONSE GUIDELINES:
> 1. Be concise but comprehensive
> 2. Use bullet points for clarity"
> — `src/hooks/discovery/toolAi/systemPrompts.ts:15-17`

„Be concise but comprehensive" to instrukcja wzajemnie sprzeczna i nieoperacyjna — dokładnie ten rodzaj zdania, który doktryna z §3.A/C nazywa fillerem.

**Rozkład jakości w tym jednym pliku (`SYSTEM_PROMPT_MAP`, linie 178-210):**

| Prompt systemowy | Typów narzędzi | Dyscyplina konkluzji |
|---|---|---|
| SWOT | 1 | pełna (drabina wniosku, trade-off, falsyfikowalność) |
| STRATEGIC | 5 | pełna |
| PORTER | 1 | brak |
| GROWTH_PATHS | 1 | brak |
| PORTFOLIO | 1 | brak |
| RISK | 1 | brak |
| PROCESS_AUTOMATION | 1 | brak |
| **OPERATIONAL** | **20** | **brak** |

**6 z 31 typów narzędzi (19%) dostaje mocny prompt systemowy.**

Dla porównania — to samo, tylko dla SWOT i pięciu narzędzi strategicznych:

> „Insight staircase on every material item: fact (from the session inputs, with a reference) -> interpretation (what it means for THIS company) -> implication (what follows for the decision). **Never stop at description.** (…) Zero filler that fits any company. Every conclusion falsifiable: with opposite data it would read differently."
> — `src/hooks/discovery/toolAi/systemPrompts.ts:114-119`

To jest kryterium 4 (tak-więc) zaimplementowane wzorcowo. I dostaje je 6 narzędzi z 31.

**Łagodzące:** warstwa konkluzji (§3.E) nadrabia to na końcu sesji. **Nienadrobione:** warstwa generowania pojedynczych pozycji w trakcie sesji — `src/hooks/discovery/toolAi/promptRegistry.ts:411` („Act as a senior operations consultant. Generate 3-6 concrete, specific items…") niesie tylko reguły ugruntowania, bez answer-first, MECE i falsyfikowalności. A to jest treść, którą klient widzi NA EKRANIE w trakcie warsztatu.

**Uwaga na przyszłość, nie błąd dziś:** fallback `SYSTEM_PROMPT_MAP[toolType] || PORTER_SYSTEM_PROMPT` (`systemPrompts.ts:213`) jest obecnie nieosiągalny — wszystkie 31 wariantów `ToolType` (`src/store/useToolStore.ts:23-53`) jest zmapowanych. Nowe narzędzie dodane bez wpisu w mapie dostanie ramę „Pięciu sił Portera" niezależnie od tego, czym jest.

---

### H. Generatory Idea Map — `server/src/services/ideaAIGeneratorService.ts`

**Najgorsza część korpusu, a jednocześnie najbardziej widoczna dla klienta.** 76 promptów. Każdy to jedno zdanie roli + schemat JSON. Zero reguł jakości, zero ugruntowania, zero answer-first.

> „You are a strategic advisor. Analyze the business challenge and propose: topics to analyze (topics), findings/insights (findings), next steps (next_steps), consulting frameworks (frameworks), **risks (risks), industry benchmarks (benchmarks)**. Each suggestion has confidence (0-1). Respond ONLY in JSON."
> — `server/src/services/ideaAIGeneratorService.ts:868` (PL: `:865`)

To jest jawne zaproszenie do konfabulacji. Prompt każe wyprodukować „benchmarki branżowe", nie podaje żadnego źródła, nie zakazuje wymyślania i nie wymaga oznaczenia hipotezy. Porównaj z regułą 10 z §3.A, która tego wprost zakazuje jako FAIL. Benchmark branżowy to dokładnie ta liczba, którą klient sprawdzi jako pierwszą.

Pozostałe przykłady tej samej klasy:

> „You are a Lean manufacturing expert. Based on the process description, generate a current state Value Stream Map **with realistic metrics** for the ${industry} industry. Include: process boxes with cycle time/changeover/uptime (…)"
> — `server/src/services/ideaAIGeneratorService.ts:1018`

„Realistic metrics" = polecenie wymyślenia czasów cyklu i uptime'u zakładu klienta. Bez oznaczenia, że to szacunek.

> „You are a process automation consultant. Assess each important process step for automation and savings potential. Return recommendations[] with: nodeId, automationPotential, **savingsEstimate**, implementationEffort (…)"
> — `server/src/services/ideaAIGeneratorService.ts:1002`

Szacunek oszczędności bez wymogu mostka wyliczeniowego — mimo że repo taką regułę ma i stosuje gdzie indziej (`groundingRules.ts:22`, punkt 2).

**Ani jeden z 76 promptów w tym pliku nie importuje reguł ugruntowania.** Weryfikacja: `grep -rln "GROUNDING_RULES\|groundingRules(" server/src` zwraca **zero** plików serwerowych. Blok anty-fabrykacyjny pokrywa 33 pliki — wszystkie we frontendzie, w rodzinie Discovery.

---

## 4. NAJGORSZE BRAKI (uporządkowane wg stawki)

### 4.1. Reguły ugruntowania nie przekraczają granicy frontend/serwer

`src/hooks/discovery/toolAi/groundingRules.ts` to najlepszy blok anty-fabrykacyjny w repo. Powstał z panelu adwersaryjnego, ma udokumentowaną genezę:

> „W1 — fabricated client metrics stamped as fact (evidenceType:'fact', confidence 5, provenance 'Client briefing data') with no such data in the session input."
> — `src/hooks/discovery/toolAi/groundingRules.ts:8-10`

> „2. MOSTEK WYLICZENIOWY: każda kwota w EUR/PLN, ROI lub procent MUSI mieć pole "derivation" pokazujące licznik/mianownik (…). Jeśli nie potrafisz podać mostka wyliczeniowego z liczb obecnych we wsadzie — NIE podawaj kwoty."
> — `src/hooks/discovery/toolAi/groundingRules.ts:22`

**Importuje go 33 pliki — wszystkie w `src/`. Zero w `server/src/`.** Cała generacja serwerowa (Mind Map, Whiteboard, Process Flow, Tabela, VSM, notatka z czatu) działa bez niego. Każdy z tych silników ma własne, słabsze i niespójne zabezpieczenie albo żadnego.

Plik sam ostrzega przed tym, co się stało:

> „DO NOT copy-paste this text into individual prompt files — import and inject this constant/function instead, so a future fix only needs to land once."
> — `src/hooks/discovery/toolAi/groundingRules.ts:17`

### 4.2. `audience` jest zbierane od użytkownika i nigdy nie trafia do promptu (ścieżka deliverables)

W `docGenerationRuntime.ts` pole `audience` występuje dokładnie 3 razy — i ani razu w prompcie:

- `:362` — deklaracja typu
- `:395` — odczyt z setupu
- `:515` — zapis do wyniku parsowania

Prompt systemowy sekcji (`:1406`) składa się z `languageDirective + tableDirective + systemPromptBase`. Kontekst użytkownika (`:1409-1425`) to tytuł dokumentu, tytuł sekcji, cel sekcji, wcześniejsze tytuły i fakty. **Odbiorcy nie ma w żadnym z nich.**

Że to da się zrobić, dowodzi drugi silnik dokumentów w tym samym repo:

> „`The document is a "${schema.documentType}" written for the audience: ${schema.audience.length > 0 ? schema.audience.join(', ') : 'internal stakeholders'}.`
> `Communication register: ${schema.communicationRegister}. Density: ${schema.density}.`"
> — `server/src/services/documentStudio/documentBlockProseGenerator.ts:161-164`

Dwa silniki dokumentów, dwa różne poziomy. `starterTemplates.ts:46-106` definiuje odbiorców (`investor`, `board`, `client`, `internal`) — dane istnieją, prompt ich nie widzi.

### 4.3. Dwa przykłady few-shot na 179 plików z promptami

Cały korpus zawiera **dwa** przykłady „ŹLE/DOBRZE":

> „ŹLE: "Poprawa procesu". DOBRZE: "Skrócenie czasu obsługi zgłoszeń o 30% do Q3"."
> — `server/src/services/initiative/cardContentFormulaPrompt.ts:19`

> „BAD: "reduce by TBD %". GOOD: "reduce by 15% (estimate; assuming elimination of 3 of 8 monthly outages)"."
> — `server/src/services/initiativeGenerationService.ts:244`

Reszta korpusu opisuje jakość słowami. Opis („bądź konkretny", „zero fillera") działa znacznie słabiej niż jedna para przed/po — to najtańsza dostępna poprawa jakości w całym korpusie.

### 4.4. Doktryna 8 reguł istnieje w ≥4 niezależnych kopiach

Ta sama numerowana lista, kopiowana zamiast importowana:

- `server/src/ai/persona.ts:109-118` (PL) i `:140-149` (EN)
- `server/src/services/InterviewInsightService.ts:501-509`
- `server/src/services/taskSectionGenerationService.ts:72` (PL) i `:85` (EN)
- `server/src/services/ai/initiativeSectionFill.ts:158` (PL) i `:173` (EN)

Do tego ~15 kopii linii o anty-frazach AI rozsianych po `src/config/*/conclusionPrompts.ts`. Kopie już się rozjechały — wersja z `InterviewInsightService` ma kontrakt dowodowy (`limits[]`, triangulacja), którego nie ma persona; wersja z `initiativeGenerationService` ma reguły 9-10 (spójność liczbowa, zakaz fałszywej atrybucji), których nie ma żadna inna. **Dziś nie ma jednego miejsca, w którym podniesienie poprzeczki podnosi ją wszędzie.**

### 4.5. Kryterium 7 (hipoteza-najpierw) jest praktycznie nieobecne

Poza `persona.ts:174-178` (Drzewo Hipotez, tylko czat) i nazwami szablonów w `src/services/consultingTemplatesRegistry.ts:58` żaden prompt nie każe AI ZACZĄĆ od tezy i szukać danych, które ją obalą. Prompty konkluzji wymagają tezy na WYJŚCIU (`verdict`), co jest dobre, ale to inna rzecz niż praca hipotezą od początku sesji.

---

## 5. CO JUŻ TRZYMA POZIOM (bez taryfy ulgowej)

Cztery rzeczy są realnie lepsze niż typowy produkt AI, który widuję:

1. **Kontrakt dowodowy jako pole danych, nie prośba.** `confidence_level` + `limits[]` + `evidence_refs[]` z wymogiem triangulacji dla „high" (`InterviewInsightService.ts:512-514`). Falsyfikowalność wpisana w schemat, nie w prozę.

2. **Zamknięte ugruntowanie w decku.** „Grounding zamknięty: tylko "facts". Nic więcej. Zakaz „badań branżowych"" (`deckConclusionSlide.ts:426`), plus wartość `"insufficient"` w polu confidence. Model ma legalną drogę powiedzieć „nie wiem".

3. **Zamknięta pętla pomiaru.** `server/src/services/consultingBenchmarkJudgeService.ts:36-41` ocenia output w pięciu wymiarach: `answer_first`, `mece_structure`, `grounding`, `actionability`, `evidence_discipline`, w trybie binary all-pass w stylu BigLaw Bench. Z twardym zabezpieczeniem antykontaminacyjnym: „`binaryCriteria` / `scaleRubrics` / `goldNotes` must NEVER reach the product prompt" (`:23-25`). To nie jest deklaracja jakości — to jej mierzenie.

4. **Ilościowe minimum zamiast przymiotników.** `cardContentFormulaPrompt.ts:33-47`: „KPI: ≥2 (≥1 primary) — każdy z baseline→target + kierunek + jednostka", „Scope-out: min 3 pozycji MECE", „RAID: ≥2 RISK + ≥1 ASSUMPTION + ≥1 DEPENDENCY", „kill_criteria: min 2". Nie da się tego spełnić ogólnikiem.

---

## 6. DO DECYZJI PIOTRA

1. **Czy `ideaAIGeneratorService.ts` (76 promptów: Mind Map, Whiteboard, Process Flow, Tabela) jest pokazywany klientowi?** Jeśli tak — to jest pojedyncze największe ryzyko wizerunkowe w korpusie i priorytet nr 1. Jeśli to tylko szkicownik konsultanta przed obróbką, sprawa spada do niskiego priorytetu.

2. **Czy reguły ugruntowania mają zostać wyniesione do pakietu współdzielonego frontend+serwer?** Dziś 33 pliki frontendu je mają, zero plików serwera. Wyniesienie = jedno miejsce zamiast rozjeżdżających się kopii. To zmiana architektoniczna, nie kosmetyczna.

3. **Czy `audience` ma trafiać do promptu w ścieżce deliverables?** Dane już są zbierane i zapisywane. Document Studio już to robi. To najmniejsza zmiana o największym efekcie na kryterium 8.

4. **Czy podnosimy `OPERATIONAL_SYSTEM_PROMPT` (20 z 31 narzędzi), czy uznajemy, że warstwa konkluzji wystarcza?** Warstwa konkluzji jest mocna, ale użytkownik widzi treść pozycji NA EKRANIE w trakcie sesji, zanim dojdzie do konkluzji.

5. **Czy dokładamy pary ŹLE/DOBRZE do 6 promptów o największym zasięgu?** Najtańsza poprawa jakości w całym korpusie: jeden przykład na prompt, żadnej zmiany architektury.

6. **Czy 8 reguł doktryny dostaje jedno źródło (`persona.ts` → export), czy zostawiamy 4 kopie?** Kopie już się rozjechały funkcjonalnie — wersja Insightowa i Inicjatywowa mają reguły, których nie mają pozostałe.

---

## 7. CZEGO NIE ZWERYFIKOWAŁEM

Uczciwie, żeby ten dokument nie zestarzał się cicho:

- **Nie oceniałem realnych outputów.** To audyt TEKSTU instrukcji, nie tego, co model faktycznie produkuje. Mocny prompt ≠ mocny output. Wniosek „gotowe do klienta" jest o instrukcji, nie o rezultacie.
- **Nie uruchamiałem `tsc` ani `vitest`** (zakaz OOM w zadaniu). Nie wiem, czy każdy prompt kompiluje się i jest osiągalny.
- **Nie sprawdziłem V8 Prompt OS** — warstwy governance opartej o bazę (`server/src/services/v8/promptOsRuntimeService.ts`). Prompty mogą być tam nadpisywane presetami z DB, których nie widziałem. Jeśli ta warstwa jest aktywna na demo, część ocen może dotyczyć kodu, który nie jest tym, co wykonuje się w produkcji. **To najważniejsza luka tego audytu.**
- **Nie zmierzyłem faktycznej częstotliwości wywołań.** „Zasięg" szacowałem z mapowań w kodzie, nie z telemetrii. Nie wiem, czy Idea Map jest używana 100 razy dziennie czy raz w miesiącu — a to zmienia priorytet punktu 6.1.
- **Nie audytowałem `aiPlaybookService.ts` (48 KB) ani `helpExperience.ts` (45 wystąpień „You are")** — pierwszy wygląda na orkiestrator, drugi na treści pomocy produktowej, oba poza zakresem „treść dla klienta".
- **Komentarz w `ai.routes.ts:1872`** o pomijaniu persony jest sprzeczny z kodem w `AIPipeline.ts:1237-1241`. Rozstrzygnąłem na korzyść kodu (persona działa), ale nie prześledziłem wszystkich wariantów `aiModes`.
