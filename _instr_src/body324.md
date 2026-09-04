## Po co ten dyżur istnieje

Właściciel powiedział wprost: **„Musimy mieć kompletne karty inicjatyw — to jest sens naszej
aplikacji"** (`DEC-387`) i zaakceptował parę zrzutów. Dyżury 305 i 314 są już na markerze tego
dyżuru i zrobiły rzecz prawdziwą: **kontrakt kart przestał kasować sekcje.** Zmierzono to uchwytem
DOM i potwierdzono mutacją, dla wszystkich siedmiu typów, `ON = OFF`:

| Typ | pozycji ON/OFF | grup ON/OFF |
| --- | --- | --- |
| Initiative | 24 / 24 | 5 / 5 |
| Insight | 22 / 22 | 5 / 5 |
| Task | 8 / 8 | — |
| Interview | 8 / 8 | 3 / 3 |
| Decision | 6 / 6 | — |
| Tool | 4 / 4 | 3 / 3 |
| Notification | 3 / 3 | — |

**I mimo to właściciel może dalej zobaczyć niekompletną kartę.** Odbiór adwersaryjny 04.09 zmierzył
sufit, którego żaden z tych dyżurów nie widział:

> **Przy NIEPUSTYM szablonie inicjatywy karta ma 6 sekcji z 24 — NIEZALEŻNIE od flagi.**
> Zmierzone: OFF 6 pozycji / 3 grupy, ON 6 pozycji / 3 grupy.

Przyczyna leży w kolejności dwóch filtrów w `src/components/Initiatives/InitiativeDocumentView.tsx`:

1. **NAJPIERW** `enabledNModeSectionIds` (ok. linii 5274) buduje zbiór dozwolonych id z
   `initiativeTemplate.visibleSections`, a ok. linii 5544-5548 zawęża nim `allSections`:
   `withGroup(allSections.filter((section) => enabledNModeSectionIds.has(section.id)))`.
2. **DOPIERO POTEM**, ok. linii 9028, kontrakt dostaje już okrojoną listę i wykonuje na niej
   `uporzadkujSekcjeBoarduInicjatywy(...)`, która — zgodnie z własnym komentarzem i asercją w
   teście kompletności — **zwraca PERMUTACJĘ wejścia**. Cały wkład kontraktu w wygląd to
   **PORZĄDEK, nie cięcie.**

Kontrakt fizycznie nie może przywrócić sekcji, której mu nie podano. Dlatego para OFF/ON jest
identyczna, dlatego raport „kontrakt niczego nie ucina" jest **prawdziwy**, i dlatego karta jest
**mimo to niekompletna**. To jest realny powód, dla którego właściciel może dalej widzieć sześć
sekcji zamiast dwudziestu czterech.

Szablon `quick_win` (`src/components/Initiatives/templates/initiativeLevelTemplates.ts`, ok. linii
36-48) deklaruje pięć sekcji: `overview`, `scope`, `tasks`, `kpis`, `attachments`. Sześć na karcie
= te pięć plus zawsze-obecna `initiative-definition`. **To nie jest przypadek — to jest arytmetyka
szablonu.**

**Ten dyżur nie „naprawia" tego przez wyłączenie szablonów.** Szablony są funkcją produktu, nie
defektem. Zadaniem dyżuru jest **zmierzyć sufit czterema liczbami zamiast dwoma** (pusty szablon
OFF/ON **i** niepusty szablon OFF/ON), rozstrzygnąć trzy pułapki, które czekają na dzień włączenia
flagi, i postawić właścicielowi jedno pytanie z obiema listami nazw obok siebie.

### Trzy pułapki, które czekają na dzień włączenia flagi

1. **Decyzja zostanie na starym.** `useDecisionCardContractEnabled`
   (`src/components/MyWork/DecisionDetailView.tsx`, ok. 502-511) czyta wyłącznie
   `import.meta.env.VITE_VF1_DECISION_CARD_CONTRACT` oraz query `?cardContract=1`, i to query
   **tylko pod `import.meta.env.DEV`**. Pozostała szóstka czyta dodatkowo
   `localStorage.getItem('ff.cardContract')`. W dniu, w którym ktoś włączy kontrakt jednym linkiem,
   sześć artefaktów przełączy się, a Decyzja nie.
