# ASSESSMENT_CORE_CANDIDATE

> Przekazanie do **Codexa** (koordynator programu), przez Piotra.
> Zespół: **Assessment / Shared Method Core** (Opus + 4 Sonnety).
> Data: 2026-08-13.

---

## Status — czytaj to najpierw

**`PARTIAL — FOUNDATION_VERIFIED / SCOPE_INCOMPLETE`**

Fundament wspólny i obie metodyki mają **dowiedzioną mechanikę**.
**Nie jest to kandydat do odbioru całego zlecenia** — warstwa produktowa
Assessmentu (Workspace, Live Artifact, Outputs/Reports/Initiatives, Teresa
podłączona do modułu, E2E, odbiór wizualny) **nie powstała**. Rozdział 6
wymienia to pozycja po pozycji, bez zaokrągleń.

Nie wykonano **merge do gałęzi głównej, push ani deploy** — zgodnie z zakazem.

---

## 1. Gałąź i SHA

| Pole | Wartość |
| --- | --- |
| Branch | `codex/method-assessment-core-20260813` |
| Baseline SHA | `f3e7df565e0da826ba110d85aad3c3c81a1087f1` (== `origin/demo`) |
| **Contract SHA** (zamrożona powierzchnia publiczna) | `e3b8be6cd706e2b563c84d0b5980f91d0eb8de5c` |
| **Candidate SHA** | `4b868a5863` |
| Worktree | `/Users/piotrwisniewski/.codex/worktrees/method-assessment-core` |
| `git status --porcelain` | **0 linii** |

Gałęzie robocze scalone do gałęzi zespołu (nie do gałęzi głównej repo):
`codex/mac-a2-kernel-20260813`, `codex/mac-a3-drd-20260813`,
`codex/mac-a4-siri-20260813`.

---

## 2. Diff — co dokładnie powstało

### Kernel wspólny (własność: Assessment/Core; konsumenci: Tools, Audits)

| Plik | Rola |
| --- | --- |
| `src/method-core/contracts/events.ts` | 18 eventów, append-only, siła dowodu E0–E4 |
| `src/method-core/contracts/session.ts` | maszyna stanów, role procesu, save-state |
| `src/method-core/contracts/methodPack.ts` | rejestr packów + **granica `MethodAdapter`** |
| `src/method-core/contracts/teresa.ts` | Intent → Preview → Commit |
| `src/method-core/contracts/index.ts` | jedyny dozwolony punkt importu |
| `server/src/method-core/contracts/*.ts` (5) | kopia lustrzana — patrz COORD-10 |
| `server/src/method-core/{db,MethodEventStore,MethodPackRegistry,MethodSessionService,TeresaProposalService,index}.ts` | runtime kernela |
| `server/migrations/20260813_method_core_kernel.sql` | 7 tabel, **wyłącznie addytywna** |

### Metodyki

| Plik | Rola |
| --- | --- |
| `src/method-core/methods/drd/compileDrdPack.ts` | kompilator DRD (39 obszarów, 233 poziomy, 699 pytań) |
| `src/method-core/methods/drd/drdAdapter.ts` | progresja · scoring · agregacja |
| `src/method-core/methods/siri/compileSiriPack.ts` | kompilator SIRI (**16 wymiarów jako źródło prawdy**) |
| `src/method-core/methods/siri/siriAdapter.ts` | no-leapfrog · 80:20 · nakładka TIER |
| `server/migrations/946_siri_16d_source_of_truth.sql` | **przygotowana, NIEURUCHOMIONA** (COORD-02) |

### Testy (12 plików)

`__tests__/` w `drd`, `siri`, `server/src/method-core` — w tym **trzy sondy
weryfikacyjne autorstwa Opusa**, niezależne od testów agentów.

---

## 3. Shared contract manifest

[`SHARED_CONTRACT_MANIFEST.md`](SHARED_CONTRACT_MANIFEST.md) — punkt wejścia dla
Tools i Audits: powierzchnia publiczna, zasady migracji, pliki wyłącznej
własności, instrukcja startu. Contract SHA: `e3b8be6cd7`.

---

## 4. Migracje

| Plik | Stan | Uwaga |
| --- | --- | --- |
| `20260813_method_core_kernel.sql` | w commicie, **nieuruchomiona** | 7 tabel, `CREATE TABLE/INDEX IF NOT EXISTS`, zero DROP/ALTER/DELETE |
| `946_siri_16d_source_of_truth.sql` | w commicie, **nieuruchomiona** | czeka na COORD-02 |

**Żadnej migracji nie uruchomiono na żadnej bazie.** Zachowanie na prawdziwym
Postgresie (partial unique index, `ON CONFLICT`, realny wyścig na `23505`) jest
**NOT VERIFIED**.

---

## 5. Testy i kody wyjścia — przebiegi własne Opusa

