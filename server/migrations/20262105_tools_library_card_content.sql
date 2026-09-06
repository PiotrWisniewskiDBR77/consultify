-- DEC-439: add the four Karta N library sections without replacing any
-- existing catalogue content. Replaying this migration is a no-op for keys
-- already supplied by a catalogue owner.
UPDATE tools
SET library_content_translations = (
  SELECT jsonb_object_agg(locale, locale_content) :: text
  FROM (
    SELECT locale,
           jsonb_set(
             locale_content,
             '{card}',
             COALESCE(locale_content->'card', '{}'::jsonb) ||
             jsonb_strip_nulls(jsonb_build_object(
               'goal', COALESCE(locale_content->'card'->'goal', locale_content->'whenToUse'),
               'process', COALESCE(locale_content->'card'->'process', locale_content->'steps'),
               'outcome', COALESCE(locale_content->'card'->'outcome', locale_content->'outputs'),
               'example', COALESCE(locale_content->'card'->'example', locale_content->'example')
             )),
             true
           ) AS locale_content
    FROM jsonb_each(
      CASE
        WHEN library_content_translations IS NULL OR btrim(library_content_translations) = '' THEN '{}'::jsonb
        ELSE library_content_translations::jsonb
      END
    ) AS localized(locale, locale_content)
    WHERE jsonb_typeof(locale_content) = 'object'
  ) AS rebuilt
)
WHERE tool_type IS NOT NULL
  AND library_content_translations IS NOT NULL
  AND btrim(library_content_translations) <> '';
