# Method Assessment Core — rejestr koordynacji z Codexem

> Adresat: **Codex** (nadrzędny koordynator programu), przekazanie przez Piotra.
> Nadawca: zespół **Assessment / Shared Method Core** (Opus).
> Branch: `codex/method-assessment-core-20260813` · baseline `f3e7df565e`.
>
> Zasada pracy: **żaden punkt poniżej nie wstrzymuje prac niezależnych.**
> Kontynuujemy wszystko, co nie zależy od rozstrzygnięcia.

---

## COORD-01 — Nazwy pięciu powierzchni: brief vs kanon

**decyzja:** której nomenklatury pięciu zakładek używają Tools, Assessment i
Audits w kodzie i w publicznym kontrakcie wspólnym.

**stan faktyczny — sprzeczność w dwóch źródłach:**

| Źródło | Powierzchnia 2 | Powierzchnia 4 |
| --- | --- | --- |
| Brief programu (zlecenie tej pracy) | **Sessions** | **Reports** |
| `METHOD_MODULE_FIVE_SURFACES_STANDARD.md` §1 | **Processes** | **Deliverables** |
| `METHOD_LIBRARY_FIRST_STANDARD.md` §1 | **Processes** | — |
| `10_ASSESSMENT_REVIEW.md` §4.1, §5 | **Processes** | **Deliverables** |

Kanon jest w tej sprawie jednogłośny (3 dokumenty), brief odosobniony.
Kanon podaje też uzasadnienie merytoryczne: `Deliverables` ≠ `Reports`, bo
obejmuje deck/sheet/diagram/export, a właścicielem artefaktu jest **Materials**;
`Processes` ≠ `Sessions`, bo nazwa jest **wspólna dla trzech modułów**, a języka
domeny (`Assessment`, `Tool Session`, `Audit`) używa się w nagłówku i kolumnach,
nie w nazwie zakładki.

**wariant rekomendowany:** przyjąć nomenklaturę kanonu —
`Library · Processes · Outputs · Deliverables · Initiatives` — jako **nazwy
kontraktu wspólnego i etykiety UI**, a `Sessions`/`Reports` traktować jako język
domeny Assessment wewnątrz powierzchni (nagłówek, kolumny, typ obiektu).
Powód: nazwa wspólna jest jedynym elementem, który realnie spina trzy moduły;
rozjazd nazw zablokuje wspólny shell dla Tools i Audits.

**alternatywy:**
1. Trzymać brief (`Sessions`/`Reports`) i zaktualizować 3 dokumenty kanonu —
   wymaga zgody właściciela kanonu i przepisania kontraktu dla Tools i Audits.
2. Zostawić bieżące nazwy z kodu bez zmian, cokolwiek nimi jest, i odłożyć
   ujednolicenie do osobnego bloku — najniższe ryzyko regresji, najwyższy dług.

**wpływ na Assessment:** etykiety zakładek i deep linki; **zero** wpływu na
model danych, silnik metodyki, scoring i evidence.
**wpływ na Tools:** ta sama decyzja, ta sama powierzchnia.
**wpływ na Audits:** ta sama decyzja, ta sama powierzchnia.

**pliki/kontrakty:** `SHARED_CONTRACT_MANIFEST.md` (nazwy powierzchni),
routing `/assessment`, etykiety StandardModuleBar.

**czy praca niezależna może być kontynuowana:** **TAK.** Brief przesądza, że
istniejące tabele są kanonem i **nie podlegają redesignowi**, więc do czasu
decyzji nie zmieniamy żadnych etykiet. Cała praca (Method Pack, kernel, silnik
progresji, evidence, macierz, TIER) jest od tej decyzji niezależna.

---

## COORD-02 — SIRI: persystencja 8D vs kanoniczne 16D

**decyzja:** czy zespół Assessment ma prawo przebudować persystencję SIRI
z 8 wymiarów na kanoniczne 16, wraz z migracją danych istniejących sesji.

**stan faktyczny — zweryfikowany bezpośrednio w kodzie przez Opusa**
(`src/services/siriStructure.ts`, baseline `f3e7df565e`):

| Kanon SIRI | Runtime dzisiaj | Liczność | Ocena |
| --- | --- | ---: | --- |
| 3 building blocks | `SIRI_BUILDING_BLOCKS` | 3 | zgodne |
| 8 **pillars** | `SIRI_DIMENSIONS` ⚠️ zła nazwa | 8 | **źródło prawdy — niezgodne z kanonem** |
| 16 **dimensions** | `SIRI_PRIORITISATION_AREAS` ⚠️ zła nazwa | 16 | **pochodne — niezgodne z kanonem** |
| Bands 0–5 | `SIRI_MATURITY_LEVELS` | 6 | zgodne |
| Prioritisation Matrix (TIER) | *brak odrębnego bytu* | — | **brak** |

Trzy konkretne defekty w kodzie:

