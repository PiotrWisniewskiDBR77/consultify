# E2E-1 krok 2 — matrix report

- Result: **FAIL_PRODUCT**
- Variants: 2/8
- Module runs: 32/128
- Non-passing cells: 94 (PRODUCT 28 · CONTRACT 64 · ENV 2)
- Regressions vs exact previous variants: 0
- Unexpected writes: 93
- Contract errors: 4
- Flag issues: 0

PRODUCT = the app broke. CONTRACT = the harness expectation is stale (a surface
this module does not have, a control that is not interactable and reported no
app error). ENV = neither: a route that never settled, or a flag profile that
moved between variants of the same principal.

| Surface | PASS | FAIL | MISSING | BLOCKED | PRODUCT | CONTRACT | ENV |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| menu1 | 24 | 4 | 0 | 4 | 8 | 0 | 0 |
| menu2 | 74 | 0 | 15 | 2 | 2 | 14 | 1 |
| menu3 | 53 | 0 | 2 | 4 | 4 | 2 | 0 |
| kebab | 126 | 0 | 18 | 0 | 0 | 18 | 0 |
| right-panel | 12 | 6 | 14 | 0 | 5 | 14 | 1 |
| create | 12 | 5 | 10 | 5 | 5 | 15 | 0 |
| ai | 27 | 1 | 1 | 3 | 3 | 2 | 0 |

## Flag profiles (captured, never toggled)

| Principal | Profiles | Variants |
| --- | --- | --- |
| admin-nw/northwind | 7d90533cf1c4 | 2 |

## Surfaces present for one principal only (role/org axis — triage, not a verdict)

| Locale | Module | Surface | Rendered for | Absent for |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

## Non-passing cells

