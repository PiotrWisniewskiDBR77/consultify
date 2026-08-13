# CHECKPOINT — DRD Vertical Slice

> Wymagany checkpoint koordynatora. Przekazanie do **Codexa** przez Piotra.
> Zespół: Assessment / Shared Method Core.

---

## 1. Candidate SHA i bramki

| Pole | Wartość |
| --- | --- |
| Branch | `codex/method-assessment-core-20260813` |
| Baseline | `f3e7df565e` (== `origin/demo`) |
| **Candidate SHA** | `071785113a` |
| `git status --porcelain` | **0 linii** |
| Zakazy | **zero** merge do demo/main · **zero** push · **zero** deploy · **zero** migracji |

### Bramki — przebiegi własne Opusa, rozłącznie

| Zakres | Polecenie | Exit | Wynik |
| --- | --- | ---: | --- |
| front (metodyki + workspace + DRD slice) | `npx vitest run --config vitest.config.ts --exclude 'server/**' src/method-core src/components/method-workspace src/components/assessment/drd` | **0** | **181 / 181** (27 plików) |
| serwer (runtime kernela + outputs + most) | `npx vitest run server/src/method-core` | **0** | **101 / 101** (9 plików) |
| type-check | `npx tsc -p <scoped tsconfig>` | **0** | 0 błędów |

**Uwaga do liczb:** filtr ścieżki w vitest jest dopasowaniem po **podciągu** —
`src/method-core` łapie także `server/src/method-core`. Bez `--exclude 'server/**'`
ten sam przebieg raportuje 282, czyli 181 + 101. Podaję rozłącznie, żeby nie
zawyżać.

---

## 2. Ścieżka Library → Session → Output → Report → Initiative

| Ogniwo | Stan | Dowód |
| --- | --- | --- |
| Library → start sesji | działa | zrzut 01 |
| Session (Interview + Matrix + Teresa) | działa | zrzuty 02–05 |
| zapis i reopen | działa | zrzut 10 |
| manual input (6 stanów odpowiedzi) | działa | zrzut 02 |
| Teresa Preview z diffem | działa | zrzut 05 |
| Live Matrix | działa | zrzuty 03–04 |
| approval (rola `approver`) | działa | zrzut 06 |
| **freeze → Output** | **most zbudowany** | `EventDerivedOutputBridge`, zrzut 07 |
| Report ze snapshotu | działa | zrzut 08 |
| Initiative Proposal Draft | działa | zrzut 09 |

### Zrzuty — `docs/qa/screens/drd-slice-2026-08-13/` (10 szt.)

Wszystkie **wyrenderowane realnym kodem** (vite `dev-render` + Playwright,
1600×1000) i **obejrzane przez Opusa**. Reguła #7 nienaruszona: właściciel nie
jest pierwszym testerem wizualnym.

---

## 3. ★ Co działa REALNIE, a co jest uproszczone

To jest najważniejsza sekcja tego dokumentu.

### Realne

- **Kernel serwera** — `MethodSessionService`, `MethodEventStore`,
  `TeresaProposalService`, `MethodOutputService` + **nowy most freeze→Output**
  (`EventDerivedOutputBridge`). Zweryfikowane 101 testami.
