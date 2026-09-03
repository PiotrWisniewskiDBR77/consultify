# Rejestr martwych tras — dyżur 289

## A. Wołacze i trasy

| Wołacz | Trasa | Serwer | Odpowiednik | Decyzja | Commit |
| --- | --- | --- | --- | --- | --- |
| `useUserNotificationPreferences.tsx:192,422,448` | `/api/settings/watchers` GET/POST/DELETE | NIE; realny GET = 404 | obserwatorzy inicjatyw i rekordów są osobnymi bytami, bez agregatu task/initiative/project | MARTWY: jedyny konsument to osierocony `NotificationSettingsV2`; zero kodu w A | pomiar w raporcie |
| `HelpContext.tsx:299-317` | `POST /api/help/events` | TAK | `help_events` | naprawiono zapis payloadu frontu i prawdziwy wynik operacji | `820b8d0a5b` |

## B. Schemat pomocy

| Kolumna | Migracja PRZED | Kod | Naprawa | Commit |
| --- | --- | --- | --- | --- |
| `help_articles.category_id` | brak | odczyt/lista/liczniki | addytywna + backfill z `category` | `820b8d0a5b` |
| `help_articles.body` | brak | wyszukiwanie | addytywna + backfill z `content` | `820b8d0a5b` |
| `help_articles.status` | brak | filtr publikacji | addytywna + backfill z `is_published` | `820b8d0a5b` |
| `help_events.article_id` | brak | zapis zdarzenia | addytywna | `820b8d0a5b` |
| `help_events.metadata` | brak | zapis zdarzenia | addytywna; kompatybilne mapowanie `context` | `820b8d0a5b` |

## C. Ciche błędy

| PRZED | PO |
| --- | --- |
| `help.routes.ts:187` `.catch(() => [])` | log z kontekstem + błąd przekazany do 5xx |
| `help.routes.ts:199` `.catch(() => [])` | log z kontekstem + błąd przekazany do 5xx |
| `help.routes.ts:216` `.catch(() => [])` | log z kontekstem + błąd przekazany do 5xx |
| `help.routes.ts:224` `.catch(() => [])` | log z kontekstem + błąd przekazany do 5xx |
| `help.routes.ts:274-278`, sukces mimo nieudanego `dbRun` | sprawdzenie `result.success`; log z kontekstem i HTTP 500 albo potwierdzony zapis |

