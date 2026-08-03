---
doc_kind: UI_UX_DOCUMENTATION_ACCEPTANCE_AUDIT
status: FAIL_REMEDIATION_REQUIRED
remediation_status: CLOSED_BY_DOCUMENTATION_REACCEPTANCE_2026-08-02
auditor_role: independent_skeptical_ux_system_reviewer
audit_date: 2026-08-02
scope: documentation_readiness_before_product_wide_ui_repair
authority: docs/ui-standards/CANON.md
---

# Sceptyczny odbiór dokumentacji UI/UX Consultify

> Raport zachowuje stan wykryty przed remediation. Zamknięcie P0 i aktualny werdykt opisuje `DOCUMENTATION_REACCEPTANCE_2026-08-02.md`.
>
> **Uwaga (2026-08-02) — dokument historyczny, ale łańcuch po nim nie jest już aktualny.** Blokery P0 wykryte tutaj rzeczywiście zostały zamknięte przez `DOCUMENTATION_REACCEPTANCE_2026-08-02.md`. Problem: obie kolejne rundy (2 i 3), które ten wynik zamykały, okazały się **zbyt łagodne** — mierzyły obecność sekcji i nagłówków, nie treść pod nimi, i przepuściły 12 z 20 sekcji identycznych bajt-w-bajt we wszystkich 26 kartach. Czwarty, niezależny audyt (2026-08-02) cofnął ich werdykty. Pełny łańcuch unieważnień i aktualny stan: `CANON.md` §9 (wpis v3.1) oraz [`_KOREKTY_PO_PANELU_ADWERSARYJNYM_2026-08-02.md`](_KOREKTY_PO_PANELU_ADWERSARYJNYM_2026-08-02.md). Kolejność czytania dla recenzenta: `CLAUDE_DOCUMENTATION_HANDOFF.md`.

## 1. Werdykt

**FAIL — dokumentacja nie jest jeszcze wystarczająca do bezpiecznej, szerokiej naprawy całej aplikacji.**

Kierunek wizualny jest dobry, governance jest mocne, a standardy fundamentów są ponadprzeciętnie rozbudowane. Nie ma jednak jeszcze kompletnego, jednoznacznego kontraktu komponent po komponencie ani przepływ po przepływie. Implementator nadal musiałby podejmować zbyt wiele lokalnych decyzji o rozmiarze, układzie, zachowaniu, semantyce i stanach. To grozi kolejną generacją niespójności.

Ocena gotowości dokumentacji: **5,8/10**. Minimalna bramka rozpoczęcia naprawy systemowej: **8,5/10**, bez żadnego otwartego P0.

## 2. Dowody ilościowe

- 26 rodzin komponentów posiada katalogi `STANDARD.md`;
- 21/26 kart ma status `DRAFT` i jest jedynie szkieletem;
- 5/26 kart oznaczono `APPROVED_SPEC`, ale żadna nie zawiera literalnie wszystkich 20 obowiązkowych sekcji karty;
- 26/26 kart używa starego pojedynczego pola `status`, mimo że standard wymaga osobnych `spec_status` i `runtime_status`;
- większość kart nie zawiera kompletnej metryki: `family`, `product_owner`, `code_owner`, `known_consumers`, `last_runtime_audit`;
- `reference_evidence` pozostaje puste, nawet gdy tekst wskazuje Zadania i Decyzje jako referencję;
- istnieją sprzeczne deklaracje wymiaru Menu 3: 48 px i 44 px w tym samym standardzie anatomii artefaktów;
- dokumentacja linków jest technicznie spójna: 124 pliki, 217 odwołań, 0 martwych linków — ale integralność linków nie oznacza kompletności kontraktów.

## 3. Ocena obszarów

