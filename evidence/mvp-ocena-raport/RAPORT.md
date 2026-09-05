# Ocena — raport z oceny czyta OBA magazyny (MVP, 06.09.2026)

Gałąź `mvp/ocena-raport`, worktree `/private/tmp/wt-ocena`, baza `codex/m03-admin-20260824`
+ scalona fala 2 (`mvp/naprawy-noc-2`). Zero zmian w serwerze, zero zmian w migracjach.

## 1. Mapa magazynów — POMIAR, nie założenie

Moduł Ocena trzyma wyniki w DWÓCH niezależnych magazynach:

| | magazyn KANONICZNY (jądro method-core) | magazyn ZASTANY (legacy) |
|---|---|---|
| tabele | `method_outputs`, `method_findings`, `method_sessions`, `method_report_snapshots` | `assessments` (`answers_json`), `assessment_reports`, `assessment_report_sections` |
| trasy odczytu | `GET /api/method/outputs[/:id]`, `/sessions/:id[/approvals]` | `GET /api/assessments`, `GET /api/v8/assessment/:id`, `GET /api/assessment-reports[/:id]` |
| kto czytał przed naprawą | `AssessmentOutputsTab`, `AssessmentReportView` (trasa `/assessment/outputs/:id/report`) | zakładki Biblioteka/Raporty, `ReportEditor`, `useReportSections` |
| tabele `mc_*` | **nie istnieją w repo** (sprawdzone na 1118 plikach migracji) | — |

Liczby per organizacja (zapytania wprost do baz, 06.09):

| magazyn / tabela | stanowisko lokalne, org DBR77 `cc9db573…` | staging, org właściciela `a3e05d4a…` |
|---|---|---|
| `assessments` (zastany) | **4** | **10** |
| `assessment_reports` (zastany) | **4** | **1** |
| `assessment_report_sections` | 0 | 9 |
| `method_sessions` (kanoniczny) | **0** | **3** |
| `method_outputs` (kanoniczny) | **0** | **1** |
| `method_findings` | 0 | 0 |
| `method_report_snapshots` | 0 | 1 |

**10 z 11 realnych ocen właściciela leży w magazynie ZASTANYM.** Jedyny Output kanoniczny
na stagingu (`92f3bd7f…`) to wynik z „vertical-slice demo" (EventDerivedOutputBridge)
z JEDNĄ komórką macierzy (`{"1A": 3}`) i pustą agregacją.

## 2. Przyczyna

`src/components/assessment/AssessmentOutputsTab.tsx` (lista) i
`src/components/assessment/report/reportApi.ts` (trasa raportu) czytały WYŁĄCZNIE jądro
method-core. Dla każdej realnej oceny właściciela `GET /api/method/outputs/:id` zwracał
404, więc widok pokazywał „Nie znaleziono zamrożonego Outputu", a lista — „Brak wniosków".
To ten sam kształt defektu, który zabijał Inicjatywy (org DBR77: 71 wierszy legacy,
0 kanonicznych, pusta lista).

## 3. Naprawa (plik:linia)

Wzorzec 1:1 z `src/components/Initiatives/initiativeRegisterProjection.ts`
(`mergeLegacyInitiativesIntoRegister:387`).

