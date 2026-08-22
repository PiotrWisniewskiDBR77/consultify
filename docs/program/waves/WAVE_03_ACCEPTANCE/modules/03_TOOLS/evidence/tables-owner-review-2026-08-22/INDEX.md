# Tools tables — owner-review evidence index

Date: 2026-08-22
Product marker visible in screenshots: `LOCAL @f3237e942304`
Classification: owner-review visual evidence; not persistence or functional proof.

| Evidence ID | Surface | File | SHA-256 | Supports |
|---|---|---|---|---|
| `TLS-TBL-EVD-001` | Library | `TLS-TBL-EVD-001-library.png` | `1e79190a29e97ca02881fcf5a24547ba3e05989f076305c72c9c983c4e15630e` | Accepted library/table baseline. |
| `TLS-TBL-EVD-002` | Sessions | `TLS-TBL-EVD-002-sessions.png` | `7d9f4010ef84e828fc036104af59af5a1ec52c118581af52ef910b3c6abe15c7` | Accepted Sessions table baseline and source-session population. |
| `TLS-TBL-EVD-003` | Outputs | `TLS-TBL-EVD-003-outputs.png` | `601f9a27eb1ed2f49a75d7cf362eea48870ac9326ac5c8a4f03977b441f7422f` | Current Outputs incorrectly presents report-like objects and unknown statuses rather than tool insights. |
| `TLS-TBL-EVD-004` | Reports | `TLS-TBL-EVD-004-reports.png` | `ab93a4ff9e3eed658b60138e94663cc35c15d3e651879864871afa72b60a1fca` | Reports duplicates the same report rows; the intended document/report table and creator boundary are not established. |
| `TLS-TBL-EVD-005` | Initiatives | `TLS-TBL-EVD-005-initiatives.png` | `a386f0b2ba432b54f3928654a5966e2e67fffd51065d3d1a8f2a1c0c3f2fc845` | Existing initiative list baseline; owner decision requires the shared Initiative Creator with Tools-specific eligible sources and lineage. |

## Owner semantic decision captured

- `Sessions` contains performed tool sessions.
- Only approved sessions may become sources for tool insights.
- `Outputs` is to be named and modeled as **Insights**: conclusions derived from
  approved tool sessions through the Insight creator.
- `Reports` contains generated Word, PowerPoint or Excel documents created from
  a tool session and/or its approved insights, with or without a template.
- Reports depend on a functioning canonical document-generation contract; the
  current duplicated surface is not acceptance evidence for that contract.
- `Initiatives` reuses the same canonical Initiative Creator as Interview. The
  domain difference is the source/context adapter, not a new wizard shell.
