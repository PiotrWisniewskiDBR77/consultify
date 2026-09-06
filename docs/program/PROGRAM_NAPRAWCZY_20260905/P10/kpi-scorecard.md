# Kontrakt karty N — `kpi-scorecard` (Raport KPI / karta wyników)

## §0. Tożsamość

- **Nazwa PL:** Raport KPI (karta wyników) · **moduł:** Wyniki (P7K).
- **Archetyp wg inwentarza:** D (Matryca) — realnie zmierzone jako LISTA (StandardTable), nie
  Rekord z prawym panelem accordionowym. Patrz „ustalenie przekrojowe" niżej.
- **Klasa:** poza rejestrem `KartaNKey` — nie da się przypisać S/L wg `registry.ts` (brak wpisu).
- **Trasa:** `/results/kpi/scorecards/:scorecardId` (`routeConfig.ts:158`, klucz `RESULTS_KPI.SCORECARD`).
- **Jak otworzyć:** Wyniki → KPI → wiersz raportu (np. „KPI jakości — sierpień 2026") → klik.
  NIE zmierzone na żywo w P10-S. Zmierzone TERAZ (partia B1, 06.09.2026 wieczór), zrzut
  `evidence/p10b1-wyniki/38-kpi-scorecard.png` — rekord realny
  (`scorecardId=0a9a0f97-c029-5687-98a3-b94c7a8c6ec7`, pobrany z żywego
  `GET /vnext/results/kpi/scorecards`), `url` ≠ `/login`.
- **Komponent:** `src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage.tsx:145`
  (1054 linii).
- **Powłoka dziś:** `ResultsVNextRegistryShell` (`:66`, `:627,649,727,900`) — TA SAMA powłoka listy,
  której używa rejestr KPI. Nagłówek pliku (`:9-45`) deklaruje to WPROST i JAWNIE jako decyzję
  otwartą: „★ ARCHETYPE DECISION (…) whether a full KPI/…/„full-tool" screen should be SPEC-A
  Archetyp C klasa L (…) or a new pattern is an open architecture-owner call. This screen
  deliberately does NOT use `StandardArtifactShell` — it stays a LIST surface (…) This is a
  scope-boundary decision to defer the archetype question, not a claim that it's resolved."
- **Rejestr:** BRAK — nie jest kluczem `KartaNKey`. Silnik AI strukturalnie niewołowalny (patrz
  `roi-case-tool.md` §0 dla ten sam mechanizm).

## §1. Sekcje — NIE MA SEKCJI, MA DWIE ZAKŁADKI LISTY

Ekran nie ma kontraktu sekcji w sensie K1 (spis lewej nawigacji karty). Ma Menu 3 z DWOMA
pigułkami poziomu (`levelChips`, `:882-885`):

| widok | po co użytkownikowi | źródło danych → writer | reguła pustki | S/L |
|---|---|---|---|---|
| Mierniki (`items`, domyślny) | tabela mierników raportu, miesiąc po miesiącu | `GET /vnext/results/kpi/scorecards/:id/items` (potwierdzone żywym wywołaniem, zwraca pełne obiekty KPI z `displayConfig`) | `StandardTable` własny pusty stan | — |
| Migawki przeglądu (`snapshots`) | historia zatwierdzonych migawek raportu | `GET .../review-snapshots` | j.w. | — |

Obie renderowane jako `StandardTable` wewnątrz `ResultsVNextRegistryShell` (zgodnie z
`check-list-canon.sh` — zero własnej tabeli), przełączane Menu 3 chipami, NIE Menu 5 „Sekcje ▾".

## §2. Prawy panel — BRAK (jest preview, nie panel karty)

Ekran ma `preview` slot `ResultsVNextRegistryShell` (pokazuje wybrany wiersz miernika/migawki, albo
domyślnie „przegląd rekordu raportu" przez `buildKpiScorecardPreview` — komentarz nagłówkowy
`:32-36`), **NIE** `ArtifactRightPanel`. Zero sekcji Akcje/Właściwości/Powiązania/Źródła/Komentarze/
Historia w rozumieniu SPEC-A §10.2 — to jest architektura PODGLĄDU BOCZNEGO listy (konsultuj skill
`consultify-preview`), nie prawego panelu karty. **K6–K11: 0/6, ale to jest zgodne z tym, że ekran
w ogóle nie jest Rekordem wg dzisiejszego kodu — patrz §7.**

## §3. Menu 5 i nawigacja — BRAK

Zero „Sekcje ▾"/„Pracuj z AI ▾"/Edycja-Podgląd. Menu 2 to WSPÓLNE zakładki domeny Wyników
(KPI·OKR·ROI, `getResultsDomainTabs()`, `:607-613`) — POPRAWNIE zachowane (w przeciwieństwie do
`okr-set-tool`/`roi-case-tool`), bo ekran nigdy nie odchodzi od `ResultsVNextRegistryShell`.
Okruszek Menu 1 trzypoziomowy: Wyniki › KPI › <nazwa raportu> (`breadcrumbs`, `:884-888`).

## §4. AI — BRAK

Zero `useCardAIAnalysis`/`PracujZAI`/wpisu w `cardAnalysisRubric.ts`. Brak klucza rejestru = brak
mechanizmu (§0).

## §5. Czytelność

Zrzut `evidence/p10b1-wyniki/38-kpi-scorecard.png` (06.09.2026): **1× HTTP 404** zmierzony w
`odpowiedziHttp`:
`GET http://127.0.0.1:3110/api/vnext/results/kpi/scorecards/0a9a0f97-c029-5687-98a3-b94c7a8c6ec7/review-snapshots/published`
— zasób „migawka opublikowana" nie istnieje dla tego raportu (raport nie ma jeszcze migawki
opublikowanej; endpoint zwraca 404 zamiast pustego/`null`, więc trafia do `bledyKonsoli` jako błąd,
nie jako pusty stan — **K29 naruszenie zmierzone i przypisane do konkretnego zasobu**, w
przeciwieństwie do „3× 404 nieprzypisany" z P10-S dla rejestru KPI). Poza tym: zero angielskiego
w tekście zrzutu (13 mierników, nazwy grup PL), zero UUID/`seed_` widocznych, zero „Teresa".

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji istnieje | ✗ | brak — to lista, nie karta z sekcjami |
| K2 kontrakt steruje renderem | n/d | nie dotyczy, brak kontraktu do sterowania |
| K3 źródło danych per sekcja | ✓ (na poziomie widoków) | `.../items` i `.../review-snapshots`, zmierzone żywym wywołaniem |
| K4 reguła pustki | ✓ | `StandardTable` własny pusty stan |
| K6–K11 prawy panel | ✗ 0/6 | brak `ArtifactRightPanel`, jest `preview` (§2) |
| K12 Menu 5 trzy elementy | ✗ | brak w ogóle |
| K13 lewy spis bez ucięć | n/d | nie dotyczy (nie ma lewego spisu sekcji) |
| K14 Edycja/Podgląd wg prawa | n/d | nie dotyczy |
| K15 nagłówki sticky | n/d | niezmierzone w tej rundzie |
| K16 klasa S/L zgodna | n/d | brak wpisu rejestru, klasa nieprzypisana |
| K17 zero primary-* | n/d | grep nie wykonany na tym pliku |
| K18 fokus c-focus | n/d | niezmierzone |
| **K19 pigułka pasku modułu** | **✓** | Menu 2 KPI·OKR·ROI zachowane (jedyna karta partii B1 poza metric/objective/roi_case, która tego NIE gubi) |
| K21 „Pracuj z AI" 3 pozycje | ✗ | brak w ogóle |
| K22 propozycja→Zatwierdź | n/d | nie dotyczy, brak AI |
| K23 po polsku, wg uprawnień | ✓ (zmierzone) | zrzut czysty |
| K24 deklaracja per typ | ✗ | brak wiersza w tabeli K24 SSOT |
| K25 i18n bez angielskiego | ✓ (zmierzone) | zrzut `38-kpi-scorecard.png` |
| K26 podgląd/Otwórz | ~ | klik z rejestru otwiera BEZPOŚREDNIO ten ekran (nie podgląd→Otwórz — jednoetapowe, szybsze, ale inne niż K26 opisuje) |
| K27 Teresa tylko Menu 1 | ✓ (zmierzone) | zero wzmianek w tekście zrzutu |
| K28 zero identyfikatorów technicznych | ✓ (zmierzone) | brak UUID w tekście zrzutu |
| **K29 zero błędów konsoli** | **✗ (zmierzone i przypisane)** | 404 na `.../review-snapshots/published`, patrz §5 |
| K30 odbiór 1 zrzut 1440 | ✓ | `38-kpi-scorecard.png` (bez „Pracuj z AI" rozwiniętego, bo przycisk nie istnieje) |

**Wynik: 6 ✓, 5 ✗ realne (K1, K6–K11, K12, K21, K24, K29 — sześć licząc K29), reszta n/d, bo ekran
strukturalnie nie jest Rekordem.**

## §7. Luki → naprawa

1. **PYTANIE PRODUKTOWE DO WŁAŚCICIELA (pierwsza, najważniejsza luka).** Kod SAM deklaruje tę
   decyzję jako otwartą (`:9-45`, cytat w §0). Zanim ktokolwiek pisze prawy panel/Menu 5/AI dla
   tego ekranu, potrzebna jest odpowiedź: **czy „Raport KPI" ma zostać listą (obecna architektura,
   poprawna dla archetypu D „Matryca") czy stać się Rekordem SPEC-A Archetyp C klasa L** (wtedy
   wymaga prawego panelu, Menu 5, AI — tak jak metric/objective/roi_case)? Rekomendacja: zostawić
   listą — SSOT Wyniki §6 nazywa ten poziom „RAPORT jako tabela mierników", nie karta obiektu;
   traktowanie go jak Rekordu byłoby zaprzeczeniem własnej decyzji P7K cytowanej w nagłówku pliku.
   **Jeśli właściciel potwierdzi „lista" — punkty K1/K6-11/K12/K21/K24 w §6 przestają być lukami
   i stają się „n/d — archetyp D", tak jak `okr-report` i `okr-set-tool` niżej.**
2. **K29 — 404 na `review-snapshots/published`.** Rozmiar S: albo backend zwraca pustą listę/`null`
   zamiast 404 dla raportu bez opublikowanej migawki, albo front jawnie oczekuje 404 i nie loguje
   go jako błąd konsoli. NIE wymaga decyzji właściciela — to jest błąd kontraktu API, nie produktu.
3. **K26 — brak dwuetapowego „podgląd→Otwórz".** Jeśli (1) rozstrzygnie się na „zostaje listą",
   ten punkt przestaje być luką (bezpośrednie wejście jest poprawne dla listy poziomu 2).

**Rekomendacja:** naprawić (2) od razu. Nie pisać kontraktu K1–K30 pełnej karty, dopóki (1) nie ma
odpowiedzi — inaczej praca idzie na ekran, którego architektura może się zmienić pod spodem.
