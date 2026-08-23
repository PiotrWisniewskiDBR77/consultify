# Finance current-browser replay — 2026-08-23

- Integration source baseline: `90ab7b620e08bda9322813486cbc55337c566519`
- Visible local runtime marker: `LOCAL @cc8848eb7d33`
- Runtime: `http://127.0.0.1:4390`
- Review switches: `ff_wave3FinanceOwnerReview=1&sampleData=finance-vnext`
- Scope: five Finance registry surfaces only: Statements, Analysis, Models,
  Prediction and Enterprise valuation.
- Data boundary: `finance-vnext` is explicit, deterministic, reconstructible
  owner-review data. It is not persisted database evidence and does not prove
  detail-card readback, authentication, tenant isolation or production state.

| Evidence | SHA-256 | Proven observation |
| --- | --- | --- |
| `01-statements-register.png` | `b7ca638608756db0918c602328b4a4e8bcb9933cebf7ba87fcfccf7d2d8a3555` | Statements table mounts with one complete P&L / BS / CF pack and the domain CTA. |
| `02-analysis-register.png` | `95cd3d8784d40083e3fa7be4276f1c69e72c8ea5ea8e38d32d6517a1d9e325a5` | Analysis table mounts with draft and approved examples. |
| `03-models-register.png` | `de1db17c3ffb18ec0c2a66048bc5ac1529a4a873df962b3625059fc9d77fe361` | Models table mounts with one approved baseline. |
| `04-prediction-register.png` | `24fb0b3ae302dcd7e8b91563e5da5733777e8c5058a1fde39dd177865d8abf81` | Prediction table mounts with one review scenario. |
| `05-valuation-register.png` | `4c055407fa541c2c205e38ea9cba8a26affd450eb2e4b18fb8c170cbaf434ed2` | Enterprise valuation table mounts with one approved DCF case. |

Verification at capture time: root type-check `PASS`; `git diff --check`
`PASS`. Owner acceptance remains pending.
