# Results Next — HANDOFF 2026-08-12

Napisany, bo **wyczerpał się limit sesji** (reset 14:00 Europe/Warsaw), nie
dlatego, że praca stanęła. Zastępuje `RESUME_HANDOFF_2026-08-11.md` jako punkt
wejścia; tamten zostaje jako historia.

> **Stan programu: `IMPLEMENTED_EVIDENCED_CANDIDATE` NIE OSIĄGNIĘTY.**
> Nic nie wypchnięte, nic nie zmergowane do `demo`, nic nie wdrożone,
> wszystkie trzy flagi domenowe domyślnie WYŁĄCZONE.

---

## 1. Dokładny stan — zmierzony, nie przepisany

| | |
|---|---|
| Worktree bazowy | `.../consultify-results-vnext-g0-20260809` |
| Gałąź | `codex/results-vnext-g0-20260809` |
| HEAD bazy na starcie i przez całą sesję | `35a1dee6c03b66907219b5b645e4e3ecb267f80a` — **wszystkie dziesięć torów RN-G5 wychodzi z tego SHA** |
| HEAD bazy teraz | ten commit (dopisanie niniejszego handoffu — jedyna zmiana bazy w tej sesji) |
| Przed `origin/demo` | 338 |
| **Za `origin/demo`** | **2 — demo przesunęło się W TRAKCIE tej sesji** |
| Wypchnięte | nic, nigdy |
| Wdrożone | nic, nigdy |

**Uwaga o `origin/demo`**: na starcie sesji baza była 338/0, teraz jest 338/2.
Ktoś wypchnął dwa commity na demo w trakcie. Przed integracją sprawdź, czy nie
kolidują z zakresem Results Next.

### Brudne drzewo bazy — pięć plików CUDZEJ sesji, NIETKNIĘTE

```
server/src/database/PostgresDatabase.ts                                   (M)
tests/resultsVnext/kpi/initiativeKpiImpactBaselineFreeze.realdb.test.ts    (M)
tests/resultsVnext/kpi/kpiIdentityAcrossSurfaces.realdb.test.ts            (M)
tests/resultsVnext/kpi/kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts (M)
server/migrations/20260810_fix_initiatives_status_default.sql             (??)
```

Zero `reset`/`checkout`/`restore`/`stash`/`clean`/`stage`/`commit`. Nie
utworzono trzeciej konkurencyjnej naprawy `initiatives.status`.

---

## 2. Dziesięć torów RN-G5 — wszystkie na własnych gałęziach, ŻADEN nie scalony

Baza każdego: `35a1dee6c0`. Wszystkie drzewa czyste.

| Gałąź | HEAD | Commitów | Stan |
|---|---|---|---|
| `rn-g5-harness` | `b644f3adfc` | 2 | PRZYJĘTY |
| `rn-g5-crossdomain` | `bebddfc303` | 3 | PRZYJĘTY |
| `rn-g5-polish2` | `9942bc6772` | 9 | PRZYJĘTY |
| `rn-g5-kpicreate` | `4219e70b11` | 8 | PRZYJĘTY |
| `rn-g5-deeplink` | `5b9ced8397` | 6 | PRZYJĘTY |
| `rn-g5-scopegap` | `d6e33caccd` | 4 | PRZYJĘTY |
| `rn-g5-teresa` | `9a8498172c` | 10 | PRZYJĘTY z ograniczeniami |
| `rn-g5-interactive` | `fc789183b6` | 10 | PRZYJĘTY (raport weryfikacyjny) |
| `rn-g5-authz` | `205c038912` | 41 | **PARTIAL — 3 pliki KPI bez bramki** |
| `rn-g5-platform` | `0431e35dbf` | 1 | **NIEDOKOŃCZONY — bramki nie przebiegły** |

Dwa ostatnie commity (`205c038912`, `0431e35dbf`) **zrobił orkiestrator**, bo
agenci padli na limicie sesji przed commitem. Praca jest cała; **bramki NIE
zostały uruchomione na tych dokładnych drzewach**.

