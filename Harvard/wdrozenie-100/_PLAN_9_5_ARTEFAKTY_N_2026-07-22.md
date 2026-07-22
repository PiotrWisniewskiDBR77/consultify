# PLAN 9,5 — artefakty N (rejestr zadań i rozliczenie)

> **SSOT planu domknięcia 7 artefaktów N** (Decision · Task · Interview · Notification · Insight · Tool · Initiative).
> Start: **6,8/10** (audyt 2026-07-22, flota 7 audytorów, realny runtime) → meta: **9,5/10**.
> Lustro wizualne (matryca + plan): artifact `https://claude.ai/code/artifact/4d9ae7a6-5252-4be7-8341-ff52d0dbda8d`
> Baza pomiaru: demo `30b914ce` (kontrakt karty za flagą opt-in `?cardContract=1`).
> **Aktualizuj ten plik po KAŻDYM odbiorze zadania** (status + SHA + data). Protokół na dole.

## Stan osi (audyt 2026-07-22)

| Oś | Dziś | Cel | Faza domykająca |
|---|---:|---:|---|
| Menu | 7,6 | ≥9,5 | F1 |
| Nawigacja | 7,4 | ≥9,5 | F1 + F4 (flaga domyślna) |
| Funkcja | 7,6 | ≥9,5 | F3 |
| Merytoryka | 6,6 | ≥9,5 | F0 + F2 |
| Grafika | **4,6** | ≥9,5 | F4 |

Prognoza kamieni: 6,8 → **≈7,5** (po F0+F1) → **≈8,0** (po F2) → **≈8,4** (po F3) → **9,5** (po F4).
Rozjazd prognoza↔pomiar >0,3 = korekta planu, nie naciąganie ocen.

## Rejestr zadań

Statusy: `⬜ do zrobienia` · `🔷 decyzja Piotra` · `🟡 w toku` · `✅ zrobione (odbiór wzrokiem)` · `🏁 odebrane (akcept Piotra / bramka)`

### Faza 0 — Decyzje właściciela (zero kodu; odblokowuje F2 i F3)

| ID | Zadanie | Kody | Status | SHA/data |
|---|---|---|---|---|
| Z-0.1 | **Progi treści kart** per typ (minima pól; bramka czy porada). Dziś wszędzie `do-decyzji-piotra`. | R1 | 🔷 | — |
| Z-0.2 | **Insight: dedup 11 sekcji Phase-D** (2 dublują rdzeń: executive-memo↔executive-summary, recommendations↔artifact-actions). | R2 | 🔷 | — |
| Z-0.3 | **Kierunek 3 rozjazdów kontrakt↔runtime**: Task governance (kod brak AI vs kontrakt asystuje), Task dependencies (kanon dane vs Task pisze), Initiative RACI. | F2 | 🔷 | — |

### Faza 1 — Wspólna powłoka (~tydzień; cel Menu 9,5 · Nawigacja 9,0)

