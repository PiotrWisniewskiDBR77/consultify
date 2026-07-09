# VEGAS — audyt kompletności i spójności dokumentacji (2026-07-09)

> Przegląd architekta przed falą artefaktów (B8). Zweryfikowane na ŻYWYM kodzie `origin/demo`, nie na deklaracjach. Werdykt ogólny: **system dokumentacji jest kompletny i nadaje się do egzekucji** — standard anatomii to najlepszy dokument w repo. Poniżej hierarchia, 6 findingów i braki do domknięcia.

## 1. HIERARCHIA DOKUMENTÓW (deklaracja pierwszeństwa — od dziś obowiązuje)

Przy sprzeczności wygrywa dokument wyżej:

| Poz. | Dokument | Rola | Stan |
|---|---|---|---|
| 1 | `ARTIFACT_ANATOMY_STANDARD.md` | **SSOT artefaktów**: 6 stref, 5 archetypów, alfabet elementów §6, menu per archetyp §5, instancjacja §13, build-ready §11, DoD §18.1 | ✅ kompletny (1255 linii, spójny) |
| 2 | `docs/ui-standards/TRIADA_KANON.md` | SSOT list/tabel (SPEC-L) — zrobione, na demo | ✅ zamknięte |
| 3 | `_FORMULA_MENU_NARZEDZI_12.md` | instancjacja per-narzędzie (12×: co w którym menu, jakie przyciski) + kolumna Stan | ✅ nowy (07-09), do wypełnienia Stan |
| 4 | `docs/ui-standards/CANON.md` | foundation (tokeny, stany) | 🟡 patrz F3 (dublet) |
| 5 | Wzorce wykonawcze: `_WZORZEC_N_KARTY…` · `_WZORZEC_W_WORKSPACE…` · `_DOD_ARTEFAKTY_N_CHECKLIST` | jak budować karty N / workspace W | ✅ aktualne |
| 6 | Plany rolloutu: `_ROLLOUT_ARTEFAKTY_PLAN.md` · `_ROLLOUT_ARTEFAKTY_N_INWENTARZ` | kolejność fal | ⚠️ CZĘŚCIOWO PRZEDAWNIONE (F2/F4) |

Skille (egzekucja): `consultify-artefakty` (kanon per artefakt — ✅ mocny, aktualny) · `consultify-artefakt-fala` (NOWY — orkiestracja fali) · `consultify-petla`/`consultify-test` (cykl+odbiór) · `consultify-promocja-demo` (deploy).

## 2. FINDINGI SPÓJNOŚCI (6)

**F1 ★★★ SYSTEMOWA DZIURA KOLORU: token `--c-accent` = crimson #85182F, a hook go NIE blokuje.**
`check-artefakt.sh` łapie `primary-*`/`crimson-*`/`navy`/`slate`/hex — ale **NIE** `bg-c-accent`/`border-c-accent`. To dokładnie wektor incydentu vb4 (`c5d767ec57`, przodek demo): komponenty „token-correct" renderują crimson na selected/CTA/modal (~446 plików z c-accent). Kolorystyką per Twoja decyzja zajmujemy się NA KOŃCU — ale fala artefaktów NIE MOŻE dokładać nowych użyć. **Mitigacja natychmiastowa (dokumentacyjna): twardy zakaz `c-accent` w nowym kodzie powłoki** — dopisany do skilla `consultify-artefakty`. Mitigacja docelowa (kod, później): rozszerzyć hook o wzorzec `(bg|border|text|ring)-c-accent` + osobna decyzja „czym jest brand accent" przy sweepie kolorystyki.

