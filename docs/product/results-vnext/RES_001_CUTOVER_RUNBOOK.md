# Results VNext cutover and rollback

## Active posture

The KPI, ROI, and OKR VNext domains are the canonical Results experience for an
ordinary signed-in build. They default to enabled and do not depend on a query
parameter or browser storage. This prevents navigation from falling back to a
disabled or legacy shell.

The build-time controls are:

- `VITE_RESULTS_VNEXT_KPI_ENABLED`
- `VITE_RESULTS_VNEXT_ROI_ENABLED`
- `VITE_RESULTS_VNEXT_OKR_ENABLED`

Production and staging templates set all three to `true` explicitly.

## Controlled rollback

Set only the affected domain's build variable to `false`, rebuild the frontend,
and deploy that build. This disables its VNext route shell without changing or
deleting any Results data. Query parameters and localStorage cannot override an
operator rollback.

To restore the domain, set the variable to `true` (or remove the explicit
`false`), rebuild, and deploy. Verify the ordinary signed-in route with no query
string and with clean browser storage.

## Data safety

Rollback is UI-only. It does not reverse migrations, restore legacy schemas, or
rewrite current-definition/current-snapshot pointers. Database recovery, if ever
required, is a separate operational procedure and must not use this flag.
