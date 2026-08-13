# Finance — krytyczny przegląd planu i lista uzupełnień

Data: 2026-08-09  
Status: `TARGET RECOMMENDATION / ARCHITECTURE_DECISIONS_MISSING`  
Dokument bazowy: `FINANCE_COMPLETION_RECOMMENDATIONS_2026-08-09.md`

## 1. Werdykt krytyków

Plan bazowy dobrze opisuje kierunek produktu, poprawność danych i governance, ale nie jest jeszcze planem gotowym do implementacji. W obecnej postaci istnieją trzy ryzyka:

1. powstanie system poprawnie wersjonowany, ale finansowo błędny;
2. migracja stworzy dwa źródła prawdy i osierocone artefakty;
3. narzędzie przejdzie testy poprawności, ale będzie zbyt wolne w codziennej pracy analityka.

## 2. Uzupełnienia MUST — poprawność finansowa

1. **Kalendarze i okresy:** rok fiskalny, 4-4-5, 53 tygodnie, stub, quarter-only vs YTD, flow vs stock, LTM/FY oraz annualizacja.
2. **Restatements:** rozróżnić as-reported, restated, management-adjusted, audited/unaudited; nigdy nie nadpisywać historycznego actual.
3. **Konsolidacja:** entity/group, eliminacje intercompany, NCI, acquisition/disposal perimeter i pełne lineage korekt.
4. **Waluty:** functional/presentation/transaction currency, FX dla flow/stock, CTA, constant-currency oraz spójny as-of.
5. **Polityki rachunkowe:** IFRS/local GAAP/US GAAP, IFRS 16, discontinued operations, exceptional items, reclassifications i sign conventions.
6. **Reconciliation ledger:** source total → mapped → excluded/unmapped → canonical total; residual/unexplained bucket ma materiality limit i wymaga approvera.
7. **Ratios convention registry:** average balance denominators, negative denominator, days in period, LTM/interim i formula/taxonomy version.
8. **Normalized earnings:** reported vs adjusted EBITDA/EBIT/NI z reconciling items; segment/geography/product oraz mix/price/volume bridges.
9. **Actual vs prior/budget/latest forecast:** variance bridge, komentarz, owner, action i termin.
10. **Benchmark governance:** peer set, accounting normalization, size/geography, as-of, outliers, percentile, license i reproducibility.
11. **Model schedules:** revenue build, headcount, DSO/DIO/DPO, CAPEX vintages/depreciation, debt schedule, interest, tax/NOL/deferred tax, leases, equity/dividends, min cash/revolver.
12. **Circularity i plug policy:** solver, convergence, failure state; tylko nazwany revolver/cash sweep, zakaz niewyjaśnionego BS plug.
13. **Backtesting:** holdout actual, bias/MAPE per material line i degraded state przy niewystarczającej historii/sezonowości.
14. **Scenariusze:** zależności ceny/wolumenu/capacity/inflacji/FX/stóp/podatku, reverse stress i break-even, liquidity/covenant headroom oraz realized-benefit feedback.
15. **Valuation depth:** nominal/real/currency consistency, WACC build, terminal `g = reinvestment × ROIC`, pełny EV→Equity bridge, timing/stub, calendarized comps i disagreement analysis zamiast fałszywej jednej wartości.
16. **Known-answer evidence:** niezależne workbooki pokazujące inputs, conventions, intermediate schedules, formulas i outputs. Zielony tie-out ani bit-for-bit między dwoma silnikami nie dowodzą poprawności.

### Korekta tolerancji

Nie używać automatycznie `max(1 jednostka źródłowa, 0,1%)` dla równania bilansu. Tolerancja reconciliation powinna wynikać z source rounding i materiality policy, zwykle z bardziej restrykcyjnego progu. Większa tolerancja może służyć analizie, nie dowodowi równości bilansu.

## 3. Uzupełnienia MUST — produktywność analityka

