# Chat V9 — contributor guide (2026-04-18)

The end-to-end recipe for adding a new Chat V9 feature. Read this
once, bookmark it, and every future feature is a 30-minute change
instead of a 3-hour archaeology dig.

This guide is the **contract**. The registry-consistency tests in
`src/utils/__tests__/chatV9FeatureFlags.test.ts` enforce it
automatically; CI will reject a PR that skips a step here.

---

## 0. Before you start

**The one rule:** every user-visible change in Chat V9 ships behind
exactly one feature flag. No exceptions. If the feature cannot be
killed from a URL, it cannot ship.

**What goes in a flag:**

- A single behavioural change scoped to a single surface (one button,
  one shortcut, one popover section, one keyboard path).
- Defaults to `ON` on `develop`.
- Can be disabled independently of every other flag.

**What does NOT go in a flag:**

- Bug fixes to code that is already behind a flag — fix inside that flag.
- Refactors / renames — they are not user-visible.
- Server-side changes — Chat V9 is front-end only; use the normal
  back-end release process.

---

## 1. Pick a ticket code

Look at the block-level dev plan for your feature:

- Navigation → `NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md`
- Trust → `TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md`
- Voice → `VOICE_MODE_AUDIO_EXPERIENCE_DEVELOPMENT_PLAN_2026-04-18.md`
- Input → `INPUT_CONTROL_DEVELOPMENT_PLAN_2026-04-18.md`
- Admin → `ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md`

Pick the next unused ticket in the block's numbering convention:

| Block | Shape | Example |
|---|---|---|
| Navigation | `NAV-M<n>[.<sub>]` | `NAV-M3.5` |
| Trust | `T-<TR\|PM><n>[.<sub>]` | `T-TR3.4` |
| Voice | `VM<n>[.<sub>]` | `VM3.2` |
| Input | `C-IN<n>[-lite]` | `C-IN6-lite` |
| Admin | `AG1 v1.<sub>` | `AG1 v1.13` |

The registry test's ticket regex is
`^[A-Z]+(-[A-Z]+)?\d+(\.\d+)?$`. Stay inside it.

---

## 2. Create the per-flag resolver

Copy an existing one (e.g. `src/utils/bargeInToastFlag.ts`) and
rename. Keep the exact same structure — the registry-consistency
tests pin every invariant.

**Mandatory naming convention:**

| Artefact | Casing | Example |
|---|---|---|
| File | camelCase `Flag.ts` | `trustBadgeCitationDomainFlag.ts` |
| `LS_KEY` | `ff.` + snake_case | `'ff.trust_badge_citation_domain'` |
| `QUERY_KEY` | `ff_` + camelCase | `'ff_trustBadgeCitationDomain'` |
| `ENV_KEY` | `VITE_` + SCREAMING_SNAKE | `'VITE_TRUST_BADGE_CITATION_DOMAIN'` |
| Resolver | `is<Name>Enabled()` | `isTrustBadgeCitationDomainEnabled()` |
| Export | `<SCREAMING>_FLAG_KEYS` | `TRUST_BADGE_CITATION_DOMAIN_FLAG_KEYS` |

The three keys must encode the **same word sequence** — the
`every flag uses coherent keys` test will fail otherwise.

**Resolution order (fixed, do not re-order):**

1. URL query `?ff_<camelCase>=0|1`
2. `localStorage["ff.<snake_case>"]`
3. `import.meta.env.VITE_<SCREAMING>`
4. Default (`true`)

Wrap every `window.*` / `localStorage.*` / `import.meta` access in
`try/catch`. SSR renders with no window; private mode throws on
localStorage; a dev without the env var set is normal. None of those
may break the resolver.

---

## 3. Gate the feature

Inside the component / helper, call `is<Name>Enabled()` at the
narrowest boundary that still lets the feature cleanly collapse:

