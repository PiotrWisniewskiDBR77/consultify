import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_17: readonly ServerPayloadMessage[] = [
  {
    "en": "Fault injection is test-only",
    "pl": "Wstrzykiwanie usterek ma charakter wyłącznie testowy"
  },
  {
    "en": "Run not found",
    "pl": "Nie znaleziono uruchomienia"
  },
  {
    "en": "Unknown DRD industry profile: ${industry}",
    "pl": "Nieznany profil branży DRD: ${industry}"
  },
  {
    "en": "You already have a pending access request for this assessment",
    "pl": "Masz już oczekującą prośbę o dostęp do tej oceny"
  },
  {
    "en": "Access request not found",
    "pl": "Nie znaleziono żądania dostępu"
  },
  {
    "en": "This request has already been processed",
    "pl": "To żądanie zostało już przetworzone"
  },
  {
    "en": "organizationId and sourceType are required",
    "pl": "Identyfikator organizacji i typ źródła są wymagane"
  },
  {
    "en": "Invalid source type: ${sourceType}",
    "pl": "Nieprawidłowy typ źródła: ${sourceType}"
  },
  {
    "en": "Failed to create audit program",
    "pl": "Nie udało się utworzyć programu audytu"
  },
  {
    "en": "[quick-access] refused: endpoint is disabled or this is a production runtime",
    "pl": "[szybki dostęp] odrzucony: punkt końcowy jest wyłączony lub jest to środowisko wykonawcze"
  },
  {
    "en": "BACKUP_OPTIONAL_TABLE_NOT_APPROVED:${table}",
    "pl": "BACKUP_OPTIONAL_TABLE_NOT_APPROVED:${table}"
  },
  {
    "en": "BACKUP_SCHEMA_NOT_MIGRATED:${table}",
    "pl": "BACKUP_SCHEMA_NOT_MIGRATED:${table}"
  },
  {
    "en": "BACKUP_ENCRYPTION_KEY is required; unencrypted backups are forbidden",
    "pl": "wymagany jest BACKUP_ENCRYPTION_KEY; niezaszyfrowane kopie zapasowe są zabronione"
  },
  {
    "en": "BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes",
    "pl": "BACKUP_ENCRYPTION_KEY musi dekodować dokładnie 32 bajty"
  },
  {
    "en": "Unsupported or unencrypted backup format",
    "pl": "Nieobsługiwany lub niezaszyfrowany format kopii zapasowej"
  },
  {
    "en": "BACKUP_REQUIRED_TABLE_MISSING:${table}",
    "pl": "BACKUP_REQUIRED_TABLE_MISSING:${table}"
  },
  {
    "en": "BACKUP_OPTIONAL_TABLE_NOT_ORG_SCOPED:${table}",
    "pl": "BACKUP_OPTIONAL_TABLE_NOT_ORG_SCOPED:${table}"
  },
  {
    "en": "BACKUP_REQUIRED_TABLE_EXPORT_FAILED:${table}:${err?.message || err}",
    "pl": "BACKUP_REQUIRED_TABLE_EXPORT_FAILED:${table}:${err?.message || err}"
  },
  {
    "en": "BACKUP_RECONCILIATION_PERSIST_FAILED:${message}",
    "pl": "BACKUP_RECONCILIATION_PERSIST_FAILED:${message}"
  },
  {
    "en": "BACKUP_TABLE_ROW_COUNT_MISMATCH:${entry.name}",
    "pl": "BACKUP_TABLE_ROW_COUNT_MISMATCH:${entry.name}"
  },
  {
    "en": "BACKUP_TABLE_HASH_MISMATCH:${entry.name}",
    "pl": "BACKUP_TABLE_HASH_MISMATCH:${entry.name}"
  },
  {
    "en": "RESTORE_TARGET_TABLE_MISSING:${table}",
    "pl": "RESTORE_TARGET_TABLE_MISSING:${table}"
  },
  {
    "en": "BACKUP_OWNER_ID_MISSING:${ownerTable}",
    "pl": "BACKUP_OWNER_ID_MISSING:${ownerTable}"
  },
  {
    "en": "RESTORE_OWNER_COUNT_MISMATCH:${ownerTable}",
    "pl": "RESTORE_OWNER_COUNT_MISMATCH:${ownerTable}"
  },
  {
    "en": "RESTORE_OWNER_HASH_MISMATCH:${ownerTable}",
    "pl": "RESTORE_OWNER_HASH_MISMATCH:${ownerTable}"
  },
  {
    "en": "RESTORE_COLD_COUNT_MISMATCH:${ownerTable}",
    "pl": "RESTORE_COLD_COUNT_MISMATCH:${ownerTable}"
  },
  {
    "en": "RESTORE_COLD_HASH_MISMATCH:${ownerTable}",
    "pl": "RESTORE_COLD_HASH_MISMATCH:${ownerTable}"
  },
  {
    "en": "createBenefit: organizationId is required",
    "pl": "createBenefit: identyfikator organizacji jest wymagany"
  },
  {
    "en": "createBenefit: name is required",
    "pl": "createBenefit: nazwa jest wymagana"
  },
  {
    "en": "createBenefit: initiativeId is required (initiative_benefits.initiative_id is NOT NULL)",
    "pl": "createBenefit: wymagany jest identyfikator inicjatywy (initiative_benefits.initiative_id ma ograniczenie NOT NULL)"
  },
  {
    "en": "handoffFromClosure: organizationId is required",
    "pl": "handoffFromClosure: wymagany jest identyfikator organizacji"
  },
  {
    "en": "handoffFromClosure: initiativeId is required",
    "pl": "handoffFromClosure: wymagany jest identyfikator inicjatywy"
  },
  {
    "en": "promoteBenefitToKpi: organizationId is required",
    "pl": "promujBenefitToKpi: identyfikator organizacji jest wymagany"
  },
  {
    "en": "promoteBenefitToKpi: benefitId is required",
    "pl": "promujBenefitToKpi: identyfikator świadczenia jest wymagany"
  },
  {
    "en": "Invalid plan",
    "pl": "Nieprawidłowy plan"
  },
  {
    "en": "Organization is managed manually. Update the contract from admin billing.",
    "pl": "Organizacja jest zarządzana ręcznie. Zaktualizuj umowę z poziomu rozliczeń administracyjnych."
  },
  {
    "en": "Billing is not configured (Stripe unavailable). Cannot activate a subscription. ",
    "pl": "Rozliczenia nie są skonfigurowane (pasek niedostępny). Nie można aktywować subskrypcji."
  },
  {
    "en": "No active subscription",
    "pl": "Brak aktywnej subskrypcji"
  },
  {
    "en": "Payment method not found",
    "pl": "Nie znaleziono metody płatności"
  },
  {
    "en": "Billing is not configured (Stripe unavailable). Cannot create setup intent.",
    "pl": "Rozliczenia nie są skonfigurowane (pasek niedostępny). Nie można utworzyć zamiaru konfiguracji."
  },
  {
    "en": "Seat purchase failed: ${msg}",
    "pl": "Zakup miejsca nie powiódł się: ${msg}"
  },
  {
    "en": "Billing is not configured (Stripe unavailable). Cannot process seat purchase.",
    "pl": "Rozliczenia nie są skonfigurowane (pasek niedostępny). Nie można przetworzyć zakupu miejsca."
  },
  {
    "en": "Dependencies not initialized",
    "pl": "Zależności nie zostały zainicjowane"
  },
  {
    "en": "Source template not found",
    "pl": "Nie znaleziono szablonu źródłowego"
  },
  {
    "en": "BudgetManagementService dependencies not initialized",
    "pl": "Zależności usługi BudgetManagementService nie zostały zainicjowane"
  },
  {
    "en": "Organization ${organizationId} not found",
    "pl": "Nie znaleziono organizacji ${organizationId}"
  },
  {
    "en": "Budget not found",
    "pl": "Nie znaleziono budżetu"
  },
  {
    "en": "Scenario not found",
    "pl": "Nie znaleziono scenariusza"
  },
  {
    "en": "CAPEX line is required before approval. Add at least one CAPEX budget line.",
    "pl": "Przed zatwierdzeniem wymagana jest linia CAPEX. Dodaj co najmniej jedną linię budżetu CAPEX."
  },
  {
    "en": "canvas_idea_materialization_receipts table is missing. Apply ",
    "pl": "Brak tabeli canvas_idea_materialization_receipts. Stosować"
  },
  {
    "en": "canvas_idea_materialization_receipts is missing required index(es): ",
    "pl": "canvas_idea_materialization_receipts brakuje wymaganych indeksów:"
  },
  {
    "en": "Idea materialization receipt ${receipt.id} could not be confirmed by an independent read-back",
    "pl": "Potwierdzenie realizacji pomysłu ${receipt.id} nie mogło zostać potwierdzone w drodze niezależnej analizy"
  },
  {
    "en": "Idea materialization read-back failed for ${ideaId} (idea=${Boolean(ideaReadBack.rows[0])}, map=${Boolean(mapReadBack.ro",
    "pl": "Odczyt materializacji pomysłu nie powiódł się dla ${ideaId} (idea=${Boolean(ideaReadBack.rows[0])}, mapa=${Boolean(mapReadBack.ro"
  },
  {
    "en": "Failed to bootstrap Canvas Workspace base",
    "pl": "Nie udało się załadować bazy Canvas Workspace"
  },
  {
    "en": "Failed to create Table Studio table",
    "pl": "Nie udało się utworzyć tabeli Table Studio"
  },
  {
    "en": "knapsack: step must be > 0",
    "pl": "plecak: krok musi być > 0"
  },
  {
    "en": "case_status_transition_not_allowed:${row.case_status}->${targetStatus}",
    "pl": "case_status_transition_not_allowed:${row.case_status}->${targetStatus}"
  },
  {
    "en": "case_status_event_type_unmapped:${updatedRow.case_status}",
    "pl": "case_status_event_type_unmapped:${updatedRow.case_status}"
  },
  {
    "en": "case_closure_axis_not_ready:${axis}",
    "pl": "case_closure_axis_not_ready:${axis}"
  },
  {
    "en": "intake_${fieldCode}_required",
    "pl": "Pole intake_${fieldCode} jest wymagane"
  }
];
