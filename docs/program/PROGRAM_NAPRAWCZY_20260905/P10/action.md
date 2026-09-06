# Karta działania — kontrakt karty N (P10-B6, DEC-429)

> **Rozstrzygnięcie CTO (P10-B6): `ActionCard` JEST kartą N.** Inwentarz stawiał to pod znak
> zapytania („to kafel w liście, nie ekran otwierany z tożsamością", `INWENTARZ_KART_N_PELNY.md` §2
> wiersz #9). Rozstrzygam na TAK, bo: (a) właściciel odebrał ją w kręgosłupie wartości P7K —
> `docs/ssot/KREGOSLUP_WARTOSCI.md` §2.4 wiersze 21–22, `P9_KREGOSLUP_I_KARTA_DZIALANIA.md:21`
> („rejestruje się jako **ósma karta N**", DEC-2026-09-03-381); (b) jest wpisana w
> `src/components/standard/registry.ts:120` jako klucz `action`, klasa **S**.
> To, że dziś nie ma ekranu z tożsamością, jest **luką do usunięcia**, a nie powodem do wypisania
> jej z rejestru. Runda 2; zapis r1 w §8.
>
> **STOP pomiarowy podtrzymany.** Karty działania nie da się zobaczyć na żywo w DBR77: „Otwarte
> działania 0" we wszystkich trzech raportach KPI, a sekcja „Karty działania" karty miernika
> pokazuje stan pusty (`evidence/p10-matryca/15-action.png`). Rekord powstaje wyłącznie
> z odchylenia KPI — przepis w §6. Rekordu nie tworzyłem (dane pokazowe = twarz produktu).
> Wszystko poniżej jest zmierzone **z kodu**, i tak jest oznaczone.

## §0. Tożsamość

| pole | wartość |
|---|---|
| nazwa PL | Karta działania |
| moduł | `07_MY_WORK_AGENT` (Skrzynka) + Wyniki, Realizacja, Audyty, Finanse — jeden komponent na pięciu powierzchniach (`P9_KREGOSLUP_I_KARTA_DZIALANIA.md:9`) |
| archetyp | **C — Rekord**, klasa **S** (`registry.ts:120-126`) |
| trasa tożsamości | **BRAK** — nie istnieje ani trasa `:id`, ani `GET /api/action-cards/:id` (`server/src/routes/actionCards.routes.ts` ma tylko `GET /`, `POST /`, `PATCH /:id`, `POST /:id/close`, `POST /:id/task`) |
| jak otworzyć z listy | Skrzynka → wiersz `inbox-action-card-entry` rozwija kartę **w miejscu** (`InboxActionCards.tsx:127-145`); Wyniki → karta KPI → sekcja „Karty działania" (`KpiToolPage.tsx:1627`) |
| komponent | `src/components/standard/ActionCard.tsx:33` (123 linie) + `ActionCard.types.ts` + `ActionCardList.tsx` |
| powłoka | **brak** — renderowana inline w liście |
| rejestr | ✓ `action`, `statusMigracji: 'zmigrowana'`, `nazwa: 'Action'` |

**Dwie nieprawdy w rejestrze do poprawienia:** `statusMigracji: 'zmigrowana'` (karta nie ma powłoki,
Menu 5 ani AI — nie jest zmigrowana) oraz `nazwa: 'Action'` (nazwa techniczna zamiast „Karta działania").

## §1. SEKCJE

Kontrakt sekcji **nie istnieje** (K1 ✗): `ActionCard.types.ts` opisuje **model danych**, nie katalog
sekcji. Dziś centrum to jedna lista dziesięciu par etykieta/wartość (`ActionCard.tsx:45-59`).
Kontrakt zwarty (klasa S — maksymalnie 4 sekcje lewej kolumny):

| sekcja | po co użytkownikowi | źródło danych (API pole → writer) | reguła pustki | kolejność | S/L |
|---|---|---|---|---|---|
| **Opis** — problem, główna przyczyna, opis działania | co się stało i co robimy | `problem`, `rootCause`, `actionText` → `POST /api/action-cards` (`actionCards.routes.ts:42` → `actionCardService.ts:164`), edycja `PATCH /:id` (`:47` → `:201`) | brak opisu → „—" w wierszu; sekcja zostaje (to rdzeń karty) | 1 | S+L |
| **Źródło** — skąd wzięło się działanie | dlaczego ta karta w ogóle istnieje | `sourceKind` + `sourceId` (`ActionCard.types.ts:1-6`: `kpi_deviation`, `execution_delay`, `audit_finding`, `finance_variance`, `meeting_action`) → `createActionCard` (`actionCardService.ts:164`); dla KPI: `POST /api/v8/results/deviation-cases/:caseId/recovery-card` (`v8/results.routes.ts:1817`) | **nigdy pusta** — karta bez źródła nie ma prawa powstać | 2 | S+L |
| **Właściciel i termin** — odpowiedzialność, termin, okres, cel osiągnięty?, działania wymagane? | kto i do kiedy | `ownerName` (osoba, nie ID — `P9…:21`), `dueDate`, `periodStart/End`, `goalMet`, `actionRequired` → `createActionCard`/`updateActionCard` | brak właściciela → wiersz „—" i ostrzeżenie, nie ukrycie | 3 | S+L |
| **Akcje i status** — Utwórz zadanie · Zamknij kartę · komentarz | domknięcie pętli | `status` OPEN/CLOSED → `POST /:id/close` (`actionCards.routes.ts:53`); zadanie → `POST /:id/task` (`:78`); `comment` → `PATCH /:id` | status zawsze widoczny | 4 | S+L |

Dziesięć pól z ekranu pochodzi wprost z arkusza właściciela (`KREGOSLUP_WARTOSCI.md` §2.4) — kontrakt
ich **nie zmienia**, tylko grupuje w cztery sekcje, żeby zmieściły się w klasie S.

## §2. PRAWY PANEL

Panel **nie istnieje** (K6–K11 ✗) — karta nie ma powłoki. Kontrakt:

| sekcja | obowiązkowa? | treść |
|---|---|---|
| Akcje | ✓ | Utwórz zadanie · Zamknij kartę · Otwórz źródło (odchylenie/opóźnienie/ustalenie audytu) |
| Właściwości (**tabela** „Właściwość \| Wartość") | ✓ | Status → Właściciel → Waga (`severity` AMBER/RED) → Termin (`dueDate`) i Okres → Źródło (`sourceKind` po polsku + link) → Utworzono → Zaktualizowano |
| Powiązania | ✓ | zadanie utworzone z karty (`kpi_deviation_cases.linked_task_id`), sprawa odchylenia, miernik |
| Źródła i założenia | ✓ | pomiar, próg, okres, RCA — czyli z czego wynikła „główna przyczyna" |
| Komentarze | warunkowa | pole `comment` jest dziś jednym polem w treści; kontrakt: albo sekcja komentarzy, albo jawny powód pominięcia |
| Historia | ✓ | otwarcie · zmiana właściciela/terminu · utworzenie zadania · zamknięcie |

## §3. MENU 5 I NAWIGACJA

Nie istnieje (K12 ✗). Kontrakt:
* **Sekcje ▾** — cztery sekcje z §1.
* **Edycja / Podgląd** — prawo edycji = właściciel karty albo właściciel miernika; karta o statusie
  `CLOSED` jest **tylko do odczytu** i podaje powód („Karta zamknięta …") — wzorzec K14 działa
  w Wynikach (`12-metric.png`), tu ma być identyczny.
* **Pracuj z AI ▾** — patrz §4.
* **K26 — najważniejszy brak nawigacyjny:** `ActionCard` ma prop `onOpen` i przycisk „Otwórz kartę"
  (`ActionCard.tsx:105-109`), ale **żaden z trzech wołaczy go nie podaje** (`InboxActionCards.tsx:137`,
  `ResultsActionCards.tsx:8`, `ActionCardList` woła `KpiToolPage.tsx:1627` bez `onOpen`) — przycisk
  nigdy się nie renderuje. Kontrakt: klik z listy = podgląd, „Otwórz kartę" = karta pod własnym
  adresem. Wymaga trasy i `GET /api/action-cards/:id`, których dziś nie ma.

## §4. AI

Karta nie ma żadnego AI (`grep "<PracujZAI\|useCardAIAnalysis" src/components/standard/ActionCard*.tsx`
= 0 trafień) i ma **pustą rubrykę**: `ARTIFACT_CRITERIA.action = []` (`cardAnalysisRubric.ts:93`)
oraz brak katalogu kart wzorcowych. To jedna z trzech kart w rejestrze bez kryteriów (obok `plan`
i `capacity_analysis`).

| sekcja | Analizuj (z czego) | Uzupełnij tę sekcję | Uzupełnij cały dokument | tylko do odczytu |
|---|---|---|---|---|
| Opis | czy problem jest opisany zdarzeniem, a nie etykietą; czy „główna przyczyna" jest przyczyną, a nie objawem; czy działanie da się wykonać — z pomiaru, progu i historii okresów miernika | szkic opisu problemu, przyczyny i działania z danych odchylenia | szkic całej karty z odchylenia (okres, wartość, próg, RCA) | — |
| Źródło | — | — | — | `sourceKind`, `sourceId` (systemowe) |
| Właściciel i termin | czy termin jest realny wobec okresu i wagi; czy właściciel jest wskazany | **propozycja** właściciela i terminu → zawsze do zatwierdzenia przez człowieka | — | `periodStart/End`, `goalMet`, `actionRequired` (wyliczane z pomiaru) |
| Akcje i status | — | — | — | `status` (zmienia go akcja, nie AI) |

Kryteria oceny do dopisania w `cardAnalysisRubric.ts` (dziś `[]`): kompletność opisu ·
przyczyna vs objaw · wykonalność działania · realność terminu · wskazany właściciel.
Zawsze propozycja → „Zatwierdź" (K22). Teresa tylko Menu 1 — ✓ (karta nie ma własnego wejścia).

## §5. CZYTELNOŚĆ

* `grep -c "primary-[0-9]" src/components/standard/ActionCard.tsx` = **0** ✓; fokus `ring-c-focus`
  (`ActionCard.tsx:29-31`) ✓; czerwień tylko dla `severity: 'RED'` przy statusie OPEN (`:42`) ✓ —
  to jest poprawne użycie semantyki krytycznej.
* i18n: wszystkie etykiety przez `t()` z polskimi domyślnymi (`ActionCard.tsx:44-59`) ✓.
* Do sprawdzenia po pojawieniu się rekordu: 1440/1280 i długie treści w `whitespace-pre-wrap`
  (`:84`) — na dziesięciu wierszach bez ograniczenia wysokości karta może urosnąć ponad ekran.

## §6. STAN ZASTANY vs KONTRAKT (K1–K30)

Mierzone **z kodu** (STOP na runtime, przepis niżej). `n/d` = nie da się rozstrzygnąć bez rekordu.

| K | stan | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | `ActionCard.types.ts` = model, nie katalog sekcji |
| K2 steruje renderem | ✗ | sekcje wpisane w tablicę `fields` (`ActionCard.tsx:45-59`) |
| K3 źródło danych | ✓ | wszystkie 10 pól mają writera (`actionCardService.ts:164`, `:201`, `:224`) |
| K4 reguła pustki | ~ | `shown()` (`:24`) zamienia pustkę na „—" — kontrakt K4 mówi „sekcja znika", tu wiersz zostaje |
| K5 etykiety/kolejność | ✗ | brak kontraktu |
| K6–K11 prawy panel | **✗** | panelu nie ma |
| K12 Menu 5 | ✗ | — |
| K13 spis sekcji | ✗ | — |
| K14 Edycja/Podgląd wg prawa | ~ | przyciski znikają przy `status === 'CLOSED'` (`:91`, `:103`), ale **bez podania powodu** |
| K15 sticky | n/d | brak nagłówka karty |
| K16 drabina S/L | ✗ | klasa S w rejestrze, ale karta nigdy nie otwiera się jako szuflada |
| K17 zero `primary-*` | ✓ | grep = 0 |
| K18 fokus `c-focus` | ✓ | `:31` |
| K19 pigułka w pasku modułu | ✗ | karta nie opuszcza listy |
| K20 1440/1280 | n/d | brak rekordu |
| K21 „Pracuj z AI" | **✗** | brak jakiegokolwiek AI |
| K22 propozycja → Zatwierdź | n/d | brak AI |
| K23 po polsku / wg praw | ✓ (kod) | `t()` z polskimi domyślnymi |
| K24 deklaracja AI per typ | **✗** | `ARTIFACT_CRITERIA.action = []` (`cardAnalysisRubric.ts:93`) |
| K25 i18n | ✓ (kod) | do potwierdzenia zrzutem |
| K26 podgląd → „Otwórz" | **✗** | `onOpen` martwy — żaden wołacz go nie podaje |
| K27 Teresa tylko Menu 1 | ✓ | brak wejścia w karcie |
| K28 identyfikatory | ~ | `ownerName` ma być osobą, nie ID (`P9…:21`); `sourceId` nie może trafić do widocznego DOM |
| K29 błędy konsoli | n/d | brak rekordu |
| K30 odbiór na zrzucie | **n/d — STOP** | patrz przepis |

**Wynik (z kodu): ✓ 6 · ~ 4 · ✗ 14 · n/d 6 z 30.**

**Przepis na rekord (do wykonania po zgodzie właściciela na rekord w danych pokazowych):**
miernik z rezultatem poza progiem → sekcja „Odchylenia" karty miernika → sprawa odchylenia →
`POST /api/v8/results/deviation-cases/:caseId/recovery-card` (`v8/results.routes.ts:1817`).
Kandydat w DBR77: miernik „ŚREDNI CZAS ODPOWIEDZI NA REKLAMACJE" (status „Ostrzeżenie", bez sprawy).

## §7. LUKI → NAPRAWA

| # | luka | rozmiar | decyzja właściciela? |
|---|---|---|---|
| 1 | tożsamość: trasa karty + `GET /api/action-cards/:id` + podanie `onOpen` w trzech wołaczach (K26/K16) | M | nie |
| 2 | powłoka klasy S z prawym panelem (Akcje · **tabela** Właściwości · Powiązania · Źródła · Historia) | L | nie |
| 3 | `PracujZAI` + kryteria w `cardAnalysisRubric.ts` (dziś `[]`) + deklaracja pól `writable` (K21/K24) | M | nie |
| 4 | katalog sekcji `actionCardContract.ts` sterujący renderem (K1/K2/K5) | M | nie |
| 5 | Menu 5 z „Edycja/Podgląd" i powodem „Karta zamknięta" (K14) | M | nie |
| 6 | poprawić rejestr: `nazwa: 'Karta działania'`, `statusMigracji: 'przed'` (dziś `'zmigrowana'` = nieprawda) | S | nie |
| 7 | jeden rekord odchylenia w DBR77, żeby kartę dało się w ogóle odebrać wzrokiem (K30) | S | **tak — patrz pytanie** |

**Pytanie do właściciela (1):** żeby kartę działania dało się odebrać oczami, potrzebny jest
jeden rekord odchylenia w danych pokazowych DBR77 (miernik „ŚREDNI CZAS ODPOWIEDZI NA REKLAMACJE"
ma status „Ostrzeżenie", ale nie ma sprawy). **Rekomendacja: zgoda na jedno odchylenie i jedną
kartę działania jako część danych pokazowych** — to nie jest rekord testowy, tylko brakujące
ogniwo demonstrujące kręgosłup wartości (pomiar → odchylenie → karta → zadanie → osoba).

## §8. Zapis rundy 1 (zachowany)

Zrzut listy KPI: `evidence/p10-karty-n/metric/metric-loaded.png`; brak osiągalnej karty działania.

| sekcja | kontrakt mówi | ekran pokazuje | źródło danych | rozjazd | waga |
|---|---|---|---|---|---|
| Tytuł, opis, właściciel, termin, stan | `ActionCard.types.ts` — model, brak kontraktu sekcji | `ActionCard.tsx`; brak realnego rekordu na zrzucie | action-card payload → `server/src/services/actionCard/*`, trasy `actionCards.routes.ts:34-54` | brak | kosmetyka |

Propozycja r1 („jedna zwarta karta S: opis → źródło odchylenia → właściciel i termin → akcje")
została w r2 przyjęta i rozpisana na cztery sekcje w §1.
