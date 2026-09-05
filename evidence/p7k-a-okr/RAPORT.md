# P7K część A — OKR: trzy poziomy w kodzie produkcyjnym

Gałąź `wyniki/p7k-a-okr` (baza `origin/staging` @ `59e282df88`).
Data: 2026-09-05, wieczór/noc.

## 1. Co powstało

| Poziom | Adres | Ekran | Plik |
| --- | --- | --- | --- |
| 1 | `/results/okr` | Tabela raportów OKR | `src/components/ResultsVNext/okr/p7k/OkrReportRegistryPage.tsx` |
| 2 | `/results/okr/:setId` | Raport OKR (rezultaty, TEMAT → CEL) | `src/components/ResultsVNext/okr/p7k/OkrReportPage.tsx` |
| 3 | `/results/okr/:setId/objectives/:objectiveId` | Karta celu (rezultaty jako sekcja) | `src/components/ResultsVNext/okr/OkrObjectiveCardPage.tsx` |

Poziom 4 (zbiór kart KR + karta KR) **usunięty**: `OkrKeyResultSetPage.tsx` i
`OkrKeyResultCardPage.tsx` skasowane, ich trasy zamienione na przekierowanie
(`p7k/OkrKeyResultRedirect.tsx`) na kartę celu otwartą na sekcji „Kluczowe
rezultaty” z podświetleniem rezultatu (`?sekcja=…&rezultat=…`).

Powłoka: `ResultsVNextRegistryShell` (StandardModuleBar + StandardTable +
StandardPreview) na poziomach 1–2, `NModeShell` + `ArtifactRightPanel` na
poziomie 3. Zero nowych komponentów tabel/menu/preview/kart.

## 2. Serwer

- Migracja **addytywna** `server/migrations/20262102_okr_p7k_report_fields.sql`:
  `okr_vnext_sets.description`, `.report_goal`; `okr_vnext_objectives.theme`;
  `okr_vnext_key_results.team_name`, `.deadline`. Wszystkie NULLable, bez
  backfillu, bez zmiany istniejących wierszy.
- Nowy read model `okrReportRepository.ts` + dwie trasy GET
  (`/report-summaries`, `/sets/:setId/checkin-summaries`) — agregaty raportów i
  daty check-inów **jednym zapytaniem**, zamiast N+1 na wiersz. ABAC na
  widoczności zestawu (`resource_type='okr_set'`, obowiązkowy `::text`).
- Naprawa porządku: `ORDER BY created_at` / `sort_order` nie były porządkiem
  całkowitym (seed daje identyczne znaczniki czasu) — bloki rezultatów
  tańczyły między odświeżeniami; dołożony rozstrzygający identyfikator.
- `server/scripts/seed-wyniki-okr-p7k.ts` — uzupełnia nowe pola dla danych
  pokazowych DBR77 (addytywnie, tylko `NULL`, idempotentnie, z `--rollback`).

## 3. Dowody na ŻYWYM ekranie

Środowisko: jednorazowy Postgres 17 + pgvector (kontener `okr-p7ka-pg`),
pełne migracje od zera (`migrate.postgres.ts`, przechodzą w całości), seed
`seed-wyniki-dbr77.ts --apply` (3 zestawy, 10 celów, 28 rezultatów, 28
check-inów) + `seed-wyniki-okr-p7k.ts --apply`, backend `tsx src/index.ts` na
:3097, własny vite na :3072. **To nie jest staging** — nowe trasy i migracja
nie są tam wdrożone, więc zrzut ze stagingu pokazałby stan błędu, nie pracę.

