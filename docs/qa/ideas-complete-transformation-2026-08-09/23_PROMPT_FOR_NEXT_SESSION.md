# 23 — Prompt for the next session

Copy everything between the rules into the new session as the first message.

**Rewritten 2026-08-12 (this continuation)** to reflect four defects closed
(D1–D4), hygiene, and RISK-24's mechanism-level detail since the previous
version of this file (which cited HEAD `bcdda752b7` / code-final
`f5cdc7b867`). Those SHAs are now historical — see `RESUME_HANDOFF.md`,
`00_PROGRAM_STATUS_AND_VERSION.md` and `24_FINAL_ACCEPTANCE.md` §12 for the
full, dated record of what changed and why this file's own prior numbers
are superseded, not deleted.

---

Kontynuuj program Ideas Transformation w GŁÓWNYM worktree integracyjnym
(`ideas-transform/consultify`, branch `codex/ideas-transformation-20260809`) —
to jest KANONICZNA linia: każda gałąź strumienia, w tym dokumentacyjna, była z
niej wycięta i wraca do niej przez cherry-pick. Nie ma tu rozjazdu do
uzgadniania.

Worktree: /Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify
Branch:   codex/ideas-transformation-20260809
Kandydat kodu (SHA sprzed commita dokumentacyjnego tej fali): `914759d4cb`
Finalny SHA (HEAD po commicie dokumentacyjnym tej fali): KANDYDAT KODU+DOKUMENTACJI: `83d6576c83e98b2316f02a6e5590b5d9cf3c24a6` — na tym SHA zmierzono E15, macierz wizualną
i Golden Journey. FINALNY HEAD to commit uzupełniający niniejsze wyniki; jest on
WYŁĄCZNIE dokumentacyjny (zero plików kodu), więc pomiary powyżej pozostają ważne.
Finalny SHA odczytaj z `git log -1` — commit nie może zawierać własnego skrótu.
  — commit dokumentacyjny sam zmienia HEAD i nie może cytować własnego
  hasha; przeczytaj `git log -1` po jego wylądowaniu, żeby wypełnić ten
  znacznik, zamiast zgadywać.
Pozycja: **83 commitów przed origin/demo@9d17cac114, 2 ZA** (41 odziedziczonych
  z wcześniejszych fal/przebiegów + commity tej kontynuacji — policz sam:
  `git log --oneline 9d17cac114..HEAD | wc -l`), drzewo czyste.
Pushowane? **NIE — i to jest teraz jawnie stwierdzone, nie tylko domyślne:**
  `git ls-remote origin 'codex/ideas-transformation-20260809'` zwraca PUSTO,
  `git branch -r` nie ma pasującej gałęzi. **REMOTE REACHABILITY: NOT
  VERIFIED, PUSH AUTHORIZATION REQUIRED** — zanim ktokolwiek spoza tego
  systemu plików będzie mógł to zrecenzować, zmergować czy zdeployować,
  potrzebna jest jawna autoryzacja push. Nic w tym pakiecie nie jest
  scalone z `demo`, nic nie jest wdrożone.

KROK 0 — origin/demo się przesunęło w trakcie wcześniejszej fali (9d17cac114 → f3e7df565e,
"Slack Command Center hardening", INNA sesja). Baza porównawcza dla KAŻDEGO A/B w tym pakiecie
ZOSTAJE zamrożona na 9d17cac114 — nie przestawiaj jej. Rozłączność zweryfikowana: te 2 commity
dotykają 6 plików, zero przecięcia z czymkolwiek dotkniętym przez ten program.

KROK 1 — przeczytaj w całości, w tej kolejności:
1. docs/qa/ideas-complete-transformation-2026-08-09/RESUME_HANDOFF.md   ← zacznij tutaj,
   ZWŁASZCZA blok "UPDATE 2026-08-12 (this continuation)" na samej górze pliku
2. .../24_FINAL_ACCEPTANCE.md — CAŁOŚĆ, ale zwłaszcza §12 (najnowszy stan) i §9
   (pełna lista rezydualiów — dłuższa niż jeden punkt)
3. .../22_CODEX_REVIEW_REPORT.md — zwłaszcza §7 (co się zmieniło po napisaniu
   raportu, aktualizowane kaskadowo przy każdej fali)
4. .../20_E15_TWO_CLEAN_ROUNDS.md (finalny przebieg na f5cdc7b867 + dwie adjudykacje
   NOT CLEAN — E15 NIE zostało ponownie uruchomione po D1–D4; jeśli chcesz twierdzić,
   że regresja wciąż trzyma, uruchom je sam na aktualnym HEAD, nie cytuj starego SHA)
