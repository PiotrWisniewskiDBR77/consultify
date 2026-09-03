---
doc_id: program-przekazanie-20260904
status: canonical
data: 2026-09-03 (wieczór) → dla sesji 2026-09-04
---

# Przekazanie — 3 września 2026, wieczór

Linia pracy: **`github-backup/grafika/m03-20260902`**, katalog `/private/tmp/m03`.
Tip po ostatnim scaleniu kodu: **`fee24bddb0`** (na nim biegnie trzeci pełny pomiar G06).
Wszystko wypchnięte na kopię zapasową po każdym scaleniu.

## 1. Gdzie jesteśmy — trzy zdania

**256 z 336 bramek** (rano 240). **G06 zamknięte 16/16** na markerze `fee24bddb0` (pomiar #3:
258 ekranów × 8 kadrów = 2064, zero realnych naruszeń a11y, PL≠EN, pary jasny/ciemny poprawne;
wiersze zapisane commitem `02c339c5f1`). G14 i G16 mają wpisy dla wszystkich 16 modułów ze śladem, ale nie mogą paść bez
właściciela: G14 czeka na jego decyzje o pozycjach DUŻYCH, G16 na jego przelot po stagingu.

## 2. ★★★ Trzy rzeczy, które zmieniły obraz programu

1. **Przekazanie z rana było zepsute.** Merge `d5e5db8b22` zostawił znaczniki konfliktu
   w `PreviewAIHintStrip.tsx`; komponent importuje `StandardPreview` i 19 innych — każdy ekran
   z podglądem nie kompilował się, a „tip = kopia zapasowa" niósł ten błąd. Naprawa `199e841582`.
   Reguła: po każdym scaleniu z konfliktem `git grep -nE "^(<<<<<<< |>>>>>>> )" HEAD -- src server dev-render`
   plus `esbuild` plików z konfliktu, zanim padnie słowo „scalone".
2. **Odbiór grafiki stał na przyrządzie, nie na produkcie — w Inicjatywach dosłownie.** Od 13.08
   każda realna inicjatywa otwierała nieodebrany `CanonicalInitiativeCardWorkspace`; zatwierdzony
   `InitiativeDocumentView` dostawały tylko id pokazowe `init-showcase-*`. Właściciel zobaczył to na
   stagingu i zdecydował (`DEC-2026-09-03-346`): przywrócić zatwierdzony rekord, skasować obcy
   komponent „aby nigdy nie wrócił". Wykonane (`aed131a2ab` + bezpiecznik
   `tests/unit/initiatives/initiativeRecordCanon.test.ts`). Audyt przewodów dla 248 ekranów
   (`AUDYT_PRZEWODOW_ODBIORU_20260903.md`): 218 zgodnych, 6 rozjazdów (wszystkie naprawione),
   2 repliki (naprawione), 22 warunkowe (flagi OFF — decyzja właściciela).
   **Nowa reguła odbioru: ekran-rekord odbiera się przez otwarcie REALNEGO rekordu z listy.**
