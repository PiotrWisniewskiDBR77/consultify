# A/D D-3 + Z-64 — freeze 2026-09-14

**Werdykt autora: READY_FOR_INDEPENDENT_REVIEW_WITH_STOP_OWNER_DECISION. Zakres D-3, P1 i Z-64 jest dostarczony; synchronizacja luster kontraktu pozostaje jawnie czerwona 4/7 i wymaga decyzji właściciela, ponieważ różnica jest realną zmianą kontraktu, a nie mechanicznym dryfem.**

## Zakres i wynik

1. **D-3 zastane czerwienie:** poprawiono asercje po aktualnym locale i kontrakcie w DRD (nagłówek 7/7, Teresa 5/5, `skipCode` 6/6), DOCX Day50 4/4, Interview STT 6/6, rejestr 4/4, kafle jakości Assessment 2/2 i bramkę kandydata 4/4. Produkt nie został przełączony na PL.
2. **My Work 12/11:** wszystkie wskazane pliki mają zielone testy po aktualizacji fixture i asercji; osobny commit `7e2e2f62d8` zachowuje izolację wymaganą przez W66. Zakres obejmuje owner states 3/3, candidate gate 4/4, narożniki workspace 9/9, zapis ryzyka 2/2 oraz jeden panel/Teresa 7/7. Istniejące callbacki Teresa zostały podłączone do kanonicznego panelu.
3. **P1 Projects:** kolumny bramki etapów mieszczą się w 285 px bez osłabienia globalnej podłogi statusu 160 px; test współistnienia Z-43/Z-48 ma 4/4. Polski pusty stan mówi o Projektach. Osierocony klucz `approvalRoles.GATE_AUTHORITY` usunięto, a kontrakt roli `GATE_REQUESTER` ma 4/4.
4. **Z-64 API:** lista `/api/method/sessions/Library` zachowuje organization scope i role. RealPG: OWNER tworzy, ADMIN tej samej organizacji widzi, MEMBER innej organizacji nie widzi; odczyt obcego rekordu zwraca 403 z `METHOD_SESSION_ORG_FORBIDDEN`, a odczyt bez autoryzacji 401. Wynik 15/15 na jednej bazie PostgreSQL.
5. **Z-64 UI:** Library/Assessment hub pokazuje kanoniczny `EmptyState` z akcją `Try again` po abort/network offline. Test mounted dowodzi sekwencji abort → error → retry z tym samym kluczem idempotency → poprawny odczyt i nawigacja. Wynik 1/1; kanon Library 7/7.
6. **Dowód mobilny:** PL, jasny motyw, viewport 360×900; pełny status `Zatwierdzona` jest widoczny. Przy tej szerokości tabela przewija się poziomo zgodnie z kanonicznym zachowaniem; test liczbowy dowodzi budżetu 285 px dla obu kolumn podglądu.

## STOP_OWNER_DECISION — contractMirrorDrift

Pierwsza próba mechanicznej synchronizacji została zachowana w historii jako `d539d76e7f`, a następnie audytowalnie odwrócona commitem `f924fd8266`; nie użyto resetu ani przepisywania historii. Stare lustro serwera deklaruje `TransitionAuthority = 'process_role' | 'organization_owner'`, eksportuje je i rozszerza nim `TransitionResult`. `MethodSessionService` jest realnym konsumentem tego typu. Kanoniczne `src` tej deklaracji nie ma, natomiast ma `compiledLanguage?: string`, którego stare lustro `methodPack` nie ma. Po odwróceniu zmiany server TypeScript wrócił do 0 błędów, a `contractMirrorDrift` celowo pozostaje **4 FAIL / 3 PASS** bez osłabienia testu.

Bezpieczny wariant wymaga decyzji właściciela: wprowadzić `TransitionAuthority` do kontraktu kanonicznego `src`, następnie wygenerować wszystkie lustra i dodać testy konsumenta oraz zgodności typu. Do tej decyzji paczka nie integruje zmiany kontraktu.

## Tożsamość i dowody po rebase W66

- Exact base: `59a8c44c04`.
- Content tip przed dokumentami freeze: `e88085b785`.
- Gałąź: `codex/a-d3-debts-z64-20260914`.
- Focused D-3: **12 plików / 59 testów PASS**, każdy plik osobno, `--retry=0`.
- P1 + Z-64 UI: **16/16 PASS** (4 + 4 + 1 + 7).
- Z-64 RealPG: **15/15 PASS**, `MOCK_DB=false`, PostgreSQL `127.0.0.1:6454`.
- Dodatkowe My Work Day222: **5/5 PASS** z `DB_TYPE=postgres`; RealPG day140/day148/day155 zakończone kodem 0, day155 2/2.
- Server TypeScript: **0 błędów**. Frontend TypeScript: **177 błędów**, identycznie jak zmierzona podłoga linii; brak delty paczki.
- Esbuild per dotknięty plik produkcyjny: **4/4 PASS** po rebase W66.
- `contractMirrorDrift`: **4 FAIL / 3 PASS**, jawny STOP właściciela opisany wyżej.
- `ideaTools.controlEnumeration`: osobny, zastany dług snapshotów harnessu; pomiar 5 FAIL / 2 PASS / 1 SKIP. Nie zmieniono snapshotów ani produktu poza zaakceptowanym zakresem P1/My Work.
- Zrzut: `evidence/d3-z64/screens/pmo-stage-gate-pl-360-light.png` (66 KiB) i receipt JSON.
- Migracje: brak. Deploy/integracja: brak. P-T13: nietknięte.
- Independent review: **NOT_RUN** — wykona inny agent.
