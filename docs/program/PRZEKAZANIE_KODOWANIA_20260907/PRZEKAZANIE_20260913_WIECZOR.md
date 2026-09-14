---
doc_id: przekazanie-20260913-wieczor
status: canonical
truth_type: handover
established: 2026-09-13 (~22:00, koniec sesji integratora Fable)
author: CTO (Fable, sesja 13.09)
---

# PRZEKAZANIE — wieczór 13.09.2026

Nowy tryb od rana 13.09 (słowa właściciela): **Fable nigdy nie koduje ani nie pisze instrukcji —
planuje i zarządza agentami Opus/Sonnet**; poprzedni tryb „całość Codexem" (12.09) po stronie
nadzorcy jest uchylony. **Codex pracuje autonomicznie** na osobnym kanale plikowym
(`~/Developer/cto-codex/KANAL.md` = zlecenia, `OD_CODEXA.md` = meldunki), czyta plik co cykl,
sam sobie wystawia HOLD-y. Właściciel odbiera **jeden obraz, Tak/Nie**; pełne zgody na operacje
MVP z punktem cofnięcia; **produkcja nietykalna**.

## 1. Stan zmierzony (13.09, ~22:00 — komendy, nie pamięć)

| Co | Wartość |
|---|---|
| staging health | `gitSha=90833bc94adb7e6827882f9963c796365dea371b`, database/redis connected |
| demo health | **identyczne** `90833bc94adb7e6827882f9963c796365dea371b`, database/redis connected |
| tag `staging-deployed` | `90833bc94adb7e6827882f9963c796365dea371b` (zgodny z health) |
| linia integracyjna `origin/integracja/20260911` | `7499ac8bf8` — „rejestr: koniec dnia 13.09" |
| kandydat/stanowisko integratora | worktree `~/Developer/wt/kandydat-20260913`, gałąź `integracja/kandydat-20260913`, HEAD `7499ac8bf8`, drzewo czyste |
| kopie zapasowe (`origin/backup/*`) | **105 gałęzi** |
| tagi cofnięcia z 13.09 (`*safe-20260913*`) | **12** |
| dysk (`df -h ~`) | **24 GiB wolne / 99% zajęte** (partycja 1.8 TiB) — spadek z „63 GiB" po sprzątaniu rannym; nie ufaj poprzedniej liczbie, zmierz ponownie |
| `wt/*` do sprzątnięcia | `kandydat-20260913` (aktywny, zostaje) + 18 innych: `bank-kolumny`, `baza-60051310d7`, `docs-fala2`, `j9-tmp`, `k5-naprawy`, `kanon-sweep`, `narzedzia`, `parytet-naprawy`, `preview`, `preview-work`, `preview2`, `reports`, `s14`, `s14-work`, `s14b`, `s14b-work`, `scalenie-sweep`, `work-kolumny`, `workreport` |
| kontenery Docker żywe | `cx-f23-pg`, `cx-f2e-pg`, `s14-pg`, `cx-codex6-pg` — wszystkie do przeglądu przed usunięciem worktree, którym służą |
| gałęzie Codexa, najświeższe (`codex/*`) | `codex/pmo-projekty-role-statusy-20260913` (21:44), `codex/realizacja-cztery-przyciski-20260913` (20:44), `codex/inicjatywy-cztery-przyciski-20260913` (20:19), `codex/enterprise-trust-pack-20260913` (19:42), `codex/interview-answer-approval-20260913` (19:04) |

**Nic nowe od 20:25 nie jest wdrożone poza tym, co już opisuje ten pomiar** — staging i demo są na tym samym SHA `90833bc94a`/pochodnym `c1e8fba7c2`-łańcucha z końca dnia.

## 2. Co się wydarzyło (13.09, chronologicznie)

**Rano — zamrożenie i nowy tryb.** Kandydat Codexa `codex/integrator-mvp-20260912-rc2` zamrożony
na `5de710ff46` (tag `kandydat-mvp-20260913`), scalony na linię jako `cfea70de8a`
(`integracja/kandydat-20260913`). Po `git cherry` (patch-id) obalona premisa nocnego przekazania:
**wszystkie 6 gałęzi W17 i C6-DEL-OFF już SĄ w rc2** — nic nie zostało „poza kandydatem" poza
`c6-export-contract` (+19, HOLD, fala 2) i `zatwierdzanie-inicjatyw` (+1, DEC-474, fala 2).
Umowa CTO↔Codex spisana w KANAL.md Wpis 1: Codex dostaje duże, samodzielne paczki na własnych
gałęziach z niezależnym przeglądem; STOP na rc2; zakaz push na staging/demo/Londyn/integracja,
deployu, migracji bez zgody, `--no-verify`.

