# Results Next — Acceptance & Verification Handbook

> Status: NORMATIVE ACCEPTANCE CONTRACT  
> Data: 2026-08-09  
> Właściciel akceptacji: Codex / Chief Product & System Architect  
> Odbiór biznesowo-wizualny: Founder  
> Zakres: cały Results Next, KPI, ROI, OKR, Teresa, MyWork, Decisions i integracje

## 1. Cel

Ten dokument określa, kiedy kompletna implementacja Results Next może zostać przekazana do niezależnego odbioru i kiedy może otrzymać terminalny status GO.

Nie zastępuje master planu ani planów domenowych. Łączy ich wymagania w jeden egzekwowalny program weryfikacji funkcjonalnej, technicznej, graficznej i customer experience.

## 2. Nadrzędna zasada dowodowa

Żaden z poniższych elementów nie jest samodzielnym dowodem ukończenia:

- obecność kodu lub migracji;
- dokumentacja;
- zielony build, typecheck lub test jednostkowy;
- fixture, mock lub synthetic harness;
- screenshot bez runtime i SHA;
- self-review wykonawcy;
- ukończony pojedynczy epik albo domena;
- komunikat wykonawcy `ready`, `done`, `shipped` lub `production-ready`.

Brak dowodu zachowuje status `EVIDENCE_MISSING`. Dowód z innego SHA, środowiska, schematu lub zestawu danych jest dowodem historycznym, nie acceptance aktualnego kandydata.

## 3. Taksonomia statusów

| Status | Znaczenie |
|---|---|
| `NOT_IMPLEMENTED` | funkcja nie istnieje |
| `IMPLEMENTED_UNVERIFIED` | kod istnieje, lecz brakuje wymaganej weryfikacji |
| `PARTIAL` | część kontraktu działa, część pozostaje niespełniona |
| `BLOCKED_RUNTIME` | kod nie może zostać sprawdzony na wymaganym runtime |
| `BLOCKED_DATA` | brakuje kontrolowanego zestawu danych lub dostępu |
| `EVIDENCE_MISSING` | twierdzenie nie ma kompletnego dowodu |
| `IMPLEMENTED_EVIDENCED_CANDIDATE` | cały obowiązkowy zakres wykonawcy ma candidate-matched code/test/runtime/visual evidence; czeka na niezależny review i autoryzowane środowisko |
| `ACCEPTED_LOCAL` | pakiet przeszedł lokalny odbiór na wskazanym SHA |
| `ACCEPTED_ACCEPTANCE_ENV` | pakiet przeszedł w nazwanym środowisku odbiorowym |
| `ACCEPTED_TERMINAL` | cały program przeszedł wszystkie obowiązkowe bramki |
| `NO_GO` | co najmniej jeden terminalny warunek nie został spełniony |

`PARTIAL`, `BLOCKED_*` i `EVIDENCE_MISSING` nie mogą być zamieniane na PASS przez komentarz lub waiver dotyczący bezpieczeństwa, tenant isolation, integralności danych, approval integrity albo lifecycle correctness.

## 4. Globalny łańcuch traceability

Każda funkcja musi mieć pełny łańcuch:

```text
Founder Decision
  -> Epic
    -> Feature/Requirement
      -> Acceptance Criterion
        -> Implementation artifact
          -> Test case
            -> Evidence artifact
              -> Gate
                -> Verdict
```

Obowiązkowe pola ledgeru:

- decision ID;
- epic i feature ID;
- acceptance criterion ID;
- domena, aggregate i owner;
- command/query/endpoint;
- schema/migration/constraint;
- eventy i konsumenci;
- route oraz list/preview/tool surface;
- role, visibility i maker-checker;
- testy unit/contract/integration/E2E/security/a11y/visual;
- evidence path i hash;
- baseline, candidate i — jeśli dotyczy — deployed SHA;
- środowisko, schema version i data provenance;
- wynik, blocker, waiver, reviewer i timestamp.

Puste pole jest legalne wyłącznie jako jawne `N/A` z uzasadnieniem zatwierdzonym przez reviewer.

## 5. Hierarchia bramek

### RN-G0 — Contract and baseline

PASS wymaga:

- decyzje D01–D15 zamknięte;
- ADR/supersession i threat model;
- inventory aktualnego kodu, routes, schema, consumers i flags;
- baseline branch/SHA/worktree/status;
- ownership/allowlist/DAG;
- zaakceptowany ledger epików i kryteriów;
- Open Decision & Evidence Register: każda pozycja `EVIDENCE_NEEDED` z Master/KPI/ROI/OKR ma ID, ownera, rekomendację, blocking level i resolution;
- brak nierozstrzygniętego P0 semantycznego.

Żadna pozycja dotycząca security, accountability, scoring, lifecycle, financial semantics lub lineage nie może pozostać nierozstrzygnięta przed implementacją zależnego kontraktu.

### RN-G1 — Platform foundation

PASS wymaga:

- addytywne clean-start schemas;
- repozytoria i typed commands/queries;
- optimistic concurrency i idempotency;
- server-side RBAC+ABAC;
- visibility policies;
- append-only audit/events i transactional outbox;
- evidence/provenance;
- MyWork/Decision typed references;
- legacy adapters read-only;
- migracja na pustej i realistycznej kopii bazy;
- rollback lub forward-repair rehearsal.

### RN-G2 — Registry and projections

PASS wymaga:

- trzy rejestry parent objects;
- personal/team/BU/organization projections z tych samych IDs;
- list/grid/preview/full-tool routing;
- Menu 1/2/3, filters/counts, settings, bulk, kebab i context menu;
- loading/empty/filtered-empty/error/retry/denied/degraded;
- trwałe filtry, kolumny, scroll i powrót;
- non-leaking counts/search/export/notifications/AI.

### RN-G3 — Teresa, MyWork and Decisions

PASS wymaga:

- typed proposal catalog;
- źródła i rozdzielenie fact/inference/recommendation;
- expected version i permission preflight;
- accept/reject oraz audit;
- personal i organizational mode;
- same-object MyWork readback;
- exact-version Decision roundtrip;
- event retry bez duplikacji obowiązku;
- no silent write i no autonomous approval.

### RN-G4 — Complete domain gold flows

Każda domena przechodzi własną macierz acceptance niezależnie. Ukończenie KPI nie kompensuje braku ROI lub OKR.

### RN-G5 — Operational depth

PASS wymaga:

- KPI review snapshot i effectiveness verification;
- ROI Forecast/Actual/Variance/PIR również po zakończeniu Initiative;
- OKR recurring rhythm, support, scoring, reflection i carry-forward;
- idempotent scheduler/obligations;
- reconstructable approved history.

### RN-G6 — Cross-domain integration

PASS wymaga:

- typed KPI evidence dla ROI;
- neutralne OKR data-source references bez structural inheritance;
- Initiative reverse links bez przejmowania lifecycle;
- Results–Finance pinned seam bez silent sync;
- MyWork/Decision/Reporting integrations;
- failure isolation i version pinning;
- projection rebuild i outbox replay.

### RN-G7 — Terminal hardening

Candidate PASS wymaga pełnego functional, security, data, runtime, UI/CX, accessibility, locale, performance, observability, recovery i evidence programu na jednym zintegrowanym candidate SHA.

Terminal environment PASS wymaga następnie, aby dokładnie ten candidate SHA został wdrożony do jawnie nazwanego środowiska odbiorowego. Client SHA, server SHA, migration/schema checksum i evidence manifest muszą odpowiadać wdrożonemu SHA. `ACCEPTED_ACCEPTANCE_ENV` jest obowiązkowym poprzednikiem `ACCEPTED_TERMINAL`.

`EVIDENCE_NEEDED`: przed terminalnym odbiorem Codex/Founder muszą wskazać nazwane środowisko — Railway `demo`, osobne acceptance/staging albo inne kontrolowane środowisko. Wykonawca nie może sam przyznać sobie prawa do deployu.

## 6. Obowiązkowe functional golden flows

### RN-E2E-KPI-001 — KPI closed loop

1. Utwórz centralny KPI Draft.
2. Uzupełnij owner, definition, source, cadence i target geometry.
3. Submit jako autor.
4. Odrzuć self-approval.
5. Approve jako drugi uprawniony użytkownik.
6. Activate i zapisz measurement z provenance.
7. Wywołaj critical deviation dokładnie raz przy retry.
8. Dodaj explanation/RCA i corrective plan.
9. Przejdź przez Decision/MyWork.
10. Wykonaj działania, zapisz kolejny pomiar.
11. Zweryfikuj effectiveness i zamknij case.
12. Opublikuj Scorecard Review Snapshot.
13. Restart, cold reopen i porównanie historii/wersji/eventów.