2. **Zastany `localStorage` przeżyje naprawę.** Klucz układu ma osobną przestrzeń nazw dla
   kontraktu — `task:nmode:card-layout:v2-contract:<id>`,
   `decision:nmode:card-layout:v2-contract:<id>`, `notification:nmode:card-layout:v2-contract:<id>`.
   Kto ruszał menedżer kart przy fladze `ON`, ma zapisany węższy układ i **po naprawie zobaczy stary
   stan**. Każdy pomiar w tym dyżurze robisz w świeżym profilu albo po jawnym wyczyszczeniu tych
   kluczy — i **zapisujesz w raporcie, którą drogą**.
3. **Nazwy Menu 3 się rozjeżdżają.** `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` §13.1
   (nagłówek w linii 1037, wiersz `Initiative (L)` tuż pod nim) daje sześć nazw:
   *Zadania · Definicja · Wdrożenie · Ekonomia · Governance · Zespół*. Produkt ma pięć grup
   (`InitiativeDocumentView.tsx` ok. 5500): *Zakres i plan · Decyzje i ryzyko · Rezultaty · Ludzie
   · Zapisy*. **Nie rozstrzygasz tego sam** — stawiasz właścicielowi pytanie z OBIEMA listami.

### Pozostałe zmierzone braki kompletności

- **Zadanie:** `TASK_CARDS` ma **10** pozycji w katalogu (`taskCardContract.ts`, ok. 304-315),
  a karta renderuje **8**. Dwie pozycje katalogu nie mają renderu — ustal **które** i **dlaczego**.
- **Wniosek:** `INSIGHT_CARDS` ma **30** pozycji, a kontrakt celowo zachowuje **22**. Ustal, czy
  ta ósemka jest świadomym wyborem produktowym (wtedy: gdzie zapisanym), czy długiem.
- **Typy bez kontraktu:** §13.1 wymienia jedenaście artefaktów archetypu REKORD. Kontrakt mają
  cztery (Initiative, Task, Decision, Insight). **Moja liczba: siedem bez kontraktu** — KPI, Idea,
  RAID, Milestone, Change Request, Stage Gate, Action Proposal. Zlecenie mówiło „8 typów" i
  wymieniało siedem nazw; **policz sam i zapisz swoją liczbę**. Żaden z nich nie był mierzony.

## ★ Zmierz moje liczby sam

Twierdzę: kontraktów jest 7; kanoniczna kolejność boardu inicjatywy ma 24 pozycje; `TASK_CARDS`
ma 10, `INSIGHT_CARDS` ma 30; szablon `quick_win` deklaruje 5 sekcji; §13.1 ma 11 wierszy, z czego
4 mają kontrakt; `DecisionDetailView.tsx` nie czyta `ff.cardContract`; liście
`public/locales/pl/translation.json` = 35198, `en` = 33065 (liczone z rozwinięciem tablic —
komenda w `B.3` wiersz 8).

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH — CAŁA ŚCIEŻKA