| ID | Zadanie | Kody | Status | SHA/data |
|---|---|---|---|---|
| Z-1.1 | **Ikona-typu artefaktu w NModeHeader** — nowy slot + mapowanie 7 typów (`NModeHeader.tsx` nie ma propa `icon`). | M1 | ⬜ | — |
| Z-1.2 | **Powiązania klikalne w ArtifactRightPanel** — pozycje nawigują (wzór: baner „Pokaż źródło" w Task). Decision/Task/Interview/Initiative. | N2 | ⬜ | — |
| Z-1.3 | **Sekcje panelu: kanon albo jawna redukcja** — Interview (brak Akcje/Komentarze), Notification (2/5) → uzupełnić lub `PominietaSekcjaPanelu.reason`. | N1 | ⬜ | — |

### Faza 2 — Treść (2–3 tyg; po F0; cel Merytoryka 9,5)

| ID | Zadanie | Kody | Status | SHA/data |
|---|---|---|---|---|
| Z-2.1 | **Fix i18n Notification** — checklist „Oczekiwana akcja" po ANG mimo PL (`generateActionChecklist` zamraża `t()` w stanie; wyścig ładowania paczki). | R3 | ⬜ | — |
| Z-2.2 | **Prompty doktrynalne BCG dla kart bez doktryny** — Task governance/implementation/risk, Decision RACI/reminders (goły „PMO assistant"), Notification. Wg progów Z-0.1. ⚠ prompty = treść → akcept Piotra PRZED live. | R1 | ⬜ | — |
| Z-2.3 | **Wyrównanie katalogu treści** — Tool: 4 płytkie warianty (market-forces, growth-paths, portfolio-priority, risk-uncertainty) do głębi dynamic-swot; Insight: wdrożenie dedupu Z-0.2. | R2 | ⬜ | — |

### Faza 3 — Mechanika (2–3 tyg; po F0; cel Funkcja 9,5)

| ID | Zadanie | Kody | Status | SHA/data |
|---|---|---|---|---|
| Z-3.1 | **Initiative: generatory dla 13/27 kart no-op** — RACI, dziennik zmian, obsada strumieni, sugerowane zmiany: z toastu-atrapy do realnego generatora + zapisu (`SECTION_AI_CONTRACT`, `InitiativeDocumentView.tsx:300-382`). | F1 | ⬜ | — |
| Z-3.2 | **Wyrównanie kodu z kontraktem** po Z-0.3 (Task governance/dependencies, Initiative RACI). | F2 | ⬜ | — |
| Z-3.3 | **Guard niezapisanych zmian** — jawny dialog vs dzisiejszy cichy autosave 900 ms. Najpierw decyzja czy w ogóle. | F3 | 🔷 | — |

### Faza 4 — Kolor (1–2 tyg; cel Grafika 9,5 + flaga domyślna)

| ID | Zadanie | Kody | Status | SHA/data |
|---|---|---|---|---|
| Z-4.1 | **Bezpiecznik CI na centrum kart** — rozszerzyć `check-artefakt.sh` (dziś `:61-66` świadomie omija centrum → dług rósł niewidoczny). NAJPIERW to. | CI | ⬜ | — |
| Z-4.2 | **Crimson sweep centrum — 110 wystąpień**: Tool 38 (`bullets()` maluje wszystkie kropki), Initiative 35 (Gates 31), Notification 20 (badge, FOKUS PÓL, sekcja AI), Interview 11 (`c-accent` na stanach aktywnych), Decision 6 (zakładki ClickUp). Fokus → `c-focus`. | G1 G2 | ⬜ | — |
| Z-4.3 | **slate/navy/hex → tokeny c-**\* — Insight ~400, Interview ~230, Tool ~230, Initiative ~275, Task 67 (+martwy D-mode ~1900 linii w Task do decyzji: usunąć czy zostawić). | G3 | ⬜ | — |
| Z-4.4 | **Flaga cardContract domyślna + re-tag demo-safe** — po zielonym `--strict` i akcepcie Piotra. Zamyka program. | N3 | 🔷 | — |

## Zasady rozliczenia (kiedy zadanie jest „zrobione")

1. **Raport wykonawcy ≠ dowód.** `✅` dopiero po: esbuild + realny render w harnessie (light+dark) + niezależny odbiór wzrokiem nadzorcy.
2. **Zmiany wizualne → `🏁` tylko po akcepcie Piotra na zrzutach.** Mechaniczne (bez zmiany wyglądu) → `🏁` po zielonej bramce.
3. **Wszystko za flagą OFF do akceptu**; promocja wyłącznie procedurą `consultify-promocja-demo` (merge nie force, twarda weryfikacja plików, monitor gitSha, re-tag `demo-safe`).
4. **Zero wzrostu crimson** w każdym zadaniu (bramka vs baseline; po Z-4.1 pilnuje też centrum).
5. Wpis w tym pliku: status + SHA + data przy każdym przejściu stanu.

## Protokół aktualizacji (po każdej fazie)

1. **Re-audyt dotkniętych osi** mini-flotą (ta sama metoda: realny runtime, nie docy) → nowe liczby do matrycy w artifakcie (ten sam URL).
2. **Aktualizacja tego pliku** + matrycy + handoffu programu (`_HANDOFF_KONTRAKT_KARTY_2026-07-22.md`).
3. **Kamień milowy**: porównaj prognozę z pomiarem; rozjazd >0,3 → korekta planu.
4. Po każdej akcept-partii: **re-tag `demo-safe-<data>`**.

---
*Utworzono 2026-07-22 po audycie floty 7 audytorów. Historia zmian: git log tego pliku.*
