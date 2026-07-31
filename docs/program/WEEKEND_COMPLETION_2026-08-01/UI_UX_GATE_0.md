---
doc_id: ui-ux-gate-0
truth_type: delivery-governance
status: canonical
owner: codex
business_owner: piotr
last_reviewed: 2026-07-31
---

# Gate 0 — UI/UX bez blokowania domknięcia produktu

## 1. Decyzja operacyjna

Nie wykonujemy osobnego big-bang refaktoru całego UI przed pracami funkcjonalnymi. Ujednolicenie odbywa się **wewnątrz każdego golden flow**, na ekranach dotykanych przez daną paczkę. Dzięki temu UX przestaje być niezależnym problemem, a staje się obowiązkowym warunkiem `DONE`.

## 2. Publiczne rodziny domyślne

Nowe i migrowane ekrany używają w pierwszej kolejności:

- listy: `StandardModuleBar`, `StandardTable`, `StandardPreview`, `StandardKanban`;
- artefakty: `StandardArtifactShell` i jego panele/sekcje;
- rekordy: N-mode layout, cards i shared sections;
- stany: `src/components/shared/states`;
- akcje: kanoniczne Preview actions, `RowActionsMenu`, Menu 3 i primitives;
- komponenty specjalistyczne: adapter do wspólnego shellu, nie lokalna kopia shellu.

Workbook nie jest App Table, a Document/Deck/Canvas nie są tym samym edytorem. Ujednolicamy ich anatomię, stany, nawigację, akcje i governance, zachowując właściwy silnik środka.

## 3. Reguły bez wyjątku

1. Każde zadanie UI wskazuje `UI Component ID` z rejestru.
2. Agent czyta `CANON.md` oraz standard rodziny przed edycją.
3. Nie tworzy nowej tabeli, preview, buttona, modala, stanu ani shellu, jeśli istnieje publiczny komponent.
4. Lokalny adapter jest dopuszczalny; lokalny fork wyglądu wymaga decyzji Codex/PO.
5. Baseline checkerów może wyłącznie maleć. Podniesienie baseline jest `NO-GO` bez jawnej decyzji.
6. Brak nowych naruszeń nie oznacza odbioru — ekran przechodzi pełną checklistę instancji.
7. Migracja zachowuje stary tor do czasu E2E/read-back nowego, jeśli ryzyko regresji jest istotne.
8. Nie wykonujemy mechanicznego masowego przepisywania 409 naruszeń.

## 4. UI/UX Definition of Done paczki

Paczka dotykająca interfejsu jest `DONE`, gdy:

- korzysta z właściwej rodziny komponentu lub ma zatwierdzony wyjątek;
- nie zwiększa żadnego baseline;
- przechodzi `npm run check:ui` i kontrole dokumentacji;
- ma dowód dark i light dla głównego stanu;
- ma loading, empty, error/degraded, no-access i success stosownie do przepływu;
- obsługuje keyboard, focus, Esc/back oraz responsive w zakresie wspieranym;
- nie zawiera atrapy, martwego kliknięcia ani sukcesu bez server read-back;
- zachowuje standard Teresy: current/proposed, źródła, approval i recovery;
- do raportu dołączono checklistę komponentu oraz wynik `GO/FIX/NO-GO`.

## 5. Kontrola w siedmiu etapach

| Etap programu | Kontrola UI/UX |
| --- | --- |
| decyzje | zamrażamy nazwy, komponenty i zatwierdzone wyjątki |
| audyt spójności | wykrywamy różne nazwy, statusy, akcje i reprezentacje tej samej encji |
| golden flows | wskazujemy ekrany i component IDs każdego kroku |
| remanent kodu | statusujemy również zgodność UI: standard/local/duplicate/legacy/missing |
| backlog | każda paczka ma UI DoD i pliki, których nie wolno forkować |
| fale wykonawcze | po każdej paczce visual + behavioral review |
| staging | pełny flow dark/light, keyboard, błąd/recovery oraz różne role |

## 6. Kolejność spłaty długu

`Results/KPI → Materials → Tools → Finance → Initiatives → pozostałe ekrany dotykane przez golden flows`.

Nie sprzątamy komponentu tylko dlatego, że istnieje. Sprzątamy go, gdy jest zamontowany, dotyka MVP, powoduje niespójność albo blokuje prawidłowy przepływ.

## 7. Dowody i źródła

- rejestr: `docs/ui-standards/02-components/COMPONENT_CATALOG_AND_OWNERSHIP_REGISTRY.md`;
- karta: `docs/ui-standards/02-components/COMPONENT_DOCUMENTATION_CARD_STANDARD.md`;
- audyt: `docs/ui-standards/02-components/COMPONENT_UI_UX_AUDIT_AND_ACCEPTANCE_MATRIX.md`;
- stan kodu: `AGREEMENTS/UI_COMPONENT_STANDARD_ADOPTION_AUDIT_2026-07-31.md`;
- nadrzędny kanon: `docs/ui-standards/CANON.md` i `TRIADA_KANON.md`.
