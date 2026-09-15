# M3 — kategorie szablonów Wywiadu — projekt migracji / STOP

Werdykt: **STOP PRZED MIGRACJĄ**. Model miesza temat szablonu z jego długością; projekt poniżej wymaga zgody CTO przed utworzeniem migracji lub zmian zależnych w kodzie.

## Pomiar na bazie `dcbd6c052a15f6ef65a6ec698bb0cbda4a7902fe`

`interview_library_templates.category` jest polem tematycznym. Pierwotny kontrakt opisuje wartości takie jak `DIGITAL`, `OPERATIONAL`, `COST`, `DATA` i `QUICK` (`server/migrations/297_interview_library_templates.sql`). Osobne pole formatu nie istnieje ani w schemacie, ani w odpowiedzi API.

Seed `server/migrations/20260720_seed_v6_interview_library_templates.sql` tworzy dokładnie 18 globalnych szablonów V6 (`organization_id IS NULL`, `template_scope = 'system'`, `created_by = 'system'`) i zapisuje w `category` długość wywiadu:

| Obecna wartość `category` | Liczba | Znaczenie |
| --- | ---: | --- |
| `Pulse` | 2 | format / długość |
| `Standard` | 15 | format / długość |
| `Deep Dive` | 1 | format / długość |
| **Razem** | **18** | wszystkie globalne szablony V6 |

Frontend obniża wartość `category` do małych liter i przekazuje ją do `normalizeTemplateCategory()`. Słownik nie zna `pulse`, `standard` ani `deep dive`, więc wszystkie 18 rekordów renderuje jako `Other category` / `Inna kategoria`.

## Docelowe mapowanie 18 rekordów

Temat jest wyprowadzany deterministycznie z nazwy i `area_tags`. Kolejność reguł ma znaczenie: precyzyjne nazwy (`Cost`, `Data`) i obszary komercyjne są sprawdzane przed szerszymi tagami `finance` lub `operations`.

| Docelowa kategoria | Liczba | Szablony |
| --- | ---: | --- |
| `strategy` | 4 | T01 Quick Company Snapshot; T02 Leadership Alignment Pulse; T03 Strategic Direction Discovery; T04 Operating Model Fit |
| `operations` | 4 | T05 Operational Excellence Discovery; T06 Process Pain Mapping; T07 Manufacturing Walkthrough; T18 Quality, Compliance & Risk |
| `digital` | 2 | T08 Digital Landscape Discovery; T09 Automation Readiness |
| `data` | 1 | T10 Data & Reporting Maturity |
| `finance` | 2 | T11 Finance Baseline; T13 Working Capital & Cash |
| `cost` | 1 | T12 Cost & Efficiency Review |
| `commercial` | 2 | T14 Customer Experience Discovery; T15 Commercial Pipeline & Forecast |
| `people` | 2 | T16 Organization & Roles Clarity; T17 Change Readiness |
| **Razem** | **18** | 8 rzeczywistych klas tematycznych |

Format zostaje zachowany osobno jako `pulse`, `standard` lub `deep_dive`.

## Projekt `20260915_interview_templates_category.sql`

To jest projekt do akceptacji, a nie utworzony plik migracji.

