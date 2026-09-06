# P10 — Analiza kart N: ekran + kontrakt treści (DEC-411, warunek MVP S1.13)

SSOT: `docs/ssot/STEROWANIE_KART_N_I_AI.md` (Zasada 1: „ekran nie może mieć sekcji spoza kontraktu ani sekcji pustych na wyrost”), SPEC-N (`Harvard/wdrozenie-100/_PLAN_WDROZENIA_KART_N_2026-07-21.md`, `_WERDYKT_KARTY_N_2026-07-22.md`), rejestr `src/components/standard/registry.ts`, typy kontraktu `src/components/standard/cardContract.types.ts`. Szablon: `00_SZABLON_PACZKI.md`. Słowo właściciela (06.09, przejście Wywiadu): „sprawdź dokładnie kontrakty w zakładce Wnioski w kreatorze, insighty i bardzo dokładnie kontrakty w inicjatywach — treść karty. W ramach jednego z warunków MVP właściciela trzeba zrobić analizę N-Card: jak wygląda ekran i jak wyglądają kontrakty.”

## 1. Cel dla użytkownika
Każda karta N (zadanie, decyzja, powiadomienie, wywiad, wniosek, inicjatywa, narzędzie, karta działania oraz karty poza rejestrem: notatka, pomysł, miernik, cel, kryterium audytu, raport, dokument, prezentacja, spotkanie) pokazuje dokładnie te sekcje, które obiecuje jej kontrakt — nic więcej, nic pustego, w tej kolejności i pod tymi nazwami — a każda sekcja ma źródło danych, które naprawdę ją wypełnia.

## 2. Zakres
- Rejestr: 8 kluczy `KartaNKey` (`tool`, `initiative`, `insight`, `interview`, `decision`, `notification`, `task`, `action`) → komponenty z `registry.ts` (`KnownToolDetailView`, `InitiativeDocumentView`, `InsightViewer`, `InterviewWorkspace`, `DecisionDetailView`, `NotificationDetailView`, `TaskDetailView`, `ActionCard`).
- Poza rejestrem (Codex ma je ZNALEŹĆ i wypisać, nie zakładać): notatka (`NotebookContent`), pomysł (`IdeaMapWorkspace` + `IdeaElementInspector`), miernik i cel (ResultsVNext), kryterium audytu (`CriterionWorkspaceV2`), raport audytu (`AuditReportDocumentView`), raport oceny (`AssessmentReportContractView`), dokument narzędzia (`ToolDocumentView`), prezentacja (DeckBuilder), spotkanie (`MeetingObjectPage`), dokument sejfu.
- WYŁĄCZONE z Fazy A Codexa (robi je równolegle Sonnet K1, raport `/private/tmp/stanowisko-noc/audyt-k1/RAPORT_K1.md` → po scaleniu `docs/program/PROGRAM_NAPRAWCZY_20260905/K1_WNIOSKI_INICJATYWY_RAPORT.md`): wniosek (kreator „Nowy insight” zakładka „Wnioski” + `InsightViewer`) i inicjatywa. Codex bierze je w Fazie B jako gotową tabelę.
- Moduły zamrożone: wszystkie 16 (`docs/program/MVP_FINAL_ZAMROZONE.json`) — marker `[ODMROZENIE <MODUL> DEC-411]`.

## 3. Przyczyna źródłowa (zweryfikowane na HEAD m03 06.09)
- `registry.ts:36-102`: 7 z 8 kart ma `statusMigracji: 'przed'` — kontrakt `KanonicznaKarta` istnieje jako TYP, ale karty go nie deklarują; nic mechanicznie nie porównuje sekcji ekranu z kontraktem.
- `CODEX_DAY82_KARTY_N_INWENTARZ_REPORT.md` (24.08) policzył karty, nie treść; `DEC387_KOMPLETNE_KARTY_INICJATYW_REPORT.md` naprawił inicjatywy punktowo; od tego czasu 3 dni przejścia właściciela dały rozjazdy typu „sekcja renderowana, nigdy nie wypełniana” (np. streszczenie dokumentu sejfu „—” bez writera; zakładka Dopuszczenie bez treści, DEC-410b).
- Kształt fałszywego gotowe nr 11 („biblioteka bez wywołania”) i 8 („wołacz istnieje ≠ renderuje się”) — dlatego pomiar musi być na REALNYM rekordzie z listy, z każdą sekcją rozwiniętą, a nie po kodzie.

