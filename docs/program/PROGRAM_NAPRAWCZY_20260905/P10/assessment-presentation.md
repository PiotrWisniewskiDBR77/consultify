# Prezentacja oceny (`assessment-presentation`) — kontrakt karty N

> Partia P10-B4, pozycja **#26** inwentarza. Pomiar na żywo 06.09.2026,
> vite 3111 → API 4100; zrzut `evidence/p10b4/09-prezentacja.png`.

## §0. Tożsamość

| pole | wartość |
|---|---|
| nazwa PL | Prezentacja oceny |
| moduł | 04_ASSESSMENT |
| archetyp | **E — Deck** |
| trasa | `/assessment/outputs/:outputId/presentation` (`AppRoutes.tsx:883-891`, flaga `isAssessmentOutputArtifactsEnabled`, w `server.env` `VITE_ASSESSMENT_OUTPUT_ARTIFACTS_ENABLED=true`) |
| jak otworzyć | Ocena → „Wnioski" → wiersz zamrożonego Outputu → kebab → prezentacja |
| komponent | `src/components/assessment/presentation/AssessmentPresentationView.tsx:95` (283 linie) → `PresentationDeck.tsx:59-76` |
| powłoka dziś | **brak** — pełnoekranowy pokaz slajdów z własnym paskiem (licznik, ←/→, pełny ekran) |

### §0.1 ★ POMIAR: dla oceny bez zamrożenia to NIE JEST prezentacja

Na stanowisku lokalnym **`GET /api/method/outputs` zwraca pustą listę — zero zamrożonych
Outputów jądra**. Każde realne wejście trafia więc w gałąź `legacy-ready`
(`AssessmentPresentationView.tsx:124`), która renderuje **`AssessmentReportDocument`**
(`:262-275`) — czyli dokument raportu z banerem „Ta ocena pochodzi z zapisu sesji —
jeszcze nie zamrożone. Prezentacja pokazuje tę samą treść co raport; pełna 9-slajdowa
prezentacja pojawi się po zamrożeniu wyniku". Zrzut `09-prezentacja.png` jest tego dowodem:
ekran „prezentacji" jest bajt w bajt ekranem raportu.

**Uczciwie: decku (`PresentationDeck`) NIE ZMIERZYŁEM na żywo — nie ma rekordu.**
Przepis na pomiar: (1) sesja DRD z odpowiedziami na co najmniej jedną jednostkę,
(2) „Wyślij do przeglądu" (`POST /sessions/:id/transition`), (3) „Zamroź"
(`POST /sessions/:id/freeze`, `method-core.routes.ts:1505`; właściciel organizacji jest
approverem — `DrdHttpMethodWorkspaceScreen.tsx:1200-1201`), (4) wejść na
`/assessment/outputs/<nowy outputId>/presentation`. Poniższy kontrakt slajdów pochodzi
z kodu (`PresentationDeck.tsx:59-76`), nie ze zrzutu — i tak jest oznaczony.

## §1. Sekcje (slajdy — archetyp E)

| slajd | po co użytkownikowi | źródło danych → writer | reguła pustki | kolej. |
|---|---|---|---|---|
| Tytuł (organizacja, metoda, data) | okładka dla klienta | `output` → `POST /sessions/:id/freeze:1505` | zawsze | 1 |
| Cel badania | po co robiliśmy ocenę | `PurposeSlide`, `slides.tsx:82` — treść stała z metodyki | zawsze | 2 |
| Metodyka | jak liczymy dojrzałość | `MethodSlide:103`, pakiet metody | zawsze | 3 |
| Wynik ogólny | jedna liczba | `output.aggregation` → freeze | brak agregacji → slajd znika | 4 |
| Profil wymiarów | rozkład dojrzałości | `output.aggregation.dimensions` | jw. | 5 |
| Macierz osi (×N osi) | obraz per oś | `model.axisMatrices` (`PresentationDeck.tsx:65-67`) | brak macierzy → 9 slajdów zamiast 9+N | 6…6+N |
| Mocne strony | co działa | `output.findings` (typ pozytywny) | brak → slajd z uczciwym „brak" | +1 |
| Luki i ryzyka | co nie działa | `output.findings` (typ luka) | jw. | +2 |
| Czego nie wiemy | granice wiarygodności | `extractUnknownReasonBreakdown` (`outputAdapter.ts`) | jw. | +3 |
| Następne kroki | co dalej | `NextStepsSlide:418` | jw. | +4 |

Liczba slajdów jest **dynamiczna** (9 + liczba osi z macierzą) — licznik i pasek postępu
liczą realną długość (`PresentationDeck.tsx:76`).

## §2. Prawy panel

**Zero paneli.** Deck to tryb pokazu — i tu kanon wymaga rozstrzygnięcia, a nie ślepego
dopisania panelu:

| sekcja | status proponowany | uzasadnienie |
|---|---|---|
| Akcje | obowiązkowa — **w trybie edycji decku**, nie w pokazie | Pobierz PPTX/PDF (trasy istnieją od 1.6), Odśwież z Outputu |
| Właściwości (tabela) | obowiązkowa w trybie edycji | Status → Właściciel → Metodyka → Rewizja Outputu → Źródło → Zamrożono → Zaktualizowano |
| Powiązania | obowiązkowa w trybie edycji | sesja · Output · raport · inicjatywy |
| Źródła i założenia | obowiązkowa w trybie edycji | findingi i agregacja, z których zbudowano slajdy |
| Komentarze | pominięta z powodem | prezentacja jest wydaniem, nie miejscem dyskusji |
| Historia | obowiązkowa w trybie edycji | rewizje Outputu (`GET /outputs/:id/revisions:1706`) |

