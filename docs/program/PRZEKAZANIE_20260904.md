---
doc_id: program-przekazanie-20260904
status: canonical
data: 2026-09-03 (wieczór + noc) → dla sesji 2026-09-04
---

# Przekazanie — 3 września 2026, wieczór + noc (sesja nadzorcy #17)

Linia pracy: **`github-backup/grafika/m03-20260902`**, katalog `/private/tmp/m03`.
Wszystko wypchnięte na kopię zapasową po każdym scaleniu (`git rev-list --left-right --count` = 0 0).
Poprzednie przekazanie (poranne, 245/336) zastąpione tym plikiem; jego treść jest w historii git.

## 1. Gdzie jesteśmy — trzy zdania

**273 z 336 bramek** (rano 245, wieczorem 256, po decyzjach nocnych 272, po odbiorach części 2 nocy
**273** — zmierzone własnoręcznie o 23:2x: `grep -hE '^\|\s*G[0-9]{2}\b' .../MODULE_ACCEPTANCE.md`
licząc `` `PASS` ``; policz sam, nie ufaj tej liczbie bez przeliczenia). Skok +16 na 272 to **G14
16/16**, przełączone z `PARTIAL/OWNER_DECISION_PENDING` na `PASS` decyzjami właściciela DEC-347…385
(`04faaa11ff`); G06 pozostaje 16/16 z wieczora. **G15 ma 16/16 wierszy wpisanych** (rozkład: 1×`PASS`,
5×`PARTIAL_PASS / SERVER_NOT_MEASURED`, 2×`PARTIAL_PASS / RED_LEGACY_7`, 1×`PARTIAL_PASS /
RED_LEGACY_2`, 1×`PARTIAL_PASS / RED_LEGACY_2_PLUS_RED_NEW_1`, 2×`PARTIAL_PASS / RED_LEGACY_1`,
1×`NOT_MEASURED / RED_LEGACY_2_CONFIRMED`, 3×`NOT_MEASURED / RED_LEGACY_1_CONFIRMED` — żaden z tych
16 wierszy nie liczy się jako `` `PASS` `` w liczniku 273, poza tym jednym). **G19 ma 16/16 wierszy
wpisanych, wszystkie `NOT_PROVEN / OWNER_RETEST_PENDING`** (odbiorca odrzucił propozycję Codexa
`TECHNICAL_REGRESSION_PASS` — patrz §3c). **Staging** — trzy zdarzenia zmierzone: pierwsze wdrożenie
`58ef0771d7` (potwierdzone), drugie `53c3da2918` potwierdzone `success` o 20:06Z (§8), **trzeci
redeploy zapowiedziany na ok. 00:20 z HEAD `120bb2db81` (§3c) NIE jest jeszcze widoczny** — świeży
`curl https://staging.consultify.ai/api/health` o 23:19Z/21:19 UTC nadal zwraca `gitSha
53c3da29189eb...` (drugie wdrożenie, potwierdzony ancestor `120bb2db81`, 122 commity za HEAD-em) —
o tej godzinie to **oczekiwane** (00:20 lokalnego jeszcze nie było), ale **następny nadzorca musi
sam sprawdzić świeżym `curl`, nie zakładać, że trzeci redeploy doszedł**. Pozostałe bramki zależą od
przelotu właściciela po stagingu (G16, na trzecim redeployu) i od domknięcia G20 (§3c, §4).

## 2. ★★★ Co zmieniło obraz programu tego wieczoru

1. **Przyrząd kłamał po raz trzeci** (F2): przycisk „Szukaj” w `ModuleNavBar` podmienia rząd Menu 3;
   pętla rozwijania klikała go i chipy/taby znikały przed skanem na **30 z 248 ekranów**. Naprawa
   opt-in `--cofnij-jesli-skraca=1` (orkiestracja przekazuje). Pomiar #4 potwierdził zero na 29,
   a na `canvas-new-doc` odsłonił naruszenie ukryte w #3. Trzy ekrany canvas mają jeszcze inny
   mechanizm (Escape zamyka treść) — mierzone bez rozwijania.
2. **Bramka G20 „zero open P0/P1” mierzyła twierdzenie, nie stan** (F7, F8): 121 pozycji, nie 60;
   48 to życzenia produktowe właściciela z 22–23.08 bez decyzji, 8 czeka na rozmowę. Pakiet decyzji
   rodzinami: `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md` (20 pytań na jedno słowo;
   22 pozycje TERAZ = 25,5 dnia robotnika; 24 ODŁOŻONE; 10 rozmową).
