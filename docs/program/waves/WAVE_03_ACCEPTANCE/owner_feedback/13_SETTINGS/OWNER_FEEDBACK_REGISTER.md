# Settings — owner feedback register

Date opened: `2026-08-21`

## SET-OWN-001 — Permanently remove the floating Help shortcut

- Module: `Settings`
- Screen: `Settings → Profile`
- Route: `NOT VERIFIED`
- Category: `UI / UX / NAVIGATION / VISUAL CLUTTER`
- Piotr's original wording (verbatim):

  > Tutaj jest mały przycisk informacyjny, skrót do Helba. Usuń go trwale.

- Current behavior:
  - a small red circular information/help control is displayed immediately below
    the `Save Changes` button on the Settings Profile screen;
  - according to Piotr, the control is a shortcut to Help;
  - its destination and technical implementation were not verified during intake.
- Expected experience:
  - the floating Help shortcut is absent from Settings Profile and every other
    Settings child screen where the same global control is injected;
  - removing it leaves no empty spacer, overlay, focus stop, tooltip, hot zone or
    invisible accessible control;
  - Help remains available only through the separately approved canonical Help
    entry point, if such an entry point is retained by product decision.
- Impact: the unrequested floating shortcut adds visual noise next to the primary
  save action and can be mistaken for form status or validation help.
- Proposed importance: `MEDIUM`
- Evidence: `SET-EVD-001`
- Acceptance criteria: `SET-HELP-AC-001` through `SET-HELP-AC-004`
- Status: `CAPTURED_UNRECONCILED`

### Acceptance criteria

| ID | Criterion | Status |
|---|---|---|
| `SET-HELP-AC-001` | No visible floating Help/information shortcut is rendered on Settings Profile | `NOT_TESTED` |
| `SET-HELP-AC-002` | The removed control leaves no empty layout space, overlay or clickable hot zone | `NOT_TESTED` |
| `SET-HELP-AC-003` | Keyboard and accessibility-tree inspection contain no orphaned focusable Help control | `NOT_TESTED` |
| `SET-HELP-AC-004` | All Settings child screens are replayed to confirm the same shortcut is not injected elsewhere | `NOT_TESTED` |

## Counters

- Observations: `1`
- Evidence items: `1`
- Fixed: `0`
- Accepted: `0`