**K1→K4 (bramka, parytet, wdrożenie).** K2 (bramka kandydata): pierwszy pomiar dał **CZERWONĄ**
(3 nowe czerwienie testowe na 133 zmienionych plikach testowych — 1 realna regresja
`executionBankEvidenceReadService.adversarial.test.ts`, 1 punktowa regresja w
`ExecutionControlSurface.raidSygnaly.test.tsx`, reszta niezmierzona z powodu wymogu żywej Postgres);
naprawione tego samego dnia → rejestr odnotowuje **K2 ZIELONA 13.09**
(`BRAMKA_K2_cfea70de8a_20260913.md`: tsc serwera 0, tsc frontu 189≤192, kanon 322/8-0-117 = baza,
build OK). K3 (parytet flag OFF): zamknięte — test strażniczy `parytet-flagi-off.test.ts` 21/21
+ 11 czerwonych mutacji, 7 różnic pozostałych uznane za zamierzone (410 na usuwaniu org, Finanse
„wkrótce", itd.). K4: pierwsze wdrożenie stagingu `bc40d5327c` 08:17 (tag cofnięcia
`staging-safe-20260913-pre-kandydat` = `60051310d7`).

**Cały dzień — seria napraw i wdrożeń.** Staging: `bc40d5327c` 08:17 → `14b9bb5efd` 11:10 (naprawy K5
+ raport S1.4/S1.4b) → `0f0107b93c` 12:26 (naprawy Idea/Notes/Docs) → `1464992c30` 19:06 (naprawy
odbioru: kolumna główna, typy kolumn banku, podgląd banku jak Inicjatywy) → `c1e8fba7c2` 20:10/20:17
(przejazd kanonu K5-7: `columnWidthCanon.ts`, `FilterableTable`, `PreviewRelations`,
`PreviewMetaCard`, `PreviewPaneShell`, strażnik +R4/R5/R6 baseline 349) → `90833bc94a` (typy kolumn
Work/Decyzje/Raporty, koniec zlewania DUE/STATUS). Demo: `0f0107b93c` 14:02 (po DEC-491), potem
`c1e8fba7c2` 20:25. Tagi cofnięcia rosną co wdrożenie (`staging-safe-20260913-*`,
`demo-safe-20260913-*`) — 12 naliczonych na koniec dnia.

**Raport bramki po scaleniu napraw Realizacji** (`BRAMKA_K5_scalenie_20260913.md`, mierzone
NIEZALEŻNIE dwukrotnie z identycznym wynikiem): wszystkie bramki numeryczne zielone (tsc, kanon,
język, build), ale **1 NOWA regresja testowa** (`ExecutionResources.wiszacaRealizacja.test.tsx` —
przechodzi na bazie `cf3fded7e4`, nie przechodzi po scaleniu) → werdykt bramki **CZERWONA**, mimo
9 pozostałych czerwieni ZASTANYCH identycznych z bazą. **To zostaje otwarte dla następcy** (§3).

**Odbiór właściciela (K5).** Inicjatywy = **TAK** (DEC-481, uwaga: za dużo filtrów w Menu 2 →
naprawione). Realizacja = **TAK warunkowo** (DEC-491: „preview nie jest zgodne ze standardem, reszta
ok") + 8 uwag na żywo (kolumny po równo, podglądy bank/Work/Risk niekanoniczne, Reports bez akcji,
„Work report" = surowy wykaz) → **6 z 8 zamknięte i wdrożone tego samego dnia** (przejazd kanonu
K5-7); pozostałe 2 (puste ramki Relations w niektórych ścieżkach, „What's next" w podglądzie
Decisions) w toku. Obraz porównawczy „Wniosek (wzorzec) vs bank vs Inicjatywy" wysłany właścicielowi
wieczorem — **czeka na Tak/Nie** (§3).

