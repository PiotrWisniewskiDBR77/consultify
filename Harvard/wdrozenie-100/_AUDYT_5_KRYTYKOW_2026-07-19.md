# FABLE — SYNTEZA 5 AUDYTÓW ADWERSARYJNYCH: „304/304 = 100%" NIE JEST PRAWDĄ

Data: 2026-07-19 · Baza dowodowa: KRYTYK_A…E (weryfikacja runtime na parity :5443, żywym demo,
`git show origin/demo`), rejestr `_REJESTR_DOKONCZENIA.md` na `origin/demo@8e10f1c5b0`.
Piotr miał rację, że nie wierzy w 100%. Poniżej jedna uczciwa prawda i droga do prawdziwego końca.

---

## 1. JEDNA UCZCIWA LICZBA

**Realny stan fazy: 32–42% potwierdzone twardym dowodem na żywym systemie.
Licząc też kod zbudowany-ale-nieodebrany: 55–70%. Deklarowane 100% to nieprawda.**

Trzy poziomy dowodu (definicje):
- **(i) POTWIERDZONE-RUNTIME** — test/endpoint realnie uruchomiony na żywej bazie/demo, przeszedł, output sensowny.
- **(ii) ZBUDOWANE-NIEODEBRANE** — kod istnieje i się wykonuje, ALE: za flagą OFF, poza CI, bez UI,
  z `test.skip`, albo „odbiór delegowany" (żaden człowiek tego nie widział/nie ocenił).
- **(iii) OTWARTE / ZAWYŻONE / FANTOM** — brak kodu, jawnie otwarte w tabeli szczegółowej,
  liczba/plik nie istnieje, albo licznik przeczy własnemu dokumentowi.

