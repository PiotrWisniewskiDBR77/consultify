# S1.11 — proposal for `demo-safe-20260915`

Status: **PROPOSAL ONLY. No tag was created or pushed by Codex.**

The owner accepted the five W70 screens on 15.09. Their live staging evidence was captured on
`bb6735d713cdda8ed42e643a6b22ec38cdaa78df`:

1. `flagi-20260915/zrzuty/01-inicjatywy-lista.png` — Initiatives list and the enabled Work report / analysis / parking navigation.
2. `flagi-20260915/zrzuty/02-inicjatywy-analiza-portfela.png` — portfolio analysis empty state.
3. `flagi-20260915/zrzuty/03-inicjatywy-parking-po-naprawie.png` — working Parking table after the server-side flag fix.
4. `flagi-20260915/zrzuty/04-inicjatywy-raport-z-pracy.png` — work reports table.
5. `flagi-20260915/zrzuty/05-wywiad-lista.png` — Interview inbox with Approved and Sent back states.

The accepted F4 screens are present on line SHA
`652e3c458c83539b48f8b080defaa24ba888374e`:

- `fala-f4-20260915/zrzuty/PO-powloka-light.png` and `PO-przyciski-light.png` — Ideas Process Flow workspace, canonical Panel / Work with AI controls.
- `fala-f4-20260915/zrzuty/PO-drd-powloka-light.png` and `PO-drd-przycisk-light.png` — the same control contract in the DRD workspace.

The accepted E2b screens are present on line SHA
`8767bbdd58f9f76d66e3556c4af249a3c2a70d8e`:

- `odbior-e2b2-d3-20260915/zrzuty/wywiad-lista-en-light.png`.
- `odbior-e2b2-d3-20260915/zrzuty/inicjatywy-lista-en-light.png`.
- `odbior-e2b2-d3-20260915/zrzuty/czat-en-light.png`.

`8767bbdd58f9f76d66e3556c4af249a3c2a70d8e` contains both earlier accepted line SHAs
(`bb6735d713...` and `652e3c458c...`) and is therefore the narrowest verified line candidate that
contains all three accepted groups. The later integration tip also contains work outside this
acceptance set and is not proposed here.

CTO-only command proposal, to execute only after CTO verifies the target again:

```bash
git tag -a demo-safe-20260915 8767bbdd58f9f76d66e3556c4af249a3c2a70d8e -m "Owner-accepted screens 2026-09-15: W70 flags, F4, E2b"
git push origin refs/tags/demo-safe-20260915
```

Precondition measured while preparing this proposal: `demo-safe-20260915` did not exist locally
and `git ls-remote --tags origin refs/tags/demo-safe-20260915` returned no remote ref. This document
does not authorize overwriting an existing tag if that state changes.
