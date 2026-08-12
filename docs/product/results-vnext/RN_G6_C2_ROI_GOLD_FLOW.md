# RN-G6-C2 — złota ścieżka ROI, real app + real dane

**HEAD końcowy:** `b0ae9f81615d7e41ad17e43d18d6418a4279e5a0` (branch `rn-g6-roi-v2`, worktree
`/Users/piotrwisniewski/rn-g2-lanes/g6-roi`). Sześć commitów tej sesji, w kolejności:

```
94edc02d58 fix(results-vnext): wire ROI start-modeling/ready-for-review transitions
443e6e346b fix(results-vnext): wire ROI submit-for-approval transition
e338ba24c1 fix(results-vnext): wire ROI start-tracking/benefits-realization/pir-due transitions
b6e3ba7fa9 fix(results-vnext): preserve URL flag query string on ROI full-tool navigation
df1fd87ea8 fix(results-vnext): require analysisStart/analysisEnd on ROI case create
b0ae9f8161 fix(results-vnext): wire real approval snapshots into ROI variance form
```

`git status --short` na koniec sesji: dwa nowe skrypty dowodowe (dozwolone,
`scripts/rn-g6-roi-*`) i katalog zrzutów — nic więcej niezacommitowanego:

```
?? docs/qa/screens/rn-g6-roi/
?? scripts/rn-g6-roi-golden-flow-tail.mjs
?? scripts/rn-g6-roi-golden-flow.mjs
```

---

## Środowisko — realna zmiana wobec runbooka

`RN_G6_RUNTIME_ENVIRONMENT.md` zakłada porty 3097/3197 jako wspólne dla
wszystkich torów RN-G6. Na starcie tej sesji na tych portach już chodził
**żywy `testdrive` dla właściciela** — worktree `g6-runtime`, branch
`rn-g6-testdrive`, dokument `RN_G6_TESTDRIVE_DLA_PIOTRA.md` z dosłowną
instrukcją logowania dla Piotra. Zgodnie z zasadami bezpieczeństwa (nigdy nie
przerywać sesji właściciela) **nie zabito tych procesów**. Zamiast tego:

- Postgres (PID `38806`, port `55821`) — **ten sam, nietknięty przez całą
  sesję**, tylko dodano NOWĄ, osobną bazę `rn_g6_roi` na tym samym klastrze
  (`createdb`), żeby żadna operacja seed/migracja nie dotknęła danych
  testdrive'u.
- Backend tej sesji: port **`3098`** (nie `3097`), `DATABASE_URL` →
  `rn_g6_roi`, uruchomiony z worktree `g6-roi` na SHA tej sesji.
- Frontend tej sesji: port **`3198`** (nie `3197`), `VITE_API_TARGET` →
  `http://127.0.0.1:3098`.
- Migracje: `migrate.postgres.ts` na świeżej bazie — 487 plików, zero błędów.
- Baza zasiana istniejącym `scripts/rn-g6-seed-runtime-dataset.ts` (już
  obecny w tym worktree z wcześniejszej integracji) — org `rn-g6-org-przemysl`,
  użytkownicy `rn-g6-user-a-owner`/`rn-g6-user-a-admin`, hasło
  `RnG6Runtime!2026`.

Backend/frontend tej sesji zatrzymane precyzyjnymi PID-ami na końcu (patrz
§"Sprzątanie"). Postgres PID `38806` — **nigdy nie dotknięty**.

---

## 24 kroki — tabela

Dowód pochodzi z **jednego czystego przebiegu Playwright od kroku 1 do 18**
(`scripts/rn-g6-roi-golden-flow.mjs`, przebieg zapisany jako "run14", sprawa
`2b4e94f0-6bef-4ab9-ac63-cb89afe7f8f8`, inicjatywa `rn-g6-init-a10`) —
**zero błędów konsoli/API poza jednym przedistniejącym, niezwiązanym
`GET /api/v8/admin/flags → 404`** na każdym kroku. Kroki 20-24 dowiedzione
osobnym, celowo **świeżym** przebiegiem (`rn-g6-roi-golden-flow-tail.mjs`,
"tail1") na TEJ SAMEJ sprawie — świeża sesja przeglądarki ominęła realny,
opisany w Znaleziskach modal-cascade artefakt harnessu (nie produktu).
Krok 19 zatrzymał złoty przebieg na **prawdziwej regule biznesowej**, nie
błędzie — opisane osobno.