1. **Finance Data Grid:** multi-select, rectangular paste, fill down/right, paste special, bulk clear/reset/set rule, find/replace, freeze, hide/group, jump-to-line.
2. **Excel/CSV round-trip:** szablon, eksport danych i formuł, preview diff, mapping, validation, transactional reimport oraz manifest version/unit/source.
3. **Keyboard-first:** pełna nawigacja i edycja, copy/paste, undo/redo, find, save, edit, delete, select oraz skróty Compute/Compare/Comments.
4. **Undo/redo i draft recovery:** session-level stack, atomowe cofnięcie bulk/paste, autosave, Sync/Saved/Conflict oraz crash/refresh recovery.
5. **Compare jako rdzeń:** period, actual/forecast, version, entity, scenario i valuation method; absolute/Δ/%, materiality filters, synchronized scroll i export diff.
6. **Komentarze i review:** komentarz do artefaktu/KPI/linii/komórki/okresu, mentions, assign, resolve/reopen, blocking flag i review checklist.
7. **Filtry i saved views:** category, quality, missing, changed, materiality, source, owner, downstream use, entity, period; personal/team views i shareable URL.
8. **Multi-period/multi-entity context:** Entity/Group, Currency, Granularity i As-of; side-by-side, consolidation/elimination badges i scope preview dla bulk action.
9. **Why this number?:** source cells, formula, FX/unit, overrides, compute run, author/time i freshness dostępne dla każdej wartości.
10. **Exception inbox:** tie-out fail, stale, compute failed, review assigned, blocker, benchmark expired, unusual variance i import conflict z ownerem oraz deep linkiem.
11. **Large-data performance:** jawne limity i SLO. Minimum benchmark: 10k widocznych komórek bez degradacji pracy; wieloletnie/multi-entity payloads mają pagination/virtualization.
12. **Async draft snapshot:** Compute liczy immutable hash roboczego snapshotu; kolejne edycje nie zmieniają joba w locie i nie giną po timeout/crash.

### Krytyczna zmiana priorytetów

Grid, Excel round-trip, keyboard, compare, comments/review, filtry i saved views przechodzą z P2 do P0/P1. Muszą być zaprojektowane razem z mutacjami, wersjami i audytem, a nie dołożone po ukończeniu silników.

## 4. Uzupełnienia MUST — migracja, operacyjność i bezpieczeństwo

1. **Inventory i migracja legacy:** counts/checksums, reguła legacy→v1/shadow/quarantine, Approved bez snapshotu, NULL periods/units, orphan edges, event→Prediction i exception ledger.
2. **API compatibility:** inventory konsumentów, zamrożone fixtures/OpenAPI, additive endpoints/adapters, dual-read parity, deep links i deprecation telemetry.
3. **Async jobs architecture:** queue, persisted jobs, leases/heartbeats, idempotency scope, dedupe, cancellation, retry/DLQ, per-org limits i atomowy commit output version.
4. **Expand–backfill–cutover–contract:** dry run, resumable migration, dual write/read, canary, feature flags, kill switch i rollback po zapisaniu nowych wersji.
5. **Concurrency:** aggregate boundaries, ETag/expected version, isolation/locks oraz jawne race rules dla rename/edit/compute/approve/archive/reopen.
6. **Retention i legal hold:** raw files, values, outputs, snapshots, exports, Advisor evidence, PII, tenant offboarding i crypto-shredding/anonymization.
7. **Permissions i segregation of duties:** preparer/reviewer/approver, self-approval policy, endpoint-level role×state×action, shared/export authorization i impersonation audit.
8. **Tenant isolation:** org-scoped job envelope, queries, unique keys, cache, object paths, telemetry i export URLs; RLS/DB role tam, gdzie zasadne.
9. **Capacity:** max years/months/lines/entities/scenarios/KPI/initiatives, p50/p95/p99 SLO, concurrent tenants, query plans i bounded responses.
10. **Observability/recovery:** correlation request→job→run→output→export, reason codes, metrics, traces, alerts, runbooks, replay/quarantine i manual repair audit.
11. **Export contract:** immutable manifest, version pinning, locale/timezone/unit/as-of, evidence appendix, async recovery, signed URL expiry i exact hash reconciliation.
12. **Security closure:** trusted production fingerprint, secret rotation/audit, DB read-only role, network controls i dowód historycznych mutacji. Regex allowlist nie jest granicą bezpieczeństwa.
13. **Large-file ingestion:** limity, resumable upload, duplicate hash, encrypted/malformed/malicious files, partial cleanup i object-store retention.
14. **Restatement operations:** original/corrected lineage, supersede/quarantine policy, downstream stale oraz czytelne oznaczenie eksportów.

## 5. Governance i model risk

1. Model inventory: owner, purpose, users, materiality/risk tier, validation date, limitations i review cadence.
2. Maker-checker dla materialnych artefaktów; self-approval zabronione dla high risk.
3. Review package: checklist, open comments, evidence, exceptions i overrides; approval blokowane do resolution/authorized waiver.
4. Change classification: data refresh, assumption, formula, methodology — każda klasa uruchamia właściwy zakres revalidation.
5. Override/estimate ma ownera, powód, expiry i monitoring.
6. Reproducibility manifest przypina engine/code, formula/taxonomy, FX/market data i as-of/timezone.
7. Advisor wymaga osobnej polityki AI: provider/model/prompt version, evidence digest, residency, no-training, koszt/rate limit, hallucination evaluation i human sign-off.