**Zasada:** pokaz pełnoekranowy (Esc/←/→) zostaje bez powłoki; karta ma DWA tryby —
„Edycja" (powłoka SPEC-A: Menu 4/5 + prawy panel + siatka slajdów) i „Pokaz" (dzisiejszy
`PresentationDeck`). Bez tego rozdzielenia panel zasłania slajd.

## §3. Menu 5 i nawigacja

* Dziś: brak Menu 4 i Menu 5, brak paska modułu, brak drogi powrotnej poza „wstecz".
* Docelowo (tryb Edycja): „Sekcje ▾" = wybór slajdów · „Edycja/Podgląd" (Podgląd = pokaz)
  · „Pracuj z AI ▾".
* Edycja wg prawa: Output zamrożony jest niezmienny — edycji podlega **narracja slajdu**,
  nie liczby; bez prawa zapisu przełącznik znika z powodem „Wynik zamrożony".
* Klasa **L**.

## §4. AI

| sekcja | Analizuj | Uzupełnij tę sekcję | Uzupełnij cały dokument | tylko do odczytu |
|---|---|---|---|---|
| Cel badania | ocena spójności narracji ze slajdami wyniku | propozycja 2–3 zdań z kontekstu organizacji | ✓ | — |
| Mocne strony / Luki i ryzyka / Następne kroki | wskazuje slajdy bez treści | propozycja punktów z `findings` | ✓ (cała narracja decku) | — |
| Tytuł, Metodyka, Wynik ogólny, Profil, Macierze, Czego nie wiemy | czyta | ✗ | ✗ | ✓ liczby z zamrożonego Outputu — AI ich nie dotyka |

Zawsze propozycja → „Zatwierdź". Teresa wyłącznie z Menu 1. Wiersz `assessment-presentation`
w tabeli K24 SSOT: **nie istnieje** — karta jest poza `CardAnalysisArtifactType` i poza
listą 9 jawnych wyjątków `registry.kompletnosc.test.ts:30-40` (wyjątek `presentation`
dotyczy `DeckBuilder` z Materiałów, nie tej karty).

## §5. Czytelność

* `primary-[0-9]` = 0 w `AssessmentPresentationView.tsx` i `slides.tsx` ✓ K17;
  fokus `c-focus` ✓ K18.
* Zmierzone na `09-prezentacja.png` (gałąź zastana): brak angielskich literałów interfejsu;
  tytuły rekordów z seeda angielskie (dług danych, nie kodu). Slajdów nie zmierzono.
* `bledyKonsoli = 0` ✓. 1440 ✓ (gałąź zastana). 1280 niemierzone.

## §6. Stan zastany vs kontrakt

✓: K17, K18, K29 (**3**).
~: K4 (slajdy bez danych znikają — dobra reguła, ale bez spisu), K30 (zrzut jest, ale
gałęzi zastanej, nie decku) (**2**).
✗: K1, K2, K3, K5, K6, K7, K8, K9, K10, K11, K12, K13, K14, K15, K16, K19, K21, K22,
K23, K24, K26 (**21**).
Niemierzone: K20, K25, K27, K28 na samym decku — **brak rekordu, patrz §0.1**.

## §7. Luki → naprawa

| # | luka | rozmiar | decyzja właściciela? |
|---|---|---|---|
| L1 | rozdzielenie karty na tryb „Edycja" (powłoka SPEC-A) i „Pokaz" (dzisiejszy deck) | **L** | nie |
| L2 | prawy panel wg §2 w trybie Edycja | L | nie |
| L3 | Menu 4 + Menu 5 + pasek modułu z pigułką; dziś zero drogi powrotnej | M | nie |
| L4 | „Pracuj z AI" ×3 na slajdach narracyjnych (Cel, Mocne strony, Luki, Następne kroki) | M | nie |
| L5 | katalog slajdów jako kontrakt sterujący renderem (K1+K2) | M | nie |
| L6 | wejście do `REJESTR_KART_N` + wiersz K24 | S | nie |
| L7 | **pomiar decku na żywo** wg przepisu z §0.1 przed jakąkolwiek naprawą wyglądu | S | nie |
| L8 | rozstrzygnąć, czy prezentacja oceny zostaje osobną kartą, czy trybem karty raportu | S | **TAK — jedyne pytanie** |

**Pytanie do właściciela (1):** dla oceny niezamrożonej „Prezentacja" pokazuje dziś ten sam
dokument co „Raport" (zmierzone). Czy prezentacja oceny ma zostać **osobną kartą** z własnym
deckiem (rekomendacja CTO — klient dostaje inny artefakt na zarząd niż raport analityczny),
czy ma być **trybem widoku karty raportu** („Raport / Prezentacja" w Menu 5), co usuwa
jedną kartę z inwentarza i jedną trasę bez drogi powrotnej?

## §8. Aliasy

Brak. `PresentationDeck` jest komponentem tej karty, nie osobną kartą; `DeckBuilder`
z Materiałów (`presentation`, pozycja #59 inwentarza, partia B3) to inny byt.
