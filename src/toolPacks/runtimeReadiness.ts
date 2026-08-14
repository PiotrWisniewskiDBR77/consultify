/**
 * RuntimeReadinessManifest — wersjonowany dowód gotowości runtime.
 *
 * POWÓD ISTNIENIA (review Codexa, P0, 2026-08-13):
 * poprzednia bramka publikacji sprawdzała wyłącznie
 * `runtimeStatus === 'RUNTIME_ACTIVE' && contentComplete`.
 * To NIE egzekwowało DoD — narzędzie z kompletną treścią i zerowym runtime
 * przechodziło. Bramka opierała się na deklaracji, nie na dowodzie.
 *
 * Teraz RUNTIME_ACTIVE wymaga manifestu z bramkami PASS, odniesionego do
 * BIEŻĄCEGO candidate SHA. Manifest sprzed poprawek jest nieważny z definicji —
 * dowód zestarzały to nie dowód.
 */

/** Stan pojedynczej bramki. Brak przebiegu ≠ zaliczenie. */
export type ReadinessGate = 'PASS' | 'FAIL' | 'NOT_RUN';

/** Obowiązkowe bramki DoD. Wszystkie muszą być PASS. */
export interface ReadinessGates {
  sessionImplemented: ReadinessGate;
  persistenceVerified: ReadinessGate;
  reopenVerified: ReadinessGate;
  rendererImplemented: ReadinessGate;
  outputImplemented: ReadinessGate;
  reportImplemented: ReadinessGate;
  approvalVerified: ReadinessGate;
  initiativeHandoffVerified: ReadinessGate;
  automatedTestsPassed: ReadinessGate;
  manualAcceptancePassed: ReadinessGate;
}

export const MANDATORY_GATES: Array<keyof ReadinessGates> = [
  'sessionImplemented',
  'persistenceVerified',
  'reopenVerified',
  'rendererImplemented',
  'outputImplemented',
  'reportImplemented',
  'approvalVerified',
  'initiativeHandoffVerified',
  'automatedTestsPassed',
  'manualAcceptancePassed',
];

/** Progi MPQ: ≥27/30 dla powierzchni klienckich, ≥29/30 dla sygnaturowych. */
export const MPQ_CLIENT_FACING_MIN = 27;
export const MPQ_SIGNATURE_MIN = 29;
export const MPQ_MAX = 30;

export interface RuntimeReadinessManifest {
  manifestVersion: string;
  toolType: string;

  gates: ReadinessGates;

  /** Ocena MPQ osobno dla Light i Dark. `null` = nieoceniane. */
  lightMpq: number | null;
  darkMpq: number | null;
  /** Czy narzędzie ma powierzchnię sygnaturową/hero (wyższy próg). */
  hasSignatureSurface: boolean;

  /** Ścieżki do trwałych dowodów (zrzuty, logi, nagrania). Puste = brak dowodu. */
  evidenceLedgerRefs: string[];

  verifiedAt: string;
  /** SHA, na którym dowody powstały. Musi równać się candidate SHA. */
  verifiedAgainstSha: string;
}

export interface ReadinessVerdict {
  toolType: string;
  publishable: boolean;
  failures: string[];
}

/**
 * Ocenia manifest wobec bieżącego candidate SHA.
 * Zwraca listę konkretnych powodów odmowy — nie samo `false`.
 */
export function evaluateRuntimeReadiness(
  manifest: RuntimeReadinessManifest | undefined,
  candidateSha: string
): ReadinessVerdict {
  const failures: string[] = [];
  const toolType = manifest?.toolType ?? 'unknown';

  if (!manifest) {
    return {
      toolType,
      publishable: false,
      failures: ['Brak RuntimeReadinessManifest — RUNTIME_ACTIVE wymaga dowodu, nie deklaracji.'],
    };
  }

  // Bramki obowiązkowe
  MANDATORY_GATES.forEach((gate) => {
    const state = manifest.gates?.[gate];
    if (state !== 'PASS') {
      failures.push(`Bramka ${gate} = ${state ?? 'BRAK'} (wymagane PASS).`);
    }
  });

  // MPQ — Light i Dark oceniane osobno
  const mpqMin = manifest.hasSignatureSurface ? MPQ_SIGNATURE_MIN : MPQ_CLIENT_FACING_MIN;
  (['lightMpq', 'darkMpq'] as const).forEach((key) => {
    const score = manifest[key];
    if (score === null || score === undefined) {
      failures.push(`${key} nieoceniane — wymagana ocena ≥ ${mpqMin}/${MPQ_MAX}.`);
      return;
    }
    if (score < mpqMin) {
      failures.push(`${key} = ${score}/${MPQ_MAX}, poniżej progu ${mpqMin}.`);
    }
    if (score > MPQ_MAX) {
      failures.push(`${key} = ${score} przekracza skalę ${MPQ_MAX}.`);
    }
  });

  // Dowody
  if (!manifest.evidenceLedgerRefs || manifest.evidenceLedgerRefs.length === 0) {
    failures.push('evidenceLedgerRefs jest puste — brak trwałych dowodów.');
  }

  // Świeżość dowodu wobec candidate SHA
  if (!manifest.verifiedAgainstSha) {
    failures.push('Brak verifiedAgainstSha.');
  } else if (!candidateSha) {
    failures.push('Nie podano candidate SHA do porównania.');
  } else if (manifest.verifiedAgainstSha !== candidateSha) {
    failures.push(
      `Dowody powstały na ${manifest.verifiedAgainstSha}, a candidate to ${candidateSha} — manifest nieaktualny.`
    );
  }

  if (!manifest.verifiedAt) failures.push('Brak verifiedAt.');

  return { toolType, publishable: failures.length === 0, failures };
}

/** Pusty manifest — nic nie zaliczone. Stan wyjściowy każdego narzędzia. */
export function emptyReadinessManifest(
  toolType: string,
  hasSignatureSurface = true
): RuntimeReadinessManifest {
  return {
    manifestVersion: '1.0.0',
    toolType,
    gates: {
      sessionImplemented: 'NOT_RUN',
      persistenceVerified: 'NOT_RUN',
      reopenVerified: 'NOT_RUN',
      rendererImplemented: 'NOT_RUN',
      outputImplemented: 'NOT_RUN',
      reportImplemented: 'NOT_RUN',
      approvalVerified: 'NOT_RUN',
      initiativeHandoffVerified: 'NOT_RUN',
      automatedTestsPassed: 'NOT_RUN',
      manualAcceptancePassed: 'NOT_RUN',
    },
    lightMpq: null,
    darkMpq: null,
    hasSignatureSurface,
    evidenceLedgerRefs: [],
    verifiedAt: '',
    verifiedAgainstSha: '',
  };
}
