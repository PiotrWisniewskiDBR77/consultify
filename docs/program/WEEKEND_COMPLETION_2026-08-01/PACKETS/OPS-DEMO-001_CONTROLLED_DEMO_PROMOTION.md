---
doc_id: ops-demo-001-controlled-demo-promotion
truth_type: operations
status: ready
owner: codex
product_owner: piotr
last_reviewed: 2026-08-01
---

# OPS-DEMO-001 — kontrolowana promocja na Railway demo

## Cel

Wdrożyć zaakceptowany fundament MVP na jedyne środowisko odbiorowe:
Railway project `consultify`, environment `demo`, service `consultify`,
`https://demo.consultify.ai`. Produkcja `consultify.ai` i environment `production`
są bezwzględnie poza zakresem.

## Rewizje

- obecny deployment `demo`: `a6cc28c3-1a53-4cc2-931a-1902536ef5f8`;
- obecny commit `demo`: `af62da5a6e3e56d53a7243716878bb523c023ad1`;
- kandydat: HEAD gałęzi `codex/sync-demo-20260729`, po przejściu bramek;
- sposób promocji: wyłącznie fast-forward `HEAD → origin/demo`;
- zakaz `force push`, rebase zdalnego `demo` i `railway up` z brudnego worktree.

## Zakres danych i recovery

- różnica nie zawiera migracji, zmian schematu, `railway.json`, Dockerfile ani lockfile;
- sam deploy nie upoważnia do uruchomienia seedów, importów ani golden flows
  mutujących dane;
- rollback aplikacji: ponowne wdrożenie poprzedniego deploymentu lub poprzedniej
  rewizji `af62da5a6e`;
- przed pierwszym stagingowym testem mutującym wymagane są namespaced fixture,
  cleanup i osobny dowód recovery bazy odpowiedni do ryzyka testu.

## Bramka przed promocją

- Railway context odczytany jako project `consultify`, environment `demo`;
- `demo` i zależne usługi mają status `SUCCESS`, `/ping` zwraca `pong`;
- `demo` jest przodkiem kandydata — fast-forward możliwy;
- frontend typecheck: PASS;
- backend build: PASS;
- frontend production build: PASS przy `NODE_OPTIONS=--max-old-space-size=8192`;
- UI, SSOT i links gates: PASS;
- Artifact program: `158/158 PASS`;
- routing + Execution/Initiatives targeted suite: `164/164 PASS` po usunięciu
  nieaktualnych oczekiwań `/portfolio`, `/dashboard` i starego AppView.

## Bramka po promocji

1. nowy deployment service `consultify` kończy się `SUCCESS`;
2. commit wdrożenia jest równy kandydatowi;
3. `https://demo.consultify.ai/ping` zwraca `pong`;
4. bounded runtime logs nie zawierają nowego fatal/crash loop;
5. publiczne wejście i krytyczne trasy odpowiadają bez `5xx`;
6. dopiero po spełnieniu 1–5 można rozpocząć uwierzytelnione golden flows;
7. każde odstępstwo kończy się `FIX` lub rollbackiem, nigdy pozornym `GO`.

## Stan

`READY` — zezwala wyłącznie na promocję `demo` i jej read-only smoke. Nie zezwala
na produkcję, migracje, zmianę zmiennych ani testy mutujące PostgreSQL.