## 6. Elementy do ograniczenia lub przesunięcia

1. **Lineage jako DAG, nie obowiązkowy łańcuch:** Scenario jest opcjonalne; Model może prowadzić bezpośrednio do Valuation, a Analysis może być równoległym child.
2. **Minimalny typed version-edge ledger najpierw;** pełny graf później.
3. **KPI P0:** zacząć od 12–18 krytycznych KPI z rygorystycznymi conventions; pełne 42 i custom DSL później.
4. **Valuation P0:** najpierw stabilny DCF/comps, checks, review i export. Advisor oraz rozbudowany 7-step polish po poprawności engine.
5. **Mobile:** w pierwszym zakresie read/review/approve; pełna edycja trzech sprawozdań na 390 px nie jest P0.
6. **Methods & weights:** dopuścić primary method + nieważone cross-checks. Nie wymuszać mechanicznego 100%, jeśli polityka CFO tego nie uzasadnia.
7. **Bit-for-bit/hash:** używać semantic hash + numeric tolerance + known-answer, nie surowego serializacyjnego hash jako dowodu finansowego.
8. **Horyzont modelu:** purpose-driven do steady state/debt maturity/business cycle, a nie wyłącznie presety 3/5/10.
9. **Wizard:** standardowy Quick Create ≤45 s; pełny wizard tylko dla Customize. Nie wymuszać opcjonalnych benchmarków/custom KPI.
10. **Wersje:** Working Draft Revisions dla autosave/undo/compute; Business Versions tylko dla submit/approve/reopen/publish. Nie tworzyć setek biznesowych wersji.

## 7. Odchudzenie Workspace Bar

Pasek nie może zawierać wszystkiego jednocześnie. Rekomendowany limit:

- identity: Back, nazwa, wersja/status; pozostałe meta w Context popover;
- view navigation: w pasku dla dwóch widoków, osobna kompaktowa linia przy większej liczbie kroków;
- actions: 1 primary, maksymalnie 1 secondary, More i fullscreen;
- freshness połączone z CTA, np. `Nieaktualne · Przelicz`;
- lifecycle jako jeden status control/menu.

Kryterium: przy 1280 px i nazwie 60 znaków brak nakładania; maksymalnie pięć bezpośrednich controls po prawej; 200% zoom pozostaje operacyjny.

## 8. Decyzje wymagane przed kodowaniem

1. Kanoniczny zestaw KPI P0 per industry.
2. Cash/debt plug i facility/covenant policy.
3. Double-counting taxonomy i kto może rozstrzygać konflikt.
4. Katalog metod wyceny, korelacja, primary method i polityka wag.
5. Advisor przed czy po approval oraz jego status prawny/audytowy.
6. Delete Approved: zakaz czy soft-delete; retention/legal hold.
7. Zakres mobile: review-only czy full editing.
8. Source reconciliation materiality i dopuszczalne overrides.
9. Granica między technical revision i business version.
10. Job platform, compatibility window i strategia migracji.

Po decyzji `DEC-FIN-012` pozycje techniczne i standardowe z tej listy są rozstrzygane przez zespół według najwyższych profesjonalnych standardów. Właściciel zatwierdza wyłącznie elementy spełniające kryteria eskalacji strategicznej opisane w `DEC-FIN-012`.

### Decyzje właścicielskie

