# Higiena danych właściciela

Skrypty wymagają jawnego `DATABASE_URL`, `--org=<nazwa|uuid>` i dokładnie jednego trybu: `--dry-run`, `--apply` albo `--rollback=<manifest.json>`. Logi, manifesty i kopie CSV trafiają do `evidence/higiena-danych/`. Nie edytują migracji.

## Kolejność dla nadzorcy na stagingu

Najpierw uruchom wyłącznie pomiary i pokaż właścicielowi ich połączony stdout jako **jedną listę PLAN**:

```bash
railway run env NODE_ENV=development CI=true npx tsx server/scripts/higiena-wlasciciela/oceny.ts --org=DBR77 --dry-run
railway run env NODE_ENV=development CI=true npx tsx server/scripts/higiena-wlasciciela/smieci.ts --org=DBR77 --dry-run
railway run env NODE_ENV=development CI=true npx tsx server/scripts/higiena-wlasciciela/legacy-finanse-2024.ts --org=DBR77 --dry-run
railway run env NODE_ENV=development CI=true npx tsx server/scripts/higiena-wlasciciela/sprawdz-silesia.ts --org=DBR77 --dry-run
```

`railway run` dostarcza `DATABASE_URL`; nadzorca musi przed uruchomieniem potwierdzić właściwe środowisko staging. Dopiero po odpowiedzi właściciela „Tak” uruchamia trzy pierwsze polecenia z `--apply`. Każde wypisze ścieżkę manifestu. Cofnięcie konkretnego przebiegu:

```bash
railway run env NODE_ENV=development CI=true npx tsx server/scripts/higiena-wlasciciela/smieci.ts --org=DBR77 --rollback=evidence/higiena-danych/smieci-...-manifest.json
```

`oceny.ts` nie archiwizuje najlepiej wypełnionej oceny ani żadnej oceny z wynikiem co najmniej 10%. `smieci.ts` przed DELETE zapisuje pełny wiersz do CSV; jeśli znajdzie zależności FK i tabela nie ma semantyki archiwum, niczego nie usuwa i oznacza pozycję „DO DECYZJI”. `legacy-finanse-2024.ts` nie dotyka CD PROJEKT. `sprawdz-silesia.ts` jest tylko pomiarem i kończy się kodem 1 przy dowolnym trafieniu.

## Runda 2 — dane niepasujące do ekranów

Nadzorca najpierw wybiera **UUID** organizacji (na stagingu są dwie organizacje o nazwie DBR77), następnie uruchamia dry-run i zachowuje jego stdout jako PLAN. Samo dopasowanie po nazwie jest zabronione.

```bash
DATABASE_URL="$DATABASE_PUBLIC_URL" NODE_ENV=development CI=true npx tsx server/scripts/higiena-wlasciciela/niepasujace.ts --org=<uuid> --dry-run
```

Kolejność: (1) sprawdź grupy C/D i pozycje „DO DECYZJI”, (2) zachowaj wynik dry-run, (3) po odbiorze uruchom tę samą komendę z `--apply`, (4) uruchom drugi `--apply` i wymagaj `ZMIENIONE: 0`, (5) w razie cofnięcia użyj `--rollback=evidence/higiena-danych/niepasujace-...-manifest.json`. Skrypt archiwizuje tam, gdzie istnieje semantyka archiwum; DELETE wykonuje dopiero po pełnej kopii CSV. Dwa BUG-i rundy 1 (`db9c4193…`, `5a8b614b…`) są wyszukiwane po jednoznacznym prefiksie UUID, a ich zależne wiersze również trafiają do CSV i manifestu przed usunięciem.

### Naprawa: ocena SIRI/ADMA/DRD błędnie klasyfikowana jako pusta