| Variant | Module | Surface | Control | Result | Class | Why |
| --- | --- | --- | --- | --- | --- | --- |
| admin-nw-northwind-admin-en-dark | 01-chat | menu2 | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 01-chat | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 01-chat | right-panel | first-row | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 01-chat | create | New conversation | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-dark | 02-my-work | menu1 | /my-work | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-dark | 02-my-work | menu2 | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 02-my-work | menu3 | Teresa | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-dark | 02-my-work | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 02-my-work | right-panel | first-row | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 02-my-work | create | Triage all new items for me | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-dark | 02-my-work | ai | Teresa | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-dark | 03-interview | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 03-interview | create | Add files | FAIL | CONTRACT | control not interactable within the harness budget and the app reported no error |
| admin-nw-northwind-admin-en-dark | 05-assessment | create | Add files | FAIL | CONTRACT | control not interactable within the harness budget and the app reported no error |
| admin-nw-northwind-admin-en-dark | 06-audits | menu2 | Conclusions | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-dark | 06-audits | create | New audit | FAIL | CONTRACT | control not interactable within the harness budget and the app reported no error |
| admin-nw-northwind-admin-en-dark | 08-projects | menu1 | /projects | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-dark | 08-projects | menu2 | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 08-projects | menu3 | Teresa | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-dark | 08-projects | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 08-projects | right-panel | first-row | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 08-projects | create | Triage all new items for me | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-dark | 08-projects | ai | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature |
| admin-nw-northwind-admin-en-dark | 09-execution | menu2 | none | MISSING | ENV | the browser never reached a server: Failed to load resource: net::ERR_INTERNET_DISCONNECTED |
| admin-nw-northwind-admin-en-dark | 09-execution | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 09-execution | right-panel | first-row | FAIL | ENV | the browser never reached a server: Failed to load resource: net::ERR_INTERNET_DISCONNECTED |
| admin-nw-northwind-admin-en-dark | 09-execution | create | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 10-results | right-panel | first-row | FAIL | PRODUCT | non-PASS with no harness-contract evidence — counted as a product defect by default |
| admin-nw-northwind-admin-en-dark | 12-meeting | menu1 | /meeting | FAIL | PRODUCT | navigation landed on /meetings instead of /meeting |
| admin-nw-northwind-admin-en-dark | 12-meeting | menu2 | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 12-meeting | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 12-meeting | right-panel | first-row | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 12-meeting | create | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 13-organization | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 13-organization | right-panel | first-row | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 14-admin | menu2 | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 14-admin | right-panel | first-row | FAIL | PRODUCT | non-PASS with no harness-contract evidence — counted as a product defect by default |
| admin-nw-northwind-admin-en-dark | 15-settings | menu2 | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 15-settings | menu3 | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 15-settings | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 15-settings | right-panel | first-row | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 15-settings | create | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 16-partners | menu1 | /partner/dashboard | FAIL | PRODUCT | navigation landed on /partner?tab=partner-home instead of /partner/dashboard |
| admin-nw-northwind-admin-en-dark | 16-partners | menu2 | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 16-partners | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 16-partners | right-panel | first-row | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-dark | 16-partners | create | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 01-chat | menu2 | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 01-chat | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 01-chat | right-panel | first-row | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 01-chat | create | New conversation | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-light | 02-my-work | menu1 | /my-work | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-light | 02-my-work | menu2 | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 02-my-work | menu3 | Teresa | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-light | 02-my-work | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 02-my-work | right-panel | first-row | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 02-my-work | create | Triage all new items for me | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-light | 02-my-work | ai | Teresa | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-light | 03-interview | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 03-interview | create | Add files | FAIL | CONTRACT | control not interactable within the harness budget and the app reported no error |
| admin-nw-northwind-admin-en-light | 04-tools | ai | Teresa | FAIL | PRODUCT | the same control is fine in 1/2 comparable variants (same principal and locale, other theme) |
| admin-nw-northwind-admin-en-light | 05-assessment | create | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature |
| admin-nw-northwind-admin-en-light | 06-audits | menu2 | Conclusions | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-light | 06-audits | create | New audit | FAIL | CONTRACT | control not interactable within the harness budget and the app reported no error |
| admin-nw-northwind-admin-en-light | 08-projects | menu1 | /projects | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-light | 08-projects | menu2 | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 08-projects | menu3 | Teresa | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-light | 08-projects | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 08-projects | right-panel | first-row | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 08-projects | create | none | MISSING | CONTRACT | surface absent; single-variant evidence cannot separate a stale selector from a missing feature |
| admin-nw-northwind-admin-en-light | 08-projects | ai | Teresa | BLOCKED | PRODUCT | a view attempted a domain write (blocked before network) |
| admin-nw-northwind-admin-en-light | 09-execution | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 09-execution | right-panel | first-row | FAIL | PRODUCT | non-PASS with no harness-contract evidence — counted as a product defect by default |
| admin-nw-northwind-admin-en-light | 09-execution | create | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 10-results | right-panel | first-row | FAIL | PRODUCT | non-PASS with no harness-contract evidence — counted as a product defect by default |
| admin-nw-northwind-admin-en-light | 12-meeting | menu1 | /meeting | FAIL | PRODUCT | navigation landed on /meetings instead of /meeting |
| admin-nw-northwind-admin-en-light | 12-meeting | menu2 | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 12-meeting | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 12-meeting | right-panel | first-row | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 12-meeting | create | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 13-organization | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 13-organization | right-panel | first-row | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 14-admin | menu2 | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 14-admin | right-panel | first-row | FAIL | PRODUCT | non-PASS with no harness-contract evidence — counted as a product defect by default |
| admin-nw-northwind-admin-en-light | 15-settings | menu2 | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 15-settings | menu3 | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 15-settings | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 15-settings | right-panel | first-row | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 15-settings | create | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 16-partners | menu1 | /partner/dashboard | FAIL | PRODUCT | navigation landed on /partner?tab=partner-home instead of /partner/dashboard |
| admin-nw-northwind-admin-en-light | 16-partners | menu2 | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 16-partners | kebab | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 16-partners | right-panel | first-row | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
| admin-nw-northwind-admin-en-light | 16-partners | create | none | MISSING | CONTRACT | surface absent in all 2 comparable variants — selector or product contract, not a regression |
