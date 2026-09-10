/**
 * Czlonkostwo TWORCY w nowo zalozonym projekcie.
 *
 * POWOD ISTNIENIA — blokada pilotazu, pomiar 10.09 na zywym stagingu
 * (baza pgvector, 15 organizacji, 40 projektow):
 *
 *   23 z 25 projektow majacych `owner_id` NIE mialy tego wlasciciela
 *   w `project_members`. Jedyne dwa wyjatki to projekty Northwind, gdzie
 *   czlonkow wstawia SEED danych pokazowych — czyli „w Northwind dziala"
 *   bylo wlasciwoscia fikstury, a nie regula systemu.
 *
 * Przyczyna: KAZDA sciezka tworzenia projektu robila `INSERT INTO projects`
 * i nic wiecej:
 *   - `ProjectController.createProject` (POST /api/projects — reka czlowieka),
 *   - `resolveOrCreateSystemPortfolioProject` (kontener „Portfel — inicjatywy
 *     bezposrednie", zakladany leniwie przez potok AI/tla),
 *   - `CreateProjectHandler` (CQRS, uzywany przez `discovery.routes.ts`).
 *
 * Skutki widziane przez uzytkownika w SWIEZEJ organizacji:
 *   - `POST .../source-proposals` → 422 `INITIATIVE_OWNER_INELIGIBLE`
 *     (walidacja wlasciciela inicjatywy),
 *   - zespol projektu pusty, wiec pojemnosc (`CapacityController`,
 *     `my-work.routes` przeciazenia) liczy sie z zera,
 *   - role bramek inicjatywy nie maja z kogo sie rozwinac
 *     (`InitiativeController` mapuje role z `project_members`),
 *   - przydzial wywiadu do osoby spoza `project_members` → 403.
 *
 * KONTRAKT: idempotentny. Wywolanie dla pary (projekt, uzytkownik), ktora juz
 * ma wiersz, NIE zmienia istniejacej roli ani alokacji — `ON CONFLICT DO
 * NOTHING` — wiec ponowne wywolanie nie potrafi zdegradowac uprawnien osoby,
 * ktorej role ktos w miedzyczasie podniosl lub obnizyl reka.
 *
 * FAIL-SOFT: blad zapisu jest logowany i polykany. Tworzenie projektu nie moze
 * sie wywrocic na ksiegowosci czlonkostwa — to ta sama postawa, ktora ma juz
 * `initiativeProjectPolicyService`.
 *
 * `id` jest nadawane JAWNIE: na stagingu kolumna `project_members.id` jest
 * NOT NULL i NIE ma wartosci domyslnej (zmierzone 10.09), choc lokalna baza
 * testowa domyslna wartosc ma. Poleganie na defaulcie wywrocilo by zapis
 * dokladnie tam, gdzie ma dzialac.
 */
import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

/** Rola, ktora dostaje zalozyciel projektu. */
export const PROJECT_CREATOR_ROLE = 'PROJECT_MANAGER';

export async function ensureProjectOwnerMembership(
  projectId: string | null | undefined,
  userId: string | null | undefined,
  opts: { projectRole?: string } = {}
): Promise<boolean> {
  const project = String(projectId || '').trim();
  const user = String(userId || '').trim();
  if (!project || !user) return false;

  try {
    await queryHelpers.queryRun(
      `INSERT INTO project_members (id, project_id, user_id, project_role, normalized_project_role, allocation_percent, permissions, added_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [
        uuidv4(),
        project,
        user,
        opts.projectRole || PROJECT_CREATOR_ROLE,
        opts.projectRole || PROJECT_CREATOR_ROLE,
        100,
        JSON.stringify({}),
        user,
      ]
    );
    return true;
  } catch (err) {
    logger.warn(
      `[projectOwnerMembership] nie udalo sie dopisac tworcy do project_members (pominieto): ${
        (err as Error)?.message || err
      }`
    );
    return false;
  }
}
