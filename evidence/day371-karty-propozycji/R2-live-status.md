# R2 — żywy status karty tabeli

- RED na starym komponencie: test `ChatTableProposalCard shows the live executed proposal after remount with stale metadata` zakończył się `1 failed | 5 skipped`; UI nadal pokazał `Accept`.
- GREEN po naprawie: filtrowany pakiet `ChatTableProposalCard` zakończył się `2 passed | 4 skipped`.
- Mutacja odwrotna przez `cp`: stary `ChatTableProposalCard.tsx` ponownie dał RED; po przywróceniu kopii naprawionej `diff -u` był pusty i test wrócił do GREEN.
- Karta pobiera `getSchemaProposal(proposal.id)` na mount/zmianę id. Snapshot propsa jest fallbackiem, a `optimisticStatus` ma pierwszeństwo wyłącznie dla własnej akcji w bieżącej sesji.
- Błąd odczytu żywego statusu zachowuje snapshot/optymistyczny stan i emituje `console.error`; nie wywala renderu.
- `409` jest traktowane jako „wykonano” wyłącznie przy `err.data.code === 'PROPOSAL_ALREADY_EXECUTED'`; pozostałe błędy zachowują istniejący banner.
- `MessageRenderer` nie przekazuje już pustego callbacka. Świadomie loguje zmianę z `proposalId`; rodzic nie ma licencjonowanego trwałego magazynu, a prawdę po F5 zapewnia żywy GET w karcie.

Pułapki `§0.2e`: test jest RTL i nie dotyka DB/V8/auth. Dowodzi zachowania po pełnym unmount/remount ze starym `pending` w metadanych oraz żywym `executed` z API. Nie jest asercją tekstu źródła ani testem kliknięcia w tej samej instancji.
