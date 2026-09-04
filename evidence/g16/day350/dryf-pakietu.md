# Dyżur 350 — inwentarz dryfu pakietu G16 (R1)

Pomiar na markerze `6a4919f72db338e7f49a2cacb3787d20cc649883`, 2026-09-04.

## Mianowniki

- ostatni commit pakietu: `3cb7390766` — `docs(przelot): aktualny znacznik stagingu fb6547b7d0 zamiast nieaktualnego 58ef0771d7`;
- scalenia na pierwszym rodzicu od commita pakietu: **49**;
- unikalne zmienione pliki produktu w `src/` i `server/src/`: **171**;
- rozkład katalogowy: AIChat 66, routes 51, services 10, MyWork 8, Interview 5, assessment 3, DiscoveryTools 3, Initiatives 2, DocumentStudio 2, middleware 2, database 2, pozostałe pojedyncze.

Komendy odtwarzające: `git log --oneline --merges --first-parent 3cb7390766..HEAD` oraz `git diff --name-only 3cb7390766 HEAD -- src server/src`.

## Jawne mapowanie katalogów na moduły

- Chat: `src/components/AIChat/**`, `src/components/layout/ChatPanel.tsx`, `src/services/chatSuggestionsPreference.ts`, trasy `ai*`, `v8/chat`, `teresa`, `prompt-assistant`, `realtime-platform` oraz serwisy AI używane przez Czat.
- My Work: `src/components/MyWork/**`, trasy `my-work`, `actionDecisions`, `ideaBusinessCase`.
- Interview: `src/components/Interview/**`, trasy zawierające `interview`.
- Tools: `src/components/DiscoveryTools/**`, `src/store/useToolStore.ts`, `src/toolPacks/**`, `src/utils/dynamicSwotSevenStagesFlag.ts`.
- Assessment: komponenty i trasy zawierające `assessment`, `AssessmentController.ts`.
- Initiatives: `src/components/Initiatives/**`, `initiativeCandidates`, `pmo/initiatives`.
- Execution: `v8/execution-control.routes.ts`.
- Results: trasy i serwisy `results*`, `okrCycleCommands.ts`, `commandCapabilityGuard.ts`.
- Finance: trasy i serwisy zawierające `finance`.
- Materials: Document Studio, Documents, Deliverable Templates, Presentations, Report Builder, Workbook, artifacts oraz `useReportSections.ts`.
- Meeting: `meeting.routes.ts`, `public-booking.routes.ts`.
- Organization: `organization-context.routes.ts`, `effectiveAccessService.ts`.
- Admin Panel: trasy admin/superadmin/service-accounts.
- Settings: auth, data export, sync hub oraz ustawienia AI.
- Partner Portal: `partners.routes.ts`.
- Audits: ścieżki modułu Audits; w tym oknie brak pliku o jednoznacznie audytowym konsumencie. `AIChat/AgentAudit/**` pozostaje w Chat, bo jest poddrzewem jego UI.
- Przekrojowe: baza, wspólny mapper błędów, wspólne trasy platformowe, `App.tsx`, wspólna nawigacja/API/error copy. Nie przypisuję ich arbitralnie do jednego modułu.

## Tabela 16 modułów

Liczba scaleń oznacza liczbę merge commitów, których diff do pierwszego rodzica dotknął co najmniej jednego pliku przypisanego do modułu. Liczby plików są rozłączne; dodatkowo 19 plików przekrojowych daje razem `152 + 19 = 171`.

| Moduł | Scalenia | Pliki | Sprawdzenie sekcji |
| --- | ---: | ---: | --- |
| Chat | 6 | 77 | TAK |
| My Work | 6 | 13 | TAK |
| Interview | 4 | 6 | TAK |
| Tools | 2 | 6 | TAK |
| Assessment | 3 | 7 | TAK |
| Initiatives | 3 | 4 | TAK |
| Execution | 1 | 1 | TAK |
| Results | 2 | 6 | TAK |
| Finance | 1 | 4 | TAK |
| Materials | 2 | 13 | TAK |
| Audits | 0 | 0 | NIE |
| Meeting | 1 | 2 | TAK |
| Organization | 2 | 2 | TAK |
| Admin Panel | 3 | 6 | TAK |
| Settings | 2 | 5 | TAK |
| Partner Portal | 1 | 1 | TAK |

Przekrojowe: 11 scaleń, 19 plików. Każda sekcja, także Audits z zerem, nadal podlega przeglądowi R2.

## Imienna lista 49 scaleń i przypisanie