| ID | Decyzja | Status | Rozstrzygnięcie |
|---|---|---|---|
| DEC-FIN-001 | Model zatwierdzania | `DECIDED` | Governance zależne od ryzyka i materialności. Artefakty materialne/high-risk wymagają maker–checker i nie mogą być self-approved. Niskiego ryzyka analizy robocze mogą podlegać self-approval zgodnie z policy. Tryb awaryjny wymaga uprawnienia, uzasadnienia, expiry/review i pełnego śladu audytowego. |
| DEC-FIN-002 | Gotówka i finansowanie w Baseline Model | `DECIDED` | Baseline Model nie stosuje cash/debt plug, nie uruchamia finansowania, nie spłaca automatycznie długu i nie alokuje nadwyżek. Gotówka jest czystym wynikiem P&L→CF→BS i może być dodatnia albo ujemna. Ujemna gotówka pozostaje widoczna jako wartość oraz czerwony alarm/funding gap; rosnąca nadwyżka pozostaje na linii cash. Decyzje o finansowaniu, spłacie długu, dywidendzie lub wykorzystaniu nadwyżki należą wyłącznie do Prediction. |
| DEC-FIN-003 | Katalog KPI | `DECIDED` | Pełny katalog jest trójwarstwowy: (1) uniwersalne KPI finansowe, (2) pakiety KPI branżowych, (3) wersjonowane KPI własne organizacji. Kreator rekomenduje zestaw na podstawie branży i dostępności danych, lecz analityk może dodawać i usuwać wskaźniki. Każdy KPI ma wersjonowaną formułę, konwencję okresu, wymagane dane, jednostkę, zasady N/A, benchmark/provenance i historię zmian. |
| DEC-FIN-004 | Konflikty i double counting w Prediction | `DECIDED` | `Compute` działa dwuetapowo. Etap 1 to preflight/analiza pełnego zestawu założeń: system wykrywa nakładanie wpływów, konflikty, braki i niespójności, grupuje je w listę rozstrzygnięć oraz proponuje rozwiązania z podglądem wpływu liczbowego. Użytkownik akceptuje propozycję albo wybiera własne rozstrzygnięcie i uzasadnia decyzję; materialne rozstrzygnięcia podlegają właściwemu review. Etap 2 — właściwy compute — startuje dopiero po domknięciu wymaganych rozstrzygnięć. System nie blokuje tworzenia założeń i nie sumuje konfliktów po cichu. |
| DEC-FIN-005 | Metody i wagi wyceny | `DECIDED` | Metody dzielą się na koszyk rekomendacyjny oraz nieważone cross-checki. Tylko aktywne, kompletne metody koszyka otrzymują wagi sumujące się do 100% i budują rekomendowany przedział/wynik. Cross-checki pokazują niezależną perspektywę i disagreement, ale nie wpływają mechanicznie na wynik. Brak danych oznacza N/A/wyłączenie, nigdy zero. System ujawnia korelacje metod, wkład każdej w wynik i ostrzega przed pseudodywersyfikacją podobnych metod. |
| DEC-FIN-006 | Valuation Advisor, warianty i kontekst rozmowy | `DECIDED` | Advisor działa przed formalnym approval, wyłącznie na świeżej computed candidate version. Nie zmienia danych i nie zatwierdza; przedstawia fakty, hipotezy, ryzyka, pytania oraz pomysły z evidence/confidence. Jedna Valuation Case może zawierać wiele wariantów i wersji opartych na różnych zestawach założeń. Każdy wariant/wersja ma nazwę, opis, autora, timestamp, source versions, assumption snapshot, compute run i historię porównawczą. Advisor analizuje zarówno pojedynczy wariant, jak i różnice między wariantami. Po approval jego raport zostaje zamrożony z wersją wyceny. Ustalenia Advisora, warianty i ich dowody są dostępne w kontekście rozmowy z TRS-em poprzez trwałe referencje do konkretnych artifact/version IDs. |
| DEC-FIN-007 | Usuwanie zatwierdzonych artefaktów | `DECIDED` | Approved nie ma zwykłego hard-delete. Może zostać Superseded, Archived albo — przy wykrytym błędzie — Invalidated z obowiązkową przyczyną; pozostaje w historii i lineage. Draft bez potomków może być usuwany zgodnie z uprawnieniami. Prawne usunięcie/anonimizacja odbywa się wyłącznie przez kontrolowaną politykę retencji/GDPR/legal hold, z autoryzacją i audytem. |
| DEC-FIN-008 | Zakres urządzeń | `DECIDED` | Bieżący produkt Finance jest desktop-first; wersja mobile pozostaje wyłączona i nie jest bramką obecnego wydania. Architektura/UI zachowują przyszły kontrakt: desktop/laptop = pełna edycja; tablet = read/review i ograniczona edycja; telefon = wyniki, alerty, komentarze i approval bez budowy wieloletnich modeli. Aktywacja mobile wymaga osobnej decyzji i odbioru. |
| DEC-FIN-009 | Tolerancje i praca z wyjątkami | `DECIDED` | System prowadzi do ideału, ale nie blokuje tworzenia, compute ani generowania materiału wyłącznie dlatego, że istnieją błędy lub odchylenia. Równania techniczne używają source-rounding tolerance; source→canonical stosuje bardziej restrykcyjny próg bezwzględny/procentowy; analityka korzysta z materiality organizacji. Wszystkie przekroczenia trafiają do exception ledger. Poziomy: `Info` — rejestracja automatyczna; `Warning` — akceptacja analityka z uzasadnieniem; `Material exception` — ocena wpływu i maker–checker; `Critical data exception` — compute/export dozwolone, ale wynik ma status `Provisional / Accepted with critical exceptions` i jawne oznaczenie; `Security/tenant breach` lub matematycznie nieokreślona operacja — twarda blokada. Każdy materiał pokazuje jakość, wyjątki, wpływ, autora i approvera oraz rozróżnia clean/conditional/provisional. |
| DEC-FIN-010 | Rewizje robocze i wersje biznesowe | `DECIDED` | System rozdziela częste `Working Revisions` (autosave, Undo/Redo, kolejne Compute, crash recovery i conflict handling) od formalnych `Business Versions`. Wiele zmian i compute pozostaje jednym Draftem. Business Version powstaje świadomie przy submit to review, approval, reopen/new version, publish albo nazwanym milestone. Główna historia pokazuje milestones; rewizje techniczne są dostępne na żądanie. Compute wskazuje immutable working snapshot/hash, lecz sam nie tworzy automatycznie nowej wersji biznesowej. |
| DEC-FIN-011 | Lineage DAG | `DECIDED BY PROFESSIONAL STANDARD` | Lineage jest kontrolowanym, acyklicznym DAG opartym na immutable artifact/version IDs. Analysis wskazuje konkretny Statement Pack Version; Baseline Model wskazuje zgodne Statement Pack i Historical Analysis versions; Prediction wskazuje Baseline Model Version; Valuation może wskazywać Baseline Model albo Scenario Version; raport/eksport może agregować wiele jawnych wersji. Relacje cross-tenant i cykle są zabronione. Scenario nie jest obowiązkowe dla wyceny baseline. |
| DEC-FIN-012 | Zasada podejmowania dalszych decyzji | `DECIDED` | Dla zagadnień objętych jednoznacznym profesjonalnym standardem finansowym, model-risk, audytowym, bezpieczeństwa, danych lub UX zespół przyjmuje najwyższy uzasadniony standard rynkowy bez eskalowania rutynowych pytań do właściciela i dokumentuje decyzję/evidence. Do właściciela wracają wyłącznie decyzje strategiczne, prawne, reputacyjne, kosztowe, dotyczące modelu biznesowego, apetytu na ryzyko albo istotnej zmiany zakresu produktu. |