**Poczta.** Staging ożył 09:25 (`noreply@consultinity.ai`, DEC-471 domknięte po stronie stagingu;
przyczyna martwej skrzynki `hello@consultinity.com`: zawieszona po stronie Hostingera, niedokończona
weryfikacja domeny — wiadomość do Konrada przygotowana). **Znalezisko poboczne: produkcja
consultify.ai miała tę samą martwą skrzynkę** — zmienne SMTP zmienione na Railway
(`--skip-deploys`, punkt cofnięcia `poczta-PRODUKCJA-20260913-przed.txt`), ale **proces produkcyjny
wciąż działa ze starą skrzynką w pamięci — poczta produkcyjna ożyje dopiero po restarcie serwisu**,
celowo niewykonanym (decyzja CTO). Health produkcji sprawdzony, nietknięty.

**Pilotaż.** Konta `pawel.mroczkowski@dbr77.com` i `justyna.laskowska@dbr77.com` gotowe na stagingu
(hasła `~/Developer/consultify-secrets/pilot-20260913-hasla.txt`), instrukcje PDF wysłane. **Do
popołudnia zero aktywności** (§3 — pierwsze zadanie następcy).

**Fala 2 (Codex, cztery/pięć torów równoległych).** Paczka 5 (Wywiad — zatwierdzanie odpowiedzi):
niezależny ACCEPT, commit `06b34552` na własnej gałęzi Codexa — **dostawa NIE zgłoszona/scalona
przez CTO** (§3, krok 4 następcy). F2-1 (Inicjatywy 4 przyciski): przebazowane na `c1e8fba7c2`,
**GREEN** po rebase (freeze V4 137/137), zrzuty E1 czekają na akcept właściciela. F2-2 (Realizacja
4 przyciski): przebazowane, **HOLD** — ostatni P2 to realny brak wersji w kanonicznym podglądzie
(`executionCaseVersion:null` renderuje się jako „Linked · v—"). F2-3 (PMO): E1 i E2 dostarczone
z niezależnym ACCEPT (E2 commit `7d20679630`), **E3 nie ruszyło**. F2-E (Enterprise/eksport):
klasyfikacja schema-aware ma ACCEPT (1930/1930 sklasyfikowane), ale **pełne E1 nadal HOLD** i Codex
**czeka na zgodę CTO** na nową migrację addytywną (`organization_export_jobs`/`organization_export_parts`,
pula `20262200–20262219`) do trwałego wznowienia eksportu po restarcie — **decyzja stoi otwarta**
(§3). F2-7b nie rozpoczęte, w kolejce.

**Prace własne integratora (Sonnet pod Fable).** F2-7 — audyt 42 miejsc pracy konsultanta: 7 bez
kontraktu (17%), 14 „na oko" (33%), 16 częściowych (38%), 5 twardych kontraktów-wzorców (12%; DRD,
Inicjatywa, Wniosek, Finanse, Excel). F2-13 — analiza „CEO wielkiej trójki": Big3 nie kupuje
narzędzi dla własnych konsultantów (mają Lilli/Deckster/Sage), realny pierwszy kupujący to klient
końcowy firmy doradczej; SSO fikcyjne (503 na SAML/OIDC), i18n pozorne poza EN/PL (~7% pokrycia
pozostałych języków), eksport organizacji HOLD z 1918 UNRESOLVED w jednym z wcześniejszych
przebiegów. Rozliczenie notatek właściciela (K8): SPEC_FALA2 pokrycie **196/196** myśli atomowych
(193 już pokryte przed pracą, 3 częściowe domknięte, 0 całkowitych braków).

## 3. Blokery i punkty otwarte