5. .../16_OPEN_RISKS_AND_LIMITATIONS.csv (39 wierszy; parsuj PRAWDZIWYM parserem CSV —
   komórki mają przecinki w cudzysłowach; RISK-24's mechanizm rozwinięty prozą w
   `24_FINAL_ACCEPTANCE.md` §12 i `00_PROGRAM_STATUS_AND_VERSION.md`, ale sam wiersz
   CSV NIE był edytowany żadną z tych fal — CSV w tym katalogu jest poza zakresem
   prac dokumentacyjnych)
6. .../19_VISUAL_CX_MATRIX.md (sekcja RISK-39 = zamknięta S20-DOCS; sekcja
   PRODUCTION-SHAPE = historyczne znalezisko, już nietriażowane bo domknięte)

KROK 2 — sprawdź stan zanim cokolwiek zrobisz:
    cd "<worktree>" && git log --oneline -5 && git status --short && git rev-list --left-right --count origin/demo...HEAD
    git ls-remote origin 'codex/ideas-transformation-20260809'
    for g in check-actions check-action-coverage check-list-canon check-ledger-csv check-artefakt check-focus-canon; do bash scripts/$g.sh >/dev/null 2>&1; echo "$g rc=$?"; done
Oczekiwane: HEAD = commit dokumentacyjny tej fali (sprawdź `git log -1 --format='%H %s'`),
0 zmian, "2 <N>" gdzie N rośnie z każdą falą (2 ZA origin/demo, N PRZED — NIE zakładaj
konkretnej liczby, policz), `git ls-remote` PUSTE (jeśli NIE jest puste, ktoś pushnął —
zatrzymaj się i ustal kto/kiedy/dlaczego przed czymkolwiek innym), WSZYSTKIE bramki rc=0.
Jeśli cokolwiek się nie zgadza — zatrzymaj się i ustal dlaczego, zanim ruszysz dalej.

KROK 3 — otwarte sprawy, w kolejności ważności (żadna nie blokuje tylko dlatego że
"to już prawie gotowe" — ta fraza była już raz odrzucona przez właściciela, patrz
`24_FINAL_ACCEPTANCE.md` §11):

1) PUSH AUTHORIZATION — ta gałąź ma ZERO refów na origin. Żadna recenzja Codex, żaden
   merge, żaden deploy nie może się zacząć, dopóki ktoś z autoryzacją nie zdecyduje
   pushować. To NOWY punkt na liście, nie było jawnie stwierdzone we wcześniejszych
   wersjach tego pliku.
2) Właścicielski akcept wzrokowy (rule #7) — zamyka WYŁĄCZNIE RISK-19/matrycę wizualną,
   nie zamyka niczego innego z tej listy. **MACIERZ WIZUALNA — 80 kombinacji, żywa aplikacja (2026-08-13).**
4 narzędzia (Mind Map, Whiteboard, Process Flow, Table) x 4 rozdzielczości
(1920x1080, 1280x720, 390x844, 1280x720@200% tekstu) x light/dark x PL/EN(+JA).
- 1920x1080 i 1280x720: **PASS** dla wszystkich 4 narzędzi, obu motywów, PL i EN.
  Zero przewijania poziomego strony, 0 przepełnień, 0 przycięć.
- Regresja nakładania `Updated` vs kolumna akcji: **ZAMKNIĘTA** — zmierzony odstęp
  +31 px (data kończy się na 1804, kebab zaczyna na 1835), `overlap: false`.
- **1280x720 przy 200% powiększenia tekstu: FAIL** — wspólna powłoka (pasek zakładek
  modułu) urywa się w połowie słowa bez uchwytu do przewijania; data i kebab przycięte
  krawędzią. Dotyczy WSZYSTKICH 4 narzędzi → defekt powłoki, nie narzędzia.
- **390x844: NIE JEST udowodnionym FAIL-em.** Automat zgłosił przepełnienie, ale zrzut
  pokazuje dedykowany układ mobilny (hamburger, dolna nawigacja, zredukowana tabela).
  Automat mierzył współrzędne paska desktopowego, który tam nie obowiązuje. NIEROZSTRZYGNIĘTE.
- **Locale JA: FAIL** — `jaDetectedInMain=false` w 16/16 kombinacji. Japoński dociera do
  powłoki (ヘルプセンター, フィードバック, ドキュメント), ale treść modułu renderuje
  angielski fallback. PRZYCZYNA (zmierzona): moduł koduje binarny wybór `isPolish ? PL : EN`
  w 60 miejscach zamiast `t()`. Na baseline `origin/demo` samo `IdeasTableContent.tsx` miało
  49 takich wystąpień, kandydat ma 43 → program ten dług ZMNIEJSZYŁ, nie wprowadził.
  To STAN ZASTANY, nie regresja migracji jp->ja.
3) RISK-24 — konwergencja schematu na czystej bazie nadal zepsuta obydwoma runnerami.
   Ta fala rozwinęła MECHANIZM (nie naprawiła): `server/scripts/migrate.postgres.ts:555-558`
   z flagą `--safe` zapisuje padniętą migrację jako `skipped` i kończy z exit 0 ("✅ Postgres
   migrations complete" mimo błędu); `db:migrate`/`db:migrate:strict`/`db:migrate:postgres`
   to TA SAMA komenda bez flagi, `db:migrate:unsafe-continue` to ta z `--safe` — nazwa
   "safe" jest na niebezpiecznej; DRUGI, niezależny mechanizm `DB_MANAGED_SCHEMA`
   (server/src/index.ts:239-244, server/src/database/PostgresDatabase.ts:477-479) może
   wyłączyć auto-DDL/migracje przy starcie serwera. Wniosek: "zielona migracja" niczego
   nie dowodzi o zgodności schematu. Nadal OPEN, nie naprawione.
4) E15 mechaniczny werdykt to NOT CLEAN przy `f5cdc7b867`/`f86afc077f` — NIE zostało
   ponownie uruchomione po D1–D4 tej kontynuacji. Jeśli twierdzisz cokolwiek o obecnym
   stanie regresji, uruchom E15 sam na aktualnym HEAD zamiast cytować stary SHA.