1. `compute16DScores()` (linia 531) — 16 wymiarów **dziedziczy** wynik rodzica
   8D, gdy brak własnego. To znaczy, że 16D jest **imputowane, nie mierzone**.
   Kanon (`ASSESSMENT_KB_SIRI.md` §1) wymaga 16D jako source of truth.
2. `aggregate16Dto8D()` (linia 555) — **prosta średnia arytmetyczna**
   `reduce/length`. Brief nazywa to wprost zakazanym „nieautoryzowanym
   uśrednieniem / 8D average"; kanon wymaga wersjonowanej reguły metody.
3. `SIRI_PRIORITISATION_AREAS` pełni **jednocześnie** rolę 16 wymiarów oceny
   i macierzy priorytetyzacji. Kanon (`ASSESSMENT_KB_SIRI.md` §4) wymaga ich
   rozdzielenia: Assessment Matrix (16D × Bands) **zamrażana przed** TIER
   Prioritisation Matrix. Brief: „Nie wolno łączyć wyboru Band z priorytetyzacją
   w jednym formularzu."

Kierunek naprawy jest **dokładnie tym, co przewiduje kanon** w
`ASSESSMENT_KB_SIRI.md` §7 („krytyczne braki") — nie jest to nasz wymysł.

**wariant rekomendowany:** TAK — przebudować na 16D source-of-truth, z jawnym
wersjonowanym mapowaniem 16D → 8 pillars, oraz **wydzielić TIER** jako osobny
byt uruchamiany po freeze. Migracja **addytywna** (nowe kolumny/tabela obok
istniejących), stare dane czytane przez adapter read-only, zero kasowania.

**alternatywy:**
1. Zostawić 8D i udawać 16D w prezentacji — odrzucone: produkuje dane, których
   nikt nie zmierzył, i łamie zakaz z briefu.
2. Zrobić 16D tylko dla nowych sesji, stare zostawić 8D read-only — mniejsze
   ryzyko, ale dwa runtime'y do utrzymania.

**wpływ na Assessment:** duży — model danych, scoring, macierz, raport, TIER.
**wpływ na Tools:** brak (SIRI nie jest metodą Tools).
**wpływ na Audits:** wymaga potwierdzenia, że Audits nie czyta `siriStructure.ts`
— **NOT VERIFIED**, do sprawdzenia. Kanon `10_ASSESSMENT_REVIEW.md` §18.8 mówi
wprost: „DRD/SIRI usunięte z własności Audits", co sugeruje, że dziś powiązanie
istnieje.

**pliki/kontrakty:** `src/services/siriStructure.ts`, migracje SIRI,
`SHARED_CONTRACT_MANIFEST.md` (adapter metody).

**czy praca niezależna może być kontynuowana:** **TAK.** Kernel wspólny, DRD,
Method Pack Registry, evidence, workspace i cała warstwa Assessment poza SIRI
są niezależne. Migracja SIRI zostaje przygotowana jako addytywna i **nieurucho-
miona na żywej bazie** do czasu decyzji.

---

## COORD-03 — Właścicielstwo `siriStructure.ts` / `drdStructure.ts` między zespołami

**decyzja:** który zespół jest wyłącznym właścicielem plików struktur metodyk.

**kontekst:** `10_ASSESSMENT_REVIEW.md` §17 („Fragmentacja") notuje, że
**„DRD report bywa opisany i routowany jako Audit"**, a §18.8 żąda usunięcia
DRD/SIRI z własności Audits. Jeżeli zespół Audits pracuje równolegle na tych
samych plikach, dostaniemy konflikt scalenia albo — gorzej — dwie prawdy.

**wariant rekomendowany:** pliki `src/services/{drd,siri,adma}Structure.ts`
oraz cały nowy katalog kernela metod = **wyłączna własność zespołu
Assessment/Core**. Audits konsumuje przez publiczny adapter, nie edytuje.

**alternatywy:** współwłasność z protokołem uzgodnień — odrzucone, historia
programu pokazuje, że to produkuje fantomowe defekty.

**wpływ na Assessment:** brak, to formalizacja stanu.
**wpływ na Tools:** brak.
**wpływ na Audits:** musi zrezygnować z bezpośredniej edycji; dostaje adapter.

**pliki/kontrakty:** sekcja „pliki wyłącznej własności" w
`SHARED_CONTRACT_MANIFEST.md`.

**czy praca niezależna może być kontynuowana:** **TAK.**

---

## COORD-04 — Równoległa gałąź integracyjna `codex/consultify-final-integration-20260813`

**decyzja:** czy ta praca ma być bazowana na `origin/demo`, czy na gałęzi
integracyjnej.

**stan faktyczny:** `origin/codex/consultify-final-integration-20260813` jest
**15 commitów przed `origin/demo`, 0 za** i **aktywnie się przesuwa** (w trakcie
naszej sesji przeszła z `5958e55b52` na `d3a0aa9bde`). Jest oznaczona jako
INTEGRATION_FOUNDATION_READY.

**wariant rekomendowany:** pozostać na `origin/demo` (zgodnie z regułą
CLAUDE.md „baza gałęzi ZAWSZE origin/demo") i wykonać rebase/forward-port na
gałąź integracyjną jako **osobny, świadomy krok** po zamknięciu kandydata.
Powód: baza, która przesuwa się pod pracą, uniemożliwia powtarzalny pomiar
bramek.

**alternatywy:** bazować na gałęzi integracyjnej — szybszy zbieg, ale
niestabilny baseline i ryzyko wejścia w cudzy zakres.

**wpływ:** wspólny dla trzech zespołów — warto, żeby wszystkie trzy Opusy
bazowały na **tym samym** SHA.

**czy praca niezależna może być kontynuowana:** **TAK.**

---

## COORD-05 — Kontrakt kernela nie da się zaimportować przez granicę server/tsconfig (rootDir)

**decyzja:** czy backend (`server/src/method-core/`) ma prawo trzymać osobną,
zwierciadlaną kopię `src/method-core/contracts/*`, zamiast importować frozen
kontrakt bezpośrednio przez relatywny import poza `server/`.

**stan faktyczny — zweryfikowany bezpośrednio (agent A2, runtime kernela):**
`server/tsconfig.json` ma `"rootDir": "."` (czyli `server/`), a produkcyjny
start to `cd server && npm run build && node dist/src/index.js`
(`tsc --build tsconfig.build.json`). Import z `server/src/...` sięgający
poza `server/` (np. `../../../src/method-core/contracts`) łamie ten build
błędem TS6059 („File is not under rootDir"). Sprawdzone: w całym
`server/src/` **nie ma ani jednego** precedensu importu przekraczającego tę
granicę (grep `from '../../../..'` itd. — same trafienia zostają wewnątrz
`server/`). `tsx` (dev) i `vitest` (testy) tolerują import poza granicą
(brak sztywnego rootDir), więc defekt jest **niewidoczny** dopóki ktoś nie
uruchomi realnego `npm run build` w `server/`.

**wariant przyjęty (nieblokujący, zrobione):** `server/src/method-core/contracts/`
to bajt-w-bajt kopia treści z `src/method-core/contracts/` (identyczna od
pierwszej linii kodu — różni się tylko nagłówek-komentarz w każdym pliku,
opisujący dlaczego kopia istnieje). Zweryfikowane:
`diff <(tail -n +23 server/src/method-core/contracts/X.ts) src/method-core/contracts/X.ts`
= brak różnic, dla wszystkich 5 plików.

**ryzyko pozostawione otwarte:** dryf. Jeśli ktoś zmieni frozen kontrakt w
`src/method-core/contracts/` i nie zsynchronizuje ręcznie kopii w
`server/src/method-core/contracts/`, backend zacznie działać na starej
wersji kontraktu bez błędu kompilacji (dwie kopie to dwa źródła prawdy,
tymczasowo). Żaden mechanizm nie pilnuje tego automatycznie dzisiaj.

**alternatywy:**
1. Rozszerzyć `server/tsconfig.json`/`tsconfig.build.json` o `rootDir`
   obejmujący cały monorepo (lub usunąć `rootDir`) — większy promień
   wybuchu, zmienia strukturę `dist/`, nie zrobione w tej sesji.
   Podnieść: właściciel build/release.
2. Wydzielić kontrakt jako osobny workspace-package (np. `packages/method-core-contracts`)
   importowany przez oba drzewa przez `node_modules`/workspaces — czyste,
   ale wymaga zmiany w `package.json` workspaces i osobnej decyzji.
3. Zostawić dwie kopie (przyjęte tu) — najniższe ryzyko regresji **teraz**,
   najwyższy dług synchronizacji later.

**wpływ na Assessment:** żaden na model/scoring; dotyczy tylko
mechaniki importu backendu.
**wpływ na Tools/Audits:** te same konsekwencje, gdy ich runtime zacznie
importować kontrakt po stronie `server/`.

**pliki/kontrakty:** `server/src/method-core/contracts/*.ts` (kopia),
`src/method-core/contracts/*.ts` (źródło prawdy, bez zmian),
`server/tsconfig.json`, `server/tsconfig.build.json`.

**czy praca niezależna może być kontynuowana:** **TAK** — runtime kernela
(`MethodEventStore`, `MethodSessionService`, `MethodPackRegistry`,
`TeresaProposalService`) jest zaimplementowany przeciwko kopii lokalnej i
przechodzi testy jednostkowe niezależnie od rozstrzygnięcia tego punktu.

---

## Status

| ID | Temat | Blokuje pracę? | Status |
| --- | --- | --- | --- |
| COORD-01 | Nazwy pięciu powierzchni | NIE | OTWARTY |
| COORD-02 | SIRI 8D → 16D + TIER | NIE | OTWARTY |
| COORD-03 | Właścicielstwo plików struktur | NIE | OTWARTY |
| COORD-04 | Baza: demo vs gałąź integracyjna | NIE | OTWARTY |
| COORD-05 | Kontrakt kernela przez granicę server/tsconfig rootDir | NIE | OTWARTY (kopia zrobiona, sync ręczny) |
