# M2 — trwały readback dziewięciu zadań

Pomiar: 2026-09-15, użytkownik Irina Lebedjuk, organizacja Northwind. Identyfikatory odczytano z kanonicznego panelu pełnego zadania (`my-work-document-tab-<uuid>`). Tytuły i właściciela pokazuje ta sama tabela Tasks w lokalnym kandydacie podłączonym do API stagingu.

| Narzędzie | Tytuł zadania | Task ID | Właściciel | Dowód pochodzenia |
|---|---|---|---|---|
| Notatnik | Publish steering group follow-up | `c9f4d330-75df-4775-bcf6-4dc88103e40f` | Irina Lebedjuk | opis `From note: Publish steering group follow-up`; pole Source w pełnej karcie = `—` |
| Notatnik | Confirm Wakefield improvement owners | `6002bcbc-8192-4ae8-9268-b3d98ca4fb7a` | Irina Lebedjuk | tytuł źródłowej notatki; pole Source w pełnej karcie = `—` |
| Notatnik | Prepare Monday operations review | `fa9a823a-7cc1-4266-be8c-2bc157a6c687` | Irina Lebedjuk | tytuł źródłowej notatki; pole Source w pełnej karcie = `—` |
| Pomysły | Supplier quality early-warning signal between quarterly reviews | `2e9cda0f-0d1b-4386-b36e-d65ee539b10a` | Irina Lebedjuk | tytuł źródłowego pomysłu; pole Source w pełnej karcie = `—` |
| Pomysły | One changeover clock instead of three stopwatches | `529bf299-8eb7-449e-981d-f6aa91c856b4` | Irina Lebedjuk | tytuł źródłowego pomysłu; pole Source w pełnej karcie = `—` |
| Pomysły | Retire the paper goods-in checklist at Wakefield | `690cbdb0-4241-4ee3-af21-e6ce6699ac9f` | Irina Lebedjuk | tytuł źródłowego pomysłu; pole Source w pełnej karcie = `—` |
| Dokumenty | Review document: Northwind 2027 Operational Maturity - Programme Charter.docx | `ad9124b4-1fc8-4210-a531-a88edf504512` | Irina Lebedjuk | POST wysyła `sourceType=document` i odrębny `sourceId`; pełna karta pokazuje Source = `—` |
| Dokumenty | Review document: Standard Work Instruction WI-OPS-118 - Line 3 Changeover.docx | `e0fafe06-08f9-4536-a894-0a11b95df68f` | Irina Lebedjuk | POST wysyła `sourceType=document` i odrębny `sourceId`; pełna karta pokazuje Source = `—` |
| Dokumenty | Review document: northwind-s1-14-source-note.txt | `554f155d-1b54-46a4-9609-66e30547ea30` | Irina Lebedjuk | POST wysyła `sourceType=document` i odrębny `sourceId`; pełna karta pokazuje Source = `—` |

Zrzuty `screens/tasks-nine-literal-readback.png` i `screens/tasks-ideas-literal-readback.png` pokazują dziewięć tytułów w tabeli oraz właściciela. Test komponentu dowodzi trzech elementów kontraktu Document → task: różne `sourceId`, stabilny klucz przy retry oraz pojedynczy zapis przy podwójnym kliknięciu. Staging na linii przed M2 nadal pokazuje `Source = —`. Kandydat M2 v3 zwraca `sourceType/sourceId` z owner scoped API, pokazuje `Document/Dokument` w karcie i ma klikalny link z dokładnym UUID; dowód zachowania: targeted UI 1/1 + RealPG 1/1. Zachowanie na zintegrowanym stagingu czeka na odbiór i wdrożenie CTO.