Kontrole dodatkowe: Observation KPI bez targetu, missing vs zero, correction append-only, jeden KPI w wielu Scorecards, restricted non-leak.

Obowiązkowa asercja niezależności wymiarów: `active lifecycle + critical performance + provisional/disputed data quality + normal/escalated attention` są czterema osobnymi wartościami. Zmiana jednego wymiaru nie przepisuje pozostałych.

### RN-E2E-ROI-001 — ROI full lifecycle

1. Utwórz Case z realnej Initiative; próba duplikatu nie tworzy drugiego aktywnego case.
2. Zbuduj baseline/BAU, assumptions, cost i benefit lines.
3. Uruchom downside/base/upside na known-answer fixture.
4. Submit dokładną wersję.
5. Odrzuć self-approval; review/approve jako drugi użytkownik.
6. Potwierdź immutable Original Approved.
7. Utwórz Current Forecast bez zmiany Approved.
8. Zapisz Actual z evidence i verifierem.
9. Odrzuć zwykły overwrite zatwierdzonego baseline; wykonaj governed rebaseline jako nową wersję.
10. Wykonaj append-only Actual correction z reason i verifierem; oryginalna wartość/provenance pozostaje.
11. Powiąż version-pinned KPI evidence; disputed evidence nie nadpisuje Actual.
12. Zakończ Initiative i kontynuuj Benefits Realization.
13. Wyjaśnij variance, przeprowadź PIR i close.
14. Restart, cold reopen i odtwórz Approved/Forecast/Actual/audit.

### RN-E2E-OKR-001 — OKR operating rhythm

1. Skonfiguruj Program/policy i Cycle.
2. Utwórz individual, team i BU Set oraz authorized company projection.
3. Dodaj Objective i co najmniej dwa KRs.
4. Przyjmij jedną i odrzuć jedną sugestię Teresy.
5. Submit; odrzuć self-approval; approve jako manager.
6. Aktywuj i wykonaj MyWork check-in.
7. Pokaż niezależność progress i confidence.
8. Request support i Decision; zapisz resolution.
9. Wykonaj material revision z historią.
10. Score, reflect, close i carry-forward.
11. Uruchom scheduler occurrence, ponów event/job i potwierdź dokładnie jedno obligation.
12. Restart i potwierdź ten sam obligation ID; zakończ przez MyWork i potwierdź zapis w tym samym KR/Set.
13. Potwierdź identyczne aggregate IDs/versions we wszystkich projekcjach.
14. Restart, cold reopen i projection rebuild.

### RN-E2E-XDOM-001 — Cross-domain truth and orchestration

- ROI Benefit odwołuje się do konkretnej wersji KPI bez przejęcia truth.
- Initiative pokazuje reverse references bez wspólnego lifecycle.
- MyWork i Decision otwierają dokładnie ten sam aggregate/version.
- Teresa widzi dokładnie to, co uprawniony użytkownik.
- awaria jednego domenowego API nie zeruje pozostałych rejestrów;
- duplicate event/replay nie duplikuje skutków;
- rebuild projekcji daje oczekiwane counts/checksums;
- legacy pozostaje wykluczone z nowych counts/search/AI.

Scenariusze uzupełniające, obowiązkowe dla RN-G6:

- `RN-E2E-XDOM-FIN-001`: pinned Finance artifact/version/mapping, divergence/reconciliation, retry i cold readback; żadnego silent sync ani przejęcia SSOT.
- `RN-E2E-XDOM-OKR-001`: neutralny OKR source binding, version pinning i brak structural inheritance/score mutation.
- `RN-E2E-XDOM-NOTIFY-001`: notification projection po authorization filtering, retry/idempotency i brak metadata leak.
- `RN-E2E-XDOM-REPORT-001`: Reporting readback z pinned source versions, visibility i brak skopiowanego lifecycle/state.

## 7. Bramka API i danych

### API

- authn/authz i object-level policy na serwerze;
- jeden namespace `/api/vnext/results/{domain}`;
- stabilne typed errors;
- idempotency dla retry;
- expected version/CAS;
- żadnego fałszywego `2xx`;
- contract tests klient–serwer;
- jawne timeout/partial failure/duplicate delivery;
- read-after-write i readback po restarcie.

