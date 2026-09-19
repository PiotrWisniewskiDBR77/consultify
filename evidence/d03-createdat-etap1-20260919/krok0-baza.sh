#!/usr/bin/env bash
# D-03 / QD16 etap 1 — KROK 0 measurement on a COPY of the staging dump.
# Never points at staging or demo: the container is station D's own, DB name is explicit.
# REGUŁA 10: no password in this file; export PGPASSWORD in the environment.
set -u
: "${PGPASSWORD:?ustaw PGPASSWORD w środowisku (hasło jednorazowego kontenera)}"
CONTAINER="${CONTAINER:-qoder-d-pg-7}"
DB="${DB:-consultify_qd16}"
PSQL="docker exec -e PGPASSWORD $CONTAINER psql -U postgres -d $DB -At"

echo "=== A. kontener / silnik / baza ==="
docker inspect "$CONTAINER" --format 'kontener={{.Name}} obraz={{.Config.Image}} start={{.State.StartedAt}}'
$PSQL -c "SELECT 'serwer', version();"
$PSQL -c "SELECT 'baza', current_database();"

echo
echo "=== B. stan created_at w schemacie public (cała kopia) ==="
$PSQL -c "
SELECT 'tabele_publiczne_razem', count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'
UNION ALL SELECT 'created_at_typu_text', count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name='created_at' AND data_type='text'
UNION ALL SELECT 'created_at_timestamp', count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name='created_at' AND data_type LIKE 'timestamp%'
UNION ALL SELECT 'tabele_bez_created_at', (SELECT count(*) FROM information_schema.tables t WHERE t.table_schema='public' AND t.table_type='BASE TABLE' AND NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=t.table_name AND c.column_name='created_at'));"

echo
echo "=== C. filtr etapu 1: bez FK (w żadną stronę) i bez triggerów ==="
$PSQL -c "
CREATE SCHEMA IF NOT EXISTS qd16_probe;
CREATE OR REPLACE FUNCTION qd16_probe.safe_tstz(v text) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS \$\$
BEGIN IF v IS NULL THEN RETURN NULL; END IF; RETURN v::timestamptz; EXCEPTION WHEN OTHERS THEN RETURN NULL; END \$\$;
CREATE TABLE IF NOT EXISTS qd16_probe.wyniki(tabela text PRIMARY KEY, wiersze bigint, nulle bigint, niepasujace bigint, probki text);
WITH txt AS (SELECT table_name AS t FROM information_schema.columns WHERE table_schema='public' AND column_name='created_at' AND data_type='text'),
fk AS (SELECT DISTINCT conrelid::regclass::text AS t FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace
       UNION SELECT DISTINCT confrelid::regclass::text FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace),
trg AS (SELECT DISTINCT c.relname AS t FROM pg_trigger tg JOIN pg_class c ON c.oid=tg.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT tg.tgisinternal)
SELECT 'created_at_text_razem', count(*) FROM txt
UNION ALL SELECT 'z_fk_odrzucone', count(*) FROM txt WHERE t IN (SELECT t FROM fk)
UNION ALL SELECT 'z_triggerem_odrzucone', count(*) FROM txt WHERE t IN (SELECT t FROM trg)
UNION ALL SELECT 'pula_etap1_bez_fk_bez_trg', count(*) FROM txt WHERE t NOT IN (SELECT t FROM fk) AND t NOT IN (SELECT t FROM trg);"

echo
echo "=== D. MUTACJA PRZYRZĄDU (safe_tstz musi odrzucać śmieci, przyjmować ISO) ==="
$PSQL -c "SELECT 'odrzucił_nie-datę', qd16_probe.safe_tstz('to-nie-data') IS NULL,
                 'odrzucił_pusty', qd16_probe.safe_tstz('') IS NULL,
                 'odrzucił_epoch_jako_text', qd16_probe.safe_tstz('1726000000') IS NULL,
                 'przyjął_ISO_Z', qd16_probe.safe_tstz('2026-09-19T04:00:00.000Z') IS NOT NULL,
                 'przyjął_kanoniczny', qd16_probe.safe_tstz('2026-09-19 04:00:00.123456+00') IS NOT NULL;"
$PSQL -c "SELECT 'pg_input_is_valid_odrzuca_śmieci', NOT pg_input_is_valid('to-nie-data','timestamptz'), NOT pg_input_is_valid('','timestamptz'), pg_input_is_valid('2026-09-19T04:00:00.000Z','timestamptz');"

