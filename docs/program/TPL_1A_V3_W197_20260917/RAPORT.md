# TPL-1a v3 — raport zmiany

Paczka naprawia kontrakt trzech baz systemowych w Bibliotece wzorców. Źródłem opisu, statusu i
struktury jest przy odczycie bieżący rejestr kanoniczny, dzięki czemu stare wpisy indeksu nie
pokazują pustych kart po uzupełnieniu seedów. Status zaakceptowanego decka pozostaje
`approved`.

Akcja `Duplicate` przestała być nawigacją do oryginału. Tworzy nowy dokument, prezentację albo
workbook przez właściwy runtime. Arkusz nie ma jeszcze uczciwej operacji `Use`, dlatego ta akcja
jest wyłączona z wyjaśnieniem, a użytkownik może wykonać działające `Duplicate`.

Tabela chroni pełne wartości zakresu, statusu i daty po otwarciu prawego panelu. Galeria trzyma
cztery akcje w jednym rzędzie. Importery testowe zostały przeniesione do obecnego kontraktu, w
którym przełącznik Galeria/Tabela oraz filtry należą do Menu 2/3 Huba.

Etap 2 potwierdził zachowanie na lokalnej kopii stagingowej bazy: trzy bazy są `approved`, mają
opisy i realne struktury, a Hub EN pokazuje je w light/dark 1440×900. Podczas pomiaru wykryto i
naprawiono ściskanie galerii do trzech kolumn przy otwartym preview, które obcinało akcje hover.
Szczegóły i dowody są w `RECEIPT.md`.
