/**
 * UZUPEŁNIENIE INSIGHTÓW (`tool_outputs`) DLA JUŻ ZATWIERDZONYCH SESJI.
 * 1.1-T1 (DEC-412), uwaga właściciela 06.09: „nie tworzy insightów tak
 * naprawdę. Nie ma tutaj generatora insightów."
 *
 * PRZYCZYNA, KTÓRĄ TEN SKRYPT SPRZĄTA. Do 06.09 `ensureToolOutputSnapshot`
 * miał JEDEN wołacz — `ToolController.promoteToOutput` (POST
 * /api/tools/:toolId/promote), czyli osobną, ręczną promocję do
 * raportu/prezentacji/inicjatywy. Samo zatwierdzenie sesji nie tworzyło
 * niczego, więc na stagingu było 53 sesje APPROVED i ZERO wierszy
 * `tool_outputs`. Od 1.1-T1 `approveTool` tworzy snapshot sam — ale tylko
 * dla sesji zatwierdzanych OD TERAZ. Ten skrypt domyka zaległość.
 *
 * NIE POWIELA LOGIKI. Woła dokładnie tę samą funkcję co serwer
 * (`ensureToolOutputSnapshot`): ten sam kernel lifecycle
 * (draft → in_review → approved), ten sam hash treści, ten sam most
 * silnikowy dla `dynamic-swot` i ta sama, uczciwie pusta treść dla narzędzi
 * bez mostu. Zero surowych INSERT-ów do `tool_outputs`.
 *
 * IDEMPOTENCJA jest bazodanowa, nie umowna: indeks częściowy
 * `uq_tool_outputs_active_snapshot_per_session` (migracja 947) dopuszcza
 * jeden aktywny snapshot na sesję. Powtórny `--apply` daje 0 nowych wierszy,
 * a `--dry-run` po nim wypisuje 0 kandydatów — to jest test odbioru.
 *
 * UŻYCIE (nadzorca — staging; robotnik — wyłącznie baza lokalna):
 *   DB_TYPE=postgres NODE_ENV=development CI=true DOTENV_DISABLED=1 \
 *   DATABASE_URL=… npx tsx server/scripts/higiena-wlasciciela/uzupelnij-tool-outputs.ts \
 *     --org=<nazwa|uuid> --dry-run
 *   …ten sam wiersz z `--apply` (zapisuje manifest w evidence/higiena-danych/)
 *
 * NODE_ENV=test JEST PUŁAPKĄ: bez RUN_DB_TESTS=1 warstwa bazy podstawia
 * atrapę pod `queryHelpers`, skrypt zamelduje sukces i nie zapisze nic.
 *
 * DWA DOSTĘPY CELOWO. Kandydaci i weryfikacja idą przez własny `pg.Pool`
 * (`wspolne.ts`), a zapis przez `queryHelpers` — czyli tor produkcyjny.
 * Gdyby zapis poszedł do atrapy, niezależny SELECT tego nie zobaczy i
 * skrypt zakończy się błędem zamiast fałszywym „gotowe".
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  EmptyToolOutputError,
  ensureToolOutputSnapshot,
  ToolOutputPersistenceUnavailableError,
} from '../../src/services/tools/toolOutputSnapshotService.js';

import { EVIDENCE_DIR, ensureEvidence, iso, parseCli, pool, resolveOrg } from './wspolne.js';

/** Statusy sesji, z których wolno zamrozić insight — identycznie jak w
 *  `ToolController.promoteToOutput` / `createToolInsight`. */
const ZATWIERDZONE = ['APPROVED', 'GENERATED', 'FINALIZED'];

type Kandydat = {
  id: string;
  name: string;
  tool_type: string;
  status: string;
  approved_at: string | null;
};

type WpisManifestu = {
  toolSessionId: string;
  sessionName: string;
  toolType: string;
  toolOutputId: string | null;
  wynik: 'utworzony' | 'pominiety';
  powod?: string;
};

