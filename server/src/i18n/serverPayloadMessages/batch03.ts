import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_03: readonly ServerPayloadMessage[] = [
  {
    "en": "Cannot put an initiative on hold from ${currentStatus} (only ${InitiativeStatus.IN_EXECUTION} supports on_hold)",
    "pl": "Nie można wstrzymać inicjatywy z ${currentStatus} (tylko ${InitiativeStatus.IN_EXECUTION} obsługuje on_hold)"
  },
  {
    "en": "Cannot reopen: version is in status ${vN.status}, not APPROVED",
    "pl": "Nie można ponownie otworzyć: wersja jest w statusie ${vN.status}, a nie APPROVED"
  },
  {
    "en": "Cannot resolve baseId for permission check",
    "pl": "Nie można rozwiązać baseId dla sprawdzenia uprawnień"
  },
  {
    "en": "Cannot transition from ${fromNorm}",
    "pl": "Nie można przejść z ${fromNorm}"
  },
  {
    "en": "Cannot transition support ticket from ${fromStatus} to ${toStatus}",
    "pl": "Nie można przejść zgłoszenia wsparcia z ${fromStatus} do ${toStatus}"
  },
  {
    "en": "Cannot verify balance sheet equation — missing Total Assets, Total Liabilities, or Equity",
    "pl": "Nie można zweryfikować równania bilansu — brakuje całkowitych aktywów, zobowiązań lub kapitału własnego"
  },
  {
    "en": "Canonical cash_tax_rate_pct is missing",
    "pl": "Brakuje kanonicznej wartości cash_tax_rate_pct"
  },
  {
    "en": "Case ${params.caseId} does not belong to organization ${params.organizationId}",
    "pl": "Sprawa ${params.caseId} nie należy do organizacji ${params.organizationId}"
  },
  {
    "en": "Case ${params.caseId} not found for organization ${params.organizationId}",
    "pl": "Sprawa ${params.caseId} nie została znaleziona dla organizacji ${params.organizationId}"
  },
  {
    "en": "Cash flow statement is missing operating, investing, and financing lines.",
    "pl": "Wyciąg z przepływów pieniężnych brakuje linii operacyjnych, inwestycyjnych i finansowych."
  },
  {
    "en": "Cash is negative. Verify sign and scale.",
    "pl": "Gotówka jest ujemna. Sprawdź znak i skalę."
  },
  {
    "en": "Changes applied successfully",
    "pl": "Zmiany zostały pomyślnie zastosowane"
  },
  {
    "en": "Chart would be rendered here",
    "pl": "Wykres zostałby tu wyrenderowany"
  },
  {
    "en": "Checklist item is already checked",
    "pl": "Pozycja listy kontrolnej jest już zaznaczona"
  },
  {
    "en": "Checklist item is not checked",
    "pl": "Pozycja listy kontrolnej nie jest zaznaczona"
  },
  {
    "en": "Checklist item not found",
    "pl": "Pozycja listy kontrolnej nie została znaleziona"
  },
  {
    "en": "Checklist item text must be non-empty",
    "pl": "Tekst pozycji listy kontrolnej nie może być pusty"
  },
  {
    "en": "Circularity solver did not converge for period ${error.periodId} within finance_baseline_models.circularity_max_iterations",
    "pl": "Rozwiązanie cykliczne nie zbiegło się dla okresu ${error.periodId} w ramach finance_baseline_models.circularity_max_iterations"
  },
  {
    "en": "Client readback confirmation is required before handoff",
    "pl": "Wymagane potwierdzenie odczytu klienta przed przekazaniem"
  },
  {
    "en": "Comment body must be non-empty",
    "pl": "Treść komentarza nie może być pusta"
  },
  {
    "en": "Comment is already resolved",
    "pl": "Komentarz został już rozwiązany"
  },
  {
    "en": "Comment is not resolved",
    "pl": "Komentarz nie został rozwiązany"
  },
  {
    "en": "Comment not found",
    "pl": "Komentarz nie został znaleziony"
  },
  {
    "en": "Conclusion not found",
    "pl": "Wnioski nie zostały znalezione"
  },
  {
    "en": "Concurrent modification detected for event ${item.providerEventId}",
    "pl": "Wykryto jednoczesną modyfikację dla zdarzenia ${item.providerEventId}"
  },
  {
    "en": "Concurrent modification detected for event ${providerEventId}",
    "pl": "Wykryto jednoczesną modyfikację dla zdarzenia ${providerEventId}"
  },
  {
    "en": "Consider adding: ${formatSectionType(recType)}",
    "pl": "Rozważ dodanie: ${formatSectionType(recType)}"
  },
  {
    "en": "Consider expanding your justification with more detail.",
    "pl": "Rozważ rozbudowanie uzasadnienia o więcej szczegółów."
  },
  {
    "en": "Consultants can only submit initiatives they created",
    "pl": "Konsultanci mogą tylko przesyłać inicjatywy, które stworzyli"
  },
  {
    "en": "Contradicted candidate cannot be marked ready for review until it is split or clarified.",
    "pl": "Kandydat sprzecznego typu nie może zostać oznaczony jako gotowy do przeglądu, dopóki nie zostanie podzielony lub wyjaśniony."
  },
  {
    "en": "Conversation tool cost limit reached",
    "pl": "Osiągnięto limit kosztów narzędzia rozmowy"
  },
  {
    "en": "Conversion not found",
    "pl": "Konwersja nie została znaleziona"
  },
  {
    "en": "Could not create the initiative.",
    "pl": "Nie udało się utworzyć inicjatywy."
  },
  {
    "en": "Could not validate VAT number",
    "pl": "Nie można zweryfikować numeru VAT"
  },
  {
    "en": "Cover-page logo was requested but no usable logo asset was available; the cover was rendered without it.",
    "pl": "Zażądano logo na stronie tytułowej, ale nie było dostępnej użytecznej wersji logo; okładka została wyrenderowana bez niego."
  },
  {
    "en": "Critical P&L lines present",
    "pl": "Obecne są krytyczne linie P&L"
  },
  {
    "en": "Critical: API Error rate is ${summary.errorRate}%",
    "pl": "Krytyczny: Współczynnik błędów API to ${summary.errorRate}%"
  },
  {
    "en": "Critical: Average response time is ${summary.avgResponseTime}ms",
    "pl": "Krytyczne: średni czas odpowiedzi wynosi ${summary.avgResponseTime} ms"
  },
  {
    "en": "Critical: Heap usage is ${memory.heapUsed}MB",
    "pl": "Krytyczny: Wykorzystanie sterty to ${memory.heapUsed}MB"
  },
  {
    "en": "Cron expression must have exactly 5 fields: minute hour dayOfMonth month dayOfWeek",
    "pl": "Wyrażenie cron musi mieć dokładnie 5 pól: minuta, godzina, dzień miesiąca, miesiąc, dzień tygodnia"
  },
  {
    "en": "Current assets exceed total assets.",
    "pl": "Aktywa obecne przekraczają aktywa całkowite."
  },
  {
    "en": "Current liabilities exceed total liabilities.",
    "pl": "Zobowiązania obecne przekraczają zobowiązania całkowite."
  },
  {
    "en": "Current working revision has no content_semantic_hash yet (never checkpointed or computed) — nothing to pin compute to",
    "pl": "Bieżąca wersja robocza nie ma jeszcze content_semantic_hash (nigdy nie była zapisana lub obliczona) — nie ma niczego do przypięcia obliczeń"
  },
  {
    "en": "DATABASE_URL or DB_HOST required for PostgreSQL",
    "pl": "Wymagany DATABASE_URL lub DB_HOST dla PostgreSQL"
  },
  {
    "en": "DB_MANAGED_SCHEMA disabled; skipping initializeDatabase()",
    "pl": "DB_MANAGED_SCHEMA wyłączone; pomijanie initializeDatabase()"
  },
  {
    "en": "Data required on ${unresolvedDataCards.length} slide(s); replace explicit gaps with grounded evidence before final delivery.",
    "pl": "Wymagane dane na ${unresolvedDataCards.length} slajdzie(ach); zastąp jawne luki dowodami przed końcową dostawą."
  },
  {
    "en": "Database error validating initiative",
    "pl": "Błąd bazy danych podczas walidacji inicjatywy"
  },
  {
    "en": "Database error validating organization",
    "pl": "Błąd bazy danych podczas walidacji organizacji"
  },
  {
    "en": "Database error validating project",
    "pl": "Błąd bazy danych podczas walidacji projektu"
  },
  {
    "en": "Decision ${decisionId} is ${decision.decision}, but only APPROVED / MODIFIED are executable",
    "pl": "Decyzja ${decisionId} to ${decision.decision}, ale tylko APPROVED / MODIFIED są wykonywalne"
  },
  {
    "en": "Decision deferred pending additional information.",
    "pl": "Decyzja odroczona w oczekiwaniu na dodatkowe informacje."
  },
  {
    "en": "Decision escalated for faster resolution.",
    "pl": "Decyzja eskalowana w celu szybszego rozwiązania."
  },
  {
    "en": "Decision maker assigned to ${candidate.display_name || candidate.id}.",
    "pl": "Przydzielony decydent do ${candidate.display_name || candidate.id}."
  },
  {
    "en": "Decision marked as ${nextStatus}.",
    "pl": "Decyzja oznaczona jako ${nextStatus}."
  },
  {
    "en": "Decision not found: ${decisionId} ",
    "pl": "Nie znaleziono decyzji: ${decisionId} "
  },
  {
    "en": "Decisions Required",
    "pl": "Wymagane decyzje"
  },
  {
    "en": "Deck has ${cards.length} cards (recommended max: 30). Consider splitting into two presentations.",
    "pl": "Prezentacja ma ${cards.length} kart (rekomendowany maks.: 30). Rozważ podzielenie na dwie prezentacje."
  },
  {
    "en": "Deck has ${cards.length} cards. Presentations above 20 cards may lose audience attention.",
    "pl": "Prezentacja ma ${cards.length} kart. Prezentacje powyżej 20 kart mogą stracić uwagę publiczności."
  },
  {
    "en": "Deck has no cards. Add at least one card to proceed.",
    "pl": "Prezentacja nie ma kart. Dodaj przynajmniej jedną kartę, aby kontynuować."
  },
  {
    "en": "Deck has no recommendation/next-steps/roadmap slide. A decision deck should end with a call to action.",
    "pl": "Prezentacja nie ma slajdu z rekomendacjami/następnymi krokami/planem działania. Prezentacja decyzyjna powinna kończyć się wezwaniami do działania."
  }
];
