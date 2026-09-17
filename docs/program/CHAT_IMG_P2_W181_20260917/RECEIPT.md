# CHAT-IMG P2 — domknięcie transportu obrazu w Czacie

**Werdykt: READY FOR CTO REVIEW — siedem długów W179/W181 zamknięto bez migracji i bez regresji TypeScript; niezależny re-review: ACCEPT, P0=0, P1=0.**

## Tożsamość

- Tor: A / Codex-1.
- Gałąź: `codex/chat-img-p2-w181-20260917`.
- Baza: `be57c5dae677844a224d78d874d3ab52444a882d`.
- Zakres: W179 P2 CHAT-IMG oraz bramka legacy `/api/ai/chat` z W181.
- Flagi `ENABLE_CHAT_IMAGES` i `VITE_CHAT_IMAGES` pozostają domyślnie OFF; paczka nie zmienia ich wartości ani Dockerfile.
- Bez migracji, stagingu, deployu, Railway i chronionych refów.

## Zachowanie po zmianie

1. Klasyfikacja intencji otrzymuje wyłącznie tekstowe bloki wiadomości multimodalnej. Obiekt obrazu i data URL nie są zamieniane w `[object Object]` ani przekazywane klasyfikatorowi.
2. Statyczny fallback routera normalizuje namespacowane identyfikatory modeli przed sprawdzeniem możliwości vision. `openai/gpt-4o-mini` nie znika już z poprawnego fallbacku.
3. Model bez vision zwraca `CHAT_IMAGE_MODEL_UNSUPPORTED`, HTTP 422, `retryable=false`. Odpowiedź nie ujawnia identyfikatora modelu; UI pokazuje konkretne EN/PL: co się stało i co zrobić.
4. Jeśli upload nowego obrazu nie powiedzie się, bieżąca tura nie dostaje poprzedniego obrazu z rozmowy. Jawnie przenosi `failedAttachments`, `hasAttachments=false` i pustą listę nazw. Następna czysto tekstowa tura nadal może użyć ostatniego poprawnie zapisanego obrazu zgodnie z conversation-scoped reuse.
5. Chip obrazu używa tokenów `c-*`; surowe `slate/navy` usunięto z tego chipa. Miniatura w kompozytorze i transkrypcie używa `imagePreviewAlt` z nazwą pliku.
6. Nowy frontendowy `as any` przy odpowiedzi uploadu oraz nowe rzutowania backendu usunięto; pełna delta CHAT-IMG względem rodzica v1 ma bilans `as any`: **0 dodanych, 4 usunięte, netto -4**.
7. Legacy `POST /api/ai/chat` kontroluje surowe aliasy `images`, `chatImages`, `context.images`, `context.chatImages` **przed** walidatorem, który usuwa nieznane pola. Flaga OFF zwraca 404 `CHAT_IMAGES_DISABLED`; flaga ON zwraca 422 `CHAT_IMAGES_UNSUPPORTED_ON_LEGACY_CHAT`. Zwykły tekst i puste tablice przechodzą bez zmiany.

## Dowody

- Front: 4 pliki testowe, **52/52 PASS**, `--retry=0`.
- Backend: multimodal/router **5/5**, mapper błędów **22/22**, legacy guard **8/8** — razem **35/35 PASS**.
- Zastana rodzina tras uploadu: **18/18 PASS**.
- RealPG: świeże migracje **925/925 PASS**; realny router + JWT zapisuje przez POST obraz 5 MiB decoded (około 6,67 MiB JSON) do `conversation_messages.metadata` JSONB, bezpośredni SELECT potwierdza rozmiar/hash, GET zwraca identyczny hash — **1/1 PASS, bez skipu**. DB identity: `127.0.0.1:6454/consultify_chatimg`. Ten sam test z niedostępną bazą kończy się **RED** przez `REALPG_REQUIRED`; nie ma ścieżki false-green.
- Server TSC: **0 diagnostyk**, exact lock `@types/node` **22.19.3**.
- Front TSC na tej samej pełnej materializacji i instalacji: baza **152**, kandydat **152**, delta **0**. Jedyny hit w zmienionym pliku (`UnifiedChatPanel.tsx:2077`) jest identyczny na bazie i kandydacie. Referencja środowiska CTO: **169**.
- Bramy: flagi `196/208`, brakujące `0`; listy `346=346`; artefakty `8=8`; język PASS; `git diff --check` PASS.
- Mutacje RED: usunięcie blokady fallbacku wysyła poprzedni obraz i wywraca test; stary `String(content)` daje `[object Object],[object Object]`; brak normalizacji modelu usuwa `openai/gpt-4o-mini` z fallbacku.

## Ryzyka poza zakresem

1. Legacy guard jest dowiedziony jako realny middleware/helper i przez jego pozycję przed `validateBody`; nie dodano osobnego pełnego supertestu dla legacy `/api/ai/chat`.
2. `UnifiedChatPanel.przewodyChat` emituje zastane ostrzeżenia React `act(...)`; testy przechodzą, lecz szum powinien zostać usunięty osobno.
3. Każdy obraz pozostaje dużym base64 w JSONB i pełnym GET rozmowy. Test dowodzi poprawność dla limitu 5 MiB, lecz koszt transferu, pamięci, WAL i backupu rośnie liniowo. Docelowe object storage + pointer wymaga osobnej decyzji i migracji.
4. Limit globalnego JSON body 10 MB jest dziś jedynym twardym limitem metadata na trasie rozmów; szczegółowa walidacja `metadata.images` po stronie conversations route jest osobnym utwardzeniem.

## Granice

Nie wykonano zrzutów zgodnie z regułą kanału. Nie zmieniono flag środowiskowych i nie wysłano żadnego ruchu do stagingu. Dowody dotyczą lokalnego kandydata oraz własnej bazy PostgreSQL w `tmpfs`.
