---
doc_id: application-fragment-inventory
truth_type: runtime-current
status: working
owner: codex
last_reviewed: 2026-07-30
---

# Inwentaryzacja fragmentacji

## Pomiar startowy

Skan heurystyczny kodu `src/` i `server/src/`:

- ok. 2 760 plików zawiera co najmniej jeden marker: `legacy`, `deprecated`,
  `coming soon`, `placeholder`, `mock`, `stub`, `fallback`, `V8`, `V10`,
  `not implemented` lub `TODO`;
- 369 ścieżek frontendowych odpowiada wzorcom `Hub`, `View`, `V8`, `V10`,
  `Legacy`;
- istnieje `server/src/_backup`;
- `AppRoutes.tsx` zawiera dużą warstwę zgodności, aliasów, flag i redirectów.

To są kandydaci do analizy, nie lista 2 760 błędów.

## Mapa ryzyka według menu

| Moduł | Zaobserwowany typ fragmentacji | Priorytet audytu |
| --- | --- | --- |
| Chat | Unified Chat, Canvas/V10, legacy Canvas route, proposal/action layers | P0 |
| My Work | wiele zakładek, Vault i Agent przeniesione z osobnych wejść | P0 |
| Interview | `/interview` i `/discovery`, starsze Discovery views | P0 |
| Tools | DiscoveryToolsHub, ToolWizard/Document/KnownTool, panele V8 | P0 |
| Assessment | hub, editor, import, raporty i alias licensed-tools | P0 |
| Initiatives | hub/portfolio/roadmap/ROI i starsze Full views | P0 |
| Execution | `FullExecutionView`, `ExecutionHub`, implementation/rollout aliasy | P0 |
| Results | ResultsHub/BenefitsHub/KPI alias i ROI surfaces | P1 |
| Finance | FinanceHub, stary widok, V8 i fallback legacy | P1 |
| Materials | Outputs/Documents/Tables/Presentations, wiele studiów i redirectów | P0 |
| Audits | route/hub beta, DRD report i assessment overlap | P1 |
| Meeting | placeholder oraz istniejące ślady runtime V3 | CONCEPT/P2 |
| Organization | `/organization/*` i wygaszane `/context/*` | P1 |
| Admin Panel | admin vs rozbudowany SuperAdmin | P0 security |
| Settings | user settings vs org policy/admin settings | P1 |
| Partner Portal | protected portal i public acquisition/legacy routes | P1 |

## Pierwsze potwierdzone rozjazdy

1. Execution ma równoległe starsze i nowsze powierzchnie.
2. Materials zachowuje kilka generatorów/studiów, flag i aliasów.
3. Interview posiada kanoniczny hub oraz starsze nazewnictwo Discovery.
4. Assessment dzieli historię z Licensed Tools.
5. Canvas ma istotne komponenty, ale brak pełnego zaakceptowanego pionowego
   przepływu.
6. Organization utrzymuje redirecty ze starego Context Buildera.
7. MCP posiada komponenty/trasy historyczne, ale nie należy do menu.
8. część komponentów pozostaje w kodzie celowo dla backward compatibility,
   mimo że nie jest montowana jako kanoniczny runtime.

## Wymagany następny pomiar

Dla każdej funkcji potrzebny jest generowany rekord:

- trasa i AppView;
- montowany komponent;
- alternatywne komponenty;
- wywoływane API;
- backend guard;
- owner service;
- tabele/encje;
- testy;
- flaga;
- mock/fallback;
- decyzja: keep/merge/redirect/archive/remove.
