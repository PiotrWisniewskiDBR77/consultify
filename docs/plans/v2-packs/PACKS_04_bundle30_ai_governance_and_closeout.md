## PACKS_04 — Bundle 30 (AI governance) + domknięcie V2 (3 agentów)

### Agent A — T116 Prompt SSOT + learning loop
- **Wejście**: `bundle-30e-ai-prompt-ssot-only` (lub `bundle-30e-ai-prompt-ssot`)
- **Zakres**:
  - Merge do integracji.
  - `npm run verify:quick`
  - Sprawdzić, że prompt registry/assembler nie psuje runtime.

### Agent B — T117 System brain / citations / drift
- **Wejście**: `bundle-30f-system-brain-citations`
- **Zakres**:
  - Merge do integracji.
  - `npm run verify:quick`

### Agent C — T118–T122 Context governance + consolidation + hardening
- **Wejście**: `bundle-30g-ai-context-governance`
- **Zakres**:
  - Merge do integracji.
  - `npm run verify:quick`
  - Sprawdzić, że polityki kontekstu nie blokują podstawowych flow.

---

## Domknięcie “122/122 Done” (po merge’ach)
- Zrekonsyliować Notion vs repo (Status systemu = Done tylko gdy merge + bramki + (docelowo) deploy).
- Ustalić co jest “EXTRA/content” (T074–T085, T088) i nie wliczać do 122/122.

