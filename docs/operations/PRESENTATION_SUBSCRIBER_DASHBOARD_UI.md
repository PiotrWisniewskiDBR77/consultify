# Presentation Governance — Subscriber Dashboard UI (Sprint 13)

A standalone, embeddable read-only React page that lets external HMAC alert
subscribers ("clients of clients") inspect their own delivery stats without
needing a Consultify account. The page is the browser-side counterpart of
the Sprint 13 backend route `GET /api/presentations/governance/subscriber/dashboard`
documented in [`PRESENTATION_SUBSCRIBER_DASHBOARD.md`](./PRESENTATION_SUBSCRIBER_DASHBOARD.md).

> **TL;DR for subscribers:** open the link your operator emailed you and
> the dashboard fills in. The page never asks for your Consultify
> password — there is none — and it never persists your token to
> long-lived browser storage.

---

## Purpose

External subscribers receive `presentation_governance_alert_*` webhook
deliveries from Consultify. The backend dashboard endpoint already
exposes a read-only snapshot of:

* the masked delivery target and channel
* signing-secret rotation pressure
* 7-day / 30-day delivery aggregates
* the last 5 dispatches (status, HTTP code, masked deck id, signature presence)
* a single `health.overall` classification with reasons

This UI gives the subscriber a visual, no-auth-headache view of that data
that they can share inside their own ops channel, screenshot for an
incident review, or iframe inside their existing dashboards.

---

## Token Onboarding Flow

```
[Consultify admin]                [Subscriber operator]              [Subscriber browser]
       |                                  |                                  |
       |  Issue one-time token            |                                  |
       |  via admin endpoint              |                                  |
       |  (POST .../dashboard-tokens)     |                                  |
       |--------------------------------->|                                  |
       |                                                                     |
       |       Send token via secure channel (1Password / encrypted email)   |
       |-------------------------------------------------------------------->|
       |                                                                     |
       |                                                                     |
       |                                            Open page via either:    |
       |                                            (a) #token=<rawToken>    |
       |                                                hash deep link, OR   |
       |                                            (b) paste-in form        |
       |                                                                     |
       |                                            UI saves to              |
       |                                            sessionStorage,          |
       |                                            scrubs the URL hash,     |
       |                                            and fetches the          |
       |                                            dashboard.               |
```

There are exactly two supported entry paths:

1. **Hash deep link.** The operator sends a URL of the form
   `https://app.consultify.example.com/subscriber/dashboard#token=<64hex>`.
   On mount, the page parses the hash, validates the 64-hex format,
   stores the token in `sessionStorage`, and immediately replaces the
   URL with `/subscriber/dashboard` via `history.replaceState` so the
   token does not linger in browser history, tab titles, or
   screenshots.