| # | Co | Stan | Kto decyduje |
|---|---|---|---|
| 1 | Obraz „Wniosek (wzorzec) vs bank vs Inicjatywy" | wysłany właścicielowi, **czeka na Tak/Nie**; przy „Nie" → wyłączyć podgląd w Realizacji, NIE iterować | właściciel |
| 2 | F2-E: migracja `organization_export_jobs`/`organization_export_parts` (pula 20262200–20262219) | Codex zgłosił `MIGRATION_REQUIRED`, czeka na zgodę CTO i rozstrzygnięcie semantyki (A: trwałe części per-capture / B: staging całego snapshotu) | CTO (następca) |
| 3 | Paczka 5 (Wywiad) | niezależny ACCEPT Codexa, **nie scalona ani nie wdrożona** przez CTO | CTO (następca) |
| 4 | K5-gate regresja `ExecutionResources.wiszacaRealizacja.test.tsx` | NOWA regresja (nie zastana) po scaleniu napraw Realizacji, niezamknięta | CTO/agent Sonnet |
| 5 | F2-2 (Realizacja 4 przyciski) | HOLD — `executionCaseVersion:null` renderuje `v—` zamiast opisowego braku danych | Codex (w naprawie) |
| 6 | Poczta produkcji | zmienne SMTP zmienione, **wymaga restartu serwisu** żeby zadziałać — celowo niewykonane | CTO (następca) |
| 7 | Pilotaż — zero aktywności do popołudnia | sprawdzić `feedback_items`, `users.last_login`, `created_at >= dziś` po tabelach biznesowych | następca, krok 1 |
| 8 | Rejestr Inicjatyw, otwarty podgląd = 259 px przewijania | granica fizyczna podłóg nagłówków; dalsze chowanie kolumn = decyzja produktu | właściciel |
| 9 | Dane DBR77 — śmieciowe inicjatywy z czatu (S1.7) | higiena danych nieuruchomiona | następca |
| 10 | 403 `POST /api/v10/teresa/voice-event` przy wejściu w bank/Insights | niezdiagnozowane | następca |
| 11 | „What's next" tekstowe w Work/Decisions (`executionPreviewHead`) | do sprawdzenia z kanonem §7.3a | następca |
| 12 | Kontrakt `tableSurface/validators.ts:470` (`relations.emptyLabel`) vs ukrywanie pustego bloku | sprzeczność nierozstrzygnięta (TRIADA §A7 rozstrzygnęła ogólną zasadę, ten kontrakt osobno) | następca |
| 13 | Narracja raportu oceny po polsku niezależnie od języka (`assessmentNarrativeComposer.ts`) | decyzja produktowa nieotwarta | następca |
| 14 | `' — nie odpowiada'` — literał PL w `ExecutionResourcesSurface.tsx:681` | kosmetyka i18n | następca |
| 15 | 8 z 12 szablonów raportów Wave 2 bez akcji | niedokończone | fala 2 |
| 16 | „First Value plan" 404 (`/onboarding/generate-plan`) | niezdiagnozowane | następca |
| 17 | Sprzątanie `wt/*` i kontener `s14-pg` (6472) | 18 katalogów robocze do przeglądu i usunięcia po scaleniu; gałęzie zostają, kopie na `origin/backup/*` | następca |

## 4. Decyzje właściciela 13.09 (DEC-477…493, wszystkie w rejestrze)

