-- =====================================================================
-- 20261122_consultant_org_links_table.sql
-- =====================================================================
-- POWOD POWSTANIA
--   DEC-116 (fresh-DB schema gap audit) sklasyfikowal `consultant_org_links`
--   jako NO_MIGRATION, uzywane w server/src/middleware/orgContext.middleware.ts
--   (fallback po nieudanym sprawdzeniu organization_members — konsultant z
--   dostepem do wielu organizacji bez bezposredniego czlonkostwa) oraz w
--   server/src/services/consultantService.ts (CRUD linku).
--
-- WERDYKT: NIEJEDNOZNACZNY — DECYZJA_WLASCICIELA POTRZEBNA (patrz raport),
--   ALE schemat dopisany teraz jako bezpieczny, addytywny krok NIEZALEZNY od
--   tej decyzji:
--   Sygnaly za MARTWA: jedyny DDL dla tej tabeli lezal w
--   server/migrations/never-ran/017_consultant_mode.sql.sql (katalog
--   deliberately nigdy nie uruchamiany); jedyny writer,
--   consultantService.ts (create/update/revoke linku), ma ZERO importerow w
--   calym server/src — zadna trasa nigdy nie tworzy wiersza; pole
--   isConsultant/linkId zwracane przez resolveUserOrgAccess ma ZERO
--   konsumentow ponizej middleware; kod produktu w innym miejscu wprost mowi
--   "multi-organization support is not yet available"
--   (server/src/controllers/InvitationController.ts:65,
--   server/src/services/invitationService.ts:650).
--   Sygnaly za ZYWA/niedokonczona: dedykowane testy integracyjne na realnej
--   (samodzielnie tworzonej) tabeli — tests/unit/backend/middleware/
--   orgContext.middleware.test.ts ("supports consultant access via
--   consultant_org_links", "resolveUserOrgAccess returns consultant access
--   when ACTIVE link exists") i tests/unit/backend/
--   orgContextMembershipStatus.test.ts — sugeruja swiadome zaprojektowanie
--   logiki dostepu, ktoremu brakuje wylacznie migracji + trasy tworzacej
--   link, nie porzucenie koncepcji.
--   Ta migracja NIE rozstrzyga tej decyzji produktowej i NIE zmienia
--   zadnego zachowania dzis: bez trasy tworzacej wiersz tabela pozostaje
--   pusta, wiec resolveUserOrgAccess nadal zwraca { allowed: false } dla
--   kazdego uzytkownika bez bezposredniego czlonkostwa — dokladnie jak dzis
--   (gdzie brak tabeli byl cicho tlumiony przez dbGet(fallback:true) do
--   null). Zamyka wylacznie techniczny dlug schematu i usuwa MASKOWANIE
--   (dzis: brak tabeli = cichy null zamiast widocznego bledu schematu).
--
-- SCHEMAT WYPROWADZONY Z UZYCIA W KODZIE
--   Kolumny z zapytan w server/src/middleware/orgContext.middleware.ts
--   (SELECT col.id, col.permission_scope, col.status ... WHERE
--   col.consultant_id = ? AND col.organization_id = ? AND UPPER(col.status)
--   = 'ACTIVE') oraz server/src/services/consultantService.ts (SELECT *,
--   INSERT ...(id, consultant_id, organization_id, created_by_user_id,
--   permission_scope, status), UPDATE ... SET status/permission_scope,
--   SELECT ... l.created_at as linked_at ORDER BY l.created_at DESC).
--   `role_in_org` z never-ran/017 swiadomie POMINIETY — zaden fragment kodu
--   go nie czyta ani nie pisze.
--
-- KLUCZE OBCE
--   consultant_id -> users(id): w orgContext.middleware.ts porownywany
--   bezposrednio z userId (nie ma osobnej tabeli "consultants" w tej
--   sciezce) — text PK istnieje na users.
--   organization_id -> organizations(id): text PK istnieje.
--   UWAGA (osobne, nie-blokujace znalezisko przy okazji): w repo istnieje
--   TAKZE inna, niezwiazana tabela "consultants" (organization_id, user_id,
--   specialization, hourly_rate, ...) uzywana przez
--   server/src/routes/consultants.routes.ts, ORAZ trzeci, niekompatybilny
--   schemat tej samej nazwy "consultants" (id=user_id, display_name, status)
--   pisany przez consultantService.ts:ensureConsultant. Kolizja nazw dwoch
--   niezgodnych producentow tej samej tabeli — poza zakresem tego pliku
--   (nie dotyczy consultant_org_links), zgloszone osobno.
--
-- BEZPIECZENSTWO: wylacznie CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT
--   EXISTS. Zero DROP/ALTER TYPE, zero INSERT/seed.
-- =====================================================================

CREATE TABLE IF NOT EXISTS consultant_org_links (
    id                  TEXT PRIMARY KEY,
    consultant_id       TEXT NOT NULL REFERENCES users(id),
    organization_id     TEXT NOT NULL REFERENCES organizations(id),
    created_by_user_id  TEXT,
    permission_scope    TEXT,
    status              TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- orgContext.middleware.ts resolveUserOrgAccess + consultantService.ts
-- verifyAccess/ensureLink: WHERE consultant_id = ? AND organization_id = ?
CREATE INDEX IF NOT EXISTS idx_consultant_org_links_consultant_org
    ON consultant_org_links(consultant_id, organization_id);
-- consultantService.ts getLinkedOrganizations: WHERE consultant_id = ? AND
-- status = 'ACTIVE' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_consultant_org_links_consultant_status
    ON consultant_org_links(consultant_id, status, created_at DESC);
-- admin/lookup by organization (mirrors never-ran/017's idx_consultant_links_org)
CREATE INDEX IF NOT EXISTS idx_consultant_org_links_org
    ON consultant_org_links(organization_id);
