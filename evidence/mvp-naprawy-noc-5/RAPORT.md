# RAPORT — naprawy nocy 5 (3 defekty z RAPORT_A3.md)

Gałąź: `mvp/naprawy-noc-5` z bazy `codex/m03-admin-20260824` (worktree `/private/tmp/wt-fix5`).
Commity: `f56e21b270` (defekt 1) → `c0cb2c2c51` (defekt 2) → `43178dba02` (defekt 3).

## 1. Prezentacja Outputu — "Nie znaleziono" dla ocen niezamrożonych (WAŻNY)
Plik: `src/components/assessment/presentation/AssessmentPresentationView.tsx`
(+ nowy test `presentation/__tests__/prezentacjaOcenyZastanej.test.tsx`).
Fallback do `fetchOutputForReport` (ta sama projekcja co naprawiła `/report`) dla
id `ocena~<id>` i po 404 z jądra; renderuje `AssessmentReportDocument` z banerem
"z zapisu sesji — jeszcze nie zamrożone".
Test: 2 przypadki (z prefiksem, bez prefiksu — fallback po 404), fixture realnej
oceny DRD. Mutacja: wymuszono `sprobujMagazynZastany` na `return false` → oba
testy padają na "Nie znaleziono Outputu" (potwierdzone ręcznie, przywrócone).
Zrzut PO: `01-prezentacja-po.png` (assess-drd-enterprise-01, 0 błędów konsoli).

## 2. Realizacja — kolumna TYP "Nieznany typ" ~90% wierszy (WAŻNY)
Pliki: `src/labels/executionTypeLabels.ts`, `src/components/Execution/ExecutionHub.tsx`
(+ test `labels/__tests__/executionTypeLabels.test.ts` rozszerzony).
Przyczyna #1: `String(initiative.axis)` zamieniało `null` na literalny tekst "null".
Przyczyna #2: `axis='transformational'` (13/71 wierszy, WALIDOWANY enum
`InitiativeAxisEnum` w `server/src/validators/initiative.validators.ts`) nie był
w słowniku. Naprawa: pusty `axis` → "—"; dodano strategic/operational/
transformational/compliance do słownika.
Wynik na żywej bazie (org DBR77, 71 inicjatyw): 23/71 (32%) rozpoznane, 48/71
(68%) "—" (axis NULL w bazie — dane, nie kod), 0 "Nieznany typ".
Test: 6 przypadków w `executionTypeLabels.test.ts`. Mutacja: usunięto gałąź
"brak danych" → test "—" pada z "Nieznany typ" (potwierdzone, przywrócone).
Zrzuty PO: `02-execution-po.png` (Aktywne, 0 Nieznany typ), `02c-execution-procesy-po.png`
(widoczne realne etykiety: Procesy/Kultura/Transformacyjna obok "—").
Niezrobione: cel "≤10% —" z instrukcji nieosiągalny bez wymyślania danych —
68% inicjatyw demo naprawdę ma `axis IS NULL` w bazie (sprawdzone SQL-em).

## 3. Realizacja — tytuł ucięty do "Sup..." w panelu Rekord|Teresa (WAŻNY)
Plik: `src/components/ui/ResizableTable/PreviewPaneShell.tsx` (współdzielona
powłoka — używana też w Moja Praca/Wywiad) + test `tablePreviewGeometry.r03-2.test.tsx`.
Przyczyna: tytuł i pas akcji (zakładki Rekord/Teresa + "Otwórz" + X w
`JedenPrawyPanel.tsx`) dzieliły jeden wiersz — samo `line-clamp-2` dawało tylko
"Suppl/y…". Naprawa: nagłówek dwuwierszowy (wiersz 1 = tytuł pełna szerokość +
X, wiersz 2 = actions). Zweryfikowano na Moja Praca i Wywiad — bez regresji.
Test: nowy przypadek `line-clamp-2` zamiast `truncate`. Mutacja: cofnięcie klasy
→ test pada (potwierdzone, przywrócone).
Zrzuty PO: `03-panel-tytul-po.png` (+`__dark`), `03b-panel-tytul-dlugi-po.png`
(tytuł 52-znakowy, pełne 2 linie, 0 błędów konsoli).

## Domknięcie
esbuild per plik: OK (wszystkie 4 dotknięte pliki). vitest ścieżkowo: OK (poza
6 niepowiązanymi, zastanymi failami `useLocation()`/Router w
`tablePreviewGeometry.r03-2.test.tsx` — zweryfikowane `git stash`, identyczne
PRZED i PO). `check-list-canon.sh`: OK. `check-artefakt.sh`: OK (baseline 8,
bez wzrostu). Brak push — commit-per-defekt na `mvp/naprawy-noc-5`.

## Niezrobione / do dalszej pracy
- Cel "≤10% —" dla kolumny TYP (patrz wyżej) — problem danych demo, nie kodu.
- 6 zastanych failów w `tablePreviewGeometry.r03-2.test.tsx` (Router context)
  niezwiązanych z tym dyżurem — pozostawione bez zmian.
