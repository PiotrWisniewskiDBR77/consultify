import type { NextFunction, Request, Response } from 'express';

export const EXECUTION_SPINE_LEGACY_READ_ONLY_CODE = 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED' as const;

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const GOVERNED_EXECUTION_CONTROL_COMMANDS = [
  // This is not a legacy delete anymore: executionBudgetDeleteCommandService
  // owns CAS, durable idempotency, terminal receipt, immutable action audit and
  // canonical absence readback. Keep the exception exact so no sibling legacy
  // execution-control mutation is reopened.
  { method: 'DELETE', path: /^\/budget\/entries\/[^/]+\/?$/ },
] as const;

/**
 * AMD-EXE-SPINE-AUTHORITY-004 (26A).
 *
 * Mount this only after the surface's normal authentication and tenant
 * membership middleware. Legacy execution readers remain available during
 * the compatibility window, but mutations must enter through Runtime-v1 so
 * there is exactly one execution-work writer and receipt lineage.
 */
export function requireCanonicalExecutionWriter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const method = String(req.method || '').toUpperCase();
  const path = String(req.path || '');
  if (
    READ_ONLY_METHODS.has(method) ||
    GOVERNED_EXECUTION_CONTROL_COMMANDS.some(
      (command) => command.method === method && command.path.test(path)
    )
  ) {
    next();
    return;
  }

  res.status(409).json({
    error: 'Legacy execution writes are retired. Use the canonical Runtime-v1 execution API.',
    code: EXECUTION_SPINE_LEGACY_READ_ONLY_CODE,
    canonicalWriter: '/api/initiatives/runtime-v1',
  });
}

/**
 * The Initiative router also owns discovery, authoring and governance APIs
 * which are not execution-work writers. Decision 26A retires only the legacy
 * execution subresources; it must not turn the whole Initiative product into
 * a read-only surface.
 */
/**
 * ZAWEZENIE 07.09 (DEC-453) — retirement nie moze wyprzedzac nastepcy.
 *
 * 26A mowi: mutacje maja wchodzic przez Runtime-v1, zeby byl DOKLADNIE JEDEN
 * writer pracy wykonawczej. Ta lista przez 19 dni wymieniala jednak takze
 * zasoby, dla ktorych kanoniczny writer NIE ISTNIAL albo pisal do INNEGO
 * modelu odczytu niz ten, ktory czyta ekran. Skutek zmierzony na zywo:
 * `Dodaj element` w RAID, kamieniach milowych, zasobach, planach obsady,
 * pozycjach budzetu, rolach bram i przeniesieniu inicjatywy odpowiadalo 409 i
 * NIC sie nie dzialo. Wlasciciel cofnal odbior Inicjatyw i Realizacji.
 *
 * Zasada, ktora ta lista teraz realizuje: sciezka zostaje wycofana WYLACZNIE
 * wtedy, gdy istnieje kanoniczna komenda Runtime-v1 pisząca do TEGO SAMEGO
 * modelu odczytu — albo gdy nikt jej nie wola.
 *
 * WYCOFANE, bo maja sprawdzonego nastepce:
 *   `raid` -> POST/PATCH/DELETE
 *   /api/initiatives/runtime-v1/initiatives/:id/raid-items/:raidItemId
 *   (pisze do tej samej tabeli `raid_items`, ktora czyta `GET .../raid`;
 *    dowod: zapisyInicjatyw.raidCanonical.pg.test.ts).
 *
 * WYCOFANE, bo NIKT ICH NIE WOLA (zmierzone grepem po `src/`, 0 wolaczy):
 *   start-execution, block, unblock, lifecycle-*, apply-template,
 *   apply-blueprint. Otwieranie martwej powierzchni nic nie daje.
 *
 * PRZYWROCONE (nastepcy brak lub pisze do innego modelu odczytu):
 *   milestones, resources, staffing-plans, budget-items, gate-roles, move.
 *   Kazda z nich wraca na liste wycofanych DOPIERO razem z kanoniczna
 *   komenda, ktorej zapis widac w tym samym czytniku co dzis.
 */
const LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS = [
  /^\/[^/]+\/(?:start-execution|block|unblock)\/?$/,
  /^\/[^/]+\/raid(?:\/.*)?$/,
  /^\/[^/]+\/(?:lifecycle-transition-proposals|lifecycle-transition-executions|lifecycle-gate-decisions)(?:\/.*)?$/,
  /^\/[^/]+\/(?:apply-template|apply-blueprint)\/?$/,
];

export function requireCanonicalInitiativeExecutionWriter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const method = String(req.method || '').toUpperCase();
  const path = String(req.path || '');
  if (
    READ_ONLY_METHODS.has(method) ||
    !LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS.some((pattern) => pattern.test(path))
  ) {
    next();
    return;
  }

  requireCanonicalExecutionWriter(req, res, next);
}
