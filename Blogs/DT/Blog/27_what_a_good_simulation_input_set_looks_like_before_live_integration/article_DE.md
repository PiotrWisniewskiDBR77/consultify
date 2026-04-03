# Wie ein guter Simulations-Input-Satz vor Live-Integration aussieht

Target persona: Digital-Transformation Lead / IT-OT Partner / Engineering Manager zur Bewertung des Reifegradpfads  
Funnel stage: Evaluation  
Core problem: Teams verzoegern Simulation, weil sie glauben, Live-Datenintegration sei Pflicht, waehrend der groessere Fehlmodus vage Inputs sind, die keinen echten Entscheidungsvergleich tragen  
Main promise: ein konkreter Input-Standard, der gut genug ist, um Szenarien zu testen, Annahmen nachvollziehbar zu machen und den naechsten Integrationsschritt zu rechtfertigen, ohne so zu tun, als sei die Fabrik voll instrumentiert

ein guter Input-Satz vor der Integration umfasst eine begrenzte Systemkarte, zeitbasierte Prozesslogik, kalibrierten Durchsatz und Variabilitaet an Constraints, realistisches Ruest- und Zuverlaessigkeitsverhalten, Material- und Staffing-Regeln, die der tatsaechlichen Freigabe von Arbeit entsprechen, sowie eine kurze Liste klar benannter Kernannahmen mit Ownern. Damit laufen aussagekraeftige Szenario-Tests. Live-Feeds verbessern spaeter Treue und Aktualisierungsrhythmus, ersetzen aber keine Entscheidungsdisziplin. Live-Integration ist ein Reifegradpfad. Sie ist keine moralische Startvoraussetzung.

## Der minimale entscheidungsfaehige Input-Stack

### 1) Begrenzte Systemkarte

Definieren Sie, was im Modell ist und was bewusst ausgeschlossen ist.

Klare Out-of-Scope-Grenzen verhindern stille Auslassungen, die spaeter Vertrauen zerstoeren.

### 2) Zeitbasierte Prozesslogik

Sequenzen, Routings und Join-Punkte sollten zeigen, wie Auftraege wirklich fliessen, inklusive Rework-Pfade, wenn sie fuer die Entscheidung zaehlen.

### 3) Constraint-Timing mit Variabilitaet

An Schluessel-Constraints erfassen Sie: mediane Zyklus- oder Bearbeitungszeit; Streuung oder Verteilungswahl begruendet durch Daten oder kontrollierte Annahme; Micro-Stop-Verhalten, wenn es effektive Kapazitaet aendert. Nur-Durchschnitts-Inputs sind eine haeufige Quelle falscher Sicherheit.

### 4) Ruest- und Familienlogik

Wenn der Mix fuer die Entscheidung zaehlt, muss der Input-Satz enthalten: Familien-Definitionen, die Bediener wiedererkennen; Ruestzeiten oder -regeln mit realistischen Sequenzen; Scheduling-Politiken, die zeigen, wie Planer wirklich priorisieren.

### 5) Materialfreigabe und Logistikregeln

Staging, Transport-Schleifen und Freigabepolitiken einbeziehen, die Warten erzeugen, obwohl Stationen frei wirken.

### 6) Staffing- und Schichtmechanik

Schichten, Pausen, Skills und Abdeckung sollten durchsetzbar sein, nicht nur theoretisch moeglich.

### 7) Szenarienparameter als kontrollierte Schicht

Nachfrageformen, Lieferverzoegerungsmuster und Schockereignisse sollten editierbar sein, ohne das ganze Modell neu zu bauen.

## Qualitaetspruefungen, bevor Sie Outputs trauen

Nutzen Sie diese Checkliste:

- [ ] das Ist-Modell reproduziert qualitativ eine bekannte schlechte Woche  
- [ ] Bottleneck-Ranking passt im Basisfall zur Shopfloor-Intuition  
- [ ] eine Aenderung einer Kernannahme verschiebt Ergebnisse in eine erklaerbare Richtung  
- [ ] zwei unabhaengige Reviewer koennen Inputs zu Quellen oder Annahmen zurueckverfolgen  
- [ ] der Entscheidungssatz bleibt nach dem ersten Modeling-Sprint unveraendert

Wenn das Modell den Bad-Week-Test nicht besteht, Inputs fixieren, bevor Sie Szenarien debattieren.

## Was Live-Integration hinzufuegt (und was nicht)

Live-Integration fuegt hinzu: schnellere Aktualisierung; weniger manuelle Transkription; engere Ausrichtung auf kurzfristigen Betrieb.

Sie fuegt nicht hinzu: automatische Klarheit, welche Entscheidung getestet wird; Schutz vor Modellierung des falschen Umfangs; Executive-Alignment ohne explizite Annahmen.

## Was Digital Twin hier bedeutet

Digital Twin ist ein Entscheidungssystem und Szenario-Testumfeld. Es ist kein 3D-Showcase.

Gute Inputs machen es zu einer verlaesslichen Vergleichsmaschine, bevor Streams angebunden sind.

## Was DBR77 Digital Twin hinzufuegt

DBR77 Digital Twin unterstuetzt einen praktischen Pfad von manuellen Inputs zu reicherer Integration.

Der Pfad ist so gedacht, dass Teams Wert nachweisen, bevor sie volle Live-Komplexitaet festzurren.

## Fazit

Ein guter Simulations-Input-Satz vor Live-Integration ist begrenzt, zeitrelevant, variability-bewusst und annahmen-nachvollziehbar.

Wenn Sie Kernannahmen nicht benennen koennen, haben Sie kein Modellproblem. Sie haben ein Governance-Problem mit technischer Maske.

---

*Möchten Sie sehen, wie das in der Praxis funktioniert? [Demo buchen](https://dbr77.com/digital-twin) oder [Digital Twin erkunden](https://dbr77.com/demo).*