5) Cztery defekty tej kontynuacji (D1/D4/D2/D3) mają dowód TYLKO na poziomie kandydata
   (implementacja + test celowany) — ŻADEN nie ma odbioru runtime (klik w działającej
   aplikacji) ani integracji. Rozdziel te trzy rzeczy jawnie, jeśli o nich piszesz:
   kandydat / odbiór runtime / integracja. Pełny opis: `RESUME_HANDOFF.md` (blok na
   górze), `24_FINAL_ACCEPTANCE.md` §12.
6) Luka lokalizacji `mindmap.persistence` — klucze `mapLoadErrorTitle`/`mapLoadErrorBody`/
   `mapLoadErrorRetry` dodane przez D2 mają realną treść TYLKO w en/pl; de/ar/ja/es mają
   surowy angielski tekst jako PLACEHOLDER (zweryfikowane bezpośrednio w plikach
   translation.json). To ten sam typ luki co RISK-26, nowa instancja, OPEN.
7) RISK-30 rezydualne: `confirmed:false` nadal nie wysyła wiadomości na czacie, więc 58
   niezmigrowanych akcji może dalej brzmieć jak sukces w odpowiedzi Teresy. Potrzebna ścieżka
   korekty w UI czatu, nie tylko uczciwa flaga.
8) RISK-31/RISK-36 wydajność: N>=500 (Process Flow) i N=5000/10000 (Tabela) NIE ZMIERZONE,
   dosłownie, decyzją właściciela — maszyna miała obciążenie 84-832 z procesów niezwiązanych z
   Consultify. Nie opisuj żadnej z tych zmian jako poprawę bez czystej liczby.
9) Golden journey (create → develop → convert, cross-tool) — NIE ZWERYFIKOWANE jako
   jeden ciągły przebieg na żadnym SHA w historii programu. **GOLDEN JOURNEY — PRZEJŚCIE Z REALNYM WYWOŁANIEM MODELU (2026-08-13).**
Kroki 1-4, 7-10: PASS. Krok 5 (realna odpowiedź modelu): **PASS**.
- model `openai/gpt-4o-mini`, provider `openrouter`, `degraded: null`,
  tokeny 32 wej. / 50 wyj., odpowiedź 200 znaków, merytoryczna, po polsku.
- Dwie blokady były SZTUCZNE i zostały zdjęte: (a) `E2E_MODE=true` w moim własnym
  procesie backendu powodował bezwarunkowy short-circuit w `server/src/routes/ai.routes.ts:2077`
  zwracający atrapę `E2E_OK: Received "..."` PRZED kontaktem z modelem; (b) brak
  `OPENROUTER_API_KEY` (aplikacja routuje przez OpenRouter, nie bezpośrednio przez
  OPENAI/ANTHROPIC). Po zdjęciu obu — realne wywołanie działa.
- Izolacja bazy utrzymana przez cały czas: `127.0.0.1:54331/ideas_final`, zero połączeń
  do demo/dev/produkcji (zweryfikowane `lsof` na PID procesu).