## 4. Projekt rozwiązania
**Jedna tabela, jeden format, dla każdej karty.** Per karta plik `docs/program/PROGRAM_NAPRAWCZY_20260905/P10/<karta>.md` z tabelą:

| sekcja / zakładka / pole | kontrakt mówi (plik:linia lub „brak kontraktu”) | ekran pokazuje (plik:linia + zrzut) | źródło danych (API pole → writer w `server/src` plik:linia, albo „MARTWE: brak writera”) | rozjazd | waga |

Rodzaje rozjazdu (słownik zamknięty): `brak` · `sekcja poza kontraktem` · `sekcja z kontraktu nieobecna` · `pusta na wyrost` (renderowana bez writera) · `etykieta inna` · `kolejność inna` · `angielski`. Waga: `blokuje MVP` (użytkownik widzi pustkę, kłamstwo lub angielski w głównym przepływie) · `kosmetyka`.

**Karta bez kontraktu = kontrakt do napisania, nie do zgadnięcia.** Jeżeli karta nie ma kontraktu w kodzie ani w SPEC-N, Codex spisuje kontrakt ZASTANY (to, co ekran robi dziś, po polsku, sekcja po sekcji) jako propozycję w tym samym pliku, oznaczoną „PROPOZYCJA — do słowa właściciela”. Nie wdraża go.

**Faza B (naprawy) tylko dla rozjazdów bez decyzji:** `angielski`, `etykieta inna` (gdy kontrakt podaje etykietę), `pusta na wyrost` → sekcja przestaje się renderować, gdy brak danych (nie: usunięcie kodu), `kolejność inna` (gdy kontrakt podaje kolejność). Rozjazdy `sekcja poza kontraktem` i `sekcja z kontraktu nieobecna` → tabela decyzji dla właściciela (jedno pytanie na wiersz, z rekomendacją), NIE naprawa w ciszy.

**Zakazy kanonu:** powłoka `StandardArtifactShell` + `ArtifactRightPanel`; tokeny `c-*`; zero `primary-*`; fokus `c-focus`; i18n pl+en; zero nowych flag.

## 5. Kroki wykonania
1. (S) Inwentarz: lista WSZYSTKICH kart N — rejestr 8 + poza rejestrem; dla każdej: komponent, trasa, jak otworzyć z listy (REALNY rekord na stanowisku), czy ma kontrakt (gdzie). Plik `P10/00_INWENTARZ.md`.
2. (L) Faza A — tabela per karta (§4) dla wszystkich kart poza `insight` i `initiative`. Zrzut per karta: 1440, jasny, każda sekcja rozwinięta (zwinięta sekcja nie jest dowodem; Menu 5 / lewy spis — klik po kolei), do `evidence/p10-karty-n/<karta>/`.
3. (S) Wciągnięcie `K1_WNIOSKI_INICJATYWY_RAPORT.md` (jeśli już jest w repo) jako `P10/insight.md` i `P10/initiative.md`; jeśli jeszcze go nie ma — Codex robi te dwie karty sam wg §4 i zaznacza to w raporcie.
4. (M) Faza B — naprawy rozjazdów bez decyzji (§4), commit per karta z markerem `[ODMROZENIE <MODUL> DEC-411]`.
5. (S) `P10/99_DECYZJE_WLASCICIELA.md` — tabela pytań (karta · rozjazd · rekomendacja · co się stanie po „Tak”), maksymalnie jedno pytanie na wiersz, po polsku, bez żargonu.
6. (S) `P10/98_RAPORT.md` — liczby: kart zmierzonych / z kontraktem / bez kontraktu; rozjazdów per rodzaj przed i po Fazie B; sekcji martwych (bez writera) — lista imienna.