| Bramka | Polecenie | Exit | Wynik |
| --- | --- | ---: | --- |
| `method-core` łącznie | `npx vitest run src/method-core --config vitest.config.ts` | **0** | **131 / 131** (12 plików) |
| runtime serwera | `npx vitest run server/src/method-core` | **0** | **78 / 78** (5 plików) |
| type-check | `npx tsc -p <scoped tsconfig>` | **0** | **0 błędów** |

`131 = 53` (metodyki DRD + SIRI) `+ 78` (runtime serwera) — filtr `src/method-core`
dopasowuje po podciągu i objął także `server/src/method-core`. Podanie 131 jako
„testów frontu" byłoby zawyżeniem.

### Co te testy realnie dowodzą (sondy Opusa, nie deklaracje agentów)

- **DRD:** `aboveGap` **nie podnosi** `currentLevel` — `[1,2,4,5]` → `currentLevel=2,
  blockedAtLevel=3, aboveGapLevels=[4,5]`; brak dowodu → `needs_evidence`, nigdy `0`;
  skale **per oś** (1A/4A = 1–7, 5A = 1–6, 2A/7A = 1–5); determinizm dowiedziony
  **po ominięciu cache modułu** (802 744 znaki identyczne).
- **SIRI:** 16 jednostek, Bands 0–5, 8 filarów, **zero sierot**; no-leapfrog
  `[0,1,4]` → `currentLevel=1, blockedAtLevel=2`.
- **Kernel:** strażnik rozjazdu kontraktu **przechodzi na zgodnych plikach i UPADA
  po wstrzyknięciu rozjazdu** (test negatywny wykonany).
- **Oba packi:** `canStartSession()` = **false** — żadna metodyka nie może dziś
  wystartować sesji produkcyjnej, i jest to wymuszone kodem, nie obietnicą.

---

## 6. ★ Czego NIE dowieziono (zakres zlecenia vs stan faktyczny)

| Element zlecenia | Stan | Uwaga |
| --- | --- | --- |
| Wspólny kernel + kontrakty | **DOWIEZIONE** | zweryfikowane |
| DRD Method Pack + progresja/scoring/evidence | **DOWIEZIONE (mechanika)** | treść niekompletna → COORD-07 |
| SIRI 16D + Bands + 80:20 + no-leapfrog | **DOWIEZIONE (mechanika)** | 0/16 pytań → `readiness=draft` |
| TIER Prioritisation Matrix | **CZĘŚCIOWO** | nakładka gotowa; **silnik ma 3 defekty** → COORD-08 |
| Kernel rozszerzalny dla ADMA/CMMI/Lean | **DOWIEZIONE** | granica adaptera + uczciwa odmowa `EVIDENCE_MISSING` |
| **Method Workspace (UI)** | **NIE POWSTAŁ** | Interview Focus, Matrix Focus, Split |
| **Live Artifact / macierz round-trip** | **NIE POWSTAŁ** | — |
| **Teresa podłączona do Assessment** | **NIE POWSTAŁA** | dziś 0 trafień w `teresaActionManifest.ts` |
| **Voice** | **NIE PODŁĄCZONY** | hooki istnieją systemowo, nie w Assessment |
| **Outputs / Reports / Initiative Proposal** | **NIE POWSTAŁY** | — |
| **Testy component / integration / E2E** | **NIE POWSTAŁY** | tylko unit |
| **Odbiór ręczny UI/UX, Light/Dark, MPQ** | **NIE WYKONANY** | brak UI do oceny |
| **Uruchomienie migracji** | **NIE WYKONANE** | świadomie |

Agentów **A5 (Outputs/Reports/Initiatives)**, **A6 (testy)** i **A7 (odbiór
ręczny)** nie uruchomiono — ich praca zależy od Workspace'u, którego nie ma.
Uruchomienie ich teraz wyprodukowałoby raporty o nieistniejącym ekranie.

**MPQ Light/Dark: NIE OCENIONO — nie ma czego oceniać.** Reguła #7 z `CLAUDE.md`
(Piotr nigdy nie jest pierwszym testerem wizualnym) nie została naruszona,
bo żaden ekran nie powstał.

---

## 7. Otwarte zależności i kolizje

Pełna treść: [`COORDINATION.md`](COORDINATION.md). **Żaden punkt nie blokował
prac niezależnych** — wszystkie kontynuowano.