2. **Paste-in form.** When no token is available, the page shows a
   single-input form ("Enter the dashboard token your Consultify
   operator gave you."). The input is a `type="password"` field so the
   raw token is never visible on screen. Malformed input is rejected
   silently — nothing is stored unless the value matches `^[a-f0-9]{64}$`.

---

## Browser Session Model

| Surface             | Used? | Notes                                                |
|---------------------|-------|------------------------------------------------------|
| `sessionStorage`    | yes   | Key: `consultify_subscriber_token`. Wiped on tab close. |
| `localStorage`      | NO    | Hard-banned — would survive tab close and sync across tabs. |
| Cookies             | NO    | Bearer-only contract; no `Cookie` header is ever set. |
| URL hash fragment   | yes (transiently) | Captured on mount, then `replaceState`-d away. |
| URL query string    | yes (`?embed=1`) | Read once on mount; never includes the token. |
| In-memory React state | yes  | The token does not live in component state once handed off to the store. |

The strict `sessionStorage`-only model means:

* Closing the tab signs the subscriber out automatically.
* Two browser tabs each hold an independent token (no `storage` event leakage).
* Private/incognito windows behave identically (no orphaned `localStorage` rows after the session).

The "Sign out" button in the header explicitly calls
`sessionTokenStore.clearToken()` and resets all derived state.

---

## Dashboard Sections Walkthrough

The loaded page is a single column (max width ~960 px) with five blocks:

### 1. Header strip

* Masked target (e.g. `https://hooks.sl****abcd`) + channel chip.
* `SubscriberHealthBadge`: emerald check / amber alert / rose cross.
  The reasons array (when non-empty) is surfaced via `aria-label` and the
  native `title` tooltip so screen readers announce both the state and the
  underlying explanation.
* "Last refreshed" wall-clock time + manual `Refresh` button. The button
  re-fetches the snapshot and resets the timestamp on success.
* `Sign out` button (hidden in `?embed=1` mode).

### 2. Signing card

* `HMAC-SHA256` algorithm chip.
* Relative "last rotated" timestamp ("23 days ago"). When
  `daysSinceRotation > 90` the card surfaces a **rose** "overdue" banner;
  when `rotationDueWithinDays <= 30` it surfaces an **amber** "rotate soon"
  banner. The thresholds match the server-side rules in
  `presentationSubscriberDashboardService.ts`.
* "Why this matters" expandable section explains why HMAC rotation is
  important without leaking implementation details.

### 3. Delivery summary

Two side-by-side columns ("Last 7 days" / "Last 30 days") each showing
sent / failed / suppressed / dry-run counters with consistent
color-coding (emerald / rose / slate / sky). Below them, a status strip
shows the last dispatch / last failure timestamps and an amber chip
calling out `consecutiveFailures` when greater than zero.

When all aggregates are zero, the chips render `0` honestly — we never
fake a checkmark.

### 4. Recent dispatches table (`SubscriberDispatchTable`)

A compact table with up to 5 rows. Columns:

| Time | Status | HTTP | Verdict | Deck | Signature |

* Status uses lucide icons + colored pills:
  `CheckCircle` / `XCircle` / `MinusCircle` / `FlaskConical`.
* `Verdict` shows the verdict that triggered the dispatch (server-supplied).
* `Deck` is the **server-masked** id (e.g. `deck****`); the UI never
  re-derives the value.
* `Signature` is a chip indicating whether a signature was recorded for
  that dispatch; hovering reveals the algorithm.

When the array is empty the section renders an explicit "No recent
dispatches yet." empty state.

### 5. Warnings & reasons

A single bulleted list combining `health.reasons` and `warnings[]`, in
that order. When both arrays are empty the section renders "No warnings
reported." rather than disappearing — subscribers should never have to
guess whether the section was suppressed or genuinely empty.

---

## Embeddable Mode (`?embed=1`)

Adding `?embed=1` (or `?embed=true`) to the URL puts the page into
"embed" mode:

* Top bar (logo + brand) and footer (Powered by / privacy note) are hidden.
* Outer padding is reduced so the page sits flush inside an iframe.
* The "Sign out" button is hidden — host pages typically manage the
  session themselves and should not let the iframe wipe storage.
* The "Refresh" button stays visible — embed users still benefit from a
  manual reload.

Recommended iframe sandbox:

```html
<iframe
  src="https://app.consultify.example.com/subscriber/dashboard?embed=1#token=<64hex>"
  sandbox="allow-scripts allow-same-origin"
  width="100%"
  height="900"
  loading="lazy"
></iframe>
```

The host page is responsible for not logging the iframe URL (the hash
fragment is scrubbed by the page itself moments after mount, but a
referrer-leaking host could still capture the original URL). Treat the
deep-link URL the same way you treat a long-lived API key.

---

## Privacy Model

* **The server never sends the signing secret.** The subscriber dashboard
  endpoint exposes only `signature.algorithm` (a constant `'HMAC-SHA256'`)
  and rotation timestamps. The UI cannot display what the backend does
  not return — there is no "reveal secret" button by design.
* **The client never persists the token.** `sessionTokenStore.saveToken`
  refuses anything that does not match `^[a-f0-9]{64}$`, and writes only
  to `sessionStorage`. There is no `localStorage` fallback, no cookie
  jar, and no IndexedDB cache.
* **The token never leaves the configured endpoint.** `fetchSubscriberDashboard`
  only calls `/api/presentations/governance/subscriber/dashboard`. There
  are no telemetry beacons, no analytics calls, and no `Image()` pixels.
  The fetch uses `credentials: 'omit'` so cookies are explicitly excluded.
* **The URL is scrubbed immediately.** As soon as the hash-bound token
  is captured, `scrubTokenFromHash` replaces the location with a clean
  pathname. A subscriber who navigates back will not see the raw token
  in the address bar.
* **The token is never echoed in the DOM.** The paste-in input uses
  `type="password"` and the page state holds only the token while the
  submit handler runs; on success the local component state is wiped.

The single inline tooltip ("Your token is held only in this browser tab
and is cleared when you close it. Never share this token publicly.")
gives the subscriber an at-a-glance reminder of all of the above.

---

## Routing

Mounted as a public route in `src/App.tsx` next to the other
no-auth surfaces (`/invite/:token`, `/report/:id`, `/shared/report/:token`):

```tsx
<Route
  path="/subscriber/dashboard"
  element={
    <React.Suspense fallback={<Spinner />}>
      <SubscriberDashboardPage />
    </React.Suspense>
  }
/>
```

The route lives **outside** `<AppRoutes />` so it does not trigger the
main app's auth bootstrapping (`Api.getMe()`, RouterSync, etc.). External
subscribers do not have Consultify accounts; gating them on `currentUser`
would be both wrong and a UX dead end.

---

## File Inventory

| File                                                                  | Purpose                                              |
|-----------------------------------------------------------------------|------------------------------------------------------|
| `src/services/subscriberDashboardClient.ts`                           | Fetch + sessionStorage + hash helpers (no React).    |
| `src/services/__tests__/subscriberDashboardClient.test.ts`            | 27 vitest cases (jsdom).                             |
| `src/components/Subscriber/SubscriberDashboardLayout.tsx`             | Embeddable wrapper (top bar / footer / center column). |
| `src/components/Subscriber/SubscriberHealthBadge.tsx`                 | 3-state pill with reasons tooltip.                   |
| `src/components/Subscriber/SubscriberDispatchTable.tsx`               | Compact 5-row dispatches table with status icons.    |
| `src/views/subscriber/SubscriberDashboardPage.tsx`                    | Page + state machine (NoToken / Loading / Loaded / Error). |
| `src/App.tsx`                                                          | New `<Route path="/subscriber/dashboard" …>` entry.  |

---

## Verification

```bash
cd consultify
npx vitest run src/services/__tests__/subscriberDashboardClient.test.ts
npx tsc --noEmit -p tsconfig.json
```

Both should be green and the tsc output should not mention any of the
new files.

---

## Future Work

* **i18n.** All copy lives in a `COPY` constants object at the top of
  each component. Wire those constants through the `react-i18next`
  layer so the page can ship localized strings.
* **Dark-mode auto-detect.** The page already responds to the
  `dark` class on `<html>`, so wiring a `prefers-color-scheme`
  observer when the page is opened standalone (no Consultify theme
  context) is a small follow-up.
* **Multiple subscriptions per token.** Today each token is scoped to
  one subscription. If the platform later issues a "tenant-wide" token
  that authorises multiple subscriptions, the page will need a
  subscription picker in the header strip. The `ClientSubscriberSnapshot`
  type would gain a top-level `subscriptions: Snapshot[]` field; the
  current single-subscription type should be treated as a special case
  rather than a hard contract.
* **Auto-refresh.** Polling is intentionally OFF by default. The
  "Refresh" button is manual to discourage the tight loops that the
  cron-tip in the parent doc warns against. A future opt-in toggle
  could mirror the Operations Health view's 60s ticker, but only with
  visibility-pause to avoid burning subscriber rate-limit budgets.
