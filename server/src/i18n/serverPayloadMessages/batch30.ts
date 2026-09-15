import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_30: readonly ServerPayloadMessage[] = [
  {
    "en": "Invalid permission: ${updates.permission}",
    "pl": "Nieprawidłowe pozwolenie: ${updates.permission}"
  },
  {
    "en": "Invalid cron expression: ${cron}",
    "pl": "Nieprawidłowe wyrażenie cron: ${cron}"
  },
  {
    "en": "Automation is not a scheduled type",
    "pl": "Automatyzacja nie jest typem zaplanowanym"
  },
  {
    "en": "Source and target tables must be different",
    "pl": "Tabele źródłowe i docelowe muszą być różne"
  },
  {
    "en": "Sync config not found: ${syncId}",
    "pl": "Nie znaleziono konfiguracji synchronizacji: ${syncId}"
  },
  {
    "en": "Invalid template status: ${String(invalid)}",
    "pl": "Nieprawidłowy status szablonu: ${String(invalid)}"
  },
  {
    "en": "templateId is required",
    "pl": "identyfikator szablonu jest wymagany"
  },
  {
    "en": "Base not found",
    "pl": "Nie znaleziono bazy"
  },
  {
    "en": "Query timed out. Try narrowing your filters.",
    "pl": "Upłynął limit czasu zapytania. Spróbuj zawęzić filtry."
  },
  {
    "en": "[TP Migrations] Injected migrations directory not found: ${explicitDir}",
    "pl": "[Migracje TP] Nie znaleziono wstrzykniętego katalogu migracji: ${explicitDir}"
  },
  {
    "en": "Task not found",
    "pl": "Nie znaleziono zadania"
  },
  {
    "en": "User is not a member of this project",
    "pl": "Użytkownik nie jest członkiem tego projektu"
  },
  {
    "en": "User with role ${member.projectRole} cannot be assigned tasks",
    "pl": "Użytkownikowi z rolą ${member.projectRole} nie można przypisywać zadań"
  },
  {
    "en": "Task is already at maximum escalation level",
    "pl": "Zadanie jest już na maksymalnym poziomie eskalacji"
  },
  {
    "en": "No recipients found for escalation level ${newLevel}",
    "pl": "Nie znaleziono odbiorców dla poziomu eskalacji ${newLevel}"
  },
  {
    "en": "Escalation not found",
    "pl": "Nie znaleziono eskalacji"
  },
  {
    "en": "organizationId is required to read task workload",
    "pl": "do odczytania obciążenia zadania wymagany jest identyfikator organizacji"
  },
  {
    "en": "Unknown task section: ${sectionKey}",
    "pl": "Nieznana sekcja zadania: ${sectionKey}"
  },
  {
    "en": "teresaEventStore.appendEvent: insert conflicted but no row found for idempotency_key=${input.idempotencyKey}",
    "pl": "teresaEventStore.appendEvent: konflikt wstawiania, ale nie znaleziono wiersza dla idempotency_key=${input.idempotencyKey}"
  },
  {
    "en": "Tool report schema requires at least one source Output.",
    "pl": "Schemat raportu narzędzia wymaga co najmniej jednego źródła danych wyjściowych."
  },
  {
    "en": "ensureToolOutputSnapshot: insert conflicted but no active snapshot found for session ${session.id}",
    "pl": "zapewnieniaToolOutputSnapshot: wstaw konflikt, ale nie znaleziono aktywnej migawki dla sesji ${session.id}"
  },
  {
    "en": "tool_outputs ${approvedOutputId} not found for org ${organizationId}",
    "pl": "tool_outputs ${approvedOutputId} nie znaleziono dla organizacji ${organizationId}"
  },
  {
    "en": "Only organization owners or admins can convert a trial",
    "pl": "Tylko właściciele organizacji lub administratorzy mogą konwertować wersję próbną"
  },
  {
    "en": "Organization is already on a paid plan",
    "pl": "Organizacja ma już plan płatny"
  },
  {
    "en": "Cannot convert a demo organization directly. Start a trial first.",
    "pl": "Nie można bezpośrednio przekonwertować organizacji demonstracyjnej. Najpierw rozpocznij okres próbny."
  },
  {
    "en": "adapter_governance_denied:${governance.reason}",
    "pl": "adapter_governance_denied:${governance.reason}"
  },
  {
    "en": "adapter_resource_denied:${resource.reason}",
    "pl": "adapter_resource_denied:${resource.reason}"
  },
  {
    "en": "adapter_invocation_${existing.status}",
    "pl": "Wywołanie adaptera ma status ${existing.status}"
  },
  {
    "en": "invalid_agent_template_transition:${current.status}:${input.action}",
    "pl": "invalid_agent_template_transition:${current.status}:${input.action}"
  },
  {
    "en": "proposal_supersession_failed:${successorProposalVersionId}",
    "pl": "proposal_supersession_failed:${successorProposalVersionId}"
  },
  {
    "en": "quality_dimension_missing:${dimension}",
    "pl": "quality_dimension_missing:${dimension}"
  },
  {
    "en": "critical_invariant_missing:${invariant}",
    "pl": "critical_invariant_missing:${invariant}"
  },
  {
    "en": "Failed to register governed table sheet artifact",
    "pl": "Nie udało się zarejestrować artefaktu arkusza tabeli zarządzanej"
  },
  {
    "en": "Table Studio materialization table ${params.tableId} was not persisted",
    "pl": "Tabela materializacji Table Studio ${params.tableId} nie została utrwalona"
  },
  {
    "en": "Table Studio materialization failed: table ${params.tableId} does not exist",
    "pl": "Materializacja Table Studio nie powiodła się: tabela ${params.tableId} nie istnieje"
  },
  {
    "en": "Table Studio materialization failed: table ${params.tableId} has no usable schema",
    "pl": "Materializacja Table Studio nie powiodła się: tabela ${params.tableId} nie ma użytecznego schematu"
  },
  {
    "en": "Artifact ${link.artifactId} disappeared during origin registration",
    "pl": "Artefakt ${link.artifactId} zniknął podczas rejestracji pochodzenia"
  },
  {
    "en": "Access grant ${grantId} not found after creation",
    "pl": "Po utworzeniu nie znaleziono przyznania dostępu ${grantId}"
  },
  {
    "en": "Artifact ${params.artifactId} not found in organization ${params.organizationId}",
    "pl": "Nie znaleziono artefaktu ${params.artifactId} w organizacji ${params.organizationId}"
  },
  {
    "en": "Artifact ${params.artifactId} cannot enter review before artifact validation passes",
    "pl": "Artefakt ${params.artifactId} nie może zostać poddany ocenie przed pomyślnym zakończeniem weryfikacji artefaktu"
  },
  {
    "en": "ArtifactRun report materialization requires both sourceType and sourceId",
    "pl": "Materializacja raportu ArtifactRun wymaga zarówno typu sourceType, jak i sourceId"
  },
  {
    "en": "ArtifactRun report materialization received an invalid sourceType",
    "pl": "Materializacja raportu ArtifactRun otrzymała nieprawidłowy typ źródła"
  },
  {
    "en": "ArtifactRun report materialization requires sourceType/sourceId or a resolvable snapshot source context",
    "pl": "Materializacja raportu ArtifactRun wymaga typu sourceType/sourceId lub rozpoznawalnego kontekstu źródłowego migawki"
  },
  {
    "en": "ArtifactRun presentation materialization requires both sourceType and sourceId",
    "pl": "Materializacja prezentacji ArtifactRun wymaga zarówno typu sourceType, jak i sourceId"
  },
  {
    "en": "ArtifactRun ${runId} was not persisted",
    "pl": "ArtifactRun ${runId} nie został utrwalony"
  },
  {
    "en": "ArtifactRun ${params.runId} not found",
    "pl": "Nie znaleziono Artefaktu ${params.runId}"
  },
  {
    "en": "ArtifactRun ${params.runId} not found after preflight",
    "pl": "Nie znaleziono ArtifactRun ${params.runId} po inspekcji wstępnej"
  },
  {
    "en": "ArtifactRun ${params.runId} not found after accept-plan",
    "pl": "Nie znaleziono ArtifactRun ${params.runId} po zaakceptowaniu planu"
  },
  {
    "en": "ArtifactRun ${validated.runId} not found",
    "pl": "Nie znaleziono Artefaktu ${validated.runId}"
  },
  {
    "en": "ArtifactRun ${validated.runId} only supports report, presentation, or sheet materialization currently",
    "pl": "ArtifactRun ${validated.runId} obsługuje obecnie tylko materializację raportów, prezentacji i arkuszy"
  },
  {
    "en": "ArtifactRun ${validated.runId} must have an accepted lifecycle before materialization",
    "pl": "ArtifactRun ${validated.runId} musi mieć zaakceptowany cykl życia przed materializacją"
  },
  {
    "en": "Execution run ${current.executionRunId} not found for ArtifactRun ${validated.runId}",
    "pl": "Nie znaleziono przebiegu wykonania ${current.executionRunId} dla ArtifactRun ${validated.runId}"
  },
  {
    "en": "ArtifactRun ${validated.runId} must be submitted for review before materialization",
    "pl": "ArtifactRun ${validated.runId} należy przesłać do przeglądu przed materializacją"
  },
  {
    "en": "ArtifactRun ${validated.runId} must be approved for apply before materialization",
    "pl": "ArtifactRun ${validated.runId} musi zostać zatwierdzony do zastosowania przed materializacją"
  },
  {
    "en": "Execution run ${current.executionRunId} must be proposals_ready, waiting_for_review, approved_for_apply or applying befo",
    "pl": "Uruchomienie ${current.executionRunId} musi być proposals_ready, waiting_for_review, approved_for_apply lub zastosować przed"
  },
  {
    "en": "Canonical artifact missing for ${current.plan.outputType} materialization ${validated.runId}",
    "pl": "Brak artefaktu kanonicznego dla materializacji ${current.plan.outputType} ${validated.runId}"
  },
  {
    "en": "ArtifactRun ${validated.runId} not found after materialization",
    "pl": "ArtifactRun ${validated.runId} nie został znaleziony po materializacji"
  },
  {
    "en": "${LOG_PREFIX} Failed to read back created source ${id}",
    "pl": "${LOG_PREFIX} Nie udało się odczytać utworzonego źródła ${id}"
  },
  {
    "en": "${LOG_PREFIX} Failed to read back created item ${id}",
    "pl": "${LOG_PREFIX} Nie udało się odczytać utworzonego elementu ${id}"
  },
  {
    "en": "${LOG_PREFIX} Source ${sourceId} not found",
    "pl": "${LOG_PREFIX} Nie znaleziono źródła ${sourceId}"
  }
];
