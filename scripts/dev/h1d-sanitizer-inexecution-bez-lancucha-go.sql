-- H1d — SANITIZER (TYLKO RAPORT, ZERO ZAPISU).
--
-- PO CO: od migracji P12 bramka „start realizacji wymaga aktualnej decyzji GO"
-- (H16/INI-005) była martwa — warunek porównywał kody 'SCHEDULED'/'EXECUTING',
-- których CHECK `initiatives_status_check_p12` nie dopuszcza. Każdy wiersz,
-- który wszedł w IN_EXECUTION w tym okresie, mógł to zrobić BEZ decyzji GO
-- i bez śladu handoffu. Ten raport pokazuje, ile takich wierszy żyje na danej
-- bazie i czego dokładnie im brakuje.
--
-- REGUŁA NADZORCY („rejestr wygrywa ze statusem wiersza"): sam kod kolumny
-- IN_EXECUTION nie jest dowodem, że inicjatywa jest w realizacji. Dowodem jest
-- ŁAŃCUCH: aktualna, zatwierdzona decyzja GO + przyjęty handoff + stempel startu.
--
-- ZAPYTANIE NIE ZMIENIA ANI JEDNEGO WIERSZA. Naprawa danych jest osobną decyzją
-- właściciela (część wierszy może być legalna — sprzed P12).
--
-- URUCHOMIENIE (TYLKO baza lokalna/fikstura; NIGDY URL stagingu/demo):
--   psql "$LOCAL_DATABASE_URL" -f scripts/dev/h1d-sanitizer-inexecution-bez-lancucha-go.sql

SELECT
  i.organization_id,
  i.id                                    AS initiative_id,
  i.name,
  agg.payload_json->>'lifecycleState'     AS etap_silnika,
  i.execution_started_at,
  (go.decision_id IS NOT NULL)            AS ma_decyzje_go,
  go.decision_status                      AS go_status,
  go.deadline_at                          AS go_termin,
  (go.deadline_at > NOW())                AS go_aktualna,
  (h.id IS NOT NULL)                      AS ma_handoff_do_realizacji,
  CASE
    WHEN go.decision_id IS NULL              THEN 'BRAK DECYZJI GO'
    WHEN go.decision_status <> 'approved'    THEN 'DECYZJA GO NIEZATWIERDZONA'
    WHEN go.deadline_at <= NOW()             THEN 'DECYZJA GO WYGASLA'
    WHEN h.id IS NULL                        THEN 'BRAK HANDOFFU DO REALIZACJI'
    ELSE 'LANCUCH KOMPLETNY'
  END                                     AS werdykt
FROM initiatives i
LEFT JOIN ie_aggregate_state agg
       ON agg.organization_id = i.organization_id
      AND agg.aggregate_type  = 'initiative'
      AND agg.aggregate_id    = i.id
-- Tylko NAJWYZSZA wersja decyzji liczy sie jako aktualna (wersje sa niezmienne).
LEFT JOIN LATERAL (
  SELECT d.decision_id, d.decision_status, d.deadline_at
    FROM initiative_lifecycle_gate_decisions d
   WHERE d.organization_id = i.organization_id
     AND d.initiative_id   = i.id
     AND d.pmo_domain      = 'GOVERNANCE_DECISION_MAKING'
   ORDER BY d.version DESC
   LIMIT 1
) go ON TRUE
LEFT JOIN LATERAL (
  SELECT hh.id
    FROM initiative_handoffs hh
   WHERE hh.organization_id = i.organization_id
     AND hh.initiative_id   = i.id
     AND hh.to_status       = 'IN_EXECUTION'
   ORDER BY hh.created_at DESC
   LIMIT 1
) h ON TRUE
WHERE i.status = 'IN_EXECUTION'
ORDER BY werdykt, i.organization_id, i.id;
