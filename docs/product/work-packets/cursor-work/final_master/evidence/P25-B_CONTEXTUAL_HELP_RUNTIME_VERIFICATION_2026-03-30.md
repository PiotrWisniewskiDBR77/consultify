## P25-B — Contextual help runtime verification (evidence-first)

Date: 2026-03-30  
Packet: `P25-B`  
Branch: `ws/c-artifact-evidence`

## Evidence ledger row (SSOT)
- `docs/product/work-packets/cursor-work/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_25_HELP_2026-03-29.md` → section “## 10. Evidence ledger” → row `P25-B`

## Scope (bounded)
- Entry points (primary): `Tools`, `Interview`, `Results/Outputs`
- Flow: entry point → Help opens with captured context → search → open article → next-action routing back to the correct surface
- Degraded modes (explicit): missing article → explicit degraded + “Search help”; missing PL translation → explicit banner “Brak wersji PL — wyświetlamy EN” + EN content
- Recommendation closure (API): `help-reco-v1` payload (`context` → `article_id[]` → `rationale`) for Teresa/Anna grounding + deep-linking

## Assumptions / constraints
- E2E uses Playwright smoke config and existing authenticated `storageState`.
- KB seed content for P25-B primers exists via migration `server/migrations/20260330_p25b_kb_next_action_and_primers.sql`.
- Deep-link contract: query params `help_article`, `help_module`, optional `help_tab`; should open Help and then remove params from the URL.

## Integration tests plan (Playwright)

### A) Entry points → search → article → next action routing (3 surfaces)
- **Tools** (`/discovery-tools`)
  - Click `data-testid="contextual-help-entry-tools"`
  - Assert Help Knowledge search visible (`data-testid="help-knowledge-search"`)
  - Search `P25-B`, open primer card `data-testid="help-article-card-p25b-tools-primer"`
  - Assert next action button visible (`data-testid="help-next-action"`) and routes back to `/discovery-tools`

- **Interview** (`/interview`)
  - Click `data-testid="contextual-help-entry-interview"`
  - Search `P25-B`, open `p25b-interview-primer`
  - Next action routes back to `/interview`

- **Outputs** (`/presentations`)
  - Click `data-testid="contextual-help-entry-outputs"`
  - Search `P25-B`, open `p25b-outputs-primer`
  - Next action routes back to `/presentations`

### B) Degraded: missing article deep-link
- Navigate to `/discovery-tools?help_article=does-not-exist&help_module=discovery-tools`
- Assert explicit degraded copy “Article not found”
- Assert CTA “Search help” exists (button)

### C) Degraded: PL missing translation → explicit EN fallback
- In PL locale (`pl-PL`), open Help from Tools entrypoint
- Search `P25-B`, open EN-only article `p25b-en-only`
- Assert banner `Brak wersji PL — wyświetlamy EN`
- Assert EN content visible (e.g. “EN-only article”)

## Unit tests plan (backend)
- `GET /api/v8/help/recommendations` returns `help-reco-v1` payload with:
  - `context` echoing query params
  - `recommendations[]` using KB contextual articles as `article_id` (slug)
  - `rationale` containing both `pl` and `en`

## Staging proof script (manual, click-by-click)

### Preconditions
- Deploy branch `ws/c-artifact-evidence` to staging.
- Ensure migrations ran (KB primers exist; `next_action` column exists).
- Know how to switch locale PL/EN in app (Settings → Language or existing in-app switch).

### Proof 1 — Tools surface (EN)
- Go to `Tools` (`/discovery-tools`)
- Click `Help / Contextual help` entry point (topbar)
- In Help (Knowledge):
  - Search `P25-B`
  - Open article `Tools — start here (P25-B)` (`p25b-tools-primer`)
  - Click **Next action** → verify route returns to `/discovery-tools`

### Proof 2 — Interview surface (EN)
- Go to `Interview` (`/interview`)
- Click entry point
- Search `P25-B` → open `p25b-interview-primer`
- Click **Next action** → verify route returns to `/interview`

### Proof 3 — Outputs surface (EN)
- Go to `Results/Outputs` (`/presentations`)
- Click entry point
- Search `P25-B` → open `p25b-outputs-primer`
- Click **Next action** → verify route returns to `/presentations`

