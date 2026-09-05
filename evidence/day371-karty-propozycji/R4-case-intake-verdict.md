# R4 — Case Intake: werdykt B

`case_intake_proposal` występował wyłącznie w martwej gałęzi renderera i w
samym komponencie karty. W kodzie produkcyjnym nie ma producenta metadanych
tego typu. Komentarz komponentu również deklarował, że podłączenie wymaga
zmiany w miejscu składającym odpowiedź asystenta, poza licencją `AIChat/**`.

Werdykt: **B — usunięcie martwego UI**. Usunięto import, nieosiągalną gałąź
`MessageRenderer` i nieużywany `CaseIntakeConfirmCard`. Nie zmieniono backendu
Case Intake, kontraktu ani orkiestracji czatu i nie dodano flagi.

Pomiar reachability przed i po zachowano w artefaktach dyżuru. Zmiana usuwa
plik osiągalny wcześniej wyłącznie przez martwą gałąź; nie zwiększa zbioru
`test-only` ani `unreachable`.