### Database

- clean install i realistic-copy migration;
- brak backfillu, dual-write i modyfikacji legacy;
- FK, unique, tenant i lifecycle constraints;
- decimal-safe money i unit/period/as-of;
- append-only history tam, gdzie wymagana;
- atomowy aggregate+outbox;
- schema checksum zgodny z candidate SHA;
- backup/restore oraz rollback lub flag-off rehearsal.

### Legacy

- tylko jawne GET archive routes;
- wszystkie mutacje odrzucone i audytowane;
- czytelne oznaczenie `Legacy archive`;
- wykluczenie z default views/count/search/analytics/Teresa;
- checksum legacy bez zmian;
- brak fallbacku do legacy przy błędzie vNext.

## 8. Security and governance gate

Obowiązkowa macierz aktorów:

- owner/author;
- contributor/data or benefit owner;
- manager/reviewer;
- approver;
- authorized organizational viewer;
- approved-summary viewer;
- restricted outsider;
- foreign tenant;
- Teresa/system actor.

Testy obejmują:

- IDOR i cross-tenant denial;
- self-approval denial;
- drugi reviewer zatwierdza dokładnie przedstawioną wersję;
- filtering przed count/search/export/notification/AI;
- brak inference przez hidden ID, metadata, relation albo alignment edge;
- audit allowed/denied actions i policy version;
- delegated/expired access;
- maker-checker dla materialnych przypadków;
- żadnego waiveru dla tenant, data loss i approval integrity.

## 9. Teresa/AI acceptance

Każdy reprezentatywny flow KPI/ROI/OKR musi pokazać:

- authorization-filtered retrieval;
- pinned source/evidence versions;
- fact vs inference vs recommendation;
- proposed patch i consequence preview;
- expected aggregate version;
- required human actor/approver;
- accept/reject disposition;
- reauthorization w momencie apply;
- audit provider/model/prompt/tools/source/result/actor;
- prompt-injection i cross-tenant negative tests;
- degraded path: brak Teresy nie blokuje manualnego workflow.

Teresa nie zatwierdza, nie publikuje policy, nie zmienia visibility, nie zapisuje Actual, nie wystawia ludzkiego confidence i nie zamyka governed case samodzielnie.

## 10. Information architecture i customer experience

### Object truth

- Dokładnie trzy top-level parent registries: Scorecards, ROI Cases, OKR Sets.
- Wiersz otwiera dokładnie nazwany parent object.
- Dashboard/editor/report nie jest doklejony pod rejestrem.
- Progressive disclosure L0–L4 jest zachowane.
- `My` i `Organization` są projekcjami tych samych IDs/versions.

### Menu 1/2/3

- Menu 1 pozostaje globalne.
- Menu 2: search, KPI/ROI/OKR, view switch, maksymalnie jeden domain tool i dokładnie jeden primary CTA.
- Menu 2 nie ma liczników.
- Menu 3 ma dokładnie jedną aktywną formułę: filters, bulk albo open tabs.
- Liczniki, w tym zero, są prawdziwe i authorization-filtered.
- Teresa jest standardową akcją kontekstową, nie konkurencyjnym CTA.
- Nie ma drugiego toolbaru ani lokalnego mini-menu pod Menu 3.

### Table/grid

- Użyta jest kanoniczna warstwowa kompozycja Standard* + wspólna mechanika/orchestration.
- Nagłówki pozostają w loading/empty/error.
- sticky/resize/visibility/order/persistKey naprawdę działają.
- wymagane kolumny są locked;
- missing = `—`/typed `N/A`, nigdy false zero;
- liczby/units/currency/period/as-of są czytelne;
- brak zebry, status-colored rows i ad-hoc badges;
- Grid reprezentuje te same records/actions/permissions;
- kebab i context menu mają parity i żadnej ukrytej władzy.

### Preview

- zamknięte domyślnie;
- single-click otwiera, Esc zamyka i zwraca focus;
- szerokość `clamp(340px, 28%, 480px)`;
- sześć kanonicznych bloków;
- dokładnie jedno `Open`;
- relations i Teresa nie przeciekają;
- preview nie jest mini pełnym narzędziem.

### Full tools