Ekrany: `docs/qa/screens/rn-g6-roi/*.png` (nazwy plików podane w tabeli).

| # | Krok | Wykonany? | Co zobaczyłem | Realny ID | Błędy konsoli | ≥400 |
|---|---|---|---|---|---|---|
| 1 | Wejście do rejestru `/results/roi` | TAK | `01-registry-entry-owner.png` — realny `StandardTable`, sprawy org A | — | 1 (przedistniejący) | 1 |
| 2 | Wybór inicjatywy | TAK | `02-create-modal-initiative-selected.png` — modal "Nowa sprawa ROI", dropdown z realnymi inicjatywami org A | `rn-g6-init-a10` | 0 | 0 |
| 3 | Utworzenie sprawy ROI | TAK | `03-case-created-draft.png` — `POST /cases` → 201, realny Draft | **`2b4e94f0-6bef-4ab9-ac63-cb89afe7f8f8`** | 0 | 0 |
| 4 | Baseline | TAK | `04-baseline-saved.png` — PUT baseline (wartość, jednostka, okres, metoda BAU, źródło, pewność) | — | 0 | 0 |
| 5 | Polityka obliczeń | TAK | `05-calc-policy-saved.png` — PUT policy (stopa dyskonta 8%, inflacja 3.5%, wymagane metryki) | — | 0 | 0 |
| 6 | Założenia | TAK | `06-assumption-saved.png` — POST assumption (12000 faktur/mies., pesymistyczna/optymistyczna) | — | 0 | 0 |
| 7 | Linie kosztów | TAK | `07-cost-line-saved.png` — POST cost line 850 000 PLN, one-time | — | 0 | 0 |
| 8 | Linie korzyści | TAK | `08-benefit-line-saved.png` — POST benefit line 420 000 PLN/rok, recurring | — | 0 | 0 |
| 9 | Powiązanie dowodu KPI | TAK | `09-kpi-evidence-linked.png` — POST evidence link do realnego KPI-A-002 | KPI `4d5db4f3-…` | 0 | 0 |
| 10 | Scenariusze | TAK | `10-scenario-saved.png` — POST scenariusz "Scenariusz konserwatywny" | — | 0 | 0 |
| 11 | Przebieg obliczeń | TAK | `11-calculation-run-triggered.png` — start-modeling (draft→modeling, **naprawiony brak wpięcia**) + POST calculation-run | run `97e352da-…`, **NPV 289 364,17 PLN, IRR 2,71%** | 0 | 0 |
| 12 | Zgłoszenie do zatwierdzenia | TAK | `12-submitted-for-approval.png` — ready-for-review + submit-for-approval (**oba naprawione brak wpięcia**) | status `submitted_for_approval` | 0 | 0 |
| 13 | Przegląd | TAK | `13-admin-review-decision-phase.png` — DRUGI aktor (`rn-g6-user-a-admin`) otwiera sprawę, zakładka Decision | — | 1 (przedistniejący) | 1 |
| 14 | Niezmienna migawka zatwierdzenia | TAK | `14-approval-snapshot.png` — approve (403 self-approval NIE testowany osobno tu, ale wymuszony przez różnych aktorów: submitted_by≠approved_by) | snapshot `02472347-…`, **content_hash `e854fc7f…fed83`** | 0 | 0 |
| 15 | Wersja prognozy | TAK | `15-forecast-version-published.png` — start-tracking (approved→tracking, **naprawiony**) + publish forecast | forecast `61f17d60-…`, NPV 289 364,17 (identyczne z calc run) | 0 | 0 |
| 16 | Wartość rzeczywista | TAK | `16-actual-entry-recorded.png` — POST actual entry (benefit, 31 000 PLN, styczeń 2027) | entry `44d04a56-…` | 0 | 0 |
| 17 | Weryfikacja, korekta, spór | TAK | `17-verify-correct-dispute.png` — verify (przez OWNER, inny aktor niż recorder), correct (nowa kwota 31 500), record+dispute drugiego wpisu | entries `e627a037-…`(verified) / `503decfb-…`(correction) / `2243dfe8-…`(disputed) | 1 (przedistniejący) | 1 |
| 18 | Odchylenie i przyczyna | TAK | `18-variance-and-cause.png` — variance approved_vs_forecast/npv z REALNYMI referencjami do migawki i prognozy (**naprawiony brak wpięcia pickera**) + cause 60% "Wolniejsze wdrożenie" | variance `86c29c6d-…`, cause `fe3a8a84-…` | 0 | 0 |
| 19 | Uzgodnienie z Finansami | **CZĘŚCIOWO** | `19-step.png` — próba utworzenia Finance link → **409, realna reguła biznesowa** (patrz Znaleziska F-DECISION-D4) | — | 0 nowych (1 oczekiwany 409) | 1 |
| 20 | Realizacja korzyści po zakończeniu | TAK (tail) | `20-benefits-realization-tail.png` — start-benefits-realization (tracking→benefits_realization) + widok single-row | status `benefits_realization` | 0 nowych | 0 nowych |
| 21 | Przegląd poinwestycyjny | TAK (tail) | `21-pir-draft-tail.png` — mark-pir-due, schedule (1× 409 nieprzeanalizowany do końca, patrz Znaleziska), start-pir, edit draft (outcome/lessons/recommendation) | PIR `64b376bd-…` | 1 nieoczekiwany (409, patrz Znaleziska) | 1 |
| 22 | Zamknięcie | **ZABLOKOWANE, realna reguła** | `22-case-closed-tail.png` — 403: "actor who started the review may not also close the case (maker-checker)" | status pozostał `post_investment_review` | 0 nowych | 1 (oczekiwana odmowa) |
| 23 | Historia | TAK (honest gap) | `23-history-tail.png` — **brak dedykowanej zakładki "Historia"** w ROI (w przeciwieństwie do KPI) — najbliższy uczciwy odpowiednik: Decision→Approval snapshots + Build Case→Calculation runs | — | 0 | 0 |
| 24a | F5 na ekranie sprawy | TAK | `24a-f5-reload.png` (run14) i `24a-f5-reload-tail.png` (tail) — pełny reload, dane sprawy wracają | — | 1 (przedistniejący) | 1 |
| 24b | Zimny deep link, świeża sesja | TAK | `24b-cold-deeplink-post-login.png` — `/results/roi/cases/:id?ff_resultsVNextRoi=1` bez logowania → redirect `/login?redirect=…` z **zachowaną flagą w query**, po loginie powrót na dokładny deep link | pre-login/post-login URL zapisane w `full-report.json` | 3 (2× 401 pre-auth Teresa voice-config + 1× przedistniejący 404) | 3 |

