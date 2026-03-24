# V8 Staging Evidence Directory

This directory stores artifacts collected during live staging execution.

## Expected artifacts

| File | Step | Content |
|------|------|---------|
| `01-preflight.txt` | 1 | Pre-flight check output |
| `02a-migration-dryrun.txt` | 2 | Migration dry-run output |
| `02b-migration-apply.txt` | 3 | Migration apply output |
| `03-migration-verify.txt` | 4 | Migration verify output |
| `04-enable-v8.txt` | 5 | Health check after V8 enable |
| `05-smoke-test.json` | 6 | Smoke test JSON results |
| `06-flags.txt` | 7 | Flag set/read responses |
| `07-shadow-1h.txt` | 8 | Shadow stats at 1h |
| `07-shadow-6h.txt` | 8 | Shadow stats at 6h |
| `07-shadow-24h.txt` | 8 | Shadow stats at 24h |
| `08-pilot-gate.json` | 9 | Promotion readiness + health + metrics |

## Security

Raw artifacts may contain tokens or DB URLs. They are `.gitignore`d by default. Only commit sanitized summaries.
