---
module_id: MODULE_DOCUMENTS
doc_kind: STATUS
version: 0.1
owner: user
status: canonical
last_updated: 2026-05-15
---

# Status — Dokumenty (Document Studio)

## Shipping status

- **Status**: soon (wkrótce; doc runtime w budowie)

## Known gaps (from existing SoT)

- Brakuje dopiętego, user-facing Document Studio flow (Mode 1 end-to-end) wg planu.
- Musi reuse’ować v8.1 substrate (zero nowych tabel / zero równoległego registry).

## Risks

- Ryzyko split-brain: osobny “Documents module” vs “Documents tab w Outputs” – kanoniczny dom artefaktów zostaje w Outputs.
- Ryzyko jakości: DOCX jest historycznie kruche (MVP-4 w planie jest high risk) — wymaga QA gates.

