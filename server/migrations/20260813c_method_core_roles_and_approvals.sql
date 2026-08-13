-- ═══════════════════════════════════════════════════════════════════════
-- S2 — Role/przypisania/zatwierdzenia przez HTTP (bez ręcznego SQL).
--
-- KOLEJNOŚĆ: nazwa zaczyna się od "20260813c_" — sortuje LEKSYKALNIE po
-- całej rodzinie "20260813_method_core_1..4_*.sql" (podkreślnik '_' < 'c'
-- w ASCII), więc method_sessions/method_session_roles/organizations już
-- istnieją, kiedy ten plik biegnie. Zobacz nagłówek
-- 20260813_method_core_1_kernel.sql po wyjaśnienie, dlaczego kolejność nie
-- jest ozdobą (instalacja od zera pada na producent-po-konsumencie).
--
-- Fully additive: tylko CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT
-- EXISTS. Zero DROP/ALTER/DELETE. Bezpieczne do wielokrotnego uruchomienia.
-- ═══════════════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------------------
-- method_session_role_events — append-only log dla "historia ról (kto,
-- kiedy, przez kogo, do kiedy)". method_session_roles (istniejąca tabela z
-- 20260813_method_core_1_kernel.sql) trzyma STAN BIEŻĄCY (current holders —
-- MethodSessionService.assignRole/revokeRole mutują ją: INSERT przy nadaniu,
-- DELETE przy odebraniu). Ta tabela nigdy nie jest UPDATE'owana ani
-- kasowana — odebranie roli DOPISUJE zdarzenie 'revoked', nigdy nie usuwa
-- zdarzenia 'assigned' które je poprzedziło (twarda reguła #5).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS method_session_role_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES method_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('assigned', 'revoked')),
  actor_user_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_method_session_role_events_session
  ON method_session_role_events(session_id);
CREATE INDEX IF NOT EXISTS ix_method_session_role_events_user
  ON method_session_role_events(user_id);

-- ---------------------------------------------------------------------------
-- method_approvals — ślad zatwierdzeń (approval trail), powiązany z
-- DOKŁADNĄ rewizją. "Rewizja" = `session_id` (kernel: `frozen -> active`
-- reopen zawsze produkuje NOWY wiersz method_sessions z nowym id — patrz
-- MethodSessionService.transition, gałąź `from === 'frozen' && to ===
-- 'active'`; ten sam session_id nigdy nie jest zamrażany dwa razy) —
-- co znaczy, że zapytanie "WHERE session_id = ?" o starą (zamrożoną)
-- rewizję z definicji nigdy nie zwróci zatwierdzeń nowej rewizji (twarda
-- reguła #4), bez dodatkowej logiki. `revision` dodatkowo zapisuje
-- `method_sessions.version` z chwili decyzji — dwie decyzje w tej samej
-- rewizji (np. send-back, potem po poprawkach approve) mają różne numery
-- wersji, więc trail jednoznacznie pokazuje KTÓRĄ treść zatwierdzono.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS method_approvals (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES method_sessions(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'sent_back')),
  comment TEXT,
  actor_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_method_approvals_session ON method_approvals(session_id);
