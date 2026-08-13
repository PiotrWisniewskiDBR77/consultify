# DRD — bramka kanonu: traceability 7 osi / 8 wymiarów / 39 obszarów

> Wymagana przez koordynatora **przed** jakąkolwiek zmianą `DRDReportTemplate`
> i przed `drd_scoring_v2`. Wszystkie liczby zmierzone w kodzie na
> `f3e7df565e` (== `origin/demo`), nie przepisane z dokumentacji.

---

## Werdykt

### **NIE MA KONFLIKTU MODELI.**

Kanon jest jednoznaczny i pojedynczy. Rozjazd jest **implementacyjny, nie
metodologiczny**: kod nigdy nie dogonił kanonu.

**Dowód rozstrzygający (historia git):**

| Commit | Czas | Co |
| --- | --- | --- |
| `25d794e314` | 2026-07-02 **14:50:50** | `drdReportModel.ts` — komentarz: *„The canon doc … is **NOT present in this branch**"* |
| `69b7175b91` | 2026-07-02 **14:53:51** | `DRD_CANON.md` z MAP-1.0 — **3 minuty później** |

`git merge-base --is-ancestor` potwierdza: kanon **nie był** przodkiem kodu
raportu. Komentarz był **prawdziwy, gdy go pisano**, i zwietrzał po trzech
minutach. Od 2026-07-02 nikt go nie zaktualizował, a `buildDimensions()`
do dziś raportuje 7 osi jako „wymiary".

---

## Odpowiedzi na sześć pytań

| # | Pytanie | Odpowiedź | Źródło |
| --- | --- | --- | --- |
| 1 | Ile jest osi? | **7** | `DRD_CANON.md` §2.3; zmierzone: `AXIS_1..AXIS_7` w `drdStructure.ts` |
| 2 | Ile wymiarów? | **8** (`D1`–`D8`) | `DRD_CANON.md` §3.2 MAP-1.0 |
| 3 | Ile obszarów? | **39** | §2.3; zmierzone: 9+5+5+5+5+5+5 |
| 4 | Czy `D5` należy do tego samego modelu? | **TAK** | §3.2: `D5 ← obszary 4C, 4E` — te obszary **istnieją** w warstwie pomiaru |
| 5 | Czy 8 wymiarów to warstwa wewnątrz 7 osi, czy inna metodologia? | **WARSTWA**, nie inna metodyka | §1: *„DRD ma **dwie warstwy o różnych rolach**"* — POMIAR (39 obszarów) i KOMUNIKACJA (8 wymiarów). *„klient widzi 8 wymiarów; konsultant ocenia 39 obszarów"* |
| 6 | Z jakiego źródła wynika obowiązek pokazania `D5`? | `DRD_CANON.md` **§3.2, tabela MAP-1.0** | wiersz `D5 · Technologia i infrastruktura / Technology & Infrastructure · obszary 4C, 4E · skala natywna 7` |

### Dlaczego 8, a nie 7 — uzasadnienie z kanonu

§3.1: obietnica „8 kluczowych wymiarów" vs 7 osi w kodzie. Kanon odrzuca dwa
złe wyjścia — przebudowę pomiaru pod marketing oraz „wymiar-widmo" bez pytań.
Rozwiązanie: **podział osi 4**. „Zarządzanie danymi" zawiera dwie różne rzeczy:
dojrzałość **danych jako zasobu** (4A zbieranie, 4B przechowywanie, 4D analityka)
i dojrzałość **infrastruktury** (4C komunikacja, 4E moc obliczeniowa).
To **różni właściciele budżetów i różne inicjatywy**.

**Sumy MECE:** `9+5+5+3+2+5+5+5 = 39`. Każdy obszar mapuje się do **dokładnie
jednego** wymiaru. Żadnego wymiaru-widma.

---

## Tabela traceability — warstwa po warstwie