3. **D7 zaniżone ośmiokrotnie** (F3): 270 tras finansów v8 bez bramki modułu, 64 zapisy bez niczego.
   Dyżur Codex 288 z dowodem USER/OWNER na realnej bazie.
4. **G19 to jeden obowiązek, nie szesnaście** (F9): 16 odbiorów na SHA z jednego okna 5 h; macierz
   G06 pokrywa 22/23 zmienionych komponentów. Dyżur Codex 290 oddaje gotowe zdania do 16 wierszy.

## 3. Scalenia wieczoru (9) i dyżury Codexa (część 1: 286–291)

| Co | Gałąź / commit | Skutek |
| --- | --- | --- |
| Ratunek dowodów | `agent/ratunek-dowodow` → `5c7270aeb7` | 19 plików z worktree poza repo; 4 worktree usunięte |
| Inwentarz G19 | `agent/g19-inwentarz` → `aa6f0c9713` | jeden obowiązek; 8 blokerów G20 |
| Blokery G20 | `agent/g20-p0p1` | 270 tras finansów; D5 sprostowane; help 5 kolumn |
| Język PL/EN runda 3 | `agent/i18n-r3` | doradca obciążenia 48→13, 25→15; +44 kluczy |
| Martwe komponenty r2 | `agent/martwe-komponenty-2` | `OrganizationV8CanonPanel` usunięty; 238 kandydatów zinwentaryzowanych |
| Rozliczenie P0/P1 | `agent/p0p1-rozliczenie` → `67d235cfa0` | 121 pozycji, werdykt per pozycja |
| P0/P1 × decyzje | `agent/p0p1-decyzje` | 48 bez decyzji, 8 do rozmowy |
| Pakiet decyzji | `agent/pakiet-decyzji-p0p1` | 20 rodzin, rekomendacja per rodzina |
| Ślepa plama nr 3 | `agent/slepa-plama` → `cfb21c0959` | `--cofnij-jesli-skraca`, 30 ekranów, dowód |

Dyżury Codexa wydane wieczorem (instrukcje w `docs/program/waves/WAVE_03_ACCEPTANCE/codex/`, wklejki
`*.wklejka.txt`): **288** finanse bramka modułu · **289** pomoc `help_*` + potwierdzenie martwego
`NotificationSettingsV2` · **290** dowody G19 · **291** dowody runtime dla 9 pozycji P0/P1.
Wcześniejsze: 286 G15, 287 fokus. Nota o numeracji w `KOLEJKA_CODEX_INTEGRACJA.md` (numer nadaje plik
instrukcji; tematy z kolejki od 292).

## 3b. Noc 03.09: decyzje, wdrożenie, 8 scaleń, 7 dyżurów Codexa (292–298)

**Decyzje właściciela** — rozmowa 03.09 wieczór/noc, ledger
`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`: **DEC-347…383** (37 pozycji:
A1–A4/R-11 flagi ON, rodziny R-1…R-20 z pakietu P0/P1) + **DEC-384** (★★★ decyzja o terminie: pięć
pozycji wybranych TERAZ wbrew rekomendacji CTO — B3 Moja Praca, B6 Czat, historia Czatu z R-14, R-18
standard kart, R-20 SWOT — przeniesione do FALI 2 słowami właściciela „Trzymamy termin: te 5 do fali 2”;
bez przesunięcia koszt byłby +17 dni robotnika i termin 15–17.09) + **DEC-385** (★★★★★ prototyp
21-stronicowego raportu Oceny DRD zaakceptowany bez zastrzeżeń: „Ten raport jest po prostu
fantastyczny”, 7 pytań projektowych rozstrzygnięte wg rekomendacji CTO, może je nadpisać rano).
Pliki źródłowe: `DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md`, `DECYZJE_WLASCICIELA_P0P1_20260904.md`,
`FALA_2_PO_STAGINGU.md` (21 pozycji odłożonych, kolejność startu ustalona — start po G16).

