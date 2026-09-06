# Audyt UI — Finanse (dla CD PROJEKT jutro) — 2026-09-06

Baza: worktree `/private/tmp/m03`, frontend `http://localhost:3090` → API `127.0.0.1:4100` →
Postgres lokalny, org DBR77 (`cc9db573-260f-4a19-927f-f3cc1fbaea38`). Sesja:
`/private/tmp/stanowisko-noc/auth-fin.json` (kopia `auth.json`). Wszystkie zrzuty:
`evidence/audyt-mvp-20260906/FIN/*.png` (+ `.json` z `bledyKonsoli`/`tekst`/`dom` obok każdego).
Zero edycji kodu, zero commitów. `bledyKonsoli` = `[]` na WSZYSTKICH zrzutach (zero błędów JS).

**Efekt uboczny do posprzątania (ujawniam wprost):** klik „Otwórz” na wierszu CD PROJEKT (patrz
defekt #1) utworzył jeden dodatkowy, pusty artefakt kanoniczny `STATEMENT_PACK`
(`fe74a3a5-b7a5-4417-8721-b484b7a5dcb7`, naturalKey `"Grupa Kapitałowa CD PROJEKT FY2024"`,
`finance_business_versions` DRAFT, zero linii) — NIE skasowałem (audyt tylko-odczyt). Do usunięcia
przed jutrem, żeby nie zaśmiecał listy/wyszukiwania.

## Tabela ekranów

| # | Ekran | Co sprawdzono | Wynik | Dowód | Waga | Plik:linia |
|---|---|---|---|---|---|---|
| 1 | Sprawozdania — lista (`?tab=statements`) | zrzut 1440, konsola, DOM | OK — StandardTable, 1 rekord CD PROJEKT, chipy, polskie zakładki, zero błędów konsoli | `01-sprawozdania-lista.png` | — | — |
| 2 | Sprawozdania — podgląd (klik wiersza) | preview panel | DEFEKT: badge „APPROVED” surowy EN zamiast „Zatwierdzone” (lista obok tego samego rekordu POKAZUJE „Zatwierdzone” — niespójność w jednym ekranie); pole „Stan pakietu” = pełne angielskie zdanie z backendu | `02-sprawozdania-podglad.png` | WAŻNY / WAŻNY | `src/components/Economics/FinancePreviewPanel.tsx:441` · `server/src/services/financialStatementPackService.ts:216-224` |
| 3 | Sprawozdanie — karta pakietu, klik „Otwórz” | przepływ klikany lista→wiersz→Otwórz | **BLOKER**: „Otwórz” NIE otwiera prawdziwego pakietu (238 linii) — tworzy/otwiera NOWY, PUSTY artefakt („Brak linii sprawozdania dla tej wersji.”, „Powiązane artefakty 0 powiązań” dla WSZYSTKICH czterech typów) | `03-sprawozdanie-karta.png` | **BLOKER** | przyczyna udokumentowana w `server/src/services/finance/canonical/legacyIdBridgeService.ts:1-33` (brak wiersza w `finance_artifact_aliases` dla tej organizacji/pakietu — most legacy↔kanoniczny nieuzupełniony) |
| 4 | Sprawozdanie — prawdziwy pakiet (dostęp bezpośredni przez ID, bo „Otwórz” nie prowadzi tu wprost) | pełna tabela RZiS/Bilans/CF | **BLOKER** ×2: (a) tytuł karty = surowy `naturalKey` techniczny („seed:finance-cdprojekt-2025:…:GRUPA_KAPITALOWA_CD_PROJEKT”); (b) WSZYSTKIE ~119 wierszy w kolumnie LINIA to surowe kody SCREAMING_CASE (`AP`, `CASH`, `CURRENT_ASSETS`, `EQUITY_PARENT`, `RETAINED_EARNINGS_CURRENT`…), zero polskich nazw. Liczby SĄ poprawne i widoczne: aktywa 3 026 438 / 3 503 320, „zysk netto” (`RETAINED_EARNINGS_CURRENT`) 444 253 / 594 708 — zgodne z zadaniem, ale pod nieczytelną etykietą | `03e-canonical-direct.png` | **BLOKER** | `src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx` (tytuł), `.../deriveStatementTable.ts` (etykiety linii) |
| 5 | Analiza — lista (`?tab=analysis`) | zrzut, DOM | Pusty, ale UCZCIWY stan („Brak analiz. Utwórz pierwszą analizę.”) — MIMO że pakiet CD PROJEKT ma już 1 policzoną analizę widoczną przez inny kanał (poz. 4/6) — split między dwoma źródłami danych. Kosmetyka: nagłówek kolumny „TYP” występuje DWA razy | `05-analiza-lista.png` | WAŻNY / KOSMETYKA | `src/components/Economics/FinanceHub.tsx` (lista `analysis` czyta legacy `/api/economics/*`, nie kanoniczne artefakty) |
| 6 | Analiza — karta wskaźników (dostęp bezpośredni przez ID, bo lista jest pusta i link „Powiązania” w kartach nie nawigował w moim teście) | tabela 17+ wskaźników | **BLOKER** ×3: (a) tytuł = surowy `naturalKey` („derived-analysis:script:4db71c39-…”); (b) nazwy wskaźników PO ANGIELSKU („Cash Conversion Cycle”, „Cash Ratio”, „Current Ratio”, „Debt to EBITDA (LTM)”, „Days Sales Outstanding”…) i kategorie SCREAMING_CASE EN („EFFICIENCY”, „LIQUIDITY”, „LEVERAGE”); (c) kolumna „WZÓR” pokazuje surowy KOMENTARZ Z KODU ŹRÓDŁOWEGO: *„…composed from the three underlying KPI catalog entries via formula_ref (DRY at the AST level, ADR section 5.4).”* — identyczny tekst zduplikowany w kolumnie „INTERPRETACJA”; kolumna „KOMENTARZ” dla „Debt to EBITDA” pokazuje surowy kod błędu z UUID: `NA_REASON:DENOMINATOR_MISSING — … got 'FY' for 3206a8c3-c67c-4816-b594-eea4d4933408` | `06-analiza-karta.png` | **BLOKER** | `src/components/Finance/Analysis/analysisKpiTable.contract.ts` (etykiety/formuły), backend `kpiComputeService.ts` (komunikat błędu) |
| 7 | Modele — lista (`?tab=models`) | zrzut, kolor pikselowy | **BLOKER**: przycisk „Utwórz model finansowy” + ikona w pustym stanie używają DOKŁADNIE zakazanego koloru crimson `#85182F` (zmierzone pikselowo: RGB 133,24,47) dla zwykłego, niekrytycznego CTA — złamanie reguły #1 CLAUDE.md wprost | `07-modele-lista.png` | **BLOKER** | `src/components/Economics/FinanceHub.tsx:3988` (ikona `bg-crimson-500/10`), `:4005` (przycisk `bg-crimson-600`) |
| 8 | Modele — formularz „+ Nowy model” → Anuluj | przepływ klikany | OK — formularz ładny, PL, sensowne domyślne wartości („Ostatnie zatwierdzone (domyślne)” = CD PROJEKT FY2024 wstępnie wybrany), przycisk „Utwórz” neutralny (nie crimson), „Anuluj” zamyka czysto, zero błędów konsoli | `10-nowy-model-formularz.png`, `10b-nowy-model-anuluj.png` | — | — |
| 9 | Predykcja — lista (`?tab=prediction`) | zrzut, DOM | OK — pusty, uczciwy stan („Brak danych do predykcji. Najpierw utwórz model.”), zero crimson, zero błędów | `08-predykcja-lista.png` | — | — |
| 10 | Wycena — lista (`?tab=valuation`) | zrzut, DOM | Pusty, uczciwy stan („Brak wycen…”), kolumna „ŹRÓDŁO” obecna (zgodnie z wymogiem CTO). **Nie zmierzone**: panel 21 narzędzi wartości (`FinanceValuePanelsSurface`) NIE renderuje się mimo `VITE_FINANCE_VALUE_PANELS=true` w lokalnym `.env.local` i w `server.env` — przyczyna nierozstrzygnięta (możliwe: flaga nie wpieczona do działającego builda vite bez restartu) | `09-wycena-lista.png` | nie zmierzone | — |
| 11 | Powrót karta→lista (pigułka „Lista”) | przepływ klikany | Działa (wraca do listy z zachowanym zaznaczeniem/preview). Kosmetyka: ślad okruszków „finance / Grupa Kapitałowa C…” zostaje widoczny nad tabelą listy zamiast się wyczyścić | `11b-powrot.png` | KOSMETYKA | — |
| 12 | Link „Powiązania → Analiza historyczna” w karcie pakietu | klik na „v.d7b0b5de” | DEFEKT: pokazuje surowy skrócony hash wersji zamiast nazwy analizy nadanej przez użytkownika (wymóg CTO §6 pkt 3); obok angielska etykieta „Manual link”; klik nie nawigował w moim teście (przeszedłem dalej przez bezpośredni URL z API) | `03e-canonical-direct.png` (crop) | WAŻNY | — |

## A31 / A49 — Baseline: brak przycisku dodawania założeń / usuwania linii

**W KODZIE przyciski JUŻ ISTNIEJĄ**: „+ Dodaj założenie” (`AssumptionsView.tsx:382,477,482`),
„Dodaj wiersz” (`:579`), „Usuń wiersz założenia” / „Usuń wiersz” (`:595,627,945`) —
`git log` pokazuje commity `1881fe937c feat(finance baseline 176): dodawanie i usuwanie wierszy
założeń` i `06ac86aadf fix(finance baseline 185): usuwanie założenia bez przewijania (kebab)`,
oba już w tej gałęzi.

**Ale ekran jest DZIŚ NIEOSIĄGALNY z prawdziwymi danymi**: `GET /api/v8/finance-v2/artifacts
?artifactType=BASELINE_MODEL` dla tej organizacji → `{"artifacts":[],"count":0}`. Zgodne z audytem
F0 z 05.09: `CreateModelModal.handleCreate` nigdy nie woła `configureBaselineWorkspaceContext`,
więc każda próba utworzenia modelu bazowego kończy się `409 BASELINE_CONTEXT_NOT_CONFIGURED`.

**NIE zreprodukowałem 409 dziś na żywo** — zadanie każe zatrzymać się na „formularz → Anuluj”, nie
submitować. Werdykt: teza A31/A49 („dalej nie mam przycisku”) jest DZIŚ czysto NIEWERYFIKOWALNA na
ekranie doprowadzonym do końca, bo do tego ekranu nie da się dojść z realnym modelem — ale kod na
literalną treść uwagi („brak przycisku”) już odpowiedział. Do jutra: NIE POKAZYWAĆ Baseline na
żywo — ryzyko 409 jest udokumentowane i niezweryfikowane jako naprawione.

## A32 — Wycena: przyciski jako słowa, nie okrągłe

**W KODZIE wygląda na naprawione**: `git log` → `a170817fb1 Finanse: rzad krokow to pigulki
kanonu Menu 2, nie gole slowa — uwaga wlasciciela z odbioru 30.08` i `11e5e36359 fix(finance):
round icon button for valuation header primary action (plan 05.09 poz. 7 / A32)`. Nawigacja kroków
używa współdzielonych klas `MENU_2_TAB_ACTIVE`/`MENU_2_TAB_INACTIVE`
(`src/components/Finance/shared/FinanceWorkspaceBar.tsx:671`, komponent `ViewTab`), czyli tych
samych pigułek co kanon Menu 2 w hubach.

**NIE zweryfikowałem na żywo** — zero rekordów wyceny w tej organizacji („Brak wycen”), a
utworzenie nowej wykracza poza wymagany zakres zadania (formularz→Anuluj, nie pełny submit).
Werdykt: kod wskazuje na naprawę z cytowanym numerem A32, ale brak świeżego zrzutu na oczy.

## Sprawdzone i ODRZUCONE jako fałszywy alarm

- Liczby 4-cyfrowe (1000-9999) bez spacji tysięcznej w tabeli sprawozdania (np. „1665”, „8740”
  zamiast „1 665”, „8 740”) — **zweryfikowane w Node**: `(8740).toLocaleString('pl-PL')` →
  `"8740"` (bez separatora), `(15175).toLocaleString('pl-PL')` → `"15 175"` (z separatorem). To
  jest udokumentowane zachowanie silnika ICU dla locale `pl-PL` (grupowanie od 5 cyfr), NIE błąd
  aplikacji (`formatFinanceValueForDisplay`, `src/services/api/financeV2.types.ts:104-116`, używa
  domyślnie `n.toLocaleString('pl-PL')`). Nie zgłaszam jako defekt.

## Nie zmierzone (wprost)

- Tryb ciemny — nie sprawdzony (budżet czasu poszedł w szerokość pokrycia + głębię przepływu
  CD PROJEKT, który jest sednem jutrzejszego pokazu).
- Przyczyna niewyrenderowania panelu 21 narzędzi wartości mimo flagi ON (poz. 10).
- A31/A32 na żywo z prawdziwym rekordem (patrz sekcje wyżej — świadomie niewykonane, bo wymagałoby
  pełnego submitu formularza wbrew instrukcji zadania, i ryzykowałoby kolejny rekord-widmo).
- Sporadyczny biały ekran Predykcji (~6%, znany z odbioru CTO 05.09) — nie próbowałem odtworzyć,
  jedno uruchomienie nie daje statystyki.
- Kanban, kebab wiersza w szczegółach, prawy panel Teresa jako zakładka w artefakcie — moduł
  Finanse na poziomie listy nie ma trwałego prawego panelu (`aside` liczba = 0, zgodne z limitem
  ≤1), więc „Teresa jako zakładka” z kanonu SPEC-A nie została odnaleziona na żadnym z testowanych
  ekranów listy; karty (poz. 3,4,6) mają panel „Powiązane artefakty” zamiast pełnego accordionu
  SPEC-A (Właściwości/Rodowód/Źródła/Komentarze/Historia/Teresa) — nie weryfikowałem czy to
  świadoma uproszczona wersja czy luka.

## Werdykt

**NIE** dla pokazania jutro GŁĘBOKIEGO przepływu CD PROJEKT (lista → Otwórz → tabela → analiza)
w obecnym stanie — kliknięcie „Otwórz” prowadzi dziś do PUSTEGO ekranu (defekt #3, BLOKER), a
nawet po obejściu tego przez przygotowany z góry link bezpośredni, sama tabela pokazuje surowe
kody SCREAMING_CASE zamiast pozycji sprawozdania (defekt #4) i karta analizy jest usiana
angielszczyzną, wewnętrznymi komentarzami z kodu i surowym kodem błędu z UUID (defekt #6) —
dokładnie to, czego zakazuje CLAUDE.md („zero angielskich etykiet”, „uczciwe stany”).

**Co MOŻNA bezpiecznie pokazać jutro:**
- Ekran 1 — lista Sprawozdań (`01-sprawozdania-lista.png`) — wygląda dobrze, jeden rekord CD
  PROJEKT, chipy, status. Bezpieczne, JEŚLI nikt nie kliknie w wiersz i nie doklika do „Otwórz”.
- Puste stany Predykcji i Wyceny (uczciwe, czyste) — ALE NIE stan Modeli, dopóki nie usunie się
  crimson z przycisku (5-minutowa poprawka: zmienić `bg-crimson-*` na neutralny token, defekt #7).
- Formularz „+ Nowy model” (bez submitu) jako demonstracja UX tworzenia.

**Warunek na „TAK Z ZASTRZEŻENIAMI” zamiast „NIE”:** naprawić dziś defekt #3 (most legacy→kanoniczny
dla tego jednego pakietu — ręczny INSERT do `finance_artifact_aliases` łączący
`cdp2025-pack-33d3c3b64a` z artefaktem `921a3360-…`/`4db71c39-…` może wystarczyć jako obejście na
jutro, bez zmiany kodu) I zamienić kody SCREAMING_CASE na etykiety PL w co najmniej tabeli
sprawozdania (defekt #4) — bez tego druga połowa obietnicy („pełna tabela RZiS/Bilans/CF czytelna
dla CFO”) nie jest spełniona nawet po naprawieniu routingu.

## Liczby

| Waga | Liczba |
|---|---|
| BLOKER | 5 (routing „Otwórz”→pusty pakiet; SCREAMING_CASE w tabeli sprawozdania + tytuł techniczny; analiza EN+wyciek kodu/ADR+surowy błąd UUID; crimson na CTA Modeli) |
| WAŻNY | 5 (APPROVED surowy w preview; angielskie zdanie „Stan pakietu”; lista Analiza pusta mimo istniejącej analizy; hash zamiast nazwy analizy + „Manual link”; duplikat nagłówka „TYP”) |
| KOSMETYKA | 2 (ślad okruszków po powrocie do listy; nadmierna precyzja „-234,897 dni”) |