**Kroki 1-18: JEDEN ciągły, czysty przebieg, jedna sprawa.** Kroki 20-24:
osobny, świeży przebieg na tej samej sprawie (status w tym momencie już
`tracking` z kroku 15/18) — metodologicznie uczciwe, bo krok 19 zatrzymał
oryginalny przebieg na realnej regule biznesowej, nie na moim błędzie.

---

## Cztery punkty "ponad kroki"

### 1. Brak wartości NIE staje się zerem
`roiCaseFullToolPresenters.tsx`: `HonestValueCell` + `deriveRunOrForecastNpv`/
`deriveRunOrForecastIrr` + `calcRunNpvReason`/`calcRunIrrReason` renderują
`—` z powodem ("not_calculable"/error), nigdy `0`, gdy wartość nieobliczalna
— zweryfikowane czytaniem kodu (nie zgadywane) i pośrednio przez seed:
case `4d60dfce-…` (org A, poza tą sprawą) ma `status='failed'` i literalnie
`'not_calculable'` w mapperze (`roiCaseFullToolMappers.ts`). Benefit line
`isFinancial:false` w tym samym pliku prezenterów też honestly renderuje
`—`, nie `0` (`RoiBenefitLineFormModal.tsx`: `amount: isFinancial && amount
!== '' ? Number(amount) : null`).

