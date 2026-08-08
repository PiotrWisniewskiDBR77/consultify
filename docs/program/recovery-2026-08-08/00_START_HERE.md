# START HERE — Consultify recovery control

Ten katalog jest jedynym kanonicznym pakietem przekazania dla sprzątania trzech przebudów z 2026-08-08.

## Obowiązujący status

- Agent V8: `READY_FOR_RECOVERY_RECONSTRUCTION`
- Documents: `READY_FOR_RECOVERY_RECONSTRUCTION`
- Report B / UI: `READY_FOR_RECOVERY_RECONSTRUCTION`
- Shared-file integrator: `PAUSED`
- Merge, staging, demo, production i zmiany bazy: `NO_GO`

## Kolejność czytania

1. `00_START_HERE.md`
2. `01_CLEANUP_AND_RESUME_PLAN.md`
3. `02_EXECUTION_REGISTER.md`
4. właściwy pakiet z `03_AGENT_RECOVERY_PACKETS.md`
5. `FILE_OWNERSHIP_MATRIX.tsv`
6. jeżeli plik jest współdzielony: `SHARED_FILE_INTEGRATOR_SCOPE.tsv`
7. przed pierwszym commitem: `04_AGENT_DELIVERY_GATE.md`

## Zasada startowa

Agent nie rozpoczyna pracy, dopóki nie otrzyma dokładnie jednego z trzech recovery worktree oraz jednego ownera z macierzy:

| Tor | Dozwolony owner |
|---|---|
| Agent V8 | `AGENT_V8` |
| Documents | `DOCUMENTS` |
| Report B / UI | `REPORT_B_UI` |

`SHARED_FILE_INTEGRATOR`, `EVIDENCE_OWNER` i `GOVERNANCE_OWNER` są poza zakresem agentów A–C.

## Recovery worktree na maszynie CTO

| Tor | Ścieżka | Branch |
|---|---|---|
| Agent V8 | `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-recovery/2026-08-08/agent-v8` | `codex/recovery-agent-v8-20260808` |
| Documents | `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-recovery/2026-08-08/documents` | `codex/recovery-documents-20260808` |
| Report B / UI | `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-recovery/2026-08-08/report-b-ui` | `codex/recovery-report-b-ui-20260808` |

Wszystkie trzy zaczynają z baseline `3b0c337ee472d07122033d5339cdf3bdb2f254ee` i były czyste w chwili wydania pakietu.

## Zakazy

- Nie pracuj w starym głównym checkoutcie.
- Nie czyść ani nie usuwaj worktree z rejestru kwarantanny.
- Nie dotykaj plików innego ownera.
- Nie przenoś całych historycznych branchy.
- Nie wykonuj merge, push, deploy, restartu ani zmian bazy.
- Nie uznawaj lokalnego builda za release acceptance.

## Wymagany raport końcowy

```text
READY_FOR_CODEX_REVIEW
Track:
Worktree:
Branch:
Baseline SHA:
HEAD SHA:
Changed files:
Tests and exact results:
Negative controls:
Excluded shared files:
Known risks:
Deploy performed: NO
Database mutation performed: NO
```

Jeżeli zakres, owner albo źródło wersji jest niejasne, agent kończy `BLOCKED` i nie zgaduje.

## Ochrona danych

Pełny snapshot 14 brudnych worktree, bundle wszystkich referencji Git i checksumy pozostają w sejfie CTO poza tym branchem. Pakiet przekazania nie zawiera ciężkich artefaktów ani potencjalnych danych lokalnych. Stare drzewa mają status `QUARANTINE_DO_NOT_DELETE` do czasu odbioru rekonstrukcji.

Po ponownym naruszeniu izolacji wykonano drugie zatrzymanie. Aktualnym punktem odzyskiwania jest zweryfikowany snapshot 17 brudnych worktree:

`/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-snapshots/2026-08-08_181821_five-agent-stop`

Pięć nowych rozmów należy uruchamiać wyłącznie promptami z `05_FIVE_AGENT_SAFE_RESTART.md`.
