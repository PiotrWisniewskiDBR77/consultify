# MTG-2a — meeting protocol document (DEC-607) — evidence 2026-09-17/18

Harness: `dev-render/` (real app shell, real `MeetingProtocolViewer`, transport-only
stub). Entry: `dev-render/meeting-protocol.html` → `meeting-protocol-main.tsx` →
`screens/meeting-protocol.tsx`. Server: `npx vite --config dev-render/vite.config.ts
--port 3020`. Theme via the app store + `.dark` class (NOT `emulateMedia`).

URL grammar: `/meeting-protocol.html?lang=en&theme=light|dark&case=draft|approved`

## Screenshots (1440×900, EN, deviceScaleFactor 2)

| file | state | theme | what it proves |
|---|---|---|---|
| `mtg2a-draft-en-light.png` | draft (nothing frozen) | light | Approve primary wired; Properties `Published: None`, `Status: Draft v1.0`; 8 blocks flow from data |
| `mtg2a-draft-en-dark.png` | draft | dark | same, dark tokens |
| `mtg2a-approved-en-light.png` | v1.0 published | light | `Approved v1.0` pill; Approve primary GONE; errata panel exposed; `Published: 1.0`, `Version: 1.1` (live next draft) |
| `mtg2a-approved-en-dark.png` | v1.0 published | dark | same, dark tokens |

## Console / network

Each `shot-*.log` is the `dev-render/shot.mjs` stdout. `KONSOLA-BLEDY` and
`SIEC-4XX5XX` are printed ONLY when non-empty; none of the four logs contain them
→ `bledyKonsoli=0` for every capture. (`.gitignore:336` ignores `evidence/**/*.log`;
the logs are force-added with `git add -f`.)

## W109b invariant visible on-screen

The approved state still reports `status: 'draft'` for the working view (the
document body is live from source), while `publishedVersion='1.0'` is what flips
the header pill to `Approved v1.0`, removes the Approve primary and exposes the
errata panel. Gating on `status` instead would show Approve here — it does not.
