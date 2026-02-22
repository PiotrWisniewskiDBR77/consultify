# Skip/Only Gate (L5)

## Cel
Kontrolować “test debt” i ryzyko fałszywego sygnału jakości (skippy / `.only`) w sposób audytowalny:
- `.only(...)` ma być **zawsze 0** (blokuje merge/CI).
- `*.skip(...)` w **smoke** ma być **0** (smoke = deterministyczny deploy gate).
- `*.skip(...)` w **unit** ma być **0**, chyba że jest **jawnie allowlisted** z datą wygaśnięcia.
- Skippy poza smoke/unit są **raportowane** (inventory) i nie blokują L5, dopóki nie zostaną zaostrzone.

## Implementacja
- Gate: `scripts/testing/skip-scan-gate.ts`
- Allowlist: `scripts/testing/skip-allowlist.json`
- Evidence: `test-results/skip-scan/skip-scan.report.json` + `test-results/skip-scan/skip-scan.report.md`

Raport zawiera:
- status gate (PASS/FAIL) + powody FAIL (jeśli występują),
- listę **blocked** (only / smoke skip / unit skip),
- listę **allowlisted** wraz z `reason` i `expiresOn`,
- inventory skipów poza smoke/unit (non-blocking),
- hygiene allowlist (expired + unused-active entries).

## Uruchomienie
```bash
npm run test:skip-scan
```

## Polityka allowlist
Allowlist to wyjątek i musi zawierać:
- `reason` (konkretna przyczyna biznes/tech),
- `expiresOn` (YYYY-MM-DD) — po tej dacie gate zacznie blokować.
