# Zlecenie (`case` / `zlecenie`)

**Status:** PROPOZYCJA — do słowa właściciela. Moduł stoi za **podwójną bramką**, obie domyślnie
OFF: `BetaGate MODULE_CASE_WORKSPACE` (`betaMenuStatus.ts:61`, status `'closed'`) i
`isCaseWorkspaceEnabled()` (`caseWorkspaceFlag.ts`, domyślnie `false`, trasa **w ogóle nie jest
rejestrowana** przy `false` — `App.tsx:564`, `AppRoutes.tsx:1683`). Zrzuty wzięte lokalnie z
`?ff_zlecenia=1` (wzorzec 1:1 z `drdReportFlag.ts`, jedyny w repo dający zrzut bez deploya i bez
logowania właściciela, CLAUDE.md pkt 7) — `evidence/p10b8/09-case-hub.png` (`bledyKonsoli: []`).
**Brak realnego zlecenia w tej organizacji** (0 pozycji, potwierdzone empty-state „Nie masz jeszcze
żadnych zleceń — Zlecenie powstaje z projektu”) — §6 zmierzony z kodu + komentarza autorskiego
(równie szczegółowy jak w `meeting.md`, ta sama partia i ten sam wzorzec migracji).

## §0. Tożsamość

- Nazwa PL: **Zlecenie** — obiekt z planem, realizacją i rezultatami, cyklem życia i tożsamością.
- Moduł: poza menu 16 modułów (inwentarz), realnie zasilany z projektów.
- Archetyp: **C — Rekord**, klasa **L**.
- Trasa: `/zlecenia/:caseId` (`CaseWorkspaceHub.tsx:28`).
- Otwarcie: `/zlecenia` (lista) → wiersz → karta.
- Komponent: `src/components/CaseWorkspace/CaseDetailScreen.tsx:587` (2474 linii).
- Powłoka: **`StandardArtifactShell`** (SPEC-A archetyp C) — od 2026-08-10, zastąpiła wcześniejszy
  `StandardModuleBar` (powłokę LISTY, błędnie użytą dla obiektu — udokumentowane wprost w
  komentarzu autora, `:2-9`, jako realne odstępstwo naprawione). Wzorzec 1:1 z
  `Meeting/MeetingObjectPage.tsx` (jedyne dwa ekrany dziś realnie wołające
  `<StandardArtifactShell>` — patrz `meeting.md`, ta sama partia).
- Rejestr: `registry.ts` **nie zna** klucza `zlecenie` — powłoka dostaje go rzutowany
  (`karta={'zlecenie' as KartaNKey}`, `:2239`), ten sam wzorzec uzasadnienia co `meeting`.

## §1. Sekcje (centrum ekranu)

Trzy sekcje przez `StandardSekcjaDef[]` (`TABS.map(...)`, `:1647-1657`) — **K1 formalnie
spełnione**:

| sekcja | po co użytkownikowi | źródło danych → writer | aiContract | S/L |
|---|---|---|---|---|
| Plan (`plan`) | co i w jakiej kolejności ma się wydarzyć | `bundle.planVersions` → `server/src/routes/caseWorkspace/casePlanVersions.routes.ts` | `none: true` — „treść pochodzi w całości z silnika zleceń” | L |
| Realizacja (`realizacja`) | co się dzieje teraz, na co czekamy | `bundle.caseItem` + wykonanie kroków → `caseWorkspace/cases.routes.ts` | jw. | L |
| Rezultaty (`rezultaty`) | co powstało, czy potwierdzony efekt | pomiary wartości → silnik zleceń | jw. | L |

Wszystkie trzy `aiContract.none: true` z tym samym uzasadnieniem tekstowym: „model językowy jej nie
pisze i nie ma tu czego regenerować” (K3 ✓ — powód jawny). Ładowanie **rozdzielone na sekcje**
(`settleSection`) — awaria jednej daje jawny stan CZĘŚCIOWY z nazwą brakującej sekcji, nie cichą
pustkę ani błąd całego ekranu (`PartialBanner`, `:1642`) — solidniejsze niż wymaga K4 wprost.