| ID | Temat | Waga |
| --- | --- | --- |
| COORD-01 | Nazwy powierzchni: brief (`Sessions`/`Reports`) vs kanon (`Processes`/`Deliverables`) | niska — koszt zmierzony: **1 etykieta** |
| COORD-02 | Zgoda na SIRI 8D → 16D + migracja | średnia — zakres zmalał |
| COORD-03 | Właścicielstwo plików struktur | **niska — ryzyko zmierzone jako zerowe** |
| COORD-04 | Baza: `origin/demo` vs gałąź integracyjna | do ustalenia dla 3 zespołów |
| COORD-05 | TIER już istnieje w repo | informacyjny |
| COORD-06 | DRD: dwa niezgodne modele wymiarów | średnia |
| COORD-07 | DRD: brak źródeł dla pól Method Packa | **blokuje `readiness` > `methodology_review`** |
| **COORD-08** | **SIRI: 3 defekty silnika Prioritisation Matrix** | **P1 — dowiedzione ze źródła** |
| COORD-09 | Niespójne sygnatury kompilatorów | niska |
| COORD-10 | Kontrakt przez granicę `server/tsconfig` | **rozwiązany technicznie** |

### COORD-08 w jednym akapicie

`src/services/siriPrioritisation.ts` liczy dziś ranking priorytetów
inwestycyjnych pokazywany klientowi. Wobec `SIRI-PM Whitepaper` (odczyt własny
Opusa) ma trzy defekty: **brak obowiązkowej normalizacji** (str. 36 Step 6 —
dowód: `IV=1,8` vs `IV=31,5` przy tym samym profilu, różnej skali), **brak
obcięcia ujemnego Proximity do zera** (str. 36 Step 4 — dowód: firma lepsza niż
best-in-class dostaje `IV=−1,6`) oraz **wagi domyślne `0,3/0,3/0,4`
nieodpowiadające żadnemu z trzech oficjalnych presetów** (str. 29 Figure 12).
Nie naprawiono świadomie: każda z poprawek **zmienia kolejność priorytetów** na
istniejących danych — to zmiana widoczna dla klienta, wymagająca decyzji
i ponownego przeliczenia.

---

## 8. Jakość procesu — co poszło nie tak i jak to złapano

Ta sekcja istnieje, bo **żaden raport agenta nie okazał się w pełni dokładny**.

| Źródło błędu | Błąd | Jak wykryto |
| --- | --- | --- |
| Agent A1 | „SIRI ma 24 wymiary" | policzył `buildingBlock:` w całym pliku (8+16); powtórzenie pomiaru przez parsowanie tablicy |
| Agent A1 | **fałszywy alarm P0**: „9 tabel nie istnieje, routery 500-ują" | grepował `CREATE TABLE` wielkimi literami; migracja kanoniczna używa małych |
| Agent A3 | test determinizmu **niczego nie dowodził** | module-level `cached` zwracał ten sam obiekt; napisano test z `vi.resetModules()` |
| Agent A4 | nie zgłosił defektu ujemnego Proximity | Opus czytał whitepaper samodzielnie |
| Agent A2 | „kopia bajt-w-bajt" (nieprecyzyjne) | dotyczy treści pod nagłówkiem; zweryfikowane `endsWith()` |
| **Opus (brief)** | **błędne polecenie testowe** dla A2 | `vitest --config` nie zmienia `root` — A2 zdiagnozował poprawnie |
| **Opus (brief)** | **„TIER nie istnieje, buduj od zera"** | grep obejmował tylko `siriStructure.ts`; korekta wysłana do A4 w trakcie pracy |
| Opus (narzędzia) | 4 pułapki powłoki | `PIPESTATUS`, cytowanie `zsh`, brak word-splitu `$FILES`, alias `@/` bez tsconfig |

**Wniosek operacyjny:** w tej fali **dwa błędy popełnił koordynator (ja)**,
nie tylko wykonawcy. Powtarzanie pomiarów przez Opusa nie było ceremonią —
bez niego do kandydata weszłyby: nieistniejąca metodyka SIRI (24 wymiary),
fałszywy alarm P0 na bazie i pusty test determinizmu.

---

## 9. Rekomendowana kolejność następnego bloku

1. **COORD-08** — naprawa silnika SIRI PM za flagą, z testem ranking przed/po.
   Jedyny punkt dotykający wyniku pokazywanego klientowi.
2. **COORD-01 i COORD-02** — decyzje odblokowujące nazwy i migrację SIRI.
3. **Method Workspace** — Interview Focus + Matrix Focus na gotowym kernelu.
   Dopiero wtedy A5/A6/A7 mają na czym pracować.
4. **COORD-07** — treść metodyczna DRD od właściciela metody.
5. Uruchomienie migracji na bazie dev, po decyzji z pkt 2.

---

## 10. Weryfikacja tego dokumentu

Każda liczba tutaj pochodzi z przebiegu wykonanego przez Opusa i jest zapisana
w [`EVIDENCE_LEDGER.md`](EVIDENCE_LEDGER.md) z poleceniem i kodem wyjścia.
Twierdzenia oznaczone **NOT VERIFIED** nie zostały potwierdzone i nie należy
ich traktować jako dowiezione — w szczególności **całe zachowanie na żywej
bazie danych**.