---

## 3. Co zostało dowiezione

**B1 (OQ-UI-I) — DOMKNIĘTY.** Inwentaryzacja wykazała, że handoff z 08-11 był
nieaktualny: nie „pięć z sześciu zepsutych", tylko **11 z 12 ekranów montowało
już komponent produkcyjny**. Trzy resztki naprawione i zweryfikowane wzrokiem
orkiestratora:
1. `results-vnext-okr-workspace` miał atrapowe `onSetChanged`/`onBackToSets`
   przy `set` jako zwykłym `const` — status nigdy nie odświeżał się po przejściu
   cyklu. Naprawione; zrzut po kliknięciu pokazuje „Złożony do akceptacji",
   postęp 62,5% ze skali 0–1, akcje zablokowane z powodem (D06).
2. Harnessy ROI i OKR omijały powłoki flagowe `ResultsRoiRegistryPage`/
   `ResultsOkrRegistryPage` — realne wejścia tras. Naprawione.
3. `main.tsx` opisywał ekrany jako starą drugą implementację. Poprawione.

**Fala 3 — dowody przekrojowe: 18/18 na realnym PG17.** Pięć plików
`tests/acceptance/rvn-g4-*.e2e.test.ts`, których poprzednia sesja **nigdy nie
uruchomiła**, wykonano na efemerycznej bazie (168 migracji, zbieżność przez
`information_schema` = 1404 tabele, nie przez `schema_migrations`). Wszystkie
dziesięć punktów przekrojowych udowodnione, w tym **D07**. Trzy kontrole
negatywne na realnym kodzie produkcyjnym. Po odesłaniu przez orkiestratora agent
przejrzał pozostałe 15 asercji i **wzmocnił dwie realnie słabe**.

**Tworzenie KPI — ZBUDOWANE OD ZERA.** Nie istniało w UI w ogóle. Pełna ścieżka
przeklikana: szkic → edycja → zgłoszenie → odmowa samo-zatwierdzenia → drugi
aktor → zatwierdzenie; osobno odrzucenie z wymaganym powodem. 33 zrzuty.

**Deep link ROI/OKR — ZBUDOWANY.** Trasy były martwymi stałymi. Żaden komponent
pełnego narzędzia nie umiał ładować się z identyfikatora — dobudowano dwie
strony ładujące. Programy i Cykle OKR dostały pierwsze wejście w aplikacji.

**Reszta zakresu**: `/attention` (jedna powłoka, bo kształty KPI i OKR są
**udowodnienie niekompatybilne**), zapis kart wyników (6 operacji przeklikanych),
zakładka PIR ROI.

**Teresa (D13)**: ROI, KPI i OKR. Ścieżka ręczna bez Teresy udowodniona realnym
przebiegiem z martwym endpointem.

**Komunikaty błędów**: ~55 z ~60 surowych `err.message` zamienionych na
przetłumaczone w 21 plikach, wspólnym helperem.

---

## 4. BLOKERY — stan otwarty

### B-A — bramka uprawnień niekompletna (P1)
`rn-g5-authz`: ROI **19/19**, OKR **13/13**, KPI **3/6**. Bez bramki zostały
`kpiCorrectiveActionCommands.ts`, `kpiInitiativeImpactCommands.ts`,
**`kpiScorecardCommands.ts`** — ostatni jest istotny, bo `rn-g5-scopegap` właśnie
dobudował do kart wyników pełny zapis z publikacją migawek.
Pomiar PO bramce **NIEZMIERZONY** — agent padł przed jego zakończeniem.

### B-B — trzy P1 z rundy interaktywnej, naprawa niezweryfikowana
`rn-g5-platform`: cicha awaria zapisu w formularzu powiązania finansowego, utrata
fokusu po Esc w modalu z trwałego CTA, kebab niereagujący na Esc. Agent
zaraportował 7/7 testów bez regresji **tuż przed śmiercią**; `git diff --check`,
`tsc`, `vite build` i kanony **NIE przebiegły**. `Modal.tsx` ma 25+ konsumentów —
regresja poza Results Next **niesprawdzona**.

