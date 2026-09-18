# KROK 0 — DOC-0 / U-44 (documents-list hygiene, S, front-only)

Zmierzone PRZED budową (plik:linia), 2026-09-18:

1. **Nagłówek „PRESENTATION" na liście DOKUMENTÓW.**
   - Przyczyna: `public/locales/en/translation.json` → `rap.columns.title` miał wartość `"Presentation"`.
     Klucz jest WSPÓLNY: etykieta kolumny tytułu w `OutputsAggregateTabContent.tsx:453`
     (`label: t('rap.columns.title', 'Title')`) i w `PresentationsTabContent.tsx:138`.
     Wartość JSON nadpisywała poprawny fallback `'Title'`.
   - Skutek uboczny znaleziony przy okazji: `PresentationsTabContent.tsx:514` używał TEGO SAMEGO klucza
     jako fallbacku tytułu podglądu bez nazwy (`previewItem.title || t('rap.columns.title', 'Presentation')`)
     → po naprawie klucza podgląd pokazałby „Title". Rozdzielono: nowy klucz `rap.preview.untitledPresentation`.
2. **Kolumna SOURCE „—" wszędzie.**
   - Przyczyna strukturalna: `useRapData.ts` — gałąź `kind: 'document'` (mapowanie rejestru) NIE przenosiła
     `sourceType`, podczas gdy gałąź prezentacji (`runtime === 'presentation'`) przenosi (`sourceType: p.sourceType`).
     `formatSourceSummary` (`OutputsAggregateTabContent.tsx:156-160`) buduje tekst z `row.sourceType`;
     bez niego `parts` puste → „—".
   - Naprawa: (a) `useRapData.ts` gałąź dokumentu dodaje `sourceType: r.sourceType`;
     (b) surowe kody runtime (`native_artifact`) mapowane na nazwy produktu przez
     `SOURCE_RUNTIME_LABEL_KEYS` (`OutputsAggregateTabContent.tsx:111-115`) — wzorzec istniejących map
     `VISIBILITY_LABEL_KEYS`/`REVIEW_STATE_LABEL_KEYS`; fallback `formatLabel` dla wartości spoza mapy
     (prezentacje `tool|assessment|finance|upload` bez zmian).
3. **Kolumna REVIEW „—"** — NIE defekt frontu: `publishState` nieobecny dla szkiców (dane), nie kod.
   Jedno zdanie w meldunku, zero zmiany serwera (DEC-607 + Wpis 125 uwaga 2).

Znalezisko POZA zleceniem (DEC-607, jedno zdanie, zero naprawy): `rap.outputs.columns.source` w EN ma
wartość małymi literami `"source"` podczas gdy rodzeństwo (`Review/Visibility/Type/Exports/Format`) jest
kapitalizowane → nagłówek kolumny SOURCE renderuje się małymi literami.

Zrzuty: `doc0-u44-list-en-{light,dark}-1440x900.png` (harness `doc0-document-flow.html?case=list`,
realny `ReportsAndPresentationsHub`), `bledyKonsoli=0`, kontrast nagłówka TITLE 4.56 (light) / 7.45 (dark).
