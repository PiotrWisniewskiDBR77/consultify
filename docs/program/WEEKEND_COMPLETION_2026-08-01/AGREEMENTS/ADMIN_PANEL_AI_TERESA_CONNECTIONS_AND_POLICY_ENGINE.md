---
doc_kind: AI_AND_INTEGRATION_CONTRACT
status: DRAFT_FOR_OWNER_REVIEW
owner: Piotr Wisniewski
last_updated: 2026-07-31
module: Admin Panel
---

# Admin — AI, Teresa, połączenia i silnik polityk

## 1. Jedna zasada konfiguracji

Polityka ma zakres i dziedziczenie: `platform ceiling → organization default → group/team/project override → user preference`. Niższa warstwa może zawęzić regułę; rozszerzenie ponad limit organizacji wymaga administratora właściwej domeny. UI zawsze pokazuje wartość efektywną oraz jej źródło.

## 2. AI & Teresa

Administrator konfiguruje:

- dopuszczonych providerów i modele oraz scenariusze, w których mogą działać;
- routing quality/cost/latency i bezpieczny fallback;
- miesięczne budżety organizacji, projektu, grupy i użytkownika, alerty oraz hard stop;
- zasady wysyłania danych, klasyfikację treści i maskowanie danych wrażliwych;
- retencję promptów, odpowiedzi, trace'ów, pamięci i plików;
- pamięć Teresy: dozwolone źródła, czas życia, prawo podglądu, korekty i usunięcia;
- narzędzia i działania: read, draft, propose, write-with-approval, forbidden;
- poziom autonomii per przypadek użycia i poziom ryzyka;
- wymagane cytowania, confidence, walidację wyniku, evaluacje i minimalny standard jakości;
- voice/transcription oraz przetwarzanie spotkań, jeśli organizacja je dopuszcza.

Model lub provider niedopuszczony przez platformę nie może zostać aktywowany w organizacji. UI nie może sugerować, że sam parametr temperatury tworzy bezpieczny system.

## 3. Klasy działań Teresy

- **Read** — wyszukiwanie i synteza w dozwolonym zakresie.
- **Draft** — przygotowanie treści/konfiguracji bez skutku biznesowego.
- **Propose** — propozycja zmiany z diffem, uzasadnieniem i wpływem.
- **Execute with approval** — wykonanie po zgodzie osoby z właściwą rolą.
- **Prohibited autonomous action** — role, billing, eksport całej organizacji, retencja, DLP, klucze, usuwanie, transfer własności i inne krytyczne operacje.

Trace zapisuje intencję, użyte źródła i narzędzia, model/politykę, approval, wynik oraz błąd bez ujawniania sekretów i zbędnych danych wrażliwych.

## 4. Connections

Admin widzi katalog integracji, ich kategorię, właściciela, zakres danych, przyznane scopes, region, status autoryzacji, ostatnią synchronizację, błędy i zależności. Ustanawia allowlistę providerów, domen, typów danych i kierunków synchronizacji.

Rozdział odpowiedzialności:

- Admin dopuszcza integrację i jej maksymalny zakres;
- użytkownik w Settings łączy osobiste konto OAuth w dozwolonych granicach;
- service account i integracja organizacyjna wymagają admina;
- Superadmin utrzymuje connector platformowy, sekrety systemowe i dostępność usługi.

Każde połączenie ma test, minimalne scope, odnowienie tokenu, disconnect, revoke, log synchronizacji, retry/dead-letter i informację, które funkcje przestaną działać po odłączeniu. MCP jest wspólnym sposobem wystawiania narzędzi, ale nie zastępuje consentu, polityki danych ani kontroli tenantów.

## 5. Policy change flow

`Draft → validate → simulate → impact preview → approve/reauthenticate → publish version → server read-back → monitor → rollback/supersede`.

Zmiana może być wdrażana report-only, na pilotażową grupę albo etapami. Konflikt reguł, rozszerzenie dostępu lub brak wymaganej zgody blokuje publikację. Rollback tworzy nową wersję wskazującą poprzednią — nie kasuje historii.

## 6. Obserwowalność i koszty

Administrator widzi koszt i wykorzystanie per model, przypadek użycia, projekt oraz trend; jakość, latency, błędy, fallbacki i odsetek odrzuconych propozycji. FinOps nie może ujawniać treści rozmów osobom posiadającym jedynie rolę billingową.

## 7. Kryteria odbioru

- polityka blokuje niedozwolony model także po bezpośrednim wywołaniu API;
- użytkownik nie może rozszerzyć scope integracji ponad limit organizacji;
- przekroczenie hard limitu ma przewidywalny fallback i komunikat;
- trace pozwala ustalić, co i dlaczego zrobiła Teresa;
- odłączenie integracji unieważnia token i zatrzymuje synchronizację;
- rollback nie usuwa historii wcześniejszej polityki.
