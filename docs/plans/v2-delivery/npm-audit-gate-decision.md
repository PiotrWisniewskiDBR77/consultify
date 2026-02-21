# npm-audit-gate — decyzja (2026-02-20)

## Kontekst
- `npm run test:l5` failuje na `npm-audit-gate` — unallowlisted high vulnerabilities
- Gate: `scripts/security/npm-audit-gate.ts` + allowlist `npm-audit-allowlist.json`
- Bez przejścia gate: L5 nie przechodzi, pipeline deploy blokowany

## Opcje

### A. Allowlist (szybkie odblokowanie)
**Co:** Dodać do `npm-audit-allowlist.json` pakiety z high/critical, które nie mają prostego fixa.
**Plusy:** Natychmiastowe odblokowanie L5, możesz jechać z Partner portal / referral.
**Minusy:** Ryzyko pozostaje; trzeba dokumentować każdą pozycję.

**Proponowana lista do allowlist (z uzasadnieniem):**
| Pakiet | Uzasadnienie |
|--------|--------------|
| @google-cloud/storage | fast-xml-parser w chain — fix wymaga bump @google-cloud; sprawdzić `npm audit fix` |
| @pact-foundation/pact | dev/test only; fix = major bump 16.x |
| @percy/cli | dev/test only; visual regression |
| eslint / @eslint/* | dev only; fix = typescript-eslint 8.x (breaking) |
| minimatch | transitive via eslint |
| archiver | production; sprawdzić `npm audit fix` |
| exceljs | production; sprawdzić `npm audit fix` |
| jspdf | production; sprawdzić `npm audit fix` |
| systeminformation | transitive; dev/diag |
| @sentry/node | production; sprawdzić bump |

### B. Remediation sprint (właściwe podejście)
**Co:** `npm audit fix` → test → targeted bumps dla pozostałych → allowlist tylko dla nie do naprawienia.
**Plusy:** Mniej długu, mniejsze ryzyko.
**Minusy:** Czas (szac. 1–2h), ryzyko regresji przy major bumps (pact, eslint).

**Sekwencja:**
1. `npm audit fix` (non-breaking)
2. `npm run test:l5` — czy gate przechodzi?
3. Jeśli nie: dla każdego offender — albo bump, albo allowlist z notatką

### C. Hybryda (rekomendowana)
1. **Teraz:** `npm audit fix` — zobacz ile się naprawi za darmo
2. **Allowlist** tylko te, które:
   - są dev/test-only (pact, percy, eslint) LUB
   - wymagają major bump z ryzykiem (np. pact 16.x)
3. **Backlog:** Osobny task „npm-audit remediation” — targeted bumps dla production deps (@google-cloud, exceljs, jspdf, archiver, sentry)

---

## Uwaga techniczna
`npm audit fix` może failować z ENOTEMPTY (np. przy iCloud/duplikatach w node_modules). W takim przypadku: `rm -rf node_modules && npm install` przed ponownym `npm audit fix`.

---

## Decyzja do podjęcia
- [ ] **A** — Allowlist wszystko, jedziemy dalej (Partner portal)
- [ ] **B** — Remediation sprint teraz, potem Partner portal
- [ ] **C** — Hybryda: `npm audit fix` + allowlist dev-only + backlog production

---

## Następny batch: Partner portal / referral / access codes
- **Bundle 28** (T096–T098): Partners program — toolkit, certification, outreach
- Flow’y: signup/attribution/discount, kody dostępu, partner endpoints
- Owner: Codex (wg planu)
- **Bloker:** npm-audit-gate — trzeba najpierw podjąć decyzję A/B/C
