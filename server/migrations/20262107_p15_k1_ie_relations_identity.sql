-- P15-K1 (DEC-421, decyzja D4) — klucz relacji ma niesc TOZSAMOSC, nie numer wersji.
--
-- POMIAR 07.09 (baza consultify_fable, 65 wierszy `ie_aggregate_relations`):
--   relation_type niosl identyfikator/wersje zrodla, np.
--     PLAN_SCENARIO_PORTFOLIO:1 · PLAN_SCENARIO_MEMBER:1:init-siri-01
--     PORTFOLIO_SCENARIO_MEMBER:2:init-adma-04 · CAPACITY_SCENARIO_PLAN:1
--   a tabela miala:
--     PRIMARY KEY (organization_id, relation_type, source_type, source_id)
--     UNIQUE      (organization_id, relation_type, target_type, target_id)
--   Skutek: DRUGI plan zalozony na tej samej wersji portfela wstawial
--   relacje PLAN_SCENARIO_PORTFOLIO:1 -> ten sam portfel i dostawal 23505,
--   co trasa runtime zwracala jako HTTP 500 INITIATIVES_EXECUTION_RUNTIME_FAILED.
--
-- ZMIANA (addytywna dla DANYCH — zaden wiersz i zadna kolumna nie ginie):
--   1. relation_type zostaje SAMA NAZWA relacji (czesc przed pierwszym ':').
--      Wersja i tozsamosc zrodla juz sa w kolumnach source_id / source_version
--      (istnialy od migracji 932 — nie dokladamy nowych kolumn).
--   2. Nowy klucz tozsamosci: (organization_id, relation_type, source_type,
--      source_id, source_version, target_type, target_id). Dopuszcza wiele
--      planow na jeden portfel i wiele portfeli na jedna inicjatywe, a nadal
--      blokuje duplikat DOKLADNIE tej samej relacji.
--   3. Dwa stare klucze (PK + UNIQUE) sa zbudowane na relation_type niosacym
--      tozsamosc, wiec po punkcie 1 istniejace dane LAMIA je oba (5 czlonkow
--      jednego planu = 5 wierszy o tym samym relation_type i source_id).
--      Nie da sie ich zostawic — sa zastapione kluczem z punktu 2 oraz
--      indeksami czesciowymi z punktu 4, ktore odtwarzaja ICH semantyke tam,
--      gdzie byla zamierzona.
--   4. Rodzina relacji, ktora NIGDY nie niosla tozsamosci w nazwie
--      (SOURCE_*, INITIATIVE_EXECUTION_CASE, ACCEPTED_CLASSIC_ADOPTION,
--      TERESA_CHAT_DRAFT_ADOPTION, RESOURCE_COMMITMENT_CAPACITY) zachowuje
--      OBA stare ograniczenia 1:1, jako indeksy czesciowe. Dzieki temu
--      „jedna rejestracja zrodla na inicjatywe" i „jeden przypadek realizacji
--      na inicjatywe" dzialaja dokladnie jak przed migracja.
--   5. Indeks idx_ie_relations_target (zwykly, nie-unikalny) ZOSTAJE nietkniety.
--
-- CO ZOSTAJE DO POZNIEJSZEJ MIGRACJI: nic do usuniecia po stronie kolumn.
--   Gdyby po potwierdzeniu na stagingu okazalo sie, ze indeksy czesciowe z pkt 4
--   sa zbedne (np. domena pilnuje tego sama), usuwamy je OSOBNA, pozniejsza
--   migracja — nie ta.

BEGIN;

-- 1. Stare klucze oparte na relation_type z tozsamoscia zdejmujemy PRZED
--    przepisaniem wierszy — inaczej samo przepisanie je lamie (5 czlonkow
--    jednego planu ma po przepisaniu ten sam relation_type i source_id).
ALTER TABLE ie_aggregate_relations
  DROP CONSTRAINT IF EXISTS ie_aggregate_relations_pkey;
ALTER TABLE ie_aggregate_relations
  DROP CONSTRAINT IF EXISTS ie_aggregate_relations_organization_id_relation_type_target_key;

-- 2. Rozbicie dotychczasowego relation_type na sama nazwe relacji.
--    Wersja i identyfikator zrodla juz siedza w source_version / source_id,
--    wiec nie trzeba niczego parsowac ani dokladac kolumn.
UPDATE ie_aggregate_relations
   SET relation_type = split_part(relation_type, ':', 1)
 WHERE position(':' IN relation_type) > 0;

-- 3. Nowy klucz tozsamosci relacji.
CREATE UNIQUE INDEX IF NOT EXISTS ie_aggregate_relations_identity_key
  ON ie_aggregate_relations (
    organization_id, relation_type, source_type, source_id, source_version,
    target_type, target_id
  );

-- 4. Odtworzenie starej semantyki dla relacji bez tozsamosci w nazwie.
CREATE UNIQUE INDEX IF NOT EXISTS ie_aggregate_relations_singleton_source_key
  ON ie_aggregate_relations (organization_id, relation_type, source_type, source_id)
  WHERE relation_type IN (
    'INITIATIVE_EXECUTION_CASE',
    'ACCEPTED_CLASSIC_ADOPTION',
    'TERESA_CHAT_DRAFT_ADOPTION',
    'RESOURCE_COMMITMENT_CAPACITY'
  ) OR relation_type LIKE 'SOURCE\_%';

CREATE UNIQUE INDEX IF NOT EXISTS ie_aggregate_relations_singleton_target_key
  ON ie_aggregate_relations (organization_id, relation_type, target_type, target_id)
  WHERE relation_type IN (
    'INITIATIVE_EXECUTION_CASE',
    'ACCEPTED_CLASSIC_ADOPTION',
    'TERESA_CHAT_DRAFT_ADOPTION',
    'RESOURCE_COMMITMENT_CAPACITY'
  ) OR relation_type LIKE 'SOURCE\_%';

COMMIT;
