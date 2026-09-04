---
doc_id: program-przekazanie-20260905
status: canonical
data: 2026-09-04 → dla sesji 2026-09-05
---

# Przekazanie — 4 września 2026, dla sesji nadzorczej #19

Ta konsolidacja NIE wykonywała mechaniki ani odbiorów — porządkuje dokumentację po dniu 04.09
(agent `agent/konsolidacja-20260904`, worktree `/private/tmp/ag-konsolidacja-20260904`, na HEAD
huba `192b38d022` bez zmian w kodzie/mechanice). Wszystkie liczby poniżej zmierzone samodzielnie w
tej sesji; tam gdzie nie dało się zmierzyć bez łamania zakazów środowiska — napisane wprost
**NIEZMIERZONE**.

## 1. Liczby zmierzone samodzielnie

- **Licznik bramek: 273/336.** Komenda:
  `grep -hE '^\|\s*G[0-9]{2}\b' docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md \|
  awk -F'|' '{gsub(/^ +| +$/,"",$4); if ($4=="`PASS`") n++} END {print n"/336"}'`.
  Identyczne z pomiarem porannym M5 (05:32–05:35) — żadne z 27 scaleń dnia nie dotknęło pliku
  `MODULE_ACCEPTANCE.md` żadnego modułu.
- **Tip gałęzi huba: `192b38d022`** („Merge agent/instr-C — instrukcje dyżurów 317, 318, 322, 323”),
  gałąź `codex/m03-admin-20260824`. To był HEAD w chwili startu tej sesji konsolidacyjnej;
  worktree tej sesji (`agent/konsolidacja-20260904`) rozgałęziony z tego punktu i dotyka wyłącznie
  plików `docs/program/*`.
- **Staging `gitSha`: `fb6547b7d0a795aab1f4c879fd1a351f2ac4e91b`.** Zmierzone bezpośrednim
  `curl https://staging.consultify.ai/api/health` (dwa kolejne wywołania, `timestamp` w odpowiedzi
  realnie się zmienia — to żywy endpoint, nie cache), `database: connected`, `redis: connected`.
  `git merge-base --is-ancestor fb6547b7d0 HEAD` → prawda: **staging jest 85 commitów za HEAD-em huba**
  (`git rev-list --count fb6547b7d0..HEAD` = 85). Żadne z 12 scaleń 05:46–06:43 (9 odbiorów + DEC-386
  + DEC-387 + 3 paczki instrukcji) nie trafiło jeszcze na staging. Dla porównania: `demo.consultify.ai/api/health`
  zwraca inny SHA (`f3237e9423...`) — dwa różne środowiska, nie mylić przy kolejnym sprawdzeniu.
- **10 duties instr-A/B/C (314–323) mają już finalne commity raportów w swoich worktree**, worktree
  czyste (`git status --short` = 0 w każdym z 10 sprawdzonych: `cx-day314`…`cx-day323`), ale **żaden
  nie przeszedł jeszcze odbioru adwersaryjnego** — instrukcje dla nich zostały scalone do huba
  (merges `dfbd98a25a`/`23d58b97ed`/`192b38d022`), same duty jeszcze nie. Treści raportów NIE
  czytane w tej sesji (poza tym, co już wpisano do rejestru przez instr-A/B/C same w sobie) — zgodnie
  z zakazem dotykania `codex/day31*`/`codex/day32*` i worktree `cx-day*`, ograniczono się do
  `git log -1`/`git status --short`.

## 2. Co scalono 04.09 — skrót z werdyktami (pełne dowody: `REJESTR_ZNALEZISK_20260903.md` sekcje L i M)

27 scaleń w dniu (`git log --oneline --merges bc18bc7aca~40..HEAD` filtrowane po dacie). W kolejności:

**Noc/rano (do 05:35, opisane wcześniej w L i M1–M12):** odbiory E/F/G (302/303, 304/305/306,
307/311/312 wstępnie), 296 WIP, incydent K1, DEC-386 wstępny pomiar, DEC-387 wstępny pomiar,
bezpieczniki zielone (81/81, focus-canon, list-canon).

**05:46–05:55 — dziewięć odbiorów adwersaryjnych (druga tura, po instrukcji 313 domknięcia):**

