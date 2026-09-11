/**
 * Wspoldzielona obietnica „w locie" (dedupe), bez pamieci podrecznej.
 *
 * DLACZEGO (pomiar wydajnosci stagingu 2026-09-11,
 * `docs/program/PRZEKAZANIE_KODOWANIA_20260907/POMIAR_WYDAJNOSCI_STAGING_20260911.md`,
 * Realizacja LCP 11,4 s): ekran Realizacji odpala szesc torow menedzera
 * (`/execution-control/manager/lanes/<lane>/problems`) w efekcie, ktorego lista
 * zaleznosci zawiera `currentProjectId`. Identyfikator projektu ustala sie PO
 * pierwszym renderze, wiec efekt wykonuje sie dwa razy i te same szesc zapytan
 * leci dwukrotnie — dwanascie zadan HTTP zamiast szesciu, wszystkie o te sama
 * odpowiedz, wszystkie w tym samym momencie.
 *
 * KONTRAKT — to NIE jest cache:
 *  · wolajacy, ktory trafi na zadanie JUZ LECACE pod tym samym kluczem, dostaje
 *    TE SAMA obietnice (jedno zadanie sieciowe, dwie odpowiedzi w kodzie),
 *  · wpis znika w chwili rozstrzygniecia (`finally`), wiec KAZDE kolejne
 *    wywolanie — w tym recznie wywolane odswiezenie — pobiera dane od nowa.
 *    Gdyby wynik zostawal, „Odswiez" przestaloby cokolwiek robic.
 *  · odrzucenie propaguje sie do wszystkich wolajacych, tak samo jak przy
 *    osobnych zadaniach; nie zamieniamy bledu na cisze.
 */
const inFlight = new Map<string, Promise<unknown>>();

export function dedupeInFlight<T>(key: string, start: () => Promise<T>): Promise<T> {
  const running = inFlight.get(key);
  if (running) return running as Promise<T>;
  const promise = (async () => start())().finally(() => {
    // Usuwamy TYLKO wlasny wpis — gdyby w miedzyczasie ruszylo kolejne zadanie
    // pod tym kluczem, skasowanie po samym kluczu zabiloby cudza obietnice.
    if (inFlight.get(key) === promise) inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

/** Tylko dla testow — czysci rejestr miedzy przypadkami. */
export function __resetInFlightDedupe() {
  inFlight.clear();
}