**Wdrożenie na staging** — pierwszy deploy 03.09, workflow `Railway Deploy` run `33794221002`
(`completed`/`success`), `headSha 58ef0771d7`, przez gałąź `staging` + `workflow_dispatch
environment=staging` (`develop` chroniony: wymaga PR + check „PR Gate”, zakaz merge-commitów —
pierwsza próba wprost na `develop` odbita, ścieżka `staging`+dispatch zadziałała). Potwierdzone
`curl https://staging.consultify.ai/api/health` → `{"status":"ok","database":"connected",
"gitSha":"58ef0771d746124c42361d0a37c653790b7c4cfa","redis":"connected"}`. **Drugi redeploy** (flagi
ON A1–A4/R-11 + 8 scaleń nocnych poniżej) uruchomiony jako run `33799377961`, `headSha 53c3da2918`
(`createdAt` GitHub API: `19:56:51Z`, czyli ok. 21:56 lokalnie — **rozbieżność z zapisem „ok. 23:20”
z brifu nocnego o ok. 1,5 h; zapisuję zmierzony czas GitHub Actions jako wiążący**). W chwili tego
pomiaru (03.09, kilka sprawdzeń w oknie 20:00–20:03 UTC) run **wciąż `in_progress`** — nie potwierdzam
sukcesu drugiego wdrożenia, następny nadzorca musi sam zrobić świeży `curl .../api/health` i porównać
`gitSha` z `53c3da2918`.

**8 scaleń nocnych** (po `58ef0771d7`, kolejność chronologiczna z `git log`):

| Co | Gałąź / merge | Skutek |
| --- | --- | --- |
| Decyzje właściciela wieczór | `agent/decyzje-wlasciciela-20260903-wieczor` → `9b2833a964` | DEC-347…384 wpisane do ledgera; A5 rozstrzygnięte |
| Usunięcie NotificationSettingsV2 | `agent/usun-notificationsettingsv2-20260903` → `4a15722220` | 8 plików, 1382 linie, martwe poddrzewo (decyzja A5) |
| Triage/kafel obalone pomiarem | `agent/mw-triage-kafel-20260903` → `984d3658fd` | R-12 (triage już podłączony od 16.07) i R-8 (element nie istnieje) — brief mylił się, zero zmian kodu |
| Pakiet przelotu G16 | `agent/g16-pakiet-przelotu-20260903` → `4f70f2fca8` | `PRZELOT_WLASCICIELA_STAGING_20260904.md`, 16 modułów, ~70 kroków, 25 pozycji „nie zgłaszaj” |
| Flagi ON A1–A4/R-11 | `agent/flagi-on-20260903` → `1c8d93f253` | Wyniki 5 domen, Finanse 6 paneli, Organizacja redesign, kreator wywiadu, Notatnik Praca/Kontekst; bezpiecznik 21/21 |
| Legenda stanów Oceny | `agent/ocena-legenda-stanow-20260903` → `6b1ce5c7ea` | ASM-OWN-013: globalna legenda usunięta z `LiveMatrix`, etykiety chipów w `aria-label`, 10/10 testów |
| Prototyp raportu Oceny | `agent/raport-oceny-prototyp-20260903` → `ebfcf3d580` | 21 stron DOCX/PDF w `docs/program/prototypy/`, 7 osi po 2 strony, SIRI szkielet 2 strony, 7 pytań właścicielowi → zaakceptowane DEC-385 |
| Drobiazgi Mojej Pracy | `agent/mw-drobiazgi-20260903` → `53c3da2918` | sygnalizacja przewijania w 3 paskach (`ActionRequiredStrip`, `TableTabStrip`, `CalendarView`), kontrast wierszy ukończonych na Zadaniach (opacity-60), 5 węzłów a11y → 0 w 8 kadrach |

**7 dyżurów Codexa wydanych w nocy**: **292** menu akcji Wywiadu (R-16) · **293** Biblioteka metodyk
Oceny (R-4/B2) · **294** Czat: nagłówek/zapis/gałęzie/głos (R-14, 4 defekty) · **295** Moja Praca
enumeracja kontrolek (409) + Inicjatywy kanon (R-7/R-9/R-15) · **296** jeden mapper błędów
aplikacyjnych dla 305 miejsc w 69 plikach tras (codemod, bezpiecznik linia 0) · **297** martwe
komponenty od korzenia (graf osiągalności, `InboxTriage.tsx` pierwszy kandydat, 237 zinwentaryzowanych
wieczorem czeka na to liczenie) · **298** silnik raportu Oceny wg prototypu DEC-385 (model z realnej
sesji, skład DOCX/PDF, metryka badania, etykiety dowodu E0–E4, narracja za flagą OFF). Razem z
286–291 = **13 dyżurów Codexa** wydanych 03.09 (potwierdzone: 13 plików
`INSTRUKCJA_DYZUR_{286..298}.md` + wklejki w `docs/program/waves/WAVE_03_ACCEPTANCE/codex/`).
**Kolejność wartości** (słowa właściciela/nadzorcy z nocy): `288, 292, 293, 290, 298, 294, 295, 296,
286, 291, 297, 287, 289`.

