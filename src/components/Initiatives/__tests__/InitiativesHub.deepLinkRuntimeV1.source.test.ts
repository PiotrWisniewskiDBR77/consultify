/**
 * @vitest-environment node
 *
 * [ODMROZENIE 05_INITIATIVES DEC-453] D-3 (odbiór W2B 20260910,
 * `ODBIOR_W2B_INICJATYWY_REALIZACJA_20260910.md` §1.1) — karta świeżo
 * utworzonej inicjatywy (rekord KANONICZNY runtime-v1, id postaci
 * `initiative-…`) nie otwierała się z adresu URL
 * (`/initiatives?open=<id>&mode=doc`) ani po odświeżeniu strony — działała
 * tylko bezpośrednio po utworzeniu, w tej samej sesji React (stan w pamięci).
 *
 * POMIAR ŹRÓDŁA: deep-link resolver (`useEffect` czytający `searchParams`)
 * próbował po kolei: listę już wczytanych inicjatyw (`fromList`) → fikstury
 * pokazowej → `V8PlanningApi.getInitiative` → klasyczne
 * `GET /api/initiatives/:id` → `GET /api/initiatives?source=interview_insight`.
 * Rekord WYŁĄCZNIE runtime-v1 nie ma odpowiednika ani w V8, ani w tabeli
 * klasycznej (mierzone na kopii `consultify_staging_1009`: nowa inicjatywa
 * istnieje TYLKO w `ie_aggregate_state`) — żadna z tych czterech prób go nie
 * znajdowała, resolver rzucał, toast „nie znaleziono", a ekran pokazywał
 * rejestr zamiast karty. Jedyna trasa, która zna taki rekord, to
 * `GET /api/initiatives/runtime-v1/initiatives/:id`
 * (`readRegisteredInitiative` w `runtimeApi.ts`) — ten sam odczyt, z którego
 * korzysta karta (`initiativeDocumentSource.ts`) po bezpośrednim otwarciu.
 *
 * NAPRAWA: dołożyć `readRegisteredInitiative(openId)` jako kolejną próbę w
 * łańcuchu catch, PRZED ostatnią deską ratunku (`interview_insight`), i
 * przepuścić wynik przez `toCanonicalInitiativeRegisterItem` — ten sam
 * adapter, którego używa rejestr/lista, żeby karta i lista nie rozjechały
 * się po raz drugi (patrz D-4b w tym samym raporcie).
 *
 * Dlaczego na ŹRÓDLE: `InitiativesHub` ma kilka tysięcy linii i zależy od
 * całego drzewa modułu — montowanie w vitest jest kosztowne i kruche
 * (por. `ExecutionHub.*.source.test.ts`, ten sam wzorzec dla siostrzanego
 * huba).
 *
 * MUTACJA (weryfikacja ręczna): usunięcie nowej gałęzi `readRegisteredInitiative`
 * → test czerwony na asercji (a); przesunięcie jej PO gałęzi
 * `interview_insight` → czerwony na (b).
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const hub = readFileSync(new URL('../InitiativesHub.tsx', import.meta.url), 'utf8');

const deepLinkEffectAnchor = hub.indexOf('// Deep link: open initiative preview via URL params');
const catchStart = hub.indexOf('} catch (v8Error) {', deepLinkEffectAnchor);
const effectDepsEnd = hub.indexOf('\n    run();\n  }, [', catchStart);

describe('D-3 — InitiativesHub deep-link resolver zna rekord kanoniczny runtime-v1', () => {
  it('(a) łańcuch prób po V8/legacy woła readRegisteredInitiative', () => {
    expect(deepLinkEffectAnchor).toBeGreaterThan(-1);
    expect(catchStart).toBeGreaterThan(deepLinkEffectAnchor);
    expect(effectDepsEnd).toBeGreaterThan(catchStart);

    const body = hub.slice(catchStart, effectDepsEnd);
    expect(body).toContain('readRegisteredInitiative(openId)');
    expect(body).toContain('toCanonicalInitiativeRegisterItem(');
    expect(body).toContain("source=interview_insight");
  });

  it('(b) próba runtime-v1 jest PRZED ostatnią deską ratunku interview_insight', () => {
    const body = hub.slice(catchStart, effectDepsEnd);
    const runtimeV1Index = body.indexOf('readRegisteredInitiative(openId)');
    const interviewIndex = body.indexOf("source=interview_insight");
    expect(runtimeV1Index).toBeGreaterThan(-1);
    expect(interviewIndex).toBeGreaterThan(-1);
    expect(runtimeV1Index).toBeLessThan(interviewIndex);
  });

  it('(c) readRegisteredInitiative jest zaimportowane z runtimeApi', () => {
    const importBlock = hub.slice(0, deepLinkEffectAnchor);
    expect(importBlock).toContain('readRegisteredInitiative');
    expect(importBlock).toContain("from '../../services/initiatives-execution/runtimeApi'");
  });
});
