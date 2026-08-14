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
| **Candidate SHA** | `1024d892db` |
| Commitów od baseline | **135** |
| `git status --porcelain` | 0 |
| Gałęzi zdalnych z HEAD | **0** — zero push |

### Kanoniczne bramki (skrypty, nie ad-hoc)

```
npm run test:method-core:server   # --no-file-parallelism, RUN_DB_TESTS=1, MOCK_DB=false
npm run test:method-core:front    # --exclude 'server/**'
```

| Bramka | Exit | Wynik |
| --- | ---: | --- |
| serwer (realny PostgreSQL) | **0** | **170 / 170** (14 plików) |
| front | **0** | **329 / 337** (8 skipped = testy live za flagą `RUN_TERESA_LIVE_TESTS`) |
| obszary dotknięte (szerzej niż bramka) | **0** | **526 / 534** |
| instalacja od zera (świeży kontener) | **0** | 6 migracji `method_core` w kolejności, **14 tabel `method_*` potwierdzonych w `information_schema`** — nie kodem wyjścia |
| SIRI | **0** | **61 / 61** |
| Teresa live (żywy serwer, przebieg Opusa) | **0** | **8 / 8** |

★ **Stabilność bramki serwera dowiedziona co do zakresu**, nie zaklepana:
**14 plików testowych na dysku = 14 raportowanych, 0 pominiętych** (G14, przeliczone po S8).
Migotanie (`socket hang up` przy 13 równoległych plikach dzielących pulę PG)
rozwiązane **ograniczeniem współbieżności, nie retry**.

★ **Powtarzalność zmierzona, nie założona**: trzy kolejne przebiegi bramki dały
**identyczny wynik `170/170`, `14/14`, exit 0** — bez pojedynczego migotnięcia.

