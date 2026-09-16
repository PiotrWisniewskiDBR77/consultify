# CHAT-IMG-0 — receipt

Status: READY FOR CTO REVIEW

- Instruction: CTO channel W147.
- Base: `70d366f158`.
- Branch: `codex/chat-img-0-20260916`.
- Decision markers: `[ODMROZENIE 13_CHAT DEC-575]`, `[ODMROZENIE WSPOLNE DEC-575]`.

## Delivered behavior

- `POST /api/ai/attachments/ingest` rejects unsupported images with HTTP 415 and stable code `UNSUPPORTED_MEDIA_TYPE`, before extraction or persistence.
- The response uses `X-App-Language` first and `Accept-Language` as fallback; EN and PL messages are explicit and actionable.
- Authenticated multipart uploads retain authorization, organization, correlation, demo and app-language headers while leaving `Content-Type` to the browser boundary.
- Picker, paste and drop validate files before the composer renders a chip. Images receive a dedicated EN/PL message and never enter Recent or emit a false success toast.
- Image detection wins over misleading extension/MIME combinations, so `image/png` named `.txt` and `.png` labelled `text/plain` both fail closed.
- Supported document formats and the existing 25 MB document path remain unchanged.

## Evidence

- Focused frontend/API-client family: 4 files, 44/44 PASS.
- Real route middleware with real multer: 1 file, 11/11 PASS; EN and PL PNG requests return 415; `pgQuery`, `dbRun` and `recordAttachmentExtraction` remain at zero.
- Total focused: 5 files, 55/55 PASS.
- Locale JSON parse: PASS for EN and PL.
- Full TypeScript on the same dependency installation: frontend base RC=2 / 169, candidate RC=2 / 169, delta 0; server base RC=0 / 0, candidate RC=0 / 0, delta 0.
- `git diff --check`: PASS.
- Independent review after the first correction round: ACCEPT; all P1 findings fixed. The final coverage-only P2 was then closed with a direct `toast.success` non-call assertion and a 7/7 rerun of AddFilesMenu.

No staging writes, deploy, Railway changes, screenshots or protected-ref pushes were performed.
