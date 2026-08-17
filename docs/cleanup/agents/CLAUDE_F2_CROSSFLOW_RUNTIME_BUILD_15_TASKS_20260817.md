# Claude F2 — Cross-flow Runtime Build (15 accountable tasks)

## Prompt do uruchomienia od zera

Jesteś szefem toru **Claude F2 / Cross-flow Runtime Build**. Pracujesz jako
podwykonawca głównego konstruktora Codex. **Opus zarządza, rozstrzyga architekturę
i recenzuje; Sonnety wykonują małe, jawnie ograniczone pakiety.** Twoim zadaniem
nie jest kolejny audyt. Masz budować brakujące produkcyjne writery, consumery,
receipty i recovery loops, uruchamiać je na świeżej bazie oraz brać
odpowiedzialność za wynik aż do pełnego DoD każdego owner-free zadania.

Samo znalezienie luki, napisanie raportu, dodanie testu oczekującego na przyszły
kod albo uzyskanie zielonego wyniku przez skip/mock **nie zalicza zadania**.

## Start, branch i zakaz konfliktów

- Repo źródłowe: `/Users/piotrwisniewski/Developer/consultify-recovery-canonical-20260816`
- Bazowy commit: `eb310fb344d3339c67cad81188ce13c6f950d100`
- Utwórz osobny worktree i branch: `codex/claude-f2-crossflow-runtime-build-20260817`.
- Nie kontynuuj starego brancha `codex/claude-next-crossflow-qualification` i nie
  cherry-pickuj jego dwóch commitów hurtowo. Jego raport jest historycznym
  materiałem triage, nie aktualnym SSOT.
- Nie dotykaj obecnie budowanego pakietu `EXE-MVP-ACTIONS-001`, UI-CANON ani
  legacy-cutover. Jeśli plik jest w równoległym lease, zatrzymaj ten podpakiet i
  wystaw precyzyjny integrator request; nie obchodź lease'u alternatywnym writerem.
- Bez merge do kanonu, push, deploy, release, produkcyjnych sekretów i zmian
  polityki właściciela.

## Odpowiedzialność wykonawcza

- Dla każdego owner-free defektu: **reprodukcja RED → implementacja produkcyjna →
  negative controls → fresh PostgreSQL/Redis → cold restart → exact-SHA evidence →
  logiczny commit**.
- Jeśli task zawiera część owner-gated, budujesz całą neutralną technicznie
  infrastrukturę i oddajesz wyłącznie ostatni wybór jako `BLOCKED_OWNER`.
- Nie twórz drugiego równoległego właściciela danych. Najpierw wskaż istniejący
  canonical producer/table/route; consumer ma być addytywny, idempotentny i
  wersjonowany.
- Każdy status `DONE_CURRENT_SHA` wymaga rzeczywistego kodu runtime oraz dowodu
  zamontowanej trasy lub uruchomionego workera. Test samego serwisu nie wystarcza.

## 15 zadań

### Pakiet A — Public Interview delivery

1. Zbuduj brakujący publiczny, token-bound zapis odpowiedzi respondenta: token
   dystrybucji, expiry/revoke, session binding i brak ujawniania PII/tenant ID.
2. Dodaj obowiązkowy CAS/idempotency dla publicznych odpowiedzi, konflikt 409,
   missing precondition 428 oraz exactly-one winner przy 8 równoległych zapisach.
3. Udowodnij mounted HTTP: valid/expired/revoked/malformed token, respondent vs
   manager, cross-tenant, cold reopen i brak zapisu po odmowie.

### Pakiet B — Meeting evidence into governed execution

4. Napraw schemat/kontrakt `evidence_type`, aby zatwierdzony dowód ze spotkania
   mógł być powiązany z istniejącym canonical evidence ownerem bez omijania CHECK.
5. Zbuduj proposal → human approval → immutable meeting evidence receipt; żadnego
   bezpośredniego writer bypass ani `persist:true` false success.
6. Udowodnij maker-checker, tenant isolation, stale proposal, concurrent approval,
   immutable UPDATE/DELETE denial, cold restart i dokładnie jeden receipt.

### Pakiet C — Initiative/Execution durable delivery

7. Zinwentaryzuj aktualny canonical `runtime-v1` oraz osobny `case_core`; wybierz
   jednego właściciela dla tego adaptera i zapisz decyzję techniczną. Nie myl tych
   dwóch podsystemów i nie twórz trzeciego spine'u.
8. Zbuduj neutralny, wersjonowany Initiative → Execution delivery envelope i
   immutable ingress receipt. Nie wymyślaj mapowania biznesowego wymagającego
   decyzji właściciela.
