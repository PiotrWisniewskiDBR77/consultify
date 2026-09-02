# CODEX DAY 258 — AI RODZINA — raport

## Stan wejściowy

- Dokument: `WYDANY`; baza: `github-backup/codex/m03-admin-20260824`; marker instrukcji: `df7f13056f`.
- `git merge-base --is-ancestor ...` → `MARKER OK`.
- sanity HEAD: `df7f13056fa24995be07f64b0e8c877b3faeab45`; `git status --short` → brak wpisów.
- Tip uciekł do przodu do `7a733cb63d`; zgodnie z DEC-2026-08-26-95 praca została rozpoczęta dokładnie z markera. Diff tipa obejmował dokumenty programu/instrukcje, nie kod badanych mechanizmów.
- Dysk przed worktree: 12 GiB wolne; po utworzeniu: 9.5 GiB. Porty `6256`, `5236`, `5237` były wolne. Instrukcja zabrania uruchomienia DB i LLM, więc nie uruchomiono kontenera, runtime ani modelu.

## R1 — weryfikacja i rozszerzenie

T1-T4 potwierdzone: sześć seedów ma osobne tabele i osobne ścieżki cyklu. Dowody rdzeniowe: Presentations `presentations.routes.ts:872,928,4307-4459`; AI Actions `aiActionExecutor.ts:514,672-768,886-931`; My Work `agentApprovedMaterializationService.ts:124-268`; V8 governance `agentProposalGovernanceService.ts:184-301,502`; Case Workspace `proposalApprovalService.ts:847-1179`; SWOT ma tabelę `server/migrations/20260802_swot_proposals.sql:21`, dedykowany serwis i kanoniczną bramkę `swotAcceptGate.ts:137-195`.

T5 potwierdzone jako **siódma niezależna kopia**, nie wołacz seedów: `audit_ai_proposals` ma własny `INSERT` (`aiProposalService.ts:904`), human decision (`:1004-1023`) i oddzielny commit dopuszczony wyłącznie dla `accepted` (`:1228-1278`).

`tablePlatform` jest **jednym wspólnym silnikiem** dla schematu tabel, nie wieloma kopiami: `tp_schema_proposals` pending (`ChatToSchemaService.ts:449-450`), execute (`:470-596`) i reject (`:704-712`).

Pełny przesiew `server/migrations/**` i `server/src/services/**` (wzorce z instrukcji) dał 2024 trafienia surowe; po odrzuceniu zwykłych workflow approval, logów bez cyklu i duplikatów migracji potwierdzono dalsze niezależne rodziny: `v8_action_proposals`, `ai_approval_requests`, `assessment_ai_scoring_proposals`, `report_ai_proposals`, `notebook_ai_proposals` oraz wspólną rodzinę `transformation_stage_proposals`. Łącznie tabela R3 zawiera **14 potwierdzonych rodzin**, a nie sześć.

Kandydaci `v8_chat_action_proposals`, `v8_rebaseline_proposals`, `teresa_proposals`, `v8_mindmap_ai_proposals` zostają poza liczbą potwierdzoną: znaleziono magazyny/serwisy, lecz w tym pomiarze nie zamknięto dla każdego pełnego dowodu proposal→human approve/reject→materialization. Nie są cicho uznane za kopie.

## R2/R3

Pełna tabela charakterystyki, frontów, dat i rekomendacja znajdują się w `docs/program/funkcje/RODZINA_AI_PROPONUJE_AKCEPTUJE_2026-09-01.md`. Front oznacza wyłącznie znaleziony realny klient endpointu; samo API bez komponentu jest opisane jawnie.

## Pomiar testów §0.4a

Instrukcja wskazuje pakiet `brak` i twardo definiuje dyżur jako statyczny, bez DB i bez zmian produktu. Nie uruchomiono Vitest ani żadnego pakietu; `przed-nazwy.txt` i `po-nazwy.txt` są pustymi artefaktami, a ich diff jest pusty. Pułapki Z33 (a)-(d) nie dotyczą, bo nie było procesu testowego; pułapka (e) została obsłużona przez rozszerzony przesiew zapisany jako `r1-przesiew.txt`.

Artefakty poza repo i SHA-256:

- `r1-przesiew.txt`: `eeb5685203f924b2c3c63c5311236da3970fd5e566740cfb47dc213b630d4ac8`
- `przed-nazwy.txt`: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- `po-nazwy.txt`: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

## Korekty wobec instrukcji

- Marker wiążący wewnątrz instrukcji to `df7f13056f`, mimo że commit wydający instrukcję ma SHA `7a733cb63d`. Zastosowano bezpieczniejszą literalną procedurę §0.1 i udokumentowano rozjazd tipa.
- Seed sześciu rodzin był niepełny: potwierdzono 14. To wynik pomiaru, nie sprzeczność.
- T6: grep importu martwego barrel-a zwrócił zero, zgodnie z tezą. Żywotność oceniano przez bezpośrednie importy/montaż i konsumentów, nie przez barrel.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano runtime/HTTP/SQL, więc raport nie twierdzi, że którakolwiek ścieżka działa end-to-end; dowodzi kształtu i osiągalności statycznej.
- Nie rozstrzygnięto czterech kandydatów wymienionych w R1 jako potencjalnych dalszych kopii.
- Nie potwierdzono komponentu UI dla wierszy oznaczonych „API TAK” lub „brak potwierdzonego konsumenta UI”.

## Zakres zmian

Wyłącznie dwa licencjonowane dokumenty. Zero zmian kodu produktu, flag, bramek, routerów i infrastruktury testowej. Zero LLM, sieci produktowej, poczty, Railway i zdalnej bazy.