| Dyżur | Werdykt | Jedno zdanie |
|---|---|---|
| 299 | SCALIC Z ZASTRZEŻENIEM | STOP obalony (`f969904f9b`), ale skargi na instrukcję prawdziwe (brak tabeli licencji, `Z12` sprzeczny); naprawa 4 linie testu |
| 300 | SCALIC bezkosztowo, wydać od nowa | STOP na markerze słuszny, ale nieaktualny na HEAD (mapper już istnieje, wołany 72×) |
| 301 | SCALIC Z ZASTRZEŻENIEM | 25 BLOKUJE odtworzone niezależnie 2×; skrypt bez wołacza w CI, exit 0 |
| 308 | SCALIC Z ZASTRZEŻENIEM | liczby potwierdzone, ale z 631 „identycznych” realnych defektów ~119 (19%), nie 578 |
| 309 | SCALIC Z ZASTRZEŻENIEM po naprawie bezpiecznika | 2/21 kandydatów PUSTYCH potwierdzonych mutacyjnie |
| 310 | SCALIC Z ZASTRZEŻENIEM | P0 obalone (rejestracja 200 przed i po); bezpiecznik obejmuje 39% rodziny |
| 311 | SCALIC co do kodu, **NIE POKAZYWAĆ Piotrowi** dowodu | 10/16 par zrzutów bajtowo identycznych — zły dobór ekranów |
| 312 | SCALIC — sam raport | guard już w HEAD przez `b305261454`, zero nowego produktu ponad HEAD |
| 313 | SCALIC Z ZASTRZEŻENIEM — najmocniejszy z trójki | R2-R4 dowiedzione na produkcie; nowy defekt: słownik PL działa tylko dla błędów nie-operacyjnych |

**05:56–06:07 — dwie decyzje właściciela:**

| | Werdykt | Jedno zdanie |
|---|---|---|
| DEC-386 | ZROBIONE | przełącznik chipów Czatu zostaje w menu, magazyn przeniesiony z `localStorage` do `user_ai_settings` per użytkownik; dowód pary na realnym Postgresie |
| DEC-387 | ZROBIONE, flaga `ff_initiativeCardContract` DALEJ OFF | kontrakt kart naprawiony (kasował 20/24 sekcji, nie „11/15” jak pierwotnie zmierzono — patrz `LEKCJE_20260904.md` §1); 6 pozostałych typów kart NIE sprawdzonych |

**06:35–06:43 — trzy paczki nowych instrukcji (instr-A/B/C, duties 314–323):** kontrola generatora
czysta na wszystkich 10 (pola `<<`=0, wiersze Z=41, etykiety unikalne=41); każda paczka niesie własne
sprostowania liczb nadzorcy (pełna lista: `LEKCJE_20260904.md` §6 i §8; rejestr M22–M24).

## 3. Co OTWARTE i dlaczego

1. **Staging 85 commitów za HEAD-em** (§1) — DEC-386, DEC-387 i naprawy 313/311 nie są widoczne na
   stagingu. Redeploy nie wykonany w tej sesji (zakaz `git push`/deploy dla robotnika dokumentacji;
   procedura: skill `consultify-promocja-demo`).
2. **10 duties 314–323 czekają na odbiór adwersaryjny** — worktree gotowe, raporty scommitowane,
   nikt jeszcze nie zweryfikował ich treści niezależnie (wzorzec z 299–313 tego dnia: średnio 1 na 3
   raportów miał STOP nieaktualny lub liczby do korekty — patrz §2 tabela).
3. **`OWNER_DECISION_LEDGER_2026-08-24.md` nie ma wpisów DEC-386/DEC-387.** Ostatni wpis w rejestrze
   to `DEC-2026-09-03-385`. Obie decyzje właściciela z 04.09 rano są udokumentowane w
   `REJESTR_ZNALEZISK_20260903.md` (M6/M7) i w komunikatach scaleń, ale **nie mają formalnego wiersza
   w rejestrze decyzji** — do dopisania przez następną sesję z numeracją `DEC-2026-09-04-386/387`
   albo równoważną.
4. **Rozjazd 4 vs 5 plików niecommitowanych w worktree 293** (`LEKCJE_20260904.md` §2, rejestr M24) —
   instr-C mówi 4, raport dnia 312 (`CODEX_DAY312_DOMKNIECIA_PO_ODBIORACH_REPORT.md:32`) mówi 5. Ani
   jedno źródło nie zostało odtworzone przez tę sesję (zakaz dotykania worktree `cx-day*`) —
   następna sesja może rozstrzygnąć jednym `git -C /private/tmp/cx-day293-... status --short`, jeśli
   ten worktree wciąż istnieje.