### Proof 4 — PL/EN posture: explicit degraded + EN fallback
- Switch locale to **PL**
- Go to Tools (`/discovery-tools`)
- Open Help, search `P25-B`, open `p25b-en-only`
- Verify banner: **“Brak wersji PL — wyświetlamy EN”**
- Verify content is EN

### Proof 5 — Teresa/Anna guidance deep-link (runtime)
- Use a runtime link format in any surface (or paste in address bar):
  - Example: `/discovery-tools?help_article=p25b-tools-primer&help_module=discovery-tools`
- Verify Help opens directly to that article, then URL params are cleared after processing.

# P25-B — Contextual help entry points + recommendation closure (runtime verification)

Date: 2026-03-30  
Packet: `P25-B`  
Branch: `ws/c-artifact-evidence`

## Evidence ledger row (SSOT)
- `docs/product/work-packets/cursor-work/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_25_HELP_2026-03-29.md` → section “## 10. Evidence ledger” → row `P25-B`

## Scope (bounded)
- Entry points: `Tools`, `Interview`, `Results/Outputs`
- Flow: entry point → Help opens with captured context → search → open article → next-action routing back to correct surface
- Degraded: missing article + missing PL translation (explicit degraded + EN fallback)
- Recommendation payload: `help-reco-v1` (`context` → `article_id[]` → `rationale`) supports deep-linking for Teresa/Anna

## Integration test plan (must-pass)

### Surface #1: Tools → Help flow
- **Given** user is on `Tools` surface (any tool list or tool detail view)
- **When** user clicks `Help / Contextual help`
- **Then** Help opens with context `{ surface_id: "tools", module_id: "tools", locale }`
- **And** user can search, open an article, and run `next_action` which routes back to Tools (correct view)

### Surface #2: Interview → Help flow
- **Given** user is on `Interview` surface (interview list or detail)
- **When** user clicks `Help / Contextual help`
- **Then** Help opens with context `{ surface_id: "interview", module_id: "interview", locale }`
- **And** user can search, open an article, and run `next_action` which routes back to Interview (correct view)

### Surface #3: Results/Outputs → Help flow
- **Given** user is on `Results/Outputs` surface (Outputs/Reports/Presentations hub)
- **When** user clicks `Help / Contextual help`
- **Then** Help opens with context `{ surface_id: "results", module_id: "outputs", locale }` (or canonical mapping used in app)
- **And** user can search, open an article, and run `next_action` which routes back to Outputs (correct view)

### Regression: missing article → explicit degraded + safe recovery
- **Given** Help is asked to open a non-existent `article_id`
- **Then** UI shows explicit degraded state (no crash)
- **And** offers `Search help` and a link to overview article

### Regression: missing PL translation → explicit degraded + EN fallback
- **Given** user locale is PL
- **And** selected article has no PL translation (EN-only)
- **Then** UI shows explicit PL banner “Brak wersji PL — wyświetlamy EN”
- **And** renders EN content with visible EN labeling

## Tests to implement (repo)
- Add UI tests under `tests/` that drive the full flow for the 3 surfaces, plus the two regression cases above.
- Tests must assert:
  - context is captured into Help state/URL (surface/module/locale)
  - search returns language-labeled results
  - missing translation shows explicit degraded banner + EN content
  - next-action routing returns to correct surface

## Test command (fill after implementation)
- `pnpm test` (or project test runner) — **TODO: record exact command + output summary**

## Staging proof script (click-by-click)
1. Open **Tools** → click `Help / Contextual help` → search for “tools” → open primer article → click `Next action` → verify it routes back to Tools.
2. Open **Interview** → click `Help / Contextual help` → search → open article → click `Next action` → verify it routes back to Interview.
3. Open **Results/Outputs** → click `Help / Contextual help` → search → open article → click `Next action` → verify it routes back to Outputs.
4. Switch app language **PL ↔ EN**:
   - In PL, open an **EN-only** article → verify explicit PL degraded banner + EN content.
5. Teresa/Anna guidance proof:
   - Use guidance link (deep-link payload) that targets a known `article_id` and confirm it opens the correct article in Help with source-visible `article_id`.

## Evidence capture (fill during closeout)
- Tests: (command + pass summary)
- Staging: (screen/video link + what it demonstrates)
- Commit: (hash)