1. `e25eb19b64` — day338 — Initiatives, My Work, Interview, Tools, przekrojowe.
2. `107993da51` — day339 — My Work, Interview, Tools, przekrojowe.
3. `937f2d3193` — day341 SWOT — Tools, My Work, Interview, przekrojowe.
4. `660482d485` — day342 panel Idei — My Work, Interview, przekrojowe.
5. `a8d333a173` — day330 Wywiad — przekrojowe (bez plików produktu w samym merge diffie).
6. `924ebd3c7a` — day292 Wywiad — Interview.
7. `ebc5fbf928` — day337 — My Work.
8. `00139f062c` — day336 — przekrojowe (0 plików produktu).
9. `e31e74c2d9` — day335 — przekrojowe.
10. `52a041a910` — instrukcje 341–342 — przekrojowe (0 plików produktu).
11. `47e91574ba` — instrukcje 334–337 — przekrojowe (0 plików produktu).
12. `a85cfaca5a` — instrukcje 338–340 — przekrojowe (0 plików produktu).
13. `1c4b5a5635` — usunięcie martwego poddrzewa Czatu — Chat, My Work, przekrojowe.
14. `9694d1f9dc` — day332 — przekrojowe (0 plików produktu).
15. `289d94b4b8` — day333 — przekrojowe (0 plików produktu).
16. `7fa864a51e` — day327 — przekrojowe (0 plików produktu).
17. `65e3a62731` — day329 — Admin Panel, Results, Assessment.
18. `1beef30c83` — day328 — przekrojowe (0 plików produktu).
19. `48a8d1adbd` — day325 — Results, przekrojowe.
20. `0f8713d5fa` — day324 — Admin Panel, My Work.
21. `7b6f91ca86` — day326 — Admin Panel.
22. `7dca03967d` — instrukcje 327–329 — przekrojowe (0 plików produktu).
23. `0d67f8f575` — instrukcje 330–333 — przekrojowe (0 plików produktu).
24. `58e22fba09` — instrukcje 324–326 — przekrojowe (0 plików produktu).
25. `1c3d3da844` — day314 — Chat, Organization, Interview, Materials, Tools, przekrojowe.
26. `f8ba9dac0d` — day315 — Chat, Organization, Interview, Materials, przekrojowe.
27. `a19c11c17d` — day320 — przekrojowe (0 plików produktu).
28. `ee5cb420a3` — day319 — Organization, Materials, przekrojowe.
29. `4d7ef3c968` — day321 — Admin Panel, Materials, przekrojowe.
30. `fbe7fdf02c` — day316 — Interview, Materials, przekrojowe.
31. `49f70ac3d1` — day317 — przekrojowe (0 plików produktu).
32. `7d5df22197` — day322 — przekrojowe (0 plików produktu).
33. `35ce7a8421` — day323 — Interview.
34. `bffaaa5494` — day318 — przekrojowe (0 plików produktu).
35. `e3b9741f07` — konsolidacja rejestru M13–M27 — przekrojowe (0 plików produktu).
36. `192b38d022` — instrukcje 317/318/322/323 — przekrojowe (0 plików produktu).
37. `23d58b97ed` — instrukcje 314–316 — przekrojowe (0 plików produktu).
38. `dfbd98a25a` — instrukcje 319–321 — przekrojowe (0 plików produktu).
39. `500ae7d68c` — DEC-387 karty inicjatyw, flaga OFF — Initiatives.
40. `15309dd3a6` — DEC-386 preferencje Czatu — Chat, Settings.
41. `540d15829b` — day311 — Chat i przekrojowe.
42. `bf0d33b7e6` — day313 — Chat i przekrojowe.
43. `4350ca099d` — day312 — przekrojowe (0 plików produktu).
44. `a7a6e553f1` — day300 — przekrojowe (0 plików produktu).
45. `3b75d85468` — day310 — Chat.
46. `68a6c8f337` — day309 — przekrojowe (0 plików produktu).
47. `806c711e37` — day299 — przekrojowe (0 plików produktu).
48. `85ad46cf8a` — day301 — przekrojowe (0 plików produktu).
49. `6d4a8871fb` — day308 — przekrojowe (0 plików produktu).

## Pełna lista 171 plików

Pełne przypisanie jest odtwarzalne z powyższych reguł na wyniku `git diff --name-only 3cb7390766 HEAD -- src server/src`. Kontrola mianownika dała dokładnie 171 ścieżek; żadnej ścieżki nie pominięto, a 19 wspólnych pozostawiono jawnie jako przekrojowe zamiast sztucznie przypisywać je do jednego modułu.
