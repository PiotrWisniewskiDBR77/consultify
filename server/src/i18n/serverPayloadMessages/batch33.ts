import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_33: readonly ServerPayloadMessage[] = [
  {
    "en": "Dead-letter record ${validated.deadLetterId} not found",
    "pl": "Nie znaleziono rekordu niedostarczonej wiadomości ${validated.deadLetterId}"
  },
  {
    "en": "Dead-letter record ${validated.deadLetterId} is not replay-eligible (blocked)",
    "pl": "Rekord niedostarczonych wiadomości ${validated.deadLetterId} nie nadaje się do ponownego odtworzenia (zablokowany)"
  },
  {
    "en": "Artifact ${artifactId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono artefaktu ${artifactId} w organizacji ${organizationId}"
  },
  {
    "en": "Invalid delivery transition: ${fromState} → ${newState}. ",
    "pl": "Nieprawidłowe przejście dostawy: ${fromState} → ${newState}."
  },
  {
    "en": "Recurring presentation programs require strict governance (Decision W6-4)",
    "pl": "Programy prezentacji cyklicznych wymagają ścisłego zarządzania (Decyzja W6-4)"
  },
  {
    "en": "Invalid quality score field: ${String(k)}",
    "pl": "Nieprawidłowe pole Wyniku Jakości: ${String(k)}"
  },
  {
    "en": "Invalid outputType filter: ${outputType}",
    "pl": "Nieprawidłowy filtr typu wyjściowego: ${outputType}"
  },
  {
    "en": "Invalid delivery state filter: ${state}",
    "pl": "Nieprawidłowy filtr stanu dostawy: ${state}"
  },
  {
    "en": "Invalid export format: ${format}",
    "pl": "Nieprawidłowy format eksportu: ${format}"
  },
  {
    "en": "Invalid KPI status: ${newStatus}",
    "pl": "Nieprawidłowy status KPI: ${newStatus}"
  },
  {
    "en": "KPI ${kpiId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono KPI ${kpiId} w organizacji ${organizationId}"
  },
  {
    "en": "Invalid status transition: ${existing.status} → ${newStatus}. ",
    "pl": "Nieprawidłowa zmiana statusu: ${existing.status} → ${newStatus}."
  },
  {
    "en": "Invalid reconciliation status: ${newStatus}",
    "pl": "Nieprawidłowy status uzgodnienia: ${newStatus}"
  },
  {
    "en": "Reconciliation ${reconciliationId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono uzgodnienia ${reconciliationId} w organizacji ${organizationId}"
  },
  {
    "en": "Invalid deviation severity: ${severity}",
    "pl": "Nieprawidłowa waga odchylenia: ${severity}"
  },
  {
    "en": "Deviation ${deviationId} not found in organization ${organizationId}",
    "pl": "W organizacji ${organizationId} nie znaleziono odchylenia ${deviationId}"
  },
  {
    "en": "${LOG_PREFIX} v8_shadow_comparisons table does not exist. Run V8 migrations first.",
    "pl": "${LOG_PREFIX} v8_shadow_comparisons tabela nie istnieje. Najpierw uruchom migrację V8."
  },
  {
    "en": "Invalid sourceType: ${sourceType}",
    "pl": "Nieprawidłowy typ źródła: ${sourceType}"
  },
  {
    "en": "Invalid proposal visibility transition: ${currentVisibility} → ${validated.visibility}. ",
    "pl": "Nieprawidłowe przejście widoczności propozycji: ${currentVisibility} → ${validated.visibility}."
  },
  {
    "en": "Tool ${validated.toolId} not found in organization ${validated.organizationId}",
    "pl": "Nie znaleziono narzędzia ${validated.toolId} w organizacji ${validated.organizationId}"
  },
  {
    "en": "Invocation ${invocationId} not found",
    "pl": "Nie znaleziono wywołania ${invocationId}"
  },
  {
    "en": "Invocation ${invocationId} is not in deferred_approval state (current: ${row.approval_result})",
    "pl": "Wywołanie ${invocationId} nie jest w stanie deferred_approval (obecnie: ${row.approval_result})"
  },
  {
    "en": "Transformation Case transaction committed without readable case",
    "pl": "Transakcja dotycząca sprawy transformacji została zatwierdzona bez czytelnej sprawy"
  },
  {
    "en": "Bound Transformation Case is not readable",
    "pl": "Powiązany przypadek transformacji nie jest czytelny"
  },
  {
    "en": "Revised Transformation Case not readable after commit",
    "pl": "Poprawiony przypadek transformacji nie można odczytać po zatwierdzeniu"
  },
  {
    "en": "Cancelled Transformation Case not readable after commit",
    "pl": "Anulowany przypadek transformacji nieczytelny po zatwierdzeniu"
  },
  {
    "en": "Approved Transformation Case not readable after commit",
    "pl": "Zatwierdzony przypadek transformacji nieczytelny po zatwierdzeniu"
  },
  {
    "en": "Ideas proposal not readable after commit",
    "pl": "Propozycja pomysłów nieczytelna po zatwierdzeniu"
  },
  {
    "en": "Reviewed Ideas proposal not readable after commit",
    "pl": "Sprawdzona propozycja pomysłów nie jest czytelna po zatwierdzeniu"
  },
  {
    "en": "Interview proposal not readable after commit",
    "pl": "Propozycja rozmowy kwalifikacyjnej nieczytelna po zatwierdzeniu"
  },
  {
    "en": "Rejected Interview proposal not readable after commit",
    "pl": "Odrzucona propozycja rozmowy kwalifikacyjnej nieczytelna po zatwierdzeniu"
  },
  {
    "en": "Approved Interview proposal disappeared before apply",
    "pl": "Zatwierdzona propozycja rozmowy kwalifikacyjnej zniknęła przed złożeniem wniosku"
  },
  {
    "en": "Applied Interview proposal not readable after commit",
    "pl": "Propozycja rozmowy kwalifikacyjnej nie można odczytać po zatwierdzeniu"
  },
  {
    "en": "DRD proposal not readable after commit",
    "pl": "Propozycja DRD nieczytelna po zatwierdzeniu"
  },
  {
    "en": "Rejected DRD proposal not readable after commit",
    "pl": "Odrzucona propozycja DRD jest nieczytelna po zatwierdzeniu"
  },
  {
    "en": "Reviewed DRD proposal not readable after commit",
    "pl": "Sprawdzona propozycja DRD nie jest czytelna po zatwierdzeniu"
  },
  {
    "en": "Opportunity synthesis proposal not readable after commit",
    "pl": "Propozycja syntezy możliwości nie jest czytelna po zatwierdzeniu"
  },
  {
    "en": "Rejected synthesis proposal not readable",
    "pl": "Odrzucona propozycja syntezy jest nieczytelna"
  },
  {
    "en": "Synthesis proposal has no DRD assessment",
    "pl": "Propozycja syntezy nie podlega ocenie DRD"
  },
  {
    "en": "Applied synthesis proposal not readable",
    "pl": "Zastosowana propozycja syntezy nieczytelna"
  },
  {
    "en": "Finance/KPI proposal not readable after commit",
    "pl": "Propozycja finansów/KPI nieczytelna po zatwierdzeniu"
  },
  {
    "en": "Rejected Finance/KPI proposal not readable",
    "pl": "Odrzucona propozycja finansów/KPI jest nieczytelna"
  },
  {
    "en": "Applied Finance/KPI proposal not readable",
    "pl": "Nie można odczytać propozycji Appliance Finance/KPI"
  },
  {
    "en": "Portfolio decision proposal not readable",
    "pl": "Propozycja decyzji portfelowej nieczytelna"
  },
  {
    "en": "Rejected portfolio proposal not readable",
    "pl": "Odrzucona propozycja portfolio nieczytelna"
  },
  {
    "en": "Applied portfolio proposal not readable",
    "pl": "Zastosowana propozycja portfolio nieczytelna"
  },
  {
    "en": "Mobilization proposal not readable",
    "pl": "Propozycja mobilizacji nieczytelna"
  },
  {
    "en": "Rejected mobilization proposal not readable",
    "pl": "Odrzucona propozycja mobilizacji jest nieczytelna"
  },
  {
    "en": "Applied mobilization proposal not readable",
    "pl": "Zastosowana propozycja mobilizacji nieczytelna"
  },
  {
    "en": "initiative_transition_denied:${JSON.stringify(transition.body)}",
    "pl": "initiative_transition_denied:${JSON.stringify(transition.body)}"
  },
  {
    "en": "Source snapshot ${fromSnapshotId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono migawki źródłowej ${fromSnapshotId} w organizacji ${organizationId}"
  },
  {
    "en": "Target snapshot ${toSnapshotId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono docelowej migawki ${toSnapshotId} w organizacji ${organizationId}"
  },
  {
    "en": "Cannot compare snapshots from different resources: ",
    "pl": "Nie można porównać migawek z różnych zasobów:"
  },
  {
    "en": "Target snapshot ${validated.targetVersionSnapshotId} not found ",
    "pl": "Nie znaleziono docelowej migawki ${validated.targetVersionSnapshotId}"
  },
  {
    "en": "Restore request ${restoreId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono żądania przywrócenia ${restoreId} w organizacji ${organizationId}"
  },
  {
    "en": "Restore request ${restoreId} is already ${request.status}, cannot apply",
    "pl": "Żądanie przywrócenia ${restoreId} jest już ${request.status}, nie można zastosować"
  },
  {
    "en": "Target snapshot ${request.targetVersionSnapshotId} no longer exists",
    "pl": "Docelowa migawka ${request.targetVersionSnapshotId} już nie istnieje"
  },
  {
    "en": "Snapshot ${snapshotId} not found in organization ${organizationId}",
    "pl": "Nie znaleziono migawki ${snapshotId} w organizacji ${organizationId}"
  },
  {
    "en": "Restore request ${restoreId} is already ${request.status}, cannot reject",
    "pl": "Żądanie przywrócenia ${restoreId} jest już ${request.status}, nie można odrzucić"
  },
  {
    "en": "Suggestion ${suggestionId} not found in organization ${organizationId}",
    "pl": "Sugestia ${suggestionId} nie została znaleziona w organizacji ${organizationId}"
  }
];
