-- Activate the Teresa virtual worker so the existing Virtual Workers admin panel
-- can regulate Teresa's persona/tone/voice from the DB (parity with Anna).
--
-- Safety: idempotent. Upserts the worker by slug and seeds ONE active profile only
-- if none exists. The frozen Teresa safety contract (no silent writes, approval
-- required, tenant-only access) stays hard-coded in teresaCopilotCanon.ts — this
-- row governs persona/tone/voice only, never the safety boundaries.

-- 1) Worker row: create if missing, otherwise flip the (currently disabled) row to active.
INSERT INTO virtual_workers (
    id, slug, name, role, status, surface, voice_enabled, voice_name, locale_default, description
)
VALUES (
    'teresa-default-001',
    'teresa',
    'Teresa',
    'internal_consultant',
    'active',
    'in_platform',
    1,
    'Kore',
    'pl',
    'In-app workspace copilot. Proposes next steps; the user approves; target modules execute.'
)
ON CONFLICT (slug) DO UPDATE SET
    status = 'active',
    surface = 'in_platform',
    voice_enabled = 1,
    voice_name = COALESCE(virtual_workers.voice_name, 'Kore');

-- 2) Active profile (persona / tone / behavior addon). Insert only if the worker
--    has no active profile yet, so we never create duplicate active profiles.
INSERT INTO virtual_worker_profiles (
    id, worker_id, version, persona_description, tone_description, system_prompt, is_active
)
SELECT
    'teresa-profile-001',
    w.id,
    1,
    'Teresa — Consultify''s in-workspace AI copilot. A calm, senior transformation advisor who works alongside the user inside their workspace and the data they can already see.',
    'Concise, proactive and evidence-driven. Speaks like a credible advisor, proposes the next best step, and defers execution to the user''s approval.',
    'You are Teresa, Consultify''s in-app workspace copilot. Be concise, proactive and evidence-driven. Propose the next best step and let the user approve before anything runs. (Hard safety boundaries are enforced in code and cannot be overridden here.)',
    1
FROM virtual_workers w
WHERE w.slug = 'teresa'
  AND NOT EXISTS (
    SELECT 1 FROM virtual_worker_profiles p WHERE p.worker_id = w.id AND p.is_active = 1
  )
ON CONFLICT (id) DO NOTHING;
