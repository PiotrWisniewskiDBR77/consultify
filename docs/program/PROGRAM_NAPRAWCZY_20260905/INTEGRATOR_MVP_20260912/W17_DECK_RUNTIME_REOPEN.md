# W17 — realny readonly reopen, 2026-09-12

**REPRODUCED / RED.** Realny root built frontend5290 + istniejący C8 API4218 + PostgreSQL6459/cx8_e0. Samo otwarcie i reload zapisują prezentację mimo0edycji użytkownika. To rozszerzenie dowodu komponentowego na lokalny browser/API/PG, nie staging ani odbiór pełnego modułu.

Identity: previewPID43209 cwd codex-integrator-mvp-20260912, jawny --strictPort5290 i root/dist. APIPID55218 cwd codex8-finanse-pelny, istniejący api.mts przez tsx. Kontener cx-codex8-pg mapuje127.0.0.1:6459; SQL potwierdził current_database=cx8_e0. Docker jawnie lokalny socketColima. SHA256dist/index.html `4e5d3a0d2df23e3cfdb8f70f717e76a6fb8591836cb9e83a31e305e1424ab213`, identyczny z wcześniejszym built smokead7618df32. Bez restartu, builda, zmian flags lub produktu.

Syntetyczny deck `c3d47bdf63d6480583e3aeeb3deef63b`, orgwłasnegoC8fixture. Utworzony przez prawdziwe POST /api/presentations/decks HTTP201 po logowaniu OWNER rzeczywistym formularzem. Jeden slajd, tekstwyłącznie lokalnej próby. Żadnego SQL INSERT/UPDATE ani obejścia lifecycle/trial. SQL wyłącznie odczytał tę własną prezentację i jej historię. Konta/hasła/JWT nie trafiły do raportów.

| Moment | SQL/APIversion | SQLupdated_at | Liczba historii | Autosave |
|---|---|---|---|---|
| Po APIcreate, przed otwarciem |1 /1|2026-09-12T21:39:15.272118|0|0|
| Po otwarciu,6s bezinterakcji |2 /2|2026-09-12T21:39:16.646670|1|1PUT HTTP200, CAS1|
| Po reload,6s bezinterakcji |3 /3|2026-09-12T21:39:22.781743|2|kolejnyPUT HTTP200, CAS2|

Networkpayload hash odpowiada deck_json z APIreadback po każdym zapisie. Pierwsza adopcja normalizuje metadane (ai/created_at/deckId/delivery/generation/lifecycle/meta/schemaVersion/traceability/updated_at); następny reload zmienia już tylko updated_at wewnątrz deck_json. To nie użytkownik edytował treść; komponent przepisuje wynik odczytu/normalizacji. Kolumnowy updated_at i historia również się zmieniają. API serializuje timestamp z offsetem różnym od surowegoSQL (w JSON zachowane oba); wersje identyczne, wniosek o zmianie wynika z obu źródeł bez zakładania zgodnej strefy.

Obejrzane open.png i reload.png,1440×1000: prawdziwy builder/slajd, komunikatSaved, panelversion2→3. Nie wystąpiła bramka ani crash. Zero pageerror i zarejestrowanychHTTP4xx/5xx;6prób Googlefont/analytics zablokował lokal-only przyrząd. Browser nie naciskał kontroli edycji, restore,AI ani title; wyłącznie goto, oczekiwanie i reload po loginie.

Dowody: katalog `w17-runtime-reopen-20260912/`: harness.mjs, readback.json, content-delta.json, open/reload PNG i tekst. Harness exit0 oznacza zakończony pomiar z jawnym statusREPRODUCED_UNSOLICITED_AUTOSAVE, niePASSproduktu. Deck zachowany do dalszego odbioru; nie usuwano danych. API/Vite/PG6457 nietknięte. Preview5290 i ograniczone użycieC8backend4218 zwrócone root; brak aktywnego browserharnessu.
