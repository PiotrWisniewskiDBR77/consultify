# R1 — pomiar rodziny kart propozycji

Komenda:

`RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/components/AIChat/__tests__/day371.proposalFamily.remount.test.tsx --retry=0 --reporter=verbose`

Wynik przed naprawami: `2 failed | 3 passed (5)`.

| Komponent | Źródło stanu | Wynik remontu | Decyzja |
| --- | --- | --- | --- |
| `ChatTableProposalCard` | lokalne `executed`/`rejected`, inicjalnie `false` | RED: po remoncie status `executed` nadal pokazuje `Accept` | naprawiam w R2 żywym `getSchemaProposal` |
| `TeresaProposalCard` | prop synchronizowany `useEffect`, render z `currentProposal.state` | GREEN: `completed` | nie wymaga |
| `ExecutionProposalMessage` | żywy `useProposalLifecycle`, fallback do metadanych | GREEN: żywy `executed` wygrywa ze snapshotem `pending_review` | nie wymaga |
| `GovernedChatHandoffCard` | bezpośrednio `proposal.state` | GREEN: `materialized` | nie wymaga |
| `GovernedInitiativeHandoffCard` | wyłącznie lokalny `state='idle'`; brak propsa stanu adopcji | RED: przekazany stan `adopted` jest ignorowany | STOP merytoryczny: brak licencjonowanego źródła prawdy o adopcji; test i brief, bez zmiany produktu |

Pułapki `§0.2e`: pakiet jest czysto jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`), nie przechodzi przez V8/auth/PG. Dla `ChatTableProposalCard` test mierzy remount, a nie akcję w tej samej instancji. Dla `ExecutionProposalMessage` mock żywego magazynu dowodzi pierwszeństwa świeżego lifecycle nad snapshotem.
