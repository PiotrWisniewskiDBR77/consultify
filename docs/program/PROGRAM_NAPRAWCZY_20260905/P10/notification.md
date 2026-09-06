# Powiadomienie

Zrzut realnego rekordu: `evidence/p10-karty-n/notification/notification-open.png`.

| sekcja | kontrakt mówi (plik:linia / „brak kontraktu”) | ekran pokazuje (plik:linia + zrzut) | źródło danych (API pole → writer server/src plik:linia / „MARTWE: brak writera”) | rozjazd | waga |
|---|---|---|---|---|---|
| Co się dzieje | `notificationCardContract.ts:71-107` | `NotificationDetailView.tsx:1672`; zrzut | `data.description/whyImportant/blocked` → `notificationService.ts:700-768` | brak | kosmetyka |
| Analiza AI | `notificationCardContract.ts:108-137` | brak w nawigacji zrzutu | `data.aiAnalysis` → `notificationService.ts:700-768` | sekcja z kontraktu nieobecna | blokuje MVP |
| Oczekiwana akcja | `notificationCardContract.ts:138-170` | `NotificationDetailView.tsx:1672`; zrzut | `data.expectedAction` → `notifications.routes.ts:817-842` | brak | kosmetyka |
| Historia aktywności | `notificationCardContract.ts:171-198` | po Fazie B: „HISTORIA AKTYWNOŚCI”; `po/notification-open.png` | dziennik aktywności → writer zdarzeń `notificationService.ts` | brak | kosmetyka |
| Właściwości | brak kontraktu | widoczna; zrzut | pola rekordu → `notificationService.ts:482-491` | sekcja poza kontraktem | blokuje MVP |
| Powiązania | brak kontraktu | widoczna; zrzut | API relacji; writer nieustalony | sekcja poza kontraktem | blokuje MVP |
| Źródła i założenia | brak kontraktu | widoczna; zrzut | MARTWE: brak writera wskazanego przez komponent | pusta na wyrost | blokuje MVP |
| Rezultaty | brak kontraktu | widoczna; zrzut | MARTWE: brak writera wskazanego przez komponent | pusta na wyrost | blokuje MVP |
| Komentarze | brak kontraktu | widoczna; zrzut | komentarze API → writer w trasach powiadomień | sekcja poza kontraktem | blokuje MVP |
| Typ karty „Powiadomienie” | kontrakt/rejestr: polska nazwa „Powiadomienie” | po Fazie B: `MyWorkHub.tsx:2019`; `po/notification-open.png` | i18n `myWork.notificationDetail.notification` | brak | kosmetyka |