- **Maszyna stanów** — `canTransition` i `TRANSITION_AUTHORITY` z kontraktu;
  freeze tylko dla `approver` (zrzut 06 pokazuje przycisk „Zamroź (tylko
  approver)" wyszarzony dla niewłaściwej roli).
- **Silnik DRD** — `drdAdapter.resolveOpenLevels` z realnymi skalami per oś.
  Zrzut 03 dowodzi: zakładki osi niosą `(7L)(5L)(5L)(7L)(6L)(6L)(5L)`,
  oś 1 ma **9 obszarów**, macierz **L1–L7**, licznik `2/39`.
- **Output** — immutable, `contentHash`, `limitations`, findings z evidence.
- **Powłoka Workspace** — komponenty A5 bez modyfikacji, wspólne z SIRI.

### Uproszczone — ujawnione w kodzie i w UI, nie ukryte

1. **UI nie łączy się przez HTTP z serwerem.** Runtime przeglądarki działa na
   `localStorage`. Mechanika serwerowa jest udowodniona **osobno** testami, ale
   **nie ma przebiegu e2e przez sieć**. To największe ograniczenie tego
   checkpointu.
2. **`businessMeaning`/`recommendation` w Output to deterministyczne szablony**,
   nie analiza LLM ani recenzja metodyka. **UI mówi to wprost** w `limitations`.
3. **Bramka gotowości packa jest jawnie ominięta** — pack DRD ma
   `readiness='methodology_review'`, `canStartSession()` = `false`. Slice omija
   to **tylko w trybie demo**, z banerem na **każdym** ekranie:
   *„To jest SESJA DEMONSTRACYJNA (vertical slice), nie produkcyjny start
   metody"*. `readiness` packa **nie został podniesiony**.
4. **Wgrywanie dowodu = metadane pliku**, nie realny upload.
5. Zrzut 01 to harness ze `StandardTable`, nie pełny `AssessmentHub`.

---

## 4. Braki metodologiczne — oddzielone od gotowości technicznej

Rozdzielenie wprost wymagane przez koordynatora.

### Gotowość TECHNICZNA — dowiedziona

| Element | Stan |
| --- | --- |
| mechanika progresji, above-gap, prerequisites | działa, otestowana |
| evidence E0–E4 rozdzielone od spełnienia poziomu | działa |
| maszyna stanów + uprawnienia | działa |
| freeze → immutable Output → Report → Initiative Draft | działa |
| determinizm hasha | dowiedziony (10 przebiegów, jeden hash) |

### Gotowość METODOLOGICZNA — **zablokowana**

| Brak | Liczba | Źródło |
| --- | ---: | --- |
| `misScoringTraps` | **0/233** | brak w repo |
| `distinctionFromPrevious` / `distinctionFromNext` | **0/233** | brak w repo |
| `negativeEvidence`, `examples` | **0/233** | brak w repo |
| pola pomocy pytania (10 pól) | **0/699** | brak w repo |
| `expectedEvidence` per poziom | **233/233** ✅ | QBank v2 |
| pytania walidacyjne | **699/699** ✅ | QBank v2 |

**DRD pozostaje `methodology_review`. Nie jest i nie może być oznaczone
`released` ani „production-ready metodologicznie"** do czasu zatwierdzenia
treści przez właściciela metodyki — zgodnie z decyzją COORD-07.
Pełny rejestr: [`CONTENT_COMPLETION_REGISTER.md`](CONTENT_COMPLETION_REGISTER.md).

---

## 5. Defekty znalezione przez Opusa przy odbiorze i naprawione

| # | Gdzie | Defekt | Dowód | Status |
| --- | --- | --- | --- | --- |
| 1 | A5 `InterviewFocusPanel` | „Dowód słaby" malowany na **czerwono**; kanon §7 rezerwuje czerwień dla blockera. Dodatkowo **niespójność wewnętrzna**: `missing` (gorszy) bursztynowy, `weak` (lepszy) czerwony; siostrzany `MethodNavigator` miał już poprawne mapowanie | odbiór wizualny zrzutu | **NAPRAWIONE**, 8 zrzutów zregenerowanych |
| 2 | A6 `DrdMethodWorkspaceScreen` | `blocker` ustawiany zawsze na `blockedAtLevel`; dla **nietkniętego** obszaru to poziom 1, więc świeży assessment 39 obszarów malował się **w całości na czerwono** — „wszystko zepsute" w dniu startu. Kanon UI-NAV §3 rozróżnia `absent`/`unresolved` od `blocker` | oś 1: **9 czerwonych komórek przed**, **2 po** naprawie | **NAPRAWIONE**, 10 zrzutów zregenerowanych |
| 3 | A7 `factory_observation` | zgłoszony jako otwarta zależność od kontraktu | A7 **nie tknął** zamkniętego zbioru kernela — postąpił prawidłowo | **ROZSTRZYGNIĘTE**: podtyp kernelowego `observation`, dodane `toKernelEvidenceType()` |

---

## 6. Realizacja decyzji koordynatora

| Decyzja | Stan | Uwaga |
| --- | --- | --- |
| **COORD-02** SIRI 16D | ✅ pack 16D źródłem prawdy | migracja **przygotowana, NIEURUCHOMIONA** |
| **COORD-06** pathway | ✅ nie podłączony | ★ **przesłanka sprostowana** — `D1..D8` to kanoniczna warstwa komunikacji z `DRD_CANON.md` §1/§3.2, nie obcy model; status `NOT_WIRED / NORMALISATION_MISSING`. Decyzja pozostaje słuszna |
| **COORD-07** DO NOT GENERATE | ✅ **zero** wygenerowanej treści | rejestr zmierzony programowo |
| **COORD-08** silnik wersjonowany | ✅ `legacy_v1` + `siri_pm_v2` | domyślnie `legacy_v1`; **34/48 pozycji zmienia rangę** |
| **COORD-09** `{pack, report}` | ✅ obie metody | test kontraktowy blokuje rozjazd przy ADMA/CMMI |

---

## 7. Otwarte — wymaga decyzji

| ID | Temat | Waga |
| --- | --- | --- |
| **COORD-11** | **DRD: 2 defekty agregacji** — brak normalizacji min-max (poziom 5/5 liczony jak 5/7) i zero liczone jako poziom (jeden nieoceniony obszar zbija wynik osi z **4,0 na 2,7**); dodatkowo `DRDReportTemplate` **pomija D5**, raport pokazuje 7 wymiarów zamiast 8 | **P1** |
| COORD-01 | Nazwy powierzchni | niska |
| COORD-04 | Baza dla trzech zespołów | do ustalenia |

---

## 8. Czego wciąż nie ma

- **ścieżka HTTP UI → serwer** — niezbudowana; to następny krok, nie kosmetyka
- **A9** (component/integration/E2E na disposable DB) — nieuruchomiony
- **A10** (odbiór ręczny) — nieuruchomiony; **MPQ nieocenione**
- **odbiór właściciela** — Piotr **nie widział** żadnego z tych ekranów; wszystko
  za flagami domyślnie **OFF**
- **realna baza** — zero migracji uruchomionych, zachowanie na Postgresie
  **NOT VERIFIED**

---

## 9. Flagi (wszystkie domyślnie OFF)

| Flaga | Gdzie | Zakres |
| --- | --- | --- |
| `methodWorkspaceShellV1` | `useFeatureFlags.tsx` | powłoka Workspace |
| `drdMethodWorkspaceSliceV1` | `useFeatureFlags.tsx` | DRD vertical slice |
| `SIRI_PM_V2` | `src/utils/siriPmV2Flag.ts` | silnik TIER v2 |

Przy fladze OFF stara ścieżka działa **bez zmian** — warunek bezpieczeństwa,
otestowany.
