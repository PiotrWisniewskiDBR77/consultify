# Dowody testowe E1

Wyniki uzyskane w worktree pakietu, bez stagingu:

- `npm run type-check:server` — PASS, 0 błędów;
- `npx esbuild src/components/Initiatives/InitiativeWorkReportView.tsx ...` — PASS, bundle 23.9 kB;
- `initiativeWorkReportService.test.ts --retry=0` — PASS 1/1, rzeczywisty bufor `%PDF` z polskimi znakami;
- `initiativeWorkReportReader.test.ts --retry=0` — PASS 1/1;
- `scheduledInitiativeWorkReport.test.ts --retry=0` — PASS 1/1;
- `initiativeWorkReportEmail.realSmtp.test.ts --retry=0` — PASS 1/1, lokalne połączenie SMTP TCP i załącznik;
- `initiativeWorkReport.realdb.test.ts --retry=0` na PostgreSQL `cx-s2-work-report-pg`, port 6459 — PASS 1/1, tenant/project isolation i E2;
- `InitiativesHub.workReportFlag.test.tsx --retry=0` — PASS 3/3: OFF ukrywa kartę i deeplink, ON montuje prawdziwy kreator;
- hooki commitowe dla `7a7c238441` — PASS: table canon, TRIADA, artifact, density, focus ratchet, flag env static i język EN/PL.

Ostrzeżenia `act(...)` w istniejącym teście hubu nie wpływają na wynik 3/3 i wymagają osobnej korekty harnessu.
