# F8b — Template Library, English first (DEC-461)

Row-level proof for `server/migrations/20260915_template_library_en_first.sql`.

`fixture-cards-before.sql` inserts, verbatim, the 22 Polish card titles read off
the trade-show screenshot `cto-codex/final-targi-20260915/zrzuty/
47-materials-templates-fin` into a throwaway PostgreSQL database shaped like the
Library read path (`v8_output_artifacts` + the four source registries).

`cards-after-migration.txt` is what the same rows hold after the migration runs:
22 of 22 converted, `grep -cP "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]"` = 0. A second run of the
migration updates 0 rows.

What this is NOT: a screenshot of the running product. The migration has not
been applied to staging or demo — the Library will keep rendering Polish until
it is deployed and runs there, because the card title is a snapshot column
(`title_snapshot`), not a live join. Visual acceptance belongs after that deploy.