| Zrzut | Co pokazuje | `bledyKonsoli` | `aside` |
| --- | --- | --- | --- |
| `okr-l1--light.png` | tabela raportów: NAZWA · ZAKRES · CYKL · CELE · REZULTATY · STAN (kropki) · WŁAŚCICIELE · OSTATNI CHECK-IN | 0 | 0 |
| `okr-l2--light.png` | raport: wiersze grup TEMAT z właścicielem nadrzędnym, rezultaty z właścicielem/wartościami/postępem/pewnością/terminem/stanem, Menu 3 (4 chipy + filtr właściciela), „Dodaj cel”, podsumowanie | 0 | 0 |
| `okr-l3--light.png` | karta celu: 5 sekcji (Cel · Kluczowe rezultaty · Check-iny · Powiązania · Refleksja), bloki KR z lewą kreską stanu i przyciskiem „Check-in”, prawy panel accordion | 0 | 1 |
| `okr-l3-checkin--light.png` | otwarte okno check-inu na bloku rezultatu (sugestia serwera, okna, notatka) | 0 | — |
| `okr-l3-po-checkinie--dark.png` | ten sam ekran PO zapisaniu check-inu, motyw ciemny | 0 | 1 |
| `okr-przekierowanie-rezultaty--light.png` | wejście na stary adres `.../rezultaty/<kr>` → karta celu z podświetlonym rezultatem | 0 | 1 |

Pomiary z `.json`: zero UUID w tekście ekranu, zero błędów konsoli, `aside ≤ 1`.
Para jasny/ciemny poziomu 3: średnia jasność **243,8 vs 30,3** (różnica 213 ≥
100 — to nie jest ten sam obraz pod dwiema nazwami).

**Check-in zapisuje NAPRAWDĘ** (przeklikane, nie zadeklarowane):
`POST /api/vnext/results/okr/key-results/<kr>/check-ins → 201`, w bazie nowy
wiersz `okr_vnext_checkins` z notatką, `okr_vnext_key_results.current_value`
10 → 9, `progress` 0,50 → 0,75, postęp celu 55 % → 63,7 %.

## 4. Testy i mutacje

`npx vitest run tests/unit/results-okr` → **28/28 PASS**
(`okrTrzyPoziomy.test.tsx` 14, `okrReportModel.test.ts` 14).

Dowody mutacyjne (wykonane, nie zadeklarowane):

| Mutacja | Skutek |
| --- | --- |
| `OkrKeyResultRedirect` renderuje stronę zamiast `<Navigate>` | pada „stary adres rezultatu PRZEKIEROWUJE na kartę celu” |
| przywrócenie pliku `OkrKeyResultSetPage.tsx` | pada „czwarty poziom nie istnieje jako plik” |
| `okrReportStateOf`: brak check-inu → `'on-track'` | padają 3 testy kubełków stanu |
| skasowanie `label` kolumny ZAKRES | pada „renderuje tabelę raportów … każda kolumna ma etykietę” |

Bramki: `check-list-canon.sh` OK (dług nie rośnie, spadł o 3),
`check-artefakt.sh` OK, `tsc --build` serwera OK, esbuild per plik OK.
Zastane czerwone (na czystym HEAD te same): 2 testy w
`tests/unit/i18n/idea-workspace-required-keys.test.ts` — nie dotyczą OKR.

`rg -n -e "OkrKeyResultSetPage" -e "OkrKeyResultCardPage" -e "/rezultaty" src`
→ wyłącznie komentarze i stałe tras przekierowań; zero komponentów stron.

## 5. Czego NIE ma (uczciwie)

1. **Zakładka „Teresa” w prawym panelu poziomu 3.** Prototyp ją rysuje; w
   aplikacji `TeresaProposalPanel` jest modalem konkretnego przekazania
   (szkic refleksji), nie panelem bocznym. Zakładka bez treści byłaby martwym
   afordansem, więc jej nie dołożono. Prawy panel ma komplet sekcji accordionu.
2. **Ikona karty działania przy pigułce „Krytyczny”.** Karty działania dla OKR
   nie ma w systemie (KROK 0: pozycja „brak”); to część B paczki. Ikona
   prowadziłaby donikąd.
3. **Edycja tematu / zespołu / terminu z UI.** Pola są czytane i pokazywane;
   formularze celu i rezultatu ich jeszcze nie przyjmują (wymaga rozszerzenia
   walidatorów i komend zapisu). Dane pokazowe wypełnia skrypt seedowy.
4. **Wdrożenie na staging.** Migracja i dwie trasy GET nie są tam obecne —
   ekran poziomu 1 na dzisiejszym stagingu pokazałby błąd pobrania agregatów.
5. Zrzuty ciemne wykonano dla poziomu 3; poziomy 1 i 2 mają zrzut jasny
   (skrypt `zrzut.mjs` wymusza motyw jasny).
