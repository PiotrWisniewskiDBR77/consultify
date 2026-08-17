# Claude Next D — UI Runtime Acceptance (15 tasks)

## Prompt do uruchomienia od zera

Jesteś szefem autonomicznego toru wykonawczego **Claude D / UI Runtime Acceptance** dla Consultify. Pracujesz Opusem jako kierownik i recenzent, a Sonnetami jako wykonawcami. Nie kończysz na audycie ani rekomendacji: naprawiasz wszystkie technicznie wykonalne defekty i pracujesz aż każdy z 15 tasków przejdzie pełne właściwe DoD albo otrzyma literalny, dowiedziony `BLOCKED_HUMAN`/`BLOCKED_OWNER`.

### Start i izolacja

- Repo: `/Users/piotrwisniewski/Developer/consultify-recovery-canonical-20260816`
- Baseline integracyjny: `7d9c8d7de3200cce4314c88da4c5e20a578ddab3`
- Utwórz czysty worktree i branch `codex/closure-claude-d-ui-runtime-20260817` dokładnie z tego SHA.
- Przed pracą zapisz `git status --short`, HEAD, merge-base i diff względem baseline.
- Zakres produkcyjny: `src/**`, UI-testy, browser/E2E i dowody wyłącznie dla tasków poniżej. Nie edytuj backendowych routerów, serwisów ani migracji. Jeśli UI ujawni backendowy defekt, daj minimalny reproducer i change request dla integratora.
- Nie wykonuj merge, push, deploy ani release.

### 15 tasków

1. `ASM-UI-CANON-001` — Library → Assessment → pięć powierzchni → sesja → Outputs; realna nawigacja, reload i brak martwych CTA.
2. `TLS-UI-CANON-001` — Dynamic SWOT: create/edit/evidence/approve/freeze/promote/report; wszystkie stany i błędy bez false success.
3. `INT-UI-CANON-001` — Interview respondent/manager/owner, invite open, anonymous wall, revoke/expiry i cold deep-link.
4. `INI-UI-CANON-001` — candidate → Initiative, profile, portfolio, cards, lifecycle gates i przejście do Execution.
5. `EXE-UI-CANON-001` — plan/capacity/actions/evidence/four-eyes/close oraz widoczny receipt Results.
6. `MYW-AGT-UI-CANON-001` — Inbox/Tasks/Decisions/Agent: pusty/loading/error/forbidden/success, retry i brak wiszącego „uruchomiono”.
7. `CHAT-UI-CANON-001` — streaming, disconnect/cancel, retry, citations/trust bundle, handoff i bezpieczny provider failure.
8. `IDEA-WORKSPACE-SUBPACKET-001` — mindmap/process/table/whiteboard, persistence, reload, conversion i keyboard actions.
9. `MAT-UI-CANON-001` — DOC/PPT/XLSX create/edit/autosave/version/restore/export/download i exact artifact identity.
10. `MTG-UI-CANON-001` — transcript/proposal/human approval/materialization, recording OFF i niezatwierdzony brak zapisu.
11. `ORG-UI-CANON-001` — governed context document → claim → approve → publish → reopen; rola i tenant denial.
12. `ADM-UI-CANON-001` — members/roles/security, responsive drawer, keyboard, denial of privileged controls.
13. `SET-UI-CANON-001` — profile/language/theme/notifications/AI/MFA/export; save→reload oraz jawne provider/owner blockery.
14. `FIN-UI-CANON-001` + `RES-UI-CANON-001` — canonical deep links, flag OFF/ON truth, all primary states, tenant and role visibility without inventing policy.
15. `PRT-UI-CANON-001` + `UI-CANON-ALL-001` — Partner canonical panel oraz zbiorczy shell/accessibility/visual consistency gate wszystkich zbadanych modułów.

### DoD każdego tasku

- Real mounted frontend i backend, real PostgreSQL, bez request interception i bez wstrzykiwania stanu do localStorage.
- Co najmniej role OWNER/ADMIN/MEMBER oraz drugi tenant, jeżeli powierzchnia jest tenantowa.
- Desktop 1440×900, tablet 768×1024 i mobile 390×844; PL/EN oraz light/dark dla krytycznych ścieżek.
- Stany: loading, empty, success, validation, forbidden, conflict/stale, provider/backend error i reload/reopen.
- Axe: zero critical/serious na każdej zamontowanej powierzchni; keyboard-only focus order, Escape, focus return, nazwane kontrolki.
- Repo-owned screenshots z nazwą roli, języka, motywu, viewportu i exact SHA. Screenshot nie zastępuje asercji DOM ani readbacku.
- Focused component/E2E tests, type-check i build. Nie maskuj flaky przez retry; każdy retry raportuj.
- `TASK_EVIDENCE.json` zgodny z katalogiem bram: denominator, exit code, fixtures, negative controls, browser artifacts, cleanup, baselineSha i productSha.
- `DONE_CURRENT_SHA` tylko gdy wszystkie automatyczne G0–G6 właściwe dla tasku są zielone. Manual VoiceOver i named human visual review pozostają `BLOCKED_HUMAN`; nie udawaj ich automatem.

### Handoff

Zrób małe, logiczne commity. Na końcu: czysty worktree, `HANDOFF.md`, tabela 15/15 z werdyktem i blokerem, lista commitów, changed paths, pełne komendy i denominatory. Niczego nie scalaj ani nie wypychaj.
