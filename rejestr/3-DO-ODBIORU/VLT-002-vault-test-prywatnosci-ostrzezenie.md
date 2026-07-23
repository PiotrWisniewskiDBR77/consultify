---
id: VLT-002
tytul: Vault — test negatywny prywatności + ostrzeżenie zmiany zakresu (DEC-003)
typ: zadanie
waga: wysoka
obszar: VLT
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "DEC-003 (warunek Piotra) + audyt origin/demo; przepisane z placeholdera D10b przez Mastera"
stare_id: D10b
utworzone: 2026-07-21
---

## 1. PROBLEM

Skoro dokument może być prywatny albo projektowy, musi być **twardo udowodnione**, że prywatny NIE wycieka — ani na liście, ani w odpowiedziach AI (RAG) innego użytkownika. A zmiana poziomu z prywatnego na organizacyjny musi ostrzegać, zanim odsłoni dokumenty. To warunek postawiony przez Piotra przy DEC-003.

## 2. PRZYCZYNA

Zadanie budowlane/bezpieczeństwa. Uwaga z audytu: keyword-retrieval `server/src/services/ai/knowledgeIndexer.ts:1030` dziś nie filtruje nawet po `organization_id` — dokładając poziom `user` do retrievalu trzeba domknąć filtr scope w WHERE JOIN-a (`:1034`, `knowledge_chunks JOIN knowledge_docs`). PUT `/documents/:id` (`server/src/routes/knowledge.routes.ts:821`) ma `requireSuperAdmin` → klient dostaje 403 przy edycji własnego dokumentu.

## 3. ROZWIĄZANIE

1. **Test negatywny prywatności (obowiązkowy):** dokument `scope=user` użytkownika A nie pojawia się (a) na liście `/documents` użytkownika B tej samej org, (b) w odpowiedzi AI/RAG użytkownika B. Domknij filtr scope w retrievalu (`knowledgeIndexer.ts:1034`).
2. **Ostrzeżenie zmiany zakresu:** przy podniesieniu poziomu prywatny→organizacja pokaż „X dokumentów stanie się widocznych dla całej organizacji" (liczba realna). Warunek DEC-003.
3. PUT `/documents/:id` — zdejmij `requireSuperAdmin` dla dokumentów własnych klienta (`scope=user AND owner_id=self`), inaczej edycja w Vault-kliencie zwraca 403.

## 4. KRYTERIUM ODBIORU

Piotr (albo Master w jego imieniu — bo OWNER bywa zwolniony z blokad) widzi dwie sondy na żywym demo: (a) użytkownik B pyta AI o treść z prywatnego dokumentu A → AI go nie zna / lista B go nie pokazuje; (b) zmiana poziomu prywatny→org pokazuje ostrzeżenie z liczbą, a po anulowaniu dokument zostaje prywatny. **Bez działającego testu negatywnego prywatności zadanie nie zostanie odebrane.**

## 5. DOWODY

Gałąź `feat/vlt-002-fix` (`96182ffa8c`, baza `feat/vlt-002-vault-privacy` → VLT-001). Nie pushowana. Pliki (+552/−4):
- `server/src/services/ai/knowledgeIndexer.ts` — filtr scope w RAG we WSZYSTKICH ścieżkach (bm25/vector/getContext/getContextKeyword + główna data-query), guard `hasScopeColumn()`.
- `server/src/services/ragService.ts`, `KnowledgeService.ts` (single-document lookup dla ownership).
- `server/src/routes/knowledge.routes.ts` (+133): `PATCH /:id/scope` (zmiana poziomu), `GET /:id/scope-impact` (ostrzeżenie „X dokumentów stanie się widocznych dla całej organizacji" — DEC-003), PUT zdjęte `requireSuperAdmin` dla własnych (`scope=user AND owner_id=self`).
- Testy `tests/backend/harvey-vault/vaultScopePrivacyList.test.ts` (3) + `vaultScopePrivacyRag.test.ts` (4).
**★ Zweryfikowane przez Mastera (vitest run, nie na słowo agenta): 7/7 PASS** — user B (ta sama org) NIE widzi prywatnego dokumentu user A ani na liście, ani w retrievalu RAG. esbuild node/esm zielone.
**Sonda HTTP live (3 poziomy + ostrzeżenie na demo) — CZEKA NA DEPLOY (Master).**

## 6. DZIENNIK

**2026-07-22 — przepisane przez Mastera z placeholdera D10b.** Zakres = warunek DEC-003 (ostrzeżenie + test negatywny prywatności) rozpisany na konkret z audytu `origin/demo`. Zależne od VLT-001 (potrzebuje działającego modelu poziomów). SSOT: `_SPEC_AGENT_VAULT_2026-07-22.md`.
**2026-07-22 — odblokowane (Master).** VLT-001 wykonane (gałąź `feat/vlt-001-vault-scope`, do-odbioru) — kod scope gotowy, wykonawca VLT-002 bazuje na tej gałęzi. Zależność [VLT-001] usunięta, stan zablokowane→otwarte.
**2026-07-23 — wykonane (dwie tury wykonawcy).** Pierwszy wykonawca dodał filtr RAG + testy, ale padł na watchdogu z luką (główna data-query bez filtra, 5/7 testów) — Master zabezpieczył WIP (`bb1c10b2bf`). Drugi wykonawca domknął lukę we wszystkich ścieżkach retrievalu (`96182ffa8c`). Zrobione wszystkie 3 pkt ROZWIĄZANIA: filtr RAG scope (test negatywny), ostrzeżenie zmiany zakresu (PATCH+scope-impact, DEC-003), PUT dla własnych. **Master zweryfikował vitest 7/7.** → do-odbioru. Sonda live po deployu.
