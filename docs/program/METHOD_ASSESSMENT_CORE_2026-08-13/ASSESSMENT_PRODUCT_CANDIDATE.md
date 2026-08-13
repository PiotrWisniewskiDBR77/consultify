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
| **CEL 4** — offline/recovery | **DOWIEZIONE po korekcie** | 8 stanów: `SERVER·SAVING·SAVED·OFFLINE·RECOVERY_DRAFT·CONFLICT·RECONNECTING·RECOVERED`. Offline wywołany **realnie** (`page.context().setOffline`), nie `debugForceState`. Dwie karty + CAS: karta B dostaje `CONFLICT` z wersjami 3 vs 4, SQL potwierdza `version=4`, **zero duplikatu wiersza**. ★ Patrz korekta poniżej — `RECOVERED` był **nieosiągalny** |
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

### ★ Korekta wcześniejszego raportu — zielona bramka zatwierdzała brak funkcji

W poprzednim przekazaniu napisałem, że **CEL 4 jest dowieziony w komplecie (8 stanów)**.
To było **przeszacowane** i prostuję to tutaj, zanim ktokolwiek się na tym oprze.

| | |
| --- | --- |
| **Co było nie tak** | Stan `RECOVERED` był **nieosiągalny w realnym runtime**. `retryPending()` ustawiał `status:'recovered'`, a **następna linia** — `await this.refresh()` — nadpisywała go `'loading'` synchronicznie, w tym samym ticku JS, zanim React cokolwiek wyrenderował. Potem sukces ustawiał `'ready'`. |
| **Skutek dla użytkownika** | Nigdy nie zobaczył potwierdzenia, że jego zaległe zmiany zostały pogodzone z serwerem — **dokładnie w chwili, w której potrzebuje tego najbardziej**. `RecoveredBanner` i `acknowledgeRecovered()` były napisane i podłączone, ale **martwe**. |
| **★ Dlaczego bramka tego nie łapała** | Test o nazwie `CEL 4 scenario 3 — reconnect: RECONNECTING → explicit reconciliation → RECOVERED` kończył się asercją `expect(status).toBe('ready')`. **Test zatwierdzał brak stanu, który obiecywał w nazwie.** Drugi test miał ten sam błąd. Oba zielone. |
| **Jak to wyszło** | Dopiero **realny** offline (`page.context().setOffline`) + sonda `MutationObserver` z sygnaturami czasowymi: **zero wystąpień** badge'a w ponad 5 przebiegach. Osiem zrzutów, na których opierało się „dowiezione", pochodziło z `debugForceState` — **wymuszony stan nie dowodzi osiągalności**. |
| **Naprawione** | `refresh({ preserveStatus })`; oba testy poprawione tak, by asercja odpowiadała nazwie. SIRI nie ma stanu `recovered`, więc defekt jest wyłącznie DRD. |

**Wniosek do zapamiętania:** żądanie koordynatora „rzeczywisty offline, nie wyłącznie
`debugForceState`" nie było formalnością — samo w sobie wykryło brakującą funkcję,
której nie widziało 305 zielonych testów.

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
| **Work View MPQ** | **naprawione, ocena w toku** | obie przyczyny usunięte (patrz §7); niezależna re-ocena Light/Dark trwa — **wynik wpiszę dopiero po zrzutach, nie z góry** |
| **realne audio (voice)** | NOT VERIFIED | środowisko headless, brak mikrofonu; ścieżka transcript **działa** |
| **treść metodyczna DRD** | **BLOCKED** | `misScoringTraps` 0/233, pola pomocy pytania 0/699 — **brak źródła w repo**; uzupełnia właściciel metodyki, nie AI (COORD-07) |
| **treść metodyczna SIRI** | **BLOCKED licencyjnie** | Module 2 str. 32–69 — „no part may be reproduced"; 0/16 wymiarów, `readiness` = `draft` |
| **prawdziwy ekran Library** | NOT VERIFIED | istniejący `screen=library` to jawny harness zrzutowy, nie produkcyjny ekran |
| **D2/D3/D4 z A10** | zgłoszone (P2) | hydratacja `LiveMatrix`; `onResolutionAction` pusty stub; „Gotowe do zamrożenia" przy 1/39 dowodów |

---

## 4b. ★ Semantyka dowodu — defekt, którego nie widział żaden test

Przy naprawie MPQ Work View wyszło coś większego niż zgłoszone dwie usterki:
**te same cztery stany dowodu znaczyły co innego w trzech komponentach jednego ekranu.**

| stan | MethodNavigator | InterviewFocusPanel | LiveMatrix |
| --- | --- | --- | --- |
| `weak` | warning | warning | **neutralny** |
| `missing` | **neutralny** | warning | **warning** |
| `conflicting` | danger | danger | **warning** |

Konsultant przechodzący między lewą nawigacją, panelem wywiadu i macierzą widział
**bursztyn oznaczający trzy różne rzeczy**. Reguła kanonu „kolor nigdy sam nie niesie
informacji" była spełniona (teksty były poprawne wszędzie) — problem był gorszy:
**ten sam kolor ZNACZYŁ co innego**.

Żaden test tego nie łapał, bo każdy komponent był testowany osobno i każdy był
**wewnętrznie spójny**. Defekt istniał wyłącznie *pomiędzy* nimi.

Rozstrzygnięcie (`evidenceSemantics.ts` — jedno źródło prawdy + strażnik rozjazdu):
`complete` → success · `weak` → warning · `missing` → **neutralny** · `conflicting` → danger.

★ `missing` **musi** być neutralne: na starcie oceny **każdy** obszar ma `missing`.
Bursztyn dawał ścianę ostrzeżeń w sesji, w której nikt jeszcze nic nie zrobił źle —
i wypalał uwagę na ostrzeżenia, które coś znaczą.

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