## §2. Prawy panel (`ArtifactRightPanel`)

| sekcja | obecna? | treść | uwaga |
|---|---|---|---|
| Akcje | ✓ | „Zatwierdź i rozpocznij” (tylko dla LIGHT bez opublikowanego planu, `:1778`), inne akcje cyklu życia | logika widoczności warunkowa i uzasadniona (backend i tak by odmówił poza tym stanem — `light_one_click_case_not_ready`, komentarz `:1766-1770`) |
| Właściwości | ✓, **tabela** (`wierszeWlasciwosci`, `:1698-1730`) | Stan zlecenia, Profil, Tryb nadzoru, Samodzielność, Plan (numer+status), Założone, Ostatnia zmiana, Zamknięte, Kontraktowy typ zamknięcia, (warunkowo) Zarejestrowany typ zamknięcia | **K7 ✓** — drugi z dwóch przypadków w tej partii zrobiony poprawnie od razu (razem z `meeting`) |
| Powiązania | ✓ (`linkiPanelu`, `:1751`) | `bundle.artifactLinks` z rozstrzygnięciem czy dany link jest otwieralny | pusty stan „Nic jeszcze nie powiązano” |
| Źródła i założenia | ✓ (`zrodla`, `:1755-1764`) | Kryteria odbioru, Polityka budżetu, Polityka samodzielności, Dowód zamknięcia — filtrowane, pokazują tylko wypełnione | zgodne z K9 (karta ma źródła/założenia mimo `aiContract.none` na sekcjach centrum — właściwy powód: dane pochodzą z polityk, nie z AI) |
| **Komentarze** | pominięta, **powód = decyzja właściciela OD-12** (2026-08-12), nie brak API | „Case Workspace nie ma żadnej funkcji komentarzy… świadomie odroczone poza V1 jako `DEFERRED_POST_V1`, odnotowane w `11_OWNER_DECISION_REGISTER.md` i `VISUAL_TRIADA_SPEC_A_LEDGER.csv`” | **jedyny przypadek w tej partii, gdzie pominięcie ma udokumentowaną decyzję właściciela z numerem, nie tylko techniczne uzasadnienie autora kodu** — najsilniejszy dowód zgodności z K10 w całej partii |
| Historia | ✓ (`zdarzeniaHistorii`, `:1746-1750`) | zdarzenia realne (`bundle.history`) + syntetyczne fakty cyklu życia scalone chronologicznie (`syntetyczneZdarzeniaCyklu`) | staranność ponad wymóg K10 — dwa źródła historii scalone jedną osią czasu, nie dwie listy |

**K11 spełnione** — jeden panel, kolejność zgodna z kanonem.

## §3. Menu 5 i nawigacja

Adres niesie stan (`?zakladka=&widok-planu=&krok=`) — link do konkretnego widoku da się wysłać
drugiej osobie (udokumentowane w komentarzu autora, `:28-30`). Projekcja planu (Prosty/Ekspercki/
Lista) żyje w slocie `toolbar` (`NModeToolbar`, jedyna dozwolona droga własnego paska wg SPEC-N
§2.4) — nie jest to naruszenie, to udokumentowany wyjątek kanonu. Brak „Pracuj z AI ▾” (bo żadna
sekcja go nie potrzebuje, wszystkie `aiContract.none`) i brak paska modułu z pigułką nad kartą (K19
✗, ten sam kształt odstępstwa co `meeting` i pozostałe karty w tej klasie z `KARTA_N_KONTRAKT.md`
§7).

## §4. AI

Zero — identycznie jak `meeting`, wszystkie trzy sekcje centrum deklarują `aiContract.none: true`
z uzasadnieniem. `zlecenie`/`case` nie ma wpisu w `cardAnalysisRubric.ts` (K21/K24 ✗ formalnie, ale
uczciwie — silnik zleceń pisze treść deterministycznie, nie model językowy).

## §5. Czytelność

