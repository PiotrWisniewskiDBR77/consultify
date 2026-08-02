-- MAT-007/009 fresh-DB guard (2026-08-02).
--
-- `audit_events` and `presentation_cards` are only defined inside
-- `20260719_baseline_gap.sql`, a ~27k-line consolidated baseline migration
-- that fails partway through on an UNRELATED statement
-- (`alter table "public"."ai_feedback" add column ...` — ai_feedback has
-- nothing to do with presentations) and rolls back as a single transaction,
-- taking every table it declared with it, including these two. On staging/
-- prod this is invisible because those tables already existed before this
-- baseline file was authored; on a from-scratch replay (`migrate.postgres.ts`
-- with no `--safe`) it means `audit_events` and `presentation_cards` never
-- exist. This is the same, already-established "FRESH-DB GUARD" pattern used
-- elsewhere for the identical problem (see `20260623_distribution_delivery.sql`
-- for `report_distributions`/`066_status_reports.sql`) — NOT a fix for the
-- underlying baseline_gap.sql / <500-legacy-filter issue itself, which is
-- repo-wide and out of scope for MAT-007/009.
--
-- `audit_events` is a hard MAT-007/009 requirement: `requireAudit` middleware
-- fails CLOSED (by design) when the table is missing, which 500s every
-- presentation create/share/revoke call on a from-scratch DB.
-- `presentation_cards` is the legacy mirror table the MAT-007 root-cause fix
-- (server/src/routes/presentations.routes.ts) writes to (best-effort,
-- non-fatal) alongside the canonical `deck_json` — included here so that
-- write no longer silently warns on a fresh DB either.
--
-- Column shapes copied verbatim from `20260719_baseline_gap.sql` (lines
-- ~2007 and ~7460) so this never diverges from what that file already
-- declares — CREATE TABLE IF NOT EXISTS makes this a no-op wherever
-- baseline_gap.sql (or staging/prod's pre-existing tables) already won.

create table if not exists "public"."audit_events" (
    "id" text not null,
    "ts" timestamp without time zone default CURRENT_TIMESTAMP,
    "actor_id" text,
    "actor_type" text not null default 'USER'::text,
    "org_id" text,
    "action" text not null,
    "resource_type" text,
    "resource_id" text,
    "before_json" text,
    "after_json" text,
    "metadata_json" text default '{}'::text,
    "ip" text,
    "user_agent" text
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'audit_events_pkey'
  ) then
    alter table "public"."audit_events" add constraint "audit_events_pkey" primary key ("id");
  end if;
end $$;

CREATE INDEX if not exists idx_audit_events_action ON public.audit_events USING btree (action);
CREATE INDEX if not exists idx_audit_events_actor ON public.audit_events USING btree (actor_id);
CREATE INDEX if not exists idx_audit_events_org ON public.audit_events USING btree (org_id);
CREATE INDEX if not exists idx_audit_events_resource ON public.audit_events USING btree (resource_type, resource_id);
CREATE INDEX if not exists idx_audit_events_ts ON public.audit_events USING btree (ts);

create table if not exists "public"."presentation_cards" (
    "id" text not null,
    "deck_id" text not null,
    "card_index" integer,
    "intent" text,
    "blocks_json" text,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone default CURRENT_TIMESTAMP
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'presentation_cards_pkey'
  ) then
    alter table "public"."presentation_cards" add constraint "presentation_cards_pkey" primary key ("id");
  end if;
end $$;

CREATE INDEX if not exists idx_presentation_cards_deck ON public.presentation_cards USING btree (deck_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'presentation_cards_deck_id_fkey'
  ) and exists (
    select 1 from information_schema.tables where table_schema = 'public' and table_name = 'presentation_decks'
  ) then
    alter table "public"."presentation_cards"
      add constraint "presentation_cards_deck_id_fkey"
      foreign key (deck_id) references presentation_decks(id) on delete cascade;
  end if;
end $$;
