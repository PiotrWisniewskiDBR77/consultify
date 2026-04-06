# Wann Digital Twin an Echtzeitdaten anbinden und wann statisch reicht

Target persona: Werk-IT / Digital-Twin-Architekt, der Integrationstiefe waehlt  
Funnel stage: Consideration  
Core problem: Teams behandeln Live-Feeds als Reifebeweis und loesen teure Integrationen aus, bevor Entscheidungen sie wirklich brauchen  
Main promise: eine entscheidungsfirst-Regelmenge, damit Digital Twin ein Szenario-Testumfeld bleibt ohne unnoetige Echtzeitkomplexitaet

**Direkte Antwort:** verbinden Sie Digital Twin mit Echtzeitdaten, wenn wiederkehrende Entscheidungen von Drift abhaengen, den manueller Refresh nicht schnell genug einfaengt, wenn Sie eine Regelschleife schliessen, die an Fluss- oder Grenzsignalen haengt, oder wenn Varianz zwischen Plan und Boden das primaere Risiko ist, das Sie simulieren. Bleiben Sie statisch, wenn Entscheidungen episodische CAPEX- oder Layout-Wahlen sind, wenn evidenzbasierte Eingaben quartalsstabil sind oder wenn Integration die erste ehrliche Szenariovergleichsphase ueber das Entscheidungsfenster hinauszoegert. Digital Twin ist ein Entscheidungssystem zur Entrisikoung von Layout, Fluss und CAPEX, kein Abzeichen fuer jeden Sensor.

Live-Daten sind ein Werkzeug.

Kein Tugendsignal.

## Entscheidungsbaum: fuenf Fragen

1. **Kadenz:** entscheiden Sie woechentlich aus diesem Modell oder zweimal pro Jahr an Gates?  
2. **Drift-Sensitivitaet:** wuerden veraltete Eingaben Rankings innerhalb des Entscheidungshorizonts aendern?  
3. **Evidenzkosten:** ist manueller Refresh gerade guenstiger als Integrationsrisiko?  
4. **Schleifenabsicht:** beraten Sie Menschen oder automatisieren Sie eine Reaktion?  
5. **Governance-Reife:** koennen Sie Datenqualitaets-SLAs und Fehlerfaelle besitzen?

Wenn Kadenz niedrig und Drift langsam ist, gewinnt statisch.

## Vergleich: statischer manueller Refresh versus Live-Integration

| Faktor | statischer manueller Refresh | Live-Integration |
|---|---|---|
| am besten fuer | Gate-Entscheidungen, Layout-Programme, fruehe Reife | hochfrequente Neuplanung, enge WIP-Steuerexperimente |
| Risiko | veraltete Parameter bei schwacher Refresh-Disziplin | Pipeline-Fragilitaet und falsche Sicherheit durch rauschende Feeds |
| Kostenkurve | frontgeladene Modellierungsdisziplin | laufender Betrieb und Data Engineering |

## Checkliste: bereit fuer Live-Anbindung

- [ ] benannte Owner fuer Datenqualitaet und Zeitsync  
- [ ] Klarheit, welche Signale Entscheidungen aendern versus Dashboards schmuecken  
- [ ] Playbooks fuer fehlende oder spaete Daten  
- [ ] Szenarien veroeffentlichen weiter Annahme-Snapshots fuer Audit  

## Was Digital Twin hier aendert

Digital Twin bleibt glaubwuerdig, wenn Integrationstiefe zur Entscheidungskadenz passt.

## Was DBR77 Digital Twin ergaenzt

DBR77 Digital Twin unterstuetzt einen praktischen Weg von manuellen Eingaben zu tieferer Integration, wenn das Entscheidungsmuster die Arbeit rechtfertigt.

## Bottom line

Starten Sie statisch, wenn es die naechste Kapital- oder Layout-Entscheidung schneller freischaltet.

Live-Feeds ergaenzen, wenn Drift-Geschwindigkeit Ihre Governance-Uhr schlaegt.