**Lekcje nocy** (patrz też §5):
1. `git stash` w hubie `m03` jest **współdzielony między wszystkimi worktree** — jeden robotnik przy
   pracy nad legendą stanów zdjął cudzy wpis (`CalendarView`) ze stasha, inny stracił niecommitowany
   fix. Reguła `Z27` (zakaz `git stash` u robotników, kopie przez `cp`) istniała już od dyżuru 33 —
   noc pokazała, że złamanie zdarza się mimo to; dopisana wprost do instrukcji dyżurów 290+ i do
   `Zasady pracy nadzorcy`.
2. **Trzy „defekty” z pakietu decyzji P0/P1 obalone pomiarem** (`ASM-OWN-005`, `ASM-OWN-020`, `R-12`
   triage, `R-8` kafel — 4 pozycje łącznie): pakiet stał częściowo na nieaktualnych rejestrach z 22–23.08.
   Decyzja właściciela („TERAZ”/„ODŁOŻONE”) **zostaje zapisana w ledgerze**, ale wykonawca nie naprawia
   nieistniejącego kodu — dowód `evidence(...)`/`docs(evidence)` w commitach `f0e697891f`, `648f8f7ea6`.
3. Ochrona gałęzi `develop` (PR + „PR Gate”, zakaz merge-commitów) zablokowała pierwszą próbę deployu
   wprost na `develop`; ścieżka `staging` + `workflow_dispatch environment=staging` (workflow
   `.github/workflows/railway-deploy.yml`, job `deploy-staging`) zadziałała i jest teraz kanoniczna
   dla deployu na staging.
4. `pgrep -f <wzorzec>` wewnątrz pętli `until` **łapie samą siebie** (własna komenda pasuje do
   własnego wzorca) — używać wzorca z nawiasem znakowym, np. `uruch[o]m`, żeby proces `pgrep` sam
   siebie nie widział.

## 3c. Noc 03.09 część 2 (23:00–00:30): odbiory 13 dyżurów, paczka 299–312, łańcuchy nocne

**Odbiór adwersaryjny wszystkich 13 dyżurów 286–298**, cztery sesje Opus, każda na osobnym worktree
z realnym PostgreSQL, dowody w `docs/program/waves/WAVE_03_ACCEPTANCE/codex/ODBIOR_DYZUROW_*_20260903.md`
(4 pliki, 363–511 linii). Pełne zdania i cytaty w `REJESTR_ZNALEZISK_20260903.md` §I — poniżej skrót
z werdyktem i stanem scalenia zmierzonym własnoręcznie na HEAD (`git merge-base --is-ancestor <sha> HEAD`).

