# D-11 — Audyty → Library: jeden defekt realny, dwa zarzuty bez pokrycia

## 1. Kolumny KRYTERIA i ŹRÓDŁO puste — DEFEKT REALNY, naprawiony
`GET /api/audits/packs` nie oddawał ani `criteriaCount`, ani `sourceTitle`,
choć kontrakt frontu (`auditsMethodApi.ts`, `AuditPackSummary`) deklarował
oba. `mapPackRow` po prostu ich nie mapował, a `listPacks` robił
`SELECT * FROM audit_packs` — bez policzenia kryteriów i bez sięgnięcia po
tytuł źródła. Kolumna rysowała `undefined`, czyli pustkę (nawet nie „—").

Pomiar przed: `criteriaCount: None | sourceTitle: None`, w bazie
`audit_pack_criteria` = 7 wierszy dla tego pakietu.
Pomiar po: `criteriaCount: 7 | sourceTitle: Northwind Operational Excellence
Programme — internal audit procedure`.

Dowód, że SQL jest poprawny, a nie tylko „zielony na atrapie":
`packService.test.ts` przeciw REALNEMU Postgresowi — **9/9 PASS**, łącznie
z testem izolacji organizacji. Na atrapie bazy ten sam plik ma 7 błędów
PRZED moją zmianą i 8 PO — ósmy to test izolacji, którego shim SQL nie umie
sparsować po dołożeniu `LEFT JOIN`. Przyrząd, nie produkt (uruchomienie
z realną bazą w nagłówku pliku testu).

## 2. „Chipy All 1 · Verified 0 · Pending review 0 nie sumują się" — TAK Z ZAŁOŻENIA
Menu 3 niesie **≤3 chipy razem z «Wszystkie»** (decyzja właściciela DEC-417b,
zapisana w `AuditsMethodHub.tsx:160-166`). Stany weryfikacji są cztery
(VERIFIED, PENDING_REVIEW, UNVERIFIED, EVIDENCE_MISSING); chipy pokazują dwa
o największej wartości decyzyjnej, a PEŁNA lista żyje w rozwijanym Menu 2
obok („Verification: All"). Chipy są FILTRAMI, nie rozbiciem całości —
jedyny pakiet jest `UNVERIFIED`, więc oba chipy słusznie pokazują 0.
Zmiana tego złamałaby DEC-417b. Zero zmian.

## 3. „Przycisk «New audit» wygaszony" — WYGASZONY SŁUSZNIE I PODPISANY
Tuż pod przyciskiem stoi zdanie, które mówi dlaczego: „Frozen until wave 2:
uploading audit assumptions and the question generator." To świadome
zamrożenie zakresu, nie awaria — i jest nazwane wprost na ekranie. Zero zmian.
