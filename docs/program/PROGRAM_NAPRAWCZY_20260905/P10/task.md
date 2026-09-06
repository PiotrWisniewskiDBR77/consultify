# Zadanie

Zrzut: `evidence/p10-karty-n/task/task.png`; realny rekord wybrano z listy, lecz szczegół pozostał na „Ładowanie…”.

| sekcja | kontrakt mówi (plik:linia / „brak kontraktu”) | ekran pokazuje (plik:linia + zrzut) | źródło danych (API pole → writer server/src plik:linia / „MARTWE: brak writera”) | rozjazd | waga |
|---|---|---|---|---|---|
| Opis i zakres | `taskCardContract.ts:105-125` | `TaskDetailView.tsx:3304`; zrzut nie dowodzi sekcji | `description` → `my-work.routes.ts:1519` | brak | kosmetyka |
| Pomysły realizacji | `taskCardContract.ts:126-147` | `TaskDetailView.tsx:3304`; brak dowodu runtime | generacja ad-hoc; kontrakt sam wskazuje brak klucza backendu | pusta na wyrost | blokuje MVP |
| Ryzyko i alternatywy | `taskCardContract.ts:148-166` | `TaskDetailView.tsx:3304`; brak dowodu runtime | generacja ad-hoc; brak trwałego klucza backendu | pusta na wyrost | blokuje MVP |
| Lista kontrolna | `taskCardContract.ts:167-186` | `TaskDetailView.tsx:3304`; brak dowodu runtime | `checklist` → `my-work.routes.ts:1539-1541` | brak | kosmetyka |
| Zależności | `taskCardContract.ts:187-206` | `TaskDetailView.tsx:3304`; brak dowodu runtime | sekcja generate → `my-work.routes.ts` | brak | kosmetyka |
| Dowody | `taskCardContract.ts:207-227` | `TaskDetailView.tsx:3304`; brak dowodu runtime | `evidence_refs_json` → `my-work.routes.ts:2891-2930` | brak | kosmetyka |
| RACI i eskalacja | `taskCardContract.ts:228-243` | `TaskDetailView.tsx:3304`; brak dowodu runtime | MARTWE: brak jednoznacznego writera task | pusta na wyrost | blokuje MVP |
| Załączniki i powiązania | `taskCardContract.ts:244-269` | `TaskDetailView.tsx:3304`; brak dowodu runtime | API załączników/powiązań → writer rozproszony | brak | kosmetyka |
| Komentarze | `taskCardContract.ts:270-285` | prawy panel `TaskDetailView.tsx:6054`; brak dowodu runtime | API komentarzy task | brak | kosmetyka |
| Aktywność | `taskCardContract.ts:286-310` | prawy panel `TaskDetailView.tsx:6054`; brak dowodu runtime | systemowy log zdarzeń | brak | kosmetyka |