| Dyżur | Werdykt odbioru | Scalone na HEAD? | Zastrzeżenie / powód |
| --- | --- | --- | --- |
| 286 (G15 samokontrola) | SCALIĆ Z ZASTRZEŻENIEM | TAK — `465ec539b7` | Odbiorca skorygował klasyfikację 13 czerwieni `NOWA`→`ZASTANA` (baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110` — pomiar na niej dawał `Test Files failed`/`0 tests`, odczytane błędnie jako „baza zielona”, patrz lekcja 1 niżej) |
| 287 (fokus `c-focus`) | SCALIĆ Z ZASTRZEŻENIEM → **po naprawie SCALONE** | TAK — `120bb2db81` (`agent/287-naprawa-20260903`) | Pierwotnie 174 wystąpień fokusa, czerwony test, 6 konfliktów; po naprawie: **174→28**, `VIOLATION_RE` przywrócony, baseline zregenerowany **64/45**, 6 konfliktów rozwiązanych, test 2/2 |
| 288 (bramka finansów) | SCALIĆ Z ZASTRZEŻENIEM → **po naprawie SCALONE** | TAK — `4d5c0c2d5c` (`agent/288-naprawa-20260903`) | Pierwotnie 2 testy czerwone; po naprawie 2 stubów: para USER 403 / OWNER 200 **8/8** na 7 prefiksów `/api/v8/finance*`, rejestr mountów **50/50**, mutacja 47/50 — T1 sprostowane w `G20_BLOKERY_P0P1_20260903.md` (`d936152c77`) |
| 289 (martwe trasy / help) | SCALIĆ | TAK — `a905bce0aa` | Jedyny z trójki 288/289/296 zgodny z rdzeniem instrukcji od razu; D5 zamknięte, D6 naprawione (migracja addytywna `20260904_help_shape_alignment.sql`) |
| 290 (G19 regresja) | SCALIĆ Z ZASTRZEŻENIEM | TAK — `0250f90ea3` | Raport twierdził blok 3 = 11/18 (baza zanieczyszczona `ORG_MEMBERSHIP_REVOKED`); odbiorca zmierzył **16/18** dwukrotnie na czystej bazie — 16/18 jest liczbą wiążącą, nie 11/18 |
| 291 (dowody runtime P0/P1) | SCALIĆ | TAK — `7f5873f39e` | D8 NAPRAWIONE/VERIFIED_RUNTIME z zastrzeżeniem: PUT/GET escalation 200/404 poprawne, ale repo ma czerwony test `day277-decyzje-zapis.pg.test.ts` (0/2) — do naprawy dla G20 |
| 292 (menu akcji Wywiadu) | SCALIĆ Z ZASTRZEŻENIEM | TAK (R1–R2) — `130cb3db12` | Niedokończony: brak R3–R6 (dowód, raport) — przeniesione do dyżuru 312 pozycja (d) |
| 293 (Biblioteka metodyk) | — (0 commitów) | **NIE** | Sesja skończyła się read-only, ani jeden commit; cała instrukcja do wykonania — 312 pozycja (c) |
| 294 (Czat: 3 defekty) | SCALIĆ | TAK — `f46cd67b02` | Dwa pliki dokumentacji, zero kodu — uczciwie nazwane; dyktowanie głosowe rozproszone na 7 plików + 3 hooki (korekta odbiorcy) |
| 295 (Moja Praca + Inicjatywy) | SCALIĆ Z ZASTRZEŻENIEM | TAK — `9fccc4d98f`/`9d4c88c615` | Dwa nagłówkowe twierdzenia nie bronią się: enumeracja kontrolek dowodzi efektu dla **12 z 226** sygnatur (312(e) poprawia mianownik na 86/54), `idea-table` = lista Idei nie narzędzie tabeli (żyje na `idea-table-timeline-stuck`), wyścig 409 dowiedziony na trasie bez frontowego wołacza |
| 296 (wycieki błędów tras) | SCALIĆ Z ZASTRZEŻENIEM — **DYŻUR NIEWYKONANY** | **NIE** — materiał wejściowy (merge-clean, addytywny), jeszcze nie wciągnięty na HEAD | R1–R2 zrobione (rejestr 341 wierszy, mapper 5/5 zielonych testów), R3–R6 nie: **0 z 294** miejsc zamienione, mapper ma **zero wołaczy produkcyjnych** („biblioteka bez wywołania”, 11. kształt) — do wznowienia od R3 w 312(a) |
| 297 (martwe komponenty od korzenia) | STOP (uprawniony) | **NIE** — 0 commitów | Zatrzymany przed R1: mniej niż 5 GB wolnego dysku w chwili dyżuru (dziś 36 GiB, próg już nieaktualny) — do wznowienia w 312(b) |
| 298 (silnik raportu Oceny DRD) | SCALIĆ Z ZASTRZEŻENIEM | TAK — `763856d76b` | Commity realne, DOCX identyczny z prototypem **21/21**; ale silnik **nie ma ani jednego wołacza produkcyjnego**, narrator LLM za flagą OFF nie powstał, `save()` odrzuca obcego tenanta dopiero przez `get()` PO `INSERT` — do domknięcia w 312(f) |

**Wynik liczbowy**: 10 z 13 scalone na HEAD (286, 287, 288, 289, 290, 291, 292, 294, 295, 298), **3 nie**
(293 — zero pracy, 296 — 0/294 wykonane, 297 — STOP dyskowy).

**Paczka nocna Codexa 299–312.** Instrukcje **299–311 (13 sztuk)** napisane i scommitowane na kopii
lokalnej (`m03`) między 22:xx a 23:20 — potwierdzone plikami `INSTRUKCJA_DYZUR_{299..311}.md` na HEAD
tego worktree. Instrukcja **312** („domknięcia po odbiorach — 296→297→293→292→298→295, w tej
kolejności, z prawem zatrzymania po każdej") napisana i scommitowana o 23:18 (`beee4bb9d3`, 723 linie)
— w chwili tego pomiaru **jest już na `github-backup/grafika/m03-20260902` (świeży fetch), ale
o 3 commity przed HEAD-em tego worktree** (`e7fd7546f8`/`904e55a645`/`beee4bb9d3` — dwa pierwsze to
nota kolejki „299–312 wydane, następny wolny 313”, trzeci to sama instrukcja 312); zsynchronizuj
worktree o poranku przed pracą (`git rev-list --left-right --count HEAD...github-backup/…` powinno
dać `0 0`, teraz daje `0 3`).

**★ Łańcuchy nocne A i B — WSZYSTKIE 13 pozycji zakończyły się STOP, zero commitów, powód
techniczny (rasa z pushem), nie merytoryczny.** Właściciel uruchomił dwa łańcuchy:
`A = [307, 310, 309, 301, 299, 308, 300]`, `B = [311, 302, 303, 304, 305, 306]`. Pliki postępu
istnieją i są kompletne: `/private/tmp/cx-noc-A-postep.md` (7 pozycji, ostatni zapis 23:18) i
`/private/tmp/cx-noc-B-postep.md` (6 pozycji, ostatni zapis 22:56) — **każda z 13 pozycji ma wpis
STOP** z identycznym powodem: `git show github-backup/grafika/m03-20260902:…INSTRUKCJA_DYZUR_<n>.md`
zwracał `fatal: path … does not exist`. **Zmierzone przeze mnie: to była rasa czasowa, nie brak
treści.** Raporty STOP w `/private/tmp/cx-noc-{A,B}-<n>-raport.md` mają znaczniki czasu **22:55–22:57**
— instrukcje 299–312 zostały wypchnięte na `github-backup/grafika/m03-20260902` dopiero **23:18–23:20**
(commity `beee4bb9d3`/`904e55a645`/`e7fd7546f8`), czyli **20–25 minut po** tym, jak oba łańcuchy już
zgłosiły STOP i zakończyły pracę. Świeży `git fetch github-backup --prune` wykonany podczas tego
dyżuru potwierdza: **wszystkie instrukcje 299–312 są teraz obecne** na `github-backup/grafika/
m03-20260902` (sprawdzone `git cat-file -e` dla każdej z 13). **Wniosek dla rana: oba łańcuchy trzeba
uruchomić ponownie od zera** — treść, której im zabrakło, istnieje od 23:20, ale żaden z łańcuchów
sam się nie wznowił (brak automatycznego retry po STOP-ie).

## 4. Czeka na właściciela (rano 04.09)

1. **Przelot po stagingu wg pakietu (G16)** — `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`
   (commit `4f70f2fca8`), 16 modułów, ~70 kroków, 25 pozycji „nie zgłaszaj” (znane, odłożone do fali 2).
   **Zanim właściciel patrzy — sprawdź świeżym `curl .../api/health`, że drugi deploy (`53c3da2918`)
   faktycznie doszedł**, inaczej przelot odbędzie się na starszym kodzie (§1).
2. **7 pytań prototypu raportu Oceny** — z notatki przy `RAPORT_OCENY_DRD_PROTOTYP_20260903.pdf`;
   rozstrzygnięte wg rekomendacji CTO do odwołania (DEC-385), właściciel może je nadpisać rano zanim
   Codex 298 zbuduje silnik.
3. **Raporty Codexa do odbioru adwersaryjnego** — wszystkie 13 (286–298), kolejność wartości:
   `288, 292, 293, 290, 298, 294, 295, 296, 286, 291, 297, 287, 289`. Wklejki gotowe w
   `docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_{numer}.wklejka.txt` — właściciel
   wkleja sam do Codexa (jedyny kanał, patrz `format-promptow-dla-codexa`).
4. `DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md` / `DECYZJE_WLASCICIELA_P0P1_20260904.md` — pozycje
   bez decyzji z wieczora, jeśli zostały (większość zamknięta DEC-347…384, sprawdź rejestr przed
   pytaniem ponownie o to samo).

## 5. Otwarte ryzyka

- **Trzeci redeploy stagingu (HEAD `120bb2db81`, zapowiedziany ok. 00:20) niepotwierdzony** — o 23:19
  `/api/health` nadal zwracał `gitSha` drugiego wdrożenia (`53c3da2918`); przed przelotem G16 zrób
  świeży `curl` i porównaj z `120bb2db81` (§1/§3c) — jeśli redeploy nie doszedł albo padł, przelot
  trafi na kod bez 10 dzisiaj scalonych naprawionych dyżurów (286–292, 294, 295, 298).
- **Oba łańcuchy nocne (A i B, 13 pozycji łącznie) trzeba uruchomić ponownie** — STOP wszystkich
  13 pozycji był techniczny (rasa: instrukcje 299–312 doszły na `github-backup` 20–25 min PO tym, jak
  łańcuchy już się zakończyły STOP-em), nie merytoryczny; treść jest teraz na miejscu. Szczegóły i
  dowód czasowy w §3c.
- **10 z 13 odbiorów nocy 2 scalone na HEAD, 3 nie** (293 — zero pracy, cała instrukcja do zrobienia;
  296 — 0/294 miejsc, materiał wejściowy tylko; 297 — STOP dyskowy, 0 commitów) — domknięcia
  wszystkich sześciu pozostawionych pozycji (296, 297, 293, 292 R3–R6, 298 zastrzeżenia, 295
  zastrzeżenia) czeka w instrukcji 312, jeszcze nie scalonej na HEAD (§3c).
- **4 pre-istniejące czerwone testy a11y kreatora wywiadu** po włączeniu A4 (`interview-creator-shell`
  ON) — plik `src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx` istnieje, stan
  czerwony niepotwierdzony własnym uruchomieniem w tej sesji (zero-kod, brak testów w tym dyżurze) —
  **następny nadzorca musi sam odpalić i zmierzyć**, nie przyjmować liczby bez sprawdzenia.
- **237 martwych kandydatów** (nie „kilkadziesiąt”) czeka na dyżur 297 (osiągalność od korzenia);
  `InboxTriage.tsx` — pierwszy jednoznaczny kandydat do usunięcia (martwy duplikat, kanon triage już
  podłączony gdzie indziej — R-12 obalone).
- `git stash` współdzielony w hubie `m03` — zdarzenie z nocy (§3b, lekcja 1); pilnować `Z27` przy
  każdym kolejnym zleceniu.
- Dwa ekrany canvas (`canvas-kebab-restructure`, `canvas-new-doc`) i `interview-preview-canon`:
  mechanizm Escape w pętli rozwijania — mierzone bez rozwijania; poprawka pętli odłożona (2/248).
- `MASTER_STATUS_REGISTER.md` niespójny (G18 PASS 16/16 vs „closed 2 of 16”); kolizja ID
  `ASM-OWN-001..028` między dwoma rejestrami.
- FALA 2 (21 pozycji odłożonych, `FALA_2_PO_STAGINGU.md`) startuje dopiero po przelocie G16 — nie
  zaczynać wcześniej, żeby nie powtórzyć błędu „wiele flag naraz” (reguła 9 kodeksu).
- 8 lekcji metodycznych z nocy część 2 (baza niekompilująca się fałszywie klasyfikuje czerwienie jako
  nowe, `git merge-tree` stara forma daje 0 znaczników przy realnych konfliktach, `grep -c` na wielkim
  wyjściu zwraca pustkę zamiast 0, generator instrukcji wkleja opis zamiast komendy w §0.2c i inne) —
  pełna lista w `REJESTR_ZNALEZISK_20260903.md` §J, skrót w pamięci `przekazanie-sesja-fable-17.md`.

## 6. Pierwsze kroki dla następnego

1. Audyt jak rano: `git -C /private/tmp/m03 fetch github-backup && git rev-list --left-right --count
   HEAD...github-backup/grafika/m03-20260902` → 0 0 (o 23:2x dawało **0 3** — trzy commity paczki
   instrukcji 312 jeszcze do ściągnięcia, zsynchronizuj przed pracą); `git status --short` pusty;
   znaczniki konfliktu; `initiativeRecordCanon` 6/6; policz licznik G sam (komenda w §1), nie ufaj
   liczbie z tego pliku bez przeliczenia.
2. Świeży `curl https://staging.consultify.ai/api/health`, porównaj `gitSha` z `120bb2db81` (trzeci
   redeploy, zapowiedziany ok. 00:20 — §1/§3c/§5). Jeśli nadal `53c3da2918`, to pierwsza rzecz do
   naprawienia przed jakimkolwiek przelotem właściciela.
