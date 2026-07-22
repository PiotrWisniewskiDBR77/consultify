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

## 0. ★★ DECYZJE PIOTRA 2026-07-22 — ZABLOKOWANE (buduj do nich)

> Ta fala (2026-07-22) domyka kontrakt: **dwa systemy → jeden kanon**. Piotr zablokował 5 decyzji
> architektonicznych. Poniżej — literalnie, z ich rozstrzygnięciem. To **unieważnia** wcześniejsze
> „rekomendacje (nie decyzje)" z §4 i §5 tam, gdzie się różnią (banery przy §4/§5).
>
> **Nowe artefakty tej fali:** `_KANON_KARTY_MODEL_2026-07-22.md` (SSOT modelu — jeden schemat 9-pól,
> katalog zunifikowany 51 id, kompozycja), zalążek typu `src/components/standard/cardContract.types.ts`
> (NIEUŻYWANY, zero konsumentów), bramka `scripts/check-artefakt-struktura.mjs` (tryb raportu). Ten kontrakt
> je **WPINA** (§8), dokłada **plan migracji POC-first** (§9) i **drugą turę decyzji** (§10).

| # | Decyzja | Rozstrzygnięcie (ZABLOKOWANE) | Dowód / gdzie zrealizowane |
|---|---------|-------------------------------|----------------------------|
| **D-7** | **SYSTEM: jeden kanon czy dwa?** | **JEDEN kanon, wypracowany best-of.** Cyt. Piotr: *„weź najlepsze z tego jak wyglądają Decyzje i Taski (bo już wyglądają dobrze), weź najlepsze z Inicjatyw, stwórz jeden kanon i użyj go jako standard."* → **NIE** „cardSets kasuje Initiative". **Nadzbiór:** model cardSets jako baza (czyste dane, egzekwuje `core`) **WCHŁANIA** najlepsze z Initiative (szablony/widoczność per-instancja, bogaty katalog, `ai_prompt` per sekcja). | KANON §1 (9-pól best-of), §3.3 (szablony wchłonięte); rozstrzyga §4/P-1 |
| **D-8** | **EGZEKWOWANIE: konwencja czy wiążące?** | **WIĄŻĄCE — typ + bramka jak `StandardTable` (nie da się obejść).** `cardContract.types.ts` = zalążek typu (stany niedozwolone = **błąd kompilacji**); `check-artefakt-struktura.mjs` = zalążek bramki strukturalnej. | KANON §4; typ §4.1-4.3, bramka §4.4; zweryfikowane runtime (§8.4) |
| **D-6** | **SIEROTY: zwolnić czy objąć?** | **WSZYSTKIE 7 artefaktów POD kontraktem** — Interview/Tool/Notification też, z ich klasą/redukcją **uzasadnioną**, ale W kontrakcie, nie zwolnione po cichu. **Unieważnia** rekomendację §5 („ZWOLNIĆ"). | KANON §3.4; baner przy §5; §8.3 |
| **D-4** | **RDZEŃ (nieusuwalny) per artefakt.** | **Każdy artefakt ma RDZEŃ nieusuwalny.** Initiative dostaje rdzeń **`overview` + `control`** (dziś registry nie zna `core`; już zadeklarowane w martwym cardSets). Reszta bez zmian (§8.3). | KANON §3.2; `cardSets.ts:235,307` (zweryfik. `core:true`) |
| **D-5** | **ZESTAW DOMYŚLNY: „pokaż wszystko" czy węższy?** | **WĘŻSZY zestaw domyślny** (nie „pokaż wszystko"). Initiative schodzi z 24/29 widocznych do węższego (kandydat = dzisiejszy `minimal` = 7: overview, problemDefinition, targetState, scope, tasks, kpis, control). | KANON §3.1; `cardSets.ts:377` (minimal), `registry.ts:138-170` |

**★ Liczba po dedupie: 51 kart kanonicznych** (65 żywych instancji − 14 dubli). **★ Rekomendowany POC: Decision** (§9).

**Co pozostaje OTWARTE (druga tura, §10):** progi treści **D-1/D-2/D-3** + granularne rozjazdy
(competencyRequirements/skillsGap, raciEscalation↔raci, material-quality/traceability, candidate-triage,
watchers, financialAnalysis) + **D-9** (n-mode-card-standard.md). Te **NIE blokują struktury** —
struktura (D-4..D-8) jest zamknięta.

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

