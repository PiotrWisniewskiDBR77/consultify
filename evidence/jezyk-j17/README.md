# J17 — dowód: serwer wysyła kody, ekran nadaje język

Stanowisko: gałąź `mvp/jezyk-j17-serwer-kody`, baza gałęzi `59f92c2330`,
API `127.0.0.1:4177`, Vite `127.0.0.1:3197`, baza `consultify_kopia_final`
(Postgres 18, kontener `consultify-pg18`), konto `audyt@dbr77.local`
(język przełączany `UPDATE users SET language=…`, przywrócony na `pl`).
Zrzuty 1440×900, motyw jasny. Harness: `scripts/dev/j17/zrzuty.mjs`.

## Pliki

| Plik | Co pokazuje |
| --- | --- |
| `en-01-rejestr-inicjatyw.png` / `pl-01-…` | rejestr Inicjatyw: nagłówki kolumn, statusy, bramki, gotowość, „Next action", „Expected impact / Confidence" |
| `en-02-podglad-inicjatywy.png` / `pl-02-…` | podgląd wiersza: właściwości + **powód blokady** („Start execution: An accepted handoff and a start date are required." / „Rozpocznij realizację: Wymagany przyjęty handoff i termin startu realizacji.") |
| `en-04-realny-4xx.png` / `pl-04-…` | **realny błąd 4xx z serwera** obok surowej odpowiedzi HTTP |
| `en-04-realny-4xx.json` / `pl-04-…` | ta sama odpowiedź jako dane |
| `en-05-generator-planu.png` / `pl-05-…` | Inicjatywy → Obciążenie (analizy planu) |
| `en-06-ocena-inicjatywy.png` / `pl-06-…` | Ocena → Inicjatywy (druga powierzchnia tej samej tabeli) |
| `MUTACJE.md` | 3 mutacje = 3× RED + sprawdzona premisa czerwonego testu spoza J17 |
| `*-konsola.txt`, `*-api-4xx.txt` | konsola i odpowiedzi ≥400 z sesji zrzutowej |

## Rdzeń dowodu — jedna odpowiedź serwera, dwa języki na ekranie

`PATCH /api/knowledge/documents/:id/scope`, body `{"scope":"zle"}` → **HTTP 400**.
Serwer w OBU przypadkach odsyła to samo (pole `error` zostaje dla dziennika):

```json
{"errorCode":"VAULT_SCOPE_INVALID","code":"VAULT_SCOPE_INVALID",
 "error":"scope musi być jednym z: user, project, organization"}
```

Na ekranie:

* konto EN → `scope must be one of: user, project, organization.`
* konto PL → `scope musi być jednym z: user, project, organization.`

To jest cała teza J17 w jednym pomiarze: **język komunikatu nie zależy już od
tego, w jakim języku router napisał zdanie.**

## Konsola

5 wpisów w każdej sesji, **wszystkie sieciowe**, zero błędów JavaScriptu:
4 × `404` z wyłączonych tras `/api/v8/*` (`V8_DISABLED` — stan środowiska,
nie J17) i 1 × `400` z celowego wywołania dowodowego powyżej.

## Co na tych zrzutach jest jeszcze po polsku w wersji EN (poza J17)

Zakładki Menu 2 („Inicjatywy / Plan / Obciążenie") i chip „Wszystkie” —
to kategoria **K4pl** (tekst na sztywno w JSX), czyli paczka **J6**, nie J17.
Zostawione świadomie, żeby nie robić konfliktu w `InitiativesHub.tsx`
z równolegle idącą paczką modułową.