- powrót zachowuje tab/filter/sort/scroll/selection;
- sticky header ma identity, lifecycle/version, phase, freshness/next obligation i jeden CTA;
- save state jest oddzielony od lifecycle;
- locked/conflict/stale/denied/error są uczciwe i odzyskiwalne;
- KPI, ROI i OKR zachowują własne fazy z planów domenowych;
- Program/Cycle admin nie udaje wnętrza pojedynczego OKR Set.

## 11. Visual terminal matrix

### Viewports i zoom

- 1440×900 @100% — kanoniczny odbiór;
- 1280×720 @100% — minimalny desktop;
- 1600×900 i 1920×1080 — diagnostyka gęstości/whitespace;
- 1440 i 1280 @125% zoom;
- tablet 768–1023 dla read/review;
- poniżej 768 uczciwy ograniczony tryb, jeśli modeling jest desktop-first.

### Themes/locales/content stress

- dark i light na żywym runtime;
- PL i EN;
- długie polskie etykiety i tytuły 60 znaków;
- duże/ujemne wartości pieniężne, maksymalne liczniki i brak danych;
- WCAG 2.2 AA, status nie tylko kolorem;
- focus zawsze niebieski/semantic focus, nie crimson;
- prefers-reduced-motion.

### Keyboard/a11y

- cały krytyczny flow możliwy klawiaturą;
- Tab order zgodny z obrazem;
- J/K lub strzałki dla listy, Space selection, Enter open, Esc close;
- focus return po preview/popover/dialog;
- `aria-sort`, accessible names, dialog/focus trap;
- `aria-live=polite` dla selection i Teresy;
- widoczna geometria zgodna z TRIADA, semantyczny touch target zgodny z kontraktem.

## 12. Honest state matrix

Dla każdej domeny osobno należy udowodnić:

- initial loading bez flash false-empty;
- empty z przyczyną i właściwym CTA;
- filtered empty;
- local error + Retry;
- retry success bez duplikatu;
- forbidden/not-found zgodnie z security policy;
- locked/read-only/archive;
- save pending/success/failure/conflict/stale;
- network timeout/cancel;
- Teresa unavailable z pełną manualną ścieżką;
- brak infinite spinner, blank canvas, raw stack, fake success i silent failure.

Awaria KPI nie może blankować ROI/OKR i analogicznie.

## 13. Obowiązkowy screenshot/capture manifest

Dla każdego rejestru:

- tabela pełna;
- grid, jeśli dostępny;
- aktywne filtry i column settings;
- bulk selection;
- kebab i context menu, jeśli zadeklarowane;
- preview;
- full tool overview;
- domain editor/work state;
- Teresa proposal oraz accept/reject;
- empty/loading/error+retry/locked/archive/forbidden;
- personal i organization view;
- reviewer/manager i restricted outsider proof;
- dark/light, PL/EN, 1440/1280 oraz diagnostyczne 1600/1920.

Dodatkowo:

- KPI deviation/action/effectiveness;
- ROI Approved/Forecast/Actual, approval, evidence i post-completion realization;
- OKR Objective+KRs, check-in, progress-confidence divergence i reflection.

Każdy capture zapisuje SHA, route, viewport, zoom, theme, locale, timestamp, environment, org, user/role, object IDs, data provenance i scenario/state.

## 14. Runtime compare procedure

1. Zapisz baseline i candidate SHA, environment, route, user/org/data IDs.
2. Porównuj te same scenariusze, nie przypadkowe screenshots.
3. Referencją jest kanon/golden anatomy, nie stary wadliwy Results.
4. Sprawdź live DOM/computed styles dla sticky, overflow, focus, width i colors.
5. Sprawdź console i network; brak ukrytych 4xx/5xx/retry storm.
6. Każda akcja trafia raz do właściwego endpointu i tego samego aggregate.
7. Reload, restart i cold reopen zachowują prawdę i kontekst listy.
8. Screenshot z innego SHA jest `HISTORICAL`.

## 15. Minimalny evidence packet

