---
id: AGT-015
tytul: Jeden pasek na ekran — Run agent bez własnego Menu 2/3 (New agent, filtr, karta w Menu 3)
typ: zadanie
waga: wysoka
obszar: agent
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Piotr, 2026-07-27, żywe demo: „za dużo miejsca ucieka […] odzyskamy całą tę ogromną przestrzeń\""
utworzone: 2026-07-27
---

# AGT-015 — Jeden pasek na ekran (Run agent)

## 1. PROBLEM

Nad obszarem roboczym w Run agent stały CZTERY rzędy pasków, z czego dwa były
duplikatem huba. Do tego karta „Proces ofertowania" (idea otwarta wcześniej)
wisiała na zakładce Agenta, gdzie nie ma sensu. Cytat Piotra: „za dużo miejsca
ucieka […] po prawej stronie jest przycisk New process i My Processes/Templates
— new process należy wsadzić zamiast przycisku New w menu drugim […] a My
Processes/Templates mają sens na poziomie widoku tabeli, jak jestem w agencie
to już nie ma po co go pokazywać".

## 2. PRZYCZYNA

Run agent i Client Vault to dawne samodzielne moduły przeniesione do My Work
(AGT-003/VLT-004) RAZEM z ich własnymi `StandardModuleBar`. Hub ma swój
komplet Menu 2/3, one miały swój — stąd dwa piętra tego samego. Audyt
nawigacji zmierzył: **264 px** chrome w Run agent, **do 320 px** w Sejfie.
Dodatkowo `MyWorkHub.renderCommandRow` renderował karty `openDocuments` bez
sprawdzenia `activeTab` — stąd wyciek karty idei na zakładkę Agenta.

## 3. ROZWIĄZANIE

Mechanizm systemowy (decyzja Piotra: „ten konflikt trzeba będzie rozwiązać na
etapie całej aplikacji"): `src/components/shared/HubBarSlots.tsx` — ekran-dziecko
DEKLARUJE (`useHubBarSlot`), hub RENDERUJE (`useHubBar`). Zasada: na jednym
ekranie jest dokładnie jedno Menu 2 i jedno Menu 3, należące do najwyższego huba.

Dla Run agent: CTA „Nowy agent" (przemianowane z „Nowy proces" — wprost
polecenie Piotra) w Menu 2 huba; filtr „Moje procesy | Szablony" w Menu 2
i tylko na liście (znika przy otwartym agencie); karta otwartego agenta
doklejona do Menu 3 huba.

## 4. KRYTERIUM ODBIORU

Piotr wchodzi w My Work → Run agent: (a) nad tabelą są DWA rzędy pasków, nie
cztery; (b) przycisk dodawania nazywa się „Nowy agent" i stoi w tym samym
rzędzie co zakładki modułu; (c) przełącznik „Moje procesy | Szablony" widać na
liście, a po otwarciu agenta znika; (d) karta otwartego agenta pojawia się w
rzędzie kart (Menu 3), a nie w osobnym pasku; (e) karta „Proces ofertowania"
nie wisi już na zakładce Agenta.

## 5. DOWODY

- Gałąź `fix/menu-scalenie-pasków-agent-vault`, wdrożona na demo (`9ad8961163`,
  2026-07-27). Punkt cofnięcia: `2708c430c5`.
- Fundament: `src/components/shared/HubBarSlots.tsx` (kontekst + provider +
  `useHubBarSlot`/`useHubBar`); `MyWorkHub` rozdzielony na provider + Inner.
- Konsumpcja w hubie: `MyWorkHub.tsx` — `useHubBar()` (~708), `filterControls`
  w prawym klastrze Menu 2 (~3959), `primaryCta` wygrywa nad `actionButton`
  (~4251), `openItems` doklejone w `renderDynamicTabs` (~2532) tymi samymi
  klasami co karty huba.
- LEAK naprawiony: stała `OPEN_DOCUMENT_TABS` + gate w `renderCommandRow`
  i `renderDynamicTabs` — karty `openDocuments` tylko na tasks/ideas/decisions/inbox.
- `AgentHubShell.tsx`: usunięty `<StandardModuleBar>`, zastąpiony
  `useHubBarSlot` (~1067). Filtr tylko gdy `!activeItemId`; CTA tylko gdy
  `tab==='processes' && !activeItemId`.
- Bramki: esbuild czysty (3 pliki), eslint 0 błędów, check-list-canon ✓,
  check-triada ✓, `MyWorkHub.test.tsx` 18/18 PASS (uruchomione przez Mastera
  po scaleniu 193 commitów dryfu demo).
