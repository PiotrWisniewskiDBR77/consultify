# Materials — build log

## 2026-08-28 — Day 61 replay na markerze f87043a

- Seeder po naprawie zaakceptował jawnie potwierdzoną lokalną bazę i utworzył personę OWNER oraz pełny DOC/PPT/XLSX/template fixture; odczyt potwierdził `2/1/1/1/1` głównych rekordów.
- Runtime został przyjęty fail-closed na SHA `f87043a9412d6f208f99bd0b5c7e23bce4d01c4d`, PG `5933`, server `4391`, klient `3991`, 862 migracje i zielone readiness.
- Wykonano 32 końcowe zrzuty (8 ekranów × 2 motywy × pusty/pełny), kebab i podgląd; każdy ekran przeszedł przez prawdziwy Gateway i lokalną DB bez auth bypass.
- Siedem nazwanych odczytów HTTP zwróciło 200. Produkcyjna kompilacja serwera i build frontu zakończyły się kodem 0.
- Znalezisko: niepełna polonizacja widoczna w rejestrach, podglądzie i builderach. Nie naprawiano jej w dyżurze odbiorczym; została przekazana do G11–G20.
- Wynik: G07–G10 mają kompletny pakiet techniczny do odbioru właściciela; nie oznacza to jeszcze `CLOSED_FINAL`.

## 2026-08-28 — Day 61 owner review G07–G10

- Marker/HEAD at review start: `5e30cb9bf66c8e75481ba723debdd04f3c1a6893`.
- Reviewed: exact routing, five mounted registry tabs, full-card routes for document/presentation/workbook, fresh PostgreSQL migrations, no-send boundary, guarded owner seeder, minimal real Gateway, anonymous HTTP boundary and visible browser render.
- Worked: bound-instruction integrity checks; isolated worktree; PostgreSQL 16 on `127.0.0.1:5933`; migrations twice (`0`, `0`, second run `Applying migrations: 0`); minimal `ApiGateway.getInstance().initializeRoutes(app)` plus frontend on `3991`; `/presentations` HTML `200`; anonymous `/api/artifacts` `401`; outbox sample counts `0`.
- Broke: required seeder rejected the prescribed `consultify_day61_materials_review` name (`exit 1`), therefore it created neither the required review data nor a usable review persona. Browser consequently rendered `/login?redirect=%2Fpresentations`, not Materials.
- Owner/supervisor decision needed: choose one canonical contract—either authorize a database name matching `consultify_w3_materials_owner_*`, or provide a marker where the existing seeder accepts the mandated Day 61 database name. No code fix was attempted.
- Result: G07 `PARTIAL`; G08 `STOP_RENDER_BLOCKING`; G09 `STOP_AUTH_FIXTURE_MISSING`; G10 `STOP_FULL_STATE_UNAVAILABLE`. G11–G20 unchanged.
- Report: `../../codex/CODEX_DAY61_MATERIALS_OWNER_REVIEW_REPORT.md`.
- Commit SHA: commit containing this log; returned in the Day 61 handoff.
