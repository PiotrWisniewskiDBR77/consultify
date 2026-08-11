# Prompt dla następnej sesji — Finance v3 Complete Product Integration

> Skopiuj poniższą treść jako pierwszą wiadomość do nowej sesji.

---

Przejmujesz program **Finance v3 — Complete Product Integration** w repo Consultify.
Pracujesz jako **orkiestrator na Opusie**; całe kodowanie delegujesz do **Sonnetów**,
jeden worktree = jeden agent.

## ZACZNIJ OD PRZECZYTANIA W CAŁOŚCI

Na gałęzi `codex/finance-v3-complete-product-integration` (worktree `~/consultify-wt/fv3-product`):

1. `docs/validation/finance-v3/generated/gate-e/SESSION_HANDOFF_2026-08-11_PRODUCT_INTEGRATION.md`
   — **stan, pułapki, praca zatrzymana w locie, blokery zewnętrzne.**
2. `docs/validation/finance-v3/generated/gate-e/FINANCE_V3_EXECUTION_LEDGER.md`
   — rejestr pakietów, zależności, punkty odniesienia.
3. Raporty pakietów w tym samym katalogu: `PKG_M_INVENTORY`, `PKG_B_API`, `PKG_A_DETERMINISM`,
   `PKG_B2_DOMAIN_API`, `PKG_C_UI_PLATFORM`.
4. Kanon: `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`,
   `FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` (**tam są decyzje DEC-FIN-001…012**),
   `OWNER_REVIEW_REGISTER_2026-08-09.md` (**22 wymagania właścicielskie**),
   `docs/ui-standards/*`, `CLAUDE.md`.

**Kanon czytasz sam. Nie deleguj tego subagentom.**

## PUNKT STARTU

- Gałąź integracyjna: **`codex/finance-v3-complete-product-integration` @ `45c39d68d0`**
  (+ commit dokumentacyjny z handoffem).
- Stan: migracje STRICT **exit 0 / 637**, `tsc -p server` **exit 0 zero linii**,
  **32 endpointy** `/api/v8/finance-v2/*` (na starcie poprzedniej sesji: **2**).
- **NOT PUSHED / NOT MERGED / NOT DEPLOYED / STAGING NOT VERIFIED / PRODUCTION NOT VERIFIED.**

## ZAKAZ BEZWZGLĘDNY

`codex/finance-v3-closeout-fanin` @ `19b4b06934` — **ZAMROŻONA**, zaakceptowana przez właściciela.
Nie modyfikować, nie scalać, nie pushować, nie wdrażać. Zero połączeń poza `127.0.0.1`.
Zero produkcyjnej i demo bazy. Migracje **wyłącznie addytywne**.
**Zakazane: `git reset --hard`, `git clean`, `git stash`** (stash jest współdzielony między worktree).

## PIERWSZE DZIAŁANIE — domknięcie fali C

Cztery pakiety zostały przerwane w locie i **zabezpieczone commitami `wip(...)` oznaczonymi
jako UNVERIFIED**. Kolejność:

1. **B3 — Valuation API** (`codex/fv3p-b3-valuationapi` @ `9604652e27`).
   Doszedł najdalej: **53 endpointy** na swojej gałęzi (21 nowych `/finance-v2/valuation/*`).
   Ma **napisane, ale nieuruchomione** dwa pliki testów. Domknij: uruchom je, udowodnij montaż
   wzorcem **`404` z `code:'NOT_FOUND'` vs `404` bez `code`** (`401` niczego nie dowodzi — auth
   stoi przed routingiem), macierz cross-tenant z **niezależnym odczytem SQL**, oraz **twardy
   dowód, że metoda bez kompletnych danych zwraca `N/A`, a NIGDY `PLN 0`** (DEC-FIN-005).
2. **D, E, F** — dokończ piony produktowe. **F ma dodatkowo zamknąć sześć naruszeń V-1…V-6**
   z §5A handoffu i dostarczyć zrzut **przed/po**.