> **★ ZAKTUALIZOWANE 07-22 — D-7 ROZSTRZYGA (§0):** poniższa „★ REKOMENDACJA (nie decyzja)" jest już
> **DECYZJĄ**. Jeden kanon, best-of: **model cardSets jako baza WCHŁANIA bogactwo Initiative** (szablony,
> katalog, `ai_prompt` per sekcja) — nie „Initiative schodzi do uboższego cardSets". Rozwinięcie:
> `_KANON_KARTY_MODEL` §1 (9-pól best-of) + §3.3 (szablony jako „zestaw generowany", jeden model danych).
> Poniższy tekst zostaje jako zapis rozumowania.

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

> **★ ZAKTUALIZOWANE 07-22 — D-6 UNIEWAŻNIA „ZWOLNIĆ" (§0):** Piotr zdecydował, że **wszystkie 7 artefaktów
> są POD kontraktem** — także te trzy. **Nie zwalniamy** — obejmujemy z **jawną klasą/redukcją**:
> Notification (S, bez Komentarzy — plan K2), Tool (S, ≤4 sekcje), Interview (L, produkt = Insight).
> Kompozycje sierot: §8.3 tu + `_KANON_KARTY_MODEL` §3.4. Poniższe „rekomendacje ZWOLNIĆ" zostają jako ślad
> rozumowania — **nadpisane** przez D-6 (sierota jest w kontrakcie z uzasadnioną redukcją, nie poza standardem).

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

> **★ STATUS 07-22:** **D-4, D-5, D-6, D-7, D-8 ZABLOKOWANE** (§0 — nie są już „do decyzji"). Lista poniżej
> zachowana jako pełny zapis; **wiążące rozstrzygnięcia patrz §0**. Nadal OTWARTE (druga tura, §10):
> **D-1, D-2, D-3** (progi treści), **D-9** (n-mode-card-standard.md) + granularne rozjazdy (§2.3 KANONU).

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

## 8. ★ KANON WPIĘTY — model, katalog zunifikowany, kompozycje (D-7)

**SSOT modelu = `_KANON_KARTY_MODEL_2026-07-22.md`.** Ten kontrakt go WPINA — **nie** dubluje 51 wierszy
(dublowanie samo w sobie byłoby rozjazdem, z którym walczy cała fala). Poniżej: streszczenie modelu +
katalog rodzinami + 5 kart wspólnych (sedno dedup) + kompozycje per artefakt.

### 8.1 Model karty — 9 pól (best-of A+B)

Schemat §2 (6 pól) rozszerza się do **9 pól** kanonu. Dochodzą trzy, których DZIŚ NIE MA jako deklaracja:

| # | Pole | Skąd (best-of) | Uwaga |
|---|------|----------------|-------|
| 1-4 | id · label{en,pl} · opis · grupa | A `cardSets` + B `description`/`category` | id = section-id (kod=prawda) |
| 5 | **rola_AI** (`pisze`·`asystuje`·`dane`·`systemowa`·`transakcyjna`) | **NOWE** | dziś rozproszona w promptach |
| 6 | **ai_prompt** (szablon albo jawny brak z powodem) | B `ai_prompt_template` | „milczenie" staje się niewyrażalne |
| 7 | **prog** | **NOWE — placeholder** | brak w kodzie per-karta → `do-decyzji-piotra` (D-1) |
| 8 | **kompozycja** (rdzeń·domyślna·dodawalna·ukryta, per artefakt) | A `core` + B `column`/`order`/szablon | krotka niepusta = błąd gdy brak |
| 9 | **klasa artefaktu** S/L | **NOWE** (SSOT `standard/registry.ts:46`) | S ⇒ ≤4 sekcje |

Pełny schemat: KANON §1. Egzekwowanie: typ `cardContract.types.ts` (§8.4).

### 8.2 Katalog zunifikowany — 51 kanonicznych id (dedup)

**65 żywych instancji** (Insight 18 · Initiative 29 · Decision 8 · Task 10) **− 14 dubli = 51 kanonicznych.**
Rodziny (KANON §2.2, pełne 51 wierszy z dowodem `plik:linia`): **Insight 16 · Initiative 21 · Decision 4 ·
Task 5 · Wspólne 5 = 51.** Pięć kart WSPÓLNYCH to sedno dedup — jeden wpis kanoniczny dla wielu artefaktów:

| kanoniczny id | występuje w (po dedup) | wchłania (aliasy) | dowód |
|---|---|---|---|
| `comments` | Insight·Initiative·Decision·Task | — | cardSets.ts:162,296,450,535 |
| `activity-log` | Insight·Decision·Task·Initiative | Initiative **`history`** | cardSets.ts:168,462,547; registry.ts:154 |
| `attachments` | Initiative·Task·Decision | Task **`attachments-links`**, Decision **`resources-links`**, Initiative **`linkedItems`** | cardSets.ts:330,541,456 |
| `dependencies` | Initiative·Task | — | registry.ts:160; cardSets.ts:522 |
| `governance` | Decision·Task·Initiative | Decision **`governance-escalation`**, Initiative **`raciEscalation`** (rozjazd klucza) | cardSets.ts:444,529 |

Zdjęte 14 dubli: `comments` 4→1, `activity-log`(+`history`) 4→1, `attachments`(+2 aliasy) 3→1,
`dependencies` 2→1, `governance`(+alias) 2→1, plus legacy `initiativeTeam`→`team`, `linkedItems`→`attachments`,
`watchers`→placeholder.

### 8.3 Kompozycje per artefakt (rdzeń · domyślny · dodawalne) — D-4/D-5/D-6

Legenda: **rdzeń** = nieusuwalny (tylko chowany) · **domyślny** = węższy zestaw startowy (nie „pokaż wszystko")
· **dodawalne/ukryte** = w katalogu, poza domyślnym.

| artefakt | klasa | rdzeń (D-4) | zestaw domyślny (D-5) | dodawalne / ukryte | dowód |
|---|:--:|---|---|---|---|
| **Insight** | L | artifact-actions · executive-summary | 12/18 (`sets[0]`) | +6 „full": people, signals, analysis-matrix, consensus-divergence, implicit-assumptions, silences | cardSets.ts:78,85,176-192 |
| **Decision** | L | context-problem | 8 (wszystkie; „minimal"=4) | — (katalog = domyślny) | cardSets.ts:418 |
| **Task** | L | description-scope | 10 (wszystkie; „minimal"=3) | — | cardSets.ts:496 |
| **Initiative** | L | ★ **overview + control** (NOWE — D-4) | ★ **węższy** (D-5: kandydat „minimal"=7: overview, problemDefinition, targetState, scope, tasks, kpis, control) | reszta 22 dodawalne; `pilot`/`watchers`/`initiativeTeam`/`linkedItems` ukryte | registry.ts:140-170; cardSets.ts:377 |
| **Notification** | S | treść wiadomości | Właściwości + Historia | `comments` **pominięta z powodem** (plan K2) | KANON §3.4 (D-6) |
| **Tool** | S | katalog narzędzia | ≤4 sekcje | rola AI = `dane`/`asystuje`, prompt = jawny brak | KANON §3.4 (D-6) |
| **Interview** | L | produkt = Insight | minimalny (sekcje = pytania szablonu) | DO DECYZJI: własne karty-treści (§10) | KANON §3.4 (D-6) |

**9 kart ROZJECHANYCH** (jawny werdykt, nie znikają po cichu): `competencyRequirements`/`skillsGap` (brak
wiersza DB), `financialAnalysis` (enum „dead per F0"), `initiativeTeam`/`linkedItems` (martwe dublety),
`watchers` (placeholder), `raciEscalation` (rozjazd klucza `raci`), `material-quality`/`traceability`
(tylko DOC „wymagane"), `candidate-triage` (label drift sensu) — pełne trasy: KANON §2.3; decyzje → §10.

### 8.4 Egzekwowanie (D-8) — typ + bramka, zweryfikowane runtime

- **Typ** `src/components/standard/cardContract.types.ts` (NOWY, nieużywany): karta bez `id`/`label`/`rolaAI`/
  `kompozycji`, albo „AI pisze bez promptu", albo `kompozycja:[]` = **błąd kompilacji** (unia dyskryminowana +
  krotka niepusta + brandowane typy-błędy PL). Reużywa `KartaNKey`/`KartaNKlasa` z `standard/registry.ts`
  (jeden SSOT klasy S/L — **zweryfikowane**: eksporty `registry.ts:32,46,84`). **esbuild transform seed = exit 0.**
- **Bramka** `scripts/check-artefakt-struktura.mjs` (JUŻ istnieje, tryb raportu): skanuje 7 artefaktów AST-lite —
  montaż NModeHeader, `ArtifactRightPanel`, kanoniczna kolejność sekcji, crimson w centrum. **Zweryfikowane
  runtime: 7 artefaktów, exit 0**; wszystkie montują NModeHeader + ArtifactRightPanel; Insight strukturalnie
  czysty, 6 z baseline długu (crimson/kolejność). `--strict` awansuje FLAGĘ do exit 1 — moment wymagalności = D-8/§10.

Warstwy są **komplementarne**: typ łapie schemat karty na literałach (miejsce wywołania), bramka łapie montaż
powłoki i (faza kompozycji) rozjazd id kod↔katalog + `klasa` vs `REJESTR_KART_N` (KANON §4.4).

---

## 9. ★ PLAN MIGRACJI POC-FIRST (reguła CLAUDE.md #9 — NIE hurtem)

**Zasada:** to jest PROJEKT (dokumenty + zalążek typu). Migracja 7 artefaktów = OSOBNY etap PO akcepcie Piotra,
**jeden po drugim za flagą OFF** (reguła #9: krach 07-12 „tabelki jak dla trzylatka" = masowe włączenie).

### KROK 0 — GOTOWE (ta fala, zero zmian w produkcie)
Dokumenty (kanon + kontrakt + 3 mapy) + zalążek typu `cardContract.types.ts` (nieużywany) + bramka
`check-artefakt-struktura.mjs` (tryb raportu). Zero edycji 7 artefaktów.

### KROK 1 — POC na JEDNYM artefakcie: **Decision** (rekomendacja)

**Dlaczego Decision** (a nie Task/Insight/Initiative):
- **Najmniejsza powierzchnia** (8 kart) → najszybsza weryfikacja, najmniejszy blast radius (duch reguły #9).
- Już na `cardSets` = **baza kanonu D-7**; rdzeń `context-problem` **bez zmian** (czysto).
- **Ćwiczy najtrudniejszą część na najmniejszej powierzchni:** 4 z 8 kart to karty wspólne/aliasowane
  (`governance-escalation`→`governance` #51, `resources-links`→`attachments` #49, `activity-log` #48,
  `comments` #47) — POC waliduje dedup + rozwiązywanie aliasów, zanim dotknie większych artefaktów.
- Decision jest dziś FLAGA w bramce (crimson/kolejność w centrum) — adopcja kontraktu + `--strict` na Decision
  domyka też ten dług na małej powierzchni (bonus: dowód, że bramka działa end-to-end).
- *Kontr-kandydat Task* = bliźniak (10 kart, cardSets, rdzeń `description-scope`) + ma **żywego wołacza treści**
  (`taskSectionGenerationService.ts:269`) — ale ścieżka treści NIE jest przedmiotem tego POC (progi = D-1/D-2/D-3,
  druga tura). Dlatego mniejsze Decision wygrywa; Task = natychmiastowy fast-follow #1 (§KROK 2).

**Zakres POC (za flagą OFF):**
1. Adapter `DECISION_SPEC` (cardSets) → `KanonicznaKarta[]` przez `definiujKarteKanoniczna` (rola AI + prompt/jawny
   brak + kompozycja rdzeń/domyślny + klasa L per karta).
2. Wpięcie za flagą **default OFF** (reguła #7 — Piotr nie jest pierwszym testerem wizualnym).
3. Bramka `check-artefakt-struktura.mjs --strict` na Decision = zielono (twarde defekty domknięte).
4. **JA renderuję** DecisionDetailView w harnessie z mock-danymi (wzór: harness EV football-field), **oba motywy
   (dark+light)**, **zrzut czysty** (zero gwiazdek/ozdób, tokeny c-*).
5. Higiena: tsc **zakresowy** na adapterze (esbuild per plik), **NIE** pełny tsc/vitest.

**BRAMA:** akcept Piotra na zrzutach (do AKCEPTU, nie do odkrywania zepsucia) **PRZED** KROK 2. Po akcepcie →
flaga domyślna + re-tag `demo-safe-<data>` (reguła #8).

### KROK 2 — po akcepcie: eskadra migruje pozostałe 6 (per artefakt, POC-first każdy)

Kolejność od najbliższego kanonu do najtrudniejszego:

| # | artefakt | dlaczego tu | główne ryzyko |
|---|----------|-------------|---------------|
| 1 | **Task** | bliźniak Decision + żywy wołacz treści (testuje ścieżkę prompt/rola) | niskie |
| 2 | **Insight** | 16 kart, **prawdziwy** węższy domyślny 12/18 — testuje mechanikę „domyślny vs full" | średnie (najwięcej kart pisanych AI) |
| 3 | **Initiative** | **NAJTRUDNIEJSZY** — osobny, ostrożny blok | **wysokie** (patrz R1) |
| 4-6 | **Tool · Notification · Interview** | sieroty (D-6) — najlżejsze, ale wymagają **jawnej redukcji** w kontrakcie | niskie, ale nowa mechanika „pominięta sekcja" |

Każdy artefakt = ta sama pętla: flaga OFF → adapter → bramka `--strict` zielona → harness oba motywy → zrzut →
akcept Piotra → flaga domyślna + re-tag. **Nigdy dwa naraz** (reguła #9).

### Ryzyka i mitygacje
- **R1 — regresja Initiative** (największy artefakt: szablony DB, org-custom, 2 kolumny, `ai_prompt` per sekcja).
  Mitygacja: Initiative **OSTATNI** (po ograniu wzorca na 3 prostych); adapter **addytywny**, dane DB **nietknięte**
  (DWA_SYSTEMY §4 „hybryda: kontrakt=nadzbiór B + UI=A"); nowy rdzeń `overview`+`control` już zadeklarowany w kodzie.
- **R2 — rozjazd id kod↔katalog** przy adapterze. Mitygacja: bramka test (e) „każda renderowana sekcja ma wpis w
  katalogu i odwrotnie" (KANON §4.4) — rozjazd = FLAGA.
- **R3 — złe zmapowanie aliasów** shared cards (`governance-escalation` vs `governance`, `resources-links` vs
  `attachments`). Mitygacja: Decision POC ćwiczy to **pierwsze**, na małej powierzchni.
- **R4 — masowe włączenie** (krach 07-12). Mitygacja: reguła #9 — jeden po drugim, za flagą, akcept per zrzut.

### Punkty cofnięcia (reguła #8 — `_RUNBOOK_COFANIA.md`)
- Każdy artefakt za flagą OFF → **dramat wizualny = flaga OFF natychmiast**.
- Bezpieczny punkt = tag `demo-safe-<data>`, re-tagowany po każdym akcepcie.
- Adapter **addytywny** (nie kasuje `cardSets`/`registry`, aż wszystkie zielone) → rollback = usuń wpięcie, stary
  render wraca bez migracji danych.
- Zły deploy → Railway rollback / `git revert` (**NIGDY** force-push na demo).

---

## 10. ★ DRUGA TURA DECYZJI PIOTRA (teed-up — NIE blokuje struktury)

Struktura (D-4..D-8) zamknięta (§0). Poniższe to progi treści + granularne rozjazdy — **do rozstrzygnięcia po
POC**, nie warunkują wpięcia kontraktu. Żadnej liczby nie wymyślamy (brak w kodzie = decyzja Piotra).

**Progi treści (liczby, których w kodzie NIE MA):**
- **D-1. Próg per-karta.** Wprowadzamy „karta gotowa w X%"? Jedna liczba globalna czy per-karta? Dziś tylko
  scoring CAŁEJ karty ≥90 (Insight/Initiative, `cardContentFormulaValidator.ts:59`) + doradcze minima pól.
- **D-2. `gates.readinessScore` → PROCEED przy ilu?** (0–100; w FE brak liczby odcięcia).
- **D-3. Minima pól = bramka czy dalej porada?** Dziś `successCriteria≥4`, `checklist≥3` = ADVISORY ONLY
  (`cardContentValidator.ts:21-22`). Awansujemy któreś do twardej bramki wejścia na demo?

**Granularne rozjazdy (§2.3 KANONU — każda karta ma trasę, ale wybór należy do Piotra):**
- `competencyRequirements` / `skillsGap` — **zaseedować w DB** czy zostawić fallback-only? (brak wiersza DB dziś)
- `raciEscalation` vs `raci` — **który klucz kanoniczny?** (DB/nawigacja=`raci`, registry=`raciEscalation`)
- `material-quality` / `traceability` — **zbudować** (luka implementacji) czy **skreślić** (DOC przeterminowany)?
- `candidate-triage` — **jedna karta czy dwie?** (KOD „Wnioski i dowody" vs DOC „Triage kandydatów" — różnica sensu)
- `watchers` — **własny UI** czy **skreślić**? (dziś mapuje na `OverviewSection`, placeholder)
- `financialAnalysis` — **żywy enum czy martwy?** (DB aktywna, komentarz „enum is dead per F0")
- `recommendation` (DOC-only) — do backlogu czy skreślić?

**Zakres modelu (DWA_SYSTEMY §5):**
- Czy 3 proste artefakty (Insight/Task/Decision) też dostają **katalog w DB**, czy zostają statyczne?
- Czy **customizacja org-level** obejmuje proste 3, czy tylko Initiative?
- **Persystencja:** ujednolicić do serwera (DB) czy zostawić localStorage dla lekkiej warstwy?

**Dokumentacja:**
- **D-9. `n-mode-card-standard.md`** — aktualizować do kodu (żywy SSOT) czy oznaczyć jako HISTORIĘ? (ROZJAZD §4
  rekomenduje HISTORIĘ; `_FORMULA_TRESCI_INSIGHT_2026-07-13.md` — port na demo, WIDMA §2 poz. 6.)

---

## 11. CZEGO NIE ZWERYFIKOWANO (uczciwie)

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
