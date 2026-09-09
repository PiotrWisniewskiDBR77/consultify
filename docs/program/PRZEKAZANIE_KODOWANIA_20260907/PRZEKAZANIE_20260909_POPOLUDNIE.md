# PRZEKAZANIE 09.09.2026 ~16:45 — punkt wejścia dla kolejnej sesji nadzorcy

Gałąź integracyjna: `mvp/inicjatywy-lancuch-20260907`, worktree `~/Developer/wt/fable-inicjatywy` (node_modules = symlink do `~/Developer/Consultify/node_modules`). Sekrety: `~/Developer/consultify-secrets/` (`server.env`, `railway-staging.json`, `northwind-konta-STAGING.txt` — hasło ZROTOWANE 09.09 14:50, staging + demo). Zrzuty i manifesty: `~/Developer/consultify-dumps/` (+ `manifesty/`).

## Stan środowisk
- **Staging** (thomas): kod `8c53292819` w drodze (run 34377136109, fala 3f: naprawa językowa Materiałów + raporty testu); poprzednio `0d79170f2a`. Baza po czystce 09.09: 4 organizacje (DBR77 `a3e05d4a-…`, `dbr77`, Northwind `468b234c-…`, System); manifesty rollbacku w `~/Developer/consultify-dumps/manifesty/`, pełny zrzut sprzed czystki `staging-thomas-20260909-0059.dump`. Flaga `VITE_MODULE_MEETINGS=true`.
- **Demo** (trolley): kopia stagingu 09.09 (dane + 36 zmiennych + kod `0d79170f2a`); promocja `8c53292819` uruchamia się automatycznie po health stagingu (obserwator w scratchpadzie tej sesji — jeśli sesja padła, sprawdź `gh run list --workflow railway-deploy.yml --limit 3` i health `https://demo.consultify.ai/api/health`). **Wdrożenie demo = `gh workflow run railway-deploy.yml --ref staging -f environment=demo -f confirm_demo=yes`** (promuje tag `staging-deployed`); push na gałąź `demo` nic nie wdraża.
- Wdrożenie stagingu = `git push origin HEAD:staging` (FF) + `gh workflow run railway-deploy.yml --ref staging -f environment=staging`; health `gitSha`.
- Produkcja (centerbeam) NIETKNIĘTA.

## W toku (robotnicy w tle, worktree `~/Developer/wt/`)
1. **DANE-D9** (Opus, `wt/dane-d9`, gałąź `mvp/dane-d9-dosiew-0909`, baza d31, porty 4210/3228): etap seedu `server/scripts/seed/demo-en/09-dosiew-po-tescie.ts` domykający 5 braków z `TEST_JEZYK_I_DANE_20260909/RAPORT_DANE.md` §5 (profil Organizacji 13/13, ≥3 `interview_assignments`, migawka `published` karty KPI, rozkład 42 zadań na ≥8 tygodni, pola pochodne). Po meldunku: scalić (konflikty JSON → `scal-json.py` w scratchpadzie sesji; jeśli brak, ręcznie three-way), bramka (tsc serwera 0), potem tryb zdalny seedu na staging i demo: `ALLOW_STAGING_SEED=1 … --cel-zdalny staging --rozumiem-staging --oczekiwany-host thomas …` (komendę poda meldunek), `--verify`.
2. **POPRAWKI-PO-TESCIE-1** (Opus, `wt/poprawki-po-tescie`, gałąź `mvp/poprawki-po-tescie-0909`, baza d32, porty 4211/3229): defekty kodu D-01, D-02, D-17, D-06, D-08/09, D-11, D-15 (tylko pomiar), D-07, D-10, D-12 z `RAPORT_DANE.md` §4. Po meldunku: scalić ze znacznikami `[ODMROZENIE …]`, bramka 4-krokowa (tsc serwera 0, tsc frontu ≤192 z `NODE_OPTIONS=--max-old-space-size=8192`, `pomiar-jezyka.mjs --baseline`, `vite build` z 6144), push staging → promocja demo, wiersz rejestru.

## Procedura scalania paczki (sprawdzona 20× dziś)
`git merge --no-ff --no-commit <gałąź>` → konflikty tylko w `baseline.json`/`translation.json` → helper `scal-json.py` (baseline: min per klucz; translation: three-way, pomija klucze skasowane u nas) → `git commit -m "probe"` pokazuje wymagane znaczniki → commit właściwy z `[ODMROZENIE <MODUL> DEC-453]` (jeśli „probe” przeszło, `--amend` treść) → evil-merge check: `git diff --stat HEAD^2 HEAD -- $(git diff --name-only $(git merge-base HEAD^1 HEAD^2) HEAD^2)` ma pokazać tylko JSON-y → bezpieczniki `jezyk*.source.test.ts` → bramka → push → rejestr → `git worktree remove`. Nie kasuj gałęzi przed commitem scalającym.

## Zostaje (kolejka, wg priorytetu)
- Po D9 i POPRAWKI: ponowny przebieg TEST-DANE B3/B1 na kopii ze świeżego zrzutu (kryteria w `KRYTERIA.md`) i aktualizacja `RAPORT.md` werdyktu.
- Wyniki/OKR w PL „Jul to Sep” (źródło poza komponentami — serwer/dane).
- Klony sesji demo „Atelier Toys” wracają przy użyciu funkcji sesji demo (`ALLOW_BRANDED_DEMO_ORG`) — decyzja: wyłączyć na stagingu/demo albo sprzątać cyklicznie (`scripts/dane/usun-organizacje.ts` + lista slugów `ateliertoys-demo-session-*`).
- Dług językowy: K7 Admin 174 + serwer 87; K5 serwer (J17); maile/PDF (J19); prompty (J20); wersja PL (Ustawienia ~330, Admin K4en 543); `wykryjPolski` w głównym przyrządzie tylko z ogonkami (pomocniczy `scripts/i18n/polski-bez-ogonkow.mjs`).
- Stare STOP-y J10: 8 dat w plikach 04_ASSESSMENT/07_MY_WORK; format daty listy (`Aug 14, 2026` vs kanon).
- Skill `consultify-promocja-demo` krok 7 nieaktualny (push nie wdraża).

## Rejestr i dowody
Rejestr: `docs/program/PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md` (wiersze „FALA JEZYKOWA …”, „DANE D0…”, „TEST JEZYK I DANE …”, „DEMO = KOPIA STAGINGU”, „TESTER — czat”). Karta poranna: `KARTA_PORANNA_20260909.md`. Test: `docs/program/TEST_JEZYK_I_DANE_20260909/{KRYTERIA,RAPORT,RAPORT_JEZYK,RAPORT_DANE}.md`, dowody `evidence/test-jezyk-dane-0909/`.