3. **Fan-in** — spodziewaj się konfliktu w `src/services/api/financeV2.api.ts` i `.types.ts`
   (rozszerzają je równolegle D, E i F). Rozwiąż **zachowując wszystkie** rozszerzenia.
4. **G (Prediction)** i **H (Valuation)** — dopiero po domknięciu B3.
5. **I** (a11y/design-system), **K** (browser E2E + dowody wizualne), **J** (RealDB/security),
   **L** (adwersaryjny CFO/model-risk).
6. **Pełny przebieg na jednym candidate SHA** — skrypt `single_sha_evidence_run.sh`.

## REGUŁY, KTÓRE SIĘ SPRAWDZIŁY — stosuj bez wyjątku

- **Weryfikację zleca agent INNY niż autor.** Tak wyszła mutacja międzytenantowa `claim()`,
  której pierwotny pomiar nie zauważył, bo zaufał założeniu ADR o puli workerów, **która nie istnieje**.
- **Kontrola negatywna obowiązkowa.** Zielony test, którego nie da się zaczerwienić, niczego
  nie dowodzi. Uwaga na **obronę wielowarstwową** — cofnięcie serwisu potrafi nie odtworzyć
  defektu, bo broni już klucz obcy.
- **Przy defektach zależnych od kolejności z Postgresa nie opieraj dowodu na powtarzaniu
  przebiegów** — baza nie ma obowiązku rozjechać się na żądanie. Uzupełnij **rachunkiem
  permutacyjnym**. (Pułapka: pierwsza losowa permutacja potrafi przypadkiem pokryć się
  z kolejnością bazową — zweryfikuj ją skryptem, zanim użyjesz jako kontroli.)
- **Nie akceptuj deklaracji subagenta.** Czytaj diff, sprawdzaj allowlistę, licz endpointy sam.
  W tej sesji jeden agent zadeklarował 2 zmienione pliki serwisowe, a zmienił 6 (były poprawne,
  ale rozbieżność trzeba było wychwycić).
- **★ Reguła #7 CLAUDE.md: sam obejrzyj zrzuty przed właścicielem.** W tej sesji sześć naruszeń
  kanonu wyszło **z obejrzenia obrazka**, a nie było w żadnym raporcie tekstowym.
- **`EVIDENCE_MISSING` pisz wprost.** Statusy: `PASS`/`FAIL`/`PARTIAL`/`BLOCKED_EXTERNAL`/
  `EVIDENCE_MISSING`/`NOT_APPLICABLE`. **Nie używaj `READY`/`DONE`**, jeśli obowiązkowa bramka
  nie przeszła.
- **Commit po każdym etapie** — sesje bywają przerywane.

## DWANAŚCIE PUŁAPEK ŚRODOWISKOWYCH

Są w §10 handoffu. Najgroźniejsze trzy:
- bramka DB wymaga **trzech** zmiennych naraz, inaczej podłączysz się do cudzej bazy
  **zamiast się pominąć**;
- **`tsc` pada z exit 134 (OOM) i przy zerze błędów wygląda na sukces** — sprawdzaj kod wyjścia;
- **`server/tsconfig.json` wyklucza `**/*.test.ts`** → zmiana sygnatury funkcji nie ma **żadnej**
  automatycznej ochrony; po każdej grepuj wywołujących w `server/src` **oraz** `tests/`.

## CZEGO NIE DA SIĘ ZROBIĆ LOKALNIE

FC-12 (recenzent CFO) · aktywacja RLS (least-privileged rola DB na Railway — **superuser omija
RLS zawsze, nawet z `FORCE`**) · cutover/rollback/shadow parity (brak stagingu) · SLO produkcyjne
(rozrzut 9,3× na laptopie). **Nie próbuj — zapisz jako `BLOCKED_EXTERNAL`.**

**Do warstwy UI nie ruszaj bez decyzji Piotra na zrzutach** — reguła #7. Wszystko, co wizualne,
ma iść **za flagą domyślnie OFF** do jego akceptu.

Nie wracaj z kolejnym planem. Zacznij wykonywanie.