- USTALENIE POZYTYWNE: przy braku providera Teresa NIE zmyśla sukcesu — zwraca jawne
  `NO_LLM_PROVIDER`, `degraded:{mode:"blocked"}`, `confidence: 0`, `outputLength: 0`.
- ŚCIEŻKA NEGATYWNA: PASS — jawny błąd, licznik prób (3/3), działający przycisk „Try again".
- DROBNE RYZYKO: licznik `version` rośnie przy samym otwarciu warsztatu (78->83->86->88->90->93
  bez zmiany treści). `version` NIE jest dowodem zmiany; dowodem są `nodes`/`edges`.
10) `24_FINAL_ACCEPTANCE.md` §9 ma pełną listę jedenastu pierwotnych rezydualiów — jeden
    (E07 kebab/RISK-39) domknięty S20-DOCS, reszta otwarta. Przeczytaj tę listę w całości,
    nie tylko ten plik — ten plik jest skrótem, nie zamiennikiem.
11) **E15 — DWIE STABILNE RUNDY (2026-08-13, SHA `83d6576c83`).**
Zakres dowiedziony z JSON samego przebiegu: 216 plików / 1304 testy
(`tests/components/MyWork` + `src/components/MyWork` + `tests/unit/mindmap`).
Runda 1: 1183 PASS / 121 FAIL / 0 SKIP / 37 s. Runda 2: identycznie, 38 s.
Porównanie PER TEST: **0 różnic**. `RecordExpandModal … Escape closes and
restores focus` — który przy zamrożeniu 2026-08-12 był chwiejny i przesądził
status BLOCKED — przeszedł w OBU rundach.
A/B wobec zamrożenia: 121 czerwonych wtedy, 121 teraz, **0 nowych, 0 naprawionych**
(identyczny zbiór) → cztery poprawki nie wniosły regresji.
PUŁAPKA DO ZAPAMIĘTANIA: `npx vitest run` BEZ filtra katalogów uruchamia całe
monorepo (3869 plików / 38 896 testów), a nie E15. Taki przebieg NIE jest E15. — miejsce na wynik następnego pełnego przebiegu E15,
    kiedy ktoś go uruchomi na aktualnym HEAD.

ZAMKNIĘTE w tej i poprzednich falach, żeby nie tracić na to czasu (sprawdź
`16_OPEN_RISKS_AND_LIMITATIONS.csv` i `24_FINAL_ACCEPTANCE.md` §3 zanim zaczniesz naprawiać
którekolwiek z poniższych — mogą już nie być otwarte):
- `scripts/check-actions.sh` — rc=0 (234/124/7/4) od commitu a537a022e2 — droga przez
  rejestr, nie --update.
- Type-check klienta i serwera — PASS przy f5cdc7b867 (dwa defekty międzyplikowe znalezione i
  naprawione dopiero na scalonym drzewie); dodatkowo ta fala złapała 4× TS2345 w NOWYM
  teście D1 (b2438008fd) — również dopiero pełnym `tsc`, nie esbuildem. **Pierwszy przebieg
  `tsc` na tym drzewie zwrócił rc=134 (SIGABRT/OOM) i wyglądał jak "0 błędów" — to FAŁSZYWA
  ZIELEŃ. Dopiero `NODE_OPTIONS=--max-old-space-size=8192` ujawniło prawdziwe błędy.**
- E15 dwie czyste rundy — URUCHOMIONE na f5cdc7b867/f86afc077f (patrz punkt 4 wyżej —
  NIE re-uruchomione po D1-D4).
- RISK-39 (Idea Table kebab/Updated-column przy 1280×800) — ZAMKNIĘTE S20-DOCS.
- D1 (cross-identity leak w sessionStorage), D4 (force-navigate ze Skip), D2 (DATA-LOSS:
  cichy nadpis realnej mapy szablonem startowym przy błędzie GET /map), D3 (zawieszony
  wskaźnik "Changes queued") — ZAMKNIĘTE tej kontynuacji, poziom kandydata, patrz punkt 5.
- Higiena `git diff --check` — 20 nie-CSV znalezisk wyczyszczone (a64b2657be); 580
  pozostałych to 4 dowodowe CSV (RFC 4180, CRLF poprawny, celowo NIE konwertowane).

ZASADY, które trzymają wiarygodność tego programu (każda kupiona defektem):
- Nie ufaj raportowi agenta — uruchom sam. Ta fala złapała: rozjazd między tekstem CSV a plikami
  faktycznie leżącymi na dysku; liczbę kluczy lokalizacji, która przeszła dwie rewizje zanim
  wylądowała na prawdziwej (445/461 → 478/494); i FAŁSZYWĄ ZIELEŃ tsc (rc=134 wyglądający jak
  sukces).
