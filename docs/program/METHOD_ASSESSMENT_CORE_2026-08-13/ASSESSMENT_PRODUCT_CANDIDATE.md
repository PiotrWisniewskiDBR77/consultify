# ASSESSMENT — kandydat produktowy

> Przekazanie do **Codexa**. Zespół: Assessment / Shared Method Core (Opus + 12 przebiegów Sonnet).
> Dokument uzupełniany do końca fali; każda pozycja ma dowód albo jawny status.

---

## 1. SHA i bramki

| Pole | Wartość |
| --- | --- |
| Baseline | `f3e7df565e` (== `origin/demo`) |
| Contract SHA (kernel zamrożony) | `e3b8be6cd7` |
| Poprzedni checkpoint (A9) | `0f4a1a53a6` |
| **Candidate SHA** | `b46fb18602` |
| Commitów od baseline | **111** |
| `git status --porcelain` | 0 |
| Gałęzi zdalnych z HEAD | **0** — zero push |

### Kanoniczne bramki (skrypty, nie ad-hoc)

```
npm run test:method-core:server   # --no-file-parallelism, RUN_DB_TESTS=1, MOCK_DB=false
npm run test:method-core:front    # --exclude 'server/**'
```

| Bramka | Exit | Wynik |
| --- | ---: | --- |
| serwer (realny PostgreSQL) | **0** | **161 / 161** (13 plików) |
| front | **0** | **305 / 313** (8 skipped = testy live za flagą `RUN_TERESA_LIVE_TESTS`) |
| SIRI | **0** | **61 / 61** |
| Teresa live (żywy serwer, przebieg Opusa) | **0** | **8 / 8** |

★ **Stabilność bramki serwera dowiedziona co do zakresu**, nie zaklepana:
13 plików testowych na dysku = 13 raportowanych, **0 pominiętych** (G14).
Migotanie (`socket hang up` przy 13 równoległych plikach dzielących pulę PG)
rozwiązane **ograniczeniem współbieżności, nie retry**.

---

## 2. Co jest dowiezione — z dowodem