> **★★ ZASTRZEŻENIE.** Poniższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz, jest
> opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi« jest
> NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Warstwa | Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- | --- |
| **walidator** | `src/components/Initiatives/__tests__/**`, `src/components/MyWork/__tests__/**` (NOWE pliki) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31` | — |
| **walidator** | `tests/unit/initiatives/initiativeCardContractCompleteness.test.ts`, `initiativeRecordCanon.test.ts`, `initiativeCardValidators.test.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisanie NOWYCH przypadków `it(...)`**. Zakaz zmiany i osłabiania istniejących asercji, zakaz zmiany progów | Nowy plik testowy obok, z nagłówkiem `// KONTRAKT DYŻURU 324` |
| **trasa (front)** | `src/components/Initiatives/InitiativeDocumentView.tsx` | **TYLKO ODCZYT w tym dyżurze.** To jest plik-rdzeń sufitu; zmiana kolejności filtrów jest **decyzją produktową właściciela**, nie naprawą wykonawcy | Produkt zastępczy: **gotowy diff w bloku kodu, NIENAŁOŻONY**, plus brief z promieniem rażenia (ile modułów, ile typów kart, co się dzieje z zastanym `localStorage`) |
| **trasa (front)** | `src/components/MyWork/DecisionDetailView.tsx` | **★ WĄSKA LICENCJA — WYŁĄCZNIE funkcja `useDecisionCardContractEnabled`** (ok. 502-511), i **wyłącznie** w celu zrównania jej z rodziną (odczyt `localStorage ff.cardContract`), **bez zmiany wartości domyślnej — flaga zostaje OFF** (`Z10`). Zakaz zmiany czegokolwiek innego w tym pliku | Gotowy diff + brief |
| **kontrakt** | `src/components/Initiatives/sections/initiativeCardContract.ts`, `src/components/MyWork/taskCardContract.ts`, `decisionCardContract.ts`, `notificationCardContract.ts`, `src/components/Interview/insightCardContract.ts`, `interviewCardContract.ts`, `src/components/DiscoveryTools/toolCards.contract.ts` | **TYLKO ODCZYT** — siedem deskryptorów kanonicznych; ich zmiana przesuwa kompozycję kart, którą właściciel zaakceptował na zrzutach | Pomiar + wpis w rejestrze + gotowy diff nienałożony |
| **typ wiążący** | `src/components/standard/cardContract.types.ts` | **TYLKO ODCZYT — PLIK PRZEKROJOWY.** Typ przepływa przez wszystkie siedem kontraktów; jego zmiana psuje kompilację każdego z nich | **CZERWONY KONTRAKT TESTOWY** (`it('KONTRAKT DLA DYŻURU 324 — …')`, nagłówek `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`) + brief: plik:linia · promień rażenia · jak wyglądałby dowód mutacyjny. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| **powłoka** | `src/components/shared/NModeLayout/NModeLeftNav.tsx` | **TYLKO ODCZYT** — nosi uchwyty pomiarowe `data-nmode-section-item` (linie 157, 294) i `data-nmode-section-group` (linia 423). Uchwyty są Twoim przyrządem; ich zmiana unieważnia pomiar | Opis w raporcie + gotowy diff nienałożony |
| **szablony (front)** | `src/components/Initiatives/templates/initiativeLevelTemplates.ts`, `types.ts`, `InitiativeLevelSelector.tsx`, `src/hooks/useInitiativeTemplate.ts` | **TYLKO ODCZYT** — kształt szablonów to decyzja produktowa | Pomiar + wpis `DO DECYZJI WŁAŚCICIELA` ze zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie" |
| **serwis (tył)** | `server/src/services/initiativeTemplateService.ts` | **TYLKO ODCZYT** | Opis w raporcie z dowodem plik:linia |
| **repozytorium (tył)** | `server/src/services/resultsVnext/**`, `server/src/repositories/**` | **TYLKO ODCZYT** — poza zakresem | Opis w raporcie |
| **migracje** | `server/migrations/**` | **BEZ LICENCJI — ten dyżur nie dodaje ani nie zmienia żadnej migracji.** Przedział migracji nie jest mu przydzielony | Jeśli uznasz, że migracja jest potrzebna — to jest STOP MERYTORYCZNY z briefem, idziesz do następnej pozycji |
| **narzędzie** | `scripts/dev/grafika-zrzuty.mjs` | **★ WĄSKA LICENCJA — WYŁĄCZNIE zmiany ADDYTYWNE i OPT-IN** (nowy parametr `--…`, domyślnie wyłączony), zgodnie z regułą „nie pisz własnego zrzutu obok kanonicznego". **ZAKAZ zmiany zachowania domyślnego** — dziesiątki istniejących wywołań w `scripts/dev/*.sh` i instrukcjach muszą działać bit w bit jak dziś | Opis brakującej zdolności w raporcie + gotowy diff |
| **przyrząd** | `dev-render/screens/karta-initiative.tsx`, `karta-task.tsx`, `karta-task-pelna.tsx`, `karta-decision.tsx`, `karta-insight.tsx`, `karta-interview.tsx`, `karta-notification.tsx`, `karta-tool.tsx` | **★ PEŁNA LICENCJA** — to jest harness, nie produkt. Pamiętaj: **host harnessu nie jest produktem** (pułapka 4) | — |
| **i18n** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. Zakaz zmiany istniejących wartości. **Liczba liści nie może zmaleć** (baza: pl 35198 / en 33065 — komenda w `B.3`) | — |
| **rejestr** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMPLETNOSCI_KART_20260904.md` (**NOWY**) | **★ PEŁNA LICENCJA** | — |
| **dowody** | `evidence/kompletnosc-kart-20260904/**` (**NOWY**) | **★ PEŁNA LICENCJA**, `git add -f` | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY324_SZABLON_TNIE_KARTE_REPORT.md` | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **kanon (dok.)** | `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`, `docs/ui-standards/TRIADA_KANON.md` | **TYLKO ODCZYT** (`Z14`-podobny) | Errata w raporcie |
| **decyzje** | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar, jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja jest zrobiona z takim opisem |
| **cudzy teren** | `server/src/middleware/appErrorMapper.ts`, `src/services/errors/appErrorCopy.ts`, `src/services/api.ts` — **teren dyżuru 325**; `server/src/routes/admin/service-accounts.routes.ts`, `server/src/services/tablePlatform/**` — **teren dyżuru 326** | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, treść problemu, gotowa rekomendacja jako diff w bloku kodu, **nienałożony**. Pozycja idzie dalej |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit robisz PO KAŻDEJ pozycji,
push na `github-backup` po pierwszym commicie i po każdej kolejnej pozycji (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Pomiar sufitu szablonowego — CZTERY liczby | TAK | NIE — dowód: `grep -n 'enabledNModeSectionIds' src/components/Initiatives/InitiativeDocumentView.tsx` pokazuje, że pomiar jest odczytem | bazowe | Para OFF/ON na rekordzie z **NIEPUSTYM** szablonem **i** para OFF/ON na rekordzie z **PUSTYM** szablonem, wszystkie cztery liczone uchwytem DOM, każda z zapisanym id rekordu i stanem `localStorage` | `node scripts/dev/grafika-zrzuty.mjs … --zlicz='pozycje:[data-nmode-section-item];grupy:[data-nmode-section-group]' --wynik-json=…` ×4 | `docs(day324): pomiar sufitu szablonowego — 4 liczby (324 R1)` |
| R2 | Rodzina flag kontraktu — komplet siedmiu wołaczy + trzy pułapki | TAK | NIE — dowód: `DecisionDetailView.tsx` ma jawną wąską licencję w `B.1` | bazowe + 1 nowy test rodziny | Tabela siedmiu wołaczy (plik:linia · czyta env? · czyta query? · czyta `localStorage`? · pod `DEV`?), rozstrzygnięcie trzech pułapek, gotowe diffy **nienałożone** dla `InitiativeDocumentView.tsx`, nałożony diff **wyłącznie** dla `useDecisionCardContractEnabled`, flaga nadal OFF | `npx vitest run src/components/MyWork/__tests__ --retry=0` + dowód mutacyjny (patrz `R2`) | `fix(mywork): Decyzja czyta ff.cardContract jak reszta rodziny — flaga nadal OFF (324 R2)` |
| R3 | Para zrzutów odbiorczych na REALNYM rekordzie z niepustym szablonem | TAK | NIE | n/d | 4 kadry (light+dark × pl+en) na realnym rekordzie z listy, nie na id pokazowym; każdy obejrzany przez `Read` i opisany; para light/dark **nie może być bitowo identyczna** | `node scripts/dev/grafika-zrzuty.mjs … --porownaj-z=…` | `docs(day324): kadry odbiorcze karty inicjatywy (324 R3)` |
| R4 | Kompletność Zadania (10 vs 8) i Wniosku (30 vs 22) | NIE | NIE | +2 testy | Wypisane **imiennie**, które pozycje katalogu nie mają renderu i dlaczego; werdykt: dług czy świadomy wybór (przy „świadomy" — gdzie zapisany) | `npx vitest run tests/unit/initiatives --retry=0` | `docs(day324): rozliczenie kompletnosci Task i Insight (324 R4)` |
| R5 | Inwentarz typów §13.1 bez kontraktu | NIE | NIE | n/d | Tabela: artefakt z §13.1 · ma kontrakt? · plik · jeśli nie — czy ekran w ogóle istnieje w `src/`. **Twoja liczba**, nie moja | `sed -n '1041,1052p' Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` + `find src -name '*ardContract*.ts'` | `docs(day324): inwentarz typow §13.1 bez kontraktu (324 R5)` |
| R6 | Pytanie do właściciela — nazwy Menu 3 | NIE | NIE | n/d | Wpis `DO DECYZJI WŁAŚCICIELA` z OBIEMA listami nazw obok siebie, kadrem, i zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie" | — | `docs(day324): pytanie o nazwy Menu 3 Initiative (324 R6)` |
| R7 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" **niepusta** | — | `docs(day324): raport` |

> **Kolumna „Wymaga plików przekrojowych?" jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Żadna pozycja nie wymaga zmiany pliku, którego nie masz prawa dotknąć:
> `cardContract.types.ts` jest przekrojowy i **żadna pozycja go nie zmienia** — jeśli uznasz, że
> musi, produktem jest czerwony kontrakt + brief, a pozycja jest **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą z tych liczb mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz w `bash`.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Kontrakty kart artefaktów | 7 (+1 plik typu) | `find src -name '*ardContract*.ts' -o -name '*ards.contract.ts' \| sort` | TAK — uruchomione na markerze |
| 2 | Pozycje kanonicznej kolejności boardu inicjatywy | 24 | `awk 'NR>795 && /^\];/{exit} NR>795' src/components/Initiatives/sections/initiativeCardContract.ts \| grep -c "'"` | TAK |
| 3 | Pozycje katalogu Zadania | 10 | `sed -n '304,315p' src/components/MyWork/taskCardContract.ts` (policz wpisy tablicy) | TAK |
| 4 | Pozycje katalogu Wniosku | 30 | `awk 'NR>709 && /^\];/{exit} NR>709' src/components/Interview/insightCardContract.ts \| grep -cE '^  [A-Z][A-Z_0-9]*,'` | TAK |
| 5 | Sekcje deklarowane przez szablon `quick_win` | 5 | `sed -n '41,47p' src/components/Initiatives/templates/initiativeLevelTemplates.ts` | TAK — to jest arytmetyka „6 z 24" |
| 6 | Wiersze §13.1 (archetyp REKORD) | 11 | `sed -n '1041,1052p' Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md \| grep -c '^| '` | TAK |
| 7 | Grupy Menu 3 w produkcie (Initiative) | 5 | `sed -n '5499,5503p' src/components/Initiatives/InitiativeDocumentView.tsx` | TAK |
| 8 | Liście `translation.json` | pl 35198 / en 33065 | `node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'` | TAK — **liczba nie może zmaleć**; tablice liczone element po elemencie |
| 9 | Wołacze `ff.cardContract` w `localStorage` | 6 z 7 (bez Decyzji) | `grep -rn "localStorage.getItem('ff.cardContract')" src` (w `bash`) | TAK — brak trafienia w `DecisionDetailView.tsx` JEST wynikiem |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMPLETNOSCI_KART_20260904.md` | NOWY | R1/R4/R5 | ZEROWE |
| 2 | `evidence/kompletnosc-kart-20260904/**` | NOWY | R1/R3 | ZEROWE |
| 3 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY324_SZABLON_TNIE_KARTE_REPORT.md` | NOWY | R7 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `src/components/MyWork/DecisionDetailView.tsx` | R2 | Tylko funkcja `useDecisionCardContractEnabled`, tylko zrównanie z rodziną, **flaga nadal domyślnie OFF**, z dowodem mutacyjnym w obie strony |
| `src/components/MyWork/__tests__/**` (NOWE) | R2 | Test rodziny wołaczy — musi CZERWIENIĆ po usunięciu odczytu `localStorage` z któregokolwiek z siedmiu |
| `dev-render/screens/karta-*.tsx` | R1/R3 | Tylko jeśli przyrząd nie pozwala zamontować realnego rekordu z niepustym szablonem |
| `scripts/dev/grafika-zrzuty.mjs` | R1 | Tylko addytywnie i opt-in, jeśli brakuje zdolności pomiarowej; zachowanie domyślne bit w bit jak dziś |
| `public/locales/{pl,en}/translation.json` | R2 | Tylko dopisanie kluczy, parytet w tym samym commicie, liczba liści nie maleje |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
src/components/Initiatives/InitiativeDocumentView.tsx  — rdzeń sufitu; produkt = diff NIENAŁOŻONY
src/components/standard/cardContract.types.ts          — przekrojowy przez 7 kontraktów
server/src/middleware/appErrorMapper.ts                — teren dyżuru 325
src/services/errors/appErrorCopy.ts, src/services/api.ts — teren dyżuru 325
server/src/routes/admin/service-accounts.routes.ts     — teren dyżuru 326
server/src/services/tablePlatform/**                   — teren dyżuru 326
tests/unit/backend/security/noRawErrorMessage.test.ts  — teren dyżuru 326
server/migrations/**                                   — przedział nieprzydzielony
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6350 | `lsof -nP -iTCP:6350 -sTCP:LISTEN` → puste (sprawdzone przy pisaniu instrukcji) |
| Port harnessu | 5490 | `lsof -nP -iTCP:5490 -sTCP:LISTEN` → puste |
| Kontener | `cx-day324-pg` | `docker ps --format '{{.Names}}' \| grep cx-day324` → brak |
| Baza | `cx324` | n/d |
| Gałąź | `codex/day324-szablon-tnie-karte-20260904` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day324-szablon-tnie-karte` | nie istnieje |
| Przedział migracji | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | n/d |
| Flagi | wszystkie `*_CARD_CONTRACT` — **NIEZMIENIANE, domyślnie OFF** | `grep -rn 'VITE_VF1_.*CARD_CONTRACT' src` |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day324-szablon-tnie-karte
git diff --name-only --cached | tee /private/tmp/cx-day324-szablon-tnie-karte-artefakty/staged.txt
grep -iE 'InitiativeDocumentView\.tsx|cardContract\.types\.ts|appErrorMapper|appErrorCopy|services/api\.ts|service-accounts\.routes|tablePlatform/|noRawErrorMessage|server/migrations/' \
  /private/tmp/cx-day324-szablon-tnie-karte-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"
```

---

## R1 — POMIAR SUFITU SZABLONOWEGO: CZTERY LICZBY, NIE DWIE

**To jest rdzeń dyżuru.** Dotychczasowe pomiary dawały parę OFF/ON i wyprowadzały z niej wniosek
„kontrakt niczego nie ucina" — prawdziwy, ale niewystarczający. Mierzysz **cztery** stany:

| # | Rekord | Flaga | Co zapisujesz |
| --- | --- | --- | --- |
| 1 | realny, z **NIEPUSTYM** `initiativeTemplate` | OFF | pozycji · grup · id rekordu · nazwa szablonu |
| 2 | ten sam | ON | jw. |
| 3 | realny, z **PUSTYM** `initiativeTemplate` (albo bez szablonu) | OFF | jw. |
| 4 | ten sam | ON | jw. |

**Liczbę bierzesz WYŁĄCZNIE z uchwytu DOM**, nigdy ze zrzutu:

```bash
cd /private/tmp/cx-day324-szablon-tnie-karte
node scripts/dev/grafika-zrzuty.mjs \
  --zlicz='pozycje:[data-nmode-section-item];grupy:[data-nmode-section-group]' \
  --wynik-json=/private/tmp/cx-day324-szablon-tnie-karte-artefakty/r1-off-niepusty.json \
  <pozostałe parametry przelotu wg pomocy narzędzia>
#   oczekiwane dla stanu (1) i (2): pozycje 6, grupy 3 — IDENTYCZNIE, bo tnie szablon, nie flaga
#   oczekiwane dla stanu (3) i (4): pozycje 24, grupy 5 — IDENTYCZNIE
```

**`0` trafień jest wynikiem `0`, nigdy „pomiar się nie udał"** — brak pomiaru nie jest wynikiem.
Jeżeli selektor daje `0` na obu stanach, to znaczy, że **mierzysz nie ten ekran**: sprawdź, czy
komponent w ogóle się zamontował, zanim ogłosisz cokolwiek.

**Stan `localStorage` przed każdym z czterech pomiarów zapisujesz do raportu.** Pomiar w profilu
z zastanym kluczem `…:v2-contract:<id>` mierzy cudzy układ, nie produkt (pułapka 2).

Prawo zatrzymania po tej pozycji.

## R2 — RODZINA FLAG: SIEDEM WOŁACZY W JEDNEJ TABELI

**KROK 0 — wypisz rodzeństwo, zanim ruszysz cokolwiek.** Praca per-zgłoszenie daje „poprawne w 2
z 3". Tabela ma mieć siedem wierszy:

| Artefakt | Plik:linia wołacza | env | query `?cardContract=1` | `localStorage ff.cardContract` | tylko pod `DEV`? |
| --- | --- | --- | --- | --- | --- |

Dopiero mając komplet, rozstrzygasz trzy pułapki:

1. **Decyzja.** Zrównaj `useDecisionCardContractEnabled` z rodziną (odczyt `ff.cardContract`).
   **Wartość domyślna zostaje OFF** (`Z10`). Dowód mutacyjny obowiązkowy **w obie strony i wycelowany
   w ZABEZPIECZENIE, nie w mechanizm**: usuń odczyt `localStorage` → nowy test **CZERWONY**;
   przywróć przez `cp` z kopii w `SCRATCH` (`Z27`, nigdy `git stash`) → **ZIELONY**; `git diff` po
   cofnięciu **pusty**. Obie komendy i oba wyniki dosłownie w raporcie.
2. **Zastany `localStorage`.** Zaproponuj mechanizm (migracja klucza? jednorazowe czyszczenie
   przy zmianie wersji kontraktu?) jako **gotowy diff NIENAŁOŻONY** plus brief z promieniem
   rażenia. Nie nakładasz — to dotyka danych w przeglądarkach ludzi.
3. **Kolejność filtrów w `InitiativeDocumentView.tsx`.** **NIE NAKŁADASZ.** Produktem jest diff
   w bloku kodu + brief: co dokładnie się zmienia, ile typów kart dotyka, co widzi właściciel przed
   i po, i jak wyglądałby dowód mutacyjny.

Prawo zatrzymania po tej pozycji.

## R3 — PARA ZRZUTÓW ODBIORCZYCH NA REALNYM REKORDZIE

Kanonicznym `scripts/dev/grafika-zrzuty.mjs`, na **REALNYM rekordzie inicjatywy z listy**, z
**niepustym szablonem** — nie na id pokazowym. (Znany kształt fałszywego gotowego: realne
inicjatywy otwierają inny widok niż id pokazowe; odbiór rekordu = otwórz realny rekord z listy.)

Cztery kadry: light+dark × pl+en. Każdy obejrzany przez `Read` i opisany z nazwy: co widać, ile
sekcji, czego brakuje. **Para light/dark bitowo identyczna to defekt kadru, nie dowód** — narzędzie
zgłasza ją jako `IDENTYCZNE` z kodem wyjścia 1.

Uruchomienie pełnego runtime'u do zrzutów jest dozwolone **wyłącznie** przez kanoniczny
`scripts/dev/start-wave3-owner-runtime.mjs`, po wykonaniu dowodów (a) i (b) z `§0.2b` i po
spełnieniu wszystkich warunków punktu (4).

Prawo zatrzymania po tej pozycji.

## R4 — KOMPLETNOŚĆ ZADANIA I WNIOSKU

Wypisz **imiennie**, które z 10 pozycji katalogu Zadania nie mają renderu i dlaczego (nie „dwie
brakują" — nazwy). To samo dla ośmiu pozycji Wniosku poza dwudziestoma dwiema. Werdykt per pozycja:
**dług** (wtedy: gotowy diff nienałożony) albo **świadomy wybór produktowy** (wtedy: gdzie
zapisany — `DEC-…` ze ścieżką pliku; jeśli nigdzie, to jest dług).

Prawo zatrzymania po tej pozycji.

## R5 — INWENTARZ TYPÓW §13.1 BEZ KONTRAKTU

Tabela: artefakt z §13.1 · ma kontrakt (plik) · jeśli nie — czy ekran w ogóle istnieje w `src/`
(`grep` w `bash`, bez `| head` — obcięcie produkuje fałszywe sieroty). **Twoja liczba.** Zlecenie
mówiło „8 typów", ja policzyłem 7; jeśli wyjdzie Ci co innego, wiążący jest Twój pomiar.

Prawo zatrzymania po tej pozycji.

## R6 — PYTANIE DO WŁAŚCICIELA: NAZWY MENU 3

Wpis `DO DECYZJI WŁAŚCICIELA` z **obiema listami obok siebie** — sześć nazw z §13.1 i pięć grup
z produktu — kadrem obecnego stanu i jednym zdaniem: **„czego konkretnie mi zabrakło, żeby
rozstrzygnąć samodzielnie"**. Wpis bez tego zdania liczy się jako nierozstrzygnięty.

## R7 — RAPORT

Struktura `§R.2`. Obowiązkowo: cztery liczby z `R1` z zapisanym stanem `localStorage` przy każdej,
tabela siedmiu wołaczy, dowód mutacyjny Decyzji w obie strony, ścieżki czterech kadrów z opisem,
rejestr kompletności, wpis `DO DECYZJI WŁAŚCICIELA`, sekcja **TWIERDZENIA NIEZWERYFIKOWANE**
niepusta.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobione (cztery liczby), R2 zrobione, R3 rozpoczęte,
R4-R6 nietknięte" jest pełnowartościowym wynikiem — o ile R1 stoi na uchwycie DOM, a nie na
oglądaniu obrazka, i o ile R2 stoi na dowodzie mutacyjnym wycelowanym w zabezpieczenie.

**Odwrotna kolejność — inwentarze (R4/R5) zrobione, rdzeń (R1/R2/R3) „częściowo" — jest podstawą
odrzucenia.**

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela niżej | TAK |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone pętlą `[ -e "$p" ]` na worktree z markera; zero `BRAK` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, dziewięć wierszy |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (diff · brief · kontrakt · pomiar · wpis) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4 |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (325, 326) | TAK — `B.4.4`; porty 5490/6350 zmierzone jako wolne |
| 7 | Komendy paste-ready, z `#   oczekiwane: …` | TAK |
| 8 | Pułapki środowiska w całości + sześć pułapek modułu | TAK |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru" bez ścieżki | TAK |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu w dokumencie: `0`; wierszy `Z`: `41` | TAK |

### AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| Zakaz `Z10` „zero zmian flag" **vs** `R2` zmienia sposób odczytu flagi Decyzji | `Z10` (pole wyjątku) i `B.1` — zmiana SPOSOBU ODCZYTU nie jest zmianą wartości domyślnej; domyślna zostaje `OFF` |
| Zakaz `Z12` wymienia `scripts/dev/grafika-zrzuty.mjs` jako nietykalny **vs** `R1` może potrzebować nowej zdolności pomiarowej | `Z12` (wyjątek imienny) + `B.1` — wąska licencja, wyłącznie addytywna i opt-in |
| „Zmierz kompletność karty" **vs** `InitiativeDocumentView.tsx` tylko do odczytu | `B.1` i `B.2` — produktem `R2` jest **diff nienałożony** + brief; pozycja jest ZROBIONA |
| Zakaz `Z11` „nie odsłaniasz nowego ekranu bez akceptu" **vs** `R3` wymaga zrzutów przy fladze `ON` | `R3` + pole flag — flaga włączana **wyłącznie w Twoim harnessie**, do zrzutu; do repo nie wchodzi żadna zmiana domyślnej |
| Zakaz `Z13` „dokładnie JEDEN nowy dokument" **vs** `R1`/`R4`/`R5` piszą do rejestru | `Z13` (pole „jedyny inny dokument") — raport + jeden imiennie wskazany rejestr, nic więcej |
| Zakaz `Z30` „zero wysyłki" **vs** `R3` uruchamia pełny runtime do zrzutów | `§0.2b` punkt (4) — wyjątek wyłącznie dla zrzutów, po dowodach (a) i (b), z deklaracją dosłowną |