## 9. Zmieniona sekwencja realizacji

1. **Gate A:** inventory, API freeze, klasyfikacja legacy i domknięcie incydentu bezpieczeństwa.
2. **Gate B:** decyzje architektoniczne: versions, jobs, permissions/SoD, retention, restatement, numerical reproducibility i finance policies.
3. **Gate C:** expand schema, adapters, migracja próbna, shadow reads i rollback rehearsal.
4. **Gate D:** Statements truth, source reconciliation i minimalny lineage backfill.
5. **Gate E:** lifecycle, jobs, observability oraz Analyst Productivity Contract na canary tenant.
6. **Gate F:** jeden gold vertical slice: Statement→Analysis→Baseline Model→Scenario(optional)→Valuation→Export.
7. **Gate G:** macierz przypadków, multi-company/currency/entity, negative/sparse/seasonal, performance, failure i rollback.
8. **Gate H:** Workspace UX, progressive rollout i independent CFO pilot.

## 10. Dodatkowe bramki GO

- Macierz golden cases: annual/interim/YTD/stub/restated, multi-currency, consolidated, negative earnings, missing CF, high leverage i seasonal business.
- Każdy case ma niezależny workbook z wartościami pośrednimi oraz decision-fitness walkthrough.
- Source reconciliation nie ma niewyjaśnionych krytycznych residuals ani plugów.
- Analityk: paste 100×10 assumptions <60 s z atomowym Undo; standardowa analiza ≤45 s; benchmark keyboard task ≤90 s.
- Excel round-trip 5k×60 bez silent coercion i z dokładnym diffem.
- Why this number? prowadzi do source/formula w ≤3 kliknięciach dla losowych 50 wartości.
- Review comment do komórki, resolution i blocking approval działają po cold reopen.
- Migracja ma zero utraconych wierszy, exception ledger, deterministic rerun i rollback rehearsal.
- Job kill/retry/race daje dokładnie jeden committed output version.
- Pilot niezależnego CFO/reviewera kończy pełny close→analysis→model→scenario→valuation→export bez nieudokumentowanych workaroundów.

Do czasu rozstrzygnięcia sekcji 8 i spełnienia Gate A–B plan nie jest gotowy do implementacji.
