# KONTRAKT KARTY — jeden wiążący SSOT (PROJEKT, 2026-07-22)

> **Dla:** Piotr (nie-koder). **Co to jest:** projekt JEDNEGO dokumentu, który ma zastąpić 5 rozproszonych
> źródeł opisujących „kartę" (sekcję wewnątrz artefaktu, gdzie AI pisze treść). Dziś każde z tych 5 miejsc
> opisuje inny wycinek i żadne nie jest kompletne ani wiążące — audyt `_AUDYT_ARCHITEKTURY_ARTEFAKTOW_2026-07-22.md`.
> **Ta fala PISZE SPECYFIKACJĘ, NIE kod produktu.** Egzekwowanie (typ + bramka, jak `StandardTable` dla list)
> przyjdzie PO Twoim akcepcie tego dokumentu.
>
> **Słownik (ustalony 07-22):** ARTEFAKT = obiekt-ekran + wspólna powłoka (jest ich 7). KARTA = sekcja WEWNĄTRZ
> artefaktu, gdzie AI pisze treść (Initiative ma ich 29). TUL (SWOT itp.) = osobny warsztat, POZA zakresem.
>
> **Baza dowodów:** worktree `fix/prv-mywork-preview` (baza `origin/demo`). Każda komórka: albo WARTOŚĆ + dowód
> `plik:linia`, albo **„DO DECYZJI PIOTRA"** (gdy kodu/docy brak — nie zgadujemy), albo wartość + flaga
> **MARTWE / ROZJAZD** (gdy kod istnieje, ale wygląda na nieaktualny/sprzeczny). Progi: LICZBA jeśli jest w
> kodzie, inaczej „DO DECYZJI PIOTRA".

---

## 1. CEL I ZASADA

**Jeden kontrakt karty — wiążący.** Ma być dla kart tym, czym `StandardTable` jest dla list: nie da się go
obejść. Dziś jest odwrotnie — sam kod to nazywa: *„`StandardTable` nie da się obejść, a `NModeShell` — da się,
i obchodzi go 8 kart na 8"* (`_SPEC_N_KARTY_2026-07-21.md:98`). Tabele się nie rozjeżdżają, bo standard jest
KODEM. Karty się rozjeżdżają, bo ich kontrakt jest ROZPROSZONYM OPISEM — nic „się nie kompiluje", gdy artefakt
zrobi po swojemu.

**Ten SSOT docelowo zastępuje 5 źródeł** (dziś każde pokrywa inny wycinek, żadne nie jest pełne):

| # | Dziś (rozproszone źródło) | Co opisuje | Pokrycie |
|---|---|---|---|
| 1 | `src/components/shared/NModeLayout/cardSets.ts` | struktura kart: katalog + zestawy domyślne + `core` (nieusuwalna) | 3/7 żywo (Insight, Decision, Task) + Initiative jako **martwe dane** |
| 2 | `server/src/services/cardContentValidator.ts` | treść: minima pól (LICZBY), anty-wypełniacz — **doradczo** | Task + Initiative (Decision zdefiniowany, ale **bez callera**) |
| 3 | `server/src/services/cardContentFormulaValidator.ts` | treść: scoring całej karty, próg **≥90** (§B4) | **tylko** `insight` \| `initiative` (`:33`) |
| 4 | `server/src/services/initiative/initiativeCardValidators.ts` | treść Initiative §B3 (język PL, długość problemu 120–250) — doradczo | Initiative |
| 5 | `docs/ui-standards/01-shell-layout/n-mode-card-standard.md` (2026-05-01) | taksonomia: domyślna / opcjonalna / wymagana + katalog | opisowo, **rozjechany z kodem** |

Plus dwa dokumenty, które MIAŁY to złączyć, ale nie są aktem wiążącym: `n-mode-card-standard.md` (§4 poniżej)
i `_SPEC_N_KARTY_2026-07-21.md §4 / DEC-010` — **status „otwarte", niezaakceptowane** (`:64`).

**Warunek brzegowy: zero dokumentów-widm.** Cztery odnośniki w kodzie prowadzą do plików, których NIE MA w repo
(sekcja 6). Nowy SSOT nie może cytować ani jednego widma i przejmuje ich rolę.

---

## 2. SCHEMAT KARTY (pola, które KAŻDA karta musi mieć)

Każda karta w systemie deklaruje sześć pól. To jest szkielet, który dziś leży w kawałkach:

