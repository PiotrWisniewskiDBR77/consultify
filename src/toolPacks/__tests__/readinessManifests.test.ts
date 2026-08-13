/**
 * STREAM H3 — kontrakt manifestów gotowości runtime dla wszystkich 19
 * narzędzi z silnikiem. Dowodzi CZTERECH rzeczy z zadania:
 *
 *  1. każde z 19 ma osobny manifest (nigdy zbiorczy);
 *  2. każdy manifest wskazuje candidate SHA `91b562ea66`;
 *  3. `evaluateRuntimeReadiness()` zgadza się z zapisanym werdyktem
 *     (żaden manifest nie "kłamie" o własnym wyniku);
 *  4. żadne narzędzie nie jest RUNTIME_ACTIVE, chyba że WSZYSTKIE bramki
 *     obowiązkowe są naprawdę PASS.
 *
 * Plus: dowód, że test NIE JEST WAKUOWY — `docs/program/METHOD_TOOLS_2026-08-13/
 * readiness/EVIDENCE_OF_NEGATIVE_CONTROL.md` opisuje ręczny przebieg mutacji
 * (bramka sfałszowana na PASS w kopii scratch, test złapał rozjazd, revert).
 * Tu, W SAMYM pliku testowym, dodatkowo dowodzimy nie-wakuowości
 * mechanicznie: klonujemy realny manifest jednego narzędzia, celowo
 * fałszujemy jedną bramkę bez zmiany reszty stanu, i sprawdzamy, że
 * `evaluateRuntimeReadiness` i tak wykrywa POZOSTAŁE niespełnione bramki
 * (bo fałszowanie jednej bramki nie usuwa pozostałych 3-6 braków) — a potem
 * osobno dowodzimy, że gdyby WSZYSTKIE bramki + MPQ + evidence były
 * poprawne, manifest BYŁBY publikowalny (kontrola pozytywna), więc
 * `evaluateRuntimeReadiness` nie jest funkcją, która zawsze zwraca `false`.
 */
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import {
  evaluateRuntimeReadiness,
  MANDATORY_GATES,
  MPQ_CLIENT_FACING_MIN,
  type RuntimeReadinessManifest,
} from '../runtimeReadiness';
import { getToolPack, TOOL_PACKS } from '../registry';
import { validateToolPack } from '../validator';
import {
  CANDIDATE_SHA,
  ENGINE_BACKED_TOOL_TYPES,
  TOOL_READINESS_MANIFESTS,
} from '../readiness/manifests';

const READINESS_DIR = path.resolve(
  process.cwd(),
  'docs/program/METHOD_TOOLS_2026-08-13/readiness'
);

