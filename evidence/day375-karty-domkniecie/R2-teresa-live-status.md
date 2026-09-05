# R2 — TeresaProposalCard odświeża stan po remoncie

- Spór backendu: `server/src/routes/v8/teresa.routes.ts:43` importuje `teresaCopilotService` jako `teresaService`; akcja approve woła `teresaService.approveProposal` w linii 215. Grep `workCanvasService` w tym routerze zwrócił `ZERO_WORKCANVAS_W_TERESA_ROUTES`. Instrukcja ma rację, `ODBIOR_371.md` opisał niewłaściwy backend.
- Korekta instrukcji: `Api.getTeresaProposal` już istniało na markerze w `src/services/api.ts:2522-2531` (historyczny commit `67a6a7771b0`), dlatego `api.ts` pozostał nietknięty; nie utworzono duplikatu.
- Test zachowania używa tego samego obiektu `staleProposal` (`state: proposal`) w obu mountach. Mock `Api.getTeresaProposal` zwraca świeży `state: completed`.
- RED przed naprawą: `r2-before-red.json` — przypadek `TeresaProposalCard refreshes live state after remount with the same stale proposal` miał status `failed` (cała rodzina 5 pass / 2 fail, w tym zastany RED R3); SHA-256 `69fa9df03d613202809f3038caf6843174b91620479c313e555a4c63f08433b5`.
- GREEN po naprawie: `r2-after-green.json` — ten sam przypadek miał status `passed` (6 pass / 1 zastany fail R3); SHA-256 `86752677d335c8c44655cc47ab9cf96c5d81d807869796932f5506361b2c6284`.
- Mutacja: przywrócenie starego komponentu przez `cp` ponownie dało status `failed` (5 pass / 2 fail), SHA-256 `5e36761f997474420189d25974ddcf1c4f0ed28d716a425abc65cb06e400ac6f`.
- Przywrócenie naprawy: nowy przypadek ponownie `passed` (6 pass / 1 zastany fail R3), SHA-256 `ea5e8c1d27305adf7db16857dbdff7ba4af2452799eeed3537761796088c9ad4`.
- Cztery chronione przypadki (ChatTableProposalCard x2, ExecutionProposalMessage, GovernedChatHandoffCard) zachowały pełne nazwy i status `passed`; stary przypadek Teresy również pozostał `passed`. Jedyna nowa pełna nazwa to test live statusu powyżej; zero nazw zniknęło.
- Surowe JSON-y pozostają poza repo w `/private/tmp/cx-day375-karty-domkniecie-artefakty/`.
