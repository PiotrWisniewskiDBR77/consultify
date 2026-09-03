# Historia Czatu — zakresy i pomiar R1

## Model

Instrukcja twierdziła, że istnieją dwie definicje `conversations`; pomiar znalazł **trzy**: `073_conversations.sql`, `20260331_p35b_canonical_model_completion.sql` i `fix_conversations_table.sql`. Dwie pierwsze mają wspólny rdzeń; definicja P35 dodaje `deleted_at`, a następnie addytywnie zapewnia `visibility_scope`, `access_policy_version`, `client_info`, `retention_policy` i `version`. `fix_conversations_table.sql` powtarza starszy rdzeń i jest trzecim słownikiem schematu. Pełny migrator od zera przeszedł, ale istnienie trzech definicji jest długiem utrzymaniowym.

## Trasy czytające historię

| Trasa | Organizacja | Użytkownik | Test | Werdykt |
| --- | --- | --- | --- | --- |
| `GET /api/conversations` | osobiste: bieżąca org albo legacy NULL; zespołowe: `chat_projects.organization_id` + `checkChatPermission(read)` | osobiste: `c.user_id`; zespołowe: członkostwo/rola | `conversations.search.realdb.test.ts` częściowo; brak dowodu przez Gateway | reguła istnieje, produkcyjny mount `NIEZWERYFIKOWANY` |
| `GET /api/conversations/search` | zespołowe ograniczone do org i uprawnienia; bez wycieku licznika | osobiste ograniczone do autora | 12 przypadków real-PG, w tym pozytyw członka i negatyw obcej org | dowód router+JWT+PG, ale test montuje router w gołym Express, więc nie spełnia Z22 |
| `GET /api/conversations/:id` oraz zasoby potomne | helper `findAccessibleConversation`: osobiste dodatkowo związane z kontekstem org; zespołowe przez projekt team tej org | osobiste: autor | kilka suit P35/attachments/feedback | wspólny helper w obrębie pliku, lecz brak świeżego Gateway-proof |
| `GET /api/chat-projects/:id` | projekt osobisty autora albo team tej org | autor lub org | testy projektów | zapytanie rozmów dziedziczy sprawdzony projekt, ale rola/członkostwo nie jest ponownie sprawdzane w tym handlerze |
| `GET /api/chat-projects/conversations/:id/visibility-receipts` | ta sama org + team, z uwzględnieniem prywatności projektu i członkostwa | właściciel zawsze | testy move/remove i UI historii | osobna reguła, nie jeden centralny słownik |

## Panel dziś

`ChatHistorySidebar.tsx` ma 1365 linii i już zna zakresy `personal`/`team`. Obsługuje: grupy prywatne i organizacyjne, tworzenie folderów, zmianę nazwy/koloru, przenoszenie folderów i rozmów, jawne potwierdzenie poszerzenia widoczności, archiwizację/usuwanie zbiorcze, wyszukiwanie serwerowe, stany partial/scope-limited/error, zwijanie sekcji, przypięte/ostatnie/archiwalne oraz „Pokaż więcej”.

## Reguła docelowa

Prywatną rozmowę czyta i zmienia wyłącznie autor w zgodnym kontekście organizacji; organizacyjną czyta członek organizacji z rolą dopuszczoną przez `checkChatPermission`; przeniesienie z prywatnej do organizacyjnej wymaga `visibilityConsent === true` i atomowo zapisuje audyt `chat.visibility_consent_recorded` razem ze zmianą folderu.

Reguła jest dziś rozłożona między `conversations.routes.ts`, `chat-projects.routes.ts` i `chatPermissionService`, więc wymaganie R2 „jedno miejsce w kodzie” **nie jest spełnione**. Centralizacja wymagałaby zmiany wspólnych tras/serwisu i pełnego dowodu Gateway; nie wolno deklarować jej na podstawie samego inwentarza.
