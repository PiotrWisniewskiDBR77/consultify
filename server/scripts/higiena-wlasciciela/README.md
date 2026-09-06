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