- **NOWY SSOT projekcji**: `src/components/assessment/assessmentOutputProjection.ts`
  - `odczytajPoziomyZOdpowiedzi:117` — czyta OBA realne kształty `answers_json`:
    `drd.areas['1A'].achievedLevel/targetLevel/levelNotes` ORAZ starszy
    `drd.<filar>.areaScores['1A'] = [obecny, docelowy]`; `areas` wygrywa przy kolizji;
    wartość 0 = BRAK pomiaru (nie „zmierzone zero").
  - `scalOcenyZastaneZOutputami:222` — klucz `id`, przy kolizji wygrywa kanoniczne,
    zastane doklejane na koniec, brak dodatków → ta sama referencja tablicy.
  - `projektujOceneZastanaNaOutput:249` — `achievedLevel→current`, `targetLevel→target`,
    `gap = target − current` (jedyne działanie arytmetyczne); `aggregation`/`findings`/
    `contentHash`/`frozenAt` puste, bo tego magazyn zastany NIE MA.
  - przestrzeń id `ocena~<assessmentId>` (`PREFIKS_OCENY_ZASTANEJ:180`) — kolizja z jądrem
    z definicji niemożliwa.
- **Lista**: `AssessmentOutputsTab.tsx:66` (import), `:105` (`pobierzOcenyZastane`),
  `:158` (`Promise.all([listOutputs(), pobierzOcenyZastane()])` + scalanie),
  `:213` (podgląd nie pyta jądra o wiersz zastany), `:299` (chip „Zapis sesji").
- **Trasa raportu**: `report/reportApi.ts:132` (`fetchOutputForReport` — prefiks zastany
  albo fallback po 404), `:161` (`pobierzRaportZMagazynuZastanego`), `:88`
  (`pobierzOceneZastana` — świadomie `GET /api/v8/assessment/:id`, bo
  `/api/assessments/:id` **wycina** `answers_json`, sprawdzone na żywym serwerze),
  `:110` (`pobierzTrescRaportuZastanego`).
- **Kontener**: `report/AssessmentReportView.tsx:66` — dla wyniku zastanego nie pyta o sesję
  jądra ani o ślad zatwierdzeń (dwa pewne 404).
- **Dokument**: `report/AssessmentReportDocument.tsx` — `unitNotes` per obszar (`:251`,
  `:305`, `:427`), baner źródła (`:731`), chip cyklu życia (`:686`), rozdział „Treść raportu
  zapisanego w module Ocena" (`:1214`), stopka (`:1319`); osobno licznik „Jednostek z luką"
  liczony z `current`/`target`, nie z listy wniosków (`:520`).

## 4. Dowody

**Testy** (14 nowych, wszystkie na REALNYCH fikstórach zdjętych curl-em z żywego API :4130):
- `src/components/assessment/__tests__/assessmentOutputProjection.test.ts` (11)
- `src/components/assessment/report/__tests__/raportOcenyZastanej.test.tsx` (3)
- fikstury: `src/components/assessment/__tests__/fixtures/*.json`

**Mutacje** (uruchomione, nie opisane):
| mutacja | wynik |
|---|---|
| `scalOcenyZastaneZOutputami` → `return kanoniczne` | 1 failed / 10 passed — **pada** |
| `odczytajPoziomyZOdpowiedzi`: wyłączona gałąź `areas` | 3 failed / 8 passed — **pada** |
| `fetchOutputForReport`: usunięty prefiks + fallback po 404 | 3 failed / 0 passed — **pada** |
| przywrócenie kodu | 11/11 i 3/3 zielone |

**Zrzuty** (`evidence/mvp-ocena-raport/`, `bledyKonsoli = 0`):
| plik | co pokazuje |
|---|---|
| `przed-lista-outputow.png` | PRZED (vite 3096 na commicie `54a80888fc`, ta sama baza): „Wszystkie **0**", „Brak wniosków" |
| `przed-raport.png` | PRZED: „**Nie znaleziono zamrożonego Outputu**" |
| `po-lista-outputow.png` | PO: **4 wiersze**, chip „Zapis sesji", moduł „Ocena" |
| `po-raport-gora.png` | PO: nagłówek, „Jak prowadzono badanie", „Ograniczenia i założenia", liczniki (39 / 0 / 39 / **34 z luką**) |
| `po-raport-macierz.png` | PO: **macierz DRD osi 1 z TREŚCIĄ komórek** (7 poziomów × 9 obszarów, terminy technologiczne), znaczniki AS/TO, bloki obszarów z definicjami poziomów i **notatką konsultanta** |
| `po-raport-podsumowanie.png` | PO: „Obraz całości", „Treść raportu zapisanego w module Ocena", „Rekomendacje priorytetowe", stopka |
| `po-raport.png` | PO: pełna strona, **44 533 znaki** treści |

**Sprawdzenie na danych właściciela** (staging, tylko odczyt): projekcja przepuszczona
przez `answers_json` wszystkich 5 jego ocen z odpowiedziami — daje odpowiednio 5/1/3/1/1
obszarów. Działa na obu kształtach zapisu. **Uwaga: jego oceny są wypełnione w 1–5
obszarach z 39** (completion 0–8%), więc jego raport będzie chudy z powodu DANYCH,
nie kodu. Do pokazu na żywo najlepsza jest ocena wypełniona w 100%.

## 5. Domknięcie

| bramka | wynik |
|---|---|
| esbuild dotkniętych plików | OK (6 plików) |
| `vitest src/components/assessment tests/unit/i18n` | 33 failed / 202 passed; **baza `54a80888fc`: 33 failed / 188 passed** → 0 nowych czerwonych, +14 zielonych |
| `bash scripts/check-list-canon.sh` | ✓ dług 361 vs baseline 364 (spadł o 3) |
| `bash scripts/check-artefakt.sh` | ✓ 8 vs baseline 8 |
| `cd server && npx tsc --build tsconfig.build.json` | exit 0 |
| zmodyfikowane migracje | **0** |

Zastane czerwone (NIE z tej pracy, potwierdzone pomiarem na `54a80888fc`):
`AssessmentOutputsTab.test.tsx` i `AssessmentLibraryTab.canon.test.tsx` padają na
`useLocation() may be used only in the context of a <Router>` — skutek scalenia fali 2
(`JedenPrawyPanel`), testy nie opakowują komponentu w router.

## 6. Czego NIE zrobiono

- Seed lokalny (`seed-full-assessment-module.ts`) trzyma `executive_summary` i pozycje
  raportu **po angielsku** — widać to na zrzucie podsumowania. To dane, nie kod; nie
  ruszałem, bo to zmiana treści demo, nie naprawa.
- Duplikat: ocena, którą ktoś zamroził do jądra, może pokazać się na liście dwa razy
  (raz jako Output, raz jako wiersz zastany) — nie ma ŻADNEGO odnośnika łączącego
  `method_sessions` z `assessments`, a dopasowanie po nazwie byłoby zgadywaniem.
  Wybór świadomy: widoczny duplikat jest lepszy niż zniknięta ocena właściciela.
- Zakładki statusów nad listą („Szkic 0 · 4 ukryte") nie znają wierszy zastanych —
  domyślne „Wszystkie" pokazuje komplet.
