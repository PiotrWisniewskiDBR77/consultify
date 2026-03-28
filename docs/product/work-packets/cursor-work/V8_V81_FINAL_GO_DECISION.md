# V8 + V8.1 Final Go Decision

> Status: final CTO decision
> Date: 2026-03-26
> Decision type: release/sign-off posture for the frozen `V8 + V8.1` package
> Short status companion: `docs/product/work-packets/V8_V81_CTO_STATUS_NOW.md`

---

## 1. Decision

Final decision:

`closed with bounded exceptions`

The wave is no longer to be treated as an open implementation program.

---

## 2. Why This Is The Correct Decision

The package is already materially closed on the dimensions that matter for the frozen target:

- the major bounded V8 lanes exist,
- the major bounded surfaces exist,
- regression coverage exists across the important packets,
- staging proof exists for the accepted frozen slices,
- remaining asks are almost entirely outside the cheapest closure path.

The work that remains is no longer product build work.

It is reduced to two narrow proof checks:

1. `Calendar`
2. `Organization / Admin / Superadmin`

That is a sign-off boundary, not a delivery boundary.

---

## 3. Residual Exceptions Carried At Closure

The wave is now administratively closed while carrying these explicit exceptions:

### `Calendar`

Carried exception:

- final live capture of `POST /api/v8/my-work/calendar/events` is still missing,
- the latest fresh staging retest already proves governed calendar reads at `200`,
- the conflict check remains on the governed path and currently returns `503`,
- no same-window legacy fallback was observed.

Meaning:

- the unresolved point is narrow runtime/proof confirmation,
- not absence of the governed calendar lane.

### `Organization / Admin / Superadmin`

Carried exception:

- one superadmin-grade staging diagnostics pass is still missing,
- authenticated admin staging already proves `GET /api/v8/admin/flags`,
- route/client regression already covers the bounded admin contract,
- missing proof is specifically visibility of `health`, `metrics`, and `shadow` diagnostics on a real superadmin surface.

Meaning:

- the unresolved point is bounded access/surface proof,
- not missing implementation.

---

## 4. Upgrade Conditions

The only remaining upgrade path from here is:

- convert the two carried exceptions into completed proofs later,
- and then mark the package as unqualified full sign-off.

This is optional follow-through, not a reason to reopen the wave.

---

## 5. Explicit Non-Decisions

This decision does **not** authorize reopening:

- `hold bounded` parity expansion,
- `Reports / Presentations` cleanup,
- notebook adjunct AI side-lanes,
- deeper write parity in `Execution`, `Results`, `Finance`, `Partner`,
- provider OAuth round-trip work in `Sync`,
- websocket/live collaboration parity in `Multiplayer`.

Those belong to a later post-closure track if still desired.

---

## 6. Administrative Action In Force

From this point the operating sequence is:

1. Treat the wave as closed.
2. Carry the two exceptions transparently.
3. Move all remaining breadth into a separate follow-up program.

---

## 7. Final CTO Recommendation

My final recommendation is now enacted:

`the wave is closed with bounded exceptions`

Do **not** reopen the package under this wave label.