## 6. Testy
- Test strukturalny `src/components/standard/__tests__/registry.kompletnosc.test.ts` (nowy, `git add -f`): każda karta z `P10/00_INWENTARZ.md` oznaczona „karta N” ma wpis w `REJESTR_KART_N` ALBO jawny wpis na liście wyjątków z powodem — mutacja: usuń wpis → RED.
- Dla każdej naprawy `pusta na wyrost`: test renderu „sekcja X nie renderuje się, gdy brak danych; renderuje się, gdy dane są” — mutacja: przywróć bezwarunkowy render → RED.
- Zrzuty: 1440 jasny, per karta, wszystkie sekcje rozwinięte, realny rekord (zero rekordów testowych; nic nie tworzyć, nic nie zapisywać).

## 7. Kryterium odbioru właściciela
Właściciel dostaje jedną tabelę (karta · liczba sekcji · rozjazdy blokujące przed → po) i listę pytań z rekomendacjami; otwiera trzy karty z listy (wniosek, inicjatywa, zadanie) i widzi tylko sekcje z treścią, po polsku, w kolejności kontraktu.

## 8. Ryzyka i cofanie
Faza A jest tylko odczytem — zero ryzyka. Faza B: każda karta osobnym commitem; cofanie = `git revert` commitu karty. Ryzyko fałszywego pomiaru: harness dev-render pokazuje kompozycję, której w aplikacji nie ma (kształt 15) — dlatego zrzuty WYŁĄCZNIE ze stanowiska (realna trasa, realny rekord), nigdy z dev-render.

## 9. Nakład
Codex: Faza A ~1 dyżur (L), Faza B ~1 dyżur (M). Równolegle: Sonnet K1 (wniosek + inicjatywa, w toku od 06.09 13:35).

## 10. Cel osiągnięty = samokontrola Codexa (praca do celu)

**Komendy po każdym kroku Fazy B:**
```bash
cd <worktree>
npx esbuild <każdy dotknięty plik> --loader:.tsx=tsx --outfile=/dev/null      # exit 0
npx vitest run --retry=0 --reporter=json --outputFile=/private/tmp/p10/<krok>.json <dotknięte testy>
bash scripts/check-list-canon.sh && bash scripts/check-artefakt.sh && bash scripts/check-teresa-kontrakty.sh   # exit 0
```
`numFailedTests` = 0 i zero `skipped` — kod wyjścia 0 przy `skipped` nie jest PASS. Zastane czerwone: policz PRZED pierwszą zmianą (zapisz `/private/tmp/p10/baza.json`), nowe = 0.

**Progi liczbowe (bramka STOP):**

| Miara | Jak zmierzyć | Próg |
|---|---|---|
| karty zmierzone | wiersze `P10/00_INWENTARZ.md` z plikiem `P10/<karta>.md` i zrzutem | **= 100 % inwentarza** (minimum 8 z rejestru + ≥ 8 poza rejestrem; jeśli poza rejestrem znajdziesz mniej niż 8 — napisz dlaczego, nie zaokrąglaj) |
| sekcje bez wiersza | każda sekcja widoczna na zrzucie ma wiersz w tabeli | **0 sekcji bez wiersza** |
| `pusta na wyrost` po Fazie B | grep tabel po słowie `pusta na wyrost` w kolumnie „po” | **0** |
| `angielski` po Fazie B | stop-lista EN na zrzutach (`scripts/dev/...` jeśli jest, inaczej ręcznie z listą tokenów w raporcie) | **0** |
| rozjazdy z decyzją | wiersze `99_DECYZJE_WLASCCIELA.md` | każdy `sekcja poza kontraktem` / `nieobecna` ma dokładnie jeden wiersz pytania |
| zrzuty | `evidence/p10-karty-n/<karta>/*.png`, 1440, jasny, `mean_luma > 150` | 1 komplet per karta, wszystkie sekcje rozwinięte |

