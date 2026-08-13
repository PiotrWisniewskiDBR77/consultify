## Batch: src-and-server-src

- Candidate: exit=1 | Test Files  80 failed | 838 passed | 2 skipped (920) | Tests  275 failed | 13371 passed | 19 skipped | 8 todo (13673)
- Baseline:  exit=1 | Test Files  80 failed | 831 passed | 2 skipped (913) | Tests  275 failed | 13226 passed | 26 skipped | 8 todo (13535)

- introduced (fail in candidate, pass in baseline): 0
- fixed (pass in candidate, fail in baseline): 0
- identical_pre_existing (fail in both): 279

### identical_pre_existing (sample, up to 40)
- `server/src/__tests__/interviewAxisGapTemplates.e2e.test.ts` :: O5.6 — interview axis-gap templates migration (real SQL, in-memory sqlite) > reads the real migration file from server/migrations/
- `server/src/routes/__tests__/ai.routes.attachments-ingest.test.ts` :: POST /ai/attachments/ingest (file ingest) > rejects with 400 when no readable text can be extracted (empty file)
- `server/src/routes/__tests__/document-studio-client-reader.routes.test.ts` :: POST /api/document-studio/share-links/comments/list > lists existing threads for a comment-scope link, including a client-posted comment
- `server/src/routes/__tests__/document-studio-client-reader.routes.test.ts` :: POST /api/document-studio/share-links/comments/list > returns 403 for a read-scope link (no comment UI)
- `server/src/routes/__tests__/document-studio-client-reader.routes.test.ts` :: POST /api/document-studio/share-links/document > never leaks organizationId or internal-only schema fields
- `server/src/routes/__tests__/document-studio-client-reader.routes.test.ts` :: POST /api/document-studio/share-links/document > returns the whitelisted document projection for a read-scope link
- `server/src/routes/__tests__/document-studio-cross-org-idor.test.ts` :: Approvals — cross-org IDOR > GET /:artifactId/approvals does not leak the victim approval to the attacker
- `server/src/routes/__tests__/document-studio-cross-org-idor.test.ts` :: Approvals — cross-org IDOR > GET approval is 404 for a foreign tenant
- `server/src/routes/__tests__/document-studio-cross-org-idor.test.ts` :: Approvals — cross-org IDOR > cancel is 404 for a foreign tenant
- `server/src/routes/__tests__/document-studio-cross-org-idor.test.ts` :: Approvals — cross-org IDOR > record decision is 404 for a foreign tenant
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: GET /api/document-studio/:artifactId/share-links — list > lists tenant-scoped active links with runtimeStatus decoration
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: GET /api/document-studio/share-links/:shareLinkId — get one > returns 200 with runtimeStatus for an existing link
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: GET /api/document-studio/share-links/:shareLinkId/audit > returns 404 cross-tenant (no audit leakage)
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: GET /api/document-studio/share-links/:shareLinkId/audit > returns the full audit trail for a tenant-owned link
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: POST /api/document-studio/:artifactId/share-links — create > mints a share link with default `read` scope and returns 201
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: POST /api/document-studio/:artifactId/share-links — create > returns 400 on a past expiresAt
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: POST /api/document-studio/:artifactId/share-links — create > returns 503 and does not publish a token when durable creation is not confirmed
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: POST /api/document-studio/share-links/:shareLinkId/revoke > flips status to revoked
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: POST /api/document-studio/share-links/:shareLinkId/revoke > returns 404 cross-tenant
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: POST /api/document-studio/share-links/:shareLinkId/revoke > returns 503 and keeps the link active when durable revoke is not confirmed
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: POST /api/document-studio/share-links/:shareLinkId/rotate > returns 409 for revoked links
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: POST /api/document-studio/share-links/:shareLinkId/rotate > returns 503 and leaves the old token valid when rotation persistence fails
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: POST /api/document-studio/share-links/:shareLinkId/rotate > rotates token and invalidates the previous token immediately
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: POST /api/document-studio/share-links/edit-session + public edit comments > allows edit-session + anonymous comment mutation for comment scope
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: POST /api/document-studio/share-links/edit-session + public edit comments > creates edit session and allows anonymous comment mutation for edit scope
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: POST /api/document-studio/share-links/edit-session + public edit comments > rejects edit session for view-only scopes (read / download)
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: POST /api/document-studio/share-links/resolve — public consume > resolves a valid token without authentication
- `server/src/routes/__tests__/document-studio-share-links.routes.test.ts` :: POST /api/document-studio/share-links/resolve — public consume > returns 404 for a revoked token
- `server/src/routes/__tests__/initiative-controller-interview-insight.test.ts` :: InitiativeController interview insight lineage > persists action contract, source pack, and evidence refs on create
- `server/src/routes/__tests__/initiatives-crud.test.ts` :: initiatives CRUD routes > POST / creates an initiative (200)
- `server/src/routes/__tests__/initiatives-crud.test.ts` :: initiatives CRUD routes > POST / is ALLOWED for delivery/staff roles (PROJECT_MANAGER) — not a pilot respondent
- `server/src/routes/__tests__/m13-mass-assignment.test.ts` :: M13 mass-assignment — V-1: generic update cannot jump status > PATCH /:id with {status: APPROVED} routes to the gated status handler
- `server/src/routes/__tests__/presentationAutosaveTitlePersistence.test.ts` :: presentation autosave title persistence > reads the existing title and writes the edited title in the CAS update
- `server/src/routes/__tests__/presentationCustomTemplateContract.test.ts` :: presentation template custom master persistence wiring > deletes only organization-owned drafts and fails closed on lifecycle changes
- `server/src/routes/__tests__/presentationCustomTemplateContract.test.ts` :: presentation template custom master persistence wiring > merges custom contract updates without dropping color-template metadata
- `server/src/routes/__tests__/presentationCustomTemplateContract.test.ts` :: presentation template custom master persistence wiring > persists the custom contract when a template is created
- `server/src/routes/__tests__/presentationCustomTemplateContract.test.ts` :: presentation template custom master persistence wiring > validates a custom contract again before approval
- `server/src/routes/__tests__/presentationPptxDownloadCurrentExport.test.ts` :: GET /decks/:id/download — current PPTX contract > attempts current-version rendering even when export_path is absent
- `server/src/routes/__tests__/presentationPptxDownloadCurrentExport.test.ts` :: GET /decks/:id/download — current PPTX contract > fails closed with a stable code and sends only the ensured current path
- `server/src/routes/__tests__/presentationPptxDownloadCurrentExport.test.ts` :: GET /decks/:id/download — current PPTX contract > records an export rejected by limits as failed, never completed
- ... and 239 more