3. **Uruchom ponownie oba łańcuchy nocne (A: 307/310/309/301/299/308/300; B: 311/302/303/304/305/306)**
   — poprzedni przebieg zakończył się STOP-em na wszystkich 13 pozycjach z powodu technicznego (rasa
   z pushem instrukcji, nie brak treści — dowód w §3c), treść jest teraz na `github-backup`.
4. **Odbierz adwersaryjnie instrukcję 312** (domknięcia 296→297→293→292→298→295, 723 linie, jeszcze
   nie scalona) tą samą metodą co 286–298 — 4 sesje Opus, worktree z realnym PostgreSQL, para dowodów
   + mutacja per pozycja.
5. **Napraw szkielet generatora instrukcji §0.2c** — lekcja 8 z nocy część 2: generator wkleja opis
   zamiast komendy w tej sekcji szablonu (`REJESTR_ZNALEZISK_20260903.md` §J).
6. **Osobny mały dyżur na 64 pierścienie zaznaczenia** (decyzja wizualna, odłożona z nocy część 2 —
   nie mylić z fokusem `c-focus` dyżuru 287, to inna rodzina).
7. **Zasada minimum Fable** (słowa właściciela 03.09 ~22:30, patrz pamięć `zasada-minimum-fable`):
   Fable robi TYLKO scalenia z kontrolą, rejestry, wklejki, meldunki. Cała analiza/kod/dokumenty
   robocze → Sonnet/Opus/Codex. Nie czytać całych plików źródłowych samemu, gdy robotnik może to
   zrobić taniej.
