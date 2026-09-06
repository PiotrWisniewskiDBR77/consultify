# Kontrakt karty N — `okr-set-tool` (Narzędzie zestawu OKR)

## §0. Tożsamość

- **Nazwa PL:** Narzędzie zestawu OKR · **moduł:** Wyniki (P7K). Odpowiednik `roi-case-tool` w
  domenie OKR — pełny warsztat zestawu, D03 „pełne narzędzia to klasa L" (cytat nagłówka
  `OkrSetToolPage.tsx:11-13`, decyzja zamknięta `RESUME_HANDOFF_2026-08-11.md` §7).
- **Archetyp wg inwentarza:** D (Matryca/workspace) — zmierzone jako workspace 6-zakładkowy.
- **Trasa:** `/results/okr/sets/:okrSetId` (`routeConfig.ts:200`, klucz `RESULTS_OKR.SET`).
- **Jak otworzyć:** Wyniki → OKR → wiersz zestawu → „Otwórz obszar roboczy" (menu wiersza/preview,
  `navigate()` — nagłówek pliku `:14-16`).
- **Zmierzone TERAZ** (partia B1, 06.09.2026 wieczór), zrzut
  `evidence/p10b1-wyniki/42-okr-set-tool.png` — TEN SAM rekord co `okr-report`
  (`okrSetId=3f2ecdde-03f9-5d47-860c-980c3e85d81c`, „OKR automatyzacji — Q4 2026"), `url` ≠ `/login`,
  `bledyKonsoli: []`.
- **Komponent:** `src/components/ResultsVNext/okr/OkrSetToolPage.tsx:42` (143 linii, ładowanie
  rekordu przez `getOkrSet`) → `OkrSetWorkspace.tsx:80` (181 linii, sam workspace).
- **Powłoka dziś:** `StandardModuleBar` z WŁASNYMI sześcioma zakładkami Menu 2
  (`OkrSetWorkspace.tsx:157-176`): Przegląd · Cele i Kluczowe Rezultaty · Dopasowania · Rozmowy
  i wsparcie · Przegląd i refleksja · Historia — **ZASTĘPUJĄ** domenowe Menu 2 (KPI·OKR·ROI).
  Zmierzone na żywo: tekst zrzutu pokazuje „Zestawy OKR" jako breadcrumb i SZEŚĆ zakładek workspace'u,
  **BEZ** śladu „KPI/OKR/ROI" — otwarcie tego ekranu ZDEJMUJE pasek domeny, ten sam błąd co
  `roi-case-tool`/`kpi-deviation`.
- **Rejestr:** BRAK.

## §1. Sekcje — sześć ZAKŁADEK Menu 2, nie sekcji karty

| zakładka | po co użytkownikowi | źródło danych → writer | reguła pustki | S/L |
|---|---|---|---|---|
| Przegląd (`overview`) | właściwości zestawu + akcje cyklu życia | `OkrSetOverviewView.tsx` — `ArtifactPropertiesTable` inline (`:245-246`), NIE w prawym panelu | zmierzone: tabela zawsze ma wiersze (Status/Zasięg/Właściciel/…/Zaktualizowano) | 1 |
| Cele i Kluczowe Rezultaty (`objectives`) | breadcrumb-drill do `OkrObjectivesView`→`OkrKeyResultsView`→`OkrCheckInsView` (niezmieniony kod, re-użyty) | `okrObjectiveApi.ts` | własne puste stany drilla | 2 |
| Dopasowania (`alignment`) | `OkrAlignmentsView` | `okrApi.ts` | niezmierzone | 3 |
| Rozmowy i wsparcie (`support`) | `OkrSupportView` | niezmierzone | niezmierzone | 4 |
| Przegląd i refleksja (`review`) | `OkrReviewReflectionView` (+ closing/carry-forward, OKR-E007) | niezmierzone | niezmierzone | 5 |
| Historia (`history`) | `OkrHistoryView` | niezmierzone | niezmierzone | 6 |

**To NIE jest kontrakt sekcji K1** (spis lewej nawigacji jednej karty) — to jest Menu 2 workspace'u
z 6 niezależnymi widokami, każdy WŁASNYM komponentem. Zgodne z archetypem D (workspace), niezgodne
z formułą Rekordu C.

## §2. Prawy panel — BRAK, właściwości w treści zakładki

Zero `ArtifactRightPanel` w `OkrSetWorkspace.tsx` (grep potwierdza). `ArtifactPropertiesTable`
renderuje się BEZPOŚREDNIO w treści zakładki „Przegląd" (`OkrSetOverviewView.tsx:245-246`), pod
nagłówkiem „Właściwości zestawu" — zmierzone żywym zrzutem: tabela WIDOCZNA, ale jako CZĘŚĆ
strony, nie jako accordion prawego panelu. Akcje cyklu życia („Złóż do akceptacji", „Zaakceptuj",
„Żądaj poprawek", „Aktywuj", „Otwórz przegląd", „Anuluj zestaw") też renderują się w treści
zakładki, z jawnymi powodami blokady widocznymi w tekście zrzutu („Złożenie do akceptacji: wymaga
statusu »Szkic, Wymaga poprawek« (obecny status: »Aktywny«)" — dobra praktyka D06, ale nie w
prawym panelu). **K6–K11: 0/6 w rozumieniu „jeden accordion po prawej"; treściowo Akcje+Właściwości
ISTNIEJĄ, tylko w złym miejscu architektonicznie.** Powiązania/Źródła/Komentarze/Historia jako
ODDZIELNE elementy panelu nie istnieją wcale (Historia jest osobną ZAKŁADKĄ Menu 2, nie sekcją
panelu — inna lokalizacja niż SPEC-A przewiduje).

## §3. Menu 5 i nawigacja — BRAK

Zero „Sekcje ▾"/„Pracuj z AI ▾"/Edycja-Podgląd. Menu 2 WŁASNE (6 zakładek, patrz §0) zastępuje
domenowe — to jest STRUKTURALNIE inny wzorzec niż `okr-report`/`kpi-scorecard` (które zachowują
domenowe Menu 2).

## §4. AI — BRAK

Zero mechanizmu. Brak klucza rejestru.

## §5. Czytelność

Zrzut `evidence/p10b1-wyniki/42-okr-set-tool.png`: zero błędów konsoli (`bledyKonsoli: []`), zero
UUID/`seed_`/„Teresa" w pierwszych ~900 znakach tekstu. Tekst zawiera POPRAWNĄ polską terminologię
(„Aktywny", „Jednostka biznesowa", „Obserwacja") — brak angielskiego zauważony w próbce.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji istnieje | ✗ | Menu 2 workspace, nie spis sekcji karty |
| K2 kontrakt steruje renderem | n/d | nie dotyczy |
| K3 źródło danych | ~ | `overview` zmierzone (`getOkrSet`); pozostałe pięć niezmierzone co do plik:linia w tej rundzie |
| K4 reguła pustki | ~ | `overview` ma zawsze treść; pozostałe niezmierzone |
| **K6–K11 prawy panel** | **✗ 0/6 (jako panel)** | Akcje+Właściwości istnieją, ale w treści zakładki, nie w `ArtifactRightPanel` — patrz §2 |
| **K12 Menu 5 trzy elementy** | **✗** | zero, zastąpione własnym Menu 2 |
| K13–K18, K20 | n/d | niezmierzone szczegółowo |
| **K19 pigułka pasku modułu** | **✗ (zmierzone)** | brak KPI/OKR/ROI w tekście zrzutu — własne Menu 2 zastępuje domenowe |
| K21 „Pracuj z AI" 3 pozycje | ✗ | brak |
| K24 deklaracja per typ | ✗ | brak wiersza w SSOT |
| K25 i18n bez angielskiego | ✓ (zmierzone częściowo) | próbka tekstu czysta |
| K26 podgląd/Otwórz | ✓ | „Otwórz obszar roboczy" z menu wiersza/preview rejestru |
| K27 Teresa tylko Menu 1 | ✓ (zmierzone) | zero wzmianek w próbce tekstu |
| K28 zero identyfikatorów technicznych | ✓ (zmierzone) | brak UUID w próbce tekstu |
| **K29 zero błędów konsoli** | **✓ (zmierzone)** | `bledyKonsoli: []` |
| K30 odbiór 1 zrzut 1440 | ✓ | `42-okr-set-tool.png` |

**Wynik: 6 ✓ (5 zmierzone na żywo), 4 ✗ realne (K1, K6–K11, K12, K19, K21, K24 — sześć, licząc
wszystkie), reszta n/d/częściowe.** Higiena i18n/Teresa/UUID czysta (jak `okr-report`), ale K19
naprawdę pęka tutaj (w przeciwieństwie do `okr-report`, które zachowuje domenowe Menu 2) — bo
workspace WYMIENIA Menu 2 własnymi zakładkami, zamiast dokładać się do niego.

## §7. Luki → naprawa

1. **K19 — utrata paska domeny.** Rozmiar M-L: albo (a) osadzić `KartaWynikowChrome`
   analogicznie do metric/objective/roi_case (Menu 2 domeny + pigułka Menu 3 „OKR · <nazwa
   zestawu>", a sześć dzisiejszych zakładek workspace'u schodzi do Menu 3/podpaska), albo (b)
   zaakceptować, że pełne narzędzia (workspace) świadomie WYMIENIAJĄ Menu 2 na własny — tak jak
   `RoiCaseFullTool`/`OkrSetWorkspace` robią dziś konsekwentnie. **Pytanie do właściciela**: czy
   „pełne narzędzie" (D03, klasa L) ma prawo zastąpić Menu 2 domeny swoim, czy MUSI zachować
   domenowe jak karty do czytania (#37/#41/#43)? To jest TA SAMA decyzja co w `roi-case-tool.md`
   §7 pkt 1, powinna zapaść RAZEM dla obu narzędzi (OKR i ROI), żeby nie było dwóch konwencji.
2. **K6–K11 — Akcje/Właściwości poza panelem.** Rozmiar M: jeśli (1) rozstrzygnie się na
   „workspace zachowuje własną architekturę", to przenieść istniejącą treść `OkrSetOverviewView`
   do `ArtifactRightPanel` byłoby ZMIANĄ layoutu bez zmiany treści — technicznie tanie (dane już
   są), ale wymaga tej samej decyzji co (1).
3. **K1/K12/K21/K24 — brak formuły karty N w ogóle.** Rozmiar L: jak w `roi-case-tool.md`/
   `kpi-deviation.md` — dodanie klucza rejestru i AI to praca ponad rozmiar S tej partii; flaguję
   do wspólnej decyzji o pięciu kartach bez rejestru.

**Rekomendacja:** nie naprawiać punktowo bez odpowiedzi na pytanie (1) — jest identyczne z pytaniem
w `roi-case-tool.md` i powinno mieć JEDNĄ odpowiedź dla obu narzędzi, żeby OKR i ROI nie rozjechały
się na dwie różne konwencje „pełnego narzędzia".
