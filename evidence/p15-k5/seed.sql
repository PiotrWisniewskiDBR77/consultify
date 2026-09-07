-- [ODMROZENIE 05_INITIATIVES DEC-421] P15-K5 — DANE PROBNE do odbioru „Obciazenia rol".
--
-- DLACZEGO to jest potrzebne: pomiar K0 (07.09) wykazal `users.job_title` 0/31
-- i `required_capacity_fte` 0/72. Bez stanowisk arkusz okres x rola UCZCIWIE
-- pokaze „Nieznane" zamiast luki — i tak ma byc. Zeby odbior mial LICZBY,
-- wlasciciel (albo nadzorca za jego zgoda) uruchamia ten skrypt na stagingu
-- PRZED odbiorem, a potem wpisuje popyt w karcie planu („Obciazenie rol").
--
-- Skrypt jest IDEMPOTENTNY i nie tworzy zadnego rekordu — tylko uzupelnia
-- kolumny profilowe istniejacych osob i FTE istniejacych inicjatyw.
-- Org: DBR77 (cc9db573-260f-4a19-927f-f3cc1fbaea38).

BEGIN;

-- 1. STANOWISKA (rola = `users.job_title`; to samo pole czyta Realizacja -> Zasoby).
--    3x Controls Engineer, 2x Analityk, 1x Kierownik projektu.
UPDATE users SET job_title = 'Controls Engineer'
 WHERE organization_id = 'cc9db573-260f-4a19-927f-f3cc1fbaea38'
   AND id IN (
     'bf0f01a2-9ada-4cb8-a331-4dce1930e4f3',
     'e60062fb-cd33-41bf-bac2-f361aae2422a',
     'e3be0976-096d-4024-87e8-bcd4afaafead'
   );
UPDATE users SET job_title = 'Analityk'
 WHERE organization_id = 'cc9db573-260f-4a19-927f-f3cc1fbaea38'
   AND id IN (
     '3ab90703-98cb-48c6-a7e9-d2cbe6bed3c6',
     'seed_user_cc9db573-260f-4a19-927f-f3cc1fbaea38_it'
   );
UPDATE users SET job_title = 'Kierownik projektu'
 WHERE organization_id = 'cc9db573-260f-4a19-927f-f3cc1fbaea38'
   AND id = 'seed_user_cc9db573-260f-4a19-927f-f3cc1fbaea38_ops_lead';

-- 2. DOSTEPNOSC: jeden Controls Engineer na pol etatu — zeby podaz nie byla
--    przypadkiem rowna liczbie glow i widac bylo, ze `availability_percent` dziala.
UPDATE users SET weekly_capacity_hours = 40, availability_percent = 50
 WHERE organization_id = 'cc9db573-260f-4a19-927f-f3cc1fbaea38'
   AND id = 'e3be0976-096d-4024-87e8-bcd4afaafead';

-- 3. POPYT AWARYJNY (`required_capacity_fte`) dla 5 zatwierdzonych inicjatyw.
--    W arkuszu ladauje w wierszu „Bez stanowiska" ze zrodlem „Nieznane" —
--    dopoki PMO nie wpisze podzialu na role w karcie planu.
UPDATE initiatives SET required_capacity_fte = 2.0
 WHERE organization_id = 'cc9db573-260f-4a19-927f-f3cc1fbaea38' AND id = 'init-siri-02';
UPDATE initiatives SET required_capacity_fte = 1.5
 WHERE organization_id = 'cc9db573-260f-4a19-927f-f3cc1fbaea38' AND id = 'init-siri-04';
UPDATE initiatives SET required_capacity_fte = 1.0
 WHERE organization_id = 'cc9db573-260f-4a19-927f-f3cc1fbaea38' AND id = 'init-adma-04';
UPDATE initiatives SET required_capacity_fte = 1.0
 WHERE organization_id = 'cc9db573-260f-4a19-927f-f3cc1fbaea38' AND id = 'init-adma-06';
UPDATE initiatives SET required_capacity_fte = 0.5
 WHERE organization_id = 'cc9db573-260f-4a19-927f-f3cc1fbaea38' AND id = 'init-drd-final-02';

COMMIT;

-- Kontrola po uruchomieniu (oczekiwane: 6 stanowisk, 5 inicjatyw z FTE):
--   SELECT job_title, count(*) FROM users
--    WHERE organization_id='cc9db573-260f-4a19-927f-f3cc1fbaea38' AND job_title IS NOT NULL
--    GROUP BY 1;
--   SELECT count(*) FROM initiatives
--    WHERE organization_id='cc9db573-260f-4a19-927f-f3cc1fbaea38' AND required_capacity_fte > 0;
