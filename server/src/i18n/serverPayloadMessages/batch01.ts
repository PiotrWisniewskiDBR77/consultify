import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_01: readonly ServerPayloadMessage[] = [
  {
    "en": "${Math.round(coverageRatio * 100)}% of important facts are referenced in content (recommended: ≥50%)",
    "pl": "${Math.round(coverageRatio * 100)}% ważnych faktów jest cytowanych w treści (zalecane: ≥50%)"
  },
  {
    "en": "${Number(missing)} manual mapping(s) require an append-only verification decision.",
    "pl": "${Number(missing)} ręczne mapowanie(ia) wymagają decyzji o weryfikacji tylko do dodania."
  },
  {
    "en": "${action} requires a non-empty reason",
    "pl": "${action} wymaga niepustego powodu"
  },
  {
    "en": "${alert.message}${alert.checks?.length ? ` | Failed checks: ${alert.checks.join(', ')}` : ''}",
    "pl": "${alert.message}${alert.checks?.length ? ` | Failed checks: ${alert.checks.join(', ')}` : ''}",
    "runtime": false
  },
  {
    "en": "${consecutive} consecutive cards share the same intent. Consider varying layouts for visual interest.",
    "pl": "${consecutive} kolejne karty dzielą ten sam cel. Rozważ różnorodność układów dla atrakcyjności wizualnej."
  },
  {
    "en": "${criticalDelay.length} critical delay signals",
    "pl": "${criticalDelay.length} sygnałów krytycznego opóźnienia"
  },
  {
    "en": "${data.pendingDecisions} pending decisions creating delays",
    "pl": "${data.pendingDecisions} oczekujących decyzji powodujących opóźnienia"
  },
  {
    "en": "${decisionLowConfidence} decision slide(s) have source confidence below 0.6.",
    "pl": "${decisionLowConfidence} slajd(ów) decyzyjnych ma poziom zaufania źródła poniżej 0.6."
  },
  {
    "en": "${decisionMissingTraceability} decision slide(s) are missing source references.",
    "pl": "${decisionMissingTraceability} slajd(ów) decyzyjnych nie ma odniesień do źródeł."
  },
  {
    "en": "${decisionStaleEvidence} decision slide(s) rely on stale evidence (>30 days).",
    "pl": "${decisionStaleEvidence} slajd(ów) decyzyjnych opiera się na przeterminowanych danych (>30 dni)."
  },
  {
    "en": "${def.label} is required",
    "pl": "${def.label} jest wymagane"
  },
  {
    "en": "${def.label} must be a number",
    "pl": "${def.label} musi być liczbą"
  },
  {
    "en": "${def.label} must be a valid URL",
    "pl": "${def.label} musi być poprawnym adresem URL"
  },
  {
    "en": "${def.label} must be a valid date",
    "pl": "${def.label} musi być poprawną datą"
  },
  {
    "en": "${def.label} must be a valid email",
    "pl": "${def.label} musi być poprawnym adresem e-mail"
  },
  {
    "en": "${edges.length} source edges target business_version_id ${valuationBusinessVersionId}; uq_finance_lineage_edges_one_valuation_source should have prevented this",
    "pl": "${edges.length} krawędzi źródłowych wskazuje na business_version_id ${valuationBusinessVersionId}; uq_finance_lineage_edges_one_valuation_source powinno to zapobiec"
  },
  {
    "en": "${emptyDecisionCards.length} decision slide(s) (recommendations/risks/roadmap/next steps) have empty content.",
    "pl": "${emptyDecisionCards.length} slajd(ów) decyzyjnych (rekomendacje/ryzyko/mapa drogowa/następne kroki) mają pustą treść."
  },
  {
    "en": "${existing.length} source edges already target business_version_id ${valuationBusinessVersionId}",
    "pl": "${existing.length} krawędzi źródłowych już wskazuje na business_version_id ${valuationBusinessVersionId}"
  },
  {
    "en": "${fc.label ?? field.name} is required",
    "pl": "${fc.label ?? field.name} jest wymagane"
  },
  {
    "en": "${highOverspend.length} overspend warnings",
    "pl": "${highOverspend.length} ostrzeżeń o przekroczeniu budżetu"
  },
  {
    "en": "${layoutEvidenceMissing.length} slide(s) are missing layout-specific evidence blocks (KPI/chart/scenarios/steps/risks/actions).",
    "pl": "${layoutEvidenceMissing.length} slajd(ów) nie zawiera bloków dowodów specyficznych dla układu (KPI/wykres/scenariusze/kroki/ryzyko/akcje)."
  },
  {
    "en": "${name} is required and must be a non-empty string",
    "pl": "${name} jest wymagane i musi być niepustym ciągiem znaków"
  },
  {
    "en": "${name} must be a valid UUID",
    "pl": "${name} musi być poprawnym UUID"
  },
  {
    "en": "${overdueMilestones.length} overdue milestones",
    "pl": "${overdueMilestones.length} przeterminowanych kamieni milowych"
  },
  {
    "en": "${r.name} has only ${allocPct}% allocation on this initiative",
    "pl": "${r.name} ma tylko ${allocPct}% przydziału na ten inicjatywę"
  },
  {
    "en": "${r.name} is allocated ${crossTotal}% across initiatives (over 100%)",
    "pl": "${r.name} jest przydzielony ${crossTotal}% w całej inicjatywie (powyżej 100%)"
  },
  {
    "en": "${rowErrors.length} row(s) failed validation",
    "pl": "${rowErrors.length} wiersz(ów) nie przeszedł walidacji"
  },
  {
    "en": "${rows.length} source edges target business_version_id ${valuationBusinessVersionId}; uq_finance_lineage_edges_one_valuation_source should have prevented this",
    "pl": "${rows.length} krawędzi źródłowych wskazuje na business_version_id ${valuationBusinessVersionId}; uq_finance_lineage_edges_one_valuation_source powinno to zapobiec"
  },
  {
    "en": "${severeRisks.length} risk signals",
    "pl": "${severeRisks.length} sygnałów ryzyka"
  },
  {
    "en": "${sparseCards.length} slide(s) contain only a heading or a single low-information statement. Add audience-ready evidence and visual structure.",
    "pl": "${sparseCards.length} slajd(ów) zawiera tylko nagłówek lub pojedyncze stwierdzenie o niskiej wartości informacyjnej. Dodaj dowody gotowe do prezentacji i strukturę wizualną."
  },
  {
    "en": "${staleBlockCount} data block(s) may be outdated (>24h since last refresh).",
    "pl": "${staleBlockCount} bloków danych może być przeterminowanych (>24h od ostatniego odświeżenia)."
  },
  {
    "en": "${thesisMissingCards.length} slide(s) have weak thesis/key message.",
    "pl": "${thesisMissingCards.length} slajd(ów) ma słabe stwierdzenie/kluczową wiadomość."
  },
  {
    "en": "${unauditedManualValues.length} manual mapping(s) require an append-only verification decision.",
    "pl": "${unauditedManualValues.length} ręczne mapowanie(ia) wymagają decyzji o weryfikacji tylko do dodania."
  },
  {
    "en": "A More menu with no items is a dead control — omit the menu instead.",
    "pl": "Menu „Więcej” bez elementów to martwy element sterujący — zamiast tego pomijaj menu."
  },
  {
    "en": "A current GO decision is required",
    "pl": "Wymagana jest obecna decyzja GO"
  },
  {
    "en": "A current Go/No-Go decision is required to approve this initiative",
    "pl": "Obecna decyzja Go/No-Go jest wymagana do zatwierdzenia tej inicjatywy"
  },
  {
    "en": "A current Go/No-Go decision is required to start execution of this initiative",
    "pl": "Obecna decyzja Go/No-Go jest wymagana, aby rozpocząć wykonanie tej inicjatywy"
  },
  {
    "en": "A valuation cannot be its own source",
    "pl": "Wycena nie może być swoim źródłem"
  },
  {
    "en": "AI Operator detected ${overdue.overdue_count} overdue task(s) that require intervention.",
    "pl": "Operator AI wykrył ${overdue.overdue_count} przeterminowaną(-ych) zadanie(-a), które wymagają interwencji."
  },
  {
    "en": "AI inferred some details. Review before approving.",
    "pl": "AI wnioskował o niektóre szczegóły. Przejrzyj przed zatwierdzeniem."
  },
  {
    "en": "AI maturity (${aiScore}) seems high relative to Data Management (${dataScore}). Advanced AI typically requires strong data foundations.",
    "pl": "Dojrzałość AI (${aiScore}) wydaje się wysoka w porównaniu do Zarządzania Danymi (${dataScore}). Zaawansowana AI zwykle wymaga solidnych podstaw danych."
  },
  {
    "en": "AI response was invalid JSON",
    "pl": "Odpowiedź AI była nieprawidłowym JSON-em"
  },
  {
    "en": "Accepted handoff and start date are required",
    "pl": "Wymagane są zaakceptowane przekazanie i data rozpoczęcia"
  },
  {
    "en": "Access denied to this base",
    "pl": "Odmowa dostępu do tej bazy"
  },
  {
    "en": "Access denied to this governed model",
    "pl": "Odmowa dostępu do tego zarządzanego modelu"
  },
  {
    "en": "Access denied to this table",
    "pl": "Odmowa dostępu do tej tabeli"
  },
  {
    "en": "Action already processed",
    "pl": "Akcja została już przetworzona"
  },
  {
    "en": "Action blocked by Regulatory Mode (advisory-only).",
    "pl": "Akcja zablokowana przez tryb regulacyjny (tylko doradczy)."
  },
  {
    "en": "Action is ${action.status}, not APPROVED",
    "pl": "Akcja to ${action.status}, nie ZATWIERDZONA"
  },
  {
    "en": "Action not found",
    "pl": "Akcja nie znaleziona"
  },
  {
    "en": "Action not found or already processed",
    "pl": "Akcja nie znaleziona lub już przetworzona"
  },
  {
    "en": "Action type not yet executable; kept as proposal only",
    "pl": "Typ akcji jeszcze nie do wykonania; zachowano tylko jako propozycję"
  },
  {
    "en": "Action type not yet implemented",
    "pl": "Typ akcji jeszcze nie zaimplementowany"
  },
  {
    "en": "Add at least one section.",
    "pl": "Dodaj przynajmniej jedną sekcję."
  },
  {
    "en": "Add required evidence before scoring",
    "pl": "Dodaj wymagane dowody przed oceną"
  },
  {
    "en": "Advanced business model (${bizScore}) may face adoption challenges with current culture (${cultureScore}).",
    "pl": "Zaawansowany model biznesowy (${bizScore}) może napotkać trudności z przyjęciem w obecnej kulturze (${cultureScore})."
  },
  {
    "en": "All Initiative tasks and milestones must be complete before closure",
    "pl": "Wszystkie zadania i kamienie milowe inicjatywy muszą być zakończone przed zamknięciem"
  },
  {
    "en": "All steps completed",
    "pl": "Wszystkie kroki wykonane"
  },
  {
    "en": "Already linked",
    "pl": "Już połączony"
  },
  {
    "en": "An open draft already exists for this version",
    "pl": "Otwarty szkic już istnieje dla tej wersji"
  }
];
