# Initiatives → Execution exact-SHA evidence

Date: `2026-08-24`  
Decision: `TECHNICAL_INTEGRATION_PASS / OWNER_RETEST_REQUIRED / RELEASE_NOT_AUTHORIZED`

## Frozen identity

- Git SHA: `14da3e6d07578ca035daf62f1b7731cbb53dcfdb`
- Dirty fingerprint before runtime start: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Server: `http://127.0.0.1:4006`
- Client: `http://127.0.0.1:4007`
- Health / ready / frontend: `200 / 200 / 200`
- Database: `consultify_w3_initiatives_owner_execution_20260824`
- PostgreSQL endpoint: `127.0.0.1:35623`
- Successful migrations: `834`
- Migration chain SHA-256: `5216cb096d8e3c71060879cc8f479225f0ad9477a047af78ee5923150946d9e5`
- Runtime manifest: `/private/tmp/consultify-wave3-runtime-manifest-initiative-execution-clean2-20260824.json`
- Fixture manifest: `/private/tmp/consultify-wave3-initiatives-owner-execution-20260824.json`
- Fixture manifest SHA-256: `b68326464446c166e907de41b42a1d17dc67b4cfc8556e7874d65568539d1306`
- Authentication: real local login; test auth bypass, test gateway and test support disabled
- Production/Railway writes: none

## Canonical identity and SQL readback

- Initiative ID: `9e9962f6-87f5-4592-b037-4a0556a9dce3`
- Execution Case ID: `05000000-0000-4000-8000-000000000031`
- Visible initiative name: `Automatyzacja planowania przezbrojeń`
- Initiatives `1`; Execution links `1`; Execution relations `1`; complete runtime read models `1`
- Tasks `2`; decisions `1`; operational allocations `2`
- Management signals `1`; interventions `1`
- Report definitions `1`; report runs `1`
- Negative profile receipts `0`; negative Execution links `0`

The authenticated API returned the same canonical Initiative ID in the
Initiatives register and the active Execution Case. The Execution projection
displayed the same visible initiative name. The first attempted screenshot of
the Execution register was rejected because it was captured during loading;
the evidence below was recaptured only after the expected record was present.

## Browser evidence

| ID | Surface | Required visible readback | File | SHA-256 |
|---|---|---|---|---|
| `INI-EXE-001` | Initiatives register | `Automatyzacja planowania przezbrojeń` | `INI-EXE-001-initiatives-list.png` | `ebbbd79d85c75b215f0d758f08d912213bb98dd744442fb9716dd14d9d263b82` |
| `INI-EXE-002` | Execution / Realizacje | same canonical initiative | `INI-EXE-002-execution-list.png` | `939d79bb53054232381109ce221dfc9f6afca3b7927c62bfc2709453ff6772ee` |
| `INI-EXE-003` | Execution / Praca | `Zweryfikować kompletność danych` | `INI-EXE-003-work.png` | `06a370c64fdc00f1e21f58d4e4517c0f8f725a8df7a833a7fa7e89581807350a` |
| `INI-EXE-004` | Execution / Zasoby | `Bardzo dobre` | `INI-EXE-004-resources.png` | `8b2aa5b95057cf05956c8636a661a891c0b699c9f70761fae40e40b397f36a62` |
| `INI-EXE-005` | Execution / Sterowanie | `Odciążenie analityka` | `INI-EXE-005-control.png` | `3c065d493adcdbeade9aa5a506a4ce549ffc136f236f5dd968dcecce46a5b83d` |
| `INI-EXE-006` | Execution / Raporty | `Weekly Execution Pack` | `INI-EXE-006-reports.png` | `d171794e42bda083fd37c6ae268ebf826cbcc60d802464029579a123ee956bc1` |

## Qualification boundary

This packet proves current exact-SHA wiring, persistence/readback and the
non-empty desktop Polish browser path across Initiatives and all five Execution
surfaces. It does not prove the full 21-gate module acceptance, owner approval,
tablet/English/a11y coverage, final visual quality, AI/report workflows or
production release. The three-expert findings and all open owner observations
remain binding until individually remediated and retested.

## Visible residuals found in current screenshots

- `INI-EXE-002`: the lifecycle value is still rendered as English `Executing`
  inside the otherwise Polish screen.
- `INI-EXE-005`: the historical `Delivery closure and Results receipt` block is
  still displayed above the Control register.
- `INI-EXE-005`: owner and approver are exposed as raw UUIDs instead of stable,
  readable person labels.

These residuals prevent visual/product acceptance but do not invalidate the
canonical identity and persistence/readback proof above.
