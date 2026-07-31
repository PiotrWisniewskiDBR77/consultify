---
doc_kind: UI_COMPONENT_AUDIT_STANDARD
status: canonical_control_layer
owner: Piotr Wisniewski
last_updated: 2026-07-31
authority: docs/ui-standards/CANON.md
---

# Kontrola UI/UX komponentów — audyt i bramka odbioru

## 1. Jednostka kontroli

Kontrolujemy jednocześnie:

1. rodzinę komponentu — czy istnieje jeden właściwy kontrakt;
2. implementację — czy kod realizuje kontrakt;
3. instancję w module — czy domenowe dane i akcje są poprawne;
4. pełny przepływ — czy tabela, preview, artefakt i Teresa tworzą jedno zachowanie.

Dobry screenshot nie zamyka audytu, jeśli zapis, uprawnienie albo błąd nie działa.

## 2. Macierz punktowa

Każdy wymiar otrzymuje `0` brak, `1` częściowo, `2` zgodnie. Element krytyczny z wynikiem `0` oznacza automatyczne `NO-GO`.

| Wymiar | Pytanie kontrolne | Krytyczny |
| --- | --- | --- |
| purpose | czy komponent wykonuje jasno zdefiniowany job? | tak |
| canon | czy używa właściwej rodziny i anatomii? | tak |
| data | czy źródło, ownership i read-back są prawdziwe? | tak |
| actions | czy każdy widoczny action działa lub ma uczciwe wyjaśnienie? | tak |
| states | czy loading/empty/error/partial/read-only/no-access są zaprojektowane? | tak |
| navigation | czy back/deep link/Esc/unsaved changes działają? | tak |
| AI | czy propozycja Teresy ma źródła, diff, approval i recovery? | gdy występuje |
| permissions | czy backend egzekwuje capability i tenant scope? | tak |
| accessibility | czy keyboard, focus, semantics i live regions działają? | tak |
| responsive | czy zachowanie na wspieranych viewportach jest kompletne? | tak |
| visual | czy dark/light, tokeny, gęstość i hierarchia są zgodne? | tak |
| performance | czy duże dane, streaming i anulowanie nie psują pracy? | zależnie od rodziny |
| consistency | czy brak lokalnych forków i innej nazwy tej samej akcji? | nie |
| evidence | czy istnieją testy i aktualne dowody wizualne/E2E? | tak dla `DONE` |

Werdykty: `GO` wyłącznie bez krytycznego zera i przy minimum 90%; `FIX` 70–89%; `NO-GO` poniżej 70% lub przy krytycznym zerze. `N/D` wymaga uzasadnienia.

## 3. Kontrole specjalne

### Table + Preview

Stosujemy pełne 43 punkty `TRIADA_KANON.md`, a dodatkowo sprawdzamy zgodność danych listy i preview, zachowanie selekcji po sort/filter, wielkość danych, URL/deep link, no-access relations i identyczne akcje encji we wszystkich widokach.

### Artifact

Sprawdzamy identity/type/version/status/owner, tryby read-edit-review-present, autosave/read-back, wersjonowanie, komentarze, źródła, export/share, handoff do modułu, konflikt równoległej edycji, recovery oraz granice Artifact Host.

### AI proposal

Sprawdzamy rozdział current/proposed, granularne accept/reject, confidence i evidence, brak mutacji przed zgodą, undo/rollback, ponowienie po błędzie oraz audit trace.

### Forms/Wizards/Generators

Sprawdzamy thinking/assumptions preview przed kosztowną generacją, zachowanie draftu, walidację inline i summary, cofanie bez utraty danych, przerwanie procesu, idempotentny submit oraz rezultat/handoff.

### Canvas/diagram

Sprawdzamy selection, zoom/pan, keyboard, context menu, clipboard, undo/redo, persistence, collaboration, export, zmianę reprezentacji, AI proposal i spójność wspólnego shellu.

## 4. Pierwszy backlog audytu komponentów

| Fala | Rodziny | Dlaczego teraz | Wynik |
| --- | --- | --- | --- |
| `C0` | Table, Preview, Module Hub, actions, states | występują prawie w każdym golden flow | karta + status + lista duplikatów + ekrany referencyjne |
| `C1` | Artifact Shell, Canvas, editors, proposal AI | rdzeń Chat/Materials/Tools/Assessment | wspólna anatomia i kontrakt runtime |
| `C2` | Cards/N-mode, relations, KPI/status, task/decision panels | spina Initiatives, Execution i Results | katalog wariantów domenowych |
| `C3` | Forms, wizards, generators, overlays, help | tworzenie i onboarding | mechanika submit/recovery/a11y |
| `C4` | Calendar/timeline, Kanban, spreadsheet, deck, export | powierzchnie specjalistyczne | osobne checklisty i testy danych |
| `C5` | Admin/Settings controls, security states | mniejsza częstotliwość, wysokie ryzyko | reauth/diff/audit/no-access evidence |

## 5. Format raportu

Raport zawiera: component ID, wersję kontraktu, route i viewport, commit/build, macierz 0–2, defekty z priorytetem, pliki implementacji, screenshot dark/light, testy, werdykt oraz właściciela naprawy. Jedna kontrola może zamknąć komponent dopiero po sprawdzeniu co najmniej jednego realnego konsumenta.

## 6. Bramka dla zadań agentów

Każda paczka Claude/Codex ingerująca w UI ma w treści:

- component ID i dokumenty kanoniczne do przeczytania;
- zakaz tworzenia równoległego komponentu bez zgody;
- precyzyjne stany i działania objęte zadaniem;
- wymagane testy oraz screenshoty dark/light;
- listę konsumentów, których nie wolno złamać;
- komendę walidacji i oczekiwany raport.

## 7. Definicja zakończenia kontroli całej aplikacji

Warstwa UI/UX jest gotowa do odbioru stagingu, gdy wszystkie rodziny używane w golden flows MVP mają kartę, status i referencyjną implementację; każdy ekran przeszedł kontrolę instancji; brak krytycznych duplikatów prowadzących do odmiennego zachowania; a dowody dark/light, keyboard, error/recovery i E2E są przypięte do wersji kodu.