8. Po przelocie G16 → start FALI 2 (`FALA_2_PO_STAGINGU.md`), kolejność startu jak w dokumencie.
9. Sprzątać worktree po każdym scaleniu; stare `cx-day2xx`/`wt-*` z 02.09 do przeglądu jeśli jeszcze
   żyją.

## 7. Prognoza (uczciwie)

G06 16/16 zamknięte. **G14 16/16 zamknięte decyzjami DEC-347…385.** G16 po przelocie właściciela —
zależy najpierw od potwierdzenia drugiego deployu (§5), potem od samego przelotu (4–5.09). G15/G19
po raportach Codexa 286/290 (5–7.09). G20 wymaga: decyzji dla pozostałych rodzin pakietu P0/P1,
25,5 dnia robotnika na pozycje TERAZ, zamrożonego markera i finalnego replay. **Termin 10–12 września
utrzymany decyzją właściciela DEC-384** — wprost mimo że pięć pozycji chciał wybrać wbrew rekomendacji
CTO (koszt +17 dni), bo świadomie przeniósł je do FALI 2 zamiast rozciągać termin. Zależności krytyczne
dla dotrzymania: potwierdzony drugi deploy → przelot właściciela po stagingu (G16) → 13 raportów
Codexa odebrane adwersaryjnie → zamknięcie G15/G19/G20.

