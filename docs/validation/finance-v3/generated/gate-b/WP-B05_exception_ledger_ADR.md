# ADR WP-B05 — Exception / Reconciliation Ledger dla Finance v3

**Status:** `PROPOSED` (Gate B, do akceptu zespołu wg DEC-FIN-012)
**Data:** 2026-08-09
**Work package:** WP-B05, `FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md` Gate B
**Owner:** Architecture/Data
**Wejście:** `docs/validation/finance-v3/generated/gate-b/GATE_B_INTEGRATION_RECONCILIATION.md` (nazewnictwo kanoniczne); `docs/validation/finance-v3/generated/gate-b/WP-B01_artifact_schema_ADR.md` (DDL `finance_artifacts`/`finance_business_versions`/`finance_working_revisions`/`finance_engine_manifests`); `docs/validation/finance-v3/generated/gate-b/WP-B02_lifecycle_concurrency_ADR.md` §5, §7 (maker-checker, SoD, `artifact_lifecycle_events`, gate approve); `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` DEC-FIN-009 (tolerancje/wyjątki), §2.6 (reconciliation ledger), §3.10 (Exception inbox), §7 B02-Q4 (materiality placeholder); `docs/validation/finance-v3/generated/gate-a/WP-A01_inventory_manifest.md` + grep realnego kodu.
**Zakaz respektowany:** ten dokument NIE łączy się z żadną bazą, NIE tworzy plików w `server/migrations/`, NIE uruchamia migracji. DDL w Załączniku A jest szkicem projektowym dla WP-C01, nie migracją do wykonania.

---

## 0. Co dziś istnieje (dowód kodem, nie audytem)