- objective/scope/surface IDs;
- baseline, candidate, branch/worktree i dirty-tree disclosure;
- file allowlist vs rzeczywiście zmienione pliki;
- Gate RN-G0–G7 matrix;
- Epic/feature/AC ledger;
- migration/schema checksum;
- pełne komendy testów, exit codes i log paths;
- skipped/flaky/failed tests;
- API requests/responses;
- realDB IDs/versions i before/after/reload;
- event/outbox/audit/MyWork/Decision IDs;
- user A/user B/outsider proof;
- Teresa sources/proposal/disposition/audit;
- screenshot manifest;
- DOM/a11y/computed-style evidence;
- cold reopen, projection rebuild, backup/restore/rollback;
- known limitations z literalnym statusem;
- niezależny technical i visual verdict.

## 16. Test commands

Wykonawca najpierw weryfikuje aktualne scripts w `package.json`; nie zakłada historycznych nazw. Minimalna finalna rodzina obejmuje:

```text
git diff --check
npm run type-check
npm run build
npm run lint
npm run test:unit
npm run test:component
npm run test:integration
npm run test:security
npm run test:e2e
npm run test:performance
npm run test:skip-scan
npm run evidence:check
```

Do tego dochodzą nowe targetowane Results Next suites: domain, API contract, migrations, known-answer ROI, permissions, Teresa evals, realDB, cold reopen, visual/a11y i cross-domain E2E. Pełny suite nie może ukryć skipped albo mocked-only testów.

## 17. Waivery, regresje i ważność dowodu

- P0/P1 blokuje gate.
- P2/P3 może zostać odroczone wyłącznie z ownerem, terminem, wpływem i formalnym przyjęciem ryzyka.
- Brak waivera dla tenant isolation, utraty danych, approval integrity, immutable history i silent AI write.
- Zmiana kodu, migracji, policy, shared component lub runtime po capture unieważnia zależny dowód.
- Każda naprawa wymaga targetowanego retestu oraz przekrojowej regresji wpływu.

## 18. Terminal Definition of Done

Cały Results Next może otrzymać `ACCEPTED_TERMINAL` wyłącznie, gdy:

1. wszystkie D01–D15 i obowiązkowe kryteria Master/KPI/ROI/OKR/cross-domain mają PASS;
2. RN-G0–RN-G7 mają PASS;
3. exact candidate SHA jest wdrożony do jawnie nazwanego terminalnego acceptance environment; client SHA, server SHA, migration/schema checksum i evidence manifest są zgodne;
4. golden flows wykonano z realnym backendem i realDB, dla wielu ról, po restarcie i cold reopen;
5. clean install, realistic-copy migration, backup/restore i rollback/flag-off mają dowody;
6. nie ma hidden mocks, legacy writes, fake success ani kontraktowych fallbacków;
7. outbox replay, projection rebuild, idempotency i concurrency mają PASS;
8. security, Teresa safety, accessibility, visual/CX, PL/EN, dark/light i breakpointy mają PASS;
9. monitoring/runbook i evidence manifest są kompletne;
10. brak otwartego P0/P1 oraz `PARTIAL`, `BLOCKED` lub `EVIDENCE_MISSING` w obowiązkowym zakresie;
11. niezależny review Codex zaakceptował kandydata;
12. wymagany finalny odbiór wizualno-biznesowy Foundera został zapisany.

### 18.1 Complete implementation candidate dla Claude

Ponieważ Claude nie ma domyślnej autoryzacji do push/deploy, jego pełny DoD poprzedzający niezależny review jest osobny od `ACCEPTED_TERMINAL`:

- cały kod, migracje, testy, UI/CX, runbook i evidence przewidziane dla programu są ukończone;
- wszystkie mandatory feature/AC mają direct candidate evidence na jednym integrated SHA;
- lokalny/izolowany real-backend i realDB runtime, restarty i cold reopen przechodzą;
- nie istnieje otwarty P0/P1 ani obowiązkowy brak implementacyjny;
- jedyne elementy pozostawione Codex to niezależna reprodukcja, autoryzowany push/deploy do nazwanego acceptance environment oraz końcowy terminal/Founder verdict.

Taki handoff otrzymuje status `IMPLEMENTED_EVIDENCED_CANDIDATE`, nigdy `ACCEPTED_TERMINAL`.

Przed niezależnym review wykonawca może ogłosić wyłącznie kompletnego kandydata do odbioru, nigdy terminalne przyjęcie produktu.

Jeżeli choć jeden obowiązkowy warunek nie jest spełniony, wynik pozostaje `NO_GO`, `PARTIAL`, `BLOCKED` albo `EVIDENCE_MISSING`.
