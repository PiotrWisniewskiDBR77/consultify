// FIX-7 (odbior dyzuru 33), czesc 2: §P.10.b pkt 4 zakazal tworzenia TRZECIEGO slownika
// pojec pojemnosci. `KnowledgeState` i `CapacityRange` maja jedno zrodlo — modul domenowy
// Inicjatyw (server/src/domain/initiatives-execution/capacityScenario.ts:10-22) — i sa
// importowane, a nie przepisywane. `saturationRange` przyjmuje ten sam ksztalt low/base/high.
import type {
  CapacityRange,
  KnowledgeState,
} from '../../domain/initiatives-execution/capacityScenario.js';
import { validateControlKpiPolicyParameters } from './controlKpiPolicySchema.js';

type Thresholds = { normalUpper: number; saturatedUpper: number };

// FIX-7 (odbior dyzuru 33), czesc 1: `classifyCapacityBand` USUNIETO.
// Miala ZERO wolaczy produkcyjnych — 1 definicja i 4 wystapienia wylacznie we wlasnym tescie,
// wiec trzy z szesciu testow P.10 badaly kod nieosiagalny i zawyzaly licznik.
// Wybrano usuniecie, nie podlaczenie: `saturationRange` jest tu ZAWSZE `null`, bo nie
// istnieja zrodla realnej dostepnosci (P.11: nieobecnosci ZBUDUJ_OD_ZERA, stale obowiazki
// PODLACZ_PO_NAPRAWIE, zaakceptowane rezerwacje ZBUDUJ_OD_ZERA). Nie ma wiec ZADNEJ liczby
// wysycenia do zaklasyfikowania — kazde „podlaczenie" bylo by galezia nieosiagalna
// w chwili napisania, czyli dokladnie tym wzorcem, ktory ten modul ma z siebie usunac.
// Klasyfikator pasm nalezy odtworzyc dopiero razem z pierwszym realnym zrodlem dostepnosci,
// przeciwko prawdziwej liczbie i z testem, ktory przechodzi przez read-model, a nie obok niego.

export function readCapacitySaturation(parameters: Record<string, unknown>) {
  const validation = validateControlKpiPolicyParameters(parameters);
  const relevantMissing = validation.missingParameters.filter((parameter) =>
    ['capacitySaturationThreshold', 'capacityBuffer'].includes(parameter)
  );
  const relevantInvalid = validation.invalidParameters.filter((item) =>
    ['capacitySaturationThreshold', 'capacityBuffer'].includes(item.parameter)
  );
  if (relevantMissing.length > 0) {
    return {
      knowledgeState: 'UNKNOWN' as KnowledgeState,
      valueReason: 'DECISION_REQUIRED' as const,
      missingParameters: relevantMissing,
      invalidParameters: [],
      missingAvailabilityComponents: [],
      saturationRange: null as CapacityRange | null,
      configuredPolicy: null,
    };
  }
  if (relevantInvalid.length > 0) {
    return {
      knowledgeState: 'UNKNOWN' as KnowledgeState,
      valueReason: 'INVALID_PARAMETERS' as const,
      missingParameters: [],
      invalidParameters: relevantInvalid,
      missingAvailabilityComponents: [],
      saturationRange: null as CapacityRange | null,
      configuredPolicy: null,
    };
  }
  return {
    knowledgeState: 'UNKNOWN' as KnowledgeState,
    valueReason: 'AVAILABILITY_SOURCE_UNAVAILABLE' as const,
    missingParameters: [],
    invalidParameters: [],
    missingAvailabilityComponents: ['ABSENCE', 'FIXED_DUTIES', 'ACCEPTED_RESERVATIONS'] as const,
    saturationRange: null as CapacityRange | null,
    configuredPolicy: {
      thresholds: parameters.capacitySaturationThreshold as Thresholds,
      capacityBuffer: parameters.capacityBuffer as number,
      bufferApplication: 'SUBTRACT_FROM_AVAILABILITY_BEFORE_SATURATION' as const,
    },
  };
}