echo
echo "=== E. wartości niepasujące w całej puli 152 (0 albo lista — nigdy cichy NULL) ==="
$PSQL -v ON_ERROR_STOP=1 -c "
DO \$\$
DECLARE r record; n bigint; nu bigint; bad bigint; s text;
BEGIN
  FOR r IN
    WITH txt AS (SELECT table_name AS t FROM information_schema.columns WHERE table_schema='public' AND column_name='created_at' AND data_type='text'),
    fk AS (SELECT DISTINCT conrelid::regclass::text AS t FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace
           UNION SELECT DISTINCT confrelid::regclass::text FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace),
    trg AS (SELECT DISTINCT c.relname AS t FROM pg_trigger tg JOIN pg_class c ON c.oid=tg.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT tg.tgisinternal)
    SELECT t FROM txt WHERE t NOT IN (SELECT t FROM fk) AND t NOT IN (SELECT t FROM trg) ORDER BY t
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', r.t) INTO n;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE created_at IS NULL', r.t) INTO nu;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE created_at IS NOT NULL AND NOT pg_input_is_valid(created_at, %L)', r.t, 'timestamptz') INTO bad;
    IF bad > 0 THEN
      EXECUTE format('SELECT string_agg(DISTINCT left(created_at,60), '' | '') FROM (SELECT created_at FROM public.%I WHERE created_at IS NOT NULL AND NOT pg_input_is_valid(created_at, %L) LIMIT 10) x', r.t, 'timestamptz') INTO s;
    ELSE s := ''; END IF;
    INSERT INTO qd16_probe.wyniki VALUES (r.t,n,nu,bad,s) ON CONFLICT (tabela) DO UPDATE SET wiersze=n,nulle=nu,niepasujace=bad,probki=s;
  END LOOP;
END \$\$;"
$PSQL -c "SELECT 'pula_zmierzona', count(*) FROM qd16_probe.wyniki;"
$PSQL -c "SELECT 'tabel_z_wartosciami_niepasujacymi', count(*) FROM qd16_probe.wyniki WHERE niepasujace>0;"
$PSQL -c "SELECT 'wierszy_niepasujacych_razem', coalesce(sum(niepasujace),0) FROM qd16_probe.wyniki;"
$PSQL -c "SELECT 'tabel_pustych_w_puli', count(*) FROM qd16_probe.wyniki WHERE wiersze=0;"

echo
echo "=== F. ograniczenia, które mogłyby zablokować ALTER TYPE (pula 152) ==="
$PSQL -c "SELECT 'pk_lub_unique_na_created_at', count(*) FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey) JOIN qd16_probe.wyniki w ON w.tabela=i.indrelid::regclass::text WHERE a.attname='created_at' AND (i.indisprimary OR i.indisunique);"
$PSQL -c "SELECT 'check_z_created_at', count(*) FROM pg_constraint c JOIN qd16_probe.wyniki w ON w.tabela=c.conrelid::regclass::text WHERE c.contype='c' AND pg_get_constraintdef(c.oid) ILIKE '%created_at%';"
$PSQL -c "SELECT 'tabele_partycjonowane', count(*) FROM pg_class c JOIN qd16_probe.wyniki w ON w.tabela=c.relname JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='p';"
$PSQL -c "SELECT 'kolumny_generowane', count(*) FROM information_schema.columns c JOIN qd16_probe.wyniki w ON w.tabela=c.table_name WHERE c.table_schema='public' AND c.column_name='created_at' AND c.is_generated='ALWAYS';"
$PSQL -c "SELECT 'widoki_zalezne_od_tych_tabel', count(DISTINCT c.relname) FROM pg_depend d JOIN pg_rewrite r ON r.oid=d.objid JOIN pg_class c ON c.oid=r.ev_class WHERE d.classid='pg_class'::regclass AND d.refobjid IN (SELECT tabela::regclass FROM qd16_probe.wyniki) AND c.relkind IN ('v','m');"
$PSQL -c "SELECT 'indeksow_na_created_at', count(*) FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey) JOIN qd16_probe.wyniki w ON w.tabela=i.indrelid::regclass::text WHERE a.attname='created_at';"
$PSQL -c "SELECT 'created_at_NOT_NULL', count(*) FROM information_schema.columns c JOIN qd16_probe.wyniki w ON w.tabela=c.table_name WHERE c.table_schema='public' AND c.column_name='created_at' AND c.is_nullable='NO';"
echo '--- rozkład wartości DEFAULT created_at w puli ---'
$PSQL -c "SELECT coalesce(c.column_default,'(brak)') AS domyslna, count(*) FROM qd16_probe.wyniki w JOIN information_schema.columns c ON c.table_schema='public' AND c.table_name=w.tabela AND c.column_name='created_at' GROUP BY 1 ORDER BY 2 DESC;"

