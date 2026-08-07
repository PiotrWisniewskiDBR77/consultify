# Consultify Documents/Templates — runtime checkpoint 2026-08-07

## Recovery point

- Working branch: `codex/documents-suite-v2-resume-20260807`
- Base/deployed commit: `c4046b711b3f0104f6e02824e70566eecfffd558`
- Worktree used in this task: `/private/tmp/consultify-suite-v2-resume.20260807`
- Main checkout was intentionally not modified because it contains extensive unrelated changes.

## Work completed in this continuation

### Excel runtime acceptance

Created a fresh manual workbook through Materials -> Sheets -> New sheet -> Czysto.

- Artifact: `0b44c3cc-bcca-480c-a252-a117d64bf5ad`
- URL: `https://demo.consultify.ai/excele?artifactId=0b44c3cc-bcca-480c-a252-a117d64bf5ad`
- Entered A2 `Kategoria`, B2 `Wartość`, A3 `Plan`, B3 `-100`.
- Conditional formatting for negative values rendered with the expected danger fill and bold text.
- Hide/unhide row worked and was verified from the live DOM.
- Hide/unhide column worked and was verified from the live DOM.
- Values and conditional formatting survived full page reload.
- Runtime exposed a real merge gap: the command persisted but the grid did not render merged cells, and selecting the anchor then clicking Unmerge sent only the anchor range.

### Excel merge repair implemented

Changed:

- `src/components/AIChat/KimiWorkspace/EditableSpreadsheetGrid.tsx`
- `src/components/AIChat/KimiWorkspace/__tests__/EditableSpreadsheetGrid.manual.test.tsx`

The grid now parses persisted `sheet.merges`, renders the anchor with real `rowSpan`/`colSpan`, omits covered cells, recognizes a merge intersecting the current selection, and sends the full persisted range when unmerging from the anchor.

Validation:

- `npx vitest run src/components/AIChat/KimiWorkspace/__tests__/EditableSpreadsheetGrid.manual.test.tsx` -> **16/16 PASS**.
- `npm run build` -> **PASS**.
- `git diff --check` -> **PASS**.
- This patch still needs deploy and repeat runtime acceptance after restart.

### Word runtime acceptance

Created a fresh blank Document Studio document.

- Artifact route: `https://demo.consultify.ai/document-studio/artifact-4fbc30bb-ff8d-4984-8c56-b781859ff495`
- Inserted a quote manually: `Transformacja działa wtedy, gdy decyzje mają właścicieli i terminy.`
- Quote source: `PMO Consultify`.
- Inserted a chart manually: `Realizacja kamieni milowych` with `Plan|21;Zrealizowane|18;Ryzyko|3`.
- UI showed `Zapisano` and three blocks.
- Quote, source, chart title and block count all survived a full page reload.

### PowerPoint template deletion acceptance

- Created disposable draft template `QA DELETE 2026-08-07` in Deck Template Architect.
- Accessible `Delete draft template?` modal appeared with explicit irreversible-action warning.
- Confirming `Delete draft` removed the draft and closed the dialog.
- Selected approved `Assessment Summary`; it exposed no `Delete draft` button and only the governed `Deprecate` action.

### Canonical Materials library blocker diagnosed

The Documents, Presentations, Sheets and Template Library hub lists show canonical-source errors even though direct editors/builders work.

Railway demo logs proved that the requests reach the server but return **404**:

- `GET /api/artifacts?outputType=report&limit=200` -> 404
- `GET /api/artifacts?outputType=presentation&limit=200` -> 404
- `GET /api/artifacts?outputType=sheet&limit=200` -> 404
- template variants using `artifactFamily=template` -> 404

This is not an empty database condition and not a frontend mapping issue. The canonical `/api/artifacts` GET route is absent/not mounted in the deployed demo runtime (or its route contract differs). The direct PowerPoint template registry `/api/presentations/templates` works.

## Immediate continuation order

1. Commit/push this checkpoint and Excel merge patch.
2. Inspect mounting/registration of the canonical artifacts router in server bootstrap and its GET collection route.
3. Add a route integration test reproducing authenticated `GET /api/artifacts?...` rather than hiding 404 in the frontend.
4. Fix, run focused backend tests + build, deploy to Railway environment `demo`, and verify `/api/artifacts` no longer returns 404 in logs/UI.
5. Repeat Excel merge/unmerge on the live workbook after deploy.
6. Continue template-to-artifact acceptance for Word/Excel/PPT and the nine curated templates/six output artifacts objective.

## Deployment facts

- Railway project: `consultify`, project id `a6d59e88-263d-45f3-96bc-861f66bf467b`.
- Demo environment id: `a257fce9-33f0-4e10-8e7c-a9cec472f377`.
- Service: `consultify`, service id `8f65b820-3d55-4dd9-8076-929d01cc4157`.
- Current demo deployment before this patch: `49aa21fd-3ee0-4ca1-af51-da80553c5b15`, SUCCESS.

## Safety/invariants

- Do not reset, clean, stash or overwrite the main checkout.
- Do not treat unit tests as a replacement for real deployed UI acceptance.
- Do not re-create the deleted QA template unless needed for another disposable acceptance run.
- Browser footer build `DEMO @97a42e810bc1` is stale and is not a trustworthy deployment identifier; use Railway deployment ids.