```tsx
// Component-level: flag OFF renders null.
if (!isTrustBadgeCitationDomainEnabled()) return null;

// Call-site level: flag OFF makes the helper a no-op.
export function notifyBargeIn() {
  if (!isBargeInToastEnabled()) return;
  // ...emit toast + telemetry...
}
```

**Prop-seam pattern for testing:** expose the resolver as an
optional prop so tests can pass a stub without touching globals:

```tsx
interface Props {
  // ...
  readonly isCitationDomainEnabled?: () => boolean;
}

function TrustBadge({ isCitationDomainEnabled = isTrustBadgeCitationDomainEnabled, ...rest }: Props) {
  const domainEnabled = isCitationDomainEnabled();
  // ...
}
```

Every shipped V9 component follows this pattern. Keep doing it.

---

## 4. Register the flag

Add the descriptor to `CHAT_V9_FLAGS` in
`src/utils/chatV9FeatureFlags.ts`, appended to the end (the array is
timeline-ordered). Required fields (all enforced by the registry
test):

```ts
{
  id: 'trust-badge-citation-domain',              // kebab-case, unique
  ticket: 'T-TR3.4',                              // matches §1 shape
  block: 'trust',                                 // closed union
  title: 'Trust badge citation row · domain pill',
  description:
    // minimum 50 chars; explain behaviour + kill-switch effect.
    '...',
  default: true,                                  // always true on develop
  keys: TRUST_BADGE_CITATION_DOMAIN_FLAG_KEYS,    // from step 2
  isEnabled: isTrustBadgeCitationDomainEnabled,   // from step 2
  telemetry: [],                                  // event names; [] if none
  testId: 'trust-badge-citation-domain',          // null if no QA anchor
  specDocs: [
    // At least one. All paths are repo-root relative and must resolve
    // on disk (the `specDoc paths resolve` test will fail otherwise).
    'docs/Chat V9/TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-tr34',
  ],
},
```

Also add the id to `EXPECTED_IDS` in
`src/utils/__tests__/chatV9FeatureFlags.test.ts`. The test pins
registry length and order; without this the test fails loudly.

---

## 5. (Optional) Register telemetry

Only if the feature instruments something new.

1. Extend `FunnelEventName` in `src/services/funnelAnalytics.ts`
   with the new event name (closed enum — the compiler rejects
   anything not in the union).
2. Document the event in `CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md`:
   add an index row and a dedicated section covering the payload
   enum, the trigger, and the privacy contract.
3. Emit the event from inside the flag gate:

```ts
if (!is<Name>Enabled()) return;
trackFunnelEvent('<event_name>', { /* closed-enum payload only */ });
```

**PII contract:** never emit free-form strings, user text, STT / TTS
transcripts, or raw error messages. Map to enums. The telemetry
contract doc lists the existing enums — reuse them.

---

## 6. Update the README

Every registered flag must appear in **three places** in
`docs/Chat V9/README.md`. The `every registered flag appears in
every README cheat sheet` test will fail otherwise:

1. **Status table** (§ Status) — one row. Wrap the id in backticks
   so the test finds it.
2. **URL kill-switch cheat sheet** (§ Kill-switches) — one line
   `?ff_<camelCase>=0`.
3. **localStorage cheat sheet** (§ Kill-switches) — one line
   `localStorage.setItem('ff.<snake_case>', '0');`.

If the feature introduces a brand-new failure mode, also add a row
to **§ 4 Known failure modes** in
`CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md`.

---

## 7. Tests — the non-negotiable list

Every V9 feature ships with:

1. **Resolver unit tests** — `src/utils/__tests__/<name>Flag.test.ts`.
   Cover URL-wins, localStorage-wins, env-wins, default-wins, and the
   invalid-input branches (`'on'`, `'true'`, `'1'`, `'off'`, garbage).
   The baseline four-path contract (URL `0/1` beats localStorage `0/1`
   beats default, garbage falls through) is already covered by the
   parameterised suite in `chatV9FlagResolverContract.test.ts` — your
   per-flag file can focus on branches specific to your resolver
   (e.g. env-wins, custom string aliases).
