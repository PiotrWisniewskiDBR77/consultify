/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — SETTINGS domain.
 *
 * Scope: only writers reachable on the `/api/settings` mount
 * (`server/src/routes/settings.routes.ts`, `server/src/Gateway.ts:727`) — the
 * mount this guard is composed in front of. SETTINGS has no v8/canonical
 * layer at all (legacy-vs-legacy, never legacy-vs-canonical), so `successor`
 * is `null` on every writer below; none is a proven equivalent write of
 * another.
 *
 * FOUR BUSINESS FACTS, EACH WRITTEN MORE THAN ONCE:
 *
 *  - PROFILE: `POST /api/settings/import` (W03) is a second, independently
 *    coded UPDATE of `users` profile columns, parallel to the live
 *    `PUT /api/users/:id` (`server/src/routes/user/users.routes.ts:78` ->
 *    `UserController.updateUser`) — a DIFFERENT mount (`/api/users`), so that
 *    writer is an unguarded sibling, not registered here (see the report).
 *
 *  - PRIVACY/CONSENT: `PUT /api/settings/gdpr/consents` (W07) and
 *    `PUT /api/settings/gdpr/retention` (W09) upsert JSON blobs into
 *    `user_preferences`, while the live consent/retention UI
 *    (`DataControlsSettings.tsx:286`) writes the REAL tables
 *    `user_gdpr_consents`/`user_data_retention` via `PUT /api/gdpr/consents`
 *    and `PUT /api/gdpr/retention` — both on the `/api/gdpr` mount, both
 *    unguarded siblings, listed in the report. `PUT /api/settings/preferences/
 *    privacy` (W06) is a third, narrower privacy-preferences blob (AI-sharing/
 *    visibility toggles) in the same `user_preferences` family and on this
 *    same mount, so it is registered too.
 *
 *  - GDPR DATA EXPORT: THREE tables serve one "user requested an export"
 *    fact. `POST /api/settings/export-data` (W11) and its `/api/gdpr` sibling
 *    both write `data_export_requests`; `POST /api/settings/gdpr/export-request`
 *    (W13) writes a THIRD, self-created table `gdpr_requests`. Both W11 and
 *    W13 are on this mount and are registered; the `/api/gdpr` sibling is not
 *    (different mount, unguarded, listed in the report).
 *
 *  - ACCOUNT DELETION: `POST /api/settings/gdpr/deletion-request` (W15) is the
 *    live, bcrypt-gated deletion writer (its own code comment elsewhere calls
 *    it "canonical"), writing `gdpr_requests(type='deletion')`. A second,
 *    unused deletion writer exists on `/api/gdpr` (`account_deletion_requests`)
 *    — different mount, unguarded sibling, listed in the report.
 *
 * LANGUAGE/LOCALE is a named business fact in the brief, but it has NO writer
 * on `/api/settings` at all (`grep -n 'language|locale' settings.routes.ts`
 * returns zero hits) — both competing writers (`users.language` via
 * `PUT /api/users/:id`, and `user_preferences` key `language` via the generic
 * `PUT /api/preferences`) live on other mounts. Neither can be registered in
 * this config; both are listed in the report as unguarded siblings.
 */

import type { LegacyCutoverDomainConfig } from '../legacyCutoverKernel.js';

