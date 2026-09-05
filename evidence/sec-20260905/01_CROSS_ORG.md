# KROK 1 — Trzy dziury cross-org: test + dowód mutacyjny

Wynik KROK 0: wszystkie trzy pozycje ("wnioski o uprawnienia", "kontekst AI"
×2 trasy, "wideo") są już zamknięte kodowo na HEAD `888e8a52b9`. "Wideo" nie
jest cross-org (patrz `00_POMIAR.md` #3) — pominięte tutaj, opisane w RAPORT.md.

Zamiast pisać test, który miałby być RED przed nieistniejącą jeszcze naprawą,
wykonano wymagany dowód w odwrotnej, ale równoważnej kolejności:
1. Test na realnym Postgresie, weryfikujący GREEN na HEAD (strażnik działa).
2. Mutacja USUWAJĄCA strażnik w warstwie serwisowej/repozytoryjnej (nie
   kontrolera) → uruchomienie testu → **RED**.
3. Przywrócenie kodu do stanu z HEAD (`cp` z kopii zapasowej, potwierdzone
   `git diff --stat` = pusto) → uruchomienie testu → **GREEN**.

Plik testu: `server/src/routes/__tests__/sec20260905.a52-and-cross-org.pg.test.ts`
(sekcje A i B). Baza: kontener `sec-org-test-pg` (pgvector/pgvector:pg16,
`127.0.0.1:54339/sectest`, jednorazowy, migracje `NODE_ENV=test tsx
server/scripts/migrate.postgres.ts`).

## 1. Wnioski o uprawnienia — `permissionRequests.routes.ts`

Strażnik: `permissionRequestBelongsToOrg()` (linie 19-28), użyty w
`PUT /:id/approve` (linia 85) i `PUT /:id/reject` (linia 107).

Komenda (GREEN, stan HEAD):
```
NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL="postgresql://postgres:test@127.0.0.1:54339/sectest" \
  JWT_SECRET="sec20260905-test-secret-not-real-do-not-use-anywhere-else" \
  npx vitest run src/routes/__tests__/sec20260905.a52-and-cross-org.pg.test.ts \
  -t "wnioski o uprawnienia" --retry=0
```
Wynik: `1 passed`.

Mutacja: `sed -i "s/if (!(await permissionRequestBelongsToOrg(id, req.user?.organizationId))) {/if (false \&\& !(...)) {/"`
na obu wystąpieniach → ponowne uruchomienie:
```
AssertionError: {"success":true}: expected 200 to be 404
```
(`PUT /api/permission-requests/:id/approve` przez OWNER org B na wniosku
org A zwróciło 200 zamiast 404 — obcy administrator mógłby zatwierdzić cudzy
wniosek). Przywrócono plik z kopii — `git diff --stat` puste — ponowny
uruchomienie: `1 passed`.

## 2. Kontekst AI — `context.routes.ts`

Strażnik: `contextBelongsToOrg()` (linie 18-29), użyty w `PUT /:id` (linia 86)
i `DELETE /:id` (linia 137).

Mutacja obu wywołań → RED:
```
AssertionError: {"success":true}: expected 200 to be 404
```
(PUT nadpisania cudzego kontekstu przeszedł 200 zamiast 404). Przywrócono —
`git diff --stat` puste — GREEN: `1 passed`.

## Wniosek

Obie ścieżki chronione są na poziomie handlera przez funkcję pomocniczą,
która odpytuje bazę o `organization_id` rekordu PRZED operacją zapisu —
to jest właściwa warstwa (nie da się jej ominąć inną trasą, bo obie funkcje
są jedynym miejscem odczytu rekordu przed mutacją). Dowód mutacyjny
potwierdza, że test rzeczywiście broni tego mechanizmu, a nie efektu
ubocznego.
