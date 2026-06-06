# Procedura naprawy moduł-po-module (kontrakt operacyjny)

**Ustalono:** 2026-06-04 (Piotr + Claude). **Obowiązuje** do zakończenia przejścia 01→19.

## 0. Zasada nadrzędna
Jedziemy **moduł po module, od 01 Czat do 19 Partner**. Każdy moduł domykamy do końca w **obu obszarach naraz**:
> **Funkcjonalność do 100% + Grafika (UI) do 100% — bez komentarzy, bez „prawie", bez cichych odroczeń.**
Dopiero gdy moduł jest 100/100, przechodzimy do następnego. Nie otwieramy kolejnego, zostawiając ogony.

## 1. Dwa plany prawdy (aktualizowane na bieżąco)
- **Funkcjonalny:** `docs/audit/2026-06-03/deep/_REMEDIATION_BACKLOG_BY_POSITION.md` — pozycje `FIX-NNN`.
- **UI:** `docs/audit/2026-06-04/UI_STANDARD_TRACKER.md` (+ `MODULE_BY_MODULE_REPORT.md`, `MODULE_REPORT_PART_1..4.md`) — wiersze per moduł.

## 2. Mapowanie funkcjonalny ↔ UI (numeracje się różnią — to wiążące mapowanie)
| Func # | Moduł funkcjonalny | Wiersz(e) w UI trackerze |
|---|---|---|
| 01 | Czat | UI 1 Czat/Teresa |
| 02 | Moja Praca | UI 2 My Work + UI 4 Decyzje (8 tabów: Home/Radar, Ideas+4 narzędzia, Notebook, Inbox, Calendar, Tasks, Decisions, Manager — dekompozycja w `_MODULE_02_MYWORK_DECOMPOSITION.md`). **Assessment NIE należy do My Work** (jest pod Tools→moduł 04) |
| 03 | Wywiad | UI 3 Wywiad |
| 04 | Narzędzia | UI 6 Narzędzia + UI 5 Assessment (Assessment jest pod Tools menu) |
| 05 | Inicjatywy | UI 7 Inicjatywy |
| 06 | Realizacja | UI 8 Realizacja |
| 07 | Rezultaty | UI 9 Rezultaty |
| 08 | Finanse | UI 10 Finanse |
| 09 | Outputs | UI 12 Outputs/Reports |
| 10 | Dokumenty | UI 17 Document Studio |
| 11 | Tabele | UI 18 Table Studio |
| 12 | Prezentacje | UI 16 Prezentacje |
| 13 | Meeting | UI 11 Spotkania |
| 16 | Organizacja | UI 13 Organizacja |
| 17 | Admin | UI 14 Admin |
| 18 | Ustawienia | UI 15 Ustawienia |
| 19 | Partner | UI 19 Partner + UI 20 Landing |
| — | (SuperAdmin) | osobny przebieg po 19 (opcjonalnie) |

**Poza zakresem tego przejścia:** Moduły **14 MCP / 15 Marketplace** — odroczone per D7 (hidden, post-v1). Nie ruszamy.

## 3. Pętla per moduł (kroki — każdy kończy się commitem)

**KROK 0 — Otwarcie modułu.** Ogłaszam zakres: lista pozycji `FIX-NNN` (funkcjonalne) + wiersz UI z konkretami (file:line). Ustawiam status obu na 🔵 IN-PROGRESS.

**KROK 1..N — Funkcjonalność.** Każda pozycja `FIX-NNN` osobno:
- edycja → **gate** → **commit** (jeden commit = jedna spójna pozycja).
- Pozycje wcześniej oznaczone ⏸️ (ryzykowne) **robimy teraz** — bo jesteś obecny do weryfikacji. Jedyny wyjątek: realna zależność zewnętrzna (usługa 3rd-party, brak klucza API, decyzja biznesowa) → oznaczam `�stop BLOCKED-EXTERNAL`, pytam Ciebie, NIE pomijam po cichu.

**KROK N+1..M — UI.** Każdy dług UI osobno (lub spójną paczką jednego typu):
- indigo/violet/fuchsia/purple → `primary`/crimson; hex → token; raw `<select>` → `SelectField`; raw `fixed inset-0` → `Modal`/`Drawer`; raw `<table>` → `FilterableTable`/`DataTable`; hand-rolled toggle → `Switch`; Empty-on-failure → `ErrorState` z retry.
- edycja → **gate** → **commit**.

**KROK Z-2 — Weryfikacja DoD modułu.** `npm run build` zielony + (gdy sensowne) szybki smoke modułu. Potwierdzam funkcjonalne P0/P1 = zrobione i UI = spełnia 5-punktowy DoD trackera.