## 8. Sprostowanie po zamknięciu (03.09 22:10)

Drugi redeploy stagingu POTWIERDZONY: run `33799377961` zakończony `success`, `/api/health` o 20:06Z zwraca `gitSha 53c3da2918` (flagi ON, 8 scaleń nocnych). Ryzyko H8 z rejestru zamknięte. Rozjazd czasu w §3b (brief „23:20” vs `createdAt 19:56Z`) = pomyłka nadzorcy w strefie: run ruszył 21:56 czasu lokalnego.

## 9. Prognoza w czasie AI (sprostowanie właściciela, 03.09 22:30)

Właściciel: „podajesz terminy w dniach ludzkich, a nie AI-owych — dyżur Codex robi w minuty, a ja mogę wklejać cały czas”. Poprawiona ścieżka krytyczna: przelot właściciela (1,5 h) → naprawy z uwag (2–4 h robotników równolegle) → zamrożenie markera → pomiar #5 pełnej macierzy (1,5 h maszyny) → wpisy G20. Reszta (13 dyżurów Codexa 1–3 h równolegle, 13 odbiorów adwersaryjnych zlecanych Opusom 1–2 h, wpisy G15/G19 1 h) dzieje się obok. **Prognoza: G15 i G19 04.09 do południa, G16 04.09 po południu, G20 05.09.** Termin 10–12.09 (DEC-384) był liczony w dniach ludzkich. Ostrożność: dyżury z Postgresem (288, 290, 291, 296, 298) trwają dłużej i bywają zatrzymane (298: profil read-only, wznowienie w nowej sesji).

## 10. Sprostowanie 03.09 23:30

Trzeci redeploy stagingu POTWIERDZONY: run success, `/api/health` zwraca `gitSha 120bb2db81` (wszystkie nocne scalenia). Instrukcja 312 jest na kopii. Oba łańcuchy nocne (A, B) przeleciały na pusto z powodu wyścigu czasowego — do ponownego uruchomienia rano po `rm -f /private/tmp/cx-noc-*-postep.md`.