| canonical source | termin źródłowy | ID w knowledge | ID w scoring | ID w macierzy | ID w report model | widoczna sekcja raportu |
| --- | --- | --- | --- | --- | --- | --- |
| §2.3 | **oś** (7) | — | `axis.id` `1..7`; `DRD_AXIS_KEY_MAP` → `processes`, `digitalProducts`, `businessModels`, `dataManagement`, `culture`, `cybersecurity`, `aiMaturity` | `MethodUnit.parentId` | `drdVizAdapter` → `String(axis.id)` = `"1".."7"` | ⚠️ radar (jako „wymiary" — **defekt**) |
| §2.3 | **obszar** (39) | `getDRDKnowledge()` klucz `"1A#3"` = *obszar#poziom* | `area.id` `1A`..`7E` | `MethodUnit.unitId` = `1A`..`7E` | **brak** — model raportu nie zna obszarów jako jednostki agregacji | tabela szczegółowa |
| §3.2 MAP-1.0 | **wymiar raportowy** (8) | — | **BRAK** | **BRAK** | `D1`..`D8` w `drdIndustryProfiles.ts` ✅ i `maturityPathwayDrdData.ts` ✅ · **BRAK** w `drdReportModel.ts` ❌ | radar 8D, benchmark, executive summary |
| §4.1 | poziom interpretacyjny `I–V` | — | skale natywne 5/6/7 per oś | `levelScale` per jednostka | `DRD_PATHWAY_LEVEL_ROMAN` | poziom dojrzałości |
| §6.1 | `score_norm` | — | **BRAK** (`calculateAxisScore` uśrednia surowe) ❌ | — | — | wynik % |

### Gdzie dokładnie leży rozjazd — trzy niezależne miejsca

1. **`drdVizAdapter.ts:45,93`** — buduje „dimensions" z **osi** (`String(axis.id)`),
   nie z obszarów. Podział `4C/4E → D5` nigdy nie następuje.
2. **`drdReportModel.ts:262 buildDimensions()`** — konsumuje viz adapter, więc
   dziedziczy 7. `EIGHT_D_NOTE` jawnie dokumentuje to jako TODO, powołując się na
   nieistniejący (wtedy) kanon.
3. **`DRDReportTemplate.tsx:40`** — własna, **trzecia** mapa `oś → D`, 7→7,
   z komentarzem przyznającym pominięcie `D5`.

**Mapowanie obszar → wymiar wg MAP-1.0 nie istnieje w kodzie w ŻADNYM miejscu.**
Zweryfikowane pełnym skanem `src` + `server/src`: jedyne pliki zawierające
jednocześnie `4C` i `D5` to plik kolorów (przypadek) i `maturityPathwayDrdData.ts`
(tylko w komentarzu opisowym).

### Warstwy, które **już są** poprawne

- `drdIndustryProfiles.ts` — `DRDDimensionId = 'D1'|…|'D8'`, komentarz cytuje
  „Canon §3.2, MAP-1.0". Benchmarki branżowe są zdefiniowane dla **ośmiu** wymiarów.
- `maturityPathwayDrdData.ts` — 8 wymiarów × 4 przejścia = 32 kroki.

To znaczy, że **warstwa komunikacji jest już częściowo zaimplementowana**
i czeka na jedno brakujące ogniwo: agregację obszar → wymiar.

---

## Wniosek dla implementacji

**Nie oznaczamy `MODEL_CONFLICT`** — źródła nie są sprzeczne. Jest jedno
źródło (`DRD_CANON.md`), jednoznaczne w §1, §2.3, §3.2, i trzy miejsca w kodzie,
które go nie implementują.

**Brakujące ogniwo do zbudowania** (osobny krok, za flagą):

```
39 obszarów (pomiar, skale 5/6/7)
   → score_norm per obszar wg §6.1        ← BRAK (COORD-11 defekt 1)
   → agregacja obszar → D1..D8 wg §3.2    ← BRAK (to ogniwo)
   → radar 8D / benchmark / executive
```

Dopiero po zbudowaniu obu ogniw `DRDReportTemplate` może pokazać `D5`.
**Do tego czasu obecny raport (7 osi) zostaje za flagą `legacy`** — zgodnie
z poleceniem koordynatora, żeby nie podłączać brakującej sekcji na zgadywanie.

**Czego NIE robimy:** nie wymyślamy wag, nie dopasowujemy nazw heurystycznie,
nie generujemy `D5` z niczego. Mapowanie `D4 ← 4A,4B,4D` i `D5 ← 4C,4E` jest
**podane wprost w kanonie** — implementacja jest przepisaniem tabeli, nie
interpretacją.

---

## Status pól

| Pole | Wartość |
| --- | --- |
| `MODEL_CONFLICT` | **NIE** |
| `EVIDENCE_MISSING` dla MAP-1.0 | **NIE** — kanon podaje pełną tabelę |
| Implementacja MAP-1.0 | **BRAK we wszystkich trzech ścieżkach raportu** |
| Obecny raport | zostaje jako `legacy` za flagą |
| Blokada dla `drd_scoring_v2` | **ZDJĘTA** — źródło potwierdzone |