**Pomiar na żywo:** własne worktree, własny vite na wolnym porcie (`VITE_DOTENV_DISABLED=1 VITE_API_TARGET=http://127.0.0.1:4100`, stanowisko lokalne: API 4100, PG 54400 — NIE uruchamiaj własnego serwera, NIE dotykaj `/private/tmp/m03` ani `/private/tmp/stanowisko-noc` poza `cp auth.json`). Narzędzie `scripts/dev/stanowisko-lokalne/zrzut.mjs` (README obok). Rekordy: tylko istniejące, otwierane z listy; zero tworzenia, zero zapisu.

**Warunek STOP:** wszystkie progi spełnione → commit + `P10/98_RAPORT.md`. Próg niespełnialny bez decyzji właściciela → wiersz w `99_DECYZJE_WLASCICIELA.md` i praca dalej nad resztą; zatrzymanie całości tylko, gdy stanowisko lokalne nie działa (wtedy raport STOP z pomiarem `curl http://127.0.0.1:4100/api/health`).

**Zakazy:** `--no-verify`, `git stash`, `pkill`, sparse-checkout, `git worktree remove/prune`, `rm -rf` poza własnym worktree, tworzenie flag, edycja modułów zamrożonych bez markera `[ODMROZENIE <MODUL> DEC-411]`, pytania do właściciela (niejasność → wiersz w `99_DECYZJE`), tworzenie rekordów w bazie, push.

## 11. Wklejka dla Codexa