| Cel | Stan | Dowód |
| --- | --- | --- |
| **CEL 2** — artefakty po restarcie | **DOWIEZIONE** | 9 endpointów GET (outputs, revisions, reports, presentations, drafts, lineage), paginacja, deterministyczne sortowanie, tenant isolation. Weryfikacja Opusa: wszystkie **200**, dwa identyczne zapytania → identyczna odpowiedź (G16) |
| **CEL 3** — role i approval | **DOWIEZIONE** | pełny łańcuch **bez ani jednego ręcznego SQL**; samonadanie `approver` → **403** (zadziałało także przeciw Opusowi); approval związany z **dokładną rewizją** — trail starej rewizji `[APPROVED, SENT_BACK]`, nowej pusty (G16) |
| **CEL 4** — offline/recovery | **DOWIEZIONE (8 stanów)** | `SERVER·SAVING·SAVED·OFFLINE·RECOVERY_DRAFT·CONFLICT·RECONNECTING·RECOVERED`, 8 zrzutów. `CONFLICT` pokazuje diff i **nie nadpisuje** |
| **CEL 5** — Teresa | **DOWIEZIONE** | cykl Intent→Preview→Commit **na żywym serwerze 8/8**; 5 zakazów dowiedzionych jako **nieistnienie ścieżki** (5 niezależnych warstw); provenance `actorKind='teresa'` + `actorUserId` człowieka |
| **CEL 6** — voice | **CZĘŚCIOWO** | ścieżka transcript→draft→preview→commit działa, ten sam callback co ręczne pisanie, provenance `{source:'voice'}`. **Realne audio: NOT VERIFIED** (headless, brak mikrofonu) |
| **CEL 9** — SIRI | **DOWIEZIONE technicznie** | 16D×Bands 0–5, no-leapfrog z komunikatem, **80:20 jawnie widoczne** z cytatem `Module 5 §3.7`, rationale wymagane, assessor proponuje / uczestnik zatwierdza, TIER na osobnym ekranie. **0/16 wymiarów ma treść** — `EVIDENCE_MISSING`, licencja nietknięta |
| **CEL 10** — migracje i regresja | **DOWIEZIONE** | fail-closed (`RUN_DB_TESTS`, `MOCK_DB`, realny PG, `current_database()`, `current_schema()`); kontrola negatywna **z plikiem kontrolnym** dowodzącym, że detektor nie jest tautologią; pre-existing dowiedzione przebiegiem na `origin/demo` (`diff` = 0) |
| **A10** | **WYKONANY** | pierwszy odbiór przez Sonnet (reguła #7), **109 zrzutów**, rejestr: 0×P0, 2×P1, 3×P2, 14 PASS, 6 NOT VERIFIED |
| **CEL 8** — MPQ | **CZĘŚCIOWO** | Report Light/Dark **30/30 PASS**, Presentation Light/Dark **30/30 PASS**, **Work View 22/30 FAIL** (próg 27) |

---

## 3. ★ Defekty znalezione i naprawione w tej fali

### Znalezione przez agentów **w cudzym kodzie** (wartość modelu wieloagentowego)

| Waga | Defekt | Skutek gdyby przeszedł |
| --- | --- | --- |
| **P0** | `confirmBand()` (SIRI) zapisywał `DECISION_APPROVED`, a most freeze→Output czyta **wyłącznie** `ANSWER_CONFIRMED` | **zamrożony Output był cały pusty — po cichu** |
| **P1** | `GET /api/method/packs` → **500**; `pg` zwraca `timestamp` jako `Date` mimo typu `string` | **Library nie działa** |
| **P1** | `{ id: h.id, ...h }` → `TS2783` | **blokuje realny build**; `vitest`/`esbuild` nie sprawdzają typów |
| **P1** | przycisk „Zamroź (tylko approver)" sprawdzał tylko `session.state`, **nigdy roli** | UI oferuje akcję, która zawsze kończy się odmową |

### Znalezione przez Opusa przy integracji

| Defekt | Dlaczego agent nie mógł go zobaczyć |
| --- | --- |
| bramka serwera **migotała** po scaleniu | 13 równoległych plików wyczerpywało pulę PG; każdy agent widział tylko swój podzbiór |
| **`MOCK_DB=true` na produkcji** włączało atrapę bazy | ścieżka mocka to **jedyna**, która ustawia `dbReady` z pominięciem migracji |
| **dwa defekty instalacji od zera** | kolejność leksykalna (konsument przed producentem, 2 inwersje) **oraz** ciche wykluczenie pliku ze słowem `demo` w nazwie — runner dawał `exit 0` przy pominiętej migracji |

---

## 4. Co NIE jest dowiezione — nazwane wprost

| Pozycja | Status | Powód |
| --- | --- | --- |
| **Work View MPQ** | **FAIL 22/30** | `LiveMatrix`: „jeszcze nieodpowiedziane" wygląda jak „brak dowodu"; goła siatka L1–L7 czyta się jak arkusz |
| **realne audio (voice)** | NOT VERIFIED | środowisko headless, brak mikrofonu; ścieżka transcript **działa** |
| **treść metodyczna DRD** | **BLOCKED** | `misScoringTraps` 0/233, pola pomocy pytania 0/699 — **brak źródła w repo**; uzupełnia właściciel metodyki, nie AI (COORD-07) |
| **treść metodyczna SIRI** | **BLOCKED licencyjnie** | Module 2 str. 32–69 — „no part may be reproduced"; 0/16 wymiarów, `readiness` = `draft` |
| **prawdziwy ekran Library** | NOT VERIFIED | istniejący `screen=library` to jawny harness zrzutowy, nie produkcyjny ekran |
| **D2/D3/D4 z A10** | zgłoszone (P2) | hydratacja `LiveMatrix`; `onResolutionAction` pusty stub; „Gotowe do zamrożenia" przy 1/39 dowodów |

---

## 5. Readiness — rozdzielone

| Wymiar | Stan | Uzasadnienie |
| --- | --- | --- |
| **Technical** | **wysokie** | 161/161 serwer · 305/313 front · realny PostgreSQL · idempotencja · CAS/409 · tenant isolation · fail-closed · instalacja od zera dowiedziona |
| **Methodology** | **ZABLOKOWANE** | DRD `methodology_review`, SIRI `draft`; `canStartSession()` = **false** dla obu — kod **egzekwuje**, nie obiecuje |
| **Legal / licensing** | **ZABLOKOWANE dla SIRI** | treść per wymiar objęta klauzulą zakazu reprodukcji; **zero** wygenerowanej treści licencjonowanej |
| **Runtime** | **warunkowe** | wszystko za flagami domyślnie **OFF**: `methodWorkspaceShellV1`, `drdMethodWorkspaceSliceV1`, `drdHttpSourceOfTruthV1`, `SIRI_PM_V2`, `drdScoringV2` |

---

## 6. Zakazy — kontrola

**Zero** push · **zero** merge do `demo`/`main` · **zero** deploy · **zero** operacji na
współdzielonej lub produkcyjnej bazie. Wszystkie migracje uruchamiane wyłącznie na
**disposable** kontenerach (`mac-pg-*`, `pgvector/pgvector:pg15`).
Główny worktree repo **nietknięty** przez całą pracę.