Dry-run z 06.09 na stagingu (D=390) zawierał **1 błąd**: `assessments b901d4a3…` „DRD Assessment -
Jul 12, 2026” — jedyna ocena właściciela wypełniona w 100% (`answers_json.drd.areas` ma 39
obszarów) — trafiła do planu z powodem „ocena SIRI/ADMA/DRD z zerem obszarów widocznych dla
ekranu”. Przyczyna: stara reguła sprawdzała WYŁĄCZNIE trzy sztywne ścieżki jsonb
(`drd.areas`/`siri.dimensions`/`adma.dimensions`) wprost w SQL — jeśli realny wiersz ma inny
kształt zapisu (np. starszy import, brak owijki `drd`), `coalesce(...)` widzi same NULL-e i
wychodzi „pusta” mimo `completion_percent=100`. Naprawione w `niepasujace.ts`
(`isAssessmentEmptyForScreen`): emptiness liczymy w JS, z `completion_percent` jako
autorytatywnym sygnałem (kolumna niezależna od kształtu JSON-a) + fallback na dowolny klucz
`method_*` niepusty, obok dotychczasowych trzech ścieżek. Dowód: `server/tests/higiena-wlasciciela/niepasujace.klasyfikacja.test.ts`
(jednostkowy, fixture 39-obszarowa, bez bazy) i `server/src/services/__tests__/niepasujace.higiena.pg.test.ts`
(RealPG, z mutacją „powrót do starej reguły → RED”).

### Filtry CLI (addytywne)

Wszystkie działają razem z `--dry-run`/`--apply`, nie zmieniają izolacji po `organization_id`:

- `--tylko-tabele=conversations,tasks` — ogranicza plan do wskazanych tabel (rozdzielone przecinkiem).
- `--tylko-powod=<fragment>` — zostawia tylko pozycje, których `reason` zawiera fragment (bez uwzględniania wielkości liter).
- `--bez-tytul=<regex>` — wyklucza z planu rekordy, których tytuł pasuje do regexu (bez uwzględniania wielkości liter). Chroni np. nazwane pliki właściciela przed przypadkowym trafieniem reguły „typ artefaktu nieobsługiwany”.
- `--z-zaleznosciami` — pozycje „DO DECYZJI” (mają zależne wiersze bez rozstrzygniętej semantyki archiwum) są w trybie `--apply` rozstrzygane automatycznie: zależne wiersze (np. `task_comments`) trafiają do kopii CSV i są usuwane PRZED usunięciem rekordu głównego, zamiast być pomijane. W dry-run nadal widać pełne „DO DECYZJI (n zależności: tabele)” w wypisie.
- `--plan-csv=<ścieżka>` — zapisuje wiersze planu (tabela, id, tytuł, data, powód, decyzja) do wskazanego pliku CSV — jedna lista do pokazania właścicielowi, niezależnie od trybu (działa też w `--dry-run`).

Dry-run zawsze wypisuje aktywne filtry w linii `FILTRY: ...` tuż pod nagłówkiem `PLAN`.

### Komenda dla nadzorcy — runda 2, usunięcie 233 pustych wątków + ~100 „Structured sheet draft” + 2 BUG-i z zależnościami

Bez tabeli `assessments` w tej rundzie (po naprawie klasyfikatora nie ma tam kandydatów, ale
zakres i tak trzymamy jawnie wąski) i z wykluczeniem nazwanych plików XLSX właściciela:

```bash
DATABASE_URL="$DATABASE_PUBLIC_URL" NODE_ENV=development CI=true npx tsx server/scripts/higiena-wlasciciela/niepasujace.ts \
  --org=<uuid> \
  --tylko-tabele=conversations,tasks,v8_output_artifacts \
  --bez-tytul='FINAL|Financial Model|Portfolio|pustego excela' \
  --z-zaleznosciami \
  --plan-csv=evidence/higiena-danych/plan-runda2-<data>.csv \
  --dry-run
```

Po akcepcie właściciela na `plan-runda2-<data>.csv` — ta sama komenda z `--apply` zamiast
`--dry-run`, drugi `--apply` musi dać `ZMIENIONE: 0`.
