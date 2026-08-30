---
doc_id: funkcje-odbior-170
status: canonical
truth_type: acceptance
established: 2026-08-30
---

# ODBIÓR 170 — okna check-inu OKR · WERDYKT: NIE SCALAĆ (naprawa wydana)

Gałąź `codex/day170-okna-checkin-20260830`, HEAD `89fd32e413`, 4 commity nad `514c60b355`.
Odbiór adwersaryjny: niezależny kontener (port 6072), migracje 869, dowód mutacyjny
odtworzony samodzielnie (mutacja JOIN → 2/2 FAIL; przywrócenie → 2/2 PASS).

## Oceny

| Część | Ocena | Powód |
|---|---|---|
| Mechanika (GET + repozytorium) | **B** | realny Gateway+PG, 404 cross-org udowodnione niezależnie; ALE daty błędne o dobę poza UTC |
| UI (picker) | **C** | łańcuch renderowania istnieje (App→AppRoutes:3080→ResultsOkrRegistryPage→OkrCheckInsView:213), ale za flagą `okrRegistry` domyślnie OFF i NIKT nie widział ekranu; render pokazałby złe daty |
| Dowody | **C** | pakiet nieprzenośny (pin bazy `cx170:5432` — test u audytora: `2 skipped`), commit `226b5aaae4` BEZ asercji (test-tautologia), B2 niepokryta literalnie |

## Trzy wady zmierzone (żadnej nie było w raporcie wykonawcy)

1. ★ **Data przesunięta o dobę poza UTC** — `okrCheckInOccurrenceRepository.ts:21-23`
   `toISOString().slice(0,10)` na lokalnej północy z pg. Zmierzone: DB `2026-08-01` →
   API `2026-07-31` (Europe/Warsaw). Commit „preserve date-only semantics" **wprowadza
   błąd, który miał naprawić**. Na Railway (UTC) niewidoczny; u właściciela widoczny.
2. ★ **`226b5aaae4` bez żadnego testu** — cofnięcie całego pliku do `65387f718d`: test
   dyżuru nadal 2/2 PASS. Obie połowy commita niezasercjonowane.
3. ★ **Pin bazy wykonawcy (klasa Z31)** — `day170…test.ts:46` `{database:'cx170',port:5432}`
   → u każdego innego `2 skipped` zamiast czerwieni; plus zakodowana ścieżka artefaktów
   (`:17,53`) rzuca ENOENT poza maszyną wykonawcy.

Drobne: `.catch(()=>setOccurrences([]))` — awaria przebrana za pustkę
(`OkrCheckInsView.tsx:112`); okna przeterminowane wybieralne bez oznaczenia; asercja
env `DB_TYPE` tautologiczna. Licencja plikowa: **czysta** (7/7 plików z tabeli).
Raport wykonawcy uczciwy w trudnych miejscach (sam przyznaje brak przebiegu klikowego).

## Naprawa wydana wewnętrznemu robotnikowi (FIX-170, na gałęzi dyżuru)

1. `::text` w SQL zamiast `toISOString()` + asercja dat z `::text` z bazy (mutacyjnie w obie strony)
2. zdjąć pin bazy z linii 46; 3. odpiąć ścieżkę artefaktów; 4. literalny przypadek B2
(cudzy KR → 404); 5. asercja `isCurrent` dla okna przeterminowanego; 6. rozróżnić błąd
pobrania od pustej listy.

**Bramka B1 (właścicielska) zostaje otwarta** do zrzutu ekranu z `?ff_resultsVNextOkr=1`
(reguła 7 — Piotr nie jest pierwszym testerem). Po FIX: mechanika → A, scalenie.
Uwaga na demo: `VITE_DEMO_ACCEPTANCE` (DEC-2026-08-28-216) włącza WSZYSTKIE flagi vnext
— ekran na demo prawdopodobnie ON, więc naprawa daty jest warunkiem twardym.