- Twarda weryfikacja diffu przed pushem: dokładnie 3 pliki, zero rozlewu.
- ★ OGRANICZENIE (jawnie): scalone Menu 2/3 NIE zostało zweryfikowane wzrokiem
  przed wdrożeniem — brak harnessu dev-render montującego cały MyWorkHub
  (harness `agent-hub` montuje AgentHubShell samodzielnie, więc sloty są tam
  no-opem). Wdrożone na WYRAŹNE polecenie Piotra („wdrażaj po prostu, daj mi do
  testowania") — świadome odstępstwo od reguły #7, decyzja właściciela.

## 6. DZIENNIK

- 2026-07-27 — Master: audyt nawigacji zmierzył koszt (264/320 px), zaprojektowany
  mechanizm HubBarSlots, wykonawca (Sonnet) wdrożył dla Agenta. Master doscalił
  193 commity dryfu demo (1 trywialny konflikt: obie strony dodały linię w tym
  samym miejscu — wzięte oba), zweryfikował bramki i testy, wdrożył. Stan →
  do-odbioru.
- 2026-07-28 — Master: DŁUGI (a)-(d) DOMKNIĘTE, gałąź `fix/menu-dlugi-domkniecie`
  na demo (`dca93b85c0`). (a) bulk — decyzja PODTRZYMANA, zostaje poza slotem
  (uzasadnienie w kodzie: warunkowy, dotyczy jednej tabeli, w slocie oderwałby
  się wizualnie od niej; drugi konsument slotu bulk-bara nie ma — rozbudowa
  kontraktu pod jednego konsumenta byłaby spekulacyjna). (b) ikona CTA
  przywrócona — `HubBarPrimaryCta.icon` 1:1 kontrakt `StandardPrimaryCta`,
  `PlayCircle` odtworzona z wersji przedmigracyjnej (`401ea601c1^`).
  ★ Premisa „natywne `actionButton` huba ma ikonę" NIE potwierdziła się —
  per-tab CTA MyWorkHub nigdy ikony nie miały; pole dodane jako opcjonalne,
  zero regresji. (c) empty-state ujednolicony na „Nowy agent"
  (`agentPlan.hub.newAgent`); `newProcessTitle` = tytuł tworzonego planu,
  świadomie nietknięty. (d) Client Vault zmigrowany osobno (VLT-008).
- PONADTO: `window.prompt` (nazwa → poziom cyfrą → projekt numerem z listy)
  zastąpiony wspólnym `src/components/shared/FolderCreateDialog.tsx` —
  nazwa + poziom prywatny/projektowy/organizacyjny + SELECT projektu;
  tryb `fixedScope` dla Sejfu (poziom narzucony przez sejf, dialog pyta tylko
  o nazwę). API backendu niezmienione.
- ★ BUG ZŁAPANY W RENDER-VERIFY, NIE PRZEZ BRAMKI: walidacja dialogu wymagała
  `projectId` przy `scope==='project'` NIEZALEŻNIE od trybu — w Sejfie
  (`fixedScope`, brak UI wyboru projektu) przycisk „Utwórz folder" był TRWALE
  WYSZARZONY. Naprawiony przed wdrożeniem. Kolejny dowód: zielone bramki ≠ działa.
- ★ OGRANICZENIE PODTRZYMANE: D1/D2/D4 obejrzane w dowodowym harnessie
  `?screen=menu-dlugi-domkniecie` z REALNYM `HubBarSlotsProvider` i Menu 2
  skopiowanym 1:1 z `MyWorkHub.tsx` — ale NIE w żywym `MyWorkHub` (4152 linie,
  zbyt kosztowny do zamockowania). Zrzuty PL/EN, jasny/ciemny, 1440×900.
  Standardowy harness `?screen=agent-hub` montuje ekran BEZ providera, więc
  całe Menu 2 jest tam niewidoczne — potwierdzone zrzutem, nie założone.
- ★ DŁUG ŚWIADOMY (stan pierwotny, dla historii): (a) `bulk` Agenta poza kontraktem slotu — renderowany
  lokalnie nad tabelą; (b) ikona CTA zgubiona (`HubBarPrimaryCta` bez pola
  `icon`); (c) „Nowy proces" w empty-state vs „Nowy agent" w CTA. (d) Client
  Vault NIE jest jeszcze zmigrowany — ta sama zmiana czeka na osobne zadanie.