2. **Component tests** — `src/components/**/__tests__/<Component>.test.tsx`.
   Cover: feature enabled renders the thing; feature disabled renders
   nothing (or the prior behaviour); every user-visible interaction
   fires its side effect exactly once; every telemetry emit is
   wrapped in try/catch so a throwing sink never breaks the feature.
3. **Registry tests** auto-run (no action needed).

**Minimum count expectation:** the shipped features average
~8 tests per flag. A two-test PR is a red flag during review.

---

## 8. Tests to watch for during review

```
src/utils/__tests__/chatV9FeatureFlags.test.ts
src/utils/__tests__/chatV9FlagResolverContract.test.ts
src/components/Admin/__tests__/ChatV9FlagsPanel.test.tsx
src/components/Admin/__tests__/ChatV9FlagsOverlay.test.tsx
```

Those four suites encode the cross-cutting invariants:

- `chatV9FeatureFlags.test.ts` — registry integrity: id/key/ticket
  uniqueness, kebab-case ids/testIds, URL/LS/ENV prefix shape, key
  coherence, closed-universe blocks, README-registry cross-sync,
  intra-doc anchor resolution, and telemetry-contract sync.
- `chatV9FlagResolverContract.test.ts` — resolver contract: every
  registered flag honours URL > localStorage > default and never
  throws on garbage input (~240 parameterised assertions).
- `ChatV9FlagsPanel.test.tsx` / `ChatV9FlagsOverlay.test.tsx` —
  the admin UI that exposes all of the above to operators.

If any of them breaks, your PR broke something outside your flag —
look first at `EXPECTED_IDS` ordering and the README cheat sheets.

---

## 9. Shipping checklist

Paste this into the PR description:

```md
### Chat V9 feature checklist

- [ ] Per-flag resolver in `src/utils/<name>Flag.ts`.
- [ ] Feature gated on `is<Name>Enabled()` at the narrowest boundary.
- [ ] Prop-seam exposed for the resolver (testability).
- [ ] Descriptor appended to `CHAT_V9_FLAGS` in order.
- [ ] `EXPECTED_IDS` updated in the registry test.
- [ ] (If telemetry) `FunnelEventName` extended + contract doc updated.
- [ ] README status table, URL cheat sheet, localStorage cheat sheet updated.
- [ ] (If new failure mode) operations runbook § 4 updated.
- [ ] Resolver unit tests cover all four resolution paths.
- [ ] Component tests cover enabled + disabled + interactions + telemetry try/catch.
- [ ] `npx vitest run src/utils src/components/Admin src/components/AIChat` green.
- [ ] `specDocs` paths exist on disk.
```

The registry tests break CI if any of steps 4, 5b, 6 are skipped —
they are not optional in the "I forgot to update the doc" sense.
They fail loudly and the PR does not merge.

---

## 10. Anti-patterns we have retired

- **Global booleans on `window.__`.** Do not. Use the resolver.
- **`localStorage` writes without try/catch.** Private mode throws;
  your helper must not.
- **"Just a quick" style-only change without a flag.** If it is
  visible to users, it is behind a flag.
- **Telemetry events with free-form string payloads.** Closed enums
  only; the compiler enforces this.
- **Spec docs that link to a Notion page.** Every `specDocs` entry
  must resolve to a file on disk (the test checks).
- **Flag ids in camelCase or with spaces.** Kebab-case only.
- **Adding a flag to the registry without the README.** The README
  sync test will reject the PR.

---

## 11. When in doubt

- Read the nearest shipped flag's code, test file, and dev-plan entry.
  Copy its structure.
- Check `CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md` for how ops will
  actually use the flag — this catches "my flag is impossible to
  kill in under 30 seconds" design mistakes early.
- Ask before deviating. The consistency is the feature.
