# 🟢 KONTYNUACJA — punkt wejścia po przerzucie środowiska
**Ostatnia aktualizacja:** 2026-06-17 | **Branch:** `Londyn` | **Repo:** PiotrWisniewskiDBR77/consultify

> **To jest aktualny punkt wejścia.** Plik `_HANDOFF.md` w tym katalogu jest PRZESTARZAŁY (opisuje tryb 1-agentowy „nikt nie pracuje równolegle") — zignoruj go. Aktualny model pracy = 5 równoległych agentów, opisany niżej.
>
> **Jak użyć:** Piotr wkleja w nowym środowisku prompt z sekcji §8. Nowy Claude czyta TEN plik + `AGENT_MAP.md` i kontynuuje jako koordynator. W nowym środowisku robimy **audyt na nowo** (§9) — ten dokument daje metodę + aktualny stan, żeby audyt zaczął z pełnym kontekstem, nie od zera.

---

## §1 · CZYM JEST PROJEKT

**Consultify** — platforma SaaS do konsultingu AI (HBS-style), 27 modułów produktowych. Stack: React/TypeScript (Vite) + Node/Express + PostgreSQL. i18n: PL/EN/DE/ES/JP/AR.

**Topologia środowisk (KRYTYCZNE):**
- **PROD = Railway „centerbeam"** — klienci żywi (Apator, Elkomtech, VTS). Konfiguracja w `.env.local`. **`.env.local` NADPISUJE shell `DATABASE_URL`** — dev backend domyślnie trafia na PROD DB, jeśli nie uważasz.
- **STAGING = Railway „caboose”** (czasem „trolley” w starszych notatkach). Tu testujemy.
- **Zasada twarda:** żadnych zmian na prod (centerbeam) bez jawnej, osobnej zgody Piotra. Staging najpierw. Nigdy deploy kodu na prod bez osobnej zgody.

**Role:**
- **Piotr** = produkt + strategia (wymyśla i testuje funkcje, decyzje produktowe/biznesowe). Komunikacja po polsku. Preferuje UX w stylu Miro/Linear/Apple.
- **Claude** = CTO. Robi CAŁĄ inżynierię, własność decyzji technicznych/infra/deploy. Koordynuje agentów.

---

## §2 · JAK DZIAŁAMY — model 5 agentów Harvard

Program domykania do 100% prowadzimy **5 równoległymi sesjami Claude** (Harvard 1–5), każda na tym samym branchu `Londyn`, każda w swojej strefie plików (anty-kolizja). Koordynator (ta sesja) przydziela pracę, zbiera statusy, robi raporty, pilnuje gita.

**Podział na klastry (SSOT: `AGENT_MAP.md`):**
| Agent | Klaster | Moduły |
|-------|---------|--------|
| Harvard 1 | Core Chat & Canvas | M01, M02 |
| Harvard 2 | Ideas Suite | M03, M05, M06, M07, M08 |
| Harvard 3 | Research Chain | M10, M12, M13 |
| Harvard 4 | Execution Wrap-up | M04, M14, M15, M16 |
| Harvard 5 | Platform & Outputs | M17, M18, M19, M20, M21 |

**Każdy agent wewnątrz swojej sesji robi fan-out na 5 sub-agentów** (Agent tool) — po jednej luce/module na sub-agenta; sub-agent naprawia kod + pisze test + zwraca diff; sesja-lider scala i **commituje SEKWENCYJNIE** (jeden plik = jeden commit na raz, żeby nie było wyścigu na pliku jak `table-platform.routes.ts`).

**SSOT teczki:** `Harvard/wdrozenie-100/MXX-*.md` — jedna teczka per moduł. Sekcja **§03 Rejestr luk** to lista zadań (L-xx) per moduł. Status luki w tabeli:
- `OTWARTA` — do zrobienia
- `ZAMKNIĘTA <data> <SHA>` — naprawione + test
- `NAPRAWIONA` — kod gotowy, czeka weryfikacji (R3)
- `FALSE POSITIVE` / `NIEAKTUALNA` / `N/D` — luka nierealny problem (z uzasadnieniem)
- `ODROCZONA-Faza4` — i18n, świadomie odłożone (decyzja Piotra)
- `ŚLEDZONA-SPEC_01` — kręgosłup czat→deliverable, epik programowy
- `PODGLĄD-DP6` — funkcja w trybie preview, realny odbiór = backlog v1.1

**Definicja DONE per luka:** kod działa → test (unit/integration) → `tsc --noEmit` bez nowych błędów → teczka zaktualizowana (data+SHA) → commit `fix(MXX/L-xx): …`.

---

## §3 · PROTOKÓŁ GIT (twardy)

- **NIGDY `git add -A`** — absorbuje pracę innych agentów. Zawsze `git add <konkretne-pliki>`.
- `git fetch origin Londyn` PRZED każdym commitem; sprawdź `git status`.
- Nowe pliki testów w `/tests/` są w `.gitignore` → wymagają `git add -f`. Pliki w `server/src/**/__tests__/` trackowane normalnie.
- **UWAGA CI:** workflow odpala TYLKO `tests/unit|integration|components` (jawne ścieżki nadpisują vitest include). Testy pod `src/**/__tests__/` **NIGDY nie trafiają do CI** → luka-testy kładź w `tests/`.
- Co-author w commitach: `Co-Authored-By: Claude …`.
- Commit/push tylko gdy Piotr poprosi (lub w ramach uzgodnionego flow). Push to akcja na zewnątrz — wykonuj świadomie.

**Strefy plików (czego agent NIE rusza):**
- `public/locales/*` — **ZAKAZANE dla wszystkich agentów Fali 1** (kolizja z agentem landingu). i18n = Faza 4.
- `server/src/middleware/` — wspólny auth, nie ruszać.
- `.env*`, `railway*` — nie ruszać.
- Sekrety (API keys, hasła) — **agent nigdy nie wpisuje**; Piotr ustawia osobiście w Railway.

---

## §4 · GDZIE CO LEŻY

```
Harvard/wdrozenie-100/
  _KONTYNUACJA.md        ← TEN plik (punkt wejścia)
  AGENT_MAP.md           ← podział modułów + strefy + fale
  HARVARD_1..5_BRIEF.md  ← brief per agent (scope, ścieżki, DoD)
  _DECYZJE_RUNDA3.md     ← 8 decyzji D-01/D-02, PODPISANE 2026-06-17
  MASTER.md              ← kolejność modułów, zależności programowe
  MXX-*.md               ← 27 teczek (rejestr luk §03 per moduł)
  _HANDOFF.md            ← PRZESTARZAŁY, ignoruj

docs/standards/          ← formuły (CARD_CONTENT_FORMULA, INITIATIVE_FORMULA)
docs/ui-standards/CANON.md ← jedyny kanon UI/UX
docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md ← §27 audyt tabel
```

---

## §5 · STAN NA 2026-06-17

**Fala 1: 160 / 187 luk zamkniętych = 86% surowo, ~91% funkcjonalnie** (i18n+SPEC_01 jako odroczony backlog, nie dług).

| Moduł | Stan | | Moduł | Stan |
|-------|------|-|-------|------|
| M01 Czat | 8/10 (80%) | | M13 Inicjatywy | 12/14 (86%) |
| M02 Canvas | 14/15 (93%) | | M14 Wdrożenie | **9/9 (100%)** |
| M03 Moja Praca | **11/11 (100%)** | | M15 Rezultaty | 11/12 (92%) |
| M04 Notatnik | 8/11 (73%) | | M16 Finanse | **7/7 (100%)** |
| M05 Ideas zarz. | 7/8 (88%) | | M17 Outputs | 6/12 (50%) |
| M06 Mind Map | **7/7 (100%)** | | M18 Dokumenty | 9/12 (75%) |
| M07 Process Flow | **6/6 (100%)** | | M19 Prezentacje | 7/9 (78%) |
| M08 Ideas Table | **5/5 (100%)** | | M20 Tabele Studio | 8/11 (73%) |
| M09 Whiteboard | 0/6 (Fala 2, blok) | | M21 Meeting | 8/9 (89%) |
| M10 Wywiad | 8/9 (89%) | | | |
| M12 Audyty | 9/10 (90%) | | | |

> Liczby liczone grepem rejestrów §03. Runda 4 (decyzje podpisane → implementacja M04/M17/M18 + flipy i18n/SPEC) była w toku przy przerzucie — część jej commitów może nie być jeszcze policzona. **W nowym środowisku przelicz na nowo** (komenda w §9).

---

## §6 · CO ZOSTAŁO (backlog domknięcia)

1. **i18n → Faza 4 (8 luk):** M01 L-10, M04 L-11, M13 L-11a, M17 L-09, M18 L-09, M19 L-05, M20 L-09, M21 L-06. Wymagają edycji `public/locales/*` (teraz zakazane). Decyzja Piotra: robimy po przełączeniu środowiska, prawdopodobnie 1 dedykowany agent-owner i18n (serializacja locales).
2. **SPEC_01 kręgosłup (4 luki):** M17 L-10, M18 L-11, M19 L-08, M20 L-04 — czat→deliverable (auto-generacja artefaktu z czatu). Epik programowy, śledzony w `SPEC_ZADANIE_01`. Poza Falą 1.
3. **Decyzje PODPISANE → implementacja** (`_DECYZJE_RUNDA3.md`): M04 L-02 (DP-2 lekki rail), M04 L-03 (odchudź Canonical Path), M13 L-07 (DP-2 IDE-tabs → strefa H2), M17 L-01 (server guard 403), M18 L-04 (LLM w Mode3), M14/M15/M20 L-05 (DP-6 preview). Agenci to wykonują w Rundzie 4.
4. **M10 STT — AKTYWNE NA PIOTRZE:** głos w wywiadzie nie zapisuje odpowiedzi. FE-fix zacommitowany (`1522f3de32`). Server STT wymaga `OPENAI_API_KEY` na Railway centerbeam (prod) — **Piotr dał zgodę na prod, ustawia klucz osobiście**. Harvard 3 przygotowuje instrukcję krok-po-kroku. Po ustawieniu: test E2E zapisu głosu → flip L-01 → M10 100%.
5. **M09 Whiteboard — Fala 2, ZABLOKOWANY:** P0 architektoniczny (personal whiteboard per-user doc). Czeka na decyzję Piotra czy wchodzi do v1.
6. **Fala 2 (po Fali 1):** M22 AI OS, M23 Organizacja, M24 Admin, M25 Ustawienia, M26 Portal Partnerski, M27 SuperAdmin, A1 Ecosystem (~52 luki).

---

## §7 · ZASADY TWARDE (nie łamać)

- **Prod (centerbeam) tylko za jawną, osobną zgodą.** Staging najpierw.
- **`.env.local` nadpisuje `DATABASE_URL`** → dev backend może uderzyć w PROD DB. Weryfikuj `curl localhost:3001/api/health` przed mutacjami.
- **Weryfikuj zanim ogłosisz „done”:** każda zmiana UI → otwórz w preview, sprawdź wizualnie + logicznie, dowód = screenshot. NIGDY „done” na samym `tsc`/`eslint`.
- **Raportuj wiernie:** testy padły → powiedz to z outputem; krok pominięty → powiedz; done + zweryfikowane → mów wprost bez asekuracji.
- **Sekrety:** agent nie wpisuje kluczy/haseł — Piotr robi to sam w Railway/UI.
- **Raporty gap/audyt zawyżają** (~1 na 7 „otwartych luk” to już naprawione lub false positive) — weryfikuj w żywym kodzie zanim coś budujesz.
- **`git add -A` zakazane**; `public/locales/*` zakazane w Fali 1.

---

## §8 · GOTOWY PROMPT — wklej w nowym środowisku

```
Cześć. Przejmujesz rolę koordynatora CTO programu domykania Consultify do 100%.

NAJPIERW przeczytaj, w tej kolejności:
1. Harvard/wdrozenie-100/_KONTYNUACJA.md  (punkt wejścia — metoda, stan, zasady)
2. Harvard/wdrozenie-100/AGENT_MAP.md      (podział modułów + strefy)
3. Harvard/wdrozenie-100/_DECYZJE_RUNDA3.md (8 podpisanych decyzji)

Ignoruj _HANDOFF.md (przestarzały, tryb 1-agentowy).

Jesteśmy na branchu Londyn. Model pracy = 5 równoległych agentów Harvard (Harvard 1-5),
ja prowadzę je w osobnych czatach, ty koordynujesz: przydzielasz pracę, zbierasz statusy,
robisz raporty (tabela modułów jak w _KONTYNUACJA §5), pilnujesz gita (NIGDY git add -A).

Stan przed przerzutem: Fala 1 ~86% surowo / ~91% funkcjonalnie. Cel: ≥90%, najlepiej 100%.

PIERWSZE ZADANIE: zrób audyt stanu na nowo — przelicz teczki (komenda w _KONTYNUACJA §9),
sprawdź git log od ostatnich commitów agentów, i daj mi świeży raport statusu wszystkich
modułów (tabela: nr / tytuł / luki zamknięte/total / % / co blokuje). Potem zaproponuj
kolejną serię 5 promptów dla Harvard 1-5 z fan-outem na sub-agenty.

Aktywne na mnie: M10 STT (mam ustawić OPENAI_API_KEY na Railway — przypomnij mi instrukcję).
```

---

## §9 · AUDYT NA NOWO (komendy startowe dla nowego Clauda)

```bash
# 1. Stan gita
cd <repo>; git fetch origin Londyn; git rev-list --left-right --count origin/Londyn...HEAD
git log --oneline -30 | grep -iE "fix\(M|feat\(M|docs\(M"

# 2. Przeliczenie luk per moduł (closed/total)
cd Harvard/wdrozenie-100
for f in M01 M02 M03 M04 M05 M06 M07 M08 M09 M10 M12 M13 M14 M15 M16 M17 M18 M19 M20 M21; do
  file=$(ls ${f}-*.md 2>/dev/null | head -1); [ -z "$file" ] && continue
  total=$(grep -cE "^\| L-[0-9]" "$file")
  closed=$(grep -E "^\| L-[0-9]" "$file" | grep -ciE "ZAMKNIĘTA|NAPRAWIONA|FALSE.?POSITIV|fałszyw|odroczona|ODROCZONA|NIEAKTUALNA|N/D")
  echo "$f: $closed/$total"
done

# 3. Otwarte luki konkretnego modułu (np. M17)
grep -E "^\| L-[0-9]" M17-*.md | grep -viE "ZAMKNIĘTA|NAPRAWIONA|FALSE.?POSITIV|odroczona|ODROCZONA|NIEAKTUALNA|N/D"
```

Audyt „na nowo” = nie ufaj statusom w ciemno: dla każdego modułu <100% otwórz teczkę §03, zweryfikuj otwarte luki w ŻYWYM kodzie (gap-reports zawyżają), dopiero potem przydzielaj. Metoda audytu per-moduł: `Harvard/protokol/MODULE_AUDIT_PROTOCOL_V1.md` (8-fazowy protokół /100).
```
