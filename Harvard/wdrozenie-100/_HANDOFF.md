# ZLECENIE — czytaj TYLKO ten plik, potem od razu buduj

## STOP — czego NIE robić (to zabija turę)
- **NIE rób archeologii gita** (`git log/blame/diff/show` „żeby zrozumieć historię"). Wszystkie dzisiejsze commity są NASZE (sesja planistyczna). **Nie ma drugiego programisty. Nikt nie pracuje równolegle.** Repo jest spójne — bierz working tree jak jest.
- **NIE pisz nowych dokumentów, audytów, teczek, raportów.** Wiedzy jest nadmiar. Jak łapiesz się na pisaniu `.md` zamiast kodu — przestań.
- **NIE czytaj 27 teczek.** Jeśli czegoś potrzebujesz o module — zajrzyj do JEDNEJ teczki tego modułu, nic więcej.
- **NIE planuj fazami, nie rób list, nie pytaj „od czego zacząć".** Zadanie jest niżej. Rób je.

## Twoje zadanie (jeden przepływ, do końca)
> Domyślne zadanie poniżej. **Jeśli Piotr w pierwszej wiadomości poda inny moduł/przepływ — rób TAMTEN.** Inaczej rób to. Nigdy nie czekaj bezczynnie.

**Moduł:** M13 Inicjatywy · **Przepływ:** *„Tworzenie inicjatywy z huba"*.
**Problem (realny):** w `src/components/Initiatives/InitiativesHub.tsx` trzy przyciski tworzenia („Nowa inicjatywa", „AI Wizard", „Charter") są **na sztywno disabled** — komponenty/modale istnieją i działają (deep-link `/initiatives?new=1` otwiera działający modal jako wzorzec). Trzeba wpiąć te 3 CTA w istniejące handlery/modale (czysty front, bez backendu).
**Done (testowalne):** klikam „Nowa inicjatywa" w hubie → otwiera się modal → wypełniam → zapis → **inicjatywa pojawia się w portfolio** (po reloadzie trwała). To samo dla AI Wizard i Charter (albo, jeśli któryś bez sensu w v1 — świadomie ukryj, zero „martwego" przycisku).
**Zakres:** tylko ten przepływ. Nie ruszaj statusów/bramek (#14), AI-fill (#16), i18n — to osobne przepływy na później.

## Jak przetestować NA ŻYWO (obowiązkowe przed „done")
Środowisko jest gotowe — testujesz świeży kod lokalnie na bazie nie-prod (trolley), NIE na prod:
1. **Start:** `npm run dev` (to `dev:staging`: frontend `localhost:3000` + backend `:3001` → trolley; centerbeam/prod jest pomijany). Sprawdź `curl localhost:3001/api/health` → `database: connected`.
2. **Login (bez hasła):** mint JWT dev-secretem (`JWT_SECRET` z `.env`), payload `{id,email,role,organizationId,jti}` (jsonwebtoken jest w `server/node_modules`). User: `piotr.wisniewski@dbr77.com`, id `d2b6a316-08c5-47cf-9bf7-4ba50311d5a2`, role `OWNER`, org `a3e05d4a-5397-419d-b486-8e44366c0063`. Wstrzyknij do `localStorage.token` na `localhost:3000` (Claude_in_Chrome `javascript_tool`). Reload → jesteś zalogowany.
3. **Klikaj scenariusz** (Claude_in_Chrome: navigate/click/type/screenshot) + czytaj konsolę/network. **Zrób screenshot działającego przepływu** = dowód.
4. Jak coś zepsute → czytaj kod → popraw → powtórz, aż działa.

## Po „done"
- Commit na `Londyn` (jesteśmy na tym branchu). Zwięzły message.
- Krótki wynik dla Piotra: 1–2 zdania + screenshot. Bez raportów-elaboratów.
- Pytaj o następny przepływ. Jeden na raz.

## Zasady (umowa)
Jeden moduł/przepływ → zbuduj → test na żywo → screenshot → odbiór. „Działające-surowe" > „idealne-niewdrożone". Drobne decyzje: weź rozsądny default i jedź, zaloguj wybór, nie blokuj.