5. **6 pozostałych typów kart (poza Initiative) nie sprawdzone pod kątem tej samej zamkniętej
   allowlisty co złapała DEC-387** — wspólny alias `?cardContract=1` włącza je naraz, ryzyko realne
   i niezmierzone (rejestr M11).
6. **`focus:ring-primary-500` w Czacie — 5 realnych lokalizacji nienaprawionych**
   (`ConversationSearch:19`, `PrivateModeDetails:136`, `ProjectMembersModal:298/421/432`) — dokładna
   lista z instr-B (§8 `LEKCJE_20260904.md`), zastępuje wcześniejszą błędną listę z odbioru 311.
7. **313: mapper błędów po naprawie R3 przepuszcza angielskie komunikaty biznesowe** — bo
   `operational ? raw : MESSAGES[...]` odwraca się z naprawą dziedziczenia `AppError`; osobny dyżur
   potrzebny na odwrócenie tej logiki lub tłumaczenie komunikatów operacyjnych.
8. **Łańcuch nocny (L10, zamknięty M13–M18)** — wszystkie 7 pozycji (299/300/301/307/308/309/310) mają
   dziś werdykt; **307 jest jedyną pozycją z tej siódemki scaloną wcześniej (M2), pozostałe sześć
   dopiero w tej turze (M13–M18)** — nie wydawać już żadnej „wklejki od nowa” dla tych numerów.

## 4. Decyzje właściciela DEC-386, DEC-387 i ich stan

- **DEC-386** (preferencje Czatu per użytkownik): **ZROBIONE**. Endpoint istniejący (`GET/PUT
  /api/ai-settings/user`) zreużyty, nowej kolumny nie dodano do `user_ai_settings.auto_suggestions`
  celowo (to inna funkcja — AI autocomplete). Dowód pary na realnym Postgresie 16+pgvector: odczyt
  zimny użytkownika A (OFF, bez `localStorage`) i domyślny odczyt użytkownika B (true, bez wycieku
  ustawienia A). **NIEZWERYFIKOWANE jawnie w commicie**: pełna ścieżka HTTP z auth+Express i
  zachowanie w przeglądarce (e2e).
- **DEC-387** (kompletne karty inicjatyw, flaga `ff_initiativeCardContract` DALEJ OFF): **ZROBIONE**.
  Naprawa = odwrócenie zamkniętej allowlisty `hiddenSectionIds`, parytet OFF↔ON 24=24 sekcji,
  5/5 grup, dwie mutacje potwierdzają bezpiecznik (usunięcie `risk-raid` → 1 FAIL/5 PASS; seed 2
  ukrytych sekcji → `expected 22 to be >= 24`). **NIEZWERYFIKOWANE**: 6 pozostałych typów kart,
  interakcja z `initiativeTemplate.visibleSections`, kolejność grup wobec kanonu §13.1.
- Obie decyzje **nie mają wiersza w `OWNER_DECISION_LEDGER_2026-08-24.md`** (§3 punkt 3) — do
  uzupełnienia.

## 5. Pierwsze kroki dla następnej sesji

1. Przeczytaj `REJESTR_ZNALEZISK_20260903.md` sekcje L i M (do M27) oraz `LEKCJE_20260904.md` w
   całości — to jest kompletny, zweryfikowany stan dnia 04.09, nie tylko skrót powyżej.
2. Zdecyduj o redeployu stagingu (85 commitów zaległości, §1/§3.1) — użyj `consultify-promocja-demo`.
3. Wydaj odbiór adwersaryjny dla 10 duties 314–323 (worktree gotowe, §1/§3.2) — ten sam wzorzec co
   dziś (Opus, worktree `ag-odbior-*`, format identyczny z `odbior-*20260904.md`).
4. Dopisz DEC-386/DEC-387 do `OWNER_DECISION_LEDGER_2026-08-24.md` z pełną numeracją (§3.3/§4).
5. Rozstrzygnij rozjazd 4 vs 5 w worktree 293, jeśli wciąż istnieje (§3.4).
6. Nie wydawaj żadnej „wklejki od nowa” dla 299/300/301/307/308/309/310 — wszystkie mają dziś
   werdykt (§3.8).
