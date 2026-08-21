# Wave 3 — master status register

Last updated: `2026-08-21`

| Order | ID | Module | Current gate | Product SHA | Owner register | Open P0 | Open P1 | Open P2 | Open P3 | Owner verdict | Regression |
|---:|---|---|---|---|---|---:|---:|---:|---:|---|---|
| 1 | `ORG` | Organization | `READY_FOR_OWNER_REVIEW` | `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c` | `0` | 0 | 0 | 0 | 0 | — | preflight 4 resolved; localization finding open |
| 2 | `INT` | Interview | `TECHNICAL_PREFLIGHT` | `d3d6de5bfc` source candidate; mount pending | `G00–G04 PASS/PASS_FOR_PREFLIGHT; G05 IN_PROGRESS; 104/104 focused PASS` | 0 | 0 | 0 | 0 | `INT-PF-001..002 fixed; owner fixture READY` | Organization owner screen intentionally retained |
| 3 | `TLS` | Tools | `TECHNICAL_PREFLIGHT_WITH_OWNER_QUALITY_DEBT` | `dcbc89fde0` source candidate; mount pending | `G00–G04 PASS/PASS_FOR_PREFLIGHT; G05 PASS_WITH_TEST_WARNING; 1 owner carry-forward` | 0 | 0 | 1 | 0 | `TLS-PF-001..002 fixed; TLS-PF-003 open; owner fixture READY` | Organization owner screen intentionally retained |
| 4 | `ASM` | Assessment | `TECHNICAL_PREFLIGHT` | `91e8a51639` source candidate; mount pending | `G00–G03 PASS/PASS_FOR_PREFLIGHT; G04–G05 IN_PROGRESS; 75/75 focused PASS` | 0 | 0 | 0 | 0 | `ASM-PF-001 fixed; guided owner fixture READY; frozen alternate pending` | Organization owner screen intentionally retained |
| 5 | `INI` | Initiatives | `TECHNICAL_PREFLIGHT` | `75f84fc3d9` source candidate; mount pending | `G00–G03 PASS/PASS_FOR_PREFLIGHT; G04–G05 IN_PROGRESS; 208/208 focused PASS` | 0 | 0 | 0 | 0 | `INI-PF-001..002 fixed; INI-PF-003 open; owner fixture pending` | Organization owner screen intentionally retained |
| 6 | `EXE` | Execution | `TECHNICAL_PREFLIGHT` | `9ce72577f9` source candidate; mount pending | `G00–G03 PASS/PASS_FOR_PREFLIGHT; G04–G05 IN_PROGRESS; 137/137 PASS` | 0 | 0 | 0 | 0 | `EXE-PF-001..003 fixed; EXE-PF-004 open; owner fixture pending` | Organization owner screen intentionally retained |
| 7 | `MYW` | My Work / Agent | `NOT_STARTED` | — | `0` | 0 | 0 | 0 | 0 | — | — |
| 8 | `MTG` | Meetings | `NOT_STARTED` | — | `0` | 0 | 0 | 0 | 0 | — | — |
| 9 | `RES` | Results | `NOT_STARTED` | — | `0` | 0 | 0 | 0 | 0 | — | — |
| 10 | `FIN` | Finance | `NOT_STARTED` | — | `0` | 0 | 0 | 0 | 0 | — | — |
| 11 | `MAT` | Materials | `NOT_STARTED` | — | `0` | 0 | 0 | 0 | 0 | — | — |
| 12 | `AUD` | Audits | `NOT_STARTED` | — | `0` | 0 | 0 | 0 | 0 | — | — |
| 13 | `CHAT` | Chat | `NOT_STARTED` | — | `0` | 0 | 0 | 0 | 0 | — | — |
| 14 | `ADM` | Admin | `NOT_STARTED` | — | `0` | 0 | 0 | 0 | 0 | — | — |
| 15 | `SET` | Settings | `NOT_STARTED` | — | `0` | 0 | 0 | 0 | 0 | — | — |
| 16 | `PRT` | Partner | `NOT_STARTED` | — | `0` | 0 | 0 | 0 | 0 | — | — |

## Update rule

The module register is authoritative for finding detail. This table is updated
only after reconciling its counts and gate against that file. Never change a
count to make a dashboard look green.