**KROK Z-1 — Aktualizacja obu planów.** FIX-NNN → ✅; wiersz UI → 🟢/✅. Commit `docs(status): module NN closed`.

**KROK Z — Raport zamknięcia.** Jeden akapit: co zrobione (funkcjonalne + UI), build/test green, ewentualne `BLOCKED-EXTERNAL` do Twojej decyzji. Dopiero teraz następny moduł.

## 4. Gating (twardy, przy każdym commicie)
- **Frontend:** `npx tsc --noEmit` = 0 **MUSI** (cały projekt) + `eslint --quiet` = 0 na zmienionych plikach.
- **Server:** `esbuild` syntax-check zmienionych plików (zachowany `tsc --noCheck` — 4543 pre-existing errorów, NIE ruszamy).
- **Zamknięcie modułu:** `npm run build` zielony.
- Czerwony gate = nie commituję, naprawiam.

## 5. Konwencja commitów (granularne, jeden krok = jeden commit)
- `fix(<moduł>): <pozycja FIX-NNN> — <opis>` (funkcjonalne)
- `style(<moduł>): <dług UI> — <opis>` (UI)
- `docs(status): module NN — <co domknięte>` (aktualizacja planów)
- Stopka: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Branch: `feat/wave1-foundations` (bieżący; nie default `Londyn`).

## 6. Definicja DONE modułu (bar 100/100, bez komentarzy)
Moduł jest domknięty gdy **łącznie**:
1. **Funkcjonalność:** wszystkie `FIX-NNN` tego modułu = ✅ (lub jawne `BLOCKED-EXTERNAL` zaakceptowane przez Ciebie). Zero ⏳, zero ⏸️.
2. **UI:** wiersz trackera = 🟢 PASS lub ✅ DONE — spełnia 5 punktów DoD:
   - Shell/Menu zgodny (lub świadomy wyjątek studio/wizard/marketing),
   - Komponenty kanoniczne (chip/state/modal/table/form/rowactions),
   - Kolory: zero off-brand (indigo/violet/fuchsia/purple jako accent), zero hardcoded hex poza tokenami, akcent = crimson „lekko",
   - Light + Dark: kontrast OK (body ≥ slate-600 light / ≥ slate-400 dark),
   - Empty ≠ Error (awaria → ErrorState z retry).
3. **Gate:** `npm run build` zielony.
4. **Oba plany zaktualizowane** i zacommitowane.

## 7. Zasady pracy
- **Nie pomijam ryzykownych** — robimy je teraz, z weryfikacją; tylko realna zależność zewnętrzna blokuje (i to jawnie).
- **Nie rozszerzam zakresu** poza bieżący moder (znaleziska z innych modułów → dopisuję pozycję do backlogu, nie naprawiam od razu).
- **Pytam tylko gdy** to decyzja produktowa/biznesowa Twoja (np. czy włączyć płatny provider, polityka governance), nie gdy mogę rozstrzygnąć z kodu/standardu.
- **Commit po każdym kroku** (ustalone) — odporność na Drive sync i czytelna historia.

## 8. Legenda statusów
- Funkcjonalny: ✅ done · ⏳ open · ⏸️ deferred (znika w tym przejściu — dążymy do ✅) · 🔌 BLOCKED-EXTERNAL.
- UI: ✅ DONE · 🟢 PASS · 🟡 MINOR · 🔴 NEEDS-WORK · 🔵 IN-PROGRESS.

---

## Log postępu (uzupełniany przy zamknięciu każdego modułu)
| Func # | Moduł | Func status | UI status | Data | Commit zamknięcia |
|---|---|---|---|---|---|
| 01 | Czat | ✅ 100% (FIX-001/002/004 done, 003 not-a-bug) | 🟢 PASS (indigo+hex+modals) | 2026-06-04 | (multi: 9a2953d949…875550398e) |
| 02 | Moja Praca | — | — | — | — |
| 03 | Wywiad | — | — | — | — |
| 04 | Narzędzia | — | — | — | — |
| 05 | Inicjatywy | — | — | — | — |
| 06 | Realizacja | — | — | — | — |
| 07 | Rezultaty | — | — | — | — |
| 08 | Finanse | — | — | — | — |
| 09 | Outputs | — | — | — | — |
| 10 | Dokumenty | — | — | — | — |
| 11 | Tabele | — | — | — | — |
| 12 | Prezentacje | — | — | — | — |
| 13 | Meeting | — | — | — | — |
| 16 | Organizacja | — | — | — | — |
| 17 | Admin | — | — | — | — |
| 18 | Ustawienia | — | — | — | — |
| 19 | Partner (+Landing) | — | — | — | — |