- Atakuj każdą zieleń, zanim ją przyjmiesz — także zieleń z WYŁĄCZENIA jednej warstwy
  dwuwarstwowej ochrony. Sabotaż OCC dla RISK-12 był dwuetapowy: wyłączenie SAMEGO
  szybkiego sprawdzenia wersji JS zostawiło zielone (warstwa SQL compare-and-swap złapała
  sama) — to redundancja, nie pusta asercja. Dopiero wyłączenie OBU warstw dało czerwone.
- Plik, który znika CAŁKOWICIE, potrafi ukryć się przed porównaniem, które patrzy tylko na
  przecięcie zbiorów plików. Wcześniejsza runda E15 zgłosiła "0 plików straciło testy" i
  przegapiła dokładnie taki plik — porównuj ZBIORY nazw plików, nie tylko liczniki testów na
  przecięciu.
- „Znana przedistniejąca porażka" to twierdzenie, nie fakt, dopóki nie porównasz A/B z
  origin/demo@9d17cac114.
- Pytaj „harness czy produkt?" zanim naprawisz cokolwiek widziane na zrzucie — i pytaj to
  jeszcze raz zanim ogłosisz macierz aktualną: sprawdź pliki na dysku, nie tylko tekst CSV.
- Łap prawdziwe kody wyjścia. `cmd | tail` zwraca status `tail`. NODE_ENV=test bez
  RUN_DB_TESTS=1 i MOCK_DB=false = CICHA ATRAPA BAZY. Bramki czytają ścieżki względem cwd —
  uruchamiaj z korzenia worktree. **`tsc` może zwrócić rc=134 (OOM/SIGABRT) i wyglądać jak
  zielony w powierzchownym odczycie — sprawdzaj kod wyjścia dosłownie, nie tylko treść stdout.**
- Sabotaż, który psuje KOMPILACJĘ (nie tylko logikę testowaną), daje czerwone z niewłaściwego
  powodu w całym pliku testowym — potwierdź, że sabotażowany kod nadal się kompiluje
  (np. sprawdzenie składni esbuildem) zanim uznasz czerwone za dowód.
- Test, który sam wyprowadza swoją surowość z zmierzonego stanu runtime zamiast ze stałego
  oczekiwania, może zostać rozbrojony przez samą regresję, którą ma łapać.

ŚRODOWISKO — oszczędzi Ci godziny:
- `tsc` uruchamiaj SZEREGOWO (klient, potem serwer), z `NODE_OPTIONS=--max-old-space-size=8192`
  jeśli podejrzewasz rc=134. Na tej maszynie działa kilka sesji naraz.
- `git stash` jest WSPÓLNY dla wszystkich worktree tego repo. Do porównań używaj
  `git diff > /tmp/x.patch` i `git apply -R`.
- Czyste `git apply` może wnieść złą treść BEZ konfliktu — sprawdzaj `git log --oneline
  <base>..HEAD -- <plik> | wc -l` = 0 znaczy „nie Twój".
- Bazy efemeryczne (127.0.0.1:54329 i :54331, ta druga **1012 tabel** po migracji E09)
  po 24h prawdopodobnie już nie istnieją. Przepis odtworzenia: 13_RUNTIME_GATE_EVIDENCE.md §2.
  NIGDY demo (trolley:28146), NIGDY produkcja (centerbeam:37823), NIGDY dev (thomas:20221).
- Realne testy bazy potrzebują OBU: RUN_DB_TESTS=1 ORAZ MOCK_DB=false.
- Migracje: `--safe` NIE jest bezpieczne — patrz KROK 3 punkt 3. Nie ufaj samemu exit code
  migracji bez sprawdzenia, czy któraś nie została po cichu zapisana jako `skipped`.

OGRANICZENIA: bez push (dopóki nie ma jawnej autoryzacji), bez merge do demo, bez deployu,
bez migracji na demo/produkcji, bez git stash/reset/clean/checkout do cofania zmian
dokumentacyjnych. Nie deklaruj READY_FOR_CODEX_REVIEW ani DONE dla niczego bez odbioru
runtime — rozdzielaj zawsze: (a) kandydat implementacyjny, (b) odbiór runtime, (c) integracja.
Braki oznaczaj literalnie BLOCKED lub EVIDENCE_MISSING, nie omijaj ich milczeniem. Owner
acceptance jest JEDYNYM realnym brakiem WYŁĄCZNIE dla RISK-19 — nie dla całego programu, patrz
`24_FINAL_ACCEPTANCE.md` §9/§11.

---
