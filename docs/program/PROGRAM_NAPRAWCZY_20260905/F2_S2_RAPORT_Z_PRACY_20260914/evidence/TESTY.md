# Dowody testowe E1

Wyniki uzyskane w worktree pakietu, bez stagingu:

- `npm run type-check:server` — PASS, 0 błędów;
- `npx esbuild src/components/Initiatives/InitiativeWorkReportView.tsx --bundle '--external:*' ...` — PASS po rebase, bundle 25.1 kB;
- `initiativeWorkReportService.test.ts --retry=0` — PASS 6/6 (PDF + pięć odrębnych kontraktów szablonów), rzeczywisty bufor `%PDF` z polskimi znakami;
- `initiativeWorkReportReader.test.ts --retry=0` — PASS 1/1;
- `scheduledInitiativeWorkReport.test.ts --retry=0` — PASS 3/3: prawdziwe komendy domenowe CREATE → VALIDATE → FREEZE → APPROVE → PUBLISH, PDF przekazany do mostu SMTP, odczyt dashboardu, częściowa porażka, retry tylko błędnego odbiorcy i brak duplikatu po sukcesie;
- `initiativeWorkReportEmail.realSmtp.test.ts --retry=0` — PASS 1/1, lokalne połączenie SMTP TCP i załącznik;
- `initiativeWorkReport.realdb.test.ts --retry=0` na PostgreSQL `cx-s2-work-report-pg`, port 6459 — PASS 1/1, tenant/project isolation i E2;
- `InitiativesHub.workReportFlag.test.tsx --retry=0` — PASS 3/3: OFF ukrywa kartę i deeplink, ON montuje prawdziwy kreator;
- hooki commitowe dla kandydata E1 — PASS: table canon, TRIADA, artifact, density, focus ratchet, flag env static i język EN/PL.

Ostrzeżenia `act(...)` w istniejącym teście hubu nie wpływają na wynik 3/3 i wymagają osobnej korekty harnessu.

- `reportDefinitions.adminGate.routes.test.ts --retry=0` — PASS 8/8, w tym MEMBER → 403 dla create/transition przebiegu;
- siedem skupionych plików testowych po rebase — PASS 23/23 (`--retry=0`);
- skan tokenów c-\* tylko w zmienionych ekranach względem `src/index.css` — PASS, 9/9 tokenów istnieje;
- zrzuty Vite/CUA: light 24 423 B, dark 24 732 B — wizualnie sprawdzone.

## Re-review delivery state

Odbiorcy są normalizowani i deduplikowani. Stan `PENDING/SENDING/DELIVERED/FAILED` jest utrwalany w agregacie `report_run` i outboxie po każdym kroku. Częściowa porażka pozostawia przebieg `APPROVED`; retry pomija `DELIVERED` i ponawia `FAILED`. `PUBLISH` jest dozwolony dopiero, gdy wszyscy odbiorcy mają `DELIVERED`.

## Trzeci re-review

- ręczna trasa HTTP: sukces A / porażka B / nowe kliknięcie z nowym clientRequestId — PASS; stabilny receipt per report run, A wysłany 1 raz, B 2 razy;
- recovery po crash: aktywny lease blokuje duplikat, wygasły lease jest przejmowany nowym tokenem fence — PASS;
- wybór approvera: MEMBER/suspended/self są odrzucani, active admin/owner/superadmin przechodzą — PASS;
- `scheduledInitiativeWorkReport.fullstack.realdb.test.ts`: produkcyjny runner → prawdziwy PDF → rzeczywisty EmailService → lokalny SMTP → trwały PostgreSQL → dashboard readback PUBLISHED/receipt/delivery state — PASS 1/1.
- obydwa dowody RealPG zostały powtórzone po rebase na `origin/integracja/20260911`: reader PASS 1/1, pełny runner/SMTP/dashboard PASS 1/1;
- `npm run type-check:server` po rebase — PASS, 0 błędów; `git diff --check` — PASS; 48 nowo użytych kluczy i18n ma parytet EN+PL.