describe('Runtime Readiness Manifests — 19 narzędzi z silnikiem, per-narzędzie (STREAM H3)', () => {
  it('candidate SHA tego streamu to dokładnie 91b562ea66 (kanoniczna wartość z zadania)', () => {
    expect(CANDIDATE_SHA).toBe('91b562ea66');
  });

  it('lista 19 narzędzi z silnikiem == packi PACK_COMPLETE w rejestrze (żadnego dopisanego/pominiętego)', () => {
    const complete = TOOL_PACKS.filter((p) => p.contentStatus === 'PACK_COMPLETE').map((p) =>
      String(p.toolType)
    );
    expect([...ENGINE_BACKED_TOOL_TYPES].sort()).toEqual([...complete].sort());
    expect(ENGINE_BACKED_TOOL_TYPES.length).toBe(19);
  });

  it('każde z 19 ma manifest — nigdy zbiorczy, zawsze osobny obiekt per toolType', () => {
    ENGINE_BACKED_TOOL_TYPES.forEach((t) => {
      expect(TOOL_READINESS_MANIFESTS[t], `brak manifestu dla ${t}`).toBeDefined();
      expect(TOOL_READINESS_MANIFESTS[t].toolType).toBe(t);
    });
    // Każdy manifest to WŁASNY obiekt — dowód, że nikt nie skopiował referencji
    // (np. z dynamic-swot do innego narzędzia, co zadanie wprost zabrania).
    const objects = new Set(ENGINE_BACKED_TOOL_TYPES.map((t) => TOOL_READINESS_MANIFESTS[t]));
    expect(objects.size).toBe(19);
    const gateObjects = new Set(
      ENGINE_BACKED_TOOL_TYPES.map((t) => TOOL_READINESS_MANIFESTS[t].runtimeReadiness.gates)
    );
    expect(gateObjects.size).toBe(19);
  });

  it('dowód "Output" dynamic-swot (jedyny realny most silnik→Output) NIE jest skopiowany do żadnego innego narzędzia', () => {
    // Kryteria typu pack/engine/persistence/validationEvidence DZIELĄ tekst
    // dowodu legalnie — to ten sam uruchomiony test dla wszystkich 19. Ale
    // Output jest INNA: zadanie wprost zabrania przypisywania dynamic-swot's
    // "treść bogata, realny silnik" dowodu innemu narzędziu — to byłaby
    // fabrykacja (roster: tylko dynamic-swot ma realny most, reszta to
    // generic-empty, sprawdzone tym streamem).
    const swotOutput = TOOL_READINESS_MANIFESTS['dynamic-swot'].criteria.output;
    expect(swotOutput.status).toBe('PASS');
    expect(swotOutput.evidence).toContain('buildSwotOutput');

    ENGINE_BACKED_TOOL_TYPES.filter((t) => t !== 'dynamic-swot').forEach((t) => {
      const output = TOOL_READINESS_MANIFESTS[t].criteria.output;
      expect(
        output.evidence,
        `${t}.output nie może cytować mostu buildSwotOutput dynamic-swot`
      ).not.toContain('buildSwotOutput');
      expect(
        output.evidence === swotOutput.evidence,
        `${t}.output ma DOSŁOWNIE ten sam tekst dowodu co dynamic-swot — fabrykacja`
      ).toBe(false);
      // Żadne inne narzędzie nie ma prawa deklarować statusu PASS na Output
      // z powodu treści bogatej — 8 z nich mają PASS, ale to PASS na
      // "generic-empty udowodnione", nigdy na "treść bogata".
      if (output.status === 'PASS') {
        expect(output.evidence).toContain('generic-fallback-1.0.0');
      }
    });
  });

  describe.each(ENGINE_BACKED_TOOL_TYPES)('%s', (toolType) => {
    const record = TOOL_READINESS_MANIFESTS[toolType];

    it('manifest wskazuje candidate SHA 91b562ea66 (pole i runtimeReadiness.verifiedAgainstSha)', () => {
      expect(record.candidateSha).toBe(CANDIDATE_SHA);
      expect(record.runtimeReadiness.verifiedAgainstSha).toBe(CANDIDATE_SHA);
      expect(record.runtimeReadiness.toolType).toBe(toolType);
      expect(record.runtimeReadiness.verifiedAt).toBeTruthy();
    });

    it('evaluateRuntimeReadiness (LIVE) zgadza się z recordedVerdict (zapisanym w danych)', () => {
      const live = evaluateRuntimeReadiness(record.runtimeReadiness, CANDIDATE_SHA);
      expect(live.publishable).toBe(record.recordedVerdict.publishable);
      expect(live.failures.length).toBe(record.recordedVerdict.failureCount);
    });

    it('dziś: manifest NIE jest publikowalny (przynajmniej jedna bramka / MPQ brakuje)', () => {
      // Świadome odbicie stanu programu na 91b562ea66 — patrz nagłówek zadania
      // "EXPECT MOST GATES TO BE FAIL OR NOT_VERIFIED". Gdyby to się zmieniło
      // (narzędzie faktycznie dowiezione), ten test ma się rozsypać —
      // to jest strażnik przeciw nieuzasadnionemu automatycznemu PASS.
      const live = evaluateRuntimeReadiness(record.runtimeReadiness, CANDIDATE_SHA);
      expect(live.publishable).toBe(false);
      expect(live.failures.length).toBeGreaterThan(0);
    });

    it('evidenceLedgerRefs niepuste i KAŻDY wpis wskazuje na plik istniejący w repo', () => {
      expect(record.runtimeReadiness.evidenceLedgerRefs.length).toBeGreaterThan(0);
      record.runtimeReadiness.evidenceLedgerRefs.forEach((ref) => {
        const resolved = path.resolve(process.cwd(), ref);
        expect(fs.existsSync(resolved), `${toolType}: dowód "${ref}" nie istnieje na dysku`).toBe(
          true
        );
      });
    });

    it('gdyby ktoś dziś oznaczył to narzędzie jako RUNTIME_ACTIVE, walidator by to ODRZUCIŁ na jego REALNYM manifeście', () => {
      const pack = getToolPack(toolType)!;
      const hypothetical = { ...pack, runtimeStatus: 'RUNTIME_ACTIVE' as const };
      const result = validateToolPack(hypothetical, CANDIDATE_SHA);
      expect(
        result.publishableAsActive,
        `${toolType}: walidator NIE odrzucił RUNTIME_ACTIVE mimo niekompletnego manifestu — bramka jest wakuowa`
      ).toBe(false);
      expect(result.issues.some((i) => i.field === 'runtimeReadiness')).toBe(true);
    });

    it('rejestr wiąże ten manifest ADDYTYWNIE — pack.runtimeReadiness ustawiony, contentStatus/runtimeStatus nietknięte', () => {
      const pack = getToolPack(toolType)!;
      expect(pack.contentStatus).toBe('PACK_COMPLETE');
      expect(pack.runtimeStatus).toBe('RUNTIME_PENDING'); // nikt nie podniósł statusu
      expect(pack.runtimeReadiness).toBeDefined();
      expect(pack.runtimeReadiness).toBe(record.runtimeReadiness); // ta sama referencja, nie kopia
    });

    it('deliverable JSON istnieje na dysku i zgadza się z modułem TS (toolType, SHA, bramki)', () => {
      const jsonPath = path.join(READINESS_DIR, `${toolType}.json`);
      expect(fs.existsSync(jsonPath), `brak pliku ${jsonPath}`).toBe(true);
      const onDisk = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      expect(onDisk.toolType).toBe(toolType);
      expect(onDisk.runtimeReadiness.verifiedAgainstSha).toBe(CANDIDATE_SHA);
      expect(onDisk.runtimeReadiness.gates).toEqual(record.runtimeReadiness.gates);
      expect(onDisk.recordedVerdict).toEqual(record.recordedVerdict);
    });

    it('każda z 10 bramek obowiązkowych ma wartość PASS/FAIL/NOT_RUN (nigdy undefined/inny string)', () => {
      MANDATORY_GATES.forEach((gate) => {
        expect(['PASS', 'FAIL', 'NOT_RUN']).toContain(record.runtimeReadiness.gates[gate]);
      });
    });

    it('każde z 16 kryteriów rozszerzonych ma status i niepusty dowód (nie placeholder)', () => {
      Object.entries(record.criteria).forEach(([field, criterion]) => {
        expect(['PASS', 'FAIL', 'NOT_VERIFIED']).toContain(criterion.status);
        expect(criterion.evidence.length, `${toolType}.${field}: dowód za krótki/pusty`).toBeGreaterThan(
          20
        );
      });
    });
  });

  it('PODSUMOWANIE: dziś 0/19 RUNTIME_ACTIVE, 0/19 publikowalnych wg evaluateRuntimeReadiness', () => {
    const activeCount = TOOL_PACKS.filter((p) => p.runtimeStatus === 'RUNTIME_ACTIVE').length;
    expect(activeCount).toBe(0);
    const publishableCount = ENGINE_BACKED_TOOL_TYPES.filter(
      (t) => evaluateRuntimeReadiness(TOOL_READINESS_MANIFESTS[t].runtimeReadiness, CANDIDATE_SHA).publishable
    ).length;
    expect(publishableCount).toBe(0);
  });

  it('istniejący rozdział treści (19 PACK_COMPLETE / 12 EVIDENCE_MISSING) pozostaje nienaruszony', () => {
    const summary = {
      packComplete: TOOL_PACKS.filter((p) => p.contentStatus === 'PACK_COMPLETE').length,
      evidenceMissing: TOOL_PACKS.filter((p) => p.contentStatus === 'EVIDENCE_MISSING').length,
      total: TOOL_PACKS.length,
    };
    expect(summary.packComplete).toBe(19);
    expect(summary.evidenceMissing).toBe(12);
    expect(summary.total).toBe(31);
  });

  describe('dowód nie-wakuowości (kontrole pozytywna i negatywna na evaluateRuntimeReadiness)', () => {
    function fullyPassingManifest(toolType: string): RuntimeReadinessManifest {
      return {
        manifestVersion: '1.0.0',
        toolType,
        gates: {
          sessionImplemented: 'PASS',
          persistenceVerified: 'PASS',
          reopenVerified: 'PASS',
          rendererImplemented: 'PASS',
          outputImplemented: 'PASS',
          reportImplemented: 'PASS',
          approvalVerified: 'PASS',
          initiativeHandoffVerified: 'PASS',
          automatedTestsPassed: 'PASS',
          manualAcceptancePassed: 'PASS',
        },
        lightMpq: MPQ_CLIENT_FACING_MIN,
        darkMpq: MPQ_CLIENT_FACING_MIN,
        hasSignatureSurface: false,
        evidenceLedgerRefs: ['docs/program/METHOD_TOOLS_2026-08-13/ROSTER_MATRIX.md'],
        verifiedAt: '2026-08-13T00:00:00Z',
        verifiedAgainstSha: CANDIDATE_SHA,
      };
    }

    it('KONTROLA POZYTYWNA: manifest ze WSZYSTKIMI bramkami + MPQ + dowodami prawdziwie PASS JEST publikowalny', () => {
      const hypothetical = fullyPassingManifest('dms-builder');
      const verdict = evaluateRuntimeReadiness(hypothetical, CANDIDATE_SHA);
      expect(verdict.publishable).toBe(true);
      expect(verdict.failures).toEqual([]);
    });

    it('KONTROLA NEGATYWNA: fałszując jedną bramkę na PASS w REALNYM (niekompletnym) manifeście dms-builder, werdykt zostaje odrzucony (bo reszta nadal brakuje)', () => {
      const real = TOOL_READINESS_MANIFESTS['dms-builder'].runtimeReadiness;
      expect(real.gates.approvalVerified).toBe('NOT_RUN'); // stan faktyczny dziś
      const tampered: RuntimeReadinessManifest = {
        ...real,
        gates: { ...real.gates, approvalVerified: 'PASS' }, // sfałszowane, bez dowodu
      };
      const verdict = evaluateRuntimeReadiness(tampered, CANDIDATE_SHA);
      // Nawet po sfałszowaniu JEDNEJ bramki, pozostałe braki (output/report/
      // initiative/automatedTests/manualAcceptance/MPQ) nadal blokują —
      // dowód, że test nie przepuszcza na podstawie jednego cichego PASS.
      expect(verdict.publishable).toBe(false);
      expect(verdict.failures.some((f) => f.includes('approvalVerified'))).toBe(false);
      expect(verdict.failures.length).toBeGreaterThan(0);
    });

    it('KONTROLA NEGATYWNA #2: rozjazd JSON<->TS zostaje złapany (symulacja bez dotykania plików na dysku)', () => {
      const real = TOOL_READINESS_MANIFESTS['dms-builder'];
      const tamperedOnDisk = {
        ...real,
        runtimeReadiness: {
          ...real.runtimeReadiness,
          gates: { ...real.runtimeReadiness.gates, outputImplemented: 'PASS' as const },
        },
      };
      // To dokładnie ta asercja, którą "deliverable JSON zgadza się z modułem
      // TS" robi z prawdziwym plikiem — tu z celowo zepsutą kopią w pamięci,
      // żeby dowieść, że `toEqual` faktycznie złapałby taki rozjazd.
      expect(tamperedOnDisk.runtimeReadiness.gates).not.toEqual(real.runtimeReadiness.gates);
    });
  });
});
