/*
 * Case Workspace prototype — PL label map (W2-V0.1 corrective pass).
 * NON-PRODUCTION. Modelled on src/utils/enumLabels.ts's Bilingual = {en, pl}
 * shape: one auditable map instead of ad-hoc inline translations scattered
 * across screens/*.html. NIE WYMYŚLAMY DANYCH — every key below is a direct
 * 1:1 PL rendering of an enum/field value already documented in DECISIONS.md
 * as read verbatim from server/src/services/caseWorkspace/*.ts (case_profile,
 * governance_tier, autonomy_policy, plan_version status, node/wait/action-
 * proposal status vocab, artifact_link_relation status, case_status,
 * case_history event types). Unknown keys fall back to the element's
 * existing text — this map never invents a translation.
 *
 * Applied at DOMContentLoaded to every [data-i18n] element. The static PL
 * text already baked into each screen's HTML is kept as a no-JS fallback
 * (so the mockup still reads correctly if a screenshot tool doesn't wait for
 * scripts); this map is the single source of truth those fallbacks were
 * copied from, and JS is authoritative when it runs. Raw EN source stays
 * queryable via the element's own data-i18n-en attribute (set at runtime)
 * for anyone comparing the mockup back to the service code — same
 * "technical attribute, never visible content" rule as the rest of the
 * prototype's data-* attributes.
 */
(function () {
  "use strict";

  var LABELS = {
    // ---- case_profile -----------------------------------------------------
    profile_transformation: { en: "Transformation", pl: "Transformacja" },
    profile_standard:       { en: "Standard", pl: "Standardowy" },
    profile_light:          { en: "Light", pl: "Lekki" },
    profile_monitoring:     { en: "Monitoring", pl: "Monitoring" },

    // ---- governance_tier ----------------------------------------------------
    gov_standard:    { en: "Standard", pl: "Standardowy" },
    gov_controlled:  { en: "Controlled", pl: "Kontrolowany" },
    gov_lightweight: { en: "Lightweight", pl: "Lekki" },

    // ---- autonomy_policy ------------------------------------------------
    autonomy_ask_material: { en: "Ask material actions", pl: "Wymaga potwierdzenia dla istotnych działań" },
    autonomy_ask_each:     { en: "Ask each action", pl: "Wymaga potwierdzenia dla każdej akcji" },

    // ---- field / column labels -------------------------------------------
    field_governance_tier:  { en: "Governance tier", pl: "Poziom nadzoru" },
    field_governance_short: { en: "Governance", pl: "Nadzór" },
    field_case_profile:     { en: "Case profile", pl: "Profil zlecenia" },
    field_details:          { en: "Details", pl: "Szczegóły" },
    field_relations:        { en: "Relations", pl: "Powiązania" },
    field_node_id:          { en: "Node ID", pl: "ID węzła" },
    field_link_status:      { en: "link status", pl: "status linku" },
    field_no_relations:     { en: "No relations", pl: "Brak powiązań" },

    // ---- plan_version status ----------------------------------------------
    plan_status_published:  { en: "Published", pl: "Opublikowany" },
    plan_status_superseded: { en: "Superseded", pl: "Zastąpiony" },
    plan_status_in_review:  { en: "In review", pl: "W przeglądzie" },

    // ---- closure axes contractual-completion value -------------------------
    closure_implementation_completed: { en: "Implementation completed", pl: "Wdrożenie zakończone" },

    // ---- linked/artifact type names — reuses the exact PL already
    // established in src/utils/enumLabels.ts's LINKED_TYPE_LABELS (same
    // field family: the artifact "Typ" a Case links to). ----------------------
    linked_type_document:     { en: "document", pl: "dokument" },
    linked_type_decision:     { en: "decision", pl: "decyzja" },
    linked_type_initiative:   { en: "initiative", pl: "inicjatywa" },
    linked_type_presentation: { en: "presentation", pl: "prezentacja" },

    field_case_id: { en: "Case ID", pl: "ID zlecenia" },

    // ---- generic status / state vocabulary (node, approval, wait, link,
    // value measurement, closure axis) ---------------------------------------
    status_pending_review:  { en: "Pending review", pl: "Oczekuje na przegląd" },
    status_completed:       { en: "Completed", pl: "Zakończone" },
    status_unmeasured:      { en: "Unmeasured", pl: "Niezmierzone" },
    status_pending:         { en: "Pending", pl: "Oczekuje" },
    status_not_applicable:  { en: "Not applicable", pl: "Nie dotyczy" },
    status_confirmed:       { en: "Confirmed", pl: "Potwierdzone" },
    status_partial:         { en: "Partial", pl: "Częściowe" },
    status_unavailable:     { en: "Unavailable", pl: "Niedostępny" },
    status_active:          { en: "Active", pl: "Aktywny" },
    status_overdue:         { en: "Overdue", pl: "Po terminie" },
    status_no_deadline:     { en: "No deadline", pl: "Bez terminu" },
    status_join_pending:    { en: "Join pending", pl: "Oczekuje na złączenie" },
    status_split_activated: { en: "Split activated", pl: "Podział aktywowany" },
    status_branch_selected: { en: "Branch selected", pl: "Gałąź wybrana" },
    status_blocked:         { en: "Blocked", pl: "Zablokowane" },
    status_not_started:     { en: "Not started", pl: "Nie rozpoczęte" },
    status_accepted:        { en: "Accepted", pl: "Zaakceptowane" },
    status_active_overdue:  { en: "Active · overdue", pl: "Aktywne · po terminie" },
    status_approve:         { en: "APPROVE", pl: "ZATWIERDZONO" },
    status_satisfied:       { en: "satisfied", pl: "spełnione" },

    // ---- case_status (lifecycle), shown raw in the activity log's
    // before/after transitions (chip itself already uses the humanised
    // lifecycle-- classes elsewhere) ------------------------------------------
    case_status_draft:  { en: "DRAFT", pl: "Wersja robocza" },
    case_status_active: { en: "ACTIVE", pl: "Aktywne" },

    // ---- case_history event types — humanised per the same rationale as
    // enumLabels.ts's NOTIFICATION_TYPE_LABELS (raw SCREAMING_SNAKE_CASE
    // service event names are developer identifiers, not product language).
    // Raw code kept queryable via data-event-code on the same element. -------
    evt_plan_version_published:     { en: "PLAN_VERSION_PUBLISHED", pl: "Wersja planu opublikowana" },
    evt_action_proposal_decided:    { en: "ACTION_PROPOSAL_DECIDED", pl: "Decyzja w sprawie propozycji akcji" },
    evt_value_measurement_recorded: { en: "VALUE_MEASUREMENT_RECORDED", pl: "Zarejestrowano pomiar wartości" },
    evt_wait_resolved:              { en: "WAIT_RESOLVED", pl: "Oczekiwanie rozwiązane" },
    evt_governance_tier_changed:    { en: "GOVERNANCE_TIER_CHANGED", pl: "Zmieniono poziom nadzoru" },
    evt_run_bound:                  { en: "RUN_BOUND", pl: "Powiązano przebieg (Run)" },
    evt_case_status_changed:        { en: "CASE_STATUS_CHANGED", pl: "Zmieniono status zlecenia" }
  };

  function apply() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var entry = LABELS[key];
      if (!entry) return; // unknown key: never invent — leave existing text as-is
      var text = entry.pl;
      if (el.hasAttribute("data-i18n-upper")) text = text.toUpperCase();
      el.textContent = text;
      el.setAttribute("data-i18n-en", entry.en);
    });
  }

  window.CW_LABELS = LABELS;
  document.addEventListener("DOMContentLoaded", apply);
})();
