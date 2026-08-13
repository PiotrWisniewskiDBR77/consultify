/**
 * Ponowne otwarcie sesji przenosi skład zespołu na nową rewizję.
 *
 * DLACZEGO:
 * Reopen (`frozen -> active`) tworzy NOWĄ rewizję, nigdy nie mutuje zamrożonej
 * sesji w miejscu. Poprawnie — ale kopiowany był wyłącznie `owner_user_id`,
 * a tabela ról zostawała pusta. Skutek w produkcie: po odesłaniu wyniku do
 * poprawy pierwsza próba przejścia stanu na nowej rewizji kończyła się odmową
 * `missing_permission`, i nikt nie mógł kontynuować, dopóki ktoś nie nadał ról
 * od nowa. To jest dokładnie ten moment, w którym zespół ma pracować dalej,
 * a nie zaczynać od konfiguracji uprawnień.
 *
 * Defekt wykryty empirycznie przez test vertical slice (T3), nie z lektury kodu.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { genId, nowIso } from '../db.js';
import * as DbPromise from '../../utils/DbPromise.js';
import { methodEventStore } from '../MethodEventStore.js';
import { methodPackRegistry } from '../MethodPackRegistry.js';
import { MethodSessionService } from '../MethodSessionService.js';
import { EventDerivedOutputBridge, methodOutputService } from '../outputs/index.js';

const REAL_DB = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';

const RUN = Date.now();
const ORG = `reopen-org-${RUN}`;
const OWNER = `reopen-owner-${RUN}`;
const ASSESSOR = `reopen-assessor-${RUN}`;
const APPROVER = `reopen-approver-${RUN}`;
const PACK_ID = `reopen.pack.${RUN}.${Math.random().toString(36).slice(2, 8)}`;
const PACK_VERSION = '1.0.0';

const bridge = new EventDerivedOutputBridge(methodEventStore, methodOutputService);
const sessionService = new MethodSessionService(methodPackRegistry, methodEventStore, bridge);

describe.skipIf(!REAL_DB)('reopen przenosi skład zespołu na nową rewizję', () => {
  // `method_packs.organization_id` ma klucz obcy — organizacja musi istnieć.
  beforeAll(async () => {
    await DbPromise.run(
      `INSERT INTO organizations (id, name) VALUES (?, ?) ON CONFLICT (id) DO NOTHING`,
      [ORG, 'Test reopen roster'],
      { fallback: false }
    );
  }, 60_000);

  it('nowa rewizja ma te same role co zamrożona — bez ręcznego nadawania', async () => {
    // Retry vitest (`retry: 1`) nie przeładowuje modułu, więc PACK_ID jest ten
    // sam — rejestracja przy drugiej próbie trafia na unikalny indeks.
    try {
      await methodPackRegistry.register({
      organizationId: ORG,
      packId: PACK_ID,
      version: PACK_VERSION,
      name: 'Pakiet testowy reopen',
      readiness: 'released',
        manifest: { units: [], levels: [], questions: [] },
      } as never);
    } catch {
      // pakiet już zarejestrowany w poprzedniej próbie — to nie jest przedmiot
      // tego testu
    }

    const created = await sessionService.createSession({
      organizationId: ORG,
      projectId: null,
      module: 'assessment',
      methodPackId: PACK_ID,
      methodPackVersion: PACK_VERSION,
      mode: 'guided_manual',
      ownerUserId: OWNER,
      idempotencyKey: `reopen-${RUN}`,
    });
    const sessionId = (created as { session: { id: string } }).session.id;

    // Rolę `owner` nadaje warstwa HTTP przy tworzeniu sesji, nie sam serwis —
    // tutaj wołamy serwis bezpośrednio, więc nadajemy ją jawnie.
    await sessionService.assignRole(ORG, sessionId, OWNER, 'owner', OWNER);
    await sessionService.assignRole(ORG, sessionId, ASSESSOR, 'lead_assessor', OWNER);
    await sessionService.assignRole(ORG, sessionId, APPROVER, 'approver', OWNER);

    const rosterBefore = await sessionService.listRoles(ORG, sessionId);
    const rolesBefore = rosterBefore.map((r) => `${r.userId}:${r.role}`).sort();
    // Sednem jest RÓWNOŚĆ zbiorów przed i po, nie ich liczność — kernel nie
    // gwarantuje, że twórca sesji trafia do tabeli ról (właściciel żyje w
    // `owner_user_id`).
    expect(rolesBefore.length).toBeGreaterThanOrEqual(2);

    for (const [to, actor] of [
      ['prepared', OWNER],
      ['active', OWNER],
      ['in_review', ASSESSOR],
    ] as const) {
      const res = await sessionService.transition({
        sessionId,
        to,
        actorKind: 'human',
        actorUserId: actor,
        idempotencyKey: `${to}-${RUN}`,
      });
      expect(res.ok, `przejście do ${to}: ${JSON.stringify(res)}`).toBe(true);
    }

    const frozen = await sessionService.transition({
      sessionId,
      to: 'frozen',
      actorKind: 'human',
      actorUserId: APPROVER,
      idempotencyKey: `frozen-${RUN}`,
    });
    expect(frozen.ok, JSON.stringify(frozen)).toBe(true);

    // Reopen — powstaje nowa rewizja.
    const reopened = await sessionService.transition({
      sessionId,
      to: 'active',
      actorKind: 'human',
      actorUserId: OWNER,
      rationale: 'poprawka po przeglądzie',
      idempotencyKey: `reopen-active-${RUN}`,
    });
    expect(reopened.ok, JSON.stringify(reopened)).toBe(true);

    const revisions = await DbPromise.all<{ id: string }>(
      `SELECT id FROM method_sessions WHERE organization_id = ? AND revision_of_session_id = ?`,
      [ORG, sessionId],
      { fallback: false }
    );
    expect(revisions).toHaveLength(1);
    const revisionId = revisions[0].id;

    // SEDNO: skład zespołu jest na nowej rewizji, identyczny.
    const rosterAfter = await sessionService.listRoles(ORG, revisionId);
    const rolesAfter = rosterAfter.map((r) => `${r.userId}:${r.role}`).sort();
    expect(rolesAfter).toEqual(rolesBefore);

    // I przekłada się na uprawnienia: zatwierdzający może znów zamrozić bez
    // ponownego nadawania ról.
    for (const to of ['in_review'] as const) {
      const res = await sessionService.transition({
        sessionId: revisionId,
        to,
        actorKind: 'human',
        actorUserId: ASSESSOR,
        idempotencyKey: `rev-${to}-${RUN}`,
      });
      expect(res.ok, `rewizja → ${to}: ${JSON.stringify(res)}`).toBe(true);
    }
    const refreeze = await sessionService.transition({
      sessionId: revisionId,
      to: 'frozen',
      actorKind: 'human',
      actorUserId: APPROVER,
      idempotencyKey: `rev-frozen-${RUN}`,
    });
    expect(refreeze.ok, `ponowne zamrożenie rewizji: ${JSON.stringify(refreeze)}`).toBe(true);

    // Historia poprzedniej rewizji zostaje przy niej — nie przepisujemy jej.
    const rosterOriginal = await sessionService.listRoles(ORG, sessionId);
    expect(rosterOriginal.map((r) => `${r.userId}:${r.role}`).sort()).toEqual(rolesBefore);

    // sprzątanie
    await DbPromise.run(`DELETE FROM method_session_roles WHERE organization_id = ?`, [ORG], {
      fallback: false,
    });
    await DbPromise.run(`DELETE FROM method_sessions WHERE organization_id = ?`, [ORG], {
      fallback: false,
    });
  }, 120_000);
});

void genId;
void nowIso;
