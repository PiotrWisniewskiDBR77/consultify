# Host resource interruption

Final four-case Gateway/JWT/PostgreSQL rerun was interrupted before test execution by `ENOSPC` while Vitest transformed `my-work.routes.ts`; PostgreSQL then reported WAL `fdatasync` I/O failure. The same worktree and database had passed the preceding active-path run 3/3, plus service RealPG 6/6 and race RealPG 9/9. The two-API OFF parity proof completed before the interruption and is frozen separately. Docker currently cannot remove or restart the agent-owned container because containerd metadata writes return I/O error. No foreign container or worktree was touched.

After the CTO restarted the local Docker runtime, `cx-s1-v2-pg` returned healthy on `127.0.0.1:6454`, its restart policy was set to `unless-stopped`, and the final mounted ApiGateway/JWT/PostgreSQL suite passed 4/4. See `GATEWAY_JWT_REALPG.log`. The failed run remains recorded above as incident history.