- `grep -c "primary-[0-9]"` = 0 (K17 ✓).
- Zero wzmianek „Teresa” w pliku (K27 ✓).
- i18n: etykiety prawego panelu to **hardkodowane literały polskie** (nie `t()`) — np. `label:
  'Stan zlecenia'`, `label: 'Plan'` (`:1700-1719`). To nie jest naruszenie K25 (treść jest po
  polsku), ale oznacza brak mechanizmu i18n w tej części ekranu — do odnotowania jako dług
  techniczny (angielska wersja produktu pokazałaby te same polskie etykiety).
- K19 pigułka modułu: ✗ (kod), niepotwierdzone zrzutem realnego rekordu.
- K20: zrzut huba (1440, `09-case-hub.png`) bez poziomego przewijania.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✓ | `StandardSekcjaDef[]`, `:1647-1657` |
| K2 kontrakt steruje renderem | ✓ | brak flagi `VITE_VF1_*` dotyczącej tej karty |
| K3 sekcja→writer/powód | ✓ | wszystkie 3 z `aiContract` i powodem |
| K4 reguła pustki | ✓ (ponad wymóg — `settleSection`/`PartialBanner`) | §1 |
| K6 Akcje | ✓ | warunkowa logika uzasadniona kodem |
| K7 Właściwości tabela | **✓** | `ArtifactPropertiesTable`, nie akapit |
| K8 Powiązania | ✓ | `linkiPanelu` z rozstrzygnięciem otwieralności |
| K9 Źródła i założenia | ✓ | `zrodla`, filtrowane |
| **K10 Komentarze pominięte z decyzją właściciela** | ✓ (**wzorcowe** — OD-12, numerem) | `:2158-2163` |
| K10 Historia | ✓ | scalona chronologia realna+syntetyczna |
| K11 jeden panel | ✓ | kolejność kanoniczna |
| K12 Menu 5 (3 elementy) | ✗ (częściowe — sekcje przez `NModeLeftNav`, brak Pracuj z AI bo niepotrzebne) | §3 |
| K17 zero primary | ✓ | 0 trafień |
| K19 pigułka modułu | ✗ (kod), niepotwierdzone zrzutem rekordu | §3 |
| K21 Pracuj z AI | ✗ (uczciwie — zero roli AI) | §4 |
| K25 i18n | ✓ treść (brak mechanizmu `t()` w panelu — dług, nie naruszenie) | §5 |
| K27 Teresa tylko Menu 1 | ✓ | zero wzmianek |
| K29 zero błędów konsoli | ✓ | `bledyKonsoli: []` |
| K30 zrzut z realnym rekordem | **✗ — brak rekordu** | 0 zleceń w organizacji; zmierzony tylko hub pusty |

## §7. Luki → naprawa

1. **Dopisać `zlecenie`/`case` do `registry.ts`** zamiast rzutowania — identyczna naprawa jak dla
   `meeting`, ten sam koszt (S), można zrobić razem.
2. **Pasek modułu z pigułką (K19)** — razem z `meeting`/`audit-report`/`assessment-report`/
   `presentation`/`audit-criterion` (`KARTA_N_KONTRAKT.md` §7), nie osobno. Rozmiar: M (współdzielony).
3. **Wprowadzić `t()` do etykiet prawego panelu** — dziś hardkodowane, działa tylko dlatego, że
   produkt jest po polsku; blokuje przyszłą wielojęzyczność bez dodatkowej pracy. Rozmiar: S.
4. **Zmierzyć na żywym rekordzie po odblokowaniu.** Zlecenie „powstaje z projektu” (empty-state) —
   utworzenie realnego rekordu do zmierzenia K4/AI/K19 wymaga przejścia przez przepływ projektu,
   poza zakresem tej sesji dokumentacyjnej.

**STOP:** brak żywego rekordu do zmierzenia K19/pełnego K30 na otwartej karcie — opisane jako luka
#4. Przepis: `?ff_zlecenia=1` → utworzyć projekt z uruchomionym zleceniem (poza tym modułem,
prawdopodobnie w Inicjatywach/Realizacji) → wrócić do `/zlecenia` → otworzyć kartę → zrzut z
rozwiniętymi wszystkimi trzema sekcjami (Plan/Realizacja/Rezultaty), bo „Pracuj z AI” nie istnieje
na tej karcie (K30 wymaga adaptacji jak w `meeting.md`).