3. **Przyrząd kłamał dwa razy nowymi sposobami** (`przyrzad-zamyka-podglad-przed-skanem` w pamięci):
   rozwijanie sekcji zamykało podgląd przed skanem (ślepa plama na każdym ekranie listowym —
   pierwszy „pomiar finalny" 15 modułów był przez to zbyt optymistyczny), a skan 150 ms po kliknięciu
   trafiał w fade-in (fałszywy kontrast). Naprawy: `--klik-po-rozwinieciu=1`, `--osiad-po-rozwinieciu=1500`
   (opt-in, orkiestracja przekazuje oba). Po naprawie przyrządu wyszły 24 ekrany z kontrastem w podglądzie
   — naprawione jedną regułą CSS (`--c-text-muted-table`, `--c-danger-table`, `fee24bddb0`).

## 3. Trzynaście scaleń dnia (kolejność)

| Co | Gałąź / commit | Skutek |
| --- | --- | --- |
| Znaczniki konfliktu | `199e841582` | warstwa podglądów kompiluje się |
| Schemat P0 | `agent/schemat-datetime` → `6c7d74d9e5` | `ai_user_tiers`, `help_categories` z migracji; korekta: tylko `.exec()` omija tłumaczenie `DATETIME` |
| Dostępność 13–16, reszta 01–04/10–12, 05–08, 07 | 4 gałęzie `agent/fix-a11y-*` | 16 modułów do zera (pl-1440 + en-1024) |
| Język PL/EN | `agent/i18n-pl-en`, `agent/i18n-reszta` | 39 ekranów; zakładki Realizacji przybite po polsku w produkcie |
| Inicjatywy | `fix/inicjatywy-zatwierdzony-rekord` | DEC-346 |
| Przewody harnessu | `agent/przewody-harness` | 5 ekranów na realny produkt; kolumna Status w Raportach Oceny była PUSTA dla użytkownika |
| Martwe komponenty | `agent/martwe-komponenty` | `InitiativesTable`, `ReportsTable`, `AuditsHub` + 90 kluczy i18n; bezpiecznik |
| Audyt przewodów | `agent/audyt-przewodow` | tabela 248 ekranów |
| G14 × 4 | `agent/g14-{01-04,05-08,09-12,13-16}` | ślady `evidence/g14/*.md`; 3 znaleziska analizy obalone pomiarem (INT-3, MW-1, 10-1) |
| Kontrast w podglądzie | `agent/podglad-kontrast` | 37 węzłów / 24 ekrany → 0 |

Narzędzia w repo: `scripts/dev/g06-macierz-{uruchom,agreguj,rejestr}.mjs`, `g06-macierz-ekrany.json`,
`g06-macierz-wyjatki.json`, `g14-g16-rejestr.mjs`. Dowody: `evidence/grafika/g06-macierz-*/`,
`evidence/grafika/a11y-fix-*.md`, `i18n-pl-en-20260903.md`, `przewody-odbioru-20260903.md`, `evidence/g14/`.

## 4. Czeka na właściciela (rano 04.09)

1. **`docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md`** — flagi 21 ekranów (rekomendacja ON),
   7 przebudów (teraz/odłożone), crimson jako projekt, 3 pytania zamykane rozmową. Po decyzjach:
   numery DEC do rejestru, G14 → PASS per moduł.
2. **Słowo „wdrażaj"** — push na `develop` = automatyczny deploy stagingu → jego przelot po realnych
   danych (to jest prawdziwy odbiór; G16, potem G19/G20).
3. **Wklejki Codexa 286 (G15) i 287 (fokus `c-focus`)** — wydane, w `codex/INSTRUKCJA_DYZUR_28{6,7}.wklejka.txt`.

## 5. Otwarte ryzyka

- ★ **Na tej samej linii pracowała równolegle druga sesja** (commity 18:38–18:54 03.09: inwentarz G19, blokery G20, ratunek dowodów z worktree, instrukcje Codexa 288/289, kolizja numeracji kolejki). Jej commity są docs/evidence, `src/` bez zmian od `fee24bddb0` (sprawdzone), więc pomiar #3 pozostaje ważny. Przed każdym pomiarem i scaleniem sprawdzaj `git log` — kto jeszcze commituje do m03.
- ★ Po zakończeniu pomiaru #3 (ostatni strumień  UTC) druga sesja scaliła `agent/i18n-r3` ( CEST, zmiany w `src/components/Initiatives/CapacityScenarioSurface.tsx` i `PlanScenarioSurface.tsx`) — **HEAD ≠ marker pomiaru** (`fee24bddb0`). G06 dla 05_INITIATIVES stoi na markerze; przy G19 dołóż pomiar różnicowy `capacity-advisor-a3`, `plan-scenario-d1`.

- 9 czerwieni ZASTANYCH w testach jednostkowych (`chatActionHandler.createInitiative` 3,
  `executionWorkResources` 6) + `AssessmentLibraryTab.day178` — do dyżuru 286.
- `help_articles`/`help_events` mają migrację w innym kształcie niż kod tras (`column "category_id" does not exist`, cicho łapane).
- Trasy `/api/v8/finance/*` bez bramki modułu: równoległa sesja zmierzyła **270** (nie 34) → dyżur Codexa 288; `WatchingTab` to martwy komponent (nierenderowany), nie martwa trasa → dyżur 289.
- MW-5 `escalation`: zapis w bazie udowodniony migracją, test odczytu na zimno nie przeszedł z powodu
  harnessu (kształt „dwa dostępy, jedna baza").
- Opus 5 dawał dziś 529/stall trzykrotnie — robotnicy na Sonnet; zakaz `pkill` w każdym zleceniu.

## 6. Pierwsze kroki dla następnego

1. Odczytać wynik pomiaru #3 (`/private/tmp/g06-final3-20260903-artefakty`, marker `fee24bddb0`):
   `node scripts/dev/g06-macierz-agreguj.mjs --wejscie=… --md=… --json=…`, skopiować manifesty do
   `evidence/grafika/g06-macierz-final-20260903/` (nadpisać), `node scripts/dev/g06-macierz-rejestr.mjs --marker=fee24bddb0 …`.
2. Decyzje właściciela → DEC → `g14-g16-rejestr.mjs` albo ręcznie PASS per moduł.
3. Po „wdrażaj": `consultify-promocja-demo`, fast-forward `develop`, obserwować `gitSha` z `/api/health`.
4. Sprzątać worktree po każdym scaleniu (dziś 41 pozostało w `git worktree list`, większość to
   stare `cx-day2xx`; agentowe usunięte).