```sql
BEGIN;

ALTER TABLE interview_library_templates
  ADD COLUMN IF NOT EXISTS format TEXT;

DO $$
DECLARE
  target_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO target_count
  FROM interview_library_templates
  WHERE id LIKE 'v6_t%'
    AND organization_id IS NULL
    AND template_scope = 'system'
    AND created_by = 'system';

  IF target_count <> 18 THEN
    RAISE EXCEPTION
      'M3 expected exactly 18 global V6 interview templates, found %',
      target_count;
  END IF;
END $$;

UPDATE interview_library_templates
SET format = COALESCE(
      NULLIF(format, ''),
      CASE LOWER(TRIM(category))
        WHEN 'pulse' THEN 'pulse'
        WHEN 'standard' THEN 'standard'
        WHEN 'deep dive' THEN 'deep_dive'
        WHEN 'deep_dive' THEN 'deep_dive'
        ELSE NULL
      END
    )
WHERE id LIKE 'v6_t%'
  AND organization_id IS NULL
  AND template_scope = 'system'
  AND created_by = 'system';

DO $$
DECLARE
  unmapped_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unmapped_count
  FROM interview_library_templates
  WHERE id LIKE 'v6_t%'
    AND organization_id IS NULL
    AND template_scope = 'system'
    AND created_by = 'system'
    AND format NOT IN ('pulse', 'standard', 'deep_dive');

  IF unmapped_count <> 0 THEN
    RAISE EXCEPTION
      'M3 could not preserve format for % global V6 interview templates',
      unmapped_count;
  END IF;
END $$;

UPDATE interview_library_templates
SET category = CASE
  WHEN LOWER(name) LIKE '%cost%efficiency%' THEN 'cost'
  WHEN LOWER(name) LIKE '%data%reporting%' OR LOWER(COALESCE(area_tags, '')) LIKE '%"data"%' THEN 'data'
  WHEN LOWER(name) LIKE '%commercial%' OR LOWER(COALESCE(area_tags, '')) LIKE '%"sales"%' OR LOWER(COALESCE(area_tags, '')) LIKE '%"customer-service"%' THEN 'commercial'
  WHEN LOWER(COALESCE(area_tags, '')) LIKE '%"digital"%' OR LOWER(COALESCE(area_tags, '')) LIKE '%"it"%' THEN 'digital'
  WHEN LOWER(COALESCE(area_tags, '')) LIKE '%"finance"%' OR LOWER(COALESCE(area_tags, '')) LIKE '%"procurement"%' THEN 'finance'
  WHEN LOWER(name) LIKE '%leadership alignment%' THEN 'strategy'
  WHEN LOWER(COALESCE(area_tags, '')) LIKE '%"people"%' OR LOWER(COALESCE(area_tags, '')) LIKE '%"hr"%' THEN 'people'
  WHEN LOWER(COALESCE(area_tags, '')) LIKE '%"strategy"%' THEN 'strategy'
  WHEN LOWER(COALESCE(area_tags, '')) LIKE '%"operations"%' OR LOWER(COALESCE(area_tags, '')) LIKE '%"compliance"%' OR LOWER(COALESCE(area_tags, '')) LIKE '%"risk"%' THEN 'operations'
  ELSE 'general'
END
WHERE id LIKE 'v6_t%'
  AND organization_id IS NULL
  AND template_scope = 'system'
  AND created_by = 'system';

DO $$
DECLARE
  distribution JSONB;
BEGIN
  SELECT jsonb_object_agg(category, amount)
  INTO distribution
  FROM (
    SELECT category, COUNT(*)::INTEGER AS amount
    FROM interview_library_templates
    WHERE id LIKE 'v6_t%'
      AND organization_id IS NULL
      AND template_scope = 'system'
      AND created_by = 'system'
    GROUP BY category
  ) measured;

  IF distribution <> '{"commercial":2,"cost":1,"data":1,"digital":2,"finance":2,"operations":4,"people":2,"strategy":4}'::jsonb THEN
    RAISE EXCEPTION 'M3 unexpected category distribution: %', distribution;
  END IF;
END $$;

COMMIT;
```

## Projekt rollbacku

Rollback przywraca dokładne trzy wartości formatu w `category`, czyści nowe dane dla 18 rekordów i pozostawia addytywną, nullable kolumnę. Nie usuwa kolumny, dzięki czemu nie niszczy danych ewentualnych rekordów utworzonych później.

```sql
BEGIN;

UPDATE interview_library_templates
SET category = CASE format
      WHEN 'pulse' THEN 'Pulse'
      WHEN 'standard' THEN 'Standard'
      WHEN 'deep_dive' THEN 'Deep Dive'
      ELSE category
    END,
    format = NULL
WHERE id LIKE 'v6_t%'
  AND organization_id IS NULL
  AND template_scope = 'system'
  AND created_by = 'system';

COMMIT;
```

## Puste `AI SCORE` i `ESCALATION`

Puste komórki są stanem procesu, a nie brakującymi kolumnami szablonu:

- `AI SCORE` pochodzi z `interview_assignments.ai_review_snapshot_json`. Kontroler oblicza i zapisuje wynik podczas wysłania odpowiedzi. Przed wysłaniem, przy braku pytań lub gdy best-effort ocena AI nie zakończy się wynikiem, wartość pozostaje pusta. Docelowy tooltip EN: `Available after the respondent submits the interview and AI quality review completes.` PL: `Dostępna po wysłaniu wywiadu przez respondenta i zakończeniu oceny jakości AI.`
- `ESCALATION` pochodzi z `interview_assignments.escalated_at`. Ustawia ją ręczna akcja przełożonego albo cykliczny przebieg dla zaległego przydziału. Pusta wartość znaczy, że eskalacja nie została uruchomiona. Docelowy tooltip EN: `No escalation has been triggered.` PL: `Eskalacja nie została uruchomiona.`

## Zmiany zależne po GO CTO

1. Utworzyć zaakceptowaną migrację oraz rollback w `server/migrations/rollback/`.
2. Dodać `format` do ensure-schema, odpowiedzi API, typów frontu i ścieżek create/update/duplicate bez zmiany istniejącego kontraktu `category`.
3. Rozdzielić w Template Builderze temat od formatu; wartości formatu: `pulse`, `standard`, `deep_dive`.
4. Renderować w tabelach realną kategorię, a `format` pokazywać jako osobną informację tam, gdzie użytkownik wybiera długość wywiadu.
5. Dodać tooltipy do pustych komórek `AI SCORE` i `ESCALATION` w Przydzielonych.
6. Dowód po implementacji: RealPG przed/po/rollback/idempotency, 18/18 kategorii, 18/18 formatów, API readback, testy EN/PL i zrzuty obu locale.

Do chwili GO CTO nie powstał żaden plik migracji ani zmiana produktu zależna od nowej kolumny.