export const SETTINGS_CUTOVER: LegacyCutoverDomainConfig = {
  domain: 'settings',
  rollbackEnv: 'SETTINGS_LEGACY_WRITER_ROLLBACK_ENABLED',
  rollbackWritersEnv: 'SETTINGS_LEGACY_ROLLBACK_WRITERS',
  disabledCode: 'SETTINGS_LEGACY_WRITER_DISABLED',
  unmappedCode: 'SETTINGS_LEGACY_IDENTITY_UNMAPPED',
  writers: [
    {
      writerId: 'SETTINGS-W03',
      method: 'POST',
      path: /^\/import\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'POST /api/settings/import (settings.routes.ts:5033-5099) UPDATEs users profile columns ' +
        '(settings.routes.ts:5069, dynamic list PROFILE_IMPORT_COLUMNS at settings.routes.ts:36-63) — a ' +
        "second, independently-coded implementation of 'write profile columns to users', parallel to " +
        'PUT /api/users/:id -> UserController.updateUser (users.routes.ts:78, UserController.ts:182-482), ' +
        'a different mount not guarded by this config. PROFILE_IMPORT_COLUMNS omits language and ' +
        'linkedin_id, which UserController.ts writes (UserController.ts:424,356) — a settings-backup ' +
        'restore silently drops language. No successor: different code path, same table, not a proven ' +
        'equivalent write.',
    },
    {
      writerId: 'SETTINGS-W06',
      method: 'PUT',
      path: /^\/preferences\/privacy\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'PUT /api/settings/preferences/privacy (settings.routes.ts:2621-2639) upserts a JSON blob into ' +
        "user_preferences (key 'settings:privacy', settings.routes.ts:2635 via upsertUserPreferenceValue). " +
        'Two live screens (PrivacyDataSettings.tsx:119, DataPrivacySettings.tsx:112) write the same key ' +
        'through this one endpoint and agree with each other, but it is part of the same user_preferences ' +
        'blob family as W07/W09 below that competes with the real per-fact tables owned by /api/gdpr. No ' +
        'successor: sole writer of this key, nothing to point at.',
    },
    {
      writerId: 'SETTINGS-W07',
      method: 'PUT',
      path: /^\/gdpr\/consents\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'PUT /api/settings/gdpr/consents (settings.routes.ts:2843-2866) upserts a JSON blob into ' +
        "user_preferences (key 'settings:gdpr-consents', settings.routes.ts:2857-2860) while the live " +
        'consent UI (DataControlsSettings.tsx:286) writes real boolean columns into user_gdpr_consents via ' +
        'PUT /api/gdpr/consents (gdpr.routes.ts:198-247, INSERT at gdpr.routes.ts:219-235) — a different ' +
        'mount, unguarded by this config (see report). No successor: incompatible storage models for the ' +
        'same consent fact, not a proven equivalent write.',
    },
    {
      writerId: 'SETTINGS-W09',
      method: 'PUT',
      path: /^\/gdpr\/retention\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'PUT /api/settings/gdpr/retention (settings.routes.ts:2891-2909) upserts a JSON blob into ' +
        "user_preferences (key 'settings:gdpr-retention', settings.routes.ts:2906-2909) while the live " +
        'retention UI (DataControlsSettings.tsx:286) writes the real user_data_retention table via ' +
        'PUT /api/gdpr/retention (gdpr.routes.ts:301-350, INSERT at gdpr.routes.ts:336-339) — a different ' +
        'mount, unguarded by this config. Zero known client references to this endpoint. No successor: ' +
        'incompatible storage models, not a proven equivalent write.',
    },
    {
      writerId: 'SETTINGS-W11',
      method: 'POST',
      path: /^\/export-data\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'POST /api/settings/export-data (settings.routes.ts:2782-2801) calls ' +
        'gdprService.createDataExportRequest (gdprService.ts:112-172), which INSERTs into ' +
        'data_export_requests (gdprService.ts:158-160) and sets download_url at creation even though ' +
        'nothing in this path ever flips status away from pending. One of THREE writers for "user requested ' +
        'a GDPR export": the same data_export_requests table is also written by an independent duplicate ' +
        'INSERT at POST /api/gdpr/export-request (gdpr.routes.ts:397-473, INSERT at gdpr.routes.ts:439-444, ' +
        'a different mount, unguarded here), and a THIRD self-created table gdpr_requests is written by ' +
        'SETTINGS-W13 below, on this same mount. Live callers: ExportDataSettings.tsx:127, ' +
        'PrivacyDataSettings.tsx:138, DataPrivacySettings.tsx:137. No successor: three writers for one ' +
        'fact, no pair proven equivalent.',
    },
    {
      writerId: 'SETTINGS-W13',
      method: 'POST',
      path: /^\/gdpr\/export-request\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'POST /api/settings/gdpr/export-request (settings.routes.ts:2990-3067) INSERTs into gdpr_requests ' +
        '(settings.routes.ts:3025), a table this same file CREATEs inline (CREATE TABLE IF NOT EXISTS ' +
        'gdpr_requests, settings.routes.ts:2921-2923) — a THIRD table for the "GDPR export request" fact ' +
        'already covered by SETTINGS-W11 and its /api/gdpr sibling, both of which use data_export_requests. ' +
        'Zero known client references. No successor: different table from W11, not a proven equivalent ' +
        'write.',
    },
    {
      writerId: 'SETTINGS-W15',
      method: 'POST',
      path: /^\/gdpr\/deletion-request\/?$/,
      state: 'observed',
      successor: null,
      reason:
        "POST /api/settings/gdpr/deletion-request (settings.routes.ts:3155-3210) INSERTs into " +
        "gdpr_requests (type='deletion', settings.routes.ts:3195), gated on verifyUserPassword before " +
        'scheduling. Live callers: src/services/api.ts:12059,17071 — this is the live deletion writer (a ' +
        "UI code comment elsewhere calls it 'canonical'). A second, independent deletion writer exists at " +
        'POST /api/gdpr/deletion-request (gdpr.routes.ts:562-609, INSERT into account_deletion_requests at ' +
        'gdpr.routes.ts:589-592) on the /api/gdpr mount, unguarded here, with no known client reference. No ' +
        'successor: different table, not a proven equivalent write, and this is the live writer, not the ' +
        'shadow.',
    },
  ],
};