★★ **Sam się na tym złapałem i prostuję.** Napisałem najpierw, że „w konfiguracji
nie ma ani jednego `retry`". **To była nieprawda** — `vitest.config.ts:297` ustawia
`retry: process.env.CI ? 3 : 1`, więc lokalnie bramka **ponawiała raz**, a w CI
ponawiałaby **trzy razy**. Dokładnie mechanizm, którego koordynator zakazał
(„nie ukrywaj migotania przez retry"), działał pod spodem, a ja ogłosiłem jego brak.

Dowód po korekcie: **dwa przebiegi z `--retry=0` → `170/170`, exit 0, zero zdarzeń
ponowienia**. Stabilność jest realna — ale dowiedziona dopiero teraz, wcześniej
była tylko zadeklarowana. Kanoniczny skrypt bramki ma teraz `--retry=0` na stałe,
żeby nie dało się tego przeoczyć ponownie.

★ **Bramka jest fail-closed i to widać**: jeden przebieg z **błędnym hasłem** do bazy
skończył się `28P01 FATAL` i `101 passed | 60 skipped` — czyli **głośną porażką**,
a nie cichym podstawieniem atrapy. Dokładnie tego wymaga CEL 10.

### Pełna regresja frontu — zmierzona, nie zadeklarowana

Ta sama komenda uruchomiona na HEAD i na baseline `f3e7df565e` (osobny worktree
porządkowy, `node_modules` podlinkowane, worktree skasowany po pomiarze):

| | HEAD | baseline `f3e7df565e` |
| --- | ---: | ---: |
| plików testowych czerwonych | **32** | **32** |
| testów czerwonych | **88** | **88** |
| testów zielonych | **4 521** | 4 149 |
| testów łącznie | **4 618** | 4 238 |

**Lista 32 czerwonych plików jest IDENTYCZNA na obu stronach** (`comm` po
posortowanych nazwach: zbiór „tylko na HEAD" = **pusty**).

| Kategoria | Liczba |
| --- | ---: |
| **wprowadzone przez tę falę** | **0** |
| **pre-existing** (czerwone też na `origin/demo`) | **32 pliki / 88 testów** |
| dodane przez tę falę i zielone | **+380 testów** |

★ Pierwszy przebieg tego porównania dał mi „0 regresji" z **zepsutego wyciągania**
nazw plików (porównałem zły plik logu). Wynik zgadzał się z oczekiwaniem, więc
tym łatwiej było go przyjąć — powtórzone na właściwej parze logów.

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
| **CEL 1** — DRD jako produkt | **DOWIEZIONE** | pełny E2E **19/19 PASS** z **dwoma restartami API+FE** (#1 9022 ms, #2 9024 ms), **bez ani jednego ręcznego SQL**. `POST /sessions/:id/reopen` przez HTTP; lineage potwierdzony SQL-em: sesja root `frozen` + dwie rewizje wskazujące na nią, Output v2 z `revision_of_output_id` → v1, `contentHash` zamrożonego Output **identyczny przed i po reopen** |
| **A10** | **WYKONANY** | pierwszy odbiór przez Sonnet (reguła #7), **109 zrzutów**, rejestr: 0×P0, 2×P1, 3×P2, 14 PASS, 6 NOT VERIFIED. **D1/D3/D4 naprawione**, D2 otwarty |
| **CEL 8** — MPQ | **CZĘŚCIOWO** | Report Light/Dark **30/30 PASS**, Presentation Light/Dark **30/30 PASS**. Work View: przyczyny FAIL **usunięte i obejrzane na realnym renderze**, ale **punktacji nie wystawiam — jestem autorem poprawki** (patrz §4c) |

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

### ★ Dwa defekty zaufania z A10 — naprawione, bo obie kłamały użytkownikowi

| Defekt | Co widział użytkownik | Dlaczego to groźne |
| --- | --- | --- |
| **D4** — „Gotowe do zamrożenia" | zielony napis przy **1/39** odpowiedzianych jednostek | Technicznie prawda (zamrozić się dało — brak blokerów), ale czytało się jako **„ocena skończona"**. Prosta droga do zamrożenia pustej oceny u klienta. Kanon: **pewność nie zastępuje kompletności**. Teraz zielone tylko przy pełnym pokryciu, inaczej neutralne „Brak blokerów — ocena niekompletna (1/39)". |
| **D3** — cztery martwe przyciski | „Przypisz pytanie", „Poproś o dowód"… klik → **nic** | Wszystkie trzy ekrany podawały `onResolutionAction: () => {}`. Martwy przycisk jest **gorszy niż jego brak**: kosztuje zaufanie dokładnie w chwili, gdy użytkownik przyznaje się do luki wiedzy. Teraz `availableActions` jest **wymagane** — nowy ekran musi zadeklarować, co umie. |

★ **D4 nie był pokryty żadnym testem, a domyślny fixture to `12/39` z zerem blokerów** —
fixture kodował scenariusz defektu i nikt na niego nie patrzył. Sprawdziłem, że nowy test
**nie jest pusty**: na starej logice **pada**, na nowej przechodzi.

★ Przy D3 wymagalność propu natychmiast wywaliła kompilator na 6 miejscach —
**ta friction była celem**, nie efektem ubocznym.

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
| **Work View MPQ — punktacja** | **BEZ NIEZALEŻNEJ OCENY** | obie przyczyny FAIL usunięte i **zweryfikowane wzrokiem na realnym renderze** (zrzuty Light+Dark), ale **punktacji nie wystawiam sam** — jestem autorem poprawki. Niezależny odbiór **nie doszedł do skutku** (przyczyna środowiskowa, opis niżej) |
| **realne audio (voice)** | NOT VERIFIED | środowisko headless, brak mikrofonu; ścieżka transcript **działa** |
| **treść metodyczna DRD** | **BLOCKED** | `misScoringTraps` 0/233, pola pomocy pytania 0/699 — **brak źródła w repo**; uzupełnia właściciel metodyki, nie AI (COORD-07) |
| **treść metodyczna SIRI** | **BLOCKED licencyjnie** | Module 2 str. 32–69 — „no part may be reproduced"; 0/16 wymiarów, `readiness` = `draft` |
| **prawdziwy ekran Library** | NOT VERIFIED | istniejący `screen=library` to jawny harness zrzutowy, nie produkcyjny ekran |
| **reopen z listy artefaktów** | **NIE DOWIEZIONE** | S8 zapisał to jako „przycisk wciąż nieklikalny" — **sprostowanie**: `DrdArtifactsPanel` nie ma **ani jednego** `<button>` ani `onClick`, jest w całości tylko do odczytu. Reopen działa przez HTTP i z ekranu warsztatu (E2E krok 11), ale **z listy artefaktów nie da się go wywołać**. Dla następnego: to nie jest podpięcie handlera, to nowa funkcja (kontekst sesji + potwierdzenie + nawigacja) |
| **akcje `assign_question` / `request_evidence`** | **NIE DOWIEZIONE — jawnie** | wymagają przepływów, których nie ma. **Nie wymyślam ich.** Przyciski nie są renderowane, zamiast być renderowane i nic nie robić |
| **D2 z A10** | otwarte (P2) | ostrzeżenie hydratacji `LiveMatrix` |

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

## 4c. Work View MPQ — co realnie widziałem, a czego nie oceniłem

**Zrzuty:** `docs/qa/mpq-workview-2026-08-13/` — `workview-{light,dark}.png`,
`matrix-{light,dark}.png`. Renderowane z **realnego** harnessu na kodzie tej gałęzi,
obejrzane osobiście. Reguła #7 spełniona: właściciel nie jest pierwszym testerem.

**Obie przyczyny FAIL 22/30 są usunięte — widać to na zrzucie:**

| Przyczyna (S4b) | Stan |
| --- | --- |
| „jeszcze nieodpowiedziane" wygląda jak „brak dowodu" | komórka nieoceniona ma **kropkowaną neutralną** ramkę, luka dowodowa **przerywaną bursztynową**; legenda nazywa oba |
| goła siatka L1–L7 czyta się jak arkusz | każdy wiersz ma **`L2 → L4 · luka 2`**, a przy braku poziomu **`poniżej L1 → L3`** |

**Dodatkowo potwierdzone wzrokiem na żywym ekranie:**
- pasek stanu mówi **„Brak blokerów — ocena niekompletna (14/24)"** — poprawka D4 działa;
- czerwień występuje **dokładnie raz** (bloker `Jakość danych` L3), w obu motywach;
- Dark: granatowe tło, **zero białych/zapadniętych plam**, `luka` bursztynowa, `cel` zielony.

**Czego NIE zrobiłem: nie wystawiam punktacji.** Jestem autorem tej poprawki, a
sens reguły #7 i progu MPQ polega na tym, że **ocenia ktoś inny niż autor**.
Poprzednie 22/30 przyjąłem bez sporu właśnie dlatego, że przyszło z zewnątrz.

**Dlaczego niezależny odbiór nie doszedł do skutku (uczciwie):** agent oceniający
oddał **NIE ZWERYFIKOWANO** zamiast zmyślić punkty — i to była właściwa decyzja.
Zablokowało go środowisko, nie kod:
- `dev-render/main.tsx` importuje **nieistniejący** `./screens/tools-sesja-wyjscie`
  (potwierdziłem: pliku nie ma) — skaner Vite przechodzi przez cały wspólny rejestr;
- transformacja `src/index.css` trwała u mnie **94 sekundy** przy `load average 45,8`
  na 16 rdzeniach (dziesiątki równoległych `vitest`/`vite` z **innych** sesji).
  To nie deadlock, tylko skrajna kontencja — agent mierzył krótszym limitem i
  zinterpretował spowolnienie jako zawieszenie;
- demon iCloud (`bird`) miał nierozwiązane błędy synchronizacji na `.git/objects/*`
  — repo leży na iCloud Drive.

Obejście, które **zadziałało** i warto powtórzyć: własny config Vite z
`optimizeDeps.entries` ograniczonym do jednego harnessu + cierpliwość na pierwszy
transform CSS.

★ **Do domknięcia przez koordynatora:** niezależna punktacja Work View Light/Dark
wobec progu 27. Ekran jest gotowy do oceny, zrzuty leżą w repo.

---

## 5b. ★ BLOKER PRZED PROMOCJĄ — 192 MB w historii gałęzi

**To jedyna rzecz, którą trzeba załatwić zanim ta gałąź gdziekolwiek pojedzie.**

S8 zacommitował `docs/qa/e2e-full-2026-08-13/network.masked.har` — **192 MB**.
Maskowanie było **poprawne** (327 redakcji; sprawdziłem: zero `Bearer`, zero JWT —
trafienia `eyJ` to base64 **sourcemapy**, nie tokeny). Problem nie jest w treści,
tylko w rozmiarze.

- Plik **wypięty** z indeksu, dowód **zostaje na dysku** obok zrzutów.
- `*.har` dodane do `.gitignore`, żeby następny agent nie rozstrzygał tego od nowa.
- **Precedens**: S1b w tej samej fali świadomie nie commitował swoich HAR-ów (~19 MB
  każdy) z dokładnie tego powodu. Dwóch agentów, dwie decyzje — przyjąłem S1b.

★ **Blob nadal jest w historii tej gałęzi.** Usunięcie pliku nie usuwa obiektu.
Przed jakimkolwiek `push` trzeba albo oczyścić historię (`git filter-repo`), albo
odtworzyć gałąź bez tego commita. Inaczej **każdy przyszły klon repo** ciągnie 192 MB
za jeden plik dowodowy z jednego dnia. `origin/demo` jest celem deployu — to nie
jest miejsce na taki balast.

Zgłaszam to jako **decyzję koordynatora**, nie robię czyszczenia historii sam:
przepisanie 122 commitów dotyka gałęzi, na których stoją worktree innych agentów.

---

## 6. Zakazy — kontrola

**Zero** push · **zero** merge do `demo`/`main` · **zero** deploy · **zero** operacji na
współdzielonej lub produkcyjnej bazie. Wszystkie migracje uruchamiane wyłącznie na
**disposable** kontenerach (`mac-pg-*`, `pgvector/pgvector:pg15`).
Główny worktree repo **nietknięty** przez całą pracę.