### 2. Zatwierdzone / Prognoza / Wartość rzeczywista — rozdzielone
Trzy osobne tabele, trzy osobne realne ID w tej samej sprawie:
- `rvn_roi_approval_snapshots.snapshot_id = 02472347-89f3-49ad-b2b6-c5129eb8a618`
- `rvn_roi_forecast_versions.forecast_version_id = 61f17d60-9854-4b56-94ff-73b0fe9b5356`
- `rvn_roi_actual_entries` — 5 realnych wierszy, żaden nie nadpisuje
  poprzedniego (korekta = NOWY wiersz z `correction_of_actual_entry_id`,
  nie UPDATE istniejącego).

NPV migawki zatwierdzenia i wersji prognozy są tu przypadkowo identyczne
(289 364,17 PLN) — to NIE dowód nierozdzielenia, tylko konsekwencja
publikacji prognozy zaraz po zatwierdzeniu bez żadnej zmiany modelu
ekonomicznego między nimi (baseline/założenia zamrożone od `approved`).
Rozdzielenie dowodzi struktura (3 osobne tabele, 3 osobne ID, osobne
`created_at`), nie wartość liczbowa.

### 3. Migawka zatwierdzenia jest niezmienna
`content_hash` migawki `02472347-…` odczytany bezpośrednio po zatwierdzeniu
(krok 14) i ponownie **po wszystkich kolejnych operacjach** (start-tracking,
publikacja prognozy, 5 wpisów wykonania z weryfikacją/korektą/sporem,
wariancja, start-benefits-realization, PIR schedule/start/draft) —
**identyczny bit-po-bicie**:
```
e854fc7f1349373d23e3f620dc99d972eda2dc916b685b3dff2a466af66fed83
```
Dwa niezależne `psql` w różnych momentach sesji, ta sama wartość.

### 4. Uzgodnienie z Finansami NIE tworzy drugiego źródła prawdy ROI
Nie zweryfikowane pozytywnie (patrz krok 19 — link Finance zablokowany
regułą biznesową, zero linków utworzonych: `select count(*) from
rvn_roi_finance_links where case_id=… ` → **0**). Kod źródłowy
(`roiFinanceLinkCommands.ts` header) deklaruje explicite "NO existence
validation against any Finance table" i "AC-02: zero overwrite in either
direction" jako projekt — ale to twierdzenie dokumentacji, nie coś co ta
sesja zdołała zaobserwować na żywych danych, bo warstwa zapisu okazała się
niedostępna z tego stanu sprawy. Uczciwie: **niedowiedzione empirycznie w
tej sesji**, tylko czytaniem kodu.

---

## Znaleziska

### F1 (naprawione) — `start-modeling`/`ready-for-review` bez wpięcia frontendowego
`POST /cases/:id/transitions/start-modeling` i `.../ready-for-review`
istniały server-side (`roi.routes.ts` L715-716, `roiCaseCommands.ts`
`startModeling`/`markReadyForReview`, z testami) — **zero callerów w
`src/`**. Efekt: świeżo utworzona sprawa ROI była trwale uwięziona w
`draft`, bez żadnej ścieżki UI do `modeling` — a `RUNNABLE_STATUSES` dla
przebiegu kalkulacji to tylko `['modeling','ready_for_review']`. Naprawione:
`roiApi.ts` (`startModelingRoiCase`/`markRoiCaseReadyForReview`),
`roiRegistryMappers.ts` (`ROI_TRANSITIONS` + `RoiTransitionId`),
`roiRegistryPresenters.tsx` (kolejność kebaba), `ResultsRoiHub.tsx`
(dispatch). Commit `94edc02d58`.

### F2 (naprawione) — `submit-for-approval` bez wpięcia
Ta sama kategoria luki, osobny endpoint (`roi.routes.ts` L1858,
hand-rolled nie przez `mountTransitionRoute`, ten sam kształt body/response).
Bez niego sprawa w `ready_for_review` nigdy nie osiąga
`submitted_for_approval` → approve/reject/request-changes nigdy nie da się
przetestować przez UI mimo że same są w pełni wpięte. Commit `443e6e346b`.