**F2 ★★ SYNDROM PRZEDAWNIONYCH PLANÓW (dokumenty zaniżają, kod jest dalej).**
`_ROLLOUT_ARTEFAKTY_PLAN.md` twierdzi „ArtifactRightPanel do zbudowania / żadna powłoka go nie ma" — a on ISTNIEJE (`src/components/standard/ArtifactRightPanel.tsx`) i jest ŻYWY bezwarunkowo w Task (TaskDetailView:4605) + podpięty w NModeShell/IdeaMap/Initiative. Ten sam syndrom co w Harvardzie (B1 „fantom" był realny, B3 „zero E2E" miało siatkę). **Reguła fali: przed każdym artefaktem robotnik sprawdza CO JUŻ JEST (grep), nie ufa planom.** Plany rolloutu traktować jako mapę kolejności, nie stanu.

**F3 ★ FRAGMENTACJA KANONU: `CANON.md` vs `CANON 2.md`** (168 vs 167 linii, RÓŻNE treści, 1 referencja przychodząca do „CANON 2"). Dwie wersje foundation = ryzyko rozjazdu. **Decyzja do podjęcia (D):** scalić różnice do CANON.md i usunąć dublet (po grep referencji — reguła „verify refs before delete"). Do sweepa dokumentacyjnego, nie blokuje fali.

**F4 ✅ SKORYGOWANE: fala N JEST scalona na demo** (b4d6356306 = przodek origin/demo), za flagami OFF. Inwentarz N mówił „gałąź artefakty-n-integ, NIE na demo" — przedawnione; gałąź słusznie skasowana przy sprzątaniu (była zmergowana). Konsekwencja dla fali: N-karty (Insight/Initiative/Task/Decision z NModeCardState) czekają na demo za flagą — do odsłonięcia + bramka promptów, nie do budowy.

**F5 ⛔ OTWARTA BRAMKA PIOTRA: prompty kart N (Bramka 0).**
Doktryna BCG / `_PRZEGLAD_PROMPTOW_ARTEFAKTY_N_2026-07-07.md` — treść promptów NIE ZATWIERDZONA. Bez tego sekcje AI kart N nie idą live (prompt zmienia output; persona.ts jest globalna). To jest pierwsza pozycja na Twojej liście decyzji fali.

**F6 🟡 INWENTARZ FLAG OFF (do odsłonięcia w fali, nie do budowy):**
`melsCanvasFlag` (powłoka W canvas) · `melsMindmapPanelFlag` (skonsolidowany panel Mind Map) · flagi kart N (NModeCardManager/cardSets/useCardLayout) — wszystkie default OFF „until Piotr signs off". Mechanizm flipa: localStorage `ff.*` / env `VITE_*` — czyli galeria zrzutów NIE wymaga deployu (flip w przeglądarce).

## 3. KOMPLETNOŚĆ — czego BRAKOWAŁO i co domyka ten pakiet

| Luka | Domknięcie |
|---|---|
| Instancjacja per-narzędzie (standard §13 opisuje archetypy, nie konkretne 12 narzędzi) | ✅ `_FORMULA_MENU_NARZEDZI_12.md` (07-09) |
| Zestawienie JEST/DOROBIĆ per przycisk | ⬜ krok 2 — kolumna Stan w Formule (praca fali, per artefakt) |
| Orkiestracja fali (kto, w jakiej kolejności, jakim modelem, z jaką bramką) | ✅ nowy skill `consultify-artefakt-fala` |
| Zakaz c-accent w nowym kodzie | ✅ łata w `consultify-artefakty` (F1) |
| Galeria referencyjna zrzutów (wzorzec Task „jak ma wyglądać") | ⬜ pierwszy krok fali (zrzuty wzorca PRZED rolloutem) |
| Kolorystyka końcowa (crimson sweep, brand accent) | ⏸ świadomie NA KONIEC (Twoja decyzja 07-08) |

## 4. WERDYKT
Dokumentacja jest **gotowa do egzekucji fali artefaktów**: standard kompletny, formuła per-narzędzie istnieje, skille domknięte, dziura F1 załatana na poziomie reguły. Otwarte na Tobie: **F5 (prompty kart N)** + bramki zrzutów per fala. Kolejność fal i mechanika — w skillu `consultify-artefakt-fala`.
