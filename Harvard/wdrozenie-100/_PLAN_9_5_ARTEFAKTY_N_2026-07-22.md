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
| Z-0.1 | **Progi treści kart** → **DECYZJA PIOTRA: PORADA, nie blokada.** AI pisze, system podpowiada czego brakuje, konsultant decyduje kiedy gotowe. Prompty w F2 budują wg tego (miękki hint, nie hard-gate). | R1 | 🏁 2026-07-22 | — |
| Z-0.2 | **Insight dedup Phase-D** → **DECYZJA PIOTRA: złącz 2 duplikaty z rdzeniem, pozostałe 9 zostaw jako dodawalne z pickera.** Wdrożenie w Z-2.3. | R2 | 🏁 2026-07-22 | — |
| Z-0.3 | **Rozjazdy kontrakt↔runtime** → **DECYZJA PIOTRA: KONTRAKT wygrywa — dostosuj kod do deklaracji.** Task governance/dependencies + Initiative RACI: kod dorasta do kontraktu (generatory AI wg deklaracji). Wdrożenie w Z-3.2. | F2 | 🏁 2026-07-22 | — |

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
| Z-4.2 | **Crimson sweep centrum — WYKONANE.** 7 kart + 28 shared (`MyWork/shared/*`, `PreviewPane`) + 5 `NModeSections/*` (RAID/Risk/Governance/Komentarze/Powiązania). Crimson na karcie N-mode **110 → 0** (computed-scan light+dark). Fokus→c-focus, semantyka danger/warning/success przez tokeny. Button brand-variant świadomie zostaje. Odkrycie: prawdziwe źródło crimson = NModeSections (N-mode), nie tylko główne view. 11 commitów sweep. | G1 G2 | ✅ 2026-07-22 | a8dad0d..348e767 |
| Z-4.3 | **slate/navy/hex → tokeny c-**\* — WYKONANE łącznie z Z-4.2 (agenci robili crimson+tokeny naraz per plik). Insight 656+169→0, Task N-mode 197→0 + D-legacy 421→0, Interview ~900→0, itd. Wyjątki: hex print-root (eksport PDF, uzasadnione). | G3 | ✅ 2026-07-22 | jw. |
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
