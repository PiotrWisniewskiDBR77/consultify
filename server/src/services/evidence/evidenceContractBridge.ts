/**
 * Evidence Contract → Envelope persistence bridge (HP-17, Harvey-Parity).
 *
 * PROBLEM (HP-17, audyt + fala9): silniki HP-16 liczą inline `EvidenceContract`
 * (`sources/assumptions/risks/confidence/toVerify`, patrz `evidenceContract.ts`)
 * dla 8 typów artefaktów, ale TYLKO `report`/`finance_number` faktycznie
 * PERSYSTUJĄ go jako `EvidenceEnvelope` (`upsertEnvelope` w
 * `threeAxisReportService.ts`/`financeReportSectionService.ts`/
 * `drdReportEvidenceBridge.ts`). Dla `deck`/`canvas`/`document` kontrakt jest
 * liczony i zwracany w odpowiedzi generatora, ale NIGDY nie trafia do tabeli
 * `artifact_evidence` — panel dowodowy (fala 9, `ArtifactRightPanel`, fetch
 * `/evidence/:type/:id`) widzi dla nich pusty stan mimo że silnik ma dane.
 *
 * Ten moduł domyka most: PURE mapper (`EvidenceContract` → `UpsertEnvelopeInput`)
 * + fail-safe persist wrapper — DOKŁADNIE wzorzec `drdReportEvidenceBridge.ts`
 * (`buildDrdReportEvidenceEnvelope` + `safePersistDrdReportEvidence`), tyle że
 * generyczny (nie tylko `report`) — bo `EvidenceContract` ma jeden kształt dla
 * wszystkich 8 generatorów (HP-14/HP-16 kontrakt).
 *
 * UŻYCIE (w generatorze, DOKŁADNIE w punkcie gdzie kontrakt jest już liczony):
 *   void safePersistEvidenceContract(evidence, {
 *     organizationId, artifactType: 'deck', artifactId: deckId,
 *     service: 'presentationGeneratorService',
 *   }).catch(() => {});
 * ADDYTYWNE — nigdy nie zmienia generacji artefaktu; błąd zapisu envelope jest
 * połykany (logowany, nie rzucany).
 */
import type { EvidenceContract } from './evidenceContract.js';
import { confidenceToNumeric } from './evidenceContract.js';
import type {
  EvidenceArtifactType,
  EvidenceAssumption,
  EvidenceSource,
  EvidenceSourceType,
  EvidenceToVerify,
  UpsertEnvelopeInput,
} from './evidenceEnvelopeService.js';

export interface EvidenceContractPersistMeta {
  organizationId: string;
  artifactType: EvidenceArtifactType;
  artifactId: string;
  /** Nazwa serwisu-generatora, stemplowana w `computed_by.service`. */
  service: string;
  createdBy?: string | null;
}

/**
 * PURE mapping: generator-facing `EvidenceContract`
 * (`sources`/`assumptions: string[]`/`risks: string[]`/`confidence: label`/
 * `toVerify: string[]`) → persystowany `UpsertEnvelopeInput` (kontrakt §3.1
 * koperty, `sources`/`assumptions: EvidenceAssumption[]`/`confidence: numeric`/
 * `toVerify: EvidenceToVerify[]`).
 *
 * Koperta NIE MA kolumny `risks` (decyzja D-2, patrz docblock `evidenceContract.ts`)
 * — `contract.risks` składamy do `toVerify` z prefiksem "Ryzyko:" tak, żeby
 * informacja przetrwała persystencję zamiast zniknąć w konwersji.
 */
export function mapEvidenceContractToEnvelopeInput(
  contract: EvidenceContract,
  meta: EvidenceContractPersistMeta
): UpsertEnvelopeInput {
  const sources: EvidenceSource[] = contract.sources
    .filter((s) => Boolean(s.ref || s.title))
    .map((s) => ({
      // Kontrakt jest generator-facing (typ luźny string — heterogeniczne
      // generatory); koperta ma węższy union, ale kolumna DB to JSONB bez
      // CHECK na sources[].type, więc to bezpieczne przy zapisie.
      type: s.type as EvidenceSourceType,
      ref: s.ref ?? s.title ?? 'unknown',
      snippet: s.snippet,
      url: s.url,
    }));

  const assumptions: EvidenceAssumption[] = contract.assumptions.map((a, i) => ({
    key: `assumption_${i + 1}`,
    value: a,
    source_type: 'imported',
    rationale: `Wygenerowane deterministycznie przez ${meta.service} (kontrakt EvidenceContract HP-16).`,
  }));

  const toVerify: EvidenceToVerify[] = [
    ...contract.toVerify.map((claim) => ({
      claim,
      why: 'Wygenerowane deterministycznie — wymaga potwierdzenia człowieka (kontrakt "Deklaracja—niepotwierdzone").',
    })),
    ...contract.risks.map((risk) => ({
      claim: `Ryzyko: ${risk}`,
      why: 'Ryzyko/ograniczenie odnotowane przy generacji (EvidenceContract.risks — koperta nie ma osobnej kolumny, decyzja D-2).',
    })),
  ];

  return {
    organizationId: meta.organizationId,
    artifactType: meta.artifactType,
    artifactId: meta.artifactId,
    sources,
    assumptions,
    confidence: confidenceToNumeric(contract.confidence),
    toVerify,
    computedBy: {
      service: meta.service,
      version: '1',
      at: new Date().toISOString(),
    },
    createdBy: meta.createdBy ?? null,
  };
}

interface EnvelopeWriter {
  upsertEnvelope(input: UpsertEnvelopeInput): Promise<unknown>;
}

/**
 * Fail-safe persist wrapper — NIGDY nie rzuca (mirror
 * `drdReportEvidenceBridge.safePersistDrdReportEvidence`). Wołaj jako
 * `void safePersistEvidenceContract(...)` (fire-and-forget) zaraz po
 * policzeniu inline `EvidenceContract` w generatorze — błąd zapisu envelope
 * NIE MOŻE zepsuć generacji artefaktu (deck/canvas/document zawsze kończy się
 * niezależnie od stanu Warstwy Dowodowej).
 */
export async function safePersistEvidenceContract(
  contract: EvidenceContract,
  meta: EvidenceContractPersistMeta,
  options?: {
    writer?: EnvelopeWriter;
    logger?: { warn: (msg: string, meta?: unknown) => void };
  }
): Promise<boolean> {
  try {
    const input = mapEvidenceContractToEnvelopeInput(contract, meta);
    let writer = options?.writer;
    if (!writer) {
      const mod = await import('./evidenceEnvelopeService.js');
      writer = (mod.default || mod) as EnvelopeWriter;
    }
    await writer.upsertEnvelope(input);
    return true;
  } catch (error) {
    try {
      options?.logger?.warn(
        `[EvidenceContractBridge] Failed to persist envelope (${meta.artifactType}/${meta.artifactId})`,
        { error: error instanceof Error ? error.message : String(error) }
      );
    } catch {
      /* even logging must not throw */
    }
    return false;
  }
}

export default {
  mapEvidenceContractToEnvelopeInput,
  safePersistEvidenceContract,
};