async function main(): Promise<void> {
  const { org: orgNeedle, mode } = parseCli();
  if (mode.kind === 'rollback') {
    throw new Error(
      'Ten skrypt nie ma trybu --rollback: usuwanie zamrożonych insightów to decyzja ' +
        'właściciela, nie automat. Manifest z --apply wymienia utworzone id.'
    );
  }

  const p = pool();
  const c = await p.connect();
  try {
    const org = await resolveOrg(c, orgNeedle);
    console.log(`PLAN · uzupelnij-tool-outputs · ${org.name} (${org.id}) · ${mode.kind}`);

    const kandydaci = (
      await c.query<Kandydat>(
        `SELECT ts.id, ts.name, ts.tool_type, ts.status, ts.approved_at::text AS approved_at
           FROM tool_sessions ts
          WHERE ts.organization_id = $1
            AND upper(ts.status) = ANY($2::text[])
            AND NOT EXISTS (
                  SELECT 1 FROM tool_outputs o
                   WHERE o.tool_session_id = ts.id
                     AND o.organization_id = ts.organization_id
                     AND o.status <> 'superseded')
          ORDER BY ts.approved_at NULLS LAST, ts.created_at`,
        [org.id, ZATWIERDZONE]
      )
    ).rows;

    const wszystkieZatwierdzone = Number(
      (
        await c.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM tool_sessions
            WHERE organization_id = $1 AND upper(status) = ANY($2::text[])`,
          [org.id, ZATWIERDZONE]
        )
      ).rows[0]!.n
    );

    console.log(
      `Sesje zatwierdzone: ${wszystkieZatwierdzone} · bez insightu: ${kandydaci.length}`
    );
    for (const k of kandydaci) {
      console.log(`  - ${k.id} · ${k.tool_type} · ${k.status} · ${k.name}`);
    }

    if (mode.kind === 'dry-run') {
      console.log(
        kandydaci.length === 0
          ? 'DRY-RUN: nic do zrobienia (0 kandydatów).'
          : `DRY-RUN: ${kandydaci.length} insight(ów) zostanie utworzonych przy --apply.`
      );
      return;
    }

    const now = new Date().toISOString();
    const wpisy: WpisManifestu[] = [];
    for (const k of kandydaci) {
      const session = (
        await c.query(`SELECT * FROM tool_sessions WHERE id = $1`, [k.id])
      ).rows[0];
      try {
        // Systemowy aktor: `created_by` sesji. Nie podstawiamy tu żadnego
        // konta serwisowego — ślad zatwierdzenia ma wskazywać człowieka,
        // który tę sesję prowadził.
        const snapshot = await ensureToolOutputSnapshot(
          session,
          { id: String(session.created_by) },
          now
        );
        wpisy.push({
          toolSessionId: k.id,
          sessionName: k.name,
          toolType: k.tool_type,
          toolOutputId: snapshot.id,
          wynik: 'utworzony',
        });
        console.log(`  ✓ ${k.id} -> ${snapshot.id}`);
      } catch (err) {
        const powod =
          err instanceof EmptyToolOutputError ||
          err instanceof ToolOutputPersistenceUnavailableError
            ? err.code
            : `UNEXPECTED: ${String((err as Error)?.message ?? err)}`;
        wpisy.push({
          toolSessionId: k.id,
          sessionName: k.name,
          toolType: k.tool_type,
          toolOutputId: null,
          wynik: 'pominiety',
          powod,
        });
        console.log(`  ✗ ${k.id} — ${powod}`);
      }
    }

    // WERYFIKACJA NIEZALEŻNYM DOSTĘPEM (atrapa bazy kłamie o zapisie):
    // liczymy wiersze przez własny pg.Pool, nie przez tę samą warstwę,
    // która pisała.
    const utworzone = wpisy.filter((w) => w.wynik === 'utworzony');
    const widoczne = utworzone.length
      ? Number(
          (
            await c.query<{ n: string }>(
              `SELECT count(*)::text AS n FROM tool_outputs
                WHERE organization_id = $1 AND id = ANY($2::text[])`,
              [org.id, utworzone.map((w) => w.toolOutputId)]
            )
          ).rows[0]!.n
        )
      : 0;

    ensureEvidence();
    const manifestPath = path.join(EVIDENCE_DIR, `uzupelnij-tool-outputs-${iso()}-manifest.json`);
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          version: 1,
          script: 'uzupelnij-tool-outputs',
          organizationId: org.id,
          organizationName: org.name,
          createdAt: now,
          sesjeZatwierdzone: wszystkieZatwierdzone,
          kandydaci: kandydaci.length,
          utworzone: utworzone.length,
          widoczneNiezaleznymDostepem: widoczne,
          entries: wpisy,
        },
        null,
        2
      ) + '\n'
    );
    console.log(
      `APPLY: utworzone ${utworzone.length}/${kandydaci.length} · widoczne niezależnym dostępem ${widoczne} · manifest ${manifestPath}`
    );

    if (widoczne !== utworzone.length) {
      throw new Error(
        `ZAPIS NIEPOTWIERDZONY: zgłoszono ${utworzone.length} insightów, niezależny SELECT widzi ${widoczne}. ` +
          'Najczęstsza przyczyna: NODE_ENV=test bez RUN_DB_TESTS=1 (atrapa bazy pod queryHelpers).'
      );
    }
  } finally {
    c.release();
    await p.end();
  }
}

main().catch((err) => {
  console.error(String((err as Error)?.stack ?? err));
  process.exit(1);
});
