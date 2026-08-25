# Interview exact-SHA browser evidence — 2026-08-25

## Qualification boundary

- Candidate: `0050bad8f1c0a9474a11a1f52a6193b2f90a6a69` (branch `codex/mod05-interview-20260825`).
- Dirty fingerprint at runtime start: empty-tree SHA-256 `e3b0c442...b855` (clean checkout).
- Local owner-review runtime: client `4480`, server `4481` (one-shot Docker Postgres, `pgvector/pgvector:pg16`, container `consultify-int-runtime-pg-20260825`).
- Database: `consultify_w3_interview_owner_20260825`, fully forward-migrated (`834` source migrations, application and SQL migration gates `ok`).
- Fixture: `W3-INTERVIEW-OWNER-v1` seeded with `server/scripts/seed-wave3-interview-owner-review.ts seed` against a freshly created base organization/owner (`a5000000-…-0001` / `a5000000-…-0011`, since the script requires a pre-existing org+owner and defaults to a different long-lived identity). FINAL manifest and durable SQL marker (`wave3_owner_fixture_markers`) verified by `scripts/dev/start-wave3-owner-runtime.mjs start` before the browser was opened.
- Additional local-only rows (not part of the official fixture script, added directly by SQL after the FINAL marker was recorded, following the column/status pattern proven in `server/src/scripts/t01InterviewRealDbProof.ts`) so all 6 tabs have data:
  - `organization_members` row (OWNER/ACTIVE) — required by `AuthController` login membership gate; without it login fails with `ORG_MEMBERSHIP_REVOKED`.
  - one `interview_insights` row ("Wnioski") linked to the seeded review session.
  - one `initiatives` row with `source_type='interview_insight'`, `source_id=<insight id>` ("Inicjatywy").
- Auth boundary: no E2E mode and no test auth/gateway/support bypass (`ENABLE_TEST_AUTH_BYPASS=false`, `E2E_MODE=false`). Logged in as the seeded owner via the real login form.
- Railway and production were not touched. Ports `4480`/`4481` only; the protected/shared ports (3940/3941/4363/4364, and 3987 per session instruction) were never used.

Runtime receipt: `/tmp/consultify-wave3-runtime-manifest-int-20260825.json`. Fixture receipt: `/tmp/consultify-wave3-interview-manifest-20260825.json`. Both intentionally not copied into the repo (local machine coordinates). This index records only non-secret qualification facts.

## Captured surfaces

All screenshots are 1440×900, captured with Playwright (Chromium) against the qualified runtime above, logged in as `w3.interview.owner@local.test`. Language: PL (account-level preference, persists across sessions). Theme switched via the in-app profile menu (`Ciemny`/`Jasny`), not OS `prefers-color-scheme`.