| Nr | Treść (skrót) |
|---|---|
| DEC-477 | Poprawki W17 (Materiały/prezentacje/notatnik) zostają w kandydacie — wycięcie = przebudowa 147 commitów |
| DEC-478 | Pilotaż na stagingu BEZ pełnego eksportu; usuwanie org = odmowa 410 (C6-DEL-OFF); pełny eksport → fala 2 |
| DEC-479 | Odrzucona/wstrzymana inicjatywa dostaje pole „rozstrzygnięcie" (wchodzi/parking/archiwum); lista statusów nie rośnie |
| DEC-480 | Obciążenie zespołu liczone PER CZŁOWIEK (deklarowana część czasu tygodniowo), heat-mapa, >100% czerwono |
| DEC-481 | Lista Inicjatyw na kandydacie = TAK, z uwagą „za dużo filtrów w Menu 2" → naprawione |
| DEC-482 | Pierwszy kupujący fali 2 = partner Big3 kupujący dla swoich zespołów (A, wbrew rekomendacji CTO „C") |
| DEC-483 | Pakiet enterprise TERAZ jako trzeci tor Codexa (SSO, pełny eksport, audyt AI, SOC 2); języki fali 2: tylko niemiecki |
| DEC-484 | Pierwszy artefakt sprzedażowy = bezbłędna 30-min pętla pokazu na danych jednego klienta |
| DEC-485 | Granica praw decyzji = macierz 3 poziomów (zadanie/członek · inicjatywa/PM · baza odniesienia/komitet) |
| DEC-486 | W Realizacji wolno zmieniać przydziały ludzi wg macierzy poziomów decyzji |
| DEC-487 | Sygnalizacja ryzyka = 3 osie × 4 poziomy, zawsze kolor+tekst+ikona, szary „brak danych" |
| DEC-488 | Metodyka PMO = PMI/PMBOK-lite + bramki etapów + tygodniowy rytm przeglądów |
| DEC-489 | Zatwierdzenia = rozszerzenie istniejącego silnika (bramki, poziomy, quorum, delegacje) |
| DEC-490 | Statusy inicjatyw = 12 etapów silnika runtime jako jedyna prawda; 7 etykiet legacy wygaszane |
| DEC-491 | Realizacja na kandydacie = TAK z warunkiem (preview do kanonu podglądu) → K4 wykonane (staging+demo) |
| DEC-492 | MVP rdzenia = dzisiejszy rdzeń doprowadzony do kanonu; 4 przyciski docelowe wchodzą etapami z F2-1/F2-2 |
| DEC-493 | Pozostałe otwarte decyzje fali 2 rozstrzygnięte wg rekomendacji CTO (Agent, ryzyko, enterprise, kontrakty) |

## 5. Porządek dokumentów — nie łam go

Nadal żyją dokładnie dwa dokumenty: `TRZY_POJEMNIKI_PRACY_20260906.md` (sekcja „STAN NA
13.09.2026 rano" — liczby paczek 1/2/3) i `PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md`
(sekcja `★ AKTUALNE ZLECENIA` na górze = jedyne obowiązujące zlecenia, tabela K1–K9). **Nowe pliki
planów nie powstają.** Nowość dnia: kanał plikowy Codexa (`~/Developer/cto-codex/KANAL.md` +
`OD_CODEXA.md`) jest OSOBNY od rejestru CTO — nie edytuj skrzynki `01_INDEKS...md` w imieniu
Codexa, on dopisuje tylko do historii niżej. Specyfikacja fali 2 (`docs/program/FALA2/*`) rośnie
per temat (`F2-7_...`, `F2-13_...`, `SPEC_FALA2_20260912.md` z tabelą pokrycia 196/196) — to są
materiały robocze fali 2, nie nowe plany konkurencyjne wobec dwóch żyjących dokumentów.

**Wiersz Z-0.** W skrzynce rejestru (`01_INDEKS_I_HARMONOGRAM.md`, sekcja `★ AKTUALNE ZLECENIA`)
dopisany jeden wiersz **Z-0** wskazujący ten plik jako punkt startu następcy — zastępuje
(nieistniejący formalnie, ale przywoływany w PRZEKAZANIE NOC) wpis z nocy. Konwencja na przyszłość:
Z-0 = zawsze pointer do najświeższego pliku `PRZEKAZANIE_*`, aktualizowany na końcu każdej sesji.

## 6. Pięć kroków następcy (kolejność)

1. **Zgłoszenia pilotażu i meldunki Codexa.** Sprawdź `feedback_items`, `users.last_login`,
   `created_at >= dziś` na kontach Pawła i Justyny; przeczytaj `OD_CODEXA.md` od góry (najświeższe
   wpisy na początku pliku) — co najmniej wpisy 7–13 z 13.09 wieczór.
2. **Tak/Nie właściciela na obraz podglądu** (Wniosek/bank/Inicjatywy). Jeśli „Nie" —
   **wyłącz podgląd w Realizacji za flagą, nie iteruj** (słowa właściciela).
3. **Higiena danych DBR77** (S1.7, śmieciowe inicjatywy z czatu) + decyzja o kolejnych kolumnach
   rejestru Inicjatyw do schowania (259 px przewijania z otwartym podglądem).
4. **Odbiór dostaw Codexa.** Paczka 5 (Wywiad): scalenie → bramka → wdrożenie. F2-1 E1: zrzuty
   gotowe → pokaż właścicielowi. Zdecyduj o migracji F2-E (blokuje Codexa, patrz §3.2).
5. **Reszta listy otwartej (§3) + sprzątanie `wt/*`** — worktree wypchnięte kopiami mogą zniknąć,
   gałęzie zostają na origin/backup.

## 7. Błędy nadzorcy 13.09 (uczciwie)

1. **Dwa agenty bramki uruchomione naraz w jednym worktree** → fałszywa czerwień (artefakt
   równoległej pracy, nie realny defekt) — trzeba było rozdzielić worktree.
2. **Agent zrzutów próbował wysłać obraz właścicielowi, zanim CTO go zobaczył** — zatrzymany
   w porę, ale to złamałoby złotą zasadę „Piotr nigdy nie jest pierwszym testerem wizualnym".
3. **Jałowe scalenie przez brakujące znaczniki hooka** → jałowe wdrożenie tego samego SHA (commit
   scalający bez realnej zmiany drzewa, hook przepuścił bo znaczniki modułów się zgadzały
   przypadkiem).
4. **Dispatch workflow na starym refie** (`gh workflow run --ref staging` 8 s po pushu wziął stary
   `headSha`) — wdrożył ponownie stary SHA i skasował równoległą, właściwą budowę Railway; 30 min
   straty zanim health to ujawnił.
5. **Powtarzalne niekanoniczne podglądy** zamiast jednego przejazdu kanonu od rana — właściciel
   wprost: „poszukaj opisu jak ma wyglądać preview, mieliśmy to za sobą" — przejazd K5-7 zrobiony
   dopiero wieczorem, powinien być pierwszym krokiem dnia po odbiorze.

## 8. Rzeczy łatwe do zepsucia (przeczytaj przed pierwszą komendą)

- **Token sesji żyje ~60 min** — odśwież tuż przed startem agenta zrzutów, inaczej traci
  uwierzytelnienie w połowie zadania.
- **Agenci kończą turę, gdy odpalą pętlę w tle** — zlecaj wyraźnie „nic w tle, sekwencyjnie",
  inaczej agent zniknie i nie zgłosi wyniku.
- **`git merge -q` z hookiem blokującym** zostawia zmiany w indeksie bez `MERGE_HEAD` →
  `git reset --hard` i powtórz scalenie z pełnymi znacznikami `[ODMROZENIE <MODUŁ> DEC-<nr>]`.
- **`headSha` runu po `gh workflow run` trzeba sprawdzić** (`gh run list --json headSha`) i
  porównać z pushniętym SHA — inaczej możesz wdrożyć stary commit (patrz §7.4).
- **Colima/Docker `rm -v` NIE oddaje miejsca hostowi** — usuwanie kontenerów nie zwalnia dysku
  macOS; dźwignią jest usuwanie czystych worktree po pushu kopii zapasowej.
- **Serwer uruchomiony z `DATABASE_URL` stagingu/demo dopisuje schemat runtime DDL** (`CREATE ...
  IF NOT EXISTS`) do żywej bazy przy starcie — nigdy nie wskazuj lokalnemu serwerowi bazy
  staging/demo/produkcja; kontrakty schematu testuj na bazie po migratorze ORAZ po jednym starcie
  API osobno.
- Zmienne Railway **zawsze** z `--skip-deploys`, inaczej demo/produkcja przebudowuje stary commit
  z gałęzi Londyn/GitHub. Zmiana zmiennej ≠ efekt — proces musi się zrestartować (patrz poczta
  produkcji, §2/§3.6).
- Demo wdraża się **wyłącznie** przez
  `gh workflow run railway-deploy.yml --ref staging -f environment=demo -f confirm_demo=yes`.
- Push na `staging` **sam** buduje na Railway (~12 min); workflow bywa `failure` na timeout mimo
  udanego wdrożenia — sprawdzaj `railway deployment list` i health, tag `staging-deployed`
  przesuwaj ręcznie gdy trzeba.
- Żywa baza stagingu to serwis **`pgvector`**, nie `Postgres` (martwy serwis `Postgres` zostaje —
  DEC-473).
- Hook `commit-msg` wymaga `[ODMROZENIE <MODUŁ> DEC-<nr>]`; moduły tylko z
  `docs/program/MVP_FINAL_ZAMROZONE.json` (Finansów tam nie ma → `WSPOLNE`). Nigdy `--no-verify`.
- Ostatnia użyta decyzja właściciela: **DEC-493**. Następna wolna: DEC-494. Codex numeruje własne
  notatki `DEC-2026091201`-style — przy scalaniu do rejestru CTO oznaczaj je „notatka Codexa", nie
  prawdziwym numerem.
- Cudzych katalogów roboczych (`codex-wt/*`, inne `wt/*` poza `kandydat-20260913`) **nie kasuj**
  bez sprawdzenia backupu Codexa na `origin/backup/*`; nigdy nie wchodź do
  `/Users/piotrwisniewski/Developer/Consultify` poza symlinkiem `node_modules`.
