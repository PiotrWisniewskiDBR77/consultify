# Final Implementation Contract — Excele (Position 23/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (shared-sourced contract; KIMI reference missing)

## 1. Executive summary
- **Intent**: 100% KIMI: split-screen chat↔excel; generuj/edytuj; zapis do Outputs opcjonalny; zero zgadywania bez referencji KIMI.
- **Primary users**: użytkownicy pracujący na workbook-like artefakcie + chat.
- **Success metric**: realny governed `Sheet` artifact lifecycle + (osobno) KIMI-style split-screen UX/flow udowodniony referencją.

## 2. Scope
### 2.1 In-scope
- `Sheet` jako trwały artefakt: create/materialize → persist → list/open → reopen (honest) → export.
- Split-screen chat↔excel tylko na podstawie referencji KIMI (bez zgadywania).

### 2.2 Out-of-scope / non-goals
- Excel/Google Sheets parity (wprost non-goal w planie `Sheet`).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Shared source plan: `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SHEET_2026-03-29.md`
- Related: `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_AGENTS_KIMI_PROMPTS_PALANTIR_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
- **Workbook expectation class**: `Microsoft Excel`, `Google Sheets` (w planie jako explicit non-goal parity; to nadal benchmark oczekiwań użytkownika).
- **Primary KIMI UX**: `KIMI` — **missing input**: brak zlinkowanych referencji split-screen zachowania.

## 5. Evidence plan (DoD)
- Acceptance: `Sheet` ma uczciwy kontrakt i działa end-to-end; KIMI-style split-screen nie jest implementowany bez referencji.
- Evidence: staging demo `Sheet` lifecycle + (po dostarczeniu referencji) staging demo split-screen + testy.