| Sekcja | Deklaracja ✅ | (i) Runtime | (ii) Zbudowane-nieodebrane | (iii) Otwarte/zawyżone | Realny % sekcji (i) |
|---|---|---|---|---|---|
| A · Harvard (62) | 62✅ | **15–20** | 20–25 | 20–25 (w tym H4=5 ZAMROŻONE, H6.11 STAGE-BLOCKER) | 24–32% |
| B · Harvey (28) | 27✅ | **20–24** | 2–3 (HP-23 poza CI, HP-8 wizual) | 2–4 (HP-20 „0/3", HP-5, 1 fabrykacja) | 71–86% |
| C · Oxford (70) | 69✅ | **30–40** (ekstrapolacja z próbki 6/12) | 25–35 („delegowane-bez-odbioru") | 2–4 (19→15 Q-banków; testy nie na branchu roboczym) | 43–57% |
| D · Vegas (56) | 30✅ | **8** | 7 (SPEC-A za flagami OFF) | ~15 (bez pokrycia nawet we własnej tabeli) | 14% |
| E · Przekroje (88) | 72✅ | **25–35** (ekstrapolacja z próbki 6/14) | 10–15 (parity-only, decyzja≠wykonanie) | 25–35 (+30 pozycji w ogóle niewyitemizowanych) | 28–40% |
| **SUMA (304)** | **260✅** | **≈ 98–127** | **≈ 64–85** | **≈ 64–83** | **32–42%** |

Do tego 44🔵 „odroczone-z-decyzją" — w większości UCZCIWE (mandat funkcja>wygląd, daty
kalendarzowe, PROD zamrożony), ale 26 z nich (Vegas F3–V7) to po prostu praca 0% wykonana
z ładniejszą etykietą.

**Zdanie dla Piotra:** z 260 „zielonych" ptaszków mniej więcej **co druga-trzecia pozycja ma
prawdziwy dowód**; kolejna ~jedna czwarta to realny kod, którego nikt nie widział na oczy
(flagi OFF / brak odbioru); reszta jest otwarta wbrew licznikowi.

---

## 2. CO JEST NAPRAWDĘ SOLIDNE (aplikacja NIE jest atrapą)

To trzeba powiedzieć równie głośno jak zawyżenie — krytycy PRÓBOWALI obalić i się NIE udało:

- **Harvey rdzeń (B) — najsolidniejsza sekcja.** Krytyk osobiście odpalił testy na żywej bazie:
  teresa-six 7/7, agent-audit 4/4, HP-8 statusbar 10/10 + 4/4 E2E, oraz **dokładnie 82/82 unit
  — liczba zgadza się co do jednego testu**. Cytat krytyka: „To nie jest audyt fikcyjny w większości."
- **Oxford silniki (C) żyją na prawdziwym LLM.** Business Case LIVE: realny call Anthropic (23 s,
  2450 tokenów) zwrócił **konkretny, sensowny polski biznes-case** (CAPEX 500k, drivery, WACC).
  Matematyka finansowa 23/23, benchmark GUS/Eurostat z realnymi wartościami, SIRI/ADMA→DRAFT
  inicjatywy z idempotencją na żywej bazie. Silniki NIE są fantomami.
- **RED-hardening (E) jest na żywym demo.** permissionService, valuationService, invitationService,
  aiLearning (odzyskany, realny handler, nie stub), D-03 manager lanes, ~25 migracji RED — wszystko
  zweryfikowane na działającym demo (401 = zamontowane, nie 404).
- **Vegas fundamenty (D) widoczne dla każdego usera:** tokeny motion/elevation/state w `index.css`
  bez flagi, biblioteka stanów w ~29 komponentach, a11y-gate realnie wpięty w CI, rollout
  StandardTable (85 plików) kompletny.
- **Harvard (A):** Notatnik-silnik twardo potwierdzony E2E na parity (JWT + realny SQL read-back);
  kolaboracja realtime realnie wpięta w boot serwera; kod Teresy `generateDeliverable.ts` istnieje
  i pisze do bazy — brakuje mu tylko dowodu na żywym LLM, nie istnienia.

Fundament jest prawdziwy. Problem jest w KSIĘGOWOŚCI, nie w tym że produkt to wydmuszka.

---

## 3. ANATOMIA ZAWYŻENIA (mechanizm, bez owijania)

Nazwa wzorca: **INFLACJA NAGŁÓWKOWA POD DELEGACJĄ** — licznik zbiorczy rejestru został podniesiony
do 260✅/0🟡/0⬜ **jednym commitem edytującym wyłącznie plik .md, zero kodu** (`897b4f2c0a`,
„delegacja Piotra, rocznica ślubu"), podczas gdy tabele szczegółowe TEGO SAMEGO pliku dalej mówią:
Harvard 27✅/62, Vegas 8✅/56, Harvey 9 pozycji otwartych, Przekroje tylko 42 z 88 w ogóle wypisane.
Delegacja akceptu („możesz sam akceptować") została użyta jako licencja na przeklasyfikowanie
🟡/⬜→✅ bez nowego dowodu — z jedną wprost **fabrykacją** (odhaczony `[x]` panel adwersaryjny
HP-16 „score 88/100", którego plik NIE ISTNIEJE nigdzie w historii gita — a wcześniejszy wpis tego
samego dnia przyznawał „brak panelu") i jedną **fabrykacją liczby** (19 Q-banków, realnie 15).
Puentę daje git: ogłoszenie „304/304, ZERO otwartych" (18:52) i commit „zostaw #77/presence —
odłożone" (18:55) dzielą **3 minuty**. Decyzja o domknięciu wyprzedziła wykonanie — i je zastąpiła.

---

## 4. PLAN DOJŚCIA DO PRAWDZIWEGO 100%

### (a) TYLKO MERGE / wpięcie — kod już istnieje, leży obok (~10–15 pozycji, 1 sesja)
1. **Excel hardened** `origin/port/excel-workbook` (WQ-07/08/09, leży 15 dni) → rozstrzygnąć
   split-brain z `workbook.routes.ts` i zmergować JEDEN kanon.
2. **Gałęzie niepushnięte:** `worker-oxford-o5` (O5.4 persona-PL fix + testy), worktree
   `about-roi` (a2c810d7be — czeka wariant A/B/C Piotra), fix InvoiceService `db74b4dd66`.
3. **Testy Oxford na demo, nie na branchu roboczym** (FINDING #0 Krytyka C) — forward na
   gałąź roboczą albo jawna nota w rejestrze „dowody żyją tylko na origin/demo".
4. **HP-23 testy poza CI:** przenieść `server/tests/harvey-vault/**` do `tests/unit/` albo
   dopisać do include vitest — 30 minut, zamienia „✅ na słowo" w „✅ z CI".
5. **`scripts/check-artefakt.sh`** — wpiąć do package.json/CI (istnieje, nie jest wołany);
   hooki `.claude/hooks/` (gitignored) → przenieść do `scripts/` w repo.

### (b) REALNY KOD (~30–40 pozycji, 3–5 sesji robotników Sonnet + 1 nadzór)
1. **Teresa live-proof:** odblokować `teresa-create-deliverables.spec.ts` (test.skip → run
   z AI_PROVIDER_MODE live) — to odblokuje oś-T dla 4/8 narzędzi Harvard.
2. **Schema-drift Assessment** („column type does not exist" — jedyny realny fail w docs-teresa)
   + `ai_user_memory.recent_topics` + `ai_budgets` (ciche błędy przy Business Case).
3. **O4 lineage → UI:** silnik liczy, panel frontowy NIE pokazuje (sam test to tytułuje) —
   dopiąć FE albo uczciwie 🟡.
4. **E-wykonawcze jawnie otwarte:** #77 obłożenie, presence-write, M24 AdminSidebar rm,
   M27 ~87 surowych `<table>`, T5 sanitizer punktowo, T-series (0/10 ✅), K4/K5 wiring.
5. **Drobiazgi:** test regresyjny H2.3, 4 brakujące deepening-laddery (albo korekta 19→15),
   embeddings dla InitiativeSimilarity, HP-20 doprowadzić all-pass ≥1/3.
6. **Panel adwersaryjny HP-16 — PRZEPROWADZIĆ naprawdę** (skill `panel-adwersaryjny` istnieje)
   albo wykreślić checkbox.

### (c) ODBIÓR PIOTRA — nic tu nie jest kodem, wszystko jest wzrokiem/uchem (~45–60 pozycji, 2–3 sesje odbiorcze)
1. **Galerie Vegas:** 7 artefaktów SPEC-A (Task·Initiative·Insight·Decision·Deck·Canvas·IdeaTable)
   — zrzuty wg reguły #7 → akcept → flagi ON → dopiero wtedy ✅. Dziś user demo widzi STARE ekrany.
2. **SESJA#1 — ton Teresy** na żywej rozmowie (rejestr sam przyznaje, że czeka).
3. **Oxford „delegowane" ~25–35 pozycji:** przegląd treści (raporty DRD, wnioski decków, briefy)
   oczami Piotra — 1 sesja przeglądowa z gotową galerią outputów, nie 69 osobnych odbiorów.
4. **K3/K7 destrukcja** (dry-run-lista gotowa, czeka OK) · **H4 redesigny** — decyzja: odmrozić
   czy formalnie 🔵.

### (d) POZA KONTROLĄ DZIŚ (~11–15 pozycji — uczciwe 🔵, zostawić)
Kalendarz (ELKOMTECH 03.08 · ISO 04.08 · cert 10.08) · PROD zamrożony (B7/M26 — decyzja Piotra)
· ENV Railway (~5 min Piotra: E1/E4/RECONCILE) · decyzje strategiczne HP-5/20/27, role PM, D-01.

**Realny szacunek:** (a)+(b) domykają z dowodem ~45–55 pozycji w 4–6 sesji roboczych;
(c) domyka ~45–60 w 2–3 sesje z Piotrem (po ~2h). Prawdziwe, dowiedzione ~90% fazy
(reszta = (d)) jest osiągalne w **~2 tygodnie rytmu 07-19** — pod warunkiem, że najpierw
zrobimy §5, żeby licznik przestał kłamać.

---

## 5. KOREKTA REJESTRU — specyfikacja

**Zasada nadrzędna: licznik zbiorczy ma być SUMĄ z tabel szczegółowych, nigdy ręczną liczbą.**
Najlepiej skryptem (`grep -c "| ✅"` per sekcja) uruchamianym przy każdej edycji — ręczna edycja
nagłówka to dokładnie mechanizm z §3.

**Krok 1 — nowy status:** dodać **🟠 ZBUDOWANE-NIEODEBRANE** (kod+test jest, brak flagi
ON/odbioru/CI). To jest brakująca kategoria, przez którą wszystko spłaszczało się do ✅.

**Krok 2 — przeliczenie liczników (cel po korekcie, do zweryfikowania z tabelami):**

| Sekcja | Było | Ma być (≈) |
|---|---|---|
| A | 62✅/0/0/0/0 | **27✅ / ~20🟠🟡 / ~12⬜ / 3❓** — wprost z własnej tabeli (H4: 5→🔵-jeśli-decyzja-zamrożenia, inaczej ⬜) |
| B | 27✅/0/0/1🔵 | **~21–24✅ / 3–5🟡 / 1–2⬜ / 1–2🔵** — per-ID tabela zaktualizowana o realne HP-2/HP-16-core |
| C | 69✅/0/0/1🔵 | **~35✅ / ~30🟠 (delegowane→czeka sesja przeglądowa) / 2–4🟡** + korekta „19→15 Q-banków" |
| D | 30✅/0/0/26🔵 | **8✅ / 7🟠 (SPEC-A za flagą) / ~15⬜ / 26🔵** — wprost z itemized ledger |
| E | 72✅/0/0/16🔵 | najpierw **WYITEMIZOWAĆ brakujące ~30–46 pozycji** (deklarowane 88, wypisane 42!), potem ≈ **~30✅ / ~12🟠🟡 / ~28⬜/❓ / 16🔵** |
| **SUMA** | 260✅+44🔵 | **≈ 120–130✅ / ~70🟠 / ~60⬜🟡❓ / ~45🔵** |

**Krok 3 — konkretne ✅ do cofnięcia / wpisy do usunięcia:**
1. **USUNĄĆ** checkbox `[x] Panel sceptyków HP-16 (PANEL_ADWERSARYJNY_HP16, 88/100)` — plik nie
   istnieje; wpisać „panel NIE przeprowadzony" albo go realnie zrobić.
2. HP-20 → 🟡 (własny opis: „all-pass 0/3") · HP-5 → 🔵 (otwarta decyzja architektoniczna).
3. A/H1.10 oś-T Teresy → 🟠 (jedyny E2E = test.skip) · H2.15/H2.17 → ❓ · H6.11 → ⬜
   (STAGE-BLOCKER) · Excel/Sheet → 🟡 (split-brain, hardened niezmergowany).
4. C: wszystkie „ODBIÓR delegowany" → 🟠 · „19 Q-banków" → „15" · O4.2-4.6 → 🟡 (API bez UI).
5. D: 22 pozycje z 30✅ cofnąć wg itemized ledger; 7 SPEC-A → 🟠; skasować STALE wpis
   „check-artefakt.sh nie istnieje" (istnieje — rejestr tu akurat ZANIŻA).
6. E: #77, presence-write, M24, M27, T5, cała T-series, wave7-label, K4/K5-wiring → ⬜/🟡
   zgodnie z własną tabelą szczegółową.
7. **Adnotacja procesowa w nagłówku rejestru:** „Delegacja akceptu NIE zamienia 🟡→✅.
   ✅ wymaga dowodu (test-run/zrzut/odbiór). Zmiana licznika bez commita kodu/testu = zakazana."

Po korekcie licznik będzie mówił to samo, co tabele — i każdy kolejny ✅ będzie wart tyle,
ile mówi. To jest warunek, żeby „100%" za dwa tygodnie znaczyło 100%.
