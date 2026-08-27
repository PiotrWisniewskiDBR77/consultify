-- FIX-2 (odbior dyzuru 33): waga wkladu, ktorej nikt nie ustawil, nie moze udawac pelnego wkladu.
--
-- goal_initiative_links.contribution_weight zostala utworzona z DEFAULT 1.0
-- (server/migrations/20260719_baseline_gap.sql:4649). Przez to POMINIECIE kolumny w INSERT
-- — czyli jedyny sposob, zeby nie wpisac ani 1.0, ani NULL-a, wymagany przez §P.8.d pkt 3 —
-- i tak stemplowalo wiersz wartoscia 1.0, nieodroznialna od liczby ustawionej swiadomie.
--
-- Ta migracja zdejmuje DEFAULT. Nie zmienia zadnego istniejacego wiersza, nie usuwa kolumny,
-- nie dodaje NOT NULL. Po niej „pominieta kolumna" znaczy NULL = „waga nieustalona",
-- a getGoalRollup raportuje takie linki jawnie (unsetContributionWeights /
-- contributionWeightValueReason=DECISION_REQUIRED) zamiast po cichu liczyc je jako 1.
--
-- Sciezka legacy (jawna liczba bez klasy) nadal przekazuje wartosc wprost
-- (`weight ?? 1.0`), wiec nie zalezy od DEFAULT-u.

ALTER TABLE goal_initiative_links
  ALTER COLUMN contribution_weight DROP DEFAULT;