```markdown
ZADANIE P10 — Analiza kart N: ekran + kontrakt treści (DEC-411, warunek MVP S1.13).

KATALOG ROBOCZY: własne worktree z `origin/staging` (nowa gałąź `codex/p10-karty-n`, commit-per-krok, BEZ push).
Pełna paczka (WIĄŻĄCA): docs/program/PROGRAM_NAPRAWCZY_20260905/P10_KARTY_N_ANALIZA.md — przeczytaj w całości.
Zasady: docs/ssot/STEROWANIE_KART_N_I_AI.md (Zasada 1), src/components/standard/registry.ts, cardContract.types.ts.

CEL: każda karta N pokazuje dokładnie sekcje z kontraktu — nic poza, nic pustego, po polsku, w kolejności
kontraktu — i każda sekcja ma writer w server/src, który ją naprawdę wypełnia.

FAZA A (odczyt, żadnych zmian kodu):
1. P10/00_INWENTARZ.md — WSZYSTKIE karty N: 8 z rejestru + poza rejestrem (notatka, pomysł, miernik, cel,
   kryterium audytu, raport audytu, raport oceny, dokument narzędzia, prezentacja, spotkanie, dokument sejfu —
   znajdź, nie zakładaj). Per karta: komponent, trasa, jak otworzyć REALNY rekord z listy, gdzie kontrakt.
2. Per karta plik P10/<karta>.md z tabelą (dokładnie te kolumny):
   sekcja | kontrakt mówi (plik:linia / „brak kontraktu”) | ekran pokazuje (plik:linia + zrzut) |
   źródło danych (API pole → writer server/src plik:linia / „MARTWE: brak writera”) | rozjazd | waga
   Rozjazd ze słownika: brak · sekcja poza kontraktem · sekcja z kontraktu nieobecna · pusta na wyrost ·
   etykieta inna · kolejność inna · angielski.  Waga: blokuje MVP · kosmetyka.
   Karta bez kontraktu → spisz kontrakt ZASTANY jako „PROPOZYCJA — do słowa właściciela”. Nie wdrażaj.
   POMIŃ w Fazie A: insight (wniosek) i initiative (inicjatywa) — robi je równolegle Sonnet K1; jeśli w repo
   jest już docs/program/PROGRAM_NAPRAWCZY_20260905/K1_WNIOSKI_INICJATYWY_RAPORT.md, wciągnij go jako
   P10/insight.md i P10/initiative.md; jeśli nie ma — zrób te dwie karty sam i zaznacz to w raporcie.
3. Zrzuty: evidence/p10-karty-n/<karta>/ — 1440, jasny, KAŻDA sekcja rozwinięta, realny rekord otwarty
   z listy na stanowisku lokalnym (API 4100, własny vite: VITE_DOTENV_DISABLED=1
   VITE_API_TARGET=http://127.0.0.1:4100; narzędzie scripts/dev/stanowisko-lokalne/zrzut.mjs, README obok).
   NIGDY z dev-render (pokazuje kompozycję, której w aplikacji nie ma). Zero tworzenia rekordów, zero zapisu.

FAZA B (naprawy TYLKO rozjazdów bez decyzji), commit per karta, marker [ODMROZENIE <MODUL> DEC-411]:
   angielski → polski (i18n pl+en); etykieta inna / kolejność inna → wg kontraktu (gdy kontrakt je podaje);
   pusta na wyrost → sekcja NIE renderuje się bez danych (nie usuwaj kodu) + test: bez danych brak, z danymi
   jest; mutacja (bezwarunkowy render) → RED.
   sekcja poza kontraktem / z kontraktu nieobecna → NIE naprawiaj; wiersz w P10/99_DECYZJE_WLASCICIELA.md
   (karta · rozjazd · rekomendacja · co się stanie po „Tak”), jedno pytanie na wiersz, po polsku.
   Nowy test src/components/standard/__tests__/registry.kompletnosc.test.ts (git add -f): każda karta N
   z inwentarza ma wpis w REJESTR_KART_N albo jawny wyjątek z powodem; mutacja (usuń wpis) → RED.

KANON: StandardArtifactShell + ArtifactRightPanel; tokeny c-*; ZERO primary-* (każdy numer = crimson);
fokus c-focus; i18n pl+en; zero nowych flag.

PROGI (STOP dopiero gdy wszystkie spełnione):
- karty zmierzone = 100 % inwentarza (min. 8 rejestr + ≥ 8 poza; mniej → napisz dlaczego, nie zaokrąglaj);
- 0 sekcji widocznych na zrzucie bez wiersza w tabeli;
- po Fazie B: 0 „pusta na wyrost”, 0 „angielski”; każdy rozjazd z decyzją ma dokładnie 1 wiersz w 99_DECYZJE;
- 1 komplet zrzutów per karta (1440, jasny, mean_luma > 150, wszystkie sekcje rozwinięte);
- esbuild per plik exit 0; vitest --reporter=json: numFailedTests = 0, zero skipped, zastane czerwone policzone
  PRZED zmianami (/private/tmp/p10/baza.json), nowe = 0; check-list-canon, check-artefakt,
  check-teresa-kontrakty exit 0.
RAPORT: P10/98_RAPORT.md — kart zmierzonych / z kontraktem / bez; rozjazdów per rodzaj przed → po;
sekcje MARTWE imiennie; lista commitów; ścieżki zrzutów; co niezmierzone i dlaczego.
Próg niespełnialny bez decyzji właściciela → wiersz w 99_DECYZJE i praca dalej; STOP całości tylko gdy
stanowisko nie działa (raport z curl http://127.0.0.1:4100/api/health).

ZAKAZY: --no-verify, git stash, pkill, sparse-checkout, git worktree remove/prune, rm -rf poza własnym
worktree, flagi, edycja modułów zamrożonych bez markera, pytania do właściciela, tworzenie rekordów, push,
dotykanie /private/tmp/m03 i /private/tmp/stanowisko-noc (poza cp auth.json).
Pracuj, aż wszystkie progi są spełnione albo każdy niespełniony ma wiersz w 99_DECYZJE.
```
