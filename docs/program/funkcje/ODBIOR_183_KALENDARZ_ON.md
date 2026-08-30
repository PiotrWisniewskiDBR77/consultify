---
doc_id: funkcje-odbior-183
status: canonical
truth_type: acceptance
established: 2026-08-31
---

# ODBIÓR 183 — kalendarz ON · FLIP WSTRZYMANY do FIX-183 (wydany)

R1 (przyczyna rewertu 25.08) — **A**: rewert był zbiorczy dla 2 flag, techniczna
regresja P0 dotyczyła `ff_ideaInspectorRightRail`, kalendarz miał osobny ACCEPT
(DEC-70) — zweryfikowane SHA po SHA. Dowody odtworzone niezależnie (15/16 unit,
15/15 realPG, mutacja flag-default czerwona→zielona). Dwa STOP-y po drodze
(port adb, dysk) — oba zasadne, format wzorowy. Oceny: proces **A** · raport **B**
· stan produktu **D** · reguła 7 **A**.

## Bloker (wykryty przez WYKONAWCĘ na własnym zrzucie — tak ma działać program)
`includeOwnEvents` — sedno CalendarV2 — nie działa: utworzone wydarzenie jest
w bazie, ale po pełnym reloadzie znika z ekranu. Łańcuch (zweryfikowany przez
odbiór linia po linii): `CalendarView.tsx:125` dokłada `'event'` do
`additionalSources`, choć `ALL_SOURCES` już je ma → duplikat → warunek
`sources.length < ALL_SOURCES.length` fałszywy → `sources: undefined` →
`api.ts:12542` omija trasę legacy i idzie do V8, który nie zna źródła `'event'`.

## FIX-183 (wydany): jednoliniowa deduplikacja + test „own event survives full
reload" (realny PG) + komplet 4 zrzutów (pusty/pełny × jasny/ciemny). Po FIX:
merge CAŁEJ gałęzi z flipem (D-6 wykonane).

## Sprostowanie do wiedzy programu
`ff_ideaInspectorRightRail` jest **domyślnie ON od 26.08** (commit `1e8bd6b7f4`,
DEC-90 OWNER_ACCEPT) — instrukcja 183 opisywała ją jako OFF-do-przeprojektowania.
Nieaktualność po stronie autora instrukcji; raport dyżuru tego nie zgłosił (minus B).
