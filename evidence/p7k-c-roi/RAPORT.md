# P7K część C — ROI: tabela analiz + karta N w trzech częściach

Gałąź: `wyniki/p7k-c-roi` (baza `origin/staging` @ `59e282df88`)
Data: 2026-09-05, wieczór · wykonawca: agent ROI

---

## 1. Co zostało zbudowane

**Poziom 1 — `/results/roi`** (`ResultsRoiHub` + `card/roiCardRegistryPresenters.tsx`)
Tabela analiz w `StandardTable` z kolumnami z werdyktu K4, w tej kolejności:
NAZWA · PRZEDMIOT · WARIANT · CAPEX · ROCZNA KORZYŚĆ · ROI (zawsze z horyzontem,
„ROI 5Y 100 %") · PAYBACK · REKOMENDACJA (pigułka **neutralna**, bez kropki) ·
FAZA. **NPV i IRR są w pstryczku kolumn i domyślnie schowane** (`defaultVisible: false`).
Podgląd wiersza = Executive Summary jako tabela Właściwość/Wartość + „Otwórz analizę".
Dwuklik wiersza otwiera kartę.

**Poziom 2 — `/results/roi/:roiCaseId`** (`card/RoiCaseCardPage.tsx`)
Karta N na `NModeShell` + `ArtifactRightPanel` (ten sam wybór powłoki i to samo
uzasadnienie, co `KpiToolPage`: rejestr kart N jest zamknięty dla Platformy).
Lewa nawigacja: **Założenia · Wyliczenia · Realizacja**. Karta otwiera się na
najdalszej wypełnionej części.

- **Założenia** — sześć uporządkowanych bloków, nie jeden akapit: przedmiot/cel/
  wariant bazowy BAU/horyzont/punkt odniesienia; nakłady (CAPEX z rezerwą jako
  osobną pozycją + suma + ΔNWC z jawnym oznaczeniem „z założeń"); przyrostowy
  OPEX; korzyści per klasa Hard/Avoided/Soft/Strategic z łańcuchem KPI → pieniądze,
  z osobną tabelą korzyści świadomie NIEmonetyzowanych; założenia z wychyleniami,
  pewnością i źródłem; ryzyka z prawdopodobieństwem, skutkiem i mitygacją.
- **Wyliczenia** — dziesięć kafli (CAPEX · Roczna korzyść netto · ROI nY · Payback ·
  Discounted Payback · NPV ze stopą · IRR · PI · BCR · ARR), cash flow rok 0–n
  z kolumnami zdyskontowanymi, scenariusze Conservative/Upside, wrażliwość ±20 %
  na sterownikach modelu, rekomendacja z warunkiem.
- **Realizacja** — Expected/Actual/Wariancja (kolor semantyczny tylko przy
  wariancji NIEKORZYSTNEJ), prawdziwość założeń per założenie
  (Potwierdzone/Częściowo/Obalone + opis), ROI/NPV/Payback po realizacji, wnioski.

Prawy panel: Akcje · **Teresa** · Właściwości · Powiązania · Źródła i założenia ·
Komentarze · Historia — jeden `<aside>`, kolejność kanoniczna.

## 2. Migracje (addytywne, `20260906_rvn_roi_card_three_parts.sql`)

Zero DROP, zero ALTER istniejącej kolumny, wszystkie nowe pola NULLABLE.
- `rvn_roi_cases`: `subject_type`, `option_variant` (0–3), `option_variant_label`,
  `investment_recommendation` (go/conditional_go/no_go), `recommendation_condition`,
  `problem_statement`, `scope_summary`, `bau_option_label`.
- `rvn_roi_benefit_lines`: `benefit_class` (hard/avoided/soft/strategic), `kpi_chain_note`.
- `rvn_roi_post_investment_reviews`: `milestone_months` (3/6/12), `realized_roi_pct`,
  `realized_npv`, `realized_payback_periods`.
- Nowe tabele: `rvn_roi_assumption_outcomes` (prawdziwość założeń),
  `rvn_roi_risks` (rejestr ryzyk z mitygacjami).

Migracja przeszła na bazie **zbudowanej od zera** (pełny łańcuch migracji na
jednorazowym PG 17), nie tylko przyrostowo na istniejącej.

## 3. Testy i dowody mutacyjne

| Zestaw | Wynik | Dowód mutacyjny (wykonany, nie opisany) |
| --- | --- | --- |
| `server/.../card/__tests__/roiCardMetrics.test.ts` | 24/24 | zahardkodowanie stopy 8 % zamiast parametru → **2 testy padają**; payback ignorujący nakład → **4 testy padają** |
| `tests/integration/roiCaseCard.pg.test.ts` (realny PG) | 7/7 | usunięcie bramki dyskontowania → **pada test polityki „bez NPV"**; usunięcie `INNER JOIN rvn_visible_resources` → **pada test izolacji najemcy** |
| `src/.../card/__tests__/roiCard.test.tsx` | 15/15 | odsłonięcie NPV/IRR → **pada test K4**; zdjęcie `c-danger` z wariancji → **pada test koloru** |

Przeliczenia sprawdzone na przykładach z metodyki i z danych, które seed
naprawdę zapisał: ROI 5Y 100 %, Payback 2,5 roku, NPV 516 315 zł przy 10 %,
PI 1,52, BCR 2,00, DPP > PP. **IRR sprawdzone definicyjnie**: NPV przy stopie
równej IRR wynosi zero.

## 4. Bramki

- `npx tsc --build` (serwer): **exit 0**.
- `npx esbuild` per zmieniony plik front/dev-render: **exit 0**.
- `scripts/check-list-canon.sh`: **0 nowych naruszeń** (tabele TREŚCI w karcie
  oznaczone `§27-exempt` — kanon list rządzi ekranami listowymi, a wiersz kosztu
  w artefakcie nie ma podglądu, kebaba ani filtrów).
- `scripts/check-artefakt.sh`, `check-triada.sh`, `check-gestosc.sh`,
  `check-focus-canon.sh`, `check-flags-env-static.mjs`: **dług nie rośnie**.
- Pełne `tsc` frontu **nie przechodzi w tym repo** (OOM przy ~4 GB — ograniczenie
  repozytorium, nie tej zmiany; CLAUDE.md tego zresztą zabrania robotnikom).
  Zamiast tego: esbuild per plik + `tsc` na zawężonym projekcie (zero błędów
  w plikach ROI).

## 5. Zrzuty (`evidence/p7k-c-roi/`)

Harness `dev-render/screens/p7k-c-roi.tsx` montuje **PRODUKCYJNE** komponenty
(`ResultsRoiRegistryPage`, `RoiCaseCardPage`) z podstawionym `window.fetch`,
na danych **1:1 z seeda DBR77**.

| Plik | Widok | Progi |
| --- | --- | --- |
| `roi-l1--light.png` / `--dark.png` | tabela analiz, 1440 | 9 kolumn bez ucięcia, zero „…", „—" dla braków |
| `roi-l2-zalozenia--light.png` | karta, część Założenia | `aside` = 1, zero „…", zero UUID |
| `roi-l2-wyliczenia--light.png` | karta, część Wyliczenia | jw. |
| `roi-l2-realizacja--light.png` / `--dark.png` | karta, część Realizacja | jw. |

Mechanicznie zmierzone na żywym DOM: `bledyKonsoli` = 0, `dom.aside.count` = 1,
liczba „…" = 0, UUID w treści = brak, właściciel jako **nazwisko** („Tomasz Nowak").
Para jasny/ciemny NIE jest duplikatem: mean_luma 247,8 vs 20,6 (L1) i 246,7 vs
28,0 (L2) — różnica > 200.

**Zrzuty na żywo z realnym backendem NIE zostały wykonane** i to jest świadome:
plik sesji `/private/tmp/odbior-auth/auth.json` jest z 18:51, czyli starszy niż
próg 21:00 z instrukcji, a staging i tak nie ma jeszcze tej migracji ani nowych
tras — zrzut „na żywo" pokazywałby stary ekran i byłby dowodem niczego.
Dowodem działania na realnych danych jest zamiast tego test `.pg` (§3), który
czyta te same wiersze przez PRODUKCYJNE repozytorium.

## 6. Poprawki, których nie było w zleceniu (zgłoszone, nie ukryte)

1. **Seed opisywał inny rachunek, niż zapisał.** Polityka wyliczeń wpisywała 8 %
   wszystkim analizom, a zapisane NPV 516 315 zł odtwarza się wyłącznie przy
   10 %. Stopa jest teraz per analiza; test pilnuje odtwarzalności.
2. **IRR 28,7 i DPP 3,1 w seedzie były nieodtwarzalne** z własnych wejść analizy
   (prawdziwe: 28,65 i 3,02). Poprawione.
3. **`useOrganizationMemberNames` zwraca resolver, nie obiekt** — destrukturyzacja
   `{ members }` dawała `undefined` i każde nazwisko schodziło na „Nieznany
   użytkownik". Złapane na zrzucie, nie w typach.
4. **„2 roku" zamiast „2 lata"** — ta sama klasa błędu co osławione „8dni".
   `fmtYears` odmienia teraz poprawnie (1 rok · 2/3/4 lata · 5+ lat · ułamki
   „2,5 roku"), z niełamliwą spacją; test na to jest.

## 7. Czego NIE zrobiono (uczciwie)

- **Scenariusze Conservative/Upside nie mają liczb** — bo w bazie nie ma dla nich
  przebiegów kalkulacji. Karta pisze „—" i mówi dlaczego, zamiast przepisać
  liczby wariantu bazowego. Silnik obsługuje scenariusze przez „mirror-matching"
  kwoty pozycji do wartości założenia, a dane DBR77 takiego dopasowania nie mają
  — policzenie ich teraz dałoby trzy identyczne kolumny, czyli kłamstwo
  o odporności modelu.
- **Scoring wielokryterialny (metodyka §35)** — nie zbudowany. Wymaga kontraktu
  wag (NPV 25 %, IRR 15 %…), którego nie ma ani w schemacie, ani w prototypie.
- **Break-even i Margin of Safety (metodyka §26-27)** — nie ma ich w kaflach;
  wymagają wskazania „kluczowej zmiennej", której model nie zna.
- **Karta jest READ-ONLY.** Wprowadzanie pozycji, uruchamianie przeliczeń,
  wykonania i przegląd PIR robi się dalej w `RoiCaseFullTool`
  (`/results/roi/cases/:roiCaseId`), do którego prowadzi przycisk w prawym panelu.
  Nie skasowano żadnej zdolności.
- **Zakładka Teresa jest sekcją akordeonu, nie zakładką na górze panelu.**
  `ArtifactRightPanel` nie ma API zakładek, a dołożenie własnego paska dałoby
  drugi punkt orientacyjny (i `aside` = 2). Treścią sekcji jest kanoniczny
  `TeresaEntryButton` otwierający JEDNO główne okno Teresy — zgodnie z decyzją
  właściciela z 01.09, przy zachowaniu obecności Teresy z werdyktu K8.
- **Faza analizy „System wizyjny" wychodzi Wyliczenia, a nie Założenia** jak na
  zrzucie prototypu. Faza jest wyprowadzona z FAKTÓW (jest zakończony przebieg
  kalkulacji), zgodnie z regułą „najdalsza wypełniona część". Prototyp był tu
  wewnętrznie niespójny (ta sama analiza miała przebieg i fazę „Założenia").
- **„Search" w Menu 2 Wyników jest po angielsku** — to `resultsDomainNavigation`,
  powłoka Wyników, poza tą paczką. Zgłoszone, nie naprawione.
