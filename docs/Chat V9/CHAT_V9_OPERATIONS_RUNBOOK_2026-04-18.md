# Chat V9 — operations runbook (2026-04-18)

The reference operators, on-call engineers, and support reach for
when a Chat V9 feature misbehaves in production.

Goal: **any shipped V9 feature can be disabled in under 30 seconds
from a browser, a tenant tunnel, or an admin panel**, without a
redeploy, without a server push, without opening a PR.

If you are reading this during an incident, jump straight to
[§ 3. The three-second kill chain](#3-the-three-second-kill-chain).
Everything above it is context; everything below it is the why.

---

## 1. What Chat V9 is, from an ops perspective

Chat V9 is the "AI-native shell" milestone that ships as a fleet of
**small, independently killable features** behind per-feature
flags. There is no single "V9 on / off" switch because every feature
is meant to be rolled forward and rolled back on its own clock.

**Key invariants enforced in code:**

1. **Every V9 feature is gated by exactly one flag.** Listed in
   `src/utils/chatV9FeatureFlags.ts` as `CHAT_V9_FLAGS`.
2. **Every flag resolves in the same order.** URL query
   (`?ff_*`) beats `localStorage["ff.*"]` beats
   `import.meta.env.VITE_*` beats the shipped default. This
   order is the same in the flag file, in the overlay, and in
   every test — if it ever drifts, the build fails.
3. **Every flag defaults ON on `develop`.** Rollback means
   flipping a flag OFF, not a redeploy.
4. **No Chat V9 telemetry is mandatory.** Every
   `trackFunnelEvent` call is wrapped in try/catch so a broken
   analytics sink can never block the feature. Conversely, a
   noisy event stream can always be silenced at its flag
   without touching the feature it instruments.

**What this runbook does NOT cover:**

- Back-end API incidents (see the consultify API runbook).
- Voice infra (STT / TTS) latency or quota issues.
- Auth / RBAC regressions on non-V9 surfaces.

---

## 2. Severity ladder

| Level | Symptom | Response target | Where |
|---|---|---|---|
| S0 | V9 feature is actively breaking chat flow for every user (input blocked, crash loop, PII leak). | **< 30 s** to kill. | § 3 |
| S1 | Feature is visibly broken for some tenants or routes but chat still works. | **< 5 min** to kill. | § 3 then § 4 |
| S2 | Feature works but produces loud noise (toast storm, telemetry spam, layout shift). | **< 30 min** to quiet. | § 4 |
| S3 | Reported cosmetic regression, no functional impact. | Next business day. | § 5 |

> **In doubt, start at S0.** The cost of an extra kill-switch flip is zero;
> the cost of leaving a crash loop live is user trust.

---

## 3. The three-second kill chain

Pick the lowest-friction path that your role can execute. The three
paths produce the same result (the flag is OFF for the scope you
chose); they differ only in blast radius and required access.

### 3a. Single user / support-assisted (URL, zero access required)

Ask the user to append the kill-switch to their URL and reload.
Append `=0` to force-disable. The change is tab-scoped, survives
refresh within the tab's lifetime, and evaporates when the tab closes.

```
https://app.example.com/?ff_<feature>=0
```

- **Kill-switches by feature** — see [`README.md` § Kill-switches](./README.md#kill-switches-cheat-sheet).
- **Blast radius:** one tab, one user.
- **Rollback:** close the tab or set `=1`.

**When to reach for this:**

- A single user is hitting a S0 bug and cannot wait for a tenant-wide roll-back.
- You are debugging with the reporter on a shared-screen call.
- You want to confirm "is it this feature?" without touching anyone else.

### 3b. Operator tab / admin / long-lived (localStorage)

Open DevTools on the affected tab and set the flag in `localStorage`.
The change persists across reloads until the operator clears it.

```js
localStorage.setItem('ff.<feature>', '0');
location.reload();
```

- **Storage keys by feature** — see [`README.md` § localStorage cheat sheet](./README.md#killing-from-localstorage-cheat-sheet).
- **Blast radius:** one browser profile on one machine.
- **Rollback:** `localStorage.removeItem('ff.<feature>')`.

**When to reach for this:**

- You run a long-lived admin session and want the flag OFF for
  every tab you open in this browser profile.
- You are reproducing a customer bug that requires the feature
  OFF across navigations.

### 3c. Admin panel (no code, no DevTools, panel UI only)

1. Open the admin flag panel. URL shortcut:
   ```
   https://app.example.com/?v9flags=1
   ```
2. Focus the flag row (or use the filter — typing narrows the list).
3. Use AG1 v1.10 keyboard shortcuts:
   - `o` — force ON.
   - `f` — force OFF.
   - `d` — clear override (back to the shipped default).
4. To share your exact override set with another admin, click
   **Copy URL** (AG1 v1.12). Opening that URL anywhere reproduces
   the set.
5. To wipe every override in one click, append
   `?v9flags=reset` to any app URL (AG1 v1.3). This calls
   `resetAllChatV9FlagOverrides()` and rewrites the query to the
   plain `?v9flags=1`, so a refresh does not re-apply the reset.

**When to reach for this:**

- The reporter is in Support and cannot touch DevTools.
- You need to flip three flags in a row and want the visual
  feedback of the panel's state machine.
- You want an audit trail you can screenshot into the incident
  ticket (the panel's `Copy snapshot` button — AG1 v1.2 — gives
  you a Markdown table of the current state).

---

## 4. Known failure modes and their kill-switch

Every entry in this table is **an actual observed or credibly
anticipated failure**, plus the single flag that neutralises it.
If a feature is not listed here, the kill-switch is still the flag
from [`README.md` § Status table](./README.md#shipped-and-tracked).

| Symptom | Flag to flip OFF | Why |
|---|---|---|
| Chat input crashes or loses focus on keypress | `input-hint-strip`, then `input-char-counter`, then `next-model-chip` | These are the three most-recent mount-time changes inside `EnhancedChatInput`. Flip them one at a time. |
| Toast storm (barge-in or PII repeatedly) | `barge-in-toast` / `pii-heuristic-toast` | Each toast family owns its own flag; the 1.5 s / 4 s cooldowns were tuned on `develop` but a noisy regression is one flip away. |
| Trust Badge popover renders with broken links | `trust-badge-citation-links` | Kill the linkification path; citation rows degrade to plain text. The popover stays available. |
| Trust Badge popover misrenders source domains | `trust-badge-citation-domain` | Independent of the link path. |
| Copy-reasoning / Copy-citations button refuses | `trust-badge-copy-citations` or `trust-badge-copy-reasoning` | The clipboard writer falls back to `execCommand`; if even that fails, kill the affordance. |
| Recents dropdown traps focus | `workspace-breadcrumb-recents-arrow-keys`, then `workspace-breadcrumb-recents-trigger-arrow`, `workspace-breadcrumb-recents-trigger-arrow-up` | The keyboard paths are the likely regression surface; flip them off in the listed order. |
| Voice legend popover flashes / repositions | `voice-mode-legend` | Also kills `voice-legend-shortcut` (no legend to open), which is the intended cascade. |
| Admin flag panel `Esc` closes the panel when typing | `flags-panel-filter-escape-clear` | Restores the pre-AG1-v1.13 bubble-through path. |
| Admin flag panel `o`/`f`/`d` fires inside an editable widget | `flags-panel-row-shortcuts` | The handler guards against `input` / `textarea` / `contenteditable`, but this is the belt-and-braces kill. |
| "All flags at their shipped defaults" / "overrides" header is wrong | `flags-snapshot-copy` | Only kills the Copy snapshot button; the override count is a pure computation and does not need its own flag. |
| Private Mode popover shows the wrong copy | `private-mode-details` | Falls back to the pre-T-PM1 static chip. |
| Workspace breadcrumb shows stale / wrong path | `workspace-breadcrumb`, then drill into `-conversation`, `-recents`, `-recents-pinned`, `-recents-view-all` | Ordered from root to leaf so you can keep the breadcrumb visible while killing just the dropdown. |

**If the symptom is not here:**

1. Find the feature in [`README.md` § Status table](./README.md#shipped-and-tracked).
2. Flip the flag listed in that row.
3. Add the symptom to this table when you file the post-mortem.

---

## 5. Rollback patterns

### 5a. Single-feature rollback

```
?ff_<feature>=0              # tab-scoped, fastest
localStorage.setItem('ff.<feature>', '0'); location.reload()  # profile-scoped
Admin panel → row → "f"      # per-browser, leaves an audit trail
```

### 5b. Tenant-wide rollback

Push a `VITE_*` env variable set to `0` for the tenant's build. The
env default is the weakest resolution source, so any admin override
still wins — this is correct: env ships the shipped-by-default, and
admins can locally re-enable for debugging.

### 5c. "Undo everything I did in this browser"

```
?v9flags=reset
```

Appending that to any app URL:

1. Calls `resetAllChatV9FlagOverrides()` (wipes every
   `ff.*` key this tab's browser profile has set).
2. Rewrites the query to `?v9flags=1` so a refresh does not
   re-trigger the reset.
3. Leaves non-V9 query params untouched.

### 5d. Copy-reproduce-apply

- From the panel that has the problem overrides, click
  **Copy URL** (AG1 v1.12). The URL encodes every override in
  registry order.
- Send that URL to the engineer reproducing the issue.
- They open it on any browser. The override set is applied
  through the standard URL-first resolution path.

### 5e. Last-resort total-off

If every V9 flag must be silenced at once (unlikely; reserved for
incidents where ops has lost trust in the feature layer itself):

```js
// DevTools on the affected tab.
const FLAGS = Object.keys(localStorage).filter((k) => k.startsWith('ff.'));
for (const k of FLAGS) localStorage.setItem(k, '0');
location.reload();
```

Prefer `?v9flags=reset` first (it clears overrides, restoring
defaults) over the sweep above (it forces every flag OFF).
Defaults-OFF should only be a one-browser debugging tool, never
a tenant policy.

---

## 6. Recovery & post-incident

### 6a. Re-enable a single feature

- Tab: `?ff_<feature>=1` or close the tab.
- Profile: `localStorage.removeItem('ff.<feature>')`.
- Admin panel: row → `d` (default) for the fastest path.

### 6b. Verify the kill actually took effect

- The panel's override chip (AG1 v1.1) shows the current count.
- The panel's filter (AG1 v1.5) accepts the flag id / ticket /
  block — use the filter to confirm the row shows `override = off`.
- For anything except the panel itself, open DevTools ▸
  `import('/src/utils/chatV9FeatureFlags.ts').then(m =>
  console.table(m.getChatV9FlagSnapshot()))`.

### 6c. Write the post-mortem

Required fields:

1. Symptom (what the user / dashboard saw).
2. Impact (tenants, users, duration).
3. Kill-switch that was flipped.
4. Time from detection to kill.
5. Whether the feature will come back on and when.
6. Whether the "known failure modes" table needs a row.

Attach the Markdown snapshot from `Copy snapshot` (AG1 v1.2) as
the authoritative "what was flipped" record.

---

## 7. Appendix — full flag index

The authoritative list is `CHAT_V9_FLAGS` in
`src/utils/chatV9FeatureFlags.ts`. The README status table is
generated from that registry; the kill-switch cheat-sheet and
localStorage cheat-sheet cross-link to it.

| Source | Purpose |
|---|---|
| [`README.md` § Shipped](./README.md#shipped-and-tracked) | Every shipped feature, its ticket, its flag id, and a link to its spec. |
| [`README.md` § URL kill-switches](./README.md#kill-switches-cheat-sheet) | Every query-string override in one grep-friendly block. |
| [`README.md` § localStorage cheat sheet](./README.md#killing-from-localstorage-cheat-sheet) | Every storage key in one grep-friendly block. |
| `CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md` | Every event emitted, with ticket, flag, and payload enum. |
| Per-block plans (`NAVIGATION_*`, `TRUST_*`, `VOICE_*`, `INPUT_*`, `ADMIN_*`) | Design rationale, delivered files, DoD, and "out of scope" for each ticket. |

If you find a mismatch between this runbook and the registry,
trust the registry. File a ticket to update this doc.