### F3 (naprawione) — `start-tracking`/`start-benefits-realization`/`mark-pir-due` bez wpięcia
Trzy kolejne endpointy (`roiTrackingCommands.ts`,
`roiBenefitsRealizationCommands.ts`, `roiPirCommands.ts`), wszystkie przez
`mountTransitionRoute`, wszystkie bez callera. Bez nich zaakceptowana
sprawa nigdy nie osiąga `tracking` → cała faza Realize Value + Learn była
nieosiągalna przez UI, mimo że KAŻDY formularz w tych fazach był w pełni
zaimplementowany i czekał na sprawę we właściwym statusie. Commit
`e338ba24c1`.

**Razem F1+F2+F3 = sześć brakujących ogniw łańcucha stanów, wszystkie w tym
samym miejscu (istniejący, przetestowany endpoint server-side + zero
frontendowego wywołania).** Wzorzec zidentyczny z KPI F1B
(`RN_G6_P0D_WRITE_PATH_FIX.md`) — potwierdza, że to systemowy wzorzec tej
fali programu (P0-D naprawił jeden przypadek, ten pakiet znalazł sześć
kolejnych w innej domenie tego samego programu).

### F4 (naprawione) — nawigacja "Otwórz pełne narzędzie" gubi flagę URL
`ResultsRoiHub.tsx`'s `onModel: (r) => navigate(path)` (bez `search`) —
sesja z flagą WYŁĄCZNIE w URL (nie w localStorage/env) trafiała na "ROI
tool — not yet enabled" natychmiast po utworzeniu sprawy — twardy ślepy
zaułek. Ten sam problem w drugą stronę w `RoiCaseToolPage.tsx`'s
`goToRegistry`. Naprawione oba miejsca (`navigate({pathname, search})`).
Ten sam, udokumentowany-ale-nienaprawiony problem istnieje dla KPI
(`RN_G6_TESTDRIVE_DLA_PIOTRA.md` punkt 5) — nienaprawiony tu, bo poza
allowlistą tego pakietu. Commit `b6e3ba7fa9`.

### F5 (naprawione) — `analysisStart`/`analysisEnd` fałszywie opcjonalne, sprawa bez ratunku
Formularz tworzenia sprawy traktował te dwa pola jako opcjonalne, ale
`roiCalculationRunCommands.ts` bezwarunkowo odrzuca przebieg kalkulacji bez
obu — **i żaden formularz edycji w całym narzędziu nie potrafi ich
ustawić po utworzeniu**. Gorzej: sprawa uwięziona w `draft`/`modeling` nie
ma też ścieżki `cancel` (guard `ROI_TRACKING_ACTIVE_STATUSES` obejmuje
tylko `tracking`/`benefits_realization`/PIR-due/PIR) — **całkowity ślepy
zaułek bez odzysku przez UI**. Sprawa `4d60dfc?-…` na inicjatywie
`rn-g6-init-a6` (pierwsza próba tej sesji, PRZED naprawą) jest udokumentowaną
ofiarą — celowo NIE naprawiona ręcznie SQL-em (zadanie zabrania obchodzenia
defektów), pozostawiona jako żywy dowód. Naprawione promowaniem obu pól do
wymaganych, ten sam wzorzec "touched reveals message" co initiative/title.
Commit `df1fd87ea8`.

