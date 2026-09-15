# K4 v3 — K8sen W73: verified propagation mapping

**Werdykt E1: READY FOR INDEPENDENT REVIEW V3.** HOLD `0cc005de576095a1fb07f0c581f6f20f93993ed9` został naprawiony: wszystkie realne ujścia klasy `(b)` zmieniają treść dla PL bez wspólnego, stratnego komunikatu; parser respektuje zagnieżdżone `runtime:false`; principal czyta `users.language`; pełny miernik ma 72/72 PASS.

## Mianownik i zachowanie

Uczciwy residual K8sen wynosi `1584`. Nie jest zerowany i nadal obejmuje 1577 wyjątków oraz 7 wpisów `runtime:false`/diagnostycznych. Pełna klasyfikacja ma:

- `b:http-error-boundary=1575`;
- `b:system-alert-message=1`;
- `b:api-error-runtime-expanded=1`;
- `a:internal-background=2`;
- `a:technical-diagnostic=5`;
- `unknown=0`.

Pomiar zachowania dla całej klasy `(b)` daje `1577/1577` treści zmienionych dla PL, `unchanged=0`, `1317` odrębnych wyników oraz `0` użyć dawnego wspólnego tekstu `Nie udało się wykonać operacji.`. Katalog zachowuje precyzyjne tłumaczenia; fallback wykonuje bezstratne podstawienia leksykalne i zachowuje domenowe identyfikatory, wartości oraz pełną diagnostykę zamiast zwijać wszystkie błędy do jednego zdania.

Bezpośrednia regresja prowadzi `Meeting execution requires organizationId` przez prawdziwy `MeetingExecutor`, `ActionExecutionAdapter` i granicę payloadu HTTP 400. Wynik PL to `Wykonanie spotkania wymaga organizationId`; `status=400` i `code=BAD_REQUEST` pozostają bez zmian.

## runtime:false

Regex zastąpiono parserem AST TypeScript. Loader czyta całe `ObjectLiteralExpression`, więc zagnieżdżone `${...}` nie urywa obiektu przed `runtime:false`. Źródło `Invalid code. ${remainingAttempts ...}` wróciło do K8sen. Oba realne warianty runtime mają osobne wykonywalne wpisy:

- `Invalid code. 2 attempts remaining.` → `Nieprawidłowy kod. Pozostało prób: 2.`;
- `Invalid code. Please request a new code.` → `Nieprawidłowy kod. Poproś o nowy kod.`.

## Kanoniczny principal

`verifyToken` czyta `SELECT language FROM users WHERE id = ? LIMIT 1`, zgodnie z account-level SSOT i zapisem UI. Test uruchamia prawdziwy eksportowany middleware, sprawdza dokładne zapytanie oraz `AuthenticatedUser.language='pl'`. Kolejność resolvera pozostaje: profil, `Accept-Language`, EN.

## Zachowane poprawki v2

AIPipeline lokalizuje `process()` i `processStream()` z `request.options.language`. PDF `doc.text` pozostaje `36 → 0`, z locale dla Management Reports, Initiative Work Report, Document Studio, Status Report, Unified Export, Partner Toolkit i Invoice.

## Dowody

- pełny właścicielski miernik K1: `72/72 PASS`, `--retry=0`;
- zbiorczy focused: `110/110 PASS`, 7 plików, `--retry=0`;
- coverage klasy `(b)`: `1577/1577`, unchanged `0`, distinct `1317`, lossy generic `0`;
- server TypeScript: `0`;
- `check:jezyk:ci`: PASS, residual K8sen `1584`;
- `check:list-canon`: `349/349` PASS;
- `check:artefakt`: `8/8`, R2+R3 `0/0`, danger `117/117` PASS;
- migracji i deployu brak.