| Obszar | Ocena | Werdykt | Najważniejszy brak |
|---|---:|---|---|
| Hierarchia autorytetu i governance | 8,5/10 | PASS | trwa jeszcze migracja starszych dokumentów |
| Kolory i semantyka | 7,5/10 | PASS WITH GAPS | brak jednej zatwierdzonej macierzy wszystkich par tokenów i stanów |
| Typografia | 6/10 | FAIL | role używają przedziałów zamiast jednego rozmiaru, line-height i truncate/wrap rules |
| Spacing i geometria | 5/10 | FAIL | jest skala, ale brak kompletnej matrycy wymiarów komponentów i regionów |
| Ikony | 6,5/10 | FAIL | fundament jest, brak mapy ikon i accessible names per komponent/akcja |
| Tabele i preview | 7/10 | PASS WITH GAPS | najlepszy opis, ale niepełna karta oraz brak pełnego evidence/test matrix |
| Overlays: menu/modal/popover/drawer | 5/10 | FAIL | brak kompletnego kontraktu pozycjonowania, collision, focus trap i stacking |
| Formularze i wizardy | 4/10 | FAIL | karty są szkieletem; brak walidacji, kroków, recovery i autosave |
| Edytory/canvas/artefakty | 6/10 | FAIL | bogata anatomia, ale sprzeczności i brak kompletnego kontraktu per archetyp |
| Accessibility | 5,5/10 | FAIL | dobre deklaracje, brak normatywnej tabeli klawiatury i ARIA dla każdej rodziny |
| Responsive/zoom/reflow | 4,5/10 | FAIL | desktop opisany; brak jawnego 200%/400%, reflow i fallbacków regionów |
| Motion i feedback | 8/10 | PASS WITH GAPS | dobry kanon, część istniejących docs nadal pokazuje zakazane wzorce |
| Stany i honest UI | 7/10 | PASS WITH GAPS | lista stanów istnieje, lecz bez wizualnego kontraktu per komponent |
| Przepływy end-to-end | 4/10 | FAIL | moduły opisują powierzchnie, nie kompletne customer journeys i przejścia |
| Evidence, fixtures i visual regression | 3,5/10 | FAIL | brak powiązanych fixture/story/screenshot IDs i baseline'ów |

## 4. Zgodność z uznanymi standardami

### 4.1 Co jest zgodne

- hierarchia, powściągliwość i spójność odpowiadają zasadom Apple HIG;
- jedna lub dwie akcje prominentne na widok są zgodne z zaleceniem Apple dla przycisków;
- cel dotykowy 44×44 px odpowiada zaleceniu Apple, a desktopowe minimum 36×36 przewyższa minimalne 24×24 CSS px WCAG 2.2;
- zasady focusu, `Esc`, powrotu focusu i keyboard access idą w kierunku WAI-ARIA APG oraz Radix;
- brak cichych mutacji AI, proposal/diff/approval/undo jest właściwy dla aplikacji wysokiego zaufania;
- ograniczony motion i `prefers-reduced-motion` są poprawnym kierunkiem.

### 4.2 Co nie osiąga jeszcze poziomu najlepszych systemów

Najlepsze systemy nie kończą na zdaniu „keyboard complete” albo „wyłącznie tokeny”. Podają dla każdego wzorca konkretne zachowanie: role ARIA, początkowy focus, roving tab index, klawisze, dismiss, collision, portal, stan controlled/uncontrolled, accessible label i recovery. Radix dokumentuje te kontrakty osobno dla każdego primitive; Consultify jeszcze nie.

WCAG 2.2 wymaga minimum 24×24 CSS px lub odpowiedniego odstępu. Apple zaleca 44×44 pt dla wygodnego celu. Consultify ma rozsądny wymiar docelowy, ale nie ma jeszcze testowalnej reguły dla gęstych toolbarów, inline actions, węzłów canvasu i małych ikon w tabelach.

## 5. Blokery P0 — muszą zniknąć przed szeroką naprawą

### P0-1. Niepełne karty rodzin

Uzupełnić wszystkie 26 kart według 20-sekcyjnego standardu. Nie wolno utrzymywać `APPROVED_SPEC`, jeśli karta sama deklaruje „uzupełnić anatomię, warianty...” albo nie ma wymaganej metryki.

### P0-2. Jeden mierzalny token contract

Utworzyć jedną tabelę normatywną zawierającą:

- wszystkie role typografii: px/rem, weight, line-height, letter-spacing, truncate/wrap;
- spacing 4/8/12/16/20/24/32/40/48 i dozwolone użycia;
- wysokości button/input/select/tab/chip/menu item/table row/header;
- szerokości rail/sidebar/drawer/preview/modal/content max-width;
- radiusy, border widths, shadows i elevation;
- ikony: glyph size, stroke, hit target i gap do etykiety;
- breakpoints, zoom i reflow;
- globalną skalę z-index/portal;
- czasy i easing motion;
- tokeny light/dark oraz minimalny kontrast.