| Pole | Znaczenie | Źródło dziś (jeśli istnieje) |
|---|---|---|
| **id** | stały identyfikator; MUSI równać się id sekcji renderowanej przez artefakt | `cardSets.ts:35` (komentarz: „Card id MUST equal the section id"); Initiative → `registry.ts:50-83` |
| **nazwa** | dwujęzyczna etykieta karty (en/pl) | `cardSets.ts:37` (`label:{en,pl}`); Initiative: `name_pl` w DB `initiative_section_types` |
| **co_zawiera** | co ta karta ma zawierać (zakres treści) | częściowo: `cardContentValidator.ts` (pola), prompty generacji; brak jednego opisu per-karta |
| **prog_kompletnosci** | **LICZBA** mówiąca kiedy karta jest „gotowa" | **NIE ISTNIEJE per-karta** (patrz niżej) → w większości „DO DECYZJI PIOTRA" |
| **rola_AI** | czy AI pisze treść, asystuje, czy karta jest czysto danymi/systemowa | prompty generacji (Initiative: `ai_prompt_template` w DB); brak jednej deklaracji |
| **kompozycja** | domyślna \| wymagana(core, nieusuwalna) \| dodawalna \| usuwalna | `cardSets.ts` (`sets[0]` = domyślny, `core:true` = nieusuwalna); Initiative: `DEFAULT_VISIBLE_SECTIONS` |

**★ Najważniejsza prawda o progu:** w całym kodzie **NIE MA progu kompletności per-karta**. Są tylko trzy inne
liczby, i żadna nie mówi „ta karta jest kompletna w X%":
- **(A) Scoring całej karty ≥ 90** — `cardContentFormulaValidator.ts:59` (`PASS_THRESHOLD = 90`, §B4). Ocenia
  CAŁY obiekt Insight/Initiative (start 100, odejmowanie za naruszenia, `pass = score>=90 && !hasHard`, `:484`).
  Istnieje **tylko** dla `insight` i `initiative` (`:33`). To NIE jest próg per-karta.
- **(B) Minima pól — doradcze** — `cardContentValidator.ts:78-101` (np. `successCriteria ≥ 4`, `checklist ≥ 3`).
  To minima TREŚCI pojedynczych pól, oznaczone jawnie „ADVISORY ONLY … never to block" (`:21-22`, `:375`).
- **(C) Próg regeneracji AI = 90** — `REVIEW_PASS_THRESHOLD` w generacji Initiative (`initiativeGenerationService.ts:141`,
  wg inwentarza — patrz sekcja 8). Poniżej → jedna regeneracja. Też nie jest progiem „karta gotowa".

Dlatego w tabeli master kolumna „próg" jest niemal wszędzie **„DO DECYZJI PIOTRA"**, a tam gdzie kod daje
najbliższą realną liczbę — cytuję ją jako kontekst z etykietą (doradczy / scoring / gate).

---

## 3. ★ TABELA MASTER — wszystkie karty 7 artefaktów

Legenda kompozycji: **rdzeń** = `core:true`, nieusuwalna (tylko chowana) · **domyślna** = w zestawie `sets[0]` /
`DEFAULT_VISIBLE=true` · **dodawalna** = w katalogu, poza domyślnym zestawem · **ukryta-dom.** = w katalogu,
`DEFAULT_VISIBLE=false`.

### 3.1 INSIGHT — 18 kart (`cardSets.ts:71-223`, spec `INSIGHT_SPEC`)
System: **cardSets.ts** (żywy — wpięty w `NModeCardManager`). Rola AI: karta materializowana z wywiadu; bramka
treści = scoring całej karty **≥90** (`validateInsightCard`, `cardContentFormulaValidator.ts`; realni wołający:
`InterviewInsightService.ts:2401` z pętlą naprawy `:2438`, `insightMaterializationService.ts:464` = BRAMKA F14).

| id | nazwa (pl) | próg per-karta | rola AI | kompozycja |
|---|---|---|---|---|
| artifact-actions | Dalsze akcje | DO DECYZJI (całość ≥90) | AI pisze | **rdzeń** (`:78`), domyślna |
| executive-summary | Podsumowanie | DO DECYZJI (całość ≥90) | AI pisze | **rdzeń** (`:85`), domyślna |
| consulting-readout | Odczyt konsultingowy | DO DECYZJI | AI pisze | domyślna |
| themes | Tematy | DO DECYZJI | AI pisze | domyślna |
| issues-risks | Problemy i ryzyka | DO DECYZJI | AI pisze | domyślna |
| opportunities | Przestrzenie szans | DO DECYZJI | AI pisze | domyślna |
| evidence-map | Mapa dowodów | DO DECYZJI | AI pisze | domyślna |
| candidate-triage | Wnioski i dowody | DO DECYZJI | AI pisze | domyślna |
| source-pack | Źródła | DO DECYZJI | AI/dane | domyślna |
| report-pack | Pakiet raportu | DO DECYZJI | AI pisze | domyślna |
| comments | Komentarze | DO DECYZJI | transakcyjna | domyślna |
| activity-log | Aktywność | DO DECYZJI | systemowa | domyślna |
| people | Perspektywy | DO DECYZJI | AI pisze | **dodawalna** (zestaw „full") |
| signals | Sygnały | DO DECYZJI | AI pisze | **dodawalna** (full) |
| analysis-matrix | Macierz Analizy | DO DECYZJI | AI pisze | **dodawalna** (full) |
| consensus-divergence | Zgoda i rozbieżności | DO DECYZJI | AI pisze | **dodawalna** (full) |
| implicit-assumptions | Ukryte założenia | DO DECYZJI | AI pisze | **dodawalna** (full) |
| silences | Przemilczenia | DO DECYZJI | AI pisze | **dodawalna** (full) |

Zestaw domyślny = 12 kart (`sets[0]`, `:176-192`); „full" = 18; „minimal" = 4. Rdzeń = `artifact-actions`,
`executive-summary`.

### 3.2 INITIATIVE — 29 kart (`registry.ts:50-83`, `SECTION_REGISTRY`)
System: **WŁASNY** (`SECTION_REGISTRY` + `DEFAULT_VISIBLE_SECTIONS`, **nie** cardSets — `INITIATIVE_SPEC` w
cardSets = martwe dane, patrz §4). Bramka treści = scoring całej inicjatywy **≥90** (`validateInitiativeCard`).
Numery `530:*`, `529:*`, `initiativeGeneratorBrain.ts:*`, `completenessConfigs.ts:*` pochodzą z inwentarza
(OŚ 1) — patrz sekcja 8.

| id | nazwa (pl) | próg per-karta | rola AI | kompozycja |
|---|---|---|---|---|
| overview | Opis inicjatywy | DO DECYZJI (gate 90) | AI pisze | domyślna (`:141`); generator OPTIONAL, NIE core |
| problemDefinition | Definicja problemu | DO DECYZJI · §B3 długość **120–250 słów** (`initiativeCardValidators.ts:133`); display %=filled/3 (nie bramka) | AI pisze (CORE) | domyślna (`:142`) |
| targetState | Stan docelowy | DO DECYZJI · doradczo **successCriteria≥4, deliverables≥4** (`cardContentValidator.ts:80`) | AI pisze (CORE) | domyślna (`:143`) |
| scope | Zakres i rezygnacja | DO DECYZJI · doradczo **inScope≥3, outOfScope≥3, killCriteria≥2** (`:81`) | AI pisze (CORE) | domyślna (`:144`) |
| tasks | Zadania i kamienie milowe | DO DECYZJI (gate 90) | AI pisze | domyślna (`:145`) |
| decisions | Decyzje | DO DECYZJI (gate 90) | AI pisze | domyślna (`:146`) |
| raid | Rejestr RAID | DO DECYZJI · doradczo **risks≥2, assumptions≥1, dependencies≥1** (`:82`) | AI pisze (CORE) | domyślna (`:147`) |
| gates | Bramki decyzyjne | DO DECYZJI · `readinessScore 0-100` istnieje, ale **próg odcięcia PROCEED nie znaleziony w FE** | AI pisze | domyślna (`:148`) |
| financialAnalysis | Analiza finansowa | DO DECYZJI · doradczo **minWords≥15** (`:85`) | AI pisze | **ROZJAZD**: DB aktywna, ale komentarz „enum is dead per F0" (`initiativeGeneratorBrain.ts:50`); domyślna (`:149`) |
| financialImpact | Wpływ finansowy (P&L) | DO DECYZJI · doradczo **minWords≥15** (`:86`) | AI pisze (CORE) | domyślna (`:150`) |
| kpis | KPI i korzyści | DO DECYZJI · pole nie-krytyczne (`completenessConfigs.ts:133`) | AI pisze (CORE) | domyślna (`:151`) |
| competencyRequirements | Wymagania kompetencyjne | DO DECYZJI (brak promptu) | generator proponuje, ale **brak promptu** | **ROZJAZD**: brak wiersza w DB, brak `name_pl`; domyślna (`:151`) |
| skillsGap | Luka kompetencyjna | DO DECYZJI (brak promptu) | generator proponuje, brak promptu | **ROZJAZD**: brak wiersza DB; ma własną tabelę `skills_gap`; domyślna (`:152`) |
| pilot | Pilot | DO DECYZJI (gate 90) | AI pisze | **ukryta-dom.** (`:165=false`) |
| comments | Komentarze | DO DECYZJI | AI-assist opcjonalny | domyślna (`:153`) |
| history | Historia (Activity Log) | DO DECYZJI | systemowa (bez promptu) | domyślna (`:154`) |
| control | Panel sterowania | DO DECYZJI (gate 90) | AI pisze (CORE „Właściciel") | domyślna (`:155`) |
| team | Zespół | DO DECYZJI · pole nie-krytyczne (`completenessConfigs.ts:206`) | **brak promptu** (dane) | **ROZJAZD**: w OPTIONAL_LIBRARY jako karta-do-generacji, realnie dane; domyślna (`:156`) |
| initiativeTeam | Zespół inicjatywy (legacy) | DO DECYZJI | brak | **MARTWE**: brak typu w DB, dubluje `team`; ukryta-dom. (`:167=false`), order „Legacy" |
| raciEscalation | RACI i eskalacja | DO DECYZJI (gate 90) | AI-assist (prompt pod key `raci`) | **ROZJAZD kluczy**: DB/nawigacja = `raci` (`541:3`), registry/widoczność = `raciEscalation`; ukryta-dom. (`:168=false`) |
| timeline | Harmonogram | DO DECYZJI · pole **krytyczne** od EXECUTING (`completenessConfigs.ts:190`, poziom pola) | brak promptu (dane) | **ROZJAZD**: OPTIONAL_LIBRARY jako karta, realnie dane; domyślna (`:157`) |
| resources | Zasoby | DO DECYZJI (gate 90) | AI pisze | domyślna (`:158`) |
| stakeholders | Interesariusze (RACI) | DO DECYZJI | brak promptu (dane) | **ROZJAZD**: karta w OPTIONAL_LIBRARY, dane; nakłada się z `raciEscalation`; domyślna (`:159`) |
| dependencies | Zależności | DO DECYZJI | brak promptu (dane) | **ROZJAZD**: karta w OPTIONAL_LIBRARY, realnie dane; domyślna (`:160`) |
| attachments | Załączniki i powiązane | DO DECYZJI | dane | domyślna (`:161`) |
| linkedItems | Powiązane elementy (legacy) | DO DECYZJI | brak | **ROZJAZD/legacy**: brak typu DB; nakłada się z `attachments`; ukryta-dom. (`:169=false`) |
| tags | Tagi | DO DECYZJI | dane | domyślna (`:162`) |
| reminders | Przypomnienia i eskalacja | DO DECYZJI | dane/reguły | domyślna (`:163`) |
| watchers | Obserwatorzy | DO DECYZJI | brak | **MARTWE/placeholder**: registry mapuje na `OverviewSection` (`:82`, „simpler UI — can be enhanced later"), brak typu DB, brak promptu; ukryta-dom. (`:166=false`) |

CORE generatora (zawsze wypełniane): problemDefinition, targetState, scope, kpis, raid, financialImpact, control
(wg inwentarza `initiativeGeneratorBrain.ts:64-70`). Uwaga: `overview` jest domyślnie widoczna, ale NIE należy
do CORE generatora.

### 3.3 DECISION — 8 kart (`cardSets.ts:416-489`, `DECISION_SPEC`)
System: **cardSets.ts** (żywy — wpięty w `NModeCardManager`). **Treść = kontrakt-widmo:** reguły są
zdefiniowane (`cardContentValidator.ts:88-92`), ale **żaden serwis Decision ich nie woła** (`grep` w
`decisionService.ts` / `DecisionController.ts` = pusto). Scoring całej karty (formula ≥90) **nie obejmuje**
Decision (`CardKind` = tylko insight/initiative).

| id | nazwa (pl) | próg per-karta | rola AI | kompozycja |
|---|---|---|---|---|
| context-problem | Zakres decyzji | DO DECYZJI · reguła `description minWords≥15` **MARTWA (bez callera)** (`:91`) | AI pisze | **rdzeń** (`:418`), domyślna |
| options-tradeoffs | Opcje i trade-offy | DO DECYZJI · reguła `alternatives≥2` **MARTWA** (`:89`) | AI pisze | domyślna |
| risk-impact | Ryzyko i wpływ | DO DECYZJI · reguła `risk risks≥2` **MARTWA** (`:90`) | AI pisze | domyślna |
| consequences | Konsekwencje | DO DECYZJI · reguła `consequencesOfInaction minWords≥20` **MARTWA** (`:92`) | AI pisze | domyślna |
| governance-escalation | RACI i eskalacja | DO DECYZJI | AI-assist / dane | domyślna |
| comments | Komentarze | DO DECYZJI | transakcyjna | domyślna |
| resources-links | Załączniki i powiązania | DO DECYZJI | dane | domyślna |
| activity-log | Logi aktywności | DO DECYZJI | systemowa | domyślna |

Zestaw domyślny = 8 (wszystkie); „minimal" = 4. Rdzeń = `context-problem`. **Rozjazd kluczy:** id kart w
cardSets (`options-tradeoffs`, `consequences`…) ≠ klucze reguł walidatora (`alternatives`, `consequencesOfInaction`…)
— mapowanie karta→klucz jest niejawne, co dodatkowo tłumaczy, czemu reguły nie łapią.

### 3.4 TASK — 10 kart (`cardSets.ts:494-576`, `TASK_SPEC`)
System: **cardSets.ts** (żywy). Treść: minima **doradcze** (`cardContentValidator.ts:94-100`), **realny wołający**
`taskSectionGenerationService.ts:269` (dołącza `qualityFlags`, nie blokuje). Brak scoringu całej karty (formula
nie obejmuje `task`).

| id | nazwa (pl) | próg per-karta | rola AI | kompozycja |
|---|---|---|---|---|
| description-scope | Opis i zakres | DO DECYZJI · doradczo `description minWords≥15` (klucz walidatora `description`) | AI pisze | **rdzeń** (`:496`), domyślna |
| implementation | Pomysły realizacji | DO DECYZJI · doradczo `strategy minWords≥10` + mierzalny `expectedOutcome` (`:97`) | AI pisze | domyślna |
| risk-alternatives | Ryzyko i alternatywy | DO DECYZJI · doradczo `risk risks≥2` (`:90`) | AI pisze | domyślna |
| checklist | Lista kontrolna | DO DECYZJI · doradczo `execution checklist≥3` (`:95`) | AI pisze | domyślna |
| dependencies | Zależności | DO DECYZJI · pusty `[]` **jawnie dozwolony** (`:98-100`) | AI/dane | domyślna |
| evidence | Dowody | DO DECYZJI · doradczo `evidence≥2` (`:96`) | AI pisze | domyślna |
| governance | RACI i eskalacja | DO DECYZJI | AI-assist/dane | domyślna |
| comments | Komentarze | DO DECYZJI | transakcyjna | domyślna |
| attachments-links | Załączniki i powiązania | DO DECYZJI | dane | domyślna |
| activity-log | Aktywność | DO DECYZJI | systemowa | domyślna |

Zestaw domyślny = 10 (wszystkie); „minimal" = 3. Rdzeń = `description-scope`. **Rozjazd kluczy** jak w Decision:
id kart (`checklist`, `implementation`) ≠ klucze walidatora (`execution`, `strategy`) — mapowanie niejawne.

### 3.5 INTERVIEW · TOOL · NOTIFICATION — 0 kart-treści (3 sieroty)
Żaden z tych trzech nie ma zestawu kart ani kontraktu treści (szczegóły i rekomendacja w sekcji 5).

**Suma: 65 kart-treści** w 4 artefaktach niosących karty (Insight 18 · Initiative 29 · Decision 8 · Task 10)
+ 3 sieroty z 0 kart.

---

## 4. ROZSTRZYGNIĘCIE DWÓCH SYSTEMÓW (cardSets.ts vs Initiative SECTION_REGISTRY)

**Fakt:** istnieją DWA równoległe systemy zarządzania kartami, bez żadnej specyfikacji, która by je godziła:
- **System A — `cardSets.ts`**: katalog + zestawy + `core`, egzekwowane w UI (`NModeCardManager`, „Remove
  non-core only"). Obsługuje **Insight, Decision, Task** (i formalnie Initiative — ale to martwe, patrz niżej).
- **System B — Initiative `SECTION_REGISTRY` + `DEFAULT_VISIBLE_SECTIONS` + szablony** (`initiative_templates.
  visible_sections/section_order`). Kompletnie inny mechanizm; sterowany per-inicjatywa szablonem z DB.

**Dowód, że Initiative NIE używa cardSets:** `InitiativeDocumentView.tsx` czyta `SECTION_REGISTRY` /
`DEFAULT_VISIBLE_SECTIONS` z `./sections/registry.ts` (audyt `:148`), a `INITIATIVE_SPEC` w `cardSets.ts:228-411`
nie jest importowany przez żaden żywy render Initiative → **martwe dane** (dodatkowo: 25 kart w cardSets vs 29 w
registry — już się nie zgadzają).

**★ REKOMENDACJA (nie decyzja — do akceptu Piotra): kanonem czynimy MODEL cardSets, ale w wersji „katalog +
zestawy" ROZSZERZONEJ o zdolność szablonową Initiative** — czyli:
- **Jeden słownik struktury** (`id · label · core · group`) dla wszystkich 7 typów, jak w cardSets — bo to on
  jest już wpięty w bramkę UI (`NModeCardManager`) i to jego model („nieusuwalny core") faktycznie coś wymusza.
- **Zestawy nazwane** (`default/minimal/full`) zostają — a mechanizm szablonów Initiative (`visible_sections`
  per-inicjatywa) staje się po prostu „zestawem generowanym z szablonu", nie osobnym systemem.
- **Initiative schodzi do wspólnego słownika:** 29 sekcji registry przepisujemy na wpisy katalogu; martwy
  `INITIATIVE_SPEC` w cardSets kasujemy albo zastępujemy wygenerowanym z registry.

**Uzasadnienie:** cardSets już dziś (1) jest jedynym miejscem z pojęciem „nieusuwalna karta" faktycznie
egzekwowanym w UI, (2) obsługuje 3 z 4 artefaktów niosących karty, (3) jest czystymi danymi (bez React),
więc da się nim dzielić z serwerem/testami/bramką. System Initiative jest bogatszy (per-inicjatywa), ale to
bogactwo to CECHA zestawu, nie powód na drugi silnik. **Alternatywa** (uznać dwa kanony na stałe) oznacza, że
Initiative — największa karta — rozjeżdża się z resztą **z definicji**, nie przez zaniedbanie.

To jest decyzja **P-1** z audytu i „determinuje CAŁĄ standaryzację" — dlatego trafia na górę listy do Piotra.

---

## 5. TRZY SIEROTY — Interview · Tool · Notification

Żadna nie ma dziś zestawu kart ani kontraktu treści (potwierdzone grepem — brak `*_SECTIONS`/karty N):

- **Interview** — ma warsztat (`InterviewWorkspace.tsx`, `TemplateBuilder.tsx`) z „sekcjami", ale to są
  **sekcje szablonu wywiadu (pytania)**, nie karty-treści AI. Produktem Interview jest artefakt **Insight**
  (który kontrakt kart MA). **Rekomendacja: ŚWIADOMIE ZWOLNIĆ z kontraktu kart** — powód: Interview nie jest
  artefaktem-dokumentem z kartami, tylko narzędziem zasilającym Insight. (Do potwierdzenia przez Piotra.)
- **Tool** — jedyne „karty" to `ToolCard` w `ToolsShowcasePage.tsx:72` = kafelek showcase (marketing), nie karta
  N-mode z treścią AI. **Rekomendacja: ZWOLNIĆ** — powód: Tool to ekran-katalog narzędzi, nie obiekt-dokument.
  (Do potwierdzenia; jeśli „Tool Document" ma mieć karty — to osobny temat, dziś kodu brak.)
- **Notification** — brak jakiejkolwiek struktury kart (grep pusto). **Rekomendacja: ZWOLNIĆ (klasa systemowa)**
  — powód: notyfikacja to komunikat/rekord zdarzenia, nie dokument z sekcjami pisanymi przez AI.

**Zasada dla SSOT:** sierotę zwolnioną wpisujemy do dokumentu z JAWNYM powodem (jak wyżej), żeby „zwolniona"
nie znaczyło „zapomniana". Jeśli Piotr chce którejś nadać karty — przestaje być sierotą i wchodzi do tabeli
master jak reszta.

---

## 6. DOKUMENTY-WIDMA DO USUNIĘCIA / PRZEPIĘCIA

Odnośniki z żywego kodu/docy do plików, których **NIE MA w repo** (potwierdzone `find`). Każdy trzeba przepiąć
na ten SSOT albo skasować:

| Widmo (nie istnieje) | Cytowane w | Akcja |
|---|---|---|
| `_WZORZEC_N_KARTY_DOKUMENTACJA_2026-07-07.md §3.5` | `cardSets.ts:5,26` (nagłówek „SSOT") | przepiąć na ten SSOT |
| `_ARTEFAKTY_MENU_STRUKTURA_2026-07-06.md` | `cardSets.ts:27` (`@see`) | skasować odnośnik / przepiąć |
| `_ARTEFAKTY_TRESC_KART_BCG_2026-07-06.md §0` | `cardContentValidator.ts:4` (nagłówek „SSOT") | przepiąć na `CARD_CONTENT_FORMULA.md` (istnieje) + ten SSOT |
| `_FORMULA_TRESCI_INSIGHT` | wskazany w zadaniu jako cytowany; w tym worktree `find` = brak | zweryfikować miejsce cytatu i przepiąć/skasować |

**Uwaga:** `docs/standards/CARD_CONTENT_FORMULA.md` oraz `docs/ui-standards/01-shell-layout/n-mode-card-standard.md`
**ISTNIEJĄ** — to nie są widma (choć n-mode jest przestarzały, patrz niżej). Cel jest dokładnie ten sam co
bramka §5.5 z SPEC-N: „dokumentacja ma nie kłamać".

**`n-mode-card-standard.md` (2026-05-01, `:4`) — nie widmo, ale ROZJAZD.** Niesie taksonomię „domyślna /
opcjonalna / wymagana" (`:42`), ale jest cytowany tylko przez inne docy (CANON/README), przez **żaden** plik
`.ts/.tsx`, a jego katalog kart nie pokrywa się z `cardSets.ts` (dwa różne słowniki udające jeden standard).
Do rozstrzygnięcia w decyzji P-5: zaktualizować do stanu kodu i uczynić żywym, albo oznaczyć jako historię i
zbudować taksonomię z tego SSOT.

---

## 7. ★ DO DECYZJI PIOTRA (krótko — tylko realne wybory)

**Progi (liczby, których w kodzie NIE MA):**
- **D-1. Próg kompletności per-karta.** Czy w ogóle wprowadzamy „karta gotowa w X%"? Jeśli tak — jedna liczba
  globalna, czy per-karta? Dziś istnieje tylko scoring CAŁEJ karty ≥90 (Insight/Initiative) i doradcze minima pól.
- **D-2. Próg `gates.readinessScore`.** Przy jakim wyniku (0–100) rekomendacja = PROCEED? W kodzie FE brak liczby.
- **D-3. Minima pól = bramka czy dalej porada?** Dziś `successCriteria≥4`, `checklist≥3` itd. są DORADCZE.
  Awansujemy któreś do twardej bramki wejścia na demo?

**Kompozycja (które karty domyślne / wymagane):**
- **D-4. Rdzeń (nieusuwalne).** Dziś: Insight = `artifact-actions`+`executive-summary`; Decision = `context-problem`;
  Task = `description-scope`; Initiative = brak `core` w żywym systemie (registry nie ma pojęcia core).
  Zatwierdzamy tę listę czy zmieniamy? Czy Initiative dostaje rdzeń (kandydaci: problemDefinition, control)?
- **D-5. Zestaw domyślny Initiative.** Dziś „pokaż wszystko" (24/29 `DEFAULT_VISIBLE=true`). Zostaje, czy tniemy
  do węższego domyślnego (jak `minimal` u innych)?

**Sieroty:**
- **D-6.** Zwalniamy Interview, Tool, Notification z kontraktu kart (z powodami z sekcji 5) — TAK/NIE per sztuka?

**System (najważniejsze):**
- **D-7. Jeden system kart czy dwa?** (audyt P-1) Schodzimy Initiative do wspólnego modelu cardSets (rekomendacja
  §4), czy zostają dwa kanony? Ta decyzja determinuje resztę.
- **D-8. Egzekwowanie jak przy tabelach?** Kontrakt karty staje się WARUNKIEM wejścia na demo (typ + bramka, jak
  `StandardTable`), czy zostaje konwencją (godzimy się na rozjazd)? (audyt P-3)
- **D-9. `n-mode-card-standard.md`** — aktualizujemy do kodu (żywy SSOT), czy oznaczamy jako historię? (audyt P-5)

---

## 8. CZEGO NIE ZWERYFIKOWANO (uczciwie)

- **Osobiście otwarte i sprawdzone (dowód z pierwszej ręki):** `cardSets.ts` (cały), `registry.ts` (cały),
  `cardContentValidator.ts` (cały, + brak callera w Decision), `cardContentFormulaValidator.ts` (próg 90, CardKind),
  `initiativeCardValidators.ts` (§B3, długość 120–250), `n-mode-card-standard.md` (data), istnienie/brak
  dokumentów-widm (`find`), callerzy walidatorów (`grep`).
- **Przyjęte z inwentarza (OŚ 1), NIE re-otwierane osobiście:** wszystkie numery `529:*`/`530:*` (DB
  `initiative_section_types`, prompty), `initiativeGeneratorBrain.ts:*` (CORE/OPTIONAL, „enum dead per F0"),
  `initiativeGenerationService.ts:141` (`REVIEW_PASS_THRESHOLD=90`), `completenessConfigs.ts:*` (pola krytyczne),
  `ProblemDefinitionSection.tsx:248` (display %). Traktować jako do potwierdzenia przy egzekwowaniu.
- **Treść kart czytana z KODU** (walidatory, cardSets, prompty), **nie z żywej bazy demo** — realny stan
  rekordów niesprawdzony.
- **Liczby z raportów bez re-runu:** „18/19 kart Insight poniżej progu" i „0/63 podpowiedzi podaje próg"
  (audyt `:122-123`) — nie odtwarzane na żywej bazie. Uwaga: katalog Insight w kodzie liczy **18** kart, nie 19.
- **Katalog `n-mode` vs `cardSets`** — rozjazd stwierdzony na PRÓBCE id, nie policzony pozycja po pozycji.
- **Nie uruchamiano** pełnego `tsc`/`vitest` (zakaz). **Nie audytowano** wzorca W (SWOT, Mind Map…) — poza zakresem.
- **Rola AI per-karta** dla Insight/Task/Decision podana zgrubnie (AI pisze / dane / systemowa) na podstawie
  istnienia serwisu generacji — nie prześledzono generacji każdej sekcji z osobna.

---

### Aneks — kluczowe dowody (plik:linia)

- **Dwa systemy:** `cardSets.ts:32,580` (typy insight/initiative/decision/task) · Initiative `registry.ts:50-83,138-170`.
- **Initiative w cardSets = martwe:** `cardSets.ts:228-411` (`INITIATIVE_SPEC`, 25 kart) nie importowany przez render Initiative.
- **Próg scoringu 90:** `cardContentFormulaValidator.ts:48,52,59` (`PASS_THRESHOLD=90`, §B4), `:484` (logika pass), `:33` (`CardKind='insight'|'initiative'`).
- **Minima pól doradcze:** `cardContentValidator.ts:78-101` (`SECTION_REQUIREMENTS`), `:21-22,375` (ADVISORY ONLY), `:305` (fallback minWords 8/12).
- **Decision = kontrakt-widmo:** reguły `cardContentValidator.ts:88-92`, brak callera w `decisionService.ts`/`DecisionController.ts` (grep pusto).
- **Realni wołający treści:** Task `taskSectionGenerationService.ts:269`; Initiative fill `initiativeSectionFill.ts:462`; Insight `InterviewInsightService.ts:2401,2438` + `insightMaterializationService.ts:464`; Initiative karta §B3 `InitiativeController.ts:6007` → `initiativeCardValidators.ts:103`.
- **§B3 długość problemu:** `initiativeCardValidators.ts:15,133` (`problem_len` 120–250 słów).
- **Rdzeń (core):** Insight `cardSets.ts:78,85`; Initiative(martwe) `:236,307`; Decision `:418`; Task `:496`.
- **Watchers placeholder:** `registry.ts:82` (`watchers: OverviewSection`), `:166` (`DEFAULT_VISIBLE=false`).
- **Widma:** `find` = brak dla `_WZORZEC_N_KARTY_DOKUMENTACJA_2026-07-07`, `_ARTEFAKTY_TRESC_KART_BCG_2026-07-06`,
  `_ARTEFAKTY_MENU_STRUKTURA_2026-07-06`; cytaty w `cardSets.ts:5,26,27` i `cardContentValidator.ts:4`.
- **Realne docy:** `docs/standards/CARD_CONTENT_FORMULA.md`, `docs/ui-standards/01-shell-layout/n-mode-card-standard.md:4` (2026-05-01).
- **Plan złączenia (otwarty):** `_SPEC_N_KARTY_2026-07-21.md:98` (StandardTable vs NModeShell), `:285,292` (DEC-010), `:64` („§4 … otwarte", 0/63 podpowiedzi podaje próg).
