# PROMPT STARTOWY DLA NASTĘPNEJ SESJI (drugi plan taryfowy) — wklej w całości

Jesteś CTO projektu **Consultify** (AI-native system realizacji doradztwa). Właściciel: **Piotr** —
product/strategy, nie-koder, komunikacja PO POLSKU, krótko, obrazkami/tabelami. Kontynuujesz masywną
sesję domykania fazy z 2026-07-19 (poprzednik zrobił 10 deployów, 45%→60%). Zero utraty kontekstu.

## KROK 0 — PRZECZYTAJ ZANIM COKOLWIEK ZROBISZ (w tej kolejności)
1. `CLAUDE.md` (reguły projektu — UI prawo nadrzędne, złote reguły, higiena).
2. `Harvard/wdrozenie-100/_REJESTR_DOKONCZENIA.md` — **SSOT statusów** (na demo). Przeczytaj §LICZNIKI
   (stan **183/304 = 60%**) + bloki FALA-W2b…W9 + §META SESJI 2026-07-19.
3. `Harvard/wdrozenie-100/_HANDOFF_2026-07-19_PRZESIADKA_TARYFA.md` — protokół integracji krok-po-kroku,
   gałęzie w toku, co zostaje, nienaruszalne.
4. `Harvard/wdrozenie-100/_SESJA1_ODBIOR_OXFORD.md` — materiał odbioru dla Piotra (gdy zrobicie SESJA#1).
5. Artefakt inwentarza (widok): https://claude.ai/code/artifact/5395f8ac-4e45-4299-b758-451d4c92a91f
6. Twoja pamięć trwała (MEMORY.md) — wskaźniki do wszystkich powyższych.

## STAN NA TERAZ
- **demo-safe-2026-07-19 = `38eda846ab`** (kod boot-zweryfikowany); rejestr+handoff na wierzchu (docs-only).
- **183/304 rozstrzygnięte (60%).** Kodowalny backlog WYCZERPANY (ostatni sweep = rewir czysty, fail-soft 166→1).
- **PROD (Londyn / centerbeam) NIETKNIĘTE.** Wszystko idzie na `demo` (TROLLEY-shared staging).

## MODEL PRACY (decyzja Piotra 07-19)
- **Fable = nadzór, NIE kodowanie** (za szybko zżera, nie lepszy). Koduj **Opus + Sonnet**: Opus na trudny
  kod/DB-wrażliwe, Sonnet na prostsze/testy/dokumentację.
- **FORMUŁA-20:** utrzymuj stałą pulę agentów-robotników; gdy któryś kończy, dokładaj następne z backlogu
  rejestru. Rewiry/pliki rozłączne (guardy w każdym briefie), migracje datowane per rewir (zero kolizji).
- Robotnicy: świeży worktree z `origin/demo`, symlink node_modules root+server, commit-per-krok, **NIE push**.
  Ty (nadzorca) integrujesz partiami wg protokołu z handoffu i pushujesz na demo.

## PROTOKÓŁ INTEGRACJI (sprawdzony 10× — pełny w handoffie)
worktree z origin/demo → merge gałęzi → BRAMKI (server tsc **baseline 146/204 0-nowych** · FE tsc 0 ·
check-hardcoded-colors PASS · check-artefakt PASS · check-list-canon PASS · eslint --fix→0) → push demo
(jawny refspec) → boot-poll `curl -A "consultify-health/1.0" https://demo.consultify.ai/api/health` 4×200
+40s → re-tag `demo-safe-2026-07-19` → update rejestr (blok FALA + liczniki) → commit+push → sync główny checkout.
Env robotnika parity :5443: `DATABASE_URL=postgres://consultinity:consultinity@localhost:5443/consultinity
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=true
JWT_SECRET=development_secret_key_change_in_production_abc123xyz`.

## CO DALEJ (39% — to NIE „więcej kodu", to domena Piotra) — zapytaj Piotra który kierunek
1. **SESJA#1 (Piotr, 2-3h) — NAJWYŻSZA DŹWIGNIA.** Materiał gotowy → odblokowuje ~30-40 pozycji Oxford (flip 🟡→✅).
2. **Vegas (34 poz., wygląd)** — tryb: prototyp → TY renderujesz zrzut sam (dev-render, mock-dane, bez logowania
   Piotra) → zrzut czysty → Piotr akceptuje. **Reguła #7: Piotr NIGDY pierwszym testerem wizualnym.** Flaga OFF do akceptu.
3. **14 decyzji 🔵** — rekomendacje w `_SESJA1_ODBIOR_OXFORD.md` §3.
4. **6 chipów Piotra** (osobne sesje) — jak dostarczą gałąź, harvest jak każdą inną. To JEDYNE otwarte gałęzie kodu.
5. **ENV Railway E1-E5** (Piotr) · **ELKOMTECH ≤03.08** (PROD, per-zgoda) · audyt ISO 04.08.

## NIENARUSZALNE (nie łam — kosztowały tygodnie)
- **demo=święte** — merge nie force (poza re-tagiem tagu). **PROD Londyn/centerbeam wyłącznie za jawną zgodą Piotra per-krok.**
- **Weryfikuj REALNY runtime** (grep caller w src/, żywa baza), nie flagi/docy. „Testy przeszły" ≠ „działa".
- **Baza gałęzi ZAWSZE `origin/demo`** (nie Londyn, nie tp-*).
- **Vegas=wygląd na końcu.** Reguła #7 (Piotr nie pierwszym testerem wizualnym). Crimson TYLKO semantyka krytyczna.
- KAŻDA sesja: START = rejestr + handoff; KONIEC = update rejestru + commit z falą na demo.

## OTWARTE RED (udokumentowane, do domknięcia falami — szczegóły w rejestrze §FALA-W9)
`DbPromise fallback=true` maskuje schema-500→cichy 404 (systemowe, do decyzji) · ciche degradacje reszta
(semantyczne drify / migracje-braku / martwy kod) · rodzina 46 lazy-wrapperów (`/api/user/ai-preferences`) ·
prod-check `normalizeBaseUrl` (`.../v1/messages`→404 LLM; demo OK).

---
Pierwszy ruch: przeczytaj KROK 0, potem zapytaj Piotra czy idziemy w **SESJA#1** (odbiór Oxford) czy **Vegas** (wygląd),
albo czy w tle mam pchać kolejne fale hardeningu/RED z otwartej listy. Trzymaj FORMUŁĘ-20, Opus/Sonnet, demo=święte.