9. Zbuduj consumer z `SKIP LOCKED`, lease, retry/exhaustion, stale reclaim,
   idempotency/collision i dead-letter telemetry; podepnij go do rzeczywistego
   bootstrap/cron, nie tylko eksportuj klasę.
10. Udowodnij producer→consumer przez restart procesu: tenant A dostarczony raz,
    tenant B nieruszony, unknown payload version fail-closed, cold readback oraz
    brak osieroconego skutku po wymuszonym błędzie receiptu.

### Pakiet D — Chat governed handoff consumer

11. Dla istniejących proposal/approval receipts `producer_kind=chat` zbuduj jeden
    target-owner consumer wybierany wyłącznie z jawnego, wersjonowanego target
    envelope. Nie zgaduj celu z tekstu rozmowy.
12. Zaimplementuj target allowlist, schema version, tenant/capability guard,
    exactly-once materialization i immutable receipt; unsupported target/version
    ma zakończyć się terminalnym, audytowalnym fail-closed.
13. Udowodnij mounted Chat proposal→independent approval→consumer→real target
    readback, retry/concurrency/restart/cross-tenant oraz brak artefaktu dla reject.

### Pakiet E — Governed Organization snapshot consumption

14. Zbuduj jawny kontrakt wyboru snapshotu dla Chat/Idea: `explicit version` albo
    `latest published`, exact `snapshotId/version/contentHash`; zabroń silent live
    `buildResolvedContext()` w ścieżce wymagającej zamrożonego kontekstu.
15. Udowodnij dwa rzeczywiste consumery (Chat i Idea): hash verification, deleted
    source survival, explicit/latest semantics, stale hash denial, cross-tenant,
    cold restart i niezmienny audit receipt. Jeśli wybór explicit-vs-latest jest
    niezatwierdzoną polityką, dostarcz oba fail-closed tryby i decision packet,
    pozostawiając tylko przełącznik `BLOCKED_OWNER`.

## Bezwzględne bramy DoD

1. **G0** — exact branch/base/HEAD, czysty start, path lease i zero foreign edits.
2. **G1** — pełny type-check, backend build, frontend build jeśli zmieniasz frontend,
   `git diff --check`; wszystkie exit 0 na końcowym SHA.
3. **G2** — jawny denominator testów, zero skip/todo/retry; baseline-vs-HEAD dla
   każdej czerwonej regresji.
4. **G3** — własny disposable pgvector PostgreSQL: strict from-zero, repeat 0,
   dry-run 0, wszystkie checksums zgodne. Redis realny tam, gdzie consumer go używa.
5. **G4** — dla tasków z mounted HTTP: real podpisany JWT albo real public token,
   produkcyjny router/middleware; `E2E_MODE`, `alg:none` i auto-seeded membership są
   niedozwolone jako dowód auth/RBAC/tenant.
6. **G5** — minimum: replay, changed-payload collision, stale CAS, 8-way race,
   tenant negative, forced downstream failure, no orphan, cold client i restart.
7. **G6** — `TASK_EVIDENCE.json` z exact product SHA, komendami, denominatorami,
   fixture IDs, controls, owner tables, rollback i literalnym werdyktem.

## Zasady statusów

- `DONE_CURRENT_SHA`: pełny produkcyjny runtime + wszystkie bramy danego tasku.
- `PARTIAL`: kod częściowy lub brak jednej wymaganej bramy; nazwij dokładny brak.
- `BLOCKED_OWNER`: tylko nieredukowalna decyzja produktowa/prawna/operacyjna po
  wykonaniu całej pracy technicznej niezależnej od decyzji.
- `FIX_REQUIRED`: znany defekt techniczny nadal istnieje.
- Fixture, harness, mapa kodu lub decision packet nigdy samodzielnie nie jest DONE.

## Handoff wymagany od szefa toru

- 15/15 w tabeli: status, commit, real code delivered, gates, exact blocker.
- Logiczne commity; czysty worktree; zero push/merge/deploy.
- `CROSS_FLOW_RUNTIME_HANDOFF.md` z diagramem producer→receipt→consumer→target,
  listą owner tables i wszystkimi aktywnymi worker bootstrap points.
- Lista utworzonych/usuniętych disposable zasobów i potwierdzenie braku wpływu na
  obce bazy/worktree.
- Oddzielnie: integrator allowlist/denylist i kolejność cherry-picków. Nie wolno
  żądać hurtowego merge całej gałęzi.

Pracuj do skutku. Jeśli wykonawca wraca wyłącznie z audytem, odrzuć rezultat i
odeślij go do implementacji. Ty jako Opus odpowiadasz za to, by każdy owner-free
defekt został naprawiony, a nie tylko nazwany.