### P0-3. Usunięcie sprzeczności

Rozstrzygnąć i usunąć z aktywnych dokumentów m.in.:

- Menu 3: 44 czy 48 px;
- „karty domyślnie bez borderu” kontra „każdy ważny kontener ma dwa środki separacji”;
- zakaz `shadow + border` kontra przykłady, które wymagają obu;
- kolor `primary` jako CTA kontra selected/bulk/error-like użycia;
- globalna wysokość Menu 1 kontra warianty listowe i artefaktowe;
- dozwolone i zakazane wyjątki canvasu.

### P0-4. Kontrakt interakcji dla primitives

Dla menu, context menu, tooltip, popover, dialog, alert dialog, drawer, combobox, select, tabs, toolbar, accordion, toast i drag/drop określić:

- semantykę HTML/ARIA;
- pełną tabelę klawiatury;
- focus entry, trap, restore;
- dismiss i zachowanie kliknięcia poza;
- portal, z-index, collision i viewport padding;
- disabled/read-only/loading/error;
- mobile/touch fallback;
- kryteria testów automatycznych i manualnych.

### P0-5. Przepływy i przejścia użytkownika

Dla każdej funkcji MVP potrzebna jest mapa stanów i przejść, nie tylko lista ekranów:

`entry → list → filter/search → preview → full detail/workspace → edit/save → success/error/recovery → back with context`.

Wizard wymaga wszystkich kroków, walidacji, cofania, zapisu postępu, przerwania i wznowienia. AI wymaga proposal, preview/diff, approval, execution, read-back, undo i failure recovery.

### P0-6. Evidence i odbiór

Każda zatwierdzona karta musi wskazywać:

- fixture danych normal/empty/long/error/no-access;
- story lub dedykowaną trasę testową;
- baseline light/dark;
- keyboard i screen-reader test;
- viewporty oraz 125%, 200% zoom;
- identyfikator zaakceptowanego screenshotu;
- datę i odbierającego.

## 6. Braki P1 — wymagane przed oznaczeniem systemu jako kanoniczny

- content design: słownik etykiet, błędów, empty states, potwierdzeń i komunikatów AI;
- locale: ekspansja tekstu PL/EN, daty, liczby, waluty i pluralizacja;
- data visualization: paleta serii, tooltipy, osie, brak danych i dostępność;
- drag/drop: alternatywa klawiaturowa i ogłoszenia live region;
- wirtualizacja tabel i canvasu bez utraty focusu;
- polityka skrótów oraz wykrywanie konfliktów przeglądarki/OS;
- skeletony dopasowane do finalnego layoutu i limity spinnerów;
- zachowanie przy offline, reconnect i konflikcie wersji;
- telemetryka UX z nazwami zdarzeń i progami akceptacji;
- testy wizualne dla długich nazw, liczb, pustych i ekstremalnych danych.

## 7. Kolejność domknięcia

1. Foundation token contract i rozstrzygnięcie konfliktów.
2. Primitives: actions, overlays, forms, states, navigation i permissions.
3. Composed: table, preview, cards, kanban, calendar, notifications.
4. Workspaces: N-mode, editor, canvas, artifact, deck, AI.
5. Mapy przepływów MVP oraz cross-module transitions.
6. Fixtures, story routes, screenshot baselines i acceptance matrix.
7. Ponowny niezależny odbiór. Dopiero `PASS` otwiera masową naprawę UI.

## 8. Definition of Accepted Documentation

Dokumentacja przechodzi odbiór dopiero, gdy:

- 26/26 kart spełnia metrykę i 20 sekcji;
- wszystkie P0 są zamknięte;
- zero sprzecznych aktywnych reguł;
- każde `APPROVED_SPEC` ma evidence i test matrix;
- każda funkcja MVP ma przepływ end-to-end;
- implementator nie musi wymyślać lokalnego wymiaru, koloru, ikony, focusu, stanu ani zachowania;
- powtórny audyt uzyska minimum 8,5/10.

## 9. Źródła porównawcze

- [WCAG 2.2 — Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [WCAG 2.2 — Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
- [WCAG 2.2 — Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [WAI-ARIA APG — Modal Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [Apple HIG — Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles)
- [Apple HIG — Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Apple HIG — Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Radix Primitives — Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)
- [Radix Primitives — Toolbar keyboard contract](https://www.radix-ui.com/primitives/docs/components/toolbar)