Grep `server/src/services/finance*` (zakaz połączenia z bazą respektowany — wyłącznie statyka) potwierdza: **nie istnieje dziś żaden exception/reconciliation ledger** w sensie wymaganym przez DEC-FIN-009. Istnieje `reconciliationService.ts` (801 linii, „F6 / R1-R8", **SHADOW MODE**):

- Liczy 8 checków (`R1`…`R8`) czysto w pamięci (`pure, side-effect-free`), z 2 severity (`error`/`warning`) i 4 statusami (`pass`/`warning`/`fail`/`skipped`) — **nie** 5-poziomową skalą `Info/Warning/Material/CriticalData/Security` z DEC-FIN-009.
- Wynik jest **nadpisywany** co recompute — persystowany jako `financial_statement_validations` z `check_code='RECONCILE_SUMMARY'`, czytany przez `financeReportSectionService.ts` (`loadReconcileSummaryForPack`). To jest **ostatni stan**, nie append-only historia zdarzeń — dwa kolejne recompute nie zostawiają śladu, że coś się zmieniło.
- `RECONCILE_ENFORCE` (env var, domyślnie `false`) — `shouldBlockReady()` **zawsze zwraca `false`** dopóki flaga nie jest ustawiona; komentarz w kodzie (L57-60) wprost ostrzega, że enforce przed kalibracją znaku (`§5 spec`) może zamienić zdrowy pakiet w fałszywy `fail` i zablokować readiness — więc dziś **nic nie blokuje niczego**, nawet R1 (bilans A=L+E).
- **Brak** kolumn: `owner`, `accepted_by`, `expiry`, `evidence`, `severity` w 5-poziomowej skali, `source_ref` jako strukturalne odniesienie do linii/okresu/entity. Brak jakiegokolwiek mechanizmu waiver.
- **Brak twardej blokady** dla Security/matematycznie nieokreślonej operacji na poziomie API — dzisiejszy mechanizm jest wyłącznie obserwacyjny.

`financeAnomalyDetectorService.ts` (342 linie) i `financeDiagnosticsService.ts` to osobne, także observational silniki — żaden nie zapisuje zdarzeń z `owner`/`accepted_by`/`expiry`.

**Wniosek:** WP-B05 nie ma z czym integrować się wstecz w sensie „rozszerz istniejącą tabelę" — `finance_exceptions` jest nową tabelą. `reconciliationService.ts` (R1-R8) pozostaje silnikiem WYKRYWAJĄCYM (produkuje `ReconcileCheck[]`); ten ADR projektuje, gdzie te wykrycia (i wykrycia innych silników — anomaly detector, shadow-parity NPV/IRR/ROI z `ORCH-DEC-002`, import validation) **lądują jako trwałe zdarzenia**, z governance workflow wokół nich. WP-C02 (compatibility services) jest miejscem, gdzie `reconciliationService.reconcileStatements()` dostaje adapter zapisujący `ReconcileCheck` → `finance_exceptions RAISED` zamiast (albo obok, w oknie przejściowym) dzisiejszego nadpisywanego `RECONCILE_SUMMARY`.

---

## 1. Decyzja — kształt ogólny

Dwie nowe, addytywne tabele: `finance_exceptions` (append-only log zdarzeń wyjątku) i `finance_reconciliation_runs` (append-only log przebiegów rekoncyliacji źródło→kanon). Obie prefiksowane `finance_`, zgodnie z konwencją WP-B01. Żadna istniejąca tabela nie jest modyfikowana przez ten ADR — poza jedną **wymaganą addytywną kolumną** na `finance_business_versions` (§4), zgłoszoną tu jako rozszerzenie do uwzględnienia w tym samym DDL co pozostałe brakujące kolumny z `GATE_B_INTEGRATION_RECONCILIATION.md` §2.

### 1.1 `finance_exceptions` jest append-only **zdarzeniem**, nie mutowalnym rekordem stanu

Zakres zadania mówi to wprost, i jest to spójne z architekturą całego Gate B: `finance_business_versions` chroni immutability triggerem (WP-B01 §2.4), `finance_lineage_edges` „nigdy nie są usuwane ani edytowane" (WP-B03 §7.1), `artifact_lifecycle_events` jest audit logiem (WP-B02 §5.1 krok d). Powielenie tego samego wzorca dla wyjątków — zamiast jednego mutowalnego wiersza nadpisywanego `UPDATE .. SET accepted_by=..., status='accepted'` — eliminuje dokładnie tę klasę błędu, którą Gate A znalazł w `financial_models` (reopen-in-place, WP-A01 §2 pkt 1): nikt nigdy nie traci dowodu, że wyjątek **kiedyś był** `OPEN` zanim ktoś go zaakceptował.

**Mechanika:** jeden `id` (PK) per zdarzenie. Logiczny wyjątek — od momentu wykrycia (`RAISED`) przez cały cykl życia — jest identyfikowany stabilnym `exception_group_id` (na wierszu `RAISED` równym własnemu `id`; każdy kolejny wiersz w tym samym łańcuchu — `ACCEPTED`/`WAIVED`/`RESOLVED`/`ESCALATED`/`REOPENED`/`EXPIRED` — niesie ten sam `exception_group_id`). Bieżący stan logicznego wyjątku = **ostatni wiersz danego `exception_group_id` po `created_at`**, wyprowadzany przez widok `finance_exceptions_current` (ten sam wzorzec co „status źródła liczony na żywo, nie zapisany na krawędzi" z WP-B03 §7.2), nie przez mutację. Trigger `BEFORE UPDATE OR DELETE ON finance_exceptions` odrzuca **każdą** próbę (surowszy niż trigger na `finance_business_versions`, który dopuszcza wąską mutację meta-kolumn — tu nie ma wyjątku, bo cała semantyka „zmiana stanu" jest przez `INSERT`).

### 1.2 Kolumny ponad literalną listę z briefu — i dlaczego

Zakres zadania wylicza: `id, organization_id, artifact_id, business_version_id, source_ref, severity, expected/observed/delta/unit, owner, reason, accepted_by, expiry, evidence, created_at`. Dodaję pięć kolumn, każda z konkretnym uzasadnieniem (transparentnie, wzorem WP-B01 §2 "kolumny ponad DDL"):

| Kolumna | Uzasadnienie |
|---|---|
| `exception_group_id` | Bez niej append-only log nie ma pojęcia „ten sam logiczny wyjątek w czasie" — wymagane przez §1.1. |
| `event_type` | Rozróżnia `RAISED/ACCEPTED/WAIVED/RESOLVED/ESCALATED/REOPENED/EXPIRED` — bez tego „append-only events" nie da się odróżnić od „jeden wiersz per wyjątek z polami nadpisywanymi", co zabrania brief. |
| `working_revision_id` | Detekcja (R1-R8, anomaly detector) najczęściej działa na `working_revision` PRZED promocją do `business_version` (Draft, w trakcie edycji) — `business_version_id` bywa jeszcze `NULL`. Bez tego pola każdy wyjątek wykryty podczas pracy nad Draftem byłby nie do przypięcia do niczego. Nullable FK do `finance_working_revisions`. |
| `reason_code` | Maszynowo klasyfikowalna przyczyna (`ROUNDING`, `MISSING_SOURCE`, `DUPLICATE_ROW`, `RECLASS`, `ELIMINATION`, `SIGN_CONVENTION`, `LEGACY_SHADOW_PARITY_DRIFT`, …) — wymagane przez zakres 5 („deduplicated root causes" w Exception Inbox); `reason` samo jest wolnym tekstem, nie da się po nim grupować deterministycznie. |
| `dedup_key` | Hash `(artifact_id, reason_code, source_ref core fields)` liczony przy `RAISED` — pozwala Exception Inbox pokazać JEDEN wiersz z licznikiem wystąpień zamiast zalewu identycznego wyjątku po każdym recompute (dokładnie problem, który dałby dzisiejszy `reconciliationService` gdyby zaczął pisać zamiast nadpisywać). |

### 1.3 `severity` — dokładnie 5 poziomów DEC-FIN-009, nic więcej

```sql
severity TEXT NOT NULL CHECK (severity IN ('INFO','WARNING','MATERIAL','CRITICAL_DATA','SECURITY'))
```

„Security/UndefinedMath" z zakresu zadania to **jedna** severity (`SECURITY`) w DEC-FIN-009 dosłownie: *„`Security/tenant breach` lub matematycznie nieokreślona operacja — twarda blokada"* — jeden poziom, dwie przyczyny. Modeluję to jako sub-klasyfikację, nie osobną severity (żeby nie rozjeżdżać się z literą DEC-FIN-009):

```sql
blocking_category TEXT CHECK (blocking_category IN ('TENANT_BREACH','UNDEFINED_MATH'))
  -- NOT NULL wymagane WYŁĄCZNIE gdy severity='SECURITY' (CHECK złożony, patrz Załącznik A)
```

---

## 2. Reguły per severity

| Severity | Kto może `ACCEPTED`/`WAIVED` | Wymaga `reason` | Wymaga drugiej osoby (maker-checker) | Wpływ na `finance_business_versions.result_quality` (§4) | Blokuje compute/approve/export? |
|---|---|---|---|---|---|
| `Info` | nikt — auto-log, `event_type='RAISED'` jest stanem końcowym, nie wymaga akcji | nie | nie | brak wpływu | nie |
| `Warning` | `preparer`/`reviewer`/`approver`/`finance_admin` (dowolna z 5 ról WP-B02 §7.1); **self-accept dozwolony** — DEC-FIN-009 mówi „akceptacja analityka", nie maker-checker | tak, przy `ACCEPTED` | nie | brak wpływu na `result_quality`, ale nierozwiązany `Warning` jest widoczny w Exception Inbox i w review checklist (Addendum §5.3) | nie blokuje transakcji `approve` (WP-B02 §5.1 literalnie wymienia tylko Security/CriticalData); **blokuje** domknięcie kroku „complete review" w workflow reviewera (§2.1 niżej) dopóki nie ma `ACCEPTED`/`WAIVED` |
| `Material` | `ACCEPTED`/`WAIVED` wymaga **dwóch** ludzi: `raised_by`/`owner` proponuje z impact assessment (`evidence` musi zawierać wyliczony wpływ liczbowy), `accepted_by` ∈ `{approver, finance_admin}` i **musi być inną osobą** niż `raised_by`/`owner` (reużycie wzorca SoD z WP-B02 §7.2 pkt 6, `403 SELF_APPROVAL_FORBIDDEN` analog) | tak | **tak** | brak wpływu na `result_quality` (nie wymusza Provisional — tylko `Critical data` to robi) | jak `Warning`: nie blokuje `approve` transakcji (WP-B02 §5.1), blokuje „complete review" jeśli `OPEN` bez `ACCEPTED` |
| `Critical data` | jak `Material` (maker-checker), ale `accepted_by` **musi** być `approver`/`finance_admin` — `preparer`/`reviewer` nie mogą akceptować | tak | tak | **wymusza `Provisional`** w momencie gdy wiersz jest `OPEN` (nawet przed `ACCEPTED`) — patrz §4 | **nie** blokuje compute/export (DEC-FIN-009 dosłownie: „compute/export dozwolone") — blokuje wyłącznie w tym sensie, że artefakt zatwierdzony z `OPEN` Critical data exception jest trwale oznaczony `Provisional`, niezależnie od późniejszej akceptacji |
| `Security` (`TENANT_BREACH`/`UNDEFINED_MATH`) | **nikt na poziomie organizacji.** Nie da się `WAIVED` przez `finance_admin` organizacji — wymaga operatora platformy (reużycie precedensu WP-B02 §7.2 pkt 7 / GATE_B §6 B02-Q5: „operator platformy, nie `finance_admin` organizacji (SoD)") | tak (obowiązkowy pełny opis root cause przy `RESOLVED`) | tak, plus dodatkowy podpis operatora platformy poza standardowym modelem ról Finance | wymusza `Provisional`/blokuje pełne `APPROVED` (patrz §4 — w praktyce nigdy nie dojdzie do `APPROVED`, bo blokada jest wcześniejsza) | **twarda blokada na poziomie API** — §3 |

### 2.1 Gdzie dokładnie żyje „blokuje complete review"

WP-B02 nie projektuje osobnego endpointu „reviewer completes review" (jego zakres to `T1..T9` state machine artefaktu, nie checklist recenzenta wewnątrz `IN_REVIEW`). Addendum §5.3 („Review package: checklist, open comments, evidence, exceptions i overrides; approval blokowane do resolution/authorized waiver") wymaga takiego gate'u na poziomie **review checklist**, nie na poziomie triggera bazy. WP-B05 definiuje kontrakt: endpoint recenzji (Gate C/D, poza zakresem tego ADR) MUSI przed oznaczeniem `review_checklist_complete=true` sprawdzić:

```sql
SELECT COUNT(*) FROM finance_exceptions_current
WHERE business_version_id = :bv_id
  AND severity IN ('WARNING','MATERIAL','CRITICAL_DATA')
  AND state = 'OPEN';
-- > 0 → 422 REVIEW_BLOCKED_BY_OPEN_EXCEPTIONS (kod w stylu WP-B02 §5.1)
```

To jest odrębna bramka od `approve` (WP-B02 §5.1 krok a), która nadal sprawdza WYŁĄCZNIE Security (twarda blokada) i CriticalData (nie blokuje, taguje Provisional) — nie duplikuję ani nie zmieniam tamtej walidacji.

---

## 3. Twarda blokada Security/UndefinedMath — na poziomie API, nie tylko UI

DEC-FIN-009: „Security/tenant breach lub matematycznie nieokreślona operacja — twarda blokada." Realizacja:

1. **Middleware-level gate**, nie warunek w handlerze pojedynczego endpointu (żeby nie dało się ominąć przez nowy endpoint, który zapomni sprawdzić) — analogicznie do `demoWriteProtection` w `Gateway.ts:431-447` (istniejący, żywy wzorzec bramkowania na poziomie Gateway, potwierdzony w WP-A01 §2 jako realnie wpięty).
2. Gate sprawdza `EXISTS (SELECT 1 FROM finance_exceptions_current WHERE severity='SECURITY' AND state='OPEN' AND (artifact_id = :artifact_id OR organization_id = :org_id AND blocking_category='TENANT_BREACH'))` — `TENANT_BREACH` sprawdzany na poziomie organizacji (bo naruszenie granicy tenanta może dotyczyć więcej niż jednego artefaktu), `UNDEFINED_MATH` na poziomie `artifact_id`/`business_version_id` (błąd jest lokalny do konkretnego obliczenia).
3. Endpointy objęte blokadą: `POST .../compute` (WP-B04 §9.1), `POST .../submit-for-review`, `POST .../approve` (WP-B02 §5), `POST .../export` (Addendum §4.11 export contract). Odpowiedź: **`423 SECURITY_EXCEPTION_BLOCK`** (423 Locked — zasób zablokowany do czasu rozwiązania warunku, semantycznie trafniejsze niż `409`, który B02 już zarezerwował dla version-conflict) z ciałem wskazującym `exception_id` i `blocking_category`, żeby UI mógł pokazać dokładny powód, nie generyczny „coś poszło nie tak".
4. **UI jest wtórne**: przycisk „Compute"/„Approve"/„Export" jest disabled jako UX, ale to middleware odrzuca request nawet gdyby ktoś ominął UI (curl, race z dwóch tabów, zewnętrzna integracja) — to jest dosłownie różnica między „blokada w UI" a „blokada na poziomie API" z zakresu zadania.
5. **Kto może to rozwiązać** — wyłącznie `RESOLVED` (root cause naprawiony, zweryfikowany), nigdy `WAIVED` przez rolę organizacyjną (§2). `finance_exceptions_current` przestaje zwracać `OPEN` dopiero po wierszu `RESOLVED` podpisanym przez operatora platformy — dokładnie ten sam mechanizm co `EMERGENCY_APPROVAL` (WP-B02 §7.2 pkt 7) już wymaga wpisu do tego ledgera jako `Material exception`.

---

## 4. `finance_business_versions.result_quality` — jak dokładnie CriticalData wymusza Provisional

Zadanie pyta wprost: nowa kolumna czy wyliczane z obecności otwartego CriticalData exception? **Decyzja: nowa kolumna, zamrażana raz w momencie `approve`, nie przeliczana dynamicznie.**

### 4.1 Uzasadnienie wyboru „nowa kolumna, nie derived"

`finance_business_versions` jest immutable po `APPROVED` (trigger WP-B01 §2.4 — po zatwierdzeniu wolno zmienić wyłącznie `status`/`superseded_by_version_id`/`invalidated_reason`/`updated_at`). Gdyby `result_quality` był wyliczany na żywo z `EXISTS (OPEN CriticalData exception)`, to **późniejsze** `WAIVED`/`RESOLVED` tego wyjątku (albo odwrotnie: nowy CriticalData wyjątek podniesiony przeciw JUŻ zatwierdzonej wersji z jakiegoś retroaktywnego audytu) zmieniałoby to, co widać jako „w jakim stanie TO ZOSTAŁO ZATWIERDZONE" — łamiąc dokładnie tę immutability, którą trigger ma chronić. Historia musi pokazywać: „ta wersja została zatwierdzona jako Provisional, bo w chwili zatwierdzenia istniał otwarty Critical data exception" jako fakt zamrożony, niezależnie od tego, co się z tym wyjątkiem stanie później (wyjątek sam zachowuje swoją własną historię w `finance_exceptions` — to nie jest sprzeczne, to dwa różne fakty: „stan wyjątku dziś" vs „stan artefaktu w momencie zatwierdzenia").

### 4.2 Mechanika

Rozszerzenie `finance_business_versions` (addytywna kolumna, do dopisania do tabeli brakujących kolumn w `GATE_B_INTEGRATION_RECONCILIATION.md` §2 przy Gate C DDL):

```sql
result_quality TEXT CHECK (result_quality IN ('CLEAN','CONDITIONAL','PROVISIONAL'))
  -- NULL dopóki wersja nie osiągnęła APPROVED (nie ma znaczenia dla DRAFT/IN_REVIEW —
  -- tam „jakość" jest widoczna na żywo przez finance_exceptions_current, nie zamrożona)
```

Ustawiana **w tym samym `UPDATE`, który wykonuje krok (c) transakcji `approve`** (WP-B02 §5.1) — czyli w momencie `OLD.status='IN_REVIEW' → NEW.status='APPROVED'`, PRZED zamrożeniem (trigger nie ogranicza tej zmiany, bo restrykcja triggera dotyczy wyłącznie `OLD.status='APPROVED'`, nie przejścia DO `APPROVED`). Wyliczenie, wykonane w kroku (a) tej samej transakcji (walidacja), zamrażane w (c):

```sql
result_quality =
  CASE
    WHEN EXISTS (SELECT 1 FROM finance_exceptions_current
                 WHERE business_version_id = :bv_id AND severity = 'CRITICAL_DATA' AND state = 'OPEN')
      THEN 'PROVISIONAL'
    WHEN EXISTS (SELECT 1 FROM finance_exceptions_current
                 WHERE business_version_id = :bv_id AND severity IN ('WARNING','MATERIAL') AND state != 'RESOLVED')
      THEN 'CONDITIONAL'
    ELSE 'CLEAN'
  END
```

(`SECURITY` nie występuje w tej formule — obecność `OPEN` Security exception już zablokowała `approve` w kroku (a), więc transakcja nigdy nie dochodzi do (c) — patrz §3.)

To odpowiada dosłownie DEC-FIN-009: *„Każdy materiał pokazuje jakość, wyjątki, wpływ, autora i approvera oraz rozróżnia clean/conditional/provisional."*

---

## 5. Reconciliation ledger — `finance_reconciliation_runs`

Waterfall z zakresu zadania (source total → mapped → excluded → unmapped → duplicate/reclass/elimination → canonical total → residual), zgodny z Addendum §2.6: *„source total → mapped → excluded/unmapped → canonical total; residual/unexplained bucket ma materiality limit i wymaga approvera."*

### 5.1 Równanie

```
source_total = mapped_total + excluded_total + unmapped_total
canonical_total = mapped_total − duplicate_total + reclass_net_total ± elimination_net_total
residual = source_total − canonical_total − excluded_total − unmapped_total
```

`residual` bliski zeru = pełna rekoncyliacja. Niezerowy residual to dokładnie to, co Addendum nazywa „unexplained bucket".

### 5.2 Tabela (append-only, jeden wiersz per przebieg)

Kluczowe pola: `id`, `organization_id`, `artifact_id` + `business_version_id` (nullable — działa też na `working_revision`), `source_system` (np. `'import:xlsx'`, `'legacy:financial_model_events'`, `'shadow_parity:analysis_financials_vs_financial_analyses'` — patrz §5.4), `source_total`, `mapped_total`, `excluded_total`, `unmapped_total`, `duplicate_total`, `reclass_net_total`, `elimination_net_total`, `canonical_total`, `residual` (generated column, żeby nie mógł się rozjechać z komponentami — patrz Załącznik A), `residual_pct`, `materiality_threshold_applied` (NUMERIC — **zamrożona wartość progu użytego w TYM przebiegu**, nie referencja na żywo do configu organizacji, bo config może się zmienić później i historyczny przebieg musi pokazywać, jaki próg faktycznie zastosowano), `status` (`CLEAN`/`WITHIN_TOLERANCE`/`EXCEEDS_MATERIALITY`), `linked_exception_id` (nullable FK do `finance_exceptions.id` — wypełniane, gdy `residual` przekracza próg i przebieg automatycznie podnosi wyjątek), `bucket_detail` (JSONB — opcjonalna lista `{legacy_table, legacy_id, bucket, amount, reason_code}` dla per-wiersz drill-down; pełna normalizacja per-wiersz to zakres Gate D, nie B05), `created_at`, `created_by` (id joba/usera, który uruchomił przebieg).

### 5.3 Materiality limit na residual — TEN SAM placeholder, nie nowy próg

Zgodnie z instrukcją zadania: **nie wymyślam nowego progu.** `materiality_threshold_applied` w każdym przebiegu jest zamrożoną kopią placeholdera z `GATE_B_INTEGRATION_RECONCILIATION.md` §7 (rozstrzygnięcie B02-Q4): **5% wartości linii/subtotala LUB konfigurowalny per-organizacja próg, cokolwiek niższe**, jawnie oznaczony `PROVISIONAL_PENDING_OWNER_DECISION`. Ten sam status dziedziczy się tutaj — `finance_reconciliation_runs.materiality_threshold_applied` nie wchodzi do żadnego GO-gate jako finalna liczba bez potwierdzenia właścicielskiego (identyczne zastrzeżenie jak w źródle).

`residual > materiality_threshold_applied` (bezwzględnie) → automatyczny `INSERT` do `finance_exceptions` (`event_type='RAISED'`, `severity` zależna od wielkości przekroczenia: do 2× progu → `MATERIAL`; powyżej 2× progu → `CRITICAL_DATA`, bo residual tej wielkości oznacza, że kanoniczna liczba może być niewiarygodna, nie tylko „wymaga komentarza") — `linked_exception_id` na wierszu `finance_reconciliation_runs` wskazuje ten wpis.

Rozróżnienie od `reconciliationService.ts` (R1-R8, dzisiejszy `ABS_FLOOR=1`): tamten mechanizm sprawdza **równania techniczne** (bilans A=L+E, roll-forward CF) i celowo używa ciasnej tolerancji zaokrągleń źródła (DEC-FIN-009: „równania techniczne używają source-rounding tolerance") — to inny, ciaśniejszy próg niż materiality placeholder tutaj. `finance_reconciliation_runs` odpowiada za **source→canonical mapping** (czy wszystko z importu/legacy trafiło gdzieś sensownie), nie za wewnętrzną spójność już-zmapowanych sprawozdań — dwa różne pytania, dwa różne progi, oba explicite z DEC-FIN-009.

### 5.4 Zastosowanie do ORCH-DEC-002 (trzy magazyny NPV/IRR/ROI)

`ORCHESTRATOR_DECISIONS_LOG.md` ORCH-DEC-002 already przypisuje temu ledgerowi konkretne zadanie: `financial_analyses` (kanoniczne źródło) vs `analysis_financials`/`initiative_financials` (legacy read-modele) mają być „rekoncyliowane przez exception ledger (WP-B05) podczas Gate C shadow-parity". Realizacja: `source_system='shadow_parity:analysis_financials_vs_financial_analyses'` (i analogicznie dla `initiative_financials`), `source_total`=wartość z legacy magazynu, `canonical_total`=wartość z `financial_analyses` dla tego samego `initiative_id`/okresu, `mapped_total`=`canonical_total` gdy istnieje jednoznaczne dopasowanie po kluczu naturalnym, `unmapped_total`=przypadki bez odpowiednika. To jest **ten sam mechanizm** co reconciliation zwykłego source→canonical, zastosowany do pary legacy-magazynów zamiast import→kanon — nie wymaga osobnej tabeli.

---

## 6. Waiver mechanism

1. **Kto może dać waiver** — patrz macierz §2 (per severity). Zasada ogólna, spójna z WP-B02 §7.1-7.2: im wyższa severity, tym węższa rola i tym silniejszy wymóg SoD (osoba akceptująca ≠ osoba zgłaszająca/właściciel). `SECURITY` nie ma waivera na poziomie organizacji w ogóle (§2, §3).
2. **`expiry`** — obowiązkowy dla `event_type='WAIVED'` przy `WARNING`/`MATERIAL`/`CRITICAL_DATA` (NULL niedozwolony — CHECK w Załączniku A). Po `expiry` widok `finance_exceptions_current` przestaje traktować logiczny wyjątek jako `WAIVED` i wraca do `OPEN` **automatycznie, przez wyliczenie w widoku** (`CASE WHEN event_type='WAIVED' AND expiry <= now() THEN 'OPEN' ELSE 'WAIVED' END`), bez potrzeby joba, który wstawia `EXPIRED` w dokładnym momencie wygaśnięcia — belt-and-suspenders: WP-B07 (observability, poza zakresem tego ADR) MOŻE dodatkowo wstawiać jawny wiersz `EXPIRED` dla alertingu/SLA, ale poprawność stanu nie zależy od tego, czy taki job w ogóle istnieje.
3. **Czy waiver przeżywa reopen/nową wersję — NIE, świadomie.** `finance_exceptions.business_version_id` przypina wyjątek do KONKRETNEJ, immutable wersji biznesowej. Reopen (WP-B02 §6.2) tworzy `vN+1` jako nowy wiersz `finance_business_versions` z copy-on-write danych wejściowych — nie kopiuje automatycznie zaakceptowanych/waived wyjątków `vN`. Jeśli ten sam warunek zostanie wykryty ponownie podczas compute `vN+1` (bo dane wejściowe się nie zmieniły), silnik detekcji podnosi **nowy** wiersz `RAISED` dla `vN+1`, z `evidence` zawierającym referencję `prior_exception_id → <exception_group_id z vN>` dla kontekstu ciągłości (Exception Inbox pokaże „ten sam warunek był już zaakceptowany na v3 przez X 2026-07-02" jako podpowiedź, nie jako automatyczne zwolnienie z ponownej akceptacji). Uzasadnienie: (a) spójność z DEC-FIN-007/DEC-FIN-010 — każda `business_version` to świadomy milestone, nic nie „dziedziczy się" cicho przez granicę wersji; (b) zamyka lukę bezpieczeństwa „zaakceptuj raz, reopen, zatwierdź bez ponownego review" — dokładnie klasa problemu, którą WP-B02 §6 naprawia dla samego statusu Approved. To jest decyzja rutynowa pod DEC-FIN-012 (kontynuacja już zdecydowanej filozofii immutable-per-version), nie nowa eskalacja.
4. **Waiver nie usuwa historii** — `WAIVED` to nowy wiersz `INSERT`, `RAISED` pozostaje widoczny na zawsze w `finance_exceptions` (append-only, §1.1). „Kto, kiedy i dlaczego zaakceptował mimo istniejącego wyjątku" jest więc zawsze rekonstruowalne — bezpośrednia odpowiedź na wymóg audytu z DEC-FIN-001/Addendum §5.

---

## 7. Query wzorce — Exception Inbox (Addendum §3.10)

Addendum §3.10 (Exception inbox, P0/P1 priorytet po zmianie w §3 „Krytyczna zmiana priorytetów"): *„tie-out fail, stale, compute failed, review assigned, blocker, benchmark expired, unusual variance i import conflict z ownerem oraz deep linkiem."* Zakres zadania mówi o `AP-08` z master planu — plik master planu nie istnieje w tym worktree (ten sam stan co odnotował WP-A01 §0: dokumenty wejściowe programu są untracked poza `origin/demo`), więc opieram query wzorce na Addendum §3.10, który jest jedynym dostępnym w tym worktree, kanonicznym opisem wymagań inboxa.

### 7.1 Deduplicated root causes

```sql
CREATE VIEW finance_exceptions_current AS
SELECT DISTINCT ON (exception_group_id)
  *,
  CASE
    WHEN event_type = 'WAIVED' AND (expiry IS NULL OR expiry > now()) THEN 'WAIVED'
    WHEN event_type IN ('ACCEPTED', 'RESOLVED') THEN event_type
    ELSE 'OPEN'   -- RAISED, ESCALATED, REOPENED, EXPIRED, lub WAIVED z wygasłym expiry
  END AS state
FROM finance_exceptions
ORDER BY exception_group_id, created_at DESC;

-- Exception Inbox: root causes zdeduplikowane po dedup_key, licznik wystąpień,
-- najstarsze pierwsze wystąpienie determinuje wiek/SLA:
SELECT
  dedup_key,
  reason_code,
  severity,
  MIN(created_at)  AS first_seen,
  MAX(created_at)  AS last_seen,
  COUNT(*)         AS occurrence_count,
  array_agg(DISTINCT artifact_id) AS affected_artifacts
FROM finance_exceptions_current
WHERE state = 'OPEN'
GROUP BY dedup_key, reason_code, severity
ORDER BY severity DESC, last_seen DESC;
```

### 7.2 Owner/SLA

`owner` (z listy pól zadania) = domyślny przypisany do rozwiązania, inicjalnie = `preparer` bieżącego `working_revision` (edytor), reassignable. SLA nie jest osobną kolumną (uniknięcie duplikacji z org-config) — wyliczana z `created_at` + domyślne okno per severity (konfigurowalne per organizacja, sane default): `Info`=brak SLA, `Warning`=30 dni, `Material`=5 dni robocze, `Critical data`=2 dni robocze, `Security`=natychmiast/godziny (operator platformy poza zwykłym SLA org). `sla_due_at` liczone w zapytaniu (`created_at + interval`), nie zamrażane na wierszu, bo org może zmienić politykę SLA i chcemy widzieć AKTUALNĄ ocenę pilności dla OTWARTYCH spraw (w przeciwieństwie do `result_quality` w §4, które musi być zamrożone, bo opisuje przeszły fakt zatwierdzenia — tu opisujemy żywy, nierozwiązany problem, więc żywa polityka jest właściwa).

### 7.3 Deep link

`(artifact_id, business_version_id, working_revision_id, source_ref)` niesie wszystko potrzebne do zbudowania deep linku wprost do komórki/linii — ten sam wzorzec co „Why this number?" (Addendum §3.9, wymóg ≤3 kliknięcia do source/formula). Przykładowy kształt URL: `/finance/artifacts/:artifactId/versions/:businessVersionId?focus=<source_ref.statement_line_code>&period=<source_ref.period_id>&entity=<source_ref.entity_id>&exception=<exception_group_id>`.

---

## 8. Struktura `source_ref`

Zaprojektowana jako JSONB (nie osobne kolumny per pole) — źródło wyjątku różni się w zależności od silnika detekcji (statement line vs shadow-parity legacy row vs valuation input), więc sztywny zestaw kolumn albo miałby dużo NULL, albo wymagał osobnej tabeli per typ silnika. Kształt:

```jsonc
{
  "statement_line_code": "TOTAL_ASSETS",   // canonical line code, z financeCanonicalRegistry — nullable
  "period_id": "2026-Q2",                   // spójne z bundle'em wartości WP-B01 §2.7
  "entity_id": "org_9:entity_main",         // spójne z bundle'em wartości WP-B01 §2.7
  "cell_ref": "BS.TOTAL_ASSETS.2026-Q2",     // złożony identyfikator do UI highlight
  "compute_run_id": "run_...",               // forward ref do WP-B04 compute_job_runs — bez FK, ten sam powód co B01 §2.2
  "legacy_table": "analysis_financials",     // wypełniane tylko dla shadow-parity/migracji (§5.4)
  "legacy_id": "af_123"
}
```

Wszystkie pola nullable — konkretny silnik detekcji wypełnia tylko te, które ma. `unit` (osobna kolumna top-level, nie w `source_ref`) mirroruje konwencję z WP-B01 §2.7 (`unit` jako pole wspólnego bundle'a wartości finansowej).

---

## 9. Rozważane alternatywy (odrzucone)

1. **Mutowalny wiersz `finance_exceptions` z `UPDATE` przy akceptacji** (zamiast append-only + `exception_group_id`). Odrzucone: dosłownie zabronione przez zakres zadania („append-only events, nie mutable state") i niespójne z resztą Gate B (WP-B01/B02/B03 wszystkie przyjmują ten wzorzec).
2. **`result_quality` jako `VIEW`/wyliczane na żywo z obecności `OPEN` CriticalData exception**, zamiast zamrożonej kolumny. Odrzucone w §4.1: łamie immutability zatwierdzonej wersji — to, co widać jako „jakość, z jaką TO zostało zatwierdzone" zmieniałoby się wraz z późniejszymi zmianami stanu wyjątku, co jest sprzeczne z sensem `APPROVED` jako niezmiennego faktu historycznego.
3. **Osobna severity dla `UNDEFINED_MATH`** (6 poziomów zamiast 5). Odrzucone: DEC-FIN-009 definiuje dokładnie 5 poziomów i literalnie grupuje Security+UndefinedMath jako jedną kategorię „twarda blokada" — dodanie 6. poziomu byłoby reinterpretacją decyzji właścicielskiej, nie jej wdrożeniem.
4. **Osobny typ `finance_value_status` (PRESENT_ZERO/…/NOT_APPLICABLE, WP-B01 §2.7) na `expected`/`observed`**. Odrzucone: `finance_exceptions` to META-rekord O wartości domenowej, nie sama komórka wartości — duplikowanie pełnego bundle'a `value_status` tutaj rozmywałoby granicę między „ledger wyjątków" a „tabela wartości Gate D". `NULL` w `expected`/`observed` rozróżniane przez `reason_code` (`MISSING_SOURCE` vs `NOT_APPLICABLE`) wystarcza dla potrzeb ledgera.
5. **Waiver przeżywający reopen automatycznie** (kopiowanie `WAIVED` na `vN+1` przy tworzeniu). Odrzucone w §6 pkt 3: tworzy furtkę „zaakceptuj raz, reopen bez ponownego review" — sprzeczne z duchem immutable-per-version całego Gate B.
6. **Pełna normalizacja `bucket_detail` w `finance_reconciliation_runs` jako osobna tabela per-wiersz** (zamiast JSONB). Odrzucone dla WP-B05: per-wiersz drill-down przez tysiące legacy rekordów to zakres implementacyjny Gate D backfillu (WP-C03), nie architektury ledgera; JSONB agregatowy wystarcza do samego kontraktu ADR — Gate D może dodać normalizowaną tabelę addytywnie bez zmiany kształtu `finance_reconciliation_runs`.

---

## 10. Konsekwencje

**Pozytywne:**
- Zamyka literalną lukę z Gate A/WP-A01: dziś zero mechanizmu z `owner`/`accepted_by`/`expiry`/`evidence` i zero twardej blokady API dla Security — ten ADR daje oba.
- `finance_reconciliation_runs` daje ORCH-DEC-002 (trzy magazyny NPV/IRR/ROI) konkretny, gotowy do implementacji mechanizm zamiast odłożonej deklaracji.
- Append-only + `exception_group_id` + `finance_exceptions_current` daje pełną historię „kto kiedy co zaakceptował" bez ryzyka cichej utraty dowodu (ta sama klasa ochrony co reszta Gate B).
- `result_quality` zamrożone przy `approve` daje Advisor/eksportowi/UI jedno pole do pokazania clean/conditional/provisional bez przeliczania przy każdym odczycie.

**Negatywne / koszty:**
- `finance_exceptions` jako append-only log rośnie szybko przy silnikach o wysokiej częstotliwości (R1-R8 przy każdym recompute) — bez dedup na etapie zapisu (nie tylko odczytu przez `dedup_key` w Exception Inbox) tabela może rosnąć bez potrzeby. Rekomendacja dla WP-C02: silnik detekcji NIE wstawia nowego `RAISED`, jeśli identyczny `dedup_key` już ma `state='OPEN'` z `finance_exceptions_current` (idempotentna detekcja) — to jest decyzja implementacyjna Gate C, nie zmiana kształtu tabeli.
- Middleware-level `SECURITY` gate (§3) to dodatkowe zapytanie na gorącej ścieżce (`compute`/`approve`/`export`) — wymaga indeksu `(organization_id, severity, state)` / `(artifact_id, severity, state)` na widoku (albo materializacji widoku, jeśli `DISTINCT ON` po całej tabeli okaże się zbyt wolne przy dużej historii — do zmierzenia w WP-C, nie zakładane tu jako pewnik).
- Dwie równoległe koncepcje "jakości" (`result_quality` zamrożone na `business_versions` vs żywy stan w `finance_exceptions_current`) wymagają jasnej dokumentacji UX, żeby użytkownik nie mylił „jak zatwierdzono" z „jak wygląda teraz" — ryzyko nieporozumienia produktowego, nie architektonicznego.

**Ryzyka:**
- `materiality_threshold_applied` dziedziczy status `PROVISIONAL_PENDING_OWNER_DECISION` z GATE_B §7 — jeśli Piotr ostatecznie wybierze zupełnie inny mechanizm (np. wyłącznie kwota bezwzględna per branża, nie %), kolumna przeżyje (to tylko `NUMERIC`), ale logika wyliczająca próg w Gate C będzie wymagała zmiany — nie jest to ryzyko tego ADR, tylko odziedziczone ryzyko nierozstrzygniętej decyzji właścicielskiej.
- Jeśli WP-C02 zdecyduje inaczej niż rekomendacja z „Konsekwencje" (dedup na zapisie), koszt operacyjny (rozmiar tabeli, retencja) trzeba będzie zaadresować w WP-B06/WP-B07 (poza zakresem tego ADR).

---

## 11. Decyzje wymagające sign-off orkiestratora/Piotra

**Brak nowej eskalacji.** Ten ADR dziedziczy, ale nie tworzy, następujące już-otwarte punkty:

1. **Dokładna liczba/wzór materiality placeholder** (`GATE_B_INTEGRATION_RECONCILIATION.md` §7, B02-Q4) — `finance_reconciliation_runs.materiality_threshold_applied` używa TEGO SAMEGO placeholdera (5%/konfigurowalny, niższe z dwóch), zgodnie z instrukcją zadania „nie wymyślaj nowego progu". Nie eskaluję ponownie — to ta sama, już zgłoszona sprawa.
2. **Los `financial_model_events`** (WP-B01 §5 pkt 1) — jeśli orkiestrator/Piotr wybierze opcję (a) (retroaktywne przepakowanie do Prediction), harmonogram tych eventów przejdzie przez dokładnie ten sam `finance_reconciliation_runs` mechanizm jako `source_system='legacy:financial_model_events'` — projekt tego ADR jest zgodny z obiema opcjami z WP-B01 §5, nie wymaga dodatkowej decyzji.
3. **Merge/deprecate/keep trzech magazynów NPV/IRR/ROI** — już rozstrzygnięte przez `ORCH-DEC-002` (rutynowe, DEC-FIN-012); WP-B05 tylko dostarcza mechanizm wykonawczy (§5.4).
4. **Zakres M16 „Value Tracking"** (`ORCH-DEC-003`, eskalowane, oczekuje potwierdzenia) — nie dotyczy WP-B05 wprost; jeśli M16 wejdzie w zakres, jego reconciliation (jeśli jakiekolwiek istnieje) korzysta z tego samego wzorca bez zmian w tym ADR.

---

## Załącznik A — DDL sketch (NIE do wykonania; materiał wejściowy dla WP-C01)

```sql
-- ============================================================
-- WP-B05 DDL SKETCH — Finance v3 exception / reconciliation ledger
-- STATUS: PROJEKT / ADR, nie migracja. Nie umieszczać w server/migrations/
-- bez przejścia przez WP-C01. Zero wykonania w ramach WP-B05.
-- ============================================================

-- --------------------------------------------------------------
-- 0. Rozszerzenie finance_business_versions (addytywne, do scalenia
-- z listą kolumn w GATE_B_INTEGRATION_RECONCILIATION.md §2 przy Gate C DDL)
-- --------------------------------------------------------------
ALTER TABLE finance_business_versions
  ADD COLUMN result_quality TEXT CHECK (result_quality IN ('CLEAN','CONDITIONAL','PROVISIONAL'));
  -- NULL dopóki status != 'APPROVED'; ustawiane raz w kroku (c) transakcji approve (WP-B02 §5.1),
  -- chronione tym samym trigger immutability co reszta wiersza po OLD.status='APPROVED'
  -- (result_quality NIE jest w liście dozwolonych do zmiany kolumn WP-B01 §2.4 —
  -- czyli po zatwierdzeniu jest równie niezmienne jak compute_snapshot_id).

-- --------------------------------------------------------------
-- 1. finance_exceptions — append-only event log
-- --------------------------------------------------------------
CREATE TABLE finance_exceptions (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  exception_group_id    TEXT NOT NULL,   -- = id na wierszu RAISED; powielone na kolejnych zdarzeniach łańcucha

  organization_id       TEXT NOT NULL REFERENCES organizations(id),
  artifact_id           TEXT NOT NULL,
  business_version_id   TEXT,             -- nullable: detekcja może zajść przed promocją do business version
  working_revision_id   TEXT REFERENCES finance_working_revisions(working_revision_id),

  event_type            TEXT NOT NULL CHECK (event_type IN (
                           'RAISED', 'ACCEPTED', 'WAIVED', 'RESOLVED',
                           'ESCALATED', 'REOPENED', 'EXPIRED'
                         )),

  severity               TEXT NOT NULL CHECK (severity IN (
                           'INFO', 'WARNING', 'MATERIAL', 'CRITICAL_DATA', 'SECURITY'
                         )),
  blocking_category       TEXT CHECK (blocking_category IN ('TENANT_BREACH', 'UNDEFINED_MATH')),

  source_ref               JSONB NOT NULL,   -- §8: statement_line_code/period_id/entity_id/cell_ref/compute_run_id/legacy_*

  expected                  NUMERIC,
  observed                   NUMERIC,
  delta                       NUMERIC,
  unit                          TEXT,

  reason_code                    TEXT,        -- machine-classifiable: ROUNDING/MISSING_SOURCE/DUPLICATE_ROW/RECLASS/...
  reason                           TEXT,       -- free text; NOT NULL enforced conditionally, patrz CHECK niżej
  dedup_key                         TEXT,      -- hash(artifact_id, reason_code, core source_ref fields), ustawiane przy RAISED

  owner                               TEXT,    -- domyślny assignee do rozwiązania
  raised_by                            TEXT,   -- user id lub job id, który wstawił RAISED
  accepted_by                           TEXT,  -- user id, wymagany na ACCEPTED/WAIVED/RESOLVED dla severity != INFO
  expiry                                 TIMESTAMPTZ,  -- wymagany na WAIVED dla WARNING/MATERIAL/CRITICAL_DATA

  evidence                                JSONB,  -- linki do compute_job_runs.id, dokumentów, impact assessment, komentarzy

  created_at                               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                                TEXT,

  CONSTRAINT fk_finance_exceptions_artifact_org
    FOREIGN KEY (artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  -- Reużycie constraintu wymaganego przez WP-B03 §4 (uq_finance_bv_id_org) —
  -- ten sam złożony FK gwarantuje, że business_version_id należy do tej samej organizacji:
  CONSTRAINT fk_finance_exceptions_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  -- Security musi nieść blocking_category; inne severity nie powinny go mieć:
  CONSTRAINT chk_finance_exceptions_blocking_category
    CHECK ( (severity = 'SECURITY' AND blocking_category IS NOT NULL)
         OR (severity != 'SECURITY' AND blocking_category IS NULL) ),

  -- reason wymagany na wszystkim poza pierwszym RAISED przy INFO/WARNING (auto-log dopuszcza NULL na RAISED same):
  CONSTRAINT chk_finance_exceptions_reason_required
    CHECK ( event_type = 'RAISED' OR reason IS NOT NULL ),

  -- accepted_by wymagany na ACCEPTED/WAIVED/RESOLVED (poza czystym auto-log INFO, które nigdy nie ma tych event_type):
  CONSTRAINT chk_finance_exceptions_accepted_by_required
    CHECK ( event_type NOT IN ('ACCEPTED','WAIVED','RESOLVED') OR accepted_by IS NOT NULL ),

  -- expiry wymagany na WAIVED dla WARNING/MATERIAL/CRITICAL_DATA:
  CONSTRAINT chk_finance_exceptions_expiry_required
    CHECK ( event_type != 'WAIVED' OR severity = 'INFO' OR expiry IS NOT NULL )
);

CREATE INDEX idx_finance_exceptions_group ON finance_exceptions(exception_group_id, created_at DESC);
CREATE INDEX idx_finance_exceptions_org_severity ON finance_exceptions(organization_id, severity, created_at DESC);
CREATE INDEX idx_finance_exceptions_artifact ON finance_exceptions(artifact_id, created_at DESC);
CREATE INDEX idx_finance_exceptions_dedup ON finance_exceptions(dedup_key) WHERE dedup_key IS NOT NULL;

-- Append-only enforcement — surowsze niż finance_business_versions:
-- zero mutacji, zero wyjątków, każda zmiana stanu to nowy INSERT.
CREATE OR REPLACE FUNCTION finance_exceptions_deny_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'finance_exceptions is append-only; % not permitted (row %)', TG_OP,
    COALESCE(OLD.id, NEW.id);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finance_exceptions_deny_update
  BEFORE UPDATE ON finance_exceptions
  FOR EACH ROW EXECUTE FUNCTION finance_exceptions_deny_mutation();

CREATE TRIGGER trg_finance_exceptions_deny_delete
  BEFORE DELETE ON finance_exceptions
  FOR EACH ROW EXECUTE FUNCTION finance_exceptions_deny_mutation();

-- --------------------------------------------------------------
-- 2. finance_exceptions_current — bieżący stan logicznego wyjątku (§7.1)
-- --------------------------------------------------------------
CREATE VIEW finance_exceptions_current AS
SELECT DISTINCT ON (exception_group_id)
  fe.*,
  CASE
    WHEN fe.event_type = 'WAIVED' AND (fe.expiry IS NULL OR fe.expiry > now()) THEN 'WAIVED'
    WHEN fe.event_type IN ('ACCEPTED', 'RESOLVED') THEN fe.event_type
    ELSE 'OPEN'
  END AS state
FROM finance_exceptions fe
ORDER BY fe.exception_group_id, fe.created_at DESC;

-- --------------------------------------------------------------
-- 3. finance_reconciliation_runs — append-only ledger source→canonical (§5)
-- --------------------------------------------------------------
CREATE TABLE finance_reconciliation_runs (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id              TEXT NOT NULL REFERENCES organizations(id),
  artifact_id                   TEXT NOT NULL,
  business_version_id            TEXT,

  source_system                   TEXT NOT NULL,  -- 'import:xlsx' | 'legacy:financial_model_events' | 'shadow_parity:...'

  source_total                     NUMERIC NOT NULL,
  mapped_total                      NUMERIC NOT NULL,
  excluded_total                     NUMERIC NOT NULL DEFAULT 0,
  unmapped_total                      NUMERIC NOT NULL DEFAULT 0,
  duplicate_total                      NUMERIC NOT NULL DEFAULT 0,
  reclass_net_total                     NUMERIC NOT NULL DEFAULT 0,
  elimination_net_total                  NUMERIC NOT NULL DEFAULT 0,
  canonical_total                         NUMERIC NOT NULL,

  residual NUMERIC GENERATED ALWAYS AS
    (source_total - canonical_total - excluded_total - unmapped_total) STORED,
  residual_pct NUMERIC GENERATED ALWAYS AS
    (CASE WHEN source_total = 0 THEN NULL
          ELSE ABS(source_total - canonical_total - excluded_total - unmapped_total) / ABS(source_total) END) STORED,

  materiality_threshold_applied            NUMERIC NOT NULL,  -- zamrożona kopia placeholdera (§5.3)
  status                                     TEXT NOT NULL CHECK (status IN ('CLEAN','WITHIN_TOLERANCE','EXCEEDS_MATERIALITY')),
  linked_exception_id                         TEXT REFERENCES finance_exceptions(id),

  bucket_detail                                JSONB,  -- opcjonalny drill-down, patrz §9 pkt 6

  created_at                                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                                     TEXT,

  CONSTRAINT fk_finance_recon_artifact_org
    FOREIGN KEY (artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  CONSTRAINT fk_finance_recon_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id)
);

CREATE INDEX idx_finance_recon_artifact ON finance_reconciliation_runs(artifact_id, created_at DESC);
CREATE INDEX idx_finance_recon_org_status ON finance_reconciliation_runs(organization_id, status);

-- ============================================================
-- KONIEC SZKICU. WP-C01 dostarcza to jako sekwencyjne migracje
-- (expand-only, real Postgres fresh+upgrade replay) — nie jako
-- jeden plik 1:1 z powyższego.
-- ============================================================
```

---

## Traceability

| Wymóg | Skąd | Gdzie w tym ADR |
|---|---|---|
| Tabela `finance_exceptions`, pola z briefu | Zakres zadania pkt 1 | §1.2 (mapowanie), Załącznik A |
| Reguły per severity (Info/Warning/Material/CriticalData/Security) | DEC-FIN-009 | §2 |
| CriticalData → Provisional | DEC-FIN-009 + WP-B02 §5.1 | §4 |
| Security → twarda blokada na poziomie API | DEC-FIN-009 | §3 |
| Reconciliation ledger, waterfall, materiality na residual | Zakres zadania pkt 3, Addendum §2.6, GATE_B §7 (B02-Q4) | §5 |
| Waiver mechanism | Zakres zadania pkt 4 | §6 |
| Query wzorce Exception Inbox | Zakres zadania pkt 5, Addendum §3.10 | §7 |
| Nazewnictwo `finance_*`/`business_version_id` | `GATE_B_INTEGRATION_RECONCILIATION.md` §1 | całość, Załącznik A |
| Reużycie ORCH-DEC-002 (trzy magazyny NPV/IRR/ROI) | `ORCHESTRATOR_DECISIONS_LOG.md` | §5.4 |
