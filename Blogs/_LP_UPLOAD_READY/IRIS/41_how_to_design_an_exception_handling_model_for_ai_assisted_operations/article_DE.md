# Wie man ein Exception-Handling-Modell fuer KI-unterstuetzte Operationen entwirft

Target persona: Operations-Architekt / Leiter Werksengineering / Owner Qualitaetssysteme  
Funnel stage: Consideration  
Core problem: KI-Assistenz erhoeht das Ereignisvolumen, aber Werke routen Exceptions weiter ueber informelle Chats, sodass Response-Ownership und Abschlussloops unklar bleiben  
Main promise: ein kompaktes Exception-Modell mit typisierten Pfaden, Schwellen, Freigaben und Audit-Feldern, das Vorgesetzte unter Last bedienen koennen

**Direct answer:** Entwerfen Sie Exception-Handling fuer KI-unterstuetzte Operationen, indem Sie jedes Assist-Ergebnis einem von vier Pfaden zuordnen: Auto-Task innerhalb Policy, nur Advise mit Human-Claim, Eskalation mit Pflicht-Owner und SLA, oder Hard-Stop bis Freigabe. Definieren Sie pro Pfad Trigger, wer ueberschreiben darf, welche Pflichtfelder gelten und wie Abschluss belegt wird. Veroeffentlichen Sie das Modell neben Workflow-Maps, damit Schichten nicht improvisieren. Ein Modell ohne benannte Owner und Timeboxes ist nur ein Diagramm.

Unterstuetzte Operationen scheitern selten am Tag-eins-Modell.

Sie scheitern, wenn Exceptions ein zweiter Schattenprozess werden.

## Warum Exceptions hochgehen, wenn Assistenz live geht

Assistenz hebt Grenzfaelle hervor, die Menschen frueher still absorbierten.

Sie sehen:

- mehr Task-Kandidaten mit unvollstaendigem Kontext  
- mehr Nahe-Schwellen-Signale, die zwischen Funktionen divergieren  
- mehr "fast auto"-Routen, die einen Human-Stamp brauchen  

Ohne Exception-Layer entwirft die Flaeche ihn per Telefon.

## Framework: vier Exception-Pfade (einer pro Ereignistyp)

| Pfad | Wann | Pflicht-Record | Abschluss-Nachweis |
|---|---|---|---|
| Auto-Task | innerhalb veroeffentlichter Schwellen und Policy | Task-ID, Regelversion, Zeitstempel | abgeschlossener Workorder oder verifizierter Zustand |
| Nur Advise | nuetzliches Signal, Human muss claimen | Suggestion-ID, Claim-Owner, Grund bei Reject | explizites Dismiss oder Convert-to-Task |
| Eskalation | SLA-Risiko, Safety, Quality-Hold, Funktionskonflikt | Eskalationsstufe, Owner, Faelligkeit | Resolution-Note mit Ursprungssignal |
| Hard-Stop | Regulatorik, Kunden-Lock oder unreife Daten | Freigabe-Rolle, Evidence-Link, Release-Kriterien | signiertes Release oder versionierte Regelaenderung |

Wenn in der Praxis ein fuenfter Pfad auftaucht ("frag den Engineer"), ist das Modell unvollstaendig.

## Checkliste: Mindestdefinitionen vor Go-Live

1. Exception-Taxonomie: False Positive, fehlende Daten, Policy-Konflikt, Safety, Kunde, Lieferant  
2. Ownership-Matrix: wer ist First Responder pro Typ pro Schicht  
3. Eskalationsleiter: zeitbasierte Stufen, nicht persoenlichkeitsbasiert  
4. Freigaberegeln: welcher Pfad braucht welche Rolle, inkl. Stellvertretung  
5. Uebergabefelder: was die naechste Schicht im System sehen muss, nicht auf Papier  
6. Rollback-Hook: wie assistiertes Routing pausieren ohne Audit-Trail zu verlieren  
7. Post-Incident-Loop: wann Exceptions Schwellen- oder Trainingsaenderung erzwingen  

## Vergleich: Ticket-Kultur versus Abschluss-Kultur

| Signal | Ticket-Kultur | Abschluss-Kultur |
|---|---|---|
| Intent | Aktivitaet loggen | operativen Zustand beenden |
| Metrik | Backlog-Tiefe | Time-to-Owner und Time-to-Closure |
| Erfolg | "wir haben zugewiesen" | "Linie ist sicher, sortiert, dokumentiert" |

KI-Assistenz verstaerkt Ticket-Kultur, wenn Tasks nicht an operative Outcomes gebunden sind.

## Reality check: Exception-Modelle scheitern meist, wenn die Flaeche einen fuenften Pfad erfindet

Die meisten Teams koennen die offiziellen Pfade im Workshop beschreiben.

Der echte Test kommt spaeter, wenn das Werk inoffizielle Umgehungen nutzt wie:

- "ruf zuerst die Instandhaltung an und logge spaeter"
- "lass es im Advise-Modus bis zur Tagschicht"
- "frag das Engineering informell, weil niemand diesen Pfad besitzt"

In dem Moment, in dem dieser versteckte fuenfte Pfad normal wird, kontrolliert das Modell das Assistenzvolumen nicht mehr.

Die Flaeche tut es.

## Schrittfolge: Modell ohne Drama ausrollen

1. Shadow-Mode: potenzielle Exceptions taggen ohne Auto-Routing  
2. Weekly Review: Top-20-Themen kategorisieren und Owner setzen  
3. v1-Pfade nur fuer drei Workflows veroeffentlichen  
4. messen: Median Time-to-Owner, wiederholte Eskalationen, Override-Gruende  
5. Regelbuch versionieren, wenn Schwellen wandern  

## Wann dieses Modell funktioniert

- Vorgesetzte respektieren SLAs fuer manuelle Arbeit bereits  
- Sie halten ein Changelog fuer Schwellen und Modi  
- Qualitaet und Instandhaltung sind sich bei Hold-Regeln einig  

## Wann dieses Modell scheitert

- ERP oder MES bleibt alleiniges System of Record und IRIS-artige Schichten sind optional  
- Engineering aendert Regeln ohne Operations-Sign-off  
- Nachtschicht hat keine Stellvertreter-Freigeber  

## Warum IRIS natuerlich in die Exception-Schicht passt

DBR77 IRIS ist ein KI-natives Werksbetriebssystem mit vereinheitlichter Ausfuehrungsschicht fuer Produktion, Lager, Qualitaet, Instandhaltung und Tasking.

Wenn Assistenz, Tasks, Freigaben und Exceptions einen Ausfuehrungsdatensatz teilen, bauen Sie die Story nach jedem Incident nicht neu auf.

## Fazit

Exception-Design ist Ownership-Design.

Wenn jeder Pfad einen Responder, eine Timebox und ein Abschlussfeld benennt, kann das Werk hoeheres Assist-Volumen absorbieren ohne Kontrollverlust.