echo
echo "=== G. 26 tabel wytypowanych do etapu 1: kształt wartości i wierność round-trip ==="
$PSQL -v ON_ERROR_STOP=1 -c "
CREATE TABLE IF NOT EXISTS qd16_probe.etap1(tabela text PRIMARY KEY, wiersze bigint, nulle bigint, niecastowalne bigint, iso_z bigint, kanoniczny bigint, inny bigint, probka_iso text, probka_kan text, probka_inny text);
DO \$\$
DECLARE r record; n bigint; nu bigint; bad bigint; iz bigint; kn bigint; in_ bigint; pi text; pk text; pn text;
BEGIN
  FOR r IN SELECT tabela AS t FROM qd16_probe.wyniki WHERE tabela IN (
    'wave6_context_ledger','wave6_context_snapshots','notification_dedup','wave5_artifact_versions','research_session_events',
    'meeting_participants','work_canvas_proposals','research_sessions','wave7_connectors','research_evidence_graph',
    'research_report_artifacts','wave6_memory_candidates','ai_deep_thinking_confirms','wave8_agent_notifications','wave8_agent_runs',
    'document_share_links','wave6_memory_stewardship_decisions','deck_comments','wave9_evidence_registry','usage_pricing_tiers',
    'plan_baselines','v8_promotion_gates','meeting_decisions','billing_webhook_events','decision_escalation_templates','tax_rates') ORDER BY 1
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', r.t) INTO n;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE created_at IS NULL', r.t) INTO nu;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE created_at IS NOT NULL AND NOT pg_input_is_valid(created_at, %L)', r.t, 'timestamptz') INTO bad;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE created_at ~ %L', r.t, '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$') INTO iz;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE created_at ~ %L', r.t, '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+\+00$') INTO kn;
    in_ := n - nu - iz - kn;
    EXECUTE format('SELECT min(created_at) FROM public.%I WHERE created_at ~ %L', r.t, '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$') INTO pi;
    EXECUTE format('SELECT min(created_at) FROM public.%I WHERE created_at ~ %L', r.t, '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+\+00$') INTO pk;
    EXECUTE format('SELECT min(created_at) FROM public.%I WHERE created_at IS NOT NULL AND created_at !~ %L AND created_at !~ %L', r.t, '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$', '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+\+00$') INTO pn;
    INSERT INTO qd16_probe.etap1 VALUES (r.t,n,nu,bad,iz,kn,in_,coalesce(pi,''),coalesce(pk,''),coalesce(pn,''))
      ON CONFLICT (tabela) DO UPDATE SET wiersze=n,nulle=nu,niecastowalne=bad,iso_z=iz,kanoniczny=kn,inny=in_,probka_iso=coalesce(pi,''),probka_kan=coalesce(pk,''),probka_inny=coalesce(pn,'');
  END LOOP;
END \$\$;"
$PSQL -c "SET TIME ZONE 'UTC'; SELECT tabela||' | wiersze='||wiersze||' | nulle='||nulle||' | niecastowalne='||niecastowalne||' | ISO-Z='||iso_z||' | kanoniczny='||kanoniczny||' | inny='||inny||' | próbka='||coalesce(nullif(probka_iso,''),nullif(probka_kan,''),nullif(probka_inny,''),'-') FROM qd16_probe.etap1 ORDER BY wiersze DESC, tabela;"

echo
echo "=== H. wierność round-trip (czy .down.sql odda tekst bajt w bajt) ==="
$PSQL -v ON_ERROR_STOP=1 -c "SET TIME ZONE 'UTC';
CREATE TABLE IF NOT EXISTS qd16_probe.roundtrip(tabela text PRIMARY KEY, ksztalt text, wiersze bigint, diff_kanon bigint, diff_iso bigint);
DO \$\$
DECLARE r record; n bigint; dk bigint; di bigint; k text;
BEGIN
  FOR r IN SELECT tabela AS t, iso_z, kanoniczny FROM qd16_probe.etap1 WHERE tabela <> 'plan_baselines' ORDER BY 1
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', r.t) INTO n;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE created_at IS NOT NULL AND created_at::timestamptz::text <> created_at', r.t) INTO dk;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE created_at IS NOT NULL AND to_char(created_at::timestamptz AT TIME ZONE %L, %L) <> created_at', r.t, 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') INTO di;
    IF r.iso_z > 0 THEN k := 'ISO-Z'; ELSIF r.kanoniczny > 0 THEN k := 'KANON'; ELSE k := 'PUSTA'; END IF;
    INSERT INTO qd16_probe.roundtrip VALUES (r.t,k,n,dk,di) ON CONFLICT (tabela) DO UPDATE SET ksztalt=k,wiersze=n,diff_kanon=dk,diff_iso=di;
  END LOOP;
END \$\$;"
$PSQL -c "SET TIME ZONE 'UTC'; SELECT ksztalt||' | tabel='||count(*)||' | wierszy='||sum(wiersze)||' | diff_dla_kanoniczny='||sum(diff_kanon)||' | diff_dla_ISO='||sum(diff_iso) FROM qd16_probe.roundtrip GROUP BY ksztalt ORDER BY ksztalt;"
echo '--- tabele, dla których żadna z dwóch form nie jest bajtowo wierna ---'
$PSQL -c "SET TIME ZONE 'UTC'; SELECT tabela||' ksztalt='||ksztalt||' diff_kanon='||diff_kanon||' diff_iso='||diff_iso FROM qd16_probe.roundtrip WHERE (ksztalt='ISO-Z' AND diff_iso>0) OR (ksztalt='KANON' AND diff_kanon>0);"

echo
echo "=== I. dlaczego plan_baselines wypada z etapu 1 ==="
$PSQL -c "SET TIME ZONE 'UTC'; SELECT id||' | '''||created_at||''' | długość='||length(created_at) FROM plan_baselines ORDER BY created_at;"
