# Następna poprawka: CLOSED initiative emituje autoPUT403

Status: przygotowana kolejka, NIE WYDANA do implementacji (sloty Interview+C6 zajęte). Źródło objawu: niezależny C4E3 browser before/after, dwa autoPUT403 na CLOSED w obu fazach, widoczne UNSAVED. Zachować realny log/harness E3; nie traktować poniższej hipotezy źródłowej jako reprodukcji.

Baza przeglądu: kandydat251a15c9f3. `src/components/Initiatives/InitiativeDocumentView.tsx`: canEditCards1520–1521 pochodzi z backend capabilities+readMode; effect3795–3807 planuje handleSave przy hasSavableChanges bez capability gate; handleSaveRuntimeOnlyMetadata3400 osłania tylko title/owner, nie summary/description; zwykły save payload około3500 wysyła zawartość kart, guard3517 dotyczy tylko title. Runtime-only metadata ma osobną legalną ścieżkę canonical i nie wolno przywrócić starej pętli404.

Wykonanie po zwolnieniu slotu:
1. Pełny kontrakt capabilities dla kart/topbar/lifecycle, istniejące source i behavioral tests. Odtworzyć otwarcie CLOSED bez edycji i odczekać co najmniej dwa debounce; wskazać, które flagi stają się dirty i dlaczego (normalizacja/draft hydration vs prawdziwa edycja).
2. RED rzeczywistego renderu/HTTP: readonly CLOSED nie ma PUT/PATCH ani fałszywego UNSAVED po hydration; nie usuwać dirty-check globalnie. Druga próba: odebranie capability podczas oczekiwania debounce nie wykonuje starego zapisu. Trzecia: dozwolona edycja karty/topbar zapisuje, reload odczytuje wynik. Osobno runtime-only metadata zachowuje canonical writer i wersję.
3. Poprawić źródło fałszywej zmiany oraz spójnie uprawnienia efektu i wykonania save. Nie wystarczy ukryć403/toast ani dodać canEditCards do wszystkiego: topbar ma niezależne capability i trzeba zachować legalne zapisy.
4. Realny UI/API/JWT/PG na istniejących własnych zasobach, CLOSED/readMode/authorized-edit/capability-change, ten sam rekord po reload i SQL no-write tam gdzie odmowa. Niezależny reviewer i oddzielny commit z wymaganymi markerami.

Nie zmieniać danych105inicjatyw ani lifecycle backendu, nie puszczać na live. Test tekstu źródła nie jest głównym dowodem.
