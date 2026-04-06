# So legen Sie Akzeptanzkriterien fest, bevor die Automatisierungslieferung beginnt

Target persona: Engineering- und Qualitaetsleadership / technischer Buyer  
Funnel stage: Consideration bis Evaluation (Spezifikation und Vergabeinputs)  
Core problem: Akzeptanz wird als spaete Inbetriebnahme-Debatte behandelt statt als schriftlicher Vertrag, gegen den Lieferung geplant wird  
Main promise: eine begrenzte Methode, Akzeptanzobjekte, Evidenz und Sequenz vor Mobilisierung zu definieren

Akzeptanz ist keine Stimmung beim Go-Live.

Sie ist die operative Definition von Done.

Wenn Sie es nicht testen koennen, koennen Sie es nicht sauber vergeben.

## Direkte Antwort

Setzen Sie Akzeptanzkriterien vor Lieferbeginn, indem Sie eine nummerierte Liste von Akzeptanzobjekten veroeffentlichen, jedes mit objektiver Evidenz, verantwortlichem Verifizierer und Sequenzabhaengigkeiten, und Meilensteine sowie Zahlungs-Trigger an diese Objekte ausrichten.

Akzeptanzdefinition zu verschieben verwandelt Inbetriebnahme in Verhandlung und frisst Zeitplan-Verantwortung.

## Schritt 1: Objekte von Aktivitaeten trennen

Ein Akzeptanzobjekt ist ein Ergebnis, das Sie verifizieren koennen.

Beispiele (illustrativ):

- Taktzeitband unter benanntem SKU-Set und Stationsbedingungen
- Fehlerrate oder Ausschuss-Handling unter definierten Inputs
- Sicherheitsfunktionen validiert unter benannten Szenarien
- Daten-Handshake-Verhalten an benannten Schnittstellenpunkten

Aktivitaeten wie "Schulung abgeschlossen" gehoeren in den Plan, sollten aber wo moeglich auf beobachtbare Ergebnisse mappen.

## Schritt 2: Evidenz pro Objekt definieren

Pro Objekt festlegen:

- Messmethode
- Umgebungsbedingungen
- Stichproben- oder Dauerregel
- Pass- oder Fail-Regel

| schwache Evidenzsprache | starke Evidenzsprache |
| --- | --- |
| "Leistung akzeptabel" | "Durchsatz X bis Y Einheiten pro Stunde mit Ausschuss unter Z unter Bedingungen A" |
| "integriert mit MES" | "Ereignisse E1 bis E3 erscheinen in System S innerhalb T Sekunden in Testfaellen TC1 bis TC5" |

## Schritt 3: Abhaengigkeiten ehrlich sequenzieren

Manche Objekte sind erst beweisbar, wenn andere stabil sind.

Bauen Sie eine einfache Abhaengigkeitsliste (illustrativ):

1. mechanische Sicherheit und Schutzeinrichtung freigegeben
2. Basisbewegung und Handbetrieb
3. Automatikzyklus unter begrenztem SKU-Set
4. MES- oder Qualitaetssystem-Handshake unter Testlasten
5. Abnahmelauf unter produktionsnahen Bedingungen

Wenn Einkauf fruehe Rechnungen will, mappen Sie Meilensteine auf echte Zwischenobjekte, nicht Kalender-Theater.

## Schritt 4: interne Freigaben an Akzeptanzrollen ausrichten

Benennen Sie, wer jede Objektklasse signieren darf:

- Operations fuer Durchsatz und Personalwirkung
- Qualitaet fuer Defekt- und Rueckverfolgbarkeitswirkung
- IT fuer Identitaet und Netzwerk
- Instandhaltung fuer Servicefreundlichkeit

Fehlende Freigeber bei Definition werden fehlende Freigeber bei Sign-off.

## Was das fuer DBR77 Marketplace bedeutet

DBR77 Marketplace ist Workflow fuer Automatisierungsentscheidungen und System zum Vergleich inspectable strukturierter Angebote.

Akzeptanzkriterien gehoeren frueh in diese Struktur: so werden Integratorpfade auf Ergebnisse vergleichbar, nicht auf Slogans.

Marketplace ist kein Roboterkatalog.

Es ist eine Vertrauensschicht fuer Integratorenauswahl, gegruendet auf dem, was das Werk verifizieren kann.

## Fazit

Schreiben Sie Akzeptanz als testbare Objekte mit Evidenz vor Mobilisierung.

Spaete Akzeptanz ist teuer, weil sie spaete Vergleichbarkeit ist.