### B-C — odrzucona definicja KPI jest nie do naprawienia (P1, `server/**`)
W całym `server/src/services/resultsVnext/` istnieje **dokładnie jeden**
`INSERT INTO rvn_kpi_definition_versions` — w `createKpiDraft`
(`kpiDefinitionCommands.ts:319`). Po odrzuceniu wersja ma terminalny
`approval_status='rejected'`, root wraca do `'draft'`, ale `editDraft` wymaga
`'draft'` **na wersji** — nie ma czego edytować ani jak zgłosić ponownie.
**KPI zostaje trwale zablokowane.** Komentarz w kodzie twierdzi, że można
poprawić i zgłosić ponownie — kłamie.

### B-D — D08/B2 niezmieniony
Powód `not_calculable` liczony przez `okrSetRollupCalculator`, ale
`applySetRollupUpdate` (`okrCheckInCommands.ts:279-295`) nie ma go w liście
kolumn `UPDATE`; dla check-inu kolumny nie ma w DDL w ogóle. Na poziomie Zestawu
i check-inu `null` i „nieobliczalne" renderują się **identycznie**. Naprawa
addytywna: 3 × `ADD COLUMN NULL` + 6 plików.

### B-E — brak trasy dyspozycji Teresy dla refleksji OKR
ROI ma (`roi.routes.ts:2798`), OKR nie ma żadnej. Ograniczenie ujawnione w
tekście UI, nie zamaskowane.

### B-F — luki B3 nadal otwarte
Brak `GET` dla działań korygujących i weryfikacji skuteczności; brak odwrotnego
`kpi → scorecards`; **brak trasy dla `listScenarioOverrides` w ROI — nadpisanie
scenariusza da się zapisać i nie da się odczytać**; brak punktu odkrycia dla
`cadenceOccurrenceId`.

### B-G — żaden `GET` nie zwraca nazwy KPI
`kpiRepository.ts` nie łączy z `rvn_kpi_definition_versions`; nazwa, jednostka i
geometria celu wracają wyłącznie jako efekt uboczny zapisu. Wzorzec złączenia
istnieje w `kpiPerspectivesRepository.ts:165`, ale nie jest tu użyty. UI obchodzi
to po stronie klienta — obejście, nie naprawa.

### B-H — `initiatives.status DEFAULT 'step3'` (B4 z poprzedniej sesji)
Nadal łamie własny CHECK. Potwierdzone na świeżym schemacie. Nietknięte, bo
naprawa należy do równoległej sesji.

---

## 5. Czego dowody NIE dowodzą — czytaj przed oceną

- **Żaden ekran nie był oglądany na realnych danych.** Wszystkie zrzuty
  pochodzą z harnessu `dev-render` z podstawioną warstwą sieciową. To dowód
  układu i logiki komponentu, **nie** dowód endpointu ani trwałości.
- Testy przekrojowe wołają komendy **bezpośrednio, w procesie** — bez HTTP, bez
  middleware uwierzytelniania, bez walidacji żądania.
- **Macierz UI/CX z `06_ACCEPTANCE_AND_VERIFICATION_HANDBOOK.md` §11–13 nie
  została przejechana ani razu**, na żadnym SHA.
- Literalny F5 na deep-linku **nie został sfotografowany** — harness używa
  `MemoryRouter`. Zastępczo użyto świeżego procesu trafiającego wprost w adres.
- Izolacja tenantów kart wyników jest **warstwowa**: zepsucie jednego filtra nie
  czerwieni żadnego testu. Zielona kontrola negatywna na tej warstwie **nie
  dowodzi**, że dana linia jest punktem egzekwowania.
- `dev-render/` jest **poza zasięgiem `tsc`** (`"include": ["src","*.ts","*.tsx"]`).
  Zielony typecheck nigdy nie mówił nic o plikach harnessu.
