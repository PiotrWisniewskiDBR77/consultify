# Raport lokalny — higiena danych właściciela

Data: 2026-09-06. Baza: wyłącznie `postgresql://postgres:***@127.0.0.1:54400/consultify_noc`, `NODE_ENV=development`, `CI=true`. Organizacja: DBR77 `cc9db573-260f-4a19-927f-f3cc1fbaea38`.

## Stan rzeczywisty DBR77 (bez fixture)

- `oceny.ts`: znalezione 4 aktywne oceny legacy i 0 sesji method-core; plan archiwizacji 0; zmienione 0; do przywrócenia 0. Wyniki: 100%, 100%, 100%, 65%.
- `smieci.ts`: znalezione 0; zmienione 0; przywrócone 0.
- `legacy-finanse-2024.ts`: 0 pakietów DBR77 kwalifikujących się do planu (6 lokalnych rekordów finance należy do wyłączonego CD PROJEKT); zmienione 0; przywrócone 0.
- `sprawdz-silesia.ts`: 0 wystąpień `Silesia` / `PL · Silesia`.
- Liczniki przed i po komplecie czterech dry-run były identyczne: assessments 4, method_sessions 0, initiatives 71, meetings 0, tasks 84, ideas 0, notebook_pages 6, organization_context 1, financial_statements 6.

## Kontrolowane fixture lokalne

- `oceny.ts`: znalezione do archiwizacji 1, pierwszy apply zmienił 1, drugi apply 0, rollback przywrócił 1. Najlepsza istniejąca ocena (100%) pozostała nietknięta. Pierwszy rollback wykrył kolumnę generowaną `assessments.type`; po poprawce `776d3598ed` powtórka przywróciła rekord prawidłowo.
- `smieci.ts`: znalezione 1, pierwszy apply usunął 1 po kopii CSV, drugi apply 0, rollback przywrócił 1.
- `legacy-finanse-2024.ts`: fixture BS 2024 z jedną linią P&L dał `pozycje w złym typie=1`; pierwszy apply zarchiwizował 1, drugi apply 0, rollback przywrócił 1.
- RealPG tenant isolation: 2/2 testy PASS; plan właściciela zawierał 1 rekord, plan nie zawierał rekordu drugiej organizacji. Mutant bez filtra organizacji zobaczył rekord drugiej organizacji, czyli zabezpieczenie ma obserwowalny RED.
- `npx tsc --build tsconfig.build.json`: exit 0.
- `server/migrations`: 0 zmian.

Fixture zostały usunięte po utworzeniu kopii CSV; końcowe liczniki wróciły do stanu sprzed prób.

## Nie zmierzono

- Nie wykonywano żadnego połączenia ze stagingiem, demo ani produkcją.
- Nie wykonano stagingowego dry-run ani stagingowego apply/rollback; robi to nadzorca według README po potwierdzeniu środowiska.
- Na lokalnej bazie nie ma rekordów method-core DBR77, więc procent method-core nie miał realnego lokalnego przykładu.
- W gałęzi źródłowej projekcja znajduje się w `src/components/assessment/assessmentOutputProjection.ts`, a nie we wskazanej w zleceniu ścieżce `server/src/services/assessment/assessmentOutputProjection.ts`.