**Osobno zanotowane, NIE naprawione:** `archiveRoiCase` (server, ANY status,
idempotentny) istnieje i wygląda jak zamierzona ścieżka odzysku dla
porzuconej wczesnej sprawy — **też zero frontendowego callera**. Nie
naprawione w tym pakiecie (osobny wątek pracy, większy zakres niż "jedna
brakująca akcja").

### F6 (naprawione) — `approvalSnapshots={[]}` hardcoded w formularzu wariancji
`RoiCaseRealizeValueWorkspace.tsx` przekazywał do `RoiVarianceFormModal`
pustą tablicę zamiast realnych migawek — `comparisonType:
"approved_vs_forecast"`/`"approved_vs_actual"` **nigdy nie dawały się
zapisać przez UI** (409 "requires both a approved reference and a forecast
reference"), bo picker zawsze pokazywał tylko "—". Naprawione dociągnięciem
`listRoiApprovalSnapshots` (ten sam endpoint co zakładka Decision już
używa), leniwie przy wejściu na zakładkę Variances. Zweryfikowane
end-to-end: wariancja `86c29c6d-…` ma teraz REALNE
`reference_approval_snapshot_id`/`reference_forecast_version_id`. Commit
`b0ae9f8161`.

### F7 (znalezisko, NIE naprawione — zbyt konsekwentna decyzja projektowa) — Finance links zablokowane przez cały cykl życia po zatwierdzeniu
`createRoiFinanceLink`/reconciliation dzielą TEN SAM guard
`NON_EDITABLE_STATUSES` co baseline/założenia/koszty/korzyści
(`roiFinanceLinkCommands.ts` header: "Both commands are gated by the SAME
NON_EDITABLE_STATUSES guard every other economic-model-adjacent command
file... reuses RoiEconomicModelNotEditableError"). `NON_EDITABLE_STATUSES`
= `submitted_for_approval, approved, rejected, tracking,
benefits_realization, post_investment_review_due, post_investment_review,
closed` — czyli **dosłownie cały cykl życia sprawy od momentu zgłoszenia do
akceptacji aż do zamknięcia**. Efekt zaobserwowany na żywo: próba utworzenia
powiązania Finance na sprawie w `tracking` (dokładnie ta faza, w której
istnieją realne wykonania do uzgodnienia) → 409 "the economic model may not
be edited from this status". Skutek praktyczny: **uzgodnienie z Finansami
da się wykonać wyłącznie ZANIM sprawa ma jakiekolwiek dane do uzgodnienia**
(przed zatwierdzeniem, gdy nie ma jeszcze wykonań ani śledzenia). To wygląda
na nieprzemyślaną konsekwencję skopiowania gotowego wzorca guard (design
"Decision D4"), nie świadomą decyzję biznesową — ale to osąd, nie fakt;
**zgłaszam, nie naprawiam**, bo cofnięcie udokumentowanej "Decision D4"
wymaga decyzji właściciela produktu, nie jednostronnej zmiany reguły przez
wykonawcę.

### F8 (znalezisko, POZYTYWNE — działający kontrol) — maker-checker także na Verify i Close-po-PIR
Dwa kolejne, nieudokumentowane wcześniej w tym programie potwierdzenia
segregacji obowiązków, oba zaobserwowane jako realne odmowy 403/przez
serwer, nie zgadywane:
- `verifyRoiActualEntry`: ten sam aktor, który zarejestrował wpis wykonania,
  nie może go zweryfikować — "they are the chain's original recorder".
- `closeRoiCase` po PIR: aktor, który rozpoczął przegląd poinwestycyjny, nie
  może zamknąć tej samej sprawy — "the actor who started the review may not
  also close the case (maker-checker)".
Oba zweryfikowane empirycznie (403 z dosłownym komunikatem), nie tylko
przeczytane w kodzie. **To dobra wiadomość o produkcie**, nie defekt —
odnotowuję, bo dowodzi, że segregacja obowiązków działa szerzej niż tylko
przy `approve`.

### F9 (znalezisko, nierozstrzygnięte do końca) — 409 na `PUT .../post-investment-review-schedule`
Podczas przebiegu "tail" krok 21 zgłosił jeden nieoczekiwany 409 na
harmonogramowaniu PIR, mimo że transakcja `mark-pir-due` tuż wcześniej
zwróciła sukces. Przebieg **kontynuował mimo to** (skrypt nie sprawdza
odpowiedzi tego konkretnego wywołania) i kolejne kroki (`start-pir`, edycja
szkicu) zakończyły się sukcesem z realnym PIR-em w bazie — więc albo (a)
harmonogramowanie nie jest wymagane na ścieżce do sukcesu i błąd jest
nieszkodliwy, albo (b) coś w sekwencji statusów jest subtelnie inne niż
zakładałem. **Nie doprowadzone do jednoznacznej diagnozy w tej sesji** —
zgłaszam dosłowny fakt (409, kontynuacja mimo to, końcowy sukces), nie
domyślam się przyczyny.

---

## Readback z bazy (kluczowe momenty)

```
-- Sprawa (stan końcowy)
select case_id, status, row_version from rvn_roi_cases
  where case_id = '2b4e94f0-6bef-4ab9-ac63-cb89afe7f8f8';
→ status='post_investment_review', row_version=10

-- Trzy rozdzielone źródła (patrz punkt "ponad kroki" #2)
snapshot_id = 02472347-89f3-49ad-b2b6-c5129eb8a618  (approved)
forecast_version_id = 61f17d60-9854-4b56-94ff-73b0fe9b5356  (forecast)
5× actual_entry_id (actual, w tym 1 korekta jako NOWY wiersz)

-- content_hash, dwa niezależne odczyty w różnych momentach sesji — IDENTYCZNE
e854fc7f1349373d23e3f620dc99d972eda2dc916b685b3dff2a466af66fed83

-- Wariancja z realnymi referencjami (dowód naprawy F6)
variance_id=86c29c6d-1ad2-4892-9b44-727dd13e403a
  comparison_type=approved_vs_forecast, metric=npv
  reference_approval_snapshot_id=02472347-89f3-49ad-b2b6-c5129eb8a618  ← REALNY
  reference_forecast_version_id=61f17d60-9854-4b56-94ff-73b0fe9b5356  ← REALNY

-- Finance links — zero, zgodnie z F7 (zablokowane regułą)
select count(*) from rvn_roi_finance_links
  where case_id='2b4e94f0-…' → 0

-- PIR
pir_id=64b376bd-205a-40a8-aeaa-2e8275d5b4b1, status=draft,
  outcome=benefits_fully_realized, started_by=rn-g6-user-a-admin,
  lessons_learned=(realny tekst polski wypełniony przez formularz)
```

---

## Krok 24 osobno

- **F5 (reload):** wykonany DWUKROTNIE — raz na ekranie sprawy w trakcie
  (`24a-f5-reload.png`, run14) i raz na ekranie zamkniętej/PIR sprawy
  (`24a-f5-reload-tail.png`, tail). Oba razy: pełny reload, dane sprawy
  (tytuł, status, zakładki) wracają poprawnie, jeden przedistniejący błąd
  konsoli (`/api/v8/admin/flags`), zero innych.
- **Zimny deep link, świeża sesja:** `/results/roi/cases/:id?ff_resultsVNextRoi=1`
  otwarty w CAŁKOWICIE nowym kontekście przeglądarki (`newActorContext(browser,
  null)` — bez tokenu, bez `localStorage`). Zaobserwowane:
  1. Redirect na `/login?redirect=%2Fresults%2Froi%2Fcases%2F…%3Fff_resultsVNextRoi%3D1`
     — **flaga zachowana w query redirectu**.
  2. Po realnym loginie (email+hasło wpisane przez skrypt, nie token
     wstrzyknięty): powrót DOKŁADNIE na wyjściowy deep link, z flagą.
  3. Trzy błędy konsoli — dwa 401 na `/api/v10/teresa/voice-config` (wołane
     przed pełnym uwierzytelnieniem, przedistniejące i niezwiązane z ROI) i
     jeden przedistniejący 404 `/api/v8/admin/flags`.
  To dowodzi, że mechanizm deep-linku z zachowaniem flagi **działa poprawnie
  na poziomie routingu logowania** — w odróżnieniu od F4 (nawigacja
  WEWNĄTRZ aplikacji, `navigate()` bez `search`), który jest osobnym,
  lokalnym problemem, teraz naprawionym.

---

## Bramki

- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .` (klient) —
  **exit 0**, sprawdzane po KAŻDYM z sześciu commitów, zawsze czyste.
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p server` —
  **exit 1/2** (niespójne między przebiegami tego samego środowiska —
  nieistotne, liczy się treść): **zawsze dokładnie 18 błędów, zawsze
  wszystkie w `roiCalculationEngine.ts`**, **zero błędów poza tym plikiem**
  po każdym z sześciu commitów (`grep -v roiCalculationEngine | grep -c
  "error TS"` = 0 za każdym razem).
- `npx vite build` — **exit 0**, jedyne ostrzeżenia to przedistniejące
  "chunk larger than 500kB".
- `git diff --check` — **exit 0** za każdym razem, zero błędów białych
  znaków.
- Hooki pre-commit (`check-list-canon`, `check-artefakt`, `check-triada`,
  `check-gestosc`, `check-focus-canon`) — **zielone, zero nowych naruszeń**
  na wszystkich sześciu commitach (baseline niezmieniony: list-canon 0/0,
  artefakt 7/7, focus-canon 130 plików/261 wystąpień bez wzrostu).

---

## Czego to NIE dowodzi

- **Nie jest to odbiór wg 40-punktowej listy czekowania TRIADA/SPEC-A**
  (menu/kebab/preview/kanban/dark+light) — poza zakresem tego zadania
  (dowód przepływu funkcjonalnego, nie odbiór wizualny).
- **Krok 19 (uzgodnienie z Finansami) nie został empirycznie potwierdzony
  jako działający** — zablokowany realną regułą biznesową (F7), zgłoszony,
  nie obejście.
- **Krok 22 (zamknięcie) nie zakończył się faktycznym `status='closed'`**
  w tej sesji — zablokowany realnym maker-checker (F8), wymaga TRZECIEGO
  aktora (różnego od tego, kto uruchomił PIR), którego ta sesja nie
  zaangażowała.
- **Punkt "ponad kroki" #4** (uzgodnienie Finance nie tworzy drugiego
  źródła prawdy) potwierdzony WYŁĄCZNIE czytaniem kodu, nie żywym zapisem —
  patrz wyżej.
- **Nie testowano uprawnień poza `OPEN_ORG`** (SCOPE/MANAGEMENT_CHAIN/
  PRIVATE/RESTRICTED_ACL) — cały seed ma `visibility_mode='OPEN_ORG'`.
- **Nie testowano wydajności ani wielu równoczesnych użytkowników.**
- **Silnik kalkulacji ROI (`roiCalculationEngine.ts`)** ma 18
  przedistniejących błędów tsc (potwierdzone jako niezmienione, nie
  naprawione — poza zakresem tego zadania).
- Kroki 1-18 mają JEDEN czysty przebieg jako dowód (nie wielokrotnie
  powtórzony) — pierwsze cztery próby tej sesji (na inicjatywach a6/a7/a8/a9)
  ujawniły realne defekty/błędy skryptu opisane w Znaleziskach, ostatecznie
  naprawione; piąta próba (a10, run14) jest tym czystym przebiegiem.

---

## Czy ruszono coś poza allowlistą

**Nie.** Wszystkie zmienione pliki produkcyjne:
- `src/components/ResultsVNext/roi/roiApi.ts`
- `src/components/ResultsVNext/roi/roiRegistryMappers.ts`
- `src/components/ResultsVNext/roi/roiRegistryPresenters.tsx`
- `src/components/ResultsVNext/roi/ResultsRoiHub.tsx`
- `src/components/ResultsVNext/roi/RoiCaseToolPage.tsx`
- `src/components/ResultsVNext/roi/RoiCaseCreateModal.tsx`
- `src/components/ResultsVNext/roi/RoiCaseRealizeValueWorkspace.tsx`

Wszystkie wewnątrz `src/components/ResultsVNext/roi/**`. Nowe pliki:
`scripts/rn-g6-roi-golden-flow.mjs`, `scripts/rn-g6-roi-golden-flow-tail.mjs`
(dozwolone: `scripts/rn-g6-roi-*`), ten raport (dozwolony: explicite
wymieniony w zadaniu). Pięć zakazanych plików równoległej sesji
(`PostgresDatabase.ts`, trzy `*.realdb.test.ts`,
`20260810_fix_initiatives_status_default.sql`) — nietknięte. `okr/**`,
`kpiScorecards/**`, `ResultsKpiRegistryPage.tsx` — nietknięte.
`src/components/standard/**`, `shared/**` — nietknięte.
`.claude/launch.json` — nietknięty. Zero push/merge/deploy/podagentów.
Postgres PID `38806` — nietknięty przez całą sesję.

Dane demonstracyjne dodane do izolowanej bazy `rn_g6_roi` (nie demo/prod):
pięć inicjatyw-klonów (`rn-g6-init-a6`…`a10`, po jednej na próbę tej sesji,
via `SELECT *`/`UPDATE`/`INSERT` na kopii istniejącego wiersza — nie ręczny
zapis stanu ROI ominięciem API) i jedna nowa baza (`createdb`). Żadna
operacja na `rvn_roi_*` nie ominęła warstwy API — wszystkie stany sprawy w
tabeli wyżej powstały przez realne kliknięcia przez realny UI.