- Dwa ostatnie commity nie mają przebiegniętych bramek.

---

## 6. Następne polecenie dla następcy

**Nie twórz konkurencyjnego planu. Nie zaczynaj od nowa.**

1. Potwierdź bazę: `git rev-parse HEAD` = `35a1dee6c0`, `git status --short` =
   dokładnie pięć cudzych plików.
2. Sprawdź dwa commity, o które przesunęło się `origin/demo`.
3. **Domknij `rn-g5-authz`**: trzy pliki KPI + kontrola negatywna dla nowo
   bramkowanych domen + tabela komenda→zdolność.
4. **Domknij `rn-g5-platform`**: uruchom bramki na `0431e35dbf` i sprawdź
   regresję `Modal.tsx` poza Results Next.
5. **Integracja** w tej kolejności (konflikty addytywne, zachowaj obie strony):
   `harness` → `polish2` → `kpicreate` → `deeplink` → `scopegap` → `teresa` →
   `platform` → `authz` → `crossdomain`.
   - `ResultsKpiRegistryPage.tsx`: `polish2` dodał 1 import + 4 podmiany w
     `catch` (linie 485/549/565/586 oryginału); `kpicreate` dodał nowe bloki
     `catch` tym samym surowym wzorcem — **zastosuj tam helper**.
   - `ResultsOkrHub.tsx`: `deeplink` dodał linki do Programów/Cykli; `scopegap`
     przewidział `OkrAdminQuickNav` w tym samym miejscu — **sprawdź duplikat**.
   - Wepnij trzy elementy z `RN_G5_SCOPEGAP_DESIGN.md` §2/§3/§4.
6. **Po integracji**: uruchom 18 testów przekrojowych na zintegrowanym SHA —
   zaczną dostawać odmowę od bramki. **Nadaj aktorom zdolności w fiksturach,
   NIE osłabiaj bramki.**
7. Domknij B-C, B-D, B-E, B-F w `server/**` — dopiero teraz, bo `authz` już nie
   trzyma tych plików.
8. Zasiej realistyczny zbiór lokalnie (`server/scripts/build-demo-dataset.ts`) —
   decyzja właściciela z 08-12: **nie testujemy na demo**.
9. **Dopiero wtedy** macierz UI/CX na JEDNYM finalnym SHA i pakiet dowodowy.

---

## 7. Reguły, które ta sesja potwierdziła albo zmieniła

- **ZMIANA: commituj małe części NA BIEŻĄCO, bramki po commitach.** Awaria sieci
  ubiła sześciu agentów, którzy trzymali godziny pracy w niezacommitowanym
  drzewie. Złe typy w gałęzi tematycznej są odwracalne; utracona praca nie.
- **Niezależny przegląd Opusa wyłapał to, czego raporty nie zgłaszały**:
  bramkę wywoływaną przez 4 z 35 plików, fałszywy dowód `?ff=off`, wyciek nazwy
  zdolności na drut, słabe asercje w „18 zielonych za pierwszym razem".
- **Odsyłanie działa.** Każdy odesłany tor wrócił z realnym postępem, a nie z
  obroną poprzedniego stanowiska.
- Agenci **sami zgłaszali wyjścia poza allowlistę**, łącznie z plikami, których
  orkiestrator nie wskazał.
- **Zrzut dowodzi renderowania, nie klikalności** — potwierdzone po raz kolejny:
  tor tworzenia KPI znalazł dwie realne wady dopiero podczas klikania.

---

## 8. Potwierdzenia

- Nic nie wypchnięte. Nic nie zmergowane do `demo`. Nic nie wdrożone.
- Trzy flagi domenowe: rozstrzygnięcie kończy się `return false`.
- Pięć plików równoległej sesji nietknięte.
- `.claude/launch.json` nigdzie nie zacommitowany.
- Nie deklaruję `ACCEPTED_*` ani gotowości produkcyjnej.