| Evidence | SHA-256 | Result |
|---|---|---|
| `01-inbox-dark.png` / `01-inbox-light.png` | `4e7123c3…dd92eb0b` / `cb25d813…4e21fd36` | Inbox tab (①), 2 assignment rows, StandardTable, status chips render correctly in both themes. |
| `02-sesje-dark.png` / `02-sesje-light.png` | `24b8e0d4…7262704ce` / `d15faff5…1423f60` | Sesje tab (②), 2 sessions ("W trakcie" 0%, "Wysłany" 100%). |
| `03-przydzielone-dark.png` / `03-przydzielone-light.png` | `c84005e3…76370f6` / `a7ad7440…9da095fef` | Przydzielone tab (manager view), same 2 assignments with assignee/status/progress columns. |
| `04-szablony-dark.png` / `04-szablony-light.png` | `37e3e5fa…f2f0beef` / `f837e802…f4fed3cb` | Szablony tab, 19 templates (18 pre-existing standard templates + the 1 seeded "Diagnoza jakości przekazania klienta do wdrożenia", 4 usages). |
| `05-wnioski-dark.png` / `05-wnioski-light.png` | `0635bb8b…dace62c75` / `d35326ed…590b1224` | Wnioski tab, 1 insight ("Przekazanie klienta ze sprzedaży do…", status Gotowe, źródło "1 Sesja"). |
| `06-inicjatywy-dark.png` / `06-inicjatywy-light.png` | `453f82e6…25dd7d6ef` / `2414f2f0…1ba83aa00` | Inicjatywy tab, 1 initiative ("Wprowadzić bramkę gotowości przekazania kli…", status Szkic, źródło "Insight"), proving the Wnioski → Inicjatywy lineage renders end-to-end. |
| `07-redirect-discovery.png` | `095dc732…25304455` | `page.goto('/discovery')` resolves to `page.url() === '.../interview'` (Inbox). Confirmed via captured `page.url()`, not just visual breadcrumb. |
| `08-redirect-project-intelligence.png` | `7c7bbcc6…3a591ad57` | `page.goto('/project-intelligence')` resolves to `page.url() === '.../interview'` (Inbox), same as above. |
| `09-kebab-sesje.png` | `8634459b…761ba2b1d` | Row kebab (Akcje wiersza) open on a Sesje row: Przypomnij / Otwórz podgląd / Archiwizuj / Odłóż termin / Usuń. |
| `10-kebab-inicjatywy.png` | `b0c5c11b…e780c3a1e` | Row kebab open on the Inicjatywy row: Wyślij do przeglądu / Otwórz w module Initiatives / Otwórz podgląd. Same menu shell/shape as `09-kebab-sesje.png` (REC-INT-005 — table and card share the same row-menu builder). |
| `11-preview-sesja.png` | `6cf03ad8…8f77d993` | Right preview panel opened on a Sesje row: header, meta chips, "PRZEBIEG" facts table, AI strip (Podsumuj/Ryzyka/Następne kroki), "POWIĄZANIA" relations, overflow actions — REC-INT-006 footer present. |
| `12-preview-inicjatywa.png` | `7a566617…30cb6aa692` | Right preview panel opened on the Inicjatywy row: same shell plus the dedicated `InterviewInitiativePreviewFooter` action pills ("Wyślij do przeglądu", "Otwórz dokument inicjatywy") and a "Powiązania" chip back to the source Wniosek — REC-INT-006 footer present, but see defect `INT-C05-A` below. |
| `13-discovery-canvas.png` | `4944ac69…4301c5548` | `/discovery/canvas` still renders as its own screen ("Konsultant Discovery" 4-quadrant board), independent from `/interview` — proves the `/discovery` redirect only affects the bare route, not the canvas sub-route. |

## Gate result

`TECHNICAL EXACT-SHA PASS`

All 6 Interview tabs render with real seeded data in both themes at 1440px, both `/discovery` and `/project-intelligence` redirect to `/interview` (proven by `page.url()`, not just a visual guess), the Sesje and Inicjatywy row kebabs share the same menu shell (REC-INT-005), the preview panel opens with a footer on both a session and an initiative (REC-INT-006), and `/discovery/canvas` still works as an independent screen. Owner acceptance is not claimed — this is a technical evidence pass only, per session instructions.

### Defect found by browser replay

1. `INT-C05-A` — In the Inicjatywy preview footer (`12-preview-inicjatywa.png`), the "Otwórz dokument inicjatywy" pill button's label wraps to 3 lines at 1440×900 and is clipped by the panel/viewport: the first line ("Otwórz") overlaps the pill's rounded top edge and the third line ("inicjatywy") is cut off entirely. The "Wyślij do przeglądu" pill next to it wraps cleanly to 2 lines. Component: `src/components/Interview/InterviewInitiativePreview.tsx` (`InterviewInitiativePreviewFooter`, `onOpenInModule` button). Needs either a shorter label or a pill layout that reserves enough height for 3 lines before shipping this footer to the owner.

### Not exercised in this pass (out of scope for this evidence capture)

- Actually clicking through the kebab actions (Przypomnij/Archiwizuj/Wyślij do przeglądu/etc.) — only the open-menu state was captured, per the session's ask ("Menu wierszy (kebab otwarty)").
- The respondent-side `/interview/respond/:token` single-question runtime (public/anonymous session) — out of scope for this owner-review acceptance pass, which is about the manager surfaces of `/interview`.
